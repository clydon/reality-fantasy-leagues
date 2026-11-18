"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, Maximize2, Shuffle, X } from "lucide-react";
import { pageModel } from "@/lib/game/game-page/model";
import { inShowWords, showWords } from "@/lib/game/show-words";
import { lockTime } from "../clock";
import type { GameView, TableRow } from "../data";
import { ordinal } from "../games";
import { bestOf } from "../show/game-week";
import { Btn } from "../ui/parts";

// TEMP mock (docs/design-round/preview-story-spec.md; docs/PLAN-game-preview.md, decisions 3 to 6): a game's preview as a short story
// of the moments of a made-up season, each shown as the app's real screens in a phone frame ("a 1:1 view from preview to game", the
// user). The season is played on the real screens by scripts/dev-test/preview-story-shots.js (the draft in the real draft room, a
// lineup on Your moves, the reveal), each moment's screens shot as the first seat at 390, and the production game views of that same
// run are what the cards' lines and checks read. What's typical is counted over many more seasons with the game's own rules (bestOf).
// ?card=1..6&season=1..3&fix=1&screen=1..3&full=1 open it somewhere (for the story's frames).

type Views = Record<string, GameView>;
interface Shot { file: string; what: string; url: string }
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
const fmt = (n: number) => String(Math.round(n * 10) / 10);
const byTotal = (t: TableRow[]) => [...t].sort((a, b) => b.total - a.total);
const stageWord = (name: string) => name.split(" · ").at(-1) ?? name;

/** One season as the cards read it: its views at the moments the screens were shot, and the few things worked out across them. */
function seasonOf(p: Played) {
  const end = p.at[String(Math.max(...Object.keys(p.at).filter((k) => k !== "start").map(Number)))];
  const start = p.at.start, game = end[p.game];
  const [s1, s2] = p.stages.map((id) => end[id]);
  const drafted = (id: string) => Object.values(p.at).map((v) => v[id]).find((v) => v?.you && v.you.team.length > 0) ?? end[id];
  // The game's own page model at the start: its name and its line, as its page says them.
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
    mid: mid?.you ? { place: mid.you.place, tied: mid.table.filter((r) => r.total === mid.you!.total).length > 1, of: mid.players, total: mid.you.total } : null,
    winner: order[0],
    margin: order[0].total - order[1].total,
    shots: p.shots ?? {},
  };
}
type Season = ReturnType<typeof seasonOf>;

/** What's typical over the many seasons, counted from each one's end standings with the game's own rules. */
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
    mergeAll: list.filter((t) => onEvery(t[stages.at(-1)!])).length,
    close: list.filter((t) => { const o = byTotal(t[game]); return o[0].total - o[1].total <= 3; }).length,
    // Second place, with the best lineup from their own team every week (everyone else as played), would have won.
    benchDecides: list.filter((t) => { const o = byTotal(t[game]); return o[1].total + benchCost(t, o[1].playerId) > o[0].total; }).length,
  };
}
type Typical = ReturnType<typeof typicalOf>;

// ---- The moments: each one's real screens (by the app's own names; the first is the one it opens on), its line and its check ----
const SCREENS: Record<string, string> = {
  games: "Games",
  "tonight-draft": "Tonight",
  "draft-picked": "Draft room",
  "draft-revealed": "Revealed",
  "tonight-9": "Tonight",
  "moves-9": "Your moves",
  "stage-10": "Game page",
  "tonight-10": "Tonight",
  "merge-revealed": "Revealed",
  "tonight-merge": "Tonight",
  "merge-picked": "Draft room",
  "reveal-table": "Reveal",
  final: "Game page",
};
interface Moment { title: string; screens: string[]; line: (x: Season) => string; check?: (t: Typical) => { n: number; label: string; flag: boolean } }
const MOMENTS: Moment[] = [
  { title: "Your games", screens: ["games", "tonight-draft"], line: (x) => x.model.title.line },
  { title: "The draft", screens: ["draft-picked", "draft-revealed"], line: (x) => `Before ${EP} ${x.first.from} · ${x.first.each} each, in private` },
  { title: "Each episode", screens: ["tonight-9", "moves-9"], line: (x) => `Start ${x.first.start} of your ${x.first.each} before it airs`, check: (t) => ({ n: t.benchDecides, label: "2nd’s best lineups would have won", flag: false }) },
  { title: `After ${EP} 10`, screens: ["stage-10", "tonight-10"], line: (x) => (x.mid ? `You’re ${x.mid.tied ? "tied " : ""}${ordinal(x.mid.place)} of ${x.mid.of} on ${fmt(x.mid.total)}` : "Everyone’s points so far") },
  { title: "The merge", screens: ["merge-revealed", "tonight-merge", "merge-picked"], line: (x) => `After ${EP} ${x.merge.from - 1} · ${x.merge.left} still in · draft ${x.merge.each} again`, check: (t) => ({ n: t.mergeAll, label: "Same castaway on every team", flag: t.mergeAll * 2 > t.seasons }) },
  { title: "The finale", screens: ["reveal-table", "final"], line: (x) => `${x.winner.you ? "You win" : `${x.winner.name} wins`} by ${fmt(x.margin)}`, check: (t) => ({ n: t.close, label: "A close finish, 3 or less", flag: false }) },
];

