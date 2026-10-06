import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { deleteFormat, getFormat, saveProposal } from "@db/show-formats.js";
import { pushShowFormat } from "@/lib/server/show-formats";
import type { Proposal } from "@/lib/game/formats/proposal";

type RouteParams = { id: string };

export const GET = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { id } = await params;
  await requireSuperAdmin(req);
  const format = await getFormat(pool, id);
  if (!format) throw new HttpError(404, "Format not found");
  return NextResponse.json({ format });
});

// Saves the review screen's edited rows. A draft just saves. An approved format must stay approvable;
// its new data is pushed into every league on a show that uses it, which rescores their past episodes
// (scoring is recomputed from stored facts on every read).
export const PATCH = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { id } = await params;
  const user = await requireSuperAdmin(req);
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

// A draft, or an approved format no show plays by.
export const DELETE = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { id } = await params;
  await requireSuperAdmin(req);
  const r = await deleteFormat(pool, id);
  if (r.notFound) throw new HttpError(404, "Format not found");
  if (r.inUse) throw new HttpError(409, `Still the rules for ${r.inUse.length} show${r.inUse.length === 1 ? "" : "s"} (${r.inUse.join(", ")}). Switch them first.`);
  return NextResponse.json({ ok: true });
});
