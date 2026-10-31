"use client";

import { useEffect, useRef } from "react";
import type { GameView, LineupWeek, TableRow } from "../data";
import type { ShowData } from "../screens/show-space";
import { airTime } from "../clock";
import { gameColour, ordinal } from "../games";
import { Btn } from "../ui/parts";
import { SwipePager, type PagerHandle } from "../ui/swipe-pager";
import { faceIn, first, openMoves } from "./moves";
import { Face } from "./parts";

// A Weekly Lineup player's sheet (the 2026-10-30 mock): week by week as bars, the dashed line their average; then the week
// picked: who started, with what each scored that episode and why, and the bench (scored, didn't count), or for the episode
// being set, who's set (lineups stay private until they lock); then the team over the season, what each castaway earned this
// player in how many starts. Weeks move by a swipe (ui/swipe-pager.tsx: the week follows the finger and the bars' highlight with
// it, a flick counts, the ends stretch and spring back), a tap on a bar or the arrow keys; the first time on a device the next
// week peeks in once. Reduced motion: weeks swap with a short fade. Everything comes from the game's own table rows (TableRow.weeks), so a sheet
// shows nothing past your mark.

type Words = ShowData["words"];
type Item = { n: number; w: LineupWeek | null };

const fmt = (n: number) => String(Math.round(n * 10) / 10);
/** A week's points: "+4", "−2", "0". */
export const signed = (n: number) => (n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(-n)}` : "0");

/** Where a player's week placed on the table, by what each week earned: "1", "T2". */
export function weekPlace(g: GameView, playerId: string, episode: number): string {
  const of = (r: TableRow) => r.weeks.find((w) => w.episode === episode)?.total ?? 0;
  const row = g.table.find((r) => r.playerId === playerId);
  const mine = row ? of(row) : 0;
  const tied = g.table.filter((r) => of(r) === mine).length > 1;
  return `${tied ? "T" : ""}${g.table.filter((r) => of(r) > mine).length + 1}`;
}

/** "1st", "Tied 2nd". */
export const placeWords = (rank: string) => (rank.startsWith("T") ? `Tied ${ordinal(Number(rank.slice(1)))}` : ordinal(Number(rank)));

/** The episode lineups are being set for and who's set, while the game goes on and that episode has no results yet. */
export function nextWeek(g: GameView): { episode: number; airsAt: string | null; done: Map<string, boolean> } | null {
  const p = g.progress;
  if (!p || p.label !== "lineups set" || g.over) return null;
  if (p.episode <= (g.table[0]?.weeks.at(-1)?.episode ?? 0)) return null;
  return { episode: p.episode, airsAt: g.lineup?.episode === p.episode ? g.lineup.airsAt : null, done: new Map(p.people.map((x) => [x.playerId, x.done])) };
}

/** The week a sheet opens on when nothing asked for one: the latest with results, else the one being set. */
export function latestWeek(g: GameView, r: TableRow): number | null {
  return r.weeks.at(-1)?.episode ?? nextWeek(g)?.episode ?? null;
}

const PEEK_KEY = "gys.lineup-weeks.peeked";
const BAR = 64;
// The bars' highlight sits behind a column: its left edge is the column's index times one column and one gap (4px).
const pillAt = (i: number, n: number) => `translateX(calc(${Math.max(0, Math.min(n - 1, i))} * (100% + 4px)))`;
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function LineupSheet({ g, r, week, onWeek, words, onClose }: { g: GameView; r: TableRow; week: number | null; onWeek: (episode: number) => void; words: Words; onClose: () => void }) {
  const next = nextWeek(g);
  const items: Item[] = [...r.weeks.map((w) => ({ n: w.episode, w })), ...(next ? [{ n: next.episode, w: null }] : [])];
  const found = items.findIndex((x) => x.n === week);
  const index = found >= 0 ? found : Math.max(0, items.length - (next && items.length > 1 ? 2 : 1));
  const pager = useRef<PagerHandle>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const chart = useRef<HTMLDivElement>(null);

  // Keep the picked bar in view when there are more than fit.
  useEffect(() => {
    const c = chart.current;
    const col = c?.querySelector<HTMLElement>(`[data-week-bar="${index}"]`);
    if (!c || !col || c.scrollWidth <= c.clientWidth) return;
    c.scrollTo({ left: col.offsetLeft - (c.clientWidth - col.offsetWidth) / 2, behavior: reduced() ? "auto" : "smooth" });
  }, [index]);

  if (!items.length) return <p className="pb-2 text-sm text-muted-foreground">No weeks yet. Lineups count from the first {words.episode.toLowerCase()} with results.</p>;

  const totals = r.weeks.map((w) => w.total);
  const max = Math.max(1, ...totals);
  const avg = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
  const best = totals.length ? Math.max(...totals) : 0;
  const many = items.length > 8;
  const colour = gameColour(g.gameName);

  return (
    <div data-lineup-sheet={r.playerId}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="type-caption text-[14px] tracking-[0.02em] text-muted-foreground">Week by week</p>
        {totals.length > 0 && (
          <small data-week-avg className="text-[13px] text-muted-foreground">
            {fmt(avg)} a week · best {signed(best)} ({words.ep} {r.weeks[totals.indexOf(best)].episode})
          </small>
        )}
      </div>
      <div ref={chart} className={`-mx-4 px-4 ${many ? "overflow-x-auto [scrollbar-width:none]" : ""}`}>
        <div className="relative mt-2 grid gap-1" style={{ gridTemplateColumns: many ? `repeat(${items.length}, 42px)` : `repeat(${items.length}, minmax(0, 1fr))`, width: many ? "max-content" : undefined }}>
          <span
            ref={pill}
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 rounded-[3px] bg-secondary"
            style={{ width: many ? 42 : `calc((100% - ${(items.length - 1) * 4}px) / ${items.length})`, transform: pillAt(index, items.length) }}
          />
          {totals.length > 0 && <span aria-hidden className="pointer-events-none absolute inset-x-0 z-[1] border-t border-dashed border-muted-foreground/60" style={{ top: 26 + (BAR - (Math.max(0, avg) / max) * BAR) }} />}
          {items.map((it, i) => {
            const on = i === index;
            const set = !it.w && next ? next.done.get(r.playerId) : undefined;
            return (
              <button
                key={it.n}
                type="button"
                data-week-bar={i}
                aria-pressed={on}
                aria-label={it.w ? `${words.episode} ${it.n}, ${fmt(it.w.total)} points` : `${words.episode} ${it.n}, ${set ? "set" : "not set yet"}`}
                onClick={() => pager.current?.go(i)}
                className="relative flex flex-col items-center py-1.5"
              >
                <span className={`type-num h-4 text-[15px] leading-4 transition-colors duration-200 ${!it.w ? (set ? "text-good" : "text-muted-foreground") : on ? "" : "text-muted-foreground"}`}>
                  {it.w ? fmt(it.w.total) : set ? "Set" : "—"}
                </span>
                <span className="mt-1 flex w-full items-end justify-center" style={{ height: BAR }}>
                  {it.w ? (
                    <span className={`w-6 rounded-t-[2px] transition-colors duration-[260ms] ${on ? "" : "bg-muted-foreground/35"}`} style={{ height: Math.max(3, Math.round((Math.max(0, it.w.total) / max) * BAR)), background: on ? colour : undefined }} />
                  ) : (
                    <span className={`h-[18px] w-6 rounded-t-[2px] border-[1.5px] border-dashed transition-colors duration-[260ms] ${on ? "border-foreground" : "border-muted-foreground/60"}`} />
                  )}
                </span>
                <span className={`mt-1.5 text-[12px] transition-colors duration-200 ${on ? "font-bold" : "text-muted-foreground"}`}>{many ? it.n : `${words.ep} ${it.n}`}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div aria-hidden className="mt-4 border-t border-border" />
      <SwipePager
        ref={pager}
        count={items.length}
        index={index}
        onIndex={(i) => onWeek(items[i].n)}
        page={(i) => <WeekPane g={g} r={r} it={items[i]} next={next} words={words} onClose={onClose} />}
        // The bars' highlight follows the week, finger and all.
        onMove={(at, ms, easing) => {
          const p = pill.current;
          if (!p) return;
          p.style.transition = ms ? `transform ${ms}ms ${easing}` : "none";
          p.style.transform = pillAt(at, items.length);
        }}
        label={`${r.name}'s weeks: swipe, or use the arrow keys`}
        peek={PEEK_KEY}
        className="-mx-4"
        paneClass="px-4 pb-0.5 pt-4"
        attrs={{ "data-weeks": true }}
      />
      <SeasonTeam g={g} r={r} words={words} />
    </div>
  );
}

