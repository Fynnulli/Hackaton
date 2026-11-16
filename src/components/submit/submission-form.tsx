"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import { toMessage } from "@/lib/errors";
import { extensionFor, prepareScreenshot, ScreenshotError } from "@/lib/image";
import { EMPTY_DRAFT, normalizeUrl, validateDraft, type Draft } from "@/lib/submission-form";
import { getSupabase } from "@/lib/supabase";
import { MAX_DESCRIPTION, type Stage, type Submission } from "@/lib/types";
import { screenshotUrl, SUBMISSION_COLS } from "@/lib/use-submission";
import { Button, Card, FormError, Spinner, TextField } from "../ui";

type Shot =
  | { kind: "none" }
  | { kind: "existing"; path: string }
  | { kind: "new"; blob: Blob; preview: string };

const TIME = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });
const STAGE_POINTS = [10, 10, 15];

const draftKey = (teamId: string) => `dsb-draft-${teamId}`;

function fromSubmission(s: Submission | null): Draft {
  if (!s) return EMPTY_DRAFT;
  return {
    title: s.title,
    url: s.url,
    description: s.description,
    stage1: s.stage1,
    stage2: s.stage2,
    stage3: s.stage3,
  };
}

function sameDraft(a: Draft, b: Draft) {
  return (
    a.title === b.title &&
    a.url === b.url &&
    a.description === b.description &&
    a.stage1 === b.stage1 &&
    a.stage2 === b.stage2 &&
    a.stage3 === b.stage3
  );
}

function readStoredDraft(teamId: string): Draft | null {
  try {
    const raw = window.localStorage.getItem(draftKey(teamId));
    if (!raw) return null;
    return { ...EMPTY_DRAFT, ...(JSON.parse(raw) as Partial<Draft>) };
  } catch {
    return null;
  }
}

function clearStoredDraft(teamId: string) {
  try {
    window.localStorage.removeItem(draftKey(teamId));
  } catch {
    // Speicher nicht verfuegbar: egal.
  }
}

