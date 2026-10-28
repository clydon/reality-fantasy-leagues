import StateLogic from "@/lib/game/state-logic.js";
import { answerStanding, storedAnswers } from "./answer-points";
import { foldFor, isFolded, revealedThrough } from "@/lib/game/chat-fold";
import { accoladesOf, rankingsOf, trophiesOf, yourNumbers, type Accolade, type GameStanding, type Person, type Rankings, type StandingRow, type TrophyShelf, type YourNumbers } from "@/lib/game/couch-standings";
import { tableOf } from "@/lib/game/game-view";
import type { Taste } from "@/lib/game/ratings";
import { showWords } from "@/lib/game/show-words";
import { spanName } from "@/lib/game/spans";
import type { LeagueState } from "@/lib/game/types";
import type { SessionUser } from "./auth-helpers";
import { bingoLines } from "./bingo";
import { callRights, endedThrough } from "./calls";
import { AUTHOR_SEEN, REVEAL_SHARED, withReactions } from "./chat";
import { couchMembers, requireCouch } from "./couches";
import { pool } from "./db";
import { EVERYTHING, seenThrough, sharesSql, switchOn } from "./guard";
import { hiddenFromGroup } from "./late-join";
import { gameName } from "./league-season";
import { leagueStates } from "./league-states";
import { couchTaste } from "./ratings";
import { latestAired, seasonSchedules } from "./schedule";
import { runItBack } from "./start-game";
import { followsOf, games, seasonHeaders, type Game } from "./show-space";
import { plansLately, type PlanHow } from "./watch-plans";

// The hub's couch, for More on the couch, your profile's numbers and the feed (docs/PLAN-new-design.md step 8; GET
// /api/couches/[id]/hub): every game the couch plays, read as you may see it, turned into power rankings, the trophy
// shelf, Commercial break's "You're playing", By the numbers' couch accolades and your numbers (couch-standings.ts);
// and On the couch, what the couch has been up to and said lately. Since step 12 part 1 also your taste on the couch (your taste
// twin, how often you agree with the couch, how many shows have a verdict) and the accolades ratings can say (ratings.ts).
//
// Spoiler-safe through guard.ts: each game's table is your copy of it at your mark on its season (GhostLogic.viewFor), so
// a place, a title or a streak is never past where you are, and a season only ends for you once you've seen it end. The
// feed's messages fold as the couch chat does (chat-fold.ts): someone else's words since an episode you haven't seen
// aired never leave the server. Only what people share: follows watched privately aren't counted or shown.
//
// Read when the hub opens, never polled (docs/HOSTING.md): each league's state through league-states.ts (a hash each
// when nothing has moved), a few small queries, and the newest 40 messages of the couch's chats.

export interface PlayingGame {
  leagueId: string;
  seasonId: string;
  name: string;
  gameName: string;
  gameType: string;
  label: string;
  artUrl: string | null;
  /** Your place as far as you've seen ("T2"), and of how many; null before anything has scored. */
  rank: string | null;
  of: number;
  through: number;
  /** Its season has ended, as far as you've seen: the place is where you finished. */
  ended: boolean;
}

export interface FeedItem {
  id: string;
  /** started: someone started a game on the couch (step 10 part 2b; `text` is the game, "Weekly Lineup"). planned: someone
   *  planned a watch along (step 11 part 3; `episode`, `how`, `startsAt`, `going`). bingo: someone called BINGO on an episode
   *  (docs/PLAN-bingo-bank.md step 3; `episode`), opening their card. */
  kind: "said" | "revealed" | "joined" | "watching" | "started" | "planned" | "bingo";
  userId: string | null;
  name: string;
  at: string;
  /** What they said; the episode they revealed. */
  text?: string;
  episode?: number;
  /** The show it's about, and where it opens. */
  seasonId?: string;
  label?: string;
  reactions?: { emoji: string; n: number; mine: boolean }[];
  /** A planned night: the live airing or a shared start, when it starts, and how many are in so far. */
  how?: PlanHow;
  startsAt?: string;
  going?: number;
}

