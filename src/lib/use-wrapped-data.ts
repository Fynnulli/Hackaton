"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "./supabase";
import type { Submission } from "./types";
import { SUBMISSION_COLS } from "./use-submission";
import type { RankRow } from "./wrapped";

const POLL_MS = 30_000;

/**
 * Abgaben und Wertung fuer das Wrapped. get_leaderboard() liefert erst ab der Phase
 * "wrapped" etwas (fuer Admins vorab); Stimmen aendern sich dann nicht mehr, ein
 * seltenes Nachladen genuegt (z. B. falls der Admin noch eine Abgabe ausblendet).
 */
export function useWrappedData(enabled: boolean) {
  const [submissions, setSubmissions] = useState<Submission[] | null>(null);
  const [ranking, setRanking] = useState<RankRow[]>([]);
  const requestNo = useRef(0);

  const reload = useCallback(async () => {
    const no = ++requestNo.current;
    try {
      const sb = getSupabase();
      const [s, l] = await Promise.all([
        sb.from("submission").select(SUBMISSION_COLS),
        sb.rpc("get_leaderboard"),
      ]);
      if (no !== requestNo.current) return;
      if (!s.error) setSubmissions((s.data ?? []) as Submission[]);
      if (!l.error) setRanking((l.data ?? []) as RankRow[]);
    } catch {
      // naechster Durchlauf
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reload() setzt State erst nach dem await
    void reload();
    const timer = window.setInterval(() => void reload(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [enabled, reload]);

  return { submissions, ranking, reload };
}
