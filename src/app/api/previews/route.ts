import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/http-error";
import { appOnly, startPreview } from "@/lib/server/previews";

// A game's live preview (docs/PLAN-preview-release.md, step 9; src/lib/server/previews.ts), for the gallery's Preview button (step
// 15). Signed in, the desk's switch open to you.
//   POST { season, couch, game: { base, changes }, exits: { back, create } }  -> { id, story, reopened, left }
// `story` is the preview's address on the preview service (a way in, used once): the page goes there. `exits` are where its last
// card's Go back and Create this game go, on this host (default: home). Making one can take a while: its first moment is written
// before it answers, the rest after.
export const maxDuration = 120;

// A path on this host: one leading slash, never two (a "//host" would be another site's address).
const isPath = (v: unknown): v is string => typeof v === "string" && /^\/(?!\/)[\w\-/?=&%.]*$/.test(v) && !v.includes("//");

export const POST = apiRoute(async (req) => {
  appOnly();
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as { season?: unknown; couch?: unknown; game?: { base?: unknown; changes?: unknown }; exits?: { back?: unknown; create?: unknown } };
  if (typeof body.season !== "string") throw new HttpError(400, "Which season?");
  if (typeof body.game?.base !== "string") throw new HttpError(400, "Which game?");
  const changes = Array.isArray(body.game.changes) ? body.game.changes : [];
  // The game as the gallery holds it (step 15), checked on the season like a base before anything plays it; a few KB at most.
  const raw = (body.game as { spec?: unknown }).spec;
  const spec = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : undefined;
  if (spec && JSON.stringify(spec).length > 32_000) throw new HttpError(413, "That game is too big to preview");
  const origin = new URL(req.url).origin;
  // Only places on this host: a preview's buttons never send anyone elsewhere.
  const exits = { back: origin + (isPath(body.exits?.back) ? body.exits.back : "/home"), create: origin + (isPath(body.exits?.create) ? body.exits.create : "/home") };
  return NextResponse.json(await startPreview(user, { seasonId: body.season, couchId: typeof body.couch === "string" ? body.couch : null, game: { base: body.game.base, changes, ...(spec ? { spec } : {}) }, exits, origin }));
});
