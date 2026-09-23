import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { initials, medalFor, MEDAL_EMOJI } from "@/lib/game/selectors";
import { cn } from "cn";

// Direct port of renderBoardGrid() (public/app.js) -- grouped by tribe, one card per castaway
// showing current/former owner and elimination medal/order. Values below (64px avatar, the
// order-badge's exact size/position, the owner-tag being plain text not a pill, etc.) are copied
// from public/styles.css's .card/.tribe-block rules, not approximated -- an earlier version of
// this component got several of these wrong (badge on the wrong corner/color, owner-tag styled
// as a colored pill, no xmark overlay at all) after a side-by-side screenshot comparison against
// the live app surfaced them.
export function BoardGrid({ state }: { state: LeagueState }) {
  const groups = [{ id: null as string | null, name: "Unassigned", color: "#4a5245" }, ...state.tribes];

  return (
    <div className="flex flex-col gap-6">
      {groups.map((g) => {
        const members = state.castaways.filter((c) => (c.tribeId || null) === g.id);
        if (members.length === 0) return null;
        return (
          <div key={g.id ?? "unassigned"}>
            <h3
              className="mb-0 inline-block rounded-md px-[13px] py-1.5 text-[0.78rem] uppercase tracking-[1px] text-white"
              style={{ background: g.color }}
            >
              {g.name}
            </h3>
            <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(126px,1fr))] gap-3">
              {members.map((c) => {
                // Shared-ownership leagues can have several owners per castaway, so this reads the
                // whole list rather than just ownerIds[0]. The card's border colour still uses the
                // first owner (a border can only be one colour), but every owner is named below it.
                const owners = c.ownerIds
                  .map((id) => StateLogic.getPlayer(state, id))
                  .filter((p): p is NonNullable<typeof p> => !!p);
                const owner = owners[0] ?? null;
                const formerOwner = !owner && c.formerOwnerId ? StateLogic.getPlayer(state, c.formerOwnerId) : null;
                const medal = c.status === "eliminated" ? medalFor(state, c.placementOrder) : null;
                const eliminatedNoMedal = c.status === "eliminated" && !medal;
                return (
                  <div
                    key={c.id}
                    className={cn(
                      "relative rounded-[10px] border-2 bg-card p-[12px_10px_10px] text-center shadow-sm transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-md",
                      eliminatedNoMedal && "opacity-[.55] saturate-[.75] hover:opacity-80"
                    )}
                    style={{ borderColor: owner ? owner.color : "var(--border)" }}
                  >
                    {c.status === "eliminated" &&
                      (medal ? (
                        <div
                          className="absolute right-[5px] top-[5px] flex h-[27px] w-[27px] items-center justify-center text-[1.1rem]"
                          title={medal}
                        >
                          {MEDAL_EMOJI[medal]}
                        </div>
                      ) : (
                        <>
                          <div className="absolute right-[5px] top-[5px] flex h-[22px] w-[22px] items-center justify-center rounded-full bg-destructive font-mono text-[0.66rem] font-bold text-white shadow-[0_1px_3px_rgba(0,0,0,.25)]">
                            {c.placementOrder}
                          </div>
                          <div
                            className="pointer-events-none absolute inset-0 flex items-center justify-center text-[2.5rem] font-black text-destructive opacity-85"
                            aria-hidden
                          >
                            ✕
                          </div>
                        </>
                      ))}
                    {/* Cast photos aren't ported as assets in this POC (see README) -- initials only, unlike the live app's photoUrl images. */}
                    <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-[14px] border border-border bg-secondary font-mono text-[1.05rem] font-bold text-muted-foreground">
                      {initials(c.name)}
                    </div>
                    <div className="text-[0.84rem] font-semibold text-foreground">{c.name}</div>
                    {owners.length > 0 && (
                      <div className="mt-[3px] text-[0.7rem] font-semibold text-muted-foreground">
                        {owners.map((o) => o.name).join(", ")}
                      </div>
                    )}
                    {formerOwner && (
                      <div
                        className="mt-[3px] text-[0.7rem] font-semibold text-muted-foreground line-through"
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
