"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore } from "@/lib/store";
import { waiversBase } from "./waivers-model";

// The waiver pages live at /waivers in Classic and /research/waivers in Active Roster (whose tab bar
// is full, so Waivers sits inside Research and backs up to it). A link or push that lands on the other
// one is sent where this league keeps them.
export function WaiversRoute({ sub = "", children }: { sub?: string; children: ReactNode }) {
  const state = useLeagueStore((s) => s.state);
  const router = useRouter();
  const pathname = usePathname();
  const on = StateLogic.WaiverLogic.enabled(state);
  const base = waiversBase(state);
  const wrong = on && !pathname.startsWith(base);
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
  const base = waiversBase(state);
  useEffect(() => {
    router.replace(`${base}${window.location.search}`);
  }, [base, router]);
  return null;
}
