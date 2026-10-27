import { after } from "next/server";
import { comingInLabel, comingInSeason, ordinal, type LineTable } from "@/lib/game/sports-stats";
import { easternDay } from "@/lib/game/tv-listings";
import { pool } from "../db";
import { sportsProviders } from "./index";
import { SportsUnavailable, type BoxScore, type SportsEvent, type SportsProvider } from "./types";

// A sport's stats from its linked games (docs/PLAN-sports-data.md step 4; db/migrations/0150): each linked game's lines, once
// it's likely over, from the provider's box score (each player's tables in its own columns), or, for a field's event (a race,
// whose ESPN summary 404s), each one's place in the part its episode shows, from its scoreboard; written per episode to
// game_lines by the provider's id for them (season_cast.provider_ids), and never read again once final. Coming in is each
// player's season line from before these games began (sports-stats.ts comingInSeason: a postseason's own regular season, else
// the season before; the provider's main category only), one call each, a few at a time, at most MAX_COMING_IN a run. The Players tab (rosters.ts) adds them up
// through your mark (sports-stats.ts), so nothing here is a spoiler: it's what the tab may show, not what it does.
//
// It runs from the Players tab's read (rosters.ts), after the answer, when something's due (statsDue): a linked game that's
// likely over and not final yet (read again at most every AGAIN_MS while it isn't), or someone from the sports data with no
// coming in yet. stat_fills holds the season's fill while it runs.

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
/** A fill going longer than this has died. */
const STALE_MS = 6 * MIN;
/** A game's lines are read once it's likely over: this long after it starts. */
const OVER_AFTER_MS = 3 * HOUR;
/** A game that's over but not final yet is read again at most this often. */
const AGAIN_MS = 10 * MIN;
/** A game the provider has no lines for stops being asked about this long after it started. */
const GIVE_UP_MS = 2 * DAY;
/** Coming in: at most this many people's season lines a run (one call each), this many at a time. */
export const MAX_COMING_IN = 60;
const AT_ONCE = 4;

type Queryable = { query: typeof pool.query };

/** Someone's tables in one game. */
export interface PlayerLines {
  athlete: string;
  name: string;
  team: string | null;
  tables: LineTable[];
}

export interface StatsFill {
  /** Games whose lines were read. */
  games: number;
  /** People whose coming in was asked. */
  comingIn: number;
  message: string | null;
  /** Someone else's fill is going. */
  busy?: boolean;
}

/** Each player's lines in a box score, their tables in the provider's order (a two-way player's batting and pitching). */
export function linesOfBox(box: BoxScore): PlayerLines[] {
  const out = new Map<string, PlayerLines>();
  for (const side of box.teams) {
    for (const t of side.tables) {
      for (const r of t.rows) {
        if (!r.person.id) continue;
        let p = out.get(r.person.id);
        if (!p) out.set(r.person.id, (p = { athlete: r.person.id, name: r.person.name, team: side.team.name || null, tables: [] }));
        p.tables.push({ name: t.name, labels: t.labels, values: r.values });
      }
    }
  }
  return [...out.values()];
}

/** A field's event: each one's place in the part its episode shows (`part`; else the event's own field), once that's over. */
export function linesOfField(ev: SportsEvent, part: string | null): { lines: PlayerLines[]; final: boolean } {
  const p = ev.parts.find((x) => x.id === part);
  const field = p ? p.competitors : ev.competitors;
  const over = p ? p.state === "post" : ev.state === "post";
  if (!over) return { lines: [], final: false };
  const lines = field
    .filter((c) => c.person?.id && c.place != null)
    .map((c) => ({ athlete: c.person!.id, name: c.person!.name, team: null, tables: [{ name: null, labels: ["Place"], values: [ordinal(c.place!)] }] }));
  return { lines, final: p ? true : ev.final || ev.state === "post" };
}

/** Whether a season has stats to fill in now, and whether a fill's going. */
export async function statsDue(seasonId: string, db: Queryable = pool): Promise<{ due: boolean; going: boolean }> {
  const { rows } = await db.query(
    `SELECT EXISTS (SELECT 1 FROM season_events e WHERE e.season_id = $1 AND NOT e.lines_final AND e.starts_at <= now() - make_interval(secs => $2)
                     AND (e.lines_at IS NULL OR e.lines_at <= now() - make_interval(secs => $3))) AS games,
            EXISTS (SELECT 1 FROM season_cast c WHERE c.season_id = $1 AND c.provider_ids IS NOT NULL
                     AND NOT EXISTS (SELECT 1 FROM game_lines g WHERE g.season_id = $1 AND g.episode = 0 AND c.provider_ids->>g.provider = g.athlete)) AS coming_in,
            f.asking_at > now() - make_interval(secs => $4) AS going,
            f.message IS NOT NULL AND f.updated_at > now() - interval '1 hour' AS failed
       FROM (SELECT 1) one LEFT JOIN stat_fills f ON f.season_id = $1`,
    [seasonId, OVER_AFTER_MS / 1000, AGAIN_MS / 1000, STALE_MS / 1000]
  );
  const r = rows[0];
  return { due: (r.games || r.coming_in) && !r.going && !r.failed, going: !!r.going };
}

