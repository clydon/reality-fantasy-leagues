"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BookHeart, Calculator, ChevronDown, ChevronRight, Heart, Play, Search, Sofa, Sparkles, Shuffle, Swords } from "lucide-react";
import type * as GalleryModule from "@/lib/game/start-gallery/index.js";
import type * as SportsModule from "@/lib/game/start-gallery/sports.js";
import type { Base, ChangeState, Spec } from "@/lib/game/start-gallery/index.js";
import { useHome, useSeasonStats, type WizardOptions } from "../../data";
import { Sheet } from "../../ui/sheet";
import { Pictogram } from "../gallery/icons";
import { BaseSquare, CatHead, ChipRow, ChoiceSquare, Controls, EffortMark, Finder, Label, MakeIt, OptionCard, QuestionHead, RuleLine, StartBar, StepLine, Timeline, TitleCard } from "./parts";
import { Avatar } from "../../ui/bars";
import { colourOf } from "@/lib/people";
import { toast } from "../../ui/toast";
import { communityOf, costWords, effortOf, fitWords, inputOf, isSentence, lengthId, lengthsOf, lockOf, lockWords, readyOf, say, searchBases, shortDate, shortWhy, sizeFit, stretchLine, stripOf, withSpan, type Community, type Input, type Pace, type Span } from "../gallery/model";
import { keyOf, savedRows, toggleSaved, useSaved, type SavedRow } from "../gallery/saved";
import { AKA, CHANGE_AKA, LEADS, SHELVES, STORY_LEADS, baseName, changeName, searchKnown } from "./known";
import { nextStep, type Goal, type Step } from "./ladders";
import { OwnMomentsBody, type OwnMoment } from "./own-moments";
import { SPORT_AKA, nextGame, sidesOf, sportIcon, sportStep, sportView, useTeamMarks, type Mark, type SportView } from "./sport";
import { TeamMark, teamBg, teamInk } from "../../sports/parts";
import { usualLen } from "./parts";
import { LeadTile } from "./leads";

// Start a game, the gallery (docs/PLAN-start-a-game-redo.md Round 2; docs/design-round/wizard-r2-spec.md, -first-view.md, -shape.md):
// TEMP-UI behind a switch (`?start=gallery`, or localStorage gys_start=gallery) until the user approves the round; Start saves
// nothing here (the would-start screen shows the game our check passed). Every game and change comes from the catalog
// (src/lib/game/start-gallery) on the season's own page, checked and worded by the engine on the phone, as the wizard does.
//
//   the gallery      the field, the ready game folded into the collapsed community section, the category chips, the squares
//   a base           its sentence, what everyone does, How long? (the timeline, the length cards), Together, or at your own pace?
//                    (two plain cards, Together naming whoever it costs), Try it, Make it…, the rules one at a time, the
//                    community's of its kind; Start docked
//   a change         the row's squares, the chosen one's controls under it, Done
//   the questions    a game of questions' own row: its questions, Add a question
//   preview          the practice round's four steps on the real screens (the user, Round 2)
//   ask              Ask the couch first: the post as the couch sees it
//   describe         our AI's one turn (the wait, its errors, the interview whose answers apply at once)
//   community        the made-for library as the community's, your saved games (the heart beside Start), a game's own screen
//   done             what Start would do (Round 2 saves nothing)

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

/** The switch: the bold pass (Round 2b) in place of the wizard, beside Round 2's `?start=gallery`. */
export function boldOn(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search).get("start");
    if (q === "bold") localStorage.setItem("gys_start", "bold");
    if (q === "wizard") localStorage.removeItem("gys_start");
    return localStorage.getItem("gys_start") === "bold";
  } catch {
    return false;
  }
}

type Level =
  | { k: "gallery" }
  | { k: "base" }
  | { k: "change"; row: string; focus?: string }
  | { k: "questions"; q?: number }
  | { k: "preview" }
  | { k: "ask" }
  | { k: "describe" }
  | { k: "community" }
  | { k: "cgame"; i: number }
  | { k: "rules" }
  | { k: "own" }
  | { k: "done" };

