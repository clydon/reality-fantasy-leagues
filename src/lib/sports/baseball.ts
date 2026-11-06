import { TeamSport, addStats, count, headerTeams, idOf, inOrder, isFinal, num, ordinal, position as pos, per, str, val as n, type Box, type BoxPerson, type EspnPlay, type EspnSummary, type LockCadence, type Periods, type Play, type Position, type PositionGroup, type StatDef, type Stats } from "./sport";

// Baseball (the MLB; college baseball is CollegeBaseball, on its vocabulary and this reader): its vocabulary and ESPN's
// readers. ESPN's per-player batting lines have no doubles, triples or total bases (its labels are H-AB AB R H RBI HR BB K #P
// AVG OBP SLG; only the team totals have them), but its plays do, so they're counted here play by play: a single 1 total
// base, a double 2, a triple 3, a home run 4.
//
// How ESPN records a game (checked on the 2026 Wild Card and World Series games, 2026-10-28): every pitch is a play
// ("summaryType" P) with the pitcher and batter, and each at-bat ends in a play-result (N, S when a run scores, C for a
// pitching change) whose text says what happened ("Wells singled to right, Lombard Jr. scored, Volpe to second.") and whose
// participants say who's on base after it. Stolen bases, wild pitches and the like come twice, as their own typed play and as
// a play-result with the same text (or, after a challenge, in MLB's own words): only the play-result is read. A pitch or a
// result the call changed on is filed again, and the last filing stands. Two of ESPN's numbers on a play can't be read as of
// that play in a recorded game: an at-bat's start (and any play in the middle of one) carries the at-bat's final outs and
// score, so outs are counted from the text (whoever's out) and runs from each play's scoreValue, and the at-bat's final outs
// only check them.

const BATTING = "batting";
const PITCHING = "pitching";


const STATS: StatDef[] = [
  count("PA", "Plate appearances", "PA", "plate appearance", BATTING),
  count("AB", "At-bats", "AB", "at-bat", BATTING),
  count("R", "Runs", "R", "run", BATTING),
  count("H", "Hits", "H", "hit", BATTING),
  { key: "1B", label: "Singles", short: "1B", noun: "single", group: BATTING, better: "higher", kind: "derived", of: (s) => n(s, "H") - n(s, "2B") - n(s, "3B") - n(s, "HR") },
  count("2B", "Doubles", "2B", "double", BATTING),
  count("3B", "Triples", "3B", "triple", BATTING),
  count("HR", "Home runs", "HR", "home run", BATTING),
  { key: "TB", label: "Total bases", short: "TB", noun: "total base", group: BATTING, better: "higher", kind: "derived", of: (s) => n(s, "H") + n(s, "2B") + 2 * n(s, "3B") + 3 * n(s, "HR") },
  { ...count("RBI", "Runs batted in", "RBI", "run batted in", BATTING), judged: true },
  count("BB", "Walks", "BB", "walk", BATTING),
  count("IBB", "Intentional walks", "IBB", "intentional walk", BATTING),
  count("HBP", "Hit by pitch", "HBP", "hit by pitch", BATTING),
  count("K", "Strikeouts", "K", "strikeout", BATTING, "lower"),
  count("SB", "Stolen bases", "SB", "stolen base", BATTING),
  count("CS", "Caught stealing", "CS", "time caught stealing", BATTING, "lower"),
  count("SF", "Sacrifice flies", "SF", "sacrifice fly", BATTING),
  count("SH", "Sacrifice bunts", "SH", "sacrifice bunt", BATTING),
  count("GIDP", "Grounded into double plays", "GIDP", "double play grounded into", BATTING, "lower"),
  count("NP", "Pitches seen", "#P", "pitch seen", BATTING),
  { key: "AVG", label: "Batting average", short: "AVG", noun: "batting average", group: BATTING, better: "higher", kind: "rate", ...per({ H: 1 }, { AB: 1 }) },
  { key: "OBP", label: "On-base percentage", short: "OBP", noun: "on-base percentage", group: BATTING, better: "higher", kind: "rate", ...per({ H: 1, BB: 1, HBP: 1 }, { AB: 1, BB: 1, HBP: 1, SF: 1 }) },
  { key: "SLG", label: "Slugging percentage", short: "SLG", noun: "slugging percentage", group: BATTING, better: "higher", kind: "rate", ...per({ H: 1, "2B": 1, "3B": 2, HR: 3 }, { AB: 1 }) },

  count("GS", "Games started", "GS", "start", PITCHING),
  count("OUTS", "Outs recorded", "Outs", "out recorded", PITCHING),
  { key: "IP", label: "Innings pitched", short: "IP", noun: "inning pitched", group: PITCHING, better: "higher", kind: "derived", of: (s) => n(s, "OUTS") / 3 },
  count("PH", "Hits allowed", "H", "hit allowed", PITCHING, "lower"),
  count("PR", "Runs allowed", "R", "run allowed", PITCHING, "lower"),
  { ...count("ER", "Earned runs", "ER", "earned run", PITCHING, "lower"), judged: true },
  count("PBB", "Walks allowed", "BB", "walk allowed", PITCHING, "lower"),
  count("PK", "Strikeouts (pitching)", "K", "pitching strikeout", PITCHING),
  count("PHR", "Home runs allowed", "HR", "home run allowed", PITCHING, "lower"),
  count("PC", "Pitches thrown", "PC", "pitch thrown", PITCHING, "lower"),
  count("PST", "Strikes thrown", "ST", "strike thrown", PITCHING),
  count("W", "Wins", "W", "win", PITCHING, "higher", "final"),
  count("L", "Losses", "L", "loss", PITCHING, "lower", "final"),
  count("SV", "Saves", "SV", "save", PITCHING, "higher", "final"),
  count("HLD", "Holds", "HLD", "hold", PITCHING, "higher", "final"),
  count("BS", "Blown saves", "BS", "blown save", PITCHING, "lower", "final"),
  // A start of 6 innings or more with 3 earned runs or fewer: worked out game by game, then added (Sport.full).
  { key: "QS", label: "Quality starts", short: "QS", noun: "quality start", group: PITCHING, better: "higher", kind: "derived", of: (s) => (n(s, "GS") > 0 && n(s, "OUTS") >= 18 && n(s, "ER") <= 3 ? 1 : 0) },
  { key: "ERA", label: "Earned run average", short: "ERA", noun: "earned run average", group: PITCHING, better: "lower", kind: "rate", ...per({ ER: 27 }, { OUTS: 1 }) },
  { key: "WHIP", label: "Walks and hits per inning", short: "WHIP", noun: "WHIP", group: PITCHING, better: "lower", kind: "rate", ...per({ PH: 3, PBB: 3 }, { OUTS: 1 }) },
];

