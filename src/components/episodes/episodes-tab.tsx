"use client";

import { useLeagueStore, useCanManage } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import StateLogic from "@/lib/game/state-logic.js";
import { api } from "@/lib/api";
import { EpisodeCard } from "./episode-card";
import { Button } from "@/components/ui/button";

// Port of renderEpisodes() (public/app.js): + Add New Episode button, then episode cards newest
// first. renderUnsettledBetsPanel() isn't ported -- it's pure duplication of the "needs your
// guess" signal already in Overview's Side Bets section for members, and commissioner-only
// grading is already available inline on each bet here, so it doesn't add anything this POC
// doesn't already validate elsewhere.
export function EpisodesTab() {
  const state = useLeagueStore((s) => s.state);
  const leagueId = useLeagueStore((s) => s.leagueId);
  const canManage = useCanManage();
  const mutate = useMutate();

  const sorted = [...state.episodes].sort((a, b) => b.number - a.number);
  const latestNumber = sorted[0]?.number;

  async function handleAddEpisode() {
    await mutate(
      (s) => StateLogic.addEpisode(s),
      () => api.addEpisode(leagueId!)
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h2 className="mb-4 text-2xl font-bold tracking-tight">Episodes</h2>
      {canManage && (
        <div className="mb-4">
          <Button onClick={handleAddEpisode}>+ Add New Episode</Button>
        </div>
      )}
      {sorted.length === 0 ? (
        <div className="text-sm italic text-muted-foreground">No episodes logged yet.</div>
      ) : (
        sorted.map((ep) => <EpisodeCard key={ep.id} ep={ep} state={state} defaultOpen={ep.number === latestNumber} />)
      )}
    </div>
  );
}
