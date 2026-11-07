import * as Words from "@/lib/game/game-words/index.js";
import type { AnswerResult, Pack, PackInput, WizardAsk } from "@/lib/game/game-words/index.js";
import type { SpecContext } from "@/lib/game/game-spec/index.js";
import { TeamSport, sportOf } from "@/lib/sports";
import { eastDay, matchupKey, matchupName, type MatchupAsk } from "@/lib/sports/matchup";
import { sportGames, sportPageContext, sportStandard, statWords } from "@/lib/sports/page";
import { holdMatchup, readMatchupAsk, teamSchedulePack, type MatchupQuestion } from "@/lib/sports/team-page";
import type { TeamHit } from "@/lib/sports/teams";
import { askBot, askBotStatus } from "./ask-bot";
import { isUuid, type SessionUser } from "./auth-helpers";
import { couchMembers } from "./couches";
import { HttpError, pool } from "./db";
import { asksToday, couchFor, manualFor, openAsk, packFor, rateMoments, type GameWordsResult } from "./game-words";
import { games as couchGames } from "./show-space";
import { castFromEvents } from "./sports/cast";
import { leaguePath, teamGames, underCap } from "./sports/find";
import { matchupSeason, type Matchup } from "./sports/matchup";
import { SportsUnavailable, type SportsEvent, type SportsProvider } from "./sports/types";

// The Start-a-game GPT on a team's page (docs/PLAN-start-a-game-gpt.md step G3 part 2; POST /api/sports/game-words): someone types
// the game they want on a team's page, before there's a season ("the 76ers home opener", "the upcoming Red Sox–Yankees series", "the
// Lakers' next 5 games", "the Knicks game tonight"). One ask of our bot, on the team's pack (game-words.ts's sport pack with the
// team's schedule in place of a season's games: sports/team-page.ts teamSchedulePack), drafts the game and names its games as a
// matchup ask; our check holds the ask against the schedule (team-page.ts holdMatchup); the games are made (or found) as their
// matchup's season (sports/matchup.ts matchupSeason, keyed by its games, so it's the season anyone who adds the same games shares;
// a new one under the day's cap, MATCHUPS_A_DAY, its players filled from the teams' rosters before the check); and the same draft is
// checked again on that season's page (game-words.ts packFor: part 1's path), so the game the wizard shows is the matchup's own.
//
// Our check's question about which games ("the home opener has been played: their next home game?") carries what each option picks
// (`picks`): the wizard sends one back as `change: { from, matchup }`, with no bot (a pick isn't counted against the day's asks). A
// typed change goes to the bot on the team's page with the game and its games so far (once they're made, those games by id), so a
// change of games ("just the next 3") picks again. A draft our check can't play makes no games. Every ask is a row of game_word_asks
// (0214, 0215: the team's page's league and team). No UI.

/** What one request may spend on the bot (game-words.ts's: the route's 300 s, less room to save what came back). */
const BUDGET_MS = 270_000;
/** Don't start a reliability ask with less than this left. */
const MOMENT_NEEDS_MS = 60_000;

export interface TeamWordsResult extends GameWordsResult {
  /** The page: the team's league and id, and its name. */
  page: { league: string; team: string; name: string };
  /** The games, made (or found) as their matchup's season, once our check has picked them; null while it asks which. */
  matchup: Matchup | null;
  /** Why the games weren't made though our check picked them (the day's cap on new games). */
  refused?: string;
}

type TeamBody = { league?: unknown; team?: unknown; words?: unknown; couch?: unknown; change?: unknown };

/** A team's page: its pack, the ctx a spec on it is checked against, the sport's standard games, and the team's schedule. */
interface TeamPage {
  league: string;
  provider: SportsProvider;
  team: TeamHit;
  schedule: SportsEvent[];
  pack: Pack;
  ctx: SpecContext;
  standard: Words.SportGameSpec[];
}

