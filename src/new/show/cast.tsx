"use client";

import { startTransition, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeftRight, ChevronDown, ChevronRight, Ellipsis, Eye, Send, Users, Zap } from "lucide-react";
import { chatCouch, postToCouch, useSeasonStats, type CastStat, type Pattern, type SeasonStats } from "../data";
import type { ShowData } from "../screens/show-space";
import { Flip } from "../ui/flip";
import { EmptyState } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { Face } from "./parts";
import { DisputeSheet } from "./something-wrong";
import { statOf, statValue, unitFor, yourTeam } from "./stats";

// Cast: the stats explorer (the mock's explorer.js, decided 2026-10-23; docs/PLAN-new-design.md step 3), for anyone,
// in a game or not. Faces grouped by the groups people are on now (a show whose faction is a secret role groups
// Still in / Out, and a role is never a filter), Rank by one stat at a time by its full name from the rulebook with a
// second beside it, Patterns, Compare two and Share, and By episode as a points heatmap. One episode slider sets the
// range for all three, capped at where you are. A face opens their story, episode by episode. No ownership dots: in
// a game, your castaways say "Your team". Every number is counted on the server up to where you are
// (GET /api/seasons/[id]/stats); a new range asks again. `?rank=<stat>` opens Rank sorted by it (the stats page
// links there), `&from=&to=` a range (Share's link).

type View = "faces" | "rank" | "heat";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The range a link asked for, as far as the stats go. */
function askedRange(params: URLSearchParams): [number, number] | null {
  const from = Number(params.get("from"));
  const to = Number(params.get("to"));
  return Number.isInteger(from) && Number.isInteger(to) && from >= 1 && to >= from ? [from, to] : null;
}

