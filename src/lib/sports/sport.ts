// Sports as code (docs/PLAN-start-a-game-gpt.md track L, step L1; the details in docs/PLAN-sports-live.md, "The design:
// classes"). A Sport is what a sport *is*: its positions and how they group, its stat keys (each with a label, a short label
// and whether higher or lower is better), its periods, how often its lineups lock, and how ESPN's box score and plays read into
// our shapes. Never what a game is: that's a spec (docs/PLAN-start-a-game-gpt.md, "The game spec"), and a sport's defaults
// (scoring, slots, locks) are default specs stored as data beside it (./defaults/*.json), never `if (sport === ...)` in a
// format.
//
// Pure, and shared by the server, the phone and the tests. Nothing here asks ESPN: the readers take an answer someone already
// has (the phone's poll, the server's cache, a recorded fixture in tests/fixtures/espn/).
//
// The one idea: a game is its plays. Each Play carries its wallclock, period and clock, the people in it and its stat deltas,
// so `reduce(plays, t)` is the box score at any moment t, and the live view, a later watch and the final are one code path
// (`stateAt(t)`). The final box score is the truth: `timeline()` ends a finished game with one more play, the final's
// correction, that makes the plays' box score ESPN's own (a scoring change after the play, a pitcher's win). The proof, per
// sport: for a recorded finished game, the plays alone reduce to ESPN's own box score (tests/sports-*.test.js).
import { ordinal } from "@/lib/game/sports-stats";

export { ordinal };

/** What's better for a stat: more (home runs) or fewer (a pitcher's walks). */
export type Better = "higher" | "lower";

/** How often a sport's lineups lock, like Yahoo's: each day (baseball, basketball, hockey), each week (football), each event
 *  (golf, racing, a fight card). */
export type LockCadence = "daily" | "weekly" | "event";

/** A person's or a team's numbers: stat key to value. */
export type Stats = Record<string, number>;

export interface StatDef {
  /** Unique in the sport: what a spec scores and asks about ({ HR: 5 }, { by: "stat", stat: "PTS" }). */
  key: string;
  /** "Home runs". */
  label: string;
  /** As a column says it: "HR". Two groups can share one ("H" for a hitter's hits and a pitcher's hits allowed). */
  short: string;
  /** A singular noun for a sentence, "5 a home run": the game spec's ctx.stats label. */
  noun: string;
  better: Better;
  /** Which of the sport's stat groups it's in ("batting", "pitching"). */
  group: string;
  /**
   * "count": a whole number that adds, play by play and game by game (it's what plays' deltas carry). "derived": worked out
   * from a game's counts (total bases, innings pitched, a quality start), and over several games, added game by game. "rate":
   * worked out from counts and never added (AVG, ERA: over several games, from their counts added).
   */
  kind: "count" | "derived" | "rate";
  /** "final": known only once the game is over, from the final box score (a pitcher's win or save); else play by play. */
  known?: "final";
  /** The official scorer's call (an earned run, a run batted in on an error): read from the plays as the rules say, but the
   *  scorer can judge it otherwise, so live it's provisional and the final's correction settles it. */
  judged?: true;
  /** A derived or rate stat from someone's counts; null when it can't be said (an AVG with no at-bats). */
  of?: (s: Stats) => number | null;
}

/** A group of positions that share stats and slots ("Batters", "Pitchers"; "Forwards", "Defense", "Goalies"). */
export interface PositionGroup {
  key: string;
  label: string;
  /** The stat groups its people have lines in. */
  stats: string[];
}

export interface Position {
  /** "SS", "RP". */
  key: string;
  /** "Shortstop", "Relief pitcher". */
  label: string;
  /** Its PositionGroup. */
  group: string;
}

/** A sport's word for a part of its game, and how many make a game before extra time. */
export interface Periods {
  /** "inning", "quarter", "period". */
  word: string;
  plural: string;
  /** How many make a regulation game: 9 innings, 4 quarters, 3 periods. */
  regulation: number;
  /** What comes after them: "extra innings", "overtime". */
  extra: string;
}

/** One moment of a game, as ESPN records it, with what it adds to whose line. */
export interface Play {
  /** ESPN's id for it (the final's correction: "<event>:final"). */
  id: string;
  /**
   * When it became known: ESPN's wallclock (ISO 8601), but never before the play before it (inOrder), since ESPN stamps a
   * change made between innings with when it was made, before the inning's own start. Null only when nothing before it has a
   * time either.
   */
  at: string | null;
  /** The inning, quarter or period (1-based; past regulation is extra time). */
  period: number;
  /** Baseball's half of the inning; null for a sport without halves. */
  half: "top" | "bottom" | null;
  /** The game clock at it as ESPN shows it ("5:32": basketball's counts down, hockey's up), for a sport with one; null for
   *  baseball. */
  clock: string | null;
  text: string;
  /** What kind of play it is, in the sport's words ("single", "strikeout", "ball", "pitching-change", "final"). */
  kind: string;
  /** The team it's for (the batting side, the offense, the side that scored), by ESPN's team id; null when neither's. */
  team: string | null;
  /** The at-bat, drive or possession it's part of, when the sport has them (live calls: "this at-bat", "the next drive"). */
  unit: string | null;
  /** The people in it, by ESPN's athlete ids. */
  people: string[];
  /** Each team's score after it, by ESPN's team id. */
  score: Record<string, number>;
  /** What it adds to whose line: { [athlete]: { [stat key]: n } }. Empty when it changes nothing (a ball, a substitution). */
  deltas: Record<string, Stats>;
  /** The final's correction (Sport.timeline): its deltas make the plays' box score the final box score. Or what else only the
   *  final says (soccer's minutes to the end, in a feed with no event for it). */
  final?: boolean;
  /** Part of a shootout after extra time (hockey's; soccer's penalties in L5): its goals and saves aren't the game's, and its
   *  winner's one goal comes at its end. */
  shootout?: boolean;
}

/** One side of a game in a box score. */
export interface BoxTeam {
  id: string;
  name: string;
  abbreviation: string | null;
  home: boolean | null;
  score: number;
  winner: boolean | null;
  /** The team's own totals, in the sport's keys, as far as ESPN gives them (a team's doubles and total bases in baseball,
   *  which its players' lines don't have). */
  stats: Stats;
}

export interface BoxPerson {
  id: string;
  name: string;
  /** ESPN's team id. */
  team: string;
  /** The sport's position key, when it's one the sport knows ("SS"); else ESPN's own abbreviation. */
  position: string | null;
  /**
   * Their counts as far as ESPN's box score has them, in the sport's keys, zeros kept. Not every count the sport has (baseball's
   * batting lines have no doubles or triples), so derived stats come from the plays' counts (reduce, the timeline), never from
   * a box line alone: Sport.full on one would count every hit as a single.
   */
  stats: Stats;
}

