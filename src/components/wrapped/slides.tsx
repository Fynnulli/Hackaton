"use client";

import { motion } from "framer-motion";
import type { Participant, Submission, Team } from "@/lib/types";
import { formatDuration, type RankRow, type SlideId, type WrappedStats } from "@/lib/wrapped";
import { Confetti, CountUp, ease, Kicker, Rise } from "./parts";

export interface PersonalData {
  participant: Participant;
  team: Team | null;
  teammates: Participant[];
  submission: Submission | null;
  rank: RankRow | null;
  rankedCount: number;
}

export function Slide({ id, stats, personal }: { id: SlideId; stats: WrappedStats; personal: PersonalData }) {
  switch (id) {
    case "intro":
      return <Intro />;
    case "numbers":
      return <Numbers stats={stats} />;
    case "fastest":
      return (
        <MomentSlide
          kicker="Schnellste Abgabe"
          moment={stats.fastest}
          line={(ms) => `nach ${formatDuration(ms)}`}
          empty="Niemand hat abgegeben."
        />
      );
    case "lastSecond":
      return (
        <MomentSlide
          kicker="In letzter Sekunde"
          moment={stats.lastSecond}
          line={(ms) => `${formatDuration(ms)} vor Schluss gespeichert`}
          empty="Keine Abgabe kurz vor Schluss."
        />
      );
    case "stages":
      return <Stages stats={stats} />;
    case "place3":
      return <Place place={3} row={stats.podium[2]} />;
    case "place2":
      return <Place place={2} row={stats.podium[1]} />;
    case "place1":
      return <Place place={1} row={stats.podium[0]} />;
    case "personal":
      return <Personal data={personal} />;
  }
}

function Intro() {
  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <Kicker>3 Stunden. 1 Thema. Ein Abend.</Kicker>
      <motion.h1
        initial={{ opacity: 0, scale: 1.4, letterSpacing: "0.3em" }}
        animate={{ opacity: 1, scale: 1, letterSpacing: "-0.015em" }}
        transition={{ duration: 1.1, ease }}
        className="display neon-glow text-[clamp(5rem,22vw,16rem)] text-neon"
      >
        Wrapped.
      </motion.h1>
      <Rise delay={0.8}>
        <p className="max-w-xl text-2xl text-muted">Der Abend in Zahlen, und dann die Siegerehrung.</p>
      </Rise>
    </div>
  );
}

function Numbers({ stats }: { stats: WrappedStats }) {
  const items = [
    { n: stats.participants, label: stats.participants === 1 ? "Person" : "Personen" },
    { n: stats.teams, label: stats.teams === 1 ? "Team" : "Teams" },
    { n: stats.submissions, label: stats.submissions === 1 ? "Abgabe" : "Abgaben" },
  ];
  return (
    <div className="flex w-full flex-col gap-10">
      <Kicker>Heute Abend</Kicker>
      <div className="grid gap-8 sm:grid-cols-3">
        {items.map((it, i) => (
          <Rise key={it.label} delay={0.15 + i * 0.35}>
            <p className="display text-[clamp(6rem,20vw,13rem)] text-neon">
              <CountUp value={it.n} delay={0.15 + i * 0.35} />
            </p>
            <p className="display text-4xl sm:text-5xl">{it.label}</p>
          </Rise>
        ))}
      </div>
    </div>
  );
}

function MomentSlide({
  kicker,
  moment,
  line,
  empty,
}: {
  kicker: string;
  moment: WrappedStats["fastest"];
  line: (ms: number) => string;
  empty: string;
}) {
  return (
    <div className="flex w-full flex-col gap-8">
      <Kicker>{kicker}</Kicker>
      {moment ? (
        <>
          <Rise delay={0.2}>
            <h2 className="display text-[clamp(3.5rem,13vw,10rem)] [overflow-wrap:anywhere]">{moment.teamName}</h2>
          </Rise>
          <Rise delay={0.7}>
            <p className="display neon-glow text-[clamp(2.5rem,8vw,6rem)] text-neon">{line(moment.ms)}</p>
          </Rise>
          <Rise delay={1.1}>
            <p className="text-2xl text-muted">„{moment.title}“</p>
          </Rise>
        </>
      ) : (
        <Rise delay={0.2}>
          <p className="display text-6xl text-muted">{empty}</p>
        </Rise>
      )}
    </div>
  );
}

