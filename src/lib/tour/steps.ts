import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { TOUR_ME, pickupName, starIn } from "./rise-and-fall";

// The player path (docs/PLAN-guided-tour.md, "Player path"): one host line and one tap per step, no
// Next buttons. A step ends on what the tap DID to the league or where it took you (drafted, lineup
// saved, episode revealed, pickup made, page reached), never on the click itself, so a redesign that
// moves a button doesn't break the tour -- only one that removes a `data-tour` target does, and the
// headless script (docs/ux-baseline/scripts/tour.js) catches that.
//
// If a step can't be said in one line of about 12 words, the screen is the problem, not the tour.

export interface TourCtx {
  /** What the viewer sees (results they haven't revealed held back). */
  state: LeagueState;
  /** The league as it is. */
  full: LeagueState;
  pathname: string;
  /** The last episode the viewer has revealed. */
  seen: number;
}

export interface TourStep {
  id: string;
  /** The progress label: the tour reads as episodes, not step counts. */
  progress: string;
  /** Where the step happens. Anywhere else, `nav` says how to get there. */
  route?: (pathname: string) => boolean;
  line: (ctx: TourCtx) => string;
  /** `data-tour` targets lit and tappable. None: no spotlight, the page is yours to look at. */
  targets: string[];
  /** Lit to be looked at, not tapped. */
  look?: string[];
  nav?: { line?: (ctx: TourCtx) => string; targets: string[] };
  done: (ctx: TourCtx) => boolean;
  /** The last card: its own actions instead of a tap. */
  end?: boolean;
}

const at = (path: string) => (p: string) => p === path;
const ep = (s: LeagueState, n: number) => s.episodes.find((e) => e.number === n);
const hasResults = (s: LeagueState, n: number) => {
  const e = ep(s, n);
  return !!e && StateLogic.episodeHasResults(e);
};
const draftDone = (s: LeagueState) => !!StateLogic.currentDraftTurn(s)?.isComplete;
const myLineup = (s: LeagueState, n: number) => ep(s, n)?.lineups?.[TOUR_ME] ?? [];
const pickedUp = (s: LeagueState) => s.castaways.some((c) => c.ownerIds.includes(TOUR_ME) && c.acquiredVia === "replenish");

// Clive wins every week (rise-and-fall.ts); what that meant for you depends on whether you drafted him
// and started him -- the bench lesson, when he was on yours.
function afterStarWon(s: LeagueState): string {
  const { owner, started } = starIn(s, 1);
  if (owner === TOUR_ME) return started ? "Clive won, and you started him: +3. Tap Scoreboard." : "Clive won from your bench, so it didn't count. Tap Scoreboard.";
  const name = s.players.find((p) => p.id === owner)?.name;
  return name ? `Clive won for ${name}. Only starters score. Tap Scoreboard.` : "Clive won. Only starters score. Tap Scoreboard.";
}

export const PLAYER_TOUR: TourStep[] = [
  {
    id: "rules",
    progress: "Episode 1 of 2",
    // Non-breaking spaces keep each rule on one line: "Bottom two" / "−1" reads as two separate claims.
    line: () => "Winner +3. Bottom two −1. That's it. Tap Draft.",
    targets: ["tab-draft"],
    done: (c) => c.pathname === "/draft" || draftDone(c.full),
  },
  {
    id: "draft",
    progress: "Episode 1 of 2",
    route: at("/draft"),
    line: () => "Pick 3 bakers. Tap one, then Draft.",
    targets: ["picker-tiles", "picker-confirm"],
    nav: { targets: ["tab-draft"] },
    done: (c) => draftDone(c.full),
  },
  {
    id: "lineup",
    progress: "Episode 1 of 2",
    route: at("/lineup"),
    line: () => "Only starters score. Start two, bench one.",
    targets: ["lineup-starting", "lineup-bench"],
    nav: { targets: ["tab-lineup"] },
    done: (c) => myLineup(c.full, 1).length >= 2 || hasResults(c.full, 1),
  },
  {
    id: "reveal-1",
    progress: "Episode 1 of 2",
    route: at("/episodes"),
    line: () => "Episode 1 aired. Reveal it.",
    targets: ["episode-reveal", "reveal-confirm"],
    nav: { targets: ["tab-episodes"] },
    done: (c) => c.seen >= 1,
  },
  {
    id: "standings",
    progress: "Episode 1 of 2",
    line: (c) => afterStarWon(c.full),
    targets: ["tab-scoreboard"],
    done: (c) => c.pathname.startsWith("/scoreboard"),
  },
  {
    id: "chat",
    progress: "Episode 1 of 2",
    line: () => "Ben has something to say. Have a look.",
    look: ["scoreboard"],
    targets: ["header-chat"],
    done: (c) => c.pathname === "/chat",
  },
  {
    id: "pickup",
    progress: "Episode 2 of 2",
    route: at("/mid-season"),
    line: (c) => `Pick up ${pickupName(c.full) ?? "a free agent"}. Tap, then confirm.`,
    targets: ["picker-tiles", "picker-confirm"],
    nav: { line: () => "A baker went home. Your open spot is under More.", targets: ["tab-more", "more-midseason"] },
    done: (c) => pickedUp(c.full),
  },
  {
    id: "reveal-2",
    progress: "Episode 2 of 2",
    route: at("/episodes"),
    line: () => "Episode 2 aired. Reveal it.",
    targets: ["episode-reveal", "reveal-confirm"],
    nav: { targets: ["tab-episodes"] },
    done: (c) => c.seen >= 2,
  },
  {
    id: "end",
    progress: "Season over",
    route: at("/scoreboard"),
    line: () => "That's the whole season.",
    targets: [],
    nav: { line: () => "Clive wins again. See the final standings.", targets: ["tab-scoreboard"] },
    done: () => false,
    end: true,
  },
];
