"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Base, Spec } from "@/lib/game/start-gallery/index.js";
import { recipeKey, recipeOf } from "@/lib/game/saved-recipe";
import type { SavedGame } from "@/lib/server/saved-games";
import { SAVED_KEY, savedApi, useSavedGames } from "../../data";
import { toast } from "../../ui/toast";
import { lengthId, startOf, withSpan, type G, type Input, type Span } from "./model";

// Saved games (the user, 2026-11-18: "there should be a way to favorite games so you can repeat it easily"; B1 of
// docs/PLAN-start-a-game-redo.md). One heart, beside Start on every game's screen and on a ready game's row, saves the game as its
// recipe on the account (saved-games.ts, migration 0442): its base and its rules, its dates left out, so it opens again on any
// season from the next episode, for the length it was saved with, re-fitted to that season and checked by our engine (savedRows).
// Saves this browser kept before the account did (Round 2's localStorage gys_saved_games) move up once, then leave the browser.

export type Saved = SavedGame;

const OLD_KEY = "gys_saved_games";
const EMPTY: Saved[] = [];
let movingUp = false;

/** Your saved games, newest first (the account's; a browser's older saves moved up the first time). */
export function useSaved(): Saved[] {
  const q = useSavedGames();
  const qc = useQueryClient();
  const loaded = q.isSuccess;
  useEffect(() => {
    if (!loaded || movingUp) return;
    let old: unknown[] = [];
    try {
      const v: unknown = JSON.parse(localStorage.getItem(OLD_KEY) ?? "[]");
      old = Array.isArray(v) ? v.filter((x) => x && typeof x === "object" && typeof (x as { base?: unknown }).base === "string") : [];
    } catch {
      return;
    }
    if (!old.length) return;
    movingUp = true;
    // In batches of 50 (the route's most at once), every one of them, before the browser's copy goes (the branch review, 2026-11-19).
    const batches = Array.from({ length: Math.ceil(old.length / 50) }, (_, i) => old.slice(i * 50, i * 50 + 50));
    batches.reduce<Promise<Awaited<ReturnType<typeof savedApi.save>> | null>>((at, games) => at.then(() => savedApi.save({ games })), Promise.resolve(null)).then(
      (r) => {
        if (r) qc.setQueryData(SAVED_KEY, r);
        try {
          localStorage.removeItem(OLD_KEY);
        } catch {
          // Blocked storage: they're on the account now either way.
        }
      },
      () => {
        movingUp = false;
      }
    );
  }, [loaded, qc]);
  return q.data?.games ?? EMPTY;
}

export const keyOf = (base: string, spec: Spec) => recipeKey(base, spec);
export { recipeOf };

/** The heart's toggle: save it, or take it off your saved games if it's there; resolves true when it's saved now. */
export function useToggleSaved() {
  const qc = useQueryClient();
  return async (g: { base: Base; spec: Spec; span: Span; name: string; from: Saved["from"] }, input: Input, saved: Saved[]): Promise<boolean | null> => {
    const key = keyOf(g.base.id, g.spec);
    try {
      if (saved.some((s) => s.key === key)) {
        qc.setQueryData(SAVED_KEY, await savedApi.unsave(key));
        return false;
      }
      const lid = lengthId(g.span, input);
      const length: Saved["length"] = lid === "next" ? "one" : lid.startsWith("until:") ? "few" : "season";
      qc.setQueryData(SAVED_KEY, await savedApi.save({ base: g.base.id, name: g.name, spec: recipeOf(g.spec), length, from: g.from, on: input.label, seasonId: input.seasonId }));
      return true;
    } catch (e) {
      toast.quiet((e as Error).message);
      return null;
    }
  };
}

export interface SavedRow {
  s: Saved;
  base: Base | null;
  /** The recipe on this season, from the next episode for its length. */
  spec: Spec;
  span: Span;
  badge: string;
  /** What it is, in the engine's short line, its dates left out ("Draft 3 · Captain scores double"). */
  line: string;
  /** Why it can't be played on this season, in our check's words; null when it plays. */
  why: string | null;
}
/** Your saved games on this season: each from the next episode for the length it was saved with (as a ready game is), with our
 *  check's word on whether it plays here. */
export function savedRows(saved: Saved[], input: Input, gm: G): SavedRow[] {
  const later = input.stages.find((s, i) => i > 0 && !(s.at != null && s.at <= input.from));
  return saved.map((s) => {
    const span: Span = s.length === "one" ? { from: input.from, to: input.from } : s.length === "few" ? (later ? { from: input.from, to: { phase: later.id } } : { from: input.from, to: input.from + 2 }) : { from: input.from, to: null };
    const badge = s.length === "one" ? `1 ${input.ep}` : s.length === "few" ? (later ? `Till ${startOf(later)}` : `3 ${input.eps}`) : "Season";
    const base = gm.BASES.find((b) => b.id === s.base) ?? null;
    const spec = withSpan(s.spec, span);
    const v = gm.check(spec, input.pg);
    const parts = (v.short?.line ?? "").split(" · ");
    const line = (/episode|^from |^till |^through |season/i.test(parts[0] ?? "") ? parts.slice(1) : parts).join(" · ");
    return { s, base, spec, span, badge, line, why: base ? (v.ok ? null : v.problems[0] ?? v.waits[0] ?? "Our check doesn't place it here") : "That kind of game isn't in the gallery any more" };
  });
}
