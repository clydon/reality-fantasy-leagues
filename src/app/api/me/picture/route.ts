import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuthSession } from "@/lib/server/auth-helpers";
import { PICTURE_MAX, removePicture, savePicture } from "@/lib/server/profile";
import { HttpError } from "@/lib/server/db";

// Your picture (docs/PLAN-new-design.md step 15 part 1): the image itself as the body, made 256 by 256 in the browser. Answers
// its version, which every face's link carries (GET /api/people/[id]/picture?v=).
export const PUT = apiRoute(async (req) => {
  const session = await requireAuthSession(req);
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > PICTURE_MAX) throw new HttpError(413, "That picture is too big. Try another.");
  const picture = await savePicture(session, req.headers.get("content-type"), await req.arrayBuffer());
  return NextResponse.json({ picture });
});

export const DELETE = apiRoute(async (req) => {
  const session = await requireAuthSession(req);
  await removePicture(session);
  return NextResponse.json({ picture: null });
});
