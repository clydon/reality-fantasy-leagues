"use client";

import { useState } from "react";
import type { LeagueState, WaiverFeel } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Stepper } from "@/components/setup/settings-ui";
import { FeelCard, Segmented, SwapCounter, SwitchRow } from "@/components/waivers/waiver-controls";
import { RuleRow, leagueNumbers } from "@/components/waivers/waivers-settings";
import { ruleRows, shapeBullets, type WaiverShape } from "@/components/waivers/waivers-words";

// The create wizard's Waivers card (docs/PLAN-waivers-v2.md "1A · The create wizard"; the canvas's
// "Create wizard: the card"): how many teams, then what suits a league that size -- Casual · Balanced ·
// Competitive and four bullets -- with Change for the settings themselves. When the teams can't all be
// drafted from the cast, it says so and offers what would fit instead. The league is created on the
// suggestion for this team count; once the draft starts it's fitted to the teams it really has
// (WaiverLogic.refit), unless the commissioner changed it here or in League Settings.

export interface WizardWaiverChoice {
  teams: number;
  feel: WaiverFeel;
  /** Set when the commissioner used Change: these settings, not the suggestion's. */
  custom: WaiverShape | null;
}

export type RosterFix = { kind: "shared" } | { kind: "smaller" } | { kind: "pickem" };

export function WizardWaivers({
  preview,
  castSize,
  value,
  onChange,
  onFix,
  castaways,
}: {
  /** The league as it'll start (type, roster, ownership). */
  preview: LeagueState;
  /** The season's cast, if the catalog knows it. */
  castSize: number | null;
  value: WizardWaiverChoice;
  onChange: (v: WizardWaiverChoice) => void;
  onFix: (fix: RosterFix) => void;
  castaways: string;
}) {
  const [changing, setChanging] = useState(false);
  const rec = recommendation(preview, castSize, value.teams, value.feel);
  const R = StateLogic.rosterSize(preview);
  const activeRoster = !!StateLogic.getLeagueType(preview).hasActiveRoster;
  const shared = preview.settings.ownershipMode === "shared";
  const S = activeRoster ? preview.settings.activeSlots : R;

  const teams = (
    <div className="flex min-h-[60px] items-center gap-3">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-base font-semibold">How many teams?</span>
        <span className="text-[13px] text-muted-foreground">A guess is fine: it sets up waivers to suit.</span>
      </span>
      <Stepper label="Teams" value={value.teams} min={2} max={20} onChange={(teams) => onChange({ ...value, teams })} />
    </div>
  );

  if (!rec) return teams;
  if (!rec.feasible) {
    const smaller = R - 1;
    const smallerFits = smaller >= 1 && castSize !== null && value.teams * smaller <= castSize - (activeRoster && !shared ? value.teams : 0);
    return (
      <>
        {teams}
        <section className="flex flex-col gap-3 rounded-[4px] border border-border bg-card px-3.5 py-4">
          <p className="text-[15px] leading-[1.45]">
            <b className="font-semibold">
              {value.teams} teams of {R} needs {rec.need} {castaways}; this season has {rec.have}.
            </b>{" "}
            Try one of these:
          </p>
          <div className="flex flex-col gap-2">
            <FixButton title="Share the cast" detail={`Anyone can have anyone. Teams of ${R} work.`} onClick={() => onFix({ kind: "shared" })} />
            {smallerFits && (
              <FixButton
                title={activeRoster ? `Teams of ${smaller} (${preview.settings.benchSlots > 0 ? S : S - 1} starting)` : `Teams of ${smaller}`}
                detail={`${value.teams * smaller} drafted, ${castSize! - value.teams * smaller} free agents.`}
                onClick={() => onFix({ kind: "smaller" })}
              />
            )}
            <FixButton title="Play Eliminator Pool instead" detail="No draft: one pick each episode." onClick={() => onFix({ kind: "pickem" })} />
          </div>
        </section>
      </>
    );
  }

  const shape: WaiverShape = value.custom ?? rec.settings;
  return (
    <>
      {teams}
      <FeelCard
        heading="Waivers"
        numbers={castSize ? leagueNumbers(value.teams, R, rec.freeAgents) : `${value.teams} teams of ${R}`}
        feel={value.feel}
        onFeel={(feel) => onChange({ ...value, feel, custom: null })}
        bullets={shapeBullets(shape, { classic: !activeRoster, shared, roster: R, shortAt: Math.max(0, S - 1) })}
        footer={
          <button type="button" onClick={() => setChanging(true)} className="-mt-1 flex min-h-11 items-center self-end text-sm font-bold text-chyron-line hover:underline">
            {value.custom ? "Customized · Change" : "Change"}
          </button>
        }
      />
      <p className="text-[13px] leading-[1.4] text-muted-foreground">You can change this any time in League Settings, and open an extra waiver window whenever you like.</p>
      <ChangeSheet
        key={String(changing)}
        open={changing}
        onOpenChange={setChanging}
        preview={preview}
        shape={shape}
        roster={R}
        shortAt={Math.max(0, S - 1)}
        suggested={rec.settings.replaceRule}
        onSave={(custom) => {
          onChange({ ...value, custom });
          setChanging(false);
        }}
      />
    </>
  );
}

