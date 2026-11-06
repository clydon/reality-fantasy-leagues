import { ownPace } from "@/lib/game/streaming";
import { showWords } from "@/lib/game/show-words";
import { whereWords } from "@/lib/sharing";
import type { Couch, CouchShow, Home, HomeShow, OnNow, Space } from "../data";

// Where everyone is (the user's picks of the 2026-11-01 mocks, F, C and B): what one person on the couch watches and how far they
// are in each (the hub's couch row opens it: person-sheet.tsx), who's up to which episode on a show's Episodes tab, and Tonight's
// header line of numbered faces with the list it opens (where-sheet.tsx). Only
// what the home and space reads already carry: someone's follows they share Where I am on (guard.ts visibleFollows), so a show
// watched privately, or someone who shares nothing, never shows. The words are lib/sharing.ts whereWords' ("Up to Episode 5",
// never "On Episode 5", which reads as halfway through it). Pure, for tests/couch-where.test.js.

type Season = HomeShow | CouchShow;

/** "The Traitors", not "The Traitors (US)": the show as people say it. */
export const plainName = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, "").trim() || name;

/** "Survivor 51", "The Traitors 5": the show as people say it, and its season. */
export const seasonLabel = (s: Pick<Season, "show" | "seasonNumber">) => `${plainName(s.show.name)}${s.seasonNumber ? ` ${s.seasonNumber}` : ""}`;

export interface PersonShow {
  seasonId: string;
  label: string;
  season: Season;
  /** What the show calls an episode ("Race"), for the where sheet Add opens. */
  word: string;
  /** "Caught up · Episode 7", "Up to Episode 5 of 7", "Not started", "Finished", "Not on yet". */
  where: string;
  /** A second line worth saying: watching along now, how far ahead of you, that you don't watch it, or that it's private. */
  line: string | null;
  /** Watching along right now (the line says which episode). */
  now: boolean;
  /** On your list (you follow it or play it): open it as yours. Otherwise the sheet offers Add to my shows. */
  yours: boolean;
  /** Only you see it: a show you watch privately, or every one of yours while your Where I am is off. On your own sheet only. */
  private: boolean;
}

/**
 * What `userId` watches that the viewer may see, and how far they are in each. The viewer's own sheet is what the couch sees of
 * them, plus the shows they watch privately (only they see those, last); with their Where I am off (`youShare` false) the couch
 * sees none of it, and each says so. Order: watching now, then what you both watch (airing first), then the rest; by name.
 */
export function personShows(
  home: Pick<Home, "user" | "shows" | "couchShows">,
  couch: Pick<Couch, "members" | "games">,
  userId: string,
  now: Pick<OnNow, "userId" | "seasonId" | "episode">[] = [],
  youShare = true
): PersonShow[] {
  const me = home.user.id;
  const member = couch.members.find((m) => m.userId === userId);
  if (!member) return [];
  const seasons = new Map<string, Season>([...(home.couchShows ?? []), ...home.shows].map((s) => [s.seasonId, s]));
  const mine = new Map(home.shows.filter((s) => s.following || s.games.length > 0).map((s) => [s.seasonId, s]));
  const myMark = (s: HomeShow) => (s.seenThrough == null ? s.latestAired : s.seenThrough);
  // A season the couch plays (or you do) is weekly, as its own show space has it (show-space.tsx ownPace), even once it's over;
  // a game at your own pace on it (docs/PLAN-own-pace-games.md) leaves it at your own pace.
  const played = (s: Season) => couch.games.some((g) => g.seasonId === s.seasonId && !g.ownPace) || ("games" in s && s.games.some((g) => !g.ownPace));
  const out: PersonShow[] = [];
  const add = (seasonId: string, seen: number, priv: string | null = null) => {
    const s = seasons.get(seasonId);
    if (!s) return;
    const word = showWords(s.show.terms).episode;
    const pace = ownPace({ release: s.release, status: s.status, played: played(s) });
    const where = whereWords(seen, { aired: s.latestAired, total: s.episodeCount ?? 0, ownPace: pace, word }, "full") ?? "Not on yet";
    const on = userId === me ? undefined : now.find((w) => w.userId === userId && w.seasonId === seasonId);
    const yours = mine.get(seasonId);
    let line: string | null = null;
    if (priv) line = priv;
    else if (on) line = `Watching ${word} ${on.episode} now`;
    else if (userId !== me && !yours) line = "You don't watch it";
    else if (userId !== me && yours && seen > myMark(yours) && s.latestAired > 0) line = `${seen - myMark(yours)} ahead of you`;
    out.push({ seasonId, label: seasonLabel(s), season: s, word, where, line, now: !!on, yours: !!yours, private: !!priv });
  };
  const hidden = userId === me && !youShare ? "Only you see it: your Where I am is off" : null;
  for (const id of member.watching) add(id, member.at?.[id] ?? 0, hidden);
  // Your own private follows: on your sheet only, said as private.
  if (userId === me) for (const s of home.shows) if (s.following && s.private && !member.watching.includes(s.seasonId)) add(s.seasonId, myMark(s), "Watching privately: only you see it");
  const airing = (p: PersonShow) => p.season.status !== "completed";
  const rank = (p: PersonShow) => (p.private ? 3 : p.now ? 0 : p.yours ? 1 : 2);
  return out.sort((a, b) => rank(a) - rank(b) || Number(airing(b)) - Number(airing(a)) || a.label.localeCompare(b.label));
}

