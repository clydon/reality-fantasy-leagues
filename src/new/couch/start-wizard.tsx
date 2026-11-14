"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Bot, Check, ChevronRight, Minus, Plus, Shuffle, Sparkles } from "lucide-react";
import type { Choice, Row, Span, Spec, Step, Wizard, WizardInput } from "@/lib/game/start-wizard/index.js";
import type { GameWordsResult } from "@/lib/server/game-words";
import { LEVEL_WORDS, type BotLevel } from "@/lib/game/computer-players";
import { dayDiff, lockTime, timeOf } from "../clock";
import { useAfterReveal, useHome, wizardApi, type WizardOptions } from "../data";
import { useNav } from "../nav";
import { paths } from "../routes";
import { keepToPath, PracticeFinish, PracticeStrip, said, useNudge } from "../tour/practice";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";

// Start a game, the wizard (docs/PLAN-start-a-game-gpt.md U1; U0's settled board "B, settled", canvas v33: its logic and look,
// not its HTML). The logic is src/lib/game/start-wizard (the engine's rollSpec, our check and describeSpec, on the page the server
// reads: start-spec.ts), loaded when the sheet opens; every game, change and twist here is rolled, checked and worded on the
// phone, and checked again on the server when it starts.
//
//   When it runs   Tonight · The season · Custom (Stages, then Episodes, picked like dates); the default follows where the season is
//   Start from     a rail of every game that fits the stretch (the classic, least effort or play along live, then the rest)
//   The game card  white: its name, its three steps (each a tap to change it), four quick changes (each saying its next step, dashed
//                  with why when there's none), a bet, What scores, How it plays; Your version names what changed, with Undo
//   Describe a new game · Surprise me   our AI (the slow bot's wait, its errors) and Randomize (G4, with keeps)
//   The couch      Tell the couch (only those who watch it or play it here hear, after Start it's 10-second Undo), computer players
//   Start it       the footer: the game's name and what happens next ("Next: everyone picks a team of 4, before 8 PM tonight")
//
// Picks only flow down: a new stretch or a new game starts the changes over, said in a toast with Undo. Yellow is Start it alone.
// The AI's waits outlive the sheet (a module store): leaving brings a See it toast when the game or the moments are ready. No ad yet
// (the user, 2026-11-09: none until an ad network is chosen); the wait says its time, with Keep going.

type WM = typeof import("@/lib/game/start-wizard/index.js");
let loaded: WM | null = null;
const loadWizard = () =>
  import("@/lib/game/start-wizard/index.js").then((m) => {
    loaded = ((m as unknown as { default?: WM }).default ?? m) as WM;
    return loaded;
  });

function useWizardModule(): WM | null {
  const [w, setW] = useState<WM | null>(loaded);
  useEffect(() => {
    if (!w) loadWizard().then(setW, () => setW(null));
  }, [w]);
  return w;
}

// ---------- our AI's waits, kept past the sheet ----------

type Job = {
  kind: "ask" | "moments";
  seasonId: string;
  couchId: string | null;
  words: string;
  /** What the change was to (Creative moments, a moment of your own): the game's name. */
  game?: string;
  started: number;
  state: "wait" | "done" | "error";
  result?: GameWordsResult;
  error?: { status: number; message: string };
};
let jobs: Record<string, Job> = {};
const jobListeners = new Set<() => void>();
const jobKey = (seasonId: string, kind: Job["kind"]) => `${seasonId}|${kind}`;
const setJob = (k: string, j: Job | null) => {
  jobs = { ...jobs };
  if (j) jobs[k] = j;
  else delete jobs[k];
  jobListeners.forEach((l) => l());
};
const NO_JOBS: Record<string, Job> = {};
function useJobs() {
  return useSyncExternalStore(
    (l) => {
      jobListeners.add(l);
      return () => jobListeners.delete(l);
    },
    () => jobs,
    () => NO_JOBS
  );
}

/** Where a See it toast opens the sheet: set by the host (start-game.tsx) so a job can reopen it. */
let reopen: ((seasonId: string, couchId: string | null, screen: Screen) => void) | null = null;
export function setReopen(f: typeof reopen) {
  reopen = f;
}
/** Which screen the sheet is on now (null: closed), so a job that lands while you look doesn't toast. */
let onScreen: { seasonId: string; screen: Screen } | null = null;

function runJob(k: string, asked: Omit<Job, "started" | "state">, call: () => Promise<GameWordsResult>) {
  const job: Job = { ...asked, started: Date.now(), state: "wait" };
  setJob(k, job);
  call().then(
    (result) => {
      if (jobs[k]?.started !== job.started) return;
      setJob(k, { ...job, state: "done", result });
      const looking = onScreen && onScreen.seasonId === job.seasonId && onScreen.screen === (job.kind === "ask" ? "ask" : "moments");
      if (!looking) {
        toast(job.kind === "ask" ? "Your game is ready" : `Our AI found moments for ${job.game ?? "your game"}`, {
          label: job.kind === "ask" ? "See it" : "See them",
          undo: () => reopen?.(job.seasonId, job.couchId, job.kind === "ask" ? "ask" : "moments"),
          ms: 10_000,
        });
      }
    },
    (e: Error & { status?: number }) => {
      if (jobs[k]?.started !== job.started) return;
      setJob(k, { ...job, state: "error", error: { status: e.status ?? 0, message: e.message } });
      const looking = onScreen && onScreen.seasonId === job.seasonId;
      if (!looking) toast.quiet(e.status === 503 ? "Our AI isn't answering: that one didn't count" : e.message);
    }
  );
}

// ---------- the sheet ----------

export type Screen = "home" | "before" | "each" | "win" | "bets" | "scores" | "rules" | "all" | "ask" | "moments";

/** "8 PM tonight", "8 PM tomorrow", "Wed 8 PM": an episode's air time for the footer. */
function whenWords(airAt: string | null | undefined): string | null {
  const t = airAt ? Date.parse(airAt) : NaN;
  if (!Number.isFinite(t)) return null;
  const d = dayDiff(t);
  const at = timeOf(t).replace(":00", "");
  return d === 0 ? `${at} tonight` : d === 1 ? `${at} tomorrow` : lockTime(t).replace(":00", "");
}

/** "tonight", "tomorrow", "Wednesday": the next episode's own word, for Tonight's label and "Just tonight". */
function tonightWord(airAt: string | null | undefined): string | null {
  const t = airAt ? Date.parse(airAt) : NaN;
  if (!Number.isFinite(t)) return null;
  const d = dayDiff(t);
  return d === 0 ? "tonight" : d === 1 ? "tomorrow" : d > 1 && d < 7 ? new Date(t).toLocaleDateString("en-US", { weekday: "long" }) : null;
}

export function WizardSheet({
  open,
  onOpenChange,
  o,
  loading,
  error,
  couchId,
  practice,
  late,
  setLate,
  catchUp,
  setCatchUp,
  first: firstScreen,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  o: WizardOptions | undefined;
  loading: boolean;
  error: Error | null;
  couchId: string | null;
  practice?: { seasonId: string | null; label: string | null; onClose: () => void };
  late: boolean;
  setLate: (v: boolean) => void;
  catchUp: number | null;
  setCatchUp: (v: number | null) => void;
  first?: Screen;
}) {
  const W = useWizardModule();
  const wz = o?.wizard ?? null;
  const input: WizardInput | null = useMemo(() => {
    if (!o || !wz) return null;
    const starts = new Map((wz.page.pack.phases ?? []).map((p) => [p.id, p.starts ?? null]));
    return {
      page: wz.page,
      first: o.from,
      last: wz.last,
      listed: o.starts.map((e) => e.number),
      phases: (wz.page.ctx.phases ?? []).map((p) => ({ id: p.id, name: p.name ?? p.id, starts: starts.get(p.id) ?? o.phases.find((x) => x.id === p.id)?.at ?? null })),
      part: o.part,
      label: o.label,
      tonight: tonightWord(o.starts.find((e) => e.number === o.from)?.airAt),
      only: kindsThatFit(o),
      made: wz.made,
    };
  }, [o, wz]);
  const wizard: Wizard | null = useMemo(() => (W && input ? W.createWizard(input) : null), [W, input]);

  // The tour's practice: the rules "load" for a moment (the user wants the wait felt, briefly), then only Start it goes on.
  const [warming, setWarming] = useState(!!practice);
  useEffect(() => {
    if (!warming) return;
    const t = setTimeout(() => setWarming(false), 2000);
    return () => clearTimeout(t);
  }, [warming]);
  const [practiced, setPracticed] = useState<string | null>(null);

  const body =
    !couchId ? (
      <p className="text-[15px] leading-snug text-muted-foreground">Games are played on a couch. Start one and send the code, or join one with a code.</p>
    ) : error ? (
      <p className="text-[15px] text-muted-foreground">{error.message}</p>
    ) : o?.blocked ? (
      <NotAGame o={o} couchId={couchId} onClose={() => onOpenChange(false)} practice={!!practice} />
    ) : practiced ? (
      <PracticeFinish line={`${practiced}${o ? ` for ${said(o.show)}` : ""} isn't saved: this was just to show you how.`} onDone={() => onOpenChange(false)} />
    ) : warming ? (
      <div data-start-warming className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-[4px] bg-secondary/60 p-4 text-center" aria-busy>
        <span className="size-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent motion-reduce:animate-none" aria-hidden />
        <span className="text-[15px] font-semibold">Getting {practice?.label ?? "the show"}&rsquo;s rules&hellip;</span>
      </div>
    ) : null;

  if (body || !o || !wizard || !input || loading) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange} title="Start a game" subtitle={o ? `${o.label} · ${o.couch.name}` : undefined}>
        <div data-start-sheet={practiced ? "practiced" : warming ? "warming" : o?.blocked ? "blocked" : "loading"} className="flex flex-col gap-2 pb-2">
          {practice && !practiced && <PracticeStrip />}
          {body ?? <div aria-busy className="h-64 animate-pulse rounded-[4px] bg-secondary" />}
        </div>
      </Sheet>
    );
  }
  return (
    <Wizardly
      key={`${o.seasonId}|${late}|${o.from}`}
      open={open}
      onOpenChange={onOpenChange}
      o={o}
      W={W!}
      wizard={wizard}
      input={input}
      couchId={couchId!}
      practice={practice ? { onFinish: setPracticed } : undefined}
      late={late}
      setLate={setLate}
      catchUp={catchUp}
      setCatchUp={setCatchUp}
      firstScreen={firstScreen}
    />
  );
}

/** The kinds the show's rulebook fits (start-game.ts: rulebook-fits.js gamesFor, the same as today's list), in the wizard's ids: Best
 *  Ball and Weekly Picks wherever a draft fits (they score the same moments). A talk show, Bingo and Calls; a series, its lineup. */
const FIT_KIND: Record<string, string> = { survivalPool: "pool", weeklyLineup: "lineup", outlast: "outlast", weeklyCalls: "calls", weeklyBingo: "bingo", questions: "predictions" };
function kindsThatFit(o: WizardOptions): string[] {
  const fit = o.games.filter((g) => g.fits && !g.soon).map((g) => FIT_KIND[g.key]).filter(Boolean);
  return fit.includes("lineup") ? [...fit, "bestball", "picks"] : fit;
}

/** A show that isn't a game yet: Make it a game first, then back here (chained: G2's "a show that isn't set up chains Make it a game"). */
function NotAGame({ o, couchId, onClose, practice }: { o: WizardOptions; couchId: string; onClose: () => void; practice: boolean }) {
  const nav = useNav();
  const notGame = /Make .* a game first/.test(o.blocked ?? "");
  if (!notGame || practice) return <p data-start-blocked className="text-[15px] leading-snug text-muted-foreground">{practice ? "For practice, pick a show that's a game already." : `${o.blocked}.`}</p>;
  return (
    <div data-start-blocked data-start-chain className="flex flex-col gap-3">
      <div className="flex h-10 overflow-hidden rounded-[3px] bg-plate text-plate-foreground shadow-plate">
        <span className="tag-cut type-caption grid place-items-center bg-quiet-tag pl-2.5 pr-5 text-[14px] tracking-[0.04em] text-quiet-tag-foreground">Step 1</span>
        <span className="tag-tuck type-caption flex min-w-0 flex-1 items-center truncate pl-5 pr-3 text-[17px]">Make it a game</span>
      </div>
      <p className="text-[15px] leading-snug">
        {o.show} isn&rsquo;t a game yet. Our bot reads how it&rsquo;s played and who&rsquo;s in it, about 2 to 4 minutes, then you&rsquo;re back here to start one.
      </p>
      <Btn
        tone="must"
        wide
        data-start-make
        onClick={() => {
          onClose();
          nav.push(`${paths.show(o.seasonId, "games")}?page=make&then=start${couchId ? `&couch=${couchId}` : ""}`);
        }}
      >
        Make it a game
      </Btn>
    </div>
  );
}

type Mode = "tonight" | "season" | "custom";

