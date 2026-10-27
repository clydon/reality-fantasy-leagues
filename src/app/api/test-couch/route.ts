import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { botFor } from "@/lib/server/ask-bot";
import { isImpersonating, requireSession } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/db";
import { copyAgain, makeTestCouch, removeTestCouch, setTestRules, tester, testCouchOf } from "@/lib/server/test-couch";

// A super admin's test couch (src/lib/server/test-couch.ts). GET: it, its test players (the profile menu's switches) and
// where one can be made from; null when someone else is being viewed as (not a test player). Changing it needs the admin
// as themselves: POST makes one { couchId, seasonId, rules? }; PATCH { copy: true } copies the real games' moves again,
// { rules } changes what its games play by (researched asks our bot after the answer); DELETE removes it.
export const maxDuration = 300;

export const GET = apiRoute(async (req) => {
  const session = await requireSession(req);
  try {
    const t = await tester(session);
    return NextResponse.json(await testCouchOf(t.adminId, t.viewingAs));
  } catch (e) {
    if (e instanceof HttpError && e.status === 403 && isImpersonating(session)) return NextResponse.json(null);
    throw e;
  }
});

async function respond(adminId: string) {
  return NextResponse.json(await testCouchOf(adminId, null));
}

export const POST = apiRoute(async (req) => {
  const { adminId } = await tester(await requireSession(req), { asSelf: true });
  await makeTestCouch(adminId, await req.json().catch(() => ({})), { bot: botFor(req) });
  return respond(adminId);
});

export const PATCH = apiRoute(async (req) => {
  const { adminId } = await tester(await requireSession(req), { asSelf: true });
  const body = (await req.json().catch(() => ({}))) as { copy?: unknown; rules?: unknown };
  if (body.copy === true) await copyAgain(adminId);
  else if (body.rules !== undefined) await setTestRules(adminId, body.rules, { bot: botFor(req) });
  else throw new HttpError(400, "Send { copy: true } or { rules }");
  return respond(adminId);
});

export const DELETE = apiRoute(async (req) => {
  const { adminId } = await tester(await requireSession(req), { asSelf: true });
  await removeTestCouch(adminId);
  return respond(adminId);
});