/** Hold the season's stats fill; false when another is going. */
async function holdStats(seasonId: string, db: Queryable = pool): Promise<boolean> {
  const { rowCount } = await db.query(
    `INSERT INTO stat_fills (season_id, asking_at, asked_by, message) VALUES ($1, now(), NULL, NULL)
     ON CONFLICT (season_id) DO UPDATE SET asking_at = now(), asked_by = NULL, message = NULL, updated_at = now()
      WHERE stat_fills.asking_at IS NULL OR stat_fills.asking_at < now() - make_interval(secs => $2)`,
    [seasonId, STALE_MS / 1000]
  );
  return (rowCount ?? 0) > 0;
}

async function releaseStats(seasonId: string, message: string | null, through: number | null) {
  await pool.query("UPDATE stat_fills SET asking_at = NULL, message = $2, through = $3, updated_at = now() WHERE season_id = $1", [seasonId, message, through]);
}

/** Replace an episode's lines with these, read `at`, and say whether they're final. */
async function saveGame(seasonId: string, episode: number, provider: string, lines: PlayerLines[], final: boolean, at: Date) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("DELETE FROM game_lines WHERE season_id = $1 AND episode = $2", [seasonId, episode]);
    if (lines.length) {
      await c.query(
        `INSERT INTO game_lines (season_id, episode, provider, athlete, name, team, tables)
         SELECT $1, $2, $3, x.athlete, left(x.name, 120), left(x.team, 120), x.tables FROM jsonb_to_recordset($4::jsonb) AS x(athlete text, name text, team text, tables jsonb)
         ON CONFLICT DO NOTHING`,
        [seasonId, episode, provider, JSON.stringify(lines)]
      );
    }
    await c.query("UPDATE season_events SET lines_at = $4, lines_final = $3 WHERE season_id = $1 AND episode = $2", [seasonId, episode, final, at]);
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/** `fn` over `items`, `n` at a time; the first error stops the rest from starting and is thrown once the ones going are done. */
async function atOnce<T>(items: T[], n: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  let failed: unknown = null;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (!failed && i < items.length) {
        const item = items[i++];
        try {
          await fn(item);
        } catch (e) {
          failed ??= e;
        }
      }
    })
  );
  if (failed) throw failed;
}

/**
 * Fill in (or add to) a sport's stats from its linked games: each game that's likely over and not final yet, then coming in for
 * whoever from the sports data hasn't got it (at most MAX_COMING_IN). Holds the season's stats fill while it runs, unless the caller
 * already does (`held`), and lets it go. The provider not answering stops it with what it has, said in `message` (the next fill
 * waits an hour). `providers` and `now` are for checks.
 */
