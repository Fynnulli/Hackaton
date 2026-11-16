"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { Stage } from "@/lib/types";

/**
 * Die Enthuellung als reine Funktion der verstrichenen Zeit: Jeder Frame wird aus
 * `getElapsed()` berechnet. Dadurch sehen alle Geraete dasselbe Bild, und ein Reload
 * mitten in der Animation setzt an der richtigen Stelle fort.
 *
 * Zeitachse (Anteil an durationMs):
 *   0.00-0.30  Die Null zerfaellt, Scan-Linie, "Thema wird entschluesselt"
 *   0.30-0.70  Buchstaben-Scramble loest sich von links zum Titel auf
 *   0.70-1.00  Titel rastet ein, Stufe 1 und 2 fahren hoch
 * Fehlt das Thema noch (Datenbank gibt es erst ab reveal_at frei), bleibt der Scramble
 * stehen, bis es da ist.
 */

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@$*+=<>/";
const PLACEHOLDER_LEN = 14;

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const seg = (f: number, a: number, b: number) => clamp((f - a) / (b - a));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function glyph(i: number, bucket: number) {
  let x = (i + 1) * 374761393 + bucket * 668265263;
  x = (x ^ (x >>> 13)) * 1274126177;
  return GLYPHS[Math.abs(x ^ (x >>> 16)) % GLYPHS.length];
}

function useElapsed(getElapsed: () => number) {
  const [elapsed, setElapsed] = useState(getElapsed);
  const ref = useRef(getElapsed);
  useEffect(() => {
    ref.current = getElapsed;
  }, [getElapsed]);
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      setElapsed(ref.current());
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  return elapsed;
}

interface RevealProps {
  durationMs: number;
  getElapsed: () => number;
  stages: Stage[];
  /** Wird einmal aufgerufen, wenn die Animation durch ist und das Thema steht. */
  onDone?: () => void;
}

