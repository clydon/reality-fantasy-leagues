"use client";

import { useSyncExternalStore } from "react";
import type { Base, Spec } from "@/lib/game/start-gallery/index.js";
import { lengthId, startOf, withSpan, type G, type Input, type Span } from "./model";

// Saved games (the user, 2026-11-18: "there should be a way to favorite games so you can repeat it easily"). One heart, beside Start
// on every game's screen and on a ready game's row, saves the game as its recipe: its base and its rules, its dates left out, so it
// opens again on any season from the next episode, for the length it was saved with. A ready game's heart count is how many saved
// it. TEMP (Round 2 saves nothing to the database): the saves are this browser's (localStorage gys_saved_games); the build keeps them
// on the account and re-fits each to the season it's opened on (the draft to who's left, the show's own moments).

export interface Saved {
  /** The recipe's identity: its base and its rules, dates left out. */
  key: string;
  name: string;
  /** A base's id. */
  base: string;
  /** The rules, without their dates. */
  spec: Spec;
  length: "one" | "few" | "season";
  from: "base" | "community" | "describe" | "saved";
  savedAt: string;
  /** The season it was saved on, by its label. */
  on: string;
}

const KEY = "gys_saved_games";
const EMPTY: Saved[] = [];
let items: Saved[] | null = null;
const subs = new Set<() => void>();

function read(): Saved[] {
  if (items) return items;
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    items = Array.isArray(v) ? (v as Saved[]).filter((s) => s && typeof s.key === "string" && typeof s.base === "string") : [];
  } catch {
    items = [];
  }
  return items;
}
function write(next: Saved[]) {
  items = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private windows and blocked storage: the save lasts until the page closes.
  }
  subs.forEach((f) => f());
}
function subscribe(f: () => void) {
  subs.add(f);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    items = null;
    f();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    subs.delete(f);
    window.removeEventListener("storage", onStorage);
  };
}
/** Your saved games, newest first. */
export function useSaved(): Saved[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

const stable = (v: unknown): string =>
  Array.isArray(v)
    ? `[${v.map(stable).join(",")}]`
    : v && typeof v === "object"
      ? `{${Object.keys(v)
          .sort()
          .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`)
          .join(",")}}`
      : JSON.stringify(v) ?? "null";

/** The rules without their dates: the span, and a game in stages' first start. */
export function recipeOf(spec: Spec): Spec {
  const { span: _span, ...rest } = spec as Spec & { span?: unknown };
  void _span;
  if (!Array.isArray(rest.stages)) return rest as Spec;
  const stages = rest.stages.map((st, i) => {
    if (i !== 0 || !st.game?.span) return st;
    const { from: _from, ...span } = st.game.span as Record<string, unknown>;
    void _from;
    const game = { ...st.game } as Record<string, unknown>;
    if (Object.keys(span).length) game.span = span;
    else delete game.span;
    return { ...st, game } as typeof st;
  });
  return { ...rest, stages } as Spec;
}
export const keyOf = (base: string, spec: Spec) => `${base}|${stable(recipeOf(spec))}`;

/** Save it, or take it off your saved games if it's there; true when it's saved now. */
export function toggleSaved(g: { base: Base; spec: Spec; span: Span; name: string; from: Saved["from"] }, input: Input): boolean {
  const key = keyOf(g.base.id, g.spec);
  const now = read();
  if (now.some((s) => s.key === key)) {
    write(now.filter((s) => s.key !== key));
    return false;
  }
  const lid = lengthId(g.span, input);
  const length: Saved["length"] = lid === "next" ? "one" : lid.startsWith("until:") ? "few" : "season";
  write([{ key, name: g.name, base: g.base.id, spec: recipeOf(g.spec), length, from: g.from, savedAt: new Date().toISOString(), on: input.label }, ...now]);
  return true;
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
