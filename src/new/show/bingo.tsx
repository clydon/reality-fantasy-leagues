"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, ChevronRight, Grid3x3, RefreshCw, Send, Users, X } from "lucide-react";
import { fullLines, lineState, LINES } from "@/lib/game/bingo";
import { airTime, dayOf } from "../clock";
import { bingoApi, postToCouch, useAfterBingo, useEpisodeBingo, useRefreshBingo, type EpisodeBingo, type Truth } from "../data";
import { useMe } from "../session";
import { Avatar } from "../ui/bars";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import type { ShowData } from "../screens/show-space";
import { IconBox } from "./parts";

// Bingo (docs/PLAN-new-design.md step 12 part 3; the mock's index.html bingoSheet, show.js's bingo job and during-the-episode row,
// episode.js "sam got a line first"), opened from anywhere signed in with openBingo: your card for an episode, three by three, the
// centre free, eight things that might happen, dealt from the episode's bank (the server deals it: bingo.ts; docs/PLAN-bingo-bank.md).
// Before your first tick you can deal yourself a new card, twice, after an "are you sure?" (New card). Before airtime it's ready to
// look at; from airtime, a tap ticks a square (a stamp). On a card dealt from a bank, three in a row asks "Sure all three happened?"
// (Call BINGO, or Undo the last tick): only a called line counts, and calling one tells the couch ("Bingo!"). Once you've seen the
// episode: how each square went (it happened, it didn't, still waiting on the couch), each called line (it counts, it waits, it
// came off), the squares in the couch's called lines waiting on your say ("Did it happen?" Yes / No / Didn't notice), the couch's
// cards (each opens: "Look at their card", as the BINGO notice does, spoiler-guarded by the server) and who got a line first. A
// card from before the banks counts every ticked line, as it always did. Under any bank card, "A square that can't happen? Flag
// it" (step 4): two flags, or an admin's, take a square out of new cards; yours takes it off your card at once if you haven't
// ticked it (Undo in the toast). Weekly Bingo, the talk show's season game, counts the
// lines. Also the rows that open it: Tonight (Extras before airtime, Tonight while it's on), the Games tab's This week, Commercial
// break, the episode page.

export type BingoTarget = {
  seasonId: string;
  couchId: string | null;
  episode: number;
  label: string;
  solo: boolean;
  /** Someone else's card on the couch (step 3's "Look at their card"), read-only. */
  of?: { userId: string; name?: string } | null;
};

type Store = { target: BingoTarget | null; n: number };
let store: Store = { target: null, n: 0 };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const SERVER: Store = { target: null, n: 0 };

/** Open a bingo card for an episode: yours (the next to air, one that's on or aired, one you've seen), or with `of`, theirs. */
export function openBingo(target: BingoTarget) {
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
export function BingoSheets() {
  const { target, n } = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => store,
    () => SERVER
  );
  return <BingoSheet key={n} target={target} onOpenChange={(o) => !o && close()} />;
}

// ---------- the words ----------

const lineWord = (n: number) => `${n} ${n === 1 ? "line" : "lines"}`;

/** "riley got a line first", "You got a line first". */
function firstWords(b: EpisodeBingo, me: string): string | null {
  if (!b.first) return null;
  return b.first.userId === me ? "You got a line first" : `${b.first.name} got a line first`;
}

/** The squares of a line that aren't free, by label. */
const lineLabels = (b: EpisodeBingo, line: number) => LINES[line].filter((i) => b.squares[i]?.key !== "free").map((i) => b.squares[i].label);

// ---------- the sheet ----------

