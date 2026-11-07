import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { leagueState } from "@/lib/server/league-states";
import { readyLeague } from "@/lib/server/league-read";
import { EVERYTHING } from "@/lib/server/guard";
import { seatMark } from "@/lib/server/seat-mark";
import { chooseTwist, openEpisode, readTwists } from "@/lib/server/twists";
import type { LeagueState } from "@/lib/game/types";

// The top scorer's twist (docs/PLAN-start-a-game-gpt.md step A14 part 5, twists.ts). No screen yet (U1's); the engine's API.
//
// GET (a member): { twist: { of, who, by, tie, closes, fallback } (the game's rules, as its spec says them: public), seat (yours, or
// null), next: null, or { episode, closesAt (ISO, or null when its air time isn't known: it closes when the episode locks), youChoose,
// choice (yours so far, or null) } for the episode being chosen for now, once you've seen the episode before it (who chooses is who
// scored most in it), played: [{ episode, twist (its id, or null: none), name, by: { playerId, name } | null, how }] for each filed
// episode you've seen the one before }. Spoiler-trimmed as the roles route is (the season's mark, or a late joiner's own week).
// POST { twist } (a member): your choice of the open episode's twist, while you're its chooser (by the data now) and it's open;
// change it as often as you like until it closes. 409 for a game with no twist, nothing open, or a seat that doesn't choose it.

const named = (state: LeagueState, id: string | null) => (id ? { playerId: id, name: (state.players ?? []).find((p) => p.id === id)?.name ?? "" } : null);

async function ready(req: Request, leagueId: string) {
  const { user, membership } = await requireLeagueRole(req, leagueId, "member");
  const raw = await leagueState(leagueId);
  if (!raw) throw new HttpError(404, "League not found");
  const state = await readyLeague(leagueId, raw);
  const cfg = StateLogic.TwistLogic.of(state);
  if (!cfg) throw new HttpError(409, "This game has no twist");
  const seat = membership.playerId ?? null;
  return { state, cfg, seat, mark: await seatMark(user.id, leagueId, state, seat) };
}

export const GET = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { state, cfg, seat, mark } = await ready(req, leagueId);
  const T = StateLogic.TwistLogic;
  const rows = await readTwists(pool, leagueId);
  const seen = (n: number) => mark === EVERYTHING || mark >= n;
  const n = openEpisode(state, rows);
  let next = null;
  if (n !== null && seen(n - 1)) {
    const who = T.chooserAt(state, n);
    const youChoose = !!seat && who.playerId === seat;
    const mine = rows.get(n);
    const at = T.closesAt(state, n);
    next = { episode: n, closesAt: at === null ? null : new Date(at).toISOString(), youChoose, choice: youChoose && mine && mine.playerId === seat ? mine.twist : null };
  }
  const played = state.episodes
    .filter((ep) => ep.twist && seen(ep.number - 1))
    .sort((a, b) => a.number - b.number)
    .map((ep) => ({ episode: ep.number, twist: ep.twist!.id, name: cfg.of.find((x) => x.id === ep.twist!.id)?.name ?? null, by: named(state, ep.twist!.by), how: ep.twist!.how }));
  return NextResponse.json({ twist: cfg, seat, next, played });
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const body = await req.json().catch(() => ({}));
  const twistId = typeof body?.twist === "string" ? body.twist : "";
  const { state, seat, mark } = await ready(req, leagueId);
  if (!seat) throw new HttpError(403, "You don't have a seat in this game");
  const rows = await readTwists(pool, leagueId);
  const n = openEpisode(state, rows);
  if (n !== null && mark !== EVERYTHING && mark < n - 1) throw new HttpError(409, `Watch Episode ${n - 1}'s results first: they say who chooses`);
  const r = await chooseTwist(pool, leagueId, state, seat, twistId, rows);
  if ("error" in r) throw new HttpError(r.status, r.error);
  return NextResponse.json({ ok: true, episode: r.episode, twist: twistId });
});