/** A game's box score in the sport's keys: ESPN's own, read by Sport.readBox. */
export interface Box {
  event: string;
  final: boolean;
  teams: BoxTeam[];
  people: Record<string, BoxPerson>;
}

/** A game as of a moment: the plays up to it, added up (Sport.reduce). */
export interface GameState {
  /** How many plays it counts. */
  plays: number;
  /** The latest of them: the score, period, half and clock now. */
  last: Play | null;
  score: Record<string, number>;
  /** Each person's counts so far. */
  lines: Record<string, Stats>;
}

/** ESPN's summary for a game (site.api …/summary?event=), only the parts the sports read; each reader adds its own. */
export interface EspnSummary {
  header?: {
    id?: string | number;
    /** ESPN's season type: 1 preseason, 2 regular season, 3 postseason. */
    season?: { year?: number; type?: number };
    competitions?: {
      /** When it starts (ISO 8601): the scheduled time before it, the first pitch or tip-off's after. */
      date?: string;
      status?: {
        /** The period it's in or ended in (past regulation: extra time, a shootout). */
        period?: number;
        type?: { state?: string; completed?: boolean; detail?: string };
        /** A finished hockey game's goalies of record ("winningGoalie", "losingGoalie"). */
        featuredAthletes?: { name?: string; athlete?: { id?: string | number }; team?: { id?: string | number } }[];
      };
      /** `shootoutScore`: a soccer match's penalty shootout, apart from its score. */
      competitors?: { homeAway?: string; winner?: boolean; score?: string | number; shootoutScore?: number; team?: EspnTeam }[];
    }[];
  };
  boxscore?: {
    // Baseball's come in groups (batting's stats, pitching's); basketball's and hockey's as one list.
    teams?: { team?: EspnTeam; statistics?: { name?: string; value?: number; displayValue?: string; stats?: { name?: string; value?: number; displayValue?: string }[] }[] }[];
    players?: { team?: EspnTeam; statistics?: EspnTable[] }[];
  };
  plays?: EspnPlay[];
  /** Football's plays sit in its drives: the finished ones, and live, the one going on. */
  drives?: { previous?: EspnDrive[]; current?: EspnDrive };
}

/** A football drive: its team (the offense) and its plays, in order. */
export interface EspnDrive {
  id?: string | number;
  team?: { id?: string | number; abbreviation?: string };
  plays?: EspnPlay[];
}

export interface EspnTeam {
  id?: string | number;
  displayName?: string;
  abbreviation?: string;
}

/** One of a team's tables in a box score (baseball's batting and pitching). */
export interface EspnTable {
  type?: string;
  name?: string;
  labels?: string[];
  keys?: string[];
  totals?: (string | number)[];
  athletes?: {
    athlete?: { id?: string | number; displayName?: string; position?: { abbreviation?: string } };
    position?: { abbreviation?: string; name?: string };
    starter?: boolean;
    didNotPlay?: boolean;
    batOrder?: number;
    stats?: (string | number)[];
    notes?: { type?: string; text?: string }[];
  }[];
}

export interface EspnPlay {
  id?: string | number;
  type?: { id?: string | number; text?: string; type?: string; abbreviation?: string; penaltyMinutes?: string | number; penaltyType?: string };
  text?: string;
  awayScore?: number;
  homeScore?: number;
  period?: { type?: string; number?: number; displayValue?: string };
  clock?: { displayValue?: string };
  scoringPlay?: boolean;
  scoreValue?: number;
  team?: { id?: string | number };
  wallclock?: string;
  participants?: { athlete?: { id?: string | number }; type?: string }[];
  // Baseball's.
  atBatId?: string;
  summaryType?: string;
  atBatPitchNumber?: number;
  pitchCount?: { balls?: number; strikes?: number };
  resultCount?: { balls?: number; strikes?: number };
  outs?: number;
  // Basketball's.
  shootingPlay?: boolean;
  pointsAttempted?: number;
  // Hockey's: the scoring or shooting side's strength ("power-play"), and the net ("empty-net").
  strength?: { abbreviation?: string };
  shotInfo?: { abbreviation?: string };
  // Football's: who had the ball when it began, on which down and distance, and where (yardLine: from the home side's goal
  // line).
  start?: { team?: { id?: string | number }; yardLine?: number; down?: number; distance?: number };
  /** ESPN's yards for it (college: an intentional grounding's loss, which its text doesn't say). */
  statYardage?: number;
  /** Where it ended (college: its yard line after "to the ALA43"). */
  end?: { team?: { id?: string | number }; yardLine?: number };
}

export const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : null);
export const idOf = (v: unknown): string => str(v) ?? "";
/** A number from ESPN's string or number, else null ("", "-", "--"). */
export const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && /^[+-]?\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** A made-attempted pair from ESPN's "6-10" (or "27/40"), else null. */
export const pair = (v: unknown): [number, number] | null => {
  const m = /^\s*(\d+)\s*[-/]\s*(\d+)\s*$/.exec(String(v ?? ""));
  return m ? [Number(m[1]), Number(m[2])] : null;
};

/* ---- What every sport's vocabulary and readers share. ---- */

/** A count stat (it adds, and plays carry it), in a stat group. */
export const count = (key: string, label: string, short: string, noun: string, group: string, better: Better = "higher", known?: "final"): StatDef => ({ key, label, short, noun, group, better, kind: "count", ...(known ? { known } : {}) });
/** A position in a position group. */
export const position = (key: string, label: string, group: string): Position => ({ key, label, group });
/** Someone's count of a stat, 0 when they have none. */
export const val = (s: Stats, k: string) => s[k] ?? 0;
/** A rate's fraction, null when there's nothing to divide by (an AVG with no at-bats). */
export const ratio = (top: number, bottom: number) => (bottom > 0 ? top / bottom : null);

/** Everyone in a game's box score, by ESPN's athlete id, to their team's id: who's on which side. */
export function rosterOf(summary: EspnSummary): Map<string, string> {
  const out = new Map<string, string>();
  for (const side of summary.boxscore?.players ?? []) {
    for (const table of side.statistics ?? []) {
      for (const row of table.athletes ?? []) if (idOf(row.athlete?.id)) out.set(idOf(row.athlete?.id), idOf(side.team?.id));
    }
  }
  return out;
}

/** A play's deltas with nothing empty: no person with no counts, no zero. */
export function cleanDeltas(deltas: Record<string, Stats>): Record<string, Stats> {
  const out: Record<string, Stats> = {};
  for (const [who, d] of Object.entries(deltas)) {
    const s = addStats({}, d);
    if (who && Object.keys(s).length) out[who] = s;
  }
  return out;
}

/** Add `d` into `into` (a person's counts), dropping zeros. */
export function addStats(into: Stats, d: Stats): Stats {
  for (const [k, v] of Object.entries(d)) {
    if (!v) continue;
    const n = (into[k] ?? 0) + v;
    if (n) into[k] = n;
    else delete into[k];
  }
  return into;
}

