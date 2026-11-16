/** Stimmung des Bauphasen-Timers je nach Restzeit (Farbwechsel bei 30, 10 und 1 Minute). */
export type TimerTone = "calm" | "warn" | "hot" | "final" | "over";

const MIN = 60_000;

export function timerTone(remainingMs: number): TimerTone {
  if (remainingMs <= 0) return "over";
  if (remainingMs <= 1 * MIN) return "final";
  if (remainingMs <= 10 * MIN) return "hot";
  if (remainingMs <= 30 * MIN) return "warn";
  return "calm";
}

/** H:MM:SS, ab unter einer Stunde MM:SS. Rundet ab, damit 0 genau beim Ende erscheint. */
export function formatRemaining(remainingMs: number): string {
  const total = Math.max(0, Math.ceil(remainingMs / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Anteil der verstrichenen Bauzeit, 0 bis 1. */
export function buildProgress(startMs: number, endMs: number, nowMs: number): number {
  if (endMs <= startMs) return 1;
  return Math.min(1, Math.max(0, (nowMs - startMs) / (endMs - startMs)));
}