/** The team's page as `user` sees it on `couchId`: the team's schedule from the provider (its season, past and coming). */
async function teamPage(user: SessionUser, league: string, team: string, couchId: string | null, now: Date, providers?: SportsProvider[]): Promise<TeamPage> {
  const sport = sportOf(league);
  if (!(sport instanceof TeamSport)) throw new HttpError(400, "A team's page is a team sport's");
  let found: Awaited<ReturnType<typeof teamGames>>;
  try {
    found = await teamGames(league, team, { providers });
  } catch (e) {
    if (e instanceof SportsUnavailable) throw new HttpError(503, "Sports aren't available right now");
    throw e;
  }
  if (!found) throw new HttpError(404, "No such team");
  const part = teamSchedulePack(team, found.games, now.getTime());
  const ctx = sportPageContext(league, { show: found.team.short });
  if (!ctx) throw new HttpError(400, "A team's page is a team sport's");
  const [members, here] = await Promise.all([couchId ? couchMembers([couchId]) : Promise.resolve(new Map()), couchId ? couchGames(user.id, { couchIds: [couchId] }) : Promise.resolve([])]);
  const people = couchId ? (members.get(couchId) ?? []).length : null;
  const standard = sportStandard(league);
  const games = sportGames(league);
  const input: PackInput = {
    label: found.team.name,
    ...(found.team.leagueName ? { show: found.team.leagueName } : {}),
    kind: "sport",
    // A team's days are the East's, as ESPN's are ("tonight").
    today: eastDay(now),
    episodes: { aired: 0, next: null },
    cast: [],
    ctx: ctx as unknown as SpecContext,
    sport: { id: sport.id, name: sport.name, league },
    teams: part.teams,
    games: [],
    team: { id: found.team.id, name: found.team.name, short: found.team.short },
    schedule: part.schedule,
    ...(part.more ? { scheduleMore: part.more } : {}),
    stats: statWords(sport),
    ...(standard ? { standard: { ...standard, games: games.map((g) => ({ id: g.id, about: g.about })) } } : {}),
    couch: couchId ? { people, games: here.filter((g) => !g.archived).map((g) => ({ name: g.name, says: g.gameName })) } : null,
  };
  const pack = Words.packOf(input);
  return { league, provider: found.provider, team: found.team, schedule: found.games, pack, ctx: { ...(ctx as unknown as SpecContext), show: found.team.short, ...(people ? { couch: people } : {}) }, standard: games };
}

/** Our check's question about which games, first among the wizard's; a game that plays is now one with a question. */
function withQuestion(result: AnswerResult, q: MatchupQuestion): AnswerResult {
  if (result.state === "unreadable") return result;
  const ask: WizardAsk = { part: q.part, question: q.question, options: q.options, picks: q.picks as unknown as Record<string, unknown>[], by: q.by };
  return { ...result, state: result.state === "game" ? "ask" : result.state, ask: [ask, ...result.ask.filter((a) => a.part !== "matchup")] };
}

/**
 * The draft (the bot's `answer`) on the team's page, its games held against the schedule (`ask`: a pick, else the matchup the draft
 * named), made as their season and the draft checked again there. `carry`: a change's first said and assumed.
 */
