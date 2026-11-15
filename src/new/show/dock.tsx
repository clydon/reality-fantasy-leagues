"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeftRight, Check, ChevronRight, Plus } from "lucide-react";
import { airTime } from "../clock";
import { moves as write, useAfterSave, type GameView, type Move } from "../data";
import { NavLink } from "../nav";
import { paths } from "../routes";
import type { ShowData } from "../screens/show-space";
import { Btn, Chip } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { SwipePager, type PagerHandle } from "../ui/swipe-pager";
import { toast } from "../ui/toast";
import { ordinal } from "../games";
import { closeMoves, faceIn, first, sheetTabs, useMovesSheet, type MovesTab, type SheetTab } from "./moves";
import { Face, IconBox } from "./parts";
import { useOpenReveal } from "./reveal";
import { askAfterSave } from "./remind";

// "Your moves": one sheet with a tab per game you play here (Weekly Lineup, Survival Pool, Outlast's team) and Predictions, which
// saves through the league routes the classic app uses (lineups, picks, predictions). The games swipe by as a Weekly Lineup
// player's weeks do (ui/swipe-pager.tsx; the user, 2026-10-31), the tabs' highlight sliding along with the finger. Saving never
// locks; airtime does. Opened from the strip under the show bar (strip.tsx) and the game page. The moves dock that used to sit
// above the tab bar (the mock's dock.js) went in the design round's step 3: the strip says what's yours to set on every tab.

// ---------- the "Your moves" sheet ----------

