"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";
import { Crown, Eye, Flame, Grid3x3, Laugh, Pause, Play, Radio, Search, Star, Tv, Users, X, Zap, type LucideIcon } from "lucide-react";
import {
  adoptClock,
  BEAT_MS,
  changeLine,
  clockAt,
  COUNTDOWN_MS,
  LATE_MS,
  leftLine,
  liveClock,
  moveClock,
  namesLine,
  nowLine,
  offsetText,
  parseRuntime,
  PAUSED_BEAT_FOR_MS,
  REACT_KINDS,
  runClock,
  runtimeText,
  START_EARLY_MS,
  STREAM_BACK_MS,
  stopClock,
  TEXT_MAX,
  TOGETHER_POLL_MS,
  TOGETHER_SLOW_AFTER_MS,
  TOGETHER_SLOW_MS,
  TOGETHER_STOP_AFTER_MS,
  watcherAt,
  type Clock,
  type ReactKind,
  type TogetherChange,
  type Watcher,
} from "@/lib/game/watch-along";
import { airTime } from "../clock";
import {
  ratingsApi,
  togetherApi,
  useAfterRating,
  useAfterWatching,
  useRefreshBingo,
  useWatchCard,
  watchApi,
  watching,
  type GifHit,
  type Reaction,
  type Together,
  type TogetherAnswer,
  type WatchRead,
} from "../data";
import { useNav } from "../nav";
import { paths } from "../routes";
import { useMe } from "../session";
import type { ShowData } from "../screens/show-space";
import { Avatar, useNow } from "../ui/bars";
import { usePushedPage } from "../ui/page";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { ShowArt } from "../ui/show-bar";
import { toast } from "../ui/toast";
import { openBingo } from "./bingo";
import { openRate, rateLabel } from "./rate";
import { useOpenReveal } from "./reveal";

// Watch along (docs/PLAN-new-design.md step 13 part 1; the mock's index.html openWatch and watching.js's wrap of it): the one name
// for watching with the couch. A layer over the show space (`?page=watch&ep=N`, so the hub and a link open it too): start it when
// your episode starts (Streaming, or Live on TV with Ad break) and its clock follows the episode; what the couch said there, comments,
// quick reactions and GIFs, arrives 30 s after its moment as you reach it, never before (the server sends nothing nearer, and
// nothing about an episode past your next one: watch-along.ts). Say something and it's pinned to where your clock is, for whoever
// watches next. The screen stays on (wake lock). Your bingo card comes with you. At the end, How was Episode N?: rate it (marking a
// show you only watch seen), or Reveal your scores first on one you play. Polls only while its clock runs (docs/HOSTING.md).
// Who's on now (part 2): its clock is kept on the server for the couch (written when it starts, pauses, moves or closes; the running
// poll is its heartbeat, a paused one beats every 20 s for ten minutes), so who else on the couch is watching this episode along shows
// as a mark on the bar and "riley is watching now · 40s ahead" with Catch up, and while it's on air the start offers Join the live
// airing. Watching together (part 3): a planned night's watch along (`&plan=`) is one clock for everyone in it: opening it once it's
// due joins it, anyone in it starts it ("3, 2, 1" on every phone at once), pauses, moves it or starts an ad break for all ("riley
// paused for everyone · Resume for everyone"), what the people in it say shows up as you reach it (the same clock: no 30 s wait),
// their bingo ticks come to your card, and late arrivals join where it is or watch along from the start on their own. It asks
// whether the session moved every few seconds while it's open (with the reactions while it runs), slower once it's sat still a
// while (docs/HOSTING.md).

/** Opening the watch along from inside the show space: your next episode, or `ep`. */
export function useOpenWatch() {
  const page = usePushedPage("watch", ["ep", "plan"]);
  return (ep?: number | null) => page.showWith(ep ? { ep: String(ep) } : {});
}

/** Opening a planned night's watch along, together (step 13 part 3): over its show when you're in it, else the show with it open. */
export function useOpenTogether() {
  const page = usePushedPage("watch", ["ep", "plan"]);
  const pathname = usePathname();
  const nav = useNav();
  return (p: { seasonId: string; episode: number; id: string }) => {
    if (pathname.startsWith(`/show/${p.seasonId}/`)) page.showWith({ ep: String(p.episode), plan: p.id });
    else nav.push(paths.watch(p.seasonId, p.episode, p.id));
  };
}

// From anywhere else (the hub): paths.watch, the show's Tonight with its watch along open.

const KIND: Record<ReactKind, { icon: LucideIcon; colour: string; label: string }> = {
  fire: { icon: Flame, colour: "#f2804b", label: "Fire" },
  laugh: { icon: Laugh, colour: "#ffc531", label: "Laughing" },
  eye: { icon: Eye, colour: "#a76bb0", label: "Side-eye" },
  crown: { icon: Crown, colour: "#35b5a5", label: "Iconic" },
};

const isLine = (r: Reaction) => r.kind === "text" || r.kind === "gif";
const STREAM_SHOWN = 6;
/** The wall clock, read when something's said (a handler a sheet calls back, never while drawing). */
const wallClock = () => Date.now();
const NUDGE = "h-9 rounded-[3px] px-3 text-[13px] font-bold text-muted-foreground outline-1 -outline-offset-1 outline-border";
const POLL_MS = 5000;
/** Catch up is offered once someone's this far ahead of you. */
const CATCH_UP_MS = 5000;

// ---------- Tonight's card ----------

/** Tonight's Watch along card (the mock's wacta): which episode, and who on the couch left reactions there. While your episode's
 *  on air it leads Tonight (`place="lead"`, the mock's during phase), else it sits after the extras (`"below"`). */
export function WatchAlongCard({ seasonId, show, place }: { seasonId: string; show: ShowData; place: "lead" | "below" }) {
  const couchId = show.couch?.id ?? null;
  const card = useWatchCard(seasonId, couchId, !!show.header);
  const open = useOpenWatch();
  const c = card.data;
  // It leads Tonight while the episode's on, and always on a season watched at your own pace (step 14: the mock's streaming wTonight).
  const leads = c?.status === "live" || (show.ownPace && c?.status === "aired");
  // Before a streaming drop, Tonight's drop plate says when; there's nothing to open yet.
  if (!show.header || !c?.episode || leads !== (place === "lead") || (show.streaming && c.status === "soon")) return null;
  const t = c.airAt ? Date.parse(c.airAt) : null;
  const left = leftLine(
    c.people.map((p) => p.name),
    c.count
  );
  // Who else on the couch has this episode's watch along open right now (part 2; read with the card, not polled).
  const on = (c.now ?? []).filter((w) => w.episode === c.episode).map((w) => w.name);
  const line =
    c.status === "soon"
      ? "Opens at airtime · start it when the episode starts"
      : show.solo
        ? "Pause, rewind, react · rate it after"
        : on.length
          ? c.status === "live"
            ? `${namesLine(on)} ${on.length === 1 ? "is" : "are"} watching · your bingo card comes with you`
            : `${nowLine(on)} · join in: what they say shows up as you reach it`
          : c.status === "live" && !c.count
            ? `Your bingo card comes with you · ${show.plays ? "your moves are locked in" : "say something for whoever watches next"}`
            : left;
  return (
    <button
      type="button"
      data-watch-card={c.episode}
      data-watch-status={c.status}
      data-watch-now={on.length}
      onClick={() => open(c.episode)}
      className="nd-press relative isolate mx-4 mt-[26px] flex min-h-[150px] w-[calc(100%-2rem)] flex-col justify-end gap-1 overflow-hidden rounded-[4px] p-3.5 text-left text-white shadow-[0_14px_30px_rgba(0,0,0,.4)]"
    >
      <ShowArt seasonId={seasonId} artUrl={show.header.show.artUrl} name={show.header.show.name} className="absolute inset-0 -z-[2] size-full" />
      <span aria-hidden className="absolute inset-0 -z-[1] bg-[linear-gradient(180deg,rgba(16,14,21,.1),rgba(16,14,21,.9))]" />
      <span
        className={`type-caption mb-auto flex items-center gap-1.5 self-start py-1 pl-2 pr-4 text-xs tracking-[0.06em] [clip-path:polygon(0_0,100%_0,calc(100%_-_8px)_100%,0_100%)] ${
          c.status === "live" ? "bg-live text-live-foreground" : "bg-good text-good-foreground"
        }`}
      >
        {c.status === "live" ? (
          <>
            <i className="size-[7px] animate-pulse rounded-full bg-current" aria-hidden />
            On air · Episode {c.episode}
          </>
        ) : c.status === "soon" && t != null ? (
          `Live · ${airTime(t)}`
        ) : show.ownPace ? (
          `Episode ${c.episode} · your own pace`
        ) : (
          `Episode ${c.episode}`
        )}
      </span>
      <b className="type-caption text-[32px]">Watch along</b>
      <small className="block text-[13px] opacity-90" data-watch-line>
        {line}
      </small>
    </button>
  );
}

