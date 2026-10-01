import type { LeagueState } from "./types";
import StateLogic from "./state-logic.js";

type EventDef = ReturnType<typeof StateLogic.formatOf>["events"][number];

/**
 * The show's scoring events in its display categories (format.eventCategories -- Challenges, Tribal
 * Council, Endgame...), in that order and each category in its listed order; anything a format left
 * uncategorised goes in a trailing "Other". Shared by the lineup card's "How starters score" and
 * League Settings' scoring list, so the two always group alike.
 */
export function scoringGroups(state: LeagueState): { id: string; label: string; events: EventDef[] }[] {
  const format = StateLogic.formatOf(state);
  const byId = new Map(format.events.map((e) => [e.id, e]));
  const listed = new Set(format.eventCategories.flatMap((c) => c.events));
  return [
    ...format.eventCategories.map((c) => ({
      id: c.id,
      label: c.label,
      events: c.events.map((id) => byId.get(id)).filter((e): e is EventDef => !!e),
    })),
    { id: "other", label: "Other", events: format.events.filter((e) => !listed.has(e.id)) },
  ].filter((g) => g.events.length > 0);
}