export interface CouchHub {
  couchId: string;
  rankings: Rankings | null;
  trophies: TrophyShelf | null;
  /** Every game of yours on the couch (Commercial break's "You're playing" is the ones still going; each poster's best). */
  games: PlayingGame[];
  accolades: Accolade[];
  you: YourNumbers;
  feed: FeedItem[];
  /** Run it back (step 10 part 2b): a finished game of yours, and the show's next season to play it again on. */
  again: { leagueId: string; seasonId: string; label: string }[];
  /** Rate it (step 12 part 1): your taste twin, how often you agree with the couch, how many shows have a verdict. */
  taste: Taste;
}

/** What a game's table says, for one viewer at their mark: who placed where, the streaks, predictions called. `calls`: Weekly
 *  Calls' or Weekly Bingo's (step 12), each player's right calls or lines, the episode they're through and whether the season's
 *  over (neither is in the state). */
function standingOf(
  state: LeagueState,
  playerId: string | null,
  mark: number | null,
  userOf: (p: string) => string | null,
  calls?: { right: (p: string) => number; through: number; ended: boolean }
): { rows: StandingRow[]; through: number; ended: boolean } {
  const view = StateLogic.GhostLogic.viewFor(state, playerId, mark);
  const pool = StateLogic.getLeagueType(view).hasWeeklyPicks;
  const called = new Map<string, number>();
  // Side bets called right, where they count (beside a draft: a pool's or Weekly Calls' never scored).
  if (StateLogic.betsOn(view)) for (const ep of view.episodes) for (const b of ep.bets || []) for (const p of b.predictions || []) if (p.correct === true) called.set(p.playerId, (called.get(p.playerId) ?? 0) + 1);
  const rows = tableOf(view, playerId ?? "", userOf, calls?.right).map((r) => ({
    userId: r.userId,
    name: r.name,
    place: r.place,
    rank: r.rank,
    total: r.total,
    ...(pool ? { best: r.total, streak: r.week ?? 0 } : {}),
    called: called.get(r.playerId) ?? 0,
  }));
  // A game over a span stands at its last episode (StateLogic.spanView), and is over once that's in (gameOver).
  const end = StateLogic.endEpisode(view);
  const seen = StateLogic.SpoilerLogic.latestWithResults(view);
  return { rows, through: calls ? calls.through : end === null ? seen : Math.min(seen, end), ended: calls ? calls.ended : StateLogic.gameOver(view) };
}

/** A game over a span (docs/PLAN-sports-data.md step 6), named in the show's own word ("Games 4–6"); null for a season game. */
function spanOf(state: LeagueState, episodeTerm: string | null | undefined): GameStanding["span"] {
  const to = StateLogic.endEpisode(state);
  const from = StateLogic.startEpisode(state);
  // A game still waiting for its phase (step A3) has no span to name yet.
  if (to === null || from === null) return null;
  const w = showWords({ episode: episodeTerm });
  return { from, to, name: spanName(from, to, { singular: w.episode.toLowerCase(), plural: w.episodes.toLowerCase() }) };
}

/** A Weekly Calls game's right calls, or a Weekly Bingo game's lines, through `through`, by player (on its couch); over once the
 *  season's last episode is within it. */
async function callsThrough(state: LeagueState, g: Game & { seasonId: string }, who: (p: string) => string | null, through: number, schedule: Parameters<typeof endedThrough>[0]) {
  const userIds = state.players.map((p) => who(p.id)).filter((id): id is string => !!id);
  // A game over a span counts its own episodes only.
  const end = StateLogic.endEpisode(state);
  const upTo = end === null ? through : Math.min(through, end);
  // Nothing counts while it waits for its phase (step A3).
  const from = StateLogic.startEpisode(state);
  const opts = { from: from ?? 0, through: upTo, couchId: g.couchId };
  const rights = from === null ? new Map<string, number>() : StateLogic.getLeagueType(state).hasBingo ? await bingoLines(g.seasonId, userIds, opts) : await callRights(g.seasonId, userIds, opts);
  return { right: (p: string) => rights.get(who(p) ?? "") ?? 0, through: upTo, ended: endedThrough(schedule, through, end) };
}

