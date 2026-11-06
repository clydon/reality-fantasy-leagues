import { easternDay } from "@/lib/game/tv-listings";
import { slugOf } from "@/lib/game/listing";
import { factsOf, leagueName, matchupKey, matchupName, matchupStatus, pickMatchup, type MatchupAsk } from "@/lib/sports/matchup";
import { TeamSport, sportOf } from "@/lib/sports";
import { pool } from "../db";
import { castFromEvents } from "./cast";
import { sportsProviders } from "./index";
import { saveFinals } from "./finals";
import { fillLater } from "./season";
import { SportsUnavailable, type LeagueName, type SportsEvent, type SportsProvider } from "./types";

// Games straight from a team's schedule, as a season of their own (docs/PLAN-start-a-game-gpt.md track L, L1 part 3;
// db/migrations/0300). A matchup (one game, a series, a team's next few: src/lib/sports/matchup.ts picks them) is a season of
// its league's show ("NBA", made once: shows.sports_league), keyed by its games (sports_matchups.key), so everyone who asks
// for the same games shares it. Its episodes are the games, each linked to its event at once (season_events, with
// sports_links saying so, so the daily job's linking leaves it be); its people are the teams' rosters (cast.ts, after the
// answer); its stats the games' box scores (stats.ts), as for any linked season.
//
// Each game's facts are kept per event (sports_events), shared by every season that links it: its sides and, once it's over,
// its final; its line before it (the over/under's default), from the day's scoreboard while it's still to play and kept once it
// starts, or for a game seen only after, from its summary. Made here for a matchup's games, and by the daily listings job
// (refreshSportsEvents) for every linked game from three days back to a week ahead; a team game's counts once it's final (L3
// part 1: finals.ts). ESPN is asked as little as can be: a
// team's schedule, a scoreboard per day with a game still to play, a summary per finished game with no line yet, all cached
// (cache.ts); never ChatGPT.

type Queryable = { query: typeof pool.query };

/** Days of scoreboards one refresh reads, at most. */
const MAX_DAYS = 40;
/** A game's line is looked for once it's this close (books post them a day to a week ahead); the daily job looks as it nears. */
const WEEK_MS = 8 * 86_400_000;

export interface Matchup {
  seasonId: string;
  /** Made just now (else someone had asked for these games before). */
  made: boolean;
  name: string;
  /** Its games, by the provider's ids, in order (episode 1 first). */
  games: string[];
}

/**
 * The games `ask` means from `team`'s schedule in `league`, made (or found) as their matchup's season. Null when the provider
 * has no such team or nothing fits. `season` and `type` pick the schedule (the provider's year and stage; else now's). `prefix`
 * keeps a check's rows apart ("zt-"); `cast: false` leaves the people for later; `providers` and `now` are for checks.
 */
export async function makeMatchup(opts: {
  league: string;
  team: string;
  ask: MatchupAsk;
  season?: number;
  type?: number;
  userId?: string | null;
  providers?: SportsProvider[];
  now?: Date;
  prefix?: string;
  cast?: boolean;
}): Promise<Matchup | null> {
  const providers = opts.providers ?? sportsProviders();
  for (const p of providers) {
    const schedule = await p.schedule(opts.league, opts.team, { season: opts.season, type: opts.type });
    if (!schedule) continue;
    const games = pickMatchup(opts.team, schedule, opts.ask) as SportsEvent[];
    if (!games.length) return null;
    return matchupSeason(p, opts.league, games, { ...opts, providers, name: matchupName(games, opts.team) });
  }
  return null;
}

/**
 * These games' season: the one already made for them (by their key), else a new season of the league's show with an episode
 * per game, each linked to its event; their facts kept either way. `name` names a new one (matchupName's, by default). `key`
 * keys it otherwise than by its games (L7: a team's season, matchup.ts seasonKey). `pastLines: false` leaves a game already
 * played without its line (L7: a team's season added mid-season, whose played games nobody can answer for, never asks a
 * summary each).
 */
