import { BoutSport, addStats, cleanDeltas, count, idOf, isoOf as iso, msOf, num, ordinal, position as pos, ratio, str, val as n, type Bout, type BoutAnswer, type BoutBox, type BoutCard, type BoutPlay, type BoutResult, type BoutState, type DrawPlace, type EspnBoutCompetition, type EspnBoutCompetitor, type EspnLinescore, type FieldEntry, type Play, type Position, type PositionGroup, type SetScore, type StatDef, type Stats } from "./sport";

// Tennis (the ATP's and the WTA's tours: `tennis/atp`, `tennis/wta`, all ESPN carries): its vocabulary and ESPN's reader
// (docs/PLAN-start-a-game-gpt.md track L, L5 part 4b).
//
// How ESPN records a tennis event (checked 2026-10-30 on every ATP and WTA event of 2025 and 2026: 318 boards, 24,594 matches):
//  - **One answer: the event's board** (`site.api.espn.com/apis/site/v2/sports/tennis/<tour>/scoreboard/<event>`, its id the
//    tournament's and the year's, "23-2026"; `max-age` 1-7 s, 12 KB over the wire for an ATP 500, ~100 KB for a Grand Slam).
//    Every draw's matches in `groupings` (men's and women's singles and doubles, mixed doubles, each with its qualifying rounds;
//    a combined event's both tours on either tour's board), each with its round (`round`: "Round 1" to "Round 4", "Quarterfinal",
//    "Semifinal", "Final", "Qualifying 1st Round", "Qualifying 2nd Round", "Qualifying Final", "Group Stage"; none in some 2025
//    doubles draws), its start (`date`, on the five minutes; `timeValid` false for one not yet scheduled, at the day's 04:00 UTC),
//    its court, its status (STATUS_FINAL, STATUS_RETIRED, STATUS_WALKOVER, STATUS_CANCELED, STATUS_IN_PROGRESS, STATUS_SCHEDULED;
//    live, STATUS_SUSPENDED: "post" but not `completed`, a feed's stall; `period` the set it's in or ended in), its two sides (`order` 1 and 2: a player, or a doubles pair typed "team" whose id is
//    its two players' joined, "1627-2695", its people in `roster`; "TBD", ids -3 and -4, for a place not yet known), each side's
//    `winner`, seed (`curatedRank.current`) and sets (`linescores`: the games, who won the set, a tiebreak's points), and ESPN's
//    result in words (`notes`: "Jerome Kym (SUI) bt (1) Ben Shelton (USA) 6-3 6-7 (4-7) 7-6 (7-1)", "... 7-5 ret", "... w/o").
//  - **Nothing else has more**: no summary (`tennis/<tour>/summary?event=` is a 400: ESPN asks its core for the match as an event
//    of its own), and the core API's match (`sports.core.api.espn.com/v2/sports/tennis/leagues/<tour>/events/<event>/
//    competitions/<match>`, its competitors, their `linescores`, its `status`) has the board's numbers again, its `statsSource`
//    "none": a competitor's `statistics` is a 404 ("No competitor stats found") and its `plays` empty, even for a Grand Slam
//    final. **So no aces, double faults, break points, serve or return numbers, durations or times by set or game, anywhere in
//    ESPN's answers**: a match is its score. ESPN carries no team events (the Davis Cup, the United Cup, the Laver Cup).
// Where ESPN's data is its own (each read in its data):
//  - **ESPN's `format` isn't the match's** (5 sets for nearly every ATP match, 3 or 5 for the WTA's): a round's format is the
//    sets its finished matches' winners won (the most common), a Grand Slam's men's singles best of five (some of its qualifying
//    rounds too: Wimbledon's last), everything else best of three, the Next Gen ATP Finals' short sets best of five.
//  - **A doubles match tiebreak is written two ways**: "1-0 (10-8)" (games, the tiebreak's points) or "10-8" as games; read as a
//    set of one game to its winner, the points its tiebreak's. A few are "0-0 (10-6)", neither side flagged the set's winner: its
//    points say who.
//  - **A winner unflagged**: 5 finished matches, 12 retirements and a walkover flag nobody: the sets say who won a finished one,
//    ESPN's note the rest. 5 finished matches' notes still say "leads" (written before the end): the sets stand.
//  - Every retirement's last set listed is the unfinished one (585 of 585, unflagged), so its games count, the set doesn't.
//  - A match's start is ESPN's listing (always on the five minutes, the same court's matches as little as 0-5 minutes apart: a
//    scheduled time, not when it began), and nothing says when one ended. **A match ends before either side's next match
//    starts** (in all but 2 of 34,216 pairs, both ESPN's own, the next is 40 minutes or more after it), so that's when it's known
//    by at the latest.
// When it's known: a finished match's sets and result together, when the answers were had (`_asked`) or by the next start of a
// match either side plays, whichever's first; else, for a finished event read with neither (a final), 12 hours after its start;
// a live answer's with neither only at the end. A match on, live: its sets so far, and the set on's games, at `_asked`. A round
// reached at the win that reached it, else (a bye, a group stage's semifinal) when the match in it starts.

const RESULT = "result";
const SETS = "sets";
const DRAW = "draw";

