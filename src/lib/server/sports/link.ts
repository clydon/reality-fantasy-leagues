import { daysFor, NEAR_MS, pickEvent, sidesOf, wordsOf, type MatchEpisode } from "@/lib/game/sports-match";
import { pool } from "../db";
import { sportsProviders } from "./index";
import { SportsUnavailable, type SportsProvider } from "./types";

// Linking a sport's season to the provider's games (docs/PLAN-sports-data.md step 2; db/migrations/0148): each episode the
// listing has ("Game 1: Tampa Bay Rays at Milwaukee Brewers", Oct 23, 8 PM Eastern) is tied to the event it shows (ESPN's
// 401908042 in baseball/mlb), so a season's cast (step 3) and stats (step 4) can come from its games. Universal: no table of
// sports or leagues. Which league a season is in comes from the provider's own search for the teams its titles name (and the
// show's name, for a sport of individuals: "Formula 1"), checked against the scoreboards on its episodes' days; then each
// episode is the event on its day that fits its title (src/lib/game/sports-match.ts). A season no provider has keeps today's
// path (its people from Fill in who's playing). This is also what a game over a span will stand on: a span is a set of
// episodes, each tied to its event.
//
// It runs (with the season's cast after it: season.ts) after the answer when someone adds a sport (add-show.ts), from the Players
// tab (rosters.ts), and in the daily listings job for every sport season with episodes still to link (tv-listings.ts), each answer
// through the cache (cache.ts): a World Series costs a few calls, once.

const DAY = 86_400_000;
/** Episodes up to a week ahead are linked too (providers list their schedules ahead). */
const AHEAD_MS = 8 * DAY;
/** Days asked in one season's run, at most (a long regular season links over a few runs). */
const MAX_DAYS = 60;
/** Leagues tried when finding a season's, and its episodes tried in each. */
const CANDIDATES = 4;
const PROBES = 3;
/** Seasons looked at in one daily run (season.ts). */
export const MAX_SEASONS = 20;

type Queryable = { query: typeof pool.query };

export interface SeasonLink {
  provider: string | null;
  league: string | null;
  /** Episodes linked in all, and in this run. */
  linked: number;
  added: number;
  /** Episodes that have aired or air within the week that nothing fits yet. */
  unmatched: number[];
  message: string | null;
}

interface Dated extends MatchEpisode {
  airAt: string;
}

interface Linked {
  episode: number;
  provider: string;
  league: string;
  eventId: string;
  part: string | null;
  startsAt: string | null;
  teams: { id: string; name: string }[] | null;
}

async function seasonOf(seasonId: string, db: Queryable) {
  const [{ rows: s }, { rows: eps }, { rows: links }, { rows: state }] = await Promise.all([
    db.query("SELECT s.name, s.kind FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1", [seasonId]),
    db.query("SELECT number, air_at, title FROM season_episodes WHERE season_id = $1 ORDER BY number", [seasonId]),
    db.query("SELECT episode, provider, league, event_id, part, starts_at, teams FROM season_events WHERE season_id = $1", [seasonId]),
    db.query("SELECT provider, league FROM sports_links WHERE season_id = $1", [seasonId]),
  ]);
  if (!s[0]) return null;
  return {
    // As people say it: "Formula 1", not "Formula 1 (UK)".
    show: (s[0].name as string).replace(/\s*\([^)]*\)\s*$/, "").trim() || (s[0].name as string),
    kind: s[0].kind as string,
    episodes: eps.map((e) => ({ number: e.number as number, airAt: e.air_at ? (e.air_at as Date).toISOString() : null, title: (e.title as string | null) ?? null })),
    links: links.map((l): Linked => ({ episode: l.episode, provider: l.provider, league: l.league, eventId: l.event_id, part: l.part, startsAt: l.starts_at ? (l.starts_at as Date).toISOString() : null, teams: l.teams })),
    provider: (state[0]?.provider as string | null) ?? null,
    league: (state[0]?.league as string | null) ?? null,
  };
}

