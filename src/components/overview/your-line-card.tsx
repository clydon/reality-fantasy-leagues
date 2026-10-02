"use client";

import type { LeagueState } from "@/lib/game/types";
import { useLeagueStore, useMyPlayerId } from "@/lib/store";
import { latestScoredEpisode } from "@/lib/game/episode-team-summary";
import { useTeamSummary } from "@/components/scoreboard/use-team-summary";
import { DashCard, DashLink } from "./dash-card";

// The viewer's own team's "why it mattered" line for the latest episode -- the one the commissioner
// wrote from the Scoreboard. Only theirs: Overview is the personal page, and everyone's lines are on
// the Scoreboard a tap away. Nothing at all until there's a saved line, so no empty card. The
// episode is the latest one this viewer may see (state here is already spoiler-trimmed), and the
// fetch is the Scoreboard's own, shared through react-query.
export function YourLineCard({ state }: { state: LeagueState }) {
  const ep = latestScoredEpisode(state);
  const leagueId = useLeagueStore((s) => (s.mode === "live" ? s.leagueId : null));
  const myPlayerId = useMyPlayerId();
  const { data } = useTeamSummary(leagueId, ep?.id ?? null);
  const why = myPlayerId ? data?.notes[myPlayerId] : undefined;
  if (!ep || !why) return null;

  return (
    <DashCard title={`Your episode ${ep.number}`} wide>
      <p className="text-sm italic">&ldquo;{why}&rdquo;</p>
      <DashLink href="/scoreboard">Everyone&rsquo;s on the Scoreboard →</DashLink>
    </DashCard>
  );
}
