import { FieldSport, count, fieldEventOf, idOf, inOrder, msOf, num, ordinal, position as pos, str, type EspnCoreCompetitor, type EspnFieldCompetitor, type FieldAnswer, type FieldBox, type FieldEntry, type FieldEvent, type FieldPlay, type FieldState, type FieldStatus, type Play, type Position, type PositionGroup, type Standing, type StatDef, type Stats } from "./sport";

// Racing (Formula 1; NASCAR's Cup, O'Reilly Auto Parts and Truck series; IndyCar): its vocabulary and ESPN's readers
// (docs/PLAN-start-a-game-gpt.md track L, L5 part 3b).
//
// How ESPN records a race weekend (checked 2026-10-30 on every finished event of the 2025 and 2026 seasons of the five series,
// ~13,000 calls): there's no summary (`racing/<series>/summary?event=` is a 404 for F1, a 502 for the others), so an event is
// two kinds of answer asked together (FieldAnswer):
//  - its **board** (`site.api.espn.com/apis/site/v2/sports/racing/<series>/scoreboard/<event>`, one call): its sessions, each
//    with its start (`date`), its status (`period`: its laps) and its competitors in finishing order (`order`, `winner`, the
//    driver's name and flag). F1 lists five sessions (FP1, FP2, FP3, Qual, Race; a sprint weekend FP1, SS (sprint qualifying),
//    SR (the sprint), Qual, Race); NASCAR and IndyCar the race alone, untyped, with whoever didn't qualify listed without an
//    `order`. No laps, times, points, pit stops or statuses.
//  - from ESPN's **core API**, each session's competitors (`.../events/<id>/competitions/<id>/competitors?limit=200`, one call:
//    `order`, `startOrder` the grid, `winner`, the car's number, maker or team, NASCAR's sponsor) and, a call a driver, each
//    one's statistics (`.../competitors/<id>/statistics`: laps completed, laps led, championship points, bonus and penalty
//    points, pit stops, place, wins, `pole` (the place started, not a pole), top 5 and 10, total time, the qualifying runs'
//    times, the fastest lap's number) and F1's status (`.../competitors/<id>/status`: STATUS_CLASSIFIED, STATUS_RETIRED,
//    STATUS_DISQUALIFIED; NASCAR's and IndyCar's are a 400, "not supported"). A finished F1 weekend is ~211 calls and ~410 KB
//    (its four scored sessions; practice's core adds nothing a game reads), a NASCAR or IndyCar race ~40 and ~200 KB.
// Where the series differ, or ESPN's numbers aren't what they say (each read in its data):
//  - **F1's `lapsLead` isn't laps**: 1 to 4 for each driver who led (a race's add up to 1 to 5), so F1 reads only who led
//    (LEDANY). NASCAR's and IndyCar's are laps, and a race's add up to its laps (but in 10 of 226 races: ESPN's own).
//  - **F1's race `championshipPts` are the weekend's**: the sprint's and the race's (with the sprint's taken off, the race's
//    are F1's table by place in 875 of 875 finishes of 2025-26; the sprint's its table in 252 of 252). A practice's, a
//    qualifying's or a sprint qualifying's are a copy of the sprint's or 0: not read.
//  - **The grid is `startOrder`** (the `pole` statistic is the same number): not the qualifying place in 163 of 875 F1 starts
//    (penalties, the pit lane).
//  - **ESPN's `winner`, wins, top 5 and top 10 are all 0 in some races** (25 of 226: 12 Cup races, the exhibitions (the Clash,
//    the Duels, the All-Star Race) but also Martinsville 2025, Pocono and Atlanta 2026; 6 O'Reilly, 5 Truck; IndyCar's Detroit
//    2025 and Mid-Ohio 2026; some of them in IndyCar's Road America 2026): the order says who won. The standings are ESPN's order.
//  - **NASCAR's stage points are one number** (`bonus`, with its finish's in `championshipPts`), never stage by stage;
//    IndyCar's `bonus` is its qualifying points and its laps-led bonuses. Neither has pit stops, a fastest lap or a status:
//    a car out of the race isn't told from one running laps down.
//  - **Whoever didn't qualify** (NASCAR's, IndyCar's) is on the board and in the core without an order, mostly without
//    statistics (4 with laps: ESPN's own); nothing else of theirs is read.
//  - **The championship points are before a penalty's** (`penaltyPts` apart): IndyCar's season standings are their sum less the
//    penalties (2025's and 2026's exactly), F1's their sum (event by event); NASCAR's are reset for its playoffs.
// No session has a running clock in ESPN's answers but its laps, and no lap a time: a session's results are known, at the
// latest, when the next session starts (or the answers' `_asked`, if earlier); the last session's at `_asked`, or for a
// finished event read with none, 12 hours after it started. The grid at the session's start. A later watch moves session by
// session.

