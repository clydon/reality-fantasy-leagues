"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Crown, Shuffle, X } from "lucide-react";
import { colourOf } from "@/lib/people";
import { pageModel } from "@/lib/game/game-page/model";
import { inShowWords, showWords } from "@/lib/game/show-words";
import { lockTime } from "../clock";
import type { GameView, TableRow } from "../data";
import { SeasonGrid } from "../show/game-page";
import { useDrill } from "../show/game-sheets";
import { bestOf, PersonSeason, YourTeam } from "../show/game-week";
import { Face } from "../show/parts";
import { Avatar } from "../ui/bars";
import { Btn } from "../ui/parts";

// TEMP mock (docs/design-round/preview-story-spec.md; docs/PLAN-game-preview.md, decisions 3 to 5): a game's preview as a short
// story of cards, from made-up seasons the real engine played (scripts/dev-test/preview-story-data.js). The data is the production
// game view at a few moments, unchanged, and whatever the game itself shows is drawn here by the game's own component with it (Your
// team, the person's season, the season grid, the stages' line, faces, people's squares), so the preview changes when the game does.
// Only what the game has no screen for is the preview's own: the season ahead as a strip, the race, the merge's teams side by side,
// and what's typical, counted over many seasons with the game's own rules (bestOf). ?card=1..6&season=1..3&fix=1 open it somewhere.

type Views = Record<string, GameView>;
interface Played { seed: number; game: string; stages: string[]; at: Record<string, Views> }
interface Tables { seed: number; as: Record<string, TableRow[]>; fix: Record<string, TableRow[]> }
export interface StoryData {
  show: { name: string; season: number; last: number };
  fix: { each: number; start: number };
  samples: { as: Played; fix: Played }[];
  seasons: Tables[];
}

const WORDS = showWords(null);
const CARDS = ["The game", "The draft", "Each week", "The race", "The merge", "The finale"] as const;
const BAND = ["color-mix(in oklab, var(--foreground) 9%, var(--background))", "color-mix(in oklab, var(--foreground) 19%, var(--background))"];
const fmt = (n: number) => String(Math.round(n * 10) / 10);
const firstName = (n: string) => n.split(" ")[0];
const stageWord = (name: string) => name.split(" · ").at(-1) ?? name;
const byTotal = (t: TableRow[]) => [...t].sort((a, b) => b.total - a.total);
const noop = () => {};

/** The page model the game's own page builds for this view (its title line, its couch), with nothing due: a season played out. */
function modelOf(g: GameView, stages: GameView[], show: string) {
  return pageModel(g, g.page, {
    show,
    words: WORDS,
    next: null,
    when: (iso) => lockTime(Date.parse(iso)),
    move: null,
    line: inShowWords(g.short, WORDS),
    seen: null,
    roles: null,
    twist: null,
    stageGames: stages.map((s) => ({ leagueId: s.leagueId, name: s.name, over: s.over, airsAt: null })),
  });
}