function BingoSheet({ target, onOpenChange }: { target: BingoTarget | null; onOpenChange: (open: boolean) => void }) {
  const open = !!target;
  const q = useEpisodeBingo(target?.seasonId ?? null, target?.couchId ?? null, target?.episode ?? null, open, target?.of?.userId ?? null);
  const b = q.data;
  const status = (q.error as { status?: number } | null)?.status;
  const theirs = target?.of ? (b?.of?.name ?? target.of.name ?? "Their") : null;
  const subtitle = !target
    ? undefined
    : b?.truth
      ? `${target.label} · how it went`
      : theirs
        ? `${target.label}${b?.squares.length ? " · watching together" : ""}`
        : b?.status === "open"
          ? `${target.label} · tap a square when it happens`
          : `${target.label} · ticks open at airtime`;
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={theirs ? `${theirs}'s Episode ${target?.episode ?? ""} bingo` : `Episode ${target?.episode ?? ""} Bingo`} subtitle={subtitle}>
      {q.isPending && open ? (
        <div aria-busy className="aspect-square w-full animate-pulse rounded-[4px] bg-secondary" />
      ) : !b || !target ? (
        <p className="py-4 text-sm text-muted-foreground">{status === 409 || status === 403 || status === 404 ? ((q.error as Error)?.message ?? "Not open.") : "Couldn't load it. Try again in a moment."}</p>
      ) : theirs ? (
        <TheirCard key={`${b.episode}:${b.of?.userId}`} target={target} b={b} name={theirs} />
      ) : b.status === "none" ? (
        <p className="py-4 text-[15px] leading-snug">No card for this episode yet: its squares are written before it airs.</p>
      ) : (
        <Card key={`${b.episode}`} target={target} b={b} />
      )}
    </Sheet>
  );
}

