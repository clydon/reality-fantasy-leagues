"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { Crown, Eye, Flame, Grid3x3, Laugh, Pause, Play, Search, Star, Tv, X, Zap, type LucideIcon } from "lucide-react";
import {
  clockAt,
  LATE_MS,
  leftLine,
  moveClock,
  parseRuntime,
  REACT_KINDS,
  runClock,
  runtimeText,
  STREAM_BACK_MS,
  stopClock,
  TEXT_MAX,
  type Clock,
  type ReactKind,
} from "@/lib/game/watch-along";
import { airTime } from "../clock";
import { ratingsApi, useAfterRating, useAfterWatching, useWatchCard, watchApi, watching, type GifHit, type Reaction, type WatchRead } from "../data";
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
// show you only watch seen), or Reveal your scores first on one you play. Polls only while its clock runs (docs/HOSTING.md). Who's
// watching right now (part 2) and watching together with a shared clock (part 3) come later.

/** Opening the watch along from inside the show space: your next episode, or `ep`. */
export function useOpenWatch() {
  const page = usePushedPage("watch", ["ep"]);
  return (ep?: number | null) => page.showWith(ep ? { ep: String(ep) } : {});
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

// ---------- Tonight's card ----------

/** Tonight's Watch along card (the mock's wacta): which episode, and who on the couch left reactions there. While your episode's
 *  on air it leads Tonight (`place="lead"`, the mock's during phase), else it sits after the extras (`"below"`). */
export function WatchAlongCard({ seasonId, show, place }: { seasonId: string; show: ShowData; place: "lead" | "below" }) {
  const couchId = show.couch?.id ?? null;
  const card = useWatchCard(seasonId, couchId, !!show.header);
  const open = useOpenWatch();
  const c = card.data;
  if (!show.header || !c?.episode || (c.status === "live") !== (place === "lead")) return null;
  const t = c.airAt ? Date.parse(c.airAt) : null;
  const left = leftLine(
    c.people.map((p) => p.name),
    c.count
  );
  const line =
    c.status === "soon"
      ? "Opens at airtime · start it when the episode starts"
      : show.solo
        ? "Pause, rewind, react · rate it after"
        : c.status === "live" && !c.count
          ? `Your bingo card comes with you · ${show.plays ? "your moves are locked in" : "say something for whoever watches next"}`
          : left;
  return (
    <button
      type="button"
      data-watch-card={c.episode}
      data-watch-status={c.status}
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
  const page = usePushedPage("watch", ["ep"]);
  const params = useSearchParams();
  const asked = Number(params.get("ep")) || null;
  const seasonId = show.header?.seasonId ?? null;
  const couchId = show.couch?.id ?? null;
  const card = useWatchCard(seasonId, couchId, page.open && !asked);
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const episode = asked ?? card.data?.episode ?? null;
  if (!mounted || !page.open || !show.header) return null;
  return createPortal(
    episode ? (
      <WatchAlong key={`${seasonId}:${episode}`} show={show} episode={episode} onClose={page.close} />
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

function WatchAlong({ show, episode: n, onClose }: { show: ShowData; episode: number; onClose: () => void }) {
  const header = show.header!;
  const seasonId = header.seasonId;
  const couchId = show.couch?.id ?? null;
  const label = rateLabel(show);
  const card = useWatchCard(seasonId, couchId);
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
  useEffect(() => {
    clockRef.current = clock;
    phaseRef.current = phase;
    runtimeRef.current = runtimeMs;
  });

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
        const r = await watchApi.read(seasonId, couchId, n, at, from, open);
        if (id !== loads.current) return;
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
    [seasonId, couchId, n, float]
  );

  // While the clock runs (and the tab's in front): what's new, every few seconds.
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void load(clockAt(clockRef.current, Date.now()), false);
    }, POLL_MS);
    return () => clearInterval(t);
  }, [running, load]);

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

  // End: the clock stops and asks how it was (and there's nothing to pick up any more).
  const finish = useCallback(() => {
    setClock((c) => stopClock(c, Date.now()));
    setAd(false);
    phaseRef.current = "end";
    setPhase("end");
    writeSaved(seasonId, n, null);
  }, [seasonId, n]);

  // While it runs: the face moves on, and at the end of the episode as the schedule has it, it ends.
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      const at = Date.now();
      if (clockAt(clockRef.current, at) >= runtimeRef.current) finish();
      else setNow(at);
    }, 250);
    return () => clearInterval(t);
  }, [running, finish]);

  const start = (m: Mode, at: number) => {
    setMode(m);
    setAd(false);
    const c = runClock({ at, since: null }, Date.now());
    setNow(Date.now());
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
  };

  const pause = () => {
    const t = Date.now();
    setNow(t);
    if (clock.since === null && !ad) setClock(runClock(clock, t));
    else {
      setAd(false);
      setClock(stopClock(clock, t));
    }
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

  return (
    <Layer className={paused || ad ? "nd-wa-paused" : ""}>
      <div className="flex items-start gap-2.5 pb-2 pl-4 pr-2.5 pt-3">
        <div className="min-w-0 flex-1">
          <b className="type-caption block truncate text-[18px]">
            {label} · Episode {n}
          </b>
          <small className="mt-[3px] block text-xs font-medium text-muted-foreground">
            {Math.round(runtimeMs / 60_000)} min{show.plays ? " · your games come with you" : ""}
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
        <span data-watch-clock={Math.floor(pos / 1000)} className={`type-num text-[64px] leading-[.85] tabular-nums transition-opacity ${paused || ad ? "opacity-35" : ""}`}>
          {runtimeText(pos)}
        </span>
        <span className="pb-1 text-[15px] text-muted-foreground">
          {ad ? "Ad break" : paused ? "Paused" : `of ${runtimeText(runtimeMs)}`}
        </span>
      </div>

      <div className="relative mx-4 mt-3 h-7" aria-hidden>
        <span className="absolute inset-x-0 top-3 h-1 rounded-sm bg-border" />
        <span className="absolute left-0 top-3 h-1 rounded-sm bg-foreground" style={{ width: pct(pos) }} />
        {pins
          .filter((p) => p <= pos)
          .map((p, i) => (
            <span key={`${p}-${i}`} data-pin className="absolute top-2 h-3 w-[3px] rounded-[1px] bg-chyron opacity-55" style={{ left: pct(p) }} />
          ))}
        <span className="absolute top-1 -ml-2.5 size-5 rounded-full bg-foreground shadow-[0_0_0_4px_rgba(244,242,248,.15)]" style={{ left: pct(pos) }} />
      </div>

      <p className="mx-4 mt-1.5 flex items-start gap-1.5 text-xs leading-snug text-muted-foreground">
        <Eye className="mt-px size-3.5 flex-none text-good" aria-hidden />
        <span>Comments and reactions arrive 30 s after the moment, never before it</span>
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
        <button type="button" data-watch-pause onClick={pause} className="nd-press flex h-[58px] flex-col items-center justify-center gap-0.5 rounded-[4px] bg-foreground text-base font-bold text-background">
          {paused || ad ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
          {paused || ad ? "Resume" : "Pause"}
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

      {phase === "start" && <StartPanel show={show} episode={n} saved={saved} onStart={start} onClose={close} />}
      {phase === "end" && <EndPanel show={show} episode={n} info={info} onBack={close} onKeepWatching={() => setPhase("on")} />}

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

function StartPanel({ show, episode: n, saved, onStart, onClose }: { show: ShowData; episode: number; saved: Saved | null; onStart: (m: Mode, at: number) => void; onClose: () => void }) {
  const header = show.header!;
  const card = useWatchCard(header.seasonId, show.couch?.id ?? null);
  const c = card.data?.episode === n ? card.data : null;
  const airAt = c?.airAt ? Date.parse(c.airAt) : null;
  const now = useNow(airAt != null);
  const soon = airAt != null && airAt > now;
  const resume = saved && saved.at > 5000 ? saved : null;
  const who = c?.people ?? [];
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
      {resume && (
        <Choice first data-start="resume" icon={Play} title={`Pick up at ${runtimeText(resume.at)}`} line="Where you left off" disabled={soon} onClick={() => onStart(resume.mode, resume.at)} />
      )}
      <Choice first={!resume} data-start="stream" icon={Zap} title="Streaming, no ads" line="The clock follows the episode" disabled={soon} onClick={() => onStart("stream", 0)} />
      <Choice data-start="live" icon={Tv} title="Live on TV" line="Tap Ad break when the ads start, so the clock waits" disabled={soon} onClick={() => onStart("live", 0)} />
      {soon && airAt != null && <p className="text-center text-[13px] font-semibold text-muted-foreground">Opens {airTime(airAt)}</p>}
      {!show.solo && c && c.status !== "soon" && (
        <div data-watch-left className="mt-1 flex items-center gap-2.5 text-[13px] text-white/80">
          {!!who.length && (
            <span className="flex">
              {who.slice(0, 4).map((p) => (
                <span key={p.userId} className="-mr-1.5 rounded-[3px] ring-2 ring-[#0b0a10]">
                  <Avatar id={p.userId} name={p.name} size={22} />
                </span>
              ))}
            </span>
          )}
          <span className={who.length ? "ml-1.5" : ""}>
            {leftLine(
              who.map((p) => p.name),
              c.count
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
