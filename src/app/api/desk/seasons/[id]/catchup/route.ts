import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { HttpError } from "@/lib/server/db";
import { requireDesk } from "@/lib/server/desk";
import { botFor } from "@/lib/server/ask-bot";
import { catchUpLine, decideHold, holdsWaiting, runDueCatchUp, startCatchUp } from "@/lib/server/catch-up";
import { tryResults, type SubmittedFact } from "@/lib/server/community-results";
import { pool } from "@/lib/server/db";

// A season's catch-up on the desk (docs/PLAN-cast-properties.md chunk 6c, src/lib/server/catch-up.ts). GET where it is and the
// episodes waiting for you. POST `{ start: true }` (start it, or Try again after it stopped); `{ hold: <id>, decision: "sent" |
// "left" }` (an episode that would change scores: Send it, or Leave it out); `{ step: true }` (its next step now, without
// waiting for the bot's clock); `{ try: <episode>, facts }` (the scoring guard alone: what these results, as a full answer from
// the catch-up, would change in each game; nothing is written: scripts/dev-test/check-catch-up.js).
export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

export const GET = apiRoute(async (req, { params }: Params) => {
  await requireDesk(req);
  const { id } = await params;
  return NextResponse.json({ status: await catchUpLine(id), holds: await holdsWaiting(id) });
});

export const POST = apiRoute(async (req, { params }: Params) => {
  const user = await requireDesk(req);
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { start?: unknown; step?: unknown; try?: unknown; facts?: unknown; hold?: unknown; decision?: unknown };
  if (body.start === true) return NextResponse.json(await startCatchUp(user, id));
  if (body.step === true) {
    await runDueCatchUp({ bot: botFor(req), budgetMs: 280_000, only: id, ignoreHold: true });
    return NextResponse.json({ status: await catchUpLine(id), holds: await holdsWaiting(id) });
  }
  if (body.try !== undefined) {
    const n = Number(body.try);
    if (!Number.isInteger(n) || n < 1 || !Array.isArray(body.facts)) throw new HttpError(400, "try is an episode, with facts");
    const { rows } = await pool.query("SELECT name FROM season_cast WHERE season_id = $1", [id]);
    const facts = body.facts as SubmittedFact[];
    const people = [...new Set([...rows.map((r) => r.name as string), ...facts.map((f) => f.castawayName).filter(Boolean)])];
    return NextResponse.json(await tryResults({ seasonId: id, episode: n, source: "catchup", userId: null, couchId: null, covers: { people, kinds: null }, facts, payload: { facts } }));
  }
  if (typeof body.hold === "string") {
    const waiting = await holdsWaiting(id);
    if (!waiting.some((h) => h.id === body.hold)) throw new HttpError(404, "That isn't waiting");
    return NextResponse.json(await decideHold(user, body.hold, body.decision));
  }
  throw new HttpError(400, "start, or hold and decision");
});
