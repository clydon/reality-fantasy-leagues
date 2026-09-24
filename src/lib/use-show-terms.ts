"use client";

import { useQuery } from "@tanstack/react-query";
import { useLeagueStore } from "@/lib/store";
import { api } from "@/lib/api";
import type { CatalogShow } from "@/lib/game/types";

// Per-show terminology for the UI.
//
// shows.castaway_term / shows.tribe_term have existed since the hardcoded SHOWS registry and became
// editable with the admin catalog (db/migrations/0006_shows_and_seasons.sql), but nothing ever read
// them -- so a Traitors league still said "castaway" and "tribe" everywhere. This is what reads
// them.
//
// The terms come from the CATALOG rather than being copied into league state, so that renaming a
// show's terminology in Admin takes effect everywhere at once instead of only in leagues created
// afterwards. The cost is that the first paint of a page uses the Survivor defaults and swaps when
// the query resolves; a shared queryKey plus a long staleTime keeps that to once per session rather
// than once per navigation.

export const DEFAULT_TERMS = { castaway: "Castaway", tribe: "Tribe" };

// Shared across every consumer (the Show/Season pickers in League Settings included) so the catalog
// is fetched once per session, not once per component.
export function useShowCatalog() {
  const mode = useLeagueStore((s) => s.mode);
  return useQuery({
    queryKey: ["shows-catalog"],
    queryFn: () => api.listShows(),
    enabled: mode === "live",
    staleTime: 10 * 60 * 1000,
  });
}

// Enough English to get a singular and a plural out of whatever an admin typed. Deliberately small:
// these are words from a text box ("Houseguest", "Contestant", "Faction"), not arbitrary prose, and a
// wrong form here is a cosmetic bug, not a data one.
//
// The already-plural case is real, not hypothetical: the field is labelled as a singular but the
// first person to use it typed "Contestants", and a naive pluralizer turns that into
// "Contestantses". So both helpers detect a word that's already plural. "-ss/-us/-is/-sh/-ch/-x/-z"
// are excluded from that test because those endings belong to singulars (Class, Bus, Iris, House),
// which do take "-es".
const LOOKS_PLURAL = /[^sciux]s$/i;

function plural(word: string): string {
  if (!word) return word;
  if (LOOKS_PLURAL.test(word)) return word; // already plural -- leave it alone
  if (/(s|x|z|ch|sh)$/i.test(word)) return word + "es";
  if (/[^aeiou]y$/i.test(word)) return word.slice(0, -1) + "ies";
  return word + "s";
}

function singular(word: string): string {
  if (!word) return word;
  if (/ies$/i.test(word)) return word.slice(0, -3) + "y";
  if (LOOKS_PLURAL.test(word)) return word.slice(0, -1);
  return word;
}

const lower = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

export interface ShowTerms {
  /** "Castaway" -- capitalized, for labels and headings. */
  Castaway: string;
  Castaways: string;
  /** "castaway" -- mid-sentence. */
  castaway: string;
  castaways: string;
  Tribe: string;
  Tribes: string;
  tribe: string;
  tribes: string;
  /** The show's display name, or null when it isn't in the catalog (mock mode, unpicked, archived). */
  showName: string | null;
}

function termsFrom(show: Pick<CatalogShow, "name" | "castaway_term" | "tribe_term"> | null): ShowTerms {
  // Normalize to a singular first, so a term entered either way ("Contestant" or "Contestants")
  // produces the same pair of forms.
  const c = singular((show?.castaway_term || "").trim() || DEFAULT_TERMS.castaway);
  const t = singular((show?.tribe_term || "").trim() || DEFAULT_TERMS.tribe);
  return {
    Castaway: c,
    Castaways: plural(c),
    castaway: lower(c),
    castaways: lower(plural(c)),
    Tribe: t,
    Tribes: plural(t),
    tribe: lower(t),
    tribes: lower(plural(t)),
    showName: show?.name ?? null,
  };
}

/**
 * Terminology for the currently-loaded league's show. Falls back to Survivor's Castaway/Tribe when
 * the catalog hasn't loaded, the league hasn't picked a show yet, or its show has been archived --
 * so a label always renders something sensible rather than blank.
 */
export function useShowTerms(): ShowTerms {
  const showId = useLeagueStore((s) => s.state.settings.showId);
  const { data } = useShowCatalog();
  const show = data?.shows.find((s) => s.slug === showId) ?? null;
  return termsFrom(show);
}

// Exported for the rare non-hook caller (a selector or a test) that already holds the catalog.
export { termsFrom, plural, singular };
