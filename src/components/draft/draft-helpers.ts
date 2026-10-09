import type { LeagueState, Player } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";

// Snake-draft arithmetic for the draft screens. state-logic.js only exposes the current turn; the
// order strip and the board need to know who holds any pick, which is the same rule run forward
// (SnakeDraftStrategy.currentTurn: odd rounds run the order backwards).

/** Who makes overall pick `index` (0-based), in a snake draft over `order`. */
export function snakePickOwner(order: string[], index: number): string | undefined {
  const n = order.length;
  if (n === 0) return undefined;
  const round = Math.floor(index / n);
  const pos = index % n;
  return round % 2 === 0 ? order[pos] : order[n - 1 - pos];
}

/** The overall pick numbers (1-based) a player still has to make, from `from` (0-based) on. */
export function picksLeftFor(state: LeagueState, playerId: string, from: number): number[] {
  const total = state.draftOrder.length * StateLogic.rosterSize(state);
  const out: number[] = [];
  for (let i = from; i < total; i++) if (snakePickOwner(state.draftOrder, i) === playerId) out.push(i + 1);
  return out;
}

/** Players in draft order; anyone not in it (joined after the draft, not yet activated) last. */
export function playersInDraftOrder(state: LeagueState): Player[] {
  const pos = (id: string) => {
    const i = state.draftOrder.indexOf(id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...state.players].sort((a, b) => pos(a.id) - pos(b.id));
}

/** "You" for the viewer's own seat, otherwise the player's name. */
export function whoName(state: LeagueState, playerId: string | undefined | null, me: string | null): string {
  if (!playerId) return "?";
  if (playerId === me) return "You";
  return StateLogic.getPlayer(state, playerId)?.name ?? "?";
}
