import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { yourTeamPictures } from "@/lib/server/couch-pictures";

// Your team pictures (docs/PLAN-team-logos.md L4): each team's key to its picture's link, from the couches you're on. Read once a
// session by the phone (src/new/ui/team-pictures.ts), which shows them in place of our badge. Usually {}: a few bytes.
export const GET = apiRoute(async (req) => {
  const viewer = await requireAuth(req);
  return NextResponse.json({ pictures: await yourTeamPictures(viewer.id) }, { headers: { "Cache-Control": "private, no-store" } });
});
