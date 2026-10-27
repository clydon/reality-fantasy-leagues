import { after, NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { pool, HttpError } from "@/lib/server/db";
import { askBot, botFor } from "@/lib/server/ask-bot";
import { botSend } from "@/lib/server/bot-results";
import { requireCron } from "@/lib/server/cron";
import { listingsFor } from "@/lib/server/listings";
import { listingsDue, refreshListings } from "@/lib/server/tv-listings";
import { advanceAllAuto } from "@/lib/server/keep-up";
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
// Each answer is a source like anyone's (step 6c, src/lib/server/bot-results.ts): what's trusted reaches every league on
// the season on its own, and who went home that can't be trusted yet waits in Backstage and is asked again.
//
// The daily listings job rides on these calls (step 11 part 2, src/lib/server/tv-listings.ts): a call that ran no bot job,
// when today's listings are still to read, reads them after its answer is sent (after()), so it wakes nothing the call
// hadn't woken already and never holds up a bot run. `listings` in the answer says it did.
//
// So do shows set to move along by themselves (keep-up.ts advanceAllAuto): every call moves their marks forward, after its answer.
//
// Authorization: Bearer <CRON_SECRET>, the same value in Vercel and the VM's .env.
export const maxDuration = 300;

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
  const bot = botFor(req);
  const base = listingsFor(req);
  const out = await runNext(pool, { ask: (prompt, o) => askBot(prompt, { ...o, bot }), send: botSend, now: nowFrom(req) });
  const listings = !out.job && (await listingsDue());
  if (listings) after(() => refreshListings(base, { how: "clock" }).catch((e) => console.error("[listings] the daily run:", e)));
  // Shows set to move along by themselves (keep-up.ts): marks moved for everyone, so a couch sees each other where they are.
  after(() => advanceAllAuto().catch((e) => console.error("[keep-up] auto:", e)));
  return NextResponse.json({ ...out, listings });
});
