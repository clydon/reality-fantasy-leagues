import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { TOUR_ME, pickupName, winnerIn } from "./rise-and-fall";

// The player path (docs/PLAN-guided-tour.md, "Player path"): one host line and one tap per step, no
// Next buttons. A step ends on what the tap DID to the league or where it took you (drafted, lineup
// saved, episode revealed, pickup made, page reached), never on the click itself, so a redesign that
// moves a button doesn't break the tour -- only one that removes a `data-tour` target does, and the
// headless script (docs/ux-baseline/scripts/tour.js) catches that.
//
// If a step can't be said in one line of about 12 words, the screen is the problem, not the tour. The
// optional `detail` under it says what the step means for someone who's never played: why, not where.

export interface TourCtx {
  /** What the viewer sees (results they haven't revealed held back). */
  state: LeagueState;
  /** The league as it is. */
  full: LeagueState;
  pathname: string;
  /** The last episode the viewer has revealed. */
  seen: number;
  /** The commissioner's tour: whether its league is created yet and its code copied. */
  tour: { created: boolean; copied: boolean };
}

export interface TourStep {
  id: string;
  /** The progress label: the tour reads as episodes, not step counts. */
  progress: string;
  /** Where the step happens. Anywhere else, `nav` says how to get there. */
  route?: (pathname: string) => boolean;
  line: (ctx: TourCtx) => string;
  /** A sentence or two under the line, in plain words: what this means and why it matters. */
  detail?: (ctx: TourCtx) => string;
  /** `data-tour` targets lit and tappable. None: no spotlight, the page is yours to look at. */
  targets: string[];
  /** Lit to be looked at, not tapped. */
  look?: string[];
  nav?: {
    line?: (ctx: TourCtx) => string;
    detail?: (ctx: TourCtx) => string;
    targets: string[];
  };
  done: (ctx: TourCtx) => boolean;
  /** The last card: its own actions instead of a tap. */
  end?: boolean;
  /** A card with nothing to tap on the page: this button on the plate moves the tour on. */
  cta?: string;
  /** An episode airing (the practice round): the plate counts down to its results. */
  onAir?: boolean;
  /** The end card's line under the headline; the tour's own when absent. */
  note?: string;
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

// Clive or Jo wins each week (rise-and-fall.ts); what that meant for you depends on who drafted them
// and whether they were started -- the bench lesson, when the winner was on yours.
const winnerName = (s: LeagueState, n: number) => winnerIn(s, n)?.name ?? "Clive";
function winnerDetail(s: LeagueState): string {
  const w = winnerIn(s, 1);
  if (!w) return "";
  if (w.owner === TOUR_ME) return w.started ? `${w.name} scored +3 for you.` : `${w.name} won from your bench, so it didn't count.`;
  const who = s.players.find((p) => p.id === w.owner)?.name;
  if (!who) return `Nobody had ${w.name}.`;
  return w.started ? `${w.name} scored +3 for ${who}.` : `${w.name} was on ${who}'s bench: no points.`;
}

// Getting around: one card per tab, lit to be looked at, with Next on the plate. On desktop the sidebar
// has no `data-tour` targets, so there the host talks and nothing is lit. The league name up top gets a
// card of its own, right after Overview (where it's the page's title): it's how you change leagues.
const TABS: { tab: string; line: string; detail: string }[] = [
  {
    tab: "tab-overview",
    line: "Overview: your league at a glance.",
    detail: "What needs doing, the standings and how last week went, all on one page.",
  },
  {
    tab: "header-league",
    line: "In more than one league? Tap the league name to switch.",
    detail:
      "Every league you're in is in that menu. Linked leagues, on the same season with one shared chat, are a swipe apart too: swipe left or right on any page.",
  },
  {
    tab: "tab-episodes",
    line: "Episodes: every episode, one by one.",
    detail: "Results wait here until you reveal them, so nothing is spoiled before you've watched.",
  },
  {
    tab: "tab-scoreboard",
    line: "Scoreboard: who's winning.",
    detail: "Everyone's points, episode by episode. Tap a player to see their team.",
  },
  {
    tab: "tab-draft",
    line: "Draft now, Lineup later.",
    detail: "Pick your team here. Once the draft is done, this tab becomes Lineup: who you start each week.",
  },
  {
    tab: "tab-research",
    line: "Research: how every baker is scoring.",
    detail: "Points for the whole cast, who's still a free agent and who's on each team.",
  },
  {
    tab: "tab-more",
    line: "More: everything else.",
    detail:
      "Mid-Season for pickups and swaps, League Settings for the rules and invite code, What's new, and these tours. Chat is the bubble at the top.",
  },
];
const GETTING_AROUND: TourStep[] = TABS.map((t, i) => ({
  id: `nav-${t.tab}`,
  progress: `Getting around · ${i + 1} of ${TABS.length}`,
  line: () => t.line,
  detail: () => t.detail,
  targets: [],
  look: [t.tab],
  cta: i < TABS.length - 1 ? "Next" : "Got it",
  done: (c) => c.pathname === "/draft" || draftDone(c.full),
}));

export const PLAYER_TOUR: TourStep[] = [
  {
    id: "welcome",
    progress: "Welcome",
    line: () => "Welcome to the tour! This is an Active Roster league.",
    detail: () =>
      "You'll play a two-episode season of a made-up baking show against two computer players. Watch for the highlighted parts of the screen: tap them to move on.",
    targets: [],
    cta: "Start the tour",
    done: (c) => c.pathname === "/draft" || draftDone(c.full),
  },
  ...GETTING_AROUND,
  {
    id: "rules",
    progress: "Episode 1 of 2",
    line: () => "Your bakers earn you points. Tap Draft to pick them.",
    detail: () => "Each week, a baker who wins the week scores you +3. A baker in the bottom two costs you 1.",
    targets: ["tab-draft"],
    done: (c) => c.pathname === "/draft" || draftDone(c.full),
  },
  {
    id: "draft",
    progress: "Episode 1 of 2",
    route: at("/draft"),
    line: () => "Pick 3 bakers. Tap one, then Draft.",
    detail: () => "Take turns with Ben and Kat until everyone has three. A picked baker is off the table.",
    targets: ["picker-tiles", "picker-confirm"],
    nav: { targets: ["tab-draft"] },
    done: (c) => draftDone(c.full),
  },
  {
    id: "lineup",
    progress: "Episode 1 of 2",
    route: at("/lineup"),
    line: () => "Only starters score. Start two, bench one.",
    detail: () => "Each week, choose who plays. Points scored on your bench don't count.",
    targets: ["lineup-starting", "lineup-bench"],
    nav: { targets: ["tab-lineup"] },
    done: (c) => myLineup(c.full, 1).length >= 2 || hasResults(c.full, 1),
  },
  {
    id: "reveal-1",
    progress: "Episode 1 of 2",
    route: at("/episodes"),
    line: () => "Episode 1 aired. Reveal it.",
    detail: () => "Results stay hidden until you reveal them, so nothing spoils an episode you haven't seen.",
    targets: ["episode-reveal", "reveal-confirm"],
    nav: { targets: ["tab-episodes"] },
    done: (c) => c.seen >= 1,
  },
  {
    id: "standings",
    progress: "Episode 1 of 2",
    line: (c) => `${winnerName(c.full, 1)} won the week. Tap Scoreboard.`,
    detail: (c) => winnerDetail(c.full),
    targets: ["tab-scoreboard"],
    done: (c) => c.pathname.startsWith("/scoreboard"),
  },
  {
    id: "chat",
    progress: "Episode 1 of 2",
    line: () => "Ben has something to say. Have a look.",
    detail: () => "Each league has its own chat, for trash talk between episodes.",
    look: ["scoreboard"],
    targets: ["header-chat"],
    done: (c) => c.pathname === "/chat",
  },
  {
    id: "pickup",
    progress: "Episode 2 of 2",
    route: at("/mid-season"),
    line: (c) => `Pick up ${pickupName(c.full) ?? "a free agent"}. Tap, then confirm.`,
    detail: () => "Fill the open spot with a baker nobody drafted. Pickups and swaps are optional: some leagues have them, some don't.",
    targets: ["picker-tiles", "picker-confirm"],
    nav: {
      line: () => "A baker went home. You can fill your open spot under More.",
      detail: () => "When one of your bakers goes home, you can pick up one nobody drafted, if your commissioner has turned pickups on.",
      targets: ["tab-more", "more-midseason"],
    },
    done: (c) => pickedUp(c.full),
  },
  {
    id: "reveal-2",
    progress: "Episode 2 of 2",
    route: at("/episodes"),
    line: () => "Episode 2 aired. Reveal it.",
    detail: () => "Your new baker went straight into your lineup. See how your team did.",
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
    nav: {
      line: (c) => `${winnerName(c.full, 2)} won the finale. See the final standings.`,
      detail: () => "That was the last episode. The scoreboard shows who won the league.",
      targets: ["tab-scoreboard"],
    },
    done: () => false,
    end: true,
  },
];

// The commissioner's path (docs/PLAN-guided-tour.md, "Commissioner path"): set the league up, start
// the draft, then the weekly job -- results come in from research, and you check and apply them.
// Research (who's scoring) closes it, since it's where everyone, commissioner or not, scouts.
export const COMMISSIONER_TOUR: TourStep[] = [
  {
    id: "create",
    progress: "Setup",
    route: at("/new-league"),
    line: () => "Your league, filled in for you. Create it.",
    detail: () => "Commissioners pick the show, the game and the rules. It's filled in here; nothing is saved.",
    targets: ["create-league"],
    done: (c) => c.tour.created,
  },
  {
    id: "invite",
    progress: "Setup",
    route: at("/new-league"),
    line: () => "Friends join with this code. Copy it.",
    detail: () => "Send it in a text or a group chat. Friends enter it in the app to join.",
    targets: ["invite-copy"],
    done: (c) => c.tour.copied,
  },
  {
    id: "to-draft",
    progress: "Setup",
    route: at("/new-league"),
    line: () => "Ben and Kat are computer players. Go to the draft.",
    detail: () => "In a real league your friends would be here. Ben and Kat are standing in.",
    targets: ["invite-enter"],
    done: (c) => c.pathname === "/draft",
  },
  {
    id: "start-draft",
    progress: "Draft",
    route: at("/draft"),
    line: () => "Everyone's in. Start the draft.",
    detail: () => "Only the commissioner can start it. Then everyone picks in turn, in this order.",
    targets: ["draft-start", "confirm-accept"],
    nav: { targets: ["tab-draft"] },
    done: (c) => StateLogic.isDraftStarted(c.full),
  },
  {
    id: "draft",
    progress: "Draft",
    route: at("/draft"),
    line: () => "You play too. Pick 3: tap one, then Draft.",
    detail: () => "Commissioners get a team like everyone else. Ben and Kat pick right after you.",
    targets: ["picker-tiles", "picker-confirm"],
    nav: { targets: ["tab-draft"] },
    done: (c) => draftDone(c.full),
  },
  {
    id: "results",
    progress: "Episode 1",
    route: at("/episodes/1/research"),
    line: () => "Research found these. Check them, then apply.",
    detail: () => "The app looked up what happened. Check it; nothing scores until you apply.",
    targets: ["results-apply"],
    look: ["results-list"],
    nav: {
      line: () => "Episode 1 aired, and its results are in.",
      detail: () => "Your weekly job: check what research found, then apply it to update everyone's points.",
      targets: ["tab-episodes", "results-check"],
    },
    done: (c) => hasResults(c.full, 1),
  },
  {
    id: "research",
    progress: "Episode 1",
    line: () => "Applied. Research ranks every baker by points. Tap it.",
    detail: () => "Scores just updated for everyone. Research helps players plan lineups and pickups.",
    targets: ["tab-research"],
    done: (c) => c.pathname === "/research",
  },
  {
    id: "end",
    progress: "Done",
    route: at("/research"),
    line: () => "That's the commissioner's week.",
    targets: [],
    nav: { targets: ["tab-research"] },
    done: () => false,
    end: true,
  },
];

export function tourSteps(kind: "player" | "commissioner"): TourStep[] {
  return kind === "commissioner" ? COMMISSIONER_TOUR : PLAYER_TOUR;
}
