import { BoutSport, count, idOf, inOrder, isoOf as iso, msOf, nonzero, num, ordinal, pair, position as pos, ratio, str, val as n, type Bout, type BoutAnswer, type BoutBox, type BoutCard, type BoutPlay, type BoutResult, type EspnBoutCompetition, type EspnBoutCompetitor, type EspnBoutCore, type EspnBoutPlay, type EspnBoutStatus, type FieldEntry, type Play, type Position, type PositionGroup, type StatDef, type Stats } from "./sport";

// MMA (the UFC, the PFL and every promotion ESPN carries: `mma/<league>`): its vocabulary and ESPN's readers
// (docs/PLAN-start-a-game-gpt.md track L, L5 part 4a).
//
// How ESPN records a fight card (checked 2026-10-30 on every finished card of 2025 and 2026: the UFC's 99, 1,088 bouts; the
// PFL's 28; LFA's 36; and a few of the rest): there's no summary (`mma/<league>/summary?event=` is a 404), so a card is a few
// answers asked together (BoutAnswer):
//  - its **board** (`site.api.espn.com/apis/site/v2/sports/mma/<league>/scoreboard/<event>`, one call, ~3 KB over the wire): its
//    bouts in the order fought (the main event last), each with its weight class (`type`), its scheduled start (its segment's:
//    every main-card bout has the main card's), its status (the round it ended in, `period`, and the time into it: `clock` in
//    seconds, `displayClock` "4:59"), its two fighters (`order` 1 and 2, `winner`) and, for a decision, each judge's score under
//    each fighter (`linescores[0].linescores`). Not how it ended.
//  - its **FightCenter** (`site.web.api.espn.com/apis/common/v3/sports/mma/<league>/fightcenter/<event>`, one call, ~17 KB over
//    the wire, most of it videos and news): the card's segments (main, prelims1, prelims2), each bout's number counted back from
//    the main event, its note ("Main Event - Title Fight"), a title (`types`), its result (`status.result`: `kotko` KO/TKO with
//    what did it, "Punches", and where, "head"; `submission`, "Rear Naked Choke"; `decision---unanimous`, `---split`,
//    `---majority`; `tko---doctors-stoppage`; `dq`; `draw`; `no-contest`), the judges' scores as text and, on the UFC's cards,
//    each fighter's totals: knockdowns, total and significant strikes landed of attempted, significant strikes to the head, body
//    and legs, control time, takedowns landed of attempted, submission attempts.
//  - from the **core API**: each bout's rounds as ESPN describes them (`.../events/<id>`, one call: "3 Rnd (5-5-5)", "5 Rnd
//    (5-5-5-5-5)", "3 Rnd + OT (5-5-5-5)" a tournament's overtime round, "3 Rnd (10-5-5)" once), its status (the same result) and,
//    on the UFC's cards since April 2025, its **plays** (`.../competitions/<id>/plays`, a call a bout: the fight's opening, the
//    walkouts, each round's start and end, every knockdown, takedown and its attempt, submission attempt and reversal, pauses
//    and their reason, the fight over, the unofficial winner and the result, each with its round, the clock left in it and its
//    wallclock: the only times in an MMA answer) and each fighter's **statistics** (`.../competitors/<id>/statistics`, a call a
//    fighter: the FightCenter's totals and more: significant strikes by target and position, slams, reversals, advances to half
//    guard, side control, mount and back; a 404 on the PFL's and the rest).
// Where ESPN's data is thin or its own (each read in its data):
//  - **No play says whose it is** (none of the UFC's ~20,000 in 2025-26 has a fighter or a team), and there are no statistics by round anywhere (the
//    core's `statistics/1` is its totals again): a fighter's numbers are the bout's totals, known when it ends; a bout's rounds
//    are its own counts (its knockdowns, takedowns, submission attempts, reversals), timed.
//  - **The plays don't always come to the totals**: in 858 of 930 UFC bouts with plays the knockdowns do, the takedowns in 851,
//    their attempts in 811, submission attempts in 896, reversals in 906 (a play filed twice, or one missing; some cards' plays
//    have rounds and no moments at all). The totals are ESPN's statistics; the rounds' counts are the plays'.
//  - **The FightCenter's totals are the core's** (10,880 of 10,880 numbers), and the board's, the FightCenter's and the core's
//    winners agree (2,176 of 2,176); so the board and the FightCenter alone (two calls) give a card's results and totals.
//  - **The PFL, LFA and the rest have results only**: no statistics, no plays (no times). LFA's and the smaller promotions'
//    boards list a few of the night's bouts; theirs name the result otherwise ("tko-punches", "submission-armbar",
//    "technical-submission", "ko-head-kick", "dq-illegal-kick"): read by what it starts with.
//  - **A bout called off is gone from the card**: every bout listed in 2025-26 is final; none is canceled or postponed.
//  - **No bonuses** (Fight of the Night, Performance of the Night) anywhere in ESPN's answers.
//  - The board's `format` counts "3 Rnd + OT" as 4 rounds; the core's description is the rounds.
//  - The statistics' own `wallclock` isn't when the bout ended (hours after it): not read.
// When it's known: a bout's numbers when it ends (the "Fight Over" play's wallclock), its result when it's announced (its
// "Unofficial Winner" or "Results" play, a median 103 s later); a bout ESPN times nothing of when the answers were had
// (`_asked`), or the next bout's first moment, or for a finished card read with neither 12 hours after the last segment's start.
// Live, a bout on shows its totals so far (as far as ESPN's answers have them) at their `_asked`.

