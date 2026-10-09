"use client";

import type { LeagueState, MidSeasonLogEntry } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { formatDateTime } from "@/lib/game/selectors";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { cn } from "cn";

const AVATAR = "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[2px] bg-muted text-[11px] font-bold [&_img]:object-top";

// Visual record of completed replenish assignments / trade swaps, most recent first -- who did
// what, with the castaways' own photos rather than a text log. Shared by ReplenishPanel and
// TradePanel, each passing just its own slice of state.midSeason.log (see ReplenishLogic.assign /
// TradeLogic.swap for where entries get appended, and lastCompletedEpisode for where `episode`
// comes from).
export function TransactionHistory({ state, entries }: { state: LeagueState; entries: MidSeasonLogEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <div className="mt-2 flex flex-col">
      <h4 className="mb-1 text-[13px] font-bold uppercase tracking-wide text-muted-foreground">History</h4>
      <ul className="border-b border-border">
        {[...entries]
          .reverse()
          .map((entry) => {
            const player = StateLogic.getPlayer(state, entry.playerId);
            const added = StateLogic.getCastaway(state, entry.addedCastawayId);
            const dropped = entry.droppedCastawayId ? StateLogic.getCastaway(state, entry.droppedCastawayId) : null;
            return (
              <li key={entry.id} className="flex min-h-14 items-center gap-2.5 border-t border-border">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: player?.color }} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-base font-semibold">{player?.name || "?"}</span>
                {dropped && (
                  <>
                    {/* Faded -- a replenish drop is always an elimination, so this reads the same
                        visual language as an eliminated card everywhere else in the app. A trade
                        drop wasn't eliminated (just dropped voluntarily), so it stays full-color. */}
                    <CastawayAvatar expandable
                      castaway={dropped}
                      className={cn(AVATAR, entry.type === "replenish" && "opacity-[.55] grayscale")}
                    />
                    <span className="text-sm text-muted-foreground" aria-label={entry.type === "trade" ? "swapped for" : "replaced by"}>
                      {entry.type === "trade" ? "⇄" : "→"}
                    </span>
                  </>
                )}
                {added && <CastawayAvatar expandable castaway={added} className={AVATAR} />}
                {typeof entry.episode === "number" ? (
                  <span className="w-12 shrink-0 text-right text-[13px] text-muted-foreground">Ep {entry.episode}</span>
                ) : (
                  // Entries from before `episode` existed (or made before anything had aired) fall
                  // back to their raw timestamp.
                  <span className="shrink-0 text-[11px] text-muted-foreground">{formatDateTime(entry.at)}</span>
                )}
              </li>
            );
          })}
      </ul>
    </div>
  );
}
