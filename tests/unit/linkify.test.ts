import { describe, expect, test } from "vitest";
import { linkify } from "../../src/lib/linkify";

const links = (text: string) =>
  linkify(text)
    .filter((p) => p.kind === "link")
    .map((p) => (p.kind === "link" ? [p.text, p.href] : null));

describe("linkify", () => {
  test("Text ohne Links bleibt ein Stueck", () => {
    expect(linkify("Baut etwas Schoenes.")).toEqual([{ kind: "text", text: "Baut etwas Schoenes." }]);
  });

  test("erkennt http(s) und www, Text drumherum bleibt erhalten", () => {
    const parts = linkify("Daten: https://example.com/a?b=1 und www.test.de bitte.");
    expect(parts.map((p) => p.text).join("")).toBe(
      "Daten: https://example.com/a?b=1 und www.test.de bitte.",
    );
    expect(links("Daten: https://example.com/a?b=1 und www.test.de bitte.")).toEqual([
      ["https://example.com/a?b=1", "https://example.com/a?b=1"],
      ["www.test.de", "https://www.test.de"],
    ]);
  });

  test("Satzzeichen und Klammern am Ende gehoeren nicht zur URL", () => {
    expect(links("Siehe (https://example.com/x).")).toEqual([
      ["https://example.com/x", "https://example.com/x"],
    ]);
    expect(links("API: https://api.example.com!")).toEqual([
      ["https://api.example.com", "https://api.example.com"],
    ]);
  });

  test("geklammerte URL-Teile bleiben erhalten", () => {
    expect(links("https://de.wikipedia.org/wiki/Python_(Programmiersprache).")).toEqual([
      [
        "https://de.wikipedia.org/wiki/Python_(Programmiersprache)",
        "https://de.wikipedia.org/wiki/Python_(Programmiersprache)",
      ],
    ]);
  });

  test("andere Schemata werden nie zum Link", () => {
    expect(links("javascript:alert(1) ftp://x.de mailto:a@b.de")).toEqual([]);
  });

  test("Zeilenumbrueche bleiben im Text", () => {
    const parts = linkify("Zeile 1\nhttps://a.de\nZeile 3");
    expect(parts).toEqual([
      { kind: "text", text: "Zeile 1\n" },
      { kind: "link", text: "https://a.de", href: "https://a.de" },
      { kind: "text", text: "\nZeile 3" },
    ]);
  });
});
