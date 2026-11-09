"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, X } from "lucide-react";
import { useEpisodeBingo, useEpisodeCalls, useGameQuestions, usePlayerLog, useSeasonStats, type GameView, type QuestionFace, type TableRow } from "../data";
import type { ShowData } from "../screens/show-space";
import { gameColour, ordinal } from "../games";
import { Avatar } from "../ui/bars";
import { Sheet } from "../ui/sheet";
import type { Square } from "@/lib/game/game-plays";
import { StoryBody } from "./cast";
import { LineupSheet, signed } from "./lineup-sheet";
import { faceIn, first } from "./moves";
import { Face } from "./parts";
import { answerWords, verdictWords } from "./questions";

// The sheet family on a game's page and the Games tab (docs/PLAN-start-a-game-gpt.md U1, "Step 2 brief": the sheet family, once;
// U0's canvas v58, boards R4 and R6, `make_person_sheet.js` and `make_hybrid.js`). Every name, square, episode and face is a door to
// the next view down, keeping the episode you were on: a person's sheet (their strip of weeks in the game's own terms, the chosen
// episode's plays in their scored state, then the season), an episode's sheet (everyone's plays that night, ‹ › through the
// episodes), a castaway in this game (who holds or picked them and how it went, then their story), the rules. Each opens as a sheet
// over the last with the path back on top ("Survival Pool › Joanna ›", each part a way back); the phone's back takes the top one
// down (sheet-history.ts), Close shuts them all. The squares come from GameView.plays (game-plays.ts), only as far as you've seen;
// anyone's next move says only whether it's set. A lineup's sheet is today's (lineup-sheet.tsx), kept as it is.

export type Door = { kind: "person"; playerId: string; episode: number | null } | { kind: "episode"; episode: number } | { kind: "cast"; id: string } | { kind: "rules" };
type Level = { key: number; door: Door; open: boolean };
export type Drill = { open: (d: Door) => void };

/** The stack of sheets a game's doors open, over whatever's on screen. */
export function useDrill() {
  const [levels, setLevels] = useState<Level[]>([]);
  const n = useRef(0);
  const gone = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A closed sheet stays mounted for its slide down, then goes.
  const tidy = () => {
    if (gone.current) clearTimeout(gone.current);
    gone.current = setTimeout(() => setLevels((ls) => ls.filter((l) => l.open)), 450);
  };
  useEffect(() => () => void (gone.current && clearTimeout(gone.current)), []);
  return {
    levels,
    open: (door: Door) => setLevels((ls) => [...ls.filter((l) => l.open), { key: ++n.current, door, open: true }]),
    /** The top sheet becomes another (‹ › through the couch or the episodes): no new level, no new entry. */
    swap: (key: number, door: Door) => setLevels((ls) => ls.map((l) => (l.key === key ? { ...l, door } : l))),
    /** Down to this level (a part of the path): everything above it closes. */
    to: (key: number) => {
      setLevels((ls) => ls.map((l) => (l.key > key ? { ...l, open: false } : l)));
      tidy();
    },
    close: (key: number) => {
      setLevels((ls) => ls.map((l) => (l.key >= key ? { ...l, open: false } : l)));
      tidy();
    },
    closeAll: () => {
      setLevels((ls) => ls.map((l) => ({ ...l, open: false })));
      tidy();
    },
  };
}
export type DrillState = ReturnType<typeof useDrill>;

type Ctx = { g: GameView; show: ShowData; seasonId: string; rules: string[] };

/** Every open level as its own sheet, the newest on top. */
export function DrillSheets({ drill, ...ctx }: Ctx & { drill: DrillState }) {
  const open = drill.levels.filter((l) => l.open);
  return (
    <>
      {drill.levels.map((l) => {
        const at = open.findIndex((x) => x.key === l.key);
        const below = at > 0 ? open.slice(0, at) : [];
        const crumb = l.open && (below.length || at === 0) ? (
          <span className="flex flex-wrap items-center gap-x-1">
            {[{ key: -1, name: ctx.g.gameName }, ...below.map((b) => ({ key: b.key, name: titleOf(b.door, ctx) }))].map((b) => (
              <span key={b.key} className="flex items-center gap-1">
                <button type="button" data-crumb={b.key} onClick={() => (b.key < 0 ? drill.closeAll() : drill.to(b.key))} className="-my-2 py-2 font-semibold text-foreground underline underline-offset-[3px]">
                  {b.name}
                </button>
                <span aria-hidden>›</span>
              </span>
            ))}
          </span>
        ) : null;
        return <Level key={l.key} level={l} drill={drill} crumb={crumb} plain={at > 0} {...ctx} />;
      })}
    </>
  );
}

function titleOf(d: Door, { g, show }: Ctx): string {
  if (d.kind === "person") return g.table.find((r) => r.playerId === d.playerId)?.name ?? "";
  if (d.kind === "episode") return `${show.words.episode} ${d.episode}`;
  if (d.kind === "cast") return first(faceIn(g, d.id)?.name ?? "");
  return "How it plays";
}

