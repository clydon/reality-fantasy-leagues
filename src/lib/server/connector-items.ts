import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";

// Reversing an ACCEPTED connector decision (wiki_proposal_items / episode_research_items), so a
// commissioner can change their mind: re-accept with an edit, or reject something already accepted.
// Decided rows stay on the episode card (green/red) with their buttons still live, which only works
// if the other button can actually undo what the first one applied.
//
// Undoes exactly what the accept route applied: the committed values are `applied` when the
// commissioner corrected the item, otherwise the item as extracted/researched. If the thing is no
// longer in state (removed by hand since), there's simply nothing to undo.
export interface DecidedItem {
  episode_number: number;
  kind: "elimination" | "event" | "exiled";
  castaway_name: string;
  event_type: string;
  applied: { castawayName?: string; eventType?: string } | null;
}

export function undoAppliedItem(state: LeagueState, item: DecidedItem): void {
  const ep = state.episodes.find((e) => e.number === item.episode_number);
  if (!ep) return;
  const name = item.applied?.castawayName || item.castaway_name;
  const { castaway } = StateLogic.Core.findCastawayByName(state, name);
  if (!castaway) return;

  if (item.kind === "elimination") {
    if ((ep.events || []).some((e) => e.castawayId === castaway.id)) StateLogic.removeElimination(state, ep.id, castaway.id);
  } else if (item.kind === "event") {
    const type = item.applied?.eventType || item.event_type;
    const ev = (ep.scoringEvents || []).find((e) => e.type === type && e.castawayId === castaway.id);
    if (ev) StateLogic.removeScoringEvent(state, ep.id, ev.id);
  } else if (item.kind === "exiled") {
    StateLogic.removeExiled(state, ep.id, castaway.id);
  }
}
