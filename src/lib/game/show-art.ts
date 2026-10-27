// Show and season art and cast photos, the pure half (docs/RESEARCH-show-art-and-cast-photos.md; the network half is
// src/lib/server/show-art.ts). Which of TMDB's images a show gets, who in a season's credits is cast (not a host or a
// guest), whose photo is whose by name, and which stored photos the finder may replace. Checked by tests/show-art.test.js;
// nothing here reads the network or the database.
//
// Spoilers: TMDB lists a season's cast by episodes appeared in, with the counts (the first person out last, "1 episode").
// Only a name and a photo are ever taken from a credit; its order and counts never leave this file's callers.

export const TMDB_IMAGES = "https://image.tmdb.org/t/p";

/** A TMDB image at one of its sizes (posters w342/w500, backdrops w780/w1280, logos w300/w500, profiles w185/h632). */
export const tmdbImage = (path: string | null | undefined, size: string): string | null => (path ? `${TMDB_IMAGES}/${size}${path}` : null);

/** One of TMDB's images of a show or season. */
export interface TmdbImage {
  file_path: string;
  iso_639_1?: string | null;
  vote_average?: number | null;
  vote_count?: number | null;
  width?: number | null;
  height?: number | null;
}

export interface TmdbImages {
  posters?: TmdbImage[] | null;
  backdrops?: TmdbImage[] | null;
  logos?: TmdbImage[] | null;
}

/** The sizes each kind of art is stored at: cards are up to a phone wide (390 px at 3x), the header a phone wide too. */
export const ART_SIZE = { poster: "w500", backdrop: "w1280", logo: "w500", profile: "w185" } as const;

const best = (list: TmdbImage[]) =>
  [...list].sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0) || (b.vote_count ?? 0) - (a.vote_count ?? 0))[0] ?? null;

/** The best image in a list, by language: the first of `langs` that has any ("" means no language, i.e. no words on it). */
function bestIn(list: TmdbImage[] | null | undefined, langs: string[]): TmdbImage | null {
  const all = (list ?? []).filter((i) => i?.file_path);
  for (const l of langs) {
    const found = best(all.filter((i) => (i.iso_639_1 ?? "") === l));
    if (found) return found;
  }
  return best(all);
}

export interface PickedArt {
  poster: string | null;
  backdrop: string | null;
  logo: string | null;
}

/**
 * The art a show gets from TMDB's images: an English poster for cards; a backdrop for the header, one without words first
 * (the header sets the show's name over it); an English logo. TMDB's own order is by votes; it's sorted again here so the
 * pick doesn't depend on it.
 */
export function pickArt(images: TmdbImages | null | undefined): PickedArt {
  const poster = bestIn(images?.posters, ["en", ""]);
  const backdrop = bestIn(images?.backdrops, ["", "en"]);
  const logo = bestIn(images?.logos, ["en"]);
  return {
    poster: tmdbImage(poster?.file_path, ART_SIZE.poster),
    backdrop: tmdbImage(backdrop?.file_path, ART_SIZE.backdrop),
    logo: tmdbImage(logo?.file_path, ART_SIZE.logo),
  };
}

export type ArtKind = "poster" | "backdrop" | "logo";

export interface ArtCandidate {
  kind: ArtKind;
  /** What's stored when it's chosen. */
  url: string;
  /** A small copy for the picker. */
  thumb: string;
  /** "en", or null for an image with no words on it. */
  lang: string | null;
}

/** Choose art's choices: the best few of each kind, English and wordless ones only (the app is in English). */
export function artCandidates(images: TmdbImages | null | undefined, max = 12): ArtCandidate[] {
  const take = (kind: ArtKind, list: TmdbImage[] | null | undefined, thumb: string) =>
    [...(list ?? [])]
      .filter((i) => i?.file_path && ["en", ""].includes(i.iso_639_1 ?? ""))
      .sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0) || (b.vote_count ?? 0) - (a.vote_count ?? 0))
      .slice(0, kind === "logo" ? Math.ceil(max / 2) : max)
      .map((i) => ({ kind, url: tmdbImage(i.file_path, ART_SIZE[kind])!, thumb: tmdbImage(i.file_path, thumb)!, lang: i.iso_639_1 || null }));
  return [...take("poster", images?.posters, "w185"), ...take("backdrop", images?.backdrops, "w300"), ...take("logo", images?.logos, "w185")];
}

// ---------- who's cast in a season's credits ----------

/** One person in a season's credits (TMDB's aggregate_credits cast, or TVmaze's guest cast), as the matcher reads it. */
export interface Credit {
  /** The person's name, and any character names they're credited as ("Self - Contestant" becomes "Contestant"). */
  names: string[];
  photo: string | null;
}

/** Roles that aren't the cast: the host and the like, and guests. "Self - Contestant", "Self - Houseguest" stay. */
const NOT_CAST = /\b(host|co-host|narrator|judge|guest|mentor|correspondent|presenter|announcer|commentator|producer|himself - host|herself - host)\b/i;

export function isCastRole(character: string | null | undefined): boolean {
  return !NOT_CAST.test(character ?? "");
}

const SELF = /^\s*(self|himself|herself|themselves)\s*(-|–|—|$)\s*/i;

/** A credit's character as a name worth matching on: "Self - Contestant" isn't one (it's a role), "Walter White" is. */
export function characterName(character: string | null | undefined): string | null {
  const c = (character ?? "").trim();
  if (!c || SELF.test(c)) return null;
  return c;
}

