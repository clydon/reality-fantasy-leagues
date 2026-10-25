"use client";

import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { airTime } from "../clock";
import { NavLink, useNav } from "../nav";
import { Btn, Chip } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { deskSend, useAfterDesk, type DeskLine } from "./data";

// The desk's small parts (the mock's community.js admin: .adm-top, .adm-item, .adm-h, the Override sheet, the Lock row),
// and the answer fields the rulebook editor's sheets are built from.

/** The desk's header: back, the title, and the Admin badge (not for someone the desk turns away). */
export function DeskHeader({ title, back, badge = true }: { title: string; back: { label: string; href: string }; badge?: boolean }) {
  const nav = useNav();
  return (
    <header className="sticky top-0 z-20 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center border-b border-border bg-[rgba(22,20,29,.92)] px-2.5 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md">
      <button type="button" onClick={() => nav.back(back.href)} className="flex h-14 min-w-0 items-center gap-0.5 justify-self-start rounded-[3px] pl-1 pr-2.5 text-[15px] font-semibold">
        <ChevronLeft className="size-5 flex-none" aria-hidden />
        <span className="truncate">{back.label}</span>
      </button>
      <h1 className="type-caption max-w-[46vw] truncate text-[20px]">{title}</h1>
      {badge ? <span className="type-caption justify-self-end rounded-[2px] bg-foreground px-2 py-0.5 text-[12px] tracking-[0.06em] text-background">Admin</span> : <span />}
    </header>
  );
}

const TAG = {
  must: "bg-chyron text-chyron-foreground",
  quiet: "bg-secondary text-foreground",
  good: "bg-good text-background",
  bad: "bg-live text-live-foreground",
};

/** A caption tag, the Lower Third's angled cut. */
export function Tag({ tone = "quiet", children }: { tone?: keyof typeof TAG; children: ReactNode }) {
  return (
    <span className={`type-caption inline-flex h-7 flex-none items-center whitespace-nowrap py-0 pl-2.5 pr-4 text-[12px] tracking-[0.06em] [clip-path:polygon(0_0,100%_0,calc(100%_-_8px)_100%,0_100%)] ${TAG[tone]}`}>
      {children}
    </span>
  );
}

/** A row that opens one thing: an optional tag, a title, a line. */
export function ItemRow({ href, tag, tone, title, line, data }: { href: string; tag?: string; tone?: keyof typeof TAG; title: ReactNode; line?: ReactNode; data?: string }) {
  return (
    <NavLink href={href} data-desk-item={data} className="nd-press flex min-h-[64px] items-center gap-3 border-t border-border py-2.5 first:border-t-0">
      {tag && <Tag tone={tone}>{tag}</Tag>}
      <span className="min-w-0 flex-1">
        <b className="block text-[16px] font-semibold leading-snug">{title}</b>
        {line && <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{line}</small>}
      </span>
      <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
    </NavLink>
  );
}

