"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronLeft, Maximize2, Shuffle, X } from "lucide-react";
import { pageModel } from "@/lib/game/game-page/model";
import { inShowWords, showWords } from "@/lib/game/show-words";
import { lockTime } from "../clock";
import type { GameView, TableRow } from "../data";
import { ordinal } from "../games";
import { bestOf } from "../show/game-week";
import { Btn } from "../ui/parts";

// TEMP mock (docs/design-round/preview-story-spec.md; docs/PLAN-game-preview.md, decisions 3 to 6): a game's preview as a short story
// of the moments of a made-up season, each shown as the app's real screens in a phone ("a 1:1 view from preview to game", the user).
// The season is played on the real screens by scripts/dev-test/preview-story-shots.js (the draft in the real draft room, a lineup on
// Your moves, the reveal), each moment's screens shot as the first seat at 390, with where the thing that proves the card's line sits
// on them, and anything a screen says that the season contradicts. The cards' lines and checks read the production views of that
// same run; what's typical is counted over many more made-up seasons with the game's own rules (bestOf). The screens are never
// retouched: a ring points into one, a dashed ring marks where the app differs.
// ?card=1..6&season=1..3&fix=1&screen=1..3&full=1 open it somewhere (for the story's frames).

type Views = Record<string, GameView>;
interface Box { x: number; y: number; w: number; h: number }
interface Shot { file: string; what: string; url: string; proof?: Box[]; differs?: { text: string; boxes: Box[] } | null }
interface Played { seed: number; game: string; stages: string[]; at: Record<string, Views>; shots?: Record<string, Shot> }
interface Tables { seed: number; as: Record<string, TableRow[]>; fix: Record<string, TableRow[]> }
export interface StoryData {
  show: { name: string; season: number; last: number };
  fix: { each: number; start: number };
  samples: { as: Played; fix: Played }[];
  seasons: Tables[];
}

const WORDS = showWords(null);
const EP = WORDS.episode;
const SW = 390, SH = 844; // the shots: the phone's viewport, CSS px
const fmt = (n: number) => String(Math.round(n * 10) / 10);
const byTotal = (t: TableRow[]) => [...t].sort((a, b) => b.total - a.total);
const stageWord = (name: string) => name.split(" · ").at(-1) ?? name;

/** One season as the cards read it: its views at the moments the screens were shot, and the few things worked out across them. */
function seasonOf(p: Played) {
  const end = p.at[String(Math.max(...Object.keys(p.at).filter((k) => k !== "start").map(Number)))];
  const start = p.at.start, game = end[p.game];
  const [s1, s2] = p.stages.map((id) => end[id]);
  const drafted = (id: string) => Object.values(p.at).map((v) => v[id]).find((v) => v?.you && v.you.team.length > 0) ?? end[id];
  // The game's own page model at the start: its name, as its page says it.
  const model = pageModel(start[p.game], start[p.game].page, {
    show: "Survivor",
    words: WORDS,
    next: null,
    when: (iso) => lockTime(Date.parse(iso)),
    move: null,
    line: inShowWords(start[p.game].short, WORDS),
    seen: null,
    roles: null,
    twist: null,
    stageGames: p.stages.map((id) => ({ leagueId: start[id].leagueId, name: start[id].name, over: false, airsAt: null })),
  });
  const order = byTotal(game.table);
  const mid = p.at["10"]?.[p.game];
  return {
    model,
    first: { name: stageWord(s1.name), from: s1.from ?? 0, each: drafted(p.stages[0]).you?.team.length ?? 0, start: s1.you?.weeks[0]?.started.length ?? 0 },
    merge: { name: stageWord(s2.name), from: s2.from ?? 0, each: drafted(p.stages[1]).you?.team.length ?? 0, left: drafted(p.stages[1]).cast.filter((c) => !c.left).length },
    mid: mid?.you ? { place: mid.you.place, tied: mid.table.filter((r) => r.total === mid.you!.total).length > 1 } : null,
    winner: order[0],
    margin: order[0].total - order[1].total,
    shots: p.shots ?? {},
  };
}
type Season = ReturnType<typeof seasonOf>;

