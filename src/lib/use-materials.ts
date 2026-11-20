"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "./supabase";

export const MATERIAL_BUCKET = "material";
/** Gueltigkeit der Download-Links in Sekunden: kurz, der Link wird sofort benutzt. */
const SIGNED_URL_SECONDS = 60;
/** Die Leitung kann waehrend des Events nachladen; selten nachsehen reicht. */
const REFRESH_MS = 60_000;

export interface MaterialFile {
  name: string;
  path: string;
  size: number | null;
}

/**
 * Listet die Dateien im Ordner `<stage_no>/` des privaten Buckets `material`. Die Datenbank
 * gibt sie erst ab reveal_at der Stufe heraus; der Hook wird ohnehin erst aufgerufen, wenn
 * die Stufe selbst lesbar ist. Leerer Ordner (oder noch gesperrt) = leere Liste.
 */
export function useMaterials(stageNo: number, enabled = true): MaterialFile[] {
  const [files, setFiles] = useState<MaterialFile[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const load = async () => {
      try {
        const { data, error } = await getSupabase()
          .storage.from(MATERIAL_BUCKET)
          .list(String(stageNo), { limit: 100, sortBy: { column: "name", order: "asc" } });
        if (cancelled || error || !data) return;
        const next = data
          // Ordner haben keine id; das Dashboard legt in leeren Ordnern einen Platzhalter an.
          .filter((f) => f.id !== null && !f.name.startsWith("."))
          .map((f) => ({
            name: f.name,
            path: `${stageNo}/${f.name}`,
            size: typeof f.metadata?.size === "number" ? f.metadata.size : null,
          }));
        setFiles((prev) => (sameFiles(prev, next) ? prev : next));
      } catch {
        // Netzfehler: beim naechsten Durchlauf erneut.
      }
    };

    void load();
    const timer = window.setInterval(load, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [stageNo, enabled]);

  return enabled ? files : NONE;
}

const NONE: MaterialFile[] = [];

function sameFiles(a: MaterialFile[], b: MaterialFile[]) {
  return a.length === b.length && a.every((f, i) => f.path === b[i].path && f.size === b[i].size);
}

/** Holt einen kurzlebigen Signed URL, der die Datei als Download ausliefert. */
export function useMaterialDownload() {
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const download = useCallback(async (file: MaterialFile) => {
    setBusy(file.path);
    setFailed(null);
    try {
      const { data, error } = await getSupabase()
        .storage.from(MATERIAL_BUCKET)
        .createSignedUrl(file.path, SIGNED_URL_SECONDS, { download: file.name });
      if (error || !data) throw error ?? new Error("no_url");
      // Content-Disposition: attachment, die Seite bleibt also stehen.
      window.location.assign(data.signedUrl);
    } catch {
      setFailed(file.path);
    } finally {
      setBusy(null);
    }
  }, []);

  return { busy, failed, download };
}
