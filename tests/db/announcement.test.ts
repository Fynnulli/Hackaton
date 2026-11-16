import { afterAll, beforeAll, describe, expect, test } from "vitest";
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

describe("Live-Ticker", () => {
  test("Teilnehmer koennen Durchsagen lesen, aber nicht direkt schreiben", async () => {
    await db.rpc(admin, "admin_post_announcement", { p_body: "Pizza ist da" });
    const rows = await db.as<{ body: string; kind: string }>(
      user,
      "select body, kind from public.announcement",
    );
    expect(rows).toContainEqual({ body: "Pizza ist da", kind: "admin" });

    await expect(
      db.as(user, "insert into public.announcement (body, kind) values ('Fake', 'admin')"),
    ).rejects.toThrow(/permission denied/);
  });

  test("nur Admins duerfen Durchsagen senden", async () => {
    await expect(
      db.rpc(user, "admin_post_announcement", { p_body: "Ich bin Admin" }),
    ).rejects.toThrow(/not_admin/);
  });

  test("ohne Anmeldung keine Durchsagen", async () => {
    await expect(
      db.as(null, "select * from public.announcement", [], "anon"),
    ).rejects.toThrow(/permission denied/);
  });

  test("erste Abgabe eines Teams erzeugt ein Ereignis, eine Aenderung nicht", async () => {
    await db.setTimes(-1, 179, 89);
    const team = await db.makeTeam("Ticker-Team");
    await db.submit(team.members[0]);
    await db.submit(team.members[0], { p_title: "Neuer Titel" });
    const rows = await db.sql<{ body: string }>(
      "select body from public.announcement where kind = 'system' and body like '%Ticker-Team%'",
    );
    expect(rows).toEqual([{ body: "Team Ticker-Team hat abgegeben" }]);
  });
});