/** What's typical over the many made-up seasons, counted from each one's end standings with the game's own rules. */
function typicalOf(d: StoryData, fix: boolean) {
  const { game, stages } = d.samples[0].as;
  const list = d.seasons.map((s) => (fix ? s.fix : s.as));
  const benchCost = (t: Record<string, TableRow[]>, pid: string) => stages.reduce((sum, st) => sum + (t[st].find((r) => r.playerId === pid)?.weeks ?? []).reduce((a, w) => a + bestOf(w).cost, 0), 0);
  const onEvery = (t: TableRow[]) => {
    const held = new Map<string, number>();
    for (const r of t) for (const id of new Set(r.team)) held.set(id, (held.get(id) ?? 0) + 1);
    return [...held.values()].some((v) => v === t.length);
  };
  return {
    seasons: list.length,
    draftAll: list.filter((t) => onEvery(t[stages[0]])).length,
    mergeAll: list.filter((t) => onEvery(t[stages.at(-1)!])).length,
    close: list.filter((t) => { const o = byTotal(t[game]); return o[0].total - o[1].total <= 3; }).length,
    // Second place, with the best lineup from their own team every week (everyone else as played), would have won.
    benchDecides: list.filter((t) => { const o = byTotal(t[game]); return o[1].total + benchCost(t, o[1].playerId) > o[0].total; }).length,
  };
}
type Typical = ReturnType<typeof typicalOf>;

// ---- The moments: each one's real screens (by the app's own names), its line, and its check ----
const SCREENS: Record<string, string> = {
  games: "Games",
  "tonight-draft": "Tonight",
  "draft-picked": "Draft room",
  "draft-revealed": "The teams",
  "tonight-9": "Tonight",
  "moves-9": "Your moves",
  "stage-10": "Game page",
  "tonight-10": "Tonight",
  "merge-revealed": "The teams",
  "tonight-merge": "Tonight",
  "merge-picked": "Draft room",
  final: "Game page",
  "reveal-table": "Reveal",
};
interface Check { n: number; label: string; flag: boolean }
interface Moment { name: string; screens: string[]; line: (x: Season) => string; check?: (t: Typical) => Check }
const MOMENTS: Moment[] = [
  { name: "Your games", screens: ["games", "tonight-draft"], line: () => "The draft comes first" },
  { name: "The draft", screens: ["draft-picked", "draft-revealed"], line: (x) => `Pick ${x.first.each} in private`, check: (t) => ({ n: t.draftAll, label: "Same castaway on every team", flag: t.draftAll * 2 > t.seasons }) },
  { name: "Each episode", screens: ["tonight-9", "moves-9"], line: (x) => `Start ${x.first.start} of your ${x.first.each}, every ${EP.toLowerCase()}`, check: (t) => ({ n: t.benchDecides, label: "2nd’s best lineups would have won", flag: false }) },
  { name: `After ${EP} 10`, screens: ["stage-10", "tonight-10"], line: (x) => (x.mid ? `You’re ${x.mid.tied ? "tied " : ""}${ordinal(x.mid.place)} after ${EP} 10` : `After ${EP} 10`) },
  { name: "The merge", screens: ["merge-revealed", "tonight-merge", "merge-picked"], line: (x) => `${x.merge.left} left: draft ${x.merge.each} again`, check: (t) => ({ n: t.mergeAll, label: "Same castaway on every team", flag: t.mergeAll * 2 > t.seasons }) },
  { name: "The finale", screens: ["final", "reveal-table"], line: (x) => `${x.winner.you ? "You win" : `${x.winner.name} wins`} by ${fmt(x.margin)}`, check: (t) => ({ n: t.close, label: "A close finish, 3 or less", flag: false }) },
];

