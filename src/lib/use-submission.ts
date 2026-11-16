"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "./supabase";
import type { Submission } from "./types";

const POLL_MS = 15_000;
export const SUBMISSION_COLS =
  "id, team_id, title, url, description, screenshot_path, stage1, stage2, stage3, hidden, submitted_at, updated_at";

/**
 * Die Abgabe des eigenen Teams (RLS gibt vor der Galerie nur diese heraus).
 * `undefined` = laedt noch, `null` = noch keine Abgabe.
 */
export function useMySubmission(teamId: string | null) {
  const [submission, setSubmission] = useState<Submission | null | undefined>(undefined);
  const requestNo = useRef(0);

  const reload = useCallback(async () => {
    if (!teamId) return;
    const no = ++requestNo.current;
    try {
      const { data, error } = await getSupabase()
        .from("submission")
        .select(SUBMISSION_COLS)
        .eq("team_id", teamId)
        .maybeSingle();
      if (error || no !== requestNo.current) return;
      setSubmission((data as Submission | null) ?? null);
    } catch {
      // Netzfehler: der naechste Durchlauf holt es nach.
    }
  }, [teamId]);

  useEffect(() => {
    if (!teamId) return;
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
  }, [teamId, reload]);

  return { submission: teamId ? submission : null, reload, setSubmission };
}

export function screenshotUrl(path: string): string {
  return getSupabase().storage.from("screenshots").getPublicUrl(path).data.publicUrl;
}
