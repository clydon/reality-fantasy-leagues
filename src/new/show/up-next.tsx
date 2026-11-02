"use client";

import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { ChevronRight, Users } from "lucide-react";
import { chatCouch, plansApi, useAfterWatching, useChatBadge, useWatchCard, watching } from "../data";
import { useFinalLine } from "../final-words";
import { useMe } from "../session";
import type { ShowData } from "../screens/show-space";
import { Avatar } from "../ui/bars";
import { usePushedPage } from "../ui/page";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { openPlan } from "../couch/watch-plans";
import { isRequired } from "./moves";
import { closeGif, showLabel } from "./react";
import { useOpenReveal } from "./reveal";
import { useOpenTogether, useOpenWatch } from "./watch-along";

// Up next for you (docs/PLAN-up-next.md; the user's pick A of the 2026-11-01 mocks, https://claude.ai/artifact/BcE68eG6VHXPQGy2PomGHv):
// the next episode you haven't watched, as one caption plate on Tonight. On a show you only watch, the next one that's aired past
// where you are: Watch along, I watched it. On one you play, the next one whose results are in: I watched it (the reveal), Watch
// along. "I watched it" always asks first ("Watched all of Episode 5?"), so a stray tap moves nothing: on a show you play Yes plays
// the reveal (its own slide asks for your GIF), on one you watch it moves where you are and opens the GIF sheet, with Undo. Ask the
// couch (on a couch with someone else on it): pick who, then Start now (a watch along that starts now: a push and a line in the
// couch chat, watch-plans.ts) or Pick a time (Plan a watch along). On a show you play it sits under Your moves, which keep the
// yellow; its tag is yellow only while nothing there is due.

/** The episode the plate is about, or null: on a show you play, the next one with results in (not one a catch-up game's strip
 *  reveals); on one you only watch, the next one that's aired past where you are (not while Live's Seen it? asks about it). */
export function upNextEpisode(show: ShowData): { n: number; play: boolean } | null {
  if (!show.header || show.readOnly || show.upNext?.live || show.dropAt != null) return null;
  if (show.plays) {
    const r = show.episodes?.reveal;
    if (!r || (show.play ?? []).some((g) => g.catchUp?.week === r.episode)) return null;
    return { n: r.episode, play: true };
  }
  if (!show.following || show.seenIt != null || show.seenThrough == null) return null;
  const n = show.seenThrough + 1;
  return n <= show.latestAired ? { n, play: false } : null;
}

// A move card's "Reveal Episode N" (Your moves, when a move waits on the reveal) asks the plate's question too: true when a plate
// for that episode took it.
const watchedAsks = new Set<(n: number) => boolean>();
export function askWatched(n: number): boolean {
  let took = false;
  watchedAsks.forEach((f) => (took = f(n) || took));
  return took;
}

