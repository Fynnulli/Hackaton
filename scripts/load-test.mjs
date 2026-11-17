#!/usr/bin/env node
/**
 * Lasttest / Generalprobe gegen ein echtes Supabase-Projekt.
 *
 *   node --env-file=.env.local scripts/load-test.mjs --clients 60 --code TEST42
 *
 * Simuliert N Teilnehmende mit dem oeffentlichen Schluessel (wie der Browser):
 * Beitritt, Teams zu dritt, Realtime-Abos, die Enthuellung mit allen gleichzeitig, parallele
 * Abgaben, eine Durchsage, gleichzeitiges Abstimmen (mit absichtlichen Ueberzaehligen) und
 * Phasenwechsel bis ins Wrapped. Gemessen werden Latenzen und Fehler.
 *
 * Der erste simulierte Client wird Admin: Das Skript gibt dafuer einen SQL-Befehl aus und
 * wartet, bis er im SQL-Editor ausgefuehrt wurde.
 *
 * ACHTUNG: veraendert das Event (Phase, Zeitplan). Nur gegen Test-Daten laufen lassen.
 * Danach aufraeumen (der Befehl wird am Ende ausgegeben).
 *
 * Voraussetzung: Rate-Limit fuer anonyme Anmeldungen >= Anzahl Clients
 * (Authentication -> Rate Limits).
 */
import { createClient } from "@supabase/supabase-js";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1]]);
    return acc;
  }, []),
);
const N = Number(args.clients ?? 60);
const CODE = String(args.code ?? "TEST42");
const BUILD_MIN = Number(args["build-minutes"] ?? 4);
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL || !KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY fehlen (node --env-file=.env.local …)");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => performance.now();
const metrics = new Map();
const errors = new Map();
function record(name, ms) {
  if (!metrics.has(name)) metrics.set(name, []);
  metrics.get(name).push(ms);
}
function fail(name, err) {
  const msg = `${name}: ${err?.message ?? err}`;
  errors.set(msg, (errors.get(msg) ?? 0) + 1);
}
async function timed(name, fn) {
  const t = now();
  try {
    const res = await fn();
    if (res?.error) throw res.error;
    record(name, now() - t);
    return res;
  } catch (err) {
    fail(name, err);
    return null;
  }
}
function pct(list, p) {
  const s = [...list].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}
async function inBatches(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ---------------------------------------------------------------------------
log(`Lasttest mit ${N} Clients gegen ${URL}`);
const clients = Array.from({ length: N }, (_, i) => ({
  i,
  name: `Last ${String(i + 1).padStart(2, "0")}`,
  sb: createClient(URL, KEY, {
    auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 20 } },
  }),
  received: { event: [], announcement: [] },
}));

// 1. Anmelden und beitreten (in Zehnergruppen, wie Leute, die fast gleichzeitig kommen)
await inBatches(clients, 10, async (c) => {
  const auth = await timed("auth.signInAnonymously", () => c.sb.auth.signInAnonymously());
  if (!auth) return;
  c.id = auth.data.user.id;
  await timed("rpc.join_event", () =>
    c.sb.rpc("join_event", { p_join_code: CODE, p_display_name: c.name, p_avatar: "🤖" }),
  );
});
const joined = clients.filter((c) => c.id);
log(`Beigetreten: ${joined.length}/${N}`);
if (joined.length < 3) {
  console.error("Zu wenige Clients beigetreten, Abbruch. Rate-Limit pruefen.");
  report();
  process.exit(1);
}

// 2. Admin werden (vor den Teams: die lassen sich nur in Lobby und Bauphase bilden)
const admin = joined[0];
console.log(`
>>> Bitte im SQL-Editor ausfuehren (macht "${admin.name}" zum Admin):
    update public.participant set is_admin = true where id = '${admin.id}';
`);
for (let tries = 0; ; tries++) {
  const { data } = await admin.sb.rpc("is_admin");
  if (data === true) break;
  if (tries > 180) {
    console.error("Kein Admin nach 6 Minuten, Abbruch.");
    report();
    process.exit(1);
  }
  await sleep(2_000);
}
log("Admin bestaetigt.");

await timed("admin.set_phase", () => admin.sb.rpc("admin_set_phase", { p_phase: "lobby" }));

