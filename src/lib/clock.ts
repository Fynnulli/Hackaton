/** Eine Messung gegen server_time(): Browserzeit vor und nach dem Aufruf, Serverzeit dazwischen. */
export interface ClockSample {
  sentAt: number;
  receivedAt: number;
  serverMs: number;
}

/**
 * Versatz Server minus Browser in ms. Die Antwort mit der kuerzesten Laufzeit gewinnt,
 * weil dort die Annahme "Server hat in der Mitte geantwortet" am wenigsten falsch ist.
 */
export function pickOffset(samples: ClockSample[]): number | null {
  let best: ClockSample | null = null;
  for (const s of samples) {
    if (!Number.isFinite(s.serverMs) || s.receivedAt < s.sentAt) continue;
    if (!best || s.receivedAt - s.sentAt < best.receivedAt - best.sentAt) best = s;
  }
  if (!best) return null;
  return Math.round(best.serverMs - (best.sentAt + (best.receivedAt - best.sentAt) / 2));
}
