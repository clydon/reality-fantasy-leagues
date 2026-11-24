"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useAfterWatching, useAiredEpisodes, watching } from "../data";
import { dayDiff } from "../clock";
import { EpisodeLedger, type WhereSeason } from "../watching/where";
import { openWhere, type ShowData } from "../screens/show-space";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { showLabel } from "./react";
import { epName, type ShowWords } from "@/lib/game/show-words";

/** A run of episodes in a sentence: "Ep 9 to 12", a team's games by name ("Chiefs at Bills to Jets at Bills"). */
const runOf = (w: ShowWords, a: number, b: number) => (w.names ? `${epName(w, a, "short")} to ${epName(w, b, "short")}` : `${w.ep} ${a} to ${b}`);

// One episode at a time (the user, 2026-11-17: through Ep 8 with 9 and 10 out, "Seen Ep 9 and 10?" had no answer for "just 9", its
// Yes played Ep 10's recap and skipped 9's, and Not yet left no way to say 9 was seen). Behind on an airing show, Tonight's
// progress control asks about the next episode only, "Seen Ep 9?" with when it aired ("Aired Nov 7 · 2 out"), Yes and Not yet
// beside it (look A of three mocked, the user's pick). Yes opens the guard: Yes, Ep 9, or **Up to…** (the user's addition) for the
// picker: the episodes out with their air dates, then Recap Ep 9 to 12 (each in turn) or Skip to Ep 12 (its own only). Yes plays
// the recap of the episode you said; the recap's end offers the next (reveal.tsx); Back from it is Not yet; after Not yet the line
// keeps its shape, Seen Ep 9 (or Reveal Ep 9) and Watch along in the answers' places. The round: docs/design-round/step-through-*.md;
// the frames: scripts/dev-test/story-step-through.js; the check: scripts/dev-test/check-step-through.js.

/** When an episode aired, to tell it by (the user, 2026-11-17: "a real watcher isn't always counting episodes"): inside the last
 *  week the weekday ("Thu"), before that the date ("Nov 6"), as clock.ts's airedAt says it (a weekday alone reads as this week's);
 *  `long`, both ("Thu, Nov 6"). Null when the schedule doesn't know. */
export function airedOn(airAt: string | null | undefined, long = false, now = Date.now()): string | null {
  const t = airAt ? Date.parse(airAt) : NaN;
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  const year = d.getFullYear() !== new Date(now).getFullYear() ? { year: "numeric" as const } : {};
  if (long) return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", ...year });
  return Math.abs(dayDiff(t, now)) < 7 ? d.toLocaleDateString("en-US", { weekday: "short" }) : d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...year });
}

/** Each aired episode's air time by number, and the episodes themselves (the aired read: a date for every one, a title only up
 *  to your mark). */
export function useAirDates(seasonId: string | null) {
  const aired = useAiredEpisodes(seasonId);
  const episodes = aired.data?.episodes;
  return { episodes, of: (n: number) => episodes?.find((e) => e.number === n)?.airAt ?? null };
}

/** Your mark's door to Where you are (every episode, any boundary), under the question, with its chevron: the question itself is
 *  never the door (the round's critique: a door on the biggest words, with no sign it was one). */
function MarkDoor({ show, seen, text }: { show: ShowData; seen: number; text: string }) {
  return (
    <button
      type="button"
      data-progress-mark
      onClick={() => openWhere(show)}
      aria-label={`${text}. Through ${epName(show.words, seen, "short")}: where you are`}
      className="nd-press -mx-1 mt-0.5 flex min-h-8 max-w-full items-center gap-0.5 px-1 text-left text-[14px] leading-tight text-white/85"
    >
      <span className="truncate" data-fit>
        {text}
      </span>
      <ChevronRight className="size-3.5 flex-none" aria-hidden />
    </button>
  );
}

/** A button on the art: the one yellow (`primary`), a white plate (`plate`), or an outline in white. */
const onArt = (kind: "primary" | "plate" | "outline") =>
  kind === "primary"
    ? "bg-chyron text-chyron-foreground"
    : kind === "plate"
      ? "bg-plate text-plate-foreground"
      : "bg-[rgba(16,14,21,.55)] text-white outline-[1.5px] -outline-offset-[1.5px] outline-white/60 backdrop-blur-sm";

/** The control's line while behind: "Seen Ep 9?", when it aired and how many are out (the ruler's dashed run shows which), Yes
 *  (the one yellow only when the reveal holds it) and Not yet. */
