"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeftRight, Check, ChevronDown, ChevronRight, Heart, Plus, RotateCcw, ShieldCheck, X } from "lucide-react";
import { airTime } from "../clock";
import { moves as write, setGroupSlot, useAfterSave, type GameView, type Move } from "../data";
import { NavLink } from "../nav";
import { paths } from "../routes";
import type { ShowData } from "../screens/show-space";
import { Btn, BtnLink, Chip } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { SwipePager, type PagerHandle } from "../ui/swipe-pager";
import { toast } from "../ui/toast";
import { ordinal } from "../games";
import { closeMoves, faceIn, first, openMoves, sheetTabs, useMovesSheet, type MovesTab, type SheetTab } from "./moves";
import { Face, IconBox } from "./parts";
import { useOpenReveal } from "./reveal";
import { askAfterSave } from "./remind";
import { lockedInEpisode, useLockIn, windowEpisode } from "./strip-night";
import { gameColour } from "../games";
import { fitsWith, matchSlots } from "@/lib/lineup-slots";

// "Your moves": one sheet with a tab per game you play here (Weekly Lineup, Survival Pool, Outlast's team) and Predictions, which
// saves through the league routes the classic app uses (lineups, picks, predictions). The games swipe by as a Weekly Lineup
// player's weeks do (ui/swipe-pager.tsx; the user, 2026-10-31), the tabs' highlight sliding along with the finger. Saving never
// locks; airtime does. Opened from the strip under the show bar (strip.tsx) and the game page. The moves dock that used to sit
// above the tab bar (the mock's dock.js) went in the design round's step 3: the strip says what's yours to set on every tab.

// ---------- the "Your moves" sheet ----------

