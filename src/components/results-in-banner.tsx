"use client";

import { useRouter } from "next/navigation";
import { create } from "zustand";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore } from "@/lib/store";
import { CaptionPlate } from "@/components/ui/caption-plate";
import { BottomSheet } from "@/components/ui/bottom-sheet";

// Spoiler protection's one control: new episode results are held back from each member
// (StateLogic.SpoilerLogic) until they choose to see them. The prompt is only there once there's
// something to reveal -- and it stays, on every page, until they do, so results can never be hidden
// for longer than someone means them to be. Opting out is in Account settings.
//
// Every Reveal in the app (this plate, an Episodes row, the episode page, "reveal first", chat) asks
// the same question in one sheet -- "Reveal Episode 3?", Not yet or Reveal -- and Reveal plays the
// reveal (/reveal/N, reveal-moment.tsx), which is what marks the results seen. The canvas's "A ·
// Spoilers & reveal" page (docs/PLAN-ux-redesign.md).

const useRevealSheet = create<{ through: number | null; ask: (through: number) => void; close: () => void }>((set) => ({
  through: null,
  ask: (through) => set({ through }),
  close: () => set({ through: null }),
}));

/** Episodes whose results the viewer hasn't revealed, and `reveal`, which asks before revealing
 *  them (through `through`, else all of them). */
export function useHiddenResults() {
  const mode = useLeagueStore((s) => s.mode);
  const fullState = useLeagueStore((s) => s.fullState);
  const seen = useLeagueStore((s) => s.membership?.resultsSeenThrough);
  const ask = useRevealSheet((s) => s.ask);
  const hidden = mode === "live" ? StateLogic.SpoilerLogic.hiddenEpisodes(fullState, seen) : [];
  const last = hidden.length ? hidden[hidden.length - 1].number : null;
  return { hidden, reveal: (through?: number) => last !== null && ask(through ?? last) };
}

/** "Episode 3" or "Episodes 2–3". */
export function episodesLabel(first: number, last: number) {
  return first === last ? `Episode ${first}` : `Episodes ${first}–${last}`;
}

/** In place of a lineup/pick grid while results are hidden: last week's choice is already over, and
 *  this week's depends on who went home -- so reveal first. */
export function RevealFirst({ what }: { what: string }) {
  const { reveal } = useHiddenResults();
  return <CaptionPlate size="sm" tag="First" title="Reveal the results" subtitle={`Then ${what}.`} action="Reveal" onClick={() => reveal()} />;
}

export function ResultsInBanner() {
  const { hidden, reveal } = useHiddenResults();
  if (hidden.length === 0) return null;
  const first = hidden[0].number;
  const last = hidden[hidden.length - 1].number;
  const which = episodesLabel(first, last);

  // Direction A: the reveal prompt is a caption plate, like the alert strip. Not watched yet? It
  // simply stays until they tap it.
  return (
    <CaptionPlate
      className="mb-4"
      tag={first === last ? `Ep ${first}` : "New"}
      title={first === last ? `${which} is in` : `${which} are in`}
      subtitle="Hidden until you're ready."
      action="Reveal"
      onClick={() => reveal()}
      aria-label={`Reveal ${which} results`}
    />
  );
}

/** The one "Reveal Episode 3?" sheet, mounted once in AuthGate's shell. */
export function RevealSheet() {
  const router = useRouter();
  const through = useRevealSheet((s) => s.through);
  const close = useRevealSheet((s) => s.close);
  const { hidden } = useHiddenResults();
  const first = hidden[0]?.number ?? null;
  // Asked through an episode that has since been revealed (another tab, a poll): nothing to ask.
  const open = through !== null && first !== null && through >= first;
  const which = open ? episodesLabel(first!, through!) : "";

  return (
    <BottomSheet open={open} onOpenChange={(o) => !o && close()} title={`Reveal ${which}?`} hideCancel>
      <p className="mb-4 text-[15px] leading-snug text-muted-foreground">
        You&rsquo;ll see who went home, what everyone scored and the new standings. You can&rsquo;t hide {first === through ? "it" : "them"} again.
      </p>
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={close}
          className="min-h-12 flex-1 rounded-[3px] border border-input bg-card text-[15px] font-bold text-foreground hover:bg-muted focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line"
        >
          Not yet
        </button>
        <button
          type="button"
          onClick={() => {
            const n = through!;
            close();
            router.push(`/reveal/${n}`);
          }}
          className="min-h-12 flex-[1.4] rounded-[3px] bg-chyron text-[15px] font-bold text-chyron-foreground transition-[filter] hover:brightness-[1.06] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line"
        >
          Reveal
        </button>
      </div>
    </BottomSheet>
  );
}
