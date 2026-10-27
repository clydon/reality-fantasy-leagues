import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin, isUuid } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { askBot, botFor } from "@/lib/server/ask-bot";
import { botSend } from "@/lib/server/bot-results";
import { loadSeasonForJob, runJob } from "@db/bot-research.js";
import { episodeAirsAt } from "@db/auto-research.js";

// Bot research (experimental) for one season, from Admin: the runs so far (GET ?episode=N for one
// episode), and "Run now" (POST { episode, kind }) outside the schedule. A run now is recorded like a
// scheduled one (slot "now"), so the episode page shows it with the rest. Bingo's ("Write squares now",
// docs/PLAN-bingo-bank.md step 2) is for an episode coming up, so it doesn't wait for it to air; `scope:
// "season"` writes the season's own bank. A dev server's stand-in bot comes from the x-gys-bot header
// (ask-bot.ts botFor), as the cron route's does.
export const maxDuration = 300;

export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  await requireSuperAdmin(req);
  if (!isUuid(id)) throw new HttpError(404, "Season not found");
  const episode = Number(new URL(req.url).searchParams.get("episode"));
  const { rows } = await pool.query(
    `SELECT id, episode_number AS episode, slot, kind, started_at AS "startedAt", finished_at AS "finishedAt", ok, message, result, seconds
       FROM bot_research_runs
      WHERE season_id=$1 AND ($2::int IS NULL OR episode_number=$2)
      ORDER BY started_at DESC
      LIMIT 100`,
    [id, Number.isInteger(episode) && episode > 0 ? episode : null]
  );
  return NextResponse.json({ runs: rows });
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  await requireSuperAdmin(req);
  if (!isUuid(id)) throw new HttpError(404, "Season not found");
  const body = (await req.json().catch(() => ({}))) as { episode?: unknown; kind?: unknown; scope?: unknown };
  const episode = Number(body.episode);
  if (!Number.isInteger(episode) || episode < 1) throw new HttpError(400, "episode must be a positive whole number");
  const kind = body.kind;
  if (kind !== "quick" && kind !== "full" && kind !== "schedule" && kind !== "trivia" && kind !== "bingo") throw new HttpError(400, "kind must be quick, full, schedule, trivia or bingo");
  if (body.scope !== undefined && (kind !== "bingo" || (body.scope !== "episode" && body.scope !== "season"))) throw new HttpError(400, "scope is bingo's: episode or season");
  const season = await loadSeasonForJob(pool, id);
  if (!season) throw new HttpError(404, "Season not found");
  if (kind !== "bingo") {
    const airsAt = await episodeAirsAt(pool, id, episode);
    if (airsAt && airsAt.getTime() > Date.now()) throw new HttpError(400, `Episode ${episode} hasn't aired yet`);
  }
  // Filed as a source like a scheduled run's (step 6c): what's trusted reaches every league on the season.
  const bot = botFor(req);
  const outcome = await runJob(pool, { season, episode, kind, forSeason: body.scope === "season" }, { ask: (prompt, o) => askBot(prompt, { ...o, bot }), send: botSend });
  return NextResponse.json(outcome);
});