// 3. Teams zu dritt, alle Gruppen gleichzeitig
const groups = [];
for (let i = 0; i < joined.length; i += 3) groups.push(joined.slice(i, i + 3));
await Promise.all(
  groups.map(async (g, gi) => {
    const res = await timed("rpc.create_team", () =>
      g[0].sb.rpc("create_team", { p_name: `Last-Team ${String(gi + 1).padStart(2, "0")}` }),
    );
    if (!res) return;
    const team = Array.isArray(res.data) ? res.data[0] : res.data;
    g.teamId = team.id;
    await Promise.all(
      g.slice(1).map((m) =>
        timed("rpc.join_team", () => m.sb.rpc("join_team", { p_team_code: team.team_code })),
      ),
    );
    for (const m of g) m.teamId = team.id;
  }),
);
log(`Teams: ${groups.filter((g) => g.teamId).length}/${groups.length}`);

// 4. Realtime: jeder Client abonniert wie die App event, participant und announcement
await Promise.all(
  joined.map(
    (c) =>
      new Promise((resolve) => {
        const t = now();
        const timeout = setTimeout(() => {
          fail("realtime.subscribe", "timeout");
          resolve();
        }, 15_000);
        c.channel = c.sb
          .channel(`load-${c.i}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "event" }, () =>
            c.received.event.push(Date.now()),
          )
          .on("postgres_changes", { event: "*", schema: "public", table: "participant" }, () => {})
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "announcement" }, () =>
            c.received.announcement.push(Date.now()),
          )
          .subscribe((state) => {
            if (state === "SUBSCRIBED") {
              clearTimeout(timeout);
              record("realtime.subscribe", now() - t);
              resolve();
            } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
              clearTimeout(timeout);
              fail("realtime.subscribe", state);
              resolve();
            }
          });
      }),
  ),
);
log(`Realtime verbunden: ${metrics.get("realtime.subscribe")?.length ?? 0}/${joined.length}`);
// Befund aus dem ersten 60er-Lauf: Direkt nach SUBSCRIBED kommen unter Last noch nicht alle
// Aenderungen an. Die App laedt deshalb kurz nach dem Verbinden noch einmal nach; hier
// warten wir die Anlaufzeit ab, damit die Latenzmessungen danach aussagekraeftig sind.
const SETTLE_MS = Number(args["settle-ms"] ?? 5000);
await sleep(SETTLE_MS);

/** Wie viele Clients haben nach `since` eine Realtime-Nachricht bekommen, und wie schnell. */
async function realtimeFanout(kind, since, label) {
  await sleep(6_000);
  let got = 0;
  for (const c of joined) {
    const t = c.received[kind].find((x) => x >= since);
    if (t) {
      got++;
      record(`realtime.${label}`, t - since);
    }
  }
  if (got < joined.length) fail(`realtime.${label}`, `${joined.length - got} Clients ohne Nachricht`);
  log(`Realtime ${label}: ${got}/${joined.length} erreicht`);
}

// 5. Enthuellung: Start in 20 s, dann fragen alle gleichzeitig nach dem Thema
const startsAt = Date.now() + 20_000;
let t0 = Date.now();
await timed("admin.schedule", () =>
  admin.sb.rpc("admin_schedule", {
    p_starts_at: new Date(startsAt).toISOString(),
    p_build_minutes: BUILD_MIN,
    p_twist_minute: BUILD_MIN / 2,
  }),
);
await realtimeFanout("event", t0, "zeitplan");
const early = await admin.sb.from("challenge_stage").select("stage_no");
if ((early.data ?? []).length > 0) fail("geheimhaltung", "Stufen vor dem Start lesbar!");
await sleep(Math.max(0, startsAt - Date.now()));
log("Start. Alle holen das Thema.");
await Promise.all(
  joined.map(async (c) => {
    const start = Date.now();
    for (let k = 0; k < 40; k++) {
      const { data, error } = await c.sb.from("challenge_stage").select("stage_no, title");
      if (error) fail("stages.select", error);
      if (data?.some((s) => s.stage_no === 1)) {
        record("enthuellung.thema_da_nach", Date.now() - startsAt);
        if (data.some((s) => s.stage_no === 3)) fail("geheimhaltung", "Twist zu frueh lesbar!");
        return;
      }
      await sleep(Math.max(0, 500 - (Date.now() - start) % 500));
    }
    fail("enthuellung", "Thema nach 20 s nicht da");
  }),
);

// 6. Abgaben: alle Teams gleichzeitig, danach alle Mitglieder gleichzeitig aendern (Wettlauf)
await Promise.all(
  groups
    .filter((g) => g.teamId)
    .map((g, gi) =>
      timed("rpc.submit_project", () =>
        g[0].sb.rpc("submit_project", {
          p_title: `Lastprojekt ${gi + 1}`,
          p_url: "https://example.com",
          p_description: "Generalprobe",
          p_screenshot_path: null,
          p_stage1: true,
          p_stage2: gi % 2 === 0,
          p_stage3: false,
        }),
      ),
    ),
);
await Promise.all(
  joined
    .filter((c) => c.teamId)
    .map((c) =>
      timed("rpc.submit_project (Aenderung)", () =>
        c.sb.rpc("submit_project", {
          p_title: `Lastprojekt von ${c.name}`,
          p_url: "https://example.com",
          p_description: "Paralleles Speichern",
          p_screenshot_path: null,
          p_stage1: true,
          p_stage2: true,
          p_stage3: false,
        }),
      ),
    ),
);

// 7. Durchsage an alle
t0 = Date.now();
await timed("admin.announcement", () =>
  admin.sb.rpc("admin_post_announcement", { p_body: "Generalprobe: Durchsage an alle" }),
);
await realtimeFanout("announcement", t0, "durchsage");

// 8. Galerie und Abstimmen: jeder feuert 5 Stimmen gleichzeitig ab, erlaubt sind 3
t0 = Date.now();
await timed("admin.set_phase", () => admin.sb.rpc("admin_set_phase", { p_phase: "gallery" }));
await realtimeFanout("event", t0, "phasenwechsel");
const subs = (await admin.sb.from("submission").select("id, team_id").eq("hidden", false)).data ?? [];
// Stimmen, die schon vor dem Test existierten (z. B. von echten Testpersonen), nicht mitzaehlen.
const votesBefore = ((await admin.sb.rpc("get_leaderboard")).data ?? []).reduce((n, r) => n + r.vote_count, 0);
let overLimit = 0;
await Promise.all(
  joined.map(async (c) => {
    const targets = subs.filter((s) => s.team_id !== c.teamId).sort(() => Math.random() - 0.5).slice(0, 5);
    const results = await Promise.all(
      targets.map(async (s) => {
        const t = now();
        const { error } = await c.sb.rpc("cast_vote", { p_submission_id: s.id });
        if (!error) record("rpc.cast_vote", now() - t);
        else if (!/no_votes_left|already_voted/.test(error.message)) fail("rpc.cast_vote", error);
        return !error;
      }),
    );
    const ok = results.filter(Boolean).length;
    // Admins sehen per RLS alle Stimmen, deshalb ausdruecklich nach der eigenen ID filtern.
    const { data: mine } = await c.sb.from("vote").select("id").eq("voter_id", c.id);
    if ((mine ?? []).length > 3 || ok > 3) overLimit++;
  }),
);
if (overLimit) fail("stimmenlimit", `${overLimit} Clients mit mehr als 3 Stimmen!`);

// 9. Wrapped mit Folienwechseln
await timed("admin.set_phase", () => admin.sb.rpc("admin_set_phase", { p_phase: "wrapped" }));
for (const slide of [1, 2, 3]) {
  t0 = Date.now();
  await timed("admin.set_wrapped_slide", () => admin.sb.rpc("admin_set_wrapped_slide", { p_slide: slide }));
  await realtimeFanout("event", t0, "folienwechsel");
}
const board = (await admin.sb.rpc("get_leaderboard")).data ?? [];
const totalVotes = board.reduce((sum, r) => sum + r.vote_count, 0);
if (totalVotes - votesBefore > joined.length * 3) {
  fail("stimmenlimit", `${totalVotes - votesBefore} neue Stimmen bei ${joined.length} Clients`);
}
log(`Wertung: ${board.length} Abgaben, ${totalVotes} Stimmen insgesamt`);

await Promise.all(joined.map((c) => c.sb.removeAllChannels()));
report();
console.log(`
>>> Aufraeumen im SQL-Editor:
    delete from public.team where name like 'Last-Team %';
    delete from public.announcement where body = 'Generalprobe: Durchsage an alle'
      or body like 'Team Last-Team % hat abgegeben';
    delete from auth.users where id in (select id from public.participant where display_name like 'Last %');
`);
process.exit(errors.size ? 1 : 0);

function report() {
  console.log("\n=== Ergebnis ===");
  console.log("Messung".padEnd(34), "n".padStart(4), "p50".padStart(7), "p95".padStart(7), "max".padStart(7), " (ms)");
  for (const [name, list] of metrics) {
    console.log(
      name.padEnd(34),
      String(list.length).padStart(4),
      String(Math.round(pct(list, 50))).padStart(7),
      String(Math.round(pct(list, 95))).padStart(7),
      String(Math.round(Math.max(...list))).padStart(7),
    );
  }
  console.log(errors.size ? "\nFehler:" : "\nKeine Fehler.");
  for (const [msg, n] of errors) console.log(`  ${n}x ${msg}`);
}
