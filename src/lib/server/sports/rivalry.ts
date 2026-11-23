import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import { MARGIN_MAX, MARGIN_MIN, isRivalrySpec, type RivalryPick } from "@/lib/sports/rivalry";
import type { SessionUser } from "../auth-helpers";
import { HttpError, pool } from "../db";
import { LEAGUE_SEASON_JOIN } from "../league-season";
import { requireCouch } from "../couches";
import { joinGame } from "../couch-joins";
import { answerQuestions } from "../answers";
import { notifyRivalryCall } from "../push-events";
import { startSport } from "./start";
import type { SportsProvider } from "./types";

// A rivalry's game on a couch (docs/PLAN-sports-couch.md C1; docs/design-round/rivalry-spec.md): one game a meeting of two couch
// members' teams, Winner and margin with its winner shown as it's picked (src/lib/sports/rivalry.ts RIVALRY_SPEC), started by the
// first tap on This week's rivalry card, quietly (no "started a game" push), on the team's season as Play the next game starts one.
// A game is a rivalry's by its spec (a side shown as it's picked: nothing else asks that), so nothing new is stored.
//
//   GET  /api/sports/rivalry?couch=&league=   the couch's rivalry games in the league from ten days back to two weeks on, each
//        with every pick: the side, public as it's given; the margin only once its game has begun (yours always)
//   POST /api/sports/rivalry?couch=           { league, event, team, side | null, margin?, name?, rival? }: your pick (null takes
//        it back), starting the game when there's none and joining you to it; a fan's first call, before the other fan's, sends that
//        fan (`rival`) one notification: the challenge

export interface RivalryGame {
  event: string;
  leagueId: string;
  seasonId: string;
  episode: number;
  /** Its game has begun (by the listing's time): the margins are everyone's to see. */
  begun: boolean;
  picks: RivalryPick[];
}

const LEAGUE = /^[a-z0-9-]+\/[a-z0-9.-]+$/;
const EVENT = /^[\w.-]{1,40}$/;

/** The couch's rivalry games in a league (or on one game), each with its picks as `viewer` may see them. */
export async function couchRivalries(viewer: SessionUser, couchId: string, league: string, event?: string): Promise<RivalryGame[]> {
  if (!LEAGUE.test(league)) throw new HttpError(400, "Say which league");
  await requireCouch(viewer, couchId);
  const { rows } = await pool.query(
    `SELECT l.id AS league_id, l.state, ss.id AS season_id, e.event_id, e.episode, e.starts_at
       FROM leagues l ${LEAGUE_SEASON_JOIN}
       JOIN season_events e ON e.season_id = ss.id
      WHERE l.couch_id = $1 AND l.deleted_at IS NULL AND l.state->'settings'->>'archivedAt' IS NULL AND e.league = $2
        AND ($3::text IS NULL OR e.event_id = $3)
        AND e.starts_at > now() - interval '10 days' AND e.starts_at < now() + interval '15 days'
      ORDER BY l.created_at`,
    [couchId, league, event ?? null]
  );
  const games = new Map<string, RivalryGame>();
  for (const r of rows) {
    const state = r.state as LeagueState;
    if (!isRivalrySpec({ ask: StateLogic.AnswerLogic.questions(state) })) continue;
    const from = StateLogic.startEpisode(state);
    const to = StateLogic.endEpisode(state);
    if ((from != null && r.episode < from) || (to != null && r.episode > to)) continue;
    // One a meeting: the first made (two started at once by a race are read as the first; the lock below keeps that rare).
    if (games.has(r.event_id)) continue;
    games.set(r.event_id, { event: r.event_id, leagueId: r.league_id, seasonId: r.season_id, episode: r.episode, begun: !!r.starts_at && new Date(r.starts_at).getTime() <= Date.now(), picks: [] });
  }
  if (!games.size) return [];
  const list = [...games.values()];
  const { rows: answers } = await pool.query(
    `SELECT a.league_id, a.question, a.answer, m.user_id, COALESCE(u.username, u.name) AS who
       FROM game_answers a
       JOIN unnest($1::uuid[], $2::int[]) AS w(league_id, episode) ON a.league_id = w.league_id AND a.episode = w.episode
       JOIN league_memberships m ON m.league_id = a.league_id AND m.player_id = a.player_id
       JOIN "user" u ON u.id = m.user_id
      WHERE a.question IN ('winner', 'margin')
      ORDER BY a.created_at`,
    [list.map((g) => g.leagueId), list.map((g) => g.episode)]
  );
  const byLeague = new Map(list.map((g) => [g.leagueId, g]));
  for (const a of answers) {
    const g = byLeague.get(a.league_id);
    if (!g) continue;
    let p = g.picks.find((x) => x.userId === a.user_id);
    if (!p) g.picks.push((p = { userId: a.user_id, name: a.who, side: null, margin: null, called: false }));
    if (a.question === "winner") p.side = typeof a.answer === "string" ? a.answer : null;
    else if (typeof a.answer === "number") {
      p.called = true;
      // Nobody else's margin before kickoff (so nobody copies it).
      p.margin = g.begun || a.user_id === viewer.id ? a.answer : null;
    }
  }
  for (const g of list) g.picks = g.picks.filter((p) => p.side || p.called);
  return list;
}