// ---------- the layer ----------

const noop = () => () => {};

/** The watch along, over the show space while `?page=watch` (mounted in its frame). */
export function WatchAlongPage({ show }: { show: ShowData }) {
  const page = usePushedPage("watch", ["ep", "plan"]);
  const params = useSearchParams();
  const asked = Number(params.get("ep")) || null;
  const plan = (asked && params.get("plan")) || null;
  const seasonId = show.header?.seasonId ?? null;
  const couchId = show.couch?.id ?? null;
  const card = useWatchCard(seasonId, couchId, page.open && !asked);
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const episode = asked ?? card.data?.episode ?? null;
  if (!mounted || !page.open || !show.header) return null;
  return createPortal(
    episode ? (
      <WatchAlong key={`${seasonId}:${episode}:${plan ?? ""}`} show={show} episode={episode} planId={plan} onClose={page.close} />
    ) : (
      <Layer>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          {card.isPending ? (
            <div aria-busy className="h-40 w-full animate-pulse rounded-[4px] bg-card" />
          ) : (
            <>
              <p className="text-[15px] text-muted-foreground">Nothing to watch along here right now: you&rsquo;re caught up and nothing&rsquo;s next on the schedule.</p>
              <Btn onClick={page.close}>Back</Btn>
            </>
          )}
        </div>
      </Layer>
    ),
    document.body
  );
}

function Layer({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Watch along" data-watch-along className={`nd-fixed-x nd-wa-in fixed inset-y-0 z-[72] flex flex-col overflow-hidden bg-[#0b0a10] text-foreground ${className}`}>
      {children}
    </div>
  );
}

type Saved = { at: number; mode: Mode };
type Mode = "stream" | "live";
const savedKey = (seasonId: string, n: number) => `gys-watch:${seasonId}:${n}`;

function readSaved(seasonId: string, n: number): Saved | null {
  try {
    const v = JSON.parse(localStorage.getItem(savedKey(seasonId, n)) ?? "null");
    return v && Number.isFinite(v.at) && (v.mode === "stream" || v.mode === "live") ? v : null;
  } catch {
    return null;
  }
}

function writeSaved(seasonId: string, n: number, v: Saved | null) {
  try {
    if (v) localStorage.setItem(savedKey(seasonId, n), JSON.stringify(v));
    else localStorage.removeItem(savedKey(seasonId, n));
  } catch {
    /* private browsing: it just won't remember */
  }
}

/** Keeps the screen on while `on` (and takes it again when the tab comes back). Says whether it's held. */
function useWakeLock(on: boolean): boolean {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!on || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let gone = false;
    const take = async () => {
      if (gone || document.visibilityState !== "visible" || (lock && !lock.released)) return;
      try {
        const l = await navigator.wakeLock.request("screen");
        if (gone) {
          void l.release();
          return;
        }
        lock = l;
        setHeld(true);
        l.addEventListener("release", () => setHeld(false));
      } catch {
        setHeld(false);
      }
    };
    void take();
    const onVisible = () => void take();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      gone = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (lock && !lock.released) void lock.release().catch(() => {});
      setHeld(false);
    };
  }, [on]);
  return held;
}

type Float = { key: string; kind: ReactKind; userId: string; name: string; me: boolean; left: number; sway: number };

/** A planned night is due: the live airing has started, or a shared start is 15 minutes off (or past). */
const nightDue = (night: { how: string; startsAt: string }, now: number) => Date.parse(night.startsAt) - (night.how === "live" ? 0 : START_EARLY_MS) <= now;

