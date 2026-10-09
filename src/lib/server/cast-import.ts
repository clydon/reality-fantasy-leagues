import StateLogic from "@/lib/game/state-logic.js";
import { parseCastImport, toCastImport, toCastRoles } from "@/lib/game/formats/cast-prompt.js";
import type { LeagueState } from "@/lib/game/types";

// The "Import a cast" paste flow's write (docs/PLAN-cast-import-prompt.md), kept out of the route so
// it can be tested without a database. The answer is parsed again here against the league's own
// format rather than trusted from the review screen -- a role that isn't one of format.roles.values
// never reaches state, whatever the client sent.
//
// Order matters: applyCastImport creates anyone new first, then applyCastRoles matches them by name.
// Both are additive and idempotent, so re-importing the same answer changes nothing.
export function importCast(state: LeagueState, raw: unknown) {
  const { format, parsed } = parseForLeague(state, raw);
  const added = StateLogic.applyCastImport(state, toCastImport(parsed));
  const roles = StateLogic.applyCastRoles(state, toCastRoles(parsed, format));
  return { added, roles };
}

/** The answer parsed against this league's own format -- shared by both import paths. */
export function parseForLeague(state: LeagueState, raw: unknown) {
  const format = StateLogic.formatOf(state);
  return { format, parsed: parseCastImport(raw, format) };
}

/**
 * A league on a season: the people, photos and starting groups go to the SEASON's cast (season-cast-
 * write.ts) as a CastOp; roles are not cast (docs/PLAN-universal-season-cast.md, open question 2) and
 * are recorded into this league only, at episode 1, by `recordRoles`.
 */
export function seasonImportOp(state: LeagueState, raw: unknown, tribesFromEpisode: number | null | undefined) {
  const { format, parsed } = parseForLeague(state, raw);
  const payload = toCastImport(parsed);
  return {
    op: { type: "import" as const, castaways: payload.castaways, tribesFromEpisode },
    recordRoles: (s: LeagueState) => StateLogic.applyCastRoles(s, toCastRoles(parsed, format)),
  };
}
