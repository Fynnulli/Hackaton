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

type Ev = { phase: string; starts_at: string | null; build_ends_at: string | null; twist_at: string | null };
const event = async () => (await db.sql<Ev>("select phase, starts_at, build_ends_at, twist_at from public.event"))[0];
const minutesBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 60_000;

describe("Admin-Funktionen", () => {
  test("jede Admin-Funktion lehnt normale Teilnehmer ab", async () => {
    const team = await db.makeTeam("Fremd");
    const calls: [string, Record<string, unknown>][] = [
      ["admin_set_phase", { p_phase: "gallery" }],
      ["admin_schedule", { p_starts_at: new Date().toISOString() }],
      ["admin_extend_build", { p_minutes: 5 }],
      ["admin_post_announcement", { p_body: "Hallo" }],
      ["admin_set_submission_hidden", { p_submission_id: team.id, p_hidden: true }],
      [
        "admin_upsert_submission",
        {
          p_team_id: team.id,
          p_title: "x",
          p_url: "https://x.de",
          p_description: "",
          p_stage1: true,
          p_stage2: true,
          p_stage3: true,
        },
      ],
      ["admin_set_wrapped_slide", { p_slide: 3 }],
    ];
    for (const [fn, args] of calls) {
      await expect(db.rpc(user, fn, args), fn).rejects.toThrow(/not_admin/);
    }
    expect((await event()).phase).toBe("lobby");
  });

  test("Sofortstart: Phase build ohne Zeitplan startet jetzt mit 180 Minuten und Twist nach 90", async () => {
    await db.rpc(admin, "admin_set_phase", { p_phase: "build" });
    const e = await event();
    expect(e.phase).toBe("build");
    expect(Math.abs(Date.now() - Date.parse(e.starts_at!))).toBeLessThan(60_000);
    expect(minutesBetween(e.starts_at!, e.build_ends_at!)).toBe(180);
    expect(minutesBetween(e.starts_at!, e.twist_at!)).toBe(90);
  });

  test("zurueck in die Lobby loescht eine abgelaufene Startzeit (sonst startet es sofort wieder)", async () => {
    await db.rpc(admin, "admin_set_phase", { p_phase: "build" });
    await db.rpc(admin, "admin_set_phase", { p_phase: "lobby" });
    const e = await event();
    expect(e).toMatchObject({ phase: "lobby", starts_at: null, build_ends_at: null, twist_at: null });
  });

  test("eine zukuenftige Startzeit bleibt beim Wechsel in die Lobby erhalten", async () => {
    await db.setTimes(30, 210, 120);
    await db.rpc(admin, "admin_set_phase", { p_phase: "lobby" });
    expect((await event()).starts_at).not.toBeNull();
  });

  test("Testmodus: Lobby + Start in 30 s, 6 Minuten Bauzeit, Twist nach 3", async () => {
    await db.setPhase("gallery");
    await db.rpc(admin, "admin_set_phase", { p_phase: "lobby" });
    const start = new Date(Date.now() + 30_000).toISOString();
    await db.rpc(admin, "admin_schedule", {
      p_starts_at: start,
      p_build_minutes: 6,
      p_twist_minute: 3,
    });
    const e = await event();
    expect(e.phase).toBe("lobby");
    expect(minutesBetween(e.starts_at!, e.build_ends_at!)).toBe(6);
    expect(minutesBetween(e.starts_at!, e.twist_at!)).toBe(3);
  });

  test("ungueltige Zeitplaene werden abgelehnt", async () => {
    const start = new Date().toISOString();
    for (const [build, twist] of [
      [0, 1],
      [10, 0],
      [10, 10],
      [10, 12],
    ]) {
      await expect(
        db.rpc(admin, "admin_schedule", { p_starts_at: start, p_build_minutes: build, p_twist_minute: twist }),
      ).rejects.toThrow(/invalid_schedule/);
    }
  });

  test("Verlaengern ohne Zeitplan geht nicht, mit Zeitplan verschiebt es nur das Ende", async () => {
    await expect(db.rpc(admin, "admin_extend_build", { p_minutes: 5 })).rejects.toThrow(/not_scheduled/);
    await db.setTimes(-10, 170, 80);
    const before = await event();
    await db.rpc(admin, "admin_extend_build", { p_minutes: 10 });
    const after = await event();
    expect(minutesBetween(before.build_ends_at!, after.build_ends_at!)).toBe(10);
    expect(after.starts_at).toEqual(before.starts_at);
  });

  test("Wrapped-Folie wird nie negativ", async () => {
    await db.rpc(admin, "admin_set_wrapped_slide", { p_slide: -3 });
    expect((await db.sql<{ wrapped_slide: number }>("select wrapped_slide from public.event"))[0].wrapped_slide).toBe(0);
  });
});
