"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "./supabase";
import type { Submission } from "./types";
import { SUBMISSION_COLS } from "./use-submission";

const POLL_MS = 10_000;

export interface LeaderRow {
  place: number;
  submission_id: string;
  team_id: string;
  team_name: string;
  title: string;
  vote_count: number;
  points: number;
}

/** Alle Abgaben (Admins sehen per RLS auch ausgeblendete) und die Wertung vorab. */
export function useAdminData() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);
  const requestNo = useRef(0);

  const reload = useCallback(async () => {
    const no = ++requestNo.current;
    try {
      const sb = getSupabase();
      const [s, l] = await Promise.all([
        sb.from("submission").select(SUBMISSION_COLS).order("submitted_at"),
        sb.rpc("get_leaderboard"),
      ]);
      if (no !== requestNo.current) return;
      if (!s.error) setSubmissions((s.data ?? []) as Submission[]);
      if (!l.error) setLeaderboard((l.data ?? []) as LeaderRow[]);
    } catch {
      // naechster Durchlauf
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reload() setzt State erst nach dem await
    void reload();
    const tick = () => {
      if (document.visibilityState === "visible") void reload();
    };
    const timer = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [reload]);

  return { submissions, leaderboard, reload };
}
