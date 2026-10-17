"use client";

import { useQuery } from "@tanstack/react-query";
import type { Episode, EpisodeResearchPanel, LeagueState, ResearchApplySummary } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { api } from "@/lib/api";
import { useCanManage, useLeagueStore } from "@/lib/store";
import { useTourStore } from "@/lib/tour/tour-store";
import { applyTourResults, stageResults, tourPanel } from "@/lib/tour/commissioner";

// Where a commissioner's episode results come from (docs/PLAN-episode-research-compiled-cache.md):
// research staged once per season, then each commissioner checks it and applies it to their own
// league. Filling in results is every commissioner's weekly job by default -- an admin on an
// admin-decided season (or, one day, paid automation) may simply get there first, and then nothing is
// due. Research needs the league's show and season; without them results are entered by hand.
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
  /** `again`: the question asks about everyone, to research the episode again and fill gaps. */
  load: (ep: Episode, again?: boolean) => Promise<EpisodeResearchPanel>;
  submit: (ep: Episode, notes: string, again?: boolean) => Promise<EpisodeResearchPanel>;
  apply: (ep: Episode, items: ApplyItem[]) => Promise<{ state: LeagueState; applied: ResearchApplySummary }>;
}

/** The source for this league, or null where research can't run (a demo season). */
export function useResultsSource(): ResultsSource | null {
  const mode = useLeagueStore((s) => s.mode);
  const touring = useLeagueStore((s) => s.touring);
  const leagueId = useLeagueStore((s) => s.leagueId);
  if (mode === "live" && leagueId) {
    return {
      load: (ep, again) => api.episodeResearch(leagueId, ep.id, again),
      submit: (ep, notes, again) => api.submitEpisodeResearch(leagueId, ep.id, notes, again),
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
      load: async (ep) => tourPanel(full(), ep.number, useTourStore.getState().staged[ep.number]),
      // Reading the pasted answer is what "finds" the results: they're staged, and only applying scores them.
      submit: async (ep) => {
        const t = useTourStore.getState();
        useTourStore.setState({ staged: { ...t.staged, [ep.number]: t.staged[ep.number] ?? stageResults(ep.number) } });
        return tourPanel(full(), ep.number, useTourStore.getState().staged[ep.number]);
      },
      apply: async (ep, items) => {
        const state = full();
        const applied = applyTourResults(state, ep.number, items);
        return { state, applied };
      },
    };
  }
  return null;
}

/** Whether this commissioner can fill in results from research (the copy-and-paste page): a live
 *  league with a show and season to ask about, or the commissioner's tour. Otherwise it's by hand. */
export function useResearchable(): boolean {
  const settings = useLeagueStore((s) => s.state.settings);
  const mode = useLeagueStore((s) => s.mode);
  const touring = useLeagueStore((s) => s.touring);
  const tourKind = useTourStore((s) => s.kind);
  if (touring) return tourKind === "commissioner";
  return mode === "live" && !!settings.showId && settings.wikiSeason != null;
}

/** Where this commissioner fills in an episode's results: research, else the episode's own page. */
export function useResultsHref(ep: Episode | null): string | null {
  const researchable = useResearchable();
  if (!ep) return null;
  return researchable ? `/episodes/${ep.number}/research` : `/episodes/${ep.number}`;
}

/** The episode a commissioner should fill in next: the earliest one in play that has aired (or has no
 *  schedule) and has no results yet -- the alert strip's rule (action-items.js resultsDueEpisode), plus
 *  unscheduled leagues, whose episodes never say they've aired. Null for anyone else, in a catching-up
 *  league (results come with the reveal), or when nothing's waiting. `now` is episode-status.ts's
 *  useNowMinute (null before the client has a clock). */
export function useResultsDue(now: number | null): Episode | null {
  const state = useLeagueStore((s) => s.state);
  const canManage = useCanManage();
  const mode = useLeagueStore((s) => s.mode);
  const touring = useLeagueStore((s) => s.touring);
  const tourKind = useTourStore((s) => s.kind);
  const mine = touring ? tourKind === "commissioner" : mode === "live";
  if (!canManage || !mine || now === null || StateLogic.RevealLogic.isCatchingUp(state)) return null;
  return (
    [...state.episodes]
      .sort((a, b) => a.number - b.number)
      .find(
        (ep) =>
          StateLogic.inPlay(state, ep.number) &&
          !ep.resultsHidden &&
          !StateLogic.episodeHasResults(ep) &&
          !(ep.airsAt && Date.parse(ep.airsAt) > now) &&
          // The tour's episodes have no schedule: one "airs" when everyone's lineup has locked.
          (!touring || ep.lineupsLocked)
      ) ?? null
  );
}

/** Where an episode's research stands for this league: how many staged results aren't in it yet, and
 *  whether there's still anyone to ask about (a question to copy). Null while unknown. */
export function useResearchProgress(ep: Episode | null): { staged: number; toAsk: boolean } | null {
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
  if (touring) return { staged: tourStaged ? tourStaged.length : 0, toAsk: !tourStaged };
  return data ? { staged: data.staged.filter((d) => !d.inLeague && d.status !== "rejected").length, toAsk: !!data.prompt } : null;
}

/** How many of an episode's staged results aren't in the league yet (null while unknown). */
export function useStagedCount(ep: Episode | null): number | null {
  return useResearchProgress(ep)?.staged ?? null;
}
