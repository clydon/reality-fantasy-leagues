import { TeamSport, addStats, cleanDeltas, count as stat, headerTeams, idOf, inOrder, isFinal, num, pair, position as pos, per, rosterOf, str, val as n, type Box, type BoxPerson, type EspnPlay, type EspnSummary, type LockCadence, type Periods, type Play, type Position, type PositionGroup, type StatDef, type Stats } from "./sport";

// Basketball (the NBA and the WNBA; college basketball, its own feed, below): its vocabulary and ESPN's readers.
//
// How ESPN records a game (checked on the 2026-27 NBA's first games, 2026-10-28): every play is typed ("Pullup Jump Shot",
// "Bad Pass\nTurnover", "Defensive Rebound", "Substitution") with its clock, its team (the shooter's, the rebounder's, the one
// who turned it over or fouled), whether it's a shot (`shootingPlay`, `pointsAttempted`, `scoringPlay`, `scoreValue`) and its
// people as athlete ids in a set order but with no roles: the shooter, then whoever assisted or blocked it ("LeBron James
// blocks Evan Mobley 's 13-foot turnaround jump shot" is Mobley, then James); who turned it over, then who stole it; who
// enters the game, then who leaves. So a play's counts come from its type and those flags, and its text only says which of the
// second person's (an assist, a block, a steal). Minutes and plus/minus need who's on the floor, which ESPN's substitutions
// only mostly say, so they're known at the final (the correction). The statistician's calls (an assist, a rebound, a steal, a
// block, a turnover) are judged: ESPN's box score sometimes credits one to a teammate of the one its play names, after the play.

const BOX = "box";

const count = (key: string, label: string, short: string, noun: string, better: "higher" | "lower" = "higher", known?: "final") => stat(key, label, short, noun, BOX, better, known);
const judged = (def: StatDef): StatDef => ({ ...def, judged: true });
/** Double digits in this many of points, rebounds, assists, steals and blocks: a double-double (2), a triple-double (3). */
const doubles = (s: Stats) => ["PTS", "REB", "AST", "STL", "BLK"].filter((k) => n(s, k) >= 10).length;

const STATS: StatDef[] = [
  count("MIN", "Minutes", "MIN", "minute played", "higher", "final"),
  count("PTS", "Points", "PTS", "point"),
  count("FGM", "Field goals made", "FGM", "field goal made"),
  count("FGA", "Field goals attempted", "FGA", "field goal attempted"),
  { key: "FG%", label: "Field goal percentage", short: "FG%", noun: "field goal percentage", group: BOX, better: "higher", kind: "rate", ...per({ FGM: 1 }, { FGA: 1 }) },
  count("3PM", "Three-pointers made", "3PM", "three-pointer made"),
  count("3PA", "Three-pointers attempted", "3PA", "three-pointer attempted"),
  { key: "3P%", label: "Three-point percentage", short: "3P%", noun: "three-point percentage", group: BOX, better: "higher", kind: "rate", ...per({ "3PM": 1 }, { "3PA": 1 }) },
  count("FTM", "Free throws made", "FTM", "free throw made"),
  count("FTA", "Free throws attempted", "FTA", "free throw attempted"),
  { key: "FT%", label: "Free throw percentage", short: "FT%", noun: "free throw percentage", group: BOX, better: "higher", kind: "rate", ...per({ FTM: 1 }, { FTA: 1 }) },
  judged(count("OREB", "Offensive rebounds", "OREB", "offensive rebound")),
  judged(count("DREB", "Defensive rebounds", "DREB", "defensive rebound")),
  judged(count("REB", "Rebounds", "REB", "rebound")),
  judged(count("AST", "Assists", "AST", "assist")),
  judged(count("STL", "Steals", "STL", "steal")),
  judged(count("BLK", "Blocks", "BLK", "block")),
  judged(count("TO", "Turnovers", "TO", "turnover", "lower")),
  count("PF", "Personal fouls", "PF", "personal foul", "lower"),
  count("PM", "Plus/minus", "+/-", "plus/minus point", "higher", "final"),
  // Worked out game by game, then added (Sport.full).
  { key: "DD", label: "Double-doubles", short: "DD", noun: "double-double", group: BOX, better: "higher", kind: "derived", of: (s) => (doubles(s) >= 2 ? 1 : 0) },
  { key: "TD", label: "Triple-doubles", short: "TD", noun: "triple-double", group: BOX, better: "higher", kind: "derived", of: (s) => (doubles(s) >= 3 ? 1 : 0) },
];

