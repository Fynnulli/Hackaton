"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "./supabase";
import type { Stage } from "./types";

const RETRY_MS = 500;
const REFRESH_MS = 15_000;

/**
 * Laedt die freigegebenen Stufen. Die Datenbank gibt sie erst ab reveal_at heraus; ist die
 * Antwort leer (Uhr minimal zu frueh), wird alle 500 ms nachgefragt, bis Stufe 1 da ist.
 * Danach seltener, damit spaeter freigegebene Stufen (Twist) nachkommen.
 */
export function useStages(enabled: boolean): Stage[] {
  const [stages, setStages] = useState<Stage[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer = 0;
    let haveTopic = false;

    const run = async () => {
      try {
        const { data, error } = await getSupabase()
          .from("challenge_stage")
          .select("stage_no, title, body")
          .order("stage_no");
        if (cancelled) return;
        if (!error && data) {
          const next = data as Stage[];
          haveTopic = next.some((s) => s.stage_no === 1);
          setStages((prev) => (sameStages(prev, next) ? prev : next));
        }
      } catch {
        // Netzfehler: einfach erneut versuchen.
      }
      if (!cancelled) timer = window.setTimeout(run, haveTopic ? REFRESH_MS : RETRY_MS);
    };

    void run();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled]);

  return enabled ? stages : EMPTY;
}

const EMPTY: Stage[] = [];

function sameStages(a: Stage[], b: Stage[]) {
  return (
    a.length === b.length &&
    a.every((s, i) => s.stage_no === b[i].stage_no && s.title === b[i].title && s.body === b[i].body)
  );
}