export async function couchHub(user: SessionUser, couchId: string): Promise<CouchHub> {
  await requireCouch(user, couchId);
  const [members, all] = await Promise.all([couchMembers([couchId]), games(user.id, { couchIds: [couchId] })]);
  const people: Person[] = (members.get(couchId) ?? []).map((m) => ({ userId: m.userId, name: m.name }));
  const list = all.filter((g): g is Game & { seasonId: string } => !!g.seasonId);
  const seasonIds = [...new Set(list.map((g) => g.seasonId))];
  const ids = list.map((g) => g.leagueId);
  const [headers, states, seats, marks, schedules] = await Promise.all([
    seasonHeaders(seasonIds),
    leagueStates(ids),
    ids.length ? pool.query("SELECT league_id, user_id, player_id FROM league_memberships WHERE league_id = ANY($1::uuid[])", [ids]) : { rows: [] },
    Promise.all(seasonIds.map(async (id) => [id, await seenThrough(user.id, id)] as const)).then((xs) => new Map(xs)),
    seasonSchedules(seasonIds),
  ]);
  const userOf = new Map<string, Map<string, string>>(ids.map((id) => [id, new Map()]));
  const mine = new Map<string, string>();
  for (const r of seats.rows) {
    if (r.player_id) userOf.get(r.league_id)?.set(r.player_id, r.user_id);
    if (r.user_id === user.id && r.player_id) mine.set(r.league_id, r.player_id);
  }

  // Each game as you may see it: now, and one episode back (who moved).
  const standings: GameStanding[] = [];
  for (const g of list) {
    const state = states.get(g.leagueId);
    const header = headers.get(g.seasonId);
    if (!state || !header) continue;
    const seen = marks.get(g.seasonId) ?? 0;
    const mark = seen === EVERYTHING ? null : seen;
    const who = (p: string) => userOf.get(g.leagueId)?.get(p) ?? null;
    try {
      // Weekly Calls and Weekly Bingo are through the latest show that's aired and you've seen, scored from the couch's calls or cards.
      const type = StateLogic.getLeagueType(state);
      const schedule = schedules.get(g.seasonId);
      const me = mine.get(g.leagueId) ?? null;
      // A game of questions (step A4) by its answers' points, graded at the mark, as its own table is.
      const rows = type.hasQuestions ? await storedAnswers(g.leagueId) : [];
      const answers = (m: number | null) => answerStanding({ leagueId: g.leagueId, state, playerId: me, mark: m, rows });
      const calls = type.hasQuestions ? await answers(mark) : type.hasCalls || type.hasBingo ? await callsThrough(state, g, who, Math.min(seen, latestAired(schedule)), schedule) : undefined;
      const now = standingOf(state, me, mark, who, calls);
      const back = calls && now.through >= 2 ? (type.hasQuestions ? await answers(now.through - 1) : await callsThrough(state, g, who, now.through - 1, schedule)) : undefined;
      const before = now.through >= 2 ? standingOf(state, mine.get(g.leagueId) ?? null, now.through - 1, who, back).rows : null;
      standings.push({
        leagueId: g.leagueId,
        name: g.name,
        gameName: g.gameName,
        gameType: g.gameType,
        seasonId: g.seasonId,
        showId: header.show.id,
        showName: header.show.name.replace(/^The /, ""),
        label: `${header.show.name.replace(/^The /, "")}${header.seasonNumber ? ` ${header.seasonNumber}` : ""}`,
        span: spanOf(state, header.show.terms.episode),
        artUrl: header.show.artUrl,
        year: header.premiereDate ? Number(header.premiereDate.slice(0, 4)) : null,
        through: now.through,
        // An archived game (step 10 part 2b) is over where it stood: it keeps its place on the trophy shelf.
        ended: now.ended || g.archived,
        rows: now.rows,
        before,
      });
    } catch (e) {
      // One unreadable league costs its game, not the hub.
      console.error(`[couch-hub] league ${g.leagueId}:`, e);
    }
  }

  const rankings = rankingsOf(standings, people, user.id, new Date().getFullYear());
  const trophies = trophiesOf(standings, people, user.id);
  const yours = standings
    .filter((g) => mine.has(g.leagueId))
    .map((g) => {
      const me = g.rows.find((r) => r.userId === user.id);
      return {
        leagueId: g.leagueId,
        seasonId: g.seasonId,
        name: g.name,
        gameName: g.gameName,
        gameType: g.gameType,
        label: g.label,
        artUrl: g.artUrl,
        rank: g.through > 0 && me ? me.rank : null,
        of: g.rows.length,
        through: g.through,
        ended: g.ended,
      };
    });

  const finished = standings.filter((g) => g.ended && yours.some((y) => y.leagueId === g.leagueId));
  const [accolades, feed, again, rated] = await Promise.all([
    accoladesFor(user, couchId, people, list, standings),
    feedFor(user, couchId, people, list, marks, schedules),
    runItBack(user, couchId, finished.map((g) => ({ leagueId: g.leagueId, seasonId: g.seasonId, gameType: g.gameType, span: g.span ?? null }))),
    couchTaste(user.id, couchId, people),
  ]);
  return {
    couchId,
    rankings,
    trophies,
    games: yours,
    accolades: [...accolades, ...rated.accolades],
    you: yourNumbers(standings, rankings, trophies, user.id),
    feed,
    again,
    taste: rated.taste,
  };
}

