/** 32-Bit-Hash eines Strings (FNV-1a). */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Kleiner, deterministischer Zufallsgenerator (mulberry32). */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Zufaellige, aber pro Person stabile Reihenfolge: Jede Person sieht eine eigene Mischung,
 * dieselbe nach jedem Reload. Neu hinzukommende Eintraege verschieben die uebrigen nicht,
 * weil jeder Eintrag seinen Rang allein aus (seed, id) bekommt.
 */
export function stableShuffle<T>(items: readonly T[], seed: string, idOf: (item: T) => string): T[] {
  return items
    .map((item) => ({ item, rank: rng(hash(`${seed}:${idOf(item)}`))() }))
    .sort((a, b) => a.rank - b.rank)
    .map((x) => x.item);
}