function Wizardly({
  open,
  onOpenChange,
  o,
  W,
  wizard,
  input,
  couchId,
  practice,
  late,
  setLate,
  catchUp,
  setCatchUp,
  firstScreen,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  o: WizardOptions;
  W: WM;
  wizard: Wizard;
  input: WizardInput;
  couchId: string;
  practice?: { onFinish: (name: string) => void };
  late: boolean;
  setLate: (v: boolean) => void;
  catchUp: number | null;
  setCatchUp: (v: number | null) => void;
  firstScreen?: Screen;
}) {
  const t = useMemo(() => W.timing(input), [W, input]);
  // The tour's practice: tonight's Prediction Sheet, the easiest to start (the user, 2026-11-01).
  const [mode, setMode] = useState<Mode>(late || practice ? "tonight" : t.mode);
  const [span, setSpanRaw] = useState<Span>(late || practice ? t.tonight : t[t.mode]);
  const [awaiting, setAwaiting] = useState<string | null>(null);
  const [cview, setCview] = useState<"stages" | "episodes">(t.stages.length ? "stages" : "episodes");
  const [choice, setChoice] = useState<Choice>(() => ({ ...W.fresh(), sel: practice ? "predictions" : "" }) as Choice);
  const [screen, setScreen] = useState<Screen>(firstScreen ?? "home");
  const [tell, setTell] = useState(true);
  // When moves lock (the game's pace, chosen as it starts): the options' recommended one until they change it.
  const [paceAsked, setPace] = useState<PaceMode>(o.runs?.recommended ?? "live");
  // A start with a phase runs live or strict (start-game.ts paceAsked): own pace falls back to live while one is chosen.
  const pace: PaceMode = paceAsked === "own" && typeof span.from !== "number" ? "live" : paceAsked;
  const [bots, setBots] = useState(0);
  const [level, setLevel] = useState<BotLevel>("normal");
  const [flash, setFlash] = useState("");
  const [locks, setLocks] = useState<{ game?: boolean; win?: boolean }>({});
  const [shuffles, setShuffles] = useState(0);
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const homeY = useRef(0);
  const nav = useNav();
  const pathname = usePathname();
  const refresh = useAfterReveal();
  const qc = useQueryClient();
  const { data: home } = useHome();
  const me = home?.user.name ?? "you";

  useEffect(() => {
    onScreen = open ? { seasonId: o.seasonId, screen } : null;
    return () => {
      onScreen = null;
    };
  }, [open, o.seasonId, screen]);

  const g = wizard.games(span);
  const sel = choice.sel || g.list[0]?.id || "";
  const ch: Choice = { ...choice, sel };
  const c = wizard.build(span, ch);
  const ok = !!(c && c.r.ok && c.r.spec);
  const spec = (ok ? c!.r.spec : null) as Spec | null;
  const name = ok ? wizard.nameOf(span, ch) : "";
  const changes = ok ? wizard.changes(span, ch) : [];

  const say = (text: string, undo?: Choice | (() => void), ms?: number) =>
    toast(text, undo ? { undo: typeof undo === "function" ? undo : () => setChoice(undo), ms: ms ?? 8000 } : {});
  const sayWhy = (why: string) => toast.quiet(why);
  const pulse = (step?: string) => {
    if (!step) return;
    setFlash(step);
    setTimeout(() => setFlash(""), 1600);
  };

  // A new stretch keeps the game when it still fits (its changes start over), else the stretch's classic: either way said, with an
  // undo back (the critique: a mode change swapped the game silently).
  const setSpan = (next: Span, wait: string | null = null) => {
    const was = { span, choice, mode };
    const undo = () => {
      setSpanRaw(was.span);
      setChoice(was.choice);
      setMode(was.mode);
    };
    // A game someone picked stays; the default gives way to the new stretch's classic.
    const current = ok && c!.row.kind === "standard" && (!!choice.sel || changes.length > 0) ? c!.row : null;
    const nextList = wizard.games(next).list;
    const keep = !!current && nextList.some((x) => x.id === current.id);
    setSpanRaw(next);
    setAwaiting(wait);
    if (wait) return setChoice({ ...choice, ...(keep ? {} : { ...W.fresh(), sel: "" }) } as Choice);
    if (keep) {
      setChoice({ ...W.fresh(), sel: current!.id } as Choice);
      if (changes.length) say(`New ${o.part.plural}: ${current!.name}'s changes start over`, undo);
    } else {
      setChoice({ ...W.fresh(), sel: "" } as Choice);
      const stretch = W.sayRange(next, input).replace(/^./, (x) => x.toLowerCase());
      if (current && nextList[0]) say(`${name} doesn't fit ${stretch}: now ${nextList[0].name}`, undo);
      else if (ok && nextList[0] && nextList[0].id !== c!.row.id) toast.quiet(`Now ${nextList[0].name}, the classic for ${stretch}`);
    }
  };
  // The picked game's card in view on the rail, wherever it sits.
  useEffect(() => {
    if (screen !== "home") return;
    const el = bodyRef.current?.querySelector<HTMLElement>('[data-start-game][aria-pressed="true"]');
    const rail = el?.parentElement;
    if (!el || !rail) return;
    // Sideways only: the sheet stays where it's scrolled.
    const left = el.offsetLeft - rail.offsetLeft;
    if (left < rail.scrollLeft || left + el.offsetWidth > rail.scrollLeft + rail.clientWidth) rail.scrollTo({ left: Math.max(0, left - 16) });
  }, [sel, span, screen]);
  const pickMode = (m: Mode) => {
    setMode(m);
    if (m === "tonight") setSpan(t.tonight);
    if (m === "season") setSpan(t.season);
  };

  const go = (s: Screen) => {
    const scroller = bodyRef.current?.parentElement;
    if (scroller && screen === "home") homeY.current = scroller.scrollTop;
    setScreen(s);
    setTimeout(() => {
      const el = bodyRef.current?.parentElement;
      if (el) el.scrollTop = s === "home" ? homeY.current : 0;
    }, 0);
  };
  const pickGame = (id: string) => {
    if (id === sel && choice.sel) return;
    const undo = choice;
    setChoice({ ...W.fresh(), sel: id } as Choice);
    if (changes.length) say(`Now ${g.list.find((x) => x.id === id)?.name ?? "that game"}: your changes start over`, undo);
  };
  const apply = (out: ReturnType<Wizard["applyQuick"]>, undo: Choice) => {
    if (out.why) return sayWhy(out.why);
    if (out.choice) {
      setChoice(out.choice);
      pulse(out.step);
      if (out.toast) say(out.toast, undo);
    }
  };

  // ---------- starting it ----------
  const when = (n: number) => whenWords(o.starts.find((e) => e.number === n)?.airAt ?? (late && o.onAir?.number === n ? o.onAir.airAt : null));
  const start = async (startSpec: Spec | null, startName: string, made: Record<string, unknown>) => {
    if (!startSpec) return;
    if (practice) return practice.onFinish(startName);
    setBusy(true);
    try {
      const r = await wizardApi.start(o.seasonId, couchId, { spec: startSpec, name: startName, tell, ...(bots ? { bots, level } : {}), ...(late ? { late: true } : {}), ...(o.ownPace || !o.runs ? {} : { pace }), made });
      await refresh();
      // Start it tells the couch after a 10-second Undo (round 14's critique: one tap shouldn't ping everyone unseen).
      toast(`${r.name} started${r.told ? " · the couch hears in 10 seconds" : ""}`, {
        ms: r.holdMs,
        undo: () => {
          wizardApi.undo(o.seasonId, couchId, r.leagueId).then(
            async () => {
              await refresh();
              toast(`${r.name} taken back${r.told ? ": nobody heard" : ""}`);
            },
            (e: Error) => toast.quiet(e.message)
          );
        },
      });
      onOpenChange(false);
      const games = paths.show(o.seasonId, "games");
      if (pathname !== games) nav.push(games);
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // ---------- our AI ----------
  const jobsNow = useJobs();
  const askJob = jobsNow[jobKey(o.seasonId, "ask")] ?? null;
  const momentsJob = jobsNow[jobKey(o.seasonId, "moments")] ?? null;
  const [words, setWords] = useState(askJob?.words ?? "");
  const [changed, setChanged] = useState(false);
  const asksLeft = o.wizard?.asksLeft ?? null;
  const askAI = (text: string) => {
    if (practice) return;
    const w = text.trim();
    if (!w) return sayWhy("Type your game, or tap one to start from");
    setChanged(false);
    runJob(jobKey(o.seasonId, "ask"), { kind: "ask", seasonId: o.seasonId, couchId, words: w }, () => wizardApi.words(o.seasonId, couchId, w));
  };
  const askMoments = (change: string, button?: string) => {
    if (!ok || !spec) return;
    runJob(
      jobKey(o.seasonId, "moments"),
      { kind: "moments", seasonId: o.seasonId, couchId, words: change, game: name },
      () => wizardApi.change(o.seasonId, couchId, { spec, game: `${name}: ${c!.r.describe?.short.line ?? ""}`, words: change, ...(button ? { button } : {}) })
    );
    go("moments");
  };

  // ---------- the footer ----------
  const tellsLine = tell ? (o.wizard?.tells ? " · tells the couch" : "") : "";
  let foot: ReactNode = null;
  const footBox = (title: string, line: string, btn: ReactNode) => (
    <div data-start-foot className="flex flex-col gap-1">
      <p className="type-caption truncate text-[17px]">{title}</p>
      <p className="mb-1.5 line-clamp-2 text-[13px] leading-snug text-muted-foreground">{line}</p>
      {btn}
    </div>
  );
  const done = (
    <Btn tone="ink" wide data-start-done className="type-caption text-[22px]" onClick={() => go("home")}>
      Done
    </Btn>
  );
  if (screen === "home" || screen === "all") {
    foot = footBox(
      ok ? name : "",
      ok ? `${wizard.nextLine(span, spec, when)}${tellsLine}` : "Nothing fits these episodes yet",
      <Btn tone="must" wide data-start-go className="type-caption text-[22px]" disabled={!ok || busy} onClick={() => start(spec, name, { how: c!.row.kind, ...(c!.row.seed ? { seed: c!.row.seed } : {}) })}>
        {busy ? "Starting…" : "Start it"}
      </Btn>
    );
  } else if (screen === "ask") {
    const r = askJob?.state === "done" ? askJob.result?.result : null;
    const played = r && r.state !== "unreadable" && r.spec && r.describe && !r.problems.length;
    if (!askJob || changed || askJob.state === "error" || (r && !played)) {
      const limited = askJob?.error?.status === 429;
      foot = footBox(
        "Describe a new game",
        limited ? "Back at midnight" : askJob?.error?.status === 503 ? `Our AI is away · ${asksLeft ?? 10} of 10 asks left` : asksLeft === null ? "Our AI writes it, our engine checks it" : `${asksLeft} of your 10 asks left today`,
        limited ? (
          <Btn tone="ink" wide className="type-caption text-[22px]" onClick={() => go("home")}>
            Back to the games
          </Btn>
        ) : (
          <Btn tone={words.trim() ? "must" : "ink"} wide data-start-build className="type-caption text-[22px]" disabled={practice !== undefined} onClick={() => askAI(words)}>
            {askJob?.error?.status === 503 ? "Try again" : "Build it"}
          </Btn>
        )
      );
    } else if (askJob.state === "wait") {
      foot = footBox("Our AI is building it", "About 40 seconds", <Btn tone="must" wide disabled className="type-caption text-[22px]">Building…</Btn>);
    } else if (played) {
      const typedName = r.describe!.short.title;
      foot = footBox(
        typedName,
        `${wizard.nextLine((r.spec as Spec).span ?? span, r.spec as Spec, when)}${tellsLine}`,
        <Btn tone="must" wide data-start-go className="type-caption text-[22px]" disabled={busy} onClick={() => start(r.spec as Spec, typedName, { how: "typed", ask: askJob.result!.id })}>
          {busy ? "Starting…" : "Start it"}
        </Btn>
      );
    }
  } else if (screen === "moments") {
    foot = footBox(ok ? name : "", momentsJob?.state === "wait" ? "Our AI is finding moments · about 40 seconds" : "Research asks new moments after every episode", done);
  } else {
    foot = footBox(ok ? name : "", ok ? (c!.r.describe?.short.line ?? "") : "", done);
  }

  const sub: Record<string, { title: string; back: string }> = {
    before: { title: "Before it starts", back: name },
    each: { title: `Each ${o.part.singular}`, back: name },
    win: { title: "To win", back: name },
    bets: { title: "Add a bet", back: name },
    scores: { title: "What scores", back: name },
    rules: { title: "How it plays", back: name },
    all: { title: "Every game", back: "Start a game" },
    ask: { title: "Describe a new game", back: "Start a game" },
    moments: { title: "New moments", back: name },
  };
  const s = sub[screen];
  // The practice: down the options to their end, then Start it shakes (the user, 2026-11-01).
  useNudge(!!practice && screen === "home", "[data-start-go]", "[data-start-sheet]");

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={s ? s.title : "Start a game"}
      subtitle={s ? s.back : o.couch.name && o.couch.name !== o.label ? `${o.label} · for ${o.couch.name}` : o.label}
      back={s ? { label: `Back to ${s.back}`, onClick: () => go("home") } : undefined}
      foot={foot}
    >
      <div
        ref={bodyRef}
        data-start-sheet={o.kind}
        data-start-screen={screen}
        data-practice-path={practice ? "" : undefined}
        onClickCapture={keepToPath(practice ? { on: "[data-start-go]", next: () => document.querySelector("[role=dialog][data-open] [data-start-go]"), word: "Practice: just tap Start it" } : null)}
        className="flex flex-col pb-2"
      >
        {practice && <PracticeStrip />}
        {screen === "home" && (
          <Home
            o={o}
            W={W}
            t={t}
            input={input}
            wizard={wizard}
            span={span}
            mode={mode}
            pickMode={pickMode}
            setSpan={setSpan}
            awaiting={awaiting}
            cview={cview}
            setCview={setCview}
            late={late}
            setLate={setLate}
            pace={pace}
            setPace={setPace}
            catchUp={catchUp}
            setCatchUp={setCatchUp}
            g={g}
            sel={sel}
            pickGame={pickGame}
            ch={ch}
            c={c}
            name={name}
            changes={changes}
            flash={flash}
            go={go}
            onQuick={(k) => {
              const out = wizard.applyQuick(span, ch, k);
              if (out.creative) return askMoments("More creative moments", "creative");
              apply(out, choice);
            }}
            reset={() => {
              const undo = choice;
              setChoice({ ...W.fresh(), sel: choice.sel, row: choice.row } as Choice);
              say("Back to the original", undo);
            }}
            locks={locks}
            setLocks={setLocks}
            shuffle={() => {
              const n = shuffles + 1;
              setShuffles(n);
              const out = wizard.shuffle(span, ch, locks, n);
              if (out.why) return sayWhy(out.why);
              if (out.choice) {
                const undo = choice;
                setChoice(out.choice);
                say("Shuffled: a new game for these episodes", undo, 5000);
              }
            }}
            ask={() => go("ask")}
            askJob={askJob}
            tell={tell}
            setTell={setTell}
            bots={bots}
            setBots={setBots}
            level={level}
            setLevel={setLevel}
            me={me}
          />
        )}
        {(screen === "before" || screen === "each" || screen === "win") && ok && (
          <StepScreen
            which={screen}
            o={o}
            W={W}
            wizard={wizard}
            span={span}
            ch={ch}
            g={g}
            spec={spec!}
            sentence={c!.r.describe?.sentence ?? ""}
            onKind={(id) => {
              if (!g.list.some((x) => x.id === id)) return sayWhy(`${W.KINDS.find((k) => k.id === id)?.name} doesn’t fit these ${o.part.plural}`);
              if (id === c!.row.game && c!.row.kind === "standard") return;
              const undo = choice;
              setChoice({ ...W.fresh(), sel: id } as Choice);
              say(`Now ${W.KINDS.find((k) => k.id === id)?.name}: how you win and twists start over`, undo);
            }}
            onCount={(which, v) => {
              const out = wizard.setCount(span, ch, which, v);
              if (out.why) sayWhy(out.why);
              else if (out.choice) setChoice(out.choice);
            }}
            onWin={(w) => {
              const v = wizard.winOk(span, ch, w);
              if (!v.ok) return sayWhy(v.why ?? "That doesn’t fit");
              setChoice({ ...ch, win: w === c!.row.win ? "" : w });
            }}
            onTwist={(id) => {
              const tws = ch.tws ?? [];
              if (tws.includes(id)) return setChoice({ ...ch, tws: tws.filter((x) => x !== id) });
              if (tws.length >= 2) return sayWhy("Two twists at most: take one off first");
              setChoice({ ...ch, tws: [...tws, id] });
            }}
            openScores={() => go("scores")}
          />
        )}
        {screen === "bets" && ok && <BetsScreen W={W} wizard={wizard} span={span} ch={ch} sentence={c!.r.describe?.sentence ?? ""} onBet={(id) => setChoice({ ...ch, bet: ch.bet === id ? "" : id })} />}
        {screen === "scores" && ok && (
          <ScoresScreen
            o={o}
            W={W}
            wizard={wizard}
            span={span}
            ch={ch}
            name={name}
            onChoice={setChoice}
            onWhy={sayWhy}
            onOwn={(text) => askMoments(`Count this moment too: ${text}`)}
          />
        )}
        {screen === "rules" && ok && <RulesScreen describe={c!.r.describe!} />}
        {screen === "all" && (
          <AllScreen
            o={o}
            W={W}
            wizard={wizard}
            g={g}
            sel={sel}
            pick={(id) => {
              pickGame(id);
              go("home");
            }}
          />
        )}
        {screen === "ask" && (
          <AskScreen
            o={o}
            W={W}
            wizard={wizard}
            job={askJob}
            words={words}
            setWords={(w) => {
              setWords(w);
              setChanged(true);
            }}
            changed={changed}
            practice={!!practice}
            onBack={() => go("home")}
            onUse={(r) => {
              const spanOf = (r.spec as Spec).span ?? span;
              const out = wizard.typed(spanOf, r.spec, r.describe?.short.title);
              if (out.why) return sayWhy(out.why);
              if (out.choice) {
                // The ask is used: Describe a new game opens fresh next time.
                setJob(jobKey(o.seasonId, "ask"), null);
                setWords("");
                setSpanRaw(spanOf);
                setMode(spanOf.from === t.first && spanOf.to === t.first ? "tonight" : spanOf.to === null && (spanOf.from === t.season.from || spanOf.from === t.first) ? "season" : "custom");
                setChoice(out.choice);
                go("home");
                say("Your game is in the sheet: change any step", undefined);
              }
            }}
            onAgain={(text) => askAI(text)}
            onChange={(from, text) =>
              runJob(jobKey(o.seasonId, "ask"), { kind: "ask", seasonId: o.seasonId, couchId, words: askJob?.words ?? text }, () =>
                wizardApi.change(o.seasonId, couchId, { from, words: text })
              )
            }
            onAdded={() => qc.invalidateQueries({ queryKey: ["new-design", "start-wizard", o.seasonId] })}
          />
        )}
        {screen === "moments" && (
          <MomentsScreen
            o={o}
            job={momentsJob}
            name={name}
            onBack={() => go("home")}
            onAdd={async (picked) => {
              const askId = momentsJob?.result?.id;
              if (!askId) return;
              const added: { id: string; says: string; pts: number }[] = [];
              try {
                for (const p of picked) {
                  const r = await wizardApi.addMoment(o.seasonId, askId, p.index);
                  added.push({ id: r.moment.id, says: r.moment.label, pts: p.pts });
                }
              } catch (e) {
                sayWhy((e as Error).message);
                if (!added.length) return;
              }
              // The season's rules now have them: read the page again, so the engine scores them in this game.
              await qc.invalidateQueries({ queryKey: ["new-design", "start-wizard", o.seasonId] });
              const undo = choice;
              setChoice({ ...ch, added: [...(ch.added ?? []).filter((a) => !added.some((x) => x.id === a.id)), ...added] });
              setJob(jobKey(o.seasonId, "moments"), null);
              go("home");
              say(`${added.length} new ${added.length === 1 ? "moment" : "moments"}: research asks after every ${o.part.singular}`, undo);
            }}
          />
        )}
      </div>
    </Sheet>
  );
}

// ---------- the drawings (the board's: a 64 by 28 box, outlines, fills, a dashed box, a 24px icon in the middle) ----------

const ICONS: Record<string, string> = {
  wager: "M4 7a8 3 0 1 0 16 0a8 3 0 1 0-16 0M4 7v5c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5",
  predictions: "M6 3h12v18H6zM10 9.5a2 2 0 1 1 2.8 1.8c-.5.3-.8.8-.8 1.4M12 16.5v.5",
  picks: "M4 12a8 8 0 1 0 16 0a8 8 0 1 0-16 0M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
  lineup: "M3 4h5v9H3zM9.5 4h5v9h-5zM16 4h5v9h-5zM5 18h4M15 18h4",
  bestball: "M12 3l2.7 5.6 6.1.8-4.4 4.2 1.1 6L12 16.7l-5.5 2.9 1.1-6-4.4-4.2 6.1-.8z",
  outlast: "M6 3h12M6 21h12M8 3v3l4 6-4 6v3M16 3v3l-4 6 4 6v3",
  pool: "M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6zM9 12l2 2 4-4",
  bingo: "M4 4h16v16H4zM9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16",
  calls: "M4 5h16v11H9l-5 4zM9 10.5l2 2 4-4",
  points: "M3 20h18M7 17v-4M12 17V9M17 17V5",
  h2h: "M3 12h7M7 8.5l3.5 3.5L7 15.5M21 12h-7M17 8.5L13.5 12l3.5 3.5",
  last: "M12 20V8M12 3.5a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3M3 20h6M15 20h6",
  weeks: "M4 6h16v14H4zM4 10h16M8 4v4M16 4v4M9 15l2 2 4-4",
  streak: "M3 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0M10 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0M17 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0M7 12h3M14 12h3",
  race: "M5 21V4M5 5h11l-2.5 4L16 13H5",
  coop: "M3 12a6 6 0 1 0 12 0a6 6 0 1 0-12 0M9 12a6 6 0 1 0 12 0a6 6 0 1 0-12 0",
  casual: "M5 11V8.5A2.5 2.5 0 0 1 7.5 6h9A2.5 2.5 0 0 1 19 8.5V11M3 12.5a1.5 1.5 0 0 1 3 0V15h12v-2.5a1.5 1.5 0 0 1 3 0V19H3zM5 19v1.5M19 19v1.5",
  spark: "M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z",
};
const DRAW_ICON: Record<string, string> = { card: "bingo", pool: "pool", bank: "wager", q: "predictions", calls: "calls", last: "outlast" };

/** A row of `n` boxes (round: circles), `k` of them filled. */
function boxes(n: number, k: number, round = false) {
  n = Math.max(1, Math.min(8, n));
  const s = Math.min(9, (60 - (n - 1) * 3) / n);
  const x0 = (64 - (n * s + (n - 1) * 3)) / 2;
  const y = (28 - s) / 2;
  let d1 = "";
  let d2 = "";
  for (let i = 0; i < n; i++) {
    const x = +(x0 + i * (s + 3)).toFixed(2);
    const one = round ? `M${x} ${y + s / 2}a${s / 2} ${s / 2} 0 1 0 ${s} 0a${s / 2} ${s / 2} 0 1 0 -${s} 0` : `M${x} ${y}h${s}v${s}h-${s}z`;
    d1 += one;
    if (i < k) d2 += one;
  }
  return { d1, d2, d3: "", ic: "" };
}

function drawingOf(draw: Step["draw"]) {
  const { kind, n, k } = draw;
  if (kind === "draft") return boxes(n, n);
  if (kind === "none") return { d1: "", d2: "", d3: "M23 5h18v18H23z", ic: "" };
  if (kind === "start" || kind === "best") return boxes(n || 5, k || 0);
  if (kind === "pick") return boxes(k || 1, k || 1, true);
  const ic = ICONS[DRAW_ICON[kind] ?? kind] ?? ICONS.lineup;
  return { d1: "", d2: "", d3: "", ic };
}

function Drawing({ draw, className = "h-7 w-16" }: { draw: Step["draw"]; className?: string }) {
  const d = drawingOf(draw);
  return (
    <svg viewBox="0 0 64 28" className={`overflow-visible ${className}`} aria-hidden>
      {d.d1 && <path d={d.d1} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />}
      {d.d2 && <path d={d.d2} fill="currentColor" />}
      {d.d3 && <path d={d.d3} fill="none" stroke="currentColor" strokeWidth={1.6} strokeDasharray="3 3" />}
      {d.ic && (
        <svg x={20} y={2} width={24} height={24} viewBox="0 0 24 24">
          <path d={d.ic} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </svg>
  );
}

function Glyph({ d, className = "size-[22px]" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`flex-none ${className}`} aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---------- small parts ----------

const Label = ({ children, aside }: { children: ReactNode; aside?: ReactNode }) => (
  <div className="mb-2.5 mt-6 flex items-baseline justify-between gap-3 first:mt-1">
    <span className="type-caption flex-none text-[15px] tracking-[0.04em] text-muted-foreground">{children}</span>
    {aside}
  </div>
);
const Note = ({ children, className = "" }: { children: ReactNode; className?: string }) => <p className={`mt-2 text-[13px] leading-[1.45] text-muted-foreground ${className}`}>{children}</p>;
const Link = ({ onClick, children, ink, ...rest }: { onClick: () => void; children: ReactNode; ink?: boolean } & Record<`data-${string}`, string>) => (
  <button
    type="button"
    onClick={onClick}
    {...rest}
    className={`relative text-[13px] font-bold underline underline-offset-[3px] after:absolute after:-inset-x-1.5 after:-inset-y-3 ${ink ? "text-plate-foreground" : "text-foreground"}`}
  >
    {children}
  </button>
);

function Switch({ on, onClick, title, line, data }: { on: boolean; onClick: () => void; title: ReactNode; line: ReactNode; data: Record<string, string> }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onClick} {...data} className="flex min-h-[60px] w-full items-center gap-3 border-b border-border py-2 text-left">
      <span className="min-w-0 flex-1">
        <b className="block text-[16px] font-semibold">{title}</b>
        <small className="mt-[3px] block text-[13px] leading-snug text-muted-foreground">{line}</small>
      </span>
      <span aria-hidden className={`relative h-[26px] w-[46px] flex-none rounded-full transition-colors ${on ? "bg-foreground" : "bg-edge"}`}>
        <i className={`absolute left-[3px] top-[3px] size-5 rounded-full transition-transform duration-200 ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none ${on ? "translate-x-5 bg-background" : "bg-foreground"}`} />
      </span>
    </button>
  );
}

function Stepper({ value, onDec, onInc, label }: { value: ReactNode; onDec: () => void; onInc: () => void; label: string }) {
  return (
    <div className="flex flex-none items-center">
      <button type="button" aria-label={`${label}: one less`} onClick={onDec} className="grid size-11 place-items-center rounded-[3px] hover:bg-secondary">
        <Minus className="size-5" aria-hidden />
      </button>
      <span className="type-num min-w-10 text-center text-[17px] font-extrabold [font-stretch:62%]">{value}</span>
      <button type="button" aria-label={`${label}: one more`} onClick={onInc} className="grid size-11 place-items-center rounded-[3px] hover:bg-secondary">
        <Plus className="size-5" aria-hidden />
      </button>
    </div>
  );
}

function Tick({ on }: { on: boolean }) {
  return (
    <span aria-hidden className={`grid size-[22px] flex-none place-items-center rounded-[3px] border ${on ? "border-foreground bg-foreground text-background" : "border-edge"}`}>
      {on && <Check className="size-4" strokeWidth={3} />}
    </span>
  );
}

const fmt = (n: number) => (n < 0 ? `−${-n}` : String(n));

// ---------- when moves lock ----------

type PaceMode = WizardOptions["runs"]["choices"][number];

/** Each pace by the latest moment a move can be made, so the heading reads on into the choice ("When moves lock: at airtime").
 *  Backstage > Game settings uses the same names (backstage/settings.tsx Pace). */
const PACE_WORDS: Record<PaceMode, { title: string; line: (ep: string, drafts: boolean) => string }> = {
  own: { title: "When you’ve watched it", line: (_ep, drafts) => `However late that is: ${drafts ? "after the draft, " : ""}the game waits for each of you.` },
  live: { title: "When the next one airs", line: () => "Or sooner, once you’ve watched it." },
  strict: { title: "At airtime", line: (ep) => `Everything locks when the ${ep} starts.` },
};

/**
 * When moves lock (docs/PLAN-own-pace-games.md, "Pace is the game's setting", step 2): the game's pace, chosen as it starts and the
 * same for everyone in it. One line that says what the game will do, the three choices behind Change: the recommended one is already
 * chosen, so the quick path costs nothing. `phased`: a start with a phase can't wait for people yet (it runs live or strict).
 */
function Pace({ o, value, onChange, phased, drafts }: { o: WizardOptions; value: PaceMode; onChange: (v: PaceMode) => void; phased: boolean; drafts: boolean }) {
  const [open, setOpen] = useState(false);
  const ep = o.part.singular;
  const said = PACE_WORDS[value];
  return (
    <div data-start-pace={value}>
      <Label
        aside={
          <Link onClick={() => setOpen(!open)} data-start-pace-change={open ? "open" : "closed"}>
            {open ? "Done" : "Change"}
          </Link>
        }
      >
        When moves lock
      </Label>
      {!open ? (
        <p className="text-[15px] leading-snug">
          <b>{said.title}.</b> <span className="text-muted-foreground">{said.line(ep, drafts)}</span>
        </p>
      ) : (
        <div role="radiogroup" aria-label="When moves lock">
          {(["own", "live", "strict"] as PaceMode[])
            .filter((m) => o.runs.choices.includes(m))
            .map((m) => {
              const off = m === "own" && phased;
              const on = value === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={off}
                  data-start-pace-choice={m}
                  onClick={() => onChange(m)}
                  className={`flex min-h-[56px] w-full items-center gap-3 border-b border-border py-2 text-left ${off ? "opacity-55" : ""}`}
                >
                  <i className={`grid size-5 flex-none place-items-center rounded-full border-2 ${on ? "border-foreground" : "border-edge"}`} aria-hidden>
                    {on && <i className="size-2.5 rounded-full bg-foreground" />}
                  </i>
                  <span className="min-w-0 flex-1">
                    <b className="block text-[16px] font-semibold">
                      {PACE_WORDS[m].title}
                      {m === o.runs.recommended && !off && <em className="type-caption ml-2 rounded-[2px] bg-secondary px-1.5 text-[11px] not-italic">Recommended</em>}
                    </b>
                    <small className="mt-[3px] block text-[13px] leading-snug text-muted-foreground">{off ? "Not for a game that starts with a phase, for now." : PACE_WORDS[m].line(ep, drafts)}</small>
                  </span>
                </button>
              );
            })}
          <Note>The same for everyone in the game. Late is on the honour system: only if you haven’t watched it yet.</Note>
        </div>
      )}
    </div>
  );
}

// ---------- home ----------

type G = ReturnType<Wizard["games"]>;

function Home(p: {
  o: WizardOptions;
  W: WM;
  t: ReturnType<WM["timing"]>;
  input: WizardInput;
  wizard: Wizard;
  span: Span;
  mode: Mode;
  pickMode: (m: Mode) => void;
  setSpan: (s: Span, wait?: string | null) => void;
  awaiting: string | null;
  cview: "stages" | "episodes";
  setCview: (v: "stages" | "episodes") => void;
  late: boolean;
  catchUp: number | null;
  setCatchUp: (v: number | null) => void;
  setLate: (v: boolean) => void;
  pace: PaceMode;
  setPace: (v: PaceMode) => void;
  g: G;
  sel: string;
  pickGame: (id: string) => void;
  ch: Choice;
  c: ReturnType<Wizard["build"]>;
  name: string;
  changes: string[];
  flash: string;
  go: (s: Screen) => void;
  onQuick: (k: "comp" | "casual" | "score" | "creative") => void;
  reset: () => void;
  locks: { game?: boolean; win?: boolean };
  setLocks: (l: { game?: boolean; win?: boolean }) => void;
  shuffle: () => void;
  ask: () => void;
  askJob: Job | null;
  tell: boolean;
  setTell: (v: boolean) => void;
  bots: number;
  setBots: (n: number) => void;
  level: BotLevel;
  setLevel: (l: BotLevel) => void;
  me: string;
}) {
  const { o, W, t, input, wizard, span, g, ch, c } = p;
  const ok = !!(c && c.r.ok && c.r.spec);
  const spec = ok ? (c!.r.spec as Spec) : null;
  const stepsOf = ok ? wizard.steps(spec!) : [];
  const times = spec?.score?.captain?.times;
  const stepTw: Record<string, string[]> = { before: [], each: [], win: [] };
  for (const id of ch.tws ?? []) {
    const tw = W.TWISTS[id];
    if (tw) stepTw[tw.step].push(W.twistLabel(id, times));
  }
  const ticket = spec?.ask?.find((q) => q.answer === "ticket");
  const P = o.part.singular.replace(/^./, (x) => x.toUpperCase());
  const tonightLabel = input.tonight ? input.tonight.replace(/^./, (x) => x.toUpperCase()) : `${o.part.singular === "episode" ? "Ep" : P} ${t.first}`;
  const shuffled = ch.sel === "shuffle" || ch.sel === "typed";
  const quick = ok ? wizard.quick(span, ch, "about 40 s") : [];
  const botsFit = !!spec && (spec.get?.by === "draft" || spec.score?.by === "survive") && !(spec.ask ?? []).length;
  const n = W.nOf(span, input);

  return (
    <div data-start-home className="pb-4">
      <Label>When it runs</Label>
      <div role="radiogroup" aria-label="When it runs" className="flex rounded-[4px] bg-background p-[3px]">
        {(
          [
            ["tonight", tonightLabel],
            ["season", t.pre ? "The season" : "Rest of season"],
            ["custom", "Custom"],
          ] as [Mode, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={p.mode === id}
            data-start-mode={id}
            onClick={() => p.pickMode(id)}
            className={`h-11 flex-1 rounded-[3px] text-[15px] font-semibold ${p.mode === id ? "bg-foreground text-background" : "text-muted-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div data-start-readout className="mt-2.5 flex h-10 overflow-hidden rounded-[3px] bg-plate text-plate-foreground shadow-plate">
        <span className="tag-cut type-caption grid flex-none place-items-center bg-quiet-tag pl-2.5 pr-5 text-[14px] tracking-[0.04em] text-quiet-tag-foreground">{W.nTag(span, input)}</span>
        <span className="tag-tuck type-caption flex min-w-0 flex-1 items-center truncate pl-5 pr-3 text-[17px]">{W.sayRange(span, input)}</span>
      </div>
      {p.mode === "season" && t.pre && (
        <Note>
          {span.from === 1 ? "Includes the premiere: everyone picks before they’ve met the cast." : "Starts after the premiere, so everyone meets the cast first."}{" "}
          <Link onClick={() => p.setSpan({ from: span.from === 1 ? 2 : 1, to: null })} data-start-premiere={span.from === 1 ? "in" : "out"}>
            {span.from === 1 ? "Start after the premiere" : "Include the premiere"}
          </Link>
        </Note>
      )}
      {p.mode === "custom" && <Custom {...p} />}
      {o.pace?.here != null && o.starts.length > 0 && (o.ownPace || o.pace.here < o.from) && (
        <div className="mt-2">
          <Switch
            on={p.catchUp != null}
            onClick={() => {
              p.setLate(false);
              p.setCatchUp(p.catchUp != null ? null : o.pace!.here);
            }}
            title={`Start from ${P} ${o.pace.here}, where you are`}
            line={`Everyone plays one ${o.part.singular} at a time, whenever they watch, and catches up to the ones still to air.`}
            data={{ "data-start-catch-up": p.catchUp != null ? "on" : "off" }}
          />
        </div>
      )}
      {o.onAir && p.catchUp == null && (
        <div className="mt-2">
          <Switch
            on={p.late}
            onClick={() => p.setLate(!p.late)}
            title={`Include ${P} ${o.onAir.number} · on now`}
            line="Picks stay open past the start, on the honour system, until you lock them in Backstage or its results are in."
            data={{ "data-start-late": p.late ? "on" : "off" }}
          />
        </div>
      )}
      {!o.ownPace && (o.runs?.choices.length ?? 0) > 1 && (
        <Pace o={o} value={p.pace} onChange={p.setPace} phased={typeof span.from !== "number"} drafts={spec?.get?.by === "draft"} />
      )}

      <Label
        aside={
          <Link onClick={() => p.go("all")} data-start-all="">
            Every game · {g.list.length}
          </Link>
        }
      >
        Start from
      </Label>
      <div role="group" aria-label="Start from" className="-mx-4 flex snap-x snap-proximity scroll-pl-4 gap-2 overflow-x-auto px-4 pb-1.5 pt-0.5 [scrollbar-width:none]">
        {g.list.map((x) => {
          const on = x.id === (ch.sel === "shuffle" || ch.sel === "typed" ? "" : p.sel);
          const kindLine = (W.KINDS.find((k) => k.id === x.game)?.says(o.part.singular) ?? "").replace(/;.*/, "");
          return (
            <button
              key={x.id}
              type="button"
              aria-pressed={on}
              data-start-game={x.id}
              onClick={() => p.pickGame(x.id)}
              className={`flex min-h-[88px] w-[152px] flex-none snap-start flex-col items-start gap-[5px] rounded-[4px] border p-2.5 text-left ${on ? "border-foreground bg-foreground text-background" : "border-input text-foreground"}`}
            >
              <span className="flex gap-1">
                {wizard.steps(x.spec).map((st) => (
                  <Drawing key={st.key} draw={st.draw} className="h-[18px] w-10" />
                ))}
              </span>
              <span className="line-clamp-2 text-[15px] font-bold leading-tight">{x.name}</span>
              <span className={`line-clamp-2 text-[13px] leading-snug ${on ? "text-background/70" : "text-muted-foreground"}`}>{[x.role, kindLine].filter(Boolean).join(" · ")}</span>
            </button>
          );
        })}
      </div>
      {!shuffled && c?.row?.kind === "made" && c.row.hook && <p data-start-hook className="mt-2.5 text-[14px] leading-[1.45] text-foreground/85">{c.row.hook}</p>}
      {shuffled && c?.row && <p className="mt-2.5 text-[14px] leading-[1.45] text-foreground/85">{c.row.kind === "typed" ? "Your words, as our engine plays them." : "Shuffled for you: keep the parts you like, then Surprise me again."}</p>}

      {ok ? (
        <div data-start-card className="mt-3 rounded-[3px] bg-plate px-3 pb-2.5 pt-3.5 text-plate-foreground shadow-plate">
          <div className="flex flex-wrap items-center gap-2">
            <span className="type-caption text-[24px] leading-none" data-start-name>
              {p.name}
            </span>
            {p.changes.length > 0 && <span className="type-caption rounded-[2px] bg-plate-foreground px-1.5 py-[3px] text-[11px] tracking-[0.05em] text-plate">Your version</span>}
          </div>
          {p.changes.length > 0 && (
            <p data-start-changes className="mt-1.5 text-[13px] leading-snug text-plate-muted">
              {p.changes.join(" · ")}
            </p>
          )}
          <div className="mt-3 flex gap-1">
            {stepsOf.map((st) => {
              const extra = stepTw[st.key];
              const lit = p.flash === st.key;
              return (
                <button
                  key={st.key}
                  type="button"
                  data-start-step={st.key}
                  aria-label={`${st.label}: ${st.words}. Change it`}
                  onClick={() => p.go(st.key)}
                  className={`flex min-w-0 flex-1 flex-col items-start gap-1.5 rounded-[4px] border bg-plate px-2 pb-2.5 pt-2 text-left transition-[border-color,box-shadow] duration-200 ${lit ? "border-plate-foreground shadow-[inset_0_0_0_1px_var(--plate-foreground)]" : "border-plate-muted/30"}`}
                >
                  <span className="type-caption text-[11px] tracking-[0.05em] text-plate-muted">{st.label}</span>
                  <Drawing draw={st.draw} />
                  <span className="text-[14px] font-bold leading-tight">{st.words}</span>
                  {extra.length > 0 && <span className="text-[13px] leading-snug text-plate-muted">{extra.map((x) => `+ ${x}`).join(" · ")}</span>}
                  <span className="type-caption mt-auto pt-0.5 text-[11px] tracking-[0.05em] underline underline-offset-[3px]">Change</span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {quick.map((q) => (
              <button
                key={q.id}
                type="button"
                data-start-quick={q.id}
                aria-disabled={q.off}
                onClick={() => p.onQuick(q.id)}
                className={`flex min-h-[52px] min-w-0 items-center gap-1.5 rounded-[4px] border bg-plate px-2 py-1.5 text-left text-[14px] font-semibold leading-tight ${q.off ? "border-dashed border-plate-muted/50 text-plate-muted" : "border-plate-muted/40"}`}
              >
                <Glyph d={q.id === "comp" ? ICONS.h2h : q.id === "casual" ? ICONS.casual : q.id === "score" ? ICONS.points : ICONS.spark} className="size-[18px]" />
                <span className="flex min-w-0 flex-col">
                  <span>{q.label}</span>
                  <span className="mt-0.5 line-clamp-2 text-[13px] font-normal leading-snug text-plate-muted">{q.next}</span>
                </span>
              </button>
            ))}
          </div>
          <CardRow
            icon={ICONS.wager}
            title={ch.bet ? `Bet: ${W.MONEY[ch.bet][0]}` : ticket ? "Bet: a ticket on your answers" : "Add a bet"}
            line={ch.bet ? `${W.MONEY[ch.bet][1]} · points, never money` : "Points, never money"}
            onClick={() => p.go("bets")}
            data="bets"
          />
          <CardRow icon={ICONS.points} title={`What scores: ${wizard.scoringName(span, ch)}`} line={wizard.scoreLine(span, ch)} onClick={() => p.go("scores")} data="scores" />
          <div className="mt-3 flex gap-3.5">
            <Link ink onClick={() => p.go("rules")} data-start-rules="">
              How it plays
            </Link>
            {p.changes.length > 0 && (
              <Link ink onClick={p.reset} data-start-reset="">
                Back to the original
              </Link>
            )}
          </div>
        </div>
      ) : (
        <p data-start-nothing className="mt-3 rounded-[4px] bg-secondary/60 p-3 text-[14px] leading-snug text-muted-foreground">
          {c?.r.why ?? `Nothing fits these ${o.part.plural} yet: try a longer stretch.`}
        </p>
      )}

      {shuffled && ch.sel === "shuffle" && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[13px] text-muted-foreground">Keep when you shuffle:</span>
          {(
            [
              ["game", "The game"],
              ["win", "How you win"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={!!p.locks[k]}
              data-start-keep={k}
              onClick={() => p.setLocks({ ...p.locks, [k]: !p.locks[k] })}
              className={`min-h-11 rounded-[4px] border px-3 text-[13px] font-semibold ${p.locks[k] ? "border-foreground bg-foreground text-background" : "border-edge"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3.5 flex gap-2">
        <button type="button" data-start-describe onClick={p.ask} className="flex min-h-[52px] min-w-0 flex-1 items-center gap-2 rounded-[4px] border border-edge bg-background px-3 text-left text-[14px] font-semibold">
          <Sparkles className="size-5 flex-none" aria-hidden />
          <span className="min-w-0">
            Describe a new game
            {p.askJob && (
              <small className="block text-[13px] font-normal text-muted-foreground">{p.askJob.state === "wait" ? "Building…" : p.askJob.state === "done" ? "Ready: see it" : "Didn’t build"}</small>
            )}
          </span>
        </button>
        <button type="button" data-start-shuffle onClick={p.shuffle} className="flex min-h-[52px] min-w-0 flex-1 items-center gap-2 rounded-[4px] border border-edge bg-background px-3 text-left text-[14px] font-semibold">
          <Shuffle className="size-5 flex-none" aria-hidden />
          Surprise me
        </button>
      </div>

      <Label>The couch</Label>
      <Switch
        on={p.tell}
        onClick={() => p.setTell(!p.tell)}
        title="Tell the couch"
        line={
          o.wizard?.tells
            ? `One alert, “${p.me} started a game for ${o.show} · Join”, after a 10-second Undo. ${o.watchers.length ? `${names(o.watchers)} ${o.watchers.length === 1 ? "watches" : "watch"} it.` : ""}`
            : `Nobody else here watches ${o.show} yet, so nobody hears.`
        }
        data={{ "data-start-tell": p.tell ? "on" : "off" }}
      />
      {botsFit && (
        <section data-start-bots className="flex flex-col gap-1.5 border-b border-border py-3">
          <b className="flex items-center gap-2 text-[16px] font-semibold">
            <Bot className="size-4" aria-hidden />
            Computer players
          </b>
          <small className="text-[13px] leading-snug text-muted-foreground">They take seats and make their own moves. Add more or take them out in Backstage.</small>
          <Pills label="How many computer players" value={p.bots} items={[[0, "None"], [1, "1"], [2, "2"], [3, "3"]]} onChange={p.setBots} data="data-start-bots-count" />
          {p.bots > 0 && <Pills label="How sharp they play" value={p.level} items={(Object.keys(LEVEL_WORDS) as BotLevel[]).map((l) => [l, LEVEL_WORDS[l]])} onChange={p.setLevel} data="data-start-bots-level" />}
        </section>
      )}
      {n === null && typeof span.from === "number" && span.to === null && !input.last && <Note>Nobody knows yet how many {o.part.plural} the season has: it runs to the end.</Note>}
    </div>
  );
}

function CardRow({ icon, title, line, onClick, data }: { icon: string; title: string; line: string; onClick: () => void; data: string }) {
  return (
    <button type="button" data-start-cardrow={data} onClick={onClick} className="mt-0 flex min-h-[54px] w-full items-center gap-2.5 border-t border-plate-muted/20 py-2 text-left first-of-type:mt-3">
      <Glyph d={icon} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-bold">{title}</span>
        {line && <span className="line-clamp-2 text-[13px] leading-snug text-plate-muted">{line}</span>}
      </span>
      <ChevronRight className="size-5 flex-none" aria-hidden />
    </button>
  );
}

/** Custom: Stages (big blocks, tap one or two) then Episodes (picked like dates: where it starts, then where it ends). */
function Custom(p: Parameters<typeof Home>[0]) {
  const { W, t, input, span, o } = p;
  const fromN = (x: Span["from"]) => (typeof x === "number" ? x : null);
  return (
    <div data-start-custom>
      {t.stages.length > 0 && (
        <div className="mb-0.5 mt-3.5 flex gap-1.5">
          {(
            [
              ["stages", "Stages"],
              ["episodes", o.part.plural.replace(/^./, (x) => x.toUpperCase())],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={p.cview === id}
              data-start-cview={id}
              onClick={() => p.setCview(id)}
              className={`h-11 rounded-[4px] border px-3.5 text-[14px] font-semibold ${p.cview === id ? "border-foreground bg-foreground text-background" : "border-edge"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {p.cview === "stages" && t.stages.length > 0 ? (
        <div className="mt-2.5 flex gap-0.5">
          {t.stages.map((st, i) => {
            const inSpan = (() => {
              // A stage is in the stretch when its edges sit inside it (phase edges match by phase).
              const a =
                JSON.stringify(st.span.from) === JSON.stringify(span.from) ||
                (fromN(st.span.from) !== null && fromN(span.from) !== null && fromN(st.span.from)! >= fromN(span.from)!) ||
                // A stage that starts with a phase is inside a stretch that starts with an episode before it.
                (fromN(st.span.from) === null && fromN(span.from) !== null);
              const endIn = span.to === null || JSON.stringify(st.span.to) === JSON.stringify(span.to) || (typeof st.span.to === "number" && typeof span.to === "number" && st.span.to <= span.to);
              const startAfter = typeof st.span.from === "number" && typeof span.to === "number" && st.span.from > span.to;
              const beforeStart = typeof st.span.to === "number" && typeof span.from === "number" && st.span.to < span.from;
              return a && endIn && !startAfter && !beforeStart;
            })();
            const n = W.nOf(st.span, input);
            const endsHere = inSpan && !t.stages.slice(i + 1).some((x) => x.span.from !== null && typeof x.span.from === "number" && typeof span.to === "number" && x.span.from <= span.to);
            return (
              <button
                key={st.id}
                type="button"
                aria-pressed={inSpan}
                data-start-stage={st.id}
                onClick={() => {
                  if (p.awaiting && p.awaiting.startsWith("stage:")) {
                    const firstStage = t.stages.find((x) => x.id === p.awaiting!.slice(6));
                    if (firstStage && firstStage.id === st.id) return p.setSpan(st.span, null);
                    const fi = t.stages.findIndex((x) => x.id === firstStage?.id);
                    if (firstStage && i > fi) return p.setSpan({ from: firstStage.span.from, to: st.span.to }, null);
                  }
                  p.setSpan(st.span, `stage:${st.id}`);
                }}
                style={{ flex: `${Math.max(1, Math.min(6, n ?? 3))} 1 0px`, clipPath: endsHere ? "polygon(0 0,100% 0,calc(100% - 9px) 100%,0 100%)" : undefined }}
                className={`flex h-14 min-w-0 flex-col items-start justify-center gap-[5px] px-2 text-left first:rounded-l-[3px] last:rounded-r-[3px] ${inSpan ? "bg-plate text-plate-foreground" : "bg-background"}`}
              >
                <span className="type-caption max-w-full truncate text-[15px]">{st.label}</span>
                <span className={`max-w-full truncate text-[11px] font-semibold ${inSpan ? "text-plate-muted" : "text-muted-foreground"}`}>
                  {n
                    ? `${st.exact ? "" : "about "}${n} ${n === 1 ? "ep" : "eps"}`
                    : typeof st.span.from === "number"
                      ? `From ${o.part.singular === "episode" ? "Ep" : o.part.singular} ${st.span.from}`
                      : "≈ when it starts"}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="-mx-4 mt-3 overflow-x-auto px-4 [scrollbar-width:none]">
          <div className="flex gap-0.5" style={{ minWidth: t.episodes.length > 13 ? t.episodes.length * 28 : undefined }}>
            {t.episodes.map((k) => {
              const a = fromN(span.from);
              const b = span.to === null ? (input.last ?? Infinity) : typeof span.to === "number" ? span.to : null;
              const on = a !== null && b !== null && k >= a && k <= b;
              const isEnd = on && k === b;
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={on}
                  aria-label={`${o.part.singular.replace(/^./, (x) => x.toUpperCase())} ${k}${k === t.first ? ", the next" : ""}`}
                  data-start-ep={k}
                  onClick={() => {
                    if (p.awaiting === "ep" && a !== null && k >= a) return p.setSpan(W.normalSpan({ from: a, to: k }, input), null);
                    p.setSpan({ from: k, to: k }, "ep");
                  }}
                  style={isEnd ? { clipPath: "polygon(0 0,100% 0,calc(100% - 7px) 100%,0 100%)" } : undefined}
                  className={`type-caption h-11 min-w-0 flex-1 text-[18px] tabular-nums ${on ? "bg-plate text-plate-foreground" : "bg-background"} ${on && k === a ? "rounded-l-[3px]" : ""}`}
                >
                  {k}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <Note className={p.awaiting ? "text-foreground" : ""}>
        {p.awaiting === "ep"
          ? `Now tap where it ends, or the same ${o.part.singular} again for just that one.`
          : p.awaiting
            ? "Tap a later stage to run through it, or the same one again for just that one."
            : p.cview === "stages" && t.stages.length
              ? "Tap a stage for all of it. ≈ marks a stage nobody can date yet: it runs from whenever it happens."
              : `Tap where it starts, then where it ends.`}
      </Note>
    </div>
  );
}

function Pills<T extends string | number>({ label, value, items, onChange, data }: { label: string; value: T; items: [T, string][]; onChange: (v: T) => void; data: string }) {
  return (
    <div className="grid gap-1 rounded-[3px] bg-background p-1" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }} role="radiogroup" aria-label={label}>
      {items.map(([v, word]) => (
        <button
          key={String(v)}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          {...{ [data]: String(v) }}
          className={`h-11 rounded-[2px] text-[15px] font-semibold ${value === v ? "bg-foreground text-background" : ""}`}
        >
          {word}
        </button>
      ))}
    </div>
  );
}

function names(list: string[]) {
  return list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}` : (list[0] ?? "");
}

// ---------- a step's own screen ----------

function KindRow({ on, off, title, line, icon, onClick, data }: { on: boolean; off?: boolean; title: string; line: string; icon: string; onClick: () => void; data: Record<string, string> }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      {...data}
      className={`flex min-h-[62px] w-full items-center gap-3 rounded-[4px] border-b border-border px-1.5 py-2 text-left ${on ? "bg-foreground text-background" : ""} ${off ? "opacity-55" : ""}`}
    >
      <span className={`grid size-10 flex-none place-items-center rounded-[4px] border ${on ? "border-background/30" : "border-input"}`}>
        <Glyph d={icon} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[16px] font-semibold leading-tight">{title}</span>
        <span className={`line-clamp-2 text-[13px] leading-snug ${on ? "text-background/75" : "text-muted-foreground"}`}>{line}</span>
      </span>
    </button>
  );
}

function StepScreen(p: {
  which: "before" | "each" | "win";
  o: WizardOptions;
  W: WM;
  wizard: Wizard;
  span: Span;
  ch: Choice;
  g: G;
  spec: Spec;
  sentence: string;
  onKind: (id: string) => void;
  onCount: (which: "each" | "play", v: number) => void;
  onWin: (w: string) => void;
  onTwist: (id: string) => void;
  openScores: () => void;
}) {
  const { W, wizard, span, ch, g, spec, o } = p;
  const c = wizard.build(span, ch)!;
  const fam = spec.get?.by === "draft" ? "team" : spec.score?.by === "lines" ? "card" : "none";
  const kindRow = (id: string) => {
    const meta = W.KINDS.find((k) => k.id === id)!;
    const fits = g.list.some((x) => x.id === id);
    return (
      <KindRow
        key={id}
        on={c.row.game === id && c.row.kind !== "typed"}
        off={!fits}
        title={meta.name}
        line={fits ? meta.says(o.part.singular) : `Doesn’t fit these ${o.part.plural}`}
        icon={ICONS[id] ?? ICONS.lineup}
        onClick={() => p.onKind(id)}
        data={{ "data-start-kind": id }}
      />
    );
  };
  const twists = Object.values(W.TWISTS)
    .filter((tw) => tw.step === p.which)
    .map((tw) => ({ tw, on: (ch.tws ?? []).includes(tw.id), v: wizard.twistOk(span, ch, tw.id) }))
    .filter((x) => x.on || x.v);
  const times = spec.score?.captain?.times;
  const count = spec.count ?? {};
  const play = count.start || count.best;
  return (
    <div data-start-stepscreen={p.which}>
      <Note className="mt-0">
        {p.which === "before"
          ? "What everyone gets before the first one. Changing it changes the game, so how you win and twists start over."
          : p.which === "each"
            ? fam === "team"
              ? `What your team does each ${o.part.singular}.`
              : `What everyone does each ${o.part.singular}.`
            : "How the couch is ranked at the end."}
      </Note>
      {p.which === "before" &&
        (
          [
            ["A team", ["lineup", "bestball", "outlast"]],
            ["No team", ["predictions", "picks", "pool", "calls"]],
            ["A card", ["bingo"]],
          ] as const
        ).map(([label, ids]) => (
          <div key={label}>
            <p className="type-caption mb-1.5 mt-[18px] text-[13px] tracking-[0.05em] text-muted-foreground">{label}</p>
            {ids.map(kindRow)}
          </div>
        ))}
      {p.which === "each" && (
        <div>
          <p className="type-caption mb-1.5 mt-[18px] text-[13px] tracking-[0.05em] text-muted-foreground">{fam === "team" ? "With your team" : fam === "card" ? "With your card" : "Without a team"}</p>
          {(fam === "team" ? ["lineup", "bestball", "outlast"] : fam === "card" ? ["bingo"] : ["predictions", "picks", "pool", "calls"]).map(kindRow)}
        </div>
      )}
      {p.which === "before" && fam === "team" && spec.get?.each && (
        <div className="mt-3.5 flex items-center justify-between border-y border-border py-1.5 pl-0.5">
          <span className="type-caption text-[14px] tracking-[0.04em] text-muted-foreground">People on each team</span>
          <Stepper label="People on each team" value={spec.get.each} onDec={() => p.onCount("each", spec.get!.each! - 1)} onInc={() => p.onCount("each", spec.get!.each! + 1)} />
        </div>
      )}
      {p.which === "each" && play && (
        <div className="mt-3.5 flex items-center justify-between border-y border-border py-1.5 pl-0.5">
          <span className="type-caption text-[14px] tracking-[0.04em] text-muted-foreground">{count.best ? "How many count" : "How many play"}</span>
          <Stepper
            label={count.best ? "How many count" : "How many play"}
            value={play}
            onDec={() => p.onCount("play", play - 1)}
            onInc={() => (spec.get?.each && play + 1 >= spec.get.each ? toast.quiet("Leave at least one on the bench: make the team bigger first") : p.onCount("play", play + 1))}
          />
        </div>
      )}
      {p.which === "win" &&
        W.WINS.map((w) => {
          const v = wizard.winOk(span, ch, w.id);
          return (
            <KindRow
              key={w.id}
              on={c.win === w.id}
              off={!v.ok}
              title={w.label}
              line={v.ok ? w.says(o.part.singular) : (v.why ?? "Doesn’t fit this game")}
              icon={ICONS[w.id]}
              onClick={() => p.onWin(w.id)}
              data={{ "data-start-win": w.id }}
            />
          );
        })}
      {twists.length > 0 && (
        <div>
          <p className="type-caption mb-1 mt-[18px] text-[13px] tracking-[0.05em] text-muted-foreground">Twists here · two at most</p>
          {twists.map(({ tw, on, v }) => (
            <button key={tw.id} type="button" role="switch" aria-checked={on} data-start-twist={tw.id} onClick={() => p.onTwist(tw.id)} className="flex min-h-[52px] w-full items-center gap-2.5 border-b border-border text-left">
              <Tick on={on} />
              <span className="text-[15px] leading-snug">
                {W.twistLabel(tw.id, on ? times : v?.times)}
                {tw.says && <span className="ml-1.5 text-[13px] text-muted-foreground">{tw.says}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
      {p.which === "each" && (
        <button type="button" onClick={p.openScores} data-start-cardrow="scores" className="mt-3 flex min-h-16 w-full items-center gap-3 rounded-[4px] border border-dashed border-edge p-2.5 text-left">
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[16px] font-semibold">What scores: {wizard.scoringName(span, ch)}</span>
            <span className="line-clamp-2 text-[13px] text-muted-foreground">{wizard.scoreLine(span, ch)}</span>
          </span>
          <ChevronRight className="size-5 flex-none" aria-hidden />
        </button>
      )}
      <p className="mt-4 rounded-[4px] bg-secondary p-3 text-[14px] leading-normal text-foreground/85">{p.sentence}</p>
    </div>
  );
}

function BetsScreen({ W, wizard, span, ch, sentence, onBet }: { W: WM; wizard: Wizard; span: Span; ch: Choice; sentence: string; onBet: (id: string) => void }) {
  const list = wizard.bets(span, ch);
  const rows: [string, string, string][] = [["", "No bet", "Just the game"], ...list.map((id): [string, string, string] => [id, W.MONEY[id][0], W.MONEY[id][1]])];
  return (
    <div data-start-bets>
      <Note className="mt-0">Points, never money. A bet rides on your calls: right, you win your stake and more; wrong, you lose it.</Note>
      <div role="radiogroup" aria-label="A bet" className="mt-2">
        {rows.map(([id, label, says]) => {
          const on = (ch.bet ?? "") === id;
          return (
            <button key={id || "none"} type="button" role="radio" aria-checked={on} data-start-bet={id || "none"} onClick={() => onBet(id)} className="flex min-h-[52px] w-full items-center gap-2.5 border-b border-border text-left">
              <span aria-hidden className={`grid size-[22px] flex-none place-items-center rounded-full border ${on ? "border-foreground bg-foreground text-background" : "border-edge"}`}>
                {on && <Check className="size-4" strokeWidth={3} />}
              </span>
              <span className="text-[15px] leading-snug">
                {label}
                <span className="mt-0.5 block text-[13px] text-muted-foreground">{says}</span>
              </span>
            </button>
          );
        })}
      </div>
      {list.length === 0 && <Note>No bets fit this game here: a bet needs a call to ride on.</Note>}
      <p className="mt-4 rounded-[4px] bg-secondary p-3 text-[14px] leading-normal text-foreground/85">{sentence}</p>
    </div>
  );
}

function ScoresScreen({ o, W, wizard, span, ch, name, onChoice, onWhy, onOwn }: { o: WizardOptions; W: WM; wizard: Wizard; span: Span; ch: Choice; name: string; onChoice: (c: Choice) => void; onWhy: (w: string) => void; onOwn: (text: string) => void }) {
  const rows = wizard.scoreRows(span, ch);
  const [showOff, setShowOff] = useState(false);
  const [adding, setAdding] = useState(false);
  const [own, setOwn] = useState("");
  const scorings = wizard.scorings(span, ch);
  const nChanged = Object.keys(ch.edits ?? {}).length + (ch.off ?? []).length + Object.keys(ch.qedits ?? {}).length + (ch.added ?? []).length;
  const set = (out: ReturnType<Wizard["setMoment"]>) => (out.why ? onWhy(out.why) : out.choice && onChoice(out.choice));
  return (
    <div data-start-scores={rows.kind}>
      <p className="type-caption mb-1 text-[22px]">What scores: {wizard.scoringName(span, ch)}</p>
      {rows.kind === "moments" && (
        <>
          <Note className="mt-0">
            {rows.rows.filter((r) => r.on).length < 10
              ? `Only these ${rows.rows.filter((r) => r.on).length} moments score in this game. Tick another to add it, − and + to change points: this game only.`
              : `${o.label}’s standard points for what each person does. Untick one to drop it, − and + to change it: this game only.`}
          </Note>
          {scorings.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {scorings.map((id) => {
                const on = (ch.scoring ?? "standard") === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={on}
                    data-start-scoring={id}
                    onClick={() => onChoice({ ...ch, scoring: id as Choice["scoring"], edits: {}, off: [] })}
                    className={`inline-flex min-h-11 items-center rounded-[4px] border px-2.5 text-[13px] font-semibold ${on ? "border-foreground bg-foreground text-background" : "border-edge"}`}
                  >
                    {W.SCORINGS[id].name}
                  </button>
                );
              })}
            </div>
          )}
          {[
            { label: (ch.added ?? []).length ? "Your moments" : null, list: rows.rows.filter((r) => r.added) },
            { label: "Counting", list: rows.rows.filter((r) => r.on && !r.added) },
          ]
            .filter((x) => x.list.length)
            .map((grp) => (
              <div key={grp.label ?? "x"}>
                {grp.label && <p className="type-caption mb-1 mt-[18px] text-[13px] tracking-[0.05em] text-muted-foreground">{grp.label}</p>}
                {grp.list.map((m) => (
                  <MomentRow key={m.id} m={m} onToggle={() => set(wizard.setMoment(span, ch, m.id, !m.on, m.on ? 0 : m.was || m.base || 1))} onPts={(v) => set(wizard.setMoment(span, ch, m.id, true, v))} />
                ))}
              </div>
            ))}
          {rows.rows.some((r) => !r.on) && (
            <div>
              <p className="type-caption mt-3 flex min-h-11 items-center justify-between text-[13px] tracking-[0.05em] text-muted-foreground">
                Not counting · {rows.rows.filter((r) => !r.on).length}
                <Link onClick={() => setShowOff(!showOff)} data-start-showoff="">
                  {showOff ? "Hide" : "Show them"}
                </Link>
              </p>
              {showOff &&
                rows.rows
                  .filter((r) => !r.on)
                  .map((m) => <MomentRow key={m.id} m={m} onToggle={() => set(wizard.setMoment(span, ch, m.id, true, m.was || m.base || 1))} onPts={(v) => set(wizard.setMoment(span, ch, m.id, true, v))} />)}
            </div>
          )}
          {adding ? (
            <div className="mt-3.5">
              <label htmlFor="own-moment" className="type-caption mb-1.5 block text-[13px] tracking-[0.05em] text-muted-foreground">
                Add a moment of your own
              </label>
              <div className="flex gap-2">
                <input id="own-moment" value={own} onChange={(e) => setOwn(e.target.value)} placeholder="Did anyone cry?" maxLength={120} className="h-12 min-w-0 flex-1 rounded-[4px] border border-input bg-background px-3 text-[16px] caret-chyron-line outline-none focus:border-chyron-line focus:ring-[3px] focus:ring-chyron-line/20" />
                <button type="button" onClick={() => (own.trim() ? onOwn(own.trim()) : onWhy("Type the moment first"))} className="h-12 rounded-[4px] border border-edge px-4 text-[15px] font-semibold">
                  Ask
                </button>
              </div>
              <Note>Our AI asks how sure recaps can be about it, about 40 seconds. If they can, research asks it after every {o.part.singular}.</Note>
            </div>
          ) : (
            <button type="button" data-start-own onClick={() => setAdding(true)} className="mt-3 flex min-h-16 w-full items-center gap-3 rounded-[4px] border border-dashed border-edge p-2.5 text-left">
              <span className="grid size-11 flex-none place-items-center rounded-[4px] border border-input bg-background">
                <Plus className="size-5" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-[16px] font-semibold">Add a moment of your own</span>
                <span className="text-[13px] text-muted-foreground">Did anyone cry? Our AI checks recaps can say, then research asks it.</span>
              </span>
            </button>
          )}
        </>
      )}
      {rows.kind === "asks" && (
        <>
          <Note className="mt-0">Points for each right answer. Change any of them: this game only.</Note>
          {rows.rows.map((q) => (
            <div key={q.id} className="flex min-h-[52px] items-center gap-2.5 border-b border-border">
              <span className="min-w-0 flex-1 text-[15px] leading-snug">
                {q.says}
                <span className="ml-1 text-[13px] text-muted-foreground">
                  · {q.asked === "once" ? "asked once" : `each ${o.part.singular}`}
                  {q.wager ? ` · stake up to ${q.wager === "total" ? "all you have" : q.wager}${q.odds === "pool" ? ", winners split the pot" : ", double or nothing"}` : ""}
                </span>
              </span>
              {q.fixed ? (
                <span className="type-num min-w-10 pr-3 text-center text-[17px] font-extrabold [font-stretch:62%]" title="A right call is a point">
                  {fmt(q.pts)}
                </span>
              ) : (
                <Stepper label="Points" value={fmt(q.pts)} onDec={() => set(wizard.setQuestion(span, ch, q.id, q.pts - 1))} onInc={() => set(wizard.setQuestion(span, ch, q.id, q.pts + 1))} />
              )}
            </div>
          ))}
          <Note>
            {[rows.bank ? `Everyone starts with a bank of ${rows.bank} points to bet from.` : "", rows.parlay ? `Right on every leg of a parlay: ${rows.parlay} times the points.` : "", "Questions ask about whoever’s still in."].filter(Boolean).join(" ")}
          </Note>
        </>
      )}
      {(rows.kind === "survive" || rows.kind === "place" || rows.kind === "card" || rows.kind === "other") && (
        <p className="mt-1 text-[15px] leading-normal">
          {rows.kind === "card"
            ? `A new card every ${o.part.singular}, the middle one free. Three in a row makes a line. Two of you ticking a square settles it.`
            : rows.kind === "survive"
              ? `Each ${o.part.singular} you pick someone to stay in. Pick someone who goes home and you lose a life. Moments don’t score here.`
              : rows.kind === "place"
                ? "Each of your people scores by how long they last: 1 point, plus 1 for everyone they outlast. Moments don’t score here."
                : "This game doesn’t score moments."}
        </p>
      )}
      {nChanged + (ch.scoring && ch.scoring !== "standard" ? 1 : 0) > 0 && (
        <div className="mt-3.5">
          <Link onClick={() => onChoice({ ...ch, edits: {}, off: [], qedits: {}, scoring: "standard", added: [] })} data-start-scorereset="">
            Back to how {name} scores
          </Link>
        </div>
      )}
    </div>
  );
}

function MomentRow({ m, onToggle, onPts }: { m: { id: string; says: string; pts: number; on: boolean; was: number; changed: boolean; added: boolean }; onToggle: () => void; onPts: (v: number) => void }) {
  return (
    <div data-start-moment={m.id} className={`flex min-h-[52px] items-center gap-2.5 border-b border-border ${m.on ? "" : "opacity-55"}`}>
      <button type="button" role="switch" aria-checked={m.on} onClick={onToggle} className="flex min-h-12 min-w-0 flex-1 items-center gap-2.5 text-left">
        <Tick on={m.on} />
        <span className="text-[15px] leading-snug">
          {m.says}
          {m.added ? <span className="ml-1.5 text-[13px] text-muted-foreground">research asks it</span> : m.changed && <span className="ml-1.5 text-[13px] text-muted-foreground">was {fmt(m.was)}</span>}
        </span>
      </button>
      <Stepper label={m.says} value={fmt(m.pts)} onDec={() => onPts(m.pts - 1)} onInc={() => onPts((m.on ? m.pts : 0) + 1)} />
    </div>
  );
}

function RulesScreen({ describe }: { describe: NonNullable<ReturnType<Wizard["build"]>>["r"]["describe"] }) {
  if (!describe) return null;
  return (
    <div data-start-rulesscreen>
      <p className="rounded-[4px] bg-secondary p-3 text-[15px] leading-normal text-foreground/85">{describe.sentence}</p>
      <Note>The engine’s rules for this game, as everyone will see them.</Note>
      <ol className="mt-2 list-decimal pl-5 text-[15px] leading-normal text-foreground/85">
        {describe.rules.map((r) => (
          <li key={r} className="mt-2">
            {r}
          </li>
        ))}
      </ol>
    </div>
  );
}

function AllScreen({ o, W, wizard, g, sel, pick }: { o: WizardOptions; W: WM; wizard: Wizard; g: G; sel: string; pick: (id: string) => void }) {
  return (
    <div data-start-allscreen>
      <Note className="mt-0">
        {g.list.length} {g.list.length === 1 ? "game" : "games"}, each set up for {o.label}.
      </Note>
      {g.list.map((x: Row) => (
        <KindRow
          key={x.id}
          on={x.id === sel}
          title={x.role ? `${x.name} · ${x.role}` : x.name}
          line={wizard.plainLine(x.spec)}
          icon={ICONS[x.game] ?? ICONS.predictions}
          onClick={() => pick(x.id)}
          data={{ "data-start-every": x.id }}
        />
      ))}
      <Note>{W.KINDS.length - g.list.length > 0 ? `${W.KINDS.length - g.list.length} more need a longer stretch.` : ""}</Note>
    </div>
  );
}

// ---------- Describe a new game ----------

const EXAMPLES = ["Each episode, pick who goes home; a bonus for calling the winner", "Draft 3 each, no negative points, most points wins", "Head to head every week, only the challenges count"];

/** The wait: what our AI is doing now, a sweep, the time, Keep going. (Free's 15-second ad goes here once an ad network is chosen.) */
function Wait({ job, steps, keep }: { job: Job; steps: string[]; keep: { label: string; onClick: () => void } }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const secs = Math.max(0, Math.round((now - job.started) / 1000));
  const step = steps[Math.min(steps.length - 1, Math.floor(secs / 12))];
  return (
    <div data-start-wait role="status" className="py-4">
      {job.kind === "ask" && <p className="mb-3.5 text-[16px] font-semibold leading-[1.45]">“{job.words}”</p>}
      <div className="h-1 overflow-hidden rounded-full bg-input">
        <div className="roll-sweep h-full w-1/4 bg-foreground motion-reduce:w-full motion-reduce:animate-none motion-reduce:opacity-50" />
      </div>
      <p className="mt-3 text-[14px] font-semibold">{step}</p>
      <Note>{secs < 45 ? `About 40 seconds · ${secs}s so far.` : `Taking longer than usual · ${secs}s so far.`}</Note>
      <div className="mt-3">
        <Link onClick={keep.onClick} data-start-keepgoing="">
          {keep.label}
        </Link>
      </div>
    </div>
  );
}

function AskScreen(p: {
  o: WizardOptions;
  W: WM;
  wizard: Wizard;
  job: Job | null;
  words: string;
  setWords: (w: string) => void;
  changed: boolean;
  practice: boolean;
  onBack: () => void;
  onUse: (r: Extract<GameWordsResult["result"], { spec: unknown }>) => void;
  onAgain: (words: string) => void;
  onChange: (from: string, words: string) => void;
  onAdded: () => void;
}) {
  const { o, job } = p;
  const compose = (
    <div>
      <label htmlFor="ask-words" className="type-caption mb-1.5 block text-[13px] tracking-[0.05em] text-muted-foreground">
        Your game, in your words
      </label>
      <textarea
        id="ask-words"
        data-start-words
        value={p.words}
        onChange={(e) => p.setWords(e.target.value)}
        maxLength={2000}
        placeholder="Say it like you’d tell the couch"
        className="min-h-28 w-full resize-none rounded-[4px] border border-input bg-background p-3 text-[16px] leading-[1.45] caret-chyron-line outline-none placeholder:text-muted-foreground/70 focus:border-chyron-line focus:ring-[3px] focus:ring-chyron-line/20"
      />
    </div>
  );
  const err = job?.state === "error" ? job.error : null;
  const r = job?.state === "done" ? job.result?.result : null;
  const nothing = r && (r.state === "unreadable" || r.state === "none");
  if (!job || p.changed || err || nothing) {
    const which = err?.status === 503 ? "away" : err?.status === 429 ? "limit" : nothing ? "none" : err ? "other" : null;
    const E =
      which === "away"
        ? { title: "Our AI isn’t answering", body: "It’s away for a moment, so this one can’t be built right now. That one didn’t count, and your words are kept.", also: "Every game on the last screen works without it, and so does Surprise me." }
        : which === "limit"
          ? { title: "That’s today’s 10", body: `You’ve asked our AI for 10 games today. 10 more at midnight; your words are kept.`, also: "The games on the last screen, Surprise me and the quick changes work any time." }
          : which === "none"
            ? { title: "No game in those words yet", body: "Our AI couldn’t find what everyone does or how someone wins. Say it like you’d tell the couch, for example:", also: "" }
            : which === "other"
              ? { title: "That one didn’t build", body: err!.message, also: "" }
              : null;
    return (
      <div data-start-ask={which ?? "compose"}>
        {compose}
        {E && !p.changed ? (
          <div role="alert" data-start-error={which} className="mt-4 rounded-[4px] border border-input bg-secondary p-3.5">
            <p className="type-caption text-[20px]">{E.title}</p>
            <p className="mt-2 text-[15px] leading-[1.45] text-foreground/85">{E.body}</p>
            {which === "none" && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {["Each episode, pick who goes home", "Draft 3 each, most points wins", "A bingo card of the big moments"].map((x) => (
                  <button
                    key={x}
                    type="button"
                    onClick={() => {
                      const old = p.words;
                      p.setWords(x);
                      toast(`Using “${x}”`, { undo: () => p.setWords(old), ms: 8000 });
                    }}
                    className="min-h-11 rounded-full border border-edge px-3 text-left text-[13px] font-semibold"
                  >
                    {x}
                  </button>
                ))}
              </div>
            )}
            {E.also && <p className="mt-2 text-[13px] leading-snug text-muted-foreground">{E.also}</p>}
          </div>
        ) : (
          <>
            <p className="type-caption mb-2 mt-[18px] text-[13px] tracking-[0.05em] text-muted-foreground">Or start from one of these</p>
            <div className="flex flex-col gap-2">
              {EXAMPLES.map((x) => (
                <button key={x} type="button" onClick={() => p.setWords(x)} className="min-h-12 rounded-[4px] border border-input px-3 py-2.5 text-left text-[14px] leading-snug">
                  {x}
                </button>
              ))}
            </div>
            <Note>
              Our AI reads {o.label}’s rules and moments and writes a game our engine can play, in about 40 seconds. You see what it heard and what it chose before anything starts. The game you’re on stays as it is.
              {p.practice ? " (Not in practice: it really asks our AI.)" : ""}
            </Note>
          </>
        )}
        {which === "away" && (
          <div className="mt-3.5">
            <Link onClick={p.onBack} data-start-backtogames="">
              Back to the games
            </Link>
          </div>
        )}
      </div>
    );
  }
  if (job.state === "wait") return <Wait job={job} steps={[`Reading ${o.label}’s rules and moments`, "Writing your game", "Checking it plays"]} keep={{ label: "Keep going: we’ll tell you when it’s ready", onClick: p.onBack }} />;
  return <AskResult {...p} r={r!} askId={job.result!.id} />;
}

/** The typed game, as our check read it: the plate, its steps, the sentence, their words (made it in underlined, can't yet dashed),
 *  Can't count yet, Your call, We filled in; Change it in the sheet, or change the words. */
/** Can't count yet's nearest part in words, never the spec's path ("card.of": the card; "ask[0]": a question). */
const NEAR: Record<string, string> = { get: "how you get people", count: "who counts", score: "how it scores", rank: "how it's won", ask: "a question", card: "the card", span: "when it runs", extras: "the extras", stages: "a stage" };
const nearWords = (path: string) => NEAR[path.split(/[.[]/)[0]] ?? null;

function AskResult(p: Parameters<typeof AskScreen>[0] & { r: NonNullable<GameWordsResult["result"]>; askId: string }) {
  const { o, wizard, r } = p;
  const [picks, setPicks] = useState<Record<number, number>>({});
  if (r.state === "unreadable") return null;
  const playable = !!(r.spec && r.describe && !r.problems.length);
  const spec = r.spec as Spec | null;
  const words = p.job?.words ?? "";
  const said = r.said.map((s) => s.quote);
  const cant = r.cantYet.map((x) => x.what);
  const segs = segments(words, said, cant);
  return (
    <div data-start-result={r.state}>
      {playable && (
        <>
          <div className="flex min-h-[60px] overflow-hidden rounded-[3px] bg-plate text-plate-foreground shadow-plate">
            <span className="tag-cut type-caption grid flex-none place-items-center bg-quiet-tag pl-3 pr-6 text-[14px] tracking-[0.04em] text-quiet-tag-foreground">Your game</span>
            <div className="tag-tuck min-w-0 flex-1 pb-2.5 pl-6 pr-3 pt-2.5">
              <div className="type-caption text-[22px] leading-[1.05]">{r.describe!.short.title}</div>
              <div className="mt-1.5 truncate text-[13px] text-plate-muted">{r.describe!.short.line}</div>
            </div>
          </div>
          <div className="mt-3 flex gap-1 rounded-[4px] bg-plate p-3 text-plate-foreground">
            {wizard.steps(spec!).map((st) => (
              <div key={st.key} className="flex min-w-0 flex-1 flex-col gap-1">
                <Drawing draw={st.draw} className="h-6 w-14" />
                <span className="text-[13px] font-bold leading-tight">{st.words}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[15px] leading-normal text-foreground/85">{r.describe!.sentence}</p>
        </>
      )}
      {!playable && <p className="type-caption text-[20px]">Not a game our engine can play yet</p>}
      <p className="type-caption mb-1.5 mt-5 text-[13px] tracking-[0.05em] text-muted-foreground">From your words</p>
      <p data-start-yourwords className="text-[17px] leading-[1.65]">
        {segs.map((s, i) => (
          <span
            key={i}
            className={s.k === "ok" ? "underline decoration-2 underline-offset-[5px]" : s.k === "cant" ? "text-muted-foreground underline decoration-dashed decoration-2 underline-offset-[5px]" : "text-muted-foreground"}
          >
            {s.t}
          </span>
        ))}
      </p>
      <Note className="mt-1">{segs.some((s) => s.k === "cant") ? "Underlined made it in. Dashed can’t count yet: below." : "Underlined: what made it into the game."}</Note>
      {r.cantYet.length > 0 && (
        <div className="mt-3.5 rounded-[4px] bg-secondary p-3">
          <p className="type-caption mb-1 text-[13px] tracking-[0.05em] text-muted-foreground">Can’t count yet</p>
          {r.cantYet.map((x, i) => (
            <div key={i} className="mt-1.5">
              <p className="text-[14px] font-bold leading-snug">{/^[a-z]+(\.|\[|$)/.test(x.what) ? "Part of it" : `“${x.what}”`}</p>
              <p className="mt-1 text-[14px] leading-snug text-foreground/85">
                {x.why}
                {x.nearest && nearWords(x.nearest) ? ` Closest: ${nearWords(x.nearest)}.` : ""}
              </p>
            </div>
          ))}
        </div>
      )}
      {r.ask.length > 0 && (
        <div>
          <p className="type-caption mb-1 mt-5 text-[13px] tracking-[0.05em] text-muted-foreground">Your call</p>
          {r.ask.map((a, qi) => (
            <div key={qi} className="mt-2.5">
              <p className="mb-2 text-[15px] font-semibold">{a.question}</p>
              <div className="flex flex-wrap gap-1.5">
                {a.options.map((opt, oi) => {
                  const on = (picks[qi] ?? 0) === oi;
                  return (
                    <button
                      key={opt}
                      type="button"
                      aria-pressed={on}
                      data-start-call={`${qi}:${oi}`}
                      onClick={async () => {
                        setPicks({ ...picks, [qi]: oi });
                        if (oi === 0) return;
                        if (a.part === "newMoment" && a.moment) return;
                        // A choice our check can't make alone goes back to our AI as a typed change (the slow bot's wait).
                        p.onChange(p.askId, `${a.question} ${opt}`);
                      }}
                      className={`min-h-10 rounded-[4px] border px-3 text-[14px] font-semibold ${on ? "border-foreground bg-foreground text-background" : "border-edge"}`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {a.part === "newMoment" && a.moment && (
                <NewMoment o={o} askId={p.askId} index={r.offers.moments?.findIndex((m) => m.label === a.moment!.label) ?? 0} moment={a.moment} words={words} onAgain={p.onAgain} onAdded={p.onAdded} />
              )}
            </div>
          ))}
        </div>
      )}
      {r.assumed.length > 0 && (
        <div>
          <p className="type-caption mb-1 mt-5 text-[13px] tracking-[0.05em] text-muted-foreground">We filled in</p>
          {r.assumed.filter((x, i, all) => all.findIndex((y) => y.why === x.why && String(y.value) === String(x.value)) === i).slice(0, 6).map((x, i) => (
            <p key={i} className="mt-1.5 text-[14px] leading-snug text-foreground/85">
              <strong>{typeof x.value === "object" ? x.part : String(x.value)}</strong> · {x.why}
            </p>
          ))}
        </div>
      )}
      {playable && (
        <button type="button" data-start-usetyped onClick={() => p.onUse(r as Extract<GameWordsResult["result"], { spec: unknown }>)} className="mt-3.5 flex min-h-[52px] w-full items-center justify-center rounded-[4px] border border-edge bg-background px-3 text-[14px] font-semibold">
          Change it in the sheet
        </button>
      )}
      <div className="mt-3.5">
        <Link onClick={() => p.setWords(words)} data-start-editwords="">
          Change the words
        </Link>
      </div>
    </div>
  );
}

/** A moment our check offered: add it to the season (research asks it from the next episode), then ask again to count it. */
function NewMoment({ o, askId, index, moment, words, onAgain, onAdded }: { o: WizardOptions; askId: string; index: number; moment: { label: string; question: string; reliable: string; why: string }; words: string; onAgain: (w: string) => void; onAdded: () => void }) {
  const [state, setState] = useState<"idle" | "adding" | "added">("idle");
  return (
    <div className="mt-2 rounded-[4px] bg-secondary p-3">
      <p className="text-[14px] leading-snug">
        <strong>{moment.reliable === "high" ? "Recaps always say" : "Recaps usually say"}</strong> · {moment.why}
      </p>
      {state === "added" ? (
        <div className="mt-2 flex flex-col items-start gap-2">
          <p className="text-[13px] text-muted-foreground">Research asks “{moment.question}” from the next {o.part.singular}. Ask again and your game counts it.</p>
          <button type="button" onClick={() => onAgain(words)} className="min-h-11 rounded-[4px] border border-foreground px-3.5 text-[14px] font-semibold">
            Ask again with it
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={state === "adding"}
          data-start-addmoment
          onClick={async () => {
            setState("adding");
            try {
              await wizardApi.addMoment(o.seasonId, askId, Math.max(0, index));
              setState("added");
              onAdded();
            } catch (e) {
              setState("idle");
              toast.quiet((e as Error).message);
            }
          }}
          className="mt-2 min-h-11 rounded-[4px] border border-foreground px-3.5 text-[14px] font-semibold disabled:opacity-50"
        >
          {state === "adding" ? "Adding…" : `Add “${moment.label}” for research`}
        </button>
      )}
    </div>
  );
}

/** Their words cut into runs: in a said quote (made it in), in a can't-yet (dashed), or neither. */
function segments(words: string, said: string[], cant: string[]) {
  const tag = new Array<string>(words.length).fill("");
  const lw = words.toLowerCase();
  const mark = (q: string, k: string) => {
    let s = q.toLowerCase().trim();
    let i = lw.indexOf(s);
    if (i < 0) {
      s = s.replace(/[.]$/, "");
      i = lw.indexOf(s);
    }
    if (i < 0 || !s) return;
    for (let j = i; j < i + s.length; j++) tag[j] = tag[j] === "cant" ? "cant" : k;
  };
  for (const q of said) mark(q, "ok");
  for (const q of cant) mark(q, "cant");
  const out: { k: string; t: string }[] = [];
  for (let j = 0; j < words.length; j++) {
    if (!out.length || out[out.length - 1].k !== tag[j]) out.push({ k: tag[j], t: "" });
    out[out.length - 1].t += words[j];
  }
  return out;
}

// ---------- new moments (Creative moments, and a moment of your own) ----------

function MomentsScreen({ o, job, name, onBack, onAdd }: { o: WizardOptions; job: Job | null; name: string; onBack: () => void; onAdd: (picked: { index: number; pts: number }[]) => Promise<void> }) {
  const [off, setOff] = useState<number[]>([]);
  const [pts, setPts] = useState<Record<number, number>>({});
  const [adding, setAdding] = useState(false);
  if (!job) return <Note className="mt-0">Nothing asked yet.</Note>;
  if (job.state === "wait")
    return (
      <div>
        <Note className="mt-0">Our AI is looking for moments {o.label} has that {name} doesn’t score yet.</Note>
        <Wait job={job} steps={["Reading what already scores", "Finding moments the show has", "Asking how sure research can be"]} keep={{ label: "Keep tuning the game: we’ll tell you when they’re ready", onClick: onBack }} />
      </div>
    );
  if (job.state === "error") {
    const e = job.error!;
    return (
      <div role="alert" data-start-error={e.status === 503 ? "away" : e.status === 429 ? "limit" : "other"} className="rounded-[4px] border border-input bg-secondary p-3.5">
        <p className="type-caption text-[20px]">{e.status === 503 ? "Our AI isn’t answering" : e.status === 429 ? "That’s today’s 10" : "That one didn’t work"}</p>
        <p className="mt-2 text-[15px] leading-[1.45] text-foreground/85">{e.status === 503 ? "It’s away for a moment. That one didn’t count. Every quick change but this one works without it." : e.message}</p>
      </div>
    );
  }
  const r = job.result?.result;
  if (!r || r.state === "unreadable") return <Note className="mt-0">Our AI’s answer didn’t read as moments. Try again in a moment.</Note>;
  const offered = r.offers.moments ?? [];
  const unrated = r.cantYet.filter((x) => x.newMoment && !x.offered);
  const SURE: Record<string, [string, string]> = { high: ["Recaps always say", "bg-foreground"], medium: ["Recaps usually say", "bg-muted-foreground"], low: ["Recaps often miss it", "bg-input"] };
  const picked = offered.map((_, i) => i).filter((i) => !off.includes(i));
  return (
    <div data-start-moments>
      <Note className="mt-0">
        {offered.length
          ? `${offered.length} ${offered.length === 1 ? "moment" : "moments"} our AI found that ${name} doesn’t score yet. Untick any you don’t want; − and + change the points.`
          : "Our AI found nothing research could answer reliably enough this time."}
      </Note>
      {offered.map((m, i) => {
        const on = !off.includes(i);
        const v = pts[i] ?? 1;
        return (
          <div key={m.label} data-start-newmoment={i} className={`border-b border-border pb-3 pt-1 ${on ? "" : "opacity-55"}`}>
            <div className="flex min-h-[52px] items-center gap-2.5">
              <button type="button" role="switch" aria-checked={on} onClick={() => setOff(on ? [...off, i] : off.filter((x) => x !== i))} className="flex min-h-12 min-w-0 flex-1 items-center gap-2.5 text-left">
                <Tick on={on} />
                <span className="text-[15px] leading-snug">
                  {m.label}
                  <span className="mt-[3px] block text-[13px] leading-snug text-muted-foreground">{m.question}</span>
                </span>
              </button>
              <Stepper label={m.label} value={v} onDec={() => setPts({ ...pts, [i]: Math.max(1, v - 1) })} onInc={() => setPts({ ...pts, [i]: Math.min(10, v + 1) })} />
            </div>
            <p className="ml-8 flex items-start gap-2 text-[13px] leading-snug text-muted-foreground">
              <i className={`mt-1 size-2 flex-none rounded-full ${(SURE[m.reliable] ?? SURE.low)[1]}`} aria-hidden />
              <span className="line-clamp-2">
                <strong className="text-foreground/85">{(SURE[m.reliable] ?? SURE.low)[0]}</strong> · {m.why}
              </span>
            </p>
          </div>
        );
      })}
      {unrated.length > 0 && (
        <Note>
          Not sure enough to add: {unrated.map((x) => x.newMoment).join(", ")}. Recaps often miss {unrated.length === 1 ? "it" : "them"}, so research couldn&rsquo;t settle {unrated.length === 1 ? "it" : "them"} each {o.part.singular}.
        </Note>
      )}
      {offered.length > 0 && (
        <button
          type="button"
          data-start-addmoments
          disabled={!picked.length || adding}
          onClick={async () => {
            setAdding(true);
            await onAdd(picked.map((i) => ({ index: i, pts: pts[i] ?? 1 })));
            setAdding(false);
          }}
          className="mt-3.5 flex min-h-[52px] w-full items-center justify-center rounded-[4px] bg-foreground px-3 text-[15px] font-bold text-background disabled:opacity-50"
        >
          {adding ? "Adding…" : picked.length ? `Add ${picked.length} to ${name}` : "Tick at least one"}
        </button>
      )}
      <Note>Research asks each one about everyone after every {o.part.singular}, from the next one on. It’s added to the season, so other games can count it too.</Note>
    </div>
  );
}
