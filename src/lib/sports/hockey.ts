import { TeamSport, addStats, cleanDeltas, count, headerTeams, idOf, inOrder, isFinal, num, position as pos, ratio, rosterOf, str, val as n, type Box, type BoxPerson, type EspnSummary, type LockCadence, type Periods, type Play, type Position, type PositionGroup, type StatDef, type Stats } from "./sport";

// Hockey (the NHL): its vocabulary and ESPN's readers.
//
// How ESPN records a game (checked on the 2026-27 NHL's October games, 2026-10-28): every play is typed by its abbreviation
// ("faceoff", "shot-on-goal", "shot-missed", "shot-blocked", "goal", "hit", "giveaway", "takeaway"; a penalty by its name, with
// `penaltyMinutes`), its clock counting up from the period's start, its team (the shooter's, the hitter's, the penalized
// player's), and its people with their roles: "scorer" and "assister", "shooter" and "saver" (a missed shot's goalie comes
// untyped after the shooter), "defender" (who blocked it), "hit-credited", "giver", "taker", "face-off-winner" (and the
// loser, untyped); a penalty's player first, then who drew it. A goal doesn't say who was in net, so the goalie is the one the
// last shot at that net named (an empty-net goal is nobody's). A goal's `strength` is the scoring side's ("power-play"). The
// shootout is a period of its own ("SO") whose goals and saves aren't the game's: its plays carry shootout counts of their own
// (ESPN's box score leaves its shootout columns at 0) and its winner's one goal comes at its end. Plus/minus, time on ice and
// shifts need who's on the ice, which the plays don't say, and a goalie's decision comes from the header (ESPN's
// `featuredAthletes`): all known at the final. The real-time scorer's calls (a shot on goal or a miss, and so a save; a hit, a
// block, a giveaway, a takeaway) are judged: ESPN's box score sometimes counts one otherwise after the play.

const SKATING = "skating";
const GOALTENDING = "goaltending";
// Everyone's: time on ice and penalties (a goalie can be penalized).
const ICE = "ice";

const judged = (def: StatDef): StatDef => ({ ...def, judged: true });