const GROUPS: PositionGroup[] = [
  { key: "batters", label: "Batters", stats: [BATTING] },
  { key: "pitchers", label: "Pitchers", stats: [PITCHING] },
];

const POSITIONS: Position[] = [
  pos("C", "Catcher", "batters"),
  pos("1B", "First base", "batters"),
  pos("2B", "Second base", "batters"),
  pos("3B", "Third base", "batters"),
  pos("SS", "Shortstop", "batters"),
  pos("LF", "Left field", "batters"),
  pos("CF", "Center field", "batters"),
  pos("RF", "Right field", "batters"),
  pos("OF", "Outfield", "batters"),
  pos("DH", "Designated hitter", "batters"),
  pos("PH", "Pinch hitter", "batters"),
  pos("PR", "Pinch runner", "batters"),
  pos("SP", "Starting pitcher", "pitchers"),
  pos("RP", "Relief pitcher", "pitchers"),
  pos("P", "Pitcher", "pitchers"),
];

// ESPN's box score columns, by table, to our keys (a label it shows that isn't here, AVG or ERA, is worked out from counts).
const BOX_BATTING: Record<string, string> = { AB: "AB", R: "R", H: "H", RBI: "RBI", HR: "HR", BB: "BB", K: "K", "#P": "NP" };
const BOX_PITCHING: Record<string, string> = { H: "PH", R: "PR", ER: "ER", BB: "PBB", K: "PK", HR: "PHR" };
// A pitching decision's letter (ESPN's note "W, 1-0", "S, 5", "L, 3-2, B, 1").
const DECISIONS: Record<string, string> = { W: "W", L: "L", S: "SV", H: "HLD", B: "BS" };
// The team's own totals ESPN gives (boxscore.teams[].statistics), by its stat names.
const TEAM_BATTING: Record<string, string> = { plateAppearances: "PA", atBats: "AB", runs: "R", hits: "H", doubles: "2B", triples: "3B", homeRuns: "HR", totalBases: "TB", RBIs: "RBI", walks: "BB", intentionalWalks: "IBB", hitByPitch: "HBP", strikeouts: "K", stolenBases: "SB", caughtStealing: "CS", sacFlies: "SF", sacHits: "SH", GIDPs: "GIDP", pitches: "NP" };
// Not earned runs: a team's are worked out again over the whole inning, so they can be fewer than its pitchers' (the rules'
// 9.16(i)).
const TEAM_PITCHING: Record<string, string> = { thirdInnings: "OUTS", hits: "PH", runs: "PR", walks: "PBB", strikeouts: "PK", homeRuns: "PHR", pitchCount: "PC", strikes: "PST" };

/** "5.2" innings to outs (17): ESPN writes thirds after the point. */
export function outsOf(ip: string | number | null | undefined): number | null {
  const m = /^(\d+)(?:\.(\d))?$/.exec(String(ip ?? "").trim());
  return m ? Number(m[1]) * 3 + Number(m[2] ?? 0) : null;
}

/** Outs as innings pitched, the way a box score writes them ("5.2"). */
export function inningsOf(outs: number): string {
  return `${Math.floor(outs / 3)}.${outs % 3}`;
}

/* ---- The play reader's text helpers. ---- */

export const SUFFIX = /^(?:jr\.?|sr\.?|ii|iii|iv|v)$/;
/** For matching a name in ESPN's words: no accents ("Díaz" is "Diaz" in the box score), lower case, one space. */
export const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * The ways a play's text names someone: their full name, then every shorter tail of it that's more than a suffix ("Mesa Jr."
 * for Victor Mesa Jr.; "Hwan Bae" and "Bae" for Ji Hwan Bae), and the last name after their first name's first letters, as
 * ESPN tells two of a name apart in one game ("B. Montgomery", "We. Wilson"). ESPN's text uses the last name.
 */
export function callNames(name: string): string[] {
  const words = plain(name).split(" ").filter(Boolean);
  const out: string[] = [];
  // "Martin" as well as "Martin Jr.": the text doesn't always say the suffix.
  let end = words.length;
  while (end > 1 && SUFFIX.test(words[end - 1])) end--;
  for (const last of new Set([words.length, end])) {
    for (let i = 0; i < last; i++) {
      if (words.slice(i, last).every((w) => SUFFIX.test(w))) break;
      const tail = words.slice(i, last).join(" ");
      out.push(tail);
      if (i > 0) {
        const first = words[0].replace(/\.$/, "");
        for (let k = 1; k <= Math.min(3, first.length); k++) out.push(`${first.slice(0, k)}. ${tail}`);
      }
    }
  }
  return [...new Set(out)];
}

/** A play challenged or reviewed, whose result follows in MLB's own words: "Brett Sullivan challenged (pitch result), call on
 *  the field was overturned: Eli White walks. Ozzie Albies scores. Matt Olson to 3rd.", "Umpire reviewed (home run), call on
 *  the field was upheld: ...", and two in a row ("Marlins challenged (tag play), ...: Liam Hicks challenged (pitch result),
 *  ...: James Outman caught stealing 3rd base"). */
const ABS = /^(?:.*?(?:challenged|reviewed) \([^)]*\), call on the field was \w+:\s*)+/;
/** ESPN's notes after the play itself, from the sentence's end ("... by Jensen. Kansas City Royals challenged: call on the
 *  field was overturned.", "Umpire review: ..."): never the name before the point. */
const REVIEW = /(?:(?<=[.!?])\s+[A-Z][\w.'-]*(?:\s+[A-Z][\w.'-]*)*\s+challenged\b|\s+Umpire review(?:ed)?\b)[\s\S]*$/;
/** MLB's own words for a pickoff, as the play's subject would say it: "pitcher Nolan McLean picks off Wenceel Pérez at 1st on
 *  throw to first baseman Mark Vientos" is "Wenceel Pérez picked off 1st ...". */
const PICKS_OFF = /\b(?:pitcher|catcher|(?:first|second|third) baseman|shortstop|(?:left|center|right) fielder) .+? picks off (.+?) at (1st|2nd|3rd)\b/gi;

/** A clause's subject: who it starts with, and how many of its words their name takes. */
export type Subject = { id: string; words: number } | null;

/**
 * A play's text as clauses, each with its subject: "Rice homered to center (408 feet), McMahon, Jones, and Goldschmidt scored."
 * is Rice "homered to center (408 feet)", then McMahon, Jones and Goldschmidt each "scored" (a list of names shares the verb
 * after it), and "Grisham scored and Rice scored" is two ("picked off and caught stealing" stays one: only a name after "and"
 * starts a clause). `who` finds a clause's subject among the people who could be in it.
 */