const RACE = "race";
const SPRINT = "sprint";
const QUALIFYING = "qualifying";
const PRACTICE = "practice";
const FINISH = "finish";
const POINTS = "points";

/** A place in a session (lower is better). Added over events, its average is the series' own average finish. */
const place = (key: string, label: string, short: string, noun: string, group: string): StatDef => count(key, label, short, noun, group, "lower");
const fromStandings = (key: string, label: string, short: string, noun: string, better: "higher" | "lower" = "higher"): StatDef => ({ key, label, short, noun, group: FINISH, better, kind: "derived" });

const STATS: StatDef[] = [
  // The race.
  place("FIN", "Finishing place", "FIN", "place finished", RACE),
  place("GRID", "Starting place", "ST", "place started", RACE),
  count("PG", "Places gained", "+/-", "place gained", RACE),
  count("POLE", "Poles", "POLE", "start from pole", RACE),
  count("LAPS", "Laps completed", "LAPS", "lap completed", RACE),
  count("LEADLAP", "Finishes on the lead lap", "LL", "finish on the lead lap", RACE),
  count("LED", "Laps led", "LED", "lap led", RACE),
  count("LEDANY", "Races led", "LEDR", "race led", RACE),
  count("MOSTLED", "Races leading the most laps", "ML", "race leading the most laps", RACE),
  count("FL", "Fastest laps of the race", "FL", "fastest lap", RACE),
  count("PITS", "Pit stops", "PIT", "pit stop", RACE, "lower"),
  count("DNF", "Retirements", "DNF", "retirement", RACE, "lower"),
  count("DQ", "Disqualifications", "DQ", "disqualification", RACE, "lower"),
  count("DNQ", "Races not qualified for", "DNQ", "race not qualified for", RACE, "lower"),

  // F1's sprint.
  place("SPR", "Sprint finishing place", "SPR", "sprint place finished", SPRINT),
  place("SGRID", "Sprint starting place", "SST", "sprint place started", SPRINT),
  count("SPG", "Sprint places gained", "S+/-", "sprint place gained", SPRINT),
  count("SLAPS", "Sprint laps completed", "SLAPS", "sprint lap completed", SPRINT),
  count("SFL", "Fastest laps of a sprint", "SFL", "sprint fastest lap", SPRINT),
  count("SDNF", "Sprint retirements", "SDNF", "sprint retirement", SPRINT, "lower"),
  count("SDQ", "Sprint disqualifications", "SDQ", "sprint disqualification", SPRINT, "lower"),

  // F1's qualifying and sprint qualifying.
  place("QUAL", "Qualifying place", "Q", "place qualified", QUALIFYING),
  count("Q2", "Reached Q2", "Q2", "reach of Q2", QUALIFYING),
  count("Q3", "Reached Q3", "Q3", "reach of Q3", QUALIFYING),
  count("QDQ", "Qualifying disqualifications", "QDQ", "qualifying disqualification", QUALIFYING, "lower"),
  place("SQ", "Sprint qualifying place", "SQ", "place in sprint qualifying", QUALIFYING),

  // F1's practice.
  place("FP1", "1st practice place", "FP1", "place in 1st practice", PRACTICE),
  place("FP2", "2nd practice place", "FP2", "place in 2nd practice", PRACTICE),
  place("FP3", "3rd practice place", "FP3", "place in 3rd practice", PRACTICE),

  // From the standings at the moment (the race's order: live, the running order, provisional until the final).
  fromStandings("POS", "Place", "POS", "place", "lower"),
  fromStandings("W", "Wins", "W", "win"),
  fromStandings("PODIUM", "Podiums", "POD", "podium"),
  fromStandings("TOP5", "Top-5 finishes", "T5", "top-5 finish"),
  fromStandings("TOP10", "Top-10 finishes", "T10", "top-10 finish"),

  // The series' own championship points for the event (F1's sprint's and race's; NASCAR's finish and stages; IndyCar's finish
  // and bonuses), before a penalty's (PEN: a season's standings take them off), and NASCAR's and IndyCar's parts of them.
  count("CHPTS", "Championship points", "PTS", "championship point", POINTS),
  count("BONUS", "Bonus points", "BON", "bonus point", POINTS),
  count("PEN", "Penalty points", "PEN", "penalty point", POINTS, "lower"),
];

