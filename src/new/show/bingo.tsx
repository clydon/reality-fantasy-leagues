"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, ChevronRight, Grid3x3, Send, X } from "lucide-react";
import { airTime, dayOf } from "../clock";
import { bingoApi, postToCouch, useAfterBingo, useEpisodeBingo, type EpisodeBingo, type Truth } from "../data";
import { useMe } from "../session";
import { Avatar } from "../ui/bars";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import type { ShowData } from "../screens/show-space";
import { IconBox } from "./parts";

// Bingo (docs/PLAN-new-design.md step 12 part 3; the mock's index.html bingoSheet, show.js's bingo job and during-the-episode row,
// episode.js "sam got a line first"), opened from anywhere signed in with openBingo: your card for an episode, three by three, the
// centre free, nine of the show's moments (the server deals it: bingo.ts). Before airtime it's ready to look at; from airtime, a tap
// ticks a square (a stamp), three in a row is a line ("Bingo!"); once you've seen the episode, how each square went (it happened,
// it didn't, still settling), your lines that count and the couch's cards, and who got a line first. Weekly Bingo, the talk show's
// season game, counts the lines. Also the rows that open it: Tonight (Extras before airtime, Tonight while it's on), the Games tab's
// This week, Commercial break, the episode page.

export type BingoTarget = { seasonId: string; couchId: string | null; episode: number; label: string; solo: boolean };

type Store = { target: BingoTarget | null; n: number };
let store: Store = { target: null, n: 0 };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const SERVER: Store = { target: null, n: 0 };

/** Open your bingo card for an episode: the next to air (ready), one that's on or aired (tick it), one you've seen (how it went). */
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

// ---------- the sheet ----------

function BingoSheet({ target, onOpenChange }: { target: BingoTarget | null; onOpenChange: (open: boolean) => void }) {
  const open = !!target;
  const q = useEpisodeBingo(target?.seasonId ?? null, target?.couchId ?? null, target?.episode ?? null, open);
  const b = q.data;
  const status = (q.error as { status?: number } | null)?.status;
  const subtitle = !target
    ? undefined
    : b?.truth
      ? `${target.label} · how it went`
      : b?.status === "open"
        ? `${target.label} · tap a square when it happens`
        : `${target.label} · ticks open at airtime`;
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={`Episode ${target?.episode ?? ""} Bingo`} subtitle={subtitle}>
      {q.isPending && open ? (
        <div aria-busy className="aspect-square w-full animate-pulse rounded-[4px] bg-secondary" />
      ) : !b || !target ? (
        <p className="py-4 text-sm text-muted-foreground">{status === 409 || status === 403 ? ((q.error as Error)?.message ?? "Not open.") : "Couldn't load it. Try again in a moment."}</p>
      ) : b.status === "none" ? (
        <p className="py-4 text-[15px] leading-snug">Not enough of the show&apos;s moments for a card yet: a card needs four.</p>
      ) : (
        <Card key={`${b.episode}`} target={target} b={b} />
      )}
    </Sheet>
  );
}

/** The card: the squares, a tick each (from airtime), the line banner; then how it went, or who's playing. */
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
  const [popped, setPopped] = useState<number[]>([]);
  const [banner, setBanner] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  const live = b.status === "open";
  const ticked = new Set(mine);
  const linesOf = (set: Set<number>) => LINES.filter((l) => l.every((i) => b.squares[i]?.key === "free" || set.has(i)));
  const tap = async (i: number) => {
    if (!live || b.squares[i]?.key === "free") return;
    const on = !ticked.has(i);
    const next = new Set(ticked);
    if (on) next.add(i);
    else next.delete(i);
    const before = linesOf(ticked).length;
    const made = linesOf(next);
    setMine([...next].sort((x, y) => x - y));
    if (on && made.length > before) {
      setPopped(made.filter((l) => l.includes(i)).flat());
      setBanner((n) => n + 1);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setBanner(0), 1800);
    }
    try {
      after(await bingoApi.tick(target.seasonId, target.couchId, b.episode, i, on), target.couchId);
    } catch (e) {
      setMine([...ticked]);
      toast((e as Error).message);
    }
  };
  const lines = linesOf(ticked).length;
  // The server counts you among who's playing once you've ticked a square: the line says the others.
  const others = b.playing - (b.ticked.length ? 1 : 0);
  const tell = async () => {
    if (!target.couchId) return;
    try {
      await postToCouch(target.seasonId, target.couchId, `Bingo! ${lineWord(lines)} on ${target.label} Episode ${b.episode}`);
      toast("Told the couch · in its chat");
    } catch (e) {
      toast((e as Error).message);
    }
  };
  const until = b.airAt ? airTime(Date.parse(b.airAt)) : "it airs";
  return (
    <div data-bingo-sheet={b.episode} data-bingo-status={b.truth ? "seen" : b.status}>
      <div className="relative grid grid-cols-3 gap-1.5" role="group" aria-label={`Episode ${b.episode} bingo card`} data-bingo-card>
        {b.squares.map((s, i) => (
          <Square key={i} i={i} label={s.label} free={s.key === "free"} on={ticked.has(i)} truth={b.truth?.[i] ?? null} seen={!!b.truth} pop={popped.includes(i) && banner > 0} live={live} onTap={() => void tap(i)} />
        ))}
        {banner > 0 && (
          <div key={banner} className="nd-banner pointer-events-none absolute inset-0 grid place-items-center" data-bingo-banner aria-live="polite">
            <span className="type-caption bg-chyron py-2 pl-4 pr-9 text-[52px] leading-none text-chyron-foreground shadow-[0_10px_30px_rgba(0,0,0,.5)] [clip-path:polygon(0_0,100%_0,calc(100%_-_22px)_100%,0_100%)]">
              Bingo!
            </span>
          </div>
        )}
      </div>
      {b.truth ? (
        <HowItWent target={target} b={b} me={me.id} />
      ) : (
        <div className="mt-3">
          <p data-bingo-line className="text-[15px] font-semibold">
            {b.status === "ready" ? `Ticks open ${until}` : lines ? `${lineWord(lines)} · ${mine.length} ticked` : mine.length ? `${mine.length} ticked · three in a row makes a line` : "Tap a square when it happens"}
          </p>
          <small data-bingo-count className="mt-1 block text-[13px] text-muted-foreground">
            {b.status === "ready"
              ? "Three in a row, down, across or corner to corner, makes a line"
              : b.scope === "couch"
                ? `${others > 0 ? `${others} more on the couch ${others === 1 ? "is" : "are"} playing` : "Nobody else on the couch has ticked one yet"} · see their cards once you've seen it`
                : "See how your squares went once you've seen it"}
          </small>
          {live && lines > 0 && target.couchId && !target.solo && (
            <Btn wide className="mt-3" onClick={() => void tell()} data-bingo-tell>
              <Send className="size-4" aria-hidden />
              Tell the couch
            </Btn>
          )}
        </div>
      )}
    </div>
  );
}

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