// ---- Parts ----
function Tag({ children }: { children: ReactNode }) {
  return <span className="type-caption inline-flex h-6 flex-none items-center bg-foreground pl-2 pr-4 text-[13px] tracking-[0.04em] text-background [clip-path:polygon(0_0,100%_0,calc(100%-8px)_100%,0_100%)]">{children}</span>;
}
/** "Typical": a tick for each made-up season, filled where it happened; a flag carries Check. */
function Ticks({ c, of }: { c: Check; of: number }) {
  return (
    <div className="flex flex-col gap-1.5" data-ticks={`${c.n}/${of}`}>
      <div className="flex items-center gap-2">
        {c.flag && <Tag>Check</Tag>}
        <span className="type-caption min-w-0 flex-1 truncate text-[15px] tracking-[0.04em] text-muted-foreground">{c.label}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 gap-[3px]" aria-hidden>
          {Array.from({ length: of }, (_, i) => (
            <span key={i} className="h-2 flex-1 rounded-[1px]" style={{ background: i < c.n ? "var(--foreground)" : "color-mix(in oklab, var(--foreground) 16%, transparent)" }} />
          ))}
        </div>
        <span className="flex-none text-[13px] text-muted-foreground">
          <b className="type-num text-[18px] text-foreground">{c.n}</b> of {of} made-up seasons
        </span>
      </div>
    </div>
  );
}
const src = (s: Shot) => `/start/preview-story/shot/${s.file}`;
/** A box on the shot, a few px out, held on the screen, as percentages of it. */
function place(b: Box, out = 3): CSSProperties {
  const x0 = Math.max(0, b.x - out), y0 = Math.max(0, b.y - out), x1 = Math.min(SW, b.x + b.w + out), y1 = Math.min(SH, b.y + b.h + out);
  return { left: `${(x0 / SW) * 100}%`, top: `${(y0 / SH) * 100}%`, width: `${((x1 - x0) / SW) * 100}%`, height: `${((y1 - y0) / SH) * 100}%` };
}
/** What the line points at on the real screen (a ring), and where the app differs from the season (a dashed ring). */
function Rings({ shot }: { shot: Shot }) {
  return (
    <>
      {(shot.proof ?? []).map((b, i) => (
        <span key={`p${i}`} aria-hidden data-ring className="pointer-events-none absolute rounded-[5px] shadow-[0_0_0_2px_#f4f2f8,0_0_0_4px_rgba(11,10,16,.65)]" style={place(b)} />
      ))}
      {(shot.differs?.boxes ?? []).map((b, i) => (
        <span key={`d${i}`} aria-hidden data-ring-differs className="pointer-events-none absolute rounded-[5px] border-2 border-dashed border-[#f4f2f8] shadow-[0_0_0_2px_rgba(11,10,16,.65)]" style={place(b)} />
      ))}
    </>
  );
}
/** The real screen in a phone, whole: a bezel with a status bar that says what this is, around the shot as the phone shows it, sized
 *  to the room the card leaves (its container's size); a tap opens it at full size. */
