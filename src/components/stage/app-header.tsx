"use client";

import { PHASE_LABEL } from "@/lib/phase";
import { useSession } from "@/lib/session";
import type { EventPhase } from "@/lib/types";
import { Wordmark } from "../ui";

export function AppHeader({ phase, right }: { phase: EventPhase; right?: React.ReactNode }) {
  const { participant, live } = useSession();
  if (!participant) return null;
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
        <span className="flex min-w-0 items-center gap-2 rounded-full border border-line bg-surface py-1.5 pr-4 pl-2">
          <span className="text-xl" aria-hidden>
            {participant.avatar}
          </span>
          <span className="truncate text-sm font-medium">{participant.display_name}</span>
        </span>
      </div>
    </header>
  );
}