const GROUPS: PositionGroup[] = [
  { key: "guards", label: "Guards", stats: [BOX] },
  { key: "forwards", label: "Forwards", stats: [BOX] },
  { key: "centers", label: "Centers", stats: [BOX] },
];

// ESPN's abbreviations: a box score says G, F or C; a roster PG, SG, SF, PF or C.
const POSITIONS: Position[] = [
  pos("PG", "Point guard", "guards"),
  pos("SG", "Shooting guard", "guards"),
  pos("G", "Guard", "guards"),
  pos("SF", "Small forward", "forwards"),
  pos("PF", "Power forward", "forwards"),
  pos("F", "Forward", "forwards"),
  pos("C", "Center", "centers"),
];

// ESPN's box score columns to our keys (a pair, "6-10", is made and attempted; FG% and the like are worked out from counts).
const BOX_COLUMNS: Record<string, string | [string, string]> = { MIN: "MIN", PTS: "PTS", FG: ["FGM", "FGA"], "3PT": ["3PM", "3PA"], FT: ["FTM", "FTA"], REB: "REB", AST: "AST", TO: "TO", STL: "STL", BLK: "BLK", OREB: "OREB", DREB: "DREB", PF: "PF", "+/-": "PM" };
// The team's own totals ESPN gives (boxscore.teams[].statistics), by its stat names: its players' added up. Not its team
// rebounds or team turnovers (nobody's), which ESPN counts apart.
const TEAM: Record<string, string | [string, string]> = {
  "fieldGoalsMade-fieldGoalsAttempted": ["FGM", "FGA"],
  "threePointFieldGoalsMade-threePointFieldGoalsAttempted": ["3PM", "3PA"],
  "freeThrowsMade-freeThrowsAttempted": ["FTM", "FTA"],
  offensiveRebounds: "OREB",
  defensiveRebounds: "DREB",
  totalRebounds: "REB",
  assists: "AST",
  steals: "STL",
  blocks: "BLK",
  turnovers: "TO",
  fouls: "PF",
};

/** Basketball's periods: four quarters, then overtimes (the NBA's, the WNBA's, the women's college game's). */
export const QUARTERS: Periods = { word: "quarter", plural: "quarters", regulation: 4, extra: "overtime" };
/** Men's college basketball's: two halves of 20 minutes, then overtimes of 5 (ESPN's `format`). */
export const HALVES: Periods = { word: "half", plural: "halves", regulation: 2, extra: "overtime" };

/** What a feed's reader knows of one of ESPN's plays before reading it (Basketball.readFeed). */
interface PlayFacts {
  p: EspnPlay;
  i: number;
  raw: EspnPlay[];
  /** Its type, lowercased ("defensive rebound"). */
  type: string;
  text: string;
  /** Its text, lowercased. */
  said: string;
  team: string | null;
  made: boolean;
  /** A made shot's points. */
  points: number;
  /** Its people, by ESPN's athlete ids, in its order. */
  ids: string[];
}

/** What a feed's reader makes of a play. */
interface Reading {
  kind: string;
  /** Who's in it, by the ids their lines are under. */
  people: string[];
  deltas: Record<string, Stats>;
  /** The side with the ball on it, when it says (a shot, a rebound, a turnover). */
  offense: string | null;
  /** It ends its possession (a made basket, a turnover, the last free throw). */
  ends: boolean;
  /** The ball's loose or dead before it (a defensive rebound, a period's end): whoever has it next starts a possession. */
  loose: boolean;
}

const typeOf = (p: EspnPlay) => (str(p.type?.text) ?? "").toLowerCase().replace(/\s+/g, " ");
/** A play's deltas, and how to add to them. */
function tally() {
  const deltas: Record<string, Stats> = {};
  const add = (who: string | undefined, d: Stats) => {
    if (who) deltas[who] = addStats(deltas[who] ?? {}, d);
  };
  return { deltas, add };
}

