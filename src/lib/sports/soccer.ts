import { TeamSport, addStats, cleanDeltas, count as stat, headerTeams, idOf, inOrder, isFinal, msOf, num, position as pos, ratio, str, val as n, type Box, type BoxPerson, type EspnSummary, type EspnTeam, type LockCadence, type Periods, type Play, type Position, type PositionGroup, type StatDef, type Stats } from "./sport";

// Soccer (every league ESPN carries: they write the same, checked on the Premier League, MLS, the Champions League, the
// Carabao Cup and the DFB-Pokal, 2026-10-28): its vocabulary and ESPN's readers.
//
// How ESPN records a match. Its summary has no `boxscore.players` and no `plays`:
// - `rosters`: each side's match sheet, every player with his line (`stats`, by name: appearances, goals, assists, shots, shots
//   on target, fouls committed and suffered, offsides, cards, own goals, goals conceded while he was on, a keeper's saves), his
//   slot in the formation (a sub's is "SUB") and whether he started. No minutes: the plays give them.
// - `commentary`: the play by play (every foul, shot, offside, corner, card, substitution, goal and shootout kick), each entry
//   with its `play` (a foul twice, its two sentences sharing one): its type, period, clock (`value` in seconds, stopped at the
//   half's end: stoppage time is "45'+2'" at 2700), its wallclock, its team and its people, by name only (the match sheet's
//   names, exactly; the text's own can differ: "Pascal Groß" for "Pascal Gross").
// - `keyEvents`: the goals, cards and substitutions again with ESPN's athlete and team ids, plus what the commentary leaves
//   out (the kickoff, half time, the end of normal time, the shootout's start). A play is the commentary's, its ids from the
//   key event of the same id; a key event the commentary hasn't is placed by its period and time.
// What a line counts, read off ESPN's data: a goal is a shot on target; a saved penalty is too, a missed one only a shot; a
// shot off the woodwork or blocked is a shot; a keeper's save is a shot on target he stopped (the commentary names him); an
// offside is the one its text says was caught, not its person (who played the pass); a second yellow is a red, and his first
// yellow comes off; goals conceded are every player's on the pitch at the time, so who's on (the lineup, substitutions, red
// cards) is tracked; an own goal is its scorer's, the other side's goal. The shootout (period 5) is its own: its kicks
// aren't goals, shots or the score (ESPN's lines leave them out, its header keeps `shootoutScore`).

const PLAYING = "playing";
const ATTACKING = "attacking";
const DEFENDING = "defending";
const KEEPING = "goalkeeping";
const DISCIPLINE = "discipline";
const SHOOTOUT = "shootout";

const judged = (def: StatDef): StatDef => ({ ...def, judged: true });
const derived = (key: string, label: string, short: string, noun: string, group: string, of: (s: Stats) => number | null, better: "higher" | "lower" = "higher"): StatDef => ({ key, label, short, noun, group, better, kind: "derived", of });
/** A clean sheet, as FPL counts it: 60 minutes or more, and nothing conceded while on. */
const cleanSheet = (s: Stats) => (n(s, "MIN") >= 60 && n(s, "GA") === 0 ? 1 : 0);

