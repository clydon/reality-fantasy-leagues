import crypto from "crypto";
import { after } from "next/server";
import type { PoolClient } from "pg";
import { buildRulebookPrompt } from "@/lib/game/formats/rulebook-research.js";
import { placeholderEmail } from "@/lib/no-email";
import { shadowRules, shadowState, SHADOW_RULES, type ShadowRules } from "@/lib/game/shadow";
import type { LeagueRulebook, LeagueState } from "@/lib/game/types";
import { askBot, askBotStatus, type BotChoice } from "./ask-bot";
import { isImpersonating, isSuperAdminUser, type Session } from "./auth-helpers";
import { newCouch } from "./couches";
import { HttpError, pool } from "./db";
import { games } from "./show-space";

// A super admin's test couch (db/migrations/0151; docs/PLAN-researched-survivor.md). Temporary tooling for testing during a
// season without touching the real games: one of your couches' games on a season, copied (src/lib/game/shadow.ts: every move
// and result as they are) onto a test couch, played by test players, one per real person, each standing in for them (named
// after them: riley_test, in their seats too) with the same seat and role, the admin's own stand-in running the games.
// The admin switches into any of them from the profile menu (classic's impersonation: an hour, the "Viewing as" bar, one tap
// back) to mimic what that person did. The season's results reach the test games as they reach every game on it. The games
// play by one of shadow.ts's rules (the built-in template by default: the switch to rulebooks, scoring the same), held as the
// couch's own copy (Make it ours's shape), so nothing takes it out. Copy again overwrites the test games with the real ones'
// latest moves; Remove takes the couch, its games and its test players away.

type Queryable = { query: typeof pool.query };

export interface TestPlayer {
  userId: string;
  /** riley_test: their username, and their seats' name. */
  name: string;
  username: string;
  /** Who they stand in for ("riley"). */
  standsFor: string;
  role: "commissioner" | "admin" | "member";
  /** The one you're viewing as now. */
  current: boolean;
}

export interface TestCouch {
  couch: {
    id: string;
    name: string;
    /** Where it was copied from: "Couch Council · Survivor 51". */
    from: string;
    rules: ShadowRules;
    /** Our bot is researching the rules now. */
    researching: boolean;
    /** How the last research or copy went, when it didn't. */
    message: string | null;
    games: { leagueId: string; name: string; gameType: string }[];
    madeAt: string;
  } | null;
  players: TestPlayer[];
  /** Where a test couch can be made from: each of your couches' seasons with games on them. */
  sources: { couchId: string; seasonId: string; label: string; games: number }[];
  /** Viewing as one of the test players now (the switch's "Back to me"). */
  viewingAs: boolean;
}

