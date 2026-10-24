"use client";

import { startTransition, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeftRight, ChevronDown, ChevronRight, Send, Zap } from "lucide-react";
import { CAST, EVENT_NAME, SEEN, STATS, TRIBES, statValue, unitFor, type CastMember } from "../fixtures/cast";
import { TEAMS } from "../fixtures/standings";
import type { ShowData } from "../screens/show-space";
import { Flip } from "../ui/flip";
import { Preview } from "../ui/preview";
import { Sheet } from "../ui/sheet";
import { Face } from "./parts";

// Cast: the stats explorer (the mock's explorer.js, decided 2026-10-23), for anyone, in a game or not. Faces grouped
// by tribe (a secret faction would group Still in / Out, and is never a filter), Rank by one stat at a time by its
// full name with a second beside it, Patterns, Compare two and Share, and By episode as a heatmap. One episode
// slider sets the range for all three, capped at where you are. A face opens their story, episode by episode. No
// ownership dots: in a game, your castaways say "Your team". On fixtures behind Preview until step 3 counts
// season_decisions through the guard. `?rank=<stat>` opens Rank sorted by it (Tonight's Stats card).

type View = "faces" | "rank" | "heat";
const statOf = (key: string) => STATS.find((s) => s.key === key) ?? STATS[0];
const mine = (c: CastMember) => TEAMS.alex.includes(c.first);

