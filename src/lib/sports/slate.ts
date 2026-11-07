// A league's slate (docs/PLAN-start-a-game-gpt.md track L, L8): a season made of a whole league's games, several an episode, for
// pick'em over a week, a season-long league over a league (head to head each week), categories over a week and a playoff's
// series. Pure: the server makes and keeps one (src/lib/server/sports/slate.ts), the tests read ESPN's recorded answers.
//
// What an episode is, from ESPN's own answers (never a table here):
// - day: each day the league plays (ESPN's calendar of days: the NBA's, the NHL's, MLB's, soccer's);
// - week: a sport whose calendar is weeks (football: ESPN's own weeks, "Week 9", "Wild Card"), else Monday to Sunday (Yahoo's and
//   ESPN's fantasy week for the NBA, NHL and MLB);
// - round: soccer's (ESPN numbers none): the league's days in order, a day joining the round unless a team in it has already
//   played in that round, so a round is each team once (a match moved to a midweek between two rounds starts a short one).
// Each episode is a window of days (the East's), and the windows tile the stage: a day the league doesn't play belongs to the
// next episode, so a game listed later (a makeup, a moved game) always has an episode. Days are the East's, as the scoreboards'
// and the locks' are (locks.ts); ESPN's calendar's bounds are the Pacific's midnight (07:00Z), read as their own date.
import * as Air from "@/lib/game/air-schedule.js";

export type Cadence = "day" | "week" | "round";
/** The stage of its season a slate is ("regular": a soccer league's whole season too; "post": the playoffs). */
export type SlateStage = "regular" | "post";

/** A stage of a league's season as ESPN's calendar bounds it (ISO instants). */
export interface CalendarStage {
  /** null: a season of one stage, its own (a soccer league's); "other": the off season, the NBA's play-in. */
  stage: "pre" | "regular" | "post" | "other" | null;
  /** ESPN's number for it (2 the regular season; a soccer league's season its own: 14308). */
  type: number;
  name: string;
  from: string;
  to: string;
}
/** One of ESPN's weeks (football's calendar), its bounds ISO instants. */
export interface CalendarWeek {
  type: number;
  label: string;
  detail: string | null;
  from: string;
  to: string;
}
/** A league's season now, as ESPN's scoreboard and its season's types say it. */
export interface LeagueCalendar {
  /** ESPN's year for it (the NBA's 2026-27 is 2027). */
  season: number;
  /** As ESPN names it ("2026", "2026-27", "2026-27 English Premier League"). */
  label: string;
  /** The stage it's in now (ESPN's number). */
  now: number;
  stages: CalendarStage[];
  /** The days it plays (ESPN's day calendar), "YYYY-MM-DD"; none for a calendar of weeks. */
  days: string[];
  /** Its weeks (a calendar of weeks: football's), every stage's. */
  weeks: CalendarWeek[];
  /** The league as ESPN names it ("National Basketball Association", "NBA"), when it says. */
  leagueName?: { name: string; short: string | null } | null;
}

/** A game as a slate reads it. */
export interface SlateGame {
  id: string;
  at: string | null;
  /** Its teams' ids. */
  teams: string[];
}

/** An episode of a slate: its window of days (the East's, both ends in it), its name, and its games as far as they're known. */
export interface SlateEpisode {
  n: number;
  from: string;
  to: string;
  /** "Week 9", "Round 12", "Sun, Nov 8". */
  label: string;
  /** Its dates when the label doesn't say them ("Nov 2 – 8"); null for a day. */
  detail: string | null;
  games: string[];
}

export const ZONE = "America/New_York";
const ESPN_ZONE = "America/Los_Angeles";

/** A game's day (the East's). */
export const dayOf = (at: string) => Air.localDate(new Date(at), ZONE) as string;
/** One of ESPN's calendar bounds as its own date (a start at the Pacific's midnight; an end a minute before it, the day before). */
const espnDay = (at: string) => Air.localDate(new Date(at), ESPN_ZONE) as string;
const addDays = (day: string, n: number) => Air.addDays(day, n) as string;

/** The ways a league's slate can be cut, its usual first: a calendar of weeks (football) by its weeks; a league that locks daily by
 *  week or by day; any other (soccer) by round or by day. */
export function cadencesOf(calendar: Pick<LeagueCalendar, "weeks">, lock: "daily" | "weekly" | "event"): Cadence[] {
  if (lock === "event") return [];
  if (calendar.weeks.length) return ["week"];
  return lock === "daily" ? ["week", "day"] : ["round", "day"];
}

/** A stage's word for ESPN's: soccer's own season (none) is its regular season. */
export const slateStageOf = (s: CalendarStage): SlateStage | null => (s.stage === "post" ? "post" : s.stage === "regular" || s.stage === null ? "regular" : null);

