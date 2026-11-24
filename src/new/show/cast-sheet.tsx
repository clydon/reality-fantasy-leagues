"use client";

import { epName } from "@/lib/game/show-words";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { openSports } from "../sports/sheets";
import { useCouchOthers, usePlayerLog, useSeasonStats, type CastStat, type GameView, type SeasonStats } from "../data";
import { GAME_NAMES } from "@/lib/server/league-season";
import { bioLine, mainValue, propsLine } from "@/lib/cast-props-words";
import { BANDS, bandOf, type Band } from "@/lib/game/moment-bands";
import { gameColour, ordinal } from "../games";
import type { ShowData } from "../screens/show-space";
import { Avatar, Faces } from "../ui/bars";
import { FaceWall, PastSeasons, StoryBody } from "./cast";
import type { Door } from "./game-sheets";
import { AthleteChart, slotWord } from "./game-week";
import { shortWhy, signed } from "./lineup-sheet";
import { castName, first } from "./moves";
import { Face } from "./parts";
import { finishWord, goneHome } from "./finish";
import { statValue } from "./stats";

// The castaway sheet, one part (docs/design-round/drill-person-sheet-spec.md; scored by the show since 2026-11-17:
// drill-person-sheet-scoring-spec.md, -first-view.md, -shape.md): the same sheet from every way in. Who they are; their figures (a
// rulebook's amounts: a gratuity share, a judge's score); each episode's moments in four bands by the show's points for one against
// its rulebook's typical moment (great, good and neutral up from the line, setbacks under it: src/lib/game/moment-bands.ts); In the
// couch's games, every active one they're in, yours or not, the game you came from first and open (their points and place there,
// opening to their points each episode and who holds them); Their numbers, most valuable first, each opening in place to the
// episodes it happened in and the stat's board; their story; Compare with…. The stat's board: everyone ranked on one stat, the
// castaway you came from framed, who holds each in a game, those without it last. These are levels of the one drill (game-sheets.tsx
// DrillSheets), so the crumb and Back work the same way from the Cast tab, a game page, the draft and waivers. An athlete's sheet
// keeps its own parts (sports have their own components).

type Words = ShowData["words"];
type Go = { open: (d: Door) => void };

/** A game's name as people read it: a sports game named by its type key reads by the type's name. */
export const gameName = (g: GameView) => GAME_NAMES[g.gameName] ?? g.gameName;
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const fmt = (n: number) => String(Math.round(n * 10) / 10);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A game that counts people week by week, with results (a lineup, best ball): a lens a person can be counted by. */
export const countsWeekly = (g: GameView) => !!g.castWeeks && g.table.some((r) => r.weeks.length > 0);

/** The lenses for one person: the games above that have them. */
export function lensGamesFor(show: ShowData, name: string): GameView[] {
  return (show.play ?? []).filter((g) => countsWeekly(g) && g.cast.some((c) => same(c.name, name)));
}

/** Where a value ranks among everyone's: its place (one past everyone above) and whether someone shares it. */
export function placeOf(values: number[], v: number): { place: number; tied: boolean } {
  return { place: values.filter((x) => x > v).length + 1, tied: values.filter((x) => x === v).length > 1 };
}
/** "1st", "T2": a rank as the boards write it. */
export const placeWord = (p: { place: number; tied: boolean }) => (p.tied ? `T${p.place}` : ordinal(p.place));

export function SheetCaption({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 mt-5 flex items-baseline justify-between gap-2">
      <p className="type-caption text-[14px] tracking-[0.02em] text-muted-foreground">{children}</p>
      {right && <small className="text-right text-[13px] text-muted-foreground">{right}</small>}
    </div>
  );
}

// ---------- the lens ----------

/** The chosen plate of a switch that isn't a move (Counted by, Who has them in): raised and outlined in bone, never a fill, so it
 *  never outshines the face or what's due (the check, 2026-11-16). */
export const plate = (on: boolean) =>
  `h-11 flex-none whitespace-nowrap rounded-[3px] px-3.5 text-[14px] font-bold outline-1 -outline-offset-1 ${on ? "bg-secondary text-foreground outline-foreground" : "text-muted-foreground outline-edge"}`;

/** "Counted by": The show, then each game that counts people week by week, on one row with its label (no yellow: choosing a lens
 *  isn't due). The Cast tab's numbers and the sheet use the same plates. */
