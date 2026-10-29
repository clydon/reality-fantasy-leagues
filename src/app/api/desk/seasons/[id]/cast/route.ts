import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { botFor } from "@/lib/server/ask-bot";
import { requireDesk } from "@/lib/server/desk";
import { deskCast, pasteCast, sendCast } from "@/lib/server/desk-cast-page";
import { queueCast, takeOverQueue } from "@/lib/server/desk-research";
import { listingsFor } from "@/lib/server/listings";

// A season's Cast (docs/PLAN-desk-parity.md step 5, part 5a; src/lib/server/desk-cast-page.ts): GET the page; POST `{ ask: true }`
// Ask our bot (queued behind the other Run nows), `{ paste }` an answer from Ask an AI (staged, as our bot's is), or `{ send:
// true, answer, picks, preview? }` Send to its games (what moves said first, then sent: `{ changeId, text }` for the toast's Undo).
// Asking drives the queue after the answer (up to 280 s of the bot's), so the route has the whole 300.
export const maxDuration = 300;

export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireDesk(req);
  const { id } = await params;
  const page = await deskCast(user, id);
  // While it's asking, a queue whose driver was cut off is this read's to take over.
  if (page.asking) await takeOverQueue(new URL(req.url).origin);
  return NextResponse.json(page);
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireDesk(req);
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { ask?: unknown; paste?: unknown; send?: unknown; answer?: unknown; picks?: unknown; preview?: unknown };
  if (body.ask === true) return NextResponse.json(await queueCast(user, id, { bot: botFor(req), origin: new URL(req.url).origin }));
  if (body.paste !== undefined) return NextResponse.json(await pasteCast(user, id, body.paste));
  if (body.send === true) return NextResponse.json(await sendCast(user, id, body, { listings: listingsFor(req) }));
  return NextResponse.json({ error: "ask, paste or send" }, { status: 400 });
});
