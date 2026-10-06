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
  const format = StateLogic.formatOf(state);
  const parsed = parseCastImport(raw, format);
  const added = StateLogic.applyCastImport(state, toCastImport(parsed));
  const roles = StateLogic.applyCastRoles(state, toCastRoles(parsed, format));
  return { added, roles };
}
