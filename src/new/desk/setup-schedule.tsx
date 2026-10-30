"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { Activity, Bell, Clock, Hash, Lock, Minus, Plus, Repeat, Search, Tv, Zap } from "lucide-react";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { deskSend, useAfterDesk, useDesk, type CountPlan, type DeskSetup, type ListingHitRow, type WhenPlan } from "./data";
import { useChangeToast } from "./parts";

// Setup's schedule sheets (docs/PLAN-desk-parity.md step 3, part 3b; the mock's desk-setup.js dsWhenSheet, dsCountSheet,
// dsListingSheet): When it airs and Episodes (tier 2: what moves, or what's cleared, previewed by the server before it's
// saved), and the TV listing (linked: its times and dates, Find another listing, Unlink it; searched: TVmaze, what it fills,
// Use this listing). Server: src/lib/server/desk-schedule.ts.

const NOTE = "mt-3 text-[13px] leading-snug text-muted-foreground";
const LINK = "inline-flex min-h-11 items-center text-[14px] font-bold underline decoration-input underline-offset-[3px]";
const INPUT = "h-12 w-full rounded-[4px] bg-background px-3 text-base outline-1 -outline-offset-1 outline-input [color-scheme:dark] focus:outline-2 focus:outline-chyron";
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

/** A Setup change: every desk read moves on, then its toast with Undo. */
function useSave(id: string) {
  const changed = useChangeToast();
  const after = useAfterDesk();
  return async (body: Record<string, unknown>) => {
    const out = await deskSend<{ changeId: string; text: string }>(`/seasons/${id}/setup`, body);
    await after();
    changed(out.text, out.changeId);
  };
}

