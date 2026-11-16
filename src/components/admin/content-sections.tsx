"use client";

import { useState, type FormEvent } from "react";
import { toMessage } from "@/lib/errors";
import { EMPTY_DRAFT, normalizeUrl, validateDraft, type Draft } from "@/lib/submission-form";
import type { EventRow, Submission, TeamPublic } from "@/lib/types";
import type { LeaderRow } from "@/lib/use-admin-data";
import { Button, TextField } from "../ui";
import { ConfirmButton, FeedbackLine, Section, TIME, useAdminAction } from "./admin-kit";

const PRESETS = ["Noch 30 Minuten!", "Noch 10 Minuten!", "Letzte Minute – jetzt abgeben!"];

export function AnnouncementSection() {
  const { busy, feedback, setFeedback, run } = useAdminAction(() => undefined);
  const [body, setBody] = useState("");

  async function send(text: string, key: string) {
    const ok = await run(key, "admin_post_announcement", { p_body: text }, "Durchsage gesendet");
    if (ok && key === "form") setBody("");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) {
      setFeedback({ kind: "error", text: "Die Durchsage ist leer." });
      return;
    }
    void send(body.trim(), "form");
  }

  return (
    <Section title="Durchsage" hint="erscheint sofort im Ticker">
      <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
        <TextField
          id="announcement"
          label="Text"
          hint={`${body.trim().length}/280`}
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, 280))}
          placeholder="z. B. Pizza ist da 🍕"
          autoComplete="off"
        />
        <Button type="submit" busy={busy === "form"} disabled={!body.trim()}>
          Senden
        </Button>
      </form>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <ConfirmButton key={p} busy={busy === p} onConfirm={() => void send(p, p)}>
            {p}
          </ConfirmButton>
        ))}
      </div>
      <FeedbackLine feedback={feedback} />
    </Section>
  );
}