/** The stats only F1's feed has (its sessions, statuses, pit stops and fastest lap), and only NASCAR's and IndyCar's (laps led
 *  as laps, bonus and penalty points, who didn't qualify). */
const F1_ONLY = ["FL", "PITS", "DNF", "DQ", "SPR", "SGRID", "SPG", "SLAPS", "SFL", "SDNF", "SDQ", "QUAL", "Q2", "Q3", "QDQ", "SQ", "FP1", "FP2", "FP3"];
const COUNTED_ONLY = ["LED", "MOSTLED", "BONUS", "PEN", "DNQ"];

const GROUPS: PositionGroup[] = [{ key: "drivers", label: "Drivers", stats: [RACE, SPRINT, QUALIFYING, PRACTICE, FINISH, POINTS] }];

const POSITIONS: Position[] = [pos("D", "Driver", "drivers")];

/** The stats a place puts in someone's line (Racing.placeStats): the standings', never a play's. */
const PLACE_KEYS = ["POS", "W", "PODIUM", "TOP5", "TOP10"];

/** How long after the last session's start it's surely over, where the answers say nothing later (a finished event read with
 *  no `_asked`): ESPN times no session's end; a race runs 1.5 to 4 hours, longer under a red flag or rain. */
const SESSION_OVER_MS = 12 * 3600_000;

/** How the standings list those in and out: the placed, then the disqualified, then whoever didn't qualify (golf's "cut"). */
const ORDER: Record<FieldStatus, number> = { in: 0, wd: 1, dq: 2, cut: 3 };

/** The sessions ESPN's board types (its abbreviation; NASCAR's and IndyCar's race has none), what they are and their names. */
type SessionKind = "practice" | "qualifying" | "sprint-qualifying" | "sprint" | "race";
const SESSIONS: Record<string, { kind: SessionKind; name: string }> = {
  FP1: { kind: "practice", name: "1st practice" },
  FP2: { kind: "practice", name: "2nd practice" },
  FP3: { kind: "practice", name: "3rd practice" },
  Qual: { kind: "qualifying", name: "qualifying" },
  SS: { kind: "sprint-qualifying", name: "sprint qualifying" },
  SR: { kind: "sprint", name: "the sprint" },
  Race: { kind: "race", name: "the race" },
};

/** A series ESPN carries: its league (the second half of "racing/f1"), its name, and whether its feed is F1's (every session,
 *  statuses, pit stops, a fastest lap) or NASCAR's and IndyCar's (the race, laps led counted, bonus points, who didn't qualify). */
export interface Series {
  league: string;
  name: string;
  feed: "f1" | "counted";
}

/** NASCAR's Cup first: sportById("racing") is the series whose defaults are the sport's own (defaults/racing.json; F1's and
 *  IndyCar's are its `leagues`). */
export const RACING_SERIES: Series[] = [
  { league: "nascar-premier", name: "NASCAR Cup Series", feed: "counted" },
  { league: "nascar-secondary", name: "NASCAR O'Reilly Auto Parts Series", feed: "counted" },
  { league: "nascar-truck", name: "NASCAR Craftsman Truck Series", feed: "counted" },
  { league: "f1", name: "Formula 1", feed: "f1" },
  { league: "irl", name: "IndyCar", feed: "counted" },
];

