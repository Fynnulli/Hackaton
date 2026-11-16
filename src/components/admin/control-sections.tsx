"use client";

import { useState, type FormEvent } from "react";
import { derivePhase, isBuildOpen, PHASE_LABEL } from "@/lib/phase";
import { formatRemaining } from "@/lib/timer";
import type { EventPhase, EventRow } from "@/lib/types";
import { Button } from "../ui";
import {
  ConfirmButton,
  DATE_TIME,
  FeedbackLine,
  Section,
  TIME,
  toLocalInput,
  useAdminAction,
} from "./admin-kit";

const PHASES: { phase: EventPhase; hint: string }[] = [
  { phase: "lobby", hint: "Warten, Countdown" },
  { phase: "build", hint: "Sofort starten" },
  { phase: "gallery", hint: "Abgabe zu, Voting" },
  { phase: "wrapped", hint: "Siegerehrung" },
  { phase: "closed", hint: "Archiv" },
];

export function StatusSection({
  event,
  nowMs,
  counts,
}: {
  event: EventRow;
  nowMs: number;
  counts: { participants: number; teams: number; submissions: number };
}) {
  const phase = derivePhase(event, nowMs);
  const rows: [string, string][] = [
    ["Serverzeit", TIME.format(new Date(nowMs))],
    ["Start", event.starts_at ? DATE_TIME.format(new Date(event.starts_at)) : "–"],
    ["Twist", event.twist_at ? DATE_TIME.format(new Date(event.twist_at)) : "–"],
    ["Ende Bauzeit", event.build_ends_at ? DATE_TIME.format(new Date(event.build_ends_at)) : "–"],
    ["Beitrittscode", event.join_code],
  ];
  let countdown: string | null = null;
  if (phase === "lobby" && event.starts_at) countdown = `Start in ${formatRemaining(Date.parse(event.starts_at) - nowMs)}`;
  if (phase === "build" && event.build_ends_at)
    countdown = isBuildOpen(event, nowMs)
      ? `Noch ${formatRemaining(Date.parse(event.build_ends_at) - nowMs)}`
      : "Bauzeit abgelaufen";

  return (
    <Section title="Stand" hint={countdown}>
      <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
        <div>
          <p className="label">Phase</p>
          <p className="display mt-2 text-5xl text-neon">{PHASE_LABEL[phase]}</p>
        </div>
        {(
          [
            ["Teilnehmer", counts.participants],
            ["Teams", counts.teams],
            ["Abgaben", counts.submissions],
          ] as const
        ).map(([label, n]) => (
          <div key={label}>
            <p className="label">{label}</p>
            <p className="display mt-2 text-5xl tabular-nums">{n}</p>
          </div>
        ))}
      </div>
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 border-b border-line/60 py-1.5">
            <dt className="label">{k}</dt>
            <dd className="font-mono text-sm tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      {event.phase !== phase ? (
        <p className="text-sm text-muted">
          Gespeichert ist noch „{PHASE_LABEL[event.phase]}“; die Bauphase läuft automatisch ab der
          Startzeit.
        </p>
      ) : null}
    </Section>
  );
}

export function PhaseSection({
  event,
  nowMs,
  refresh,
}: {
  event: EventRow;
  nowMs: number;
  refresh: () => unknown;
}) {
  const { busy, feedback, run } = useAdminAction(refresh);
  const current = derivePhase(event, nowMs);

  return (
    <Section title="Phase" hint="Zweimal klicken zum Bestätigen">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {PHASES.map(({ phase, hint }) => (
          <ConfirmButton
            key={phase}
            active={current === phase}
            disabled={current === phase}
            busy={busy === phase}
            onConfirm={() =>
              void run(phase, "admin_set_phase", { p_phase: phase }, `Phase: ${PHASE_LABEL[phase]}`)
            }
            className="flex-col !gap-1 py-3"
          >
            <span>{PHASE_LABEL[phase]}</span>
            <span className="font-sans text-[0.65rem] font-normal tracking-normal normal-case opacity-70">
              {hint}
            </span>
          </ConfirmButton>
        ))}
      </div>
      <p className="text-sm text-muted">
        „Bauphase“ startet sofort, falls keine Startzeit gesetzt ist (180 Minuten, Twist nach 90).
        „Lobby“ setzt eine bereits erreichte Startzeit zurück.
      </p>
      <FeedbackLine feedback={feedback} />
    </Section>
  );
}

