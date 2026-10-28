import StateLogic from "@/lib/game/state-logic.js";
import { addBot, MAX_BOTS, type BotLevel } from "@/lib/game/computer-players";
import { gameLine, gamesFor, noFitLine } from "@/lib/game/formats/rulebook-fits.js";
import type { GameFit, SeasonGameKey } from "@/lib/game/formats/rulebook-fits";
import type { RulebookBlocks, RulebookKind } from "@/lib/game/formats/rulebook-schema";
import { showWords } from "@/lib/game/show-words";
import { nextSpan, spanChoices, spanEnds, spanName, type SpanChoice, type SpanEpisode } from "@/lib/game/spans";
import type { LeagueState } from "@/lib/game/types";
import { MAX_BENCH, MAX_STARTERS, MAX_TEAM, NO_WAIVERS, waiversFit } from "@/lib/game/game-spec/index.js";
import type { GameSpec, Question, SpecContext } from "@/lib/game/game-spec/index.js";
import { chosenQuestions, questionChoices, type QuestionChoice } from "@/lib/game/question-choices";
import { contextOf, questionBook } from "./answers";
import { isUuid, type SessionUser } from "./auth-helpers";
import { recordChange } from "./change-log";
import { couchMembers, requireCouch } from "./couches";
import { pool, HttpError } from "./db";
import { followLeagueProgress } from "./follows";
import { refused } from "./game-writes";
import { linkProblem } from "./league-groups";
import { leagueStates } from "./league-states";
import { makeLeague } from "./new-game";
import { copyOf } from "./ours";
import { leaguePhases, phasesFrom, scheduleOf, seasonBlocks, settleIn } from "./phase-starts";
import { notifyGameStarted } from "./push-events";
import { latestAired, seasonSchedules, type SeasonSchedule } from "./schedule";
import { followsOf, games, seasonHeaders, type Game } from "./show-space";

// Start a game that fits (docs/PLAN-new-design.md step 10 part 2b; the mock's rulebook.js newGameW, rbGameLine, RB_FITS and
// RB_NOFIT). Anyone on a couch starts a season game on a show that's set up, from the next episode to air: only the games
// its rulebook can feed (rulebook-fits.js gamesFor), the kind's first recommended, the rest said why not.
//
//   A competition  Survival Pool, Weekly Lineup, Outlast
//   A series       Weekly Lineup: draft the crew (reality) or the characters (scripted)
//   Talk           Weekly Bingo (step 12 part 3: a card a show, scored from its lines, bingo.ts) and Weekly Calls (part 2:
//                  two calls a show, scored from Call it, calls.ts)
//   A sport        the draft of athletes (Weekly Lineup, castaways on several teams: the blind draft, start some each
//                  race) and Survival Pool (a pick survives a race by scoring in it: settings.poolSurvive 'scores')
//
// The new game is the starter's (its Commissioner), on the couch, linked to the couch's other games on the season (one
// reveal and one chat: Noticed's "A couch with two unlinked games"), playing by the couch's own copy of the rules when it
// made them its own (Make it ours) or the season's rulebook (new-game.ts makeLeague: syncLeagueRulebook), a line in its
// Recent changes and the couch's feed, and, with Tell the couch, one push to everyone else on it. Everyone else joins
// from the Games tab as step 9's joins do (shared or no teams: anyone on the couch; exclusive: ask first).
//
// Run it back: the same game on the show's next season, with its name and settings, from a game whose season is over; and a
// game over a span that's over, on the next span of its season (spans.ts nextSpan: the next series after a series, else the
// same number of episodes again), until a game of its kind has started there since.
//
// Include it (2026-10-27): an episode that started in the last ON_AIR_MS can be the game's first (`late`): it starts there, and
// that episode's lineups and picks stay open past its start (ep.openPastAir, state-logic.js closedForPlay; Backstage ›
// Settings' lock locks it) until its results are in. Honour system: for a couch that sat down after the start and wants to play tonight's anyway.
//
// How long (docs/PLAN-sports-data.md step 6, spans.ts): a game runs to the season's end, or through a chosen episode
// (settings.endEpisode): just the next one, this series (a sport's consecutive linked games between the same teams), or any
// later episode the listing has. Nothing after its last episode scores, and it's over once that one has results.
//
// Starts (docs/PLAN-start-a-game-gpt.md step A3): with the next episode to air, or any later one the listing has
// (settings.startEpisode): the game waits until then (nothing before it scores, its moves are for its first episode) and its
// draft can happen first. How long then counts from there. Game settings moves the start until it airs. Or when a phase of the
// season's rulebook starts (part 2, phase-starts.ts: "When Merged starts", each phase still to come): the game waits for it
// (settings.startPhase) and plays from where data says it starts, settled now when that's known and ahead. It runs to the
// season's end (an end can be set in Game settings once its start is settled).
//
// Its episodes are called what the show calls them (shows.episode_term, as the hub, plaques and Game settings say), not
// what its rulebook does: one word for an episode (docs/BACKLOG.md item 10).

