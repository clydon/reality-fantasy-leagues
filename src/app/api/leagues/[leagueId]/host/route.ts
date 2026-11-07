import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import * as Spec from "@/lib/game/game-spec/index.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { leagueState } from "@/lib/server/league-states";
import { readyLeague } from "@/lib/server/league-read";
import { openEpisode, readHostCards, writeHostCard } from "@/lib/server/host-cards";
import type { LeagueState } from "@/lib/game/types";

// A rotating host's questions (docs/PLAN-start-a-game-gpt.md step A14 part 6, host-cards.ts). No screen yet (U1's); the engine's API.
//
// GET (a member): { card: { each, of: [{ id, label }], fallback, closes, hostAnswers } (the game's rules, as its spec says them:
// public), seat (yours, or null), next: null, or { episode, closesAt (ISO, or null when its air time isn't known: the host has until
// it locks), host: { playerId, name }, youHost, lines (yours so far, in order, only while you host it) } for the episode being chosen
// now, turn: [{ playerId, name }] who hosts after it, in order, each seat once (as the seats stand now: someone leaving or joining
// moves it; after the last filed episode's host while nothing's open: the next episode's card opens once the league has it, with the
// episode before's results), played: [{ episode, host, how, lines (the card as it plays: the moments' ids) }] for each filed episode }. Nothing in it
// is a spoiler: who hosts goes by the league's seats, never by results, and a card is out before its episode airs.
// POST { moments: [ids] } (a member): your lines for the open episode's card, in order (up to the card's lines; none takes them
// back), while you host it and your time isn't up; change them as often as you like until then. They stay yours alone until then.

const named = (state: LeagueState, id: string | null | undefined) => (id ? { playerId: id, name: (state.players ?? []).find((p) => p.id === id)?.name ?? "" } : null);

async function ready(req: Request, leagueId: string) {
  const { membership } = await requireLeagueRole(req, leagueId, "member");
  const raw = await leagueState(leagueId);
  if (!raw) throw new HttpError(404, "League not found");
  const state = await readyLeague(leagueId, raw);
  const cfg = StateLogic.HostLogic.of(state);
  if (!cfg) throw new HttpError(409, "This game has no host");
  return { state, cfg, seat: membership.playerId ?? null };
}

export const GET = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { state, cfg, seat } = await ready(req, leagueId);
  const H = StateLogic.HostLogic;
  const rows = await readHostCards(pool, leagueId);
  const n = openEpisode(state, rows);
  const events = StateLogic.formatOf(state).events;
  const label = (id: string) => (events.find((e: { id: string }) => e.id === id)?.label ?? id).replace(/\.\s*$/, "");
  let next = null;
  if (n !== null) {
    const host = H.hostAt(state, n);
    const youHost = !!seat && host === seat;
    const mine = rows.get(n);
    const at = H.closesAt(state, n);
    next = { episode: n, closesAt: at === null ? null : new Date(at).toISOString(), host: named(state, host), youHost, lines: youHost && mine && mine.playerId === seat ? mine.moments : [] };
  }
  const last = [...H.episodes(state)].reverse().find((k) => state.episodes.find((e) => e.number === k)?.cardChoice);
  const turn = (n !== null ? H.after(state, n) : last !== undefined ? H.after(state, last) : H.turn(state, null)).map((id) => named(state, id));
  const played = state.episodes
    .filter((ep) => ep.cardChoice && ep.cardChoice.how)
    .sort((a, b) => a.number - b.number)
    .map((ep) => ({ episode: ep.number, host: named(state, ep.cardChoice!.host), how: ep.cardChoice!.how, lines: Spec.cardLines(cfg, ep.number, ep.cardChoice) ?? [] }));
  return NextResponse.json({
    card: { each: cfg.each, of: cfg.of.map((id) => ({ id, label: label(id) })), fallback: cfg.fallback, closes: cfg.closes, hostAnswers: cfg.hostAnswers },
    seat,
    next,
    turn,
    played,
  });
});

export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const body = await req.json().catch(() => ({}));
  const { state, seat } = await ready(req, leagueId);
  if (!seat) throw new HttpError(403, "You don't have a seat in this game");
  const r = await writeHostCard(pool, leagueId, state, seat, body?.moments);
  if ("error" in r) throw new HttpError(r.status, r.error);
  return NextResponse.json({ ok: true, episode: r.episode, moments: r.moments });
});