/** A foul that's a personal foul (a flagrant is; a technical, a defensive three seconds or a delay of game isn't). */
const PERSONAL = (what: string) => /\bfoul\b|\bcharge\b/.test(what) && !/technical|3-second|three-second|three second|delay/.test(what);

export class Basketball extends TeamSport {
  readonly id = "basketball";
  readonly name: string = "Basketball";
  readonly groups = GROUPS;
  readonly positions = POSITIONS;
  readonly statGroups = [{ key: BOX, label: "Box score" }];
  readonly stats = STATS;
  readonly periods: Periods = QUARTERS;
  readonly runtime: number = 150;
  readonly lock: LockCadence = "daily";
  // College basketball is its own feed: CollegeBasketball, below.
  readonly leagues = ["nba", "wnba"];

  readBox(summary: EspnSummary): Box | null {
    if (!summary.header) return null;
    const teams = headerTeams(summary);
    const people: Record<string, BoxPerson> = {};
    for (const side of summary.boxscore?.players ?? []) {
      const team = idOf(side.team?.id);
      for (const table of side.statistics ?? []) {
        const labels = table.labels ?? [];
        for (const row of table.athletes ?? []) {
          const id = idOf(row.athlete?.id);
          if (!id) continue;
          const person = (people[id] ??= { id, name: str(row.athlete?.displayName) ?? "", team, position: this.positionKey(row.athlete?.position?.abbreviation ?? row.position?.abbreviation), stats: {} });
          const v = row.stats ?? [];
          // Someone who didn't play has no numbers at all, not zeros.
          if (!v.length) continue;
          // Only the columns this table has, zeros kept (the final's correction needs both).
          for (const [label, key] of Object.entries(BOX_COLUMNS)) {
            const i = labels.indexOf(label);
            if (i < 0) continue;
            if (Array.isArray(key)) {
              const [made, tried] = pair(v[i]) ?? [0, 0];
              person.stats[key[0]] = made;
              person.stats[key[1]] = tried;
            } else person.stats[key] = num(v[i]) ?? 0;
          }
        }
      }
    }
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
    return { event: idOf(summary.header.id), final: isFinal(summary), teams, people };
  }

