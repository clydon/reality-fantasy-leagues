import { TeamSport, addStats, cleanDeltas, count, headerTeams, idOf, inOrder, isFinal, num, pair, position as pos, ratio, rosterOf, str, val as n, type Box, type BoxPerson, type BoxTeam, type EspnPlay, type EspnSummary, type EspnTable, type LockCadence, type Periods, type Play, type Position, type PositionGroup, type StatDef, type Stats } from "./sport";

// Football (the NFL; college football's plays are written otherwise, so it waits for L5): its vocabulary and ESPN's readers.
//
// How ESPN records an NFL game (checked on the 2026 season's weeks 3-7 and the 2025-26 playoffs, 2026-10-28): its plays sit
// in drives (`drives.previous`, and live `drives.current`), each typed ("Rush", "Pass Reception", "Sack", "Punt") with its
// clock, the score after it (`awayScore`, `homeScore`) and who had the ball where when it began (`start.team`, `start.yardLine`
// from the home side's goal line), but with no people: who did what is only in its text, the league's own play-by-play
// ("C.McCaffrey left end to SF 36 for 5 yards (X.Watts).", "B.Purdy pass short right intended for J.Cowing INTERCEPTED by
// J.Bates at ATL 10. J.Bates ran ob at ATL 10 for no gain.", "PENALTY on SF-T.Williams, False Start, 5 yards, enforced at
// SF 36 - No Play."). So the reader reads the text sentence by sentence, as Baseball's does, with each name (a first initial
// or two and a last name, "Bi.Robinson" when two share one) matched against the box score's people on the side that name
// should be on: the passer, runner and receiver the offense's, the tacklers the other side's, a kick's returner the
// receiving side's, "RECOVERED by ATL-G.Dexter" whoever ATL is. Its team codes are the league's (HST, BLT, CLV, ARZ, LA, WAS),
// not always ESPN's, so each game's are learned from its kickoffs ("kicks 63 yards from ATL 35"). A few scoring plays come
// only as a summary with full names ("Dallas Goedert 9 Yd pass from Jalen Hurts (Jake Elliott Kick)"), read as such.
//
// The stat crew's calls are judged: ESPN's box score can split a sack the text gives one player, or count a tackle, a tackle
// for loss, a pass defended or a QB hit the text doesn't name. A team's defense and special teams (Yahoo's DEF) is one more
// line per side (`defenseId`): its sacks, takeaways, touchdowns, safeties, blocked kicks and points allowed (Yahoo's: not a
// safety, a turnover's return touchdown or a defensive two-point return).

const PASSING = "passing";
const RUSHING = "rushing";
const RECEIVING = "receiving";
const FUMBLES = "fumbles";
const DEFENSE = "defense";
const INTERCEPTIONS = "interceptions";
const RETURNS = "returns";
const KICKING = "kicking";
const PUNTING = "punting";
const TEAM_DEFENSE = "team-defense";
const TWO_POINT = "two-point";

const judged = (def: StatDef): StatDef => ({ ...def, judged: true });
const derived = (key: string, label: string, short: string, noun: string, group: string, of: (s: Stats) => number | null, better: "higher" | "lower" = "higher"): StatDef => ({ key, label, short, noun, group, better, kind: "derived", of });
const rate = (key: string, label: string, short: string, noun: string, group: string, of: (s: Stats) => number | null, better: "higher" | "lower" = "higher"): StatDef => ({ key, label, short, noun, group, better, kind: "rate", of });
/** Points allowed in a bracket, Yahoo's (0, 1-6, 7-13 ... 35 and more): 1 when a team defense's points allowed fall in it. */
const allowed = (key: string, from: number, to: number | null) => {
  const label = to == null ? `${from}+ points allowed` : from === to ? "Shutouts" : `${from}-${to} points allowed`;
  return derived(key, label, to == null ? `PA ${from}+` : `PA ${from}-${to}`, from === to ? "shutout" : `game allowing ${to == null ? `${from} or more` : `${from} to ${to}`}`, TEAM_DEFENSE, (s) => (n(s, "PA") >= from && (to == null || n(s, "PA") <= to) ? 1 : 0));
};

const STATS: StatDef[] = [
  count("CMP", "Completions", "CMP", "completion", PASSING),
  count("PATT", "Passing attempts", "ATT", "pass attempt", PASSING),
  // A passer's yards as the league counts them, before sacks (the team's net passing yards are less its sacks' yards).
  count("PYDS", "Passing yards", "YDS", "passing yard", PASSING),
  count("PTD", "Passing touchdowns", "TD", "passing touchdown", PASSING),
  count("INT", "Interceptions thrown", "INT", "interception thrown", PASSING, "lower"),
  count("SACKED", "Times sacked", "SCK", "sack taken", PASSING, "lower"),
  count("SACKYDS", "Sack yards lost", "SYL", "yard lost to a sack", PASSING, "lower"),
  count("P2PT", "Two-point passes", "2PT", "two-point pass", TWO_POINT),
  derived("NPYDS", "Net passing yards", "NET", "net passing yard", PASSING, (s) => n(s, "PYDS") - n(s, "SACKYDS")),
  rate("CMP%", "Completion percentage", "PCT", "completion percentage", PASSING, (s) => ratio(n(s, "CMP"), n(s, "PATT"))),
  rate("YPA", "Yards per pass attempt", "AVG", "yards per pass attempt", PASSING, (s) => ratio(n(s, "PYDS"), n(s, "PATT"))),

  count("RATT", "Rushing attempts", "CAR", "carry", RUSHING),
  count("RYDS", "Rushing yards", "YDS", "rushing yard", RUSHING),
  count("RTD", "Rushing touchdowns", "TD", "rushing touchdown", RUSHING),
  count("R2PT", "Two-point runs", "2PT", "two-point run", TWO_POINT),
  rate("YPC", "Yards per carry", "AVG", "yards per carry", RUSHING, (s) => ratio(n(s, "RYDS"), n(s, "RATT"))),

  count("REC", "Receptions", "REC", "reception", RECEIVING),
  count("RECYDS", "Receiving yards", "YDS", "receiving yard", RECEIVING),
  count("RECTD", "Receiving touchdowns", "TD", "receiving touchdown", RECEIVING),
  // Whom a pass was meant for is the stat crew's call (ESPN's box counts one the text doesn't name, or one on a play a
  // penalty wiped).
  judged(count("TGT", "Targets", "TGTS", "target", RECEIVING)),
  count("RE2PT", "Two-point catches", "2PT", "two-point catch", TWO_POINT),
  rate("YPR", "Yards per reception", "AVG", "yards per reception", RECEIVING, (s) => ratio(n(s, "RECYDS"), n(s, "REC"))),

  count("FUM", "Fumbles", "FUM", "fumble", FUMBLES, "lower"),
  count("FUML", "Fumbles lost", "LOST", "fumble lost", FUMBLES, "lower"),
  count("FREC", "Fumbles recovered", "REC", "fumble recovered", FUMBLES),
  // An offensive player's own side's fumble, recovered and run in (Yahoo's "offensive fumble return TD").
  count("FRTD", "Fumble return touchdowns", "FRTD", "fumble return touchdown", FUMBLES),
  // Every way a player scores two: Yahoo's "2-point conversion" (the passer and the catcher both).
  derived("2PT", "Two-point conversions", "2PT", "two-point conversion", TWO_POINT, (s) => n(s, "P2PT") + n(s, "R2PT") + n(s, "RE2PT")),

  judged(count("TCK", "Tackles", "TOT", "tackle", DEFENSE)),
  judged(count("SOLO", "Solo tackles", "SOLO", "solo tackle", DEFENSE)),
  judged(count("SACK", "Sacks", "SACKS", "sack", DEFENSE)),
  judged(count("TFL", "Tackles for loss", "TFL", "tackle for loss", DEFENSE)),
  judged(count("PD", "Passes defended", "PD", "pass defended", DEFENSE)),
  judged(count("QBH", "QB hits", "QB HTS", "QB hit", DEFENSE)),
  // Any return touchdown a defender scores: an interception's, a fumble's, a blocked kick's.
  count("DTD", "Defensive touchdowns", "TD", "defensive touchdown", DEFENSE),
  judged(count("FF", "Forced fumbles", "FF", "forced fumble", DEFENSE)),
  count("SAF", "Safeties", "SAF", "safety", DEFENSE),
  count("BLKK", "Blocked kicks", "BLK", "blocked kick", DEFENSE),

  count("DINT", "Interceptions", "INT", "interception", INTERCEPTIONS),
  count("DINTYDS", "Interception return yards", "YDS", "interception return yard", INTERCEPTIONS),
  count("DINTTD", "Interception return touchdowns", "TD", "pick-six", INTERCEPTIONS),

  count("KR", "Kick returns", "KR", "kick return", RETURNS),
  count("KRYDS", "Kick return yards", "KR YDS", "kick return yard", RETURNS),
  count("KRTD", "Kick return touchdowns", "KR TD", "kick return touchdown", RETURNS),
  count("PR", "Punt returns", "PR", "punt return", RETURNS),
  count("PRYDS", "Punt return yards", "PR YDS", "punt return yard", RETURNS),
  count("PRTD", "Punt return touchdowns", "PR TD", "punt return touchdown", RETURNS),
  derived("RETTD", "Return touchdowns", "RET TD", "return touchdown", RETURNS, (s) => n(s, "KRTD") + n(s, "PRTD")),

  count("FGM", "Field goals made", "FGM", "field goal made", KICKING),
  count("FGA", "Field goals attempted", "FGA", "field goal attempted", KICKING),
  // By how far, as the plays say it (ESPN's box gives only the totals).
  count("FGM0", "Field goals made, 0-19 yards", "0-19", "field goal from under 20 yards", KICKING),
  count("FGM20", "Field goals made, 20-29 yards", "20-29", "field goal from 20-29 yards", KICKING),
  count("FGM30", "Field goals made, 30-39 yards", "30-39", "field goal from 30-39 yards", KICKING),
  count("FGM40", "Field goals made, 40-49 yards", "40-49", "field goal from 40-49 yards", KICKING),
  count("FGM50", "Field goals made, 50+ yards", "50+", "field goal from 50 yards or more", KICKING),
  derived("FGMISS", "Field goals missed", "MISS", "missed field goal", KICKING, (s) => n(s, "FGA") - n(s, "FGM"), "lower"),
  count("XPM", "Extra points made", "XPM", "extra point", KICKING),
  count("XPA", "Extra points attempted", "XPA", "extra point attempted", KICKING),
  derived("XPMISS", "Extra points missed", "XP MISS", "missed extra point", KICKING, (s) => n(s, "XPA") - n(s, "XPM"), "lower"),
  derived("KPTS", "Kicking points", "PTS", "kicking point", KICKING, (s) => 3 * n(s, "FGM") + n(s, "XPM")),
  rate("FG%", "Field goal percentage", "PCT", "field goal percentage", KICKING, (s) => ratio(n(s, "FGM"), n(s, "FGA"))),

  count("PUNT", "Punts", "NO", "punt", PUNTING),
  count("PUNTYDS", "Punt yards", "YDS", "punt yard", PUNTING),
  count("PUNTTB", "Punt touchbacks", "TB", "punt touchback", PUNTING, "lower"),
  count("PUNTIN20", "Punts inside the 20", "In 20", "punt inside the 20", PUNTING),
  rate("PUNTAVG", "Yards per punt", "AVG", "yards per punt", PUNTING, (s) => ratio(n(s, "PUNTYDS"), n(s, "PUNT"))),

  // A team's defense and special teams, as one line (defenseId): Yahoo's DEF. DSTG is its one game, so its line is there from
  // the kickoff (a shutout with nothing else to show is still a game).
  count("DSTG", "Team defense games", "G", "team defense game", TEAM_DEFENSE),
  judged(count("DSTSACK", "Team sacks", "SACK", "team sack", TEAM_DEFENSE)),
  count("DSTINT", "Team interceptions", "INT", "team interception", TEAM_DEFENSE),
  // The other side's fumbles it recovered (a change of possession; a muffed punt's too).
  count("DSTFR", "Team fumble recoveries", "FR", "team fumble recovery", TEAM_DEFENSE),
  // Its defense's and special teams' touchdowns: a return of an interception, a fumble, a blocked kick, a kickoff or a punt.
  count("DSTTD", "Team defense and return touchdowns", "TD", "team defense touchdown", TEAM_DEFENSE),
  count("DSTSAF", "Team safeties", "SAF", "team safety", TEAM_DEFENSE),
  count("DSTBLK", "Team blocked kicks", "BLK", "team blocked kick", TEAM_DEFENSE),
  // Yahoo's: the other side's points, but not a safety, a turnover's return touchdown or a defensive two-point return.
  count("PA", "Points allowed", "PA", "point allowed", TEAM_DEFENSE, "lower"),
  allowed("PA0", 0, 0),
  allowed("PA1_6", 1, 6),
  allowed("PA7_13", 7, 13),
  allowed("PA14_20", 14, 20),
  allowed("PA21_27", 21, 27),
  allowed("PA28_34", 28, 34),
  allowed("PA35", 35, null),
];

