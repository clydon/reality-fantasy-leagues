import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { DashCard, DashBig, DashLink } from "./dash-card";

// Direct port of renderOverview()'s "Latest Episode" card (public/app.js). Same
// ensureUpcomingEpisode gotcha noted there: filter to episodes with events before taking the
// highest number, since there's always a trailing empty "upcoming" episode.
export function LatestEpisodeCard({ state }: { state: LeagueState }) {
  const latestEp = [...state.episodes]
    .filter((ep) => ep.events.length > 0)
    .sort((a, b) => b.number - a.number)[0];

  return (
    <DashCard title="Latest Episode">
      {latestEp ? (
        <>
          <DashBig>Ep {latestEp.number}</DashBig>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {latestEp.events.length === 0
              ? "No eliminations logged yet."
              : latestEp.events
                  .map((ev) => StateLogic.getCastaway(state, ev.castawayId)?.name || "?")
                  .join(", ")}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No episodes logged yet.</p>
      )}
      {latestEp && <DashLink href="/episodes">Log this week →</DashLink>}
    </DashCard>
  );
}
