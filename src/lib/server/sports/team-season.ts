import { easternDay } from "@/lib/game/tv-listings";
import * as Air from "@/lib/game/air-schedule.js";
import { teamInPlayoffs, type PlayoffGame } from "@/lib/sports/playoffs";
import { dayOf, isExhibition } from "@/lib/sports/slate";
import { sportOf } from "@/lib/sports";
import { pool } from "../db";
import { sportsProviders } from "./index";
import { storeEvents } from "./matchup";
import type { SportsEvent, SportsProvider } from "./types";

// A team's season through the playoffs (docs/PLAN-sports-ready.md step 2.7, part c; db/migrations/0312): a team's season
// (sports_matchups keyed by the team and its year, find.ts addGames { whole: "season" }) holds its regular season's games, its
// regular season's last episode kept (`regular_through`), and takes its playoff games as they're set: each one listed from three
// days back to eight ahead (the daily listings job's window, as a slate's are linked) is linked to a new episode after the last,
// in order. It's over when the team is out (a series or a game lost, the final won, or in no series while a later round is listed
// in full without it: playoffs.ts teamInPlayoffs), stamped `ended_at`; until then its season isn't completed, so a game on it
// through the final (no end of its own) runs on: air-times.ts stampSeasonLast. A game on the regular season ends at its own end,
// whatever's added after it.

/** Days back and ahead a team's playoff games are looked for (the daily listings job's window). */
const BACK_DAYS = 3;
const AHEAD_DAYS = 8;

const teamsOf = (e: SportsEvent) => e.competitors.map((c) => c.team).filter((t): t is NonNullable<typeof t> => !!t);
/** A playoff game as the series read it: its round's note, its series' length, its state and its sides' scores. */
const playoffGame = (e: SportsEvent): PlayoffGame => ({
  id: e.id,
  note: e.note,
  bestOf: e.bestOf ?? null,
  at: e.at,
  status: e.final ? "final" : e.state === "post" ? "off" : e.state === "in" ? "in" : "pre",
  sides: teamsOf(e).map((t, i) => ({ id: t.id, score: Number(e.competitors.filter((c) => c.team)[i]?.score) || 0 })),
});

/** The team and year a team's season's key names ("espn:football/nfl:season:21:2026", a check's under its prefix). */
export function teamOfKey(key: string): { team: string; year: number } | null {
  const m = /:season:([^:]+):(\d{4})$/.exec(key);
  return m ? { team: m[1], year: Number(m[2]) } : null;
}

export interface TeamSeasonGrowth {
  seasons: number;
  /** Playoff games linked. */
  added: number;
  /** Seasons over: the team out, or the champion. */
  ended: number;
  errors: string[];
}

/**
 * The daily listings job's part (refreshSportsEvents, after the slates): every team's season still running whose regular season's
 * last game is a week off or past, its team's playoff games near now linked after its last episode, and its end stamped once the
 * team is out. `only` (a check's seasons) looks at just those.
 */
