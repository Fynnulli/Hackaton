import { describe, expect, test } from "vitest";
import { pickOffset } from "../../src/lib/clock";
import { pickScreen, REVEAL_MS } from "../../src/lib/phase";
import type { EventPhase } from "../../src/lib/types";

describe("Serverzeit-Versatz", () => {
  test("nimmt die Messung mit der kuerzesten Laufzeit und deren Mitte", () => {
    const offset = pickOffset([
      { sentAt: 1000, receivedAt: 1400, serverMs: 6000 }, // RTT 400
      { sentAt: 2000, receivedAt: 2040, serverMs: 7020 }, // RTT 40, Mitte 2020 -> +5000
      { sentAt: 3000, receivedAt: 3300, serverMs: 8500 },
    ]);
    expect(offset).toBe(5000);
  });

  test("negativer Versatz, wenn die Browseruhr vorgeht", () => {
    expect(pickOffset([{ sentAt: 10_000, receivedAt: 10_020, serverMs: 4_010 }])).toBe(-6000);
  });

  test("ohne gueltige Messung kein Versatz", () => {
    expect(pickOffset([])).toBeNull();
    expect(pickOffset([{ sentAt: 5, receivedAt: 1, serverMs: 3 }])).toBeNull();
    expect(pickOffset([{ sentAt: 1, receivedAt: 2, serverMs: NaN }])).toBeNull();
  });
});

describe("Bildschirmwahl", () => {
  const start = Date.parse("2026-12-01T18:00:00Z");
  const ev = (phase: EventPhase, startsAt: number | null, endsAt: number | null = null) => ({
    phase,
    starts_at: startsAt === null ? null : new Date(startsAt).toISOString(),
    build_ends_at: endsAt === null ? null : new Date(endsAt).toISOString(),
  });

  test("ohne Event oder Startzeit: Lobby", () => {
    expect(pickScreen(null, start)).toEqual({ kind: "lobby" });
    expect(pickScreen(ev("lobby", null), start)).toEqual({ kind: "lobby" });
  });

  test("vor dem Start: Lobby, auch eine Millisekunde davor", () => {
    expect(pickScreen(ev("lobby", start), start - 1)).toEqual({ kind: "lobby" });
  });

  test("genau beim Start beginnt die Enthuellung bei 0", () => {
    expect(pickScreen(ev("lobby", start), start)).toEqual({ kind: "reveal", elapsedMs: 0 });
  });

  test("mitten in der Enthuellung (Reload): richtige Stelle", () => {
    expect(pickScreen(ev("lobby", start), start + 4200)).toEqual({
      kind: "reveal",
      elapsedMs: 4200,
    });
  });

  test("ab 10 s: Bauphase", () => {
    expect(pickScreen(ev("lobby", start), start + REVEAL_MS)).toEqual({ kind: "build" });
    expect(pickScreen(ev("build", start), start + 3_600_000)).toEqual({ kind: "build" });
  });

  test("Admin schaltet zurueck in die Lobby: Startzeit geloescht", () => {
    expect(pickScreen(ev("lobby", null), start + 5000)).toEqual({ kind: "lobby" });
  });

  test("spaetere Phasen", () => {
    expect(pickScreen(ev("gallery", start), start + 1e8)).toEqual({
      kind: "after",
      phase: "gallery",
    });
  });
});
