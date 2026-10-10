"use client";

import { useQuery } from "@tanstack/react-query";
import type { Episode, EpisodeResearchPanel, LeagueState, ResearchApplySummary } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { api } from "@/lib/api";
import { useCanManage, useLeagueStore } from "@/lib/store";
import { useShowCatalog } from "@/lib/use-show-terms";
import { useTourStore } from "@/lib/tour/tour-store";
import { applyTourResults, tourPanel } from "@/lib/tour/commissioner";

// Where a commissioner's episode results come from (docs/PLAN-episode-research-compiled-cache.md):
// research staged once per season, then each commissioner checks it and applies it to their own
// league. That's the weekly job on a league-decided season (show_seasons.results_by = 'leagues'); on
// an admin-decided one results arrive on their own and nobody here applies anything.
//
// One shape, two sources: a live league talks to the research routes; the commissioner's guided tour
// serves its scripted Episode 1 (tour/commissioner.ts) through the same page.

export interface ApplyItem {
  id: string;
  kind: EpisodeResearchPanel["staged"][number]["kind"];
  castawayName: string;
  method: string;
  eventType: string;
}

export interface ResultsSource {
  load: (ep: Episode) => Promise<EpisodeResearchPanel>;
  submit: (ep: Episode, notes: string) => Promise<EpisodeResearchPanel>;
  apply: (ep: Episode, items: ApplyItem[]) => Promise<{ state: LeagueState; applied: ResearchApplySummary }>;
}

/** The source for this league, or null where research can't run (a demo season). */
export function useResultsSource(): ResultsSource | null {
  const mode = useLeagueStore((s) => s.mode);
  const touring = useLeagueStore((s) => s.touring);
  const leagueId = useLeagueStore((s) => s.leagueId);
  if (mode === "live" && leagueId) {
    return {
      load: (ep) => api.episodeResearch(leagueId, ep.id),
      submit: (ep, notes) => api.submitEpisodeResearch(leagueId, ep.id, notes),
      apply: (ep, items) =>
        api.applyEpisodeResearch(
          leagueId,
          ep.id,
          items.map(({ id, castawayName, method, eventType }) => ({ id, castawayName, method, eventType }))
        ),
    };
  }
  if (touring) {
    const full = () => useLeagueStore.getState().fullState;
    return {
      load: async (ep) => tourPanel(full(), ep.number, useTourStore.getState().staged[ep.number] ?? []),
      submit: async (ep) => tourPanel(full(), ep.number, useTourStore.getState().staged[ep.number] ?? []),
      apply: async (ep, items) => {
        const state = full();
        const applied = applyTourResults(state, ep.number, items);
        return { state, applied };
      },
    };
  }
  return null;
}

/** Whether this league's results are its commissioner's to apply: a league-decided season it's linked
 *  to, or the commissioner's tour. */
export function useResultsAreMine(): boolean {
  const state = useLeagueStore((s) => s.state);
  const mode = useLeagueStore((s) => s.mode);
  const touring = useLeagueStore((s) => s.touring);
  const tourKind = useTourStore((s) => s.kind);
  const { data } = useShowCatalog();
  if (touring) return tourKind === "commissioner";
  if (mode !== "live" || state.settings.wikiSeason == null) return false;
  const season = data?.shows.find((s) => s.slug === state.settings.showId)?.seasons.find((s) => s.seasonNumber === state.settings.wikiSeason);
  return season?.resultsBy === "leagues";
}

/** The episode a commissioner should fill in next: the earliest one in play that has aired (or has no
 *  schedule) and has no results yet. Null for anyone else, or when nothing's waiting. `now` is
 *  episode-status.ts's useNowMinute (null before the client has a clock). */
export function useResultsDue(now: number | null): Episode | null {
  const state = useLeagueStore((s) => s.state);
  const canManage = useCanManage();
  const mine = useResultsAreMine();
  const touring = useLeagueStore((s) => s.touring);
  // The tour's episodes have no schedule: one "airs" when its results are staged.
  const tourStaged = useTourStore((s) => s.staged);
  if (!canManage || !mine || now === null) return null;
  return (
    [...state.episodes]
      .sort((a, b) => a.number - b.number)
      .find(
        (ep) =>
          StateLogic.inPlay(state, ep.number) &&
          !ep.resultsHidden &&
          !StateLogic.episodeHasResults(ep) &&
          !(ep.airsAt && Date.parse(ep.airsAt) > now) &&
          (!touring || !!tourStaged[ep.number])
      ) ?? null
  );
}

/** How many of an episode's staged results aren't in the league yet (null while unknown). */
export function useStagedCount(ep: Episode | null): number | null {
  const source = useResultsSource();
  const touring = useLeagueStore((s) => s.touring);
  const tourStaged = useTourStore((s) => (ep ? s.staged[ep.number] : undefined));
  const leagueId = useLeagueStore((s) => s.leagueId);
  const { data } = useQuery({
    queryKey: ["episode-research", leagueId, ep?.id],
    queryFn: () => source!.load(ep!),
    enabled: !touring && !!source && !!ep,
    staleTime: 60 * 1000,
  });
  if (!ep) return null;
  if (touring) return tourStaged ? tourStaged.length : 0;
  return data ? data.staged.filter((d) => !d.inLeague && d.status !== "rejected").length : null;
}