interface Game {
  base: Base;
  spec: Spec;
  span: Span;
  pace: Pace | null;
  /** The spec before each row's first change, for that row's Undo. */
  before: Record<string, Spec>;
  asked: boolean;
  from: "base" | "community" | "describe" | "saved";
  name: string;
  moment: string | null;
  /** Your own moments (the user, 2026-11-18): what the results won't catch, settled by the couch or our research. */
  own: OwnMoment[];
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

export function BoldSheet({ open, onOpenChange, o, loading, error, couchId }: { open: boolean; onOpenChange: (o: boolean) => void; o: WizardOptions | undefined; loading: boolean; error: Error | null; couchId: string | null }) {
  const gm = useGalleryModule();
  const { data: home } = useHome();
  const input = useMemo(() => (gm && o ? inputOf(o, home, couchId, gm) : null), [gm, o, home, couchId]);
  // A sport's season: the same gallery, its shelves from the sports catalog (the user, 2026-11-18).
  const sm = useSportsModule(!!o?.sport);
  const sport = useMemo(() => (o?.sport && o.wizard && sm ? sportView(sm, o.wizard.page, o.sport.league) : null), [o, sm]);
  if (!couchId || error || !o || !gm || !input || loading || (o.sport && !sport)) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange} title="Start a game" subtitle={o ? `${o.label} · ${o.couch.name}` : undefined}>
        <div data-gallery={error ? "error" : "loading"} className="pb-2">
          {error ? <p className="text-[15px] text-muted-foreground">{error.message}</p> : !couchId ? <p className="text-[15px] text-muted-foreground">Games are played on a couch.</p> : <div aria-busy className="h-72 animate-pulse rounded-[4px] bg-secondary" />}
        </div>
      </Sheet>
    );
  }
  return <Gallery key={o.seasonId} open={open} onOpenChange={onOpenChange} gm={gm} input={input} sport={sport} />;
}