export function MovesSheet({ show, seasonId }: { show: ShowData; seasonId: string }) {
  const { open, tab, leagueId } = useMovesSheet();
  // Opened from the address (`?moves=<tab>&game=<leagueId>`): the hub's next thing goes straight to its move, one tap (the design
  // round's step 7). Once the games are read, then the address drops it, so back and a reload don't open it again.
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current || !show.play) return;
    const url = new URL(window.location.href);
    const want = url.searchParams.get("moves");
    if (!want) return;
    asked.current = true;
    const game = url.searchParams.get("game");
    url.searchParams.delete("moves");
    url.searchParams.delete("game");
    window.history.replaceState(window.history.state, "", url);
    openMoves(want as MovesTab, game);
  }, [show.play]);
  const up = show.upNext;
  const until = up?.airAt ? airTime(Date.parse(up.airAt)) : null;
  // Your episode, not the season's: someone catching up sets their own next episode's moves, open until they reveal it
  // (the game page's words). Games on different episodes are each named (the gameplay bench's behind-viewer case, 2026-11-12).
  const yours = [...new Set((show.play ?? []).flatMap((g) => [g.lineup?.episode, g.pick?.episode]).filter((n): n is number => Number.isInteger(n)))].sort((a, b) => a - b);
  // A lineup that locks game by game (a sport's week of several games) is open past the week's first game without anyone being
  // behind: each player locks when their own game starts (TEMP-UI, Designs needed item 38).
  const byGame = (show.play ?? []).some((g) => g.lineup?.eachGame);
  const behind = !byGame && !!up && yours.length > 0 && yours[yours.length - 1] < up.number;
  // Nothing to set (knocked out, a team that only shows): no deadline to speak of.
  const settable = sheetTabs(show.play ?? []).length > 0;
  // Episode night (strip-night.ts): in the window your moves for the episode on or aired are open until you watch it, not until its
  // air time (which has passed); locked in (you said you're watching it), they're closed.
  const night = windowEpisode(show);
  const inWindow = night != null && yours.includes(night);
  const watching = lockedInEpisode(show);
  const lockedIn = !inWindow && watching != null && yours.includes(watching);
  // On air with nothing open (a game At airtime, or locked by hand): never a time already past (the check).
  const lockedNow = !inWindow && !lockedIn && !!up?.live && yours.includes(up.number);
  const subtitle = !settable
    ? undefined
    : inWindow
    ? `Episode ${night} · ${up?.live && up.number === night ? "on now" : "aired"}`
    : lockedIn
      ? `Episode ${watching} · locked in`
    : lockedNow
      ? `Episode ${up!.number} · locked at airtime`
      : yours.length > 1
      ? `Episodes ${yours.join(" and ")}`
      : yours.length === 1
        ? `Episode ${yours[0]}${byGame ? " · change anyone until their game starts" : behind ? " · change it until you reveal it" : until ? ` · change anything until ${until}` : ""}`
        : up
          ? `Episode ${up.number}${until ? ` · change anything until ${until}` : ""}`
          : undefined;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && closeMoves()} title="Your moves" subtitle={subtitle}>
      {show.play ? (
        // A fresh body each time it opens, at the tab it was opened for, from what's saved.
        <MovesBody key={`${open}-${tab}-${leagueId}`} show={show} play={show.play} initial={tab} initialLeague={leagueId} seasonId={seasonId} until={until} inWindow={inWindow} />
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
  inWindow = false,
}: {
  show: ShowData;
  play: GameView[];
  initial: MovesTab;
  initialLeague: string | null;
  seasonId: string;
  until: string | null;
  /** Episode night (strip-night.ts): the sheet is open in the window (moves open until you start watching). */
  inWindow?: boolean;
}) {
  const tabs = sheetTabs(play);
  const [seg, setSeg] = useState(
    () => (tabs.find((t) => t.kind === initial && (!initialLeague || !t.leagueId || t.leagueId === initialLeague)) ?? tabs.find((t) => t.kind === initial) ?? tabs[0])?.key
  );
  const [lineups, setLineups] = useState<Record<string, string[]>>(() => Object.fromEntries(play.filter((g) => g.lineup).map((g) => [g.leagueId, g.lineup!.starters])));
  // Each game's whole pick, in order: one for a pool, up to `each` for a game that picks several.
  const [picks, setPicks] = useState<Record<string, string[]>>(() => Object.fromEntries(play.filter((g) => g.pick).map((g) => [g.leagueId, g.pick!.picks.length ? g.pick!.picks : g.pick!.pick ? [g.pick!.pick] : []])));
  const [guesses, setGuesses] = useState<Record<string, string>>(() =>
    Object.fromEntries(play.flatMap((g) => g.predictions.map((q) => [guessKey(g, q.betId), q.guess?.text ?? ""])))
  );
  // Round 5 (B2): each lineup's captain, its group slots changed here, each pool's second pick.
  const [captains, setCaptains] = useState<Record<string, string | null>>(() => Object.fromEntries(play.filter((g) => g.lineup && g.twists?.captain).map((g) => [g.leagueId, g.twists!.captain!.castawayId])));
  const [slotPicks, setSlotPicks] = useState<Record<string, Record<number, string>>>({});
  const [seconds, setSeconds] = useState<Record<string, string | null>>(() => Object.fromEntries(play.filter((g) => g.pick?.second).map((g) => [g.leagueId, g.pick!.second!.id])));
  const [saving, setSaving] = useState(false);
  // Episode night: in the window the sheet first asks whether you've started watching (the user, 2026-11-18: nobody watching live
  // may read the window as theirs). Not yet opens the moves; Yes locks them in every game (the server's lock: strip-night.ts).
  const [notYet, setNotYet] = useState(false);
  const lateEp = play.find((g) => g.late && (g.lineup?.episode === g.late.episode || g.pick?.episode === g.late.episode))?.late?.episode ?? null;
  // Locked in already (GameView.watching): the moves read, closed.
  const inEp = lateEp == null ? (play.find((g) => g.watching != null && (g.lineup?.episode === g.watching || g.pick?.episode === g.watching))?.watching ?? null) : null;
  const lock = useLockIn(seasonId);
  const after = useAfterSave();
  const game = (id: string | null) => play.find((g) => g.leagueId === id);
  // Someone of yours to replace in a game: a waiver move (the home's), whose page is pushed over the show.
  const pickup = (leagueId: string) => show.moves.find((m) => m.kind === "pickup" && m.leagueId === leagueId);

  // Whether a tab still has something for you to do (its dot).
  const open = (t: SheetTab): boolean => {
    const g = game(t.leagueId);
    if (g && pickup(g.leagueId)) return true;
    if (t.kind === "lineup") return !!g && lineupOpen(g) && (lineups[g.leagueId]?.length ?? 0) < g.lineup!.need;
    if (t.kind === "pool") return !!g && pickOpen(g) && (picks[g.leagueId]?.length ?? 0) < (g.pick?.each ?? 1);
    if (t.kind === "predict") return play.some((x) => x.predictions.some((q) => !(guesses[guessKey(x, q.betId)] ?? "").trim()));
    return false;
  };

  async function save() {
    const jobs: (() => Promise<void>)[] = [];
    const kinds = new Set<string>();
    for (const g of play) {
      const l = g.lineup;
      // The captain, when this game has one and it changed (sent with the lineup, as the route takes it).
      const cap = l && g.twists?.captain ? (captains[g.leagueId] ?? null) : undefined;
      const capChanged = cap !== undefined && cap !== g.twists?.captain?.castawayId;
      if (l && lineupOpen(g) && (!sameSet(lineups[g.leagueId] ?? [], l.starters) || capChanged)) {
        kinds.add("lineup");
        jobs.push(() => write.lineup(g.leagueId, l.epId, g.playerId, lineups[g.leagueId], capChanged ? cap : undefined));
      }
      const offered = g.twists?.offered;
      for (const [slot, groupId] of Object.entries(l && lineupOpen(g) && offered ? (slotPicks[g.leagueId] ?? {}) : {})) {
        kinds.add("lineup");
        jobs.push(() => setGroupSlot(g.leagueId, offered!.epId, g.playerId, Number(slot), groupId).then(() => undefined));
      }
      const p = g.pick;
      const chosen = picks[g.leagueId];
      if (p && pickOpen(g) && chosen?.length && !sameSet(chosen, p.picks.length ? p.picks : p.pick ? [p.pick] : [])) {
        kinds.add("pick");
        jobs.push(() => write.pick(g.leagueId, p.epId, g.playerId, p.each > 1 ? chosen : chosen[0]));
      }
      // The second pick after the first (it stands beside one); changing the first to the second's person drops it server-side.
      const second = p?.second ? (seconds[g.leagueId] ?? null) : undefined;
      if (p && pickOpen(g) && second !== undefined && second !== p.second?.id && (chosen?.length || p.pick)) {
        kinds.add("pick");
        jobs.push(() => write.second(g.leagueId, p.epId, g.playerId, second));
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
      // In the window: what's left, by name, and when it locks (the check: "Something's still open" didn't say what).
      const left = tabs.find((t) => t.kind !== "predict" && t.kind !== "outlast" && open(t));
      const leftWords = left ? (left.kind === "pool" ? "Pick who survives" : "Fill your lineup") : null;
      toast(still ? (inWindow && leftWords ? `Saved. ${leftWords} before you start watching.` : "Saved. Something's still open.") : inWindow ? "All set. It locks when you start watching." : until ? `All set. Change anything until ${until}.` : "All set.");
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
      return (
        <LineupPanel
          g={g}
          starters={lineups[g.leagueId] ?? []}
          onStarters={(s) => {
            setLineups((x) => ({ ...x, [g.leagueId]: s }));
            // A benched captain isn't captain any more.
            setCaptains((x) => (x[g.leagueId] && !s.includes(x[g.leagueId]!) ? { ...x, [g.leagueId]: null } : x));
          }}
          pickup={pickup(g.leagueId)}
          seasonId={seasonId}
          pieces={{ captain: captains[g.leagueId] ?? null, onCaptain: (id) => setCaptains((x) => ({ ...x, [g.leagueId]: id })), slots: slotPicks[g.leagueId] ?? {}, onSlot: (slot, id) => setSlotPicks((x) => ({ ...x, [g.leagueId]: { ...(x[g.leagueId] ?? {}), [slot]: id } })) }}
        />
      );
    if (t.kind === "pool" && g)
      return (
        <PoolPanel
          g={g}
          chosen={picks[g.leagueId] ?? []}
          pieces={{ second: seconds[g.leagueId] ?? null, onSecond: (id) => setSeconds((x) => ({ ...x, [g.leagueId]: id })) }}
          onPick={(id) =>
            setPicks((x) => {
              const now = x[g.leagueId] ?? [], each = g.pick?.each ?? 1;
              if (each === 1) return { ...x, [g.leagueId]: [id] };
              if (now.includes(id)) return { ...x, [g.leagueId]: now.filter((c) => c !== id) };
              if (now.length >= each) {
                toast.quiet(`${each} at most: take one off first`);
                return x;
              }
              return { ...x, [g.leagueId]: [...now, id] };
            })
          }
        />
      );
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
  // Moves still open after their episode aired (a live game's, while you haven't started watching it): asked about once for the
  // sheet, since watching an episode is across all your games.
  const lateMoves = play.filter((g) => g.late && (g.lineup?.episode === g.late.episode || g.pick?.episode === g.late.episode));
  const gated = lateEp != null && !notYet;
  // Nothing here can change (every game locked at airtime): the sheet reads, it doesn't offer a Save (the check).
  const editable = play.some((g) => lineupOpen(g) || pickOpen(g) || g.predictions.length > 0);
  const lockedIn = inEp != null;
  const onAir = !!show.upNext?.live && show.upNext.number === lateEp;
  const resultsIn = lateEp != null && show.episodes?.reveal?.episode === lateEp;
  return (
    <>
      {lockedIn ? (
        <Note>Locked in for Episode {inEp}. You said you&rsquo;re watching it.</Note>
      ) : gated ? (
        <StartedGate
          seasonId={seasonId}
          episode={lateEp}
          resultsIn={resultsIn}
          onNotYet={() => setNotYet(true)}
          onWatching={() => {
            closeMoves();
            void lock(lateEp, `Locked in for Episode ${lateEp}. ${onAir ? "Enjoy the episode." : "Results when they're in."}`);
          }}
        />
      ) : (
        lateEp != null && (
          <p data-not-started className="mb-3 text-[13px] leading-snug text-muted-foreground">
            Not started Episode {lateEp} · change anything until you do.
          </p>
        )
      )}
      <div inert={gated || lockedIn} data-moves-gated={gated || lockedIn || undefined} className={gated || lockedIn ? "opacity-50 saturate-[.7]" : undefined}>
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
              className="relative z-[1] h-9 flex-[1_0_auto] whitespace-nowrap rounded-[2px] px-2.5 text-[13px] font-bold text-muted-foreground transition-colors duration-200 data-[lit=true]:text-background"
            >
              {game(t.leagueId) && <i aria-hidden className="mr-1.5 inline-block size-1.5 rounded-full align-middle" style={{ background: gameColour(game(t.leagueId)!.gameName) }} />}
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
      </div>

      {/* The started gate up, the moves locked in, or nothing here that can change: no Save. */}
      {!(gated || lockedIn || !editable) && (
      <div data-moves-save className="sticky bottom-0 z-[2] -mx-4 mt-1.5 bg-card px-4 pb-1 pt-2 shadow-[0_24px_0_0_var(--card)] before:pointer-events-none before:absolute before:inset-x-0 before:bottom-full before:h-5 before:bg-gradient-to-t before:from-card before:to-transparent">
      {tabs.some((t) => t.kind !== "outlast" || (t.leagueId && pickup(t.leagueId))) && (
        <Btn tone="must" wide disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save"}
        </Btn>
      )}
      <p className="mt-2 text-center text-[13px] text-muted-foreground">
        Saving doesn&rsquo;t lock anything.{" "}
        {(() => {
          // Catching up, an episode locks when you reveal it, not at its airtime (it's aired already).
          const up = show.upNext?.number ?? Infinity;
          // A lineup that locks game by game: each player's own game does (not airtime, not a reveal).
          if (play.some((g) => g.lineup?.eachGame)) return "Each player locks when their game starts.";
          const eps = play.map((g) => g.lineup?.episode ?? g.pick?.episode).filter((n): n is number => Number.isInteger(n));
          const behind = eps.filter((n) => n < up).length;
          // A live game's episode that aired and you haven't started watching: starting to is what locks it.
          if (lateMoves.length) return "Starting to watch does.";
          return !behind ? "Airtime does." : behind === eps.length ? "Revealing the episode does." : "Airtime does, or revealing an episode you’re catching up on.";
        })()}
      </p>
      </div>
      )}
    </>
  );
}

/**
 * Episode night (docs/design-round/strip-night-spec.md, "Watching live isn't 'before you watch'"): in the window the sheet asks before
 * it opens the moves, two answers of equal weight. Not yet: the moves open. Yes: they lock in, in every game (the server's lock).
 * Once results are in, Yes opens the reveal, which locks them.
 */
function StartedGate({ seasonId, episode, resultsIn, onNotYet, onWatching }: { seasonId: string; episode: number; resultsIn: boolean; onNotYet: () => void; onWatching: () => void }) {
  return (
    <div data-started-gate={episode} className="mb-3 rounded-[4px] bg-background p-3.5 outline-1 -outline-offset-1 outline-border">
      <b className="block text-[16px] leading-tight">Have you started watching Episode {episode}?</b>
      <small className="mt-1 block text-[13px] leading-snug text-muted-foreground">Your moves lock when you start, so the couch plays fair.</small>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Btn data-gate-not-yet onClick={onNotYet} className="h-auto min-h-12 flex-col gap-0 py-1.5 leading-tight">
          Not yet
          <small className="text-[13px] font-semibold opacity-75">change my moves</small>
        </Btn>
        {resultsIn ? (
          <BtnLink href={paths.reveal(seasonId, episode)} data-gate-watched onClick={() => closeMoves()} className="h-auto min-h-12 flex-col gap-0 py-1.5 leading-tight">
            Yes
            <small className="text-[13px] font-semibold opacity-75">see the results</small>
          </BtnLink>
        ) : (
          <Btn data-gate-watching onClick={onWatching} className="h-auto min-h-12 flex-col gap-0 py-1.5 leading-tight">
            Yes
            <small className="text-[13px] font-semibold opacity-75">lock in</small>
          </Btn>
        )}
      </div>
    </div>
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
  pieces,
}: {
  g: GameView;
  starters: string[];
  onStarters: (s: string[]) => void;
  pickup: Move | undefined;
  seasonId: string;
  /** Round 5 (B2): the captain and the group slots. */
  pieces?: { captain: string | null; onCaptain: (id: string | null) => void; slots: Record<number, string>; onSlot: (slot: number, groupId: string) => void } | null;
}) {
  const l = g.lineup;
  if (g.revealFirst) return <RevealFirst episode={g.revealFirst} what="who you can start" />;
  if (!l) return <Note>{g.blocked ? `${g.blocked}: nothing to set.` : "No episode to set a lineup for yet."}</Note>;
  const roster = l.roster.map((id) => faceIn(g, id)).filter((c) => !!c);
  // The captain (score.captain): the twists' for this episode, one source.
  const cap = g.twists?.captain ?? null;
  if (l.locked) {
    return (
      <Note>
        Locked for Episode {l.episode}: {l.starters.map((id) => first(faceIn(g, id)?.name ?? "")).join(", ") || "nobody started"}.
      </Note>
    );
  }
  const stillIn = roster.filter((c) => !c.left).length;
  // (Game by game: whoever's game has started stays where they are until the day's over; a tap says so rather than build a save
  // the server refuses.)
  const stuck = new Set(l.eachGame?.locked ?? []);
  const toggle = (id: string) => {
    if (stuck.has(id)) return toast.quiet(`${first(faceIn(g, id)?.name ?? "")}'s game has started: they stay ${starters.includes(id) ? "in" : "out"} until the day's over`);
    if (starters.includes(id)) return onStarters(starters.filter((x) => x !== id));
    if (starters.length >= l.slots) return toast.quiet("Bench someone first");
    if (ls && !fitsWith(starters, id, ls.fits, ls.widths)) {
      // Which slots would take them, all full: say those ("plays QB, and your QB slot is full"), or that nothing takes them.
      const can = [...new Set((ls.fits[id] ?? []).map((i) => ls.labels[i]))];
      const who = first(faceIn(g, id)?.name ?? "");
      return toast.quiet(can.length ? `${who} plays ${can.join(" or ")}, and your ${can.join(" and ")} ${can.length > 1 ? "slots are" : "slot is"} full. Bench someone there first` : `No slot in this lineup takes ${who}`);
    }
    onStarters([...starters, id]);
  };
  // Cast properties (chunk 5): a lineup's slots, matched as you edit, each starter's tag its slot ("QB", "W/R/T").
  const ls = l.lineupSlots;
  const owner = ls ? matchSlots(starters, ls.fits, ls.widths) : null;
  const slotOf = (id: string) => (ls && owner ? ls.labels[owner.indexOf(id)] ?? null : null);
  const open = ls && owner ? ls.labels.filter((_, i) => owner[i] === null) : null;
  const tile = "relative isolate flex aspect-[3/4] flex-col justify-end overflow-hidden rounded-[3px] p-1.5 text-left text-white transition-shadow";
  return (
    <>
      <p className="mb-2.5 text-[13px] text-muted-foreground">
        Start {l.slots} of your {stillIn}{ls ? `: ${ls.summary}` : ""}. Tap to start or bench.
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
                data-starter-tag
                className={`type-caption absolute left-1.5 top-1.5 rounded-[2px] px-1.5 py-0.5 text-[10px] tracking-[0.06em] ${
                  c.left ? "bg-live text-live-foreground" : on && pieces && cap && pieces.captain === c.id ? "bg-foreground text-background" : on ? "bg-chyron text-chyron-foreground" : "bg-[rgba(16,14,21,.8)] text-white/75"
                }`}
              >
                {c.left ? (pickup ? "Out · replace" : "Out") : on && pieces && cap && pieces.captain === c.id ? `Captain ×${cap.times}` : on ? (slotOf(c.id) ?? "Starting") : "Bench"}
              </span>
              <b className="type-caption text-[15px]">{first(c.name)}</b>
              <small className={`text-[11px] ${c.left ? "text-chyron-line" : "opacity-85"}`}>
                {c.left ? (pickup ? "Tap to replace" : c.out ? `Out · Ep ${c.out}` : "Out") : stuck.has(c.id) ? "Locked · game on" : `${c.points ?? 0} pts`}
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
            data-open-slot={open?.[i] ?? ""}
            className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-[3px] text-center text-muted-foreground outline-2 -outline-offset-2 outline-dashed outline-input"
          >
            <Plus className="size-[22px]" aria-hidden />
            <b className="type-caption text-[15px] text-foreground">{open?.[i] ? `Open · ${open[i]}` : (g.twists?.slots ?? []).length ? "Empty" : "Open slot"}</b>
            <small className="block text-[11px]">{open?.[i] ? `Start a ${open[i]}` : "Start someone"}</small>
          </div>
        ))}
      </div>
      {pieces && cap && <CaptainRow g={g} starters={starters} times={cap.times} captain={pieces.captain} onCaptain={pieces.onCaptain} />}
      {pieces && (g.twists?.slots ?? []).map((x) => <SlotRow key={x.slot} g={g} slot={x} picked={pieces.slots[x.slot] ?? null} pending={pieces.slots} onPick={(id) => pieces.onSlot(x.slot, id)} />)}
      {pickup && <ReplaceRow pickup={pickup} seasonId={seasonId} />}
    </>
  );
}

