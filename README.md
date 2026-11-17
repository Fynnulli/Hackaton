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
| 2 | Lobby, Countdown mit Serverzeit, Enthüllung, Realtime | fertig |
| 3 | Bauphase mit Timer, Stufen, Ticker, Twist | fertig |
| 4 | Abgabe mit Upload | fertig |
| 5 | Galerie und Voting | fertig |
| 6 | Admin-Seite und Testmodus | fertig |
| 7 | Wrapped und Siegerehrung | fertig |
| 8 | Härtung: Lasttest, Reconnect, mobil | fertig |

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
- **Serverzeit.** Beim Laden misst der Client per `server_time()` fünfmal den Versatz zur
  Browseruhr (die Messung mit der kürzesten Laufzeit zählt) und justiert jede Minute, bei
  Rückkehr in den Tab und bei wiederhergestellter Verbindung nach. Alle Countdowns und die
  Phasenableitung rechnen mit dieser Zeit (`src/lib/server-clock.tsx`).
- **Aktualität.** Ein Realtime-Kanal auf `event` und `participant` löst bei jeder Änderung ein
  frisches Laden aus. Bricht er ab, wird mit Backoff (1, 2, 5, 10 s) neu verbunden und danach
  frisch geladen. Unabhängig davon lädt der Client alle 15 Sekunden, bei Rückkehr in den Tab
  und bei wiederhergestellter Verbindung. Der Punkt neben dem Logo zeigt den Realtime-Status.
- **Enthüllung.** Die zehnsekündige Animation ist eine reine Funktion von
  `Serverzeit − starts_at`: Alle Geräte zeigen dasselbe Bild, ein Reload setzt an der
  richtigen Stelle fort. Wer später kommt, sieht eine Kurzfassung (2,4 s). Das Thema wird erst
  ab `reveal_at` aus der Datenbank geholt; der **Titel von Stufe 1 ist das Thema**.
- **Bauphase.** Der Timer steht immer sichtbar in der Kopfzeile und wechselt die Farbe bei
  30 (gelb), 10 (orange) und 1 Minute (rot) Restzeit. Zum Twist-Zeitpunkt lädt der Client
  gezielt nach, Stufe 3 erscheint live mit kurzem Vollbild-Auftritt. Wer die Seite erst danach
  öffnet, sieht den Twist ohne Auftritt.
- **Abgabe** (`/abgabe`). Titel, Link (ohne `https://` wird es ergänzt), Beschreibung bis
  300 Zeichen, optionaler Screenshot und erreichte Stufen; Stufe 3 erst nach dem Twist.
  Screenshots werden im Browser auf höchstens 1600 px verkleinert und als WebP hochgeladen
  (Ziehen, Einfügen oder Auswählen), Pfad `<team_id>/<uuid>.webp`. Fremde Screenshots sind
  erst ab der Galerie auflistbar. Ungespeicherte Eingaben überstehen einen Reload, speichert
  ein Teammitglied parallel, bietet das Formular an, dessen Stand zu übernehmen. Zum Ende der
  Bauzeit wird das Formular zur Nur-Lese-Ansicht; verbindlich sperrt die Datenbank.
- **Galerie.** In der Phase `gallery` sehen alle die nicht ausgeblendeten Abgaben, pro Person
  zufällig, aber stabil gemischt (Seed = Teilnehmer-ID, ein Reload ändert nichts). Drei
  Stimmen, eine pro Abgabe, keine fürs eigene Team, zurücknehmbar. Stimmen erscheinen sofort
  und werden bei einem Fehler zurückgenommen; verbindlich zählt die Datenbank. Stände gibt es
  erst im Wrapped. In `closed` dient dieselbe Ansicht ohne Abstimmung als Archiv.
- **Wrapped.** Neun Folien im Vollbild: Intro, Zahlen, schnellste Abgabe, letzte Sekunde
  (letzte Speicherung vor dem Ende), Stufen-Verteilung, Platz 3, 2, 1 (mit Konfetti), dann
  die persönliche Karte jeder Person (Team, Platz, Punkte, erhaltene Stimmen, Stufen). Die
  Folie bestimmt allein `event.wrapped_slide`; Admins schalten auf `/admin` oder direkt im
  Wrapped mit Pfeiltasten/Leertaste, alle Geräte folgen per Realtime. Auswertung in
  `src/lib/wrapped.ts`, Wertung aus `get_leaderboard()`.
- **Ticker.** Durchsagen (`admin_post_announcement`) und automatische Ereignisse („Team X hat
  abgegeben“) kommen per eigenem Realtime-Kanal auf `announcement`, Polling als Rückfall.

Neue Funktionen in späteren Migrationen brauchen am Ende wieder:

```sql
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
```

### Admin-Seite (`/admin`)

Nur für Teilnehmende mit `is_admin` (siehe „Admin setzen“); in der Kopfzeile erscheint dann
ein Link „Admin“. Alle Aktionen laufen über die Admin-RPCs, die Datenbank prüft die Rechte.

