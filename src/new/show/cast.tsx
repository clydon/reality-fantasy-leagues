"use client";

import { startTransition, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, Ellipsis, Search, Users, Zap } from "lucide-react";
import { useAthleteHistory, useRoster, useSeasonStats, useFill, type CastStat, type GameView, type PastSeason, type SeasonStats } from "../data";
import { GAME_NAMES } from "@/lib/server/league-season";
import type { ShowData } from "../screens/show-space";
import { Flip } from "../ui/flip";
import { EmptyState } from "../ui/parts";
import { SheetCaption, plate, type Athlete } from "./cast-sheet";
import { useGameDrill } from "./game-sheets";
import { GameTable, POSITION_ORDER, slotWord } from "./game-week";
import { CastComing, EpisodesComing } from "./getting-ready";
import { Face } from "./parts";
import { RecapsCard } from "./recaps";
import { ScoringLink } from "./scoring";
import { DisputeSheet } from "./something-wrong";
import { statValue } from "./stats";
import { mainValue } from "@/lib/cast-props-words";
import { propertyMatches } from "@/lib/game/formats/rulebook-schema.js";

// Players / Cast (the design round's step 5: docs/design-round/step5-cast-spec.md, -first-view.md, -shape.md). The show's own
// facts, never one game's points unless a game is chosen (Phase 0 decision 6):
//   - the face wall: who's still in, by the groups people are on now (a show whose faction is a secret role groups Still in), then
//     who's out, newest first. Names only: no numbers, no team tags.
//   - The numbers: "Counted by" the show (every stat the rulebook records, a column each, counts, a tap on a column sorts) or a
//     game you play that counts people week by week (step 2c's game table in place, its own sheets). One episode range, capped at
//     where you are; the one pattern the server found.
//   - A tap opens the castaway's sheet (cast-sheet.tsx: one sheet from every way in, the drill's levels in game-sheets.tsx), at the
//     show's lens here; a stat on it opens that stat's board, whose foot sorts The numbers by it (`onRank`).
// A sport (the short check at hundreds of athletes): no wall: search and positions first, then rows by team with each one's line
// so far from the box scores, 40 at a time; the athlete's sheet draws their games. Every number is counted on the server up to
// where you are (GET /api/seasons/[id]/stats); `?rank=<stat>` opens the table sorted by it, `&from=&to=` a range.

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The range a link asked for, as far as the stats go. */
function askedRange(params: URLSearchParams): [number, number] | null {
  const from = Number(params.get("from"));
  const to = Number(params.get("to"));
  return Number.isInteger(from) && Number.isInteger(to) && from >= 1 && to >= from ? [from, to] : null;
}

/** The games a person can be counted by on this tab: ones that count people week by week (a lineup, best ball), with results. */
function lensGames(show: ShowData): GameView[] {
  return (show.play ?? []).filter((g) => g.castWeeks && g.table.some((r) => r.weeks.length > 0));
}

/** A game's name as people read it: a sports game named by its type key reads by the type's name (episodes.tsx's rule). */
const gameName = (g: GameView) => GAME_NAMES[g.gameName] ?? g.gameName;

export function Cast({ seasonId, show }: { seasonId: string; show: ShowData }) {
  if (show.header?.show.kind === "sport") return <SportCast seasonId={seasonId} show={show} />;
  return <ShowCast seasonId={seasonId} show={show} />;
}

// ---------- a competition show ----------