const STATS: StatDef[] = [
  count("G", "Goals", "G", "goal", SKATING),
  count("A", "Assists", "A", "assist", SKATING),
  { key: "PTS", label: "Points", short: "PTS", noun: "point", group: SKATING, better: "higher", kind: "derived", of: (s) => n(s, "G") + n(s, "A") },
  count("PM", "Plus/minus", "+/-", "plus/minus point", SKATING, "higher", "final"),
  count("PPG", "Power-play goals", "PPG", "power-play goal", SKATING),
  count("PPA", "Power-play assists", "PPA", "power-play assist", SKATING),
  { key: "PPP", label: "Power-play points", short: "PPP", noun: "power-play point", group: SKATING, better: "higher", kind: "derived", of: (s) => n(s, "PPG") + n(s, "PPA") },
  count("SHG", "Shorthanded goals", "SHG", "shorthanded goal", SKATING),
  count("SHA", "Shorthanded assists", "SHA", "shorthanded assist", SKATING),
  { key: "SHP", label: "Shorthanded points", short: "SHP", noun: "shorthanded point", group: SKATING, better: "higher", kind: "derived", of: (s) => n(s, "SHG") + n(s, "SHA") },
  judged(count("SOG", "Shots on goal", "SOG", "shot on goal", SKATING)),
  judged(count("SM", "Missed shots", "MS", "missed shot", SKATING, "lower")),
  judged(count("BLK", "Blocked shots", "BLK", "blocked shot", SKATING)),
  judged(count("HIT", "Hits", "HIT", "hit", SKATING)),
  judged(count("TK", "Takeaways", "TK", "takeaway", SKATING)),
  judged(count("GV", "Giveaways", "GV", "giveaway", SKATING, "lower")),
  count("FW", "Faceoffs won", "FW", "faceoff won", SKATING),
  count("FL", "Faceoffs lost", "FL", "faceoff lost", SKATING, "lower"),
  { key: "FO%", label: "Faceoff percentage", short: "FO%", noun: "faceoff percentage", group: SKATING, better: "higher", kind: "rate", of: (s) => ratio(n(s, "FW"), n(s, "FW") + n(s, "FL")) },
  count("SHFT", "Shifts", "SHFT", "shift", SKATING, "higher", "final"),
  // The shootout's own, from its plays (ESPN's box score leaves them at 0).
  count("SOGOAL", "Shootout goals", "SO G", "shootout goal", SKATING),

  count("GA", "Goals against", "GA", "goal against", GOALTENDING, "lower"),
  judged(count("SA", "Shots against", "SA", "shot against", GOALTENDING)),
  judged(count("SV", "Saves", "SV", "save", GOALTENDING)),
  { key: "SV%", label: "Save percentage", short: "SV%", noun: "save percentage", group: GOALTENDING, better: "higher", kind: "rate", of: (s) => ratio(n(s, "SV"), n(s, "SA")) },
  // A full game's worth (60 minutes) of goals against, from the seconds on ice.
  { key: "GAA", label: "Goals against average", short: "GAA", noun: "goals against average", group: GOALTENDING, better: "lower", kind: "rate", of: (s) => ratio(3600 * n(s, "GA"), n(s, "TOI")) },
  judged(count("ESSV", "Even-strength saves", "ESSV", "even-strength save", GOALTENDING)),
  judged(count("PPSV", "Power-play saves", "PPSV", "power-play save", GOALTENDING)),
  judged(count("SHSV", "Shorthanded saves", "SHSV", "shorthanded save", GOALTENDING)),
  count("W", "Wins", "W", "win", GOALTENDING, "higher", "final"),
  count("L", "Losses", "L", "loss", GOALTENDING, "lower", "final"),
  count("OTL", "Overtime losses", "OTL", "overtime loss", GOALTENDING, "lower", "final"),
  count("SO", "Shutouts", "SO", "shutout", GOALTENDING, "higher", "final"),
  count("SOSV", "Shootout saves", "SO SV", "shootout save", GOALTENDING),
  count("SOGA", "Shootout goals against", "SO GA", "shootout goal against", GOALTENDING, "lower"),

  // In seconds: they add exactly.
  count("TOI", "Time on ice (seconds)", "TOI", "second on ice", ICE, "higher", "final"),
  count("PPTOI", "Power-play time on ice (seconds)", "PPTOI", "second on the power play", ICE, "higher", "final"),
  count("SHTOI", "Shorthanded time on ice (seconds)", "SHTOI", "second shorthanded", ICE, "higher", "final"),
  count("ESTOI", "Even-strength time on ice (seconds)", "ESTOI", "second at even strength", ICE, "higher", "final"),
  count("PN", "Penalties", "PN", "penalty", ICE, "lower"),
  count("PIM", "Penalty minutes", "PIM", "penalty minute", ICE, "lower"),
];

const GROUPS: PositionGroup[] = [
  { key: "forwards", label: "Forwards", stats: [SKATING, ICE] },
  { key: "defense", label: "Defense", stats: [SKATING, ICE] },
  { key: "goalies", label: "Goalies", stats: [GOALTENDING, ICE] },
];

const POSITIONS: Position[] = [
  pos("C", "Center", "forwards"),
  pos("LW", "Left wing", "forwards"),
  pos("RW", "Right wing", "forwards"),
  pos("F", "Forward", "forwards"),
  pos("D", "Defense", "defense"),
  pos("G", "Goalie", "goalies"),
];

// ESPN's box score columns, by table, to our keys (FO%, SV% and the like are worked out from counts; YTDG is the season's). Not
// its shootout columns (SOG, SOS, SOSA), which it leaves at 0: the shootout's own come from its plays.
const BOX_SKATER: Record<string, string> = { G: "G", A: "A", "+/-": "PM", S: "SOG", SM: "SM", BS: "BLK", HT: "HIT", TK: "TK", GV: "GV", FW: "FW", FL: "FL", SHFT: "SHFT", TOI: "TOI", PPTOI: "PPTOI", SHTOI: "SHTOI", ESTOI: "ESTOI", PN: "PN", PIM: "PIM" };
const BOX_GOALIE: Record<string, string> = { GA: "GA", SA: "SA", SV: "SV", ESSV: "ESSV", PPSV: "PPSV", SHSV: "SHSV", TOI: "TOI", PIM: "PIM" };
const TIMES = new Set(["TOI", "PPTOI", "SHTOI", "ESTOI"]);
// The team's own totals ESPN gives, by its stat names: its players' added up. Not its penalties: a bench minor is the
// team's, nobody's.
const TEAM: Record<string, string> = { blockedShots: "BLK", hits: "HIT", takeaways: "TK", giveaways: "GV", shotsTotal: "SOG", powerPlayGoals: "PPG", shortHandedGoals: "SHG", faceoffsWon: "FW" };