const GROUPS: PositionGroup[] = [
  { key: "offense", label: "Offense", stats: [PASSING, RUSHING, RECEIVING, TWO_POINT, FUMBLES, RETURNS] },
  { key: "defense", label: "Defense", stats: [DEFENSE, INTERCEPTIONS, FUMBLES, RETURNS] },
  { key: "kicking", label: "Kicking", stats: [KICKING, PUNTING, DEFENSE] },
  { key: "team", label: "Team defenses", stats: [TEAM_DEFENSE] },
];

// ESPN's roster abbreviations (a box score has none).
const POSITIONS: Position[] = [
  pos("QB", "Quarterback", "offense"),
  pos("RB", "Running back", "offense"),
  pos("FB", "Fullback", "offense"),
  pos("WR", "Wide receiver", "offense"),
  pos("TE", "Tight end", "offense"),
  pos("OT", "Offensive tackle", "offense"),
  pos("G", "Guard", "offense"),
  pos("C", "Center", "offense"),
  pos("OL", "Offensive lineman", "offense"),
  pos("DE", "Defensive end", "defense"),
  pos("DT", "Defensive tackle", "defense"),
  pos("NT", "Nose tackle", "defense"),
  pos("DL", "Defensive lineman", "defense"),
  pos("LB", "Linebacker", "defense"),
  pos("CB", "Cornerback", "defense"),
  pos("S", "Safety", "defense"),
  pos("DB", "Defensive back", "defense"),
  pos("PK", "Place kicker", "kicking"),
  pos("P", "Punter", "kicking"),
  pos("LS", "Long snapper", "kicking"),
  pos("DEF", "Team defense", "team"),
];

/** A team's defense and special teams as one of a game's people (Yahoo's DEF): its line in a GameState and a Box. */
export const defenseId = (team: string) => `def:${team}`;

// ESPN's box score tables, by name, their columns to our keys (a pair, "27/40" or "2-11", is two counts; PCT, AVG, LONG,
// QBR and the like aren't counts).
const BOX_TABLES: Record<string, Record<string, string | [string, string]>> = {
  passing: { "C/ATT": ["CMP", "PATT"], YDS: "PYDS", TD: "PTD", INT: "INT", SACKS: ["SACKED", "SACKYDS"] },
  rushing: { CAR: "RATT", YDS: "RYDS", TD: "RTD" },
  receiving: { REC: "REC", YDS: "RECYDS", TD: "RECTD", TGTS: "TGT" },
  fumbles: { FUM: "FUM", LOST: "FUML", REC: "FREC" },
  defensive: { TOT: "TCK", SOLO: "SOLO", SACKS: "SACK", TFL: "TFL", PD: "PD", "QB HTS": "QBH", TD: "DTD" },
  interceptions: { INT: "DINT", YDS: "DINTYDS", TD: "DINTTD" },
  kickReturns: { NO: "KR", YDS: "KRYDS", TD: "KRTD" },
  puntReturns: { NO: "PR", YDS: "PRYDS", TD: "PRTD" },
  kicking: { FG: ["FGM", "FGA"], XP: ["XPM", "XPA"] },
  punting: { NO: "PUNT", YDS: "PUNTYDS", TB: "PUNTTB", "In 20": "PUNTIN20" },
};
// The team's own totals ESPN gives, by its stat names: its players' added up (its passing yards net of sacks).
const TEAM: Record<string, string | [string, string]> = {
  completionAttempts: ["CMP", "PATT"],
  netPassingYards: "NPYDS",
  sacksYardsLost: ["SACKED", "SACKYDS"],
  interceptions: "INT",
  rushingAttempts: "RATT",
  rushingYards: "RYDS",
  fumblesLost: "FUML",
};

/* ---- The play reader's text helpers. ---- */

const SUFFIX = /^(?:jr|sr|ii|iii|iv|v)$/;
/** Letters only, lower case, no accents: "St. Brown" is "stbrown", "Smith-Njigba" "smithnjigba". */
const letters = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
/** For a full name in a summary's words: no accents, lower case, one space, no periods ("Kevin Coleman Jr."). */
const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();

/**
 * The ways the league's play-by-play names someone: their first name's first one to three letters, a period and their last name
 * ("C.McCaffrey", "Bi.Robinson", "A.St. Brown"), without a suffix ("M.Penix" for Michael Penix Jr.), with every tail of a
 * longer last name too; as keys, letters only ("bi.robinson", "a.stbrown").
 */
export function playNames(name: string): string[] {
  const words = name.trim().split(/\s+/).filter(Boolean);
  while (words.length > 2 && SUFFIX.test(letters(words[words.length - 1]))) words.pop();
  const first = letters(words[0] ?? "");
  const out = new Set<string>();
  for (let i = 1; i < words.length; i++) {
    const tail = words.slice(i).join("");
    // A hyphenated last name's first part too ("S.Joseph" for Sebastian Joseph-Day).
    for (const last of new Set([letters(tail), letters(tail.split("-")[0])])) {
      if (!last) continue;
      for (let k = 1; k <= Math.min(3, first.length); k++) out.add(`${first.slice(0, k)}.${last}`);
    }
  }
  return [...out];
}

/** A name as the play-by-play writes it: initials, a period, a last name of a word or two ("A.St. Brown", "L.Vander Esch",
 *  "J.van den Berg"). */