/** A competitor's statistics from ESPN's core API, by name ("lapsLead": 23). */
export function coreStats(c: EspnCoreCompetitor | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const cat of c?.statistics?.splits?.categories ?? []) for (const s of cat.stats ?? []) if (s.name && num(s.value) != null) out[s.name] = num(s.value)!;
  return out;
}

/** One session of an event, as the readers read it: its board line, its core competitors, its kind, start and period. */
interface Session {
  id: string;
  abbr: string;
  kind: SessionKind | null;
  name: string;
  period: number;
  start: number | null;
  state: string | null;
  laps: number | null;
  board: Map<string, EspnFieldCompetitor>;
  core: Map<string, EspnCoreCompetitor>;
  /** Each competitor's statistics (coreStats), the most laps anyone completed and led, and whether anyone has a place yet. */
  stats: Map<string, Record<string, number>>;
  maxLaps: number;
  maxLed: number;
  placed: boolean;
}

const iso = (t: number | null) => (t == null ? null : new Date(t).toISOString().replace(".000Z", "Z"));
const nonzero = (s: Stats): Stats => Object.fromEntries(Object.entries(s).filter(([, v]) => v !== 0 && Number.isFinite(v)));

export class Racing extends FieldSport {
  readonly id = "racing";
  readonly name: string;
  readonly league: string;
  readonly feed: Series["feed"];
  readonly groups = GROUPS;
  readonly positions = POSITIONS;
  readonly statGroups: { key: string; label: string }[];
  readonly stats: StatDef[];
  readonly periods: { word: string; plural: string; regulation: number; extra: string };
  readonly lock = "event" as const;
  readonly leagues: string[];
  readonly placeKeys = PLACE_KEYS;

  constructor(series: Series) {
    super();
    this.name = series.name;
    this.league = series.league;
    this.feed = series.feed;
    this.leagues = [series.league];
    const left = series.feed === "f1" ? COUNTED_ONLY : F1_ONLY;
    this.stats = STATS.filter((s) => !left.includes(s.key));
    const groups = new Set(this.stats.map((s) => s.group));
    this.statGroups = [
      { key: RACE, label: "Race" },
      { key: SPRINT, label: "Sprint" },
      { key: QUALIFYING, label: "Qualifying" },
      { key: PRACTICE, label: "Practice" },
      { key: FINISH, label: "Finish" },
      { key: POINTS, label: "Points" },
    ].filter((g) => groups.has(g.key));
    this.periods = { word: "session", plural: "sessions", regulation: series.feed === "f1" ? 5 : 1, extra: "" };
  }

  /** "the race", "qualifying", "the sprint", "2nd practice". */
  where(play: Pick<Play, "period" | "half" | "clock" | "shootout"> & { session?: string }): string {
    return SESSIONS[play.session ?? "Race"]?.name ?? play.session ?? `the ${ordinal(play.period)} session`;
  }

  /** The event's sessions in order, each with its board line and its core competitors. */
  private sessions(answer: FieldAnswer, issues: string[] = []): Session[] {
    const board = fieldEventOf(answer, "board");
    const comps = [...(board?.competitions ?? [])].sort((a, b) => (msOf(a.date) ?? 0) - (msOf(b.date) ?? 0));
    return comps.map((c, i) => {
      const id = idOf(c.id);
      // NASCAR's and IndyCar's race is the board's one competition, untyped (every event of 2025-26: a doubleheader is two
      // events); two untyped aren't guessed at.
      const abbr = str(c.type?.abbreviation) ?? (comps.length === 1 ? "Race" : "");
      const known = SESSIONS[abbr];
      if (!known) issues.push(`a session ESPN types "${abbr}" (${id}) isn't read`);
      const board = new Map((c.competitors ?? []).map((x) => [idOf(x.id), x]));
      const core = new Map((answer.core?.[id]?.competitors ?? []).map((x) => [idOf(x.id), x]));
      const stats = new Map([...core].map(([who, x]) => [who, coreStats(x)]));
      const most = (k: string) => Math.max(0, ...[...stats.values()].map((x) => x[k] ?? 0));
      return {
        id,
        abbr,
        kind: known?.kind ?? null,
        name: known?.name ?? abbr,
        period: i + 1,
        start: msOf(c.date),
        state: str(c.status?.type?.state),
        laps: num(c.status?.period),
        board,
        core,
        stats,
        maxLaps: most("lapsCompleted"),
        maxLed: most("lapsLead"),
        placed: [...board.values(), ...core.values()].some((x) => num(x.order) != null),
      };
    });
  }

