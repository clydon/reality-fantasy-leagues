// A league's playoffs as a bracket (docs/PLAN-start-a-game-gpt.md track L, L8 part 1's engine items, part 2; L4 part 2's Noticed):
// a playoffs slate's games (src/lib/server/sports/slate.ts), grouped into their series, each series a bout of one draw,
// "playoffs", with its round's distance from the final, so a bracket question (`settle: { by: 'final', take: 'bracket', of:
// 'playoffs' }`) is graded on them as a tennis draw's is (src/lib/game/sequence/bracket.js bracketOf).
//
// The round is ESPN's note on each game, as its scoreboards list them (2026, read 2026-11-06): the NBA's "East 1st Round - Game 3",
// "West Semifinals", "East Finals", "NBA Finals"; the NHL's "East 1st Round", "West 2nd Round", "East Final", "Stanley Cup
// Final"; MLB's "ALWC", "NLDS", "ALCS", "World Series" ("ALCS - Game 2 Rain - Makeup on Oct 18" too); the NFL's "AFC Wild Card
// Playoffs", "NFC Divisional Playoffs", "AFC Championship", "Super Bowl LX"; the WNBA's "First Round", "WNBA Semifinals", "WNBA
// Finals". The words say a round's distance from the final where they name it (the final 1, a conference's final 2, a
// conference's semifinals 3, a division series 3, a wild card 4); a numbered round ("1st Round", "2nd Round") is counted back
// from the named rounds after it, or from how many series the first round has (8 is a bracket of 16: four rounds), whichever
// is more, as tennis's rounds are before its later ones are listed (tennis.ts). A note that names no round (the Pro Bowl, the
// play-in) isn't the bracket's. A series is its two teams in one round (a bracket meets them once); its winner the side that
// took it, a majority of its games at most (ESPN's series.totalCompetitions: best of 7, four wins), a game of no series (the
// NFL's) one game's winner. A postseason that isn't one bracket (college's: the NCAA's tournament beside the NIT's and the bowls,
// each with a final of its own) is no draw: two finals, a team in two series of a round, or a round with more series than it
// holds, and the playoffs have no bouts. Pure: the server reads it (sports/score.ts leagueGames), and the tests.
import Bracket from "@/lib/game/sequence/bracket.js";
import type { SportsGameFacts } from "@/lib/game/game-spec";

/** The draw a league's playoffs are, as a bracket question names it (`of`: sequence/bracket.js's). */
export const PLAYOFFS: "playoffs" = Bracket.PLAYOFFS;

/** A playoff game's round, from its note: its half of the bracket ("East", "AL", "AFC"; null for the final and a league with no
 *  halves), and its distance from the final (`fromFinal`) where the words name it, else its number (`nth`: "2nd Round"). */
export interface PlayoffRound {
  half: string | null;
  fromFinal: number | null;
  nth: number | null;
}

const HALVES: Record<string, string> = { east: "East", eastern: "East", west: "West", western: "West", afc: "AFC", nfc: "NFC", al: "AL", nl: "NL" };
const NTH: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, one: 1, two: 2, three: 3, four: 4 };

/** A game's round from the provider's note, or null for a note that names none. */
export function roundOf(note: string | null | undefined): PlayoffRound | null {
  if (typeof note !== "string" || !note.trim()) return null;
  // "East 1st Round - Game 3", "ALCS - Game 2 Rain - Makeup on Oct 18": the round is before the first dash.
  const head = note.split(/\s+[-–]\s+/)[0].trim();
  let half: string | null = null;
  let rest = head;
  const glued = /^(AL|NL)(WC|DS|CS)$/.exec(head);
  const lead = /^(East(?:ern)?|West(?:ern)?|AFC|NFC)\s+(.+)$/i.exec(head);
  if (glued) [half, rest] = [glued[1], glued[2]];
  else if (lead) [half, rest] = [HALVES[lead[1].toLowerCase()], lead[2]];
  const r = rest.toLowerCase();
  const named = (fromFinal: number): PlayoffRound => ({ half, fromFinal, nth: null });
  // A conference's round with no half named ("Conference Semifinals") is a half's all the same.
  const inHalf = !!half || /\bconference\b/.test(r);
  if (/semi/.test(r)) return named(inHalf ? 3 : 2);
  if (r === "wc" || /\bwild ?card\b/.test(r)) return named(4);
  if (r === "ds" || /\bdivisional\b/.test(r)) return named(3);
  if (r === "cs" || /\b(championship|finals?)\b/.test(r)) return named(inHalf ? 2 : 1);
  if (/\b(world series|super bowl)\b/.test(r)) return named(1);
  const nth = /\b(\d+)(?:st|nd|rd|th)\s+round\b/.exec(r)?.[1] ?? /\b(first|second|third|fourth)\s+round\b/.exec(r)?.[1] ?? /\bround\s+(one|two|three|four|\d+)\b/.exec(r)?.[1];
  const n = nth === undefined ? NaN : Number.isFinite(Number(nth)) ? Number(nth) : NTH[nth];
  return Number.isInteger(n) && n >= 1 ? { half, fromFinal: null, nth: n } : null;
}