export interface Mark {
  userId: string;
  name: string;
  you: boolean;
}

/** Someone whose mark on a show is known: the last episode they've seen (0: not started). */
export interface Where extends Mark {
  seen: number;
}

/**
 * Who on the couch is where on a show: `known`, everyone whose mark the viewer may see (you first, then furthest along, then the
 * couch's order), and `quiet`: someone who plays a game here whose place isn't shown (they turned Where I am off, or never said:
 * which, isn't ours to say). A follower who doesn't share is left out: whether they watch at all is theirs to say. You're in it
 * only when your mark is known (`me.seen`: knownMark).
 */
export function marksOf(people: Space["people"], me: { id: string; name: string; seen: number | null } | null): { known: Where[]; quiet: Mark[] } {
  const known: Where[] = [];
  const quiet: Mark[] = [];
  for (const p of people ?? []) {
    if (p.userId === me?.id) continue;
    if (p.seen != null) known.push({ userId: p.userId, name: p.name, you: false, seen: Math.max(0, p.seen) });
    else if (p.playing.length > 0) quiet.push({ userId: p.userId, name: p.name, you: false });
  }
  known.sort((a, b) => b.seen - a.seen);
  if (me && me.seen != null) known.unshift({ userId: me.id, name: me.name, you: true, seen: Math.max(0, me.seen) });
  return { known, quiet };
}

/**
 * Who's up to which episode on a show (its Episodes tab): `at` by episode (the last one each has seen), `notStarted`, and
 * `quiet` (marksOf). You first in each.
 */
export function episodeMarks(people: Space["people"], me: { id: string; name: string; seen: number | null } | null): { at: Map<number, Mark[]>; notStarted: Mark[]; quiet: Mark[] } {
  const { known, quiet } = marksOf(people, me);
  const at = new Map<number, Mark[]>();
  const notStarted: Mark[] = [];
  for (const { seen, ...m } of known) {
    if (seen <= 0) notStarted.push(m);
    else at.set(seen, [...(at.get(seen) ?? []), m]);
  }
  return { at, notStarted, quiet };
}

/**
 * Your own mark on a show, when it's yours to have and known: you follow it or play it, and you don't see results straight away
 * (then it's null, and you're left out rather than guessed at). Every place that shows you among the couch reads it here.
 */
export function knownMark(o: { following: boolean; plays?: boolean; seenThrough: number | null }): number | null {
  return (o.following || !!o.plays) && o.seenThrough != null && Number.isFinite(o.seenThrough) ? o.seenThrough : null;
}

/** A show's place in time, for the words: what's aired, how many it has, and whether it's watched at your own pace. */
export type Pace = { aired: number; total: number; ownPace: boolean; word?: string };

/** Where someone is counts as the end once they've seen what's aired (a mark past it, an early mark, is the end too). */
export const atEnd = (seen: number, p: Pace) => p.aired > 0 && seen >= (p.ownPace && p.total > 0 ? p.total : p.aired);

/**
 * Where everyone is on a show, as its header's list has it (the user's pick B, 2026-11-01): one group per place, furthest first,
 * in the couch's own words (lib/sharing.ts whereWords' "full": "Caught up · Episode 7", "Up to Episode 6 of 7", "Not started";
 * at your own pace "Finished", "Up to Episode 4 of 8"). Everyone at the end is one group. Who doesn't share follows in the sheet.
 */
export function whereGroups(known: Where[], p: Pace): { seen: number; title: string; people: Where[] }[] {
  const end = p.ownPace && p.total > 0 ? p.total : p.aired;
  const placeOf = (w: Where) => (atEnd(w.seen, p) ? end : Math.max(0, w.seen));
  const places = [...new Set(known.map(placeOf))].sort((a, b) => b - a);
  return places.map((seen) => ({
    seen,
    title: whereWords(seen, p, "full") ?? "Not on yet",
    people: known.filter((w) => placeOf(w) === seen),
  }));
}

/** The header line's words: "3 caught up" over "2 catching up", "All 4 caught up", "Caught up" for one; at your own pace
 *  "finished" and "still watching". */
export function caughtUpLine(known: Where[], p: Pace): { top: string; under: string | null } {
  const caught = known.filter((w) => atEnd(w.seen, p)).length;
  const rest = known.length - caught;
  const [done, going] = p.ownPace ? ["finished", "still watching"] : ["caught up", "catching up"];
  if (!caught) return { top: `${rest} ${going}`, under: null };
  if (!rest) return { top: caught === 1 ? done[0].toUpperCase() + done.slice(1) : `All ${caught} ${done}`, under: null };
  return { top: `${caught} ${done}`, under: `${rest} ${going}` };
}

/** "riley and casey", "riley, casey and 2 more": up to `few` names, then a count. */
export function namesLine(names: string[], few = 3): string {
  const shown = names.length > few ? [...names.slice(0, few - 1), `${names.length - (few - 1)} more`] : names;
  return shown.length <= 1 ? (shown[0] ?? "") : `${shown.slice(0, -1).join(", ")} and ${shown.at(-1)}`;
}

/** A row's line: "You're here · riley and casey", or just the names. */
export function marksLine(marks: Mark[]): string {
  const others = namesLine(marks.filter((m) => !m.you).map((m) => m.name));
  return marks.some((m) => m.you) ? (others ? `You're here · ${others}` : "You're here") : others;
}
