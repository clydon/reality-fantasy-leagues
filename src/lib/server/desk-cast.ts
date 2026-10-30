import type { Pool, PoolClient } from "pg";
import StateLogic from "@/lib/game/state-logic.js";
import { publicMediaSrc } from "@/lib/game/selectors";
import { pluralWord, showWords } from "@/lib/game/show-words";
import type { LeagueState } from "@/lib/game/types";
import { castChanges, type TheirCastaway } from "@/lib/desk-cast-diff";
import { ensureSeasonRulebook } from "@db/rulebooks.js";
import { isUuid, type SessionUser } from "./auth-helpers";
import { pool, tx, withLeagueLock, HttpError } from "./db";
import { byNewest, deskLines, logDesk, type DeskLine } from "./desk";
import { plural } from "./desk-dates";
import { hasSchedule, latestAired, seasonSchedules } from "./schedule";
import { LEAGUE_SEASON_JOIN } from "./league-season";
import { castPhotosFor } from "./show-art";
import { applyApprovedCastToLeagues, renameInSeasonDecisions, seasonCastRows, tribesDue } from "./season-cast";

// A season and its cast on the desk (docs/PLAN-new-design.md step 6b part 2; docs/PLAN-desk-parity.md step 5): a season's
// rulebook (its cast is the Cast page's, desk-cast-page.ts); and (part 5b, the mock's desk-cast.js csPersonPage) a castaway's
// page under its season's Cast: their photo in the lower third (Still in, Out, New), how many teams have them, Name, Photo (a
// link, No photo, or Look on TMDB and TVmaze) and Starting group, each with Override reaching every game on the season (through
// the cast link, as an admin's cast edit always has) with Undo; Lock (no answer or commissioner's cast entry changes them),
// History, and Remove, last: refused while a team, pick, result or call has them (Remove is for someone listed by mistake),
// otherwise out of the cast and every game on the season (classic's Remove never reached the games: Noticed h).
//
// Its starting groups (the Cast page's): Not a <group> takes one off the cast and out of every game; a group named like a
// secret role (Traitors 5's "Traitor" and "Faithful") goes with every other one so named, since one left behind still gives
// the role away. Hold them until Episode 1 (tribes_from_episode) is changed without un-approving the cast (Noticed i).

const seasonName = `COALESCE(ss.name, s.name || ' ' || ss.season_number)`;

/** The roles a season's rulebook keeps secret, lowercased: a group named like one gives the role away. */
export const secretRolesOf = (blocks: { twists?: unknown } | null | undefined) =>
  new Set<string>(((blocks?.twists ?? []) as { type: string; roles?: string[] }[]).filter((t) => t.type === "secretRole").flatMap((t) => (t.roles ?? []).map((r) => r.toLowerCase())));

/** A group named like a secret role (the rulebook's, or the Traitors' own words). */
export const isSecretRole = (name: string, roles: Set<string>) => roles.has(name.toLowerCase()) || /^(traitors?|faithfuls?)$/i.test(name);

const secretRoles = async (id: string) => secretRolesOf((await ensureSeasonRulebook(pool, id))?.row.blocks);

/** "Toka", "Faithful and Traitor", "A, B and C". */
const and = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const firstOf = (name: string) => name.split(" ")[0];

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
  castaway_term: string | null;
  castaway_plural: string | null;
  tribe_term: string | null;
  tribe_plural: string | null;
}

async function seasonRow(id: string): Promise<SeasonRow> {
  if (!isUuid(id)) throw new HttpError(404, "Season not found");
  const { rows } = await pool.query<SeasonRow>(
    `SELECT ss.id, ${seasonName} AS name, ss.show_id, s.name AS show_name, s.slug, ss.season_number, ss.status, ss.cast_approved_at, ss.tribes_from_episode, ss.rulebook_live,
            s.castaway_term, s.castaway_plural, s.tribe_term, s.tribe_plural
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1`,
    [id]
  );
  if (!rows.length) throw new HttpError(404, "Season not found");
  return rows[0];
}

/** What the show calls its people and their groups ("castaway", "tribes"); the Cast page's words too. */
export function termsOf(s: { castaway_term: string | null; castaway_plural?: string | null; tribe_term: string | null; tribe_plural?: string | null }) {
  const w = showWords({ castaway: s.castaway_term, people: s.castaway_plural });
  const group = (s.tribe_term?.trim() || "Group").toLowerCase();
  return { person: w.person.toLowerCase(), people: w.people.toLowerCase(), group, groups: s.tribe_plural?.trim().toLowerCase() || pluralWord(group) };
}

