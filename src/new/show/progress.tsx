"use client";

import { epName } from "@/lib/game/show-words";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { airTime, calmWhen, justAired, ticks } from "../clock";
import { openCouchSheet } from "../couch/couch-sheets";
import { knownMark, marksOf, type Where } from "../couch/where";
import { episodesOf, openWhere, seasonOver, type ShowData } from "../screens/show-space";
import { useMe } from "../session";
import { Avatar, useNow } from "../ui/bars";
import { isRequired } from "./moves";
import { useOpenReveal } from "./reveal";
import { upNextEpisode, WatchedSheet } from "./up-next";
import { useCatchingUp } from "./behind-ask";
import { useOpenWatch } from "./watch-along";
import { paceReveal, usePaceReveal } from "./pace-plate";
import { stripState, WatchLockSheet } from "./strip";
import { openMoves } from "./moves";
import { useLockIn, windowEpisode } from "./strip-night";
import { StepGuard, StepLaterLine, StepLine } from "./step-through";

// The progress control (the design round's step 3: docs/design-round/step3-tonight-spec.md, "Two parts every show tab shares";
// Phase 0's decision 3): the show's one statement of where you are. Your mark and what's next in one line, the couch on one
// episode scale (data round 3's shared axis, compact), and the one watching action there is now: Reveal Ep N (every game at
// once), I watched it, or Watch along. It replaces the bar's chip, the couch line's numbered faces, Up next's plate and the phase
// heading. The reveal is yellow only while nothing is due (the strip holds the yellow then).

export interface ProgressWords {
  /** "Through Ep 4", "Through Ep 3 · 2 behind", "Not started", "You finished it"; null when your mark isn't yours to show. */
  mark: string | null;
  /** What's next, once: "Ep 5 · Sun 8:00 PM · in 2 days", "Ep 5 · on air now", "Ep 5 results are in", "Ep 4 and 5 are out". */
  next: string | null;
  live: boolean;
}

/** The control's words, from the show as Tonight reads it. Pure but for the clock (`now`). */
export function progressWords(show: ShowData, now: number): ProgressWords {
  const ep = show.words.ep;
  const seen = knownMark(show);
  const total = episodesOf(show);
  const aired = show.latestAired;
  const up = show.upNext;
  let mark: string | null = null;
  if (seen != null) {
    if (seen <= 0) mark = "Not started";
    else if (show.ownPace && total > 0 && seen >= total) mark = "You finished it";
    else if (seen < aired) mark = `Through ${epName(show.words, seen, "short")} · ${aired - seen} behind`;
    else mark = `Through ${epName(show.words, seen, "short")}`;
  }
  let next: string | null = null;
  const t = up?.airAt ? Date.parse(up.airAt) : null;
  if (show.dropAt != null && show.dropAt > now) next = `Drops ${airTime(show.dropAt)}`;
  else if (up?.live) next = `${epName(show.words, up.number, "tag")} · on air now`;
  else if (show.plays && show.episodes?.reveal) next = `${epName(show.words, show.episodes.reveal.episode, "short")} ${show.episodes.reveal.stage === "early" ? "early results are in" : "results are in"}`;
  else if (show.plays && show.episodes?.waiting) next = `${epName(show.words, show.episodes.waiting.episode, "short")} ${justAired(show.episodes.waiting.airAt) ? "just aired" : "aired"} · results soon`;
  else if (seen != null && seen < aired) next = aired - seen === 1 ? `${epName(show.words, aired, "short")} is out` : aired - seen === 2 ? `${ep} ${seen + 1} and ${aired} are out` : `${ep} ${seen + 1} to ${aired} are out`;
  else if (up && t != null) next = `${epName(show.words, up.number, "tag")} · ${calmWhen(t, now)}`;
  else if (show.ownPace && !up && total > 0 && (seen ?? 0) < total) next = `All ${total} are out`;
  else if (seasonOver(show)) next = "Season over";
  return { mark, next, live: !!up?.live };
}

