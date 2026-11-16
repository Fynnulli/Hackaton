import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { TestDb } from "./harness";

let db: TestDb;

beforeAll(async () => {
  db = await TestDb.create();
  await db.seedEvent();
});
afterAll(() => db.close());

beforeEach(async () => {
  await db.sql("delete from public.participant");
  await db.sql("delete from public.team");
  await db.setPhase("lobby");
  await db.setTimes(null, null, null);
});

const join = (uid: string, code: string, name = "Ada", avatar = "🦊") =>
  db.rpc<{ id: string; display_name: string }>(uid, "join_event", {
    p_join_code: code,
    p_display_name: name,
    p_avatar: avatar,
  });

describe("Beitritt mit Code", () => {
  test("falscher Code wird abgelehnt", async () => {
    const uid = await db.newAuthUser();
    await expect(join(uid, "FALSCH")).rejects.toThrow(/invalid_join_code/);
    expect(await db.sql("select 1 from public.participant")).toEqual([]);
  });

  test("der Code ist unabhaengig von Gross-/Kleinschreibung und Leerzeichen", async () => {
    const uid = await db.newAuthUser();
    const [row] = await join(uid, "  test42 ", "  Ada  ");
    expect(row.id).toBe(uid);
    expect(row.display_name).toBe("Ada");
  });

  test("ein zweiter Beitritt derselben Sitzung liefert die bestehende Teilnahme", async () => {
    const uid = await db.newAuthUser();
    await join(uid, "TEST42", "Ada");
    const [again] = await join(uid, "TEST42", "Jemand anderes");
    expect(again.display_name).toBe("Ada");
    expect(await db.sql("select 1 from public.participant")).toHaveLength(1);
  });

  test("ungueltige Namen und Avatare werden abgelehnt", async () => {
    const uid = await db.newAuthUser();
    await expect(join(uid, "TEST42", "   ")).rejects.toThrow(/invalid_name/);
    await expect(join(uid, "TEST42", "x".repeat(25))).rejects.toThrow(/invalid_name/);
    await expect(join(uid, "TEST42", "Ada", "")).rejects.toThrow(/invalid_avatar/);
  });

  test("nach dem Ende des Events ist kein Beitritt mehr moeglich", async () => {
    await db.setPhase("closed");
    const uid = await db.newAuthUser();
    await expect(join(uid, "TEST42")).rejects.toThrow(/event_closed/);
  });
});

describe("Teams", () => {
  test("ein Team fasst hoechstens drei Personen", async () => {
    const team = await db.makeTeam("Trio", 3);
    const fourth = await db.joinUser();
    await expect(db.rpc(fourth, "join_team", { p_team_code: team.code })).rejects.toThrow(
      /team_full/,
    );
  });

  test("Teamnamen sind eindeutig, Teamcodes werden tolerant gelesen", async () => {
    const team = await db.makeTeam("Einzigartig");
    const other = await db.joinUser();
    await expect(db.rpc(other, "create_team", { p_name: "einzigartig" })).rejects.toThrow(
      /team_name_taken/,
    );
    await expect(
      db.rpc(other, "join_team", { p_team_code: ` ${team.code.toLowerCase()} ` }),
    ).resolves.toBeTruthy();
    await expect(db.rpc(other, "join_team", { p_team_code: "XXXXX" })).rejects.toThrow(
      /already_in_team/,
    );
  });

  test("wer in der Lobby das Team verlaesst, loest ein leeres Team auf", async () => {
    const team = await db.makeTeam("Kurzlebig", 2);
    await db.rpc(team.members[0], "leave_team");
    expect(await db.sql("select 1 from public.team")).toHaveLength(1);
    await db.rpc(team.members[1], "leave_team");
    expect(await db.sql("select 1 from public.team")).toHaveLength(0);
  });

  test("mit Beginn der Bauphase sind Teams fest, nur Teamlose duerfen noch dazustossen", async () => {
    const team = await db.makeTeam("Fest", 1);
    await db.setTimes(-5, 175, 85);

    await expect(db.rpc(team.members[0], "leave_team")).rejects.toThrow(/teams_locked/);

    const late = await db.joinUser();
    await expect(db.rpc(late, "join_team", { p_team_code: team.code })).resolves.toBeTruthy();
    const solo = await db.joinUser();
    await expect(db.rpc(solo, "create_team", { p_name: "Spaetstarter" })).resolves.toBeTruthy();
  });

  test("nach Ablauf der Bauzeit entstehen keine Teams mehr", async () => {
    const team = await db.makeTeam("Rechtzeitig", 1);
    await db.setTimes(-181, -1, -91);
    const late = await db.joinUser();
    await expect(db.rpc(late, "create_team", { p_name: "Zu spaet" })).rejects.toThrow(
      /teams_locked/,
    );
    await expect(db.rpc(late, "join_team", { p_team_code: team.code })).rejects.toThrow(
      /teams_locked/,
    );
  });
});

