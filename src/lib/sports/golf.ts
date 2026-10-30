import { FieldSport, addStats, count, fieldEventOf, idOf, inOrder, msOf, num, ordinal, position as pos, str, val as n, type EspnFieldCompetitor, type EspnFieldEvent, type EspnLinescore, type FieldAnswer, type FieldBox, type FieldEntry, type FieldEvent, type FieldPlay, type FieldState, type FieldStatus, type Play, type Position, type PositionGroup, type Standing, type StatDef, type Stats } from "./sport";

// Golf (stroke play: the PGA Tour, the LPGA, the DP World Tour, LIV, PGA Tour Champions, the Korn Ferry Tour, the Olympics): its
// vocabulary and ESPN's readers (docs/PLAN-start-a-game-gpt.md track L, L5 part 3).
//
// How ESPN records a tournament (checked 2026-10-30 on every finished 2026 event of six tours): there's no summary
// (`golf/<tour>/summary?event=` is a 404), so a tournament is two answers asked together (FieldAnswer):
//  - its **board** (`golf/<tour>/scoreboard/<event>`): each competitor's rounds, each with its strokes (`value`), its score to
//    par (`displayValue`) and, where the tour's feed has them, its holes in the order played (a back-nine start's 10 to 18 then
//    1 to 9): each hole's strokes and its score to par as ESPN types it ("E", "-1", "+2" up to "+3"; "OTHER" for four over or
//    worse; and in some events typed wrong: the 2026 Chubb Classic's 2 on a par 3 is "+2"), plus the round's counts (birdies,
//    bogeys, bunkers, double bogeys, eagles or better, pars, the tee time in Eastern time labelled PDT), unnamed, in that order,
//    and all 0 in some events (the U.S. Open's, The Open's, the Zurich's). The PGA Tour, PGA Tour Champions and the Korn Ferry
//    Tour have holes; the LPGA, the DP World Tour and LIV only rounds.
//  - its **leaderboard** (`golf/leaderboard?event=`): each competitor's place ("T9", "-" when out), status (finished; cut,
//    withdrawn or disqualified, all typed STATUS_CUT and told apart by `shortDetail`: CUT, WD, DQ; `playoff` for those in one),
//    rounds with their tee times (ISO, right), their front and back nines (`outScore`, `inScore`) and two places: the place a
//    round started from (`startPosition`: the places after the round before, among those who play it) and `currentPosition`
//    (the place when each one finished the round, kept as it was then in some events); earnings and the tour's season points
//    (`cupPoints`: the FedEx Cup's); the courses with each hole's par; the tournament's rounds, its cut (after which round; the
//    score ESPN gives isn't always the line: the 2026 Turkish Airlines Open's says +2 and cut everyone at +2, so who's cut is
//    its statuses') and its scoring ("Medal"; the Zurich Classic's "Teamstroke", pairs as one competitor; the Presidents Cup's
//    "Match", match play, not a field: not read); a playoff as a round of its own (`isPlayoff`), its holes listed in some
//    events (with their par), in others only the winner's or none: its places say who won.
// No hole has a time, anywhere (the board, the leaderboard, a player's summary, the core API): a round's tee times are the only
// clock. So a round's holes are known, at the latest, when the next round begins (a round is over before the next one starts:
// in every event cached, the last tee time of a round was 2.8 to 23 hours before the next round's first, LIV's suspended third
// round resumed on the Sunday morning included), and the last round's when the answers were had (`_asked`, a live answer's) or
// at the end. A later watch moves round by round.

const HOLES = "holes";
const ROUNDS = "rounds";
const PLAYOFF = "playoff";
const FINISH = "finish";
const MONEY = "money";

const fromStandings = (key: string, label: string, short: string, noun: string, better: "higher" | "lower" = "higher"): StatDef => ({ key, label, short, noun, group: FINISH, better, kind: "derived" });

