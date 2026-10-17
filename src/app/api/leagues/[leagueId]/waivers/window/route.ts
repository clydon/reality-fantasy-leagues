import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { openWindow } from "@/lib/server/waivers";
import { windowSnapshot, type WindowSnapshot } from "@/lib/server/waiver-pushes";
import { notifyWaiverWindow } from "@/lib/server/push-events";

// The commissioner's Open a waiver window (docs/PLAN-waivers-v2.md): body { swaps, replace? } -- how many
// castaways each player may swap, 0 up to the roster size ("All"), and whether those who are out can be
// replaced in it (left out: the league's rule decides) -- opens one now (or makes the week already open a
// window, or changes it); { swaps: null } turns it off. Only before the week processes.
// Claims that no longer fit are trimmed (waivers.js openWindow). Afterwards the rotation hears "Waiver
// window open" (or that it's off), and anyone trimmed hears that instead (push-events notifyWaiverWindow).
// Works whatever the league's schedule, so any league can have a window when the commissioner wants.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "commissioner");
  const body = (await req.json().catch(() => ({}))) as { swaps?: unknown; replace?: unknown };
  if (body.swaps !== null && !Number.isInteger(body.swaps)) throw new HttpError(400, "swaps must be a whole number, or null to turn the window off");
  if (body.replace !== undefined && typeof body.replace !== "boolean") throw new HttpError(400, "replace must be true or false");
  const swaps = body.swaps as number | null;
  const replace = body.replace as boolean | undefined;

  // What the push needs, set inside the lock: the window before the change, and what the change did.
  const done: { before: WindowSnapshot | null; periodId?: string; trimmed: string[] } = { before: null, trimmed: [] };
  const state = await withLeagueLock(leagueId, async (s, client) => {
    if (!StateLogic.WaiverLogic.supported(s)) throw new HttpError(400, "This league doesn't use waivers");
    done.before = windowSnapshot(s);
    const r = await openWindow(client, leagueId, s, swaps, undefined, { replace });
    if (r.error !== undefined) throw new HttpError(/processed/.test(r.error) ? 409 : 400, r.error);
    done.periodId = r.period.id;
    done.trimmed = r.trimmed;
  });
  if (done.periodId) notifyWaiverWindow(leagueId, state, done.before, done.periodId, done.trimmed, user.id);
  return NextResponse.json(state);
});
