import type { LeagueState } from "@/lib/game/types";
import { useLeagueStore } from "@/lib/store";
import { ApiError } from "@/lib/api";

// One hook standing in for the isDemoMode branch every mutator in public/app.js has (see
// CLAUDE.md: "isDemoMode is checked at the top of nearly every mutator... any new mutator needs
// both branches"). Mock mode mutates the shared/state-logic.js copy in place, exactly like the
// live app's demo mode; live mode calls the real API and replaces state with its response.
export function useMutate() {
  const mode = useLeagueStore((s) => s.mode);
  const state = useLeagueStore((s) => s.state);
  const leagueId = useLeagueStore((s) => s.leagueId);
  const setState = useLeagueStore((s) => s.setState);

  // Resolves true once the change has landed, false if the server refused it (already alerted).
  return async function mutate(mockMutator: (state: LeagueState) => void, liveCall: () => Promise<LeagueState>): Promise<boolean> {
    if (mode === "mock") {
      mockMutator(state);
      setState(state);
      return true;
    }
    if (!leagueId) throw new Error("mutate() called in live mode with no leagueId loaded");
    try {
      const next = await liveCall();
      setState(next);
      return true;
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Request failed.");
      return false;
    }
  };
}