/** A game Start a game makes: a season game that fits the rulebook, or a Prediction Sheet (a game of questions, step A4 part 2). */
export type StartKey = SeasonGameKey | "questions";

export interface StartChoice extends Omit<GameFit, "key" | "type"> {
  key: StartKey;
  type: GameFit["type"] | "questions";
  /** What it is on this show, in a line ("Draft five drivers, start three each race"). */
  line: string;
  /** How many of this game the couch already plays here. */
  have: number;
  /** Computer players can join it (computer-players.ts botsPlay: the drafts and Survival Pool, on any show). */
  bots: boolean;
}

/** A question a Prediction Sheet can ask on this show (question-choices.ts), as Start a game lists it. */
export interface StartQuestion {
  id: string;
  ask: string;
  /** "Each episode · 2 points". */
  line: string;
  /** On by default. */
  on: boolean;
  /** The season's to settle: only in a game that runs to the season's end. */
  season: boolean;
}

export interface StartOptions {
  seasonId: string;
  /** "Survivor 51". */
  label: string;
  /** How people say it: "Formula 1", "Survivor". */
  show: string;
  artUrl: string | null;
  kind: RulebookKind;
  /** A series' starting point. */
  start: "reality" | "scripted" | null;
  /** What one part of the season is called ("episode", a sport's "race"). */
  part: { singular: string; plural: string };
  /** The game starts with this episode (the next to air; 1 before the premiere; with `late`, the one on now; or the later one
   *  asked with `start`). */
  from: number;
  /** The next episode to air: where a game starts unless it's told otherwise. (Not `next`, which was the next season's
   *  until step A3: a phone still on the bundle before it reads that name.) */
  nextEpisode: number;
  /** The listed episodes it can start with (Starts), the next to air first, then any later one, with their air times; a
   *  title only where it gives nothing away (spanEpisodes). */
  starts: { number: number; title: string | null; airAt: string | null }[];
  /** The phases of the season's rulebook it can start with instead (Starts' "When Merged starts", step A3): each one still to
   *  come, never the first (that's Episode 1); `at` the episode it would play from when that's known and ahead, else null. */
  phases: { id: string; name: string; summary: string | null; at: number | null }[];
  /** An episode that's started but may still be on (in the last ON_AIR_MS): Include it starts the game there. */
  onAir: { number: number; airAt: string } | null;
  /** These options start with the episode on now (asked with `late`). */
  late: boolean;
  /** How long it can run (spans.ts): the rest of the season first, then just `from`, then this series when there's one. */
  spans: SpanChoice[];
  /** Any later episode the listing has, to end with instead ("Through Game 6"). */
  ends: { number: number; title: string | null }[];
  /** Every season game, `fits` or not, the kind's first recommended. */
  games: StartChoice[];
  /** Why the games that don't fit don't (the mock's RB_NOFIT), or null. */
  noFit: string | null;
  /** A Prediction Sheet's questions on this show, from its moments (step A4 part 2): only what data settles. */
  questions: StartQuestion[];
  /** Others on the couch who watch it or play it (Tell the couch's line). */
  watchers: string[];
  /** Why nothing can start here, or null. */
  blocked: string | null;
  couch: { id: string; name: string; members: number };
  /** Run it back: the game it plays again (the same game, name and settings), and, when that was a span, the next one's last
   *  episode (to start with; null: to the season's end). `label` says which it was ("ZT Survivor 51 · Episodes 6–7"). `phase`:
   *  it started when a phase did, and this season has that phase still to come (the sheet starts it there too). */
  again: {
    leagueId: string;
    name: string;
    gameName: string;
    key: StartKey;
    label: string;
    to: number | null;
    phase: string | null;
    /** A Prediction Sheet's questions it asked that this season can still ask (step A4 part 2): what it starts with again. */
    questions: string[] | null;
  } | null;
  /** Once this season's over: the show's next season to run a game back on (set up, still to finish), or null. */
  nextSeason: { seasonId: string; label: string } | null;
}

/** A game of questions' name (league-season.ts). */
const SHEET = "Prediction Sheet";

/** A Prediction Sheet's questions on a season, by the rules a couch's games there play by (its own copy, else the season's). */
async function sheetChoices(seasonId: string, copy: Awaited<ReturnType<typeof copyOf>>, part: string): Promise<QuestionChoice[]> {
  const book = await questionBook(seasonId, copy);
  return questionChoices({ ...book, blocks: { ...book.blocks, parts: { ...book.blocks.parts, singular: part, plural: `${part}s` } } }, contextOf(book));
}

const KEY_OF: Record<string, StartKey> = {
  questions: "questions",
  pickem: "survivalPool",
  "active-roster": "weeklyLineup",
  "classic-draft": "outlast",
  "weekly-calls": "weeklyCalls",
  "weekly-bingo": "weeklyBingo",
};

