"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import type { ReplaceRule, WaiverFeel, WaiverWindows } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { api } from "@/lib/api";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { useShowTerms } from "@/lib/use-show-terms";
import { BottomSheet, SheetAction } from "@/components/ui/bottom-sheet";
import { NotInThisLeague, ReadOnlyNote, SettingsPage, Stepper } from "@/components/setup/settings-ui";
import { cn } from "cn";
import { tourMark } from "@/lib/tour/tour-store";
import { RulesSheet } from "./rules-sheet";
import { FeelCard, Segmented, SwapCounter, SwitchRow } from "./waiver-controls";
import { ORDER_LABEL, deadlineLabel, latestEpisode, nextWindow, ruleRows, shapeBullets } from "./waivers-words";

// League Settings › Waivers (docs/PLAN-waivers-v2.md "1A"; the "Waivers v2 options" canvas): the
// Suggested card (Casual · Balanced · Competitive, four bullets the switch rewrites, Apply), then the
// settings themselves -- when someone's voted out, waiver windows and their swaps, timing and auto-fill
// -- and a preview of the rules sheet players see. Touching a setting takes the league off the
// suggestion; the card then offers it again.

const HOURS = [12, 24, 48];

/** The Suggested card's numbers: "4 teams of 3 · 6 free agents". */
export function leagueNumbers(teams: number, roster: number, freeAgents: number | null): string {
  return `${teams} ${teams === 1 ? "team" : "teams"} of ${roster}${freeAgents === null ? " · shared cast" : ` · ${freeAgents} free agent${freeAgents === 1 ? "" : "s"}`}`;
}