const STATS: StatDef[] = [
  count("STR", "Strokes", "STR", "stroke", HOLES, "lower"),
  count("TOPAR", "Score to par", "TO PAR", "stroke over par", HOLES, "lower"),
  count("HOLES", "Holes played", "HOLES", "hole played", HOLES),
  // Three or more under par on a hole (a 2 on a par 5, a hole in one on a par 4). ESPN's board counts them as eagles.
  count("ALB", "Double eagles", "DE", "double eagle", HOLES),
  count("EAG", "Eagles", "EAG", "eagle", HOLES),
  count("BIR", "Birdies", "BIR", "birdie", HOLES),
  count("PAR", "Pars", "PAR", "par", HOLES),
  count("BOG", "Bogeys", "BOG", "bogey", HOLES, "lower"),
  count("DBL", "Double bogeys", "DBL", "double bogey", HOLES, "lower"),
  count("WORSE", "Triple bogeys or worse", "3B+", "triple bogey or worse", HOLES, "lower"),
  count("HIO", "Holes in one", "HIO", "hole in one", HOLES),

  // A round's, on its 18th hole: what the whole round says.
  count("RND", "Rounds played", "RND", "round", ROUNDS),
  count("BFR", "Bogey-free rounds", "BFR", "bogey-free round", ROUNDS),
  count("U70", "Rounds under 70", "U70", "round under 70", ROUNDS),
  count("UPAR", "Rounds under par", "UPAR", "round under par", ROUNDS),
  // The round's longest run of birdies or better, as Yahoo's streak bonus counts it (only the longest counts).
  count("BS3", "Rounds whose longest birdie streak is three", "BS3", "streak of three birdies", ROUNDS),
  count("BS4", "Rounds whose longest birdie streak is four", "BS4", "streak of four birdies", ROUNDS),
  count("BS5", "Rounds whose longest birdie streak is five", "BS5", "streak of five birdies", ROUNDS),
  count("BS6", "Rounds with six or more birdies in a row", "BS6+", "streak of six or more birdies", ROUNDS),
  { key: "BS", label: "Rounds with three or more birdies in a row", short: "BS", noun: "birdie streak", group: ROUNDS, better: "higher", kind: "derived", of: (s) => n(s, "BS3") + n(s, "BS4") + n(s, "BS5") + n(s, "BS6") },

  // A playoff decides the places only: its holes aren't the tournament's strokes or birdies (Yahoo: they score nothing).
  count("PO", "Playoffs", "PO", "playoff", PLAYOFF),
  count("POW", "Playoffs won", "POW", "playoff won", PLAYOFF),
  count("POH", "Playoff holes", "PO H", "playoff hole", PLAYOFF),
  count("POSTR", "Playoff strokes", "PO STR", "playoff stroke", PLAYOFF, "lower"),

  // From the standings at the moment (live, the place now: provisional until the final; then ESPN's).
  fromStandings("POS", "Place", "POS", "place", "lower"),
  fromStandings("W", "Wins", "W", "win"),
  fromStandings("TOP5", "Top-5 finishes", "T5", "top-5 finish"),
  fromStandings("TOP10", "Top-10 finishes", "T10", "top-10 finish"),
  fromStandings("TOP20", "Top-20 finishes", "T20", "top-20 finish"),
  fromStandings("TOP25", "Top-25 finishes", "T25", "top-25 finish"),
  fromStandings("CUT", "Cuts made", "CUT", "made cut"),
  // ESPN's statuses', as a withdrawal's: at the cut round's end.
  count("MC", "Missed cuts", "MC", "missed cut", FINISH, "lower"),
  count("WD", "Withdrawals", "WD", "withdrawal", FINISH, "lower"),
  count("DQ", "Disqualifications", "DQ", "disqualification", FINISH, "lower"),
  // Through a cut but not on to the last round (PGA Tour Champions' PURE Insurance Championship): placed after everyone who
  // finished, by their score.
  count("MDF", "Made the cut, didn't finish", "MDF", "made cut, didn't finish", FINISH, "lower"),

  count("EARN", "Earnings (dollars)", "EARN", "dollar won", MONEY, "higher", "final"),
  // The tour's season race: the FedEx Cup's points on the PGA Tour, the Race to the CME Globe's on the LPGA.
  count("CUPPTS", "Season points", "PTS", "season point", MONEY, "higher", "final"),
];

const GROUPS: PositionGroup[] = [{ key: "golfers", label: "Golfers", stats: [HOLES, ROUNDS, PLAYOFF, FINISH, MONEY] }];

const POSITIONS: Position[] = [pos("G", "Golfer", "golfers"), pos("TEAM", "Team", "golfers")];

/** How the standings list those in and out (Golf.rank, readBox): the placed, then the cut, the withdrawn, the disqualified. */
const ORDER: Record<FieldStatus, number> = { in: 0, cut: 1, wd: 2, dq: 3 };

/** The fewest strokes an 18-hole round can be: no tour round has been under 57, and a withdrawal's partial rounds that ESPN lists
 *  (where its tour gives rounds only) are 7 to 39 strokes. */
const FULL_ROUND = 55;

/** How long after a round's last tee time it's surely over, where the answers say nothing later (a finished event read with
 *  no `_asked`): ESPN times no round's end; a round takes about five hours, a playoff one. */
const ROUND_OVER_MS = 12 * 3600_000;

/** The stats a place puts in someone's line (Golf.placeStats): the standings', never a play's. */
const PLACE_KEYS = ["POS", "W", "TOP5", "TOP10", "TOP20", "TOP25", "CUT"];

/** ESPN's scoring systems that are stroke play: each one's strokes, and a pair's as one (the Zurich Classic's). */
const STROKE_PLAY = ["Medal", "Teamstroke"];

