import { NextResponse } from "next/server";
import { addShow } from "@/lib/server/add-show";
import { apiRoute } from "@/lib/server/api-route";
import { pool } from "@/lib/server/db";
import { requireDesk } from "@/lib/server/desk";
import { listingsFor } from "@/lib/server/listings";

// The desk's New show (docs/PLAN-new-design.md step 10 part 3): POST { listing: <TVmaze id> } or { name } makes the show (or
// finds the one that's here) as Add a show does, without following it or counting against a day's new shows. Returns the
// season to set up, and the show. A show by name the desk picks is one it has looked at: never the Inbox's.
export const POST = apiRoute(async (req) => {
  const user = await requireDesk(req);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const added = await addShow(user.id, { listing: body.listing, name: body.name }, listingsFor(req), new Date(), { follow: false, cap: false });
  const { rows } = await pool.query("SELECT show_id FROM show_seasons WHERE id = $1", [added.seasonId]);
  const showId = rows[0]?.show_id ?? null;
  if (showId && body.name !== undefined) {
    await pool.query("UPDATE shows SET reviewed_at = COALESCE(reviewed_at, now()), reviewed_by = COALESCE(reviewed_by, $2) WHERE id = $1 AND tvmaze_id IS NULL", [showId, user.id]);
  }
  return NextResponse.json({ ...added, showId });
});