/**
 * The league a season's games are in, from the first provider that has it: the leagues its search finds for the teams the
 * titles name (and the show's name), each tried on a few of the season's days (the latest aired first), the first that most of
 * them fit winning, else the one most fit. Null when none fits.
 */
async function findLeague(providers: SportsProvider[], show: string, titles: (string | null)[], due: Dated[], now: number) {
  const aired = due.filter((e) => Date.parse(e.airAt) <= now).sort((a, b) => b.airAt.localeCompare(a.airAt));
  const coming = due.filter((e) => Date.parse(e.airAt) > now).sort((a, b) => a.airAt.localeCompare(b.airAt));
  const probes = [...aired, ...coming].slice(0, PROBES);
  if (!probes.length) return null;
  for (const p of providers) {
    const votes = new Map<string, number>();
    const vote = (league: string, n: number) => votes.set(league, (votes.get(league) ?? 0) + n);
    for (const side of sidesOf(titles)) {
      const key = wordsOf(side).join(" ");
      for (const f of await p.find(side)) if (f.kind === "team") vote(f.league, wordsOf(f.name).join(" ") === key ? 3 : 2);
    }
    for (const f of await p.find(show)) vote(f.league, 1);
    const candidates = [...votes.entries()].sort((a, b) => b[1] - a[1]).slice(0, CANDIDATES).map(([league]) => league);
    let best: { provider: SportsProvider; league: string; fits: number } | null = null;
    for (const league of candidates) {
      let fits = 0;
      for (const ep of probes) if (pickEvent(await p.eventsOn(league, daysFor(ep.airAt)[0]), ep, { show })) fits++;
      if (fits && fits * 2 >= probes.length) return { provider: p, league };
      if (fits && (!best || fits > best.fits)) best = { provider: p, league, fits };
    }
    if (best) return best;
  }
  return null;
}

/**
 * Link a sport season's episodes that have aired or air within the week to the provider's events (the ones not linked yet,
 * and any whose listing has since moved them a day and a half or more from their event). Writes season_events and the
 * season's sports_links row; a provider that doesn't answer stops the run with what it has linked so far, and the daily job
 * tries again an hour on. `providers`, `now` and `db` are for checks.
 */
