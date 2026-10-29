import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { HttpError } from "@/lib/server/db";
import { requireDesk } from "@/lib/server/desk";
import { acceptAll, clearEpisode, deskEpisode, pasteAnswer, setTriviaOut, takeBack } from "@/lib/server/desk-episode";

// An episode's page on the desk (docs/PLAN-desk-parity.md step 4, part 4b): GET its results, answers, trivia and History.
// POST `{ acceptAll: [ids] }` (tier 2: the waiting results its sheet showed, with a name in the cast, canonical); `{ takeBack: <answer id>,
// preview? }` (tier 2: what moves, or the answer withdrawn); `{ paste: <the AI's answer>, preview?, confirmed? }` (what it
// adds, or filed as the desk's own submission; a 409 asks whether it really is this episode); `{ trivia: <question id>,
// out }` (Take it out, Put it back). Each change answers `{ changeId, text }` for the toast's Undo. DELETE `?scope=waiting`
// with `{ ids }`, the ones it showed (tier 1, Undo), or `?scope=everything` (tier 3). Deciding one result is the fact's own route (/api/desk/facts/[id]).
export const maxDuration = 120;

type Params = { params: Promise<{ id: string; n: string }> };

export const GET = apiRoute(async (req, { params }: Params) => {
  const user = await requireDesk(req);
  const { id, n } = await params;
  return NextResponse.json(await deskEpisode(user, id, n));
});

export const POST = apiRoute(async (req, { params }: Params) => {
  const user = await requireDesk(req);
  const { id, n } = await params;
  const body = (await req.json().catch(() => ({}))) as { acceptAll?: unknown; takeBack?: unknown; paste?: unknown; preview?: unknown; confirmed?: unknown; trivia?: unknown; out?: unknown };
  if (body.acceptAll !== undefined) return NextResponse.json(await acceptAll(user, id, n, body.acceptAll));
  if (body.takeBack !== undefined) return NextResponse.json(await takeBack(user, id, n, body.takeBack, body.preview === true));
  if (body.paste !== undefined) return NextResponse.json(await pasteAnswer(user, id, n, { answer: body.paste, preview: body.preview, confirmed: body.confirmed }));
  if (body.trivia !== undefined) return NextResponse.json(await setTriviaOut(user, id, n, body.trivia, body.out === true));
  throw new HttpError(400, "acceptAll, takeBack, paste or trivia");
});

export const DELETE = apiRoute(async (req, { params }: Params) => {
  const user = await requireDesk(req);
  const { id, n } = await params;
  const body = (await req.json().catch(() => ({}))) as { ids?: unknown };
  return NextResponse.json(await clearEpisode(user, id, n, new URL(req.url).searchParams.get("scope"), body.ids));
});