export async function matchupSeason(
  provider: SportsProvider,
  league: string,
  games: SportsEvent[],
  opts: { name?: string; key?: string; pastLines?: boolean; userId?: string | null; providers?: SportsProvider[]; now?: Date; prefix?: string; cast?: boolean } = {}
): Promise<Matchup> {
  const now = opts.now ?? new Date();
  const sorted = [...games].sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));
  const ids = sorted.map((g) => g.id);
  const key = `${opts.prefix ?? ""}${opts.key ?? matchupKey(provider.id, league, ids)}`;
  // Their lines first (outside the transaction: these may ask the provider), and the league's name a day's scoreboard gave.
  const lined = await withOdds(provider, league, sorted, now.getTime(), pool, opts.pastLines !== false);
  await storeEvents(provider.id, league, lined);
  // Found: its games as made (a team's season keyed by the team keeps the games listed when it was made).
  const found = await pool.query("SELECT m.season_id, m.events, ss.name FROM sports_matchups m JOIN show_seasons ss ON ss.id = m.season_id WHERE m.key = $1", [key]);
  if (found.rows[0]) return { seasonId: found.rows[0].season_id, made: false, name: found.rows[0].name ?? "", games: found.rows[0].events };

  const name = (opts.name ?? matchupName(sorted)).slice(0, 120);
  const c = await pool.connect();
  let seasonId: string;
  try {
    await c.query("BEGIN");
    const showId = await leagueShow(c, provider.id, league, opts.prefix ?? "", opts.userId ?? null, lined.map((g) => g.leagueName).find(Boolean) ?? null);
    await c.query("SELECT id FROM shows WHERE id = $1 FOR UPDATE", [showId]);
    const { rows: n } = await c.query("SELECT COALESCE(max(season_number), 0) + 1 AS n FROM show_seasons WHERE show_id = $1", [showId]);
    const dates = sorted.map((g) => g.at).filter((x): x is string => !!x);
    // As many episodes as games (the guide never invents one after the last: schedule.ts), each the sport's usual length.
    const { rows: s } = await c.query(
      `INSERT INTO show_seasons (show_id, season_number, name, status, premiere_date, finale_date, episode_count) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [showId, n[0].n, name, matchupStatus(sorted, now.getTime()), dates[0] ? easternDay(new Date(dates[0])) : null, dates.length ? easternDay(new Date(dates[dates.length - 1])) : null, sorted.length]
    );
    seasonId = s[0].id as string;
    const runtime = sportOf(league)?.runtime ?? null;
    // Every episode and its link at once (a team's season is up to 200 games).
    const rows = sorted.map((g, i) => {
      const sides = g.competitors.map((x) => x.team).filter((t) => !!t);
      return { n: i + 1, at: g.at, title: g.name.slice(0, 200) || null, note: g.note?.slice(0, 200) ?? null, id: g.id, teams: sides.length >= 2 ? sides.map((t) => ({ id: t!.id, name: t!.name })) : null };
    });
    await c.query(
      `INSERT INTO season_episodes (season_id, number, air_at, title, note, source, runtime_min)
       SELECT $1, r.n, r.at, r.title, r.note, 'listing', $3 FROM jsonb_to_recordset($2::jsonb) AS r(n int, at timestamptz, title text, note text)`,
      [seasonId, JSON.stringify(rows), runtime]
    );
    await c.query(
      `INSERT INTO season_events (season_id, episode, provider, league, event_id, part, name, starts_at, teams)
       SELECT $1, r.n, $2, $3, r.id, NULL, r.title, r.at, r.teams FROM jsonb_to_recordset($4::jsonb) AS r(n int, at timestamptz, title text, id text, teams jsonb)`,
      [seasonId, provider.id, league, JSON.stringify(rows)]
    );
    // Every episode linked already: the daily job's linking (season.ts) has nothing to look for (it looks only at seasons with
    // an episode still to link); its next look, a month after the last game, is only for show.
    const last = dates.length ? Date.parse(dates[dates.length - 1]) : now.getTime();
    await c.query(`INSERT INTO sports_links (season_id, provider, league, linked, message, checked_at, next_at) VALUES ($1, $2, $3, $4, NULL, now(), $5)`, [seasonId, provider.id, league, sorted.length, new Date(last + 30 * 86_400_000)]);
    const { rowCount } = await c.query(
      `INSERT INTO sports_matchups (season_id, provider, league, events, key, made_by) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (key) DO NOTHING`,
      [seasonId, provider.id, league, ids, key, opts.userId ?? null]
    );
    if (!rowCount) {
      // Someone asked for the same games a moment ago: theirs.
      await c.query("ROLLBACK");
      const again = await pool.query("SELECT m.season_id, m.events, ss.name FROM sports_matchups m JOIN show_seasons ss ON ss.id = m.season_id WHERE m.key = $1", [key]);
      return { seasonId: again.rows[0].season_id, made: false, name: again.rows[0].name ?? "", games: again.rows[0].events };
    }
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
  // Its people: the teams' rosters, after the answer (or now, outside a request).
  if (opts.cast !== false) await fillLater(seasonId, () => castFromEvents(seasonId, { providers: opts.providers, held: true }), opts.userId ?? null);
  return { seasonId, made: true, name, games: ids };
}

/** The league's show (made once, "Not a game yet" until someone makes it one, as a show added from its listing is). */
async function leagueShow(db: Queryable, provider: string, league: string, prefix: string, userId: string | null, named: LeagueName | null): Promise<string> {
  const tag = `${prefix}${provider}:${league}`;
  const { rows } = await db.query("SELECT id FROM shows WHERE sports_league = $1", [tag]);
  if (rows[0]) return rows[0].id as string;
  const name = leagueName(league, named);
  const base = `${prefix}${slugOf(name)}`;
  const { rows: taken } = await db.query("SELECT slug FROM shows WHERE slug = $1 OR slug LIKE $2", [base, `${base}-%`]);
  const slugs = new Set(taken.map((r) => r.slug as string));
  let slug = base;
  for (let n = 2; slugs.has(slug); n++) slug = `${base}-${n}`;
  const { rows: made } = await db.query(
    `INSERT INTO shows (slug, name, castaway_term, tribe_term, episode_term, kind, created_by, set_up_at, sports_league)
     VALUES ($1, $2, 'Player', 'Team', 'Game', 'sport', $3, NULL, $4) ON CONFLICT DO NOTHING RETURNING id`,
    [slug, name, userId, tag]
  );
  if (made[0]) return made[0].id as string;
  const { rows: again } = await db.query("SELECT id FROM shows WHERE sports_league = $1", [tag]);
  if (!again[0]) throw new Error(`Couldn't make the show for ${league}`);
  return again[0].id as string;
}

/**
 * The games with their lines, as far as the provider has them: a game still to play within the week from its day's scoreboard
 * (the schedule has none; a game further off has none posted yet, and the daily job looks once it's within the week), a finished
 * one from its summary (ESPN's pickcenter: the box score stats.ts reads, cached for good), skipped for a game whose line is
 * already kept (`past` false: never a finished one's). A line is only a default: the provider not answering leaves it out, never
 * the game.
 */
async function withOdds(p: SportsProvider, league: string, games: SportsEvent[], now: number, db: Queryable = pool, past = true): Promise<SportsEvent[]> {
  const { rows } = await db.query("SELECT event_id FROM sports_events WHERE provider = $1 AND league = $2 AND event_id = ANY($3::text[]) AND odds IS NOT NULL", [p.id, league, games.map((g) => g.id)]);
  const have = new Set(rows.map((r) => r.event_id as string));
  const out: SportsEvent[] = [];
  for (let g of games) {
    let odds = g.odds;
    try {
      if (odds || have.has(g.id) || !g.at) odds = g.odds;
      else if (g.state === "pre" && Date.parse(g.at) <= now + WEEK_MS) {
        const day = (await p.eventsOn(league, easternDay(new Date(g.at)))).find((e) => e.id === g.id);
        odds = day?.odds ?? null;
        // The day's scoreboard names the league too (a team's schedule, in most sports, doesn't).
        if (!g.leagueName && day?.leagueName) g = { ...g, leagueName: day.leagueName };
      }
      // A team game's (a field's or a card's event has no summary, nor a line).
      else if (past && g.final && g.competitors.some((c) => c.team)) odds = (await p.boxScore(league, g.id))?.odds ?? null;
    } catch (e) {
      if (!(e instanceof SportsUnavailable)) throw e;
    }
    out.push(odds === g.odds ? g : { ...g, odds });
  }
  return out;
}

/**
 * Keep these events' facts (sports_events): their sides and state, their final once they're over (never changed after), and
 * their line: taken while the game is still to play, and after only when none was kept.
 */
export async function storeEvents(provider: string, league: string, events: SportsEvent[], db: Queryable = pool): Promise<number> {
  if (!events.length) return 0;
  const rows = events.map((e) => {
    const f = factsOf(e);
    return { event_id: f.event, name: f.name.slice(0, 200) || null, starts_at: f.startsAt, state: f.state, final: f.final, teams: f.sides, odds: f.odds };
  });
  const { rowCount } = await db.query(
    `INSERT INTO sports_events (provider, league, event_id, name, starts_at, state, teams, final, final_at, odds, odds_at)
     SELECT $1, $2, x.event_id, x.name, x.starts_at, x.state, x.teams, x.final, CASE WHEN x.final THEN now() END, x.odds, CASE WHEN x.odds IS NOT NULL THEN now() END
       FROM jsonb_to_recordset($3::jsonb) AS x(event_id TEXT, name TEXT, starts_at TIMESTAMPTZ, state TEXT, teams JSONB, final BOOLEAN, odds JSONB)
     ON CONFLICT (provider, league, event_id) DO UPDATE SET
       name = EXCLUDED.name,
       starts_at = EXCLUDED.starts_at,
       state = CASE WHEN sports_events.final THEN sports_events.state ELSE EXCLUDED.state END,
       teams = CASE WHEN sports_events.final THEN sports_events.teams ELSE EXCLUDED.teams END,
       final = sports_events.final OR EXCLUDED.final,
       final_at = COALESCE(sports_events.final_at, EXCLUDED.final_at),
       odds = CASE WHEN EXCLUDED.odds IS NOT NULL AND (EXCLUDED.state = 'pre' OR sports_events.odds IS NULL) THEN EXCLUDED.odds ELSE sports_events.odds END,
       odds_at = CASE WHEN EXCLUDED.odds IS NOT NULL AND (EXCLUDED.state = 'pre' OR sports_events.odds IS NULL) THEN EXCLUDED.odds_at ELSE sports_events.odds_at END,
       updated_at = now()`,
    [provider, league, JSON.stringify(rows)]
  );
  return rowCount ?? 0;
}

/**
 * The daily listings job's part: every linked game (a matchup's or a TV listing's) from three days back to a week ahead that
 * isn't final yet, read from its day's scoreboard (one per league and day, cached) and kept (storeEvents); then each matchup
 * season's status from its games. A field's or a card's event (golf's tournament, a race weekend, a tennis event, a fight card:
 * L3 part 3) in a league the app reads, from its first day's scoreboard, as stats.ts reads them, for 16 days from its start (a
 * Grand Slam's fortnight), so its final is kept too. `only` (a check's seasons) looks at just those games.
 */
export async function refreshSportsEvents(opts: { providers?: SportsProvider[]; now?: Date; only?: string[] } = {}): Promise<{ days: number; stored: number; finals: number; errors: string[] }> {
  const now = opts.now ?? new Date();
  const providers = opts.providers ?? sportsProviders();
  const { rows } = await pool.query(
    `SELECT DISTINCT e.provider, e.league, e.event_id, e.starts_at, e.teams IS NOT NULL AS linked FROM season_events e
       LEFT JOIN sports_events f ON f.provider = e.provider AND f.league = e.league AND f.event_id = e.event_id
      WHERE e.starts_at IS NOT NULL AND (f.event_id IS NULL OR NOT f.final)
        AND e.starts_at BETWEEN $1::timestamptz - CASE WHEN e.teams IS NOT NULL THEN interval '3 days' ELSE interval '16 days' END AND $1::timestamptz + interval '8 days'
        AND ($2::uuid[] IS NULL OR e.season_id = ANY($2::uuid[]))`,
    [now, opts.only ?? null]
  );
  const days = new Map<string, { provider: string; league: string; day: string; ids: Set<string> }>();
  for (const r of rows) {
    // A link without teams: a field's or a card's event the app reads (a team game's has its teams; anything else isn't read).
    if (!r.linked) {
      const sport = sportOf(r.league as string);
      if (!sport || sport instanceof TeamSport) continue;
    }
    const day = easternDay(r.starts_at as Date);
    const k = `${r.provider}|${r.league}|${day}`;
    if (!days.has(k)) days.set(k, { provider: r.provider, league: r.league, day, ids: new Set() });
    days.get(k)!.ids.add(r.event_id as string);
  }
  let stored = 0;
  const errors: string[] = [];
  // The days past first (their finals), then today's and on.
  for (const d of [...days.values()].sort((a, b) => a.day.localeCompare(b.day)).slice(0, MAX_DAYS)) {
    const p = providers.find((x) => x.id === d.provider);
    if (!p) continue;
    try {
      const events = (await p.eventsOn(d.league, d.day)).filter((e) => d.ids.has(e.id));
      // A game first seen after it started has no line on the scoreboard: its summary's, as a matchup's maker takes it.
      stored += await storeEvents(p.id, d.league, await withOdds(p, d.league, events, now.getTime()));
    } catch (e) {
      errors.push(`${d.league} ${d.day}: ${(e as Error).message.slice(0, 160)}`);
    }
  }
  await pool.query(
    `UPDATE show_seasons ss SET status = x.status, updated_at = now()
       FROM (SELECT m.season_id,
                    CASE WHEN bool_and(COALESCE(f.state = 'post', false)) THEN 'completed'
                         WHEN bool_or(f.state IN ('in', 'post') OR e.starts_at <= $1) THEN 'airing' ELSE 'upcoming' END AS status
               FROM sports_matchups m JOIN season_events e ON e.season_id = m.season_id
               LEFT JOIN sports_events f ON f.provider = e.provider AND f.league = e.league AND f.event_id = e.event_id
              GROUP BY m.season_id) x
      WHERE ss.id = x.season_id AND ss.status IS DISTINCT FROM x.status`,
    [now]
  );
  // L3 parts 1 and 3: the games and events just final, their counts saved with them (finals.ts).
  let finals = 0;
  try {
    const f = await saveFinals({ providers, now, seasons: opts.only });
    finals = f.saved;
    errors.push(...f.errors);
  } catch (e) {
    errors.push(`finals: ${(e as Error).message.slice(0, 160)}`);
  }
  return { days: Math.min(days.size, MAX_DAYS), stored, finals, errors };
}