export async function linkSeason(seasonId: string, opts: { providers?: SportsProvider[]; now?: Date; db?: Queryable } = {}): Promise<SeasonLink> {
  const db = opts.db ?? pool;
  const now = (opts.now ?? new Date()).getTime();
  const providers = opts.providers ?? sportsProviders();
  const season = await seasonOf(seasonId, db);
  if (!season) throw new Error(`No season ${seasonId}`);
  if (season.kind !== "sport") return { provider: null, league: null, linked: 0, added: 0, unmatched: [], message: "Not a sport" };

  const airOf = new Map(season.episodes.map((e) => [e.number, e.airAt]));
  const moved = season.links.filter((l) => {
    const air = airOf.get(l.episode);
    return !!air && !!l.startsAt && Math.abs(Date.parse(air) - Date.parse(l.startsAt)) > NEAR_MS;
  });
  if (moved.length) await db.query("DELETE FROM season_events WHERE season_id = $1 AND episode = ANY($2::int[])", [seasonId, moved.map((l) => l.episode)]);
  const kept = season.links.filter((l) => !moved.includes(l));
  const linked = new Set(kept.map((l) => l.episode));
  const dated = season.episodes.filter((e): e is Dated => !!e.airAt);
  const due = dated.filter((e) => Date.parse(e.airAt) <= now + AHEAD_MS);
  const todo = due.filter((e) => !linked.has(e.number));

  let provider = providers.find((p) => p.id === season.provider) ?? null;
  let league = provider ? season.league : null;
  let message: string | null = null;
  let down = false;
  const added = new Set<number>();
  try {
    if (todo.length && (!provider || !league)) {
      const found = await findLeague(providers, season.show, season.episodes.map((e) => e.title), due, now);
      if (found) ({ provider, league } = found);
    }
    if (provider && league) {
      const mine = kept.filter((l) => l.provider === provider!.id);
      // The teams of its games so far: a title that names no one ("Game 5") takes a game between them.
      const teams = new Set(mine.flatMap((l) => (l.teams ?? []).map((t) => t.id)));
      // A game (or an event's part) is one episode's: a listing that moves Game 2 onto Game 3's day doesn't take Game 3's game.
      const taken = new Set(mine.map((l) => `${l.eventId}|${l.part ?? ""}`));
      let days = 0;
      for (const ep of todo) {
        let pick: ReturnType<typeof pickEvent> = null;
        for (const day of daysFor(ep.airAt)) {
          if (days++ >= MAX_DAYS) break;
          const free = (await provider.eventsOn(league, day)).filter((e) => e.parts.length || !taken.has(`${e.id}|`));
          pick = pickEvent(free, ep, { seasonTeams: teams, show: season.show });
          if (pick && taken.has(`${pick.event.id}|${pick.part ?? ""}`)) pick = null;
          if (pick) break;
        }
        if (!pick) continue;
        const sides = pick.event.competitors.map((c) => c.team).filter((t) => !!t);
        await db.query(
          `INSERT INTO season_events (season_id, episode, provider, league, event_id, part, name, starts_at, teams)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
           ON CONFLICT (season_id, episode) DO UPDATE SET provider = EXCLUDED.provider, league = EXCLUDED.league, event_id = EXCLUDED.event_id,
             part = EXCLUDED.part, name = EXCLUDED.name, starts_at = EXCLUDED.starts_at, teams = EXCLUDED.teams, linked_at = now(),
             lines_at = NULL, lines_final = false`,
          [seasonId, ep.number, provider.id, league, pick.event.id, pick.part, pick.event.name.slice(0, 200) || null, pick.event.at, sides.length >= 2 ? JSON.stringify(sides.map((t) => ({ id: t!.id, name: t!.name }))) : null]
        );
        added.add(ep.number);
        taken.add(`${pick.event.id}|${pick.part ?? ""}`);
        for (const t of sides) teams.add(t!.id);
      }
    } else if (todo.length) {
      message = `No ${providers.map((p) => p.name).join(" or ")} games fit its listings`;
    }
  } catch (e) {
    if (!(e instanceof SportsUnavailable)) throw e;
    message = e.message;
    down = true;
  }

  const unmatched = todo.filter((e) => !added.has(e.number)).map((e) => e.number);
  if (!message && unmatched.length) message = `Nothing fits ${unmatched.length === 1 ? `episode ${unmatched[0]}` : `episodes ${unmatched.join(", ")}`} yet`;
  // When to look again: an hour on after an outage, a week on when no provider has it, the next day while some are missing,
  // else when the next episode comes within the week (at most a week on).
  const later = dated.filter((e) => Date.parse(e.airAt) > now + AHEAD_MS).map((e) => Date.parse(e.airAt) - AHEAD_MS);
  const next = down ? now + 3600_000 : !league && todo.length ? now + 7 * DAY : unmatched.length ? now + 20 * 3600_000 : Math.min(now + 7 * DAY, ...later);
  const { rows } = await db.query("SELECT count(*)::int AS n FROM season_events WHERE season_id = $1", [seasonId]);
  await db.query(
    `INSERT INTO sports_links (season_id, provider, league, linked, message, checked_at, next_at) VALUES ($1, $2, $3, $4, $5, now(), $6)
     ON CONFLICT (season_id) DO UPDATE SET provider = COALESCE(EXCLUDED.provider, sports_links.provider), league = COALESCE(EXCLUDED.league, sports_links.league),
       linked = EXCLUDED.linked, message = EXCLUDED.message, checked_at = now(), next_at = EXCLUDED.next_at`,
    [seasonId, provider?.id ?? null, league, rows[0].n, message, new Date(next)]
  );
  return { provider: provider?.id ?? null, league, linked: rows[0].n, added: added.size, unmatched, message };
}
