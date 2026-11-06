import StateLogic from "@/lib/game/state-logic.js";
import { castStats, seasonFacts, type CastStats, type StatsBook } from "@/lib/game/cast-stats";
import type { DecisionFact } from "@/lib/game/decision-apply";
import { isBuiltInFormat } from "@/lib/game/formats/index.js";
import { rulebookFor } from "@/lib/game/formats/blocks/index.js";
import { blocksAt } from "@/lib/game/formats/rulebook-patch.js";
import type { RulebookBlocks } from "@/lib/game/formats/rulebook-schema.js";
import type { LeagueSettings, LeagueState } from "@/lib/game/types";
import { inForceEdits, rulebookForLeague, seasonRulebook } from "@db/rulebooks.js";
import { resolveFormat } from "@db/show-formats.js";
import type { SessionUser } from "./auth-helpers";
import { unsettledFacts } from "./community-results";
import { pool } from "./db";
import { EVERYTHING, seenThrough } from "./guard";
import { leagueStates } from "./league-states";
import { games } from "./show-space";

// A season's cast stats (docs/PLAN-new-design.md step 3; GET /api/seasons/[id]/stats?from=&to=&couch=), for anyone,
// in a game or not: the Cast tab, Tonight's Stats card, the stats page and By the numbers all read it, and the
// Episodes tab of a show you don't play reads the same facts (season-episodes.ts).
//
// Counted from the season's accepted results (season_decisions; never pending ones, which nobody reviewed) up to
// where you are (guard.ts seenThrough), the way a league holds them (cast-stats.ts seasonFacts). Points are the
// couch's game's here, as How it works tells them (a game you play first, a Weekly Lineup first): its points,
// ownership and rulebook; else the season's rulebook's suggested points. A season with no accepted results yet
// (one whose commissioners enter them) counts from that game's own results instead, as you've seen them.
//
// Not polled: read when the Cast tab, the Stats card or a stats page opens, and when the episode slider lets go. A
// season's results are kept per server while they're unchanged (a count and fingerprint each time, computed in the
// database), since every range and everyone on a couch reads them again; the game's state comes from league-states.ts.

export interface SeasonStats extends CastStats {
  /** Where you are on the season; null when you see everything. */
  seenThrough: number | null;
  /** Whose points "Points" are: a game's (its name), else the rulebook's suggestion. */
  pointsFrom: string | null;
  /** Results the shared check isn't sure of yet (step 6b): by episode, then person, "reported" (1 source) or "disputed". */
  unsure: Record<number, Record<string, "reported" | "disputed">>;
}

/** What a facts state takes from a game's settings: what scores, and how. */
const SCORING = ["showFormat", "showFormatData", "rulebook", "leagueRulesetData", "adoptedRuleChanges", "ownershipMode"] as (keyof LeagueSettings)[];

const kept = new Map<string, { version: string; rows: DecisionFact[] }>();

/** A season's accepted results, only what applying one reads; again from memory while nothing about them has changed. */
async function acceptedResults(seasonId: string): Promise<DecisionFact[]> {
  const { rows: v } = await pool.query(
    `SELECT count(*)::int AS n,
            md5(string_agg(concat_ws('|', episode_number, kind, castaway_name, method, event_type, jury_votes, units, applied::text, decided_at), ',' ORDER BY id)) AS print
       FROM season_decisions WHERE season_id = $1 AND status = 'accepted'`,
    [seasonId]
  );
  const version = `${v[0]?.n}:${v[0]?.print}`;
  const had = kept.get(seasonId);
  if (had?.version === version) return had.rows;
  const { rows } = await pool.query<DecisionFact>(
    `SELECT episode_number, post_merge, kind, castaway_name, method, event_type, jury_votes, units, applied
       FROM season_decisions WHERE season_id = $1 AND status = 'accepted'
      ORDER BY episode_number, (kind = 'elimination') DESC, created_at`,
    [seasonId]
  );
  if (kept.size > 50) kept.clear();
  kept.set(seasonId, { version, rows });
  return rows;
}

export interface SeasonFactsFor {
  /** The season's results as a league holds them, up to where you are (or the couch's game, as you've seen it). */
  facts: LeagueState;
  /** Where you are (EVERYTHING when you see it all), as a number to count up to. */
  seen: number;
  mark: number;
  book: StatsBook;
  colours: Record<string, string>;
  pointsFrom: string | null;
}

/** A rulebook's blocks as they are at where you are: its in-force edits applied (a moment an edit added gets its stat
 *  column, docs/PLAN-maker-scoring.md step 1), as Backstage's scoring reads them. */
async function bookOf(row: { id: string; blocks: unknown; aliases: unknown }, mark: number): Promise<StatsBook> {
  const blocks = blocksAt(row.blocks as RulebookBlocks, await inForceEdits(pool, row.id), Number.isFinite(mark) ? mark : Infinity) as RulebookBlocks;
  return { blocks, aliases: row.aliases as StatsBook["aliases"] };
}

