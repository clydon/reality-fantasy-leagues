import type { Gif } from "@/lib/game/watch-along";
import { scheduleOf } from "@/lib/sports/teams";
import type { SessionUser } from "../auth-helpers";
import { HttpError, pool } from "../db";
import { requireCouch } from "../couches";
import type { GifSource } from "../gifs";
import { postRoom, roomScope, type LapResult } from "../league-chat";
import { couchPicked } from "./calls";
import { seasonGames } from "./find";
import { sportsProviders } from "./index";
import { couchTeams } from "./team-follows";
import type { SportsProvider } from "./types";

// The victory lap (docs/PLAN-sports-couch.md C3; docs/design-round/victory-lap-spec.md; migration 0452): after a couch member's team
// wins, that fan's one prompt to post a GIF and a line to the league's room (in the game's thread, with no push) and the couch's feed.
// A lap is open from the final until the team plays again, or until it's answered (posted, or Not this time: kept, so the prompt ends
// on every phone). The final is read from the team's cached schedule, as C2's calls read theirs (no new kind of ESPN call). Every lap
// wears the final that earned it (sports_laps.team, opponent, score), so nothing about it is typed.
//
// Hide sports scores is the phone's: a lap says who won, so the phone draws nothing of one (the prompt included) for anyone who hasn't
// shown that game; the room's thread already folds what's written after kickoff.
//
//   GET    /api/sports/laps?couch=&league=&teams=   your open laps (one a team of yours among `teams` whose last final is a win you
//          haven't posted; `skipped` when you said Not this time) and the couch's laps in the league this season
//   POST   /api/sports/laps?couch=                  { league, event, team, gif?, line? } posts; { league, event, team, skip: true }
//   DELETE /api/sports/laps?couch=&league=&event=   takes yours back (its room message goes, and the lap with it)

const LEAGUE = /^[a-z0-9-]+\/[a-z0-9.-]+$/;
const ID = /^[\w.-]{1,40}$/;
const LINE_MAX = 120;

type Opts = { providers?: SportsProvider[]; now?: Date };
type Side = LapResult["team"];

/** A win of yours to take a lap for. */
export interface OpenLap extends LapResult {
  event: string;
  league: string;
  /** Its start, and where the team played (home or away). */
  at: string | null;
  home: boolean | null;
  /** You picked the winner in a call or a rivalry on it. */
  called: boolean;
  /** You said Not this time (the game's sheet still offers it, quietly). */
  skipped: boolean;
}

/** A lap someone on the couch took. */
export interface Lap extends LapResult {
  event: string;
  userId: string;
  name: string;
  gif: Gif | null;
  line: string | null;
  at: string;
  /** The game's start (the phone holds a lap for anyone hiding scores who hasn't shown it). */
  eventAt: string | null;
  messageId: string;
}

/** A team's last final, when it's a win and the team hasn't played again since. */
async function lastWin(p: SportsProvider, league: string, team: Side, now: Date): Promise<Omit<OpenLap, "called" | "skipped"> | null> {
  const games = await seasonGames(p, league, team.id).catch(() => null);
  if (!games) return null;
  const sched = scheduleOf(team.id, games).games.filter((g) => !g.calledOff);
  const done = sched.filter((g) => g.final && g.result);
  const last = done[done.length - 1];
  if (!last || last.result !== "W" || !last.score || !last.opponent) return null;
  // Open until the team plays again.
  const after = sched.filter((g) => g.id !== last.id && (g.at ?? "") > (last.at ?? ""));
  if (after.some((g) => g.state !== "pre" || (g.at && Date.parse(g.at) <= now.getTime()))) return null;
  const raw = games.find((g) => g.id === last.id)?.competitors.find((c) => c.team?.id === last.opponent!.id)?.team;
  const opponent: Side = { id: last.opponent.id, short: last.opponent.short, abbreviation: last.opponent.abbreviation, color: raw?.color ?? null };
  return { event: last.id, league, at: last.at, home: last.home, team, opponent, score: last.score };
}