/** The stage's bounds as days (ESPN's own dates), or null when the calendar hasn't got it. */
export function stageDays(calendar: LeagueCalendar, stage: SlateStage): { from: string; to: string; type: number } | null {
  const s = calendar.stages.find((x) => slateStageOf(x) === stage);
  return s ? { from: espnDay(s.from), to: espnDay(new Date(Date.parse(s.to) - 60_000).toISOString()), type: s.type } : null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const md = (day: string) => `${MONTHS[Number(day.slice(5, 7)) - 1]} ${Number(day.slice(8, 10))}`;
const weekday = (day: string) => WEEKDAYS[new Date(`${day}T12:00:00Z`).getUTCDay()];
/** "Nov 2 – 8", "Oct 27 – Nov 2", "Nov 8". */
export function spanWords(from: string, to: string): string {
  if (from === to) return md(from);
  return from.slice(0, 7) === to.slice(0, 7) ? `${md(from)} – ${Number(to.slice(8, 10))}` : `${md(from)} – ${md(to)}`;
}

/** The Monday a day's week starts on. */
export function mondayOf(day: string): string {
  const d = new Date(`${day}T12:00:00Z`).getUTCDay();
  return addDays(day, -((d + 6) % 7));
}

/** Windows that tile: each one's start the day after the one before's end. */
function tile<T extends { from: string; to: string }>(eps: T[]): T[] {
  for (let i = 1; i < eps.length; i++) eps[i].from = addDays(eps[i - 1].to, 1);
  return eps;
}

/**
 * A slate's episodes for a stage of the league's calendar. `games` (a stage's fixtures) are needed for rounds, and placed into
 * every cadence's windows when given; days and weeks come from the calendar alone, their games linked as they near.
 */
export function slateEpisodes(calendar: LeagueCalendar, stage: SlateStage, cadence: Cadence, games: SlateGame[] = []): SlateEpisode[] {
  const bounds = stageDays(calendar, stage);
  if (!bounds) return [];
  const inStage = (day: string) => day >= bounds.from && day <= bounds.to;
  const played = games.filter((g) => g.at && inStage(dayOf(g.at))).sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));
  let eps: SlateEpisode[] = [];
  if (cadence === "round") {
    const byDay = new Map<string, SlateGame[]>();
    for (const g of played) byDay.set(dayOf(g.at!), [...(byDay.get(dayOf(g.at!)) ?? []), g]);
    let teams = new Set<string>();
    for (const [day, list] of byDay) {
      const cur = eps.at(-1);
      if (!cur || list.some((g) => g.teams.some((t) => teams.has(t)))) {
        eps.push({ n: eps.length + 1, from: day, to: day, label: episodeLabel("round", eps.length + 1, day), detail: null, games: [] });
        teams = new Set();
      }
      eps.at(-1)!.to = day;
      for (const g of list) g.teams.forEach((t) => teams.add(t));
    }
  } else if (cadence === "week" && calendar.weeks.length) {
    eps = calendar.weeks
      .filter((w) => w.type === bounds.type)
      .map((w, i) => ({ n: i + 1, from: espnDay(w.from), to: espnDay(new Date(Date.parse(w.to) - 60_000).toISOString()), label: w.label, detail: w.detail, games: [] }));
  } else {
    const days = [...new Set([...calendar.days, ...played.map((g) => dayOf(g.at!))])].filter(inStage).sort();
    if (cadence === "day") eps = days.map((d, i) => ({ n: i + 1, from: d, to: d, label: episodeLabel("day", i + 1, d), detail: null, games: [] }));
    else {
      for (const d of days) {
        const mon = mondayOf(d);
        if (eps.at(-1)?.from !== mon) eps.push({ n: eps.length + 1, from: mon, to: addDays(mon, 6), label: episodeLabel("week", eps.length + 1, mon), detail: null, games: [] });
      }
    }
  }
  eps = tile(eps);
  // A regular season's last episode reaches its stage's last day (a makeup after the last listed day, a fixture moved past the last
  // round); the playoffs' grow as they're listed.
  if (stage === "regular" && eps.length && eps[eps.length - 1].to < bounds.to) eps[eps.length - 1].to = bounds.to;
  // A week's or a round's dates (a day says its own): the days it plays, not the days it holds.
  for (const e of eps) {
    const mine = played.filter((g) => episodeFor(eps, dayOf(g.at!)) === e.n);
    e.games = mine.map((g) => g.id);
    if (cadence !== "day" && !e.detail) {
      const ds = mine.map((g) => dayOf(g.at!));
      e.detail = ds.length ? spanWords(ds[0], ds[ds.length - 1]) : cadence === "week" ? spanWords(e.from, e.to) : null;
    }
  }
  return eps;
}

/** An episode's name by its cadence: "Sun, Nov 8", "Week 9", "Round 12" (football's weeks are ESPN's own). */
export function episodeLabel(cadence: Cadence, n: number, from: string): string {
  return cadence === "day" ? `${weekday(from)}, ${md(from)}` : cadence === "round" ? `Round ${n}` : `Week ${n}`;
}

/** The episode a day belongs to (windows that tile), or null for a day before the first or after the last. */
export function episodeFor(eps: Pick<SlateEpisode, "n" | "from" | "to">[], day: string): number | null {
  for (const e of eps) if (day >= e.from && day <= e.to) return e.n;
  return null;
}

/** A slate's key: its league, season, stage and cadence, whoever asks ("espn:football/nfl:slate:2026:regular:week"). */
export function slateKey(provider: string, league: string, season: number, stage: SlateStage, cadence: Cadence): string {
  return `${provider}:${league}:slate:${season}:${stage}:${cadence}`;
}

/** The season as people say it, from ESPN's label: "2026", "2026-27" ("2026-27 English Premier League"). */
export function seasonWords(calendar: Pick<LeagueCalendar, "label" | "season">): string {
  return /^\d{4}(?:[-/]\d{2,4})?/.exec(calendar.label.trim())?.[0].replace("/", "-") ?? String(calendar.season);
}

/** A slate's name: "NFL 2026", "NBA 2026-27, day by day", "NBA 2026-27 playoffs". */
export function slateName(league: string, calendar: Pick<LeagueCalendar, "label" | "season">, stage: SlateStage, cadence: Cadence, usual: Cadence): string {
  const by = cadence === usual ? "" : `, ${cadence} by ${cadence}`;
  return `${league} ${seasonWords(calendar)}${stage === "post" ? " playoffs" : ""}${by}`;
}

/** The months a window of days holds ("YYYY-MM"), for a league's fixtures month by month. */
export function monthsOf(from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = from.slice(0, 7); m <= to.slice(0, 7); ) {
    out.push(m);
    const [y, mo] = m.split("-").map(Number);
    m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  }
  return out;
}
