import type * as GalleryModule from "@/lib/game/start-gallery/index.js";
import type { Base, PageFacts, Spec } from "@/lib/game/start-gallery/index.js";

// Make it… (the bold pass, docs/design-round/wizard-r2b-spec.md §3): U0's settled quick changes (docs/PLAN-start-a-game-gpt.md,
// "Settled: B, with quick changes", 2026-11-08) drawn on the gallery's catalog. More competitive climbs a ladder per kind of game,
// only upward; More casual comes back down, then to an easier game of the same kind; Different scoring takes the next way to
// score in turn. Each step is a catalog change (or another base) the engine checks before it's offered, so a step that can't go
// with this game is passed over, and a button with nothing left is dashed with why. The same changes are in the game's rules
// rows: repeated here by goal, on purpose (the user, 2026-11-18).

type GM = typeof GalleryModule;
export type Goal = "comp" | "casual" | "score";

interface Rung {
  row: string;
  id: string;
  /** A control set after it's on (Picking the same one again: never). */
  set?: [string, unknown];
  on: string;
  off: string;
}

const UP: Record<string, Rung[]> = {
  draft: [
    { row: "compete", id: "matchups", on: "head to head each {ep}", off: "most points wins again" },
    { row: "scoring", id: "captain", on: "a captain scores double", off: "no captain" },
    { row: "compete", id: "knockouts", on: "the lowest each {ep} is out", off: "nobody's knocked out" },
    { row: "scoring", id: "bounty", on: "bounties on the vote", off: "no bounties" },
    { row: "twists", id: "bootcall", on: "guess who goes home too", off: "no boot call" },
  ],
  pick: [
    { row: "play", id: "repeat", set: ["repeat", "never"], on: "never the same pick twice", off: "the same pick again is fine" },
    { row: "compete", id: "matchups", on: "head to head each {ep}", off: "most points wins again" },
    { row: "compete", id: "knockouts", on: "the lowest each {ep} is out", off: "nobody's knocked out" },
  ],
  questions: [
    { row: "bets", id: "lone", on: "only a lone right answer scores", off: "every right answer scores" },
    { row: "compete", id: "matchups", on: "head to head each {ep}", off: "most points wins again" },
    { row: "compete", id: "knockouts", on: "the lowest each {ep} is out", off: "nobody's knocked out" },
  ],
};

/** Easier games of the same kind, for More casual once the twists are off: [from, to, what it says]. */
const EASIER: [string, string, string][] = [
  ["fantasy", "bestball", "now Best ball: no lineups to set"],
  ["h2h", "bestball", "now Best ball: no lineups to set"],
  ["guillotine", "bestball", "now Best ball: nobody's cut"],
  ["bestball", "outlast", "now Outlast: draft once, then just watch"],
  ["pool", "lives", "now 2 lives: one wrong pick forgiven"],
  ["norepeat", "lives", "now 2 lives, and repeats are fine"],
];

const SCORE: Record<string, Rung[]> = {
  questions: [
    { row: "bets", id: "pot", on: "split the pot: everyone right shares", off: "a point for each right answer" },
    { row: "bets", id: "jackpot", on: "nobody right? It rolls over", off: "a point for each right answer" },
  ],
  draft: [
    { row: "scoring", id: "only", on: "only the big moments score", off: "every moment scores" },
    { row: "scoring", id: "reverse", on: "the first out scores most", off: "the last one standing scores most" },
    { row: "scoring", id: "times", on: "the finale counts double", off: "every episode counts the same" },
  ],
  pick: [
    { row: "scoring", id: "only", on: "only the big moments score", off: "every moment scores" },
  ],
};

export interface Step {
  goal: Goal;
  /** What the step does, for the button's second line and the toast ("head to head each episode"). */
  says: string;
  spec: Spec;
  /** The rules row it changes (marked Changed with its Undo), or null when it swaps the game. */
  row: string | null;
  /** A different game, when More casual swaps to an easier one. */
  base?: Base;
}

const words = (s: string, ep: string) => s.replace("{ep}", ep);

function tryRung(gm: GM, spec: Spec, r: Rung, pg: PageFacts, turnOn: boolean): Spec | null {
  const st = gm.changeStates(spec, r.row, pg).find((c) => c.id === r.id);
  if (!st || st.coming) return null;
  if (turnOn && (st.on || st.why)) return null;
  if (!turnOn && !st.on) return null;
  let next = turnOn ? gm.applyChange(spec, r.id, pg) : gm.dropChange(spec, r.id, pg);
  if (turnOn && r.set) next = gm.setControl(next, r.id, r.set[0], r.set[1], pg);
  return gm.check(next, pg).ok ? next : null;
}

/** The next step a goal would take on this game, or why there's none (the button is dashed with it). */
export function nextStep(gm: GM, goal: Goal, base: Base, spec: Spec, span: Spec["span"], pg: PageFacts, ep: string): Step | { why: string } {
  const kind = gm.kindOf(spec);
  if (goal === "comp") {
    for (const r of UP[kind] ?? []) {
      const s = tryRung(gm, spec, r, pg, true);
      if (s) return { goal, says: words(r.on, ep), spec: s, row: r.row };
    }
    return { why: `As competitive as ${base.name} gets here` };
  }
  if (goal === "casual") {
    for (const r of [...(UP[kind] ?? [])].reverse()) {
      const s = tryRung(gm, spec, r, pg, false);
      if (s) return { goal, says: words(r.off, ep), spec: s, row: r.row };
    }
    const to = EASIER.find(([from]) => from === base.id);
    const b = to ? gm.baseById(to[1]) : null;
    if (to && b && span) {
      const s = gm.baseSpec(b, span as { from: number; to: null }, pg);
      if (s && gm.check(s, pg).ok) return { goal, says: to[2], spec: s, row: null, base: b };
    }
    return { why: `As casual as ${base.name} gets here` };
  }
  const rungs = SCORE[kind] ?? [];
  const on = rungs.findIndex((r) => gm.changeStates(spec, r.row, pg).find((c) => c.id === r.id)?.on);
  for (let i = on + 1; i < rungs.length; i++) {
    const cleared = on >= 0 ? tryRung(gm, spec, rungs[on], pg, false) ?? spec : spec;
    const s = tryRung(gm, cleared, rungs[i], pg, true);
    if (s) return { goal, says: words(rungs[i].on, ep), spec: s, row: rungs[i].row };
  }
  if (on >= 0) {
    const s = tryRung(gm, spec, rungs[on], pg, false);
    if (s) return { goal, says: words(rungs[on].off, ep), spec: s, row: rungs[on].row };
  }
  return { why: rungs.length ? "No other way to score this one here" : `${base.name} scores one way` };
}