export function ScheduleSection({
  event,
  nowMs,
  refresh,
}: {
  event: EventRow;
  nowMs: number;
  refresh: () => unknown;
}) {
  const { busy, feedback, setFeedback, run } = useAdminAction(refresh);
  const [start, setStart] = useState(() =>
    toLocalInput(event.starts_at ? Date.parse(event.starts_at) : nowMs + 15 * 60_000),
  );
  const [buildMin, setBuildMin] = useState(() =>
    event.starts_at && event.build_ends_at
      ? String(Math.round((Date.parse(event.build_ends_at) - Date.parse(event.starts_at)) / 60_000))
      : "180",
  );
  const [twistMin, setTwistMin] = useState(() =>
    event.starts_at && event.twist_at
      ? String(Math.round((Date.parse(event.twist_at) - Date.parse(event.starts_at)) / 60_000))
      : "90",
  );

  async function schedule(startMs: number, build: number, twist: number, key: string) {
    await run(
      key,
      "admin_schedule",
      { p_starts_at: new Date(startMs).toISOString(), p_build_minutes: build, p_twist_minute: twist },
      `Start um ${TIME.format(new Date(startMs))}`,
    );
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const ms = new Date(start).getTime();
    if (!Number.isFinite(ms)) {
      setFeedback({ kind: "error", text: "Bitte eine gültige Startzeit eingeben." });
      return;
    }
    void schedule(ms, Number(buildMin), Number(twistMin), "form");
  }

  const field =
    "focus-ring h-12 w-full rounded-xl border border-line bg-raised px-3 font-mono text-paper focus:border-neon";

  return (
    <Section title="Zeitplan" hint="Zeiten in deiner Ortszeit">
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2" noValidate>
        <label className="flex flex-col gap-2 sm:col-span-2">
          <span className="label">Start</span>
          <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-2">
          <span className="label">Bauzeit (Min)</span>
          <input type="number" min={1} step="any" value={buildMin} onChange={(e) => setBuildMin(e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-2">
          <span className="label">Twist nach (Min)</span>
          <input type="number" min={1} step="any" value={twistMin} onChange={(e) => setTwistMin(e.target.value)} className={field} />
        </label>
        <Button type="submit" busy={busy === "form"} className="sm:col-span-2">
          Festlegen
        </Button>
      </form>

      <div className="flex flex-wrap gap-2">
        <span className="label self-center">Schnellstart in</span>
        {[1, 5, 10].map((m) => (
          <ConfirmButton
            key={m}
            busy={busy === `quick-${m}`}
            onConfirm={() =>
              void schedule(nowMs + m * 60_000, Number(buildMin) || 180, Number(twistMin) || 90, `quick-${m}`)
            }
          >
            {m} Min
          </ConfirmButton>
        ))}
      </div>
      <p className="text-sm text-muted">
        Der Zeitplan ändert die Phase nicht. Steht das Event in der Lobby, startet die Bauphase von
        selbst zur Startzeit.
      </p>
      <FeedbackLine feedback={feedback} />
    </Section>
  );
}

export function ExtendSection({ event, refresh }: { event: EventRow; refresh: () => unknown }) {
  const { busy, feedback, run } = useAdminAction(refresh);
  return (
    <Section
      title="Bauzeit verlängern"
      hint={event.build_ends_at ? `Ende ${TIME.format(new Date(event.build_ends_at))}` : "kein Zeitplan"}
    >
      <div className="flex flex-wrap gap-2">
        {[5, 10, 15].map((m) => (
          <ConfirmButton
            key={m}
            busy={busy === String(m)}
            disabled={!event.build_ends_at}
            onConfirm={() =>
              void run(String(m), "admin_extend_build", { p_minutes: m }, `Bauzeit um ${m} Minuten verlängert`)
            }
          >
            + {m} Min
          </ConfirmButton>
        ))}
      </div>
      <p className="text-sm text-muted">Öffnet die Abgabe auch wieder, wenn die Zeit schon abgelaufen war.</p>
      <FeedbackLine feedback={feedback} />
    </Section>
  );
}

export function TestModeSection({ refresh }: { refresh: () => unknown }) {
  const { busy, feedback, run } = useAdminAction(refresh);
  const [build, setBuild] = useState("6");

  async function start() {
    const minutes = Math.max(2, Number(build) || 6);
    const ok = await run("lobby", "admin_set_phase", { p_phase: "lobby" }, "Lobby");
    if (!ok) return;
    const startsAt = new Date(Date.now() + 30_000).toISOString();
    await run(
      "test",
      "admin_schedule",
      { p_starts_at: startsAt, p_build_minutes: minutes, p_twist_minute: minutes / 2 },
      `Testlauf: Start in 30 Sekunden, ${minutes} Minuten Bauzeit, Twist nach ${minutes / 2}`,
    );
  }

  return (
    <Section title="Testmodus" hint="kompletter Durchlauf, verkürzt">
      <p className="text-muted">
        Setzt das Event zurück in die Lobby und startet in 30 Sekunden mit kurzer Bauzeit, Twist zur
        Hälfte. Danach schaltest du Galerie und Wrapped wie am Abend von Hand. Teilnehmer, Teams,
        Abgaben und Stimmen bleiben erhalten.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-2">
          <span className="label">Bauzeit (Min)</span>
          <input
            type="number"
            min={2}
            value={build}
            onChange={(e) => setBuild(e.target.value)}
            className="focus-ring h-12 w-28 rounded-xl border border-line bg-raised px-3 font-mono text-paper focus:border-neon"
          />
        </label>
        <ConfirmButton busy={busy !== null} onConfirm={() => void start()} className="h-12">
          Testlauf starten
        </ConfirmButton>
      </div>
      <FeedbackLine feedback={feedback} />
    </Section>
  );
}
