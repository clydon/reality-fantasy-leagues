import { easternDay } from "@/lib/game/tv-listings";
import * as Air from "@/lib/game/air-schedule.js";
import { leagueName } from "@/lib/sports/matchup";
import { cadencesOf, dayOf, episodeFor, episodeLabel, mondayOf, monthsOf, seasonWords, spanWords, slateEpisodes, slateKey, slateName, slateStageOf, stageDays, ZONE, type Cadence, type LeagueCalendar, type SlateEpisode, type SlateGame, type SlateStage } from "@/lib/sports/slate";
import { TeamSport, sportOf } from "@/lib/sports";
import { pool } from "../db";
import { castFromEvents } from "./cast";
import { sportsProviders } from "./index";
import { leagueShow, storeEvents } from "./matchup";
import { fillLater } from "./season";
import { SportsUnavailable, type SportsEvent, type SportsProvider } from "./types";

// A league's slate (docs/PLAN-start-a-game-gpt.md track L, L8; db/migrations/0304): a season of its league's show made of the whole
// league's games, several an episode (a day's, a week's, a round's: src/lib/sports/slate.ts says which), keyed by its league,
// season, stage and cadence (sports_slates.key), so everyone who asks for it shares one. Its episodes are made at once from ESPN's
// calendar (each a window of days that tile the stage); its games are linked as they near, from each day's scoreboard (the same
// answers the daily listings job reads for every linked game: three days back to eight ahead), a game listed later (a makeup) or
// moved (a flexed NFL game, a rained-out one's new day) finding its episode by its day, and a soccer league's at once (its rounds
// need every fixture: a month's scoreboard each). Each game's facts are kept as any linked game's (sports_events: matchup.ts
// storeEvents; its final's counts by finals.ts), and its people are the linked games' teams' rosters (cast.ts), added to as more
// teams' games are linked. ESPN is asked little: its calendar and the season's stages (a day), each day's scoreboard as it nears
// (cached), a soccer season's months once.

type Queryable = { query: typeof pool.query };

/** Days back and ahead a slate's games are linked (the daily listings job's window). */
const BACK_DAYS = 3;
const AHEAD_DAYS = 8;

export interface Slate {
  seasonId: string;
  /** Made just now (else someone had asked for it before). */
  made: boolean;
  name: string;
  league: string;
  stage: SlateStage;
  cadence: Cadence;
  episodes: number;
  /** Its games linked so far. */
  games: number;
}

/** A slate that can't be made as asked (a cadence the league isn't cut by, a stage its calendar hasn't listed). */
export class SlateRefused extends Error {}

/** What a league's slate can be: its season now, its stages and each one's cadences (the usual first). Null for no such league. */
export async function slateChoices(league: string, opts: { providers?: SportsProvider[] } = {}): Promise<{ provider: SportsProvider; calendar: LeagueCalendar; stages: { stage: SlateStage; cadences: Cadence[] }[] } | null> {
  const sport = sportOf(league);
  // A team sport's (a field's or a card's season is each event an episode: not a slate).
  if (!(sport instanceof TeamSport)) return null;
  for (const p of opts.providers ?? sportsProviders()) {
    const calendar = await p.calendar(league);
    if (!calendar) continue;
    const cadences = cadencesOf(calendar, sport.lock);
    const stages = (["regular", "post"] as SlateStage[]).filter((s) => calendar.stages.some((x) => slateStageOf(x) === s)).map((stage) => ({ stage, cadences }));
    return { provider: p, calendar, stages };
  }
  return null;
}

/** The stage a slate is unless asked: the playoffs while the calendar's in them, else the regular season. */
function usualStage(calendar: LeagueCalendar): SlateStage {
  const now = calendar.stages.find((s) => s.type === calendar.now);
  return now && slateStageOf(now) === "post" ? "post" : "regular";
}

