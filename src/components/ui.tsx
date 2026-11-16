"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function Wordmark() {
  return (
    <span className="font-mono text-xs font-semibold tracking-[0.18em] text-paper uppercase">
      3h<span className="text-neon">/</span>Build
    </span>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "quiet";
  busy?: boolean;
};

export function Button({
  variant = "primary",
  busy = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  // Deaktiviert (aber nicht beschaeftigt) soll klar inaktiv aussehen, nicht wie gedimmtes Neon.
  const inactive = Boolean(disabled) && !busy;
  return (
    <button
      {...rest}
      disabled={disabled || busy}
      aria-busy={busy}
      className={cx(
        "focus-ring inline-flex items-center justify-center gap-2 rounded-xl border font-mono text-sm font-semibold tracking-[0.08em] uppercase transition-[background-color,border-color,color,transform] duration-150 enabled:active:scale-[0.98] disabled:cursor-not-allowed",
        variant === "primary" &&
          (inactive
            ? "h-14 border-line bg-raised px-6 text-muted"
            : "h-14 border-transparent bg-neon px-6 text-ink enabled:hover:bg-[#d8ff66]"),
        variant === "ghost" &&
          (inactive
            ? "h-14 border-line bg-transparent px-6 text-muted/70"
            : "h-14 border-line bg-raised px-6 text-paper enabled:hover:border-muted"),
        variant === "quiet" &&
          "h-10 border-transparent text-xs text-muted underline-offset-4 enabled:hover:text-paper enabled:hover:underline",
        className,
      )}
    >
      {busy ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function Spinner() {
  return (
    <span
      aria-hidden
      className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: ReactNode;
};

export function TextField({ label, hint, id, className, ...rest }: TextFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="label">
          {label}
        </label>
        {hint ? <span className="label normal-case tracking-normal">{hint}</span> : null}
      </div>
      <input
        id={id}
        {...rest}
        className={cx(
          "focus-ring h-14 w-full rounded-xl border border-line bg-raised px-4 text-lg text-paper placeholder:text-muted/60 transition-colors focus:border-neon",
          className,
        )}
      />
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  return (
    <AnimatePresence initial={false}>
      {message ? (
        <motion.div
          key="error"
          role="alert"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          className="overflow-hidden"
        >
          <p className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {message}
          </p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cx("rounded-2xl border border-line bg-surface/80 p-5 sm:p-7", className)}>
      {children}
    </section>
  );
}

/** Vollbild-Zustand fuer Laden, Fehler und Hinweise. */
export function Notice({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <Wordmark />
      <h1 className="display text-5xl sm:text-7xl">{title}</h1>
      {children ? <div className="max-w-md text-base text-muted">{children}</div> : null}
      {action}
    </main>
  );
}

export function Splash() {
  return (
    <main
      className="flex flex-1 flex-col items-center justify-center gap-5"
      role="status"
      aria-label="Lädt"
    >
      <span className="size-3 animate-pulse rounded-full bg-neon shadow-[0_0_24px_var(--color-neon)]" />
      <Wordmark />
    </main>
  );
}