/** Your open laps among the asked teams (the ones you follow on this couch), newest first. */
async function openLapsOf(user: SessionUser, couchId: string, league: string, teams: string[], opts: Opts): Promise<OpenLap[]> {
  const p = (opts.providers ?? sportsProviders())[0];
  if (!p) return [];
  const now = opts.now ?? new Date();
  const mine = (await couchTeams(user.id, couchId)).filter((t) => t.league === league && teams.includes(t.id) && t.followers.some((f) => f.id === user.id));
  const wins = (
    await Promise.all(mine.slice(0, 8).map((t) => lastWin(p, league, { id: t.id, short: t.short, abbreviation: t.abbreviation, color: t.color }, now)))
  ).filter((x): x is NonNullable<typeof x> => !!x);
  if (!wins.length) return [];
  const { rows } = await pool.query(`SELECT game_id, skipped FROM sports_laps WHERE couch_id = $1 AND user_id = $2 AND game_id = ANY($3::text[])`, [
    couchId,
    user.id,
    wins.map((w) => w.event),
  ]);
  const answered = new Map(rows.map((r) => [r.game_id as string, r.skipped as boolean]));
  const out: OpenLap[] = [];
  for (const w of wins) {
    if (answered.get(w.event) === false) continue;
    const picked = await couchPicked(couchId, league, w.event, now).catch(() => []);
    const called = picked.some((g) => g.picks.some((x) => x.userId === user.id && x.side === w.team.id));
    out.push({ ...w, called, skipped: answered.get(w.event) === true });
  }
  return out.sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
}

/** The couch's laps in a league this season (or on one game), oldest first. */
async function couchLaps(couchId: string, league: string, event: string | null = null): Promise<Lap[]> {
  const { rows } = await pool.query(
    `SELECT l.game_id, l.user_id, l.team, l.opponent, l.score, m.id AS message_id, m.author_name, m.gif, m.text, m.created_at, m.sports_event_at
       FROM sports_laps l JOIN chat_messages m ON m.id = l.message_id
      WHERE l.couch_id = $1 AND l.league = $2 AND NOT l.skipped AND ($3::text IS NULL OR l.game_id = $3) AND l.created_at > now() - interval '240 days'
      ORDER BY m.created_at`,
    [couchId, league, event]
  );
  return rows.map((r) => ({
    event: r.game_id,
    userId: r.user_id,
    name: r.author_name,
    team: r.team,
    opponent: r.opponent,
    score: r.score as [number, number],
    gif: r.gif ?? null,
    line: r.text && r.text !== "GIF" ? r.text : null,
    at: new Date(r.created_at).toISOString(),
    eventAt: r.sports_event_at ? new Date(r.sports_event_at).toISOString() : null,
    messageId: r.message_id,
  }));
}

/** Your open laps and the couch's laps, in a league. */
export async function readLaps(user: SessionUser, couchId: string, league: string, teams: string[], opts: Opts = {}): Promise<{ open: OpenLap[]; laps: Lap[] }> {
  if (!LEAGUE.test(league)) throw new HttpError(400, "Say which league");
  await requireCouch(user, couchId);
  const [open, laps] = await Promise.all([openLapsOf(user, couchId, league, teams.filter((t) => ID.test(t)), opts), couchLaps(couchId, league)]);
  return { open, laps };
}