function Gallery({ open, onOpenChange, gm, input, sport }: { open: boolean; onOpenChange: (o: boolean) => void; gm: GM; input: Input; sport: SportView | null }) {
  const { data: home } = useHome();
  const showInfo = home?.shows.find((s) => s.seasonId === input.seasonId)?.show ?? null;
  const art = showInfo?.artUrl ?? null;
  const flavor = sport ? `sport ${sport.league}` : `${showInfo?.kind ?? (input.sport ? "sport" : "competition")} ${input.label}`;
  const bases = sport ? sport.bases : gm.BASES;
  const marks = useTeamMarks(sport);
  const flavorKind = sport ? "sport" : showInfo?.kind ?? "competition";
  const [levels, setLevels] = useState<Level[]>([{ k: "gallery" }]);
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
  const openBase = (b: Base, spec?: Spec, span?: Span, from: Game["from"] = "base", name?: string) => {
    const sp: Span = span ?? (b.len === "1 episode" ? { from: input.from, to: input.from } : { from: input.from, to: null });
    const s = spec ?? gm.baseSpec(b, sp, pg);
    if (!s) return;
    const fitted = (s as unknown as { __fitted?: Game["fitted"] }).__fitted ?? null;
    setGame({ base: b, spec: withSpan(s, sp), span: sp, pace: null, before: {}, asked: false, from, name: name ?? baseName(b.id, b.name), moment: null, fitted, own: [] });
    push({ k: "base" });
  };
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
      setGame({ ...game, base: st.base, spec: withSpan(st.spec, game.span), before: {}, name: baseName(st.base.id, st.base.name), fitted });
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
  const toggleSave = (g: { base: Base; spec: Spec; span: Span; name: string; from: Game["from"] }) => {
    const on = toggleSaved(g, input);
    setSaid(on ? "Saved. It's in Community and saved games" : "Taken off your saved games");
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
    const v = gm.check(game.spec, pg);
    const lock0 = lockOf(game.spec, game.span, input, game.pace);
    const lock = lock0.value === "strict" ? lockOf(game.spec, game.span, input, "live") : lock0;
    const first = input.listed.find((e) => typeof game.span.from === "number" && e.number === game.span.from);
    const firstLock = first ? lockWords(first.airAt) : null;
    const firstKind = gm.kindOf(Array.isArray(game.spec.stages) ? game.spec.stages[0].game : game.spec);
    const verb = firstKind === "draft" ? "picks" : firstKind === "pick" ? "pick" : firstKind === "card" ? "card" : "guesses";
    const lockLine = lockLineOf(input, lock.value, game.spec, firstLock ? ` · ${verb} by ${firstLock}` : "");
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
        onPreview={() => push({ k: "preview" })}
        onRules={() => push({ k: "rules" })}
        community={community.filter((c) => c.base?.id === game.base.id)}
        savedKeys={savedKeys}
        onCommunity={(i) => push({ k: "cgame", i })}
        art={art}
        onStep={makeIt}
        onOwn={() => push({ k: "own" })}
        sport={sport}
        marks={marks}
      />
    );
    foot = (
      <StartBar
        line={lockLine}
        warn={
          lock.costs
            ? {
                text: `${lock.costs.name} is ${lock.costs.behind} behind ·`,
                fix: lock.phased ? null : { label: PLAIN_LOCK.own.title, onClick: () => setGame({ ...game, pace: "own" }) },
              }
            : null
        }
        label={`Start ${Object.keys(game.before).length || game.own.length ? "your " : ""}${game.name}`}
        tells={input.tells ? `Tells ${input.tells} who watch it` : "Just you for now"}
        asked={game.asked ? `Asked the couch · 0 of ${Math.max(1, input.couch.members - 1)} in so far` : null}
        disabled={v.ok ? null : v.problems[0] ? `Can't start yet: ${v.problems[0]}` : null}
        save={{ on: savedKeys.has(keyOf(game.base.id, game.spec)), onToggle: () => toggleSave(game) }}
        onStart={() => push({ k: "done" })}
        onAsk={() => push({ k: "ask" })}
      />
    );
  } else if (game && level.k === "change") {
    const row = level.row;
    const states = gm.changeStates(game.spec, row, pg);
    const playName = gm.playRow(game.spec).name;
    title = ROW_ASK[row] ?? (row === "play" ? playName : gm.ROWS.find((r) => r.id === row)?.name ?? row);
    subtitle = <StepLine step={2} text={`Set it up · ${game.name}`} />;
    backTo = { label: game.name, onClick: back };
    body = <ChangeBody row={row} states={states} exclusive={EXCLUSIVE.has(row)} focus={level.focus} gm={gm} game={game} pg={pg} onSpec={(s) => change(row, s)} onFocus={(id) => setLevels((ls) => [...ls.slice(0, -1), { k: "change", row, focus: id }])} onSheet={(sheet) => sheet === "question" && push({ k: "questions" })} onSay={setSaid} />;
    foot = (
      <button type="button" data-gallery-done onClick={back} className="nd-press flex h-[52px] w-full items-center justify-center rounded-[3px] text-[16px] font-bold outline-1 -outline-offset-1 outline-input">
        Done
      </button>
    );
  } else if (game && level.k === "questions") {
    title = "What everyone answers";
    subtitle = <StepLine step={2} text={`Set it up · ${game.name}`} />;
    backTo = { label: game.name, onClick: back };
    body = <QuestionsBody gm={gm} game={game} input={input} onSpec={(s) => change("play", s)} />;
    foot = (
      <button type="button" data-gallery-done onClick={back} className="nd-press flex h-[52px] w-full items-center justify-center rounded-[3px] text-[16px] font-bold outline-1 -outline-offset-1 outline-input">
        Done
      </button>
    );
  } else if (game && level.k === "preview") {
    title = "Try it";
    subtitle = <StepLine step={2} text={`Set it up · ${game.name}`} />;
    backTo = { label: game.name, onClick: back };
    body = <PreviewBody gm={gm} input={input} game={game} />;
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
        gm={gm}
        input={input}
        words={q}
        onOpen={(b, spec, name) => openBase(b, spec, spec.span as Span, "describe", name)}
        onStart={(b, spec, name) => {
          openBase(b, spec, spec.span as Span, "describe", name);
          push({ k: "done" });
        }}
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
        onTry={() => {
          if (!c.base) return;
          openBase(c.base, c.spec, c.spec.span as Span, "community", c.name);
          push({ k: "preview" });
        }}
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
          tells={input.tells ? `Tells ${input.tells} who watch it` : "Just you for now"}
          asked={null}
          save={{ on: savedKeys.has(keyOf(base.id, c.spec)), onToggle: () => toggleSave({ base, spec: c.spec, span: cspan, name: c.name, from: "community" }) }}
          onStart={() => open(null, "done")}
          onAsk={() => open(null, "ask")}
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
    body = <DoneBody gm={gm} input={input} game={game} onWait={() => setGame({ ...game, pace: "own" })} onAsk={() => push({ k: "ask" })} />;
  }

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
      const all = p.bases.filter((b) => (b.cat === c.id || b.also === c.id || (SHELVES[c.id] ?? []).includes(b.id)) && shown(b));
      const plays = (id: string) => verdicts.get(id)?.state === "plays";
      const leads = (p.flavorKind === "series" || p.flavorKind === "talk" ? STORY_LEADS[c.id] : null) ?? LEADS[c.id] ?? [];
      const leadId = leads.find((id) => plays(id) && all.some((b) => b.id === id)) ?? all.find((b) => plays(b.id))?.id;
      const lead = all.find((b) => b.id === leadId) ?? null;
      const rank = (b: Base) => ({ plays: 0, needs: 1, off: 2, coming: 3 })[verdicts.get(b.id)?.state ?? "coming"] ?? 3;
      return { ...c, says: say(c.says, input.nouns, true), bases: all.filter((b) => b !== lead).sort((a, b) => rank(a) - rank(b)), lead };
    })
    .filter((c) => c.bases.length || c.lead);
  const found = q.trim() ? searchKnown(q, p.bases.filter(shown)) : [];
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
                <BaseSquare key={base.id} base={{ ...base, name: say(baseName(base.id, base.name), input.nouns, true) }} state={verdicts.get(base.id)!.state} why={verdicts.get(base.id)!.why} line={aka ? `Also called ${aka}` : fitWords(say(base.plain, input.nouns, true), verdicts.get(base.id)!.fitted)} icon={p.sport ? sportIcon(base.id) : undefined} onOpen={() => p.onBase(base)} />
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
                    onOpen={() => p.onBase(c.lead!)}
                  />
                )}
                {c.bases.map((b) => (
                  <BaseSquare key={`${c.id}-${b.id}`} base={{ ...b, name: say(baseName(b.id, b.name), input.nouns, true) }} state={verdicts.get(b.id)!.state} why={verdicts.get(b.id)!.why} line={fitWords(say(b.plain, input.nouns, true), verdicts.get(b.id)!.fitted)} icon={p.sport ? sportIcon(b.id) : undefined} onOpen={() => p.onBase(b)} />
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
  onStep: (s: Step) => void;
  onOwn: () => void;
  sport: SportView | null;
  marks: Map<string, Mark>;
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
  const sentences = fitWords(say(game.base.about, input.nouns), size).split(/(?<=\.)\s+/).filter(Boolean);
  const fitNote = game.fitted && size && game.fitted.to === size.to ? game.fitted : null;
  const kind = gm.kindOf(game.spec);
  const play = gm.playRow(game.spec);
  const later = input.stages.find((s, i) => i > 0 && !(s.at != null && s.at <= input.from));
  const rowLine = (row: string) => (gm.rowLine(row, game.spec, pg) ?? "").replace(/ · The show's points|The show's points · /, "").replace(/(?<!One game)^One game · /, "").replace("A new draft at a stage", later ? `A new draft at ${later.start}` : "A new draft at a stage");
  // A length's card says what its title doesn't: one episode's day, else where it runs from and to.
  const lengthLine = (l: (typeof lengths)[number]) => {
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
  const isBase = game.name === baseName(game.base.id, game.base.name);
  const setLength = (id: string) => {
    const l = lengths.find((x) => x.id === id);
    if (!l) return;
    p.setGame({ ...game, span: l.span, spec: withSpan(game.spec, l.span) });
  };
  const rows = ["who", "compete", "bets", "play", "scoring", "twists", "season", "details"].filter((r) => !(r === "play" && play.headline));
  // A rule's value in the engine's own words: Your team reads what it is ("Draft 5, start 3"), not the names of its changes;
  // Scoring reads the show's points until something changes them.
  const shortParts = (gm.check(game.spec, pg).short?.line ?? "").split(" · ").filter((x) => x && !/^(from |episode|episodes|just |the rest|till |through |rest of|all season|the season|game \d|games \d|week|this week|tonight|every game|the series)/i.test(x));
  const valueOf = (r: string) => {
    if (r === "play") return shortParts[0] ?? (rowLine(r) || defaultLine(r));
    if (r === "scoring") return rowLine(r).split(" · ").filter((x) => x && !/^(What scores|The show's points)$/.test(x)).join(" · ") || (input.sport ? "Standard points" : "The show's points");
    return rowLine(r) || defaultLine(r);
  };
  const rowName = (r: string) => (r === "play" ? play.name : gm.ROWS.find((x) => x.id === r)?.name ?? r);
  return (
    <div className="flex flex-col">
      <TitleCard
        name={say(game.name, input.nouns, true)}
        art={p.art}
        aka={isBase ? AKA[game.base.id] ?? SPORT_AKA[game.base.id] ?? [] : []}
        sentence={sentences[0]}
        mark={
          p.sport ? (
            <span className="flex flex-none gap-1 pb-1">
              {(p.sport.pack?.teams ?? []).slice(0, 2).map((t) => {
                const m = p.marks.get(t.id);
                return m ? <TeamMark key={t.id} abbr={m.abbr} color={m.color} /> : null;
              })}
            </span>
          ) : undefined
        }
      />
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
        <button type="button" data-gallery-preview onClick={p.onPreview} className="nd-press flex h-11 flex-none items-center gap-1.5 rounded-[3px] px-3 text-[14px] font-bold outline-1 -outline-offset-1 outline-input">
          <Play className="size-4" aria-hidden /> Try it
        </button>
      </div>
      {game.base.moment && <MomentRow input={input} game={game} setGame={p.setGame} gm={gm} />}

      <section data-gallery-length className="mt-7">
        <QuestionHead id="length" question="How long?" answer={lengths.find((l) => l.id === lid)?.label ?? sportSay(input, stretchLine(game.span, input))} detail={lid === "next" ? null : sportSay(input, stretchLine(game.span, input))} />
        <Timeline cells={strip.cells} stages={strip.stages} />
        <div className="mt-3 grid grid-cols-2 gap-2">
          {lengths.map((l) => (
            <OptionCard key={l.id} data={`length-${l.id}`} title={l.label} line={l.ok ? lengthLine(l) : undefined} off={l.ok ? null : shortWhy(l.why ?? "")} chosen={l.id === lid} onPick={() => setLength(l.id)} />
          ))}
        </div>
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
          <RuleLine key={r} data={r} icon={ROW_ICON[r]} label={rowName(r)} value={valueOf(r)} changed={r in game.before} onClick={() => p.onRow(r)} onUndo={() => p.onUndo(r)} />
        ))}
        <RuleLine data="own" icon="onemoment" label="Your own moments" value={game.own.length ? `${game.own.map((m) => m.label).join(", ")} · the couch settles ${game.own.length === 1 ? "it" : "them"}` : "None yet · add what the results won't catch"} changed={game.own.length > 0} onClick={p.onOwn} />
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
          const hay = `${changeName(st.id, st.name)} ${st.line} ${CHANGE_AKA[st.id] ?? ""}`.toLowerCase();
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
              <ChoiceSquare key={`${row}-${st.id}`} c={{ ...st, name: changeName(st.id, st.name) }} chosen={st.on} onPick={() => onToggle(st.id, row)} />
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
  const all = [...SUGGESTED.filter((s) => !own.some((o) => o.id === s.id)).map((s) => ({ ...s, own: false })), ...own];
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

function ChangeBody(p: { row: string; states: ChangeState[]; exclusive: boolean; focus?: string; gm: GM; game: Game; pg: Input["pg"]; onSpec: (s: Spec) => void; onFocus: (id: string) => void; onSheet: (s: string) => void; onSay: (s: string) => void }) {
  const { states, gm, game, pg } = p;
  // The square whose controls show: the one tapped last, else the first that's on.
  const focus = p.focus ?? states.find((s) => s.on)?.id ?? null;
  const pick = (c: ChangeState) => {
    if (c.sheet) return p.onSheet(c.sheet);
    if (c.start) return p.onSay(c.coming ? `${c.name} is coming: our bot as a seat that plays (E1).` : `${c.name}: Start tells nobody, and the game is yours alone.`);
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
  states.forEach((c) => {
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
  const has = (needs?: string) => !needs || (needs === "results" ? pg.results : needs === "winner" ? pg.winner : needs === "grouped" ? pg.grouped : needs === "votes" ? pg.votes : needs === "trivia" ? pg.trivia : needs === "later" ? pg.later.length > 0 : needs === "roles" ? !!(pg.ctx as { roles?: unknown[] }).roles?.length : needs === "facts" ? true : needs === "calls" ? pg.calls : true);
  const kinds = gm.QUESTION_KINDS.filter((k) => !!k.sport === pg.sport && has(k.needs));
  const add = (id: string) => {
    const k = gm.QUESTION_KINDS.find((x) => x.id === id);
    if (!k) return;
    const m = pg.moments[0]?.id;
    const q: Record<string, unknown> = { id: `q${asks.length + 1}-${k.id}`, ask: k.name.endsWith("?") ? k.name : `${k.name}?`, answer: k.answer, points: k.points, asked: k.asked, settle: { ...k.settle, ...(k.moment ? { moment: m } : {}) } };
    if (k.closes) q.closes = k.closes;
    onSpec({ ...game.spec, ask: [...asks, q] });
    setAdding(false);
  };
  return (
    <div className="flex flex-col">
      <p data-gallery-questions-lead className="mb-3 text-[16px] leading-snug">The questions everyone answers, each before it locks.</p>
      {asks.map((q, i) => {
        const v = gm.check({ ...game.spec, ask: [q] } as Spec, pg);
        return (
          <div key={String(q.id ?? i)} data-gallery-question={String(q.id ?? i)} className="flex min-h-[56px] items-center gap-3 border-t border-border py-2 first:border-t-0">
            <span className="type-caption grid size-8 flex-none place-items-center rounded-[3px] bg-secondary text-[17px]">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <b className="block text-[15px] font-semibold leading-snug">{String(q.ask ?? "")}</b>
              <small className="block text-[13px] text-muted-foreground">
                {String(q.asked ?? "once") === "each" ? `Each ${input.ep}` : "Once"} · {String(q.points ?? 0)} {Number(q.points) === 1 ? "point" : "points"}
                {!v.ok && v.problems[0] ? ` · ${v.problems[0]}` : ""}
              </small>
            </span>
            <button type="button" aria-label="Take it off" onClick={() => onSpec({ ...game.spec, ask: asks.filter((_, j) => j !== i) })} className="h-10 px-2 text-[13px] text-muted-foreground">
              Remove
            </button>
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

// ---------- the preview's steps ----------

function PreviewBody({ gm, input, game }: { gm: GM; input: Input; game: Game }) {
  const kind = gm.kindOf(game.spec);
  const seen = input.marks.find((m) => m.you)?.seen ?? null;
  const replay = seen && seen > 0 && seen <= input.aired ? seen : null;
  const steps: [string, string][] =
    kind === "draft"
      ? [["The draft room", "Pick your team. Pick for me fills it."], ["The game page", "Before each episode, choose who plays."], [replay ? `${input.ep[0].toUpperCase()}${input.ep.slice(1)} ${replay} airs` : "An episode airs", replay ? "Real results: your team's points land on the sheet." : "Made-up results with the real cast, under a red tag."], ["The table", "What decides it, and Start."]]
      : kind === "pick"
        ? [["Your pick", "Pick who stays in."], ["The game page", "Each episode, a new pick."], [replay ? `Episode ${replay} airs` : "An episode airs", replay ? "Real results: right picks keep your streak." : "Made-up results, under a red tag."], ["The table", "The streaks, and Start."]]
        : [["Your answers", "Answer before it airs."], ["The game page", "What's due each episode."], [replay ? `Episode ${replay} airs` : "An episode airs", replay ? "Real results grade your answers." : "Made-up results, under a red tag."], ["The table", "Who's ahead, and Start."]];
  return (
    <div data-gallery-preview-steps className="flex flex-col">
      <p className="text-[15px] leading-snug">A throwaway copy of this game with the real cast and rules, and two practice players. Nothing is saved, and nobody is told.</p>
      <ol className="mt-4 flex flex-col">
        {steps.map(([t, l], i) => (
          <li key={t} className="flex gap-3 border-t border-border py-3 first:border-t-0">
            <span className="type-caption grid size-8 flex-none place-items-center rounded-[3px] bg-secondary text-[17px]">{i + 1}</span>
            <span>
              <b className="block text-[15px] font-semibold">{t}</b>
              <small className="block text-[13px] text-muted-foreground">{l}</small>
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-2 rounded-[3px] bg-secondary px-3 py-2 text-[13px] leading-snug text-muted-foreground">Round 2: the practice copy is built from the spec in the build (the B-lane); the story shows each step on the real screens.</p>
    </div>
  );
}

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

// ---------- describe ----------

// TEMP (Round 2): our AI's reply is a fixture behind the switch (no ask is spent): the reply the user chose (each answer carrying
// its change) for "guess who wins immunity and who goes home each week, double or nothing on the boot, finale counts double".
// ?describe=away or ?describe=used shows its errors.
function DescribeBody({ gm, input, words, onOpen, onStart }: { gm: GM; input: Input; words: string; onOpen: (b: Base, spec: Spec, name: string) => void; onStart: (b: Base, spec: Spec, name: string) => void }) {
  const forced = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("describe") : null;
  const [state, setState] = useState<"wait" | "result" | "away" | "used">(forced === "away" || forced === "used" ? forced : "wait");
  const [answer, setAnswer] = useState<Record<number, number>>({});
  useEffect(() => {
    if (forced === "away" || forced === "used" || forced === "wait") return;
    const t = setTimeout(() => setState("result"), 2600);
    return () => clearTimeout(t);
  }, [forced]);
  const said = words.trim() || "Guess who wins immunity and who goes home each week, double or nothing on the boot, finale counts double";
  const sheet = gm.baseById("sheet")!;
  const base = gm.baseSpec(sheet, { from: input.from, to: null }, input.pg)!;
  const spec0: Spec = { ...base, ask: (base.ask ?? []).slice(0, 2).map((q, i) => (i === 0 ? { ...q, wager: "total" } : q)) };
  const answers: { label: string; line: string; spec: Spec }[] = [
    { label: "Keep it guesses", line: "No double: a game of guesses can't double its finale yet", spec: spec0 },
    { label: "A team game, finale ×2", line: "Pick a team; what they do scores, and the finale counts double", spec: gm.applyChange(gm.baseSpec(gm.baseById("fantasy")!, { from: input.from, to: null }, input.pg)!, "times", input.pg) },
  ];
  const chosen = answers[answer[0] ?? 0];
  if (state === "wait")
    return (
      <div data-gallery-describe="wait" className="flex flex-col items-start gap-3">
        <p className="text-[15px] leading-snug">&ldquo;{said}&rdquo;</p>
        <div className="w-full rounded-[4px] bg-secondary p-3">
          <span className="type-caption text-[17px]">Our AI is building it</span>
          <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-background">
            <i className="roll-sweep absolute inset-y-0 left-0 w-1/3 rounded-full bg-foreground/70" />
          </div>
          <p className="mt-2 text-[13px] text-muted-foreground">About 40 seconds{input.asksLeft != null ? ` · ${input.asksLeft} asks left today` : ""}. Leave if you like: it&rsquo;s here when you&rsquo;re back.</p>
        </div>
      </div>
    );
  if (state === "away" || state === "used")
    return (
      <div data-gallery-describe={state} className="flex flex-col gap-3">
        <p className="text-[15px] leading-snug">&ldquo;{said}&rdquo;</p>
        <div className="rounded-[4px] border border-dashed border-edge p-3">
          <b className="block text-[15px] font-semibold">{state === "away" ? "Our AI is away right now" : "That's today's ten asks"}</b>
          <p className="mt-1 text-[14px] leading-snug text-muted-foreground">{state === "away" ? "Everything in the gallery works by tapping. Try the closest games below, or ask again in a while." : "Back tomorrow at 7 AM. Every game in the gallery still works by tapping."}</p>
        </div>
        <Label>Closest by tapping</Label>
        <div className="grid grid-cols-2 gap-3">
          {searchBases(said, gm.BASES.filter((b) => b.spec)).slice(0, 2).map(({ base }) => (
            <BaseSquare key={base.id} base={base} state="plays" onOpen={() => onOpen(base, gm.baseSpec(base, { from: input.from, to: null }, input.pg)!, base.name)} />
          ))}
        </div>
      </div>
    );
  return (
    <div data-gallery-describe="result" className="flex flex-col gap-4">
      <div>
        <Label>What we heard</Label>
        <p className="text-[15px] leading-snug">
          <mark className="rounded-[2px] bg-foreground/15 px-0.5 text-foreground">Guess who wins immunity and who goes home</mark> each week,{" "}
          <mark className="rounded-[2px] bg-foreground/15 px-0.5 text-foreground">double or nothing on the boot</mark>, <span className="text-muted-foreground line-through decoration-1">finale counts double</span>
        </p>
        <p className="mt-2 text-[13px] leading-snug text-muted-foreground">A doubled finale works in a team game, not yet in a game of guesses.</p>
      </div>
      <div data-gallery-interview>
        <Label>One thing to settle</Label>
        <p className="mb-2 text-[15px] font-semibold">Keep it guesses, or make it a team game with the finale doubled?</p>
        <div className="flex flex-col gap-2">
          {answers.map((a, i) => (
            <button key={a.label} type="button" data-gallery-answer={i} aria-pressed={(answer[0] ?? 0) === i} onClick={() => setAnswer({ 0: i })} className={`nd-press rounded-[4px] p-3 text-left ${(answer[0] ?? 0) === i ? "bg-foreground text-background" : "bg-secondary"}`}>
              <b className="block text-[15px] font-semibold">{a.label}</b>
              <small className={`block text-[13px] ${(answer[0] ?? 0) === i ? "text-background/75" : "text-muted-foreground"}`}>{a.line}</small>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[13px] text-muted-foreground">Each answer is already checked by our engine: a tap changes it now, nothing waits.</p>
      </div>
      <div className="flex flex-col gap-2">
        <button type="button" data-gallery-describe-start onClick={() => onStart((answer[0] ?? 0) === 0 ? sheet : gm.baseById("fantasy")!, chosen.spec, (answer[0] ?? 0) === 0 ? "Your guesses" : "Your team game")} className="nd-press type-caption flex h-[52px] w-full items-center justify-center rounded-[3px] bg-chyron text-[20px] text-chyron-foreground">
          Start it
        </button>
        <button type="button" data-gallery-describe-open onClick={() => onOpen((answer[0] ?? 0) === 0 ? sheet : gm.baseById("fantasy")!, chosen.spec, (answer[0] ?? 0) === 0 ? "Your guesses" : "Your team game")} className="nd-press h-12 w-full rounded-[3px] text-[15px] font-bold outline-1 -outline-offset-1 outline-input">
          Open it to change more
        </button>
      </div>
    </div>
  );
}

// ---------- the community ----------

function CommunityList({ input, community, saved, savedKeys, onGame, onSaved }: { input: Input; community: Community[]; saved: SavedRow[]; savedKeys: Set<string>; onGame: (i: number) => void; onSaved: (r: SavedRow) => void }) {
  const [sort, setSort] = useState("made");
  const order = (cs: Community[]) => (sort === "saved" ? [...cs].sort((a, b) => b.saves - a.saves) : sort === "short" ? [...cs].sort((a, b) => (a.badge.startsWith("1 ") ? 0 : a.badge === "Season" ? 2 : 1) - (b.badge.startsWith("1 ") ? 0 : b.badge === "Season" ? 2 : 1)) : cs);
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

function CommunityGame({ gm, input, c, saved, onChange, onTry }: { gm: GM; input: Input; c: Community; saved: boolean; onChange: () => void; onTry: () => void }) {
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
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button type="button" data-gallery-cgame-try onClick={onTry} className="nd-press flex h-11 items-center justify-center gap-1.5 rounded-[3px] text-[14px] font-bold outline-1 -outline-offset-1 outline-input">
          <Play className="size-4" aria-hidden /> Try it
        </button>
        <button type="button" data-gallery-change-first onClick={onChange} className="nd-press h-11 rounded-[3px] text-[14px] font-bold outline-1 -outline-offset-1 outline-input">
          Change it first
        </button>
      </div>
    </div>
  );
}

// ---------- would start (Round 2 saves nothing) ----------

function DoneBody({ gm, input, game, onWait, onAsk }: { gm: GM; input: Input; game: Game; onWait: () => void; onAsk: () => void }) {
  const v = gm.check(game.spec, input.pg);
  const lock0 = lockOf(game.spec, game.span, input, game.pace);
  const lock = lock0.value === "strict" ? lockOf(game.spec, game.span, input, "live") : lock0;
  return (
    <div data-gallery-would-start className="flex flex-col gap-3">
      <p className="text-[16px] font-semibold leading-snug">This is the game Start makes, and who it tells.</p>
      <p data-gallery-done-tells className="text-[15px] leading-snug">
        {tellsOf(input)}{" "}
        <button type="button" data-gallery-done-ask onClick={onAsk} className="min-h-11 font-semibold underline decoration-1 underline-offset-[3px]">
          Ask them first
        </button>
      </p>
      <div className="rounded-[4px] bg-secondary p-3">
        <b className="type-caption block text-[22px]">{v.short?.title ?? game.name}</b>
        <p className="mt-1 text-[14px]">{v.short?.line}</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {stretchLine(game.span, input)} · {lock.value === "own" ? PLAIN_LOCK.own.title : PLAIN_LOCK.live.title}
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
      {game.own.length > 0 && (
        <p data-gallery-own-done className="text-[14px] leading-snug">
          <b className="font-semibold">Your own moments, added when it starts:</b> {game.own.map((m) => `${m.label} (${m.points}, ${m.by === "couch" ? "the couch settles it" : "our research"})`).join("; ")}.
        </p>
      )}
      <p className="rounded-[3px] border border-dashed border-edge px-3 py-2 text-[13px] leading-snug text-muted-foreground">Nothing is saved yet: this is the game our check passed, and what Start would make. {v.ok ? "It plays." : `It doesn't play yet: ${v.problems[0] ?? v.waits[0]}`}</p>
      <details className="text-[12px] text-muted-foreground">
        <summary className="cursor-pointer text-[13px] font-semibold">The spec</summary>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-[3px] bg-background p-2 font-mono">{JSON.stringify(game.spec, null, 1)}</pre>
      </details>
    </div>
  );
}
