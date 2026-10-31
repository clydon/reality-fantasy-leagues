"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeftRight, CalendarClock, Check, ChevronRight, Eye, Lock, Plus, Trophy } from "lucide-react";
import { airTime, calm, ticks } from "../clock";
import { moves as write, useAfterSave, type GameView, type Move } from "../data";
import { NavLink, useNav } from "../nav";
import { paths, type ShowTab } from "../routes";
import type { ShowData } from "../screens/show-space";
import { useNow } from "../ui/bars";
import { useFinalLine } from "../final-words";
import { Btn, Chip } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { SwipePager, type PagerHandle } from "../ui/swipe-pager";
import { toast } from "../ui/toast";
import { ordinal } from "../games";
import { closeMoves, dockWords, faceIn, first, moveCard, openMoves, sheetTabs, tabOf, useMovesSheet, type MovesTab, type SheetTab } from "./moves";
import { openCall } from "./calls";
import { openSheet } from "./questions";
import { rateLabel } from "./rate";
import { Face, IconBox } from "./parts";
import { useOpenMorning, useOpenReveal } from "./reveal";
import { askAfterSave } from "./remind";

// The moves dock (the mock's dock.js, option D): above the tab bar on Episodes and Cast while a move of yours is due here (the
// one yellow: Set), then locked once it's on (scores stay hidden). Since 2026-10-31 (the user) it isn't there when you're all
// set (Tonight says so, with Change), nor on Games, where each game's card says your move (games.tsx, your-move.ts). Its faces
// are your starters and your pick; its state and words come from your moves due here and the schedule. It opens "Your moves", one sheet with a tab per game you play here (Weekly Lineup, Survival
// Pool, Outlast's team) and Predictions, which saves through the league routes the classic app uses (lineups,
// picks, predictions). The games swipe by as a Weekly Lineup player's weeks do (ui/swipe-pager.tsx; the user, 2026-10-31),
// the tabs' highlight sliding along with the finger. Saving never locks; airtime does. After an episode it follows the results (stages.js):
// results in (Reveal), just aired and waiting, then the morning update's final scores.

/** Whether the dock shows on this tab: not on Chat; once it's on, everywhere else; on Tonight only then (Tonight has its own
 *  cards); results to reveal or on their way, everywhere else; your moves, only while one's due and not on Games (each game's
 *  card says it there). */
export function dockShows(show: ShowData, tab: ShowTab) {
  if (!show.upNext || !show.games.some((g) => g.yourRole) || tab === "chat") return false;
  if (show.upNext.live) return true;
  if (tab === "tonight") return false;
  const eps = show.episodes;
  if (eps?.reveal || eps?.waiting || eps?.final) return true;
  return tab !== "games" && show.moves.length > 0;
}

/** Your starters (the first Weekly Lineup here) and your pick (the first Survival Pool), as overlapping faces. */
function DockFaces({ play, locked }: { play: GameView[] | null; locked?: boolean }) {
  const lineup = play?.find((g) => g.lineup && !g.revealFirst);
  const pool = play?.find((g) => g.pick?.pick && !g.revealFirst);
  const starters = lineup ? lineup.lineup!.starters.map((id) => faceIn(lineup, id)).filter((c) => !!c) : [];
  const pick = pool ? faceIn(pool, pool.pick!.pick!) : undefined;
  if (!starters.length && !pick) return null;
  const ring = locked ? "shadow-[0_0_0_2px_var(--secondary)] saturate-[.6]" : "shadow-[0_0_0_2px_var(--plate)]";
  return (
    <span className="flex flex-none pl-1" aria-label={[...starters.map((c) => first(c.name)), pick && `pick ${first(pick.name)}`].filter(Boolean).join(", ")}>
      {starters.map((c, i) => (
        <Face key={c.id} src={c.photo} name={c.name} className={`size-[34px] rounded-[3px] text-sm ${ring} ${i ? "-ml-2" : ""}`} />
      ))}
      {pick && <Face src={pick.photo} name={pick.name} className={`size-[34px] rounded-full text-sm ${ring} ${starters.length ? "ml-1" : ""}`} />}
    </span>
  );
}

