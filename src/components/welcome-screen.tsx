"use client";

import { motion } from "framer-motion";
import { derivePhase, isBuildOpen, PHASE_LABEL } from "@/lib/phase";
import { useSession } from "@/lib/session";
import type { EventRow } from "@/lib/types";
import { useNow } from "@/lib/use-now";
import { ReentryCard } from "./reentry-card";
import { TeamPanel } from "./team-panel";
import { Wordmark } from "./ui";

const START_FORMAT = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

function statusLine(event: EventRow | null, nowMs: number): string {
  if (!event) return "Das Event ist noch nicht eingerichtet.";
  const phase = derivePhase(event, nowMs);
  if (phase === "lobby") {
    return event.starts_at
      ? `Los geht's am ${START_FORMAT.format(new Date(event.starts_at))} Uhr.`
      : "Der Startzeitpunkt wird noch bekannt gegeben.";
  }
  if (phase === "build") {
    return isBuildOpen(event, nowMs)
      ? "Die Bauphase läuft."
      : "Die Bauzeit ist vorbei. Gleich geht es mit der Galerie weiter.";
  }
  if (phase === "gallery") return "Die Abgabe ist geschlossen, jetzt wird abgestimmt.";
  if (phase === "wrapped") return "Die Siegerehrung läuft.";
  return "Das Event ist beendet.";
}

export function WelcomeScreen() {
  const { participant, event, team } = useSession();
  const nowMs = useNow();
  if (!participant) return null;

  // Bis die Serverzeit angebunden ist (Lobby-Ausbau), genuegt hier die Browseruhr:
  // Verbindlich prueft ohnehin die Datenbank.
  const phase = event ? derivePhase(event, nowMs) : "lobby";
  const canLeaveTeam = phase === "lobby";
  const canGetTeam = phase === "lobby" || (event !== null && isBuildOpen(event, nowMs));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 pb-12 sm:px-8">
      <header className="flex h-16 items-center justify-between gap-4">
        <Wordmark />
        <div className="flex min-w-0 items-center gap-3">
          <span className="label hidden sm:inline">{PHASE_LABEL[phase]}</span>
          <span className="flex min-w-0 items-center gap-2 rounded-full border border-line bg-surface py-1.5 pr-4 pl-2">
            <span className="text-xl" aria-hidden>
              {participant.avatar}
            </span>
            <span className="truncate text-sm font-medium">{participant.display_name}</span>
          </span>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-10 pt-8 lg:gap-14 lg:pt-14">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <h1 className="display text-[clamp(3.5rem,15vw,11rem)]">
            Du bist <span className="neon-glow text-neon">drin.</span>
          </h1>
          <p className="mt-5 max-w-xl text-xl text-muted sm:text-2xl">
            {statusLine(event, nowMs)}
            {!team && canGetTeam ? " Bis dahin: such dir ein Team." : ""}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.12, ease: [0.2, 0.8, 0.2, 1] }}
          className="grid items-start gap-5 lg:grid-cols-[1.2fr_0.8fr]"
        >
          <TeamPanel canGetTeam={canGetTeam} canLeaveTeam={canLeaveTeam} />
          <ReentryCard />
        </motion.div>
      </main>
    </div>
  );
}
