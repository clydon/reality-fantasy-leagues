import type { Pool, PoolClient } from "pg";
import { TIEBREAK_AFTER_MS, tiebreakNext, tiebreakOn, tiebreakQuestions } from "@db/bot-research.js";
import { isSuperAdminUser, requireAuth, type SessionUser } from "./auth-helpers";
import { confirmAt, settleEverything } from "./community-results";
import { pool, HttpError } from "./db";
import { autopilotSeasons, nudgeBotClock, tiebreakReach } from "./desk-bot";
import { deskNotices } from "./show-changes";
import { signupMode, waitingCount } from "./way-in";
import { SIGNUP_MODES, type SignupMode } from "@/lib/signups";

// The admin's desk (docs/PLAN-new-design.md step 6b part 2; the mock's community.js admin): results settle by
// community, and the admin is the exception desk. Three tabs from the profile menu: Inbox (only what the community
// couldn't settle: a split, a flag nobody's answer checked within a day, a couch nobody runs, a phase start to
// confirm, a rulebook fix someone suggested; and the week's numbers, what settled on its own), Find (one search over
// shows, seasons, castaways, couches, people and rulebooks; each has a page with Override, a Lock and its History) and
// Settings. Every change the desk makes is a row in admin_changes (0113), with its undo where it has one.

export type DeskEntity = "fact" | "castaway" | "season" | "rulebook" | "couch" | "settings";

/** Site admins only: 403 for anyone else (the desk's routes and screens). */
export async function requireDesk(req: Request): Promise<SessionUser> {
  const user = await requireAuth(req);
  if (!isSuperAdminUser(user)) throw new HttpError(403, "The desk is for site admins");
  return user;
}

type Db = Pool | PoolClient;

/** One line in an entity's History, with how to take it back (null: it can't be). */
export async function logDesk(
  db: Db,
  change: { entity: DeskEntity; entityId: string; action: string; text: string; before?: unknown; after?: unknown; undo?: Record<string, unknown> | null; userId: string | null }
): Promise<string> {
  const { rows } = await db.query(
    `INSERT INTO admin_changes (entity, entity_id, action, text, before, after, undo, user_id) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8) RETURNING id`,
    [
      change.entity,
      change.entityId,
      change.action,
      change.text,
      change.before === undefined ? null : JSON.stringify(change.before),
      change.after === undefined ? null : JSON.stringify(change.after),
      change.undo ? JSON.stringify(change.undo) : null,
      change.userId,
    ]
  );
  return rows[0].id;
}

export interface DeskLine {
  id: string | null;
  text: string;
  at: string;
  who: string | null;
  /** The desk's own change, still undoable. */
  undoable: boolean;
  undone: boolean;
}

/** The desk's own lines for an entity, newest first (each page adds what else its history holds). */
export async function deskLines(entity: DeskEntity, entityId: string): Promise<DeskLine[]> {
  const { rows } = await pool.query(
    `SELECT c.id, c.text, c.created_at, c.undo IS NOT NULL AND c.undone_at IS NULL AS undoable, c.undone_at IS NOT NULL AS undone, COALESCE(u.username, u.name) AS who
       FROM admin_changes c LEFT JOIN "user" u ON u.id = c.user_id
      WHERE c.entity = $1 AND c.entity_id = $2 ORDER BY c.created_at DESC LIMIT 40`,
    [entity, entityId]
  );
  return rows.map((r) => ({ id: r.id, text: r.text, at: r.created_at.toISOString(), who: r.who, undoable: r.undoable, undone: r.undone }));
}

/** Lines merged from several sources, newest first. */
export const byNewest = (lines: DeskLine[]) => [...lines].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

// ---------- Settings ----------

