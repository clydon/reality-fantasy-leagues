// The couch's season games on Survivor 51, from the mock (show.js TEAMS, LINEUP_PTS, POOL, rulesSheet): each
// person's Outlast team, Weekly Lineup points, Survival Pool streak, and each game's rules in plain words. Tonight's
// game cards and the Games tab read them; step 1 reads the leagues through the selectors.
import type { GameName } from "../games";
import { CAST, castaway } from "./cast";
import type { Demo } from "./people";

export const STEP = "1";

/** The standings are as of this episode: they move when you reveal. */
export const THROUGH = 4;

export const TEAMS: Record<Demo, string[]> = {
  alex: ["Kristin", "Mike", "Jenna", "Eric"],
  riley: ["Carter", "Danny", "Thien", "Alexis"],
  jordan: ["Lewis", "Rob", "Brady", "Linnea"],
  sam: ["Maggie", "Sharonda", "Patt", "Jelly"],
};

export const LINEUP: Record<Demo, { total: number; week: number; last: string[] }> = {
  alex: { total: 20, week: 6, last: ["Kristin", "Mike", "Jenna"] },
  riley: { total: 38, week: 15, last: ["Carter", "Danny", "Thien"] },
  jordan: { total: 18, week: 6, last: ["Lewis", "Brady", "Linnea"] },
  sam: { total: 16, week: 4, last: ["Maggie", "Sharonda", "Jelly"] },
};

export const POOL: Record<Demo, { streak: number; picks: string[] }> = {
  alex: { streak: 3, picks: ["Kristin", "Maggie", "Brady"] },
  riley: { streak: 4, picks: ["Carter", "Eric", "Kristin", "Sharonda"] },
  jordan: { streak: 2, picks: ["Lewis", "Danny"] },
  sam: { streak: 1, picks: ["Patt", "Mike", "Thien"] },
};

/** Each game in plain words (the mock's rulesSheet); How it works (step 1) says it for the show as a whole. */
export const RULES: Record<GameName, string[]> = {
  Outlast: [
    "Snake-draft a team of four before the season.",
    "Each castaway earns 1 point, plus 1 for every boot they outlast.",
    "So they end on their place in the boot order: the last one standing carries you.",
    "No lineups to set. Just watch.",
  ],
  "Weekly Lineup": [
    "Draft a roster of five.",
    "Before each episode, start three. Only starters score.",
    "Points come from what happens: immunity, votes, idols, finals.",
    "Lose someone? Pick who comes in on waivers.",
  ],
  "Survival Pool": [
    "No draft. Each episode, pick one person you think survives.",
    "Right: your streak grows. Wrong: it resets.",
    "You can't pick the same person twice until everyone still in has been used.",
    "Longest streak wins; ties go to most correct.",
  ],
};

/** Outlast: a point, plus one for every boot they've outlasted. */
export function outlastPoints(first: string) {
  const c = castaway(first);
  const gone = CAST.filter((x) => x.out && x.out <= THROUGH);
  return 1 + (c.out ? gone.filter((x) => x.out! < c.out!).length : gone.length);
}

export interface StandingRow {
  who: Demo;
  total: number;
  /** Their place, the same for a tie. */
  place: number;
  tie: boolean;
  /** Weekly Lineup: last episode's points. */
  week?: number;
}

/** A game's table, best first. */
export function standing(game: GameName): StandingRow[] {
  const people = Object.keys(TEAMS) as Demo[];
  const rows = people
    .map((who) => ({
      who,
      total: game === "Weekly Lineup" ? LINEUP[who].total : game === "Survival Pool" ? POOL[who].streak : TEAMS[who].reduce((a, n) => a + outlastPoints(n), 0),
      week: game === "Weekly Lineup" ? LINEUP[who].week : undefined,
    }))
    .sort((a, b) => b.total - a.total);
  return rows.map((r) => {
    const place = rows.findIndex((x) => x.total === r.total) + 1;
    return { ...r, place, tie: rows.filter((x) => x.total === r.total).length > 1 };
  });
}

/** The line under a game's place on Tonight's card. */
export function yourLine(game: GameName, who: Demo = "alex") {
  if (game === "Weekly Lineup") return `${LINEUP[who].total} pts`;
  if (game === "Survival Pool") return `streak ${POOL[who].streak}`;
  return `${TEAMS[who].filter((n) => !castaway(n).out).length} of ${TEAMS[who].length} still in`;
}
