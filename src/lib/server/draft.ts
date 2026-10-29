import crypto from "crypto";
import StateLogic from "@/lib/game/state-logic.js";
import { draftClock, draftKind, draftTimer } from "@/lib/game/draft-view";
import type { LeagueState } from "@/lib/game/types";
import type { LeagueMembership, SessionUser } from "./auth-helpers";
import { lockAuctionBids, unlockAuctionBids, type Bid } from "./auction";
import { lockBlindPicks, unlockBlindPicks } from "./blind-draft";
import { plainChange, settingsSetChange, type ChangeSpec } from "./change-log";
import { pool, withLeagueLock, HttpError } from "./db";
import { refused } from "./game-writes";
import { notifyDraftNudge, notifyDraftTurn } from "./push-events";
import { roleAtLeast } from "./roles";

// The draft's writes (docs/PLAN-new-design.md step 7), for both designs: classic's league routes (/draft/pick,
// /draft/blind/lock, /draft/force-start) and the new design's /api/seasons/[id]/draft call these, so the rules live once.
//
// Casual first (the mock's draft.js): no timer unless the Commissioner sets one, nobody picked for automatically unless
// the game says "pick from their queue" when it runs out, and whoever runs the game (a Commissioner or a Game admin) can
// always pick for someone: helping a friend over the phone. A pick or a lock-in made for someone else is a line in Recent
// changes (change-log.ts); a pick made for someone can be undone while it's still the draft's last. A player's own pick
// is theirs (tier 0) and isn't logged. The draft's settings (its order, its start, its timer) are a Commissioner's.

export interface DraftActor {
  user: SessionUser;
  membership: LeagueMembership;
}

const runs = (a: DraftActor) => roleAtLeast(a.membership.role, "admin");
const first = (name: string | undefined) => (name ?? "someone").split(" ")[0];
const nameOf = (s: LeagueState, playerId: string) => s.players.find((p) => p.id === playerId)?.name ?? "someone";
const castName = (s: LeagueState, id: string) => first(s.castaways.find((c) => c.id === id)?.name);

function requireCommissioner(a: DraftActor) {
  if (a.membership.role !== "commissioner") throw new HttpError(403, "Only a Commissioner changes the draft's settings");
}

function requireSnake(s: LeagueState) {
  if (draftKind(s) !== "snake") throw new HttpError(400, "This game doesn't have a turn-based draft");
}

/**
 * A pick for whoever's on the clock: your own, or anyone's when you run the game. `n`: the pick it was meant for, so a
 * tap that lands after someone else picked is refused rather than spent on the next turn. Answers the league and, for a
 * pick made for someone, its line's batch (the toast's Undo).
 */
export async function pickInDraft(a: DraftActor, leagueId: string, castawayId: string, n?: number | null): Promise<{ state: LeagueState; batch: string | null }> {
  const batch = crypto.randomUUID();
  let forOther = false;
  const state = await withLeagueLock(
    leagueId,
    (s) => {
      if (!StateLogic.isDraftStarted(s)) throw new HttpError(400, "Draft hasn't started yet");
      const turn = StateLogic.currentDraftTurn(s);
      if (!turn || turn.isComplete || !turn.playerId) throw new HttpError(400, "Draft is not active");
      if (n != null && turn.overallPickNumber !== n) throw new HttpError(409, "That pick was just made: have another look");
      forOther = turn.playerId !== a.membership.playerId;
      if (forOther && !runs(a)) throw new HttpError(403, "It's not your turn");
      // A draft spread across the cast's groups (step A10 part 3): a pick that doesn't keep the team spread, and why.
      const spread = StateLogic.SpreadLogic.pickProblem(s, turn.playerId, castawayId);
      if (spread) throw new HttpError(400, spread);
      // A salary cap (step A10 part 3b): a pick that takes the team past it, and why.
      const cap = StateLogic.BudgetLogic.pickProblem(s, turn.playerId, castawayId);
      if (cap) throw new HttpError(400, cap);
      const made = s.draftPicksMade;
      StateLogic.draftToCurrentTurn(s, castawayId, forOther ? { by: a.user.id } : undefined);
      if (s.draftPicksMade === made) throw new HttpError(409, "Someone already has them");
    },
    (before, after): ChangeSpec | null => {
      if (!forOther) return null;
      const e = after.draftLog?.[after.draftLog.length - 1];
      if (!e) return null;
      return {
        userId: a.user.id,
        kind: "draft",
        tier: 1,
        text: `Drafted ${castName(after, e.castawayId)} for ${nameOf(after, e.playerId)}`,
        batch,
        undo: { type: "draftPick", castawayId: e.castawayId, playerId: e.playerId, n: e.n },
      };
    }
  );
  notifyDraftTurn(leagueId, state, a.user.id);
  return { state, batch: forOther ? batch : null };
}

