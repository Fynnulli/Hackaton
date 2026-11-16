"use client";

import { motion } from "framer-motion";
import type { EventRow, Stage } from "@/lib/types";
import { AppHeader } from "../stage/app-header";
import { StageCard } from "../reveal/reveal";
import { TeamPanel } from "../team-panel";
import { isBuildOpen } from "@/lib/phase";

const TIME = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Bauphase in der Grundform: Thema, Stufe 1 und 2, verdeckter Twist, Restzeit.
 * Timerfarben, Ticker und Twist-Enthuellung folgen in Phase 3.
 */
export function TopicView({
  event,
  stages,
  nowMs,
}: {
  event: EventRow;
  stages: Stage[];
  nowMs: number;
}) {
  const topic = stages.find((s) => s.stage_no === 1);
  const visible = stages.filter((s) => s.stage_no <= 2);
  const twist = stages.find((s) => s.stage_no === 3);
  const open = isBuildOpen(event, nowMs);
  const remaining = event.build_ends_at ? Date.parse(event.build_ends_at) - nowMs : null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 pb-12 sm:px-8">
      <AppHeader
        phase="build"
        right={
          remaining !== null ? (
            <span className="font-mono text-sm font-semibold tabular-nums text-neon sm:text-base">
              {open ? formatRemaining(remaining) : "Zeit um"}
            </span>
          ) : null
        }
      />

      <main className="flex flex-1 flex-col gap-10 pt-6 lg:pt-12">
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col gap-5"
        >
          <p className="label text-neon">Das Thema</p>
          <h1 className="display neon-glow text-[clamp(2.75rem,10vw,8rem)] text-neon [overflow-wrap:anywhere] [text-wrap:balance]">
            {topic?.title ?? "Thema wird geladen…"}
          </h1>
        </motion.section>

        <section className="grid gap-4 md:grid-cols-3" aria-label="Stufen">
          {visible.map((s) => (
            <StageCard key={s.stage_no} stage={s} hideTitle={s.stage_no === 1} />
          ))}
          {twist ? (
            <StageCard stage={twist} className="border-neon/50" />
          ) : (
            <article className="flex flex-col justify-between gap-6 rounded-2xl border border-dashed border-line p-5 sm:p-7">
              <div>
                <p className="label">Stufe 3 · Twist</p>
                <div className="mt-4 flex flex-col gap-2 blur-[3px]" aria-hidden>
                  <span className="h-6 w-4/5 rounded bg-muted/25" />
                  <span className="h-4 w-full rounded bg-muted/15" />
                  <span className="h-4 w-2/3 rounded bg-muted/15" />
                </div>
              </div>
              <p className="text-muted">
                {event.twist_at
                  ? `Wird um ${TIME.format(new Date(event.twist_at))} Uhr enthüllt.`
                  : "Wird während der Bauphase enthüllt."}
              </p>
            </article>
          )}
        </section>

        <div className="grid items-start gap-5 lg:grid-cols-2">
          <TeamPanel canGetTeam={open} canLeaveTeam={false} />
        </div>
      </main>
    </div>
  );
}