interface TmdbCastRole {
  character?: string | null;
}
export interface TmdbAggregateCast {
  name?: string | null;
  profile_path?: string | null;
  roles?: TmdbCastRole[] | null;
}

/**
 * The cast in a season's TMDB credits (`/tv/{id}/season/{n}/aggregate_credits`), as credits to match by name: hosts, judges
 * and guests left out. Deliberately order-free and count-free (see the top of this file).
 */
export function tmdbCredits(cast: TmdbAggregateCast[] | null | undefined): Credit[] {
  const out: Credit[] = [];
  for (const p of cast ?? []) {
    const roles = (p.roles ?? []).map((r) => r?.character ?? "");
    if (!p?.name || (roles.length && roles.every((r) => !isCastRole(r)))) continue;
    out.push({ names: [p.name, ...roles.map(characterName).filter((x): x is string => !!x)], photo: tmdbImage(p.profile_path, ART_SIZE.profile) });
  }
  return out;
}

export interface TvGuestCast {
  person?: { name?: string | null; image?: { medium?: string | null } | null } | null;
  character?: { name?: string | null; image?: { medium?: string | null } | null } | null;
}

/** The people in TVmaze's guest cast of an episode (how TVmaze lists a reality season's contestants). */
export function tvmazeCredits(rows: TvGuestCast[] | null | undefined): Credit[] {
  return (rows ?? [])
    .filter((r) => r?.person?.name && isCastRole(r.character?.name))
    .map((r) => ({ names: [r.person!.name!, characterName(r.character?.name)].filter((x): x is string => !!x), photo: r.person?.image?.medium ?? null }));
}

// ---------- whose photo is whose ----------

/** A name as it's compared: no accents, case, punctuation or extra spaces. */
export function normName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The ways a name can be written: as is, without a quoted nickname, and with the nickname as the first name
 *  (`Angelina "Jelly" Loblack` is also "Angelina Loblack" and "Jelly Loblack"). A trailing "(racing driver)" goes. */
export function nameForms(name: string): string[] {
  const plain = name.replace(/\s*\([^)]*\)\s*$/, "");
  const nick = plain.match(/["“”'‘’]([^"“”'‘’]+)["“”'‘’]/);
  const forms = [plain];
  if (nick) {
    const without = plain.replace(nick[0], " ");
    forms.push(without);
    const parts = normName(without).split(" ");
    if (parts.length > 1) forms.push(`${nick[1]} ${parts.slice(1).join(" ")}`);
  }
  return [...new Set(forms.map(normName).filter(Boolean))];
}

/**
 * Whose credit a cast member is, by name, or null when it isn't clear. In order: the same name (any form); a credit whose
 * name starts with it ("Thien An" is "Thien An Nguyen"); the same first and last name ("Mike Pinsky" and "Michael Pinsky"
 * don't, but "Kristin A. Flickinger" does). Each step only counts when exactly one credit fits.
 */
export function matchCredit<T extends { names: string[] }>(name: string, credits: T[]): T | null {
  const forms = nameForms(name);
  const keyed = credits.map((c) => ({ c, forms: c.names.flatMap(nameForms) }));
  const one = (hits: { c: T }[]) => {
    const uniq = [...new Set(hits.map((h) => h.c))];
    return uniq.length === 1 ? uniq[0] : null;
  };
  const exact = keyed.filter((k) => k.forms.some((f) => forms.includes(f)));
  if (exact.length) return one(exact);
  const prefix = keyed.filter((k) => k.forms.some((f) => forms.some((m) => f.startsWith(`${m} `))));
  if (prefix.length) return one(prefix);
  const ends = (s: string) => {
    const p = s.split(" ");
    return p.length > 1 ? `${p[0]} ${p[p.length - 1]}` : null;
  };
  const mine = forms.map(ends).filter(Boolean);
  const firstLast = keyed.filter((k) => k.forms.some((f) => mine.includes(ends(f))));
  return firstLast.length ? one(firstLast) : null;
}

/**
 * Whether the finder may put a photo in place of this one: none yet, or one a finder brought that's worse than a TMDB
 * photo (the wiki's ~200 px icons, TVmaze's). One someone chose (our own files, any other address) is never replaced.
 */
export function replaceablePhoto(url: string | null | undefined): boolean {
  const u = (url ?? "").trim();
  if (!u) return true;
  return /^https?:\/\/(static\.wikia\.nocookie\.net|static\.tvmaze\.com)\//i.test(u);
}

/** Whether a stored image came from TMDB (what "remove TMDB's images" removes). */
export const fromTmdb = (url: string | null | undefined) => !!url && url.startsWith(`${TMDB_IMAGES}/`);

// ---------- sports ----------

/** A Formula 1 show ("Formula 1", "Formula One", "F1 ..."): its field comes from Jolpica, with Wikipedia links. */
export const isFormulaOne = (show: string) => /\bformula\s*(one|1)\b|^f1\b/i.test(show.trim());

/** A Wikipedia link's page title ("https://en.wikipedia.org/wiki/George_Russell_(racing_driver)" → "George Russell (racing driver)"). */
export function wikiTitle(url: string | null | undefined): string | null {
  const m = (url ?? "").match(/\/wiki\/([^?#]+)/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]).replace(/_/g, " ");
  } catch {
    return null;
  }
}

/** Whether a Wikipedia search hit is this person's page: the same name, give or take a "(racing driver)". */
export function wikiHitIs(name: string, title: string): boolean {
  const t = normName(title.replace(/\s*\([^)]*\)\s*$/, ""));
  return nameForms(name).includes(t);
}
