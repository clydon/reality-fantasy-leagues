import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import type { ShowTerms } from "@/lib/use-show-terms";
import type { TourCtx, TourStep } from "./steps";
import {
  PRACTICE_BET,
  PRACTICE_EPISODES,
  PRACTICE_ME,
  benchMiss,
  firstNameOf,
  myPick,
  myStanding,
  practiceBetFor,
  practiceHasResults as hasResults,
  wentHome,
  type PracticeType,
} from "./practice";

// The practice round's steps (docs/PLAN-practice-round.md), one script per game type. The same rules as
// the guided tour's (steps.ts): one host line per step, a step ends on what the tap did to the league
// or where it took you, Next only where there's nothing to tap. Every line is in this league's words:
// its show's term for a castaway, its own roster sizes and bet values.

export interface PracticeInfo {
  league: string;
  type: PracticeType;
  terms: ShowTerms;
  /** The computer players' names. */
  bots: string[];
  shared: boolean;
  size: number;
  activeSlots: number;
  benchSlots: number;
  /** Classic with side bets on: one practice bet before Episode 1 airs. */
  bets: boolean;
}

const at = (path: string) => (p: string) => p === path;
const draftDone = (s: LeagueState) => !!StateLogic.currentDraftTurn(s)?.isComplete;
const locked = (s: LeagueState, n: number) => !!s.episodes.find((e) => e.number === n)?.lineupsLocked;
const pts = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;
const list = (names: string[]) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

function standingLine(s: LeagueState): string {
  const { total, place, tied } = myStanding(s);
  return `You're ${tied ? "tied " : ""}${ordinal(place)} with ${pts(total)} ${total === 1 ? "point" : "points"}.`;
}

