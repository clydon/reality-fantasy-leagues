import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireDesk } from "@/lib/server/desk";
import { artChoices } from "@/lib/server/show-art";

// Choose art's choices (docs/RESEARCH-show-art-and-cast-photos.md): the show's TMDB posters and header images, and with
// ?season= that season's posters. Asked when the sheet opens; choosing goes through POST /api/desk/shows/[id].
export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  await requireDesk(req);
  const season = new URL(req.url).searchParams.get("season");
  return NextResponse.json(await artChoices((await params).id, season));
});
