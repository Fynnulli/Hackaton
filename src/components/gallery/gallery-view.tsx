"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { toMessage } from "@/lib/errors";
import { useSession } from "@/lib/session";
import { stableShuffle } from "@/lib/shuffle";
import type { EventPhase } from "@/lib/types";
import { MAX_VOTES, useGallery } from "@/lib/use-gallery";
import { AppHeader } from "../stage/app-header";
import { Button, Notice, Splash } from "../ui";
import { GalleryCard } from "./gallery-card";

/** Galerie mit Abstimmung (Phase "gallery") bzw. Archivansicht ohne Abstimmung. */
export function GalleryView({ phase }: { phase: EventPhase }) {
  const { participant, team, teams } = useSession();
  const { submissions, myVotes, error, vote, unvote, reload } = useGallery(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);

  const votingOpen = phase === "gallery";
  const canVoteAtAll = votingOpen && team !== null;
  const left = Math.max(0, MAX_VOTES - myVotes.size);

  const teamName = useMemo(() => new Map(teams.map((t) => [t.id, t.name])), [teams]);
  const ordered = useMemo(() => {
    if (!submissions || !participant) return [];
    const visible = submissions.filter((s) => !s.hidden || s.team_id === team?.id);
    return stableShuffle(visible, participant.id, (s) => s.id);
  }, [submissions, participant, team?.id]);

  if (!participant) return null;
  if (submissions === null) {
    if (error) {
      return (
        <Notice title="Keine Verbindung" action={<Button onClick={() => void reload()}>Nochmal versuchen</Button>}>
          {toMessage(error)}
        </Notice>
      );
    }
    return <Splash />;
  }

  async function toggle(id: string, voted: boolean) {
    setBusyId(id);
    setVoteError(null);
    try {
      if (voted) await unvote(id);
      else await vote(id);
    } catch (err) {
      setVoteError(toMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="sticky top-0 z-40 border-b border-line/60 bg-ink/85 backdrop-blur-md">
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
          <AppHeader phase={phase} right={canVoteAtAll ? <VoteMeter left={left} compact /> : null} />
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-5 pt-8 pb-16 sm:px-8 lg:pt-12">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
          className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"
        >
          <div className="flex flex-col gap-4">
            <p className="label text-neon">
              {ordered.length} {ordered.length === 1 ? "Abgabe" : "Abgaben"}
            </p>
            <h1 className="display text-[clamp(3.5rem,14vw,9rem)]">
              {votingOpen ? (
                <>
                  Galerie<span className="text-neon">.</span>
                </>
              ) : (
                <>
                  Archiv<span className="text-neon">.</span>
                </>
              )}
            </h1>
            <p className="max-w-xl text-lg text-muted">
              {!votingOpen
                ? "Alle Projekte des Abends."
                : team
                  ? "Du hast drei Stimmen, höchstens eine pro Projekt, keine fürs eigene Team. Bis zur Siegerehrung sieht niemand die Stände. Du kannst Stimmen zurücknehmen und neu vergeben."
                  : "Abstimmen können nur Teilnehmende mit Team. Schauen geht natürlich trotzdem."}
            </p>
          </div>
          {canVoteAtAll ? <VoteMeter left={left} /> : null}
        </motion.section>

        <AnimatePresence>
          {voteError ? (
            <motion.p
              key="err"
              role="alert"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="sticky top-20 z-30 rounded-xl border border-danger/40 bg-ink/95 px-4 py-3 text-danger backdrop-blur"
            >
              {voteError}
            </motion.p>
          ) : null}
        </AnimatePresence>

        {ordered.length === 0 ? (
          <p className="text-xl text-muted">Es wurde nichts abgegeben.</p>
        ) : (
          <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Abgaben">
            {ordered.map((s, i) => {
              const voted = myVotes.has(s.id);
              return (
                <GalleryCard
                  key={s.id}
                  index={i}
                  submission={s}
                  teamName={teamName.get(s.team_id) ?? "Team"}
                  own={s.team_id === team?.id}
                  voted={voted}
                  canVote={left > 0}
                  votingOpen={canVoteAtAll}
                  busy={busyId === s.id}
                  onToggle={() => void toggle(s.id, voted)}
                />
              );
            })}
          </section>
        )}
      </main>
    </>
  );
}

function VoteMeter({ left, compact = false }: { left: number; compact?: boolean }) {
  const dots = Array.from({ length: MAX_VOTES }, (_, i) => i < left);
  if (compact) {
    return (
      <span className="flex items-center gap-1.5" aria-label={`${left} Stimmen übrig`}>
        {dots.map((on, i) => (
          <span key={i} className={`text-lg leading-none ${on ? "text-neon" : "text-muted/40"}`} aria-hidden>
            {on ? "★" : "☆"}
          </span>
        ))}
      </span>
    );
  }
  return (
    <div className="flex flex-col gap-3 lg:items-end" aria-live="polite">
      <div className="flex gap-2" aria-hidden>
        {dots.map((on, i) => (
          <motion.span
            key={`${i}-${on}`}
            initial={{ scale: 0.5, opacity: 0.4 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 20 }}
            className={`display text-6xl ${on ? "neon-glow text-neon" : "text-muted/30"}`}
          >
            {on ? "★" : "☆"}
          </motion.span>
        ))}
      </div>
      <p className="label">
        {left === 0 ? "Alle Stimmen vergeben" : `${left} ${left === 1 ? "Stimme" : "Stimmen"} übrig`}
      </p>
    </div>
  );
}
