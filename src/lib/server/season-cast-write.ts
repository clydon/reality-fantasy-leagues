import type { PoolClient } from "pg";
import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import { HttpError, withLeagueLock } from "./db";
import { applyCastToState, applyApprovedCastToLeagues, renameInSeasonDecisions, type CastApplyResult, type SeasonCastRow } from "./season-cast";

// A commissioner's cast entry writes the SEASON's cast (docs/PLAN-universal-season-cast.md, pieces 2
// and 3; db/migrations/0055). Every league cast route -- add, rename, photo, starting tribe, remove,
// "Import a cast", and renaming or removing a tribe -- comes through castWrite first, which decides
// from the league's season which of four situations it's in:
//
//   own       the league has no season (no show, no season number, or a show nobody catalogued): its
//             roster is its own, exactly as before. castWrite returns null and the route does what it
//             always did.
//   create    the season has no cast yet: this write creates it from the league's whole current
//             roster (so nothing typed so far is lost), approves it, and then carries on as `creating`.
//   creating  this league created the season's cast and it isn't finished: the write changes the
//             season cast, this league gets it inside its own lock, and every other league on the
//             season gets it right after (outside this lock, so two leagues can't deadlock).
//   shared    anyone else's cast, or a finished one: refused. Only an admin changes it, in Admin.
//
// "Finished" is the plan's open question 1: the creating commissioner pressed "Finish cast", or any
// league on the season got underway (StateLogic.seasonUnderway: a draft started, a pick or a lineup
// made), whichever came first. The second is noticed lazily, on the next write or read.
//
// Roles are not cast (open question 2): "Import a cast" still records them, but only into the importing
// league, as episode-1 results it reveals like any other -- see the import route.

export type CastMode =
  | { kind: "own" }
  | { kind: "create"; seasonNumber: number }
  | {
      kind: "creating";
      seasonId: string;
      seasonNumber: number;
      tribesFromEpisode: number | null;
      tribesConfirmed: boolean;
      otherLeagues: number;
      /** The season's rows, so the creating commissioner sees starting tribes their own league holds back. */
      cast: { id: string; name: string; tribeName: string | null }[];
    }
  | { kind: "shared"; seasonId: string; seasonNumber: number; reason: "admin" | "finished" | "other-league" | "under-review" };

export type CastOp =
  | { type: "add"; name: string }
  | { type: "update"; castawayId: string; field: "name" | "photoUrl" | "tribeId"; value: unknown }
  | { type: "remove"; castawayId: string }
  | {
      type: "import";
      castaways: { name: string; tribeName?: string | null; photoUrl?: string | null }[];
      /** The pre-premiere tribes question, when the import screen asked it: null = public, N = held until episode N. */
      tribesFromEpisode?: number | null;
    }
  | { type: "tribe-rename"; tribeId: string; name: string }
  | { type: "tribe-remove"; tribeId: string }
  | { type: "finish" }
  | { type: "tribes-hold"; tribesFromEpisode: number | null };

interface SeasonRow {
  id: string;
  season_number: number;
  cast_created_by_league: string | null;
  cast_locked_at: Date | null;
  cast_approved_at: Date | null;
  tribes_from_episode: number | null;
  cast_tribes_confirmed: boolean;
  cast_rows: number;
}

interface Context {
  showId: string;
  showSlug: string;
  seasonNumber: number;
  season: SeasonRow | null;
  mode: Exclude<CastMode, { kind: "own" }>;
}

export const SHARED_MESSAGE: Record<Extract<CastMode, { kind: "shared" }>["reason"], string> = {
  admin: "This season's cast is shared by every league on it. Ask an admin to change it.",
  "other-league": "This season's cast is shared by every league on it. Ask an admin to change it.",
  finished: "This season's cast is finished and shared by every league on it. Ask an admin to change it.",
  "under-review": "An admin is reviewing this season's cast. It'll arrive here once it's approved.",
};

const seasonNumberOf = (state: LeagueState) => {
  const n = Number(state.settings.wikiSeason);
  return state.settings.wikiSeason != null && String(state.settings.wikiSeason).trim() !== "" && Number.isInteger(n) && n > 0 ? n : null;
};

