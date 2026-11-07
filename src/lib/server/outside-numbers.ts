import StateLogic from "@/lib/game/state-logic.js";
import * as Spec from "@/lib/game/game-spec/index.js";
import type { OutsideOutcome } from "@/lib/game/game-spec/index.js";
import type { LeagueState } from "@/lib/game/types";
import { pool } from "./db";

// A14 part 7: a number from a vetted outside source, for a game one settles (docs/PLAN-start-a-game-gpt.md step A14 part 7;
// game-spec schema.js `settle: { by: 'outside' }`; migration 0213). db/outside-numbers.js reads each episode's TVmaze rating once,
// `after` days after it aired, and stores it; this reads what's stored, on each read of the game (the grader's facts.outside), so a
// number that lands is read at once and every league on the season reads the same one. Nothing stored yet: the grader waits.

/** Whether a game asks a question an outside number settles. */
export const asksOutside = (state: LeagueState): boolean => StateLogic.AnswerLogic.questions(state).some(Spec.isOutside);

/** Why a stored number is missing, as a player reads it (each void: no points either way). */
function whyOf(why: string, after: number): string {
  if (why === "unlisted") return "This season isn't linked to TVmaze, so there was no rating for it";
  if (why === "unreached") return "TVmaze couldn't be reached for its rating";
  return `TVmaze had no rating for it ${after === 1 ? "a day" : `${after} days`} after it aired`;
}

/**
 * Each outside number stored for a game's season, by episode and key (schema.js outsideKey: 'tvmaze:rating:7'), for a game an outside
 * number settles (undefined for any other, or one on no season). A key with nothing stored has no entry: the grader waits.
 */
export async function outsideNumbersFor(state: LeagueState): Promise<Map<number, Record<string, OutsideOutcome>> | undefined> {
  if (!asksOutside(state)) return undefined;
  const s = state.settings ?? {};
  if (!s.showId || s.wikiSeason == null || !Number.isFinite(Number(s.wikiSeason))) return undefined;
  const { rows } = await pool.query(
    `SELECT o.episode, o.source, o.what, o.after_days, o.value, o.why
       FROM outside_numbers o JOIN show_seasons ss ON ss.id = o.season_id JOIN shows sh ON sh.id = ss.show_id
      WHERE sh.slug = $1 AND ss.season_number = $2`,
    [s.showId, Number(s.wikiSeason)]
  );
  const out = new Map<number, Record<string, OutsideOutcome>>();
  for (const r of rows) {
    const n = Number(r.episode);
    const key = Spec.outsideKey({ source: r.source, take: r.what, after: Number(r.after_days) });
    const said = out.get(n) ?? {};
    said[key] = r.value === null ? { state: "none", why: whyOf(String(r.why), Number(r.after_days)) } : { state: "value", value: Number(r.value) };
    out.set(n, said);
  }
  return out;
}

/** Whether a season is linked to its TVmaze listing (our check's ctx.tvmaze: an outside number needs it). */
export async function tvmazeLinked(seasonId: string): Promise<boolean> {
  const { rows } = await pool.query("SELECT listing_id FROM show_seasons WHERE id = $1", [seasonId]);
  return rows[0]?.listing_id != null;
}
