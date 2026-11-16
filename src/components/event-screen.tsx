"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { pickScreen, PHASE_LABEL } from "@/lib/phase";
import { useServerNow, useServerOffset } from "@/lib/server-clock";
import { useSession } from "@/lib/session";
import { useStages } from "@/lib/use-stages";
import { BuildView } from "./build/build-view";
import { GalleryView } from "./gallery/gallery-view";
import { Lobby } from "./lobby/lobby";
import { Reveal } from "./reveal/reveal";
import { AppHeader } from "./stage/app-header";
import { REVEAL_MS } from "@/lib/phase";

const SHORT_REVEAL_MS = 2_400;

/** Waehlt anhand von Event und Serverzeit den Bildschirm. Ein Reload landet immer richtig. */
export function EventScreen() {
  const { participant, event } = useSession();
  const nowMs = useServerNow(250);
  const offset = useServerOffset();
  const screen = pickScreen(event, nowMs);
  // twist_at auf die Browseruhr umgerechnet, auf Sekunden gerundet (sonst startet das Laden
  // bei jeder kleinen Nachjustierung des Versatzes neu).
  const twistAtLocalMs = event?.twist_at
    ? Math.round((Date.parse(event.twist_at) - offset) / 1000) * 1000
    : null;
  const stages = useStages(screen.kind !== "lobby", twistAtLocalMs);

  // Wer die volle Enthuellung (oder die Kurzfassung) in diesem Tab gesehen hat, bekommt
  // in der Bauphase keine weitere.
  const [introSeen, setIntroSeen] = useState(false);
  const markSeen = useCallback(() => setIntroSeen(true), []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- einmaliges Merken, kein Kreislauf
    if (screen.kind === "reveal") setIntroSeen(true);
  }, [screen.kind]);

  const startsAtMs = event?.starts_at ? Date.parse(event.starts_at) : 0;
  const fullElapsed = useCallback(() => Date.now() + offset - startsAtMs, [offset, startsAtMs]);
  // Die Kurzfassung startet beim ersten Frame, in dem sie gezeigt wird.
  const shortStart = useRef<number | null>(null);
  const shortElapsed = useCallback(() => {
    shortStart.current ??= performance.now();
    return performance.now() - shortStart.current;
  }, []);

  if (!participant) return null;

  if (screen.kind === "lobby") return <Lobby event={event} nowMs={nowMs} />;

  if (screen.kind === "reveal") {
    return <Reveal durationMs={REVEAL_MS} getElapsed={fullElapsed} stages={stages} />;
  }

  if (screen.kind === "build" && event) {
    if (!introSeen) {
      return (
        <Reveal
          durationMs={SHORT_REVEAL_MS}
          getElapsed={shortElapsed}
          stages={stages}
          onDone={markSeen}
        />
      );
    }
    return <BuildView event={event} stages={stages} nowMs={nowMs} />;
  }

  const phase = screen.kind === "after" ? screen.phase : "lobby";
  if (phase === "gallery" || phase === "closed") return <GalleryView phase={phase} />;

  // Wrapped folgt in Phase 7.
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 pb-12 sm:px-8">
      <AppHeader phase={phase} />
      <main className="flex flex-1 flex-col justify-center gap-5">
        <p className="label text-neon">{PHASE_LABEL[phase]}</p>
        <h1 className="display text-[clamp(3.5rem,13vw,10rem)]">Siegerehrung.</h1>
        <p className="max-w-xl text-xl text-muted">Das Wrapped kommt in einer späteren Ausbaustufe.</p>
      </main>
    </div>
  );
}
