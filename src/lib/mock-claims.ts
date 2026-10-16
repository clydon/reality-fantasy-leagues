import type { WaiverClaim } from "@/lib/game/types";

// Waiver claims for a league with no server behind it (mock mode: the guided tour). On a real league
// claims are private rows only the server reads (waiver_claims); here they're kept in memory, one per
// week and player, for useMyClaim to show and the tour's director to process. A week's id is fresh
// every time one opens, so a restarted tour never meets an old claim.
const claims = new Map<string, WaiverClaim>();
const key = (periodId: string, playerId: string) => `${periodId}|${playerId}`;

export function mockClaim(periodId: string, playerId: string): WaiverClaim | null {
  return claims.get(key(periodId, playerId)) ?? null;
}

/** Saves one player's claim for a week; null (or an empty claim) withdraws it. */
export function setMockClaim(periodId: string, playerId: string, claim: WaiverClaim | null) {
  if (claim && (claim.pickupIds.length || claim.dropId || claim.addIds.length)) claims.set(key(periodId, playerId), claim);
  else claims.delete(key(periodId, playerId));
}

/** Every claim in for a week, by player: what WaiverLogic.process takes. */
export function mockClaimsFor(periodId: string): Record<string, WaiverClaim> {
  const out: Record<string, WaiverClaim> = {};
  claims.forEach((c, k) => {
    const [p, player] = k.split("|");
    if (p === periodId) out[player] = c;
  });
  return out;
}
