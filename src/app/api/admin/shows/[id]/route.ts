import { NextResponse } from "next/server";
import { isPlayableFormat, resolveFormat } from "@db/show-formats.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin, isUuid } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { pushShowFormat } from "@/lib/server/show-formats";
import { cleanArtStyle } from "@/lib/show-art-style";

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
  // Which game rules the show plays by (db/migrations/0021): a built-in format, or an approved stored
  // one (0049). Leagues cache it, so a change is pushed into each of them below.
  format: "format",
  // Tile image (migration 0051); same free-text-URL convention as a castaway's Photo URL. Empty
  // clears it back to the per-format emoji fallback.
  artUrl: "art_url",
  // How the art looks behind Overview's header (migration 0056); null goes back to the default look.
  artStyle: "art_style",
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

  // The show as it stands: a cleared term goes back to its rules' default, and changing the rules
  // carries along any term still on the old rules' default (one an admin typed is left alone).
  const { rows: current } = await pool.query(`SELECT format, castaway_term, tribe_term FROM shows WHERE id=$1`, [id]);
  if (!current.length) throw new HttpError(404, "Show not found");
  const formatOk = await isPlayableFormat(pool, body.format);
  if ("format" in body && !formatOk) throw new HttpError(400, `"${String(body.format)}" isn't a show format`);
  const nextFormat = formatOk ? (body.format as string) : current[0].format;
  const nextTerms = (await resolveFormat(pool, nextFormat)).terms;
  if (nextFormat !== current[0].format) {
    const was = (await resolveFormat(pool, current[0].format)).terms;
    const now = nextTerms;
    if (!("castawayTerm" in body) && current[0].castaway_term === was.castaway) body.castawayTerm = now.castaway;
    if (!("tribeTerm" in body) && current[0].tribe_term === was.tribe) body.tribeTerm = now.tribe;
  }

  const sets: string[] = [];
  const values: unknown[] = [id];
  for (const [key, column] of Object.entries(EDITABLE)) {
    if (!(key in body)) continue;
    let value = body[key];
    if (key === "archived") value = !!value;
    else if (key === "researchDomains") value = parseDomains(value);
    else if (key === "artStyle") value = cleanArtStyle(value);
    else if (typeof value === "string") value = value.trim() || null;
    // Terminology has a sensible default rather than being nullable -- an empty term would render as
    // a blank word in the UI. The default is the show's rules' own (Castaway, Challenger…).
    if ((key === "castawayTerm" || key === "tribeTerm") && !value) {
      value = key === "castawayTerm" ? nextTerms.castaway : nextTerms.tribe;
    }
    if (key === "name" && !value) throw new HttpError(400, "name can't be empty");
    values.push(value);
    // The desk's framing (art_style.frame, part 7b) isn't classic's to edit: it stays.
    if (key === "artStyle") sets.push(`art_style = NULLIF(COALESCE($${values.length}::jsonb, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object('frame', art_style->'frame')), '{}'::jsonb)`);
    else sets.push(`${column}=$${values.length}`);
  }
  if (!sets.length) throw new HttpError(400, "No editable fields supplied");
  // A pasted art URL is the admin's choice: the art finder (src/lib/server/show-art.ts) leaves it alone. Cleared, it finds again.
  // It's the show's own poster, not the desk's link over every season's (shows.art_link, part 7b).
  if ("artUrl" in body) sets.push(`art_by_hand = ${typeof body.artUrl === "string" && body.artUrl.trim() ? "true" : "false"}`, "art_link = false");

  const { rows } = await pool.query(
    `UPDATE shows SET ${sets.join(", ")}, updated_at=now() WHERE id=$1 RETURNING id, slug, name, archived, format`,
    values
  );
  if (!rows.length) throw new HttpError(404, "Show not found");

  // Leagues on this show cache its format (settings.showFormat, plus a stored format's data) so the
  // game logic can read it without a database.
  if ("format" in body) await pushShowFormat(rows[0].slug);
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
