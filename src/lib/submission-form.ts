import { MAX_DESCRIPTION } from "./types";

export interface Draft {
  title: string;
  url: string;
  description: string;
  stage1: boolean;
  stage2: boolean;
  stage3: boolean;
}

export const EMPTY_DRAFT: Draft = {
  title: "",
  url: "",
  description: "",
  stage1: false,
  stage2: false,
  stage3: false,
};

/** Ergaenzt https://, wenn jemand nur "mein-projekt.vercel.app" eintippt. */
export function normalizeUrl(input: string): string {
  const url = input.trim();
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url; // anderes Schema: Server lehnt ab
  return `https://${url.replace(/^\/+/, "")}`;
}

/** Spiegelt die Pruefungen von submit_project(); liefert den Fehlercode oder null. */
export function validateDraft(d: Draft): string | null {
  const title = d.title.trim();
  if (title.length < 1 || title.length > 80) return "invalid_title";
  const url = normalizeUrl(d.url);
  if (!/^https?:\/\/\S+\.\S+/i.test(url) || url.length > 500) return "invalid_url";
  if (d.description.trim().length > MAX_DESCRIPTION) return "invalid_description";
  return null;
}
