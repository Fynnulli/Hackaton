"use client";

import Link from "next/link";
import { useCallback } from "react";
import { derivePhase } from "@/lib/phase";
import { useServerNow } from "@/lib/server-clock";
import { useSession } from "@/lib/session";
import { useAdminData } from "@/lib/use-admin-data";
import { Home } from "../home";
import { AppHeader } from "../stage/app-header";
import { Notice } from "../ui";
import {
  ExtendSection,
  PhaseSection,
  ScheduleSection,
  StatusSection,
  TestModeSection,
} from "./control-sections";
import {
  AnnouncementSection,
  BackfillSection,
  SubmissionsSection,
  WrappedSection,
} from "./content-sections";

export function AdminPage() {
  const { status, participant } = useSession();
  if (status !== "joined") return <Home />;
  if (!participant?.is_admin) {
    return (
      <Notice title="Nur für die Leitung" action={<BackLink />}>
        Diese Seite ist der Event-Leitung vorbehalten.
      </Notice>
    );
  }
  return <AdminScreen />;
}

function AdminScreen() {
  const { event, roster, teams, refresh } = useSession();
  const nowMs = useServerNow(1000);
  const { submissions, leaderboard, reload } = useAdminData();
  const refreshAll = useCallback(() => Promise.all([refresh(), reload()]), [refresh, reload]);

  if (!event) {
    return (
      <Notice title="Kein Event" action={<BackLink />}>
        Lege das Event im SQL-Editor an (siehe README).
      </Notice>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 pb-16 sm:px-8">
      <AppHeader phase={derivePhase(event, nowMs)} right={<BackLink />} />
      <main className="flex flex-col gap-5 pt-6">
        <h1 className="display text-[clamp(3rem,10vw,6rem)]">
          Leitstand<span className="text-neon">.</span>
        </h1>

        <StatusSection
          event={event}
          nowMs={nowMs}
          counts={{ participants: roster.length, teams: teams.length, submissions: submissions.length }}
        />
        <PhaseSection event={event} nowMs={nowMs} refresh={refreshAll} />

        <div className="grid items-start gap-5 lg:grid-cols-2">
          <ScheduleSection event={event} nowMs={nowMs} refresh={refreshAll} />
          <div className="flex flex-col gap-5">
            <ExtendSection event={event} refresh={refreshAll} />
            <AnnouncementSection />
          </div>
        </div>

        <SubmissionsSection
          submissions={submissions}
          leaderboard={leaderboard}
          teams={teams}
          refresh={refreshAll}
        />

        <div className="grid items-start gap-5 lg:grid-cols-2">
          <BackfillSection teams={teams} submissions={submissions} refresh={refreshAll} />
          <div className="flex flex-col gap-5">
            <WrappedSection event={event} refresh={refreshAll} />
            <TestModeSection refresh={refreshAll} />
          </div>
        </div>
      </main>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/" className="focus-ring label text-muted underline-offset-4 hover:text-paper hover:underline">
      ← App
    </Link>
  );
}
