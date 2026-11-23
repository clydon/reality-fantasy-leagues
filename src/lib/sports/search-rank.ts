// How Add's search ranks what it finds of sports (docs/PLAN-sports-couch.md B3; docs/design-round/search-spec.md, "The taxonomy" and
// "Typing"; its first-view R4: the first result is what most people typing those words mean). Pure, for the tests: the search's
// teams, matchup and leagues in, the one card (or none) and the rows under it out.
//   - A matchup is always the card.
//   - One team is the card when it clearly leads: among the teams at the top score, the one the couch follows, else the one pro
//     team in season (its next game within IN_SEASON days, or on now), else the one pro team.
//   - Else a league named exactly (a team sport's) is the card.
// The rest: teams the couch follows first, then in season, then pro before college (the search's own order kept within each);
// college teams sharing the words fold ("More teams named Eagles"). A tour's or a promotion's league (golf's, F1's, the UFC's: not a
// slate) is a tour, said apart: nothing in the app opens one yet.

/** A team as the search finds it (find.ts FoundTeams' teams), only what ranking reads. */
export interface RankTeam {
  league: string;
  id: string;
  short: string;
  college: boolean;
  score: number;
  next: { at: string | null; state: "pre" | "in" | "post" } | null;
}
export interface RankLeague {
  league: string;
  score: number;
  slate: boolean;
}
export interface Found<T extends RankTeam, M, L extends RankLeague> {
  teams: T[];
  matchup: M | null;
  leagues: L[];
}

export type SearchCard<T, M, L> = { kind: "team"; team: T } | { kind: "matchup"; matchup: M } | { kind: "league"; league: L } | null;

export interface Ranked<T, M, L> {
  card: SearchCard<T, M, L>;
  /** Teams as rows, the card's team left out. */
  teams: T[];
  /** College teams folded under "More teams named …" (none when there's nothing else to show). */
  folded: T[];
  /** Team sports' leagues as rows (the card's left out). */
  leagues: L[];
  /** Tours and promotions (golf's, F1's, the UFC's): listed, nothing to open yet. */
  tours: L[];
  /** No card, no team, but leagues or tours the words name ("golf", "formula 1"): the sports rows lead the TV listings. */
  lead: boolean;
}

/** A team's next game this close (or on now) is in its season. */
export const IN_SEASON = 21 * 86_400_000;
/** Teams shown before the fold. */
const SHOWN = 5;

export const inSeason = (t: RankTeam, now: number) => !!t.next && (t.next.state === "in" || (!!t.next.at && Date.parse(t.next.at) - now <= IN_SEASON));

export function rankSports<T extends RankTeam, M, L extends RankLeague>(found: Found<T, M, L> | null | undefined, couch: Set<string>, now: number): Ranked<T, M, L> {
  const none: Ranked<T, M, L> = { card: null, teams: [], folded: [], leagues: [], tours: [], lead: false };
  if (!found) return none;
  const key = (t: RankTeam) => `${t.league}/${t.id}`;
  const leagues = found.leagues.filter((l) => l.slate);
  const tours = found.leagues.filter((l) => !l.slate);
  let card: SearchCard<T, M, L> = null;
  if (found.matchup) card = { kind: "matchup", matchup: found.matchup };
  else {
    const top = Math.max(-1, ...found.teams.map((t) => t.score));
    const best = found.teams.filter((t) => t.score === top && top >= 96);
    const theirs = best.filter((t) => couch.has(key(t)));
    const pro = best.filter((t) => !t.college);
    const live = pro.filter((t) => inSeason(t, now));
    const one = theirs.length === 1 ? theirs[0] : theirs.length === 0 && live.length === 1 ? live[0] : theirs.length === 0 && live.length === 0 && pro.length === 1 ? pro[0] : null;
    if (one) card = { kind: "team", team: one };
    else {
      const named = leagues.find((l) => l.score >= 100);
      if (named) card = { kind: "league", league: named };
    }
  }
  const rest = found.teams.filter((t) => !(card?.kind === "team" && key(card.team) === key(t)));
  const rank = (t: RankTeam) => (couch.has(key(t)) ? 0 : inSeason(t, now) ? 1 : !t.college ? 2 : 3);
  const sorted = rest.map((t, i) => ({ t, i })).sort((a, b) => rank(a.t) - rank(b.t) || a.i - b.i).map((x) => x.t);
  // College teams beyond the first few fold; pro teams never do.
  const shown: T[] = [];
  const folded: T[] = [];
  for (const t of sorted) (t.college && shown.length >= (card ? 2 : SHOWN) && !couch.has(key(t)) ? folded : shown).push(t);
  // One alone isn't worth a fold.
  if (folded.length === 1) shown.push(folded.pop()!);
  return {
    card,
    teams: shown,
    folded,
    leagues: leagues.filter((l) => !(card?.kind === "league" && card.league.league === l.league)),
    tours,
    lead: !card && !found.teams.length && (leagues.length > 0 || tours.length > 0),
  };
}