export function Reveal({ durationMs, getElapsed, stages, onDone }: RevealProps) {
  const reduced = useReducedMotion();
  const elapsed = useElapsed(getElapsed);
  const topic = stages.find((s) => s.stage_no === 1) ?? null;
  const cards = stages.filter((s) => s.stage_no === 1 || s.stage_no === 2);

  // Ohne Thema friert die Zeitachse kurz vor dem Einrasten ein.
  const rawF = elapsed / durationMs;
  const f = topic ? rawF : Math.min(rawF, 0.69);
  const done = topic !== null && rawF >= 1;

  const doneRef = useRef(false);
  useEffect(() => {
    if (done && !doneRef.current) {
      doneRef.current = true;
      onDone?.();
    }
  }, [done, onDone]);

  if (reduced) return <ReducedReveal f={f} topic={topic} cards={cards} />;

  const title = topic?.title ?? "";
  const len = topic ? title.length : PLACEHOLDER_LEN;
  const resolved = topic ? Math.floor(len * easeInOut(seg(f, 0.3, 0.68))) : 0;
  const bucket = Math.floor(elapsed / 55);

  // A: Null zerfaellt
  const zeroT = seg(f, 0, 0.16);
  // Scan-Linie
  const scanT = easeInOut(seg(f, 0.02, 0.3));
  // Label "entschluesselt"
  const labelIn = seg(f, 0.1, 0.2) * (1 - seg(f, 0.66, 0.72));
  // Titelbereich
  const titleIn = easeOut(seg(f, 0.26, 0.36));
  const lock = easeOut(seg(f, 0.68, 0.78));
  const flash = f >= 0.68 ? Math.max(0, 1 - (f - 0.68) / 0.06) : 0;
  // Raster zieht sich zusammen
  const gridScale = 1 + 0.6 * (1 - easeOut(seg(f, 0, 0.5)));

  return (
    <main
      className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-5 py-16 sm:px-8"
      aria-live="polite"
    >
      {/* Raster */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgb(200 255 46 / 0.07) 1px, transparent 1px), linear-gradient(to bottom, rgb(200 255 46 / 0.07) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          backgroundPosition: "center",
          transform: `scale(${gridScale})`,
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, black 10%, transparent 75%)",
        }}
      />

      {/* Scan-Linie */}
      {scanT > 0 && scanT < 1 ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 h-px bg-neon shadow-[0_0_24px_6px_rgb(200_255_46/0.45)]"
          style={{ top: `${scanT * 100}%`, opacity: 1 - scanT * 0.4 }}
        />
      ) : null}

      {/* Blitz beim Einrasten */}
      {flash > 0 ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-neon"
          style={{ opacity: flash * 0.18 }}
        />
      ) : null}

      {/* A: die Null */}
      {zeroT < 1 ? (
        <span
          aria-hidden
          className="display neon-glow absolute text-[clamp(12rem,44vw,28rem)] text-neon"
          style={{
            transform: `scale(${1 + zeroT * 2.2})`,
            opacity: 1 - zeroT,
            filter: `blur(${zeroT * 18}px)`,
          }}
        >
          0
        </span>
      ) : null}

      <div className="relative z-10 flex w-full max-w-6xl flex-col items-center gap-8 text-center">
        <p
          className="label flex items-center gap-3 text-neon"
          style={{ opacity: labelIn }}
        >
          <span className="size-1.5 animate-pulse rounded-full bg-neon" />
          {topic ? "Thema wird entschlüsselt" : "Verbindung zum Thema"}
        </p>

        <h1
          className="display text-[clamp(2.75rem,10.5vw,9rem)] [overflow-wrap:anywhere] [text-wrap:balance]"
          style={{
            opacity: titleIn,
            transform: `translateY(${(1 - titleIn) * 24}px) scale(${1 + (1 - lock) * 0.03})`,
            letterSpacing: `${(1 - lock) * 0.04 - 0.015}em`,
          }}
        >
          {Array.from({ length: len }, (_, i) => {
            const ch = topic ? title[i] : " ";
            if (topic && ch === " ") return " ";
            const isResolved = i < resolved;
            return (
              <span
                key={i}
                className={
                  isResolved
                    ? lock > 0
                      ? "text-neon neon-glow"
                      : "text-paper"
                    : "font-mono text-[0.7em] text-neon/45"
                }
              >
                {isResolved ? ch : glyph(i, bucket)}
              </span>
            );
          })}
        </h1>

        {topic ? <span className="sr-only">{`Das Thema: ${title}`}</span> : null}

        <div className="grid w-full gap-4 text-left sm:grid-cols-2">
          {cards.map((s, i) => {
            const t = easeOut(seg(f, 0.76 + i * 0.07, 0.9 + i * 0.07));
            return (
              <StageCard
                key={s.stage_no}
                stage={s}
                hideTitle={s.stage_no === 1}
                style={{ opacity: t, transform: `translateY(${(1 - t) * 40}px)` }}
              />
            );
          })}
        </div>
      </div>
    </main>
  );
}

function ReducedReveal({ f, topic, cards }: { f: number; topic: Stage | null; cards: Stage[] }) {
  const show = topic !== null && f >= 0.5;
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-5 py-16 text-center sm:px-8">
      {show ? (
        <>
          <p className="label text-neon">Das Thema</p>
          <h1 className="display neon-glow text-[clamp(2.75rem,10.5vw,9rem)] text-neon">
            {topic.title}
          </h1>
          <div className="grid w-full max-w-6xl gap-4 text-left sm:grid-cols-2">
            {cards.map((s) => (
              <StageCard key={s.stage_no} stage={s} />
            ))}
          </div>
        </>
      ) : (
        <p className="display text-6xl">Gleich…</p>
      )}
    </main>
  );
}

export function StageCard({
  stage,
  style,
  className,
  hideTitle = false,
}: {
  stage: Stage;
  /** Bei Stufe 1 steht der Titel schon als Thema darueber. */
  hideTitle?: boolean;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <article
      style={style}
      className={`rounded-2xl border border-line bg-surface/90 p-5 backdrop-blur sm:p-7 ${className ?? ""}`}
    >
      <p className="label text-neon">Stufe {stage.stage_no}</p>
      {hideTitle ? null : (
        <h3 className="mt-3 text-2xl font-bold tracking-tight">{stage.title}</h3>
      )}
      <p className={`mt-3 whitespace-pre-line text-lg ${hideTitle ? "text-paper" : "text-muted"}`}>
        {stage.body}
      </p>
    </article>
  );
}