const RESULT = "result";
const STRIKING = "striking";
const GRAPPLING = "grappling";

const STATS: StatDef[] = [
  // The result, when it's announced (each bout's own: a card's numbers are its bouts').
  count("BOUT", "Bouts", "B", "bout", RESULT),
  count("W", "Wins", "W", "win", RESULT),
  count("L", "Losses", "L", "loss", RESULT, "lower"),
  count("D", "Draws", "D", "draw", RESULT),
  count("NC", "No contests", "NC", "no contest", RESULT),
  // How a win came: KO/TKO (ESPN's, with a doctor's or a corner's stoppage and a retirement), a submission (a technical one
  // too), a decision and its kind, a disqualification.
  count("KO", "Wins by KO/TKO", "KO", "win by KO/TKO", RESULT),
  count("SUB", "Wins by submission", "SUB", "win by submission", RESULT),
  count("DEC", "Wins by decision", "DEC", "win by decision", RESULT),
  count("UD", "Wins by unanimous decision", "UD", "win by unanimous decision", RESULT),
  count("SD", "Wins by split decision", "SD", "win by split decision", RESULT),
  count("MD", "Wins by majority decision", "MD", "win by majority decision", RESULT),
  count("DQ", "Wins by disqualification", "DQ", "win by disqualification", RESULT),
  // A win before the final bell (KO/TKO, submission, disqualification) in its round, and in the fight's first 60 seconds.
  count("WR1", "1st-round wins", "R1", "1st-round win", RESULT),
  count("WR2", "2nd-round wins", "R2", "2nd-round win", RESULT),
  count("WR3", "3rd-round wins", "R3", "3rd-round win", RESULT),
  count("WR4", "4th-round wins", "R4", "4th-round win", RESULT),
  count("WR5", "5th-round wins", "R5", "5th-round win", RESULT),
  { key: "FIN", label: "Wins before the final bell", short: "FIN", noun: "win before the final bell", group: RESULT, better: "higher", kind: "derived", of: (s) => n(s, "WR1") + n(s, "WR2") + n(s, "WR3") + n(s, "WR4") + n(s, "WR5") },
  count("QW", "Wins in 60 seconds or less", "QW", "win in 60 seconds or less", RESULT),
  // How long the bout went: its rounds before the last at their length, and the last's time.
  count("TIME", "Fight time (seconds)", "TIME", "second fought", RESULT),

  // Striking: ESPN's statistics, the bout's totals.
  count("KD", "Knockdowns", "KD", "knockdown", STRIKING),
  count("SSL", "Significant strikes landed", "SSL", "significant strike landed", STRIKING),
  count("SSA", "Significant strikes attempted", "SSA", "significant strike attempted", STRIKING),
  count("TSL", "Total strikes landed", "TSL", "strike landed", STRIKING),
  count("TSA", "Total strikes attempted", "TSA", "strike attempted", STRIKING),
  // Significant strikes by target and by position (ESPN's statistics only: the FightCenter's have the targets).
  count("SHL", "Significant strikes landed to the head", "HEAD", "significant strike to the head", STRIKING),
  count("SHA", "Significant strikes attempted to the head", "HEADA", "significant strike attempted to the head", STRIKING),
  count("SBL", "Significant strikes landed to the body", "BODY", "significant strike to the body", STRIKING),
  count("SBA", "Significant strikes attempted to the body", "BODYA", "significant strike attempted to the body", STRIKING),
  count("SLL", "Significant strikes landed to the legs", "LEG", "significant strike to the legs", STRIKING),
  count("SLA", "Significant strikes attempted to the legs", "LEGA", "significant strike attempted to the legs", STRIKING),
  count("SDL", "Significant strikes landed at distance", "DIST", "significant strike at distance", STRIKING),
  count("SDA", "Significant strikes attempted at distance", "DISTA", "significant strike attempted at distance", STRIKING),
  count("SCL", "Significant strikes landed in the clinch", "CLINCH", "significant strike in the clinch", STRIKING),
  count("SCA", "Significant strikes attempted in the clinch", "CLINCHA", "significant strike attempted in the clinch", STRIKING),
  count("SGL", "Significant strikes landed on the ground", "GROUND", "significant strike on the ground", STRIKING),
  count("SGA", "Significant strikes attempted on the ground", "GROUNDA", "significant strike attempted on the ground", STRIKING),
  { key: "SSACC", label: "Significant strike accuracy", short: "SS%", noun: "significant strike accuracy", group: STRIKING, better: "higher", kind: "rate", of: (s) => ratio(n(s, "SSL"), n(s, "SSA")) },

  // Grappling.
  count("TDL", "Takedowns", "TD", "takedown", GRAPPLING),
  count("TDA", "Takedowns attempted", "TDA", "takedown attempted", GRAPPLING),
  count("SLAM", "Slams", "SLAM", "slam", GRAPPLING),
  { key: "TDACC", label: "Takedown accuracy", short: "TD%", noun: "takedown accuracy", group: GRAPPLING, better: "higher", kind: "rate", of: (s) => ratio(n(s, "TDL"), n(s, "TDA")) },
  count("SUBA", "Submission attempts", "SUBA", "submission attempt", GRAPPLING),
  count("REV", "Reversals", "REV", "reversal", GRAPPLING),
  count("ADV", "Advances", "ADV", "advance", GRAPPLING),
  count("ADHG", "Advances to half guard", "HG", "advance to half guard", GRAPPLING),
  count("ADSC", "Advances to side control", "SIDE", "advance to side control", GRAPPLING),
  count("ADMT", "Advances to mount", "MOUNT", "advance to mount", GRAPPLING),
  count("ADBK", "Advances to the back", "BACK", "advance to the back", GRAPPLING),
  count("CTRL", "Control time (seconds)", "CTRL", "second in control", GRAPPLING),
];