// ---- Parts ----
/** A slanted caption tag, the app's. */
function Tag({ children }: { children: ReactNode }) {
  return <span className="type-caption inline-flex h-6 flex-none items-center bg-foreground pl-2 pr-4 text-[13px] tracking-[0.04em] text-background [clip-path:polygon(0_0,100%_0,calc(100%-8px)_100%,0_100%)]">{children}</span>;
}
/** "Typical": a tick for each season played, filled where it happened; a flag carries Check. */
function Ticks({ n, of, label, flag }: { n: number; of: number; label: string; flag: boolean }) {
  return (
    <div className="flex flex-col gap-1.5" data-ticks={`${n}/${of}`}>
      <div className="flex items-center gap-2">
        {flag && <Tag>Check</Tag>}
        <span className="type-caption min-w-0 flex-1 truncate text-[15px] tracking-[0.04em] text-muted-foreground">{label}</span>
        <span className="type-num flex-none text-[20px]">
          {n}
          <span className="text-[13px] text-muted-foreground"> of {of} seasons</span>
        </span>
      </div>
      <div className="flex gap-[3px]" aria-hidden>
        {Array.from({ length: of }, (_, i) => (
          <span key={i} className="h-2.5 flex-1 rounded-[1px]" style={{ background: i < n ? "var(--foreground)" : "color-mix(in oklab, var(--foreground) 16%, transparent)" }} />
        ))}
      </div>
    </div>
  );
}
const src = (s: Shot) => `/start/preview-story/shot/${s.file}`;
/** The real screen in a phone: a bezel around the shot as the phone shows it (390 x 844), its foot under the card's; a tap opens it
 *  whole (as Full size does). */