/** The card: the squares, a tick each (from airtime), a line to call (or on an older card, the banner); then how it went. */
function Card({ target, b }: { target: BingoTarget; b: EpisodeBingo }) {
  const me = useMe();
  const after = useAfterBingo();
  // Ticks show at once; the server's answer replaces them.
  const [mine, setMine] = useState<number[]>(b.ticked);
  const [saved, setSaved] = useState(b.ticked);
  if (saved !== b.ticked) {
    setSaved(b.ticked);
    setMine(b.ticked);
  }
  const [last, setLast] = useState<number | null>(null);
  const [calling, setCalling] = useState(false);
  const [popped, setPopped] = useState<number[]>([]);
  const [banner, setBanner] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  const live = b.status === "open";
  const ticked = new Set(mine);
  const full = fullLines(b.squares, ticked);
  const calledLines = b.called.map((c) => c.line).filter((l) => full.includes(l));
  // A card dealt from a bank: a line made asks to be called. The first such line is the one asked about.
  const pending = b.calls && live ? full.filter((l) => !calledLines.includes(l)) : [];
  const inCalled = new Set(calledLines.flatMap((l) => LINES[l]));
  const cheer = (squares: readonly number[]) => {
    setPopped([...squares]);
    setBanner((n) => n + 1);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setBanner(0), 1800);
  };
  const tap = async (i: number) => {
    if (!live || b.squares[i]?.key === "free") return;
    const on = !ticked.has(i);
    const next = new Set(ticked);
    if (on) next.add(i);
    else next.delete(i);
    const made = fullLines(b.squares, next).filter((l) => !full.includes(l));
    setMine([...next].sort((x, y) => x - y));
    setLast(on ? i : null);
    // An older card's line counts by itself: Bingo! at once. A bank's waits to be called.
    if (on && made.length && !b.calls) cheer(made.flatMap((l) => LINES[l]));
    try {
      after(await bingoApi.tick(target.seasonId, target.couchId, b.episode, i, on), target.couchId);
    } catch (e) {
      setMine([...ticked]);
      toast.quiet((e as Error).message);
    }
  };
  const call = async (line: number) => {
    setCalling(true);
    try {
      after(await bingoApi.call(target.seasonId, target.couchId, b.episode, line), target.couchId);
      cheer(LINES[line]);
      toast(target.couchId && !target.solo && !b.alone ? "BINGO called · the couch has been told" : "BINGO called");
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setCalling(false);
    }
  };
  // Undo: the square just ticked, else the line's last tick.
  const undo = (line: number) => {
    const sq = last !== null && LINES[line].includes(last) ? last : [...b.order].reverse().find((i) => LINES[line].includes(i) && ticked.has(i));
    if (sq !== undefined) void tap(sq);
  };
  const lines = b.calls ? calledLines.length : full.length;
  // The server counts you among who's playing once you've ticked a square: the line says the others.
  const others = b.playing - (b.ticked.length ? 1 : 0);
  const tell = async () => {
    if (!target.couchId) return;
    try {
      await postToCouch(target.seasonId, target.couchId, `Bingo! ${lineWord(lines)} on ${target.label} Episode ${b.episode}`);
      toast("Told the couch · in its chat");
    } catch (e) {
      toast.quiet((e as Error).message);
    }
  };
  const until = b.airAt ? airTime(Date.parse(b.airAt)) : "it airs";
  // Watching it together (step 13 part 3): who's here with you, on the squares they've ticked (they're where you are).
  const mates = b.together ?? [];
  const matesOn = (key: string) => mates.filter((m) => m.keys.includes(key));
  return (
    <div data-bingo-sheet={b.episode} data-bingo-status={b.truth ? "seen" : b.status}>
      <div className="relative grid grid-cols-3 gap-1.5" role="group" aria-label={`Episode ${b.episode} bingo card`} data-bingo-card>
        {b.squares.map((s, i) => (
          <Square
            key={i}
            i={i}
            label={s.label}
            free={s.key === "free"}
            on={ticked.has(i)}
            called={b.calls && inCalled.has(i)}
            truth={b.truth?.[i] ?? null}
            seen={!!b.truth}
            pop={popped.includes(i) && banner > 0}
            live={live}
            mates={s.key === "free" ? [] : matesOn(s.key)}
            onTap={() => void tap(i)}
          />
        ))}
        {banner > 0 && (
          <div key={banner} className="nd-banner pointer-events-none absolute inset-0 grid place-items-center" data-bingo-banner aria-live="polite">
            <span className="type-caption bg-chyron py-2 pl-4 pr-9 text-[52px] leading-none text-chyron-foreground shadow-[0_10px_30px_rgba(0,0,0,.5)] [clip-path:polygon(0_0,100%_0,calc(100%_-_22px)_100%,0_100%)]">
              Bingo!
            </span>
          </div>
        )}
      </div>
      {mates.length > 0 && (
        <p data-bingo-together className="mt-2.5 flex items-center gap-1.5 text-[13px] font-semibold text-good">
          <Users className="size-4 flex-none" aria-hidden />
          Watching together · {mates.map((m) => `${m.name} ticked ${m.keys.length}`).join(" · ")}
        </p>
      )}
      {pending.length > 0 && <CallPanel b={b} line={pending[0]} busy={calling} onCall={() => void call(pending[0])} onUndo={() => undo(pending[0])} />}
      {b.truth ? (
        <HowItWent target={target} b={b} me={me.id} />
      ) : (
        <div className="mt-3">
          <p data-bingo-line className="text-[15px] font-semibold">
            {b.status === "ready"
              ? `Ticks open ${until}`
              : lines
                ? `${lineWord(lines)}${b.calls ? " called" : ""} · ${mine.length} ticked`
                : mine.length
                  ? `${mine.length} ticked · three in a row makes a line`
                  : "Tap a square when it happens"}
          </p>
          <small data-bingo-count className="mt-1 block text-[13px] text-muted-foreground">
            {b.status === "ready"
              ? "Three in a row, down, across or corner to corner, makes a line"
              : b.scope === "couch"
                ? `${others > 0 ? `${others} more on the couch ${others === 1 ? "is" : "are"} playing` : "Nobody else on the couch has ticked one yet"} · see their cards once you've seen it`
                : "See how your squares went once you've seen it"}
          </small>
          {b.rerollsLeft > 0 && !mine.length && <NewCard key={b.squares.map((s) => s.key).join()} target={target} b={b} />}
          {live && lines > 0 && target.couchId && !target.solo && (
            <Btn wide className="mt-3" onClick={() => void tell()} data-bingo-tell>
              <Send className="size-4" aria-hidden />
              Tell the couch
            </Btn>
          )}
        </div>
      )}
      {b.calls && <FlagSquares target={target} b={b} />}
    </div>
  );
}

/**
 * "This square's unfair" (step 4): flag a square that can't happen (or can't be seen). Two flags, or an admin's, take it out of
 * everyone's new cards; yours takes it off your own card at once if you haven't ticked it (the toast's Undo puts it back), and a
 * card you've ticked keeps it.
 */
