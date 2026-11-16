import type { EventPhase, EventRow } from "./types";

type Times = Pick<EventRow, "phase" | "starts_at" | "build_ends_at">;

/**
 * Spiegelt public.effective_phase() aus der Datenbank: Die Bauphase beginnt mit
 * starts_at von selbst, auch wenn die gespeicherte Phase noch "lobby" ist.
 */
export function derivePhase(event: Times, nowMs: number): EventPhase {
  if (event.phase === "lobby" && event.starts_at && Date.parse(event.starts_at) <= nowMs) {
    return "build";
  }
  return event.phase;
}

/** Spiegelt public.is_build_open(). */
export function isBuildOpen(event: Times, nowMs: number): boolean {
  return (
    derivePhase(event, nowMs) === "build" &&
    event.build_ends_at !== null &&
    nowMs < Date.parse(event.build_ends_at)
  );
}

export const PHASE_LABEL: Record<EventPhase, string> = {
  lobby: "Lobby",
  build: "Bauphase",
  gallery: "Galerie & Voting",
  wrapped: "Wrapped",
  closed: "Archiv",
};

/** Dauer der vollen Enthuellung ab starts_at. */
export const REVEAL_MS = 10_000;

export type Screen =
  | { kind: "lobby" }
  /** Volle Enthuellung; `elapsedMs` seit starts_at, 0 bis REVEAL_MS. */
  | { kind: "reveal"; elapsedMs: number }
  | { kind: "build" }
  | { kind: "after"; phase: Exclude<EventPhase, "lobby" | "build"> };

/** Welcher Bildschirm gerade dran ist, allein aus Event und Serverzeit. */
export function pickScreen(event: Times | null, nowMs: number): Screen {
  if (!event) return { kind: "lobby" };
  const phase = derivePhase(event, nowMs);
  if (phase === "lobby") return { kind: "lobby" };
  if (phase === "build") {
    const elapsedMs = event.starts_at ? nowMs - Date.parse(event.starts_at) : Infinity;
    return elapsedMs >= 0 && elapsedMs < REVEAL_MS ? { kind: "reveal", elapsedMs } : { kind: "build" };
  }
  return { kind: "after", phase };
}
