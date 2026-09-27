import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { CastawayStatCard } from "@/components/castaway-stat-card";
import { DashCard, DashBig } from "./dash-card";

// Direct port of renderOverview()'s "Latest Episode" card (public/app.js). Same
// ensureUpcomingEpisode gotcha noted there: filter to episodes with events before taking the
// highest number, since there's always a trailing empty "upcoming" episode. Shows who left as their
// player cards rather than a list of names.
export function LatestEpisodeCard({ state }: { state: LeagueState }) {
  const latestEp = [...state.episodes]
    .filter((ep) => ep.events.length > 0)
    .sort((a, b) => b.number - a.number)[0];
  const out = latestEp
    ? latestEp.events.map((ev) => StateLogic.getCastaway(state, ev.castawayId)).filter((c): c is NonNullable<typeof c> => !!c)
    : [];

  return (
    <DashCard title="Latest Episode">
      {latestEp ? (
        <>
          <DashBig>
            Ep {latestEp.number}
            {latestEp.title && <span className="ml-1.5 text-base font-normal text-muted-foreground">{latestEp.title}</span>}
          </DashBig>
          <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2.5">
            {out.map((c) => {
              const owners = c.ownerIds
                .map((id) => StateLogic.getPlayer(state, id))
                .filter((p): p is NonNullable<typeof p> => !!p);
              return <CastawayStatCard key={c.id} state={state} castaway={c} owners={owners} showPoints={false} expanded={false} />;
            })}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No episodes logged yet.</p>
      )}
    </DashCard>
  );
}