  readPlays(summary: EspnSummary, issues?: string[]): Play[] {
    const teamOf = rosterOf(summary);
    return this.readFeed(summary, ({ p, type, text, said, team, made, points, ids }) => {
      const { deltas, add } = tally();
      let kind = "other";
      let offense: string | null = null;
      let ends = false;
      let loose = false;

      // By its type alone ("Free Throw - 1 of 2"): a lane violation's text says "free throw" too.
      if (/^free throw/.test(type)) {
        kind = "free-throw";
        add(ids[0], { FTA: 1, FTM: made ? 1 : 0, PTS: points });
        // A technical's free throw is anyone's, in the middle of someone's possession.
        if (!/technical/.test(type + said)) {
          offense = team;
          const set = /(\d+) of (\d+)/.exec(said);
          ends = made && (!set || set[1] === set[2]);
        }
      } else if (p.shootingPlay === true) {
        const three = num(p.pointsAttempted) === 3 || /three point/.test(said);
        kind = made ? (three ? "three" : "field-goal") : /\bblocks\b/.test(said) ? "blocked" : "miss";
        // A missed heave at the end of a quarter isn't an attempt (the NBA's rule since 2025-26); a made one is a basket.
        const heave = !made && /heave/.test(type + said);
        if (heave) kind = "heave";
        else add(ids[0], { FGA: 1, FGM: made ? 1 : 0, "3PA": three ? 1 : 0, "3PM": three && made ? 1 : 0, PTS: points });
        if (/\bassists\)/.test(said)) add(ids[1], { AST: 1 });
        if (/\bblocks\b/.test(said)) add(ids[1], { BLK: 1 });
        if (made && points === 0) issues?.push(`${idOf(p.id)}: a made shot worth nothing: ${text}`);
        offense = team;
        ends = made;
      } else if (/rebound/.test(type)) {
        kind = "rebound";
        const offensive = /offensive/.test(type);
        // A team rebound ("Cavaliers offensive team rebound") is nobody's.
        if (ids[0] && !/team rebound/.test(said)) add(ids[0], { REB: 1, [offensive ? "OREB" : "DREB"]: 1 });
        offense = team;
        loose = !offensive;
      } else if (/turnover/.test(type) || /\bturnover\b/.test(said)) {
        kind = "turnover";
        // A team's own (a shot clock, a 5-second violation) names nobody.
        if (ids[0] && !/^(?:team|5 second|8 second|shot clock)/.test(said)) add(ids[0], { TO: 1 });
        if (/\bsteals\)/.test(said)) add(ids[1], { STL: 1 });
        offense = team;
        ends = true;
      } else if (PERSONAL(type) || (/^(?:foul|personal)/.test(type) && PERSONAL(said))) {
        // A double personal foul comes as two plays, each with its fouler first.
        kind = "foul";
        add(ids[0], { PF: 1 });
      } else if (/jump ?ball/.test(type)) {
        kind = "jump-ball";
        // "Allen vs. Embiid (Harden gains possession)": the ball is the third person's side's (a held ball won back by the side
        // that had it keeps its possession).
        offense = (ids[2] && teamOf.get(ids[2])) || team;
      } else if (/substitution/.test(type)) kind = "substitution";
      else if (/timeout/.test(type)) kind = "timeout";
      else if (/^end (?:period|game)|^end of/.test(type) || /^end of/.test(said)) {
        kind = /game/.test(type + said) ? "end" : "period-end";
        loose = true;
      } else if (/foul|technical|violation|goaltending|kicked|challenge|review|ejection|delay/.test(type)) kind = "violation";
      return { kind, people: ids, deltas, offense, ends, loose };
    });
  }

  /**
   * ESPN's plays in order, each read by `read`, with what every basketball feed shares: the score from the made shots' values,
   * and possessions (a new one when the ball changes hands, or after a made basket, a turnover or the last free throw; a free
   * throw never starts one after the possession's over: an and-one's stays in its basket's).
   */
  protected readFeed(summary: EspnSummary, read: (f: PlayFacts) => Reading): Play[] {
    const raw = summary.plays ?? [];
    const event = idOf(summary.header?.id);
    const score: Record<string, number> = Object.fromEntries(headerTeams(summary).map((t) => [t.id, 0]));
    const out: Play[] = [];
    let possession = 0;
    let owner: string | null = null;
    let over = true;
    for (let i = 0; i < raw.length; i++) {
      const p = raw[i];
      const text = str(p.text) ?? "";
      const team = idOf(p.team?.id) || null;
      const made = p.scoringPlay === true;
      const points = made ? Math.max(0, num(p.scoreValue) ?? 0) : 0;
      const ids = (p.participants ?? []).map((x) => idOf(x.athlete?.id)).filter(Boolean);
      const r = read({ p, i, raw, type: typeOf(p), text, said: text.toLowerCase().replace(/\s+/g, " "), team, made, points, ids });
      if (r.loose) over = true;
      if (r.offense && (r.offense !== owner || (over && r.kind !== "free-throw"))) {
        possession++;
        owner = r.offense;
        over = false;
      } else if (r.offense) over = false;
      if (made && points && team) score[team] = (score[team] ?? 0) + points;
      out.push({
        id: idOf(p.id) || `${i}`,
        at: str(p.wallclock),
        period: num(p.period?.number) ?? 1,
        half: null,
        clock: str(p.clock?.displayValue),
        text,
        kind: r.kind,
        team,
        unit: possession ? `${event}:${possession}` : null,
        people: [...new Set(r.people)],
        score: { ...score },
        deltas: cleanDeltas(r.deltas),
      });
      if (r.ends) over = true;
    }
    return inOrder(out);
  }
}

/** A whole name in a play's text ("Ty Smith", not inside "Ty Smithson"). */
const nameIn = (name: string) => new RegExp(`(?<![\\p{L}\\p{M}])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{M}])`, "u");

