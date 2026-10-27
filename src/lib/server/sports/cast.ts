import { easternDay } from "@/lib/game/tv-listings";
import { pool } from "../db";
import { fillCastPhotos } from "../show-art";
import { sportsProviders } from "./index";
import { SportsUnavailable, type Person, type SportsProvider } from "./types";

// A sport's cast from its linked games (docs/PLAN-sports-data.md step 3; db/migrations/0149): the teams in a season's season_events
// give its people, each team's players from the provider (players only: a provider's coaches and staff are apart), each with the
// provider's id (season_cast.provider_ids, for step 4's stats) and headshot. A team the provider has no roster for (AFL's on ESPN)
// gets whoever played for it in the season's linked games so far, from their box scores; one that hasn't played yet waits for its
// first game. Someone a box score brought in is shown from that game on (season_cast.shown_from, step 4: who played is only known
// once you've seen it). A sport of individuals (a race) gets its event's field, by name (a finished race's field comes in the
// order it finished). Then Wikipedia (show-art.ts) for anyone without a headshot, and initials for anyone it doesn't find.
// Nothing here knows a sport: teams, positions and fields are the provider's own.
//
// Only a sport nobody's made a game of, whose people are none yet or came from here: a game's cast (Make it a game, the desk) and
// one our bot or a paste filled in are never touched. It only adds (whoever's missing as more games are linked or played), never
// removes. The season's fill (cast_fills) is held while it runs, as Fill in who's playing's ask holds it (rosters.ts).

/** A fill going longer than this has died (rosters.ts's ask). */
const STALE_MS = 6 * 60_000;
/** A sport of individuals' one group. */
export const FIELD = "Field";

type Queryable = { query: typeof pool.query };

export interface CastPerson {
  name: string;
  role: string | null;
  photoUrl: string | null;
  ids: Record<string, string>;
  /** The episode whose box score brought them in (a team with no roster); null from a roster or a field. */
  from: number | null;
}
export interface CastGroup {
  name: string;
  people: CastPerson[];
}

/** A season_events row as this reads it. */
export interface LinkedEvent {
  episode: number;
  provider: string;
  league: string;
  eventId: string;
  part: string | null;
  startsAt: string | null;
  teams: { id: string; name: string }[] | null;
}

export interface CastFill {
  /** People added. */
  filled: number;
  /** Teams in its linked games with no one yet: no roster, and no game played. */
  waiting: string[];
  message: string | null;
  /** Someone else's fill is going. */
  busy?: boolean;
  /** Why it wasn't looked at (not a sport, a game's cast...). */
  skipped?: string;
}

/**
 * Who plays in a season's linked games: team by team in the order they first play, each team's players from its provider's roster,
 * else from its played games' box scores (`waiting` when it has neither yet); a field's events add their field as one group. Each
 * person once (by the provider's id).
 */
