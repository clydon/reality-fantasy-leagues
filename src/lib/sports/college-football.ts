import { Football, FOOTBALL_STATS, BOX_TABLES, TEAM_TOTALS, SUMMARY, bandOf, defenseId, drivePlays, gainOf, letters, playNames, plain, readDrives, sidesOf, SUFFIX, type DriveContext, type SummaryContext } from "./football";
import { count, headerTeams, idOf, num, rosterOf, str, type EspnPlay, type EspnSummary, type Play, type StatDef, type Stats } from "./sport";

// College football (ESPN's "football/college-football": the FBS and the FCS): Football's vocabulary and box reader, with its
// own play grammar.
//
// How ESPN records a college game (checked on the 2026 season's weeks 6-8, 176 FBS games, 2026-10-30): its plays sit in drives
// as the NFL's do, typed alike ("Rush", "Pass Reception", "Sack", "Punt"), with their clock, the score after them and who had
// the ball where (`start.yardLine` from the home side's goal line), and no people: who did what is only in the text, the stat
// crew's own, one run-on sentence with jersey numbers ("(15:00) #12 K.Russell pass complete short right to #40 J.Ford caught at
// ALA40, for 16 yards to the ALA41 (#7 D.Brooks), 1ST DOWN", "#10 M.Reed sacked for loss of 10 yards to the TAM16 (#14 F.Henry)",
// "pass incomplete ... thrown to TAM47 QB hurried by #3 M.Ratcliffe and #10 M.Jones"). A spot is a side's code and its yard line
// run together or not ("ALA40", "IU 34", "U-M25", "UMass45"); the codes are the home crew's, not ESPN's, so each game's are
// learned from ESPN's own yard lines (`end.yardLine` after "to the ALA43"). A name is a jersey and an initial and last name,
// matched on the side the sentence says by both. A reviewed play says what stood, then the review, then "(Original Play: ...)":
// only what stood is read.
//
// What college counts otherwise (the NCAA's rules, as ESPN's box shows them; each one's evidence is in the plan's L5 part 2b
// As built): a sack is the quarterback's rush for its loss (so passing yards are net already: no sacks taken in the passing
// table, and a team's rushing yards are less its sacks'), and so is intentional grounding; a kneel-down and a spike are the
// team's (a "Team" line, ESPN's negative id); a fumble recovered counts only on the other side's; a muffed punt is the muffer's
// fumble and return; a blocked punt is the team's; a return touchdown is a defensive one too; hurries, not hits ("QB HUR"); no
// targets in the box. Overtime is untimed: each side's possession from the other's 25, two-point tries from the 2nd, then tries
// alone. A two-point try's text names one person, not his role ("#2 T.Hornes pass attempt Successful"), so it's read from the
// summary's scoring plays ("Keyone Jenkins Pass to Tyren Hornes for Two-Point Conversion"). Where the crew's text is missing,
// ESPN writes its own phrases (readPhrases) or a scoring summary (Football's readSummary).

const DEFENSE = "defense";

// Football's vocabulary, but hurries for hits (college's box has hurries) and no sack yards (they're rushing yards).
const STATS: StatDef[] = [
  ...FOOTBALL_STATS.filter((s) => s.key !== "QBH" && s.key !== "SACKYDS").map((s) => (s.key === "SACKED" ? { ...s, label: "Times sacked", noun: "sack taken (a rush for its loss)" } : s.key === "NPYDS" ? { ...s, of: (x: Stats) => x.PYDS ?? 0 } : s)),
  { ...count("HUR", "QB hurries", "QB HUR", "QB hurry", DEFENSE), judged: true },
];

const BOX: Record<string, Record<string, string | [string, string]>> = {
  ...BOX_TABLES,
  passing: { "C/ATT": ["CMP", "PATT"], YDS: "PYDS", TD: "PTD", INT: "INT" },
  receiving: { REC: "REC", YDS: "RECYDS", TD: "RECTD" },
  defensive: { TOT: "TCK", SOLO: "SOLO", SACKS: "SACK", TFL: "TFL", PD: "PD", "QB HUR": "HUR", TD: "DTD" },
};
const TEAM: Record<string, string | [string, string]> = Object.fromEntries(Object.entries(TEAM_TOTALS).filter(([k]) => k !== "sacksYardsLost"));

/** A gain's kinds, as the NFL reader's. */
type GainKind = "rush" | "catch" | "lateral" | "kick-return" | "punt-return" | "int-return" | "fumble-return" | "blocked-return" | "none";
const RETURNS = new Set<GainKind>(["kick-return", "punt-return", "int-return", "fumble-return", "blocked-return"]);

interface Carrier {
  id: string | null;
  team: string | null;
  kind: GainKind;
  /** A loose ball's: the side that lost it. */
  lost?: string | null;
}

/** A person in a play's text: their jersey and name as written. */
interface Named {
  jersey: string;
  name: string;
}

interface Ctx extends DriveContext {
  p: EspnPlay;
  /** Who a name is, on a side (else the other): { id, team }. */
  who: (n: Named | undefined, team: string | null) => { id: string; team: string } | null;
  /** A side's code in the text ("TAM"), to its id. */
  codeOf: (code: string | undefined) => string | null;
  /** A spot's code and yard line to yards from the home side's goal line. */
  xOf: (code: string, n: number) => number | null;
  gained: (team: string, from: number, to: number) => number;
  /** A side's own line (a kneel-down's, ESPN's "Team"). */
  teamLine: (team: string | null) => string | null;
  /** A side's punter: the one in its box's punting table. */
  punterOf: (team: string | null) => string | null;
  /** A scoring play's summary, by its id ("... (Keyone Jenkins Pass to Tyren Hornes for Two-Point Conversion)"). */
  scoring: Map<string, string>;
  full: Map<string, string>;
  /** Everyone in the box score, by id, to their side. */
  teamOf: Map<string, string>;
}

/** A name in the text: "#12 K.Russell", "#5 D.Lee Jr.", "#19 C.McDonald III", "#8 I.Smith Flores", "#45 V.Po'uha". */
const NAME = /#(\d{1,2}) ((?:[A-Z][A-Za-z]{0,3}\. ?){0,2}(?:St\. ?|(?:de|la|del|van|von|da|di|le|du|der|den) )?[A-ZÀ-Þ][A-Za-zÀ-ÿ'’-]*(?: (?:(?:de|la|del|van|von|da|di|le|St\.?) )*[A-ZÀ-Þ][a-zà-ÿ][A-Za-zÀ-ÿ'’.-]*)*(?: (?:Jr\.?|Sr\.?|II|III|IV|V)(?![A-Za-z]))?)/g;
/** A spot after "to the", "at", "to" or "from": a side's code and its yard line ("ALA40", "IU 34", "U-M00", "Sac St45"). */
/** Who threw a play's pass: its first name before " pass" ("#12 K.Russell pass complete"). */
const PASSER = new RegExp(`^(?:[A-Za-z -]+ )?${NAME.source} pass `);
const SPOT = /(?<=\b(?:the|at|to|from) )([A-Z][A-Za-z&'.-]{0,9}?(?: [A-Z][A-Za-z&'.-]{0,5}?)?) ?(\d{1,2})\b(?![:\d])/g;

