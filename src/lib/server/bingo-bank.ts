import * as Air from "@/lib/game/air-schedule.js";
import { MIN_MOMENTS, type Likelihood } from "@/lib/game/bingo";
import { bingoContext, buildBingoPrompt, parseBingoAnswer, storeBank, MIN_BANK } from "@db/bingo-research.js";
import { isUuid } from "./auth-helpers";
import { FLAGGED_OUT } from "./bingo";
import { HttpError, pool } from "./db";
import { seasonSchedules } from "./schedule";

// Bingo's bank by hand (docs/PLAN-bingo-bank.md step 1: the admin episode page's prompt and paste, before the bot writes them):
//   GET  /api/admin/seasons/[id]/bingo?episode=&scope=episode|season   the episode's bank and the season's own, which one its
//        cards deal from, and the prompt for the one asked (copy it into any AI chat with web search)
//   POST /api/admin/seasons/[id]/bingo   { episode, scope, answer }   the chat's answer, parsed and filed, replacing that bank
//        { episode, flag: <square id>, on }   Hide a square (an admin's flag takes it out of new cards at once; step 4), or not
// The prompt and parse are db/bingo-research.js's; dealing is bingo.ts's (bankFor). Super admins only (the route says so).

export interface AdminBankSquare {
  id: string;
  label: string;
  likelihood: Likelihood;
  status: "live" | "dropped";
  note: string | null;
  /** How many have flagged it as unfair (step 4), whether that's taken it out of new cards, and whether you flagged it. */
  flags: number;
  hidden: boolean;
  mine: boolean;
}

export interface AdminBingoBank {
  episode: number;
  scope: "episode" | "season";
  /** What this episode's cards are dealt from: its own bank, the season's, or nothing (no card). */
  using: "episode" | "season" | null;
  banks: { episode: AdminBankSquare[]; season: AdminBankSquare[] };
  /** The prompt for `scope`'s bank. */
  prompt: string;
  /** When the episode airs (UTC ISO), null when nothing says. */
  airAt: string | null;
  /** The fewest live squares a bank is kept with. */
  min: number;
}

type Scope = "episode" | "season";

function parseIn(seasonId: string, episode: unknown, scope: unknown): { n: number; scope: Scope } {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const n = Number(episode);
  if (!Number.isInteger(n) || n < 1 || n > 1000) throw new HttpError(400, "episode must be a positive whole number");
  if (scope !== "episode" && scope !== "season") throw new HttpError(400, "scope must be episode or season");
  return { n, scope };
}

/** The prompt's context for a bank: the episode's (with its air time, title and note from the schedule), or the season's own. */
async function contextFor(seasonId: string, n: number, scope: Scope, now: Date) {
  const schedule = (await seasonSchedules([seasonId], now)).get(seasonId);
  if (!schedule) throw new HttpError(404, "Season not found");
  const ep = schedule.episodes.find((e) => e.number === n) ?? null;
  const airAt = ep?.airAt ?? null;
  const ctx = await bingoContext(
    pool,
    seasonId,
    scope === "episode" ? n : null,
    scope === "episode" ? { airAt: airAt ? Air.formatInTz(new Date(airAt), schedule.airTz) : null, title: ep?.title ?? null, note: ep?.note ?? null } : {}
  );
  return { ctx, airAt };
}

async function banksOf(seasonId: string, n: number, adminId: string | null): Promise<AdminBingoBank["banks"]> {
  const { rows } = await pool.query(
    `SELECT s.id, s.episode, s.label, s.likelihood, s.status, s.note,
            (SELECT count(*)::int FROM bingo_square_flags f WHERE f.square_id = s.id) AS flags, ${FLAGGED_OUT("s.id")} AS hidden,
            EXISTS (SELECT 1 FROM bingo_square_flags f WHERE f.square_id = s.id AND f.user_id = $3) AS mine
       FROM bingo_squares s
      WHERE s.season_id = $1 AND (s.episode = $2 OR s.episode IS NULL)
      ORDER BY s.status DESC, array_position(ARRAY['likely', 'maybe', 'longshot'], s.likelihood), s.created_at, s.id`,
    [seasonId, n, adminId]
  );
  const of = (episode: number | null) =>
    rows
      .filter((r) => (r.episode ?? null) === episode)
      .map((r) => ({ id: r.id, label: r.label, likelihood: r.likelihood, status: r.status, note: r.note ?? null, flags: r.flags, hidden: !!r.hidden, mine: !!r.mine }));
  return { episode: of(n), season: of(null) };
}

