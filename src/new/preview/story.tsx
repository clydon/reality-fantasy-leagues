"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronLeft, Crown, Shuffle, X } from "lucide-react";
import { Btn } from "../ui/parts";

// TEMP mock (docs/design-round/preview-story-spec.md, -first-view.md): a game's preview as a short story of cards, from a made-up
// season the real engine played (scripts/dev-test/preview-story-data.js). It borrows the reveal's full-screen story (a dark stage,
// tap or swipe to move on), so it reads as the app. Each card answers one question with one picture; "typical" is always ticks of
// the seasons where it happened. ?card=1..6&season=1..3&fix=1 open it somewhere (for the story's frames).

export interface StoryWeek { episode: number; total: number; started: { id: string; points: number }[]; bench: { id: string; points: number }[] }
interface Draft { stage: string; before: number; left: number; teams: Record<string, string[]> }
interface Stage { id: string; name: string; from: number; to: number | null; table: { id: string; total: number }[]; weeks: Record<string, StoryWeek[]> }
interface Sample { seed: number; drafts: Draft[]; small: Draft[]; stages: Stage[]; overall: { id: string; total: number }[]; cast: { id: string; name: string; photo: string | null }[]; out: Record<string, { episode: number; method: string }> }
interface Typical { seasons: number; mergeLeft: number; mergeMostHeldAll: number; swing: number; margin: number; closeFinish: number; firstStageLeaderWins: number }
export interface StoryData {
  game: { name: string; show: string; season: number; from: number; last: number; people: { id: string; name: string; you: boolean }[]; rules: { each: number; start: number; small: { each: number; start: number } } };
  samples: Sample[];
  typical: Typical;
  typicalSmall: Typical;
}

