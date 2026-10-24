import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { pool, HttpError } from "@/lib/server/db";
import { askBot } from "@/lib/server/ask-bot";
import { runNext, planRuns } from "@db/bot-research.js";

// The bot research clock (db/bot-research.js): the ask-AI bot's VM calls this, and each call runs at most
// one due run. Vercel's own cron can't run minutes after an episode airs on this plan, and the VM is up
// anyway. Every answer carries `next`, when the next run comes due (null: none left), and the VM's tick
// (llm-browser-api's deploy/tick.py) only calls again then, plus a check-in every few hours: a call every
// couple of minutes kept the database awake around the clock (docs/HOSTING.md).
//
//   POST            run the earliest due run, if any; { job, ..., next }
//   GET ?dry=1      what's due and `next`, run nothing
//
// Authorization: Bearer <CRON_SECRET>, the same value in Vercel and the VM's .env.
export const maxDuration = 300;

function requireCron(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new HttpError(503, "CRON_SECRET isn't set");
  if (req.headers.get("authorization") !== `Bearer ${secret}`) throw new HttpError(401, "Bad cron secret");
}

// A test's clock, so a dev check can ask "what would be due at 8:10pm Wednesday?". Never in production.
function nowFrom(req: Request): Date {
  const at = new URL(req.url).searchParams.get("now");
  if (!at || process.env.NODE_ENV === "production") return new Date();
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) throw new HttpError(400, "now must be an ISO time");
  return d;
}

export const GET = apiRoute(async (req) => {
  requireCron(req);
  const { due, next } = await planRuns(pool, { now: nowFrom(req) });
  return NextResponse.json({
    due: due.map((d) => ({ season: d.season.slug, seasonNumber: d.season.season_number, episode: d.episode, slot: d.slot, at: d.at })),
    next,
  });
});

export const POST = apiRoute(async (req) => {
  requireCron(req);
  const out = await runNext(pool, { ask: askBot, now: nowFrom(req) });
  return NextResponse.json(out);
});
