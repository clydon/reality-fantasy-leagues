import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth, requireLeagueRole, isUuid } from "@/lib/server/auth-helpers";
import { HttpError, pool } from "@/lib/server/db";
import { requireCouch } from "@/lib/server/couches";
import {
  expireTurn,
  lockBlindFor,
  nudgeDraft,
  pickInDraft,
  saveQueue,
  setDraftOrder,
  setDraftSettings,
  startDraft,
  undoLastPick,
  unlockBlindFor,
} from "@/lib/server/draft";
import { leagueState } from "@/lib/server/league-states";
import { seasonDraft } from "@/lib/server/season-draft";
import { games } from "@/lib/server/show-space";

// The drafts on a show (docs/PLAN-new-design.md step 7): the draft room and the blind draft. GET: with `?couch=` that
// couch's games here that you play, else all of yours; each game's draft as you may see it (season-draft.ts). Polled
// while the room is open: `?v=` is the version you have, and an unchanged draft answers { unchanged, v }.
// POST { leagueId, action, ... }: a pick, a lock-in, your queue, and whoever runs the game's Start, Nudge, order and
// settings, all through draft.ts (the rules classic's league routes share). Answers { ok, batch? } (batch: the line in
// Recent changes, for the toast's Undo) and never the league itself (it holds results you may not have revealed).

async function season(seasonId: string) {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const { rows } = await pool.query("SELECT 1 FROM show_seasons WHERE id = $1", [seasonId]);
  if (!rows.length) throw new HttpError(404, "Season not found");
}

export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  await season(seasonId);
  const url = new URL(req.url);
  const couchId = url.searchParams.get("couch");
  if (couchId) await requireCouch(user, couchId);
  const out = await seasonDraft(user, seasonId, couchId);
  if (url.searchParams.get("v") === out.v) return NextResponse.json({ unchanged: true, v: out.v });
  return NextResponse.json(out);
});

type Body = {
  leagueId?: unknown;
  action?: unknown;
  castawayId?: unknown;
  n?: unknown;
  playerId?: unknown;
  castawayIds?: unknown;
  order?: unknown;
  timer?: unknown;
  away?: unknown;
  scheduledAt?: unknown;
};

export const POST = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  await season(seasonId);
  const body = (await req.json().catch(() => ({}))) as Body;
  const leagueId = typeof body.leagueId === "string" ? body.leagueId : "";
  // A game of yours on this show (the same membership check classic's league routes make).
  const actor = await requireLeagueRole(req, leagueId, "member");
  const mine = await games(user.id, { mine: true, seasonId });
  if (!mine.some((g) => g.leagueId === leagueId)) throw new HttpError(404, "That game isn't on this show");
  const n = typeof body.n === "number" ? body.n : null;

  switch (body.action) {
    case "pick": {
      if (typeof body.castawayId !== "string") throw new HttpError(400, "castawayId required");
      const { batch } = await pickInDraft(actor, leagueId, body.castawayId, n);
      return NextResponse.json({ ok: true, batch });
    }
    case "lock":
      await lockBlindFor(actor, leagueId, body.playerId ?? actor.membership.playerId, body.castawayIds);
      return NextResponse.json({ ok: true });
    case "unlock":
      await unlockBlindFor(actor, leagueId, typeof body.playerId === "string" ? body.playerId : (actor.membership.playerId ?? ""));
      return NextResponse.json({ ok: true });
    case "queue": {
      const state = await leagueState(leagueId);
      if (!state) throw new HttpError(404, "League not found");
      return NextResponse.json({ ok: true, queue: await saveQueue(actor, leagueId, state, body.castawayIds) });
    }
    case "start":
      await startDraft(actor, leagueId);
      return NextResponse.json({ ok: true });
    case "order":
      await setDraftOrder(actor, leagueId, body.order);
      return NextResponse.json({ ok: true });
    case "settings": {
      const { batch } = await setDraftSettings(actor, leagueId, { timer: body.timer, away: body.away, scheduledAt: body.scheduledAt });
      return NextResponse.json({ ok: true, batch });
    }
    case "undoLast":
      await undoLastPick(actor, leagueId);
      return NextResponse.json({ ok: true });
    case "nudge":
      return NextResponse.json({ ok: true, ...(await nudgeDraft(actor, leagueId, n)) });
    case "expire":
      return NextResponse.json({ ok: true, ...(await expireTurn(leagueId, n)) });
    default:
      throw new HttpError(400, "Unknown action");
  }
});