- **Stand:** Phase, Serverzeit, Zeitplan, Beitrittscode, Zähler.
- **Phase:** Knöpfe für alle fünf Phasen, jeweils mit Bestätigung (zweimal klicken).
  „Bauphase“ startet sofort, falls keine Startzeit gesetzt ist; „Lobby“ setzt eine bereits
  erreichte Startzeit zurück.
- **Zeitplan:** Start, Bauzeit, Twist-Minute; Schnellstart in 1, 5 oder 10 Minuten.
- **Bauzeit verlängern:** +5, +10, +15 Minuten (öffnet die Abgabe auch wieder).
- **Durchsage:** frei oder als Vorlage, erscheint sofort im Ticker.
- **Abgaben:** Liste mit Platz, Stimmen und Punkten (nur für Admins vorab sichtbar).
  Ausblenden nimmt eine Abgabe aus Galerie und Wertung und gibt die Stimmen dafür frei.
- **Abgabe nachtragen:** für ein Team, ohne Zeitsperre.
- **Wrapped:** Folien vor und zurück, alle Bildschirme folgen synchron.
- **Testmodus:** Lobby, Start in 30 Sekunden, kurze Bauzeit, Twist zur Hälfte. Teilnehmer,
  Teams, Abgaben und Stimmen bleiben erhalten.

**Wichtig für neue Migrationen:** Supabase lehnt bei API-Aufrufen jedes `UPDATE`/`DELETE`
ohne `WHERE` ab (`pg-safeupdate`). Auch bei der einen Event-Zeile deshalb `where true` bzw.
`where id = …` schreiben. `tests/db/safeupdate.test.ts` prüft das für alle Funktionen.

## Lasttest / Generalprobe

```bash
node --env-file=.env.local scripts/load-test.mjs --clients 60 --code TEST42
```

Simuliert N Teilnehmende mit dem öffentlichen Schlüssel: Beitritt, Teams zu dritt,
Realtime-Abos, Enthüllung (alle fragen gleichzeitig nach dem Thema), parallele Abgaben,
Durchsage, Abstimmen mit absichtlich 5 gleichzeitigen Stimmen pro Person, Wrapped. Der erste
Client wird Admin (das Skript gibt den SQL-Befehl aus und wartet). **Verändert das Event**,
nur gegen Testdaten laufen lassen; den Aufräum-Befehl gibt das Skript am Ende aus.
Voraussetzung: Rate-Limit für anonyme Anmeldungen mindestens so hoch wie `--clients`.

Ergebnis mit 60 Clients (17.11.2026, Free-Projekt, ein Rechner):

| Messung | p50 | p95 |
| --- | --- | --- |
| Anmeldung + Beitritt | 0,1 s + 0,1 s | 0,4 s + 0,5 s |
| Thema nach dem Start bei allen da | 0,43 s | 0,44 s |
| Realtime: Durchsage / Phase / Folie bei allen 60 | 0,2 / 0,65 / 0,64 s | 0,24 / 0,66 / 0,65 s |
| Stimme (300 gleichzeitige Anfragen) | 1,3 s | 1,6 s |

Stimmenlimit gehalten (180 neue Stimmen bei 60 Personen), Geheimhaltung gehalten (Thema vor
dem Start und Twist vor `twist_at` nicht lesbar). Befund: Direkt nach dem Verbinden stellt
Realtime unter Last noch nicht alle Änderungen zu; die App lädt deshalb 3 Sekunden nach dem
Verbinden noch einmal frisch nach (`src/lib/realtime.ts`).

**Abbruch-Tests** (im Browser, Dev-Modus, `window.__dsb` ist der Supabase-Client):
`__dsb.realtime.disconnect()` → nach ca. 1 s wieder verbunden, Verpasstes nachgeladen.
Realtime dauerhaft blockiert → das Polling (15 s) hält den Stand aktuell; sobald Realtime
wieder geht, verbindet der Backoff (1, 2, 5, 10 s) von selbst neu.

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
- [ ] Einen Testlauf über den Testmodus auf `/admin` durchspielen, danach Testdaten löschen
- [ ] Optional: Generalprobe mit `scripts/load-test.mjs` (siehe oben), danach aufräumen

**Eine Stunde vorher**

- [ ] Einladungslink mit `?code=` verschickt
- [ ] Startzeit in `event.starts_at` stimmt (Zeitzone prüfen), der Countdown in der Lobby
      zeigt die erwartete Restzeit
- [ ] Punkt neben dem Logo leuchtet grün (Realtime verbunden)
- [ ] `/admin` auf dem Leitungsgerät offen, Supabase-Dashboard und SQL-Editor als Rückfall

**Notfälle**

- Jemand kommt nicht mehr rein: neu beitreten lassen. Falls die Person schon in einem Team
  war, im SQL-Editor `update public.participant set team_id = '<team>' where id = '<neu>'`.
- Bauzeit verlängern: auf `/admin` unter „Bauzeit verlängern“. Fällt die Admin-Seite aus,
  im SQL-Editor: `update public.event set build_ends_at = build_ends_at + interval '10 minutes';`