const STATS: StatDef[] = [
  stat("APP", "Appearances", "APP", "appearance", PLAYING),
  stat("GS", "Starts", "GS", "start", PLAYING),
  stat("SUB", "Substitute appearances", "SUB", "substitute appearance", PLAYING),
  // From the lineup, the substitutions, red cards and each half's end (ESPN's lines have no minutes): the minute shown, stoppage
  // time left out, as FPL counts them.
  stat("MIN", "Minutes", "MIN", "minute played", PLAYING),
  derived("MIN60", "Games of 60 minutes or more", "60+", "game of 60 minutes or more", PLAYING, (s) => (n(s, "MIN") >= 60 ? 1 : 0)),

  stat("G", "Goals", "G", "goal", ATTACKING),
  judged(stat("A", "Assists", "A", "assist", ATTACKING)),
  judged(stat("SHOT", "Shots", "SH", "shot", ATTACKING)),
  judged(stat("SOG", "Shots on target", "ST", "shot on target", ATTACKING)),
  { key: "SOG%", label: "Shots on target percentage", short: "ST%", noun: "shots on target percentage", group: ATTACKING, better: "higher", kind: "rate", of: (s) => ratio(n(s, "SOG"), n(s, "SHOT")) },
  stat("PKG", "Penalties scored", "PKG", "penalty scored", ATTACKING),
  stat("PKA", "Penalties taken", "PKA", "penalty taken", ATTACKING),
  // Saved or missed: FPL's penalty miss.
  stat("PKM", "Penalties missed", "PKM", "penalty missed", ATTACKING, "lower"),
  judged(stat("OF", "Offsides", "OFF", "offside", ATTACKING, "lower")),

  stat("GA", "Goals conceded while on", "GC", "goal conceded", DEFENDING, "lower"),
  derived("CS", "Clean sheets", "CS", "clean sheet", DEFENDING, cleanSheet),
  // FPL's "-1 for every 2 goals conceded".
  derived("GA2", "Every two goals conceded", "GC2", "two goals conceded", DEFENDING, (s) => Math.floor(n(s, "GA") / 2), "lower"),
  stat("OG", "Own goals", "OG", "own goal", DEFENDING, "lower"),

  // ESPN's lines can count a save the commentary tells as a blocked shot (Houston's fifth, 2026-10-18).
  judged(stat("SV", "Saves", "SV", "save", KEEPING)),
  stat("PKSV", "Penalties saved", "PKSV", "penalty saved", KEEPING),
  // FPL's "+1 for every 3 saves".
  derived("SV3", "Every three saves", "SV3", "three saves", KEEPING, (s) => Math.floor(n(s, "SV") / 3)),
  { key: "SV%", label: "Save percentage", short: "SV%", noun: "save percentage", group: KEEPING, better: "higher", kind: "rate", of: (s) => ratio(n(s, "SV"), n(s, "SV") + n(s, "GA")) },

  judged(stat("FC", "Fouls committed", "FC", "foul committed", DISCIPLINE, "lower")),
  judged(stat("FA", "Fouls suffered", "FS", "foul suffered", DISCIPLINE)),
  stat("YC", "Yellow cards", "YC", "yellow card", DISCIPLINE, "lower"),
  stat("RC", "Red cards", "RC", "red card", DISCIPLINE, "lower"),

  // A penalty shootout's own: never the match's goals, shots or score.
  stat("SOGOAL", "Shootout goals", "SO G", "shootout goal", SHOOTOUT),
  stat("SOMISS", "Shootout misses", "SO M", "shootout miss", SHOOTOUT, "lower"),
  stat("SOSV", "Shootout saves", "SO SV", "shootout save", SHOOTOUT),
  stat("SOGA", "Shootout goals against", "SO GA", "shootout goal against", SHOOTOUT, "lower"),
];

const OUTFIELD = [PLAYING, ATTACKING, DEFENDING, DISCIPLINE, SHOOTOUT];
const GROUPS: PositionGroup[] = [
  { key: "GK", label: "Goalkeepers", stats: [PLAYING, KEEPING, DEFENDING, ATTACKING, DISCIPLINE, SHOOTOUT] },
  { key: "DEF", label: "Defenders", stats: OUTFIELD },
  { key: "MID", label: "Midfielders", stats: OUTFIELD },
  { key: "FWD", label: "Forwards", stats: OUTFIELD },
];

// ESPN's abbreviations: a team's roster says G, D, M or F; a match sheet the slot in the formation (CD-L, AM-R, CF-R), and
// "SUB" for anyone on the bench, which isn't a position (a sub's is his roster's).
const POSITIONS: Position[] = [
  pos("G", "Goalkeeper", "GK"),
  pos("D", "Defender", "DEF"),
  pos("CD", "Center defender", "DEF"),
  pos("CD-L", "Center left defender", "DEF"),
  pos("CD-R", "Center right defender", "DEF"),
  pos("SW", "Sweeper", "DEF"),
  pos("LB", "Left back", "DEF"),
  pos("RB", "Right back", "DEF"),
  pos("M", "Midfielder", "MID"),
  pos("DM", "Defensive midfielder", "MID"),
  pos("CM", "Center midfielder", "MID"),
  pos("CM-L", "Center left midfielder", "MID"),
  pos("CM-R", "Center right midfielder", "MID"),
  pos("LM", "Left midfielder", "MID"),
  pos("RM", "Right midfielder", "MID"),
  pos("AM", "Attacking midfielder", "MID"),
  pos("AM-L", "Attacking midfielder left", "MID"),
  pos("AM-R", "Attacking midfielder right", "MID"),
  pos("F", "Forward", "FWD"),
  pos("CF-L", "Center left forward", "FWD"),
  pos("CF-R", "Center right forward", "FWD"),
  pos("LF", "Left forward", "FWD"),
  pos("RF", "Right forward", "FWD"),
  pos("RCF", "Rear center forward", "FWD"),
];

