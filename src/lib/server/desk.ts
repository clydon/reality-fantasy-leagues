import type { Pool, PoolClient } from "pg";
import { TIEBREAK_AFTER_MS, tiebreakOn } from "@db/bot-research.js";
import { isSuperAdminUser, requireAuth, type SessionUser } from "./auth-helpers";
import { confirmAt, settleEverything } from "./community-results";
import { pool, HttpError } from "./db";
import { autopilotSeasons, nudgeBotClock, tiebreakReach } from "./desk-bot";
import { signupMode, waitingCount } from "./way-in";
import { SIGNUP_MODES, type SignupMode } from "@/lib/signups";

// The admin's desk (docs/PLAN-new-design.md step 6b part 2; the mock's community.js admin): results settle by
// community, and the admin is the exception desk. Three tabs from the profile menu: Inbox (desk-inbox.ts: only what needs
// the admin, most urgent first, and the week), Find (one search over
// shows, seasons, castaways, couches, people and rulebooks; each has a page with Override, a Lock and its History) and
// Settings. Every change the desk makes is a row in admin_changes (0113), with its undo where it has one.

export type DeskEntity = "fact" | "castaway" | "season" | "rulebook" | "couch" | "settings" | "show" | "person" | "report";

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
): Promise<DeskSettings & { changeIds: string[] }> {
  const was = await deskSettings();
  // The changes made, for the toast's Undo (each sheet changes one setting; a PUT may change several).
  const changeIds: string[] = [];
  if (body.confirmAt !== undefined) {
    const n = Number(body.confirmAt);
    if (!Number.isInteger(n) || n < 2 || n > 5) throw new HttpError(400, "Confirmed needs 2 to 5 sources");
    if (n !== was.confirmAt) {
      await putSetting("confirm_at", n);
      changeIds.push(await logDesk(pool, { entity: "settings", entityId: "confirm_at", action: "set", text: `Sources to confirm a result: ${n} that agree`, before: was.confirmAt, after: n, undo: { type: "setting", key: "confirm_at", value: was.confirmAt }, userId: user.id }));
      await settleEverything(user.id);
    }
  }
  if (body.newCouchesAnyone !== undefined) {
    if (typeof body.newCouchesAnyone !== "boolean") throw new HttpError(400, "newCouchesAnyone is true or false");
    if (body.newCouchesAnyone !== was.newCouchesAnyone) {
      await putSetting("new_couch_fill", body.newCouchesAnyone);
      changeIds.push(
        await logDesk(pool, {
        entity: "settings",
        entityId: "new_couch_fill",
        action: "set",
        text: body.newCouchesAnyone ? "New couches: anyone on the couch fills in results" : "New couches: only people who run games fill in results",
        before: was.newCouchesAnyone,
        after: body.newCouchesAnyone,
        undo: { type: "setting", key: "new_couch_fill", value: was.newCouchesAnyone },
        userId: user.id,
      })
      );
    }
  }
  // The tie-break run: the bot asks a disputed episode once more after a day (db/bot-research.js), on every season.
  if (body.tiebreak !== undefined) {
    if (typeof body.tiebreak !== "boolean") throw new HttpError(400, "tiebreak is true or false");
    if (body.tiebreak !== was.tiebreak.on) {
      await putSetting("tiebreak", body.tiebreak);
      changeIds.push(
        await logDesk(pool, {
        entity: "settings",
        entityId: "tiebreak",
        action: "set",
        text: body.tiebreak ? "When a result is disputed: the bot asks again after a day" : "When a result is disputed: it waits for a couch to check again",
        before: was.tiebreak.on,
        after: body.tiebreak,
        undo: { type: "setting", key: "tiebreak", value: was.tiebreak.on },
        userId: user.id,
      })
      );
      nudgeBotClock();
    }
  }
  // Who gets in: an account made from now on waits for an admin, gets in with an invite, or gets in.
  if (body.signups !== undefined) {
    if (!SIGNUP_MODES.includes(body.signups as SignupMode)) throw new HttpError(400, "signups is approve, invites or open");
    const mode = body.signups as SignupMode;
    if (mode !== was.signups.mode) {
      await putSetting("signups", mode);
      changeIds.push(
        await logDesk(pool, {
        entity: "settings",
        entityId: "signups",
        action: "set",
        text: SIGNUP_LINES[mode],
        before: was.signups.mode,
        after: mode,
        undo: { type: "setting", key: "signups", value: was.signups.mode },
        userId: user.id,
      })
      );
    }
  }
  return { ...(await deskSettings()), changeIds };
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

// ---------- shared by the Inbox (desk-inbox.ts) and Find ----------

/** A season's name, as SQL over `show_seasons ss` joined to `shows s`. */
export const SEASON_NAME = `COALESCE(ss.name, s.name || ' ' || ss.season_number)`;
const seasonName = SEASON_NAME;
/** League `l` has people playing it and nobody running it (no Commissioner, no site admin among them). */
export const STRANDED = `EXISTS (SELECT 1 FROM league_memberships m WHERE m.league_id = l.id)
  AND NOT EXISTS (SELECT 1 FROM league_memberships m JOIN "user" u ON u.id = m.user_id WHERE m.league_id = l.id AND (m.role = 'commissioner' OR u.role = 'admin'))`;
/** "rewardWin" -> "Reward win": a result's id, readable where the show's own label isn't to hand. */
export const readable = (id: string) => String(id || "").replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim();
/** "Brady · Found an idol", or "Nobody went home" (step 6c's fact about no one). */
export const factTitle = (f: { castaway_name: string; kind: string; method: string; event_type: string }) =>
  f.kind === "noexit" ? "Nobody went home" : `${f.castaway_name} · ${f.kind === "event" ? readable(f.event_type) : f.method || f.kind}`;

// ---------- Find ----------

/**
 * Browse's line for the Library (docs/PLAN-desk-parity.md step 1, Find › Browse): its starting points, the seasons'
 * rulebooks (as its In use lists them), and new ones nobody on another couch has checked (as the Inbox's).
 */
export async function libraryCounts(): Promise<{ templates: number; inUse: number; unchecked: number }> {
  const { rows } = await pool.query(
    `SELECT count(*) FILTER (WHERE r.owner_kind = 'library' AND r.is_template)::int AS templates,
            count(*) FILTER (WHERE r.owner_kind = 'season' AND s.archived = false)::int AS "inUse",
            count(*) FILTER (WHERE r.owner_kind = 'season' AND s.archived = false AND r.provenance->>'from' = 'made' AND r.review_status = 'unreviewed')::int AS unchecked
       FROM rulebooks r LEFT JOIN show_seasons ss ON ss.id = r.season_id LEFT JOIN shows s ON s.id = ss.show_id
      WHERE r.status <> 'archived'`
  );
  return rows[0];
}

export interface FoundItem {
  kind: "show" | "season" | "castaway" | "couch" | "person" | "rulebook" | "fact";
  title: string;
  line: string;
  href: string;
}

/**
 * One search over everything the desk can change but people (desk-people.ts findPeople: Find shows a few and links the
 * rest to People, searched). An empty search lists what's airing.
 */
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
  // The library's rulebooks by name (step 10 part 3): its starting points and drafts.
  const { rows: library } = await pool.query(
    `SELECT id, name, is_template FROM rulebooks WHERE owner_kind = 'library' AND status <> 'archived' AND name ILIKE $1 ORDER BY is_template DESC, name LIMIT 6`,
    [like]
  );
  out.push(...library.map((r) => ({ kind: "rulebook" as const, title: r.name, line: r.is_template ? "Library · a starting point" : "Library · a draft", href: `/desk/rulebook/${r.id}` })));
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
    `SELECT sc.id, sc.season_id, sc.name, ${seasonName} AS season FROM season_cast sc JOIN show_seasons ss ON ss.id = sc.season_id JOIN shows s ON s.id = ss.show_id
      WHERE sc.name ILIKE $1 ORDER BY sc.name LIMIT 10`,
    [like]
  );
  out.push(...cast.map((r) => ({ kind: "castaway" as const, title: r.name, line: `Cast · ${r.season}`, href: `/desk/season/${r.season_id}/c/${r.id}` })));
  const { rows: couches } = await pool.query(
    `SELECT c.id, c.name, (SELECT count(*)::int FROM couch_members m WHERE m.couch_id = c.id) AS members FROM couches c WHERE c.name ILIKE $1 ORDER BY c.name LIMIT 6`,
    [like]
  );
  out.push(...couches.map((r) => ({ kind: "couch" as const, title: r.name, line: `Couch · ${r.members} on it`, href: `/desk/couch/${r.id}` })));
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
