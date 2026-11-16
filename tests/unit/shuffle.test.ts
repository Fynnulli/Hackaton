import { describe, expect, test } from "vitest";
import { stableShuffle } from "../../src/lib/shuffle";

const ids = Array.from({ length: 20 }, (_, i) => `sub-${i}`);
const id = (x: string) => x;

describe("Galerie-Reihenfolge", () => {
  test("gleiche Person, gleiche Reihenfolge (Reload)", () => {
    expect(stableShuffle(ids, "person-a", id)).toEqual(stableShuffle(ids, "person-a", id));
  });

  test("verschiedene Personen sehen verschiedene Reihenfolgen", () => {
    expect(stableShuffle(ids, "person-a", id)).not.toEqual(stableShuffle(ids, "person-b", id));
  });

  test("alle Eintraege bleiben erhalten", () => {
    expect([...stableShuffle(ids, "x", id)].sort()).toEqual([...ids].sort());
  });

  test("ein neuer Eintrag aendert die relative Reihenfolge der anderen nicht", () => {
    const before = stableShuffle(ids, "person-a", id);
    const after = stableShuffle([...ids, "sub-neu"], "person-a", id).filter((x) => x !== "sub-neu");
    expect(after).toEqual(before);
  });

  test("ist tatsaechlich gemischt", () => {
    expect(stableShuffle(ids, "person-a", id)).not.toEqual(ids);
  });
});
