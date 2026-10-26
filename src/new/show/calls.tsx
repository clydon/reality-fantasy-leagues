"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, ChevronRight, CircleQuestionMark, X } from "lucide-react";
import { airTime } from "../clock";
import { callsApi, useAfterCalls, useEpisodeCalls, type CallOption, type CallQuestion, type EpisodeCalls, type Verdict } from "../data";
import { useMe } from "../session";
import { Avatar } from "../ui/bars";
import { Btn, Chip } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { Face, IconBox } from "./parts";

// Call it (docs/PLAN-new-design.md step 12 part 2; the mock's watching.js callSheet, show.js predictSheet, rulebook.js's talk
// show and Formula 1 calls), opened from anywhere signed in with openCall: before an episode airs, two one-tap calls about it
// (Who goes home? as faces, where someone goes home every episode; a moment as Yes / No), "Private until it airs"; once it's
// aired and you've seen it, how each call went and the couch's calls beside yours, and on a talk show "What happened?", which
// the couch settles (two agreeing). The calls are the server's (calls.ts): a public pool's Who goes home? is the same call.
// Also the rows that open it: Tonight's Extras, the Games tab's This week, the episode page.

export type CallTarget = { seasonId: string; couchId: string | null; episode: number; label: string; solo: boolean };

type Store = { target: CallTarget | null; n: number };
let store: Store = { target: null, n: 0 };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const SERVER: Store = { target: null, n: 0 };

/** Open Call it for an episode: the next to air (to call it), or one you've seen (how the calls went). */
export function openCall(target: CallTarget) {
  store = { ...store, target: null };
  emit();
  setTimeout(() => {
    store = { target, n: store.n + 1 };
    emit();
  }, 30);
}

const close = () => {
  store = { ...store, target: null };
  emit();
};

/** The sheet's host, in the signed-in layout. */
export function CallSheets() {
  const { target, n } = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => store,
    () => SERVER
  );
  return <CallSheet key={n} target={target} onOpenChange={(o) => !o && close()} />;
}

// ---------- the words ----------

const first = (name: string) => name.split(" ")[0];
const optionLabel = (q: CallQuestion, key: string | undefined) => (key ? (q.options.find((o) => o.key === key)?.label ?? key) : null);

/** How many of an episode's calls you've made, of how many. */
export function callsMade(c: EpisodeCalls | undefined): { made: number; of: number } {
  const keys = (c?.questions ?? []).map((q) => q.key);
  return { made: keys.filter((k) => c?.mine[k]).length, of: keys.length };
}

/** "Thien An went home", "It happened", "The couch says no", or what it's waiting for. */
function answerLine(q: CallQuestion, v: Verdict | undefined): string {
  if (!v || v.state === "waiting") return q.key === "out" ? "Waiting for who went home" : q.by === "couch" ? "What happened? The couch says" : "Waiting for the full results";
  if (v.state === "off") return `${v.why}: no call counts`;
  if (q.key === "out") return `${v.right.map((k) => optionLabel(q, k) ?? "Someone").join(" and ")} went home`;
  if (q.by === "couch") return v.right[0] === "yes" ? "The couch says it happened" : "The couch says it didn't";
  return v.right[0] === "yes" ? "It happened" : "It didn't happen";
}

const right = (v: Verdict | undefined, answer: string | undefined) => (v?.state === "known" && answer ? v.right.includes(answer) : null);

// ---------- the sheet ----------

function CallSheet({ target, onOpenChange }: { target: CallTarget | null; onOpenChange: (open: boolean) => void }) {
  const open = !!target;
  const c = useEpisodeCalls(target?.seasonId ?? null, target?.couchId ?? null, target?.episode ?? null, open);
  const status = (c.error as { status?: number } | null)?.status;
  const d = c.data;
  const subtitle = !target
    ? undefined
    : d?.status === "open"
      ? "Private until it airs · see who got it after"
      : d?.verdicts
        ? `${target.label} · how the calls went`
        : target.label;
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={`Call it · Episode ${target?.episode ?? ""}`} subtitle={subtitle}>
      {c.isPending && open ? (
        <div aria-busy className="h-[260px] animate-pulse rounded-[4px] bg-secondary" />
      ) : !d || !target ? (
        <p className="py-4 text-sm text-muted-foreground">{status === 409 || status === 403 ? ((c.error as Error)?.message ?? "Not open.") : "Couldn't load it. Try again in a moment."}</p>
      ) : d.status === "open" ? (
        <OpenCalls key={JSON.stringify(d.mine)} target={target} d={d} onDone={() => onOpenChange(false)} />
      ) : d.status === "behind" ? (
        <div data-call-sheet={d.episode} data-call-status="behind" className="pb-2">
          <p className="mt-2 text-[15px] leading-snug">Episode {d.episode}&apos;s calls say who&apos;s still in, so they wait until you&apos;ve seen Episode {d.catchUp}.</p>
          <Btn wide className="mt-4" onClick={() => onOpenChange(false)}>
            OK
          </Btn>
        </div>
      ) : d.verdicts ? (
        <HowItWent target={target} d={d} />
      ) : (
        <div data-call-sheet={d.episode} data-call-status="closed" className="pb-2">
          <p className="mt-2 text-[15px] leading-snug">
            {Object.keys(d.mine).length
              ? `Episode ${d.episode} has aired. Your calls are in: see how they did once you've seen it.`
              : `Calls for Episode ${d.episode} closed when it started.`}
          </p>
          <Btn wide className="mt-4" onClick={() => onOpenChange(false)}>
            OK
          </Btn>
        </div>
      )}
    </Sheet>
  );
}

