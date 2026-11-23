"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChevronRight } from "lucide-react";
import { useCurrentCouch, useHome, useWizardOptions, type HomeShow } from "../data";
import { useNav } from "../nav";
import { paths } from "../routes";
import { PracticeStrip, shake } from "../tour/practice";
import { Sheet } from "../ui/sheet";
import { ShowArt } from "../ui/show-bar";
import { toast } from "../ui/toast";
import { setReopen } from "./gallery-bold/ai-jobs";
import { BoldSheet } from "./gallery-bold/bold-sheet";

// Start a game (docs/PLAN-start-a-game-redo.md B1: the bold gallery, gallery-bold/, for every start), opened from anywhere signed in
// with openStartGame:
//   - with a season: the gallery on it (Choose a game, Set it up, Start), whatever the season's state: still airing, aired (at your
//     own pace), a sport's, the episode on now;
//   - without one (the hub's foot, Commercial break, Get the couch going with nothing to suggest): Pick the show first, from your
//     shows still airing; one that isn't a game yet goes to Make it a game;
//   - `again` (Run it back): the same game, its rules and name, reopened on its screen for the show's next season;
//   - `practice` (the first-time tour's): the same sheet with a Practice strip, the show the tour practice-added first in Pick the
//     show, and Start ending in the practice finish: nothing is started.
// Starting it opens the game's own page.

/** The tour's practice: the show to offer first (the one it practice-added; not on your list), and what to do once it closes. */
export type StartPractice = { seasonId: string | null; label: string | null; artUrl: string | null; onClose: () => void };

export type StartTarget = {
  seasonId?: string | null;
  couchId?: string | null;
  again?: string | null;
  practice?: StartPractice;
  /** The sheet's view to open on (Describe's See it: "describe"). */
  screen?: "describe";
  /** How long a game starts out: "next" for just the next episode or game (a team's Next game), "season" for the season where a game
   *  can run it (a team's Their season), else each game's own default. */
  length?: "next" | "season" | null;
  /** C4 (solo): open straight on one of the gallery's games (its base's id), with this many computer players in it. */
  base?: string | null;
  bots?: number | null;
};

type Store = { target: StartTarget | null; n: number };
let store: Store = { target: null, n: 0 };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const SERVER: Store = { target: null, n: 0 };

/** Open Start a game: for a season, or Pick the show first. */
export function openStartGame(target: StartTarget = {}) {
  store = { ...store, target: null };
  emit();
  setTimeout(() => {
    store = { target, n: store.n + 1 };
    emit();
  }, 30);
}

const close = () => {
  store = { ...store, target: null };
  emit();
};

function useStartTarget(): Store {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => store,
    () => SERVER
  );
}

/** The sheets' host, in the signed-in layout. */
export function StartGameSheets() {
  const { target, n } = useStartTarget();
  const onOpenChange = (o: boolean) => {
    if (o) return;
    const practice = target?.practice;
    close();
    practice?.onClose();
  };
  // Describe's See it reopens the sheet on Describe (ai-jobs.ts).
  useEffect(() => {
    setReopen((seasonId, couchId) => openStartGame({ seasonId, couchId, screen: "describe" }));
    return () => setReopen(null);
  }, []);
  return (
    <>
      <PickShowSheet key={`pick-${n}`} open={!!target && !target.seasonId} couchId={target?.couchId ?? null} practice={target?.practice} onOpenChange={onOpenChange} />
      <StartRouter key={`start-${n}`} target={target?.seasonId ? target : null} onOpenChange={onOpenChange} />
    </>
  );
}

/**
 * Which Start a game a season gets: the gallery (docs/PLAN-start-a-game-redo.md B1; gallery-bold/) for every start: a season with
 * episodes still to air, one that's aired (at your own pace: where you are, or from the top), Run it back (the old game reopened on
 * its base's screen), a sport's season, the episode on now (Include it), and the first-time tour's practice. A show that isn't a
 * game yet says so, with Make it a game.
 */
function StartRouter({ target: asked, onOpenChange }: { target: StartTarget | null; onOpenChange: (o: boolean) => void }) {
  const { data: home } = useHome();
  const current = useCurrentCouch(home);
  const [shown, setShown] = useState(asked);
  if (asked && asked !== shown) setShown(asked);
  const target = asked ?? shown;
  const couchId = target?.couchId ?? current?.id ?? null;
  // Include it: from the episode on now (its results not in yet).
  const [late, setLate] = useState(false);
  // At your own pace: where it starts (an episode that's aired; null: where the options say).
  const [catchUp, setCatchUp] = useState<number | null>(null);
  const wiz = useWizardOptions(target?.seasonId ?? null, couchId, !!target?.seasonId, late, catchUp, target?.again ?? null);
  if (!target?.seasonId) return null;
  return (
    <BoldSheet
      open={!!asked}
      onOpenChange={onOpenChange}
      o={wiz.data}
      loading={wiz.isLoading || (wiz.isPlaceholderData && wiz.isFetching)}
      error={(wiz.error as Error | null) ?? null}
      couchId={couchId}
      start={{ late, setLate, catchUp, setCatchUp, practice: target.practice, again: target.again ?? null, screen: target.screen ?? null, length: target.length ?? null, base: target.base ?? null, bots: target.bots ?? null }}
    />
  );
}

