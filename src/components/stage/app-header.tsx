"use client";

import Link from "next/link";
import { PHASE_LABEL } from "@/lib/phase";
import { useSession } from "@/lib/session";
import type { EventPhase } from "@/lib/types";
import { Wordmark } from "../ui";

export function AppHeader({ phase, right }: { phase: EventPhase; right?: React.ReactNode }) {
  const { participant, live } = useSession();
  if (!participant) return null;
  const crowded = Boolean(right) || participant.is_admin;
  return (
    <header className="flex h-16 items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <Wordmark />
        <span
          className="flex items-center gap-2"
          title={live ? "Live verbunden" : "Verbindung wird aufgebaut, Daten kommen per Abfrage"}
        >
          <span
            className={`size-1.5 rounded-full ${live ? "bg-neon shadow-[0_0_10px_var(--color-neon)]" : "animate-pulse bg-muted"}`}
          />
          <span className="label hidden sm:inline">{PHASE_LABEL[phase]}</span>
        </span>
      </div>
      <div className="flex min-w-0 items-center gap-3">
        {right}
        {participant.is_admin ? (
          <Link
            href="/admin"
            className="focus-ring label rounded-full border border-line px-3 py-1.5 text-paper hover:border-neon hover:text-neon"
          >
            Admin
          </Link>
        ) : null}
        <span
          className={`flex min-w-0 items-center gap-2 rounded-full border border-line bg-surface py-1.5 pl-2 ${
            crowded ? "pr-2 sm:pr-4" : "pr-4"
          }`}
          title={participant.display_name}
        >
          <span className="text-xl" aria-hidden>
            {participant.avatar}
          </span>
          {/* Auf schmalen Bildschirmen mit voller Kopfzeile nur der Avatar. */}
          <span className={`truncate text-sm font-medium ${crowded ? "sr-only sm:not-sr-only" : ""}`}>
            {participant.display_name}
          </span>
        </span>
      </div>
    </header>
  );
}