async function settle(
  user: SessionUser,
  page: TeamPage,
  answer: string,
  o: { words: string; carry: { said: unknown[]; assumed: unknown[] } | null; ask?: MatchupAsk | null; couchId: string | null; now: Date; providers?: SportsProvider[]; prefix?: string; bot?: string; deadline?: number }
): Promise<{ result: AnswerResult; matchup: Matchup | null; refused?: string; season: string | null; picked: MatchupAsk | null; seconds: number }> {
  const opts = { words: o.words, kind: "sport" as const, carry: o.carry as never, games: page.standard };
  let result = Words.checkAnswer(answer, { ...opts, ctx: page.ctx, pack: page.pack });
  if (result.state === "unreadable" || result.state === "none") return { result, matchup: null, season: null, picked: null, seconds: 0 };
  const now = o.now.getTime();
  const picked = o.ask !== undefined ? o.ask : readMatchupAsk(result.matchup, [...(page.pack.teams ?? []), { ...page.team }], now);
  const hold = holdMatchup(page.team.id, page.schedule, picked, { now, short: page.team.short });
  if (hold.question) return { result: withQuestion(result, hold.question), matchup: null, season: null, picked, seconds: 0 };
  // A game our check can't play yet makes no games (nor spends the day's new ones): its can't-yets say why.
  if (result.state === "cantYet") return { result, matchup: null, season: null, picked, seconds: 0 };
  // The games' season: one made for them already is free; a new one is under the day's cap.
  const prefix = o.prefix ?? "";
  const key = `${prefix}${matchupKey(page.provider.id, page.league, hold.games.map((g) => g.id))}`;
  const { rows } = await pool.query("SELECT 1 FROM sports_matchups WHERE key = $1", [key]);
  if (!rows.length) {
    try {
      await underCap(user.id);
    } catch (e) {
      if (e instanceof HttpError && e.status === 429) return { result, matchup: null, refused: e.message, season: null, picked, seconds: 0 };
      throw e;
    }
  }
  let m: Matchup;
  try {
    m = await matchupSeason(page.provider, page.league, hold.games, { name: matchupName(hold.games, page.team.id), userId: user.id, providers: o.providers, now: o.now, prefix, cast: false });
    // Its players before the check (a draft's pool is sized by them), from the teams' rosters.
    if (m.made) await castFromEvents(m.seasonId, { providers: o.providers, now: o.now });
  } catch (e) {
    if (e instanceof SportsUnavailable) throw new HttpError(503, "Sports aren't available right now");
    throw e;
  }
  const on = await packFor(user, m.seasonId, o.couchId, o.now);
  result = Words.checkAnswer(answer, { ...opts, ctx: on.ctx, pack: on.pack, kind: on.kind, games: on.games });
  // A new moment the draft named: its reliability ask, as on a season's page (while there's time; a pick has none to spend).
  let seconds = 0;
  if (result.state !== "unreadable" && result.newMoments.length && o.deadline && o.deadline - Date.now() >= MOMENT_NEEDS_MS) {
    const rated = await rateMoments(result, on.pack, { bot: o.bot, deadline: o.deadline });
    result = rated.result as AnswerResult;
    seconds = rated.seconds;
  }
  return { result, matchup: m, season: m.seasonId, picked, seconds };
}

/** The team's page asked for: a league ESPN names ("basketball/nba") and a team's id in it. */
function pageOf(body: TeamBody): { league: string; team: string } {
  const league = leaguePath(body.league);
  const team = typeof body.team === "string" ? body.team.trim() : "";
  if (!league || !team || team.length > 80) throw new HttpError(400, "Say which team: { league, team }");
  return { league, team };
}

/**
 * Their words to a game on a team's page (`body`: { league, team, words, couch?, change?: { from, words } | { from, matchup } }). A
 * first ask or a typed change goes to the bot (capped per person a day, as on a season's page); a pick of games doesn't. `opts` are
 * for checks: the stand-in ESPN (`providers`), the bot, the clock, a prefix for the matchups made.
 */
