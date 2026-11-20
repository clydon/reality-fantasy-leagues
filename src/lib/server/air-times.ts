import type { Pool, PoolClient } from "pg";
import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import * as Air from "@/lib/game/air-schedule.js";
import * as Spec from "@/lib/game/game-spec";
import { byesOf, gameLocksOf, locksOf, type Closes } from "@/lib/sports/locks";
import { paceBy, paceFloor, playoffsEndBefore } from "@/lib/sports";
import { playoffsOver, teamInPlayoffs, type PlayoffGame } from "@/lib/sports/playoffs";
import { stampCardChoices } from "./card-choices";
import { stampVoteRecords } from "./vote-records";
import { stampSecretRoles } from "./secret-roles";
import { stampTwists } from "./twists";
import { stampHostCards } from "./host-cards";

// Stamps each episode with when it airs (ep.airsAt), from the league's season schedule in the
// catalog (show_seasons' premiere/air time/zone, overridden by the wiki's own per-episode dates --
// the same clock auto-research and reminders run on). Lineups and Eliminator Pool picks lock at that
// moment (StateLogic.ActiveRosterLogic.isLineupLocked / PickEmLogic.setPick), so it's stamped both
// on every write (withLeagueLock, before the mutation is validated) and on every read.
//
// A catching-up league is left unstamped: it plays at its own pace, so the broadcast's clock means
// nothing to it -- its episodes lock when their results are revealed. So is a league whose season
// isn't in the catalog or has no schedule.
//
// Step A14 part 4: `leagueId` (the game's), for a game with secret roles: dealt once it has started and stamped once revealed
// (secret-roles.ts), after the air times its start reads. Left out (a caller with no league to name), none are stamped. Part 5: the
// top scorer's twist, each closed episode's filed and stamped (twists.ts), last: its close reads the air times, its chooser the
// game's walk with the vote records and roles stamped. Part 6: a rotating host's card, each episode's filed once the host's time is
// up and stamped (host-cards.ts), after the air times its close reads.
export async function stampAirTimes(db: Pool | PoolClient, state: LeagueState, leagueId?: string): Promise<void> {
  // Step A11 part 4: head to head's playoffs at the season's end read its length (stampSeasonLength, below).
  await stampSeasonLength(db, state);
  // Step 2.7: a sport's game with no end of its own (through the final) ends with its season, once that's over (stampSeasonLast).
  await stampSeasonLast(db, state);
  // Step C7 part 2: a card the bot chooses, each episode's choice as it stood when the card came out (card-choices.ts), by the
  // broadcast's clock, so a league at its own pace has it too.
  await stampCardChoices(db, state);
  // Step A14 part 3: a bounty, who voted for whom in each episode the league has results for, as research says it (vote-records.ts).
  await stampVoteRecords(db, state);
  await stampAirs(db, state);
  await stampSecretRoles(db, state, leagueId);
  await stampHostCards(db, state, leagueId);
  await stampTwists(db, state, leagueId);
}

async function stampAirs(db: Pool | PoolClient, state: LeagueState): Promise<void> {
  const clear = () => state.episodes.forEach((ep) => {
    delete ep.airsAt;
    delete ep.locksAt;
    delete ep.gameStarts;
    delete ep.holdingGames;
  });
  delete state.paceFloor;
  const { showId, wikiSeason } = state.settings;
  if (!showId || wikiSeason == null || StateLogic.RevealLogic.isCatchingUp(state)) return clear();
  const { rows } = await db.query(
    `SELECT ss.id AS season_id, to_char(ss.premiere_date, 'YYYY-MM-DD') AS premiere_date, to_char(ss.air_time, 'HH24:MI') AS air_time, ss.air_tz,
            sad.air_dates AS wiki_air_dates
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id
       -- The wiki's dates with research-confirmed starts over them (0067): a week off moves the locks too.
       LEFT JOIN season_air_dates sad ON sad.season_id = ss.id
      WHERE s.slug = $1 AND ss.season_number = $2`,
    [showId, wikiSeason]
  );
  if (!rows.length) return clear();
  const season = { premiereDate: rows[0].premiere_date, airTime: rows[0].air_time, airTz: rows[0].air_tz };
  const wikiAirDates = rows[0].wiki_air_dates || {};
  for (const ep of state.episodes) {
    const at = Air.episodeAirTime(season, ep.number, wikiAirDates);
    if (at) ep.airsAt = at.toISOString();
    else delete ep.airsAt;
  }
  await stampSportLocks(db, state, rows[0].season_id as string);
}