export function Dock({ show }: { show: ShowData }) {
  const up = show.upNext!;
  const airs = up.airAt ? Date.parse(up.airAt) : null;
  // The soonest deadline of what's due (a waiver pick is due before airtime), else airtime.
  const dues = show.moves.map((m) => (m.deadline ? Date.parse(m.deadline) : null)).filter((d): d is number => d != null);
  const t = dues.length ? Math.min(...dues) : airs;
  const now = useNow(t != null && ticks(t));
  const finalWords = useFinalLine(show.episodes?.reveal?.stage, show.episodes?.reveal?.finalAt);
  const openReveal = useOpenReveal();
  const openMorning = useOpenMorning();
  const nav = useNav();
  const when = t != null ? `${airTime(t)} · ${calm(t, now)}` : null;
  // A move due first that Tonight's card takes to its own page (your draft turn or blind picks, a waiver pick) goes there
  // too, rather than Your moves.
  const lead = show.moves[0];
  const leadHref = lead ? (moveCard(lead, show.header?.seasonId ?? "", false).href ?? null) : null;
  const drafting = lead?.kind === "draftTurn" || lead?.kind === "blindDraft";
  const base = "nd-dock nd-fixed-x fixed bottom-[calc(76px+env(safe-area-inset-bottom,0px))] z-[28] mx-2.5 flex items-center gap-2.5 overflow-hidden rounded-[4px] py-[7px] pl-[9px] pr-[7px] text-left shadow-[0_12px_28px_rgba(0,0,0,.5)]";

  if (up.live) {
    return (
      <div className={`${base} bg-secondary text-foreground`} aria-live="polite">
        <DockFaces play={show.play} locked />
        <span className="min-w-0 flex-1 leading-tight">
          <b className="flex items-center gap-1.5 text-sm">
            <Lock className="size-[15px] flex-none" aria-hidden />
            Locked for Episode {up.number}
          </b>
          <small className="block text-[11.5px] text-muted-foreground">Scores stay hidden until you reveal</small>
        </span>
      </div>
    );
  }
  const eps = show.episodes;
  const plain = `${base} bg-secondary text-foreground`;
  const mark = (icon: ReactNode, cls = "bg-background/60") => <span className={`grid size-[34px] flex-none place-items-center rounded-[3px] ${cls}`}>{icon}</span>;
  if (eps?.reveal) {
    const n = eps.reveal.episode;
    return (
      <button type="button" data-dock="reveal" onClick={() => openReveal(n)} className={`${base} nd-press bg-plate text-plate-foreground`}>
        {mark(<Eye className="size-4" aria-hidden />, "bg-plate-foreground text-chyron")}
        <span className="min-w-0 flex-1 leading-tight">
          <b className="block truncate text-sm">{eps.reveal.stage === "early" ? "Early results are in" : `Episode ${n} final results are in`}</b>
          <small className="block truncate text-[11.5px] text-plate-muted">{eps.reveal.stage === "early" ? (finalWords ?? "Who went home · Pool · Outlast") : "Everything stays hidden until you reveal"}</small>
        </span>
        <span className="grid h-[38px] place-items-center rounded-[3px] bg-chyron px-3.5 text-sm font-extrabold text-chyron-foreground">Reveal</span>
      </button>
    );
  }
  if (eps?.waiting) {
    return (
      <div data-dock="waiting" className={plain}>
        {mark(<CalendarClock className="size-4 text-chyron-line" aria-hidden />)}
        <span className="min-w-0 flex-1 leading-tight">
          <b className="block text-sm">Episode {eps.waiting.episode} just aired</b>
          <small className="block text-[11.5px] text-muted-foreground">Results a little after it ends · nothing spoiled</small>
        </span>
      </div>
    );
  }
  if (eps?.final) {
    const n = eps.final.episode;
    return (
      <button type="button" data-dock="final" onClick={() => openMorning(n)} className={`${base} nd-press bg-plate text-plate-foreground`}>
        {mark(<Trophy className="size-4" aria-hidden />, "bg-plate-foreground text-chyron")}
        <span className="min-w-0 flex-1 leading-tight">
          <b className="block truncate text-sm">Final results are in</b>
          <small className="block text-[11.5px] text-plate-muted">Episode {n} · every point counted</small>
        </span>
        <span className="grid h-[38px] place-items-center rounded-[3px] bg-background px-3.5 text-sm font-extrabold text-foreground">See</span>
      </button>
    );
  }
  // Your moves, while one's due (dockShows keeps it away once you're all set).
  if (!show.moves.length) return null;
  const faces = <DockFaces play={show.play} />;
  return (
    <button
      type="button"
      data-dock="moves"
      onClick={() =>
        leadHref
          ? nav.push(leadHref)
          : show.moves[0]?.kind === "calls" && show.header
            ? // Weekly Calls' calls are Call it's sheet (step 12 part 2).
              openCall({ seasonId: show.header.seasonId, couchId: show.couch?.id ?? null, episode: show.moves[0].episode ?? up.number, label: rateLabel(show), solo: show.solo })
            : show.moves[0]?.kind === "questions" && show.header
              ? // A Prediction Sheet's questions are its own sheet (step A4 part 2).
                openSheet({ seasonId: show.header.seasonId, leagueId: show.moves[0].leagueId, episode: null, game: show.moves[0].leagueName })
              : openMoves(tabOf(show.moves[0]), show.moves[0]?.leagueId ?? null)
      }
      className={`${base} nd-press bg-plate text-plate-foreground`}
    >
      {show.play?.some((g) => (g.lineup?.starters.length || g.pick?.pick) && !g.revealFirst) ? (
        faces
      ) : (
        <span className="grid size-[34px] flex-none place-items-center rounded-[3px] text-plate-muted outline-2 -outline-offset-2 outline-dashed outline-plate-muted/60" aria-hidden>
          <Plus className="size-4" />
        </span>
      )}
      <span className="min-w-0 flex-1 leading-tight">
        <b className="block truncate text-sm">{dockWords(show.moves)}</b>
        {when && (
          <small className="block text-[11.5px] tabular-nums text-plate-muted">
            {t !== airs ? "Due" : "Locks"} {when}
          </small>
        )}
      </span>
      <span className="grid h-[38px] place-items-center rounded-[3px] bg-chyron px-3.5 text-sm font-extrabold text-chyron-foreground">{drafting ? "Draft" : "Set"}</span>
    </button>
  );
}

