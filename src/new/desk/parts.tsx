"use client";

import { useEffect, useState, type ComponentProps, type ComponentType, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus, Trash2 } from "lucide-react";
import { airTime } from "../clock";
import { NavLink, useNav } from "../nav";
import { Btn, Chip } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { deskSend, useAfterDesk, type DeskLine, type PersonRow } from "./data";
import { useDeskTrail } from "./trail";

// The desk's small parts (the mock's community.js admin: .adm-top, .adm-item, .adm-h, the Override sheet, the Lock row),
// the frame every desk page shares (docs/PLAN-desk-parity.md, The desk's pages and how they link; the mock's desk.js and
// desk-pages.js: a lower third naming the thing, a line of facts, what it's part of and made of as links, its actions,
// History's latest three, and its Delete, last and named; Back names the page you came from), and the answer fields the
// rulebook editor's sheets are built from.

/** The small tags beside a name (the mock's .dk-t): You or Site admin, Waiting, Can't sign in. */
export function PersonTags({ p }: { p: Pick<PersonRow, "you" | "admin" | "waiting" | "stopped"> }) {
  const tag = "type-caption ml-1.5 inline-block rounded-[2px] px-1.5 pb-0.5 pt-[3px] align-[2px] text-[11px] not-italic leading-none tracking-[0.06em]";
  return (
    <>
      {(p.you || p.admin) && <i className={`${tag} bg-foreground text-background`}>{p.you ? "You" : "Site admin"}</i>}
      {p.waiting && <i className={`${tag} text-foreground outline-1 -outline-offset-1 outline-foreground`}>Waiting</i>}
      {p.stopped && <i className={`${tag} text-muted-foreground outline-1 -outline-offset-1 outline-input`}>Can&apos;t sign in</i>}
    </>
  );
}

/** What a sheet says first (the mock's .cons). */
export function Says({ children, data }: { children: ReactNode; data?: string }) {
  return (
    <p data-says={data} className="rounded-[3px] bg-background p-3 text-[16px] leading-normal">
      {children}
    </p>
  );
}

/** `v`, once it has stopped changing for `ms` (a search as you type). */
export function useDebounced<T>(v: T, ms: number): T {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

/** A desk change's toast, with Undo when it has one (History's Undo, through the change's id). */
export function useChangeToast() {
  const after = useAfterDesk();
  return (text: string, changeId?: string | null) =>
    toast(
      text,
      changeId
        ? {
            undo: async () => {
              try {
                await deskSend(`/changes/${changeId}/undo`, {});
                await after();
                toast("Undone");
              } catch (e) {
                toast.quiet((e as Error).message);
              }
            },
          }
        : {}
    );
}

/** "now", "12 minutes ago", "2 hours ago", "yesterday", "6 days ago", else "Oct 9". */
export function agoOf(iso: string | null, now = Date.now()): string {
  if (!iso) return "never";
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (m < 2) return "just now";
  if (m < 60) return `${m} minutes ago`;
  if (m < 120) return "an hour ago";
  if (m < 1440) return `${Math.floor(m / 60)} hours ago`;
  if (m < 2880) return "yesterday";
  if (m < 10080) return `${Math.round(m / 1440)} days ago`;
  return dateOf(iso);
}

/** "Oct 9" (this year), else "Oct 9, 2025". */
export function dateOf(iso: string, now = new Date()): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(d.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }) });
}

/**
 * The desk's header: Back, the title, and the Admin badge (not for someone the desk turns away). Back names the page you
 * came from on the desk (trail.ts), else `back`, the page's parent. `name` is this page's name on the trail (riley, Couch
 * Council; the title when not given; null while it loads); `kind` keeps one thing's page in Find's Recently opened;
 * `start`: one of the tabs, which start the trail.
 */
