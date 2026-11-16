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
