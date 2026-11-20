"use client";

import { useEffect, useRef } from "react";
import { useTitleStep } from "../ui/title-card";

// A game's title card on its own page (docs/PLAN-start-a-game-redo.md B1; docs/design-round/b1-title-card-spec.md, Intent;
// b1-title-card-first-view.md, PFD; the user's call, 2026-11-18: "Bring it back on the game page"). The setup screen opened on the
// game's name over the show's art (gallery-bold/parts.tsx TitleCard), so the started game's page opens the same way, the same object
// (ui/title-card.ts: one kicker, one measured size, one art): making a game and playing it read as one thing. It is the page's
// identity, never its news: the kicker (the show and season), the game's own name in condensed caps, wrapped and never cut off,
// stepping down by measured lines (48, 40, 34 px) so a long name costs height before the week block's move ever leaves the first
// view; and, while nothing has scored for you yet, the setup's own sentence (for the couch's others, who never saw the setup
// screen, the card is the game's introduction). No state (no record, place or "Final"), so it can't spoil; not a control. When its
// name scrolls under the top, the page's bar takes the name (`onAway`), so the name is on screen once.

export function GameTitleCard({ kicker, name, sentence, onAway }: { kicker: string; name: string; sentence: string | null; onAway?: (away: boolean) => void }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const size = useTitleStep(ref, name);
  useEffect(() => {
    const el = ref.current;
    if (!el || !onAway) return;
    // Away once the name has gone up under the bar (56 px): the bar names the game from then on.
    const io = new IntersectionObserver(([e]) => onAway(!e.isIntersecting && e.boundingClientRect.top < 56), { rootMargin: "-56px 0px 0px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [onAway]);
  return (
    <hgroup data-game-card className="relative px-4 pb-3 pt-1">
      <p data-game-kicker className="type-caption truncate text-[11px] tracking-[0.08em] text-foreground">
        {kicker}
      </p>
      <h1 ref={ref} data-game-card-name className="type-caption mt-1 break-words leading-[0.86]" style={{ fontSize: size }}>
        {name}
      </h1>
      {sentence && (
        <p data-game-sentence className="mt-2 text-[15px] leading-snug text-foreground/90">
          {sentence}
        </p>
      )}
    </hgroup>
  );
}
