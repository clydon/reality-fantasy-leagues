import StateLogic from "./state-logic.js";
import { rulebookFor } from "./formats/blocks/index.js";
import { momentsFor } from "./formats/rulebook-moments.js";
import type { LeagueState } from "./types";

// One name for each moment everywhere it's shown (the user's pick, 2026-11-22, BACKLOG 251): the rulebook's, as the show's stats,
// Their numbers and a castaway's story name it (cast-stats.ts statDefs): "Won the Immunity challenge", never the game format's
// older "Individual immunity win" on one screen and the rulebook's on the next. Display only. A game's format keeps its own labels
// (rulebook-compile.js keeps the base's, so recorded answers and the research that reads them mean what they always did); a
// moment the rulebook doesn't name (a couch's own) keeps the format's.

type Format = ReturnType<typeof StateLogic.formatOf>;
const memo = new WeakMap<object, Map<string, string>>();

function namesOf(format: Format): Map<string, string> {
  const hit = memo.get(format);
  if (hit) return hit;
  const names = new Map<string, string>(format.events.map((e: { id: string; label?: string }) => [e.id, e.label ?? e.id]));
  try {
    const book = rulebookFor(format.id, format.data);
    for (const m of momentsFor(book.blocks)) {
      const id = book.aliases?.events?.[m.id] ?? m.id;
      if (names.has(id) && m.label) names.set(id, m.label);
    }
  } catch {
    // A format no rulebook reads: its own labels.
  }
  memo.set(format, names);
  return names;
}

/** A moment's name in the show's words, by its event type. */
export function momentName(state: LeagueState, type: string): string {
  return namesOf(StateLogic.formatOf(state)).get(type) ?? type;
}

/** The same, for many: a lookup made once for a state. */
export function momentNamer(state: LeagueState): (type: string) => string {
  const names = namesOf(StateLogic.formatOf(state));
  return (type) => names.get(type) ?? type;
}
