import StateLogic from "@/lib/game/state-logic.js";
import * as Spec from "@/lib/game/game-spec/index.js";
import * as Facts from "@/lib/game/formats/episode-facts.js";
import type { FactEntry, FactOutcome } from "@/lib/game/formats/episode-facts.js";
import type { LeagueState } from "@/lib/game/types";
import { pool } from "./db";

// A13 part 2: episode facts, for a game a fact settles (docs/PLAN-start-a-game-gpt.md step A13; game-spec schema.js's
// `settle: { by: 'fact' }`). Every show's research answers them after each episode, in its stored answer's episodeFacts section
// (db/episode-research.js; formats/episode-facts.js reads it): who says the episode's title quote, and how sure. Read on each read
// of the game (the grader's facts.episodeFacts), never stored, from the season's stored combined research, as F3's format groups
// are (answer-points.ts formatGroupsFor): research that lands, or a correction, is read at once. And for our check, what research
// has returned of each fact on the show (factContext): the season tapes' measure added to the show's stored episodes.

/** Whether a game asks a question an episode fact settles. */
export const asksFacts = (state: LeagueState): boolean => StateLogic.AnswerLogic.questions(state).some(Spec.isFact);

/**
 * Each episode fact as research said it, by episode, for a game a fact settles (undefined for any other, or one on no season): an
 * entry for each episode research has stored its answer for (the full run's, or a paste: the combined row; the quick check's
 * early results aren't one), each fact's outcome with its person found in the viewer's cast (`view`: the league as they see it);
 * an answer without the facts section (asked before it was, or by a pass that leaves it out) says nothing ('unsure': research
 * didn't say). The grader reads only the episodes the viewer has seen with results. The league's season is its settings' show and
 * number (push-events.ts leagueSeason's), so a copy or a stage reads its own.
 */
export async function episodeFactsFor(state: LeagueState, view: LeagueState): Promise<Map<number, Record<string, FactOutcome>> | undefined> {
  if (!asksFacts(state)) return undefined;
  const s = state.settings ?? {};
  if (!s.showId || s.wikiSeason == null || !Number.isFinite(Number(s.wikiSeason))) return undefined;
  const { rows } = await pool.query(
    `SELECT er.episode_number, er.payload->'episodeFacts' AS facts
       FROM episode_research er JOIN shows sh ON sh.id = er.show_id
      WHERE sh.slug = $1 AND er.season_number = $2 AND er.source = 'combined'`,
    [s.showId, Number(s.wikiSeason)]
  );
  const cast = (view.castaways ?? []).map((c) => ({ id: c.id, name: c.name }));
  const out = new Map<number, Record<string, FactOutcome>>();
  for (const r of rows) {
    const section = Facts.looseEpisodeFacts(r.facts);
    const said: Record<string, FactOutcome> = {};
    for (const id of Facts.FACT_IDS) said[id] = Facts.outcomeOf(section, id, cast) ?? { state: "unsure", why: "Research didn't say" };
    out.set(Number(r.episode_number), said);
  }
  return out;
}

/**
 * Research's own counts of each fact on a show's stored episodes, every season but those the season tapes' measure already counts
 * (`skip`: a local database with the tapes loaded and replayed holds them too), by fact (episode-facts.js measure). Read when a game
 * is checked (its start, the lab), never on a game's reads.
 */
export async function factMeasures(showSlug: string, skip: number[] = []): Promise<Record<string, Required<FactEntry>>> {
  // Each answer with its season's cast (season_cast's names, the ones research was asked about), so a name is read as a game reads it.
  const { rows } = await pool.query(
    `SELECT er.payload->'episodeFacts' AS facts,
            COALESCE((SELECT array_agg(sc.name) FROM show_seasons ss JOIN season_cast sc ON sc.season_id = ss.id
                       WHERE ss.show_id = er.show_id AND ss.season_number = er.season_number), '{}') AS cast_names
       FROM episode_research er JOIN shows sh ON sh.id = er.show_id
      WHERE sh.slug = $1 AND er.source = 'combined' AND jsonb_typeof(er.payload->'episodeFacts') = 'object' AND NOT (er.season_number = ANY($2::int[]))`,
    [showSlug, skip]
  );
  const items = rows.map((r) => ({ section: Facts.looseEpisodeFacts(r.facts), cast: (r.cast_names as string[]).map((name) => ({ id: name, name })) }));
  return Object.fromEntries(Facts.FACT_IDS.map((id) => [id, Facts.measure(items, id)]));
}

/** What our check knows of each fact on a show (the ctx's facts): the season tapes' measure and the show's stored episodes. */
export async function factContext(showSlug: string | null | undefined): Promise<Record<string, Required<FactEntry>>> {
  const live = showSlug ? await factMeasures(showSlug, Facts.measuredSeasons(showSlug)) : {};
  return Object.fromEntries(Facts.FACT_IDS.map((id) => [id, Facts.entryFor(showSlug ?? "", id, live[id])]));
}

/** The same for a season by its catalogue row (show_seasons.id). */
export async function factContextForSeason(seasonId: string): Promise<Record<string, Required<FactEntry>>> {
  const { rows } = await pool.query("SELECT s.slug FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1", [seasonId]);
  return factContext((rows[0]?.slug as string | undefined) ?? null);
}
