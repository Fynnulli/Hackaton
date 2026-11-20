import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { TestDb } from "./harness";

let db: TestDb;
let user: string;
let admin: string;

const FILES = ["1/briefing.pdf", "2/daten.csv", "3/neue-daten.csv", "3/extra.zip", "lose.pdf", "x/1.pdf"];

beforeAll(async () => {
  db = await TestDb.create();
  await db.seedEvent();
  user = await db.joinUser();
  admin = await db.joinUser();
  await db.makeAdmin(admin);
  // Upload "ueber das Dashboard": als Superuser, vorbei an RLS.
  for (const name of FILES) {
    await db.sql("insert into storage.objects (bucket_id, name) values ('material', $1)", [name]);
  }
});
afterAll(() => db.close());

beforeEach(async () => {
  await db.setPhase("lobby");
  await db.setTimes(null, null, null);
});

/** So wie storage.list('<ordner>') die Objekte eines Ordners abfragt. */
const list = (uid: string, folder: string) =>
  db
    .as<{ name: string }>(
      uid,
      `select name from storage.objects
        where bucket_id = 'material' and (storage.foldername(name))[1] = $1 order by name`,
      [folder],
    )
    .then((rows) => rows.map((r) => r.name));

/** So wie Download bzw. createSignedUrl ein einzelnes Objekt nachschlagen. */
const load = (uid: string, name: string) =>
  db
    .as<{ name: string }>(
      uid,
      "select name from storage.objects where bucket_id = 'material' and name = $1",
      [name],
    )
    .then((rows) => rows.length > 0);

const all = (uid: string) =>
  db
    .as<{ name: string }>(
      uid,
      "select name from storage.objects where bucket_id = 'material' order by name",
    )
    .then((rows) => rows.map((r) => r.name));

describe("Material: Bucket", () => {
  test("ist privat, bis 50 MB", async () => {
    const [bucket] = await db.sql<{ public: boolean; file_size_limit: string }>(
      "select public, file_size_limit from storage.buckets where id = 'material'",
    );
    expect(bucket.public).toBe(false);
    expect(Number(bucket.file_size_limit)).toBe(50 * 1024 * 1024);
  });
});

describe("Material: Zeitsperre", () => {
  test("ohne Startzeit ist nichts auflistbar oder ladbar", async () => {
    expect(await all(user)).toEqual([]);
    expect(await all(admin)).toEqual([]);
  });

  test("Dateien in 1/ sind vor starts_at weder auflistbar noch ladbar, auch nicht fuer Admins", async () => {
    await db.setTimes(5, 185, 95);
    for (const uid of [user, admin]) {
      expect(await list(uid, "1")).toEqual([]);
      expect(await load(uid, "1/briefing.pdf")).toBe(false);
      expect(await all(uid)).toEqual([]);
    }
  });

  test("Phase 'build' allein gibt nichts frei, solange die Zeit nicht erreicht ist", async () => {
    await db.setTimes(5, 185, 95);
    await db.setPhase("build");
    expect(await list(user, "1")).toEqual([]);
  });

  test("ab starts_at sind 1/ und 2/ frei, 3/ bleibt bis twist_at gesperrt", async () => {
    await db.setTimes(-1, 179, 89);
    expect(await list(user, "1")).toEqual(["1/briefing.pdf"]);
    expect(await load(user, "2/daten.csv")).toBe(true);
    expect(await list(user, "3")).toEqual([]);
    expect(await list(admin, "3")).toEqual([]);
    expect(await load(user, "3/neue-daten.csv")).toBe(false);
  });

  test("ab twist_at sind auch die Dateien in 3/ frei", async () => {
    await db.setTimes(-91, 89, -1);
    expect(await list(user, "3")).toEqual(["3/extra.zip", "3/neue-daten.csv"]);
    expect(await load(user, "3/neue-daten.csv")).toBe(true);
  });

  test("Dateien ausserhalb eines Stufen-Ordners sind nie sichtbar", async () => {
    await db.setTimes(-91, 89, -1);
    expect(await all(user)).toEqual([
      "1/briefing.pdf",
      "2/daten.csv",
      "3/extra.zip",
      "3/neue-daten.csv",
    ]);
  });

  test("ohne Stufe in challenge_stage bleibt der Ordner gesperrt", async () => {
    await db.setTimes(-91, 89, -1);
    await db.sql("delete from public.challenge_stage where stage_no = 2");
    expect(await list(user, "2")).toEqual([]);
    await db.sql(
      "insert into public.challenge_stage (stage_no, title, body) values (2, 'Stufe 2', 'GEHEIM-2')",
    );
    expect(await list(user, "2")).toEqual(["2/daten.csv"]);
  });

  test("die Rolle anon sieht nie etwas", async () => {
    await db.setTimes(-91, 89, -1);
    expect(await db.as(null, "select name from storage.objects where bucket_id = 'material'", [], "anon")).toEqual([]);
  });
});

describe("Material: kein Schreiben durch Clients", () => {
  test("Upload ist fuer Teilnehmende und Admins gesperrt, auch nach der Freigabe", async () => {
    await db.setTimes(-91, 89, -1);
    for (const uid of [user, admin]) {
      await expect(
        db.as(uid, "insert into storage.objects (bucket_id, name) values ('material', '1/boese.pdf')"),
      ).rejects.toThrow(/row-level security/);
    }
  });

  test("Aendern und Loeschen wirkt nicht", async () => {
    await db.setTimes(-91, 89, -1);
    await db.as(admin, "update storage.objects set name = '1/umbenannt.pdf' where bucket_id = 'material'");
    await db.as(admin, "delete from storage.objects where bucket_id = 'material'");
    await db.as(user, "delete from storage.objects where bucket_id = 'material'");
    const rows = await db.sql<{ name: string }>(
      "select name from storage.objects where bucket_id = 'material' order by name",
    );
    expect(rows.map((r) => r.name)).toEqual([...FILES].sort());
  });
});
