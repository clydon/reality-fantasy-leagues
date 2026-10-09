import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin, isUuid } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { syncSeasonLeagues } from "@/lib/server/season-decisions";

// Accept every still-pending decision for one episode, as proposed, then sync the season's leagues
// once. Rows already decided (either way) keep their decision. `ids`, when given, narrows it to those
// rows -- the review list's per-event "Accept N" (e.g. everyone on a winning tribe at once).
export const POST = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const user = await requireSuperAdmin(req);
  if (!isUuid(id)) throw new HttpError(404, "Season not found");
  const body = (await req.json().catch(() => ({}))) as { episode?: unknown; ids?: unknown };
  const episode = Number(body.episode);
  if (!Number.isInteger(episode) || episode < 1) throw new HttpError(400, "episode must be a positive whole number");
  let ids: string[] | null = null;
  if (body.ids !== undefined) {
    if (!Array.isArray(body.ids) || !body.ids.every((x) => typeof x === "string" && isUuid(x)))
      throw new HttpError(400, "ids must be a list of decision ids");
    ids = body.ids as string[];
  }

  const { rowCount } = await pool.query(
    `UPDATE season_decisions SET status='accepted', decided_at=now(), decided_by=$3, applied=NULL
      WHERE season_id=$1 AND episode_number=$2 AND status='pending' AND ($4::uuid[] IS NULL OR id = ANY($4::uuid[]))`,
    [id, episode, user.id, ids]
  );
  const leagues = await syncSeasonLeagues(id, user.id);
  return NextResponse.json({ ok: true, accepted: rowCount ?? 0, leagues });
});
