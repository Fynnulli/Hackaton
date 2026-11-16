import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { TestDb } from "./harness";

let db: TestDb;
let admin: string;
let alpha: { id: string; code: string; members: string[] };
let beta: { id: string; code: string; members: string[] };

beforeAll(async () => {
  db = await TestDb.create();
  await db.seedEvent();
  admin = await db.joinUser();
  await db.makeAdmin(admin);
  alpha = await db.makeTeam("Alpha", 2);
  beta = await db.makeTeam("Beta", 1);
});
afterAll(() => db.close());

beforeEach(async () => {
  await db.sql("delete from public.submission");
  await db.sql("delete from public.announcement");
  await db.setPhase("build");
  await db.setTimes(-10, 170, 80);
});

describe("Zeitsperre der Abgabe", () => {
  test("waehrend der Bauphase kann abgegeben und beliebig oft geaendert werden", async () => {
    const first = await db.submit(alpha.members[0], { p_title: "Erster Wurf" });
    const second = await db.submit(alpha.members[1], { p_title: "Zweiter Wurf", p_stage2: true });
    expect(second.id).toBe(first.id);

    const rows = await db.sql<{ title: string; stage2: boolean; same_time: boolean }>(
      "select title, stage2, submitted_at = updated_at as same_time from public.submission",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Zweiter Wurf");
    expect(rows[0].stage2).toBe(true);
  });

  test("vor dem Start ist die Abgabe gesperrt", async () => {
    await db.setPhase("lobby");
    await db.setTimes(5, 185, 95);
    await expect(db.submit(alpha.members[0])).rejects.toThrow(/submissions_closed/);
  });

  test("nach build_ends_at ist die Abgabe gesperrt, auch wenn die Phase noch 'build' ist", async () => {
    await db.submit(alpha.members[0]);
    await db.setTimes(-181, -1, -91);
    await expect(db.submit(alpha.members[0], { p_title: "Zu spaet" })).rejects.toThrow(
      /submissions_closed/,
    );
    await expect(db.submit(beta.members[0])).rejects.toThrow(/submissions_closed/);
    const rows = await db.sql<{ title: string }>("select title from public.submission");
    expect(rows).toEqual([{ title: "Projekt" }]);
  });

  test("in Galerie, Wrapped und Archiv ist die Abgabe gesperrt, auch bei laufender Uhr", async () => {
    for (const phase of ["gallery", "wrapped", "closed"]) {
      await db.setPhase(phase);
      await expect(db.submit(alpha.members[0])).rejects.toThrow(/submissions_closed/);
    }
  });

  test("ist die Startzeit erreicht, oeffnet die Abgabe auch ohne Phasenwechsel durch den Admin", async () => {
    await db.setPhase("lobby");
    await db.setTimes(-1, 179, 89);
    await expect(db.submit(alpha.members[0])).resolves.toBeTruthy();
  });

  test("eine Verlaengerung durch den Admin oeffnet die Abgabe wieder", async () => {
    await db.setTimes(-181, -1, -91);
    await expect(db.submit(alpha.members[0])).rejects.toThrow(/submissions_closed/);
    await db.rpc(admin, "admin_extend_build", { p_minutes: 10 });
    await expect(db.submit(alpha.members[0])).resolves.toBeTruthy();
  });

  test("an der Sperre fuehrt kein direkter Tabellenzugriff vorbei", async () => {
    const sub = await db.submit(alpha.members[0]);
    await db.setTimes(-181, -1, -91);
    await expect(
      db.as(alpha.members[0], "update public.submission set title = 'Hack' where id = $1", [sub.id]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.as(
        beta.members[0],
        "insert into public.submission (team_id, title, url) values ($1, 'Hack', 'https://x.y')",
        [beta.id],
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.as(alpha.members[0], "delete from public.submission where id = $1", [sub.id]),
    ).rejects.toThrow(/permission denied/);
  });

  test("der Admin kann nach Ablauf eine Abgabe nachtragen", async () => {
    await db.setTimes(-181, -1, -91);
    await db.rpc(admin, "admin_upsert_submission", {
      p_team_id: beta.id,
      p_title: "Nachgetragen",
      p_url: "https://example.com/beta",
      p_description: "",
      p_stage1: true,
      p_stage2: true,
      p_stage3: false,
    });
    const rows = await db.sql<{ title: string }>("select title from public.submission");
    expect(rows).toEqual([{ title: "Nachgetragen" }]);
  });
});

describe("Regeln der Abgabe", () => {
  test("ohne Team keine Abgabe", async () => {
    const loner = await db.joinUser();
    await expect(db.submit(loner)).rejects.toThrow(/no_team/);
  });

  test("Eingaben werden serverseitig geprueft", async () => {
    const uid = alpha.members[0];
    await expect(db.submit(uid, { p_title: "  " })).rejects.toThrow(/invalid_title/);
    await expect(db.submit(uid, { p_url: "javascript:alert(1)" })).rejects.toThrow(/invalid_url/);
    await expect(db.submit(uid, { p_description: "x".repeat(301) })).rejects.toThrow(
      /invalid_description/,
    );
    await expect(
      db.submit(uid, { p_screenshot_path: `${beta.id}/bild.png` }),
    ).rejects.toThrow(/invalid_screenshot/);
    await expect(
      db.submit(uid, { p_screenshot_path: `${alpha.id}/bild.png` }),
    ).resolves.toBeTruthy();
  });

  test("die erste Abgabe erzeugt genau eine Ticker-Meldung", async () => {
    await db.submit(alpha.members[0]);
    await db.submit(alpha.members[1]);
    const rows = await db.sql<{ body: string; kind: string }>(
      "select body, kind from public.announcement",
    );
    expect(rows).toEqual([{ body: "Team Alpha hat abgegeben", kind: "system" }]);
  });

  test("vor der Galerie sieht jedes Team nur die eigene Abgabe", async () => {
    await db.submit(alpha.members[0]);
    await db.submit(beta.members[0]);
    const seen = await db.as<{ team_id: string }>(
      alpha.members[1],
      "select team_id from public.submission",
    );
    expect(seen).toEqual([{ team_id: alpha.id }]);
    expect(await db.as(admin, "select id from public.submission")).toHaveLength(2);
  });

  test("in der Galerie sind alle nicht ausgeblendeten Abgaben sichtbar", async () => {
    await db.submit(alpha.members[0]);
    const hidden = await db.submit(beta.members[0]);
    await db.rpc(admin, "admin_set_submission_hidden", {
      p_submission_id: hidden.id,
      p_hidden: true,
    });
    await db.setPhase("gallery");
    const outsider = await db.joinUser();
    const seen = await db.as<{ team_id: string }>(outsider, "select team_id from public.submission");
    expect(seen).toEqual([{ team_id: alpha.id }]);
  });

  test("Screenshots lassen sich nur in den eigenen Team-Ordner und nur bei offener Abgabe hochladen", async () => {
    const upload = (uid: string, path: string) =>
      db.as(uid, "insert into storage.objects (bucket_id, name) values ('screenshots', $1)", [path]);
    await expect(upload(alpha.members[0], `${alpha.id}/a.png`)).resolves.toBeTruthy();
    await expect(upload(alpha.members[0], `${beta.id}/a.png`)).rejects.toThrow(/row-level security/);
    await db.setTimes(-181, -1, -91);
    await expect(upload(alpha.members[0], `${alpha.id}/b.png`)).rejects.toThrow(
      /row-level security/,
    );
  });

  test("fremde Screenshots sind erst ab der Galerie auflistbar", async () => {
    await db.sql("delete from storage.objects");
    await db.sql(
      "insert into storage.objects (bucket_id, name) values ('screenshots', $1), ('screenshots', $2)",
      [`${alpha.id}/a.webp`, `${beta.id}/b.webp`],
    );
    const list = (uid: string) =>
      db.as<{ name: string }>(uid, "select name from storage.objects order by name");

    expect(await list(beta.members[0])).toEqual([{ name: `${beta.id}/b.webp` }]);
    expect(await list(admin)).toHaveLength(2);

    await db.setPhase("gallery");
    expect(await list(beta.members[0])).toHaveLength(2);
  });
});
