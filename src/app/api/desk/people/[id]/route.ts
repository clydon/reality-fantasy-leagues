import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { HttpError } from "@/lib/server/db";
import { requireDesk } from "@/lib/server/desk";
import { deskPerson } from "@/lib/server/desk-people";
import { FieldError, letBackIn, letIn, resetPassword, saveAccount, stopSigningIn } from "@/lib/server/desk-person-actions";

// A person on the desk (docs/PLAN-desk-parity.md step 1): GET who they are, their couches and games, their History.
// POST one of their actions (part 1b), each a History line: `{ letIn: true }`; `{ signIn: false, why? }` (stop them) or
// `{ signIn: true }` (let them back); `{ name?, email? }` (a problem with one field answers `{ error, field }`);
// `{ password: "reset" }` (answers the temporary password, once). Each answers `{ changeId }` for the toast's Undo.
// Act as them is its own route (./act), since it swaps the session.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireDesk(req);
  return NextResponse.json(await deskPerson(user, (await params).id));
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireDesk(req);
  const { id } = await params;
  const raw: unknown = await req.json().catch(() => null);
  const body = (raw && typeof raw === "object" ? raw : {}) as { letIn?: unknown; signIn?: unknown; why?: unknown; name?: unknown; email?: unknown; password?: unknown };
  if (body.letIn === true) return NextResponse.json(await letIn(user, id));
  if (body.signIn === false) return NextResponse.json(await stopSigningIn(user, id, body.why));
  if (body.signIn === true) return NextResponse.json(await letBackIn(user, id));
  if (body.password === "reset") return NextResponse.json(await resetPassword(user, id));
  if ("name" in body || "email" in body) {
    try {
      return NextResponse.json(await saveAccount(user, id, body));
    } catch (e) {
      if (e instanceof FieldError) return NextResponse.json({ error: e.message, field: e.field }, { status: e.status });
      throw e;
    }
  }
  throw new HttpError(400, "letIn, signIn, name or email, or password");
});