  private entryOf(id: string, ss: Session[]): FieldEntry {
    const b = ss.map((s) => s.board.get(id)).find(Boolean);
    const c = [...ss].reverse().map((s) => s.core.get(id)).find(Boolean);
    return {
      id,
      name: str(b?.athlete?.displayName) ?? id,
      type: "athlete",
      members: [],
      country: str(b?.athlete?.flag?.alt),
      ...(c?.vehicle ? { car: { number: str(c.vehicle.number), team: str(c.vehicle.team) ?? str(c.vehicle.manufacturer) } } : {}),
    };
  }

  /** The event's field: the race's entrants once ESPN lists them, else everyone on the board so far; its sessions as parts. */
  fieldEvent(answer: FieldAnswer): FieldEvent | null {
    const board = fieldEventOf(answer, "board");
    if (!board) return null;
    const ss = this.sessions(answer);
    const race = ss.find((s) => s.kind === "race" && s.board.size);
    const ids = race ? [...race.board.keys()] : [...new Set(ss.flatMap((s) => [...s.board.keys()]))];
    return { event: idOf(board.id), field: ids, parts: ss.length || this.periods.regulation, cut: null };
  }

  /**
   * A session's numbers for a competitor, in the sport's keys: its place (the board's order, else the core's: `place`, a
   * board-less reading, ESPN's `place` statistic), the grid, laps, laps led, pit stops, the fastest lap, F1's statuses, the
   * championship points (`points`: what the caller says they are, F1's race's being the weekend's) and its bonus and penalty
   * points, as the session's kind names them. `espn`: ESPN's own statistics for the place and grid (`place`, `pole`) instead.
   */
  private numbers(s: Session, id: string, points: number | null, espn = false): Stats {
    const b = s.board.get(id);
    const c = s.core.get(id);
    const st = s.stats.get(id) ?? {};
    const at = espn ? num(st.place) ?? num(c?.order) ?? num(b?.order) : num(b?.order) ?? num(c?.order);
    const grid = espn ? num(st.pole) ?? num(c?.startOrder) : num(c?.startOrder);
    const status = str(c?.status?.type?.name);
    const f1 = this.feed === "f1";
    const out: Stats = {};
    if (s.kind === "practice") {
      if (at != null && /^FP[123]$/.test(s.abbr)) out[s.abbr] = at;
      return out;
    }
    if (s.kind === "sprint-qualifying") return at != null ? { SQ: at } : {};
    if (s.kind === "qualifying") {
      if (at != null) out.QUAL = at;
      if ((num(st.qual2TimeMS) ?? 0) > 0) out.Q2 = 1;
      if ((num(st.qual3TimeMS) ?? 0) > 0) out.Q3 = 1;
      if (status === "STATUS_DISQUALIFIED") out.QDQ = 1;
      return out;
    }
    const sprint = s.kind === "sprint";
    const k = (key: string) => (sprint ? (key === "FL" ? "SFL" : `S${key}`) : key);
    if (at != null) out[sprint ? "SPR" : "FIN"] = at;
    if (grid != null) out[k("GRID")] = grid;
    if (at != null && grid != null && status !== "STATUS_DISQUALIFIED") out[k("PG")] = grid - at;
    if (!sprint && grid === 1) out.POLE = 1;
    const laps = num(st.lapsCompleted);
    if (laps != null) out[k("LAPS")] = laps;
    if (!sprint && laps != null && laps > 0 && status !== "STATUS_DISQUALIFIED" && laps >= s.maxLaps) out.LEADLAP = 1;
    const led = num(st.lapsLead) ?? 0;
    if (!sprint) {
      if (led > 0) out.LEDANY = 1;
      if (!f1) {
        out.LED = led;
        if (led > 0 && led === s.maxLed) out.MOSTLED = 1;
      }
    }
    if (f1) {
      if ((num(st.fastestLapNum) ?? 0) > 0) out[k("FL")] = 1;
      if (!sprint && num(st.pitsTaken) != null) out.PITS = num(st.pitsTaken)!;
      if (status === "STATUS_RETIRED") out[k("DNF")] = 1;
      if (status === "STATUS_DISQUALIFIED") out[k("DQ")] = 1;
    } else {
      if (num(st.bonus) != null) out.BONUS = num(st.bonus)!;
      if (num(st.penaltyPts) != null) out.PEN = num(st.penaltyPts)!;
    }
    if (points != null) out.CHPTS = points;
    return nonzero(out);
  }

