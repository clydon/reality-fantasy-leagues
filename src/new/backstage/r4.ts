"use client";

import { useSyncExternalStore } from "react";

// TEMP-UI: Round 4's design (docs/design-round/round4-game-settings-spec.md), behind ?settings=r4 until the user approves it (B4 then
// makes it the only one and deletes this switch). Remembered for this browser tab (sessionStorage), since links drop the query;
// ?settings=off forgets it.

const KEY = "gys-settings-r4";
const noop = () => () => {};

function read(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search).get("settings");
    if (q === "r4") sessionStorage.setItem(KEY, "1");
    if (q === "off") sessionStorage.removeItem(KEY);
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** Whether Round 4's design is on in this tab. */
export function useR4(): boolean {
  return useSyncExternalStore(noop, read, () => false);
}