export function Cast({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const params = useSearchParams();
  const asked = params.get("rank");
  const couchId = show.couch?.id ?? null;
  const full = useSeasonStats(seasonId, couchId);
  const [range, setRange] = useState<[number, number] | null>(() => askedRange(params));
  const ranged = useSeasonStats(seasonId, couchId, range, !!range);
  const [view, setView] = useState<View>(asked ? "rank" : "faces");
  const [stat, setStat] = useState(asked ?? "points");
  const [beside, setBeside] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [picking, setPicking] = useState<string[] | null>(null);
  const [story, setStory] = useState<string | null>(null);
  const [flagging, setFlagging] = useState<{ episode: number; who: string } | null>(null);
  const [compare, setCompare] = useState<[string, string] | null>(null);
  // Same people, new places: re-sorts and filters move each face from its old spot (ui/flip.tsx).
  const move = (fn: () => void) => startTransition(fn);

  if (full.error) return <EmptyState icon={Users} title="Couldn't load the cast" line={(full.error as Error).message} />;
  if (!full.data) return <div className="mx-4 mt-5 h-72 animate-pulse rounded-[4px] bg-card" aria-busy />;
  const all = full.data;
  if (!all.cast.length) return <EmptyState icon={Users} title="No cast yet" line="The cast shows up here once the season's cast is in." />;
  if (!all.through) {
    return <EmptyState icon={Eye} title="Nothing to show yet" line="The cast's stats fill in as you watch, up to the episode you're on, never past it." />;
  }
  // The range's numbers once they're back (the last range's until then), else the whole season's.
  const d = (range && ranged.data) || all;
  const [from, to] = [d.from, d.to];
  const mine = yourTeam(show.play);
  const isMine = (c: CastStat) => mine.has(c.name);
  const filters: [string, string][] = [
    ["all", "Everyone"],
    ["in", "Still in"],
    ["out", "Out"],
    ...d.groups.map((g) => [g.name, g.name] as [string, string]),
    ...(mine.size ? [["mine", "Your team"] as [string, string]] : []),
  ];
  const on = filters.some((f) => f[0] === filter) ? filter : "all";
  const people = d.cast.filter((c) => on === "all" || (on === "in" && c.out === null) || (on === "out" && c.out !== null) || (on === "mine" && isMine(c)) || (c.group === on && c.out === null));
  const ranked = statOf(d, stat);

  const tap = (c: CastStat) => {
    if (!picking) return setStory(c.name);
    const next = picking.includes(c.name) ? picking.filter((n) => n !== c.name) : [...picking, c.name].slice(-2);
    if (next.length === 2) {
      setPicking(null);
      setCompare([next[0], next[1]]);
    } else setPicking(next);
  };
  const share = async () => {
    const name = show.header ? `${show.header.show.name}${show.header.seasonNumber ? ` ${show.header.seasonNumber}` : ""}` : "This show";
    const text = `${name} stats · ranked by ${ranked.name.toLowerCase()} · Episodes ${from === to ? from : `${from}–${to}`}`;
    // The couch's chat about this show when there's a couch to tell; on your own, the phone's share sheet.
    const couchId = chatCouch(show);
    try {
      if (couchId) {
        await postToCouch(seasonId, couchId, text);
        toast("Shared with the couch · in its chat");
      } else {
        const url = `${window.location.origin}${window.location.pathname}?rank=${encodeURIComponent(ranked.key)}&from=${from}&to=${to}`;
        if (navigator.share) await navigator.share({ text, url });
        else {
          await navigator.clipboard.writeText(`${text} ${url}`);
          toast("Link copied");
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast(`Not shared: ${(e as Error).message}`);
    }
  };

  return (
    <>
      <section data-explorer className="mx-4 mt-5 pb-4">
        <div className="mb-3 flex gap-1" role="tablist">
          {(
            [
              ["faces", "Faces"],
              ["rank", "Rank"],
              ["heat", "By episode"],
            ] as [View, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={view === k}
              data-view={k}
              onClick={() => setView(k)}
              className={`h-[38px] flex-1 rounded-[3px] text-sm font-bold ${view === k ? "bg-foreground text-background" : "bg-card text-muted-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <EpisodeSlider
          key={`${all.through}:${range ?? "all"}`}
          max={all.through}
          range={range ? [Math.min(range[0], all.through), Math.min(range[1], all.through)] : [1, all.through]}
          onChange={(r) => move(() => setRange(r[0] === 1 && r[1] === all.through ? null : r))}
        />
        <div className={`mb-2.5 grid gap-2 ${view === "rank" ? "grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]" : "grid-cols-1"}`}>
          {view === "rank" && <Select label="Ranked by" value={ranked.key} options={d.stats.map((s) => [s.key, s.name])} onChange={(v) => move(() => setStat(v))} main />}
          <Select label="Show" value={on} options={filters} onChange={(v) => move(() => setFilter(v))} />
        </div>

        {view === "faces" && <Faces d={d} people={people} isMine={isMine} onTap={tap} picking={picking} />}
        {view === "rank" && (
          <>
            <Patterns
              patterns={d.patterns}
              onPick={(p) =>
                move(() => {
                  setStat(p.stat);
                  setFilter(p.filter);
                })
              }
            />
            <div className="mb-2.5">
              <Select label="Beside it" value={beside ?? "none"} options={[["none", "Nothing"], ...d.stats.map((s) => [s.key, s.name] as [string, string])]} onChange={(v) => setBeside(v === "none" ? null : v)} />
            </div>
            <div className="my-2.5 flex gap-2">
              <button
                type="button"
                data-compare
                onClick={() => {
                  setPicking(picking ? null : []);
                  if (!picking) toast("Tap two people to compare");
                }}
                className={`flex h-9 items-center gap-1.5 rounded-[3px] px-3 text-[13px] font-bold ${picking ? "bg-foreground text-background" : "outline-1 -outline-offset-1 outline-input"}`}
              >
                <ArrowLeftRight className="size-[15px]" aria-hidden />
                {picking ? `Pick two · ${picking.length}/2` : "Compare two"}
              </button>
              <button type="button" data-share onClick={share} className="flex h-9 items-center gap-1.5 rounded-[3px] px-3 text-[13px] font-bold outline-1 -outline-offset-1 outline-input">
                <Send className="size-[15px]" aria-hidden />
                Share this
              </button>
            </div>
            <Rank d={d} people={people} stat={ranked.key} beside={beside} isMine={isMine} onTap={tap} picking={picking} />
          </>
        )}
        {view === "heat" && <Heat d={d} people={people} onTap={tap} />}
      </section>
      <StorySheet
        d={all}
        name={story}
        title={show.header?.show.name ?? ""}
        onClose={() => setStory(null)}
        onFlag={
          couchId
            ? (episode, who) => {
                setStory(null);
                setTimeout(() => setFlagging({ episode, who }), 230);
              }
            : null
        }
      />
      {flagging && couchId && <DisputeSheet seasonId={seasonId} couchId={couchId} episode={flagging.episode} who={flagging.who} onClose={() => setFlagging(null)} />}
      <CompareSheet d={d} pair={compare} title={show.header?.show.name ?? ""} onClose={() => setCompare(null)} />
    </>
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
 *  picker uses it too. */
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

/** What the numbers show without being asked (worked out on the server): each a Rank view that shows it. */
function Patterns({ patterns, onPick }: { patterns: Pattern[]; onPick: (p: Pattern) => void }) {
  if (!patterns.length) return null;
  return (
    <div className="mb-3 mt-1 flex flex-col gap-1.5">
      {patterns.map((p) => (
        <button
          key={p.text}
          type="button"
          data-pattern={p.stat}
          onClick={() => onPick(p)}
          className="flex w-full items-center gap-2 rounded-[3px] bg-card px-2.5 py-[9px] text-left text-[13px] leading-snug outline-1 -outline-offset-1 outline-input"
        >
          <Zap className="size-4 flex-none text-muted-foreground" aria-hidden />
          <span className="flex-1">{p.text}</span>
          <ChevronRight className="size-3.5 flex-none text-muted-foreground" aria-hidden />
        </button>
      ))}
    </div>
  );
}

// ---------- the three views ----------

type ViewProps = { d: SeasonStats; people: CastStat[]; onTap: (c: CastStat) => void; picking?: string[] | null; isMine?: (c: CastStat) => boolean };

const outLine = (c: CastStat) => `Out · Ep ${c.out}${c.role ? ` · ${c.role}` : ""}`;

function YourTeamTag() {
  return <span className="type-caption absolute left-[5px] top-[5px] rounded-[2px] bg-foreground px-1.5 py-0.5 text-[10px] tracking-[0.04em] text-background">Your team</span>;
}

function Faces({ d, people, onTap, picking, isMine }: ViewProps) {
  // By group now (as far as you've seen), else (no groups, or a faction that's a secret role) Still in.
  const groups: [string, CastStat[], string | null][] = d.groups.length
    ? [...d.groups.map((g) => [g.name, people.filter((c) => c.out === null && c.group === g.name), g.colour] as [string, CastStat[], string]), ["Still in", people.filter((c) => c.out === null && !d.groups.some((g) => g.name === c.group)), null]]
    : [["Still in", people.filter((c) => c.out === null), null]];
  groups.push(["Out", people.filter((c) => c.out !== null), null]);
  return (
    <>
      {groups
        .filter(([, list]) => list.length)
        .map(([name, list, colour]) => (
          <div key={name} className="mt-3" data-group={name}>
            <div className="mb-2 flex items-baseline gap-2">
              {colour && <i className="size-3 self-center rounded-[2px]" style={{ background: colour }} aria-hidden />}
              <b className="type-caption text-[20px]">{name}</b>
              <small className="block text-xs text-muted-foreground">
                {list.length}
                {colour ? ` · ${d.groupWord}` : ""}
              </small>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[...list]
                .sort((p, q) => (name === "Out" ? q.out! - p.out! : q.points - p.points))
                .map((c) => (
                  <Flip key={c.name} id={`face-${c.first}`}>
                    <button
                      type="button"
                      data-cast={c.first}
                      onClick={() => onTap(c)}
                      className={`relative flex flex-col gap-0.5 text-left ${picking?.includes(c.name) ? "rounded-[3px] outline-2 outline-offset-2 outline-good" : ""}`}
                    >
                      <Face src={c.photo} name={c.first} out={c.out !== null} className={`mb-1 aspect-[4/5] w-full rounded-[3px] ${c.out !== null ? "opacity-55" : ""}`} />
                      <b className="type-caption truncate text-[15px]">{c.first}</b>
                      <small className="block text-xs text-muted-foreground">{c.out !== null ? outLine(c) : `${c.points} ${c.points === 1 ? "pt" : "pts"}`}</small>
                      {isMine?.(c) && <YourTeamTag />}
                    </button>
                  </Flip>
                ))}
            </div>
          </div>
        ))}
    </>
  );
}

function Rank({ d, people, stat, beside, onTap, picking, isMine }: ViewProps & { stat: string; beside: string | null }) {
  const s = statOf(d, stat);
  const b = beside ? statOf(d, beside) : null;
  const rows = people.map((c) => ({ c, n: statValue(c, s.key) })).sort((p, q) => q.n - p.n || Number(p.c.out !== null) - Number(q.c.out !== null));
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div data-rank={s.key}>
      {/* Whose points they are: a Weekly Lineup's here, else the rulebook's suggestion. */}
      {s.key === "points" && (
        <p data-points-from className="mb-1.5 text-[12px] text-muted-foreground">
          {d.pointsFrom ? `Points as ${d.pointsFrom} counts them` : "Points as the rulebook suggests them"}
        </p>
      )}
      {rows.map(({ c, n }, i) => (
        <Flip key={c.name} id={`rank-${c.first}`}>
          <button
            type="button"
            data-cast={c.first}
            onClick={() => onTap(c)}
            className={`flex min-h-[58px] w-full items-center gap-2.5 border-t border-border text-left ${c.out !== null ? "opacity-55" : ""} ${picking?.includes(c.name) ? "bg-good/15" : ""}`}
          >
            <span className="type-num w-5 flex-none text-[17px] text-muted-foreground">{i + 1}</span>
            <Face src={c.photo} name={c.first} out={c.out !== null} className="size-[38px] flex-none rounded-[3px]" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <b className="truncate text-[15px]">{c.first}</b>
              <small className="block truncate text-[11px] text-muted-foreground">
                {[c.out !== null ? outLine(c) : isMine?.(c) ? "Your team" : null, b ? `${b.name}: ${statValue(c, b.key)}` : null].filter(Boolean).join(" · ")}
              </small>
              <span className="mt-0.5 block h-[5px] overflow-hidden rounded-[2px] bg-border">
                <i className="block h-full bg-foreground/80" style={{ width: `${(Math.max(0, n) / max) * 100}%` }} />
              </span>
            </span>
            <span className="flex min-w-12 flex-none flex-col items-end">
              <b className="type-num text-[22px]">{n}</b>
              <small className="block text-[10px] text-muted-foreground">{unitFor(s.unit, n)}</small>
            </span>
          </button>
        </Flip>
      ))}
    </div>
  );
}

function Heat({ d, people, onTap }: ViewProps) {
  const eps = Array.from({ length: d.to - d.from + 1 }, (_, i) => d.from + i);
  const rows = [...people].sort((p, q) => q.points - p.points);
  const th = "type-caption h-[34px] whitespace-nowrap border-b border-border bg-background px-2 text-center text-[11px] tracking-[0.04em] text-muted-foreground";
  return (
    <>
      <div className="-mx-4 mt-1.5 overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-sm" data-heat>
          <thead>
            <tr>
              <th className={`${th} sticky left-0 z-[1] min-w-[124px] pl-4 text-left shadow-[6px_0_8px_-6px_rgba(0,0,0,.25)] dark:shadow-[6px_0_8px_-6px_rgba(0,0,0,.7)]`}>Points</th>
              {eps.map((e) => (
                <th key={e} className={th}>
                  Episode {e}
                </th>
              ))}
              <th className={th}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.name} data-cast-row={c.first} onClick={() => onTap(c)} className={`cursor-pointer ${c.out !== null ? "opacity-55" : ""}`}>
                <td className="sticky left-0 z-[1] border-b border-border bg-background pl-4 shadow-[6px_0_8px_-6px_rgba(0,0,0,.25)] dark:shadow-[6px_0_8px_-6px_rgba(0,0,0,.7)]">
                  <span className="flex h-[46px] items-center gap-2 font-semibold">
                    <Face src={c.photo} name={c.first} out={c.out !== null} className="size-[30px] rounded-[3px]" />
                    {c.first}
                  </span>
                </td>
                {eps.map((e, i) => {
                  const p = c.perEp[i];
                  const bg = p == null ? undefined : p > 0 ? `rgba(53,181,165,${Math.min(0.85, 0.15 + p / 10)})` : p < 0 ? `rgba(242,84,91,${Math.min(0.8, 0.25 - p / 8)})` : undefined;
                  return (
                    <td key={e} className="h-[46px] min-w-16 border-b border-border px-2 text-center text-[13px] font-bold tabular-nums" style={{ background: bg }}>
                      {p == null ? "·" : p}
                    </td>
                  );
                })}
                <td className="border-b border-border px-2 text-center font-bold tabular-nums">{c.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] leading-normal text-muted-foreground">Green scored, red lost points, · already out. Tap a row for their story.</p>
    </>
  );
}

// ---------- a castaway's story, two side by side ----------

function useKept<T>(value: T | null): T | null {
  const [kept, setKept] = useState(value);
  if (value && value !== kept) setKept(value);
  return value ?? kept;
}

/** Their season so far, episode by episode: what the results recorded and what it scored. From the whole season's
 *  stats, whatever the slider says. A result the shared check has from one source so far says so (step 6b), and each
 *  episode with something recorded can be flagged ("Something wrong?"). */
function StorySheet({ d, name, title, onClose, onFlag }: { d: SeasonStats; name: string | null; title: string; onClose: () => void; onFlag: ((episode: number, who: string) => void) | null }) {
  const kept = useKept(name);
  const c = kept ? d.cast.find((x) => x.name === kept) : null;
  const names = new Map(d.stats.map((s) => [s.key, s.name]));
  return (
    <Sheet open={!!name} onOpenChange={(o) => !o && onClose()} title={c?.name ?? ""} subtitle={c ? `${title} · up to Episode ${d.through}${c.out !== null ? ` · out in Episode ${c.out}` : ""}` : undefined}>
      {c && (
        <div className="mt-3 flex gap-3 pb-2" data-story={c.first}>
          <Face src={c.photo} name={c.first} out={c.out !== null} className="h-[90px] w-[72px] flex-none rounded-[3px]" />
          <div className="min-w-0 flex-1">
            {c.group && (
              <p className="text-sm text-muted-foreground">
                {cap(d.groupWord)}: <b className="text-foreground">{c.group}</b>
                {c.start && c.start !== c.group ? ` · started on ${c.start}` : ""}
              </p>
            )}
            {d.roles && (
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
            {Array.from({ length: d.through }, (_, k) => k + 1).map((e) => {
              const ev = c.events.filter(([ep]) => ep === e).map(([, k]) => names.get(k) ?? k);
              const gone = c.out !== null && e > c.out;
              const left = c.out === e;
              const unsure = d.unsure?.[e]?.[c.name];
              return (
                <div key={e} data-story-ep={e} className="flex min-h-11 items-center gap-2.5 border-b border-border py-1.5 text-[13px] leading-snug">
                  <span className="type-num grid size-[26px] flex-none place-items-center rounded-[3px] bg-secondary text-[15px]">{e}</span>
                  <span className="flex-1">
                    {[...ev, left ? (c.how ?? "Left the game") : null].filter(Boolean).join(" · ") || (gone ? "Already out" : "Nothing recorded")}
                    {unsure && (
                      <i data-unsure={unsure} className="ml-1.5 whitespace-nowrap rounded-[2px] bg-secondary px-1.5 py-px text-[11px] font-bold not-italic text-muted-foreground">
                        {unsure === "disputed" ? "Disputed" : "1 source"}
                      </i>
                    )}
                  </span>
                  <b className="type-num text-base">{gone ? "" : c.perEp[e - 1]}</b>
                  {onFlag && !gone && (ev.length > 0 || left) && (
                    <button type="button" data-story-flag={e} aria-label={`Something wrong in Episode ${e}`} onClick={() => onFlag(e, c.name)} className="-mr-2 grid size-11 flex-none place-items-center text-muted-foreground">
                      <Ellipsis className="size-5" aria-hidden />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Sheet>
  );
}

function CompareSheet({ d, pair, title, onClose }: { d: SeasonStats; pair: [string, string] | null; title: string; onClose: () => void }) {
  const kept = useKept(pair);
  const shown = kept ? kept.map((n) => d.cast.find((c) => c.name === n)).filter((c): c is CastStat => !!c) : [];
  return (
    <Sheet open={!!pair} onOpenChange={(o) => !o && onClose()} title="Side by side" subtitle={`${title} · Episodes ${d.from === d.to ? d.from : `${d.from}–${d.to}`}`}>
      {shown.length === 2 && (
        <div className="mt-3 pb-2" data-compare-sheet>
          <div className="mb-2 flex justify-between">
            {shown.map((c) => (
              <span key={c.name} className="flex w-[45%] flex-col items-center gap-1">
                <Face src={c.photo} name={c.first} className="size-16 rounded-[3px]" />
                <b>{c.first}</b>
              </span>
            ))}
          </div>
          {d.stats.map((s) => {
            const [a, b] = shown.map((c) => statValue(c, s.key));
            return (
              <div key={s.key} className="grid min-h-10 grid-cols-[44px_1fr_44px] items-center border-b border-border text-center text-[13px] text-muted-foreground">
                <b className={`type-num text-[20px] ${a > b ? "text-good" : "text-foreground"}`}>{a}</b>
                <span className="px-1 leading-snug">{s.name}</span>
                <b className={`type-num text-[20px] ${b > a ? "text-good" : "text-foreground"}`}>{b}</b>
              </div>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}
