import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuthSession } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { readPhones, signOutOthers, turnOffPhone } from "@/lib/server/phones";

// Your phones (settings Round 1, A3; phones.ts): GET ?here=<this phone's push endpoint> lists the phones that get your
// notifications and the places you're signed in; DELETE { id } turns one phone's notifications off; POST { signOutOthers: true,
// here } signs you out everywhere else and stops the other phones' notifications.
export const GET = apiRoute(async (req) => {
  const session = await requireAuthSession(req);
  return NextResponse.json(await readPhones(session, new URL(req.url).searchParams.get("here")));
});

export const DELETE = apiRoute(async (req) => {
  const session = await requireAuthSession(req);
  const { id } = (await req.json().catch(() => ({}))) as { id?: unknown };
  await turnOffPhone(session, id);
  return NextResponse.json({ ok: true });
});

export const POST = apiRoute(async (req) => {
  const session = await requireAuthSession(req);
  const body = (await req.json().catch(() => ({}))) as { signOutOthers?: unknown; here?: unknown };
  if (body.signOutOthers !== true) throw new HttpError(400, "signOutOthers: true");
  return NextResponse.json({ signedOut: await signOutOthers(session, body.here) });
});
