"use client";

import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import { inShowWords, showWords } from "@/lib/game/show-words";
import { lockTime } from "../clock";
import type { GameView, TableRow } from "../data";
import { ordinal } from "../games";
import { bestOf } from "../show/game-week";
import { Btn } from "../ui/parts";
import { inPath, MOMENT_NAMES, ON_PAGE, type MomentKind } from "./moments";

// TEMP, development only (docs/design-round/preview-story-spec.md, "Round 4"; docs/PLAN-game-preview.md, "The bench's previews"): a
// game's preview, made by the bench for any game it runs (tools/gameplay-bench/preview/preview.cjs), as a short story of the moments
// that game has, each the app's real screens in a phone. Every card carries its claim in the game's own terms and one line (the lock,
// the rule), at most one check counted over the made-up seasons, and the screens, opening on the game's own (its move, its draft
// room, how it plays) with a ring on what proves the claim; a screen whose words the season contradicts is tagged and named plainly
// ("App bug: …"). ?preview=<id> picks the preview (the page); ?card=1..n&screen=1..3 (or &tab=<screen id>)&full=1 open it somewhere; ?moment=<kind> opens
// that moment, or says the game hasn't one; ?embed=1 (the sheet) leaves out the story's own controls.

interface Box { x: number; y: number; w: number; h: number }
interface Bug { kind: string; text: string; boxes: Box[] }
// A screen is a shot (the bench's screenshot preview: `file`) or the app itself, live (an on-demand preview: `path` in its moment's copy,
// where to scroll to, and what the card's ring points at, found on the page: docs/PLAN-game-preview.md, "On demand").
interface Screen { id: string; name: string; file?: string; what?: string; url?: string; path?: string | null; focus?: string | null; ring?: RingSpec | null; tap?: string | null; proof: Box[]; bugs: Bug[]; strip?: { tone: string | null; title: string } }
interface Projection { game: GameView; questions?: { id: string; episode: number; closed: boolean; mine: unknown }[] }
interface Moment { id: string; kind: MomentKind; episode: number | null; game: string; airAt: string | null; shift: number; screens: Screen[]; views: Record<string, Projection> }
export interface Preview {
  id: string;
  game: { id: string; name: string; short: string; stages: { id: string; name: string }[] };
  viewer: string;
  people: { id: string; name: string; colour: string }[];
  first: number;
  last: number;
  moments: Moment[];
  seasons?: { seed: number; tables?: Record<string, TableRow[]>; error?: string }[];
  /** A live preview: every copy written, or stopped partway (its moments made so far stay). */
  complete?: boolean;
  /** A live preview's last card, on the app's host: back to the game's setup, or on to make it (the preview kept while they do). */
  exits?: { back: string; create: string } | null;
}

