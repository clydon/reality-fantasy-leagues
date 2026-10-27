import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin } from "@/lib/server/auth-helpers";
import { adminBingoBank, adminFlagSquare, saveBingoBank } from "@/lib/server/bingo-bank";

// Bingo's bank by hand (docs/PLAN-bingo-bank.md step 1; src/lib/server/bingo-bank.ts), for the admin episode page:
//   GET   ?episode=&scope=episode|season   the episode's bank, the season's own, which its cards deal from, and the prompt
//   POST  { episode, scope, answer }       a chat's answer filed as that bank (replacing it); 400 when fewer than 8 squares pass
//         { episode, flag, on }            Hide a square (an admin's flag: out of new cards at once), or not
type Params = { params: Promise<{ id: string }> };

export const GET = apiRoute(async (req, { params }: Params) => {
  const { id } = await params;
  const admin = await requireSuperAdmin(req);
  const search = new URL(req.url).searchParams;
  return NextResponse.json(await adminBingoBank(id, search.get("episode"), search.get("scope") ?? "episode", new Date(), admin.id));
});

export const POST = apiRoute(async (req, { params }: Params) => {
  const { id } = await params;
  const admin = await requireSuperAdmin(req);
  const body = (await req.json().catch(() => ({}))) as { episode?: unknown; scope?: unknown; answer?: unknown; flag?: unknown; on?: unknown };
  if (body.flag !== undefined) return NextResponse.json(await adminFlagSquare(id, admin.id, body));
  return NextResponse.json(await saveBingoBank(id, body, new Date(), admin.id));
});
