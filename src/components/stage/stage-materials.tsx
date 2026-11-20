"use client";

import { formatBytes } from "@/lib/format-bytes";
import { linkify } from "@/lib/linkify";
import { useMaterialDownload, useMaterials } from "@/lib/use-materials";

/** Stufentext mit klickbaren Links (neuer Tab). */
export function LinkedText({ text }: { text: string }) {
  return (
    <>
      {linkify(text).map((part, i) =>
        part.kind === "link" ? (
          <a
            key={i}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring rounded-sm text-neon underline decoration-neon/50 underline-offset-4 [overflow-wrap:anywhere] hover:decoration-neon"
          >
            {part.text}
          </a>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

/** Download-Knoepfe fuer die Dateien im Ordner `<stage_no>/`. Ohne Dateien: nichts. */
export function StageMaterials({ stageNo }: { stageNo: number }) {
  const files = useMaterials(stageNo);
  const { busy, failed, download } = useMaterialDownload();
  if (files.length === 0) return null;

  return (
    <div className="mt-5 flex flex-col gap-2">
      <p className="label">Material</p>
      <ul className="flex flex-col gap-2">
        {files.map((file) => (
          <li key={file.path}>
            <button
              type="button"
              onClick={() => void download(file)}
              disabled={busy === file.path}
              className="focus-ring flex w-full items-center gap-3 rounded-xl border border-line bg-raised px-4 py-3 text-left transition-colors enabled:hover:border-neon/60 disabled:cursor-wait"
            >
              <span aria-hidden className="font-mono text-neon">
                {busy === file.path ? "…" : "↓"}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{file.name}</span>
              <span className="shrink-0 font-mono text-xs text-muted">{formatBytes(file.size)}</span>
            </button>
            {failed === file.path ? (
              <p role="alert" className="mt-1 text-sm text-danger">
                Download hat nicht geklappt. Bitte noch einmal versuchen.
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