// ---------- the "Your moves" sheet ----------

export function MovesSheet({ show, seasonId }: { show: ShowData; seasonId: string }) {
  const { open, tab, leagueId } = useMovesSheet();
  const up = show.upNext;
  const until = up?.airAt ? airTime(Date.parse(up.airAt)) : null;
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && closeMoves()}
      title="Your moves"
      subtitle={up ? `Episode ${up.number}${until ? ` · change anything until ${until}` : ""}` : undefined}
    >
      {show.play ? (
        // A fresh body each time it opens, at the tab it was opened for, from what's saved.
        <MovesBody key={`${open}-${tab}-${leagueId}`} show={show} play={show.play} initial={tab} initialLeague={leagueId} seasonId={seasonId} until={until} />
      ) : (
        <div aria-busy className="mt-3 h-72 animate-pulse rounded-[4px] bg-background" />
      )}
    </Sheet>
  );
}

/** Whether a game's lineup can be set right now (not behind on results, not locked). */
const lineupOpen = (g: GameView) => !g.revealFirst && !!g.lineup && !g.lineup.locked;
/** Whether a game's pick can be made right now. */
const pickOpen = (g: GameView) => !g.revealFirst && !!g.pick?.open && g.pick.available.length > 0;
const guessKey = (g: GameView, betId: string) => `${g.leagueId}:${betId}`;
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

