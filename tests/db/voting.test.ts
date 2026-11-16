import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { TestDb } from "./harness";

type Team = { id: string; code: string; members: string[] };

let db: TestDb;
let admin: string;
let teams: Team[];
let subs: string[];

beforeAll(async () => {
  db = await TestDb.create();
  await db.seedEvent();
  admin = await db.joinUser();
  await db.makeAdmin(admin);
  teams = [];
  for (const name of ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"]) {
    teams.push(await db.makeTeam(name, name === "Alpha" ? 2 : 1));
  }
  await db.setPhase("build");
  await db.setTimes(-10, 170, 80);
  subs = [];
  for (const [i, team] of teams.entries()) {
    const sub = await db.submit(team.members[0], {
      p_title: `Projekt ${i}`,
      p_stage1: true,
      p_stage2: false,
      p_stage3: false,
    });
    // Abgabezeiten in bekannter Reihenfolge: Alpha zuerst, Epsilon zuletzt.
    await db.sql(
      `update public.submission set submitted_at = now() - interval '${60 - i} minutes' where id = $1`,
      [sub.id],
    );
    subs.push(sub.id);
  }
});
afterAll(() => db.close());

beforeEach(async () => {
  await db.sql("delete from public.vote");
  await db.sql("update public.submission set hidden = false, stage1 = true, stage2 = false, stage3 = false");
  await db.setPhase("gallery");
});

const vote = (uid: string, submissionId: string) =>
  db.rpc<{ cast_vote: number }>(uid, "cast_vote", { p_submission_id: submissionId });

describe("Stimmenlimit", () => {
  test("drei Stimmen sind erlaubt, die vierte wird abgelehnt", async () => {
    const voter = teams[0].members[0];
    expect((await vote(voter, subs[1]))[0].cast_vote).toBe(2);
    expect((await vote(voter, subs[2]))[0].cast_vote).toBe(1);
    expect((await vote(voter, subs[3]))[0].cast_vote).toBe(0);
    await expect(vote(voter, subs[4])).rejects.toThrow(/no_votes_left/);
    const [{ count }] = await db.sql<{ count: number }>(
      "select count(*)::int as count from public.vote where voter_id = $1",
      [voter],
    );
    expect(count).toBe(3);
  });

  test("hoechstens eine Stimme pro Abgabe", async () => {
    const voter = teams[0].members[0];
    await vote(voter, subs[1]);
    await expect(vote(voter, subs[1])).rejects.toThrow(/already_voted/);
  });

  test("keine Stimme fuer das eigene Team, auch nicht durch Teammitglieder", async () => {
    await expect(vote(teams[0].members[0], subs[0])).rejects.toThrow(/cannot_vote_own_team/);
    await expect(vote(teams[0].members[1], subs[0])).rejects.toThrow(/cannot_vote_own_team/);
  });

  test("abgestimmt wird nur in der Galerie-Phase", async () => {
    for (const phase of ["lobby", "build", "wrapped", "closed"]) {
      await db.setPhase(phase);
      await expect(vote(teams[0].members[0], subs[1])).rejects.toThrow(/voting_closed/);
    }
  });

  test("ausgeblendete Abgaben koennen keine Stimmen erhalten", async () => {
    await db.sql("update public.submission set hidden = true where id = $1", [subs[1]]);
    await expect(vote(teams[0].members[0], subs[1])).rejects.toThrow(/invalid_submission/);
  });

  test("wer kein Team hat, kann nicht abstimmen (kein Stimmen-Farming ueber Neuanmeldungen)", async () => {
    const fresh = await db.joinUser();
    await expect(vote(fresh, subs[1])).rejects.toThrow(/no_team/);
    await expect(db.rpc(fresh, "create_team", { p_name: "Nachzuegler" })).rejects.toThrow(
      /teams_locked/,
    );
  });

  test("am Limit fuehrt kein direkter Tabellenzugriff vorbei", async () => {
    const voter = teams[0].members[0];
    await expect(
      db.as(voter, "insert into public.vote (voter_id, submission_id) values ($1, $2)", [
        voter,
        subs[1],
      ]),
    ).rejects.toThrow(/permission denied/);
    await vote(voter, subs[1]);
    await expect(db.as(voter, "delete from public.vote")).rejects.toThrow(/permission denied/);
  });

  test("eine Stimme kann in der Galerie zurueckgenommen und neu vergeben werden", async () => {
    const voter = teams[0].members[0];
    await vote(voter, subs[1]);
    await vote(voter, subs[2]);
    await vote(voter, subs[3]);
    const [{ remove_vote: left }] = await db.rpc<{ remove_vote: number }>(voter, "remove_vote", {
      p_submission_id: subs[3],
    });
    expect(left).toBe(1);
    await expect(vote(voter, subs[4])).resolves.toBeTruthy();
    await db.setPhase("wrapped");
    await expect(db.rpc(voter, "remove_vote", { p_submission_id: subs[4] })).rejects.toThrow(
      /voting_closed/,
    );
  });
});

describe("Stimmenstaende und Wertung", () => {
  test("jeder sieht nur die eigenen Stimmen", async () => {
    await vote(teams[0].members[0], subs[1]);
    await vote(teams[2].members[0], subs[1]);
    const mine = await db.as(teams[0].members[0], "select id from public.vote");
    expect(mine).toHaveLength(1);
    const other = await db.as(teams[1].members[0], "select id from public.vote");
    expect(other).toHaveLength(0);
  });

  test("die Wertung bleibt bis zum Wrapped leer, der Admin sieht sie vorab", async () => {
    await vote(teams[0].members[0], subs[1]);
    expect(await db.rpc(teams[1].members[0], "get_leaderboard")).toEqual([]);
    expect(await db.rpc(admin, "get_leaderboard")).toHaveLength(5);
    await db.setPhase("wrapped");
    expect(await db.rpc(teams[1].members[0], "get_leaderboard")).toHaveLength(5);
  });

  test("Punkte: 10 / 10 / 15 je Stufe, 5 je Stimme; bei Gleichstand gewinnt die fruehere Abgabe", async () => {
    // Beta: alle Stufen (35) + 1 Stimme = 40
    await db.sql("update public.submission set stage2 = true, stage3 = true where id = $1", [subs[1]]);
    await vote(teams[0].members[0], subs[1]);
    // Gamma: Stufe 1 (10) + 2 Stimmen = 20
    await vote(teams[0].members[0], subs[2]);
    await vote(teams[1].members[0], subs[2]);
    // Delta: Stufe 1 + 2 (20), keine Stimme = 20, aber spaeter abgegeben als Gamma
    await db.sql("update public.submission set stage2 = true where id = $1", [subs[3]]);
    // Epsilon: ausgeblendet
    await db.sql("update public.submission set hidden = true where id = $1", [subs[4]]);

    await db.setPhase("wrapped");
    const board = await db.rpc<{
      place: number;
      team_name: string;
      points: number;
      vote_count: number;
    }>(teams[3].members[0], "get_leaderboard");

    expect(board.map((r) => [r.place, r.team_name, r.points, r.vote_count])).toEqual([
      [1, "Beta", 40, 1],
      [2, "Gamma", 20, 2],
      [3, "Delta", 20, 0],
      [4, "Alpha", 10, 0],
    ]);
  });
});