/** Round 5 (B2): a group by its people's first names ("Finley & Cameron"), as research names it ("Finley Fischer & Cameron Chen"). */
export function groupShort(name: string | null | undefined): string | null {
  if (!name) return null;
  const parts = name.split(/\s*&\s*/);
  return parts.length > 1 ? parts.map((x) => x.trim().split(" ")[0]).join(" & ") : name;
}

/** Round 5 (B2): what a group's people have scored so far in this game, between them. */
function groupPoints(g: GameView, members: string[]): string {
  const n = Math.round(members.reduce((t, id) => t + (faceIn(g, id)?.points ?? 0), 0) * 10) / 10;
  return `${n} ${n === 1 ? "pt" : "pts"}`;
}

/** Round 5 (B2): the lineup's captain, one of the starters by name, in one row however many start (it scrolls sideways). */
function CaptainRow({ g, starters, times, captain, onCaptain }: { g: GameView; starters: string[]; times: number; captain: string | null; onCaptain: (id: string | null) => void }) {
  return (
    <div data-captain-row className="mt-3.5 border-t border-border pt-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="type-caption text-[14px] tracking-[0.02em] text-muted-foreground">Captain ×{times}</p>
        <small className="text-[13px] text-muted-foreground">{captain ? `${first(faceIn(g, captain)?.name ?? "")} scores ${times === 2 ? "double" : `×${times}`}` : starters.length ? "No captain: pick one of your starters" : "Start someone first"}</small>
      </div>
      {captain && <p className="mt-1 text-[13px] text-muted-foreground">Carries to the next one unless you change it or bench them.</p>}
      <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="radiogroup" aria-label="Captain">
        {starters.map((id) => {
          const c = faceIn(g, id);
          const on = captain === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              data-captain={id}
              onClick={() => onCaptain(on ? null : id)}
              className={`nd-press flex min-h-11 flex-none items-center gap-2 rounded-[3px] px-3 text-left ${on ? "bg-foreground text-background" : "bg-background text-foreground outline-1 -outline-offset-1 outline-border"}`}
            >
              {on && <Check className="size-4" strokeWidth={3} aria-hidden />}
              <b className="type-caption text-[15px]">{first(c?.name ?? "")}</b>
              <small className={`text-[12px] ${on ? "text-background/70" : "text-muted-foreground"}`}>{c?.points ?? 0} pts</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Round 5 (B2): a group slot in the lineup: what it holds now, or (open) the groups on offer going into the episode, opened in place. */
function SlotRow({ g, slot, picked, pending, onPick }: { g: GameView; slot: NonNullable<GameView["twists"]["slots"]>[number]; picked: string | null; pending: Record<number, string>; onPick: (groupId: string) => void }) {
  const [open, setOpen] = useState(false);
  const offered = g.twists?.offered?.groups ?? [];
  const canPick = (slot.status === "empty" || slot.status === "dropped") && offered.length > 0;
  const chosen = picked ? offered.find((x) => x.id === picked) : null;
  const name = groupShort(chosen?.name ?? slot.group);
  const many = (g.twists?.slots ?? []).length > 1;
  const people = chosen?.members ?? slot.members;
  // In your other slots: saved, or picked here and not saved yet (the route refuses one group in two slots).
  const taken = new Set<string | null>([...(g.twists?.slots ?? []).filter((x) => x.slot !== slot.slot).map((x) => pending[x.slot] ?? x.groupId), ...Object.entries(pending).filter(([k]) => Number(k) !== slot.slot).map(([, v]) => v)].filter(Boolean));
  const state = chosen
    ? "Goes in when you save"
    : slot.status === "held"
      ? "Riding: it scores while they stay together"
      : slot.status === "void"
        ? `Void this episode${slot.why?.[0] ? `: ${slot.why[0].toLowerCase()}` : ""}`
        : slot.status === "dropped"
          ? `Dropped: the show re-formed its groups${slot.endedAt ? ` after Ep ${slot.endedAt}` : ""}`
          : slot.status === "waiting"
            ? `Riding into Ep ${g.lineup?.episode}: it scores if they stay together`
            : "Empty";
  const head = (
    <>
      <span className={`type-caption flex-none rounded-[2px] px-1.5 py-0.5 text-[11px] tracking-[0.06em] ${slot.status === "held" || slot.status === "waiting" || chosen ? "bg-good text-good-foreground" : "bg-quiet-tag text-quiet-tag-foreground"}`}>Group slot{many ? ` ${slot.slot + 1}` : ""}</span>
      <span className="min-w-0 flex-1">
        <b className="type-caption block truncate text-[16px]">{name ?? (canPick ? "Pick a group" : "Nothing in it")}</b>
        <small className="block text-[13px] leading-snug text-muted-foreground">{state}</small>
      </span>
      <span className="flex flex-none -space-x-1.5">
        {people.slice(0, 3).map((id) => {
          const c = faceIn(g, id);
          return <Face key={id} src={c?.photo ?? null} name={c?.name} className="size-7 rounded-[3px] text-[12px] outline-2 outline-card" />;
        })}
      </span>
    </>
  );
  return (
    <div data-slot-row={slot.slot} className="mt-3 border-t border-border pt-2.5">
      {canPick ? (
        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="nd-press flex min-h-12 w-full items-center gap-2.5 text-left">
          {head}
          <ChevronDown className={`size-5 flex-none text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
      ) : (
        <div className="flex min-h-12 items-center gap-2.5">{head}</div>
      )}
      {canPick && open && (
        <div data-slot-groups className="mt-1.5 rounded-[3px] bg-background p-1.5">
          <GroupRows
            g={g}
            picked={picked}
            taken={taken}
            onPick={(id) => {
              onPick(id);
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

/** Round 5 (B2): the groups on offer going into the episode, a row each (their people, their points so far, who holds them in an
 *  exclusive game), for a slot's row in Your moves and the page's own picker. */
export function GroupRows({ g, picked, taken, onPick, busy }: { g: GameView; picked: string | null; taken: Set<string | null>; onPick: (id: string) => void; busy?: string | null }) {
  const offered = g.twists?.offered?.groups ?? [];
  return (
    <>
          {offered.map((x) => {
            const held = (x.heldBy ?? []).map((pid) => g.table.find((r) => r.playerId === pid)?.name).filter(Boolean);
            const no = taken.has(x.id) || held.length > 0;
            return (
              <button
                key={x.id}
                type="button"
                data-slot-group={x.id}
                disabled={no || !!busy}
                aria-pressed={picked === x.id}
                onClick={() => onPick(x.id)}
                className={`nd-press flex min-h-12 w-full items-center gap-2.5 rounded-[2px] px-2 text-left ${picked === x.id ? "bg-card" : ""} ${no ? "opacity-45" : ""}`}
              >
                <span className="flex flex-none -space-x-1.5">
                  {(x.members ?? []).slice(0, 3).map((id) => {
                    const c = faceIn(g, id);
                    return <Face key={id} src={c?.photo ?? null} name={c?.name} className="size-7 rounded-[3px] text-[12px] outline-2 outline-background" />;
                  })}
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[15px] font-semibold">{groupShort(x.name)}</b>
                  <small className="block text-[13px] text-muted-foreground">{held.length ? `Held by ${held.join(", ")}` : taken.has(x.id) ? "In your other slot" : `${x.size} still in · ${groupPoints(g, x.members ?? [])} so far between them`}</small>
                </span>
                {busy === x.id ? <small className="flex-none text-[13px] text-muted-foreground">Saving…</small> : picked === x.id && <Check className="size-4 flex-none" strokeWidth={3} aria-hidden />}
              </button>
            );
          })}
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

function PoolPanel({ g, chosen, onPick, pieces }: { g: GameView; chosen: string[]; onPick: (id: string) => void; pieces?: { second: string | null; onSecond: (id: string | null) => void } | null }) {
  const p = g.pick;
  // Round 5 (B2): which of the two places a face tap fills (a pool with a second pick).
  const [place, setPlace] = useState<"first" | "second">("first");
  if (g.revealFirst) return <RevealFirst episode={g.revealFirst} what="who you can pick" />;
  if (!p) return <Note>{g.blocked ? `${g.blocked}: nothing to pick.` : "No episode to pick for yet."}</Note>;
  if (!p.open) {
    const names = (p.picks.length ? p.picks : p.pick ? [p.pick] : []).map((id) => faceIn(g, id)?.name).filter((n): n is string => !!n).map(first);
    return <Note>Picks are closed for Episode {p.episode}{names.length ? `: you picked ${names.join(", ")}` : ""}.</Note>;
  }
  if (!p.available.length) return <Note>Nobody&rsquo;s left you can pick for Episode {p.episode}.</Note>;
  const blocked = new Map(p.blocked.map((b) => [b.id, b]));
  const choices = g.cast.filter((c) => p.available.includes(c.id) || blocked.has(c.id));
  const two = !!pieces && !!p.second && p.each === 1;
  const firstId = chosen[0] ?? null;
  const tap = (id: string) => {
    if (!two) return onPick(id);
    if (place === "first") {
      if (id === pieces!.second) return toast.quiet("That's your second pick: take it out there first");
      onPick(id);
      return;
    }
    if (id === firstId) return toast.quiet("That's your pick: a second pick is someone else");
    pieces!.onSecond(pieces!.second === id ? null : id);
  };
  const parts = poolParts(g);
  return (
    <>
      {parts && (
        <p data-pool-parts className="mb-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-muted-foreground">
          {parts}
        </p>
      )}
      {two && (
        <PickPlaces
          g={g}
          first={firstId}
          second={pieces!.second}
          place={place}
          onPlace={(x) => (x === "second" && !firstId ? toast.quiet("Make your pick first: a second pick stands beside it") : setPlace(x))}
          onClear={() => pieces!.onSecond(null)}
          always={p.second!.always}
        />
      )}
      <p className="mb-2.5 text-[13px] text-muted-foreground">
        {p.each > 1 ? (
          <>
            Pick {p.each} for Episode {p.episode} · {chosen.length} of {p.each} chosen.
          </>
        ) : (
          <>
            Who survives Episode {p.episode}? {p.streak ? `Streak ${p.streak}. ` : ""}Not someone you&rsquo;ve used.
          </>
        )}
      </p>
      <div className="grid grid-cols-4 gap-2 pb-1">
        {choices.map((c) => {
          const no = blocked.get(c.id);
          const isSecond = two && pieces!.second === c.id;
          const on = chosen.includes(c.id) || isSecond;
          return (
            <button
              key={c.id}
              type="button"
              data-pick={c.id}
              disabled={!!no}
              onClick={() => tap(c.id)}
              aria-pressed={on}
              aria-label={two && on ? `${c.name}, ${isSecond ? "your second pick" : "your pick"}` : undefined}
              className={`relative overflow-hidden rounded-[3px] bg-plate text-left text-plate-foreground ${no ? "opacity-45" : ""} ${on ? "shadow-[0_0_0_3px_var(--good)]" : ""}`}
            >
              <Face src={c.photo} name={c.name} className="aspect-[4/4.2] w-full text-[28px]" />
              {on && (
                <span className="type-num absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-good text-[14px] text-good-foreground">
                  {two ? (isSecond ? "2" : "1") : <Check className="size-3.5" strokeWidth={3} aria-hidden />}
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

/** Round 5 (B2): what a pool still allows, for the pick sheet's line: lives, mulligans and buy-backs left (only the parts it has). */
function poolParts(g: GameView): ReactNode {
  const t = g.twists?.pool;
  if (!t) return null;
  const bits: ReactNode[] = [];
  if (t.livesOf) bits.push(<span key="l" className="inline-flex items-center gap-1"><Heart className="size-3.5" aria-hidden />{t.lives === 1 ? "1 life left" : t.lives ? `${t.lives} lives left` : "No lives left"}</span>);
  if (t.mulligansOf) bits.push(<span key="m" className="inline-flex items-center gap-1"><ShieldCheck className="size-3.5" aria-hidden />{t.mulligans === 1 ? "1 mulligan left" : t.mulligans ? `${t.mulligans} mulligans left` : "No mulligans left"}</span>);
  if (t.buybacks) bits.push(<span key="b" className="inline-flex items-center gap-1"><RotateCcw className="size-3.5" aria-hidden />{t.buybacks.left ? `Buy back ${t.buybacks.left === 1 ? "once" : `${t.buybacks.left} times`} for ${t.buybacks.cost}` : "No buy-backs left"}</span>);
  return bits.length ? bits : null;
}

/** Round 5 (B2): a pool's two places, your pick and the second, side by side; the outlined one is what a face tap fills. */
function PickPlaces({ g, first: one, second, place, onPlace, onClear, always }: { g: GameView; first: string | null; second: string | null; place: "first" | "second"; onPlace: (p: "first" | "second") => void; onClear: () => void; always: boolean }) {
  const box = (key: "first" | "second", id: string | null, label: string, empty: string) => {
    const c = id ? faceIn(g, id) : null;
    const on = place === key;
    return (
      <div className={`relative flex min-h-16 min-w-0 flex-1 items-center gap-2.5 rounded-[3px] bg-background p-2 ${on ? "outline-2 -outline-offset-2 outline-good" : "outline-1 -outline-offset-1 outline-border"}`}>
        <button type="button" data-pick-place={key} aria-pressed={on} onClick={() => onPlace(key)} className="absolute inset-0 rounded-[3px]" aria-label={`${label}${c ? `: ${c.name}` : ""}`} />
        {c ? (
          <Face src={c.photo} name={c.name} className="pointer-events-none size-11 flex-none rounded-[3px] text-[18px]" />
        ) : (
          <span aria-hidden className="pointer-events-none size-11 flex-none rounded-[3px] outline-2 -outline-offset-2 outline-dashed outline-input" />
        )}
        <span className="pointer-events-none min-w-0 flex-1">
          <small className="type-caption block text-[11px] tracking-[0.06em] text-muted-foreground">{label}</small>
          <b className={`block truncate text-[14px] ${c ? "font-semibold" : "font-normal text-muted-foreground"}`}>{c ? first(c.name) : empty}</b>
        </span>
        {key === "second" && second && (
          <button type="button" data-pick-clear onClick={onClear} aria-label="Take the second pick out" className="relative z-[1] -my-2 -mr-2 grid size-11 flex-none place-items-center text-muted-foreground">
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>
    );
  };
  return (
    <div data-pick-places className="mb-2.5">
      <div className="flex gap-2">
        {box("first", one, "Your pick", "Tap someone")}
        {box("second", second, "Second pick", "Tap here to add")}
      </div>
      <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">
        {place === "second" ? "Tap someone for your second pick. " : "Tap Second pick to add one. "}
        {always ? "It counts every night" : "It counts only on a night two or more go home"}: if they go home then, your streak ends as with a wrong pick, and either way they&rsquo;re used.
      </p>
    </div>
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
