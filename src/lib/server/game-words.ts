import * as Words from "@/lib/game/game-words/index.js";
import type { AnswerResult, CheckResult, MomentRating, Pack, PackInput } from "@/lib/game/game-words/index.js";
import * as Capabilities from "@/lib/game/game-spec/capabilities.js";
import type { SpecContext } from "@/lib/game/game-spec/index.js";
import tracker from "../../../tests/fixtures/engine-capabilities.json";
import { askBot, askBotStatus } from "./ask-bot";
import { isSuperAdminUser, isUuid, type SessionUser } from "./auth-helpers";
import { couchMembers, requireCouch } from "./couches";
import { HttpError, pool } from "./db";
import { stageContext } from "./engine-lab";
import { seenThrough } from "./guard";
import { seasonSchedules } from "./schedule";
import { games, seasonHeaders } from "./show-space";
import { startFrom } from "./start-game";
import { groupsGoingInto } from "@db/format-timeline.js";
import { groupOf, sportOf } from "@/lib/sports";
import { sportGames, sportPageContext, sportStandard, statWords } from "@/lib/sports/page";

// The Start-a-game GPT's words to a game (docs/PLAN-start-a-game-gpt.md step G1; POST /api/seasons/[seasonId]/game-words): someone
// on a show's page types the game they want; our bot drafts it from the context pack (what the app knows about the page, gathered
// here) and the engine's manual (generated from the spec's VOCAB, its examples the capability tracker's requests), and our check
// (src/lib/game/game-words/check.js) decides what's a game: the spec, what the wizard asks, what it can't do yet. A moment the show
// doesn't have gets the reliability ask (a second, short question) and, rated at the bar, an offer to add it. A typed change goes
// back to the bot with the game so far. Nothing here makes a game: the wizard (U0/U1) shows the result and Start a game makes it.
//
// The bot is asked with search off and priority "now" (llm-browser-api's queue: it waits only for the question the bot is already
// answering). Every ask is a row of game_word_asks (0214): the daily cap's count and the record to measure the prompt on. The
// pack shows the cast as the asker has seen it (their mark: guard.ts seenThrough), so nothing the wizard says can spoil an exit.
// No UI in G1: the route answers JSON for the wizard to come.

/** Asks one person can make in a day: a first ask or a typed change each (the desk aside). Make it a game's is 5 shows. */
export const GAME_ASKS_A_DAY = 10;
/** At most this many new moments rated for one ask: one rating ask for them all (U1: momentsPrompt), else one each. */
const MOMENT_ASKS = 3;
/** What one request may spend on the bot: the route's 300 s, less room to save what came back. */
const BUDGET_MS = 270_000;
/** Don't start a reliability ask with less than this left. */
const MOMENT_NEEDS_MS = 60_000;

export interface GameWordsResult {
  /** The ask's id: a typed change names it (`change.from`). */
  id: string;
  result: AnswerResult;
  /** How long the bot took, every ask together. */
  seconds: number;
  /** Asks left today (null: no cap, the desk). */
  left: number | null;
}

/** The asks someone has made in the last day, and how many they have left (null: no cap, the desk). An ask the bot never
 *  answered (its error kept) isn't counted: a bot that's down doesn't use up anyone's day; nor is a pick of games (G3 part 2: no bot). */
export async function asksToday(user: SessionUser): Promise<{ used: number; left: number | null }> {
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM game_word_asks WHERE user_id = $1 AND created_at > now() - interval '1 day' AND error IS NULL AND picked IS NULL", [user.id]);
  const used = rows[0].n as number;
  return { used, left: isSuperAdminUser(user) ? null : GAME_ASKS_A_DAY - used };
}

/** G3: at most this many of a sport's players in the pack (a team's whole season casts every team it plays: its first teams'
 *  first), and this many games (the next to play, then the last few played). */
const SPORT_CAST = 150;
const SPORT_GAMES = 16;
const SPORT_PLAYED = 3;