export async function rosterFromEvents(links: LinkedEvent[], providers: SportsProvider[], now: number): Promise<{ groups: CastGroup[]; waiting: string[] }> {
  const groups: CastGroup[] = [];
  const waiting: string[] = [];
  const seen = new Set<string>();
  const add = (group: string, provider: string, people: (Person | null)[], from: number | null = null) => {
    let g = groups.find((x) => x.name === group);
    if (!g) groups.push((g = { name: group, people: [] }));
    let n = 0;
    for (const p of people) {
      const key = `${provider}:${p?.id}`;
      if (!p?.id || !p.name || seen.has(key)) continue;
      seen.add(key);
      g.people.push({ name: p.name, role: p.position, photoUrl: p.headshot, ids: { [provider]: p.id }, from });
      n++;
    }
    return n;
  };
  const teams: { provider: string; league: string; id: string; name: string }[] = [];
  for (const l of links) for (const t of l.teams ?? []) if (!teams.some((x) => x.provider === l.provider && x.id === t.id)) teams.push({ provider: l.provider, league: l.league, id: t.id, name: t.name });
  for (const t of teams) {
    const p = providers.find((x) => x.id === t.provider);
    if (!p) continue;
    const roster = await p.roster(t.league, t.id);
    if (roster?.length) {
      add(t.name, p.id, roster);
      continue;
    }
    // No roster: whoever has played for it in the season's games so far.
    let found = 0;
    for (const l of links) {
      if (l.provider !== t.provider || !l.teams?.some((x) => x.id === t.id) || !l.startsAt || Date.parse(l.startsAt) > now) continue;
      const side = (await p.boxScore(l.league, l.eventId))?.teams.find((x) => x.team.id === t.id);
      for (const table of side?.tables ?? []) found += add(t.name, p.id, table.rows.map((r) => r.person), l.episode);
    }
    if (!found && !groups.find((g) => g.name === t.name)?.people.length) waiting.push(t.name);
  }
  // A field's events: everyone in the part the episode shows, else the event's field, else every part's.
  for (const l of links) {
    if (l.teams || !l.startsAt) continue;
    const p = providers.find((x) => x.id === l.provider);
    if (!p) continue;
    const ev = (await p.eventsOn(l.league, easternDay(new Date(l.startsAt)))).find((e) => e.id === l.eventId);
    if (!ev) continue;
    const part = ev.parts.find((x) => x.id === l.part);
    const field = part?.competitors.length ? part.competitors : ev.competitors.length ? ev.competitors : ev.parts.flatMap((x) => x.competitors);
    add(FIELD, p.id, field.map((c) => c.person).sort((a, b) => (a?.name ?? "").localeCompare(b?.name ?? "")));
  }
  return { groups: groups.filter((g) => g.people.length), waiting };
}

/** Whether a season's people may come from its linked games: a sport nobody's made a game of, with no one yet or only people from here. */
export async function castable(seasonId: string, db: Queryable = pool): Promise<{ ok: boolean; people: number; why?: string }> {
  const { rows } = await db.query(
    `SELECT s.kind, s.set_up_at IS NOT NULL AS ready,
            (SELECT count(*)::int FROM season_cast c WHERE c.season_id = ss.id) AS people,
            (SELECT count(*)::int FROM season_cast c WHERE c.season_id = ss.id AND c.provider_ids IS NOT NULL) AS ours
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1`,
    [seasonId]
  );
  const r = rows[0];
  if (!r) return { ok: false, people: 0, why: "No such season" };
  if (r.kind !== "sport") return { ok: false, people: r.people, why: "Not a sport" };
  if (r.ready) return { ok: false, people: r.people, why: "It's a game: its cast is set up with it" };
  if (r.people && !r.ours) return { ok: false, people: r.people, why: "Its people were filled in another way" };
  return { ok: true, people: r.people };
}

/** Hold the season's fill for a sports fill; false when another is going. */
export async function holdFill(seasonId: string, userId: string | null, db: Queryable = pool): Promise<boolean> {
  const { rowCount } = await db.query(
    `INSERT INTO cast_fills (season_id, asking_at, asked_by, message, via) VALUES ($1, now(), $2, NULL, 'sports')
     ON CONFLICT (season_id) DO UPDATE SET asking_at = now(), asked_by = $2, message = NULL, via = 'sports', updated_at = now()
      WHERE cast_fills.asking_at IS NULL OR cast_fills.asking_at < now() - make_interval(secs => $3)`,
    [seasonId, userId, STALE_MS / 1000]
  );
  return (rowCount ?? 0) > 0;
}

/** Let the season's sports fill go, saying how it went. */
export async function releaseFill(seasonId: string, message: string | null, filled: number | null, db: Queryable = pool) {
  await db.query("UPDATE cast_fills SET asking_at = NULL, message = $2, filled = $3, via = 'sports', updated_at = now() WHERE season_id = $1", [seasonId, message, filled]);
}

