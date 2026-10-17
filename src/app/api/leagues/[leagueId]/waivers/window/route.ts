import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { openWindow } from "@/lib/server/waivers";

// The commissioner's Open a waiver window (docs/PLAN-waivers-v2.md): body { swaps, replace? } -- how many
// castaways each player may swap, 0 up to the roster size ("All"), and whether those who are out can be
// replaced in it (left out: the league's rule decides) -- opens one now (or makes the week already open a
// window, or changes it); { swaps: null } turns it off. Only before the week processes.
// Claims that no longer fit are trimmed (waivers.js openWindow); telling their owners is phase 3's push.
// Works whatever the league's schedule, so any league can have a window when the commissioner wants.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  await requireLeagueRole(req, leagueId, "commissioner");
  const body = (await req.json().catch(() => ({}))) as { swaps?: unknown; replace?: unknown };
  if (body.swaps !== null && !Number.isInteger(body.swaps)) throw new HttpError(400, "swaps must be a whole number, or null to turn the window off");
  if (body.replace !== undefined && typeof body.replace !== "boolean") throw new HttpError(400, "replace must be true or false");
  const swaps = body.swaps as number | null;
  const replace = body.replace as boolean | undefined;

  const state = await withLeagueLock(leagueId, async (s, client) => {
    if (!StateLogic.WaiverLogic.supported(s)) throw new HttpError(400, "This league doesn't use waivers");
    const r = await openWindow(client, leagueId, s, swaps, undefined, { replace });
    if (r.error) throw new HttpError(/processed/.test(r.error) ? 409 : 400, r.error);
  });
  return NextResponse.json(state);
});