function FlagSquares({ target, b }: { target: BingoTarget; b: EpisodeBingo }) {
  const after = useAfterBingo();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const kept = b.ticked.length > 0;
  const flag = async (key: string, on: boolean) => {
    setBusy(key);
    try {
      after(await bingoApi.flag(target.seasonId, target.couchId, b.episode, key, on), target.couchId);
      if (!on) toast("Flag taken back");
      else if (kept) toast("Flagged · it stays on your card: you've ticked it");
      else toast("Flagged · a new square in its place", { undo: () => void flag(key, false) });
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-4 min-h-11 text-[13px] text-muted-foreground underline underline-offset-2" data-bingo-flag-open>
        A square that can&apos;t happen? Flag it
      </button>
    );
  return (
    <div data-bingo-flags className="mt-4 rounded-[4px] border border-border p-3">
      <p className="text-[15px] font-semibold">This square&apos;s unfair</p>
      <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
        Two flags, or an admin&apos;s, take a square out of new cards. {kept ? "Yours stays on this card: you've ticked it." : "Yours comes off your card now."}
      </small>
      <ul className="mt-2">
        {b.squares
          .filter((s) => s.key.startsWith("b:"))
          .map((s) => {
            const on = b.flagged.includes(s.key);
            return (
              <li key={s.key} data-flag-square={s.key} className="flex min-h-[48px] items-center gap-3 border-t border-border py-1.5">
                <span className="min-w-0 flex-1 text-[14px] leading-snug">{s.label}</span>
                <Btn className="h-10 px-3 text-[14px]" disabled={busy === s.key} onClick={() => void flag(s.key, !on)} data-flag={on ? "on" : "off"}>
                  {on ? "Flagged · Undo" : "Flag"}
                </Btn>
              </li>
            );
          })}
      </ul>
    </div>
  );
}

/** "Sure all three happened?": a line made on a bank's card, to call (it counts, the couch hears) or to take the last tick back. */
function CallPanel({ b, line, busy, onCall, onUndo }: { b: EpisodeBingo; line: number; busy: boolean; onCall: () => void; onUndo: () => void }) {
  return (
    <div data-bingo-call={line} className="mt-3 rounded-[4px] border border-border p-3">
      <p className="text-[15px] font-semibold">Sure all three happened?</p>
      <ul className="mt-1.5 flex flex-col gap-0.5 text-[14px]">
        {lineLabels(b, line).map((l) => (
          <li key={l} className="flex items-center gap-1.5">
            <Check className="size-3.5 flex-none text-good" strokeWidth={3} aria-hidden />
            {l}
          </li>
        ))}
      </ul>
      <small className="mt-1.5 block text-[13px] leading-snug text-muted-foreground">
        {b.alone ? "Only a called line counts. Nobody else on the couch watches it: your word settles it." : "Only a called line counts, once two on the couch say its squares happened."}
      </small>
      <div className="mt-3 flex gap-2">
        <Btn className="flex-1" onClick={onUndo} disabled={busy} data-bingo-undo>
          Undo
        </Btn>
        <Btn tone="must" className="flex-1" onClick={onCall} disabled={busy} data-bingo-callit>
          {busy ? "Calling…" : "Call BINGO"}
        </Btn>
      </div>
    </div>
  );
}

/** New card: a fresh deal before your first tick, asked first (the card you had is gone for good). Two a card, never yellow: optional. */
function NewCard({ target, b }: { target: BingoTarget; b: EpisodeBingo }) {
  const after = useAfterBingo();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const left = b.rerollsLeft;
  const deal = async () => {
    setBusy(true);
    try {
      after(await bingoApi.reroll(target.seasonId, target.couchId, b.episode), target.couchId);
      toast(left > 1 ? "New card · one more if you want it" : "New card · that was your last");
    } catch (e) {
      toast.quiet((e as Error).message);
      setBusy(false);
    }
  };
  if (!asking)
    return (
      <Btn wide className="mt-3" onClick={() => setAsking(true)} data-bingo-new={left}>
        <RefreshCw className="size-4" aria-hidden />
        New card · {left} left
      </Btn>
    );
  return (
    <div data-bingo-sure className="mt-3 rounded-[4px] border border-border p-3">
      <p className="text-[15px] font-semibold">Sure? You can&apos;t get this card back</p>
      <small className="mt-0.5 block text-[13px] text-muted-foreground">
        {left > 1 ? `${left} new cards left for this episode, until your first tick` : "It's your last new card for this episode"}
      </small>
      <div className="mt-3 flex gap-2">
        <Btn className="flex-1" onClick={() => setAsking(false)} disabled={busy} data-bingo-keep>
          Keep this one
        </Btn>
        <Btn tone="ink" className="flex-1" onClick={() => void deal()} disabled={busy} data-bingo-deal>
          {busy ? "Dealing…" : "Deal a new card"}
        </Btn>
      </div>
    </div>
  );
}

/**
 * One square: free (the centre), ticked (a stamp), in a called line (outlined), and once you've seen it, whether it happened;
 * watching together, who else ticked it.
 */
function Square({
  i,
  label,
  free,
  on,
  called,
  truth,
  seen,
  pop,
  live,
  mates,
  onTap,
}: {
  i: number;
  label: string;
  free: boolean;
  on: boolean;
  called: boolean;
  truth: Truth;
  seen: boolean;
  pop: boolean;
  live: boolean;
  mates: { userId: string; name: string }[];
  onTap: () => void;
}) {
  const missed = seen && !free && !on && truth === "yes";
  const wrong = seen && on && truth === "no";
  const tone = free
    ? "bg-foreground text-background"
    : on && !wrong
      ? "bg-chyron text-chyron-foreground"
      : wrong
        ? "bg-secondary text-muted-foreground line-through"
        : "bg-secondary text-foreground";
  return (
    <button
      type="button"
      data-square={i}
      data-ticked={on ? "yes" : "no"}
      data-called={called && !free ? "yes" : undefined}
      data-truth={seen && !free ? (truth ?? "waiting") : undefined}
      aria-pressed={free ? undefined : on}
      disabled={free || !live}
      onClick={onTap}
      className={`relative grid aspect-square place-items-center overflow-hidden rounded-[3px] p-1.5 text-center text-[13px] font-semibold leading-[1.15] [overflow-wrap:anywhere] transition-[transform,background] duration-200 disabled:opacity-100 ${tone} ${on && !seen ? "nd-stamp" : ""} ${pop ? "nd-line" : ""} ${missed ? "outline-2 -outline-offset-2 outline-dashed outline-good" : called && !free ? "outline-[3px] -outline-offset-[3px] outline-foreground" : ""}`}
    >
      {free ? <span className="type-caption text-[18px]">Free</span> : label}
      {mates.length > 0 && (
        <span data-square-mates={mates.map((m) => m.name).join(",")} className="absolute bottom-1 left-1 flex" aria-label={`${mates.map((m) => m.name).join(" and ")} ticked it too`}>
          {mates.slice(0, 3).map((m, k) => (
            <span key={m.userId} className={`rounded-[2px] shadow-[0_0_0_1.5px_var(--secondary)] ${k ? "-ml-1" : ""}`}>
              <Avatar id={m.userId} name={m.name} size={14} />
            </span>
          ))}
        </span>
      )}
      {seen && !free && (on || missed) && truth && (
        <span className={`absolute right-1 top-1 grid size-[18px] place-items-center rounded-full ${truth === "yes" ? "bg-good text-good-foreground" : "bg-live text-live-foreground"}`} aria-label={truth === "yes" ? "it happened" : "it didn't happen"}>
          {truth === "yes" ? <Check className="size-3" strokeWidth={3} aria-hidden /> : <X className="size-3" strokeWidth={3} aria-hidden />}
        </span>
      )}
    </button>
  );
}

/** Each called line once you've seen it: it counts, it waits on the couch, or it came off (and which square didn't happen). */
function CalledLines({ b }: { b: EpisodeBingo }) {
  return (
    <div className="mt-3" data-called-lines>
      {b.called.map((c) => {
        const state = lineState(b.squares, c.line, b.truth);
        const no = LINES[c.line].filter((i) => b.truth?.[i] === "no").map((i) => b.squares[i].label);
        return (
          <div key={c.line} data-called-line={c.line} data-line-state={state} className="flex items-start gap-2.5 border-t border-border py-2 text-[13px]">
            <span className={`w-[68px] flex-none font-bold ${state === "counts" ? "text-good" : state === "off" ? "text-chyron-line" : "text-muted-foreground"}`}>
              {state === "counts" ? "Counts" : state === "off" ? "Came off" : "Waiting"}
            </span>
            <span className="min-w-0 flex-1 text-muted-foreground">
              {lineLabels(b, c.line).join(" · ")}
              {state === "off" && <span className="block">The couch says {no.map((l) => `“${l}”`).join(" and ")} didn&apos;t happen</span>}
              {state === "waiting" && <span className="block">Waiting on a second say</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * "Did it happen?": the squares in the couch's called lines still waiting on a second say, yours to answer once you've seen it.
 * Yes or No is a say (two agreeing settle it for every card that has the square); Didn't notice just puts it away on this phone.
 */
function DidItList({ target, b }: { target: BingoTarget; b: EpisodeBingo }) {
  const after = useAfterBingo();
  const refresh = useRefreshBingo();
  const keep = `gys-bingo-skip:${b.seasonId}:${b.episode}`;
  const [skipped, setSkipped] = useState<string[]>(() => {
    try {
      return JSON.parse(window.localStorage.getItem(keep) ?? "[]") as string[];
    } catch {
      return [];
    }
  });
  const [busy, setBusy] = useState<string | null>(null);
  const items = b.didIt.filter((d) => !skipped.includes(d.key));
  if (!items.length) return null;
  const say = async (key: string, v: "yes" | "no") => {
    setBusy(key);
    try {
      after(await bingoApi.say(b.seasonId, target.couchId, b.episode, { [key]: v }), target.couchId);
      refresh(b.seasonId, target.couchId, b.episode);
      toast(v === "yes" ? "Said it happened · two of you settle it" : "Said it didn't · two of you settle it");
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const skip = (key: string) => {
    const next = [...skipped, key];
    setSkipped(next);
    try {
      window.localStorage.setItem(keep, JSON.stringify(next));
    } catch {
      /* private window: put away until the sheet closes */
    }
  };
  return (
    <div className="mt-4" data-did-it-list>
      <h3 className="type-caption text-[20px]">Did it happen?</h3>
      <small className="block text-[13px] text-muted-foreground">In the couch&apos;s called lines, waiting on a second say</small>
      {items.map((d) => (
        <div key={d.key} data-did-it={d.key} data-mine={d.mine ?? "none"} className="mt-2 border-t border-border pt-2.5">
          <b className="block text-[15px] font-semibold">{d.label}</b>
          <small className="block text-[13px] text-muted-foreground">
            {d.by.join(" and ")} called it{d.mine ? ` · you said ${d.mine === "yes" ? "it happened" : "it didn't"}` : ""}
          </small>
          <div className="mt-2 flex gap-2">
            <Btn tone={d.mine === "yes" ? "ink" : "optional"} className="flex-1" aria-pressed={d.mine === "yes"} disabled={busy === d.key} onClick={() => void say(d.key, "yes")} data-say="yes">
              Yes
            </Btn>
            <Btn tone={d.mine === "no" ? "ink" : "optional"} className="flex-1" aria-pressed={d.mine === "no"} disabled={busy === d.key} onClick={() => void say(d.key, "no")} data-say="no">
              No
            </Btn>
            <Btn className="flex-1 px-2" disabled={busy === d.key} onClick={() => skip(d.key)} data-say="skip">
              Didn&apos;t notice
            </Btn>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Once you've seen it: your lines that count (and those waiting or come off), the couch's to say about, who got a line first, their cards. */
function HowItWent({ target, b, me }: { target: BingoTarget; b: EpisodeBingo; me: string }) {
  const settling = b.truth?.some((t) => t === null) ?? false;
  const others = b.people.filter((p) => p.userId !== me);
  const first = firstWords(b, me);
  const uncalled = b.calls ? b.lines.ticked - b.lines.called : 0;
  return (
    <div data-bingo-results>
      <div data-bingo-score className="nd-beat mt-3 rounded-[4px] bg-plate p-4 text-plate-foreground">
        <span className="type-caption inline-block bg-chyron py-1 pl-2 pr-4 text-xs tracking-[0.06em] text-chyron-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_8px)_100%,0_100%)]">
          Your lines
        </span>
        <div className="mt-2 flex items-end gap-2.5">
          <b className="type-num text-[56px] leading-[.85]">{b.lines.standing}</b>
          <span className="pb-1 text-[13px] text-plate-muted">
            {b.lines.waiting
              ? `${lineWord(b.lines.waiting)} ${b.calls ? "waiting on the couch" : "still settling"}`
              : b.lines.off
                ? b.calls
                  ? `${b.lines.off === 1 ? "A line" : `${b.lines.off} lines`} came off: a square didn't happen`
                  : "A square in a line didn't happen"
                : uncalled > 0
                  ? `${lineWord(uncalled)} you didn't call`
                  : b.lines.standing
                    ? "Every square happened"
                    : b.ticked.length
                      ? "No line this time"
                      : "You didn't tick any"}
          </span>
        </div>
      </div>
      <small data-bingo-how className="mt-2 block text-[13px] leading-snug text-muted-foreground">
        {b.by === "couch"
          ? b.alone
            ? "Nobody else on the couch watches it: your ticks settle it"
            : "A square counts once two on the couch tick it or say it happened"
          : settling
            ? "A square counts once the full results are in"
            : b.truth?.some((x, i) => x === "yes" && b.squares[i]?.key !== "free" && !b.ticked.includes(i))
              ? "Dashed: it happened and you didn't tick it"
              : "Every square counts: the full results are in"}
      </small>
      {b.calls && b.called.length > 0 && <CalledLines b={b} />}
      <DidItList target={target} b={b} />
      {first && (
        <p data-bingo-first className="mt-3 flex items-center gap-2 text-[15px] font-semibold">
          <Avatar id={b.first!.userId} name={b.first!.name} size={26} />
          {first}
        </p>
      )}
      {others.length > 0 && (
        <div className="mt-2" data-bingo-people>
          {others.map((p) => (
            <button
              type="button"
              key={p.userId}
              data-bingo-person={p.name}
              onClick={() => target.couchId && openBingo({ ...target, of: { userId: p.userId, name: p.name } })}
              className="nd-press flex min-h-[48px] w-full items-center gap-2.5 border-t border-border py-1.5 text-left"
            >
              <Avatar id={p.userId} name={p.name} size={28} />
              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{p.name}</span>
              <span className="text-[13px] text-muted-foreground">
                {lineWord(p.lines)}
                {p.waiting ? ` · ${p.waiting} ${b.calls ? "waiting" : "settling"}` : ""} · {p.ticked} ticked
              </span>
              <ChevronRight className="size-4 flex-none text-muted-foreground" aria-hidden />
            </button>
          ))}
        </div>
      )}
      {b.scope === "couch" && !others.length && <p className="mt-2 text-[13px] text-muted-foreground">Nobody else on the couch played this one.</p>}
      {target.solo && <p className="mt-2 text-[13px] text-muted-foreground">Just your card: bingo&apos;s better with a couch.</p>}
    </div>
  );
}

/**
 * Someone else's card ("Look at their card", from the BINGO notice or the couch's cards): their ticks and called lines, read-only;
 * once you've seen it, how each square and line stands and the squares of their lines waiting on your say. Before you've seen it
 * (and aren't watching it together with them), the server sends no squares: only the episode to catch up on.
 */
function TheirCard({ target, b, name }: { target: BingoTarget; b: EpisodeBingo; name: string }) {
  if (!b.squares.length) {
    return (
      <p data-bingo-theirs="behind" className="py-4 text-[15px] leading-snug">
        See {name}&apos;s card once you&apos;ve caught up on Episode {b.episode}: their ticks say what happened.
      </p>
    );
  }
  const inCalled = new Set(b.called.flatMap((c) => LINES[c.line]));
  return (
    <div data-bingo-theirs={b.of?.userId} data-bingo-status={b.truth ? "seen" : "together"}>
      <div className="grid grid-cols-3 gap-1.5" role="group" aria-label={`${name}'s Episode ${b.episode} bingo card`} data-bingo-card>
        {b.squares.map((s, i) => (
          <Square
            key={i}
            i={i}
            label={s.label}
            free={s.key === "free"}
            on={b.ticked.includes(i)}
            called={b.calls && inCalled.has(i)}
            truth={b.truth?.[i] ?? null}
            seen={!!b.truth}
            pop={false}
            live={false}
            mates={[]}
            onTap={() => {}}
          />
        ))}
      </div>
      <p data-bingo-line className="mt-3 text-[15px] font-semibold">
        {b.calls ? (b.called.length ? `${name} called ${lineWord(b.called.length)}` : `${name} hasn't called a line`) : `${name}: ${lineWord(b.lines.called)}`} · {b.ticked.length} ticked
      </p>
      {b.truth ? (
        <>
          {b.calls && b.called.length > 0 && <CalledLines b={b} />}
          <DidItList target={target} b={b} />
        </>
      ) : (
        <small className="mt-1 block text-[13px] text-muted-foreground">You&apos;re watching it together: how it went shows once you&apos;ve seen it.</small>
      )}
    </div>
  );
}

// ---------- where it opens from ----------

/**
 * The episode your bingo card is for, on a show that's a game you follow or play: the one on now; else the next you'd watch once
 * it's aired; else the next to air. Null for a show that isn't a game, or one you don't follow.
 */
export function bingoEpisode(show: ShowData): number | null {
  const up = show.upNext;
  const playing = show.games.some((g) => g.yourRole);
  if (!show.header || !show.ready || (!show.following && !playing)) return null;
  if (up?.live) return up.number;
  const seen = show.seenThrough ?? show.latestAired;
  if (show.latestAired > seen) return Math.min(seen + 1, show.latestAired);
  return up?.number ?? null;
}

/**
 * A row that opens an episode's card: ready before airtime ("Your bingo card · Ready for Wednesday"), ticking while it's on or
 * aired, and once you've seen it your lines and who got one first. Nothing for a show with too few moments. `need: "mine"`: only
 * once you've ticked something (Tonight's look back at an episode you've seen).
 */
export function BingoRow({ target, icon, need = "any", title }: { target: BingoTarget; icon?: boolean; need?: "mine" | "any"; title?: string }) {
  const me = useMe();
  const q = useEpisodeBingo(target.seasonId, target.couchId, target.episode);
  const b = q.data;
  if (!b || b.status === "none" || (need === "mine" && !b.ticked.length)) return null;
  const t = b.airAt ? Date.parse(b.airAt) : null;
  let head = `Episode ${b.episode} bingo`;
  let line: string;
  let state = "";
  if (b.truth) {
    const n = b.lines.standing + b.lines.waiting;
    if (n) head = `Episode ${b.episode} bingo: ${lineWord(b.lines.standing)}${b.lines.waiting ? `, ${b.lines.waiting} ${b.calls ? "waiting" : "settling"}` : ""}`;
    // The couch's called squares waiting on your say come first: they're what brings you back (step 3's "Did it?").
    const say = b.didIt.filter((x) => !x.mine).length;
    line = say
      ? `Did it happen? ${say} ${say === 1 ? "square" : "squares"} to say about`
      : (firstWords(b, me.id) ?? (b.people.length > 1 ? "See the couch's cards" : b.ticked.length ? "How your squares went" : "See how it went"));
  } else if (b.status === "open") {
    const lines = b.calls ? b.lines.called : b.lines.ticked;
    line = b.ticked.length ? `${b.ticked.length} ticked${lines ? ` · ${lineWord(lines)}${b.calls ? " called" : ""}` : ""} · first line wins bragging rights` : "Tap squares as it happens · first line wins bragging rights";
    state = "Open";
  } else {
    if (title) head = title;
    line = `${title ? `Ready for ${t != null ? dayOf(t, true) : "the next episode"} · ticks open at airtime` : `Opens ${t != null ? airTime(t) : "at airtime"} · tap squares as it happens`}`;
    state = "Ready";
  }
  return (
    <button
      type="button"
      data-bingo-row={b.episode}
      data-bingo-row-status={b.truth ? "seen" : b.status}
      onClick={() => openBingo(target)}
      className="nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border py-2 text-left"
    >
      {icon && <IconBox icon={Grid3x3} />}
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-semibold">{head}</b>
        <small className="mt-0.5 block text-[13px] text-muted-foreground">{line}</small>
      </span>
      {state && <span className="text-[13px] font-semibold text-muted-foreground">{state}</span>}
      <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
    </button>
  );
}

/** An episode you've seen (the episode page): its bingo under a heading, when you or the couch played it. */
export function BingoResults({ target }: { target: BingoTarget }) {
  const q = useEpisodeBingo(target.seasonId, target.couchId, target.episode);
  const b = q.data;
  if (!b || !b.truth || (!b.ticked.length && !b.people.length)) return null;
  return (
    <section className="mt-[26px]" data-episode-bingo>
      <h2 className="type-caption mb-1 text-[24px]">Bingo</h2>
      <BingoRow target={target} />
    </section>
  );
}