/** ESPN's core statistics (by name) as MMA's keys; a key made of several (a target's or a position's significant strikes) adds
 *  them. Not read: ESPN's rates and shares (takedownAccuracy, slamRate, targetBreakdown*, posBreakdown*) and its `wallclock`. */
const POSITIONS3 = ["Distance", "Clinch", "Ground"];
const TARGETS3 = ["Head", "Body", "Leg"];
const CORE_KEYS: Record<string, string[]> = {
  KD: ["knockDowns"],
  SSL: ["sigStrikesLanded"],
  SSA: ["sigStrikesAttempted"],
  TSL: ["totalStrikesLanded"],
  TSA: ["totalStrikesAttempted"],
  ...Object.fromEntries(TARGETS3.flatMap((t) => [[`S${t[0]}L`, POSITIONS3.map((p) => `sig${p}${t}StrikesLanded`)], [`S${t[0]}A`, POSITIONS3.map((p) => `sig${p}${t}StrikesAttempted`)]])),
  ...Object.fromEntries(POSITIONS3.flatMap((p) => [[`S${p[0]}L`, TARGETS3.map((t) => `sig${p}${t}StrikesLanded`)], [`S${p[0]}A`, TARGETS3.map((t) => `sig${p}${t}StrikesAttempted`)]])),
  TDL: ["takedownsLanded"],
  TDA: ["takedownsAttempted"],
  SLAM: ["takedownsSlams"],
  SUBA: ["submissions"],
  REV: ["reversals"],
  ADV: ["advances"],
  ADHG: ["advanceToHalfGuard"],
  ADSC: ["advanceToSide"],
  ADMT: ["advanceToMount"],
  ADBK: ["advanceToBack"],
  CTRL: ["timeInControl"],
};

/** The FightCenter's totals as MMA's keys: a count, or a landed-of-attempted pair ("144/254"). */
const CENTER_KEYS: Record<string, string | [string, string]> = {
  knockDowns: "KD",
  totalStrikes: ["TSL", "TSA"],
  sigStrikes: ["SSL", "SSA"],
  headStrikes: ["SHL", "SHA"],
  bodyStrikes: ["SBL", "SBA"],
  legStrikes: ["SLL", "SLA"],
  timeInControl: "CTRL",
  takedowns: ["TDL", "TDA"],
  submissions: "SUBA",
};

/** The plays that count a moment of the bout's round (ESPN's type text): a takedown's attempt is filed too, so the attempts
 *  count every takedown, as ESPN's statistics do. */
const TALLY: Record<string, Stats> = {
  Knockdown: { KD: 1 },
  Takedown: { TDL: 1 },
  "Takedown Attempt": { TDA: 1 },
  "Submission Attempt": { SUBA: 1 },
  Reversal: { REV: 1 },
};

const GROUPS: PositionGroup[] = [{ key: "fighters", label: "Fighters", stats: [RESULT, STRIKING, GRAPPLING] }];

/** The weight classes as positions (a bout's, from ESPN's `type`; a fighter's is the bout's they're in). */
const POSITIONS: Position[] = [
  pos("HW", "Heavyweight", "fighters"),
  pos("LHW", "Light heavyweight", "fighters"),
  pos("MW", "Middleweight", "fighters"),
  pos("WW", "Welterweight", "fighters"),
  pos("LW", "Lightweight", "fighters"),
  pos("FW", "Featherweight", "fighters"),
  pos("BW", "Bantamweight", "fighters"),
  pos("FLW", "Flyweight", "fighters"),
  pos("SW", "Strawweight", "fighters"),
  pos("CW", "Catchweight", "fighters"),
  pos("WFW", "Women's featherweight", "fighters"),
  pos("WBW", "Women's bantamweight", "fighters"),
  pos("WFLW", "Women's flyweight", "fighters"),
  pos("WSW", "Women's strawweight", "fighters"),
  pos("WCW", "Women's catchweight", "fighters"),
];
const CLASS_KEYS: Record<string, string> = {
  heavyweight: "HW",
  "light heavyweight": "LHW",
  middleweight: "MW",
  welterweight: "WW",
  lightweight: "LW",
  featherweight: "FW",
  bantamweight: "BW",
  flyweight: "FLW",
  strawweight: "SW",
  "catch weight": "CW",
  catchweight: "CW",
};

