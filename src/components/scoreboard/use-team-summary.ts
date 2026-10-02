"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

// One fetch per league per episode, however many Scoreboard rows ask: every row shares the key.
// Null leagueId (mock/demo mode -- there's no server to ask) skips it.
export function useTeamSummary(leagueId: string | null, epId: string | null) {
  return useQuery({
    queryKey: ["team-summary", leagueId, epId],
    queryFn: () => api.episodeTeamSummary(leagueId!, epId!),
    enabled: !!leagueId && !!epId,
  });
}