/** A moment (ms) as ISO 8601 without its zero milliseconds ("2026-01-25T05:29:42Z"), the way ESPN writes a wallclock; null for
 *  none. */
export const isoOf = (t: number | null) => (t == null ? null : new Date(t).toISOString().replace(".000Z", "Z"));

/** Someone's counts without the zeros (and anything that isn't a number). */
export const nonzero = (s: Stats): Stats => Object.fromEntries(Object.entries(s).filter(([, v]) => v !== 0 && Number.isFinite(v)));

/** A wallclock as milliseconds, or null. */
export const msOf = (t: string | number | Date | null | undefined): number | null => {
  if (t == null) return null;
  const ms = t instanceof Date ? t.getTime() : typeof t === "number" ? t : Date.parse(t);
  return Number.isFinite(ms) ? ms : null;
};

/**
 * A sport: its vocabulary (groups, positions, stats, periods, locks) and its readers. One subclass per sport (Baseball,
 * Basketball, Football, Hockey), grouped by shape: TeamSport for a box score and timestamped plays; FieldSport for a field of
 * competitors and its standings (golf, racing); BoutSport for one-on-one bouts, a fight card or a tennis event's draws (MMA,
 * tennis).
 */
export abstract class Sport {
  /** ESPN's sport slug, the first half of its league paths ("baseball" of "baseball/mlb"): its defaults' key. A slug's sports
   *  share it (basketball's NBA and college's two), so a sport is found by its league (index.ts's sportOf), never its id alone. */
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly groups: PositionGroup[];
  abstract readonly positions: Position[];
  /** The stat groups, in the order they show ("batting", "pitching"), each with its label. */
  abstract readonly statGroups: { key: string; label: string }[];
  abstract readonly stats: StatDef[];
  abstract readonly periods: Periods;
  abstract readonly lock: LockCadence;
  /** The ESPN leagues it reads (the second half of "basketball/nba"), when not every league of its sport plays the same way
   *  (college basketball plays halves); null for every one. */
  readonly leagues: string[] | null = null;

  private byKey: Map<string, StatDef> | null = null;

  /** A stat by its key, or null. */
  stat(key: string): StatDef | null {
    if (!this.byKey) this.byKey = new Map(this.stats.map((s) => [s.key, s]));
    return this.byKey.get(key) ?? null;
  }

  position(key: string): Position | null {
    return this.positions.find((p) => p.key === key) ?? null;
  }

  /** A position from ESPN's abbreviation: the sports' keys are ESPN's own ("SS", "PG", "LW"). */
  positionKey(abbreviation: string | null | undefined): string | null {
    return str(abbreviation)?.toUpperCase() ?? null;
  }

  /** The stats a spec can name, for the game spec's context pack (ctx.stats: [{ key, label: "home run" }]). */
  specStats(): { key: string; label: string }[] {
    return this.stats.filter((s) => s.kind !== "rate").map((s) => ({ key: s.key, label: s.noun }));
  }

  /**
   * Someone's counts in one game with the derived and rate stats worked out from them (TB, IP, AVG), for the stat groups they
   * have counts in (a hitter has no innings pitched); one that can't be said (an AVG with no at-bats) is left out. Over several
   * games, add each game's (a quality start is a game's), and work rates out from the counts added.
   */
  full(counts: Stats): Stats {
    const out: Stats = { ...counts };
    const groups = new Set(Object.keys(counts).map((k) => this.stat(k)?.group));
    for (const s of this.stats) {
      if (s.kind === "count" || !s.of || !groups.has(s.group)) continue;
      const v = s.of(counts);
      if (v != null && Number.isFinite(v)) out[s.key] = v;
    }
    return out;
  }

  /** Where a play is, in the sport's words: "2nd quarter, 5:32", "overtime", "2nd overtime" (Baseball's own: "Top 3rd";
   *  Hockey's: "5:32 into the 2nd period", "shootout"). */
  where(play: Pick<Play, "period" | "half" | "clock" | "shootout">): string {
    const over = play.period - this.periods.regulation;
    const name = over > 1 ? `${ordinal(over)} ${this.periods.extra}` : over === 1 ? this.periods.extra : `${ordinal(play.period)} ${this.periods.word}`;
    return play.clock ? `${name}, ${play.clock}` : name;
  }
}

/**
 * Plays in ESPN's order with times that never go back: each play's `at` is its own, or the play before it's when that's later
 * (or when it has none). ESPN's sequence is the game's order, and its stamps can step back minutes (a pitching change stamped
 * in the break, filed after the next inning's start), so a moment's plays are always the first so many (TeamSport.reduce).
 */
export function inOrder(plays: Play[]): Play[] {
  let last: number | null = null;
  for (const p of plays) {
    const t = msOf(p.at);
    if (last != null && (t == null || t < last)) p.at = isoOf(last);
    else if (t != null) last = t;
  }
  return plays;
}


/**
 * A team sport: a box score and every play timestamped (football, baseball, basketball, hockey; soccer's key events in L5).
 * A subclass reads ESPN's summary into a Box (`readBox`) and Plays (`readPlays`); reducing, the final's correction and the
 * timeline are the same for all of them.
 */
export abstract class TeamSport extends Sport {
  /** ESPN's own box score, in the sport's keys; null when the summary has none. */
  abstract readBox(summary: EspnSummary): Box | null;
  /** ESPN's plays, in order (times that never go back: inOrder), each with its stat deltas. `issues` collects what the reader
   *  couldn't read as it should (a run it couldn't place), for checks. */
  abstract readPlays(summary: EspnSummary, issues?: string[]): Play[];

  /**
   * The game as of a moment: the plays up to `at` (their times never go back: inOrder), added up. No `at`: every play. A play
   * with no time (only when none before it has one: a final with no timed plays, its correction) counts only then, so a moment
   * never sees what can't be placed before it. Infinity is the end too; a moment that isn't one (NaN, a date that doesn't parse:
   * a clock stored badly) counts nothing, never the whole game (a later watch's spoiler). `sides` (the teams' ids, from the
   * header: headerTeams) start the score at 0 each, so a game before its first play still has one (a scorebug's 0-0), never the
   * header's own.
   */
  reduce(plays: Play[], at?: string | number | Date | null, sides: string[] = []): GameState {
    const end = at == null || at === Infinity;
    const until = end ? null : msOf(at);
    const state: GameState = { plays: 0, last: null, score: Object.fromEntries(sides.map((id) => [id, 0])), lines: {} };
    if (!end && until == null) return state;
    for (const p of plays) {
      const t = msOf(p.at);
      if (until != null && (t == null || t > until)) break;
      state.plays++;
      state.last = p;
      state.score = { ...p.score };
      for (const [who, d] of Object.entries(p.deltas)) state.lines[who] = addStats(state.lines[who] ?? {}, d);
    }
    for (const [who, s] of Object.entries(state.lines)) if (!Object.keys(s).length) delete state.lines[who];
    return state;
  }

