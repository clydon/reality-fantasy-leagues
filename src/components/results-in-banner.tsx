"use client";

import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore } from "@/lib/store";

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
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4 text-sm shadow-sm">
      <span className="flex-1 text-muted-foreground">Results are in — reveal them to {what}.</span>
      <button className="rounded-md bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground hover:opacity-90" onClick={reveal}>
        Reveal results
      </button>
    </div>
  );
}

export function ResultsInBanner() {
  const { hidden, reveal } = useHiddenResults();
  if (hidden.length === 0) return null;
  const first = hidden[0].number;
  const last = hidden[hidden.length - 1].number;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border-2 border-primary bg-primary/10 px-4 py-3 shadow-sm">
      <span className="text-2xl" aria-hidden>
        📺
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-bold">Results are in!</div>
        <div className="text-xs text-muted-foreground">
          {first === last ? `Episode ${first}` : `Episodes ${first}–${last}`} — hidden until you&rsquo;re ready, so nothing
          gets spoiled.
        </div>
      </div>
      <button
        className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
        onClick={reveal}
      >
        Reveal results
      </button>
    </div>
  );
}