/** "Survivor 51". */
const labelOf = (s: HomeShow) => `${s.show.name.replace(/\s*\([^)]*\)\s*$/, "").replace(/^The /, "")}${s.seasonNumber ? ` ${s.seasonNumber}` : ""}`;

/** Pick the show (the mock's startGamePicker): your shows still to finish, soonest first; how many games the couch has on each. In
 *  the tour's practice, the show it practice-added comes first. */
function PickShowSheet({ open, couchId, practice, onOpenChange }: { open: boolean; couchId: string | null; practice?: StartPractice; onOpenChange: (o: boolean) => void }) {
  const { data: home } = useHome();
  const couch = home?.couches.find((c) => c.id === couchId) ?? null;
  const nav = useNav();
  const shows = (home?.shows ?? [])
    .filter((s) => (s.following || s.games.length) && s.status !== "completed" && s.release !== "binge")
    .sort((a, b) => (a.upNext?.airAt ? Date.parse(a.upNext.airAt) : Infinity) - (b.upNext?.airAt ? Date.parse(b.upNext.airAt) : Infinity));
  const practiceShow = practice?.seasonId && !shows.some((s) => s.seasonId === practice.seasonId) ? practice : null;
  // The tour's practice is on its own show: another one tapped shakes that row instead (the tour shows what to tap: the user,
  // 2026-11-01, picked their own show and got a sheet the tour's words didn't match).
  const practiceRow = useRef<HTMLButtonElement>(null);
  const toPractice = () => {
    shake(practiceRow.current);
    toast.quiet(`For practice, pick ${practiceShow?.label ?? "the one you just added"}`);
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Start a game" subtitle="Pick the show">
      <div data-start-pick className="flex flex-col pb-2">
        {practice && <PracticeStrip />}
        {practiceShow && (
          <button
            ref={practiceRow}
            type="button"
            data-pick-show={practiceShow.seasonId}
            data-pick-practice
            onClick={() => openStartGame({ seasonId: practiceShow.seasonId, couchId, practice })}
            className="nd-press relative z-[1] flex min-h-[72px] w-full items-center gap-3 rounded-[3px] px-2 py-2 text-left outline-2 outline-offset-2 outline-foreground"
          >
            <ShowArt seasonId={`pick-${practiceShow.seasonId}`} artUrl={practiceShow.artUrl} name={practiceShow.label ?? ""} className="size-14 flex-none rounded-[3px] text-[14px]" />
            <span className="min-w-0 flex-1">
              <b className="block truncate text-[16px] font-semibold">{practiceShow.label}</b>
              <small className="block text-[13px] text-muted-foreground">The one you just added · practice</small>
            </span>
            <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
          </button>
        )}
        {shows.length || practiceShow ? (
          shows.map((s) => {
            const have = (couch?.games ?? []).filter((g) => g.seasonId === s.seasonId && !g.archived).length;
            const ready = s.ready !== false;
            return (
              <button
                key={s.seasonId}
                type="button"
                data-pick-show={s.seasonId}
                onClick={() => {
                  if (practiceShow) toPractice();
                  else if (ready) openStartGame({ seasonId: s.seasonId, couchId, practice });
                  // The tour's practice stays in its sheets: Make it a game would really ask the bot.
                  else if (practice) toast.quiet("For practice, pick a show that's a game already");
                  else {
                    close();
                    nav.push(`${paths.show(s.seasonId, "games")}?page=make&then=start${couchId ? `&couch=${couchId}` : ""}`);
                  }
                }}
                className="nd-press flex min-h-[72px] w-full items-center gap-3 border-t border-border py-2 text-left first:border-t-0"
              >
                <ShowArt seasonId={`pick-${s.seasonId}`} artUrl={s.show.artUrl} name={labelOf(s)} className="size-14 flex-none rounded-[3px] text-[14px]" />
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[16px] font-semibold">{s.show.name}</b>
                  <small className="block text-[13px] text-muted-foreground">
                    {[
                      s.seasonNumber ? `Season ${s.seasonNumber}` : null,
                      !ready ? "Not a game yet · Make it a game" : have ? `${have} ${have === 1 ? "game" : "games"} already` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </span>
                <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
              </button>
            );
          })
        ) : (
          <p className="py-3 text-sm leading-normal text-muted-foreground">Add the shows you watch first: games start on a show.</p>
        )}
      </div>
    </Sheet>
  );
}
