// What your couch sees (docs/PLAN-new-design.md step 15 part 3; the mock's share.js PRIV, PRIV_PRESETS and privHTML), the pure
// half: the four switches (user_settings.share_*, migration 0137; share_gifs since 0162, in place of share_ratings), the three levels over them, and their words. The server
// enforces them (guard.ts rule 3: shares, sharesSql); Settings shows them (src/new/settings/sharing.tsx).
//
// A show watched privately (its ⋯ menu) stays hidden whatever these say, and your games always show: picks once they lock,
// calls, bingo, polls and scores are what the games need.

export type ShareSwitch = "where" | "now" | "gifs" | "reactions";
export type Sharing = Record<ShareSwitch, boolean>;
export type SharePreset = "all" | "games" | "min";

export const SHARE_SWITCHES: ShareSwitch[] = ["where", "now", "gifs", "reactions"];

export const SHARE_PRESETS: Record<SharePreset, Sharing> = {
  all: { where: true, now: true, gifs: true, reactions: true },
  games: { where: false, now: false, gifs: true, reactions: true },
  min: { where: false, now: false, gifs: false, reactions: false },
};

/** Someone with no settings row shares everything: the recommended level, and the columns' default. */
export const SHARE_DEFAULT: Sharing = SHARE_PRESETS.all;

/** The level these switches make, or "custom" for a mix of your own. */
export function presetOf(s: Sharing): SharePreset | "custom" {
  return (Object.keys(SHARE_PRESETS) as SharePreset[]).find((p) => SHARE_SWITCHES.every((k) => SHARE_PRESETS[p][k] === s[k])) ?? "custom";
}

/** A sharing setting from what was sent ({ preset } or any of the switches), over what's there; null when it's neither. */
export function sharingFrom(raw: unknown, now: Sharing): Sharing | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if ("preset" in r) return typeof r.preset === "string" && r.preset in SHARE_PRESETS ? { ...SHARE_PRESETS[r.preset as SharePreset] } : null;
  const keys = Object.keys(r);
  if (!keys.length || !keys.every((k) => (SHARE_SWITCHES as string[]).includes(k) && typeof r[k] === "boolean")) return null;
  return { ...now, ...(r as Partial<Sharing>) };
}

export const PRESET_WORDS: { id: SharePreset; title: string; line: string; recommended?: boolean }[] = [
  { id: "all", title: "Everything", line: "Where you are in each show, when you're watching, your GIFs and reactions", recommended: true },
  { id: "games", title: "Just my games", line: "Your games, GIFs and reactions. Not what you watch or where you are" },
  { id: "min", title: "Only what games need", line: "Your picks and scores once they lock. Nothing else" },
];

export const SWITCH_WORDS: Record<ShareSwitch, { title: string; line: string }> = {
  where: { title: "Where I am in each show", line: "What you watch, and how far you are" },
  now: { title: "When I'm watching", line: "That you're watching along right now, and which episode" },
  gifs: { title: "My episode GIFs", line: "The GIF you react to each episode with" },
  reactions: { title: "My watch along reactions", line: "For whoever watches the episode after you" },
};

/**
 * How far someone is, as the couch sees it when they share Where I am (the mock's watching.js Who's watching and couchWatchHTML,
 * streaming.js progress): a weekly show "Caught up", "Up to Episode 5", "Not started"; one watched at your own pace "Finished", "Ep
 * 4 of 8". `short` for a chip ("caught up", "Ep 5", "finished"). Null before anything has aired: there's nowhere to be yet.
 * "full" for a sheet's line, which says which one and how many ("Caught up · Episode 7", "Up to Episode 5 of 7", "Up to Episode 4
 * of 8", "Not on yet" before it airs: the person sheet, couch/person-sheet.tsx). `word` is what the show calls an episode.
 * "Up to", not "On" (the user's pick of the 2026-11-01 mocks): "on Episode 5" reads as halfway through it.
 */
export function whereWords(seen: number, o: { aired: number; total: number; ownPace: boolean; word?: string }, style: boolean | "full" = false): string | null {
  const short = style === true;
  const full = style === "full";
  const word = o.word ?? "Episode";
  if (o.aired <= 0) return full ? "Not on yet" : null;
  if (seen <= 0) return short ? "not started" : "Not started";
  if (o.ownPace) {
    if (o.total > 0 && seen >= o.total) return short ? "finished" : "Finished";
    if (full) return `Up to ${word} ${seen}${o.total > 0 ? ` of ${o.total}` : ""}`;
    return short || !o.total ? `Ep ${seen}` : `Ep ${seen} of ${o.total}`;
  }
  if (seen >= o.aired) return short ? "caught up" : full ? `Caught up · ${word} ${o.aired}` : "Caught up";
  return short ? `Ep ${seen}` : full ? `Up to ${word} ${seen} of ${o.aired}` : `Up to ${word} ${seen}`;
}
