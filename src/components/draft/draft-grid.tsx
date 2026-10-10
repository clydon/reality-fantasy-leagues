"use client";

import { PageBackLink } from "@/components/back-link";
import { useLeagueStore, useMyPlayerId } from "@/lib/store";
import StateLogic from "@/lib/game/state-logic.js";
import { cn } from "cn";
import { EmptySlot, PhotoSquare } from "./draft-ui";
import { playersInDraftOrder } from "./draft-helpers";

// The draft board, /draft/board (the canvas's "Draft board, 13 rounds"): one column per player in
// draft order, one row per round, each player's picks filling their column and the picks still to
// come as numbered empty slots. Every player picks once a round, so a column's Nth photo is their
// Nth-round pick by count; the order within the column is the cast's, since the app doesn't record
// which round each pick was made in.
export function DraftGrid() {
  const state = useLeagueStore((s) => s.state);
  const me = useMyPlayerId();
  const shared = state.settings.ownershipMode === "shared";
  const size = StateLogic.rosterSize(state);
  const order = state.draftOrder;
  const n = order.length;
  const turn = StateLogic.currentDraftTurn(state);
  const current = turn && !turn.isComplete ? turn.overallPickNumber : null;
  const players = playersInDraftOrder(state).filter((p) => order.includes(p.id));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 max-nav:hidden">
        <PageBackLink />
        <h2 className="type-caption text-[28px]">Draft board</h2>
      </div>

      {shared || !StateLogic.getLeagueType(state).hasRoster || n === 0 ? (
        <p className="text-base text-muted-foreground">
          {shared ? "A blind draft has no board: everyone picks at once. The teams are on the Draft page." : "There's no draft board for this league."}
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {size} rounds, snake order. {current ? `Pick ${current} is on the clock.` : "The draft is complete."}
          </p>
          <div className="-mx-4 overflow-x-auto px-4 nav:mx-0 nav:px-0">
            <table className="w-full min-w-max border-collapse">
              <thead>
                <tr>
                  <th className="w-8" aria-label="Round" />
                  {players.map((p) => (
                    <th key={p.id} scope="col" className="px-0.5 pb-2 text-center align-bottom">
                      <span className="flex flex-col items-center gap-1">
                        <span className="size-2 rounded-full" style={{ background: p.color }} aria-hidden />
                        <span className={cn("max-w-16 truncate text-xs font-bold", p.id === me ? "text-foreground" : "text-muted-foreground")}>
                          {p.id === me ? "You" : p.name.split(" ")[0]}
                        </span>
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: size }, (_, r) => (
                  <tr key={r} className="border-t border-border">
                    <th scope="row" className="type-num w-8 text-left text-[15px] text-muted-foreground">
                      R{r + 1}
                    </th>
                    {players.map((p) => {
                      const pick = StateLogic.originalDraftPicks(state, p.id)[r];
                      const pos = order.indexOf(p.id);
                      const number = r * n + (r % 2 === 0 ? pos : n - 1 - pos) + 1;
                      return (
                        <td key={p.id} className="h-11 px-0.5 text-center">
                          <span className="inline-flex align-middle">
                            {pick ? (
                              <PhotoSquare castaway={pick} size={38} expandable faded={pick.status === "eliminated"} />
                            ) : number === current ? (
                              <span className="flex size-[38px] items-center justify-center rounded-[3px] border-2 border-chyron-line text-[11px] font-bold text-foreground">
                                {number}
                              </span>
                            ) : (
                              <EmptySlot size={38}>{number}</EmptySlot>
                            )}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