/** A bout's moments as play kinds ("Round Start": "round-start", "Unofficial Winner Kotko": "unofficial-winner-kotko"). */
const kindOf = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "play";
/** The plays that end a bout, and those that announce its result. */
const ENDS = ["Fight Over", "Fight Complete"];
const announces = (text: string) => text === "Results" || text.startsWith("Unofficial Winner");

/** A bout's time into its round as ESPN writes it ("4:59"); not its "-" for none (the FightCenter's, now and then). */
const clockOf = (st: EspnBoutStatus | null | undefined): string | null => {
  const c = str(st?.displayClock);
  return c && c !== "-" ? c : null;
};

/** When a bout ended by ESPN's plays (its "Fight Over", else its last timed play; null with none), and whether they announce its
 *  result yet (live-event.ts's cardFeed: a bout's plays asked on after its end until they do, its statistics once settled). */
export function playsEnd(plays: EspnBoutPlay[] | null | undefined): { endedAt: number | null; announced: boolean } {
  const ps = [...(plays ?? [])].sort((a, b) => (num(a.sequenceNumber) ?? 0) - (num(b.sequenceNumber) ?? 0));
  const over = ps.find((p) => ENDS.includes(str(p.type?.text) ?? ""));
  const last = [...ps].reverse().find((p) => msOf(p.wallclock ?? null) != null);
  return { endedAt: msOf((over ?? last)?.wallclock ?? null), announced: ps.some((p) => announces(str(p.type?.text) ?? "")) };
}

/** How long after the last segment's start a card is surely over, where the answers say nothing later (a finished card read
 *  with no `_asked` and no plays): a UFC card runs 4 to 6 hours from its first segment, a main card about 3. */
const CARD_OVER_MS = 12 * 3600_000;

const mmss = (secs: number) => `${Math.floor(secs / 60)}:${String(Math.round(secs % 60)).padStart(2, "0")}`;

/** How a bout ended from ESPN's result name: its outcome and, for a win, MMA's key for how. ESPN's smaller promotions add the
 *  how to the name ("tko-punches", "submission-armbar"); a draw can be a decision's ("decision---split-draw"), a decision a
 *  technical one (stopped early by a foul, to the cards: "technical-decision"). Null for one it doesn't name. */
export function methodOf(name: string | null | undefined): { outcome: "win" | "draw" | "nc"; method: string | null } | null {
  const s = String(name ?? "").toLowerCase();
  if (!s) return null;
  if (/(^|-)draw($|-)/.test(s)) return { outcome: "draw", method: null };
  if (/^no-contest/.test(s)) return { outcome: "nc", method: null };
  if (/^(technical-)?decision---unanimous/.test(s)) return { outcome: "win", method: "UD" };
  if (/^(technical-)?decision---split/.test(s)) return { outcome: "win", method: "SD" };
  if (/^(technical-)?decision---majority/.test(s)) return { outcome: "win", method: "MD" };
  if (/^(technical-)?decision/.test(s)) return { outcome: "win", method: "DEC" };
  if (/^(technical-)?submission/.test(s)) return { outcome: "win", method: "SUB" };
  if (/^(kotko|tko|ko)(\b|-|$)/.test(s)) return { outcome: "win", method: "KO" };
  if (/^dq/.test(s)) return { outcome: "win", method: "DQ" };
  return null;
}

/** A fighter in a bout from ESPN's core API, with their statistics. */
type CoreFighter = NonNullable<EspnBoutCore["competitors"]>[number];

/** A fighter's statistics from ESPN's core API, by its name ("sigStrikesLanded": 144). */
export function coreFighterStats(c: CoreFighter | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const cat of c?.statistics?.splits?.categories ?? []) for (const s of cat.stats ?? []) if (s.name && num(s.value) != null) out[s.name] = num(s.value)!;
  return out;
}

/** A fighter's totals in MMA's keys from ESPN's core statistics; null where it has none (a 404: the PFL's and the rest). */
export function mmaCoreStats(c: CoreFighter | undefined): Stats | null {
  const raw = coreFighterStats(c);
  if (!Object.keys(raw).length) return null;
  const out: Stats = {};
  for (const [k, names] of Object.entries(CORE_KEYS)) if (names.some((x) => raw[x] != null)) out[k] = names.reduce((a, x) => a + (raw[x] ?? 0), 0);
  return out;
}

