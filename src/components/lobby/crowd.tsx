"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useSession } from "@/lib/session";
import { MAX_TEAM_SIZE } from "@/lib/types";
import { Card } from "../ui";
import { RollingNumber } from "../stage/rolling-number";

/** "X sind schon da" plus Avatar-Wolke, live aus dem Teilnehmerstand. */
export function Crowd() {
  const { roster, participant } = useSession();
  const count = roster.length;

  return (
    <Card className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <h2 className="display text-4xl sm:text-5xl">
          <RollingNumber value={count} className="text-neon" />{" "}
          <span>{count === 1 ? "ist schon da" : "sind schon da"}</span>
        </h2>
      </div>

      <ul className="flex flex-wrap gap-2" aria-label="Anwesende">
        <AnimatePresence initial={false}>
          {roster.map((p) => (
            <motion.li
              key={p.id}
              layout
              initial={{ scale: 0, opacity: 0, rotate: -20 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 22 }}
              title={p.display_name}
              className={`group flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 ${
                p.id === participant?.id
                  ? "border-neon/60 bg-neon/10"
                  : "border-line bg-raised"
              }`}
            >
              <span className="grid size-8 place-items-center rounded-full bg-ink text-lg" aria-hidden>
                {p.avatar}
              </span>
              <span className="max-w-[9rem] truncate text-sm">{p.display_name}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </Card>
  );
}

/** Alle Teams mit Mitgliedern und Belegung. */
export function TeamsOverview() {
  const { teams, roster, team: myTeam } = useSession();

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-4">
        <p className="label">Teams</p>
        <p className="label">{teams.length}</p>
      </div>

      {teams.length === 0 ? (
        <p className="text-muted">Noch kein Team. Gründe das erste.</p>
      ) : (
        <ul className="grid gap-2">
          <AnimatePresence initial={false}>
            {teams.map((t) => {
              const members = roster.filter((p) => p.team_id === t.id);
              const mine = t.id === myTeam?.id;
              return (
                <motion.li
                  key={t.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                    mine ? "border-neon/60 bg-neon/5" : "border-line bg-raised"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate text-lg font-semibold">{t.name}</span>
                  <span className="flex -space-x-1.5" aria-hidden>
                    {members.map((m) => (
                      <span
                        key={m.id}
                        title={m.display_name}
                        className="grid size-7 place-items-center rounded-full border border-ink bg-surface text-sm"
                      >
                        {m.avatar}
                      </span>
                    ))}
                  </span>
                  <span
                    className={`font-mono text-xs ${members.length >= MAX_TEAM_SIZE ? "text-muted" : "text-neon"}`}
                  >
                    {members.length}/{MAX_TEAM_SIZE}
                  </span>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </Card>
  );
}