/** "Game 4": a part of the season by its number, in the show's word. */
const partAt = (o: Pick<StartOptions, "part" | "from">) => `${o.part.singular.replace(/^./, (c) => c.toUpperCase())} ${o.from}`;

/** How long after it starts an episode counts as on now, for Include it (a ballgame runs three hours and more). */
const ON_AIR_MS = 6 * 3600 * 1000;

/** The games computer players play (bot-logic.js): the drafts and Survival Pool. */
const BOT_GAMES = new Set<SeasonGameKey>(["survivalPool", "weeklyLineup", "outlast"]);

/** "Survivor", "Formula 1": a show as people say it. */
const plain = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, "").replace(/^The /, "").trim() || name;

/** The next episode still to air; 1 before the premiere. */
function startFrom(schedule: SeasonSchedule | undefined, now: Date): number {
  for (const ep of schedule?.episodes ?? []) if (ep.airAt && new Date(ep.airAt).getTime() > now.getTime()) return ep.number;
  return latestAired(schedule, now) + 1;
}

/**
 * The season's listed episodes, each with its linked game's teams (season_events: a sport's provider games), for the spans and
 * the starts. Every one listed here is still to come, so a title stays only where it gives nothing away (as schedule.ts
 * titledFor and stepEpisodes keep them): a sport's, or a linked game's ("Game 6: Rays at Brewers", the matchup). A reality
 * show's titles are quotes from the episode.
 */
async function spanEpisodes(seasonId: string, schedule: SeasonSchedule | undefined, sport: boolean): Promise<SpanEpisode[]> {
  const { rows } = await pool.query("SELECT episode, teams FROM season_events WHERE season_id = $1", [seasonId]);
  const teams = new Map(rows.map((r) => [r.episode as number, (r.teams as SpanEpisode["teams"]) ?? null]));
  return (schedule?.episodes ?? []).map((e) => {
    const linked = teams.get(e.number) ?? null;
    return { number: e.number, title: sport || linked ? (e.title ?? null) : null, teams: linked };
  });
}

/** The couch's games on a season (not deleted), in its order. */
const couchGamesOn = (user: SessionUser, couchId: string, seasonId: string) => games(user.id, { couchIds: [couchId], seasonId });

/**
 * What can be started on a season for a couch (GET /api/seasons/[id]/start?couch=&again=&late=&start=): `late` from the episode
 * on now (Include it), else `start` a later listed episode to start with (Starts), else the next to air.
 */