/**
 * College basketball (docs/PLAN-start-a-game-gpt.md track L, step L5 part 2a): Basketball's vocabulary, but for plus/minus (its
 * box score has none), on another of ESPN's feeds. One instance per league: the men's plays two halves, the women's four
 * quarters (the NCAA's rules since 2015-16; ESPN's `format` says so for each), and both write their plays alike. Its `id` is
 * the slug's, "basketball", as the NBA's is (its defaults are basketball's): a sport is found by its league (`sportOf`).
 *
 * How ESPN records a college game (checked on 516 men's and women's games of 2025-26, 2026-10-28): its plays are typed by the
 * NCAA's feed ("JumpShot", "LayUpShot", "TipShot", "DunkShot", "MadeFreeThrow" for a miss too, "PersonalFoul", "Technical
 * Foul", "Lost Ball Turnover" for every turnover, "Offensive Rebound", "Dead Ball Rebound"), with the same shot flags as the
 * NBA's (`shootingPlay`, `scoringPlay`, `scoreValue`, `pointsAttempted`) and every play's wallclock. A block and a steal are
 * plays of their own ("Aday Mara Block.", "Elliot Cadeau Steal."), filed after the shot or turnover at the same clock, each
 * naming only its own player; so a shot's second person is only ever its assister. Texts come two ways ("makes 10-foot hook
 * shot (X assists)" and "made Layup. Assisted by X."), and a free throw's may not say which of how many it is ("made Free
 * Throw."). A team's own rebound or turnover names nobody, and a college box's team totals count them (readBox). A player's
 * technical is one of his personal fouls (65 of 69 in ESPN's box; the plays don't say a technical's class), and its two free
 * throws are the other side's at the technical's clock. The jump ball is "Jump Ball won by UConn" and "lost by Michigan", a
 * play for each side.
 */
export class CollegeBasketball extends Basketball {
  readonly name: string;
  readonly stats = STATS.filter((s) => s.key !== "PM");
  readonly periods: Periods;
  readonly runtime: number = 120;
  readonly leagues: string[];

  constructor(league: string, name: string, periods: Periods = QUARTERS) {
    super();
    this.leagues = [league];
    this.name = name;
    this.periods = periods;
  }

  /** Basketball's, but the team's totals without its rebounds, turnovers and fouls: a college box counts the team's own in them
   *  (a team rebound, a shot clock turnover, a bench technical: nobody's line), its players' added up and those plays exactly
   *  in 293 of 294 sides checked (the other ESPN's doubled feed). A team's fouls, for the bonus, are its players' and its
   *  technicals in the plays. */
  readBox(summary: EspnSummary): Box | null {
    const box = super.readBox(summary);
    for (const t of box?.teams ?? []) for (const k of ["REB", "OREB", "DREB", "TO", "PF"]) delete t.stats[k];
    return box;
  }