  /**
   * What the final box score says that the plays don't: for each person, every count ESPN's box score has, less what the
   * plays added up to. Counts ESPN's box score doesn't carry (baseball's doubles: its batting lines have none) are left as the
   * plays have them. Empty when the plays tell it all.
   */
  correction(state: GameState, box: Box): Record<string, Stats> {
    const out: Record<string, Stats> = {};
    // Someone the plays credited who isn't in ESPN's box score at all, or is there with no line (a basketball player who
    // didn't play): every count taken back.
    for (const [who, have] of Object.entries(state.lines)) {
      if (box.people[who] && Object.keys(box.people[who].stats).length) continue;
      const d = Object.fromEntries(Object.entries(have).map(([k, v]) => [k, -v]));
      if (Object.keys(d).length) out[who] = d;
    }
    for (const [who, person] of Object.entries(box.people)) {
      const have = state.lines[who] ?? {};
      const d: Stats = {};
      for (const [k, v] of Object.entries(person.stats)) {
        const diff = v - (have[k] ?? 0);
        if (diff) d[k] = diff;
      }
      if (Object.keys(d).length) out[who] = d;
    }
    return out;
  }

  /**
   * The game's plays, and once it's final, the final's correction after them (a play at the last one's time, `final: true`,
   * with the final score), so a finished game reduces to ESPN's own box score whatever the plays missed. Live, just the plays:
   * provisional until the final.
   */
  timeline(summary: EspnSummary): Play[] {
    const plays = this.readPlays(summary);
    const box = this.readBox(summary);
    if (!box?.final) return plays;
    const deltas = this.correction(this.reduce(plays), box);
    const last = plays[plays.length - 1] ?? null;
    const score = Object.fromEntries(box.teams.map((t) => [t.id, t.score]));
    plays.push({ id: `${box.event}:final`, at: last?.at ?? null, period: last?.period ?? this.periods.regulation, half: last?.half ?? null, clock: null, text: "Final", kind: "final", team: null, unit: null, people: Object.keys(deltas), score, deltas, final: true, ...(last?.shootout ? { shootout: true } : {}) });
    return plays;
  }

  /** When each of ESPN's plays (`summary.plays`, in its order) happened: its wallclock, unless a feed's stamps aren't the time
   *  (college baseball's stat crew's). A recording's replay (scripts/dev-test/espn-replay.js) cuts it by them. */
  playTimes(summary: EspnSummary): (string | null)[] {
    return (summary.plays ?? []).map((p) => str(p.wallclock));
  }

  /** The game as of a moment, from ESPN's summary: `reduce(timeline(summary), at)`, its score 0-0 before the first play. */
  stateAt(summary: EspnSummary, at?: string | number | Date | null): GameState {
    return this.reduce(this.timeline(summary), at, headerTeams(summary).map((t) => t.id));
  }
}

/** The box score's two sides from its header: each team's id, name, home or away, score and winner. */
export function headerTeams(summary: EspnSummary): BoxTeam[] {
  const comp = summary.header?.competitions?.[0];
  return (comp?.competitors ?? [])
    .filter((c) => c.team)
    .map((c) => ({
      id: idOf(c.team!.id),
      name: str(c.team!.displayName) ?? "",
      abbreviation: str(c.team!.abbreviation),
      home: c.homeAway === "home" ? true : c.homeAway === "away" ? false : null,
      score: num(c.score) ?? 0,
      winner: typeof c.winner === "boolean" ? c.winner : null,
      stats: {},
    }));
}

/** Whether ESPN's header says the game is over and final. */
export function isFinal(summary: EspnSummary): boolean {
  const st = summary.header?.competitions?.[0]?.status?.type;
  return st?.state === "post" && st?.completed === true;
}

/* ---- A field: golf's tournament, racing's race weekend (L5 part 3). ---- */

/** ESPN's answers for a field's event, asked together: a field has no summary (golf's `summary?event=` is a 404, racing's a 404
 *  or 502). Golf's are its event board (`golf/<tour>/scoreboard/<event>`: every hole, in the order played, where the tour's feed
 *  has them) and its leaderboard (`golf/leaderboard?event=`: places, tee times, who's cut or withdrew, the cut, a playoff).
 *  Racing's are its event board (`racing/<series>/scoreboard/<event>`: each session in finishing order) and, from ESPN's core
 *  API, each session's competitors with their statistics and status (`core`, by the session's id: racing.ts says what's in
 *  them). `_asked`: when they were had (a live answer's poll, a recording's), which is when anything ESPN gives no time for
 *  became known. */
export interface FieldAnswer {
  _asked?: string;
  board?: EspnFieldEvent | { events?: EspnFieldEvent[] };
  leaderboard?: { events?: EspnFieldEvent[] };
  core?: Record<string, EspnCoreSession>;
}

/** One session of a race weekend from ESPN's core API (`sports.core.api.espn.com/v2/sports/racing/leagues/<series>/events/<id>/
 *  competitions/<id>`): its competitors (`/competitors?limit=200`, one call) with each one's statistics (`/competitors/<id>/
 *  statistics`) and, for F1, status (`/competitors/<id>/status`) put in place of ESPN's links (a call each). */
export interface EspnCoreSession {
  competitors?: EspnCoreCompetitor[];
}

export interface EspnCoreCompetitor {
  id?: string | number;
  order?: number;
  /** The grid: where they started the session (a race's or a sprint's). */
  startOrder?: number;
  winner?: boolean;
  vehicle?: { number?: string; manufacturer?: string; team?: string; sponsor?: string };
  statistics?: { splits?: { categories?: { stats?: { name?: string; value?: number }[] }[] } };
  status?: { period?: number; type?: { name?: string; state?: string } };
}

/** ESPN's event on a field's board or leaderboard, only the parts the readers read. */
export interface EspnFieldEvent {
  id?: string | number;
  name?: string;
  date?: string;
  endDate?: string;
  status?: { type?: { state?: string; completed?: boolean; name?: string; detail?: string } };
  /** Golf's: how many rounds, which one the field is cut after and at what (cutCount 0: not made yet), and how it's scored
   *  ("Medal", "Teamstroke"; "Match" is match play, not a field). */
  tournament?: { numberOfRounds?: number; cutRound?: number; cutScore?: number; cutCount?: number; scoringSystem?: { name?: string }; major?: boolean };
  courses?: { id?: string | number; shotsToPar?: number; holes?: { number?: number; shotsToPar?: number }[] }[];
  competitions?: {
    id?: string | number;
    date?: string;
    type?: { abbreviation?: string };
    status?: { period?: number; type?: { state?: string; completed?: boolean; name?: string; detail?: string } };
    scoringSystem?: { name?: string };
    competitors?: EspnFieldCompetitor[];
  }[];
}

/** One line of a competitor's: golf's round (its holes in `linescores`), or a hole (its strokes, and its score to par as ESPN
 *  types it). */
