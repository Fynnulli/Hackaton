import type { EventRow, Submission } from "./types";

/** Eine Zeile aus get_leaderboard(). */
export interface RankRow {
  place: number;
  submission_id: string;
  team_id: string;
  team_name: string;
  title: string;
  stage1: boolean;
  stage2: boolean;
  stage3: boolean;
  vote_count: number;
  points: number;
  submitted_at: string;
}

/** Reihenfolge der Folien; der Index entspricht event.wrapped_slide. */
export const SLIDES = [
  { id: "intro", label: "Intro" },
  { id: "numbers", label: "Zahlen" },
  { id: "fastest", label: "Schnellste Abgabe" },
  { id: "lastSecond", label: "Letzte Sekunde" },
  { id: "stages", label: "Stufen" },
  { id: "place3", label: "Platz 3" },
  { id: "place2", label: "Platz 2" },
  { id: "place1", label: "Platz 1" },
  { id: "personal", label: "Persönliche Karte" },
] as const;

export type SlideId = (typeof SLIDES)[number]["id"];

/** Folie zum gespeicherten Index; alles jenseits des Endes bleibt auf der letzten. */
export function slideAt(index: number): SlideId {
  return SLIDES[Math.min(Math.max(0, index), SLIDES.length - 1)].id;
}

export interface Moment {
  teamName: string;
  title: string;
  /** Millisekunden nach dem Start bzw. vor dem Ende. */
  ms: number;
}

export interface WrappedStats {
  participants: number;
  teams: number;
  submissions: number;
  fastest: Moment | null;
  lastSecond: Moment | null;
  stageCounts: [number, number, number];
  podium: (RankRow | null)[]; // [Platz 1, Platz 2, Platz 3]
}

export function computeWrapped(input: {
  event: Pick<EventRow, "starts_at" | "build_ends_at">;
  submissions: Submission[];
  ranking: RankRow[];
  participants: number;
  teams: number;
  teamName: (teamId: string) => string;
}): WrappedStats {
  const visible = input.submissions.filter((s) => !s.hidden);
  const start = input.event.starts_at ? Date.parse(input.event.starts_at) : null;
  const end = input.event.build_ends_at ? Date.parse(input.event.build_ends_at) : null;

  let fastest: Moment | null = null;
  if (start !== null) {
    for (const s of visible) {
      const ms = Date.parse(s.submitted_at) - start;
      if (ms >= 0 && (!fastest || ms < fastest.ms)) {
        fastest = { teamName: input.teamName(s.team_id), title: s.title, ms };
      }
    }
  }

  // Letzte Sekunde: die letzte Speicherung, die noch vor dem Ende lag (Nachtraege danach zaehlen nicht).
  let lastSecond: Moment | null = null;
  if (end !== null) {
    for (const s of visible) {
      const ms = end - Date.parse(s.updated_at);
      if (ms >= 0 && (!lastSecond || ms < lastSecond.ms)) {
        lastSecond = { teamName: input.teamName(s.team_id), title: s.title, ms };
      }
    }
  }

  const stageCounts: [number, number, number] = [
    visible.filter((s) => s.stage1).length,
    visible.filter((s) => s.stage2).length,
    visible.filter((s) => s.stage3).length,
  ];

  const byPlace = new Map(input.ranking.map((r) => [r.place, r]));
  return {
    participants: input.participants,
    teams: input.teams,
    submissions: visible.length,
    fastest,
    lastSecond,
    stageCounts,
    podium: [byPlace.get(1) ?? null, byPlace.get(2) ?? null, byPlace.get(3) ?? null],
  };
}

/** "1 Std 12 Min", "14 Min 5 Sek", "8 Sek". */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return m > 0 ? `${h} Std ${m} Min` : `${h} Std`;
  if (m > 0) return s > 0 ? `${m} Min ${s} Sek` : `${m} Min`;
  return `${s} Sek`;
}