async function loadSeason(client: PoolClient, showId: string, seasonNumber: number, forUpdate: boolean): Promise<SeasonRow | null> {
  const { rows } = await client.query(
    `SELECT id, season_number, cast_created_by_league, cast_locked_at, cast_approved_at, tribes_from_episode,
            cast_tribes_confirmed, (SELECT count(*)::int FROM season_cast sc WHERE sc.season_id = ss.id) AS cast_rows
       FROM show_seasons ss WHERE show_id=$1 AND season_number=$2 ${forUpdate ? "FOR UPDATE" : ""}`,
    [showId, seasonNumber]
  );
  return rows[0] ?? null;
}

async function rowsOf(client: PoolClient, seasonId: string): Promise<SeasonCastRow[]> {
  const { rows } = await client.query(
    `SELECT id, name, tribe_name AS "tribeName", photo_url AS "photoUrl"
       FROM season_cast WHERE season_id=$1 ORDER BY sort_order ASC, name ASC`,
    [seasonId]
  );
  return rows;
}

// The other leagues on the season, read (not locked) -- for "is anyone underway" and "is this person
// in use anywhere".
async function otherLeagues(client: PoolClient, slug: string, seasonNumber: number, leagueId: string) {
  const { rows } = await client.query<{ id: string; name: string; state: LeagueState }>(
    `SELECT id, name, state FROM leagues
      WHERE state->'settings'->>'showId' = $1 AND state->'settings'->>'wikiSeason' = $2 AND id <> $3`,
    [slug, String(seasonNumber), leagueId]
  );
  return rows;
}

async function resolve(client: PoolClient, leagueId: string, state: LeagueState, forUpdate: boolean): Promise<Context | null> {
  const slug = state.settings.showId;
  const seasonNumber = seasonNumberOf(state);
  if (!slug || seasonNumber == null) return null;
  const { rows: shows } = await client.query("SELECT id FROM shows WHERE slug=$1", [slug]);
  if (!shows.length) return null;
  const base = { showId: shows[0].id as string, showSlug: slug, seasonNumber };
  const season = await loadSeason(client, base.showId, seasonNumber, forUpdate);

  if (!season || season.cast_rows === 0) return { ...base, season, mode: { kind: "create", seasonNumber } };
  const shared = (reason: Extract<CastMode, { kind: "shared" }>["reason"]): Context => ({
    ...base,
    season,
    mode: { kind: "shared", seasonId: season.id, seasonNumber, reason },
  });
  if (!season.cast_approved_at) return shared("under-review");
  if (!season.cast_created_by_league) return shared("admin");
  if (season.cast_created_by_league !== leagueId) return shared("other-league");
  if (season.cast_locked_at) return shared("finished");

  const others = await otherLeagues(client, slug, seasonNumber, leagueId);
  if (StateLogic.seasonUnderway(state) || others.some((l) => StateLogic.seasonUnderway(l.state))) {
    await client.query("UPDATE show_seasons SET cast_locked_at=now() WHERE id=$1 AND cast_locked_at IS NULL", [season.id]);
    await logChange(client, season.id, null, "finished", null, "a league got underway", null, leagueId);
    return shared("finished");
  }
  const cast = await rowsOf(client, season.id);
  return {
    ...base,
    season,
    mode: {
      kind: "creating",
      seasonId: season.id,
      seasonNumber,
      tribesFromEpisode: season.tribes_from_episode,
      tribesConfirmed: season.cast_tribes_confirmed,
      otherLeagues: others.length,
      cast: cast.map((c) => ({ id: c.id, name: c.name, tribeName: c.tribeName })),
    },
  };
}

/** The league's cast mode, for League Settings to show the right controls. Read-only, bar the lazy lock. */
export async function castModeFor(client: PoolClient, leagueId: string, state: LeagueState): Promise<CastMode> {
  const ctx = await resolve(client, leagueId, state, false);
  return ctx ? ctx.mode : { kind: "own" };
}