/** Take your victory lap (a GIF and a line), or say Not this time. */
export async function takeLap(user: SessionUser, couchId: string, body: Record<string, unknown>, src: GifSource | null, opts: Opts = {}): Promise<{ open: OpenLap[]; laps: Lap[] }> {
  const league = typeof body.league === "string" ? body.league.toLowerCase() : "";
  const event = typeof body.event === "string" ? body.event : "";
  const team = typeof body.team === "string" ? body.team : "";
  if (!LEAGUE.test(league) || !ID.test(event) || !ID.test(team)) throw new HttpError(400, "Say which game: { league, event, team }");
  await requireCouch(user, couchId);
  const open = (await openLapsOf(user, couchId, league, [team], opts)).find((l) => l.event === event);
  if (!open) throw new HttpError(409, "That isn't a win of your team's to take a lap for");
  if (body.skip === true) {
    await pool.query(
      `INSERT INTO sports_laps (couch_id, league, game_id, user_id, team_id, skipped, team, opponent, score) VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8)
       ON CONFLICT (couch_id, game_id, user_id) DO NOTHING`,
      [couchId, league, event, user.id, team, JSON.stringify(open.team), JSON.stringify(open.opponent), open.score]
    );
    return readLaps(user, couchId, league, [team], opts);
  }
  const line = typeof body.line === "string" ? body.line.trim().slice(0, LINE_MAX) : "";
  const hasGif = body.gif !== undefined && body.gif !== null;
  if (!hasGif && !line) throw new HttpError(400, "A GIF or a line");
  const scope = await roomScope(user, league, couchId);
  const [away, home] = open.home === false ? [open.team, open.opponent] : [open.opponent, open.team];
  const message = await postRoom(
    user,
    scope,
    { gif: hasGif ? body.gif : undefined, text: line || undefined, event, eventAt: open.at ?? undefined, eventName: `${away.short} at ${home.short}` },
    src,
    { quiet: true, line: line || null }
  );
  await pool.query(
    `INSERT INTO sports_laps (couch_id, league, game_id, user_id, team_id, message_id, skipped, team, opponent, score) VALUES ($1, $2, $3, $4, $5, $6, false, $7, $8, $9)
     ON CONFLICT (couch_id, game_id, user_id) DO UPDATE SET message_id = EXCLUDED.message_id, skipped = false, created_at = now()`,
    [couchId, league, event, user.id, team, message.id, JSON.stringify(open.team), JSON.stringify(open.opponent), open.score]
  );
  return readLaps(user, couchId, league, [team], opts);
}

/** Take your lap back: its room message goes, and the lap with it (the prompt comes back while the win is open). */
export async function takeBackLap(user: SessionUser, couchId: string, league: string, event: string): Promise<void> {
  if (!LEAGUE.test(league) || !ID.test(event)) throw new HttpError(400, "Say which game");
  await requireCouch(user, couchId);
  await pool.query(
    `DELETE FROM chat_messages WHERE id = (SELECT message_id FROM sports_laps WHERE couch_id = $1 AND league = $2 AND game_id = $3 AND user_id = $4 AND NOT skipped)`,
    [couchId, league, event, user.id]
  );
}

/** The couch's laps lately, for its feed (couch-hub.ts): the newest few in every league. */
export async function lapsForFeed(couchId: string, limit = 12): Promise<(Lap & { league: string })[]> {
  const { rows } = await pool.query(
    `SELECT l.league, l.game_id, l.user_id, l.team, l.opponent, l.score, m.id AS message_id, m.author_name, m.gif, m.text, m.created_at, m.sports_event_at
       FROM sports_laps l JOIN chat_messages m ON m.id = l.message_id
      WHERE l.couch_id = $1 AND NOT l.skipped AND l.created_at > now() - interval '14 days'
      ORDER BY m.created_at DESC LIMIT ${limit}`,
    [couchId]
  );
  return rows.map((r) => ({
    league: r.league,
    event: r.game_id,
    userId: r.user_id,
    name: r.author_name,
    team: r.team,
    opponent: r.opponent,
    score: r.score as [number, number],
    gif: r.gif ?? null,
    line: r.text && r.text !== "GIF" ? r.text : null,
    at: new Date(r.created_at).toISOString(),
    eventAt: r.sports_event_at ? new Date(r.sports_event_at).toISOString() : null,
    messageId: r.message_id,
  }));
}
