"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BookHeart, Calculator, ChevronDown, ChevronRight, Heart, Play, Search, Sofa, Sparkles, Shuffle, Swords, Users } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { allowanceLine, tryPreview, type PreviewAllowance } from "../../preview/ask";
import type * as GalleryModule from "@/lib/game/start-gallery/index.js";
import type * as SportsModule from "@/lib/game/start-gallery/sports.js";
import type { Base, ChangeState, Spec } from "@/lib/game/start-gallery/index.js";
import { useAfterReveal, useHome, useSeasonStats, wizardApi, type WizardOptions } from "../../data";
import { kickerOf } from "../../ui/title-card";
import { useNav } from "../../nav";
import { paths } from "../../routes";
import { keepToPath, PracticeFinish, PracticeStrip, useNudge } from "../../tour/practice";
import type { StartPractice } from "../start-game";
import { openCouchSheet } from "../couch-sheets";
import { Btn } from "../../ui/parts";
import { Sheet } from "../../ui/sheet";
import { jobKey, setJob } from "./ai-jobs";
import { DescribeBody } from "./describe";
import { ASK_FIRST, OWN_MOMENTS, SUGGESTED_MOMENTS, TRY_IT } from "./flags";
import { Pictogram } from "./icons";
import { BaseSquare, CatHead, ChipRow, ChoiceSquare, Controls, EffortMark, Finder, Label, MakeIt, OptionCard, QuestionHead, RuleLine, StartBar, StepLine, Timeline, TitleCard } from "./parts";
import { Avatar } from "../../ui/bars";
import { colourOf } from "@/lib/people";
import { toast } from "../../ui/toast";
import { baseOfGame, communityOf, costWords, effortOf, fitWords, inputOf, isSentence, lengthId, lengthsOf, lockOf, lockWords, readyOf, regularTo, say, shortDate, shortWhy, sizeFit, stretchLine, stripOf, withSpan, type Community, type Input, type Pace, type Span } from "./model";
import { keyOf, savedRows, useSaved, useToggleSaved, type SavedRow } from "./saved";
import { nextStep, type Goal, type Step } from "./ladders";
import { OwnMomentsBody, type OwnMoment } from "./own-moments";
import { nextGame, sidesOf, sportIcon, sportStep, sportView, useTeamMarks, type Mark, type SportView } from "./sport";
import { TeamMark, teamBg, teamInk } from "../../sports/parts";
import { usualLen } from "./parts";
import { LeadTile } from "./leads";
import { picksPlayers, sayWhose, scoped, tooSmall, whoseOf, whosePossessive, whoseWords, type Whose } from "./whose";

// Start a game (docs/PLAN-start-a-game-redo.md B1: the bold pass, Rounds 2b and 2c, approved 2026-11-18, built for every start). Every
// game and change comes from the catalog (src/lib/game/start-gallery; a sport's from sports.js) on the season's own page, checked
// and worded by the engine on the phone; Start sends the spec, and the server checks it again before it makes anything
// (start-spec.ts startFromSpec). Three named steps: Choose a game, Set it up, Start.
//
//   the gallery      the field, the ready game folded into the collapsed community section, the category chips, the squares
//   a base           its sentence, what everyone does, How long? (the timeline, the length cards; Include it while one's on;
//                    where from at your own pace), Together, or at your own pace? (two plain cards, Together naming whoever it
//                    costs), Make it…, the rules one at a time, the community's of its kind; Start docked
//   a change         the row's squares, the chosen one's controls under it, Done
//   the questions    a game of questions' own row: its questions, Add a question
//   describe         our AI's one turn (describe.tsx: the wait, its errors, what it heard, what's left to settle)
//   community        the made-for library as the community's, your saved games (the heart beside Start), a game's own screen
//   done             Ready to start: the game Start makes and who it tells (a ready game's or our AI's, one tap from the gallery)
// Held back until they play (flags.ts): Try it, Ask the couch first, your own moments, the suggested moments.

type GM = typeof GalleryModule;
let loaded: GM | null = null;
function useGalleryModule(): GM | null {
  const [m, setM] = useState<GM | null>(loaded);
  useEffect(() => {
    if (!m)
      import("@/lib/game/start-gallery/index.js").then((x) => {
        loaded = ((x as unknown as { default?: GM }).default ?? x) as GM;
        setM(loaded);
      });
  }, [m]);
  return m;
}

type SM = typeof SportsModule;
let loadedSports: SM | null = null;
function useSportsModule(on: boolean): SM | null {
  const [m, setM] = useState<SM | null>(loadedSports);
  useEffect(() => {
    if (on && !m)
      import("@/lib/game/start-gallery/sports.js").then((x) => {
        loadedSports = ((x as unknown as { default?: SM }).default ?? x) as SM;
        setM(loadedSports);
      });
  }, [on, m]);
  return m;
}

type Level =
  | { k: "gallery" }
  | { k: "base" }
  | { k: "change"; row: string; focus?: string }
  | { k: "questions"; q?: number }
  | { k: "ask" }
  | { k: "describe" }
  | { k: "community" }
  | { k: "cgame"; i: number }
  | { k: "rules" }
  | { k: "own" }
  | { k: "done" };

type BotLevel = "easy" | "normal" | "sharp";
type Bots = { n: number; level: BotLevel };
const BOT_LEVELS: [BotLevel, string][] = [
  ["easy", "Easy"],
  ["normal", "Normal"],
  ["sharp", "Sharp"],
];
/** "2 computer players". */
const botsWords = (b: Bots) => `${b.n} computer ${b.n === 1 ? "player" : "players"}`;

/** Whether Try it is offered to you (the desk's switch, docs/PLAN-preview-release.md decision 3) and how many previews are left
 *  today: null until known, or when previews aren't offered here at all. */
function usePreviewAllowance(): PreviewAllowance | null {
  return (
    useQuery({
      queryKey: ["new-design", "preview-allowance"],
      queryFn: async () => {
        const r = await fetch("/api/previews/allowance");
        return r.ok ? ((await r.json()) as PreviewAllowance) : null;
      },
      enabled: TRY_IT,
      staleTime: 30_000,
    }).data ?? null
  );
}

interface Game {
  base: Base;
  spec: Spec;
  span: Span;
  pace: Pace | null;
  /** The spec before each row's first change, for that row's Undo. */
  before: Record<string, Spec>;
  asked: boolean;
  from: "base" | "community" | "describe" | "saved" | "again";
  name: string;
  moment: string | null;
  /** Your own moments (the user, 2026-11-18): what the results won't catch, settled by the couch or our research. */
  own: OwnMoment[];
  /** Computer players beside you (E1a): how many and how sharp, or none. Not part of the rules (bot-logic.js plays the seats). */
  bots: Bots | null;
  /** How the base's draft was fitted to who's left (4 of you, 10 still in: 2 each, or shared), said on its screen. */
  fitted: { each: number; to: number | "shared"; pool: number; people: number } | null;
}

/** The Start bar's line: the lock card's own name, then the first deadline (one line at 390, so the deadline never cuts off; the
 *  card above says what the way means). At your own pace, nothing locks for everyone at once. */
function lockLineOf(input: Input, pace: Pace, spec: Spec, firstBy: string): string {
  if (input.ownPace || pace === "own") return `At your own pace · ${ownTeamsOf(spec) ? "the draft together first" : "moves lock as you each watch"}`;
  return firstBy ? `Together${firstBy}` : `Together · moves lock as each ${input.ep} ${input.sport ? "starts" : "airs"}`;
}

/** How moves lock, as two plain cards (the user, 2026-11-18, after finding the three-way choice confusing: "if im still confused im
 *  CERTAIN people like joanna would be confused"; then "Always two plain cards"). The stricter "at airtime" isn't offered: a game the
 *  engine would start strict plays Together. */
/** A draft whose players are each someone's own: at your own pace it's still together, and it closes the game to new players. */
function ownTeamsOf(spec: Spec): boolean {
  return spec.get?.by === "draft" && (spec.get as { own?: string }).own !== "shared";
}

const PLAIN_LOCK: Record<"live" | "own", { title: string; line: (input: Input, ownTeams: boolean) => string }> = {
  live: { title: "Together", line: (input) => `Everyone's move for each ${input.ep} locks when it ${input.sport ? "starts" : "airs on TV"}.` },
  own: {
    title: "At your own pace",
    line: (input, ownTeams) => `Your move for each ${input.ep} locks when you start watching it. Nobody's cut off; the standings sit at different ${input.eps} for different people.${ownTeams ? " The draft is together first; once it starts, no one new can join." : ""}`,
  },
};
/** The Start bar's who: who Start tells, and the computer players beside you. */
function tellsLine(input: Input, bots: Bots | null): string {
  const who = input.tells ? `Tells ${input.tells} who watch it` : bots ? "You" : "Just you for now";
  return bots ? `${who} · ${botsWords(bots)}` : who;
}
/** Who Start tells, by name (the couch's others), or that it's just you. */
function tellsOf(input: Input): string {
  const names = input.marks.filter((m) => !m.you).map((m) => m.name);
  if (!names.length) return "Start tells nobody yet: it's just you.";
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `Start tells ${list}.`;
}
/** A sport says games, not episodes: its last game, when it starts, once you've seen it. */
const sportSay = (input: Input, t: string) => (input.sport ? t.replace(/the finale/g, "the last game").replace(/airs$/, "starts").replace(/^At airtime$/, "When the game starts").replace(/watched it/g, "seen it").replace(/watch it/g, "see it") : t);

/** A rule's change, headed by the question it answers (Round 2c: every view says what it's for). */
const ROW_ASK: Record<string, string> = {
  who: "Who's playing?",
  compete: "How does someone win?",
  bets: "Any bets?",
  scoring: "What scores?",
  twists: "Any twists?",
  season: "Over the season",
  details: "The details",
};
const EXCLUSIVE = new Set(["who", "compete", "bets", "season"]);
const ROW_ICON: Record<string, string> = { who: "teams", compete: "trophy", bets: "bank", play: "fantasy", scoring: "seasonpred", twists: "twist", season: "halves", details: "keeper", questions: "sheet" };

/** Where this start came from, and what it can change: the episode on now (Include it), where an own-pace game starts, Run it back's
 *  game, the tour's practice, the view to open on (Describe's See it). */
export interface StartCtx {
  late: boolean;
  setLate: (on: boolean) => void;
  catchUp: number | null;
  setCatchUp: (n: number | null) => void;
  practice?: StartPractice;
  again: string | null;
  screen: "describe" | null;
  /** "next": every game opens on just the next episode or game (a team's Next game); "season": on the season (a team's Their
   *  season), where the game can run it. */
  length: "next" | "season" | null;
}

export function BoldSheet({ open, onOpenChange, o, loading, error, couchId, start }: { open: boolean; onOpenChange: (o: boolean) => void; o: WizardOptions | undefined; loading: boolean; error: Error | null; couchId: string | null; start: StartCtx }) {
  const gm = useGalleryModule();
  const { data: home } = useHome();
  const nav = useNav();
  const input = useMemo(() => (gm && o ? inputOf(o, home, couchId, gm) : null), [gm, o, home, couchId]);
  // A sport's season: the same gallery, its shelves from the sports catalog (the user, 2026-11-18).
  const sm = useSportsModule(!!o?.sport);
  const sport = useMemo(() => (o?.sport && o.wizard && sm ? sportView(sm, o.wizard.page, o.sport.league) : null), [o, sm]);
  const stop = !couchId || error || o?.blocked;
  // The first read only: a read again (Include it, where it starts) keeps the sheet where it is, Start held until it's in.
  if (stop || !o || !gm || !input || (o.sport && !sport)) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange} title="Start a game" subtitle={o ? `${o.label} · ${o.couch.name}` : undefined}>
        <div data-gallery={!couchId ? "no-couch" : error ? "error" : o?.blocked ? "blocked" : "loading"} className="flex flex-col gap-3 pb-2">
          {!couchId ? (
            <>
              <p className="text-[15px] leading-snug text-muted-foreground">Games are played on a couch. Start one and send the code, or join one with a code.</p>
              {!start.practice && (
                <Btn tone="must" wide onClick={() => openCouchSheet({ kind: "new" })}>
                  <Users className="size-5" aria-hidden />
                  Start a couch
                </Btn>
              )}
            </>
          ) : error ? (
            <p className="text-[15px] text-muted-foreground">{error.message}</p>
          ) : o?.blocked ? (
            <>
              <p data-start-blocked className="text-[15px] leading-snug text-muted-foreground">
                {o.blocked}.
              </p>
              {/Make .* a game first/.test(o.blocked) && !start.practice && (
                <Btn
                  tone="must"
                  wide
                  onClick={() => {
                    onOpenChange(false);
                    nav.push(`${paths.show(o.seasonId, "games")}?page=make&then=start`);
                  }}
                >
                  Make it a game
                </Btn>
              )}
            </>
          ) : (
            <div aria-busy className="h-72 animate-pulse rounded-[4px] bg-secondary" />
          )}
        </div>
      </Sheet>
    );
  }
  return <Gallery key={o.seasonId} open={open} onOpenChange={onOpenChange} gm={gm} o={o} input={input} sport={sport} start={start} refreshing={loading} />;
}