async function logChange(
  client: PoolClient,
  seasonId: string,
  seasonCastId: string | null,
  field: string,
  before: string | null,
  after: string | null,
  userId: string | null,
  leagueId: string | null
) {
  await client.query(
    `INSERT INTO season_cast_changes (season_id, season_cast_id, field, before, after, changed_by, by_league)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [seasonId, seasonCastId, field, before, after, userId, leagueId]
  );
}

// A season row for this show and number, created if episode research or a league hasn't already.
// Lazily created seasons are league-decided (db/migrations/0054's default).
async function ensureSeason(client: PoolClient, ctx: Context): Promise<SeasonRow> {
  await client.query(
    // 'airing' rather than the column's 'completed' default: a league entering a cast is about to play it.
    "INSERT INTO show_seasons (show_id, season_number, status) VALUES ($1,$2,'airing') ON CONFLICT (show_id, season_number) DO NOTHING",
    [ctx.showId, ctx.seasonNumber]
  );
  return (await loadSeason(client, ctx.showId, ctx.seasonNumber, true))!;
}

const startTribeName = (state: LeagueState, c: LeagueState["castaways"][number]) => {
  const id = c.startTribeId !== undefined ? c.startTribeId : c.tribeId;
  return (id && StateLogic.getTribe(state, id)?.name) || null;
};

// Creates the season's cast from this league's whole roster, linking each castaway to the row made
// from it. A second castaway with the same name as an earlier one gets no row and stays unlinked -- it
// can't be told apart, and db/link-season-cast.js reports it.
async function createFromRoster(client: PoolClient, ctx: Context, leagueId: string, state: LeagueState, userId: string) {
  const season = await ensureSeason(client, ctx);
  // Re-checked under the season's row lock: another league may have created it a moment ago.
  if (season.cast_rows > 0) throw new HttpError(409, "Another league just created this season's cast. Reload to see it.");
  let i = 0;
  for (const c of state.castaways) {
    if (!c.name || !c.name.trim()) continue;
    const { rows } = await client.query(
      `INSERT INTO season_cast (season_id, name, tribe_name, photo_url, sort_order) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (season_id, lower(name)) DO NOTHING RETURNING id`,
      [season.id, c.name.trim(), startTribeName(state, c), c.photoUrl || null, i++]
    );
    if (rows.length) c.seasonCastId = rows[0].id;
  }
  // Approved at once, so a league picking the season later receives it (season-cast.ts's
  // approvedCastFor). Starting tribes are HELD from episode 1 until the commissioner says otherwise --
  // nothing is assumed public (cast_tribes_confirmed false asks them).
  await client.query(
    `UPDATE show_seasons SET cast_approved_at=now(), cast_approved_by=$2, cast_created_by_league=$3, cast_locked_at=NULL,
            cast_tribes_confirmed=false, tribes_from_episode=1, updated_at=now() WHERE id=$1`,
    [season.id, userId, leagueId]
  );
  await logChange(client, season.id, null, "created", null, String(i), userId, leagueId);
  return season.id;
}

const unique = (e: unknown) => (e as { code?: string }).code === "23505";

/**
 * Routes a league cast write through the season cast. Call inside withLeagueLock (with its client).
 * Returns null when the league's cast is its own (the route then does what it always did); otherwise
 * the change is made, this league's state is brought up to date, and `push` -- to run AFTER the lock is
 * released -- takes it to every other league on the season.
 */
export async function castWrite(
  client: PoolClient,
  leagueId: string,
  state: LeagueState,
  userId: string,
  op: CastOp
): Promise<{ applied: ReturnType<typeof applyCastToState>; push: () => Promise<CastApplyResult[]> } | null> {
  const ctx = await resolve(client, leagueId, state, true);
  if (!ctx) return null;
  const mode = ctx.mode;

  // Tribes are the league's own unless the season's cast names them as a starting tribe: a merged tribe
  // or a swap's new one is a result, and its colour or name is nobody else's business.
  if (op.type === "tribe-rename" || op.type === "tribe-remove") {
    const tribe = StateLogic.getTribe(state, op.tribeId);
    if (!tribe || mode.kind === "create") return null;
    const { rows } = await client.query(
      "SELECT 1 FROM season_cast WHERE season_id=$1 AND lower(tribe_name)=lower($2) LIMIT 1",
      [mode.seasonId, tribe.name]
    );
    if (!rows.length) return null;
    if (mode.kind === "shared") throw new HttpError(403, SHARED_MESSAGE[mode.reason]);
    if (op.type === "tribe-remove") {
      throw new HttpError(409, `Someone in this season's cast starts on ${tribe.name}. Move them off it first.`);
    }
  }

  if (mode.kind === "shared") throw new HttpError(403, SHARED_MESSAGE[mode.reason]);
  if (mode.kind === "create" && (op.type === "finish" || op.type === "tribes-hold")) {
    throw new HttpError(400, "There's no season cast yet -- add someone first.");
  }

  const seasonId = mode.kind === "create" ? await createFromRoster(client, ctx, leagueId, state, userId) : mode.seasonId;
  const log = (seasonCastId: string | null, field: string, before: string | null, after: string | null) =>
    logChange(client, seasonId, seasonCastId, field, before, after, userId, leagueId);
  const linkedRow = (castawayId: string) => {
    const c = StateLogic.getCastaway(state, castawayId);
    if (!c) throw new HttpError(404, "Not in this league.");
    if (!c.seasonCastId) throw new HttpError(409, `${c.name} isn't part of this season's cast. Ask an admin.`);
    return c as typeof c & { seasonCastId: string };
  };
  const removed: string[] = [];

  try {
    if (op.type === "add") {
      const name = op.name.trim();
      if (!name) throw new HttpError(400, "name required");
      const { rows } = await client.query(
        `INSERT INTO season_cast (season_id, name, sort_order)
         VALUES ($1, $2, (SELECT COALESCE(max(sort_order), -1) + 1 FROM season_cast WHERE season_id=$1))
         ON CONFLICT (season_id, lower(name)) DO NOTHING RETURNING id`,
        [seasonId, name]
      );
      if (!rows.length) throw new HttpError(409, `${name} is already in this season's cast.`);
      await log(rows[0].id, "added", null, name);
    } else if (op.type === "update") {
      const c = linkedRow(op.castawayId);
      if (op.field === "name") {
        const name = String(op.value ?? "").trim();
        if (!name) throw new HttpError(400, "A name can't be empty.");
        const { rows: was } = await client.query("SELECT name FROM season_cast WHERE id=$1", [c.seasonCastId]);
        await client.query("UPDATE season_cast SET name=$2 WHERE id=$1", [c.seasonCastId, name]);
        if (was[0]) await renameInSeasonDecisions(client, seasonId, was[0].name, name);
        await log(c.seasonCastId, "name", c.name, name);
      } else if (op.field === "photoUrl") {
        const url = String(op.value ?? "").trim() || null;
        await client.query("UPDATE season_cast SET photo_url=$2 WHERE id=$1", [c.seasonCastId, url]);
        await log(c.seasonCastId, "photo", c.photoUrl || null, url);
        // The season sync never clears a photo, so a cleared one is set here directly.
        if (!url) c.photoUrl = "";
      } else {
        const tribe = op.value ? StateLogic.getTribe(state, String(op.value)) : null;
        if (op.value && !tribe) throw new HttpError(400, "No such tribe in this league.");
        const { rows } = await client.query("SELECT tribe_name FROM season_cast WHERE id=$1", [c.seasonCastId]);
        await client.query("UPDATE season_cast SET tribe_name=$2 WHERE id=$1", [c.seasonCastId, tribe ? tribe.name : null]);
        await log(c.seasonCastId, "tribe", rows[0]?.tribe_name ?? null, tribe ? tribe.name : null);
        // Clearing isn't something the season sync does either; giving a tribe is left to it, so a
        // held starting tribe stays held here too.
        if (!tribe) StateLogic.updateCastaway(state, c.id, "tribeId", null);
      }
    } else if (op.type === "remove") {
      const c = linkedRow(op.castawayId);
      if (StateLogic.castawayInUse(state, c.id)) throw new HttpError(409, `${c.name} is already part of this league's game, so can't be removed.`);
      for (const l of await otherLeagues(client, ctx.showSlug, ctx.seasonNumber, leagueId)) {
        const theirs = l.state.castaways.find((x) => x.seasonCastId === c.seasonCastId);
        if (theirs && StateLogic.castawayInUse(l.state, theirs.id)) {
          throw new HttpError(409, `${c.name} is already part of ${l.name}'s game, so can't be removed. Ask an admin.`);
        }
      }
      await client.query("DELETE FROM season_cast WHERE id=$1", [c.seasonCastId]);
      await log(c.seasonCastId, "removed", c.name, null);
      StateLogic.removeCastaway(state, c.id);
      removed.push(c.seasonCastId);
    } else if (op.type === "import") {
      for (const p of op.castaways) {
        const name = (p.name || "").trim();
        if (!name) continue;
        const { rows } = await client.query(
          `INSERT INTO season_cast (season_id, name, tribe_name, photo_url, sort_order)
           VALUES ($1, $2, $3, $4, (SELECT COALESCE(max(sort_order), -1) + 1 FROM season_cast WHERE season_id=$1))
           ON CONFLICT (season_id, lower(name)) DO NOTHING RETURNING id`,
          [seasonId, name, p.tribeName || null, p.photoUrl || null]
        );
        if (rows.length) await log(rows[0].id, "added", null, name);
      }
      if (op.tribesFromEpisode !== undefined) await setHold(client, seasonId, op.tribesFromEpisode, log);
    } else if (op.type === "tribe-rename") {
      const tribe = StateLogic.getTribe(state, op.tribeId)!;
      const name = op.name.trim();
      if (!name) throw new HttpError(400, "A name can't be empty.");
      await client.query("UPDATE season_cast SET tribe_name=$3 WHERE season_id=$1 AND lower(tribe_name)=lower($2)", [seasonId, tribe.name, name]);
      await log(null, "tribe", tribe.name, name);
      tribe.name = name;
    } else if (op.type === "finish") {
      await client.query("UPDATE show_seasons SET cast_locked_at=now(), updated_at=now() WHERE id=$1", [seasonId]);
      await log(null, "finished", null, "Finish cast");
    } else if (op.type === "tribes-hold") {
      await setHold(client, seasonId, op.tribesFromEpisode, log);
    }
  } catch (e) {
    if (unique(e)) throw new HttpError(409, "Someone in this season's cast already has that name.");
    throw e;
  }

  const cast = await rowsOf(client, seasonId);
  const { rows: s } = await client.query("SELECT tribes_from_episode FROM show_seasons WHERE id=$1", [seasonId]);
  const hold: number | null = s[0].tribes_from_episode;
  await client.query("UPDATE show_seasons SET cast_size=$2, updated_at=now() WHERE id=$1", [seasonId, cast.length]);
  const applied = applyCastToState(state, cast, hold);
  return {
    applied,
    push: () => applyApprovedCastToLeagues(ctx.showSlug, ctx.seasonNumber, cast, hold, { exceptLeagueId: leagueId, removed }),
  };
}