const NAME = /(?<![A-Za-z'])([A-Z][a-z]{0,2})\.((?:[a-z]{1,3} )*[A-Z][A-Za-z'-]*)(\.? [A-Z][a-z][A-Za-z'-]*)?/g;
/** A spot on the field: a side's code and a yard line ("SF 36", "SEA -4"), or midfield ("50"). */
const SPOT = /(?:([A-Z]{2,4}) (-?\d+)|\b50\b)/;
const SPOT_SRC = "(?:[A-Z]{2,4} -?\\d+|50)";
/** "for 5 yards", "for 1 yard", "for -4 yards", "for no gain". */
const GAIN = /for (?:(-?\d+) yards?|no gain)/;
const yardsOf = (s: string): number | null => {
  const m = GAIN.exec(s);
  return m ? (m[1] != null ? Number(m[1]) : 0) : null;
};

/** Sentences of a play's text: split at a period that ends one ("TOUCHDOWN.PENALTY", "(N.Muse). K.Black"), not a name's
 *  ("C.McCaffrey", "A.St. Brown"). */
export function sentencesOf(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== ".") continue;
    const before = /([A-Za-z]+)$/.exec(text.slice(start, i))?.[1] ?? "";
    const next = text[i + 1] ?? "";
    // A name's initials ("C.", "Bi.", "Bry.") right before its last name, or "St." in one ("A.St. Brown").
    const initials = /^[A-Z][a-z]{0,2}$/.test(before) && /[A-Za-z]/.test(next) && !/[A-Za-z'.]/.test(text[i - before.length - 1] ?? "");
    const saint = before === "St" && next === " " && /(?:^|[^A-Za-z])[A-Z][a-z]{0,2}\.$/.test(text.slice(0, i - before.length));
    if (initials || saint) continue;
    const s = text.slice(start, i + 1).trim();
    if (s) out.push(s);
    start = i + 1;
  }
  const rest = text.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}

/** What's said that isn't the play: who reported in, an injury, a challenge or review, a timeout. */
const NOISE = /^\)$|reported in as eligible|was injured during the play|Injury Update|has returned to the game|challenged the|Replay Official|ruling on the field|assisted by replay|play was Upheld|second runoff|Virtual Measurement|^\(Timeout #|^Direct snap to|^The previous play|^Touchback\.?$|^\.$|^\(?Kick formation\)?\.?$/i;

/** The kinds of gain a person makes, and what each counts as. */
type GainKind = "rush" | "catch" | "lateral-rush" | "lateral-catch" | "sack" | "kick-return" | "punt-return" | "int-return" | "fumble-return" | "blocked-return" | "none";

export class Football extends TeamSport {
  readonly id = "football";
  readonly name = "Football";
  readonly groups = GROUPS;
  readonly positions = POSITIONS;
  readonly statGroups = [
    { key: PASSING, label: "Passing" },
    { key: RUSHING, label: "Rushing" },
    { key: RECEIVING, label: "Receiving" },
    { key: TWO_POINT, label: "Two-point conversions" },
    { key: FUMBLES, label: "Fumbles" },
    { key: DEFENSE, label: "Defense" },
    { key: INTERCEPTIONS, label: "Interceptions" },
    { key: RETURNS, label: "Returns" },
    { key: KICKING, label: "Kicking" },
    { key: PUNTING, label: "Punting" },
    { key: TEAM_DEFENSE, label: "Team defense" },
  ];
  readonly stats = STATS;
  readonly periods: Periods = { word: "quarter", plural: "quarters", regulation: 4, extra: "overtime" };
  readonly lock: LockCadence = "weekly";
  // College football's play-by-play is written otherwise (jersey numbers, "pass complete ... caught at", "QB hurried by") and
  // its box score has no sacks taken or targets: L5, with college.
  readonly leagues = ["nfl"];

  readBox(summary: EspnSummary): Box | null {
    if (!summary.header) return null;
    const teams = headerTeams(summary);
    const people: Record<string, BoxPerson> = {};
    const totals = new Map<string, Record<string, EspnTable>>();
    for (const side of summary.boxscore?.players ?? []) {
      const team = idOf(side.team?.id);
      const tables: Record<string, EspnTable> = {};
      totals.set(team, tables);
      for (const table of side.statistics ?? []) {
        const name = str(table.name) ?? "";
        tables[name] = table;
        const map = BOX_TABLES[name];
        if (!map) continue;
        const labels = table.labels ?? [];
        for (const row of table.athletes ?? []) {
          const id = idOf(row.athlete?.id);
          if (!id) continue;
          const person = (people[id] ??= { id, name: str(row.athlete?.displayName) ?? "", team, position: this.positionKey(row.athlete?.position?.abbreviation ?? row.position?.abbreviation), stats: {} });
          const v = row.stats ?? [];
          if (!v.length) continue;
          // Only the columns this table has, zeros kept (the final's correction needs both).
          for (const [label, key] of Object.entries(map)) {
            const i = labels.indexOf(label);
            if (i < 0) continue;
            if (Array.isArray(key)) {
              const [a, b] = pair(v[i]) ?? [0, 0];
              person.stats[key[0]] = a;
              person.stats[key[1]] = b;
            } else person.stats[key] = num(v[i]) ?? 0;
          }
        }
      }
    }
    const teamStat = (team: string, name: string) => {
      const s = summary.boxscore?.teams?.find((t) => idOf(t.team?.id) === team)?.statistics?.find((x) => x.name === name);
      return s ? (typeof s.value === "number" ? s.value : num(s.displayValue)) : null;
    };
    for (const side of summary.boxscore?.teams ?? []) {
      const team = teams.find((t) => t.id === idOf(side.team?.id));
      if (!team) continue;
      for (const s of side.statistics ?? []) {
        const key = s.name ? TEAM[s.name] : undefined;
        if (!key) continue;
        if (Array.isArray(key)) {
          const p = pair(s.displayValue);
          if (p) [team.stats[key[0]], team.stats[key[1]]] = p;
        } else {
          const v = typeof s.value === "number" ? s.value : num(s.displayValue);
          if (v != null) team.stats[key] = v;
        }
      }
    }
    if (!teams.length || !Object.keys(people).length) return null;
    // Each side's defense and special teams, from its tables' totals: its sacks and interceptions, the other side's fumbles
    // lost (each one it recovered), its touchdowns (ESPN's "Defensive / Special Teams TDs"). Its safeties, blocked kicks and
    // points allowed only the plays say.
    for (const team of teams) {
      const other = teams.find((t) => t.id !== team.id);
      const total = (t: BoxTeam | undefined, table: string, label: string) => {
        const tb = t ? totals.get(t.id)?.[table] : undefined;
        const i = tb?.labels?.indexOf(label) ?? -1;
        return i >= 0 ? (num(tb?.totals?.[i]) ?? 0) : 0;
      };
      people[defenseId(team.id)] = {
        id: defenseId(team.id),
        name: `${team.name} D/ST`,
        team: team.id,
        position: "DEF",
        stats: { DSTG: 1, DSTSACK: total(team, "defensive", "SACKS"), DSTINT: total(team, "interceptions", "INT"), DSTFR: total(other, "fumbles", "LOST"), DSTTD: teamStat(team.id, "defensiveTouchdowns") ?? 0 },
      };
    }
    return { event: idOf(summary.header.id), final: isFinal(summary), teams, people };
  }

  readPlays(summary: EspnSummary, issues?: string[]): Play[] {
    const teams = headerTeams(summary);
    const home = teams.find((t) => t.home === true)?.id ?? teams[1]?.id ?? "";
    const away = teams.find((t) => t.home === false)?.id ?? teams[0]?.id ?? "";
    const other = (team: string | null | undefined) => (team === home ? away : team === away ? home : null);

    // Everyone in the box score, by the play-by-play's keys per side, and by their full names (a summary's).
    const keys = new Map<string, Map<string, string[]>>(); // team -> key -> ids
    const full = new Map<string, string>(); // plain full name -> id
    for (const side of summary.boxscore?.players ?? []) {
      const team = idOf(side.team?.id);
      const byKey = keys.get(team) ?? new Map<string, string[]>();
      keys.set(team, byKey);
      for (const table of side.statistics ?? []) {
        for (const row of table.athletes ?? []) {
          const id = idOf(row.athlete?.id);
          const name = str(row.athlete?.displayName);
          if (!id || !name) continue;
          full.set(plain(name), id);
          for (const k of playNames(name)) {
            const ids = byKey.get(k) ?? [];
            if (!ids.includes(id)) byKey.set(k, [...ids, id]);
          }
        }
      }
    }
    const known = (k: string) => [...keys.values()].some((m) => m.has(k));
    // By last name alone, when it's one person's on the side (a box score's nickname: "Bam Knight" is the text's "Z.Knight").
    const lastNames = new Map<string, Map<string, string[]>>();
    for (const [team, byKey] of keys) {
      const m = new Map<string, string[]>();
      for (const [k, ids] of byKey) {
        const last = k.slice(k.indexOf(".") + 1);
        for (const id of ids) if (!(m.get(last) ?? []).includes(id)) m.set(last, [...(m.get(last) ?? []), id]);
      }
      lastNames.set(team, m);
    }
    const teamOf = rosterOf(summary);
    /** Who a key names on a side, else on the other side; null when nobody in the box score has it (a holder, a long snapper). */
    const who = (k: string | undefined, team: string | null): { id: string; team: string } | null => {
      if (!k) return null;
      // The side it should be, by its keys and then its last names, before the other side.
      for (const t of team ? [team, other(team)] : [away, home]) {
        const ids = t ? keys.get(t)?.get(k) : undefined;
        if (ids?.length === 1) return { id: ids[0], team: t! };
        const last = t ? lastNames.get(t)?.get(k.slice(k.indexOf(".") + 1)) : undefined;
        if (last?.length === 1) return { id: last[0], team: t! };
      }
      return null;
    };

    const drives = [...(summary.drives?.previous ?? []), ...(summary.drives?.current ? [summary.drives.current] : [])];
    const raw: { p: EspnPlay; drive: string; team: string }[] = [];
    const seen = new Set<string>();
    for (const d of drives) {
      for (const p of d.plays ?? []) {
        const id = idOf(p.id);
        if (id && seen.has(id)) continue;
        if (id) seen.add(id);
        raw.push({ p, drive: idOf(d.id), team: idOf(d.team?.id) });
      }
    }

    // A play ESPN recorded and then recorded again otherwise (a quarter's last play, corrected after it): the next play from
    // scrimmage starts where it did, the same side, down, distance and spot, which a play that happened never leaves. The
    // first is left out.
    const replaced = new Set<number>();
    const startOf = (p: EspnPlay) => (num(p.start?.down) ? `${idOf(p.start?.team?.id)}:${p.start?.down}:${p.start?.distance}:${p.start?.yardLine}` : null);
    const between = /timeout|two-minute|end (?:period|of)|end quarter/i;
    for (let i = 0; i < raw.length; i++) {
      const at = startOf(raw[i].p);
      if (!at || between.test(str(raw[i].p.type?.text) ?? "")) continue;
      for (let j = i + 1; j < raw.length; j++) {
        const t = str(raw[j].p.type?.text) ?? "";
        if (between.test(t)) continue;
        if (startOf(raw[j].p) === at) replaced.add(i);
        break;
      }
    }

    // The side codes the text uses (the league's: "HST" for ESPN's HOU): ESPN's own, and each side's from its kickoffs ("kicks
    // 63 yards from ATL 35") and from a name after a code ("RECOVERED by ATL-G.Dexter").
    const codes = new Map<string, string>();
    for (const t of teams) if (t.abbreviation) codes.set(t.abbreviation, t.id);
    for (const { p } of raw) {
      const text = str(p.text) ?? "";
      const kick = /\bkicks (?:onside )?-?\d+ yards? from ([A-Z]{2,4}) -?\d+/.exec(text);
      const kicker = idOf(p.start?.team?.id);
      if (kick && kicker && !codes.has(kick[1])) codes.set(kick[1], kicker);
      for (const m of text.matchAll(/\b([A-Z]{2,4})-([A-Z][a-z]{0,2})\.([A-Z][A-Za-z'-]*)/g)) {
        if (codes.has(m[1])) continue;
        const k = `${letters(m[2])}.${letters(m[3])}`;
        const on = teams.filter((t) => keys.get(t.id)?.has(k));
        if (on.length === 1) codes.set(m[1], on[0].id);
      }
    }
    const codeOf = (code: string | undefined): string | null => (code ? (codes.get(code) ?? null) : null);
    /** A spot as yards from the home side's goal line (ESPN's yardLine); null when it can't be placed. */
    const xOf = (spot: string | undefined): number | null => {
      if (!spot) return null;
      const m = SPOT.exec(spot);
      if (!m) return null;
      if (!m[1]) return 50;
      const team = codeOf(m[1]);
      return team === home ? Number(m[2]) : team === away ? 100 - Number(m[2]) : null;
    };
    /** Yards a side gains going from one spot to another (home goes up the field, away down it). */
    const gained = (team: string, from: number, to: number) => (team === home ? to - from : from - to);

    const score: Record<string, number> = Object.fromEntries(teams.map((t) => [t.id, 0]));
    const out: Play[] = [];
    let first = true;
    for (let i = 0; i < raw.length; i++) {
      const { p, drive } = raw[i];
      const text = (str(p.text) ?? "").replace(/\s+/g, " ");
      const type = (str(p.type?.text) ?? "").toLowerCase();
      const offense = idOf(p.start?.team?.id) || raw[i].team || null;
      const deltas: Record<string, Stats> = {};
      const add = (person: string | null | undefined, d: Stats) => {
        if (person) deltas[person] = addStats(deltas[person] ?? {}, d);
      };
      const before = { ...score };
      const after = { ...score };
      // ESPN's score after the play, which never goes down (it gives a two-minute warning 0-0).
      if (num(p.awayScore) != null && away) after[away] = Math.max(after[away] ?? 0, num(p.awayScore)!);
      if (num(p.homeScore) != null && home) after[home] = Math.max(after[home] ?? 0, num(p.homeScore)!);
      // The points a side scored here that aren't its opponent's defense's to allow (Yahoo's: a safety, a turnover's return
      // touchdown, a defensive two-point return).
      const notAllowed: Record<string, number> = {};
      const people = new Set<string>();

      const read = replaced.has(i) ? { kind: "replaced" } : this.readText(text, { offense, los: num(p.start?.yardLine), home, away, other, who, known, full, teamOf, xOf, gained, codeOf, add, people, notAllowed, issues: issues ? (s: string) => issues.push(`${idOf(p.id)}: ${s}: ${text}`) : undefined });
      // Every side's defense has its game from the kickoff.
      if (first && teams.length) {
        for (const t of teams) add(defenseId(t.id), { DSTG: 1 });
        first = false;
      }
      for (const t of teams) {
        const scored = (after[t.id] ?? 0) - (before[t.id] ?? 0);
        if (scored > 0) add(defenseId(other(t.id) ?? ""), { PA: Math.max(0, scored - (notAllowed[t.id] ?? 0)) });
      }
      Object.assign(score, after);
      out.push({
        id: idOf(p.id) || `${i}`,
        at: str(p.wallclock),
        period: num(p.period?.number) ?? 1,
        half: null,
        clock: str(p.clock?.displayValue),
        text,
        kind: read.kind || type.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "other",
        team: offense,
        unit: drive || null,
        people: [...people],
        score: { ...score },
        deltas: cleanDeltas(deltas),
      });
    }
    return inOrder(out);
  }

  /**
   * One play's text, sentence by sentence, into its counts (`c.add`). Names become placeholders first ("@0 pass short middle
   * to @1 to ATL 25 for 16 yards (@2; @3)."), each matched to someone on the side its place in the sentence says.
   */
  private readText(text: string, c: ReadContext): { kind: string } {
    const { offense, other, who, add } = c;
    const defense = other(offense);
    // A scoring play's summary, with full names ("Dallas Goedert 9 Yd pass from Jalen Hurts (Jake Elliott Kick)").
    if (SUMMARY.test(text)) return this.readSummary(text, c);
    const phrase = this.readPhrase(text, c);
    if (phrase) return phrase;

    // A replay that reversed the call: the play is what's said after it.
    let said = text;
    const rev = said.lastIndexOf("REVERSED.");
    if (rev >= 0) said = said.slice(rev + "REVERSED.".length);
    // "TOUCHDOWN NULLIFIED by Penalty": no touchdown, but the gain counts to the foul's spot (the penalty that follows).
    said = said.replace(/,? TOUCHDOWN NULLIFIED by Penalty\.?/g, " to the goal line.");
    const sentences = sentencesOf(said)
      .map((s) => s.replace(/^(?:\([A-Za-z][A-Za-z ,-]*\)\s*)+/, "").trim())
      .filter((s) => s && !NOISE.test(s));
    if (sentences.some((s) => /^(?:PENALTY|Penalty) on /.test(s) && /No Play/i.test(s))) return { kind: "no-play" };

    let kind = "";
    // The ball: who has it, which side they're on, and what their yards count as.
    let carrier: Carrier = { id: null, team: offense, kind: "none" };
    let passer: string | null = null;
    // The last gain read, for a penalty enforced behind where it ended or a fumble the other side recovered short of it.
    let last: Gain | null = null;
    let twoPoint: { passer: string | null; catcher: string | null; complete: boolean; runner: string | null; team: string | null; defensive: boolean } | null = null;
    // The side that scored a touchdown here (its try follows).
    let scorer: string | null = null;
    let punter: string | null = null;
    // Where a punt landed, and where it ended up for "inside the 20".
    let landed: number | null = null;
    let puntAt: number | null = null;
    let returned = false;
    const hitters = new Set<string>();
    let names: string[] = [];
    const illegalForward = sentences.some((x) => /Illegal Forward Pass/.test(x));
    // A sack's yards: the text's, unless the quarterback fumbled (then to where the other side got the ball, or where the play
    // ended for his own side: ESPN's, from the line of scrimmage, never a gain).
    let sack: { qb: string | null; yards: number; end: number | null } | null = null;
    let sackers: string[] = [];
    // Where the sack was, from its words; whose aborted snap it was.
    let sackAt: number | null = null;
    let aborted: string | null = null;
    // A run or catch's first tackler, for a tackle for loss when it ends behind the line.
    let lossFor: { id: string; gain: Gain } | null = null;
    // Who forced a fumble (a later "Fumble Forced by 55-D.Hunter." says otherwise).
    let forced: string | null = null;
    // A fumbled snap told as a move ("C.Stroud to HST 11 for -5 yards. FUMBLES, and recovers"): not a run when a pass or a
    // sack follows.
    let snap: Gain | null = null;
    const notRun = () => {
      const g = snap as Gain | null;
      if (!g) return;
      add(g.id, { RATT: -1, RYDS: -g.yards });
      snap = null;
    };

    const person = (k: string | undefined, team: string | null) => {
      const r = k != null ? who(names[Number(k)], team) : null;
      if (r) c.people.add(r.id);
      return r;
    };
    const block = (k: string | undefined, team: string | null) => {
      const b = person(k, team);
      if (b) {
        add(b.id, { BLKK: 1 });
        add(defenseId(b.team), { DSTBLK: 1 });
      }
      return b;
    };
    const credit = (id: string | null, team: string | null, g: GainKind, yards: number) => {
      if (!id || !team) return;
      const d: Partial<Record<GainKind, Stats>> = {
        rush: { RATT: 1, RYDS: yards },
        "lateral-rush": { RYDS: yards },
        catch: { REC: 1, RECYDS: yards, TGT: 1 },
        "lateral-catch": { RECYDS: yards },
        "kick-return": { KR: returned ? 0 : 1, KRYDS: yards },
        // A muffed punt was its return already.
        "punt-return": { PR: returned ? 0 : 1, PRYDS: yards },
        "int-return": { DINTYDS: yards },
      };
      add(id, d[g] ?? {});
      if (g === "catch") add(passer, { CMP: 1, PATT: 1, PYDS: yards });
      if (g === "lateral-catch") add(passer, { PYDS: yards });
      last = { id, team, kind: g, yards, end: null };
    };
    /** The last gain's yards changed by some (taken back to a foul's spot, moved to where a fumble ended). */
    const shift = (yards: number) => {
      const l = last as Gain | null;
      if (!l || !yards) return;
      const key: Partial<Record<GainKind, string>> = { rush: "RYDS", "lateral-rush": "RYDS", catch: "RECYDS", "lateral-catch": "RECYDS", "kick-return": "KRYDS", "punt-return": "PRYDS", "int-return": "DINTYDS" };
      const k = key[l.kind];
      if (!k) return;
      add(l.id, { [k]: yards });
      if (l.kind === "catch" || l.kind === "lateral-catch") add(passer, { PYDS: yards });
      l.yards += yards;
      if (l.end != null) l.end += l.team === c.home ? yards : -yards;
    };
    /** Where a gain's words say it ended ("to ATL 25", "pushed ob at SF 1"; a touchdown, or one a penalty took away, at the
     *  goal line it ran to). */
    const endOf = (rest: string, team: string | null = carrier.team) => {
      if (team && /TOUCHDOWN|to the goal line/.test(rest)) return team === c.home ? 100 : 0;
      const e = new RegExp(`(?:to|at) (${SPOT_SRC})`).exec(rest);
      return e ? c.xOf(e[1]) : null;
    };
    const touchdown = (who: Carrier) => {
      if (!who.id || !who.team) return;
      scorer = who.team;
      // A fumble run in by the side that lost it is an offensive fumble return; by the other side (a kick's coverage that
      // recovered a muff too), a defensive and special teams one.
      const own = who.kind === "fumble-return" && who.team === (who.lost ?? offense);
      const d: Partial<Record<GainKind, Stats>> = {
        rush: { RTD: 1 },
        "lateral-rush": { RTD: 1 },
        catch: { RECTD: 1 },
        "lateral-catch": { RECTD: 1 },
        "kick-return": { KRTD: 1 },
        "punt-return": { PRTD: 1 },
        "int-return": { DINTTD: 1, DTD: 1 },
        "fumble-return": own ? { FRTD: 1 } : { DTD: 1 },
        "blocked-return": { DTD: 1 },
      };
      add(who.id, d[who.kind] ?? {});
      if (who.kind === "catch" || who.kind === "lateral-catch") add(passer, { PTD: 1 });
      if (RETURNS_OF.has(who.kind) && !own) {
        add(defenseId(who.team), { DSTTD: 1 });
        // A turnover's return touchdown (an interception's, a blocked field goal's, a fumble's off a play from scrimmage) isn't
        // allowed by the other side's defense (Yahoo's); a kick's or a punt's return is.
        const turnover = who.kind === "int-return" || (who.kind === "blocked-return" && kind === "field-goal") || (who.kind === "fumble-return" && kind !== "kickoff" && kind !== "punt");
        if (turnover) c.notAllowed[who.team] = (c.notAllowed[who.team] ?? 0) + 6;
      }
    };
    const safety = (tackler: string | null) => {
      // The two points are the side's that downed the ball carrier in his own end zone (the defense, or a kick's coverage on a
      // return): not allowed by the other side's defense (Yahoo's).
      const by = other(carrier.team ?? offense);
      if (!by) return;
      add(tackler, { SAF: 1 });
      add(defenseId(by), { DSTSAF: 1 });
      c.notAllowed[by] = (c.notAllowed[by] ?? 0) + 2;
      kind = "safety";
    };
    /** Tacklers in parentheses after a gain: "(A)" a solo tackle, "(A; B)" a shared one, "(A, B)" A's with B's help. */
    const tackle = (inner: string, team: string | null, loss: boolean) => {
      // By the names written, found or not (someone the box score doesn't have is still a tackler).
      const named = [...new Set([...inner.matchAll(/@(\d+)/g)].map((m) => names[Number(m[1])]))];
      const shared = inner.includes(";");
      const ids: string[] = [];
      named.forEach((k, i) => {
        const id = who(k, team)?.id;
        if (!id || ids.includes(id)) return;
        c.people.add(id);
        ids.push(id);
        add(id, { TCK: 1, SOLO: named.length === 1 || (!shared && i === 0) ? 1 : 0 });
      });
      // A tackle for loss is the first tackler's, once the play's yards are known (a fumble can move them).
      if (loss && ids[0] && last) lossFor = { id: ids[0], gain: last };
      return ids;
    };
    /** After a gain's yards: where it ended, its tacklers, a touchdown or a safety. */
    const afterGain = (rest: string, loss: boolean) => {
      if (last) (last as Gain).end = endOf(rest);
      const t = /\(([^)]*@[^)]*)\)/.exec(rest);
      const by = t ? tackle(t[1], other(carrier.team), loss && (carrier.kind === "rush" || carrier.kind === "catch")) : [];
      if (/TOUCHDOWN/.test(rest)) touchdown(carrier);
      if (/SAFETY/.test(rest)) safety(by[0] ?? null);
    };
    /** A fumble: who fumbled (named, else whoever had the ball), who forced it, who recovered it ("RECOVERED by ATL-G.Dexter"
     *  is the other side's, "recovered by SF-L.Farrell" or "and recovers" the fumbler's own). */
    const fumble = (body: string) => {
      const f = new RegExp(`^(?:@(\\d+) )?FUMBLES(?: \\(([^)]*)\\))?(?: at (?:${SPOT_SRC}))?(.*)$`).exec(body);
      if (!f) return;
      const fumbler = person(f[1], carrier.team ?? offense) ?? (carrier.id && carrier.team ? { id: carrier.id, team: carrier.team } : null);
      if (fumbler) add(fumbler.id, { FUM: 1 });
      // An aborted snap ("J.Allen FUMBLES (Aborted)"): ESPN counts the quarterback a carry for no gain.
      if (f[2] === "Aborted" && fumbler) {
        kind = "aborted-snap";
        aborted = fumbler.id;
        add(fumbler.id, { RATT: 1 });
      } else if (f[2]) {
        for (const x of f[2].matchAll(/@(\d+)/g)) {
          forced = person(x[1], other(fumbler?.team ?? offense))?.id ?? null;
          add(forced, { FF: 1 });
        }
      }
      const rest = f[3] ?? "";
      const r = new RegExp(`(?:RECOVERED|recovered) by ([A-Z]{2,4})-@(\\d+)(?: at (${SPOT_SRC}))?`).exec(rest);
      const touched = new RegExp(`touched at (${SPOT_SRC})`).exec(rest);
      if (r) {
        const side = c.codeOf(r[1]);
        const by = person(r[2], side);
        const team = by?.team ?? side;
        add(by?.id, { FREC: 1 });
        // Where it was got: where it was first touched, else where it was recovered.
        const at = c.xOf(touched?.[1] ?? r[3]);
        const l = last as Gain | null;
        const mine = l && fumbler && l.id === fumbler.id && l.end != null ? l : null;
        // The fumbler's gain counts to there, but never past where he fumbled when that was a gain (a teammate's advance is
        // the teammate's own; the ball bouncing on isn't anyone's).
        if (mine && at != null) shift(Math.min(c.gained(mine.team, mine.end!, at), Math.max(0, -mine.yards)));
        if (team && fumbler && team !== fumbler.team) {
          add(fumbler.id, { FUML: 1 });
          add(defenseId(team), { DSTFR: 1 });
        }
        // A sack's yards are to there, whichever side got it (the quarterback's own fumble: a returner's later one isn't).
        if (sack && at != null && sack.end == null && fumbler?.id === sack.qb) sack.end = at;
        carrier = { id: by?.id ?? null, team, kind: "fumble-return", lost: fumbler?.team ?? carrier.team };
        last = null;
      } else if (/and recovers|ball out of bounds/.test(rest) && fumbler) {
        // The fumbler's own recovery: his gain or his sack is to where he got it back. Out of bounds: back to there, but a
        // fumble out of bounds forward comes back to its spot (the rules').
        const self = /and recovers/.test(rest);
        const at = c.xOf(new RegExp(`(?:and recovers|out of bounds) at (${SPOT_SRC})`).exec(rest)?.[1]);
        if (self) add(fumbler.id, { FREC: 1 });
        const l = last as Gain | null;
        if (l && l.id === fumbler.id && l.end != null && at != null) shift(self ? c.gained(l.team, l.end, at) : Math.min(0, c.gained(l.team, l.end, at)));
        // A sack's: to where he got it back; out of bounds, to there only when it went backward.
        if (sack && at != null) sack.end = self || sackAt == null || (offense && c.gained(offense, sackAt, at) < 0) ? at : sackAt;
        carrier = { id: fumbler.id, team: fumbler.team, kind: "fumble-return", lost: fumbler.team };
        last = null;
      }
      if (/TOUCHDOWN/.test(rest)) touchdown(carrier);
    };

    for (const raw of sentences) {
      // Names to placeholders, each keeping its key; a two-word last name ("A.St. Brown") only when someone has it.
      names = [];
      const s = raw.replace(NAME, (_m, ini: string, lastName: string, more: string | undefined) => {
        const long = more ? `${letters(ini)}.${letters(lastName + more)}` : null;
        if (long && c.known(long)) {
          names.push(long);
          return `@${names.length - 1}`;
        }
        names.push(`${letters(ini)}.${letters(lastName)}`);
        return `@${names.length - 1}${more ?? ""}`;
      });
      // A hit on the quarterback: "[J.Ivey]".
      for (const m of s.matchAll(/\[([^\]]*)\]/g)) for (const x of m[1].matchAll(/@(\d+)/g)) {
        const h = person(x[1], defense);
        if (h) hitters.add(h.id);
      }
      const body = s.replace(/\s*\[[^\]]*\]/g, "");
      let m: RegExpExecArray | null;

      if (/^(?:PENALTY|Penalty) on /.test(body)) {
        // A foul by the side with the ball, enforced at a spot behind where its gain ended: the gain counts only to the spot.
        const pm = new RegExp(`^(?:PENALTY|Penalty) on ([A-Z]{2,4})\\b.*?, \\d+ yards?, enforced at (${SPOT_SRC})\\.?$`).exec(body);
        const l = last as Gain | null;
        // A foul by the punt's receiving side during its return ends the return at the foul's spot, for "inside the 20" too
        // (not its yards: ESPN's; a foul by the kicking side, or after a touchback, changes nothing). After a muffed punt
        // neither: ESPN keeps the return whole and the punt where it was.
        if (pm && kind === "punt" && !returned && puntAt != null && defense && c.codeOf(pm[1]) === defense) puntAt = c.xOf(pm[2]) ?? puntAt;
        if (pm && l && l.end != null && c.codeOf(pm[1]) === l.team && !(kind === "punt" && returned)) {
          const at = c.xOf(pm[2]);
          // From the spot to where the gain ended: inside it when it's between its start and its end (a negative return
          // whose foul is at the catch counts nothing).
          const behind = at == null ? 0 : c.gained(l.team, at, l.end);
          if (l.yards >= 0 ? behind > 0 && behind <= l.yards : behind < 0 && behind >= l.yards) shift(-behind);
        }
        continue;
      }
      // A try for two after a touchdown, by the side that scored it; then, on a turnover, the defense's own try to return it.
      if ((m = /^(DEFENSIVE )?TWO-POINT (?:CONVERSION )?ATTEMPT/.exec(body))) {
        twoPoint = { passer: null, catcher: null, complete: false, runner: null, team: scorer ?? offense, defensive: !!m[1] };
        continue;
      }
      if (twoPoint) {
        const tp = twoPoint as NonNullable<typeof twoPoint>;
        if ((m = /^@(\d+) pass to @(\d+) is (complete|incomplete)/.exec(body))) {
          tp.passer = person(m[1], tp.team)?.id ?? null;
          tp.catcher = person(m[2], tp.team)?.id ?? null;
          tp.complete = m[3] === "complete";
        } else if (!tp.defensive && (m = /^@(\d+) (?!pass|is sacked)/.exec(body))) tp.runner = person(m[1], tp.team)?.id ?? null;
        if (/ATTEMPT SUCCEEDS/.test(body)) {
          if (tp.defensive) {
            // The defense's two: not allowed by the scoring side's defense... nor scored against it.
            const d = other(tp.team);
            if (d) c.notAllowed[d] = (c.notAllowed[d] ?? 0) + 2;
          } else if (tp.catcher && tp.complete) {
            add(tp.passer, { P2PT: 1 });
            add(tp.catcher, { RE2PT: 1 });
          } else if (!tp.catcher) add(tp.runner, { R2PT: 1 });
        }
        if (/ATTEMPT (?:SUCCEEDS|FAILS)/.test(body)) twoPoint = null;
        continue;
      }
      // The try after a touchdown, by the side that scored it.
      if ((m = /^@(\d+) extra point is (GOOD|No Good|Blocked|BLOCKED)(?: by @(\d+)| \(@(\d+)\))?/.exec(body))) {
        const team = scorer ?? offense;
        add(person(m[1], team)?.id, { XPA: 1, XPM: m[2] === "GOOD" ? 1 : 0 });
        block(m[3] ?? m[4], other(team));
        continue;
      }
      if ((m = new RegExp(`^@(\\d+) kicks (onside )?-?\\d+ yards? from ${SPOT_SRC}`).exec(body))) {
        kind = "kickoff";
        // The receiving side has it now; a return, a muff or a touchback follows.
        carrier = { id: null, team: defense, kind: "kick-return" };
        last = null;
        continue;
      }
      if ((m = new RegExp(`^@(\\d+) punts (-?\\d+) yards? to (${SPOT_SRC}|end zone)`).exec(body))) {
        kind = "punt";
        const touchback = /Touchback/i.test(body);
        punter = person(m[1], offense)?.id ?? null;
        // Its yards are to where it landed, or to where its roll ended when the text says ("impetus ends at SF 17").
        landed = c.xOf(m[3]);
        const impetus = new RegExp(`impetus ends at (${SPOT_SRC})`).exec(body);
        const rolled = impetus && landed != null && offense ? c.xOf(impetus[1]) : null;
        add(punter, { PUNT: 1, PUNTYDS: Number(m[2]) + (rolled != null ? c.gained(offense!, landed!, rolled) : 0), PUNTTB: touchback ? 1 : 0 });
        // Inside the 20: where it ends up on the receiving side (fair caught, downed, out of bounds; else after the return).
        const down = new RegExp(`downed by [A-Z]{2,4}-@\\d+ at (${SPOT_SRC})`).exec(body);
        puntAt = touchback ? null : c.xOf(down?.[1] ?? m[3]);
        carrier = { id: null, team: defense, kind: "punt-return" };
        last = null;
        continue;
      }
      if ((m = /^@(\d+) punt is BLOCKED by @(\d+)/.exec(body))) {
        kind = "punt";
        // Not a punt in ESPN's box: a blocked kick.
        person(m[1], offense);
        block(m[2], defense);
        carrier = { id: null, team: defense, kind: "blocked-return" };
        const r = /RECOVERED by ([A-Z]{2,4})-@(\d+)|recovered by ([A-Z]{2,4})-@(\d+)/.exec(body);
        if (r) {
          const by = person(r[2] ?? r[4], c.codeOf(r[1] ?? r[3]));
          carrier = by && by.team !== offense ? { id: by.id, team: by.team, kind: "blocked-return" } : { id: by?.id ?? null, team: by?.team ?? offense, kind: "none" };
        }
        if (/TOUCHDOWN/.test(body)) touchdown(carrier);
        continue;
      }
      if ((m = /^@(\d+) (\d+) yard field goal is (GOOD|No Good|BLOCKED)(?: \(@(\d+)\))?/.exec(body))) {
        kind = "field-goal";
        const yards = Number(m[2]);
        const good = m[3] === "GOOD";
        add(person(m[1], offense)?.id, { FGA: 1, FGM: good ? 1 : 0, ...(good ? { [bandOf(yards)]: 1 } : {}) });
        if (block(m[4], defense)) carrier = { id: null, team: defense, kind: "blocked-return" };
        continue;
      }
      if ((m = /^@(\d+) spiked the ball/.exec(body))) {
        kind = "spike";
        notRun();
        add(person(m[1], offense)?.id, { PATT: 1 });
        continue;
      }
      if ((m = new RegExp(`^@(\\d+) sacked (?:(?:ob )?at ${SPOT_SRC}|in End Zone) for (-?\\d+) yards?(?: \\(([^)]*)\\))?(.*)$`).exec(body))) {
        kind = "sack";
        notRun();
        const qb = person(m[1], offense);
        add(qb?.id, { SACKED: 1 });
        sack = { qb: qb?.id ?? null, yards: -Number(m[2]), end: null };
        sackAt = c.xOf(new RegExp(`^@\\d+ sacked (?:ob )?at (${SPOT_SRC})`).exec(body)?.[1]);
        if (defense) add(defenseId(defense), { DSTSACK: 1 });
        // The sack is its tackler's, or half each's when it's "split by" two (ESPN's box can split one the text gives one:
        // judged), and a hit on the quarterback.
        const split = m[3] ? /^sack split by (.*)$/.exec(m[3]) : null;
        // Its tackle for loss comes at the end, when the sack's yards are known (none for no loss, none for a split sack).
        const by = split ? tackle(split[1].replace(" and ", "; "), defense, false) : m[3] ? tackle(m[3], defense, false) : [];
        for (const id of split ? by : by.slice(0, 1)) add(id, { SACK: split ? 0.5 : 1 });
        // A hit on the quarterback too, unless he fumbled (then only the brackets say who hit him) or ran out of bounds.
        if (!/^sacked ob/.test(body.replace(/^@\d+ /, "")) && !sentences.some((x) => /FUMBLES/.test(x))) for (const id of by) hitters.add(id);
        sackers = split ? [] : by.slice(0, 1);
        carrier = { id: qb?.id ?? null, team: offense, kind: "sack" };
        last = null;
        if (/SAFETY/.test(m[4])) safety(by[0] ?? null);
        continue;
      }
      if ((m = /^@(\d+) pass (incomplete )?(.*)$/.exec(body))) {
        // A pass thrown from past the line ("Illegal Forward Pass") isn't an attempt.
        if (illegalForward) continue;
        kind = "pass";
        notRun();
        passer = person(m[1], offense)?.id ?? null;
        const rest = m[3];
        let x: RegExpExecArray | null;
        if ((x = /^[a-z ]*?(?:intended for @(\d+) )?INTERCEPTED by @(\d+)(?: \(([^)]*)\))?/.exec(rest))) {
          kind = "interception";
          add(passer, { PATT: 1, INT: 1 });
          add(person(x[1], offense)?.id, { TGT: 1 });
          const picker = person(x[2], defense);
          // Picked off is a pass defended too; whoever's in parentheses tipped it.
          add(picker?.id, { DINT: 1, PD: 1 });
          if (x[3]) for (const y of x[3].matchAll(/@(\d+)/g)) {
            const t = person(y[1], defense);
            if (t && t.id !== picker?.id) add(t.id, { PD: 1 });
          }
          if (defense) add(defenseId(defense), { DSTINT: 1 });
          carrier = { id: picker?.id ?? null, team: picker?.team ?? defense, kind: "int-return" };
          last = null;
          continue;
        }
        if (m[2]) {
          // Incomplete: an attempt, a target when it says to whom, a pass defended by whoever's in parentheses.
          kind = "incomplete";
          add(passer, { PATT: 1 });
          add(person(/\bto @(\d+)/.exec(rest)?.[1], offense)?.id, { TGT: 1 });
          const pd = /\(([^)]*)\)/.exec(rest);
          if (pd) for (const y of pd[1].matchAll(/@(\d+)/g)) add(person(y[1], defense)?.id, { PD: 1 });
          continue;
        }
        if ((x = /^[a-z ]*?\bto @(\d+)(.*)$/.exec(rest))) {
          kind = "catch";
          const catcher = person(x[1], offense);
          const yards = yardsOf(x[2]) ?? 0;
          carrier = { id: catcher?.id ?? null, team: offense, kind: "catch" };
          credit(carrier.id, offense, "catch", yards);
          afterGain(x[2], yards < 0);
          continue;
        }
        c.issues?.("a pass not read");
        continue;
      }
      if ((m = /^Handoff to @(\d+)(.*)$/.exec(body))) {
        // A recovered snap handed off: the run is the runner's, from the line of scrimmage to where it ended.
        notRun();
        kind = "rush";
        const runner = person(m[1], offense);
        const to = endOf(m[2], offense);
        const yards = to != null && c.los != null && offense ? c.gained(offense, c.los, to) : (yardsOf(m[2]) ?? 0);
        carrier = { id: runner?.id ?? null, team: offense, kind: "rush" };
        credit(carrier.id, offense, "rush", yards);
        afterGain(m[2], yards < 0);
        continue;
      }
      if ((m = /^Lateral to @(\d+)(.*)$/.exec(body))) {
        const g: GainKind = carrier.kind === "catch" || carrier.kind === "lateral-catch" ? "lateral-catch" : carrier.kind === "rush" || carrier.kind === "lateral-rush" ? "lateral-rush" : carrier.kind;
        const to = person(m[1], carrier.team);
        const yards = yardsOf(m[2]) ?? 0;
        carrier = { id: to?.id ?? null, team: carrier.team, kind: g };
        // A lateral's yards after a kick count as its return's, without another return.
        if (g === "kick-return" || g === "punt-return") {
          add(carrier.id, g === "kick-return" ? { KRYDS: yards } : { PRYDS: yards });
          if (carrier.id && carrier.team) last = { id: carrier.id, team: carrier.team, kind: g, yards, end: null };
        } else credit(carrier.id, carrier.team, g, yards);
        afterGain(m[2], false);
        continue;
      }
      // An aborted snap: "J.Daniels Aborted." (the fumble follows: "G.Barton FUMBLES at TB 6, recovered by TB-J.Daniels").
      if ((m = /^@(\d+) Aborted\.?$/.exec(body))) {
        kind = "aborted-snap";
        const qb = person(m[1], offense);
        aborted = qb?.id ?? null;
        add(qb?.id, { RATT: 1 });
        carrier = { id: qb?.id ?? null, team: offense, kind: "rush" };
        continue;
      }
      if (/^(?:@\d+ )?FUMBLES/.test(body)) {
        fumble(body);
        continue;
      }
      if ((m = /^@(\d+) MUFFS catch(.*)$/.exec(body))) {
        // A muffed kick. A punt's is a fumble and a return (of nothing, unless they recover it and run: then that's the return),
        // and the punt's yards run on to where the ball ended, when that's farther (where the kicking side first touched it, or
        // recovered it; where the returner got it back; where it went out). A kickoff's the returner recovers isn't a fumble.
        const muffer = person(m[1], carrier.team);
        const punted = carrier.kind === "punt-return";
        const r = new RegExp(`(?:RECOVERED|recovered) by ([A-Z]{2,4})-@(\\d+)(?: at (${SPOT_SRC}))?`).exec(m[2]);
        const touched = new RegExp(`touched at (${SPOT_SRC})`).exec(m[2]);
        const back = new RegExp(`(?:and recovers|out of bounds) at (${SPOT_SRC})`).exec(m[2]);
        const ended = c.xOf(touched?.[1] ?? r?.[3] ?? back?.[1]);
        if (punted && punter && landed != null && ended != null && offense) add(punter, { PUNTYDS: Math.max(0, c.gained(offense, landed, ended)) });
        if (punted && ended != null) puntAt = ended;
        if (punted && muffer) {
          add(muffer.id, { FUM: 1, PR: 1, FREC: back && /and recovers/.test(back[0]) ? 1 : 0 });
          returned = true;
        } else if (muffer && !r) {
          // A kickoff muffed and kept is a return, of nothing unless they run with it.
          add(muffer.id, { KR: 1 });
          returned = true;
        }
        if (r) {
          const by = person(r[2], c.codeOf(r[1]));
          if (by && muffer && by.team !== muffer.team) {
            add(by.id, { FREC: 1 });
            add(defenseId(by.team), { DSTFR: 1 });
            add(muffer.id, punted ? { FUML: 1 } : { FUM: 1, FUML: 1, KR: 1 });
          } else if (by && by.id !== muffer?.id) {
            add(by.id, { FREC: 1, ...(punted ? {} : { KR: 1 }) });
            returned = true;
          }
          carrier = { id: by?.id ?? null, team: by?.team ?? null, kind: "fumble-return", lost: muffer?.team ?? carrier.team };
        } else carrier = { id: muffer?.id ?? null, team: muffer?.team ?? carrier.team, kind: carrier.kind };
        continue;
      }
      if ((m = /^@(\d+) (.*)$/.exec(body)) && (GAIN.test(m[2]) || /TOUCHDOWN/.test(m[2]))) {
        const yards = yardsOf(m[2]) ?? 0;
        // A return by whoever has the ball after a kick, a punt, an interception or a recovered fumble ("(didn't try to
        // advance)" on an onside kick isn't one).
        if (RETURNS_OF.has(carrier.kind) && /didn't try to advance/.test(m[2])) continue;
        if (RETURNS_OF.has(carrier.kind)) {
          const r = person(m[1], carrier.team);
          carrier = { ...carrier, id: r?.id ?? carrier.id };
          credit(carrier.id, carrier.team, carrier.kind, yards);
          if (carrier.kind === "fumble-return" || carrier.kind === "blocked-return") last = carrier.id && carrier.team ? { id: carrier.id, team: carrier.team, kind: carrier.kind, yards, end: null } : null;
          afterGain(m[2], false);
          if (carrier.kind === "punt-return") puntAt = endOf(m[2]) ?? puntAt;
          // The quarterback's own side ran on with his fumble: his sack's yards are to where it ended.
          if (sack && carrier.kind === "fumble-return" && carrier.team === offense) sack.end = endOf(m[2]) ?? sack.end;
          // The quarterback ran with his own aborted snap: a carry from the line of scrimmage, never below nothing (ESPN's).
          const to = endOf(m[2]);
          if (aborted && carrier.id === aborted && carrier.team === offense && to != null && c.los != null) add(aborted, { RYDS: Math.max(0, c.gained(offense!, c.los, to)) });
          continue;
        }
        if (carrier.kind !== "none" && carrier.kind !== "rush") {
          c.issues?.(`a gain after a ${carrier.kind}`);
          continue;
        }
        kind = /^kneels/.test(m[2]) ? "kneel" : "rush";
        const runner = person(m[1], offense);
        carrier = { id: runner?.id ?? null, team: offense, kind: "rush" };
        credit(carrier.id, offense, "rush", yards);
        afterGain(m[2], yards < 0);
        // A move with no direction, its ball fumbled: a fumbled snap, unless nothing else follows.
        if (runner && /^(?:to|pushed ob at|ran ob at) /.test(m[2]) && sentences.some((x) => /^FUMBLES/.test(x))) snap = last;
        continue;
      }
      if (/^TOUCHDOWN\b/.test(body)) {
        touchdown(carrier);
        continue;
      }
      if ((m = /^Fumble Forced by (?:\d+-)?@(\d+)/.exec(body))) {
        // Someone else forced it than the tackler the play named.
        const by = person(m[1], defense);
        if (by && by.id !== forced) {
          add(forced, { FF: -1 });
          add(by.id, { FF: 1 });
          forced = by.id;
        }
        continue;
      }
      if (/^(?:END QUARTER|END GAME|Two-Minute Warning|Timeout|Official Timeout|End of)/i.test(body)) continue;
      c.issues?.(`a sentence not read: "${raw}"`);
    }

    // A sack's yards: from the line of scrimmage to where the play ended for the quarterback's side, when he fumbled.
    const sk = sack as { qb: string | null; yards: number; end: number | null } | null;
    if (sk) {
      const lost = sk.end != null && c.los != null && offense ? Math.max(0, c.gained(offense, sk.end, c.los)) : sk.yards;
      add(sk.qb, { SACKYDS: lost });
      // A sack for a loss is a tackle for loss, but not one with a fumble (ESPN's).
      if (sk.yards > 0 && sk.end == null && !sentences.some((x) => /FUMBLES/.test(x))) for (const id of sackers) add(id, { TFL: 1 });
    }
    const lf = lossFor as { id: string; gain: Gain } | null;
    if (lf && lf.gain.yards < 0) add(lf.id, { TFL: 1 });

    // A punt left inside the receiving side's 20 (not a touchback).
    if (punter && puntAt != null && defense) {
      const own = defense === c.home ? puntAt : 100 - puntAt;
      if (own < 20) add(punter, { PUNTIN20: 1 });
    }
    // A hit on the quarterback, once a play: on a pass or a sack.
    if (sk || ["pass", "catch", "incomplete", "interception", "spike"].includes(kind)) for (const id of hitters) add(id, { QBH: 1 });
    return { kind };
  }

  /**
   * A play ESPN tells in short phrases with full names when the league's text is missing ("Kirk Cousins Pass Complete for 5 Yds
   * to Michael Mayer", "Drew Lock Incomplete Pass, Intended For Jaxon Smith-Njigba", "Kingsley Suamataia 10 Yd Pnlty Kenneth
   * Walker III 3 Yd Rush": a penalty's, nothing), "Team Safety"; after a reversed call the passer can be a last name alone ("Goff Incomplete
   * Pass"). Null when it isn't one.
   */
  private readPhrase(text: string, c: ReadContext): { kind: string } | null {
    const rev = text.lastIndexOf("REVERSED.");
    const said = (rev >= 0 ? text.slice(rev + "REVERSED.".length) : text).trim().replace(/\.$/, "");
    const { offense, add } = c;
    const byName = (name: string | undefined, team: string | null) => {
      if (!name) return null;
      let id = c.full.get(plain(name)) ?? null;
      // A last name alone, on the side it should be on.
      if (!id && !/\s/.test(name.trim())) id = c.who(`.${letters(name)}`, team)?.id ?? null;
      if (id) c.people.add(id);
      return id;
    };
    let m: RegExpExecArray | null;
    if ((m = /^(.+?) Pass Complete for (-?\d+) Yds? to (.+?)(?: \3 Fumble (.+?) (-?\d+) Yd Fumble Recovery)?$/.exec(said))) {
      const yards = Number(m[2]);
      add(byName(m[1], offense), { CMP: 1, PATT: 1, PYDS: yards });
      const catcher = byName(m[3], offense);
      add(catcher, { REC: 1, RECYDS: yards, TGT: 1 });
      if (m[4]) {
        // Lost only when the other side recovered it.
        const by = byName(m[4], c.other(offense));
        const side = by ? (c.teamOf.get(by) ?? null) : null;
        const lost = !!side && side !== offense;
        add(catcher, { FUM: 1, FUML: lost ? 1 : 0 });
        add(by, { FREC: 1 });
        if (lost) add(defenseId(side!), { DSTFR: 1 });
      }
      return { kind: "catch" };
    }
    if ((m = /^(.+?) Incomplete Pass, Intended For (.+)$/.exec(said))) {
      add(byName(m[1], offense), { PATT: 1 });
      add(byName(m[2], offense), { TGT: 1 });
      return { kind: "incomplete" };
    }
    // A run a penalty took away ("Kingsley Suamataia 10 Yd Pnlty Kenneth Walker III 3 Yd Rush"): nothing counts.
    if (/^.+? \d+ Yd Pnlty /.test(said)) return { kind: "no-play" };
    if (/^Team Safety$/.test(said)) {
      const d = c.other(offense);
      if (d) {
        add(defenseId(d), { DSTSAF: 1 });
        c.notAllowed[d] = (c.notAllowed[d] ?? 0) + 2;
      }
      return { kind: "safety" };
    }
    return null;
  }

  /** A scoring play's summary, with full names: "Dallas Goedert 9 Yd pass from Jalen Hurts (Jake Elliott Kick)", "Malik Willis
   *  1 Yd Run (Riley Patterson PAT failed)", "Sheldon Rankins 33 Yd Fumble Return (...)", "Zyon McCollum Defensive PAT
   *  Conversion". What it doesn't say (the tacklers, a sack before a fumble) comes at the final. */
  private readSummary(text: string, c: ReadContext): { kind: string } {
    const { offense, add } = c;
    const byName = (name: string | undefined) => {
      const id = name ? c.full.get(plain(name)) : undefined;
      if (id) c.people.add(id);
      return id ?? null;
    };
    const d = /^(.+?) Defensive PAT Conversion/.exec(text);
    if (d) {
      // Two points to the defense on the other side's try: not allowed by the other side's defense.
      const id = byName(d[1]);
      const team = id ? (c.teamOf.get(id) ?? null) : null;
      if (team) c.notAllowed[team] = (c.notAllowed[team] ?? 0) + 2;
      return { kind: "defensive-two-point" };
    }
    const m = /^(.+?) (\d+) Yd (pass from (.+?)|Run|Interception Return|Fumble Return|Kickoff Return|Punt Return|Blocked (?:Punt|Field Goal) Return|Field Goal)(?: \((.*)\))?\.?$/.exec(text);
    if (!m) {
      c.issues?.("a summary not read");
      return { kind: "" };
    }
    const yards = Number(m[2]);
    const id = byName(m[1]);
    const team = (id ? c.teamOf.get(id) : null) ?? offense;
    const what = m[3];
    if (what.startsWith("pass from")) {
      add(id, { REC: 1, RECYDS: yards, RECTD: 1, TGT: 1 });
      add(byName(m[4]), { CMP: 1, PATT: 1, PYDS: yards, PTD: 1 });
    } else if (what === "Run") add(id, { RATT: 1, RYDS: yards, RTD: 1 });
    else if (what === "Field Goal") {
      add(id, { FGA: 1, FGM: 1, [bandOf(yards)]: 1 });
      return { kind: "field-goal" };
    } else if (what === "Interception Return") add(id, { DINTYDS: yards, DINTTD: 1, DTD: 1 });
    else if (what === "Kickoff Return") add(id, { KR: 1, KRYDS: yards, KRTD: 1 });
    else if (what === "Punt Return") add(id, { PR: 1, PRYDS: yards, PRTD: 1 });
    else add(id, team === offense ? { FRTD: 1 } : { DTD: 1 });
    if (team && team !== offense && !what.startsWith("pass") && what !== "Run") {
      add(defenseId(team), { DSTTD: 1 });
      if (what === "Interception Return" || what === "Fumble Return" || what === "Blocked Field Goal Return") c.notAllowed[team] = (c.notAllowed[team] ?? 0) + 6;
    }
    // The try: "(Jake Elliott Kick)", "(Riley Patterson PAT failed)", "(Malik Willis Pass to Greg Dulcich for Two-Point
    // Conversion)", "(X Run for Two-Point Conversion)".
    const tr = m[5] ?? "";
    let t: RegExpExecArray | null;
    if ((t = /^(.+?) Kick$/.exec(tr))) add(byName(t[1]), { XPA: 1, XPM: 1 });
    else if ((t = /^(.+?) PAT (?:failed|blocked|missed)/i.exec(tr))) add(byName(t[1]), { XPA: 1 });
    else if ((t = /^(.+?) Pass to (.+?) for Two-Point Conversion$/.exec(tr))) {
      add(byName(t[1]), { P2PT: 1 });
      add(byName(t[2]), { RE2PT: 1 });
    } else if ((t = /^(.+?) Run for Two-Point Conversion$/.exec(tr))) add(byName(t[1]), { R2PT: 1 });
    return { kind: "touchdown" };
  }
}

