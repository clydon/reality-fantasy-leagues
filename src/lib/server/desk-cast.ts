import StateLogic from "@/lib/game/state-logic.js";
import { publicMediaSrc } from "@/lib/game/selectors";
import { ensureSeasonRulebook } from "@db/rulebooks.js";
import { isUuid, type SessionUser } from "./auth-helpers";
import { pool, withLeagueLock, HttpError } from "./db";
import { byNewest, deskLines, logDesk, type DeskLine } from "./desk";
import { hasSchedule, latestAired, seasonSchedules } from "./schedule";
import { applyApprovedCastToLeagues, renameInSeasonDecisions, seasonCastRows } from "./season-cast";

// A season and its cast on the desk (docs/PLAN-new-design.md step 6b part 2; the mock's community.js adminEntity): a
// season's rulebook and its cast grouped as they start (its episodes have pages of their own, part 4b); a castaway's name, group and
// photo, each with Override (it reaches every league on the season at once, through the cast link, as an admin's cast
// edit always has), a Lock (no commissioner's cast entry can change them) and History. A group the cast was given that
// is really a secret role (Traitors 5's "Traitor" and "Faithful", noticed in step 3) can be taken out: off the season's
// cast, and out of every league on it, so no board shows who the Traitors are.

const seasonName = `COALESCE(ss.name, s.name || ' ' || ss.season_number)`;

interface SeasonRow {
  id: string;
  name: string;
  show_id: string;
  show_name: string;
  slug: string;
  season_number: number;
  status: string | null;
  cast_approved_at: Date | null;
  tribes_from_episode: number | null;
  rulebook_live: boolean;
}

async function seasonRow(id: string): Promise<SeasonRow> {
  if (!isUuid(id)) throw new HttpError(404, "Season not found");
  const { rows } = await pool.query<SeasonRow>(
    `SELECT ss.id, ${seasonName} AS name, ss.show_id, s.name AS show_name, s.slug, ss.season_number, ss.status, ss.cast_approved_at, ss.tribes_from_episode, ss.rulebook_live
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1`,
    [id]
  );
  if (!rows.length) throw new HttpError(404, "Season not found");
  return rows[0];
}

const leaguesOn = async (s: SeasonRow) =>
  (await pool.query("SELECT id, name, couch_id FROM leagues WHERE state->'settings'->>'showId' = $1 AND state->'settings'->>'wikiSeason' = $2 ORDER BY name", [s.slug, String(s.season_number)])).rows as {
    id: string;
    name: string;
    couch_id: string | null;
  }[];

export interface DeskSeason {
  id: string;
  name: string;
  show: { id: string; name: string };
  status: string | null;
  leagues: number;
  couches: number;
  rulebook: { id: string; version: number; live: boolean; everywhere: boolean; edited: boolean } | null;
  groups: { name: string; people: number; secretRole: boolean }[];
  cast: { id: string; name: string; group: string | null; photo: string | null; locked: boolean }[];
  aired: number;
  /** Something says when its episodes air (its premiere, a listing's dates or a drop): the Inbox's "no schedule" while airing. */
  scheduled: boolean;
  /** Its cast is sent to its games (approved), or it has none: the Inbox's cast item while it isn't (docs/PLAN-desk-parity.md step 2). */
  castSent: boolean;
}

/** A season's desk page. Makes its rulebook if it has none (an unedited mirror of its show's format, R3's ensure). */
export async function deskSeason(id: string): Promise<DeskSeason> {
  const s = await seasonRow(id);
  const book = await ensureSeasonRulebook(pool, id);
  const { rows: flag } = await pool.query("SELECT value FROM app_settings WHERE key = 'rulebooks'");
  const leagues = await leaguesOn(s);
  const cast = (await pool.query("SELECT id, name, tribe_name, photo_url, locked_at FROM season_cast WHERE season_id = $1 ORDER BY sort_order, name", [id])).rows;
  // A group named for a secret role (the rulebook's, or the Traitors' own words) gives the role away.
  const roles = new Set<string>(
    ((book?.row.blocks.twists ?? []) as { type: string; roles?: string[] }[]).filter((t) => t.type === "secretRole").flatMap((t) => (t.roles ?? []).map((r) => r.toLowerCase()))
  );
  const groups = new Map<string, number>();
  for (const c of cast) if (c.tribe_name) groups.set(c.tribe_name, (groups.get(c.tribe_name) ?? 0) + 1);
  const schedule = (await seasonSchedules([id])).get(id);
  return {
    id,
    name: s.name,
    show: { id: s.show_id, name: s.show_name },
    status: s.status,
    leagues: leagues.length,
    couches: new Set(leagues.map((l) => l.couch_id).filter(Boolean)).size,
    rulebook: book ? { id: book.row.id, version: book.row.version, live: s.rulebook_live, everywhere: flag[0]?.value === true, edited: book.row.compiledSource === "blocks" } : null,
    groups: [...groups].map(([name, people]) => ({ name, people, secretRole: roles.has(name.toLowerCase()) || /^(traitors?|faithfuls?)$/i.test(name) })),
    cast: cast.map((c) => ({ id: c.id, name: c.name, group: c.tribe_name, photo: publicMediaSrc(c.photo_url), locked: !!c.locked_at })),
    aired: latestAired(schedule) ?? 0,
    scheduled: hasSchedule(schedule),
    castSent: !!s.cast_approved_at || !cast.length,
  };
}