const WORDS = showWords(null);
const EP = WORDS.episode;
const SW = 390, SH = 844; // the shots: the phone's viewport, CSS px
const fmt = (n: number) => String(Math.round(n * 10) / 10);
const byTotal = (t: TableRow[]) => [...t].sort((a, b) => b.total - a.total);
const names = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}` : xs[0] ?? "");
const nameOf = (m: Moment) => (m.kind === "after" ? `After ${EP} ${m.episode}` : MOMENT_NAMES[m.kind]);
// Each moment's screens as the app's path (moments.ts PATH: where you meet it, what a tap opens, what it leads to), an app bug in its place.
const ordered = (m: Moment) => inPath(m.kind, m.screens);

// ---- What's typical, over the made-up seasons, with the game's own rules: each a plain sentence, the count first ----
interface Check { n: number; of: number; text: string; flag: boolean }
function typical(p: Preview) {
  const list = (p.seasons ?? []).filter((s) => s.tables).map((s) => s.tables!);
  const onEvery = (t: TableRow[] = []) => {
    const held = new Map<string, number>();
    for (const r of t) for (const id of new Set(r.team)) held.set(id, (held.get(id) ?? 0) + 1);
    return t.length > 1 && [...held.values()].some((v) => v === t.length);
  };
  const benchCost = (t: Record<string, TableRow[]>, pid: string) => Object.values(t).reduce((sum, rows) => sum + (rows.find((r) => r.playerId === pid)?.weeks ?? []).reduce((a, w) => a + (w.started?.length ? bestOf(w).cost : 0), 0), 0);
  const top = p.game.id, of = list.length;
  return {
    overlap: (gameId: string): Check | null => {
      if (!of || !list.some((t) => t[gameId]?.some((r) => r.team.length))) return null;
      const n = list.filter((t) => onEvery(t[gameId])).length;
      return { n, of, text: "put the same castaway on every team", flag: n * 2 > of };
    },
    lineups: (): Check | null => {
      if (!of) return null;
      const n = list.filter((t) => { const o = byTotal(t[top] ?? []); return o.length > 1 && o[1].total + benchCost(t, o[1].playerId) > o[0].total; }).length;
      return { n, of, text: "saw the runner-up’s best lineups beat the winner", flag: false };
    },
    close: (): Check | null => {
      if (!of) return null;
      const best = Math.max(...list.map((t) => byTotal(t[top] ?? [])[0]?.total ?? 0));
      // Small totals (a streak, a few right answers): a tie at the top is the close finish; big ones, 3 points or less.
      if (best < 20) {
        const n = list.filter((t) => { const o = byTotal(t[top] ?? []); return o.length > 1 && o[0].total === o[1].total; }).length;
        return { n, of, text: "ended level at the top", flag: false };
      }
      const n = list.filter((t) => { const o = byTotal(t[top] ?? []); return o.length > 1 && o[0].total - o[1].total <= 3; }).length;
      return { n, of, text: "were won by 3 points or less", flag: false };
    },
  };
}

// ---- Each moment's claim, in the game's own terms (its strip's words, its rules), and its one line ----
interface Card { title: string; line: string | null; check: Check | null }
function cardOf(p: Preview, m: Moment, t: ReturnType<typeof typical>): Card {
  const g = m.views[m.game]?.game, top = m.views[p.game.id]?.game;
  const at = m.airAt ? Date.parse(m.airAt) + (m.shift ?? 0) : null;
  const lock = at ? `Locks ${lockTime(at, at - 3600000)}, when ${EP} ${m.episode} airs` : null;
  const strip = m.screens.find((s) => s.strip?.title)?.strip?.title;
  switch (m.kind) {
    case "game":
      return { title: p.game.name, line: inShowWords(top?.short ?? p.game.short, WORDS), check: null };
    case "draft": {
      // Who starts it, as Tonight's strip says where you meet it (whoever runs the game starts it; everyone else waits for them),
      // so the headline never sits over "nobody can pick" unexplained (round 5's check).
      const at = m.screens.find((s) => s.id === "tonight")?.strip?.title ?? "";
      const by = /^Start the draft/.test(at) ? "You start it" : /^Waiting for (.+) to start the draft/.exec(at)?.[1] ? `${/^Waiting for (.+) to start the draft/.exec(at)![1]} starts it` : null;
      return { title: `Pick ${g?.you?.team.length ?? ""} in private`, line: by ? `${by}, then everyone picks, before ${EP} ${m.episode}` : `Before ${EP} ${m.episode}`, check: t.overlap(m.game) };
    }
    case "week": {
      const open = (m.views[m.game]?.questions ?? []).filter((q) => !q.closed && q.episode === m.episode).length;
      const title = g?.lineup
        ? `Start ${g.lineup.need} of your ${g.lineup.roster.length}`
        : g?.pick
          ? `${strip ?? "Pick"} each ${EP.toLowerCase()}`
          : `${strip ?? "Answer"}: ${open} question${open === 1 ? "" : "s"}`;
      return { title, line: lock, check: g?.lineup ? t.lineups() : null };
    }
    case "after": {
      const o = byTotal(g?.table ?? []), you = o.find((r) => r.you);
      if (!you) return { title: nameOf(m), line: null, check: null };
      const level = o.filter((r) => r.total === you.total && !r.you).map((r) => r.name), lead = o[0], second = o[1];
      const line = level.length ? `Level with ${names(level)}` : lead.you ? `${fmt(lead.total - (second?.total ?? 0))} ahead of ${second?.name}` : `${lead.name} leads by ${fmt(lead.total - you.total)}`;
      return { title: `You’re ${level.length ? "tied " : ""}${ordinal(you.place)} after ${EP} ${m.episode}`, line, check: null };
    }
    case "stage":
      return { title: `${g?.cast.filter((c) => !c.left).length ?? ""} left: draft ${g?.you?.team.length ?? ""} again`, line: `After ${EP} ${(m.episode ?? 1) - 1}`, check: t.overlap(m.game) };
    case "out":
      return { title: `You’re out after ${EP} ${m.episode}`, line: null, check: null };
    case "finale": {
      const o = byTotal(top?.table ?? []), w = o[0], margin = w && o[1] ? w.total - o[1].total : 0;
      const tie = o.filter((r) => w && r.total === w.total);
      const title = !w ? "The finale" : margin === 0 ? `${names(tie.map((r) => (r.you ? "You" : r.name)))} tie at the top` : `${w.you ? "You win" : `${w.name} wins`} by ${fmt(margin)}`;
      // How it's won, in the game's own rules (the line that says who wins, or how the points add up).
      const how = (top?.rules ?? []).find((r) => !r.includes("?") && /\bwins\b|add up/i.test(r)) ?? null;
      return { title, line: how ? how.replace(/^Overall, /, "").replace(/^\w/, (c) => c.toUpperCase()) : null, check: t.close() };
    }
  }
}

// ---- Parts ----
/** "App bug", a solid tag (the app's own dashes mean "not yet"). */
function BugTag({ small }: { small?: boolean }) {
  return <span className={`type-caption inline-flex flex-none items-center rounded-[2px] bg-foreground px-1.5 tracking-[0.04em] text-background ${small ? "h-[18px] text-[11px]" : "h-5 text-[13px]"}`}>App bug</span>;
}
/** "Typical": a tick for each made-up season, filled where it happened, and the sentence, its count first. */
function CheckLine({ c }: { c: Check }) {
  return (
    <div className="flex flex-col gap-1.5" data-ticks={`${c.n}/${c.of}`}>
      <div className="flex gap-[3px]" aria-hidden>
        {Array.from({ length: c.of }, (_, i) => (
          <span key={i} className="h-1.5 flex-1 rounded-[1px]" style={{ background: i < c.n ? "var(--foreground)" : "color-mix(in oklab, var(--foreground) 16%, transparent)" }} />
        ))}
      </div>
      <p className="text-[15px] leading-snug">
        {c.flag && <b className="font-semibold">Check: </b>}
        <b className="type-num font-semibold">
          {c.n} of {c.of}
        </b>{" "}
        <span className="text-muted-foreground">made-up seasons {c.text}</span>
      </p>
    </div>
  );
}
/** An app bug, said plainly: the screen's own words quoted, and what the season says instead. */
function BugLine({ bug }: { bug: Bug }) {
  return (
    <p className="flex items-start gap-2 text-[15px] leading-snug" data-bug={bug.kind}>
      <BugTag />
      <span className="min-w-0">{bug.text.replace(/^App bug: /, "").replace(/^\w/, (c) => c.toUpperCase())}</span>
    </p>
  );
}
/** A box on the shot, a few px out, held on the screen, as percentages of it. */
function place(b: Box, out = 3): CSSProperties {
  const x0 = Math.max(0, b.x - out), y0 = Math.max(0, b.y - out), x1 = Math.min(SW, b.x + b.w + out), y1 = Math.min(SH, b.y + b.h + out);
  return { left: `${(x0 / SW) * 100}%`, top: `${(y0 / SH) * 100}%`, width: `${((x1 - x0) / SW) * 100}%`, height: `${((y1 - y0) / SH) * 100}%` };
}
/** What the claim points at on the real screen (a ring), and where the app contradicts the season (a heavier ring, tagged). */
function Rings({ screen }: { screen: Screen }) {
  return (
    <>
      {screen.proof.map((b, i) => (
        <span key={`p${i}`} aria-hidden data-ring className="pointer-events-none absolute rounded-[5px] shadow-[0_0_0_2px_#f4f2f8,0_0_0_4px_rgba(11,10,16,.65)]" style={place(b)} />
      ))}
      {screen.bugs.flatMap((bug, j) =>
        bug.boxes.map((b, i) => (
          <span key={`d${j}-${i}`} aria-hidden data-ring-bug className="pointer-events-none absolute rounded-[5px] shadow-[0_0_0_3px_#f4f2f8,0_0_0_6px_rgba(11,10,16,.7)]" style={place(b)}>
            {!i && (
              <span className="absolute -top-[22px] left-0">
                <BugTag small />
              </span>
            )}
          </span>
        )),
      )}
    </>
  );
}
const src = (p: Preview, s: Screen) => `/start/preview-story/shot/${p.id}/${s.file}`;

/** What the card points at on a live screen: elements by a CSS selector (each its own box unless `union`), or the first whose own
 *  text matches a regular expression, inside `within`. */
export interface RingSpec {
  selector?: string;
  text?: string;
  within?: string;
  union?: boolean;
}
/** An on-demand preview (src/lib/server/preview-live.ts): its story runs on the preview host as the preview's own viewer, and
 *  each screen is the app itself on that same host, live. */
export interface LivePass { id: string; expires: number }
const Live = createContext<LivePass | null>(null);

/** The boxes a ring goes round, in the screen's own CSS pixels (the phone's 390 x 844), on a live page. */
function ringBoxes(doc: Document, spec: RingSpec, height: number): Box[] {
  const box = (e: Element) => {
    const r = e.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  };
  const seen = (b: Box) => b.w > 0 && b.h > 0 && b.y < height && b.y + b.h > 0;
  let list: Box[] = [];
  if (spec.selector) list = [...doc.querySelectorAll(spec.selector)].map(box).filter(seen);
  else if (spec.text) {
    // The most specific element whose own text matches: the one with the fewest elements inside it.
    const re = new RegExp(spec.text);
    // Inside the last of `within` that's on screen (a sheet open over the page is the last dialog; hidden ones stay in the page).
    const root = (spec.within ? [...doc.querySelectorAll(spec.within)].filter((e) => box(e).w > 0).at(-1) : null) ?? doc.body;
    const hits = [...root.querySelectorAll("*")].filter((e) => re.test((e.textContent ?? "").trim()) && box(e).w > 0);
    const hit = hits.sort((a, b) => a.querySelectorAll("*").length - b.querySelectorAll("*").length)[0];
    list = hit ? [box(hit)].filter(seen) : [];
  }
  if (!spec.union || list.length < 2) return list.slice(0, 2);
  const x0 = Math.min(...list.map((b) => b.x)), y0 = Math.min(...list.map((b) => b.y));
  return [{ x: x0, y: y0, w: Math.max(...list.map((b) => b.x + b.w)) - x0, h: Math.max(...list.map((b) => b.y + b.h)) - y0 }];
}

/** The app's own screen, live, at a phone's size (390 x 844 CSS px) scaled to the room it has. Same host as the story, so the story
 *  reads the page itself: it scrolls to the moment's focus and finds what the card's ring goes round as the page's data lands. It's
 *  the real app: it can be tapped. */
function LiveScreen({ screen, className = "" }: { screen: Screen; className?: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLSpanElement>(null);
  const [k, setK] = useState(0);
  const [rings, setRings] = useState<Box[]>([]);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setK(el.clientWidth / SW);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Find the moment's focus (scroll to it) and the ring's target on the page, as the page's data and pictures land: the screen shows
  // once they're there, and the ring follows the page as it settles. A step on the same page (Your team, under the game page) only
  // scrolls: the page isn't loaded again.
  const loaded = useRef<string | null>(null);
  const run = useRef(0);
  const look = useCallback(() => {
    const doc = frame.current?.contentDocument;
    if (!doc) return;
    const mine = ++run.current;
    let tries = 0, settled = 0, focused = !screen.focus, tapped = !screen.tap;
    const step = () => {
      if (mine !== run.current) return;
      tries++;
      // A screen that taps (Your move: the strip, as a player would): once the page is up, then what opens is the screen.
      if (!tapped && screen.tap) {
        const el = doc.querySelector<HTMLElement>(screen.tap);
        if (el) {
          el.click();
          tapped = true;
        }
      }
      if (!focused && screen.focus) {
        const el = doc.querySelector(screen.focus);
        if (el) {
          el.scrollIntoView({ block: "start" });
          frame.current?.contentWindow?.scrollBy(0, -16);
          focused = true;
        }
      }
      const found = screen.ring ? ringBoxes(doc, screen.ring, SH) : [];
      const ready = focused && tapped && (screen.ring ? found.length > 0 : !!doc.querySelector("main, [data-strip], [data-game-page]"));
      if (ready || tries > 20) {
        setRings(found);
        setShown(true);
        settled++;
      }
      if (settled < 6 && tries < 40) setTimeout(step, ready ? 500 : 350);
    };
    setTimeout(step, 250);
  }, [screen]);
  const which = `${screen.path}#${screen.tap ?? ""}`;
  useEffect(() => {
    if (loaded.current === which) return look();
    // A new page starts covered until it has painted what it's about.
    setShown(false);
    setRings([]);
  }, [which, look]);
  const onLoad = () => {
    const doc = frame.current?.contentDocument;
    if (!doc) return;
    loaded.current = which;
    // The dev server's own badge (development only) isn't part of the app's screen.
    const st = doc.createElement("style");
    st.textContent = "nextjs-portal{display:none!important}";
    doc.head?.appendChild(st);
    look();
  };
  return (
    <span ref={box} className={`relative block overflow-hidden ${className}`} data-live-screen={screen.id}>
      {k > 0 && (
        <iframe
          key={which}
          ref={frame}
          src={screen.path ?? undefined}
          onLoad={onLoad}
          title={`${screen.name}, the real app`}
          className="absolute left-0 top-0 border-0 bg-background"
          style={{ width: SW, height: SH, transform: `scale(${k})`, transformOrigin: "0 0" }}
        />
      )}
      {!shown && (
        <span aria-hidden className="absolute inset-0 grid place-items-center bg-card" data-live-loading>
          <span className="h-[3px] w-1/3 overflow-hidden rounded-full bg-secondary">
            <span className="block h-full w-1/2 animate-[nd-live-sweep_1.1s_ease-in-out_infinite] rounded-full bg-foreground/70 motion-reduce:animate-none" />
          </span>
        </span>
      )}
      {shown && rings.map((b, i) => <span key={i} aria-hidden data-ring className="pointer-events-none absolute rounded-[5px] shadow-[0_0_0_2px_#f4f2f8,0_0_0_4px_rgba(11,10,16,.65)]" style={place(b)} />)}
    </span>
  );
}
/** A live moment whose copy of the game is still being written (the maker writes the first at once, the rest while you look); or,
 *  once the preview is all made, one that couldn't be (a preview that failed partway keeps the moments it made). */