/** Takes back the draft's last pick (Draft settings' Undo last pick): whoever made it is on the clock again. */
export async function undoLastPick(a: DraftActor, leagueId: string): Promise<LeagueState> {
  requireCommissioner(a);
  let text = "";
  const state = await withLeagueLock(
    leagueId,
    (s) => {
      requireSnake(s);
      const last = s.draftLog?.[s.draftLog.length - 1];
      if (!last || last.n !== s.draftPicksMade) throw new HttpError(409, "There's no pick to take back here");
      text = `Took back ${nameOf(s, last.playerId)}'s pick (${castName(s, last.castawayId)})`;
      StateLogic.undraft(s, last.castawayId);
    },
    () => plainChange(a.user.id, "draft", text)
  );
  notifyDraftTurn(leagueId, state, a.user.id);
  return state;
}

/** Opens the draft now (the Commissioner's Start). */
export async function startDraft(a: DraftActor, leagueId: string): Promise<LeagueState> {
  requireCommissioner(a);
  const state = await withLeagueLock(
    leagueId,
    (s) => {
      if (!draftKind(s)) throw new HttpError(400, "This game has no draft");
      if (!s.castaways.some((c) => c.status === "active")) throw new HttpError(409, "Add the cast first");
      StateLogic.forceStartDraft(s);
    },
    plainChange(a.user.id, "draft", "Started the draft", 2)
  );
  notifyDraftTurn(leagueId, state, a.user.id);
  return state;
}

/** A new order before the first pick (Shuffle, or moved by hand): the same people, each once. */
export async function setDraftOrder(a: DraftActor, leagueId: string, order: unknown): Promise<LeagueState> {
  requireCommissioner(a);
  if (!Array.isArray(order) || !order.every((id) => typeof id === "string")) throw new HttpError(400, "order must be a list of players");
  return withLeagueLock(
    leagueId,
    (s) => {
      requireSnake(s);
      if (s.draftPicksMade > 0) throw new HttpError(409, "The order is set once the first pick is in");
      StateLogic.syncDraftOrder(s);
      const now = [...s.draftOrder].sort();
      if (order.length !== now.length || [...(order as string[])].sort().some((id, i) => id !== now[i])) throw new HttpError(400, "That isn't everyone in the draft");
      s.draftOrder = [...(order as string[])];
    },
    plainChange(a.user.id, "draft", "Set the draft order")
  );
}

/** The draft's settings: when it starts (before it does), the pick timer and what happens when it runs out. */
export async function setDraftSettings(
  a: DraftActor,
  leagueId: string,
  body: { timer?: unknown; away?: unknown; scheduledAt?: unknown }
): Promise<{ state: LeagueState; batch: string | null }> {
  requireCommissioner(a);
  const batch = crypto.randomUUID();
  let changed = false;
  const state = await withLeagueLock(
    leagueId,
    (s) => {
      if (!draftKind(s)) throw new HttpError(400, "This game has no draft");
      const before = JSON.stringify([s.settings.draftTimer, s.settings.draftAway, s.settings.draftScheduledAt]);
      if (body.scheduledAt !== undefined) {
        if (StateLogic.isDraftStarted(s)) throw new HttpError(409, "The draft has started");
        const at = body.scheduledAt === null || body.scheduledAt === "" ? null : String(body.scheduledAt);
        if (at !== null && !Number.isFinite(Date.parse(at))) throw new HttpError(400, "That isn't a time");
        if (at !== null && Date.parse(at) < Date.now() - 60_000) throw new HttpError(400, "Pick a time that hasn't passed");
        refused(StateLogic.updateSettings(s, "draftScheduledAt", at === null ? null : new Date(at).toISOString()));
      }
      if (body.timer !== undefined) {
        requireSnake(s);
        refused(StateLogic.updateSettings(s, "draftTimer", body.timer));
      }
      if (body.away !== undefined) {
        requireSnake(s);
        refused(StateLogic.updateSettings(s, "draftAway", body.away));
      }
      changed = JSON.stringify([s.settings.draftTimer, s.settings.draftAway, s.settings.draftScheduledAt]) !== before;
      // The timer counts this turn from now, not from when it began without one.
      if (changed && body.timer !== undefined) s.draftTurnAt = new Date().toISOString();
    },
    settingsSetChange(a.user.id, "Changed the draft's settings", { kind: "draft", batch })
  );
  return { state, batch: changed ? batch : null };
}