function WatchAlong({ show, episode: n, planId: planAsked, onClose }: { show: ShowData; episode: number; planId: string | null; onClose: () => void }) {
  const header = show.header!;
  const seasonId = header.seasonId;
  const couchId = show.couch?.id ?? null;
  const label = rateLabel(show);
  const card = useWatchCard(seasonId, couchId);
  const me = useMe().id;
  const refreshBingo = useRefreshBingo();
  const [saved] = useState(() => readSaved(seasonId, n));
  const [phase, setPhase] = useState<"start" | "on" | "end">("start");
  const [mode, setMode] = useState<Mode>(saved?.mode ?? "stream");
  const [clock, setClock] = useState<Clock>({ at: 0, since: null });
  const [ad, setAd] = useState(false);
  const [info, setInfo] = useState<WatchRead | null>(null);
  const [lines, setLines] = useState<Reaction[]>([]);
  const [pins, setPins] = useState<number[]>([]);
  const [floats, setFloats] = useState<Float[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sheet, setSheet] = useState<"gif" | "time" | null>(null);
  // Who else on the couch is watching this episode along now, as last read (`at`: when, on this phone's clock).
  const [watchers, setWatchers] = useState<{ list: Watcher[]; at: number }>({ list: [], at: 0 });
  const running = phase === "on" && clock.since !== null;
  // The clock's face moves on every quarter second while it runs (the interval below); paused, it stands still.
  const [now, setNow] = useState(() => Date.now());
  const pos = clockAt(clock, now);
  const held = useWakeLock(phase !== "start");
  const seen = useRef(new Set<string>());
  const since = useRef(-1);
  const loads = useRef(0);
  const clockRef = useRef(clock);
  const phaseRef = useRef(phase);
  const runtimeMs = (info?.runtimeMin ?? card.data?.runtimeMin ?? 60) * 60_000;
  const runtimeRef = useRef(runtimeMs);
  const adRef = useRef(ad);
  useEffect(() => {
    clockRef.current = clock;
    phaseRef.current = phase;
    runtimeRef.current = runtimeMs;
    adRef.current = ad;
  });

  // Watching together (part 3): a planned night's session, one clock for everyone in it. No plan: your own watch along.
  const [planId, setPlanId] = useState(couchId ? planAsked : null);
  const [tg, setTg] = useState<Together | null>(null);
  const [night, setNight] = useState<TogetherAnswer["night"]>(null);
  // Someone else's start, resume, move or end of an ad break, said for a few seconds.
  const [flash, setFlash] = useState<{ line: string; key: string } | null>(null);
  const tgRef = useRef<Together | null>(null);
  // A tap on its way to the server: polls' answers wait for it (else a stale one would undo the tap).
  const writing = useRef(false);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The last tap, version move or return to the tab: the poll slows, then stops, once the session's sat still a while.
  const active = useRef(0);
  const loadRef = useRef<(at: number, open: boolean) => Promise<void>>(async () => {});
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  const together = !!planId;
  const joinedId = tg?.you ? tg.id : null;

  const seeWatchers = useCallback(
    (list: Watcher[] | undefined) => {
      if (list) setWatchers({ list: list.filter((w) => w.episode === n), at: Date.now() });
    },
    [n]
  );

  /** A together session as the server has it: its clock becomes yours (unless yours is within a beat of it), its change is said. */
  const adopt = useCallback(
    (t: Together | null, fresh: boolean) => {
      if (!t) return;
      const was = tgRef.current;
      if (was && t.version < was.version) return;
      if (!fresh && writing.current) return;
      tgRef.current = t;
      setTg(t);
      const at = Date.now();
      if (!was || t.version !== was.version) active.current = at;
      if (!was) setMode(t.mode);
      const before = clockAt(clockRef.current, at);
      const c = adoptClock(phaseRef.current === "on" ? clockRef.current : null, t, at);
      clockRef.current = c;
      adRef.current = t.ad;
      setClock(c);
      setAd(t.ad);
      setNow(at);
      if (was && t.ticks !== was.ticks) refreshBingo(seasonId, couchId, n);
      const ch = t.change;
      if (was && ch && ch.at !== was.change?.at && ch.userId !== me && ch.by && !(ch.what === "pause" || ch.what === "ad")) {
        const key = ch.at;
        setFlash({ line: changeLine({ what: ch.what, by: ch.by, mine: false, at: t.at }), key });
        setTimeout(() => setFlash((f) => (f?.key === key ? null : f)), 6000);
      }
      // Someone started the "3, 2, 1": everyone here is pulled in.
      if (phaseRef.current === "start" && t.you && t.started && t.startsInMs > 0) {
        phaseRef.current = "on";
        setPhase("on");
        void loadRef.current(c.at, true);
      } else if (phaseRef.current === "on" && Math.abs(clockAt(c, at) - before) > 3000) void loadRef.current(clockAt(c, at), true);
    },
    [me, refreshBingo, seasonId, couchId, n]
  );

  const float = useCallback((r: { kind: ReactKind; userId: string; name: string; me: boolean }) => {
    const f: Float = { ...r, key: `${Date.now()}-${Math.random()}`, left: 55 + Math.random() * 35, sway: Math.random() * 40 - 20 };
    setFloats((x) => [...x.slice(-12), f]);
    setTimeout(() => setFloats((x) => x.filter((y) => y.key !== f.key)), 2600);
  }, []);

  /** Read what's been said up to the clock: from just before it on a jump (`open`), else what's new since the last read. */
  const load = useCallback(
    async (at: number, open: boolean) => {
      const id = ++loads.current;
      const from = open ? Math.max(-1, at - STREAM_BACK_MS) : since.current;
      try {
        // The running poll is also the watch along's heartbeat for the couch (who's on now); watching together, it asks whether the
        // session moved too, and what its people said comes without the wait.
        const s = tgRef.current?.you ? tgRef.current : null;
        const r = await watchApi.read(seasonId, couchId, n, at, from, open, !open && !!couchId, s ? { id: s.id, version: open ? null : s.version } : null);
        if (id !== loads.current) return;
        seeWatchers(r.now);
        if (r.together?.state) adopt(r.together.state, false);
        setInfo((was) => (open || !was ? r : { ...was, through: r.through, at: r.at }));
        if (open) {
          seen.current = new Set(r.reactions.map((x) => x.id));
          setLines(r.reactions.filter(isLine).slice(-STREAM_SHOWN));
          setPins(r.pins ?? []);
        } else {
          const fresh = r.reactions.filter((x) => !seen.current.has(x.id));
          for (const x of fresh) {
            seen.current.add(x.id);
            if (isLine(x)) continue;
            float({ kind: x.kind as ReactKind, userId: x.userId, name: x.name, me: x.mine });
          }
          const added = fresh.filter(isLine);
          if (added.length) {
            setLines((l) => [...l, ...added].slice(-STREAM_SHOWN));
            setPins((p) => [...p, ...added.map((x) => x.runtimeMs)]);
          }
        }
        since.current = Math.max(from, r.through >= 0 ? r.through : r.at - LATE_MS);
      } catch (e) {
        if (id === loads.current && open) toast((e as Error).message);
      }
    },
    [seasonId, couchId, n, float, seeWatchers, adopt]
  );
  useEffect(() => {
    loadRef.current = load;
  });

  // While the clock runs (and the tab's in front): what's new, every few seconds. (Together, the session's own loop asks.)
  useEffect(() => {
    if (!running || together) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void load(clockAt(clockRef.current, Date.now()), false);
    }, POLL_MS);
    return () => clearInterval(t);
  }, [running, load, together]);

  // Remember where you are, so closing and coming back picks up there.
  useEffect(() => {
    if (phase !== "on") return;
    // Once it's ended there's nothing to pick up: End takes it away.
    const keep = () => phaseRef.current === "on" && writeSaved(seasonId, n, { at: clockAt(clockRef.current, Date.now()), mode });
    keep();
    const t = setInterval(keep, 10_000);
    return () => {
      clearInterval(t);
      keep();
    };
  }, [phase, mode, seasonId, n, clock.since]);

  // Your clock, kept for the couch (who's on now): written whenever it starts, pauses, goes to an ad break or moves, a moment after
  // (so a few taps of +10s are one write). Alone, nothing's kept.
  useEffect(() => {
    if (!couchId || phase !== "on" || together) return;
    const t = setTimeout(() => {
      const c = clockRef.current;
      watchApi
        .session(seasonId, couchId, n, { at: clockAt(c, Date.now()), mode, running: c.since !== null, ad })
        .then((r) => seeWatchers(r.now))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [couchId, phase, clock, ad, mode, seasonId, n, seeWatchers, together]);

  // Paused (or in an ad break), it says it's still open every 20 s for ten minutes, then drops out of who's on now until it runs.
  // Coming back to the tab (or the page back from the browser's cache, after closing it sent you off) says so at once.
  useEffect(() => {
    if (!couchId || phase !== "on" || together) return;
    const beat = () => watchApi.session(seasonId, couchId, n, { beat: true }).then((r) => seeWatchers(r.now), () => {});
    const onVisible = () => {
      if (document.visibilityState === "visible") void beat();
    };
    const listen = (on: boolean) => {
      document[on ? "addEventListener" : "removeEventListener"]("visibilitychange", onVisible);
      window[on ? "addEventListener" : "removeEventListener"]("pageshow", onVisible);
    };
    listen(true);
    if (clock.since !== null) return () => listen(false);
    const stoppedAt = Date.now();
    const t = setInterval(() => {
      if (Date.now() - stoppedAt > PAUSED_BEAT_FOR_MS) clearInterval(t);
      else if (document.visibilityState === "visible") void beat();
    }, BEAT_MS);
    return () => {
      clearInterval(t);
      listen(false);
    };
  }, [couchId, phase, clock.since, seasonId, n, seeWatchers, together]);

  // Closing it, or the page going away, takes you out of who's on now (else you'd drop out by your last heartbeat); together, out
  // of the session (its clock carries on for the rest).
  useEffect(() => {
    if (!couchId) return;
    const bye = () => {
      if (together) {
        if (joinedId) togetherApi.leave(seasonId, couchId, n, joinedId);
      } else if (phaseRef.current === "on") watchApi.leave(seasonId, couchId, n, clockAt(clockRef.current, Date.now()));
    };
    window.addEventListener("pagehide", bye);
    return () => {
      window.removeEventListener("pagehide", bye);
      bye();
    };
  }, [couchId, seasonId, n, together, joinedId]);

  // ---- watching together ----

  /** Into the night's session (making it if nobody has): the answer's clock is yours. */
  const join = useCallback(async (): Promise<Together | null> => {
    if (!planId || !couchId) return null;
    try {
      const r = await togetherApi.join(seasonId, couchId, n, planId);
      setNight(r.night);
      if (r.now) seeWatchers(r.now);
      adopt(r.together, true);
      return r.together;
    } catch (e) {
      toast((e as Error).message);
      return null;
    }
  }, [planId, couchId, seasonId, n, seeWatchers, adopt]);

  // Opening a night's watch along: the night, and its session if anyone's opened it; once it's due, opening it is joining it.
  useEffect(() => {
    if (!planId || !couchId) return;
    let gone = false;
    togetherApi.read(seasonId, couchId, n, planId, null).then(
      (r) => {
        if (gone) return;
        setNight(r.night);
        if (r.now) seeWatchers(r.now);
        adopt(r.together, true);
        if (r.night && nightDue(r.night, Date.now())) void join();
      },
      (e) => {
        if (gone) return;
        toast((e as Error).message);
        closeRef.current();
      }
    );
    return () => {
      gone = true;
    };
  }, [planId, couchId, seasonId, n, seeWatchers, adopt, join]);

  // Open before it's due (a shared start's 15 minutes, the live airing's airtime): in it once it is.
  const youIn = !!tg?.you;
  useEffect(() => {
    if (!night || youIn || phase !== "start") return;
    const wait = Date.parse(night.startsAt) - (night.how === "live" ? 0 : START_EARLY_MS) - Date.now();
    if (wait <= 0) return;
    const t = setTimeout(() => void join(), Math.min(wait + 500, 2 ** 31 - 1));
    return () => clearTimeout(t);
  }, [night, youIn, phase, join]);

  // While you're in it: has the session moved? Every few seconds while it's open and in front (with the reactions while its clock
  // runs), every 30 s once it's sat still ten minutes, and not at all after an hour, until you tap something or come back to it.
  useEffect(() => {
    if (!planId || !couchId || !joinedId) return;
    let stop = false;
    let t: ReturnType<typeof setTimeout>;
    const ask = async () => {
      const s = tgRef.current;
      const c = clockRef.current;
      if (!s) return;
      if (phaseRef.current === "on" && c.since !== null && c.since <= Date.now()) await loadRef.current(clockAt(c, Date.now()), false);
      else {
        const r = await togetherApi.read(seasonId, couchId, n, planId, s.version, true).catch(() => null);
        if (r?.now) seeWatchers(r.now);
        if (r?.night) setNight(r.night);
        if (r?.together) adopt(r.together, false);
      }
    };
    const tick = async () => {
      if (stop) return;
      const quiet = Date.now() - active.current;
      const runs = phaseRef.current === "on" && clockRef.current.since !== null;
      if (document.visibilityState === "visible" && (runs || quiet < TOGETHER_STOP_AFTER_MS)) await ask();
      if (!stop) t = setTimeout(tick, runs || quiet < TOGETHER_SLOW_AFTER_MS ? TOGETHER_POLL_MS : TOGETHER_SLOW_MS);
    };
    t = setTimeout(tick, TOGETHER_POLL_MS);
    // Back in front (or the page back from the browser's cache): still here, at once.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      active.current = Date.now();
      togetherApi.beat(seasonId, couchId, n, joinedId).then((r) => adopt(r.together, false), () => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    return () => {
      stop = true;
      clearTimeout(t);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
    };
  }, [planId, couchId, joinedId, seasonId, n, seeWatchers, adopt]);

  /**
   * Your tap, for everyone in it: written a moment after the last tap (a few +10s are one write), the kind the last tap's; a start
   * at once. Polls' answers wait until it's written.
   */
  const forAll = useCallback(
    (change: TogetherChange, clockNow?: { at: number; running: boolean; ad: boolean }) => {
      const s = tgRef.current;
      if (!s || !couchId) return;
      active.current = Date.now();
      writing.current = true;
      if (pending.current) clearTimeout(pending.current);
      pending.current = setTimeout(
        async () => {
          pending.current = null;
          const c = clockRef.current;
          const at = Date.now();
          const body = clockNow ?? { at: clockAt(c, at), running: c.since !== null, ad: adRef.current };
          try {
            const r = await togetherApi.move(seasonId, couchId, n, s.id, { change, mode: s.mode, ...body });
            writing.current = pending.current !== null;
            adopt(r.together, true);
          } catch (e) {
            writing.current = false;
            toast((e as Error).message);
          }
        },
        change === "start" ? 0 : 300
      );
    },
    [couchId, seasonId, n, adopt]
  );

  // End: the clock stops and asks how it was (and there's nothing to pick up any more).
  const finish = useCallback(() => {
    if (couchId && together) {
      // Out of the session (its clock carries on for the rest).
      const s = tgRef.current;
      if (s?.you) togetherApi.leave(seasonId, couchId, n, s.id);
      if (s) {
        tgRef.current = { ...s, you: false };
        setTg(tgRef.current);
      }
    } else if (couchId && phaseRef.current === "on") watchApi.leave(seasonId, couchId, n, clockAt(clockRef.current, Date.now()));
    setClock((c) => stopClock(c, Date.now()));
    setAd(false);
    phaseRef.current = "end";
    setPhase("end");
    writeSaved(seasonId, n, null);
  }, [seasonId, couchId, n, together]);

  // While it runs (or someone else's does): the face and their marks move on, and at the end of the episode as the schedule has
  // it, it ends.
  const othersRun = phase === "on" && watchers.list.some((w) => w.running);
  useEffect(() => {
    if (!running && !othersRun) return;
    const t = setInterval(() => {
      const at = Date.now();
      if (phaseRef.current === "on" && clockAt(clockRef.current, at) >= runtimeRef.current) finish();
      else setNow(at);
    }, 250);
    return () => clearInterval(t);
  }, [running, othersRun, finish]);

  const start = (m: Mode, at: number, adOn = false) => {
    setMode(m);
    setAd(adOn);
    const t = Date.now();
    const c = adOn ? { at, since: null } : runClock({ at, since: null }, t);
    setNow(t);
    setClock(c);
    setPhase("on");
    void load(at, true);
  };

  const jump = (to: { byMs: number } | { toMs: number }) => {
    const t = Date.now();
    const c = moveClock(clock, t, to);
    setNow(t);
    setClock(c);
    void load(c.at, true);
    if (together) forAll("move");
  };

  const pause = () => {
    const t = Date.now();
    setNow(t);
    const resuming = clock.since === null && !ad;
    if (resuming) setClock(runClock(clock, t));
    else {
      setAd(false);
      setClock(stopClock(clock, t));
    }
    if (together) forAll(resuming ? "resume" : "pause");
  };

  const adBreak = () => {
    const t = Date.now();
    setNow(t);
    if (ad) {
      setAd(false);
      setClock(runClock(clock, t));
    } else {
      setAd(true);
      setClock(stopClock(clock, t));
    }
    if (together) forAll(ad ? "show" : "ad");
  };

  // The start, together: "3, 2, 1" for everyone in it; joining them where it is; or from the start on your own.
  const startTogether = async (how: "start" | "join" | "own") => {
    if (how === "own") {
      const s = tgRef.current;
      if (couchId && s?.you) togetherApi.leave(seasonId, couchId, n, s.id);
      tgRef.current = null;
      setTg(null);
      setPlanId(null);
      start("stream", 0);
      return;
    }
    const s = tgRef.current?.you ? tgRef.current : await join();
    if (!s) return;
    if (how === "start" && !s.started) {
      const t = Date.now();
      const c = { at: 0, since: t + COUNTDOWN_MS };
      clockRef.current = c;
      setNow(t);
      setClock(c);
      setAd(false);
      phaseRef.current = "on";
      setPhase("on");
      forAll("start", { at: 0, running: true, ad: false });
      void load(0, true);
      return;
    }
    const t = Date.now();
    const c = adoptClock(null, s, t);
    clockRef.current = c;
    setNow(t);
    setClock(c);
    phaseRef.current = "on";
    setPhase("on");
    void load(clockAt(c, t), true);
  };

  const close = () => onClose();

  const say = async (kind: string, extra: { text?: string; gif?: GifHit } = {}) => {
    const at = clockAt(clock, wallClock());
    if (kind !== "text" && kind !== "gif") float({ kind: kind as ReactKind, userId: "me", name: "you", me: true });
    try {
      const gif = extra.gif ? { id: extra.gif.id, url: extra.gif.url, w: extra.gif.w, h: extra.gif.h, title: extra.gif.title } : undefined;
      const { reaction } = await watchApi.say(seasonId, couchId, n, { at, kind, text: extra.text, gif });
      seen.current.add(reaction.id);
      if (isLine(reaction)) {
        setLines((l) => [...l, reaction].slice(-STREAM_SHOWN));
        setPins((p) => [...p, reaction.runtimeMs]);
      }
      return true;
    } catch (e) {
      toast((e as Error).message);
      return false;
    }
  };

  const send = async () => {
    const t = text.replace(/\s+/g, " ").trim();
    if (!t || sending) return;
    setSending(true);
    if (await say("text", { text: t })) setText("");
    setSending(false);
  };

  const takeBack = async (r: Reaction) => {
    try {
      await watchApi.unsay(seasonId, n, r.id);
      setLines((l) => l.filter((x) => x.id !== r.id));
      setPins((p) => {
        const i = p.indexOf(r.runtimeMs);
        return i < 0 ? p : [...p.slice(0, i), ...p.slice(i + 1)];
      });
      toast("Taken back");
    } catch (e) {
      toast((e as Error).message);
    }
  };

  const paused = phase === "on" && clock.since === null;
  // A "3, 2, 1" counting down: the clock starts for everyone in it at the same moment.
  const counting = phase === "on" && clock.since !== null && clock.since > now;
  const scopeLine = !info
    ? null
    : info.you.private
      ? "Watching privately: what you say stays yours"
      : !info.you.following
        ? "Not on your shows: what you say stays yours"
        : info.scope === "solo"
          ? couchId
            ? "Just you on this couch so far: what you say waits for whoever joins"
            : "Just you here: what you say stays yours"
          : null;
  const pct = (ms: number) => `${Math.min(100, (ms / runtimeMs) * 100)}%`;
  // Who else is on it, each where their clock has got to since it was read; the one furthest ahead leads the line. Together, the
  // people in it are with you (they're on its clock): the line names them, and the marks are everyone else's.
  const inIt = new Set((tg?.people ?? []).map((p) => p.userId));
  const others = phase === "start" ? [] : watchers.list.filter((w) => !together || !inIt.has(w.userId)).map((w) => ({ ...w, pos: watcherAt(w, Math.max(0, now - watchers.at)) }));
  const lead = others.length ? others.reduce((a, b) => (b.pos > a.pos ? b : a)) : null;
  const gap = lead ? lead.pos - pos : 0;
  const nearLine = lead
    ? `${nowLine(others.map((o) => o.name))} · ${others.length > 1 ? `${lead.name} ` : ""}${lead.ad ? "in an ad break" : `${lead.running ? "" : "paused, "}${offsetText(gap)}`}`
    : null;
  const catchUp = lead && gap > CATCH_UP_MS && !together ? lead : null;
  // Together: who's here with you, and what the last change to the clock says (a pause or an ad break stays until it's undone).
  const here = (tg?.people ?? []).filter((p) => p.here && p.userId !== me).map((p) => p.name);
  const nightIn = (night?.in ?? []).filter((p) => p.userId !== me).map((p) => p.name);
  const withLine = here.length ? namesLine(here) : nightIn.length ? namesLine(nightIn) : "";
  const hold = tg?.change && (paused || ad) && (tg.change.what === "pause" || tg.change.what === "ad") ? tg.change : null;
  const holdLine = hold ? changeLine({ what: hold.what, by: hold.by, mine: hold.userId === me, at: pos }) : null;

  return (
    <Layer className={paused || ad ? "nd-wa-paused" : ""}>
      <div className="flex items-start gap-2.5 pb-2 pl-4 pr-2.5 pt-3">
        <div className="min-w-0 flex-1">
          <b className="type-caption block truncate text-[18px]">
            {label} · Episode {n}
          </b>
          <small className="mt-[3px] block truncate text-xs font-medium text-muted-foreground" data-watch-top>
            {together ? (withLine ? `Watch along · ${withLine}` : "Watching together") : `${Math.round(runtimeMs / 60_000)} min${show.plays ? " · your games come with you" : ""}`}
          </small>
          {held && (
            <span data-wake-lock className="mt-[3px] inline-flex items-center gap-1 text-[11px] font-bold text-good">
              <Zap className="size-3" aria-hidden />
              Screen stays on
            </span>
          )}
        </div>
        {show.ready && (
          <button
            type="button"
            data-watch-bingo
            onClick={() => openBingo({ seasonId, couchId, episode: n, label, solo: show.solo })}
            className="flex h-10 items-center gap-1.5 rounded-[3px] px-2.5 text-[13px] font-bold outline-1 -outline-offset-1 outline-input"
          >
            <Grid3x3 className="size-4" aria-hidden />
            Bingo
          </button>
        )}
        <button type="button" aria-label="Close" onClick={close} className="grid size-10 flex-none place-items-center rounded-[3px] hover:bg-card">
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <div className="mx-4 flex gap-[3px] rounded-[3px] bg-card p-[3px]" role="radiogroup" aria-label="How you're watching">
        {(["stream", "live"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            data-mode={m}
            onClick={() => {
              setMode(m);
              if (m === "stream" && ad) adBreak();
            }}
            className={`h-9 flex-1 rounded-[2px] text-[13px] font-bold ${mode === m ? "bg-foreground text-background" : "text-muted-foreground"}`}
          >
            {m === "stream" ? "Streaming" : "Live TV"}
          </button>
        ))}
      </div>

      <div className="mx-4 mt-2.5 flex items-end gap-2.5 rounded-[3px] bg-card px-3.5 pb-3 pt-3.5">
        {counting ? (
          <>
            <span data-watch-countdown={Math.ceil((clock.since! - now) / 1000)} className="type-num text-[64px] leading-[.85] text-chyron tabular-nums">
              {Math.ceil((clock.since! - now) / 1000)}
            </span>
            <span className="pb-1 text-[15px] text-muted-foreground">Press play at zero · everyone starts together</span>
          </>
        ) : (
          <>
            <span data-watch-clock={Math.floor(pos / 1000)} className={`type-num text-[64px] leading-[.85] tabular-nums transition-opacity ${paused || ad ? "opacity-35" : ""}`}>
              {runtimeText(pos)}
            </span>
            <span className="pb-1 text-[15px] text-muted-foreground">
              {ad ? "Ad break" : paused ? "Paused" : `of ${runtimeText(runtimeMs)}`}
            </span>
          </>
        )}
      </div>
      {together && phase === "on" && (holdLine || flash) && (
        <div data-watch-together-bar={hold ? hold.what : "said"} className="mx-4 mt-2 flex min-h-11 items-center gap-2 rounded-[3px] bg-plate py-1.5 pl-3 pr-1.5 text-[13px] font-bold text-plate-foreground">
          {hold?.what === "ad" ? <Tv className="size-4 flex-none" aria-hidden /> : hold ? <Pause className="size-4 flex-none" aria-hidden /> : <Users className="size-4 flex-none" aria-hidden />}
          <span className="min-w-0 flex-1">{holdLine ?? flash?.line}</span>
          {hold && hold.userId !== me && (
            <button type="button" data-watch-resume-all onClick={hold.what === "ad" ? adBreak : pause} className="h-8 flex-none rounded-[2px] bg-plate-foreground px-2.5 text-xs font-bold text-plate">
              {hold.what === "ad" ? "Back to the show" : "Resume for everyone"}
            </button>
          )}
        </div>
      )}

      <div className="relative mx-4 mt-3 h-7" aria-hidden>
        <span className="absolute inset-x-0 top-3 h-1 rounded-sm bg-border" />
        <span className="absolute left-0 top-3 h-1 rounded-sm bg-foreground" style={{ width: pct(pos) }} />
        {pins
          .filter((p) => p <= pos)
          .map((p, i) => (
            <span key={`${p}-${i}`} data-pin className="absolute top-2 h-3 w-[3px] rounded-[1px] bg-chyron opacity-55" style={{ left: pct(p) }} />
          ))}
        {others.slice(0, 4).map((o) => (
          <span key={o.userId} data-who={o.name} className="absolute -top-0.5 -ml-[9px]" style={{ left: pct(o.pos) }}>
            <Avatar id={o.userId} name={o.name} size={18} />
          </span>
        ))}
        <span className="absolute top-1 -ml-2.5 size-5 rounded-full bg-foreground shadow-[0_0_0_4px_rgba(244,242,248,.15)]" style={{ left: pct(pos) }} />
      </div>

      {together && phase === "on" && (
        <div data-watch-together={here.length} className="mx-4 mt-1 flex min-h-8 items-center gap-2 text-[13px] text-muted-foreground">
          <Users className="size-3.5 flex-none text-good" aria-hidden />
          <span className="min-w-0 flex-1 truncate">
            {here.length ? `Watching together · ${namesLine(here)} ${here.length === 1 ? "is" : "are"} here` : `Watching together · just you so far${nightIn.length ? ` · ${namesLine(nightIn)} ${nightIn.length === 1 ? "is" : "are"} in` : ""}`}
          </span>
        </div>
      )}
      {nearLine && (
        <div data-watch-near className="mx-4 mt-1 flex min-h-8 items-center gap-2 text-[13px] text-muted-foreground">
          <i className="size-[7px] flex-none animate-pulse rounded-full bg-good" aria-hidden />
          <span className="min-w-0 flex-1">{nearLine}</span>
          {catchUp && (
            <button
              type="button"
              data-watch-catch-up={catchUp.name}
              onClick={() => {
                jump({ toMs: catchUp.pos });
                toast(`Caught up with ${catchUp.name}`);
              }}
              className="-my-1 h-8 flex-none rounded-[3px] px-2.5 text-[13px] font-bold text-good outline-1 -outline-offset-1 outline-good/50"
            >
              Catch up
            </button>
          )}
        </div>
      )}

      <p className="mx-4 mt-1.5 flex items-start gap-1.5 text-xs leading-snug text-muted-foreground">
        <Eye className="mt-px size-3.5 flex-none text-good" aria-hidden />
        <span>{together ? "What the people here say shows up as you reach it; the rest of the couch's, 30 s after the moment" : "Comments and reactions arrive 30 s after the moment, never before it"}</span>
      </p>
      {scopeLine && (
        <p data-watch-scope className="mx-4 mt-1 text-xs text-muted-foreground">
          {scopeLine}
        </p>
      )}

      <div className="relative mt-2.5 min-h-0 flex-1 overflow-hidden [mask-image:linear-gradient(180deg,transparent,#000_22%)]">
        <ul data-watch-stream className="absolute inset-x-4 bottom-2 flex flex-col gap-2.5">
          {lines.map((r) => (
            <li key={r.id} data-reaction={r.kind} data-mine={r.mine ? "1" : "0"} className="nd-wa-rise flex gap-2.5">
              <Avatar id={r.userId} name={r.name} size={30} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <b className="font-bold text-foreground">{r.mine ? "you" : r.name}</b>
                  <span>at {runtimeText(r.runtimeMs)}</span>
                  {r.mine && (
                    <button type="button" data-take-back onClick={() => takeBack(r)} aria-label="Take it back" className="-my-2 ml-auto grid size-8 place-items-center rounded-[3px] text-muted-foreground hover:bg-card">
                      <X className="size-3.5" aria-hidden />
                    </button>
                  )}
                </div>
                {r.kind === "gif" && r.gif ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a GIF from GIPHY's own hosts
                  <img src={r.gif.url} alt={r.gif.title || "GIF"} className="mt-1 max-h-[150px] w-[170px] rounded-[4px] object-cover" style={{ aspectRatio: `${r.gif.w} / ${r.gif.h}` }} />
                ) : (
                  <p className={`mt-0.5 text-[15px] leading-snug [overflow-wrap:anywhere] ${r.mine ? "text-chyron" : ""}`}>{r.text}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden data-watch-floats>
          {floats.map((f) => {
            const k = KIND[f.kind];
            const Icon = k.icon;
            return (
              <span
                key={f.key}
                data-float={f.kind}
                className={`nd-wa-float absolute bottom-0 grid place-items-center rounded-full text-[#121018] shadow-[0_6px_14px_rgba(0,0,0,.4)] ${f.me ? "size-[46px]" : "size-[38px]"}`}
                style={{ left: `${f.left}%`, background: k.colour, ["--sway" as string]: `${f.sway}px` }}
              >
                <Icon className="size-5" strokeWidth={2.4} />
                {!f.me && (
                  <i className="absolute -bottom-1 -right-1 grid size-4 place-items-center rounded-[3px] text-[9px] font-extrabold not-italic shadow-[0_0_0_2px_#0b0a10]">
                    <Avatar id={f.userId} name={f.name} size={16} />
                  </i>
                )}
              </span>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2 px-4 pt-1.5">
        {REACT_KINDS.map((k) => {
          const Icon = KIND[k].icon;
          return (
            <button
              key={k}
              type="button"
              data-react={k}
              aria-label={`React: ${KIND[k].label}`}
              disabled={phase !== "on"}
              onClick={() => void say(k)}
              className="nd-press grid h-11 flex-1 place-items-center rounded-[3px] bg-card disabled:opacity-40"
              style={{ color: KIND[k].colour }}
            >
              <Icon className="size-[22px]" strokeWidth={2.2} aria-hidden />
            </button>
          );
        })}
        {info?.gifs && (
          <button
            type="button"
            data-gif-button
            aria-label="Send a GIF"
            disabled={phase !== "on"}
            onClick={() => setSheet("gif")}
            className="type-caption h-11 flex-1 rounded-[3px] text-[13px] tracking-[0.06em] text-chyron outline-[1.5px] -outline-offset-[1.5px] outline-chyron disabled:opacity-40"
          >
            GIF
          </button>
        )}
      </div>

      <div className="grid grid-cols-[1fr_1.4fr_1fr] gap-2 px-4 pb-2 pt-2.5">
        <button type="button" data-watch-back onClick={() => jump({ byMs: -10_000 })} className="nd-press h-[58px] rounded-[4px] bg-card text-sm font-bold">
          −10s
        </button>
        <button
          type="button"
          data-watch-pause
          onClick={pause}
          disabled={counting}
          className="nd-press flex h-[58px] flex-col items-center justify-center gap-0.5 rounded-[4px] bg-foreground text-base font-bold leading-none text-background disabled:opacity-50"
        >
          {paused || ad ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
          {paused || ad ? "Resume" : "Pause"}
          {together && <small className="text-[11px] font-semibold opacity-70">for everyone</small>}
        </button>
        {mode === "live" ? (
          <button
            type="button"
            data-watch-ad
            aria-pressed={ad}
            onClick={adBreak}
            className={`nd-press flex h-[58px] flex-col items-center justify-center gap-0.5 rounded-[4px] text-sm font-bold ${ad ? "bg-chyron text-chyron-foreground" : "bg-card"}`}
          >
            <Tv className="size-4" aria-hidden />
            {ad ? "Back to show" : "Ad break"}
          </button>
        ) : (
          <span />
        )}
      </div>
      <div className="flex justify-center gap-2 px-4">
        <button type="button" data-watch-nudge="fwd" onClick={() => jump({ byMs: 10_000 })} className={NUDGE}>
          +10s
        </button>
        <button type="button" data-watch-nudge="time" onClick={() => setSheet("time")} className={NUDGE}>
          Set the time
        </button>
        <button type="button" data-watch-nudge="end" onClick={finish} className={NUDGE}>
          End ›
        </button>
      </div>
      <form
        className="flex gap-2 px-4 pb-4 pt-2.5"
        style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          data-watch-say
          value={text}
          maxLength={TEXT_MAX}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Say something at ${runtimeText(pos)}`}
          aria-label="Comment at this moment"
          disabled={phase !== "on"}
          className="h-[46px] min-w-0 flex-1 rounded-[3px] border border-input bg-card px-3 text-base outline-0 focus:border-chyron"
        />
        <button type="submit" disabled={!text.trim() || sending || phase !== "on"} className="w-[66px] rounded-[3px] bg-chyron font-extrabold text-chyron-foreground disabled:bg-secondary disabled:text-muted-foreground">
          Send
        </button>
      </form>

      {phase === "start" &&
        (together ? (
          <TogetherStart show={show} episode={n} night={night} tg={tg} me={me} onStart={startTogether} onClose={close} />
        ) : (
          <StartPanel show={show} episode={n} saved={saved} onStart={start} onClose={close} />
        ))}
      {phase === "end" && (
        <EndPanel
          show={show}
          episode={n}
          info={info}
          onBack={close}
          onKeepWatching={() => (together ? void startTogether("join") : setPhase("on"))}
        />
      )}

      <GifSheet
        open={sheet === "gif"}
        at={pos}
        onOpenChange={(o) => !o && setSheet(null)}
        onPick={(g) => {
          setSheet(null);
          void say("gif", { gif: g });
        }}
      />
      <SetTimeSheet
        open={sheet === "time"}
        at={pos}
        onOpenChange={(o) => !o && setSheet(null)}
        onSet={(ms) => {
          setSheet(null);
          jump({ toMs: ms });
        }}
      />
    </Layer>
  );
}

// ---------- the start ----------

function StartPanel({ show, episode: n, saved, onStart, onClose }: { show: ShowData; episode: number; saved: Saved | null; onStart: (m: Mode, at: number, ad?: boolean) => void; onClose: () => void }) {
  const header = show.header!;
  const card = useWatchCard(header.seasonId, show.couch?.id ?? null, true, true);
  const c = card.data?.episode === n ? card.data : null;
  const airAt = c?.airAt ? Date.parse(c.airAt) : null;
  const now = useNow(airAt != null);
  const soon = airAt != null && airAt > now;
  const resume = saved && saved.at > 5000 ? saved : null;
  const who = c?.people ?? [];
  // Who's on it now (read as it opened), each where their clock has got to since; and while it's on air, the live airing's clock:
  // someone's on the couch watching it live, else from airtime, a little behind (watch-along.ts liveClock).
  const onIt = (card.data?.now ?? []).filter((w) => w.episode === n).map((w) => ({ ...w, at: watcherAt(w, Math.max(0, now - card.dataUpdatedAt)) }));
  const live = c?.status === "live" && airAt != null && !soon ? liveClock(now - airAt, onIt) : null;
  const earlier = who.filter((p) => !onIt.some((w) => w.userId === p.userId));
  const faces = [...onIt.map((w) => ({ userId: w.userId, name: w.name })), ...earlier];
  return (
    <div data-watch-start className="absolute inset-0 z-[2] isolate flex flex-col justify-end gap-2.5 bg-[#0b0a10] px-4 pb-6" style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}>
      <ShowArt seasonId={header.seasonId} artUrl={header.show.artUrl} name={header.show.name} className="absolute inset-0 -z-[2] size-full opacity-55" />
      <span aria-hidden className="absolute inset-0 -z-[1] bg-[linear-gradient(180deg,rgba(11,10,16,.2),rgba(11,10,16,.85)_50%,#0b0a10)]" />
      <button type="button" aria-label="Close" onClick={onClose} className="absolute right-2.5 top-3 grid size-10 place-items-center rounded-[3px] bg-[rgba(16,14,21,.6)]">
        <X className="size-5" aria-hidden />
      </button>
      <h3 className="type-caption text-[42px] leading-[.92]">
        Watch Episode {n}
        <br />
        {show.solo ? "your way" : "with the couch"}
      </h3>
      <p className="mb-1.5 text-[15px] leading-normal text-white/80">
        {soon && airAt != null
          ? `It airs ${airTime(airAt)}. Open this when it starts: what you say waits here for whoever watches next.`
          : show.solo
            ? "Start when your episode starts. Pause, rewind, react: anything you say is pinned to that moment."
            : "Start when your episode starts. What the couch said, and how they reacted, shows up as you reach it, so nothing spoils."}
      </p>
      {live && (
        <Choice
          first
          data-start="join-live"
          icon={Radio}
          title="Join the live airing"
          line={live.with ? `In step with ${live.with} · ${runtimeText(live.at)} in` : `About ${runtimeText(live.at)} in, from airtime · a touch behind, to be safe`}
          onClick={() => onStart("live", live.at, live.ad)}
        />
      )}
      {resume && (
        <Choice first={!live} data-start="resume" icon={Play} title={`Pick up at ${runtimeText(resume.at)}`} line="Where you left off" disabled={soon} onClick={() => onStart(resume.mode, resume.at)} />
      )}
      <Choice first={!resume && !live} data-start="stream" icon={Zap} title="Streaming, no ads" line="The clock follows the episode" disabled={soon} onClick={() => onStart("stream", 0)} />
      <Choice
        data-start="live"
        icon={Tv}
        title={live ? "Live on TV, from the start" : "Live on TV"}
        line={live ? "Recorded, or catching it from the top: tap Ad break when the ads start" : "Tap Ad break when the ads start, so the clock waits"}
        disabled={soon}
        onClick={() => onStart("live", 0)}
      />
      {soon && airAt != null && <p className="text-center text-[13px] font-semibold text-muted-foreground">Opens {airTime(airAt)}</p>}
      {!show.solo && (onIt.length > 0 || (c && c.status !== "soon")) && (
        <div data-watch-left className="mt-1 flex items-center gap-2.5 text-[13px] text-white/80">
          {!!faces.length && (
            <span className="flex">
              {faces.slice(0, 4).map((p) => (
                <span key={p.userId} className="-mr-1.5 rounded-[3px] ring-2 ring-[#0b0a10]">
                  <Avatar id={p.userId} name={p.name} size={22} />
                </span>
              ))}
            </span>
          )}
          <span className={faces.length ? "ml-1.5" : ""}>
            {onIt.length
              ? `${namesLine(onIt.map((w) => w.name))} ${onIt.length === 1 ? "is" : "are"} on now${earlier.length ? ` · ${earlier.length} watched earlier` : ""}`
              : leftLine(
                  who.map((p) => p.name),
                  c?.count ?? 0
                )}
          </span>
        </div>
      )}
    </div>
  );
}

function Choice({ first, icon: Icon, title, line, disabled, onClick, ...rest }: { first?: boolean; icon: LucideIcon; title: string; line: string; disabled?: boolean; onClick: () => void; "data-start": string }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled}
      onClick={onClick}
      className="nd-press flex min-h-[70px] w-full items-center gap-3 rounded-[4px] bg-[rgba(34,31,44,.92)] px-3.5 text-left text-[17px] font-bold disabled:opacity-50"
    >
      <span className={`grid size-[42px] flex-none place-items-center rounded-[3px] ${first ? "bg-chyron text-chyron-foreground" : "bg-secondary"}`}>
        <Icon className="size-5" aria-hidden />
      </span>
      <span>
        {title}
        <small className="mt-[3px] block text-[13px] font-normal text-muted-foreground">{line}</small>
      </span>
    </button>
  );
}

// ---------- the start, together ----------

/**
 * A planned night's start (the mock's "Watching together"): who's in, then one choice: Join the live airing, or Start at the same
 * time ("3, 2, 1 for everyone in it"); once it's going, Join them where it is, or watch along from the start on your own. Before
 * it's due, when it opens.
 */
function TogetherStart({ show, episode: n, night, tg, me, onStart, onClose }: { show: ShowData; episode: number; night: TogetherAnswer["night"]; tg: Together | null; me: string; onStart: (how: "start" | "join" | "own") => void; onClose: () => void }) {
  const header = show.header!;
  const at = night ? Date.parse(night.startsAt) : null;
  const now = useNow(at != null);
  const due = night ? nightDue(night, now) : false;
  const live = night?.how === "live";
  const opensAt = at != null ? at - (live ? 0 : START_EARLY_MS) : null;
  const ins = (night?.in ?? []).filter((p) => p.userId !== me);
  const here = (tg?.people ?? []).filter((p) => p.here && p.userId !== me);
  const going = !!tg?.started;
  // Where it's got to (the session's clock, read when it came).
  const [readAt] = useState(() => Date.now());
  const pos = tg ? (tg.running && tg.startsInMs <= 0 ? tg.at + Math.max(0, now - readAt) : tg.at) : 0;
  const faces = here.length ? here : ins;
  return (
    <div data-watch-start data-together-start={night ? (due ? (going ? "going" : "ready") : "early") : "loading"} className="absolute inset-0 z-[2] isolate flex flex-col justify-end gap-2.5 bg-[#0b0a10] px-4 pb-6" style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}>
      <ShowArt seasonId={header.seasonId} artUrl={header.show.artUrl} name={header.show.name} className="absolute inset-0 -z-[2] size-full opacity-55" />
      <span aria-hidden className="absolute inset-0 -z-[1] bg-[linear-gradient(180deg,rgba(11,10,16,.2),rgba(11,10,16,.85)_50%,#0b0a10)]" />
      <button type="button" aria-label="Close" onClick={onClose} className="absolute right-2.5 top-3 grid size-10 place-items-center rounded-[3px] bg-[rgba(16,14,21,.6)]">
        <X className="size-5" aria-hidden />
      </button>
      <h3 className="type-caption text-[42px] leading-[.92]">
        Watching
        <br />
        together
      </h3>
      <p className="mb-1.5 text-[15px] leading-normal text-white/80">
        {going && here.length
          ? `${namesLine(here.map((p) => p.name))} ${here.length === 1 ? "is" : "are"} watching. `
          : ins.length
            ? `${namesLine(ins.map((p) => p.name))} ${live ? `${ins.length === 1 ? "is" : "are"} on the live airing` : "start with you"}. `
            : `Episode ${n} · ${live ? "the live airing" : "starting together"}${at != null ? `, ${airTime(at)}` : ""}. `}
        Anyone can pause for everyone, and late arrivals watch along after.
      </p>
      {!night ? (
        <div aria-busy className="h-[70px] animate-pulse rounded-[4px] bg-card" />
      ) : live ? (
        <Choice
          first
          data-start="together-live"
          icon={Tv}
          title="Join the live airing"
          line={!due && at != null ? `Opens ${airTime(at)}` : going ? `In step with the couch · ${runtimeText(pos)} in` : "Tap Ad break when the ads start, so everyone stays in step"}
          disabled={!due}
          onClick={() => onStart("join")}
        />
      ) : going ? (
        <>
          <Choice first data-start="together-join" icon={Users} title={`Join them · ${runtimeText(pos)} in`} line="In step with everyone in it" onClick={() => onStart("join")} />
          <Choice data-start="together-own" icon={Play} title="From the start, on your own" line="What they said shows up as you reach it" onClick={() => onStart("own")} />
        </>
      ) : (
        <Choice
          first
          data-start="together-start"
          icon={Play}
          title="Start at the same time"
          line={!due && opensAt != null ? `Opens ${airTime(opensAt)} · it starts ${airTime(at!)}` : "3, 2, 1 for everyone in it"}
          disabled={!due}
          onClick={() => onStart("start")}
        />
      )}
      {night && (
        <div data-watch-here className="mt-1 flex items-center gap-2.5 text-[13px] text-white/80">
          {!!faces.length && (
            <span className="flex">
              {faces.slice(0, 4).map((p) => (
                <span key={p.userId} className="-mr-1.5 rounded-[3px] ring-2 ring-[#0b0a10]">
                  <Avatar id={p.userId} name={p.name} size={22} />
                </span>
              ))}
            </span>
          )}
          <span className={faces.length ? "ml-1.5" : ""}>
            {here.length
              ? `${namesLine(here.map((p) => p.name))} ${here.length === 1 ? "is" : "are"} here`
              : ins.length
                ? `Nobody's here yet · ${namesLine(ins.map((p) => p.name))} ${ins.length === 1 ? "is" : "are"} in`
                : "Just you so far"}
          </span>
        </div>
      )}
    </div>
  );
}

// ---------- the end ----------

function EndPanel({ show, episode: n, info, onBack, onKeepWatching }: { show: ShowData; episode: number; info: WatchRead | null; onBack: () => void; onKeepWatching: () => void }) {
  const header = show.header!;
  const couchId = show.couch?.id ?? null;
  const afterRating = useAfterRating();
  const afterWatching = useAfterWatching();
  const openReveal = useOpenReveal();
  const [busy, setBusy] = useState(false);
  const [tapped, setTapped] = useState(0);
  const seen = info?.you.seen ?? (show.seenThrough ?? 0) >= n;
  const toReveal = show.plays && !seen && show.episodes?.reveal?.episode === n;
  const waiting = show.plays && !seen && !toReveal;
  const label = rateLabel(show);
  const rate = async (stars: number) => {
    if (busy) return;
    setBusy(true);
    setTapped(stars);
    try {
      // A show you only watch: rating it is seeing it (where you are moves to it).
      if (!seen) {
        await watching.follow(header.seasonId, { seenThrough: n });
        await afterWatching();
      }
      afterRating(await ratingsApi.rate(header.seasonId, couchId, n, { stars }), couchId);
      openRate({ seasonId: header.seasonId, couchId, episode: n, label, solo: show.solo });
    } catch (e) {
      setTapped(0);
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div data-watch-end className="absolute inset-0 z-[3] flex flex-col justify-center gap-3.5 bg-[#0b0a10] px-4" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <h3 className="type-caption text-[44px] leading-[.92]">
        How was
        <br />
        Episode {n}?
      </h3>
      {waiting ? (
        <p data-watch-end-line className="text-[15px] leading-normal text-muted-foreground">
          Your scores come with the results. Reveal them on Tonight once they&rsquo;re in, then rate it.
        </p>
      ) : toReveal ? (
        <p data-watch-end-line className="text-[15px] leading-normal text-muted-foreground">
          Results are in. Reveal your scores, then rate it.
        </p>
      ) : (
        <>
          <div className="flex gap-2" role="radiogroup" aria-label="Your stars">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={tapped === s}
                aria-label={`${s} ${s === 1 ? "star" : "stars"}`}
                data-end-star={s}
                disabled={busy}
                onClick={() => rate(s)}
                className={`grid size-14 place-items-center rounded-[4px] transition-transform ${s <= tapped ? "-translate-y-[3px] bg-secondary" : "bg-card"}`}
              >
                <Star className={`size-[30px] ${s <= tapped ? "fill-chyron stroke-chyron" : "stroke-muted-foreground"}`} strokeWidth={1.8} aria-hidden />
              </button>
            ))}
          </div>
          <p data-watch-end-line className="text-[13px] text-muted-foreground">
            {seen ? `Tap your stars for ${show.solo ? "everyone's" : "the couch"} verdict` : `Rating it marks Episode ${n} seen`}
          </p>
        </>
      )}
      <div className="mt-4 flex flex-col gap-2.5">
        {toReveal && (
          <Btn tone="must" wide data-watch-reveal onClick={() => openReveal(n)}>
            Reveal your scores
          </Btn>
        )}
        <Btn wide data-watch-done onClick={onBack}>
          Back to Tonight
        </Btn>
        <button type="button" data-watch-keep onClick={onKeepWatching} className="h-11 text-[14px] font-semibold text-muted-foreground">
          Keep watching
        </button>
      </div>
    </div>
  );
}

// ---------- the sheets ----------

function GifSheet({ open, at, onOpenChange, onPick }: { open: boolean; at: number; onOpenChange: (o: boolean) => void; onPick: (g: GifHit) => void }) {
  const [q, setQ] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const [hits, setHits] = useState<GifHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    const words = q.trim();
    const t = setTimeout(
      () => {
        setAsked(words);
        watchApi
          .gifs(words)
          .then((r) => {
            setHits(r.gifs);
            setError(null);
          })
          .catch((e) => setError((e as Error).message));
      },
      words ? 350 : 0
    );
    return () => clearTimeout(t);
  }, [open, q]);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Send a GIF" subtitle={`At ${runtimeText(at)} · the couch sees it when they reach this moment`}>
      <label className="flex h-12 items-center gap-2 rounded-[3px] border border-input bg-background px-3">
        <Search className="size-4 text-muted-foreground" aria-hidden />
        <input data-gif-search value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search GIFs" autoComplete="off" className="min-w-0 flex-1 bg-transparent text-base outline-0" />
      </label>
      {error ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{error}</p>
      ) : !hits ? (
        <div aria-busy className="mt-3 h-48 animate-pulse rounded-[3px] bg-secondary" />
      ) : !hits.length ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No GIFs for &ldquo;{asked}&rdquo;</p>
      ) : (
        <div data-gif-grid className="mt-3 grid grid-cols-3 gap-1.5">
          {hits.map((g) => (
            <button key={g.id} type="button" data-gif={g.id} onClick={() => onPick(g)} className="nd-press overflow-hidden rounded-[3px] bg-secondary">
              {/* eslint-disable-next-line @next/next/no-img-element -- GIPHY's own picture */}
              <img src={g.preview} alt={g.title || "GIF"} className="aspect-[4/3] size-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      <p className="mt-2.5 text-center text-[11px] font-semibold text-muted-foreground">Powered by GIPHY</p>
    </Sheet>
  );
}

function SetTimeSheet({ open, at, onOpenChange, onSet }: { open: boolean; at: number; onOpenChange: (o: boolean) => void; onSet: (ms: number) => void }) {
  const [v, setV] = useState("");
  const ms = parseRuntime(v);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Set the time" subtitle="Where your episode is now, as your player shows it">
      <form
        className="flex gap-2 pt-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (ms !== null) {
            onSet(ms);
            setV("");
          }
        }}
      >
        <input
          data-watch-time
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder={runtimeText(at)}
          inputMode="text"
          aria-label="Minutes and seconds, like 23:10"
          className="type-num h-[52px] min-w-0 flex-1 rounded-[3px] border border-input bg-background px-3 text-[22px] outline-0 focus:border-chyron"
        />
        <Btn tone="ink" type="submit" disabled={ms === null}>
          Set
        </Btn>
      </form>
      <p className="mt-2 text-[13px] text-muted-foreground">Minutes and seconds, like 23:10. Moving the clock back is fine: what you&rsquo;ve passed shows again.</p>
    </Sheet>
  );
}
