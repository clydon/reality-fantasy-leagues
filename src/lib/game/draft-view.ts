import StateLogic from "./state-logic.js";
import { sortByTribe } from "./sort-by-tribe";
import { castOf, type CastFace, type GameRefIn, type UserOf } from "./game-view";
import type { LeagueState } from "./types";

// The draft room and the blind draft, for one viewer (docs/PLAN-new-design.md step 7; the mock's draft.js). Pure: the
// server reads the league, your queue and your own blind picks (season-draft.ts), and this says what the screens show.
//
// Casual first: no timer by default and nobody is picked for automatically; whoever runs the game (a Commissioner or a
// Game admin) can always pick for someone, which is how you help a friend over the phone. A turn-based draft (each
// castaway on one team) keeps its own log of picks (state-logic.js draftLog): the ticker, the order strip's faces and
// "made for someone else" come from it. A blind draft (castaways on several teams) never shows anyone's picks before
// the reveal: only who has locked in, and your own picks back to you.
//
// Spoiler-safe: faces come from your copy of the league at your mark (GhostLogic.viewFor). A draft that opens after
// episodes have results you haven't revealed (a late league) asks you to reveal them first, since who's still
// available would say who went home.

export type DraftKind = "snake" | "blind";
export type DraftPhase = "waiting" | "live" | "done";

export interface DraftFace {
  id: string;
  name: string;
  photo: string | null;
  tribe: { name: string; colour: string } | null;
  /** Points so far as this game counts them, once any episode has scored; null before the season starts. */
  points: number | null;
  /** Out of the game, as far as you've seen (only on a finished draft's teams). */
  left: boolean;
}

export interface DraftSeat {
  playerId: string;
  name: string;
  userId: string | null;
  you: boolean;
  /** A computer player (bot-logic.js). */
  bot: boolean;
}

export interface DraftPick {
  /** The overall pick (1-based), its round and its place in the round. */
  n: number;
  round: number;
  inRound: number;
  playerId: string;
  /** Null for a pick made before the draft kept its log. */
  castawayId: string | null;
  /** Who made it for them (a name), when it wasn't them. */
  by: string | null;
  /** The pick timer ran out and it came from their queue. */
  auto: boolean;
}

export interface DraftClock {
  playerId: string;
  n: number;
  round: number;
  /** When this turn began (the last pick, or the start). */
  since: string | null;
  /** When the pick timer runs out; null with no timer. */
  endsAt: string | null;
  nudged: boolean;
}

export interface DraftGame extends GameRefIn {
  kind: DraftKind;
  /** Your seat. */
  you: string | null;
  /** You run this game (Commissioner or Game admin): you can pick for anyone. */
  runs: boolean;
  /** The draft's settings (the order, the start, the timer) are a Commissioner's. */
  commissioner: boolean;
  phase: DraftPhase;
  scheduledAt: string | null;
  /** The cast is in: nothing to draft until it is. */
  castReady: boolean;
  /** How many each team drafts. */
  size: number;
  /** Turn-based: everyone in the draft order; blind: everyone who has to lock in. */
  seats: DraftSeat[];
  /** Who can be drafted (everyone still in), grouped by tribe; on a finished draft, everyone on a team too. */
  cast: DraftFace[];
  /** Results you haven't revealed stand in the way of seeing who's left to draft: the first of them. */
  revealFirst: number | null;
  /** Turn-based: who picks at each overall pick (0-based), the picks made, and who's on the clock. */
  turns: string[];
  picks: DraftPick[];
  made: number;
  clock: DraftClock | null;
  timer: number;
  away: "wait" | "queue";
  /** Who has each castaway (turn-based: one each). */
  owners: Record<string, string[]>;
  /** Each seat's draft, in the order they picked. */
  teams: { playerId: string; castawayIds: string[] }[];
  /** The last pick can be taken back from Draft settings (it's in the log). */
  canUndo: boolean;
  /** Picks someone else made for them (or the timer did). */
  madeFor: number;
  /** Your queue: castaways you starred, in order (private). */
  queue: string[];
  /** Blind: who has locked in, your own picks (null: not locked in), and when it revealed. */
  locked: string[];
  mine: string[] | null;
  revealedAt: string | null;
}

