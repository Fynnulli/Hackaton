"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Digit } from "../stage/rolling-number";

const START_FORMAT = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

/** Grosser Countdown bis starts_at. Die letzten zehn Sekunden zaehlen bildschirmfuellend. */
export function Countdown({ startsAt, nowMs }: { startsAt: string | null; nowMs: number }) {
  if (!startsAt) {
    return (
      <div className="flex flex-col gap-5">
        <p className="label">Start</p>
        <h1 className="display text-[clamp(3.5rem,14vw,10rem)]">
          Startzeit <span className="text-muted">folgt.</span>
        </h1>
        <p className="max-w-xl text-xl text-muted">
          Sobald die Event-Leitung den Start festlegt, läuft hier der Countdown. Bis dahin: such
          dir ein Team.
        </p>
      </div>
    );
  }

  const startMs = Date.parse(startsAt);
  // Aufrunden: Bei 4,2 s Rest steht "5", die 0 faellt genau mit dem Start zusammen.
  const total = Math.max(0, Math.ceil((startMs - nowMs) / 1000));
  const final = total <= 10;

  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const groups = [String(h).padStart(2, "0"), String(m).padStart(2, "0"), String(s).padStart(2, "0")];
  const units = ["Std", "Min", "Sek"];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p className="label">{final ? "Gleich geht's los" : "Start in"}</p>
        <p className="label normal-case tracking-normal">
          {START_FORMAT.format(new Date(startMs))} Uhr
        </p>
      </div>

      <div className="relative" role="timer" aria-live="off" aria-label={`Noch ${total} Sekunden`}>
        <AnimatePresence mode="wait" initial={false}>
          {final ? (
            <motion.div
              key="final"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
              className="flex justify-center"
            >
              <FinalSeconds value={total} />
            </motion.div>
          ) : (
            <motion.div
              key="clock"
              exit={{ opacity: 0, scale: 1.04, filter: "blur(8px)" }}
              transition={{ duration: 0.35 }}
              className="display flex items-start text-[clamp(4.25rem,21vw,16rem)] tabular-nums"
            >
              {groups.map((g, gi) => (
                <span key={units[gi]} className="flex items-start">
                  {gi > 0 ? (
                    <span className="w-[0.32em] text-center leading-[0.9] text-muted/50">:</span>
                  ) : null}
                  <span className="flex flex-col">
                    <span className={`flex ${gi === 2 ? "text-neon neon-glow" : ""}`}>
                      {g.split("").map((d, di) => (
                        <Digit key={g.length - di} value={d} />
                      ))}
                    </span>
                    <span className="label mt-3 pl-[0.1em] text-[clamp(0.6rem,1.6vw,0.75rem)]">
                      {units[gi]}
                    </span>
                  </span>
                </span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function FinalSeconds({ value }: { value: number }) {
  return (
    <div className="relative flex h-[clamp(14rem,48vw,30rem)] w-full items-center justify-center overflow-hidden">
      {/* Puls-Ring je Sekunde */}
      <motion.span
        key={`ring-${value}`}
        aria-hidden
        initial={{ scale: 0.4, opacity: 0.6 }}
        animate={{ scale: 1.6, opacity: 0 }}
        transition={{ duration: 0.95, ease: "easeOut" }}
        className="absolute aspect-square h-[70%] rounded-full border-2 border-neon"
      />
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ scale: 1.6, opacity: 0, filter: "blur(12px)" }}
          animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
          exit={{ scale: 0.6, opacity: 0, filter: "blur(10px)" }}
          transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
          className="display neon-glow absolute text-[clamp(12rem,44vw,28rem)] text-neon tabular-nums"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
