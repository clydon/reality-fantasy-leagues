import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { isUuid, requireAuth } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { applyChosen, backstageScope, type Chosen } from "@/lib/server/backstage";

// Results you chose, applied to every game you run here (step 5, guards tier 2): `{ episode, items, quick?, preview? }`.
// `items`: staged results by id (each possibly corrected), or with `quick`, who went home by name and how (entered
// yourself, or a quick check that waited). `preview: true` writes nothing and answers what would change, for the sheet
// you confirm in; then the same body without it applies, one batch in Recent changes with Undo. `wait: { id, right }`: the
// quick check that waited (step 6c), answered It's right (its own names) or Not right (who you entered instead).
export const POST = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const scope = await backstageScope(user, seasonId, new URL(req.url).searchParams.get("couch"));
  const body = (await req.json().catch(() => ({}))) as { episode?: unknown; items?: unknown; quick?: unknown; preview?: unknown; wait?: { id?: unknown; right?: unknown } };
  if (!Number.isInteger(body.episode) || (body.episode as number) < 1) throw new HttpError(400, "episode required");
  const wait = body.wait && typeof body.wait.id === "string" && isUuid(body.wait.id) ? { id: body.wait.id, right: body.wait.right === true } : undefined;
  return NextResponse.json(await applyChosen(scope, body.episode as number, body.items as Chosen[], { quick: body.quick === true, preview: body.preview === true, wait }));
});