function Gallery({ open, onOpenChange, gm, o, input, sport, start, refreshing }: { open: boolean; onOpenChange: (o: boolean) => void; gm: GM; o: WizardOptions; input: Input; sport: SportView | null; start: StartCtx; refreshing: boolean }) {
  const { data: home } = useHome();
  const nav = useNav();
  const refresh = useAfterReveal();
  const qc = useQueryClient();
  const showInfo = home?.shows.find((s) => s.seasonId === input.seasonId)?.show ?? null;
  const art = showInfo?.artUrl ?? null;
  const flavor = sport ? `sport ${sport.league}` : `${showInfo?.kind ?? (input.sport ? "sport" : "competition")} ${input.label}`;
  const bases = sport ? sport.bases : gm.BASES;
  const marks = useTeamMarks(sport, o.wizard?.scope?.team ?? null);
  const flavorKind = sport ? "sport" : showInfo?.kind ?? "competition";
  const [levels, setLevels] = useState<Level[]>(() => (start.screen === "describe" ? [{ k: "gallery" }, { k: "describe" }] : [{ k: "gallery" }]));
  const level = levels[levels.length - 1];
  // Each level opens at its top, and Back returns to where you were on the one before (the gallery's scroll and chip, a game's
  // screen at the row you opened): the scroll each level was left at, by depth.
  const scrolls = useRef<number[]>([]);
  const scrollRoot = () => scroller.current?.closest(".overflow-y-auto") as HTMLElement | null;
  const push = (l: Level) => {
    scrolls.current[levels.length - 1] = scrollRoot()?.scrollTop ?? 0;
    setLevels((ls) => [...ls, l]);
  };
  const back = () => setLevels((ls) => (ls.length > 1 ? ls.slice(0, -1) : ls));
  // Try it (docs/PLAN-preview-release.md, step 15): the game exactly as set up, played on a made-up season on the preview service; the
  // wait page asks for it, and its Back comes here.
  const previewsOpen = !!usePreviewAllowance()?.open;
  const tryIt = (g: { base: Base; spec: Spec; name: string }) => {
    const ask = { season: input.seasonId, couch: input.couch.id, game: { base: g.base.id, spec: g.spec as unknown as Record<string, unknown> }, name: g.name, back: window.location.pathname + window.location.search };
    if (!tryPreview(ask)) toast.quiet("Try it needs this tab's storage: allow it and try again");
  };
  const [q, setQ] = useState("");
  // Community and saved games stays open or closed as you left it (this browser's; closed the first time, Round 2's decision).
  const [communityOpen, setOpen] = useState(() => {
    try {
      return localStorage.getItem("gys_gallery_saved_open") === "1";
    } catch {
      return false;
    }
  });
  const setCommunityOpen = (o: boolean) => {
    setOpen(o);
    try {
      localStorage.setItem("gys_gallery_saved_open", o ? "1" : "0");
    } catch {
      // Blocked storage: it opens closed next time.
    }
  };
  const [game, setGame] = useState<Game | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = scrollRoot();
    if (root) root.scrollTop = scrolls.current[levels.length - 1] ?? 0;
  }, [levels.length]);
  const pg = input.pg;

  // ---------- starting it ----------
  const [busy, setBusy] = useState(false);
  // The tour's practice: Start makes nothing; its finish says so.
  const [practiced, setPracticed] = useState<string | null>(null);
  /** Start: the spec to the server (checked again there), the couch told after the 10-second Undo, then the game's own page. */
  const startGame = async (g: { base: Base; spec: Spec; span: Span; name: string; from: Game["from"]; pace: Pace | null; before?: Record<string, Spec>; own?: unknown[]; bots?: Bots | null }, extra: Record<string, unknown> = {}) => {
    if (start.practice) return setPracticed(say(g.name, input.nouns, true));
    if (busy) return;
    const lock0 = lockOf(g.spec, g.span, input, g.pace);
    const pace: Pace = lock0.value === "strict" ? "live" : lock0.value;
    // The setup card's sentence goes with the game, so its page's card says what its maker read (b1-title-card-critique.md P1); a
    // game our AI or Run it back made says its own (the engine's), as its base's words may not fit it.
    const about = g.from === "describe" || g.from === "again" ? null : sayWhose(fitWords(say(g.base.about, input.nouns), sizeFit(gm, g.base, g.spec)), picksPlayers(g.spec) ? whoseOf(o, g.span) : null).split(/(?<=\.)\s+/)[0] || null;
    setBusy(true);
    try {
      const r = await wizardApi.start(input.seasonId, input.couch.id, {
        spec: g.spec,
        name: say(g.name, input.nouns, true),
        tell: true,
        ...(start.late ? { late: true } : {}),
        ...(input.ownPace ? {} : { pace }),
        // Step 2.7: on a sport's season that goes on into its playoffs, no end is through the final (the server plays the regular
        // season otherwise).
        ...(input.playoffs && g.span.to === null ? { timing: "final" } : {}),
        // Computer players, while this game is one they play (a change since may have made it one they don't yet).
        ...(g.bots && !gm.botsFit(g.spec) ? { bots: g.bots.n, level: g.bots.level } : {}),
        // `unchanged`: no rule changed on the setup screen, so the sentence describes this game (the server keeps it only then).
        made: { how: g.from, base: g.base.id, ...(about ? { about, unchanged: !Object.keys(g.before ?? {}).length } : {}), ...(start.again ? { again: start.again } : {}), ...extra },
      });
      await refresh();
      toast(`${r.name} started${r.told ? " · the couch hears in 10 seconds" : ""}`, {
        ms: r.holdMs,
        undo: () => {
          wizardApi.undo(input.seasonId, input.couch.id, r.leagueId).then(
            async () => {
              await refresh();
              toast(`${r.name} taken back${r.told ? ": nobody heard" : ""}`);
            },
            (e: Error) => toast.quiet(e.message)
          );
        },
      });
      onOpenChange(false);
      nav.push(paths.gamePage(input.seasonId, r.leagueId));
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  /** Why Start can't go yet (the engine's own reason), or null. */
  const cantStart = (spec: Spec): string | null => {
    if (refreshing) return "Reading the season again…";
    // Counted as Start's server counts it: a team's season's game, from its scope's players (step 2.8).
    const v = gm.check(scoped(spec, whoseOf(o, (spec.span as Span | undefined) ?? null)), pg);
    if (!v.ok) return v.problems[0] ? `Can't start yet: ${v.problems[0]}` : v.waits[0] ? `Not yet: ${v.waits[0]}` : "Can't start yet";
    if (input.ownPace && Array.isArray(spec.stages)) return "A game in stages can't be played at your own pace yet";
    return null;
  };

  const verdicts = useMemo(() => (sport ? (sport.verdicts as unknown as Map<string, ReturnType<GM["galleryFor"]>[number]>) : new Map(gm.galleryFor(pg, { from: input.from, to: null }).map((v) => [v.id, v]))), [gm, pg, input.from, sport]);
  const community = useMemo(() => communityOf(input, gm.BASES, gm), [gm, input]);
  // The ready game: a show's made-for game for the next episode; a sport's next game as Pick'em (one tap, as on a show).
  const ready = useMemo(() => {
    if (!sport) return readyOf(community, input, gm);
    const g = nextGame(sport.pack);
    const id = ["sp-pickem-team", "sp-pickem"].find((x) => sport.verdicts.get(x)?.state === "plays");
    const base = id ? bases.find((b) => b.id === id) : null;
    const spec0 = id ? sport.specs.get(id) : null;
    if (!g || !base || !spec0) return null;
    const spec = withSpan(spec0, { from: g.episode, to: g.episode });
    return gm.check(spec, pg).ok ? ({ i: -1, name: sidesOf(g), hook: "", base, badge: "1 game", spec, ours: false, bet: false, saves: 0, couches: 0 } as Community) : null;
  }, [community, input, gm, sport, bases, pg]);
  const readyTag = sport ? (nextGame(sport.pack)?.at ? new Date(nextGame(sport.pack)!.at!).toLocaleDateString("en-US", { weekday: "short" }) : "Next") : null;

  /** A base opened: its game on its default length (the season for a season game, the next episode for a one-night one). */
  const openBase = (b: Base, spec?: Spec, span?: Span, from: Game["from"] = "base", name?: string, bots: Bots | null = null) => {
    const one: Span = { from: input.from, to: input.from };
    // A team's Next game: every game it can be opens on just that one (one that can't run a single game keeps its own length).
    const oneSpec = start.length === "next" && from === "base" ? (spec ? withSpan(spec, one) : gm.baseSpec(b, one, pg)) : null;
    const next = oneSpec && gm.check(oneSpec, pg).ok ? one : null;
    // A team's Their season (step 2.8's design round): every game that can run the season opens on it, though its own length (a
    // sport's ready span too) is one game (the regular season below, where there's one).
    const whole: Span = { from: input.from, to: null };
    const wholeSpec = start.length === "season" && from === "base" ? (spec ? withSpan(spec, whole) : gm.baseSpec(b, whole, pg)) : null;
    const season = wholeSpec && gm.check(scoped(wholeSpec, whoseOf(o, whole)), pg).ok ? whole : null;
    let sp: Span = next ?? season ?? span ?? (b.len === "1 episode" ? one : { from: input.from, to: null });
    const s = spec ?? gm.baseSpec(b, sp, pg);
    if (!s) return;
    // Step 2.7: a season game on a sport's season that goes on into its playoffs opens on its regular season (the default), whatever
    // opened it (the sport's ready specs carry no end).
    const reg = !next && sp.to === null ? regularTo(input, s) : null;
    if (reg !== null) sp = { from: input.from, to: reg };
    const fitted = (s as unknown as { __fitted?: Game["fitted"] }).__fitted ?? null;
    setGame({ base: b, spec: withSpan(s, sp), span: sp, pace: null, before: {}, asked: false, from, name: name ?? b.name, moment: null, fitted, own: [], bots });
    push({ k: "base" });
  };
  // Run it back: the old game reopened on its base's screen, on this season (where it started: a phase still to come, or the next
  // episode; to the span's next stretch, or the season's end). Adjusted while rendering, once its spec is in.
  const [againOpened, setAgainOpened] = useState(false);
  if (!againOpened && start.again && o.againSpec && o.again) {
    setAgainOpened(true);
    const spec0 = o.againSpec as Spec;
    const b = baseOfGame(spec0, bases, gm);
    if (b) {
      const sp: Span = o.again.phase ? { from: { phase: o.again.phase }, to: null } : { from: input.from, to: o.again.to ?? null };
      setGame({ base: b, spec: withSpan(spec0, sp), span: sp, pace: null, before: {}, asked: false, from: "again", name: o.again.name, moment: null, fitted: null, own: [], bots: null });
      setLevels([{ k: "gallery" }, { k: "base" }]);
    }
  }
  // The tour's practice (its step: "Make a Prediction Sheet"): opens on the Prediction sheet's screen, where Start is the one thing
  // to tap; Back still shows the whole gallery.
  const [practiceOpened, setPracticeOpened] = useState(false);
  if (!practiceOpened && start.practice) {
    setPracticeOpened(true);
    const b = bases.find((x) => x.id === "sheet" && verdicts.get(x.id)?.state === "plays");
    const sp: Span = { from: input.from, to: input.from };
    const s0 = b ? gm.baseSpec(b, sp, pg) : null;
    if (b && s0) {
      setGame({ base: b, spec: withSpan(s0, sp), span: sp, pace: null, before: {}, asked: false, from: "base", name: b.name, moment: null, fitted: null, own: [], bots: null });
      setLevels([{ k: "gallery" }, { k: "base" }]);
    }
  }
  // Include it, or a different start at your own pace: the options come again from the new start, and the game moves with them.
  const [fromWas, setFromWas] = useState(input.from);
  if (fromWas !== input.from) {
    setFromWas(input.from);
    if (game && typeof game.span.from === "number" && game.span.from !== input.from) {
      const span: Span = { from: input.from, to: game.span.to === game.span.from ? input.from : typeof game.span.to === "number" && game.span.to < input.from ? null : game.span.to };
      setGame({ ...game, span, spec: withSpan(game.spec, span) });
    }
  }

  /** A change to the game, its row marked (and its Undo kept: the spec before the row's first change). */
  const change = (row: string, next: Spec) => {
    if (!game) return;
    setGame({ ...game, spec: next, before: row in game.before ? game.before : { ...game.before, [row]: game.spec } });
  };
  /** Make it…: the step the goal named, its rule marked (or the easier game swapped in), with Undo on the toast. */
  const makeIt = (st: Step) => {
    if (!game) return;
    const was = game;
    if (st.base) {
      const fitted = (st.spec as unknown as { __fitted?: Game["fitted"] }).__fitted ?? null;
      setGame({ ...game, base: st.base, spec: withSpan(st.spec, game.span), before: {}, name: st.base.name, fitted });
    } else setGame({ ...game, spec: st.spec, before: st.row && !(st.row in game.before) ? { ...game.before, [st.row]: game.spec } : game.before });
    toast(`${st.goal === "comp" ? "More competitive" : st.goal === "casual" ? "More casual" : "Different scoring"}: ${st.says}`, { undo: () => setGame(was) });
  };
  // Your saved games: the heart beside Start saves a game as you've set it, and takes it off again.
  const saved = useSaved();
  // A saved sport's game finds its base in the sports catalog (the critique's P1: it said "isn't in the gallery any more").
  const savedList = useMemo(
    () =>
      savedRows(saved, input, gm).map((r) => {
        if (r.base || !sport) return r;
        const base = sport.bases.find((b) => b.id === r.s.base) ?? null;
        if (!base) return r;
        const v = gm.check(r.spec, input.pg);
        return { ...r, base, why: v.ok ? null : v.problems[0] ?? v.waits[0] ?? "Our check doesn't place it here" };
      }),
    [saved, input, gm, sport]
  );
  const savedKeys = useMemo(() => new Set(saved.map((x) => x.key)), [saved]);
  const toggleSaved = useToggleSaved();
  const toggleSave = async (g: { base: Base; spec: Spec; span: Span; name: string; from: Game["from"] }) => {
    const on = await toggleSaved(g, input, saved);
    if (on !== null) setSaid(on ? "Saved. It's in Community and saved games" : "Taken off your saved games");
  };
  /** A saved game opened: its screen, from the next episode, for the length it was saved with. */
  const openSaved = (r: SavedRow) => {
    if (r.why || !r.base) return toast.quiet(`${r.s.name}: ${shortWhy(r.why ?? "not in the gallery")}`);
    openBase(r.base, r.spec, r.span, "saved", r.s.name);
  };

  // ---------- the levels ----------
  // Every view says which of the three steps it's in (Choose a game, Set it up, Start) and what it's for (Round 2c).
  let title: ReactNode = "Choose a game";
  let subtitle: ReactNode = <StepLine step={1} text={`Choose a game · ${input.label}`} />;
  let backTo: { label: string; onClick: () => void } | undefined;
  let body: ReactNode = null;
  let foot: ReactNode = null;

  if (level.k === "gallery") {
    body = (
      <GalleryBody
        gm={gm}
        input={input}
        q={q}
        setQ={setQ}
        verdicts={verdicts}
        community={community}
        ready={ready}
        readyTag={readyTag}
        bases={bases}
        sport={sport}
        marks={marks}
        whose={(span) => whoseOf(o, span)}
        flavorKind={flavorKind}
        saved={savedList}
        savedKeys={savedKeys}
        onSaved={openSaved}
        communityOpen={communityOpen}
        setCommunityOpen={setCommunityOpen}
        onBase={(b) => {
          const v = verdicts.get(b.id);
          if (v && v.state !== "plays") return toast.quiet(`${b.name}: ${v.why ?? "Coming"}`);
          const ready = sport?.specs.get(b.id);
          if (ready) return openBase(b, ready, (ready.span as Span | undefined) ?? undefined);
          openBase(b);
        }}
        onReady={(c) => {
          if (!c.base) return;
          openBase(c.base, c.spec, c.spec.span as Span, sport ? "base" : "community", c.name);
          push({ k: "done" });
        }}
        onCommunity={(i) => push(i < 0 ? { k: "community" } : { k: "cgame", i })}
        onDescribe={() => push({ k: "describe" })}
        onSurprise={() => {
          const plays = bases.filter((b) => verdicts.get(b.id)?.state === "plays");
          const b = plays[Math.floor(Math.random() * plays.length)];
          const ready = b ? sport?.specs.get(b.id) : null;
          if (b && ready) openBase(b, ready, (ready.span as Span | undefined) ?? undefined);
          else if (b) openBase(b);
        }}
        scroller={scroller}
      />
    );
  } else if (game && level.k === "base") {
    title = "Set it up";
    subtitle = <StepLine step={2} text={`Set it up · ${game.from === "saved" ? "your saved game" : game.from === "community" ? "a ready-made game" : input.label}`} />;
    backTo = { label: "All games", onClick: back };
    const lock0 = lockOf(game.spec, game.span, input, game.pace);
    const lock = lock0.value === "strict" ? lockOf(game.spec, game.span, input, "live") : lock0;
    const first = input.listed.find((e) => typeof game.span.from === "number" && e.number === game.span.from);
    const firstLock = first ? lockWords(first.airAt) : null;
    const firstKind = gm.kindOf(Array.isArray(game.spec.stages) ? game.spec.stages[0].game : game.spec);
    const verb = firstKind === "draft" ? "picks" : firstKind === "pick" ? "pick" : firstKind === "card" ? "card" : "guesses";
    const lockLine = lockLineOf(input, lock.value, game.spec, firstLock ? ` · ${verb} by ${firstLock}` : "");
    // Whose players (step 2.8's design round): our check counts the scope's pool, and an exclusive draft too big for it is said in the
    // Start bar before the tap, with sharing as the fix (it always fits, and keeps the size chosen).
    const whose = whoseOf(o, game.span);
    const small = tooSmall(game.spec, whose, input.couch.members + (game.bots?.n ?? 0));
    // Shared is drafted blind (the engine's own rule, as its "Can two of you have the same…" control writes it); an auction's budget goes.
    const share = () => {
      const { budget: _budget, ...get } = game.spec.get as Record<string, unknown>;
      void _budget;
      setGame({ ...game, spec: { ...game.spec, get: { ...get, own: "shared", order: "blind" } } as Spec });
    };
    body = (
      <BaseBody
        gm={gm}
        input={input}
        game={game}
        setGame={setGame}
        lock={lock}
        onRow={(row) => (row === "questions" ? push({ k: "questions" }) : push({ k: "change", row }))}
        onPopular={(id, row) => {
          const st = gm.changeStates(game.spec, row, pg).find((c) => c.id === id);
          if (!st || (st.why && !st.on)) return;
          change(row, st.on ? gm.dropChange(game.spec, id, pg) : gm.applyChange(game.spec, id, pg));
        }}
        onUndo={(row) => {
          const was = game.before[row];
          if (!was) return;
          const before = { ...game.before };
          delete before[row];
          setGame({ ...game, spec: was, before });
        }}
        onPreview={() => tryIt(game)}
        onRules={() => push({ k: "rules" })}
        community={community.filter((c) => c.base?.id === game.base.id)}
        savedKeys={savedKeys}
        onCommunity={(i) => push({ k: "cgame", i })}
        art={art}
        seasonNumber={home?.shows.find((x) => x.seasonId === input.seasonId)?.seasonNumber ?? null}
        onStep={makeIt}
        onOwn={() => push({ k: "own" })}
        sport={sport}
        marks={marks}
        o={o}
        start={start}
      />
    );
    foot = (
      <StartBar
        line={lockLine}
        warn={
          small && whose
            ? { text: `${small.seats} of you × ${small.each} each is more than ${whosePossessive(whose)} ${small.pool} players.`, fix: { label: "Make it shared", onClick: share }, blocks: true }
            : lock.costs
            ? {
                text: `${lock.costs.name} is ${lock.costs.behind} behind ·`,
                fix: lock.phased ? null : { label: PLAIN_LOCK.own.title, onClick: () => setGame({ ...game, pace: "own" }) },
              }
            : null
        }
        label={`Start ${Object.keys(game.before).length || game.own.length ? "your " : ""}${game.name}`}
        tells={tellsLine(input, game.bots && !gm.botsFit(game.spec) ? game.bots : null)}
        asked={game.asked ? `Asked the couch · 0 of ${Math.max(1, input.couch.members - 1)} in so far` : null}
        disabled={small ? null : cantStart(game.spec)}
        busy={busy}
        save={{ on: savedKeys.has(keyOf(game.base.id, game.spec)), onToggle: () => toggleSave(game) }}
        onStart={() => startGame(game)}
        onAsk={ASK_FIRST ? () => push({ k: "ask" }) : null}
      />
    );
  } else if (game && level.k === "change") {
    const row = level.row;
    const states = gm.changeStates(game.spec, row, pg);
    const playName = gm.playRow(game.spec).name;
    title = ROW_ASK[row] ?? (row === "play" ? playName : gm.ROWS.find((r) => r.id === row)?.name ?? row);
    subtitle = <StepLine step={2} text={`Set it up · ${game.name}`} />;
    backTo = { label: game.name, onClick: back };
    body = <ChangeBody row={row} states={states} exclusive={EXCLUSIVE.has(row)} focus={level.focus} gm={gm} game={game} pg={pg} onSpec={(s) => change(row, s)} onFocus={(id) => setLevels((ls) => [...ls.slice(0, -1), { k: "change", row, focus: id }])} onSheet={(sheet) => sheet === "question" && push({ k: "questions" })} onSay={setSaid} onBots={(b) => setGame({ ...game, bots: b })} />;
    foot = (
      <button type="button" data-gallery-done onClick={back} className="nd-press flex h-[52px] w-full items-center justify-center rounded-[3px] text-[16px] font-bold outline-1 -outline-offset-1 outline-input">
        Done
      </button>
    );
  } else if (game && level.k === "questions") {
    title = "What everyone answers";
    subtitle = <StepLine step={2} text={`Set it up · ${game.name}`} />;
    backTo = { label: game.name, onClick: back };
    body = (
      <>
        <QuestionsBody gm={gm} game={game} input={input} onSpec={(s) => change("play", s)} />
        <QuestionsMore gm={gm} game={game} pg={pg} onSpec={(s) => change("play", s)} onSay={setSaid} />
      </>
    );
    foot = (
      <button type="button" data-gallery-done onClick={back} className="nd-press flex h-[52px] w-full items-center justify-center rounded-[3px] text-[16px] font-bold outline-1 -outline-offset-1 outline-input">
        Done
      </button>
    );
  } else if (game && level.k === "ask") {
    title = "Ask the couch first";
    subtitle = <StepLine step={3} text={`Start · ${input.couch.name}`} />;
    backTo = { label: game.name, onClick: back };
    const line = stretchLine(game.span, input);
    body = <AskBody gm={gm} input={input} game={game} line={line} />;
    foot = (
      <button
        type="button"
        data-gallery-post
        onClick={() => {
          setGame({ ...game, asked: true });
          back();
        }}
        className="nd-press flex h-[52px] w-full items-center justify-center rounded-[3px] text-[16px] font-bold outline-1 -outline-offset-1 outline-input"
      >
        Post it to the couch
      </button>
    );
  } else if (level.k === "describe") {
    title = "Describe your game";
    subtitle = <StepLine step={1} text={`Choose a game · ${input.label}`} />;
    backTo = { label: "All games", onClick: back };
    body = (
      <DescribeBody
        input={input}
        words={q}
        bases={bases.filter((b) => verdicts.get(b.id)?.state === "plays")}
        onBase={(b) => openBase(b)}
        onOpen={(spec, name, bots) => {
          const b = baseOfGame(spec, bases, gm);
          if (!b) return toast.quiet("That game isn't one the gallery can open: start it as it is");
          setJob(jobKey(input.seasonId), null);
          openBase(b, spec, (spec.span as Span | undefined) ?? undefined, "describe", name, bots ?? null);
        }}
        onStart={(spec, name, _askId, bots) => {
          const b = baseOfGame(spec, bases, gm);
          if (!b) return toast.quiet("That game isn't one the gallery can open");
          setJob(jobKey(input.seasonId), null);
          // E1d: the computer players their words asked for go in as Who's playing would have them.
          openBase(b, spec, (spec.span as Span | undefined) ?? undefined, "describe", name, bots ?? null);
          push({ k: "done" });
        }}
        onAdded={() => qc.invalidateQueries({ queryKey: ["new-design", "start-wizard", input.seasonId] })}
      />
    );
  } else if (level.k === "community") {
    title = "Community and saved games";
    subtitle = <StepLine step={1} text={`Choose a game · ${input.label}`} />;
    backTo = { label: "All games", onClick: back };
    body = <CommunityList input={input} community={community} saved={savedList} savedKeys={savedKeys} onGame={(i) => push({ k: "cgame", i })} onSaved={openSaved} />;
  } else if (level.k === "cgame") {
    const c = community[level.i];
    title = c?.name ?? "A community game";
    subtitle = <StepLine step={3} text="Start · a ready-made game" />;
    backTo = { label: levels.length > 2 && levels[levels.length - 2].k === "community" ? "Community and saved" : "All games", onClick: back };
    body = c ? (
      <CommunityGame
        gm={gm}
        input={input}
        c={c}
        saved={!!c.base && savedKeys.has(keyOf(c.base.id, c.spec))}
        onChange={() => c.base && openBase(c.base, c.spec, c.spec.span as Span, "community", c.name)}
        onTry={
          TRY_IT && previewsOpen
            ? () => {
                if (!c.base) return;
                tryIt({ base: c.base, spec: c.spec, name: c.name });
              }
            : null
        }
      />
    ) : null;
    if (c?.base) {
      const base = c.base;
      const cspan = c.spec.span as Span;
      const clock = lockOf(c.spec, cspan, input, null);
      const cfirst = input.listed.find((e) => typeof cspan?.from === "number" && e.number === cspan.from);
      const open = (pace: Pace | null, then: Level["k"] | null) => {
        openBase(base, c.spec, cspan, "community", c.name);
        if (pace) setGame((g) => (g ? { ...g, pace } : g));
        if (then) push({ k: then } as Level);
      };
      foot = (
        <StartBar
          line={lockLineOf(input, clock.value, c.spec, cfirst ? ` · first move by ${lockWords(cfirst.airAt)}` : "")}
          warn={clock.costs && !clock.phased ? { text: `${clock.costs.name} is ${clock.costs.behind} behind ·`, fix: { label: PLAIN_LOCK.own.title, onClick: () => open("own", null) } } : null}
          label="Start your own copy"
          tells={tellsLine(input, null)}
          asked={null}
          disabled={cantStart(c.spec)}
          busy={busy}
          save={{ on: savedKeys.has(keyOf(base.id, c.spec)), onToggle: () => toggleSave({ base, spec: c.spec, span: cspan, name: c.name, from: "community" }) }}
          onStart={() => startGame({ base, spec: c.spec, span: cspan, name: c.name, from: "community", pace: null })}
          onAsk={ASK_FIRST ? () => open(null, "ask") : null}
        />
      );
    }
  } else if (game && level.k === "rules") {
    title = "Every rule";
    subtitle = <StepLine step={2} text={`Set it up · ${game.name}`} />;
    backTo = { label: game.name, onClick: back };
    const v = gm.check(game.spec, pg);
    body = (
      <div data-gallery-rules className="flex flex-col gap-3 pb-2 text-[15px] leading-snug">
        <p className="text-[16px] font-semibold">{game.name}, in the engine&rsquo;s own words.</p>
        {v.sentence && <p>{v.sentence}</p>}
        {(v.rules ?? []).map((r, i) => (
          <p key={i} className="border-t border-border pt-3 text-muted-foreground">
            {r}
          </p>
        ))}
      </div>
    );
  } else if (game && level.k === "own") {
    title = "Your own moments";
    subtitle = <StepLine step={2} text={`Set it up · ${game.name}`} />;
    backTo = { label: game.name, onClick: back };
    body = <OwnMomentsBody flavor={flavor} unit={input.ep} moments={game.own} onChange={(own) => setGame({ ...game, own })} />;
    foot = (
      <button type="button" data-gallery-done onClick={back} className="nd-press flex h-[52px] w-full items-center justify-center rounded-[3px] text-[16px] font-bold outline-1 -outline-offset-1 outline-input">
        Done
      </button>
    );
  } else if (game && level.k === "done") {
    title = "Ready to start";
    subtitle = <StepLine step={3} text={`Start · ${game.name}`} />;
    backTo = { label: game.name, onClick: back };
    body = <DoneBody gm={gm} input={input} game={game} onWait={() => setGame({ ...game, pace: "own" })} onAsk={ASK_FIRST ? () => push({ k: "ask" }) : null} />;
    const dlock0 = lockOf(game.spec, game.span, input, game.pace);
    const dlock = dlock0.value === "strict" ? lockOf(game.spec, game.span, input, "live") : dlock0;
    const dfirst = input.listed.find((e) => typeof game.span.from === "number" && e.number === game.span.from);
    foot = (
      <StartBar
        line={lockLineOf(input, dlock.value, game.spec, dfirst ? ` · first move by ${lockWords(dfirst.airAt)}` : "")}
        warn={null}
        label={`Start ${say(game.name, input.nouns, true)}`}
        tells={tellsLine(input, game.bots && !gm.botsFit(game.spec) ? game.bots : null)}
        asked={null}
        disabled={cantStart(game.spec)}
        busy={busy}
        save={{ on: savedKeys.has(keyOf(game.base.id, game.spec)), onToggle: () => toggleSave(game) }}
        onStart={() => startGame(game)}
        onAsk={null}
      />
    );
  }

  // The tour's practice: its strip on every view, and Start's finish in place of the game.
  if (start.practice && practiced) {
    title = "That's how a game starts";
    subtitle = "Practice run";
    backTo = undefined;
    foot = null;
    body = <PracticeFinish line={`${practiced} for ${input.label} isn't saved: this was just to show you how.`} onDone={() => onOpenChange(false)} />;
  } else if (start.practice) {
    // One path on the game's screen (the old practice's, the user's 2026-11-01 asks): another tap there shakes Start instead.
    body = (
      <div onClickCapture={level.k === "base" ? keepToPath({ on: "[data-gallery-start]", next: () => document.querySelector("[role=dialog][data-open] [data-gallery-start]"), word: "Practice: just tap Start" }) : undefined}>
        <PracticeStrip />
        {body}
      </div>
    );
  }

  // The practice, left a moment: down to Start, then it shakes (the user, 2026-11-01: "scroll down then shake Start it").
  useNudge(!!start.practice && !practiced && level.k === "base", "[data-gallery-start]", "[data-gallery]");
  // Development only: the game on screen, for wizard-coverage.js (it drives the sheet to each value and reads what landed).
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") (window as unknown as { __START_GAME__?: unknown }).__START_GAME__ = game ? { base: game.base.id, spec: game.spec, level: level.k } : { level: level.k };
  }, [game, level.k]);
  useEffect(() => {
    if (said) {
      toast.quiet(said);
      const t = setTimeout(() => setSaid(null), 50);
      return () => clearTimeout(t);
    }
  }, [said]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title} subtitle={subtitle} back={backTo} foot={foot}>
      <div ref={scroller} data-gallery={level.k} data-gallery-base-open={game?.base.id} className="min-h-[58dvh] pb-2">
        {body}
      </div>
    </Sheet>
  );
}

