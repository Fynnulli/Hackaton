import { afterAll, beforeAll, expect, test } from "vitest";
import { TestDb } from "./harness";

let db: TestDb;

beforeAll(async () => {
  db = await TestDb.create();
});
afterAll(() => db.close());

/**
 * Supabase laedt fuer API-Aufrufe pg-safeupdate: UPDATE und DELETE ohne WHERE werden
 * abgelehnt. Das eingebettete Test-Postgres kennt die Erweiterung nicht, deshalb pruefen wir
 * den Quelltext aller Funktionen im Endzustand nach allen Migrationen.
 */
test("keine Datenbankfunktion enthaelt UPDATE oder DELETE ohne WHERE", async () => {
  const fns = await db.sql<{ proname: string; prosrc: string }>(
    `select p.proname, p.prosrc from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'`,
  );
  expect(fns.length).toBeGreaterThan(10);

  const offenders: string[] = [];
  for (const { proname, prosrc } of fns) {
    const body = prosrc.replace(/--[^\n]*/g, "");
    for (const m of body.matchAll(/\b(update\s+\w+(?:\.\w+)?\s+set|delete\s+from)\b[\s\S]*?;/gi)) {
      if (!/\bwhere\b/i.test(m[0])) offenders.push(`${proname}: ${m[0].replace(/\s+/g, " ").slice(0, 80)}`);
    }
  }
  expect(offenders).toEqual([]);
});