  /** A session's championship points for a competitor: the sprint's its own; the race's ESPN's less the sprint's (F1's race
   *  number is the weekend's); no other session's (a copy of the sprint's or 0). Null where the core has none. */
  private points(ss: Session[], s: Session, id: string, weekend = false): number | null {
    if (s.kind !== "race" && s.kind !== "sprint") return null;
    const cp = num(s.stats.get(id)?.championshipPts);
    if (cp == null || s.kind === "sprint" || weekend) return cp;
    const sprint = ss.find((x) => x.kind === "sprint" && x.period < s.period);
    return cp - (num(sprint?.stats.get(id)?.championshipPts) ?? 0);
  }

  /** ESPN's own numbers: each session's (its order or `place`, `pole`, laps, laps led, pit stops, the fastest lap, F1's
   *  statuses, bonus and penalty points) and the event's (those of its sessions added, the championship points the race's own
   *  number: F1's the weekend's), ESPN's wins, top 5 and 10 (which the standings carry), and its standings: the race's order,
   *  the disqualified out, whoever didn't qualify (no order) out after them. */
  readBox(answer: FieldAnswer): FieldBox | null {
    const event = this.fieldEvent(answer);
    const board = fieldEventOf(answer, "board");
    if (!event || !board) return null;
    const ss = this.sessions(answer);
    const race = [...ss].reverse().find((s) => s.kind === "race");
    const ids = [...new Set(ss.flatMap((s) => [...s.board.keys(), ...s.core.keys()]))];
    const people: FieldBox["people"] = {};
    for (const id of ids) {
      const stats: Stats = {};
      const parts: Record<number, Stats> = {};
      for (const s of ss) {
        // Whoever's listed for the race without a place didn't qualify: nothing else of theirs is read (ESPN gives a few laps).
        const own = this.dnq(s, id) ? { DNQ: 1 } : this.numbers(s, id, null, true);
        if (!Object.keys(own).length) continue;
        parts[s.period] = own;
        for (const [k, v] of Object.entries(own)) stats[k] = (stats[k] ?? 0) + v;
      }
      const cp = race ? this.points(ss, race, id, true) : null;
      const sprintCp = ss.filter((s) => s.kind === "sprint").reduce((a, s) => a + (num(s.stats.get(id)?.championshipPts) ?? 0), 0);
      if (cp) stats.CHPTS = cp;
      else if (sprintCp) stats.CHPTS = sprintCp;
      const st = race?.stats.get(id) ?? {};
      if (st.wins) stats.W = 1;
      if (st.top5) stats.TOP5 = 1;
      if (st.top10) stats.TOP10 = 1;
      people[id] = { ...this.entryOf(id, ss), stats, parts, standing: this.standingOf(stats.FIN ?? null, stats.DQ ? "dq" : stats.DNQ ? "cut" : "in", id) };
    }
    const standings = Object.values(people)
      .filter((p) => !race || race.board.has(p.id) || race.core.has(p.id))
      .map((p) => ({ p, fin: p.stats.FIN ?? Infinity }))
      .sort((a, b) => ORDER[a.p.standing.status] - ORDER[b.p.standing.status] || a.fin - b.fin)
      .map(({ p }) => p.standing);
    const bst = board.status?.type;
    return { ...event, final: bst?.completed === true && bst?.state === "post", people, standings };
  }

