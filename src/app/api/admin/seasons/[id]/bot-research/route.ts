import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin, isUuid } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { askBot } from "@/lib/server/ask-bot";
import { loadSeasonForJob, runJob } from "@db/bot-research.js";
import { episodeAirsAt } from "@db/auto-research.js";

// Bot research (experimental) for one season, from Admin: the runs so far (GET ?episode=N for one
// episode), and "Run now" (POST { episode, kind }) outside the schedule. A run now is recorded like a
// scheduled one (slot "now"), so the episode page shows it with the rest.
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
  const body = (await req.json().catch(() => ({}))) as { episode?: unknown; kind?: unknown };
  const episode = Number(body.episode);
  if (!Number.isInteger(episode) || episode < 1) throw new HttpError(400, "episode must be a positive whole number");
  if (body.kind !== "quick" && body.kind !== "full" && body.kind !== "schedule") throw new HttpError(400, "kind must be quick, full or schedule");
  const season = await loadSeasonForJob(pool, id);
  if (!season) throw new HttpError(404, "Season not found");
  const airsAt = await episodeAirsAt(pool, id, episode);
  if (airsAt && airsAt.getTime() > Date.now()) throw new HttpError(400, `Episode ${episode} hasn't aired yet`);
  const outcome = await runJob(pool, { season, episode, kind: body.kind }, { ask: askBot });
  return NextResponse.json(outcome);
});