export function SubmissionsSection({
  submissions,
  leaderboard,
  teams,
  refresh,
}: {
  submissions: Submission[];
  leaderboard: LeaderRow[];
  teams: TeamPublic[];
  refresh: () => unknown;
}) {
  const { busy, feedback, run } = useAdminAction(refresh);
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const score = new Map(leaderboard.map((r) => [r.submission_id, r]));
  const withoutSubmission = teams.filter((t) => !submissions.some((s) => s.team_id === t.id));
  const sorted = [...submissions].sort(
    (a, b) => (score.get(a.id)?.place ?? 999) - (score.get(b.id)?.place ?? 999),
  );

  return (
    <Section
      title="Abgaben"
      hint={`${submissions.length} von ${teams.length} Teams · Punkte nur für dich sichtbar`}
    >
      {submissions.length === 0 ? (
        <p className="text-muted">Noch keine Abgaben.</p>
      ) : (
        <div className="-mx-2 overflow-x-auto px-2">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="label border-b border-line">
                <th className="py-2 pr-3 font-medium">#</th>
                <th className="py-2 pr-3 font-medium">Team / Projekt</th>
                <th className="py-2 pr-3 font-medium">Stufen</th>
                <th className="py-2 pr-3 font-medium">Stimmen</th>
                <th className="py-2 pr-3 font-medium">Punkte</th>
                <th className="py-2 pr-3 font-medium">Zuletzt</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => {
                const r = score.get(s.id);
                return (
                  <tr key={s.id} className={`border-b border-line/60 ${s.hidden ? "opacity-50" : ""}`}>
                    <td className="py-3 pr-3 font-mono tabular-nums">{s.hidden ? "–" : (r?.place ?? "–")}</td>
                    <td className="py-3 pr-3">
                      <p className="label normal-case tracking-normal">{teamName.get(s.team_id) ?? "?"}</p>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold underline-offset-4 hover:text-neon hover:underline"
                      >
                        {s.title}
                      </a>
                    </td>
                    <td className="py-3 pr-3 font-mono text-xs">
                      {[s.stage1, s.stage2, s.stage3].map((d, i) => (d ? `S${i + 1}` : "··")).join(" ")}
                    </td>
                    <td className="py-3 pr-3 font-mono tabular-nums">{r?.vote_count ?? 0}</td>
                    <td className="py-3 pr-3 font-mono tabular-nums text-neon">{r?.points ?? "–"}</td>
                    <td className="py-3 pr-3 font-mono text-xs tabular-nums">
                      {TIME.format(new Date(s.updated_at))}
                    </td>
                    <td className="py-3 text-right">
                      <ConfirmButton
                        busy={busy === s.id}
                        onConfirm={() =>
                          void run(
                            s.id,
                            "admin_set_submission_hidden",
                            { p_submission_id: s.id, p_hidden: !s.hidden },
                            s.hidden ? "Wieder eingeblendet" : "Ausgeblendet",
                          )
                        }
                        className="!min-h-9 whitespace-nowrap"
                      >
                        {s.hidden ? "Einblenden" : "Ausblenden"}
                      </ConfirmButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-sm text-muted">
        Ausblenden entfernt die Abgabe aus Galerie und Wertung und gibt die Stimmen dafür an die
        Abstimmenden zurück. Beim Einblenden startet sie wieder bei null Stimmen.
      </p>
      {withoutSubmission.length > 0 ? (
        <p className="text-sm text-muted">
          Ohne Abgabe: {withoutSubmission.map((t) => t.name).join(", ")}
        </p>
      ) : null}
      <FeedbackLine feedback={feedback} />
    </Section>
  );
}

export function BackfillSection({
  teams,
  submissions,
  refresh,
}: {
  teams: TeamPublic[];
  submissions: Submission[];
  refresh: () => unknown;
}) {
  const { busy, feedback, setFeedback, run } = useAdminAction(refresh);
  const [teamId, setTeamId] = useState("");
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  function pickTeam(id: string) {
    setTeamId(id);
    const s = submissions.find((x) => x.team_id === id);
    setDraft(
      s
        ? { title: s.title, url: s.url, description: s.description, stage1: s.stage1, stage2: s.stage2, stage3: s.stage3 }
        : EMPTY_DRAFT,
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!teamId) {
      setFeedback({ kind: "error", text: "Bitte ein Team wählen." });
      return;
    }
    const d = { ...draft, url: normalizeUrl(draft.url) };
    const problem = validateDraft(d);
    if (problem) {
      setFeedback({ kind: "error", text: toMessage(problem) });
      return;
    }
    await run(
      "save",
      "admin_upsert_submission",
      {
        p_team_id: teamId,
        p_title: d.title.trim(),
        p_url: d.url,
        p_description: d.description.trim(),
        p_stage1: d.stage1,
        p_stage2: d.stage2,
        p_stage3: d.stage3,
      },
      "Abgabe gespeichert",
    );
  }

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <Section title="Abgabe nachtragen" hint="ohne Zeitsperre">
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-2">
          <span className="label">Team</span>
          <select
            value={teamId}
            onChange={(e) => pickTeam(e.target.value)}
            className="focus-ring h-14 rounded-xl border border-line bg-raised px-3 text-lg text-paper focus:border-neon"
          >
            <option value="">Team wählen…</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {submissions.some((s) => s.team_id === t.id) ? " (hat abgegeben)" : ""}
              </option>
            ))}
          </select>
        </label>
        <TextField id="bf-title" label="Titel" value={draft.title} maxLength={80} onChange={(e) => set("title", e.target.value)} />
        <TextField
          id="bf-url"
          label="Link"
          value={draft.url}
          onChange={(e) => set("url", e.target.value)}
          onBlur={() => set("url", normalizeUrl(draft.url))}
          autoCapitalize="none"
          spellCheck={false}
        />
        <TextField
          id="bf-desc"
          label="Beschreibung"
          hint={`${draft.description.length}/300`}
          value={draft.description}
          maxLength={300}
          onChange={(e) => set("description", e.target.value)}
        />
        <div className="flex flex-wrap gap-4">
          {([1, 2, 3] as const).map((n) => {
            const k = `stage${n}` as const;
            return (
              <label key={n} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft[k]}
                  onChange={(e) => set(k, e.target.checked)}
                  className="size-5 accent-[var(--color-neon)]"
                />
                <span>Stufe {n}</span>
              </label>
            );
          })}
        </div>
        <Button type="submit" busy={busy === "save"} disabled={!teamId}>
          Speichern
        </Button>
      </form>
      <FeedbackLine feedback={feedback} />
    </Section>
  );
}

export function WrappedSection({ event, refresh }: { event: EventRow; refresh: () => unknown }) {
  const { busy, feedback, run } = useAdminAction(refresh);
  const slide = event.wrapped_slide;
  const go = (n: number, key: string) =>
    void run(key, "admin_set_wrapped_slide", { p_slide: n }, `Folie ${n + 1}`);

  return (
    <Section title="Wrapped" hint={event.phase === "wrapped" ? "läuft" : "erst in der Phase Wrapped sichtbar"}>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={() => go(Math.max(0, slide - 1), "prev")} busy={busy === "prev"} disabled={slide === 0}>
          ← Zurück
        </Button>
        <p className="display min-w-24 text-center text-5xl tabular-nums">{slide + 1}</p>
        <Button onClick={() => go(slide + 1, "next")} busy={busy === "next"}>
          Weiter →
        </Button>
        <ConfirmButton busy={busy === "reset"} disabled={slide === 0} onConfirm={() => go(0, "reset")}>
          Auf Anfang
        </ConfirmButton>
      </div>
      <p className="text-sm text-muted">Alle Bildschirme springen synchron auf die Folie.</p>
      <FeedbackLine feedback={feedback} />
    </Section>
  );
}