export interface EspnLinescore {
  value?: number;
  displayValue?: string;
  period?: number;
  /** Tennis's set: who won it, and its tiebreak's points (a match tiebreak's too, when ESPN writes it "1-0 (10-8)"). */
  winner?: boolean;
  tiebreak?: number;
  linescores?: EspnLinescore[];
  scoreType?: { name?: string; displayValue?: string };
  par?: number;
  inScore?: number;
  outScore?: number;
  startPosition?: number;
  currentPosition?: number;
  teeTime?: string;
  isPlayoff?: boolean;
  statistics?: { categories?: { stats?: { name?: string; value?: number; displayValue?: string }[] }[] };
}

export interface EspnFieldCompetitor {
  id?: string | number;
  type?: string;
  order?: number;
  winner?: boolean;
  amateur?: boolean;
  earnings?: number;
  athlete?: { id?: string | number; displayName?: string; shortName?: string; flag?: { alt?: string } };
  team?: { id?: string | number; displayName?: string };
  roster?: { athlete?: { id?: string | number; displayName?: string } }[];
  /** The board's: the score to par as text ("-9"); the leaderboard's: the total strokes and their score to par. */
  score?: string | { value?: number; displayValue?: string };
  linescores?: EspnLinescore[];
  statistics?: { name?: string; value?: number; displayValue?: string }[];
  status?: {
    period?: number;
    thru?: number;
    teeTime?: string;
    playoff?: boolean;
    type?: { name?: string; state?: string; completed?: boolean; description?: string; shortDetail?: string };
    position?: { id?: string | number; displayName?: string; isTie?: boolean };
  };
}

/** One of a field's competitors: a golfer, a pair playing as one (golf's team events), a driver. */
export interface FieldEntry {
  id: string;
  name: string;
  type: "athlete" | "team";
  /** A team's people, by ESPN's athlete ids. */
  members: string[];
  /** As ESPN's flag says ("Australia"), or null. */
  country: string | null;
  /** A driver's car: its number and its team as ESPN names it (F1's constructor, NASCAR's team or else its maker). */
  car?: { number: string | null; team: string | null };
}

/** Still in it, or out of it: golf's cut, a withdrawal, a disqualification. */
export type FieldStatus = "in" | "cut" | "wd" | "dq";

/** A competitor's place in the standings at a moment. */
export interface Standing {
  id: string;
  /** 1-based; the tied share it (T9: 9). Null when out of the places (cut, withdrew, disqualified). */
  place: number | null;
  tied: boolean;
  status: FieldStatus;
  /** Once a cut's been made: whether they made it (golf's; a withdrawal who played on after it made it too, one between the
   *  cut and the next round's tee isn't told apart from one before it: ESPN's status says neither). */
  madeCut?: boolean;
}

/** What a field's standings need besides the plays: its competitors, how many parts make it (golf's rounds) and its cut (after
 *  which part, at what score; a null score: not made yet). The team sports' sides, for a field. */
export interface FieldEvent {
  event: string;
  field: string[];
  parts: number;
  cut: { after: number; score: number | null } | null;
}

/** A field event in ESPN's own numbers (a box score's like, FieldSport.readBox): each competitor's counts and parts (golf's
 *  rounds) as ESPN gives them, and its standings. */
export interface FieldBox extends FieldEvent {
  final: boolean;
  people: Record<string, FieldEntry & { stats: Stats; parts: Record<number, Stats>; standing: Standing }>;
  standings: Standing[];
}

/** A field's play: one competitor's (golf's hole), in its part (`period`: golf's round, racing's session), and golf's hole or
 *  racing's session (ESPN's abbreviation: "FP1", "Qual", "SS", "SR", "Race"). The final's correction carries ESPN's final
 *  standings (`places`), which then stand. */
export interface FieldPlay extends Play {
  who: string;
  hole?: number;
  session?: string;
  places?: Standing[];
}

/** A field as of a moment (FieldSport.reduce): everyone's counts, their numbers part by part, their score (golf's to par) and
 *  the standings, each one's place in their line too (POS and the like: placeStats). */
export interface FieldState {
  plays: number;
  last: FieldPlay | null;
  lines: Record<string, Stats>;
  parts: Record<string, Record<number, Stats>>;
  score: Record<string, number>;
  standings: Standing[];
}

/**
 * A field sport: competitors in a field and their standings (golf, racing). ESPN times nothing in a field, so a play's `at` is
 * when it was known by at the latest (golf: a round's holes by the next round's first tee time; racing: a session's results by
 * the next session's start; the last part's at the final, or at a live answer's `_asked`), and a later watch moves part by
 * part. A subclass reads ESPN's answers into a FieldBox
 * and plays and says how its standings rank; reducing, the final's correction and the timeline are the same for all of them.
 */
export abstract class FieldSport extends Sport {
  /** ESPN's own numbers for the event; null when the answers have no field. */
  abstract readBox(answer: FieldAnswer): FieldBox | null;
  /** The event's plays in order (times that never go back: inOrder). `issues` collects what the reader couldn't read as it
   *  should, for checks. */
  abstract readPlays(answer: FieldAnswer, issues?: string[]): FieldPlay[];
  /** The field, its parts and its cut, from the answers; null when they have no field. */
  abstract fieldEvent(answer: FieldAnswer): FieldEvent | null;
  /** The standings from everyone's lines and parts, as the sport ranks them. */
  abstract rank(state: Omit<FieldState, "standings">, event: FieldEvent): Standing[];
  /** What a place puts in someone's line (golf's POS, W, TOP10, CUT; racing's POS, W, PODIUM). */
  abstract placeStats(standing: Standing, event: FieldEvent): Stats;
  /** The stats placeStats puts in a line: the final's correction leaves them to the standings (`places`). */
  abstract readonly placeKeys: string[];

  /** The field as of `at` (as TeamSport.reduce: no `at` or Infinity the end, a moment that isn't one nothing): the plays up to
   *  it added up, part by part, and the standings, which after the final's correction are ESPN's own. */
  reduce(plays: FieldPlay[], at: string | number | Date | null | undefined, event: FieldEvent): FieldState {
    const end = at == null || at === Infinity;
    const until = end ? null : msOf(at);
    const state: FieldState = { plays: 0, last: null, lines: {}, parts: {}, score: Object.fromEntries(event.field.map((id) => [id, 0])), standings: [] };
    let places: Standing[] | null = null;
    if (end || until != null) {
      for (const p of plays) {
        const t = msOf(p.at);
        if (until != null && (t == null || t > until)) break;
        state.plays++;
        state.last = p;
        Object.assign(state.score, p.score);
        if (p.places) places = p.places;
        for (const [who, d] of Object.entries(p.deltas)) {
          state.lines[who] = addStats(state.lines[who] ?? {}, d);
          if (p.final) continue;
          const parts = (state.parts[who] ??= {});
          parts[p.period] = addStats(parts[p.period] ?? {}, d);
        }
      }
    }
    // ESPN's final places as a copy (a consumer sorting them mustn't change the timeline's); a place in the line of whoever's
    // played (before anything's known everyone's level, and nobody's won).
    state.standings = places ? places.map((s) => ({ ...s })) : this.rank(state, event);
    for (const s of state.standings) if (state.lines[s.id]) addStats(state.lines[s.id], this.placeStats(s, event));
    for (const [who, s] of Object.entries(state.lines)) if (!Object.keys(s).length) delete state.lines[who];
    return state;
  }