/**
 * By the numbers' couch accolades: what people share (open follows, of those who share Where I am), how much they've said this
 * month, the games; and the watch along's (step 13 part 3): reactions said to the couch and episodes watched along on it this
 * month, only on shows each follows openly and only from those who share them (My watch along reactions, When I'm watching: step
 * 15 part 3's What your couch sees, as their reactions and who's on now are heard), counted, never which. First to finish (step 14
 * part 2): each streaming season's earliest on the couch to reach its last episode (show_follows.finished_at), among you and those
 * who follow it openly and share Where I am, only on seasons you've finished yourself (so it says nothing your finale's verdict
 * doesn't) and two or more of them watch.
 */
async function accoladesFor(user: SessionUser, couchId: string, people: Person[], list: Game[], standings: GameStanding[]): Promise<Accolade[]> {
  const follows = (await followsOf(user.id, people.map((p) => p.userId))).filter((f) => f.following && !f.private);
  const [headers, { rows }, { rows: reacted }, { rows: along }, { rows: finishes }] = await Promise.all([
    seasonHeaders(follows.map((f) => f.seasonId)),
    pool.query(
      `SELECT user_id, count(*)::int AS n FROM chat_messages
        WHERE type = 'message' AND created_at > now() - interval '30 days'
          AND (league_id = ANY($1::uuid[]) OR (league_id IS NULL AND couch_id = $2))
        GROUP BY user_id`,
      [list.map((g) => g.leagueId), couchId]
    ),
    pool.query(
      `SELECT r.user_id, count(*)::int AS n FROM watch_reactions r
        WHERE r.couch_id = $1 AND r.created_at > now() - interval '30 days' AND ${sharesSql("reactions", "r.user_id", "r.season_id")}
        GROUP BY r.user_id`,
      [couchId]
    ),
    // A watch along counts once its clock has run a minute (opening one and closing it isn't watching along).
    pool.query(
      `SELECT p.user_id, count(DISTINCT (s.season_id, s.episode))::int AS n
         FROM watch_session_people p JOIN watch_sessions s ON s.id = p.session_id
        WHERE s.couch_id = $1 AND p.joined_at > now() - interval '30 days' AND ${sharesSql("now", "p.user_id", "s.season_id")}
          AND s.clock_ms + CASE WHEN s.running_since IS NULL OR s.running_since > now() THEN 0
                ELSE EXTRACT(EPOCH FROM (now() - s.running_since)) * 1000 END >= 60000
        GROUP BY p.user_id`,
      [couchId]
    ),
    pool.query(
      `WITH counted AS (
         SELECT f.season_id, f.user_id, f.finished_at FROM show_follows f
          WHERE f.user_id = ANY($1::text[]) AND (f.user_id = $2 OR (f.following AND NOT f.private AND ${switchOn("where", "f.user_id")})))
       SELECT DISTINCT ON (c.season_id) c.user_id, c.finished_at, ss.drop_at, s.name AS show_name
         FROM counted c JOIN show_seasons ss ON ss.id = c.season_id JOIN shows s ON s.id = ss.show_id
        WHERE ss.release = 'binge' AND c.finished_at IS NOT NULL AND ss.episode_count > 0
          AND EXISTS (SELECT 1 FROM show_follows me WHERE me.user_id = $2 AND me.season_id = c.season_id AND me.seen_through >= ss.episode_count)
          AND (SELECT count(*) FROM counted o WHERE o.season_id = c.season_id) >= 2
        ORDER BY c.season_id, c.finished_at`,
      [[...new Set([user.id, ...people.map((p) => p.userId)])], user.id]
    ),
  ]);
  return accoladesOf({
    firstFinishes: finishes.map((r) => ({
      userId: r.user_id as string,
      showName: (r.show_name as string).replace(/^The /, ""),
      at: new Date(r.finished_at).getTime(),
      dropAt: r.drop_at ? new Date(r.drop_at).getTime() : null,
    })),
    reactions: new Map(reacted.map((r) => [r.user_id as string, r.n as number])),
    watchAlongs: new Map(along.map((r) => [r.user_id as string, r.n as number])),
    people,
    follows: follows.flatMap((f) => {
      const h = headers.get(f.seasonId);
      return h ? [{ userId: f.userId, showId: h.show.id, showName: h.show.name.replace(/^The /, "") }] : [];
    }),
    messages: new Map(rows.map((r) => [r.user_id as string, r.n as number])),
    games: standings,
  });
}

