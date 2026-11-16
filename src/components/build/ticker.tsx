"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Announcement } from "@/lib/types";
import { Card } from "../ui";

const TIME = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });

/** Live-Ticker: Durchsagen der Event-Leitung und automatische Ereignisse, neueste oben. */
export function Ticker({ items, live }: { items: Announcement[]; live: boolean }) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <p className="label flex items-center gap-2">
          <span
            className={`size-1.5 rounded-full ${live ? "animate-pulse bg-danger" : "bg-muted"}`}
            aria-hidden
          />
          Live-Ticker
        </p>
        <p className="label">{items.length > 0 ? `${items.length}` : ""}</p>
      </div>

      {items.length === 0 ? (
        <p className="text-muted">Noch ruhig hier. Abgaben und Durchsagen erscheinen live.</p>
      ) : (
        <ol className="flex max-h-[26rem] flex-col gap-2 overflow-y-auto pr-1" aria-live="polite">
          <AnimatePresence initial={false}>
            {items.map((a) => (
              <motion.li
                key={a.id}
                layout
                initial={{ opacity: 0, y: -12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
                className={`rounded-xl border px-4 py-3 ${
                  a.kind === "admin" ? "border-neon/50 bg-neon/5" : "border-line bg-raised"
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className={`label ${a.kind === "admin" ? "text-neon" : ""}`}>
                    {a.kind === "admin" ? "Durchsage" : "Ereignis"}
                  </span>
                  <span className="font-mono text-xs text-muted tabular-nums">
                    {TIME.format(new Date(a.created_at))}
                  </span>
                </div>
                <p className={`mt-1.5 ${a.kind === "admin" ? "text-lg font-semibold" : ""}`}>
                  {a.body}
                </p>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}
    </Card>
  );
}