/**
 * L4 part 1a: a sport's game whose spec closes daily or weekly (its sport's lock cadence, spec.ts specCloses) carries each
 * episode's lock (ep.locksAt: a league's slate's episode at its own first game, else its day's or week's first start among the
 * game's own episodes, from their games' starts, season_events.starts_at: src/lib/sports/locks.ts); any other league, and an episode with no linked game, none. Asks nothing of
 * the database otherwise.
 * L8 part 1's engine items: one that closes at each game's start, each episode's games with their starts and each holding's games
 * (stampGameLocks), never saved (StatsLogic.stampedKeys).
 */
async function stampSportLocks(db: Pool | PoolClient, state: LeagueState, seasonId: string): Promise<void> {
  state.episodes.forEach((ep) => {
    delete ep.locksAt;
    delete ep.gameStarts;
    delete ep.holdingGames;
    delete (ep as { byeTeams?: string[] }).byeTeams;
  });
  // Step 1.5: a game scored by a sport's stats on a league's slate, each week's teams on a bye (sports/locks.ts byesOf).
  if (StateLogic.StatsLogic.on(state)) await stampByes(db, state, seasonId);
  // Step 2.6: a team sport's game at its own pace, the last episode its seats have watched by now at the latest.
  await stampPaceFloor(db, state, seasonId);
  const closes = Spec.gameOf(state.settings).closes;
  if (closes === "game") return stampGameLocks(db, state, seasonId);
  if (closes !== "daily" && closes !== "weekly") return;
  const locks = await sportLocks(db, seasonId, closes, { from: StateLogic.startEpisode(state) ?? 1, to: StateLogic.endEpisode(state) });
  for (const ep of state.episodes) {
    const at = locks.get(ep.number);
    if (at) ep.locksAt = at;
  }
}

/**
 * Step 2.6 (docs/PLAN-sports-ready.md; BACKLOG 218): a team sport's game at its own pace carries the last episode its seats have
 * watched by now at the latest (state.paceFloor, never saved: sports/pace.ts paceFloor, from its episodes' first games played and its
 * sport's `pace.by`), for GhostLogic.keepPace. Any other game, and an individual sport's, none. One query, only for such a game.
 */
async function stampPaceFloor(db: Pool | PoolClient, state: LeagueState, seasonId: string): Promise<void> {
  delete state.paceFloor;
  if (!StateLogic.GhostLogic.ownPace(state)) return;
  const { rows } = await db.query(
    `SELECT s.sports_league,
            (SELECT json_agg(json_build_object('episode', e.episode, 'at', e.starts_at)) FROM season_events e
              WHERE e.season_id = ss.id AND e.starts_at IS NOT NULL AND ${PLAYED}) AS starts
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1 AND s.kind = 'sport'`,
    [seasonId]
  );
  const league = typeof rows[0]?.sports_league === "string" ? (rows[0].sports_league as string).replace(/^[a-z]+:/, "") : null;
  const by = league ? paceBy(league) : null;
  if (!by) return;
  const floor = paceFloor((rows[0].starts ?? []) as { episode: number; at: string | null }[], Date.now(), by);
  if (floor !== null) state.paceFloor = floor;
}

/** Step 1.5: each episode's teams on a bye (ep.byeTeams: their names, as the linked games name them), for a league's slate's episodes
 *  whose games are all linked; never saved (StatsLogic.stampedKeys). One query. */
async function stampByes(db: Pool | PoolClient, state: LeagueState, seasonId: string): Promise<void> {
  const { rows } = await db.query(
    "SELECT e.episode, e.teams FROM season_events e WHERE e.season_id = $1 AND e.teams IS NOT NULL AND EXISTS (SELECT 1 FROM sports_slates x WHERE x.season_id = $1)",
    [seasonId]
  );
  if (!rows.length) return;
  const byes = byesOf(rows.map((r) => ({ episode: r.episode as number, teams: ((r.teams ?? []) as { name?: string | null }[]).map((t) => t.name).filter((n): n is string => !!n) })));
  for (const ep of state.episodes) {
    const b = byes.get(ep.number);
    if (b) (ep as { byeTeams?: string[] }).byeTeams = b;
  }
}

