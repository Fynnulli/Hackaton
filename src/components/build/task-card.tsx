"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Stage } from "@/lib/types";
import { StageCard } from "../reveal/reveal";

const TIME = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });

/** Aufgabenkarte: Thema, Stufe 1 und 2, Twist verdeckt bis twist_at, dann live enthuellt. */
export function TaskCard({
  stages,
  twistAt,
  twistJustRevealed,
  preview = false,
}: {
  stages: Stage[];
  twistAt: string | null;
  /** Der Twist kam gerade live dazu (nicht beim Laden schon da): mit Auftritt zeigen. */
  twistJustRevealed: boolean;
  /** Admin-Vorschau: ohne Material-Abruf. */
  preview?: boolean;
}) {
  const topic = stages.find((s) => s.stage_no === 1);
  const visible = stages.filter((s) => s.stage_no <= 2);
  const twist = stages.find((s) => s.stage_no === 3);

  return (
    <section className="flex flex-col gap-6" aria-label="Aufgabe">
      <div className="flex flex-col gap-4">
        <p className="label text-neon">Das Thema</p>
        <h1 className="display neon-glow text-[clamp(2.75rem,9vw,7rem)] text-neon [overflow-wrap:anywhere] [text-wrap:balance]">
          {topic?.title ?? "Thema wird geladen…"}
        </h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {visible.map((s) => (
          <StageCard
            key={s.stage_no}
            stage={s}
            hideTitle={s.stage_no === 1}
            materials={!preview}
          />
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {twist ? (
          <motion.div
            key="twist"
            initial={
              twistJustRevealed
                ? { opacity: 0, scale: 0.92, rotateX: -70, filter: "blur(12px)" }
                : false
            }
            animate={{ opacity: 1, scale: 1, rotateX: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
            style={{ transformPerspective: 900 }}
          >
            <StageCard
              stage={twist}
              materials={!preview}
              className={`border-neon/60 shadow-[0_0_60px_-20px_var(--color-neon)] ${twistJustRevealed ? "twist-flash" : ""}`}
            />
          </motion.div>
        ) : (
          <motion.article
            key="locked"
            exit={{ opacity: 0, scale: 1.03, filter: "blur(8px)" }}
            transition={{ duration: 0.4 }}
            className="flex flex-col gap-5 rounded-2xl border border-dashed border-line p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <p className="label">Stufe 3 · Twist</p>
              <div className="flex flex-col gap-2 blur-[3px]" aria-hidden>
                <span className="h-6 w-3/5 rounded bg-muted/25" />
                <span className="h-4 w-4/5 rounded bg-muted/15" />
              </div>
            </div>
            <p className="text-muted sm:max-w-[16rem] sm:text-right">
              {twistAt
                ? `Wird um ${TIME.format(new Date(twistAt))} Uhr enthüllt.`
                : "Wird während der Bauphase enthüllt."}
            </p>
          </motion.article>
        )}
      </AnimatePresence>
    </section>
  );
}

/** Kurzer Vollbild-Auftritt, wenn der Twist live freigegeben wird. */
export function TwistBanner({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          key="twist-banner"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.6 } }}
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-ink/70 backdrop-blur-sm"
          role="status"
        >
          <motion.div
            initial={{ scale: 2.4, opacity: 0, letterSpacing: "0.5em" }}
            animate={{ scale: 1, opacity: 1, letterSpacing: "-0.015em" }}
            transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
            className="flex flex-col items-center gap-4 text-center"
          >
            <span className="label text-neon">Stufe 3 ist da</span>
            <span className="display neon-glow text-[clamp(6rem,26vw,18rem)] text-neon">Twist!</span>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