/** Make, change or take back your pick on a rivalry (starting its game and joining you to it as needed). */
export async function pickRivalry(user: SessionUser, couchId: string, body: Record<string, unknown>, opts: { providers?: SportsProvider[]; now?: Date } = {}): Promise<RivalryGame | null> {
  const league = typeof body.league === "string" ? body.league.toLowerCase() : "";
  const event = typeof body.event === "string" ? body.event : "";
  const team = typeof body.team === "string" ? body.team : "";
  if (!LEAGUE.test(league) || !EVENT.test(event) || !EVENT.test(team)) throw new HttpError(400, "Say which game: { league, event, team }");
  const side = body.side === null ? null : typeof body.side === "string" && EVENT.test(body.side) ? body.side : undefined;
  if (side === undefined) throw new HttpError(400, "side: a team's id, or null to take it back");
  const margin = body.margin === undefined || body.margin === null ? body.margin : Number(body.margin);
  if (typeof margin === "number" && !(Number.isInteger(margin) && margin >= MARGIN_MIN && margin <= MARGIN_MAX)) throw new HttpError(400, `A margin from ${MARGIN_MIN} to ${MARGIN_MAX}`);
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 60) : "Rivalry";
  await requireCouch(user, couchId);

  // One game a meeting: the first tap makes it, under a lock for this couch and game, so two at once don't make two.
  const client = await pool.connect();
  let game: RivalryGame | null = null;
  let firstCall = false;
  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1))", [`rivalry:${couchId}:${event}`]);
    game = (await couchRivalries(user, couchId, league, event))[0] ?? null;
    if (!game && side === null) return null;
    if (!game) {
      const started = await startSport(user, couchId, { league, team, games: [event], game: "rivalry", name, tell: false, only: true }, opts);
      const { rows } = await pool.query("SELECT episode FROM season_events WHERE season_id = $1 AND event_id = $2 LIMIT 1", [started.seasonId, event]);
      game = { event, leagueId: started.leagueId, seasonId: started.seasonId, episode: rows[0]?.episode ?? started.from, begun: false, picks: [] };
    }
    if (game.begun) throw new HttpError(409, "It's started: sides closed at kickoff");
    const mine = game.picks.find((p) => p.userId === user.id);
    firstCall = !mine?.side && side !== null;
    const { rows: member } = await pool.query("SELECT 1 FROM league_memberships WHERE league_id = $1 AND user_id = $2", [game.leagueId, user.id]);
    if (!member.length) await joinGame(user, couchId, game.leagueId, {});
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext($1))", [`rivalry:${couchId}:${event}`]).catch(() => undefined);
    client.release();
  }
  const answers: Record<string, unknown> = { winner: side };
  if (side === null) answers.margin = null;
  else if (margin !== undefined) answers.margin = margin;
  await answerQuestions(user, game.seasonId, game.leagueId, { episode: game.episode, answers }, opts.now);

  // The challenge: a fan's first call while the other fan (on this couch) has none reaches them, once.
  const rival = typeof body.rival === "string" ? body.rival : null;
  if (firstCall && typeof margin === "number" && rival && rival !== user.id && !game.picks.some((p) => p.userId === rival && p.side)) {
    const { rows: on } = await pool.query("SELECT 1 FROM couch_members WHERE couch_id = $1 AND user_id = $2", [couchId, rival]);
    const { rows: ev } = await pool.query("SELECT name FROM season_events WHERE season_id = $1 AND event_id = $2 LIMIT 1", [game.seasonId, event]);
    if (on.length) {
      notifyRivalryCall({
        to: rival,
        from: (user as { username?: string | null }).username || user.name,
        matchup: (ev[0]?.name as string | undefined) ?? "your teams' game",
        href: `/league/${league}/week?call=${encodeURIComponent(event)}`,
        key: `rivalry:${game.leagueId}:${rival}`,
        couchId,
        seasonId: game.seasonId,
      });
    }
  }
  return (await couchRivalries(user, couchId, league, event))[0] ?? null;
}
