"use client";

import { animate, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";

export const ease = [0.2, 0.8, 0.2, 1] as const;

/** Zahl, die von 0 hochzaehlt. */
export function CountUp({ value, delay = 0, className }: { value: number; delay?: number; className?: string }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  useEffect(() => {
    if (reduced) return;
    const controls = animate(0, value, {
      duration: Math.min(2, 0.6 + value * 0.04),
      delay,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setShown(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, delay, reduced]);
  return <span className={`tabular-nums ${className ?? ""}`}>{reduced ? value : shown}</span>;
}

/** Ueberschrift-Zeile einer Folie. */
export function Kicker({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease }}
      className="label text-neon"
    >
      {children}
    </motion.p>
  );
}

export function Rise({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.8, delay, ease }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const CONFETTI_COLORS = ["var(--color-neon)", "var(--color-paper)", "var(--color-warn)", "#7cf6ff"];

/** Konfetti aus festen Pseudozufallswerten (gleich auf allen Geraeten). */
export function Confetti({ count = 60 }: { count?: number }) {
  const reduced = useReducedMotion();
  if (reduced) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: count }, (_, i) => {
        const r = (n: number) => {
          const x = Math.sin((i + 1) * 12.9898 + n * 78.233) * 43758.5453;
          return x - Math.floor(x);
        };
        const left = r(1) * 100;
        const size = 6 + r(2) * 10;
        const delay = 0.6 + r(3) * 1.8;
        const duration = 2.6 + r(4) * 2.2;
        const drift = (r(5) - 0.5) * 200;
        const spin = (r(6) - 0.5) * 900;
        return (
          <motion.span
            key={i}
            initial={{ y: "-10vh", x: 0, rotate: 0, opacity: 1 }}
            animate={{ y: "110vh", x: drift, rotate: spin, opacity: [1, 1, 0.8] }}
            transition={{ duration, delay, ease: "easeIn", repeat: 1, repeatDelay: r(7) * 2 }}
            className="absolute top-0 block"
            style={{
              left: `${left}%`,
              width: size,
              height: size * (r(8) > 0.5 ? 0.45 : 1),
              background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              borderRadius: r(9) > 0.7 ? "50%" : 2,
            }}
          />
        );
      })}
    </div>
  );
}
