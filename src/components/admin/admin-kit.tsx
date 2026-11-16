"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { toMessage } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase";
import { Card } from "../ui";

export type Feedback = { kind: "ok" | "error"; text: string } | null;

/**
 * Fuehrt eine Admin-RPC aus und meldet Erfolg oder Fehler. Danach wird `after` aufgerufen
 * (Zustand frisch laden), auch im Fehlerfall.
 */
export function useAdminAction(after: () => unknown) {
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    if (!feedback || feedback.kind === "error") return;
    const t = window.setTimeout(() => setFeedback(null), 3500);
    return () => window.clearTimeout(t);
  }, [feedback]);

  const run = useCallback(
    async (key: string, fn: string, args: Record<string, unknown> | undefined, okText: string) => {
      setBusy(key);
      setFeedback(null);
      try {
        const { error } = await getSupabase().rpc(fn, args);
        if (error) throw error;
        setFeedback({ kind: "ok", text: okText });
        return true;
      } catch (err) {
        setFeedback({ kind: "error", text: toMessage(err) });
        return false;
      } finally {
        setBusy(null);
        await after();
      }
    },
    [after],
  );

  return { busy, feedback, setFeedback, run };
}

export function Section({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`flex flex-col gap-5 ${className ?? ""}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="display text-3xl sm:text-4xl">{title}</h2>
        {hint ? <p className="label normal-case tracking-normal">{hint}</p> : null}
      </div>
      {children}
    </Card>
  );
}

export function FeedbackLine({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  return (
    <p
      role={feedback.kind === "error" ? "alert" : "status"}
      className={`rounded-lg border px-3 py-2 text-sm ${
        feedback.kind === "error"
          ? "border-danger/40 bg-danger/10 text-danger"
          : "border-neon/40 bg-neon/10 text-neon"
      }`}
    >
      {feedback.text}
    </p>
  );
}

/**
 * Knopf mit eingebauter Bestaetigung: erster Klick fragt "Wirklich?", zweiter fuehrt aus.
 * Nach 4 Sekunden ohne Bestaetigung faellt er zurueck.
 */
export function ConfirmButton({
  children,
  onConfirm,
  busy = false,
  disabled = false,
  active = false,
  confirm = true,
  className,
}: {
  children: ReactNode;
  onConfirm: () => void;
  busy?: boolean;
  disabled?: boolean;
  active?: boolean;
  confirm?: boolean;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(t);
  }, [armed]);

  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={() => {
        if (!confirm || armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
      className={`focus-ring flex min-h-12 items-center justify-center gap-2 rounded-xl border px-4 py-2 font-mono text-xs font-semibold tracking-[0.08em] uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        armed
          ? "border-danger bg-danger text-ink"
          : active
            ? "border-neon bg-neon/15 text-neon"
            : "border-line bg-raised text-paper enabled:hover:border-muted"
      } ${className ?? ""}`}
    >
      {busy ? (
        <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      {armed ? "Wirklich?" : children}
    </button>
  );
}

export const TIME = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});
export const DATE_TIME = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** Wert fuer <input type="datetime-local"> in lokaler Zeit. */
export function toLocalInput(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