export async function startOptions(
  user: SessionUser,
  seasonId: string,
  couchId: string | null,
  againId?: string | null,
  now = new Date(),
  late = false,
  start: number | null = null
): Promise<StartOptions> {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  if (!couchId || !isUuid(couchId)) throw new HttpError(400, "couch required");
  const role = await requireCouch(user, couchId);
  if (role === "viewer") throw new HttpError(403, "Join the couch to start a game on it");
  const [headers, schedules, members, { rows: couchRows }] = await Promise.all([
    seasonHeaders([seasonId]),
    seasonSchedules([seasonId], now),
    couchMembers([couchId]),
    pool.query("SELECT name FROM couches WHERE id = $1", [couchId]),
  ]);
  const h = headers.get(seasonId);
  if (!h) throw new HttpError(404, "Season not found");
  const schedule = schedules.get(seasonId);
  const people = members.get(couchId) ?? [];
  const here = await couchGamesOn(user, couchId, seasonId);

  const season = await seasonBlocks(seasonId);
  const { blocks: book, compiled } = season;
  // One word for an episode: the show's (episode_term), in every line the rulebook words too.
  const words = showWords(h.show.terms);
  const part = { singular: words.episode.toLowerCase(), plural: words.episodes.toLowerCase() };
  const blocks: RulebookBlocks = { ...book, parts: { ...book.parts, ...part } };
  const fits = gamesFor(blocks, compiled);
  const have = (key: StartKey) => here.filter((g) => KEY_OF[g.gameType] === key && !g.archived).length;
  const show = plain(h.show.name);
  // Every season game with whether it fits (the sheet shows the ones that do; the rest are the doesn't-fit line).
  const choices: StartChoice[] = fits.map((g) => ({ ...g, line: gameLine(g.key, blocks) ?? "", have: have(g.key), bots: BOT_GAMES.has(g.key) }));
  // A Prediction Sheet (step A4 part 2): questions from the show's moments, by the rules its games here play by. Not a sport's
  // (its settles are the sports branch's) nor a talk show's (whose moments are the couch's word).
  const copy = await copyOf(here.map((g) => g.leagueId));
  const kind = (blocks.kind ?? h.show.kind) as RulebookKind;
  const asks = kind === "sport" || kind === "talk" ? [] : await sheetChoices(seasonId, copy, part.singular);
  choices.push({
    key: "questions",
    name: SHEET,
    type: "questions",
    fits: asks.length > 0,
    needs: "moments the show's research answers",
    soon: null,
    line: `No draft · a few questions before each ${part.singular}${asks.some((q) => q.question.id === "wins") ? ", and who wins" : ""}`,
    have: have("questions"),
    bots: false,
  });

  // Who on the couch watches it openly or plays it, for Tell the couch's line (never how far: the guard).
  const others = people.filter((p) => p.userId !== user.id);
  const follows = await followsOf(user.id, others.map((p) => p.userId));
  const players = new Set(
    here.length
      ? (await pool.query("SELECT DISTINCT user_id FROM league_memberships WHERE league_id = ANY($1::uuid[])", [here.map((g) => g.leagueId)])).rows.map((r) => r.user_id as string)
      : []
  );
  const watchers = others.filter((p) => players.has(p.userId) || follows.some((f) => f.userId === p.userId && f.seasonId === seasonId && f.following && !f.private)).map((p) => p.name);

  const next = startFrom(schedule, now);
  const eps = schedule?.episodes ?? [];
  const started = eps.filter((e) => e.number < next && e.airAt && Date.parse(e.airAt) <= now.getTime()).at(-1);
  const onAir = started && now.getTime() - Date.parse(started.airAt!) < ON_AIR_MS ? { number: started.number, airAt: started.airAt! } : null;
  const spanEps = await spanEpisodes(seasonId, schedule, (blocks.kind ?? h.show.kind) === "sport");
  const airAt = new Map(eps.map((e) => [e.number, e.airAt ?? null]));
  const starts = spanEps.filter((e) => e.number >= next).map((e) => ({ number: e.number, title: e.title, airAt: airAt.get(e.number) ?? null }));
  const later = !late && start !== null && starts.some((e) => e.number === start) ? start : null;
  const from = late && onAir ? onAir.number : (later ?? next);
  const over = h.status === "completed" || (h.status !== "upcoming" && eps.length > 0 && eps.every((e) => e.airAt && new Date(e.airAt).getTime() <= now.getTime()));
  // The phases still to come (step A3), by the rules its games here play by (the couch's own copy, else the season's): not the
  // first, and either not started yet as far as anyone's said, or starting at an episode still to air.
  const phases = phasesFrom(season, copy)
    .filter((p) => !p.first && (p.from === null || p.from >= next))
    .map((p) => ({ id: p.id, name: p.name, summary: p.summary, at: p.from }));
  const blocked = h.ready === false ? `Make ${show} a game first` : over ? "The season's over: every episode has aired" : null;

  let again: StartOptions["again"] = null;
  if (againId) {
    if (!isUuid(againId)) throw new HttpError(404, "That game isn't here");
    const { rows } = await pool.query(
      `SELECT l.id, l.name, l.state->'settings'->>'leagueTypeId' AS type, s.name AS show, ss.season_number, ss.id AS season_id,
              l.state->'settings'->'startEpisode' AS start_episode, l.state->'settings'->'endEpisode' AS end_episode,
              l.state->'settings'->>'startPhase' AS start_phase, l.state->'settings'->'questions' AS questions
         FROM leagues l JOIN league_memberships m ON m.league_id = l.id AND m.user_id = $2
         JOIN shows s ON s.slug = l.state->'settings'->>'showId'
         JOIN show_seasons ss ON ss.show_id = s.id AND ss.season_number::text = l.state->'settings'->>'wikiSeason'
        WHERE l.id = $1 AND l.deleted_at IS NULL AND s.id = $3`,
      [againId, user.id, h.show.id]
    );
    const r = rows[0];
    const key = r ? KEY_OF[r.type || "classic-draft"] : undefined;
    if (!r || !key) throw new HttpError(404, "That game isn't one of yours on this show");
    // A span runs back on the next one (from the next episode to air); a season game on the season's end, as before; a game that
    // started with a phase (step A3) from the same phase, when it's still to come here (else as a season game).
    const last = Number.isInteger(r.end_episode) && !r.start_phase ? { from: Number.isInteger(r.start_episode) ? (r.start_episode as number) : 1, to: r.end_episode as number } : null;
    const to = last ? (nextSpan(spanEps, from, last) ?? null) : null;
    again = {
      leagueId: r.id,
      name: r.name,
      gameName: key === "questions" ? SHEET : (fits.find((g) => g.key === key)?.name ?? r.name),
      key,
      // The same season's: just its span ("Episodes 6–7"); another's, the season too.
      label: last && r.season_id === seasonId ? spanName(last.from, last.to, part) : `${plain(r.show)} ${r.season_number}${last ? ` · ${spanName(last.from, last.to, part)}` : ""}`,
      to,
      phase: r.start_phase && phases.some((p) => p.id === r.start_phase) ? (r.start_phase as string) : null,
      // A Prediction Sheet asks again what it asked, as far as this season's rules can (the season's only to its end).
      questions:
        key === "questions"
          ? ((Array.isArray(r.questions) ? r.questions : []) as { id?: string }[])
              .map((x) => x.id)
              .filter((id): id is string => !!id && asks.some((c) => c.question.id === id && (to === null || !c.season)))
          : null,
    };
  }

  let nextSeason: StartOptions["nextSeason"] = null;
  if (over && h.ready !== false) {
    const { rows } = await pool.query(
      `SELECT id, season_number FROM show_seasons WHERE show_id = $1 AND season_number > $2 AND status <> 'completed' ORDER BY season_number LIMIT 1`,
      [h.show.id, h.seasonNumber ?? 0]
    );
    if (rows.length) nextSeason = { seasonId: rows[0].id, label: `${show} ${rows[0].season_number}` };
  }

  return {
    seasonId,
    nextSeason,
    onAir,
    late: late && !!onAir,
    label: `${show}${h.seasonNumber ? ` ${h.seasonNumber}` : ""}`,
    show,
    artUrl: h.show.artUrl,
    kind: (blocks.kind ?? h.show.kind) as RulebookKind,
    start: blocks.kind === "series" ? (blocks.start ?? "reality") : null,
    part,
    from,
    nextEpisode: next,
    starts,
    phases,
    spans: spanChoices(spanEps, from, part),
    ends: spanEnds(spanEps, from),
    games: choices,
    noFit: noFitLine(fits, blocks, show),
    questions: asks.map((c) => ({ id: c.question.id, ask: c.question.ask, line: c.line, on: c.on, season: c.season })),
    watchers,
    blocked,
    couch: { id: couchId, name: couchRows[0]?.name ?? "Your couch", members: people.length },
    again,
  };
}