/** A slate's cadences, each its episode's word (G3 part 2, part 1's Noticed): NFL week 9 is "Week 9", never "Game 9". */
const CADENCES = new Set(["day", "week", "round"]);

type SportPart = { input: Partial<PackInput>; ctx: SpecContext; games: Words.SportGameSpec[]; league: string; teams: { id: string; name: string }[] };

/**
 * G3: a sport's season's part of the pack, or null when none of its games is linked to a league a sport reads: its league (its linked
 * games' most common), its games (each episode's: when, its sides and which is home, whether it's started, ESPN's line on the total
 * while it's still to play; never a score, so nothing spoils a game someone hasn't watched), its teams, the stats a request can name
 * in their words and its standard game; the ctx a spec on it is checked against (the sport's: sports/page.ts sportPageContext, a
 * playoffs slate's with its bracket); and the sport's standard games for our check's tables.
 */
async function sportPart(seasonId: string, label: string, terms: { castaway?: string | null; people?: string | null; episode?: string | null }, now: Date): Promise<SportPart | null> {
  const [{ rows }, { rows: slate }] = await Promise.all([
    pool.query(
      `SELECT e.episode, e.event_id, e.league, COALESCE(f.name, e.name) AS name, COALESCE(f.starts_at, e.starts_at) AS starts_at, COALESCE(f.teams, e.teams) AS teams,
              f.state, f.called, CASE WHEN jsonb_typeof(f.odds->'overUnder') = 'number' THEN (f.odds->>'overUnder')::float8 END AS line
         FROM season_events e LEFT JOIN sports_events f ON f.provider = e.provider AND f.league = e.league AND f.event_id = e.event_id
        WHERE e.season_id = $1 ORDER BY e.episode, starts_at NULLS LAST`,
      [seasonId]
    ),
    pool.query("SELECT stage, cadence FROM sports_slates WHERE season_id = $1", [seasonId]),
  ]);
  const counts = new Map<string, number>();
  for (const r of rows) if (sportOf(r.league)) counts.set(r.league, (counts.get(r.league) ?? 0) + 1);
  const league = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  const sport = league ? sportOf(league) : null;
  if (!league || !sport) return null;
  const playoffs = slate[0]?.stage === "post";
  const one = terms.castaway?.trim() || "player";
  // A slate's episode is its cadence's (a week of games, a day's), else the show's word for one (a matchup's: a game).
  const cadence = slate[0]?.cadence as string | undefined;
  const part = cadence && CADENCES.has(cadence) ? cadence : terms.episode?.toLowerCase();
  const ctx = sportPageContext(league, { show: label, person: { one: one.toLowerCase(), many: (terms.people?.trim() || `${one}s`).toLowerCase() }, ...(part ? { part: { singular: part, plural: `${part}s` } } : {}), playoffs });
  if (!ctx) return null;
  const at = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
  const all = rows
    .filter((r) => r.league === league)
    .map((r) => {
      const start = at(r.starts_at);
      const started = r.state === "in" || r.state === "post" || (!!start && Date.parse(start) <= now.getTime());
      const sides = (Array.isArray(r.teams) ? (r.teams as { id?: unknown; name?: unknown; home?: unknown }[]) : [])
        .filter((t) => typeof t.id === "string" && typeof t.name === "string")
        .map((t) => ({ id: t.id as string, name: t.name as string, ...(t.home === true ? { home: true as const } : {}) }));
      return { episode: r.episode as number, id: r.event_id as string, ...(r.name ? { name: r.name as string } : {}), ...(start ? { at: start } : {}), sides, started, ...(typeof r.line === "number" && !started ? { line: r.line } : {}), ...(r.called ? { called: r.called as string } : {}) };
    });
  // The games to come first (the next SPORT_GAMES), and the last few played, in the order they're played.
  const ahead = all.filter((g) => !g.started).slice(0, SPORT_GAMES);
  const played = all.filter((g) => g.started).slice(-SPORT_PLAYED);
  const games = [...played, ...ahead];
  const teams = new Map<string, { id: string; name: string }>();
  for (const g of all) for (const t of g.sides) if (!teams.has(t.id)) teams.set(t.id, { id: t.id, name: t.name });
  const standard = sportStandard(league);
  const standardGames = sportGames(league, { playoffs });
  return {
    league,
    teams: [...teams.values()],
    input: {
      sport: { id: sport.id, name: sport.name, league },
      teams: [...teams.values()],
      games,
      ...(all.length > games.length ? { gamesMore: all.length - games.length } : {}),
      stats: statWords(sport),
      ...(standard ? { standard: { ...standard, games: standardGames.map((g) => ({ id: g.id, about: g.about })) } } : {}),
    },
    ctx: ctx as unknown as SpecContext,
    games: standardGames,
  };
}