// The couch's colours, from the app's palette (src/lib/people.ts), one each.
const COLOUR = ["#8db85e", "#e86f9a", "#5089c9", "#a76bb0"];
// The two stages, the same two tones on every card.
const BAND = ["color-mix(in oklab, var(--foreground) 9%, var(--background))", "color-mix(in oklab, var(--foreground) 19%, var(--background))"];
const INK = "#121018";
const CARDS = ["The season", "The draft", "Each week", "The race", "The merge", "The finale"] as const;
const signed = (n: number) => (n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(-n)}` : "0");
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const firstName = (n: string) => n.split(" ")[0];
const stageWord = (name: string) => name.split(" · ").pop() ?? name;

/** Everything a card reads, worked out once per season shown. */
function seasonOf(d: StoryData, s: Sample, fix: boolean) {
  const eps = Array.from({ length: d.game.last - d.game.from + 1 }, (_, i) => d.game.from + i);
  const people = d.game.people.map((p, i) => ({ ...p, colour: COLOUR[i % COLOUR.length] }));
  const cast = new Map(s.cast.map((c) => [c.id, c]));
  const stages = s.stages.map((st) => ({ ...st, to: st.to ?? d.game.last }));
  const stageAt = (n: number) => stages.findIndex((st) => n >= st.from && n <= st.to);
  // Each person's running total, episode by episode (each stage's week added up: the overall).
  const run: Record<string, number[]> = {};
  for (const p of people) {
    let t = 0;
    run[p.id] = eps.map((n) => {
      for (const st of stages) t += st.weeks[p.id]?.find((w) => w.episode === n)?.total ?? 0;
      return t;
    });
  }
  const order = [...s.overall].sort((a, b) => b.total - a.total);
  const merge = (fix ? s.small : s.drafts)[1] ?? null;
  // Who went home when (made up), and who's still in before an episode.
  const outEp = new Map(Object.entries(s.out).map(([id, o]) => [id, o.episode]));
  const gone = (n: number) => s.cast.filter((c) => outEp.get(c.id) === n);
  const stillIn = (n: number) => s.cast.filter((c) => !((outEp.get(c.id) ?? Infinity) < n)).map((c) => c.id);
  return { eps, people, cast, stages, stageAt, run, order, start: s.drafts[0], merge, gone, stillIn, you: people.find((p) => p.you) ?? people[0] };
}
type Season = ReturnType<typeof seasonOf>;

// ---- Small parts ----
function Person({ p, size = 28 }: { p: { name: string; colour: string }; size?: number }) {
  return (
    <span aria-hidden className="type-num grid flex-none place-items-center rounded-[3px]" style={{ width: size, height: size, background: p.colour, color: INK, fontSize: Math.round(size * 0.48) }}>
      {p.name.slice(0, 1)}
    </span>
  );
}
function Photo({ src, out, size, className = "", style }: { src: string | null | undefined; out?: boolean; size?: number; className?: string; style?: CSSProperties }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- the season's own cast photos
    <img src={src ?? ""} alt="" draggable={false} className={`block flex-none rounded-[3px] bg-secondary object-cover object-[center_20%] ${out ? "grayscale opacity-60" : ""} ${className}`} style={{ width: size, height: size, ...style }} />
  );
}
/** "Typical": a tick for each season played, filled where it happened. */
function Ticks({ n, of, label }: { n: number; of: number; label: ReactNode }) {
  return (
    <div className="flex flex-col gap-2" data-ticks={`${n}/${of}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="type-caption text-[15px] tracking-[0.04em] text-muted-foreground">{label}</span>
        <span className="type-num text-[22px]">
          {n}
          <span className="text-[15px] text-muted-foreground"> of {of} seasons</span>
        </span>
      </div>
      <div className="flex gap-[3px]" aria-hidden>
        {Array.from({ length: of }, (_, i) => (
          <span key={i} className="h-3.5 flex-1 rounded-[1px]" style={{ background: i < n ? "var(--foreground)" : "color-mix(in oklab, var(--foreground) 16%, transparent)" }} />
        ))}
      </div>
    </div>
  );
}
function Tag({ children, tone = "quiet" }: { children: ReactNode; tone?: "quiet" | "ink" }) {
  return (
    <span
      className={`type-caption inline-flex h-6 flex-none items-center pl-2 pr-4 text-[13px] tracking-[0.04em] [clip-path:polygon(0_0,100%_0,calc(100%-8px)_100%,0_100%)] ${tone === "ink" ? "bg-foreground text-background" : "bg-secondary text-foreground"}`}
    >
      {children}
    </span>
  );
}

