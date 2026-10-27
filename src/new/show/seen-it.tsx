"use client";

import { useState } from "react";
import { Radio } from "lucide-react";
import { useAfterWatching, useAiredEpisodes, watching } from "../data";
import { openWhere, type ShowData } from "../screens/show-space";
import { Btn } from "../ui/parts";
import { toast } from "../ui/toast";

// Live's question on Tonight (keep-up.ts, db/migrations/0141): on a show you keep up with live, when a new episode has ended past
// where you are, "Episode 4 just aired. Seen it?". Seen it moves where you are to it and everything about it opens; Not yet keeps
// it hidden and doesn't ask again until a newer one ends. Nothing moves until you say, so watching one late spoils nothing.
// Behind by more than one: "Seen Episodes 3 and 4?", with Set where you are for anything in between.

export function SeenItCard({ show }: { show: ShowData }) {
  const n = show.seenIt;
  const seasonId = show.header?.seasonId ?? null;
  const after = useAfterWatching();
  const [busy, setBusy] = useState(false);
  // A sport's titles are the matchups ("Game 4: Brewers at Rays"); anything else's stays hidden until it's seen.
  const aired = useAiredEpisodes(n != null && show.following ? seasonId : null);
  if (n == null || !seasonId || !show.following || show.plays) return null;
  const from = (show.seenThrough ?? 0) + 1;
  const title = aired.data?.episodes.find((e) => e.number === n)?.title ?? null;
  const many = n > from;
  const answer = async (seen: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      await watching.follow(seasonId, seen ? { seenThrough: n } : { notYet: n });
      await after();
      if (seen) toast(`Caught up through Episode ${n}`);
      else toast("It stays hidden until you say you've seen it");
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="mt-[18px] px-4" data-seen-it={n}>
      <div className="flex flex-col gap-2 rounded-[4px] bg-card p-4 outline-1 -outline-offset-1 outline-border">
        <span className="type-caption flex items-center gap-1.5 text-[12px] tracking-[0.05em] text-muted-foreground">
          <Radio className="size-4" aria-hidden />
          Live
        </span>
        <b className="text-[17px] leading-tight">{many ? `Episodes ${from}${n - from > 1 ? `–${n}` : ` and ${n}`} have aired` : `Episode ${n} just aired`}</b>
        {title && <small className="text-[13.5px] font-semibold leading-snug">{title}</small>}
        <small className="text-[13.5px] leading-snug text-muted-foreground">
          {many ? "Seen them?" : "Seen it?"} Its results, stats and the couch&rsquo;s chat open when you say, not before.
        </small>
        <div className="mt-1 flex gap-2">
          <Btn tone="must" className="flex-1" data-seen-it-yes disabled={busy} onClick={() => answer(true)}>
            {many ? "Seen them" : "Seen it, show me"}
          </Btn>
          <Btn className="flex-1" data-seen-it-not-yet disabled={busy} onClick={() => answer(false)}>
            Not yet
          </Btn>
        </div>
        {many && (
          <button type="button" data-seen-it-where onClick={() => openWhere(show)} className="self-start py-1 text-[13px] font-semibold text-muted-foreground underline underline-offset-2">
            Seen some of them? Set where you are
          </button>
        )}
      </div>
    </section>
  );
}