/** One week: who started and the bench with that episode's points, or for the episode being set, who's set. */
function WeekPane({ g, r, it, next, words, onClose }: { g: GameView; r: TableRow; it: Item; next: ReturnType<typeof nextWeek>; words: Words; onClose: () => void }) {
  const w = it.w;
  const title = `${words.episode} ${it.n}`;
  if (!w) {
    const airs = next?.airsAt ? `Airs ${airTime(Date.parse(next.airsAt))}` : null;
    const set = !!next?.done.get(r.playerId);
    const faces = r.you ? (g.lineup?.starters ?? []) : set ? r.team : r.last;
    const caption = r.you ? "Your lineup" : set ? "Their team" : "Stands in";
    const note = r.you
      ? set
        ? "Yours to change until it airs. Nobody sees it before then."
        : "Not set yet. Until you set one, last week's stands in."
      : set
        ? `${r.name}'s lineup is in. You'll see it with the results.`
        : `No lineup from ${r.name} yet. If nothing changes by airtime, last week's stands in.`;
    return (
      <div data-week-pane={it.n}>
        <h3 className="type-caption text-[26px]">{title}</h3>
        <p className="mt-1 text-[13px] text-muted-foreground">{[set ? "Set" : "Not set yet", airs].filter(Boolean).join(" · ")}</p>
        <p className="mt-3.5 text-[15px] leading-snug">{note}</p>
        {faces.length > 0 && (
          <>
            <p className="type-caption mb-2 mt-4 text-[14px] tracking-[0.02em] text-muted-foreground">{caption}</p>
            <div className="flex flex-wrap gap-2">
              {faces.map((id) => {
                const c = faceIn(g, id);
                return (
                  <span key={id} className="w-[62px]">
                    <Face src={c?.photo ?? null} name={c?.name} draggable={false} out={c?.knocked} className="size-[62px] rounded-[3px] text-2xl" />
                    <small className="type-caption mt-1.5 block truncate text-[14px]">{first(c?.name ?? "")}</small>
                  </span>
                );
              })}
            </div>
          </>
        )}
        {r.you && g.lineup && !g.lineup.locked && (
          <Btn
            wide
            tone={set ? "optional" : "must"}
            className="mt-4"
            onClick={() => {
              onClose();
              openMoves("lineup", g.leagueId);
            }}
          >
            {set ? "Change your lineup" : "Set your lineup"}
          </Btn>
        )}
        <div className="h-2" />
      </div>
    );
  }
  return (
    <div data-week-pane={it.n}>
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="type-caption text-[26px]">{title}</h3>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {placeWords(weekPlace(g, r.playerId, it.n))} of {g.table.length} that week
          </p>
        </div>
        <b className="type-num flex-none text-[34px]">{signed(w.total)}</b>
      </div>
      <p className="type-caption mb-2 mt-[18px] text-[14px] tracking-[0.02em] text-muted-foreground">Started</p>
      {w.started.length === 0 && <p className="text-sm text-muted-foreground">Nobody started this week.</p>}
      <div className="grid grid-cols-3 gap-2">
        {w.started.map((s) => {
          const c = faceIn(g, s.id);
          return (
            <div key={s.id} data-starter={s.id}>
              <Face src={c?.photo ?? null} name={c?.name} draggable={false} className="aspect-square w-full rounded-[3px] text-[30px]" />
              <div className="mt-[7px] flex items-baseline justify-between gap-1.5">
                <b className="type-caption min-w-0 truncate text-[17px]">{first(c?.name ?? "")}</b>
                <b className="type-num flex-none text-[19px]">{signed(s.points)}</b>
              </div>
              {/* What scored most: a rulebook's labels run long ("Voted with the majority (voted for who went home)"). */}
              {s.why.length > 0 && <small className="mt-1 line-clamp-2 text-[12px] leading-[1.3] text-muted-foreground">{s.why[0]}</small>}
            </div>
          );
        })}
      </div>
      {w.predictions !== 0 && <p className="mt-3 text-[13px] text-muted-foreground">{signed(w.predictions)} from predictions</p>}
      {w.bench.length > 0 && (
        <>
          <div className="mb-1 mt-[22px] flex items-baseline justify-between">
            <p className="type-caption text-[14px] tracking-[0.02em] text-muted-foreground">Bench</p>
            <small className="text-[12px] text-muted-foreground">Scored, didn&apos;t count</small>
          </div>
          {w.bench.map((s) => {
            const c = faceIn(g, s.id);
            return (
              <div key={s.id} data-bench={s.id} className="flex min-h-[52px] items-center gap-3 border-t border-border">
                <Face src={c?.photo ?? null} name={c?.name} draggable={false} className="size-9 rounded-[3px] opacity-55 grayscale-[0.5]" />
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-muted-foreground">{c?.name}</span>
                <b className="type-num flex-none text-[20px] text-muted-foreground">{signed(s.points)}</b>
              </div>
            );
          })}
        </>
      )}
      <div className="h-2" />
    </div>
  );
}