/** One season as the cards read it: the views at its moments, and the few things worked out across them. */
function seasonOf(p: Played, d: StoryData) {
  const moments = ["start", ...Object.keys(p.at).filter((k) => k !== "start").sort((a, b) => Number(a) - Number(b))];
  const end = p.at[moments.at(-1)!];
  const game = end[p.game];
  const stages = p.stages.map((id) => {
    const v = end[id];
    // The stage's own view once its draft is made (the first moment you have a team in it).
    const drafted = moments.map((k) => p.at[k][id]).find((x) => x.you && x.you.team.length > 0) ?? v;
    const draftedAt = Number(moments.find((k) => p.at[k][id] === drafted)) || null;
    return { id, name: stageWord(v.name), from: v.from ?? v.plays.episodes[0], to: v.to ?? d.show.last, end: v, drafted, draftedAt, each: drafted.you?.team.length ?? 0, start: v.you?.weeks[0]?.started.length ?? 0 };
  });
  const eps = Array.from({ length: d.show.last - stages[0].from + 1 }, (_, i) => stages[0].from + i);
  const people = game.table.map((r) => ({ id: r.playerId, userId: r.userId ?? r.playerId, name: r.name, you: r.you, colour: colourOf(r.userId ?? r.playerId) }));
  // Each person's running total: the squares the stages' own season grids hold, added up episode by episode.
  const run: Record<string, number[]> = {};
  for (const pp of people) {
    let t = 0;
    run[pp.id] = eps.map((n) => {
      for (const st of stages) t += st.end.plays.rows[pp.id]?.find((x) => x.episode === n)?.points ?? 0;
      return t;
    });
  }
  const order = byTotal(game.table);
  return { game, model: modelOf(game, stages.map((s) => s.end), d.show.name), stages, eps, people, run, order, you: people.find((x) => x.you) ?? people[0] };
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
    firstLeads: list.filter((t) => byTotal(t[stages[0]])[0].playerId === byTotal(t[game])[0].playerId).length,
  };
}
type Typical = ReturnType<typeof typicalOf>;

