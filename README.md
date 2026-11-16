# 3-Stunden-Build

Event-App für einen einmaligen Online-KI-Hackathon: Alle starten gleichzeitig, das Thema wird
in derselben Sekunde enthüllt, drei Stunden bauen, abgeben, abstimmen, Wrapped.

**Stack:** Next.js (App Router, TypeScript) · Tailwind CSS · Framer Motion · Supabase
(Postgres, Auth, Realtime, Storage) · Vercel. Es gibt kein eigenes Backend: Alle Regeln
liegen in Row Level Security und Postgres-Funktionen.

## Stand

| Phase | Inhalt | Status |
| --- | --- | --- |
| 1 | Gerüst, Schema mit RLS, Seed, Login mit Beitrittscode, Teams, Wiedereinstieg | fertig |
| 2 | Lobby, Countdown mit Serverzeit, Enthüllung | offen |
| 3 | Bauphase mit Timer, Stufen, Ticker, Twist | offen |
| 4 | Abgabe mit Upload | offen (Serverlogik steht) |
| 5 | Galerie und Voting | offen (Serverlogik steht) |
| 6 | Admin-Seite und Testmodus | offen (Serverlogik teilweise) |
| 7 | Wrapped und Siegerehrung | offen |
| 8 | Härtung: Lasttest, Reconnect, mobil | offen |

## Setup

Voraussetzung: Node.js 22.

```bash
npm install
```

```bash
cp .env.example .env.local
```

`.env.local` ausfüllen (siehe unten), dann:

```bash
npm run dev
```

### Umgebungsvariablen

