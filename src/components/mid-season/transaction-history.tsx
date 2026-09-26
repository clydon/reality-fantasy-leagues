"use client";

import type { LeagueState, MidSeasonLogEntry } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { formatDateTime } from "@/lib/game/selectors";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { cn } from "cn";

const AVATAR = "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-[0.65rem] font-bold";

// Visual record of completed replenish assignments / trade swaps, most recent first -- who did
// what, with the castaways' own photos rather than a text log. Shared by ReplenishPanel and
// TradePanel, each passing just its own slice of state.midSeason.log (see ReplenishLogic.assign /
// TradeLogic.swap for where entries get appended, and lastCompletedEpisode for where `episode`
// comes from).
export function TransactionHistory({ state, entries }: { state: LeagueState; entries: MidSeasonLogEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <div className="mt-4 border-t border-border pt-3">
      <h4 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">History</h4>
      <div className="flex flex-col gap-2">
        {[...entries]
          .reverse()
          .map((entry) => {
            const player = StateLogic.getPlayer(state, entry.playerId);
            const added = StateLogic.getCastaway(state, entry.addedCastawayId);
            const dropped = entry.droppedCastawayId ? StateLogic.getCastaway(state, entry.droppedCastawayId) : null;
            return (
              <div key={entry.id} className="flex items-center gap-2 rounded-md bg-secondary/40 px-2.5 py-2">
                <span className="min-w-0 flex-1 truncate text-xs font-semibold" style={{ color: player?.color }}>
                  {player?.name || "?"}
                </span>
                {dropped && (
                  <>
                    {/* Faded -- a replenish drop is always an elimination, so this reads the same
                        visual language as an eliminated card everywhere else in the app. A trade
                        drop wasn't eliminated (just dropped voluntarily), so it stays full-color. */}
                    <CastawayAvatar
                      castaway={dropped}
                      className={cn(AVATAR, entry.type === "replenish" && "opacity-[.55] saturate-[.75]")}
                    />
                    <span className="text-xs text-muted-foreground">{entry.type === "trade" ? "⇄" : "→"}</span>
                  </>
                )}
                {added && <CastawayAvatar castaway={added} className={AVATAR} />}
                {typeof entry.episode === "number" ? (
                  <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold">
                    Ep {entry.episode}
                  </span>
                ) : (
                  // Entries from before `episode` existed (or made before anything had aired) fall
                  // back to their raw timestamp.
                  <span className="shrink-0 text-[0.65rem] text-muted-foreground">{formatDateTime(entry.at)}</span>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
