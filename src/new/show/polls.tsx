"use client";

import { useState, useSyncExternalStore } from "react";
import { ChartColumn, Check, ChevronRight, Plus } from "lucide-react";
import { airTime } from "../clock";
import { pollsApi, useAfterPoll, useSeasonPolls, type Poll, type PollOption, type SeasonPolls } from "../data";
import { Avatar } from "../ui/bars";
import { Btn, Chip } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { Face, IconBox } from "./parts";

// The couch's polls (docs/PLAN-new-design.md step 12 part 2; the mock's index.html pollSheet and banishSheet): anyone on the
// couch starts one for a show's next episode, on the cast still in (faces) or two to four options of their own, and everyone
// votes until it airs. The votes stay hidden until then (only how many so far), and after it they're shown to whoever has seen
// the episode: each option's share as a bar, who voted for it, and how many you're with. Opened from anywhere signed in with
// openPoll; the rows on the Games tab's This week, Tonight's Extras and Commercial break open it. polls.ts on the server.

export type PollTarget =
  | { kind: "vote"; seasonId: string; couchId: string; pollId: string }
  | { kind: "start"; seasonId: string; couchId: string; label: string };

type Store = { target: PollTarget | null; n: number };
let store: Store = { target: null, n: 0 };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const SERVER: Store = { target: null, n: 0 };

export function openPoll(target: PollTarget) {
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

/** The sheets' host, in the signed-in layout. */
export function PollSheets() {
  const { target, n } = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => store,
    () => SERVER
  );
  const onOpenChange = (o: boolean) => !o && close();
  if (target?.kind === "start") return <StartSheet key={n} target={target} onOpenChange={onOpenChange} />;
  return <VoteSheet key={n} target={target?.kind === "vote" ? target : null} onOpenChange={onOpenChange} />;
}

// ---------- the words ----------

const first = (name: string) => name.split(" ")[0];
const votes = (n: number) => `${n} ${n === 1 ? "vote" : "votes"}`;
const closes = (p: Poll) => airTime(Date.parse(p.closesAt));

/** A poll's row: what to do with it, or that its votes are in. */
export function pollWords(p: Poll): { title: string; line: string; state: string } {
  const by = p.yours ? "You started it" : `Started by ${p.by?.name ?? "the couch"}`;
  if (p.open) {
    return p.vote ? { title: p.question, line: `You voted · results ${closes(p)}`, state: "Voted" } : { title: p.question, line: `${by} · closes ${closes(p)}`, state: "Vote" };
  }
  if (p.results) {
    const top = p.results[0];
    const label = top?.n ? (p.options.find((o) => o.key === top.key)?.label ?? "") : "";
    return { title: p.question, line: top?.n ? `The couch said ${p.cast ? first(label) : label} · ${votes(p.votes)}` : "Nobody voted", state: "See" };
  }
  return { title: p.question, line: `Closed · how the couch voted shows once you've seen Episode ${p.waitsFor}`, state: "" };
}

// ---------- the vote sheet ----------