/**
 * The context pack's input for a season, as `user` has seen it on `couchId`: the show and season, its episodes and the next, its
 * phases, its cast (who's gone and how, through their mark; each one's group now as far as they've seen it, G1 part 4: F3's timeline, else their starting one), the moments research answers (the rules
 * the couch plays by: its own copy, else the season's), and the couch (how many, its games here). And the ctx our check reads, sized
 * by the couch and who's still in as they've seen it.
 */
export async function packFor(user: SessionUser, seasonId: string, couchId: string | null, now = new Date()): Promise<{ pack: Pack; ctx: SpecContext; kind: "show" | "sport"; show: string; games: Words.SportGameSpec[] }> {
  // A show's rules beside the rest (a show not yet a game is a 404, thrown only for a show's page: a sport's needn't be one).
  const [headers, schedules, seen, showRules] = await Promise.all([
    seasonHeaders([seasonId]),
    seasonSchedules([seasonId], now),
    seenThrough(user.id, seasonId),
    stageContext(seasonId, couchId).catch((e: unknown) => e),
  ]);
  // Everything (results straight away; a sport's season, live) as the largest episode SQL's integer holds.
  const mark = Number.isFinite(seen) ? seen : 2_147_483_646;
  const h = headers.get(seasonId);
  if (!h) throw new HttpError(404, "Season not found");
  const schedule = schedules.get(seasonId);
  const label = `${h.show.name}${h.seasonNumber ? ` ${h.seasonNumber}` : ""}`;
  // G3: a sport's page is its linked games' sport (a show of kind sport whose games aren't linked to one ESPN reads is a show's).
  const sport = h.show.kind === "sport" ? await sportPart(seasonId, label, h.show.terms, now) : null;
  const kind = sport ? "sport" : "show";
  // A show's rules (the couch's copy, else the season's); a sport's are the sport's own, and its league's show needn't be a game yet
  // (a matchup's is "Not a game yet" until someone plays one).
  if (!sport && showRules instanceof Error) throw showRules;
  const rules: SpecContext = sport ? sport.ctx : (showRules as SpecContext);
  const [{ rows: cast }, { rows: outs }, members, here, now_] = await Promise.all([
    // A sport's people are shown from the game whose box score brought them in (season_cast.shown_from): through their mark only.
    pool.query("SELECT id, name, tribe_name, role, shown_from, provider_ids IS NOT NULL AS linked FROM season_cast WHERE season_id = $1 AND (shown_from IS NULL OR shown_from <= $2) ORDER BY sort_order, name", [seasonId, mark]),
    // Who's gone, and who's with whom: a show's (nobody goes home in a sport, and its groups are its teams).
    sport
      ? Promise.resolve({ rows: [] as Record<string, unknown>[] })
      : pool.query(
          `SELECT lower(COALESCE(d.applied->>'castawayName', d.castaway_name)) AS name, min(d.episode_number)::int AS ep, min(d.method) AS how
             FROM season_decisions d WHERE d.season_id = $1 AND d.kind = 'elimination' AND d.status = 'accepted' AND d.episode_number <= $2 GROUP BY 1`,
          [seasonId, mark]
        ),
    couchId ? couchMembers([couchId]) : Promise.resolve(new Map()),
    couchId ? games(user.id, { couchIds: [couchId], seasonId }) : Promise.resolve([]),
    // G1 part 4: who is with whom now, as far as they've seen (F3's timeline from the season's research): the starting groups until then.
    sport ? Promise.resolve(null) : groupsGoingInto(pool, seasonId, mark + 1),
  ]);
  const out = new Map(outs.map((r) => [r.name as string, { episode: r.ep as number, how: (r.how as string | null) ?? undefined }]));
  const eps = schedule?.episodes ?? [];
  const next = startFrom(schedule, now);
  const nextEp = eps.find((e) => e.number === next);
  const people = couchId ? (members.get(couchId) ?? []).length : null;
  const input: PackInput = {
    label,
    show: h.show.name,
    ...(h.seasonNumber ? { season: h.seasonNumber } : {}),
    kind,
    status: h.status,
    today: now.toISOString().slice(0, 10),
    episodes: {
      aired: eps.filter((e) => e.airAt && Date.parse(e.airAt) <= now.getTime()).length,
      ...(h.episodeCount ? { total: h.episodeCount } : {}),
      next: nextEp ? { number: nextEp.number, ...(nextEp.airAt ? { airs: nextEp.airAt } : {}) } : null,
    },
    phases: sport ? [] : (rules.phases ?? []).map((p) => ({ id: p.id, name: p.name ?? p.id })),
    cast: (sport ? cast.slice(0, SPORT_CAST) : cast).map((c) => {
      // A sport's players: each with their team and position, nobody gone.
      if (sport) return { id: c.id as string, name: c.name as string, in: true, group: (c.tribe_name as string | null) ?? null, role: (c.role as string | null) ?? null };
      const gone = out.get(String(c.name).toLowerCase());
      const key = String(c.name).toLowerCase();
      const group = now_ && now_.has(key) ? now_.get(key)! : ((c.tribe_name as string | null) ?? null);
      return { id: c.id as string, name: c.name as string, in: !gone, out: gone ?? null, group: gone ? ((c.tribe_name as string | null) ?? null) : group };
    }),
    ...(sport && cast.length > SPORT_CAST ? { castMore: cast.length - SPORT_CAST } : {}),
    ctx: rules,
    ...(sport ? sport.input : {}),
    couch: couchId ? { people, games: here.filter((g) => !g.archived).map((g) => ({ name: g.name, says: g.gameName })) } : null,
  };
  const pack = Words.packOf(input);
  // G3 part 3b: on a sport's page, everyone as a pool of some teams' or positions' players counts them (their team's ESPN id by its
  // name, their position group from their role), so an exclusive draft from one is counted where it's made.
  const sportIs = sport ? sportOf(sport.league) : null;
  const teamIdOf = new Map((sport?.teams ?? []).map((t) => [t.name.toLowerCase(), t.id]));
  // Only those a league on it has (a sport's league is made of its players with provider ids: make-game.ts).
  const poolOf = sportIs ? cast.filter((c) => c.linked).map((c) => ({ team: teamIdOf.get(String(c.tribe_name ?? "").toLowerCase()) ?? null, position: groupOf(sportIs, c.role as string | null) })) : null;
  const ctx: SpecContext = { ...rules, show: label, ...(people ? { couch: people } : {}), ...(pack.cast.length ? { pool: pack.stillIn } : {}), ...(poolOf ? { poolOf } : {}), ...(sport?.teams.length ? { teamList: sport.teams } : {}) };
  return { pack, ctx, kind, show: h.show.name, games: sport?.games ?? [] };
}

