"use client";

import Link from "next/link";
import { useState } from "react";
import { isBuildOpen } from "@/lib/phase";
import { useSession } from "@/lib/session";
import type { EventRow, Stage, Submission } from "@/lib/types";
import { useAnnouncements } from "@/lib/use-announcements";
import { useMySubmission } from "@/lib/use-submission";
import { AppHeader } from "../stage/app-header";
import { TeamPanel } from "../team-panel";
import { BuildTimer } from "./build-timer";
import { TaskCard, TwistBanner } from "./task-card";
import { Ticker } from "./ticker";

const TWIST_BANNER_MS = 4_500;

export function BuildView({
  event,
  stages,
  nowMs,
}: {
  event: EventRow;
  stages: Stage[];
  nowMs: number;
}) {
  const { team, live } = useSession();
  const announcements = useAnnouncements(true);
  const { submission } = useMySubmission(team?.id ?? null);
  const open = isBuildOpen(event, nowMs);

  // War der Twist beim Oeffnen schon da, gibt es keinen Auftritt mehr (Reload, Nachzuegler).
  const hasTwist = stages.some((s) => s.stage_no === 3);
  const [twistAtMount] = useState(hasTwist);
  const twistJustRevealed = hasTwist && !twistAtMount;
  const twistAtMs = event.twist_at ? Date.parse(event.twist_at) : null;
  const showBanner =
    twistJustRevealed && twistAtMs !== null && nowMs < twistAtMs + TWIST_BANNER_MS;

  const timer =
    event.starts_at && event.build_ends_at ? (
      <BuildTimer startsAt={event.starts_at} endsAt={event.build_ends_at} nowMs={nowMs} />
    ) : null;

  return (
    <>
      <div className="sticky top-0 z-40 border-b border-line/60 bg-ink/85 backdrop-blur-md">
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
          <AppHeader phase="build" right={timer} />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 pb-12 sm:px-8">
        <main className="grid flex-1 items-start gap-8 pt-8 lg:grid-cols-[1.6fr_1fr] lg:gap-10 lg:pt-12">
          <div className="flex min-w-0 flex-col gap-8">
            <TaskCard
              stages={stages}
              twistAt={event.twist_at}
              twistJustRevealed={twistJustRevealed}
            />
          </div>

          <aside className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-24">
            <SubmitCta open={open} hasTeam={team !== null} submission={submission ?? null} />
            <Ticker items={announcements} live={live} />
            {!team || open ? <TeamPanel canGetTeam={open} canLeaveTeam={false} /> : null}
          </aside>
        </main>
      </div>

      <TwistBanner show={showBanner} />
    </>
  );
}

const TIME = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });

function SubmitCta({
  open,
  hasTeam,
  submission,
}: {
  open: boolean;
  hasTeam: boolean;
  submission: Submission | null;
}) {
  const base =
    "focus-ring flex h-16 w-full items-center justify-center gap-3 rounded-2xl font-mono text-base font-semibold tracking-[0.08em] uppercase transition-[background-color,transform] duration-150";

  if (!open) {
    return (
      <div className="flex flex-col gap-2">
        <div className={`${base} border border-line bg-raised text-muted`} aria-disabled>
          Abgabe geschlossen
        </div>
        {hasTeam ? (
          <Link href="/abgabe" className="label text-center underline-offset-4 hover:underline">
            {submission ? "Eure Abgabe ansehen" : "Keine Abgabe von eurem Team"}
          </Link>
        ) : null}
      </div>
    );
  }
  if (!hasTeam) {
    return (
      <div className="flex flex-col gap-2">
        <div className={`${base} border border-line bg-raised text-muted`} aria-disabled>
          Abgeben
        </div>
        <p className="text-sm text-muted">Zum Abgeben brauchst du ein Team.</p>
      </div>
    );
  }
  if (submission) {
    return (
      <Link
        href="/abgabe"
        className="focus-ring flex flex-col gap-1 rounded-2xl border border-neon/60 bg-neon/10 px-5 py-4 transition-colors hover:bg-neon/15"
      >
        <span className="flex items-center justify-between gap-3">
          <span className="font-mono text-base font-semibold tracking-[0.08em] text-neon uppercase">
            ✓ Abgegeben
          </span>
          <span className="label text-paper">Bearbeiten →</span>
        </span>
        <span className="truncate text-sm text-muted">
          {submission.title} · {TIME.format(new Date(submission.updated_at))} Uhr
        </span>
      </Link>
    );
  }
  return (
    <Link
      href="/abgabe"
      className={`${base} bg-neon text-ink hover:bg-[#d8ff66] active:scale-[0.98]`}
    >
      Abgeben <span aria-hidden>→</span>
    </Link>
  );
}