function Phone({ shot, name, onOpen }: { shot: Shot | undefined; name: string; onOpen: () => void }) {
  // The screen's width: as tall as the room allows (less the status bar and bezel), never wider than the room.
  const size = { "--sw": "min(calc((100cqh - 26px) * 390 / 844), calc(100cqw - 12px))", width: "calc(var(--sw) + 12px)", height: "calc(var(--sw) * 844 / 390 + 26px)" } as CSSProperties;
  if (!shot)
    return (
      <div style={size} className="grid place-items-center rounded-[30px] bg-card px-6 text-center text-[15px] text-muted-foreground outline-1 -outline-offset-1 outline-input">
        No screen shot for this season yet
      </div>
    );
  return (
    <button type="button" onClick={onOpen} data-phone={shot.file} aria-label={`${name}, the real screen: open it at full size`} style={size} className="nd-press flex flex-none flex-col rounded-[30px] bg-[#0b0a10] px-[6px] pb-[6px] outline-1 -outline-offset-1 outline-[color-mix(in_oklab,var(--foreground)_32%,transparent)]">
      <span className="type-caption flex h-5 flex-none items-center justify-center text-[10px] tracking-[0.16em] text-[#a9a4b8]">Made-up season</span>
      <span className="relative block overflow-hidden rounded-[24px]" style={{ width: "var(--sw)", height: "calc(var(--sw) * 844 / 390)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a dev-only shot of the app's own screen */}
        <img src={src(shot)} alt={shot.what} draggable={false} className="absolute inset-0 size-full bg-card object-cover" />
        <Rings shot={shot} />
      </span>
    </button>
  );
}
/** A real screen at full size, whole, as the app shows it on a phone; what this is and the way back on a bar of their own. */
function FullScreen({ shot, name, onClose }: { shot: Shot; name: string; onClose: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  const fit = { "--fw": "min(100cqw, calc(100cqh * 390 / 844))", width: "var(--fw)", height: "calc(var(--fw) * 844 / 390)" } as CSSProperties;
  return (
    <div role="dialog" aria-modal aria-label={`${name}, at full size`} className="fixed inset-0 z-[60] flex flex-col bg-[#0b0a10] pt-[env(safe-area-inset-top,0px)]" data-full-screen>
      <div className="flex min-h-0 flex-1 items-start justify-center [container-type:size]">
        <div className="relative" style={fit}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a dev-only shot of the app's own screen */}
          <img src={src(shot)} alt={shot.what} className="absolute inset-0 size-full" />
          <Rings shot={shot} />
        </div>
      </div>
      <div className="flex flex-none items-center gap-3 border-t border-[rgba(244,242,248,.14)] px-4 pt-2 pb-[max(10px,env(safe-area-inset-bottom,0px))] text-[#f4f2f8]">
        <span className="type-caption flex-none text-[13px] tracking-[0.06em]">Made-up season</span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-[#a9a4b8]">{name}, the real screen</span>
        <button type="button" onClick={onClose} className="nd-press inline-flex h-11 flex-none items-center gap-1.5 rounded-[3px] bg-[#f4f2f8] pl-3 pr-4 text-[15px] font-bold text-[#16141d]" autoFocus>
          <X className="size-5" aria-hidden />
          Back
        </button>
      </div>
    </div>
  );
}

// ---- The story ----
export function PreviewStory({ data }: { data: StoryData }) {
  const [k, setK] = useState(0);
  const [which, setWhich] = useState(0);
  const [fix, setFix] = useState(false);
  const [screen, setScreen] = useState<number | null>(null);
  const [full, setFull] = useState(false);
  const [moved, setMoved] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the frames' entry (?card=, ?season=, ?fix=, ?screen=, ?full=) read once
    if (q.get("card")) setK(Math.max(0, Math.min(MOMENTS.length - 1, Number(q.get("card")) - 1)));
    if (q.get("season")) setWhich(Math.max(0, Math.min(data.samples.length - 1, Number(q.get("season")) - 1)));
    if (q.get("fix") === "1") setFix(true);
    if (q.get("screen")) setScreen(Math.max(0, Number(q.get("screen")) - 1));
    if (q.get("full") === "1") setFull(true);
  }, [data.samples.length]);
  const sample = data.samples[which];
  const asSet = useMemo(() => seasonOf(sample.as), [sample]);
  const x = useMemo(() => (fix ? seasonOf(sample.fix) : asSet), [fix, sample, asSet]);
  const t = useMemo(() => typicalOf(data, fix), [data, fix]);
  const m = MOMENTS[k];
  const screens = m.screens.filter((id) => x.shots[id]);
  // The line is the claim and the screen it opens on its proof: the first whose screen doesn't differ from the season.
  const opens = Math.max(0, screens.findIndex((id) => !x.shots[id].differs));
  const at = screens[Math.min(screen ?? opens, Math.max(0, screens.length - 1))];
  const shot = at ? x.shots[at] : undefined;
  const check = m.check?.(t);
  const last = k === MOMENTS.length - 1;
  const merge = k === 4;
  const go = (n: number) => {
    setK(Math.max(0, Math.min(MOMENTS.length - 1, n)));
    setScreen(null);
    setMoved(true);
  };
  const back = k > 0 && (
    <Btn tone="optional" onClick={() => go(k - 1)} aria-label="Back" className="w-[52px] flex-none px-0">
      <ChevronLeft className="size-5" aria-hidden />
    </Btn>
  );
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground" data-preview-story data-card={k + 1}>
      {/* The one authored moment: as you move on, the next phone rises in (already mostly visible); none on first paint or under reduced motion. */}
      <style>{`.nd-story-in{animation:nd-story-in .3s cubic-bezier(.16,1,.3,1) both}@keyframes nd-story-in{from{opacity:.45;transform:translateY(14px)}}@media (prefers-reduced-motion:reduce){.nd-story-in{animation:none}}`}</style>
      <div className="mx-auto flex w-full max-w-[430px] flex-1 flex-col overflow-hidden pt-[env(safe-area-inset-top,0px)]">
        <div className="flex gap-1 px-4 pt-3" aria-hidden>
          {MOMENTS.map((c, i) => (
            <span key={c.name} className="h-1 flex-1 rounded-full" style={{ background: i <= k ? "var(--foreground)" : "color-mix(in oklab, var(--foreground) 18%, transparent)" }} />
          ))}
        </div>
        <div className="flex h-11 items-center gap-3 px-4">
          <span className="type-caption inline-flex h-7 flex-none items-center bg-secondary pl-2.5 pr-5 text-[15px] tracking-[0.04em] [clip-path:polygon(0_0,100%_0,calc(100%-9px)_100%,0_100%)]">Made-up season</span>
          <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground" data-moment>
            {fix && <b className="font-semibold text-foreground">Trying {data.fix.each} each · </b>}
            {m.name}
          </span>
          <button type="button" aria-label="Close" className="nd-press -mr-2 grid size-11 place-items-center">
            <X className="size-6" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-1" key={`${k}-${which}-${fix}`} data-card-body>
          <h1 className="type-caption text-[28px] leading-[0.92] [text-wrap:balance]" data-line>
            {m.line(x)}
          </h1>
          {check && <Ticks c={check} of={t.seasons} />}
          {/* The moment's real screens, by the app's own names; one that differs from the season is marked. */}
          <div className="flex items-end gap-2 border-b border-border">
            <div role="tablist" aria-label="The real screens at this moment" className="flex min-w-0 flex-1 gap-4">
              {screens.map((id, i) => (
                <button key={id} type="button" role="tab" aria-selected={id === at} data-screen={id} onClick={() => setScreen(i)} className={`nd-press type-caption -mb-px flex h-11 flex-none items-center gap-1.5 border-b-2 text-[15px] tracking-[0.04em] ${id === at ? "border-foreground text-foreground" : "border-transparent text-muted-foreground"}`}>
                  {SCREENS[id]}
                  {x.shots[id].differs && <i aria-label="the app differs here" className="block size-2 rounded-full border-[1.5px] border-dashed border-current" />}
                </button>
              ))}
            </div>
            {shot && (
              <button type="button" onClick={() => setFull(true)} data-full aria-label={`${SCREENS[at!]} at full size`} className="nd-press -mb-px -mr-2 inline-flex h-11 flex-none items-center gap-1.5 px-2 text-[13px] font-semibold text-muted-foreground">
                <Maximize2 className="size-4" aria-hidden />
                {screens.length < 3 && "Full size"}
              </button>
            )}
          </div>
          {shot?.differs && (
            <p className="-mt-1 flex items-start gap-2 text-[13px] leading-snug" data-differs>
              <span className="type-caption flex-none rounded-[2px] border border-dashed border-foreground px-1.5 text-[12px] leading-[18px] tracking-[0.04em]">App differs</span>
              <span className="min-w-0 pt-px">{shot.differs.text}</span>
            </p>
          )}
          <div className={`flex min-h-0 flex-1 justify-center [container-type:size] ${moved ? "nd-story-in" : ""}`}>
            <Phone shot={shot} name={at ? SCREENS[at] : ""} onOpen={() => setFull(true)} />
          </div>
          {merge && (
            <div role="radiogroup" aria-label="How many each at the merge" className="grid grid-cols-2 gap-1 rounded-[4px] bg-card p-1 outline-1 -outline-offset-1 outline-input">
              {[false, true].map((on) => (
                <button key={String(on)} type="button" role="radio" aria-checked={fix === on} data-fix={on ? "on" : "off"} onClick={() => setFix(on)} className={`nd-press h-11 rounded-[3px] text-[16px] font-bold ${fix === on ? "bg-foreground text-background" : "text-muted-foreground"}`}>
                  {on ? `Try ${data.fix.each} each, start ${data.fix.start}` : `${asSet.merge.each} each, as set`}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 px-4 pb-[max(16px,env(safe-area-inset-bottom,0px))] pt-3">
          {last ? (
            <>
              {back}
              {/* Go back: to the game's setup, with what you tried here (the gallery's sheet; not wired in the mock). */}
              <Btn tone="optional" className="flex-1" data-go-back>
                Go back
              </Btn>
              <Btn tone="must" className="flex-[1.4]" data-create>
                Create this game
              </Btn>
            </>
          ) : (
            <>
              <Btn
                tone="optional"
                onClick={() => {
                  setWhich((w) => (w + 1) % data.samples.length);
                  setScreen(null);
                  setMoved(true);
                }}
                aria-label="Another made-up season"
                data-shuffle
              >
                <Shuffle className="size-5" aria-hidden />
                Shuffle
              </Btn>
              {back}
              <Btn tone="ink" onClick={() => go(k + 1)} className="flex-1" data-next>
                {MOMENTS[k + 1].name}
              </Btn>
            </>
          )}
        </div>
      </div>
      {full && shot && at && <FullScreen shot={shot} name={SCREENS[at]} onClose={() => setFull(false)} />}
    </div>
  );
}