/** A fighter's totals in MMA's keys from the FightCenter ("144/254"); null where it has none. */
export function mmaCenterStats(c: EspnBoutCompetitor | undefined): Stats | null {
  if (!c?.stats?.length) return null;
  const out: Stats = {};
  for (const s of c.stats) {
    const k = CENTER_KEYS[s.name ?? ""];
    if (!k) continue;
    if (Array.isArray(k)) {
      const p = pair(s.displayValue);
      if (p) [out[k[0]], out[k[1]]] = p;
    } else if (num(s.value) != null) out[k] = num(s.value)!;
  }
  return Object.keys(out).length ? out : null;
}

/** Everything the readers read about one bout, from whichever answers have it. */
interface BoutRead {
  bout: Bout;
  board: EspnBoutCompetition;
  center: EspnBoutCompetition | null;
  core: EspnBoutCore | null;
  status: EspnBoutStatus | null;
  names: Record<string, string>;
  plays: EspnBoutPlay[];
}

export class MMA extends BoutSport {
  readonly id = "mma";
  readonly name = "MMA";
  readonly groups = GROUPS;
  readonly positions = POSITIONS;
  readonly statGroups = [
    { key: RESULT, label: "Result" },
    { key: STRIKING, label: "Striking" },
    { key: GRAPPLING, label: "Grappling" },
  ];
  readonly stats = STATS;
  /** A bout's rounds: 3, or 5 for a main event or a title (each bout says its own: Bout.rounds). */
  readonly periods = { word: "round", plural: "rounds", regulation: 3, extra: "overtime round" };
  readonly lock = "event" as const;
  readonly formats = [3, 5];