const RESEARCH_STALE_MS = 6 * 60_000;
const one = async (db: Queryable, sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows[0] ?? null;

/**
 * Who's testing: a super admin signed in as themselves, or one viewing as one of their own test players. Anyone else: 403.
 * `asSelf`: what changes the test couch needs the admin as themselves (not while viewing as someone).
 */
export async function tester(session: Session, o: { asSelf?: boolean } = {}): Promise<{ adminId: string; viewingAs: string | null }> {
  const user = session.user;
  if (!isImpersonating(session)) {
    if (!isSuperAdminUser(user)) throw new HttpError(403, "Test couches are for site admins");
    return { adminId: user.id, viewingAs: null };
  }
  const by = (session.session as { impersonatedBy?: string }).impersonatedBy as string;
  const admin = await one(pool, `SELECT role FROM "user" WHERE id = $1`, [by]);
  const mine = await one(pool, "SELECT 1 FROM test_players p JOIN test_couches c ON c.couch_id = p.couch_id WHERE p.user_id = $1 AND c.owner_id = $2", [user.id, by]);
  if (admin?.role !== "admin" || !mine) throw new HttpError(403, "Test couches are for site admins");
  if (o.asSelf) throw new HttpError(409, "Go back to you first (Back to me), then change the test couch");
  return { adminId: by, viewingAs: user.id };
}

/** The admin's test couch, its players and where one can be made from. */
export async function testCouchOf(adminId: string, viewingAs: string | null): Promise<TestCouch> {
  const row = await one(
    pool,
    `SELECT t.*, c.name, sc.name AS source_couch, s.name AS show, ss.season_number
       FROM test_couches t JOIN couches c ON c.id = t.couch_id
       LEFT JOIN couches sc ON sc.id = t.source_couch_id
       LEFT JOIN show_seasons ss ON ss.id = t.source_season_id LEFT JOIN shows s ON s.id = ss.show_id
      WHERE t.owner_id = $1`,
    [adminId]
  );
  const [players, list, sources] = await Promise.all([
    row
      ? pool.query(
          `SELECT p.user_id, u.name, u.username, r.username AS real_username, r.name AS real_name,
                  (SELECT max(CASE m.role WHEN 'commissioner' THEN 2 WHEN 'admin' THEN 1 ELSE 0 END) FROM league_memberships m JOIN leagues l ON l.id = m.league_id WHERE m.user_id = p.user_id AND l.couch_id = $1) AS rank
             FROM test_players p JOIN "user" u ON u.id = p.user_id LEFT JOIN "user" r ON r.id = p.stands_for
            WHERE p.couch_id = $1 ORDER BY p.position`,
          [row.couch_id]
        )
      : Promise.resolve({ rows: [] as Record<string, unknown>[] }),
    row ? pool.query("SELECT id, name, state->'settings'->>'leagueTypeId' AS type FROM leagues WHERE couch_id = $1 AND deleted_at IS NULL ORDER BY group_position NULLS LAST, name", [row.couch_id]) : Promise.resolve({ rows: [] as Record<string, unknown>[] }),
    sourcesOf(adminId, row?.couch_id ?? null),
  ]);
  return {
    couch: row
      ? {
          id: row.couch_id,
          name: row.name,
          from: [row.source_couch, row.show ? `${(row.show as string).replace(/^The /, "")}${row.season_number ? ` ${row.season_number}` : ""}` : null].filter(Boolean).join(" · "),
          rules: row.rules,
          researching: !!row.researching_at && Date.now() - new Date(row.researching_at).getTime() < RESEARCH_STALE_MS,
          message: row.message,
          games: list.rows.map((g) => ({ leagueId: g.id as string, name: g.name as string, gameType: (g.type as string) || "classic-draft" })),
          madeAt: (row.created_at as Date).toISOString(),
        }
      : null,
    players: (players.rows as Record<string, unknown>[]).map((p) => ({
      userId: p.user_id as string,
      name: p.name as string,
      username: p.username as string,
      standsFor: (p.real_username as string) || (p.real_name as string) || "someone gone",
      role: p.rank === 2 ? "commissioner" : p.rank === 1 ? "admin" : "member",
      current: p.user_id === viewingAs,
    })),
    sources,
    viewingAs: !!viewingAs,
  };
}

/** Each of the admin's couches' seasons with games on them (never a test couch's). */
async function sourcesOf(adminId: string, testCouch: string | null): Promise<TestCouch["sources"]> {
  const { rows } = await pool.query(
    `SELECT c.id AS couch_id, c.name AS couch FROM couch_members m JOIN couches c ON c.id = m.couch_id
      WHERE m.user_id = $1 AND NOT EXISTS (SELECT 1 FROM test_couches t WHERE t.couch_id = c.id)`,
    [adminId]
  );
  if (!rows.length) return [];
  const list = await games(adminId, { couchIds: rows.map((r) => r.couch_id as string) });
  const out = new Map<string, TestCouch["sources"][number]>();
  const { rows: seasons } = await pool.query(
    "SELECT ss.id, ss.season_number, s.name FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = ANY($1::uuid[])",
    [[...new Set(list.map((g) => g.seasonId).filter(Boolean))]]
  );
  for (const g of list) {
    if (!g.seasonId || !g.couchId || g.solo || g.archived || g.couchId === testCouch) continue;
    const key = `${g.couchId}/${g.seasonId}`;
    const s = seasons.find((x) => x.id === g.seasonId);
    const couch = rows.find((r) => r.couch_id === g.couchId)?.couch as string;
    const label = `${couch} · ${s ? `${(s.name as string).replace(/^The /, "")}${s.season_number ? ` ${s.season_number}` : ""}` : "a season"}`;
    out.set(key, { couchId: g.couchId, seasonId: g.seasonId, label, games: (out.get(key)?.games ?? 0) + 1 });
  }
  return [...out.values()];
}

/** The real games a test couch copies: the couch's games on the season (not deleted, not archived, never a solo game). */
async function realGames(adminId: string, couchId: string, seasonId: string) {
  const list = (await games(adminId, { couchIds: [couchId], seasonId })).filter((g) => !g.solo && !g.archived);
  if (!list.length) throw new HttpError(404, "That couch has no games on that season");
  const { rows } = await pool.query("SELECT id, name, state, created_by, group_position FROM leagues WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL ORDER BY group_position NULLS LAST, name", [
    list.map((g) => g.leagueId),
  ]);
  const { rows: members } = await pool.query("SELECT league_id, user_id, player_id, role, results_seen_through FROM league_memberships WHERE league_id = ANY($1::uuid[])", [rows.map((r) => r.id)]);
  return { leagues: rows as { id: string; name: string; state: LeagueState; created_by: string; group_position: number | null }[], members };
}

const usernameFor = (real: string, n: number) => `${real.toLowerCase().replace(/[^a-z0-9_.]/g, "").slice(0, 24) || `player${n}`}_test`;
const joinCode = () => Array.from(crypto.randomBytes(6), (b) => "ABCDEFGHJKLMNPQRSTUVWXYZ"[b % 24]).join("");

/** One test player per real person, the admin's own stand-in first, then by name; made once, reused by Copy again. */
async function ensurePlayers(client: Queryable, couchId: string, adminId: string, realIds: string[]): Promise<Map<string, string>> {
  const { rows: had } = await client.query("SELECT user_id, stands_for, position FROM test_players WHERE couch_id = $1", [couchId]);
  const map = new Map(had.filter((r) => r.stands_for).map((r) => [r.stands_for as string, r.user_id as string]));
  const { rows: named } = await client.query(`SELECT id FROM "user" WHERE id = ANY($1::text[]) ORDER BY id = $2 DESC, lower(coalesce(username, name)), id`, [realIds, adminId]);
  const order = named.map((r) => r.id as string);
  let position = had.reduce((m, r) => Math.max(m, r.position as number), -1) + 1;
  for (const real of order) {
    if (map.has(real)) continue;
    const u = await one(client, `SELECT username, name FROM "user" WHERE id = $1`, [real]);
    const base = (u?.username as string) || (u?.name as string) || `player${position + 1}`;
    let username = usernameFor(base, position + 1);
    for (let k = 2; await one(client, `SELECT 1 FROM "user" WHERE username = $1`, [username]); k++) username = `${usernameFor(base, position + 1)}${k}`;
    const id = crypto.randomUUID();
    // No password and no credential account: the admin's switch is the only way in.
    await client.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, approved, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, true, $4, $2, 'user', true, now(), now())`,
      [id, username, placeholderEmail(username), username]
    );
    await client.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [id]);
    await client.query("INSERT INTO test_players (user_id, couch_id, stands_for, position) VALUES ($1, $2, $3, $4)", [id, couchId, real, position++]);
    await client.query("INSERT INTO couch_members (couch_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [couchId, id, real === adminId ? "owner" : "member"]);
    map.set(real, id);
  }
  return map;
}

/** The test games' rulebook for `rules` (the couch's own copy), or null for `same`. */
async function rulebookFor(client: Queryable, couchId: string, leagueIds: string[], rules: ShadowRules, answer: string | null, format: string | null, castNames: string[], by: string): Promise<LeagueRulebook | null> {
  await client.query("UPDATE leagues SET rulebook_id = NULL WHERE couch_id = $1", [couchId]);
  await client.query("DELETE FROM rulebooks WHERE provenance->>'test' = 'true' AND league_id = ANY($1::uuid[])", [leagueIds]);
  const c = shadowRules(rules, { format, answer, castNames });
  if (!c.compiled) return null;
  const rb = await one(
    client,
    `INSERT INTO rulebooks (name, kind, owner_kind, league_id, status, reader, blocks, compiled, compiled_source, aliases, provenance, version, created_by)
     VALUES ($1, 'competition', 'league', $2, 'in_force', 'research', $3, $4, 'blocks', $5, $6, 1, $7) RETURNING id, version`,
    [`Test couch rules (${rules})`, leagueIds[0], JSON.stringify(c.blocks), JSON.stringify(c.compiled), JSON.stringify(c.aliases ?? {}), JSON.stringify({ ours: true, test: true, rules }), by]
  );
  await client.query("UPDATE leagues SET rulebook_id = $1 WHERE couch_id = $2", [rb.id, couchId]);
  return { id: rb.id, version: rb.version, data: c.compiled, reader: "research" };
}

/** The real games' seats → their stand-ins: names (riley_test) and roles (the admin's own stand-in runs the games). */
function seatsOf(members: { league_id: string; user_id: string; player_id: string; role: string; results_seen_through: number | null }[], leagueId: string, players: Map<string, string>, names: Map<string, string>, adminId: string) {
  const here = members.filter((m) => m.league_id === leagueId);
  const rename = (p: { id: string; name: string }) => {
    const m = here.find((x) => x.player_id === p.id);
    return (m && names.get(players.get(m.user_id) ?? "")) || `${p.name}_test`;
  };
  const roles = here.map((m) => ({ ...m, user_id: players.get(m.user_id) as string, role: m.user_id === adminId && m.role === "member" ? "admin" : m.role }));
  return { rename, roles };
}

async function namesOf(client: Queryable, ids: string[]) {
  const { rows } = await client.query(`SELECT id, name FROM "user" WHERE id = ANY($1::text[])`, [ids]);
  return new Map(rows.map((r) => [r.id as string, r.name as string]));
}

/** Copy (or copy again) the real games into the test couch's, on its rules; new real people get stand-ins. */
async function copyInto(client: Queryable, adminId: string, t: { couch_id: string; source_couch_id: string; source_season_id: string; rules: ShadowRules; rules_answer: string | null }) {
  const real = await realGames(adminId, t.source_couch_id, t.source_season_id);
  const players = await ensurePlayers(client, t.couch_id, adminId, [...new Set(real.members.map((m) => m.user_id as string))]);
  const names = await namesOf(client, [...players.values()]);
  const lead = players.get(adminId) ?? [...players.values()][0];
  const { rows: had } = await client.query("SELECT id, group_id, state->'settings'->>'shadowOf' AS source FROM leagues WHERE couch_id = $1", [t.couch_id]);
  let group = (had.find((h) => h.group_id)?.group_id as string | undefined) ?? null;
  if (!group) group = (await one(client, "INSERT INTO league_groups (created_by) VALUES ($1) RETURNING id", [lead])).id as string;
  const ids: string[] = [];
  for (const [i, g] of real.leagues.entries()) {
    let id = had.find((h) => h.source === g.id)?.id as string | undefined;
    if (!id) {
      id = (await one(client, "INSERT INTO leagues (name, slug, join_code, state, created_by, group_id, group_position, couch_id) VALUES ($1, $2, $3, '{}'::jsonb, $4, $5, $6, $7) RETURNING id", [
        g.name, `test-${crypto.randomUUID().slice(0, 8)}`, joinCode(), players.get(g.created_by) ?? lead, group, i, t.couch_id,
      ])).id as string;
    }
    ids.push(id);
  }
  const format = (real.leagues[0]?.state.settings as { showFormat?: string } | undefined)?.showFormat ?? null;
  const { rows: cast } = await client.query("SELECT name FROM season_cast WHERE season_id = $1", [t.source_season_id]);
  const rulebook = await rulebookFor(client, t.couch_id, ids, t.rules, t.rules_answer, format, cast.map((c) => c.name as string), lead);
  for (const [i, g] of real.leagues.entries()) {
    const { rename, roles } = seatsOf(real.members, g.id, players, names, adminId);
    await client.query("UPDATE leagues SET state = $2, updated_at = now() WHERE id = $1", [ids[i], JSON.stringify(shadowState(g.state, { sourceId: g.id, rulebook, rename }))]);
    await client.query("DELETE FROM league_memberships WHERE league_id = $1", [ids[i]]);
    for (const m of roles) {
      await client.query("INSERT INTO league_memberships (league_id, user_id, player_id, role, results_seen_through) VALUES ($1, $2, $3, $4, $5)", [ids[i], m.user_id, m.player_id, m.role, m.results_seen_through]);
    }
  }
  // Each stand-in follows the season where their person is (only the first time: after that the mark is the tester's).
  for (const [realId, testId] of players) {
    const f = await one(client, "SELECT seen_through FROM show_follows WHERE user_id = $1 AND season_id = $2", [realId, t.source_season_id]);
    await client.query("INSERT INTO show_follows (user_id, season_id, seen_through) VALUES ($1, $2, $3) ON CONFLICT (user_id, season_id) DO NOTHING", [testId, t.source_season_id, f?.seen_through ?? 0]);
  }
}

async function inTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const out = await fn(c);
    await c.query("COMMIT");
    return out;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/** Make the admin's test couch from one of their couches' seasons (one at a time: an old one is removed first). Researched
 *  rules start on the template while our bot researches them. */
export async function makeTestCouch(adminId: string, body: { couchId?: unknown; seasonId?: unknown; rules?: unknown }, bot: BotChoice = {}): Promise<void> {
  const src = (await sourcesOf(adminId, null)).find((s) => s.couchId === body.couchId && s.seasonId === body.seasonId);
  if (!src) throw new HttpError(400, "Pick one of your couches' seasons with games on it");
  const rules = SHADOW_RULES.includes(body.rules as ShadowRules) && body.rules !== "researched" ? (body.rules as ShadowRules) : "template";
  await removeTestCouch(adminId);
  await inTransaction(async (client) => {
    const source = await one(client, "SELECT name FROM couches WHERE id = $1", [src.couchId]);
    const couch = await newCouch(client, `Test · ${source?.name ?? "a couch"}`, adminId);
    const t = { couch_id: couch, source_couch_id: src.couchId, source_season_id: src.seasonId, rules, rules_answer: null };
    await client.query("INSERT INTO test_couches (couch_id, owner_id, source_couch_id, source_season_id, rules) VALUES ($1, $2, $3, $4, $5)", [couch, adminId, src.couchId, src.seasonId, rules]);
    await copyInto(client, adminId, t);
    // The couch is its stand-ins': the admin's own stand-in owns it.
    await client.query(`UPDATE couches SET created_by = (SELECT user_id FROM test_players WHERE couch_id = $1 ORDER BY position LIMIT 1) WHERE id = $1`, [couch]);
  });
  if (body.rules === "researched") await researchLater(await testRow(adminId), bot);
}

async function testRow(adminId: string) {
  const t = await one(pool, "SELECT * FROM test_couches WHERE owner_id = $1", [adminId]);
  if (!t) throw new HttpError(404, "No test couch: make one first");
  return t;
}

/** Copy the real games' latest moves and results over the test games' (what was done as test players goes), same rules. */
export async function copyAgain(adminId: string): Promise<void> {
  const t = await testRow(adminId);
  await inTransaction((client) => copyInto(client, adminId, t));
}

/** What the test games play by. `researched` asks our bot after the answer the first time (its answer is kept). */
export async function setTestRules(adminId: string, rules: unknown, bot: BotChoice = {}): Promise<void> {
  if (!SHADOW_RULES.includes(rules as ShadowRules)) throw new HttpError(400, `rules is ${SHADOW_RULES.join(", ")}`);
  const t = await testRow(adminId);
  if (rules === "researched" && !t.rules_answer) return researchLater(t, bot);
  await inTransaction(async (client) => {
    await client.query("UPDATE test_couches SET rules = $2, message = NULL, updated_at = now() WHERE couch_id = $1", [t.couch_id, rules]);
    await copyRules(client, { ...t, rules });
  });
}

/** Only the rules: the test games' rulebook swapped, their moves left as they are. */
async function copyRules(client: Queryable, t: { couch_id: string; source_season_id: string; rules: ShadowRules; rules_answer: string | null }) {
  const { rows } = await client.query("SELECT id, state FROM leagues WHERE couch_id = $1 ORDER BY group_position NULLS LAST, name FOR UPDATE", [t.couch_id]);
  const { rows: cast } = await client.query("SELECT name FROM season_cast WHERE season_id = $1", [t.source_season_id]);
  const format = (rows[0]?.state.settings as { showFormat?: string } | undefined)?.showFormat ?? null;
  const lead = (await one(client, "SELECT user_id FROM test_players WHERE couch_id = $1 ORDER BY position LIMIT 1", [t.couch_id]))?.user_id as string;
  const rulebook = await rulebookFor(client, t.couch_id, rows.map((r) => r.id as string), t.rules, t.rules_answer, format, cast.map((c) => c.name as string), lead);
  for (const r of rows) {
    const s = r.state as LeagueState;
    // Back on the real game's own rules: whatever rulebook it plays by now (its season's, or none).
    const own = rulebook ?? (await one(client, "SELECT state->'settings'->'rulebook' AS rb FROM leagues WHERE id::text = $1", [(s.settings as { shadowOf?: string }).shadowOf ?? ""]))?.rb;
    if (own) s.settings.rulebook = own;
    else delete s.settings.rulebook;
    await client.query("UPDATE leagues SET state = $2, updated_at = now() WHERE id = $1", [r.id, JSON.stringify(s)]);
  }
}

/** Our bot researches the season's rules after the answer (Make it a game's prompt); the test games switch to them when it's in. */
async function researchLater(t: Record<string, unknown>, bot: BotChoice): Promise<void> {
  if (!(await askBotStatus(bot)).available) throw new HttpError(503, "Our bot isn't answering right now. Try again in a bit.");
  const { rowCount } = await pool.query(
    "UPDATE test_couches SET researching_at = now(), message = NULL, updated_at = now() WHERE couch_id = $1 AND (researching_at IS NULL OR researching_at < now() - make_interval(secs => $2))",
    [t.couch_id, RESEARCH_STALE_MS / 1000]
  );
  if (!rowCount) return;
  const season = await one(pool, "SELECT s.name, ss.season_number, ss.status FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1", [t.source_season_id]);
  const run = async () => {
    try {
      const { answer } = await askBot(buildRulebookPrompt({ show: (season?.name as string) ?? "the show", season: season?.season_number != null ? String(season.season_number) : undefined, airing: season?.status !== "completed" }), { ...bot, budgetMs: 280_000 });
      await inTransaction(async (client) => {
        await client.query("UPDATE test_couches SET rules = 'researched', rules_answer = $2, researching_at = NULL, message = NULL, updated_at = now() WHERE couch_id = $1", [t.couch_id, answer]);
        await copyRules(client, { couch_id: t.couch_id as string, source_season_id: t.source_season_id as string, rules: "researched", rules_answer: answer });
      });
    } catch (e) {
      await pool.query("UPDATE test_couches SET researching_at = NULL, message = $2, updated_at = now() WHERE couch_id = $1", [t.couch_id, `Researching the rules didn't work: ${(e as Error).message}`.slice(0, 300)]);
    }
  };
  try {
    after(run);
  } catch {
    await run();
  }
}

/** The test couch, its games, its rulebook and its test players, gone. */
export async function removeTestCouch(adminId: string): Promise<void> {
  const t = await one(pool, "SELECT couch_id FROM test_couches WHERE owner_id = $1", [adminId]);
  if (!t) return;
  await inTransaction(async (client) => {
    const { rows: players } = await client.query("SELECT user_id FROM test_players WHERE couch_id = $1", [t.couch_id]);
    const { rows: leagues } = await client.query("SELECT id, group_id FROM leagues WHERE couch_id = $1", [t.couch_id]);
    await client.query("DELETE FROM leagues WHERE couch_id = $1", [t.couch_id]);
    const groups = [...new Set(leagues.map((l) => l.group_id).filter(Boolean))];
    if (groups.length) await client.query("DELETE FROM league_groups WHERE id = ANY($1::uuid[])", [groups]);
    await client.query("DELETE FROM couches WHERE id = $1", [t.couch_id]);
    await client.query(`DELETE FROM "user" WHERE id = ANY($1::text[])`, [players.map((p) => p.user_id)]);
  });
}