// ---- The cards ----
function SeasonCard({ x, d, toMerge }: { x: Season; d: StoryData; toMerge: () => void }) {
  const col = (n: number) => x.eps.indexOf(n) + 1;
  const winner = x.people.find((p) => p.id === x.order[0].id)!;
  const margin = x.order[0].total - x.order[1].total;
  const flagged = d.typical.mergeMostHeldAll * 2 > d.typical.seasons;
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-y-2" style={{ gridTemplateColumns: `repeat(${x.eps.length}, minmax(0, 1fr))` }}>
        {x.stages.map((st, i) => (
          <div key={st.id} className="type-caption flex h-9 items-center px-2 text-[14px] tracking-[0.04em]" style={{ gridColumn: `${col(st.from)} / ${col(st.to) + 1}`, gridRow: 1, background: BAND[i] }}>
            {stageWord(st.name)}
          </div>
        ))}
        {x.eps.map((n) => (
          <div key={n} className="flex flex-col items-start gap-0.5 px-2 pt-1" style={{ gridColumn: col(n), gridRow: 2 }}>
            <span className="type-num text-[30px] leading-none">{n}</span>
            {n === d.game.last && <span className="type-caption text-[12px] tracking-[0.04em] text-muted-foreground">Finale</span>}
          </div>
        ))}
        {/* Your moves: a draft where a stage starts, then a lineup every episode (three of your five). */}
        {x.eps.map((n) => (
          <div key={n} className="flex flex-col items-start gap-1.5 px-2" style={{ gridColumn: col(n), gridRow: 3 }}>
            {x.stages.some((st) => st.from === n) && <Tag tone="ink">Draft</Tag>}
            <span className="flex gap-[3px]" aria-label="Start 3 of 5">
              {Array.from({ length: d.game.rules.each }, (_, k) => (
                <span key={k} className="size-[7px] rounded-[1px]" style={{ background: k < d.game.rules.start ? "var(--foreground)" : "color-mix(in oklab, var(--foreground) 22%, transparent)" }} />
              ))}
            </span>
          </div>
        ))}
        {/* Who went home (made up): their faces under the night it happened. */}
        {x.eps.map((n) => {
          const gone = x.gone(n);
          return (
            <div key={n} className="flex px-2 pt-2" style={{ gridColumn: col(n), gridRow: 4 }}>
              {gone.slice(0, n === d.game.last ? 4 : 2).map((c, k) => (
                <Photo key={c.id} src={c.photo} out size={n === d.game.last ? 22 : 36} style={{ marginLeft: k ? (n === d.game.last ? -9 : -14) : 0, boxShadow: "0 0 0 2px var(--background)" }} />
              ))}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <span className="relative">
          <Person p={winner} size={52} />
          <Crown className="absolute -top-4 left-1/2 size-5 -translate-x-1/2 text-foreground" aria-hidden />
        </span>
        <div className="flex flex-col">
          <span className="type-caption text-[28px] leading-none">{winner.you ? "You win" : `${winner.name} wins`}</span>
          <span className="text-[14px] text-muted-foreground">
            {fmt(x.order[0].total)} pts · by {fmt(margin)}
          </span>
        </div>
      </div>
      {flagged && (
        <button type="button" data-flag onClick={toMerge} className="nd-press flex h-[52px] items-stretch overflow-hidden rounded-[3px] bg-card text-left outline-1 -outline-offset-1 outline-input">
          <span className="type-caption flex items-center bg-foreground pl-3 pr-5 text-[15px] tracking-[0.04em] text-background [clip-path:polygon(0_0,100%_0,calc(100%-10px)_100%,0_100%)]">Check</span>
          <span className="flex flex-1 items-center px-3 text-[16px] font-semibold">The merge’s teams</span>
          <span className="type-caption flex items-center pr-3 text-[15px] text-muted-foreground">Card 5</span>
        </button>
      )}
    </div>
  );
}

function DraftCard({ x }: { x: Season }) {
  const teams = x.start.teams, mine = teams[x.you.id] ?? [];
  const held = (id: string) => Object.values(teams).filter((t) => t.includes(id)).length;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-2">
        {mine.map((id) => {
          const c = x.cast.get(id);
          return (
            <div key={id} className="relative overflow-hidden rounded-[3px] bg-card">
              <Photo src={c?.photo} className="h-[112px] w-full rounded-none" />
              <span className="type-caption block truncate px-2 py-1.5 text-[17px]">{firstName(c?.name ?? "")}</span>
              {held(id) > 1 && <span className="type-num absolute right-1.5 top-1.5 rounded-[2px] bg-background/85 px-1.5 py-0.5 text-[14px]">×{held(id)}</span>}
            </div>
          );
        })}
      </div>
      <div className="flex flex-col gap-2.5">
        {x.people.filter((p) => !p.you).map((p) => (
          <div key={p.id} className="flex items-center gap-3">
            <Person p={p} size={30} />
            <div className="flex gap-1.5">
              {(teams[p.id] ?? []).map((id) => (
                <Photo key={id} src={x.cast.get(id)?.photo} size={44} style={mine.includes(id) ? { boxShadow: `0 0 0 2px var(--background), 0 0 0 4px ${x.you.colour}` } : undefined} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeekCard({ x, d }: { x: Season; d: StoryData }) {
  // The week that shows the choice best: where your bench outscored your lineup the most.
  const weeks = x.stages.flatMap((st) => st.weeks[x.you.id] ?? []);
  const pts = (w: StoryWeek) => [...w.started, ...w.bench].map((c) => c.points).sort((a, b) => b - a);
  const sum = (xs: number[]) => xs.reduce((t, v) => t + v, 0);
  const best = (w: StoryWeek) => sum(pts(w).slice(0, w.started.length));
  const worst = (w: StoryWeek) => sum(pts(w).slice(-w.started.length));
  const w = [...weeks].sort((a, b) => best(b) - b.total - (best(a) - a.total) || best(b) - worst(b) - (best(a) - worst(a)))[0];
  if (!w) return null;
  const lo = Math.min(0, worst(w)), hi = Math.max(best(w), lo + d.typical.swing), at = (v: number) => `${((v - lo) / (hi - lo || 1)) * 100}%`;
  const tile = (c: { id: string; points: number }, on: boolean) => {
    const cast = x.cast.get(c.id);
    return (
      <div key={c.id} className={`flex flex-col gap-1 ${on ? "" : "opacity-55"}`}>
        <Photo src={cast?.photo} className="h-[84px] w-full" out={!on} />
        <span className="type-caption truncate text-[14px]">{firstName(cast?.name ?? "")}</span>
        <span className="type-num text-[22px] leading-none" style={{ color: c.points > 0 ? "var(--nd-good)" : c.points < 0 ? "var(--nd-band-setback)" : undefined }}>
          {signed(c.points)}
        </span>
      </div>
    );
  };
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-5 gap-2">
        {w.started.map((c) => tile(c, true))}
        {w.bench.map((c) => tile(c, false))}
      </div>
      <div className="flex flex-col gap-3">
        <div className="relative h-11">
          <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full" style={{ background: "color-mix(in oklab, var(--foreground) 16%, transparent)" }} />
          <span className="absolute top-1/2 h-[3px] -translate-y-1/2" style={{ left: at(worst(w)), width: `calc(${at(best(w))} - ${at(worst(w))})`, background: "color-mix(in oklab, var(--foreground) 45%, transparent)" }} />
          {[
            { v: worst(w), label: "Worst", strong: false },
            { v: w.total, label: "You", strong: true },
            { v: best(w), label: "Best", strong: false },
          ].map((m) => (
            <span key={m.label} className="absolute top-0 flex -translate-x-1/2 flex-col items-center" style={{ left: at(m.v) }}>
              <span className={`block w-[3px] rounded-full ${m.strong ? "h-11 bg-foreground" : "h-6 translate-y-2.5 bg-muted-foreground"}`} />
            </span>
          ))}
        </div>
        <div className="relative h-10">
          {[
            { v: worst(w), label: "worst" },
            { v: w.total, label: "you" },
            { v: best(w), label: "best" },
          ].map((m) => (
            <span key={m.label} className="absolute top-0 flex -translate-x-1/2 flex-col items-center" style={{ left: at(m.v) }}>
              <span className="type-num text-[22px] leading-none">{fmt(m.v)}</span>
              <span className="text-[12px] text-muted-foreground">{m.label}</span>
            </span>
          ))}
        </div>
      </div>
      <p className="text-[14px] text-muted-foreground">
        Your pick moves a week by about <b className="type-num text-[17px] text-foreground">{fmt(Math.round(d.typical.swing))}</b> points, typically.
      </p>
    </div>
  );
}

function RaceCard({ x }: { x: Season }) {
  const W = 358, H = 300, L = 8, R = 44, T = 18, B = 34;
  const xs = [x.eps[0] - 1, ...x.eps];
  const max = Math.max(1, ...Object.values(x.run).flat());
  const px = (n: number) => L + ((n - xs[0]) / (xs[xs.length - 1] - xs[0])) * (W - L - R);
  const py = (v: number) => T + (1 - v / max) * (H - T - B);
  const leader = x.order[0].id;
  // End labels, nudged apart when two finish close.
  const ends = x.people.map((p) => ({ p, y: py(x.run[p.id].at(-1) ?? 0) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 22) ends[i].y = ends[i - 1].y + 22;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Everyone's running total, episode by episode">
      {x.stages.map((st, i) => (
        <rect key={st.id} x={px(st.from - 1)} y={T - 6} width={px(st.to) - px(st.from - 1)} height={H - T - B + 6} fill={BAND[i]} />
      ))}
      {x.stages.slice(1).map((st) => (
        <g key={st.id}>
          <line x1={px(st.from - 1)} x2={px(st.from - 1)} y1={T - 6} y2={H - B} stroke="var(--foreground)" strokeDasharray="3 4" strokeWidth={1.5} />
        </g>
      ))}
      <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="var(--border)" />
      {xs.slice(1).map((n) => (
        <text key={n} x={px(n)} y={H - 12} textAnchor="middle" className="type-num" fontSize={16} fill="var(--muted-foreground)">
          {n}
        </text>
      ))}
      {x.people.map((p) => (
        <polyline key={p.id} fill="none" stroke={p.colour} strokeWidth={p.id === leader ? 4 : 3} strokeLinejoin="round" strokeLinecap="round" points={[[px(xs[0]), py(0)], ...x.eps.map((n, i) => [px(n), py(x.run[p.id][i])])].map(([a, b]) => `${a},${b}`).join(" ")} />
      ))}
      {ends.map(({ p, y }) => (
        <g key={p.id} transform={`translate(${W - R + 8}, ${y - 11})`}>
          <rect width={22} height={22} rx={3} fill={p.colour} />
          <text x={11} y={16} textAnchor="middle" className="type-num" fontSize={14} fill={INK}>
            {p.name.slice(0, 1)}
          </text>
        </g>
      ))}
    </svg>
  );
}

function MergeCard({ x, d, fix, setFix }: { x: Season; d: StoryData; fix: boolean; setFix: (v: boolean) => void }) {
  const m = x.merge;
  if (!m) return null;
  // Columns: everyone still in, the most-held first, so a castaway on every team reads as a full column.
  const held = (id: string) => Object.values(m.teams).filter((t) => t.includes(id)).length;
  const cols = x.stillIn(m.before).sort((a, b) => held(b) - held(a) || (a < b ? -1 : 1));
  const all = cols.filter((id) => held(id) === x.people.length);
  const t = fix ? d.typicalSmall : d.typical;
  const cell = 40;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-end gap-1.5 pl-[42px]">
          {cols.map((id) => (
            <div key={id} className="flex flex-col items-center gap-1" style={{ width: cell }}>
              <span className="type-caption w-full truncate text-center text-[11px] tracking-[0.02em] text-muted-foreground">{firstName(x.cast.get(id)?.name ?? "")}</span>
            </div>
          ))}
        </div>
        <div className="relative flex flex-col gap-1.5">
          {/* The castaway on every team: one frame down their column, the card's one accent. */}
          {all.map((id) => (
            <span key={id} aria-hidden className="pointer-events-none absolute -bottom-1 -top-1 rounded-[4px] outline-[3px] outline-foreground [outline-style:solid]" style={{ left: 42 + cols.indexOf(id) * (cell + 6) - 3, width: cell + 6 }} />
          ))}
          {x.people.map((p) => (
            <div key={p.id} className="flex items-center gap-1.5">
              <span className="mr-1.5">
                <Person p={p} size={30} />
              </span>
              {cols.map((id) =>
                m.teams[p.id]?.includes(id) ? (
                  <Photo key={id} src={x.cast.get(id)?.photo} size={cell} />
                ) : (
                  <span key={id} className="block flex-none rounded-[3px] outline-1 -outline-offset-1 outline-dashed outline-input" style={{ width: cell, height: cell }} />
                ),
              )}
            </div>
          ))}
        </div>
      </div>
      <Ticks n={t.mergeMostHeldAll} of={t.seasons} label="Someone on every team" />
      <div className="flex flex-col gap-2">
        <div role="radiogroup" aria-label="How many each at the merge" className="grid grid-cols-2 gap-1 rounded-[4px] bg-card p-1 outline-1 -outline-offset-1 outline-input">
          {[false, true].map((v) => (
            <button
              key={String(v)}
              type="button"
              role="radio"
              aria-checked={fix === v}
              data-fix={v ? "on" : "off"}
              onClick={() => setFix(v)}
              className={`nd-press h-11 rounded-[3px] text-[15px] font-bold ${fix === v ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              {v ? `${d.game.rules.small.each} each, start ${d.game.rules.small.start}` : `${d.game.rules.each} each, start ${d.game.rules.start}`}
            </button>
          ))}
        </div>
        {fix && (
          <Btn tone="optional" wide data-fix-use>
            Use {d.game.rules.small.each} each at the merge
          </Btn>
        )}
      </div>
    </div>
  );
}

function FinaleCard({ x, d }: { x: Season; d: StoryData }) {
  const winner = x.people.find((p) => p.id === x.order[0].id)!;
  const by = (pid: string, i: number) => x.stages[i]?.table.find((r) => r.id === pid)?.total ?? 0;
  const max = Math.max(1, ...x.order.map((r) => r.total));
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <span className="relative">
          <Person p={winner} size={72} />
          <Crown className="absolute -top-5 left-1/2 size-6 -translate-x-1/2" aria-hidden />
        </span>
        <div className="flex flex-col">
          <span className="type-caption text-[34px] leading-none">{winner.name}</span>
          <span className="text-[14px] text-muted-foreground">
            wins by <b className="type-num text-[17px] text-foreground">{fmt(x.order[0].total - x.order[1].total)}</b>
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        {x.order.map((r) => {
          const p = x.people.find((q) => q.id === r.id)!;
          return (
            <div key={r.id} className="flex items-center gap-3">
              <Person p={p} size={30} />
              <div className="flex h-7 flex-1 overflow-hidden rounded-[2px]">
                {x.stages.map((st, i) => (
                  <span key={st.id} className="h-full" style={{ width: `${(Math.max(0, by(r.id, i)) / max) * 100}%`, background: i ? p.colour : `color-mix(in oklab, ${p.colour} 45%, var(--background))` }} />
                ))}
              </div>
              <span className="type-num w-12 text-right text-[24px]">{fmt(r.total)}</span>
            </div>
          );
        })}
        <div className="flex gap-4 pl-[42px] text-[12px] text-muted-foreground">
          {x.stages.map((st, i) => (
            <span key={st.id} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[1px]" style={{ background: i ? "var(--foreground)" : "color-mix(in oklab, var(--foreground) 45%, var(--background))" }} />
              {stageWord(st.name)}
            </span>
          ))}
        </div>
      </div>
      <Ticks n={d.typical.firstStageLeaderWins} of={d.typical.seasons} label="The leader at the merge wins" />
    </div>
  );
}

// ---- The story ----
export function PreviewStory({ data }: { data: StoryData }) {
  const [k, setK] = useState(0);
  const [which, setWhich] = useState(0);
  const [fix, setFix] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the frames' entry (?card=, ?season=, ?fix=) read once
    if (q.get("card")) setK(Math.max(0, Math.min(CARDS.length - 1, Number(q.get("card")) - 1)));
    if (q.get("season")) setWhich(Math.max(0, Math.min(data.samples.length - 1, Number(q.get("season")) - 1)));
    if (q.get("fix") === "1") setFix(true);
  }, [data.samples.length]);
  const sample = data.samples[which];
  const x = useMemo(() => seasonOf(data, sample, fix), [data, sample, fix]);
  const last = k === CARDS.length - 1;
  const detail = [
    `${data.game.show} ${data.game.season} · Episodes ${data.game.from} to ${data.game.last}`,
    `Before Episode ${x.start.before} · ${data.game.rules.each} each, in private`,
    `Start ${data.game.rules.start} of your ${data.game.rules.each}, every episode`,
    "Everyone’s points, episode by episode",
    x.merge ? `After Episode ${x.merge.before - 1} · ${x.merge.left} still in · ${fix ? data.game.rules.small.each : data.game.rules.each} each` : "",
    `Episode ${data.game.last}`,
  ][k];
  const go = (n: number) => setK(Math.max(0, Math.min(CARDS.length - 1, n)));
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground" data-preview-story data-card={k + 1}>
      {/* The one authored moment: each card's picture rises in (already mostly visible), none under reduced motion. */}
      <style>{`.nd-story-in{animation:nd-story-in .32s cubic-bezier(.16,1,.3,1) both}@keyframes nd-story-in{from{opacity:.35;transform:translateY(10px)}}@media (prefers-reduced-motion:reduce){.nd-story-in{animation:none}}`}</style>
      <div className="mx-auto flex w-full max-w-[430px] flex-1 flex-col pt-[env(safe-area-inset-top,0px)]">
        <div className="flex gap-1 px-4 pt-3" aria-hidden>
          {CARDS.map((c, i) => (
            <span key={c} className="h-1 flex-1 rounded-full" style={{ background: i <= k ? "var(--foreground)" : "color-mix(in oklab, var(--foreground) 18%, transparent)" }} />
          ))}
        </div>
        <div className="flex h-14 items-center gap-3 px-4">
          <span className="type-caption inline-flex h-7 items-center bg-secondary pl-2.5 pr-5 text-[14px] tracking-[0.04em] [clip-path:polygon(0_0,100%_0,calc(100%-9px)_100%,0_100%)]">Made-up season</span>
          <span className="min-w-0 flex-1 truncate text-[14px] text-muted-foreground">{data.game.name}</span>
          <button type="button" aria-label="Close" className="nd-press -mr-2 grid size-11 place-items-center">
            <X className="size-6" />
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4 pt-2" key={`${k}-${which}`} data-card-body>
          <div className="flex flex-col gap-1">
            <h1 className="type-caption text-[40px] leading-[0.9]">{CARDS[k]}</h1>
            <span className="text-[14px] text-muted-foreground">{detail}</span>
          </div>
          <div className="nd-story-in">
            {k === 0 && <SeasonCard x={x} d={data} toMerge={() => go(4)} />}
            {k === 1 && <DraftCard x={x} />}
            {k === 2 && <WeekCard x={x} d={data} />}
            {k === 3 && <RaceCard x={x} />}
            {k === 4 && <MergeCard x={x} d={data} fix={fix} setFix={setFix} />}
            {k === 5 && <FinaleCard x={x} d={data} />}
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 pb-[max(16px,env(safe-area-inset-bottom,0px))] pt-2">
          {last ? (
            <>
              <Btn tone="optional" onClick={() => go(0)} className="flex-1">
                Change it
              </Btn>
              <Btn tone="must" className="flex-[1.4]">
                Start this game
              </Btn>
            </>
          ) : (
            <>
              <Btn tone="optional" onClick={() => setWhich((w) => (w + 1) % data.samples.length)} aria-label="Another made-up season" data-shuffle>
                <Shuffle className="size-5" aria-hidden />
                Shuffle
              </Btn>
              {k > 0 && (
                <Btn tone="optional" onClick={() => go(k - 1)} aria-label="Back" className="w-[52px] px-0">
                  <ChevronLeft className="size-5" aria-hidden />
                </Btn>
              )}
              <Btn tone="ink" onClick={() => go(k + 1)} className="flex-1" data-next>
                {CARDS[k + 1]}
              </Btn>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
