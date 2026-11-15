"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, ChevronRight } from "lucide-react";
import { useAfterWatching, watching } from "../data";
import type { ShowData } from "../screens/show-space";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { showLabel } from "./react";

// TEMP-UI: the behind question's three looks, for the user's pick (2026-11-15; docs/design-round/decisions.md). Someone behind on
// an airing show has either watched it and not told the app (Joanna, who watches live with the couch) or is catching up; the app
// can't tell, so it asks once, both answers one tap. `?ask=a|b|c` picks the look; without it, the control is as built in step 3.
//   A · two answers in the control, in place of Reveal and Watch along: "I've seen Ep 5" and "Catching up".
//   B · the question is the control's line, two small answers beside it: "Seen Ep 4 and 5?" Yes / Not yet. No button row.
//   C · one quiet chip under the ruler, "Seen Ep 4 and 5?", opening a sheet: where you're up to, one tap each.
// "Still catching up" is remembered on this device until a new episode airs (a real build keeps it with your mark, on the server).

export type AskLook = "a" | "b" | "c";

export function useAskLook(): AskLook | null {
  const v = useSearchParams().get("ask");
  return v === "a" || v === "b" || v === "c" ? v : null;
}

const KEY = (seasonId: string) => `gys:catching-up:${seasonId}`;

/** "Still catching up", remembered for what's aired now: asked again once a new episode airs. */
export function useCatchingUp(seasonId: string, aired: number): [boolean, () => void] {
  const [at, setAt] = useState<number | null>(() => {
    try {
      const v = localStorage.getItem(KEY(seasonId));
      return v == null ? null : Number(v);
    } catch {
      return null;
    }
  });
  const later = () => {
    setAt(aired);
    try {
      localStorage.setItem(KEY(seasonId), String(aired));
    } catch {
      // No storage (a private window): it holds for this visit.
    }
  };
  return [at != null && at >= aired, later];
}

/** "Ep 4", "Ep 4 and 5", "Ep 4 to 7": what's out past your mark. */
export function outWords(ep: string, seen: number, latest: number): string {
  return latest - seen === 1 ? `${ep} ${latest}` : latest - seen === 2 ? `${ep} ${seen + 1} and ${latest}` : `${ep} ${seen + 1} to ${latest}`;
}

/** Moves of yours for an episode up to `n` that never came in (a game at your own pace): saying you've seen it closes them. */
function missedBy(show: ShowData, n: number): string[] {
  return show.moves
    .filter((m) => m.late && m.episode != null && m.episode <= n && (m.kind === "lineup" || m.kind === "pick"))
    .map((m) => `Your ${show.words.ep} ${m.episode} ${m.kind === "pick" ? "pick" : "lineup"} in ${m.leagueName} isn't in, so it counts as none.`);
}

/** Saying where you're up to: on a show you play, the reveal plays from the first you haven't seen; on one you watch, your mark
 *  moves (with Undo) and the reveal plays. The same writes as Up next's Watched sheet. */
