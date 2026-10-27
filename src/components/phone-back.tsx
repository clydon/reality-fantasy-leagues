"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { slotFour } from "@/lib/game/league-tabs";
import { parentOf } from "@/lib/nav-trail";
import { isStandalone } from "@/lib/push-client";
import { useLeagueStore } from "@/lib/store";
import { markNav } from "@/new/nav";
import { isNewDesignRoute, navKind, upFrom } from "@/new/routes";
import { QUIET_MS, toast } from "@/new/ui/toast";

// The phone's back button in the installed app (Android's; iOS has none). A browser tab keeps the browser's own back,
// and so does a desktop window: leaving is what back is for there.
//
// Back follows the trail you took. Where the trail runs out (the app opened on a page: a relaunch where you left off,
// a notification, a pull-to-refresh), it goes up instead, to where the page's own Back button leads (routes.ts's upFrom,
// classic's nav-trail.ts parentOf), and on up to the top: the hub, or classic's Overview. At the top, back says "Press
// back again to exit", and leaves the app only when it's pressed again while that's up.
//
// How: the first page of the visit gets an entry put under it, the floor, so a back from that page lands on the floor
// instead of closing the app. Landing there goes up a page (pushed above the floor) or, at the top, stays: the floor is
// the first entry, so the next back closes the app; once the hint has gone, the page goes back above it. Next's router
// never sees the floor. It's written with History's own methods (Next wraps the instance's), and its popstate stops
// here, in the capture phase, ahead of Next's listener, which would reload the page on an entry it didn't write.
//
// Chrome's back button skips an entry that a page added with no tap since its last back (the history manipulation
// intervention: chromium's docs/history_manipulation_intervention.md), and on Android a back with only skipped entries
// behind it closes the app. That's the floor when the app opens, and after each step up, until the next tap. So until
// then a close watcher takes the back (Android's back is a close request) and makes it history.back(), which the
// intervention leaves alone. A page can keep one close watcher without a tap.
//
// scripts/dev-test/check-phone-back.js checks it in a browser.

const FLOOR = "gysFloor";
const EXIT_HINT = "Press back again to exit";

type Watcher = { onclose: (() => void) | null; destroy(): void };
const closeWatcher = () => (window as unknown as { CloseWatcher?: new () => Watcher }).CloseWatcher;
const navigation = () => (window as unknown as { navigation?: EventTarget & { currentEntry: { index: number } | null } }).navigation;

function isFloor(state: unknown) {
  return typeof state === "object" && state !== null && FLOOR in state;
}

/** Next's own state for an entry (its router tree), without ours; null on an entry Next hasn't written. */
function routerState(state: unknown) {
  if (typeof state !== "object" || state === null || !("__NA" in state)) return null;
  const rest = { ...(state as Record<string, unknown>) };
  delete rest[FLOOR];
  return rest;
}

/** History's own pushState and replaceState, not Next's wrappers on window.history. */
function putEntry(push: boolean, state: unknown, url: string) {
  (push ? History.prototype.pushState : History.prototype.replaceState).call(window.history, state, "", url);
}

const here = () => window.location.pathname + window.location.search;

/** Mounted once, in the root layout. `signedIn`: the request had a session (the root layout's hint). */
export function PhoneBack({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  // Classic's hint, on the page it was said on (the new design says it with its own toast).
  const [hintOn, setHintOn] = useState<string | null>(null);
  const track = useRef(() => {});

  useEffect(() => {
    if (!isStandalone() || !window.matchMedia("(pointer: coarse)").matches) return;
    // The page on screen, and its entry's router state, as of the last change of entry.
    let screen = here();
    let screenState = routerState(window.history.state);
    let watcher: Watcher | null = null;
    let exitTimer: ReturnType<typeof setTimeout> | undefined;

    const up = (from: string) => {
      const path = from.split(/[?#]/)[0];
      if (isNewDesignRoute(path)) return upFrom(from, { signedIn });
      if (path === "/") return null;
      return parentOf(path, slotFour(useLeagueStore.getState().state))?.href ?? "/";
    };

    // Until the next tap, the back is the page's own history.back().
    const guard = () => {
      const CloseWatcher = closeWatcher();
      if (!CloseWatcher) return;
      watcher?.destroy();
      const w = new CloseWatcher();
      w.onclose = () => {
        if (watcher === w) watcher = null;
        window.history.back();
      };
      watcher = w;
    };
    const onTap = (e: Event) => {
      // Escape is a close request (the watcher's, on a desktop), never a tap, however recent the last tap was.
      if ((e as KeyboardEvent).key === "Escape" || navigator.userActivation?.isActive === false) return;
      watcher?.destroy();
      watcher = null;
    };

    // The floor, under the page on screen.
    const seed = () => {
      const state = routerState(window.history.state);
      if (!state) return;
      putEntry(false, { [FLOOR]: 1 }, here());
      putEntry(true, state, here());
      guard();
    };

    const land = (from: string) => {
      clearTimeout(exitTimer);
      // The floor takes the address you left, so the page up from it is a push above it, not a replace of it.
      putEntry(false, { [FLOOR]: 1 }, from);
      const to = up(from);
      if (to) {
        if (isNewDesignRoute(from) && isNewDesignRoute(to)) markNav(navKind(from, to));
        router.push(to);
        guard();
        return;
      }
      if (isNewDesignRoute(from)) toast.quiet(EXIT_HINT);
      else setHintOn(window.location.pathname);
      const state = screenState;
      exitTimer = setTimeout(() => {
        setHintOn(null);
        // Still on the floor: the page goes back above it, so a back says it again.
        if (!isFloor(window.history.state)) return;
        if (state) putEntry(true, state, from);
        // Next's wrapper copies its state over.
        else window.history.pushState(null, "", from);
        guard();
      }, QUIET_MS);
    };

    track.current = () => {
      if (isFloor(window.history.state)) return;
      screen = here();
      screenState = routerState(window.history.state) ?? screenState;
      // The first entry with no floor under it: Next replaced the floor while it was on screen.
      if (navigation()?.currentEntry?.index === 0) seed();
    };

    const onPop = (e: PopStateEvent) => {
      if (!isFloor(e.state)) return track.current();
      e.stopImmediatePropagation();
      land(screen);
    };

    if (isFloor(window.history.state)) {
      // A fresh page on the floor: back from a page that was reloaded.
      screenState = routerState(window.history.state);
      land(here());
    } else if (navigation() ? navigation()?.currentEntry?.index === 0 : window.history.length === 1) {
      seed();
    }
    if (!navigator.userActivation?.hasBeenActive) guard();

    const nav = navigation();
    const onEntry = () => track.current();
    window.addEventListener("popstate", onPop, true);
    window.addEventListener("pointerup", onTap, true);
    window.addEventListener("keydown", onTap, true);
    nav?.addEventListener("currententrychange", onEntry);
    return () => {
      window.removeEventListener("popstate", onPop, true);
      window.removeEventListener("pointerup", onTap, true);
      window.removeEventListener("keydown", onTap, true);
      nav?.removeEventListener("currententrychange", onEntry);
      watcher?.destroy();
      clearTimeout(exitTimer);
      track.current = () => {};
    };
  }, [router, signedIn]);

  useEffect(() => track.current(), [pathname]);

  if (hintOn !== pathname || isNewDesignRoute(pathname)) return null;
  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom,0px))] z-[95] flex justify-center px-4">
      <span className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background shadow-lg animate-in fade-in slide-in-from-bottom-2">{EXIT_HINT}</span>
    </div>
  );
}