/** Every league on the season, deleted ones too (a write keeps them all in step). */
const leaguesOn = async (s: SeasonRow) =>
  (await pool.query("SELECT id, name, couch_id FROM leagues WHERE state->'settings'->>'showId' = $1 AND state->'settings'->>'wikiSeason' = $2 ORDER BY name", [s.slug, String(s.season_number)])).rows as {
    id: string;
    name: string;
    couch_id: string | null;
  }[];

/** The season's games as the desk counts them (the Cast page's): not deleted, not archived. */
export const gamesOn = async (id: string): Promise<number> =>
  (await pool.query(`SELECT count(*)::int AS n FROM leagues l ${LEAGUE_SEASON_JOIN} WHERE ss.id = $1 AND l.deleted_at IS NULL AND COALESCE(l.state->'settings'->>'archivedAt', '') = ''`, [id])).rows[0].n;

/** Each group's colour, as its games draw it. */
export async function groupColors(id: string): Promise<Map<string, string>> {
  const { rows } = await pool.query(`SELECT l.state->'tribes' AS tribes FROM leagues l ${LEAGUE_SEASON_JOIN} WHERE ss.id = $1 AND jsonb_array_length(COALESCE(l.state->'tribes', '[]'::jsonb)) > 0 LIMIT 1`, [id]);
  return new Map(((rows[0]?.tribes ?? []) as { name: string; color: string }[]).map((t) => [t.name.toLowerCase(), t.color]));
}

export interface DeskSeason {
  id: string;
  name: string;
  show: { id: string; name: string };
  status: string | null;
  leagues: number;
  couches: number;
  rulebook: { id: string; version: number; live: boolean; everywhere: boolean; edited: boolean } | null;
  aired: number;
  /** Something says when its episodes air (its premiere, a listing's dates or a drop): the Inbox's "no schedule" while airing. */
  scheduled: boolean;
}

/** A season's desk page. Makes its rulebook if it has none (an unedited mirror of its show's format, R3's ensure). Its cast and
 *  groups are the Cast page's (part 5a; Noticed bi: no longer read here). */
export async function deskSeason(id: string): Promise<DeskSeason> {
  const s = await seasonRow(id);
  const book = await ensureSeasonRulebook(pool, id);
  const { rows: flag } = await pool.query("SELECT value FROM app_settings WHERE key = 'rulebooks'");
  const leagues = await leaguesOn(s);
  const schedule = (await seasonSchedules([id])).get(id);
  return {
    id,
    name: s.name,
    show: { id: s.show_id, name: s.show_name },
    status: s.status,
    leagues: leagues.length,
    couches: new Set(leagues.map((l) => l.couch_id).filter(Boolean)).size,
    rulebook: book ? { id: book.row.id, version: book.row.version, live: s.rulebook_live, everywhere: flag[0]?.value === true, edited: book.row.compiledSource === "blocks" } : null,
    aired: latestAired(schedule) ?? 0,
    scheduled: hasSchedule(schedule),
  };
}

// ---------- a castaway's page ----------

interface CastRow {
  id: string;
  season_id: string;
  name: string;
  tribe_name: string | null;
  photo_url: string | null;
  locked_at: Date | null;
}

async function castRow(id: string): Promise<CastRow> {
  if (!isUuid(id)) throw new HttpError(404, "Not in any season's cast");
  const { rows } = await pool.query<CastRow>("SELECT id, season_id, name, tribe_name, photo_url, locked_at FROM season_cast WHERE id = $1", [id]);
  if (!rows.length) throw new HttpError(404, "Not in any season's cast");
  return rows[0];
}

/** Where a photo came from, by its address. */
const photoFrom = (url: string | null) => (!url ? "None yet" : /tmdb\.org/i.test(url) ? "From TMDB" : /tvmaze/i.test(url) ? "From TVmaze" : "A link");

export interface CastawayUse {
  /** Teams that have them, across its games. */
  teams: number;
  /** The games where a team, pick or result has them. */
  games: { id: string; name: string; couch: string | null; teams: number }[];
  /** Episodes whose results (the season's, staged or accepted) name them. */
  episodes: number[];
  /** Calls and couch polls that name them. */
  calls: number;
}