/** The tours that play stroke play. Not TGL and WTGL (simulator match play, teams against teams: a bout's shape). */
export const GOLF_LEAGUES = ["pga", "lpga", "eur", "liv", "champions-tour", "ntw", "mens-olympics-golf", "womens-olympics-golf"];

/** A score to par as ESPN writes it ("E", "-6", "+2") as a number; null for anything else ("-", "OTHER"). */
export function toParOf(v: unknown): number | null {
  const s = String(v ?? "").trim();
  if (s === "E") return 0;
  return /^[+-]\d+$/.test(s) ? Number(s) : null;
}

/** A hole's kind by its score to par (null: four or more over, ESPN's "OTHER" with no par to say how many). */
export function holeKind(strokes: number, toPar: number | null): { key: string; word: string } {
  if (toPar == null) return { key: "WORSE", word: `a ${strokes}` };
  if (toPar <= -3) return { key: "ALB", word: strokes === 1 ? "a hole in one" : "a double eagle" };
  if (toPar === -2) return { key: "EAG", word: strokes === 1 ? "a hole in one" : "an eagle" };
  if (toPar === -1) return { key: "BIR", word: "a birdie" };
  if (toPar === 0) return { key: "PAR", word: "a par" };
  if (toPar === 1) return { key: "BOG", word: "a bogey" };
  if (toPar === 2) return { key: "DBL", word: "a double bogey" };
  return { key: "WORSE", word: toPar === 3 ? "a triple bogey" : `a ${strokes}, ${toPar} over` };
}

