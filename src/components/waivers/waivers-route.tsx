"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore } from "@/lib/store";
import { useIsPeek } from "@/components/league-swipe";
import { waiversBase } from "./waivers-model";

// The waiver pages live at /waivers. Active Roster kept them under Research (/research/waivers) until
// Waivers moved to the More sheet; a link or push that lands there is sent on to /waivers.
//
// Never from a peek (league-swipe.tsx): the neighbouring league's copy of this page is drawn hidden
// beside the real one, and a neighbour that keeps Waivers at the other path would send the real page
// there, whose own WaiversRoute sends it back -- the URL flipping between the two forever.
export function WaiversRoute({ sub = "", children }: { sub?: string; children: ReactNode }) {
  const state = useLeagueStore((s) => s.state);
  const router = useRouter();
  const pathname = usePathname();
  const peek = useIsPeek();
  const on = StateLogic.WaiverLogic.enabled(state);
  const base = waiversBase(state);
  const wrong = !peek && on && !pathname.startsWith(base);
  useEffect(() => {
    if (wrong) router.replace(`${base}${sub}${window.location.search}`);
  }, [wrong, base, sub, router]);
  if (wrong) return null;
  return <>{children}</>;
}

/** /mid-season, where the old live Pickups/Swap rounds were: kept so old links and pushes still land,
 *  on this league's Waivers page. */
export function MidSeasonRedirect() {
  const state = useLeagueStore((s) => s.state);
  const router = useRouter();
  const peek = useIsPeek();
  const base = waiversBase(state);
  useEffect(() => {
    if (!peek) router.replace(`${base}${window.location.search}`);
  }, [peek, base, router]);
  return null;
}