/** The team over the season: what each castaway earned this player, in how many starts; anyone who's left the team after them. */
function SeasonTeam({ g, r, words }: { g: GameView; r: TableRow; words: Words }) {
  const firstWeek = r.weeks[0]?.episode ?? null;
  const latest = r.weeks.at(-1)?.episode ?? null;
  const ids = [...new Set([...r.team, ...r.weeks.flatMap((w) => [...w.started, ...w.bench].map((x) => x.id))])];
  const rows = ids.map((id) => {
    const c = faceIn(g, id);
    const starts = r.weeks.filter((w) => w.started.some((s) => s.id === id));
    const earned = starts.reduce((t, w) => t + (w.started.find((s) => s.id === id)?.points ?? 0), 0);
    const on = r.team.includes(id);
    const weeksIn = r.weeks.filter((w) => [...w.started, ...w.bench].some((x) => x.id === id)).map((w) => w.episode);
    const joined = on && firstWeek !== null ? (weeksIn.length ? (weeksIn[0] > firstWeek ? weeksIn[0] : null) : (latest ?? 0) + 1) : null;
    const status = c?.left
      ? `Out${c.out ? ` · ${words.episode} ${c.out}` : ""}`
      : !on
        ? `Swapped out after ${words.ep} ${weeksIn.at(-1)}`
        : joined
          ? `Joined ${words.episode} ${joined}`
          : "Still in";
    const parts = [status, `${starts.length} ${starts.length === 1 ? "start" : "starts"}`, ...(c && !c.left && c.points !== null ? [`${fmt(c.points)} all season`] : [])];
    return { id, c, earned, gone: !on || !!c?.knocked, line: parts.join(" · ") };
  });
  rows.sort((a, b) => Number(a.gone) - Number(b.gone) || b.earned - a.earned || (a.c?.name ?? "").localeCompare(b.c?.name ?? ""));
  if (!rows.length) return null;
  return (
    <>
      <div className="mb-1 mt-[26px] flex items-baseline justify-between">
        <p className="type-caption text-[14px] tracking-[0.02em] text-muted-foreground">The team</p>
        <small className="text-[12px] text-muted-foreground">{r.you ? "Points for you" : `Points for ${r.name}`}</small>
      </div>
      {rows.map(({ id, c, earned, gone, line }) => (
        <div key={id} data-team-row={id} className={`flex min-h-14 items-center gap-3 border-t border-border py-1.5 ${gone ? "opacity-(--nd-dim)" : ""}`}>
          <Face src={c?.photo ?? null} name={c?.name} out={c?.knocked} draggable={false} className="size-10 rounded-[3px]" />
          <span className="min-w-0 flex-1">
            <b className="block truncate text-[15px] font-semibold">{c?.name}</b>
            <small className="block text-[13px] text-muted-foreground">{line}</small>
          </span>
          <b className="type-num text-[22px]">{earned < 0 ? `−${fmt(-earned)}` : fmt(earned)}</b>
        </div>
      ))}
    </>
  );
}