/** A section with a heading and an aside (the mock's .blk .sh). */
export function Section({ title, aside, children, className = "" }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`mt-6 px-4 ${className}`}>
      {title && (
        <div className="mb-2.5 flex items-baseline justify-between gap-3">
          <h2 className="type-caption text-[24px]">{title}</h2>
          {aside != null && <span className="text-[13px] text-muted-foreground">{aside}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

/** A field you can override: what it is, what it says, and Override. */
export function FieldRow({ label, value, onOverride, data }: { label: string; value: ReactNode; onOverride?: () => void; data?: string }) {
  return (
    <div data-field={data} className="flex min-h-[60px] items-center gap-3 border-t border-border py-2 first:border-t-0">
      <span className="min-w-0 flex-1">
        <small className="block text-[12.5px] text-muted-foreground">{label}</small>
        <b className="block text-[15px] font-semibold leading-snug">{value}</b>
      </span>
      {onOverride && (
        <button type="button" data-override={data} onClick={onOverride} className="nd-press h-11 rounded-[3px] px-3 text-[14px] font-bold text-chyron-line">
          Override
        </button>
      )}
    </div>
  );
}

/** Lock: on, couches can't change it; the line says what that means here. */
export function LockRow({ locked, on, off, onChange }: { locked: boolean; on: string; off: string; onChange: (locked: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={locked} data-lock={locked ? "on" : "off"} onClick={() => onChange(!locked)} className="nd-press flex min-h-[64px] w-full items-center gap-3 rounded-[4px] bg-card p-3.5 text-left">
      <span className="min-w-0 flex-1">
        <b className="block text-[16px]">Lock</b>
        <small className="block text-[13px] leading-snug text-muted-foreground">{locked ? on : off}</small>
      </span>
      <span className={`relative h-[30px] w-[52px] flex-none rounded-full transition-colors ${locked ? "bg-foreground" : "bg-secondary"}`}>
        <i className={`absolute top-[3px] size-6 rounded-full transition-[left] ${locked ? "left-[25px] bg-background" : "left-[3px] bg-muted-foreground"}`} />
      </span>
    </button>
  );
}

/** A switch with its title and a line on what it means now (the bot's schedule and its runs, step 6c). */
export function SwitchRow({ on, title, line, onChange, data, disabled }: { on: boolean; title: string; line: string; onChange: (on: boolean) => void; data?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      data-switch={data}
      data-on={on ? "on" : "off"}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="nd-press flex min-h-[64px] w-full items-center gap-3 rounded-[4px] bg-card p-3.5 text-left disabled:opacity-60"
    >
      <span className="min-w-0 flex-1">
        <b className="block text-[16px]">{title}</b>
        <small className="block text-[13px] leading-snug text-muted-foreground">{line}</small>
      </span>
      <span className={`relative h-[30px] w-[52px] flex-none rounded-full transition-colors ${on ? "bg-foreground" : "bg-secondary"}`}>
        <i className={`absolute top-[3px] size-6 rounded-full transition-[left] ${on ? "left-[25px] bg-background" : "left-[3px] bg-muted-foreground"}`} />
      </span>
    </button>
  );
}

/** History: newest first, each line with when, and Undo on the desk's own changes. */
export function History({ lines, emptyLine = "Nothing yet." }: { lines: DeskLine[]; emptyLine?: string }) {
  const after = useAfterDesk();
  const [busy, setBusy] = useState<string | null>(null);
  if (!lines.length) return <p className="text-[14px] text-muted-foreground">{emptyLine}</p>;
  return (
    <div data-history>
      {lines.map((l, i) => (
        <div key={l.id ?? `${l.at}-${i}`} data-history-line={l.id ?? undefined} className="flex min-h-12 items-center gap-3 border-t border-border py-2 first:border-t-0">
          <span className={`min-w-0 flex-1 ${l.undone ? "opacity-60" : ""}`}>
            <span className={`block text-[14px] leading-snug ${l.undone ? "line-through" : ""}`}>{l.text}</span>
            <small className="block text-[12px] text-muted-foreground">
              {[l.who, airTime(Date.parse(l.at)), l.undone ? "undone" : null].filter(Boolean).join(" · ")}
            </small>
          </span>
          {l.undoable && l.id && (
            <Btn
              data-undo-desk={l.id}
              className="h-10 px-3 text-[14px]"
              disabled={busy === l.id}
              onClick={async () => {
                setBusy(l.id);
                try {
                  await deskSend(`/changes/${l.id}/undo`, {});
                  await after();
                  toast("Undone");
                } catch (e) {
                  toast((e as Error).message);
                } finally {
                  setBusy(null);
                }
              }}
            >
              Undo
            </Btn>
          )}
        </div>
      ))}
    </div>
  );
}

/** Override: one field, what it reaches, and Save. */
export function OverrideSheet({
  open,
  onClose,
  title,
  reach,
  label,
  value,
  choices,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  reach: string;
  label: string;
  value: string;
  choices?: string[];
  onSave: (value: string) => Promise<void>;
}) {
  const [text, setText] = useState(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={`Override · ${title}`} subtitle={`Reaches: ${reach}`}>
      <label className="flex flex-col gap-1.5">
        <span className="type-caption text-[13px] text-muted-foreground">{label}</span>
        <input data-override-input value={text} onChange={(e) => setText(e.target.value)} className="h-12 rounded-[3px] bg-background px-3 text-base outline-1 -outline-offset-1 outline-input" />
      </label>
      {choices && choices.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {choices.map((c) => (
            <Chip key={c} on={c === text} onClick={() => setText(c)} className="h-10">
              {c}
            </Chip>
          ))}
        </div>
      )}
      <p className="mt-3 text-[13px] leading-snug text-muted-foreground">Saved as an admin override: it wins over couch edits and research, and it&apos;s in the history with undo.</p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <Btn
        data-override-save
        tone="must"
        wide
        className="mt-3"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await onSave(text.trim());
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Save override
      </Btn>
    </Sheet>
  );
}

// ---------- answer fields, for the rulebook editor ----------

/** One question with fixed choices, as chips; the chosen one's help under it. */
export function Choice({ label, value, options, onChange, data }: { label: string; value: string | undefined; options: [string, string, string][]; onChange: (v: string) => void; data?: string }) {
  const help = options.find((o) => o[0] === value)?.[2];
  return (
    <div data-question={data} className="mt-4 first:mt-0">
      <b className="block text-[15px]">{label}</b>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map(([v, l]) => (
          <Chip key={v} data-answer={v} on={v === value} onClick={() => onChange(v)} className="h-11">
            {l}
          </Chip>
        ))}
      </div>
      {help && <small className="mt-1.5 block text-[13px] leading-snug text-muted-foreground">{help}</small>}
    </div>
  );
}

/** One question with several answers, as chips that toggle. */
export function Multi({ label, value, options, onChange, data }: { label: string; value: string[]; options: [string, string, string][]; onChange: (v: string[]) => void; data?: string }) {
  return (
    <div data-question={data} className="mt-4 first:mt-0">
      <b className="block text-[15px]">{label}</b>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map(([v, l]) => (
          <Chip key={v} data-answer={v} on={value.includes(v)} onClick={() => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])} className="h-11">
            {l}
          </Chip>
        ))}
      </div>
    </div>
  );
}