  /** What ESPN's numbers say that the plays don't: for each competitor, every count ESPN gives (not a place's: the standings
   *  carry those), less what the plays added up to; and someone the plays credited who isn't in ESPN's field, taken back. */
  correction(state: FieldState, box: FieldBox): Record<string, Stats> {
    const out: Record<string, Stats> = {};
    const placed = new Set(this.placeKeys);
    for (const [who, have] of Object.entries(state.lines)) {
      if (box.people[who]) continue;
      const d = Object.fromEntries(Object.entries(have).filter(([k]) => !placed.has(k)).map(([k, v]) => [k, -v]));
      if (Object.keys(d).length) out[who] = d;
    }
    for (const [who, person] of Object.entries(box.people)) {
      const have = state.lines[who] ?? {};
      const d: Stats = {};
      for (const [k, v] of Object.entries(person.stats)) {
        if (placed.has(k)) continue;
        const diff = v - (have[k] ?? 0);
        if (Math.abs(diff) > 1e-9) d[k] = diff;
      }
      if (Object.keys(d).length) out[who] = d;
    }
    return out;
  }

  /** The event's plays and, once it's final, the final's correction after them (at the last play's time, with ESPN's final
   *  standings), so a finished event reduces to ESPN's own numbers and places. Live, the plays: provisional until the final. */
  timeline(answer: FieldAnswer): FieldPlay[] {
    const plays = this.readPlays(answer);
    const box = this.readBox(answer);
    if (!box?.final) return plays;
    const deltas = this.correction(this.reduce(plays, null, box), box);
    const last = plays[plays.length - 1] ?? null;
    plays.push({ id: `${box.event}:final`, who: "", at: last?.at ?? null, period: last?.period ?? box.parts, half: null, clock: null, text: "Final", kind: "final", team: null, unit: null, people: Object.keys(deltas), score: {}, deltas, final: true, places: box.standings });
    return plays;
  }

  /** The event as of a moment, from ESPN's answers. */
  stateAt(answer: FieldAnswer, at?: string | number | Date | null): FieldState {
    return this.reduce(this.timeline(answer), at, this.fieldEvent(answer) ?? { event: "", field: [], parts: 0, cut: null });
  }
}

/** A field's event from ESPN's answers: the board's or the leaderboard's (golf's `scoreboard/<event>` is the event itself; a
 *  tour's `scoreboard` a list of them, two in a week with an opposite-field event: the leaderboard's, by its id). */
export function fieldEventOf(answer: FieldAnswer, which: "board" | "leaderboard"): EspnFieldEvent | null {
  const a = answer[which] as (EspnFieldEvent & { events?: EspnFieldEvent[] }) | undefined;
  if (!a) return null;
  if (!a.events) return a;
  const id = which === "board" ? answer.leaderboard?.events?.[0]?.id : null;
  return (id != null ? a.events.find((e) => String(e.id) === String(id)) : null) ?? a.events[0] ?? null;
}

/* ---- Bouts: MMA's fight night (L5 part 4a) and a tennis event's draws (4b). ---- */

/** ESPN's answers for a fight card, asked together: a card has no summary (`mma/<league>/summary?event=` is a 404). Its board
 *  (`mma/<league>/scoreboard/<event>`: the bouts in the order fought, each fighter, who won, the round and time it ended, the
 *  judges' scores), its FightCenter (`site.web.api.espn.com/apis/common/v3/sports/mma/<league>/fightcenter/<event>`: each bout's
 *  result and how, each fighter's totals, the card's segments), and from ESPN's core API each bout's rounds as ESPN describes
 *  them (`event`: its event's competitions) and its status, timed plays and each fighter's statistics (`core`, by the bout's
 *  id): mma.ts says what's in them. A tennis event is its board alone (`tennis/<tour>/scoreboard/<event>`: every draw's matches
 *  in `groupings`): tennis.ts says what's in it. `_asked`: when they were had (a live answer's poll, a recording's). */
export interface BoutAnswer {
  _asked?: string;
  board?: EspnBoutCard;
  fightcenter?: { cards?: Record<string, { name?: string; competitions?: EspnBoutCompetition[] }> } | null;
  event?: { competitions?: { id?: string | number; description?: string | null; format?: { regulation?: { periods?: number; clock?: number } } }[] } | null;
  core?: Record<string, EspnBoutCore>;
}

/** A card on ESPN's board, only the parts the readers read: a fight card's bouts in `competitions`, a tennis event's matches in
 *  its draws (`groupings`: men's singles, women's doubles...), `major` a Grand Slam's. */
export interface EspnBoutCard {
  id?: string | number;
  name?: string;
  date?: string;
  endDate?: string;
  major?: boolean;
  status?: { type?: { state?: string; completed?: boolean; name?: string; detail?: string } };
  competitions?: EspnBoutCompetition[];
  groupings?: { grouping?: { id?: string | number; slug?: string; displayName?: string }; competitions?: EspnBoutCompetition[] }[];
}

/** How a bout ended, as ESPN names it (`kotko`, `decision---split`, `submission-armbar`) and says it ("Punches"). */
export interface EspnBoutResult {
  name?: string;
  displayName?: string;
  shortDisplayName?: string;
  description?: string;
  target?: { name?: string };
}

export interface EspnBoutStatus {
  /** Seconds into the round it's in or ended in (the FightCenter's as text: "300.0"). */
  clock?: number | string;
  /** The same as a time into the round ("4:59"). */
  displayClock?: string;
  period?: number;
  type?: { state?: string; completed?: boolean; name?: string; detail?: string };
  result?: EspnBoutResult;
}

/** A bout on the board or the FightCenter. */
export interface EspnBoutCompetition {
  id?: string | number;
  date?: string;
  type?: { abbreviation?: string; text?: string };
  /** A title on the line ("UFC Interim Lightweight Title"): the FightCenter's. */
  types?: { id?: string | number; text?: string }[];
  status?: EspnBoutStatus;
  format?: { regulation?: { periods?: number; clock?: number } };
  /** The FightCenter's: the card's segment ("main", "prelims1"), the bout's number counted from the main event (1), its note
   *  ("Lightweight - Main Event - Title Fight") and the judges' scores as text ("48-47 | 49-46 | 49-46"). */
  cardSegment?: { name?: string; description?: string };
  matchNumber?: number;
  note?: string;
  judgesScores?: string;
  competitors?: EspnBoutCompetitor[];
  /** Tennis's: whether `date` is a real start (false: a match not yet scheduled, at ESPN's placeholder, the day's 04:00 UTC), the
   *  draw's round ("Quarterfinal", "Qualifying Final", "Group Stage"), the court, ESPN's result in words ("Jerome Kym (SUI) bt
   *  (1) Ben Shelton (USA) 6-3 6-7 (4-7) 7-6 (7-1)"), a match suspended and resumed. */
  timeValid?: boolean;
  round?: { id?: string | number; displayName?: string };
  venue?: { fullName?: string; court?: string };
  notes?: { text?: string; type?: string }[];
  wasSuspended?: boolean;
}