/**
 * What a game run back keeps of the one it plays again, as parts of its spec (its shape, never its results or people): how
 * you get yours (a draft's ownership and size, within the limits a new game has), what counts, a pool's points, who can
 * join, and the draft room's timer (not its time).
 */
function againParts(kept: Readonly<GameSpec>, mine: GameSpec): Partial<GameSpec> {
  const out: Partial<GameSpec> = {};
  if (kept.get.by === "draft" && mine.get.by === "draft") {
    const lineup = !!(kept.count && "start" in kept.count && mine.count && "start" in mine.count);
    if (lineup) {
      const start = Math.min((kept.count as { start: number }).start, MAX_STARTERS);
      const bench = Math.min(Math.max(0, kept.get.each - (kept.count as { start: number }).start), MAX_BENCH);
      out.get = { ...kept.get, each: start + bench };
      out.count = { start };
    } else out.get = { ...kept.get, each: Math.min(kept.get.each, MAX_TEAM) };
  }
  if (kept.score.by === "survive" && mine.score.by === "survive") out.score = { ...mine.score, points: kept.score.points };
  const room = kept.extras.draft && mine.extras.draft ? { ...mine.extras.draft, timer: kept.extras.draft.timer, away: kept.extras.draft.away } : mine.extras.draft;
  // Its waivers follow the ownership it keeps: none in a shared Outlast (no free agents), else the new game's own.
  const waivers = waiversFit({ ...mine, ...out }) ? (mine.extras.waivers ?? NO_WAIVERS) : null;
  out.extras = { ...mine.extras, join: kept.extras.join ?? mine.extras.join, draft: room, waivers };
  return out;
}

/** A name the couch doesn't use for another of its games here ("Weekly Lineup 2"). */
function freeName(want: string, here: Game[]): string {
  const taken = new Set(here.map((g) => g.name.toLowerCase()));
  if (!taken.has(want.toLowerCase())) return want;
  for (let n = 2; ; n++) if (!taken.has(`${want} ${n}`.toLowerCase())) return `${want} ${n}`;
}

/** Joins the new game to the couch's other games here: one reveal and one chat (the classic link route's rule). */
async function linkIn(leagueId: string, here: Game[], userId: string): Promise<boolean> {
  if (!here.length) return false;
  const states = await leagueStates([leagueId, ...here.map((g) => g.leagueId)]);
  const mine = states.get(leagueId);
  if (!mine) return false;
  // Into the first game's group, when every game in it can share a reveal with this one.
  const lead = here[0];
  const group = here.filter((g) => (lead.groupId ? g.groupId === lead.groupId : g.leagueId === lead.leagueId));
  if (group.some((g) => !states.get(g.leagueId) || linkProblem(mine, states.get(g.leagueId) as LeagueState))) return false;
  let groupId = lead.groupId;
  if (!groupId) {
    const { rows } = await pool.query("INSERT INTO league_groups (created_by) VALUES ($1) RETURNING id", [userId]);
    groupId = rows[0].id as string;
    await pool.query("UPDATE leagues SET group_id = $1, group_position = 0 WHERE id = $2", [groupId, lead.leagueId]);
  }
  await pool.query(
    `UPDATE leagues SET group_id = $1, group_position = (SELECT COALESCE(max(group_position), -1) + 1 FROM leagues WHERE group_id = $1) WHERE id = $2`,
    [groupId, leagueId]
  );
  return true;
}