/** "riley", "riley and jordan", "riley, jordan and sam". */
const namesLine = (names: string[]) => (names.length < 3 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

/** "riley has revealed", "riley and sam have revealed", "riley, sam and jordan have revealed". */
const revealedWords = (who: string[]) => `${namesLine(who)} ${who.length === 1 ? "has" : "have"} revealed`;

export function UpNext({ seasonId, show, below }: { seasonId: string; show: ShowData; below?: ReactNode }) {
  const me = useMe();
  const openReveal = useOpenReveal();
  const openWatch = useOpenWatch();
  const couchId = show.couch?.id ?? null;
  const card = useWatchCard(seasonId, couchId, !!show.header);
  const [confirm, setConfirm] = useState(false);
  const [asking, setAsking] = useState(false);
  const at = upNextEpisode(show);
  // Who the chat's reveal lines say has revealed it (the frame polls this with the Chat tab's badge).
  const revealed = useChatBadge(seasonId, chatCouch(show), at?.play ? at.n : null).data?.revealed ?? [];
  const finalWords = useFinalLine(show.episodes?.reveal?.stage, show.episodes?.reveal?.finalAt);
  const asked = at?.n ?? null;
  useEffect(() => {
    const take = (k: number) => {
      if (k !== asked) return false;
      setConfirm(true);
      return true;
    };
    watchedAsks.add(take);
    return () => {
      watchedAsks.delete(take);
    };
  }, [asked]);
  if (!at) return null;
  const { n, play } = at;
  const w = show.words;
  const seen = show.seenThrough ?? 0;
  const behind = Math.max(1, show.latestAired - seen);
  const early = play && show.episodes?.reveal?.stage === "early";
  // The couch where they share it: at your spot, and who's seen it already.
  const others = (show.people ?? []).filter((p) => p.userId !== me.id && (p.watching || p.playing.length));
  const here = others.filter((p) => p.seen === seen);
  const past = others.filter((p) => (p.seen ?? 0) >= n);
  // The couch's reactions waiting for you in its watch along (the card's read: your next episode's).
  const waiting = card.data?.episode === n ? card.data.count : 0;
  const due = show.moves.some(isRequired);
  const tag = play ? (behind > 1 ? `You're ${behind} behind` : early ? "Early results are in" : "Final results are in") : "Up next for you";
  const lines = [
    play
      ? early
        ? `Who went home, Survival Pool and Outlast. ${finalWords ? `${finalWords}.` : "Weekly Lineup's full scores come later."}`
        : behind > 1
          ? `You're up to ${w.episode} ${seen}. Its results are ready when you are.`
          : "Watched it? Your results are ready. Nothing shows until you say."
      : `You're up to ${w.episode} ${seen}${show.header?.episodeCount ? ` of ${show.header.episodeCount}` : ""}.`,
    revealed.length
      ? `${revealedWords(revealed)} · chat is folded for you`
      : here.length && !play
        ? `${namesLine(here.map((p) => p.name))} ${here.length > 1 ? "are" : "is"} at your spot`
        : past.length
          ? `${namesLine(past.map((p) => p.name).slice(0, 3))} ${past.length > 1 ? "have" : "has"} seen it${waiting ? ` · ${waiting} ${waiting === 1 ? "reaction waits" : "reactions wait"} in its watch along` : ""}`
          : null,
  ].filter(Boolean) as string[];
  const faces = (here.length && !play ? here : past).slice(0, 4);
  const watchIt = () => openWatch(n);
  const askLabel = !play && here.length ? `Ask ${namesLine(here.map((p) => p.name).slice(0, 2))} to watch it with you` : "Ask the couch to watch it with you";

  return (
    <section className="mt-[26px] px-4" data-up-next={n} data-up-next-kind={play ? "reveal" : "watch"} data-results-in={play ? n : undefined}>
      <div className="rounded-[4px] bg-plate px-4 pb-1.5 pt-4 text-plate-foreground shadow-plate">
        <span
          data-up-next-tag
          className={`type-caption tag-cut inline-block py-1 pl-2 pr-5 text-xs tracking-[0.06em] ${due ? "bg-[#ecebf1] text-plate-foreground" : "bg-chyron text-chyron-foreground"}`}
        >
          {tag}
        </span>
        <b className="type-caption mt-2.5 block text-[54px] leading-[.86]">
          {w.episode} {n}
        </b>
        {lines.map((l, i) => (
          <p key={l} data-revealed={i === 1 && revealed.length ? "" : undefined} className={`flex items-center gap-2 text-sm leading-snug text-plate-muted ${i ? "mt-1.5" : "mt-2.5"}`}>
            {i === 1 && faces.length > 0 && (
              <span className="flex flex-none pl-1" aria-hidden>
                {faces.map((p) => (
                  <span key={p.userId} className="-ml-1 rounded-[3px] shadow-[0_0_0_2px_var(--plate)]">
                    <Avatar id={p.userId} name={p.name} size={22} />
                  </span>
                ))}
              </span>
            )}
            <span>{l}</span>
          </p>
        ))}
        <div className="mt-3.5 flex gap-2">
          {play ? (
            <>
              <PlateBtn ink data-up-next-watched onClick={() => setConfirm(true)}>
                I watched it
              </PlateBtn>
              <PlateBtn data-up-next-watch onClick={watchIt}>
                Watch along
              </PlateBtn>
            </>
          ) : (
            <>
              <PlateBtn ink data-up-next-watch onClick={watchIt}>
                Watch along
              </PlateBtn>
              <PlateBtn data-up-next-watched onClick={() => setConfirm(true)}>
                I watched it
              </PlateBtn>
            </>
          )}
        </div>
        {!show.solo && couchId ? (
          <button
            type="button"
            data-up-next-ask
            onClick={() => setAsking(true)}
            className="mt-2.5 flex min-h-[50px] w-full items-center gap-2.5 border-t border-[#e1dfe8] text-left text-[15px] font-semibold"
          >
            <Users className="size-5 flex-none" aria-hidden />
            <span className="min-w-0 flex-1">{askLabel}</span>
            <ChevronRight className="size-[18px] flex-none text-plate-muted" aria-hidden />
          </button>
        ) : (
          <div className="h-2.5" />
        )}
      </div>
      {below}
      <WatchedSheet open={confirm} onOpenChange={setConfirm} show={show} seasonId={seasonId} n={n} play={play} onReveal={() => openReveal(n)} />
      {couchId && <AskSheet open={asking} onOpenChange={setAsking} show={show} seasonId={seasonId} couchId={couchId} n={n} />}
    </section>
  );
}

/** A button on the plate: ink (filled) or an outline in the plate's ink. */
function PlateBtn({ ink, className = "", ...props }: ComponentProps<"button"> & { ink?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={`nd-press flex h-[50px] items-center justify-center rounded-[4px] text-base font-bold ${
        ink ? "flex-[1.25] bg-plate-foreground text-plate" : "flex-1 outline-[1.5px] -outline-offset-[1.5px] outline-plate-foreground"
      } ${className}`}
    />
  );
}

// ---------- Watched all of it? ----------

function WatchedSheet({
  open,
  onOpenChange,
  show,
  seasonId,
  n,
  play,
  onReveal,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  show: ShowData;
  seasonId: string;
  n: number;
  play: boolean;
  onReveal: () => void;
}) {
  const after = useAfterWatching();
  const revealPage = usePushedPage("reveal", ["ep"]);
  const [busy, setBusy] = useState(false);
  const w = show.words;
  const yes = async () => {
    if (play) {
      onOpenChange(false);
      onReveal();
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      await watching.follow(seasonId, { seenThrough: n });
      await after();
      onOpenChange(false);
      toast(`You're up to ${w.episode} ${n}`, {
        undo: async () => {
          // Not watched after all: nothing about it stays open (its reveal, the GIF sheet over it).
          closeGif();
          if (new URLSearchParams(window.location.search).get("page") === "reveal") revealPage.close();
          await watching.follow(seasonId, { seenThrough: n - 1 });
          await after();
        },
      });
      // The reveal plays for a show you watch too (the user, 2026-11-02): its write-up, who went home if anyone did, and the
      // couch's GIFs with yours to add; with nothing it can read, the reveal opens the GIF sheet instead.
      onReveal();
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={`Watched all of ${w.episode} ${n}?`} subtitle={showLabel(show)}>
      <p data-watched-sheet={n} className="text-[15px] leading-normal text-muted-foreground">
        {play
          ? "Its results play next: who went home, the couch's GIFs, then your games. Nothing shows until you say yes."
          : "What happened in it, the couch's chat and their GIFs for it will show. Picked the wrong one? Move back any time in Where you are."}
      </p>
      <Btn tone="ink" wide className="mt-4" data-watched-yes disabled={busy} onClick={yes}>
        {play ? "Yes, show me" : "Yes, I watched it"}
      </Btn>
      <Btn wide className="mt-2" data-watched-no onClick={() => onOpenChange(false)}>
        Not yet
      </Btn>
    </Sheet>
  );
}

// ---------- Ask the couch ----------

function AskSheet({ open, onOpenChange, show, seasonId, couchId, n }: { open: boolean; onOpenChange: (o: boolean) => void; show: ShowData; seasonId: string; couchId: string; n: number }) {
  const me = useMe();
  const openTogether = useOpenTogether();
  const w = show.words;
  const seen = show.seenThrough ?? 0;
  // Everyone else on the couch, those at your spot first and picked, then who's seen it (they might watch it again), then the rest.
  const people = (show.couch?.members ?? [])
    .filter((m) => m.userId !== me.id)
    .map((m) => {
      const p = (show.people ?? []).find((x) => x.userId === m.userId);
      const at = p?.seen ?? null;
      const line =
        at == null
          ? p?.watching || p?.playing.length
            ? "Watches it"
            : "Not on their shows yet"
          : at === seen
            ? `At your spot · up to ${w.ep} ${at}`
            : at >= n
              ? `Has seen it · up to ${w.ep} ${at}`
              : `Up to ${w.ep} ${at}`;
      return { userId: m.userId, name: m.name, at, line, rank: at === seen ? 0 : at != null && at >= n ? 1 : 2 };
    })
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  const [picked, setPicked] = useState<string[] | null>(null);
  const chosen = picked ?? people.filter((p) => p.rank === 0).map((p) => p.userId);
  const [busy, setBusy] = useState(false);
  const toggle = (id: string) => setPicked(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]);
  const now = async () => {
    if (busy || !chosen.length) return;
    setBusy(true);
    try {
      const r = await plansApi.plan(seasonId, couchId, { episode: n, how: "start", startsAt: new Date().toISOString(), invite: chosen, now: true });
      onOpenChange(false);
      setPicked(null);
      toast(`Asked ${r.told === 1 ? (people.find((p) => p.userId === chosen[0])?.name ?? "them") : `${r.told} people`} · starting ${w.episode} ${n}`);
      openTogether({ seasonId, episode: n, id: r.plan.id });
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const names = people.filter((p) => chosen.includes(p.userId)).map((p) => p.name);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={`Watch ${w.episode} ${n} with…`} subtitle={`${showLabel(show)} · you're up to ${w.ep} ${seen}`}>
      <div data-ask-sheet={n} className="flex flex-col">
        {people.map((p) => {
          const on = chosen.includes(p.userId);
          return (
            <button
              key={p.userId}
              type="button"
              role="checkbox"
              aria-checked={on}
              data-ask-person={p.name}
              onClick={() => toggle(p.userId)}
              className="flex min-h-[60px] items-center gap-3 border-t border-border py-2 text-left first:border-t-0"
            >
              <Avatar id={p.userId} name={p.name} size={36} />
              <span className="min-w-0 flex-1">
                <b className="block text-base font-semibold">{p.name}</b>
                <small className="block text-[13px] text-muted-foreground">{p.line}</small>
              </span>
              <span className={`grid size-6 flex-none place-items-center rounded-[4px] ${on ? "bg-foreground text-background" : "outline-2 -outline-offset-2 outline-input"}`} aria-hidden>
                {on && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[13px] leading-snug text-muted-foreground">
        Start now: {names.length ? namesLine(names.slice(0, 3)) : "they"} get a notification and a line in the couch chat, and the watch along opens with
        you in it.
      </p>
      <Btn tone="ink" wide className="mt-3" data-ask-now disabled={busy || !chosen.length} onClick={now}>
        {chosen.length ? `Start now and ask ${names.length === 1 ? names[0] : `${names.length} people`}` : "Pick someone"}
      </Btn>
      <Btn
        wide
        className="mt-2"
        data-ask-later
        onClick={() => {
          onOpenChange(false);
          openPlan({ kind: "new", seasonId, couchId, episode: n });
        }}
      >
        Pick a time instead
      </Btn>
    </Sheet>
  );
}