/** recommend() for the league being created: its cast (or a typical 18 when the catalog doesn't say). */
export function recommendation(preview: LeagueState, castSize: number | null, teams: number, feel: WaiverFeel) {
  const roster = !!StateLogic.getLeagueType(preview).hasActiveRoster;
  const R = StateLogic.rosterSize(preview);
  return StateLogic.WaiverLogic.recommend({
    C: castSize ?? 18,
    T: teams,
    R,
    S: roster ? preview.settings.activeSlots : R,
    E: 13,
    shared: preview.settings.ownershipMode === "shared",
    type: roster ? "active-roster" : preview.settings.leagueTypeId,
    feel,
  });
}

function FixButton({ title, detail, onClick }: { title: string; detail: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-[52px] flex-col gap-0.5 rounded-[4px] border border-input bg-background px-3.5 py-2 text-left hover:bg-secondary focus-visible:outline-3 focus-visible:outline-chyron-line">
      <span className="text-[15px] font-semibold">{title}</span>
      <span className="text-[13px] text-muted-foreground">{detail}</span>
    </button>
  );
}

// The three settings, for a league that doesn't exist yet: on a copy, saved back as `custom`.
function ChangeSheet({
  open,
  onOpenChange,
  preview,
  shape,
  roster,
  shortAt,
  suggested,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  preview: LeagueState;
  shape: WaiverShape;
  roster: number;
  shortAt: number;
  suggested: string;
  onSave: (s: WaiverShape) => void;
}) {
  const [draft, setDraft] = useState<WaiverShape>(shape);
  const w = draft.waiverWindows;
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="Waivers" hideCancel>
      <div className="flex flex-col gap-5 pb-1">
        <section className="flex flex-col">
          <h3 className="type-caption mb-1 text-[19px]">When someone&rsquo;s voted out</h3>
          <div role="radiogroup" aria-label="When someone's voted out">
            {ruleRows(preview, shortAt).map((r) => (
              <RuleRow
                key={r.rule}
                title={r.title}
                detail={r.detail}
                on={draft.replaceRule === r.rule}
                suggested={suggested === r.rule}
                onPick={() => setDraft({ ...draft, replaceRule: r.rule })}
              />
            ))}
          </div>
        </section>
        <section className="flex flex-col gap-3">
          <h3 className="type-caption text-[19px]">Waiver windows</h3>
          <Segmented
            label="When waiver windows open"
            value={w.schedule}
            onChange={(schedule) => setDraft({ ...draft, waiverWindows: { ...w, schedule } })}
            options={[
              { value: "everyEpisode", label: "Every episode" },
              { value: "every", label: `Every ${w.every}` },
              { value: "manual", label: "You decide" },
            ]}
          />
          <div className="grid grid-cols-[1fr_auto] items-center gap-3">
            <span className="text-base font-semibold">Swaps each</span>
            <SwapCounter value={w.swaps} roster={roster} onChange={(swaps) => setDraft({ ...draft, waiverWindows: { ...w, swaps } })} />
          </div>
        </section>
        <SwitchRow label="Auto-fill" hint="No claim in? They get the top free agent." checked={draft.autoFill} onChange={(autoFill) => setDraft({ ...draft, autoFill })} />
        <div className="grid grid-cols-[1fr_1.8fr] gap-2">
          <button type="button" onClick={() => onOpenChange(false)} className="min-h-[52px] rounded-[6px] border border-input text-[15px] font-semibold">
            Cancel
          </button>
          <button type="button" onClick={() => onSave(draft)} className="min-h-[52px] rounded-[6px] bg-chyron text-[15px] font-bold text-chyron-foreground">
            Use these
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