/** What a change would do, asked of the server a moment after the last edit; the last answer stays up while the next comes. */
function usePreview<T>(id: string, body: Record<string, unknown> | null) {
  const key = body ? JSON.stringify(body) : null;
  const [got, setGot] = useState<{ key: string | null; data: T | null; error: string | null }>({ key: null, data: null, error: null });
  useEffect(() => {
    if (!key) return;
    let live = true;
    const t = setTimeout(() => {
      deskSend<T>(`/seasons/${id}/setup`, { ...JSON.parse(key), preview: true })
        .then((data) => live && setGot({ key, data, error: null }))
        .catch((e) => live && setGot({ key, data: null, error: (e as Error).message }));
    }, 180);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [id, key]);
  return { data: key ? got.data : null, ready: !!key && got.key === key, error: got.key === key ? got.error : null };
}

function Points({ items, data }: { items: [Icon, string][]; data?: string }) {
  return (
    <ul data-points={data} className="my-3.5 flex flex-col gap-2.5">
      {items.map(([I, t]) => (
        <li key={t} className="flex items-start gap-2.5 text-[14px] leading-normal text-muted-foreground">
          <I className="mt-px size-[18px] flex-none text-foreground" aria-hidden />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function Warn({ title, line, data }: { title: string; line: string; data: string }) {
  return (
    <div data-warn={data} className="mt-2.5 rounded-[3px] bg-card px-3.5 py-3 shadow-[inset_0_0_0_1.5px_var(--color-chyron)]">
      <b className="block text-[15px]">{title}</b>
      <small className="mt-1 block text-[13px] leading-snug text-muted-foreground">{line}</small>
    </div>
  );
}

function SubHead({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="mb-1 mt-5 flex items-baseline justify-between gap-3">
      <h3 className="type-caption text-[18px] text-muted-foreground">{title}</h3>
      {aside != null && <span className="text-[13px] text-muted-foreground">{aside}</span>}
    </div>
  );
}

// ---------- When it airs ----------

const HOW: [DeskSetup["form"]["how"], string][] = [
  ["weekly", "Weekly"],
  ["nightly", "Nightly"],
  ["binge", "All at once"],
];

/** When it airs (or, with no schedule, Set it by hand): Weekly · Nightly · All at once, the first episode or the drop, the
 *  time and zone; what moves before it's saved. */
export function WhenSheet({ open, onClose, s }: { open: boolean; onClose: () => void; s: DeskSetup }) {
  const save = useSave(s.id);
  const fresh = !s.scheduled;
  const [edit, setEdit] = useState<DeskSetup["form"] | null>(null);
  const [busy, setBusy] = useState(false);
  const f = edit ?? s.form;
  const set = (p: Partial<DeskSetup["form"]>) => setEdit({ ...f, ...p });
  const plan = usePreview<WhenPlan>(s.id, open && f.premiere ? { when: f } : null);
  const p = plan.data;
  const shut = () => {
    setEdit(null);
    onClose();
  };
  const go = async () => {
    setBusy(true);
    try {
      await save({ when: f });
      shut();
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const drop = f.how === "binge";
  return (
    <Sheet open={open} onOpenChange={(o) => !o && shut()} title={fresh ? "Set it by hand" : "When it airs"} subtitle={fresh ? `${s.name} · no schedule yet` : s.name}>
      <div className="flex gap-[3px] rounded-[3px] bg-background p-[3px] outline-1 -outline-offset-1 outline-input" role="radiogroup" aria-label="How it airs">
        {HOW.map(([k, t]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={f.how === k}
            data-when-how={k}
            onClick={() => set({ how: k })}
            className={`h-11 flex-1 rounded-[2px] text-[14px] font-bold ${f.how === k ? "bg-foreground text-background" : "text-muted-foreground"}`}
          >
            {t}
          </button>
        ))}
      </div>
      <label className="mt-3.5 block">
        <span className="mb-1.5 block text-[13px] font-bold text-muted-foreground">{drop ? "Every episode drops on" : "First episode"}</span>
        <input data-when-premiere type="date" value={f.premiere} onChange={(e) => set({ premiere: e.target.value })} className={INPUT} />
      </label>
      <div className="mt-3.5 grid grid-cols-2 gap-2.5">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-bold text-muted-foreground">At</span>
          <input data-when-time type="time" value={f.time} onChange={(e) => e.target.value && set({ time: e.target.value })} className={INPUT} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-bold text-muted-foreground">Time zone</span>
          <select data-when-tz value={f.tz} onChange={(e) => set({ tz: e.target.value })} className={INPUT}>
            {s.zones.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p data-when-summary className="mt-3.5 rounded-[3px] bg-background px-3.5 py-3 text-[14px] leading-normal">
        {!f.premiere ? (drop ? "Pick the day they drop." : "Pick the day the first episode aired, or airs.") : (plan.error ?? p?.summary ?? " ")}
      </p>
      {f.premiere && p && !plan.error && (
        <div data-when-what>
          {p.same ? (
            <p data-when-same className={NOTE}>
              Nothing moves yet.
            </p>
          ) : (
            <>
              <SubHead title={p.fresh ? "What it sets" : "What moves"} aside={p.fresh ? undefined : plural(p.moved, "episode")} />
              {p.rows.map((r) => (
                <div key={r.number} data-when-move={r.number} className="flex min-h-[62px] items-center gap-3 border-t border-border">
                  <span className="type-num grid size-10 flex-none place-items-center rounded-[3px] bg-secondary text-[20px]">{r.number}</span>
                  <span className="min-w-0 flex-1">
                    <b className="block text-[15px] font-semibold">{r.title}</b>
                    <small className="mt-[3px] flex flex-wrap items-center gap-[5px] text-[14px] text-muted-foreground">
                      {r.from && (
                        <>
                          <s className="decoration-[1.5px]">{r.from}</s>
                          <span aria-hidden>›</span>
                        </>
                      )}
                      <em className="type-num text-[18px] not-italic leading-none text-foreground">{r.to}</em>
                    </small>
                  </span>
                </div>
              ))}
              {p.airedOnly && (
                <p data-when-aired-only className={NOTE}>
                  Only aired episodes are dated differently: results already in stay, and nothing in its games moves.
                </p>
              )}
              {p.more > 0 && (
                <p data-when-more className="border-t border-border pb-0.5 pt-2.5 text-[13px] text-muted-foreground">
                  and {p.more} more, the same way
                </p>
              )}
              <div className="mt-3.5 border-t border-border pt-0.5">
                <Points
                  data="when"
                  items={[
                    ...(p.games ? ([[Lock, `Lineups and picks in its ${plural(p.games, "game")} lock at the ${p.fresh ? "" : "new "}times.`]] as [Icon, string][]) : []),
                    [Bell, `Reminders, the TV guide and the Inbox's Coming up ${p.fresh ? "start" : "move with it"}.`],
                    ...(p.bot ? ([[Zap, "Our bot's schedule check runs after each new end."]] as [Icon, string][]) : []),
                    ...(p.listingWins ? ([[Tv, "From now on your times win over its TV listing's."]] as [Icon, string][]) : []),
                  ]}
                />
              </div>
              {p.warn && <Warn data="when" title={p.warn.title} line={p.warn.line} />}
            </>
          )}
        </div>
      )}
      <Btn data-when-save tone="must" wide className="mt-4" disabled={busy || !f.premiere || !plan.ready || !p || p.same || !!plan.error} onClick={() => void go()}>
        {fresh ? "Save the schedule" : "Save the new times"}
      </Btn>
    </Sheet>
  );
}

// ---------- Episodes ----------

/** Episodes: how many (or not known yet); lowering it says what's cleared and turns the button red when aired episodes'
 *  research goes, with a warning when it's fewer than have aired. */
export function CountSheet({ open, onClose, s }: { open: boolean; onClose: () => void; s: DeskSetup }) {
  const save = useSave(s.id);
  const aired = s.episodes.filter((e) => e.aired).length;
  const [edit, setEdit] = useState<{ n: number; unk: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const st = edit ?? { n: s.count ?? Math.max(aired + 1, 10), unk: s.count == null };
  const value = st.unk ? null : st.n;
  const plan = usePreview<CountPlan>(s.id, open ? { episodes: value } : null);
  const p = plan.data;
  const same = st.unk ? s.count == null : st.n === s.count;
  const shut = () => {
    setEdit(null);
    onClose();
  };
  const step = (d: number) => setEdit(st.unk ? { ...st, unk: false } : { n: Math.min(200, Math.max(1, st.n + d)), unk: false });
  const go = async () => {
    setBusy(true);
    try {
      await save({ episodes: value });
      shut();
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const clears = !same && !!p?.clears && plan.ready;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && shut()} title="Episodes" subtitle={s.name}>
      <div className="flex min-h-16 items-center gap-3">
        <span className="min-w-0 flex-1">
          <b className="block text-[16px]">How many</b>
          <small data-count-finale className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
            {p?.finale ?? " "}
          </small>
        </span>
        <span className="flex flex-none items-center">
          <button type="button" data-count-step="-1" aria-label="Fewer" onClick={() => step(-1)} className="grid size-11 place-items-center rounded-[3px] bg-secondary">
            <Minus className="size-5" aria-hidden />
          </button>
          <b data-count-n className="type-num w-[52px] text-center text-[28px]" aria-live="polite">
            {st.unk ? "?" : st.n}
          </b>
          <button type="button" data-count-step="1" aria-label="More" onClick={() => step(1)} className="grid size-11 place-items-center rounded-[3px] bg-secondary">
            <Plus className="size-5" aria-hidden />
          </button>
        </span>
      </div>
      <button type="button" data-count-unknown onClick={() => setEdit({ ...st, unk: !st.unk })} className={LINK}>
        {st.unk ? "Set a number" : "Not known yet"}
      </button>
      {!same && p && (
        <div data-count-what>
          {p.unknown && <Points data="count-unknown" items={[[Hash, p.unknown]]} />}
          {p.cleared.length > 0 && (
            <>
              <SubHead title="What's cleared" />
              <ul data-count-cleared className="mt-0.5 flex flex-col gap-2 rounded-[3px] bg-background px-3.5 py-3">
                {p.cleared.map((l) => (
                  <li key={l} className="relative pl-4 text-[15px] leading-normal before:absolute before:left-0 before:top-[.6em] before:size-1.5 before:rounded-[1px] before:bg-live">
                    {l}
                  </li>
                ))}
              </ul>
            </>
          )}
          {p.warn && <Warn data="count" title={p.warn.title} line={p.warn.line} />}
          {p.added && <Points data="count-added" items={[[Plus, p.added]]} />}
        </div>
      )}
      {plan.error && <p className={`${NOTE} text-live`}>{plan.error}</p>}
      <Btn data-count-save tone={clears ? "danger" : "must"} wide className="mt-3.5" disabled={busy || same || !plan.ready || !!plan.error} onClick={() => void go()}>
        {st.unk ? "Save: not known yet" : clears ? `Clear and save: ${plural(st.n, "episode")}` : `Save: ${plural(st.n, "episode")}`}
      </Btn>
    </Sheet>
  );
}

// ---------- the TV listing ----------

/** Its TV listing: linked (its times, its dates, Find another listing, Unlink it), or found in the listings (TVmaze, as Add a
 *  show searches it: what it fills, Use this listing). `search` opens it at the search; Set it by hand hands on to When it airs. */
export function ListingSheet({ open, onClose, s, search, onByHand }: { open: boolean; onClose: () => void; s: DeskSetup; search: boolean; onByHand: () => void }) {
  const save = useSave(s.id);
  const [finding, setFinding] = useState(false);
  const shut = () => {
    setFinding(false);
    onClose();
  };
  const unlink = async () => {
    shut();
    await save({ unlink: true }).catch((e) => toast.quiet((e as Error).message));
  };
  if (!search && !finding && s.listing) {
    const l = s.listing;
    return (
      <Sheet open={open} onOpenChange={(o) => !o && shut()} title="TV listing" subtitle={s.name}>
        <div data-listing-linked className="flex items-center gap-3 rounded-[4px] bg-background p-3 outline-1 -outline-offset-1 outline-input">
          <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-secondary">
            <Tv className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <b className="block text-[17px]">{l.name}</b>
            <small className="mt-0.5 block text-[13px] text-muted-foreground">{l.network ? `${l.network} · on TVmaze` : "On TVmaze"}</small>
          </span>
        </div>
        <Points
          data="listing"
          items={[
            [Clock, l.times],
            [Activity, l.dates],
          ]}
        />
        <Btn data-listing-other wide onClick={() => setFinding(true)}>
          Find another listing
        </Btn>
        <Btn data-listing-unlink wide className="mt-2" onClick={() => void unlink()}>
          Unlink it
        </Btn>
        <p className={NOTE}>Unlinked, its times stay as they are and nothing updates on its own.</p>
      </Sheet>
    );
  }
  return (
    <Sheet open={open} onOpenChange={(o) => !o && shut()} title="Find it in the TV listings" subtitle={`${s.name} · from TVmaze`}>
      {open && <FindListing s={s} onDone={shut} onByHand={() => (shut(), onByHand())} save={save} />}
    </Sheet>
  );
}

const FILL_ICON: Record<ListingHitRow["fills"][number]["icon"], Icon> = { clock: Clock, hash: Hash, pulse: Activity, repeat: Repeat };

function FindListing({ s, onDone, onByHand, save }: { s: DeskSetup; onDone: () => void; onByHand: () => void; save: (b: Record<string, unknown>) => Promise<void> }) {
  const [q, setQ] = useState(s.show.name);
  const [pick, setPick] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  // Asked a moment after the last keystroke: each search costs several TVmaze calls, which are rationed.
  const [term, setTerm] = useState(q.trim());
  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 400);
    return () => clearTimeout(t);
  }, [q]);
  const found = useDesk<{ hits: ListingHitRow[]; unavailable?: boolean }>(term.length >= 2 ? `/seasons/${s.id}/listings?q=${encodeURIComponent(term)}` : null);
  const hits = found.data?.hits ?? [];
  const picked = hits.find((h) => h.tvmazeId === pick && !h.off) ?? null;
  const use = async () => {
    if (!picked) return;
    setBusy(true);
    try {
      await save({ listing: { tvmazeId: picked.tvmazeId, listingId: picked.listingId } });
      onDone();
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <label className="flex h-12 items-center gap-2 rounded-[3px] bg-background px-3 outline-1 -outline-offset-1 outline-input focus-within:outline-2 focus-within:outline-chyron">
        <Search className="size-5 flex-none text-muted-foreground" aria-hidden />
        <input
          data-listing-q
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPick(null);
          }}
          aria-label="Search the TV listings"
          autoComplete="off"
          className="h-full min-w-0 flex-1 bg-transparent text-base outline-none"
        />
      </label>
      <div data-listing-hits className="mt-3 flex flex-col gap-2" aria-busy={found.isFetching}>
        {term.length >= 2 && found.data && !hits.length && (
          <div data-listing-empty className="flex flex-col items-center gap-2 rounded-[4px] bg-background px-4 py-7 text-center">
            <b className="type-caption text-[22px]">{found.data.unavailable ? "TV listings aren't answering" : `Nothing in the listings for "${term}"`}</b>
            <small className="max-w-[290px] text-[14px] leading-snug text-muted-foreground">
              {found.data.unavailable ? "Try again in a minute, or set its times by hand." : "Some shows aren't in TVmaze. Set its times by hand instead."}
            </small>
            <button type="button" data-listing-hand onClick={onByHand} className={LINK}>
              Set it by hand
            </button>
          </div>
        )}
        {hits.map((h) => {
          const on = pick === h.tvmazeId && !h.off;
          return (
            <button
              key={h.tvmazeId}
              type="button"
              data-listing-hit={h.tvmazeId}
              data-off={h.off ? "" : undefined}
              aria-pressed={on}
              onClick={() => (h.off ? toast.quiet(h.off) : setPick(h.tvmazeId))}
              className={`nd-press rounded-[3px] p-3.5 text-left ${on ? "bg-foreground text-background outline-2 -outline-offset-2 outline-chyron" : "bg-background"} ${h.off ? "text-muted-foreground opacity-70" : ""}`}
            >
              <b className="block text-[16px]">
                {h.name}
                {h.network && (
                  <i className={`type-caption ml-1.5 inline-block rounded-[2px] px-1.5 pb-0.5 pt-[3px] align-[2px] text-[11px] not-italic leading-none tracking-[0.06em] ${on ? "bg-background text-foreground" : "bg-secondary"}`}>
                    {h.network}
                  </i>
                )}
              </b>
              <small className={`text-[13px] leading-snug ${on ? "text-background/80" : "text-muted-foreground"}`}>{h.line}</small>
            </button>
          );
        })}
      </div>
      {picked && (
        <div data-listing-fills>
          <SubHead title="What it fills" />
          <Points
            items={picked.fills.map((x) => [FILL_ICON[x.icon], x.text] as [Icon, string])}
          />
          <Btn data-listing-use tone="must" wide disabled={busy} onClick={() => void use()}>
            Use this listing
          </Btn>
        </div>
      )}
    </>
  );
}
