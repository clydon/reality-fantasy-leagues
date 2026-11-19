import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth, isUuid } from "@/lib/server/auth-helpers";
import { HttpError, pool } from "@/lib/server/db";
import { requireCouch } from "@/lib/server/couches";
import { seasonArchive } from "@/lib/server/season-games";

// Your finished games on a show, a page at a time (docs/PLAN-start-a-game-redo.md E2; Round 3's archive, built in B3): with `?couch=`
// that couch's games here that you play, else all of yours; only those over as far as you've seen, newest first, each kept small (its
// episodes, who won it, your place). `&before=<episode>` (the last page's oldest `ended`) and `&limit=` (20 by default, 50 at most; a page ends on a
// whole episode) page through them; `more` says whether there are older ones. Round 3: `&kind=<a game's name>` keeps one kind;
// `&record=1` adds your record across them (each game's places by person) and the kinds there are, for the archive's head.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const { rows } = await pool.query("SELECT 1 FROM show_seasons WHERE id = $1", [seasonId]);
  if (!rows.length) throw new HttpError(404, "Season not found");
  const q = new URL(req.url).searchParams;
  const couchId = q.get("couch");
  if (couchId) await requireCouch(user, couchId);
  const num = (k: string) => (q.get(k) !== null && /^\d+$/.test(q.get(k) ?? "") ? Number(q.get(k)) : null);
  return NextResponse.json(await seasonArchive(user, seasonId, couchId, { before: num("before"), limit: num("limit") ?? undefined, kind: q.get("kind") || null, record: q.get("record") === "1" }));
});