// ---------- the gallery ----------

function GalleryBody(p: {
  gm: GM;
  input: Input;
  q: string;
  setQ: (q: string) => void;
  verdicts: Map<string, ReturnType<GM["galleryFor"]>[number]>;
  community: Community[];
  ready: Community | null;
  readyTag: string | null;
  bases: Base[];
  sport: SportView | null;
  marks: Map<string, Mark>;
  /** Whose players a game on this span draws from (whose.ts), for a draft's card. */
  whose: (span: Span | null) => Whose | null;
  flavorKind: string;
  saved: SavedRow[];
  savedKeys: Set<string>;
  onSaved: (r: SavedRow) => void;
  communityOpen: boolean;
  setCommunityOpen: (o: boolean) => void;
  onBase: (b: Base) => void;
  onReady: (c: Community) => void;
  onCommunity: (i: number) => void;
  onDescribe: () => void;
  onSurprise: () => void;
  scroller: React.RefObject<HTMLDivElement | null>;
}) {
  const { gm, input, q, verdicts } = p;
  // A base shows on this season when it plays here, is still to build (dashed, Coming), or needs something set up elsewhere. A
  // base the season's results can't settle (who goes home on a show nobody leaves) isn't on its page.
  const shown = (b: Base) => {
    const v = verdicts.get(b.id);
    return !!v && v.state !== "off";
  };
  // Each category: its bases (the catalog's, and those people would look for here too), its lead drawn with the season, the rest as
  // squares (the lead isn't repeated under itself).
  const cats = (p.sport ? p.sport.cats : gm.CATS)
    .filter((c) => c.id !== "community")
    .map((c) => {
      const all = p.bases.filter((b) => (b.cat === c.id || b.also === c.id || (b.shelves ?? []).includes(c.id)) && shown(b));
      const plays = (id: string) => verdicts.get(id)?.state === "plays";
      const leads = (p.flavorKind === "series" || p.flavorKind === "talk" ? c.storyLeads : null) ?? c.leads ?? [];
      const leadId = leads.find((id) => plays(id) && all.some((b) => b.id === id)) ?? all.find((b) => plays(b.id))?.id;
      const lead = all.find((b) => b.id === leadId) ?? null;
      const rank = (b: Base) => ({ plays: 0, needs: 1, off: 2, coming: 3 })[verdicts.get(b.id)?.state ?? "coming"] ?? 3;
      return { ...c, says: say(c.says, input.nouns, true), bases: all.filter((b) => b !== lead).sort((a, b) => rank(a) - rank(b)), lead };
    })
    .filter((c) => c.bases.length || c.lead);
  const found = q.trim() ? gm.searchKnown(q, p.bases.filter(shown)) : [];
  // The faces still in as far as you've seen (the Cast tab's own read), photos first: the lead tiles' people.
  const stats = useSeasonStats(input.seasonId, input.couch.id);
  const faces = useMemo(() => (stats.data?.cast ?? []).filter((c) => c.out == null || c.finish).sort((a, b) => Number(!!b.photo) - Number(!!a.photo)), [stats.data]);
  const leadSpecs = useMemo(() => new Map(cats.filter((c) => c.lead).map((c) => [c.lead!.id, p.sport?.specs.get(c.lead!.id) ?? gm.baseSpec(c.lead!, { from: input.from, to: null }, input.pg)])), [cats, gm, input, p.sport]);
  const sentence = isSentence(q);
  const both = p.community.length + p.saved.length;
  const [active, setActive] = useState("");
  // The chips follow the scroll: the category whose heading last passed the chips' row is lit.
  useEffect(() => {
    const root = p.scroller.current?.closest(".overflow-y-auto") as HTMLElement | null;
    if (!root) return;
    const heads = [...root.querySelectorAll<HTMLElement>("[data-gallery-cat]")];
    const onScroll = () => {
      const top = root.getBoundingClientRect().top + 72;
      let id = "";
      for (const h of heads) if (h.getBoundingClientRect().top <= top) id = h.dataset.galleryCat ?? "";
      setActive(id);
      // The lit chip kept in view along its row (the row scrolls sideways; the sheet doesn't move).
      const chip = root.querySelector<HTMLElement>(`[data-gallery-chip="${id}"]`);
      const row = chip?.parentElement;
      if (chip && row) {
        const r = row.getBoundingClientRect();
        const c = chip.getBoundingClientRect();
        if (c.left < r.left + 16 || c.right > r.right - 16) row.scrollTo({ left: Math.max(0, row.scrollLeft + c.left - r.left - 16) });
      }
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [p.scroller, cats.length]);
  const jump = (id: string) => {
    setActive(id);
    if (id === "community") p.setCommunityOpen(true);
    const el = document.getElementById(id === "community" ? "cat-community" : `cat-${id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const ready = p.ready;
  const others = p.community.filter((c) => c !== ready);
  const homeSide = p.sport ? nextGame(p.sport.pack)?.sides.find((x) => x.home) : null;
  const homeColor = homeSide ? p.marks.get(homeSide.id)?.color ?? null : null;
  const homeTag = homeColor ? { background: teamBg(homeColor), color: teamInk(homeColor) } : undefined;
  const section = gm.CATS.find((c) => c.id === "community");
  const sectionLine = [p.saved.length ? `${p.saved.length} saved` : null, p.community.length ? `${p.community.length} made for ${input.label}` : null].filter(Boolean).join(" · ") || "Nothing saved yet";
  return (
    <div className="flex flex-col">
      <Finder value={q} onChange={p.setQ} />
      {q.trim() ? (
        <div data-gallery-results className="mt-3">
          {found.length ? (
            <div className="grid grid-cols-2 gap-3">
              {found.map(({ base, aka }) => (
                <BaseSquare key={base.id} base={{ ...base, name: say(base.name, input.nouns, true) }} state={verdicts.get(base.id)!.state} why={verdicts.get(base.id)!.why} line={aka ? `Also called ${aka}` : fitWords(say(base.plain, input.nouns, true), verdicts.get(base.id)!.fitted)} icon={p.sport ? sportIcon(base.id) : undefined} onOpen={() => p.onBase(base)} />
              ))}
            </div>
          ) : (
            <p className="py-2 text-[14px] text-muted-foreground">No game by that name here.</p>
          )}
          <button type="button" data-gallery-build onClick={p.onDescribe} className="nd-press mt-3 flex min-h-[60px] w-full items-center gap-3 rounded-[4px] border border-input px-3 text-left">
            <Sparkles className="size-5 flex-none" aria-hidden />
            <span className="min-w-0 flex-1">
              <b className="block text-[15px] font-semibold">{sentence ? "Build it from your words" : "Describe your game"}</b>
              <small className="block text-[13px] text-muted-foreground">Our AI, about 40 seconds{input.asksLeft != null ? ` · ${input.asksLeft} asks left today` : ""}</small>
            </span>
            <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
          </button>
        </div>
      ) : (
        <>
          <div id="cat-community" data-gallery-ready className="mt-3 scroll-mt-14 rounded-[4px] bg-secondary">
            {ready && (
              <div className="p-2">
                <button type="button" data-gallery-ready-start onClick={() => p.onReady(ready)} className="nd-press flex h-[60px] w-full overflow-hidden rounded-[3px] bg-plate text-left text-plate-foreground shadow-plate">
                  <span className="tag-cut type-caption grid flex-none place-items-center bg-quiet-tag pl-2.5 pr-5 text-[14px] tracking-[0.04em] text-quiet-tag-foreground" style={p.sport ? homeTag : undefined}>
                    {p.readyTag ?? `${input.ep === "episode" ? "Ep" : input.ep[0].toUpperCase() + input.ep.slice(1)} ${input.from}`}
                  </span>
                  <span className="tag-tuck flex min-w-0 flex-1 flex-col justify-center pl-5 pr-2">
                    <b className="type-caption truncate text-[19px] leading-none">{ready.name}</b>
                    <small className="mt-1 truncate text-[13px] text-plate-muted">Ready-made{ready.base ? ` · ${ready.base.name}` : ""}</small>
                  </span>
                  <span className="flex flex-none items-center gap-0.5 pr-3 text-[15px] font-bold">
                    Start <ChevronRight className="size-4" aria-hidden />
                  </span>
                </button>
              </div>
            )}
            {(others.length > 0 || p.saved.length > 0 || true) && (
              <button type="button" data-gallery-community-toggle aria-expanded={p.communityOpen} onClick={() => p.setCommunityOpen(!p.communityOpen)} className={`nd-press flex min-h-16 w-full items-center gap-3 px-3 py-2 text-left ${ready ? "border-t border-border" : ""}`}>
                <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-card">
                  <BookHeart className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block text-[15px] font-semibold">{section?.name ?? "Community and saved games"}</b>
                  <small className="block truncate text-[13px] text-muted-foreground">{sectionLine}</small>
                </span>
                <ChevronDown className={`size-5 flex-none text-muted-foreground transition-transform ${p.communityOpen ? "rotate-180" : ""}`} aria-hidden />
              </button>
            )}
            {p.communityOpen && (
              <div data-gallery-community className="border-t border-border px-3 pb-2">
                {p.saved.length > 0 && (
                  <div data-gallery-saved className="pt-3">
                    <Label>Saved</Label>
                    {p.saved.slice(0, 3).map((r) => (
                      <SavedRowView key={r.s.key} r={r} input={input} onOpen={() => p.onSaved(r)} />
                    ))}
                  </div>
                )}
                {others.length > 0 && (
                  <div data-gallery-made className="pt-3">
                    <Label>Made for {input.label}</Label>
                    {others.slice(0, p.saved.length ? 3 : 4).map((c) => (
                      <CommunityRow key={c.i} c={c} saved={!!c.base && p.savedKeys.has(keyOf(c.base.id, c.spec))} onOpen={() => p.onCommunity(c.i)} />
                    ))}
                  </div>
                )}
                {p.saved.length === 0 && (
                  <p data-gallery-saved-hint className="mt-1 flex items-center gap-2 border-t border-border pt-3 text-[13px] leading-snug text-muted-foreground">
                    <Heart className="size-4 flex-none" aria-hidden /> Tap the heart beside Start on any game to save it here.
                  </p>
                )}
                {(p.saved.length > 3 || others.length > (p.saved.length ? 3 : 4)) && (
                  <button type="button" data-gallery-community-all onClick={() => p.onCommunity(-1)} className="mt-1 flex h-11 w-full items-center justify-center text-[14px] font-semibold underline decoration-1 underline-offset-[3px]">
                    See all {both}
                  </button>
                )}
              </div>
            )}
          </div>
          <div role="group" aria-label="Categories" className="sticky top-0 z-10 -mx-4 mt-3 flex gap-2 overflow-x-auto bg-card px-4 py-2 [scrollbar-width:none]">
            {[...(both ? [{ id: "community", short: "Community and saved", n: both }] : []), ...cats.map((c) => ({ id: c.id, short: c.short, n: c.bases.length + (c.lead ? 1 : 0) }))].map((c) => (
              <button key={c.id} type="button" data-gallery-chip={c.id} aria-pressed={active === c.id} onClick={() => jump(c.id)} className={`inline-flex h-11 flex-none items-center gap-1.5 rounded-[2px] px-3 text-[14px] font-semibold ${active === c.id ? "bg-foreground text-background" : "bg-secondary"}`}>
                {c.short}
                <span className={active === c.id ? "text-background/70" : "text-muted-foreground"}>{c.n}</span>
              </button>
            ))}
          </div>
          {cats.map((c) => (
            <section key={c.id} aria-labelledby={`cat-${c.id}`}>
              <CatHead id={c.id} name={c.name} says={c.says} />
              <div className="grid grid-cols-2 gap-3">
                {c.lead && (
                  <LeadTile
                    cat={c.id}
                    base={c.lead}
                    spec={leadSpecs.get(c.lead.id) ?? null}
                    state={verdicts.get(c.lead.id)!.state}
                    plain={fitWords(say(c.lead.plain, input.nouns, true), verdicts.get(c.lead.id)!.fitted)}
                    line={!p.sport && (c.id === "fantasy" || c.id === "pools") && faces.length ? `${faces.length} still in` : ""}
                    input={input}
                    gm={gm}
                    data={{ faces: stats.data ? faces : null }}
                    pack={p.sport?.pack ?? null}
                    marks={p.marks}
                    whose={p.sport ? p.whose((leadSpecs.get(c.lead.id)?.span as Span | undefined) ?? null) : null}
                    onOpen={() => p.onBase(c.lead!)}
                  />
                )}
                {c.bases.map((b) => (
                  <BaseSquare key={`${c.id}-${b.id}`} base={{ ...b, name: say(b.name, input.nouns, true) }} state={verdicts.get(b.id)!.state} why={verdicts.get(b.id)!.why} line={fitWords(say(b.plain, input.nouns, true), verdicts.get(b.id)!.fitted)} icon={p.sport ? sportIcon(b.id) : undefined} onOpen={() => p.onBase(b)} />
                ))}
              </div>
            </section>
          ))}
          <div className="mt-6 border-t border-border">
            <button type="button" data-gallery-describe onClick={p.onDescribe} className="nd-press flex min-h-[60px] w-full items-center gap-3 text-left">
              <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-secondary">
                <Sparkles className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-[15px] font-semibold">Describe your game</b>
                <small className="block text-[13px] text-muted-foreground">In your own words: our AI builds it, about 40 seconds</small>
              </span>
              <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
            </button>
            <button type="button" data-gallery-surprise onClick={p.onSurprise} className="nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border text-left">
              <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-secondary">
                <Shuffle className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-[15px] font-semibold">Surprise me</b>
                <small className="block text-[13px] text-muted-foreground">A game picked at random; change anything after</small>
              </span>
              <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** A length on a row: quiet for the season, loud for anything shorter (as on the squares). */
function LenBadge({ text }: { text: string }) {
  return usualLen(text) ? null : <span className="type-caption flex-none rounded-[2px] px-1.5 py-[2px] text-[12px] tracking-[0.05em] outline-1 -outline-offset-1 outline-foreground">{text}</span>;
}

function CommunityRow({ c, saved = false, onOpen }: { c: Community; saved?: boolean; onOpen: () => void }) {
  return (
    <button type="button" data-gallery-community-row={c.i} onClick={onOpen} className="nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border py-2 text-left first-of-type:border-t-0">
      <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-card">
        <Pictogram id={c.base?.id ?? "sheet"} className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <b className="flex items-center gap-2 text-[15px] font-semibold">
          <span className="truncate">{c.name}</span>
          <LenBadge text={c.badge} />
        </b>
        <small className="block truncate text-[13px] text-muted-foreground">
          {c.base?.name ?? "A game"} · Made by us{saved ? <> · <Heart className="inline size-3 -translate-y-px" fill="currentColor" aria-label="saved" /></> : null}
        </small>
      </span>
    </button>
  );
}

/** One of your saved games: its name, its length here, what it is (the engine's short line, its dates left out); dashed with our
 *  check's reason when it can't play on this season. */
function SavedRowView({ r, input, onOpen }: { r: SavedRow; input: Input; onOpen: () => void }) {
  const off = !!r.why;
  const when = r.s.on !== input.label ? `saved on ${r.s.on}` : `saved ${new Date(r.s.savedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  return (
    <button type="button" data-gallery-saved-row={r.s.base} data-off={off ? "" : undefined} onClick={onOpen} className="nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border py-2 text-left first-of-type:border-t-0">
      <span className={`grid size-10 flex-none place-items-center rounded-[3px] ${off ? "border border-dashed border-edge text-muted-foreground" : "bg-card"}`}>
        <Pictogram id={r.base?.id ?? "sheet"} className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <b className={`flex items-center gap-2 text-[15px] font-semibold ${off ? "text-muted-foreground" : ""}`}>
          <span className="truncate">{say(r.s.name, input.nouns, true)}</span>
          {!off && <LenBadge text={r.badge} />}
        </b>
        <small className="block truncate text-[13px] text-muted-foreground">{off ? `Not on ${input.label}: ${shortWhy(r.why ?? "")}` : `${r.line ? `${r.line} · ` : ""}${when}`}</small>
      </span>
      <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
    </button>
  );
}

// ---------- a base's screen ----------

function BaseBody(p: {
  gm: GM;
  input: Input;
  game: Game;
  setGame: (g: Game) => void;
  lock: ReturnType<typeof lockOf>;
  onRow: (row: string) => void;
  onPopular: (id: string, row: string) => void;
  onUndo: (row: string) => void;
  onPreview: () => void;
  onRules: () => void;
  community: Community[];
  savedKeys: Set<string>;
  onCommunity: (i: number) => void;
  art: string | null;
  seasonNumber: number | null;
  onStep: (s: Step) => void;
  onOwn: () => void;
  sport: SportView | null;
  marks: Map<string, Mark>;
  o: WizardOptions;
  start: StartCtx;
}) {
  const { gm, input, game, lock } = p;
  const pg = input.pg;
  const lengths0 = useMemo(() => lengthsOf(game.spec, input, gm), [game.spec, input, gm]);
  // A sport's run is its games: "Every game left" (a series is not a season).
  const lengths = input.sport ? lengths0.map((l) => ({ ...l, label: l.label.replace(/^The rest of the season$/, "Every game left") })) : lengths0;
  const lid = lengthId(game.span, input);
  const strip0 = stripOf(input, game.span);
  // A sport's strip says games, not episodes: its last game, Game 7.
  const strip = input.sport ? { ...strip0, cells: strip0.cells.map((c) => (c.key === "finale" ? { ...c, top: "Last", under: c.under.replace(/^Ep /, "Game ") } : { ...c, under: c.under.replace(/^Ep /, "Game ").replace(/^aired$/, "played") })) } : strip0;
  // The words take the game's own draft size (fitted, changed or saved), and the fitted note shows only while it's still the size.
  const size = sizeFit(gm, game.base, game.spec);
  // Whose players (step 2.8's design round): a sport's game that picks players says whose, and the base's "from the two teams" names
  // the scope's team; the fitted note goes (it counts the page's whole pool, not the scope's).
  const whose = p.sport && picksPlayers(game.spec) ? whoseOf(p.o, game.span) : null;
  const sentences = sayWhose(fitWords(say(game.base.about, input.nouns), size), whose).split(/(?<=\.)\s+/).filter(Boolean);
  const fitNote = !whose && game.fitted && size && game.fitted.to === size.to ? game.fitted : null;
  // Try it is offered only when the desk opens previews to you, with how many you have left this week under it (the flow spec's §1).
  const allowance = usePreviewAllowance();
  const kind = gm.kindOf(game.spec);
  const play = gm.playRow(game.spec);
  const later = input.stages.find((s, i) => i > 0 && !(s.at != null && s.at <= input.from));
  const rowLine = (row: string) => (gm.rowLine(row, game.spec, pg) ?? "").replace(/ · The show's points|The show's points · /, "").replace(/(?<!One game)^One game · /, "").replace("A new draft at a stage", later ? `A new draft at ${later.start}` : "A new draft at a stage");
  // A length's card says what its title doesn't: one episode's day, else where it runs from and to.
  const lengthLine = (l: (typeof lengths)[number]) => {
    // Step 2.7 (impeccable clarify): the regular season says where it ends (a stats game's is Week 17, not the 18th), and through the
    // final says what it adds.
    if (l.id === "regular" && typeof l.span.to === "number") return `Through ${input.ep.replace(/^./, (c) => c.toUpperCase())} ${l.span.to}`;
    if (l.id === "final") return "Playoffs included";
    if (l.id === "next") {
      const e = input.listed.find((x) => x.number === input.from);
      const day = e ? shortDate(e.airAt) : null;
      return `One ${input.ep}${day ? ` · ${day}` : ""}`;
    }
    const f = l.span.from;
    const t = l.span.to === null ? input.total : l.span.to;
    const n = typeof f === "number" && typeof t === "number" && t >= f ? t - f + 1 : null;
    return n ? `${n} ${n === 1 ? input.ep : input.eps}` : sportSay(input, stretchLine(l.span, input));
  };
  const ownTeams = ownTeamsOf(game.spec);
  // Make it… (U0's quick changes, by goal): each goal's next step on this game, or why there's none.
  const GOALS: [Goal, string, ReactNode][] = [
    ["comp", "More competitive", <Swords key="c" className="size-5" aria-hidden />],
    ["casual", "More casual", <Sofa key="s" className="size-5" aria-hidden />],
    ["score", "Different scoring", <Calculator key="d" className="size-5" aria-hidden />],
  ];
  const goals = GOALS.map(([g, label, icon]) => {
    const swap = p.sport ? sportStep(g, game.base, p.sport, game.span) : null;
    const st: Step | { why: string } = swap ? { goal: g, says: swap.says, spec: swap.spec, row: null, base: swap.base } : nextStep(gm, g, game.base, game.spec, game.span, pg, input.ep);
    return { goal: g, label, icon, next: "says" in st ? st.says : null, why: "why" in st ? st.why : null, onTap: () => ("says" in st ? p.onStep(st) : undefined) };
  });
  const isBase = game.name === game.base.name;
  const setLength = (id: string) => {
    const l = lengths.find((x) => x.id === id);
    if (!l) return;
    p.setGame({ ...game, span: l.span, spec: withSpan(game.spec, l.span) });
  };
  const rows = ["who", "compete", "bets", "play", "scoring", "twists", "season", "details"].filter((r) => !(r === "play" && play.headline));
  // A rule's value in the engine's own words: Your team reads what it is ("Draft 5, start 3"), not the names of its changes;
  // Scoring reads the show's points until something changes them.
  const shortParts = (gm.check(game.spec, pg).short?.line ?? "").split(" · ").filter((x) => x && !/^(from |episode|episodes|just |the rest|till |through |rest of|all season|the season|game \d|games \d|week|this week|tonight|every game|the series)/i.test(x));
  const withBots = game.bots && !gm.botsFit(game.spec) ? game.bots : null;
  const valueOf = (r: string) => {
    if (r === "who" && withBots) return `${rowLine(r) || defaultLine(r)} · ${botsWords(withBots)}`;
    if (r === "play") return shortParts[0] ?? (rowLine(r) || defaultLine(r));
    if (r === "scoring") return rowLine(r).split(" · ").filter((x) => x && !/^(What scores|The show's points)$/.test(x)).join(" · ") || (input.sport ? "Standard points" : "The show's points");
    return rowLine(r) || defaultLine(r);
  };
  // Each row's value read once per game (rowLine checks every change of its row: not again on every render; the review, B1).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const values = useMemo(() => Object.fromEntries(rows.map((r) => [r, valueOf(r)])), [game.spec, pg, input.sport, withBots?.n, withBots?.level]);
  const rowName = (r: string) => (r === "play" ? play.name : gm.ROWS.find((x) => x.id === r)?.name ?? r);
  return (
    <div className="flex flex-col">
      <TitleCard
        name={say(game.name, input.nouns, true)}
        kicker={kickerOf(input.show, p.seasonNumber)}
        art={p.art}
        aka={isBase ? game.base.aka ?? [] : []}
        sentence={sentences[0]}
        mark={
          p.sport ? (
            <span className="flex flex-none gap-1 pb-1">
              {(whoseOf(p.o, game.span)?.teams ?? (p.sport.pack?.teams ?? []).slice(0, 2)).map((t) => {
                const m = p.marks.get(t.id);
                return m ? <TeamMark key={t.id} abbr={m.abbr} color={m.color} /> : null;
              })}
            </span>
          ) : undefined
        }
      />
      {whose && (
        <p data-gallery-whose className="mt-2.5 text-[15px] leading-snug">
          <b className="font-semibold">{(game.spec.get as { by?: string }).by === "pick" ? "Pick from:" : "Draft from:"}</b> {whoseWords(whose)}
          <span className="text-muted-foreground"> · {whose.count === null ? "getting them…" : whose.count}</span>
        </p>
      )}
      <div data-gallery-effort className="mt-3 flex items-center gap-2">
        <EffortMark level={effortOf(game.base.effort)} />
        <p className="min-w-0 flex-1 text-[15px] leading-snug">
          <b className="font-semibold">Everyone:</b> {game.base.effort.replace(/^./, (c) => c.toLowerCase())}
          {fitNote && (
            <span data-gallery-fitted className="block text-[13px] text-muted-foreground">
              {fitNote.to === "shared" ? `Two of you can have the same one: ${fitNote.pool} left for ${fitNote.people}` : `${fitNote.to} each: ${fitNote.pool} ${input.nouns.people} left for ${fitNote.people} of you`}
            </span>
          )}
        </p>
        {TRY_IT && allowance?.open && (
          <button type="button" data-gallery-preview onClick={p.onPreview} className="nd-press flex h-11 flex-none items-center gap-1.5 rounded-[3px] px-3 text-[14px] font-bold outline-1 -outline-offset-1 outline-input">
            <Play className="size-4" aria-hidden /> Try it
          </button>
        )}
      </div>
      {TRY_IT && allowance?.open && (
        <p data-gallery-preview-left className="mt-1 text-right text-[13px] text-muted-foreground">
          {allowanceLine(allowance)}
        </p>
      )}
      {game.base.moment && <MomentRow input={input} game={game} setGame={p.setGame} gm={gm} />}

      <section data-gallery-length className="mt-7">
        <QuestionHead id="length" question="How long?" answer={lengths.find((l) => l.id === lid)?.label ?? sportSay(input, stretchLine(game.span, input))} detail={lid === "next" ? null : sportSay(input, stretchLine(game.span, input))} />
        <Timeline cells={strip.cells} stages={strip.stages} />
        <div className="mt-3 grid grid-cols-2 gap-2">
          {lengths.map((l) => (
            <OptionCard key={l.id} data={`length-${l.id}`} title={l.label} line={l.ok ? lengthLine(l) : undefined} off={l.ok ? null : shortWhy(l.why ?? "")} chosen={l.id === lid} onPick={() => setLength(l.id)} />
          ))}
        </div>
        <StartsFrom o={p.o} start={p.start} input={input} />
      </section>

      <section data-gallery-lock={lock.value} className="mt-8">
        <QuestionHead
          id="lock"
          question="Together, or at your own pace?"
          answer={input.ownPace || lock.value === "own" ? PLAIN_LOCK.own.title : PLAIN_LOCK.live.title}
          detail={input.ownPace ? `Every ${input.ep} is out: each of you plays one at a time, whenever you watch it.${ownTeams ? " The draft is together first; once it starts, no one new can join." : ""}` : null}
        />
        {!input.ownPace && input.marks.length > 1 && (
          <div data-gallery-couch-marks className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[14px]">
            <span className="text-muted-foreground">Where your couch is:</span>
            {input.marks.map((m) => {
              const behind = Math.max(0, input.aired - m.seen);
              return (
                <span key={m.userId} className={`inline-flex items-center gap-1.5 ${behind >= 2 ? "font-semibold" : ""}`}>
                  <Avatar id={m.userId} name={m.name} size={22} colour={colourOf(m.userId)} />
                  {m.you ? "you" : m.name} <span className="tabular-nums text-muted-foreground">{behind ? `${behind} behind` : "up to date"}</span>
                </span>
              );
            })}
          </div>
        )}
        {!input.ownPace && (
          <div className="flex flex-col gap-2">
            {(["live", "own"] as const).map((m) => {
              const cost = m === "live" ? lockOf(game.spec, game.span, input, "live").costs : null;
              const phasedOwn = lock.phased && m === "own";
              return (
                <OptionCard
                  key={m}
                  data={`lock-${m}`}
                  title={PLAIN_LOCK[m].title}
                  line={PLAIN_LOCK[m].line(input, ownTeams)}
                  note={cost ? `${cost.name} is ${cost.behind} behind: they'd have to catch up or skip a move` : null}
                  off={phasedOwn && Array.isArray(game.spec.stages) ? "A game in stages can't wait for people yet" : null}
                  chosen={(lock.value === "strict" ? "live" : lock.value) === m}
                  onPick={() => p.setGame({ ...game, pace: m })}
                />
              );
            })}
          </div>
        )}
        {lock.costs && lock.phased && (
          <div data-gallery-lock-costs className="mt-2 flex items-center gap-3 rounded-[3px] bg-secondary px-3 py-2">
            <p className="min-w-0 flex-1 text-[14px] leading-snug">
              {costWords(lock.value, lock.costs, input)}
              {lock.phased && Array.isArray(game.spec.stages) ? <span className="block text-[13px] text-muted-foreground">A game in stages can&rsquo;t wait for people yet.</span> : null}
            </p>
            {!lock.phased ? (
              <button type="button" data-gallery-wait onClick={() => p.setGame({ ...game, pace: "own" })} className="nd-press h-11 flex-none rounded-[3px] px-3 text-[14px] font-bold outline-1 -outline-offset-1 outline-input">
                Wait for {lock.costs.name}
              </button>
            ) : typeof game.span.from === "object" ? (
              <button type="button" data-gallery-wait onClick={() => p.setGame({ ...game, span: { from: input.from, to: game.span.to }, spec: withSpan(game.spec, { from: input.from, to: game.span.to }), pace: "own" })} className="nd-press h-11 flex-none rounded-[3px] px-3 text-[14px] font-bold outline-1 -outline-offset-1 outline-input">
                Start from {input.from} instead
              </button>
            ) : Array.isArray(game.spec.stages) ? (
              <button type="button" data-gallery-wait onClick={() => { const one = gm.applyChange(game.spec, "onegame", input.pg); p.setGame({ ...game, spec: withSpan(one, game.span), pace: "own", before: { ...game.before, season: game.before.season ?? game.spec } }); }} className="nd-press h-11 flex-none rounded-[3px] px-3 text-[14px] font-bold outline-1 -outline-offset-1 outline-input">
                One game instead
              </button>
            ) : null}
          </div>
        )}
      </section>



      <section data-gallery-make-section className="mt-8">
        <QuestionHead id="rules" question="The rules" detail="Change them by goal, or one at a time." />
        <Label>Make it…</Label>
        <MakeIt items={goals} />
      </section>

      {(() => {
        const bank = (game.spec.score as { bank?: { start?: number } } | undefined)?.bank?.start;
        if (!bank) return null;
        const bet = Math.round(bank / 2);
        return (
          <p data-gallery-example className="mt-5 rounded-[3px] border border-border px-3 py-2 text-[13px] leading-snug text-muted-foreground">
            <b className="font-semibold text-foreground">How a bet works:</b> everyone starts with {bank}. Bet {bet} on who goes home: right, you have {bank + bet}; wrong, {bank - bet}. Points, never money.
          </p>
        );
      })()}
      <div data-gallery-rows className="mt-6">
        <Label>One at a time</Label>
        {play.headline && <RuleLine data="play" icon={kind === "questions" ? "sheet" : kind === "stages" ? "redraft" : ROW_ICON.play} label={play.name} value={kind === "stages" ? (game.spec.stages ?? []).map((st) => st.name).join(" · ") : questionsLine(game.spec)} changed={"play" in game.before} onClick={() => p.onRow(kind === "questions" ? "questions" : kind === "stages" ? "season" : "play")} onUndo={() => p.onUndo("play")} />}
        {rows.map((r) => (
          <RuleLine key={r} data={r} icon={ROW_ICON[r]} label={rowName(r)} value={values[r]} changed={r in game.before} onClick={() => p.onRow(r)} onUndo={() => p.onUndo(r)} />
        ))}
        {OWN_MOMENTS && <RuleLine data="own" icon="onemoment" label="Your own moments" value={game.own.length ? `${game.own.map((m) => m.label).join(", ")} · the couch settles ${game.own.length === 1 ? "it" : "them"}` : "None yet · add what the results won't catch"} changed={game.own.length > 0} onClick={p.onOwn} />}
      </div>
      <FindChange gm={gm} game={game} pg={pg} onToggle={(id, row) => p.onPopular(id, row)} />

      {p.community.length > 0 && (
        <div data-gallery-kind-community className="mt-5">
          <Label>Ready games like it</Label>
          {p.community.slice(0, 3).map((c) => (
            <CommunityRow key={c.i} c={c} saved={!!c.base && p.savedKeys.has(keyOf(c.base.id, c.spec))} onOpen={() => p.onCommunity(c.i)} />
          ))}
        </div>
      )}
      <button type="button" data-gallery-every-rule onClick={p.onRules} className="mt-4 h-11 text-left text-[14px] font-semibold underline decoration-1 underline-offset-[3px]">
        Every rule
      </button>
    </div>
  );
}

/** Find a change: one field, any change by its words (its name, its line, what people call it), shown as its squares. */
function FindChange({ gm, game, pg, onToggle }: { gm: GM; game: Game; pg: Input["pg"]; onToggle: (id: string, row: string) => void }) {
  const [q, setQ] = useState("");
  const ws = q.trim().toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1);
  const found = ws.length
    ? ["who", "compete", "bets", "play", "scoring", "twists", "season", "details"]
        .flatMap((row) => gm.changeStates(game.spec, row, pg).map((st) => ({ row, st })))
        .filter(({ st }) => {
          const hay = `${st.name} ${st.line} ${gm.changeById(st.id)?.aka ?? ""}`.toLowerCase();
          return ws.every((w) => hay.includes(w));
        })
        .slice(0, 6)
    : [];
  return (
    <div data-gallery-find-change className="mt-6">
      <Label>Find a change</Label>
      <label className="flex h-11 items-center gap-2 rounded-[4px] border border-input bg-background px-3 focus-within:border-chyron-line">
        <Search className="size-[18px] flex-none text-muted-foreground" aria-hidden />
        <input data-gallery-find-change-input value={q} onChange={(e) => setQ(e.target.value)} placeholder="captain, bets, lives, head to head" aria-label="Find a change" className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted-foreground" />
      </label>
      {ws.length > 0 &&
        (found.length ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            {found.map(({ row, st }) => (
              <ChoiceSquare key={`${row}-${st.id}`} c={st} chosen={st.on} onPick={() => onToggle(st.id, row)} />
            ))}
          </div>
        ) : (
          <p className="mt-2 text-[14px] text-muted-foreground">No change by that name. Every rule is above.</p>
        ))}
    </div>
  );
}

// TEMP (Round 2): a season's suggested moments are planned (E5: rated at its setup, so one tap adds one); until then, these stand
// in, added to the page here so our check can place them, and said as "added when you start".
const SUGGESTED: { id: string; label: string }[] = [
  { id: "cried", label: "Cries" },
  { id: "blindsided", label: "Gets blindsided" },
  { id: "confessional", label: "Talks to the camera most" },
];

/** The moment a base leaves open (Who does it most?, the one-moment draft): the season's own moments, then suggested ones. */
function MomentRow({ input, game, setGame, gm }: { input: Input; game: Game; setGame: (g: Game) => void; gm: GM }) {
  const own = input.pg.moments.slice(0, 12).map((m) => ({ id: m.id, label: m.label ?? m.id, own: true }));
  const all = [...(SUGGESTED_MOMENTS ? SUGGESTED.filter((s) => !own.some((o) => o.id === s.id)).map((s) => ({ ...s, own: false })) : []), ...own];
  const current = all.find((m) => m.id === game.moment) ?? own[0];
  const pick = (id: string, isOwn: boolean) => {
    const m = all.find((x) => x.id === id);
    if (!m) return;
    if (!isOwn && !input.pg.ctx.moments?.some((x) => x.id === id)) {
      // Stand in for the moment our AI would add to the season (TEMP): research would ask it from the next episode.
      (input.pg.ctx.moments as unknown as { id: string; label: string; answeredBy: string; defaultPoints: number; auto: boolean; off: boolean }[]).push({ id, label: m.label, answeredBy: "research", defaultPoints: 0, auto: false, off: false });
    }
    const spec = gm.baseSpec(game.base, game.span, input.pg, id);
    if (spec) setGame({ ...game, spec: withSpan(spec, game.span), moment: id });
  };
  return (
    <section data-gallery-moment className="mt-7">
      <QuestionHead id="moment" question="Which moment?" answer={current?.label ?? "Pick one"} detail={current && !current.own ? `Added when you start: our AI checks that recaps report it, then it's asked each ${input.ep}.` : null} />
      {(
        <div className="mt-3 flex flex-wrap gap-2">
          {all.map((m) => (
            <button key={m.id} type="button" data-gallery-moment-pick={m.id} aria-pressed={m.id === current?.id} onClick={() => pick(m.id, m.own)} className={`inline-flex min-h-9 items-center rounded-[2px] px-3 text-left text-[13px] font-semibold ${m.id === current?.id ? "bg-foreground text-background" : m.own ? "bg-background" : "border border-dashed border-edge"}`}>
              {m.label}
              {!m.own && <span className="ml-1.5 text-[11px] font-normal opacity-75">suggested</span>}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

const DEFAULT_LINE: Record<string, string> = { who: "The couch, each for themselves", compete: "Most points", bets: "No bets", play: "", scoring: "The show's points", twists: "None", season: "One game all the way", details: "As recommended" };
const defaultLine = (r: string) => DEFAULT_LINE[r] ?? "";
function questionsLine(spec: Spec): string {
  const a = Array.isArray(spec.ask) ? spec.ask : [];
  if (!a.length) return "None yet";
  const names = a.map((q) => String((q as { ask?: string }).ask ?? "")).filter(Boolean);
  return `${a.length} · ${names.slice(0, 2).join(", ")}${names.length > 2 ? "…" : ""}`;
}

// ---------- a change ----------

function ChangeBody(p: { row: string; states: ChangeState[]; exclusive: boolean; focus?: string; gm: GM; game: Game; pg: Input["pg"]; onSpec: (s: Spec) => void; onFocus: (id: string) => void; onSheet: (s: string) => void; onSay: (s: string) => void; onBots?: (b: Bots | null) => void }) {
  const { states, gm, game, pg } = p;
  // The square whose controls show: the one tapped last, else the first that's on.
  const focus = p.focus ?? states.find((s) => s.on)?.id ?? (game.bots && states.some((s) => s.start === "bot") ? "bot" : null);
  const pick = (c: ChangeState) => {
    if (c.sheet) return p.onSheet(c.sheet);
    // Computer players (E1a): on with one at Normal, off again on a second tap; dashed with why on a game they can't play yet.
    if (c.start === "bot") {
      const why = c.why ?? gm.botsFit(game.spec);
      if (why) return p.onSay(`${c.name}: ${why}`);
      p.onFocus(c.id);
      if (!game.bots) p.onBots?.({ n: 1, level: "normal" });
      else if (focus === c.id) p.onBots?.(null);
      return;
    }
    if (c.start) return p.onSay(`${c.name}: Start tells nobody, and the game is yours alone.`);
    if (c.why && !c.on) return p.onSay(`${c.name}: ${c.why}`);
    p.onFocus(c.id);
    if (c.on) {
      if (!p.exclusive && gm.changeById(c.id) && (gm.CHANGES.find((x) => x.id === c.id) as { apply?: unknown } | undefined)) {
        // A change that's a setting of the game (how many, the draft) stays on; one that's a toggle comes off on a second tap.
        const ch = gm.CHANGES.find((x) => x.id === c.id) as unknown as { off?: unknown; apply?: unknown };
        if (ch.off && focus === c.id) p.onSpec(gm.dropChange(game.spec, c.id, pg));
      }
      return;
    }
    p.onSpec(gm.applyChange(game.spec, c.id, pg));
  };
  const cells: ReactNode[] = [];
  const botsOff = gm.botsFit(game.spec);
  const bots = game.bots && !botsOff ? game.bots : null;
  states.forEach((c) => {
    if (c.start === "bot" && botsOff && !c.why) c = { ...c, why: botsOff };
    if (c.start === "bot") {
      cells.push(<ChoiceSquare key={c.id} c={bots ? { ...c, line: `${botsWords(bots)}, ${bots.level === "normal" ? "playing as a regular would" : bots.level === "easy" ? "playing it easy" : "playing sharp"}` } : c} chosen={!!bots} onPick={() => pick(c)} />);
      if (bots && focus === c.id)
        cells.push(
          <Controls
            key="bot-controls"
            controls={[
              { id: "n", label: "How many", kind: "stepper", range: [1, 5], def: 1, more: false, value: bots.n },
              { id: "level", label: "How sharp", kind: "segment", options: BOT_LEVELS, def: "normal", more: false, value: bots.level },
            ]}
            onSet={(id, v) => p.onBots?.(id === "n" ? { ...bots, n: Math.max(1, Math.min(5, Number(v) || 1)) } : { ...bots, level: v as BotLevel })}
          />
        );
      return;
    }
    cells.push(<ChoiceSquare key={c.id} c={c} chosen={c.on} onPick={() => pick(c)} />);
    if (c.id === focus && c.on && c.controls.length) {
      // The controls go right after the row this square ends, across both columns.
      const i = cells.length;
      const fill = i % 2 === 1 ? 1 : 0;
      void fill;
      cells.push(
        <Controls
          key={`${c.id}-controls`}
          controls={c.controls}
          onSet={(id, v) => p.onSpec(gm.setControl(game.spec, c.id, id, v, pg))}
        />,
      );
    }
  });
  return (
    <div className="flex flex-col">
      <p data-gallery-change-lead className="mb-4 text-[16px] leading-snug">{p.exclusive ? `Pick one for ${game.name}.` : `Turn on what suits ${game.name}; each says what it changes.`}</p>
      <div className="grid grid-cols-2 gap-3 [grid-auto-flow:dense]">{cells}</div>
    </div>
  );
}

// ---------- the questions ----------

function QuestionsBody({ gm, game, input, onSpec }: { gm: GM; game: Game; input: Input; onSpec: (s: Spec) => void }) {
  const pg = input.pg;
  const asks = (Array.isArray(game.spec.ask) ? game.spec.ask : []) as Record<string, unknown>[];
  const [adding, setAdding] = useState(false);
  // A question tapped opens its settings under it (asked when, open until, worth, from whom), as a change's controls open under it.
  const [open, setOpen] = useState<number | null>(null);
  type QControl = (typeof gm.QUESTION_CONTROLS)[number] & { read: (q: Record<string, unknown>) => unknown; write: (q: Record<string, unknown>, v: unknown) => Record<string, unknown> };
  const qControls = gm.QUESTION_CONTROLS as QControl[];
  const has = (needs?: string) => !needs || (needs === "results" ? pg.results : needs === "winner" ? pg.winner : needs === "grouped" ? pg.grouped : needs === "votes" ? pg.votes : needs === "trivia" ? pg.trivia : needs === "later" ? pg.later.length > 0 : needs === "roles" ? !!(pg.ctx as { roles?: unknown[] }).roles?.length : needs === "facts" ? true : needs === "calls" ? pg.calls : true);
  const kinds = gm.QUESTION_KINDS.filter((k) => !!k.sport === pg.sport && has(k.needs));
  const add = (id: string) => {
    const k = gm.QUESTION_KINDS.find((x) => x.id === id);
    if (!k) return;
    // Everything its kind carries (the line, the options, the pairs, how many to name), and what settles it on this season: its first
    // moment (a group's, for a group question), a phase still to come, the show's secret role.
    const kk = k as typeof k & { pick?: number; within?: unknown; chips?: unknown; pairs?: unknown; line?: unknown; options?: unknown[] };
    const m = (k.moment === "group" ? pg.moments.find((x) => /tribe|team/i.test(`${x.id} ${x.label ?? ""}`)) ?? pg.moments[0] : pg.moments[0])?.id;
    const settle: Record<string, unknown> = { ...k.settle, ...(k.moment ? { moment: m } : {}) };
    if (k.id === "role") settle.role = (pg.ctx as { roles?: { name?: string }[] }).roles?.[0]?.name ?? "Traitor";
    if (k.id === "phase") settle.phase = pg.later[0]?.id;
    const q: Record<string, unknown> = { id: `q${asks.length + 1}-${k.id}`, ask: k.name.endsWith("?") ? k.name : `${k.name}?`, answer: k.answer, points: k.points, asked: k.asked, settle };
    if (k.closes) q.closes = k.closes;
    for (const f of ["pick", "within", "chips", "pairs", "line"] as const) if (kk[f] !== undefined) q[f] = kk[f];
    if (kk.options) q.options = structuredClone(kk.options);
    onSpec({ ...game.spec, ask: [...asks, q] });
    setAdding(false);
  };
  return (
    <div className="flex flex-col">
      <p data-gallery-questions-lead className="mb-3 text-[16px] leading-snug">The questions everyone answers, each before it locks.</p>
      {asks.map((q, i) => {
        // Checked with the questions it builds on (a ticket's legs), not alone: alone, a ticket's legs would read as missing.
        const legs = (q.settle as { of?: unknown } | undefined)?.of;
        const with_ = Array.isArray(legs) ? asks.filter((x) => x === q || legs.includes(x.id)) : [q];
        const v = gm.check({ ...game.spec, ask: with_ } as Spec, pg);
        return (
          <div key={String(q.id ?? i)} className="border-t border-border first:border-t-0">
            <div data-gallery-question={String(q.id ?? i)} className="flex min-h-[56px] items-center gap-3 py-2">
              <span className="type-caption grid size-8 flex-none place-items-center rounded-[3px] bg-secondary text-[17px]">{i + 1}</span>
              <button type="button" data-gallery-question-open={i} aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)} className="min-w-0 flex-1 text-left">
                <b className="block text-[15px] font-semibold leading-snug">{String(q.ask ?? "")}</b>
                <small className="block text-[13px] text-muted-foreground">
                  {String(q.asked ?? "once") === "each" ? `Each ${input.ep}` : "Once"} · {String(q.points ?? 0)} {Number(q.points) === 1 ? "point" : "points"}
                  {!v.ok && v.problems[0] ? ` · ${v.problems[0]}` : ""}
                </small>
              </button>
              <button type="button" aria-label="Take it off" onClick={() => onSpec({ ...game.spec, ask: asks.filter((_, j) => j !== i) })} className="h-10 px-2 text-[13px] text-muted-foreground">
                Remove
              </button>
            </div>
            {open === i && (
              <div className="mb-3 grid grid-cols-2">
                <Controls
                  controls={qControls.map((k) => ({ ...k, value: k.read(q) }))}
                  onSet={(id, value) => {
                    const k = qControls.find((x) => x.id === id);
                    if (k) onSpec({ ...game.spec, ask: asks.map((x, j) => (j === i ? k.write(x, value) : x)) });
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
      {!adding ? (
        <button type="button" data-gallery-add-question disabled={asks.length >= 12} onClick={() => setAdding(true)} className="nd-press mt-3 flex h-12 w-full items-center justify-center rounded-[3px] text-[15px] font-bold outline-1 -outline-offset-1 outline-input disabled:opacity-40">
          Add a question
        </button>
      ) : (
        <div data-gallery-question-kinds className="mt-5">
          <Label>Add a question: pick its kind</Label>
          <div className="grid grid-cols-2 gap-2">
          {kinds.map((k) => (
            <button key={k.id} type="button" data-gallery-question-kind={k.id} onClick={() => add(k.id)} className="nd-press min-h-[52px] rounded-[4px] bg-secondary px-3 py-2 text-left text-[14px] font-semibold leading-tight">
              {k.name}
            </button>
          ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** A game of questions' other ways to ask (a new card each episode, from the moments or our bot), under its questions: the play
 *  row's changes, which its headline row opens straight onto the questions. */
function QuestionsMore({ gm, game, pg, onSpec, onSay }: { gm: GM; game: Game; pg: Input["pg"]; onSpec: (s: Spec) => void; onSay: (s: string) => void }) {
  const [focus, setFocus] = useState<string | undefined>(undefined);
  const states = gm.changeStates(game.spec, "play", pg).filter((c) => c.id !== "addq" && !c.sheet);
  if (!states.length) return null;
  return (
    <div data-gallery-questions-more className="mt-8">
      <Label>More ways to ask</Label>
      <ChangeBody row="play" states={states} exclusive={false} focus={focus} gm={gm} game={game} pg={pg} onSpec={onSpec} onFocus={setFocus} onSheet={() => undefined} onSay={onSay} />
    </div>
  );
}

// ---------- the preview's steps ----------


// ---------- ask the couch first ----------

function AskBody({ gm, input, game, line }: { gm: GM; input: Input; game: Game; line: string }) {
  const v = gm.check(game.spec, input.pg);
  return (
    <div data-gallery-ask-post className="flex flex-col">
      <p className="text-[15px] leading-snug text-muted-foreground">Posted in the couch&rsquo;s chat. Everyone tries it and says if they&rsquo;re in; you start it when you&rsquo;re ready, and can still change the rules.</p>
      <div className="mt-4 rounded-[4px] bg-secondary p-3">
        <span className="type-caption rounded-[2px] bg-quiet-tag px-1.5 text-[11px] tracking-[0.05em] text-quiet-tag-foreground">New game?</span>
        <b className="type-caption mt-2 block text-[22px]">{game.name}</b>
        <p className="mt-1 text-[14px] leading-snug">{v.short ? `${v.short.title} · ${v.short.line}` : game.base.plain}</p>
        <p className="mt-1 text-[13px] text-muted-foreground">{line}</p>
        <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-[14px] font-semibold">
          <Play className="size-4" aria-hidden /> How it plays · Try it
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <span className="grid h-10 place-items-center rounded-[3px] bg-foreground text-[14px] font-bold text-background">I&rsquo;m in</span>
          <span className="grid h-10 place-items-center rounded-[3px] text-[14px] font-bold outline-1 -outline-offset-1 outline-input">Not for me</span>
        </div>
      </div>
    </div>
  );
}

// ---------- the community ----------

function CommunityList({ input, community, saved, savedKeys, onGame, onSaved }: { input: Input; community: Community[]; saved: SavedRow[]; savedKeys: Set<string>; onGame: (i: number) => void; onSaved: (r: SavedRow) => void }) {
  const [sort, setSort] = useState("made");
  const order = (cs: Community[]) => (sort === "short" ? [...cs].sort((a, b) => (a.badge.startsWith("1 ") ? 0 : a.badge === "Season" ? 2 : 1) - (b.badge.startsWith("1 ") ? 0 : b.badge === "Season" ? 2 : 1)) : cs);
  return (
    <div className="flex flex-col">
      <div data-gallery-saved>
        <Label>Saved</Label>
        {saved.length ? (
          saved.map((r) => <SavedRowView key={r.s.key} r={r} input={input} onOpen={() => onSaved(r)} />)
        ) : (
          <p data-gallery-saved-hint className="flex items-center gap-2 pb-1 text-[14px] leading-snug text-muted-foreground">
            <Heart className="size-4 flex-none" aria-hidden /> Tap the heart beside Start on any game to save it here.
          </p>
        )}
      </div>
      <div className="mt-6">
        <Label>Community</Label>
        <ChipRow data="gallery-sort" items={[{ id: "made", label: `Made for ${input.label}`, ok: true }, { id: "short", label: "Shortest", ok: true }]} value={sort} onPick={setSort} />
        <div className="mt-3">
          {order(community).map((c) => (
            <CommunityRow key={c.i} c={c} saved={!!c.base && savedKeys.has(keyOf(c.base.id, c.spec))} onOpen={() => onGame(c.i)} />
          ))}
        </div>
      </div>
      <p className="mt-3 text-[13px] leading-snug text-muted-foreground">Couches share a game once it&rsquo;s started: the rules only, never who played or how they did. How many couches saved each one shows once couches share.</p>
    </div>
  );
}

function CommunityGame({ gm, input, c, saved, onChange, onTry }: { gm: GM; input: Input; c: Community; saved: boolean; onChange: () => void; onTry: (() => void) | null }) {
  const v = gm.check(c.spec, input.pg);
  const strip = stripOf(input, c.spec.span as Span);
  return (
    <div data-gallery-cgame={c.i} className="flex flex-col">
      <p className="mb-3 text-[16px] font-semibold leading-snug">A ready-made game: start a copy as it is, or change it first.</p>
      <p className="flex items-center gap-2 text-[14px] text-muted-foreground">
        <Pictogram id={c.base?.id ?? "sheet"} className="size-6 text-foreground" /> {c.base?.name ?? "A game"} · {c.badge}
        {saved ? <Heart className="size-3.5" fill="currentColor" aria-label="saved" /> : null}
      </p>
      <p className="mt-2 text-[16px] leading-snug">{v.sentence ?? c.base?.about}</p>
      <blockquote className="mt-3 border-l-2 border-edge pl-3 text-[14px] italic leading-snug text-muted-foreground">&ldquo;{c.hook}&rdquo; · Made by us</blockquote>
      <p className="mt-1 text-[13px] text-muted-foreground">The maker&rsquo;s words; the rules above are what plays.</p>
      <section className="mt-6">
        <QuestionHead id="cgame-length" question="How long?" answer={sportSay(input, stretchLine(c.spec.span as Span, input))} />
        <Timeline cells={strip.cells} stages={strip.stages} />
      </section>
      <div className={`mt-5 grid gap-2 ${onTry ? "grid-cols-2" : "grid-cols-1"}`}>
        {onTry && (
          <button type="button" data-gallery-cgame-try onClick={onTry} className="nd-press flex h-11 items-center justify-center gap-1.5 rounded-[3px] text-[14px] font-bold outline-1 -outline-offset-1 outline-input">
            <Play className="size-4" aria-hidden /> Try it
          </button>
        )}
        <button type="button" data-gallery-change-first onClick={onChange} className="nd-press h-11 rounded-[3px] text-[14px] font-bold outline-1 -outline-offset-1 outline-input">
          Change it first
        </button>
      </div>
    </div>
  );
}

// ---------- ready to start ----------

function DoneBody({ gm, input, game, onWait, onAsk }: { gm: GM; input: Input; game: Game; onWait: () => void; onAsk: (() => void) | null }) {
  const v = gm.check(game.spec, input.pg);
  const lock0 = lockOf(game.spec, game.span, input, game.pace);
  const lock = lock0.value === "strict" ? lockOf(game.spec, game.span, input, "live") : lock0;
  return (
    <div data-gallery-would-start className="flex flex-col gap-3">
      <p className="text-[16px] font-semibold leading-snug">This is the game Start makes, and who it tells.</p>
      <p data-gallery-done-tells className="text-[15px] leading-snug">
        {tellsOf(input)}
        {onAsk && (
          <>
            {" "}
            <button type="button" data-gallery-done-ask onClick={onAsk} className="min-h-11 font-semibold underline decoration-1 underline-offset-[3px]">
              Ask them first
            </button>
          </>
        )}
      </p>
      <div className="rounded-[4px] bg-secondary p-3">
        <b className="type-caption block text-[22px]">{say(game.name, input.nouns, true)}</b>
        <p className="mt-1 text-[14px]">{v.short?.line}</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {sportSay(input, stretchLine(game.span, input))} · {lock.value === "own" ? PLAIN_LOCK.own.title : PLAIN_LOCK.live.title}
        </p>
      </div>
      <p className="text-[15px] leading-snug">{v.sentence}</p>
      {lock.costs && (
        <p data-gallery-done-warn className="flex flex-wrap items-center gap-x-2 rounded-[3px] bg-secondary px-3 py-1.5 text-[14px] leading-snug">
          <span>{costWords(lock.value, lock.costs, input)}</span>
          {!lock.phased && (
            <button type="button" data-gallery-done-wait onClick={onWait} className="min-h-11 font-semibold underline decoration-1 underline-offset-[3px]">
              {PLAIN_LOCK.own.title}
            </button>
          )}
        </p>
      )}
      {!v.ok && <p className="rounded-[3px] border border-dashed border-edge px-3 py-2 text-[13px] leading-snug text-muted-foreground">It doesn&rsquo;t play yet: {v.problems[0] ?? v.waits[0]}</p>}
    </div>
  );
}

/** Where it starts, when that's a choice: Include the episode on now (its moves open past the start until its results are in), or,
 *  at your own pace, where you are or from the top (the old list's Starts, as option cards). */
function StartsFrom({ o, start, input }: { o: WizardOptions; start: StartCtx; input: Input }) {
  const E = input.ep[0].toUpperCase() + input.ep.slice(1);
  const pace = o.pace;
  const finished = !!pace && o.starts.length === 0;
  const opts: { id: string; title: string; line: string; n: number | null }[] = [];
  if (pace && pace.here !== null && !start.late) {
    if (!finished) opts.push({ id: "next", title: `With ${E} ${o.nextEpisode}`, line: "The next to air, together with everyone", n: null });
    const seen = pace.here - 1;
    opts.push({ id: "here", title: `${E} ${pace.here} · where you are`, line: seen <= 0 ? "You haven't watched any yet" : seen === 1 ? `You've seen ${E} 1` : `You've seen 1 to ${seen}; catch up one at a time`, n: pace.here });
    if (finished && pace.here !== pace.top) opts.push({ id: "top", title: `${E} ${pace.top} · from the top`, line: "A rewatch", n: pace.top });
  }
  const chosen = (n: number | null) => (n === null ? !input.ownPace : input.ownPace && input.from === n);
  return (
    <>
      {o.onAir && !input.ownPace && (
        <div className="mt-2">
          <OptionCard
            data="late"
            title={`Include ${E} ${o.onAir.number} · on now`}
            line={`Moves stay open past its start, on the honor system, until its results are in.`}
            chosen={start.late}
            onPick={() => {
              start.setCatchUp(null);
              start.setLate(!start.late);
            }}
          />
        </div>
      )}
      {opts.length > 1 && (
        <div data-gallery-starts className="mt-4">
          <Label>Where it starts</Label>
          <div className="flex flex-col gap-2">
            {opts.map((x) => (
              <OptionCard key={x.id} data={`from-${x.id}`} title={x.title} line={x.line} chosen={chosen(x.n)} onPick={() => start.setCatchUp(x.n)} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
