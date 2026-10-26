// Watch along's rules (docs/PLAN-new-design.md step 13 part 1; the mock's index.html openWatch and watching.js), kept pure so
// tests/watch-along.test.js can check them: which episode a watch along is for, what of the couch's reactions someone at a moment
// may be sent (30 seconds late and never early), the clock, and what a reaction may carry. The server (src/lib/server/watch-along.ts)
// and the screen (src/new/show/watch-along.tsx) both read these.

/** Others' reactions arrive this long after their moment, never before it (the mock's SAFETY). */
export const LATE_MS = 30_000;
/** The four quick reactions, in the bar's order (the mock's REACT_KINDS). */
export const REACT_KINDS = ["fire", "laugh", "eye", "crown"] as const;
export type ReactKind = (typeof REACT_KINDS)[number];
export type ReactionKind = "text" | "gif" | ReactKind;
export const TEXT_MAX = 200;
/** No episode runs longer than six hours (the column's check). */
export const MAX_RUNTIME_MS = 6 * 3600_000;
/** On a jump (opening, or moving the clock), the stream shows what was said this long before where you are. */
export const STREAM_BACK_MS = 90_000;

export const isReactKind = (k: unknown): k is ReactKind => typeof k === "string" && (REACT_KINDS as readonly string[]).includes(k);

export interface Gif {
  id: string;
  url: string;
  w: number;
  h: number;
  title: string;
}

/** A GIF's picture only from GIPHY's own media hosts (what /api/gifs hands out), so nothing else is put in front of the couch. */
export function giphyUrl(url: unknown): url is string {
  if (typeof url !== "string" || url.length > 500) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && /^(media\d*|i)\.giphy\.com$/.test(u.hostname);
  } catch {
    return false;
  }
}

/** A GIF as it may be kept, or null for anything else. */
export function cleanGif(g: unknown): Gif | null {
  if (!g || typeof g !== "object") return null;
  const o = g as Record<string, unknown>;
  const id = typeof o.id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(o.id) ? o.id : null;
  const dim = (v: unknown) => (Number.isInteger(v) && (v as number) > 0 && (v as number) <= 2000 ? (v as number) : null);
  const w = dim(o.w);
  const h = dim(o.h);
  if (!id || !giphyUrl(o.url) || !w || !h) return null;
  const title = typeof o.title === "string" ? o.title.replace(/\s+/g, " ").trim().slice(0, 100) : "";
  return { id, url: o.url, w, h, title };
}

/** A comment as it's kept: one line, tidied; null when there's nothing to it. */
export function cleanText(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const t = s.replace(/\s+/g, " ").trim();
  return t ? t : null;
}

/**
 * Which episode a watch along is for, from where you are (`mark`: the last episode you've seen; Infinity when you see
 * everything straight away), the latest episode that's started airing, the next one to air and the one on now: your next
 * episode once it's aired (on now: "live"), or the next to air when you're caught up ("soon": it opens at airtime). Null when
 * there's nothing to watch (the season's over and you've seen it, or nothing has a time).
 */
export function watchEpisode(o: { mark: number; latestAired: number; next: number | null; live: number | null }): { episode: number; status: "aired" | "live" | "soon" } | null {
  const status = (n: number) => (o.live === n ? "live" : "aired") as "aired" | "live";
  if (!Number.isFinite(o.mark)) {
    if (o.live) return { episode: o.live, status: "live" };
    if (o.next) return { episode: o.next, status: "soon" };
    return o.latestAired ? { episode: o.latestAired, status: "aired" } : null;
  }
  const n = Math.max(0, o.mark) + 1;
  if (n <= o.latestAired) return { episode: n, status: status(n) };
  if (o.next === n) return { episode: n, status: "soon" };
  return null;
}

/**
 * Whether someone may watch along episode `n`, and how it stands: one they've seen or their next one, once it's aired (or the next
 * to air, before its airtime: "soon"). A refusal says why, for the server's 403 or 409.
 */
export function mayWatch(n: number, o: { mark: number; latestAired: number; next: number | null; live: number | null }):
  | { ok: true; status: "aired" | "live" | "soon" }
  | { ok: false; status: 403 | 409; error: string } {
  if (Number.isFinite(o.mark) && n > Math.max(0, o.mark) + 1) return { ok: false, status: 403, error: `You're on Episode ${Math.max(0, o.mark) + 1}: watch along that one first` };
  if (n <= o.latestAired) return { ok: true, status: o.live === n ? "live" : "aired" };
  if (o.next === n) return { ok: true, status: "soon" };
  return { ok: false, status: 409, error: `Episode ${n} has no air time yet` };
}

/**
 * How far into an episode the couch's reactions may be sent to someone at `atMs`: LATE_MS behind them, and never past what has
 * aired (`airedForMs`: how long ago it first aired; null before then). -1 when nothing may be.
 */
export function othersThrough(atMs: number, airedForMs: number | null): number {
  if (airedForMs === null || airedForMs < 0 || !Number.isFinite(atMs)) return -1;
  const through = Math.min(Math.max(0, atMs), airedForMs, MAX_RUNTIME_MS) - LATE_MS;
  return through >= 0 ? through : -1;
}

/** "12:03", or "1:02:03" past an hour. */
export function runtimeText(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** "12:03" (or "12", "1:02:03") read back as milliseconds; null for anything else. */
export function parseRuntime(s: string): number | null {
  const parts = s.trim().split(":");
  if (!parts.length || parts.length > 3 || parts.some((p) => !/^\d{1,3}$/.test(p))) return null;
  const nums = parts.map(Number);
  if (nums.slice(1).some((n) => n > 59)) return null;
  const secs = nums.length === 1 ? nums[0] * 60 : nums.reduce((acc, n) => acc * 60 + n, 0);
  const ms = secs * 1000;
  return ms <= MAX_RUNTIME_MS ? ms : null;
}

/**
 * A watch along's clock: where it stood (`at`, ms into the episode), and since when it's been running (`since`, the wall clock
 * in ms; null while paused or in an ad break). Read at `now`.
 */
export interface Clock {
  at: number;
  since: number | null;
}

export function clockAt(c: Clock, now: number): number {
  return Math.min(MAX_RUNTIME_MS, c.since === null ? c.at : c.at + Math.max(0, now - c.since));
}

export const runClock = (c: Clock, now: number): Clock => (c.since === null ? { at: c.at, since: now } : c);
export const stopClock = (c: Clock, now: number): Clock => ({ at: clockAt(c, now), since: null });
/** Moved by `byMs` (−10 s, +10 s) or set to `toMs`, running on if it was. */
export const moveClock = (c: Clock, now: number, to: { byMs: number } | { toMs: number }): Clock => {
  const at = Math.min(MAX_RUNTIME_MS, Math.max(0, "toMs" in to ? to.toMs : clockAt(c, now) + to.byMs));
  return { at, since: c.since === null ? null : now };
};

/** "riley and sam", "riley, sam and 2 more". */
export function namesLine(names: string[]): string {
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
}

/** Tonight's card, and the start screen: who on the couch left reactions on the episode (a count, never what they said). */
export function leftLine(people: string[], count: number): string {
  if (!count || !people.length) return "Be the first. Your reactions wait for whoever watches next.";
  return `${namesLine(people)} left ${count} ${count === 1 ? "reaction" : "reactions"} · they show up as you reach them`;
}
