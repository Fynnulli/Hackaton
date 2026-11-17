"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toMessage } from "@/lib/errors";
import { useSession } from "@/lib/session";
import { getSupabase } from "@/lib/supabase";
import type { EventRow } from "@/lib/types";
import { useWrappedData } from "@/lib/use-wrapped-data";
import { computeWrapped, slideAt, SLIDES } from "@/lib/wrapped";
import { Splash, Wordmark } from "../ui";
import { Slide } from "./slides";

/**
 * Wrapped im Vollbild. Die Folie bestimmt allein event.wrapped_slide (per Realtime), alle
 * Geraete zeigen also dieselbe. Admins schalten hier per Pfeiltasten/Knopf oder auf /admin.
 */
export function WrappedView({ event }: { event: EventRow }) {
  const { participant, team, teammates, roster, teams, refresh } = useSession();
  const { submissions, ranking } = useWrappedData(true);
  const index = Math.min(Math.max(0, event.wrapped_slide), SLIDES.length - 1);
  const slide = slideAt(index);

  const teamName = useMemo(() => new Map(teams.map((t) => [t.id, t.name])), [teams]);
  const stats = useMemo(
    () =>
      computeWrapped({
        event,
        submissions: submissions ?? [],
        ranking,
        participants: roster.length,
        teams: teams.length,
        teamName: (id) => teamName.get(id) ?? "Team",
      }),
    [event, submissions, ranking, roster.length, teams.length, teamName],
  );

  if (!participant) return null;
  if (submissions === null) return <Splash />;

  const mySubmission = team ? (submissions.find((s) => s.team_id === team.id) ?? null) : null;
  const personal = {
    participant,
    team,
    teammates,
    submission: mySubmission,
    rank: team ? (ranking.find((r) => r.team_id === team.id) ?? null) : null,
    rankedCount: ranking.length,
  };

  return (
    <main className="relative flex min-h-dvh flex-1 flex-col overflow-hidden">
      <div className="flex h-16 items-center justify-between px-5 sm:px-8">
        <Wordmark />
        <p className="label">Wrapped</p>
      </div>

      <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide}
            exit={{ opacity: 0, y: -30, filter: "blur(10px)" }}
            transition={{ duration: 0.45 }}
            className="mx-auto flex w-full max-w-6xl justify-center"
          >
            <Slide id={slide} stats={stats} personal={personal} />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex flex-col items-center gap-4 px-5 pb-6">
        <div className="flex gap-1.5" aria-label={`Folie ${index + 1} von ${SLIDES.length}`}>
          {SLIDES.map((s, i) => (
            <span
              key={s.id}
              className={`h-1 rounded-full transition-all duration-500 ${
                i === index ? "w-8 bg-neon" : i < index ? "w-3 bg-paper/60" : "w-3 bg-line"
              }`}
            />
          ))}
        </div>
        {participant.is_admin ? <PresenterControls index={index} refresh={refresh} /> : null}
      </div>
    </main>
  );
}

/** Nur fuer Admins: weiterschalten direkt im Wrapped (auch per Pfeiltasten). */
function PresenterControls({ index, refresh }: { index: number; refresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = useCallback(
    async (next: number) => {
      if (busy || next < 0 || next > SLIDES.length - 1) return;
      setBusy(true);
      setError(null);
      try {
        const { error: rpcError } = await getSupabase().rpc("admin_set_wrapped_slide", { p_slide: next });
        if (rpcError) throw rpcError;
        await refresh();
      } catch (err) {
        setError(toMessage(err));
      } finally {
        setBusy(false);
      }
    },
    [busy, refresh],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        void go(index + 1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        void go(index - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index]);

  const next = SLIDES[index + 1];
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void go(index - 1)}
          disabled={busy || index === 0}
          className="focus-ring label rounded-full border border-line px-4 py-2 text-paper enabled:hover:border-neon disabled:opacity-40"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => void go(index + 1)}
          disabled={busy || !next}
          className="focus-ring label rounded-full border border-neon/60 px-4 py-2 text-neon enabled:hover:bg-neon/10 disabled:opacity-40"
        >
          {next ? `Weiter: ${next.label} →` : "Ende"}
        </button>
      </div>
      <p className="label normal-case tracking-normal">
        {error ?? "Admin: Pfeiltasten oder Leertaste schalten für alle weiter"}
      </p>
    </div>
  );
}