// ---- The preview's own small parts ----
/** A slanted caption tag, the app's. */
function Tag({ children, tone = "quiet" }: { children: ReactNode; tone?: "quiet" | "ink" }) {
  return (
    <span className={`type-caption inline-flex h-6 flex-none items-center pl-2 pr-4 text-[13px] tracking-[0.04em] [clip-path:polygon(0_0,100%_0,calc(100%-8px)_100%,0_100%)] ${tone === "ink" ? "bg-foreground text-background" : "bg-secondary text-foreground"}`}>
      {children}
    </span>
  );
}
/** "Typical": a tick for each season played, filled where it happened. */
function Ticks({ n, of, label, check }: { n: number; of: number; label: ReactNode; check?: boolean }) {
  return (
    <div className="flex flex-col gap-2" data-ticks={`${n}/${of}`}>
      <div className="flex items-center gap-2">
        {check && <Tag tone="ink">Check</Tag>}
        <span className="type-caption min-w-0 flex-1 text-[15px] tracking-[0.04em] text-muted-foreground">{label}</span>
        <span className="type-num flex-none text-[22px]">
          {n}
          <span className="text-[13px] text-muted-foreground"> of {of} seasons</span>
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
/** The winner, crowned: their square as the app draws it, their name, the margin. */
function Winner({ x, size }: { x: Season; size: number }) {
  const w = x.people.find((p) => p.id === x.order[0].playerId)!;
  return (
    <div className="flex items-center gap-4">
      <span className="relative mt-5 flex-none">
        <Avatar id={w.userId} name={w.name} size={size} />
        <Crown className="absolute -top-7 left-1/2 size-7 -translate-x-1/2" aria-hidden />
      </span>
      <div className="flex flex-col gap-1">
        <span className="type-caption text-[44px] leading-[0.86]">{w.you ? "You" : w.name}</span>
        <span className="text-[13px] text-muted-foreground">
          win{w.you ? "" : "s"} with <b className="type-num text-[19px] text-foreground">{fmt(x.order[0].total)}</b>, by <b className="type-num text-[19px] text-foreground">{fmt(x.order[0].total - x.order[1].total)}</b>
        </span>
      </div>
    </div>
  );
}

// ---- The cards ----
function SeasonCard({ x, t, toMerge }: { x: Season; t: Typical; toMerge: () => void }) {
  const col = (n: number) => x.eps.indexOf(n) + 1;
  const cols = { gridTemplateColumns: `repeat(${x.eps.length}, minmax(0, 1fr))` };
  const stageAt = (n: number) => x.stages.find((st) => n >= st.from && n <= st.to);
  return (
    <div className="flex flex-col gap-7">
      <div className="grid gap-y-3" style={cols}>
        {x.stages.map((st, i) => (
          <div key={st.id} className="type-caption flex h-10 items-center px-2.5 text-[15px] tracking-[0.04em]" style={{ gridColumn: `${col(st.from)} / ${col(st.to) + 1}`, gridRow: 1, background: BAND[i] }}>
            {st.name}
          </div>
        ))}
        {/* The episodes, the finale crowned (who wins is the last card's). */}
        {x.eps.map((n) => (
          <div key={n} className="flex h-10 items-end gap-1.5 px-2.5" style={{ gridColumn: col(n), gridRow: 2 }}>
            <span className="type-num text-[30px] leading-[0.8]">{n}</span>
            {n === x.eps.at(-1) && <Crown className="mb-0.5 size-5" aria-label="Finale" />}
          </div>
        ))}
        <span className="type-caption px-2.5 pt-3 text-[15px] tracking-[0.04em] text-muted-foreground" style={{ gridColumn: `1 / ${x.eps.length + 1}`, gridRow: 3 }}>
          Your moves
        </span>
        {x.eps.map((n) => (
          <div key={n} className="flex h-7 items-center px-2.5" style={{ gridColumn: col(n), gridRow: 4 }}>
            {x.stages.some((st) => st.from === n) && <Tag tone="ink">Draft</Tag>}
          </div>
        ))}
        {/* Each episode: start so many of your team, as that stage's own weeks have it. */}
        {x.eps.map((n) => {
          const st = stageAt(n);
          return (
            <div key={n} className="grid grid-cols-3 gap-1 px-2.5" style={{ gridColumn: col(n), gridRow: 5, width: "fit-content" }} aria-label={st ? `Start ${st.start} of ${st.each}` : undefined}>
              {Array.from({ length: st?.each ?? 0 }, (_, k) => (
                <span key={k} className="size-3.5 rounded-[2px]" style={{ background: k < (st?.start ?? 0) ? x.you.colour : "color-mix(in oklab, var(--foreground) 22%, transparent)" }} />
              ))}
            </div>
          );
        })}
        {x.stages.map((st) => (
          <span key={st.id} className="px-2.5 text-[13px] text-muted-foreground" style={{ gridColumn: `${col(st.from)} / ${col(st.to) + 1}`, gridRow: 6 }}>
            Start {st.start} of {st.each}
          </span>
        ))}
      </div>
      {t.mergeAll * 2 > t.seasons && (
        <button type="button" data-flag onClick={toMerge} className="nd-press flex h-[52px] items-stretch overflow-hidden rounded-[3px] bg-card text-left outline-1 -outline-offset-1 outline-input">
          <span className="type-caption flex items-center bg-foreground pl-3 pr-5 text-[15px] tracking-[0.04em] text-background [clip-path:polygon(0_0,100%_0,calc(100%-10px)_100%,0_100%)]">Check</span>
          <span className="flex flex-1 items-center px-3 text-[16px] font-semibold">The merge’s teams</span>
          <ChevronRight className="mr-3 size-5 self-center text-muted-foreground" aria-hidden />
        </button>
      )}
    </div>
  );
}

function DraftCard({ x, toWeeks }: { x: Season; toWeeks: () => void }) {
  const first = x.stages[0];
  const others = first.drafted.table.filter((r) => !r.you);
  return (
    <div className="flex flex-col gap-6">
      {/* The game's own Your team, as its page shows it once the draft is made, before any results. */}
      <div className="-mx-4 -mt-8">
        <YourTeam g={first.drafted} words={WORDS} exclusive={false} onFace={noop} onSheet={toWeeks} />
      </div>
      <div className="flex flex-col gap-2.5">
        <span className="type-caption text-[15px] tracking-[0.04em] text-muted-foreground">The couch’s teams</span>
        {others.map((r) => (
          <div key={r.playerId} className="flex items-center gap-3">
            <Avatar id={r.userId ?? r.playerId} name={r.name} size={30} />
            <div className="flex gap-1.5">
              {r.team.map((id) => {
                const c = first.drafted.cast.find((f) => f.id === id);
                return <Face key={id} src={c?.photo ?? null} name={c?.name} className="size-11 rounded-[3px] text-[15px]" />;
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeekCard({ x, t }: { x: Season; t: Typical }) {
  const st = x.stages[0], r = st.end.you;
  // Your season's bench cost (every stage, the game's own bestOf) against the gap to the winner, or to second if you won.
  const cost = x.stages.reduce((sum, s) => sum + (s.end.you?.weeks ?? []).reduce((a, w) => a + bestOf(w).cost, 0), 0);
  const won = x.order[0].playerId === x.you.id;
  const gap = won ? x.order[0].total - x.order[1].total : x.order[0].total - (x.order.find((o) => o.playerId === x.you.id)?.total ?? 0);
  return (
    <div className="flex flex-col gap-6">
      <p className="text-[16px] font-semibold" data-week-line>
        Your bench cost <b className="type-num text-[22px]">{fmt(cost)}</b> · you {won ? "won" : "lost"} by <b className="type-num text-[22px]">{fmt(gap)}</b>
      </p>
      <Ticks n={t.benchDecides} of={t.seasons} label="2nd’s best lineups would have won" />
      {r && r.weeks.length > 0 && (
        <div className="flex flex-col gap-1">
          <Tag>{st.name}</Tag>
          {/* The game's own season for a person: started, the bench dim, what the bench cost each week. */}
          <div className="-mt-3 rounded-[14px] bg-card px-4">
            <PersonSeason g={st.end} r={r} words={WORDS} onMatchup={noop} onFace={noop} />
          </div>
        </div>
      )}
    </div>
  );
}

function RaceCard({ x, t }: { x: Season; t: Typical }) {
  const W = 358, H = 380, L = 22, R = 84, T = 34, B = 34;
  const xs = [x.eps[0] - 1, ...x.eps];
  const all = Object.values(x.run).flat();
  const max = Math.max(1, ...all), min = Math.min(0, ...all);
  const px = (n: number) => L + ((n - xs[0]) / (xs[xs.length - 1] - xs[0])) * (W - L - R);
  const py = (v: number) => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const leader = x.order[0].playerId;
  const ends = x.people.map((p) => ({ p, v: x.run[p.id].at(-1) ?? 0, y: py(x.run[p.id].at(-1) ?? 0) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 26) ends[i].y = ends[i - 1].y + 26;
  // Two lines in colour, you and the winner (and second, if you won); everyone else quiet, so two people's same colour can't tangle.
  const lit = new Set([x.you.id, leader, ...(leader === x.you.id ? [x.order[1].playerId] : [])]);
  const quiet = "color-mix(in oklab, var(--foreground) 34%, transparent)";
  const lineOf = (p: Season["people"][number]) => (lit.has(p.id) ? p.colour : quiet);
  // Where the lead last changed hands: the leader after each episode, and the last episode it differs from the one before.
  const leadAt = x.eps.map((_, i) => [...x.people].sort((a, b) => x.run[b.id][i] - x.run[a.id][i])[0]);
  const flip = leadAt.findLastIndex((p, i) => i > 0 && p.id !== leadAt[i - 1].id);
  const who = (p: Season["people"][number]) => (p.you ? "You" : p.name);
  return (
    <div className="flex flex-col gap-6">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Everyone's running total, episode by episode">
        {x.stages.map((st, i) => {
          const x0 = i ? px(st.from - 0.5) : px(xs[0]), x1 = i < x.stages.length - 1 ? px(x.stages[i + 1].from - 0.5) : px(st.to);
          return (
            <g key={st.id}>
              <rect x={x0} y={T - 26} width={x1 - x0} height={H - B - T + 26} fill={BAND[i]} />
              <text x={x0 + 8} y={T - 9} className="type-caption" fontSize={13} letterSpacing="0.04em" fill="var(--foreground)">
                {st.name.toUpperCase()}
              </text>
            </g>
          );
        })}
        {x.stages.slice(1).map((st) => (
          <line key={st.id} x1={px(st.from - 0.5)} x2={px(st.from - 0.5)} y1={T - 26} y2={H - B} stroke="var(--foreground)" strokeDasharray="3 4" strokeWidth={1.5} />
        ))}
        <line x1={L} x2={W - R} y1={py(0)} y2={py(0)} stroke="color-mix(in oklab, var(--foreground) 30%, transparent)" />
        <text x={4} y={py(0) + 4} className="type-num" fontSize={13} fill="var(--muted-foreground)">
          0
        </text>
        {xs.slice(1).map((n) => (
          <text key={n} x={px(n)} y={H - 10} textAnchor="middle" className="type-num" fontSize={16} fill="var(--muted-foreground)">
            {n}
          </text>
        ))}
        {[...x.people].sort((a, b) => Number(lit.has(a.id)) - Number(lit.has(b.id))).map((p) => (
          <polyline key={p.id} fill="none" stroke={lineOf(p)} strokeWidth={lit.has(p.id) ? 4 : 2} strokeLinejoin="round" strokeLinecap="round" points={[[px(xs[0]), py(0)], ...x.eps.map((n, i) => [px(n), py(x.run[p.id][i])])].map(([a, b]) => `${a},${b}`).join(" ")} />
        ))}
        {/* Each line's end: the person's square as the app colours it (their initial; yours says You), and their total. */}
        {ends.map(({ p, v, y }) => (
          <g key={p.id} transform={`translate(${W - R + 8}, ${y - 12})`}>
            <rect width={p.you ? 34 : 24} height={24} rx={3} fill={lit.has(p.id) ? p.colour : quiet} />
            <text x={p.you ? 17 : 12} y={17} textAnchor="middle" className="type-num" fontSize={p.you ? 12 : 15} fill="#121018">
              {p.you ? "YOU" : p.name.slice(0, 1).toUpperCase()}
            </text>
            <text x={p.you ? 40 : 30} y={18} className="type-num" fontSize={17} fill="var(--foreground)">
              {fmt(v)}
            </text>
          </g>
        ))}
        {flip > 0 && (
          <g data-lead-flip>
            <circle cx={px(x.eps[flip])} cy={py(x.run[leadAt[flip].id][flip])} r={6} fill="var(--background)" stroke="var(--foreground)" strokeWidth={2.5} />
          </g>
        )}
      </svg>
      {flip > 0 && (
        <p className="-mt-3 flex items-center gap-2 text-[16px] font-semibold">
          <span className="size-3 flex-none rounded-full border-[2.5px] border-foreground" aria-hidden />
          {who(leadAt[flip])} take{leadAt[flip].you ? "" : "s"} the lead in {WORDS.episode} {x.eps[flip]}
        </p>
      )}
      <Ticks n={t.firstLeads} of={t.seasons} label={`The ${x.stages[0].name} leader wins`} />
    </div>
  );
}

function MergeCard({ x, asSet, t, fix, setFix, small }: { x: Season; asSet: Season; t: Typical; fix: boolean; setFix: (v: boolean) => void; small: StoryData["fix"] }) {
  const st = x.stages.at(-1)!, v = st.drafted;
  // Columns: everyone still in, in one order (the most-held first in the game as set), so a castaway on every team reads as a full
  // column and the fix redraws the same picture.
  const teamsOf = (g: GameView) => new Map(g.table.map((r) => [r.playerId, r.team]));
  const teams = teamsOf(v), asTeams = teamsOf(asSet.stages.at(-1)!.drafted);
  const heldIn = (m: Map<string, string[]>, id: string) => [...m.values()].filter((tm) => tm.includes(id)).length;
  const cols = v.cast.filter((c) => !c.left).map((c) => c.id).sort((a, b) => heldIn(asTeams, b) - heldIn(asTeams, a) || (a < b ? -1 : 1));
  const every = cols.filter((id) => heldIn(teams, id) === v.table.length);
  const cell = 38, gap = 6, chip = 46;
  const face = (id: string) => v.cast.find((c) => c.id === id);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2.5">
        <div className="relative mt-1 flex flex-col gap-1.5">
          {/* The castaway on every team: one frame down their column, the card's one accent. */}
          {every.map((id) => (
            <span key={id} aria-hidden className="pointer-events-none absolute -bottom-1 -top-1 z-[1] rounded-[4px] outline-[3px] outline-foreground [outline-style:solid]" style={{ left: chip + cols.indexOf(id) * (cell + gap) - 3, width: cell + 6 }} />
          ))}
          {v.table.map((r) => (
            // Your row lit, as the game's own season grid lights it.
            <div key={r.playerId} className={`-mx-2 flex items-center rounded-[3px] px-2 ${r.you ? "bg-secondary" : ""}`} style={{ gap }} aria-label={r.you ? "Your team" : `${r.name}’s team`}>
              <span className="flex-none" style={{ width: chip - gap }}>
                {r.you ? (
                  <span className="type-num grid h-[30px] w-[38px] place-items-center rounded-[3px] text-[12px] text-[#121018]" style={{ background: x.you.colour }}>
                    YOU
                  </span>
                ) : (
                  <Avatar id={r.userId ?? r.playerId} name={r.name} size={30} />
                )}
              </span>
              {cols.map((id) =>
                teams.get(r.playerId)?.includes(id) ? (
                  <Face key={id} src={face(id)?.photo ?? null} name={face(id)?.name} className="flex-none rounded-[3px] text-[15px]" style={{ width: cell, height: cell }} />
                ) : (
                  <span key={id} className="block flex-none rounded-[3px] outline-1 -outline-offset-1 outline-dashed outline-input" style={{ width: cell, height: cell }} />
                ),
              )}
            </div>
          ))}
        </div>
        {every.length > 0 && (
          <p className="text-[16px] font-semibold" data-merge-line>
            {every.map((id) => firstName(face(id)?.name ?? "")).join(" and ")} {every.length > 1 ? "are" : "is"} on every team
          </p>
        )}
      </div>
      <Ticks n={t.mergeAll} of={t.seasons} label="Same castaway on every team" check={t.mergeAll * 2 > t.seasons} />
      <div className="flex flex-col gap-2">
        <div role="radiogroup" aria-label="How many each at the merge" className="grid grid-cols-2 gap-1 rounded-[4px] bg-card p-1 outline-1 -outline-offset-1 outline-input">
          {[false, true].map((on) => (
            <button key={String(on)} type="button" role="radio" aria-checked={fix === on} data-fix={on ? "on" : "off"} onClick={() => setFix(on)} className={`nd-press h-11 rounded-[3px] text-[16px] font-bold ${fix === on ? "bg-foreground text-background" : "text-muted-foreground"}`}>
              {on ? `Try ${small.each} each, start ${small.start}` : `${asSet.stages.at(-1)!.each} each, as set`}
            </button>
          ))}
        </div>
        {fix && (
          <Btn tone="ink" wide data-fix-use>
            Use {small.each} each, start {small.start}
          </Btn>
        )}
      </div>
    </div>
  );
}

function FinaleCard({ x, t }: { x: Season; t: Typical }) {
  const drill = useDrill();
  return (
    <div className="flex flex-col gap-6">
      <Winner x={x} size={64} />
      {/* The game's own overall grid, as its page shows it once the season's over. */}
      <div className="-mx-4 -mt-6">
        <SeasonGrid g={x.game} m={x.model} words={WORDS} due={false} drill={drill} />
      </div>
      <Ticks n={t.close} of={t.seasons} label="A close finish, 3 or less" />
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
  const asSet = useMemo(() => seasonOf(sample.as, data), [sample, data]);
  const x = useMemo(() => (fix ? seasonOf(sample.fix, data) : asSet), [fix, sample, data, asSet]);
  const t = useMemo(() => typicalOf(data, fix), [data, fix]);
  const last = k === CARDS.length - 1;
  const [s1, s2] = [x.stages[0], x.stages.at(-1)!];
  const detail = [
    x.model.title.line,
    `Before ${WORDS.episode} ${s1.from} · ${s1.each} each, before any results`,
    `Start ${s1.start} of your ${s1.each}, every ${WORDS.episode.toLowerCase()}`,
    `Everyone’s points, ${WORDS.episode.toLowerCase()} by ${WORDS.episode.toLowerCase()}`,
    `After ${WORDS.episode} ${s1.to} · ${s2.drafted.cast.filter((c) => !c.left).length} still in · ${s2.each} each`,
    `After the finale, ${WORDS.episode} ${data.show.last}`,
  ][k];
  const go = (n: number) => setK(Math.max(0, Math.min(CARDS.length - 1, n)));
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground" data-preview-story data-card={k + 1}>
      {/* The one authored moment: each card's picture rises in (already mostly visible), none under reduced motion. */}
      <style>{`.nd-story-in{animation:nd-story-in .32s cubic-bezier(.16,1,.3,1) both}@keyframes nd-story-in{from{opacity:.35;transform:translateY(10px)}}@media (prefers-reduced-motion:reduce){.nd-story-in{animation:none}}`}</style>
      <div className="mx-auto flex w-full max-w-[430px] flex-1 flex-col overflow-hidden pt-[env(safe-area-inset-top,0px)]">
        <div className="flex gap-1 px-4 pt-3" aria-hidden>
          {CARDS.map((c, i) => (
            <span key={c} className="h-1 flex-1 rounded-full" style={{ background: i <= k ? "var(--foreground)" : "color-mix(in oklab, var(--foreground) 18%, transparent)" }} />
          ))}
        </div>
        <div className="flex h-14 items-center gap-3 px-4">
          <span className="type-caption inline-flex h-7 flex-none items-center bg-secondary pl-2.5 pr-5 text-[15px] tracking-[0.04em] [clip-path:polygon(0_0,100%_0,calc(100%-9px)_100%,0_100%)]">Made-up season</span>
          <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground" data-trying={fix ? "" : undefined}>
            {fix ? `Trying ${data.fix.each} each at the merge` : x.model.title.name}
          </span>
          <button type="button" aria-label="Close" className="nd-press -mr-2 grid size-11 place-items-center">
            <X className="size-6" />
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto overflow-x-hidden px-4 pb-4 pt-2" key={`${k}-${which}`} data-card-body>
          <div className="flex flex-col gap-1.5">
            <h1 className="type-caption text-[30px] leading-[0.9]">{CARDS[k]}</h1>
            <span className="text-[13px] text-muted-foreground">{detail}</span>
          </div>
          <div className="nd-story-in">
            {k === 0 && <SeasonCard x={x} t={t} toMerge={() => go(4)} />}
            {k === 1 && <DraftCard x={x} toWeeks={() => go(2)} />}
            {k === 2 && <WeekCard x={x} t={t} />}
            {k === 3 && <RaceCard x={x} t={t} />}
            {k === 4 && <MergeCard x={x} asSet={asSet} t={t} fix={fix} setFix={setFix} small={data.fix} />}
            {k === 5 && <FinaleCard x={x} t={t} />}
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 pb-[max(16px,env(safe-area-inset-bottom,0px))] pt-2">
          {last ? (
            <>
              {/* Go back: to the game's setup (the gallery's sheet) once wired; here it stays put. */}
              <Btn tone="optional" className="flex-1" data-go-back>
                Go back
              </Btn>
              <Btn tone="must" className="flex-[1.4]" data-create>
                Create this game
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
              <Btn tone={k === 4 && fix ? "optional" : "ink"} onClick={() => go(k + 1)} className="flex-1" data-next>
                {CARDS[k + 1]}
              </Btn>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
