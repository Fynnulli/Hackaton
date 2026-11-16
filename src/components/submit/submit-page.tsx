"use client";

import Link from "next/link";
import { isBuildOpen, pickScreen } from "@/lib/phase";
import { useServerNow, useServerOffset } from "@/lib/server-clock";
import { useSession } from "@/lib/session";
import { useStages } from "@/lib/use-stages";
import { useMySubmission } from "@/lib/use-submission";
import { BuildTimer } from "../build/build-timer";
import { Home } from "../home";
import { AppHeader } from "../stage/app-header";
import { Notice, Splash } from "../ui";
import { SubmissionForm } from "./submission-form";
import { SubmissionSummary } from "./submission-summary";

export function SubmitPage() {
  const { status } = useSession();
  // Zeitabhaengiges erst nach dem Laden der Sitzung rendern (nie im Prerender).
  if (status !== "joined") return <Home />;
  return <SubmitScreen />;
}

function SubmitScreen() {
  const { event, team } = useSession();
  const nowMs = useServerNow(250);
  const offset = useServerOffset();
  const screen = pickScreen(event, nowMs);
  const twistAtLocalMs = event?.twist_at
    ? Math.round((Date.parse(event.twist_at) - offset) / 1000) * 1000
    : null;
  const stages = useStages(screen.kind !== "lobby", twistAtLocalMs);
  const { submission, setSubmission } = useMySubmission(team?.id ?? null);

  if (!event || screen.kind === "lobby") {
    return (
      <Notice title="Noch nicht" action={<BackLink />}>
        Die Abgabe öffnet mit dem Start der Bauphase.
      </Notice>
    );
  }
  if (!team) {
    return (
      <Notice title="Ohne Team" action={<BackLink />}>
        Zum Abgeben brauchst du ein Team. Gründe eins oder tritt einem bei.
      </Notice>
    );
  }
  if (submission === undefined) return <Splash />;

  const open = isBuildOpen(event, nowMs);

  return (
    <>
      <div className="sticky top-0 z-40 border-b border-line/60 bg-ink/85 backdrop-blur-md">
        <div className="mx-auto w-full max-w-3xl px-5 sm:px-8">
          <AppHeader
            phase={screen.kind === "after" ? screen.phase : "build"}
            right={
              event.starts_at && event.build_ends_at ? (
                <BuildTimer
                  startsAt={event.starts_at}
                  endsAt={event.build_ends_at}
                  nowMs={nowMs}
                />
              ) : null
            }
          />
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-5 pt-8 pb-16 sm:px-8 lg:pt-12">
        <div className="flex flex-col gap-4">
          <BackLink />
          <p className="label text-neon">Abgabe · {team.name}</p>
          <h1 className="display text-[clamp(3rem,12vw,6.5rem)]">
            {open ? (submission ? "Bearbeiten." : "Abgeben.") : "Abgabe zu."}
          </h1>
          <p className="max-w-xl text-lg text-muted">
            {open
              ? "Eine Abgabe pro Team. Bis zum Ende der Bauzeit könnt ihr sie beliebig oft ändern, auch von verschiedenen Geräten."
              : submission
                ? "Die Bauzeit ist vorbei. Das hier ist eure Abgabe."
                : "Die Bauzeit ist vorbei, euer Team hat nichts abgegeben. Wende dich an die Event-Leitung, falls etwas schiefging."}
          </p>
        </div>

        {open ? (
          <SubmissionForm
            teamId={team.id}
            submission={submission}
            stages={stages}
            onSaved={setSubmission}
          />
        ) : submission ? (
          <SubmissionSummary submission={submission} />
        ) : null}
      </main>
    </>
  );
}

function BackLink() {
  return (
    <Link
      href="/"
      className="focus-ring label self-start text-muted underline-offset-4 hover:text-paper hover:underline"
    >
      ← Zurück
    </Link>
  );
}
