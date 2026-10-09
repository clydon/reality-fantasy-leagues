"use client";

import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore } from "@/lib/store";
import { CaptionPlate } from "@/components/ui/caption-plate";

// Spoiler protection's one control: new episode results are held back from each member
// (StateLogic.SpoilerLogic) until they tap this. Only there once there's something to reveal --
// and it stays, on every page, until they do, so results can never be hidden for longer than
// someone means them to be. Opting out is in Account settings.
/** Episodes whose results the viewer hasn't revealed, and the one-tap reveal for all of them. */
export function useHiddenResults() {
  const mode = useLeagueStore((s) => s.mode);
  const fullState = useLeagueStore((s) => s.fullState);
  const seen = useLeagueStore((s) => s.membership?.resultsSeenThrough);
  const markResultsSeen = useLeagueStore((s) => s.markResultsSeen);
  const hidden = mode === "live" ? StateLogic.SpoilerLogic.hiddenEpisodes(fullState, seen) : [];
  const last = hidden.length ? hidden[hidden.length - 1].number : null;
  return { hidden, reveal: () => last !== null && markResultsSeen(last) };
}

/** In place of a lineup/pick grid while results are hidden: last week's choice is already over, and
 *  this week's depends on who went home -- so reveal first. */
export function RevealFirst({ what }: { what: string }) {
  const { reveal } = useHiddenResults();
  return <CaptionPlate size="sm" tag="First" title="Reveal the results" subtitle={`Then ${what}.`} action="Reveal" onClick={reveal} />;
}

export function ResultsInBanner() {
  const { hidden, reveal } = useHiddenResults();
  if (hidden.length === 0) return null;
  const first = hidden[0].number;
  const last = hidden[hidden.length - 1].number;
  const which = first === last ? `Episode ${first}` : `Episodes ${first}–${last}`;

  // Direction A: the reveal prompt is a caption plate, like the alert strip. Not watched yet? It
  // simply stays until they tap it.
  return (
    <CaptionPlate
      className="mb-4"
      tag="New"
      title={first === last ? `${which} results are in` : `${which} are in`}
      subtitle="Hidden until you reveal. No spoilers."
      action="Reveal"
      onClick={reveal}
      aria-label={`Reveal ${which} results`}
    />
  );
}
