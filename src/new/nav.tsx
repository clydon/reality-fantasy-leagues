"use client";

import { useEffect, useLayoutEffect, useRef, ViewTransition, type ComponentProps, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { navKind, type NavKind } from "./routes";

// Motion that grounds navigation (docs/PLAN-new-design.md step 0c; the mock's nav.js): every move says where you
// went. The rules are in routes.ts (navKind); the animations are CSS in src/app/(new)/new.css, keyed on
// <html data-nav="push|pop|left|right|channel|fade|calm">, set here just before each navigation.
//
// The screen that moves is the whole page as you see it (the view transition's root snapshot), because pages
// scroll the document: naming a page's own element would morph it from wherever it was scrolled to. Named on
// top of it: the show bar and tab bar during a tab move (they hold still), the tab marker (it slides), and a
// show's art on a channel change: the card you tapped grows into the show bar (named here at the tap; the show
// bar's art by new.css while data-nav is "channel"), and coming back, the show bar shrinks into that show's card
// on the hub (named when the hub commits). The hub shows a show in several places, so it's by hand, not React's
// <ViewTransition name>, which allows one element per name.
//
// Going somewhere (a NavLink, nav.push): React runs the transition. It only starts one when a <ViewTransition>
// boundary changes, so <NavMotion> keeps a tiny boundary keyed on the path; React also waits for the new page
// before it starts, so a slow page never freezes the screen.
//
// Going back (nav.back, the in-app Back buttons): the browser's back, so the history stays the trail you took.
// React applies a back to a page it still has synchronously, inside the popstate (so the browser can restore the
// scroll), and a synchronous update never animates. So nav.back runs its own view transition around it, naming
// the show's art by hand for a channel change. The browser's own back (a gesture, Android's back) isn't animated
// here, as Next's guide says: iOS animates its swipe itself.

// Each mark has a number, so clearing an old one never clears a newer navigation's.
let navSeq = 0;

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Marks the next view transition's kind. Cleared once it has played, or soon after if none comes (a click that
 *  goes nowhere, a browser without View Transitions). */
export function markNav(kind: NavKind): number {
  const seq = ++navSeq;
  document.documentElement.dataset.nav = reducedMotion() ? "calm" : kind;
  setTimeout(() => clearNav(seq), 4000);
  return seq;
}

function clearNav(seq: number) {
  if (seq !== navSeq) return;
  delete document.documentElement.dataset.nav;
  document.querySelectorAll<HTMLElement>("[data-art]").forEach(unnameArt);
}

/** Unmarks once every animation of the running view transition has finished. The animations are the CSS keyed on
 *  data-nav, so clearing it any earlier would stop them mid-move. */
function clearAfterTransition() {
  const seq = navSeq;
  const running = document.documentElement
    .getAnimations({ subtree: true })
    .filter((a) => (a.effect as KeyframeEffect | null)?.pseudoElement?.startsWith("::view-transition"));
  Promise.allSettled(running.map((a) => a.finished)).then(() => clearNav(seq));
}

function isPlainClick(e: MouseEvent) {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

// The page before this one in the history of this visit (NavMotion keeps it), so a Back button can be the
// browser's back when that's where it leads, and the history doesn't grow a loop of pages you've already left.
// A replace (a show's tabs) changes the page without adding an entry, so it leaves this alone.
let previousPath: string | null = null;
let replacing = false;
// nav.back marks its own kind; the popstate it causes shouldn't mark another.
let backing = false;
// Called once the next navigation has committed (NavMotion's layout effect), before the browser paints it.
let onCommit: (() => void)[] = [];

/** A Link that moves the screen the right way. `channel`: a show card whose art grows into the show's header (the
 *  link's own art, or that of the card around it marked data-art-scope). */
export function NavLink({ channel, onClick, ...props }: ComponentProps<typeof Link> & { channel?: boolean }) {
  const pathname = usePathname();
  return (
    <Link
      {...props}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || !isPlainClick(e) || typeof props.href !== "string") return;
        markNav(navKind(pathname, props.href, { channel }));
        replacing = !!props.replace;
        // The art that grows: the link's own, or its card's (data-art-scope) when the art sits beside the link.
        const card = e.currentTarget.closest<HTMLElement>("[data-art-scope]") ?? e.currentTarget;
        if (channel) nameArt(card.querySelector<HTMLElement>("[data-art]"));
      }}
    />
  );
}