/** L3 part 3b: a linked game the provider says is over without being played (postponed, cancelled: sports_events' state 'post', not
 *  final) locks nothing: its start never comes, so a holding of its team stays free to move (until the lineup's own lock) and a
 *  day's or a week's lock is its first game played. A suspended game is still being played (state 'in'): it locks as it started. */
const PLAYED = `NOT EXISTS (SELECT 1 FROM sports_events f WHERE f.provider = e.provider AND f.league = e.league AND f.event_id = e.event_id AND f.state = 'post' AND NOT f.final)`;

/**
 * L8 part 1's engine items: a lineup locking at each game's start, each episode's games in the game's span (their starts, and the end
 * of each one's day: a holding's lock) and each holding's games by its team (season_cast's group, the team's name as the link has it).
 * Two queries, only for such a game. L3 part 3b: a game called off isn't one of them (PLAYED).
 */
async function stampGameLocks(db: Pool | PoolClient, state: LeagueState, seasonId: string): Promise<void> {
  const to = StateLogic.endEpisode(state);
  const { rows } = await db.query(
    `SELECT e.episode, e.event_id, e.starts_at, e.teams FROM season_events e WHERE e.season_id = $1 AND e.episode >= $2 AND ($3::int IS NULL OR e.episode <= $3) AND ${PLAYED}`,
    [seasonId, StateLogic.startEpisode(state) ?? 1, to]
  );
  if (!rows.length) return;
  const { rows: cast } = await db.query("SELECT id, name, tribe_name FROM season_cast WHERE season_id = $1 AND tribe_name IS NOT NULL", [seasonId]);
  // A castaway's own row (castaway.seasonCastId: two who share a name are two rows, step 1.3), else by name.
  const teamByRow = new Map(cast.map((c) => [String(c.id), String(c.tribe_name)]));
  const teamByName = new Map(cast.map((c) => [String(c.name).toLowerCase(), String(c.tribe_name)]));
  const teamOf = new Map<string, string>();
  for (const c of state.castaways ?? []) {
    const team = (c.seasonCastId ? teamByRow.get(c.seasonCastId) : undefined) ?? teamByName.get(c.name.toLowerCase());
    if (team) teamOf.set(c.id, team);
  }
  const games = rows.map((r) => ({
    episode: r.episode as number,
    eventId: String(r.event_id),
    at: r.starts_at ? (r.starts_at as Date).toISOString() : null,
    teams: ((r.teams ?? []) as { name?: string | null }[]).map((t) => t.name).filter((n): n is string => !!n),
  }));
  const locks = gameLocksOf(games, teamOf);
  for (const ep of state.episodes) {
    const l = locks.get(ep.number);
    if (!l) continue;
    ep.gameStarts = l.gameStarts;
    ep.holdingGames = l.holdingGames;
  }
}

/**
 * Each episode's lock on a sport's season, by `closes`, from its linked games' starts; `span` the game's episodes (from, to: null
 * to the season's end), so a game that starts later never locks with a game before it. A league's slate (L8 part 3) locks each
 * episode at its own first game: the episode is the week. L3 part 3b: its first game played (one called off locks nothing: PLAYED).
 */
export async function sportLocks(db: Pool | PoolClient, seasonId: string, closes: Closes, span: { from: number; to: number | null } = { from: 1, to: null }): Promise<Map<number, string>> {
  const { rows } = await db.query(
    `SELECT e.episode, e.starts_at, EXISTS (SELECT 1 FROM sports_slates x WHERE x.season_id = $1) AS slate
       FROM season_events e WHERE e.season_id = $1 AND e.episode >= $2 AND ($3::int IS NULL OR e.episode <= $3) AND ${PLAYED}`,
    [seasonId, span.from, span.to]
  );
  const starts = rows.map((r) => ({ episode: r.episode as number, at: r.starts_at ? (r.starts_at as Date).toISOString() : null }));
  return locksOf(starts, closes, { slate: rows[0]?.slate === true });
}