/** Who makes overall pick `index` (0-based) in a snake draft over `order` (the classic draft-helpers' rule). */
export function snakeOwner(order: string[], index: number): string | undefined {
  const n = order.length;
  if (!n) return undefined;
  const round = Math.floor(index / n);
  const pos = index % n;
  return round % 2 === 0 ? order[pos] : order[n - 1 - pos];
}

/** The draft's kind, or null for a game with no draft (Survival Pool). */
export function draftKind(state: LeagueState): DraftKind | null {
  if (!StateLogic.getLeagueType(state).hasRoster) return null;
  return state.settings.ownershipMode === "shared" ? "blind" : "snake";
}

/** The pick timer in seconds (0: off), and what happens when it runs out. */
export function draftTimer(state: LeagueState): { timer: number; away: "wait" | "queue" } {
  const t = Number(state.settings.draftTimer);
  return { timer: t === 60 || t === 120 ? t : 0, away: state.settings.draftAway === "queue" ? "queue" : "wait" };
}

/** Who's on the clock in a live turn-based draft, since when, and when the timer runs out. Mutates nothing it shouldn't:
 *  currentDraftTurn keeps the order in step with the seats, as every read of it does. */
export function draftClock(state: LeagueState): DraftClock | null {
  if (draftKind(state) !== "snake" || !StateLogic.isDraftStarted(state)) return null;
  const turn = StateLogic.currentDraftTurn(state);
  if (!turn || turn.isComplete || !turn.playerId) return null;
  const since = state.draftTurnAt ?? state.draftStartedAt ?? state.settings.draftScheduledAt ?? null;
  const { timer } = draftTimer(state);
  const n = turn.overallPickNumber!;
  return {
    playerId: turn.playerId,
    n,
    round: turn.personalPickNumber!,
    since,
    endsAt: timer && since ? new Date(Date.parse(since) + timer * 1000).toISOString() : null,
    nudged: state.draftNudge?.n === n,
  };
}

function phaseOf(state: LeagueState, kind: DraftKind): DraftPhase {
  if (!StateLogic.isDraftStarted(state)) return "waiting";
  if (kind === "blind") return StateLogic.BlindDraftLogic.isRevealed(state) ? "done" : "live";
  const turn = StateLogic.currentDraftTurn(state);
  return !turn || turn.isComplete ? "done" : "live";
}

function faceOf(c: CastFace, scored: boolean): DraftFace {
  return { id: c.id, name: c.name, photo: c.photo, tribe: c.tribe, points: scored ? (c.points ?? 0) : null, left: c.left };
}

/**
 * The draft as `playerId` sees it in one game. `full`: the league with air times stamped; `seen`: their mark there
 * (null: everything); `queue` and `mine`: their own queue and blind picks, read by the server for their seat only;
 * `nameOfUser`: a name for whoever made a pick for someone.
 */
