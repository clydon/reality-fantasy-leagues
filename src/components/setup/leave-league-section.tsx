"use client";

import { useRouter } from "next/navigation";
import { useLeagueStore } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import StateLogic from "@/lib/game/state-logic.js";
import { confirm } from "@/lib/confirm-store";

// Port of renderSetup()'s Leave League panel -- live-only (no real membership to leave in mock
// mode), same as the live app only showing it when currentMembership.playerId exists. Falls back
// to the user's next league afterward, or -- if that was their last one -- to the Dashboard
// (AuthGate shows it automatically once the store has no league loaded and no leagues listed).
export function LeaveLeagueSection() {
  const router = useRouter();
  const mode = useLeagueStore((s) => s.mode);
  const membership = useLeagueStore((s) => s.membership);
  const state = useLeagueStore((s) => s.state);
  const leagueId = useLeagueStore((s) => s.leagueId);
  const setLeagues = useLeagueStore((s) => s.setLeagues);
  const switchLeague = useLeagueStore((s) => s.switchLeague);
  const clearLeague = useLeagueStore((s) => s.clearLeague);

  if (mode !== "live" || !membership?.playerId) return null;

  async function handleLeave() {
    const draftStarted = StateLogic.isDraftStarted(state);
    const msg = draftStarted
      ? "Leave this league? Your roster and points stay intact but you'll be removed as an active player."
      : "Leave this league? You'll be removed from the draft order entirely.";
    if (!(await confirm(msg, { danger: true, confirmLabel: "Leave" }))) return;
    try {
      await api.leaveLeague(leagueId!);
      const me = await api.me();
      setLeagues(me.leagues);
      if (me.leagues.length > 0) await switchLeague(me.leagues[0].id);
      else clearLeague();
      router.push("/");
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Could not leave the league.");
    }
  }

  return (
    <div className="rounded-lg border border-destructive/30 bg-card p-4 shadow-sm">
      <h3 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Leave League</h3>
      <Button variant="destructive" onClick={handleLeave}>
        Leave League
      </Button>
    </div>
  );
}
