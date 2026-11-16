"use client";

import { motion } from "framer-motion";
import type { Submission } from "@/lib/types";
import { screenshotUrl } from "@/lib/use-submission";

export function GalleryCard({
  submission,
  teamName,
  own,
  voted,
  canVote,
  votingOpen,
  busy,
  onToggle,
  index,
}: {
  submission: Submission;
  teamName: string;
  own: boolean;
  voted: boolean;
  /** Noch Stimmen frei (oder diese ist schon vergeben und kann zurueck). */
  canVote: boolean;
  votingOpen: boolean;
  busy: boolean;
  onToggle: () => void;
  index: number;
}) {
  const stages = [submission.stage1, submission.stage2, submission.stage3];

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: Math.min(index, 8) * 0.05, ease: [0.2, 0.8, 0.2, 1] }}
      className={`group flex flex-col overflow-hidden rounded-2xl border bg-surface/90 transition-colors ${
        voted ? "border-neon shadow-[0_0_50px_-24px_var(--color-neon)]" : "border-line"
      }`}
    >
      <a
        href={submission.url}
        target="_blank"
        rel="noopener noreferrer"
        className="focus-ring relative block aspect-video overflow-hidden bg-raised"
        aria-label={`${submission.title} öffnen`}
      >
        {submission.screenshot_path ? (
          // eslint-disable-next-line @next/next/no-img-element -- Bild aus Supabase Storage
          <img
            src={screenshotUrl(submission.screenshot_path)}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-[radial-gradient(ellipse_at_30%_20%,rgb(200_255_46/0.14),transparent_60%)]">
            <span className="display px-6 text-center text-5xl text-muted/40 [overflow-wrap:anywhere]">
              {submission.title}
            </span>
          </div>
        )}
        <span className="label absolute top-3 right-3 rounded-full bg-ink/80 px-3 py-1.5 text-paper opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
          Öffnen ↗
        </span>
      </a>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex flex-col gap-1">
          <p className="label truncate">{teamName}</p>
          <h3 className="text-2xl leading-tight font-bold tracking-tight [overflow-wrap:anywhere]">
            {submission.title}
          </h3>
        </div>
        {submission.description ? (
          <p className="text-muted [overflow-wrap:anywhere]">{submission.description}</p>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          {stages.map((done, i) => (
            <span
              key={i}
              className={`font-mono text-[0.65rem] tracking-[0.12em] uppercase rounded-full border px-2.5 py-1 ${
                done ? "border-neon/50 text-neon" : "border-line text-muted/60"
              }`}
            >
              S{i + 1} {done ? "✓" : "–"}
            </span>
          ))}
        </div>

        {own ? (
          <p className="label flex h-12 items-center justify-center rounded-xl border border-dashed border-line">
            Euer Projekt
          </p>
        ) : votingOpen ? (
          <button
            type="button"
            onClick={onToggle}
            disabled={busy || (!voted && !canVote)}
            aria-pressed={voted}
            className={`focus-ring flex h-12 items-center justify-center gap-2 rounded-xl border font-mono text-sm font-semibold tracking-[0.08em] uppercase transition-[background-color,border-color,color,transform] duration-150 enabled:active:scale-[0.97] disabled:cursor-not-allowed ${
              voted
                ? "border-neon bg-neon text-ink"
                : canVote
                  ? "border-line bg-raised text-paper enabled:hover:border-neon enabled:hover:text-neon"
                  : "border-line bg-transparent text-muted/50"
            }`}
          >
            <motion.span
              key={voted ? "on" : "off"}
              initial={{ scale: 0.4, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 18 }}
              aria-hidden
            >
              {voted ? "★" : "☆"}
            </motion.span>
            {voted ? "Deine Stimme" : canVote ? "Stimme geben" : "Keine Stimme frei"}
          </button>
        ) : null}
      </div>
    </motion.article>
  );
}
