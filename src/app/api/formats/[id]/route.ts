import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { deleteFormat, getFormat, saveProposal } from "@db/show-formats.js";
import { pushShowFormat } from "@/lib/server/show-formats";
import type { Proposal } from "@/lib/game/formats/proposal";

type RouteParams = { id: string };

// Ownership check shared by every verb below: a format's creator (not necessarily an admin) is the
// only one who may read or change their own draft/approved format through this self-serve route
// (classic admin's own format routes retired at docs/PLAN-desk-parity.md step 8; rulebooks replace formats).
async function requireOwnFormat(id: string, userId: string) {
  const format = await getFormat(pool, id);
  if (!format) throw new HttpError(404, "Format not found");
  if (format.createdBy !== userId) throw new HttpError(403, "Not yours");
  return format;
}

export const GET = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { id } = await params;
  const user = await requireAuth(req);
  const format = await requireOwnFormat(id, user.id);
  return NextResponse.json({ format });
});

// Same shape as the admin PATCH: a draft just saves, an approved format must stay approvable, and its
// new data is pushed into every league on a show using it (only the owner's own shows, by
// construction -- nobody else can point a show at a format they don't own).
export const PATCH = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { id } = await params;
  const user = await requireAuth(req);
  await requireOwnFormat(id, user.id);
  const body = (await req.json().catch(() => ({}))) as { proposal?: unknown };
  if (!body.proposal || typeof body.proposal !== "object" || Array.isArray(body.proposal)) throw new HttpError(400, "proposal required");
  const saved = await saveProposal(pool, id, body.proposal as Proposal, user.id);
  if (!saved) throw new HttpError(404, "Format not found");
  if (saved.refused) {
    return NextResponse.json({ format: saved, error: "An approved format has to stay valid: fix the problems listed and save again." }, { status: 409 });
  }
  let leaguesUpdated = 0;
  for (const slug of saved.leagueSlugs || []) leaguesUpdated += await pushShowFormat(slug);
  return NextResponse.json({ format: saved, leaguesUpdated });
});

export const DELETE = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { id } = await params;
  const user = await requireAuth(req);
  await requireOwnFormat(id, user.id);
  const r = await deleteFormat(pool, id);
  if (r.notFound) throw new HttpError(404, "Format not found");
  if (r.inUse) throw new HttpError(409, `Still the rules for ${r.inUse.length} show${r.inUse.length === 1 ? "" : "s"} (${r.inUse.join(", ")}). Switch them first.`);
  return NextResponse.json({ ok: true });
});
