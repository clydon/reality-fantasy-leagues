import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { backstageScope } from "@/lib/server/backstage";
import { gameSettings, settingsWrite } from "@/lib/server/backstage-games";

// Backstage › Game settings (docs/PLAN-new-design.md step 6a): each game's lineup size, who can join and its waivers' line,
// with what's recommended. PATCH `{ leagueId, set }` or `{ leagueId, reset: "lineup" | "team" | "joining" }` (a
// Commissioner's): one batch in Recent changes with Undo.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const scope = await backstageScope(user, seasonId, new URL(req.url).searchParams.get("couch"));
  return NextResponse.json(await gameSettings(scope));
});

export const PATCH = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const scope = await backstageScope(user, seasonId, new URL(req.url).searchParams.get("couch"));
  const body = (await req.json().catch(() => ({}))) as { leagueId?: unknown; set?: Record<string, unknown>; reset?: "lineup" | "team" | "joining"; text?: string };
  return NextResponse.json(await settingsWrite(scope, body.leagueId, body));
});