function Level({ level, drill, crumb, plain, ...ctx }: Ctx & { level: Level; drill: DrillState; crumb: ReactNode; plain: boolean }) {
  const { g, show } = ctx;
  const d = level.door;
  const go: Drill = { open: drill.open };
  const onOpenChange = (o: boolean) => !o && drill.close(level.key);
  if (d.kind === "person") {
    const people = g.table.filter((r) => opensSheet(g, r));
    const at = people.findIndex((r) => r.playerId === d.playerId);
    const r = people[at];
    const step = (dir: 1 | -1) => {
      const to = people[at + dir];
      if (to) drill.swap(level.key, { ...d, playerId: to.playerId });
    };
    return (
      <Sheet
        open={level.open && !!r}
        onOpenChange={onOpenChange}
        crumb={crumb}
        plain={plain}
        title={r?.name ?? ""}
        subtitle={r ? personLine(g, r) : undefined}
        stepper={people.length > 1 ? { prev: people[at - 1]?.name ?? null, next: people[at + 1]?.name ?? null, onStep: step } : undefined}
      >
        {r && (
          // Keyed by player: each one's sheet starts fresh (the sheet slides them in and out).
          <div key={r.playerId} data-sheet-player={r.playerId} className="mt-1">
            <PersonBody {...ctx} r={r} episode={d.episode} onEpisode={(n) => drill.swap(level.key, { ...d, episode: n })} go={go} onClose={drill.closeAll} />
          </div>
        )}
      </Sheet>
    );
  }
  if (d.kind === "episode") {
    const eps = g.plays.episodes;
    const at = eps.indexOf(d.episode);
    const step = (dir: 1 | -1) => {
      const to = eps[at + dir];
      if (to !== undefined) drill.swap(level.key, { kind: "episode", episode: to });
    };
    return (
      <Sheet
        open={level.open}
        onOpenChange={onOpenChange}
        crumb={crumb}
        plain={plain}
        title={`${show.words.episode} ${d.episode}`}
        subtitle={episodeLine(g, d.episode)}
        stepper={eps.length > 1 ? { prev: at > 0 ? `${show.words.ep} ${eps[at - 1]}` : null, next: at >= 0 && at < eps.length - 1 ? `${show.words.ep} ${eps[at + 1]}` : null, onStep: step } : undefined}
      >
        <EpisodeBody key={d.episode} {...ctx} episode={d.episode} go={go} />
      </Sheet>
    );
  }
  if (d.kind === "cast") {
    const c = faceIn(g, d.id);
    return (
      <Sheet open={level.open && !!c} onOpenChange={onOpenChange} crumb={crumb} plain={plain} title={c?.name ?? ""} subtitle={c ? castLine(g, show, c) : undefined}>
        {c && <CastBody {...ctx} id={d.id} go={go} />}
      </Sheet>
    );
  }
  return (
    <Sheet open={level.open} onOpenChange={onOpenChange} crumb={crumb} plain={plain} title="How it plays" subtitle={g.gameName}>
      <ol className="list-decimal pb-2 pl-[18px] text-[15px] leading-[1.45]" data-rules-sheet>
        {ctx.rules.map((x) => (
          <li key={x} className="mb-2 pl-1">
            {x}
          </li>
        ))}
      </ol>
    </Sheet>
  );
}

/** Whether a row opens a sheet: not a public pool's strangers (usernames, nothing more to open). */
export const opensSheet = (g: GameView, r: TableRow) => !(g.solo === "public" && !r.you);

/** "Survival Pool · 2nd of 4 · streak 4", in the game's own terms. */
function personLine(g: GameView, r: TableRow): string {
  const place = r.rank.startsWith("T") ? r.rank : ordinal(r.place);
  return `${g.gameName} · ${place} of ${g.players} · ${totalWords(g, r)}`;
}

/** A row's total as the game counts it: "19 pts", "5–2", "best streak 4", "3 weeks won". */
export function totalWords(g: GameView, r: TableRow): string {
  const k = g.plays.kind;
  if (k === "result" && r.record) return `${r.record.wins}–${r.record.losses}${r.record.ties ? `–${r.record.ties}` : ""}`;
  if (k === "pick") return `best streak ${r.total}`;
  if (k === "won" && g.weeksWon) {
    const w = g.weeksWon[r.playerId] ?? 0;
    return `${fmt(w)} ${w === 1 ? "week" : "weeks"} won`;
  }
  return `${fmt(r.total)} ${g.linePoints === null && (g.gameType === "weekly-calls" || g.gameType === "weekly-bingo") ? (g.gameType === "weekly-bingo" ? "lines" : "right") : "pts"}`;
}

function episodeLine(g: GameView, n: number): string {
  const sq = g.table.map((r) => sqOf(g, r, n)).filter((s): s is Square => !!s);
  if (g.plays.kind === "pick") {
    const stayed = sq.filter((s) => s.pick?.correct === true).length;
    return `${g.gameName} · ${stayed} of ${sq.filter((s) => s.pick).length} picks stayed`;
  }
  const top = Math.max(0, ...sq.map((s) => s.points ?? 0));
  const best = g.table.filter((r) => sqOf(g, r, n)?.points === top && top > 0).map((r) => (r.you ? "You" : r.name));
  return `${g.gameName} · ${best.length ? `best: ${best.join(", ")} ${signed(top)}` : "nobody scored"}`;
}

function castLine(g: GameView, show: ShowData, c: NonNullable<ReturnType<typeof faceIn>>): string {
  const bits = [show.header?.show.name ?? "", `up to ${show.words.episode} ${g.through}`];
  if (c.left && c.out) bits.push(`out in ${show.words.episode} ${c.out}`);
  return bits.filter(Boolean).join(" · ");
}

const fmt = (n: number) => String(Math.round(n * 10) / 10);
const sqOf = (g: GameView, r: TableRow, n: number) => g.plays.rows[r.playerId]?.find((s) => s.episode === n) ?? null;
/** A seat's first account, for their face. */
const userOfRow = (r: TableRow) => r.userId ?? r.playerId;

// ---------- the person ----------