const STATS: StatDef[] = [
  // A match's result (a walkover isn't a match played, won or lost: the ATP's and WTA's records leave it out; a retirement is).
  count("MP", "Matches played", "MP", "match played", RESULT),
  count("W", "Matches won", "W", "match won", RESULT),
  count("L", "Matches lost", "L", "match lost", RESULT, "lower"),
  { key: "WPCT", label: "Match win percentage", short: "W%", noun: "match win percentage", group: RESULT, better: "higher", kind: "rate", of: (s) => ratio(n(s, "W"), n(s, "W") + n(s, "L")) },
  count("STR", "Straight-sets wins", "STR", "straight-sets win", RESULT),
  count("WRET", "Wins by retirement", "WRET", "win by the opponent's retirement", RESULT),
  count("WRET1", "Wins by retirement in the 1st set", "RET1", "win by retirement in the 1st set", RESULT),
  count("WRET2", "Wins by retirement in the 2nd set", "RET2", "win by retirement in the 2nd set", RESULT),
  count("WRET3", "Wins by retirement in the 3rd set", "RET3", "win by retirement in the 3rd set", RESULT),
  count("WRET4", "Wins by retirement in the 4th set", "RET4", "win by retirement in the 4th set", RESULT),
  count("WRET5", "Wins by retirement in the 5th set", "RET5", "win by retirement in the 5th set", RESULT),
  count("RET", "Retirements", "RET", "retirement", RESULT, "lower"),
  count("WWO", "Wins by walkover", "W/O", "win by walkover", RESULT),
  count("LWO", "Walkovers given", "W/O-", "walkover given", RESULT, "lower"),

  // Sets and games: a match tiebreak is a set of one game; a set a retirement stopped counts its games, not the set.
  count("SW", "Sets won", "SW", "set won", SETS),
  count("SL", "Sets lost", "SL", "set lost", SETS, "lower"),
  { key: "SPCT", label: "Set win percentage", short: "S%", noun: "set win percentage", group: SETS, better: "higher", kind: "rate", of: (s) => ratio(n(s, "SW"), n(s, "SW") + n(s, "SL")) },
  count("GW", "Games won", "GW", "game won", SETS),
  count("GL", "Games lost", "GL", "game lost", SETS, "lower"),
  { key: "GPCT", label: "Game win percentage", short: "G%", noun: "game win percentage", group: SETS, better: "higher", kind: "rate", of: (s) => ratio(n(s, "GW"), n(s, "GW") + n(s, "GL")) },
  count("TBW", "Tiebreaks won", "TBW", "tiebreak won", SETS),
  count("TBL", "Tiebreaks lost", "TBL", "tiebreak lost", SETS, "lower"),
  // A bagel: a set won without losing a game (6-0, or a short set's 4-0); not a match tiebreak.
  count("CS", "Clean sets (won without losing a game)", "CS", "set won without losing a game", SETS),
  count("CSL", "Sets lost without winning a game", "CSL", "set lost without winning a game", SETS, "lower"),

  // The draw: through qualifying into the main draw, the rounds reached (counted from the final, whatever the draw's size), the
  // title.
  count("QLF", "Qualified (through qualifying)", "Q", "qualification", DRAW),
  count("R16", "Last 16 reached", "R16", "last 16 reached", DRAW),
  count("QF", "Quarterfinals reached", "QF", "quarterfinal reached", DRAW),
  count("SF", "Semifinals reached", "SF", "semifinal reached", DRAW),
  count("FNL", "Finals reached", "F", "final reached", DRAW),
  count("TTL", "Titles", "TTL", "title", DRAW),
];

/** The round reached, by how many rounds it is from the final. */
const REACHED: Record<number, string> = { 4: "R16", 3: "QF", 2: "SF", 1: "FNL" };

const GROUPS: PositionGroup[] = [
  { key: "players", label: "Players", stats: [RESULT, SETS, DRAW] },
  { key: "pairs", label: "Doubles pairs", stats: [RESULT, SETS, DRAW] },
];

/** The draws as positions (a match's, from ESPN's grouping; a player's is the draw they're in: a pair's a doubles draw). */
const POSITIONS: Position[] = [pos("MS", "Men's singles", "players"), pos("WS", "Women's singles", "players"), pos("MD", "Men's doubles", "pairs"), pos("WD", "Women's doubles", "pairs"), pos("XD", "Mixed doubles", "pairs")];
const DRAWS: Record<string, string> = { "mens-singles": "MS", "womens-singles": "WS", "mens-doubles": "MD", "womens-doubles": "WD", "mixed-doubles": "XD" };

/** ESPN's round ids: the main draw's 1 to 7 (Round 1 ... Final), qualifying's 11 to 14 (14 its final round), a group stage 15. */
const MAIN_ROUNDS = new Set(["1", "2", "3", "4", "5", "6", "7"]);
const isQualifying = (id: string) => /^1[1-4]$/.test(id);
const GROUP_STAGE = "15";

/** How long after its start a match is surely over, where the answers say nothing later (a finished event's final read with no
 *  `_asked`): the longest best-of-five runs about 6 hours. */
const MATCH_OVER_MS = 12 * 3600_000;

/** A round's name from how many rounds it is from the final (a draw ESPN names no rounds of). */
const roundName = (fromFinal: number) => (fromFinal === 1 ? "Final" : fromFinal === 2 ? "Semifinal" : fromFinal === 3 ? "Quarterfinal" : `Round of ${2 ** fromFinal}`);

/** A side ESPN hasn't filled in yet ("TBD": a negative id). */
const tbd = (c: EspnBoutCompetitor) => (num(c.id) ?? 0) < 0 || str(c.athlete?.displayName) === "TBD";

/**
 * A set from each side's line (in Bout.sides' order): its games, its tiebreak's points and who won it. `done`: whether it's over
 * (a finished match's every set, a retirement's all but its last, a live one's before the set on), so an unflagged set's winner
 * is its games' or its points'. A match tiebreak written as points ("10-8") is a set of one game; "0-0 (10-6)" too, once done.
 */
/** A board's matches, each once (a combined event's are on both tours' draws), in ESPN's order, with its draw's slug; one called
 *  off too (the reader leaves it out). */