  private standingOf(fin: number | null, status: FieldStatus, id: string, tied = false): Standing {
    return { id, place: status === "in" ? fin : null, tied: status === "in" && fin != null && tied, status };
  }

  /**
   * The event's plays: for each session in order, each competitor's result (its place, laps, laps led and the rest, in the
   * session's own keys), known when the next session starts (or the answers' `_asked`, if earlier; the last session's at
   * `_asked`, or for a finished event with none 12 hours after its start; a live one with none only at the end); a race's or a
   * sprint's grid at its start, with whoever didn't qualify for the race. A session not started has none.
   */
  readPlays(answer: FieldAnswer, issues: string[] = []): FieldPlay[] {
    const event = this.fieldEvent(answer);
    if (!event) return [];
    const ss = this.sessions(answer, issues);
    const board = fieldEventOf(answer, "board");
    const final = board?.status?.type?.completed === true && board?.status?.type?.state === "post";
    const asked = msOf(answer._asked);
    const last = ss[ss.length - 1];
    const end = asked ?? (final && last?.start != null ? last.start + SESSION_OVER_MS : null);
    const knownBy = (s: Session): number | null => {
      const next = ss[s.period]?.start ?? null;
      return next != null && asked != null ? Math.min(next, asked) : next ?? end;
    };
    const plays: FieldPlay[] = [];
    const points: Record<string, number> = {};
    for (const s of ss) {
      if (!s.kind || s.state === "pre" || (!s.board.size && !s.core.size)) {
        // A race or sprint not started yet: its grid where the core has it, at the start (or when asked, if before).
        if (s.kind === "race" || s.kind === "sprint") plays.push(...this.grids(s, asked != null && s.start != null ? Math.min(s.start, asked) : s.start, event.event));
        continue;
      }
      const at = iso(knownBy(s));
      plays.push(...this.grids(s, s.start != null && asked != null ? Math.min(s.start, asked) : s.start, event.event));
      for (const id of new Set([...s.board.keys(), ...s.core.keys()])) {
        const name = this.entryOf(id, ss).name;
        const base = { who: id, half: null, clock: null, team: null, people: [id] as string[], session: s.abbr, period: s.period, unit: `${id}:${s.abbr}` } as const;
        if (this.dnq(s, id)) continue; // with the grid
        const d = this.numbers(s, id, this.points(ss, s, id));
        if (d.CHPTS || d.PEN) points[id] = (points[id] ?? 0) + (d.CHPTS ?? 0) - (d.PEN ?? 0);
        // The grid's own play has the grid; the result its place, laps and the rest.
        delete d.GRID;
        delete d.SGRID;
        delete d.POLE;
        const where = d.FIN ?? d.SPR ?? d.QUAL ?? d.SQ ?? d[s.abbr];
        const text = where != null ? `${name}: ${ordinal(where)} in ${s.name}${d.DNF || d.SDNF ? " (retired)" : d.DQ || d.SDQ || d.QDQ ? " (disqualified)" : ""}` : `${name} in ${s.name}`;
        plays.push({ ...base, id: `${event.event}:${id}:${s.abbr}`, at, text, kind: `${s.kind}-result`, score: { [id]: points[id] ?? 0 }, deltas: Object.keys(d).length ? { [id]: d } : {} });
      }
    }
    // Times never go back (a session's known-by is the next one's start, its grid's that start); a play with no time (a live
    // answer's last session with no `_asked`) comes last: it counts only at the end.
    const timed = plays.filter((p) => p.at != null).sort((a, b) => a.period - b.period || (a.kind.endsWith("grid") ? 0 : 1) - (b.kind.endsWith("grid") ? 0 : 1));
    return [...(inOrder(timed) as FieldPlay[]), ...plays.filter((p) => p.at == null)];
  }

