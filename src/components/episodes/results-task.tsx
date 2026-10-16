"use client";

import type { Episode } from "@/lib/game/types";
import { CaptionPlate } from "@/components/ui/caption-plate";
import { useResearchable, useResearchProgress, useResultsHref } from "@/lib/episode-results";

// The commissioner's weekly job as one plate: this episode has aired and nothing is recorded, so its
// results are theirs to fill in. The same plate leads the week on Episodes (week.tsx) and the
// episode's own page; the alert strip carries it everywhere else (action-items.js, "results").
//
// Shaped like catch-up's "Up next": the quiet commissioner tag (the status plate's), and the action as
// a chyron block on the plate's end -- the screen's one "now". `quiet` drops that block when something
// else on the screen already has it.
//
// It says how far along the job is: nothing yet ("Ask an AI chat, then paste"), some found but
// people still to ask about ("Finish the results · 2 found so far"), or everything found ("2 to check, then
// apply" -- the wiki, an admin's research or another league on the season got there first). Without a season to research, it's entered by hand: `onEnterByHand`
// opens the editor where the plate is already on the episode's page; elsewhere it links there.
export function ResultsTask({ ep, onEnterByHand, quiet }: { ep: Episode; onEnterByHand?: () => void; quiet?: boolean }) {
  const researchable = useResearchable();
  const href = useResultsHref(ep);
  const progress = useResearchProgress(researchable ? ep : null);
  const staged = progress?.staged ?? 0;
  const ready = staged > 0 && !progress?.toAsk;
  const byHand = !researchable && onEnterByHand;
  return (
    <div className="flex flex-col gap-2" data-tour="results-check">
      <CaptionPlate
        tone="quiet"
        tag="Commish"
        title={ready ? "Results are in" : staged ? "Finish the results" : "Fill in the results"}
        subtitle={
          ready
            ? `${staged} to check, then apply`
            : staged
              ? `${staged} found so far`
              : researchable
                ? "Ask an AI chat, then paste"
                : "Who left, and what scored"
        }
        action={ready ? "Check" : staged ? "Open" : "Start"}
        actionTone={quiet ? undefined : "chyron"}
        href={byHand ? undefined : (href ?? undefined)}
        onClick={byHand ? onEnterByHand : undefined}
      />
      <p className="text-[13px] leading-snug text-muted-foreground">
        Standings, picks and lineups move once you apply. Players still reveal it when they&rsquo;re ready.
      </p>
    </div>
  );
}
