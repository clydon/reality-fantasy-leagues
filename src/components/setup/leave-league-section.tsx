"use client";

import { useRouter } from "next/navigation";
import { useLeagueStore } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import StateLogic from "@/lib/game/state-logic.js";

// Port of renderSetup()'s Leave League panel -- live-only (no real membership to leave in mock
// mode), same as the live app only showing it when currentMembership.playerId exists. Falls back
// to demo data afterward, same as any other "no personal league" case in this POC (e.g. a
// super-admin with zero leagues) -- there's no multi-league dashboard to return to yet.
export function LeaveLeagueSection() {
  const router = useRouter();
  const mode = useLeagueStore((s) => s.mode);
  const membership = useLeagueStore((s) => s.membership);
  const state = useLeagueStore((s) => s.state);
  const leagueId = useLeagueStore((s) => s.leagueId);
  const enterMockMode = useLeagueStore((s) => s.useMock);

  if (mode !== "live" || !membership?.playerId) return null;

  async function handleLeave() {
    const draftStarted = StateLogic.isDraftStarted(state);
    const msg = draftStarted
      ? "Leave this league? Your roster and points stay intact but you'll be removed as an active player."
      : "Leave this league? You'll be removed from the draft order entirely.";
    if (!confirm(msg)) return;
    try {
      await api.leaveLeague(leagueId!);
      enterMockMode();
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
