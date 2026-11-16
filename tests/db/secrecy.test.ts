import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { TestDb } from "./harness";

let db: TestDb;
let user: string;
let admin: string;

beforeAll(async () => {
  db = await TestDb.create();
  await db.seedEvent();
  user = await db.joinUser();
  admin = await db.joinUser();
  await db.makeAdmin(admin);
});
afterAll(() => db.close());

beforeEach(async () => {
  await db.setPhase("lobby");
  await db.setTimes(null, null, null);
});

const stages = (uid: string) =>
  db.as<{ stage_no: number; body: string }>(
    uid,
    "select stage_no, body from public.challenge_stage order by stage_no",
  );

describe("Geheimhaltung des Themas", () => {
  test("ohne Startzeit ist keine Stufe lesbar", async () => {
    expect(await stages(user)).toEqual([]);
  });

  test("vor dem Start ist keine Stufe lesbar, auch nicht fuer Admins", async () => {
    await db.setTimes(5, 185, 95);
    expect(await stages(user)).toEqual([]);
    expect(await stages(admin)).toEqual([]);
  });

  test("ab dem Start sind Stufe 1 und 2 lesbar, der Twist noch nicht", async () => {
    await db.setTimes(-1, 179, 89);
    expect((await stages(user)).map((s) => s.stage_no)).toEqual([1, 2]);
  });

  test("ab twist_at ist auch Stufe 3 lesbar", async () => {
    await db.setTimes(-91, 89, -1);
    expect((await stages(user)).map((s) => s.stage_no)).toEqual([1, 2, 3]);
  });

  test("Phase 'build' allein enthuellt nichts, solange die Zeit nicht erreicht ist", async () => {
    await db.setTimes(5, 185, 95);
    await db.setPhase("build");
    expect(await stages(user)).toEqual([]);
  });

  test("reveal_at folgt dem Zeitplan des Admins", async () => {
    await db.rpc(admin, "admin_schedule", {
      p_starts_at: new Date(Date.now() + 60_000).toISOString(),
      p_build_minutes: 10,
      p_twist_minute: 5,
    });
    const rows = await db.sql<{ ok: boolean }>(
      `select bool_and(s.reveal_at = case when s.stage_no = 3 then e.twist_at else e.starts_at end) as ok
         from public.challenge_stage s, public.event e`,
    );
    expect(rows[0].ok).toBe(true);
    expect(await stages(user)).toEqual([]);
  });

  test("neu angelegte Stufen uebernehmen reveal_at und lassen sich nicht vorab freischalten", async () => {
    await db.setTimes(5, 185, 95);
    await db.sql("delete from public.challenge_stage where stage_no = 2");
    await db.sql(
      "insert into public.challenge_stage (stage_no, title, body, reveal_at) values (2, 'Stufe 2', 'GEHEIM-2', now() - interval '1 day')",
    );
    expect(await stages(user)).toEqual([]);
  });

  test("Clients koennen Stufen und Event nicht direkt veraendern", async () => {
    await expect(
      db.as(user, "update public.challenge_stage set reveal_at = now() - interval '1 hour'"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.as(user, "update public.event set starts_at = now() - interval '1 hour'"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.as(admin, "update public.event set phase = 'wrapped'"),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("Zugriff ohne Anmeldung und auf Geheimnisse", () => {
  test("die Rolle anon kann weder lesen noch RPCs aufrufen", async () => {
    await expect(db.as(null, "select * from public.event", [], "anon")).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      db.as(null, "select public.join_event('TEST42', 'X', '🦊')", [], "anon"),
    ).rejects.toThrow(/permission denied/);
    await expect(db.as(null, "select public.server_time()", [], "anon")).rejects.toThrow(
      /permission denied/,
    );
  });

  test("Wiedereinstiegs-Tokens sind nicht auslesbar", async () => {
    await expect(db.as(user, "select * from public.participant_secret")).rejects.toThrow(
      /permission denied/,
    );
    const [mine] = await db.rpc<{ get_reentry_token: string }>(user, "get_reentry_token");
    const [other] = await db.rpc<{ get_reentry_token: string }>(admin, "get_reentry_token");
    expect(mine.get_reentry_token).toMatch(/^[0-9a-f-]{36}$/);
    expect(mine.get_reentry_token).not.toBe(other.get_reentry_token);
  });

  test("Teamcodes fremder Teams sind nicht auslesbar", async () => {
    const team = await db.makeTeam("Codeknacker");
    await expect(db.as(user, "select team_code from public.team")).rejects.toThrow(
      /permission denied/,
    );
    await expect(db.as(user, "select * from public.team")).rejects.toThrow(/permission denied/);
    const names = await db.as<{ name: string }>(user, "select id, name from public.team");
    expect(names.map((t) => t.name)).toContain("Codeknacker");
    const [own] = await db.rpc<{ team_code: string }>(team.members[0], "get_my_team");
    expect(own.team_code).toBe(team.code);
  });

  test("Admin-RPCs sind fuer normale Teilnehmer gesperrt", async () => {
    const calls: [string, Record<string, unknown>][] = [
      ["admin_set_phase", { p_phase: "wrapped" }],
      ["admin_schedule", { p_starts_at: new Date().toISOString() }],
      ["admin_extend_build", { p_minutes: 10 }],
      ["admin_post_announcement", { p_body: "Hallo" }],
      ["admin_set_wrapped_slide", { p_slide: 3 }],
    ];
    for (const [fn, args] of calls) {
      await expect(db.rpc(user, fn, args)).rejects.toThrow(/not_admin/);
    }
  });

  test("niemand kann sich selbst zum Admin machen", async () => {
    await expect(
      db.as(user, "update public.participant set is_admin = true where id = $1", [user]),
    ).rejects.toThrow(/permission denied/);
  });
});
