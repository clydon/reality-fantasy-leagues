"use client";

import { ViewTransition, type ReactNode } from "react";

// Same people, new places (the mock's explorer motion, nav.js): wrap each item of a list that re-sorts or filters
// in <Flip id>, and make the change inside startTransition; each item then moves from its old spot to its new one
// (new.css, .nd-flip). Ids must be unique on the screen. First used by the Cast explorer (step 3).

export function Flip({ id, children }: { id: string; children: ReactNode }) {
  return (
    <ViewTransition name={`nd-flip-${id}`} update="nd-flip" share="nd-flip" default="none">
      {children}
    </ViewTransition>
  );
}