| Variable | Bedeutung |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL des Supabase-Projekts (`https://….supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Öffentlicher Schlüssel (anon oder publishable). Alternativ wird `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` gelesen. |

Beide stehen im Supabase-Dashboard unter *Project Settings → API* und müssen genauso in
Vercel (*Settings → Environment Variables*) gesetzt sein. Der `service_role`-Key wird
nirgends gebraucht und gehört nicht in dieses Projekt.

### Supabase einrichten

1. **Migration einspielen.** Die Migrationen liegen in `supabase/migrations/` und werden über
   die GitHub-Integration von Supabase übernommen. Alternativ den Inhalt der Datei im
   SQL-Editor ausführen.
2. **Anonyme Anmeldung aktivieren:** *Authentication → Sign In / Providers → Allow anonymous
   sign-ins*. Ohne diesen Schalter kann niemand beitreten.
3. **Rate-Limit anheben:** *Authentication → Rate Limits → Anonymous sign-ins*. Der Standard
   (30 pro Stunde und IP) reicht für verteilte Teilnehmer, aber nicht für Lasttests oder
   viele Leute im selben Netz. Empfehlung: 200.
4. **Event anlegen** (siehe nächster Abschnitt).
5. **Admin setzen:** einmal normal mit dem Beitrittscode beitreten, dann im SQL-Editor:

   ```sql
   update public.participant set is_admin = true where display_name = 'DEIN NAME';
   ```

### Event anlegen

Zum Ausprobieren genügt `supabase/seed.sql` (Beitrittscode `TEST42`, Platzhalter-Thema):
Inhalt in den SQL-Editor kopieren und ausführen.

Für den echten Abend das Event direkt im SQL-Editor anlegen. **Das echte Thema gehört nie
ins Repository**, sonst ist es vor dem Start auffindbar.

```sql
insert into public.event (join_code, starts_at, build_ends_at, twist_at) values (
  'DEINCODE',                      -- 4 bis 12 Zeichen, Großbuchstaben und Ziffern
  '2026-12-01 19:00:00+01',        -- Start
  '2026-12-01 22:00:00+01',        -- Ende der Bauzeit
  '2026-12-01 20:30:00+01'         -- Twist (Minute 90)
);

insert into public.challenge_stage (stage_no, title, body) values
  (1, 'Titel Stufe 1', 'Text Stufe 1'),
  (2, 'Titel Stufe 2', 'Text Stufe 2'),
  (3, 'Titel Twist',   'Text Twist');
```

Es kann immer nur ein Event geben. Einladungslink für Teilnehmer:
`https://DEINE-DOMAIN/?code=DEINCODE`.

## Tests

```bash
npm test
```

Die Tests laden die echten Migrationen in ein eingebettetes Postgres (PGlite, kein Docker
nötig) und prüfen die kritischen Regeln so, wie ein angemeldeter Client sie erleben würde:

- **Geheimhaltung** (`tests/db/secrecy.test.ts`): Stufen sind vor `reveal_at` für niemanden
  lesbar, auch nicht für Admins; Tokens und Teamcodes sind nicht auslesbar.
- **Zeitsperre** (`tests/db/submission.test.ts`): Abgabe nur bei offener Bauzeit, kein Weg
  über direkten Tabellenzugriff.
- **Stimmenlimit** (`tests/db/voting.test.ts`): drei Stimmen, eine pro Abgabe, keine fürs
  eigene Team, Stände erst im Wrapped.
- **Beitritt, Teams, Wiedereinstieg** (`tests/db/join.test.ts`).

Weitere Prüfungen: `npm run typecheck`, `npm run lint`, `npm run build`.

Nicht abgedeckt: gleichzeitige Zugriffe (die Sperren dafür sind im SQL, ein Lasttest folgt in
Phase 8) und das Zusammenspiel mit dem echten Supabase-Projekt.

## Architektur in Kürze

- **Nur lesen per Tabelle, schreiben per RPC.** Clients haben auf allen Tabellen
  ausschließlich `SELECT` (durch RLS begrenzt). Jede Änderung läuft über eine
  `SECURITY DEFINER`-Funktion, die Phase, Zeit und Limits selbst prüft.
- **Die Datenbankzeit entscheidet.** Die Bauphase beginnt automatisch mit `event.starts_at`
  (`effective_phase()`), die Abgabe schließt automatisch mit `build_ends_at`
  (`is_build_open()`), auch wenn niemand eine Phase umschaltet. Galerie, Wrapped und Archiv
  schaltet der Admin.
- **Geheimhaltung.** `challenge_stage.reveal_at` wird per Trigger aus `starts_at` (Stufe 1
  und 2) bzw. `twist_at` (Stufe 3) abgeleitet. Die RLS-Policy gibt eine Stufe erst frei, wenn
  `reveal_at` erreicht ist. Der Thementext existiert nur in der Datenbank.
- **Sitzung.** Supabase Anonymous Sign-in, gespeichert im Browser. Der persönliche Link
  (`/r#<token>`) überträgt die Teilnahme samt Team und Stimmen auf ein anderes Gerät; der
  Token steht im URL-Fragment und erreicht damit keinen Server-Log.
- **Aktualität.** Der Client lädt seinen Zustand alle 15 Sekunden, bei Rückkehr in den Tab
  und bei wiederhergestellter Verbindung frisch. Realtime kommt in Phase 2 dazu.

Neue Funktionen in späteren Migrationen brauchen am Ende wieder:

```sql
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
```

## Checkliste für den Eventabend

Wird mit jeder Bauphase ergänzt.

**Am Vortag**

- [ ] Migrationen sind im Produktivprojekt angekommen (Tabellen `event`, `participant`, …
      vorhanden)
- [ ] Anonyme Anmeldung ist aktiv, Rate-Limit ist angehoben
- [ ] Umgebungsvariablen in Vercel gesetzt, aktueller Stand ist deployt
- [ ] Testdaten entfernt, echtes Event mit richtigem Code und richtigen Zeiten angelegt
- [ ] Thema und Twist stehen in `challenge_stage` (und nirgends sonst)
- [ ] Admin-Konto ist gesetzt und auf einem zweiten Gerät per persönlichem Link erreichbar
- [ ] Einmal mit einem privaten Browserfenster beitreten, Team gründen, wieder löschen

**Eine Stunde vorher**

- [ ] Einladungslink mit `?code=` verschickt
- [ ] Startzeit in `event.starts_at` stimmt (Zeitzone prüfen)
- [ ] Supabase-Dashboard und SQL-Editor in einem Tab offen

**Notfälle**

- Jemand kommt nicht mehr rein: neu beitreten lassen. Falls die Person schon in einem Team
  war, im SQL-Editor `update public.participant set team_id = '<team>' where id = '<neu>'`.
- Bauzeit verlängern (bis es in Phase 6 einen Knopf gibt), im SQL-Editor:
  `update public.event set build_ends_at = build_ends_at + interval '10 minutes';`
