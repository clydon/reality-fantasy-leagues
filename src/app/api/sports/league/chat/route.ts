import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { gifsFor } from "@/lib/server/gifs";
import { postRoom, readEarlierRoom, readLatest, readRoom } from "@/lib/server/league-chat";
import { roomOf } from "./scope";

// A league's room (docs/PLAN-sports-couch.md B1 session 5; league-chat.ts): `?league=football/nfl&couch=<id>`. GET reads the newest
// 300 (`&v=` answers { unchanged } for the open room's 5-second poll; `&before=<message>` the 100 before it on a tap; `&since=` once
// you've read back; either with `&at=` its time). POST { text | gif, event?, eventAt?, eventName? } posts, in a game's thread when
// `event` names one.
export const GET = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const scope = await roomOf(req, user);
  const q = new URL(req.url).searchParams;
  const at = q.get("at");
  if (q.has("before")) return NextResponse.json(await readEarlierRoom(scope, { before: q.get("before"), at }));
  // This week's line: the newest few, once.
  if (q.has("latest")) return NextResponse.json({ messages: await readLatest(scope) });
  const read = await readRoom(user, scope, { v: q.get("v"), since: q.get("since"), at });
  return NextResponse.json("messages" in read ? { ...read, gifs: !!gifsFor(req) } : read);
});

export const POST = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const scope = await roomOf(req, user);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json({ message: await postRoom(user, scope, body, gifsFor(req)) });
});