/** The one piece of art that carries a channel change (new.css's nd-art). */
function nameArt(el: HTMLElement | null) {
  el?.style.setProperty("view-transition-name", "nd-art");
}
function unnameArt(el: HTMLElement | null) {
  el?.style.removeProperty("view-transition-name");
}
function onScreen(el: Element) {
  const r = el.getBoundingClientRect();
  return r.bottom > 40 && r.top < window.innerHeight - 40 && r.width > 20;
}
/** Back on the hub from a show: that show's art on screen, the first if there are several. */
function nameReturnArt(fromPath: string) {
  const seasonId = fromPath.split("/")[2];
  const art = [...document.querySelectorAll<HTMLElement>(`[data-art="${seasonId}"]`)].find(onScreen);
  nameArt(art ?? null);
}

/** The browser's back, moving the screen as `kind` says (see the top of this file). */
function historyBack(kind: NavKind) {
  const seq = markNav(kind);
  backing = true;
  if (!document.startViewTransition) {
    window.history.back();
    return;
  }
  let skipped = false;
  // The art for a channel change is named the same way as React's transitions name it (NavMotion, new.css).
  const t = document.startViewTransition(
    () =>
      new Promise<void>((resolve) => {
        // A page it has to fetch first: React starts its own transition (skipping this one) when it's there.
        const timer = setTimeout(resolve, 1500);
        onCommit.push(() => {
          clearTimeout(timer);
          resolve();
        });
        window.history.back();
      })
  );
  t.ready.catch(() => (skipped = true));
  t.finished.finally(() => {
    if (!skipped) clearNav(seq);
  });
}

/** Programmatic navigation with the same motion. */
export function useNav() {
  const router = useRouter();
  const pathname = usePathname();
  return {
    push(href: string, opts?: { channel?: boolean }) {
      markNav(navKind(pathname, href, opts));
      router.push(href);
    },
    /**
     * Up to `parent`: the browser's back when the page you came from is it (or is one `accepts`, e.g. any tab of the
     * show), else a navigation there. A page opened from a link or a reload has nothing of this visit to go back to.
     */
    back(parent: string, accepts?: (prev: string) => boolean) {
      if (previousPath && (previousPath === parent || accepts?.(previousPath))) {
        historyBack(navKind(pathname, previousPath));
      } else {
        markNav(navKind(pathname, parent));
        router.push(parent);
      }
    },
  };
}

/** Mounted once, in the new design's layout: the popstate side of the motion, and the boundary that starts it. */
export function NavMotion() {
  const pathname = usePathname();
  const last = useRef(pathname);
  useLayoutEffect(() => {
    if (last.current === pathname) return;
    if (!replacing) previousPath = last.current;
    replacing = false;
    // A channel change back to the hub: the art it shrinks into (inside the transition, before the new screen is
    // captured).
    if (document.documentElement.dataset.nav === "channel" && last.current.startsWith("/show/")) nameReturnArt(last.current);
    last.current = pathname;
    const waiting = onCommit;
    onCommit = [];
    waiting.forEach((f) => f());
  }, [pathname]);
  useEffect(() => {
    // Runs before the router renders the page it's going back (or forward) to. The same path with another query
    // (closing a pushed page, ui/page.tsx) isn't a move.
    const onPop = () => {
      if (backing) backing = false;
      else if (window.location.pathname !== last.current) markNav(navKind(last.current, window.location.pathname));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return (
    <ViewTransition
      key={pathname}
      enter="nd-mark"
      exit="nd-mark"
      default="none"
      // Called once the transition's animations are running.
      onEnter={clearAfterTransition}
    >
      <i className="nd-mark" aria-hidden />
    </ViewTransition>
  );
}
