"use client";

import { useLeagueStore } from "@/lib/store";
import StateLogic from "@/lib/game/state-logic.js";
import { DraftOrderPanel } from "./draft-order-panel";
import { DraftStatusPanel } from "./draft-status-panel";
import { DraftResultsPanel } from "./draft-results-panel";
import { FreeAgentsPanel } from "./free-agents-panel";
import { BlindDraftPanel } from "./blind-draft-panel";

// Direct port of renderDraft() (public/app.js), same panel order: Draft Order, status banner,
// Draft Results, Free Agents. The sidebar/mobile nav both hide this tab's link for a league type
// with no roster (pickem), but this route is still directly reachable by URL -- guard here too
// rather than trusting the nav to be the only way in, same reasoning FinaleSettingsSection etc.
// guard themselves instead of trusting only their parent to not render them.
//
// Shared ownership mode swaps the turn-based trio for a single BlindDraftPanel: there's no turn
// order to set or show (everyone submits simultaneously) and no free-agent list (nothing is ever
// removed from availability, so the panel offers the whole active cast itself). Draft Results still
// applies to both modes -- post-reveal it's the same "who ended up with whom" view.
export function DraftBoard() {
  const state = useLeagueStore((s) => s.state);

  if (!StateLogic.getLeagueType(state).hasRoster) {
    return (
      <>
        <h2 className="mb-[18px] text-2xl font-bold tracking-tight max-nav:hidden">Draft</h2>
        <p className="text-sm text-muted-foreground">This league type has no draft or roster. Picks are made from the Episodes tab.</p>
      </>
    );
  }

  const shared = state.settings.ownershipMode === "shared";
  const turn = StateLogic.currentDraftTurn(state);
  const draftComplete = !!(turn && turn.isComplete);

  return (
    <>
      <h2 className="mb-[18px] text-2xl font-bold tracking-tight max-nav:hidden">Draft</h2>
      {shared ? (
        <>
          <DraftStatusPanel state={state} />
          {StateLogic.BlindDraftLogic.isRevealed(state) ? (
            <DraftResultsPanel state={state} />
          ) : (
            <BlindDraftPanel state={state} />
          )}
        </>
      ) : (
        <>
          <DraftOrderPanel state={state} />
          <DraftStatusPanel state={state} />
          <DraftResultsPanel state={state} />
          {/* Nothing left to pick once the draft's done -- an empty-looking "Free Agents (0)" panel
              (or a full one nobody can act on any more) was just clutter below the results. */}
          {!draftComplete && <FreeAgentsPanel state={state} />}
        </>
      )}
    </>
  );
}
