import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin, isUuid } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";

type RouteParams = { id: string };

// Editable fields only. `slug` is deliberately absent: leagues store it in settings.showId, so
// changing it would orphan them. Rename via `name` -- the slug is an internal identity, not a label.
const EDITABLE: Record<string, string> = {
  name: "name",
  castawayTerm: "castaway_term",
  tribeTerm: "tribe_term",
  wikiApiUrl: "wiki_api_url",
  archived: "archived",
};

export const PATCH = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { id } = await params;
  await requireSuperAdmin(req);
  if (!isUuid(id)) throw new HttpError(404, "Show not found");
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const sets: string[] = [];
  const values: unknown[] = [id];
  for (const [key, column] of Object.entries(EDITABLE)) {
    if (!(key in body)) continue;
    let value = body[key];
    if (key === "archived") value = !!value;
    else if (typeof value === "string") value = value.trim() || null;
    // Terminology has a sensible default rather than being nullable -- an empty term would render as
    // a blank word in the UI.
    if ((key === "castawayTerm" || key === "tribeTerm") && !value) {
      value = key === "castawayTerm" ? "Castaway" : "Tribe";
    }
    if (key === "name" && !value) throw new HttpError(400, "name can't be empty");
    values.push(value);
    sets.push(`${column}=$${values.length}`);
  }
  if (!sets.length) throw new HttpError(400, "No editable fields supplied");

  const { rows } = await pool.query(
    `UPDATE shows SET ${sets.join(", ")}, updated_at=now() WHERE id=$1 RETURNING id, slug, name, archived`,
    values
  );
  if (!rows.length) throw new HttpError(404, "Show not found");
  return NextResponse.json({ show: rows[0] });
});

// Refuses while any league still references the show, and says how many -- deleting would leave
// those leagues pointing at a slug that resolves to nothing. Archiving is the intended way to retire
// a show that's in use: it disappears from the picker while existing leagues keep working.
export const DELETE = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { id } = await params;
  await requireSuperAdmin(req);
  if (!isUuid(id)) throw new HttpError(404, "Show not found");

  const { rows } = await pool.query("SELECT slug FROM shows WHERE id=$1", [id]);
  if (!rows.length) throw new HttpError(404, "Show not found");
  const { rows: usage } = await pool.query(
    "SELECT count(*)::int AS n FROM leagues WHERE state->'settings'->>'showId' = $1",
    [rows[0].slug]
  );
  if (usage[0].n > 0) {
    throw new HttpError(
      409,
      `${usage[0].n} league${usage[0].n === 1 ? "" : "s"} still use this show. Archive it instead of deleting.`
    );
  }
  // Seasons go with it (ON DELETE CASCADE).
  await pool.query("DELETE FROM shows WHERE id=$1", [id]);
  return NextResponse.json({ ok: true });
});
