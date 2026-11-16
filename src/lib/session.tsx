"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRealtimeReload } from "./realtime";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import type { EventRow, Participant, Team, TeamPublic } from "./types";

const POLL_MS = 15_000;
const PARTICIPANT_COLS = "id, display_name, avatar, team_id, is_admin, joined_at";
const EVENT_COLS = "id, join_code, phase, starts_at, build_ends_at, twist_at, wrapped_slide";

interface Snapshot {
  participant: Participant;
  event: EventRow | null;
  team: Team | null;
  teammates: Participant[];
  /** Alle Teilnehmer (Lobby: "X sind schon da"). */
  roster: Participant[];
  /** Alle Teams ohne Code. */
  teams: TeamPublic[];
}

export type SessionStatus = "loading" | "unconfigured" | "guest" | "joined" | "error";

interface SessionValue {
  status: SessionStatus;
  /** Gesetzt, wenn schon der erste Ladeversuch scheitert. */
  loadError: unknown;
  participant: Participant | null;
  event: EventRow | null;
  team: Team | null;
  teammates: Participant[];
  roster: Participant[];
  teams: TeamPublic[];
  /** Realtime-Verbindung steht (sonst laeuft nur das Polling). */
  live: boolean;
  refresh: () => Promise<void>;
  join: (joinCode: string, displayName: string, avatar: string) => Promise<void>;
  claimReentryToken: (token: string) => Promise<void>;
  getReentryToken: () => Promise<string>;
  createTeam: (name: string) => Promise<void>;
  joinTeam: (teamCode: string) => Promise<void>;
  leaveTeam: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

/** Laedt den kompletten Zustand frisch. `null` heisst: (noch) nicht beigetreten. */
async function fetchSnapshot(): Promise<Snapshot | null> {
  const sb = getSupabase();
  const {
    data: { session },
  } = await sb.auth.getSession();
  if (!session) return null;

  const [p, e, r, ts] = await Promise.all([
    sb.from("participant").select(PARTICIPANT_COLS).eq("id", session.user.id).maybeSingle(),
    sb.from("event").select(EVENT_COLS).maybeSingle(),
    sb.from("participant").select(PARTICIPANT_COLS).order("joined_at"),
    sb.from("team").select("id, name, created_at").order("created_at"),
  ]);
  if (p.error) throw p.error;
  if (e.error) throw e.error;
  if (r.error) throw r.error;
  if (ts.error) throw ts.error;
  if (!p.data) return null;

  const participant = p.data as Participant;
  const roster = (r.data ?? []) as Participant[];
  const teams = (ts.data ?? []) as TeamPublic[];
  let team: Team | null = null;
  let teammates: Participant[] = [];

  if (participant.team_id) {
    const t = await sb.rpc("get_my_team");
    if (t.error) throw t.error;
    const row = (Array.isArray(t.data) ? t.data[0] : t.data) as Team | null;
    team = row?.id ? row : null;
    teammates = roster.filter((m) => m.team_id === participant.team_id);
  }

  return {
    participant,
    event: (e.data as EventRow | null) ?? null,
    team,
    teammates,
    roster,
    teams,
  };
}

async function ensureAuthSession(forceNew = false) {
  const sb = getSupabase();
  if (forceNew) await sb.auth.signOut({ scope: "local" });
  const {
    data: { session },
  } = await sb.auth.getSession();
  if (session) return;
  const { error } = await sb.auth.signInAnonymously();
  if (error) throw error;
}

// 23503: Die gespeicherte Sitzung gehoert zu einem Auth-Nutzer, den es nicht mehr gibt.
const isStaleAuthUser = (error: { code?: string } | null) => error?.code === "23503";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>(
    isSupabaseConfigured ? "loading" : "unconfigured",
  );
  const [loadError, setLoadError] = useState<unknown>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  const requestNo = useRef(0);
  const settled = useRef(false);

  const load = useCallback(async (silent: boolean) => {
    const no = ++requestNo.current;
    try {
      const next = await fetchSnapshot();
      if (no !== requestNo.current) return;
      settled.current = true;
      setSnapshot(next);
      setLoadError(null);
      setStatus(next ? "joined" : "guest");
    } catch (error) {
      if (no !== requestNo.current) return;
      // Hintergrund-Aktualisierungen duerfen einen funktionierenden Zustand nie kippen.
      if (silent && settled.current) return;
      setLoadError(error);
      setStatus("error");
    }
  }, []);

  const refresh = useCallback(() => load(false), [load]);
  const silentLoad = useCallback(() => void load(true), [load]);
  const live = useRealtimeReload("event-state", SESSION_TABLES, silentLoad, status === "joined");

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() setzt State erst nach dem await
    void load(false);

    const tick = () => {
      if (document.visibilityState === "visible") void load(true);
    };
    const interval = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("online", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("online", tick);
    };
  }, [load]);

  const join = useCallback(
    async (joinCode: string, displayName: string, avatar: string) => {
      const args = { p_join_code: joinCode, p_display_name: displayName, p_avatar: avatar };
      await ensureAuthSession();
      let { error } = await getSupabase().rpc("join_event", args);
      if (isStaleAuthUser(error)) {
        await ensureAuthSession(true);
        ({ error } = await getSupabase().rpc("join_event", args));
      }
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  const claimReentryToken = useCallback(
    async (token: string) => {
      await ensureAuthSession();
      let { error } = await getSupabase().rpc("claim_reentry_token", { p_token: token });
      if (isStaleAuthUser(error)) {
        await ensureAuthSession(true);
        ({ error } = await getSupabase().rpc("claim_reentry_token", { p_token: token }));
      }
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  const getReentryToken = useCallback(async () => {
    const { data, error } = await getSupabase().rpc("get_reentry_token");
    if (error) throw error;
    if (typeof data !== "string") throw new Error("not_joined");
    return data;
  }, []);

  const teamAction = useCallback(
    async (fn: string, args?: Record<string, string>) => {
      const { error } = await getSupabase().rpc(fn, args);
      // Auch im Fehlerfall neu laden: Der Zustand kann sich auf einem anderen Geraet geaendert haben.
      await refresh();
      if (error) throw error;
    },
    [refresh],
  );

  const createTeam = useCallback(
    (name: string) => teamAction("create_team", { p_name: name }),
    [teamAction],
  );
  const joinTeam = useCallback(
    (teamCode: string) => teamAction("join_team", { p_team_code: teamCode }),
    [teamAction],
  );
  const leaveTeam = useCallback(() => teamAction("leave_team"), [teamAction]);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      loadError,
      participant: snapshot?.participant ?? null,
      event: snapshot?.event ?? null,
      team: snapshot?.team ?? null,
      teammates: snapshot?.teammates ?? [],
      roster: snapshot?.roster ?? EMPTY,
      teams: snapshot?.teams ?? EMPTY_TEAMS,
      live,
      refresh,
      join,
      claimReentryToken,
      getReentryToken,
      createTeam,
      joinTeam,
      leaveTeam,
    }),
    [
      status,
      loadError,
      snapshot,
      live,
      refresh,
      join,
      claimReentryToken,
      getReentryToken,
      createTeam,
      joinTeam,
      leaveTeam,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

const SESSION_TABLES = ["event", "participant"] as const;
const EMPTY: Participant[] = [];
const EMPTY_TEAMS: TeamPublic[] = [];

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession braucht einen SessionProvider");
  return value;
}