function ShowCast({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const params = useSearchParams();
  const couchId = show.couch?.id ?? null;
  const full = useSeasonStats(seasonId, couchId);
  // Getting it ready (getting-ready.tsx): while the cast is coming, its frames instead of "No cast yet".
  const filling = show.readOnly ? null : (show.header?.filling ?? null);
  const fillState = useFill(seasonId, !!filling).data;
  const [range, setRange] = useState<[number, number] | null>(() => askedRange(params));
  const ranged = useSeasonStats(seasonId, couchId, range, !!range);
  const [sort, setSort] = useState<string | null>(params.get("rank"));
  const [lens, setLens] = useState<string>("show");
  const [flagging, setFlagging] = useState<{ episode: number; who: string } | null>(null);
  // A value of one of the show's properties the wall shows only (The Challenge's Rookies), or everyone.
  const [only, setOnly] = useState<{ key: string; value: string } | null>(null);
  const games = lensGames(show);
  const later = (fn: () => void) => setTimeout(fn, 230);
  // One drill for every sheet this tab opens (game-sheets.tsx): a castaway, a stat's board, a compare, a person in a game. The
  // drill closes its sheets before either of these runs.
  const drill = useGameDrill(show, {
    onFlag: couchId ? (episode, who) => later(() => setFlagging({ episode, who })) : null,
    onRank: (key) => {
      startTransition(() => {
        setLens("show");
        setRange(null);
        setSort(key);
      });
      later(() => document.querySelector("[data-numbers]")?.scrollIntoView({ block: "start", behavior: "smooth" }));
    },
  });
  const move = (fn: () => void) => startTransition(fn);
  const tap = (c: CastStat) => drill.open({ kind: "cast", name: c.name, lens: null });
  // A chip shows whoever counts as its value: Nonbinary under Man and Woman too (the user, 2026-11-16).
  const filtered = (people: CastStat[]) => {
    if (!only) return people;
    const p = (full.data?.properties ?? []).find((x) => x.key === only.key);
    return people.filter((c) => propertyMatches(p, c.props?.[only.key], only.value));
  };

  if (full.error) return <EmptyState icon={Users} title="Couldn't load the cast" line={(full.error as Error).message} />;
  if (!full.data) return <div className="mx-4 mt-5 h-72 animate-pulse rounded-[4px] bg-card" aria-busy />;
  const all = full.data;
  const w = show.words;
  if (!all.cast.length) {
    if (fillState && (fillState.status === "going" || fillState.status === "stuck")) return <CastComing f={fillState} />;
    const people = w.people.toLowerCase();
    return <EmptyState icon={Users} title={`No ${people} yet`} line={`The ${people} show up here once the season's cast is in.`} />;
  }
  if (!all.through) {
    // Nothing counted yet (no results up to where you are): who's in it anyway, and (a show made a game that nobody plays) its
    // results to look up, or their progress (recaps.tsx).
    return (
      <>
        {fillState?.status === "going" && fillState.steps.some((s) => s.key === "episodes") ? <EpisodesComing f={fillState} /> : <RecapsCard seasonId={seasonId} show={show} eps={null} />}
        <section data-explorer data-no-stats className="mx-4 mt-4 pb-4">
          <PropertyChips d={all} chosen={only} onChoose={setOnly} />
          {/* Who's in it opens who they are, before any numbers (docs/PLAN-cast-properties.md: a draft before the premiere). */}
          <FaceWall d={all} people={filtered(all.cast)} onTap={tap} />
          <p className="mt-5 text-[13.5px] leading-snug text-muted-foreground">
            {all.seenThrough === 0
              ? `Their numbers fill in as you watch, up to the ${w.episode.toLowerCase()} you're on, never past it.`
              : `No results are in yet for the ${w.episodes.toLowerCase()} you've seen. Their numbers fill in as they come in.`}
          </p>
          <ScoringLink seasonId={seasonId} variant="line" />
        </section>
        {drill.sheets}
      </>
    );
  }
  // The range's numbers once they're back (the last range's until then), else the whole season's.
  const d = (range && ranged.data) || all;
  const game = games.find((g) => g.leagueId === lens) ?? null;
  const pattern = d.patterns[0] ?? null;

  return (
    <>
      <RecapsCard seasonId={seasonId} show={show} eps={null} />
      <section data-explorer className="mx-4 mt-4 pb-4">
        <PropertyChips d={all} chosen={only} onChoose={setOnly} />
        <FaceWall d={all} people={filtered(all.cast)} onTap={tap} />

        <h2 className="type-caption mt-8 text-[24px] leading-none" data-numbers>
          The numbers
        </h2>
        <LensRow games={games} lens={game ? game.leagueId : "show"} onLens={(k) => move(() => setLens(k))} through={all.through} />
        {game ? (
          <div className="mt-1" data-lens-game={game.leagueId}>
            <p className="mb-1 text-[13px] text-muted-foreground" data-lens-head>
              Points as <b className="font-semibold text-foreground">{gameName(game)}</b> counts them, and who holds each
            </p>
            <GameTable g={game} words={w} onFace={(id) => drill.openCast(game, id)} />
          </div>
        ) : (
          <>
            <RangeControl
              key={`${all.through}:${range ?? "all"}`}
              max={all.through}
              range={range ? [Math.min(range[0], all.through), Math.min(range[1], all.through)] : [1, all.through]}
              onChange={(r) => move(() => setRange(r[0] === 1 && r[1] === all.through ? null : r))}
            />
            {pattern && (
              <button
                type="button"
                data-pattern={pattern.stat}
                onClick={() => move(() => setSort(pattern.stat))}
                className="nd-press mb-2 flex w-full items-center gap-2 rounded-[3px] bg-card px-2.5 py-2.5 text-left text-[13px] leading-snug"
              >
                <Zap className="size-4 flex-none text-muted-foreground" aria-hidden />
                <span className="flex-1">{pattern.text}</span>
                <ChevronRight className="size-3.5 flex-none text-muted-foreground" aria-hidden />
              </button>
            )}
            <NumbersTable d={d} sort={sort} onSort={(k) => move(() => setSort(k))} onTap={tap} />
          </>
        )}
        <ScoringLink seasonId={seasonId} variant="line" />
      </section>
      {flagging && couchId && <DisputeSheet seasonId={seasonId} couchId={couchId} episode={flagging.episode} who={flagging.who} onClose={() => setFlagging(null)} />}
      {drill.sheets}
    </>
  );
}

/** The episode range, folded to one line ("Episodes 1–5 · Change") until it's asked for: the table is the section's content. */
function RangeControl({ max, range, onChange }: { max: number; range: [number, number]; onChange: (r: [number, number]) => void }) {
  const [open, setOpen] = useState(false);
  if (max < 2) return null;
  const [a, b] = range;
  if (open) return <EpisodeSlider max={max} range={range} onChange={onChange} />;
  return (
    <button type="button" data-range-open onClick={() => setOpen(true)} className="mb-2 flex h-11 items-center gap-1.5 text-[14px]">
      <span className="text-muted-foreground">Episodes</span>
      <b className="type-num text-[17px]">{a === b ? a : `${a}–${b}`}</b>
      <span className="font-semibold text-chyron-line underline underline-offset-[3px]">Change</span>
    </button>
  );
}

/** "Counted by": the show, or a game you play that counts people week by week. With no such game, a line saying so. */
function LensRow({ games, lens, onLens, through, own = "The show" }: { games: GameView[]; lens: string; onLens: (k: string) => void; through: number; own?: string }) {
  if (!games.length) return <p className="mb-3 mt-1.5 text-[13px] text-muted-foreground">Counted from the show, up to Ep {through}</p>;
  const opts: [string, string][] = [["show", own], ...games.map((g) => [g.leagueId, gameName(g)] as [string, string])];
  return (
    <div className="mb-3 mt-2.5" data-lens>
      <p className="mb-1.5 text-[12px] text-muted-foreground">Counted by</p>
      <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]" role="radiogroup" aria-label="Counted by">
        {opts.map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={lens === k}
            data-lens-option={k}
            onClick={() => onLens(k)}
            className={plate(lens === k)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- the controls ----------

/** Two thumbs on one track: from and to, capped at where you are. The waiver picker uses it too. */
export function EpisodeSlider({ max, range, onChange }: { max: number; range: [number, number]; onChange: (r: [number, number]) => void }) {
  const [live, setLive] = useState(range);
  const [a, b] = [Math.min(...live), Math.max(...live)];
  if (max < 2) return null;
  const pct = (n: number) => ((n - 1) / (max - 1)) * 100;
  const set = (i: 0 | 1, v: number) => setLive((r) => (i ? [r[0], v] : [v, r[1]]));
  const done = () => onChange([a, b]);
  return (
    <div className="mb-2.5" data-slider>
      <div className="flex items-baseline justify-between">
        <span className="type-caption text-[13px] tracking-[0.04em] text-muted-foreground">Episodes</span>
        <b className="type-num text-[22px]" data-range>
          {a === b ? a : `${a} – ${b}`}
        </b>
      </div>
      <div className="relative h-[30px]">
        <span className="absolute inset-x-0 top-[13px] h-1 rounded-[2px] bg-border" />
        <i className="absolute top-[13px] h-1 rounded-[2px] bg-foreground" style={{ left: `${pct(a)}%`, right: `${100 - pct(b)}%` }} />
        {([0, 1] as const).map((i) => (
          <input
            key={i}
            type="range"
            min={1}
            max={max}
            value={live[i]}
            aria-label={i ? "To episode" : "From episode"}
            onChange={(e) => set(i, Number(e.target.value))}
            onPointerUp={done}
            onKeyUp={done}
            className="nd-range absolute inset-0 m-0 w-full"
          />
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>1</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

/** A native dropdown dressed as a field: any number of options fits (imported shows name their own stats). The waiver
 *  picker uses it. */
export function Select({ label, value, options, onChange, main }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void; main?: boolean }) {
  const on = options.find((o) => o[0] === value) ?? options[0];
  return (
    <label
      className={`relative flex min-h-[54px] min-w-0 flex-col items-start justify-center gap-px rounded-[3px] bg-card py-[7px] pl-2.5 pr-7 focus-within:outline-2 focus-within:outline-foreground ${main ? "outline-[1.5px] -outline-offset-1 outline-foreground" : "outline-1 -outline-offset-1 outline-input"}`}
    >
      <small className="block text-[11px] text-muted-foreground">{label}</small>
      <b className="max-w-full truncate text-sm leading-tight">{on[1]}</b>
      <ChevronDown className="absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <select value={on[0]} onChange={(e) => onChange(e.target.value)} aria-label={label} className="absolute inset-0 size-full cursor-pointer text-base opacity-0">
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

// ---------- the face wall ----------

/** Who's still in, by group now (as far as you've seen; a faction that's a secret role never groups), then who's out, newest first.
 *  A name each; who's out greyed with the episode they left. `bare`: nothing counted yet, so nothing opens. */
/** The property the wall groups by when the show has no groups (docs/PLAN-cast-properties.md): the first with listed values that
 *  anyone has (a crew's department), else none. */
function groupingProperty(d: SeasonStats) {
  if (d.groups.length) return null;
  return (d.properties ?? []).find((p) => p.values && p.key !== "gender" && d.cast.some((c) => c.props?.[p.key])) ?? null;
}

/** Filter chips: each listed property the wall doesn't group by, with two or more of its values in the cast (The Challenge's
 *  Veteran and Rookie under its teams). One quiet row each: All, then each value and how many. */
function PropertyChips({ d, chosen, onChoose }: { d: SeasonStats; chosen: { key: string; value: string } | null; onChoose: (v: { key: string; value: string } | null) => void }) {
  const by = groupingProperty(d);
  const rows = (d.properties ?? [])
    .filter((p) => p.values && p.key !== by?.key)
    .map((p) => ({ p, values: p.values!.map((v) => [v, d.cast.filter((c) => propertyMatches(p, c.props?.[p.key], v)).length] as const).filter(([, n]) => n > 0) }))
    .filter((r) => r.values.length > 1);
  if (!rows.length) return null;
  const chip = (on: boolean) =>
    `nd-press inline-flex h-11 flex-none items-center gap-1.5 rounded-[3px] px-3 text-[14px] font-semibold ${on ? "bg-foreground text-background" : "bg-card text-foreground"}`;
  // One choice at a time across them all, so one All; each property's values together, wrapping rather than scrolling sideways.
  return (
    <div data-property-chips role="radiogroup" aria-label="Show only" className="mb-5 flex flex-wrap gap-x-3 gap-y-1.5">
      <button type="button" role="radio" aria-checked={!chosen} data-chip="" onClick={() => onChoose(null)} className={chip(!chosen)}>
        All
      </button>
      {rows.map(({ p, values }) => (
        <span key={p.key} data-chips-of={p.key} className="flex gap-1.5" aria-label={p.name}>
          {values.map(([v, n]) => {
            const on = chosen?.key === p.key && chosen.value === v;
            return (
              <button key={v} type="button" role="radio" aria-checked={on} data-chip={v} onClick={() => onChoose(on ? null : { key: p.key, value: v })} className={chip(on)}>
                {v}
                <small className={`text-[12px] font-normal ${on ? "text-background/70" : "text-muted-foreground"}`}>{n}</small>
              </button>
            );
          })}
        </span>
      ))}
    </div>
  );
}

export function FaceWall({ d, people, onTap, picking, bare }: { d: SeasonStats; people: CastStat[]; onTap: (c: CastStat) => void; picking?: string | null; bare?: boolean }) {
  const inNow = people.filter((c) => c.out === null);
  const by = groupingProperty(d);
  const groups: [string, CastStat[], string | null][] = d.groups.length
    ? [...d.groups.map((g) => [g.name, inNow.filter((c) => c.group === g.name), g.colour] as [string, CastStat[], string]), ["Still in", inNow.filter((c) => !d.groups.some((g) => g.name === c.group)), null]]
    : by
      ? [...by.values!.map((v) => [v, inNow.filter((c) => c.props?.[by.key] === v), null] as [string, CastStat[], null]), ["Still in", inNow.filter((c) => !by.values!.includes(c.props?.[by.key] ?? "")), null]]
      : [["Still in", inNow, null]];
  groups.push(["Out", people.filter((c) => c.out !== null).sort((p, q) => q.out! - p.out!), null]);
  return (
    <div data-face-wall>
      {groups
        .filter(([, list]) => list.length)
        .map(([name, list, colour]) => (
          <div key={name} className="mt-4 first:mt-1" data-group={name}>
            <div className="mb-2 flex items-center gap-2">
              {colour && <i className="size-2.5 rounded-[2px]" style={{ background: colour }} aria-hidden />}
              <b className="type-caption text-[19px] leading-none">{name}</b>
              <small className="text-[13px] text-muted-foreground">{list.length}</small>
            </div>
            <div className="grid grid-cols-4 gap-x-2 gap-y-2.5">
              {list.map((c) => {
                const out = c.out !== null;
                const what = mainValue(c.props, d.properties) ?? c.position ?? null;
                const body = (
                  <>
                    <Face src={c.photo} name={c.first} out={out} className={`mb-1 aspect-[4/5] w-full rounded-[3px] ${out ? "opacity-60" : ""}`} />
                    <b className={`type-caption block truncate text-[14px] leading-tight ${out ? "text-muted-foreground" : ""}`}>{c.first}</b>
                    {(out || what) && <small className="block truncate text-[12px] leading-tight text-muted-foreground" data-cast-line>{[what, out ? `Ep ${c.out}` : null].filter(Boolean).join(" · ")}</small>}
                  </>
                );
                return bare ? (
                  <div key={c.name} data-cast={c.first} className="min-w-0">
                    {body}
                  </div>
                ) : (
                  <button
                    key={c.name}
                    type="button"
                    data-cast={c.first}
                    aria-label={`${c.name}${out ? `, out in episode ${c.out}` : ""}`}
                    onClick={() => onTap(c)}
                    className={`nd-press min-w-0 text-left ${picking === c.name ? "rounded-[3px] outline-2 outline-offset-2 outline-foreground" : ""}`}
                  >
                    {body}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}

// ---------- the numbers: one table, every stat a column ----------

function NumbersTable({ d, sort, onSort, onTap, picking = null }: { d: SeasonStats; sort: string | null; onSort: (k: string) => void; onTap: (c: CastStat) => void; picking?: string | null }) {
  // Every stat anyone has in the range, the fullest first (how many people have it), so the first view reads.
  const filled = (k: string) => d.cast.filter((c) => statValue(c, k) > 0).length;
  const cols = d.stats.filter((s) => s.key !== "points" && filled(s.key) > 0).sort((p, q) => filled(q.key) - filled(p.key));
  if (!cols.length) return <p className="mt-2 text-[14px] text-muted-foreground">Nothing recorded in these episodes yet.</p>;
  const by = cols.find((s) => s.key === sort) ?? cols[0];
  const rows = [...d.cast].sort((p, q) => statValue(q, by.key) - statValue(p, by.key) || Number(p.out !== null) - Number(q.out !== null) || p.first.localeCompare(q.first));
  const sticky = "sticky left-0 z-[1] bg-background shadow-[6px_0_8px_-6px_rgba(0,0,0,.25)] dark:shadow-[6px_0_8px_-6px_rgba(0,0,0,.7)]";
  return (
    <div className="relative -mx-4 mt-1">
    <p className="mb-1 px-4 text-right text-[12px] text-muted-foreground">
      {cols.length} {cols.length === 1 ? "stat" : "stats"}
      {cols.length > 3 ? " · scroll for more" : ""}
    </p>
    {cols.length > 3 && <span aria-hidden className="pointer-events-none absolute bottom-0 right-0 top-6 z-[2] w-8 bg-gradient-to-l from-background to-transparent" />}
    <div className="overflow-x-auto [scrollbar-width:thin]" data-numbers-table>
      <table className="min-w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className={`${sticky} w-[132px] min-w-[132px] border-b border-border pb-2 pl-4 align-bottom text-left text-[12px] font-normal text-muted-foreground`}>
              Ep {d.from === d.to ? d.from : `${d.from}–${d.to}`}
            </th>
            {cols.map((s) => {
              const on = s.key === by.key;
              return (
                <th key={s.key} aria-sort={on ? "descending" : "none"} className="w-[78px] min-w-[78px] border-b border-border p-0 align-bottom">
                  <button type="button" data-sort={s.key} onClick={() => onSort(s.key)} className={`flex w-full flex-col items-center gap-0.5 px-1.5 pb-2 pt-1 text-center text-[11.5px] leading-[1.2] ${on ? "font-bold text-foreground" : "font-normal text-muted-foreground"}`}>
                    <span className="line-clamp-3">{s.name}</span>
                    <ChevronDown className={`size-3.5 ${on ? "" : "opacity-0"}`} aria-hidden />
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <Flip key={c.name} id={`row-${c.first}`}>
              <tr data-cast-row={c.first} onClick={() => onTap(c)} className={`cursor-pointer ${c.out !== null ? "opacity-55" : ""} ${picking === c.name ? "bg-secondary" : ""}`}>
                <td className={`${sticky} border-b border-border pl-4`}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTap(c);
                    }}
                    className="flex h-12 w-full min-w-0 items-center gap-2 pr-2 text-left"
                  >
                    <Face src={c.photo} name={c.first} out={c.out !== null} className="size-7 flex-none rounded-[3px]" />
                    <span className="min-w-0">
                      <b className="block truncate text-[15px] font-semibold leading-tight">{c.first}</b>
                      {c.position && <small className="block truncate text-[12px] leading-tight text-muted-foreground">{c.position}</small>}
                    </span>
                  </button>
                </td>
                {cols.map((s) => {
                  const n = statValue(c, s.key);
                  return (
                    <td key={s.key} className={`border-b border-border text-center ${s.key === by.key ? "bg-card" : ""}`}>
                      {n ? <b className="type-num text-[17px]">{n}</b> : <span className="text-muted-foreground" aria-label="none">·</span>}
                    </td>
                  );
                })}
              </tr>
            </Flip>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  );
}

/** "+2", "−1", "0": a moment's points as the standings write them. */
const pts = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`;

/** A castaway's season so far, newest first (the person sheet's story; a game's page shows it with that game's points under "In
 *  this game", U1 step 2b). `points={false}`: the show's facts only (the cast tab, step 5). */
export function StoryBody({ d, c, names, onFlag, group = true, photo = true, points = true, lit = null, marks = null }: { d: SeasonStats; c: CastStat; names?: Map<string, string>; onFlag?: ((episode: number, who: string) => void) | null; group?: boolean; photo?: boolean; points?: boolean; lit?: number | null; marks?: Map<string, string> | null }) {
  names ??= new Map(d.stats.map((s) => [s.key, s.name]));
  return (
    <div className={`flex gap-3 pb-2 ${photo ? "mt-3" : ""}`} data-story={c.first}>
      {photo && <Face src={c.photo} name={c.first} out={c.out !== null} className="h-[90px] w-[72px] flex-none rounded-[3px]" />}
      <div className="min-w-0 flex-1">
        {group && c.group && (
          <p className="text-sm text-muted-foreground">
            {cap(d.groupWord)}: <b className="text-foreground">{c.group}</b>
            {c.start && c.start !== c.group ? ` · started on ${c.start}` : ""}
          </p>
        )}
        {group && d.roles && (
          <p className="text-sm text-muted-foreground" data-role>
            {c.role ? (
              <>
                <b className="text-foreground">{c.role}</b> · revealed when they left
              </>
            ) : (
              "Their role stays secret until they leave"
            )}
          </p>
        )}
        {/* Before anything's counted (a draft before the premiere): say so, not an empty list. */}
        {d.through === 0 && <p className="text-[14px] text-muted-foreground" data-story-empty>Nothing yet. Their story fills in as you watch.</p>}
        {Array.from({ length: d.through }, (_, k) => d.through - k).map((e) => {
          // Newest first (the research sheet's order): what was recorded, each with what it scored when points are shown.
          const ev = c.events.filter(([ep]) => ep === e).map(([, k, p, units]) => ({ key: k, name: names.get(k) ?? k, points: p, units: d.stats.find((s) => s.key === k)?.unit === "" ? units : 1 }));
          const gone = c.out !== null && e > c.out;
          const left = c.out === e;
          const unsure = d.unsure?.[e]?.[c.name];
          const total = gone || !points ? null : c.perEp[e - 1];
          // A property's change that episode (chunk 6): "Bosun from here (was Deckhand)".
          const moved = (c.changes ?? []).filter(([ep]) => ep === e);
          const held = (c.held ?? []).filter(([ep]) => ep === e);
          const quiet = !gone && !ev.length && !left && !moved.length && !held.length;
          if (!points && gone) return null;
          return (
            <section key={e} data-story-ep={e} className={`scroll-mt-2 border-t border-border py-2 first:border-t-0 ${gone ? "opacity-55" : ""} ${lit === e ? "nd-lit" : ""}`}>
              <header className="flex min-h-9 items-center gap-2">
                <b className="type-caption text-[14px] tracking-[0.04em] text-muted-foreground">Episode {e}</b>
                {unsure && (
                  <i data-unsure={unsure} className="whitespace-nowrap rounded-[2px] bg-secondary px-1.5 py-px text-[11px] font-bold not-italic text-muted-foreground">
                    {unsure === "disputed" ? "Disputed" : "1 source"}
                  </i>
                )}
                <span className="flex-1" />
                {total != null && <b className={`type-num text-[22px] leading-none ${total > 0 ? "" : "text-muted-foreground"}`}>{pts(total)}</b>}
                {onFlag && !gone && (ev.length > 0 || left) && (
                  <button type="button" data-story-flag={e} aria-label={`Something wrong in Episode ${e}`} onClick={() => onFlag(e, c.name)} className="-mr-2 grid size-11 flex-none place-items-center text-muted-foreground">
                    <Ellipsis className="size-5" aria-hidden />
                  </button>
                )}
              </header>
              {ev.map((x, i) => (
                <div key={`${x.key}-${i}`} data-story-moment={x.key} className={`flex min-h-8 items-center gap-3 text-[14px] leading-snug ${x.points || !points ? "" : "text-muted-foreground"}`}>
                  <span className="min-w-0 flex-1">
                    {/* The scored sheet: each moment led by its class's mark, so a chart column's colours are found in the story it opens. */}
                    {marks?.get(x.key) && <i className="mr-2 inline-block h-3 w-1 rounded-[1px] align-[-1px]" style={{ background: marks.get(x.key) }} aria-hidden />}
                    {x.name}
                    {x.units !== 1 && <span className="text-muted-foreground"> · {x.units.toLocaleString()}</span>}
                  </span>
                  {points && <span className="type-num flex-none text-[15px]">{pts(x.points)}</span>}
                </div>
              ))}
              {moved.map(([, key, value, was]) => (
                <div key={key} data-story-change={key} className="flex min-h-8 items-center text-[14px] leading-snug">
                  <span className="min-w-0 flex-1">
                    {value} from here
                    {was && <span className="text-muted-foreground"> · was {was}</span>}
                  </span>
                </div>
              ))}
              {held.map(([, line], i) => (
                <div key={`h${i}`} data-story-held className="flex min-h-8 items-center text-[14px] leading-snug">
                  {line}
                </div>
              ))}
              {left && <div data-story-left className="flex min-h-8 items-center text-[14px] leading-snug text-live">{c.how ?? "Left the game"}</div>}
              {(quiet || gone) && <div className="flex min-h-8 items-center text-[14px] text-muted-foreground">{gone ? "Already out" : "Nothing recorded"}</div>}
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ---------- two side by side ----------

const PAIR = ["var(--foreground)", "var(--muted-foreground)"];

/** Two castaways side by side in the show's lens (the sheet's Compare with…): one chart of both, an episode a pair of columns,
 *  then every stat read across, the higher number bold. A game's lens compares points instead (game-week.tsx CompareBody). */
export function CompareCounts({ d, a, b, words }: { d: SeasonStats; a: CastStat; b: CastStat; words: ShowData["words"] }) {
  const per = (c: CastStat) => Array.from({ length: d.through }, (_, i) => c.events.filter(([ep]) => ep === i + 1).length);
  const [pa, pb] = [per(a), per(b)];
  const max = Math.max(1, ...pa, ...pb);
  const n = d.through, colW = n <= 8 ? 40 : 28, H = 64, W = Math.max(n * colW, 120);
  const stats = d.stats.filter((s) => s.key !== "points" && (statValue(a, s.key) || statValue(b, s.key)));
  return (
    <div className="mt-3 pb-2" data-compare-sheet>
      <div className="mb-2 flex justify-between">
        {[a, b].map((c, i) => (
          <span key={c.name} className="flex w-[45%] flex-col items-center gap-1">
            <Face src={c.photo} name={c.first} out={c.out !== null} className="size-16 rounded-[3px]" />
            <b className="flex items-center gap-1.5">
              <i className="size-2.5 rounded-[2px]" style={{ background: PAIR[i] }} aria-hidden />
              {c.first}
            </b>
          </span>
        ))}
      </div>
      <p className="type-caption mt-3 text-[14px] tracking-[0.02em] text-muted-foreground">Each {words.episode.toLowerCase()}</p>
      <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]" data-compare-chart>
        <svg width={W} height={H + 18} role="img" aria-label={`Moments each ${words.episode.toLowerCase()}: ${a.first} ${pa.join(", ")}; ${b.first} ${pb.join(", ")}`} className="block">
          <line x1={0} x2={W} y1={H} y2={H} stroke="var(--edge)" strokeWidth={1} />
          {pa.map((_, i) => {
            const bw = (colW - 10) / 2;
            return (
              <g key={i}>
                {[pa[i], pb[i]].map((v, k) => (v ? <rect key={k} x={i * colW + 4 + k * (bw + 2)} width={bw} y={H - (v / max) * (H - 8)} height={(v / max) * (H - 8)} fill={PAIR[k]} rx={1} /> : null))}
                <text x={i * colW + 4 + (colW - 8) / 2} y={H + 14} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)">
                  {i + 1}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-2">
        {stats.map((s) => {
          const [x, y] = [statValue(a, s.key), statValue(b, s.key)];
          return (
            <div key={s.key} className="grid min-h-10 grid-cols-[44px_1fr_44px] items-center border-b border-border text-center text-[13px] text-muted-foreground">
              <b className={`type-num text-[20px] ${x > y ? "text-foreground" : "text-muted-foreground"}`}>{x || "·"}</b>
              <span className="px-1 leading-snug">{s.name}</span>
              <b className={`type-num text-[20px] ${y > x ? "text-foreground" : "text-muted-foreground"}`}>{y || "·"}</b>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- a sport: a list, not a wall ----------

const PAGE = 40;

function SportCast({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const read = useRoster(seasonId);
  const games = lensGames(show);
  const [lens, setLens] = useState("show");
  const [q, setQ] = useState("");
  const [pos, setPos] = useState("all");
  const [shown, setShown] = useState(PAGE);
  const drill = useGameDrill(show);
  const people = useMemo<Athlete[]>(
    () =>
      (read.data?.groups ?? []).flatMap((g) =>
        g.people.map((p) => {
          const items = p.stats?.soFar ?? null;
          return { name: p.name, role: p.role, photoUrl: p.photoUrl, team: g.name, line: items?.length ? items.slice(0, 3).map((i) => `${i.value} ${i.label}`).join(" · ") : null };
        })
      ),
    [read.data]
  );
  const w = show.words;
  if (read.error) return <EmptyState icon={Users} title={`Couldn't load the ${w.people.toLowerCase()}`} line={(read.error as Error).message} />;
  if (!read.data) return <div className="mx-4 mt-5 h-72 animate-pulse rounded-[4px] bg-card" aria-busy />;
  const game = games.find((g) => g.leagueId === lens) ?? null;
  const positions = [...new Set(people.map((p) => slotWord((p.role ?? "").toUpperCase())).filter(Boolean))].sort((a, b) => (POSITION_ORDER.indexOf(a) < 0 ? 99 : POSITION_ORDER.indexOf(a)) - (POSITION_ORDER.indexOf(b) < 0 ? 99 : POSITION_ORDER.indexOf(b)));
  const term = q.trim().toLowerCase();
  const found = people.filter((p) => (pos === "all" || slotWord((p.role ?? "").toUpperCase()) === pos) && (!term || p.name.toLowerCase().includes(term) || p.team.toLowerCase().includes(term)));
  const page = found.slice(0, shown);
  const teams: [string, Athlete[]][] = [];
  for (const p of page) {
    const t = teams.at(-1);
    if (t && t[0] === p.team) t[1].push(p);
    else teams.push([p.team, [p]]);
  }
  return (
    <>
      <section data-explorer data-sport-list className="mx-4 mt-4 pb-4">
        {game ? (
          <div data-lens-game={game.leagueId}>
            <LensRow games={games} lens={game.leagueId} onLens={setLens} through={0} own="Box scores" />
            <p className="mb-1 text-[13px] text-muted-foreground" data-lens-head>
              Points as <b className="font-semibold text-foreground">{gameName(game)}</b> counts them, and who holds each
            </p>
            <GameTable g={game} words={w} onFace={(id) => drill.openCast(game, id)} />
          </div>
        ) : (
          <>
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                type="search"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setShown(PAGE);
                }}
                placeholder={`Find a ${w.person.toLowerCase()} or team`}
                aria-label={`Find a ${w.person.toLowerCase()} or team`}
                className="h-11 w-full rounded-[4px] bg-card pl-9 pr-3 text-base outline-1 -outline-offset-1 outline-input placeholder:text-muted-foreground focus:outline-2 focus:outline-foreground"
              />
            </label>
            {positions.length > 1 && (
              <div className="-mx-4 mt-2.5 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]" role="radiogroup" aria-label="Position" data-positions>
                {["all", ...positions].map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={pos === p}
                    onClick={() => {
                      setPos(p);
                      setShown(PAGE);
                    }}
                    className={`h-9 flex-none rounded-[3px] px-3 text-[13px] font-bold ${pos === p ? "bg-foreground text-background" : "text-muted-foreground outline-1 -outline-offset-1 outline-edge"}`}
                  >
                    {p === "all" ? "All" : p}
                  </button>
                ))}
              </div>
            )}
            {games.length > 0 && <LensRow games={games} lens="show" onLens={setLens} through={0} own="Box scores" />}
            <p className="mb-1 mt-3 text-[12.5px] text-muted-foreground" data-count>
              {found.length === people.length ? `${people.length} ${w.people.toLowerCase()}` : `${found.length} of ${people.length}`}
              {read.data.source ? ` · from ${read.data.source}` : ""}
            </p>
            {found.length === 0 && <p className="py-6 text-center text-[14px] text-muted-foreground">Nobody matches “{q.trim()}”.</p>}
            {teams.map(([team, list], i) => (
              <div key={`${team}-${i}`} data-team={team}>
                <p className="type-caption mt-3 border-b border-border pb-1.5 text-[15px] tracking-[0.02em] text-muted-foreground">{team}</p>
                {list.map((p) => (
                  <button key={p.name} type="button" data-athlete={p.name} onClick={() => drill.open({ kind: "cast", name: p.name, lens: null })} className="nd-press flex min-h-14 w-full items-center gap-3 border-b border-border py-1.5 text-left">
                    <Face src={p.photoUrl} name={p.name} className="size-9 flex-none rounded-[3px] bg-card" />
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[15px] font-semibold">{p.name}</b>
                      <small className="block truncate text-[13px] text-muted-foreground">{[p.role ? slotWord(p.role.toUpperCase()) : null, p.line].filter(Boolean).join(" · ") || p.team}</small>
                    </span>
                    <ChevronRight className="size-4 flex-none text-muted-foreground" aria-hidden />
                  </button>
                ))}
              </div>
            ))}
            {found.length > shown && (
              <button type="button" data-show-more onClick={() => setShown((n) => n + PAGE)} className="nd-press mt-3 h-11 w-full rounded-[6px] text-[14px] font-bold outline-1 -outline-offset-1 outline-edge">
                Show {Math.min(PAGE, found.length - shown)} more
              </button>
            )}
          </>
        )}
      </section>
      {drill.sheets}
    </>
  );
}

/** The stat each sport's seasons are drawn by, where its lines have one: yards, points, home runs, goals. */
const KEY_STATS = ["YDS", "PTS", "HR", "G", "SV"];
const num = (v: string) => Number(v.replace(/,/g, ""));

/**
 * An athlete's past seasons (sports/history.ts; the user, 2026-11-15: "Sports it's important to get historical stats"): the last
 * three before this one. Their main kind of stats (the provider's first category: a quarterback's passing, a back's rushing) as
 * a bar per season on its key stat, then the table, every column the provider shows, a row per season (and per team, traded);
 * other kinds a tap open under it.
 */
export function PastSeasons({ seasonId, name }: { seasonId: string; name: string }) {
  const read = useAthleteHistory(seasonId, name);
  const [more, setMore] = useState(false);
  if (read.isPending) return <div aria-busy className="mt-5 h-28 animate-pulse rounded-[3px] bg-card" />;
  const seasons = read.data?.seasons ?? [];
  if (!seasons.length) {
    return read.data?.unavailable ? <p className="mt-5 text-[13px] text-muted-foreground">Past seasons didn&apos;t load. Try again in a bit.</p> : null;
  }
  const cats: { key: string; name: string }[] = [];
  for (const s of seasons) for (const l of s.lines) if (!cats.some((c) => c.key === l.category)) cats.push({ key: l.category, name: l.name });
  const main = cats[0];
  return (
    <section data-past-seasons>
      <SheetCaption right={read.data?.source ? `From ${read.data.source}` : undefined}>Past seasons</SheetCaption>
      <SeasonTable seasons={seasons} cat={main.key} title={main.name} chart />
      {cats.length > 1 &&
        (more ? (
          cats.slice(1).map((c) => <SeasonTable key={c.key} seasons={seasons} cat={c.key} title={c.name} />)
        ) : (
          <button type="button" data-past-more onClick={() => setMore(true)} className="mt-1 flex min-h-11 items-center gap-1.5 text-left text-[14px] font-semibold text-muted-foreground">
            {cats.slice(1).map((c) => c.name).join(", ")}
            <ChevronDown className="size-4 flex-none" aria-hidden />
          </button>
        ))}
    </section>
  );
}

function SeasonTable({ seasons, cat, title, chart }: { seasons: PastSeason[]; cat: string; title: string; chart?: boolean }) {
  const rows = seasons.flatMap((s) => s.lines.filter((l) => l.category === cat).map((l) => ({ s, l })));
  if (!rows.length) return null;
  const labels = rows[0].l.labels;
  const key = labels.findIndex((x) => KEY_STATS.includes(x.toUpperCase()));
  const vals = key >= 0 ? rows.map((r) => num(r.l.values[key] ?? "0")) : [];
  const top = Math.max(1, ...vals.filter((v) => Number.isFinite(v)));
  return (
    <div className="mt-2" data-season-table={cat}>
      <p className="mb-1.5 text-[13px] font-semibold">{title}</p>
      {chart && key >= 0 && (
        <div className="mb-3 flex flex-col gap-1.5" aria-label={`${labels[key]} by season`} data-season-bars>
          {rows.map((r, i) => (
            <div key={`${r.s.season}-${r.l.team ?? i}`} className="flex items-center gap-2.5">
              <span className="type-num w-14 flex-none text-[13px] text-muted-foreground">{r.s.label}</span>
              <span className="relative h-3 flex-1" aria-hidden>
                <i className="absolute inset-y-0 left-0 rounded-[2px] bg-foreground" style={{ width: `${Math.max(2, ((Number.isFinite(vals[i]) ? vals[i] : 0) / top) * 100)}%` }} />
              </span>
              <b className="type-num w-[72px] flex-none text-right text-[15px]">
                {r.l.values[key]} <small className="text-[11px] font-normal text-muted-foreground">{labels[key]}</small>
              </b>
            </div>
          ))}
        </div>
      )}
      <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:thin]">
        <table className="w-max min-w-full border-collapse text-[13px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
              <th className="sticky left-0 bg-card pr-3 text-left font-semibold">Season</th>
              {labels.map((x, i) => (
                <th key={i} className={`px-2 text-right font-semibold ${i === key ? "text-foreground" : ""}`}>
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.s.season}-${r.l.team ?? i}`} className="border-t border-border">
                <td className="sticky left-0 whitespace-nowrap bg-card py-1.5 pr-3 font-semibold">
                  {r.s.label}
                  {r.l.team && rows.filter((x) => x.s.season === r.s.season).length > 1 ? <small className="ml-1 font-normal text-muted-foreground">{r.l.team}</small> : null}
                </td>
                {r.l.values.map((v, k) => (
                  <td key={k} className={`type-num px-2 text-right ${k === key ? "font-bold" : ""}`}>
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