/** The one watching action there is now, or null: the reveal on a show you play, I watched it on one you watch, the next
 *  episode of your games at your own pace (pace-plate.tsx paceReveal: the plate folded in, the user's call 2026-11-15), or Watch
 *  along while it's on. `primary`: it holds the view's one yellow: a reveal while nothing is due, or while everything due waits on it
 *  (the strip is quiet then: "After you reveal Ep 4"). */
export function watchAction(show: ShowData): { kind: "reveal" | "watched" | "pace" | "live"; n: number; primary: boolean } | null {
  if (show.readOnly) return null;
  const up = upNextEpisode(show);
  const waits = (m: ShowData["moves"][number]) => !m.late && (show.play?.find((g) => g.leagueId === m.leagueId)?.revealFirst ?? null) != null;
  if (up) return { kind: up.play ? "reveal" : "watched", n: up.n, primary: up.play && show.moves.filter(isRequired).every(waits) };
  // At your own pace: yellow once your move for it is in, nothing else is due, and no waiver moment asks you to wait.
  const pace = paceReveal(show);
  if (pace) return { kind: "pace", n: pace.n, primary: pace.moved && !pace.waits && stripState(show)?.tone !== "due" };
  if (show.upNext?.live && (show.following || show.plays)) return { kind: "live", n: show.upNext.number, primary: false };
  return null;
}

/** Where each mark sits on the ruler, as a share of its width: 0 is "not started", `of` the last episode. */
const at = (seen: number, of: number) => (of <= 0 ? 0 : Math.min(1, Math.max(0, seen / of)));

/** Tonight's control, at the foot of the tall show bar over the art; `compact`, every other tab's line under the bar (step 3's
 *  spec, "On the other tabs it is the compact bar's line"; built in step 4): your mark and the one watching action, no ruler, no
 *  question (Tonight asks it). It replaces the spoiler line ("Spoiler-safe · you're up to Ep 3 · Change") and the bar's chip. */
