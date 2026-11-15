"use client";

import { useState } from "react";
import { useAfterWatching, watching } from "../data";
import type { ShowData } from "../screens/show-space";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { showLabel } from "./react";

// The behind question (the user's pick B, 2026-11-15; docs/design-round/decisions.md; the mocks:
// https://claude.ai/artifact/2fSx1kXCBdjnTopGoXkwn2). Someone behind on an airing show has either watched it and not told the app
// (Joanna watches live with the couch) or is catching up; the app can't tell, so the progress control's line asks "Seen Ep 4 and
// 5?" with Yes and Not yet beside it, both one tap. Yes asks once more here (the spoiler guard) and says what it closes; Not yet is
// remembered until a new episode airs. Seeing only some of what's out goes through your mark's door (Where you are).
// Not yet is kept with your mark on the server (show_follows.not_yet, the same column as Live's "Not yet" on a show you watch),
// so a second phone of yours doesn't ask again.

/** "Still catching up", remembered for what's aired now (`notYet`, the show's read): asked again once a new episode airs. The
 *  answer shows at once and is saved behind it; a save that fails says so and asks again. */
export function useCatchingUp(seasonId: string, aired: number, notYet: number | null): [boolean, () => void] {
  const after = useAfterWatching();
  const [said, setSaid] = useState<number | null>(null);
  const at = Math.max(notYet ?? 0, said ?? 0) || null;
  const later = async () => {
    setSaid(aired);
    try {
      await watching.follow(seasonId, { notYet: aired });
      await after();
    } catch (e) {
      setSaid(null);
      toast.quiet((e as Error).message);
    }
  };
  return [at != null && at >= aired, () => void later()];
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

/** Yes's one check before anything shows: what plays, and any move it closes. */
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