export function practiceSteps(info: PracticeInfo): TourStep[] {
  const { league, type, terms: t, bots, size } = info;
  const two = PRACTICE_EPISODES[type] > 1;
  const progress = (n: number) => (two ? `Episode ${n} of 2` : `Episode ${n}`);
  const them = bots.length === 1 ? "a computer player" : `${bots.length === 2 ? "two" : bots.length} computer players`;
  const team = (n: number) => `${n} ${n === 1 ? t.castaway : t.castaways}`;

  const welcome: TourStep = {
    id: "welcome",
    progress: "Welcome",
    line: () => `Practice round of ${league}.`,
    detail: () =>
      `Real cast and rules, made-up results. Nothing here counts. You'll play ${two ? "two episodes" : "one episode"} against ${list(bots)}, ${them}.`,
    targets: [],
    cta: "Start",
    done: () => false,
  };

  const draft: TourStep = {
    id: "draft",
    progress: "Draft",
    route: at("/draft"),
    line: () => (info.shared ? `Pick ${team(size)}, then lock in.` : `Pick ${team(size)}. Tap one, then Draft.`),
    detail: () =>
      info.shared
        ? `Everyone picks in private, then all the teams show at once. The same ${t.castaway} can be on more than one team.`
        : `You take turns with ${list(bots)}. Once a ${t.castaway} is picked, nobody else can have them.`,
    targets: ["picker-tiles", "picker-confirm"],
    nav: { line: () => "First, your team. Tap Draft.", targets: ["tab-draft"] },
    done: (c) => draftDone(c.full),
  };

  const airing = (n: number, detail: string): TourStep => ({
    id: `air-${n}`,
    progress: progress(n),
    line: () => `Episode ${n} is airing. In a real week you'd be watching now.`,
    detail: () => detail,
    targets: [],
    onAir: true,
    done: (c) => hasResults(c.full, n),
  });

  const reveal = (n: number): TourStep => ({
    id: `reveal-${n}`,
    progress: progress(n),
    route: at("/episodes"),
    line: () => `Results are in. Reveal Episode ${n}.`,
    detail: () =>
      n === 1
        ? "Results wait until you reveal them, so an episode you haven't watched is never spoiled."
        : "Same as every week: reveal when you've watched.",
    targets: ["episode-reveal", "reveal-confirm"],
    nav: { targets: ["tab-episodes"] },
    done: (c) => c.seen >= n,
  });

  const end = (where: string, tab: string, note: string): TourStep => ({
    id: "end",
    progress: "Practice over",
    route: at(where),
    line: () => `That's how ${league} plays.`,
    note,
    targets: [],
    nav: { targets: [tab] },
    done: () => false,
    end: true,
  });

  if (type === "active-roster") {
    const { activeSlots: a, benchSlots: b } = info;
    return [
      welcome,
      draft,
      {
        id: "lineup",
        progress: progress(1),
        route: at("/lineup"),
        line: () => (b > 0 ? `Only starters score. Start ${a}, bench ${b}.` : `Start ${a}. Only starters score.`),
        detail: () => "Choose who plays each episode. Points scored on your bench don't count.",
        targets: ["lineup-starting", "lineup-bench"],
        nav: { line: () => "Teams are in. Now set your lineup: tap Lineup.", targets: ["tab-lineup"] },
        done: (c) => locked(c.full, 1) || hasResults(c.full, 1),
      },
      airing(1, "Lineups are locked until it's over. Results are on their way."),
      reveal(1),
      {
        id: "standings",
        progress: progress(1),
        line: (c) => `${standingLine(c.full)} Tap Scoreboard.`,
        detail: (c) => {
          const miss = benchMiss(c.full, 1);
          return miss ? `${miss.name} scored +${pts(miss.points)} on your bench, so it didn't count.` : "Only your starters' points counted.";
        },
        targets: ["tab-scoreboard"],
        done: (c) => c.pathname.startsWith("/scoreboard"),
      },
      {
        id: "next",
        progress: "Episode 2",
        line: () => "Points are in. Now set your next lineup.",
        detail: () => "Your lineup carries over each week. Change it before the episode airs.",
        look: ["scoreboard"],
        targets: ["tab-lineup"],
        done: (c) => c.pathname === "/lineup",
      },
      end("/lineup", "tab-lineup", "Every week: set your lineup, watch, reveal."),
    ];
  }

  if (type === "classic-draft") {
    const bet: TourStep[] = info.bets
      ? [
          {
            id: "bet",
            progress: progress(1),
            route: at("/"),
            line: () => `Side bet: ${PRACTICE_BET} Type a name.`,
            detail: (c) => {
              const p = practiceBetFor(c.full)?.points ?? 1;
              return `Extra points on top of your team. A right guess earns +${pts(p)}; a wrong one costs nothing.`;
            },
            targets: ["bet-guess"],
            nav: { line: () => "One more thing before it airs: a side bet. Tap Overview.", targets: ["tab-overview"] },
            done: (c) => !!practiceBetFor(c.full)?.guessed || hasResults(c.full, 1),
          },
        ]
      : [];
    return [
      welcome,
      draft,
      ...bet,
      airing(1, `Each time someone goes home, every ${t.castaway} still in earns a point. Last one standing earns the most.`),
      reveal(1),
      {
        id: "standings",
        progress: progress(1),
        line: (c) => `${firstNameOf(c.full, wentHome(c.full, 1))} went home. Tap Scoreboard.`,
        detail: (c) => classicDetail(c, info),
        targets: ["tab-scoreboard"],
        done: (c) => c.pathname.startsWith("/scoreboard"),
      },
      end("/scoreboard", "tab-scoreboard", "Every week: watch, reveal, see where you stand."),
    ];
  }

  // Eliminator Pool: two episodes, so the second pick meets the no-repeats rule.
  const pickStep = (n: number): TourStep => ({
    id: `pick-${n}`,
    progress: progress(n),
    route: at("/pick"),
    line: (c) => (n === 1 ? `Who survives Episode 1? Tap one, then Lock in.` : `Pick again, but not ${firstNameOf(c.full, myPick(c.full, 1)?.id)}.`),
    detail: () =>
      n === 1
        ? `Pick one ${t.castaway} you think stays in the game. If they do, your streak goes up by one.`
        : `No repeats until you've picked every ${t.castaway} still in, and never the same one twice in a row.`,
    targets: ["picker-tiles", "picker-confirm"],
    nav:
      n === 1
        ? { line: () => "Make your first pick. Tap Pick.", targets: ["tab-pick"] }
        : {
            line: (c) => `${firstNameOf(c.full, myPick(c.full, 1)?.id)} stayed: your streak is 1. Tap Pick.`,
            detail: () => "Now Episode 2.",
            targets: ["tab-pick"],
          },
    done: (c) => !!myPick(c.full, n) || hasResults(c.full, n),
  });
  return [
    welcome,
    pickStep(1),
    airing(1, "Picks are locked until it's over. If yours stays, your streak grows."),
    reveal(1),
    pickStep(2),
    airing(2, "One more episode. Your streak is on the line."),
    reveal(2),
    {
      id: "standings",
      progress: progress(2),
      line: (c) => {
        const p = myPick(c.full, 2);
        const name = firstNameOf(c.full, p?.id);
        return p?.stayed ? `${name} stayed too: streak 2. Tap Scoreboard.` : `${name} went home: streak back to 0. Tap Scoreboard.`;
      },
      detail: (c) =>
        myPick(c.full, 2)?.stayed
          ? "Players are ranked by their longest streak, then by total right picks."
          : "Your best streak, 1, still counts. Players are ranked by their longest streak, then by total right picks.",
      targets: ["tab-scoreboard"],
      done: (c) => c.pathname.startsWith("/scoreboard"),
    },
    end("/scoreboard", "tab-scoreboard", "Every week: make your pick, watch, reveal."),
  ];
}

// What Episode 1 meant for your Classic team, and for your side bet.
function classicDetail(c: TourCtx, info: PracticeInfo): string {
  const s = c.full;
  const out = wentHome(s, 1);
  const mine = s.castaways.filter((x) => x.ownerIds.includes(PRACTICE_ME));
  const lost = mine.some((x) => x.id === out);
  const team = lost
    ? `${firstNameOf(s, out)} was on your team and stops scoring. Your others each earned a point.`
    : `All ${mine.length} of your ${info.terms.castaways} are still in, and each earned a point.`;
  const ep = s.episodes.find((e) => e.number === 1);
  const guess = ep?.bets?.flatMap((b) => b.predictions).find((p) => p.playerId === PRACTICE_ME);
  if (!guess) return team;
  return `${team} ${guess.correct ? "Your side bet paid out." : "Your side bet missed, which costs nothing."}`;
}
