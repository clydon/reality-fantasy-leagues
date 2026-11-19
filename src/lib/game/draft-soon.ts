import StateLogic from "./state-logic.js";
import { draftKindOf, draftLate, draftNeeds, draftStartDue } from "./action-items.js";
import type { LeagueState } from "./types";

// A draft before it starts (docs/design-round/draft-start-spec.md): what the strip, the hub's plate, the game's own move and the
// draft room say about it. Pure, from the league as stored (a draft's start says nothing about results). Its own module so the game
// view and the draft view can both read it without importing each other.

/** A draft that hasn't started, as the strip, the hub and the game's own move say it (docs/design-round/draft-start-spec.md): */
export interface DraftSoon {
  /** The draft room's kind (turn-based, blind, a draw, an auction): which room it opens in. */
  kind: "snake" | "blind" | "draw" | "auction";
  /** When it starts by itself (a time set), or null. */
  at: string | null;
  /** Why it can't start yet (a later stage's draft, waiting on the results before it: DraftLogic.waits), or null. */
  waits: string | null;
  /** Who starts it: the seat of the game's Commissioner (the first, if there are two), or null when that isn't known. */
  runBy: string | null;
  /** It's its Commissioner's to start now (action-items.js draftStartDue): no time set (or one after its first episode), nothing in the way. */
  startDue: boolean;
  /** Its time is set at or after the game's first episode airs: that episode (the runner's to move), else null. */
  late: number | null;
  /** What it can't start without: "cast" or "players" (Backstage's Add the cast, Invite people), else null. */
  needs: "cast" | "players" | null;
}

/** The draft as it stands before it starts, or null once it has (or for a game with no draft, or one at your own pace, whose
 *  plate says it). `runnerIds`: the game's Commissioners' seats (show-space.ts games), for the name. Nothing in it is a result. */
export function draftSoonOf(state: LeagueState, runnerIds?: string[] | null): DraftSoon | null {
  const kind = draftKindOf(state);
  if (!kind || state.settings.archivedAt || StateLogic.isDraftStarted(state) || StateLogic.GhostLogic.ownPace(state)) return null;
  const runner = (runnerIds ?? []).map((id) => state.players.find((p) => p.id === id)).find((p) => !!p);
  const needs = draftNeeds(state);
  return {
    kind,
    at: StateLogic.gameOf(state).extras.draft?.at ?? null,
    waits: StateLogic.DraftLogic.waits(state),
    runBy: runner?.name ?? null,
    startDue: draftStartDue(state),
    late: draftLate(state),
    needs: needs === "cast" || needs === "players" ? needs : null,
  };
}