/** A lineup's weeks are today's lineup sheet; any other game, the strip in its own terms, the chosen episode, then the season. */
export function PersonBody({ g, show, seasonId, r, episode, onEpisode, go, onClose, compact }: Ctx & { r: TableRow; episode: number | null; onEpisode: (n: number) => void; go: Drill; onClose: () => void; compact?: boolean }) {
  const lineup = r.weeks.length > 0 || (g.gameType === "active-roster" && g.plays.blocks.includes("lineup"));
  if (lineup) return <LineupSheet g={g} r={r} week={episode ?? r.weeks.at(-1)?.episode ?? null} onWeek={onEpisode} words={show.words} onClose={onClose} onFace={(id) => go.open({ kind: "cast", id })} noTeam={compact} />;
  const eps = g.plays.episodes;
  if (g.plays.kind === "staged") return <p className="mt-2 pb-2 text-[15px] leading-snug text-muted-foreground">Each stage is a game of its own with its own season: {r.you ? "your" : `${r.name}'s`} plays are on each stage&apos;s page. Here, {totalWords(g, r)} overall.</p>;
  const sel = episode !== null && eps.includes(episode) ? episode : (eps.at(-1) ?? null);
  return (
    <div data-person-sheet={r.playerId} className="pb-2">
      <Strip g={g} r={r} sel={sel} onPick={onEpisode} words={show.words} />
      {sel !== null && <EpisodeBlock g={g} show={show} seasonId={seasonId} r={r} n={sel} go={go} />}
      {sel === null && <p className="mt-3 text-sm text-muted-foreground">Nothing counted yet. It fills in from the first {show.words.episode.toLowerCase()} with results.</p>}
      {!compact && <SeasonBlock g={g} r={r} go={go} words={show.words} />}
    </div>
  );
}

const BAR = 64;

/** The strip of their weeks, one column an episode through your mark, the next saying only whether it's set. */
function Strip({ g, r, sel, onPick, words }: { g: GameView; r: TableRow; sel: number | null; onPick: (n: number) => void; words: ShowData["words"] }) {
  const sq = g.plays.rows[r.playerId] ?? [];
  const next = g.plays.next;
  const set = next ? next.set[r.playerId] : undefined;
  const k = g.plays.kind;
  const many = sq.length + (next ? 1 : 0) > 8;
  const colour = gameColour(g.gameName);
  const vals = sq.map((s) => s.points ?? 0);
  // A week's size either way: a negative one is a hatched bar of its size (lineup-sheet.tsx draws it the same), never the dashed box
  // of a week still to come.
  const max = Math.max(1, ...vals.map((v) => Math.abs(v)));
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  const best = vals.length ? Math.max(...vals) : 0;
  const right =
    k === "pick"
      ? `streak now ${r.week ?? 0}`
      : k === "result" && r.record
        ? `${r.record.wins}–${r.record.losses}${r.record.ties ? `–${r.record.ties}` : ""} · ${fmt(r.record.for)} for`
        : k === "won"
          ? `${sq.filter((s) => s.won).length} won`
          : vals.length
            ? `${fmt(avg)} a ${words.episode.toLowerCase()} · best ${signed(best)} (${words.ep} ${sq[vals.indexOf(best)].episode})`
            : null;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const c = ref.current;
    const col = c?.querySelector<HTMLElement>(`[data-strip-ep="${sel}"]`);
    if (c && col && c.scrollWidth > c.clientWidth) c.scrollLeft = col.offsetLeft - (c.clientWidth - col.offsetWidth) / 2;
  }, [sel]);
  const cols = sq.length + (next ? 1 : 0);
  return (
    <>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <p className="type-caption text-[14px] tracking-[0.02em] text-muted-foreground">{k === "pick" ? "Picks, oldest first" : `${words.episode} by ${words.episode.toLowerCase()}`}</p>
        {right && <small className="text-right text-[13px] text-muted-foreground">{right}</small>}
      </div>
      <div ref={ref} className={`-mx-4 px-4 ${many ? "overflow-x-auto [scrollbar-width:none]" : ""}`}>
        <div className="relative mt-2 grid gap-1" style={{ gridTemplateColumns: many ? `repeat(${cols}, 44px)` : `repeat(${cols}, minmax(0, 1fr))`, width: many ? "max-content" : undefined }} data-strip={k}>
          {(k === "points" || k === "race" || k === "lives") && vals.some((v) => v !== 0) && (
            <span aria-hidden className="pointer-events-none absolute inset-x-0 z-[1] border-t border-dashed border-muted-foreground/60" style={{ top: 26 + (BAR - (Math.max(0, avg) / max) * BAR) }} />
          )}
          {sq.map((s) => {
            const on = s.episode === sel;
            return (
              <button key={s.episode} type="button" data-strip-ep={s.episode} aria-pressed={on} aria-label={`${words.episode} ${s.episode}`} onClick={() => onPick(s.episode)} className={`relative flex min-h-11 flex-col items-center rounded-[3px] py-1.5 ${on ? "bg-secondary" : ""}`}>
                <StripCell g={g} s={s} on={on} max={max} colour={colour} />
                <span className={`mt-1.5 text-[12px] ${on ? "font-bold" : "text-muted-foreground"}`}>{many ? s.episode : `${words.ep} ${s.episode}`}</span>
              </button>
            );
          })}
          {next && (
            <span className="flex flex-col items-center py-1.5" data-strip-next={set === true ? "set" : set === false ? "unset" : "unknown"}>
              <span className={`type-num h-4 text-[15px] leading-4 ${set ? "text-good" : "text-muted-foreground"}`}>{set === true ? "Set" : "—"}</span>
              <span className="mt-1 flex w-full items-end justify-center" style={{ height: k === "pick" || k === "result" ? 40 : BAR }}>
                <span className="h-[18px] w-6 rounded-t-[2px] border-[1.5px] border-dashed border-muted-foreground/60" />
              </span>
              <span className="mt-1.5 text-[12px] text-muted-foreground">{many ? next.episode : `${words.ep} ${next.episode}`}</span>
            </span>
          )}
        </div>
      </div>
    </>
  );
}