function Pending({ ended = false }: { ended?: boolean }) {
  return (
    <span className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card px-8 text-center" data-live-pending={ended ? "ended" : ""}>
      {!ended && (
        <span className="h-[3px] w-1/3 overflow-hidden rounded-full bg-secondary" aria-hidden>
          <span className="block h-full w-1/2 animate-[nd-live-sweep_1.1s_ease-in-out_infinite] rounded-full bg-foreground/70 motion-reduce:animate-none" />
        </span>
      )}
      <span className="text-[13px] leading-snug text-muted-foreground">{ended ? "This moment couldn’t be made" : "Getting this moment ready"}</span>
    </span>
  );
}

/** The real screen in a phone, whole: a bezel with a status bar that says what this is, sized to the room the card leaves. */
function Phone({ p, screen, onOpen }: { p: Preview; screen: Screen | undefined; onOpen: () => void }) {
  const live = useContext(Live);
  const size = { "--sw": "min(calc((100cqh - 26px) * 390 / 844), calc(100cqw - 12px))", width: "calc(var(--sw) + 12px)", height: "calc(var(--sw) * 844 / 390 + 26px)" } as CSSProperties;
  if (!screen)
    return (
      <div style={size} className="grid place-items-center rounded-[30px] bg-card px-6 text-center text-[15px] text-muted-foreground outline-1 -outline-offset-1 outline-input">
        No screen for this moment
      </div>
    );
  // Live: the real app in the bezel, tappable (so the phone isn't a button: Full size is beside the steps); a moment whose copy is
  // still being written says so, and fills in when it lands.
  if (live)
    return (
      <div data-phone={screen.id} data-live style={size} className="flex flex-none flex-col rounded-[30px] bg-[#0b0a10] px-[6px] pb-[6px] outline-1 -outline-offset-1 outline-[color-mix(in_oklab,var(--foreground)_32%,transparent)]">
        <span className="type-caption flex h-5 flex-none items-center justify-center text-[11px] tracking-[0.14em] text-[#a9a4b8]">Made-up season · live</span>
        <span className="relative block overflow-hidden rounded-[24px]" style={{ width: "var(--sw)", height: "calc(var(--sw) * 844 / 390)" }}>
          {screen.path ? <LiveScreen screen={screen} className="size-full" /> : <Pending ended={!!p.complete} />}
        </span>
      </div>
    );
  return (
    <button type="button" onClick={onOpen} data-phone={screen.file} aria-label={`${screen.name}, the real screen: open it at full size`} style={size} className="nd-press flex flex-none flex-col rounded-[30px] bg-[#0b0a10] px-[6px] pb-[6px] outline-1 -outline-offset-1 outline-[color-mix(in_oklab,var(--foreground)_32%,transparent)]">
      <span className="type-caption flex h-5 flex-none items-center justify-center text-[11px] tracking-[0.14em] text-[#a9a4b8]">Made-up season</span>
      <span className="relative block overflow-hidden rounded-[24px]" style={{ width: "var(--sw)", height: "calc(var(--sw) * 844 / 390)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a dev-only shot of the app's own screen */}
        <img src={src(p, screen)} alt={screen.what} draggable={false} className="absolute inset-0 size-full bg-card object-cover" />
        <Rings screen={screen} />
      </span>
    </button>
  );
}
/** A real screen at full size, whole, as the app shows it on a phone; what this is and the way back on a bar of their own. */
function FullScreen({ p, screen, onClose }: { p: Preview; screen: Screen; onClose: () => void }) {
  const live = useContext(Live);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  const fit = { "--fw": "min(100cqw, calc(100cqh * 390 / 844))", width: "var(--fw)", height: "calc(var(--fw) * 844 / 390)" } as CSSProperties;
  return (
    <div role="dialog" aria-modal aria-label={`${screen.name}, at full size`} className="fixed inset-0 z-[60] flex flex-col bg-[#0b0a10] pt-[env(safe-area-inset-top,0px)]" data-full-screen>
      <div className="flex min-h-0 flex-1 items-start justify-center [container-type:size]">
        <div className="relative" style={fit}>
          {live ? (
            screen.path ? <LiveScreen screen={screen} className="size-full" /> : <Pending ended={!!p.complete} />
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- a dev-only shot of the app's own screen */}
              <img src={src(p, screen)} alt={screen.what} className="absolute inset-0 size-full" />
              <Rings screen={screen} />
            </>
          )}
        </div>
      </div>
      <div className="flex flex-none items-center gap-3 border-t border-[rgba(244,242,248,.14)] px-4 pt-2 pb-[max(10px,env(safe-area-inset-bottom,0px))] text-[#f4f2f8]">
        <span className="type-caption flex-none text-[13px] tracking-[0.06em]">Made-up season</span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-[#a9a4b8]">{screen.name}, the real screen</span>
        <button type="button" onClick={onClose} className="nd-press inline-flex h-11 flex-none items-center gap-1.5 rounded-[3px] bg-[#f4f2f8] pl-3 pr-4 text-[15px] font-bold text-[#16141d]" autoFocus>
          <X className="size-5" aria-hidden />
          Back
        </button>
      </div>
    </div>
  );
}

// ---- The story ----
export function PreviewStory({ preview: p, live = null }: { preview: Preview; live?: LivePass | null }) {
  return (
    <Live.Provider value={live}>
      <Story p={p} />
    </Live.Provider>
  );
}

function Story({ p }: { p: Preview }) {
  const live = useContext(Live);
  // A live preview's last card: kept while they make the game (decision 6), then to the app's host. Not live (the screenshot
  // stories, the sheet), the buttons stay as the mock has them.
  const leave = (where: "back" | "create") => {
    const to = p.exits?.[where];
    if (!live || !to) return;
    void fetch(`/api/preview-live/${live.id}/keep`, { method: "POST" })
      .catch(() => {})
      .finally(() => window.location.assign(to));
  };
  const [k, setK] = useState(0);
  const [screen, setScreen] = useState<number | null>(null);
  const [tab, setTab] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const [moved, setMoved] = useState(false);
  const [embed, setEmbed] = useState(false);
  const [missing, setMissing] = useState<string | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the frames' and the sheet's entry (?card=, ?moment=, ?screen=, ?full=, ?embed=), read once
    if (q.get("card")) setK(Math.max(0, Math.min(p.moments.length - 1, Number(q.get("card")) - 1)));
    const want = q.get("moment");
    if (want) {
      const i = p.moments.findIndex((m) => m.kind === want);
      if (i >= 0) setK(i);
      else setMissing(MOMENT_NAMES[want as MomentKind] ?? want);
    }
    if (q.get("screen")) setScreen(Math.max(0, Number(q.get("screen")) - 1));
    if (q.get("tab")) setTab(q.get("tab"));
    if (q.get("full") === "1") setFull(true);
    if (q.get("embed") === "1") setEmbed(true);
  }, [p.moments]);
  const t = useMemo(() => typical(p), [p]);
  const m = p.moments[k];
  const card = useMemo(() => cardOf(p, m, t), [p, m, t]);
  const screens = useMemo(() => ordered(m), [m]);
  const at = (tab ? screens.find((x) => x.id === tab) : undefined) ?? screens[Math.min(screen ?? 0, Math.max(0, screens.length - 1))];
  const bug = at?.bugs[0];
  const last = k === p.moments.length - 1;
  const go = (n: number) => {
    setK(Math.max(0, Math.min(p.moments.length - 1, n)));
    setScreen(null);
    setTab(null);
    setMoved(true);
  };
  if (missing)
    return (
      <div className="fixed inset-0 grid place-items-center bg-background px-8 text-center text-foreground" data-preview-story data-missing>
        <p className="flex flex-col gap-2">
          <span className="type-caption text-[26px] leading-[0.92]">No {missing.replace(/^The /, "").toLowerCase()}</span>
          <span className="text-[15px] text-muted-foreground">{p.game.name} hasn’t one: its story goes straight on.</span>
        </p>
      </div>
    );
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground" data-preview-story data-card={k + 1} data-moment={m.kind}>
      {/* The one authored moment: as you move on, the next phone rises in (already mostly visible); none on first paint or under reduced motion. */}
      <style>{`.nd-story-in{animation:nd-story-in .3s cubic-bezier(.16,1,.3,1) both}@keyframes nd-story-in{from{opacity:.45;transform:translateY(14px)}}@media (prefers-reduced-motion:reduce){.nd-story-in{animation:none}}@keyframes nd-live-sweep{from{transform:translateX(-100%)}to{transform:translateX(200%)}}`}</style>
      <div className="mx-auto flex w-full max-w-[430px] flex-1 flex-col overflow-hidden pt-[env(safe-area-inset-top,0px)]">
        {/* Where you are: each moment a segment, a tap away. Live (the flow spec's §3), a moment still being made is hollow, an outline
            that breathes (still under reduced motion: never a part-filled bar, which reads as half watched); one that never came is
            split in two, dim (not dashes: the app's dashes mean a week still to come). Next still goes to either, and its phone says. */}
        <style>{`@keyframes nd-coming{50%{opacity:.35}}`}</style>
        <nav aria-label="The moments" className="flex gap-1 px-4 pt-1">
          {p.moments.map((x, i) => {
            const state = !live || x.screens.some((s) => s.path) ? "ready" : p.complete ? "never" : "coming";
            const on = i <= k ? "var(--foreground)" : "color-mix(in oklab, var(--foreground) 18%, transparent)";
            const dim = "color-mix(in oklab, var(--foreground) 18%, transparent)";
            return (
              <button key={x.id} type="button" onClick={() => go(i)} aria-label={`${nameOf(x)}${state === "coming" ? ", being made" : state === "never" ? ", couldn't be made" : ""}`} aria-current={i === k ? "step" : undefined} className="group flex h-5 flex-1 items-center" data-progress={x.kind} data-progress-state={state}>
                {state === "ready" ? (
                  <span className="h-1 w-full rounded-full" style={{ background: on }} />
                ) : state === "coming" ? (
                  <span className="h-[6px] w-full animate-[nd-coming_1.6s_ease-in-out_infinite] rounded-full motion-reduce:animate-none" style={{ boxShadow: `inset 0 0 0 1px color-mix(in oklab, var(--foreground) ${i === k ? 70 : 45}%, transparent)` }} />
                ) : (
                  <span className="flex h-1 w-full gap-1.5">
                    <span className="h-full flex-1 rounded-full" style={{ background: dim }} />
                    <span className="h-full flex-1 rounded-full" style={{ background: dim }} />
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="flex h-11 items-center gap-3 px-4">
          <span className="type-caption inline-flex h-7 flex-none items-center bg-secondary pl-2.5 pr-5 text-[15px] tracking-[0.04em] [clip-path:polygon(0_0,100%_0,calc(100%-9px)_100%,0_100%)]">Made-up season</span>
          <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground" data-moment-name>
            {nameOf(m)}
          </span>
          {!embed && (
            <button type="button" aria-label="Close" onClick={() => history.length > 1 && history.back()} className="nd-press -mr-2 grid size-11 place-items-center">
              <X className="size-6" />
            </button>
          )}
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-1" key={k} data-card-body>
          {/* The claim and its one line, then one slot: a fixed height, so the phone stays put from card to card. */}
          <div className="flex h-[148px] flex-none flex-col gap-2.5 overflow-hidden" data-claim-block>
            <div className="flex flex-col gap-1">
              <h1 className="type-caption line-clamp-2 text-[26px] leading-[0.95] [text-wrap:balance]" data-claim>
                {card.title}
              </h1>
              {card.line && (
                <p className="line-clamp-2 text-[15px] leading-snug text-muted-foreground" data-line>
                  {card.line}
                </p>
              )}
            </div>
            {bug ? <BugLine bug={bug} /> : card.check ? <CheckLine c={card.check} /> : null}
          </div>
          {/* The moment's real screens as the app's path, by its own names, its chevron between them: where you meet it first. One with
              an app bug keeps its place, tagged. */}
          <div className="flex items-end gap-2 border-b border-border">
            <div role="tablist" aria-label="The real screens at this moment, in the order the app takes you" className="flex min-w-0 flex-1 items-center gap-1 pb-2" data-path>
              {screens.map((s, i) => (
                <Fragment key={s.id}>
                  {/* A tap leads on (the app's chevron); a step further down the same page doesn't. */}
                  {i > 0 && (ON_PAGE.has(s.id) ? <span aria-hidden className="px-0.5 text-muted-foreground">·</span> : <ChevronRight className="size-4 flex-none text-muted-foreground" aria-hidden />)}
                  <button
                    type="button"
                    role="tab"
                    aria-selected={s === at}
                    data-screen={s.id}
                    onClick={() => { setTab(null); setScreen(i); }}
                    className={`nd-press type-caption flex h-9 min-w-0 flex-none items-center gap-1.5 rounded-[3px] px-2 text-[15px] tracking-[0.04em] ${s === at ? "bg-foreground text-background" : "text-muted-foreground"}`}
                  >
                    {s.name}
                    {s.bugs.length > 0 && <span className="rounded-[2px] border border-current px-1 text-[11px] leading-[15px]">Bug</span>}
                  </button>
                </Fragment>
              ))}
            </div>
            {at && (
              <button type="button" onClick={() => setFull(true)} data-full aria-label={`${at.name} at full size`} className="nd-press -mb-px -mr-2 inline-flex h-11 flex-none items-center gap-1.5 px-2 text-[13px] font-semibold text-muted-foreground">
                <Maximize2 className="size-4" aria-hidden />
                {screens.length < 3 && "Full size"}
              </button>
            )}
          </div>
          <div className={`flex min-h-0 flex-1 justify-center pb-1 [container-type:size] ${moved ? "nd-story-in" : ""}`}>
            <Phone p={p} screen={at} onOpen={() => setFull(true)} />
          </div>
        </div>
        {!embed && (
          <div className="flex items-center gap-2 px-4 pb-[max(16px,env(safe-area-inset-bottom,0px))] pt-3">
            {last ? (
              <>
                {/* Go back: to the game's setup; Create this game: on to make it. Live, either keeps the preview while they do
                    (decision 6) and goes to the app's host; the gallery's places come with step 15 (the mock's aren't wired). */}
                <Btn tone="optional" className="flex-1" data-go-back onClick={() => leave("back")}>
                  Go back
                </Btn>
                <Btn tone="must" className="flex-[1.4]" data-create onClick={() => leave("create")}>
                  Create this game
                </Btn>
              </>
            ) : (
              <>
                {k > 0 && (
                  <Btn tone="optional" onClick={() => go(k - 1)} aria-label="Back" className="w-[52px] flex-none px-0">
                    <ChevronLeft className="size-5" aria-hidden />
                  </Btn>
                )}
                <Btn tone="ink" onClick={() => go(k + 1)} className="flex-1" data-next>
                  {nameOf(p.moments[k + 1])}
                </Btn>
              </>
            )}
          </div>
        )}
      </div>
      {full && at && <FullScreen p={p} screen={at} onClose={() => setFull(false)} />}
    </div>
  );
}
