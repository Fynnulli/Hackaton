"use client";

import { motion } from "framer-motion";
import type { EventRow } from "@/lib/types";
import { ReentryCard } from "../reentry-card";
import { AppHeader } from "../stage/app-header";
import { TeamPanel } from "../team-panel";
import { Countdown } from "./countdown";
import { Crowd, TeamsOverview } from "./crowd";

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: [0.2, 0.8, 0.2, 1] as const },
});

export function Lobby({ event, nowMs }: { event: EventRow | null; nowMs: number }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 pb-12 sm:px-8">
      <AppHeader phase="lobby" />

      <main className="flex flex-1 flex-col gap-10 pt-6 lg:gap-14 lg:pt-12">
        <motion.section {...rise(0)} aria-label="Countdown">
          <Countdown startsAt={event?.starts_at ?? null} nowMs={nowMs} />
        </motion.section>

        <motion.div {...rise(0.1)} className="grid items-start gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <Crowd />
          <TeamsOverview />
        </motion.div>

        <motion.div {...rise(0.2)} className="grid items-start gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <TeamPanel canGetTeam canLeaveTeam />
          <ReentryCard />
        </motion.div>
      </main>
    </div>
  );
}