function StripCell({ g, s, on, max, colour }: { g: GameView; s: Square; on: boolean; max: number; colour: string }) {
  const k = g.plays.kind;
  if (k === "pick") {
    const c = s.pick?.id ? faceIn(g, s.pick.id) : undefined;
    return (
      <span className="relative mt-0.5 block size-10">
        {s.pick && c ? <Face src={c.photo} name={c.name} className={`size-10 rounded-[3px] text-sm ${s.pick.correct === false ? "opacity-50 grayscale" : ""} ${on ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : ""}`} /> : <span aria-label={s.pick ? "No pick" : undefined} className="block size-10 rounded-[3px] border border-dashed border-edge" />}
        {s.pick && s.pick.correct !== null && <Tick ok={s.pick.correct} className="absolute -right-1 -top-1 size-4" />}
      </span>
    );
  }
  if (k === "result") {
    const r = s.result;
    return (
      <>
        <b className={`type-num mt-0.5 grid size-[30px] place-items-center rounded-[3px] text-[17px] ${r?.r === "W" ? "bg-good text-good-foreground" : r ? "bg-secondary text-foreground" : "text-muted-foreground"}`}>{r?.r ?? "–"}</b>
        <span className="type-num mt-1 whitespace-nowrap text-[13px] text-foreground/85">{r ? `${fmt(r.us)}–${r.them === null ? "·" : fmt(r.them)}` : ""}</span>
      </>
    );
  }
  const v = s.points ?? 0;
  const neg = k !== "race" && v < 0;
  const h = Math.max(3, Math.round((Math.abs(k === "race" ? (s.total ?? 0) : v) / Math.max(1, k === "race" ? (g.plays.target ?? max) : max)) * BAR));
  return (
    <>
      <span className={`type-num h-4 text-[15px] leading-4 ${on ? "" : "text-muted-foreground"}`}>{s.points === null ? "–" : k === "race" ? fmt(s.total ?? 0) : fmt(v)}</span>
      <span className="relative mt-1 flex w-full items-end justify-center" style={{ height: BAR }}>
        <span className={`w-6 rounded-t-[2px] ${neg ? "bg-[repeating-linear-gradient(135deg,var(--muted-foreground)_0_2px,transparent_2px_5px)]" : on ? "" : "bg-muted-foreground/35"}`} style={{ height: h, background: on && !neg ? colour : undefined }} />
        {s.won && <span className="type-caption absolute left-1/2 top-0.5 -translate-x-1/2 rounded-[2px] bg-good px-1 text-[11px] tracking-[0.04em] text-good-foreground">Won</span>}
      </span>
    </>
  );
}

/** Right or wrong. Red is for leaving: a pick that went home crosses in live red; a wrong answer or call (`quiet`) on the raised fill. */
function Tick({ ok, quiet, className = "" }: { ok: boolean; quiet?: boolean; className?: string }) {
  return (
    <span className={`grid place-items-center rounded-full shadow-[0_0_0_1.5px_var(--card)] ${ok ? "bg-good text-good-foreground" : quiet ? "bg-input text-foreground" : "bg-live text-live-foreground"} ${className}`}>
      {ok ? <Check className="size-[70%]" strokeWidth={3.5} aria-label="right" /> : <X className="size-[70%]" strokeWidth={3.5} aria-label="wrong" />}
    </span>
  );
}

/** The chosen episode: its heading (where it placed that week, the points), then its plays by kind. */
function EpisodeBlock({ g, show, seasonId, r, n, go }: { g: GameView; show: ShowData; seasonId: string; r: TableRow; n: number; go: Drill }) {
  const s = sqOf(g, r, n);
  const k = g.plays.kind;
  const head = k === "pick" ? (s?.pick ? (s.pick.correct === null ? "Waiting" : s.pick.correct ? "Stayed" : "Went home") : "No pick") : k === "result" ? (s?.result ? s.result.r : "–") : s?.points === null || !s ? "–" : signed(s.points);
  return (
    <section data-episode-block={n} className="mt-[22px] border-t border-border pt-[18px]">
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <button type="button" data-door-episode={n} onClick={() => go.open({ kind: "episode", episode: n })} className="type-caption -my-1 py-1 text-left text-[26px] underline decoration-border decoration-2 underline-offset-[5px]">
            {show.words.episode} {n}
          </button>
          <p className="mt-1 text-[13px] text-muted-foreground">{blockLine(g, r, n, s)}</p>
        </div>
        <b className={`type-num flex-none text-[34px] leading-none ${(k === "result" && s?.result?.r === "W") || (k === "pick" && s?.pick?.correct) ? "text-good" : ""}`}>{head}</b>
      </div>
      {g.plays.blocks.map((b) => (
        <Block key={b} kind={b} g={g} show={show} seasonId={seasonId} r={r} n={n} s={s} go={go} />
      ))}
    </section>
  );
}

