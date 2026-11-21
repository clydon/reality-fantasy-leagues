"use client";

import { useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronRight, Heart, Minus, Plus, Search } from "lucide-react";
import type { Base, ChangeState, Control } from "@/lib/game/start-gallery/index.js";
import { Pictogram } from "./icons";
import { useTitleStep } from "../../ui/title-card";
import type { Cell } from "./model";

// The gallery's parts (docs/design-round/wizard-r2-shape.md): one visual grammar across its screens (PFD R3). A square is a
// choice of game or change; a row is a setting that opens; chips are one pick among a few; a bone fill is "chosen"; a dashed edge
// is "can't be had", with why; yellow is Start alone. Lower Third's tokens throughout (DESIGN.md), Night, 390 first.

// ---------- the gallery ----------

/** A base's length in its square's corner: quiet when it's the season (most of them), loud when it isn't (PFD's gap: a column of
 *  "Season" hides the exceptions). */
export const FOCUS = "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-chyron-line";
/** Chosen, everywhere in the flow (DESIGN.md's full-screen flow): a white plate, a 3 px chyron-line outline, a tick. */
export const CHOSEN = "bg-plate text-plate-foreground outline outline-[3px] -outline-offset-[3px] outline-chyron-line";

// ---------- where you are (Round 2c: docs/design-round/wizard-r2c-steps.md) ----------

/** The three steps of starting a game, lit up to this one (DESIGN.md: progress segments in chyron-line), then where you are. Inline:
 *  it sits in the sheet's subtitle, a paragraph. */
export function StepLine({ step, text }: { step: 1 | 2 | 3; text: string }) {
  return (
    <span data-gallery-step={step} className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="inline-flex items-center gap-1" aria-hidden>
        {[1, 2, 3].map((n) => (
          <span key={n} className={`inline-block h-1 w-6 rounded-full ${n <= step ? "bg-chyron-line" : "bg-edge/50"}`} />
        ))}
      </span>
      <span>
        <span className="font-semibold text-foreground">Step {step} of 3</span> · {text}
      </span>
    </span>
  );
}