describe("Wiedereinstieg auf einem neuen Geraet", () => {
  test("der Token uebertraegt Teilnahme, Team und Stimmen auf die neue Sitzung", async () => {
    const mine = await db.makeTeam("Meins", 1);
    const theirs = await db.makeTeam("Deren", 1);
    const oldUid = mine.members[0];
    await db.setTimes(-10, 170, 80);
    const sub = await db.submit(theirs.members[0]);
    await db.setPhase("gallery");
    await db.rpc(oldUid, "cast_vote", { p_submission_id: sub.id });
    const [{ get_reentry_token: token }] = await db.rpc<{ get_reentry_token: string }>(
      oldUid,
      "get_reentry_token",
    );

    const newUid = await db.newAuthUser();
    const [moved] = await db.rpc<{ id: string; team_id: string }>(newUid, "claim_reentry_token", {
      p_token: token,
    });

    expect(moved.id).toBe(newUid);
    expect(moved.team_id).toBe(mine.id);
    expect(await db.as(newUid, "select 1 from public.vote")).toHaveLength(1);
    expect(await db.sql("select 1 from public.participant where id = $1", [oldUid])).toEqual([]);
    // Der Link bleibt gueltig, z. B. fuer den Wechsel zurueck.
    const [{ get_reentry_token: same }] = await db.rpc<{ get_reentry_token: string }>(
      newUid,
      "get_reentry_token",
    );
    expect(same).toBe(token);
  });

  test("ein frischer Beitritt auf dem neuen Geraet wird durch den Token ersetzt", async () => {
    const team = await db.makeTeam("Bestand", 1);
    const [{ get_reentry_token: token }] = await db.rpc<{ get_reentry_token: string }>(
      team.members[0],
      "get_reentry_token",
    );
    const newUid = await db.joinUser();
    const [moved] = await db.rpc<{ team_id: string }>(newUid, "claim_reentry_token", {
      p_token: token,
    });
    expect(moved.team_id).toBe(team.id);
    expect(await db.sql("select 1 from public.participant")).toHaveLength(1);
  });

  test("wer auf dem neuen Geraet schon in einem Team ist, wird nicht ueberschrieben", async () => {
    const a = await db.makeTeam("A", 1);
    const b = await db.makeTeam("B", 1);
    const [{ get_reentry_token: token }] = await db.rpc<{ get_reentry_token: string }>(
      a.members[0],
      "get_reentry_token",
    );
    await expect(
      db.rpc(b.members[0], "claim_reentry_token", { p_token: token }),
    ).rejects.toThrow(/already_joined/);
  });

  test("ein unbekannter Token wird abgelehnt", async () => {
    const uid = await db.newAuthUser();
    await expect(
      db.rpc(uid, "claim_reentry_token", { p_token: "00000000-0000-4000-8000-000000000000" }),
    ).rejects.toThrow(/invalid_token/);
  });
});

describe("Phasensteuerung durch den Admin", () => {
  test("Sofortstart setzt Start, Ende (+180 min) und Twist (+90 min)", async () => {
    const admin = await db.joinUser();
    await db.makeAdmin(admin);
    await db.rpc(admin, "admin_set_phase", { p_phase: "build" });
    const [e] = await db.sql<{ build: number; twist: number; started: boolean }>(
      `select extract(epoch from build_ends_at - starts_at)::int / 60 as build,
              extract(epoch from twist_at - starts_at)::int / 60 as twist,
              starts_at <= now() as started
         from public.event`,
    );
    expect(e).toEqual({ build: 180, twist: 90, started: true });
  });

  test("zurueck in die Lobby verwirft eine bereits abgelaufene Startzeit", async () => {
    const admin = await db.joinUser();
    await db.makeAdmin(admin);
    await db.setTimes(-5, 175, 85);
    await db.rpc(admin, "admin_set_phase", { p_phase: "lobby" });
    const [{ effective_phase: phase }] = await db.rpc<{ effective_phase: string }>(
      admin,
      "effective_phase",
    );
    expect(phase).toBe("lobby");
    expect(
      await db.as(admin, "select 1 from public.challenge_stage"),
    ).toEqual([]);
  });
});