export function StepLine({ show, seen, latest, primary, onYes, onLater }: { show: ShowData; seen: number; latest: number; primary: boolean; onYes: () => void; onLater: () => void }) {
  const next = seen + 1;
  const air = useAirDates(show.header?.seasonId ?? null);
  const aired = airedOn(air.of(next));
  const out = latest > next ? `${latest - seen} out` : null;
  const text = [aired ? `Aired ${aired}` : `Through ${epName(show.words, seen, "short")}`, out].filter(Boolean).join(" · ");
  return (
    <div className="flex items-center gap-3" data-ask-line>
      <div className="min-w-0 flex-1">
        <b className="type-caption block text-[26px] leading-[0.95]" data-step-question>
          Seen {epName(show.words, next, "short")}?
        </b>
        <MarkDoor show={show} seen={seen} text={text} />
      </div>
      <span className="flex flex-none gap-1.5">
        <button type="button" data-ask-yes onClick={onYes} className={`nd-press h-11 rounded-[4px] px-4 text-[15px] font-bold ${onArt(primary ? "primary" : "plate")}`}>
          Yes
        </button>
        <button type="button" data-ask-later onClick={onLater} className={`nd-press h-11 flex-none rounded-[4px] px-3 text-[15px] font-bold ${onArt("outline")}`}>
          Not yet
        </button>
      </span>
    </div>
  );
}

/** After Not yet: the line keeps its form, its answers in the same places: the next one's act where Yes was (Seen Ep 9, or Reveal
 *  Ep 9 on a show you play; the same guard), Watch along where Not yet was. No question any more, so no data-ask-line. */
export function StepLaterLine({ show, seen, play, primary, onYes, onWatch }: { show: ShowData; seen: number; play: boolean; primary: boolean; onYes: () => void; onWatch: () => void }) {
  const next = seen + 1;
  const air = useAirDates(show.header?.seasonId ?? null);
  const aired = airedOn(air.of(next));
  return (
    <div className="flex items-center gap-2" data-step-later-line>
      <div className="min-w-0 flex-1">
        <b className="block text-[17px] font-bold leading-tight">Catching up</b>
        <MarkDoor show={show} seen={seen} text={aired ? `${epName(show.words, next, "short")} aired ${aired}` : `Through ${epName(show.words, seen, "short")}`} />
      </div>
      <span className="flex flex-none gap-1.5">
        <button type="button" data-step-seen={next} onClick={onYes} className={`nd-press h-11 whitespace-nowrap rounded-[4px] px-2.5 text-[15px] font-bold ${onArt(primary ? "primary" : "plate")}`}>
          {play ? "Reveal" : "Seen"} {epName(show.words, next, "tag")}
        </button>
        <button type="button" data-ask-watch onClick={onWatch} className={`nd-press h-11 whitespace-nowrap rounded-[4px] px-2.5 text-[15px] font-bold ${onArt("outline")}`}>
          Watch along
        </button>
      </span>
    </div>
  );
}

/** The writes behind the guard. `start`: whose recap (or results) plays first: the next one, to recap them in turn, or `through`
 *  itself, to skip to it. On a show you play the reveal moves every game to the episode it plays (the server's reveal is forward to
 *  any episode out), and its end offers the next. On one you watch the mark moves to `through` (with Undo) first. */