// A player's line, by ESPN's stat names (its abbreviations clash: "SUB" is the sub-ins' and a bench slot's). Not shotsFaced,
// which ESPN leaves at 0 for every keeper.
const LINE: Record<string, string> = { appearances: "APP", subIns: "SUB", totalGoals: "G", goalAssists: "A", totalShots: "SHOT", shotsOnTarget: "SOG", ownGoals: "OG", yellowCards: "YC", redCards: "RC", foulsCommitted: "FC", foulsSuffered: "FA", offsides: "OF", goalsConceded: "GA", saves: "SV" };
// The team's own totals ESPN gives (boxscore.teams[].statistics), its players' added up.
// Not its penalties: its penaltyKickGoals are 0 for every converted penalty seen (2026-10-28), and its penaltyKickShots too
// in a competition with the thinner commentary (the DFB-Pokal's).
// A foul's sentences, and the others ESPN's lines count as one committed (simulation, a keeper's back pass).
const FOULS = /^Foul by |wins a free kick|^Penalty conceded by |draws a foul|deems it simulation|^Back pass by |^Dangerous play by /;
/** Who committed a foul, as its sentences say. */
const FOULED_BY = [/^Foul by (.+?) \(/, /^Penalty conceded by (.+?) \(/, /^(.+?) \([^()]*\) has gone down, but the referee deems it simulation/, /^Back pass by (.+?) \(/, /^Dangerous play by (.+?) \(/];
/** Who was fouled. */
const FOULED = [/^(.+?) \([^()]*\) wins a free kick/, /(?:^|\.\s+)([^.]+?) draws a foul/];

const TEAM: Record<string, string> = { foulsCommitted: "FC", yellowCards: "YC", redCards: "RC", offsides: "OF", saves: "SV", totalShots: "SHOT", shotsOnTarget: "SOG" };

/** A commentary entry's play, or a key event (which has ESPN's ids). */
interface SoccerPlay {
  id?: string | number;
  type?: { id?: string | number; text?: string; type?: string };
  text?: string;
  period?: { number?: number };
  /** `value` in seconds, stopped at the half's end (stoppage time is 2700 for "45'+2'"). */
  clock?: { value?: number; displayValue?: string };
  team?: { id?: string | number; displayName?: string };
  participants?: { athlete?: { id?: string | number; displayName?: string } }[];
  wallclock?: string;
  shootout?: boolean;
  /** Ours: a commentary sentence with no play of its own (a foul's), read as one. */
  unplayed?: true;
}

interface SoccerSummary extends EspnSummary {
  format?: { regulation?: { periods?: number; clock?: number } };
  rosters?: {
    homeAway?: string;
    team?: EspnTeam;
    roster?: {
      starter?: boolean;
      athlete?: { id?: string | number; displayName?: string; fullName?: string; lastName?: string };
      position?: { abbreviation?: string; name?: string };
      stats?: { name?: string; abbreviation?: string; value?: number; displayValue?: string }[];
    }[];
  }[];
  keyEvents?: SoccerPlay[];
  commentary?: { sequence?: number; time?: { value?: number; displayValue?: string }; text?: string; play?: SoccerPlay }[];
}

/** A name as plain lowercase words: no accents, ß as ss ("Gaëtan Perrin" and "Gaetan Perrin", "Groß" and "Gross"). */
export function plainName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[øØ]/g, "o")
    .replace(/[łŁ]/g, "l")
    .replace(/[æÆ]/g, "ae")
    .replace(/[đĐ]/g, "d")
    .replace(/ı/g, "i")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Whether two words are one letter apart at most ("Newerton", "Newertton"). */
function nearly(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return a.slice(i + 1) === b.slice(i + 1) || a.slice(i) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i);
}

interface Player {
  id: string;
  team: string;
  names: string[];
  plain: string[];
  words: Set<string>;
  starter: boolean;
  keeper: boolean;
}

/**
 * Who a name is, among one side's players (or both's): the match sheet's name exactly (the commentary's people always are), then
 * the same words without accents, then one sharing its surname, then one sharing the most words, then one a letter off. Null
 * when it's nobody, or two could be (two "Pedrinho"s on one side).
 */
function whoIs(name: string, players: Player[], exactly = false): Player | null {
  const one = (xs: Player[]) => (xs.length === 1 ? xs[0] : null);
  const exact = players.filter((p) => p.names.includes(name));
  if (exact.length || exactly) return one(exact);
  const plain = plainName(name);
  if (!plain) return null;
  const same = players.filter((p) => p.plain.includes(plain));
  if (same.length) return one(same);
  const words = plain.split(" ");
  const surname = players.filter((p) => p.words.has(words[words.length - 1]));
  if (surname.length === 1) return surname[0];
  const shared = (p: Player) => words.filter((w) => p.words.has(w)).length;
  const best = Math.max(0, ...players.map(shared));
  if (best > 0) return one(players.filter((p) => shared(p) === best));
  return one(players.filter((p) => p.plain.some((x) => x.length >= 5 && nearly(x, plain))));
}

export class Soccer extends TeamSport {
  readonly id = "soccer";
  readonly name = "Soccer";
  readonly groups = GROUPS;
  readonly positions = POSITIONS;
  readonly statGroups = [
    { key: PLAYING, label: "Playing time" },
    { key: ATTACKING, label: "Attacking" },
    { key: DEFENDING, label: "Defending" },
    { key: KEEPING, label: "Goalkeeping" },
    { key: DISCIPLINE, label: "Discipline" },
    { key: SHOOTOUT, label: "Penalty shootout" },
  ];
  readonly stats = STATS;
  readonly periods: Periods = { word: "half", plural: "halves", regulation: 2, extra: "extra time" };
  // FPL's deadline is per gameweek (a round of matches, about a week); ESPN's soccer scoreboards don't number rounds.
  readonly lock: LockCadence = "weekly";

  /** "1st half, 23'", "2nd half, 90'+5'", "extra time, 1st half, 98'", "penalty shootout". */
  where(play: Pick<Play, "period" | "half" | "clock" | "shootout">): string {
    if (play.shootout || play.period > 4) return "penalty shootout";
    const half = play.period % 2 === 1 ? "1st half" : "2nd half";
    const name = play.period > this.periods.regulation ? `${this.periods.extra}, ${half}` : half;
    return play.clock ? `${name}, ${play.clock}` : name;
  }

  /** A position from ESPN's abbreviation; a bench slot ("SUB") isn't one. */
  positionKey(abbreviation: string | null | undefined): string | null {
    const key = super.positionKey(abbreviation);
    return key === "SUB" ? null : key;
  }

  /** A game's derived stats, and a clean sheet for anyone who played, though he has nothing in defending's counts. */
  full(counts: Stats): Stats {
    const out = super.full(counts);
    if (n(counts, "APP") > 0) for (const s of STATS) if (s.group === DEFENDING && s.of && !(s.key in out)) out[s.key] = s.of(counts) ?? 0;
    return out;
  }

  readBox(summary: EspnSummary): Box | null {
    const s = summary as SoccerSummary;
    if (!s.header) return null;
    const teams = headerTeams(s);
    const people: Record<string, BoxPerson> = {};
    for (const side of s.rosters ?? []) {
      const team = idOf(side.team?.id);
      for (const row of side.roster ?? []) {
        const id = idOf(row.athlete?.id);
        if (!id) continue;
        const stats: Stats = {};
        // Only what ESPN lists for him, zeros kept (a keeper's saves, an outfield player's offsides).
        for (const x of row.stats ?? []) {
          const key = x.name ? LINE[x.name] : undefined;
          if (key) stats[key] = num(x.value) ?? num(x.displayValue) ?? 0;
        }
        const played = n(stats, "APP") > 0;
        if (played) stats.GS = row.starter ? 1 : 0;
        // On the bench all game with nothing to his name: no line (a sub booked on the bench keeps his).
        const line = played || Object.values(stats).some((v) => v) ? stats : {};
        people[id] = { id, name: str(row.athlete?.displayName) ?? "", team, position: this.positionKey(row.position?.abbreviation), stats: line };
      }
    }
    const shootout = new Map((s.header.competitions?.[0]?.competitors ?? []).map((c) => [idOf(c.team?.id), num(c.shootoutScore)]));
    for (const side of s.boxscore?.teams ?? []) {
      const team = teams.find((t) => t.id === idOf(side.team?.id));
      if (!team) continue;
      for (const x of side.statistics ?? []) {
        const key = x.name ? TEAM[x.name] : undefined;
        const v = key ? (typeof x.value === "number" ? x.value : num(x.displayValue)) : null;
        if (key && v != null) team.stats[key] = v;
      }
    }
    for (const team of teams) {
      const so = shootout.get(team.id);
      if (so != null) team.stats.SOGOAL = so;
    }
    if (!teams.length || !Object.keys(people).length) return null;
    return { event: idOf(s.header.id), final: isFinal(s), teams, people };
  }

  readPlays(summary: EspnSummary, issues?: string[]): Play[] {
    const s = summary as SoccerSummary;
    const teams = headerTeams(s);
    const other = (team: string | null) => (team ? (teams.find((t) => t.id !== team)?.id ?? null) : null);
    const teamByName = new Map<string, string>();
    for (const t of teams) teamByName.set(plainName(t.name), t.id);

    // The match sheets.
    const players: Player[] = [];
    const byId = new Map<string, Player>();
    for (const side of s.rosters ?? []) {
      const team = idOf(side.team?.id);
      if (side.team?.displayName) teamByName.set(plainName(side.team.displayName), team);
      for (const row of side.roster ?? []) {
        const id = idOf(row.athlete?.id);
        if (!id) continue;
        const names = [row.athlete?.displayName, row.athlete?.fullName].map(str).filter((x): x is string => !!x);
        const plain = [...new Set(names.map(plainName))];
        const words = new Set([...plain, plainName(str(row.athlete?.lastName) ?? "")].join(" ").split(" ").filter(Boolean));
        const p: Player = { id, team, names, plain, words, starter: row.starter === true, keeper: str(row.position?.abbreviation)?.toUpperCase() === "G" };
        players.push(p);
        byId.set(id, p);
      }
    }
    const side = (team: string | null) => (team ? players.filter((p) => p.team === team) : players);
    /** A name in the text or a person's: exactly as a match sheet has it on the side it's said to be on, else the other, and
     *  only then like one ("Diego Gómez" of Brighton is never Liverpool's Joe Gomez). */
    const lookup = (name: string | null | undefined, team: string | null): string | null => {
      if (!name) return null;
      const sides = team ? [side(team), side(other(team))] : [players];
      const p = sides.map((xs) => whoIs(name, xs, true)).find(Boolean) ?? sides.map((xs) => whoIs(name, xs)).find(Boolean);
      return p?.id ?? null;
    };

    // The plays: the commentary's, once each, then the key events it hasn't (the kickoff, half time...) by period and time.
    // A play's sentences: a foul has two ("Foul by Rayan Cherki (Manchester City).", "Boubacar Kamara (Aston Villa) wins a free
    // kick in the defensive half.").
    const texts = new Map<string, string[]>();
    const raw: SoccerPlay[] = [];
    const had = new Set<string>();
    const entries = s.commentary ?? [];
    const sentence = (t: string, id: string) => texts.set(id, [...(texts.get(id) ?? []), t]);
    for (const c of entries) if (c.play && idOf(c.play.id) && str(c.text)) sentence(str(c.text)!, idOf(c.play.id));
    let inPeriod = 1;
    entries.forEach((c, i) => {
      const id = idOf(c.play?.id);
      const t = str(c.text);
      if (c.play && id) {
        inPeriod = num(c.play.period?.number) ?? inPeriod;
        if (had.has(id)) return;
        had.add(id);
        // A foul filed twice under two ids, a sentence each (Brazil's 72nd minute at the 2026 World Cup: "Junya Ito (Japan) wins
        // a free kick", then "Foul by Gabriel Martinelli"): ESPN's lines count it once.
        const last = raw[raw.length - 1];
        const foulOf = (x: SoccerPlay | undefined) => x?.type?.type === "foul" && !x.unplayed;
        if (foulOf(c.play) && foulOf(last) && (c.play.participants ?? []).length && num(last.clock?.value) === num(c.play.clock?.value) && JSON.stringify(last.participants) === JSON.stringify(c.play.participants)) {
          for (const t of texts.get(id) ?? []) sentence(t, idOf(last.id));
          return;
        }
        raw.push(c.play);
        return;
      }
      // A sentence with no play of its own that ESPN's lines count: a foul's other sentence, next to its play at the same time
      // (the play has one sentence, not two), else a foul of its own (two sentences in a row, or one: "has gone down, but the
      // referee deems it simulation"), placed where it's said, in the period of the play before it.
      if (!t || !FOULS.test(t)) return;
      const at = num(c.time?.value);
      const next = [entries[i - 1], entries[i + 1]].find((x) => x?.play && idOf(x.play.id) && num(x.time?.value) === at && (texts.get(idOf(x.play.id))?.length ?? 0) < 2 && (texts.get(idOf(x.play.id)) ?? []).every((y) => FOULS.test(y)));
      if (next) return sentence(t, idOf(next.play!.id));
      const last = raw[raw.length - 1];
      const lastId = idOf(last?.id);
      if (last?.unplayed && (texts.get(lastId)?.length ?? 0) < 2 && Math.abs((num(last.clock?.value) ?? -99) - (at ?? 99)) <= 2 && !/simulation|^Back pass|with a handball/i.test(t)) return sentence(t, lastId);
      const own = `c${num(c.sequence) ?? i}`;
      raw.push({ id: own, unplayed: true, type: { type: /with a handball/i.test(t) ? "handball" : "foul" }, period: { number: inPeriod }, clock: { value: at ?? undefined, displayValue: str(c.time?.displayValue) ?? undefined } });
      sentence(t, own);
    });
    const keyed = new Map<string, SoccerPlay>();
    for (const e of s.keyEvents ?? []) {
      const id = idOf(e.id);
      if (!id) continue;
      keyed.set(id, e);
      if (had.has(id)) continue;
      had.add(id);
      // Period 0 is the thinner feed's shootout, after everything.
      const period = (num(e.period?.number) ?? 1) || 5;
      const t = msOf(e.wallclock);
      const i = raw.findIndex((x) => {
        const p = (num(x.period?.number) ?? 1) || 5;
        return p > period || (p === period && t != null && (msOf(x.wallclock) ?? -Infinity) > t);
      });
      raw.splice(i < 0 ? raw.length : i, 0, e);
    }

    // The clock in minutes, as shown ("6'" is 5:54 in), stoppage time held at the half's end: each period's start and end.
    const half = (num(s.format?.regulation?.clock) ?? 2700) / 60;
    const bounds = (period: number): [number, number] => (period <= 2 ? [half * (period - 1), half * period] : [2 * half + 15 * (period - 3), 2 * half + 15 * (period - 2)]);
    const minuteOf = (p: SoccerPlay, period: number) => {
      const [from, to] = bounds(period);
      const v = num(p.clock?.value);
      return v == null ? from : Math.min(to, Math.max(from, Math.ceil(v / 60)));
    };

    const score: Record<string, number> = Object.fromEntries(teams.map((t) => [t.id, 0]));
    const on = new Map<string, number>(); // who's on the pitch, and the minute they're counted to
    const keeper = new Map<string, string>(); // each side's keeper on the pitch
    const booked = new Set<string>(); // who's had a yellow card
    const seen = new Set<number>(); // the periods played
    let closed = 0; // the periods whose minutes are counted
    let lineup = false;
    const out: Play[] = [];
    /** Whether a period was played: one with a play in it, both halves always, and both of extra time's once either has one
     *  (the thinner feed has no kickoff, half time or end, and a half of extra time can pass with nothing in it). */
    const played = (q: number) => seen.has(q) || q <= 2 || (q <= 4 && (seen.has(3) || seen.has(4)));
    /** The minutes of everyone on, counted into `into` to the end of each period played through `through`. */
    const closeInto = (through: number, into: Record<string, Stats>) => {
      while (closed < through) {
        closed++;
        if (closed > 4 || !played(closed)) continue;
        const end = bounds(closed)[1];
        for (const [who, since] of on) {
          into[who] = addStats(into[who] ?? {}, { MIN: end - since });
          on.set(who, end);
        }
      }
    };

    for (let i = 0; i < raw.length; i++) {
      const p = raw[i];
      const id = idOf(p.id) || `${i}`;
      const key = keyed.get(id);
      const type = (str(p.type?.type) ?? str(p.type?.text) ?? "").toLowerCase().replace(/-{2,}/g, "-").replace(/\s+/g, "-");
      const sentences = texts.get(id) ?? [];
      const text = sentences[0] ?? str(p.text) ?? str(key?.text) ?? "";
      /** A name a sentence of the play says, by the first pattern that finds one. */
      const said = (...patterns: RegExp[]) => sentences.map((t) => patterns.map((re) => re.exec(t)?.[1]?.trim()).find(Boolean)).find(Boolean) ?? null;
      const filed = num(p.period?.number) ?? num(key?.period?.number) ?? 1;
      // The shootout is period 5; the thinner feed files its kicks in period 0 once the match is played ("Penalty - Scored at
      // 122'", Holstein Kiel–Hoffenheim in the DFB-Pokal, 2026-10-28).
      const shootout = filed > 4 || p.shootout === true || (filed === 0 && seen.size > 0);
      const period = shootout ? 5 : Math.max(1, filed);
      const team = idOf(key?.team?.id ?? p.team?.id) || (p.team?.displayName ? (teamByName.get(plainName(p.team.displayName)) ?? null) : null) || null;
      // Its people: ESPN's ids from the key event of the same id, else the match sheet's names.
      const people = (p.participants ?? []).map((x, j) => idOf(key?.participants?.[j]?.athlete?.id) || idOf(x.athlete?.id) || lookup(x.athlete?.displayName, team) || "");
      const deltas: Record<string, Stats> = {};
      const add = (who: string | null | undefined, d: Stats) => {
        if (who) deltas[who] = addStats(deltas[who] ?? {}, d);
      };
      const teamOf = (who: string | null | undefined) => (who ? (byId.get(who)?.team ?? null) : null);
      const minute = minuteOf(p, Math.min(period, 4));
      const close = (through: number) => closeInto(through, deltas);
      const off = (who: string, at: number) => {
        const since = on.get(who);
        if (since == null) return;
        add(who, { MIN: at - since });
        on.delete(who);
        const t = teamOf(who);
        if (t && keeper.get(t) === who) keeper.delete(t);
      };
      /**
       * A goal against a side: every one of its players on the pitch concedes it, as ESPN lists them: in the minute of a
       * substitution, whoever's on by its order (Brazil's 79th minute at the 2026 World Cup: Éderson on, then Haaland's goal, and
       * ESPN's lines give it to Éderson).
       */
      const conceded = (against: string | null) => {
        for (const who of on.keys()) if (teamOf(who) === against) add(who, { GA: 1 });
      };
      const saverOf = (defending: string | null) => lookup(/\bsaved\b[^.]*?\bby ([^()]+?) \(/.exec(text)?.[1]?.trim(), defending) ?? (defending ? (keeper.get(defending) ?? null) : null);

      /**
       * A foul: who fouled is on the play's side, who was fouled on the other, as its sentences name them; ESPN's lines go by
       * them when its people say otherwise (Aston Villa's 71st minute, 2026-10-24: "Foul by Boubacar Kamara", its people Ross
       * Barkley; Kamara's line has it). Else, on a play typed a foul, its people. A sentence with no play has no side: either.
       */
      const foul = (typed: boolean) => {
        const [by, fouled] = !typed ? [null, null] : teamOf(first) === team || !team ? [first, second] : [second, first];
        add(lookup(said(...FOULED_BY), team) ?? by, { FC: 1 });
        add(lookup(said(...FOULED), team ? other(team) : null) ?? fouled, { FA: 1 });
      };

      // A new period closes the ones before it; the shootout, every one played.
      close(shootout ? 4 : period - 1);
      if (!shootout) seen.add(period);
      if (!lineup) {
        lineup = true;
        for (const pl of players) {
          if (!pl.starter) continue;
          add(pl.id, { APP: 1, GS: 1 });
          on.set(pl.id, 0);
          if (pl.keeper) keeper.set(pl.team, pl.id);
        }
      }

      let kind = type || "other";
      const [first, second] = people;
      const shooterSide = teamOf(first) ?? team;
      if (shootout) {
        // A shootout's kick: its own counts, never the match's.
        const defending = other(shooterSide);
        if (type === "penalty-scored") {
          add(first, { SOGOAL: 1 });
          add(defending ? keeper.get(defending) : null, { SOGA: 1 });
        } else if (type === "penalty-saved") {
          add(first, { SOMISS: 1 });
          add(saverOf(defending), { SOSV: 1 });
        } else if (type === "penalty-missed") add(first, { SOMISS: 1 });
        if (/^penalty-/.test(type)) kind = `shootout-${type.replace(/^penalty-/, "")}`;
      } else if (type === "own-goal") {
        // Its scorer's own goal; the other side's goal ("Own Goal by Pascal Groß, Brighton": Liverpool 1).
        const against = teamOf(first) ?? other(team);
        add(first, { OG: 1 });
        conceded(against);
        const to = other(against);
        if (to) score[to] = (score[to] ?? 0) + 1;
      } else if (/^goal\b/.test(type) || type === "penalty-scored") {
        const penalty = type === "penalty-scored";
        add(first, { G: 1, SHOT: 1, SOG: 1, ...(penalty ? { PKG: 1, PKA: 1 } : {}) });
        if (second && second !== first) add(second, { A: 1 });
        conceded(other(shooterSide));
        if (shooterSide) score[shooterSide] = (score[shooterSide] ?? 0) + 1;
        if (!first) issues?.push(`${id}: a goal with no scorer: ${text}`);
      } else if (type === "penalty-saved") {
        add(first, { SHOT: 1, SOG: 1, PKA: 1, PKM: 1 });
        add(saverOf(other(shooterSide)), { SV: 1, PKSV: 1 });
      } else if (type === "penalty-missed") add(first, { SHOT: 1, PKA: 1, PKM: 1 });
      else if (/^shot-/.test(type)) {
        // On target when it was saved, as its text says ("Attempt saved." on a play typed "Shot Blocked" is a save in ESPN's
        // lines); else by its type.
        const said = /^Attempt (saved|blocked|missed)\b/i.exec(text)?.[1]?.toLowerCase();
        if (said ? said === "saved" : type === "shot-on-target") {
          add(first, { SHOT: 1, SOG: 1 });
          const saver = saverOf(other(shooterSide));
          if (saver) add(saver, { SV: 1 });
          else issues?.push(`${id}: a save with no keeper: ${text}`);
        } else add(first, { SHOT: 1 });
      } else if (type === "handball") add(lookup(said(/^Handball by (.+?) \(/, /^Penalty conceded by (.+?) \(/), team) ?? first, { FC: 1 });
      else if (type === "foul") foul(true);
      else if (type === "offside") {
        // The one caught offside is the text's ("Offside, Aston Villa. Nicolas Jackson is caught offside."): its person played the
        // pass. A team's name can have a full stop in it ("St. Louis City SC").
        const name = /(?:^|\.\s+)([^.]+?) is caught offside/.exec(text)?.[1];
        const who = lookup(name, team);
        if (who) add(who, { OF: 1 });
        else issues?.push(`${id}: an offside with no one caught: ${text}`);
      } else if (type === "yellow-card") {
        add(first, { YC: 1 });
        if (first) booked.add(first);
      } else if (type === "red-card") {
        // A second yellow is a red, and the first yellow comes off (ESPN's line: RC 1, YC 0). The full commentary says which
        // ("Second yellow card to Cole Palmer", "is shown the red card"); a thinner one only "Red Card at 44'" (the DFB-Pokal's),
        // so there it's a second yellow when he's had one.
        const second = /second yellow/i.test(text) || (!/shown the red card/i.test(text) && !!first && booked.has(first));
        add(first, { RC: 1, ...(second ? { YC: -1 } : {}) });
        if (first) off(first, minute);
      } else if (type === "retired") {
        // Off injured with no substitutes left ("Loïc Badé went off injured after Bayer 04 Leverkusen had used all subs").
        if (first) off(first, minute);
      } else if (type === "substitution") {
        // Who comes on, then who goes off ("Rico Lewis replaces Marc Guéhi").
        const [into, out_] = [first, second];
        const t = teamOf(out_) ?? teamOf(into);
        const wasKeeper = !!(t && out_ && keeper.get(t) === out_);
        if (out_) off(out_, minute);
        if (into) {
          add(into, { APP: 1, SUB: 1 });
          on.set(into, minute);
          if (wasKeeper && t) keeper.set(t, into);
        }
      } else if (/^halftime/.test(type) || type === "start-shootout" || (/^end-/.test(type) && type !== "end-delay")) {
        // A period's end: everyone on has played to it.
        close(Math.min(period, 4));
      } else if (p.unplayed) foul(false);

      out.push({
        id,
        at: str(p.wallclock) ?? str(key?.wallclock),
        period,
        half: null,
        clock: shootout ? null : (str(p.clock?.displayValue) ?? null),
        text,
        kind,
        team,
        unit: null,
        people: [...new Set(people.filter(Boolean))],
        score: { ...score },
        deltas: cleanDeltas(deltas),
        ...(shootout ? { shootout: true } : {}),
      });
      if (people.some((x) => !x)) issues?.push(`${id}: someone in it isn't on either match sheet: ${text}`);
    }
    // A finished match whose last period no play ended (the thinner feed's never do): everyone on has played to its end, known
    // only at the final, so a play of the final's.
    if (isFinal(s)) {
      const deltas: Record<string, Stats> = {};
      closeInto(4, deltas);
      const last = out[out.length - 1];
      if (Object.keys(cleanDeltas(deltas)).length) out.push({ id: `${idOf(s.header?.id)}:end`, at: last?.at ?? null, period: Math.max(1, ...seen), half: null, clock: null, text: "Full time", kind: "end", team: null, unit: null, people: Object.keys(cleanDeltas(deltas)), score: { ...score }, deltas: cleanDeltas(deltas), final: true });
    }
    return inOrder(out);
  }
}
