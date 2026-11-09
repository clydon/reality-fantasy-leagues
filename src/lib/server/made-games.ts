import * as Words from "@/lib/game/game-words/index.js";
import * as Wizard from "@/lib/game/start-wizard/index.js";
import type { Choice } from "@/lib/game/start-wizard/index.js";
import type { MadeIdea } from "@/lib/game/game-words/index.js";
import type { SpecContext } from "@/lib/game/game-spec/index.js";
import { askBot, askBotStatus } from "./ask-bot";
import { isUuid, type SessionUser } from "./auth-helpers";
import { HttpError, pool } from "./db";
import { manualFor, packFor } from "./game-words";

// G5: a season's made-for games (docs/PLAN-start-a-game-gpt.md G5; the prompt and reading are game-words/made.js). One ask a
// season library, made from the desk (Setup › Made-for games: POST /api/desk/seasons/[id]/made, again to add more, `fresh` to
// start over), shared by every couch on it: the page
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
  /** The kinds of game and ways to win the library has none of yet. */
  missing: string[];
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
  const { rows } = await pool.query("SELECT ideas, made_at, error FROM season_game_ideas WHERE season_id = $1", [seasonId]);
  const r = rows[0];
  const games = Array.isArray(r?.ideas) ? (r.ideas as MadeGame[]) : [];
  return { count: games.length, missing: games.length ? missingFrom(games) : [], at: r?.made_at ? new Date(r.made_at).toISOString() : null, error: r?.error ?? null };
}

/**
 * The menu the prompt offers, from the wizard's own lists: what the engine plays, so a kind it gains is asked for from then on. Each
 * kind with the engine's own game of it on this season (the wizard's rail, the longest stretch it fits), for the bot to start from.
 */
function menu(page: { ctx: SpecContext; pack: Words.Pack }, next: number): Words.MadeMenu {
  const wizard = Wizard.createWizard({
    page,
    first: next,
    last: page.pack.episodes.total ?? null,
    phases: (page.ctx.phases ?? []).map((p) => ({ id: p.id, name: p.name ?? p.id, starts: null })),
    part: { singular: "episode", plural: "episodes" },
    label: page.pack.page,
  });
  const example = new Map<string, unknown>();
  const wins = new Map<string, Set<string>>();
  for (const span of [{ from: next, to: null }, { from: next, to: next + 2 }, { from: next, to: next }])
    for (const row of wizard.games(span).list) {
      if (!example.has(row.id)) example.set(row.id, Wizard.keepOf(row.spec));
      // The ways to win the engine takes for it, on any stretch.
      const ok = wins.get(row.id) ?? new Set<string>();
      for (const w of Wizard.WINS) if (wizard.winOk(span, { ...Wizard.fresh(), sel: row.id } as Choice, w.id).ok) ok.add(w.id);
      wins.set(row.id, ok);
    }
  return {
    kinds: Wizard.KINDS.map((k) => ({
      id: k.id,
      name: k.name,
      says: k.says("episode"),
      ...(example.has(k.id) ? { example: example.get(k.id), wins: [...wins.get(k.id)!] } : {}),
    })),
    wins: Wizard.WINS.map((w) => ({ id: w.id, label: w.label, says: w.says("episode") })),
    twists: Object.values(Wizard.TWISTS).map((t) => t.label),
    bets: Object.values(Wizard.MONEY).map(([label]) => label),
  };
}

/** The kinds of game and ways to win a library has none of yet, by name. */
function missingFrom(games: MadeGame[]): string[] {
  const kinds = new Set(games.map((g) => Wizard.kindOfSpec(g.spec)));
  const wins = new Set(games.map((g) => Wizard.winOfSpec(g.spec)));
  return [...Wizard.KINDS.filter((k) => !kinds.has(k.id)).map((k) => k.name), ...Wizard.WINS.filter((w) => !wins.has(w.id)).map((w) => `${w.label} (a way to win)`)];
}

/**
 * Ask the bot for the season's made-for games and keep the ones our check passes: added to the library (the kinds and ways to win
 * it lacks asked for first), or `fresh`, in place of it.
 */
export async function makeGames(user: SessionUser, seasonId: string, o: { bot?: string; fresh?: boolean } = {}): Promise<{ text: string; count: number }> {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const { pack, ctx, kind, show, games } = await packFor(user, seasonId, null);
  if (kind === "sport") throw new HttpError(400, "Made-for games are a show's: a sport's games come from its schedule");
  if (!(await askBotStatus({ bot: o.bot })).available) throw new HttpError(503, "Our bot isn't answering right now. Try again in a while.");
  const next = pack.episodes.next?.number ?? pack.episodes.aired + 1;
  const had = o.fresh ? [] : await madeGames(seasonId);
  const have = had.map((g) => ({ name: g.name, kind: Wizard.kindOfSpec(g.spec), length: g.length }));
  const prompt = Words.madePrompt({ pack, manual: manualFor(ctx, kind, show, games), menu: menu({ ctx, pack }, next), have, missing: had.length ? missingFrom(had) : [] });
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
  const last = pack.episodes.total ?? null;
  for (const idea of ideas) {
    if (idea.length === "season") continue;
    const to = idea.length === "one" ? next : last ? Math.min(last, next + 2) : next + 2;
    idea.game = { ...idea.game, span: { from: next, to } };
  }
  const kept: MadeGame[] = [];
  const dropped: { name: string; length: string; why: string }[] = [];
  const names = new Set(had.map((g) => g.name.toLowerCase()));
  for (const idea of ideas) {
    if (names.has(idea.name.toLowerCase())) {
      dropped.push({ name: idea.name, length: idea.length, why: "a name the library has" });
      continue;
    }
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
    names.add(idea.name.toLowerCase());
    kept.push({ name: idea.name, hook: idea.hook, length: idea.length, bet: idea.bet, spec: r.spec });
  }
  const all = [...had, ...kept];
  // The answer and what our check left out, kept to measure the prompt by (as game_word_asks keeps G1's).
  const meta = { seconds: asked.seconds, wrote: ideas.length, kept: kept.length, dropped, missing: missingFrom(all), answer: asked.answer };
  await pool.query(
    `INSERT INTO season_game_ideas (season_id, ideas, asked, made_by, made_at, error) VALUES ($1, $2, $3, $4, now(), NULL)
     ON CONFLICT (season_id) DO UPDATE SET ideas = EXCLUDED.ideas, asked = EXCLUDED.asked, made_by = EXCLUDED.made_by, made_at = now(), error = NULL`,
    [seasonId, JSON.stringify(all), JSON.stringify(meta), user.id]
  );
  return { text: `${kept.length} new made-for games, of the ${ideas.length} the bot wrote: ${all.length} in all`, count: all.length };
}

/** A failed ask: the games there were stay, with why. */
async function fail(seasonId: string, user: SessionUser, why: string) {
  await pool.query(
    `INSERT INTO season_game_ideas (season_id, made_by, error) VALUES ($1, $2, $3) ON CONFLICT (season_id) DO UPDATE SET error = EXCLUDED.error`,
    [seasonId, user.id, why.slice(0, 500)]
  );
}