/** Write whoever's missing (by the provider's id, else by name), after the people already there; only while it's still castable. */
async function saveCast(seasonId: string, groups: CastGroup[]): Promise<CastPerson[]> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT id FROM show_seasons WHERE id = $1 FOR UPDATE", [seasonId]);
    if (!(await castable(seasonId, c)).ok) {
      await c.query("ROLLBACK");
      return [];
    }
    const { rows } = await c.query("SELECT lower(name) AS name, provider_ids, sort_order FROM season_cast WHERE season_id = $1", [seasonId]);
    const names = new Set(rows.map((r) => r.name as string));
    const ids = new Set(rows.flatMap((r) => Object.entries((r.provider_ids ?? {}) as Record<string, string>).map(([k, v]) => `${k}:${v}`)));
    let order = rows.reduce((m, r) => Math.max(m, (r.sort_order as number) ?? 0), -1) + 1;
    const added: CastPerson[] = [];
    for (const g of groups) {
      for (const p of g.people) {
        if (names.has(p.name.toLowerCase()) || Object.entries(p.ids).some(([k, v]) => ids.has(`${k}:${v}`))) continue;
        const { rowCount } = await c.query(
          `INSERT INTO season_cast (season_id, name, tribe_name, role, photo_url, provider_ids, shown_from, sort_order) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
           ON CONFLICT (season_id, lower(name)) DO NOTHING`,
          [seasonId, p.name.slice(0, 120), g.name.slice(0, 60), p.role?.slice(0, 60) ?? null, p.photoUrl, JSON.stringify(p.ids), p.from, order++]
        );
        if (!rowCount) continue;
        names.add(p.name.toLowerCase());
        added.push(p);
      }
    }
    await c.query("COMMIT");
    return added;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/**
 * Fill in (or add to) a sport's people from its linked games, then look for photos on Wikipedia for anyone added without a
 * headshot. Holds the season's fill unless the caller already does (`held`: the caller lets it go). `providers` and `now` are for
 * checks.
 */
export async function castFromEvents(seasonId: string, opts: { providers?: SportsProvider[]; now?: Date; held?: boolean } = {}): Promise<CastFill> {
  const now = (opts.now ?? new Date()).getTime();
  const can = await castable(seasonId);
  if (!can.ok) return { filled: 0, waiting: [], message: null, skipped: can.why };
  if (!opts.held && !(await holdFill(seasonId, null))) return { filled: 0, waiting: [], message: null, busy: true };
  let out: CastFill = { filled: 0, waiting: [], message: null };
  try {
    const { rows } = await pool.query("SELECT episode, provider, league, event_id, part, starts_at, teams FROM season_events WHERE season_id = $1 ORDER BY episode", [seasonId]);
    const links: LinkedEvent[] = rows.map((r) => ({ episode: r.episode, provider: r.provider, league: r.league, eventId: r.event_id, part: r.part, startsAt: r.starts_at ? (r.starts_at as Date).toISOString() : null, teams: r.teams }));
    if (links.length) {
      const { groups, waiting } = await rosterFromEvents(links, opts.providers ?? sportsProviders(), now);
      const added = await saveCast(seasonId, groups);
      out = { filled: added.length, waiting, message: null };
      const bare = added.filter((p) => !p.photoUrl).map((p) => p.name);
      if (bare.length) await fillCastPhotos(seasonId, undefined, { roster: true, only: bare }).catch((e) => console.error("[sports] photos", seasonId, e));
    }
  } catch (e) {
    if (!(e instanceof SportsUnavailable)) {
      if (!opts.held) await releaseFill(seasonId, "Couldn't fill in who's playing. Try again in a bit.", null).catch(() => {});
      throw e;
    }
    out = { filled: 0, waiting: [], message: e.message };
  }
  if (!opts.held) await releaseFill(seasonId, out.message, out.filled);
  return out;
}