/** What has them: teams, picks and results in its games, the season's results, and people's calls. */
async function usesOf(c: CastRow, seasonId: string): Promise<CastawayUse> {
  const [{ rows: games }, { rows: results }, { rows: calls }] = await Promise.all([
    pool.query(`SELECT l.id, l.name, co.name AS couch, l.state FROM leagues l ${LEAGUE_SEASON_JOIN} LEFT JOIN couches co ON co.id = l.couch_id WHERE ss.id = $1 AND l.deleted_at IS NULL ORDER BY l.name`, [seasonId]),
    pool.query(
      `SELECT DISTINCT episode_number AS ep FROM season_decisions WHERE season_id = $1 AND status <> 'rejected'
          AND (lower(castaway_name) = lower($2) OR lower(applied->>'castawayName') = lower($2)) ORDER BY 1`,
      [seasonId, c.name]
    ),
    pool.query(
      `SELECT (SELECT count(*)::int FROM episode_calls WHERE season_id = $1 AND question = 'out' AND answer = $2)
            + (SELECT count(*)::int FROM couch_polls WHERE season_id = $1 AND cast_poll AND options @> jsonb_build_array(jsonb_build_object('key', $2::text))) AS n`,
      [seasonId, c.id]
    ),
  ]);
  const use: CastawayUse = { teams: 0, games: [], episodes: results.map((r) => r.ep as number), calls: calls[0].n };
  for (const g of games) {
    const st = g.state as LeagueState;
    // Linked by the cast's id, or (a game whose cast was never linked) by the same name.
    const k = st.castaways?.find((x) => x.seasonCastId === c.id) ?? st.castaways?.find((x) => !x.seasonCastId && x.name.trim().toLowerCase() === c.name.trim().toLowerCase());
    if (!k || !StateLogic.castawayInUse(st, k.id)) continue;
    const teams = (k.ownerIds ?? []).length;
    use.teams += teams;
    use.games.push({ id: g.id, name: g.name, couch: g.couch, teams });
  }
  return use;
}

export interface DeskCastaway {
  id: string;
  name: string;
  first: string;
  group: string | null;
  /** Their starting group is named like a secret role: the page says it's hidden. */
  groupSecret: boolean;
  photo: string | null;
  photoUrl: string | null;
  /** "From TMDB", "From TVmaze", "A link", "None yet". */
  photoFrom: string;
  locked: boolean;
  season: { id: string; name: string };
  terms: { person: string; people: string; group: string; groups: string };
  castSize: number;
  games: number;
  /** The lower third: Still in, Out (an accepted result), or New (joined after the cast was first sent, on nobody's team). */
  tag: "Still in" | "Out" | "New";
  detail: string;
  meta: string;
  groups: { name: string; color: string | null; secret: boolean }[];
  reach: string;
  history: DeskLine[];
  /** Remove: refused while something has them (`why`, and the games), else what it does. */
  remove: { ok: boolean; line: string; why: string | null; games: CastawayUse["games"] };
}