export function LensControl({ games, lens, onLens, own = "The show", label = "Counted by", data = "lens" }: { games: GameView[]; lens: string | null; onLens: (id: string | null) => void; own?: string; label?: string; data?: string }) {
  const opts: [string | null, string][] = [[null, own], ...games.map((g) => [g.leagueId, gameName(g)] as [string, string])];
  // Two plates sit beside their label; more go under it, the row scrolling sideways past the sheet's edge.
  const stack = opts.length > 2;
  return (
    <div className={`mt-4 ${stack ? "" : "flex items-center gap-2.5"}`} {...{ [`data-${data}`]: "" }}>
      <span className={`text-[13px] leading-tight text-muted-foreground ${stack ? "mb-1.5 block" : "flex-none"}`}>{label}</span>
      <div className={`flex min-w-0 gap-1.5 overflow-x-auto py-0.5 [scrollbar-width:none] ${stack ? "-mx-4 px-4" : "-mr-4 pl-0.5 pr-4"}`} role="radiogroup" aria-label={label}>
        {opts.map(([k, name]) => (
          <button key={k ?? "show"} type="button" role="radio" aria-checked={lens === k} {...{ [`data-${data}-option`]: k ?? "show" }} onClick={() => onLens(k)} className={plate(lens === k)}>
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- the season drawn ----------

type Column = { parts: [string, number][]; label: string | null; gone: boolean; below?: string | null };

/** The chart part's columns: a column an episode on a hairline zero, each stacked by kind (signed: a negative hangs under the line),
 *  its total over it, the episode numbers in a row of their own under the lowest bar (the one they left in live red), a bone dot
 *  under the ones that counted for you when not every one did. A column is a door when `onEpisode` is given (their story at that
 *  episode). */
function Columns({ cols, colour, out, counted, words, aria, onEpisode, fixedW, cap = false, h = 104, scale, gap = 2, at = null }: { cols: Column[]; colour: (k: string) => string; out: number | null; counted: number[]; words: Words; aria: string; onEpisode?: (n: number) => void; fixedW?: number; cap?: boolean; h?: number; scale?: { top: number; bot: number }; gap?: number; at?: number | null }) {
  const n = cols.length;
  const pos = cols.map((c) => c.parts.filter(([, v]) => v > 0).reduce((t, [, v]) => t + v, 0));
  const neg = cols.map((c) => c.parts.filter(([, v]) => v < 0).reduce((t, [, v]) => t + v, 0));
  // `scale`: the season's busiest episode, so a quiet castaway's chart looks quiet beside a busy one's (the check, 2026-11-17).
  const top = Math.max(1, scale?.top ?? 1, ...pos), bot = Math.min(0, scale?.bot ?? 0, ...neg);
  // `fixedW`: a column width set from outside (TEMP: the moment grid's dots sit under these columns); `cap`: bars no wider than 24.
  const H = h, PAD = 16, colW = fixedW ?? (n <= 6 ? 52 : n <= 10 ? 34 : 26), W = fixedW ? n * colW : Math.max(n * colW, 120);
  const barW = cap ? Math.min(24, colW >= 26 ? colW - 8 : colW - 4) : colW >= 26 ? colW - 8 : colW - 4;
  const y = (v: number) => PAD + ((top - v) / (top - bot)) * (H - PAD * 2);
  // The numbers sit under the lowest bar and any negative's label below it (a chart's "−0.5" once sat on its "2": 2026-11-15).
  const dots = counted.length > 0 && counted.length < cols.filter((c) => !c.gone).length;
  // Room under the lowest bar for a label only where one hangs there (a column with nothing over the line).
  const under = n <= 14 && cols.some((c, i) => (c.label && neg[i] && !pos[i]) || (c.below && neg[i]));
  const axis = y(bot) + (under ? 28 : 14), tall = axis + (dots ? 12 : 5);
  return (
    <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
      <div className="relative" style={{ width: W, height: tall }}>
        <svg width={W} height={tall} role="img" aria-label={aria} className="block">
          {/* The week the sheet leads with (BACKLOG 251): the raised fill behind its column, as the week strip marks a week. */}
          {at !== null && at >= 1 && at <= n && <rect data-chart-at={at} x={(at - 1) * colW} y={0} width={colW} height={tall} rx={3} fill="var(--secondary)" />}
          <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="var(--edge)" strokeWidth={1} />
          {cols.map((c, i) => {
            const bw = barW, x = i * colW + (colW - bw) / 2;
            let up = 0, down = 0;
            const ep = i + 1;
            return (
              <g key={i}>
                {c.parts.map(([k, v]) => {
                  if (!v) return null;
                  const from = v > 0 ? up : down;
                  const to = from + v;
                  if (v > 0) up = to;
                  else down = to;
                  // A gap of the sheet between kinds (`gap`, 2px), at each segment's far end, so the bar stays on its zero line and two
                  // kinds colour-blind eyes confuse stay apart by more than hue; none where the kinds' colours are already far apart (the
                  // scored sheet: the user, 2026-11-17, "no gap between neutral gray and green").
                  return <rect key={k} x={x} width={bw} y={v > 0 ? y(to) + gap : y(from)} height={Math.max(1, Math.abs(y(to) - y(from)) - gap)} fill={colour(k)} rx={1} />;
                })}
                {c.label && n <= 14 ? (
                  <text x={x + bw / 2} y={neg[i] && !pos[i] ? y(neg[i]) + 12 : y(pos[i]) - 4} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)" className="type-num">
                    {c.label}
                  </text>
                ) : null}
                {c.below && n <= 14 && neg[i] ? (
                  <text x={x + bw / 2} y={y(neg[i]) + 12} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)" className="type-num">
                    {c.below}
                  </text>
                ) : null}
                {c.gone && <circle cx={x + bw / 2} cy={y(0) - 4} r={1.5} fill="var(--muted-foreground)" />}
                {axisShows(ep, colW, out) && (
                  <text
                    x={x + bw / 2}
                    y={axis}
                    textAnchor="middle"
                    fontSize={colW < 18 ? 10 : 11}
                    fontWeight={out === ep || at === ep ? 700 : 400}
                    fill={out === ep ? "var(--live)" : at === ep ? "var(--foreground)" : "var(--muted-foreground)"}
                  >
                    {ep}
                  </text>
                )}
                {dots && counted.includes(ep) && <circle cx={x + bw / 2} cy={axis + 6} r={2} fill="var(--foreground)" />}
              </g>
            );
          })}
        </svg>
        {onEpisode && (
          <div className="absolute inset-0 flex">
            {cols.map((c, i) => (
              <button
                key={i}
                type="button"
                data-chart-episode={i + 1}
                disabled={c.gone}
                aria-label={`${epName(words, i + 1, "long")} in their story`}
                onClick={() => onEpisode(i + 1)}
                className="h-full flex-none rounded-[3px] active:bg-foreground/[0.06] disabled:pointer-events-none"
                style={{ width: colW }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** A game's points for one person each week (castWeeks: the game's own scoring, a maker's points included), as one-colour
 *  columns, episodes 1 to `n`. */
function weekColumns(g: GameView, id: string | null, n: number, out: number | null): Column[] {
  const cw = g.castWeeks;
  const pts = (id && cw?.points[id]) || [];
  return Array.from({ length: n }, (_, i) => {
    const at = cw ? cw.episodes.indexOf(i + 1) : -1;
    const v = at >= 0 ? (pts[at] ?? 0) : 0;
    return { parts: v ? [["total", v]] : [], label: v ? signed(v) : null, gone: out !== null && i + 1 > out };
  });
}

/** The caption over a game's chart: their points so far and where that puts them in the cast ("+7.5 so far · 3rd of 18"). */
function gameHeadline(g: GameView, name: string): string {
  const face = g.cast.find((x) => same(x.name, name));
  const mine = face?.points ?? 0;
  const p = placeOf(g.cast.map((x) => x.points ?? 0), mine);
  return `${signed(mine)} so far · ${placeWord(p)} of ${g.cast.length}`;
}

function ChartHead({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <p className="mb-1 mt-4 flex items-baseline justify-between gap-2">
      <span className="type-caption text-[14px] tracking-[0.02em] text-muted-foreground">{left}</span>
      <span className="text-right text-[13px] text-muted-foreground" data-chart-head>
        {right}
      </span>
    </p>
  );
}

/** A chart's notes under it: its items' keys, the weeks they counted for you, and the episode they left. */
function ChartKey({ items, out, counted, words }: { items: { key: string; name: string; colour: string }[]; out: number | null; counted: "some" | "all" | null; words: Words }) {
  if (!items.length && !out && !counted) return null;
  return (
    <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted-foreground" data-cast-chart-key>
      {items.map((k) => (
        <li key={k.key} className="flex items-center gap-1.5">
          <i className="size-2.5 rounded-[2px]" style={{ background: k.colour }} aria-hidden />
          {k.name}
        </li>
      ))}
      {counted === "some" && (
        <li className="flex items-center gap-1.5">
          <i className="size-1 rounded-full bg-foreground" aria-hidden />
          Counted for you
        </li>
      )}
      {counted === "all" && <li>Counted for you every {words.episode.toLowerCase()}</li>}
      {out !== null && (
        <li className="text-live">
          {epName(words, out, "tag")}: went home
        </li>
      )}
    </ul>
  );
}

/** Whether an axis prints this episode's number at that width: all of them from 18px, else every other, else every fifth (and the
 *  first); the one they left in always, its neighbours not (two numbers would touch). */
const axisShows = (ep: number, colW: number, out: number | null) => {
  const every = colW < 14 ? 5 : colW < 18 ? 2 : 1;
  if (every === 1 || ep === out) return true;
  return (ep === 1 || ep % every === 0) && (out === null || Math.abs(ep - out) > 1);
};

/** A kind's points for one: the rulebook's (the stats' `points`), else what its moments scored most often, per unit. */
export function worthOf(d: SeasonStats, key: string): number {
  const s = d.stats.find((x) => x.key === key);
  if (typeof s?.points === "number") return s.points;
  const seen = new Map<number, number>();
  for (const c of d.cast) {
    for (const [, k, p, u] of c.events) {
      if (k !== key) continue;
      const v = Math.round((p / (u || 1)) * 100) / 100;
      seen.set(v, (seen.get(v) ?? 0) + 1);
    }
  }
  return [...seen].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
}

/** An episode's column fitted to the sheet (`span`, its own width: 358 at 390): every season spans the sheet, the same rail for every
 *  chart and strip, and thirty episodes fit without scrolling. */
const fitW = (n: number, span: number) => Math.max(10, span / Math.max(1, n));

/** A kind's worth: "+2 each", "−0.5 each", "No points". */
const worthWords = (v: number) => (v ? `${signed(v)} each` : "No points");

/** An amount as a figure: thousands grouped, one decimal at most. */
const amountWord = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 1 });

// ---------- the bands ----------

const BAND_WORDS: Record<Band, string> = { great: "Great", good: "Good", neutral: "Neutral", setback: "Setbacks" };
/** A column's stack (the user, 2026-11-17): setbacks under the line, then up from it neutral, good, and great on top; the key reads
 *  it top to bottom (BANDS). */
const STACK: Band[] = ["neutral", "good", "great", "setback"];
const BAND_ONE: Record<Band, [string, string]> = { great: ["great moment", "great moments"], good: ["good moment", "good moments"], neutral: ["neutral moment", "neutral moments"], setback: ["setback", "setbacks"] };
/** "2 neutral moments, 1 setback": an episode's bands for a screen reader. */
const bandSaid = (m: Map<Band, number>) => BANDS.filter((k) => m.get(k)).map((k) => `${m.get(k)} ${BAND_ONE[k][m.get(k) === 1 ? 0 : 1]}`).join(", ");
/** A band's colour (new.css): the deeper green for great, a lighter green for good, a quiet grey, Ember (never Live Red: losing
 *  points isn't leaving, DESIGN.md). */
export const bandColour = (k: Band) => `var(--nd-band-${k})`;
/** Every kind's band, against its rulebook's typical moment (amounts have none: they're figures, not moments). */
const bandsOf = (d: SeasonStats) => new Map(d.stats.filter((s) => s.key !== "points" && !s.amount).map((s) => [s.key, bandOf(worthOf(d, s.key), d.typical)]));
/** Each kind's band colour, for the story's moments. */
export const bandColours = (d: SeasonStats) => new Map([...bandsOf(d)].map(([k, v]) => [k, bandColour(v)]));

/** A stat's colour on its board's bars and its rows elsewhere (the stats page, Tonight's Stats card): its band's; an amount Bone. */
export function statColour(d: SeasonStats, key: string): string {
  if (key === "points") return "var(--foreground)";
  return d.stats.find((s) => s.key === key)?.amount ? "var(--nd-amount)" : bandColour(bandOf(worthOf(d, key), d.typical));
}

/** A band's mark: a piece of the chart's bar (never the group's square), leading the key's items, a numbers row and a moment in
 *  the story. */
function BandMark({ k, className = "" }: { k: Band; className?: string }) {
  return <i className={`inline-block h-3 w-1 flex-none rounded-[1px] ${className}`} style={{ background: bandColour(k) }} aria-hidden />;
}

/** The season's busiest episode, moments over the line and under it, for every castaway's chart to share one scale. */
function seasonScale(d: SeasonStats, bands: Map<string, Band>) {
  let top = 1, bot = 0;
  for (const x of d.cast) {
    const up = new Map<number, number>(), down = new Map<number, number>();
    for (const [ep, k, , u] of x.events) {
      const at = bands.get(k);
      if (!at) continue;
      const m = at === "setback" ? down : up;
      m.set(ep, (m.get(ep) ?? 0) + (u || 1));
    }
    for (const v of up.values()) top = Math.max(top, v);
    for (const v of down.values()) bot = Math.min(bot, -v);
  }
  return { top, bot };
}

/**
 * Each episode: a column an episode, fitted to the sheet (thirty fit at 390), its moments counted in their bands (neutral from the
 * line up, then good, great on top; setbacks hanging under it), on the season's busiest episode so a quiet castaway looks quiet; the count
 * over the line over each column (to 14 episodes); one key of the four bands, the same words on every sheet. A column opens that
 * episode in their story. It stops at the viewer's mark (the stats are cut there).
 */
export function SeasonChart({ d, c, words, onEpisode, span, at = null }: { d: SeasonStats; c: CastStat; words: Words; onEpisode?: (n: number) => void; span: number; at?: number | null }) {
  const n = d.through;
  if (!n) return null;
  const bands = bandsOf(d);
  const said: string[] = [];
  const cols: Column[] = Array.from({ length: n }, (_, i) => {
    const m = new Map<Band, number>();
    for (const [ep, k, , u] of c.events) {
      const at = bands.get(k);
      if (ep === i + 1 && at) m.set(at, (m.get(at) ?? 0) + (u || 1));
    }
    const parts = STACK.filter((k) => m.get(k)).map((k) => [k, k === "setback" ? -m.get(k)! : m.get(k)!] as [string, number]);
    const over = BANDS.reduce((t, k) => t + (k === "setback" ? 0 : (m.get(k) ?? 0)), 0);
    const gone = c.out !== null && i + 1 > c.out;
    said.push(`${epName(words, i + 1, "short")}: ${gone ? "out" : bandSaid(m) || "nothing"}`);
    // The count over the bar is what's over the line; a setback's bar, on the season's scale, says its own.
    return { parts, label: over ? String(over) : null, gone };
  });
  const moments = c.events.filter(([, k]) => bands.has(k)).reduce((t, [, , , u]) => t + (u || 1), 0);
  return (
    <section data-cast-chart data-moments-chart data-chart-lens="show">
      <ChartHead left={`Each ${words.episode.toLowerCase()}`} right={`${moments} ${moments === 1 ? "moment" : "moments"} so far`} />
      {!cols.some((x) => x.parts.length) ? (
        <p className="text-[14px] text-muted-foreground">Nothing recorded for {c.first} yet.</p>
      ) : (
        <>
          <Columns cols={cols} colour={(k) => bandColour(k as Band)} out={goneHome(c) ? c.out : null} counted={[]} words={words} aria={`What ${c.first} did each ${words.episode.toLowerCase()}, by the show's points: ${said.join("; ")}`} onEpisode={onEpisode} fixedW={fitW(n, span)} cap scale={seasonScale(d, bands)} gap={0} at={at} />
          <ul className="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[13px] text-muted-foreground" data-cast-chart-key data-band-key>
            {BANDS.map((k) => (
              <li key={k} className="flex items-center gap-1.5">
                <BandMark k={k} />
                {BAND_WORDS[k]}
              </li>
            ))}
            {goneHome(c) && (
              <li className="text-live">
                {epName(words, c.out!, "tag")}: went home
              </li>
            )}
            {c.finish && c.out !== null && (
              <li className={c.finish === "won" ? "text-(--nd-good)" : ""} data-finish={c.finish}>
                {epName(words, c.out, "tag")}: {finishWord(c)}
              </li>
            )}
          </ul>
        </>
      )}
    </section>
  );
}

/** Their figures, on a show with amounts (a gratuity share, a judge's score): a row each, the total, its place in the cast, the
 *  moment's name, and its amount each episode as thin bars on the chart's own columns; › opens its board. */
function Figures({ d, c, go, words, span }: { d: SeasonStats; c: CastStat; go: Go; words: Words; span: number }) {
  const amounts = d.stats.filter((s) => s.amount && statValue(c, s.key) > 0);
  const n = d.through;
  if (!amounts.length || !n) return null;
  const colW = fitW(n, span);
  const bw = Math.min(24, colW >= 26 ? colW - 8 : colW - 4);
  return (
    <section className="mt-4" data-figures>
      {amounts.map((s) => {
        const v = statValue(c, s.key);
        const p = placeOf(d.cast.map((x) => statValue(x, s.key)), v);
        const per = Array.from({ length: n }, (_, i) => c.events.filter((e) => e[1] === s.key && e[0] === i + 1).reduce((t, e) => t + (e[3] || 0), 0));
        // On the season's scale: the most anyone had in one episode.
        const top = Math.max(1, ...d.cast.map((x) => Math.max(0, ...Array.from({ length: n }, (_, i) => x.events.filter((e) => e[1] === s.key && e[0] === i + 1).reduce((t, e) => t + (e[3] || 0), 0)))));
        return (
          <button key={s.key} type="button" data-figure={s.key} onClick={() => go.open({ kind: "stat", key: s.key, title: s.name, from: c.name, lens: null })} className="nd-press block w-full border-t border-border py-2.5 text-left">
            <span className="flex items-center gap-3">
              <span className="min-w-0 flex-1">
                <b className="type-num block text-[22px] leading-none">{amountWord(v)}</b>
                <small className="mt-1 line-clamp-2 text-[13px] leading-snug text-muted-foreground">{s.name}</small>
              </span>
              <small className="flex-none text-[13px] text-muted-foreground" data-figure-place>
                {placeWord(p)} of {d.cast.length}
              </small>
              <ChevronRight className="size-4 flex-none text-muted-foreground" aria-hidden />
            </span>
            <svg width={n * colW} height={27} className="mt-2 block" role="img" aria-label={`${s.name} each ${words.episode.toLowerCase()}: ${per.map((x, i) => `${epName(words, i + 1, "short")}, ${amountWord(x)}`).join("; ")}`}>
              <line x1={0} x2={n * colW} y1={26.5} y2={26.5} stroke="var(--edge)" strokeWidth={1} />
              {per.map((x, i) => {
                if (!x || (c.out !== null && i + 1 > c.out)) return null;
                const h = Math.max(2, (x / top) * 24);
                return <rect key={i} x={i * colW + (colW - bw) / 2} y={26 - h} width={bw} height={h} rx={1} fill="var(--nd-amount)" />;
              })}
            </svg>
          </button>
        );
      })}
    </section>
  );
}

/** A game row open on the scored sheet: their points there each episode on the season chart's own columns, shorter, in the game's
 *  colour, a dot under the weeks they counted for you when only some did. */
function GameWeeks({ g, id, n, out, words, name, span, onEpisode, at = null }: { g: GameView; id: string; n: number; out: number | null; words: Words; name: string; span: number; onEpisode?: (n: number) => void; at?: number | null }) {
  if (!g.castWeeks || !n) return null;
  const cols = weekColumns(g, id, n, out);
  if (!cols.some((x) => x.parts.length)) return null;
  const counted = g.you?.weeks.filter((w) => w.started.some((x) => x.id === id)).map((w) => w.episode) ?? [];
  // On the game's whole cast's scale, as the season chart is on the season's.
  const all = Object.values(g.castWeeks.points).flat().filter((v): v is number => typeof v === "number");
  return (
    <div className="pb-1" data-game-weeks={g.leagueId}>
      <Columns cols={cols} colour={() => gameColour(g.gameName)} out={out} counted={counted} words={words} aria={`${first(name)}'s points in ${gameName(g)} each ${words.episode.toLowerCase()}`} onEpisode={onEpisode} fixedW={fitW(n, span)} cap h={72} scale={{ top: Math.max(1, ...all), bot: Math.min(0, ...all) }} at={at} />
      <ChartKey items={[]} out={null} counted={countedWord(counted, cols)} words={words} />
    </div>
  );
}

/** A numbers row, open: the season's episodes on the chart's own columns, a dot in each it happened (a count in it where more than
 *  one), a tick where it didn't, nothing after they left, the episode numbers under; then the stat's board. */
function KindStrip({ c, k, n, band, name, of, span, onBoard, onEpisode, words }: { words: Words; c: CastStat; k: string; n: number; band: Band; name: string; of: number; span: number; onBoard: () => void; onEpisode?: (n: number) => void }) {
  const colW = fitW(n, span);
  const colour = bandColour(band);
  const per = Array.from({ length: n }, (_, i) => c.events.filter((e) => e[1] === k && e[0] === i + 1).reduce((t, e) => t + (e[3] || 1), 0));
  const small = colW < 14;
  const said = per.map((x, i) => (x ? `episode ${i + 1}${x > 1 ? ` (${x})` : ""}` : null)).filter(Boolean).join(", ");
  return (
    <div data-kind-strip={k}>
      <div className="relative" style={{ width: n * colW }}>
      <svg width={n * colW} height={36} className="block" role="img" aria-label={`${name}: ${said || "none"}`}>
        {per.map((x, i) => {
          const cx = i * colW + colW / 2;
          const ep = i + 1;
          const gone = c.out !== null && ep > c.out;
          const r = small ? 3.5 : 4;
          return (
            <g key={i}>
              {!gone && x === 0 && <rect x={cx - 1} y={11} width={2} height={2} rx={1} fill="var(--edge)" opacity={0.55} />}
              {!gone && x === 1 && <circle cx={cx} cy={12} r={r} fill={colour} />}
              {!gone && x > 1 && (
                <>
                  <circle cx={cx} cy={12} r={small ? r : 8} fill={colour} />
                  {!small && (
                    <text x={cx} y={16} textAnchor="middle" fontSize={11} fontWeight={800} fill={band === "neutral" ? "var(--foreground)" : "var(--card)"} className="type-num">
                      {x}
                    </text>
                  )}
                </>
              )}
              {axisShows(ep, colW, c.out) && (
                <text x={cx} y={33} textAnchor="middle" fontSize={colW < 18 ? 10 : 11} fontWeight={c.out === ep && goneHome(c) ? 700 : 400} fill={c.out === ep && goneHome(c) ? "var(--live)" : "var(--muted-foreground)"}>
                  {ep}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {/* Each episode opens that episode of their story, as the season chart's columns do (the drill pass, 2026-11-17). */}
      {onEpisode && (
        <div className="absolute inset-0 flex">
          {per.map((x, i) => (
            <button
              key={i}
              type="button"
              data-strip-episode={i + 1}
              disabled={c.out !== null && i + 1 > c.out}
              aria-label={`${epName(words, i + 1)} in their story${x ? `: ${name}${x > 1 ? ` (${x})` : ""}` : ""}`}
              onClick={() => onEpisode(i + 1)}
              className="h-full flex-none rounded-[3px] active:bg-foreground/[0.06] disabled:pointer-events-none"
              style={{ width: colW }}
            />
          ))}
        </div>
      )}
      </div>
      {/* Inside the opened row, at the names' indent and in their weight, so it doesn't read as the next row. */}
      <button type="button" data-stat-door={k} onClick={onBoard} className="nd-press flex h-11 w-full items-center justify-between gap-3 pl-3 text-left text-[14px]">
        See all {of}
        <ChevronRight className="size-4 flex-none text-muted-foreground" aria-hidden />
      </button>
    </div>
  );
}

// ---------- their numbers ----------

/** Their numbers: each kind they have, most valuable first (the show's points for one; a tie, more of it first), a row each: its
 *  band's mark, the name and its worth, the count and its place in the cast; ⌄ opens in place the episodes it happened in, then the
 *  stat's board (several can be open, to set two side by side). */
function NumbersRows({ d, c, lens, go, span, onEpisode, words }: { words: Words; d: SeasonStats; c: CastStat; lens: GameView | null; go: Go; span: number; onEpisode?: (n: number) => void }) {
  const [open, setOpen] = useState<string[]>([]);
  const bands = bandsOf(d);
  const rows = d.stats
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => bands.has(s.key) && statValue(c, s.key) > 0)
    .map(({ s, i }) => ({ s, i, worth: worthOf(d, s.key), ...standing(d, c, s.key) }))
    .sort((p, q) => q.worth - p.worth || q.v - p.v || p.i - q.i);
  if (!rows.length) return null;
  return (
    <section data-their-numbers>
      <SheetCaption right="By the show's points">Their numbers</SheetCaption>
      {rows.map(({ s, worth, v, place, tied }) => {
        const on = open.includes(s.key);
        const k = bands.get(s.key)!;
        return (
          <div key={s.key} className="border-t border-border" data-number-row={s.key}>
            <button type="button" aria-expanded={on} data-stat-open={s.key} onClick={() => setOpen((o) => (on ? o.filter((x) => x !== s.key) : [...o, s.key]))} className="nd-press flex min-h-14 w-full items-center gap-3 py-2 text-left">
              <span className="grid min-w-0 flex-1 grid-cols-[4px_minmax(0,1fr)] gap-x-2">
                <BandMark k={k} className="mt-[4px]" />
                <span className="text-[14px] leading-snug">
                  <span className="sr-only">{BAND_ONE[k][0]}: </span>
                  {s.name}
                </span>
                <small className="col-start-2 mt-0.5 text-[13px] leading-tight text-muted-foreground" data-worth>
                  {worthWords(worth)}
                </small>
              </span>
              <span className="flex flex-none flex-col items-end">
                <b className="type-num text-[20px] leading-none">{v}</b>
                <small className="mt-1 text-[13px] leading-tight text-muted-foreground" data-rank>
                  {placeWord({ place, tied: tied > 0 })} of {d.cast.length}
                </small>
              </span>
              <ChevronDown className={`size-4 flex-none text-muted-foreground ${on ? "rotate-180" : ""}`} aria-hidden />
            </button>
            {on && <KindStrip words={words} c={c} k={s.key} n={d.through} band={k} name={s.name} of={d.cast.length} span={span} onBoard={() => go.open({ kind: "stat", key: s.key, title: s.name, from: c.name, lens: lens?.leagueId ?? null })} onEpisode={onEpisode} />}
          </div>
        );
      })}
    </section>
  );
}

/** Whether the counted-for-you mark says something: some weeks (dots), every week (said once), none. */
const countedWord = (counted: number[], cols: Column[]): "some" | "all" | null => (!counted.length ? null : counted.length >= cols.filter((c) => !c.gone).length ? "all" : "some");

// ---------- in your games ----------

type GameLine = { g: GameView; id: string; line: string; marks: { userId: string; name: string; you?: boolean }[]; points: number | null };

/** Where someone stands in each of these games: who holds or picked them, by face, yours first; their points there. */
export function gamesFor(list: GameView[], name: string, words: Parameters<typeof epName>[0] = { episode: "Episode", ep: "Ep" }): GameLine[] {
  const out: GameLine[] = [];
  for (const g of list) {
    const c = g.cast.find((x) => same(x.name, name));
    if (!c) continue;
    const holders = g.table.filter((r) => r.team.includes(c.id));
    const pickers = g.plays?.kind === "pick" ? g.table.filter((r) => (g.plays.rows[r.playerId] ?? []).some((s) => s.pick?.id === c.id)) : [];
    const who = holders.length ? holders : pickers;
    const others = who.filter((r) => !r.you).map((r) => first(r.name));
    const you = who.some((r) => r.you);
    const list = others.length > 1 ? `${others.slice(0, -1).join(", ")} and ${others.at(-1)}` : (others[0] ?? "");
    // Short enough to sit beside the faces at 390: the faces say who, the words say how many past two.
    const seats = g.table.filter((r) => !(g.solo === "public" && !r.you)).length;
    const line = holders.length
      ? holders.length > 1 && holders.length === seats
        ? "On every team"
        : you
          ? others.length > 1
            ? `On your team and ${others.length} more`
            : `On your team${list ? ` and ${list}'s` : ""}`
          : others.length > 2
            ? `On ${others.length} teams`
            : `On ${list}'s ${others.length > 1 ? "teams" : "team"}`
      : pickers.length
        ? `Picked by ${[you ? "you" : "", others.length > 2 ? `${others.length} more` : list].filter(Boolean).join(" and ")} · ${epName(words, Math.max(...pickers.flatMap((r) => (g.plays.rows[r.playerId] ?? []).filter((s) => s.pick?.id === c.id).map((s) => s.episode))), "tag")}`
        : c.left
          ? "Out"
          : "On nobody's team";
    const marks = [...who].sort((p, q) => Number(q.you) - Number(p.you)).map((r) => ({ userId: r.userId ?? r.playerId, name: r.name, you: r.you }));
    out.push({ g, id: c.id, line, marks, points: c.points });
  }
  return out;
}

/** Who holds or picked them in one game, each a row opening that person's sheet in that game. */
function holderRows(g: GameView, id: string, words: Words) {
  const c = g.cast.find((x) => x.id === id);
  const rows: { playerId: string; userId: string; name: string; you: boolean; line: string; points: number | null }[] = [];
  for (const r of g.table.filter((x) => !(g.solo === "public" && !x.you))) {
    const picked = (g.plays.rows[r.playerId] ?? []).filter((s) => s.pick?.id === id);
    const base = { playerId: r.playerId, userId: r.userId ?? r.playerId, name: r.you ? "You" : r.name, you: r.you };
    if (picked.length) {
      rows.push({ ...base, line: `Picked ${castName(c, g)} for ${picked.map((s) => `${epName(words, s.episode, "short")}`).join(", ")}`, points: null });
      continue;
    }
    const starts = r.weeks.filter((w) => w.started.some((x) => x.id === id));
    if (r.team.includes(id) || starts.length) {
      const earned = starts.reduce((t, w) => t + (w.started.find((x) => x.id === id)?.points ?? 0), 0);
      const eps = starts.length === 1 ? words.episode.toLowerCase() : `${words.episode.toLowerCase()}s`;
      rows.push({ ...base, line: starts.length ? `Counted for ${r.you ? "you" : r.name} in ${starts.length} ${eps}` : `On ${r.you ? "your" : `${r.name}'s`} team`, points: starts.length ? earned : null });
    }
  }
  return rows.sort((p, q) => Number(q.you) - Number(p.you));
}

/** The games they're in, a row each, opening in place to who holds them (one line says who, so a game everyone shares costs one row,
 *  not four); the game the sheet was opened from (`from`) first and open, and a row opened by a tap scrolls into view. A castaway's
 *  sheet (`scored`) lists every active game on the couch, yours or not (the user, 2026-11-17: a game over by your mark or archived
 *  drops off, the one you came from stays), each with their points there and their place in its cast, opening to their points each
 *  episode on the season chart's columns; an athlete's lists your games. */
export function GamesRows({ show, seasonId, name, go, from = null, scored = false, n = 0, out = null, span = 358, onEpisode, at = null }: { show: ShowData; seasonId?: string; name: string; go: Go; from?: string | null; scored?: boolean; n?: number; out?: number | null; span?: number; onEpisode?: (n: number) => void; at?: number | null }) {
  const [open, setOpen] = useState<string | null>(from);
  const box = useRef<HTMLElement>(null);
  const tapped = useRef(false);
  // The couch's other games, read only for a castaway's sheet (a game you don't play, at your own mark).
  const others = useCouchOthers(seasonId ?? "", scored && seasonId ? (show.couch?.id ?? null) : null).data?.games;
  useEffect(() => {
    if (!tapped.current || !open) return;
    const el = box.current?.querySelector<HTMLElement>(`[data-game-holders="${open}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: reduced() ? "auto" : "smooth" });
  }, [open]);
  const w = show.words;
  const mine = show.play ?? [];
  const active = (g: GameView) => !scored || g.leagueId === from || (!g.over && !g.archived);
  const games = gamesFor([...mine, ...(others ?? []).filter((g) => !mine.some((x) => x.leagueId === g.leagueId))].filter(active), name, w).sort(
    (p, q) => Number(q.g.leagueId === from) - Number(p.g.leagueId === from)
  );
  if (!games.length) return null;
  // Two games of one kind on the couch (two Weekly Lineups) each say their own name too.
  const named = (g: GameView) => (games.filter((x) => gameName(x.g) === gameName(g)).length > 1 && g.name && g.name !== gameName(g) ? `${gameName(g)} · ${g.name}` : gameName(g));
  return (
    <section ref={box} data-in-your-games>
      <SheetCaption right={games.some((x) => x.points !== null) ? "Points there" : undefined}>{scored && show.couch ? "In the couch's games" : "In your games"}</SheetCaption>
      {games.map(({ g, id, line, marks, points }) => {
        const on = open === g.leagueId;
        const rows = on ? holderRows(g, id, w) : [];
        // A castaway's row: their points there, signed, and where that places them in that game's cast.
        const place = scored && points !== null ? `${placeWord(placeOf(g.cast.map((x) => x.points ?? 0), points))} of ${g.cast.length}` : null;
        return (
          <div key={g.leagueId} className="border-t border-border" data-person-game={g.leagueId}>
            <button
              type="button"
              aria-expanded={on}
              data-game-row={g.leagueId}
              onClick={() => {
                tapped.current = true;
                setOpen(on ? null : g.leagueId);
              }}
              className="nd-press flex min-h-14 w-full items-center gap-3 py-1.5 text-left"
            >
              {scored ? (
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <b className="min-w-0 truncate text-[15px] font-semibold">{named(g)}</b>
                    {points !== null && (
                      <b className="type-num flex-none text-[20px] leading-none" data-game-points>
                        {signed(points)}
                      </b>
                    )}
                  </span>
                  <span className="mt-1 flex min-w-0 items-center gap-1.5">
                    {marks.length > 0 && <Faces marks={marks} size={18} max={4} ground="var(--card)" />}
                    <small className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">{line}</small>
                    {place && (
                      <small className="flex-none text-[13px] text-muted-foreground" data-game-place>
                        {place}
                      </small>
                    )}
                  </span>
                </span>
              ) : (
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[15px] font-semibold">{gameName(g)}</b>
                  <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
                    {marks.length > 0 && <Faces marks={marks} size={18} max={4} ground="var(--card)" />}
                    <small className="min-w-0 truncate text-[13px] text-muted-foreground">{line}</small>
                  </span>
                </span>
              )}
              {!scored && points !== null && <b className="type-num flex-none text-[20px]">{fmt(points)}</b>}
              <ChevronDown className={`size-4 flex-none text-muted-foreground ${on ? "rotate-180" : ""}`} aria-hidden />
            </button>
            {on && (
              <div className={`pb-1.5 ${scored ? "" : "pl-3"}`} data-game-holders={g.leagueId}>
                {scored && <GameWeeks g={g} id={id} n={n} out={out} words={w} name={name} span={span} onEpisode={onEpisode} at={g.leagueId === from ? at : null} />}
                {rows.length === 0 && <p className={`py-2 text-[13px] text-muted-foreground ${scored ? "pl-3" : ""}`}>Nobody here holds or has picked {first(name)} so far.</p>}
                {rows.map((r) => (
                  <button key={r.playerId} type="button" data-door-person={r.playerId} onClick={() => go.open({ kind: "person", playerId: r.playerId, episode: null, game: g.leagueId })} className={`nd-press flex min-h-[52px] w-full items-center gap-3 border-t border-border py-1.5 text-left ${scored ? "pl-3" : ""}`}>
                    <Avatar id={r.userId} name={r.name} size={28} />
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[15px] font-semibold">{r.name}</b>
                      <small className="block truncate text-[13px] text-muted-foreground">{r.line}</small>
                    </span>
                    {r.points !== null && <b className="type-num flex-none text-[20px]">{signed(r.points)}</b>}
                    <ChevronRight className="size-4 flex-none text-muted-foreground" aria-hidden />
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

/** A stat's place among the cast, for a row: the count, where it ranks, the most anyone has and the middle of the cast. */
function standing(d: SeasonStats, c: CastStat, key: string) {
  const v = statValue(c, key);
  const all = d.cast.map((x) => statValue(x, key)).sort((p, q) => p - q);
  return { v, place: all.filter((x) => x > v).length + 1, tied: all.filter((x) => x === v).length - 1, max: all.at(-1) ?? 0, mid: all[Math.floor(all.length / 2)] ?? 0 };
}

// ---------- the sheet ----------

/** Who they are, the same from every way in (the user, 2026-11-16: the bio, what they hold and their properties belong on this
 *  view): the photo; the group and what the show sorts them by (its properties in its own words, a sport's position); who they are
 *  as billed (hometown, age, job); still in or out; what they hold now (chunk 6b: the thing itself, plain words, never good or
 *  bad); the billing's line about them. */
function Who({ d, c, words, onNight }: { d: SeasonStats; c: CastStat; words: Words; onNight?: (n: number) => void }) {
  const colour = d.groups.find((g) => g.name === c.group)?.colour ?? null;
  const status =
    c.finish === "won"
      ? `${finishWord(c)} · ${epName(words, c.out!, "tag")}`
      : c.finish === "final"
        ? `Finalist · ${epName(words, c.out!, "tag")}${c.how && c.how !== "Finalist" ? ` · ${cap(c.how.toLowerCase())}` : ""}`
        : c.out !== null
          ? `Out · ${epName(words, c.out, "tag")}${c.how ? ` · ${cap(c.how.toLowerCase())}` : ""}`
          : "Still in";
  const statusInk = `text-[15px] font-semibold ${c.finish === "won" ? "text-(--nd-good)" : ""}`;
  const what = propsLine(c.props, d.properties) || c.position || null;
  const bio = bioLine(c.bio);
  return (
    <div data-who>
      <div className="mt-2 flex gap-3">
        <Face src={c.photo} name={c.first} out={goneHome(c)} className="h-[96px] w-[76px] flex-none rounded-[3px]" />
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
          {(what || c.group) && (
            <p className="flex items-center gap-1.5 text-[14px] text-muted-foreground" data-person-group>
              {c.group && colour && <i className="size-2.5 flex-none rounded-[2px]" style={{ background: colour }} aria-hidden />}
              <span className="min-w-0">{[c.group, what].filter(Boolean).join(" · ")}</span>
            </p>
          )}
          {bio && (
            <p className="text-[14px] leading-snug text-muted-foreground" data-person-bio>
              {bio}
            </p>
          )}
          {/* Before anything's counted everyone's still in: said only once there's a season to be in. */}
          {(c.out !== null || d.through > 0) &&
            (c.out !== null && onNight ? (
              // The night they left (or won): who else, what happened (the drill pass, 2026-11-17).
              <button type="button" data-status data-night-door={c.out} onClick={() => onNight(c.out!)} className={`nd-press -my-2.5 flex items-center gap-0.5 self-start py-2.5 text-left ${statusInk}`}>
                {status}
                <ChevronRight className="size-4 flex-none text-muted-foreground" aria-hidden />
              </button>
            ) : (
              <p className={statusInk} data-status>
                {status}
              </p>
            ))}
          {c.start && c.group && c.start !== c.group && <p className="text-[13px] text-muted-foreground">Started on {c.start}</p>}
          {d.roles && (
            <p className="text-[13px] text-muted-foreground" data-role>
              {c.role ? (
                <>
                  <b className="text-foreground">{c.role}</b>, revealed when they left
                </>
              ) : (
                "Their role stays secret until they leave"
              )}
            </p>
          )}
        </div>
      </div>
      {!!c.holds?.length && (
        <div className="mt-3 flex flex-col gap-1" data-person-holds>
          {c.holds.map((h) => (
            <p key={h} className="text-[15px] leading-snug">
              {h}
            </p>
          ))}
        </div>
      )}
      {c.bio?.line && <BioLine line={c.bio.line} />}
    </div>
  );
}

/** The billing's line about them: two lines, the rest a tap away in place. */
function BioLine({ line }: { line: string }) {
  const [all, setAll] = useState(false);
  return (
    <button type="button" aria-expanded={all} onClick={() => setAll((x) => !x)} className="mt-3 block w-full text-left" data-person-line>
      <span className={`text-[14px] leading-snug text-muted-foreground ${all ? "block" : "line-clamp-2"}`}>{line}</span>
    </button>
  );
}

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- the week they were opened from (BACKLOG 251) ----------

/** A door's week: the game, the episode, and whose lineup they were in then (none: Everyone in this game, a compare). */
export type WeekCtx = { g: GameView; episode: number; holder: string | null };

type WeekRow = { name: string; points: number; n: number; band: Band | null; factor?: boolean };

/** Their week in that game, as the week block reads it, or null where the game doesn't score people week by week or has no results
 *  for that episode at the viewer's mark. The rows add up to `total`: the moments at the game's scoring, then each factor (a captain,
 *  the episode's window) as the points it added, then anything else the game's rules changed. */
function weekOf(w: WeekCtx, d: SeasonStats, c: CastStat) {
  const g = w.g;
  const cw = g.castWeeks;
  if (!cw || !countsWeekly(g)) return null;
  const face = g.cast.find((x) => same(x.name, c.name));
  const i = cw.episodes.indexOf(w.episode);
  if (!face || i < 0) return null;
  const bands = bandsOf(d);
  // Each moment by its key, named as the rest of this sheet names it (Their numbers, their story: the show's words, which can differ
  // from the game's: the check, 2026-11-22), the game's own words (their aside dropped) where the show has none; its band the same way.
  const named = (l: number) => {
    const key = cw.moments!.keys?.[l] ?? "";
    return { key, name: d.stats.find((s) => s.key === key)?.name ?? shortWhy(cw.moments!.labels[l] ?? "") };
  };
  const moments = cw.moments ? (cw.moments.of[face.id]?.[i] ?? []).map(([l, p, n]) => ({ ...named(l), points: p, n })) : [];
  const raw = cw.points[face.id]?.[i] ?? 0;
  const scoring: WeekRow[] = moments.filter((m) => m.points !== 0).sort((a, b) => b.points - a.points).map((m) => ({ name: m.name, points: m.points, n: m.n, band: bands.get(m.key) ?? null }));
  const unscored = moments.filter((m) => m.points === 0).map((m) => m.name);
  const r = w.holder ? (g.table.find((x) => x.playerId === w.holder) ?? null) : null;
  const hw = r?.weeks.find((x) => x.episode === w.episode) ?? null;
  const started = hw?.started.find((x) => x.id === face.id) ?? null;
  const benched = hw?.bench.find((x) => x.id === face.id) ?? null;
  const times = cw.times?.[i] ?? 1;
  const captain = started && hw?.captain?.id === face.id ? hw.captain.times : 1;
  const factors: WeekRow[] = [];
  // Whose captain: the doubling is the holder's, not the castaway's (their own points are what the game's row below shows).
  if (captain !== 1) factors.push({ name: `${r!.you ? "Your" : `${r!.name}'s`} captain ×${fmt(captain)}`, points: round(raw * (captain - 1)), n: 1, band: null, factor: true });
  if (times !== 1) factors.push({ name: times === 2 ? "Double points this episode" : `Points ×${fmt(times)} this episode`, points: round(raw * captain * (times - 1)), n: 1, band: null, factor: true });
  const line = started ?? benched;
  const total = line ? line.points : round(raw * times);
  const rest = round(total - raw * captain * times);
  if (Math.abs(rest) >= 0.01) factors.push({ name: "Changed by this game's rules", points: rest, n: 1, band: null, factor: true });
  const counted: "started" | "bench" | "off" | null = !r ? null : started ? "started" : benched ? "bench" : "off";
  // Before any factor, their own points that week (a receipt's subtotal): the number the game's row below marks.
  const own: WeekRow | null = factors.length ? { name: "Their own points", points: raw, n: 1, band: null, factor: true } : null;
  return { g, r, total, scoring, factors, own, unscored, counted, nothing: moments.length === 0, best: cw.best ?? null, out: c.out !== null && w.episode > c.out, left: c.out === w.episode, steps: cw.episodes.filter((e) => c.out === null || e <= c.out) };
}

const round = (n: number) => Math.round(n * 100) / 100;

/** The line under the week's title: "Weekly Lineup · Started for ahaskell", "Weekly Lineup · On your bench: scored, didn't count";
 *  with nobody's lineup to read, "Their points in Weekly Lineup". */
function countedWords(x: NonNullable<ReturnType<typeof weekOf>>): string {
  const r = x.r;
  if (!r || !x.counted) return `Their points in ${gameName(x.g)}`;
  return `${gameName(x.g)} · ${howCounted(x, r)}`;
}

function howCounted(x: NonNullable<ReturnType<typeof weekOf>>, r: NonNullable<NonNullable<ReturnType<typeof weekOf>>["r"]>): string {
  const who = r.you ? "you" : r.name;
  const whose = r.you ? "your" : `${r.name}'s`;
  if (x.counted === "off") return `Not on ${whose} team that week`;
  if (x.best) return x.counted === "started" ? `Counted for ${who}: one of ${r.you ? "your" : "their"} best ${x.best}` : `Not in ${whose} best ${x.best}: didn't count`;
  // (A 0 on the bench scored nothing: it only didn't count. The check, 2026-11-22.)
  return x.counted === "started" ? `Started for ${who}` : x.total === 0 ? `On ${whose} bench: didn't count` : `On ${whose} bench: scored, didn't count`;
}

/** One row of the week: the moment's band mark (a factor has none), its name and how many, its points in the column under the total. */
function WeekLine({ row, quiet, rule = false }: { row: WeekRow; quiet: boolean; rule?: boolean }) {
  return (
    <div data-week-moment={row.factor ? "factor" : row.name} className={`flex min-h-9 items-center gap-2.5 text-[14px] leading-snug ${rule ? "border-t border-dashed border-edge" : ""}`}>
      {row.band ? <BandMark k={row.band} /> : <i className="w-1 flex-none" aria-hidden />}
      <span className={`min-w-0 flex-1 ${quiet ? "text-muted-foreground" : ""}`}>
        {row.band && <span className="sr-only">{BAND_ONE[row.band][0]}: </span>}
        {row.name}
        {row.n > 1 && <span className="text-muted-foreground"> ×{row.n}</span>}
      </span>
      <b className={`type-num flex-none text-[17px] ${quiet || row.points < 0 ? "text-muted-foreground" : ""}`}>{signed(row.points)}</b>
    </div>
  );
}

const FOLD = 5;

/**
 * The week a door handed the sheet, first (docs/design-round/week-door-spec.md, -first-view.md, -shape.md): the episode (a door to
 * the night) with the game and how it counted for whose lineup under it, their total for it at the right in the week's own form;
 * then the moments that scored, each with its points in one column that adds up to the total, and each factor as a row; the moments
 * this game gives nothing for in one muted line; ‹ › to their other weeks at the foot. A bench week is in muted ink.
 */
function WeekBlock({ x, c, episode, words, onNight, onWeek }: { x: NonNullable<ReturnType<typeof weekOf>>; c: CastStat; episode: number; words: Words; onNight: (n: number) => void; onWeek?: (n: number) => void }) {
  const [all, setAll] = useState(false);
  // A new week (‹ ›): the fold closes and the rows cross-fade; never on the sheet's first paint (state kept from the last render, as
  // React keeps a previous prop).
  const [shown, setShown] = useState(episode);
  const [swapped, setSwapped] = useState(false);
  if (shown !== episode) {
    setShown(episode);
    setSwapped(true);
    setAll(false);
  }
  const quiet = x.counted === "bench" || x.counted === "off";
  const rows = all ? x.scoring : x.scoring.slice(0, FOLD);
  const at = x.steps.indexOf(episode);
  const prev = at > 0 ? x.steps[at - 1] : null;
  const next = at >= 0 && at < x.steps.length - 1 ? x.steps[at + 1] : null;
  return (
    <section data-week-block={episode} data-week-counted={x.counted ?? "none"} className="mt-3 border-b border-border pb-1.5">
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="type-caption text-[26px]">
            <button type="button" data-week-night={episode} aria-label={`${epName(words, episode, "long")}: the night`} onClick={() => onNight(episode)} className="-my-2 inline-flex min-h-11 items-center text-left underline decoration-edge decoration-2 underline-offset-[5px]">
              {epName(words, episode, "long")}
            </button>
          </h3>
          <p className="mt-1 text-[13px] text-muted-foreground" data-week-line>
            {countedWords(x)}
          </p>
        </div>
        <b data-week-total={x.total} className={`type-num flex-none text-[34px] leading-none ${quiet || x.total === 0 ? "text-muted-foreground" : ""}`}>
          {signed(x.total)}
        </b>
      </div>
      <div key={episode} className={`mt-2 ${swapped ? "motion-safe:animate-[nd-fade-in_160ms_ease-out_both]" : ""}`}>
        {x.out ? (
          <p className="flex min-h-9 items-center pl-3.5 text-[14px] text-muted-foreground">Already out</p>
        ) : (
          <>
            {/* Nothing at all, as their story says it; or moments this game gives nothing for (named in the line below). */}
            {x.scoring.length === 0 && <p className="flex min-h-9 items-center pl-3.5 text-[14px] text-muted-foreground" data-week-nothing>{x.nothing ? "Nothing recorded" : "Nothing that scores in this game"}</p>}
            {rows.map((row, i) => (
              <WeekLine key={`${row.name}-${i}`} row={row} quiet={quiet} />
            ))}
            {!all && x.scoring.length > FOLD && (
              <button type="button" data-week-more onClick={() => setAll(true)} className="inline-flex min-h-11 items-center pl-3.5 text-[14px] font-semibold">
                {x.scoring.length - FOLD} more
              </button>
            )}
            {x.own && <WeekLine row={x.own} quiet={quiet} rule />}
            {x.factors.map((row) => (
              <WeekLine key={row.name} row={row} quiet={quiet} />
            ))}
            {x.left && <p className={`flex min-h-9 items-center pl-3.5 text-[14px] ${c.finish === "won" ? "text-(--nd-good)" : c.finish ? "" : "text-live"}`} data-week-left>{c.how ?? "Left the game"}</p>}
            {x.unscored.length > 0 && (
              <p className="mt-1 pl-3.5 text-[13px] leading-snug text-muted-foreground" data-week-unscored>
                {x.scoring.length ? "Also: " : "What they did: "}
                {x.unscored.join(", ")} (no points in this game)
              </p>
            )}
          </>
        )}
      </div>
      {onWeek && (prev !== null || next !== null) && (
        <div className="mt-1 flex items-center justify-between" data-week-steps>
          {prev !== null ? (
            <button type="button" data-week-prev={prev} aria-label={`Previous week: ${epName(words, prev, "long")}`} onClick={() => onWeek(prev)} className="-ml-1 inline-flex min-h-11 items-center gap-0.5 px-1 text-[13px] font-semibold text-muted-foreground">
              <ChevronLeft className="size-4" aria-hidden />
              {epName(words, prev, "tag")}
            </button>
          ) : (
            <span />
          )}
          {next !== null && (
            <button type="button" data-week-next={next} aria-label={`Next week: ${epName(words, next, "long")}`} onClick={() => onWeek(next)} className="-mr-1 inline-flex min-h-11 items-center gap-0.5 px-1 text-[13px] font-semibold text-muted-foreground">
              {epName(words, next, "tag")}
              <ChevronRight className="size-4" aria-hidden />
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/** The castaway's sheet, one part: who; their figures; each episode in its bands; In the couch's games; Their numbers; their story;
 *  Compare with…. `lens`: the game it was opened from, for the stat's board's holders. `week`: the week a door handed it (BACKLOG
 *  251), which it leads with when that game scores people week by week; `onWeek` steps it to another week in place. */
export function CastSheet({ d, c, show, seasonId, lens, go, onFlag, from = null, episode = null, week = null, onWeek }: { d: SeasonStats; c: CastStat; show: ShowData; seasonId: string; lens: GameView | null; go: Go; onFlag?: ((episode: number, who: string) => void) | null; from?: string | null; episode?: number | null; week?: WeekCtx | null; onWeek?: (n: number) => void }) {
  const w = show.words;
  const wk = week ? weekOf(week, d, c) : null;
  const leads = wk ? week!.episode : null;
  const ref = useRef<HTMLDivElement>(null);
  const [lit, setLit] = useState<number | null>(null);
  // Opened at an episode (a number in a game's table, a week in a compare): that episode in their story, as a chart column
  // opens it, once the sheet has risen.
  useEffect(() => {
    // (A week the sheet leads with is already in view: nothing to scroll to.)
    if (episode == null || leads !== null) return;
    const t = setTimeout(() => {
      const el = ref.current?.querySelector<HTMLElement>(`[data-story-ep="${episode}"]`);
      if (!el) return;
      el.scrollIntoView({ block: "start", behavior: reduced() ? "auto" : "smooth" });
      if (!reduced()) setLit(episode);
    }, 420);
    return () => clearTimeout(t);
  }, [episode, leads]);
  // The sheet's own width, for every chart and strip on it to share one rail (358 at 390; less on a narrower phone).
  const [span, setSpan] = useState(358);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setSpan(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (lit === null) return;
    const t = setTimeout(() => setLit(null), 1700);
    return () => clearTimeout(t);
  }, [lit]);
  // A column: that episode in their story, scrolled to the sheet's top, a raised fill fading on it (opacity only; none when
  // motion is reduced, the scroll still happens).
  const toStory = (n: number) => {
    const el = ref.current?.querySelector<HTMLElement>(`[data-story-ep="${n}"]`);
    if (!el) return;
    el.scrollIntoView({ block: "start", behavior: reduced() ? "auto" : "smooth" });
    setLit(null);
    if (!reduced()) requestAnimationFrame(() => setLit(n));
  };
  return (
    <div ref={ref} className="pb-2" data-person={c.first} data-cast-sheet={c.name}>
      {wk && <WeekBlock x={wk} c={c} episode={leads!} words={w} onNight={(n) => go.open({ kind: "night", episode: n })} onWeek={onWeek} />}
      <Who d={d} c={c} words={w} onNight={(n) => go.open({ kind: "night", episode: n })} />
      <Figures d={d} c={c} go={go} words={w} span={span} />
      <SeasonChart d={d} c={c} words={w} onEpisode={toStory} span={span} />
      <GamesRows key={c.name} show={show} seasonId={seasonId} name={c.name} go={go} from={from} scored n={d.through} out={goneHome(c) ? c.out : null} span={span} onEpisode={toStory} at={leads} />
      <NumbersRows d={d} c={c} lens={lens} go={go} span={span} onEpisode={toStory} words={w} />
      <SheetCaption right="Newest first">Their story</SheetCaption>
      <StoryBody d={d} c={c} onFlag={onFlag ?? null} onEpisode={(n) => go.open({ kind: "night", episode: n })} group={false} photo={false} points={false} lit={lit} marks={bandColours(d)} />
      {/* Nothing to compare before anything's counted (a draft before the premiere). */}
      {d.through > 0 && (
        <button type="button" data-compare-with onClick={() => go.open({ kind: "pick", name: c.name, lens: lens?.leagueId ?? null })} className="nd-press mt-4 flex h-12 w-full items-center justify-center rounded-[6px] text-[15px] font-bold outline-1 -outline-offset-1 outline-edge">
          Compare {c.first} with…
        </button>
      )}
    </div>
  );
}

/** The sheet's body by name, its stats read here (the draft room's and waivers' sheets, whose foot carries Draft or Swap). */
export function CastSheetBody({ seasonId, show, name, go }: { seasonId: string; show: ShowData; name: string; go: Go }) {
  const d = useSeasonStats(seasonId, show.couch?.id ?? null).data;
  const c = d?.cast.find((x) => same(x.name, name));
  if (!d) return <div aria-busy className="mt-3 h-40 animate-pulse rounded-[3px] bg-background" />;
  if (!c) return <p className="mt-3 text-[14px] text-muted-foreground">Nothing recorded for them yet.</p>;
  return <CastSheet d={d} c={c} show={show} seasonId={seasonId} lens={null} go={go} />;
}

// ---------- an athlete ----------

export type Athlete = { name: string; role: string | null; photoUrl: string | null; team: string; line: string | null };

/** An athlete's sheet in the same order: who (the headshot in the same frame, team · position, the season's line), Counted by over
 *  Game by game (or the game's points), In your games, this season's games, past seasons. */
export function AthleteSheet({ seasonId, show, p, lens, lenses, onLens, go, from = null }: { seasonId: string; show: ShowData; p: Athlete; lens: GameView | null; lenses: GameView[]; onLens: (id: string | null) => void; go: Go; from?: string | null }) {
  const log = usePlayerLog(seasonId, p.name, true, p.team || null);
  const w = show.words;
  const face = lens ? (lens.cast.find((x) => same(x.name, p.name)) ?? null) : null;
  const n = lens ? Math.max(0, ...(lens.castWeeks?.episodes ?? [])) : 0;
  const cols = lens && n ? weekColumns(lens, face?.id ?? null, n, null) : [];
  const counted = lens && face ? (lens.you?.weeks.filter((x) => x.started.some((s) => s.id === face.id)).map((x) => x.episode) ?? []) : [];
  return (
    <div className="pb-2" data-athlete-sheet={p.name}>
      <div className="mt-2 flex gap-3" data-who>
        <Face src={p.photoUrl} name={p.name} className="h-[96px] w-[76px] flex-none rounded-[3px] bg-card" />
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
          <p className="text-[14px] text-muted-foreground">{[p.team, p.role ? slotWord(p.role.toUpperCase()) : null].filter(Boolean).join(" · ")}</p>
          {p.line && <p className="text-[15px] font-semibold">{p.line}</p>}
        </div>
      </div>
      {lenses.length > 0 && <LensControl games={lenses} lens={lens?.leagueId ?? null} onLens={onLens} own="Box scores" />}
      {lens ? (
        <section data-cast-chart data-chart-lens={lens.leagueId}>
          <ChartHead left={`Each ${w.episode.toLowerCase()}`} right={gameHeadline(lens, p.name)} />
          {cols.some((x) => x.parts.length) ? (
            <>
              <Columns cols={cols} colour={() => gameColour(lens.gameName)} out={null} counted={counted} words={w} aria={`${p.name}'s points in ${gameName(lens)}`} />
              <ChartKey items={[]} out={null} counted={countedWord(counted, cols)} words={w} />
            </>
          ) : (
            <p className="text-[14px] text-muted-foreground">Nothing scored for {p.name} in {gameName(lens)} yet.</p>
          )}
        </section>
      ) : log.data?.games.length ? (
        <AthleteChart games={log.data.games} words={w} />
      ) : null}
      <GamesRows key={p.name} show={show} name={p.name} go={go} from={from} />
      {/* Before this season has a game of theirs, what they did before it comes first (the draft's question). */}
      {!log.isPending && !log.data?.games.length && <PastSeasons seasonId={seasonId} name={p.name} team={p.team || null} />}
      <SheetCaption right="Newest first">This season</SheetCaption>
      {log.isPending ? (
        <div aria-busy className="h-24 animate-pulse rounded-[3px] bg-background" />
      ) : log.data?.games.length ? (
        <div data-game-log>
          {log.data.games.map((x) => {
            const body = (
              <>
                <p className="flex items-baseline justify-between gap-2 text-[14px] font-semibold">
                  <span className="truncate">
                    {w.ep} {x.episode}
                    {x.opponent ? ` · ${x.opponent}` : ""}
                  </span>
                  {x.at && <small className="flex-none text-[12px] font-normal text-muted-foreground">{new Date(x.at).toLocaleDateString([], { month: "short", day: "numeric" })}</small>}
                </p>
                <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{x.items.length ? x.items.map((i) => `${i.value} ${i.label}`).join(" · ") : "Played, no stats in the box score"}</p>
              </>
            );
            const game = x.game;
            // The game itself: its sheet, the score behind Hide scores (the drill pass, 2026-11-17).
            return game ? (
              <button key={x.episode} type="button" data-log-game={x.episode} data-game-door={game.id} onClick={() => openSports({ kind: "game", league: game.league, team: game.team, game: game.id })} className="nd-press flex w-full items-center gap-2 border-t border-border py-2 text-left">
                <span className="min-w-0 flex-1">{body}</span>
                <ChevronRight className="size-4 flex-none text-muted-foreground" aria-hidden />
              </button>
            ) : (
              <div key={x.episode} className="border-t border-border py-2" data-log-game={x.episode}>
                {body}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No games of theirs you&apos;ve seen yet.</p>
      )}
      {log.data?.newer && <p className="mt-2 text-[13px] text-muted-foreground">A later game&rsquo;s line is in: it shows once you&rsquo;ve seen that game.</p>}
      {!!log.data?.games.length && <PastSeasons seasonId={seasonId} name={p.name} team={p.team || null} />}
    </div>
  );
}

/** The athlete's sheet with its lens kept while it's open (the draft room's and waivers' sheets). */
export function AthleteSheetBody({ seasonId, show, p, go }: { seasonId: string; show: ShowData; p: Athlete; go: Go }) {
  const [lensId, setLensId] = useState<string | null>(null);
  const lenses = lensGamesFor(show, p.name);
  return <AthleteSheet seasonId={seasonId} show={show} p={p} lens={lenses.find((g) => g.leagueId === lensId) ?? null} lenses={lenses} onLens={setLensId} go={go} />;
}

// ---------- a stat's board ----------

/** A board's row (the stat's board, the stats page, Tonight's Stats card): place, face, the name with a bar under it on one
 *  scale, the count; in a game's lens who holds them; a chevron when it opens. `from`: the castaway you came from, framed (not the
 *  raised fill: that's yours). */
export function BoardRow({ c, v, place, max, colour, from, holders, onTap, small, what = null, shown }: { c: CastStat; v: number; place: string | null; max: number; colour: string; from?: boolean; holders?: ReactNode; onTap?: () => void; small?: boolean; what?: string | null; shown?: (v: number) => string }) {
  const out = goneHome(c);
  // How they're placed beside their name: out, how they finished, else what the show sorts them by.
  const said = out ? `Out · Ep ${c.out}` : finishWord(c);
  const body = (
    <>
      {place !== null && <span className={`type-num flex-none text-muted-foreground ${small ? "w-5 text-[15px]" : "w-7 text-[17px]"}`}>{place}</span>}
      <Face src={c.photo} name={c.first} out={out} className={`flex-none rounded-[3px] ${small ? "size-[30px]" : "size-8"}`} />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <b className={`truncate text-[15px] ${from ? "font-bold" : "font-semibold"} ${out ? "text-muted-foreground" : ""}`}>{c.first}</b>
          {!small && (said || what || c.position) && <small className="flex-none text-[13px] text-muted-foreground">{said ?? what ?? c.position}</small>}
        </span>
        {small && said && <small className="block text-[11px] text-muted-foreground">{said}</small>}
        {v > 0 && (
          <span className="mt-1 block h-1" aria-hidden>
            <i className="block h-1 rounded-[1px]" style={{ width: `${Math.max(4, (v / Math.max(1, max)) * 100)}%`, background: colour }} />
          </span>
        )}
      </span>
      <b className={`type-num flex-none text-right ${small ? "text-[17px]" : `${shown ? "min-w-7" : "w-7"} text-[20px]`} ${v ? "" : "text-muted-foreground"}`} aria-label={v ? undefined : "none"}>
        {v ? (shown ? shown(v) : v) : "·"}
      </b>
      {holders}
      {onTap && <ChevronRight className="size-4 flex-none text-muted-foreground" aria-hidden />}
    </>
  );
  const cls = `flex items-center gap-2.5 border-t border-border text-left ${small ? "min-h-11" : "min-h-[52px]"} ${from ? "-mx-1.5 w-[calc(100%+12px)] rounded-[3px] px-1.5 outline-1 -outline-offset-1 outline-foreground" : "w-full"}`;
  return onTap ? (
    <button type="button" data-stat-row={c.first} data-from={from || undefined} onClick={onTap} className={`nd-press ${cls}`} data-board-row={c.first}>
      {body}
    </button>
  ) : (
    <div data-stat-row={c.first} data-board-row={c.first} className={cls}>
      {body}
    </div>
  );
}

/** A game with one owner each: no castaway on two teams (the game view carries no ownership flag; the teams say it). */
const oneOwner = (g: GameView) => !g.cast.some((c) => g.table.filter((r) => r.team.includes(c.id)).length > 1);

/** Who holds one castaway in a game, for a board's row: their faces, yours first and ringed; nobody, Free in a game with one owner
 *  each (in a shared game nobody's is nothing to say). */
function HoldersMark({ g, name, free }: { g: GameView; name: string; free: boolean }) {
  const c = g.cast.find((x) => same(x.name, name));
  if (!c) return <span className="w-[60px] flex-none" />;
  const hs = g.table.filter((r) => r.team.includes(c.id)).sort((p, q) => Number(q.you) - Number(p.you));
  return (
    <span className="flex w-[60px] flex-none justify-end" data-holders={hs.length}>
      {hs.length ? <Faces marks={hs.map((r) => ({ userId: r.userId ?? r.playerId, name: r.name, you: r.you }))} size={20} max={3} ground="var(--card)" /> : <small className="text-[13px] text-muted-foreground">{c.left || !free ? "" : "Free"}</small>}
    </span>
  );
}

/** The stat's board: everyone with it, most first (place, T for a tie), the castaway you came from framed and in view; then
 *  everyone without it (a grid of faces when they outnumber the rest); who holds each in the game chosen at its head (`holds`,
 *  every game you play that has teams). Every row and face opens that castaway's sheet over the board. */
export function StatBoard({ d, statKey, from, lens, games = [], onLens, onCast, foot }: { d: SeasonStats; statKey: string; from: string | null; lens: GameView | null; games?: GameView[]; onLens?: (id: string | null) => void; onCast: (name: string) => void; foot?: ReactNode }) {
  const rows = d.cast.map((c) => ({ c, v: statValue(c, statKey) }));
  const values = rows.map((r) => r.v);
  const max = Math.max(1, ...values);
  const tidy = (p: (typeof rows)[number], q: (typeof rows)[number]) => q.v - p.v || Number(goneHome(p.c)) - Number(goneHome(q.c)) || p.c.first.localeCompare(q.c.first);
  const have = rows.filter((r) => r.v > 0).sort(tidy);
  const none = rows.filter((r) => !r.v).sort(tidy);
  const colour = statColour(d, statKey);
  const shown = d.stats.find((s) => s.key === statKey)?.amount ? amountWord : undefined;
  const mark = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Opens with the castaway you came from in view.
    const t = setTimeout(() => mark.current?.querySelector("[data-from]")?.scrollIntoView({ block: "nearest" }), 420);
    return () => clearTimeout(t);
  }, []);
  const free = lens ? oneOwner(lens) : false;
  const row = (r: (typeof rows)[number], place: string | null) => (
    <BoardRow key={r.c.name} c={r.c} v={r.v} place={place} max={max} colour={colour} what={mainValue(r.c.props, d.properties)} from={!!from && same(r.c.name, from)} holders={lens ? <HoldersMark g={lens} name={r.c.name} free={free} /> : undefined} onTap={() => onCast(r.c.name)} shown={shown} />
  );
  // Everyone without it stays on the board (who never did is part of the answer); a grid of faces once they outnumber the rest, so a
  // rare stat's board isn't a column of nothing (the check, 2026-11-16).
  const grid = none.length > have.length;
  return (
    <div ref={mark} className="pb-2" data-stat-board={statKey}>
      {onLens && games.length > 0 && <LensControl games={games} lens={lens?.leagueId ?? null} onLens={onLens} own="Nobody" label="Who has them in" data="holds" />}
      <div className="mt-3">
        {have.length === 0 && <p className="mt-2 text-[14px] text-muted-foreground">Nobody has this yet, up to here.</p>}
        {have.map((r) => row(r, placeWord(placeOf(values.filter((x) => x > 0), r.v))))}
        {none.length > 0 && have.length > 0 && <p className="mb-2 mt-5 text-[13px] text-muted-foreground">{have.length === 1 ? `Nobody else so far` : "None so far"}</p>}
        {have.length > 0 && !grid && none.map((r) => row(r, null))}
        {have.length > 0 && grid && (
          <div className="grid grid-cols-6 gap-x-1.5 gap-y-2" data-none-grid>
            {none.map((r) => (
              <button key={r.c.name} type="button" data-stat-row={r.c.first} onClick={() => onCast(r.c.name)} className="nd-press min-w-0 text-left" aria-label={`${r.c.name}: none${goneHome(r.c) ? `, out in episode ${r.c.out}` : ""}`}>
                <Face src={r.c.photo} name={r.c.first} out={goneHome(r.c)} className={`aspect-square w-full rounded-[3px] ${goneHome(r.c) ? "opacity-60" : ""}`} />
                <span className={`type-caption mt-0.5 block truncate text-[12px] leading-tight ${goneHome(r.c) ? "text-muted-foreground" : ""}`}>{r.c.first}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {foot}
    </div>
  );
}

/** Compare with…: the face wall in a sheet, the castaway you came from marked; a face opens the two side by side. */
export function ComparePick({ d, from, onPick }: { d: SeasonStats; from: string; onPick: (name: string) => void }) {
  return (
    <div className="pb-3 pt-1" data-compare-pick>
      <FaceWall d={d} people={d.cast} onTap={(c) => c.name !== from && onPick(c.name)} picking={from} />
    </div>
  );
}