/** A playoffs slate's game as the series read it: its note and series length as linked, and its facts as of the mark. */
export interface PlayoffGame {
  id: string;
  note: string | null;
  bestOf: number | null;
  at: string | null;
  status: SportsGameFacts["status"];
  sides: SportsGameFacts["sides"];
  /** The episode it's linked to (a walk's week: the playoffs' final won in it, `wonAt`). */
  episode?: number;
}

/** A series: its two teams in a round, each one's wins so far, how many games it is at most, its games, and who took it. */
export interface PlayoffSeries {
  id: string;
  half: string | null;
  fromFinal: number;
  sides: [string, string];
  wins: Record<string, number>;
  bestOf: number;
  games: string[];
  winner: string | null;
  /** The episode of the game that won it, when the games say. */
  wonAt: number | null;
  status: "pre" | "in" | "final";
}

/** A final game's winner: the side with more (a shootout's goals breaking a level score), or null. */
export function gameWinner(g: Pick<PlayoffGame, "status" | "sides">): string | null {
  if (g.status !== "final" || g.sides.length !== 2) return null;
  const [a, b] = g.sides.map((s) => s.score * 1000 + (s.shootout ?? 0));
  return a === b ? null : a > b ? g.sides[0].id : g.sides[1].id;
}

/**
 * A playoffs slate's series, in the order their first games start: each game whose note names a round and whose two sides are
 * known, grouped by its round and its two teams. A numbered round's distance from the final is counted back from the named rounds
 * listed after it, or from how many series its first round has, whichever is more. A series' length is its games' (ESPN's), else
 * another series' of its round; a series of several games (its notes say "Game 2") whose length nobody listed has no winner yet
 * (never one game's win taken for it), and a round's games of no series (the NFL's) are one game each.
 */