export function draftView(
  game: GameRefIn,
  full: LeagueState,
  playerId: string | null,
  seen: number | null,
  userOf: UserOf,
  own: { queue: string[]; mine: string[] | null },
  nameOfUser: (userId: string) => string | null
): DraftGame | null {
  const kind = draftKind(full);
  if (!kind) return null;
  const phase = phaseOf(full, kind);
  const view = StateLogic.GhostLogic.viewFor(full, playerId, seen) as LeagueState;
  const hidden = StateLogic.SpoilerLogic.hiddenEpisodes(full, seen);
  const size = StateLogic.rosterSize(full);
  const role = game.yourRole;
  const nameOf = (id: string) => full.players.find((p) => p.id === id)?.name ?? "someone";
  const seat = (id: string): DraftSeat => ({ playerId: id, name: nameOf(id), userId: userOf(id), you: id === playerId, bot: !!full.players.find((p) => p.id === id)?.automated });

  // The cast as you've seen it, tribe by tribe. Points only once an episode has scored: before that it's the tribe.
  const faces = new Map(castOf(view).map((c) => [c.id, c]));
  const scored = StateLogic.SpoilerLogic.latestWithResults(view) > 0;
  const order = sortByTribe(view.castaways, view).map((c) => c.id);
  // Each team as it was drafted (whatever happened to them since), in the order they were picked where the log says.
  const log = kind === "snake" ? (full.draftLog ?? []) : [];
  const pickedAt = new Map(log.map((e) => [e.castawayId, e.n]));
  const teams =
    phase === "waiting"
      ? []
      : full.players
          .map((p) => ({
            playerId: p.id,
            castawayIds: StateLogic.originalDraftPicks(full, p.id)
              .map((c) => c.id)
              .sort((a, b) => (pickedAt.get(a) ?? 1e9) - (pickedAt.get(b) ?? 1e9)),
          }))
          .filter((t) => t.castawayIds.length);
  const onTeams = new Set(teams.flatMap((t) => t.castawayIds));
  const cast = order.filter((id) => !faces.get(id)?.left || (phase === "done" && onTeams.has(id))).map((id) => faceOf(faces.get(id)!, scored));

  const owners: Record<string, string[]> = {};
  for (const c of full.castaways) if ((c.ownerIds ?? []).length) owners[c.id] = [...c.ownerIds];

  const base = {
    ...game,
    kind,
    you: playerId,
    runs: role === "commissioner" || role === "admin",
    commissioner: role === "commissioner",
    phase,
    scheduledAt: full.settings.draftScheduledAt ?? null,
    castReady: full.castaways.some((c) => c.status === "active"),
    size,
    cast,
    revealFirst: phase !== "done" && hidden.length ? hidden[0].number : null,
    ...draftTimer(full),
    owners,
    queue: own.queue.filter((id) => faces.has(id)),
  };

  if (kind === "blind") {
    const B = StateLogic.BlindDraftLogic;
    const seats = B.eligiblePlayers(full).map((p) => seat(p.id));
    return {
      ...base,
      seats,
      turns: [],
      picks: [],
      made: full.draftPicksMade,
      clock: null,
      // Nothing about anyone's picks before the reveal.
      teams: phase === "done" ? teams : [],
      canUndo: false,
      madeFor: 0,
      locked: B.lockedPlayerIds(full),
      mine: phase === "live" ? own.mine : null,
      revealedAt: full.blindDraft?.revealedAt ?? null,
    };
  }

  const clock = draftClock(full);
  const draftOrder = [...full.draftOrder];
  const turns = Array.from({ length: draftOrder.length * size }, (_, i) => snakeOwner(draftOrder, i)!);
  const at = new Map(log.map((e) => [e.n, e]));
  const made = full.draftPicksMade;
  const n = draftOrder.length || 1;
  const picks: DraftPick[] = Array.from({ length: made }, (_, i) => {
    const e = at.get(i + 1);
    return {
      n: i + 1,
      round: Math.floor(i / n) + 1,
      inRound: (i % n) + 1,
      playerId: e?.playerId ?? turns[i],
      castawayId: e?.castawayId ?? null,
      by: e?.by ? (nameOfUser(e.by) ?? "someone") : null,
      auto: !!e?.auto,
    };
  });
  const last = log[log.length - 1];
  return {
    ...base,
    seats: draftOrder.map(seat),
    turns,
    picks,
    made,
    clock,
    teams,
    canUndo: !!last && last.n === made && (full.castaways.find((c) => c.id === last.castawayId)?.ownerIds ?? []).includes(last.playerId),
    madeFor: log.filter((e) => e.by || e.auto).length,
    locked: [],
    mine: null,
    revealedAt: null,
  };
}
