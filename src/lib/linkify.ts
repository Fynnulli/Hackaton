export type TextPart = { kind: "text"; text: string } | { kind: "link"; text: string; href: string };

// http(s)://… oder www.… bis zum naechsten Leerzeichen bzw. spitzer Klammer.
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi;
// Satzzeichen am Ende gehoeren meist zum Satz, nicht zur Adresse.
const TRAILING = new Set([".", ",", ";", ":", "!", "?", "'", "»", "“", "”", ")", "]"]);

/** Zerlegt Text in Textstuecke und Links. Nur http(s) wird zum Link, nie javascript: o. Ae. */
export function linkify(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index;
    const raw = trimTrailing(match[0]);
    if (raw.length <= "www.".length) continue;

    if (start > last) parts.push({ kind: "text", text: text.slice(last, start) });
    const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    parts.push({ kind: "link", text: raw, href });
    last = start + raw.length;
  }
  if (last < text.length) parts.push({ kind: "text", text: text.slice(last) });
  return parts;
}

function trimTrailing(url: string) {
  let end = url.length;
  while (end > 0 && TRAILING.has(url[end - 1])) {
    // Eine schliessende Klammer bleibt, wenn sie eine in der URL geoeffnete schliesst
    // (z. B. https://de.wikipedia.org/wiki/Python_(Programmiersprache)).
    if (url[end - 1] === ")" && count(url.slice(0, end), "(") >= count(url.slice(0, end), ")")) break;
    end -= 1;
  }
  return url.slice(0, end);
}

function count(s: string, ch: string) {
  return s.split(ch).length - 1;
}
