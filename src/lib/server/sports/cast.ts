import { easternDay } from "@/lib/game/tv-listings";
import { TeamSport, eligibleFor, sportOf } from "@/lib/sports";
import { pool } from "../db";
import { applyApprovedCastToLeagues, approveSportCast, seasonCastRows } from "../season-cast";
import { fillCastPhotos } from "../show-art";
import { sportsProviders } from "./index";
import { SportsUnavailable, type Injury, type Person, type SportsProvider } from "./types";
import { LEAGUE_LOGO, teamBadgeSrc } from "@/lib/sports/team-badge";

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
// removes; someone already in has their position and team kept as their roster says them now (a trade: step 1.4). The season's
// fill (cast_fills) is held while it runs, as Fill in who's playing's ask holds it (rosters.ts). The daily job refills every
// sports season with games near now once a day (refreshRosters), so a signing or a trade is in within a day.
//
// BACKLOG 220: the people are the season's cast as soon as they're in (season-cast.ts approveSportCast), so a game started on the
// season takes them, and anyone a fill adds later (a team linked later, a signing) reaches every game already on it, as the desk's
// cast edits do (applyApprovedCastToLeagues).

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
  /** A team's own person (its defense: TeamSport.teamPeople), its picture our badge for the team (team-badge.ts; never the
   *  league's logo, docs/PLAN-team-logos.md L0): no headshot to look for. */
  side?: true;
  /** Their injury as their roster says it now (step 1.5); left out for anyone not from a roster (a box score's, a field's). */
  injury?: Injury | null;
  /** Step 2.3: the other positions their league lets them fill, from the positions their roster lists (sports/index.ts eligibleFor:
   *  baseball's); left out for anyone not from a roster. */
  eligible?: string[];
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
  /** People already in whose team changed (a trade: step 1.4). */
  moved?: number;
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
  // `league`: a roster's league, for its eligibility rule (step 2.3).
  const add = (group: string, provider: string, people: (Person | null)[], from: number | null = null, side = false, league?: string) => {
    let g = groups.find((x) => x.name === group);
    if (!g) groups.push((g = { name: group, people: [] }));
    let n = 0;
    for (const p of people) {
      const key = `${provider}:${p?.id}`;
      if (!p?.id || !p.name || seen.has(key)) continue;
      seen.add(key);
      const injury = (p as { injury?: Injury | null }).injury;
      const eligible = league ? eligibleFor(league, p.position, (p as { positions?: string[] | null }).positions) : undefined;
      g.people.push({ name: p.name, role: p.position, photoUrl: p.headshot, ids: { [provider]: p.id }, from, ...(side ? { side: true as const } : {}), ...(injury !== undefined ? { injury } : {}), ...(eligible ? { eligible } : {}) });
      n++;
    }
    return n;
  };
  const teams: { provider: string; league: string; id: string; name: string }[] = [];
  for (const l of links) for (const t of l.teams ?? []) if (!teams.some((x) => x.provider === l.provider && x.id === t.id)) teams.push({ provider: l.provider, league: l.league, id: t.id, name: t.name });
  // A team's own people (its defense: step 1.3), after its roster's, their picture our badge for the team: its abbreviation on its
  // colour, from the league's teams (cached a week). Never the league's logo (docs/PLAN-team-logos.md L0).
  const badges = new Map<string, Promise<Map<string, string>>>();
  const badgeOf = (p: SportsProvider, t: { league: string; id: string; name: string }) => {
    if (!badges.has(t.league)) badges.set(t.league, p.teams(t.league).then((l) => new Map((l?.teams ?? []).map((x) => [x.id, teamBadgeSrc(x.abbreviation, x.color, x.name)] as const)), () => new Map()));
    return badges.get(t.league)!.then((m) => m.get(t.id) ?? teamBadgeSrc(null, null, t.name));
  };
  const sides = async (p: SportsProvider, t: { league: string; id: string; name: string }) => {
    const sport = sportOf(t.league);
    const own = sport instanceof TeamSport ? sport.teamPeople(t) : [];
    if (!own.length) return;
    const badge = await badgeOf(p, t);
    add(t.name, p.id, own.map((x) => ({ id: x.id, name: x.name, position: x.position, headshot: badge })), null, true);
  };
  for (const t of teams) {
    const p = providers.find((x) => x.id === t.provider);
    if (!p) continue;
    const roster = await p.roster(t.league, t.id);
    if (roster?.length) {
      add(t.name, p.id, roster, null, false, t.league);
      await sides(p, t);
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
    else await sides(p, t);
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

/** Whether a season's people may come from its linked games: a sport nobody's made a game of (or a matchup or a slate: its people
 *  are always its teams', whatever its league's show is), with no one yet or only people from here. */
export async function castable(seasonId: string, db: Queryable = pool): Promise<{ ok: boolean; people: number; why?: string }> {
  const { rows } = await db.query(
    `SELECT s.kind, s.set_up_at IS NOT NULL AS ready,
            (SELECT count(*)::int FROM season_cast c WHERE c.season_id = ss.id) AS people,
            (SELECT count(*)::int FROM season_cast c WHERE c.season_id = ss.id AND c.provider_ids IS NOT NULL) AS ours,
            EXISTS (SELECT 1 FROM sports_matchups m WHERE m.season_id = ss.id) OR EXISTS (SELECT 1 FROM sports_slates x WHERE x.season_id = ss.id) AS matchup
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1`,
    [seasonId]
  );
  const r = rows[0];
  if (!r) return { ok: false, people: 0, why: "No such season" };
  if (r.kind !== "sport") return { ok: false, people: r.people, why: "Not a sport" };
  if (r.ready && !r.matchup) return { ok: false, people: r.people, why: "It's a game: its cast is set up with it" };
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

/**
 * Write whoever's missing (by the provider's id, else by name), after the people already there, and keep the position of someone
 * already there (by the provider's id) as their roster says it now (BACKLOG 221: a season filled before positions were ESPN's
 * abbreviations) and their team as the roster that lists them now (a trade, step 1.4: their per-game lock follows it, air-times.ts
 * reads their row); only while it's still castable. Then the season's people approved (BACKLOG 220). Returns who it added, how
 * many moved team, and whether it approved them just now.
 */
async function saveCast(seasonId: string, groups: CastGroup[]): Promise<{ added: CastPerson[]; moved: number; approved: boolean; pictured: number }> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT id FROM show_seasons WHERE id = $1 FOR UPDATE", [seasonId]);
    if (!(await castable(seasonId, c)).ok) {
      await c.query("ROLLBACK");
      return { added: [], moved: 0, approved: false, pictured: 0 };
    }
    const { rows } = await c.query("SELECT id, lower(name) AS name, role, tribe_name, photo_url, injury, eligible, provider_ids, sort_order FROM season_cast WHERE season_id = $1", [seasonId]);
    const names = new Set(rows.map((r) => r.name as string));
    const ids = new Map(rows.flatMap((r) => Object.entries((r.provider_ids ?? {}) as Record<string, string>).map(([k, v]) => [`${k}:${v}`, r] as const)));
    let order = rows.reduce((m, r) => Math.max(m, (r.sort_order as number) ?? 0), -1) + 1;
    const added: CastPerson[] = [];
    let moved = 0;
    let pictured = 0;
    for (const g of groups) {
      for (const p of g.people) {
        const had = Object.entries(p.ids).map(([k, v]) => ids.get(`${k}:${v}`)).find(Boolean);
        const role = p.role?.slice(0, 60) ?? null;
        if (had) {
          const team = g.name.slice(0, 60);
          const traded = g.name !== FIELD && had.tribe_name !== team;
          if ((role && had.role !== role) || traded) await c.query("UPDATE season_cast SET role = COALESCE($2, role), tribe_name = $3 WHERE id = $1", [had.id, role, traded ? team : had.tribe_name]);
          if (traded) moved++;
          // A team's own people take our badge as theirs (docs/PLAN-team-logos.md L0): a season filled before it had the league's
          // logo in their place. A hand-set photo stays, unless it's one of ESPN's team logos.
          if (p.side && p.photoUrl && had.photo_url !== p.photoUrl && (!had.photo_url || had.photo_url.startsWith("data:image/svg+xml") || LEAGUE_LOGO.test(had.photo_url))) {
            await c.query("UPDATE season_cast SET photo_url = $2 WHERE id = $1", [had.id, p.photoUrl]);
            pictured++;
          }
          // Their injury as the roster says it now (step 1.5): set, changed or cleared (only for someone a roster lists).
          if (p.injury !== undefined && JSON.stringify(had.injury ?? null) !== JSON.stringify(p.injury)) await c.query("UPDATE season_cast SET injury = $2::jsonb WHERE id = $1", [had.id, p.injury ? JSON.stringify(p.injury) : null]);
          // The other positions they fill (step 2.3), as the roster lists them now: set, changed or cleared.
          if (p.eligible !== undefined && JSON.stringify(had.eligible ?? []) !== JSON.stringify(p.eligible)) await c.query("UPDATE season_cast SET eligible = $2 WHERE id = $1", [had.id, p.eligible.length ? p.eligible : null]);
          continue;
        }
        // Someone the provider names is theirs by id alone (step 1.3, migration 0308): two who share a name are two people.
        if (!Object.keys(p.ids).length && names.has(p.name.toLowerCase())) continue;
        const { rowCount } = await c.query(
          `INSERT INTO season_cast (season_id, name, tribe_name, role, photo_url, provider_ids, shown_from, sort_order, injury, eligible) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9::jsonb, $10)
           ON CONFLICT DO NOTHING`,
          [seasonId, p.name.slice(0, 120), g.name.slice(0, 60), p.role?.slice(0, 60) ?? null, p.photoUrl, JSON.stringify(p.ids), p.from, order++, p.injury ? JSON.stringify(p.injury) : null, p.eligible?.length ? p.eligible : null]
        );
        if (!rowCount) continue;
        names.add(p.name.toLowerCase());
        added.push(p);
      }
    }
    const approved = await approveSportCast(c, seasonId);
    await c.query("COMMIT");
    return { added, moved, approved, pictured };
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/** Seasons refilled a daily run, at most (each a roster call a linked team, cached a day and shared by a league's seasons). */
const ROSTERS_A_RUN = 10;
/** A season's people refilled when its last fill is this old (the daily job's: a day, give or take its hour). */
const ROSTER_EVERY_MS = 20 * 3_600_000;

/**
 * Step 1.4: the daily job's roster refresh (refreshSportsEvents). Every sports season whose people came from here, with a team game
 * linked from three days back to eight ahead, refilled when its last fill is a day old: a signing is added, a trade moves the
 * player's team (and his lock), and anyone new reaches every game on the season (castFromEvents). The oldest fill first, at
 * most ROSTERS_A_RUN; `only` (a check's seasons) looks at just those.
 */
export async function refreshRosters(opts: { providers?: SportsProvider[]; now?: Date; only?: string[] } = {}): Promise<{ seasons: number; filled: number; moved: number; errors: string[] }> {
  const now = opts.now ?? new Date();
  const { rows } = await pool.query(
    `SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id LEFT JOIN cast_fills f ON f.season_id = ss.id
      WHERE s.kind = 'sport' AND ($3::uuid[] IS NULL OR ss.id = ANY($3::uuid[]))
        AND EXISTS (SELECT 1 FROM season_events e WHERE e.season_id = ss.id AND e.teams IS NOT NULL
                     AND e.starts_at BETWEEN $1::timestamptz - interval '3 days' AND $1::timestamptz + interval '8 days')
        AND EXISTS (SELECT 1 FROM season_cast c WHERE c.season_id = ss.id AND c.provider_ids IS NOT NULL)
        AND f.asking_at IS NULL AND (f.updated_at IS NULL OR f.updated_at < $1::timestamptz - make_interval(secs => $2))
      ORDER BY f.updated_at NULLS FIRST LIMIT ${ROSTERS_A_RUN}`,
    [now, ROSTER_EVERY_MS / 1000, opts.only ?? null]
  );
  let filled = 0;
  let moved = 0;
  const errors: string[] = [];
  for (const r of rows) {
    try {
      const out = await castFromEvents(r.id, { providers: opts.providers, now });
      filled += out.filled;
      moved += out.moved ?? 0;
      if (out.message) errors.push(`rosters ${r.id}: ${out.message}`);
    } catch (e) {
      errors.push(`rosters ${r.id}: ${(e as Error).message.slice(0, 160)}`);
    }
  }
  return { seasons: rows.length, filled, moved, errors };
}

/** The season's people, into every game on it (BACKLOG 220): whoever a game hasn't got, its group their team. */
async function intoGames(seasonId: string): Promise<void> {
  const { rows } = await pool.query(
    "SELECT s.slug, ss.season_number, ss.tribes_from_episode FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1 AND ss.cast_approved_at IS NOT NULL",
    [seasonId]
  );
  if (!rows[0]) return;
  await applyApprovedCastToLeagues(rows[0].slug, rows[0].season_number, await seasonCastRows(seasonId), rows[0].tribes_from_episode ?? null);
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
      const { added, moved, approved, pictured } = await saveCast(seasonId, groups);
      out = { filled: added.length, waiting, message: null, ...(moved ? { moved } : {}) };
      // Everyone new, into every game on the season (one failing is that game's alone: applyApprovedCastToLeagues).
      if (added.length || moved || approved || pictured) await intoGames(seasonId).catch((e) => console.error("[sports] cast into games", seasonId, e));
      const bare = added.filter((p) => !p.photoUrl && !p.side).map((p) => p.name);
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
