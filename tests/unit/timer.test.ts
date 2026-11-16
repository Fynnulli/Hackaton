import { describe, expect, test } from "vitest";
import { buildProgress, formatRemaining, timerTone } from "../../src/lib/timer";

const MIN = 60_000;

describe("Timerfarbe", () => {
  test("Farbwechsel genau bei 30, 10 und 1 Minute", () => {
    expect(timerTone(30 * MIN + 1)).toBe("calm");
    expect(timerTone(30 * MIN)).toBe("warn");
    expect(timerTone(10 * MIN + 1)).toBe("warn");
    expect(timerTone(10 * MIN)).toBe("hot");
    expect(timerTone(1 * MIN + 1)).toBe("hot");
    expect(timerTone(1 * MIN)).toBe("final");
    expect(timerTone(1)).toBe("final");
    expect(timerTone(0)).toBe("over");
    expect(timerTone(-5000)).toBe("over");
  });
});

describe("Restzeit-Format", () => {
  test("mit Stunden, ohne Stunden, aufgerundet", () => {
    expect(formatRemaining(3 * 3600_000)).toBe("3:00:00");
    expect(formatRemaining(59 * MIN + 59_001)).toBe("1:00:00");
    expect(formatRemaining(9 * MIN + 5_000)).toBe("09:05");
    expect(formatRemaining(400)).toBe("00:01");
    expect(formatRemaining(0)).toBe("00:00");
    expect(formatRemaining(-1000)).toBe("00:00");
  });
});

describe("Fortschritt", () => {
  test("0 am Start, 1 am Ende, begrenzt", () => {
    expect(buildProgress(0, 100, -5)).toBe(0);
    expect(buildProgress(0, 100, 25)).toBe(0.25);
    expect(buildProgress(0, 100, 500)).toBe(1);
    expect(buildProgress(100, 100, 50)).toBe(1);
  });
});
