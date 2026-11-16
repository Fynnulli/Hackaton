import { describe, expect, test } from "vitest";
import { EMPTY_DRAFT, normalizeUrl, validateDraft } from "../../src/lib/submission-form";

describe("Link normalisieren", () => {
  test("ergaenzt https:// bei nackter Domain", () => {
    expect(normalizeUrl("mein-projekt.vercel.app")).toBe("https://mein-projekt.vercel.app");
    expect(normalizeUrl("  //foo.dev/x ")).toBe("https://foo.dev/x");
  });
  test("laesst http(s) und fremde Schemata unangetastet", () => {
    expect(normalizeUrl("http://a.de")).toBe("http://a.de");
    expect(normalizeUrl("HTTPS://A.DE")).toBe("HTTPS://A.DE");
    expect(normalizeUrl("javascript:alert(1)")).toBe("javascript:alert(1)");
    expect(normalizeUrl("")).toBe("");
  });
});

describe("Formularpruefung", () => {
  const ok = { ...EMPTY_DRAFT, title: "Projekt", url: "projekt.dev" };
  test("gueltige Abgabe", () => expect(validateDraft(ok)).toBeNull());
  test("Titel Pflicht, max. 80", () => {
    expect(validateDraft({ ...ok, title: "  " })).toBe("invalid_title");
    expect(validateDraft({ ...ok, title: "x".repeat(81) })).toBe("invalid_title");
  });
  test("Link Pflicht und http(s)", () => {
    expect(validateDraft({ ...ok, url: "" })).toBe("invalid_url");
    expect(validateDraft({ ...ok, url: "javascript:alert(1)" })).toBe("invalid_url");
    expect(validateDraft({ ...ok, url: "nurwort" })).toBe("invalid_url");
  });
  test("Beschreibung max. 300", () => {
    expect(validateDraft({ ...ok, description: "x".repeat(300) })).toBeNull();
    expect(validateDraft({ ...ok, description: "x".repeat(301) })).toBe("invalid_description");
  });
});
