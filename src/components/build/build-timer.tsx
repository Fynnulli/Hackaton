"use client";

import { motion } from "framer-motion";
import { buildProgress, formatRemaining, timerTone, type TimerTone } from "@/lib/timer";

const TONE: Record<TimerTone, { text: string; bar: string; label: string }> = {
  calm: { text: "text-neon", bar: "bg-neon", label: "Restzeit" },
  warn: { text: "text-warn", bar: "bg-warn", label: "Noch 30 Minuten" },
  hot: { text: "text-hot", bar: "bg-hot", label: "Letzte 10 Minuten" },
  final: { text: "text-danger", bar: "bg-danger", label: "Letzte Minute" },
  over: { text: "text-muted", bar: "bg-muted", label: "Zeit um" },
};

/** Restzeit der Bauphase. Kompakt fuer die Kopfzeile, gross als Buehne. */
export function BuildTimer({
  startsAt,
  endsAt,
  nowMs,
  size = "compact",
}: {
  startsAt: string;
  endsAt: string;
  nowMs: number;
  size?: "compact" | "large";
}) {
  const endMs = Date.parse(endsAt);
  const remaining = endMs - nowMs;
  const tone = timerTone(remaining);
  const t = TONE[tone];
  const progress = buildProgress(Date.parse(startsAt), endMs, nowMs);
  const text = tone === "over" ? "00:00" : formatRemaining(remaining);
  const seconds = Math.ceil(remaining / 1000);

  if (size === "compact") {
    return (
      <span className="flex flex-col items-end gap-1" role="timer" aria-label={`${t.label}: ${text}`}>
        <motion.span
          key={tone === "final" ? seconds : tone}
          initial={tone === "final" ? { scale: 1.12 } : false}
          animate={{ scale: 1 }}
          transition={{ duration: 0.35 }}
          className={`font-mono text-lg font-semibold tabular-nums transition-colors duration-700 sm:text-xl ${t.text}`}
        >
          {text}
        </motion.span>
        <span className="h-0.5 w-full min-w-16 overflow-hidden rounded-full bg-line" aria-hidden>
          <span
            className={`block h-full transition-colors duration-700 ${t.bar}`}
            style={{ width: `${(1 - progress) * 100}%` }}
          />
        </span>
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-3" role="timer" aria-label={`${t.label}: ${text}`}>
      <p className={`label transition-colors duration-700 ${tone === "calm" ? "" : t.text}`}>
        {t.label}
      </p>
      <motion.p
        key={tone === "final" ? seconds : tone}
        initial={tone === "final" ? { scale: 1.06 } : false}
        animate={{ scale: 1 }}
        transition={{ duration: 0.4 }}
        className={`display origin-left text-[clamp(4rem,16vw,9rem)] tabular-nums transition-colors duration-700 ${t.text} ${tone === "calm" ? "" : "neon-glow"}`}
      >
        {text}
      </motion.p>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-line" aria-hidden>
        <div
          className={`h-full rounded-full transition-colors duration-700 ${t.bar}`}
          style={{ width: `${(1 - progress) * 100}%` }}
        />
      </div>
    </div>
  );
}