export function MovesSheet({ show, seasonId }: { show: ShowData; seasonId: string }) {
  const { open, tab, leagueId } = useMovesSheet();
  const up = show.upNext;
  const until = up?.airAt ? airTime(Date.parse(up.airAt)) : null;
  // Your episode, not the season's: someone catching up sets their own next episode's moves, open until they reveal it
  // (the game page's words). Games on different episodes are each named (the gameplay bench's behind-viewer case, 2026-11-12).
  const yours = [...new Set((show.play ?? []).flatMap((g) => [g.lineup?.episode, g.pick?.episode]).filter((n): n is number => Number.isInteger(n)))].sort((a, b) => a - b);
  // A lineup that locks game by game (a sport's week of several games) is open past the week's first game without anyone being
  // behind: each player locks when their own game starts (TEMP-UI, Designs needed item 38).
  const byGame = (show.play ?? []).some((g) => g.lineup?.eachGame);
  const behind = !byGame && !!up && yours.length > 0 && yours[yours.length - 1] < up.number;
  const subtitle =
    yours.length > 1
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
  // Each game's whole pick, in order: one for a pool, up to `each` for a game that picks several.
  const [picks, setPicks] = useState<Record<string, string[]>>(() => Object.fromEntries(play.filter((g) => g.pick).map((g) => [g.leagueId, g.pick!.picks.length ? g.pick!.picks : g.pick!.pick ? [g.pick!.pick] : []])));
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
    if (t.kind === "pool") return !!g && pickOpen(g) && (picks[g.leagueId]?.length ?? 0) < (g.pick?.each ?? 1);
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
      if (p && pickOpen(g) && chosen?.length && !sameSet(chosen, p.picks.length ? p.picks : p.pick ? [p.pick] : [])) {
        kinds.add("pick");
        jobs.push(() => write.pick(g.leagueId, p.epId, g.playerId, p.each > 1 ? chosen : chosen[0]));
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
    if (t.kind === "pool" && g)
      return (
        <PoolPanel
          g={g}
          chosen={picks[g.leagueId] ?? []}
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
  // Moves still open after their episode aired (a live game's, while you haven't watched it): said once for the sheet, since
  // watching an episode is across all your games.
  const lateMoves = play.filter((g) => g.late && (g.lineup?.episode === g.late.episode || g.pick?.episode === g.late.episode));
  return (
    <>
      {lateMoves.length > 0 && <OnYourHonour seasonId={seasonId} episode={lateMoves[0].late!.episode} many={lateMoves.length > 1} />}
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
      <p className="mt-2 text-center text-[13px] text-muted-foreground">
        Saving doesn&rsquo;t lock anything.{" "}
        {(() => {
          // Catching up, an episode locks when you reveal it, not at its airtime (it's aired already).
          const up = show.upNext?.number ?? Infinity;
          // A lineup that locks game by game: each player's own game does (not airtime, not a reveal).
          if (play.some((g) => g.lineup?.eachGame)) return "Each player locks when their game starts.";
          const eps = play.map((g) => g.lineup?.episode ?? g.pick?.episode).filter((n): n is number => Number.isInteger(n));
          const behind = eps.filter((n) => n < up).length;
          // A live game's episode that aired and you haven't watched (OnYourHonour): watching it is what locks it.
          if (lateMoves.length) return "Watching it does.";
          return !behind ? "Airtime does." : behind === eps.length ? "Revealing the episode does." : "Airtime does, or revealing an episode you’re catching up on.";
        })()}
      </p>
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

/**
 * A move still open after its episode aired (docs/PLAN-own-pace-games.md, "Pace is the game's setting": a live game's moves stay
 * open until you've watched). It runs on the honour system, so the sheet says it once, above its games (watching an episode is
 * across all of them), and gives whoever has watched the
 * honest way out: leave the move as it stood and reveal (the user, 2026-11-13). Nothing is saved by that: anything changed here and
 * not saved is dropped, and the reveal closes the move with what was there (a lineup carried in, a pick, or none).
 */
function OnYourHonour({ seasonId, episode, many }: { seasonId: string; episode: number; many: boolean }) {
  return (
    <div data-honour={episode} className="mb-3 rounded-[4px] bg-background p-3 outline-1 -outline-offset-1 outline-border">
      <b className="block text-[15px]">
        Episode {episode} has aired
      </b>
      <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
        {many ? "These are" : "It’s"} still open because you haven&rsquo;t watched it. Seen it already? Leave {many ? "them as they are" : "this as it is"}.
      </small>
      {/* A link, not the reveal opened in place: the reveal doesn't open over a game's own page (BACKLOG 66), and Tonight is where
          someone who has watched goes next anyway. */}
      <NavLink
        href={paths.reveal(seasonId, episode)}
        data-honour-watched
        onClick={() => closeMoves()}
        className="nd-press mt-1 inline-flex min-h-11 items-center text-[15px] font-bold underline decoration-border underline-offset-4"
      >
        I&rsquo;ve watched it
      </NavLink>
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
  // (Game by game: whoever's game has started stays where they are until the day's over; a tap says so rather than build a save
  // the server refuses.)
  const stuck = new Set(l.eachGame?.locked ?? []);
  const toggle = (id: string) => {
    if (stuck.has(id)) return toast.quiet(`${first(faceIn(g, id)?.name ?? "")}'s game has started: they stay ${starters.includes(id) ? "in" : "out"} until the day's over`);
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

function PoolPanel({ g, chosen, onPick }: { g: GameView; chosen: string[]; onPick: (id: string) => void }) {
  const p = g.pick;
  if (g.revealFirst) return <RevealFirst episode={g.revealFirst} what="who you can pick" />;
  if (!p) return <Note>No episode to pick for yet.</Note>;
  if (!p.open) {
    const names = (p.picks.length ? p.picks : p.pick ? [p.pick] : []).map((id) => faceIn(g, id)?.name).filter((n): n is string => !!n).map(first);
    return <Note>Picks are closed for Episode {p.episode}{names.length ? `: you picked ${names.join(", ")}` : ""}.</Note>;
  }
  if (!p.available.length) return <Note>Nobody&rsquo;s left you can pick for Episode {p.episode}.</Note>;
  const blocked = new Map(p.blocked.map((b) => [b.id, b]));
  const choices = g.cast.filter((c) => p.available.includes(c.id) || blocked.has(c.id));
  return (
    <>
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
      <div className="grid grid-cols-4 gap-2">
        {choices.map((c) => {
          const no = blocked.get(c.id);
          const on = chosen.includes(c.id);
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
