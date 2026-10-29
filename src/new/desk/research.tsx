"use client";

import { useState, type ComponentType } from "react";
import { useQuery } from "@tanstack/react-query";
import { Zap, Check, CircleHelp, Clock, Copy, DoorOpen, Grid3x3, Lock, Minus, Plus, RotateCcw, Tv, Users, X } from "lucide-react";
import { KINDS, LADDER, MAX_RUNS, NOW_ORDER, TRIVIA_AFTER_END, USUAL, and, cap, dur, isUsual, missing, runTime, usualAfter, when, type Run, type RunKind } from "@/lib/desk-bot-words";
import { paths } from "../routes";
import { Btn, EmptyState } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { deskGet, deskSend, useAfterDesk, type DeskResearch, type NowEpisode, type RailRow, type ResearchRun } from "./data";
import { DeskHeader, DeskRow, Facts, IconLead, LatestHistory, LowerThird, Section, useChangeToast } from "./parts";
import { SeasonDeleteRow } from "./setup";

// A season's Research and the bot (docs/PLAN-desk-parity.md step 4, part 4a; the mock's desk-research.js rsPage), from the
// season page's Running it: Autopilot on or off and the next run in the lower third; Run now (five kinds, each saying what it
// does before it asks, queued behind whatever the bot is asking: one question at a time); its schedule drawn as the next
// episode's night (each run at its time, its switch, its timing in a sheet; the episode's length; Add a run, Reset, and our
// usual runs it hasn't got); Runs (done, failed, asking with how far it's got, waiting); History; the season's Delete. The
// page polls while a run asks or waits. Server: src/lib/server/desk-research.ts; schedule changes desk-bot.ts setSeasonBot.

type Kind = RunKind;
const ICON: Record<Kind, ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = { full: Check, quick: DoorOpen, schedule: Clock, trivia: CircleHelp, bingo: Grid3x3 };
const NOTE = "mt-3 text-[13px] leading-snug text-muted-foreground";
const LINK = "inline-flex min-h-11 items-center text-[14px] font-bold underline decoration-input underline-offset-[3px]";
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** The stepper's value: "5min", "1½hr", "9hr", "24hr". */
const durN = (m: number) => (m < 60 ? [m, "min"] : m % 60 === 30 ? [`${Math.floor(m / 60)}½`, "hr"] : m % 60 ? [m, "min"] : [m / 60, "hr"]) as [number | string, string];

function usePage(id: string) {
  const path = `/seasons/${id}/research`;
  return useQuery({
    queryKey: ["new-design", "desk", path],
    queryFn: () => deskGet<DeskResearch>(path),
    staleTime: 15_000,
    // While a run asks or waits, how far it's got.
    refetchInterval: (q) => (q.state.data?.log.some((l) => l.ok === null) ? 3000 : false),
    retry: (n, e) => (e as { status?: number }).status !== 403 && (e as { status?: number }).status !== 404 && n < 2,
  });
}

/** A schedule change (tier 1): every desk read moves on, then its toast with Undo. */
function useBotChange(id: string) {
  const changed = useChangeToast();
  const after = useAfterDesk();
  return async (body: { on?: boolean; schedule?: Run[]; episodeMinutes?: number; reset?: true }) => {
    try {
      const out = await deskSend<{ changeId: string | null; text: string }>(`/seasons/${id}/research`, body);
      await after();
      if (out.changeId) changed(out.text, out.changeId);
    } catch (e) {
      toast.quiet((e as Error).message);
    }
  };
}

type SheetState =
  | { k: "now"; kind: Kind; episode?: number | "season" }
  | { k: "run"; run: ResearchRun }
  | { k: "time"; i: number }
  | { k: "add" }
  | { k: "addKind"; kind: Kind }
  | { k: "reset" }
  | { k: "length" }
  | { k: "runs" }
  | null;