export interface Started {
  leagueId: string;
  name: string;
  gameName: string;
  /** The episode it starts with; null while it waits for its phase. */
  from: number | null;
  /** The phase it starts at (step A3), or null. */
  phase: string | null;
  /** The last episode it plays, or null: to the season's end. */
  to: number | null;
  linked: boolean;
  /** How many on the couch the push went to (0 when Tell the couch was off). */
  told: number;
}

/**
 * Start a game on a season for a couch (POST /api/seasons/[id]/start): `game` a key that fits, `tell` the couch, `again` a game
 * to run back, `from` a later episode to start with or `phase` a phase of the season's rulebook to start when it does (step A3),
 * `to` the last episode it plays (none: to the season's end).
 */
export async function startGame(
  user: SessionUser,
  seasonId: string,
  couchId: string | null,
  body: { game?: unknown; tell?: unknown; again?: unknown; from?: unknown; phase?: unknown; to?: unknown; bots?: unknown; level?: unknown; late?: unknown; questions?: unknown },
  now = new Date()
): Promise<Started> {
  const againId = typeof body.again === "string" ? body.again : null;
  const start = typeof body.from === "number" ? body.from : null;
  if (body.late === true && start !== null) throw new HttpError(400, "Include the one on now, or start later: not both");
  if (body.phase != null && (body.late === true || start !== null || body.to != null)) throw new HttpError(400, "A game that starts with a phase runs from it to the season's end: no other start or end");
  const opts = await startOptions(user, seasonId, couchId, againId, now, body.late === true, start);
  if (opts.blocked) throw new HttpError(409, opts.blocked);
  if (body.late === true && !opts.late) throw new HttpError(409, `Nothing's on now to include: it starts with ${opts.part.singular} ${opts.from}`);
  // Where it starts: the next to air, or a later episode the listing has.
  if (body.from != null && opts.from !== body.from) throw new HttpError(400, `Pick a start the listing has, from ${partAt({ part: opts.part, from: opts.nextEpisode })} on`);
  // Or when a phase still to come starts (step A3): it waits for it.
  const phase = body.phase == null ? null : opts.phases.find((p) => p.id === body.phase) ?? null;
  if (body.phase != null && !phase) throw new HttpError(400, "Pick a phase of the season still to come");
  const choice = opts.games.find((g) => g.key === body.game);
  if (!choice || !choice.fits) throw new HttpError(400, choice ? `${choice.name} doesn't fit ${opts.show}: it needs ${choice.needs}` : "Pick a game");
  if (choice.soon || !choice.type) throw new HttpError(409, `${choice.name} comes with this week's episode games, soon`);
  // The last episode it plays: none (the season's end), or one the listing has, from where it starts.
  const ends = new Set([...(opts.spans.some((sp) => sp.kind === "one") ? [opts.from] : []), ...opts.ends.map((e) => e.number)]);
  const to = typeof body.to === "number" && ends.has(body.to) ? body.to : null;
  if (body.to != null && to === null) throw new HttpError(400, `Pick an end the listing has, from ${opts.part.singular} ${opts.from} on`);
  const span = to === null ? null : spanName(opts.from, to, opts.part);
  // A season game that starts later says where ("from Episode 9"), or with a phase, which ("from when Merged starts").
  const when = phase ? ` from when ${phase.name} starts` : span ? ` for ${span}` : opts.from > opts.nextEpisode ? ` from ${partAt(opts)}` : "";
  // Computer players in the seats (computer-players.ts), seated before anyone joins, at one level.
  const bots = typeof body.bots === "number" && Number.isInteger(body.bots) ? body.bots : 0;
  if (bots < 0 || bots > MAX_BOTS) throw new HttpError(400, `Up to ${MAX_BOTS} computer players`);
  if (bots && !choice.bots) throw new HttpError(409, `Computer players don't play ${choice.name}`);
  const level: BotLevel = body.level === "easy" || body.level === "sharp" ? body.level : "normal";
  const couch = opts.couch.id;
  const here = await couchGamesOn(user, couch, seasonId);
  const name = freeName(opts.again && opts.again.key === choice.key ? opts.again.name : choice.name, here);
  const starter = (user as { username?: string | null }).username || user.name;
  const { rows: seasonRow } = await pool.query("SELECT ss.season_number, s.slug FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1", [seasonId]);
  const row = { id: seasonId, number: seasonRow[0].season_number as number, slug: seasonRow[0].slug as string };
  // The couch's own rules (Make it ours), when its games here play by them.
  const copy = await copyOf(here.map((g) => g.leagueId));
  // A Prediction Sheet's questions (step A4 part 2): the ones chosen, of those offered (none sent: the ones on by default), by the
  // rules it will play by. The season's (who wins, the final three) only in a game that runs to the season's end.
  let sheet: { ask: Question[]; ctx: SpecContext } | null = null;
  if (choice.key === "questions") {
    if (body.questions != null && !(Array.isArray(body.questions) && body.questions.every((x) => typeof x === "string"))) throw new HttpError(400, "questions is a list of the questions' ids");
    // None sent: what a game run back asked, else the ones on by default; over a span, never the season's.
    const ids =
      (body.questions as string[] | undefined) ??
      (opts.again?.key === "questions" && opts.again.questions?.length ? opts.again.questions : opts.questions.filter((q) => q.on && (to === null || !q.season)).map((q) => q.id));
    const offered = new Map(opts.questions.map((q) => [q.id, q]));
    const off = ids.find((id) => !offered.has(id));
    if (off) throw new HttpError(400, `"${off}" isn't a question ${opts.show} can settle`);
    if (to !== null && ids.some((id) => offered.get(id)?.season)) throw new HttpError(400, "Who wins and the final three are the season's: only in a game that runs to its end");
    const book = await questionBook(seasonId, copy);
    const ctx = contextOf(book);
    const ask = chosenQuestions(questionChoices(book, ctx), ids, to === null);
    if (!ask.length) throw new HttpError(400, "Pick at least one question");
    sheet = { ask, ctx };
  }
  const kept = opts.again ? (await leagueStates([opts.again.leagueId])).get(opts.again.leagueId)?.settings : undefined;
  let seat = "";
  let made: string | null = null;
  let settled: number | null = null;
  const leagueId = await makeLeague(row, {
    name,
    createdBy: user.id,
    // A Prediction Sheet starts as a game with nothing held whose results come into its state (Survival Pool's type: a game of
    // questions has no preset to start from), its questions written below through the game's writer.
    type: choice.type === "questions" ? "pickem" : choice.type,
    couchId: couch,
    rulebookId: copy?.id ?? null,
    before: (s) => {
      seat = StateLogic.addPlayer(s, starter).id;
      for (let i = 0; i < bots; i++) addBot(s, level);
    },
    after: async (s, client, id) => {
      // Theirs from the start: a game of yours never exists without you in it.
      await client.query("INSERT INTO league_memberships (league_id, user_id, player_id, role) VALUES ($1, $2, $3, 'commissioner')", [id, user.id, seat]);
      made = id;
      // The game, as a spec (docs/PLAN-start-a-game-gpt.md step A2): the made league's own (its type's preset, as makeLeague
      // set it up), then what Start a game decides, written once through the game's writer (RosterLogic.setGame: checked
      // as the league's own, today's fields written from it, its first episode made).
      const spec: GameSpec = { ...StateLogic.gameOf(s), span: { from: phase ? { phase: phase.id } : opts.from, to } };
      if (opts.kind === "sport") {
        // The draft of athletes: everyone drafts from the whole grid (the blind draft), and a pool pick survives by scoring.
        if (spec.get.by === "draft") spec.get = { ...spec.get, own: "shared", order: "blind" };
        if (spec.score.by === "survive") spec.score = { ...spec.score, means: "scores" };
      }
      if (choice.key === "outlast" && spec.get.by === "draft") {
        // One team each from who's still in: fitted to the couch, so everyone on it could play (Game settings changes it).
        const stillIn = s.castaways.filter((c) => c.status === "active").length;
        const each = Math.floor(stillIn / Math.max(2, opts.couch.members + bots));
        if (stillIn && each >= 1 && each < (spec.get.each || 4)) spec.get = { ...spec.get, each };
      }
      if (kept && opts.again?.key === choice.key) Object.assign(spec, againParts(StateLogic.gameOf({ settings: kept } as LeagueState), spec));
      if (sheet) {
        // A game of questions (step A4 part 2): nothing held, scored by its own questions, each one data settles (the show's ctx:
        // setGame refuses a game's own questions without it).
        Object.assign(spec, { preset: null, get: { by: "none" }, count: null, score: { by: "answers" }, rank: { by: "total" }, ask: sheet.ask });
      }
      refused(StateLogic.setGame(s, spec, sheet ? { ctx: sheet.ctx } : undefined), 409);
      // A phase start already known and ahead is settled now (by the rulebook it plays by: its couch's own copy, else the
      // season's), as the desk and the season sync settle it later.
      if (phase) {
        settleIn(s, await leaguePhases(client, id, seasonId), await scheduleOf(seasonId, now), now);
        settled = StateLogic.startEpisode(s);
      }
      if (opts.late) {
        // Include it: the episode on now stays open past its start, until its results are in (state-logic.js closedForPlay).
        StateLogic.ensureEpisodeNumber(s, opts.from, false);
        const ep = s.episodes.find((e) => e.number === opts.from);
        if (ep && StateLogic.episodeHasResults(ep)) throw new HttpError(409, `${partAt(opts)}'s results are in already: start from the next one`);
        if (ep) ep.openPastAir = true;
      }
      await recordChange(client, id, s, {
        userId: user.id,
        kind: "game.start",
        tier: 1,
        text: `${starter} started ${choice.name}${when}${opts.again ? `, again after ${opts.again.label}` : ""}${bots ? ` with ${bots} computer ${bots === 1 ? "player" : "players"}` : ""}`,
        detail: { game: choice.key, from: phase ? settled : opts.from, ...(phase ? { phase: phase.id } : {}), to, bots },
      });
    },
  }).catch(async (e) => {
    // A refused setup leaves its half-made league behind: take it away.
    if (made) await pool.query("DELETE FROM leagues WHERE id = $1 AND created_by = $2", [made, user.id]);
    throw e;
  });
  if (!leagueId) throw new HttpError(500, "Couldn't make the game, try again");
  const linked = await linkIn(leagueId, here, user.id).catch((e) => {
    console.error(`[start-game] couldn't link ${leagueId}:`, e);
    return false;
  });
  await followLeagueProgress(user.id, leagueId);

  // Tell the couch: one push to everyone else on it, to the show's Games tab (its own moment since step 15 part 2: On the couch).
  const audience = body.tell === false ? [] : (await couchMembers([couch])).get(couch)?.filter((m) => m.userId !== user.id).map((m) => m.userId) ?? [];
  notifyGameStarted({
    userIds: audience,
    seasonId,
    leagueId,
    starter,
    show: opts.show,
    gameName: choice.name,
    label: opts.label,
    from: phase ? `when ${phase.name} starts` : `${opts.part.singular === "episode" ? "Episode" : opts.part.singular.replace(/^./, (c) => c.toUpperCase())} ${opts.from}`,
    span,
  });
  return { leagueId, name, gameName: choice.name, from: phase ? settled : opts.from, phase: phase?.id ?? null, to, linked, told: audience.length };
}

