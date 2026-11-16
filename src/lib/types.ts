export type EventPhase = "lobby" | "build" | "gallery" | "wrapped" | "closed";

export interface EventRow {
  id: string;
  join_code: string;
  phase: EventPhase;
  starts_at: string | null;
  build_ends_at: string | null;
  twist_at: string | null;
  wrapped_slide: number;
}

export interface Participant {
  id: string;
  display_name: string;
  avatar: string;
  team_id: string | null;
  is_admin: boolean;
  joined_at: string;
}

/** Oeffentliche Sicht auf ein Team (ohne Code). */
export interface TeamPublic {
  id: string;
  name: string;
  created_at: string;
}

/** Das eigene Team, wie es get_my_team() liefert. */
export interface Team extends TeamPublic {
  team_code: string;
}

export const MAX_TEAM_SIZE = 3;

export interface Stage {
  stage_no: number;
  title: string;
  body: string;
}
