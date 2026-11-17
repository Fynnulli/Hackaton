import { describe, expect, test } from "vitest";
import type { Submission } from "../../src/lib/types";
import { computeWrapped, formatDuration, slideAt, SLIDES, type RankRow } from "../../src/lib/wrapped";

const START = Date.parse("2026-12-01T18:00:00Z");
const END = START + 180 * 60_000;
const at = (min: number) => new Date(START + min * 60_000).toISOString();

const sub = (id: string, submittedMin: number, updatedMin: number, extra: Partial<Submission> = {}): Submission => ({
  id,
  team_id: `team-${id}`,
  title: `Projekt ${id}`,
  url: "https://x.de",
  description: "",
  screenshot_path: null,
  stage1: true,
  stage2: false,
  stage3: false,
  hidden: false,
  submitted_at: at(submittedMin),
  updated_at: at(updatedMin),
  ...extra,
});

const rank = (place: number, id: string): RankRow => ({
  place,
  submission_id: id,
  team_id: `team-${id}`,
  team_name: `Team ${id}`,
  title: `Projekt ${id}`,
  stage1: true,
  stage2: false,
  stage3: false,
  vote_count: 0,
  points: 10,
  submitted_at: at(0),
});

const base = {
  event: { starts_at: at(0), build_ends_at: new Date(END).toISOString() },
  participants: 12,
  teams: 5,
  teamName: (id: string) => `Team ${id.replace("team-", "")}`,
};

describe("Wrapped-Auswertung", () => {
  test("schnellste Abgabe und letzte Sekunde", () => {
    const stats = computeWrapped({
      ...base,
      submissions: [sub("a", 42, 100), sub("b", 75, 179.9), sub("c", 12, 150)],
      ranking: [],
    });
    expect(stats.fastest).toMatchObject({ teamName: "Team c", ms: 12 * 60_000 });
    expect(stats.lastSecond?.teamName).toBe("Team b");
    expect(stats.lastSecond?.ms).toBeCloseTo(6_000, -2);
  });

  test("ausgeblendete Abgaben und Nachtraege nach dem Ende zaehlen nicht", () => {
    const stats = computeWrapped({
      ...base,
      submissions: [
        sub("a", 30, 170),
        sub("x", 1, 179.99, { hidden: true }),
        sub("late", 60, 200), // vom Admin nach Ablauf nachgetragen
      ],
      ranking: [],
    });
    expect(stats.submissions).toBe(2);
    expect(stats.fastest?.teamName).toBe("Team a");
    expect(stats.lastSecond?.teamName).toBe("Team a");
  });

  test("Stufen-Verteilung und Podium, auch mit weniger als drei Abgaben", () => {
    const stats = computeWrapped({
      ...base,
      submissions: [
        sub("a", 1, 2, { stage2: true, stage3: true }),
        sub("b", 1, 2, { stage2: true }),
      ],
      ranking: [rank(1, "a"), rank(2, "b")],
    });
    expect(stats.stageCounts).toEqual([2, 2, 1]);
    expect(stats.podium.map((r) => r?.team_name ?? null)).toEqual(["Team a", "Team b", null]);
  });

  test("ohne Zeitplan gibt es keine Zeit-Momente", () => {
    const stats = computeWrapped({
      ...base,
      event: { starts_at: null, build_ends_at: null },
      submissions: [sub("a", 1, 2)],
      ranking: [],
    });
    expect(stats.fastest).toBeNull();
    expect(stats.lastSecond).toBeNull();
  });
});

describe("Folien", () => {
  test("Index ausserhalb bleibt auf erster bzw. letzter Folie", () => {
    expect(slideAt(-1)).toBe("intro");
    expect(slideAt(0)).toBe("intro");
    expect(slideAt(SLIDES.length + 5)).toBe("personal");
  });

  test("Plaetze kommen in der Reihenfolge 3, 2, 1, danach die persoenliche Karte", () => {
    const ids = SLIDES.map((s) => s.id);
    expect(ids.indexOf("place3")).toBeLessThan(ids.indexOf("place2"));
    expect(ids.indexOf("place2")).toBeLessThan(ids.indexOf("place1"));
    expect(ids.at(-1)).toBe("personal");
  });

  test("Dauer-Format", () => {
    expect(formatDuration(8_000)).toBe("8 Sek");
    expect(formatDuration(14 * 60_000 + 5_000)).toBe("14 Min 5 Sek");
    expect(formatDuration(72 * 60_000)).toBe("1 Std 12 Min");
    expect(formatDuration(120 * 60_000)).toBe("2 Std");
  });
});