export interface DeskCastaway {
  id: string;
  name: string;
  group: string | null;
  photo: string | null;
  photoUrl: string | null;
  locked: boolean;
  season: { id: string; name: string };
  reach: string;
  groups: string[];
  history: DeskLine[];
}

async function castRow(id: string) {
  if (!isUuid(id)) throw new HttpError(404, "Not in any season's cast");
  const { rows } = await pool.query("SELECT id, season_id, name, tribe_name, photo_url, locked_at FROM season_cast WHERE id = $1", [id]);
  if (!rows.length) throw new HttpError(404, "Not in any season's cast");
  return rows[0];
}

export async function deskCastaway(id: string): Promise<DeskCastaway> {
  const c = await castRow(id);
  const s = await seasonRow(c.season_id);
  const leagues = await leaguesOn(s);
  const { rows: changes } = await pool.query(
    `SELECT c.field, c.before, c.after, c.changed_at, COALESCE(u.username, u.name) AS who, l.name AS league
       FROM season_cast_changes c LEFT JOIN "user" u ON u.id = c.changed_by LEFT JOIN leagues l ON l.id = c.by_league
      WHERE c.season_cast_id = $1 ORDER BY c.changed_at DESC LIMIT 30`,
    [id]
  );
  const { rows: groups } = await pool.query("SELECT DISTINCT tribe_name FROM season_cast WHERE season_id = $1 AND tribe_name IS NOT NULL ORDER BY 1", [c.season_id]);
  const field = (f: string) => ({ name: "name", photo: "photo", tribe: "group", added: "added" })[f] ?? f;
  return {
    id,
    name: c.name,
    group: c.tribe_name,
    photo: publicMediaSrc(c.photo_url),
    photoUrl: c.photo_url,
    locked: !!c.locked_at,
    season: { id: s.id, name: s.name },
    reach: `Every league on ${s.name} · ${leagues.length} ${leagues.length === 1 ? "league" : "leagues"}`,
    groups: groups.map((g) => g.tribe_name),
    history: byNewest([
      ...changes.map((r) => ({
        id: null,
        text: `${r.who ?? "Someone"} changed the ${field(r.field)}${r.before || r.after ? `: ${r.before ?? "none"} → ${r.after ?? "none"}` : ""}${r.league ? ` · from ${r.league}` : ""}`,
        at: r.changed_at.toISOString(),
        who: null,
        undoable: false,
        undone: false,
      })),
      ...(await deskLines("castaway", id)),
    ]),
  };
}

type CastField = "name" | "group" | "photo";

/** Writes one field of a cast row, logs it in season_cast_changes, and takes the cast to every league on the season. */
async function writeCastField(userId: string, id: string, field: CastField, value: string | null) {
  const c = await castRow(id);
  const s = await seasonRow(c.season_id);
  const log = (f: string, before: string | null, after: string | null) =>
    pool.query("INSERT INTO season_cast_changes (season_id, season_cast_id, field, before, after, changed_by) VALUES ($1, $2, $3, $4, $5, $6)", [c.season_id, id, f, before, after, userId]);
  try {
    if (field === "name") {
      if (!value) throw new HttpError(400, "A name can't be empty");
      await pool.query("UPDATE season_cast SET name = $2 WHERE id = $1", [id, value]);
      await renameInSeasonDecisions(pool, c.season_id, c.name, value);
      await log("name", c.name, value);
    } else if (field === "photo") {
      await pool.query("UPDATE season_cast SET photo_url = $2 WHERE id = $1", [id, value]);
      await log("photo", c.photo_url, value);
    } else {
      await pool.query("UPDATE season_cast SET tribe_name = $2 WHERE id = $1", [id, value]);
      await log("tribe", c.tribe_name, value);
    }
  } catch (e) {
    if ((e as { code?: string }).code === "23505") throw new HttpError(409, "Someone in this season's cast already has that name");
    throw e;
  }
  if (s.cast_approved_at) await applyApprovedCastToLeagues(s.slug, s.season_number, await seasonCastRows(c.season_id), s.tribes_from_episode ?? null);
  return { before: field === "name" ? c.name : field === "photo" ? c.photo_url : c.tribe_name };
}