export interface DeskSettings {
  /** How many sources it takes to confirm a fact. */
  confirmAt: number;
  /** Who can fill in results on a couch made from now on. */
  newCouchesAnyone: boolean;
  /** The rulebooks flag (every season's leagues play by its rulebook), and the seasons switched on one by one. */
  rulebooks: { everywhere: boolean; seasons: { id: string; name: string }[] };
  /** The tie-break run (step 6c part 2): on or off (off by default), and the airing seasons it would reach. */
  tiebreak: { on: boolean; hours: number; reach: string[] };
  /** Autopilot's trial: the seasons whose bot schedule is on, and what each checks (each season's page changes it). */
  autopilot: { id: string; name: string; line: string }[];
  /** Who gets in (step 9 part 2, src/lib/signups.ts), and how many new accounts are waiting to. */
  signups: { mode: SignupMode; waiting: number };
}

async function setting(key: string): Promise<unknown> {
  const { rows } = await pool.query("SELECT value FROM app_settings WHERE key = $1", [key]);
  return rows[0]?.value;
}

/** Who can fill in results on a new couch: the desk's default (anyone, unless it says otherwise). */
export async function newCouchesAnyone(db: Db = pool): Promise<boolean> {
  const { rows } = await db.query("SELECT value FROM app_settings WHERE key = 'new_couch_fill'");
  return rows[0]?.value !== false;
}

export async function deskSettings(): Promise<DeskSettings> {
  const { rows: live } = await pool.query(
    `SELECT ss.id, COALESCE(ss.name, s.name || ' ' || ss.season_number) AS name FROM show_seasons ss JOIN shows s ON s.id = ss.show_id
      WHERE ss.rulebook_live ORDER BY s.name, ss.season_number`
  );
  return {
    confirmAt: await confirmAt(),
    newCouchesAnyone: await newCouchesAnyone(),
    rulebooks: { everywhere: (await setting("rulebooks")) === true, seasons: live },
    tiebreak: { on: await tiebreakOn(pool), hours: TIEBREAK_AFTER_MS / 3600000, reach: await tiebreakReach() },
    autopilot: await autopilotSeasons(),
    signups: { mode: await signupMode(), waiting: await waitingCount() },
  };
}

