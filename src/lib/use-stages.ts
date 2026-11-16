"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "./supabase";
import type { Stage } from "./types";

const RETRY_MS = 500;
const REFRESH_MS = 15_000;

/**
 * Laedt die freigegebenen Stufen. Die Datenbank gibt sie erst ab reveal_at heraus; ist die
 * Antwort leer (Uhr minimal zu frueh), wird alle 500 ms nachgefragt, bis Stufe 1 da ist.
 * Danach seltener; zum Twist-Zeitpunkt wird gezielt nachgeladen, damit Stufe 3 bei allen
 * gleichzeitig erscheint.
 *
 * @param twistAtLocalMs twist_at umgerechnet auf die Browseruhr (null = unbekannt)
 */
export function useStages(enabled: boolean, twistAtLocalMs: number | null = null): Stage[] {
  const [stages, setStages] = useState<Stage[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer = 0;
    let haveTopic = false;
    let haveTwist = false;

    const nextDelay = () => {
      if (!haveTopic) return RETRY_MS;
      if (haveTwist || twistAtLocalMs === null) return REFRESH_MS;
      const wait = twistAtLocalMs - Date.now();
      if (wait > 0) return Math.min(wait + 50, REFRESH_MS);
      // Twist faellig, aber noch nicht da: kurz eng nachfragen, danach wieder ruhig.
      return wait > -60_000 ? RETRY_MS : REFRESH_MS;
    };

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
          haveTwist = next.some((s) => s.stage_no === 3);
          setStages((prev) => (sameStages(prev, next) ? prev : next));
        }
      } catch {
        // Netzfehler: einfach erneut versuchen.
      }
      if (!cancelled) timer = window.setTimeout(run, nextDelay());
    };

    void run();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled, twistAtLocalMs]);

  return enabled ? stages : EMPTY;
}

const EMPTY: Stage[] = [];

function sameStages(a: Stage[], b: Stage[]) {
  return (
    a.length === b.length &&
    a.every((s, i) => s.stage_no === b[i].stage_no && s.title === b[i].title && s.body === b[i].body)
  );
}
