"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BookHeart, ChevronDown, ChevronRight, Heart, Play, Sparkles, Shuffle } from "lucide-react";
import type * as GalleryModule from "@/lib/game/start-gallery/index.js";
import type { Base, ChangeState, Spec } from "@/lib/game/start-gallery/index.js";
import { useHome, type WizardOptions } from "../../data";
import { Sheet } from "../../ui/sheet";
import { PACE_WORDS } from "../start-wizard";
import { Pictogram } from "./icons";
import { BaseSquare, CatHead, ChipRow, ChoiceSquare, Controls, EffortMark, Finder, Label, RowLink, SaveHeart, StartBar, Strip } from "./parts";
import { toast } from "../../ui/toast";
import { communityOf, costWords, effortOf, fitWords, inputOf, isSentence, lengthId, lengthsOf, lockOf, lockWords, readyOf, say, searchBases, shortWhy, sizeFit, stretchLine, stripOf, withSpan, type Community, type Input, type Pace, type Span } from "./model";
import { keyOf, savedRows, toggleSaved, useSaved, type SavedRow } from "./saved";

// Start a game, the gallery (docs/PLAN-start-a-game-redo.md Round 2; docs/design-round/wizard-r2-spec.md, -first-view.md, -shape.md):
// TEMP-UI behind a switch (`?start=gallery`, or localStorage gys_start=gallery) until the user approves the round; Start saves
// nothing here (the would-start screen shows the game our check passed). Every game and change comes from the catalog
// (src/lib/game/start-gallery) on the season's own page, checked and worded by the engine on the phone, as the wizard does.
//
//   the gallery      the field, the ready game folded into the collapsed community section, the category chips, the squares
//   a base           its sentence, what everyone does, How long (the strip, the stage chips), When moves lock (named only when it
//                    costs someone), Preview, popular changes, the rows (More changes), the community's of its kind; Start docked
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

/** The switch: Round 2's gallery in place of the wizard. */
export function galleryOn(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search).get("start");
    if (q === "gallery") localStorage.setItem("gys_start", "gallery");
    if (q === "wizard") localStorage.removeItem("gys_start");
    return localStorage.getItem("gys_start") === "gallery";
  } catch {
    return false;
  }
}

type Level =
  | { k: "gallery" }
  | { k: "base" }
  | { k: "change"; row: string; focus?: string }
  | { k: "questions"; q?: number }
  | { k: "lock" }
  | { k: "preview" }
  | { k: "ask" }
  | { k: "describe" }
  | { k: "community" }
  | { k: "cgame"; i: number }
  | { k: "rules" }
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
  /** How the base's draft was fitted to who's left (4 of you, 10 still in: 2 each, or shared), said on its screen. */
  fitted: { each: number; to: number | "shared"; pool: number; people: number } | null;
}

const EXCLUSIVE = new Set(["who", "compete", "bets", "season"]);
const ROW_ICON: Record<string, string> = { who: "teams", compete: "trophy", bets: "bank", play: "fantasy", scoring: "seasonpred", twists: "twist", season: "halves", details: "keeper", questions: "sheet" };

export function GallerySheet({ open, onOpenChange, o, loading, error, couchId }: { open: boolean; onOpenChange: (o: boolean) => void; o: WizardOptions | undefined; loading: boolean; error: Error | null; couchId: string | null }) {
  const gm = useGalleryModule();
  const { data: home } = useHome();
  const input = useMemo(() => (gm && o ? inputOf(o, home, couchId, gm) : null), [gm, o, home, couchId]);
  if (!couchId || error || !o || !gm || !input || loading) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange} title="Start a game" subtitle={o ? `${o.label} · ${o.couch.name}` : undefined}>
        <div data-gallery={error ? "error" : "loading"} className="pb-2">
          {error ? <p className="text-[15px] text-muted-foreground">{error.message}</p> : !couchId ? <p className="text-[15px] text-muted-foreground">Games are played on a couch.</p> : <div aria-busy className="h-72 animate-pulse rounded-[4px] bg-secondary" />}
        </div>
      </Sheet>
    );
  }
  return <Gallery key={o.seasonId} open={open} onOpenChange={onOpenChange} gm={gm} input={input} />;
}