/**
 * Run it back on the trophy shelf and a finished show's Games tab: for each finished game of yours on the couch, the show's
 * next season that's set up and still to finish, when the couch has no game of that kind there yet. A game over a span that's
 * over, on a season still airing: its next span there ("ZT Survivor 51 · Episodes 8–9"), until a game of its kind has started
 * there since it ended.
 */
export async function runItBack(
  user: SessionUser,
  couchId: string,
  finished: { leagueId: string; seasonId: string; gameType: string; span?: { from: number; to: number } | null }[],
  now = new Date()
): Promise<{ leagueId: string; seasonId: string; label: string }[]> {
  // Only the games Start a game makes (a Prediction Sheet too since step A4 part 2: it asks its questions again).
  finished = finished.filter((f) => !!KEY_OF[f.gameType]);
  if (!finished.length) return [];
  const there = await games(user.id, { couchIds: [couchId] });
  const out: { leagueId: string; seasonId: string; label: string }[] = [];
  // Spans: the latest of each kind on each season, when nothing of its kind has started since.
  const spans = finished.filter(
    (f) => f.span && !finished.some((x) => x.seasonId === f.seasonId && x.gameType === f.gameType && x.span && x.span.from > f.span!.to) && !there.some((g) => g.seasonId === f.seasonId && g.gameType === f.gameType && (g.start === null || g.start > f.span!.to))
  );
  // A span's season still airing: its run back is on that season (or none yet), never the next one.
  const airing = new Set<string>();
  if (finished.some((f) => f.span)) {
    const ids = [...new Set(finished.filter((f) => f.span).map((f) => f.seasonId))];
    const [schedules, { rows: seasons }] = await Promise.all([
      seasonSchedules(ids, now),
      pool.query("SELECT ss.id, ss.season_number, s.name, s.episode_term FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = ANY($1::uuid[]) AND ss.status <> 'completed'", [ids]),
    ]);
    for (const r of seasons) airing.add(r.id as string);
    for (const f of spans) {
      const season = seasons.find((r) => r.id === f.seasonId);
      if (!season) continue;
      const schedule = schedules.get(f.seasonId);
      const from = startFrom(schedule, now);
      // nextSpan reads the linked games' teams, never a title.
      const to = nextSpan(await spanEpisodes(f.seasonId, schedule, false), from, f.span!);
      if (to === null) continue;
      const w = showWords({ episode: season.episode_term });
      out.push({ leagueId: f.leagueId, seasonId: f.seasonId, label: `${plain(season.name)} ${season.season_number} · ${spanName(from, to, { singular: w.episode.toLowerCase(), plural: w.episodes.toLowerCase() })}` });
    }
  }
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (ss.id) ss.id AS from_season, nx.id, s.name, nx.season_number
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id
       JOIN show_seasons nx ON nx.show_id = ss.show_id AND nx.season_number > ss.season_number AND nx.status <> 'completed'
      WHERE ss.id = ANY($1::uuid[]) AND s.set_up_at IS NOT NULL
      ORDER BY ss.id, nx.season_number`,
    [[...new Set(finished.map((f) => f.seasonId))]]
  );
  if (!rows.length) return out;
  for (const f of finished) {
    if (f.span && airing.has(f.seasonId)) continue;
    const next = rows.find((r) => r.from_season === f.seasonId);
    if (!next || there.some((g) => g.seasonId === next.id && g.gameType === f.gameType)) continue;
    out.push({ leagueId: f.leagueId, seasonId: next.id, label: `${plain(next.name)} ${next.season_number}` });
  }
  return out;
}