/** Which bank an episode's cards deal from, as bingo.ts bankFor decides (a bank big enough for a card, less what's flagged out). */
function usingOf(banks: AdminBingoBank["banks"]): AdminBingoBank["using"] {
  const live = (l: AdminBankSquare[]) => l.filter((s) => s.status === "live" && !s.hidden).length >= MIN_MOMENTS;
  return live(banks.episode) ? "episode" : live(banks.season) ? "season" : null;
}

/** An episode's bank and the season's, and the prompt for `scope`'s. */
export async function adminBingoBank(seasonId: string, episode: unknown, scopeIn: unknown, now = new Date(), adminId: string | null = null): Promise<AdminBingoBank> {
  const { n, scope } = parseIn(seasonId, episode, scopeIn);
  const [{ ctx, airAt }, banks] = await Promise.all([contextFor(seasonId, n, scope, now), banksOf(seasonId, n, adminId)]);
  return { episode: n, scope, using: usingOf(banks), banks, prompt: buildBingoPrompt(ctx), airAt, min: MIN_BANK };
}

/**
 * Files a chat's answer as `scope`'s bank for the episode (or the season's own), replacing it: every square kept, live or dropped
 * with why. Refused (nothing filed) when fewer than MIN_BANK pass: a bank that can't fill a card isn't one.
 */
export async function saveBingoBank(seasonId: string, body: { episode?: unknown; scope?: unknown; answer?: unknown }, now = new Date(), adminId: string | null = null): Promise<AdminBingoBank & { live: number; dropped: number }> {
  const { n, scope } = parseIn(seasonId, body.episode, body.scope);
  const answer = typeof body.answer === "string" ? body.answer : "";
  if (!answer.trim()) throw new HttpError(400, "Paste the chat's answer");
  const { ctx } = await contextFor(seasonId, n, scope, now);
  let parsed: ReturnType<typeof parseBingoAnswer>;
  try {
    parsed = parseBingoAnswer(answer, { avoid: ctx.avoid, names: ctx.cast, anyone: scope === "episode" });
  } catch {
    throw new HttpError(400, "That answer has no JSON in it: paste the chat's whole reply");
  }
  const live = parsed.squares.filter((s) => s.status === "live").length;
  if (live < MIN_BANK) {
    throw new HttpError(400, `Only ${live} of ${parsed.squares.length} squares passed: a bank needs at least ${MIN_BANK}. Ask again, or paste a longer answer.`);
  }
  await storeBank(pool, seasonId, scope === "episode" ? n : null, parsed.squares);
  const out = await adminBingoBank(seasonId, n, scope, now, adminId);
  return { ...out, live, dropped: parsed.squares.length - live };
}

/**
 * Hide a bank's square (step 4): an admin's flag takes it out of every new card at once (FLAGGED_OUT); `on` false takes the flag
 * back (two people's flags still keep it out). Cards already ticked keep it. Answers the episode's banks.
 */
export async function adminFlagSquare(seasonId: string, adminId: string, body: { episode?: unknown; scope?: unknown; flag?: unknown; on?: unknown }, now = new Date()): Promise<AdminBingoBank> {
  const { n, scope } = parseIn(seasonId, body.episode, body.scope ?? "episode");
  const id = typeof body.flag === "string" ? body.flag : "";
  if (!isUuid(id)) throw new HttpError(400, "Which square?");
  if (typeof body.on !== "boolean") throw new HttpError(400, "on must be true or false");
  if (body.on) {
    const { rowCount } = await pool.query(
      "INSERT INTO bingo_square_flags (square_id, user_id) SELECT id, $2 FROM bingo_squares WHERE id = $1 AND season_id = $3 ON CONFLICT DO NOTHING",
      [id, adminId, seasonId]
    );
    if (!rowCount && !(await pool.query("SELECT 1 FROM bingo_squares WHERE id = $1 AND season_id = $2", [id, seasonId])).rows.length) throw new HttpError(404, "No such square");
  } else {
    await pool.query("DELETE FROM bingo_square_flags WHERE square_id = $1 AND user_id = $2", [id, adminId]);
  }
  return adminBingoBank(seasonId, n, scope, now, adminId);
}
