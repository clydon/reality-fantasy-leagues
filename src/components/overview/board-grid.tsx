import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { initials, medalFor, MEDAL_EMOJI } from "@/lib/game/selectors";
import { cn } from "cn";

// Direct port of renderBoardGrid() (public/app.js) -- grouped by tribe, one card per castaway
// showing current/former owner and elimination medal/order.
export function BoardGrid({ state }: { state: LeagueState }) {
  const groups = [{ id: null as string | null, name: "Unassigned", color: "#4a5245" }, ...state.tribes];

  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => {
        const members = state.castaways.filter((c) => (c.tribeId || null) === g.id);
        if (members.length === 0) return null;
        return (
          <div key={g.id ?? "unassigned"}>
            <h3
              className="mb-2 rounded-md px-3 py-1.5 text-sm font-bold text-white"
              style={{ background: g.color }}
            >
              {g.name}
            </h3>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-3">
              {members.map((c) => {
                const owner = c.ownerId ? StateLogic.getPlayer(state, c.ownerId) : null;
                const formerOwner = !owner && c.formerOwnerId ? StateLogic.getPlayer(state, c.formerOwnerId) : null;
                const medal = c.status === "eliminated" ? medalFor(state, c.placementOrder) : null;
                return (
                  <div
                    key={c.id}
                    className={cn(
                      "relative flex flex-col items-center gap-1 rounded-lg border-2 bg-card p-2.5 text-center shadow-sm",
                      c.status === "eliminated" && !medal && "opacity-60"
                    )}
                    style={{ borderColor: owner ? owner.color : "transparent" }}
                  >
                    {c.status === "eliminated" &&
                      (medal ? (
                        <div className="absolute -left-1.5 -top-1.5 text-lg" title={medal}>
                          {MEDAL_EMOJI[medal]}
                        </div>
                      ) : (
                        <div className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground text-[0.65rem] font-bold text-background">
                          {c.placementOrder}
                        </div>
                      ))}
                    {/* Cast photos aren't ported as assets in this POC (see README) -- initials only, unlike the live app's photoUrl images. */}
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-secondary text-sm font-bold">
                      {initials(c.name)}
                    </div>
                    <div className="text-xs font-medium leading-tight">{c.name}</div>
                    {owner && (
                      <div className="rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold text-white" style={{ background: owner.color }}>
                        {owner.name}
                      </div>
                    )}
                    {formerOwner && (
                      <div
                        className="text-[0.65rem] text-muted-foreground line-through"
                        title={c.departedVia === "trade" ? "Swapped away" : "Replenished away"}
                      >
                        {formerOwner.name}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