// The play reader's patterns, on a text whose names are "@n" and spots "$n" (readCollege), compiled once: sticky, each tried
// where the scan is.
/** A side's code as a penalty or a recovery names it ("UTK", "Sac St", "NC St."). */
const CODE = "[A-Za-z&'.-]+(?: (?:St|ST|State)\\.?)?";
const P = "@(\\d+)";
const S = "\\$(\\d+)";
const TEAM_WORD = "[A-Z][A-Za-z.&']*(?: [A-Z][A-Za-z.&']*)*";
const sticky = (src: string, flags = "") => new RegExp(src, `y${flags}`);
const RX = {
  // "for 17 yards gain (16)": the yards to a foul's spot, which can be less than none ("gain (-10)").
  rush: sticky(`(?:${P}|(${TEAM_WORD})) rush(?: [a-z]+)? for (\\d+) yards?(?: (gain|loss))?(?: \\((-?\\d+)\\))? to the ${S}`),
  kneel: sticky(`Kneel down by (?:${P}|[^@$]+?) at ${S} for (?:loss of )?(\\d+) yards?`),
  catch: sticky(`${P} pass complete(?: [a-z]+)*? to ${P}(?: caught at ${S},)? for (\\d+) yards?(?: (loss|gain))?(?: \\((-?\\d+)\\))? to the ${S}`),
  incomplete: sticky(`${P} pass incomplete(?: (?:short|deep)(?: (?:left|right|middle))?)?(?:,? to ${P})?(?: thrown to ${S})?(, Spike)?`),
  intercepted: sticky(`${P} pass intercepted(?: [a-z]+)*? by ${P} at ${S}`),
  sacked: sticky(`${P} sacked for (?:loss of )?(\\d+) yards?(?: loss)? to the ${S}`),
  kickoff: sticky(`${P} (onside )?kickoff (\\d+) yards? to the ${S}`),
  punt: sticky(`(?:${P} )?punt (\\d+) yards? to the ${S}`),
  fieldGoal: sticky(`${P} field goal attempt from (\\d+) yards? (GOOD|NO GOOD)`),
  teamSafety: /Team Safety/y,
  ret: sticky(`(?:${P}|${TEAM_WORD}) return (?:for (?:loss of )?)?(\\d+) yards?(?: (loss|gain))? to the ${S}`),
  fairCatch: sticky(`fair catch by ${P} at ${S}`),
  touchback: /Touchback/y,
  outOfBounds: sticky(`out of bounds at ${S}`),
  fumble: sticky(`(?:fumbled by (?:${P}|${TEAM_WORD}) at ${S}|, fumble by ${P})(?: forced by ${P})?(?: \\(([^)]*)\\))?(?: recovered by (${CODE}) ${P} at ${S})?`),
  muff: sticky(`muffed by ${P} at ${S}(?: recovered by (${CODE}) ${P} at ${S})?`),
  blocked: sticky(`blocked by ${P}`),
  recovered: sticky(`recovered by (${CODE}) ${P} at ${S}`),
  lateral: sticky(`lateral to ${P} for (\\d+) yards?(?: (loss|gain))? to the ${S}`),
  holder: /\(H: [^)]*\)/y,
  kickBlocked: /\(\s*blocked by @(\d+)\)/y,
  tacklers: /\(((?:@\d+)(?:[;,] ?@\d+)*)\)/y,
  nullified: /TOUCHDOWN nullified by penalty/y,
  touchdown: /TOUCHDOWN/y,
  safety: sticky(`(?:${TEAM_WORD} )?SAFETY`),
  hurried: sticky(`(?:QB )?hurried by ${P}((?: and ${P})*)`),
  brokenUp: sticky(`broken up by ${P}`),
  kickTry: sticky(`${P} kick attempt (good|failed|no good|blocked)`, "i"),
  twoPoint: sticky(`${P} (pass|rush) attempt (Successful|failed)`, "i"),
  defensivePat: sticky(`${P} defensive PAT Successful`, "i"),
  penalty: /PENALTY /y,
  foul: sticky(`(${CODE}) [^@$]*?(?:\\(@\\d+\\) ?)?(?:(-?\\d+) yards? from ${S} to ${S}|-?\\d+ yards?, assessed on the kickoff|declined|offsetting|(?=[.,]|$))`),
  // Words that say nothing to count.
  filler: /(?:No Huddle-Shotgun|No Huddle-Pistol|No Huddle|Shotgun|Pistol|Wildcat|1ST DOWN|End Of Play|TURNOVER ON DOWNS|out of bounds|clock \d+:\d+|Timeout [^,]*|End of [^.]*|[,.;]|\s+)/y,
  word: /\S+\s*/y,
};

export class CollegeFootball extends Football {
  readonly name = "College football";
  readonly stats = STATS;
  readonly leagues: string[] = ["college-football"];
  protected readonly boxTables = BOX;
  protected readonly teamTotals = TEAM;

  /** College's overtime is untimed: "overtime", "2nd overtime", never its clock. */
  where(play: Pick<Play, "period" | "half" | "clock" | "shootout">): string {
    return super.where(play.period > this.periods.regulation ? { ...play, clock: null } : play);
  }