export function ProgressControl({ show, compact }: { show: ShowData; compact?: boolean }) {
  const me = useMe();
  const up = show.upNext;
  const t = up?.airAt ? Date.parse(up.airAt) : null;
  const now = useNow((t != null && ticks(t)) || (show.dropAt != null && ticks(show.dropAt)));
  const words = progressWords(show, now);
  const action = watchAction(show);
  const openReveal = useOpenReveal();
  const openWatch = useOpenWatch();
  // Episode night (strip-night.ts): Watch along is watching, so while your moves for the episode on air are open it says first that
  // starting locks them (the server's lock; once locked in there's no window, so it just opens).
  const nightEp = windowEpisode(show);
  const lock = useLockIn(show.header?.seasonId ?? "");
  const [watchAsk, setWatchAsk] = useState<number | null>(null);
  const startWatch = (n: number) => (nightEp === n && show.upNext?.live ? setWatchAsk(n) : openWatch(n));
  const watchLock = watchAsk != null && (
    <WatchLockSheet
      show={show}
      n={watchAsk}
      open
      onOpenChange={(o) => !o && setWatchAsk(null)}
      onStart={() => {
        const n = watchAsk;
        setWatchAsk(null);
        void lock(n, `Locked in for ${epName(show.words, n)}. Enjoy the episode.`).then(() => openWatch(n));
      }}
      onChange={() => {
        const lead = stripState(show)?.open;
        setWatchAsk(null);
        openMoves(lead?.tab ?? "lineup", lead?.leagueId ?? null);
      }}
    />
  );
  const [confirm, setConfirm] = useState(false);
  const seasonId = show.header?.seasonId ?? "";
  const couchId = show.readOnly ? null : (show.couch?.id ?? null);
  const seen = knownMark(show);
  const { known, quiet } = marksOf(show.people, { id: me.id, name: me.name, seen });
  // The ruler: every episode the season has (or what's aired, and the next one), the aired run solid.
  const total = Math.max(episodesOf(show), show.latestAired + (up ? 1 : 0), seen ?? 0, 1);
  const aired = Math.min(show.latestAired, total);
  const others = known.filter((w) => !w.you).length;
  const onRuler = !show.solo && (others > 0 || quiet.length > 0);
  const ruler = known.length > 0 && show.latestAired + (up ? 1 : 0) > 0;
  const openWhereAll = () => (couchId && seasonId ? openCouchSheet({ kind: "where", couchId, seasonId }) : openWhere(show, openReveal));
  // Behind on an airing show, the control's line asks about the next episode (step-through.tsx: one at a time, the user's pick A).
  const latest = show.latestAired;
  // At your own pace being behind is the point: nothing to ask.
  const behind = !!action && action.kind !== "live" && action.kind !== "pace" && seen != null && seen < latest;
  const pace = paceReveal(show);
  const paced = usePaceReveal(show, pace);
  const [later, setLater] = useCatchingUp(seasonId, latest, show.notYet);
  const asking = behind && !later;
  // The guard (Yes, or after Not yet the line's Seen Ep N): the next episode named, Up to… for more.
  const [guard, setGuard] = useState(false);
  if (compact) {
    // One action, the same one the tall control has (the behind question's Yes is the reveal's own ask here).
    const act =
      action?.kind === "pace" && pace ? (
        <SmallButton primary={action.primary} data-progress-pace={action.n} disabled={paced.busy} onClick={paced.start}>
          {paced.busy ? "Revealing…" : `Reveal ${epName(show.words, action.n, "short")}`}
        </SmallButton>
      ) : action?.kind === "reveal" ? (
        <SmallButton primary={action.primary || behind} data-progress-reveal={action.n} onClick={() => setConfirm(true)}>
          Reveal {epName(show.words, action.n, "short")}
        </SmallButton>
      ) : action?.kind === "watched" ? (
        <SmallButton data-progress-watched={action.n} onClick={() => setConfirm(true)}>
          I watched {epName(show.words, action.n, "short")}
        </SmallButton>
      ) : action?.kind === "live" ? (
        <SmallButton data-progress-watch={action.n} onClick={() => startWatch(action.n)}>
          Watch along
        </SmallButton>
      ) : null;
    return (
      <div data-progress data-progress-compact className="dark flex items-center gap-3 border-b border-border bg-background px-4 py-2 text-foreground">
        <button
          type="button"
          data-progress-mark
          onClick={() => openWhere(show, openReveal)}
          aria-label={words.mark ? `${words.mark}: change where you are` : "Where you are"}
          className="nd-press -mx-1 flex min-h-11 min-w-0 flex-1 items-center gap-1 px-1 text-left"
        >
          <span className="min-w-0">
            {/* No mark (results show as they come: a sport by default): what's next is the line. */}
            <b className="block truncate text-[15px] font-bold leading-tight">{words.mark ?? words.next ?? "Where you are"}</b>
            {words.mark && words.next && (
              <span data-progress-next className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] leading-tight text-muted-foreground">
                {words.live && <i className="size-2 flex-none animate-pulse rounded-full bg-live" aria-hidden />}
                {words.next}
              </span>
            )}
          </span>
          <ChevronRight className="size-4 flex-none text-muted-foreground" aria-hidden />
        </button>
        {act}
        {paced.node}
        {watchLock}
        {action && (action.kind === "reveal" || action.kind === "watched") && seasonId && (
          <WatchedSheet open={confirm} onOpenChange={setConfirm} show={show} seasonId={seasonId} n={action.n} play={action.kind === "reveal"} onReveal={() => openReveal(action.n)} />
        )}
      </div>
    );
  }
  return (
    <div data-progress className="relative mx-2 mt-auto px-2 pt-3">
      {asking ? (
        <StepLine show={show} seen={seen!} latest={latest} primary={action!.primary} onYes={() => setGuard(true)} onLater={setLater} />
      ) : behind && later ? (
        <StepLaterLine show={show} seen={seen!} play={action!.kind === "reveal"} primary={action!.primary} onYes={() => setGuard(true)} onWatch={() => openWatch(seen! + 1)} />
      ) : (
      <div className="flex items-baseline justify-between gap-3">
        {/* Your mark is one door (to Where you are, where it's changed): the line itself, with its chevron. */}
        <button
          type="button"
          data-progress-mark
          onClick={() => openWhere(show, openReveal)}
          aria-label={words.mark ? `${words.mark}: change where you are` : undefined}
          disabled={!words.mark}
          className="nd-press -mx-1 flex min-h-11 min-w-0 items-center gap-1.5 px-1 text-left"
        >
          <span className="min-w-0">
            {words.mark && <b className="block text-[16px] font-bold leading-tight">{words.mark}</b>}
            {words.next && (
              <span data-progress-next className="mt-0.5 flex items-center gap-1.5 text-[14px] leading-tight text-white/85">
                {words.live && <i className="size-2 flex-none animate-pulse rounded-full bg-live" aria-hidden />}
                {words.next}
              </span>
            )}
          </span>
          {words.mark && <ChevronRight className="size-[18px] flex-none self-start text-white/85" aria-hidden />}
        </button>
      </div>
      )}
      {ruler && (
        <Ruler
          known={known}
          quietCount={quiet.length}
          total={total}
          aired={aired}
          next={up && !up.live && up.number <= total ? up.number : null}
          live={up?.live ? up.number : null}
          words={show.words}
          couch={onRuler}
          onOpen={openWhereAll}
          mine={behind ? seen : null}
        />
      )}
      {action && !behind && (
        <div className="mt-3 flex gap-2">
          {action.kind === "reveal" ? (
            <PlateButton primary={action.primary} fill data-progress-reveal={action.n} onClick={() => setConfirm(true)}>
              Reveal {epName(show.words, action.n, "short")}
              <small className="font-semibold opacity-75">every game</small>
            </PlateButton>
          ) : action.kind === "pace" && pace ? (
            <PlateButton primary={action.primary} fill data-progress-pace={action.n} disabled={paced.busy} onClick={paced.start} className="h-auto min-h-12 py-1.5">
              <span className="flex flex-col items-center leading-tight">
                <span className="whitespace-nowrap">{paced.busy ? "Revealing…" : `Reveal ${epName(show.words, action.n, "short")}`}</span>
                {!paced.busy && (pace.ahead || pace.games.length > 1) && (
                  <small data-progress-ahead className="text-[13px] font-semibold opacity-75">
                    {pace.ahead ?? `${pace.games.length} games`}
                  </small>
                )}
              </span>
            </PlateButton>
          ) : action.kind === "watched" ? (
            <PlateButton fill data-progress-watched={action.n} onClick={() => setConfirm(true)}>
              I watched {epName(show.words, action.n, "short")}
            </PlateButton>
          ) : null}
          <PlateButton fill={action.kind === "live"} data-progress-watch={action.n} onClick={() => startWatch(action.n)}>
            Watch along
          </PlateButton>
        </div>
      )}
      {behind && seasonId && (
        <StepGuard open={guard} onOpenChange={setGuard} show={show} seasonId={seasonId} seen={seen!} latest={latest} play={action!.kind === "reveal"} onReveal={openReveal} />
      )}
      {paced.node}
      {watchLock}
      {action && !behind && (action.kind === "reveal" || action.kind === "watched") && seasonId && (
        <WatchedSheet open={confirm} onOpenChange={setConfirm} show={show} seasonId={seasonId} n={action.n} play={action.kind === "reveal"} onReveal={() => openReveal(action.n)} />
      )}
    </div>
  );
}