const putSetting = (key: string, value: unknown) =>
  pool.query(`INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2::jsonb, now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, [
    key,
    JSON.stringify(value),
  ]);

/** Changes one setting (with its undo in History); the Confirmed threshold settles every community fact again. */
export async function setDeskSetting(
  user: SessionUser,
  body: { confirmAt?: unknown; newCouchesAnyone?: unknown; tiebreak?: unknown; signups?: unknown }
): Promise<DeskSettings> {
  const was = await deskSettings();
  if (body.confirmAt !== undefined) {
    const n = Number(body.confirmAt);
    if (!Number.isInteger(n) || n < 2 || n > 5) throw new HttpError(400, "Confirmed needs 2 to 5 sources");
    if (n !== was.confirmAt) {
      await putSetting("confirm_at", n);
      await logDesk(pool, { entity: "settings", entityId: "confirm_at", action: "set", text: `Confirmed needs ${n} sources that agree`, before: was.confirmAt, after: n, undo: { type: "setting", key: "confirm_at", value: was.confirmAt }, userId: user.id });
      await settleEverything(user.id);
    }
  }
  if (body.newCouchesAnyone !== undefined) {
    if (typeof body.newCouchesAnyone !== "boolean") throw new HttpError(400, "newCouchesAnyone is true or false");
    if (body.newCouchesAnyone !== was.newCouchesAnyone) {
      await putSetting("new_couch_fill", body.newCouchesAnyone);
      await logDesk(pool, {
        entity: "settings",
        entityId: "new_couch_fill",
        action: "set",
        text: body.newCouchesAnyone ? "New couches: anyone on the couch fills in results" : "New couches: only people who run games fill in results",
        before: was.newCouchesAnyone,
        after: body.newCouchesAnyone,
        undo: { type: "setting", key: "new_couch_fill", value: was.newCouchesAnyone },
        userId: user.id,
      });
    }
  }
  // The tie-break run: the bot asks a disputed episode once more after a day (db/bot-research.js), on every season.
  if (body.tiebreak !== undefined) {
    if (typeof body.tiebreak !== "boolean") throw new HttpError(400, "tiebreak is true or false");
    if (body.tiebreak !== was.tiebreak.on) {
      await putSetting("tiebreak", body.tiebreak);
      await logDesk(pool, {
        entity: "settings",
        entityId: "tiebreak",
        action: "set",
        text: body.tiebreak ? "Tie-break run on: the bot checks a result disputed for a day" : "Tie-break run off",
        before: was.tiebreak.on,
        after: body.tiebreak,
        undo: { type: "setting", key: "tiebreak", value: was.tiebreak.on },
        userId: user.id,
      });
      nudgeBotClock();
    }
  }
  // Who gets in: an account made from now on waits for an admin, gets in with an invite, or gets in.
  if (body.signups !== undefined) {
    if (!SIGNUP_MODES.includes(body.signups as SignupMode)) throw new HttpError(400, "signups is approve, invites or open");
    const mode = body.signups as SignupMode;
    if (mode !== was.signups.mode) {
      await putSetting("signups", mode);
      await logDesk(pool, {
        entity: "settings",
        entityId: "signups",
        action: "set",
        text: SIGNUP_LINES[mode],
        before: was.signups.mode,
        after: mode,
        undo: { type: "setting", key: "signups", value: was.signups.mode },
        userId: user.id,
      });
    }
  }
  return deskSettings();
}

const SIGNUP_LINES: Record<SignupMode, string> = {
  approve: "Who gets in: every new account waits for an admin",
  invites: "Who gets in: an invite lets people in, anyone else waits",
  open: "Who gets in: anyone who makes an account",
};

/** Puts a setting back (History's Undo). */
export async function restoreSetting(key: string, value: unknown, userId: string): Promise<void> {
  if (key === "confirm_at") {
    await putSetting("confirm_at", value);
    await settleEverything(userId);
  } else if (key === "new_couch_fill") await putSetting("new_couch_fill", value);
  else if (key === "tiebreak") {
    await putSetting("tiebreak", value === true);
    nudgeBotClock();
  } else if (key === "signups" && SIGNUP_MODES.includes(value as SignupMode)) await putSetting("signups", value);
  else throw new HttpError(409, "That setting can't be put back here");
}

/** The desk's Settings lines, newest first. */
export const settingsLines = async () =>
  byNewest([
    ...(await deskLines("settings", "confirm_at")),
    ...(await deskLines("settings", "new_couch_fill")),
    ...(await deskLines("settings", "tiebreak")),
    ...(await deskLines("settings", "signups")),
  ]);

// ---------- Inbox ----------

export interface InboxItem {
  kind: "split" | "stale" | "stranded" | "phase" | "suggestion" | "change";
  title: string;
  line: string;
  href: string;
}

export interface Inbox {
  items: InboxItem[];
  week: { researched: number; confirmed: number; settled: number; rulings: number };
}

const seasonName = `COALESCE(ss.name, s.name || ' ' || ss.season_number)`;
/** League `l` has people playing it and nobody running it (no Commissioner, no site admin among them). */
export const STRANDED = `EXISTS (SELECT 1 FROM league_memberships m WHERE m.league_id = l.id)
  AND NOT EXISTS (SELECT 1 FROM league_memberships m JOIN "user" u ON u.id = m.user_id WHERE m.league_id = l.id AND (m.role = 'commissioner' OR u.role = 'admin'))`;
const DAY = "interval '1 day'";
/** "rewardWin" -> "Reward win": a result's id, readable where the show's own label isn't to hand. */
export const readable = (id: string) => String(id || "").replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim();
/** "Brady · Found an idol", or "Nobody went home" (step 6c's fact about no one). */
const factTitle = (f: { castaway_name: string; kind: string; method: string; event_type: string }) =>
  f.kind === "noexit" ? "Nobody went home" : `${f.castaway_name} · ${f.kind === "event" ? readable(f.event_type) : f.method || f.kind}`;
// An answer for the fact's episode since a flag was raised.
const ANSWER_SINCE = `EXISTS (SELECT 1 FROM episode_research er WHERE er.show_id = ss.show_id AND er.season_number = ss.season_number
  AND er.episode_number = d.episode_number AND er.source <> 'combined' AND er.withdrawn_at IS NULL AND er.researched_at > x.created_at)`;

/**
 * The episodes whose tie-break run hasn't had its say yet, while the desk's switch is on ("season:episode"): their
 * disputes wait for it before they're the admin's. And the ones a tie-break has answered, for the line.
 */
async function tiebreaks(): Promise<{ pending: Set<string>; answered: Set<string> }> {
  const pending = new Set<string>();
  const answered = new Set<string>();
  if (!(await tiebreakOn(pool))) return { pending, answered };
  for (const q of await tiebreakQuestions(pool)) {
    const key = `${q.seasonId}:${q.episode}`;
    if (q.tries.some((t) => t.ok === true)) answered.add(key);
    const at = tiebreakNext(q);
    // Still to come, and not gone stale (three days past due: the bot was down, say).
    if (at && at.next.getTime() - at.due.getTime() <= 3 * 24 * 3600 * 1000) pending.add(key);
  }
  return { pending, answered };
}

/** Only what needs the admin: the community and its couches handle the rest. */
export async function inbox(): Promise<Inbox> {
  const items: InboxItem[] = [];
  // A disputed fact with no flag waiting for an answer is a split the next answer didn't settle; one flagged a day
  // ago with no answer since: either way it's the admin's now. With the tie-break run on (6c part 2), each waits for its
  // episode's tie-break first, and reaches the desk only if that didn't settle it.
  const tie = await tiebreaks();
  const { rows: facts } = await pool.query(
    `SELECT d.id, d.season_id, d.castaway_name, d.kind, d.method, d.event_type, d.episode_number, ${seasonName} AS season,
            EXISTS (SELECT 1 FROM fact_disputes x WHERE x.decision_id = d.id AND x.status = 'open' AND NOT ${ANSWER_SINCE}) AS stale
       FROM season_decisions d JOIN show_seasons ss ON ss.id = d.season_id JOIN shows s ON s.id = ss.show_id
      WHERE d.locked_at IS NULL AND d.fact_status IS NOT NULL
        AND (d.fact_status = 'disputed' OR EXISTS (SELECT 1 FROM fact_disputes x WHERE x.decision_id = d.id AND x.status = 'open'))
        AND NOT EXISTS (SELECT 1 FROM fact_disputes x WHERE x.decision_id = d.id AND x.status = 'open' AND x.created_at > now() - ${DAY} AND NOT ${ANSWER_SINCE})
      ORDER BY d.episode_number DESC LIMIT 30`
  );
  for (const f of facts) {
    const key = `${f.season_id}:${f.episode_number}`;
    if (tie.pending.has(key)) continue;
    const tried = tie.answered.has(key);
    items.push({
      kind: f.stale ? "stale" : "split",
      title: factTitle(f),
      line: `${f.season} · Episode ${f.episode_number} · ${f.stale ? (tried ? "flagged, and the tie-break run didn't settle it" : "flagged a day ago, nothing's checked it") : tried ? "the sources split, the tie-break run too" : "the sources split"}`,
      href: `/desk/fact/${f.id}`,
    });
  }
  // A couch with a game people play that nobody runs: its only commissioner left or deleted their account. A site
  // admin who plays it runs it (classic always let them), so that game isn't stranded.
  const { rows: stranded } = await pool.query(
    `SELECT c.id, c.name, count(DISTINCT l.id)::int AS games, (SELECT count(*)::int FROM couch_members m WHERE m.couch_id = c.id) AS members
       FROM couches c JOIN leagues l ON l.couch_id = c.id
      WHERE ${STRANDED}
      GROUP BY c.id, c.name ORDER BY c.name LIMIT 20`
  );
  for (const c of stranded) {
    items.push({ kind: "stranded", title: `${c.name} has no one running it`, line: `${c.games} ${c.games === 1 ? "game" : "games"} with no commissioner · ${c.members} on the couch`, href: `/desk/couch/${c.id}` });
  }
  // A phase that starts when the show says so (or when N are left), on an airing season, with no confirmed start.
  const { rows: books } = await pool.query(
    `SELECT r.id, r.blocks, r.phase_starts, ${seasonName} AS season FROM rulebooks r JOIN show_seasons ss ON ss.id = r.season_id JOIN shows s ON s.id = ss.show_id
      WHERE r.owner_kind = 'season' AND r.status = 'in_force' AND ss.status = 'airing'`
  );
  for (const b of books) {
    for (const p of b.blocks?.season?.phases ?? []) {
      if (!p?.starts || p.starts.type === "episode" || (b.phase_starts ?? {})[p.id] != null) continue;
      items.push({ kind: "phase", title: `${b.season}: when did ${String(p.name).toLowerCase().startsWith("the ") ? p.name : `the ${p.name}`} start?`, line: "A phase start to confirm · its segments wait until it's set", href: `/desk/rulebook/${b.id}` });
    }
  }
  // Something new the couches split on, or that couldn't go in on its own (step 6c part 2).
  for (const n of await deskNotices()) {
    items.push({ kind: "change", title: `${n.season}: something new in Episode ${n.episode}?`, line: `${n.line ?? "The couches split"} · "${n.note.slice(0, 80)}"`, href: n.rulebookId ? `/desk/rulebook/${n.rulebookId}` : `/desk/season/${n.seasonId}` });
  }
  const { rows: tips } = await pool.query(
    `SELECT g.id, g.note, g.rulebook_id, ${seasonName} AS season, COALESCE(u.username, u.name) AS who
       FROM rulebook_suggestions g JOIN show_seasons ss ON ss.id = g.season_id JOIN shows s ON s.id = ss.show_id LEFT JOIN "user" u ON u.id = g.user_id
      WHERE g.status = 'open' ORDER BY g.created_at LIMIT 20`
  );
  for (const t of tips) {
    items.push({ kind: "suggestion", title: `A fix for ${t.season}'s rulebook`, line: `From ${t.who ?? "someone"} · "${String(t.note).slice(0, 80)}"`, href: t.rulebook_id ? `/desk/rulebook/${t.rulebook_id}` : "/desk/find" });
  }

  const count = async (sql: string) => (await pool.query(sql)).rows[0].n as number;
  const week = {
    researched: await count(`SELECT count(DISTINCT (show_id, season_number, episode_number))::int AS n FROM episode_research WHERE source <> 'combined' AND withdrawn_at IS NULL AND researched_at > now() - interval '7 days'`),
    confirmed: await count(`SELECT count(*)::int AS n FROM season_decisions WHERE fact_status = 'confirmed' AND decided_at > now() - interval '7 days'`),
    settled: await count(`SELECT count(*)::int AS n FROM fact_disputes WHERE status IN ('kept', 'upheld', 'checked') AND settled_at > now() - interval '7 days'`),
    rulings: await count(`SELECT count(DISTINCT decision_id)::int AS n FROM league_rulings WHERE created_at > now() - interval '7 days'`),
  };
  return { items, week };
}