  /** A weight class from ESPN's ("Lightweight", "W Flyweight", "Catch Weight"). */
  positionKey(abbreviation: string | null | undefined): string | null {
    const s = str(abbreviation);
    if (!s) return null;
    const women = /^(w|women's)\s+/i.test(s);
    const key = CLASS_KEYS[s.replace(/^(w|women's)\s+/i, "").toLowerCase()];
    return key ? `${women ? "W" : ""}${key}` : s.toUpperCase();
  }

  /** "the 2nd round, 3:14 left", "the walkouts", "the result". */
  where(play: Pick<Play, "period" | "half" | "clock" | "shootout"> & { kind?: string }): string {
    if (play.period > 0) return `the ${ordinal(play.period)} round${play.clock ? `, ${play.clock} left` : ""}`;
    return ["fight-open", "walkout", "tale-of-the-tape", "staredown"].includes(play.kind ?? "") ? "the walkouts" : "the result";
  }

  /** The card's bouts, each with whatever the answers have of it. */
  private reads(answer: BoutAnswer, issues: string[] = []): BoutRead[] {
    const comps = answer.board?.competitions ?? [];
    const centers = new Map(Object.values(answer.fightcenter?.cards ?? {}).flatMap((s) => s.competitions ?? []).map((c) => [idOf(c.id), c]));
    const described = new Map((answer.event?.competitions ?? []).map((c) => [idOf(c.id), c]));
    return comps.map((c, i) => {
      const id = idOf(c.id);
      const center = centers.get(id) ?? null;
      const core = answer.core?.[id] ?? null;
      const sides = [...(c.competitors ?? [])].sort((a, b) => (num(a.order) ?? 9) - (num(b.order) ?? 9)).map((x) => idOf(x.id));
      const names = Object.fromEntries((c.competitors ?? []).map((x) => [idOf(x.id), str(x.athlete?.displayName) ?? idOf(x.id)]));
      // The rounds as the core describes them ("3 Rnd + OT (5-5-5-5)"), else the board's count, at 5 minutes each.
      const d = described.get(id);
      const m = /^(\d+) Rnd( \+ OT)? \(([\d-]+)\)/.exec(str(d?.description) ?? "");
      const scheduled = num(d?.format?.regulation?.periods ?? c.format?.regulation?.periods) ?? 3;
      const lengths = m ? m[3].split("-").map((x) => Number(x) * 60) : Array.from({ length: scheduled }, () => num(d?.format?.regulation?.clock ?? c.format?.regulation?.clock) ?? 300);
      const rounds = m ? Number(m[1]) : scheduled;
      const types = [...(center?.types ?? []), ...(c.types ?? [])];
      const bout: Bout = {
        id,
        order: i + 1,
        sides,
        rounds,
        lengths,
        overtime: !!m?.[2],
        segment: str(center?.cardSegment?.name),
        main: center?.matchNumber != null ? center.matchNumber === 1 : i === comps.length - 1,
        title: types.some((t) => /title/i.test(t.text ?? "")) || /title fight/i.test(center?.note ?? ""),
        start: str(c.date),
        class: this.positionKey(c.type?.abbreviation),
      };
      if (sides.length !== 2) issues.push(`bout ${id} has ${sides.length} sides`);
      const plays = [...(core?.plays ?? [])].sort((a, b) => (num(a.sequenceNumber) ?? 0) - (num(b.sequenceNumber) ?? 0));
      const status = core?.status?.type ? core.status : center?.status ?? c.status ?? null;
      return { bout, board: c, center, core, status: status && !status.result && center?.status?.result ? { ...status, result: center.status.result } : status, names, plays };
    });
  }

  card(answer: BoutAnswer): BoutCard | null {
    return answer.board?.competitions ? this.cardOf(answer, this.reads(answer)) : null;
  }

  /** The card from its bouts as read: a one-night tournament's fighter once in its field. */
  private cardOf(answer: BoutAnswer, rs: BoutRead[]): BoutCard {
    const bouts = rs.map((r) => r.bout);
    return { event: idOf(answer.board?.id), bouts, field: [...new Set(bouts.flatMap((b) => b.sides))] };
  }

  /** Whether a bout's over: final on its status, or its plays say so. */
  private over(r: BoutRead): boolean {
    const t = r.status?.type;
    return (t?.state === "post" && t.completed !== false) || r.plays.some((p) => ENDS.includes(p.type?.text ?? ""));
  }

  /** A bout's result, once it's over; null before (or for one ESPN says nothing of). */
  private resultOf(r: BoutRead, issues: string[] = []): BoutResult | null {
    if (!this.over(r)) return null;
    const { bout } = r;
    let named = methodOf(r.status?.result?.name);
    // The winner ESPN flags: on the board, else the FightCenter, else the core (live, one can say it before another).
    const flagged = (cs: { id?: string | number; winner?: boolean }[] | undefined) => (cs ?? []).find((x) => x.winner === true);
    const winnerOf = flagged(r.board.competitors) ?? flagged(r.center?.competitors) ?? flagged(r.core?.competitors);
    // ESPN's name says a draw and its answers flag a winner (a 2024 Rizin bout's "decision---split-draw", flagged on the board,
    // the FightCenter and the core alike): the flags, a decision of no kind said.
    if (named?.outcome === "draw" && winnerOf) {
      issues.push(`bout ${bout.id}: ESPN names a draw ("${r.status?.result?.name}") and flags a winner: read as a win`);
      named = { outcome: "win", method: /decision/.test(r.status?.result?.name ?? "") ? "DEC" : null };
    }
    const winner = named?.outcome === "win" || (!named && winnerOf) ? idOf(winnerOf?.id) || null : null;
    if (!named && r.status?.result?.name) issues.push(`bout ${bout.id}: a result ESPN names "${r.status.result.name}" isn't read`);
    if ((named?.outcome === "win" || !named) && !winner) {
      if (named) issues.push(`bout ${bout.id}: a win with no winner flagged`);
      return null;
    }
    const outcome = named?.outcome ?? "win";
    const round = num(r.status?.period);
    const secs = num(r.status?.clock);
    const how = str(r.status?.result?.description) ?? /\(([^)]+)\)/.exec(r.status?.result?.displayName ?? "")?.[1] ?? null;
    const judges = bout.sides.map((id) => (r.board.competitors ?? []).find((x) => idOf(x.id) === id)?.linescores?.[0]?.linescores?.map((l) => num(l.value)) ?? []);
    const cards = (judges[0] ?? []).map((v, i) => [v, judges[1]?.[i] ?? null]).filter((c): c is number[] => c.every((x) => x != null));
    return {
      bout: bout.id,
      outcome,
      winner,
      loser: winner ? bout.sides.find((s) => s !== winner) ?? null : null,
      method: named?.method ?? null,
      how,
      round: round || null,
      time: clockOf(r.status) ?? (secs != null ? mmss(secs) : null),
      cards,
    };
  }

  /** What a result puts in each fighter's line. */
  private resultStats(res: BoutResult, bout: Bout): Record<string, Stats> {
    const out: Record<string, Stats> = Object.fromEntries(bout.sides.map((s) => [s, {}]));
    if (res.outcome !== "win") {
      for (const s of bout.sides) out[s][res.outcome === "draw" ? "D" : "NC"] = 1;
      return out;
    }
    const w = out[res.winner!] ?? (out[res.winner!] = {});
    w.W = 1;
    if (res.method) w[res.method] = 1;
    const decision = ["UD", "SD", "MD", "DEC"].includes(res.method ?? "");
    if (decision && res.method !== "DEC") w.DEC = 1;
    // A win before the final bell, in its round (and inside the first minute); not one ESPN doesn't say how of.
    if (res.method && !decision && res.round && res.round <= 5) {
      w[`WR${res.round}`] = 1;
      const [m, s] = (res.time ?? "").split(":").map(Number);
      if (res.round === 1 && Number.isFinite(m) && Number.isFinite(s) && m * 60 + s <= 60) w.QW = 1;
    }
    if (res.loser) (out[res.loser] ??= {}).L = 1;
    return out;
  }

  /** The bout's length in seconds: its rounds before the last at their length, and the last's time. */
  private timeOf(r: BoutRead): number | null {
    const round = num(r.status?.period);
    const secs = num(r.status?.clock);
    if (!round || secs == null) return null;
    let before = 0;
    for (let i = 0; i < round - 1; i++) before += r.bout.lengths[i] ?? 300;
    return before + secs;
  }

  /** A fighter's numbers so far: the core's statistics, else the FightCenter's; empty where ESPN has none. */
  private numbers(r: BoutRead, id: string): Stats {
    const core = mmaCoreStats(r.core?.competitors?.find((x) => idOf(x.id) === id));
    return core ?? mmaCenterStats(r.center?.competitors?.find((x) => idOf(x.id) === id)) ?? {};
  }

  /** A bout's end in each fighter's line: the bout, its time and their totals. */
  private endStats(r: BoutRead): Record<string, Stats> {
    const time = this.timeOf(r);
    return Object.fromEntries(r.bout.sides.map((id) => [id, nonzero({ BOUT: 1, ...(time != null ? { TIME: time } : {}), ...this.numbers(r, id) })]));
  }

  /** ESPN's own numbers: each fighter's totals with their bout's result, and the results; final once the card is. */
  readBox(answer: BoutAnswer): BoutBox | null {
    if (!answer.board?.competitions) return null;
    const rs = this.reads(answer);
    const card = this.cardOf(answer, rs);
    const people: BoutBox["people"] = {};
    const results: BoutResult[] = [];
    for (const r of rs) {
      const res = this.resultOf(r);
      const ended = this.over(r) ? this.endStats(r) : {};
      const won = res ? this.resultStats(res, r.bout) : {};
      for (const id of r.bout.sides) {
        const c = (r.board.competitors ?? []).find((x) => idOf(x.id) === id);
        const entry: FieldEntry = { id, name: r.names[id] ?? id, type: "athlete", members: [], country: str(c?.athlete?.flag?.alt) };
        // A one-night tournament's fighter is on the card twice: their numbers over both bouts.
        const person = (people[id] ??= { ...entry, bouts: [], stats: {} });
        person.bouts.push(r.bout.id);
        for (const add of [ended[id], won[id]]) for (const [k, v] of Object.entries(add ?? {})) person.stats[k] = (person.stats[k] ?? 0) + v;
      }
      if (res) results.push(res);
    }
    const st = answer.board?.status?.type;
    return { ...card, final: st?.state === "post" && st?.completed === true, people, results };
  }

  /**
   * The card's plays, bout by bout in the order fought: each of ESPN's timed moments (the walkouts, each round's start and end,
   * a knockdown or a takedown counted in its round's tally, the end, the announcement), then the bout's end (each fighter's
   * totals, at its "Fight Over") and its result (at its announcement). A bout ESPN times nothing of ends, and has its result,
   * when the answers were had (`_asked`), else at the next bout's first moment, else for a finished card 12 hours after its last
   * segment's start (a live answer's with none only at the end). A bout on, live, has its totals so far at `_asked`.
   */
  readPlays(answer: BoutAnswer, issues: string[] = []): BoutPlay[] {
    if (!answer.board?.competitions) return [];
    const rs = this.reads(answer, issues);
    const asked = msOf(answer._asked);
    const st = answer.board?.status?.type;
    const final = st?.state === "post" && st?.completed === true;
    const starts = rs.map((r) => msOf(r.bout.start)).filter((t): t is number => t != null);
    const fallback = asked ?? (final && starts.length ? Math.max(...starts) + CARD_OVER_MS : null);
    const firstOf = (r: BoutRead) => r.plays.map((p) => msOf(p.wallclock)).find((t) => t != null) ?? null;
    const plays: BoutPlay[] = [];
    rs.forEach((r, i) => {
      const { bout } = r;
      const title = bout.sides.map((s) => r.names[s]).join(" vs. ");
      const base = { bout: bout.id, half: null, team: null, unit: bout.id, score: {} } as const;
      const res = this.resultOf(r, issues);
      const over = this.over(r);
      const ends: BoutPlay[] = [];
      const endPlay = (at: string | null): BoutPlay => ({ ...base, id: `${bout.id}:end`, who: null, at, period: 0, clock: null, text: `${title}: over${this.timeOf(r) != null ? ` (${r.status?.period ? `the ${ordinal(r.status.period)} round, ` : ""}${clockOf(r.status) ?? ""})` : ""}`, kind: "bout-end", people: bout.sides, deltas: this.endStats(r) });
      const resultPlay = (at: string | null, res: BoutResult): BoutPlay => ({ ...base, id: `${bout.id}:result`, who: res.winner, at, period: 0, clock: null, text: this.says(res, bout, r.names), kind: "result", people: bout.sides, deltas: this.resultStats(res, bout), result: res });
      if (r.plays.length) {
        let ended = false;
        let said = false;
        for (const p of r.plays) {
          const text = str(p.type?.text) ?? "";
          const period = num(p.period?.number) ?? 0;
          const clock = str(p.clock?.displayValue);
          const tally = TALLY[text];
          ends.push({ ...base, id: `${bout.id}:${idOf(p.id)}`, who: null, at: str(p.wallclock), period, clock: clock && clock !== "-" ? clock : null, text: `${title}: ${text.toLowerCase()}${period ? `, ${ordinal(period)} round` : ""}${clock && clock !== "-" ? `, ${clock} left` : ""}`, kind: kindOf(text), people: bout.sides, deltas: {}, ...(tally ? { tally: { ...tally } } : {}) });
          if (over && !ended && ENDS.includes(text)) {
            ends.push(endPlay(str(p.wallclock)));
            ended = true;
          }
          if (res && ended && !said && announces(text)) {
            ends.push(resultPlay(str(p.wallclock), res));
            said = true;
          }
        }
        // ESPN's plays with no "Fight Over": the bout's end after its last round's end; its result then, if nothing said it.
        if (over && !ended) {
          const lastEnd = [...ends].reverse().find((p) => p.kind === "round-end") ?? ends[ends.length - 1];
          ends.splice(ends.indexOf(lastEnd) + 1, 0, endPlay(lastEnd.at));
        }
        // Its result not announced after its end in ESPN's order: at a play announcing it if there's one (401928106's plays go on
        // past its end), else when a live answer had it (on its board by then), else at the bout's end; never before its end.
        if (res && !said) {
          const end = msOf(ends.find((p) => p.kind === "bout-end")!.at);
          const told = r.plays.map((p) => (announces(str(p.type?.text) ?? "") ? msOf(p.wallclock ?? null) : null)).find((t) => t != null) ?? (asked ?? end);
          ends.push(resultPlay(iso(told != null && end != null ? Math.max(told, end) : told ?? end), res));
        }
        if (!over && r.status?.type?.state === "in" && asked != null) ends.push(this.soFar(r, title, iso(asked)));
      } else if (over) {
        // Timed by nothing of its own: when the answers were had, or the next bout's first moment, or the card's fallback.
        const next = rs.slice(i + 1).map(firstOf).find((t) => t != null) ?? null;
        const at = iso(next != null && asked != null ? Math.min(next, asked) : next ?? fallback);
        ends.push(endPlay(at));
        if (res) ends.push(resultPlay(at, res));
      } else if (r.status?.type?.state === "in" && asked != null) ends.push(this.soFar(r, title, iso(asked)));
      // A bout called off on the night (never seen: ESPN takes one off the card) has nothing to read.
      if (r.status?.type?.state === "post" && r.status.type.completed === false) issues.push(`bout ${bout.id} (${title}) is over but not completed: ${r.status.type.name ?? "called off"}`);
      plays.push(...ends);
    });
    // Times never go back (ESPN's bouts are fought one after another): one of ESPN's with no wallclock takes the play before
    // it's. A play with no time (a bout's end or result nothing times: a live answer with no `_asked`; or ESPN's, before any
    // other has one) comes last: it counts only at the end.
    const untimed = (p: BoutPlay) => p.at == null && ["bout-end", "result", "so-far"].includes(p.kind);
    const timed = inOrder(plays.filter((p) => !untimed(p))) as BoutPlay[];
    return [...timed.filter((p) => p.at != null), ...timed.filter((p) => p.at == null), ...plays.filter(untimed)];
  }

  /** A bout on, live: each fighter's totals so far, at when the answers were had. */
  private soFar(r: BoutRead, title: string, at: string | null): BoutPlay {
    const deltas = Object.fromEntries(r.bout.sides.map((id) => [id, nonzero(this.numbers(r, id))]).filter(([, d]) => Object.keys(d as Stats).length));
    return { bout: r.bout.id, half: null, team: null, unit: r.bout.id, score: {}, id: `${r.bout.id}:so-far`, who: null, at, period: num(r.status?.period) ?? 0, clock: null, text: `${title}: so far`, kind: "so-far", people: r.bout.sides, deltas };
  }

  /** A result in words: "Justin Gaethje beat Paddy Pimblett by unanimous decision (49-46, 49-46, 48-47)", the winner's scores
   *  first. */
  private says(res: BoutResult, bout: Bout, names: Record<string, string>): string {
    const how: Record<string, string> = { KO: "KO/TKO", SUB: "submission", UD: "unanimous decision", SD: "split decision", MD: "majority decision", DEC: "decision", DQ: "disqualification" };
    const flip = res.winner != null && res.winner === bout.sides[1];
    const cards = res.cards.length ? ` (${res.cards.map((c) => (flip ? [...c].reverse() : c).join("-")).join(", ")})` : "";
    const when = res.round && !["UD", "SD", "MD", "DEC"].includes(res.method ?? "") ? `, the ${ordinal(res.round)} round${res.time ? ` at ${res.time}` : ""}` : "";
    if (res.outcome === "draw") return `${Object.values(names).join(" and ")} drew${cards}`;
    if (res.outcome === "nc") return `${Object.values(names).join(" and ")}: no contest`;
    return `${names[res.winner!] ?? res.winner} beat ${names[res.loser!] ?? res.loser}${res.method ? ` by ${how[res.method]}` : ""}${res.how ? ` (${res.how})` : ""}${when}${cards}`;
  }
}