export function SubmissionForm({
  teamId,
  submission,
  stages,
  onSaved,
}: {
  teamId: string;
  submission: Submission | null;
  stages: Stage[];
  onSaved: (s: Submission) => void;
}) {
  // Stand, auf dem dieses Formular aufsetzt. Speichert ein Teammitglied zwischendurch,
  // weicht die geladene Abgabe davon ab und wir bieten an, sie zu uebernehmen.
  const [base, setBase] = useState<Submission | null>(submission);
  const [stored] = useState(() => readStoredDraft(teamId));
  const [draft, setDraft] = useState<Draft>(() => stored ?? fromSubmission(submission));
  const [restored, setRestored] = useState(
    () => stored !== null && !sameDraft(stored, fromSubmission(submission)),
  );
  const [shot, setShot] = useState<Shot>(() =>
    submission?.screenshot_path ? { kind: "existing", path: submission.screenshot_path } : { kind: "none" },
  );
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const dirty =
    !sameDraft(draft, fromSubmission(base)) ||
    shot.kind === "new" ||
    (shot.kind === "none" && Boolean(base?.screenshot_path)) ||
    (shot.kind === "existing" && shot.path !== base?.screenshot_path);
  const remoteChanged =
    submission !== null && base !== null && submission.updated_at !== base.updated_at;
  const twistOpen = stages.some((s) => s.stage_no === 3);

  // Ungespeicherte Eingaben ueberleben einen Reload (nur auf diesem Geraet).
  useEffect(() => {
    try {
      if (sameDraft(draft, fromSubmission(base))) window.localStorage.removeItem(draftKey(teamId));
      else window.localStorage.setItem(draftKey(teamId), JSON.stringify(draft));
    } catch {
      // Speicher nicht verfuegbar: dann eben ohne Entwurf.
    }
  }, [draft, base, teamId]);

  // Vorschau-URL wieder freigeben.
  useEffect(() => {
    if (shot.kind !== "new") return;
    return () => URL.revokeObjectURL(shot.preview);
  }, [shot]);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setSavedAt(null);
  };

  async function takeFile(file: File | undefined | null) {
    if (!file) return;
    setError(null);
    setPreparing(true);
    try {
      const blob = await prepareScreenshot(file);
      setShot({ kind: "new", blob, preview: URL.createObjectURL(blob) });
      setSavedAt(null);
    } catch (err) {
      setError(err instanceof ScreenshotError ? err.message : toMessage(err));
    } finally {
      setPreparing(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    void takeFile(e.dataTransfer.files[0]);
  }

  function onPaste(e: ClipboardEvent) {
    const file = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/"));
    if (file) {
      e.preventDefault();
      void takeFile(file);
    }
  }

  function adoptRemote() {
    if (!submission) return;
    setBase(submission);
    setDraft(fromSubmission(submission));
    setShot(
      submission.screenshot_path
        ? { kind: "existing", path: submission.screenshot_path }
        : { kind: "none" },
    );
    setRestored(false);
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy || preparing) return;
    const normalized = { ...draft, url: normalizeUrl(draft.url) };
    const problem = validateDraft(normalized);
    if (problem) {
      setError(toMessage(problem));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const sb = getSupabase();
      let path: string | null = shot.kind === "existing" ? shot.path : null;
      if (shot.kind === "new") {
        path = `${teamId}/${crypto.randomUUID()}.${extensionFor(shot.blob.type)}`;
        const { error: uploadError } = await sb.storage
          .from("screenshots")
          .upload(path, shot.blob, { contentType: shot.blob.type, upsert: false });
        if (uploadError) throw uploadError;
      }

      const { data, error: rpcError } = await sb
        .rpc("submit_project", {
          p_title: normalized.title.trim(),
          p_url: normalized.url,
          p_description: normalized.description.trim(),
          p_screenshot_path: path,
          p_stage1: normalized.stage1,
          p_stage2: normalized.stage2,
          p_stage3: normalized.stage3,
        })
        .select(SUBMISSION_COLS)
        .single();
      if (rpcError) throw rpcError;

      const saved = data as Submission;
      clearStoredDraft(teamId);
      setBase(saved);
      setDraft(fromSubmission(saved));
      setShot(saved.screenshot_path ? { kind: "existing", path: saved.screenshot_path } : { kind: "none" });
      setRestored(false);
      setSavedAt(saved.updated_at);
      onSaved(saved);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const descLength = draft.description.trim().length;
  const previewSrc =
    shot.kind === "new" ? shot.preview : shot.kind === "existing" ? screenshotUrl(shot.path) : null;

  return (
    <form onSubmit={onSubmit} onPaste={onPaste} className="flex flex-col gap-6" noValidate>
      <AnimatePresence initial={false}>
        {remoteChanged ? (
          <Banner key="remote">
            Ein Teammitglied hat die Abgabe gerade geändert.{" "}
            <button type="button" onClick={adoptRemote} className="font-semibold text-neon underline">
              Stand übernehmen
            </button>
          </Banner>
        ) : restored ? (
          <Banner key="restored">
            Ungespeicherte Eingaben wiederhergestellt.{" "}
            <button
              type="button"
              onClick={() => {
                setDraft(fromSubmission(base));
                setRestored(false);
              }}
              className="font-semibold text-neon underline"
            >
              Verwerfen
            </button>
          </Banner>
        ) : null}
      </AnimatePresence>

      <Card className="flex flex-col gap-6">
        <TextField
          id="sub-title"
          label="Projekttitel"
          hint={`${draft.title.trim().length}/80`}
          value={draft.title}
          onChange={(e) => update("title", e.target.value.slice(0, 80))}
          maxLength={80}
          placeholder="Wie heißt euer Projekt?"
          autoComplete="off"
          required
        />
        <TextField
          id="sub-url"
          label="Link zum Projekt"
          hint="Pflicht"
          type="url"
          inputMode="url"
          value={draft.url}
          onChange={(e) => update("url", e.target.value.slice(0, 500))}
          onBlur={() => update("url", normalizeUrl(draft.url))}
          placeholder="https://…"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
        />
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-4">
            <label htmlFor="sub-desc" className="label">
              Beschreibung
            </label>
            <span
              className={`label normal-case tracking-normal ${descLength > MAX_DESCRIPTION ? "text-danger" : ""}`}
            >
              {descLength}/{MAX_DESCRIPTION}
            </span>
          </div>
          <textarea
            id="sub-desc"
            value={draft.description}
            onChange={(e) => update("description", e.target.value.slice(0, MAX_DESCRIPTION + 20))}
            rows={4}
            placeholder="Was habt ihr gebaut? Ein, zwei Sätze reichen."
            className="focus-ring min-h-32 w-full resize-y rounded-xl border border-line bg-raised px-4 py-3 text-lg text-paper transition-colors placeholder:text-muted/60 focus:border-neon"
          />
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <p className="label">Screenshot</p>
          <p className="label normal-case tracking-normal">optional, max. 2 MB</p>
        </div>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`relative overflow-hidden rounded-xl border border-dashed transition-colors ${
            dragOver ? "border-neon bg-neon/5" : "border-line"
          }`}
        >
          {previewSrc ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- lokale Vorschau bzw. Storage-URL */}
              <img src={previewSrc} alt="Screenshot-Vorschau" className="aspect-video w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex gap-2 bg-gradient-to-t from-ink/90 to-transparent p-3 pt-10">
                <Button
                  type="button"
                  variant="ghost"
                  className="!h-10 flex-1"
                  onClick={() => fileInput.current?.click()}
                >
                  Ersetzen
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="!h-10"
                  onClick={() => {
                    setShot({ kind: "none" });
                    setSavedAt(null);
                  }}
                >
                  Entfernen
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="focus-ring flex aspect-[16/7] w-full flex-col items-center justify-center gap-3 px-6 text-center text-muted transition-colors hover:text-paper"
            >
              {preparing ? <Spinner /> : <span className="text-3xl" aria-hidden>＋</span>}
              <span className="text-lg">
                {preparing ? "Bild wird vorbereitet…" : "Bild wählen, hierher ziehen oder einfügen"}
              </span>
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/*"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              void takeFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <p className="label">Erreichte Stufen</p>
          <p className="label normal-case tracking-normal">Selbstauskunft</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {([1, 2, 3] as const).map((no) => {
            const key = `stage${no}` as const;
            const locked = no === 3 && !twistOpen;
            const checked = draft[key];
            return (
              <label
                key={no}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                  locked
                    ? "cursor-not-allowed border-line text-muted/60"
                    : checked
                      ? "border-neon bg-neon/10"
                      : "border-line bg-raised hover:border-muted"
                }`}
              >
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={checked}
                  disabled={locked}
                  onChange={(e) => update(key, e.target.checked)}
                />
                <span
                  aria-hidden
                  className={`grid size-6 shrink-0 place-items-center rounded-md border text-sm font-bold peer-focus-visible:outline-2 peer-focus-visible:outline-neon ${
                    checked ? "border-neon bg-neon text-ink" : "border-line"
                  }`}
                >
                  {checked ? "✓" : ""}
                </span>
                <span className="flex flex-col">
                  <span className="font-semibold">{no === 3 ? "Stufe 3 · Twist" : `Stufe ${no}`}</span>
                  <span className="font-mono text-xs text-muted">
                    {locked ? "noch verdeckt" : `+${STAGE_POINTS[no - 1]} Punkte`}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </Card>

      <FormError message={error} />

      <div className="flex flex-col gap-3">
        <Button type="submit" busy={busy} disabled={preparing || (!dirty && base !== null)}>
          {base ? "Änderungen speichern" : "Jetzt abgeben"}
        </Button>
        <AnimatePresence initial={false}>
          {savedAt && !dirty ? (
            <motion.div
              key="saved"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neon/50 bg-neon/10 px-4 py-3"
              role="status"
            >
              <span className="font-semibold text-neon">
                ✓ Gespeichert um {TIME.format(new Date(savedAt))} Uhr
              </span>
              <Link href="/" className="label text-paper underline-offset-4 hover:underline">
                Zurück zur Bauphase →
              </Link>
            </motion.div>
          ) : base && !dirty ? (
            <p className="label text-center">
              Abgegeben · zuletzt gespeichert {TIME.format(new Date(base.updated_at))} Uhr
            </p>
          ) : null}
        </AnimatePresence>
      </div>
    </form>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <motion.p
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden rounded-xl border border-line bg-raised px-4 py-3 text-sm"
    >
      {children}
    </motion.p>
  );
}