export function ResearchPage({ id }: { id: string }) {
  const q = usePage(id);
  const change = useBotChange(id);
  const [sheet, setSheet] = useState<SheetState>(null);
  const back = { label: "Season", href: paths.deskItem("season", id) };
  if (q.error)
    return (
      <>
        <DeskHeader title="Research" back={back} name={null} />
        <EmptyState title="Not here" line={(q.error as Error).message} />
      </>
    );
  if (!q.data)
    return (
      <>
        <DeskHeader title="Research" back={back} name={null} />
        <div aria-busy className="mx-4 mt-6 h-64 animate-pulse rounded-[4px] bg-card" />
      </>
    );
  const r = q.data;
  const close = () => setSheet(null);
  const usual = isUsual(r.runs);
  const miss = missing(r.runs);
  const full = r.runs.length >= MAX_RUNS;
  const add = (run: Run) => (full ? toast.quiet(`A season has ${MAX_RUNS} runs at most: take one off first`) : change({ schedule: [...r.runs, { ...run, on: true }] }));
  return (
    <div className="pb-16" data-desk-research={r.on ? "on" : "off"}>
      <DeskHeader title="Research" back={{ label: r.name, href: paths.deskItem("season", id) }} name="Research" />
      <LowerThird tag={r.on ? "Autopilot on" : "Autopilot off"} tone={r.on ? "quiet" : "stopped"} title={r.name} detail={r.next} />
      <Facts>{r.meta}</Facts>

      <Section title="Run now" aside="One at a time">
        <div data-run-now className="grid grid-cols-2 gap-2">
          {NOW_ORDER.map((k, i) => {
            const Icon = ICON[k];
            return (
              <button
                key={k}
                type="button"
                data-run-now-kind={k}
                onClick={() => setSheet({ k: "now", kind: k })}
                className={`nd-press flex min-h-[66px] gap-2.5 rounded-[4px] bg-card p-3 text-left outline-1 -outline-offset-1 outline-input ${i ? "items-start" : "col-span-2 items-center"}`}
              >
                <Icon className="mt-px size-5 flex-none" aria-hidden />
                <span className="min-w-0">
                  <b className="block text-[15px] leading-tight">{KINDS[k].t}</b>
                  <small className="mt-[3px] block text-[12.5px] leading-snug text-muted-foreground">{KINDS[k].now}</small>
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section
        title="Its schedule"
        aside={
          usual ? (
            "Our usual five"
          ) : (
            <button type="button" data-reset onClick={() => setSheet({ k: "reset" })} className="text-[14px] font-bold text-foreground underline decoration-input underline-offset-[3px]">
              Reset
            </button>
          )
        }
      >
        <button type="button" role="switch" aria-checked={r.on} data-switch="autopilot" data-on={r.on ? "on" : "off"} onClick={() => change({ on: !r.on })} className="nd-press flex min-h-[60px] w-full items-center gap-3 text-left">
          <span className="min-w-0 flex-1">
            <b className="block text-[16px]">Runs on its own</b>
            <small className="block text-[13px] leading-snug text-muted-foreground">
              {r.on ? `${r.since ? `Since ${r.since}. ` : ""}Couches see "Autopilot · On for this season."` : "Off: nothing below runs. Run now still works."}
            </small>
          </span>
          <Pill on={r.on} />
        </button>
        {r.rail ? (
          <>
            <div className="mb-1 mt-5 flex items-baseline justify-between gap-3">
              <h3 className="type-caption text-[18px] text-muted-foreground">Around Episode {r.rail.n}</h3>
              <span className="text-[13px] text-muted-foreground">{cap(r.rail.airs)}</span>
            </div>
            <Rail rows={r.rail.rows} paused={!r.on} onLength={() => setSheet({ k: "length" })} onRun={(i) => setSheet({ k: "time", i })} onSwitch={(i) => change({ schedule: r.runs.map((x, k) => (k === i ? { ...x, on: !x.on } : x)) })} />
            {r.rail.note && <p className={NOTE}>{r.rail.note}</p>}
          </>
        ) : (
          <p data-rail-none className="mt-3 rounded-[4px] bg-card p-3.5 text-[14px] text-muted-foreground">
            {r.railNote}
          </p>
        )}
        <div className="mt-1 flex items-center justify-between gap-3 border-t border-border">
          <button type="button" data-add-run onClick={() => (full ? toast.quiet(`A season has ${MAX_RUNS} runs at most: take one off first`) : setSheet({ k: "add" }))} className={LINK}>
            Add a run
          </button>
          <span className="text-[13px] text-muted-foreground">
            {r.runs.length} of {MAX_RUNS}
          </span>
        </div>
        {miss.length > 0 && (
          <>
            <div className="mb-1 mt-5 flex items-baseline justify-between gap-3">
              <h3 className="type-caption text-[18px] text-muted-foreground">Not in its schedule</h3>
              <span className="text-[13px] text-muted-foreground">Our usual runs</span>
            </div>
            <div data-missing className="border-b border-border">
              {miss.map((m, j) => (
                <div key={`${m.kind}@${m.after}`} data-missing-run={`${m.kind}@${m.after}`} className="flex min-h-[62px] items-center gap-3 border-t border-border">
                  <IconLead icon={ICON[m.kind]} />
                  <span className="min-w-0 flex-1">
                    <b className="block text-[15px] font-semibold">
                      {KINDS[m.kind].t}
                      {miss.slice(0, j).some((y) => y.kind === m.kind) || (m.kind === "full" && r.runs.some((y) => y.kind === "full")) ? ", again" : ""}
                    </b>
                    <small className="block text-[13px] text-muted-foreground">{cap(when(m))}</small>
                  </span>
                  <Btn data-add-missing={`${m.kind}@${m.after}`} className="h-11 px-4 text-[15px]" onClick={() => add(m)}>
                    Add
                  </Btn>
                </div>
              ))}
            </div>
          </>
        )}
      </Section>

      <Section
        title="Runs"
        aside={
          r.logTotal > 5 ? (
            <button type="button" data-runs-all onClick={() => setSheet({ k: "runs" })} className="text-[14px] font-bold text-foreground underline decoration-input underline-offset-[3px]">
              All {r.logTotal}
            </button>
          ) : undefined
        }
      >
        {r.log.length ? (
          <div data-runs className="border-b border-border">
            {r.log.slice(0, 5).map((l) => (
              <RunRow key={l.id} run={l} onClick={() => setSheet({ k: "run", run: l })} />
            ))}
          </div>
        ) : (
          <p className="rounded-[4px] bg-card p-3.5 text-[14px] text-muted-foreground">Nothing has run yet. Run now asks straight away.</p>
        )}
      </Section>

      {/* Not in the games yet (part 4b): no badge anywhere (decision 7), here for anyone who wants to look. */}
      <Section title="Not in the games yet" aside={r.waiting.length ? plural(r.waiting.reduce((a, w) => a + w.count, 0), "result") : undefined}>
        {r.waiting.length ? (
          <div data-waiting-episodes className="border-b border-border">
            {r.waiting.map((w) => (
              <DeskRow key={w.n} data="waiting-episode" href={paths.deskEpisode(id, w.n)} lead={<EpisodeNumber n={w.n} />} title={`Episode ${w.n}`} line={w.line} />
            ))}
          </div>
        ) : (
          <p className="rounded-[4px] bg-card p-3.5 text-[14px] text-muted-foreground">Everything its sources reported is in the games.</p>
        )}
      </Section>

      <LatestHistory lines={r.history} emptyLine="Nothing changed yet." />
      <SeasonDeleteRow id={id} del={r.delete} showId={r.show.id} />

      <NowSheet open={sheet?.k === "now"} onClose={close} r={r} kind={sheet?.k === "now" ? sheet.kind : "full"} episode={sheet?.k === "now" ? sheet.episode : undefined} />
      <RunSheet run={sheet?.k === "run" ? sheet.run : null} onClose={close} r={r} onAgain={(kind, episode) => setTimeout(() => setSheet({ k: "now", kind, episode }), 250)} />
      <TimeSheet open={sheet?.k === "time" || sheet?.k === "addKind"} onClose={close} r={r} i={sheet?.k === "time" ? sheet.i : null} kind={sheet?.k === "addKind" ? sheet.kind : null} change={change} />
      <Sheet open={sheet?.k === "add"} onOpenChange={(o) => !o && close()} title="Add a run" subtitle={`${r.name} · ${r.runs.length} of ${MAX_RUNS}`}>
        <div className="flex flex-col gap-2">
          {NOW_ORDER.map((k) => (
            <button key={k} type="button" data-add-kind={k} onClick={() => setSheet({ k: "addKind", kind: k })} className="nd-press flex items-start gap-3 rounded-[3px] bg-background p-3.5 text-left">
              <IconLead icon={ICON[k]} />
              <span className="min-w-0">
                <b className="block text-[16px]">{KINDS[k].t}</b>
                <small className="text-[13px] leading-snug text-muted-foreground">{KINDS[k].add}</small>
              </span>
            </button>
          ))}
        </div>
      </Sheet>
      <Sheet open={sheet?.k === "reset"} onOpenChange={(o) => !o && close()} title="Reset to our usual five" subtitle={r.name}>
        <p className="mb-2 text-[14px] text-muted-foreground">
          Replaces its {plural(r.runs.length, "run")} with these{r.rail ? `, shown around Episode ${r.rail.n}` : ""}:
        </p>
        <div data-reset-list className="border-b border-border">
          {USUAL.map((u, i) => (
            <div key={`${u.kind}@${u.after}`} className="flex min-h-[62px] items-center gap-3 border-t border-border">
              <IconLead icon={ICON[u.kind]} />
              <span className="min-w-0 flex-1">
                <b className="block text-[15px] font-semibold">
                  {KINDS[u.kind].t}
                  {i === 2 ? ", again" : ""}
                </b>
                <small className="block text-[13px] text-muted-foreground">
                  {cap(when(u))}
                  {r.rail ? ` · ${timeOf(r.rail, u) ?? "not around this one"}` : ""}
                </small>
              </span>
            </div>
          ))}
        </div>
        <Btn
          data-reset-go
          tone="must"
          wide
          className="mt-4"
          onClick={() => {
            close();
            void change({ reset: true });
          }}
        >
          Reset to these five
        </Btn>
      </Sheet>
      <LengthSheet open={sheet?.k === "length"} onClose={close} r={r} change={change} />
      <Sheet open={sheet?.k === "runs"} onOpenChange={(o) => !o && close()} title="Runs" subtitle={`${r.name} · the latest ${r.logTotal}`}>
        <AllRuns id={id} onRun={(run) => setTimeout(() => setSheet({ k: "run", run }), 250)} close={close} />
      </Sheet>
    </div>
  );
}

/** An episode's number as a row's lead (the mock's .dk-sn). */
export function EpisodeNumber({ n }: { n: number }) {
  return <span className="type-num grid w-10 flex-none place-items-center text-[26px] text-muted-foreground">{n}</span>;
}

function Pill({ on }: { on: boolean }) {
  return (
    <span className={`relative h-[30px] w-[52px] flex-none rounded-full transition-colors ${on ? "bg-foreground" : "bg-secondary"}`}>
      <i className={`absolute top-[3px] size-6 rounded-full transition-[left] ${on ? "left-[25px] bg-background" : "left-[3px] bg-muted-foreground"}`} />
    </span>
  );
}

/** When a run lands around the rail's episode (runTime: db/bot-research.js dueAt's rule): "fri, 7:00 AM", or null for never. */
function timeOf(rail: NonNullable<DeskResearch["rail"]>, run: { kind: Kind; after: number }): string | null {
  const t = runTime(run, Date.parse(rail.endAt), rail.nextAt ? Date.parse(rail.nextAt) : null, Date.parse(rail.airAt));
  if (t === null) return null;
  const d = new Date(t);
  const day = (x: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: rail.tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(x);
  const gap = Math.round((Date.parse(`${day(d)}T00:00:00Z`) - Date.parse(`${day(new Date())}T00:00:00Z`)) / 86_400_000);
  const hour = Number(d.toLocaleString("en-US", { timeZone: rail.tz, hour: "numeric", hour12: false }));
  const w =
    gap === 0
      ? hour >= 17
        ? "tonight"
        : "today"
      : gap === 1
        ? "tomorrow"
        : gap === -1
          ? "yesterday"
          : d.toLocaleString("en-US", { timeZone: rail.tz, ...(gap > 1 && gap < 7 ? { weekday: "short" } : { month: "short", day: "numeric" }) }).replace(",", "");
  return `${w}, ${d.toLocaleString("en-US", { timeZone: rail.tz, hour: "numeric", minute: "2-digit" })}`;
}

/** The next episode's night: a time, the rail, each thing on it, a run's switch (the mock's rsRundown). */
function Rail({ rows, paused, onLength, onRun, onSwitch }: { rows: RailRow[]; paused: boolean; onLength: () => void; onRun: (i: number) => void; onSwitch: (i: number) => void }) {
  return (
    <div data-rail className="relative">
      {rows.map((row, k) => {
        const first = k === 0;
        const last = k === rows.length - 1;
        const line = <span className={`absolute left-[9px] w-0.5 bg-input ${first ? "top-1/2" : "top-0"} ${last ? "bottom-1/2" : "bottom-0"}`} />;
        if (row.type === "now")
          return (
            <div key="now" data-rail-now className="relative flex min-h-[30px] items-center">
              <span className="absolute bottom-0 left-[83px] top-0 w-0.5 bg-input" />
              <span className="type-caption relative z-[1] whitespace-nowrap bg-background pr-2 text-[13px] tracking-[0.06em] text-chyron-line">
                Now {row.hm} {row.ap}
              </span>
              <span className="relative h-0.5 flex-1 bg-chyron" />
            </div>
          );
        const time = (
          <span className="flex w-16 flex-col gap-[3px]">
            <small className="type-caption text-[12px] tracking-[0.06em] text-muted-foreground">{row.day}</small>
            <b className="type-num whitespace-nowrap text-[24px] leading-none">
              {row.hm}
              <i className="ml-0.5 text-[11px] font-bold not-italic text-muted-foreground">{row.ap}</i>
            </b>
          </span>
        );
        const marker = row.type === "run";
        const dot = !marker
          ? `rounded-[2px] ${paused ? "bg-input" : "bg-foreground"}`
          : row.done
            ? row.done.ok
              ? "rounded-full bg-good"
              : "rounded-full bg-live"
            : `rounded-full bg-background outline-2 -outline-offset-2 ${paused || !row.on ? "outline-input" : "outline-foreground"}`;
        const node = (
          <span className="relative w-5 self-stretch">
            {line}
            {row.type === "start" && <span className={`absolute bottom-0 left-[7px] top-1/2 w-1.5 ${paused ? "bg-input" : "bg-foreground"}`} />}
            {row.type === "end" && <span className={`absolute bottom-1/2 left-[7px] top-0 w-1.5 ${paused ? "bg-input" : "bg-foreground"}`} />}
            <i className={`absolute left-1 top-1/2 -mt-1.5 size-3 ${dot}`} />
          </span>
        );
        if (row.type === "start")
          return (
            <div key={row.key} data-rail-row="start" className="grid min-h-16 grid-cols-[64px_20px_minmax(0,1fr)_auto] items-center gap-x-2.5">
              {time}
              {node}
              <span className="min-w-0">
                <b className="type-caption block text-[19px] leading-[1.1]">{row.title}</b>
                <small className="mt-0.5 block text-[13px] text-muted-foreground">{row.line}</small>
              </span>
              <span />
            </div>
          );
        if (row.type === "end")
          return (
            <button key={row.key} type="button" data-rail-row="end" aria-label={`${row.line}. Change it`} onClick={onLength} className="nd-press grid min-h-16 w-full grid-cols-[64px_20px_minmax(0,1fr)_auto] items-center gap-x-2.5 text-left">
              {time}
              {node}
              <span className="min-w-0">
                <b className="type-caption block text-[19px] leading-[1.1]">{row.title}</b>
                <small className="mt-0.5 block text-[13px] text-muted-foreground">{row.line}</small>
              </span>
              <span className="pr-0.5 text-[14px] font-bold underline decoration-input underline-offset-[3px]">Change</span>
            </button>
          );
        return (
          <div key={row.key} data-rail-row={row.key} data-on={row.on ? "on" : "off"} className="grid min-h-16 grid-cols-[64px_20px_minmax(0,1fr)_auto] items-center gap-x-2.5">
            {time}
            {node}
            <button type="button" data-rail-run={row.key} onClick={() => onRun(row.i!)} className="min-h-14 min-w-0 py-2 text-left">
              <b className={`block text-[16px] font-semibold leading-snug ${paused || !row.on ? "text-muted-foreground" : ""}`}>{row.title}</b>
              <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{row.line}</small>
              {row.done && (
                <em className="mt-1 flex items-center gap-1 text-[12.5px] not-italic">
                  {row.done.ok ? <Check className="size-3.5 flex-none text-good" aria-hidden /> : <X className="size-3.5 flex-none text-live" aria-hidden />}
                  <span className="truncate">{row.done.line}</span>
                </em>
              )}
            </button>
            <button type="button" role="switch" aria-checked={!!row.on} aria-label={row.title} data-rail-switch={row.key} onClick={() => onSwitch(row.i!)} className="-mr-[3px] grid h-12 w-[58px] place-items-center rounded-[3px]">
              <Pill on={!!row.on} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function RunRow({ run, onClick }: { run: ResearchRun; onClick: () => void }) {
  const st = run.ok === null ? "go" : run.ok ? "ok" : "no";
  return (
    <button type="button" data-run={run.id} data-run-state={run.queued ? "waiting" : st} onClick={onClick} className="nd-press flex min-h-[74px] w-full items-center gap-3 border-t border-border py-2.5 text-left">
      <StatusSquare st={st} />
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-semibold leading-snug">{run.title}</b>
        <small className="mt-0.5 block text-[13px] text-muted-foreground">{run.line}</small>
        {run.ok === null ? (
          <>
            <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-secondary">
              <i className="block h-full rounded-full bg-foreground transition-[width]" style={{ width: `${Math.max(6, Math.round((run.share ?? 0) * 100))}%` }} />
            </span>
            <em data-run-progress className="mt-1 block text-[13px] not-italic">
              {run.result}
            </em>
          </>
        ) : (
          <em className={`mt-1 block truncate text-[13px] not-italic ${run.ok ? "" : "text-live"}`}>{run.result}</em>
        )}
      </span>
    </button>
  );
}

function StatusSquare({ st }: { st: "go" | "ok" | "no" }) {
  return (
    <span className={`grid size-10 flex-none place-items-center rounded-[3px] ${st === "go" ? "bg-foreground text-background" : st === "ok" ? "bg-good/15 text-good" : "bg-live/15 text-live"}`}>
      {st === "go" ? <Zap className="size-[18px] animate-pulse" aria-hidden /> : st === "ok" ? <Check className="size-[18px]" strokeWidth={2.4} aria-hidden /> : <X className="size-[18px]" strokeWidth={2.4} aria-hidden />}
    </span>
  );
}

function AllRuns({ id, onRun, close }: { id: string; onRun: (r: ResearchRun) => void; close: () => void }) {
  const q = useQuery({ queryKey: ["new-design", "desk", `/seasons/${id}/runs`], queryFn: () => deskGet<{ runs: ResearchRun[] }>(`/seasons/${id}/runs`) });
  if (!q.data) return <div aria-busy className="h-40 animate-pulse rounded-[4px] bg-background" />;
  return (
    <div data-runs-all-list className="border-b border-border">
      {q.data.runs.map((l) => (
        <RunRow
          key={l.id}
          run={l}
          onClick={() => {
            close();
            onRun(l);
          }}
        />
      ))}
    </div>
  );
}

/** What a Run now does, in plain words, before it asks (the mock's rsWhat). */
function whatItDoes(r: DeskResearch, kind: Kind, e: number | "season", ep: NowEpisode | undefined): [ComponentType<{ className?: string; "aria-hidden"?: boolean }>, string][] {
  // "all 3 games", or with none playing it yet, "every game on it".
  const G = r.games ? `all ${plural(r.games, "game")}` : "every game on it";
  if (kind === "quick")
    return [
      [DoorOpen, `Asks who left Episode ${e}, and how, and its headline.`],
      [Users, `Sure of it, it's a source like a couch's answer: with one more agreeing, ${G} ${r.games === 1 ? "has" : "have"} it. Not sure, it waits in each couch's Backstage for "It's right" or "Not right".`],
    ];
  if (kind === "full")
    return [
      [Check, `Asks Episode ${e}'s whole checklist: everyone in the cast, every result ${r.name}'s rulebook scores.`],
      [Users, `Its answer is a source of its own. Where it agrees with what's in${ep?.others.length ? ` (${and(ep.others)})` : ""}, those results are confirmed and reach ${G}; where it disagrees, they're disputed.`],
      ...(ep?.botAt ? ([[RotateCcw, `It replaces our bot's earlier answer for Episode ${e} (${ep.botAt}).`]] as [typeof Check, string][]) : []),
      [Clock, `It also says when Episode ${Number(e) + 1} airs and how long it runs.`],
    ];
  if (kind === "schedule") {
    const n = (r.now.scheduleEpisode ?? 0) + 1;
    return [
      [Clock, `Asks when Episode ${n} airs and how long it runs. Nothing else.`],
      r.now.timeByHand ? [Lock, `Your ${r.now.timeByHand}, set by hand, stays: an answer only fills what nobody set.`] : [Tv, `What it finds goes with Episode ${n}: reminders, lineup locks and the guide follow it.`],
      [Check, "Nothing to review: no results come from it."],
    ];
  }
  if (kind === "trivia")
    return [
      [CircleHelp, `Writes 6 questions, 3 about Episode ${e} and 3 about the season so far. A second ask checks each: right, only one answer, nothing past it.`],
      [Check, `What passes is asked first in trivia, once someone has seen Episode ${e}. Asking again replaces that batch.`],
    ];
  const kept = e === "season" ? r.now.seasonSquares : (ep?.squares ?? null);
  const nm = e === "season" ? "the season's" : `Episode ${e}'s`;
  return [
    [Grid3x3, e === "season" ? "Writes 30 squares about the season, for any episode without its own. A second ask checks each." : `Writes 30 squares fitted to Episode ${e}: likely, maybe and a few long shots. A second ask checks each.`],
    kept ? [RotateCcw, `If at least 16 pass, they replace ${nm} ${kept} squares; otherwise those stay.`] : [Check, "It keeps them if at least 16 pass."],
  ];
}

function Points({ items }: { items: [ComponentType<{ className?: string; "aria-hidden"?: boolean }>, string][] }) {
  return (
    <ul data-points className="flex flex-col gap-3">
      {items.map(([Icon, t], k) => (
        <li key={k} className="flex gap-3 text-[15px] leading-snug">
          <Icon className="mt-0.5 size-5 flex-none" aria-hidden />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

/** Run now: which episode, what it does, what it waits behind, then Ask it now (tier 2: said before it's asked). */
export function NowSheet({ open, onClose, r, kind, episode }: { open: boolean; onClose: () => void; r: DeskResearch; kind: Kind; episode?: number | "season" }) {
  const after = useAfterDesk();
  const [pick, setPick] = useState<number | "season" | null>(null);
  const [busy, setBusy] = useState(false);
  const eps: { e: number | "season"; label: string; info?: NowEpisode }[] =
    kind === "schedule"
      ? []
      : kind === "bingo"
        ? [...r.now.bingo.map((b) => ({ e: b.n as number | "season", label: b.label, info: b })), { e: "season", label: "For any episode" }]
        : r.now.aired.map((a) => ({ e: a.n, label: a.label, info: a }));
  // Try again on an episode the list doesn't have (an older one, or bingo's once it's aired): asked about as it was.
  if (typeof episode === "number" && kind !== "schedule" && !eps.some((x) => x.e === episode)) eps.unshift({ e: episode, label: "Asked before" });
  const chosen = eps.find((x) => x.e === (pick ?? episode)) ?? eps[0];
  const e: number | "season" = kind === "schedule" ? (r.now.scheduleEpisode ?? 0) : (chosen?.e ?? 0);
  const none = kind === "schedule" ? r.now.scheduleEpisode == null : !eps.length;
  const shut = () => {
    setPick(null);
    onClose();
  };
  const go = async () => {
    setBusy(true);
    try {
      const out = await deskSend<{ text: string }>(`/seasons/${r.id}/runs`, { kind, ...(e === "season" ? { scope: "season" } : { episode: e }) });
      shut();
      toast(out.text);
      await after();
    } catch (err) {
      toast.quiet((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onOpenChange={(o) => !o && shut()} title={`${KINDS[kind].t}, now`} subtitle={r.name}>
      {none ? (
        <p data-now-none className="text-[16px] leading-snug">
          {kind === "bingo" ? "No episode still to come is dated, so there's none to write squares for. The season's bank still works from Setup's schedule." : `Nothing has aired yet: ${KINDS[kind].short} asks about an aired episode.`}
        </p>
      ) : (
        <>
          {eps.length > 0 && (
            <>
              <p className="mb-2 text-[14px] font-bold text-muted-foreground">{kind === "bingo" ? "For" : kind === "trivia" ? "Written after" : "Which episode"}</p>
              <div role="radiogroup" aria-label="Which episode" className="mb-4 grid grid-cols-3 gap-2">
                {eps.map((x) => (
                  <button
                    key={String(x.e)}
                    type="button"
                    role="radio"
                    aria-checked={x.e === e}
                    data-now-episode={String(x.e)}
                    onClick={() => setPick(x.e)}
                    className={`nd-press min-h-14 rounded-[3px] px-3 py-2 text-left ${x.e === e ? "bg-foreground text-background" : "bg-background"}`}
                  >
                    <b className="block text-[15px] leading-tight">{x.e === "season" ? "The season's" : `Episode ${x.e}`}</b>
                    <small className={`block text-[12.5px] ${x.e === e ? "text-background/80" : "text-muted-foreground"}`}>{x.label}</small>
                  </button>
                ))}
              </div>
            </>
          )}
          <Points items={whatItDoes(r, kind, e, chosen?.info)} />
          <p data-now-wait className="mt-4 flex gap-3 text-[14px] leading-snug text-muted-foreground">
            <Clock className="mt-0.5 size-[18px] flex-none" aria-hidden />
            <span>{r.waits ?? `It starts now and takes ${KINDS[kind].took}. You can leave the page.`}</span>
          </p>
          <Btn data-now-go tone="must" wide className="mt-4" disabled={busy} onClick={() => void go()}>
            Ask it now
          </Btn>
        </>
      )}
    </Sheet>
  );
}

/** One run: what it found or why it failed, how many tries it gets, its question, and again. */
function RunSheet({ run, onClose, r, onAgain }: { run: ResearchRun | null; onClose: () => void; r: DeskResearch; onAgain: (kind: Kind, episode: number | "season") => void }) {
  // The run as the page has it now (it polls while one asks).
  const live = run ? (r.log.find((l) => l.id === run.id) ?? run) : null;
  const st = live ? (live.ok === null ? "go" : live.ok ? "ok" : "no") : "go";
  const askable = live && live.kind !== "tiebreak";
  return (
    <Sheet open={!!run} onOpenChange={(o) => !o && onClose()} title={live ? (live.kind === "tiebreak" ? "Tie-break" : KINDS[live.kind].t) : ""} subtitle={live ? `${cap(live.title.split(" · ")[1] ?? "")} · ${live.line.split(" · ")[0]}` : ""}>
      {live && (
        <div data-run-sheet={live.id}>
          <div className="flex items-center gap-3 rounded-[4px] bg-background p-3.5">
            <StatusSquare st={st} />
            <span className="min-w-0 flex-1">
              <b className="block text-[16px]">{live.queued ? "Waiting its turn" : live.ok === null ? "Asking ChatGPT" : live.ok ? `Done${live.seconds ? ` in ${secs(live.seconds)}` : ""}` : "Failed"}</b>
              <small className="block text-[14px] leading-snug">{live.result}</small>
            </span>
          </div>
          <div className="mt-4">
            <Points
              items={
                live.ok === null
                  ? [[Clock, "One question at a time: anything else waits until it's done."]]
                  : live.ok
                    ? live.kind === "full" || live.kind === "tiebreak"
                      ? [[Users, "Where it agreed with another source, those results were confirmed and reached every game; where it disagreed, they're disputed."]]
                      : live.kind === "schedule"
                        ? [[Tv, `Filed with Episode ${live.episode + 1}: reminders, lineup locks and the guide follow it.`]]
                        : live.kind === "bingo"
                          ? [[Grid3x3, "It wrote 30, and a second ask checked each one."]]
                          : live.kind === "trivia"
                            ? [[CircleHelp, "It wrote 6, and a second ask checked each one."]]
                            : [[Users, "Sure of it, it's a source like a couch's answer; not sure, it waits in each couch's Backstage."]]
                    : [
                        [RotateCcw, live.tries],
                        [Users, "Nothing changed: a failed run files nothing."],
                      ]
              }
            />
          </div>
          {/* Its episode's results (part 4b): what it filed, and what's in the games; a bingo run's bank (part 4c). */}
          {live.kind === "bingo" ? (
            <div className="mt-4 border-y border-border">
              <DeskRow
                data="run-bingo"
                href={paths.deskBingo(r.id, live.forSeason ? "season" : live.episode)}
                lead={<IconLead icon={Grid3x3} />}
                title={live.forSeason ? "The season's squares" : `Episode ${live.episode}'s squares`}
                line="The bingo bank"
              />
            </div>
          ) : (
            (live.kind === "full" || live.kind === "quick" || live.kind === "tiebreak" || live.kind === "trivia") &&
            live.episode > 0 && (
              <div className="mt-4 border-y border-border">
                <DeskRow data="run-episode" href={paths.deskEpisode(r.id, live.episode)} lead={<EpisodeNumber n={live.episode} />} title={`Episode ${live.episode}'s results`} line="Its answers, and what's in the games" />
              </div>
            )
          )}
          <div className="mt-4 flex gap-2">
            {live.runId && !live.queued && <CopyQuestion seasonId={r.id} runId={live.runId} />}
            {askable && live.ok !== null && (
              <Btn
                data-run-again
                className="flex-1"
                onClick={() => {
                  onClose();
                  onAgain(live.kind as Kind, live.forSeason ? "season" : live.episode);
                }}
              >
                {live.ok ? "Ask again" : "Try again"}
              </Btn>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}
const secs = (s: number) => (s < 60 ? `${Math.round(s)} seconds` : `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`);

function CopyQuestion({ seasonId, runId }: { seasonId: string; runId: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Btn
      data-run-question
      className="flex-1"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { question } = await deskGet<{ question: string }>(`/seasons/${seasonId}/runs/${runId}`);
          await navigator.clipboard.writeText(question);
          toast("Copied the question it asks");
        } catch (e) {
          toast.quiet((e as Error).message || "Couldn't copy it");
        } finally {
          setBusy(false);
        }
      }}
    >
      <Copy className="size-[18px]" aria-hidden />
      The question
    </Btn>
  );
}

/** A run's timing on a stepper (refusing a duplicate), or take it off; or a new run's (Add it). */
function TimeSheet({ open, onClose, r, i, kind, change }: { open: boolean; onClose: () => void; r: DeskResearch; i: number | null; kind: Kind | null; change: ReturnType<typeof useBotChange> }) {
  const was = i != null ? r.runs[i] : null;
  const k: Kind = was?.kind ?? kind ?? "full";
  const ladder = [...LADDER[KINDS[k].from]];
  const start = was?.after ?? usualAfter(k);
  if (!ladder.includes(start)) ladder.push(start);
  ladder.sort((a, b) => a - b);
  const dupAt = (after: number) => r.runs.some((y, q) => q !== i && y.kind === k && y.after === after);
  let first = ladder.indexOf(start);
  if (!was) while (dupAt(ladder[first]) && first < ladder.length - 1) first++;
  const [j, setJ] = useState<number | null>(null);
  const idx = j ?? first;
  const after = ladder[idx];
  const run = { kind: k, after, on: true };
  const dup = dupAt(after);
  const same = !!was && after === was.after;
  const shut = () => {
    setJ(null);
    onClose();
  };
  const t = r.rail ? timeOf(r.rail, run) : null;
  const [v, unit] = durN(after);
  const from = KINDS[k].from;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && shut()} title={was ? KINDS[k].t : `Add ${KINDS[k].short}`} subtitle={was ? `When it runs · ${r.name}` : `${r.name} · ${r.runs.length} of ${MAX_RUNS} runs`}>
      <div className="flex min-h-16 items-center gap-3">
        <span className="min-w-0 flex-1">
          <b data-time-when className="block text-[16px]">
            {cap(when(run))}
          </b>
          <small className="mt-0.5 block text-[13px] text-muted-foreground">{r.rail ? (t ? `Around Episode ${r.rail.n}: ${t}` : `Not around Episode ${r.rail.n}`) : "No episode coming up"}</small>
        </span>
        <span className="flex flex-none items-center">
          <button type="button" data-time-step="-1" aria-label="Sooner" onClick={() => setJ(Math.max(0, idx - 1))} className="grid size-11 place-items-center rounded-[3px] bg-secondary">
            <Minus className="size-5" aria-hidden />
          </button>
          <b data-time-value className="type-num w-[64px] text-center text-[28px]" aria-live="polite">
            {v}
            <i className="ml-0.5 text-[13px] not-italic text-muted-foreground">{unit}</i>
          </b>
          <button type="button" data-time-step="1" aria-label="Later" onClick={() => setJ(Math.min(ladder.length - 1, idx + 1))} className="grid size-11 place-items-center rounded-[3px] bg-secondary">
            <Plus className="size-5" aria-hidden />
          </button>
        </span>
      </div>
      {dup && (
        <em data-time-dup role="alert" className="mt-1 block text-[14px] not-italic text-live">
          There&apos;s already {KINDS[k].short} {when(run)}.
        </em>
      )}
      <div className="mt-3">
        <Points
          items={[
            [
              Clock,
              from === "end"
                ? `Counted from when the episode ends: its air time plus ${dur(r.minutes)}, or its own length when research knows it.`
                : from === "next"
                  ? `Counted back from when the next episode airs, never sooner than ${dur(TRIVIA_AFTER_END)} after this one ends (for the recaps). With no next episode, from its end.`
                  : "Counted back from when it airs. Never once it has.",
            ],
            [Zap, "The bot's clock hears at once."],
          ]}
        />
      </div>
      <Btn
        data-time-save
        tone="must"
        wide
        className="mt-4"
        disabled={dup || same}
        onClick={() => {
          shut();
          void change({ schedule: was ? r.runs.map((x, q) => (q === i ? { ...x, after } : x)) : [...r.runs, run] });
        }}
      >
        {was ? "Save" : "Add it"}
      </Btn>
      {was && (
        <Btn
          data-time-off
          wide
          className="mt-2"
          onClick={() => {
            shut();
            void change({ schedule: r.runs.filter((_, q) => q !== i) });
          }}
        >
          Take it off the schedule
        </Btn>
      )}
    </Sheet>
  );
}

/** How long each episode runs: every run but trivia's and bingo's counts from the end. */
function LengthSheet({ open, onClose, r, change }: { open: boolean; onClose: () => void; r: DeskResearch; change: ReturnType<typeof useBotChange> }) {
  const [m, setM] = useState<number | null>(null);
  const v = m ?? r.minutes;
  const shut = () => {
    setM(null);
    onClose();
  };
  const [n, unit] = durN(v);
  const ends = r.rail ? new Date(Date.parse(r.rail.airAt) + v * 60_000).toLocaleString("en-US", { timeZone: r.rail.tz, hour: "numeric", minute: "2-digit" }) : null;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && shut()} title="Episode length" subtitle={r.name}>
      <div className="flex min-h-16 items-center gap-3">
        <span className="min-w-0 flex-1">
          <b className="block text-[16px]">How long each episode runs</b>
          <small data-length-ends className="mt-0.5 block text-[13px] text-muted-foreground">
            {ends ? `Episode ${r.rail!.n} ends ${ends}` : ""}
          </small>
        </span>
        <span className="flex flex-none items-center">
          <button type="button" data-length-step="-1" aria-label="Shorter" onClick={() => setM(Math.max(5, v - 5))} className="grid size-11 place-items-center rounded-[3px] bg-secondary">
            <Minus className="size-5" aria-hidden />
          </button>
          <b data-length-value className="type-num w-[64px] text-center text-[28px]" aria-live="polite">
            {n}
            <i className="ml-0.5 text-[13px] not-italic text-muted-foreground">{unit}</i>
          </b>
          <button type="button" data-length-step="1" aria-label="Longer" onClick={() => setM(Math.min(600, v + 5))} className="grid size-11 place-items-center rounded-[3px] bg-secondary">
            <Plus className="size-5" aria-hidden />
          </button>
        </span>
      </div>
      <div className="mt-3">
        <Points
          items={[
            [Clock, "Every run counts from when an episode ends: its air time plus this. Not set, it's an hour."],
            [Check, "An episode whose research says how long it runs (a two-hour finale) keeps its own."],
          ]}
        />
      </div>
      <Btn
        data-length-save
        tone="must"
        wide
        className="mt-4"
        disabled={v === r.minutes}
        onClick={() => {
          shut();
          void change({ episodeMinutes: v });
        }}
      >
        Save
      </Btn>
    </Sheet>
  );
}
