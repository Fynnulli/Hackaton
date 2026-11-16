"use client";

import { AnimatePresence, motion } from "framer-motion";

/** Eine Ziffer, die beim Wechsel von oben nachrollt. Feste Breite, damit nichts springt. */
export function Digit({ value, className }: { value: string; className?: string }) {
  return (
    <span
      className={`relative inline-flex h-[0.9em] w-[0.56em] justify-center overflow-hidden ${className ?? ""}`}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          initial={{ y: "-70%", opacity: 0, filter: "blur(6px)" }}
          animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
          exit={{ y: "70%", opacity: 0, filter: "blur(6px)" }}
          transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
          className="absolute inset-x-0 top-0 text-center leading-[0.9]"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Zahl, deren Stellen einzeln rollen (z. B. "X sind schon da"). */
export function RollingNumber({ value, className }: { value: number; className?: string }) {
  const chars = String(Math.max(0, Math.floor(value))).split("");
  return (
    <span className={`inline-flex tabular-nums ${className ?? ""}`} aria-label={String(value)}>
      {chars.map((c, i) => (
        <Digit key={chars.length - i} value={c} />
      ))}
    </span>
  );
}