/**
 * Step A11 part 4: a head-to-head game whose playoffs sit at the season's end (StateLogic.MatchupLogic.readsSeasonLength) carries the
 * season's length as its schedule says it (state.seasonEpisodes, show_seasons.episode_count: public, not a spoiler, so a league
 * catching up gets it too), for the engine to place them (MatchupLogic.playoffsFrom); any other league carries none. Stamped with
 * the air times, and again after a write's mutation (db.ts withLeagueLock), so a write that turns head to head on saves it.
 *
 * Step 2.2 (BACKLOG 214): on a league's regular-season slate whose league's fantasy playoffs end before its regular season does (the
 * NFL's: sports/index.ts playoffsEndBefore), the last week they may use (state.playoffsBy: Week 17 of 18), so the final is never
 * in Week 18, when teams rest their starters. A team's own season, or the playoffs' slate, carries none.
 * Step 2.7: on a full slate (the regular season, then the playoffs) the same, from its regular season's end, for a game that ends in
 * its regular season; one that runs on into the playoffs places its own at its own end (none: the final at the Super Bowl's week).
 */
export async function stampSeasonLength(db: Pool | PoolClient, state: LeagueState): Promise<void> {
  const { showId, wikiSeason } = state.settings;
  if (!StateLogic.MatchupLogic.readsSeasonLength(state) || !showId || wikiSeason == null) {
    delete state.seasonEpisodes;
    delete state.playoffsBy;
    return;
  }
  const { rows } = await db.query(
    `SELECT ss.episode_count, x.league, x.stage, x.regular_through FROM show_seasons ss JOIN shows s ON s.id = ss.show_id
       LEFT JOIN sports_slates x ON x.season_id = ss.id
      WHERE s.slug = $1 AND ss.season_number = $2`,
    [showId, wikiSeason]
  );
  const n = rows[0]?.episode_count;
  if (Number.isInteger(n) && n > 0) state.seasonEpisodes = n;
  else delete state.seasonEpisodes;
  const regular = regularLength(rows[0]);
  const to = StateLogic.endEpisode(state);
  const inRegular = rows[0]?.stage === "regular" || (rows[0]?.stage === "full" && to !== null && regular !== null && to <= regular);
  const rest = inRegular && typeof rows[0]?.league === "string" ? playoffsEndBefore(rows[0].league) : 0;
  if (rest && regular !== null && regular - rest >= 1) state.playoffsBy = regular - rest;
  else delete state.playoffsBy;
}

/** A slate's regular season's length: a regular slate's every episode, a full slate's up to its playoffs; else null. */
function regularLength(row: { episode_count?: unknown; stage?: unknown; regular_through?: unknown } | undefined): number | null {
  if (!row) return null;
  const n = row.stage === "full" ? row.regular_through : row.stage === "regular" ? row.episode_count : null;
  return Number.isInteger(n) && (n as number) > 0 ? (n as number) : null;
}

/**
 * Step 2.7 (docs/PLAN-sports-ready.md): where a sport's season's regular season ends, for a season that goes on into its playoffs
 * (a full slate, a team's season that takes its playoff games): `through`, its last regular episode, and `fantasy`, where a game
 * scored by players' stats ends by default (the NFL's Week 17: fantasySeasonEnd). Null for any other season (a regular or a
 * playoffs slate, a matchup of games picked one by one, a show's): its end is its season's.
 */
export async function regularEnd(db: Pool | PoolClient, seasonId: string): Promise<{ through: number; fantasy: number } | null> {
  const { rows } = await db.query(
    `SELECT x.league, x.regular_through AS slate, m.regular_through AS team FROM show_seasons ss
       LEFT JOIN sports_slates x ON x.season_id = ss.id AND x.stage = 'full'
       LEFT JOIN sports_matchups m ON m.season_id = ss.id
      WHERE ss.id = $1`,
    [seasonId]
  );
  const through = rows[0]?.slate ?? rows[0]?.team;
  if (!Number.isInteger(through) || through < 1) return null;
  const rest = rows[0]?.slate && typeof rows[0]?.league === "string" ? playoffsEndBefore(rows[0].league) : 0;
  return { through, fantasy: rest && through - rest >= 1 ? through - rest : through };
}

