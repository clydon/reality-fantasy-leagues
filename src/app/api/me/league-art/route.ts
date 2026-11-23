import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth, requireAuthSession } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { LEAGUE_PICTURE_MAX, readLeagueArt, removeLeaguePicture, saveLeaguePicture, setLeagueArt } from "@/lib/server/league-art";

// A league's art for you (docs/design-round/league-art-spec.md; src/lib/server/league-art.ts). Every answer is the state as it now
// is: your choices, your pictures, and the couch's art for ?couch= (a couch you're on: the hub's).
//   GET                                   the state
//   PUT { league, art }                   your choice for a league: an art's id, "upload" (your picture), or null (none: the couch's)
//   PUT ?league= with a picture as body   your picture for that league (image/jpeg, png or webp, made 1280 by 720 in the browser);
//                                         it becomes your choice there
//   DELETE ?league=                       your picture for that league taken away (and your choice of it)

const couchOf = (req: Request) => {
  const id = new URL(req.url).searchParams.get("couch");
  return id && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
};

export const GET = apiRoute(async (req) => {
  const user = await requireAuth(req);
  return NextResponse.json(await readLeagueArt(user, couchOf(req)), { headers: { "Cache-Control": "private, no-store" } });
});

export const PUT = apiRoute(async (req) => {
  const session = await requireAuthSession(req);
  const type = (req.headers.get("content-type") ?? "").split(";")[0].trim();
  if (type.startsWith("image/")) {
    if (Number(req.headers.get("content-length") ?? 0) > LEAGUE_PICTURE_MAX) throw new HttpError(413, "That picture is too big. Try another.");
    await saveLeaguePicture(session, new URL(req.url).searchParams.get("league"), await req.arrayBuffer());
  } else {
    const body = (await req.json().catch(() => null)) as { league?: unknown; art?: unknown } | null;
    if (!body || !("art" in body)) throw new HttpError(400, "{ league, art }");
    await setLeagueArt(session, body.league, body.art);
  }
  return NextResponse.json(await readLeagueArt(session.user, couchOf(req)));
});

export const DELETE = apiRoute(async (req) => {
  const session = await requireAuthSession(req);
  await removeLeaguePicture(session, new URL(req.url).searchParams.get("league"));
  return NextResponse.json(await readLeagueArt(session.user, couchOf(req)));
});