/** A decision's head: its question at section size, and the answer it has now. */
export function QuestionHead({ id, question, answer, detail }: { id: string; question: string; answer?: ReactNode; detail?: ReactNode }) {
  return (
    <div data-gallery-ask-head={id} className="mb-3">
      <h4 className="type-caption text-[26px] leading-[0.95]">{question}</h4>
      {answer ? <p className="mt-2 text-[16px] font-semibold leading-snug">{answer}</p> : null}
      {detail ? <p className="mt-0.5 text-[14px] leading-snug text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

/** An option to choose: a night panel with a hairline; chosen, the flow's white plate; can't be had, dashed with why. */
export function OptionCard({ data, title, line, note, chosen, off, tag, onPick }: { data: string; title: string; line?: ReactNode; note?: ReactNode; chosen: boolean; off?: string | null; tag?: string | null; onPick: () => void }) {
  return (
    <button
      type="button"
      data-gallery-option={data}
      data-chosen={chosen ? "" : undefined}
      aria-pressed={chosen}
      aria-disabled={!!off}
      onClick={() => !off && onPick()}
      className={`nd-press flex min-h-16 w-full flex-col justify-center rounded-[4px] px-3 py-2.5 text-left ${FOCUS} ${chosen ? CHOSEN : off ? "border border-dashed border-edge text-muted-foreground" : "bg-secondary outline-1 -outline-offset-1 outline-border"}`}
    >
      <span className="flex items-start justify-between gap-2">
        <b className="text-[16px] font-semibold leading-tight">{title}</b>
        <span className="flex flex-none items-center gap-1.5 pt-0.5">
          {tag ? <span className={`type-caption text-[12px] tracking-[0.05em] ${chosen ? "text-plate-muted" : "text-muted-foreground"}`}>{tag}</span> : null}
          {chosen ? <Check className="size-5" strokeWidth={3} aria-hidden /> : null}
        </span>
      </span>
      {off ? <span className="mt-1 text-[14px] leading-snug">{off}</span> : line ? <span className={`mt-1 text-[14px] leading-snug ${chosen ? "text-plate-muted" : "text-muted-foreground"}`}>{line}</span> : null}
      {note && !off ? <span className={`mt-1 text-[14px] font-semibold leading-snug ${chosen ? "text-plate-foreground" : "text-foreground"}`}>{note}</span> : null}
    </button>
  );
}

/** The season as one bar: the stages over their runs, the aired run folded (dashed), the chosen stretch one joined band (a bone
 *  outline, a faint fill: Start keeps the heavy fill), the rest, the finale. */
export function Timeline({ cells, stages }: { cells: Cell[]; stages: { id: string; label: string; under: string; cells: number }[] }) {
  const cols = `repeat(${cells.length}, minmax(0, 1fr))`;
  const ins = cells.map((c) => c.in);
  return (
    <div data-gallery-timeline>
      {stages.length > 0 && (
        <div className="mb-1.5 grid gap-x-1" style={{ gridTemplateColumns: cols }}>
          {stages.map((s, i) => (
            <div key={`${s.id}${i}`} className="min-w-0 border-l-2 border-foreground/50 pl-1.5" style={{ gridColumn: `span ${s.cells}` }}>
              <b className="type-caption line-clamp-2 block text-[14px] leading-tight tracking-[0.03em]">{s.label}</b>
              <span className="block truncate text-[12px] leading-tight text-muted-foreground">{s.under}</span>
            </div>
          ))}
        </div>
      )}
      <div className="grid" style={{ gridTemplateColumns: cols }}>
        {cells.map((c, i) => {
          const first = c.in && !ins[i - 1];
          const last = c.in && !ins[i + 1];
          return (
            <div
              key={c.key}
              data-cell={c.key}
              data-in={c.in ? "" : undefined}
              className={`flex min-h-[56px] min-w-0 flex-col justify-center px-1.5 ${
                c.aired
                  ? "mr-1 rounded-[3px] border border-dashed border-edge text-muted-foreground"
                  : c.in
                    ? `border-y-2 border-foreground bg-foreground/[0.08] ${first ? "rounded-l-[3px] border-l-2" : "border-l border-l-foreground/25"} ${last ? "rounded-r-[3px] border-r-2" : ""}`
                    : `border-y border-border text-muted-foreground ${i === cells.length - 1 ? "rounded-r-[3px] border-r" : ""} ${!ins[i - 1] ? "border-l" : ""}`
              }`}
            >
              <b className="type-caption truncate text-[20px] leading-none">{c.top}</b>
              <span className="mt-1 truncate text-[12px]">{c.under}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The whole run (a season, a team's games, every game left) is most of them, so it says nothing; anything shorter is an outlined
 *  tag (the critique: a bone fill means chosen, and "Season" on 45 squares hid the short ones). */
export const usualLen = (len: string) => /^(season|all season|their games|every game|every game left|the season|playoffs)$/i.test(len.trim());
export function LengthMark({ len }: { len: string }) {
  return usualLen(len) ? null : (
    <span data-length={len} className="type-caption rounded-[2px] px-1.5 py-[2px] text-[12px] tracking-[0.05em] outline-1 -outline-offset-1 outline-foreground">{len}</span>
  );
}

/** A base's square: its pictogram, its known name, its plain line, its length; dashed when it's coming or needs something. */
export function BaseSquare({ base, state, why, line, icon, onOpen }: { base: Base; state: "plays" | "coming" | "needs" | "off"; why?: string | null; line?: string; icon?: string; onOpen: () => void }) {
  const dashed = state !== "plays";
  return (
    <button
      type="button"
      data-gallery-base={base.id}
      data-state={state}
      onClick={onOpen}
      className={`nd-press flex flex-col rounded-[4px] p-3 text-left ${FOCUS} ${dashed ? "border border-dashed border-edge" : "bg-secondary hover:brightness-110"}`}
    >
      <span className="flex items-start justify-between gap-2">
        <Pictogram id={icon ?? base.id} className={`size-10 flex-none ${dashed ? "text-muted-foreground opacity-60" : "text-foreground"}`} />
        {state === "coming" ? (
          <span className="type-caption rounded-[2px] border border-edge px-1.5 py-[2px] text-[11px] tracking-[0.05em] text-muted-foreground">Coming</span>
        ) : (
          <LengthMark len={base.len} />
        )}
      </span>
      <b className={`type-caption mt-3 text-[21px] leading-[1] ${dashed ? "text-muted-foreground" : ""}`}>{base.name}</b>
      <span className={`mt-1.5 line-clamp-2 text-[15px] leading-snug ${dashed ? "text-muted-foreground" : ""}`}>{state === "needs" && why ? why : line ?? base.plain}</span>
    </button>
  );
}

/** The search field, which takes a description too. */
export function Finder({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex h-11 items-center gap-2 rounded-[4px] border border-input bg-background px-3 focus-within:border-chyron-line">
      <Search className="size-[18px] flex-none text-muted-foreground" aria-hidden />
      <input
        data-gallery-find
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Find a game, or describe one…"
        className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted-foreground"
        aria-label="Find a game, or describe one"
      />
      {value && (
        <button type="button" onClick={() => onChange("")} className="-mr-1 px-1 text-[13px] text-muted-foreground" data-gallery-find-clear>
          Clear
        </button>
      )}
    </label>
  );
}

/** A category's heading: its name, and what its games are in a line. */
export function CatHead({ id, name, says, n }: { id: string; name: string; says: string; n?: number }) {
  return (
    <div id={`cat-${id}`} data-gallery-cat={id} className="scroll-mt-14 pb-3 pt-8">
      <h3 className="type-caption text-[30px] leading-[0.95]">{name}</h3>
      <p className="mt-1.5 text-[15px] text-muted-foreground">
        {says}
        {n != null ? ` · ${n}` : ""}
      </p>
    </div>
  );
}

// ---------- a base's screen ----------

/** How much a game asks of everyone each week, as three bars (PFD R4: seen before it's read). */
export function EffortMark({ level }: { level: 0 | 1 | 2 | 3 }) {
  return (
    <span aria-hidden className="flex h-4 flex-none items-end gap-[3px]">
      {[1, 2, 3].map((i) => (
        <i key={i} className={`w-[5px] rounded-[1px] ${i <= level ? "bg-foreground" : "bg-input"}`} style={{ height: 5 + i * 3.5 }} />
      ))}
    </span>
  );
}

/** A small label over a part of a screen, in the captions' caps. */
export function Label({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <span className="type-caption text-[15px] tracking-[0.04em] text-muted-foreground">{children}</span>
      {aside}
    </div>
  );
}

/** The strip of the season: the stages named over their runs, the aired run as one cell, the next episodes with their dates, the
 *  rest, the finale; the game's stretch filled. */
export function Strip({ cells, stages }: { cells: Cell[]; stages: { id: string; label: string; under: string; cells: number }[] }) {
  const cols = `repeat(${cells.length}, minmax(0, 1fr))`;
  return (
    <div data-gallery-strip>
      {stages.length > 0 && (
        <div className="mb-1.5 grid gap-1" style={{ gridTemplateColumns: cols }}>
          {stages.map((s, i) => (
            <div key={`${s.id}${i}`} className="min-w-0 border-b border-foreground/60 pb-1" style={{ gridColumn: `span ${s.cells}` }}>
              <b className="block text-[12px] font-semibold leading-tight">{s.label}</b>
              <span className="block text-[11px] leading-tight text-muted-foreground">{s.under}</span>
            </div>
          ))}
        </div>
      )}
      <div className="grid gap-1" style={{ gridTemplateColumns: cols }}>
        {cells.map((c) => (
          <div
            key={c.key}
            data-cell={c.key}
            data-in={c.in ? "" : undefined}
            className={`flex min-h-[52px] min-w-0 flex-col justify-center rounded-[3px] px-1.5 ${c.aired ? "border border-dashed border-edge text-muted-foreground" : c.in ? "border-2 border-foreground bg-secondary" : "bg-secondary/50 text-muted-foreground"}`}
          >
            <b className="type-caption truncate text-[17px] leading-none">{c.top}</b>
            <span className="mt-1 truncate text-[11px] text-muted-foreground">{c.under}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** One pick among a few, in one sideways row; a choice that can't be had is dashed and says why when tapped. */
export function ChipRow({ items, value, onPick, data }: { items: { id: string; label: string; ok: boolean; why?: string | null; full?: string | null }[]; value: string; onPick: (id: string) => void; data: string }) {
  const [why, setWhy] = useState<string | null>(null);
  return (
    <div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]">
        {items.map((c) => (
          <button
            key={c.id}
            type="button"
            {...{ [`data-${data}`]: c.id }}
            aria-pressed={value === c.id}
            onClick={() => (c.ok ? (setWhy(null), onPick(c.id)) : setWhy(`${c.label}: ${c.full ?? c.why}`))}
            className={`inline-flex h-11 flex-none items-center rounded-[2px] px-3 text-[14px] font-semibold ${value === c.id ? "bg-foreground text-background" : c.ok ? "bg-secondary" : "border border-dashed border-edge text-muted-foreground"}`}
          >
            {c.label}
          </button>
        ))}
      </div>
      {why && (
        <p data-chip-why className="mt-2 text-[13px] leading-snug text-muted-foreground">
          {why}
        </p>
      )}
    </div>
  );
}

/** A setting that opens: its icon, its name, what it says now, and a mark when it changed (with Undo). */
export function RowLink({ icon, title, line, changed, onClick, onUndo, data }: { icon: string; title: string; line: string; changed?: boolean; onClick: () => void; onUndo?: () => void; data: string }) {
  return (
    <div className="flex items-center border-t border-border first:border-t-0">
      <button type="button" data-gallery-row={data} onClick={onClick} className="nd-press flex min-h-[60px] min-w-0 flex-1 items-center gap-3 py-2 text-left">
        <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-secondary">
          <Pictogram id={icon} className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <b className="flex items-center gap-2 text-[15px] font-semibold">
            {title}
            {changed && <em className="type-caption tag-slide rounded-[2px] bg-quiet-tag px-1.5 text-[11px] not-italic tracking-[0.05em] text-quiet-tag-foreground">Changed</em>}
          </b>
          <small className="mt-0.5 block truncate text-[13px] text-muted-foreground">{line}</small>
        </span>
        <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
      </button>
      {changed && onUndo && (
        <button type="button" data-gallery-undo={data} onClick={onUndo} className="ml-1 min-h-11 px-2 text-[13px] font-semibold underline decoration-1 underline-offset-[3px]">
          Undo
        </button>
      )}
    </div>
  );
}

// ---------- the bold pass's base screen (docs/design-round/wizard-r2b-shape.md) ----------

/** The title card: the game's name in title-card caps over the show's art, as the started game's own page opens (the same object:
 *  ui/title-card.ts's kicker, measured size and art); what it's also called; its plain sentence. */
export function TitleCard({ name, kicker, art, aka, sentence, mark }: { name: string; kicker?: string; art: string | null; aka: string[]; sentence: string; mark?: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const size = useTitleStep(ref, name);
  return (
    <div data-gallery-title className="relative -mx-4 -mt-2 overflow-hidden px-4 pb-3 pt-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- a show's art from wherever it was found (as the show's own page) */}
      {art && <img src={art} alt="" aria-hidden className="absolute inset-0 size-full object-cover" style={{ objectPosition: "center 25%" }} />}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-card/55 via-card/80 to-card" />
      <div className="relative">
        {kicker && <p className="type-caption truncate text-[11px] tracking-[0.08em] text-foreground">{kicker}</p>}
        <div className={`flex items-end justify-between gap-3 ${kicker ? "mt-1" : ""}`}>
          <h3 ref={ref} className="type-caption min-w-0 break-words leading-[0.86]" style={{ fontSize: size }}>
            {name}
          </h3>
          {mark}
        </div>
        {aka.length > 0 && <p className="mt-1.5 text-[14px] text-foreground/80">Also called {aka.slice(0, 3).join(", ")}</p>}
        <p data-gallery-about className="mt-2 text-[16px] leading-snug">{sentence}</p>
      </div>
    </div>
  );
}

/** Make it…: a goal per row, its next step said before the tap; it acts in place (a plus, not a chevron); dashed with why when
 *  nothing's left that way. */
export function MakeIt({ items }: { items: { goal: string; label: string; icon: ReactNode; next: string | null; why: string | null; onTap: () => void }[] }) {
  return (
    <div data-gallery-makeit className="flex flex-col">
      {items.map((it) => (
        <button key={it.goal} type="button" data-gallery-make={it.goal} data-off={it.next ? undefined : ""} aria-disabled={!it.next} onClick={() => it.next && it.onTap()} className={`nd-press flex min-h-16 w-full items-center gap-3 border-t border-border py-2 text-left first:border-t-0 ${FOCUS} ${it.next ? "" : "cursor-default"}`}>
          <span className={`grid size-10 flex-none place-items-center rounded-[3px] ${it.next ? "bg-secondary" : "border border-dashed border-edge text-muted-foreground"}`}>{it.icon}</span>
          <span className="min-w-0 flex-1">
            <b className={`block text-[16px] font-semibold ${it.next ? "" : "text-muted-foreground"}`}>{it.label}</b>
            <small className="block text-[14px] leading-snug text-muted-foreground">{it.next ? `Next: ${it.next}` : it.why}</small>
          </span>
          {it.next && (
            <span className="grid size-9 flex-none place-items-center rounded-full outline-1 -outline-offset-1 outline-input">
              <Plus className="size-[18px]" strokeWidth={2.5} aria-hidden />
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/** A rule, read as a line: what it is (small caps), what it's set to (the value, bold), the rest of its line; it opens its change.
 *  Changed with Undo where it changed. */
export function RuleLine({ icon, label, value, changed, onClick, onUndo, data }: { icon: string; label: string; value: string; changed?: boolean; onClick: () => void; onUndo?: () => void; data: string }) {
  const [head, ...rest] = value.split(" · ");
  return (
    <div className="flex items-center border-t border-border first:border-t-0">
      <button type="button" data-gallery-row={data} onClick={onClick} className={`nd-press flex min-h-[64px] min-w-0 flex-1 items-center gap-3 py-2 text-left ${FOCUS}`}>
        <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-secondary">
          <Pictogram id={icon} className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="type-caption text-[13px] tracking-[0.05em] text-muted-foreground">{label}</span>
            {changed && <em className="type-caption tag-slide rounded-[2px] bg-quiet-tag px-1.5 text-[11px] not-italic tracking-[0.05em] text-quiet-tag-foreground">Changed</em>}
          </span>
          <b className="block text-[16px] font-semibold leading-snug">{head}</b>
          {rest.length > 0 && <small className="block text-[14px] leading-snug text-muted-foreground">{rest.join(" · ")}</small>}
        </span>
        <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
      </button>
      {changed && onUndo && (
        <button type="button" data-gallery-undo={data} onClick={onUndo} className="ml-1 min-h-11 px-2 text-[13px] font-semibold underline decoration-1 underline-offset-[3px]">
          Undo
        </button>
      )}
    </div>
  );
}

/** The Start bar: the stretch and the first lock, Start (the one yellow), and asking the couch first beside who it tells. */
/** The heart beside Start: saves the game to Community and saved games, to start again another time (the user, 2026-11-18). The
 *  square stays outlined either way, so Start is still the one heavy fill; the heart itself fills when it's saved. */
export function SaveHeart({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button type="button" data-gallery-save aria-pressed={on} aria-label={on ? "Saved. Tap to take it off your saved games" : "Save this game"} title={on ? "Saved" : "Save"} onClick={onToggle} className={`nd-press grid size-[52px] flex-none place-items-center rounded-[3px] outline-1 -outline-offset-1 outline-input ${FOCUS}`}>
      <Heart className="size-6" strokeWidth={2.25} fill={on ? "currentColor" : "none"} aria-hidden />
    </button>
  );
}

export function StartBar({ line, label, tells, asked, onStart, onAsk, disabled, busy, save, warn }: { line: string; label: string; tells: string; asked: string | null; onStart: () => void; onAsk?: (() => void) | null; disabled?: string | null; busy?: boolean; save?: { on: boolean; onToggle: () => void }; warn?: { text: string; fix: { label: string; onClick: () => void } | null; blocks?: boolean } | null }) {
  return (
    <div data-gallery-startbar>
      <p className={`truncate text-center text-[14px] text-muted-foreground ${warn && !disabled ? "mb-0.5" : "mb-2"}`} data-gallery-stretch>
        {disabled ?? line}
      </p>
      {warn && !disabled && (
        <p data-gallery-start-warn className="mb-1 flex flex-wrap items-center justify-center gap-x-1.5 text-center text-[14px] leading-snug">
          <span>{warn.text}</span>
          {warn.fix && (
            <button type="button" data-gallery-start-fix onClick={warn.fix.onClick} className={`min-h-11 font-semibold underline decoration-1 underline-offset-[3px] ${FOCUS}`}>
              {warn.fix.label}
            </button>
          )}
        </p>
      )}
      <div className="flex gap-2">
        {save && <SaveHeart on={save.on} onToggle={save.onToggle} />}
        <button type="button" data-gallery-start onClick={onStart} disabled={!!disabled || busy || !!warn?.blocks} className="nd-press type-caption flex h-[52px] min-w-0 flex-1 items-center justify-center rounded-[3px] bg-chyron px-4 text-[20px] text-chyron-foreground hover:brightness-110 disabled:bg-secondary disabled:text-muted-foreground">
          <span className="truncate">{busy ? "Starting…" : label}</span>
        </button>
      </div>
      {asked ? (
        <p data-gallery-asked className="mt-2 text-center text-[13px] text-muted-foreground">
          {asked}
        </p>
      ) : (
        <div className={`mt-2 flex items-center gap-3 ${onAsk ? "justify-between" : "justify-center"}`}>
          <span className="min-w-0 text-[13px] text-muted-foreground">{tells}</span>
          {onAsk && (
            <button type="button" data-gallery-ask onClick={onAsk} className="nd-press h-11 flex-none rounded-[3px] px-3 text-[14px] font-bold outline-1 -outline-offset-1 outline-input">
              Ask the couch first
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- a change ----------

/** A change's square: its icon, its name, its effect; bone when chosen, dashed with why when it can't be had. */
export function ChoiceSquare({ c, chosen, onPick }: { c: ChangeState; chosen: boolean; onPick: () => void }) {
  const off = !!c.why && !chosen;
  return (
    <button
      type="button"
      data-gallery-choice={c.id}
      data-chosen={chosen ? "" : undefined}
      data-off={off ? "" : undefined}
      onClick={onPick}
      aria-pressed={chosen}
      className={`nd-press flex min-h-[112px] flex-col rounded-[4px] p-3 text-left ${FOCUS} ${chosen ? CHOSEN : off ? "border border-dashed border-edge text-muted-foreground" : "bg-secondary"}`}
    >
      <span className="flex items-start justify-between gap-2">
        <Pictogram id={c.icon} className={`size-8 ${off ? "opacity-55" : ""}`} />
        {chosen && <Check className="size-5" strokeWidth={3} aria-hidden />}
        {c.coming && !chosen && <span className="type-caption text-[11px] tracking-[0.05em]">Coming</span>}
      </span>
      <b className="mt-auto pt-2 text-[15px] font-semibold leading-tight">{c.name}</b>
      <span className={`mt-0.5 text-[14px] leading-snug ${chosen ? "text-plate-muted" : "text-muted-foreground"}`}>{off ? c.why : c.line}</span>
    </button>
  );
}

const fmtNum = (v: unknown) => (typeof v === "number" ? (v >= 1000 ? v.toLocaleString("en-US") : String(v)) : String(v));

/** One control, held to the engine's range (the user, 2026-11-17): a segmented choice whose words carry the consequence, chips with
 *  Other…, a stepper, a switch, words, or a checklist. */
export function ControlView({ k, onSet }: { k: Control; onSet: (v: unknown) => void }) {
  const [other, setOther] = useState<string | null>(null);
  const value = k.value ?? k.def;
  if (k.kind === "segment" && k.options) {
    const opts = k.options;
    const chosen = opts.find((o) => String(o[0]) === String(value));
    return (
      <div data-control={k.id}>
        <span className="mb-1.5 block text-[13px] font-semibold">{k.label}</span>
        <div role="radiogroup" aria-label={k.label} className={`grid gap-1 rounded-[4px] bg-background p-1 ${opts.length === 4 ? "grid-cols-2" : opts.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
          {opts.map((o) => {
            const on = String(o[0]) === String(value);
            return (
              <button key={String(o[0])} type="button" role="radio" aria-checked={on} data-option={String(o[0])} onClick={() => onSet(o[0])} className={`min-h-11 rounded-[3px] px-2 py-1.5 text-[14px] font-semibold leading-tight ${on ? "bg-foreground text-background" : "text-foreground"}`}>
                {o[1]}
              </button>
            );
          })}
        </div>
        {chosen?.[2] && <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">{chosen[2]}</p>}
      </div>
    );
  }
  if (k.kind === "chips" && k.options) {
    const known = k.options.some((o) => String(o[0]) === String(value));
    return (
      <div data-control={k.id}>
        <span className="mb-1.5 block text-[13px] font-semibold">{k.label}</span>
        <div className="flex flex-wrap gap-2">
          {k.options.map((o) => (
            <button key={String(o[0])} type="button" aria-pressed={String(o[0]) === String(value)} data-option={String(o[0])} onClick={() => (setOther(null), onSet(o[0]))} className={`inline-flex h-11 items-center rounded-[2px] px-3 text-[14px] font-semibold ${String(o[0]) === String(value) ? "bg-foreground text-background" : "bg-background"}`}>
              {o[1]}
            </button>
          ))}
          {k.other && (
            <button type="button" aria-pressed={!known} data-option="other" onClick={() => setOther(known ? "" : String(value))} className={`inline-flex h-11 items-center rounded-[2px] px-3 text-[14px] font-semibold ${!known ? "bg-foreground text-background" : "bg-background"}`}>
              {!known ? fmtNum(value) : "Other…"}
            </button>
          )}
        </div>
        {other !== null && k.other && (
          <div className="mt-2 flex items-center gap-2">
            <input
              data-control-other={k.id}
              inputMode="decimal"
              autoFocus
              value={other}
              onChange={(e) => setOther(e.target.value)}
              className="h-11 w-28 rounded-[4px] border border-input bg-background px-3 text-[16px] outline-none focus:border-chyron-line"
              aria-label={`${k.label}, ${k.other.min} to ${fmtNum(k.other.max)}`}
            />
            <span className="text-[13px] text-muted-foreground">
              {k.other.min} to {fmtNum(k.other.max)}
            </span>
            <button
              type="button"
              className="ml-auto h-11 rounded-[3px] bg-foreground px-3 text-[14px] font-semibold text-background disabled:opacity-40"
              disabled={!(Number(other) >= k.other.min && Number(other) <= k.other.max)}
              onClick={() => {
                onSet(Number(other));
                setOther(null);
              }}
            >
              Set
            </button>
          </div>
        )}
      </div>
    );
  }
  if (k.kind === "stepper" && k.range) {
    const n = Number(value) || 0;
    const [lo, hi] = k.range;
    return (
      <div data-control={k.id} className="flex items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold">{k.label}</span>
          <span className="block text-[12px] text-muted-foreground">
            {lo} to {hi}
          </span>
        </span>
        <span className="flex flex-none items-center gap-1">
          <button type="button" aria-label={`Fewer: ${k.label}`} disabled={n <= lo} onClick={() => onSet(n - 1)} className="grid size-11 place-items-center rounded-[3px] bg-background disabled:opacity-35">
            <Minus className="size-4" aria-hidden />
          </button>
          <b className="type-caption w-9 text-center text-[22px] tabular-nums">{n}</b>
          <button type="button" aria-label={`More: ${k.label}`} disabled={n >= hi} onClick={() => onSet(n + 1)} className="grid size-11 place-items-center rounded-[3px] bg-background disabled:opacity-35">
            <Plus className="size-4" aria-hidden />
          </button>
        </span>
      </div>
    );
  }
  if (k.kind === "switch") {
    const on = !!value;
    return (
      <button type="button" role="switch" aria-checked={on} data-control={k.id} onClick={() => onSet(!on)} className="flex min-h-11 w-full items-center justify-between gap-3 text-left">
        <span className="text-[13px] font-semibold">{k.label}</span>
        <i aria-hidden className={`relative h-6 w-10 flex-none rounded-full ${on ? "bg-foreground" : "border border-edge"}`}>
          <i className={`absolute top-[3px] size-[18px] rounded-full transition-transform duration-150 ${on ? "translate-x-[19px] bg-background" : "translate-x-[3px] bg-muted-foreground"}`} />
        </i>
      </button>
    );
  }
  if (k.kind === "checklist" && k.options) {
    const list = Array.isArray(value) ? value.map(String) : [];
    return (
      <div data-control={k.id}>
        <span className="mb-1.5 block text-[13px] font-semibold">{k.label}</span>
        {k.options.map((o) => {
          const on = list.includes(String(o[0]));
          return (
            <button key={String(o[0])} type="button" role="checkbox" aria-checked={on} data-option={String(o[0])} onClick={() => onSet(on ? list.filter((x) => x !== String(o[0])) : [...list, String(o[0])])} className="flex min-h-11 w-full items-center gap-3 border-t border-border/70 text-left first-of-type:border-t-0">
              <span className={`grid size-[22px] flex-none place-items-center rounded-[3px] border ${on ? "border-foreground bg-foreground text-background" : "border-edge"}`}>{on && <Check className="size-4" strokeWidth={3} aria-hidden />}</span>
              <span className="text-[14px]">{o[1]}</span>
            </button>
          );
        })}
      </div>
    );
  }
  if (k.kind === "text") {
    return (
      <label data-control={k.id} className="block">
        <span className="mb-1.5 block text-[13px] font-semibold">{k.label}</span>
        <input defaultValue={value == null ? "" : String(value)} maxLength={k.max} onBlur={(e) => onSet(e.target.value || null)} className="h-11 w-full rounded-[4px] border border-input bg-background px-3 text-[16px] outline-none focus:border-chyron-line" />
        <span className="mt-1 block text-[12px] text-muted-foreground">Up to {k.max} letters</span>
      </label>
    );
  }
  return null;
}

/** A change's controls under its square: the common ones, then More options. */
export function Controls({ controls, onSet }: { controls: Control[]; onSet: (id: string, v: unknown) => void }) {
  const [more, setMore] = useState(false);
  const main = controls.filter((k) => !k.more);
  const rest = controls.filter((k) => k.more);
  if (!controls.length) return null;
  return (
    <div data-gallery-controls className="col-span-2 flex flex-col gap-4 rounded-[4px] bg-secondary/60 p-3">
      {main.map((k) => (
        <ControlView key={k.id} k={k} onSet={(v) => onSet(k.id, v)} />
      ))}
      {rest.length > 0 && (
        <>
          <button type="button" data-gallery-more-options onClick={() => setMore(!more)} className="flex items-center gap-1 text-[13px] font-semibold text-muted-foreground">
            More options <ChevronDown className={`size-4 transition-transform ${more ? "rotate-180" : ""}`} aria-hidden />
          </button>
          {more && rest.map((k) => <ControlView key={k.id} k={k} onSet={(v) => onSet(k.id, v)} />)}
        </>
      )}
    </div>
  );
}