/** The manual for a page: generated from VOCAB, its examples the tracker's requests that play there (a sport's: its standard games;
 *  G3 part 2, `team`: a team's page, how to name its games). */
export const manualFor = (ctx: SpecContext, kind: "show" | "sport", show: string, games: Words.SportGameSpec[], team = false) =>
  Words.manualFor(ctx, { kind, examples: Capabilities.rowsOf(tracker as never), show, games, team });

/**
 * A new ask's row (G3 part 2: a season's, or a team's page's: `league` and `team`), counted against the day's cap with itself in it, so
 * asks sent at once can't all slip under it; one over it is taken back with a 429. Its id, and the asks left.
 */
export async function openAsk(user: SessionUser, row: { seasonId: string | null; league?: string; team?: string; couchId: string | null; from: string | null; words: string; change: string | null }): Promise<{ id: string; left: number | null }> {
  const { rows } = await pool.query("INSERT INTO game_word_asks (user_id, season_id, league, team, couch_id, change_of, words, change) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id", [
    user.id,
    row.seasonId,
    row.league ?? null,
    row.team ?? null,
    row.couchId,
    row.from,
    row.words,
    row.change,
  ]);
  const id = rows[0].id as string;
  const { left } = await asksToday(user);
  if (left !== null && left < 0) {
    await pool.query("DELETE FROM game_word_asks WHERE id = $1", [id]);
    throw new HttpError(429, `You've asked our bot for ${GAME_ASKS_A_DAY} games today. Try again tomorrow, or start one with the taps.`);
  }
  return { id, left };
}