export function seriesOf(games: PlayoffGame[]): PlayoffSeries[] {
  const groups = new Map<string, { round: PlayoffRound; pair: [string, string]; games: PlayoffGame[] }>();
  for (const g of [...games].sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""))) {
    const round = roundOf(g.note);
    const ids = g.sides.map((s) => s.id).filter(Boolean);
    if (!round || ids.length !== 2 || ids[0] === ids[1]) continue;
    const pair = [...ids].sort() as [string, string];
    const key = `${round.half ?? ""}|${round.fromFinal ?? `n${round.nth}`}|${pair.join("|")}`;
    const had = groups.get(key) ?? groups.set(key, { round, pair: ids as [string, string], games: [] }).get(key)!;
    had.games.push(g);
  }
  // A numbered round's distance: the named rounds' most, plus the numbered rounds up to it; or a first round of m series is
  // ceil(log2 m) + 1 from the final.
  const all = [...groups.values()];
  const named = Math.max(0, ...all.map((s) => s.round.fromFinal ?? 0));
  const lastNth = Math.max(0, ...all.map((s) => s.round.nth ?? 0));
  const firsts = all.filter((s) => s.round.nth === 1).length;
  const first = Math.max(named ? named + lastNth : 0, firsts ? Math.ceil(Math.log2(firsts)) + 1 : 0);
  const lengthOf = (gs: PlayoffGame[]) => Math.max(0, ...gs.map((g) => (Number.isInteger(g.bestOf) && (g.bestOf as number) > 0 ? (g.bestOf as number) : 0)));
  const distance = (s: (typeof all)[number]) => s.round.fromFinal ?? first - (s.round.nth as number) + 1;
  const roundLength = new Map<number, number>();
  for (const s of all) roundLength.set(distance(s), Math.max(roundLength.get(distance(s)) ?? 0, lengthOf(s.games)));
  const out: PlayoffSeries[] = [];
  for (const s of all) {
    const fromFinal = distance(s);
    if (!Number.isInteger(fromFinal) || fromFinal < 1) continue;
    const listed = lengthOf(s.games) || roundLength.get(fromFinal) || 0;
    const several = s.games.some((g) => /\bGame\s+([2-9]|\d{2,})\b/.test(g.note ?? "")) || s.games.length > 1;
    const bestOf = listed || (several ? null : 1);
    const wins: Record<string, number> = { [s.pair[0]]: 0, [s.pair[1]]: 0 };
    let winner: string | null = null;
    let wonAt: number | null = null;
    const need = bestOf ? Math.floor(bestOf / 2) + 1 : Infinity;
    for (const g of s.games) {
      const w = gameWinner(g);
      if (!w || !(w in wins) || winner) continue;
      wins[w]++;
      if (wins[w] >= need) [winner, wonAt] = [w, g.episode ?? null];
    }
    const status = winner ? "final" : s.games.some((g) => g.status === "in" || g.status === "final") ? "in" : "pre";
    out.push({ id: `${s.round.half ?? "final"}/${fromFinal}/${[...s.pair].sort().join("-")}`, half: s.round.half, fromFinal, sides: s.pair, wins, bestOf: bestOf ?? 0, games: s.games.map((g) => g.id), winner, wonAt, status });
  }
  return out;
}

/** Whether the series are one bracket: each round no more series than it holds (the final one, the semifinals two), and each
 *  team in one series a round at most. */
export function isBracket(series: PlayoffSeries[]): boolean {
  const rounds = new Map<number, Set<string>>();
  for (const s of series) {
    const seen = rounds.get(s.fromFinal) ?? rounds.set(s.fromFinal, new Set()).get(s.fromFinal)!;
    if (s.sides.some((id) => seen.has(id))) return false;
    for (const id of s.sides) seen.add(id);
    if (seen.size > 2 ** s.fromFinal) return false;
  }
  return true;
}

/**
 * The playoffs as a card's facts (a bracket's draw: SportsGameFacts.bouts, each series a bout of the draw "playoffs" with its
 * distance from the final), as of the games' facts: final once the final's series is won (`wonAt` its episode, where the games
 * say), being played once any of the bracket's games has started, else still to play. Only the bracket's games count: one whose
 * note names no round (the play-in), or whose sides aren't set, is none of it.
 */
export function playoffsFacts(games: PlayoffGame[]): SportsGameFacts {
  const all = seriesOf(games);
  const series = isBracket(all) ? all : [];
  const bouts: NonNullable<SportsGameFacts["bouts"]> = {};
  for (const s of series) bouts[s.id] = { sides: [...s.sides], winner: s.winner, outcome: s.winner ? "win" : null, main: true, class: PLAYOFFS, fromFinal: s.fromFinal };
  const inIt = new Set(series.flatMap((s) => s.games));
  const played = games.filter((g) => inIt.has(g.id));
  const won = series.find((s) => s.fromFinal === 1 && s.winner);
  const status = won ? "final" : played.some((g) => g.status === "in" || g.status === "final") ? "in" : "pre";
  return { status, sides: [], lines: {}, teams: {}, bouts, ...(won?.wonAt != null ? { wonAt: won.wonAt } : {}) };
}

/** The first start of the bracket's games (a playoffs' listing's), or null. */
export function playoffsStart(games: PlayoffGame[]): string | null {
  const all = seriesOf(games);
  const inIt = new Set((isBracket(all) ? all : []).flatMap((s) => s.games));
  return games.filter((g) => inIt.has(g.id) && g.at).map((g) => g.at as string).sort()[0] ?? null;
}