export function clausesOf(text: string, who: (clause: string) => Subject): { id: string | null; rest: string }[] {
  // MLB's own words come in sentences ("Eli White walks. Ozzie Albies scores."): each is a clause (a name's "Jr." isn't a
  // sentence's end: the word before the point is lower case or a number).
  const body = text
    .replace(ABS, "")
    .replace(REVIEW, "")
    .replace(PICKS_OFF, "$1 picked off $2")
    .replace(/([a-z0-9]{2})\.\s+(?=[A-Z])/g, "$1, ")
    .replace(/\.\s*$/, "")
    .trim();
  const parts: string[] = [];
  for (const piece of body.split(/,\s+/)) {
    const [first, ...more] = piece.replace(/^and\s+/, "").trim().split(/\s+and\s+/);
    let cur = first;
    for (const bit of more) {
      if (who(bit)) {
        parts.push(cur);
        cur = bit;
      } else cur += ` and ${bit}`;
    }
    if (cur) parts.push(cur);
  }
  const out: { id: string | null; rest: string }[] = [];
  let waiting: string[] = [];
  for (const p of parts) {
    const w = who(p);
    const rest = w ? p.trim().split(/\s+/).slice(w.words).join(" ") : p;
    if (w && !rest) {
      // Only a name: it shares the verb of the next clause ("McMahon, Jones, and Goldschmidt scored").
      waiting.push(w.id);
      continue;
    }
    for (const id of waiting) out.push({ id, rest });
    waiting = [];
    out.push({ id: w?.id ?? null, rest });
  }
  return out;
}

export type Outcome = "single" | "double" | "triple" | "home-run" | "walk" | "intentional-walk" | "hit-by-pitch" | "strikeout" | "sac-fly" | "sac-bunt" | "interference" | "fielders-choice" | "error" | "double-play" | "out";

/** What the batter did, from the clause that starts with them ("singled to right", "reached on infield single to shortstop",
 *  "safe at first on throwing error by shortstop Pratt"). */
