"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import type { Profile, profileApi } from "../data";
import { Btn } from "../ui/parts";
import { Choice, PageSection, ResetLink } from "./controls";
import { AutoSection } from "./keep-up";

// When results show (settings Round 1, C1; docs/design-round/settings-r1-spec.md): one choice for shows and one for sports, in
// place of Hide scores until I reveal and Sports scores too. "Straight away" now means every show, including ones you only follow
// (guard.ts progressFrom), and asks first, since Undo can't unsee a result. A game's own-pace seat always goes by your reveals.
// Under them, the shows you follow and don't play that can be marked watched as each episode airs (keep-up.tsx), until Round 2
// moves that to each show's own page.

type Save = (body: Parameters<typeof profileApi.save>[0], said: string, undo?: Parameters<typeof profileApi.save>[0]) => Promise<void>;

/** Your settings' When results show row. */
export const resultsValue = (p: Profile | undefined, sports: boolean) =>
  !p ? "…" : `${p.hideScores ? "After you've watched" : "Straight away"}${sports ? ` · sports ${p.hideSportsScores ? "after you've watched" : "live"}` : ""}`;

export function ResultsPage({ p, save, sports }: { p: Profile | undefined; save: Save; sports: boolean }) {
  const hide = p?.hideScores ?? true;
  const [asking, setAsking] = useState(false);
  const wait = () => {
    setAsking(false);
    if (!hide) void save({ hideScores: true }, "Results wait until you've watched", { hideScores: false });
  };
  return (
    <div data-settings-results className="pb-10">
      <PageSection data="settings-spoilers" title="Shows" line="Results, standings, posters and notifications.">
        <div role="radiogroup" aria-label="When results show, on shows">
          <Choice
            data="hide-on"
            on={hide}
            title="After you've watched"
            line="Each episode's results wait until you say you've watched it"
            recommended
            onPick={wait}
          />
          <Choice
            data="hide-off"
            on={!hide}
            title="Straight away"
            line="As soon as they're known, on every show, even one you watch late"
            onPick={() => setAsking(true)}
          />
        </div>
        {/* Showing results straight away can spoil an episode, and Undo can't take that back: it asks first. */}
        {asking && hide && (
          <div data-hide-warn className="mb-2 mt-1 rounded-[3px] bg-card p-3 outline-1 -outline-offset-1 outline-border">
            <p className="flex gap-2 text-[14px] leading-snug">
              <TriangleAlert className="mt-0.5 size-4 flex-none" aria-hidden />
              <span>
                <b className="font-semibold">Show results straight away?</b> The hub, standings and notifications will say who went home as soon as it&rsquo;s known, on every
                show, even the week you watch late. Undo can&rsquo;t unsee it.
              </span>
            </p>
            <div className="mt-3 flex gap-2">
              <Btn tone="ink" className="flex-1" data-hide-keep onClick={() => setAsking(false)}>
                Keep them hidden
              </Btn>
              <button
                type="button"
                data-hide-confirm
                className="nd-press flex h-[52px] flex-1 items-center justify-center rounded-[3px] bg-card text-[15px] font-bold outline-1 -outline-offset-1 outline-edge"
                onClick={() => {
                  setAsking(false);
                  void save({ hideScores: false }, "Results show straight away", { hideScores: true });
                }}
              >
                Show them
              </button>
            </div>
          </div>
        )}
        {!hide && <ResetLink data="hide" label="Reset to recommended" onClick={wait} />}
        <p className="mt-2 text-[13px] leading-snug text-muted-foreground">A game you play at your own pace always waits for your reveal, whatever this says.</p>
      </PageSection>

      {sports && (
        <PageSection data="settings-sports" title="Sports" line="Scores, clocks, winners and records, once a game has begun.">
          <div role="radiogroup" aria-label="When results show, on sports">
            <Choice
              data="sports-live"
              on={!p?.hideSportsScores}
              title="Live"
              line="As they happen"
              recommended
              onPick={() => p && save({ hideSportsScores: false }, "Sports show live", { hideSportsScores: true })}
            />
            <Choice
              data="sports-wait"
              on={!!p?.hideSportsScores}
              title="After you've watched"
              line="A game that's begun says only when it started, until you tap Show the score"
              onPick={() => p && save({ hideSportsScores: true }, "Sports scores wait for Show the score", { hideSportsScores: false })}
            />
          </div>
        </PageSection>
      )}

      <AutoSection />
    </div>
  );
}
