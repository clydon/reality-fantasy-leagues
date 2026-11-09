import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { botFor } from "@/lib/server/ask-bot";
import { requireDesk } from "@/lib/server/desk";
import { madeRow, makeGames } from "@/lib/server/made-games";

// G5's made-for games on the desk (src/lib/server/made-games.ts): GET how the season's stand (Setup's row), POST asks the bot for
// more (added to the library; `{ fresh: true }` in place of it) and answers once they're checked and kept (a minute or three).
// A dev server's stand-in bot comes from x-gys-bot.
export const maxDuration = 300;

export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  await requireDesk(req);
  const { id } = await params;
  return NextResponse.json(await madeRow(id));
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireDesk(req);
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { fresh?: unknown };
  return NextResponse.json(await makeGames(user, id, { bot: botFor(req), fresh: body.fresh === true }));
});
