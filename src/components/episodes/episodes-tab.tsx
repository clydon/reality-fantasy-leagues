"use client";

import { useQuery } from "@tanstack/react-query";
import type { WikiProposalItem, ResearchProposalItem } from "@/lib/game/types";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import StateLogic from "@/lib/game/state-logic.js";
import { api } from "@/lib/api";
import { EpisodeCard } from "./episode-card";
import { CatchUpPanel } from "./catch-up-panel";
import { Button } from "@/components/ui/button";

// Port of renderEpisodes() (public/app.js): + Add New Episode button, then episode cards newest
// first. renderUnsettledBetsPanel() isn't ported -- it's pure duplication of the "needs your
// guess" signal already in Overview's Side Bets section for members, and commissioner-only
// grading is already available inline on each bet here, so it doesn't add anything this POC
// doesn't already validate elsewhere.
export function EpisodesTab() {
  const state = useLeagueStore((s) => s.state);
  const leagueId = useLeagueStore((s) => s.leagueId);
  const mode = useLeagueStore((s) => s.mode);
  const canManage = useCanManage();
  const mutate = useMutate();

  const sorted = [...state.episodes].sort((a, b) => b.number - a.number);
  const latestNumber = sorted[0]?.number;

  // Wiki-connector decisions (db/migrations/0009) live in their own table, not league state --
  // same "no mock-mode branch" reasoning as wiki-proposals (see wiki-connector-section.tsx).
  // Fetched once here rather than per-card, then grouped by episode for each card's own "Reveal
  // Outcome" section.
  const live = mode === "live" && !!leagueId;
  const { data, refetch } = useQuery({
    queryKey: ["wiki-items", leagueId],
    queryFn: () => api.listWikiItems(leagueId!),
    enabled: live && canManage,
  });
  const itemsByEpisode = new Map<number, WikiProposalItem[]>();
  for (const item of data?.items ?? []) {
    const list = itemsByEpisode.get(item.episode_number);
    if (list) list.push(item);
    else itemsByEpisode.set(item.episode_number, [item]);
  }

  // The research connector's own items (0015), fetched and grouped the same way and on the same
  // schedule -- one refetch (below) covers both, since accepting or rejecting either kind can only
  // happen from the same panel a commissioner is already looking at.
  const { data: researchData, refetch: refetchResearch } = useQuery({
    queryKey: ["research-items", leagueId],
    queryFn: () => api.listResearchItems(leagueId!),
    enabled: live && canManage,
  });
  const researchByEpisode = new Map<number, ResearchProposalItem[]>();
  for (const item of researchData?.items ?? []) {
    const list = researchByEpisode.get(item.episode_number);
    if (list) list.push(item);
    else researchByEpisode.set(item.episode_number, [item]);
  }
  function refetchBoth() {
    refetch();
    refetchResearch();
  }

  async function handleAddEpisode() {
    await mutate(
      (s) => StateLogic.addEpisode(s),
      () => api.addEpisode(leagueId!)
    );
  }

  return (
    <>
      <h2 className="mb-[18px] text-2xl font-bold tracking-tight">Episodes</h2>
      {/* Above the episode list on purpose: in a catch-up league this is the control that makes the
          next episode exist at all, so it belongs before the episodes it produces. Renders nothing
          for a league that isn't catching up. */}
      <CatchUpPanel state={state} onRevealed={refetchBoth} />
      {canManage && (
        <div className="mb-4">
          <Button onClick={handleAddEpisode}>+ Add New Episode</Button>
        </div>
      )}
      {sorted.length === 0 ? (
        <div className="text-sm italic text-muted-foreground">No episodes logged yet.</div>
      ) : (
        sorted.map((ep) => (
          <EpisodeCard
            key={ep.id}
            ep={ep}
            state={state}
            defaultOpen={ep.number === latestNumber}
            wikiItems={itemsByEpisode.get(ep.number)}
            researchItems={researchByEpisode.get(ep.number)}
            onWikiItemsChanged={refetchBoth}
          />
        ))
      )}
    </>
  );
}