function Stages({ stats }: { stats: WrappedStats }) {
  const max = Math.max(1, stats.submissions);
  const labels = ["Stufe 1", "Stufe 2", "Twist"];
  return (
    <div className="flex w-full flex-col gap-10">
      <Kicker>So weit seid ihr gekommen</Kicker>
      <div className="flex flex-col gap-6">
        {stats.stageCounts.map((n, i) => (
          <div key={labels[i]} className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-4">
              <span className="display text-4xl sm:text-5xl">{labels[i]}</span>
              <span className="display text-4xl text-neon sm:text-5xl">
                <CountUp value={n} delay={0.3 + i * 0.4} />
                <span className="text-muted"> / {stats.submissions}</span>
              </span>
            </div>
            <div className="h-5 overflow-hidden rounded-full bg-line sm:h-7">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(n / max) * 100}%` }}
                transition={{ duration: 1.2, delay: 0.3 + i * 0.4, ease }}
                className={`h-full rounded-full ${i === 2 ? "bg-neon shadow-[0_0_30px_var(--color-neon)]" : "bg-paper"}`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Place({ place, row }: { place: 1 | 2 | 3; row: RankRow | null }) {
  const first = place === 1;
  return (
    <div className="relative flex w-full flex-col items-center gap-6 text-center">
      {first && row ? <Confetti /> : null}
      <motion.p
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease }}
        className={`display ${first ? "neon-glow text-neon" : "text-muted"} text-[clamp(3rem,10vw,7rem)]`}
      >
        Platz {place}
      </motion.p>
      {row ? (
        <>
          <motion.h2
            initial={{ opacity: 0, y: 40, scale: 0.9, filter: "blur(14px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 1, delay: first ? 1.4 : 0.9, ease }}
            className={`display text-[clamp(4rem,15vw,12rem)] [overflow-wrap:anywhere] ${first ? "text-paper" : ""}`}
          >
            {row.team_name}
          </motion.h2>
          <Rise delay={first ? 2.1 : 1.5}>
            <p className="text-2xl text-muted">„{row.title}“</p>
          </Rise>
          <Rise delay={first ? 2.5 : 1.9} className="flex flex-wrap justify-center gap-3">
            <Pill strong>
              <CountUp value={row.points} delay={first ? 2.5 : 1.9} /> Punkte
            </Pill>
            <Pill>
              {row.vote_count} {row.vote_count === 1 ? "Stimme" : "Stimmen"}
            </Pill>
            <Pill>{[row.stage1, row.stage2, row.stage3].filter(Boolean).length} / 3 Stufen</Pill>
          </Rise>
        </>
      ) : (
        <Rise delay={0.6}>
          <p className="display text-5xl text-muted">Nicht vergeben.</p>
        </Rise>
      )}
    </div>
  );
}

function Pill({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <span
      className={`rounded-full border px-5 py-2 font-mono text-sm font-semibold tracking-[0.08em] uppercase sm:text-base ${
        strong ? "border-neon bg-neon/10 text-neon" : "border-line text-paper"
      }`}
    >
      {children}
    </span>
  );
}

function Personal({ data }: { data: PersonalData }) {
  const { participant, team, teammates, submission, rank, rankedCount } = data;
  const stages = submission ? [submission.stage1, submission.stage2, submission.stage3] : null;

  return (
    <div className="flex w-full justify-center">
      <motion.article
        initial={{ opacity: 0, rotateY: -35, y: 30 }}
        animate={{ opacity: 1, rotateY: 0, y: 0 }}
        transition={{ duration: 1, ease }}
        style={{ transformPerspective: 1200 }}
        className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-neon/50 bg-surface p-7 shadow-[0_0_120px_-40px_var(--color-neon)] sm:p-10"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-neon/15 blur-3xl"
        />
        <p className="label text-neon">Deine Karte</p>
        <div className="mt-5 flex items-center gap-4">
          <span className="grid size-16 place-items-center rounded-2xl bg-ink text-4xl">{participant.avatar}</span>
          <div className="min-w-0">
            <p className="display truncate text-4xl">{participant.display_name}</p>
            <p className="truncate text-muted">{team ? team.name : "ohne Team"}</p>
          </div>
        </div>

        {team && teammates.length > 1 ? (
          <p className="mt-4 text-muted">
            mit {teammates.filter((m) => m.id !== participant.id).map((m) => `${m.avatar} ${m.display_name}`).join(", ")}
          </p>
        ) : null}

        <div className="mt-8 grid grid-cols-2 gap-4">
          <Stat label="Platz" value={rank ? `${rank.place}` : "–"} sub={rank ? `von ${rankedCount}` : undefined} big />
          <Stat label="Punkte" value={rank ? `${rank.points}` : "–"} big />
          <Stat
            label="Erhaltene Stimmen"
            value={rank ? `${rank.vote_count}` : "–"}
          />
          <Stat
            label="Stufen"
            value={stages ? stages.map((d, i) => (d ? `S${i + 1}` : "··")).join(" ") : "–"}
          />
        </div>

        <p className="mt-8 text-lg">
          {!team
            ? "Danke, dass du dabei warst."
            : !submission
              ? "Euer Team hat diesmal nichts abgegeben. Nächstes Mal!"
              : rank?.place === 1
                ? "Ihr habt gewonnen. Glückwunsch!"
                : rank && rank.place <= 3
                  ? "Auf dem Podium. Stark!"
                  : `„${submission.title}“ – danke fürs Bauen.`}
        </p>
        <p className="label mt-6">3h/Build</p>
      </motion.article>
    </div>
  );
}

function Stat({ label, value, sub, big = false }: { label: string; value: string; sub?: string; big?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-raised p-4">
      <p className="label">{label}</p>
      <p className={`display mt-2 ${big ? "text-6xl text-neon" : "text-3xl"}`}>
        {value}
        {sub ? <span className="ml-2 font-sans text-base font-normal tracking-normal normal-case text-muted">{sub}</span> : null}
      </p>
    </div>
  );
}
