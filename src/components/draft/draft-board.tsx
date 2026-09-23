"use client";

import { useLeagueStore } from "@/lib/store";
import StateLogic from "@/lib/game/state-logic.js";
import { DraftOrderPanel } from "./draft-order-panel";
import { DraftStatusPanel } from "./draft-status-panel";
import { DraftResultsPanel } from "./draft-results-panel";
import { FreeAgentsPanel } from "./free-agents-panel";

// Direct port of renderDraft() (public/app.js), same panel order: Draft Order, status banner,
// Draft Results, Free Agents. The sidebar/mobile nav both hide this tab's link for a league type
// with no roster (pickem), but this route is still directly reachable by URL -- guard here too
// rather than trusting the nav to be the only way in, same reasoning FinaleSettingsSection etc.
// guard themselves instead of trusting only their parent to not render them.
export function DraftBoard() {
  const state = useLeagueStore((s) => s.state);

  if (!StateLogic.getLeagueType(state).hasRoster) {
    return (
      <>
        <h2 className="mb-[18px] text-2xl font-bold tracking-tight">Draft</h2>
        <p className="text-sm text-muted-foreground">This league type has no draft or roster. Picks are made from the Episodes tab.</p>
      </>
    );
  }

  return (
    <>
      <h2 className="mb-[18px] text-2xl font-bold tracking-tight">Draft</h2>
      <DraftOrderPanel state={state} />
      <DraftStatusPanel state={state} />
      <DraftResultsPanel state={state} />
      <FreeAgentsPanel state={state} />
    </>
  );
}
