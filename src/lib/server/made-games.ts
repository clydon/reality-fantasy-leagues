import * as Words from "@/lib/game/game-words/index.js";
import type { MadeIdea } from "@/lib/game/game-words/index.js";
import { askBot, askBotStatus } from "./ask-bot";
import { isUuid, type SessionUser } from "./auth-helpers";
import { HttpError, pool } from "./db";
import { manualFor, packFor } from "./game-words";

// G5: a season's made-for games (docs/PLAN-start-a-game-gpt.md G5; the prompt and reading are game-words/made.js). One ask a
// season, made from the desk (Setup › Made-for games: POST /api/desk/seasons/[id]/made), shared by every couch on it: the page
// as someone who's seen nothing would see it (no couch, nobody out), so no idea spoils an exit; each idea through our check, the
// ones that are a game kept (season_game_ideas, 0437). The wizard's rail offers them (start-spec.ts wizardOptions), each fitted
// to the stretch picked there. Asked as the run kind 'made', so the desk's Settings can send it to an AI of its own (Codex).

/** What the bot may take: the route's 300 s, less room to check and save. */
const BUDGET_MS = 280_000;

/** A made-for game the wizard offers: the idea's words and its checked spec. */
export interface MadeGame {
  name: string;
  hook: string;
  length: MadeIdea["length"];
  bet: boolean;
  spec: Record<string, unknown>;
}

export interface MadeRow {
  count: number;
  at: string | null;
  error: string | null;
}

/** The season's made-for games, for the wizard (none: an empty list). */
export async function madeGames(seasonId: string): Promise<MadeGame[]> {
  const { rows } = await pool.query("SELECT ideas FROM season_game_ideas WHERE season_id = $1", [seasonId]);
  return Array.isArray(rows[0]?.ideas) ? (rows[0].ideas as MadeGame[]) : [];
}

/** How the season's made-for games stand, for the desk's Setup. */
export async function madeRow(seasonId: string): Promise<MadeRow> {
  const { rows } = await pool.query("SELECT jsonb_array_length(ideas)::int AS n, made_at, error FROM season_game_ideas WHERE season_id = $1", [seasonId]);
  const r = rows[0];
  return { count: r?.n ?? 0, at: r?.made_at ? new Date(r.made_at).toISOString() : null, error: r?.error ?? null };
}

/** Ask the bot for the season's made-for games and keep the ones our check passes (replacing any before). */
export async function makeGames(user: SessionUser, seasonId: string, o: { bot?: string } = {}): Promise<{ text: string; count: number }> {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const { pack, ctx, kind, show, games } = await packFor(user, seasonId, null);
  if (kind === "sport") throw new HttpError(400, "Made-for games are a show's: a sport's games come from its schedule");
  if (!(await askBotStatus({ bot: o.bot })).available) throw new HttpError(503, "Our bot isn't answering right now. Try again in a while.");
  const prompt = Words.madePrompt({ pack, manual: manualFor(ctx, kind, show, games) });
  let asked: { answer: string; seconds: number };
  try {
    asked = await askBot(prompt, { bot: o.bot, budgetMs: BUDGET_MS, search: false, kind: "made" });
  } catch (e) {
    await fail(seasonId, user, e instanceof Error ? e.message : "The bot didn't answer");
    throw e;
  }
  let ideas: MadeIdea[];
  try {
    ideas = Words.readIdeas(asked.answer);
  } catch {
    await fail(seasonId, user, "The bot's answer had no games in it");
    throw new HttpError(502, "The bot's answer had no games in it. Try again.");
  }
  // Where a short game starts is the wizard's (the stretch picked there): checked here from the next episode, so a bot's "from the
  // next one" its words can't date isn't held against it. A season game keeps its own (after the premiere, a stage).
  const next = pack.episodes.next?.number ?? pack.episodes.aired + 1;
  const last = pack.episodes.total ?? null;
  for (const idea of ideas) {
    if (idea.length === "season") continue;
    const to = idea.length === "one" ? next : last ? Math.min(last, next + 2) : next + 2;
    idea.game = { ...idea.game, span: { from: next, to } };
  }
  const kept: MadeGame[] = [];
  const dropped: { name: string; length: string; why: string }[] = [];
  for (const idea of ideas) {
    let r: Words.AnswerResult;
    try {
      r = Words.checkAnswer(JSON.stringify(Words.ideaDraft(idea)), { ctx, pack, words: idea.hook, kind });
    } catch (e) {
      dropped.push({ name: idea.name, length: idea.length, why: e instanceof Error ? e.message : "our check threw" });
      continue;
    }
    // Only a game as it stands: one our check would ask about, or that counts a moment the season doesn't have, is left out.
    if (r.state !== "game" || !r.spec) {
      const why = r.state === "unreadable" ? r.why : [...r.ask.map((a) => `asks ${a.part}: ${a.question}`), ...r.cantYet.map((c) => `can't yet: ${c.what}`)].join("; ") || r.state;
      dropped.push({ name: idea.name, length: idea.length, why: why.slice(0, 300) });
      continue;
    }
    kept.push({ name: idea.name, hook: idea.hook, length: idea.length, bet: idea.bet, spec: r.spec });
  }
  // The answer and what our check left out, kept to measure the prompt by (as game_word_asks keeps G1's).
  const meta = { seconds: asked.seconds, wrote: ideas.length, kept: kept.length, dropped, answer: asked.answer };
  await pool.query(
    `INSERT INTO season_game_ideas (season_id, ideas, asked, made_by, made_at, error) VALUES ($1, $2, $3, $4, now(), NULL)
     ON CONFLICT (season_id) DO UPDATE SET ideas = EXCLUDED.ideas, asked = EXCLUDED.asked, made_by = EXCLUDED.made_by, made_at = now(), error = NULL`,
    [seasonId, JSON.stringify(kept), JSON.stringify(meta), user.id]
  );
  return { text: `${kept.length} made-for games, of the ${ideas.length} the bot wrote`, count: kept.length };
}

/** A failed ask: the games there were stay, with why. */
async function fail(seasonId: string, user: SessionUser, why: string) {
  await pool.query(
    `INSERT INTO season_game_ideas (season_id, made_by, error) VALUES ($1, $2, $3) ON CONFLICT (season_id) DO UPDATE SET error = EXCLUDED.error`,
    [seasonId, user.id, why.slice(0, 500)]
  );
}