const FEED_SIZE = 8;

/**
 * On the couch: the newest of what's been said in the couch's chats (folded past where you are, as the chat folds:
 * someone's words since an episode you haven't seen aired are left out), who revealed what, who joined, who
 * started watching a show they don't play (openly), and who planned a watch along (step 11 part 3). Who revealed what and who
 * started watching what only from those who share Where I am (step 15 part 3).
 */
async function feedFor(
  user: SessionUser,
  couchId: string,
  people: Person[],
  list: (Game & { seasonId: string })[],
  marks: Map<string, number>,
  schedules: Awaited<ReturnType<typeof seasonSchedules>>
): Promise<FeedItem[]> {
  const seasonOf = new Map(list.map((g) => [g.leagueId, g.seasonId]));
  const ids = list.map((g) => g.leagueId);
  const { rows: said } = await pool.query(
    `SELECT id, league_id, season_id, user_id, author_name, type, text, created_at, ${AUTHOR_SEEN} FROM chat_messages
      WHERE (league_id = ANY($1::uuid[]) OR (league_id IS NULL AND couch_id = $2)) AND type IN ('message', 'reveal') AND ${REVEAL_SHARED("$3")}
      ORDER BY created_at DESC LIMIT 40`,
    [ids, couchId, user.id]
  );
  // Seasons a chat mentions that the couch has no game on (a show it only watches) need their own marks and schedules.
  const extra = [...new Set(said.map((m) => m.season_id as string | null).filter((id): id is string => !!id && !marks.has(id)))];
  const [moreMarks, moreSchedules, headers, out] = await Promise.all([
    Promise.all(extra.map(async (id) => [id, await seenThrough(user.id, id)] as const)),
    seasonSchedules(extra),
    seasonHeaders([...new Set([...list.map((g) => g.seasonId), ...extra])]),
    // Per season, as its chat decides (couch-chat.ts chatScope): out of the conversation of the couch's games there.
    Promise.all(
      [...new Set(list.map((g) => g.seasonId))].map(async (id) => [id, (await hiddenFromGroup(list.filter((g) => g.seasonId === id).map((g) => g.leagueId))).has(user.id)] as const)
    ).then((xs) => new Set(xs.filter(([, o]) => o).map(([id]) => id))),
  ]);
  const markOf = new Map([...marks, ...moreMarks]);
  const label = (seasonId: string) => {
    const h = headers.get(seasonId);
    return h ? `${h.show.name.replace(/^The /, "")}${h.seasonNumber ? ` ${h.seasonNumber}` : ""}` : "";
  };
  const folds = new Map<string, ReturnType<typeof foldFor>>();
  const foldOf = (seasonId: string) => {
    if (!folds.has(seasonId)) {
      const schedule = schedules.get(seasonId) ?? moreSchedules.get(seasonId);
      folds.set(seasonId, foldFor((schedule?.episodes ?? []).map((e) => ({ number: e.number, airAt: e.airAt })), markOf.get(seasonId) ?? 0, null));
    }
    return folds.get(seasonId)!;
  };
  const items: FeedItem[] = [];
  const shown = said.filter((m) => {
    const seasonId = m.league_id ? seasonOf.get(m.league_id) : m.season_id;
    // A late joiner catching up has no chat in the couch's games yet (Chat opens later), and folded words stay folded.
    if (!seasonId || (m.league_id && out.has(seasonId))) return false;
    return !isFolded(m, foldOf(seasonId), user.id);
  });
  const reacted = new Map((await withReactions(shown.filter((m) => m.type === "message"))).map((m) => [m.id, m.reactions]));
  for (const m of shown) {
    const seasonId = (m.league_id ? seasonOf.get(m.league_id) : m.season_id) as string;
    const base = { id: m.id, userId: m.user_id, name: m.author_name, at: new Date(m.created_at).toISOString(), seasonId, label: label(seasonId) };
    if (m.type === "reveal") {
      const n = revealedThrough(m.text ?? "");
      if (n !== null && m.user_id !== user.id) items.push({ ...base, kind: "revealed", episode: n });
    } else {
      const r = reacted.get(m.id) ?? {};
      items.push({
        ...base,
        kind: "said",
        text: m.text,
        reactions: Object.entries(r).map(([emoji, x]) => ({ emoji, n: x.count, mine: x.userIds.includes(user.id) })),
      });
    }
  }

  // Who joined the couch lately, who started a game, and who started watching something openly that they don't play.
  const member = new Map(people.map((p) => [p.userId, p.name]));
  const [{ rows: joined }, { rows: watching }, { rows: started }, planned, { rows: called }] = await Promise.all([
    // Someone joining a couch that was already going: not its founders (on it from the start), and not you.
    pool.query(
      `SELECT m.user_id, m.joined_at FROM couch_members m JOIN couches c ON c.id = m.couch_id
        WHERE m.couch_id = $1 AND m.user_id <> $2 AND m.joined_at > now() - interval '60 days' AND m.joined_at > c.created_at + interval '1 minute'`,
      [couchId, user.id]
    ),
    pool.query(
      `SELECT f.user_id, f.season_id, f.created_at FROM show_follows f
        WHERE f.user_id = ANY($1::text[]) AND f.following AND NOT f.private AND ${switchOn("where", "f.user_id")} AND f.created_at > now() - interval '60 days'
          AND NOT EXISTS (SELECT 1 FROM league_memberships m JOIN leagues l ON l.id = m.league_id
                           JOIN shows s ON s.slug = l.state->'settings'->>'showId'
                           JOIN show_seasons ss ON ss.show_id = s.id AND ss.season_number::text = l.state->'settings'->>'wikiSeason'
                          WHERE m.user_id = f.user_id AND ss.id = f.season_id)`,
      [people.map((p) => p.userId)]
    ),
    // Games started in the new design (step 10 part 2b): their first line in Recent changes.
    pool.query(
      `SELECT c.league_id, c.user_id, c.created_at, l.state->'settings'->>'leagueTypeId' AS type FROM league_changes c JOIN leagues l ON l.id = c.league_id
        WHERE c.league_id = ANY($1::uuid[]) AND c.kind = 'game.start' AND c.created_at > now() - interval '60 days'`,
      [ids]
    ),
    // Planned nights (step 11 part 3): never a title, only when and who's in.
    plansLately(couchId),
    // BINGO called (bingo step 3), as the call's notice goes: on a show you follow, an episode you've seen or have a card on,
    // by someone who shares their games on it. The words say nothing of what happened; their card is spoiler-guarded.
    pool.query(
      `SELECT c.user_id, c.season_id, c.episode, (SELECT min((x->>'at')::timestamptz) FROM jsonb_array_elements(c.called_lines) x) AS at
         FROM bingo_cards c
        WHERE c.user_id = ANY($1::text[]) AND c.user_id <> $2 AND jsonb_array_length(c.called_lines) > 0 AND ${sharesSql("play", "c.user_id", "c.season_id")}
          AND EXISTS (SELECT 1 FROM show_follows f WHERE f.user_id = $2 AND f.season_id = c.season_id AND f.following
                        AND (f.seen_through >= c.episode OR EXISTS (SELECT 1 FROM bingo_cards m WHERE m.user_id = $2 AND m.season_id = c.season_id AND m.episode = c.episode)))`,
      [people.map((p) => p.userId), user.id]
    ),
  ]);
  for (const s of started) {
    const seasonId = seasonOf.get(s.league_id) as string;
    items.push({
      id: `start-${s.league_id}`,
      kind: "started",
      userId: s.user_id,
      name: member.get(s.user_id) ?? "",
      at: new Date(s.created_at).toISOString(),
      text: gameName(s.type),
      seasonId,
      label: label(seasonId),
    });
  }
  const planLabels = await seasonHeaders(planned.map((p) => p.seasonId).filter((id) => !headers.has(id)));
  for (const p of planned) {
    const h = headers.get(p.seasonId) ?? planLabels.get(p.seasonId);
    if (!h) continue;
    items.push({
      id: `plan-${p.id}`,
      kind: "planned",
      userId: p.userId,
      name: (p.userId && member.get(p.userId)) || "",
      at: p.at,
      seasonId: p.seasonId,
      label: `${h.show.name.replace(/^The /, "").replace(/\s*\([^)]*\)\s*$/, "")}${h.seasonNumber ? ` ${h.seasonNumber}` : ""}`,
      episode: p.episode,
      how: p.how,
      startsAt: p.startsAt,
      going: p.going,
    });
  }
  for (const j of joined) items.push({ id: `join-${j.user_id}`, kind: "joined", userId: j.user_id, name: member.get(j.user_id) ?? "", at: new Date(j.joined_at).toISOString() });
  const calledLabels = await seasonHeaders(called.map((c) => c.season_id as string).filter((id) => !headers.has(id)));
  for (const c of called) {
    const h = headers.get(c.season_id) ?? calledLabels.get(c.season_id);
    if (!h || !c.at || Date.now() - new Date(c.at).getTime() > 60 * 24 * 60 * 60 * 1000) continue;
    items.push({
      id: `bingo-${c.user_id}-${c.season_id}-${c.episode}`,
      kind: "bingo",
      userId: c.user_id,
      name: member.get(c.user_id) ?? "",
      at: new Date(c.at).toISOString(),
      seasonId: c.season_id,
      label: `${h.show.name.replace(/^The /, "")}${h.seasonNumber ? ` ${h.seasonNumber}` : ""}`,
      episode: c.episode,
    });
  }
  const watchLabels = await seasonHeaders(watching.map((w) => w.season_id));
  for (const w of watching) {
    const h = watchLabels.get(w.season_id);
    if (!h) continue;
    items.push({
      id: `watch-${w.user_id}-${w.season_id}`,
      kind: "watching",
      userId: w.user_id,
      name: member.get(w.user_id) ?? "",
      at: new Date(w.created_at).toISOString(),
      seasonId: w.season_id,
      label: `${h.show.name.replace(/^The /, "")}${h.seasonNumber ? ` ${h.seasonNumber}` : ""}`,
    });
  }
  return items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, FEED_SIZE);
}
