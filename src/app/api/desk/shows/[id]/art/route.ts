import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireDesk } from "@/lib/server/desk";
import { artChoices, withTmdbFor } from "@/lib/server/show-art";

// Choose art's choices (docs/RESEARCH-show-art-and-cast-photos.md): the show's TMDB posters and header images, and with
// ?season= that season's posters. Asked when the sheet opens; choosing goes through POST /api/desk/shows/[id]. A dev server's
// TMDB stand-in comes from the x-gys-tmdb header (show-art.ts withTmdbFor).
export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  await requireDesk(req);
  const season = new URL(req.url).searchParams.get("season");
  const { id } = await params;
  return NextResponse.json(await withTmdbFor(req, () => artChoices(id, season)));
});