function blockLine(g: GameView, r: TableRow, n: number, s: Square | null): string {
  const k = g.plays.kind;
  if (k === "result" && s?.result) {
    const who = s.result.against ? (g.table.find((x) => x.playerId === s.result!.against)?.name ?? s.result.against) : s.result.median ? "the couch's middle score" : "a bye";
    const by = s.result.them === null ? "" : ` by ${fmt(Math.abs(s.result.us - s.result.them))}`;
    return `${s.result.round ? `Playoffs, round ${s.result.round} · ` : ""}${s.result.r === "W" ? `Beat ${who}${by}` : s.result.r === "L" ? `Lost to ${who}${by}` : `Tied with ${who}`}`;
  }
  if (k === "pick") return s?.pick?.id ? `Picked ${faceIn(g, s.pick.id)?.name ?? "someone"}` : s?.pick ? "No pick · missed" : "No pick counted";
  const of = g.table.map((x) => sqOf(g, x, n)?.points ?? 0);
  const mine = s?.points ?? 0;
  const above = of.filter((p) => p > mine).length;
  const tied = of.filter((p) => p === mine).length > 1;
  return `${tied ? "Tied " : ""}${ordinal(above + 1)} of ${g.table.length} that ${g.plays.kind === "won" ? "week" : "episode"}${s?.won ? " · won it" : ""}`;
}

type BlockProps = { kind: string; g: GameView; show: ShowData; seasonId: string; r: TableRow; n: number; s: Square | null; go: Drill };

function Block(p: BlockProps) {
  switch (p.kind) {
    case "pick":
      return <PickBlock {...p} />;
    case "boots":
      return <BootsBlock {...p} />;
    case "answers":
    case "slate":
      return <AnswersBlock {...p} />;
    case "calls":
      return <CallsBlock {...p} />;
    case "card":
      return <CardBlock {...p} />;
    default:
      return <TeamBlock {...p} />;
  }
}

const Caption = ({ children, right }: { children: ReactNode; right?: ReactNode }) => (
  <div className="mb-2 mt-[18px] flex items-baseline justify-between gap-2">
    <p className="type-caption text-[14px] tracking-[0.02em] text-muted-foreground">{children}</p>
    {right && <small className="text-right text-[12.5px] text-muted-foreground">{right}</small>}
  </div>
);

/** A castaway's row in a block: their face and name open them in this game. */
function CastRow({ g, id, line, end, dim, go }: { g: GameView; id: string; line?: ReactNode; end?: ReactNode; dim?: boolean; go: Drill }) {
  const c = faceIn(g, id);
  return (
    <button type="button" data-door-cast={id} onClick={() => go.open({ kind: "cast", id })} className={`nd-press flex min-h-14 w-full items-center gap-3 border-t border-border py-1.5 text-left ${dim ? "text-muted-foreground" : ""}`}>
      <Face src={c?.photo ?? null} name={c?.name} out={c?.knocked} className={`size-10 flex-none rounded-[3px] ${dim ? "opacity-55 grayscale-[0.5]" : ""}`} />
      <span className="min-w-0 flex-1">
        <b className="block truncate text-[15px] font-semibold">{c?.name ?? "Someone"}</b>
        {line && <small className="block truncate text-[13px] text-muted-foreground">{line}</small>}
      </span>
      {end}
    </button>
  );
}

function PickBlock({ g, r, s, go }: BlockProps) {
  if (!s?.pick?.id) return <p className="mt-3 text-sm text-muted-foreground">{r.you ? "You made no pick that counted." : "No pick that counted."}</p>;
  return (
    <>
      <Caption>The pick</Caption>
      <CastRow g={g} id={s.pick.id} go={go} line={s.pick.correct === null ? "Still to be decided" : s.pick.correct ? "Stayed in" : "Went home"} end={s.pick.correct !== null ? <Tick ok={s.pick.correct} className="size-5 flex-none" /> : undefined} dim={s.pick.correct === false} />
    </>
  );
}

function BootsBlock({ g, s, go, show }: BlockProps) {
  const held = s?.held ?? [];
  if (!held.length) return null;
  const left = new Set(s?.left ?? []);
  return (
    <>
      <Caption right={left.size ? `${left.size} left in ${show.words.ep} ${s?.episode}` : "Nobody left"}>The team that {show.words.episode.toLowerCase()}</Caption>
      {[...held].sort((a, b) => Number(left.has(b)) - Number(left.has(a))).map((id) => (
        <CastRow key={id} g={g} id={id} go={go} line={left.has(id) ? "Went home" : "Still in"} dim={left.has(id)} />
      ))}
    </>
  );
}

/** A game where the whole team (or the picks) count: the team as it stands, each opening its castaway. */
function TeamBlock({ g, r, go }: BlockProps) {
  if (!r.team.length) return null;
  return (
    <>
      <Caption right="Points this season">The team</Caption>
      {r.team.map((id) => {
        const c = faceIn(g, id);
        return <CastRow key={id} g={g} id={id} go={go} line={c?.left ? `Out${c.out ? ` · Ep ${c.out}` : ""}` : "Still in"} dim={!!c?.knocked} end={c?.points != null ? <b className="type-num flex-none text-[22px]">{fmt(c.points)}</b> : undefined} />;
      })}
    </>
  );
}

/** Their answers that episode, in their scored state: the question, their answer, what was right, what it earned. Each shows once
 *  it's locked (the questions route's rule): before that, only that it's in. */