/** What a whole round adds on its last hole: played, bogey-free, under 70, under par, its longest birdie streak. */
export function roundStats(holes: { strokes: number; toPar: number | null }[]): Stats {
  const strokes = holes.reduce((a, h) => a + h.strokes, 0);
  const toPar = holes.reduce((a, h) => a + (h.toPar ?? 0), 0);
  let run = 0;
  let longest = 0;
  for (const h of holes) {
    run = h.toPar != null && h.toPar < 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  const out: Stats = { RND: 1 };
  if (holes.every((h) => h.toPar != null && h.toPar <= 0)) out.BFR = 1;
  if (strokes < 70) out.U70 = 1;
  if (toPar < 0) out.UPAR = 1;
  if (longest >= 3) out[longest >= 6 ? "BS6" : `BS${longest}`] = 1;
  return out;
}

/** ESPN's status as one of a field's: STATUS_CUT is all three outs, told apart by its short detail. */
function statusOf(c: EspnFieldCompetitor): FieldStatus {
  const t = c.status?.type;
  const d = String(t?.shortDetail ?? t?.description ?? "").toUpperCase();
  if (d === "WD" || /WITHDR/.test(d)) return "wd";
  if (d === "DQ" || /DISQUAL/.test(d)) return "dq";
  if (d === "CUT" || d === "MC" || /MISSED CUT/.test(d)) return "cut";
  return "in";
}

/** The last round a competitor played (or anyone: a field's), not a playoff. */
const lastPlayed = (cs: EspnFieldCompetitor[]) => Math.max(0, ...cs.flatMap((c) => (c.linescores ?? []).filter((r) => !r.isPlayoff && played(r)).map((r) => num(r.period) ?? 0)));

/** ESPN's "made the cut, didn't finish" (STATUS_MDF) who didn't play the last round anyone played: placed after everyone who
 *  did. One who played it ranks as anyone (ESPN's 2026 Volvo China Open types one who played all four MDF and places him by
 *  his score). */
const mdfOf = (c: EspnFieldCompetitor | undefined, fieldLast: number) => !!c && (c.status?.type?.name === "STATUS_MDF" || String(c.status?.type?.shortDetail ?? "").toUpperCase() === "MDF") && lastPlayed([c]) < fieldLast;

/** The place ESPN shows ("T9", "1"), or null ("-"). */
function placeOf(c: EspnFieldCompetitor): number | null {
  const m = /^T?(\d+)$/.exec(String(c.status?.position?.displayName ?? "").trim());
  return m ? Number(m[1]) : null;
}

function entryOf(c: EspnFieldCompetitor): FieldEntry {
  const team = c.type === "team" || (!c.athlete && !!c.team);
  return {
    id: idOf(c.id),
    name: str(c.athlete?.displayName) ?? str(c.team?.displayName) ?? idOf(c.id),
    type: team ? "team" : "athlete",
    members: (c.roster ?? []).map((r) => idOf(r.athlete?.id)).filter(Boolean),
    country: str(c.athlete?.flag?.alt),
  };
}

const competitorsOf = (ev: EspnFieldEvent | null) => ev?.competitions?.[0]?.competitors ?? [];
/** A round that was played: it has strokes (a round not played is 0 or nothing: a cut player's third). */
const played = (r: EspnLinescore) => (num(r.value) ?? 0) > 0 || (r.linescores ?? []).length > 0;
/** Whether a competitor was in a playoff: ESPN's flag, or a playoff round of theirs. */
const inPlayoff = (c: EspnFieldCompetitor | undefined) => !!c && (c.status?.playoff === true || (c.linescores ?? []).some((r) => r.isPlayoff));
const iso = (t: number | null) => (t == null ? null : new Date(t).toISOString().replace(".000Z", "Z"));

/** ESPN's board's own counts of a round's kinds of holes (unnamed, in order: birdies, bogeys, bunkers, double bogeys, eagles or
 *  better, pars, the tee time), as BIR, BOG, DBL, EAG (eagles or better) and PAR; null where they're all 0 (not filled in). */
export function boardCounts(r: EspnLinescore): Stats | null {
  const st = r.statistics?.categories?.[0]?.stats ?? [];
  if (st.length < 6) return null;
  const v = st.slice(0, 6).map((s) => num(s.value) ?? 0);
  if (!v.some(Boolean)) return null;
  return { BIR: v[0], BOG: v[1], DBL: v[3], EAG: v[4], PAR: v[5] };
}

/** A round's holes counted as boardCounts counts them (eagles or better as eagles). */
function kindsOf(holes: { strokes: number; toPar: number | null }[]): [string, number][] {
  const c: Stats = { BIR: 0, BOG: 0, DBL: 0, EAG: 0, PAR: 0 };
  for (const h of holes) {
    const k = holeKind(h.strokes, h.toPar).key;
    if (k === "ALB") c.EAG++;
    else if (k in c) c[k]++;
  }
  return Object.entries(c);
}

export class Golf extends FieldSport {
  readonly id = "golf";
  readonly name = "Golf";
  readonly groups = GROUPS;
  readonly positions = POSITIONS;
  readonly statGroups = [
    { key: HOLES, label: "Holes" },
    { key: ROUNDS, label: "Rounds" },
    { key: PLAYOFF, label: "Playoff" },
    { key: FINISH, label: "Finish" },
    { key: MONEY, label: "Money and points" },
  ];
  readonly stats = STATS;
  readonly periods = { word: "round", plural: "rounds", regulation: 4, extra: "playoff" };
  readonly lock = "event" as const;
  readonly leagues = GOLF_LEAGUES;
  readonly placeKeys = PLACE_KEYS;

  /** "2nd round, 11th hole"; "playoff, 18th hole". */
  where(play: Pick<Play, "period" | "half" | "clock" | "shootout"> & { kind?: string; hole?: number }): string {
    const name = play.kind?.startsWith("playoff") ? this.periods.extra : `${ordinal(play.period)} ${this.periods.word}`;
    return play.hole != null ? `${name}, ${ordinal(play.hole)} hole` : name;
  }

  /** The field, its rounds and its cut; null for an event that isn't stroke play (the Presidents Cup's "Match", PGA Tour
   *  Champions' "Modified Stableford", scored in points). */
  fieldEvent(answer: FieldAnswer): FieldEvent | null {
    const lb = fieldEventOf(answer, "leaderboard");
    const board = fieldEventOf(answer, "board");
    const ev = lb ?? board;
    if (!ev) return null;
    const scoring = str(lb?.tournament?.scoringSystem?.name);
    if (scoring && !STROKE_PLAY.includes(scoring)) return null;
    const ids = [...new Set([...competitorsOf(lb), ...competitorsOf(board)].map((c) => idOf(c.id)).filter(Boolean))];
    const t = lb?.tournament;
    const rounds = num(t?.numberOfRounds) ?? lastPlayed(competitorsOf(ev));
    const after = num(t?.cutRound) ?? 0;
    return { event: idOf(ev.id), field: ids, parts: rounds || this.periods.regulation, cut: after > 0 ? { after, score: (num(t?.cutCount) ?? 0) > 0 ? num(t?.cutScore) : null } : null };
  }

  /** ESPN's own numbers: the leaderboard's rounds (strokes, score to par, the place each started from), a playoff's, the
   *  statuses (a missed cut, a withdrawal, a disqualification), earnings and season points, and its places. Not the board's
   *  counts of the kinds of holes, which are worked out from its holes (check-field-reduce.js compares them). */
  readBox(answer: FieldAnswer): FieldBox | null {
    const lb = fieldEventOf(answer, "leaderboard");
    const event = this.fieldEvent(answer);
    if (!lb || !event || !competitorsOf(lb).length) return null;
    const people: FieldBox["people"] = {};
    const fieldLast = lastPlayed(competitorsOf(lb));
    const anyCut = competitorsOf(lb).some((x) => statusOf(x) === "cut");
    for (const c of competitorsOf(lb)) {
      const entry = entryOf(c);
      const status = statusOf(c);
      const stats: Stats = { STR: 0, TOPAR: 0, MC: status === "cut" ? 1 : 0, WD: status === "wd" ? 1 : 0, DQ: status === "dq" ? 1 : 0, MDF: mdfOf(c, fieldLast) ? 1 : 0 };
      const parts: Record<number, Stats> = {};
      for (const r of c.linescores ?? []) {
        if (r.isPlayoff || !played(r)) continue;
        const p = num(r.period) ?? 0;
        const strokes = num(r.value) ?? 0;
        const toPar = toParOf(r.displayValue) ?? 0;
        stats.STR += strokes;
        stats.TOPAR += toPar;
        parts[p] = { STR: strokes, TOPAR: toPar };
      }
      const place = status === "in" ? placeOf(c) : null;
      if (inPlayoff(c)) {
        const r = (c.linescores ?? []).find((l) => l.isPlayoff);
        Object.assign(stats, { PO: 1, POW: place === 1 ? 1 : 0, POH: (r?.linescores ?? []).length, POSTR: num(r?.value) ?? 0 });
      }
      const earned = num(c.earnings);
      if (earned != null) stats.EARN = earned;
      const cup = num((c.statistics ?? []).find((s) => s.name === "cupPoints")?.value);
      if (cup != null) stats.CUPPTS = cup;
      const madeCut = event.cut && anyCut ? status !== "cut" && Object.keys(parts).some((r) => Number(r) > event.cut!.after) : undefined;
      const standing: Standing = { id: entry.id, place, tied: place != null && c.status?.position?.isTie === true, status, ...(madeCut !== undefined ? { madeCut } : {}) };
      people[entry.id] = { ...entry, stats, parts, standing };
    }
    // The placed by place, then the out by status and score (as Golf.rank lists them), else in ESPN's order (not the record's:
    // an id like ESPN's is listed by its number).
    const standings = competitorsOf(lb)
      .map((c) => people[idOf(c.id)])
      .sort((a, b) => ORDER[a.standing.status] - ORDER[b.standing.status] || (a.standing.place ?? 1e9) - (b.standing.place ?? 1e9) || (a.standing.status === "in" ? 0 : a.stats.TOPAR - b.stats.TOPAR))
      .map((p) => p.standing);
    const st = lb.status?.type;
    return { ...event, final: st?.completed === true && st?.state === "post", people, standings };
  }

  /**
   * The tournament's plays: each competitor's holes in the order played, round by round (or, where the board has no holes, each
   * round whole from the leaderboard: strokes and score to par, no kinds of holes); a missed cut, a withdrawal or a
   * disqualification after its round (ESPN's statuses); then a playoff: its holes where ESPN lists them, and who was in it and
   * who won it (ESPN's final places). Each at the moment it's known by: its round's end at the latest (the next round's first
   * tee time, or the answers' `_asked` if earlier); the last round's and a playoff's at `_asked`, or for a finished event with
   * none, 12 hours after its last tee time (ROUND_OVER_MS); a live one with none only at the end.
   */
  readPlays(answer: FieldAnswer, issues: string[] = []): FieldPlay[] {
    const lb = fieldEventOf(answer, "leaderboard");
    const board = fieldEventOf(answer, "board");
    const event = this.fieldEvent(answer);
    if (!event) return [];
    const lbBy = new Map(competitorsOf(lb).map((c) => [idOf(c.id), c]));
    const boardBy = new Map(competitorsOf(board).map((c) => [idOf(c.id), c]));
    const ids = [...new Set([...lbBy.keys(), ...boardBy.keys()])];
    const final = lb?.status?.type?.completed === true && lb?.status?.type?.state === "post";
    // Each round's first tee time, from the leaderboard (ISO; the board's are Eastern time labelled PDT).
    const firstTee = new Map<number, number>();
    for (const c of lbBy.values()) {
      for (const r of c.linescores ?? []) {
        const t = msOf(r.teeTime);
        const p = num(r.period);
        if (t == null || p == null || r.isPlayoff) continue;
        if (!firstTee.has(p) || t < firstTee.get(p)!) firstTee.set(p, t);
      }
    }
    const asked = msOf(answer._asked);
    // What the answers say last: when they were had, or a finished event's last tee time (a playoff's too) and its round.
    const lastTee = Math.max(-Infinity, ...[...lbBy.values()].flatMap((c) => (c.linescores ?? []).map((r) => msOf(r.teeTime) ?? -Infinity)));
    const end = asked ?? (final && Number.isFinite(lastTee) ? lastTee + ROUND_OVER_MS : null);
    const knownBy = (round: number): string | null => {
      const next = firstTee.get(round + 1) ?? null;
      return iso(next != null && asked != null ? Math.min(next, asked) : next ?? end);
    };
    // Each course's par for each hole (its leaderboard's): the right score to par where ESPN's types are wrong.
    const courses = (lb?.courses ?? []).map((c) => new Map((c.holes ?? []).map((h) => [num(h.number), num(h.shotsToPar)]))).filter((m) => m.size >= 18);

    const fieldLast = lastPlayed(competitorsOf(lb));
    const byRound = new Map<number, FieldPlay[]>();
    const playoff: FieldPlay[] = [];
    const add = (round: number, p: FieldPlay) => (byRound.get(round) ?? byRound.set(round, []).get(round)!).push(p);
    for (const id of ids) {
      const lc = lbBy.get(id);
      const bc = boardBy.get(id);
      const entry = entryOf(lc ?? bc!);
      const people = entry.members.length ? entry.members : [id];
      const status = lc ? statusOf(lc) : "in";
      const poRound = (lc?.linescores ?? []).find((r) => r.isPlayoff);
      const poPeriod = num(poRound?.period) ?? (inPlayoff(lc) ? event.parts + 1 : null);
      const rounds = new Map<number, { lb?: EspnLinescore; board?: EspnLinescore }>();
      for (const r of lc?.linescores ?? []) if (!r.isPlayoff && played(r)) rounds.set(num(r.period)!, { ...rounds.get(num(r.period)!), lb: r });
      for (const r of bc?.linescores ?? []) {
        const p = num(r.period);
        // The board's playoff: the leaderboard's playoff round, or any round past the tournament's own (where the leaderboard
        // flags only who's in it, or there's none).
        if (p == null || !played(r) || p === poPeriod || p > event.parts) continue;
        rounds.set(p, { ...rounds.get(p), board: r });
      }
      const lastRound = Math.max(0, ...rounds.keys());
      let total = 0;
      const base = { who: id, half: null, clock: null, team: null, people } as const;
      for (const [round, { lb: lr, board: br }] of [...rounds].sort((a, b) => a[0] - b[0])) {
        const at = knownBy(round);
        const holes = br?.linescores ?? [];
        const unit = `${id}:${round}`;
        const roundToPar = toParOf((lr ?? br)?.displayValue);
        if (!holes.length) {
          // A round whole, from the leaderboard (a tour whose board has no holes). Done: one before their last, a cut player's;
          // still in, one before the round they're in, or a finished one's; out, their last if it's a whole round's strokes
          // (ESPN's status says the round the event was in when they were flagged, and a withdrawal's partial round its strokes).
          const r = lr ?? br!;
          const strokes = num(r.value) ?? 0;
          const toPar = roundToPar ?? 0;
          total += toPar;
          const done =
            round < lastRound ||
            status === "cut" ||
            (status === "in" ? round < (num(lc?.status?.period) ?? lastRound) || lc?.status?.type?.completed === true || (num(lc?.status?.thru) ?? 0) >= 18 : strokes >= FULL_ROUND);
          const deltas: Stats = { STR: strokes, TOPAR: toPar };
          if (done) addStats(deltas, { HOLES: 18, RND: 1, ...(strokes < 70 ? { U70: 1 } : {}), ...(toPar < 0 ? { UPAR: 1 } : {}) });
          else if (status === "in" && num(lc?.status?.thru)) deltas.HOLES = num(lc!.status!.thru)!;
          add(round, { ...base, id: `${event.event}:${id}:${round}`, at, period: round, text: `${entry.name}: ${strokes} (${r.displayValue ?? ""}) in the ${ordinal(round)} round`, kind: "round", unit, score: { [id]: total }, deltas: { [id]: deltas } });
          continue;
        }
        // Each hole's score to par: from a course's pars or ESPN's types (or a hole's own par), whichever comes to the round's
        // score to par ESPN gives: the course first where there's one (ESPN's types are wrong in some events: the 2026 Chubb
        // Classic's), ESPN's types first where there are more (which course a round was on isn't said: the 2026 PURE Insurance
        // Championship's types are wrong too, and one of its two courses' pars comes to every round). One hole left unknown is
        // what the round leaves.
        const read = (pars: Map<number | null, number | null> | null) =>
          holes.map((h) => {
            const strokes = num(h.value) ?? 0;
            const hole = num(h.period) ?? 0;
            const par = pars ? pars.get(hole) ?? null : num(h.par);
            const toPar = par != null ? strokes - par : toParOf(h.scoreType?.displayValue);
            return { hole, strokes, toPar };
          });
        const fill = (hs: { hole: number; strokes: number; toPar: number | null }[]) => {
          const unknown = hs.filter((h) => h.toPar == null);
          if (unknown.length === 1 && roundToPar != null) unknown[0].toPar = roundToPar - hs.reduce((a, h) => a + (h.toPar ?? 0), 0);
          return hs;
        };
        const sums = (hs: { toPar: number | null }[]) => hs.every((h) => h.toPar != null) && hs.reduce((a, h) => a + h.toPar!, 0) === roundToPar;
        const byEspn = fill(read(null));
        const byCourses = courses.map((c) => fill(read(c)));
        const tries = courses.length === 1 ? [byCourses[0], byEspn] : [byEspn, ...byCourses];
        // Where two come to the round's score, the one whose kinds of holes are the board's own counts of them (right where
        // its types are wrong).
        const counted = br ? boardCounts(br) : null;
        const fits = (hs: { strokes: number; toPar: number | null }[]) => !counted || hs.length < 18 || kindsOf(hs).every(([k, v]) => counted[k] === v);
        const pick = tries.find((t) => sums(t) && fits(t)) ?? tries.find(sums) ?? tries[0];
        if (!sums(pick)) issues.push(`${entry.name} round ${round}: the holes come to ${pick.reduce((a, h) => a + (h.toPar ?? 0), 0)} to par, ESPN's round ${roundToPar}`);
        pick.forEach((h, i) => {
          const kind = holeKind(h.strokes, h.toPar);
          const d: Stats = { STR: h.strokes, HOLES: 1, [kind.key]: 1, ...(h.toPar != null ? { TOPAR: h.toPar } : {}), ...(h.strokes === 1 ? { HIO: 1 } : {}) };
          if (i === pick.length - 1 && pick.length >= 18) addStats(d, roundStats(pick));
          total += h.toPar ?? 0;
          add(round, { ...base, id: `${event.event}:${id}:${round}:${i + 1}`, at, period: round, text: `${entry.name}: ${kind.word} on the ${ordinal(h.hole)} (${h.strokes})`, kind: kind.key === "ALB" ? "double-eagle" : kind.key.toLowerCase(), unit, score: { [id]: total }, deltas: { [id]: d }, hole: h.hole });
        });
      }
      // ESPN's statuses: out at the end of the round they went out in (the cut's, a withdrawal's); through a cut but not on to
      // the end at their last round's.
      if (status === "in" && mdfOf(lc, fieldLast)) add(lastRound, { ...base, id: `${event.event}:${id}:mdf`, at: knownBy(lastRound), period: lastRound, text: `${entry.name} made the cut but didn't finish`, kind: "made-cut-didnt-finish", unit: null, score: { [id]: total }, deltas: { [id]: { MDF: 1 } } });
      if (status !== "in") {
        // A withdrawal's, the last round they played (ESPN's status says the round the event was in when it was flagged:
        // Greyserman's, 10 holes into the second, says the third); before teeing off at all, the first's (known by its end).
        const round = status === "cut" ? event.cut?.after ?? lastRound : lastRound || 1;
        const what = { cut: ["missed the cut", "missed-cut", { MC: 1 }], wd: ["withdrew", "withdrew", { WD: 1 }], dq: ["was disqualified", "disqualified", { DQ: 1 }] } as const;
        const [text, kind, d] = what[status];
        add(round, { ...base, id: `${event.event}:${id}:${kind}`, at: knownBy(round), period: round, text: `${entry.name} ${text}`, kind, unit: null, score: { [id]: total }, deltas: { [id]: { ...d } } });
      }
      // A playoff: its holes where ESPN lists them (the leaderboard's, with their par, else the board's), else its strokes;
      // then who was in it and, once final, who won it (ESPN's place).
      if (inPlayoff(lc)) {
        const period = poPeriod ?? event.parts + 1;
        const holes = (poRound?.linescores ?? []).length ? poRound!.linescores! : (bc?.linescores ?? []).find((r) => num(r.period) === period)?.linescores ?? [];
        const po = { ...base, at: iso(end), period, unit: `${id}:playoff`, score: {} };
        holes.forEach((h, i) => {
          const strokes = num(h.value) ?? 0;
          playoff.push({ ...po, id: `${event.event}:${id}:playoff:${i + 1}`, text: `${entry.name}: ${strokes} on the ${ordinal(num(h.period) ?? 0)}, the playoff's ${ordinal(i + 1)} hole`, kind: "playoff-hole", deltas: { [id]: { POH: 1, POSTR: strokes } }, hole: num(h.period) ?? undefined });
        });
        const strokes = num(poRound?.value) ?? 0;
        if (!holes.length && strokes) playoff.push({ ...po, id: `${event.event}:${id}:playoff:strokes`, text: `${entry.name}: ${strokes} in the playoff`, kind: "playoff-strokes", deltas: { [id]: { POSTR: strokes } } });
        const won = final && placeOf(lc!) === 1;
        playoff.push({ ...po, id: `${event.event}:${id}:playoff`, text: `${entry.name} ${final ? (won ? "won the playoff" : "lost the playoff") : "is in a playoff"}`, kind: "playoff", deltas: { [id]: won ? { PO: 1, POW: 1 } : { PO: 1 } } });
      }
    }
    const plays = [...[...byRound].sort((a, b) => a[0] - b[0]).flatMap(([, ps]) => ps), ...playoff];
    // Times never go back (a round's known-by is the next round's first tee: they follow each other); a play with no time (a
    // live answer's last round with no `_asked`) comes last: it counts only at the end.
    return [...(inOrder(plays.filter((p) => p.at != null)) as FieldPlay[]), ...plays.filter((p) => p.at == null)];
  }

  /**
   * Golf's standings: everyone still in by their score to par, the tied sharing a place (T9); a playoff's winner first and its
   * losers tied after (in sudden death, everyone beaten ties for second): the winner its place says, else, live, the one who's
   * survived the most holes in the fewest strokes; after everyone who finished, anyone through a cut who didn't (MDF); out (no
   * place) whoever missed the cut, withdrew or was disqualified (ESPN's statuses, at the end of their round). Once the cut's
   * made (anyone's missed it), those through it made it.
   */
  rank(state: Omit<FieldState, "standings">, event: FieldEvent): Standing[] {
    const ids = [...new Set([...event.field, ...Object.keys(state.lines)])];
    const line = (id: string) => state.lines[id] ?? {};
    const status = (id: string): FieldStatus => (n(line(id), "DQ") ? "dq" : n(line(id), "WD") ? "wd" : n(line(id), "MC") ? "cut" : "in");
    const cut = event.cut;
    const cutMade = !!cut && ids.some((id) => status(id) === "cut");
    // Someone out after the cut made it (a withdrawal in the third round).
    const madeCut = (id: string) => (cutMade ? status(id) !== "cut" && Object.keys(state.parts[id] ?? {}).some((r) => Number(r) > cut!.after) : undefined);
    const live = ids.filter((id) => status(id) === "in");
    const po = live.filter((id) => n(line(id), "PO") > 0 || n(line(id), "POH") > 0);
    const byPlayoff = [...po].sort((a, b) => n(line(b), "POW") - n(line(a), "POW") || n(line(b), "POH") - n(line(a), "POH") || n(line(a), "POSTR") - n(line(b), "POSTR"));
    const key = (id: string) => `${n(line(id), "POW")}:${n(line(id), "POH")}:${n(line(id), "POSTR")}`;
    const winner = byPlayoff.length && (byPlayoff.length === 1 || key(byPlayoff[0]) !== key(byPlayoff[1])) ? byPlayoff[0] : null;
    // Who didn't finish after a cut, after everyone who did; then the score; then a playoff's losers after its winner.
    const rankOf = (id: string): [number, number, number] => [n(line(id), "MDF") ? 1 : 0, n(line(id), "TOPAR"), po.includes(id) && winner && id !== winner ? 1 : 0];
    const cmp = (a: string, b: string) => rankOf(a)[0] - rankOf(b)[0] || rankOf(a)[1] - rankOf(b)[1] || rankOf(a)[2] - rankOf(b)[2];
    live.sort(cmp);
    const standings: Standing[] = [];
    live.forEach((id, i) => {
      const same = (j: number) => j >= 0 && j < live.length && cmp(live[j], id) === 0;
      let first = i;
      while (same(first - 1)) first--;
      standings.push({ id, place: first + 1, tied: same(i - 1) || same(i + 1), status: "in", ...(cutMade ? { madeCut: true } : {}) });
    });
    const rest = ids.filter((id) => status(id) !== "in").sort((a, b) => ORDER[status(a)] - ORDER[status(b)] || n(line(a), "TOPAR") - n(line(b), "TOPAR"));
    for (const id of rest) {
      const m = madeCut(id);
      standings.push({ id, place: null, tied: false, status: status(id), ...(m !== undefined ? { madeCut: m } : {}) });
    }
    return standings;
  }

  /**
   * The places after a round, as ESPN's leaderboard starts the next round from (its `startPosition`): everyone who's finished
   * every round up to it (18 holes each; `among`: only these, ESPN's those who play the next round), by their score to par
   * through it, the tied sharing a place; the cut not applied. ESPN's `currentPosition` on a round is otherwise in some events:
   * the place when each one finished the round (at the 2026 U.S. Open an early finisher at -2 is 4th, passed later that day).
   */
  placesAfter(state: Pick<FieldState, "parts">, round: number, among?: Set<string>): Map<string, { place: number; tied: boolean }> {
    const done = Object.entries(state.parts).filter(([id, parts]) => (!among || among.has(id)) && Array.from({ length: round }, (_, i) => n(parts[i + 1] ?? {}, "HOLES") >= 18).every(Boolean));
    const score = new Map(done.map(([id, parts]) => [id, Object.entries(parts).reduce((a, [r, s]) => a + (Number(r) <= round ? n(s, "TOPAR") : 0), 0)]));
    const all = [...score.values()];
    return new Map([...score].map(([id, s]) => [id, { place: 1 + all.filter((x) => x < s).length, tied: all.filter((x) => x === s).length > 1 }]));
  }

  placeStats(standing: Standing): Stats {
    const out: Stats = {};
    const p = standing.place;
    if (p != null) {
      out.POS = p;
      if (p === 1) out.W = 1;
      for (const k of [5, 10, 20, 25]) if (p <= k) out[`TOP${k}`] = 1;
    }
    if (standing.madeCut) out.CUT = 1;
    return out;
  }
}