function Phone({ shot, name, onOpen }: { shot: Shot | undefined; name: string; onOpen: () => void }) {
  const W = "w-[min(306px,78vw)]";
  if (!shot)
    return (
      <div className={`mx-auto grid aspect-[390/844] ${W} place-items-center rounded-[46px] bg-card px-8 text-center text-[15px] text-muted-foreground outline-1 -outline-offset-1 outline-input`}>
        No screen shot for this season yet
      </div>
    );
  return (
    <button type="button" onClick={onOpen} data-phone={shot.file} aria-label={`${name}, the real screen: open it at full size`} className={`nd-press relative mx-auto block ${W} flex-none rounded-[46px] bg-[#0b0a10] p-[9px] shadow-[0_28px_60px_-24px_rgba(0,0,0,.75)] outline-1 -outline-offset-1 outline-[color-mix(in_oklab,var(--foreground)_16%,transparent)]`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a dev-only shot of the app's own screen */}
      <img src={src(shot)} alt={shot.what} draggable={false} className="block aspect-[390/844] w-full rounded-[37px] bg-card object-cover" />
    </button>
  );
}
/** A real screen at full size: on a phone, exactly as the app shows it. */
function FullScreen({ shot, name, onClose }: { shot: Shot; name: string; onClose: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal aria-label={`${name}, at full size`} className="fixed inset-0 z-[60] flex flex-col bg-[#0b0a10]" data-full-screen>
      {/* The screen whole, as the phone shows it; the way back on its own bar beneath, never over the app. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* eslint-disable-next-line @next/next/no-img-element -- a dev-only shot of the app's own screen */}
        <img src={src(shot)} alt={shot.what} className="mx-auto block w-full max-w-[430px]" />
      </div>
      <div className="flex flex-none items-center gap-3 border-t border-[rgba(244,242,248,.14)] bg-[#0b0a10] px-4 pt-2 pb-[max(10px,env(safe-area-inset-bottom,0px))] text-[#f4f2f8]">
        <span className="min-w-0 flex-1 truncate text-[13px] text-[#a9a4b8]">{name} · the real screen, a made-up season</span>
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
  const [screen, setScreen] = useState(0);
  const [full, setFull] = useState(false);
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
  const at = screens[Math.min(screen, Math.max(0, screens.length - 1))];
  const shot = at ? x.shots[at] : undefined;
  const check = m.check?.(t);
  const last = k === MOMENTS.length - 1;
  const merge = k === 4;
  const go = (n: number) => {
    setK(Math.max(0, Math.min(MOMENTS.length - 1, n)));
    setScreen(0);
  };
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground" data-preview-story data-card={k + 1}>
      {/* The one authored moment: each moment's phone rises in (already mostly visible), none under reduced motion. */}
      <style>{`.nd-story-in{animation:nd-story-in .34s cubic-bezier(.16,1,.3,1) both}@keyframes nd-story-in{from{opacity:.4;transform:translateY(16px)}}@media (prefers-reduced-motion:reduce){.nd-story-in{animation:none}}`}</style>
      <div className="mx-auto flex w-full max-w-[430px] flex-1 flex-col overflow-hidden pt-[env(safe-area-inset-top,0px)]">
        <div className="flex gap-1 px-4 pt-3" aria-hidden>
          {MOMENTS.map((c, i) => (
            <span key={c.title} className="h-1 flex-1 rounded-full" style={{ background: i <= k ? "var(--foreground)" : "color-mix(in oklab, var(--foreground) 18%, transparent)" }} />
          ))}
        </div>
        <div className="flex h-12 items-center gap-3 px-4">
          <span className="type-caption inline-flex h-7 flex-none items-center bg-secondary pl-2.5 pr-5 text-[15px] tracking-[0.04em] [clip-path:polygon(0_0,100%_0,calc(100%-9px)_100%,0_100%)]">Made-up season</span>
          <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground" data-trying={fix ? "" : undefined}>
            {fix ? `Trying ${data.fix.each} each at the merge` : x.model.title.name}
          </span>
          <button type="button" aria-label="Close" className="nd-press -mr-2 grid size-11 place-items-center">
            <X className="size-6" />
          </button>
        </div>
        <div className="relative flex min-h-0 flex-1 flex-col" key={`${k}-${which}-${fix}`} data-card-body>
          <div className="flex flex-col gap-1 px-4 pt-1">
            <h1 className="type-caption text-[30px] leading-[0.9]">{m.title}</h1>
            <span className="text-[15px] text-muted-foreground" data-line>
              {m.line(x)}
            </span>
          </div>
          {/* The moment's real screens, by the app's own names, and the one on show at full size. */}
          <div className="flex items-center gap-1.5 px-4 pt-3">
            <div role="tablist" aria-label="The real screens at this moment" className="flex min-w-0 flex-1 gap-1.5">
              {screens.map((id, i) => (
                <button key={id} type="button" role="tab" aria-selected={id === at} data-screen={id} onClick={() => setScreen(i)} className={`nd-press type-caption h-9 flex-none rounded-[3px] px-3 text-[14px] tracking-[0.04em] ${id === at ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"}`}>
                  {SCREENS[id]}
                </button>
              ))}
            </div>
            {shot && (
              <button type="button" onClick={() => setFull(true)} data-full aria-label={`${SCREENS[at!]} at full size`} className="nd-press inline-flex h-9 flex-none items-center gap-1.5 rounded-[3px] px-2 text-[14px] font-semibold text-muted-foreground">
                <Maximize2 className="size-4" aria-hidden />
                {/* Three screens' names leave room for the icon only. */}
                {screens.length < 3 && "Full size"}
              </button>
            )}
          </div>
          <div className="nd-story-in min-h-0 flex-1 overflow-hidden px-4 pt-3">
            <Phone shot={shot} name={at ? SCREENS[at] : ""} onOpen={() => setFull(true)} />
          </div>
          {/* The foot over the phone's lower part: the moment's check, and the merge's fix. */}
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 bg-background px-4 pt-3 before:pointer-events-none before:absolute before:inset-x-0 before:-top-12 before:h-12 before:bg-gradient-to-b before:from-transparent before:to-background before:content-['']" data-foot>
            {check && <Ticks n={check.n} of={t.seasons} label={check.label} flag={check.flag} />}
            {merge && (
              <div role="radiogroup" aria-label="How many each at the merge" className="grid grid-cols-2 gap-1 rounded-[4px] bg-card p-1 outline-1 -outline-offset-1 outline-input">
                {[false, true].map((on) => (
                  <button key={String(on)} type="button" role="radio" aria-checked={fix === on} data-fix={on ? "on" : "off"} onClick={() => setFix(on)} className={`nd-press h-11 rounded-[3px] text-[16px] font-bold ${fix === on ? "bg-foreground text-background" : "text-muted-foreground"}`}>
                    {on ? `Try ${data.fix.each} each, start ${data.fix.start}` : `${asSet.merge.each} each, as set`}
                  </button>
                ))}
              </div>
            )}
            {merge && fix && (
              <Btn tone="ink" wide data-fix-use>
                Use {data.fix.each} each, start {data.fix.start}
              </Btn>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 pb-[max(16px,env(safe-area-inset-bottom,0px))] pt-3">
          {last ? (
            <>
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
                  setScreen(0);
                }}
                aria-label="Another made-up season"
                data-shuffle
              >
                <Shuffle className="size-5" aria-hidden />
                Shuffle
              </Btn>
              {k > 0 && (
                <Btn tone="optional" onClick={() => go(k - 1)} aria-label="Back" className="w-[52px] px-0">
                  <ChevronLeft className="size-5" aria-hidden />
                </Btn>
              )}
              <Btn tone={merge && fix ? "optional" : "ink"} onClick={() => go(k + 1)} className="flex-1" data-next>
                {MOMENTS[k + 1].title}
              </Btn>
            </>
          )}
        </div>
      </div>
      {full && shot && at && <FullScreen shot={shot} name={SCREENS[at]} onClose={() => setFull(false)} />}
    </div>
  );
}
