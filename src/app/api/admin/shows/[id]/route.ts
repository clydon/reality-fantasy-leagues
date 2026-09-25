import { NextResponse } from "next/server";
import { FORMATS } from "@/lib/game/formats/index.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin, isUuid } from "@/lib/server/auth-helpers";
import { pool, withLeagueLock, HttpError } from "@/lib/server/db";

type RouteParams = { id: string };

// Editable fields only. `slug` is deliberately absent: leagues store it in settings.showId, so
// changing it would orphan them. Rename via `name` -- the slug is an internal identity, not a label.
const EDITABLE: Record<string, string> = {
  name: "name",
  castawayTerm: "castaway_term",
  tribeTerm: "tribe_term",
  wikiApiUrl: "wiki_api_url",
  // Nullable on purpose -- clearing it means "go back to inferring the heading from castawayTerm".
  castSectionHeading: "cast_section_heading",
  // Sites episode research may search (db/migrations/0017). Accepts a comma/space/newline-separated
  // string or an array; empty clears it back to the defaults.
  researchDomains: "research_domains",
  // Which game rules the show plays by (db/migrations/0021). Leagues cache it, so a change is pushed
  // into each of them below.
  format: "format",
  archived: "archived",
};

// "https://www.EW.com/tv/..." -> "ew.com". Hostnames only: that's what the search tools filter on.
function parseDomains(value: unknown): string[] | null {
  const raw = Array.isArray(value) ? value.map(String) : String(value ?? "").split(/[\s,]+/);
  const out: string[] = [];
  for (const piece of raw) {
    const host = piece
      .trim()
      .toLowerCase()
      .replace(/^[a-z]+:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0];
    if (host && host.includes(".") && !out.includes(host)) out.push(host);
  }
  return out.length ? out : null;
}

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
    else if (key === "researchDomains") value = parseDomains(value);
    else if (typeof value === "string") value = value.trim() || null;
    // Terminology has a sensible default rather than being nullable -- an empty term would render as
    // a blank word in the UI.
    if ((key === "castawayTerm" || key === "tribeTerm") && !value) {
      value = key === "castawayTerm" ? "Castaway" : "Tribe";
    }
    if (key === "name" && !value) throw new HttpError(400, "name can't be empty");
    if (key === "format" && !(typeof value === "string" && value in FORMATS)) {
      throw new HttpError(400, `"${String(value)}" isn't a show format`);
    }
    values.push(value);
    sets.push(`${column}=$${values.length}`);
  }
  if (!sets.length) throw new HttpError(400, "No editable fields supplied");

  const { rows } = await pool.query(
    `UPDATE shows SET ${sets.join(", ")}, updated_at=now() WHERE id=$1 RETURNING id, slug, name, archived, format`,
    values
  );
  if (!rows.length) throw new HttpError(404, "Show not found");

  // Leagues on this show cache its format (settings.showFormat) so the game logic can read it without
  // a database. Each is updated under its own lock rather than in one UPDATE, so a league write in
  // flight can't overwrite the change with the state it read before it.
  if ("format" in body) {
    const { rows: leagues } = await pool.query(
      "SELECT id FROM leagues WHERE state->'settings'->>'showId' = $1",
      [rows[0].slug]
    );
    for (const league of leagues) {
      await withLeagueLock(league.id, (s) => {
        s.settings.showFormat = rows[0].format;
      });
    }
  }
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
