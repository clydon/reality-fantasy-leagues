"use client";

import { useState } from "react";
import type { CatalogSeason } from "../data";
import { Btn, Stepper } from "../ui/parts";
import { ShowArt } from "../ui/show-bar";
import { whereCap, whereLabel } from "../way-in";

// Where you are in a season (docs/PLAN-new-design.md step 9 part 2's first run, step 10 part 1's show space): a stepper
// from Haven't started to what's aired, never past it (the guard shows nothing after it: guard.ts). A season you play has
// none: where you are moves as you reveal each episode.

export type WhereSeason = Pick<CatalogSeason, "seasonId" | "label" | "show" | "artUrl" | "artPosition" | "aired" | "status" | "premiere">;

/** One season's row: its art, where you are in words, and the stepper (none before its premiere). */
export function WhereRow({ s, seen, onChange, fixed, line }: { s: WhereSeason; seen: number; onChange: (n: number) => void; fixed?: boolean; line?: string }) {
  return (
    <div className="flex min-h-[76px] items-center gap-3 border-t border-border py-2 first:border-t-0" data-where={s.label}>
      <ShowArt seasonId={`where-${s.seasonId}`} artUrl={s.artUrl} name={s.show[0]} position={s.artPosition} className="h-12 w-16 flex-none rounded-[3px] text-[22px]" />
      <div className="min-w-0 flex-1">
        <b className="type-caption block truncate text-[17px]">{s.label}</b>
        <small className="block text-[12px] leading-snug text-muted-foreground" data-where-line>
          {line ?? whereLabel(s, seen)}
        </small>
      </div>
      {!fixed && s.aired !== 0 && <Stepper value={seen} max={whereCap(s.aired)} label={s.label} onChange={onChange} />}
    </div>
  );
}

/**
 * Asking where someone is before a show goes on their list, or moving it: the row, a line on what it does, and the one
 * button. `plays`: they play it, so there's nothing to set here.
 */
export function WhereAsk({
  s,
  start,
  plays,
  cta,
  busy,
  onSave,
}: {
  s: WhereSeason;
  start: number;
  plays?: boolean;
  cta: string;
  busy?: boolean;
  onSave: (seen: number) => void;
}) {
  const [seen, setSeen] = useState(Math.min(start, whereCap(s.aired)));
  if (plays) {
    return (
      <div data-where-plays>
        <WhereRow s={s} seen={start} onChange={() => {}} fixed />
        <p className="mt-3 text-[14px] leading-normal text-muted-foreground">
          You play {s.show}, so where you are moves as you reveal each episode on Tonight. Nothing past it shows, here or in your games.
        </p>
      </div>
    );
  }
  return (
    <div data-where-ask>
      <WhereRow s={s} seen={seen} onChange={setSeen} />
      <p className="mt-2 text-[13px] leading-normal text-muted-foreground">Nothing past where you are shows: results, stats, the couch&rsquo;s chat. Change it any time.</p>
      <Btn tone="must" wide className="mt-4" data-where-save disabled={busy} onClick={() => onSave(seen)}>
        {busy ? "Saving…" : cta}
      </Btn>
    </div>
  );
}