/** The facts a viewer's stats are counted from, and how to name and score them. */
export async function seasonFactsFor(user: SessionUser, seasonId: string, couchId: string | null): Promise<SeasonFactsFor> {
  const seen = await seenThrough(user.id, seasonId);
  const mark = seen === EVERYTHING ? Number.POSITIVE_INFINITY : seen;

  const here = await games(user.id, couchId ? { couchIds: [couchId], seasonId } : { mine: true, seasonId });
  // Step R1: a game that scores by moments first (its spec's score.by), never a type compared by name.
  const states = await leagueStates(here.map((g) => g.leagueId));
  const byMoments = new Set(here.filter((g) => { const s = states.get(g.leagueId); return !!s && StateLogic.piecesOf(s).scores === "moments"; }).map((g) => g.leagueId));
  const moments = (g: (typeof here)[number]) => byMoments.has(g.leagueId);
  const rank = (g: (typeof here)[number]) => (g.yourRole ? 0 : 2) + (moments(g) ? 0 : 1);
  const game = [...here].sort((a, b) => rank(a) - rank(b))[0] ?? null;
  const state = game ? states.get(game.leagueId) : undefined;

  const [{ rows: seasonRows }, { rows: cast }, all] = await Promise.all([
    pool.query(
      `SELECT s.format, ss.tribes_from_episode AS "tribesFrom", ss.cast_approved_at IS NOT NULL AS approved
         FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1`,
      [seasonId]
    ),
    pool.query(`SELECT id, name, tribe_name AS "tribeName", photo_url AS "photoUrl" FROM season_cast WHERE season_id = $1 ORDER BY sort_order, name`, [seasonId]),
    Number.isFinite(mark) && mark < 1 ? Promise.resolve([] as DecisionFact[]) : acceptedResults(seasonId),
  ]);
  const decisions = all.filter((d) => d.episode_number <= mark);
  const season = seasonRows[0] ?? { format: null, tribesFrom: null, approved: false };

  // What scores, and the rulebook that names it: the game's, else the season's own (as How it works reads them).
  let settings: Partial<LeagueSettings>;
  let book: StatsBook;
  let view: LeagueState | null = null;
  if (game && state) {
    const { rows } = await pool.query("SELECT player_id FROM league_memberships WHERE league_id = $1 AND user_id = $2", [game.leagueId, user.id]);
    view = StateLogic.GhostLogic.viewFor(state, rows[0]?.player_id ?? null, Number.isFinite(mark) ? mark : null);
    settings = Object.fromEntries(SCORING.filter((k) => state.settings[k] != null).map((k) => [k, state.settings[k]]));
    // A game that scores by moments: its own points, read as it reads them (game spec: a Weekly Lineup's points).
    if (moments(game)) Object.assign(settings, { leagueTypeId: "active-roster", eventPoints: state.settings.eventPoints });
    const row = await rulebookForLeague(pool, { leagueId: game.leagueId, settings: state.settings });
    const format = StateLogic.formatOf(view);
    book = row?.blocks ? await bookOf(row, mark) : rulebookFor(format.id, format.data);
  } else {
    const row = await seasonRulebook(pool, seasonId);
    const format = await resolveFormat(pool, season.format ?? null);
    settings = row?.compiled
      ? { rulebook: { data: row.compiled, reader: row.reader } as LeagueSettings["rulebook"] }
      : ({ showFormat: format.id, showFormatData: isBuiltInFormat(format.id) ? null : format.data } as Partial<LeagueSettings>);
    book = row?.blocks ? await bookOf(row, mark) : rulebookFor(format.id, format.data);
  }

  // The season's results, or (none accepted yet) the game's own as you've seen them.
  const facts =
    season.approved && cast.length && (decisions.length || !view)
      ? seasonFacts({ settings, cast, withTribes: season.tribesFrom == null || mark >= season.tribesFrom, decisions, seen: mark })
      : (view ?? seasonFacts({ settings, cast: season.approved ? cast : [], withTribes: false, decisions: [], seen: 0 }));
  return {
    facts,
    seen,
    mark,
    book,
    colours: Object.fromEntries((view?.tribes ?? []).map((t) => [t.name.toLowerCase(), t.color])),
    pointsFrom: game && moments(game) ? game.name : null,
  };
}

export async function seasonStats(user: SessionUser, seasonId: string, couchId: string | null, range: { from?: string | null; to?: string | null }): Promise<SeasonStats> {
  const f = await seasonFactsFor(user, seasonId, couchId);
  const stats = castStats(f.facts, { seen: f.mark, book: f.book, from: range.from, to: range.to, colours: f.colours });
  const unsure = await unsettledFacts(seasonId, f.mark);
  return {
    ...stats,
    seenThrough: Number.isFinite(f.seen) ? f.seen : null,
    pointsFrom: f.pointsFrom,
    unsure: Object.fromEntries([...unsure].map(([n, people]) => [n, Object.fromEntries(people)])),
  };
}