/** Override: an admin's change to a castaway's name, group or photo, for every league on the season. */
export async function overrideCastaway(user: SessionUser, id: string, body: { field?: unknown; value?: unknown }): Promise<DeskCastaway> {
  const field = body.field as CastField;
  if (!["name", "group", "photo"].includes(field)) throw new HttpError(400, "field is name, group or photo");
  const value = typeof body.value === "string" && body.value.trim() ? body.value.trim().slice(0, 300) : null;
  const { before } = await writeCastField(user.id, id, field, value);
  await logDesk(pool, {
    entity: "castaway",
    entityId: id,
    action: "override",
    text: `Overrode the ${field}: ${before ?? "none"} → ${value ?? "none"}`,
    before,
    after: value,
    undo: { type: "castaway", id, field, value: before },
    userId: user.id,
  });
  return deskCastaway(id);
}

/** History's Undo of an override: the field goes back. */
export async function restoreCastaway(userId: string, id: string, field: CastField, value: string | null): Promise<void> {
  await writeCastField(userId, id, field, value);
}

/** Locked: no commissioner's cast entry changes them (season-cast-write.ts); the admin still can. */
export async function lockCastaway(user: SessionUser, id: string, locked: boolean): Promise<DeskCastaway> {
  await castRow(id);
  await pool.query("UPDATE season_cast SET locked_at = CASE WHEN $2 THEN now() ELSE NULL END WHERE id = $1", [id, locked]);
  await logDesk(pool, { entity: "castaway", entityId: id, action: locked ? "lock" : "unlock", text: locked ? "Locked: only the desk changes them" : "Unlocked", undo: { type: "castawayLock", id, locked: !locked }, userId: user.id });
  return deskCastaway(id);
}

export async function setCastawayLock(id: string, locked: boolean) {
  await pool.query("UPDATE season_cast SET locked_at = CASE WHEN $2 THEN now() ELSE NULL END WHERE id = $1", [id, locked]);
}

/**
 * A group that is really a secret role: off everyone in the season's cast, and out of every league on the season
 * (StateLogic.removeTribe: nobody starts on it, moves into it read as none, and it's gone from the boards). `preview`
 * says what it would do and changes nothing.
 */
export async function clearGroup(user: SessionUser, seasonId: string, body: { group?: unknown; preview?: unknown }) {
  const s = await seasonRow(seasonId);
  const group = typeof body.group === "string" ? body.group.trim() : "";
  const { rows } = await pool.query("SELECT id FROM season_cast WHERE season_id = $1 AND lower(tribe_name) = lower($2)", [seasonId, group]);
  if (!group || !rows.length) throw new HttpError(404, "Nobody in this season's cast is in that group");
  const leagues = await leaguesOn(s);
  const { rows: having } = await pool.query(
    `SELECT l.id FROM leagues l WHERE l.id = ANY($1::uuid[]) AND EXISTS (SELECT 1 FROM jsonb_array_elements(l.state->'tribes') t WHERE lower(t->>'name') = lower($2))`,
    [leagues.map((l) => l.id), group]
  );
  if (body.preview === true) return { people: rows.length, leagues: having.length };
  const ids = rows.map((r) => r.id as string);
  await pool.query("UPDATE season_cast SET tribe_name = NULL WHERE id = ANY($1::uuid[])", [ids]);
  for (const id of ids) {
    await pool.query("INSERT INTO season_cast_changes (season_id, season_cast_id, field, before, after, changed_by) VALUES ($1, $2, 'tribe', $3, NULL, $4)", [seasonId, id, group, user.id]);
  }
  for (const l of having) {
    await withLeagueLock(
      l.id,
      (state) => {
        for (const t of state.tribes.filter((x) => x.name.toLowerCase() === group.toLowerCase())) StateLogic.removeTribe(state, t.id);
      },
      { userId: user.id, kind: "cast", tier: 1, text: `An admin took out the ${group} group: it's a secret role, not a group` }
    );
  }
  await logDesk(pool, {
    entity: "season",
    entityId: seasonId,
    action: "clearGroup",
    text: `Took out the ${group} group (${ids.length} people, ${having.length} ${having.length === 1 ? "league" : "leagues"}): a secret role, not a group`,
    undo: { type: "group", seasonId, group, ids },
    userId: user.id,
  });
  return { people: ids.length, leagues: having.length };
}

/** History's Undo: the group goes back on the same people, and the leagues get it as a starting group again. */
export async function restoreGroup(seasonId: string, group: string, ids: string[]): Promise<void> {
  const s = await seasonRow(seasonId);
  await pool.query("UPDATE season_cast SET tribe_name = $2 WHERE id = ANY($1::uuid[])", [ids, group]);
  if (s.cast_approved_at) await applyApprovedCastToLeagues(s.slug, s.season_number, await seasonCastRows(seasonId), s.tribes_from_episode ?? null);
}

/** The season's own History: the desk's lines for it (a group taken out, its rulebook switched on). */
export const seasonLines = (id: string) => deskLines("season", id);
