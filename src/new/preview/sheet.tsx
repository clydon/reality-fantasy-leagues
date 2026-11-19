"use client";

import { Fragment, useState } from "react";
import { ChevronRight } from "lucide-react";
import { MOMENT_NAMES, STEPS, type MomentKind } from "./moments";

// TEMP, development only (docs/design-round/preview-story-spec.md, "The sheet"): many games' previews side by side, a phone per game at
// 390, for sweeping games (§6B of the explorer plan: does the player know what to do, does each game have its own soul, does the
// preview tell the truth). One control sets every phone to the same moment, so the same question is asked of every game at once;
// the phones carry no story controls of their own (embed). Each column: the game's name, what it has, its app bugs said plainly (the
// sweep's verdict material, above the phone), the preview. One grid, so each column's parts line up with its neighbours'.
// Round 5: a moment's screens are the app's path, so a second control sets the step every phone shows (where you meet it, what it
// opens, what it leads to), and each column names its path with the screen it's on (a shorter path stays on its last).
export interface SheetItem {
  id: string;
  name: string;
  /** Whose view it is: "As whoever runs it" or "As Sam, a player". */
  who: string;
  /** Each moment's screens' names, in the app's path. */
  paths: Partial<Record<MomentKind, string[]>>;
  has: string[];
  moments: MomentKind[];
  screens: number;
  bugs: { moment: string; screen: string; text: string }[];
}

const ORDER: MomentKind[] = ["game", "draft", "week", "after", "stage", "out", "finale"];

function BugTag() {
  return <span className="type-caption inline-flex h-5 flex-none items-center rounded-[2px] bg-foreground px-1.5 text-[13px] tracking-[0.04em] text-background">App bug</span>;
}

export function PreviewSheet({ items }: { items: SheetItem[] }) {
  const [moment, setMoment] = useState<MomentKind | "story">("story");
  const [step, setStep] = useState(0);
  // The steps the chosen moment has in any game here (the longest path among them).
  const deepest = moment === "story" ? 0 : Math.max(0, ...items.map((it) => it.paths[moment]?.length ?? 0));
  const kinds = ORDER.filter((k) => items.some((it) => it.moments.includes(k)));
  const screens = items.reduce((t, it) => t + it.screens, 0), bugs = items.reduce((t, it) => t + it.bugs.length, 0);
  return (
    // The whole window, past the app shell's phone-width column: a desk's width of phones, side by side.
    <div className="fixed inset-0 z-50 overflow-auto bg-background text-foreground" data-preview-sheet>
      <header className="flex flex-col gap-3 px-[max(16px,env(safe-area-inset-left,0px))] pb-5 pt-6 sm:px-8">
        <h1 className="type-caption text-[44px] leading-[0.9]">Previews</h1>
        <p className="text-[15px] text-muted-foreground" data-sheet-summary>
          {items.length} games · {screens} real screens · {bugs ? `${bugs} app bug${bugs === 1 ? "" : "s"}` : "no app bugs"}
        </p>
        <div role="radiogroup" aria-label="Show every phone at" className="flex flex-wrap gap-1">
          {(["story", ...kinds] as const).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={moment === k} data-sheet-moment={k} onClick={() => { setMoment(k); setStep(0); }} className={`nd-press type-caption h-11 rounded-[3px] px-3 text-[15px] tracking-[0.04em] ${moment === k ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"}`}>
              {k === "story" ? "Each story" : MOMENT_NAMES[k]}
            </button>
          ))}
        </div>
        {deepest > 1 && (
          <div role="radiogroup" aria-label="And at this step of it" className="flex flex-wrap items-center gap-1" data-sheet-steps>
            {STEPS.slice(0, deepest).map((label, i) => (
              <Fragment key={label}>
                {i > 0 && <ChevronRight className="size-4 flex-none text-muted-foreground" aria-hidden />}
                <button type="button" role="radio" aria-checked={step === i} data-sheet-step={i + 1} onClick={() => setStep(i)} className={`nd-press h-11 rounded-[3px] px-3 text-[15px] font-semibold ${step === i ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"}`}>
                  {label}
                </button>
              </Fragment>
            ))}
          </div>
        )}
      </header>
      <div className="grid grid-flow-col grid-rows-[auto_auto_auto] auto-cols-[min(390px,calc(100vw-32px))] gap-x-6 gap-y-3 overflow-x-auto px-[max(16px,env(safe-area-inset-left,0px))] pb-10 sm:px-8" data-sheet-row>
        {items.map((it) => (
          <div key={it.id} className="contents" data-sheet-game={it.id}>
            <div className="flex flex-col gap-1 self-end">
              <h2 className="type-caption text-[22px] leading-[0.95]">{it.name}</h2>
              <p className="text-[13px] text-muted-foreground">{[it.who, ...it.has].join(" · ")}</p>
              {moment !== "story" && (
                <p className="flex flex-wrap items-center gap-1 text-[13px]" data-sheet-path>
                  {(it.paths[moment] ?? []).map((name, i, all) => (
                    <Fragment key={name}>
                      {i > 0 && <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden />}
                      <span className={i === Math.min(step, all.length - 1) ? "font-bold text-foreground underline decoration-2 underline-offset-4" : "text-muted-foreground"}>{name}</span>
                    </Fragment>
                  ))}
                  {!it.paths[moment] && <span className="text-muted-foreground">No {MOMENT_NAMES[moment].replace(/^The /, "").toLowerCase()} in this game</span>}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2" data-sheet-bugs={it.bugs.length}>
              {it.bugs.length ? (
                it.bugs.map((b, i) => (
                  <p key={i} className="flex items-start gap-2 text-[15px] leading-snug">
                    <BugTag />
                    <span className="min-w-0">
                      {b.text.replace(/^App bug: /, "").replace(/^\w/, (c) => c.toUpperCase())} <span className="text-muted-foreground">({b.moment}, {b.screen})</span>
                    </span>
                  </p>
                ))
              ) : (
                <p className="text-[15px] text-muted-foreground">No app bugs</p>
              )}
            </div>
            <iframe key={`${moment}-${step}`} src={`/start/preview-story?preview=${it.id}&embed=1${moment === "story" ? "" : `&moment=${moment}&screen=${step + 1}`}`} title={`${it.name}: its preview`} className="h-[760px] w-full flex-none overflow-hidden rounded-[14px] border border-border bg-background" />
          </div>
        ))}
      </div>
    </div>
  );
}