function MovesBody({
  show,
  play,
  initial,
  initialLeague,
  seasonId,
  until,
}: {
  show: ShowData;
  play: GameView[];
  initial: MovesTab;
  initialLeague: string | null;
  seasonId: string;
  until: string | null;
}) {
  const tabs = sheetTabs(play);
  const [seg, setSeg] = useState(
    () => (tabs.find((t) => t.kind === initial && (!initialLeague || !t.leagueId || t.leagueId === initialLeague)) ?? tabs.find((t) => t.kind === initial) ?? tabs[0])?.key
  );
  const [lineups, setLineups] = useState<Record<string, string[]>>(() => Object.fromEntries(play.filter((g) => g.lineup).map((g) => [g.leagueId, g.lineup!.starters])));
  const [picks, setPicks] = useState<Record<string, string | null>>(() => Object.fromEntries(play.filter((g) => g.pick).map((g) => [g.leagueId, g.pick!.pick])));
  const [guesses, setGuesses] = useState<Record<string, string>>(() =>
    Object.fromEntries(play.flatMap((g) => g.predictions.map((q) => [guessKey(g, q.betId), q.guess?.text ?? ""])))
  );
  const [saving, setSaving] = useState(false);
  const after = useAfterSave();
  const game = (id: string | null) => play.find((g) => g.leagueId === id);
  // Someone of yours to replace in a game: a waiver move (the home's), whose page is pushed over the show.
  const pickup = (leagueId: string) => show.moves.find((m) => m.kind === "pickup" && m.leagueId === leagueId);

  // Whether a tab still has something for you to do (its dot).
  const open = (t: SheetTab): boolean => {
    const g = game(t.leagueId);
    if (g && pickup(g.leagueId)) return true;
    if (t.kind === "lineup") return !!g && lineupOpen(g) && (lineups[g.leagueId]?.length ?? 0) < g.lineup!.need;
    if (t.kind === "pool") return !!g && pickOpen(g) && !picks[g.leagueId];
    if (t.kind === "predict") return play.some((x) => x.predictions.some((q) => !(guesses[guessKey(x, q.betId)] ?? "").trim()));
    return false;
  };

  async function save() {
    const jobs: (() => Promise<void>)[] = [];
    const kinds = new Set<string>();
    for (const g of play) {
      const l = g.lineup;
      if (l && lineupOpen(g) && !sameSet(lineups[g.leagueId] ?? [], l.starters)) {
        kinds.add("lineup");
        jobs.push(() => write.lineup(g.leagueId, l.epId, g.playerId, lineups[g.leagueId]));
      }
      const p = g.pick;
      const chosen = picks[g.leagueId];
      if (p && pickOpen(g) && chosen && chosen !== p.pick) {
        kinds.add("pick");
        jobs.push(() => write.pick(g.leagueId, p.epId, g.playerId, chosen));
      }
      for (const q of g.predictions) {
        const now = (guesses[guessKey(g, q.betId)] ?? "").trim();
        if (now === (q.guess?.text ?? "")) continue;
        kinds.add("prediction");
        // A guess is changed by taking the old one back and making the new one (the classic app has no edit).
        jobs.push(async () => {
          if (q.guess) await write.unguess(g.leagueId, q.epId, q.betId, q.guess.id);
          if (now) await write.guess(g.leagueId, q.epId, q.betId, g.playerId, now);
        });
      }
    }
    if (!jobs.length) return closeMoves();
    setSaving(true);
    try {
      for (const job of jobs) await job();
      await after();
      closeMoves();
      const still = tabs.some((t) => t.kind !== "predict" && t.kind !== "outlast" && open(t));
      toast(still ? "Saved. Something's still open." : until ? `All set. Change anything until ${until}.` : "All set.");
      // The first save is when a reminder makes sense: ask about notifications, once (remind.tsx says when it doesn't).
      askAfterSave([...kinds]);
    } catch (e) {
      await after();
      toast.quiet(`Not saved: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  const index = Math.max(0, tabs.findIndex((t) => t.key === seg));
  const panel = (t: SheetTab) => {
    const g = game(t.leagueId);
    if (t.kind === "lineup" && g)
      return <LineupPanel g={g} starters={lineups[g.leagueId] ?? []} onStarters={(s) => setLineups((x) => ({ ...x, [g.leagueId]: s }))} pickup={pickup(g.leagueId)} seasonId={seasonId} />;
    if (t.kind === "pool" && g) return <PoolPanel g={g} pick={picks[g.leagueId] ?? null} onPick={(id) => setPicks((x) => ({ ...x, [g.leagueId]: id }))} />;
    if (t.kind === "predict") return <PredictPanel play={play} guesses={guesses} onGuess={(k, v) => setGuesses((x) => ({ ...x, [k]: v }))} />;
    if (t.kind === "outlast" && g) return <OutlastPanel g={g} pickup={pickup(g.leagueId)} seasonId={seasonId} />;
    return null;
  };

  // The tabs' highlight follows the games, finger and all: between two tabs it's between their places and their widths.
  const pager = useRef<PagerHandle>(null);
  const bar = useRef<HTMLDivElement>(null);
  const lit = useRef<HTMLSpanElement>(null);
  const light = (at: number, ms = 0, easing = "linear") => {
    const b = bar.current;
    const hl = lit.current;
    const tabEls = Array.from(b?.querySelectorAll<HTMLElement>('[role="tab"]') ?? []);
    if (!b || !hl || !tabEls.length) return;
    const c = Math.max(0, Math.min(tabEls.length - 1, at));
    const i = Math.floor(c);
    const a = tabEls[i];
    const z = tabEls[Math.min(tabEls.length - 1, i + 1)];
    const f = c - i;
    hl.style.transition = ms ? `transform ${ms}ms ${easing}, width ${ms}ms ${easing}` : "none";
    hl.style.transform = `translateX(${a.offsetLeft + (z.offsetLeft - a.offsetLeft) * f}px)`;
    hl.style.width = `${a.offsetWidth + (z.offsetWidth - a.offsetWidth) * f}px`;
    const near = Math.round(c);
    tabEls.forEach((el, k) => (el.dataset.lit = String(k === near)));
  };
  useLayoutEffect(() => {
    light(index);
    // A bar wider than the sheet keeps the game you're on in view.
    const b = bar.current;
    if (b && b.scrollWidth > b.clientWidth) b.querySelectorAll<HTMLElement>('[role="tab"]')[index]?.scrollIntoView({ inline: "nearest", block: "nearest" });
    // (Placed again whenever the game changes.)
  }, [index]);
  // The tabs' widths settle once the fonts are in.
  useEffect(() => {
    const b = bar.current;
    if (!b || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => light(index));
    ro.observe(b);
    return () => ro.disconnect();
    // (Observed again with each game, so it places the one you're on.)
  }, [index]);

  if (!tabs.length) return <p className="mt-3 text-sm text-muted-foreground">Nothing to set here.</p>;
  return (
    <>
      {tabs.length > 1 && (
        <div ref={bar} className="relative mb-3.5 flex gap-[3px] overflow-x-auto rounded-[3px] bg-background p-[3px] [scrollbar-width:none]" role="tablist">
          <span ref={lit} data-tabs-lit aria-hidden className="pointer-events-none absolute left-0 top-[3px] h-9 rounded-[2px] bg-foreground" />
          {tabs.map((t, i) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={seg === t.key}
              data-lit={i === index}
              onClick={() => pager.current?.go(i)}
              className="relative z-[1] h-9 flex-[1_0_auto] whitespace-nowrap rounded-[2px] px-2.5 text-[12.5px] font-bold text-muted-foreground transition-colors duration-200 data-[lit=true]:text-background"
            >
              {t.label}
              {open(t) && <i className="absolute right-1 top-1.5 size-1.5 rounded-full bg-chyron-line" aria-label="To do" />}
            </button>
          ))}
        </div>
      )}

      <SwipePager
        ref={pager}
        count={tabs.length}
        index={index}
        onIndex={(i) => setSeg(tabs[i].key)}
        page={(i) => panel(tabs[i])}
        onMove={light}
        label="Your games: swipe between them, or use the arrow keys"
        peek={tabs.length > 1 ? "gys.moves-games.peeked" : undefined}
        className="-mx-4"
        paneClass="px-4"
        attrs={{ "data-moves-games": true }}
      />

      <Btn tone="must" wide className="mt-3.5" disabled={saving} onClick={save}>
        {saving ? "Saving…" : "Save"}
      </Btn>
      <p className="mt-2 text-center text-[13px] text-muted-foreground">Saving doesn&rsquo;t lock anything. Airtime does.</p>
    </>
  );
}

/** Results you haven't revealed stand in the way: who went home decides what you can choose. */
function RevealFirst({ episode, what }: { episode: number; what: string }) {
  const openReveal = useOpenReveal();
  return (
    <div className="rounded-[4px] bg-background p-4 outline-1 -outline-offset-1 outline-border">
      <b className="type-caption block text-[22px] leading-none">Reveal Episode {episode} first</b>
      <small className="mt-1.5 block text-sm leading-snug text-muted-foreground">Who went home decides {what}.</small>
      <Btn
        wide
        className="mt-3"
        onClick={() => {
          closeMoves();
          openReveal(episode);
        }}
      >
        Reveal Episode {episode}
      </Btn>
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="rounded-[4px] bg-background p-4 text-sm leading-snug text-muted-foreground outline-1 -outline-offset-1 outline-border">{children}</p>;
}

function LineupPanel({
  g,
  starters,
  onStarters,
  pickup,
  seasonId,
}: {
  g: GameView;
  starters: string[];
  onStarters: (s: string[]) => void;
  pickup: Move | undefined;
  seasonId: string;
}) {
  const l = g.lineup;
  if (g.revealFirst) return <RevealFirst episode={g.revealFirst} what="who you can start" />;
  if (!l) return <Note>No episode to set a lineup for yet.</Note>;
  const roster = l.roster.map((id) => faceIn(g, id)).filter((c) => !!c);
  if (l.locked) {
    return (
      <Note>
        Locked for Episode {l.episode}: {l.starters.map((id) => first(faceIn(g, id)?.name ?? "")).join(", ") || "nobody started"}.
      </Note>
    );
  }
  const stillIn = roster.filter((c) => !c.left).length;
  const toggle = (id: string) => {
    if (starters.includes(id)) return onStarters(starters.filter((x) => x !== id));
    if (starters.length >= l.slots) return toast.quiet("Bench someone first");
    onStarters([...starters, id]);
  };
  const tile = "relative isolate flex aspect-[3/4] flex-col justify-end overflow-hidden rounded-[3px] p-1.5 text-left text-white transition-shadow";
  return (
    <>
      <p className="mb-2.5 text-[13px] text-muted-foreground">
        Start {l.slots} of your {stillIn}. Tap to start or bench.
        {l.carried && sameSet(starters, l.starters) ? " Your last lineup carries over unless you change it." : ""}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {roster.map((c) => {
          const on = starters.includes(c.id);
          const body = (
            <>
              <Face
                src={c.photo}
                name={c.name}
                className={`absolute inset-0 -z-[2] size-full text-[40px] ${c.left ? "brightness-50 grayscale" : on ? "" : "brightness-[.7] saturate-[.35]"}`}
              />
              <span aria-hidden className="absolute inset-0 -z-[1] bg-[linear-gradient(180deg,transparent_45%,rgba(10,8,14,.92))]" />
              <span
                className={`type-caption absolute left-1.5 top-1.5 rounded-[2px] px-1.5 py-0.5 text-[10px] tracking-[0.06em] ${
                  c.left ? "bg-live text-live-foreground" : on ? "bg-chyron text-chyron-foreground" : "bg-[rgba(16,14,21,.8)] text-white/75"
                }`}
              >
                {c.left ? (pickup ? "Out · replace" : "Out") : on ? "Starting" : "Bench"}
              </span>
              <b className="type-caption text-[15px]">{first(c.name)}</b>
              <small className={`text-[11px] ${c.left ? "text-chyron-line" : "opacity-85"}`}>
                {c.left ? (pickup ? "Tap to replace" : c.out ? `Out · Ep ${c.out}` : "Out") : `${c.points ?? 0} pts`}
              </small>
            </>
          );
          if (c.left && pickup) {
            return (
              <NavLink key={c.id} href={paths.showPage(seasonId, "waivers")} className={tile}>
                {body}
              </NavLink>
            );
          }
          return (
            <button key={c.id} type="button" data-starter={c.id} disabled={c.left} onClick={() => toggle(c.id)} aria-pressed={on} className={`${tile} ${on ? "shadow-[0_0_0_3px_var(--chyron-line)]" : ""}`}>
              {body}
            </button>
          );
        })}
        {Array.from({ length: Math.max(0, l.need - starters.length) }, (_, i) => (
          <div
            key={i}
            className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-[3px] text-center text-muted-foreground outline-2 -outline-offset-2 outline-dashed outline-input"
          >
            <Plus className="size-[22px]" aria-hidden />
            <b className="type-caption text-[15px] text-foreground">Open slot</b>
            <small className="block text-[11px]">Start someone</small>
          </div>
        ))}
      </div>
      {pickup && <ReplaceRow pickup={pickup} seasonId={seasonId} />}
    </>
  );
}

/** Someone to replace: the waiver row, to the Waivers page. */
function ReplaceRow({ pickup, seasonId }: { pickup: Move; seasonId: string }) {
  return (
    <NavLink href={paths.showPage(seasonId, "waivers")} className="nd-press mt-2 flex min-h-[60px] w-full items-center gap-3 border-t border-border py-2 text-left">
      <IconBox icon={ArrowLeftRight} />
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-semibold">{pickup.text}</b>
        <small className="block text-[13px] text-muted-foreground">Waivers{pickup.deadline ? ` · due ${airTime(Date.parse(pickup.deadline))}` : ""}</small>
      </span>
      <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
    </NavLink>
  );
}

function PoolPanel({ g, pick, onPick }: { g: GameView; pick: string | null; onPick: (id: string) => void }) {
  const p = g.pick;
  if (g.revealFirst) return <RevealFirst episode={g.revealFirst} what="who you can pick" />;
  if (!p) return <Note>No episode to pick for yet.</Note>;
  if (!p.open) {
    const c = p.pick ? faceIn(g, p.pick) : undefined;
    return <Note>Picks are closed for Episode {p.episode}{c ? `: you picked ${first(c.name)}` : ""}.</Note>;
  }
  if (!p.available.length) return <Note>Nobody&rsquo;s left you can pick for Episode {p.episode}.</Note>;
  const blocked = new Map(p.blocked.map((b) => [b.id, b]));
  const choices = g.cast.filter((c) => p.available.includes(c.id) || blocked.has(c.id));
  return (
    <>
      <p className="mb-2.5 text-[13px] text-muted-foreground">
        Who survives Episode {p.episode}? {p.streak ? `Streak ${p.streak}. ` : ""}Not someone you&rsquo;ve used.
      </p>
      <div className="grid grid-cols-4 gap-2">
        {choices.map((c) => {
          const no = blocked.get(c.id);
          const on = pick === c.id;
          return (
            <button
              key={c.id}
              type="button"
              data-pick={c.id}
              disabled={!!no}
              onClick={() => onPick(c.id)}
              aria-pressed={on}
              className={`relative overflow-hidden rounded-[3px] bg-plate text-left text-plate-foreground ${no ? "opacity-45" : ""} ${on ? "shadow-[0_0_0_3px_var(--good)]" : ""}`}
            >
              <Face src={c.photo} name={c.name} className="aspect-[4/4.2] w-full text-[28px]" />
              {on && (
                <span className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-good text-good-foreground">
                  <Check className="size-3.5" strokeWidth={3} aria-hidden />
                </span>
              )}
              <span className="block px-1.5 pb-1.5 pt-1">
                <b className="type-caption block truncate text-[14px]">{first(c.name)}</b>
                <small className="block truncate text-[11px] text-plate-muted">{no ? (no.reason === "backToBack" ? "Last time" : `Used Ep ${no.episode}`) : (c.tribe?.name ?? "Still in")}</small>
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function PredictPanel({ play, guesses, onGuess }: { play: GameView[]; guesses: Record<string, string>; onGuess: (key: string, value: string) => void }) {
  const withCalls = play.filter((g) => g.predictions.length);
  if (!withCalls.length) return <Note>No predictions open this week.</Note>;
  return (
    <>
      {withCalls.map((g) => (
        <div key={g.leagueId}>
          {withCalls.length > 1 && <p className="type-caption mb-2 mt-1 text-[13px] tracking-[0.04em] text-muted-foreground">{g.name}</p>}
          {g.predictions.map((q) => {
            const key = guessKey(g, q.betId);
            return (
              <div key={q.betId} className="mb-4 block">
                <b className="block text-[15px]">{q.label}</b>
                <small className="mb-2 block text-[13px] text-muted-foreground">
                  {q.points} {q.points === 1 ? "point" : "points"} · Episode {q.episode}
                  {q.answers === 1 && !q.guess ? " · one more answer and it pays" : ""}
                </small>
                {q.options ? (
                  // A person or a yes or no (step 12 part 2): one tap, a tap again takes it back. An old guess in words stays a chip.
                  <span className="flex flex-wrap gap-2" role="group" aria-label={q.label}>
                    {[...q.options, ...(guesses[key] && !q.options.includes(guesses[key]) ? [guesses[key]] : [])].map((o) => (
                      <Chip key={o} on={guesses[key] === o} data-guess-chip={o} data-guess={q.betId} onClick={() => onGuess(key, guesses[key] === o ? "" : o)} className="h-10 px-3.5 text-[15px]">
                        {q.options!.length > 2 ? first(o) : o}
                      </Chip>
                    ))}
                  </span>
                ) : (
                  <input
                    data-guess={q.betId}
                    aria-label={q.label}
                    value={guesses[key] ?? ""}
                    onChange={(e) => onGuess(key, e.target.value)}
                    placeholder="Your guess"
                    maxLength={120}
                    className="h-12 w-full rounded-[3px] bg-background px-3 text-base outline-1 -outline-offset-1 outline-input placeholder:text-muted-foreground focus:outline-2 focus:outline-foreground"
                  />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}

function OutlastPanel({ g, pickup, seasonId }: { g: GameView; pickup: Move | undefined; seasonId: string }) {
  const team = (g.you?.team ?? []).map((id) => faceIn(g, id)).filter((c) => !!c);
  if (!team.length) return <Note>Your team shows here once the draft&rsquo;s done.</Note>;
  return (
    <>
      <p className="mb-2.5 text-[13px] text-muted-foreground">
        {pickup ? `No lineup in ${g.gameName}, but one of yours is out: pick who comes in.` : `Nothing to set in ${g.gameName}. Your ${team.length} just have to last.`}
      </p>
      {team.map((c) => (
        <div key={c.id} className={`flex min-h-14 items-center gap-3 border-t border-border py-1.5 ${c.knocked ? "opacity-(--nd-dim)" : ""}`}>
          <Face src={c.photo} name={c.name} out={c.knocked} className="size-10 rounded-[3px]" />
          <span className="min-w-0 flex-1">
            <b className="block text-[15px] font-semibold">{c.name}</b>
            <small className={`block text-[13px] ${c.knocked ? "text-foreground/85" : "text-muted-foreground"}`}>
              {c.left ? `Out${c.out ? ` · Episode ${c.out}` : ""}${c.place ? ` · finished ${ordinal(c.place)}` : ""}` : "Still in"}
            </small>
          </span>
          <b className="type-num text-[22px]">{c.points ?? 0}</b>
        </div>
      ))}
      {pickup && <ReplaceRow pickup={pickup} seasonId={seasonId} />}
    </>
  );
}