/** Who may start a game on a couch: a member (a viewer can't); none, null. */
export async function couchFor(user: SessionUser, couch: unknown): Promise<string | null> {
  const couchId = typeof couch === "string" && couch ? couch : null;
  if (!couchId) return null;
  if (!isUuid(couchId)) throw new HttpError(400, "couch");
  if ((await requireCouch(user, couchId)) === "viewer") throw new HttpError(403, "Join the couch to start a game on it");
  return couchId;
}

/** Each new moment the check found, rated by the reliability ask while there's time (at most MOMENT_ASKS). */
export async function rateMoments(result: CheckResult, pack: Pack, o: { bot?: string; deadline: number }): Promise<{ result: CheckResult; seconds: number }> {
  const ratings: Record<string, MomentRating> = {};
  let seconds = 0;
  const asked = result.newMoments.slice(0, MOMENT_ASKS);
  // Several at once in one ask (U1: one after another is about two minutes on the slow bot); one alone, its own ask as before.
  if (asked.length > 1 && o.deadline - Date.now() >= MOMENT_NEEDS_MS) {
    try {
      const a = await askBot(Words.momentsPrompt({ pack, moments: asked.map((m) => m.label) }), { bot: o.bot, budgetMs: o.deadline - Date.now(), search: false, priority: "now" });
      seconds += a.seconds;
      Words.readMoments(a.answer, asked.length).forEach((r, i) => (ratings[asked[i].label] = r));
    } catch {
      // Unrated: they stay can't-yets, as unreliable ones would.
    }
    return { result: Object.keys(ratings).length ? Words.withMoments(result, ratings, { pack }) : result, seconds };
  }
  for (const m of asked) {
    const left = o.deadline - Date.now();
    if (left < MOMENT_NEEDS_MS) break;
    try {
      const a = await askBot(Words.momentPrompt({ pack, moment: m.label }), { bot: o.bot, budgetMs: left, search: false, priority: "now" });
      seconds += a.seconds;
      ratings[m.label] = Words.readMoment(a.answer);
    } catch {
      // Unrated: it stays a can't-yet, as an unreliable one would.
    }
  }
  return { result: Object.keys(ratings).length ? Words.withMoments(result, ratings, { pack }) : result, seconds };
}

/**
 * Their words to a game (`body`: { words, couch?, change?: { from: an ask's id, words } }): the pack, the manual and the prompt to our
 * bot, then our check, then the reliability ask for each new moment. Capped per person a day; the bot must be answering. U1: a change
 * can be to a game the wizard holds instead of an ask (`change: { spec, game: its name and line, words, button? }`), the quick
 * changes' Creative moments among them (`button: 'creative'`, BUTTONS' words).
 */
