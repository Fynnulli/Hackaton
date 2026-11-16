"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "./supabase";
import type { Submission } from "./types";
import { SUBMISSION_COLS } from "./use-submission";

const POLL_MS = 15_000;
export const MAX_VOTES = 3;

export interface GalleryState {
  /** `null`, bis die erste Antwort da ist. */
  submissions: Submission[] | null;
  /** IDs der Abgaben, fuer die ich gestimmt habe. */
  myVotes: Set<string>;
  error: unknown;
  vote: (submissionId: string) => Promise<void>;
  unvote: (submissionId: string) => Promise<void>;
  reload: () => Promise<void>;
}

/**
 * Galerie-Daten: alle sichtbaren Abgaben (RLS gibt sie erst ab der Galerie heraus) und die
 * eigenen Stimmen. Stimmen werden sofort angezeigt und bei einem Fehler zurueckgenommen;
 * verbindlich zaehlt die Datenbank (Limit, eigenes Team, Phase).
 */
export function useGallery(enabled: boolean): GalleryState {
  const [submissions, setSubmissions] = useState<Submission[] | null>(null);
  const [myVotes, setMyVotes] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<unknown>(null);
  const requestNo = useRef(0);
  const pending = useRef(0);

  const reload = useCallback(async () => {
    const no = ++requestNo.current;
    try {
      const sb = getSupabase();
      const [s, v] = await Promise.all([
        sb.from("submission").select(SUBMISSION_COLS).order("submitted_at"),
        sb.from("vote").select("submission_id"),
      ]);
      if (no !== requestNo.current) return;
      if (s.error) throw s.error;
      if (v.error) throw v.error;
      setSubmissions((s.data ?? []) as Submission[]);
      // Waehrend eine Stimme unterwegs ist, nicht mit einem aelteren Stand ueberschreiben.
      if (pending.current === 0) {
        setMyVotes(new Set((v.data ?? []).map((r) => (r as { submission_id: string }).submission_id)));
      }
      setError(null);
    } catch (err) {
      if (no === requestNo.current) setError(err);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reload() setzt State erst nach dem await
    void reload();
    const tick = () => {
      if (document.visibilityState === "visible") void reload();
    };
    const timer = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("online", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("online", tick);
    };
  }, [enabled, reload]);

  const change = useCallback(
    async (submissionId: string, add: boolean) => {
      pending.current += 1;
      setMyVotes((prev) => {
        const next = new Set(prev);
        if (add) next.add(submissionId);
        else next.delete(submissionId);
        return next;
      });
      try {
        const { error: rpcError } = await getSupabase().rpc(add ? "cast_vote" : "remove_vote", {
          p_submission_id: submissionId,
        });
        if (rpcError) throw rpcError;
      } catch (err) {
        setMyVotes((prev) => {
          const next = new Set(prev);
          if (add) next.delete(submissionId);
          else next.add(submissionId);
          return next;
        });
        throw err;
      } finally {
        pending.current -= 1;
        if (pending.current === 0) void reload();
      }
    },
    [reload],
  );

  const vote = useCallback((id: string) => change(id, true), [change]);
  const unvote = useCallback((id: string) => change(id, false), [change]);

  return { submissions, myVotes, error, vote, unvote, reload };
}