/** "17:50" on ice to seconds (1070). */
export function secondsOf(clock: unknown): number | null {
  const m = /^(\d+):(\d\d)$/.exec(String(clock ?? "").trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export class Hockey extends TeamSport {
  readonly id = "hockey";
  readonly name = "Hockey";
  readonly groups = GROUPS;
  readonly positions = POSITIONS;
  readonly statGroups = [
    { key: SKATING, label: "Skating" },
    { key: GOALTENDING, label: "Goaltending" },
    { key: ICE, label: "Ice time and penalties" },
  ];
  readonly stats = STATS;
  readonly periods: Periods = { word: "period", plural: "periods", regulation: 3, extra: "overtime" };
  readonly lock: LockCadence = "daily";
  // College hockey ends a tied game otherwise (a tie, or a shootout that isn't a goal): L5, with college.
  readonly leagues = ["nhl"];

  /** "2nd period, 5:32 in" (ESPN's hockey clock counts up), "overtime, 1:10 in", "shootout". */
  where(play: Pick<Play, "period" | "half" | "clock" | "shootout">): string {
    if (play.shootout) return "shootout";
    const name = super.where({ ...play, clock: null });
    return play.clock ? `${name}, ${play.clock} in` : name;
  }

  readBox(summary: EspnSummary): Box | null {
    if (!summary.header) return null;
    const teams = headerTeams(summary);
    const people: Record<string, BoxPerson> = {};
    const goalies = new Map<string, string[]>(); // team -> goalies who played
    for (const side of summary.boxscore?.players ?? []) {
      const team = idOf(side.team?.id);
      for (const table of side.statistics ?? []) {
        const name = str(table.name) ?? "";
        const map = name === "goalies" ? BOX_GOALIE : ["forwards", "defenses", "skaters"].includes(name) ? BOX_SKATER : null;
        if (!map) continue;
        const labels = table.labels ?? [];
        for (const row of table.athletes ?? []) {
          const id = idOf(row.athlete?.id);
          if (!id) continue;
          const person = (people[id] ??= { id, name: str(row.athlete?.displayName) ?? "", team, position: this.positionKey(row.athlete?.position?.abbreviation ?? row.position?.abbreviation) ?? (name === "goalies" ? "G" : null), stats: {} });
          const v = row.stats ?? [];
          if (!v.length) continue;
          // Only the columns this table has, zeros kept (the final's correction needs both).
          for (const [label, key] of Object.entries(map)) {
            const i = labels.indexOf(label);
            if (i >= 0) person.stats[key] = (TIMES.has(key) ? secondsOf(v[i]) : num(v[i])) ?? 0;
          }
          if (name === "goalies" && (person.stats.TOI ?? 0) > 0) goalies.set(team, [...(goalies.get(team) ?? []), id]);
        }
      }
    }
    for (const side of summary.boxscore?.teams ?? []) {
      const team = teams.find((t) => t.id === idOf(side.team?.id));
      if (!team) continue;
      for (const s of side.statistics ?? []) {
        const key = s.name ? TEAM[s.name] : undefined;
        const v = key ? (typeof s.value === "number" ? s.value : num(s.displayValue)) : null;
        if (key && v != null) team.stats[key] = v;
      }
    }
    if (!teams.length || !Object.keys(people).length) return null;
    const final = isFinal(summary);
    // A finished game's goalies of record (ESPN's header): the winner's, and the loser's, an overtime loss past regulation in
    // the regular season (a playoff loss in overtime is a loss). A shutout is the winner's when he played the whole game and
    // the other side scored no goal (a shootout's winning goal isn't one).
    if (final) {
      const status = summary.header.competitions?.[0]?.status;
      // Past regulation: the summary's status says so in its detail ("Final/OT", "Final/2OT", "Final/SO"; it has no period).
      const last = Math.max(0, ...(summary.plays ?? []).map((p) => num(p.period?.number) ?? 0));
      const past = (num(status?.period) ?? last) > this.periods.regulation || /\/(?:\d*OT|SO)\b/.test(str(status?.type?.detail) ?? "");
      const extra = past && summary.header.season?.type !== 3;
      for (const ids of goalies.values()) for (const id of ids) Object.assign(people[id].stats, { W: 0, L: 0, OTL: 0, SO: 0 });
      for (const f of status?.featuredAthletes ?? []) {
        const p = people[idOf(f.athlete?.id)];
        if (!p) continue;
        if (f.name === "winningGoalie") {
          p.stats.W = 1;
          const other = teams.find((t) => t.id !== p.team);
          if ((goalies.get(p.team) ?? []).length === 1 && other && other.score === 0) p.stats.SO = 1;
        } else if (f.name === "losingGoalie") p.stats[extra ? "OTL" : "L"] = 1;
      }
    }
    return { event: idOf(summary.header.id), final, teams, people };
  }

  readPlays(summary: EspnSummary, issues?: string[]): Play[] {
    const raw = summary.plays ?? [];
    const event = idOf(summary.header?.id);
    const teams = headerTeams(summary);
    const other = (team: string | null) => teams.find((t) => t.id !== team)?.id ?? null;
    const teamOf = rosterOf(summary);
    const goalies = new Set<string>();
    for (const side of summary.boxscore?.players ?? []) for (const table of side.statistics ?? []) if (table.name === "goalies") for (const row of table.athletes ?? []) if (idOf(row.athlete?.id)) goalies.add(idOf(row.athlete?.id));
    const typeOf = (p: (typeof raw)[number]) => (str(p.type?.abbreviation) ?? str(p.type?.text) ?? "").toLowerCase();
    const role = (p: (typeof raw)[number], r: string) => idOf(p.participants?.find((x) => x.type === r)?.athlete?.id) || null;
    const untyped = (p: (typeof raw)[number]) => (p.participants ?? []).filter((x) => !x.type).map((x) => idOf(x.athlete?.id)).filter(Boolean);
    /** The goalie a shot names: its saver, or a missed shot's untyped second person when they're a goalie. */
    const goalieNamed = (p: (typeof raw)[number]) => {
      const t = typeOf(p);
      if (t === "shot-on-goal") return role(p, "saver");
      if (t === "shot-missed") return untyped(p).find((id) => goalies.has(id)) ?? null;
      return null;
    };
    const named = raw.map(goalieNamed);
    // Who's in each net, and since which period: the goalie the last shot at it named; before any, the first one a shot names
    // (or the side's only goalie).
    const inNet = new Map<string, { goalie: string; period: number }>();
    raw.forEach((p, i) => {
      const t = named[i] ? teamOf.get(named[i]!) : undefined;
      if (t && !inNet.has(t)) inNet.set(t, { goalie: named[i]!, period: 0 });
    });
    for (const team of new Set(teamOf.values())) {
      const only = [...goalies].filter((g) => teamOf.get(g) === team);
      if (!inNet.has(team) && only.length === 1) inNet.set(team, { goalie: only[0], period: 0 });
    }
    /** Who a goal at this net was against: who's in it, unless they were last named in an earlier period and the next shot at
     *  it names someone else (a goalie changed at the intermission, whose first shot was this goal). */
    const against = (into: string, i: number, period: number) => {
      const cur = inNet.get(into);
      if (!cur || cur.period >= period) return cur?.goalie;
      for (let j = i + 1; j < raw.length; j++) if (named[j] && teamOf.get(named[j]!) === into) return named[j] !== cur.goalie && num(raw[j].period?.number) === period ? named[j]! : cur.goalie;
      return cur.goalie;
    };

    const score: Record<string, number> = Object.fromEntries(teams.map((t) => [t.id, 0]));
    const shootout: Record<string, number> = {};
    const out: Play[] = [];
    let unit = 0;
    for (let i = 0; i < raw.length; i++) {
      const p = raw[i];
      const t = typeOf(p);
      const text = str(p.text) ?? "";
      const team = idOf(p.team?.id) || null;
      const period = num(p.period?.number) ?? 1;
      // The period's own name says so ("SO"); without one, a regular season's 5th period is its shootout.
      const shown = str(p.period?.displayValue);
      const inShootout = shown ? /^SO$/i.test(shown) : summary.header?.season?.type === 2 && period === this.periods.regulation + 2;
      const said = str(p.strength?.abbreviation) ?? "";
      let strength = said;
      // An empty-net goal says only "empty-net": whether it was also on the power play or shorthanded is the last play's
      // before it (a play's strength is its own side's, so the other side's is flipped).
      if (said === "empty-net") {
        const flip: Record<string, string> = { "power-play": "short-handed", "short-handed": "power-play" };
        for (let j = i - 1; j >= 0 && num(raw[j].period?.number) === num(p.period?.number); j--) {
          const was = str(raw[j].strength?.abbreviation);
          const side = idOf(raw[j].team?.id);
          if (!was || was === "empty-net" || !side) continue;
          strength = side === team ? was : (flip[was] ?? was);
          break;
        }
      }
      const deltas: Record<string, Stats> = {};
      const add = (who: string | null | undefined, d: Stats) => {
        if (who) deltas[who] = addStats(deltas[who] ?? {}, d);
      };
      let kind = t.replace(/\s+/g, "-") || "other";
      if (named[i] && teamOf.get(named[i]!)) inNet.set(teamOf.get(named[i]!)!, { goalie: named[i]!, period });

      if (t === "faceoff") {
        unit++;
        add(role(p, "face-off-winner"), { FW: 1 });
        add(untyped(p)[0], { FL: 1 });
      } else if (t === "hit") add(role(p, "hit-credited"), { HIT: 1 });
      else if (t === "giveaway") add(role(p, "giver"), { GV: 1 });
      else if (t === "takeaway") add(role(p, "taker"), { TK: 1 });
      else if (t === "shot-blocked") {
        // Blocked by a teammate ("Gustafsson shot blocked by Byfield", both Kings) isn't a blocked shot.
        const by = role(p, "defender");
        const shooter = role(p, "shooter");
        if (by && (!shooter || teamOf.get(by) !== teamOf.get(shooter))) add(by, { BLK: 1 });
      }
      else if (t === "shot-missed") {
        if (!inShootout) add(role(p, "shooter"), { SM: 1 });
      } else if (t === "shot-on-goal") {
        const saver = role(p, "saver");
        if (inShootout) add(saver, { SOSV: 1 });
        else {
          add(role(p, "shooter"), { SOG: 1 });
          // The save by the shooting side's strength: a power play's shot is a power-play save.
          add(saver, { SV: 1, SA: 1, [strength === "power-play" ? "PPSV" : strength === "short-handed" ? "SHSV" : "ESSV"]: 1 });
        }
      } else if (t === "goal") {
        const scorer = role(p, "scorer");
        const into = other(team);
        const goalie = into ? against(into, i, period) : undefined;
        if (inShootout) {
          kind = "shootout-goal";
          add(scorer, { SOGOAL: 1 });
          add(goalie, { SOGA: 1 });
          if (team) shootout[team] = (shootout[team] ?? 0) + 1;
        } else {
          const pp = strength === "power-play";
          const sh = strength === "short-handed";
          add(scorer, { G: 1, SOG: 1, PPG: pp ? 1 : 0, SHG: sh ? 1 : 0 });
          for (const x of p.participants ?? []) if (x.type === "assister") add(idOf(x.athlete?.id), { A: 1, PPA: pp ? 1 : 0, SHA: sh ? 1 : 0 });
          // An empty net's goal is nobody's against.
          const empty = str(p.shotInfo?.abbreviation) === "empty-net" || said === "empty-net";
          if (!empty) {
            if (goalie) add(goalie, { GA: 1, SA: 1 });
            else issues?.push(`${idOf(p.id)}: a goal with no goalie in net: ${text}`);
          }
          if (team) score[team] = (score[team] ?? 0) + 1;
          if (!scorer) issues?.push(`${idOf(p.id)}: a goal with no scorer: ${text}`);
        }
      } else if (p.type?.penaltyMinutes != null) {
        kind = "penalty";
        // The one who committed it, named first ("... served by Newhook" names the server only in its text). A bench minor
        // ("Too many men/ice served by ...") names nobody: it's the team's. Not by its penaltyType: ESPN types a player's own
        // penalty "Bench" too (Guentzel's unsportsmanlike conduct, his in the box score).
        const who = idOf(p.participants?.[0]?.athlete?.id) || null;
        add(who, { PN: 1, PIM: num(p.type.penaltyMinutes) ?? 0 });
      } else if (t === "shootout-end") {
        // The shootout's winner scores the game's one more goal.
        const [a, b] = teams.map((x) => shootout[x.id] ?? 0);
        const won = a > b ? teams[0]?.id : b > a ? teams[1]?.id : null;
        if (won) score[won] = (score[won] ?? 0) + 1;
        kind = "shootout-end";
      }

      out.push({
        id: idOf(p.id) || `${i}`,
        at: str(p.wallclock),
        period,
        half: null,
        clock: inShootout ? null : str(p.clock?.displayValue),
        text,
        kind,
        team,
        unit: unit && !inShootout ? `${event}:${unit}` : null,
        people: [...new Set((p.participants ?? []).map((x) => idOf(x.athlete?.id)).filter(Boolean))],
        score: { ...score },
        deltas: cleanDeltas(deltas),
        ...(inShootout ? { shootout: true } : {}),
      });
    }
    return inOrder(out);
  }
}

