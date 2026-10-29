import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireDesk } from "@/lib/server/desk";
import { bingoLine } from "@/lib/server/desk-bingo";
import { seasonBot, setSeasonBot } from "@/lib/server/desk-bot";
import { clearGroup, deskSeason } from "@/lib/server/desk-cast";
import { castRow } from "@/lib/server/desk-cast-page";
import { episodeRows } from "@/lib/server/desk-episode";
import { deleteSeason, deskSetup } from "@/lib/server/desk-setup";

// A season on the desk (step 6b part 2): GET its rulebook, cast and episodes' results, and (6c part 2) its bot's schedule,
// and (docs/PLAN-desk-parity.md part 3a) its Setup as the page shows it (the lower third, Running it › Setup's line) and its
// Delete, and (part 4b) its Episodes, each a row to its own page, and (part 4c) Running it › Bingo bank's line, and (part 5a)
// Running it › Cast's line and its dot; POST `{ clearGroup, preview? }` takes a group off the cast and out of every league on the season (Not a <group>,
// the Cast page's: a group named like a secret role goes with every other one so named, part 5b); POST `{ bot: { on?, schedule? } }` changes the bot's schedule for the season (Autopilot's trial); DELETE
// deletes it (tier 3: refused while games play it).
export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireDesk(req);
  const { id } = await params;
  const [season, setup, bot, episodes, bingo, cast] = await Promise.all([deskSeason(id), deskSetup(id), seasonBot(id), episodeRows(id), bingoLine(id), castRow(id, user.id)]);
  return NextResponse.json({
    ...season,
    episodeRows: episodes,
    bot,
    history: setup.history,
    setup: { line: setup.setupLine, next: setup.next, facts: setup.facts, scheduled: setup.scheduled },
    delete: setup.delete,
    bingo: { line: bingo },
    castRow: cast,
  });
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireDesk(req);
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { clearGroup?: unknown; preview?: unknown; bot?: { on?: unknown; schedule?: unknown } };
  if (body.bot && typeof body.bot === "object") return NextResponse.json({ bot: (await setSeasonBot(user, id, body.bot)).bot });
  return NextResponse.json(await clearGroup(user, id, { group: body.clearGroup, preview: body.preview }));
});

export const DELETE = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireDesk(req);
  const { id } = await params;
  return NextResponse.json(await deleteSeason(user, id));
});