export async function teamGameWords(user: SessionUser, body: TeamBody, o: { bot?: string; now?: Date; providers?: SportsProvider[]; prefix?: string } = {}): Promise<TeamWordsResult> {
  const now = o.now ?? new Date();
  const { league, team } = pageOf(body);
  const couchId = await couchFor(user, body.couch);
  const change = body.change && typeof body.change === "object" ? (body.change as { from?: unknown; words?: unknown; matchup?: unknown }) : null;
  let words = typeof body.words === "string" ? body.words.trim() : "";
  let before: { id: string; season: string | null; answer: string | null; result: { spec?: unknown; said?: unknown[]; assumed?: unknown[]; matchup?: unknown } | null; picked: unknown } | null = null;
  if (change) {
    const from = typeof change.from === "string" && isUuid(change.from) ? change.from : null;
    if (!from) throw new HttpError(400, "A change says which ask it changes");
    const { rows } = await pool.query("SELECT id, season_id, words, answer, result, picked FROM game_word_asks WHERE id = $1 AND user_id = $2 AND league = $3 AND team = $4", [from, user.id, league, team]);
    if (!rows[0]) throw new HttpError(404, "That ask isn't yours");
    before = { id: rows[0].id, season: rows[0].season_id, answer: rows[0].answer, result: rows[0].result, picked: rows[0].picked };
    words = rows[0].words as string;
  }
  if (!words) throw new HttpError(400, "Say what game you want");
  if (words.length > 2000) throw new HttpError(400, "That's longer than a game needs: 2,000 characters at most");
  const done = async (id: string, left: number | null, seconds: number, s: Awaited<ReturnType<typeof settle>>, page: TeamPage): Promise<TeamWordsResult> => {
    await pool.query("UPDATE game_word_asks SET season_id = COALESCE($2, season_id), result = $3, seconds = $4 WHERE id = $1", [id, s.season, JSON.stringify({ ...s.result, ...(s.picked ? { picked: s.picked } : {}) }), seconds + s.seconds]);
    return { id, result: s.result, seconds: seconds + s.seconds, left, page: { league, team, name: page.team.name }, matchup: s.matchup, ...(s.refused ? { refused: s.refused } : {}) };
  };

  // A pick of games from our check's options: the same draft, these games, no bot.
  if (change && change.matchup !== undefined && change.words === undefined) {
    if (!before?.answer) throw new HttpError(409, "That ask has no game to pick games for: type it again instead");
    const page = await teamPage(user, league, team, couchId, now, o.providers);
    const ask = readMatchupAsk(change.matchup, [...(page.pack.teams ?? []), page.team], now.getTime());
    if (!ask) throw new HttpError(400, "Pick one of the games our check offered");
    const { rows } = await pool.query("INSERT INTO game_word_asks (user_id, league, team, couch_id, change_of, words, picked, answer) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id", [
      user.id,
      league,
      team,
      couchId,
      before.id,
      words,
      JSON.stringify(ask),
      before.answer,
    ]);
    const carry = { said: before.result?.said ?? [], assumed: before.result?.assumed ?? [] };
    const s = await settle(user, page, before.answer, { words, carry, ask, couchId, now, providers: o.providers, prefix: o.prefix });
    return done(rows[0].id as string, (await asksToday(user)).left, 0, s, page);
  }

  // A typed change once the games are made: the matchup's page's (part 1's path), its row the team's too.
  const changeWords = change ? (typeof change.words === "string" ? change.words.trim() : "") : null;
  if (change && !changeWords) throw new HttpError(400, "A change says which ask it changes and what to change");
  if ((changeWords?.length ?? 0) > 2000) throw new HttpError(400, "That's longer than a game needs: 2,000 characters at most");
  // The bot, on the team's page: a first ask, or a typed change (its games so far: once made, those games by id).
  const page = await teamPage(user, league, team, couchId, now, o.providers);
  if (!(await askBotStatus({ bot: o.bot })).available) throw new HttpError(503, "Our bot isn't answering right now. Start a game's taps work.");
  const manual = manualFor(page.ctx, "sport", page.team.short, page.standard, true);
  const spec = before?.result?.spec ?? null;
  if (change && !spec) throw new HttpError(409, "That ask has no game to change: type it again instead");
  let matchupSoFar: unknown = before ? (before.picked ?? before.result?.matchup ?? null) : null;
  if (before?.season) {
    const { rows } = await pool.query("SELECT events FROM sports_matchups WHERE season_id = $1", [before.season]);
    if (rows[0]) matchupSoFar = { kind: "games", events: rows[0].events };
  }
  const prompt = change ? Words.changePrompt({ pack: page.pack, manual, words, spec, change: changeWords!, matchup: matchupSoFar }) : Words.gamePrompt({ pack: page.pack, manual, words });
  const { id, left } = await openAsk(user, { seasonId: null, league, team, couchId, from: before?.id ?? null, words, change: changeWords });
  const deadline = Date.now() + BUDGET_MS;
  try {
    const asked = await askBot(prompt, { bot: o.bot, budgetMs: BUDGET_MS, search: false, priority: "now" });
    await pool.query("UPDATE game_word_asks SET answer = $2 WHERE id = $1", [id, asked.answer]);
    const carry = before ? { said: before.result?.said ?? [], assumed: before.result?.assumed ?? [] } : null;
    const s = await settle(user, page, asked.answer, { words: change ? `${words}\n${changeWords}` : words, carry, couchId, now, providers: o.providers, prefix: o.prefix, bot: o.bot, deadline });
    return done(id, left, asked.seconds, s, page);
  } catch (e) {
    // Its error kept, the bot's answer or not: an ask that came to nothing (the bot, or ESPN after it) doesn't use up anyone's day.
    await pool.query("UPDATE game_word_asks SET error = $2 WHERE id = $1", [id, e instanceof Error ? e.message.slice(0, 500) : "failed"]);
    throw e;
  }
}
