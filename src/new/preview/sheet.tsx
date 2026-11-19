"use client";

import { useState } from "react";
import { MOMENT_NAMES, type MomentKind } from "./moments";

// TEMP, development only (docs/design-round/preview-story-spec.md, "The sheet"): many games' previews side by side, a phone per game at
// 390, for sweeping games (§6B of the explorer plan: does the player know what to do, does each game have its own soul, does the
// preview tell the truth). One control sets every phone to the same moment, so the same question is asked of every game at once.
// Each column: the game's name, what it has, its app-bug count; the preview itself (its own story page); its bugs, said plainly.
export interface SheetItem {
  id: string;
  name: string;
  has: string[];
  moments: MomentKind[];
  screens: number;
  bugs: { moment: string; screen: string; text: string }[];
}

const ORDER: MomentKind[] = ["game", "draft", "week", "after", "stage", "out", "finale"];

export function PreviewSheet({ items }: { items: SheetItem[] }) {
  const [moment, setMoment] = useState<MomentKind | "story">("story");
  const kinds = ORDER.filter((k) => items.some((it) => it.moments.includes(k)));
  const screens = items.reduce((t, it) => t + it.screens, 0), bugs = items.reduce((t, it) => t + it.bugs.length, 0);
  return (
    // The whole window, past the app shell's phone-width column: a desk's width of phones, side by side.
    <div className="fixed inset-0 z-50 overflow-auto bg-background text-foreground" data-preview-sheet>
      <header className="flex flex-col gap-3 px-[max(16px,env(safe-area-inset-left,0px))] pb-4 pt-6 sm:px-8">
        <h1 className="type-caption text-[34px] leading-[0.9]">Previews</h1>
        <p className="text-[15px] text-muted-foreground" data-sheet-summary>
          {items.length} games · {screens} real screens · {bugs ? `${bugs} app bug${bugs === 1 ? "" : "s"}` : "no app bugs"}
        </p>
        <div role="radiogroup" aria-label="Show every phone at" className="flex flex-wrap gap-1">
          {(["story", ...kinds] as const).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={moment === k} data-sheet-moment={k} onClick={() => setMoment(k)} className={`nd-press type-caption h-10 rounded-[3px] px-3 text-[15px] tracking-[0.04em] ${moment === k ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"}`}>
              {k === "story" ? "Each story" : MOMENT_NAMES[k]}
            </button>
          ))}
        </div>
      </header>
      <div className="flex gap-6 overflow-x-auto px-[max(16px,env(safe-area-inset-left,0px))] pb-10 sm:px-8" data-sheet-row>
        {items.map((it) => (
          <section key={it.id} className="flex w-[390px] max-w-[calc(100vw-32px)] flex-none flex-col gap-3" data-sheet-game={it.id} aria-label={it.name}>
            <div className="flex flex-col gap-1">
              <h2 className="type-caption text-[22px] leading-[0.95]">{it.name}</h2>
              <p className="text-[13px] text-muted-foreground">{it.has.join(" · ")}</p>
              <p className="text-[13px] font-semibold" data-sheet-bugs={it.bugs.length}>
                {it.bugs.length ? `${it.bugs.length} app bug${it.bugs.length === 1 ? "" : "s"}` : "No app bugs"}
              </p>
            </div>
            <iframe key={moment} src={`/start/preview-story?preview=${it.id}${moment === "story" ? "" : `&moment=${moment}`}`} title={`${it.name}: its preview`} className="h-[844px] w-[390px] max-w-full flex-none overflow-hidden rounded-[14px] border border-border bg-background" />
            {it.bugs.length > 0 && (
              <ul className="flex flex-col gap-2.5" data-sheet-bug-list>
                {it.bugs.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-[14px] leading-snug">
                    <span className="type-caption flex-none rounded-[2px] border border-dashed border-foreground px-1.5 text-[12px] leading-[19px] tracking-[0.04em]">App bug</span>
                    <span className="min-w-0">
                      {b.text.replace(/^App bug: /, "")} <span className="text-muted-foreground">({b.moment}, {b.screen})</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