/** A text answer (16px, so a phone doesn't zoom). */
export function Text({ label, value, onChange, placeholder, data, multiline }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; data?: string; multiline?: boolean }) {
  const cls = "w-full rounded-[3px] bg-background px-3 text-base outline-1 -outline-offset-1 outline-input";
  return (
    <label data-question={data} className="mt-4 flex flex-col gap-1.5 first:mt-0">
      <b className="text-[15px]">{label}</b>
      {multiline ? (
        <textarea data-text={data} rows={2} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={`${cls} py-2.5`} />
      ) : (
        <input data-text={data} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={`${cls} h-12`} />
      )}
    </label>
  );
}

/** A number, with − and + (44px each). `step` for points (0.5). */
export function Stepper({ label, value, onChange, min = 0, max = 999, step = 1, data }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; data?: string }) {
  const set = (v: number) => onChange(Math.max(min, Math.min(max, Math.round(v / step) * step)));
  return (
    <div data-question={data} className="mt-4 flex items-center gap-3 first:mt-0">
      <b className="min-w-0 flex-1 text-[15px]">{label}</b>
      <button type="button" aria-label="Less" data-step="-1" onClick={() => set(value - step)} className="grid size-11 place-items-center rounded-[3px] bg-secondary">
        <Minus className="size-4" aria-hidden />
      </button>
      <b data-value className="type-num w-14 text-center text-[22px]">
        {value > 0 && step < 1 ? `+${value}` : value}
      </b>
      <button type="button" aria-label="More" data-step="1" onClick={() => set(value + step)} className="grid size-11 place-items-center rounded-[3px] bg-secondary">
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}