export function boardMatches(answer: BoutAnswer): { c: EspnBoutCompetition; draw: string }[] {
  const seen = new Set<string>();
  const out: { c: EspnBoutCompetition; draw: string }[] = [];
  for (const g of answer.board?.groupings ?? []) {
    for (const c of g.competitions ?? []) {
      const id = idOf(c.id);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({ c, draw: str(g.grouping?.slug) ?? "" });
    }
  }
  return out;
}

/** ESPN's live board calls a match STATUS_SUSPENDED ("post", `completed` false) when its feed stalls, its last set's games behind
 *  and its note already "bt", then has it on again or final (Basel 2026, recorded live: three of 11 matches, 10 to 15 minutes; no
 *  finished board of 2025-26 has one): a match on, not one over. Any other "post" is over (a called-off one too). */
export function matchSuspended(c: EspnBoutCompetition): boolean {
  return c.status?.type?.state === "post" && c.status?.type?.name === "STATUS_SUSPENDED";
}

/** A match over: "post" and not suspended (the dev scripts' recorder and cache read it too: espn-tennis-board.js). */
export function matchOver(c: EspnBoutCompetition): boolean {
  return c.status?.type?.state === "post" && !matchSuspended(c);
}

export function setOf(a: EspnLinescore | undefined, b: EspnLinescore | undefined, done: boolean): SetScore {
  const va = num(a?.value) ?? 0;
  const vb = num(b?.value) ?? 0;
  const ta = num(a?.tiebreak);
  const tb = num(b?.tiebreak);
  let games = [va, vb];
  let tiebreak: (number | null)[] | null = ta != null || tb != null ? [ta, tb] : null;
  let matchTiebreak = false;
  // No set runs past 7 games (every tour plays a tiebreak at 6-6): more is a match tiebreak's points written as games.
  if (Math.max(va, vb) >= 8) {
    matchTiebreak = true;
    tiebreak = [va, vb];
    games = [0, 0];
  } else if (tiebreak && Math.max(va, vb) <= 1) matchTiebreak = true;
  const by = (x: number, y: number) => (x > y ? 0 : y > x ? 1 : null);
  const flagged = a?.winner === true ? 0 : b?.winner === true ? 1 : null;
  const winner = flagged ?? (done ? by(games[0], games[1]) ?? (tiebreak ? by(tiebreak[0] ?? 0, tiebreak[1] ?? 0) : null) : null);
  // A match tiebreak is one game to its winner (ESPN's "1-0" already; its "0-0" and its points-as-games not yet).
  if (matchTiebreak && winner != null && games[0] === games[1]) games = winner === 0 ? [games[0] + 1, games[1]] : [games[0], games[1] + 1];
  return { games, tiebreak, winner, matchTiebreak };
}

/** Whether a set's games make it complete (each side's, in either order): six or more and two ahead, or 7-6 (a tiebreak at 6-6,
 *  every tour's). A short set's (to 4: the Next Gen ATP Finals', mixed doubles') isn't told from one under way. */
export function setComplete(games: number[]): boolean {
  const hi = Math.max(games[0], games[1]);
  const lo = Math.min(games[0], games[1]);
  return (hi >= 6 && hi - lo >= 2) || (hi === 7 && lo === 6);
}

/** Lowercase words of a name or a note, accents gone ("Frantzén": "frantzen"). */
const words = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z]+/)
    .filter((w) => w.length > 1);

/** Which side ESPN's note says won ("A (SUI) bt (1) B (USA) 6-3 ..."; a pair's "A (GBR) & B (GBR) bt ..."): the side whose names
 *  are more of the words before "bt" than after it, by the share of each side's (a note can spell a name otherwise than the
 *  side's: "Daria" for "Darya", so the other side's after "bt" says it too); null when the note doesn't say. `names`: each
 *  side's people's names, in Bout.sides' order. */
export function noteWinner(note: string | null | undefined, names: string[][]): number | null {
  const m = /^(.*?)\s+bt\s+(.*)$/.exec(String(note ?? ""));
  if (!m || names.length !== 2) return null;
  const before = new Set(words(m[1]));
  const after = new Set(words(m[2]));
  const lean = names.map((ns) => {
    const ws = ns.flatMap(words);
    return ws.length ? (ws.filter((w) => before.has(w)).length - ws.filter((w) => after.has(w)).length) / ws.length : 0;
  });
  return lean[0] > lean[1] ? 0 : lean[1] > lean[0] ? 1 : null;
}

/** Someone in a draw as of a moment (Tennis.draws): the furthest round they're in (its name and distance from the final; a group
 *  stage's is null), whether they're still in qualifying, out, or the champion. */
export interface DrawEntry {
  id: string;
  round: string | null;
  fromFinal: number | null;
  qualifying: boolean;
  out: boolean;
  champion: boolean;
}

/** A draw's standings (men's singles, women's doubles...), as of a moment. */
export interface DrawStanding {
  draw: string;
  entries: DrawEntry[];
}

/** How an over match ended: played out, a retirement, a walkover. */
type How = "played" | "ret" | "wo";

/** Everything the reader reads about one match. */
interface MatchRead {
  bout: Bout;
  c: EspnBoutCompetition;
  /** Its place in ESPN's board (the draws' matches in turn). */
  index: number;
  state: "pre" | "in" | "post";
  how: How | null;
  sets: SetScore[];
  /** The winner's index in `bout.sides`, once over. */
  winner: number | null;
  /** The set a retirement stopped in (the one after its last listed, for a retirement between sets). */
  stoppedIn: number | null;
  entries: FieldEntry[];
  /** Its people: a pair's two players apart (a player's next match can be a doubles one). */
  people: string[];
  names: Record<string, string>;
  note: string | null;
}

