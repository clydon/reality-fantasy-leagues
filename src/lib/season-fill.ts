// Getting it ready (docs/PLAN-getting-it-ready.md): the pure part, shared by the job (server/season-fill.ts), the page that shows
// it (new/show/getting-ready.tsx) and their tests (tests/season-fill.test.js). A season someone adds is got ready by itself, in
// order: how it's played (its rulebook), who's in it (its cast), then what happened in each aired episode (recaps, and results
// where they're ours to look up). Each step is skipped when what it gets is there already, or isn't ours to get.

export const FILL_STEPS = ["rules", "cast", "episodes"] as const;
export type FillStep = (typeof FILL_STEPS)[number];

/** What a season has, as the job sees it before each step. */
export interface FillFacts {
  /** shows.kind: competition, series, talk or sport. */
  kind: string;
  /** A game already (shows.set_up_at). */
  setUp: boolean;
  /** The season has its own rulebook (show_seasons.rulebook_id). */
  hasRulebook: boolean;
  /** People in the season's cast. */
  cast: number;
  /** Games on the season: its cast is theirs (the desk's and whoever runs them), never ours to send. */
  games: number;
  /** Whoever added it wants the episodes looked up (Add's switch). */
  episodes: boolean;
  /** Aired episodes with no recap yet. */
  recapsMissing: number;
  /** Aired episodes whose results are ours to look up and nobody has asked about (research-asks.ts). */
  resultsMissing: number;
}

/** What a step does now: nothing (it's there, or isn't ours), something quick with no bot, or an ask of our bot. */
export type StepAction = "skip" | "now" | "bot";

export function stepAction(step: FillStep, f: FillFacts): StepAction {
  const sport = f.kind === "sport";
  if (step === "rules") {
    // A sport plays by its own rules, its people from its sports data (sports/season.ts).
    if (sport) return "skip";
    if (f.setUp) return f.hasRulebook ? "skip" : "now";
    // A brand-new show: Make it a game, by itself (how it works, then who's in it, in one go).
    return "bot";
  }
  if (step === "cast") return sport || !f.setUp || f.cast > 0 || f.games > 0 || f.kind === "talk" ? "skip" : "bot";
  if (!f.episodes) return "skip";
  if (f.recapsMissing > 0) return "bot";
  return f.resultsMissing > 0 ? "now" : "skip";
}

/** Which steps a season shows at all: a sport only its episodes, a talk show no cast, and the episodes once any have aired. */
export function stepsShown(f: Pick<FillFacts, "kind" | "episodes">, aired: number): FillStep[] {
  return FILL_STEPS.filter((s) => (s === "episodes" ? f.episodes && aired > 0 : f.kind !== "sport" && !(s === "cast" && f.kind === "talk")));
}

/** A step as it's shown: in, being got now, its turn still to come, or stopped (Try again). */
export type StepState = "done" | "working" | "next" | "stuck";

/**
 * An episode's tile: nothing yet, being looked up now, what happened in (its results still to come), everything in, or not
 * found. `results` false: its results aren't ours to look up (a show nobody's made a game, a sport, one a game plays), so
 * what happened is everything.
 */
export type TileState = "waiting" | "asking" | "half" | "done" | "none";

export function tileState(o: {
  summary: boolean;
  /** Its recap is being asked right now (one ask covers every missing one). */
  recapAsking: boolean;
  results: boolean;
  /** Its results' ask (research-asks.ts AskStatus), or null when it hasn't one. */
  ask: "waiting" | "asking" | "done" | "failed" | null;
  /** The job's done with the episodes (nothing more is coming for a tile still empty). */
  settled: boolean;
}): TileState {
  if (o.recapAsking && !o.summary) return "asking";
  if (!o.results) return o.summary ? "done" : o.settled ? "none" : "waiting";
  if (o.ask === "asking") return "asking";
  if (o.ask === "done") return "done";
  if (o.ask === "failed") return o.summary ? "half" : "none";
  return o.summary ? "half" : o.settled && !o.ask ? "none" : "waiting";
}

/** The line under the call sheet (and the show header's chip): what's happening now, in the show's own words. */
export function fillLine(
  o: { step: FillStep | null; status: "none" | "going" | "stuck" | "done"; tiles: TileState[]; away: boolean },
  w: { people: string; episode: string; episodes: string }
): string {
  if (o.status === "stuck") return "Stopped partway. Try again.";
  if (o.status !== "going") return "All set";
  if (o.away) return "Waiting for our bot to come back";
  if (o.step === "rules") return "Reading how it's played";
  if (o.step === "cast") return `Finding the ${w.people.toLowerCase()}`;
  if (o.tiles.length) {
    const n = o.tiles.length;
    const full = o.tiles.filter((t) => t === "done" || t === "none").length;
    const asking = o.tiles.filter((t) => t === "asking").length;
    // One ask covers every recap still missing; results come one episode at a time.
    if (asking > 1) return `Looking up what happened in ${asking} ${w.episodes.toLowerCase()}`;
    if (asking === 1) return `Catching up on ${w.episode} ${o.tiles.indexOf("asking") + 1} of ${n}`;
    if (o.tiles.includes("half")) return `Results: ${full} of ${n} ${w.episodes.toLowerCase()} in`;
    return `${full} of ${n} ${w.episodes.toLowerCase()} in`;
  }
  return "Almost there";
}
