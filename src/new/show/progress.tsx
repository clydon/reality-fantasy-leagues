"use client";

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
import { AskConfirm, outWords, useCatchingUp } from "./behind-ask";
import { useOpenWatch } from "./watch-along";
import { paceReveal, usePaceReveal } from "./pace-plate";
import { stripState } from "./strip";

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
    else if (seen < aired) mark = `Through ${ep} ${seen} · ${aired - seen} behind`;
    else mark = `Through ${ep} ${seen}`;
  }
  let next: string | null = null;
  const t = up?.airAt ? Date.parse(up.airAt) : null;
  if (show.dropAt != null && show.dropAt > now) next = `Drops ${airTime(show.dropAt)}`;
  else if (up?.live) next = `${ep} ${up.number} · on air now`;
  else if (show.plays && show.episodes?.reveal) next = `${ep} ${show.episodes.reveal.episode} ${show.episodes.reveal.stage === "early" ? "early results are in" : "results are in"}`;
  else if (show.plays && show.episodes?.waiting) next = `${ep} ${show.episodes.waiting.episode} ${justAired(show.episodes.waiting.airAt) ? "just aired" : "aired"} · results soon`;
  else if (seen != null && seen < aired) next = aired - seen === 1 ? `${ep} ${aired} is out` : aired - seen === 2 ? `${ep} ${seen + 1} and ${aired} are out` : `${ep} ${seen + 1} to ${aired} are out`;
  else if (up && t != null) next = `${ep} ${up.number} · ${calmWhen(t, now)}`;
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