export class Tennis extends BoutSport {
  readonly id = "tennis";
  readonly name = "Tennis";
  readonly groups = GROUPS;
  readonly positions = POSITIONS;
  readonly statGroups = [
    { key: RESULT, label: "Matches" },
    { key: SETS, label: "Sets and games" },
    { key: DRAW, label: "The draw" },
  ];
  readonly stats = STATS;
  /** A match's sets: best of three, or five (a Grand Slam's men's singles; each match says its own: Bout.rounds). */
  readonly periods = { word: "set", plural: "sets", regulation: 3, extra: "set" };
  /** A day's order of play: like DraftKings' tennis, a lineup each day. */
  readonly lock = "daily" as const;
  readonly formats = [3, 5];

  /** A draw from ESPN's slug or name ("mens-singles", "Men's Singles"). */
  positionKey(abbreviation: string | null | undefined): string | null {
    const s = str(abbreviation);
    if (!s) return null;
    return DRAWS[s.toLowerCase().replace(/'/g, "").replace(/\s+/g, "-")] ?? (POSITIONS.some((p) => p.key === s.toUpperCase()) ? s.toUpperCase() : null);
  }

  /** "the 2nd set", "the result". */
  where(play: Pick<Play, "period" | "half" | "clock" | "shootout">): string {
    return play.period > 0 ? `the ${ordinal(play.period)} set` : "the result";
  }

  /** Every match of the event (each once: a combined event's on both tours' boards; one called off before it was played left
   *  out, as a card's bout called off is), in ESPN's order, with its draw. */
  private matches(answer: BoutAnswer, issues: string[]): { c: EspnBoutCompetition; draw: string }[] {
    return boardMatches(answer).filter(({ c }) => {
      if (c.status?.type?.name !== "STATUS_CANCELED") return true;
      if ((c.competitors ?? []).some((x) => !tbd(x))) issues.push(`match ${idOf(c.id)} was called off`);
      return false;
    });
  }

  /** The event's matches as read, in the order played (their starts; ESPN's order among equals). */
  private reads(answer: BoutAnswer, issues: string[] = []): MatchRead[] {
    const all = this.matches(answer, issues);
    // A main-draw round's distance from the final, by ESPN's ids: the quarterfinal, semifinal and final are 5, 6 and 7 whatever the
    // draw's size (and whether the board lists them yet); "Round 1" to "Round 4" count back from the quarterfinal by the draw's
    // last of them.
    const lastRound = new Map<string, number>();
    for (const { c, draw } of all) {
      const rid = Number(idOf(c.round?.id));
      if (rid >= 1 && rid <= 4) lastRound.set(draw, Math.max(lastRound.get(draw) ?? 0, rid));
    }
    const fromFinal = (draw: string, rid: string) => (!MAIN_ROUNDS.has(rid) ? null : Number(rid) >= 5 ? 8 - Number(rid) : 3 + (lastRound.get(draw) ?? Number(rid)) - Number(rid) + 1);
    const rs: MatchRead[] = all.map(({ c, draw }, index) => {
      const id = idOf(c.id);
      const sorted = (c.competitors ?? []).filter((x) => !tbd(x)).sort((a, b) => (num(a.order) ?? 9) - (num(b.order) ?? 9));
      const sides = sorted.map((x) => idOf(x.id));
      const entries: FieldEntry[] = sorted.map((x) =>
        x.type === "team"
          ? { id: idOf(x.id), name: str(x.roster?.displayName) ?? idOf(x.id), type: "team", members: idOf(x.id).split("-"), country: null }
          : { id: idOf(x.id), name: str(x.athlete?.displayName) ?? idOf(x.id), type: "athlete", members: [], country: str(x.athlete?.flag?.alt) },
      );
      const rid = idOf(c.round?.id);
      const qualifying = isQualifying(rid);
      const place: DrawPlace = { draw, round: str(c.round?.displayName), fromFinal: fromFinal(draw, rid), qualifying, group: rid === GROUP_STAGE };
      // A suspended match is on (matchOver), its sets so far.
      const espnState = c.status?.type?.state;
      const state = (espnState === "in" || matchSuspended(c) ? "in" : espnState === "post" ? "post" : "pre") as MatchRead["state"];
      const name = c.status?.type?.name ?? "";
      if (matchSuspended(c)) issues.push(`match ${id}: ${name}, read as on`);
      const how: How | null = state !== "post" ? null : name === "STATUS_RETIRED" ? "ret" : name === "STATUS_WALKOVER" ? "wo" : "played";
      if (state === "post" && !["STATUS_FINAL", "STATUS_RETIRED", "STATUS_WALKOVER"].includes(name)) issues.push(`match ${id}: over as ${name || "nothing"}, read as played out`);
      // Its sets, each side's lines side by side; which are over: a finished match's all, a retirement's all but the set it
      // stopped in (its last listed, unless that one's complete: a retirement between sets, ESPN's note "6-3 7-6 (9-7) 0-0 ret"),
      // a live one's those before the set on (and any ESPN flags a winner of).
      const lines = sorted.map((x) => x.linescores ?? []);
      const count = Math.max(0, ...lines.map((l) => l.length));
      const period = num(c.status?.period) ?? count;
      const between = how === "ret" && sorted.length === 2 && count > 0 && setComplete([num(lines[0][count - 1]?.value) ?? 0, num(lines[1][count - 1]?.value) ?? 0]);
      const sets = sorted.length === 2 ? Array.from({ length: count }, (_, i) => setOf(lines[0][i], lines[1][i], how === "played" || (how === "ret" && (i < count - 1 || between)) || (state === "in" && i < period - 1))) : [];
      // The winner: ESPN's flag, else a finished match's sets, else ESPN's note (a retirement's, a walkover's).
      const note = str(c.notes?.[0]?.text);
      const names = Object.fromEntries(entries.map((e) => [e.id, e.name]));
      let winner: number | null = null;
      if (state === "post" && sorted.length === 2) {
        const flagged = sorted.findIndex((x) => x.winner === true);
        const won = [0, 1].map((i) => sets.filter((s) => s.winner === i).length);
        const people = sorted.map((x) => (x.type === "team" ? (x.roster?.athletes ?? []).map((a) => str(a.displayName) ?? "") : [str(x.athlete?.displayName) ?? ""]));
        winner = flagged >= 0 ? flagged : how === "played" && won[0] !== won[1] ? (won[0] > won[1] ? 0 : 1) : noteWinner(note, people);
        if (flagged < 0) issues.push(`match ${id}: no winner flagged, ${winner == null ? "and none read" : `read from ${how === "played" && won[0] !== won[1] ? "its sets" : "ESPN's note"}`}`);
        if (how === "played" && winner != null && won[winner] <= won[1 - winner]) issues.push(`match ${id}: its winner won ${won[winner]} sets to ${won[1 - winner]}`);
      }
      const seeds = sorted.map((x) => num(x.curatedRank?.current));
      const bout: Bout = {
        id,
        order: index + 1,
        sides,
        rounds: 3,
        lengths: [],
        overtime: false,
        segment: null,
        main: place.fromFinal === 1,
        title: place.fromFinal === 1,
        start: c.timeValid === false ? null : str(c.date),
        class: DRAWS[draw] ?? null,
        place,
        seeds,
      };
      const stoppedIn = how === "ret" ? (between ? count + 1 : period || count) : null;
      return { bout, c, index, state, how, sets, winner, stoppedIn, entries, people: sides.flatMap((s) => s.split("-")), names, note };
    });
    this.inferRounds(rs, issues);
    // Each round's format: the sets its finished matches' winners won (the most common), else its draw part's (main or
    // qualifying), else a Grand Slam's men's singles main draw best of five and the rest best of three.
    const tally = new Map<string, Map<number, number>>();
    const add = (k: string, won: number) => tally.set(k, new Map(tally.get(k) ?? []).set(won, (tally.get(k)?.get(won) ?? 0) + 1));
    for (const r of rs) {
      if (r.how !== "played" || r.winner == null) continue;
      const won = r.sets.filter((s) => s.winner === r.winner).length;
      add(`${r.bout.place!.draw}:${idOf(r.c.round?.id)}`, won);
      add(`${r.bout.place!.draw}:${r.bout.place!.qualifying}`, won);
    }
    const mode = (k: string) => [...(tally.get(k) ?? new Map<number, number>()).entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? null;
    for (const r of rs) {
      const p = r.bout.place!;
      const toWin = mode(`${p.draw}:${idOf(r.c.round?.id)}`) ?? mode(`${p.draw}:${p.qualifying}`) ?? (answer.board?.major && p.draw === "mens-singles" && !p.qualifying ? 3 : 2);
      r.bout.rounds = 2 * toWin - 1;
    }
    // The order played: by start (a match not yet scheduled after those that are), ESPN's order among equals.
    rs.sort((a, b) => (msOf(a.bout.start) ?? Infinity) - (msOf(b.bout.start) ?? Infinity) || a.index - b.index);
    rs.forEach((r, i) => (r.bout.order = i + 1));
    return rs;
  }

  /** A draw ESPN names no rounds of (some 2025 doubles draws): each match's distance from the final by its winner's next match in
   *  the draw (the final's winner plays no more), if that leaves one final; its rounds named by it. */
  private inferRounds(rs: MatchRead[], issues: string[]) {
    const byDraw = new Map<string, MatchRead[]>();
    for (const r of rs) byDraw.set(r.bout.place!.draw, [...(byDraw.get(r.bout.place!.draw) ?? []), r]);
    for (const [draw, ms] of byDraw) {
      if (ms.some((r) => r.c.round?.id != null)) {
        const none = ms.filter((r) => r.c.round?.id == null);
        if (none.length) issues.push(`${draw}: ${none.length} matches with no round`);
        continue;
      }
      if (ms.some((r) => r.state !== "post" || r.winner == null)) {
        issues.push(`${draw}: no rounds, and not over: left unnamed`);
        continue;
      }
      // In the order played, as the event's (a match never scheduled last: Noticed).
      const order = [...ms].sort((a, b) => (msOf(a.bout.start) ?? Infinity) - (msOf(b.bout.start) ?? Infinity) || a.index - b.index);
      const next = new Map<MatchRead, MatchRead | null>();
      order.forEach((r, i) => {
        const w = r.bout.sides[r.winner!];
        next.set(r, order.slice(i + 1).find((x) => x.bout.sides.includes(w)) ?? null);
      });
      const from = new Map<MatchRead, number>();
      for (const r of [...order].reverse()) from.set(r, next.get(r) ? from.get(next.get(r)!)! + 1 : 1);
      if (order.filter((r) => from.get(r) === 1).length !== 1) {
        issues.push(`${draw}: no rounds, and its matches don't make one final: left unnamed`);
        continue;
      }
      // Named down to the draw's first full round (the round of 16's 8 matches); a match before it is qualifying or a first round
      // with byes, which the draw's shape doesn't tell apart: its distance kept, no name.
      const counts = new Map<number, number>();
      for (const k of from.values()) counts.set(k, (counts.get(k) ?? 0) + 1);
      let full = 0;
      while (counts.get(full + 1) === 2 ** full) full++;
      for (const r of order) r.bout.place = { ...r.bout.place!, round: from.get(r)! <= full ? roundName(from.get(r)!) : null, fromFinal: from.get(r)! };
      const before = order.filter((r) => from.get(r)! > full).length;
      issues.push(`${draw}: no rounds from ESPN, read from its matches${before ? ` (${before} before its first full round, qualifying or a first round with byes, unnamed)` : ""}`);
    }
  }

  card(answer: BoutAnswer): BoutCard | null {
    return answer.board?.groupings ? this.cardOf(answer, this.reads(answer)) : null;
  }

  private cardOf(answer: BoutAnswer, rs: MatchRead[]): BoutCard {
    const bouts = rs.map((r) => r.bout);
    return { event: idOf(answer.board?.id), bouts, field: [...new Set(bouts.flatMap((b) => b.sides))] };
  }

  /** A match's result, once over and its winner known. */
  private resultOf(r: MatchRead): BoutResult | null {
    if (r.state !== "post" || r.winner == null || r.bout.sides.length !== 2) return null;
    const winner = r.bout.sides[r.winner];
    return {
      bout: r.bout.id,
      outcome: "win",
      winner,
      loser: r.bout.sides[1 - r.winner],
      method: r.how === "wo" ? "WWO" : r.how === "ret" ? "WRET" : null,
      how: r.how === "wo" ? "walkover" : r.how === "ret" ? "retired" : null,
      round: r.how === "wo" ? null : r.stoppedIn ?? num(r.c.status?.period) ?? (r.sets.length || null),
      time: null,
      cards: [],
      sets: r.sets.map((s) => ({ ...s, games: [...s.games], tiebreak: s.tiebreak ? [...s.tiebreak] : null })),
    };
  }

  /** What a set puts in each side's line: a finished one its set, games, tiebreak and a clean set; one unfinished its games. */
  private setStats(r: MatchRead, s: SetScore): Record<string, Stats> {
    const out: Record<string, Stats> = {};
    r.bout.sides.forEach((who, i) => {
      const d: Stats = { GW: s.games[i], GL: s.games[1 - i] };
      if (s.winner != null) {
        const won = s.winner === i;
        d[won ? "SW" : "SL"] = 1;
        if (s.tiebreak) d[won ? "TBW" : "TBL"] = 1;
        if (!s.matchTiebreak && s.games[1 - s.winner] === 0) d[won ? "CS" : "CSL"] = 1;
      }
      out[who] = d;
    });
    return cleanDeltas(out);
  }

  /** What a match's end puts in its sides' lines: a match played (not a walkover). */
  private endStats(r: MatchRead): Record<string, Stats> {
    return r.how === "wo" ? {} : Object.fromEntries(r.bout.sides.map((s) => [s, { MP: 1 }]));
  }

  /** What a result puts in its sides' lines: the win and the loss, how, and the round the win reached (the title, through
   *  qualifying). */
  private resultStats(r: MatchRead, res: BoutResult, lastQual: number | undefined): Record<string, Stats> {
    const w: Stats = {};
    const l: Stats = {};
    if (r.how === "wo") {
      w.WWO = 1;
      l.LWO = 1;
    } else {
      w.W = 1;
      l.L = 1;
      if (r.how === "ret") {
        w.WRET = 1;
        const set = Math.min(5, res.round ?? r.sets.length);
        if (set >= 1) w[`WRET${set}`] = 1;
        l.RET = 1;
      } else if (!r.sets.some((s) => s.winner === 1 - r.winner!)) w.STR = 1;
    }
    const p = r.bout.place;
    if (p?.fromFinal != null && !p.qualifying && !p.group) {
      if (p.fromFinal === 1) w.TTL = 1;
      else if (REACHED[p.fromFinal - 1]) w[REACHED[p.fromFinal - 1]] = 1;
    }
    if (p?.qualifying && lastQual != null && Number(idOf(r.c.round?.id)) === lastQual) w.QLF = 1;
    return cleanDeltas({ [res.winner!]: w, [res.loser!]: l });
  }

  /** The rounds reached on the event's board other than by a win the reader credits (a bye, a group stage's semifinal, a lucky
   *  loser): each side of a main-draw match in the last 16 or later that didn't win its way there in the draw's round before. */
  private arrivals(rs: MatchRead[]): { r: MatchRead; who: string; key: string }[] {
    const out: { r: MatchRead; who: string; key: string }[] = [];
    for (const r of rs) {
      const p = r.bout.place;
      if (!p || p.fromFinal == null || p.qualifying || p.group || !REACHED[p.fromFinal]) continue;
      for (const who of r.bout.sides) {
        const won = rs.some((x) => x.bout.place?.draw === p.draw && x.bout.place.fromFinal === p.fromFinal! + 1 && !x.bout.place.qualifying && x.winner != null && x.bout.sides[x.winner] === who);
        if (!won) out.push({ r, who, key: REACHED[p.fromFinal] });
      }
    }
    return out;
  }

  /** The draw's last qualifying round, by ESPN's id. */
  private lastQualifying(rs: MatchRead[]): Map<string, number> {
    const out = new Map<string, number>();
    for (const r of rs) if (r.bout.place?.qualifying) out.set(r.bout.place.draw, Math.max(out.get(r.bout.place.draw) ?? 0, Number(idOf(r.c.round?.id))));
    return out;
  }

  /** Whether every match is over (none to come or on): the event's final. ESPN's own status for the event says final all week. */
  private over(rs: MatchRead[]): boolean {
    return rs.length > 0 && rs.every((r) => r.state === "post");
  }

  /** ESPN's own numbers: each side's sets, games and results over every match of theirs, each match's apart, and the results;
   *  final once every match is over. */
  readBox(answer: BoutAnswer): BoutBox | null {
    if (!answer.board?.groupings) return null;
    const rs = this.reads(answer);
    const card = this.cardOf(answer, rs);
    const people: BoutBox["people"] = {};
    const byBout: Record<string, Record<string, Stats>> = {};
    const results: BoutResult[] = [];
    const lastQual = this.lastQualifying(rs);
    const add = (bout: string, who: string, d: Stats | undefined) => {
      if (!d || !people[who]) return;
      addStats(people[who].stats, d);
      (byBout[bout] ??= {})[who] = addStats(byBout[bout][who] ?? {}, d);
    };
    for (const r of rs) {
      for (const e of r.entries) {
        const person = (people[e.id] ??= { ...e, bouts: [], stats: {} });
        person.bouts.push(r.bout.id);
      }
      // A match on counts its sets so far and the set on's games; one over, every set, its end and its result.
      if (r.state === "pre") continue;
      for (const s of r.sets) for (const [who, d] of Object.entries(this.setStats(r, s))) add(r.bout.id, who, d);
      const res = this.resultOf(r);
      if (r.state === "post") for (const [who, d] of Object.entries(this.endStats(r))) add(r.bout.id, who, d);
      if (res) {
        results.push(res);
        for (const [who, d] of Object.entries(this.resultStats(r, res, lastQual.get(r.bout.place!.draw)))) add(r.bout.id, who, d);
      }
    }
    for (const a of this.arrivals(rs)) add(a.r.bout.id, a.who, { [a.key]: 1 });
    return { ...card, final: this.over(rs), people, results, byBout };
  }

  /**
   * The event's plays, match by match as they're known: a match's sets (each in its `period`), its end and its result, at when
   * the answers were had (`_asked`) or by the next start of a match either side plays, whichever's first (else, for a finished
   * event read with neither, 12 hours after its start; a live answer's with neither only at the end). A match on, live: its sets
   * over and the set on's games so far ("so-far") at `_asked`. A round reached by a win comes with the win's result; reached
   * otherwise (a bye, a group stage's semifinal), when the match in it starts (or `_asked`, if earlier).
   */
  readPlays(answer: BoutAnswer, issues: string[] = []): BoutPlay[] {
    if (!answer.board?.groupings) return [];
    const rs = this.reads(answer, issues);
    const asked = msOf(answer._asked);
    const final = this.over(rs);
    const lastQual = this.lastQualifying(rs);
    // Each person's matches by their starts: a match is over before its people's next one starts.
    const starts = new Map<string, MatchRead[]>();
    for (const r of rs) for (const who of r.people) starts.set(who, [...(starts.get(who) ?? []), r]);
    const nextStart = (r: MatchRead): number | null => {
      const t = msOf(r.bout.start);
      const later = r.people.flatMap((who) => starts.get(who) ?? []).filter((x) => x !== r && msOf(x.bout.start) != null && (t != null ? msOf(x.bout.start)! > t : x.bout.place?.draw === r.bout.place?.draw && x.bout.place?.fromFinal != null && r.bout.place?.fromFinal != null && x.bout.place.fromFinal < r.bout.place.fromFinal));
      return later.length ? Math.min(...later.map((x) => msOf(x.bout.start)!)) : null;
    };
    const latest = Math.max(...rs.map((r) => msOf(r.bout.start) ?? -Infinity));
    const knownBy = (r: MatchRead): number | null => {
      if (r.state === "in") return asked;
      const next = nextStart(r);
      const by = Math.min(asked ?? Infinity, next ?? Infinity);
      if (Number.isFinite(by)) return by;
      return final && Number.isFinite(latest) ? (msOf(r.bout.start) ?? latest) + MATCH_OVER_MS : null;
    };
    const keyed: { t: number; seq: number; play: BoutPlay }[] = [];
    const push = (t: number | null, seq: number, play: Omit<BoutPlay, "at">) => keyed.push({ t: t ?? Infinity, seq, play: { ...play, at: iso(t) } as BoutPlay });
    rs.forEach((r, i) => {
      const { bout } = r;
      const title = bout.sides.map((s) => r.names[s]).join(" vs. ");
      const base = { bout: bout.id, who: null, half: null, clock: null, team: null, unit: bout.id, score: {}, people: bout.sides } as const;
      const seq = i * 100;
      if (r.state === "pre") return;
      const t = knownBy(r);
      const res = this.resultOf(r);
      r.sets.forEach((s, k) => {
        const on = s.winner == null && r.state === "in";
        const scored = `${s.games[0]}-${s.games[1]}${s.tiebreak ? ` (${s.tiebreak.map((x) => x ?? "?").join("-")})` : ""}`;
        const what = on ? "so far in the" : s.winner == null ? "stopped in the" : "the";
        push(t, seq + k, { ...base, id: `${bout.id}:set${k + 1}${on ? ":so-far" : ""}`, period: k + 1, text: `${title}: ${what} ${ordinal(k + 1)} set, ${scored}`, kind: on ? "so-far" : "set", deltas: this.setStats(r, s) });
      });
      if (r.state !== "post") return;
      push(t, seq + 50, { ...base, id: `${bout.id}:end`, period: 0, text: `${title}: over${r.how === "wo" ? " (a walkover)" : r.how === "ret" ? " (a retirement)" : ""}`, kind: "bout-end", deltas: this.endStats(r) });
      if (res) push(t, seq + 51, { ...base, id: `${bout.id}:result`, who: res.winner, period: 0, text: this.says(res, r), kind: "result", deltas: this.resultStats(r, res, lastQual.get(bout.place!.draw)), result: res });
      else issues.push(`match ${bout.id} (${title}) is over with no winner read`);
    });
    // A round reached otherwise than by a win: when its match starts, or when the answers say so first.
    for (const a of this.arrivals(rs)) {
      const start = msOf(a.r.bout.start);
      const t = asked != null && (start == null || asked < start) ? asked : start;
      push(t, rs.indexOf(a.r) * 100 - 1, { bout: a.r.bout.id, who: a.who, half: null, clock: null, team: null, unit: a.r.bout.id, score: {}, people: [a.who], id: `${a.r.bout.id}:reached:${a.who}`, period: 0, text: `${a.r.names[a.who] ?? a.who}: ${this.stat(a.key)!.label.toLowerCase()}`, kind: "reached", deltas: { [a.who]: { [a.key]: 1 } } });
    }
    keyed.sort((x, y) => x.t - y.t || x.seq - y.seq);
    return keyed.map((k) => k.play);
  }

  /** A result in words, the winner's games first: "Jerome Kym beat Ben Shelton 6-3 6-7 (4-7) 7-6 (7-1)", "... 7-5, retired",
   *  "... by walkover". */
  private says(res: BoutResult, r: MatchRead): string {
    const w = r.winner!;
    const score = (res.sets ?? [])
      .map((s) => {
        const g = `${s.games[w]}-${s.games[1 - w]}`;
        return s.tiebreak ? `${g} (${s.tiebreak[w] ?? "?"}-${s.tiebreak[1 - w] ?? "?"})` : g;
      })
      .join(" ");
    const names = `${r.names[res.winner!] ?? res.winner} beat ${r.names[res.loser!] ?? res.loser}`;
    return r.how === "wo" ? `${names} by walkover` : `${names} ${score}${r.how === "ret" ? ", retired" : ""}`;
  }

  /**
   * Each draw's standings as of a state: everyone in it, the furthest round they're in (a match of theirs on or over, or a round
   * their known win reached), whether they're out (a main-draw loss known, a walkover given; a qualifier's loss in qualifying),
   * and the champion once the final's won. Qualifying's players are in it too, `qualifying` until they're through.
   */
  draws(state: BoutState, card: BoutCard): DrawStanding[] {
    const out = new Map<string, Map<string, DrawEntry>>();
    // Each draw's rounds by their distance from the final, for a round a known win reached before its match is on.
    const names = new Map<string, string | null>();
    for (const b of card.bouts) if (b.place?.fromFinal != null) names.set(`${b.place.draw}:${b.place.fromFinal}`, b.place.round);
    // Further into the main draw: anywhere in it from qualifying, a round nearer the final, a group stage before any.
    const further = (e: DrawEntry, fromFinal: number | null) => e.qualifying || (fromFinal != null && fromFinal < (e.fromFinal ?? Infinity));
    const into = (e: DrawEntry, round: string | null, fromFinal: number | null) => Object.assign(e, { round, fromFinal, qualifying: false, out: e.qualifying ? false : e.out });
    // Where each one enters the main draw (its earliest round they're listed in: a seed's bye starts them later; a group stage),
    // and whether they start in qualifying (a qualifier is in it until through).
    const entry = new Map<string, Bout>();
    const qualifies = new Set<string>();
    for (const b of card.bouts) {
      const p = b.place;
      if (!p) continue;
      for (const who of b.sides) {
        const key = `${p.draw}:${who}`;
        if (p.qualifying) qualifies.add(key);
        else if (!entry.has(key) || (p.fromFinal ?? Infinity) > (entry.get(key)!.place!.fromFinal ?? Infinity)) entry.set(key, b);
      }
    }
    for (const b of card.bouts) {
      const p = b.place;
      if (!p) continue;
      const draw = out.get(p.draw) ?? out.set(p.draw, new Map()).get(p.draw)!;
      const line = state.bouts[b.id];
      const on = !!line && line.stage !== "pre";
      const res = line?.result ?? null;
      for (const who of b.sides) {
        const key = `${p.draw}:${who}`;
        const first = entry.get(key)?.place ?? null;
        const e = draw.get(who) ?? draw.set(who, qualifies.has(key) ? { id: who, round: null, fromFinal: null, qualifying: true, out: false, champion: false } : { id: who, round: first?.round ?? null, fromFinal: first?.fromFinal ?? null, qualifying: false, out: false, champion: false }).get(who)!;
        if (p.qualifying) {
          // The bouts are in the order played, so a later qualifying round comes later; through it (its last round won), into
          // the main draw where they're listed in it.
          if (on && e.qualifying) e.round = p.round;
          if (res?.loser === who && e.qualifying) e.out = true;
          if (res?.winner === who && e.qualifying && n(state.lines[who] ?? {}, "QLF") > 0 && first) into(e, first.round, first.fromFinal);
          continue;
        }
        // In a main-draw round: playing in it, or a known win (or arrival) that reached it.
        const reached = p.fromFinal != null && REACHED[p.fromFinal] ? n(state.lines[who] ?? {}, REACHED[p.fromFinal]) > 0 : false;
        if ((on || reached) && further(e, p.fromFinal)) into(e, p.round, p.fromFinal);
        if (res?.loser === who && !p.group) e.out = true;
        if (res?.winner === who && p.fromFinal === 1) e.champion = true;
        if (res?.winner === who && !p.group && p.fromFinal != null && p.fromFinal > 1 && further(e, p.fromFinal - 1)) into(e, names.get(`${p.draw}:${p.fromFinal - 1}`) ?? roundName(p.fromFinal - 1), p.fromFinal - 1);
      }
    }
    // A group stage (the ATP and WTA Finals' round robin): once every place in the knockout after it is known, the rest are out.
    for (const [draw, m] of out) {
      const ko = card.bouts.filter((b) => b.place?.draw === draw && !b.place.qualifying && !b.place.group && b.place.fromFinal != null);
      if (!card.bouts.some((b) => b.place?.draw === draw && b.place.group) || !ko.length) continue;
      const first = Math.max(...ko.map((b) => b.place!.fromFinal!));
      const places = ko.filter((b) => b.place!.fromFinal === first).length * 2;
      const entries = [...m.values()].filter((e) => !e.qualifying);
      if (entries.filter((e) => e.fromFinal != null && e.fromFinal <= first).length >= places) for (const e of entries) if (e.fromFinal == null) e.out = true;
    }
    return [...out].map(([draw, m]) => ({ draw, entries: [...m.values()] }));
  }
}