function AnswersBlock({ g, seasonId, r, n }: BlockProps) {
  const q = useGameQuestions(seasonId, g.leagueId, n);
  const d = q.data;
  if (q.isPending) return <div aria-busy className="mt-4 h-24 animate-pulse rounded-[3px] bg-background" />;
  if (!d) return <p className="mt-3 text-sm text-muted-foreground">Couldn&apos;t load the answers. Try again in a moment.</p>;
  const cast = new Map<string, QuestionFace>([...d.cast, ...d.groups].map((c) => [c.id, c]));
  const asked = d.questions.filter((x) => x.episode === n);
  if (!asked.length) return <p className="mt-3 text-sm text-muted-foreground">Nothing was asked that episode.</p>;
  return (
    <>
      <Caption>{r.you ? "Your answers" : "Their answers"}</Caption>
      {asked.map((x) => {
        const me = x.people.find((p) => p.playerId === r.playerId);
        const closed = x.status === "closed";
        const words = closed ? (me ? answerWords(x, me.answer, cast) : "") : r.you ? answerWords(x, x.mine, cast) : "";
        return (
          <div key={x.id} data-answer={x.id} className="border-t border-border py-2.5">
            <p className="mb-1.5 flex justify-between gap-2.5 text-[14px] text-foreground/85">
              <span className="min-w-0">{x.ask}</span>
              <span className="flex-none text-[12.5px] text-muted-foreground">{x.points} pts</span>
            </p>
            <div className="flex items-center gap-2.5">
              <span className="min-w-0 flex-1">
                <b className="block text-[15px]">{words || (closed ? "No answer" : r.you ? "Not answered yet" : "Hidden until it locks")}</b>
                <small className="mt-0.5 block text-[13px] text-muted-foreground">{closed ? verdictWords(x, d, cast) : "Still open"}</small>
              </span>
              {closed && me && me.right !== null && <Tick ok={me.right} quiet className="size-5 flex-none" />}
              <b className={`type-num flex-none text-[22px] ${closed && me && me.earned ? "" : "text-muted-foreground"}`}>{closed && me ? (me.right === null ? "–" : signed(me.earned)) : "–"}</b>
            </div>
          </div>
        );
      })}
    </>
  );
}

/** Their calls that episode (Call it's): each call, what they said, right or not. */
function CallsBlock({ show, seasonId, r, n }: BlockProps) {
  const q = useEpisodeCalls(seasonId, show.couch?.id ?? null, n);
  const d = q.data;
  if (q.isPending) return <div aria-busy className="mt-4 h-24 animate-pulse rounded-[3px] bg-background" />;
  if (!d) return <p className="mt-3 text-sm text-muted-foreground">Couldn&apos;t load the calls. Try again in a moment.</p>;
  const me = d.people.find((p) => p.userId === r.userId);
  if (!me) return <p className="mt-3 text-sm text-muted-foreground">{d.status === "closed" ? `${r.you ? "You" : r.name} made no calls that ${show.words.episode.toLowerCase()}.` : "Calls show once it's aired and you've seen it."}</p>;
  return (
    <>
      <Caption right={`${me.right} right`}>{r.you ? "Your calls" : "Their calls"}</Caption>
      {d.questions.map((x) => {
        const said = me.calls[x.key];
        const v = d.verdicts?.[x.key];
        const ok = said == null || !v || v.state !== "known" ? null : v.right.includes(said);
        const label = said == null ? "No call" : (x.options.find((o) => o.key === said)?.label ?? (said === "yes" ? "Yes" : said === "no" ? "No" : said));
        return (
          <div key={x.key} data-call={x.key} className="flex min-h-14 items-center gap-2.5 border-t border-border py-2">
            <span className="min-w-0 flex-1">
              <small className="block text-[13px] text-muted-foreground">{[x.lead, x.what].filter(Boolean).join(" ")}</small>
              <b className="block text-[15px]">{label}</b>
              {v?.state === "off" && <small className="block text-[13px] text-muted-foreground">{v.why}: it doesn&apos;t count</small>}
            </span>
            {ok !== null && <Tick ok={ok} quiet className="size-5 flex-none" />}
          </div>
        );
      })}
    </>
  );
}

/** Their bingo card that episode, marked as they ticked it, a line that counts lit. */
function CardBlock({ show, seasonId, r, n }: BlockProps) {
  const q = useEpisodeBingo(seasonId, show.couch?.id ?? null, n, !!r.userId, r.you ? null : r.userId);
  const d = q.data;
  if (q.isPending) return <div aria-busy className="mt-4 h-40 animate-pulse rounded-[3px] bg-background" />;
  if (!d || d.catchUp !== null) return <p className="mt-3 text-sm text-muted-foreground">{d?.catchUp ? `See ${show.words.episode} ${d.catchUp} first.` : "Couldn't load the card. Try again in a moment."}</p>;
  const ticked = new Set(d.ticked);
  const size = Math.round(Math.sqrt(d.squares.length)) || 3;
  return (
    <>
      <Caption right={`${d.lines.standing} ${d.lines.standing === 1 ? "line" : "lines"}`}>{r.you ? "Your card" : "Their card"}</Caption>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }} data-card-block>
        {d.squares.map((sq, i) => {
          const happened = d.truth?.[i] === "yes";
          const on = ticked.has(i);
          return (
            <span key={sq.key + i} className={`grid min-h-14 place-items-center rounded-[3px] p-1 text-center text-[12px] leading-tight ${on && happened ? "bg-foreground font-bold text-background" : on ? "bg-input text-foreground" : "bg-background text-muted-foreground"}`}>
              {sq.label}
            </span>
          );
        })}
      </div>
    </>
  );
}

