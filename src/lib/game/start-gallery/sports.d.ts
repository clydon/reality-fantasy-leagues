// Types for sports.js (Start a game's gallery, sports): the catalog of game types a sport's fans know (sports.json) and each one's
// verdict on a sport's page. sports.js's header says how a base resolves on a league and a page.
import type { SpecContext } from "../game-spec/index.js";
import type { Pack } from "../game-words/index.js";
import type { PageFacts, Spec, Verdict } from "./index.js";

/** A league's season of games (several an episode), its playoffs, a team's games (one an episode), or events (a field's, a card's). */
export type SportPageKind = "slate" | "playoffs" | "game" | "event";

export interface SportFamily {
  id: string;
  name: string;
  says: string;
  /** The league its table is checked on first ("football/nfl"). */
  core: string;
  /** Every league of the sport plays it (soccer's, MMA's): `leagues` are examples. */
  open?: boolean;
  leagues: string[];
  pages: SportPageKind[];
}

export interface SportPage {
  id: SportPageKind;
  name: string;
  says: string;
}

export interface SportCat {
  id: string;
  short: string;
  name: string;
  says: string;
}

/** A spec, or one of the sport's standard games (src/lib/sports/defaults) with parts over it one level deep. */
export type SportSpecRef = Spec | { standard: string; with?: Record<string, unknown> };

export interface SportBase {
  id: string;
  sports: string[];
  leagues?: string[];
  cat: string;
  on: SportPageKind[];
  name: string;
  plain: string;
  about: string;
  effort: string;
  len: string;
  lens?: Partial<Record<SportPageKind, string>>;
  spec?: SportSpecRef;
  coming?: string;
  needs?: string;
  gap?: string;
  /** A family's ("soccer") or a league's ("football/college-football") words, spec or coming over the base's. */
  by?: Record<string, Partial<Omit<SportBase, "id" | "sports" | "by">>>;
}

export interface SportVerdict {
  id: string;
  cat: string;
  name: string;
  plain: string;
  about: string;
  effort: string;
  len: string;
  on: SportPageKind[];
  state: "plays" | "off" | "coming" | "needs" | "elsewhere";
  why: string | null;
  gap: string | null;
  needs: string | null;
  short: Verdict["short"];
  sentence: string | null;
  rules: string[] | null;
  type: string | null;
  /** The game to start (or open on the base's screen): its span set, fitted to who's left. */
  spec: Spec | null;
  fitted: { each: number; to: number | "shared"; pool: number; people: number } | null;
}

export const SPORT_FAMILIES: SportFamily[];
export const SPORT_PAGES: SportPage[];
export const SPORT_CATS: SportCat[];
export const SPORT_BASES: SportBase[];

export function familyOf(league: string | null | undefined): string | null;
export function pageKindOf(page: { ctx: SpecContext; pack?: Pack } | PageFacts | SpecContext | null | undefined): SportPageKind;
export function sportStandard(family: string, league?: string | null): Record<string, { about: string; on: "playoffs" | null; spec: Spec }>;
export function sportBase(base: SportBase | string, league: string | null): Omit<SportBase, "by"> | null;
export function sportSpec(base: SportBase | string, league: string | null, span?: { from: number; to: number | null } | null): Spec | null;
export function sportGallery(
  page: { ctx: SpecContext; pack?: Pack } | PageFacts | SpecContext,
  o?: { page?: SportPageKind; all?: boolean; league?: string; extra?: Record<string, unknown> }
): SportVerdict[];