export function WaiversSettingsPage() {
  const state = useLeagueStore((s) => s.state);
  const leagueId = useLeagueStore((s) => s.leagueId);
  const canManage = useCanManage();
  const mutate = useMutate();
  const terms = useShowTerms();
  const W = StateLogic.WaiverLogic;
  const c = W.config(state);
  const [feel, setFeel] = useState<WaiverFeel>(c.waiverFeel);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [sheet, setSheet] = useState<null | "hours" | "order" | "fa">(null);

  async function update(field: string, value: unknown) {
    setBusy(true);
    await mutate(
      (s) => StateLogic.updateSettings(s, field, value),
      () => api.updateLeagueSettings(leagueId!, field, value),
    );
    setBusy(false);
  }

  if (!W.supported(state)) {
    return (
      <SettingsPage title="Waivers">
        <NotInThisLeague what="replacements or swaps" />
      </SettingsPage>
    );
  }

  const activeRoster = !!StateLogic.getLeagueType(state).hasActiveRoster;
  const shared = state.settings.ownershipMode === "shared";
  const R = StateLogic.rosterSize(state);
  const shortAt = W.shortAt(state);
  const rec = W.recommendFor(state, feel);
  const recSettings = rec && rec.feasible ? rec.settings : null;
  // Before the draft the suggestion would be worked out for whoever has joined so far; it's shown once the
  // teams are real.
  const fitsLater = !!state.settings.waiverFit && !StateLogic.isDraftStarted(state);
  const applied = W.isRecommended(state) && c.waiverFeel === feel;
  const w = c.waiverWindows;
  const H = W.processHours(state);
  const orderBy = state.settings.replenishOrderBy || "rolling";
  const fa = W.freeAgencyOn(state);
  const latest = latestEpisode(state);
  const next = nextWindow(state, latest, false);
  const ro = !canManage || busy;
  const setWindows = (v: Partial<WaiverWindows>) => update("waiverWindows", v);

  return (
    <SettingsPage title="Waivers">
      <ReadOnlyNote />
      {fitsLater && (
        <p className="text-[15px] leading-[1.45] text-muted-foreground">
          <b className="font-semibold text-foreground">Nothing to set yet.</b> Waivers depend on who owns whom, how many teams there are and how big
          the cast is, so they&rsquo;re worked out when the draft starts. Change anything here before then and they stay as you set them.
        </p>
      )}
      {!fitsLater && rec && !rec.feasible && (
        <p className="rounded-[4px] border border-border bg-card px-3.5 py-3 text-[15px] leading-[1.45]">
          <b className="font-semibold">
            {W.teamsFor(state)} teams of {R} needs {rec.need} {terms.castaways}; this season has {rec.have}.
          </b>{" "}
          Shared ownership, or smaller teams, would fit.
        </p>
      )}
      {!fitsLater && recSettings && (
        <FeelCard
          numbers={leagueNumbers(W.teamsFor(state), R, rec && rec.feasible ? rec.freeAgents : null)}
          feel={feel}
          onFeel={setFeel}
          bullets={shapeBullets(recSettings, { classic: !activeRoster, shared, roster: R, shortAt: recSettings.replenishAt ?? shortAt })}
          applied={applied}
          onApply={canManage ? () => update("waiverRecommendation", feel) : undefined}
          busy={busy}
          disabled={!canManage}
        />
      )}

      <section className="flex flex-col" data-tour="waiver-rules">
        <h2 className="type-caption mb-1 text-[24px]">When someone&rsquo;s voted out</h2>
        <div role="radiogroup" aria-label="When someone's voted out" className="flex flex-col">
          {ruleRows(state, shortAt).map((r) => (
            <RuleRow
              key={r.rule}
              title={r.title}
              detail={r.detail}
              on={c.replaceRule === r.rule}
              suggested={recSettings?.replaceRule === r.rule}
              disabled={ro}
              onPick={() => {
                update("replaceRule", r.rule as ReplaceRule);
                tourMark("waiver-rule");
              }}
            >
              {r.rule === "whenShort" && c.replaceRule === "whenShort" && canManage && (
                <span className="flex items-center justify-between gap-3 pb-1 pl-9">
                  <span className="text-[13px] text-muted-foreground">Down to</span>
                  <Stepper label="Down to" value={shortAt} min={0} max={Math.max(0, R - 1)} onChange={(n) => update("replenishAt", n)} disabled={ro} />
                </span>
              )}
            </RuleRow>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3.5" data-tour="waiver-windows">
        <div className="flex flex-col gap-1">
          <h2 className="type-caption text-[24px]">Waiver windows</h2>
          <p className="text-[13px] leading-[1.4] text-muted-foreground">When players can swap someone still in. Swapped castaways take their points with them.</p>
        </div>
        <Segmented
          label="When waiver windows open"
          disabled={ro}
          value={w.schedule}
          onChange={(schedule) => setWindows({ schedule })}
          options={[
            { value: "everyEpisode", label: "Every episode" },
            { value: "every", label: `Every ${w.every}` },
            { value: "manual", label: "You decide" },
          ]}
        />
        {w.schedule === "every" && canManage && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-[15px] font-semibold">Episodes between windows</span>
            <Stepper label="Episodes between windows" value={w.every} min={2} max={6} onChange={(every) => setWindows({ every })} disabled={ro} />
          </div>
        )}
        <div className="grid grid-cols-[1fr_auto] items-center gap-3">
          <span className="flex flex-col gap-0.5">
            <span className="text-base font-semibold">Swaps each</span>
            <span className="text-[13px] text-muted-foreground">{w.schedule === "manual" ? "Set when you open one" : next ? `Next window: after Episode ${next}` : "No more this season"}</span>
          </span>
          <SwapCounter value={w.swaps} roster={R} onChange={(swaps) => setWindows({ swaps })} disabled={ro} label="Swaps each" />
        </div>
      </section>

      <section className="flex flex-col">
        <h2 className="type-caption mb-1 text-[24px]">Timing</h2>
        <ValueRow label="Claim deadline" value={deadlineLabel(H)} onClick={() => setSheet("hours")} disabled={ro} />
        {!shared && <ValueRow label="Waiver order" value={ORDER_LABEL[orderBy] ?? orderBy} onClick={() => setSheet("order")} disabled={ro} />}
        <ValueRow label="Free agency" value={fa ? "Until airtime" : "Off"} onClick={() => setSheet("fa")} disabled={ro} />
        <SwitchRow label="Auto-fill" hint="No claim in? They get the top free agent." checked={c.autoFill} onChange={(v) => update("autoFill", v)} disabled={ro} />
      </section>

      <button
        type="button"
        onClick={() => setPreview(true)}
        className="-mt-2 flex min-h-11 items-center self-start text-sm font-bold text-chyron-line hover:underline focus-visible:outline-3 focus-visible:outline-chyron-line"
      >
        Preview what players see
      </button>
      <RulesSheet open={preview} onOpenChange={setPreview} />

      <OptionsSheet
        open={sheet === "hours"}
        onClose={() => setSheet(null)}
        title="Claim deadline"
        description="Before each episode airs"
        options={HOURS.map((h) => ({ label: deadlineLabel(h), on: h === H, pick: () => update("waiverProcessHours", h) }))}
      />
      <OptionsSheet
        open={sheet === "order"}
        onClose={() => setSheet(null)}
        title="Waiver order"
        options={Object.entries(ORDER_LABEL).map(([v, label]) => ({
          label,
          detail: v === "rolling" ? "Get a free agent, go to the back" : "Reset each week by the standings",
          on: v === orderBy,
          pick: () => update("replenishOrderBy", v),
        }))}
      />
      <OptionsSheet
        open={sheet === "fa"}
        onClose={() => setSheet(null)}
        title="Free agency"
        description="After claims are processed"
        options={[
          { label: "Until airtime", detail: "First come, first served", on: fa, pick: () => update("freeAgencyEnabled", true) },
          { label: "Off", detail: "Claims only", on: !fa, pick: () => update("freeAgencyEnabled", false) },
        ]}
      />
    </SettingsPage>
  );
}

export function RuleRow({
  title,
  detail,
  on,
  suggested,
  disabled,
  onPick,
  children,
}: {
  title: string;
  detail: string;
  on: boolean;
  suggested?: boolean;
  disabled?: boolean;
  onPick: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="border-b border-border">
      <button
        type="button"
        role="radio"
        aria-checked={on}
        disabled={disabled}
        onClick={onPick}
        className="grid min-h-[60px] w-full grid-cols-[26px_1fr] items-center gap-2.5 py-2.5 text-left outline-none focus-visible:bg-accent disabled:cursor-default"
      >
        <span className={cn("flex size-[22px] items-center justify-center rounded-full border-2", on ? "border-chyron-line" : "border-input")} aria-hidden>
          <span className={cn("size-2.5 rounded-full", on && "bg-chyron-line")} />
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="flex items-center gap-2 text-base font-semibold">
            {title}
            {suggested && <SuggestedBadge />}
          </span>
          <span className="text-[13px] leading-[1.35] text-muted-foreground">{detail}</span>
        </span>
      </button>
      {children}
    </div>
  );
}

export function SuggestedBadge() {
  return <span className="rounded-[2px] border border-chyron-line px-1.5 py-px text-[11px] font-bold uppercase tracking-[0.025em] text-chyron-line">Suggested</span>;
}

function ValueRow({ label, value, onClick, disabled }: { label: string; value: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[52px] items-center justify-between gap-3 border-b border-border text-left outline-none focus-visible:bg-accent disabled:cursor-default"
    >
      <span className="text-base font-semibold">{label}</span>
      <span className="flex items-center gap-1 text-sm text-muted-foreground">
        {value}
        {!disabled && <ChevronRight className="size-4" strokeWidth={2.2} aria-hidden />}
      </span>
    </button>
  );
}

function OptionsSheet({
  open,
  onClose,
  title,
  description,
  options,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  options: { label: string; detail?: string; on: boolean; pick: () => void }[];
}) {
  return (
    <BottomSheet open={open} onOpenChange={(o) => !o && onClose()} title={title} description={description}>
      <div className="flex flex-col">
        {options.map((o) => (
          <SheetAction
            key={o.label}
            detail={o.on ? "Chosen" : o.detail}
            onClick={() => {
              o.pick();
              onClose();
            }}
          >
            {o.label}
          </SheetAction>
        ))}
      </div>
    </BottomSheet>
  );
}
