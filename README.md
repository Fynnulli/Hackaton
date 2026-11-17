# 3-Stunden-Build

Event-App für einen einmaligen Online-KI-Hackathon: Alle starten gleichzeitig, das Thema wird
in derselben Sekunde enthüllt, drei Stunden bauen, abgeben, abstimmen, Wrapped.

**Stack:** Next.js (App Router, TypeScript) · Tailwind CSS · Framer Motion · Supabase
(Postgres, Auth, Realtime, Storage) · Vercel. Es gibt kein eigenes Backend: Alle Regeln
liegen in Row Level Security und Postgres-Funktionen.

**Live:** https://hackaton-eta-pied.vercel.app · **Wie läuft ein Abend ab?** →
[docs/ablauf.md](docs/ablauf.md) (Vorbereitung, Phasen, Zeitachse, Rollen, Technik, Notfälle
als Diagramme)

## Übergabe (Stand 17.11.2026)

- **Alle 8 Bauphasen sind fertig**, getestet (100 automatische Tests, Lasttest mit 60 Clients) und auf `main` gepusht. Jeder Push
  auf `main` deployt automatisch nach https://hackaton-eta-pied.vercel.app.
- **Supabase-Projekt** `pnarriafiaoriddujmzs`: Alle Migrationen aus `supabase/migrations/`
  sind eingespielt, anonyme Anmeldung ist an, Rate-Limit für anonyme Anmeldungen steht auf 200.
- **Datenbank ist zurückgesetzt:** ein Event mit Code `TEST42` in der Lobby ohne Startzeit,
  Platzhalter-Stufen, ein Teilnehmer „Fynn Ulrich“ (Admin), keine Teams, Abgaben, Stimmen.
  Im Storage liegt noch eine verwaiste Test-Screenshot-Datei (harmlos, im Dashboard löschbar).
- **Was vor dem echten Abend fehlt:** echtes Event mit Code, Zeiten und Thema einrichten
  (Abschnitt „Vom Test zum echten Abend“), Checkliste unten abarbeiten.

**Für einen neuen Chat oder Mitwirkende:** Ablauf und Rollen stehen in
[docs/ablauf.md](docs/ablauf.md). Wichtige Fallstricke:

- Next.js ist Version 16 mit Cache Components: Lies `AGENTS.md` und die Doku unter
  `node_modules/next/dist/docs/`. Client-Komponenten, die die Uhrzeit lesen, dürfen erst nach
  dem Laden der Sitzung rendern, sonst bricht der Prerender (`Date.now()`-Fehler).
- Supabase lehnt bei API-Aufrufen `UPDATE`/`DELETE` ohne `WHERE` ab (`pg-safeupdate`); die
  lokalen Tests sehen das nicht, `tests/db/safeupdate.test.ts` prüft es.
- Neue Migrationen werden direkt auf das Projekt angewendet (Supabase-MCP oder SQL-Editor).
  Der Dateiname in `supabase/migrations/` muss der dort vergebenen Version entsprechen.
  Neue Funktionen brauchen am Ende wieder `revoke`/`grant` (siehe unten).
- Das echte Thema gehört nie ins Repository und nicht in einen Chat.

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

1. **Migrationen einspielen** (für das bestehende Projekt erledigt). Die Dateien in
   `supabase/migrations/` der Reihe nach im SQL-Editor ausführen oder per Supabase-CLI/MCP
   anwenden. Eine GitHub-Integration ist nicht eingerichtet. `supabase/config.toml` setzt nur
   `enable_anonymous_sign_ins = true` für lokale Entwicklung.
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

### Vom Test zum echten Abend

Es gibt immer genau **ein** Event (eine Zeile in `event`); es wird umgestellt, nicht neu
angelegt. Im SQL-Editor, Werte anpassen (geprüft gegen die Migrationen):

```sql
-- 1. Testdaten löschen; Admin-Konten bleiben erhalten
delete from public.vote where true;
delete from public.submission where true;
delete from public.announcement where true;
update public.participant set team_id = null where true;
delete from public.team where true;
delete from auth.users where id in (select id from public.participant where not is_admin);

-- 2. Event umstellen (Code: 4–12 Zeichen, Großbuchstaben/Ziffern; Zeitzone beachten,
--    im Winter +01, im Sommer +02)
update public.event set
  join_code     = 'DEINCODE',
  phase         = 'lobby',
  starts_at     = '2026-12-01 19:00:00+01',
  build_ends_at = '2026-12-01 22:00:00+01',   -- Start + 3 Stunden
  twist_at      = '2026-12-01 20:30:00+01',   -- Minute 90
  wrapped_slide = 0
where true;

-- 3. Thema eintragen (erst nach Schritt 2: die Freigabezeiten kommen aus dem Event)
delete from public.challenge_stage where true;
insert into public.challenge_stage (stage_no, title, body) values
  (1, 'DAS THEMA',      'Grundaufgabe'),   -- Titel von Stufe 1 = Thema der Enthüllung
  (2, 'Titel Stufe 2',  'Erweiterung'),
  (3, 'Titel Twist',    'Der Twist');
```

Danach: Event-Daten auf `/admin` unter „Stand“ prüfen. Das Thema ist bis `starts_at` für
niemanden lesbar, auch nicht für Admins; zum Prüfen also nur im SQL-Editor ansehen.
Einladungslink: `https://hackaton-eta-pied.vercel.app/?code=DEINCODE`.

Neues, leeres Supabase-Projekt: nach den Migrationen einmal `supabase/seed.sql` ausführen
(legt das Event `TEST42` mit Platzhalter-Stufen an), danach wie oben umstellen.

Weitere Admins: beitreten lassen, dann
`update public.participant set is_admin = true where display_name = 'NAME';`

## Deployment (Vercel)

- Projekt `hackaton` im Vercel-Team `bookshelf2`, verbunden mit diesem GitHub-Repo; jeder
  Push auf `main` deployt automatisch.
- Öffentliche Adresse: **https://hackaton-eta-pied.vercel.app**. Die Adresse
  `hackaton-bookshelf2.vercel.app` ist durch Vercels Deployment-Schutz gesperrt, nicht
  weitergeben.
- Umgebungsvariablen in Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Hobby-Plan nur für nicht kommerzielle Nutzung; für ein Firmen-Event den Pro-Plan nehmen.
- Der Debug-Zugriff `window.__dsb` (für Abbruch-Tests) ist im Produktions-Build nicht enthalten.

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
- **Ticker, Admin-Funktionen** (`tests/db/announcement.test.ts`, `tests/db/admin.test.ts`).
- **pg-safeupdate** (`tests/db/safeupdate.test.ts`): keine Funktion mit `UPDATE`/`DELETE`
  ohne `WHERE`.
- **Reine Logik** (`tests/unit/`): Serverzeit-Versatz, Bildschirmwahl, Timerfarben,
  Formularprüfung, Galerie-Mischung, Wrapped-Auswertung.

Weitere Prüfungen: `npm run typecheck`, `npm run lint`, `npm run build`.

Gleichzeitige Zugriffe und das Zusammenspiel mit dem echten Projekt prüft der Lasttest
(Abschnitt „Lasttest / Generalprobe“).

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
Verbinden noch einmal frisch nach (`src/lib/realtime.ts`). Zweiter Lauf mit 5 s Anlaufzeit: keine Fehler,
Zeitplan-Änderung bei allen 60 nach 0,42 s.

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
- [ ] Testdaten entfernt, Event mit richtigem Code, Zeiten und Thema umgestellt (Abschnitt
      „Vom Test zum echten Abend“)
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
