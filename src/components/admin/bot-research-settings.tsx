"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { ShowSeason } from "@/lib/game/types";
import { ToggleRow, fieldCls } from "@/components/setup/settings-ui";
import { ActButton, Rows, Section } from "./admin-ui";
import { cn } from "cn";

// Bot research (experimental, db/bot-research.js) for one season: the free ChatGPT schedule, counted
// from each episode's air time. Every run is editable: what it asks, how long after airing, on or off.

type Run = { kind: "quick" | "full"; after: number; on: boolean };

// The server's default (db/bot-research.js DEFAULT_SCHEDULE), for a season that's never saved one.
const DEFAULT: Run[] = [
  { kind: "quick", after: 5, on: true },
  { kind: "full", after: 60, on: true },
  { kind: "full", after: 540, on: true },
];
const KIND_LABEL = { quick: "Quick check", full: "Full research" } as const;
const KIND_HINT = {
  quick: "Who left the game, and the episode's headline.",
  full: "Every result, staged for your review. A second one fills in what the first missed.",
} as const;

export function afterLabel(min: number) {
  if (min < 60) return `${min} min`;
  const h = min / 60;
  return Number.isInteger(h) ? `${h} h` : `${Math.floor(h)} h ${min % 60} min`;
}

export function BotResearchSection({
  season,
  busy,
  save,
}: {
  season: ShowSeason;
  busy: boolean;
  save: (changes: Record<string, unknown>) => Promise<unknown>;
}) {
  // Straight from what's saved: each edit saves and refetches, so a rejected one snaps back by itself.
  const runs: Run[] = season.botResearchSchedule ?? DEFAULT;
  const on = !!season.botResearchOn;

  function commit(next: Run[]) {
    void save({ botResearchSchedule: next });
  }
  const edit = (i: number, patch: Partial<Run>) => commit(runs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <Section
      title="Bot research"
      aside={
        <span className="mb-1 rounded-[3px] border border-input px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
          Experimental
        </span>
      }
    >
      <Rows>
        <ToggleRow
          label="Ask ChatGPT after each episode airs"
          hint={
            on
              ? "Free: our bot asks on this schedule, from when it was switched on. Results still wait for your review."
              : "Off: the bot only runs when someone asks."
          }
          checked={on}
          disabled={busy}
          // The schedule goes with the switch, so a season that never saved one gets the default.
          onChange={(next) => save(next ? { botResearchOn: true, botResearchSchedule: runs } : { botResearchOn: false })}
        />
        {on &&
          runs.map((r, i) => (
            <div key={`${r.kind}@${r.after}@${i}`} className="flex flex-col gap-1 pb-3">
              <ToggleRow
                label={`${KIND_LABEL[r.kind]}, ${afterLabel(r.after)} after airing`}
                hint={KIND_HINT[r.kind]}
                checked={r.on}
                disabled={busy}
                onChange={(next) => edit(i, { on: next })}
              />
              <RunEditor run={r} disabled={busy} onChange={(patch) => edit(i, patch)} onRemove={() => commit(runs.filter((_, j) => j !== i))} />
            </div>
          ))}
      </Rows>
      {on && (
        <div className="flex flex-wrap gap-2">
          <ActButton
            disabled={busy || runs.length >= 8}
            onClick={() => {
              // A new run an hour after the last one, so it doesn't collide with an existing slot.
              const last = runs.reduce((m, r) => Math.max(m, r.after), 0);
              commit([...runs, { kind: "full", after: last + 60, on: true }]);
            }}
          >
            <Plus className="size-[16px]" strokeWidth={2.4} aria-hidden />
            Add a run
          </ActButton>
          <ActButton disabled={busy} onClick={() => commit(DEFAULT)}>
            Reset to 5 min, 1 h, 9 h
          </ActButton>
        </div>
      )}
    </Section>
  );
}

// What a run asks, and when. Minutes or hours, stored as minutes; saved when the field is left.
function RunEditor({ run, disabled, onChange, onRemove }: { run: Run; disabled: boolean; onChange: (patch: Partial<Run>) => void; onRemove: () => void }) {
  const hours = run.after >= 60 && run.after % 60 === 0;
  const [unit, setUnit] = useState<"min" | "h">(hours ? "h" : "min");
  const shown = unit === "h" ? run.after / 60 : run.after;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="What it asks"
        className={cn(fieldCls, "min-h-11 w-auto min-w-0 flex-1")}
        value={run.kind}
        disabled={disabled}
        onChange={(e) => onChange({ kind: e.target.value as Run["kind"] })}
      >
        {/* Short: the row's title above already says it in full. */}
        <option value="quick">Quick</option>
        <option value="full">Full</option>
      </select>
      <input
        aria-label="How long after airing"
        type="number"
        min={0}
        className={cn(fieldCls, "min-h-11 w-[68px] px-3 tabular-nums")}
        defaultValue={shown}
        key={`${run.after}-${unit}`}
        disabled={disabled}
        onBlur={(e) => {
          const n = Math.max(0, Math.round(Number(e.target.value) * (unit === "h" ? 60 : 1)));
          if (Number.isFinite(n) && n !== run.after) onChange({ after: n });
        }}
      />
      <select aria-label="Unit" className={cn(fieldCls, "min-h-11 w-[96px] px-3")} value={unit} disabled={disabled} onChange={(e) => setUnit(e.target.value as "min" | "h")}>
        <option value="min">min</option>
        <option value="h">hours</option>
      </select>
      <button
        type="button"
        aria-label="Remove this run"
        disabled={disabled}
        onClick={onRemove}
        className="inline-flex size-11 items-center justify-center rounded-[3px] border border-input bg-card text-muted-foreground hover:bg-secondary disabled:opacity-45"
      >
        <X className="size-[18px]" strokeWidth={2.2} aria-hidden />
      </button>
    </div>
  );
}