export interface EspnBoutCompetitor {
  id?: string | number;
  order?: number;
  winner?: boolean;
  /** Tennis's: "athlete", or "team" for a doubles pair (its id its two athletes' joined, "1627-2695", its people in `roster`), and
   *  its seed (`curatedRank.current`). */
  type?: string;
  curatedRank?: { current?: number };
  roster?: { displayName?: string; athletes?: { displayName?: string; flag?: { alt?: string } }[] };
  athlete?: { displayName?: string; flag?: { alt?: string } };
  /** The board's: the judges' scores, each judge's under its one line (`linescores[0].linescores`); tennis's sets, a line each
   *  (its games, who won it, its tiebreak's points). */
  linescores?: EspnLinescore[];
  /** The FightCenter's: the fighter's totals ("144/254"). */
  stats?: { name?: string; value?: number | string; displayValue?: string }[];
}

/** A bout from ESPN's core API: its status (with its result), its plays (`.../competitions/<id>/plays`: each with its round,
 *  clock and wallclock, never whose it is) and each fighter's statistics (`.../competitors/<id>/statistics`: their totals). */
export interface EspnBoutCore {
  status?: EspnBoutStatus | null;
  plays?: EspnBoutPlay[];
  competitors?: { id?: string | number; order?: number; winner?: boolean; statistics?: { splits?: { categories?: { stats?: { name?: string; value?: number }[] }[] } } }[];
}

export interface EspnBoutPlay {
  id?: string | number;
  sequenceNumber?: string | number;
  type?: { id?: string | number; text?: string };
  period?: { number?: number };
  clock?: { value?: number; displayValue?: string };
  wallclock?: string;
}

/** One bout on a card. */
export interface Bout {
  /** ESPN's competition id. */
  id: string;
  /** Its place on the card, 1 the first fought (ESPN's board lists them so); the main event is the last. */
  order: number;
  /** Its two sides, by ESPN's athlete ids, in ESPN's order (`order` 1 first). */
  sides: string[];
  /** The rounds it's scheduled for (3, or 5 for a main event or a title) and each one's length in seconds; `overtime`: a
   *  tournament's extra round if it's level after them (its length the last of `lengths`). */
  rounds: number;
  lengths: number[];
  overtime: boolean;
  /** The card's segment as ESPN names it ("main", "prelims1", "prelims2"), or null. */
  segment: string | null;
  main: boolean;
  /** A title on the line. */
  title: boolean;
  /** ESPN's scheduled start: its segment's, not its own (MMA's); tennis's its own, as ESPN lists it. */
  start: string | null;
  /** The sport's position key for it (MMA's weight class, tennis's draw: men's singles), or null. */
  class: string | null;
  /** Where it is in a draw (tennis's), or none (a fight card's bouts aren't in one). */
  place?: DrawPlace | null;
  /** Each side's seed in its draw, as `sides` (null: unseeded); tennis's. */
  seeds?: (number | null)[];
}

/** Where a bout is in a draw (tennis's): the draw (ESPN's slug: "mens-singles"), its round as ESPN names it ("Quarterfinal"), how
 *  many rounds it is from the draw's final (1 the final; null in qualifying, a group stage or a round ESPN doesn't name), and
 *  whether it's qualifying or a group stage (the ATP and WTA Finals' round robin). */
export interface DrawPlace {
  draw: string;
  round: string | null;
  fromFinal: number | null;
  qualifying: boolean;
  group: boolean;
}

/** A card's bouts in the order fought, and everyone on it: a card's field. */
export interface BoutCard {
  event: string;
  bouts: Bout[];
  field: string[];
}

export type BoutOutcome = "win" | "draw" | "nc";

/** How a bout ended. */
export interface BoutResult {
  bout: string;
  outcome: BoutOutcome;
  /** The winner and the loser, by ESPN's athlete ids; null for a draw or a no contest. */
  winner: string | null;
  loser: string | null;
  /** How it was won, as the sport's stat key (MMA's KO, SUB, UD, SD, MD, DEC, DQ); null for a draw, a no contest or a win ESPN
   *  doesn't say how of. */
  method: string | null;
  /** ESPN's words for it ("Punches", "Rear Naked Choke"), or null. */
  how: string | null;
  /** Where it ended: the round and the time into it ("4:59"). */
  round: number | null;
  time: string | null;
  /** The judges' scores, each [the first side's, the second's] (Bout.sides); empty when it didn't go to them. */
  cards: number[][];
  /** Tennis's sets, each in Bout.sides' order. */
  sets?: SetScore[];
}

/** A tennis set: each side's games and tiebreak points (a match tiebreak is a set of one game, "1-0 (10-8)"), in Bout.sides'
 *  order; who won it (0 or 1, the side's index), null while it's unfinished (on, or the set a retirement stopped). */
export interface SetScore {
  games: number[];
  tiebreak: (number | null)[] | null;
  winner: number | null;
  /** A match tiebreak (doubles' deciding set, to 10 points), however ESPN wrote it. */
  matchTiebreak: boolean;
}

/** A card in ESPN's own numbers (BoutSport.readBox): each fighter's totals with their result's counts (over every bout they fought
 *  on it: a one-night tournament's semifinal and final), and the results. */
export interface BoutBox extends BoutCard {
  final: boolean;
  people: Record<string, FieldEntry & { bouts: string[]; stats: Stats }>;
  results: BoutResult[];
  /** Each bout's own numbers, by who (tennis's: each match's), where the sport gives them apart. */
  byBout?: Record<string, Record<string, Stats>>;
}

/**
 * A bout's play: one of its moments (a round's start, a knockdown, the end, the result), in its round (`period`: 0 before the
 * first or after the last), for one fighter when it's theirs (`who`), its `unit` the bout. `tally`: what it adds to the bout's
 * own count for its round (a knockdown ESPN doesn't say whose). What the reduce reads: any play in a round, or "so-far" (each
 * fighter's totals so far, live), puts the bout on; "bout-end" (each fighter's totals in its deltas) has it over; "result" (how
 * it ended: `result`) done; the final's correction carries ESPN's `results`, which then stand.
 */
export interface BoutPlay extends Play {
  bout: string;
  who: string | null;
  tally?: Stats;
  result?: BoutResult;
  results?: BoutResult[];
}

