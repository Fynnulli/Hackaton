import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const ROOT = join(__dirname, "..", "..");
const MIGRATIONS = join(ROOT, "supabase", "migrations");

export type Row = Record<string, unknown>;

export class TestDb {
  private counter = 0;

  private constructor(readonly pg: PGlite) {}

  static async create(): Promise<TestDb> {
    const pg = new PGlite();
    await pg.exec(readFileSync(join(__dirname, "prelude.sql"), "utf8"));
    for (const file of readdirSync(MIGRATIONS).sort()) {
      await pg.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
    }
    return new TestDb(pg);
  }

  async close() {
    await this.pg.close();
  }

  /** Abfrage als Superuser, vorbei an RLS (Testaufbau, Zeit verstellen). */
  async sql<T = Row>(query: string, params: unknown[] = []): Promise<T[]> {
    return (await this.pg.query<T>(query, params)).rows;
  }

  /** Abfrage als angemeldeter Nutzer, so wie sie ueber die Supabase-API ankaeme. */
  async as<T = Row>(
    userId: string | null,
    query: string,
    params: unknown[] = [],
    role: "authenticated" | "anon" = "authenticated",
  ): Promise<T[]> {
    await this.pg.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
    await this.pg.exec(`set role ${role}`);
    try {
      return (await this.pg.query<T>(query, params)).rows;
    } finally {
      await this.pg.exec("reset role");
      await this.pg.query("select set_config('request.jwt.claim.sub', '', false)");
    }
  }

  async rpc<T = Row>(userId: string | null, fn: string, args: Record<string, unknown> = {}) {
    const names = Object.keys(args);
    const list = names.map((n, i) => `${n} => $${i + 1}`).join(", ");
    return this.as<T>(userId, `select * from public.${fn}(${list})`, Object.values(args));
  }

  async newAuthUser(): Promise<string> {
    const [{ id }] = await this.sql<{ id: string }>(
      "insert into auth.users (id) values (gen_random_uuid()) returning id",
    );
    return id;
  }

  async seedEvent(joinCode = "TEST42") {
    await this.sql("insert into public.event (join_code) values ($1)", [joinCode]);
    await this.sql(
      `insert into public.challenge_stage (stage_no, title, body) values
        (1, 'Stufe 1', 'GEHEIM-1'), (2, 'Stufe 2', 'GEHEIM-2'), (3, 'Twist', 'GEHEIM-3')`,
    );
  }

  async joinUser(joinCode = "TEST42"): Promise<string> {
    const id = await this.newAuthUser();
    this.counter += 1;
    await this.rpc(id, "join_event", {
      p_join_code: joinCode,
      p_display_name: `Person ${this.counter}`,
      p_avatar: "🦊",
    });
    return id;
  }

  async makeAdmin(userId: string) {
    await this.sql("update public.participant set is_admin = true where id = $1", [userId]);
  }

  /** Legt ein Team mit `size` Mitgliedern an (nur waehrend Teams offen sind). */
  async makeTeam(name: string, size = 1) {
    const owner = await this.joinUser();
    const members = [owner];
    const [team] = await this.rpc<{ id: string; team_code: string }>(owner, "create_team", {
      p_name: name,
    });
    for (let i = 1; i < size; i += 1) {
      const member = await this.joinUser();
      await this.rpc(member, "join_team", { p_team_code: team.team_code });
      members.push(member);
    }
    return { id: team.id, code: team.team_code, members };
  }

  /** Verschiebt den Zeitplan relativ zu jetzt (Minuten; negativ = Vergangenheit). */
  async setTimes(startsInMin: number | null, endsInMin: number | null, twistInMin: number | null) {
    const at = (m: number | null) => (m === null ? "null" : `now() + interval '${m} minutes'`);
    await this.sql(
      `update public.event set starts_at = ${at(startsInMin)},
         build_ends_at = ${at(endsInMin)}, twist_at = ${at(twistInMin)}`,
    );
  }

  async setPhase(phase: string) {
    await this.sql("update public.event set phase = $1::public.event_phase", [phase]);
  }

  async submit(userId: string, overrides: Record<string, unknown> = {}) {
    const [row] = await this.rpc<{ id: string; team_id: string }>(userId, "submit_project", {
      p_title: "Projekt",
      p_url: "https://example.com",
      p_description: "Beschreibung",
      p_screenshot_path: null,
      p_stage1: true,
      p_stage2: false,
      p_stage3: false,
      ...overrides,
    });
    return row;
  }
}
