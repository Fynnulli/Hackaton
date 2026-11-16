"use client";

import { useEffect, useState } from "react";
import { Button } from "./ui";

interface CopyButtonProps {
  getText: () => string | Promise<string>;
  label: string;
  variant?: "primary" | "ghost";
  /** Wird aufgerufen, wenn die Zwischenablage nicht verfuegbar ist. */
  onFallback?: (text: string) => void;
  className?: string;
}

export function CopyButton({
  getText,
  label,
  variant = "ghost",
  onFallback,
  className,
}: CopyButtonProps) {
  const [state, setState] = useState<"idle" | "busy" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state !== "copied" && state !== "failed") return;
    const timer = window.setTimeout(() => setState("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [state]);

  async function onClick() {
    setState("busy");
    let text: string;
    try {
      text = await getText();
    } catch {
      setState("failed");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      onFallback?.(text);
      setState(onFallback ? "idle" : "failed");
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      onClick={onClick}
      busy={state === "busy"}
      className={className}
    >
      <span aria-live="polite">
        {state === "copied" ? "Kopiert" : state === "failed" ? "Fehlgeschlagen" : label}
      </span>
    </Button>
  );
}
