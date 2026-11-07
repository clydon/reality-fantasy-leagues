import { Baseball, BASES, batterLines, HITS, plain, SUFFIX, type Outcome } from "./baseball";
import { addStats, cleanDeltas, headerTeams, idOf, inOrder, num, rosterOf, str, type Box, type EspnPlay, type EspnSummary, type Play, type Stats } from "./sport";

// College baseball (ESPN's "baseball/college-baseball"; docs/PLAN-start-a-game-gpt.md track L, L5 part 2c): Baseball's vocabulary
// on ESPN's college box and its two feeds. Every game ESPN lists has its score; a box and plays only where its scoreboard says
// `playByPlayAvailable` (its networks' games and the NCAA tournament's).
//
// How ESPN records a college game (checked on the 2026 season's, 2026-10-30; the evidence for each rule is in the plan's As
// built):
// - The box is the MLB's tables, but #P is 0 for every batter (the team's pitches seen too), some pitchers carry their position
//   in their name ("Hunter - P Elliott"), and a team's pitchCount, GIDPs, sacrifice flies and bunts are 0.
// - The NCAA tournament's plays are the MLB's shape (every pitch a play), read by Baseball's reader, but their types have no slug
//   (only "Strike Looking"), a runner's play-result lists no one on base after it and can say only "." (its words on its typed
//   twin), its scoreValue can say fewer runs than the text names, and its outs count one out at most.
// - The regular season's are the NCAA stat crew's: an at-bat a start and a result, the result's text the official scorer's
//   ("Rylen Stockt doubled to left field, RBI (2-0 BB); David Mendez scored."), read here (readCrew), its wallclocks a 12-hour
//   clock read as the morning (crewTimes).
// - College plays extra innings with no runner on second, and seven-inning games by the 10-run rule.

/** ESPN's type slug from its text, as the MLB's feed writes it: "Strike Looking - Overturned" is "strike-looking---overturned",
 *  "Start Batter/Pitcher" "start-batterpitcher". */
export const typeSlug = (text: unknown): string | null => {
  const t = str(text);
  return t ? t.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s/g, "-") : null;
};

/** A box name without the position ESPN puts in some ("Hunter - P Elliott" is Hunter Elliott). */
export const boxName = (name: string) => name.replace(/\s+-\s+[A-Z0-9]{1,3}\s+/, " ");

/* ---- The stat crew's play by play. ---- */

/** Where a clause's verb starts, after its subject's name (names are capitalized, the crew's verbs never). */
const CREW_VERB = /(?:^|\s)(?=(?:singled|doubled|tripled|homered|walked|intentionally walked|hit by pitch|struck out|grounded|flied|lined|popped|fouled|out\b|reached|sacrifice|bunted|stole|advanced|scored|picked off|caught stealing|infield fly|hit into|safe|failed|was\b|tagged|to (?:p|c|1b|2b|3b|ss|lf|cf|rf|dh)\b|pinch|pitching change|substitution|replaces|no play|no advance)\b)/;

/** A clause: who it's about (as the crew writes them) and what they did. */
export interface CrewClause {
  name: string;
  rest: string;
}

/** A result's text as clauses: the batter's first, each runner's after a semicolon ("Martin doubled to left field, RBI (2-0
 *  BB); Levu advanced to third; West scored."). */
export function crewClauses(text: string): CrewClause[] {
  return text
    .replace(/\s*\.\s*$/, "")
    .split(/;\s*/)
    .map((seg) => {
      const m = CREW_VERB.exec(seg);
      return m ? { name: seg.slice(0, m.index).trim(), rest: seg.slice(m.index).trim() } : { name: "", rest: seg.trim() };
    })
    .filter((c) => c.name || c.rest);
}

/**
 * How well the crew's name for someone fits their box name, 0 when it doesn't: the crew writes a first and last name cut to 12
 * characters ("Brayden Mart", "Nate Hawton-", "Paul Jones I"), the last name alone ("West"), last then first, whole or cut
 * ("Martin,Brayden", "Valincius, V", "Allen, He.", "Duplantier J", "TarpleyJr,Derrick"), or an initial and the last ("S.
 * Campbell"); apostrophes left out ("OShaughnessy"). Higher is surer.
 */