export async function gameWords(user: SessionUser, seasonId: string, body: { words?: unknown; couch?: unknown; change?: unknown }, bot?: string, now = new Date()): Promise<GameWordsResult> {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const couchId = await couchFor(user, body.couch);
  const change = body.change && typeof body.change === "object" ? (body.change as { from?: unknown; words?: unknown }) : null;
  let words = typeof body.words === "string" ? body.words.trim() : "";
  let changeWords: string | null = null;
  let spec: unknown = null;
  let from: string | null = null;
  let carry: { said: unknown[]; assumed: unknown[] } | null = null;
  const button = change && typeof (change as { button?: unknown }).button === "string" && Words.BUTTONS[(change as { button: string }).button] ? (change as { button: string }).button : undefined;
  const held = change && !(change as { from?: unknown }).from && (change as { spec?: unknown }).spec;
  if (held) {
    // A game the wizard holds (a rail game, a shuffle, a typed one changed since): its spec and the words that name it.
    const c = change as { spec?: unknown; game?: unknown; words?: unknown };
    if (!c.spec || typeof c.spec !== "object" || Array.isArray(c.spec)) throw new HttpError(400, "A change says what game it changes");
    spec = c.spec;
    changeWords = typeof c.words === "string" ? c.words.trim() : "";
    words = typeof c.game === "string" && c.game.trim() ? c.game.trim().slice(0, 300) : "A game on this season";
    if (!changeWords) throw new HttpError(400, "Say what to change");
  } else if (change) {
    from = typeof change.from === "string" && isUuid(change.from) ? change.from : null;
    changeWords = typeof change.words === "string" ? change.words.trim() : "";
    if (!from || !changeWords) throw new HttpError(400, "A change says which ask it changes and what to change");
    const { rows } = await pool.query("SELECT words, result FROM game_word_asks WHERE id = $1 AND user_id = $2 AND season_id = $3", [from, user.id, seasonId]);
    if (!rows[0]) throw new HttpError(404, "That ask isn't yours");
    const before = rows[0].result as { spec?: unknown; said?: unknown[]; assumed?: unknown[] } | null;
    spec = before?.spec ?? null;
    if (!spec) throw new HttpError(409, "That ask has no game to change: type it again instead");
    words = rows[0].words as string;
    // What the first ask said and assumed stays backed through the change (the bot quotes only the change's words).
    carry = { said: before?.said ?? [], assumed: before?.assumed ?? [] };
  }
  if (!words) throw new HttpError(400, "Say what game you want");
  if (words.length > 2000 || (changeWords?.length ?? 0) > 2000) throw new HttpError(400, "That's longer than a game needs: 2,000 characters at most");
  // The season (a 404) before the bot (a 503) before the cap (a 429, counted once this ask is a row).
  const { pack, ctx, kind, show, games: standard } = await packFor(user, seasonId, couchId, now);
  if (!(await askBotStatus({ bot })).available) throw new HttpError(503, "Our bot isn't answering right now. Start a game's taps work.");
  const manual = manualFor(ctx, kind, show, standard);
  const prompt = change ? Words.changePrompt({ pack, manual, words, spec, change: changeWords!, button }) : Words.gamePrompt({ pack, manual, words });
  const { id, left } = await openAsk(user, { seasonId, couchId, from, words, change: changeWords });
  const deadline = Date.now() + BUDGET_MS;
  try {
    const asked = await askBot(prompt, { bot, budgetMs: BUDGET_MS, search: false, priority: "now" });
    // A change's quotes come from what they typed now or first; what the first ask said and assumed comes with it (carry).
    let result: AnswerResult = Words.checkAnswer(asked.answer, { ctx, pack, words: change ? `${words}\n${changeWords}` : words, kind, carry: carry as never, games: standard });
    let seconds = asked.seconds;
    if (result.state !== "unreadable" && result.newMoments.length) {
      const rated = await rateMoments(result, pack, { bot, deadline });
      result = rated.result as AnswerResult;
      seconds += rated.seconds;
    }
    await pool.query("UPDATE game_word_asks SET answer = $2, result = $3, seconds = $4 WHERE id = $1", [id, asked.answer, JSON.stringify(result), seconds]);
    return { id, result, seconds, left };
  } catch (e) {
    await pool.query("UPDATE game_word_asks SET error = $2 WHERE id = $1", [id, e instanceof Error ? e.message.slice(0, 500) : "failed"]);
    throw e;
  }
}