/** Then the season: a pool's every pick, a draft's team, or their totals. */
function SeasonBlock({ g, r, go, words }: { g: GameView; r: TableRow; go: Drill; words: ShowData["words"] }) {
  const sq = g.plays.rows[r.playerId] ?? [];
  if (g.plays.kind === "pick") {
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        Best streak {r.total}, streak now {r.week ?? 0}. {r.you ? "Your next pick is yours alone until it's decided." : "Picks stay hidden from the couch until they're decided."}
      </p>
    );
  }
  if (g.plays.blocks.includes("boots") || g.plays.blocks.includes("team") || g.plays.blocks.includes("counted")) {
    if (g.plays.blocks.includes("team") || !r.team.length) return null;
    return (
      <>
        <Caption right={`${fmt(r.total)} pts`}>The team now</Caption>
        {r.team.map((id) => {
          const c = faceIn(g, id);
          return <CastRow key={id} g={g} id={id} go={go} line={c?.left ? `Out${c.out ? ` · ${words.episode} ${c.out}` : ""}${c.place ? ` · finished ${ordinal(c.place)}` : ""}` : "Still in"} dim={!!c?.knocked} end={<b className="type-num flex-none text-[22px]">{fmt(c?.points ?? 0)}</b>} />;
        })}
      </>
    );
  }
  const played = sq.filter((s) => s.points !== null);
  if (!played.length) return null;
  return (
    <p className="mt-4 text-sm text-muted-foreground">
      {fmt(played.reduce((t, s) => t + (s.points ?? 0), 0))} over {played.length} {played.length === 1 ? words.episode.toLowerCase() : `${words.episode.toLowerCase()}s`}
      {g.plays.target !== null ? `, ${fmt(Math.max(0, g.plays.target - (sq.at(-1)?.total ?? 0)))} short of ${fmt(g.plays.target)}` : ""}. {r.you ? "" : `${r.name}'s next move shows only once it's set, never what it is.`}
    </p>
  );
}

// ---------- an episode ----------

/** Everyone's plays that night, a row each: a name opens them on this episode, a face its castaway. */
function EpisodeBody({ g, show, episode, go }: Ctx & { episode: number; go: Drill }) {
  const k = g.plays.kind;
  return (
    <div data-episode-sheet={episode} className="pb-2">
      <Caption>{k === "pick" ? "Everyone's pick" : k === "result" ? "Every matchup" : "Everyone's night"}</Caption>
      {g.table.filter((r) => opensSheet(g, r)).map((r) => {
        const s = sqOf(g, r, episode);
        const pickId = s?.pick?.id ?? null;
        const face = pickId ? faceIn(g, pickId) : undefined;
        return (
          <div key={r.playerId} className="flex min-h-14 items-center gap-3 border-t border-border py-1.5" data-episode-row={r.playerId}>
            <button type="button" data-door-person={r.playerId} onClick={() => go.open({ kind: "person", playerId: r.playerId, episode })} className="nd-press flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left">
              <Avatar id={userOfRow(r)} name={r.name} size={28} />
              <span className="min-w-0 flex-1">
                <b className="flex items-center gap-1.5 text-[15px] font-semibold">
                  <span className="truncate">{r.name}</span>
                  {r.you && <span className="type-caption rounded-[2px] bg-foreground px-1.5 py-0.5 text-[10px] tracking-[0.06em] text-background">You</span>}
                </b>
                <small className="block truncate text-[13px] text-muted-foreground">
                  {k === "pick" ? (pickId ? `Picked ${face?.name ?? "someone"}${s?.pick?.correct === null ? "" : s?.pick?.correct ? ", who stayed" : ", who went home"}` : s?.pick ? "No pick · missed" : "No pick that counted") : blockLine(g, r, episode, s)}
                </small>
              </span>
            </button>
            {k === "pick" && pickId ? (
              <button type="button" data-door-cast={pickId} onClick={() => go.open({ kind: "cast", id: pickId })} className="relative flex-none">
                <Face src={face?.photo ?? null} name={face?.name} className={`size-10 rounded-[3px] ${s?.pick?.correct === false ? "opacity-50 grayscale" : ""}`} />
                {s?.pick?.correct != null && <Tick ok={s.pick.correct} className="absolute -right-1 -top-1 size-4" />}
              </button>
            ) : k === "pick" ? (
              <span aria-hidden className="block size-10 flex-none rounded-[3px] border border-dashed border-edge" />
            ) : (
              <b className={`type-num flex-none text-[22px] ${s?.best ? "" : "text-muted-foreground"}`}>{k === "result" ? (s?.result ? `${fmt(s.result.us)}` : "–") : s?.points == null ? "–" : signed(s.points)}</b>
            )}
          </div>
        );
      })}
      <p className="mt-3 text-[13px] text-muted-foreground">The arrows above step through the {show.words.episode.toLowerCase()}s. The next one&apos;s moves stay hidden until they&apos;re decided.</p>
    </div>
  );
}

// ---------- a castaway in this game ----------