function useSeen(show: ShowData, seasonId: string, play: boolean, first: number, onReveal: (n: number) => void) {
  const after = useAfterWatching();
  const [busy, setBusy] = useState(false);
  const go = async (to: number) => {
    if (play) return onReveal(first);
    if (busy) return;
    setBusy(true);
    try {
      await watching.follow(seasonId, { seenThrough: to });
      await after();
      toast(`You're up to ${show.words.episode} ${to}`, {
        undo: async () => {
          await watching.follow(seasonId, { seenThrough: first - 1 });
          await after();
        },
      });
      onReveal(to);
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { go, busy };
}

/** A and B's one check before anything shows: what plays, and any move it closes. */
export function AskConfirm({ open, onOpenChange, show, seasonId, seen, latest, play, first, onReveal }: { open: boolean; onOpenChange: (o: boolean) => void; show: ShowData; seasonId: string; seen: number; latest: number; play: boolean; first: number; onReveal: (n: number) => void }) {
  const { go, busy } = useSeen(show, seasonId, play, first, onReveal);
  const ep = show.words.ep;
  const missed = missedBy(show, latest);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={`Seen up to ${ep} ${latest}?`} subtitle={showLabel(show)}>
      <div data-ask-confirm className="flex flex-col gap-2">
        <p className="text-[15px] leading-normal text-muted-foreground">
          {play ? `${outWords(ep, seen, latest)}'s results play next, every game at once.` : `What happened, the couch's chat and their GIFs for ${outWords(ep, seen, latest)} will show.`}
        </p>
        {missed.map((m) => (
          <p key={m} className="text-[15px] leading-normal">
            {m}
          </p>
        ))}
        <Btn
          tone="ink"
          wide
          className="mt-2"
          data-ask-confirm-yes
          disabled={busy}
          onClick={async () => {
            onOpenChange(false);
            await go(latest);
          }}
        >
          Yes, show me
        </Btn>
        <Btn wide data-ask-confirm-no onClick={() => onOpenChange(false)}>
          Not yet
        </Btn>
      </div>
    </Sheet>
  );
}

/** C's sheet: where you're up to, each episode one row, the latest picked; staying put is the last row. */
export function AskPicker({ open, onOpenChange, show, seasonId, seen, latest, play, first, onReveal, onLater }: { open: boolean; onOpenChange: (o: boolean) => void; show: ShowData; seasonId: string; seen: number; latest: number; play: boolean; first: number; onReveal: (n: number) => void; onLater: () => void }) {
  const { go, busy } = useSeen(show, seasonId, play, first, onReveal);
  const ep = show.words.ep;
  const [to, setTo] = useState(latest);
  const rows = Array.from({ length: latest - seen }, (_, i) => latest - i);
  const missed = to > seen ? missedBy(show, to) : [];
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Where are you up to?" subtitle={`${showLabel(show)} · you're through ${ep} ${seen}`}>
      <div data-ask-picker role="radiogroup" aria-label="Where you're up to" className="flex flex-col">
        {[...rows, seen].map((n) => {
          const on = to === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={on}
              data-ask-pick={n}
              onClick={() => setTo(n)}
              className="flex min-h-[56px] items-center gap-3 border-t border-border py-2 text-left first:border-t-0"
            >
              <span className={`grid size-6 flex-none place-items-center rounded-full ${on ? "bg-foreground text-background" : "outline-2 -outline-offset-2 outline-edge"}`} aria-hidden>
                {on && <Check className="size-4" strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-[16px] font-semibold">{n === seen ? `Still on ${ep} ${seen}` : `Seen ${ep} ${n}`}</b>
                <small className="block text-[14px] text-muted-foreground">{n === seen ? "Catching up: nothing past it shows" : n === latest ? "The latest" : `${ep} ${latest} still to watch`}</small>
              </span>
            </button>
          );
        })}
      </div>
      {missed.map((m) => (
        <p key={m} className="mt-2 text-[15px] leading-normal">
          {m}
        </p>
      ))}
      <Btn
        tone="ink"
        wide
        className="mt-3"
        data-ask-picker-go
        disabled={busy}
        onClick={async () => {
          onOpenChange(false);
          if (to === seen) return onLater();
          await go(to);
        }}
      >
        {to === seen ? "Keep me spoiler-safe" : play ? `Show me ${outWords(ep, seen, to)}` : `I've seen ${ep} ${to}`}
      </Btn>
    </Sheet>
  );
}

/** The chip C puts under the ruler. */
export function AskChip({ label, primary, onClick }: { label: string; primary: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      data-ask-open
      onClick={onClick}
      className={`nd-press mt-2 inline-flex h-11 items-center gap-1.5 rounded-[4px] pl-3.5 pr-2.5 text-[15px] font-bold ${
        primary ? "bg-chyron text-chyron-foreground" : "bg-[rgba(16,14,21,.6)] text-white outline-[1.5px] -outline-offset-[1.5px] outline-white/60 backdrop-blur-sm"
      }`}
    >
      {label}
      <ChevronRight className="size-[18px]" aria-hidden />
    </button>
  );
}
