# So läuft ein Abend mit 3h/Build

Diese Seite erklärt den Ablauf von der Vorbereitung bis zum Archiv: was du als Event-Leitung
wann tust, was die Teilnehmenden sehen und was die Technik im Hintergrund macht. Die
Diagramme rendert GitHub direkt; lokal zeigt sie z. B. die Markdown-Vorschau von VS Code mit
Mermaid-Erweiterung.

**Inhalt**

1. [Die Vorbereitung](#1-die-vorbereitung)
2. [Der Abend auf einen Blick](#2-der-abend-auf-einen-blick)
3. [Die fünf Phasen](#3-die-fünf-phasen)
4. [Die drei Stunden Bauzeit](#4-die-drei-stunden-bauzeit)
5. [Wer macht was: Leitung und Teilnehmende](#5-wer-macht-was-leitung-und-teilnehmende)
6. [Wie die Technik zusammenspielt](#6-wie-die-technik-zusammenspielt)
7. [Was passiert, wenn etwas schiefgeht](#7-was-passiert-wenn-etwas-schiefgeht)

---

## 1. Die Vorbereitung

Alles, was vor dem Abend passieren muss, in der Reihenfolge, in der es Sinn ergibt.

```mermaid
flowchart TD
    subgraph Einmalig["Einmalig (erledigt)"]
        A1[Supabase-Projekt mit Migrationen] --> A2[Anonyme Anmeldung an,<br/>Rate-Limit auf 200]
        A2 --> A3[Vercel-Deployment<br/>hackaton-eta-pied.vercel.app]
    end

    subgraph Vortag["Am Vortag"]
        B1[Testdaten löschen] --> B2[Event umstellen:<br/>Code + Zeiten]
        B2 --> B3[Thema und Twist<br/>im SQL-Editor eintragen]
        B3 --> B3b[Optional: Material hochladen<br/>Bucket material, Ordner 1/ 2/ 3/]
        B3b --> B4[Selbst beitreten,<br/>per SQL zum Admin machen]
        B4 --> B5[Admin-Link auf zweitem<br/>Gerät sichern]
        B5 --> B6[Optional: Generalprobe<br/>mit Testmodus oder Lasttest]
    end

    subgraph Stunde["Eine Stunde vorher"]
        C1[Einladungslink verschicken<br/>/?code=DEINCODE] --> C2[Countdown in der Lobby prüfen]
        C2 --> C3["/admin offen, grüner Punkt<br/>(Realtime verbunden)"]
    end

    Einmalig --> Vortag --> Stunde
```

**Warum das Thema nur in die Datenbank darf:** Die Stufen liegen in `challenge_stage` und
sind per Row Level Security erst ab ihrer Freigabezeit lesbar. Stünde das Thema im Code, im
Repository oder in einer Nachricht, wäre es vorher auffindbar.

Das echte Event stellst du im SQL-Editor um: Es gibt immer genau ein Event, es wird nicht
neu angelegt. Den geprüften SQL-Block (Testdaten löschen, Event umstellen, Thema eintragen)
findest du in der [README unter „Vom Test zum echten Abend“](../README.md#vom-test-zum-echten-abend).

Der **Titel von Stufe 1 ist das Thema**, das bei der Enthüllung groß erscheint. Wie Titel
und Texte wirken, zeigt `/admin` unter „Vorschau“, ohne etwas zu speichern.

**Material** (PDF, CSV, ZIP bis 50 MB) lädst du im Supabase-Dashboard in den privaten Bucket
`material`, Ordner = Stufennummer (`1/briefing.pdf`, `3/neue-daten.csv`). Die Dateien
erscheinen als Download-Knöpfe in der Stufenkarte, aber erst mit ihrer Stufe: Stufe 1 und 2
zum Start, Stufe 3 mit dem Twist. Vorher sind sie für niemanden abrufbar.

---

## 2. Der Abend auf einen Blick

```mermaid
flowchart LR
    L["Lobby<br/>ankommen, Teams bilden,<br/>Countdown"] -->|"starts_at erreicht<br/>(automatisch)"| R["Enthüllung<br/>10 Sekunden,<br/>alle gleichzeitig"]
    R --> B["Bauphase<br/>3 Stunden,<br/>Twist nach 90 Min"]
    B -->|"build_ends_at<br/>(Abgabe sperrt automatisch)"| Z["Zeit um"]
    Z -->|"Leitung schaltet"| G["Galerie<br/>3 Stimmen pro Person"]
    G -->|"Leitung schaltet"| W["Wrapped<br/>Folien, Siegerehrung"]
    W -->|"Leitung schaltet"| C["Archiv<br/>alle Projekte"]

    style R fill:#c8ff2e,color:#07080a
    style W fill:#c8ff2e,color:#07080a
```

Zwei Dinge passieren **von selbst**, gesteuert allein von der Datenbankzeit: Der Start (und
damit die Enthüllung) und das Ende der Abgabe. Alles danach schaltest du auf `/admin`.

---

## 3. Die fünf Phasen

Das Event hat genau eine gespeicherte Phase (`event.phase`). Die App leitet daraus und aus
den Zeiten ab, was gerade gilt.

```mermaid
stateDiagram-v2
    [*] --> lobby
    lobby --> build: starts_at erreicht (automatisch)<br/>oder Admin klickt "Bauphase" (Sofortstart)
    build --> gallery: Admin
    gallery --> wrapped: Admin
    wrapped --> closed: Admin
    build --> lobby: Admin (setzt Startzeit zurück)
    gallery --> build: Admin (z. B. nach Verlängerung)

    state lobby {
        direction LR
        [*] --> Beitreten
        Beitreten --> TeamWahl: Code + Name + Avatar
        TeamWahl --> Warten: Team gründen / beitreten
    }
    state build {
        direction LR
        [*] --> Enthuellung: 0 bis 10 s
        Enthuellung --> Bauen
        Bauen --> Twist: twist_at
        Twist --> Abgabe_zu: build_ends_at
    }
```

Was in welcher Phase erlaubt ist, prüft **die Datenbank**, nicht die Oberfläche:

| | Lobby | Bauphase | Galerie | Wrapped | Archiv |
| --- | :---: | :---: | :---: | :---: | :---: |
| Beitreten | ✓ | ✓ | ✓ | ✓ | – |
| Team gründen / beitreten | ✓ | nur ohne Team | – | – | – |
| Team verlassen | ✓ | – | – | – | – |
| Thema lesen | – | ab `starts_at` | ✓ | ✓ | ✓ |
| Twist lesen | – | ab `twist_at` | ✓ | ✓ | ✓ |
| Material laden | – | mit seiner Stufe | ✓ | ✓ | ✓ |
| Abgeben / ändern | – | bis `build_ends_at` | – | – | – |
| Fremde Abgaben sehen | – | – | ✓ | ✓ | ✓ |
| Abstimmen (mit Team) | – | – | ✓ | – | – |
| Stimmenstände sehen | – | – | – | ✓ | ✓ |

---

## 4. Die drei Stunden Bauzeit

```mermaid
gantt
    title Bauphase (Beispiel: Start 19:00)
    dateFormat HH:mm
    axisFormat %H:%M

    section Bühne
    Enthüllung (10 s)          :milestone, m1, 19:00, 0m
    Twist wird enthüllt        :milestone, m2, 20:30, 0m
    Abgabe sperrt              :milestone, m3, 22:00, 0m

    section Stufen
    Stufe 1 und 2 sichtbar     :active, s1, 19:00, 180m
    Stufe 3 (Twist) sichtbar   :crit, s3, 20:30, 90m

    section Timerfarbe
    neon                       :t1, 19:00, 150m
    gelb (unter 30 Min)        :t2, 21:30, 20m
    orange (unter 10 Min)      :t3, 21:50, 9m
    rot (letzte Minute)        :crit, t4, 21:59, 1m

    section Abgabe
    offen, beliebig oft änderbar :a1, 19:00, 180m
```

- Die **Enthüllung** ist eine reine Funktion von *Serverzeit minus `starts_at`*: Alle Geräte
  zeigen dasselbe Bild, ein Reload mittendrin setzt an der richtigen Stelle fort. Wer später
  kommt, sieht eine Kurzfassung.
- Zum **Twist** fragt jedes Gerät gezielt zur richtigen Sekunde nach; Stufe 3 erscheint mit
  einem kurzen Vollbild-Auftritt.
- **Verlängern** auf `/admin` (+5/+10/+15 Min) verschiebt nur `build_ends_at` und öffnet die
  Abgabe notfalls wieder.

---

## 5. Wer macht was: Leitung und Teilnehmende

```mermaid
sequenceDiagram
    autonumber
    actor L as Leitung (/admin)
    participant DB as Supabase
    actor T as Teilnehmende

    Note over L,T: Lobby
    T->>DB: Einladungslink öffnen, Code + Name + Avatar
    T->>DB: Team gründen oder mit Teamcode beitreten
    DB-->>T: Avatare und Teams erscheinen live bei allen
    L->>DB: (optional) Durchsage "Gleich geht's los"

    Note over L,T: Start: starts_at erreicht
    DB-->>T: Countdown 0 → Enthüllung, Thema mit Stufe 1 + 2
    L->>DB: Durchsagen ("Noch 30 Minuten!")
    DB-->>T: erscheinen sofort im Ticker
    T->>DB: Abgabe: Titel, Link, Beschreibung, Screenshot, Stufen
    DB-->>T: Ticker: "Team X hat abgegeben"
    Note over DB,T: Minute 90: Twist (Stufe 3) erscheint bei allen

    Note over L,T: build_ends_at: Abgabe sperrt automatisch
    L->>DB: Phase "Galerie"
    DB-->>T: Galerie, zufällig sortiert, 3 Stimmen
    T->>DB: abstimmen (nicht fürs eigene Team)

    L->>DB: Phase "Wrapped"
    loop Folie für Folie (Pfeiltasten oder /admin)
        L->>DB: nächste Folie
        DB-->>T: alle springen synchron mit
    end
    Note over T: Zahlen, schnellste Abgabe, letzte Sekunde,<br/>Stufen, Platz 3-2-1, persönliche Karte
    L->>DB: Phase "Archiv"
```

**Die Wrapped-Folien** in Reihenfolge: Intro → Zahlen → schnellste Abgabe → letzte Sekunde
→ Stufen → Platz 3 → Platz 2 → Platz 1 (Konfetti) → persönliche Karte.

**Punkte:** Stufe 1 = 10, Stufe 2 = 10, Stufe 3 = 15 (Selbstauskunft), jede erhaltene
Stimme = 5. Bei Gleichstand gewinnt die frühere Abgabe.

---

## 6. Wie die Technik zusammenspielt

```mermaid
flowchart LR
    subgraph Browser["Browser jedes Teilnehmenden"]
        UI["Next.js-App<br/>(React, Tailwind, Framer Motion)"]
        Clock["Serverzeit-Uhr<br/>misst Versatz zur DB"]
        Poll["Polling alle 15 s<br/>(Rückfall)"]
    end

    Vercel["Vercel<br/>liefert nur HTML/JS aus"]

    subgraph Supabase
        Auth["Auth<br/>anonyme Anmeldung"]
        Tables[("Postgres-Tabellen<br/>nur lesen, per RLS begrenzt")]
        RPC["RPC-Funktionen<br/>alle Änderungen + Prüfungen"]
        RT["Realtime<br/>event, participant,<br/>announcement"]
        Store["Storage<br/>Screenshots, Material"]
    end

    Vercel -->|einmal beim Laden| UI
    UI --> Auth
    UI -->|lesen| Tables
    UI -->|schreiben: beitreten,<br/>abgeben, abstimmen, Admin| RPC
    RPC --> Tables
    Tables -->|Änderung| RT
    RT -->|"Stups: neu laden"| UI
    Poll --> Tables
    Clock -->|server_time| RPC
    UI -->|Upload in eigenen Team-Ordner| Store
```

Die wichtigsten Ideen:

- **Kein eigener Server.** Vercel liefert nur die Oberfläche aus. Alle Regeln (Zeitsperre,
  Stimmenlimit, Geheimhaltung, Admin-Rechte) stehen in der Datenbank: Lesen ist per Row Level
  Security begrenzt, Schreiben geht ausschließlich über geprüfte Funktionen.
- **Die Datenbankzeit entscheidet.** Jedes Gerät misst beim Laden und dann minütlich, wie weit
  seine Uhr von der Datenbank abweicht. Countdown, Enthüllung und Timer rechnen damit; eine
  falsch gestellte Handyuhr ändert nichts.
- **Realtime ist nur ein Stups.** Kommt eine Änderung, lädt die App den Stand frisch, statt die
  Nachricht selbst auszuwerten. So kann nichts auseinanderlaufen.

---

## 7. Was passiert, wenn etwas schiefgeht

```mermaid
flowchart TD
    P1{{"Realtime bricht ab"}} --> S1["App verbindet neu<br/>(1, 2, 5, 10 s) und lädt nach"]
    P1 --> S1b["Polling alle 15 s<br/>hält den Stand trotzdem aktuell"]

    P2{{"Jemand lädt neu oder<br/>wechselt das Gerät"}} --> S2["Sitzung bleibt im Browser.<br/>Gerätewechsel: persönlicher Link /r#…"]

    P3{{"Gerät kommt zu spät"}} --> S3["Kurz-Enthüllung,<br/>dann direkt in die Bauphase"]

    P4{{"Team braucht mehr Zeit"}} --> S4["/admin: Bauzeit +5/+10/+15 Min"]

    P5{{"Abgabe nach Ablauf"}} --> S5["/admin: Abgabe nachtragen<br/>(ohne Zeitsperre)"]

    P6{{"Unpassende Abgabe"}} --> S6["/admin: Ausblenden.<br/>Stimmen dafür werden wieder frei"]

    P7{{"Admin-Seite nicht erreichbar"}} --> S7["SQL-Editor als Rückfall<br/>(Befehle in der README)"]
```

Geprüft im Lasttest mit 60 gleichzeitigen Clients: Thema nach 0,35 s bei allen, Realtime-
Nachrichten in rund einer halben Sekunde, Stimmenlimit und Geheimhaltung gehalten (Details in
der README unter „Lasttest / Generalprobe“).