export async function deskCastaway(id: string): Promise<DeskCastaway> {
  const c = await castRow(id);
  const s = await seasonRow(c.season_id);
  const terms = termsOf(s);
  const [games, use, colors, roles, { rows: changes }, { rows: groupRows }, { rows: out }, { rows: size }, lines] = await Promise.all([
    gamesOn(s.id),
    usesOf(c, s.id),
    groupColors(s.id),
    secretRoles(s.id),
    pool.query(
      `SELECT c.field, c.before, c.after, c.changed_at, COALESCE(u.username, u.name) AS who, l.name AS league
         FROM season_cast_changes c LEFT JOIN "user" u ON u.id = c.changed_by LEFT JOIN leagues l ON l.id = c.by_league
        WHERE c.season_cast_id = $1 ORDER BY c.changed_at DESC LIMIT 30`,
      [id]
    ),
    pool.query("SELECT DISTINCT tribe_name FROM season_cast WHERE season_id = $1 AND tribe_name IS NOT NULL ORDER BY 1", [c.season_id]),
    pool.query(
      `SELECT d.episode_number AS ep, d.method FROM season_decisions d WHERE d.season_id = $1 AND d.kind = 'elimination' AND d.status = 'accepted'
          AND lower(COALESCE(d.applied->>'castawayName', d.castaway_name)) = lower($2) ORDER BY d.episode_number LIMIT 1`,
      [s.id, c.name]
    ),
    pool.query("SELECT count(*)::int AS n FROM season_cast WHERE season_id = $1", [s.id]),
    deskLines("castaway", id),
  ]);
  const first = firstOf(c.name);
  const groupSecret = !!c.tribe_name && isSecretRole(c.tribe_name, roles);
  const joined = changes.some((r) => r.field === "added" && s.cast_approved_at && r.changed_at > s.cast_approved_at);
  const tag: DeskCastaway["tag"] = out.length ? "Out" : joined && !use.teams ? "New" : "Still in";
  const detail = out.length
    ? `Out in Episode ${out[0].ep}${out[0].method ? ` · ${String(out[0].method).toLowerCase()}` : ""}`
    : c.tribe_name && !groupSecret
      ? `Started on ${c.tribe_name}`
      : s.name;
  const field = (r: { field: string; before: string | null; after: string | null }) =>
    r.field === "name"
      ? `Renamed ${r.after} (was ${r.before})`
      : r.field === "tribe"
        ? `Starting ${terms.group}: ${r.after ?? "none"} (was ${r.before ?? "none"})`
        : r.field === "photo"
          ? r.after
            ? "Photo changed"
            : "Photo removed"
          : r.field === "added"
            ? "Joined the cast"
            : `Changed the ${r.field}`;
  // The desk's own Override writes the cast's log too: that line is the desk's (with its Undo), so the log's copy is left out.
  const near = (t: Date) => lines.some((l) => Math.abs(Date.parse(l.at) - t.getTime()) < 10_000);
  const removeWhy = whyNot(first, use);
  return {
    id,
    name: c.name,
    first,
    group: c.tribe_name,
    groupSecret,
    photo: publicMediaSrc(c.photo_url),
    photoUrl: c.photo_url,
    photoFrom: photoFrom(c.photo_url),
    locked: !!c.locked_at,
    season: { id: s.id, name: s.name },
    terms,
    castSize: size[0].n,
    games,
    tag,
    detail,
    meta: `${use.teams ? `On ${plural(use.teams, "team")} in ${plural(games, "game")}` : `On nobody's team${games ? ` in its ${plural(games, "game")}` : " · no games on it yet"}`}${c.locked_at ? " · locked" : ""}`,
    groups: groupRows.map((g) => ({ name: g.tribe_name, color: colors.get(String(g.tribe_name).toLowerCase()) ?? null, secret: isSecretRole(g.tribe_name, roles) })),
    reach: games ? `Every game on ${s.name} · ${plural(games, "game")}` : `No games on ${s.name} yet`,
    history: byNewest([
      ...changes
        .filter((r) => !(r.league == null && near(r.changed_at)))
        .map((r) => ({ id: null, text: `${field(r)}${r.league ? ` · from ${r.league}` : ""}`, at: r.changed_at.toISOString(), who: r.who, undoable: false, undone: false })),
      ...lines,
    ]),
    remove: removeWhy
      ? { ok: false, line: removeWhy.line, why: removeWhy.why, games: use.games }
      : { ok: true, line: `Out of every game on ${s.name} · can't be undone`, why: null, games: [] },
  };
}

/** Why Remove is refused (Remove is for someone listed by mistake), or null when nothing has them. */
function whyNot(first: string, use: CastawayUse): { line: string; why: string } | null {
  const picked = use.games.filter((g) => !g.teams).length;
  if (!use.teams && !picked && !use.episodes.length && !use.calls) return null;
  const parts = [
    use.teams && `${plural(use.teams, "team")} in ${plural(use.games.filter((g) => g.teams).length, "game")} ${use.teams === 1 ? "has" : "have"} ${first}`,
    picked && `picks or results in ${plural(picked, "game")} have them`,
    use.episodes.length && `${use.episodes.length === 1 ? `Episode ${use.episodes[0]}'s` : `Episodes ${and(use.episodes.map(String))}'`} results name them`,
    use.calls && `${plural(use.calls, "call")} ${use.calls === 1 ? "picks" : "pick"} them`,
  ].filter(Boolean) as string[];
  const why = `${and(parts).replace(/^./, (x) => x.toUpperCase())}, so taking them out would change scores. If their name is wrong, override it instead.`;
  const line = use.teams
    ? `Not while ${plural(use.teams, "team")} ${use.teams === 1 ? "has" : "have"} them`
    : picked
      ? "Not while picks or results in a game have them"
      : use.episodes.length
        ? "Not while results name them"
        : "Not while calls pick them";
  return { line, why };
}

type CastField = "name" | "group" | "photo";
type Db = Pool | PoolClient;