  readPlays(summary: EspnSummary, issues?: string[]): Play[] {
    const sides = headerTeams(summary).map((t) => t.id);
    // The box score's people by team. A play can name someone by an id the box doesn't have (a women's game of 2025-26: every
    // play of one player's under another id): they're the one on the play's side its text names, when only one is.
    const inBox = new Map<string, { id: string; name: RegExp }[]>();
    for (const side of summary.boxscore?.players ?? []) {
      const team = idOf(side.team?.id);
      const list = inBox.get(team) ?? [];
      inBox.set(team, list);
      for (const table of side.statistics ?? [])
        for (const row of table.athletes ?? []) {
          const id = idOf(row.athlete?.id);
          const name = str(row.athlete?.displayName);
          if (id && name) list.push({ id, name: nameIn(name) });
        }
    }
    const known = new Set([...inBox.values()].flat().map((x) => x.id));
    const resolve = (ids: string[], team: string | null, text: string) =>
      ids.map((id) => {
        if (!known.size || known.has(id)) return id;
        const named = (inBox.get(team ?? "") ?? []).filter((x) => x.name.test(text) && !ids.includes(x.id));
        return named.length === 1 ? named[0].id : id;
      });
    const freeThrow = (type: string) => /free ?throw/.test(type);
    const at = (p: EspnPlay) => `${num(p.period?.number) ?? 1} ${str(p.clock?.displayValue) ?? ""}`;
    // A technical's free throws: the other side's, two a technical, at its clock. They're in the middle of someone's
    // possession, so they neither start nor end one.
    let owed: { at: string; side: string; n: number }[] = [];

    return this.readFeed(summary, ({ p, i, raw, type, text, said, team, made, points, ids: named }) => {
      const ids = resolve(named, team, text);
      const { deltas, add } = tally();
      let kind = "other";
      let offense: string | null = null;
      let ends = false;
      let loose = false;
      owed = owed.filter((o) => o.at === at(p) && o.n > 0);
      const technicalShot = () => {
        const o = owed.find((x) => x.side === team);
        if (o) o.n--;
        return !!o;
      };

      if (freeThrow(type)) {
        kind = "free-throw";
        add(ids[0], { FTA: 1, FTM: made ? 1 : 0, PTS: points });
        if (!technicalShot()) {
          offense = team;
          // The last of its set: "2 of 2", or with no count, no more of the side's at this clock before the ball's in play (or
          // a technical, whose free throws are its own).
          const set = /(\d+) of (\d+)/.exec(said);
          let last = true;
          if (set) last = set[1] === set[2];
          else
            for (let j = i + 1; j < raw.length; j++) {
              const q = raw[j];
              const t = typeOf(q);
              if (at(q) !== at(p) || /technical/.test(t)) break;
              if (freeThrow(t)) {
                last = idOf(q.team?.id) !== team;
                break;
              }
              if (!/substitution|time ?out|foul/.test(t)) break;
            }
          ends = made && last;
        }
      } else if (p.shootingPlay === true) {
        const three = num(p.pointsAttempted) === 3 || /three point/.test(said);
        // Blocked: its block is the next play, at the same clock (as the NBA's says "blocks" in the shot's own text).
        const next = raw[i + 1];
        const blocked = !made && !!next && /^block/.test(typeOf(next)) && at(next) === at(p);
        kind = made ? (three ? "three" : "field-goal") : blocked ? "blocked" : "miss";
        add(ids[0], { FGA: 1, FGM: made ? 1 : 0, "3PA": three ? 1 : 0, "3PM": three && made ? 1 : 0, PTS: points });
        if (made && /assist/.test(said)) add(ids[1], { AST: 1 });
        if (made && points === 0) issues?.push(`${idOf(p.id)}: a made shot worth nothing: ${text}`);
        if (!ids[0]) issues?.push(`${idOf(p.id)}: a shot with nobody's name: ${text}`);
        offense = team;
        ends = made;
      } else if (/^block/.test(type)) {
        kind = "block";
        add(ids[0], { BLK: 1 });
      } else if (/^steal/.test(type)) {
        kind = "steal";
        add(ids[0], { STL: 1 });
      } else if (/rebound/.test(type)) {
        kind = "rebound";
        const offensive = /offensive/.test(type);
        const dead = /dead ?ball/.test(type);
        // A team's own ("Michigan Offensive Rebound.", "UConn Deadball Team Rebound.") names nobody.
        if (ids[0] && !dead) add(ids[0], { REB: 1, [offensive ? "OREB" : "DREB"]: 1 });
        // A dead ball's is whoever gets the ball (after a missed first free throw, the shooter's side): a new possession only
        // when the ball changes hands, and none between a technical's free throws.
        if (!dead || !owed.some((o) => o.side === team)) offense = team;
        loose = !offensive && !dead;
      } else if (/turnover/.test(type)) {
        kind = "turnover";
        add(ids[0], { TO: 1 });
        offense = team;
        ends = true;
      } else if (/technical/.test(type)) {
        // A player's technical is one of his personal fouls (the NCAA's rule; ESPN's box counts it), a bench's nobody's.
        kind = "technical";
        add(ids[0], { PF: 1 });
        const other = sides.find((s) => s !== team);
        if (other) owed.push({ at: at(p), side: other, n: 2 });
      } else if (/foul/.test(type)) {
        kind = "foul";
        add(ids[0], { PF: 1 });
      } else if (/^jump ?ball/.test(type)) {
        kind = "jump-ball";
        if (/\bwon by\b/.test(said)) offense = team;
      } else if (/substitution/.test(type)) kind = "substitution";
      else if (/time ?out/.test(type)) kind = "timeout";
      else if (/^end (?:period|game)/.test(type)) {
        kind = /game/.test(type) ? "end" : "period-end";
        loose = true;
      } else if (/challenge|review|violation|ejection/.test(type)) kind = "violation";
      return { kind, people: ids, deltas, offense, ends, loose };
    });
  }
}