function VoteSheet({ target, onOpenChange }: { target: Extract<PollTarget, { kind: "vote" }> | null; onOpenChange: (o: boolean) => void }) {
  const open = !!target;
  const polls = useSeasonPolls(target?.seasonId ?? null, target?.couchId ?? null, open);
  const after = useAfterPoll();
  const [busy, setBusy] = useState(false);
  const p = polls.data?.polls.find((x) => x.id === target?.pollId) ?? null;
  const act = async (fn: () => Promise<SeasonPolls>, done?: string) => {
    if (!target) return;
    setBusy(true);
    try {
      after(target.seasonId, target.couchId, await fn());
      if (done) toast(done);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const subtitle = p ? `${p.yours ? "Your poll" : `Started by ${p.by?.name ?? "the couch"}`} · ${p.label} · Episode ${p.episode}` : undefined;
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={p?.question ?? "Poll"} subtitle={subtitle}>
      {polls.isPending && open ? (
        <div aria-busy className="h-[220px] animate-pulse rounded-[4px] bg-secondary" />
      ) : !p ? (
        <p className="py-4 text-sm text-muted-foreground">This poll isn&apos;t here any more.</p>
      ) : p.open ? (
        <div data-poll-sheet={p.id} data-poll-state="open">
          <Options p={p} busy={busy} onVote={(k) => act(() => pollsApi.vote(p.id, p.vote === k ? null : k), p.vote === k ? "Vote taken back" : `Voted · results when it airs, ${closes(p)}`)} />
          <p data-poll-line className="mt-3 text-[13px] text-muted-foreground">
            {p.vote ? `Your vote is in · ${votes(p.votes)} so far · the couch's votes show when it airs, ${closes(p)}` : `${votes(p.votes)} so far · nobody sees a vote until it airs`}
          </p>
          {p.yours && (
            <button type="button" disabled={busy} data-poll-remove onClick={() => act(() => pollsApi.remove(p.id), "Poll taken down").then(() => onOpenChange(false))} className="mt-4 text-[15px] font-semibold text-muted-foreground">
              Take it down
            </button>
          )}
        </div>
      ) : p.results ? (
        <Results p={p} />
      ) : (
        <div data-poll-sheet={p.id} data-poll-state="waiting">
          <p className="mt-2 text-[15px] leading-snug">It closed when Episode {p.episode} started. See how the couch voted once you&apos;ve seen it.</p>
          <Btn wide className="mt-4" onClick={() => onOpenChange(false)}>
            OK
          </Btn>
        </div>
      )}
    </Sheet>
  );
}

/** The options to vote for: faces for the cast (the mock's banishSheet), rows of words for the rest (its pollSheet). */
function Options({ p, busy, onVote }: { p: Poll; busy: boolean; onVote: (key: string) => void }) {
  if (p.cast) {
    return (
      <div className="grid grid-cols-4 gap-2" role="group">
        {p.options.map((o) => {
          const on = p.vote === o.key;
          return (
            <button
              key={o.key}
              type="button"
              aria-pressed={on}
              disabled={busy}
              data-poll-option={o.key}
              data-poll-name={o.label}
              onClick={() => onVote(o.key)}
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
  return (
    <div className="flex flex-col gap-2" role="group">
      {p.options.map((o) => {
        const on = p.vote === o.key;
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={on}
            disabled={busy}
            data-poll-option={o.key}
            onClick={() => onVote(o.key)}
            className={`nd-press flex min-h-[56px] items-center gap-3 rounded-[3px] bg-secondary px-4 text-left text-[16px] font-bold ${on ? "outline-2 -outline-offset-2 outline-chyron-line" : ""}`}
          >
            <span className="min-w-0 flex-1">{o.label}</span>
            {on && <Check className="size-5 flex-none" strokeWidth={3} aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

/** Closed, and you've seen the episode: each option's share as a bar, who voted for it, how many you're with. */
function Results({ p }: { p: Poll }) {
  const total = p.votes;
  const share = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const mine = p.results?.find((r) => r.key === p.vote);
  return (
    <div data-poll-sheet={p.id} data-poll-state="results">
      <div className="flex flex-col gap-2">
        {(p.results ?? []).map((r) => {
          const o: PollOption | undefined = p.options.find((x) => x.key === r.key);
          const on = r.key === p.vote;
          return (
            <div
              key={r.key}
              data-poll-result={r.key}
              data-poll-votes={r.n}
              className={`relative isolate flex min-h-[60px] items-center gap-3 overflow-hidden rounded-[3px] bg-secondary px-3 ${on ? "outline-2 -outline-offset-2 outline-chyron-line" : ""}`}
            >
              <span aria-hidden className="absolute inset-y-0 left-0 -z-[1] bg-chyron-line/25 transition-[width] duration-700 motion-reduce:transition-none" style={{ width: `${share(r.n)}%` }} />
              {p.cast && <Face src={o?.photo ?? null} name={o?.label} className="size-11 flex-none rounded-[3px] text-lg" />}
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[16px]">{o?.label ?? r.key}</b>
                {r.people.length > 0 && (
                  <span className="mt-1 flex gap-1">
                    {r.people.slice(0, 8).map((x) => (
                      <Avatar key={x.userId} id={x.userId} name={x.name} size={18} />
                    ))}
                  </span>
                )}
              </span>
              <b className="type-num flex-none text-[24px]">{share(r.n)}%</b>
            </div>
          );
        })}
      </div>
      <p data-poll-line className="mt-3 text-[13px] text-muted-foreground">
        {votes(total)}
        {mine && total ? ` · you're with ${share(mine.n)}% of the couch` : p.vote ? "" : " · you didn't vote"}
      </p>
    </div>
  );
}

// ---------- starting one ----------

function StartSheet({ target, onOpenChange }: { target: Extract<PollTarget, { kind: "start" }>; onOpenChange: (o: boolean) => void }) {
  const polls = useSeasonPolls(target.seasonId, target.couchId);
  const after = useAfterPoll();
  const start = polls.data?.start ?? null;
  const [cast, setCast] = useState<boolean | null>(null);
  const useCast = cast ?? !!start?.cast;
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [busy, setBusy] = useState(false);
  const words = options.map((o) => o.trim()).filter(Boolean);
  const ready = question.trim().length >= 3 && (useCast || words.length >= 2);
  const go = async () => {
    if (!start || !ready) return;
    setBusy(true);
    try {
      const out = await pollsApi.start(target.seasonId, target.couchId, useCast ? { question, cast: true } : { question, options: words });
      after(target.seasonId, target.couchId, out);
      onOpenChange(false);
      toast(`Poll started · open until ${airTime(Date.parse(start.airAt))}`);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const input = "h-12 w-full rounded-[3px] bg-secondary px-3 text-base outline-none placeholder:text-muted-foreground focus:outline-1 focus:outline-input";
  return (
    <Sheet open onOpenChange={onOpenChange} title="Start a poll" subtitle={start ? `${target.label} · Episode ${start.episode} · open until it airs` : target.label}>
      {polls.isPending ? (
        <div aria-busy className="h-[220px] animate-pulse rounded-[4px] bg-secondary" />
      ) : !start ? (
        <p className="py-4 text-sm text-muted-foreground" data-poll-start="none">
          A poll is about the next episode, for everyone who&apos;s seen the one before it. Nothing&apos;s coming up you can poll the couch about.
        </p>
      ) : (
        <div data-poll-start={start.episode}>
          <label className="mt-1 block">
            <span className="type-caption text-[13px] tracking-[0.04em] text-muted-foreground">Ask the couch</span>
            <input
              data-poll-question
              value={question}
              maxLength={80}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={useCast ? "Who goes home next?" : "Will the twist be a swap?"}
              className={`mt-1.5 ${input}`}
            />
          </label>
          <span className="type-caption mt-4 block text-[13px] tracking-[0.04em] text-muted-foreground">The choices</span>
          <div className="mt-1.5 flex gap-2">
            {start.cast && (
              <Chip on={useCast} data-poll-kind="cast" onClick={() => setCast(true)} className="h-11 px-4 text-[15px]">
                The cast still in
              </Chip>
            )}
            <Chip on={!useCast} data-poll-kind="own" onClick={() => setCast(false)} className="h-11 px-4 text-[15px]">
              {start.cast ? "Our own" : "Write them"}
            </Chip>
          </div>
          {!useCast && (
            <div className="mt-3 flex flex-col gap-2">
              {options.map((o, i) => (
                <input
                  key={i}
                  data-poll-own={i}
                  value={o}
                  maxLength={40}
                  onChange={(e) => setOptions((x) => x.map((y, j) => (j === i ? e.target.value : y)))}
                  placeholder={`Option ${i + 1}`}
                  aria-label={`Option ${i + 1}`}
                  className={input}
                />
              ))}
              {options.length < 4 && (
                <button type="button" data-poll-add onClick={() => setOptions((x) => [...x, ""])} className="flex h-11 items-center gap-2 text-[15px] font-semibold text-muted-foreground">
                  <Plus className="size-4" aria-hidden />
                  Add an option
                </button>
              )}
            </div>
          )}
          <p className="mt-3 text-[13px] text-muted-foreground">Nobody sees a vote until Episode {start.episode} airs; then whoever&apos;s seen it sees how the couch voted.</p>
          <Btn tone="must" wide className="mt-3" disabled={!ready || busy} onClick={go} data-poll-go>
            Start the poll
          </Btn>
        </div>
      )}
    </Sheet>
  );
}

// ---------- where they show ----------

/** One poll's row: open (vote), voted (results when it airs), or closed (how the couch voted). `icon` on the Games tab's This week. */
export function PollRow({ p, couchId, icon }: { p: Poll; couchId: string; icon?: boolean }) {
  const w = pollWords(p);
  return (
    <button
      type="button"
      data-poll-row={p.id}
      data-poll-open={p.open ? "yes" : "no"}
      onClick={() => openPoll({ kind: "vote", seasonId: p.seasonId, couchId, pollId: p.id })}
      className="nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border py-2 text-left"
    >
      {icon && <IconBox icon={ChartColumn} />}
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-semibold [overflow-wrap:anywhere]">{w.title}</b>
        <small className="mt-0.5 block text-[13px] text-muted-foreground">{w.line}</small>
      </span>
      {w.state && <span className="text-[13px] font-semibold text-muted-foreground">{w.state}</span>}
      <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
    </button>
  );
}

/** Start a poll for the next episode (the Games tab's This week), when you can. */
export function StartPollRow({ seasonId, couchId, label }: { seasonId: string; couchId: string; label: string }) {
  const polls = useSeasonPolls(seasonId, couchId);
  const start = polls.data?.start;
  if (!start) return null;
  return (
    <button
      type="button"
      data-poll-start-row={start.episode}
      onClick={() => openPoll({ kind: "start", seasonId, couchId, label })}
      className="nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border py-2 text-left"
    >
      <IconBox icon={Plus} />
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-semibold">Start a poll</b>
        <small className="mt-0.5 block text-[13px] text-muted-foreground">Ask the couch about Episode {start.episode} · open until it airs</small>
      </span>
      <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
    </button>
  );
}