/**
 * Step 2.7: a sport's game with no end of its own (on through the final: settings' span `to` null) carries its season's last
 * episode once its season is over (state.seasonLast, never saved: StatsLogic.stampedKeys), so it ends there (StateLogic.lastEpisode,
 * gameOver) and never before: a season that grows as its playoffs are listed (a day's slate, a team's season) runs on while more may
 * come. Over: a full or a playoffs slate's final decided (playoffs.ts playoffsOver), a team's season's team out (team-season.ts's
 * ended_at; its games so far read again here, so a loss counts within the hour, not the next morning), else the season completed (every
 * game played). Any other game (an end of its own, a show's) carries none. One or two queries, only for such a game.
 */
export async function stampSeasonLast(db: Pool | PoolClient, state: LeagueState): Promise<void> {
  delete state.seasonLast;
  const { showId, wikiSeason } = state.settings;
  if (!showId || wikiSeason == null || StateLogic.endEpisode(state) !== null || StateLogic.startEpisode(state) === null) return;
  const { rows } = await db.query(
    `SELECT ss.id, ss.episode_count, ss.status, x.stage, m.key, m.regular_through AS team_through, m.ended_at
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id
       LEFT JOIN sports_slates x ON x.season_id = ss.id LEFT JOIN sports_matchups m ON m.season_id = ss.id
      WHERE s.slug = $1 AND ss.season_number = $2 AND s.kind = 'sport'`,
    [showId, wikiSeason]
  );
  const r = rows[0];
  const n = r?.episode_count;
  if (!r || !Number.isInteger(n) || n < 1) return;
  let over = false;
  if (r.stage === "full" || r.stage === "post" || (r.key && Number.isInteger(r.team_through))) {
    const team = r.stage ? null : /:season:([^:]+):\d{4}$/.exec(r.key as string)?.[1] ?? null;
    if (r.ended_at) over = true;
    else {
      const { rows: games } = await db.query(
        `SELECT e.event_id, e.starts_at, e.note, e.best_of, e.episode, f.state, f.final, f.teams FROM season_events e
           LEFT JOIN sports_events f ON f.provider = e.provider AND f.league = e.league AND f.event_id = e.event_id
          WHERE e.season_id = $1 AND e.note IS NOT NULL`,
        [r.id]
      );
      const list: PlayoffGame[] = games.map((g) => ({
        id: String(g.event_id),
        note: g.note ?? null,
        bestOf: g.best_of ?? null,
        at: g.starts_at ? (g.starts_at as Date).toISOString() : null,
        status: g.final ? "final" : g.state === "in" ? "in" : g.state === "post" ? "off" : "pre",
        sides: ((g.teams ?? []) as { id: string; score?: number | string | null }[]).map((t) => ({ id: String(t.id), score: Number(t.score) || 0 })),
        episode: g.episode,
      }));
      // A team's own games say only that it lost or won the final: out with no game of its own waits for the job (ended_at).
      over = team ? ["out", "champion"].includes(teamInPlayoffs(team, list)) : playoffsOver(list);
    }
  }
  // Every game played (a regular slate's, a matchup's; a postseason that's no one bracket, college's, once its days are past). A team's
  // season that grows completes only once its team is out (matchup.ts refreshSportsEvents).
  if (r.status === "completed") over = true;
  if (over) state.seasonLast = n;
}

/**
 * BACKLOG 226 (the user, 2026-11-20): where a fantasy season on a league's regular-season slate ends, when its league's ends before
 * the regular season does (the NFL's Week 17 of 18: sports/index.ts playoffsEndBefore), or null (another league, a team's own
 * season, the playoffs' slate). A game scored by players' stats started to the season's end runs to it (start-spec.ts, the sports
 * route); a maker who picks a later week keeps it.
 */
export async function fantasySeasonEnd(db: Pool | PoolClient, seasonId: string): Promise<number | null> {
  const { rows } = await db.query("SELECT ss.episode_count, x.league, x.stage, x.regular_through FROM show_seasons ss JOIN sports_slates x ON x.season_id = ss.id WHERE ss.id = $1", [seasonId]);
  // Step 2.7: a full slate's regular season is its first episodes.
  const n = regularLength(rows[0]);
  const rest = n !== null && typeof rows[0]?.league === "string" ? playoffsEndBefore(rows[0].league) : 0;
  return rest && n !== null && n - rest >= 1 ? n - rest : null;
}
