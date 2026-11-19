"use client";

import { useSyncExternalStore } from "react";

// TEMP-UI: Round 5's design (docs/design-round/round5-play-pieces-spec.md: the pieces a game's page couldn't play), behind ?play=b2
// until the user approves it (B2 then makes it everyone's and deletes this switch). Remembered for this browser tab
// (sessionStorage), since links drop the query; ?play=off forgets it.

const KEY = "gys-play-b2";
const noop = () => () => {};

function read(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search).get("play");
    if (q === "b2") sessionStorage.setItem(KEY, "1");
    if (q === "off") sessionStorage.removeItem(KEY);
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** Whether Round 5's design is on in this tab. */
export function useB2(): boolean {
  return useSyncExternalStore(noop, read, () => false);
}
