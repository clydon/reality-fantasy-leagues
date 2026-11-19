"use client";

import { useSyncExternalStore } from "react";

// TEMP-UI: Round 3's design (docs/design-round/round3-short-games-spec.md), behind ?games=r3 until the user approves it (B3 then makes
// it the only one and deletes this switch). Remembered for this browser tab (sessionStorage), since the tab bar's links drop the
// query; ?games=off forgets it.

const KEY = "gys-games-r3";
const noop = () => () => {};

function read(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search).get("games");
    if (q === "r3") sessionStorage.setItem(KEY, "1");
    if (q === "off") sessionStorage.removeItem(KEY);
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** Whether Round 3's design is on in this tab. */
export function useR3(): boolean {
  return useSyncExternalStore(noop, read, () => false);
}