function Gallery({ open, onOpenChange, gm, input }: { open: boolean; onOpenChange: (o: boolean) => void; gm: GM; input: Input }) {
  const [levels, setLevels] = useState<Level[]>([{ k: "gallery" }]);
  const level = levels[levels.length - 1];
  const push = (l: Level) => setLevels((ls) => [...ls, l]);
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
  const pg = input.pg;

  const verdicts = useMemo(() => new Map(gm.galleryFor(pg, { from: input.from, to: null }).map((v) => [v.id, v])), [gm, pg, input.from]);
  const community = useMemo(() => communityOf(input, gm.BASES, gm), [gm, input]);
  const ready = useMemo(() => readyOf(community, input, gm), [community, input, gm]);

  /** A base opened: its game on its default length (the season for a season game, the next episode for a one-night one). */
  const openBase = (b: Base, spec?: Spec, span?: Span, from: Game["from"] = "base", name?: string) => {
    const sp: Span = span ?? (b.len === "1 episode" ? { from: input.from, to: input.from } : { from: input.from, to: null });
    const s = spec ?? gm.baseSpec(b, sp, pg);
    if (!s) return;
    const fitted = (s as unknown as { __fitted?: Game["fitted"] }).__fitted ?? null;
    setGame({ base: b, spec: withSpan(s, sp), span: sp, pace: null, before: {}, asked: false, from, name: name ?? b.name, moment: null, fitted });
    push({ k: "base" });
  };
  /** A change to the game, its row marked (and its Undo kept: the spec before the row's first change). */
  const change = (row: string, next: Spec) => {
    if (!game) return;
    setGame({ ...game, spec: next, before: row in game.before ? game.before : { ...game.before, [row]: game.spec } });
  };
  // Your saved games: the heart beside Start saves a game as you've set it, and takes it off again.
  const saved = useSaved();
  const savedList = useMemo(() => savedRows(saved, input, gm), [saved, input, gm]);
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
  let title: ReactNode = "Start a game";
  let subtitle: ReactNode = `${input.label} · for ${input.couch.name}`;
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
        saved={savedList}
        savedKeys={savedKeys}
        onSaved={openSaved}
        communityOpen={communityOpen}
        setCommunityOpen={setCommunityOpen}
        onBase={(b) => {
          const v = verdicts.get(b.id);
          if (v && v.state !== "plays") return toast.quiet(`${b.name}: ${v.why ?? "Coming"}`);
          openBase(b);
        }}
        onReady={(c) => {
          if (!c.base) return;
          openBase(c.base, c.spec, c.spec.span as Span, "community", c.name);
          push({ k: "done" });
        }}
        onCommunity={(i) => push(i < 0 ? { k: "community" } : { k: "cgame", i })}
        onDescribe={() => push({ k: "describe" })}
        onSurprise={() => {
          const plays = gm.BASES.filter((b) => verdicts.get(b.id)?.state === "plays");
          const b = plays[Math.floor(Math.random() * plays.length)];
          if (b) openBase(b);
        }}
        scroller={scroller}
      />
    );
  } else if (game && level.k === "base") {
    title = game.name;
    subtitle = game.from === "community" ? `Made by us for ${input.label}` : game.from === "saved" ? `Your saved game · ${input.label}` : input.label;
    backTo = { label: "All games", onClick: back };
    const v = gm.check(game.spec, pg);
    const lock = lockOf(game.spec, game.span, input, game.pace);
    const first = input.listed.find((e) => typeof game.span.from === "number" && e.number === game.span.from);
    const firstLock = first ? lockWords(first.airAt) : null;
    const firstKind = gm.kindOf(Array.isArray(game.spec.stages) ? game.spec.stages[0].game : game.spec);
    const verb = firstKind === "draft" ? "picks" : firstKind === "pick" ? "pick" : firstKind === "card" ? "card" : "guesses";
    const line = `${stretchLine(game.span, input)}${firstLock ? ` · ${verb} by ${firstLock}` : ""}`;
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
        onLock={() => push({ k: "lock" })}
        onPreview={() => push({ k: "preview" })}
        onRules={() => push({ k: "rules" })}
        community={community.filter((c) => c.base?.id === game.base.id)}
        savedKeys={savedKeys}
        onCommunity={(i) => push({ k: "cgame", i })}
      />
    );
    foot = (
      <StartBar
        line={line}
        label={`Start ${game.name}`}
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
    title = row === "play" ? playName : gm.ROWS.find((r) => r.id === row)?.name ?? row;
    subtitle = game.name;
    backTo = { label: game.name, onClick: back };
    body = <ChangeBody row={row} states={states} exclusive={EXCLUSIVE.has(row)} focus={level.focus} gm={gm} game={game} pg={pg} onSpec={(s) => change(row, s)} onFocus={(id) => setLevels((ls) => [...ls.slice(0, -1), { k: "change", row, focus: id }])} onSheet={(sheet) => sheet === "question" && push({ k: "questions" })} onSay={setSaid} />;
    foot = (
      <button type="button" data-gallery-done onClick={back} className="nd-press flex h-[52px] w-full items-center justify-center rounded-[3px] text-[16px] font-bold outline-1 -outline-offset-1 outline-input">
        Done
      </button>
    );
  } else if (game && level.k === "questions") {
    title = "The questions";
    subtitle = game.name;
    backTo = { label: game.name, onClick: back };
    body = <QuestionsBody gm={gm} game={game} input={input} onSpec={(s) => change("play", s)} />;
    foot = (
      <button type="button" data-gallery-done onClick={back} className="nd-press flex h-[52px] w-full items-center justify-center rounded-[3px] text-[16px] font-bold outline-1 -outline-offset-1 outline-input">
        Done
      </button>
    );
  } else if (game && level.k === "lock") {
    title = "When moves lock";
    subtitle = game.name;
    backTo = { label: game.name, onClick: back };
    body = <LockBody input={input} game={game} onPace={(p) => setGame({ ...game, pace: p })} />;
    foot = (
      <button type="button" data-gallery-done onClick={back} className="nd-press flex h-[52px] w-full items-center justify-center rounded-[3px] text-[16px] font-bold outline-1 -outline-offset-1 outline-input">
        Done
      </button>
    );
  } else if (game && level.k === "preview") {
    title = "How it plays";
    subtitle = `${game.name} · on the real screens`;
    backTo = { label: game.name, onClick: back };
    body = <PreviewBody gm={gm} input={input} game={game} />;
  } else if (game && level.k === "ask") {
    title = "Ask the couch first";
    subtitle = input.couch.name;
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
    backTo = { label: "All games", onClick: back };
    body = <CommunityList input={input} community={community} saved={savedList} savedKeys={savedKeys} onGame={(i) => push({ k: "cgame", i })} onSaved={openSaved} />;
  } else if (level.k === "cgame") {
    const c = community[level.i];
    title = c?.name ?? "A community game";
    subtitle = "Made by us";
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
    foot = c?.base ? (
      <div className="flex gap-2">
        <SaveHeart on={savedKeys.has(keyOf(c.base.id, c.spec))} onToggle={() => c.base && toggleSave({ base: c.base, spec: c.spec, span: c.spec.span as Span, name: c.name, from: "community" })} />
        <button
          type="button"
          data-gallery-copy
          onClick={() => {
            if (!c.base) return;
            openBase(c.base, c.spec, c.spec.span as Span, "community", c.name);
            push({ k: "done" });
          }}
          className="nd-press type-caption flex h-[52px] min-w-0 flex-1 items-center justify-center rounded-[3px] bg-chyron text-[20px] text-chyron-foreground"
        >
          Start your own copy
        </button>
      </div>
    ) : null;
  } else if (game && level.k === "rules") {
    title = "Every rule";
    subtitle = game.name;
    backTo = { label: game.name, onClick: back };
    const v = gm.check(game.spec, pg);
    body = (
      <div data-gallery-rules className="flex flex-col gap-3 pb-2 text-[15px] leading-snug">
        {v.sentence && <p>{v.sentence}</p>}
        {(v.rules ?? []).map((r, i) => (
          <p key={i} className="border-t border-border pt-3 text-muted-foreground">
            {r}
          </p>
        ))}
      </div>
    );
  } else if (game && level.k === "done") {
    title = "Ready to start";
    subtitle = game.name;
    backTo = { label: game.name, onClick: back };
    body = <DoneBody gm={gm} input={input} game={game} />;
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
  const cats = gm.CATS.filter((c) => c.id !== "community")
    .map((c) => ({ ...c, says: say(c.says, input.nouns, true), bases: gm.BASES.filter((b) => (b.cat === c.id || b.also === c.id) && shown(b)) }))
    .filter((c) => c.bases.length);
  const found = q.trim() ? searchBases(q, gm.BASES.filter(shown)) : [];
  const sentence = isSentence(q);
  const both = p.community.length + p.saved.length;
  const [active, setActive] = useState(both ? "community" : cats[0]?.id ?? "");
  // The chips follow the scroll: the category whose heading last passed the chips' row is lit.
  useEffect(() => {
    const root = p.scroller.current?.closest(".overflow-y-auto") as HTMLElement | null;
    if (!root) return;
    const heads = [...root.querySelectorAll<HTMLElement>("[data-gallery-cat], [data-gallery-ready]")];
    const onScroll = () => {
      const top = root.getBoundingClientRect().top + 72;
      let id = heads[0]?.dataset.galleryCat ?? "community";
      for (const h of heads) if (h.getBoundingClientRect().top <= top) id = h.dataset.galleryCat ?? "community";
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
  const section = gm.CATS.find((c) => c.id === "community");
  const sectionLine = [p.saved.length ? `${p.saved.length} saved` : null, p.community.length ? `${p.community.length} made for ${input.label}` : null].filter(Boolean).join(" · ");
  return (
    <div className="flex flex-col">
      <Finder value={q} onChange={p.setQ} />
      {q.trim() ? (
        <div data-gallery-results className="mt-3">
          {found.length ? (
            <div className="grid grid-cols-2 gap-3">
              {found.map(({ base }) => (
                <BaseSquare key={base.id} base={{ ...base, name: say(base.name, input.nouns, true) }} state={verdicts.get(base.id)!.state} why={verdicts.get(base.id)!.why} line={fitWords(say(base.plain, input.nouns, true), verdicts.get(base.id)!.fitted)} onOpen={() => p.onBase(base)} />
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
                  <span className="tag-cut type-caption grid flex-none place-items-center bg-quiet-tag pl-2.5 pr-5 text-[14px] tracking-[0.04em] text-quiet-tag-foreground">
                    {input.ep === "episode" ? "Ep" : input.ep[0].toUpperCase() + input.ep.slice(1)} {input.from}
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
            {(others.length > 0 || p.saved.length > 0) && (
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
            {[...(both ? [{ id: "community", short: section?.short ?? "Community & saved", n: both }] : []), ...cats.map((c) => ({ id: c.id, short: c.short, n: c.bases.length }))].map((c) => (
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
                {c.bases.map((b) => (
                  <BaseSquare key={`${c.id}-${b.id}`} base={{ ...b, name: say(b.name, input.nouns, true) }} state={verdicts.get(b.id)!.state} why={verdicts.get(b.id)!.why} line={fitWords(say(b.plain, input.nouns, true), verdicts.get(b.id)!.fitted)} onOpen={() => p.onBase(b)} />
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
  return <span className={`type-caption flex-none rounded-[2px] px-1.5 py-[2px] text-[11px] tracking-[0.05em] ${/^season$/i.test(text) ? "text-muted-foreground" : "bg-foreground text-background"}`}>{text}</span>;
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
          {c.base?.name ?? "A game"} · Made by us · <Heart className="inline size-3 -translate-y-px" fill={saved ? "currentColor" : "none"} aria-label={saved ? "saved by you and" : "saved by"} /> {c.saves + (saved ? 1 : 0)}
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
  onLock: () => void;
  onPreview: () => void;
  onRules: () => void;
  community: Community[];
  savedKeys: Set<string>;
  onCommunity: (i: number) => void;
}) {
  const { gm, input, game, lock } = p;
  const pg = input.pg;
  const [more, setMore] = useState(Object.keys(game.before).some((r) => !["who", "compete", "bets"].includes(r)));
  const lengths = useMemo(() => lengthsOf(game.spec, input, gm), [game.spec, input, gm]);
  const lid = lengthId(game.span, input);
  const strip = stripOf(input, game.span);
  // The words take the game's own draft size (fitted, changed or saved), and the fitted note shows only while it's still the size.
  const size = sizeFit(gm, game.base, game.spec);
  const sentences = fitWords(say(game.base.about, input.nouns), size).split(/(?<=\.)\s+/).filter(Boolean);
  const fitNote = game.fitted && size && game.fitted.to === size.to ? game.fitted : null;
  const kind = gm.kindOf(game.spec);
  const play = gm.playRow(game.spec);
  const later = input.stages.find((s, i) => i > 0 && !(s.at != null && s.at <= input.from));
  const rowLine = (row: string) => (gm.rowLine(row, game.spec, pg) ?? "").replace(/ · The show's points|The show's points · /, "").replace(/(?<!One game)^One game · /, "").replace("A new draft at a stage", later ? `A new draft at ${later.start}` : "A new draft at a stage");
  const words = PACE_WORDS[lock.value];
  const drafts = kind === "draft";
  const ownTeams = drafts && (game.spec.get as { own?: string } | undefined)?.own !== "shared";
  // Popular changes: what the tracker's games use most with a game of this kind (roll.js weightsFrom, read by hand for Round 2).
  const POPULAR: Record<string, [string, string][]> = {
    draft: [["captain", "scoring"], ["matchups", "compete"], ["redraft", "season"], ["side", "bets"]],
    pick: [["standing", "compete"], ["second", "play"], ["matchups", "compete"]],
    questions: [["bank", "bets"], ["pot", "bets"], ["beatbot", "twists"], ["majority", "twists"]],
    card: [["alongside", "season"], ["weeks", "compete"]],
  };
  const popular = (POPULAR[kind] ?? []).map(([id, row]) => ({ row, st: gm.changeStates(game.spec, row, pg).find((c) => c.id === id) })).filter((x) => x.st && !x.st.why).slice(0, 3);
  const setLength = (id: string) => {
    const l = lengths.find((x) => x.id === id);
    if (!l) return;
    p.setGame({ ...game, span: l.span, spec: withSpan(game.spec, l.span) });
  };
  const headRows = ["who", "compete", "bets"];
  const moreRows = ["play", "scoring", "twists", "season", "details"].filter((r) => !(r === "play" && play.headline));
  const rowName = (r: string) => (r === "play" ? play.name : gm.ROWS.find((x) => x.id === r)?.name ?? r);
  return (
    <div className="flex flex-col">
      <p data-gallery-about className="text-[16px] leading-snug">{sentences[0]}</p>
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

      <div data-gallery-length className="mt-5">
        <Label>How long</Label>
        <Strip cells={strip.cells} stages={strip.stages} />
        <div className="mt-3">
          <ChipRow data="gallery-length-chip" items={lengths} value={lid} onPick={setLength} />
        </div>
      </div>

      <div data-gallery-lock={lock.value} className="mt-5 border-t border-border pt-3">
        <Label
          aside={
            input.ownPace ? null : (
              <button type="button" data-gallery-lock-change onClick={p.onLock} className="-my-3 -mr-2 min-h-11 px-2 text-[15px] font-semibold underline decoration-1 underline-offset-[3px]">
                Change
              </button>
            )
          }
        >
          When moves lock
        </Label>
        {input.ownPace ? (
          <p className="text-[15px] leading-snug">
            <b>At your own pace.</b> <span className="text-muted-foreground">Every {input.ep} is out: each of you plays one at a time, whenever you watch it.{ownTeams ? " It syncs at the draft." : ""}</span>
          </p>
        ) : (
          <p className="text-[15px] leading-snug">
            <b>{words.title}.</b> <span className="text-muted-foreground">{words.line(input.ep, drafts, ownTeams)}</span>
          </p>
        )}
        {game.pace && !lock.costs && game.pace !== lock.recommended && (
          <p data-gallery-lock-changed className="mt-1 flex items-center gap-2 text-[13px] text-muted-foreground">
            <em className="type-caption rounded-[2px] bg-quiet-tag px-1.5 text-[11px] not-italic tracking-[0.05em] text-quiet-tag-foreground">Changed</em>
            Nobody on the couch is cut off now.
            <button type="button" data-gallery-lock-undo onClick={() => p.setGame({ ...game, pace: null })} className="min-h-11 font-semibold text-foreground underline decoration-1 underline-offset-[3px]">
              Undo
            </button>
          </p>
        )}
        {lock.costs && (
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
      </div>

      {sentences.length > 1 && <p className="mt-5 text-[14px] leading-snug text-muted-foreground">{sentences.slice(1).join(" ")}</p>}

      {popular.length > 0 && (
        <div data-gallery-popular className="mt-5">
          <Label>Popular changes</Label>
          <div className="grid grid-cols-3 gap-2">
            {popular.map(({ row, st }) => (
              <button key={st!.id} type="button" data-gallery-popular-change={st!.id} aria-pressed={st!.on} onClick={() => p.onPopular(st!.id, row)} className={`nd-press flex min-h-[86px] flex-col justify-between rounded-[4px] p-2.5 text-left ${st!.on ? "bg-foreground text-background" : "bg-secondary"}`}>
                <Pictogram id={st!.icon} className="size-7" />
                <b className="text-[13px] font-semibold leading-tight">{st!.name}</b>
              </button>
            ))}
          </div>
        </div>
      )}

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
      <div data-gallery-rows className="mt-5">
        {play.headline && <RowLink data="play" icon={kind === "questions" ? "sheet" : kind === "stages" ? "redraft" : ROW_ICON.play} title={play.name} line={kind === "stages" ? (game.spec.stages ?? []).map((st) => st.name).join(" · ") : questionsLine(game.spec)} changed={"play" in game.before} onClick={() => p.onRow(kind === "questions" ? "questions" : kind === "stages" ? "season" : "play")} onUndo={() => p.onUndo("play")} />}
        {headRows.map((r) => (
          <RowLink key={r} data={r} icon={ROW_ICON[r]} title={rowName(r)} line={rowLine(r) || defaultLine(r)} changed={r in game.before} onClick={() => p.onRow(r)} onUndo={() => p.onUndo(r)} />
        ))}
      </div>
      <button type="button" data-gallery-more aria-expanded={more} onClick={() => setMore(!more)} className="mt-1 flex min-h-[60px] w-full items-center gap-3 border-t border-border py-2 text-left">
        <span className="min-w-0 flex-1">
          <b className="block text-[15px] font-semibold">More changes</b>
          <small className="block truncate text-[13px] text-muted-foreground">{moreRows.map(rowName).join(", ")}</small>
        </span>
        <ChevronDown className={`size-5 flex-none text-muted-foreground transition-transform ${more ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {more && (
        <div data-gallery-more-rows>
          {moreRows.map((r) => (
            <RowLink key={r} data={r} icon={ROW_ICON[r]} title={rowName(r)} line={rowLine(r) || defaultLine(r)} changed={r in game.before} onClick={() => p.onRow(r)} onUndo={() => p.onUndo(r)} />
          ))}
        </div>
      )}

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

// TEMP (Round 2): a season's suggested moments are planned (E5: rated at its setup, so one tap adds one); until then, these stand
// in, added to the page here so our check can place them, and said as "added when you start".
const SUGGESTED: { id: string; label: string }[] = [
  { id: "cried", label: "Cries" },
  { id: "blindsided", label: "Gets blindsided" },
  { id: "confessional", label: "Talks to the camera most" },
];

/** The moment a base leaves open (Who does it most?, the one-moment draft): the season's own moments, then suggested ones. */
function MomentRow({ input, game, setGame, gm }: { input: Input; game: Game; setGame: (g: Game) => void; gm: GM }) {
  const [open, setOpen] = useState(false);
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
    setOpen(false);
  };
  return (
    <div data-gallery-moment className="mt-4 rounded-[4px] bg-secondary p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="type-caption block text-[13px] tracking-[0.04em] text-muted-foreground">The moment</span>
          <b className="block text-[16px] font-semibold">{current?.label ?? "Pick one"}</b>
          {current && !current.own && <small className="block text-[13px] text-muted-foreground">Added when you start: our AI checks that recaps report it, then it&rsquo;s asked each {input.ep}</small>}
        </span>
        <button type="button" data-gallery-moment-change onClick={() => setOpen(!open)} className="min-h-11 flex-none px-2 text-[14px] font-semibold underline decoration-1 underline-offset-[3px]">
          {open ? "Done" : "Change"}
        </button>
      </div>
      {open && (
        <div className="mt-3 flex flex-wrap gap-2">
          {all.map((m) => (
            <button key={m.id} type="button" data-gallery-moment-pick={m.id} aria-pressed={m.id === current?.id} onClick={() => pick(m.id, m.own)} className={`inline-flex min-h-9 items-center rounded-[2px] px-3 text-left text-[13px] font-semibold ${m.id === current?.id ? "bg-foreground text-background" : m.own ? "bg-background" : "border border-dashed border-edge"}`}>
              {m.label}
              {!m.own && <span className="ml-1.5 text-[11px] font-normal opacity-75">suggested</span>}
            </button>
          ))}
        </div>
      )}
    </div>
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
  return <div className="grid grid-cols-2 gap-3 [grid-auto-flow:dense]">{cells}</div>;
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
        <div data-gallery-question-kinds className="mt-3 grid grid-cols-2 gap-2">
          {kinds.map((k) => (
            <button key={k.id} type="button" data-gallery-question-kind={k.id} onClick={() => add(k.id)} className="nd-press min-h-[52px] rounded-[4px] bg-secondary px-3 py-2 text-left text-[14px] font-semibold leading-tight">
              {k.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- when moves lock, opened ----------

function LockBody({ input, game, onPace }: { input: Input; game: Game; onPace: (p: Pace) => void }) {
  const lock = lockOf(game.spec, game.span, input, game.pace);
  const drafts = game.spec.get?.by === "draft";
  const ownTeams = drafts && game.spec.get?.own !== "shared";
  const late = lock.behind;
  const names = (xs: { name: string }[]) => xs.map((x) => x.name).join(" and ");
  const means = (m: Pace) => {
    if (!late.length) return null;
    if (m === "own") return `${names(late)} play${late.length === 1 ? "s" : ""} each ${input.ep} when they reach it; nobody sees its results before they've watched.`;
    if (m === "live") {
      const far = late.filter((x) => x.behind >= 2);
      return far.length ? costWords("live", far[0], input) : "Fine a day late: everyone's within one.";
    }
    return costWords("strict", late[0], input);
  };
  return (
    <div className="flex flex-col">
      <Label>Where the couch is</Label>
      <div data-gallery-marks className="mb-5 flex flex-col gap-1.5">
        {input.marks.length ? (
          input.marks.map((m) => (
            <div key={m.userId} className="flex items-center justify-between text-[15px]">
              <span className="font-semibold">{m.you ? "You" : m.name}</span>
              <span className="text-muted-foreground">{m.seen >= input.aired ? "Caught up" : `Up to ${input.ep} ${m.seen} · ${input.aired - m.seen} behind`}</span>
            </div>
          ))
        ) : (
          <p className="text-[14px] text-muted-foreground">Nobody on the couch shares where they are yet.</p>
        )}
      </div>
      <div role="radiogroup" aria-label="When moves lock">
        {(["own", "live", "strict"] as Pace[]).filter((m) => lock.choices.includes(m)).map((m) => {
          const off = m === "own" && lock.phased;
          const on = lock.value === m;
          return (
            <button key={m} type="button" role="radio" aria-checked={on} disabled={off} data-gallery-pace={m} onClick={() => onPace(m)} className={`flex min-h-[64px] w-full items-start gap-3 border-t border-border py-3 text-left first:border-t-0 ${off ? "opacity-55" : ""}`}>
              <i className={`mt-0.5 grid size-5 flex-none place-items-center rounded-full border-2 ${on ? "border-foreground" : "border-edge"}`} aria-hidden>
                {on && <i className="size-2.5 rounded-full bg-foreground" />}
              </i>
              <span className="min-w-0 flex-1">
                <b className="block text-[16px] font-semibold">
                  {PACE_WORDS[m].title}
                  {m === lock.recommended && !off && <em className="type-caption ml-2 rounded-[2px] bg-secondary px-1.5 text-[11px] not-italic">Recommended</em>}
                </b>
                <small className="mt-[3px] block text-[13px] leading-snug text-muted-foreground">{off ? "A game that starts at a stage can't wait for people yet." : PACE_WORDS[m].line(input.ep, drafts, ownTeams)}</small>
                {!off && means(m) && <small className="mt-1 block text-[13px] leading-snug">{means(m)}</small>}
              </span>
            </button>
          );
        })}
      </div>
      {ownTeams && <p className="mt-3 text-[13px] leading-snug text-muted-foreground">At your own pace everyone drafts together, and waivers (when they&rsquo;re on) wait for everyone. Nobody is held back: it&rsquo;s only where you all line up.</p>}
      <p className="mt-3 text-[13px] leading-snug text-muted-foreground">The same for everyone in the game. Late is on the honour system: only if you haven&rsquo;t watched it yet.</p>
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
        <ChipRow data="gallery-sort" items={[{ id: "made", label: `Made for ${input.label}`, ok: true }, { id: "saved", label: "Most saved", ok: true }, { id: "short", label: "Shortest", ok: true }]} value={sort} onPick={setSort} />
        <div className="mt-3">
          {order(community).map((c) => (
            <CommunityRow key={c.i} c={c} saved={!!c.base && savedKeys.has(keyOf(c.base.id, c.spec))} onOpen={() => onGame(c.i)} />
          ))}
        </div>
      </div>
      <p className="mt-3 text-[13px] leading-snug text-muted-foreground">Couches share a game once it&rsquo;s started: the rules only, never who played or how they did. The hearts count saves, made up until couches share.</p>
    </div>
  );
}

function CommunityGame({ gm, input, c, saved, onChange, onTry }: { gm: GM; input: Input; c: Community; saved: boolean; onChange: () => void; onTry: () => void }) {
  const v = gm.check(c.spec, input.pg);
  const strip = stripOf(input, c.spec.span as Span);
  return (
    <div data-gallery-cgame={c.i} className="flex flex-col">
      <p className="flex items-center gap-2 text-[14px] text-muted-foreground">
        <Pictogram id={c.base?.id ?? "sheet"} className="size-6 text-foreground" /> {c.base?.name ?? "A game"} · {c.badge} ·{" "}
        <Heart className="size-3.5" fill={saved ? "currentColor" : "none"} aria-label={saved ? "saved by you and" : "saved by"} /> {c.saves + (saved ? 1 : 0)}
      </p>
      <p className="mt-2 text-[16px] leading-snug">{v.sentence ?? c.base?.about}</p>
      <blockquote className="mt-3 border-l-2 border-edge pl-3 text-[14px] italic leading-snug text-muted-foreground">&ldquo;{c.hook}&rdquo; · Made by us</blockquote>
      <p className="mt-1 text-[13px] text-muted-foreground">The maker&rsquo;s words; the rules above are what plays.</p>
      <div className="mt-5">
        <Label>How long</Label>
        <Strip cells={strip.cells} stages={strip.stages} />
      </div>
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

function DoneBody({ gm, input, game }: { gm: GM; input: Input; game: Game }) {
  const v = gm.check(game.spec, input.pg);
  const lock = lockOf(game.spec, game.span, input, game.pace);
  return (
    <div data-gallery-would-start className="flex flex-col gap-3">
      <div className="rounded-[4px] bg-secondary p-3">
        <b className="type-caption block text-[22px]">{v.short?.title ?? game.name}</b>
        <p className="mt-1 text-[14px]">{v.short?.line}</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {stretchLine(game.span, input)} · {PACE_WORDS[lock.value].title}
        </p>
      </div>
      <p className="text-[15px] leading-snug">{v.sentence}</p>
      <p className="rounded-[3px] border border-dashed border-edge px-3 py-2 text-[13px] leading-snug text-muted-foreground">Round 2&rsquo;s gallery saves nothing: this is the game our check passed, and what Start would make. {v.ok ? "It plays." : `It doesn't play yet: ${v.problems[0] ?? v.waits[0]}`}</p>
      <details className="text-[12px] text-muted-foreground">
        <summary className="cursor-pointer text-[13px] font-semibold">The spec</summary>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-[3px] bg-background p-2 font-mono">{JSON.stringify(game.spec, null, 1)}</pre>
      </details>
    </div>
  );
}
