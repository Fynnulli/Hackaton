"use client";

import type { Submission } from "@/lib/types";
import { screenshotUrl } from "@/lib/use-submission";
import { Card } from "../ui";

const TIME = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });

/** Nur-Lese-Ansicht der eigenen Abgabe (nach Ablauf der Bauzeit). */
export function SubmissionSummary({ submission }: { submission: Submission }) {
  const stages = [submission.stage1, submission.stage2, submission.stage3];
  return (
    <Card className="flex flex-col gap-5">
      {submission.screenshot_path ? (
        // eslint-disable-next-line @next/next/no-img-element -- Bild aus Supabase Storage, ohne Optimierer
        <img
          src={screenshotUrl(submission.screenshot_path)}
          alt=""
          className="aspect-video w-full rounded-xl border border-line object-cover"
        />
      ) : null}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{submission.title}</h2>
        <a
          href={submission.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block break-all text-neon underline-offset-4 hover:underline"
        >
          {submission.url}
        </a>
      </div>
      {submission.description ? <p className="text-lg text-muted">{submission.description}</p> : null}
      <div className="flex flex-wrap gap-2">
        {stages.map((done, i) => (
          <span
            key={i}
            className={`label rounded-full border px-3 py-1.5 ${done ? "border-neon/60 text-neon" : "border-line"}`}
          >
            Stufe {i + 1} {done ? "✓" : "–"}
          </span>
        ))}
      </div>
      <p className="label">Zuletzt gespeichert {TIME.format(new Date(submission.updated_at))} Uhr</p>
    </Card>
  );
}
