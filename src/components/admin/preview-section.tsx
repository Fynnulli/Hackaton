"use client";

import { useCallback, useState } from "react";
import { REVEAL_MS } from "@/lib/phase";
import type { Stage } from "@/lib/types";
import { TaskCard } from "../build/task-card";
import { Reveal } from "../reveal/reveal";
import { Button, TextField } from "../ui";
import { Section } from "./admin-kit";

const STAGE_LABELS = ["Stufe 1 · Titel = Thema", "Stufe 2", "Stufe 3 · Twist"];
const PLACEHOLDERS: Stage[] = [
  { stage_no: 1, title: "Das Thema", body: "Grundaufgabe, z. B. mit Link https://example.com" },
  { stage_no: 2, title: "Titel Stufe 2", body: "Erweiterung" },
  { stage_no: 3, title: "Titel Twist", body: "Der Twist" },
];
const EMPTY: Stage[] = PLACEHOLDERS.map((s) => ({ ...s, title: "", body: "" }));

/**
 * Vorschau fuer Titel und Texte der drei Stufen: rendert nur im Browser wie Enthuellung und
 * Aufgabenkarte. Nichts wird gespeichert oder gesendet (auch nicht im Browser-Speicher);
 * das echte Thema kommt weiterhin per SQL-Editor in challenge_stage.
 */
export function PreviewSection() {
  const [draft, setDraft] = useState<Stage[]>(EMPTY);
  const [view, setView] = useState<"reveal" | "task">("reveal");
  const [playKey, setPlayKey] = useState(0);
  const [playStart, setPlayStart] = useState<number | null>(null);
  const [twist, setTwist] = useState(false);

  // Leere Felder zeigen den Platzhalter, damit die Vorschau nie leer ist.
  const stages = draft.map((s, i) => ({
    ...s,
    title: s.title.trim() || PLACEHOLDERS[i].title,
    body: s.body.trim() ? s.body : PLACEHOLDERS[i].body,
  }));

  const update = (i: number, key: "title" | "body", value: string) =>
    setDraft((prev) => prev.map((s, j) => (j === i ? { ...s, [key]: value } : s)));

  // Ohne Abspielen steht die Enthuellung auf dem letzten Bild.
  const getElapsed = useCallback(
    () => (playStart === null ? REVEAL_MS : performance.now() - playStart),
    [playStart],
  );

  return (
    <Section title="Vorschau" hint="nur hier im Browser, nichts wird gespeichert">
      <div className="grid gap-5 lg:grid-cols-3">
        {draft.map((s, i) => (
          <div key={s.stage_no} className="flex flex-col gap-3">
            <TextField
              id={`preview-title-${s.stage_no}`}
              label={STAGE_LABELS[i]}
              value={s.title}
              onChange={(e) => update(i, "title", e.target.value)}
              placeholder={PLACEHOLDERS[i].title}
              autoComplete="off"
            />
            <label htmlFor={`preview-body-${s.stage_no}`} className="sr-only">
              Text {STAGE_LABELS[i]}
            </label>
            <textarea
              id={`preview-body-${s.stage_no}`}
              value={s.body}
              onChange={(e) => update(i, "body", e.target.value)}
              rows={4}
              placeholder={PLACEHOLDERS[i].body}
              className="focus-ring min-h-28 w-full resize-y rounded-xl border border-line bg-raised px-4 py-3 text-base text-paper transition-colors placeholder:text-muted/60 focus:border-neon"
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Ansicht">
        <Button
          variant={view === "reveal" ? "primary" : "ghost"}
          role="tab"
          aria-selected={view === "reveal"}
          className="h-11"
          onClick={() => setView("reveal")}
        >
          Enthüllung
        </Button>
        <Button
          variant={view === "task" ? "primary" : "ghost"}
          role="tab"
          aria-selected={view === "task"}
          className="h-11"
          onClick={() => setView("task")}
        >
          Aufgabenkarte
        </Button>
        <span className="flex-1" />
        {view === "reveal" ? (
          <Button
            variant="ghost"
            className="h-11"
            onClick={() => {
              setPlayStart(performance.now());
              setPlayKey((k) => k + 1);
            }}
          >
            ▶ Abspielen (10 s)
          </Button>
        ) : (
          <Button
            variant="ghost"
            className="h-11"
            onClick={() => setTwist((t) => !t)}
          >
            {twist ? "Twist verbergen" : "Twist enthüllen"}
          </Button>
        )}
      </div>

      <div className="relative flex min-h-[28rem] flex-col overflow-hidden rounded-2xl border border-dashed border-line bg-ink">
        {view === "reveal" ? (
          <Reveal
            key={playKey}
            preview
            durationMs={REVEAL_MS}
            getElapsed={getElapsed}
            stages={stages.filter((s) => s.stage_no <= 2)}
          />
        ) : (
          <div className="p-5 sm:p-8">
            <TaskCard
              preview
              stages={twist ? stages : stages.filter((s) => s.stage_no <= 2)}
              twistAt={null}
              twistJustRevealed={twist}
            />
          </div>
        )}
      </div>
    </Section>
  );
}
