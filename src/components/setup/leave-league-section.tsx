"use client";

import { useRouter } from "next/navigation";
import { useLeagueStore } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import StateLogic from "@/lib/game/state-logic.js";
import { confirm } from "@/lib/confirm-store";
import { PlainButton } from "@/components/draft/draft-ui";

// Port of renderSetup()'s Leave League panel, now in League Settings' Danger zone (setup-tab.tsx) --
// live-only (no real membership to leave in mock mode), same as the live app only showing it when
// currentMembership.playerId exists. Falls back to the user's next league afterward, or -- if that was
// their last one -- to the Dashboard (AuthGate shows it once the store has no league loaded and no
// leagues listed).
export function LeaveLeagueButton() {
  const router = useRouter();
  const mode = useLeagueStore((s) => s.mode);
  const membership = useLeagueStore((s) => s.membership);
  const state = useLeagueStore((s) => s.state);
  const leagueId = useLeagueStore((s) => s.leagueId);
  const setLeagues = useLeagueStore((s) => s.setLeagues);
  const switchLeague = useLeagueStore((s) => s.switchLeague);
  const clearLeague = useLeagueStore((s) => s.clearLeague);

  if (mode !== "live" || !membership?.playerId) return null;
  const draftStarted = StateLogic.isDraftStarted(state);

  async function handleLeave() {
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
    <div className="flex flex-col gap-1.5">
      <PlainButton danger onClick={handleLeave}>
        Leave league
      </PlainButton>
      <p className="text-[13px] text-muted-foreground">
        {draftStarted ? "Your roster and points stay, but you stop playing." : "You come out of the draft order."}
      </p>
    </div>
  );
}
