"use client";

import { useLayoutEffect, type ReactNode } from "react";
import { ThemeSync, useAppearance } from "./appearance";
import { NavMotion } from "./nav";
import { ToastHost } from "./ui/toast";

// The new design's frame (docs/PLAN-new-design.md step 0c), around every one of its routes: the phone column
// (new.css), the theme (Night, Studio or Match phone, step 15 part 4: appearance.tsx; drawn on <html> before the first paint by
// the boot script, so sheets outside the column match, and classic's own theme is back on the full reload that switches
// designs), the toast, and the navigation motion.
//
// The screen that moves on a navigation is the view transition's root snapshot (nav.tsx). React leaves the root
// out of a transition unless <html> already has a view-transition-name of its own (it cancels it otherwise, and
// only <ViewTransition> boundaries animate), so the shell names it. check-new-shell.js asserts the root moves, so a
// React upgrade that changes this shows up there.

export function NewShell({ children }: { children: ReactNode }) {
  useAppearance();
  useLayoutEffect(() => {
    const html = document.documentElement;
    html.style.viewTransitionName = "root";
    return () => {
      html.style.viewTransitionName = "";
    };
  }, []);
  return (
    <div className="nd">
      {children}
      <ToastHost />
      <NavMotion />
      <ThemeSync />
    </div>
  );
}
