"use client";

import { useLeagueStore } from "@/lib/store";
import { DraftOrderPanel } from "./draft-order-panel";
import { DraftStatusPanel } from "./draft-status-panel";
import { DraftResultsPanel } from "./draft-results-panel";
import { FreeAgentsPanel } from "./free-agents-panel";

// Direct port of renderDraft() (public/app.js), same panel order: Draft Order, status banner,
// Draft Results, Free Agents.
export function DraftBoard() {
  const state = useLeagueStore((s) => s.state);

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