  readPlays(summary: EspnSummary, issues?: string[]): Play[] {
    const teams = headerTeams(summary);
    const { home, away, other } = sidesOf(teams);

    // Everyone in the box score, per side: their jersey, the play-by-play's keys for their name ("k.russell"), and the side's own
    // line ("Team").
    const people = new Map<string, { id: string; jersey: string; keys: Set<string>; last: string }[]>();
    const team = new Map<string, string>();
    const full = new Map<string, string>();
    for (const side of summary.boxscore?.players ?? []) {
      const t = idOf(side.team?.id);
      const list = people.get(t) ?? [];
      people.set(t, list);
      for (const table of side.statistics ?? []) {
        for (const row of table.athletes ?? []) {
          const a = row.athlete as { id?: string | number; displayName?: string; jersey?: string; lastName?: string } | undefined;
          const id = idOf(a?.id);
          const name = str(a?.displayName);
          if (!id || !name) continue;
          if (id.startsWith("-") || name === "Team") {
            team.set(t, id);
            continue;
          }
          full.set(plain(name), id);
          if (list.some((x) => x.id === id)) continue;
          const words = name.split(/\s+/).filter((w) => !SUFFIX.test(letters(w)));
          list.push({ id, jersey: str(a?.jersey) ?? "", keys: new Set(playNames(name)), last: letters(words.slice(1).join("") || name) });
        }
      }
    }
    /** The text's name as a key: "K.Russell" is "k.russell", "D.Lee Jr." "d.lee", "Smith" ".smith". */
    const keyOf = (name: string) => {
      const words = name.split(/\s+/).filter((w) => !SUFFIX.test(letters(w)));
      const joined = words.join("");
      const dot = joined.indexOf(".");
      return dot >= 0 ? `${letters(joined.slice(0, dot))}.${letters(joined.slice(dot + 1))}` : `.${letters(joined)}`;
    };
    // The game's numbers, from all its text at once: a name and number no box jersey matches ("#2 M.Williams", where ESPN's box
    // has Marcel Williams as #9 and Marquese Williams as #24, whose own "#24 M.Williams" the text also has) is the one with that
    // name left.
    const raw = drivePlays(summary);
    const clean = new Map(raw.map(({ p }) => [p, cleaned(str(p.text) ?? "")]));
    const named = new Map<string, Set<string>>(); // key -> the jerseys the text gives it
    for (const text of clean.values()) for (const m of text.matchAll(NAME)) {
      const k = keyOf(m[2].replace(/\.$/, ""));
      named.set(k, (named.get(k) ?? new Set()).add(m[1]));
    }
    const everyone = [...people.entries()].flatMap(([t, list]) => list.map((x) => ({ ...x, team: t })));
    const learned = new Map<string, { id: string; team: string }>(); // "jersey|key" -> who
    for (const [k, jerseys] of named) {
      const last = k.slice(k.indexOf(".") + 1);
      const cands = everyone.filter((x) => x.keys.has(k) || (k.startsWith(".") && x.last === last));
      const exact = new Set(cands.filter((x) => jerseys.has(x.jersey)).map((x) => x.id));
      const left = cands.filter((x) => !exact.has(x.id));
      const unmatched = [...jerseys].filter((j) => !cands.some((x) => x.jersey === j));
      if (left.length === 1 && unmatched.length === 1) learned.set(`${unmatched[0]}|${k}`, { id: left[0].id, team: left[0].team });
    }
    const who = (n: Named | undefined, side: string | null): { id: string; team: string } | null => {
      if (!n) return null;
      const k = keyOf(n.name);
      const last = k.slice(k.indexOf(".") + 1);
      const l = learned.get(`${n.jersey}|${k}`);
      if (l) return l;
      for (const t of side ? [side, other(side)] : [away, home]) {
        const list = (t && people.get(t)) || [];
        const byJersey = list.filter((x) => x.jersey === n.jersey);
        // By jersey and name; by jersey alone when the name is near (a nickname, "Bam" for Zamir); by name alone.
        const both = byJersey.filter((x) => x.keys.has(k) || x.last === last);
        if (both.length === 1) return { id: both[0].id, team: t! };
        const named = list.filter((x) => x.keys.has(k));
        if (named.length === 1) return { id: named[0].id, team: t! };
        const lasts = list.filter((x) => x.last === last);
        if (lasts.length === 1) return { id: lasts[0].id, team: t! };
      }
      // By jersey alone on the side it should be on, when only one has it (the box spells the name otherwise).
      const byJersey = side && n.jersey ? (people.get(side) ?? []).filter((x) => x.jersey === n.jersey) : [];
      if (byJersey.length === 1) return { id: byJersey[0].id, team: side! };
      return null;
    };

    // Each side's code in the text, from ESPN's own yard lines: "to the ALA43" on a play ESPN ends at 43 is the home side's.
    const votes = new Map<string, { home: number; away: number }>();
    const seen = new Set<string>();
    for (const { p } of raw) {
      const text = str(p.text) ?? "";
      const end = p.end?.yardLine;
      for (const m of text.matchAll(SPOT)) {
        const code = m[1].toUpperCase();
        seen.add(code);
        const n = Number(m[2]);
        if (n === 50 || typeof end !== "number" || !/to the $/.test(text.slice(Math.max(0, m.index! - 7), m.index))) continue;
        const v = votes.get(code) ?? { home: 0, away: 0 };
        votes.set(code, v);
        if (end === n) v.home++;
        else if (end === 100 - n) v.away++;
      }
    }
    const codes = new Map<string, string>();
    for (const [code, v] of votes) if (v.home !== v.away) codes.set(code, v.home > v.away ? home : away);
    // A code no yard line placed: the other side's, once only one side's is known; then ESPN's own abbreviations.
    const placed = new Set(codes.values());
    const left = placed.size === 1 ? teams.find((t) => !placed.has(t.id)) : undefined;
    for (const code of seen) if (left && !codes.has(code) && !teams.some((t) => t.abbreviation?.toUpperCase() === code && t.id !== left.id)) codes.set(code, left.id);
    for (const t of teams) if (t.abbreviation && !codes.has(t.abbreviation.toUpperCase())) codes.set(t.abbreviation.toUpperCase(), t.id);
    const codeOf = (code: string | undefined) => (code ? (codes.get(code.toUpperCase()) ?? null) : null);
    const xOf = (code: string, n: number) => {
      const t = codeOf(code);
      return n === 50 ? 50 : t === home ? n : t === away ? 100 - n : null;
    };
    const scoring = new Map<string, string>();
    for (const s of (summary as { scoringPlays?: { id?: string | number; text?: string }[] }).scoringPlays ?? []) if (idOf(s.id) && str(s.text)) scoring.set(idOf(s.id), str(s.text)!);
    const teamLine = (t: string | null) => (t ? (team.get(t) ?? `team:${t}`) : null);
    const punters = new Map<string, string[]>();
    for (const side of summary.boxscore?.players ?? []) for (const table of side.statistics ?? []) if (table.name === "punting") punters.set(idOf(side.team?.id), (table.athletes ?? []).map((r) => idOf(r.athlete?.id)).filter((id) => id && !id.startsWith("-")));
    const punterOf = (t: string | null) => (t && punters.get(t)?.length === 1 ? punters.get(t)![0] : null);
    const passers = new Map<string, string[]>();
    for (const side of summary.boxscore?.players ?? []) for (const table of side.statistics ?? []) if (table.name === "passing") passers.set(idOf(side.team?.id), (table.athletes ?? []).map((r) => idOf(r.athlete?.id)).filter((id) => id && !id.startsWith("-")));
    const passerOf = (t: string | null) => (t && passers.get(t)?.length === 1 ? passers.get(t)![0] : null);
    const lastPasser = new Map<string, string>();
    const gained = gainOf(home);
    const teamOf = rosterOf(summary);
    return readDrives(
      summary,
      raw,
      (p, c) => {
        const text = clean.get(p) ?? cleaned(c.text);
        // A scoring play ESPN tells only as a summary with full names ("Kenny Minchey 2 Yd Run (Adam Zouagui Kick)"), as the
        // NFL's; or in its own phrases ("T. Owens pass to H. Summers for 20 yds, for a TD (C. Van Andel KICK)").
        if (SUMMARY.test(text)) {
          const r = this.readSummary(text, { ...c, full, teamOf } as SummaryContext);
          // An interception returned for a touchdown was thrown by the side's passer: the one in its box's passing table, else
          // the side's last to throw.
          if (/^.+? \d+ Yd Interception Return/.test(text)) c.add(passerOf(c.offense) ?? (c.offense ? lastPasser.get(c.offense) : null), { PATT: 1, INT: 1 });
          // A return touchdown is a defensive one too in college's box.
          const ret = /^(.+?) \d+ Yd (?:Kickoff|Punt) Return/.exec(text);
          if (ret) c.add(full.get(plain(ret[1])), { DTD: 1 });
          return r;
        }
        const ctx = { ...c, text, p, who, codeOf, xOf, gained, teamLine, punterOf, scoring, full, teamOf };
        // The crew's text has jersey numbers, or a side's own rush ("Boston College rush middle for 3 yards loss").
        if (!/#\d/.test(text) && !/ rush (?:left|right|middle)\b/.test(text) && PHRASE.test(text)) return readPhrases(text, ctx);
        // Each side's last to throw (a pick-six told only as a summary is his).
        const thrower = PASSER.exec(text);
        const pr = thrower ? who({ jersey: thrower[1], name: thrower[2] }, c.offense) : null;
        if (pr && c.offense) lastPasser.set(c.offense, pr.id);
        return readCollege(ctx);
      },
      issues
    );
  }
}

/** A play's text without what isn't the play: the review and what it replaced, an injury, the clock before it. */
function cleaned(text: string): string {
  let s = text;
  const orig = s.indexOf("(Original Play:");
  if (orig >= 0) {
    let depth = 0;
    let end = s.length;
    for (let i = orig; i < s.length; i++) {
      if (s[i] === "(") depth++;
      else if (s[i] === ")" && --depth === 0) {
        end = i + 1;
        break;
      }
    }
    s = s.slice(0, orig) + s.slice(end);
  }
  s = s
    .replace(/\.?\s*(?:The )?previous play is under (?:automatic )?review(?:[^"]*"[^"]*")?\.?\s*CALL [A-Z]+\.?/gi, " ")
    .replace(/\.?\s*[A-Za-z&' -]+ is challenging the ruling on the field[^"]*"[^"]*"\.?\s*CALL [A-Z]+\.?/gi, " ")
    .replace(/^\s*\(\d+:\d+\)\s*/, "")
    .replace(/`/g, "")
    // "II" typed "ll" ("#5 J.Doe ll rush").
    .replace(/(#\d{1,2} [^#,()]*?) (l{2,3})(?=[\s,);]|$)/g, (_m, a: string, l: string) => `${a} ${"I".repeat(l.length)}`)
    // A suffix after a comma: "(#19 C.McDonald, III)", "to #3 X.Y, Jr. thrown".
    .replace(/(#\d{1,2} [^,()#]*?), (Jr\.?|Sr\.?|II|III|IV|V)(?=[\s);,]|$)/g, "$1 $2");
  return s.replace(/\s+/g, " ").trim();
}

/** ESPN's own phrases, where the crew's text is missing (most bowl games have some): names as "T. Owens" or "Trey Kukuk", no
 *  jerseys. "T. Owens pass to H. Summers for 20 yds, for a TD (C. Van Andel KICK)", "Trey Kukuk run for 5 yds to the KU30 for a
 *  1ST down", "Tad Hudson pass incomplete to London Humphreys", "Peyton Woodring kickoff for 65 yds for a touchback", "Mac
 *  Chiumento punt for 41 yds, fair catch by Dedrick Latulas at the UCF25", "Lucas Carneiro 33 yd FG GOOD", "X sacked by Y for a
 *  loss of 7 yards", "C. Smith fumbled, forced by K. Washington". */
const PHRASE_NAME = "([A-Z][a-z]{0,2}\\. [A-Z][A-Za-z'’-]+(?: (?:Jr\\.?|Sr\\.?|II|III|IV|V))?|[A-Z][A-Za-z'’.-]*(?: [A-Z][A-Za-z'’.-]*)+)";
const PHRASE = new RegExp(`^(?!(?:No Huddle|Shotgun|Pistol|Wildcat|Kneel down|Team Safety)\\b)${PHRASE_NAME} (?:pass\\b|run\\b|rush\\b|sacked\\b|fumbled\\b|kickoff for\\b|punt for\\b|\\d+ yd FG\\b)`);
/** "for 5 yds", "for no gain", "for a loss of 3 yards": signed yards. */
const PHRASE_YARDS = "for (?:(-?\\d+) (?:yds?|yards?)|(no gain)|a loss of (\\d+) yards?)";
const PX = ((N: string, Y: string) => ({
  catch: new RegExp(`^${N} pass (?:complete )?to ${N} ${Y}`),
  incomplete: new RegExp(`^${N} pass incomplete(?: to ${N})?`),
  run: new RegExp(`^${N} (?:run|rush) ${Y}`),
  sacked: new RegExp(`^${N} sacked\\s+by ${N} ${Y}`),
  kickoff: new RegExp(`^${N} kickoff for (\\d+) yds(?:,? ${N} returns? ${Y})?`),
  punt: new RegExp(`^${N} punt for (\\d+) yds(?: ?,? (?:fair catch by ${N}|${N} returns? ${Y}))?`),
  fieldGoal: new RegExp(`^${N} (\\d+) yd FG (GOOD|MISSED|NO GOOD|BLOCKED)`),
  fumble: new RegExp(`${N} fumbled(?:, forced by ${N})?(?:, recovered by ${N})?`),
  kick: new RegExp(`\\(${N} KICK\\)`),
}))(PHRASE_NAME, PHRASE_YARDS);
const phraseYards = (m: RegExpExecArray, i: number) => (m[i] != null ? Number(m[i]) : m[i + 1] != null ? 0 : -Number(m[i + 2] ?? 0));

/** A play in ESPN's own phrases: what they say plainly; the rest comes at the final. */
function readPhrases(text: string, c: Ctx): { kind: string } {
  const { offense, other, add } = c;
  const defense = other(offense);
  const by = (name: string | undefined, team: string | null) => {
    if (!name) return null;
    const id = /^[A-Z][a-z]{0,2}\. /.test(name) ? null : (c.full.get(plain(name)) ?? null);
    const r = id ? { id, team: c.teamOf.get(id) ?? team ?? "" } : c.who({ jersey: "", name: name.replace(/^([A-Z][a-z]{0,2})\. /, "$1.") }, team);
    if (r) c.people.add(r.id);
    return r;
  };
  const td = /for a TD/.test(text);
  let kind = "";
  let m: RegExpExecArray | null;
  let carrier: { id: string; team: string } | null = null;
  if ((m = PX.catch.exec(text))) {
    kind = "catch";
    const yards = phraseYards(m, 3);
    const qb = by(m[1], offense);
    carrier = by(m[2], offense);
    add(qb?.id, { CMP: 1, PATT: 1, PYDS: yards, ...(td ? { PTD: 1 } : {}) });
    add(carrier?.id, { REC: 1, RECYDS: yards, TGT: 1, ...(td ? { RECTD: 1 } : {}) });
  } else if ((m = PX.incomplete.exec(text))) {
    kind = "incomplete";
    add(by(m[1], offense)?.id, { PATT: 1 });
    add(by(m[2], offense)?.id, { TGT: 1 });
  } else if ((m = PX.run.exec(text))) {
    kind = "rush";
    carrier = by(m[1], offense);
    // "TEAM run": the side's own (a fumbled snap).
    const id = carrier?.id ?? (/^TEAM$/i.test(m[1]) ? c.teamLine(offense) : null);
    add(id, { RATT: 1, RYDS: phraseYards(m, 2), ...(td ? { RTD: 1 } : {}) });
  } else if ((m = PX.sacked.exec(text))) {
    // The quarterback's rush for its loss (the NCAA's).
    kind = "sack";
    const qb = by(m[1], offense);
    add(qb?.id, { SACKED: 1, RATT: 1, RYDS: phraseYards(m, 3) });
    by(m[2], defense);
    if (defense) add(defenseId(defense), { DSTSACK: 1 });
    carrier = qb;
  } else if ((m = PX.kickoff.exec(text))) {
    kind = "kickoff";
    by(m[1], offense);
    if (m[3]) add(by(m[3], defense)?.id, { KR: 1, KRYDS: phraseYards(m, 4), ...(td ? { KRTD: 1, DTD: 1 } : {}) });
  } else if ((m = PX.punt.exec(text))) {
    kind = "punt";
    add(by(m[1], offense)?.id, { PUNT: 1, PUNTYDS: Number(m[2]), ...(/touchback/i.test(text) ? { PUNTTB: 1 } : {}) });
    if (m[3]) by(m[3], defense);
    if (m[4]) add(by(m[4], defense)?.id, { PR: 1, PRYDS: phraseYards(m, 5), ...(td ? { PRTD: 1, DTD: 1 } : {}) });
  } else if ((m = PX.fieldGoal.exec(text))) {
    kind = "field-goal";
    const good = m[3] === "GOOD";
    add(by(m[1], offense)?.id, { FGA: 1, FGM: good ? 1 : 0, ...(good ? { [bandOf(Number(m[2]))]: 1 } : {}) });
  }
  const f = PX.fumble.exec(text);
  if (f) {
    const who = by(f[1], offense) ?? carrier;
    add(who?.id, { FUM: 1 });
    add(by(f[2], other(who?.team ?? offense))?.id, { FF: 1 });
    const rec = by(f[3], null);
    // A recovery counts only on the other side's fumble (the NCAA's).
    if (rec && who && rec.team !== who.team) {
      add(rec.id, { FREC: 1 });
      add(who.id, { FUML: 1 });
      add(defenseId(rec.team), { DSTFR: 1 });
    }
    kind ||= "fumble";
  }
  const k = PX.kick.exec(text);
  if (k) add(by(k[1], offense)?.id, { XPA: 1, XPM: /PAT MISSED|PAT BLOCKED/.test(text) ? 0 : 1 });
  if (!kind) c.issues?.("a phrase not read");
  return { kind };
}

/**
 * One play's text into its counts. Names become "@n" and spots "$n" first; then the events are read left to right (the play,
 * then what came of it: a return, a fumble, tacklers, a touchdown, the try, a penalty), each moving the ball's carrier on.
 */
function readCollege(c: Ctx): { kind: string } {
  const { offense, other, add } = c;
  const defense = other(offense);
  // The text, cleaned (readPlays).
  let s = c.text;
  if (!s) return { kind: "" };
  const names: Named[] = [];
  s = s.replace(NAME, (_m, jersey: string, name: string) => {
    names.push({ jersey, name: name.replace(/\.$/, "") });
    return `@${names.length - 1}`;
  });
  const spots: { code: string; n: number }[] = [];
  s = s.replace(SPOT, (_m, code: string, n: string) => {
    spots.push({ code, n: Number(n) });
    return `$${spots.length - 1}`;
  });
  // Someone injured on the play isn't the play.
  s = s.replace(/\.?\s*@\d+(?:, @\d+)* injured on the play\.?/g, "").trim();
  // "NO PLAY" voids the play, unless it's its try's (a touchdown, then the try, then a penalty on the try: the try is run again).
  const voided = s.lastIndexOf("NO PLAY");
  if (voided >= 0) {
    const foul = s.lastIndexOf("PENALTY", voided);
    const before = s.slice(0, foul < 0 ? voided : foul);
    if (!(/TOUCHDOWN(?! nullified)/.test(before) && /attempt/.test(before))) return { kind: "no-play" };
  }

  const person = (i: string | undefined, team: string | null) => {
    const r = i != null ? c.who(names[Number(i)], team) : null;
    if (r) c.people.add(r.id);
    return r;
  };
  const at = (i: string | undefined) => (i != null ? c.xOf(spots[Number(i)].code, spots[Number(i)].n) : null);

  let kind = "";
  let carrier: Carrier = { id: null, team: offense, kind: "none" };
  let passer: string | null = null;
  // The last gain read (whose, what kind, its yards and where it ended; `counted`: its text already counts it to a foul's spot,
  // "for 17 yards gain (16)").
  let last: { id: string; team: string; kind: GainKind; yards: number; end: number | null; counted?: boolean } | null = null;
  let scorer: string | null = null;
  let punter: string | null = null;
  let puntEnd: number | null = null;
  let touchback = false;
  let tfl: { ids: string[]; shared: boolean } | null = null;
  let snapped: string | null = null;
  let kick: { id: string | null; good: boolean } | null = null;
  // Past "PENALTY": what follows names fouls ("UTK Holding (#71 X.Y) 10 yards from UTK48 to UTK38", "Vandy Personal Foul declined").
  let penalty = false;
  // A kick's return already counted (a muff).
  let returned = false;

  const credit = (id: string | null, team: string | null, g: GainKind, yards: number, end: number | null) => {
    // The passer's line whoever caught it (a receiver the box doesn't have).
    if (g === "catch") add(passer, { CMP: 1, PATT: 1, PYDS: yards });
    if (!id || !team) return;
    const d: Partial<Record<GainKind, Stats>> = {
      rush: { RATT: 1, RYDS: yards },
      catch: { REC: 1, RECYDS: yards, TGT: 1 },
      // A lateral's yards are the kind of gain it continues (a return's without another return).
      lateral: ({ catch: { RECYDS: yards }, rush: { RYDS: yards }, "kick-return": { KRYDS: yards }, "punt-return": { PRYDS: yards }, "int-return": { DINTYDS: yards } } as Partial<Record<GainKind, Stats>>)[carrier.kind] ?? {},
      "kick-return": { KR: returned ? 0 : 1, KRYDS: yards },
      "punt-return": { PR: returned ? 0 : 1, PRYDS: yards },
      "int-return": { DINTYDS: yards },
    };
    add(id, d[g] ?? {});
    last = { id, team, kind: g, yards, end };
  };
  /** The last gain's yards changed by some (counted only to a foul's spot); a catch's passer's too, unless `alone`. */
  const shift = (yards: number, alone = false) => {
    const l = last as { id: string; team: string; kind: GainKind; yards: number; end: number | null } | null;
    if (!l || !yards) return;
    const key: Partial<Record<GainKind, string>> = { rush: "RYDS", catch: "RECYDS", "kick-return": "KRYDS", "punt-return": "PRYDS", "int-return": "DINTYDS" };
    const k = key[l.kind];
    if (!k) return;
    add(l.id, { [k]: yards });
    if (l.kind === "catch" && !alone) add(passer, { PYDS: yards });
    l.yards += yards;
    if (l.end != null) l.end += l.team === c.home ? yards : -yards;
  };
  const touchdown = () => {
    const w = carrier;
    // A touchdown pass is its passer's whoever caught it (a receiver the box doesn't have).
    if (w.kind === "catch") add(passer, { PTD: 1 });
    if (!w.id || !w.team) return;
    scorer = w.team;
    const own = w.kind === "fumble-return" && w.team === (w.lost ?? offense);
    const d: Partial<Record<GainKind, Stats>> = {
      rush: { RTD: 1 },
      catch: { RECTD: 1 },
      // A return touchdown is a defensive one too in college's box (its defensive table's TD).
      "kick-return": { KRTD: 1, DTD: 1 },
      "punt-return": { PRTD: 1, DTD: 1 },
      "int-return": { DINTTD: 1, DTD: 1 },
      "fumble-return": own ? { FRTD: 1 } : { DTD: 1 },
      "blocked-return": { DTD: 1 },
    };
    add(w.id, d[w.kind] ?? {});
    if (RETURNS.has(w.kind) && !own) {
      add(defenseId(w.team), { DSTTD: 1 });
      const turnover = w.kind === "int-return" || (w.kind === "blocked-return" && kind === "field-goal") || (w.kind === "fumble-return" && kind !== "kickoff" && kind !== "punt");
      if (turnover) c.notAllowed[w.team] = (c.notAllowed[w.team] ?? 0) + 6;
    }
  };
  const tackle = (inner: string, team: string | null, gain: boolean) => {
    const ids: string[] = [];
    // "(A; B)" a shared tackle, and a sack's "(A, B)" a split one: half each (a sack, a tackle for loss), neither solo.
    const shared = /[;,]/.test(inner);
    const list = [...inner.matchAll(/@(\d+)/g)];
    list.forEach((m, i) => {
      const r = person(m[1], team);
      if (!r || ids.includes(r.id)) return;
      ids.push(r.id);
      add(r.id, { TCK: 1, SOLO: list.length === 1 || (!shared && i === 0) ? 1 : 0 });
    });
    if (gain && ids.length) tfl = { ids, shared };
    return ids;
  };

  /** A foul called and not declined ("Intentional Grounding (#1 A.Arm) declined" is declined). */
  const called = (foul: string) => new RegExp(`PENALTY [^.]*?${foul}`).test(s) && !new RegExp(`${foul}(?: \\(@\\d+\\))? declined`).test(s);
  const grounding = called("Intentional Grounding");
  // A pass thrown from past the line ("Illegal Forward Pass") isn't one: no attempt, no catch (the NFL's too).
  const illegal = called("Illegal Forward Pass");
  // The events, left to right. Each pattern is tried where the scan is; what none of them reads is skipped (and noted).
  type Rule = [RegExp, (m: RegExpExecArray) => void, (() => boolean)?];
  // The yards, or the count to a foul's spot when the text gives it, which carries its own sign ("gain (-10)").
  const yardsOf = (n: string, sign?: string, counted?: string) => (counted != null ? (sign === "loss" ? -Math.abs(Number(counted)) : Number(counted)) : Number(n) * (sign === "loss" ? -1 : 1));
  const rules: Rule[] = [
    // The play.
    [RX.rush, (m) => {
      kind = "rush";
      const yards = yardsOf(m[3], m[4], m[5]);
      const id = m[1] != null ? (person(m[1], offense)?.id ?? null) : c.teamLine(offense);
      carrier = { id, team: offense, kind: "rush" };
      credit(id, offense, "rush", yards, at(m[6]));
      if (m[5] != null && last) last.counted = true;
      // A team's rush ("Auburn rush middle for 4 yards loss") is a fumbled snap: the team's fumble, said or not.
      if (m[1] == null) snapped = id;
    }],
    [RX.kneel, (m) => {
      // The team's (the NCAA's), whoever knelt.
      kind = "kneel";
      if (m[1] != null) person(m[1], offense);
      add(c.teamLine(offense), { RATT: 1, RYDS: -Number(m[3]) });
    }],
    [RX.catch, (m) => {
      kind = "catch";
      passer = person(m[1], offense)?.id ?? null;
      const r = person(m[2], offense);
      carrier = { id: r?.id ?? null, team: offense, kind: "catch" };
      if (illegal) return;
      credit(carrier.id, offense, "catch", yardsOf(m[4], m[5], m[6]), at(m[7]));
    }],
    [RX.incomplete, (m) => {
      passer = person(m[1], offense)?.id ?? null;
      if (m[4]) {
        // A spike is the team's attempt (the NCAA's).
        kind = "spike";
        add(c.teamLine(offense), { PATT: 1 });
        return;
      }
      if (grounding) {
        // Intentional grounding is a sack (the NCAA's): the passer's rush for the loss ESPN gives, never an attempt.
        kind = "sack";
        const loss = num(c.p.statYardage) ?? 0;
        add(passer, { SACKED: 1 });
        carrier = { id: passer, team: offense, kind: "rush" };
        credit(passer, offense, "rush", loss, null);
        if (defense) add(defenseId(defense), { DSTSACK: 1 });
        return;
      }
      kind = "incomplete";
      if (illegal) return;
      add(passer, { PATT: 1 });
      add(person(m[2], offense)?.id, { TGT: 1 });
    }],
    [RX.intercepted, (m) => {
      kind = "interception";
      passer = person(m[1], offense)?.id ?? null;
      add(passer, { PATT: 1, INT: 1 });
      const by = person(m[2], defense);
      add(by?.id, { DINT: 1 });
      if (defense) add(defenseId(defense), { DSTINT: 1 });
      carrier = { id: by?.id ?? null, team: by?.team ?? defense, kind: "int-return" };
    }],
    [RX.sacked, (m) => {
      // The quarterback's rush for its loss (the NCAA's).
      kind = "sack";
      const qb = person(m[1], offense);
      const yards = -Number(m[2]);
      add(qb?.id, { SACKED: 1 });
      carrier = { id: qb?.id ?? null, team: offense, kind: "rush" };
      credit(carrier.id, offense, "rush", yards, at(m[3]));
      if (defense) add(defenseId(defense), { DSTSACK: 1 });
    }],
    [RX.kickoff, (m) => {
      kind = "kickoff";
      person(m[1], offense);
      carrier = { id: null, team: defense, kind: "kick-return" };
    }],
    [RX.punt, (m) => {
      kind = "punt";
      // A punt with no name is the side's punter's (the one in its box's punting table); a blocked one is the team's (the
      // NCAA's), its yards as the text gives them.
      punter = m[1] != null ? (person(m[1], offense)?.id ?? null) : c.punterOf(offense);
      if (/^(?:[^$]*?)\$\d+ blocked by /.test(s.slice(m.index))) {
        add(c.teamLine(offense), { PUNT: 1, PUNTYDS: Number(m[2]) });
        punter = null;
      } else add(punter, { PUNT: 1, PUNTYDS: Number(m[2]) });
      puntEnd = at(m[3]);
      carrier = { id: null, team: defense, kind: "punt-return" };
    }],
    [RX.fieldGoal, (m) => {
      kind = "field-goal";
      const good = m[3] === "GOOD";
      add(person(m[1], offense)?.id, { FGA: 1, FGM: good ? 1 : 0, ...(good ? { [bandOf(Number(m[2]))]: 1 } : {}) });
    }],
    [RX.teamSafety, () => {
      kind = "safety";
      if (defense) {
        add(defenseId(defense), { DSTSAF: 1 });
        c.notAllowed[defense] = (c.notAllowed[defense] ?? 0) + 2;
      }
    }],
    // What came of it.
    [RX.ret, (m) => {
      const r = m[1] != null ? person(m[1], carrier.team) : null;
      const yards = (/return for loss/.test(m[0]) || m[3] === "loss" ? -1 : 1) * Number(m[2]);
      carrier = { ...carrier, id: r?.id ?? carrier.id };
      if (carrier.kind === "fumble-return" || carrier.kind === "blocked-return") last = carrier.id && carrier.team ? { id: carrier.id, team: carrier.team, kind: carrier.kind, yards, end: at(m[4]) } : null;
      else credit(carrier.id, carrier.team, carrier.kind, yards, at(m[4]));
      if (carrier.kind === "punt-return") puntEnd = at(m[4]) ?? puntEnd;
    }],
    [RX.fairCatch, (m) => {
      person(m[1], carrier.team);
      if (carrier.kind === "punt-return") puntEnd = at(m[2]) ?? puntEnd;
    }],
    [RX.touchback, () => {
      touchback = true;
      if (kind === "punt" && punter) add(punter, { PUNTTB: 1 });
    }],
    [RX.outOfBounds, (m) => {
      if (kind === "punt" && carrier.kind === "punt-return" && !last) puntEnd = at(m[1]) ?? puntEnd;
    }],
    [RX.fumble, (m) => {
      const f = person(m[1] ?? m[3], carrier.team ?? offense) ?? (carrier.id && carrier.team ? { id: carrier.id, team: carrier.team } : null);
      add(f?.id, { FUM: 1 });
      if (f?.id === snapped) snapped = null;
      const ff = person(m[4], other(f?.team ?? offense));
      add(ff?.id, { FF: 1 });
      if (m[5]) tackle(m[5], other(f?.team ?? offense), false);
      if (m[6]) {
        const side = c.codeOf(m[6]);
        const by = person(m[7], side);
        const t = by?.team ?? side;
        // A recovery is counted only on the other side's fumble (the NCAA's: a defensive stat).
        if (t && f && t !== f.team) {
          add(by?.id, { FREC: 1 });
          add(f.id, { FUML: 1 });
          add(defenseId(t), { DSTFR: 1 });
        }
        carrier = { id: by?.id ?? null, team: t, kind: "fumble-return", lost: f?.team ?? carrier.team };
        last = null;
      }
    }],
    [RX.muff, (m) => {
      // A muffed punt is the muffer's fumble and his return: of nothing, or to where his side got it back (a later return of it
      // adds to his, not another).
      const mf = person(m[1], carrier.team);
      const punted = carrier.kind === "punt-return";
      if (punted && mf) {
        add(mf.id, { FUM: 1, PR: 1 });
        returned = true;
      }
      if (m[3]) {
        const side = c.codeOf(m[3]);
        const by = person(m[4], side);
        const t = by?.team ?? side;
        if (by && mf && t !== mf.team) {
          add(by.id, { FREC: 1 });
          add(mf.id, { FUML: 1, ...(punted ? {} : { FUM: 1 }) });
          if (t) add(defenseId(t), { DSTFR: 1 });
          carrier = { id: by.id, team: t, kind: "fumble-return", lost: mf.team };
        } else {
          const from = at(m[2]);
          const to = at(m[5]);
          if (punted && mf && from != null && to != null && mf.team) add(mf.id, { PRYDS: c.gained(mf.team, from, to) });
          if (punted && to != null) puntEnd = to;
          carrier = { id: by?.id ?? mf?.id ?? null, team: t ?? mf?.team ?? carrier.team, kind: carrier.kind };
        }
      } else if (punted) puntEnd = at(m[2]) ?? puntEnd;
    }],
    [RX.blocked, (m) => {
      const b = person(m[1], defense);
      if (b) {
        add(b.id, { BLKK: 1 });
        add(defenseId(b.team), { DSTBLK: 1 });
      }
      carrier = { id: null, team: defense, kind: "blocked-return" };
    }],
    [RX.recovered, (m) => {
      const side = c.codeOf(m[1]);
      const by = person(m[2], side);
      carrier = by && by.team !== offense ? { id: by.id, team: by.team, kind: carrier.kind === "blocked-return" ? "blocked-return" : "fumble-return", lost: offense } : { id: by?.id ?? null, team: by?.team ?? side, kind: "none" };
    }],
    [RX.lateral, (m) => {
      const r = person(m[1], carrier.team);
      const yards = yardsOf(m[2], m[3]);
      const end = at(m[4]);
      // Ending where the gain before it ended, that gain's yards were the whole play's ("caught at ORE40, for 30 yards to the
      // UCL33 lateral to #9 J.Johnson for 7 yards gain to the UCL33"): the first's are the rest (the passer's stay the whole).
      const l = last as { end: number | null } | null;
      const whole = !!l && l.end != null && l.end === end;
      if (whole) shift(-yards, true);
      const from = carrier.kind;
      credit(r?.id ?? null, carrier.team, "lateral", yards, end);
      if (from === "catch" && !whole) add(passer, { PYDS: yards });
      carrier = { ...carrier, id: r?.id ?? null };
      if (last) (last as { kind: GainKind }).kind = from;
    }],
    [RX.holder, () => {}],
    [RX.kickBlocked, (m) => {
      const b = person(m[1], defense);
      if (b) {
        add(b.id, { BLKK: 1 });
        add(defenseId(b.team), { DSTBLK: 1 });
      }
    }],
    [RX.tacklers, (m) => {
      // Tacklers: "(A)" solo, "(A; B)" shared. Never inside a penalty (a fouler's "(#71 X.Y)").
      const behind = !!last && last.yards < 0 && (last.kind === "rush" || last.kind === "catch");
      tackle(m[1], other(carrier.team ?? offense), behind);
    }, () => !penalty],
    [RX.nullified, () => {}],
    [RX.touchdown, () => touchdown()],
    [RX.safety, () => {
      kind = "safety";
      const by = other(carrier.team ?? offense);
      if (by) {
        add(defenseId(by), { DSTSAF: 1 });
        c.notAllowed[by] = (c.notAllowed[by] ?? 0) + 2;
      }
    }],
    [RX.hurried, (m) => {
      add(person(m[1], defense)?.id, { HUR: 1 });
      for (const x of (m[2] ?? "").matchAll(/@(\d+)/g)) add(person(x[1], defense)?.id, { HUR: 1 });
    }],
    [RX.brokenUp, (m) => add(person(m[1], defense)?.id, { PD: 1 })],
    // The try after a touchdown, by the side that scored it.
    [RX.kickTry, (m) => {
      // ESPN tells a try again after a penalty on it ("kick attempt good ... PENALTY ... kick attempt good"): the last stands.
      kick = { id: person(m[1], scorer ?? offense)?.id ?? null, good: /good/i.test(m[2]) && !/no good/i.test(m[2]) };
    }],
    [RX.twoPoint, (m) => {
      const named = person(m[1], scorer ?? offense);
      if (!/successful/i.test(m[3])) return;
      // Who passed and who caught, from the scoring play's summary; a run's runner is the text's own.
      const tr = /\((.+?) (?:Pass to (.+?)|Run) for Two-Point Conversion\)/.exec(c.scoring.get(idOf(c.p.id)) ?? "");
      if (tr && tr[2]) {
        add(c.full.get(plain(tr[1])), { P2PT: 1 });
        add(c.full.get(plain(tr[2])), { RE2PT: 1 });
      } else if (tr) add(c.full.get(plain(tr[1])), { R2PT: 1 });
      else if (/rush/i.test(m[2])) add(named?.id, { R2PT: 1 });
      else c.issues?.("a two-point pass not in the scoring plays");
    }],
    [RX.defensivePat, (m) => {
      const r = person(m[1], defense);
      const t = r?.team ?? defense;
      if (t) c.notAllowed[t] = (c.notAllowed[t] ?? 0) + 2;
    }],
    [RX.penalty, () => {
      penalty = true;
    }],
    [RX.foul, (m) => {
      // A foul by the side with the ball, at a spot behind where its gain ended: the gain counts only to the spot (a return's
      // too; a negative one whose foul is at the catch counts nothing).
      const l = last as { team: string; yards: number; end: number | null; counted?: boolean } | null;
      const spot = at(m[3]);
      if (!m[2] || !l || l.end == null || l.counted || spot == null || c.codeOf(m[1]) !== l.team) return;
      const behind = c.gained(l.team, spot, l.end);
      if (l.yards >= 0 ? behind > 0 && behind <= l.yards : behind < 0 && behind >= l.yards) shift(-behind);
    }, () => penalty],
    [RX.filler, () => {}],
  ];

  const skipped: string[] = [];
  let i = 0;
  while (i < s.length) {
    let hit = false;
    for (const [re, fn, when] of rules) {
      if (when && !when()) continue;
      re.lastIndex = i;
      const m = re.exec(s);
      if (!m || !m[0]) continue;
      fn(m);
      i += m[0].length;
      hit = true;
      break;
    }
    if (hit) continue;
    RX.word.lastIndex = i;
    const w = RX.word.exec(s);
    skipped.push(w ? w[0].trim() : s[i]);
    i += w ? w[0].length : 1;
  }
  if (skipped.length) c.issues?.(`not read: ${skipped.join(" ")}`);

  if (snapped) add(snapped, { FUM: 1 });
  const kk = kick as { id: string | null; good: boolean } | null;
  if (kk) add(kk.id, { XPA: 1, XPM: kk.good ? 1 : 0 });
  // A tackle for loss: a run's, a catch's or a sack's, ending behind the line.
  const lf = tfl as { ids: string[]; shared: boolean } | null;
  const lg = last as { yards: number } | null;
  if (lf && lg && lg.yards < 0) for (const id of lf.ids) add(id, { TFL: lf.shared ? 0.5 : 1 });
  if (kind === "sack" && lf) for (const id of lf.ids.slice(0, lf.shared ? undefined : 1)) add(id, { SACK: lf.shared ? 0.5 : 1 });
  // A punt left inside the receiving side's 20 (not a touchback).
  const pe = puntEnd as number | null;
  if (punter && pe != null && !touchback && defense) {
    const own = defense === c.home ? pe : 100 - pe;
    if (own < 20) add(punter, { PUNTIN20: 1 });
  }
  return { kind };
}