function useStepTo(show: ShowData, seasonId: string, seen: number, play: boolean, onReveal: (n: number) => void) {
  const after = useAfterWatching();
  const [busy, setBusy] = useState(false);
  const go = async (through: number, start = seen + 1) => {
    if (play) return onReveal(start);
    if (busy) return;
    setBusy(true);
    try {
      await watching.follow(seasonId, { seenThrough: through });
      await after();
      toast(`You're through ${epName(show.words, through, "long")}`, {
        undo: async () => {
          await watching.follow(seasonId, { seenThrough: seen });
          await after();
        },
      });
      onReveal(start);
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { go, busy };
}

/**
 * The guard: the next episode named, with when it aired ("Seen Ep 9?" · aired Thu, Nov 6), and Yes for it. With more than one out,
 * **Up to…** beside Yes (the user, 2026-11-17: several behind but not live, without tapping through each) opens the picker in the
 * sheet: the episodes out as the ledger's rows, each with its air date; picking one past the next asks Recap Ep 9 to 12 (each in
 * turn) or Skip to Ep 12 (just its own). Used by the line, by the line after Not yet, and by Live keep-up's card (seen-it.tsx).
 */
export function StepGuard({
  open,
  onOpenChange,
  show,
  seasonId,
  seen,
  latest,
  play,
  onReveal,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  show: ShowData;
  seasonId: string;
  seen: number;
  latest: number;
  play: boolean;
  onReveal: (n: number) => void;
}) {
  const { go, busy } = useStepTo(show, seasonId, seen, play, onReveal);
  const air = useAirDates(open ? seasonId : null);
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState(seen);
  // Closed, it opens next time on the question, not the picker.
  const change = (o: boolean) => {
    if (!o) setPicking(false);
    onOpenChange(o);
  };
  const ep = show.words.ep;
  const next = seen + 1;
  const missed = show.moves
    .filter((m) => m.late && m.episode != null && m.episode <= (picking ? draft : next) && (m.kind === "lineup" || m.kind === "pick"))
    .map((m) => `Your ${epName(show.words, m.episode!, "short")} ${m.kind === "pick" ? "pick" : "lineup"} in ${m.leagueName} isn't in, so it counts as none.`);
  const finish = async (to: number, start?: number) => {
    change(false);
    await go(to, start);
  };
  const on = airedOn(air.of(next), true);
  const more = latest > next;
  return (
    <Sheet
      open={open}
      onOpenChange={change}
      title={picking ? "Seen up to which?" : `Seen ${epName(show.words, next, "short")}?`}
      subtitle={[showLabel(show), !picking && on ? `aired ${on}` : null].filter(Boolean).join(" · ")}
    >
      {picking ? (
        <div data-step-picker className="flex flex-col gap-2">
          {/* The ledger's own rows (Where you are's), from the first one out: number, air date, seen or not; a tap moves "You're
              here". A hairline at its foot: a long run scrolls, and a row cut by the edge mustn't run into the words under it. */}
          <div className="border-b border-border">
            <EpisodeLedger
              s={{ aired: latest, epWord: ep, episodeWord: show.words.episode, names: show.words.names } as WhereSeason}
              seen={draft}
              named={seen}
              episodes={air.episodes}
              from={next}
              onChange={(n) => setDraft(Math.max(seen, n))}
            />
          </div>
          {missed.map((m) => (
            <p key={m} className="text-[15px] leading-normal">
              {m}
            </p>
          ))}
          {draft <= seen ? (
            <p className="flex h-[52px] items-center justify-center text-[15px] text-muted-foreground">Tap the last one you&rsquo;ve seen</p>
          ) : draft === next ? (
            <Btn tone="ink" wide data-step-guard-yes disabled={busy} onClick={() => finish(next)}>
              Yes, {epName(show.words, next, "tag")}
            </Btn>
          ) : (
            <>
              <p className="text-[15px] leading-normal text-muted-foreground">
                {play
                  ? `${runOf(show.words, next, draft)}'s results: one at a time, or straight to ${epName(show.words, draft, "short")}'s. Your games move to ${epName(show.words, draft, "short")} either way.`
                  : `${runOf(show.words, next, draft)}: recap each in turn, or skip to ${epName(show.words, draft, "short")}'s.`}
              </p>
              <Btn tone="ink" wide data-step-recap disabled={busy} onClick={() => finish(draft, next)}>
                {play ? `Reveal ${runOf(show.words, next, draft)} in turn` : `Recap ${runOf(show.words, next, draft)}`}
              </Btn>
              <Btn wide data-step-skip disabled={busy} onClick={() => finish(draft, draft)}>
                Skip to {epName(show.words, draft, "tag")}
              </Btn>
            </>
          )}
          <button type="button" data-step-picker-back onClick={() => setPicking(false)} className="h-11 text-[15px] font-semibold text-muted-foreground">
            Back
          </button>
        </div>
      ) : (
        <div data-step-guard={next} className="flex flex-col gap-2">
          <p className="text-[15px] leading-normal text-muted-foreground">
            {play
              ? `${epName(show.words, next, "short")}'s results play next, every game at once.${more ? ` ${epName(show.words, next + 1, "short")}'s are there after it, when you want them.` : ""}`
              : `${epName(show.words, next, "short")}'s recap plays next: what happened, who left, the couch's GIFs.`}
          </p>
          {missed.map((m) => (
            <p key={m} className="text-[15px] leading-normal">
              {m}
            </p>
          ))}
          <div className="mt-2 flex gap-2">
            <Btn tone="ink" className="min-w-0 flex-1" data-step-guard-yes disabled={busy} onClick={() => finish(next)}>
              Yes, {epName(show.words, next, "tag")}
            </Btn>
            {more && (
              <Btn
                className="flex-none"
                data-step-guard-pick
                disabled={busy}
                onClick={() => {
                  setDraft(seen);
                  setPicking(true);
                }}
                aria-label={`Seen more than ${epName(show.words, next, "short")}? Pick the last one`}
              >
                Up to&hellip;
              </Btn>
            )}
          </div>
          <Btn wide data-step-guard-no className={more ? "bg-transparent outline-0" : ""} onClick={() => change(false)}>
            Not yet
          </Btn>
        </div>
      )}
    </Sheet>
  );
}

/** The watcher's recap's next (a show you only watch: the server's reveal has none): the next episode out, either seen already
 *  (said through it in the guard: play it) or still to say (ask, then play). Null with nothing out past this one. */
export function useWatcherNext(show: ShowData, n: number): { n: number; seen: boolean } | null {
  if (show.plays || show.readOnly) return null;
  const next = n + 1;
  if (next > show.latestAired) return null;
  return { n: next, seen: (show.seenThrough ?? 0) >= next };
}

/** The recap's end: `seen(n)` says the watcher's next is seen (the mark moves first: the server reads up to your mark);
 *  `later(aired)` is Back when you passed on the next one: Not yet, so Tonight doesn't ask again under your thumb. */
export function useStepEnd(seasonId: string) {
  const after = useAfterWatching();
  return {
    seen: async (n: number) => {
      await watching.follow(seasonId, { seenThrough: n });
      await after();
    },
    later: (aired: number) => {
      void watching
        .follow(seasonId, { notYet: aired })
        .then(() => after())
        .catch(() => {});
    },
  };
}