/** One square: free (the centre), ticked (a stamp), and once you've seen it, whether it happened. */
function Square({ i, label, free, on, truth, seen, pop, live, onTap }: { i: number; label: string; free: boolean; on: boolean; truth: Truth; seen: boolean; pop: boolean; live: boolean; onTap: () => void }) {
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
      data-truth={seen && !free ? (truth ?? "waiting") : undefined}
      aria-pressed={free ? undefined : on}
      disabled={free || !live}
      onClick={onTap}
      className={`relative grid aspect-square place-items-center overflow-hidden rounded-[3px] p-1.5 text-center text-[13px] font-semibold leading-[1.15] [overflow-wrap:anywhere] transition-[transform,background] duration-200 disabled:opacity-100 ${tone} ${on && !seen ? "nd-stamp" : ""} ${pop ? "nd-line" : ""} ${missed ? "outline-2 -outline-offset-2 outline-dashed outline-good" : ""}`}
    >
      {free ? <span className="type-caption text-[18px]">Free</span> : label}
      {seen && !free && (on || missed) && truth && (
        <span className={`absolute right-1 top-1 grid size-[18px] place-items-center rounded-full ${truth === "yes" ? "bg-good text-good-foreground" : "bg-live text-live-foreground"}`} aria-label={truth === "yes" ? "it happened" : "it didn't happen"}>
          {truth === "yes" ? <Check className="size-3" strokeWidth={3} aria-hidden /> : <X className="size-3" strokeWidth={3} aria-hidden />}
        </span>
      )}
    </button>
  );
}

/** Once you've seen it: your lines that count (and those still settling), who got a line first, the couch's cards. */
function HowItWent({ target, b, me }: { target: BingoTarget; b: EpisodeBingo; me: string }) {
  const settling = b.truth?.some((t) => t === null) ?? false;
  const others = b.people.filter((p) => p.userId !== me);
  const first = firstWords(b, me);
  return (
    <div data-bingo-results>
      <div data-bingo-score className="nd-beat mt-3 rounded-[4px] bg-plate p-4 text-plate-foreground">
        <span className="type-caption inline-block bg-chyron py-1 pl-2 pr-4 text-xs tracking-[0.06em] text-chyron-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_8px)_100%,0_100%)]">
          Your lines
        </span>
        <div className="mt-2 flex items-end gap-2.5">
          <b className="type-num text-[56px] leading-[.85]">{b.lines.standing}</b>
          <span className="pb-1 text-[13px] text-plate-muted">
            {b.lines.waiting ? `${lineWord(b.lines.waiting)} still settling` : b.lines.ticked > b.lines.standing ? "A square in a line didn't happen" : b.lines.standing ? "Every square happened" : b.ticked.length ? "No line this time" : "You didn't tick any"}
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
      {first && (
        <p data-bingo-first className="mt-3 flex items-center gap-2 text-[15px] font-semibold">
          <Avatar id={b.first!.userId} name={b.first!.name} size={26} />
          {first}
        </p>
      )}
      {others.length > 0 && (
        <div className="mt-2" data-bingo-people>
          {others.map((p) => (
            <div key={p.userId} data-bingo-person={p.name} className="flex min-h-[48px] items-center gap-2.5 border-t border-border py-1.5">
              <Avatar id={p.userId} name={p.name} size={28} />
              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{p.name}</span>
              <span className="text-[13px] text-muted-foreground">
                {lineWord(p.lines)}
                {p.waiting ? ` · ${p.waiting} settling` : ""} · {p.ticked} ticked
              </span>
            </div>
          ))}
        </div>
      )}
      {b.scope === "couch" && !others.length && <p className="mt-2 text-[13px] text-muted-foreground">Nobody else on the couch played this one.</p>}
      {target.solo && <p className="mt-2 text-[13px] text-muted-foreground">Just your card: bingo&apos;s better with a couch.</p>}
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
    if (n) head = `Episode ${b.episode} bingo: ${lineWord(b.lines.standing)}${b.lines.waiting ? `, ${b.lines.waiting} settling` : ""}`;
    line = firstWords(b, me.id) ?? (b.people.length > 1 ? "See the couch's cards" : b.ticked.length ? "How your squares went" : "See how it went");
  } else if (b.status === "open") {
    const lines = b.lines.ticked;
    line = b.ticked.length ? `${b.ticked.length} ticked${lines ? ` · ${lineWord(lines)}` : ""} · first line wins bragging rights` : "Tap squares as it happens · first line wins bragging rights";
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