// ---------- Find ----------

export interface FoundItem {
  kind: "show" | "season" | "castaway" | "couch" | "person" | "rulebook" | "fact";
  title: string;
  line: string;
  href: string;
}

/** One search over everything the desk can change. An empty search lists what's airing. */
export async function find(q: string): Promise<FoundItem[]> {
  const term = q.trim();
  if (!term) {
    const { rows } = await pool.query(
      `SELECT ss.id, ${seasonName} AS name, ss.status FROM show_seasons ss JOIN shows s ON s.id = ss.show_id
        WHERE ss.status = 'airing' ORDER BY s.name, ss.season_number LIMIT 12`
    );
    return rows.map((r) => ({ kind: "season" as const, title: r.name, line: "Season · airing", href: `/desk/season/${r.id}` }));
  }
  const like = `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const out: FoundItem[] = [];
  const { rows: shows } = await pool.query(
    `SELECT s.id, s.name, (SELECT count(*)::int FROM show_seasons ss WHERE ss.show_id = s.id) AS seasons FROM shows s WHERE s.name ILIKE $1 ORDER BY s.name LIMIT 6`,
    [like]
  );
  out.push(...shows.map((r) => ({ kind: "show" as const, title: r.name, line: `Show · ${r.seasons} ${r.seasons === 1 ? "season" : "seasons"}`, href: `/desk/show/${r.id}` })));
  const { rows: seasons } = await pool.query(
    `SELECT ss.id, ${seasonName} AS name, ss.status, r.id AS rulebook FROM show_seasons ss JOIN shows s ON s.id = ss.show_id
       LEFT JOIN rulebooks r ON r.owner_kind = 'season' AND r.season_id = ss.id AND r.status <> 'archived'
      WHERE ${seasonName} ILIKE $1 OR (s.name || ' season ' || ss.season_number) ILIKE $1 ORDER BY s.name, ss.season_number DESC LIMIT 8`,
    [like]
  );
  for (const r of seasons) {
    out.push({ kind: "season", title: r.name, line: `Season · ${r.status ?? "upcoming"}`, href: `/desk/season/${r.id}` });
    if (r.rulebook) out.push({ kind: "rulebook", title: `${r.name} · rulebook`, line: "Rulebook", href: `/desk/rulebook/${r.rulebook}` });
  }
  const { rows: cast } = await pool.query(
    `SELECT sc.id, sc.name, ${seasonName} AS season FROM season_cast sc JOIN show_seasons ss ON ss.id = sc.season_id JOIN shows s ON s.id = ss.show_id
      WHERE sc.name ILIKE $1 ORDER BY sc.name LIMIT 10`,
    [like]
  );
  out.push(...cast.map((r) => ({ kind: "castaway" as const, title: r.name, line: `Cast · ${r.season}`, href: `/desk/castaway/${r.id}` })));
  const { rows: couches } = await pool.query(
    `SELECT c.id, c.name, (SELECT count(*)::int FROM couch_members m WHERE m.couch_id = c.id) AS members FROM couches c WHERE c.name ILIKE $1 ORDER BY c.name LIMIT 6`,
    [like]
  );
  out.push(...couches.map((r) => ({ kind: "couch" as const, title: r.name, line: `Couch · ${r.members} on it`, href: `/desk/couch/${r.id}` })));
  const { rows: people } = await pool.query(
    `SELECT u.id, COALESCE(u.username, u.name) AS name, (SELECT count(*)::int FROM couch_members m WHERE m.user_id = u.id) AS couches
       FROM "user" u WHERE u.username ILIKE $1 OR u.name ILIKE $1 ORDER BY u.username LIMIT 6`,
    [like]
  );
  out.push(...people.map((r) => ({ kind: "person" as const, title: r.name, line: `Person · ${r.couches} ${r.couches === 1 ? "couch" : "couches"}`, href: `/desk/person/${r.id}` })));
  const { rows: facts } = await pool.query(
    `SELECT d.id, d.castaway_name, d.kind, d.method, d.event_type, d.episode_number, d.fact_status, ${seasonName} AS season
       FROM season_decisions d JOIN show_seasons ss ON ss.id = d.season_id JOIN shows s ON s.id = ss.show_id
      WHERE d.castaway_name ILIKE $1 AND d.fact_status IN ('reported', 'confirmed', 'disputed') ORDER BY d.episode_number DESC LIMIT 8`,
    [like]
  );
  out.push(
    ...facts.map((r) => ({
      kind: "fact" as const,
      title: factTitle(r),
      line: `${r.season} · Episode ${r.episode_number} · ${r.fact_status}`,
      href: `/desk/fact/${r.id}`,
    }))
  );
  return out;
}