async function setHold(
  client: PoolClient,
  seasonId: string,
  hold: number | null,
  log: (id: string | null, field: string, before: string | null, after: string | null) => Promise<void>
) {
  if (hold !== null && !(Number.isInteger(hold) && hold >= 1)) throw new HttpError(400, "tribesFromEpisode must be a positive whole number, or null");
  const { rows } = await client.query("SELECT tribes_from_episode FROM show_seasons WHERE id=$1", [seasonId]);
  await client.query(
    "UPDATE show_seasons SET tribes_from_episode=$2, cast_tribes_confirmed=true, updated_at=now() WHERE id=$1",
    [seasonId, hold]
  );
  const show = (n: number | null) => (n == null ? "public before the premiere" : `held until episode ${n}`);
  await log(null, "tribes_hold", show(rows[0]?.tribes_from_episode ?? null), show(hold));
}

/**
 * The whole of a league cast route: castWrite inside the league's lock, falling back to `own` (what the
 * route always did) for a league with no season, then the push to the season's other leagues once the
 * lock is released. `alsoManaged` runs inside the lock after a season write (the import route records
 * roles there). Returns the league's new state and, for a season write, what reached the others.
 */
export async function leagueCastWrite(
  leagueId: string,
  userId: string,
  op: CastOp | ((state: LeagueState) => CastOp),
  own: (state: LeagueState) => void,
  alsoManaged?: (state: LeagueState, applied: ReturnType<typeof applyCastToState>) => void
) {
  const after: { push?: () => Promise<CastApplyResult[]>; applied?: ReturnType<typeof applyCastToState> } = {};
  const state = await withLeagueLock(leagueId, async (s, client) => {
    const w = await castWrite(client, leagueId, s, userId, typeof op === "function" ? op(s) : op);
    if (!w) return own(s);
    after.push = w.push;
    after.applied = w.applied;
    alsoManaged?.(s, w.applied);
  });
  const reached = after.push ? await after.push() : null;
  return { state, applied: after.applied ?? null, reached };
}
