import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { classicArtStyle } from "@/lib/art-frame";
import { pool } from "@/lib/server/db";

// The art an admin chose for the curated shows (shows.art_url and art_style), for the front door's
// show roll (show-roll.tsx), which fades each show's art in behind its name. Deliberately public --
// no requireAuth -- since the front door is the signed-out screen. Only curated, unarchived shows with
// art, and only their name and look: nothing a visitor couldn't see once signed in.
export const GET = apiRoute(async () => {
  const { rows } = await pool.query(
    `SELECT name, art_url AS "artUrl", art_style AS "artStyle"
       FROM shows
      WHERE archived = false AND created_by IS NULL AND COALESCE(art_url, '') <> ''
      ORDER BY name`
  );
  // A framing the desk set on another image (a season's poster) isn't this one's (art-frame.ts).
  for (const r of rows) r.artStyle = classicArtStyle(r.artStyle, r.artUrl);
  return NextResponse.json({ shows: rows }, { headers: { "Cache-Control": "public, max-age=300" } });
});