/** Writes one field of a cast row, logs it in season_cast_changes, and takes the cast to every league on the season. */
async function writeCastField(userId: string, id: string, field: CastField, value: string | null) {
  const c = await castRow(id);
  const s = await seasonRow(c.season_id);
  const log = (f: string, before: string | null, after: string | null) =>
    pool.query("INSERT INTO season_cast_changes (season_id, season_cast_id, field, before, after, changed_by) VALUES ($1, $2, $3, $4, $5, $6)", [c.season_id, id, f, before, after, userId]);
  try {
    if (field === "name") {
      if (!value) throw new HttpError(400, "A name can't be blank.");
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
  // No photo: bringing the games in line never clears one (syncSeasonCast keeps a game's photo when the cast has none), so
  // each game's copy of them loses theirs here.
  if (field === "photo" && !value && s.cast_approved_at)
    for (const l of await leaguesOn(s))
      await withLeagueLock(l.id, (state) => {
        const k = state.castaways.find((x) => x.seasonCastId === id);
        if (k?.photoUrl) k.photoUrl = undefined;
      });
  return { before: field === "name" ? c.name : field === "photo" ? c.photo_url : c.tribe_name, c, s };
}

/** The season's latest cast answer, while it waits to be sent. */
async function waitingAnswer(db: Db, seasonId: string): Promise<{ id: string; people: TheirCastaway[] } | null> {
  const { rows } = await db.query("SELECT id, people, sent_at FROM season_cast_answers WHERE season_id = $1 ORDER BY created_at DESC LIMIT 1", [seasonId]);
  return rows[0] && !rows[0].sent_at ? { id: rows[0].id, people: rows[0].people } : null;
}

const castNow = async (seasonId: string) =>
  (await pool.query("SELECT id, name, tribe_name, locked_at FROM season_cast WHERE season_id = $1", [seasonId])).rows.map((r) => ({ id: r.id, name: r.name, group: r.tribe_name, locked: !!r.locked_at }));

/**
 * Noticed bh: an Override settles that person's line in a waiting answer. The admin has said what their name (or starting
 * group) is, so the answer's line for them takes it: it never reads as a new spelling putting the answer's back. Worked out
 * against the cast as it was, written once the override is (a refused one changes nothing); an answer left changing nothing is
 * settled. History's Undo of the override puts the answer back as it was.
 */
async function planSettle(seasonId: string, castId: string, field: "name" | "group", value: string | null): Promise<{ id: string; before: TheirCastaway[]; people: TheirCastaway[] } | null> {
  const a = await waitingAnswer(pool, seasonId);
  if (!a) return null;
  const ours = await castNow(seasonId);
  const me = ours.find((o) => o.id === castId);
  if (!me) return null;
  const spell = castChanges(ours, a.people, { groups: true }).find((x) => x.k === "spell" && x.id === castId) as { to: string } | undefined;
  const key = (spell?.to ?? me.name).trim().toLowerCase();
  const i = a.people.findIndex((p) => p.name.trim().toLowerCase() === key);
  if (i < 0) return null;
  const people = a.people.map((p, j) => (j !== i ? p : field === "name" ? { ...p, name: value ?? p.name } : { ...p, group: value }));
  return { id: a.id, before: a.people, people };
}

/** The planned settle written; whether the answer, changing nothing now, was settled with it. */
async function settle(seasonId: string, plan: { id: string; people: TheirCastaway[] }): Promise<boolean> {
  const { rowCount } = await pool.query("UPDATE season_cast_answers SET people = $2::jsonb WHERE id = $1 AND sent_at IS NULL", [plan.id, JSON.stringify(plan.people)]);
  if (!rowCount) return false;
  const { rows: season } = await pool.query("SELECT cast_approved_at FROM show_seasons WHERE id = $1", [seasonId]);
  if (!season[0]?.cast_approved_at || castChanges(await castNow(seasonId), plan.people, { groups: true }).length) return false;
  await pool.query("UPDATE season_cast_answers SET sent_at = now() WHERE id = $1 AND sent_at IS NULL", [plan.id]);
  return true;
}

/** Override: an admin's change to a castaway's name, starting group or photo, for every game on the season (tier 1, Undo). */
export async function overrideCastaway(user: SessionUser, id: string, body: { field?: unknown; value?: unknown }): Promise<DeskCastaway & { changeId: string; text: string }> {
  const field = body.field as CastField;
  if (!["name", "group", "photo"].includes(field)) throw new HttpError(400, "field is name, group or photo");
  const value = typeof body.value === "string" && body.value.trim() ? body.value.trim().slice(0, 300) : null;
  if (field === "name" && !value) throw new HttpError(400, "A name can't be blank.");
  if (field === "photo" && value && !/^https?:\/\/\S+$/i.test(value)) throw new HttpError(400, "That isn't a link. It starts https://");
  const was = await castRow(id);
  if (field === "name" && value === was.name) throw new HttpError(409, "That's their name already");
  const plan = field === "photo" ? null : await planSettle(was.season_id, id, field, value);
  const { before, c, s } = await writeCastField(user.id, id, field, value);
  const settled = plan ? await settle(c.season_id, plan) : false;
  const games = await gamesOn(s.id);
  const T = termsOf(s).group;
  const first = firstOf(field === "name" ? value! : c.name);
  const line =
    field === "name"
      ? `Renamed ${value} (was ${before})`
      : field === "photo"
        ? value
          ? /tmdb\.org/i.test(value)
            ? "Photo from TMDB"
            : /tvmaze/i.test(value)
              ? "Photo from TVmaze"
              : "Photo set by link"
          : "Photo removed"
        : `Starting ${T}: ${value ?? "none"} (was ${before ?? "none"})`;
  const where = games ? ` in ${plural(games, "game")}` : "";
  const text =
    field === "name"
      ? `Renamed ${value}${where}`
      : field === "photo"
        ? value
          ? `${first}'s photo changed${where}`
          : `${first}'s photo removed`
        : `${first} starts ${value ? `on ${value}` : `with no ${T}`}${where}`;
  const changeId = await logDesk(pool, {
    entity: "castaway",
    entityId: id,
    action: "override",
    text: line,
    before,
    after: value,
    undo: { type: "castaway", id, field, value: before, ...(plan ? { answer: { id: plan.id, people: plan.before, settled } } : {}) },
    userId: user.id,
  });
  return { ...(await deskCastaway(id)), changeId, text };
}

/** History's Undo of an override: the field goes back, and a waiting answer it settled a line of is as it was (unless sent since). */
export async function restoreCastaway(userId: string, id: string, field: CastField, value: string | null, answer?: { id: string; people: TheirCastaway[]; settled: boolean } | null): Promise<void> {
  await writeCastField(userId, id, field, value);
  if (answer?.id)
    await pool.query("UPDATE season_cast_answers SET people = $2::jsonb, sent_at = CASE WHEN $3 THEN NULL ELSE sent_at END WHERE id = $1 AND sent_by IS NULL", [
      answer.id,
      JSON.stringify(answer.people),
      !!answer.settled,
    ]);
}

/** Locked: no answer or commissioner's cast entry changes them (season-cast-write.ts, desk-cast-diff.ts); the admin still can. */
export async function lockCastaway(user: SessionUser, id: string, locked: boolean): Promise<DeskCastaway & { changeId: string; text: string }> {
  const c = await castRow(id);
  await pool.query("UPDATE season_cast SET locked_at = CASE WHEN $2 THEN now() ELSE NULL END WHERE id = $1", [id, locked]);
  const changeId = await logDesk(pool, { entity: "castaway", entityId: id, action: locked ? "lock" : "unlock", text: locked ? "Locked" : "Unlocked", undo: { type: "castawayLock", id, locked: !locked }, userId: user.id });
  return { ...(await deskCastaway(id)), changeId, text: `${firstOf(c.name)} ${locked ? "locked" : "unlocked"}` };
}

export async function setCastawayLock(id: string, locked: boolean) {
  await pool.query("UPDATE season_cast SET locked_at = CASE WHEN $2 THEN now() ELSE NULL END WHERE id = $1", [id, locked]);
}

/** Look on TMDB and TVmaze (show-art.ts castPhotosFor, the season's credits): a photo of them, or none. Changes nothing. */
export async function lookPhoto(id: string, listings?: string): Promise<{ photo: string | null; src: string | null; from: string | null; same: boolean }> {
  const c = await castRow(id);
  const photo = (await castPhotosFor(c.season_id, [c.name], listings)).get(c.name) ?? null;
  return { photo, src: publicMediaSrc(photo), from: photo ? (/tmdb\.org/i.test(photo) ? "TMDB" : "TVmaze") : null, same: !!photo && photo === c.photo_url };
}

/**
 * Remove <name> from the cast (tier 3): someone listed by mistake comes out of the cast and every game on the season.
 * Refused while a team, pick, result or call has them. Never un-approves the cast; nothing to undo.
 */
export async function removeCastaway(user: SessionUser, id: string): Promise<{ seasonId: string; text: string }> {
  const c = await castRow(id);
  const s = await seasonRow(c.season_id);
  const why = whyNot(firstOf(c.name), await usesOf(c, s.id));
  if (why) throw new HttpError(409, why.why);
  await tx(async (db) => {
    const { rowCount } = await db.query("DELETE FROM season_cast WHERE id = $1 AND season_id = $2", [id, s.id]);
    if (!rowCount) throw new HttpError(404, "Not in any season's cast");
    await db.query("INSERT INTO season_cast_changes (season_id, season_cast_id, field, before, after, changed_by) VALUES ($1, $2, 'removed', $3, NULL, $4)", [s.id, id, c.name, user.id]);
    await db.query("UPDATE show_seasons SET cast_size = (SELECT count(*)::int FROM season_cast WHERE season_id = $1), updated_at = now() WHERE id = $1 AND cast_approved_at IS NOT NULL", [s.id]);
    await logDesk(db, { entity: "season", entityId: s.id, action: "cast", text: `${c.name} removed from the cast`, userId: user.id });
  });
  // Out of every game (removeUnlinkedRows: only someone nothing refers to, which the guard above has said).
  await applyApprovedCastToLeagues(s.slug, s.season_number, s.cast_approved_at ? await seasonCastRows(s.id) : [], s.tribes_from_episode ?? null, { removed: [id] });
  return { seasonId: s.id, text: `${c.name} removed from the cast and every game` };
}

// ---------- starting groups ----------

/**
 * Not a <group>: off everyone in the season's cast, and out of every league on the season (StateLogic.removeTribe: nobody
 * starts on it, moves into it read as none, and it's gone from the boards). A group named like a secret role goes with every
 * other one so named (one left behind still gives the role away). `preview` says what it would do and changes nothing.
 */
export async function clearGroup(user: SessionUser, seasonId: string, body: { group?: unknown; preview?: unknown }) {
  const s = await seasonRow(seasonId);
  const T = termsOf(s);
  const group = typeof body.group === "string" ? body.group.trim() : "";
  const { rows: cast } = await pool.query("SELECT id, tribe_name FROM season_cast WHERE season_id = $1 AND tribe_name IS NOT NULL", [seasonId]);
  const named = [...new Set(cast.map((c) => c.tribe_name as string))];
  const target = named.find((g) => g.toLowerCase() === group.toLowerCase());
  if (!group || !target) throw new HttpError(404, "Nobody in this season's cast is in that group");
  const roles = await secretRoles(seasonId);
  const secret = isSecretRole(target, roles);
  const take = secret ? named.filter((g) => isSecretRole(g, roles)).sort() : [target];
  const lower = new Set(take.map((g) => g.toLowerCase()));
  const each = take.map((g) => ({ group: g, ids: cast.filter((c) => c.tribe_name === g).map((c) => c.id as string) }));
  const people = each.reduce((n, x) => n + x.ids.length, 0);
  const leagues = await leaguesOn(s);
  const { rows: having } = await pool.query(
    `SELECT l.id, l.deleted_at IS NULL AS live FROM leagues l WHERE l.id = ANY($1::uuid[]) AND EXISTS (SELECT 1 FROM jsonb_array_elements(l.state->'tribes') t WHERE lower(t->>'name') = ANY($2::text[]))`,
    [leagues.map((l) => l.id), [...lower]]
  );
  const games = having.filter((h) => h.live).length;
  if (body.preview === true) {
    const colors = await groupColors(seasonId);
    return { groups: each.map((x) => ({ name: x.group, people: x.ids.length, color: colors.get(x.group.toLowerCase()) ?? null })), secret, people, leagues: games, terms: T };
  }
  const nm = and(take);
  const not = take.length > 1 ? T.groups : `a ${T.group}`;
  const changeId = await tx(async (db) => {
    await db.query("UPDATE season_cast SET tribe_name = NULL WHERE season_id = $1 AND tribe_name = ANY($2::text[])", [seasonId, take]);
    for (const x of each)
      for (const id of x.ids)
        await db.query("INSERT INTO season_cast_changes (season_id, season_cast_id, field, before, after, changed_by) VALUES ($1, $2, 'tribe', $3, NULL, $4)", [seasonId, id, x.group, user.id]);
    return logDesk(db, {
      entity: "season",
      entityId: seasonId,
      action: "clearGroup",
      text: `${nm} taken out: not ${not}${secret ? ` (named like a secret role)` : ""}, ${plural(people, "person", "people")}, ${plural(games, "game")}`,
      undo: { type: "groups", seasonId, groups: each },
      userId: user.id,
    });
  });
  for (const l of having) {
    await withLeagueLock(
      l.id,
      (state) => {
        for (const t of state.tribes.filter((x) => lower.has(x.name.toLowerCase()))) StateLogic.removeTribe(state, t.id);
      },
      { userId: user.id, kind: "cast", tier: 1, text: secret ? `An admin took out ${nm}: ${take.length > 1 ? "secret roles, not groups" : "it's a secret role, not a group"}` : `An admin took out the ${target} group: not a group` }
    );
  }
  return { changeId, text: `${nm} taken out · ${plural(people, "person has", "people have")} no ${T.group}`, people, leagues: games };
}

/** History's Undo: each group goes back on the same people, and the leagues get them as starting groups again. */
export async function restoreGroups(seasonId: string, groups: { group: string; ids: string[] }[]): Promise<void> {
  const s = await seasonRow(seasonId);
  for (const g of groups) await pool.query("UPDATE season_cast SET tribe_name = $2 WHERE id = ANY($1::uuid[]) AND season_id = $3 AND tribe_name IS NULL", [g.ids, g.group, seasonId]);
  if (s.cast_approved_at) await applyApprovedCastToLeagues(s.slug, s.season_number, await seasonCastRows(seasonId), s.tribes_from_episode ?? null);
}

/**
 * Hold them until Episode 1 (tier 1, Undo): tribes_from_episode, changed without un-approving the cast (classic's did: Noticed
 * i). Held, a game gets the starting groups once it has Episode 1: revealed, or its results logged in a live game (tribesDue).
 * Let go, every game gets them now. Holding again doesn't take them back out of a game that has them: the toast says how many.
 */
export async function setHold(user: SessionUser, seasonId: string, on: boolean): Promise<{ changeId: string | null; text: string }> {
  const s = await seasonRow(seasonId);
  const T = termsOf(s);
  const Ts = T.groups.charAt(0).toUpperCase() + T.groups.slice(1);
  const before = s.tribes_from_episode;
  const after = on ? (before ?? 1) : null;
  if (after === before) return { changeId: null, text: on ? `${Ts} held until Episode ${after} already` : `${Ts} aren't held` };
  const n = after ?? before ?? 1;
  const changeId = await tx(async (db) => {
    await db.query("UPDATE show_seasons SET tribes_from_episode = $2, cast_tribes_confirmed = true, updated_at = now() WHERE id = $1", [seasonId, after]);
    await db.query("INSERT INTO season_cast_changes (season_id, season_cast_id, field, before, after, changed_by) VALUES ($1, NULL, 'tribes_hold', $2, $3, $4)", [
      seasonId,
      before == null ? null : String(before),
      after == null ? null : String(after),
      user.id,
    ]);
    return logDesk(db, {
      entity: "season",
      entityId: seasonId,
      action: "cast",
      text: on ? `Starting ${T.groups} held until Episode ${n}` : `Starting ${T.groups} no longer held`,
      undo: { type: "castHold", seasonId, value: before, to: after },
      userId: user.id,
    });
  });
  if (s.cast_approved_at) await applyApprovedCastToLeagues(s.slug, s.season_number, await seasonCastRows(seasonId), after);
  if (!on) return { changeId, text: `Everyone sees the starting ${T.groups}` };
  const { rows } = await pool.query(`SELECT l.state FROM leagues l ${LEAGUE_SEASON_JOIN} WHERE ss.id = $1 AND l.deleted_at IS NULL`, [seasonId]);
  const showing = rows.filter((r) => {
    const st = r.state as LeagueState;
    return !tribesDue(st, n) && (st.castaways ?? []).some((c) => c.tribeId);
  }).length;
  return { changeId, text: `${Ts} held until Episode ${n}${showing ? ` · ${plural(showing, "game")} already ${showing === 1 ? "shows" : "show"} them` : ""}` };
}

/** History's Undo of Hold: as it was, unless it's changed since. */
export async function restoreHold(userId: string, seasonId: string, value: number | null, to: number | null | undefined): Promise<void> {
  const s = await seasonRow(seasonId);
  if (to !== undefined && s.tribes_from_episode !== to) throw new HttpError(409, "Hold has changed since: switch it on the Cast page");
  await pool.query("UPDATE show_seasons SET tribes_from_episode = $2, updated_at = now() WHERE id = $1", [seasonId, value]);
  await pool.query("INSERT INTO season_cast_changes (season_id, season_cast_id, field, before, after, changed_by) VALUES ($1, NULL, 'tribes_hold', $2, $3, $4)", [
    seasonId,
    s.tribes_from_episode == null ? null : String(s.tribes_from_episode),
    value == null ? null : String(value),
    userId,
  ]);
  if (s.cast_approved_at) await applyApprovedCastToLeagues(s.slug, s.season_number, await seasonCastRows(seasonId), value);
}

/** The season's own History: the desk's lines for it (a group taken out, its rulebook switched on). */
export const seasonLines = (id: string) => deskLines("season", id);
