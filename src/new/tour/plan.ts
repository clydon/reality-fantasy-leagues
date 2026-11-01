import type { CatalogSeason, Home, SeasonReveal } from "../data";
import type { AddDemo } from "../watching/sheets";

// What the first-time tour's practice runs use (docs/PLAN-first-time-tour.md version 2), worked out from your own Home.

/** After your own practice add, the one the tour adds by itself (the user, 2026-11-01: "you don't have to add a show just for the
 *  games"): Saturday Night Live, on this week (in the NFL's weekly game's place: sports aren't set up yet; Harry Potter went with the
 *  critique's trim, one show only). Not when you have it already. Found by its TV listing. */
const DEMO: AddDemo[] = [{ query: "Saturday Night Live", tvmazeId: 361 }];

export function demoOf(home: Home): AddDemo[] {
  const have = new Set(home.shows.map((s) => s.show.tvmazeId).filter((id): id is number => id != null));
  return DEMO.filter((d) => !have.has(d.tvmazeId));
}

/** The shows the practice adds, in order (the user, 2026-11-01): the first you don't have whose season is a game already (its rules
 *  are in: nothing waits on the bot). */
const PRACTICE_SHOWS = [/^survivor$/i, /^(the )?amazing race\b/i, /^the challenge$/i];

/** The show as people say it: "The Amazing Race (American edition)" is "The Amazing Race". */
const spoken = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, "").trim() || name;

export interface PracticeShow {
  seasonId: string;
  /** What's typed into the search: "The Amazing Race". */
  name: string;
  /** "The Amazing Race 38". */
  label: string;
  artUrl: string | null;
  /** Its TV listing: once it's practice-added, it's on Home's guide for a moment with the demo's (tour.tsx). */
  tvmazeId: number | null;
}

/** The practice's show: of Survivor, The Amazing Race and The Challenge, the first with no season on your list whose season on now
 *  (else coming up) is set up as a game. None of them: null (the practice adds whatever you search for). */
export function practiceShowOf(catalog: CatalogSeason[], home: Home): PracticeShow | null {
  const mine = new Set(home.shows.filter((s) => s.following || s.games.length).map((s) => s.seasonId));
  for (const re of PRACTICE_SHOWS) {
    const seasons = catalog.filter((s) => re.test(spoken(s.show)));
    if (seasons.some((s) => mine.has(s.seasonId))) continue;
    const best = seasons
      .filter((s) => s.ready && s.status !== "completed")
      .sort((a, b) => Number(b.status === "airing") - Number(a.status === "airing") || (b.premiere ?? "").localeCompare(a.premiere ?? ""))[0];
    // Said as people say it: "The Amazing Race 39", not "The Amazing Race (American edition) 39".
    if (best) return { seasonId: best.seasonId, name: spoken(best.show), label: best.label.replace(/\s*\([^)]*\)/g, "").trim(), artUrl: best.artUrl, tvmazeId: best.tvmazeId ?? null };
  }
  return null;
}

/** The reveal to play again: the last episode you revealed on a show you play (one on now first, then the latest to air). */
export interface ReplayOf {
  seasonId: string;
  n: number;
  name: string;
  season: number | null;
}

export function replayOf(home: Home): ReplayOf | null {
  const played = home.shows
    .map((s) => ({ s, n: s.seenThrough ?? s.latestAired }))
    .filter(({ s, n }) => s.games.length > 0 && n >= 1)
    .sort((a, b) => Number(b.s.status === "airing") - Number(a.s.status === "airing") || b.s.latestAired - a.s.latestAired);
  const top = played[0];
  return top ? { seasonId: top.s.seasonId, n: top.n, name: top.s.show.name, season: top.s.seasonNumber } : null;
}

/** The made-up reveal, for someone with nothing to play again: Golden Crust, the tour's made-up baking show (its bakers drawn for
 *  the tour, public/tour/), Episode 5. Every name in it is made up; your row says You. */
export const MADE_UP_SHOW = { name: "Golden Crust", season: 3 };

export const MADE_UP_REVEAL: SeasonReveal = {
  episode: 5,
  stage: "final",
  finalAt: null,
  again: true,
  out: [{ id: "tour-gus", name: "Gus", photo: "/tour/gus.jpg", method: "Sent home", place: null, knocked: false }],
  happened: [
    { label: "Star Baker", winners: [{ name: "Clive", colour: null }] },
    { label: "Technical", winners: [{ name: "Jo", colour: null }] },
  ],
  lineup: null,
  games: [{ leagueId: "tour-pool", gameName: "Survival Pool", gameType: "eliminator-pool", title: "Your pick survived", line: "Hana made it through", streak: { from: 4, to: 5 } }],
  predictions: [],
  table: {
    leagueId: "tour-pool",
    gameName: "Survival Pool",
    rows: [
      { playerId: "tour-jordan", userId: null, name: "jordan", you: false, before: { place: 1, rank: "1", total: 5 }, after: { place: 1, rank: "1", total: 6 } },
      { playerId: "tour-riley", userId: null, name: "riley", you: false, before: { place: 2, rank: "2", total: 5 }, after: { place: 3, rank: "3", total: 5 } },
      { playerId: "tour-you", userId: null, name: "You", you: true, before: { place: 3, rank: "3", total: 4 }, after: { place: 2, rank: "2", total: 5 } },
    ],
  },
  next: null,
  soFar: null,
};
