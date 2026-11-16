"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRealtimeReload } from "./realtime";
import { getSupabase } from "./supabase";
import type { Announcement } from "./types";

const LIMIT = 30;
const POLL_MS = 15_000;
const TABLES = ["announcement"] as const;

/** Die neuesten Durchsagen, live per Realtime, mit Polling als Rueckfall. */
export function useAnnouncements(enabled: boolean): Announcement[] {
  const [items, setItems] = useState<Announcement[]>([]);
  const requestNo = useRef(0);

  const load = useCallback(async () => {
    const no = ++requestNo.current;
    try {
      const { data, error } = await getSupabase()
        .from("announcement")
        .select("id, body, kind, created_at")
        .order("created_at", { ascending: false })
        .limit(LIMIT);
      if (error || no !== requestNo.current) return;
      const next = (data ?? []) as Announcement[];
      setItems((prev) =>
        prev.length === next.length && prev.every((a, i) => a.id === next[i].id) ? prev : next,
      );
    } catch {
      // Netzfehler: der naechste Durchlauf holt es nach.
    }
  }, []);

  const onChange = useCallback(() => void load(), [load]);
  useRealtimeReload("ticker", TABLES, onChange, enabled);

  useEffect(() => {
    if (!enabled) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() setzt State erst nach dem await
    void load();
    const tick = () => {
      if (document.visibilityState === "visible") void load();
    };
    const timer = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("online", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("online", tick);
    };
  }, [enabled, load]);

  return enabled ? items : EMPTY;
}

const EMPTY: Announcement[] = [];
