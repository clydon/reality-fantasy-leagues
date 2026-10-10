"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { useLeagueStore, useCanManage } from "@/lib/store";
import StateLogic from "@/lib/game/state-logic.js";
import { BottomSheet, SheetAction } from "@/components/ui/bottom-sheet";
import { cn } from "cn";
import { DraftComplete, EditPicks, LiveDraft, PreDraft } from "./snake-draft";
import { BlindDraftPanel, BlindReveal } from "./blind-draft-panel";

// The Draft page (docs/PLAN-ux-redesign.md, 2d), one layout per phase. Turn-based (exclusive
// ownership): before the start, the order and Start; live, who's on the clock and the free agents,
// picked by select-then-confirm; complete, every team. Blind (shared ownership): everyone picks
// privately, then everything reveals at once. A commissioner's Undraft sits behind ⋯ → Edit picks.
//
// The sidebar/mobile nav both hide this page for a league type with no roster (pickem), but the
// route is still reachable by URL, so it guards here too.
export function DraftBoard() {
  const state = useLeagueStore((s) => s.state);
  const canManage = useCanManage();
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  if (!StateLogic.getLeagueType(state).hasRoster) {
    return (
      <>
        <h2 className="type-caption mb-4 text-[28px] max-nav:hidden">Draft</h2>
        <p className="text-base text-muted-foreground">This league type has no draft. Picks are made from the Episodes tab.</p>
      </>
    );
  }

  const shared = state.settings.ownershipMode === "shared";
  const started = StateLogic.isDraftStarted(state);
  const turn = StateLogic.currentDraftTurn(state);
  const complete = !!(turn && turn.isComplete);
  const revealed = shared && StateLogic.BlindDraftLogic.isRevealed(state);

  let meta: string | null = null;
  if (!shared && started && turn && !turn.isComplete && turn.overallPickNumber) {
    const n = state.draftOrder.length || 1;
    meta = `Round ${Math.floor((turn.overallPickNumber - 1) / n) + 1} of ${StateLogic.rosterSize(state)}`;
  }
  // Undraft only exists for the turn-based draft: with shared ownership a castaway can be on several
  // teams and Undraft can't say whose (BlindDraftStrategy.undo is inert for the same reason).
  const hasMenu = canManage && !shared && started && !editing;

  return (
    <div className="flex flex-col gap-4">
      <div className={cn("flex min-h-11 items-center gap-3", !meta && !hasMenu && "max-nav:hidden")}>
        <h2 className="type-caption text-[28px] max-nav:hidden">Draft</h2>
        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{meta}</span>
        {hasMenu && (
          <button
            type="button"
            aria-label="Draft actions"
            className="flex size-11 shrink-0 items-center justify-center rounded-[3px] border border-border text-foreground hover:bg-accent focus-visible:outline-3 focus-visible:outline-chyron-line"
            onClick={() => setMenuOpen(true)}
          >
            <MoreHorizontal className="size-5" aria-hidden />
          </button>
        )}
      </div>

      {shared ? (
        revealed ? (
          <BlindReveal state={state} />
        ) : (
          <BlindDraftPanel state={state} />
        )
      ) : editing ? (
        <EditPicks state={state} onDone={() => setEditing(false)} />
      ) : !started ? (
        <PreDraft state={state} />
      ) : complete ? (
        <DraftComplete state={state} />
      ) : (
        <LiveDraft state={state} />
      )}

      <BottomSheet open={menuOpen} onOpenChange={setMenuOpen} title="Draft">
        <SheetAction
          onClick={() => {
            setMenuOpen(false);
            setEditing(true);
          }}
        >
          Edit picks
        </SheetAction>
      </BottomSheet>
    </div>
  );
}