/** The compact line's one action: the one yellow (`primary`), else a white outline. */
function SmallButton({ primary, className = "", children, ...props }: React.ComponentProps<"button"> & { primary?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={`nd-press flex h-10 flex-none items-center whitespace-nowrap rounded-[3px] px-3.5 text-[15px] font-bold ${
        primary ? "bg-chyron text-chyron-foreground" : "text-foreground outline-[1.5px] -outline-offset-[1.5px] outline-foreground/60"
      } ${className}`}
    >
      {children}
    </button>
  );
}

/** A button on the art: the one yellow (`primary`), a white plate (`fill`), or an outline in white. */
function PlateButton({ primary, fill, className = "", children, ...props }: React.ComponentProps<"button"> & { primary?: boolean; fill?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={`nd-press flex h-12 items-center justify-center gap-2 rounded-[4px] px-3 text-[16px] font-bold ${
        primary ? "flex-[1.4] bg-chyron text-chyron-foreground" : fill ? "flex-[1.4] bg-plate text-plate-foreground" : "flex-1 bg-[rgba(16,14,21,.55)] text-white outline-[1.5px] -outline-offset-[1.5px] outline-white/70 backdrop-blur-sm"
      } ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * The season as a ruler: an episode a tick, the aired run solid, the next airing dashed (or live, red), each person's face standing
 * on the last episode they've seen, you ringed. Who plays here without sharing their place is a count at the end. The whole ruler
 * opens where everyone is (each person's row opens their own sheet there). On entry the faces walk from the start to their marks.
 */
function Ruler({
  known,
  quietCount,
  total,
  aired,
  next,
  live,
  words,
  couch,
  onOpen,
  mine = null,
}: {
  known: Where[];
  quietCount: number;
  total: number;
  aired: number;
  next: number | null;
  live: number | null;
  words: ShowData["words"];
  couch: boolean;
  onOpen: () => void;
  /** Your mark while behind (step-through.tsx): the run from it to the latest aired is drawn dashed (out, unseen). */
  mine?: number | null;
}) {
  const [placed, setPlaced] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setPlaced(true));
    return () => cancelAnimationFrame(id);
  }, []);
  // Faces at one mark stand in a column: you at the foot, at most three, then "+n".
  const byMark = new Map<number, Where[]>();
  for (const w of known) byMark.set(w.seen, [...(byMark.get(w.seen) ?? []), w]);
  const stacks = [...byMark.entries()].map(([seen, people]) => ({ seen, people: [...people.filter((p) => p.you), ...people.filter((p) => !p.you)] }));
  const tall = Math.min(4, Math.max(...stacks.map((s) => s.people.length)));
  // Which ticks carry a number: the live or next one first, then the first and every second or fifth (an even run), then the last
  // and the latest aired, each kept only with room beside the ones already chosen (a 31-episode season's 30 and 31 never touch).
  const every = total > 14 ? 5 : total > 8 ? 2 : 1;
  const gap = Math.max(1, Math.ceil(total / 9));
  const chosen: number[] = [];
  // Behind: the first out episode carries its number, before the rest are spaced around it.
  for (const n of [live, next, mine != null && mine < aired ? mine + 1 : null, 1, ...Array.from({ length: total }, (_, i) => i + 1).filter((k) => k % every === 0), total, aired]) {
    if (n == null || n < 1 || n > total || chosen.includes(n)) continue;
    if (chosen.some((c) => Math.abs(c - n) < gap)) continue;
    chosen.push(n);
  }
  const labelled = (n: number) => chosen.includes(n);
  const you = known.find((w) => w.you);
  const label = [
    you ? `You're through ${epName(words, you.seen, "short")}` : null,
    ...known.filter((w) => !w.you).map((w) => `${w.name} ${w.seen}`),
    quietCount ? `${quietCount} not sharing` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const face = 28;
  // Faces at one mark overlap by 6 px, so each still reads as a person.
  const lift = (tall - 1) * 22;
  const top = face + lift + 4;
  const out = (n: number) => mine != null && n > mine && n <= aired;
  const body = (
    <span className="relative block" style={{ height: face + lift + 26 }} aria-hidden>
      {/* The track: the aired run solid, the rest faint; the next airing dashed, or live red. Behind: solid only to your
          mark, the run out past it dashed bright: what's out and unseen, seen at a glance (the first-view requirements' R2). */}
      <span className="absolute inset-x-0 h-[3px] rounded-full bg-white/22" style={{ top }} />
      <span className="absolute left-0 h-[3px] rounded-full bg-white/85" style={{ top, width: `${at(mine ?? aired, total) * 100}%` }} />
      {mine != null && mine < aired && (
        <span
          data-ruler-out
          className="absolute h-0 border-t-[3px] border-dashed border-white"
          style={{ top, left: `${at(mine, total) * 100}%`, width: `${(at(aired, total) - at(mine, total)) * 100}%` }}
        />
      )}
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => {
        const x = at(n, total) * 100;
        const isNext = n === next;
        const isLive = n === live;
        return (
          <span key={n} className="absolute -translate-x-1/2" style={{ left: `${x}%`, top: face + lift }}>
            <i
              className={`mx-auto block w-px ${isLive ? "h-[11px] w-[3px] bg-live" : isNext ? "h-[11px] border-l-2 border-dashed border-white" : n <= aired ? "h-[11px] bg-white/85" : "h-[7px] mt-[2px] bg-white/35"}`}
            />
            {labelled(n) && (
              <small className={`type-num mt-0.5 block text-center text-[11px] leading-none ${isLive ? "font-bold text-live" : isNext ? "font-bold text-white" : out(n) ? "font-bold text-white" : n <= aired ? "text-white/80" : "text-white/55"}`}>
                {n}
              </small>
            )}
          </span>
        );
      })}
      {stacks.map(({ seen, people }) => {
        const shown = people.slice(0, 3);
        const more = people.length - shown.length;
        return (
          <span
            key={seen}
            data-ruler-mark={seen}
            className="absolute flex -translate-x-1/2 flex-col-reverse items-center transition-[left] duration-[320ms] ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none"
            // Yours stands in front: on a long season the next mark's faces sit over it otherwise (the critique).
            style={{ left: `${(placed ? at(seen, total) : 0) * 100}%`, bottom: 26, zIndex: people.some((p) => p.you) ? 2 : 1 }}
          >
            {shown.map((w, i) => (
              <span
                key={w.userId}
                data-ruler-face={w.you ? "you" : w.name}
                className={`rounded-[4px] shadow-[0_2px_6px_rgba(0,0,0,.45)] ${w.you ? "outline-2 outline-offset-1 outline-white" : ""} ${i ? "-mb-1.5" : ""}`}
                style={{ zIndex: 10 - i }}
              >
                <Avatar id={w.userId} name={w.name} size={face} />
              </span>
            ))}
            {more > 0 && (
              <span className="type-num -mb-1.5 grid size-7 place-items-center rounded-[4px] bg-[rgba(16,14,21,.85)] text-[11px] font-bold text-white">+{more}</span>
            )}
          </span>
        );
      })}
    </span>
  );
  const everyone = couch && (
    <>
      {quietCount ? `${quietCount} not sharing · ` : ""}Where everyone is
      <ChevronRight className="size-4" aria-hidden />
    </>
  );
  return (
    <button
      type="button"
      data-ruler
      onClick={onOpen}
      aria-label={`Where everyone is: ${label}`}
      className="nd-press -mx-1 mt-2 block w-[calc(100%+8px)] rounded-[4px] px-[18px] pb-1 text-left"
    >
      {body}
      {couch && <span className="mt-1 flex items-center justify-end gap-1 text-[14px] font-semibold text-white/85">{everyone}</span>}
    </button>
  );
}