/** Whoever runs the game nudges the player on the clock: one push, once a turn. */
export async function nudgeDraft(a: DraftActor, leagueId: string, n: unknown): Promise<{ pushed: boolean }> {
  if (!runs(a)) throw new HttpError(403, "Only whoever runs the game nudges people");
  const state = await withLeagueLock(leagueId, (s) => {
    const clock = draftClock(s);
    if (!clock || clock.n !== n) throw new HttpError(409, "That pick was just made");
    if (clock.nudged) throw new HttpError(409, "They've been nudged already");
    if (clock.playerId === a.membership.playerId) throw new HttpError(400, "It's your turn");
    s.draftNudge = { n: clock.n, at: new Date().toISOString(), by: a.user.id };
  });
  const target = draftClock(state)?.playerId;
  const by = (a.user as { username?: string | null }).username || a.user.name;
  return { pushed: target ? await notifyDraftNudge(leagueId, target, by) : false };
}

/**
 * The pick timer ran out on pick `n` (any client in the room says so; the server checks the clock): with "pick from
 * their queue", the first of theirs still free is drafted for them, a line in Recent changes nobody made. Otherwise, or
 * with nothing queued, the draft waits. Answers whether a pick was made.
 */
export async function expireTurn(leagueId: string, n: unknown): Promise<{ picked: boolean; batch: string | null }> {
  const batch = crypto.randomUUID();
  let picked = false;
  const state = await withLeagueLock(
    leagueId,
    async (s, client) => {
      const clock = draftClock(s);
      if (!clock || clock.n !== n || !clock.endsAt || Date.parse(clock.endsAt) > Date.now() + 1000) return;
      if (draftTimer(s).away !== "queue") return;
      const queued = await queueOf(client, leagueId, clock.playerId);
      const free = new Set(StateLogic.freeAgents(s).map((c) => c.id));
      // The first of theirs still free that keeps their team spread (step A10 part 3) and within a salary cap (part 3b): everyone
      // free when neither applies.
      const fits = new Set(StateLogic.draftFitsFor(s, clock.playerId));
      const next = queued.find((id) => free.has(id) && fits.has(id));
      if (!next) return;
      StateLogic.draftToCurrentTurn(s, next, { auto: true });
      picked = true;
    },
    (before, after): ChangeSpec | null => {
      const e = picked ? after.draftLog?.[after.draftLog.length - 1] : null;
      if (!e) return null;
      return {
        userId: null,
        kind: "draft",
        tier: 1,
        text: `Drafted ${castName(after, e.castawayId)} for ${nameOf(after, e.playerId)} from their queue: the timer ran out`,
        batch,
        undo: { type: "draftPick", castawayId: e.castawayId, playerId: e.playerId, n: e.n },
      };
    }
  );
  if (picked) notifyDraftTurn(leagueId, state, null);
  return { picked, batch: picked ? batch : null };
}

// ---- the blind draft ----

/** Locks in a whole team in private: your own, or someone's when you run the game (you can't read theirs). */
export async function lockBlindFor(a: DraftActor, leagueId: string, playerId: unknown, castawayIds: unknown): Promise<LeagueState> {
  if (typeof playerId !== "string" || !Array.isArray(castawayIds)) throw new HttpError(400, "playerId and castawayIds required");
  const forOther = playerId !== a.membership.playerId;
  if (forOther && !runs(a)) throw new HttpError(403, "You can only lock in your own picks");
  return withLeagueLock(
    leagueId,
    async (s, client) => {
      const problem = StateLogic.BlindDraftLogic.validateSubmission(s, playerId, castawayIds as string[]);
      if (problem) throw new HttpError(400, problem);
      if (StateLogic.BlindDraftLogic.hasLocked(s, playerId)) throw new HttpError(400, "Already locked in — withdraw first to change your picks");
      await lockBlindPicks(client, leagueId, s, playerId, castawayIds as string[]);
    },
    // Never who they picked: only that someone locked in for them.
    forOther ? (_b, after) => plainChange(a.user.id, "draft", `Locked in ${nameOf(after, playerId)}'s draft picks`) : undefined
  );
}

/** Withdraws a submission before the reveal, so it can be done again (your own, or someone's when you run the game). */
export async function unlockBlindFor(a: DraftActor, leagueId: string, playerId: string): Promise<LeagueState> {
  const forOther = playerId !== a.membership.playerId;
  if (forOther && !runs(a)) throw new HttpError(403, "You can only withdraw your own picks");
  return withLeagueLock(
    leagueId,
    async (s, client) => {
      // Its own kind only: an auction's sheets share blind_draft_picks (step A10 part 3b, auction.ts).
      if (!StateLogic.BlindDraftLogic.on(s)) throw new HttpError(400, "This game is not running a blind draft");
      if (StateLogic.BlindDraftLogic.isRevealed(s)) throw new HttpError(400, "The draft has already been revealed");
      await unlockBlindPicks(client, leagueId, s, playerId);
    },
    forOther ? (_b, after) => plainChange(a.user.id, "draft", `Opened ${nameOf(after, playerId)}'s draft picks again`) : undefined
  );
}

// ---- the auction (step A10 part 3b: StateLogic.AuctionLogic, auction.ts) ----