/** A group as a small tag in its own colour (Tags Not Fills), its ink plate ink or white by contrast. */
function TribeTag({ name, colour }: { name: string; colour: string }) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(colour.trim());
  const lum = m ? [m[1], m[2], m[3]].map((h) => parseInt(h, 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((t, c, i) => t + c * [0.2126, 0.7152, 0.0722][i], 0) : 0;
  return (
    <span className="type-caption rounded-[2px] px-1.5 py-0.5 text-[12px] tracking-[0.04em]" style={{ background: colour, color: lum > 0.18 ? "var(--plate-foreground)" : "#ffffff" }}>
      {name}
    </span>
  );
}

/** Who holds or picked them in this game and how it went, then their story (the Castaways tab's), up to your mark. */
function CastBody({ g, show, seasonId, id, go }: Ctx & { id: string; go: Drill }) {
  const c = faceIn(g, id)!;
  // A sport's player: their games (a game log) where a castaway has their story (U1's sports slice).
  const sport = show.header?.show.kind === "sport";
  const stats = useSeasonStats(seasonId, show.couch?.id ?? null, null, !sport);
  const log = usePlayerLog(seasonId, c.name, sport);
  const story = stats.data?.cast.find((x) => x.name === c.name) ?? null;
  const rows: { r: TableRow; line: string; ok: boolean | null; points: number | null }[] = [];
  for (const r of g.table.filter((x) => opensSheet(g, x))) {
    const picked = (g.plays.rows[r.playerId] ?? []).filter((s) => s.pick?.id === id);
    if (picked.length) {
      const last = picked.at(-1)!;
      rows.push({ r, line: `Picked ${first(c.name)} for ${picked.map((s) => `${show.words.ep} ${s.episode}`).join(", ")}`, ok: last.pick!.correct, points: null });
      continue;
    }
    const starts = r.weeks.filter((w) => w.started.some((x) => x.id === id));
    if (r.team.includes(id) || starts.length) {
      const earned = starts.reduce((t, w) => t + (w.started.find((x) => x.id === id)?.points ?? 0), 0);
      rows.push({ r, line: starts.length ? `Counted for ${r.you ? "you" : r.name} in ${starts.length} ${starts.length === 1 ? show.words.episode.toLowerCase() : `${show.words.episode.toLowerCase()}s`}` : `On ${r.you ? "your" : `${r.name}'s`} team`, ok: null, points: starts.length ? earned : null });
    }
  }
  const next = g.plays.next;
  return (
    <div data-cast-sheet={id} className="pb-2">
      <div className="mt-1 flex items-center gap-2 text-[13px] text-muted-foreground">
        {c.role && <span className="type-caption rounded-[2px] px-1.5 py-0.5 text-[12px] tracking-[0.04em] outline-1 -outline-offset-1 outline-edge" data-cast-role>{c.role}</span>}
        {c.tribe && <TribeTag name={c.tribe.name} colour={c.tribe.colour} />}
        {!sport && <span>{c.left ? `Out${c.out ? ` · ${show.words.episode} ${c.out}` : ""}` : "Still in"}</span>}
        {c.points !== null && <span>· {fmt(c.points)} pts in this game</span>}
      </div>
      <Caption right={rows.length ? `${rows.length} on the couch` : undefined}>In this game</Caption>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">Nobody here holds or has picked {first(c.name)} so far.</p>}
      {rows.map(({ r, line, ok, points }) => (
        <button key={r.playerId} type="button" data-door-person={r.playerId} onClick={() => go.open({ kind: "person", playerId: r.playerId, episode: null })} className="nd-press flex min-h-14 w-full items-center gap-3 border-t border-border py-1.5 text-left">
          <Avatar id={userOfRow(r)} name={r.name} size={28} />
          <span className="min-w-0 flex-1">
            <b className="block truncate text-[15px] font-semibold">{r.you ? "You" : r.name}</b>
            <small className="block truncate text-[13px] text-muted-foreground">{line}</small>
          </span>
          {ok !== null && <Tick ok={ok} className="size-5 flex-none" />}
          {points !== null && <b className="type-num flex-none text-[22px]">{signed(points)}</b>}
        </button>
      ))}
      {g.plays.kind === "pick" && next && <p className="mt-2 text-[13px] text-muted-foreground">Who&apos;s picked them for {show.words.ep} {next.episode} stays hidden until it&apos;s decided.</p>}
      {sport ? (
        <>
          <Caption right="Newest first">Their games</Caption>
          {log.isPending ? (
            <div aria-busy className="h-24 animate-pulse rounded-[3px] bg-background" />
          ) : log.data?.games.length ? (
            <div data-game-log>
              {log.data.games.map((x) => (
                <div key={x.episode} className="border-t border-border py-2" data-log-game={x.episode}>
                  <p className="flex items-baseline justify-between gap-2 text-[14px] font-semibold">
                    <span className="truncate">
                      {show.words.ep} {x.episode}
                      {x.opponent ? ` · ${x.opponent}` : ""}
                    </span>
                    {x.at && <small className="flex-none text-[12px] font-normal text-muted-foreground">{new Date(x.at).toLocaleDateString([], { month: "short", day: "numeric" })}</small>}
                  </p>
                  <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{x.items.length ? x.items.map((i) => `${i.value} ${i.label}`).join(" · ") : "Played, no stats in the box score"}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No games of {first(c.name)}&rsquo;s here yet.</p>
          )}
          {log.data?.newer && <p className="mt-2 text-[13px] text-muted-foreground">A later game&rsquo;s line is in: it shows once you&rsquo;ve seen that game.</p>}
        </>
      ) : (
        <>
          <Caption right="Newest first">Their story</Caption>
          {stats.isPending ? <div aria-busy className="h-24 animate-pulse rounded-[3px] bg-background" /> : story && stats.data ? <StoryBody d={stats.data} c={story} group={false} /> : <p className="text-sm text-muted-foreground">Nothing recorded for {first(c.name)} yet.</p>}
        </>
      )}
    </div>
  );
}

/** The doors of whichever game was tapped (the Games tab's tables): its person sheet first, then down from there. The game is read
 *  fresh from the show each render, so a reveal under an open sheet moves it too. */
export function useGameDrill(show: ShowData) {
  const drill = useDrill();
  const [id, setId] = useState<string | null>(null);
  const g = id ? (show.play?.find((x) => x.leagueId === id) ?? null) : null;
  return {
    openPerson: (row: TableRow, game: GameView, week: number | null) => {
      setId(game.leagueId);
      drill.open({ kind: "person", playerId: row.playerId, episode: week });
    },
    sheets: g ? <DrillSheets drill={drill} g={g} show={show} seasonId={show.header?.seasonId ?? ""} rules={g.rules} /> : null,
  };
}
