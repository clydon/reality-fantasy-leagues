import type { PoolClient } from "pg";
import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import { syncLeagueFormat } from "@db/show-formats.js";
import { syncLeagueChanges } from "@db/season-rule-changes.js";
import { syncLeagueRulebook } from "@db/rulebooks.js";
import { pool, withLeagueLock, HttpError } from "./db";
import { genJoinCode, slugify } from "./league-codes";
import { approvedCastFor, applyCastToState } from "./season-cast";
import { syncLeagueDecisions } from "./season-decisions";

// Making a game in the new design (docs/PLAN-new-design.md step 9 part 3's solo games, step 10 part 2b's Start a game): an
// ordinary league, set up as classic's create wizard sets one up (show, type, season, the season's rule changes, its
// rulebook, the approved cast, the shared results), in one go instead of the wizard's steps.

/** The season a game is made on. */
export interface SeasonRef {
  id: string;
  number: number;
  slug: string;
}

export interface MakeOpts {
  name: string;
  createdBy: string | null;
  /** settings.leagueTypeId. */
  type: string;
  /** A game on no couch (0120): a season's public pool, or someone's practice couch; only one of each can be made. */
  solo?: "public" | "practice" | null;
  /** The couch it's a game on (step 10 part 2b). */
  couchId?: string | null;
  /** A couch's own copy of the season's rulebook (Make it ours, step 6b part 3) that its games play by. */
  rulebookId?: string | null;
  /** Run on the empty state first: its players, added before the results arrive, so nobody's a late joiner. */
  before?: (s: LeagueState) => void;
  /** Run once the cast and results are in, inside the same transaction. */
  after: (s: LeagueState, client: PoolClient, leagueId: string) => void | Promise<void>;
}

/** The solo game of this kind already made (the season's pool, or your practice couch there), or null. */
export async function existingSolo(solo: "public" | "practice", seasonId: string, createdBy: string | null): Promise<string | null> {
  const { rows } =
    solo === "public"
      ? await pool.query("SELECT id FROM leagues WHERE solo = 'public' AND solo_season_id = $1", [seasonId])
      : await pool.query("SELECT id FROM leagues WHERE solo = 'practice' AND solo_season_id = $1 AND created_by = $2", [seasonId, createdBy]);
  return (rows[0]?.id as string | undefined) ?? null;
}

/**
 * A new league on `row`'s season, set up and ready to play. Null when a solo game's insert lost a race (the season's pool,
 * or your practice couch here, already exists).
 */
export async function makeLeague(row: SeasonRef, opts: MakeOpts): Promise<string | null> {
  const state = StateLogic.defaultState();
  StateLogic.ensureNextEpisode(state);
  opts.before?.(state);
  let id: string | null = null;
  for (let attempt = 0; attempt < 5 && !id; attempt++) {
    const { rows } = await pool.query(
      `INSERT INTO leagues (name, slug, join_code, state, created_by, solo, solo_season_id, couch_id, rulebook_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT DO NOTHING RETURNING id`,
      [opts.name, slugify(opts.name), genJoinCode(), JSON.stringify(state), opts.createdBy, opts.solo ?? null, opts.solo ? row.id : null, opts.couchId ?? null, opts.rulebookId ?? null]
    );
    if (rows.length) id = rows[0].id as string;
    else if (opts.solo && (await existingSolo(opts.solo, row.id, opts.createdBy))) return null; // made by someone else meanwhile
    // Otherwise the join code was taken: try another.
  }
  if (!id) throw new HttpError(500, "Couldn't make the game, try again");
  const leagueId = id;
  await withLeagueLock(leagueId, async (s, client) => {
    StateLogic.updateSettings(s, "showId", row.slug);
    await syncLeagueFormat(client, s.settings, row.slug);
    StateLogic.updateSettings(s, "leagueTypeId", opts.type);
    StateLogic.updateSettings(s, "revealedThroughEpisode", null);
    StateLogic.updateSettings(s, "wikiSeason", row.number);
    await syncLeagueChanges(client, s.settings, { adoptAll: true });
    await syncLeagueRulebook(client, leagueId, s.settings);
    const approved = await approvedCastFor(client, row.slug, row.number);
    if (approved) applyCastToState(s, approved.cast, approved.tribesFromEpisode);
    await syncLeagueDecisions(client, leagueId, s);
    await opts.after(s, client, leagueId);
    StateLogic.updateSettings(s, "setupComplete", true);
  });
  return leagueId;
}