/** Locks in sealed bids, [{ castawayId, bid }]: your own, or someone's when you run the game (who can't read theirs; an empty
 *  sheet has them filled from what's left at the lowest price). The last sheet in settles the auction. */
export async function lockBidsFor(a: DraftActor, leagueId: string, playerId: unknown, bids: unknown): Promise<LeagueState> {
  if (typeof playerId !== "string" || !Array.isArray(bids)) throw new HttpError(400, "playerId and bids required");
  const forOther = playerId !== a.membership.playerId;
  if (forOther && !runs(a)) throw new HttpError(403, "You can only lock in your own bids");
  const sheet: Bid[] = bids.map((b) => ({ castawayId: String((b as Bid | null)?.castawayId ?? ""), bid: Number((b as Bid | null)?.bid) }));
  return withLeagueLock(
    leagueId,
    async (s, client) => {
      const problem = StateLogic.AuctionLogic.validateBids(s, playerId, sheet);
      if (problem) throw new HttpError(400, problem);
      if (StateLogic.AuctionLogic.hasLocked(s, playerId)) throw new HttpError(400, "Already locked in — withdraw first to change your bids");
      await lockAuctionBids(client, leagueId, s, playerId, sheet);
    },
    // Never what they bid: only that someone locked in for them.
    forOther ? (_b, after) => plainChange(a.user.id, "draft", `Locked in ${nameOf(after, playerId)}'s bids`) : undefined
  );
}

/** Withdraws a sheet before the auction settles, so it can be done again (your own, or someone's when you run the game). */
export async function unlockBidsFor(a: DraftActor, leagueId: string, playerId: string): Promise<LeagueState> {
  const forOther = playerId !== a.membership.playerId;
  if (forOther && !runs(a)) throw new HttpError(403, "You can only withdraw your own bids");
  return withLeagueLock(
    leagueId,
    async (s, client) => {
      // Its own kind only: a blind draft's picks share the table.
      if (!StateLogic.AuctionLogic.on(s)) throw new HttpError(400, "This game is not an auction");
      if (StateLogic.AuctionLogic.settled(s)) throw new HttpError(400, "The auction is over");
      await unlockAuctionBids(client, leagueId, s, playerId);
    },
    forOther ? (_b, after) => plainChange(a.user.id, "draft", `Opened ${nameOf(after, playerId)}'s bids again`) : undefined
  );
}

/** Your own locked-in bids (null: none), self only, as a blind draft's picks (blind-draft.ts readOwnPicks says why). */
export async function readOwnBids(leagueId: string, playerId: string): Promise<Bid[] | null> {
  const { rows } = await pool.query("SELECT castaway_ids FROM blind_draft_picks WHERE league_id=$1 AND player_id=$2", [leagueId, playerId]);
  return rows.length ? (rows[0].castaway_ids as Bid[]) : null;
}

// ---- the queue: yours alone ----

type Db = Pick<typeof pool, "query">;

async function queueOf(db: Db, leagueId: string, playerId: string): Promise<string[]> {
  const { rows } = await db.query("SELECT castaway_ids FROM draft_queues WHERE league_id = $1 AND player_id = $2", [leagueId, playerId]);
  return (rows[0]?.castaway_ids as string[] | undefined) ?? [];
}

/** Your queue in each of these leagues (your seat in each), for the draft room. */
export async function queuesFor(seats: { leagueId: string; playerId: string }[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!seats.length) return out;
  const { rows } = await pool.query(
    "SELECT league_id, player_id, castaway_ids FROM draft_queues WHERE league_id = ANY($1::uuid[])",
    [seats.map((s) => s.leagueId)]
  );
  for (const r of rows) if (seats.some((s) => s.leagueId === r.league_id && s.playerId === r.player_id)) out.set(r.league_id, r.castaway_ids);
  return out;
}

/** Saves your queue (castaways still in, in order; empty clears it). */
export async function saveQueue(a: DraftActor, leagueId: string, state: LeagueState, castawayIds: unknown): Promise<string[]> {
  if (!a.membership.playerId) throw new HttpError(400, "You don't have a team in this game");
  if (!Array.isArray(castawayIds) || castawayIds.some((id) => typeof id !== "string")) throw new HttpError(400, "castawayIds must be a list");
  const known = new Set(state.castaways.map((c) => c.id));
  const ids = [...new Set(castawayIds as string[])].filter((id) => known.has(id)).slice(0, 40);
  await pool.query(
    `INSERT INTO draft_queues (league_id, player_id, castaway_ids, updated_at) VALUES ($1, $2, $3::jsonb, now())
     ON CONFLICT (league_id, player_id) DO UPDATE SET castaway_ids = EXCLUDED.castaway_ids, updated_at = now()`,
    [leagueId, a.membership.playerId, JSON.stringify(ids)]
  );
  return ids;
}