export async function statsFromEvents(seasonId: string, opts: { providers?: SportsProvider[]; now?: Date; held?: boolean } = {}): Promise<StatsFill> {
  if (!opts.held && !(await holdStats(seasonId))) return { games: 0, comingIn: 0, message: null, busy: true };
  const now = (opts.now ?? new Date()).getTime();
  const providers = opts.providers ?? sportsProviders();
  const out: StatsFill = { games: 0, comingIn: 0, message: null };
  let through: number | null = null;
  try {
    const { rows } = await pool.query(
      "SELECT episode, provider, league, event_id, part, starts_at, teams, lines_at, lines_final FROM season_events WHERE season_id = $1 ORDER BY episode",
      [seasonId]
    );
    // An episode no longer linked (its listing moved it off its game) has no lines.
    await pool.query("DELETE FROM game_lines WHERE season_id = $1 AND episode > 0 AND NOT (episode = ANY($2::int[]))", [seasonId, rows.map((r) => r.episode)]);
    for (const l of rows) {
      const start = l.starts_at ? (l.starts_at as Date).getTime() : null;
      if (l.lines_final || start == null || start > now - OVER_AFTER_MS) continue;
      if (l.lines_at && (l.lines_at as Date).getTime() > now - AGAIN_MS) continue;
      const p = providers.find((x) => x.id === l.provider);
      if (!p) continue;
      let lines: PlayerLines[] = [];
      let final = false;
      if (l.teams) {
        const box = await p.boxScore(l.league, l.event_id);
        if (box) {
          lines = linesOfBox(box);
          final = box.final;
        }
      } else {
        const ev = (await p.eventsOn(l.league, easternDay(new Date(start)))).find((e) => e.id === l.event_id);
        if (ev) ({ lines, final } = linesOfField(ev, l.part));
      }
      // Nothing from the provider two days on: it isn't coming.
      if (!lines.length && start < now - GIVE_UP_MS) final = true;
      await saveGame(seasonId, l.episode, p.id, lines, final, new Date(now));
      out.games++;
      through = Math.max(through ?? 0, l.episode);
    }
    out.comingIn = await fillComingIn(seasonId, rows[0], providers);
  } catch (e) {
    if (!(e instanceof SportsUnavailable)) {
      await releaseStats(seasonId, "Couldn't get the stats. Try again in a bit.", through).catch(() => {});
      throw e;
    }
    out.message = e.message;
  }
  await releaseStats(seasonId, out.message, through);
  return out;
}

/**
 * Coming in for whoever from the sports data hasn't got it: their season line from before the season's games (the first linked
 * game's season and stage say which), [] when the provider has none, so nobody's asked twice. Answers how many were asked.
 */
async function fillComingIn(seasonId: string, first: { provider: string; league: string; event_id: string; starts_at: Date | null } | undefined, providers: SportsProvider[]): Promise<number> {
  const p = first && providers.find((x) => x.id === first.provider);
  if (!p || !first.starts_at) return 0;
  const { rows: people } = await pool.query(
    `SELECT c.name, c.provider_ids->>$2 AS athlete FROM season_cast c
      WHERE c.season_id = $1 AND c.provider_ids ? $2
        AND NOT EXISTS (SELECT 1 FROM game_lines g WHERE g.season_id = $1 AND g.episode = 0 AND g.provider = $2 AND g.athlete = c.provider_ids->>$2)
      ORDER BY c.sort_order LIMIT ${MAX_COMING_IN}`,
    [seasonId, p.id]
  );
  if (!people.length) return 0;
  const ev = (await p.eventsOn(first.league, easternDay(first.starts_at))).find((e) => e.id === first.event_id);
  if (!ev?.season) throw new SportsUnavailable(`${p.name} didn't say which season its games are in`);
  const want = comingInSeason(ev.season, ev.stage);
  const done: { athlete: string; name: string; label: string | null; tables: LineTable[] }[] = [];
  try {
    await atOnce(people, AT_ONCE, async (person) => {
      const lines = (await p.seasonStats(first.league, person.athlete, want.season)) ?? [];
      // The provider's main category only (a hitter's batting, a pitcher's pitching: what the tab shows); a traded player has a
      // row per team in it, and the last is where they ended up.
      const main = lines.filter((x) => x.category === lines[0]?.category).at(-1);
      const tables = main ? [{ name: main.name, labels: main.labels, values: main.values }] : [];
      done.push({ athlete: person.athlete, name: person.name, label: main ? comingInLabel(main.season, want.regular) : null, tables });
    });
  } finally {
    // What was asked before the provider stopped answering is kept.
    if (done.length) {
      await pool.query(
        `INSERT INTO game_lines (season_id, episode, provider, athlete, name, label, tables)
         SELECT $1, 0, $2, x.athlete, left(x.name, 120), left(x.label, 80), x.tables FROM jsonb_to_recordset($3::jsonb) AS x(athlete text, name text, label text, tables jsonb)
         ON CONFLICT (season_id, episode, provider, athlete) DO UPDATE SET label = EXCLUDED.label, tables = EXCLUDED.tables, updated_at = now()`,
        [seasonId, p.id, JSON.stringify(done)]
      );
    }
  }
  return done.length;
}

/**
 * A stats fill after the answer, held now (so the page asking sees it going at once). Outside a request (a script) it runs now
 * instead. False when another is going.
 */
export async function statsLater(seasonId: string, opts: { providers?: SportsProvider[] } = {}): Promise<boolean> {
  const run = async () => {
    try {
      await statsFromEvents(seasonId, { ...opts, held: true });
    } catch (e) {
      console.error("[sports] stats:", e);
    }
  };
  if (!(await holdStats(seasonId))) return false;
  try {
    after(run);
  } catch {
    await run();
  }
  return true;
}