/** A stage's fixtures, month by month (a round needs every one): its own, between two teams. */
async function fixturesOf(p: SportsProvider, league: string, calendar: LeagueCalendar, stage: SlateStage): Promise<SportsEvent[]> {
  const bounds = stageDays(calendar, stage)!;
  const months = await Promise.all(monthsOf(bounds.from, bounds.to).map((m) => p.eventsIn(league, m)));
  return months.flat().filter((e) => inStage(e, stage) && teamsOf(e).length >= 2);
}

/**
 * A league's slate, made (or found) as a season of its league's show: `stage` (the regular season unless the calendar's in the
 * playoffs now) and `cadence` (the league's usual unless said). Null for a league with no slate (no such league, not a team sport).
 * SlateRefused for one it can't be cut into. `beforeMake` runs when it isn't made yet, before it's made (a person's day's cap:
 * finding one is free). `prefix` keeps a check's rows apart ("zt-"); `cast: false` leaves the people for later; `providers` and
 * `now` are for checks.
 */
export async function makeSlate(opts: {
  league: string;
  stage?: SlateStage;
  cadence?: Cadence;
  userId?: string | null;
  providers?: SportsProvider[];
  now?: Date;
  prefix?: string;
  cast?: boolean;
  beforeMake?: () => Promise<void>;
}): Promise<Slate | null> {
  const now = opts.now ?? new Date();
  const choices = await slateChoices(opts.league, opts);
  if (!choices) return null;
  const { provider: p, calendar } = choices;
  const stage = opts.stage ?? usualStage(calendar);
  const choice = choices.stages.find((s) => s.stage === stage);
  if (!choice) throw new SlateRefused(stage === "post" ? "Its playoffs aren't listed yet" : "Its season isn't listed yet");
  const cadence = opts.cadence ?? choice.cadences[0];
  if (!choice.cadences.includes(cadence)) throw new SlateRefused(`It goes by ${choice.cadences.join(" or ")}, not by ${cadence}`);
  const key = `${opts.prefix ?? ""}${slateKey(p.id, opts.league, calendar.season, stage, cadence)}`;
  const found = await foundSlate(key);
  if (found) return found;
  await opts.beforeMake?.();

  // A round needs every fixture (a month's scoreboard each); a day's or a week's games are linked as they near.
  const fixtures = cadence === "round" ? await fixturesOf(p, opts.league, calendar, stage) : [];
  const eps = slateEpisodes(calendar, stage, cadence, fixtures.map(slateGame));
  if (!eps.length) throw new SlateRefused("It has no games listed yet");
  if (fixtures.length) await storeEvents(p.id, opts.league, fixtures);
  const named = calendar.leagueName ?? fixtures.map((e) => e.leagueName).find(Boolean) ?? null;
  const name = slateName(leagueName(opts.league, named), calendar, stage, cadence, choice.cadences[0]).slice(0, 120);
  const runtime = sportOf(opts.league)?.runtime ?? null;

  const c = await pool.connect();
  let seasonId: string;
  try {
    await c.query("BEGIN");
    const showId = await leagueShow(c, p.id, opts.league, opts.prefix ?? "", opts.userId ?? null, named);
    await c.query("SELECT id FROM shows WHERE id = $1 FOR UPDATE", [showId]);
    const { rows: n } = await c.query("SELECT COALESCE(max(season_number), 0) + 1 AS n FROM show_seasons WHERE show_id = $1", [showId]);
    const { rows: s } = await c.query(
      `INSERT INTO show_seasons (show_id, season_number, name, status, premiere_date, finale_date, episode_count) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [showId, n[0].n, name, statusOf(eps, now), eps[0].from, eps[eps.length - 1].to, eps.length]
    );
    seasonId = s[0].id as string;
    const byId = new Map(fixtures.map((e) => [e.id, e]));
    await c.query(
      `INSERT INTO season_episodes (season_id, number, air_at, title, note, source, runtime_min)
       SELECT $1, r.n, r.at, r.title, r.note, 'listing', $3 FROM jsonb_to_recordset($2::jsonb) AS r(n int, at timestamptz, title text, note text)`,
      [seasonId, JSON.stringify(eps.map((e) => ({ n: e.n, at: airOf(e, byId), title: e.label.slice(0, 200), note: e.detail?.slice(0, 200) ?? null }))), runtime]
    );
    await insertLinks(c, seasonId, p.id, opts.league, eps.flatMap((e) => e.games.map((id) => ({ episode: e.n, event: byId.get(id)! }))));
    // Linked by the slate itself (syncSlate): the listings' linking (season.ts) leaves it be, as it does a matchup.
    await c.query(`INSERT INTO sports_links (season_id, provider, league, linked, message, checked_at, next_at) VALUES ($1, $2, $3, $4, NULL, now(), $5)`, [
      seasonId,
      p.id,
      opts.league,
      eps.reduce((n, e) => n + e.games.length, 0),
      new Date(Date.parse(`${eps[eps.length - 1].to}T12:00:00Z`) + 30 * 86_400_000),
    ]);
    const { rowCount } = await c.query(
      `INSERT INTO sports_slates (season_id, provider, league, season, stage, cadence, windows, key, made_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (key) DO NOTHING`,
      [seasonId, p.id, opts.league, calendar.season, stage, cadence, JSON.stringify(eps.map((e) => [e.from, e.to])), key, opts.userId ?? null]
    );
    if (!rowCount) {
      // Someone asked for the same slate a moment ago: theirs.
      await c.query("ROLLBACK");
      return (await foundSlate(key))!;
    }
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
  // The games near now (a day's or a week's: a round's are in already), then its people after the answer.
  let games = eps.reduce((n, e) => n + e.games.length, 0);
  if (cadence !== "round") {
    try {
      games = (await syncSlate(seasonId, { providers: [p], now, cast: false })).linked;
    } catch (e) {
      // ESPN not answering leaves them to the daily job.
      if (!(e instanceof SportsUnavailable)) throw e;
    }
  }
  if (opts.cast !== false) await fillLater(seasonId, () => castFromEvents(seasonId, { providers: opts.providers, held: true }), opts.userId ?? null);
  return { seasonId, made: true, name, league: opts.league, stage, cadence, episodes: eps.length, games };
}

/** The slate made for this key, as made (its games linked so far). */
async function foundSlate(key: string): Promise<Slate | null> {
  const { rows } = await pool.query(
    `SELECT x.season_id, x.league, x.stage, x.cadence, ss.name, ss.episode_count, (SELECT count(*)::int FROM season_events e WHERE e.season_id = x.season_id) AS games
       FROM sports_slates x JOIN show_seasons ss ON ss.id = x.season_id WHERE x.key = $1`,
    [key]
  );
  const r = rows[0];
  return r ? { seasonId: r.season_id, made: false, name: r.name ?? "", league: r.league, stage: r.stage, cadence: r.cadence, episodes: r.episode_count, games: r.games } : null;
}

/** One of a league's slates: a stage cut one way, as it would be made (or as it was made). */
export interface SlateOption {
  stage: SlateStage;
  cadence: Cadence;
  /** What an add that names no cadence makes for its stage (the league's usual: football's weeks, a daily sport's Monday-to-Sunday
   *  weeks, soccer's rounds). */
  usual: boolean;
  /** Its season's name as made, else as it would be ("NFL 2026", "NBA 2026-27, day by day", "NBA 2026-27 playoffs"). */
  name: string;
  /** Its episodes: made, as many as it has now (the playoffs' grow as they're listed); else as many as it would have, 0 when its
   *  stage lists none yet (an add is refused); null when they can't be worked out now (a round's fixtures, the provider not
   *  answering). */
  episodes: number | null;
  /** The season made for it, if one is (adding it is then free, and follows it). */
  seasonId: string | null;
}

/** What a league's slate can be (GET /api/sports/league): its season now, its stages, each cut each way it can be. */
export interface LeagueSlates {
  league: string;
  /** As its show is named ("NFL", "Premier League"). */
  leagueName: string;
  /** A slate can be made of it: a team sport's league. A tour's or a promotion's season (golf's, F1's, the UFC's) is an event an
   *  episode, not a slate: none, and no stages. */
  slate: boolean;
  /** Its season now: ESPN's year ("2027" for the NBA's 2026-27) and as people say it ("2026-27"). */
  season: { year: number; words: string } | null;
  /** What an add that names no stage or cadence makes; null when that stage isn't listed yet. */
  usual: { stage: SlateStage; cadence: Cadence } | null;
  /** Its stages (the regular season, a soccer league's whole season; the playoffs), each with its days (the East's) and whether
   *  they're past, now or coming. */
  stages: { stage: SlateStage; from: string; to: string; state: "past" | "now" | "coming"; slates: SlateOption[] }[];
}

/**
 * What a league's slate can be: its season now (ESPN's calendar: cached a day), its stages and the ways each is cut, each named,
 * with its episodes and the season already made for it. Null for a league the app doesn't read, or one the provider has no season
 * for. A round's episodes need its fixtures (a month's scoreboard each, cached), read only for a slate not made yet. `prefix`
 * reads a check's own slates; `providers` and `now` are for checks.
 */
export async function leagueSlates(league: string, opts: { providers?: SportsProvider[]; now?: Date; prefix?: string } = {}): Promise<LeagueSlates | null> {
  const sport = sportOf(league);
  if (!sport) return null;
  if (!(sport instanceof TeamSport)) return { league, leagueName: leagueName(league), slate: false, season: null, usual: null, stages: [] };
  const choices = await slateChoices(league, opts);
  if (!choices) return null;
  const { provider: p, calendar } = choices;
  const prefix = opts.prefix ?? "";
  const keyOf = (stage: SlateStage, cadence: Cadence) => `${prefix}${slateKey(p.id, league, calendar.season, stage, cadence)}`;
  const keys = choices.stages.flatMap((s) => s.cadences.map((c) => keyOf(s.stage, c)));
  const { rows } = await pool.query("SELECT x.key, x.season_id, ss.episode_count, ss.name FROM sports_slates x JOIN show_seasons ss ON ss.id = x.season_id WHERE x.key = ANY($1::text[])", [keys]);
  const made = new Map(rows.map((r) => [r.key as string, { seasonId: r.season_id as string, episodes: r.episode_count as number, name: r.name as string | null }]));
  // A round's fixtures, each stage's at once, for a round slate not made yet (null: the provider didn't answer).
  const fixtures = await Promise.all(
    choices.stages.map(async ({ stage, cadences }) => {
      if (!cadences.includes("round") || made.has(keyOf(stage, "round"))) return [];
      try {
        return await fixturesOf(p, league, calendar, stage);
      } catch (e) {
        if (!(e instanceof SportsUnavailable)) throw e;
        return null;
      }
    })
  );
  // As makeSlate names it: the calendar's name for the league, else its fixtures'.
  const named = leagueName(league, calendar.leagueName ?? fixtures.flatMap((f) => f ?? []).map((e) => e.leagueName).find(Boolean) ?? null);
  const today = easternDay(opts.now ?? new Date());
  const stages: LeagueSlates["stages"] = choices.stages.map(({ stage, cadences }, s) => {
    const bounds = stageDays(calendar, stage)!;
    const games = fixtures[s];
    const slates = cadences.map((cadence, i): SlateOption => {
      const was = made.get(keyOf(stage, cadence));
      const episodes = was ? was.episodes : cadence === "round" && !games ? null : slateEpisodes(calendar, stage, cadence, cadence === "round" ? games!.map(slateGame) : []).length;
      return { stage, cadence, usual: i === 0, name: was?.name || slateName(named, calendar, stage, cadence, cadences[0]).slice(0, 120), episodes, seasonId: was?.seasonId ?? null };
    });
    return { stage, from: bounds.from, to: bounds.to, state: today > bounds.to ? "past" : today < bounds.from ? "coming" : "now", slates };
  });
  const usual = usualStage(calendar);
  const usualCadence = choices.stages.find((s) => s.stage === usual)?.cadences[0];
  return {
    league,
    leagueName: named,
    slate: true,
    season: { year: calendar.season, words: seasonWords(calendar) },
    usual: usualCadence ? { stage: usual, cadence: usualCadence } : null,
    stages,
  };
}

/** An event in the slate's stage (a soccer league's events say none: its whole season; so does the NBA's play-in, on days past its
 *  regular season's, so never one of its episodes). */
const inStage = (e: SportsEvent, stage: SlateStage) => (e.stage ?? "regular") === stage;
const teamsOf = (e: SportsEvent) => e.competitors.map((x) => x.team).filter((t): t is NonNullable<typeof t> => !!t);
const slateGame = (e: SportsEvent): SlateGame => ({ id: e.id, at: e.at, teams: teamsOf(e).map((t) => t.id) });

/** An episode's air time: its first game's start, else its first day's start in the East (before any game of it: a lock never
 *  late), until its games are linked. */
function airOf(e: Pick<SlateEpisode, "from" | "games">, byId: Map<string, { at: string | null }>): string {
  const starts = e.games.map((id) => byId.get(id)?.at).filter((x): x is string => !!x).sort();
  return starts[0] ?? (Air.zonedToUtc(e.from, "00:00", ZONE) as Date).toISOString();
}

/** A season's status from its windows: upcoming before its first day, completed after its last, else airing. */
function statusOf(eps: { from: string; to: string }[], now: Date): string {
  const today = easternDay(now);
  return today < eps[0].from ? "upcoming" : today > eps[eps.length - 1].to ? "completed" : "airing";
}

async function insertLinks(db: Queryable, seasonId: string, provider: string, league: string, links: { episode: number; event: SportsEvent }[]) {
  if (!links.length) return;
  const rows = links.map(({ episode, event: e }) => {
    const sides = teamsOf(e);
    return { n: episode, id: e.id, title: e.name.slice(0, 200) || null, at: e.at, teams: sides.map((t) => ({ id: t.id, name: t.name })) };
  });
  await db.query(
    `INSERT INTO season_events (season_id, episode, provider, league, event_id, part, name, starts_at, teams)
     SELECT $1, r.n, $2, $3, r.id, NULL, r.title, r.at, r.teams FROM jsonb_to_recordset($4::jsonb) AS r(n int, id text, title text, at timestamptz, teams jsonb)
     ON CONFLICT DO NOTHING`,
    [seasonId, provider, league, JSON.stringify(rows)]
  );
}

/** The days from `from` to `to` ("YYYY-MM-DD", both in). */
function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = Air.addDays(d, 1) as string) out.push(d);
  return out;
}

export interface SlateSync {
  /** Its games linked now. */
  linked: number;
  added: number;
  moved: number;
  /** Episodes added after its last (a stage whose games are listed as it goes: the playoffs). */
  appended: number;
  /** Games on a day no episode holds (before its first). */
  outside: number;
}

/**
 * Link a slate's games on the days from three back to eight ahead (`days` says others: a check's), from each day's scoreboard: a
 * game not linked yet to the episode its day is in, one linked to another episode (moved to another day) moved to its own, and
 * each episode's air time its first game's start. A day past the last episode's adds episodes after it, for a day's or a week's
 * slate and a round's (the playoffs, listed as they go; a soccer league's fixture moved past its last round). Its people are added
 * to (the new teams' rosters: cast.ts only adds) unless `cast` is false.
 */
export async function syncSlate(seasonId: string, opts: { providers?: SportsProvider[]; now?: Date; days?: string[]; cast?: boolean } = {}): Promise<SlateSync> {
  const now = opts.now ?? new Date();
  const { rows } = await pool.query("SELECT provider, league, stage, cadence, windows FROM sports_slates WHERE season_id = $1", [seasonId]);
  const slate = rows[0];
  if (!slate) throw new Error(`No slate ${seasonId}`);
  const p = (opts.providers ?? sportsProviders()).find((x) => x.id === slate.provider);
  const out: SlateSync = { linked: 0, added: 0, moved: 0, appended: 0, outside: 0 };
  if (!p) return out;
  const read = (slate.windows as [string, string][]).map(([from, to]) => ({ from, to }));
  // Its days in the window (a regular season's to its last: the playoffs' days aren't its; the playoffs' on, listed as they go).
  const days = (opts.days ?? daysBetween(easternDay(now, -BACK_DAYS), easternDay(now, AHEAD_DAYS))).filter((d) => d >= read[0].from && (slate.stage === "post" || d <= read[read.length - 1].to));
  const events: SportsEvent[] = [];
  for (const day of days) events.push(...(await p.eventsOn(slate.league, day)).filter((e) => inStage(e, slate.stage) && teamsOf(e).length >= 2 && e.at && dayOf(e.at) === day));
  const place: { episode: number; event: SportsEvent }[] = [];
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    // Its windows and links as they are under the lock (two syncs at once: the second places on the first's).
    const { rows: locked } = await c.query("SELECT windows FROM sports_slates WHERE season_id = $1 FOR UPDATE", [seasonId]);
    const windows = (locked[0].windows as [string, string][]).map(([from, to], i) => ({ n: i + 1, from, to }));
    const { rows: had } = await c.query("SELECT episode, event_id FROM season_events WHERE season_id = $1 AND event_id = ANY($2::text[])", [seasonId, events.map((e) => e.id)]);
    const linkedTo = new Map(had.map((r) => [r.event_id as string, r.episode as number]));
    const first = windows.length;
    for (const e of events.sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""))) {
      const day = dayOf(e.at!);
      let n = episodeFor(windows, day);
      if (n === null && slate.stage === "post" && day > windows[windows.length - 1].to) {
        // The playoffs, listed as they go: episodes after the last, to this day's (a week's to its Sunday). A regular season's
        // last episode reaches its stage's last day, so a game past it isn't its (the NBA's play-in).
        const last = windows[windows.length - 1];
        const to = slate.cadence === "week" ? (Air.addDays(mondayOf(day), 6) as string) : day;
        windows.push({ n: windows.length + 1, from: Air.addDays(last.to, 1) as string, to });
        n = windows.length;
      }
      if (n === null) {
        out.outside++;
        continue;
      }
      const was = linkedTo.get(e.id);
      if (was === n) {
        // Its name, start and sides as listed now (a playoff game's sides once they're set).
        const sides = teamsOf(e).map((t) => ({ id: t.id, name: t.name }));
        await c.query("UPDATE season_events SET name = $3, starts_at = $4, teams = $5 WHERE season_id = $1 AND event_id = $2", [seasonId, e.id, e.name.slice(0, 200) || null, e.at, JSON.stringify(sides)]);
        continue;
      }
      if (was !== undefined) {
        await c.query("DELETE FROM season_events WHERE season_id = $1 AND event_id = $2", [seasonId, e.id]);
        out.moved++;
      } else out.added++;
      place.push({ episode: n, event: e });
    }
    // The episodes after the last, named as the slate names them.
    if (windows.length > first) {
      const extra = windows.slice(first).map((w) => ({ n: w.n, at: (Air.zonedToUtc(w.from, "00:00", ZONE) as Date).toISOString(), title: episodeLabel(slate.cadence, w.n, slate.cadence === "day" ? w.to : w.from), note: slate.cadence === "day" ? null : spanWords(w.from, w.to) }));
      await c.query(
        `INSERT INTO season_episodes (season_id, number, air_at, title, note, source, runtime_min)
         SELECT $1, r.n, r.at, r.title, r.note, 'listing', $3 FROM jsonb_to_recordset($2::jsonb) AS r(n int, at timestamptz, title text, note text)`,
        [seasonId, JSON.stringify(extra), sportOf(slate.league)?.runtime ?? null]
      );
      await c.query("UPDATE show_seasons SET episode_count = $2, finale_date = $3, updated_at = now() WHERE id = $1", [seasonId, windows.length, windows[windows.length - 1].to]);
      out.appended = windows.length - first;
    }
    await insertLinks(c, seasonId, p.id, slate.league, place);
    // Each touched episode's air time: its first game's start (a week's lock, the guide's time).
    const touched = [...new Set([...place.map((x) => x.episode), ...events.map((e) => linkedTo.get(e.id)).filter((x): x is number => x !== undefined)])];
    if (touched.length) {
      await c.query(
        `UPDATE season_episodes ep SET air_at = x.first, updated_at = now()
           FROM (SELECT episode, min(starts_at) AS first FROM season_events WHERE season_id = $1 AND episode = ANY($2::int[]) GROUP BY episode) x
          WHERE ep.season_id = $1 AND ep.number = x.episode AND x.first IS NOT NULL AND ep.air_at IS DISTINCT FROM x.first`,
        [seasonId, touched]
      );
    }
    const { rows: count } = await c.query("SELECT count(*)::int AS n FROM season_events WHERE season_id = $1", [seasonId]);
    out.linked = count[0].n;
    await c.query("UPDATE sports_slates SET windows = $2, synced_at = now() WHERE season_id = $1", [seasonId, JSON.stringify(windows.map((w) => [w.from, w.to]))]);
    await c.query("UPDATE sports_links SET linked = $2, checked_at = now() WHERE season_id = $1", [seasonId, out.linked]);
    // Its status from its days, completed only once every game it links is over.
    const status = statusOf(windows, now);
    await c.query(
      `UPDATE show_seasons SET status = CASE WHEN $2 = 'completed' AND EXISTS (SELECT 1 FROM season_events e LEFT JOIN sports_events f ON f.provider = e.provider AND f.league = e.league AND f.event_id = e.event_id
                                                                               WHERE e.season_id = $1 AND COALESCE(f.state, 'pre') <> 'post') THEN 'airing' ELSE $2 END, updated_at = now()
        WHERE id = $1`,
      [seasonId, status]
    );
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
  await storeEvents(p.id, slate.league, events);
  // A linked team with nobody in yet (new to it, or a fill before that didn't finish): its roster, after the answer (cast.ts only
  // adds).
  if (opts.cast !== false && (await teamsWithNobody(seasonId)) > 0) await fillLater(seasonId, () => castFromEvents(seasonId, { providers: opts.providers, held: true }));
  return out;
}

/** Linked teams with nobody of theirs in the season's people yet (a team's group is its name: cast.ts). */
async function teamsWithNobody(seasonId: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT count(DISTINCT t->>'name')::int AS n FROM season_events e, jsonb_array_elements(e.teams) t
      WHERE e.season_id = $1 AND NOT EXISTS (SELECT 1 FROM season_cast c WHERE c.season_id = $1 AND c.tribe_name = left(t->>'name', 60))`,
    [seasonId]
  );
  return rows[0].n as number;
}

/**
 * The daily listings job's part (run first by refreshSportsEvents, so the games it links have their facts kept in the same run):
 * every slate whose windows reach from three days back to eight ahead, synced. `only` (a check's seasons) looks at just those.
 */
export async function syncSlates(opts: { providers?: SportsProvider[]; now?: Date; only?: string[] } = {}): Promise<{ slates: number; added: number; errors: string[] }> {
  const now = opts.now ?? new Date();
  const { rows } = await pool.query(
    `SELECT x.season_id FROM sports_slates x JOIN show_seasons ss ON ss.id = x.season_id
      WHERE ($3::uuid[] IS NULL OR x.season_id = ANY($3::uuid[]))
        AND (x.windows->0->>0) <= $2 AND (x.windows->-1->>1) >= $1`,
    // A fortnight past its last day: the playoffs' next round, listed after a few days off.
    [easternDay(now, -14), easternDay(now, AHEAD_DAYS), opts.only ?? null]
  );
  let added = 0;
  const errors: string[] = [];
  for (const r of rows) {
    try {
      added += (await syncSlate(r.season_id, { providers: opts.providers, now })).added;
    } catch (e) {
      errors.push(`slate ${r.season_id}: ${(e as Error).message.slice(0, 160)}`);
    }
  }
  return { slates: rows.length, added, errors };
}