/** Tonight's control, at the foot of the tall show bar over the art. */
export function ProgressControl({ show }: { show: ShowData }) {
  const me = useMe();
  const up = show.upNext;
  const t = up?.airAt ? Date.parse(up.airAt) : null;
  const now = useNow((t != null && ticks(t)) || (show.dropAt != null && ticks(show.dropAt)));
  const words = progressWords(show, now);
  const action = watchAction(show);
  const openReveal = useOpenReveal();
  const openWatch = useOpenWatch();
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
  const openWhereAll = () => (couchId && seasonId ? openCouchSheet({ kind: "where", couchId, seasonId }) : openWhere(show));
  // Behind on an airing show, the control's line asks whether you've seen what's out (behind-ask.tsx: the user's pick B).
  const ep = show.words.ep;
  const latest = show.latestAired;
  // At your own pace being behind is the point: nothing to ask.
  const behind = !!action && action.kind !== "live" && action.kind !== "pace" && seen != null && seen < latest;
  const pace = paceReveal(show);
  const paced = usePaceReveal(show, pace);
  const [later, setLater] = useCatchingUp(seasonId, latest, show.notYet);
  const asking = behind && !later;
  const [askOpen, setAskOpen] = useState(false);
  const out = behind ? outWords(ep, seen!, latest) : "";
  if (behind && later) {
    words.mark = `Catching up · through ${ep} ${seen}`;
    words.next = `${ep} ${seen! + 1} next${latest > seen! + 1 ? ` · ${latest - seen! - 1} more out` : ""}`;
  }
  return (
    <div data-progress className="relative mx-2 mt-auto px-2 pt-3">
      {asking ? (
        <div className="flex items-center gap-3" data-ask-line>
          <button type="button" data-progress-mark onClick={() => openWhere(show)} className="nd-press -mx-1 min-h-11 min-w-0 flex-1 px-1 text-left">
            <b className="block text-[17px] font-bold leading-tight">Seen {out}?</b>
            <span className="mt-0.5 block text-[14px] leading-tight text-white/85">You&rsquo;re through {ep} {seen}</span>
          </button>
          <span className="flex flex-none gap-1.5">
            <button
              type="button"
              data-ask-yes
              onClick={() => setAskOpen(true)}
              className={`nd-press h-11 rounded-[4px] px-4 text-[15px] font-bold ${action!.primary ? "bg-chyron text-chyron-foreground" : "bg-plate text-plate-foreground"}`}
            >
              Yes
            </button>
            <button type="button" data-ask-later onClick={setLater} className="nd-press h-11 rounded-[4px] px-3 text-[15px] font-bold text-white outline-[1.5px] -outline-offset-[1.5px] outline-white/60">
              Not yet
            </button>
          </span>
        </div>
      ) : (
      <div className="flex items-baseline justify-between gap-3">
        {/* Your mark is one door (to Where you are, where it's changed): the line itself, with its chevron. */}
        <button
          type="button"
          data-progress-mark
          onClick={() => openWhere(show)}
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
          ep={show.words.ep}
          couch={onRuler}
          onOpen={openWhereAll}
        />
      )}
      {behind && later && (
        <div className="mt-3 flex">
          <PlateButton data-ask-watch onClick={() => openWatch(seen! + 1)} className="flex-none px-4">
            Watch {ep} {seen! + 1} along
          </PlateButton>
        </div>
      )}
      {action && !behind && (
        <div className="mt-3 flex gap-2">
          {action.kind === "reveal" ? (
            <PlateButton primary={action.primary} fill data-progress-reveal={action.n} onClick={() => setConfirm(true)}>
              Reveal {show.words.ep} {action.n}
              <small className="font-semibold opacity-75">every game</small>
            </PlateButton>
          ) : action.kind === "pace" && pace ? (
            <PlateButton primary={action.primary} fill data-progress-pace={action.n} disabled={paced.busy} onClick={paced.start} className="h-auto min-h-12 py-1.5">
              <span className="flex flex-col items-center leading-tight">
                <span className="whitespace-nowrap">{paced.busy ? "Revealing…" : `Reveal ${show.words.ep} ${action.n}`}</span>
                {!paced.busy && (pace.ahead || pace.games.length > 1) && (
                  <small data-progress-ahead className="text-[13px] font-semibold opacity-75">
                    {pace.ahead ?? `${pace.games.length} games`}
                  </small>
                )}
              </span>
            </PlateButton>
          ) : action.kind === "watched" ? (
            <PlateButton fill data-progress-watched={action.n} onClick={() => setConfirm(true)}>
              I watched {show.words.ep} {action.n}
            </PlateButton>
          ) : null}
          <PlateButton fill={action.kind === "live"} data-progress-watch={action.n} onClick={() => openWatch(action.n)}>
            Watch along
          </PlateButton>
        </div>
      )}
      {behind && seasonId && (
        <AskConfirm open={askOpen} onOpenChange={setAskOpen} show={show} seasonId={seasonId} seen={seen!} latest={latest} play={action!.kind === "reveal"} first={action!.n} onReveal={openReveal} />
      )}
      {paced.node}
      {action && !behind && (action.kind === "reveal" || action.kind === "watched") && seasonId && (
        <WatchedSheet open={confirm} onOpenChange={setConfirm} show={show} seasonId={seasonId} n={action.n} play={action.kind === "reveal"} onReveal={() => openReveal(action.n)} />
      )}
    </div>
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
  ep,
  couch,
  onOpen,
}: {
  known: Where[];
  quietCount: number;
  total: number;
  aired: number;
  next: number | null;
  live: number | null;
  ep: string;
  couch: boolean;
  onOpen: () => void;
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
  for (const n of [live, next, 1, ...Array.from({ length: total }, (_, i) => i + 1).filter((k) => k % every === 0), total, aired]) {
    if (n == null || n < 1 || n > total || chosen.includes(n)) continue;
    if (chosen.some((c) => Math.abs(c - n) < gap)) continue;
    chosen.push(n);
  }
  const labelled = (n: number) => chosen.includes(n);
  const you = known.find((w) => w.you);
  const label = [
    you ? `You're through ${ep} ${you.seen}` : null,
    ...known.filter((w) => !w.you).map((w) => `${w.name} ${w.seen}`),
    quietCount ? `${quietCount} not sharing` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const face = 28;
  // Faces at one mark overlap by 6 px, so each still reads as a person.
  const lift = (tall - 1) * 22;
  return (
    <button
      type="button"
      data-ruler
      onClick={onOpen}
      aria-label={`Where everyone is: ${label}`}
      className="nd-press -mx-1 mt-2 block w-[calc(100%+8px)] rounded-[4px] px-[18px] pb-1 text-left"
    >
      <span className="relative block" style={{ height: face + lift + 26 }} aria-hidden>
        {/* The track: the aired run solid, the rest faint; the next airing dashed, or live red. */}
        <span className="absolute inset-x-0 h-[3px] rounded-full bg-white/22" style={{ top: face + lift + 4 }} />
        <span className="absolute left-0 h-[3px] rounded-full bg-white/85" style={{ top: face + lift + 4, width: `${at(aired, total) * 100}%` }} />
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
                <small className={`type-num mt-0.5 block text-center text-[11px] leading-none ${isLive ? "font-bold text-live" : isNext ? "font-bold text-white" : n <= aired ? "text-white/80" : "text-white/55"}`}>
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
              style={{ left: `${(placed ? at(seen, total) : 0) * 100}%`, bottom: 26 }}
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
      {couch && (
        <span className="mt-1 flex items-center justify-end gap-1 text-[14px] font-semibold text-white/85">
          {quietCount ? `${quietCount} not sharing · ` : ""}Where everyone is
          <ChevronRight className="size-4" aria-hidden />
        </span>
      )}
    </button>
  );
}