/** Where a bout is: not started, on, over (its result still to be said: a decision's cards being read), done. */
export type BoutStage = "pre" | "in" | "over" | "done";

export interface BoutLine {
  stage: BoutStage;
  /** The round it's in or ended in. */
  round: number | null;
  /** Its own counts round by round (the plays' tallies: its knockdowns, takedowns). */
  rounds: Record<number, Stats>;
  result: BoutResult | null;
}

/** A card as of a moment (BoutSport.reduce): each fighter's counts, each bout's own (`byBout`: its plays', by who; the final's
 *  correction is the card's, no bout's), each bout's stage, rounds and result, and the results known in the card's order. */
export interface BoutState {
  plays: number;
  last: BoutPlay | null;
  lines: Record<string, Stats>;
  byBout: Record<string, Record<string, Stats>>;
  bouts: Record<string, BoutLine>;
  results: BoutResult[];
}

/**
 * A bout sport: one-on-one bouts, a fight card (MMA) or a tennis event's draws (a player in several matches of it, a match over
 * days apart from the next). ESPN times an MMA bout's moments (its rounds' starts and ends, its knockdowns) but never says whose
 * they are, and gives each fighter's numbers as totals: so a fighter's numbers are known when the bout ends (live, as far as the
 * answers have them, at their `_asked`), its result when it's announced, and a bout ESPN times nothing of when the answers were
 * had (or the next bout's first moment, or for a finished card read with none, hours after it started). ESPN times nothing of a
 * tennis match: it's known when the answers were had, or by the next match either side plays. A later watch moves bout by bout,
 * and round by round where ESPN times the rounds. A subclass reads ESPN's answers into a BoutBox and plays; reducing, the final's
 * correction and the timeline are the same for all of them.
 */
export abstract class BoutSport extends Sport {
  /** ESPN's own numbers for the card; null when the answers have no bouts. */
  abstract readBox(answer: BoutAnswer): BoutBox | null;
  /** The card's plays in order (times that never go back: inOrder). `issues` collects what the reader couldn't read as it
   *  should, for checks. */
  abstract readPlays(answer: BoutAnswer, issues?: string[]): BoutPlay[];
  /** The card's bouts and field from the answers; null when they have none. */
  abstract card(answer: BoutAnswer): BoutCard | null;

  /** The card as of `at` (as TeamSport.reduce: no `at` or Infinity the end, a moment that isn't one nothing): the plays up to it
   *  added up, and each bout's stage, rounds and result; after the final's correction, ESPN's own results. */
  reduce(plays: BoutPlay[], at: string | number | Date | null | undefined, card: BoutCard): BoutState {
    const end = at == null || at === Infinity;
    const until = end ? null : msOf(at);
    const bouts: Record<string, BoutLine> = Object.fromEntries(card.bouts.map((b) => [b.id, { stage: "pre", round: null, rounds: {}, result: null }]));
    const state: BoutState = { plays: 0, last: null, lines: {}, byBout: {}, bouts, results: [] };
    let espn: BoutResult[] | null = null;
    if (end || until != null) {
      for (const p of plays) {
        const t = msOf(p.at);
        if (until != null && (t == null || t > until)) break;
        state.plays++;
        state.last = p;
        for (const [who, d] of Object.entries(p.deltas)) {
          state.lines[who] = addStats(state.lines[who] ?? {}, d);
          if (p.bout) (state.byBout[p.bout] ??= {})[who] = addStats(state.byBout[p.bout][who] ?? {}, d);
        }
        if (p.results) espn = p.results;
        const b = bouts[p.bout];
        if (!b) continue;
        if (p.period > 0) b.round = p.period;
        if (b.stage === "pre" && (p.period > 0 || p.kind === "so-far")) b.stage = "in";
        if (p.kind === "bout-end" && b.stage !== "done") b.stage = "over";
        if (p.tally && p.period > 0) b.rounds[p.period] = addStats(b.rounds[p.period] ?? {}, p.tally);
        if (p.result) {
          b.stage = "done";
          b.result = p.result;
        }
      }
    }
    // ESPN's final results, as copies (a consumer changing them mustn't change the timeline's); else the plays'.
    for (const r of espn ?? []) {
      if (!bouts[r.bout]) continue;
      bouts[r.bout].result = { ...r, cards: r.cards.map((c) => [...c]), ...(r.sets ? { sets: r.sets.map((x) => ({ ...x, games: [...x.games], tiebreak: x.tiebreak ? [...x.tiebreak] : null })) } : {}) };
      bouts[r.bout].stage = "done";
    }
    state.results = card.bouts.map((b) => bouts[b.id].result).filter((r): r is BoutResult => r != null);
    for (const [who, s] of Object.entries(state.lines)) if (!Object.keys(s).length) delete state.lines[who];
    for (const lines of Object.values(state.byBout)) for (const [who, s] of Object.entries(lines)) if (!Object.keys(s).length) delete lines[who];
    return state;
  }

  /** What ESPN's numbers say that the plays don't: for each fighter, every count ESPN gives less what the plays added up to; and
   *  someone the plays credited who isn't on ESPN's card, taken back. */
  correction(state: BoutState, box: BoutBox): Record<string, Stats> {
    const out: Record<string, Stats> = {};
    for (const [who, have] of Object.entries(state.lines)) {
      if (box.people[who]) continue;
      const d = Object.fromEntries(Object.entries(have).map(([k, v]) => [k, -v]));
      if (Object.keys(d).length) out[who] = d;
    }
    for (const [who, person] of Object.entries(box.people)) {
      const have = state.lines[who] ?? {};
      const d: Stats = {};
      for (const k of new Set([...Object.keys(person.stats), ...Object.keys(have)])) {
        const diff = (person.stats[k] ?? 0) - (have[k] ?? 0);
        if (Math.abs(diff) > 1e-9) d[k] = diff;
      }
      if (Object.keys(d).length) out[who] = d;
    }
    return out;
  }

  /** The card's plays and, once it's final, the final's correction after them (at the last play's time, with ESPN's results),
   *  so a finished card reduces to ESPN's own numbers and results. Live, the plays: provisional until the final. */
  timeline(answer: BoutAnswer): BoutPlay[] {
    const plays = this.readPlays(answer);
    const box = this.readBox(answer);
    if (!box?.final) return plays;
    const deltas = this.correction(this.reduce(plays, null, box), box);
    const last = plays[plays.length - 1] ?? null;
    plays.push({ id: `${box.event}:final`, bout: "", who: null, at: last?.at ?? null, period: 0, half: null, clock: null, text: "Final", kind: "final", team: null, unit: null, people: Object.keys(deltas), score: {}, deltas, final: true, results: box.results });
    return plays;
  }

  /** The card as of a moment, from ESPN's answers. */
  stateAt(answer: BoutAnswer, at?: string | number | Date | null): BoutState {
    return this.reduce(this.timeline(answer), at, this.card(answer) ?? { event: "", bouts: [], field: [] });
  }
}