/** Before it airs: each question, a tap to call it, then Lock in my calls (changeable until it airs). */
function OpenCalls({ target, d, onDone }: { target: CallTarget; d: EpisodeCalls; onDone: () => void }) {
  const after = useAfterCalls();
  const [picked, setPicked] = useState<Record<string, string>>(() => ({ ...d.mine }));
  const [saving, setSaving] = useState(false);
  const changed = d.questions.filter((q) => (picked[q.key] ?? null) !== (d.mine[q.key] ?? null));
  const until = d.airAt ? airTime(Date.parse(d.airAt)) : "it airs";
  const save = async () => {
    if (!changed.length) return onDone();
    setSaving(true);
    try {
      after(await callsApi.call(target.seasonId, target.couchId, d.episode, Object.fromEntries(changed.map((q) => [q.key, picked[q.key] ?? null]))), target.couchId);
      onDone();
      toast(`Called it · change until ${until}`);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  if (!d.questions.length) {
    return <p className="py-4 text-sm text-muted-foreground">Nothing to call on this one: the show&apos;s rulebook has nothing callable yet.</p>;
  }
  return (
    <div data-call-sheet={d.episode} data-call-status="open">
      {d.questions.map((q) => (
        <div key={q.key} data-call-q={q.key} className="mt-3 first:mt-1">
          <p className="type-caption text-[15px] tracking-[0.04em] text-muted-foreground">{q.lead}</p>
          {q.what && <b className="mt-0.5 block text-[17px] leading-snug">{q.what}</b>}
          <div className="mt-2.5">
            {q.kind === "cast" ? (
              <FaceGrid options={q.options} chosen={picked[q.key] ?? null} onTap={(k) => setPicked((x) => ({ ...x, [q.key]: x[q.key] === k ? "" : k }))} />
            ) : (
              <div className="flex gap-2">
                {q.options.map((o) => (
                  <Chip
                    key={o.key}
                    on={picked[q.key] === o.key}
                    data-call-option={o.key}
                    onClick={() => setPicked((x) => ({ ...x, [q.key]: x[q.key] === o.key ? "" : o.key }))}
                    className="h-11 px-5 text-[15px]"
                  >
                    {o.label}
                  </Chip>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
      <p data-call-count className="mt-4 text-[13px] text-muted-foreground">
        {d.scope === "couch"
          ? d.called
            ? `${d.called} on the couch ${d.called === 1 ? "has" : "have"} called it · nobody sees a call until it airs`
            : "Nobody on the couch has called it yet · nobody sees a call until it airs"
          : "Just for you: see how you did once you've watched it"}
      </p>
      <Btn tone={changed.length ? "must" : "optional"} wide className="mt-3" disabled={saving} onClick={save} data-call-save>
        {changed.length ? (Object.keys(d.mine).length ? "Save my calls" : "Lock in my calls") : "Done"}
      </Btn>
    </div>
  );
}

/** Who goes home?'s faces: a tap calls them (again: takes it back). */
function FaceGrid({ options, chosen, onTap }: { options: CallOption[]; chosen: string | null; onTap?: (key: string) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2" role="group">
      {options.map((o) => {
        const on = chosen === o.key;
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={on}
            disabled={!onTap}
            data-call-option={o.key}
            data-call-name={o.label}
            onClick={() => onTap?.(o.key)}
            className={`nd-press relative rounded-[3px] text-left disabled:opacity-100 ${on ? "outline-2 outline-offset-1 outline-foreground" : ""}`}
          >
            <Face src={o.photo} name={o.label} className="aspect-square w-full rounded-[3px] text-[24px]" />
            {on && (
              <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-foreground text-background">
                <Check className="size-3" strokeWidth={3} aria-hidden />
              </span>
            )}
            <b className="type-caption mt-1 block truncate text-[14px]">{first(o.label)}</b>
          </button>
        );
      })}
    </div>
  );
}

/** After it's aired and you've seen it: each call, what happened, yours and the couch's; a talk show's "What happened?". */
function HowItWent({ target, d }: { target: CallTarget; d: EpisodeCalls }) {
  const me = useMe();
  const after = useAfterCalls();
  const [saying, setSaying] = useState(false);
  const known = d.questions.filter((q) => d.verdicts?.[q.key]?.state === "known");
  const mineRight = known.filter((q) => right(d.verdicts?.[q.key], d.mine[q.key])).length;
  const madeAny = Object.keys(d.mine).length > 0;
  const say = async (key: string, said: "yes" | "no") => {
    setSaying(true);
    try {
      after(await callsApi.say(target.seasonId, target.couchId, d.episode, { [key]: d.says?.[key]?.mine === said ? null : said }), target.couchId);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setSaying(false);
    }
  };
  const others = d.people.filter((p) => p.userId !== me.id);
  return (
    <div data-call-sheet={d.episode} data-call-status="closed" data-call-results>
      {madeAny && known.length > 0 && (
        <div data-call-score className="nd-beat mt-1 rounded-[4px] bg-plate p-4 text-plate-foreground">
          <span className="type-caption inline-block bg-chyron py-1 pl-2 pr-4 text-xs tracking-[0.06em] text-chyron-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_8px)_100%,0_100%)]">
            Your calls
          </span>
          <div className="mt-2 flex items-end gap-2.5">
            <b className="type-num text-[56px] leading-[.85]">
              {mineRight}/{known.length}
            </b>
            <span className="pb-1 text-[13px] text-plate-muted">{mineRight === known.length ? "You called it" : mineRight ? "Not bad" : "Not this time"}</span>
          </div>
        </div>
      )}
      {d.questions.map((q) => {
        const v = d.verdicts?.[q.key];
        const mine = d.mine[q.key];
        const ok = right(v, mine);
        const told = d.says?.[q.key];
        return (
          <div key={q.key} data-call-result={q.key} data-call-state={v?.state ?? "waiting"} className="mt-4 border-t border-border pt-3 first:border-t-0">
            <p className="type-caption text-[15px] tracking-[0.04em] text-muted-foreground">{q.lead}</p>
            {q.what && <b className="mt-0.5 block text-[17px] leading-snug">{q.what}</b>}
            {q.key === "out" && v?.state === "known" ? (
              <div className="mt-2.5 flex gap-2" data-call-gone>
                {q.options
                  .filter((o) => v.right.includes(o.key))
                  .map((o) => (
                    <Face key={o.key} src={o.photo} name={o.label} out className="size-[76px] rounded-[3px] text-[24px]" />
                  ))}
              </div>
            ) : null}
            <p data-call-answer className="mt-2 text-[15px] font-semibold">
              {answerLine(q, v)}
            </p>
            {q.by === "couch" && v?.state !== "known" && (
              <div className="mt-2" data-call-say-row>
                <div className="flex gap-2">
                  {(["yes", "no"] as const).map((k) => (
                    <Chip key={k} on={told?.mine === k} disabled={saying} data-call-say={k} onClick={() => void say(q.key, k)} className="h-11 px-5 text-[15px]">
                      {k === "yes" ? "It happened" : "It didn't"}
                    </Chip>
                  ))}
                </div>
                <small className="mt-1.5 block text-[13px] text-muted-foreground">
                  {d.alone
                    ? "Nobody else on the couch watches it: your say settles it"
                    : told && (told.yes || told.no)
                      ? `${told.yes} said it happened · ${told.no} said it didn't · two agreeing settle it`
                      : "Two on the couch agreeing settle it"}
                </small>
              </div>
            )}
            <p data-call-mine={ok === null ? "none" : ok ? "right" : "wrong"} className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              {ok === true ? <Check className="size-4 text-good" strokeWidth={3} aria-hidden /> : ok === false ? <X className="size-4 text-live" strokeWidth={3} aria-hidden /> : null}
              {mine ? `You called ${q.key === "out" ? first(optionLabel(q, mine) ?? "") : (optionLabel(q, mine) ?? "").toLowerCase()}` : "No call from you"}
            </p>
            {others.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-2" data-call-people>
                {others
                  .filter((p) => p.calls[q.key])
                  .map((p) => {
                    const theirs = right(v, p.calls[q.key]);
                    return (
                      <span key={p.userId} className="flex items-center gap-1.5 text-sm" data-call-person={p.name}>
                        <Avatar id={p.userId} name={p.name} size={24} />
                        <span className="text-muted-foreground">{p.name}</span>
                        <b className="font-semibold">{q.key === "out" ? first(optionLabel(q, p.calls[q.key]) ?? "") : optionLabel(q, p.calls[q.key])}</b>
                        {theirs === true ? <Check className="size-3.5 text-good" strokeWidth={3} aria-label="right" /> : theirs === false ? <X className="size-3.5 text-live" strokeWidth={3} aria-label="wrong" /> : null}
                      </span>
                    );
                  })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------- where it opens from ----------

/** A row that opens Call it for the next episode: Call it for Episode 7, or your calls are in (Tonight's Extras, This week, where
 *  its rows have icons). */
export function CallRow({ target, icon }: { target: CallTarget; icon?: boolean }) {
  const c = useEpisodeCalls(target.seasonId, target.couchId, target.episode);
  const d = c.data;
  if (!d || (!d.questions.length && d.status !== "behind")) return null;
  const { made, of } = callsMade(d);
  const done = d.status === "open" && of > 0 && made === of;
  const title = d.status === "behind" ? `Call it for Episode ${d.episode}` : done ? `Your calls for Episode ${d.episode} are in` : `Call it for Episode ${d.episode}`;
  const line =
    d.status === "behind"
      ? `See Episode ${d.catchUp} first`
      : done
        ? `Change until ${d.airAt ? airTime(Date.parse(d.airAt)) : "it airs"}`
        : `${of === 1 ? "One quick call" : "Two quick calls"} · see who got it after`;
  const state = d.status === "behind" ? "" : done ? "Called" : made ? `${made} of ${of}` : "Call";
  return (
    <button
      type="button"
      data-call-row={d.episode}
      data-called={done ? "yes" : "no"}
      onClick={() => openCall(target)}
      className="nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border py-2 text-left"
    >
      {icon && <IconBox icon={CircleQuestionMark} />}
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-semibold">{title}</b>
        <small className="mt-0.5 block text-[13px] text-muted-foreground">{line}</small>
      </span>
      {state && <span className="text-[13px] font-semibold text-muted-foreground">{state}</span>}
      <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
    </button>
  );
}

/** How an episode's calls went, for one you've seen: a row that opens them (Tonight's Extras); nothing when nobody called it. */
export function CallResultRow({ target, need = "any" }: { target: CallTarget; need?: "mine" | "any" }) {
  const c = useEpisodeCalls(target.seasonId, target.couchId, target.episode);
  const d = c.data;
  const mine = Object.keys(d?.mine ?? {}).length > 0;
  if (!d || !d.verdicts || (!mine && (need === "mine" || !d.people.length))) return null;
  const known = d.questions.filter((q) => d.verdicts?.[q.key]?.state === "known");
  const got = known.filter((q) => right(d.verdicts?.[q.key], d.mine[q.key])).length;
  const settling = known.length < d.questions.length;
  return (
    <button
      type="button"
      data-call-result-row={d.episode}
      onClick={() => openCall(target)}
      className="nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border py-2 text-left"
    >
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-semibold">
          {mine ? (known.length ? `Episode ${d.episode}: you called ${got} of ${known.length}` : `Your calls for Episode ${d.episode}`) : `Episode ${d.episode}: the couch's calls`}
        </b>
        <small className="mt-0.5 block text-[13px] text-muted-foreground">
          {settling ? (d.questions.some((q) => q.by === "couch") ? "What happened? Say, and see the couch's calls" : "Still settling · see the couch's calls") : "See the couch's calls"}
        </small>
      </span>
      <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
    </button>
  );
}

/** An episode you've seen (the episode page): its calls under a heading; nothing when nobody called it. */
export function CallResults({ target }: { target: CallTarget }) {
  const c = useEpisodeCalls(target.seasonId, target.couchId, target.episode);
  const d = c.data;
  if (!d || !d.verdicts || (!Object.keys(d.mine).length && !d.people.length)) return null;
  return (
    <section className="mt-[26px]" data-episode-calls>
      <h2 className="type-caption mb-1 text-[24px]">Call it</h2>
      <CallResultRow target={target} />
    </section>
  );
}