export function outcomeOf(rest: string): Outcome {
  const r = rest.toLowerCase();
  if (/\bhomer(?:ed|s)\b|\bhome run\b/.test(r)) return "home-run";
  if (/\btripl(?:ed|es)\b|\btriple\b(?! play)/.test(r)) return "triple";
  if (/^doubl(?:ed|es)\b(?! off)|\bdouble\b(?! play)/.test(r)) return "double";
  if (/\bsingl(?:ed|es)\b|\bsingle\b/.test(r)) return "single";
  if (/intentionally walk/.test(r)) return "intentional-walk";
  if (/^walk(?:ed|s)\b/.test(r)) return "walk";
  if (/hit by pitch/.test(r)) return "hit-by-pitch";
  if (/^(?:struck|strikes) out\b|^called out on strikes\b/.test(r)) return "strikeout";
  // "Sacrificed into double play, left to catcher to third": a fly, since an outfielder caught it.
  if (/sacrifice fly/.test(r) || /^sacrificed\b[^,]*,\s*(?:left|center|right)\b/.test(r)) return "sac-fly";
  if (/sacrifice bunt|^sacrificed\b/.test(r)) return "sac-bunt";
  if (/interference/.test(r)) return "interference";
  if (/into (?:a )?(?:double|triple) play/.test(r)) return "double-play";
  if (/fielder'?s choice|forceout|force out/.test(r)) return "fielders-choice";
  if (/\berror\b/.test(r)) return "error";
  return "out";
}

export const HITS: Partial<Record<Outcome, string | null>> = { single: null, double: "2B", triple: "3B", "home-run": "HR" };
/** Outcomes that aren't an at-bat. */
export const NOT_AB = new Set<Outcome>(["walk", "intentional-walk", "hit-by-pitch", "sac-fly", "sac-bunt", "interference"]);

/** What a batter's outcome adds to his line and his pitcher's (not a GIDP or RBIs: those are the play's to say). */
export function batterLines(outcome: Outcome): { batter: Stats; pitcher: Stats } {
  const b: Stats = { PA: 1 };
  const pt: Stats = {};
  if (!NOT_AB.has(outcome)) b.AB = 1;
  if (outcome in HITS) {
    b.H = 1;
    pt.PH = 1;
    const extra = HITS[outcome];
    if (extra) b[extra] = 1;
    if (outcome === "home-run") pt.PHR = 1;
  }
  if (outcome === "walk" || outcome === "intentional-walk") {
    b.BB = 1;
    pt.PBB = 1;
    if (outcome === "intentional-walk") b.IBB = 1;
  }
  if (outcome === "hit-by-pitch") b.HBP = 1;
  if (outcome === "strikeout") {
    b.K = 1;
    pt.PK = 1;
  }
  if (outcome === "sac-fly") b.SF = 1;
  if (outcome === "sac-bunt") b.SH = 1;
  return { batter: b, pitcher: pt };
}
/** A runner's clause that says they're out. */
const RUNNER_OUT = /^(?:out\b|thrown out|doubled off|tripled off|caught stealing|picked off|was out|out stretching|tagged out|forced out|called out)/i;
/** A runner's clause that says they stole a base: ESPN's "stole second", MLB's "steals (6) 2nd base". */
const STOLE = /^(?:stole|steals)\b/i;
/** A runner's clause that says they scored: "scored", MLB's "scores", a steal of home ("stole home", "steals (4) home"). */
const SCORED = /^(?:scored|scores|stole home|steals (?:\(\d+\) )?home)\b/i;

interface Runner {
  /** The pitcher charged if they score. */
  pitcher: string | null;
  /** They reached on an error (or were put on base: extra innings' runner on second), so their run isn't earned. */
  unearned: boolean;
  /** They took a base on an error: their run is earned only if a hit brings them in (it would have anyway). */
  helped?: boolean;
}

/** A pitch, its call: ESPN's type starts with the final call ("strike-looking---overturned" is a strike after review). */
function pitchCall(type: string): "ball" | "strike" | "automatic" {
  if (/^automatic/.test(type)) return "automatic";
  if (/^(?:ball|intent-ball|pitchout|hit-by-pitch)/.test(type)) return "ball";
  return "strike";
}

export const BASES = ["onFirst", "onSecond", "onThird"] as const;
const BASE_NAMES: Record<string, number> = { first: 0, "1st": 0, second: 1, "2nd": 1, third: 2, "3rd": 2 };

/** Who's on after a runner's play, from who was on before and what its text says each did: the base each last reaches ("to
 *  third", "stole second", "safe at third"), gone once they score or are out; anyone it doesn't name stays. */
export function movedBy(before: (string | null)[], clauses: { id: string | null; rest: string }[]): (string | null)[] {
  const out = [...before];
  for (const c of clauses) {
    if (!c.id) continue;
    const at = out.indexOf(c.id);
    if (at >= 0) out[at] = null;
    if (SCORED.test(c.rest) || RUNNER_OUT.test(c.rest) || /\bto home\b/i.test(c.rest)) continue;
    const bases = [...c.rest.matchAll(/\b(?:to|at|stole|steals(?: \(\d+\))?) (first|second|third|1st|2nd|3rd)\b/gi)];
    const to = bases.length ? BASE_NAMES[bases[bases.length - 1][1].toLowerCase()] : at;
    if (to != null && to >= 0) out[to] = c.id;
  }
  return out;
}
/** The verbs a batter's clause starts with, for a clause whose name didn't match anyone ("Martin walked"). */
const BATTER_VERB = /\b(?:singled|singles|doubled|doubles|tripled|triples|homered|homers|hit|walked|walks|intentionally|struck|strikes|called|grounded|grounds|flied|flies|lined|lines|popped|pops|fouled|fouls|bunted|reached|safe)\b/;

export class Baseball extends TeamSport {
  readonly id = "baseball";
  readonly name: string = "Baseball";
  readonly groups = GROUPS;
  readonly positions = POSITIONS;
  readonly statGroups = [
    { key: BATTING, label: "Batting" },
    { key: PITCHING, label: "Pitching" },
  ];
  readonly stats = STATS;
  readonly periods: Periods = { word: "inning", plural: "innings", regulation: 9, extra: "extra innings" };
  readonly lock: LockCadence = "daily";
  // College baseball's box and feeds are ESPN's others: CollegeBaseball.
  readonly leagues: string[] = ["mlb"];
  /** Extra innings start with a runner on second (the MLB's since 2020): a runner nobody put on base is the half's first
   *  pitcher's, unearned. College has none (CollegeBaseball). */
  protected readonly runnerOnSecond: boolean = true;

  /** Whether a runner's play-result that lists no one on base moves them as its text says (college's list no one); the MLB's
   *  list who's on after them. */
  protected readonly basesFromText: boolean = false;

  /** Whether runners the text names scoring, each on base before the play, stand when ESPN's scoreValue says fewer (college's
   *  can); the MLB's count stands. */
  protected readonly namedRunsStand: boolean = false;

  /** The outs ESPN says a batter's play-result leaves, which settles a play whose text doesn't say who was out; null to count
   *  the text's alone. The MLB's are the outs after it (`read`: the text's count, `before`: the outs before it). */
  protected outsSaid(p: EspnPlay, before: number, read: number): number | null {
    void before;
    void read;
    return num(p.outs);
  }

  /** "Top 3rd", "Bottom 10th". */
  where(play: Pick<Play, "period" | "half" | "clock" | "shootout">): string {
    return `${play.half === "bottom" ? "Bottom" : "Top"} ${ordinal(play.period)}`;
  }

  readBox(summary: EspnSummary): Box | null {
    if (!summary.header) return null;
    const teams = headerTeams(summary);
    const people: Record<string, BoxPerson> = {};
    for (const side of summary.boxscore?.players ?? []) {
      const team = idOf(side.team?.id);
      for (const table of side.statistics ?? []) {
        const kind = str(table.type) ?? str(table.name);
        const labels = table.labels ?? [];
        let pitchers = 0;
        for (const row of table.athletes ?? []) {
          const id = idOf(row.athlete?.id);
          if (!id) continue;
          const person = (people[id] ??= { id, name: str(row.athlete?.displayName) ?? "", team, position: null, stats: {} });
          const v = row.stats ?? [];
          const has = (label: string) => labels.includes(label);
          const at = (label: string) => v[labels.indexOf(label)];
          // Only the columns this table has: a thinner box score (college's) without #P or PC-ST says nothing about them.
          const s: Stats = {};
          if (kind === BATTING) {
            person.position ??= this.positionKey(row.position?.abbreviation);
            for (const [label, key] of Object.entries(BOX_BATTING)) if (has(label)) s[key] = num(at(label)) ?? 0;
          } else if (kind === PITCHING) {
            // Listed in the order they pitched: the first is the starter, whatever the row's `starter` flag says (ESPN's is
            // false for a two-way player: Ohtani, starting on the mound, on 2026-06-17). A decision is in a note or not at all.
            s.GS = pitchers++ === 0 ? 1 : 0;
            if (person.position == null || person.position === "P") person.position = "P";
            for (const key of Object.values(DECISIONS)) s[key] = 0;
            if (has("IP")) s.OUTS = outsOf(at("IP") as string) ?? 0;
            for (const [label, key] of Object.entries(BOX_PITCHING)) if (has(label)) s[key] = num(at(label)) ?? 0;
            if (has("PC-ST")) {
              const [pc, st] = String(at("PC-ST") ?? "").split("-").map((x) => num(x));
              s.PC = pc ?? 0;
              s.PST = st ?? 0;
            } else if (has("PC")) s.PC = num(at("PC")) ?? 0;
            for (const note of row.notes ?? []) {
              if (note.type !== "pitchingDecision") continue;
              for (const m of String(note.text ?? "").matchAll(/(?:^|,\s*)([A-Z])(?=,|$)/g)) {
                const key = DECISIONS[m[1]];
                if (key) s[key] = (s[key] ?? 0) + 1;
              }
            }
          } else continue;
          // Zeros kept: a column ESPN has says 0 as much as it says 3 (the final's correction needs both).
          for (const [k, x] of Object.entries(s)) person.stats[k] = (person.stats[k] ?? 0) + x;
        }
      }
    }
    for (const side of summary.boxscore?.teams ?? []) {
      const team = teams.find((t) => t.id === idOf(side.team?.id));
      if (!team) continue;
      for (const group of side.statistics ?? []) {
        const map = group.name === BATTING ? TEAM_BATTING : group.name === PITCHING ? TEAM_PITCHING : null;
        if (!map) continue;
        for (const s of group.stats ?? []) {
          const key = s.name ? map[s.name] : undefined;
          const v = key ? (typeof s.value === "number" ? s.value : num(s.displayValue)) : null;
          if (key && v != null) team.stats[key] = v;
        }
      }
    }
    if (!teams.length || !Object.keys(people).length) return null;
    return { event: idOf(summary.header.id), final: isFinal(summary), teams, people };
  }

  readPlays(summary: EspnSummary, issues?: string[]): Play[] {
    const raw = summary.plays ?? [];
    const teams = headerTeams(summary);
    const away = teams.find((t) => t.home === false)?.id ?? teams[0]?.id ?? "";
    const home = teams.find((t) => t.home === true)?.id ?? teams[1]?.id ?? "";
    // Everyone in the game, by id: their name (for the text) and team.
    const names = new Map<string, string>();
    const teamOf = new Map<string, string>();
    for (const side of summary.boxscore?.players ?? []) {
      for (const table of side.statistics ?? []) {
        for (const row of table.athletes ?? []) {
          const id = idOf(row.athlete?.id);
          if (!id) continue;
          names.set(id, str(row.athlete?.displayName) ?? "");
          teamOf.set(id, idOf(side.team?.id));
        }
      }
    }
    const callsOf = new Map<string, string[]>();
    const calls = (id: string) => {
      let c = callsOf.get(id);
      if (!c) callsOf.set(id, (c = callNames(names.get(id) ?? "")));
      return c;
    };
    /** Whose name a clause starts with, among `ids`: the longest match, as a count of the clause's words. */
    const whoStarts =
      (ids: Iterable<string>) =>
      (clause: string): Subject => {
        const words = plain(clause).split(" ");
        let best: Subject = null;
        for (const id of ids) {
          for (const name of calls(id)) {
            const k = name.split(" ").length;
            if (words.slice(0, k).join(" ") === name && (!best || k > best.words)) best = { id, words: k };
          }
        }
        return best;
      };

    // Each at-bat's last pitch, as its result says: ESPN sometimes files more pitches under an at-bat that's over (after a
    // strike three overturned on review), and its own box score doesn't count them. And each pitch's last filing: ESPN files a
    // pitch again when its call changes (a pitch challenged under ABS, "Ball 2" then "Strike 1 Looking", typed
    // "strike-looking---overturned"; a single, then "batter reached on error"), and the last is the call that stands.
    const lastPitch = new Map<string, number>();
    const lastFiling = new Map<string, number>(); // "<at-bat>:<pitch number>" -> its index in raw
    // And each at-bat's result's: ESPN files that again too when the scorer changes it ("Bazzana struck out, Bazzana to first
    // on passed ball by Caratini.", then "... safe at first on throwing error by catcher Caratini.", both pitch 5).
    const lastResult = new Map<string, number>();
    // Each at-bat's batter, from its start and its pitches: a strikeout the batter reached first on (a wild pitch, a passed ball)
    // lists them only on first.
    const batterOf = new Map<string, string>();
    raw.forEach((p, i) => {
      const n = num(p.atBatPitchNumber);
      const st = str(p.summaryType) ?? "";
      // A batter's result: one that lists him, or a strikeout he reached first on (which lists him only on first).
      const batterResult = p.participants?.some((x) => x.type === "batter") || /\b(?:struck|strikes) out\b|\bcalled out on strikes\b/i.test(str(p.text) ?? "");
      if (["N", "S"].includes(st) && batterResult && p.atBatId && n != null) {
        lastPitch.set(p.atBatId, n);
        lastResult.set(`${p.atBatId}:${n}`, i);
      }
      if (st === "P" && p.atBatId && n != null) lastFiling.set(`${p.atBatId}:${n}`, i);
      const b = idOf(p.participants?.find((x) => x.type === "batter")?.athlete?.id);
      if ((st === "P" || st === "A") && p.atBatId && b) batterOf.set(p.atBatId, b);
    });
    // Each at-bat's pitches so far, who threw them and how they changed the count: a relief pitcher who came in with more
    // balls than strikes (2-0, 2-1, 3-0, 3-1, 3-2) and walked the batter, walked him for the one before (the rules' 9.16(h)).
    const thrown = new Map<string, { pitcher: string | null; ball: boolean }[]>();
    // At-bats a muffed foul fly prolonged ("Wells continues to at bat after dropped foul ball by catcher Rutschman"): an out the
    // fielders missed, if the batter then reaches (the rules' 9.16(a)).
    const prolonged = new Set<string>();

    const out: Play[] = [];
    const score: Record<string, number> = { [away]: 0, [home]: 0 };
    const pitcherOf = new Map<string, string>(); // fielding team -> pitcher now
    const started = new Set<string>(); // fielding teams whose starter has thrown
    let half: "top" | "bottom" = "top";
    let period = 1;
    let openedBy: string | null = null; // the pitcher who started the half-inning
    let outs = 0;
    // Outs plus the errors that let a batter reach (the inning as it would have gone without them): a run that scores once it
    // reaches three is unearned (the rules' 9.16(a)).
    let chances = 0;
    let bases: (string | null)[] = [null, null, null];
    const runners = new Map<string, Runner>();
    // Who ran for whom: ESPN's at-bat starts (and sometimes its play-results) still show the one a pinch runner replaced.
    const ranFor = new Map<string, string>();
    const now = (id: string | null) => {
      for (let n = 0; id && ranFor.has(id) && n < 9; n++) id = ranFor.get(id)!;
      return id;
    };

    const batting = () => (half === "top" ? away : home);
    const fielding = () => (half === "top" ? home : away);
    const basesOf = (p: EspnPlay): (string | null)[] => BASES.map((b) => now(idOf(p.participants?.find((x) => x.type === b)?.athlete?.id) || null));
    const roleOf = (p: EspnPlay, role: string) => idOf(p.participants?.find((x) => x.type === role)?.athlete?.id) || null;
    const emit = (p: EspnPlay, i: number, kind: string, deltas: Record<string, Stats>, team: string | null) => {
      const clean: Record<string, Stats> = {};
      for (const [who, d] of Object.entries(deltas)) {
        const s = addStats({}, d);
        if (who && Object.keys(s).length) clean[who] = s;
      }
      out.push({
        id: idOf(p.id) || `${i}`,
        at: str(p.wallclock),
        period,
        half,
        clock: null,
        text: str(p.text) ?? "",
        kind,
        team,
        unit: str(p.atBatId),
        people: [...new Set((p.participants ?? []).map((x) => idOf(x.athlete?.id)).filter(Boolean))],
        score: { ...score },
        deltas: clean,
      });
    };
    const add = (deltas: Record<string, Stats>, who: string | null, d: Stats) => {
      if (!who) return;
      deltas[who] = addStats(deltas[who] ?? {}, d);
    };
    /** Bring the bases to ESPN's say (an at-bat's start: who's on before it): a new face where someone was is their pinch
     *  runner, charged to the same pitcher; one on an empty base (extra innings' runner on second) is the pitcher's, unearned. */
    const syncBases = (on: (string | null)[]) => {
      if (on.every((x, i) => x === bases[i])) return;
      for (let b = 0; b < 3; b++) {
        const id = on[b];
        if (!id || bases.includes(id)) continue;
        const was = bases[b];
        const from = was && !on.includes(was) ? runners.get(was) : null;
        runners.set(id, from ? { ...from } : { pitcher: pitcherOf.get(fielding()) ?? null, unearned: !was && this.runnerOnSecond });
      }
      for (const id of bases) if (id && !on.includes(id)) runners.delete(id);
      bases = on;
    };

    for (let i = 0; i < raw.length; i++) {
      const p = raw[i];
      const type = str(p.type?.type) ?? "";
      const st = str(p.summaryType);
      if (type === "start-inning") {
        half = /^bottom/i.test(str(p.period?.type) ?? "") ? "bottom" : "top";
        period = num(p.period?.number) ?? period;
        outs = 0;
        chances = 0;
        openedBy = null;
        bases = [null, null, null];
        runners.clear();
        emit(p, i, "inning", {}, batting());
        continue;
      }
      if (type === "end-inning") {
        // An inning the game went on from ended on three outs, recorded or not (ESPN sometimes leaves out the last one): the
        // pitcher on the mound gets any it didn't record. A walk-off's or a called game's last inning ends where it ends.
        const goesOn = raw.slice(i + 1).some((q) => str(q.type?.type) === "start-inning");
        if (goesOn && outs < 3) {
          const pitcher = pitcherOf.get(fielding()) ?? null;
          issues?.push(`${idOf(p.id)}: ${3 - outs} out(s) not recorded before: ${str(p.text) ?? ""}`);
          const deltas: Record<string, Stats> = {};
          add(deltas, pitcher, { OUTS: 3 - outs });
          outs = 3;
          emit(p, i, "outs", deltas, fielding());
        }
        continue;
      }
      if (type === "end-batterpitcher") continue;
      if (st === "A" || type === "start-batterpitcher") {
        const pitcher = roleOf(p, "pitcher");
        const deltas: Record<string, Stats> = {};
        if (pitcher) {
          pitcherOf.set(fielding(), pitcher);
          openedBy ??= pitcher;
          if (!started.has(fielding())) {
            started.add(fielding());
            add(deltas, pitcher, { GS: 1 });
          }
        }
        syncBases(basesOf(p));
        emit(p, i, "at-bat", deltas, batting());
        continue;
      }
      if (st === "P") {
        // A pitch once, as its last filing calls it (lastFiling).
        const nth = num(p.atBatPitchNumber);
        const last = p.atBatId ? lastPitch.get(p.atBatId) : undefined;
        if (last != null && (nth ?? 0) > last) continue;
        if (nth != null && p.atBatId && lastFiling.get(`${p.atBatId}:${nth}`) !== i) continue;
        const pitcher = roleOf(p, "pitcher") ?? pitcherOf.get(fielding()) ?? null;
        const batter = roleOf(p, "batter");
        const call = pitchCall(type);
        const deltas: Record<string, Stats> = {};
        if (call !== "automatic") {
          add(deltas, batter, { NP: 1 });
          add(deltas, pitcher, { PC: 1, PST: call === "strike" ? 1 : 0 });
        }
        if (p.atBatId) {
          const log = thrown.get(p.atBatId) ?? [];
          log.push({ pitcher, ball: call === "ball" || /^automatic-ball/.test(type) });
          thrown.set(p.atBatId, log);
        }
        const inPlay = call === "strike" && !/^(?:strike|foul|bunted-foul|missed-bunt|swinging)/.test(type);
        emit(p, i, call === "automatic" ? "automatic-ball" : inPlay ? "in-play" : call, deltas, batting());
        continue;
      }
      // A typed play ESPN also records as a play-result with the same text (a stolen base, a wild pitch): read the play-result.
      if (!st || !["N", "S", "C"].includes(st)) {
        // Its twin is near it, before or after (pitches can come between): its text the same bar a review note, or a
        // play-result on the same pitch of the same at-bat that tells it otherwise: in MLB's words after a challenge
        // ("Kiner-Falefa stole second." and "Red Sox challenged (tag play), ...: Isiah Kiner-Falefa steals (3) 2nd base."), or
        // with the batter's result ("Abrams picked off and caught stealing second." and "Young struck out swinging, Abrams
        // caught stealing second, catcher to second.": the runner it names).
        const said = (q: EspnPlay) => (str(q.text) ?? "").replace(REVIEW, "").trim();
        const near = [...raw.slice(Math.max(0, i - 8), i), ...raw.slice(i + 1, i + 9)];
        const runner = /^\p{Lu}[\p{L}.'-]*(?:\s+\p{Lu}[\p{L}.'-]*)*/u.exec(str(p.text) ?? "")?.[0];
        const nth = num(p.atBatPitchNumber);
        const samePitch = (q: EspnPlay) =>
          ["N", "S"].includes(str(q.summaryType) ?? "") && !!p.atBatId && q.atBatId === p.atBatId && nth != null && num(q.atBatPitchNumber) === nth && (!q.participants?.some((x) => x.type === "batter") || (!!runner && said(q).includes(`${runner} `)));
        const twin = near.some((q) => (["N", "S", "C"].includes(str(q.summaryType) ?? "") && said(q) === said(p)) || samePitch(q));
        if (twin || !str(p.text)) continue;
      }
      const text = str(p.text) ?? "";
      const pitcher = roleOf(p, "pitcher") ?? pitcherOf.get(fielding()) ?? null;
      if (pitcher) pitcherOf.set(fielding(), pitcher);

      // A pitching change ("Uribe relieved Misiorowski"), a substitution ("Vilade hit for Walls", "Lara in right field").
      const listed = roleOf(p, "batter");
      const ran = /^(.+?) ran for (.+?)\.?$/.exec(text);
      if (st === "C" || (!listed && !BASES.some((b) => p.participants?.some((x) => x.type === b)) && !/\b(?:stole|steals|caught stealing|picked off|picks off|scored|scores|wild pitch|passed ball|balk|advanced|to (?:second|third)|out\b)/.test(text))) {
        if (ran) {
          // A pinch runner takes the base, and the pitcher charged if they score, of the one they ran for.
          const forWho = whoStarts(bases.filter((x): x is string => !!x))(ran[2]);
          const roster = [...teamOf.entries()].filter(([, t]) => t === batting()).map(([id]) => id);
          const runner = whoStarts(roster.filter((id) => !bases.includes(id)))(ran[1]);
          if (forWho && runner) {
            bases = bases.map((x) => (x === forWho.id ? runner.id : x));
            runners.set(runner.id, runners.get(forWho.id) ?? { pitcher, unearned: false });
            runners.delete(forWho.id);
            ranFor.set(forWho.id, runner.id);
          }
        }
        emit(p, i, st === "C" ? "pitching-change" : "substitution", {}, st === "C" ? fielding() : batting());
        continue;
      }

      // A muffed foul fly: the at-bat goes on, and nothing counts yet (prolonged).
      if (/\bcontinues (?:to )?at bat\b/i.test(text)) {
        if (p.atBatId) prolonged.add(p.atBatId);
        emit(p, i, "dropped-foul", {}, batting());
        continue;
      }

      const before = bases;
      // Who's on after it, as ESPN lists them (a play-result lists the bases after it); in a feed whose runner's play-results list
      // nobody (college's wild pitch or balk), as its text moves them (below).
      const listsBases = !!listed || BASES.some((b) => p.participants?.some((x) => x.type === b));
      let after = basesOf(p);
      const onBefore = before.filter((x): x is string => !!x);
      const was = new Map(runners);
      // The at-bat's batter, listed or not.
      const atBatter = listed ?? (p.atBatId ? (batterOf.get(p.atBatId) ?? null) : null);
      // A clause's subject: someone on base or batting, else anyone on the batting side (a runner ESPN's bases don't show:
      // extra innings' runner on second), else anyone in the game.
      const cast = new Set<string>([...onBefore, ...after.filter((x): x is string => !!x), ...(atBatter ? [atBatter] : [])]);
      const side = [...teamOf.entries()].filter(([, t]) => t === batting()).map(([id]) => id);
      const clauses = clausesOf(text, (c) => whoStarts(cast)(c) ?? whoStarts(side)(c) ?? whoStarts(names.keys())(c));
      if (!listsBases && this.basesFromText) after = movedBy(before, clauses);
      const deltas: Record<string, Stats> = {};

      // The batter: the one listed, or the at-bat's when a clause starts with them doing a batter's thing (a strikeout they
      // reached first on: "Friedl struck out, Friedl to first on passed ball by Ruiz", which lists them only on first).
      const first = atBatter ? clauses.find((c) => c.id === atBatter) : undefined;
      const batter = listed ?? (first && BATTER_VERB.exec(first.rest)?.index === 0 ? atBatter : null);
      // A result the scorer filed again, changed (lastResult): the last stands, read where it is (every refiling seen comes
      // right after the one it replaces).
      if (batter && p.atBatId && (lastResult.get(`${p.atBatId}:${num(p.atBatPitchNumber)}`) ?? i) > i) continue;
      // The batter's clause: the first one that starts with them.
      const mine = batter ? first : undefined;
      const lead = clauses.find((c) => BATTER_VERB.test(c.rest))?.rest ?? text;
      // With the fielders after it, which have no subject ("sacrificed into double play", "left to catcher to third").
      const fielders: string[] = [];
      for (const c of mine ? clauses.slice(clauses.indexOf(mine) + 1) : []) {
        if (c.id) break;
        fielders.push(c.rest);
      }
      const outcome: Outcome | null = batter ? outcomeOf(mine ? [mine.rest, ...fielders].join(", ") : lead.slice(Math.max(0, lead.search(BATTER_VERB)))) : null;
      const runs = Math.max(0, num(p.scoreValue) ?? 0);
      const scoredClause = (id: string) => clauses.find((c) => c.id === id && SCORED.test(c.rest));

      // Who scored: whoever the text says did ("Lombard Jr. scored", "Jones stole home"), and the batter on a home run.
      const scored: string[] = [];
      for (const c of clauses) {
        if (c.id && !scored.includes(c.id) && scoredClause(c.id) === c) scored.push(c.id);
      }
      if (batter && outcome === "home-run" && !scored.includes(batter)) scored.push(batter);
      if (scored.length !== runs) {
        // The text named more: not someone who wasn't on base (who'd scored already: college's "J. Pyne scored" again after his
        // run on a balk).
        for (const id of [...scored]) if (scored.length > runs && id !== batter && !before.includes(id)) scored.splice(scored.indexOf(id), 1);
        // The text didn't name them all: the runners who aren't on base after it and weren't put out, lead runner first.
        const outNamed = new Set(clauses.filter((c) => c.id && RUNNER_OUT.test(c.rest)).map((c) => c.id!));
        const gone = [...before].reverse().filter((x): x is string => !!x && !after.includes(x) && !outNamed.has(x) && !scored.includes(x));
        while (scored.length < runs && gone.length) scored.push(gone.shift()!);
        if (scored.length !== runs) issues?.push(`${idOf(p.id)}: ${runs} run(s), read ${scored.length} scoring: ${text}`);
        // More than ESPN's count, every one on base before it, stand when the text is the truth (college's scoreValue can say
        // fewer: "J. Walk and C. Johnson scored" for 1).
        if (!this.namedRunsStand) scored.length = Math.min(scored.length, runs);
      }
      /** Whether the batter drove a run in (the rules' 9.04): not on a ground ball's double play (a force); on reaching by an
       *  error, only a run from third with fewer than two outs (it would have scored on the out); else unless it scored on a
       *  fielder's error, a wild pitch, a passed ball or a balk. A fly's double play (the runner tagged and scored, another was
       *  doubled off) drives it in. */
      const driven = (id: string) => {
        if (outcome === "double-play" && /^grounded into\b|\bforce\b/i.test(mine?.rest ?? "")) return false;
        if (outcome === "error" && !(outs < 2 && before[2] === id)) return false;
        const how = scoredClause(id)?.rest ?? "";
        // "Scored on error" with no fielder named goes with the batter's own play (it would have scored on it: ESPN credits
        // it); "scored on throwing error by third baseman Ortiz" was the fielder's doing.
        if (/\b(?:wild pitch|passed ball|balk)\b|\berror by\b/i.test(how)) return false;
        return true;
      };
      // The inning without its errors: the batter reaching on one is a chance the fielders missed (and a runner safe on one, on
      // a play made on them: below), as is a strikeout he reached first on by a passed ball or an error, and his reaching at
      // all once a muffed foul fly prolonged the at-bat.
      const reached = !!batter && (after.includes(batter) || scored.includes(batter));
      const reach = outcome === "strikeout" && reached ? (clauses.find((c) => c.id === batter && c !== mine)?.rest ?? "") : "";
      const missed = outcome === "error" || outcome === "interference" || /\b(?:passed ball|error)\b/i.test(reach) || (reached && !!p.atBatId && prolonged.has(p.atBatId)) ? 1 : 0;
      let missedOuts = 0;
      // Who the batter's line goes on for the pitcher: the one throwing, but a walk a relief pitcher came in to with more balls
      // than strikes (2-0, 2-1, 3-0, 3-1, 3-2) is the one's before him (the rules' 9.16(h)), and so is the run if he scores.
      let charged = pitcher;
      if ((outcome === "walk" || outcome === "intentional-walk") && p.atBatId) {
        // The relief pitcher's first pitch, or past the last when he threw none (an intentional walk signalled).
        const log = thrown.get(p.atBatId) ?? [];
        const own = log.findIndex((x) => x.pitcher === pitcher);
        const k = own < 0 ? log.length : own;
        const balls = log.slice(0, k).filter((x) => x.ball).length;
        if (k > 0 && balls >= 2 && balls > Math.min(2, k - balls)) charged = log[k - 1].pitcher ?? pitcher;
      }

      /** A ground ball's double play is one grounded into (GIDP) only as a force or a reverse force: a runner who had to run
       *  (from first; from second with first taken; from third with both) put out at the base he had to reach. Not "Holliday
       *  grounded into double play, shortstop to first to first to pitcher, Alonso out at third" (Alonso from first), nor a
       *  runner on second with first empty run down; text that names no runner out, or no base, stays one. */
      const forcedOut = () => {
        const putOut = clauses.filter((c) => c.id && c.id !== batter && RUNNER_OUT.test(c.rest));
        return (
          !putOut.length ||
          putOut.some((c) => {
            const from = before.indexOf(c.id);
            const at = /\bat (second|2nd|third|3rd|home)\b/i.exec(c.rest)?.[1].toLowerCase();
            const to = at === "second" || at === "2nd" ? 1 : at === "third" || at === "3rd" ? 2 : at === "home" ? 3 : null;
            return to == null || (from >= 0 && to === from + 1 && before.slice(0, from).every(Boolean));
          })
        );
      };

      // The batter.
      if (batter && outcome) {
        const { batter: b, pitcher: pt } = batterLines(outcome);
        if (outcome === "double-play" && /^grounded into (?:a )?double play/i.test(mine?.rest ?? "") && forcedOut()) b.GIDP = 1;
        b.RBI = scored.filter(driven).length;
        add(deltas, batter, b);
        add(deltas, charged, pt);
      }

      // Runners: steals, and who's out.
      let made = 0;
      for (const c of clauses) {
        if (!c.id) continue;
        if (STOLE.test(c.rest)) add(deltas, c.id, { SB: 1 });
        if (/caught stealing/i.test(c.rest)) add(deltas, c.id, { CS: 1 });
        if (c.id !== batter && RUNNER_OUT.test(c.rest) && !scored.includes(c.id)) made++;
      }
      // A runner safe on an error: on a play made on them (a botched force), an out the fielders missed, so their run won't be
      // earned; else a base the error gave them.
      const onPlay = outcome === "fielders-choice" || outcome === "out" || outcome === "double-play";
      for (const c of clauses) {
        if (!c.id || c.id === batter || !/\berror\b/i.test(c.rest) || SCORED.test(c.rest)) continue;
        const r = runners.get(c.id) ?? was.get(c.id);
        if (!r) continue;
        if (onPlay && /^safe\b/i.test(c.rest)) {
          runners.set(c.id, { ...r, unearned: true });
          missedOuts++;
        } else runners.set(c.id, { ...r, helped: true });
      }
      if (batter && !after.includes(batter) && !scored.includes(batter)) made++;

      // The runs: the runner's, charged to the pitcher who put them on base; earned unless the runner reached on an error, it
      // scored on a passed ball, or the inning would have been over without the errors (the rules' 9.16).
      for (const id of scored) {
        add(deltas, id, { R: 1 });
        // A runner nobody put on (extra innings' runner on second) counts as reaching on an error: the half's first pitcher's,
        // unearned.
        const r = id === batter ? { pitcher: charged, unearned: missed > 0 } : (was.get(id) ?? { pitcher: openedBy ?? pitcher, unearned: this.runnerOnSecond && period > this.periods.regulation });
        const helped = !!(r as Runner | undefined)?.helped && !(outcome && outcome in HITS);
        const earned = !r?.unearned && !helped && chances + missed + missedOuts < 3 && !/\bpassed ball\b/i.test(scoredClause(id)?.rest ?? "");
        add(deltas, r?.pitcher ?? pitcher, { PR: 1, ER: earned ? 1 : 0 });
        score[batting()] = (score[batting()] ?? 0) + 1;
      }

      // Outs: the pitcher on the mound gets them. A batter's play-result carries the outs after it, which settles a play whose
      // text doesn't say who was out ("Adell grounded into fielder's choice to third, Soler to second"); a steal's, in the
      // middle of an at-bat, carries the at-bat's, so there the text's count stands (and so does a strikeout's whose batter
      // isn't listed).
      const said = listed ? this.outsSaid(p, outs, made) : null;
      if (said != null && said >= outs && said <= 3 && said !== Math.min(3, outs + made)) {
        issues?.push(`${idOf(p.id)}: read ${made} out(s), ESPN says ${said - outs}: ${text}`);
        made = said - outs;
      }
      const outsBefore = outs;
      outs = Math.min(3, outs + made);
      chances += made + missed + missedOuts;
      add(deltas, pitcher, { OUTS: outs - outsBefore });

      // Who's on now, and who's charged if they score: the batter reached on this pitcher, unless a fielder's choice put out an
      // earlier pitcher's runner (that pitcher stays charged: the rules' 9.16(g)).
      for (const id of [...onBefore, ...scored]) if (!after.includes(id)) runners.delete(id);
      if (batter && after.includes(batter)) {
        const forced = outcome === "fielders-choice" ? onBefore.find((id) => !after.includes(id) && !scored.includes(id)) : undefined;
        runners.set(batter, (forced && was.get(forced)) || { pitcher: charged, unearned: missed > 0 });
      }
      bases = outs >= 3 ? [null, null, null] : after;
      emit(p, i, batter && outcome ? outcome : this.runnerKind(clauses), deltas, batting());
    }
    return inOrder(out);
  }

  /** A play with no batter's result: what the runners did. */
  private runnerKind(clauses: { id: string | null; rest: string }[]): string {
    const r = clauses.map((c) => c.rest.toLowerCase()).join(" ");
    if (/caught stealing/.test(r)) return "caught-stealing";
    if (/picked off/.test(r)) return "pickoff";
    if (/\bstole\b|\bsteals\b/.test(r)) return "stolen-base";
    if (/wild pitch/.test(r)) return "wild-pitch";
    if (/passed ball/.test(r)) return "passed-ball";
    if (/\bbalk\b/.test(r)) return "balk";
    return "runners";
  }
}