export function Cast({ show }: { show: ShowData }) {
  const asked = useSearchParams().get("rank");
  const [view, setView] = useState<View>(asked ? "rank" : "faces");
  const [stat, setStat] = useState(asked && STATS.some((s) => s.key === asked) ? asked : "pts");
  const [beside, setBeside] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [range, setRange] = useState<[number, number]>([1, SEEN]);
  const [picking, setPicking] = useState<string[] | null>(null);
  const [story, setStory] = useState<CastMember | null>(null);
  const [compare, setCompare] = useState<[CastMember, CastMember] | null>(null);
  const [from, to] = range;
  // Same people, new places: re-sorts and filters move each face from its old spot (ui/flip.tsx).
  const move = (fn: () => void) => startTransition(fn);

  const groups = Object.keys(TRIBES).filter((t) => CAST.some((c) => c.tribe === t && !c.out));
  const filters: [string, string][] = [["all", "Everyone"], ["in", "Still in"], ["out", "Out"], ...groups.map((t) => [t, t] as [string, string]), ...(show.games.some((g) => g.yourRole) ? [["mine", "Your team"] as [string, string]] : [])];
  const people = CAST.filter((c) => filter === "all" || (filter === "in" && !c.out) || (filter === "out" && !!c.out) || (filter === "mine" && mine(c)) || (c.tribe === filter && !c.out));

  const tap = (c: CastMember) => {
    if (!picking) return setStory(c);
    const next = picking.includes(c.name) ? picking.filter((n) => n !== c.name) : [...picking, c.name].slice(-2);
    if (next.length === 2) {
      setPicking(null);
      setCompare([CAST.find((x) => x.name === next[0])!, CAST.find((x) => x.name === next[1])!]);
    } else setPicking(next);
  };

  return (
    <>
      <Preview id="show.cast" className="mx-2 mt-5 px-2 pb-4 pt-4">
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
              data-try
              data-view={k}
              onClick={() => setView(k)}
              className={`h-[38px] flex-1 rounded-[3px] text-sm font-bold ${view === k ? "bg-foreground text-background" : "bg-card text-muted-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <EpisodeSlider max={SEEN} range={range} onChange={(r) => move(() => setRange(r))} />
        <div className={`mb-2.5 grid gap-2 ${view === "rank" ? "grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]" : "grid-cols-1"}`}>
          {view === "rank" && <Select label="Ranked by" value={stat} options={STATS.map((s) => [s.key, s.name])} onChange={(v) => move(() => setStat(v))} main />}
          <Select label="Show" value={filter} options={filters} onChange={(v) => move(() => setFilter(v))} />
        </div>

        {view === "faces" && <Faces people={people} from={from} to={to} onTap={tap} picking={picking} />}
        {view === "rank" && (
          <>
            <Patterns
              onPick={(p) =>
                move(() => {
                  setStat(p.stat);
                  setFilter(p.filter);
                })
              }
            />
            <div className="mb-2.5">
              <Select label="Beside it" value={beside ?? "none"} options={[["none", "Nothing"], ...STATS.map((s) => [s.key, s.name] as [string, string])]} onChange={(v) => setBeside(v === "none" ? null : v)} />
            </div>
            <div className="my-2.5 flex gap-2">
              <button
                type="button"
                data-try
                onClick={() => setPicking(picking ? null : [])}
                className={`flex h-9 items-center gap-1.5 rounded-[3px] px-3 text-[13px] font-bold ${picking ? "bg-foreground text-background" : "outline-1 -outline-offset-1 outline-input"}`}
              >
                <ArrowLeftRight className="size-[15px]" aria-hidden />
                {picking ? `Pick two · ${picking.length}/2` : "Compare two"}
              </button>
              <button type="button" className="flex h-9 items-center gap-1.5 rounded-[3px] px-3 text-[13px] font-bold outline-1 -outline-offset-1 outline-input">
                <Send className="size-[15px]" aria-hidden />
                Share this
              </button>
            </div>
            <Rank people={people} stat={stat} beside={beside} from={from} to={to} onTap={tap} picking={picking} />
          </>
        )}
        {view === "heat" && <Heat people={people} from={from} to={to} onTap={tap} />}
      </Preview>
      <StorySheet c={story} onClose={() => setStory(null)} />
      <CompareSheet pair={compare} from={from} to={to} onClose={() => setCompare(null)} />
    </>
  );
}

// ---------- the controls ----------

/** Two thumbs on one track: from and to, capped at where you are. */
function EpisodeSlider({ max, range, onChange }: { max: number; range: [number, number]; onChange: (r: [number, number]) => void }) {
  const [live, setLive] = useState(range);
  const [a, b] = [Math.min(...live), Math.max(...live)];
  if (max < 2) return null;
  const pct = (n: number) => ((n - 1) / (max - 1)) * 100;
  const set = (i: 0 | 1, v: number) => setLive((r) => (i ? [r[0], v] : [v, r[1]]));
  const done = () => onChange([a, b]);
  return (
    <div className="mb-2.5" data-try>
      <div className="flex items-baseline justify-between">
        <span className="type-caption text-[13px] tracking-[0.04em] text-muted-foreground">Episodes</span>
        <b className="type-num text-[22px]">{a === b ? a : `${a} – ${b}`}</b>
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

/** A native dropdown dressed as a field: any number of options fits (imported shows name their own stats). */
function Select({ label, value, options, onChange, main }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void; main?: boolean }) {
  const on = options.find((o) => o[0] === value) ?? options[0];
  return (
    <label
      data-try
      className={`relative flex min-h-[54px] min-w-0 flex-col items-start justify-center gap-px rounded-[3px] bg-card py-[7px] pl-2.5 pr-7 focus-within:outline-2 focus-within:outline-foreground ${main ? "outline-[1.5px] -outline-offset-1 outline-foreground" : "outline-1 -outline-offset-1 outline-input"}`}
    >
      <small className="block text-[11px] text-muted-foreground">{label}</small>
      <b className="max-w-full truncate text-sm leading-tight">{on[1]}</b>
      <ChevronDown className="absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="absolute inset-0 size-full cursor-pointer text-base opacity-0">
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

/** What the numbers show without being asked: each a Rank view that shows it. */
function Patterns({ onPick }: { onPick: (p: { stat: string; filter: string }) => void }) {
  const live = CAST.filter((c) => !c.out);
  const avg = Object.keys(TRIBES)
    .map((t) => {
      const m = live.filter((c) => c.tribe === t);
      return [t, m.length ? m.reduce((x, c) => x + statValue(c, "immunity"), 0) / m.length : null] as const;
    })
    .filter((x): x is readonly [string, number] => x[1] != null)
    .sort((x, y) => x[1] - y[1]);
  const votedOut = CAST.filter((c) => c.out && c.how === "Voted Out");
  const warned = votedOut.filter((c) => c.events.some(([ep, k]) => k === "survivedVotes" && ep < c.out!));
  const idols = CAST.filter((c) => statValue(c, "idols"));
  const found = [
    avg.length > 1 && {
      text: `${avg[0][0]}'s members have the fewest immunity wins (${avg[0][1].toFixed(1)} each, vs ${avg[avg.length - 1][1].toFixed(1)} on ${avg[avg.length - 1][0]})`,
      stat: "immunity",
      filter: avg[0][0],
    },
    votedOut.length > 0 && { text: `${warned.length} of ${votedOut.length} people voted out had their name written down before`, stat: "against", filter: "all" },
    idols.length > 0 && { text: `${idols.filter((c) => !c.out).length} of ${idols.length} idol finders are still in the game`, stat: "idols", filter: "all" },
  ].filter((p): p is { text: string; stat: string; filter: string } => !!p);
  return (
    <div className="mb-3 mt-1 flex flex-col gap-1.5">
      {found.map((p) => (
        <button
          key={p.text}
          type="button"
          data-try
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

type ViewProps = { people: CastMember[]; from: number; to: number; onTap: (c: CastMember) => void; picking?: string[] | null };

function Faces({ people, from, to, onTap, picking }: ViewProps) {
  const groups: [string, CastMember[], string | null][] = [
    ...Object.keys(TRIBES).map((t) => [t, people.filter((c) => !c.out && c.tribe === t), TRIBES[t]] as [string, CastMember[], string]),
    ["Out", people.filter((c) => c.out), null],
  ];
  return (
    <>
      {groups
        .filter(([, list]) => list.length)
        .map(([name, list, colour]) => (
          <div key={name} className="mt-3">
            <div className="mb-2 flex items-baseline gap-2">
              {colour && <i className="size-3 self-center rounded-[2px]" style={{ background: colour }} aria-hidden />}
              <b className="type-caption text-[20px]">{name}</b>
              <small className="block text-xs text-muted-foreground">
                {list.length}
                {colour ? " · tribe" : ""}
              </small>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[...list]
                .sort((p, q) => (name === "Out" ? q.out! - p.out! : statValue(q, "pts", from, to) - statValue(p, "pts", from, to)))
                .map((c) => (
                  <Flip key={c.name} id={`face-${c.first}`}>
                    <button
                      type="button"
                      data-try
                      data-cast={c.first}
                      onClick={() => onTap(c)}
                      className={`relative flex flex-col gap-0.5 text-left ${picking?.includes(c.name) ? "rounded-[3px] outline-2 outline-offset-2 outline-good" : ""}`}
                    >
                      <Face src={c.photo} out={!!c.out} className={`mb-1 aspect-[4/5] w-full rounded-[3px] ${c.out ? "opacity-55" : ""}`} />
                      <b className="type-caption text-[15px]">{c.first}</b>
                      <small className="block text-xs text-muted-foreground">{c.out ? `Out · Ep ${c.out}` : `${statValue(c, "pts", from, to)} pts`}</small>
                      {mine(c) && (
                        <span className="type-caption absolute left-[5px] top-[5px] rounded-[2px] bg-foreground px-1.5 py-0.5 text-[10px] tracking-[0.04em] text-background">
                          Your team
                        </span>
                      )}
                    </button>
                  </Flip>
                ))}
            </div>
          </div>
        ))}
    </>
  );
}

function Rank({ people, stat, beside, from, to, onTap, picking }: ViewProps & { stat: string; beside: string | null }) {
  const s = statOf(stat);
  const b = beside ? statOf(beside) : null;
  const rows = people.map((c) => ({ c, n: statValue(c, stat, from, to) })).sort((p, q) => q.n - p.n || Number(!!p.c.out) - Number(!!q.c.out));
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div>
      {rows.map(({ c, n }, i) => (
        <Flip key={c.name} id={`rank-${c.first}`}>
          <button
            type="button"
            data-try
            data-cast={c.first}
            onClick={() => onTap(c)}
            className={`flex min-h-[58px] w-full items-center gap-2.5 border-t border-border text-left ${c.out ? "opacity-55" : ""} ${picking?.includes(c.name) ? "bg-good/15" : ""}`}
          >
            <span className="type-num w-5 flex-none text-[17px] text-muted-foreground">{i + 1}</span>
            <Face src={c.photo} out={!!c.out} className="size-[38px] flex-none rounded-[3px]" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <b className="text-[15px]">{c.first}</b>
              <small className="block truncate text-[11px] text-muted-foreground">
                {[c.out ? `Out · Ep ${c.out}` : mine(c) ? "Your team" : null, b ? `${b.name}: ${statValue(c, b.key, from, to)}` : null].filter(Boolean).join(" · ")}
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

function Heat({ people, from, to, onTap }: ViewProps) {
  const eps = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const rows = [...people].sort((p, q) => statValue(q, "pts", from, to) - statValue(p, "pts", from, to));
  const th = "type-caption h-[34px] whitespace-nowrap border-b border-border bg-background px-2 text-center text-[11px] tracking-[0.04em] text-muted-foreground";
  return (
    <>
      <div className="-mx-2 mt-1.5 overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className={`${th} sticky left-0 z-[1] min-w-[124px] pl-4 text-left shadow-[6px_0_8px_-6px_rgba(0,0,0,.7)]`}>Points</th>
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
              <tr key={c.name} data-try onClick={() => onTap(c)} className={`cursor-pointer ${c.out ? "opacity-55" : ""}`}>
                <td className="sticky left-0 z-[1] border-b border-border bg-background pl-4 shadow-[6px_0_8px_-6px_rgba(0,0,0,.7)]">
                  <span className="flex h-[46px] items-center gap-2 font-semibold">
                    <Face src={c.photo} out={!!c.out} className="size-[30px] rounded-[3px]" />
                    {c.first}
                  </span>
                </td>
                {eps.map((e) => {
                  const p = c.perEp[e - 1];
                  const gone = !!c.out && e > c.out;
                  const bg = gone ? undefined : p > 0 ? `rgba(53,181,165,${Math.min(0.85, 0.15 + p / 10)})` : p < 0 ? `rgba(242,84,91,${Math.min(0.8, 0.25 - p / 8)})` : undefined;
                  return (
                    <td key={e} className="h-[46px] min-w-16 border-b border-border px-2 text-center text-[13px] font-bold tabular-nums" style={{ background: bg }}>
                      {gone ? "·" : p}
                    </td>
                  );
                })}
                <td className="border-b border-border px-2 text-center font-bold tabular-nums">{statValue(c, "pts", from, to)}</td>
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

function StorySheet({ c, onClose }: { c: CastMember | null; onClose: () => void }) {
  const shown = useKept(c);
  return (
    <Sheet
      open={!!c}
      onOpenChange={(o) => !o && onClose()}
      title={shown?.name ?? ""}
      subtitle={shown ? `Survivor 51 · up to Episode ${SEEN}${shown.out ? ` · out in Episode ${shown.out}` : ""}` : undefined}
    >
      {shown && (
        <Preview id="show.cast" className="-mx-2 mt-3 px-2 pb-2 pt-3">
          <div className="flex gap-3">
            <Face src={shown.photo} out={!!shown.out} className="h-[90px] w-[72px] flex-none rounded-[3px]" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted-foreground">
                Tribe: <b className="text-foreground">{shown.tribe}</b>
              </p>
              {Array.from({ length: SEEN }, (_, k) => k + 1).map((e) => {
                const ev = shown.events.filter(([ep]) => ep === e).map(([, k]) => EVENT_NAME[k] ?? k);
                return (
                  <div key={e} className="flex min-h-11 items-center gap-2.5 border-b border-border py-1.5 text-[13px] leading-snug">
                    <span className="type-num grid size-[26px] flex-none place-items-center rounded-[3px] bg-secondary text-[15px]">{e}</span>
                    <span className="flex-1">{ev.length ? ev.join(" · ") : shown.out && e > shown.out ? "Already out" : "Nothing recorded"}</span>
                    <b className="type-num text-base">{shown.out && e > shown.out ? "" : shown.perEp[e - 1]}</b>
                  </div>
                );
              })}
            </div>
          </div>
        </Preview>
      )}
    </Sheet>
  );
}

function CompareSheet({ pair, from, to, onClose }: { pair: [CastMember, CastMember] | null; from: number; to: number; onClose: () => void }) {
  const shown = useKept(pair);
  return (
    <Sheet open={!!pair} onOpenChange={(o) => !o && onClose()} title="Side by side" subtitle={`Survivor 51 · Episodes ${from}–${to}`}>
      {shown && (
        <Preview id="show.cast" className="-mx-2 mt-3 px-2 pb-2 pt-3">
          <div className="mb-2 flex justify-between">
            {shown.map((c) => (
              <span key={c.name} className="flex w-[45%] flex-col items-center gap-1">
                <Face src={c.photo} className="size-16 rounded-[3px]" />
                <b>{c.first}</b>
              </span>
            ))}
          </div>
          {STATS.map((s) => {
            const [a, b] = shown.map((c) => statValue(c, s.key, from, to));
            return (
              <div key={s.key} className="grid min-h-10 grid-cols-[44px_1fr_44px] items-center border-b border-border text-center text-[13px] text-muted-foreground">
                <b className={`type-num text-[20px] ${a > b ? "text-good" : "text-foreground"}`}>{a}</b>
                <span>{s.name}</span>
                <b className={`type-num text-[20px] ${b > a ? "text-good" : "text-foreground"}`}>{b}</b>
              </div>
            );
          })}
        </Preview>
      )}
    </Sheet>
  );
}