  /** Whether a competitor's listed for NASCAR's or IndyCar's race without a place once others have one: didn't qualify (before
   *  the race's order is out, a live answer's first, nobody is). */
  private dnq(s: Session, id: string): boolean {
    return s.kind === "race" && this.feed !== "f1" && s.state !== "pre" && s.placed && (s.board.has(id) || s.core.has(id)) && num(s.board.get(id)?.order) == null && num(s.core.get(id)?.order) == null;
  }

  /** A race's or a sprint's grid (the core's `startOrder`, a pole for the race's first), and for NASCAR's and IndyCar's race,
   *  whoever's listed without a place (didn't qualify), at its start. Nothing where the core has no grid. */
  private grids(s: Session, start: number | null, event: string): FieldPlay[] {
    if (s.kind !== "race" && s.kind !== "sprint") return [];
    const out: FieldPlay[] = [];
    const at = iso(start);
    const sprint = s.kind === "sprint";
    // In grid order, whoever has none (didn't qualify, listed on the board or in the core) after.
    const ids = [...new Set([...s.core.keys(), ...s.board.keys()])];
    const gridOf = (id: string) => num(s.core.get(id)?.startOrder);
    for (const id of ids.sort((x, y) => (gridOf(x) ?? Infinity) - (gridOf(y) ?? Infinity))) {
      const grid = gridOf(id);
      const base = { who: id, half: null, clock: null, team: null, people: [id] as string[], session: s.abbr, period: s.period, unit: `${id}:${s.abbr}`, at, score: {} } as const;
      if (this.dnq(s, id)) {
        out.push({ ...base, id: `${event}:${id}:${s.abbr}:dnq`, text: `${str(s.board.get(id)?.athlete?.displayName) ?? id} didn't qualify`, kind: "dnq-grid", deltas: { [id]: { DNQ: 1 } } });
      } else if (grid != null) {
        const d: Stats = sprint ? { SGRID: grid } : { GRID: grid, ...(grid === 1 ? { POLE: 1 } : {}) };
        out.push({ ...base, id: `${event}:${id}:${s.abbr}:grid`, text: `${str(s.board.get(id)?.athlete?.displayName) ?? id} starts ${ordinal(grid)}${sprint ? " in the sprint" : ""}`, kind: sprint ? "sprint-grid" : "grid", deltas: { [id]: d } });
      }
    }
    return out;
  }

  /**
   * Racing's standings: the race's order (the running order live, provisional until the final); the disqualified out (their
   * place in ESPN's order kept as FIN), whoever didn't qualify out after them; before the race has an order, nobody placed.
   */
  rank(state: Omit<FieldState, "standings">, event: FieldEvent): Standing[] {
    const ids = [...new Set([...event.field, ...Object.keys(state.lines).filter((id) => state.lines[id].FIN != null || state.lines[id].DNQ)])];
    const line = (id: string) => state.lines[id] ?? {};
    const status = (id: string): FieldStatus => (line(id).DQ ? "dq" : line(id).DNQ ? "cut" : "in");
    const fin = (id: string) => line(id).FIN ?? null;
    const sorted = ids.map((id, i) => ({ id, i })).sort((a, b) => ORDER[status(a.id)] - ORDER[status(b.id)] || (fin(a.id) ?? Infinity) - (fin(b.id) ?? Infinity) || a.i - b.i);
    const seen = new Map<number, number>();
    for (const { id } of sorted) if (status(id) === "in" && fin(id) != null) seen.set(fin(id)!, (seen.get(fin(id)!) ?? 0) + 1);
    return sorted.map(({ id }) => this.standingOf(fin(id), status(id), id, (seen.get(fin(id) ?? -1) ?? 0) > 1));
  }

  placeStats(standing: Standing): Stats {
    const out: Stats = {};
    const p = standing.place;
    if (p == null) return out;
    out.POS = p;
    if (p === 1) out.W = 1;
    if (p <= 3) out.PODIUM = 1;
    if (p <= 5) out.TOP5 = 1;
    if (p <= 10) out.TOP10 = 1;
    return out;
  }
}