/** A field goal made, in Yahoo's bands by distance. */
const bandOf = (yards: number) => (yards < 20 ? "FGM0" : yards < 30 ? "FGM20" : yards < 40 ? "FGM30" : yards < 50 ? "FGM40" : "FGM50");
/** A scoring play's summary with full names, not the play-by-play's ("Malik Willis 1 Yd Run (...)"). */
const SUMMARY = /^(?![A-Z][a-z]{0,2}\.[A-Z])[A-Z][\w'.-]*(?: [A-Z][\w'.-]*)+ (?:\d+ Yd (?:pass from|Run|Interception Return|Fumble Return|Kickoff Return|Punt Return|Blocked|Field Goal)|Defensive PAT Conversion)/;
/** Who has the ball after a kick, a punt, a turnover or a block: whose gains are returns. */
const RETURNS_OF = new Set<GainKind>(["kick-return", "punt-return", "int-return", "fumble-return", "blocked-return"]);

interface Carrier {
  id: string | null;
  team: string | null;
  kind: GainKind;
  /** A loose ball's: the side that lost it. */
  lost?: string | null;
}
interface Gain {
  id: string;
  team: string;
  kind: GainKind;
  yards: number;
  /** The spot it ended at, as yards from the home side's goal line, when its words say. */
  end: number | null;
}

interface ReadContext {
  offense: string | null;
  /** The line of scrimmage, as yards from the home side's goal line (ESPN's start.yardLine). */
  los: number | null;
  home: string;
  away: string;
  other: (team: string | null | undefined) => string | null;
  who: (k: string | undefined, team: string | null) => { id: string; team: string } | null;
  known: (k: string) => boolean;
  full: Map<string, string>;
  teamOf: Map<string, string>;
  xOf: (spot: string | undefined) => number | null;
  gained: (team: string, from: number, to: number) => number;
  codeOf: (code: string | undefined) => string | null;
  add: (person: string | null | undefined, d: Stats) => void;
  people: Set<string>;
  notAllowed: Record<string, number>;
  issues?: (s: string) => void;
}