export async function growTeamSeasons(opts: { providers?: SportsProvider[]; now?: Date; only?: string[] } = {}): Promise<TeamSeasonGrowth> {
  const now = opts.now ?? new Date();
  const providers = opts.providers ?? sportsProviders();
  const out: TeamSeasonGrowth = { seasons: 0, added: 0, ended: 0, errors: [] };
  const { rows } = await pool.query(
    `SELECT m.season_id, m.provider, m.league, m.key, m.events,
            (SELECT max(e.starts_at) FROM season_events e WHERE e.season_id = m.season_id AND e.episode <= m.regular_through) AS regular_last
       FROM sports_matchups m
      WHERE m.regular_through IS NOT NULL AND m.ended_at IS NULL AND ($2::uuid[] IS NULL OR m.season_id = ANY($2::uuid[]))
        AND (SELECT max(e.starts_at) FROM season_events e WHERE e.season_id = m.season_id AND e.episode <= m.regular_through) <= $1::timestamptz + interval '8 days'`,
    [now, opts.only ?? null]
  );
  const days = Array.from({ length: BACK_DAYS + AHEAD_DAYS + 1 }, (_, i) => easternDay(now, i - BACK_DAYS));
  for (const r of rows) {
    const who = teamOfKey(r.key as string);
    const p = providers.find((x) => x.id === r.provider);
    if (!who || !p || !sportOf(r.league as string)) continue;
    out.seasons++;
    try {
      // The league's playoff games near now (each day's scoreboard: cached, the same the slates and the linked games read), from the
      // regular season's last day on.
      const from = r.regular_last ? easternDay(new Date(r.regular_last as Date)) : days[0];
      const league: SportsEvent[] = [];
      for (const day of days.filter((d) => d >= from)) {
        league.push(...(await p.eventsOn(r.league, day)).filter((e) => e.stage === "post" && e.at && dayOf(e.at) === day && teamsOf(e).length >= 2 && !isExhibition(e.note, e.name)));
      }
      const had = new Set<string>(r.events as string[]);
      const mine = league.filter((e) => teamsOf(e).some((t) => t.id === who.team) && !(e.state === "post" && !e.final)).sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));
      const fresh = mine.filter((e) => !had.has(e.id));
      if (fresh.length) out.added += await linkAfter(r.season_id as string, p.id, r.league as string, fresh);
      await storeEvents(p.id, r.league, league);
      // Where it stands: its own playoff games kept so far (their facts as stored) with the league's near now.
      const { rows: kept } = await pool.query(
        `SELECT se.event_id, se.starts_at, se.note, se.best_of, f.state, f.final, f.teams
           FROM sports_matchups m JOIN season_events se ON se.season_id = m.season_id AND se.episode > m.regular_through
           LEFT JOIN sports_events f ON f.provider = se.provider AND f.league = se.league AND f.event_id = se.event_id
          WHERE m.season_id = $1`,
        [r.season_id]
      );
      const games = new Map(league.map((e) => [e.id, playoffGame(e)]));
      for (const k of kept) {
        if (games.has(k.event_id)) continue;
        const sides = ((k.teams ?? []) as { id: string; score?: number | string | null }[]).map((t) => ({ id: String(t.id), score: Number(t.score) || 0 }));
        games.set(k.event_id, { id: k.event_id, note: k.note ?? null, bestOf: k.best_of ?? null, at: k.starts_at ? (k.starts_at as Date).toISOString() : null, status: k.final ? "final" : k.state === "in" ? "in" : "pre", sides });
      }
      const stands = teamInPlayoffs(who.team, [...games.values()]);
      if (stands === "out" || stands === "champion") {
        await pool.query("UPDATE sports_matchups SET ended_at = $2 WHERE season_id = $1 AND ended_at IS NULL", [r.season_id, now]);
        out.ended++;
      }
    } catch (e) {
      out.errors.push(`team season ${r.season_id}: ${(e as Error).message.slice(0, 160)}`);
    }
  }
  return out;
}

/** Link these games (in order) to new episodes after a team's season's last, one each, as its matchup's episodes are. */
async function linkAfter(seasonId: string, provider: string, league: string, games: SportsEvent[]): Promise<number> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const { rows: m } = await c.query("SELECT events FROM sports_matchups WHERE season_id = $1 FOR UPDATE", [seasonId]);
    const had = new Set<string>(m[0]?.events ?? []);
    const add = games.filter((g) => !had.has(g.id));
    if (!add.length) {
      await c.query("ROLLBACK");
      return 0;
    }
    const { rows: n } = await c.query("SELECT COALESCE(max(number), 0) AS n FROM season_episodes WHERE season_id = $1", [seasonId]);
    const first = Number(n[0].n) + 1;
    const rows = add.map((g, i) => {
      const sides = teamsOf(g);
      return { n: first + i, at: g.at, title: g.name.slice(0, 200) || null, note: g.note?.slice(0, 200) ?? null, id: g.id, teams: sides.length >= 2 ? sides.map((t) => ({ id: t.id, name: t.name })) : null, best_of: Number.isInteger(g.bestOf) ? g.bestOf : null };
    });
    await c.query(
      `INSERT INTO season_episodes (season_id, number, air_at, title, note, source, runtime_min)
       SELECT $1, r.n, r.at, r.title, r.note, 'listing', $3 FROM jsonb_to_recordset($2::jsonb) AS r(n int, at timestamptz, title text, note text)`,
      [seasonId, JSON.stringify(rows), sportOf(league)?.runtime ?? null]
    );
    await c.query(
      `INSERT INTO season_events (season_id, episode, provider, league, event_id, part, name, starts_at, teams, note, best_of)
       SELECT $1, r.n, $2, $3, r.id, NULL, r.title, r.at, r.teams, r.note, r.best_of FROM jsonb_to_recordset($4::jsonb) AS r(n int, at timestamptz, title text, id text, teams jsonb, note text, best_of int)
       ON CONFLICT DO NOTHING`,
      [seasonId, provider, league, JSON.stringify(rows)]
    );
    const last = rows[rows.length - 1];
    await c.query("UPDATE sports_matchups SET events = events || $2::text[] WHERE season_id = $1", [seasonId, add.map((g) => g.id)]);
    await c.query(
      "UPDATE show_seasons SET episode_count = $2, finale_date = COALESCE($3::date, finale_date), status = 'airing', updated_at = now() WHERE id = $1",
      [seasonId, last.n, last.at ? (Air.localDate(new Date(last.at), "America/New_York") as string) : null]
    );
    await c.query("UPDATE sports_links SET linked = linked + $2, checked_at = now() WHERE season_id = $1", [seasonId, add.length]);
    await c.query("COMMIT");
    return add.length;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
