import { TeamSport, addStats, cleanDeltas, count as stat, headerTeams, idOf, inOrder, isFinal, num, pair, position as pos, ratio, rosterOf, str, val as n, type Box, type BoxPerson, type EspnSummary, type LockCadence, type Periods, type Play, type Position, type PositionGroup, type StatDef, type Stats } from "./sport";

// Basketball (the NBA and the WNBA; college basketball plays halves, so it waits for L5): its vocabulary and ESPN's readers.
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
  { key: "FG%", label: "Field goal percentage", short: "FG%", noun: "field goal percentage", group: BOX, better: "higher", kind: "rate", of: (s) => ratio(n(s, "FGM"), n(s, "FGA")) },
  count("3PM", "Three-pointers made", "3PM", "three-pointer made"),
  count("3PA", "Three-pointers attempted", "3PA", "three-pointer attempted"),
  { key: "3P%", label: "Three-point percentage", short: "3P%", noun: "three-point percentage", group: BOX, better: "higher", kind: "rate", of: (s) => ratio(n(s, "3PM"), n(s, "3PA")) },
  count("FTM", "Free throws made", "FTM", "free throw made"),
  count("FTA", "Free throws attempted", "FTA", "free throw attempted"),
  { key: "FT%", label: "Free throw percentage", short: "FT%", noun: "free throw percentage", group: BOX, better: "higher", kind: "rate", of: (s) => ratio(n(s, "FTM"), n(s, "FTA")) },
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

/** A foul that's a personal foul (a flagrant is; a technical, a defensive three seconds or a delay of game isn't). */
const PERSONAL = (what: string) => /\bfoul\b|\bcharge\b/.test(what) && !/technical|3-second|three-second|three second|delay/.test(what);

export class Basketball extends TeamSport {
  readonly id = "basketball";
  readonly name = "Basketball";
  readonly groups = GROUPS;
  readonly positions = POSITIONS;
  readonly statGroups = [{ key: BOX, label: "Box score" }];
  readonly stats = STATS;
  readonly periods: Periods = { word: "quarter", plural: "quarters", regulation: 4, extra: "overtime" };
  readonly lock: LockCadence = "daily";
  // College basketball plays two halves (L5, with college).
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
    const raw = summary.plays ?? [];
    const event = idOf(summary.header?.id);
    const teamOf = rosterOf(summary);
    const score: Record<string, number> = Object.fromEntries(headerTeams(summary).map((t) => [t.id, 0]));
    const out: Play[] = [];
    // Possessions: a new one when the ball changes hands, or after a made basket, a turnover or the last free throw.
    let possession = 0;
    let owner: string | null = null;
    let over = true;

    for (let i = 0; i < raw.length; i++) {
      const p = raw[i];
      const type = (str(p.type?.text) ?? "").toLowerCase().replace(/\s+/g, " ");
      const text = str(p.text) ?? "";
      const said = text.toLowerCase().replace(/\s+/g, " ");
      const ids = (p.participants ?? []).map((x) => idOf(x.athlete?.id)).filter(Boolean);
      const team = idOf(p.team?.id) || null;
      const made = p.scoringPlay === true;
      const points = made ? Math.max(0, num(p.scoreValue) ?? 0) : 0;
      const deltas: Record<string, Stats> = {};
      const add = (who: string | undefined, d: Stats) => {
        if (who) deltas[who] = addStats(deltas[who] ?? {}, d);
      };
      let kind = "other";
      // The side with the ball on this play, when it says (a shot, a rebound, a turnover), and whether it ends the possession.
      let offense: string | null = null;
      let ends = false;

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
        if (!offensive) over = true;
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
        over = true;
      } else if (/foul|technical|violation|goaltending|kicked|challenge|review|ejection|delay/.test(type)) kind = "violation";

      if (offense && (offense !== owner || (over && kind !== "free-throw"))) {
        possession++;
        owner = offense;
        over = false;
      } else if (offense) over = false;
      if (made && points && team) score[team] = (score[team] ?? 0) + points;
      out.push({
        id: idOf(p.id) || `${i}`,
        at: str(p.wallclock),
        period: num(p.period?.number) ?? 1,
        half: null,
        clock: str(p.clock?.displayValue),
        text,
        kind,
        team,
        unit: possession ? `${event}:${possession}` : null,
        people: [...new Set(ids)],
        score: { ...score },
        deltas: cleanDeltas(deltas),
      });
      if (ends) over = true;
    }
    return inOrder(out);
  }
}