export function DeskHeader({
  title,
  back,
  badge = true,
  name,
  kind,
  start,
}: {
  title: string;
  back: { label: string; href: string };
  badge?: boolean;
  name?: string | null;
  kind?: string;
  start?: boolean;
}) {
  const nav = useNav();
  const prev = useDeskTrail(name === undefined ? title : name, { start, kind });
  const to = prev ?? { path: back.href.split("?")[0], href: back.href, label: back.label };
  return (
    <header className="sticky top-0 z-20 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center border-b border-border bg-background/92 px-2.5 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md">
      <button
        type="button"
        data-desk-back={to.label}
        onClick={() => nav.back(to.href, (p) => p === to.path)}
        className="flex h-14 min-w-0 max-w-full items-center gap-0.5 justify-self-start rounded-[3px] pl-1 pr-2.5 text-[15px] font-semibold"
      >
        <ChevronLeft className="size-5 flex-none" aria-hidden />
        <span className="truncate">{to.label}</span>
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
export function Tag({ tone = "quiet", children, className = "" }: { tone?: keyof typeof TAG; children: ReactNode; className?: string }) {
  return (
    <span className={`type-caption inline-flex h-7 flex-none items-center whitespace-nowrap py-0 pl-2.5 pr-4 text-[12px] tracking-[0.06em] [clip-path:polygon(0_0,100%_0,calc(100%_-_8px)_100%,0_100%)] ${TAG[tone]} ${className}`}>
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

// ---------- the page frame ----------

const LT_TONE = {
  quiet: "bg-secondary text-foreground",
  you: "bg-background text-foreground",
  stopped: "bg-input text-foreground",
  must: "bg-chyron text-chyron-foreground",
};

/** Who or what the page is, as a lower third: a face or art, then a caption plate with its tag, name and one line. */
export function LowerThird({ lead, tag, tone = "quiet", title, detail }: { lead?: ReactNode; tag: string; tone?: keyof typeof LT_TONE; title: ReactNode; detail?: ReactNode }) {
  return (
    <section data-lower-third={tag} className="mt-4 flex items-center gap-2.5 px-4">
      {lead}
      <div className="flex min-h-16 min-w-0 flex-1 items-stretch overflow-hidden rounded-[3px] bg-plate text-plate-foreground shadow-plate">
        <span className={`type-caption tag-cut flex flex-none items-center whitespace-nowrap pl-[11px] pr-6 text-[14px] tracking-[0.04em] ${LT_TONE[tone]}`}>{tag}</span>
        <span className="tag-tuck flex min-w-0 flex-1 flex-col justify-center gap-[3px] py-2 pl-5 pr-2.5">
          <b data-lower-third-name className="type-caption truncate text-[24px] leading-none">
            {title}
          </b>
          {detail && <small className="truncate text-[13px] text-plate-muted">{detail}</small>}
        </span>
      </div>
    </section>
  );
}

/** The line of facts under the lower third (joined, active, how many). */
export function Facts({ children }: { children: ReactNode }) {
  return (
    <p data-facts className="mt-2.5 px-4 text-[13px] leading-snug text-muted-foreground">
      {children}
    </p>
  );
}

/** A row's icon in its square. */
export function IconLead({ icon: Icon }: { icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }> }) {
  return (
    <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-card">
      <Icon className="size-5" aria-hidden />
    </span>
  );
}

/**
 * One row on a desk page (the mock's .idx.dk-l): a lead (an icon, a face, art), a title with one line, and a chevron when
 * it goes somewhere. A link with `href`, a button with `onClick`, else just what it says. `dot`: off its recommended
 * setting (true), or the row to act on for something in the Inbox ("need").
 */
export function DeskRow({
  href,
  onClick,
  lead,
  title,
  line,
  end,
  dot,
  data,
}: {
  href?: string;
  onClick?: () => void;
  lead?: ReactNode;
  title: ReactNode;
  line?: ReactNode;
  end?: ReactNode;
  dot?: boolean | "need";
  data?: string;
}) {
  const cls = "nd-press flex min-h-[62px] w-full items-center gap-3 border-t border-border py-2.5 text-left first:border-t-0";
  const body = (
    <>
      {lead}
      <span className="min-w-0 flex-1">
        <b className="line-clamp-2 block text-[16px] font-semibold leading-snug">
          {title}
          {dot && <i data-off={dot === "need" ? "need" : ""} className="ml-2 inline-block size-2 rounded-full bg-chyron align-[2px]" aria-label={dot === "need" ? "Needs you" : "Changed from recommended"} />}
        </b>
        {line && <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{line}</small>}
      </span>
      {end}
      {(href || onClick) && <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />}
    </>
  );
  if (href)
    return (
      <NavLink href={href} data-desk-row={data} className={cls}>
        {body}
      </NavLink>
    );
  if (onClick)
    return (
      <button type="button" data-desk-row={data} onClick={onClick} className={cls}>
        {body}
      </button>
    );
  return (
    <div data-desk-row={data} className={cls}>
      {body}
    </div>
  );
}

/** History's latest three, and All N in a sheet. */
export function LatestHistory({ lines, emptyLine }: { lines: DeskLine[]; emptyLine?: string }) {
  const [all, setAll] = useState(false);
  return (
    <Section
      title="History"
      aside={
        lines.length > 3 ? (
          <button type="button" data-history-all onClick={() => setAll(true)} className="text-[14px] font-bold text-foreground underline decoration-input underline-offset-[3px]">
            All {lines.length}
          </button>
        ) : undefined
      }
    >
      <History lines={lines.slice(0, 3)} emptyLine={emptyLine} />
      <Sheet open={all} onOpenChange={setAll} title="History" subtitle={`${lines.length} lines, newest first`}>
        <History lines={lines} />
      </Sheet>
    </Section>
  );
}

/** The last thing on every desk page (decision 4): Delete, named, with one line of what it does. `off`: why it can't be. */
export function DeleteRow({ title, line, onClick, off, data }: { title: string; line: string; onClick?: () => void; off?: boolean; data?: string }) {
  const inner = (
    <>
      <span className={`grid size-10 flex-none place-items-center rounded-[3px] ${off ? "bg-secondary text-muted-foreground" : "bg-live/15 text-live"}`}>
        <Trash2 className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <b className={`block text-[16px] font-bold ${off ? "text-muted-foreground" : "text-live"}`}>{title}</b>
        <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{line}</small>
      </span>
      {!off && <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />}
    </>
  );
  const cls = "flex min-h-[66px] w-full items-center gap-3 border-y border-border text-left";
  return (
    <section className="mt-11 px-4" data-delete-row={data}>
      {off || !onClick ? (
        <div className={cls}>{inner}</div>
      ) : (
        <button type="button" onClick={onClick} className={`nd-press ${cls}`}>
          {inner}
        </button>
      )}
    </section>
  );
}

/** One choice in a setting's sheet: what it is, Recommended when it is, and what it does. */
export function ChoiceCard({ on, title, line, recommended, onClick, attrs }: { on: boolean; title: string; line?: string; recommended?: boolean; onClick: () => void; attrs: Record<string, string> }) {
  return (
    <button type="button" {...attrs} aria-pressed={on} onClick={onClick} className={`nd-press rounded-[3px] p-3.5 text-left ${on ? "outline-2 -outline-offset-2 outline-foreground" : "bg-background"}`}>
      <b className="block text-[16px]">
        {title}
        {recommended && <i className="type-caption ml-1.5 inline-block rounded-[2px] bg-secondary px-1.5 pb-0.5 pt-[3px] align-[2px] text-[11px] not-italic leading-none tracking-[0.06em]">Recommended</i>}
      </b>
      {line && <small className="text-[13px] leading-snug text-muted-foreground">{line}</small>}
    </button>
  );
}

/** A field in a desk sheet (the mock's .dk-fl): its label, the input at 16px, a line under it or its problem. */
export function Field({ label, hint, error, data, ...input }: { label: ReactNode; hint?: string; error?: string | null; data: string } & Omit<ComponentProps<"input">, "className">) {
  return (
    <label className="mt-3.5 block first:mt-0">
      <span className="mb-1.5 block text-[13px] font-bold text-muted-foreground">{label}</span>
      <input
        data-field-input={data}
        aria-invalid={error ? true : undefined}
        autoComplete="off"
        spellCheck={false}
        {...input}
        className="h-12 w-full rounded-[4px] bg-background px-3 text-base outline-1 -outline-offset-1 outline-input placeholder:text-muted-foreground focus:outline-2 focus:outline-chyron aria-invalid:outline-live"
      />
      {error ? (
        <em role="alert" data-field-error={data} className="mt-1.5 block text-[13px] not-italic text-live">
          {error}
        </em>
      ) : (
        hint && <small className="mt-1.5 block text-[12.5px] leading-snug text-muted-foreground">{hint}</small>
      )}
    </label>
  );
}

/** Name and email: their username, checked as sign-up checks it, and the email Forgot password sends to (tier 1, Undo). */
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
          <span className={`min-w-0 flex-1 ${l.undone ? "opacity-(--nd-dim)" : ""}`}>
            <span className={`block text-[14px] leading-snug ${l.undone ? "line-through" : ""}`}>{l.text}</span>
            <small className={`block text-[12px] ${l.undone ? "text-foreground/85" : "text-muted-foreground"}`}>
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
                  toast.quiet((e as Error).message);
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