export function crewNameFit(text: string, box: string): number {
  const clean = (s: string) => plain(s).replace(/['’]/g, "");
  const t = clean(text).replace(/\.$/, "");
  const b = clean(box);
  if (!t || !b) return 0;
  if (t === b) return 6;
  const tight = (s: string) => s.replace(/[\s.-]/g, "");
  const words = b.split(" ");
  // Each way to split the name into given names and a last name (with or without its suffix): "kutter gage | webb".
  const splits: { given: string; last: string }[] = [];
  for (const list of [words, words.filter((w, i) => i === 0 || !SUFFIX.test(w))]) for (let k = 1; k < list.length; k++) splits.push({ given: tight(list.slice(0, k).join(" ")), last: tight(list.slice(k).join(" ")) });
  if (words.length === 1) splits.push({ given: "", last: tight(b) });
  // A last name as written, or cut short ("Rasmu" when its given name fits too; else 8 letters or more).
  const lastIs = (l: string, cut: number) => {
    const x = tight(l);
    return splits.filter((s) => !!x && (s.last === x || (x.length >= cut && s.last.startsWith(x))));
  };
  const givenFits = (f: string, s: { given: string }) => !!tight(f) && s.given.startsWith(tight(f));
  const lastFirst = (l: string, f: string) => (!f ? (lastIs(l, 8).length ? 2 : 0) : lastIs(l, 4).some((s) => givenFits(f, s)) ? 4 : 0);
  if (t.includes(",")) {
    // "Martin,Brayden", "Allen, He.", and once in a while the other way round ("M,ILGENFRITZ").
    const [l, f = ""] = t.split(",").map((x) => x.trim());
    return lastFirst(l, f) || (l.length <= 3 ? lastFirst(f, l) : 0);
  }
  if (t.includes(" ") && b.startsWith(t)) return 5;
  const spaced = /^(.+) ([a-z]{1,3})$/.exec(t);
  if (spaced && lastFirst(spaced[1], spaced[2])) return 4;
  const initial = /^([a-z][a-z.]{0,4}?)\.? (.+)$/.exec(t);
  if (initial && lastIs(initial[2], 8).some((s) => givenFits(initial[1], s))) return 3;
  return lastIs(t, 8).length ? 2 : 0;
}

/** A batter's outcome in the crew's words, as Baseball's reader names them. */
export function crewOutcome(rest: string): Outcome {
  const r = rest.toLowerCase();
  if (/^homered\b/.test(r)) return "home-run";
  if (/^tripled\b/.test(r)) return "triple";
  if (/^doubled\b(?! off)/.test(r)) return "double";
  if (/^singled\b/.test(r)) return "single";
  if (/^intentionally walked\b/.test(r)) return "intentional-walk";
  if (/^walked\b/.test(r)) return "walk";
  if (/^hit by pitch\b/.test(r)) return "hit-by-pitch";
  if (/^struck out\b/.test(r)) return "strikeout";
  if (/\bsacrifice fly\b|,\s*sf\b/.test(r)) return "sac-fly";
  if (/\bsacrifice bunt\b|,\s*sac\b/.test(r)) return "sac-bunt";
  if (/\bbatter'?s interference\b/.test(r)) return "out";
  // Catcher's interference puts him on, no at-bat; a batter's or a runner's ("popped up to 1b, interference") is an out.
  if (/\bcatcher'?s interference\b|^reached\b.*\binterference\b/.test(r)) return "interference";
  if (/into (?:a )?(?:double|triple) play\b/.test(r)) return "double-play";
  if (/fielder'?s choice/.test(r)) return "fielders-choice";
  if (/^reached\b.*\berror\b/.test(r)) return "error";
  return "out";
}

/** A clause that says its runner (or the batter, after his hit) was put out. */
const CREW_OUT = /\bout\b(?! of)|\bpicked off\b(?!, stole)|\bdoubled off\b|\bcaught stealing\b/i;
/** A runner's play, as its first clause says it. */
const CREW_RUNNER = /^(?:stole|advanced|scored|picked off|caught stealing|out at|out on|was\b|tagged|safe|failed|doubled off)/i;
/** A substitution's or a pitching change's words: no stats. */
const CREW_SUB = /^(?:to (?:p|c|1b|2b|3b|ss|lf|cf|rf|dh)\b|pinch (?:hit|ran)\b|pitching change\b|substitution\b|replaces\b|no play\b)/i;

/** A pitch sequence's pitches and strikes ("(3-2 KBSBFBS)": the letters are every pitch but a ball put in play or a hit batter,
 *  which the outcome adds; a signalled intentional walk throws none), or null when the result has none. */
export function crewPitches(text: string, outcome: Outcome | null): { pitches: number; strikes: number } | null {
  const m = /\((\d)-(\d)(?:\s+([A-Z]*))?\)/.exec(text);
  if (!m) return null;
  const letters = m[3] ?? "";
  const strikes = [...letters].filter((x) => x === "K" || x === "S" || x === "F").length;
  // The last pitch is in the letters for a strikeout or a walk (its strike three, its ball four); else it's the ball in play,
  // or the pitch that hit the batter.
  const inLetters = outcome === "strikeout" || outcome === "walk" || outcome === "intentional-walk";
  const last = inLetters || outcome == null ? 0 : 1;
  return { pitches: letters.length + last, strikes: strikes + (last && outcome !== "hit-by-pitch" ? 1 : 0) };
}

const HOUR = 3_600_000;

/**
 * The stat crew's wallclocks put right. They're its Eastern date and time on a 12-hour clock, read as the morning but for the
 * noon hour: a 7 PM game's plays are stamped 12 hours early (whatever the venue's zone: California's 24 games and Oregon's 7 as
 * Alabama's), and a game crossing noon steps back 12 hours at 1 PM ("16:04Z" for its first pitch, "06:35Z" for its last). So each
 * play is its stamp, or 12 hours more (or, past midnight, when "12:15" is read as noon on the new date, 12 hours less): the first
 * the one nearest the scheduled `start` (the header's), each after it the earliest not before the play before it (an hour's
 * slack: ESPN restamps), never between 2 and 9 in the morning Eastern (a game suspended at night resumes the next afternoon).
 * Only an at-bat's start and its results set the clock (an "End Inning" can be filed with the next day's time, or before the
 * half's last at-bat): any other row is at the clock's time. ESPN's postseason feed is right (within the hour of the start in
 * 127 of 130 games) and isn't read here.
 */
export function crewTimes(plays: EspnPlay[], start: string | undefined): (string | null)[] {
  const begins = Date.parse(start ?? "");
  const stamps = plays.map((p) => Date.parse(p.wallclock ?? ""));
  // Eastern's hour, near enough (EST and EDT apart by one): a stamp read as between 2 and 9 in the morning isn't a game's.
  const night = (t: number) => {
    const h = (((t - 4.5 * HOUR) % (24 * HOUR)) + 24 * HOUR) % (24 * HOUR);
    return h >= 1.5 * HOUR && h < 8.5 * HOUR;
  };
  let last: number | null = null;
  return plays.map((p, i) => {
    const t = stamps[i];
    if (!Number.isFinite(t)) return null;
    const ways = [t - 12 * HOUR, t, t + 12 * HOUR].filter((c) => !night(c));
    let pick: number;
    if (last == null) {
      const near = Number.isFinite(begins) ? ways.filter((c) => c !== t - 12 * HOUR) : [];
      pick = near.length ? near.reduce((a, b) => (Math.abs(b - begins) < Math.abs(a - begins) ? b : a)) : t;
    } else pick = ways.find((c) => c >= last! - HOUR) ?? ways[ways.length - 1] ?? t;
    // A row that doesn't set the clock is at the clock's time: an "End Inning" filed before the half's last at-bat, with the
    // inning's end, would otherwise hold that at-bat back in a replay.
    const sets = ["A", "N", "S", "C"].includes(str(p.summaryType) ?? "") || last == null;
    if (sets) last = pick;
    return new Date(sets ? pick : last!).toISOString().replace(".000Z", "Z");
  });
}

/** The stat crew's feed has no pitches of its own: each at-bat is a start and a result. */
const crewFeed = (summary: EspnSummary) => !(summary.plays ?? []).some((p) => p.summaryType === "P");

export class CollegeBaseball extends Baseball {
  readonly name = "College baseball";
  readonly leagues = ["college-baseball"];
  protected readonly runnerOnSecond = false;
  protected readonly namedRunsStand = true;
  protected readonly basesFromText = true;

  /** ESPN's college outs on a play-result count one out at most (a double play's says one), so they settle only an out the
   *  text doesn't say (more than it read). */
  protected outsSaid(p: EspnPlay, before: number, read: number): number | null {
    const said = num(p.outs);
    return said != null && said > before + read ? said : null;
  }

  /** ESPN's college box as the MLB's reader reads it: names without a position. */
  private normalizeBox(summary: EspnSummary): EspnSummary {
    const players = summary.boxscore?.players?.map((side) => ({
      ...side,
      statistics: side.statistics?.map((t) => ({ ...t, athletes: t.athletes?.map((a) => (a.athlete?.displayName ? { ...a, athlete: { ...a.athlete, displayName: boxName(a.athlete.displayName) } } : a)) })),
    }));
    return summary.boxscore ? { ...summary, boxscore: { ...summary.boxscore, players } } : summary;
  }

  /** ESPN's college summary as the MLB's reader reads it: its box's names, and each play's type slug from its text. */
  private normalize(summary: EspnSummary): EspnSummary {
    const raw = summary.plays ?? [];
    const plays = raw.map((p, i) => {
      let q = p;
      // College's intentional walk is signalled, not pitched: three "Automatic Ball"s and an "Intentional Ball", none in its
      // pitcher's count.
      if (q.type && !q.type.type && q.type.text) q = { ...q, type: { ...q.type, type: /^intentional ball$/i.test(q.type.text) ? "automatic-ball" : (typeSlug(q.type.text) ?? undefined) } };
      // A play-result whose text is only "." has its words on its typed twin (the wild pitch it follows: same at-bat and pitch,
      // the nearest before or after, as near as Baseball's reader looks for twins).
      if (["N", "S"].includes(str(q.summaryType) ?? "") && !/\w/.test(str(q.text) ?? "")) {
        const near = [...raw.slice(Math.max(0, i - 8), i).reverse(), ...raw.slice(i + 1, i + 9)];
        const twin = near.find((x) => !x.summaryType && x.atBatId === q.atBatId && x.atBatPitchNumber === q.atBatPitchNumber && /\w/.test(str(x.text) ?? ""));
        if (twin) q = { ...q, text: twin.text };
      }
      return q;
    });
    return { ...this.normalizeBox(summary), plays };
  }

  readBox(summary: EspnSummary): Box | null {
    const box = super.readBox(this.normalizeBox(summary));
    if (!box) return null;
    // Pitches seen are 0 in a college box (#P, the team's too), and a team's GIDPs, sacrifice flies and bunts always 0: said
    // by nobody, so the plays' own stand. A team's pitches thrown are its "pitches" (its "pitchCount" is 0).
    for (const person of Object.values(box.people)) delete person.stats.NP;
    for (const t of box.teams) {
      for (const k of ["NP", "GIDP", "SF", "SH"]) delete t.stats[k];
      const side = summary.boxscore?.teams?.find((x) => idOf(x.team?.id) === t.id);
      const pitches = side?.statistics?.find((g) => g.name === "pitching")?.stats?.find((x) => x.name === "pitches");
      const v = typeof pitches?.value === "number" ? pitches.value : num(pitches?.displayValue);
      if (v != null) t.stats.PC = v;
      else delete t.stats.PC;
    }
    return box;
  }

  readPlays(summary: EspnSummary, issues?: string[]): Play[] {
    const s = this.normalize(summary);
    return crewFeed(s) ? this.readCrew(s, issues) : super.readPlays(s, issues);
  }

  /** The stat crew's put right (crewTimes); the postseason feed's are its own. */
  playTimes(summary: EspnSummary): (string | null)[] {
    return crewFeed(summary) ? crewTimes(summary.plays ?? [], summary.header?.competitions?.[0]?.date) : super.playTimes(summary);
  }

  /**
   * The stat crew's play by play: each at-bat a start (its pitcher and batter, who's on and the outs before it) and a result
   * whose text is the official scorer's ("Rylen Stockt doubled to left field, RBI (2-0 BB); David Mendez scored."), with any
   * runner's play in the middle of it a result of its own (a steal, a wild pitch), each listing who's on and the outs before
   * it. So the bases come from ESPN, and the text says the rest: the batter's outcome, the RBIs ("RBI", "3 RBI"), the pitches (a
   * letter each), each runner's steal, out or run, and whether a run was unearned.
   */
  private readCrew(summary: EspnSummary, issues?: string[]): Play[] {
    const raw = summary.plays ?? [];
    const teams = headerTeams(summary);
    const away = teams.find((t) => t.home === false)?.id ?? teams[0]?.id ?? "";
    const home = teams.find((t) => t.home === true)?.id ?? teams[1]?.id ?? "";
    const teamOf = rosterOf(summary);
    const names = new Map<string, string>();
    const pitchers = new Set<string>();
    for (const side of summary.boxscore?.players ?? []) {
      for (const table of side.statistics ?? []) {
        for (const row of table.athletes ?? []) {
          const id = idOf(row.athlete?.id);
          if (!id) continue;
          names.set(id, str(row.athlete?.displayName) ?? "");
          if ((str(table.type) ?? str(table.name)) === "pitching") pitchers.add(id);
        }
      }
    }
    // ESPN's plays can name someone by an id their box line hasn't ("Z. Adams pitches to C. James": neither id in the box):
    // each is the one on their side the at-bat's start names, learned once; by the last name alone when only one there has it
    // (ESPN's box has Alabama's starter as Tyler Adams, its plays as Z. Adams, in two games).
    const alias = new Map<string, string>();
    const learn = (id: string | null, name: string | undefined, team: string, pool: (id: string) => boolean) => {
      if (!id || names.has(id) || alias.has(id) || !name) return;
      const side = [...teamOf].filter(([x, t]) => t === team && pool(x)).map(([x]) => x);
      let best: string | null = null;
      let fit = 0;
      for (const x of side) {
        const f = crewNameFit(name, names.get(x) ?? "");
        if (f > fit) [best, fit] = [x, f];
      }
      const last = name.split(/\s+/).pop() ?? "";
      const byLast = side.filter((x) => crewNameFit(last, names.get(x) ?? "") > 0);
      if (!best && byLast.length === 1) best = byLast[0];
      if (best) alias.set(id, best);
    };
    const out: Play[] = [];
    const score: Record<string, number> = { [away]: 0, [home]: 0 };
    const started = new Set<string>();
    const pitcherOf = new Map<string, string>();
    // Who's charged if a runner scores: the pitcher who put them on.
    const charged = new Map<string, string | null>();
    // Who was on each base at the last play that listed them: a new face where someone was who didn't score and wasn't put out is
    // his pinch runner, charged to the same pitcher (the box can leave a pinch runner out: then by ESPN's id).
    let lastOn: (string | null)[] = [null, null, null];
    // A pinch runner the box hasn't (by name): the runner he ran for, whose pitcher the next new face on base takes.
    const pinched: string[] = [];
    const settle = (p: EspnPlay, pitcher: string | null) => {
      const now = BASES.map((b) => role(p, b));
      now.forEach((x, b) => {
        if (!x || charged.has(x)) return;
        const was = lastOn[b];
        const k = pinched.findIndex((old) => !now.includes(old));
        const from = was && !now.includes(was) && charged.has(was) ? was : k >= 0 ? pinched.splice(k, 1)[0] : null;
        charged.set(x, from ? (charged.get(from) ?? pitcher) : pitcher);
        if (from) charged.delete(from);
      });
      lastOn = now;
    };
    let half: "top" | "bottom" = "top";
    let period = 1;
    const batting = () => (half === "top" ? away : home);
    const fielding = () => (half === "top" ? home : away);
    const espnRole = (p: EspnPlay, r: string) => idOf(p.participants?.find((x) => x.type === r)?.athlete?.id) || null;
    const role = (p: EspnPlay, r: string) => {
      const id = espnRole(p, r);
      return id ? (alias.get(id) ?? id) : null;
    };
    const onBase = (p: EspnPlay) => BASES.map((b) => role(p, b)).filter((x): x is string => !!x && names.has(x));
    /** Who a clause's name is: the best fit among `first` (the batter, who's on), else the batting side. */
    const who = (name: string, first: string[]): string | null => {
      for (const pool of [first, [...teamOf.keys()].filter((id) => teamOf.get(id) === batting())]) {
        let best: string | null = null;
        let fit = 0;
        for (const id of pool) {
          const f = crewNameFit(name, names.get(id) ?? "");
          if (f > fit) [best, fit] = [id, f];
        }
        if (best) return best;
      }
      return null;
    };
    // The outs ESPN says a play leaves: the outs before the next play in the same half that lists its pitcher (a substitution
    // or a pitching change lists nobody, and 0 outs), or three when the next is another half's (an "End Inning" can come before
    // the half's last at-bat); null at the end of what's known.
    const halfOf = (p: EspnPlay) => `${str(p.period?.type)}:${num(p.period?.number)}`;
    const outsAfter = (i: number): number | null => {
      const h = halfOf(raw[i]);
      for (let j = i + 1; j < raw.length; j++) {
        const q = raw[j];
        if (!["A", "N", "S"].includes(str(q.summaryType) ?? "") || !role(q, "pitcher")) continue;
        return halfOf(q) === h ? num(q.outs) : 3;
      }
      return null;
    };
    const times = crewTimes(raw, summary.header?.competitions?.[0]?.date);
    const emit = (p: EspnPlay, i: number, kind: string, deltas: Record<string, Stats>, team: string | null, people?: string[]) =>
      out.push({
        id: kind === "outs" ? `${idOf(p.id) || i}:outs` : idOf(p.id) || `${i}`,
        at: times[i],
        period,
        half,
        clock: null,
        text: kind === "outs" ? "" : (str(p.text) ?? ""),
        kind,
        team,
        unit: kind === "outs" ? null : str(p.atBatId),
        people: people ?? [...new Set((p.participants ?? []).map((x) => idOf(x.athlete?.id)).filter(Boolean).map((id) => alias.get(id) ?? id))],
        score: { ...score },
        deltas: cleanDeltas(deltas),
      });
    const add = (deltas: Record<string, Stats>, id: string | null, d: Stats) => {
      if (id) deltas[id] = addStats(deltas[id] ?? {}, d);
    };

    // The half's outs as read: never more than three, and a half the game went on from ends on three (the pitcher on the mound
    // gets any the text didn't say, as Baseball's reader does).
    let outs = 0;
    // The half each play is in, by its own inning and half (a half can come without its "Start Inning" row).
    let inHalf: string | null = null;
    for (let i = 0; i < raw.length; i++) {
      const p = raw[i];
      const type = str(p.type?.text) ?? "";
      const st = str(p.summaryType);
      const halfName = str(p.period?.type);
      if (halfName === "Top" || halfName === "Bottom") {
        const key = `${halfName}:${num(p.period?.number) ?? period}`;
        if (key !== inHalf) {
          // A new half: the one before it ended on three outs, the pitcher on the mound getting any the text didn't say.
          if (inHalf && outs < 3) {
            const by = pitcherOf.get(fielding()) ?? null;
            issues?.push(`${idOf(p.id)}: ${3 - outs} out(s) not read before: ${str(p.text) ?? ""}`);
            if (by) emit(p, i, "outs", { [by]: { OUTS: 3 - outs } }, fielding(), [by]);
          }
          inHalf = key;
          outs = 0;
          charged.clear();
          pinched.length = 0;
          lastOn = [null, null, null];
        }
        half = halfName === "Bottom" ? "bottom" : "top";
        period = num(p.period?.number) ?? period;
      }
      if (type === "Start Inning") {
        emit(p, i, "inning", {}, batting());
        continue;
      }
      if (type === "End Inning" || type === "End Batter/Pitcher") continue;
      if (st === "A") {
        const named = /^(.+?) pitches to (.+?)\.?$/.exec(str(p.text) ?? "");
        learn(espnRole(p, "pitcher"), named?.[1], fielding(), (x) => pitchers.has(x));
        learn(espnRole(p, "batter"), named?.[2], batting(), () => true);
      }
      const pitcher = role(p, "pitcher") ?? pitcherOf.get(fielding()) ?? null;
      if (st === "A") {
        const deltas: Record<string, Stats> = {};
        if (pitcher) {
          pitcherOf.set(fielding(), pitcher);
          if (!started.has(fielding())) {
            started.add(fielding());
            add(deltas, pitcher, { GS: 1 });
          }
        }
        settle(p, pitcher);
        emit(p, i, "at-bat", deltas, batting());
        continue;
      }
      if (!st || !["N", "S", "C"].includes(st)) continue;
      const text = str(p.text) ?? "";
      const clauses = crewClauses(text);
      const on = onBase(p);
      const listed = role(p, "batter");
      const batterIn = listed && names.has(listed) ? listed : null;

      // Substitutions and pitching changes ("Moss to p for Barnett.", "Williamson pinch ran for Plattner."): a pinch runner
      // takes over his runner's pitcher.
      if (st === "C" || !clauses.length || CREW_SUB.test(clauses[0].rest)) {
        const ran = /^pinch ran for (.+)$/i.exec(clauses[0]?.rest ?? "") ?? /\bsubstitution: (.+?) pinch running for (.+?)\.?$/i.exec(text);
        if (ran) {
          const forName = ran.length > 2 ? ran[2] : ran[1];
          const runner = ran.length > 2 ? ran[1] : clauses[0].name;
          const old = who(forName.replace(/\.$/, ""), on);
          const now = who(runner, [...teamOf.keys()].filter((id) => teamOf.get(id) === batting() && !on.includes(id)));
          if (old && now) {
            charged.set(now, charged.get(old) ?? pitcher);
            charged.delete(old);
          } else if (old) pinched.push(old);
        }
        emit(p, i, st === "C" ? "pitching-change" : "substitution", {}, st === "C" ? fielding() : batting());
        continue;
      }
      // What the crew notes as a result ("UK mound visit.", "First pitch delayed due to weather.", "After review, the call of out
      // at home plate was confirmed.", "Oregon is challenging the out call at 2nd"): nothing happens (every review seen stood; one
      // overturned is noted, its change left to the next play's bases and the final).
      // A name is a few words, no figures: "First Pitch 5:32pm... 79 deg, clear, wind out to RC" is the weather.
      const named = !!clauses[0].name && clauses[0].name.split(/\s+/).length <= 4 && !/\d/.test(clauses[0].name);
      if ((!named && !/\b(?:scored|out)\b/i.test(text)) || /\breview\b|\bchalleng/i.test(text) || (!named && /^first pitch\b/i.test(text))) {
        if (/\boverturned\b|\breversed\b/i.test(text)) issues?.push(`${idOf(p.id)}: a call overturned: ${text}`);
        emit(p, i, "note", {}, batting());
        continue;
      }
      if (pitcher) pitcherOf.set(fielding(), pitcher);
      settle(p, pitcher);

      // The batter's result (his clause has the pitches, "(2-0 BB)", or a batter's verb), or a runner's play in the middle of
      // the at-bat ("Lebron stole second.", "Souza out at first p to 1b, picked off."). The batter is the one ESPN lists, however
      // the crew spells him ("Stanford" for Cole Standford).
      const c0 = clauses[0];
      const fit = (id: string) => crewNameFit(c0.name, names.get(id) ?? "");
      const runnerPlay = !/\(\d-\d/.test(c0.rest) && (CREW_RUNNER.test(c0.rest) || Math.max(0, ...on.map(fit)) > (batterIn ? fit(batterIn) : 0));
      // Someone ESPN's box leaves out (a pinch hitter it never lists) still bats: his result is the pitcher's too.
      const batter = runnerPlay ? null : (batterIn ?? who(c0.name, [...teamOf.keys()].filter((id) => teamOf.get(id) === batting() && !on.includes(id))) ?? listed);
      const deltas: Record<string, Stats> = {};
      const mine = batter ? clauses[0] : null;
      const outcome = mine ? crewOutcome(mine.rest) : null;
      let made = 0;
      const scored: { id: string | null; unearned: boolean; by: string | null }[] = [];

      if (batter && mine && outcome) {
        const { batter: b, pitcher: pl } = batterLines(outcome);
        if (outcome === "double-play" && /^grounded into\b/i.test(mine.rest)) b.GIDP = 1;
        const rbi = /\b(\d) ?RBI\b/.exec(mine.rest);
        b.RBI = rbi ? Number(rbi[1]) : /\bRBI\b/.test(mine.rest) ? 1 : 0;
        const pitches = crewPitches(mine.rest, outcome);
        if (pitches) {
          b.NP = pitches.pitches;
          pl.PC = pitches.pitches;
          pl.PST = pitches.strikes;
        }
        add(deltas, batter, b);
        add(deltas, pitcher, pl);
        // Out unless he reached: a hit, a walk, hit by a pitch, an error, a fielder's choice, interference, or a third strike he
        // reached first on; or put out after it ("doubled to left center, out at third cf to ss to 3b", "reached on a fielder's
        // choice, grounded out to ss unassisted").
        const after = mine.rest.replace(/\([^)]*\)/g, "");
        // A sacrifice he was safe on ("sacrifice bunt, error throwing by 3b", "advanced to first base on a fielder's choice").
        const reached = outcome in HITS || ["walk", "intentional-walk", "hit-by-pitch", "error", "fielders-choice", "interference"].includes(outcome) || /\breached\b|\b(?:advanced to|safe at) first\b|\bfielder'?s choice\b/i.test(after) || (outcome === "sac-bunt" && /\berror\b/i.test(after));
        const putOut = reached ? /,\s*(?:\w+ )?out\b/i.test(after) : true;
        if (outcome === "home-run" || /\bscored\b/i.test(after)) scored.push({ id: batter, unearned: /\bunearned\b/i.test(after), by: pitcher });
        else if (putOut) made++;
        else charged.set(batter, pitcher);
      }

      // The runners: each clause after the batter's (or every clause of a runner's play).
      // The first runner put out, and the pitcher charged with him: a batter safe on a fielder's choice takes him (the rules'
      // 9.16(g)).
      let forced: { pitcher: string | null } | null = null;
      // A runner ESPN's box leaves out (a pinch runner it never lists) is the one on base it has no line for, when there's one; a
      // run's still a run, and an out an out, whoever it is.
      const unlisted = BASES.map((b) => role(p, b)).filter((x): x is string => !!x && !names.has(x));
      for (const c of mine ? clauses.slice(1) : clauses) {
        const id = who(c.name, on) ?? (unlisted.length === 1 ? unlisted[0] : null);
        if (!id) issues?.push(`${idOf(p.id)}: no one on for "${c.name}": ${text}`);
        if (!id && !c.name) continue;
        if (/\bstole (?:second|third|home|2nd|3rd)\b/i.test(c.rest)) add(deltas, id, { SB: 1 });
        if (/\bcaught stealing\b/i.test(c.rest)) add(deltas, id, { CS: 1 });
        if (/\bscored\b|\bstole home\b/i.test(c.rest)) scored.push({ id, unearned: /\bunearned\b/i.test(c.rest), by: (id && charged.get(id)) || pitcher });
        else if (CREW_OUT.test(c.rest)) {
          made++;
          if (id) {
            forced ??= { pitcher: charged.get(id) ?? null };
            charged.delete(id);
          }
        }
      }
      if (batter && outcome === "fielders-choice" && charged.has(batter)) charged.set(batter, forced?.pitcher ?? pitcher);

      for (const r of scored) {
        add(deltas, r.id, { R: 1 });
        add(deltas, r.by ?? pitcher, { PR: 1, ER: r.unearned ? 0 : 1 });
        score[batting()] = (score[batting()] ?? 0) + 1;
        if (r.id) charged.delete(r.id);
      }
      // The text's outs stand; ESPN's (each play lists the outs before it) only check them, since they lag the text now and then
      // (a sacrifice's out missing from the next start).
      const before = num(p.outs) ?? 0;
      const said = outsAfter(i);
      if (said != null && said - before !== made) {
        issues?.push(`${idOf(p.id)}: read ${made} out(s), ESPN says ${said - before}: ${text}`);
      }
      made = Math.min(made, 3 - outs);
      outs += made;
      add(deltas, pitcher, { OUTS: made });
      const sayScore = { [away]: num(p.awayScore), [home]: num(p.homeScore) };
      if (scored.length && sayScore[batting()] != null && sayScore[batting()] !== score[batting()]) issues?.push(`${idOf(p.id)}: the score read ${score[batting()]}, ESPN says ${sayScore[batting()]}: ${text}`);
      emit(p, i, batter && outcome ? outcome : "runners", deltas, batting());
    }
    return inOrder(out);
  }
}
