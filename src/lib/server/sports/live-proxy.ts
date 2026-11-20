// A game live, asked by the app, not the phone (the user, 2026-11-15: "make sure it's polled by the app, not the client, that way
// we can control polling as to not get rate limited"). Phones watching a game ask our route (src/app/api/sports/live/[host]/
// [...path]) instead of ESPN; this is the only thing that asks ESPN for a live game, and how often is decided here, in one place:
//   - Vercel's edge keeps each answer for EVERY_MS (`s-maxage`), so everyone watching one game shares one call, whatever their
//     number, and a cold edge serves the last answer while it asks again (`stale-while-revalidate`);
//   - behind it, each server instance asks ESPN at most once per FLOOR_MS for one address, and one ask at a time (a second
//     phone arriving mid-ask waits for the same answer);
//   - when ESPN fails, the last good answer is served (marked stale) and the phone's poller backs off as before (live.ts).
// Nothing is written to Neon: a live game would be a write every few seconds, and the final is kept once, as before (finals.ts).
//
// Only the addresses the pollers ask (src/lib/sports/live.ts, live-event.ts) pass: a game's summary, an event's scoreboard,
// golf's leaderboard, a race's competitors (core) and a card's fight center (web); anything else is refused, so this is no open
// proxy. A summary is cut to what the sports' readers read (ESPN's ~1 MB, with its news, videos and win probability, to its
// header, box score, plays and the like): less over the wire for each phone and for Vercel's transfer.
import { ESPN_CORE, ESPN_WEB } from "@/lib/sports/live-event";
import { ESPN_SITE } from "@/lib/sports/live";
import { HttpError } from "../http-error";

/** How long the edge keeps a live answer: the pollers ask every 15 s, ESPN's own cache is 1-7 s. */
export const EVERY_MS = 15_000;
/** The least time between two of this instance's asks for one address. */
export const FLOOR_MS = 10_000;
/** A game over, or not started: its answer changes rarely. */
const SETTLED_S = 300;
const TIMEOUT_MS = 12_000;
const UA = { "User-Agent": "GameYourShow/1.0" };

export type LiveHost = "site" | "core" | "web";
const HOSTS: Record<LiveHost, string> = { site: ESPN_SITE, core: ESPN_CORE, web: ESPN_WEB };

const seg = "[A-Za-z0-9._-]+";
/** The paths each host may be asked for (after its host), and the query keys each may carry. */
const ALLOWED: { host: LiveHost; path: RegExp; query: string[]; summary?: boolean }[] = [
  { host: "site", path: new RegExp(`^/apis/site/v2/sports/${seg}/${seg}/summary$`), query: ["event"], summary: true },
  { host: "site", path: new RegExp(`^/apis/site/v2/sports/${seg}/${seg}/scoreboard/${seg}$`), query: [] },
  { host: "site", path: /^\/apis\/site\/v2\/sports\/golf\/leaderboard$/, query: ["event"] },
  { host: "core", path: new RegExp(`^/v2/sports/racing/leagues/${seg}/events/${seg}/competitions(/${seg}(/competitors(/${seg}(/statistics)?)?)?)?$`), query: ["limit"] },
  { host: "web", path: new RegExp(`^/apis/common/v3/sports/${seg}/${seg}/fightcenter/${seg}$`), query: ["region", "lang", "contentorigin"] },
];

/** The sections of a game's summary the sports' readers read (src/lib/sports: header, boxscore, plays, drives, ...). */
const SUMMARY_KEEPS = ["header", "boxscore", "plays", "drives", "scoringPlays", "rosters", "keyEvents", "format", "commentary"];

/** A summary cut to what's read; its line (pickcenter) to the first, the only one read. */
export function trimSummary(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of SUMMARY_KEEPS) if (raw[k] !== undefined) out[k] = raw[k];
  if (Array.isArray(raw.pickcenter) && raw.pickcenter.length) out.pickcenter = [raw.pickcenter[0]];
  return out;
}

/** The address asked for, checked: host, path and query as the pollers make them; else a 404. */
export function allowed(host: string, path: string, search: URLSearchParams): { url: string; summary: boolean } {
  const rule = ALLOWED.find((r) => r.host === host && r.path.test(path));
  if (!rule) throw new HttpError(404, "Not a live game's address");
  const q = new URLSearchParams();
  for (const k of rule.query) {
    const v = search.get(k);
    if (v != null) {
      if (!/^[A-Za-z0-9._-]{1,40}$/.test(v)) throw new HttpError(400, "Bad " + k);
      q.set(k, v);
    }
  }
  if (rule.summary && !q.get("event")) throw new HttpError(400, "A summary needs its event");
  const qs = q.toString();
  return { url: path + (qs ? "?" + qs : ""), summary: !!rule.summary };
}

/** Whether a game's answer is settled (over, or not begun): ESPN's state, as the pollers read it. */
function settled(body: Record<string, unknown>): boolean {
  const state = (body as { header?: { competitions?: { status?: { type?: { state?: string } } }[] } }).header?.competitions?.[0]?.status?.type?.state;
  return state === "post" || state === "pre";
}

interface Kept { at: number; body: string; settled: boolean }
const kept = new Map<string, Kept>();
const asking = new Map<string, Promise<Kept>>();
const KEEP_MAX = 200;

/** ESPN's answer for a checked address, at most once per FLOOR_MS per instance, one ask at a time. `base`: a stand-in (checks).
 *  `at`: when the answer was taken (this instance's clock), so a reader can tell a new answer from the one it read before. */
export async function liveAnswer(host: LiveHost, url: string, summary: boolean, opts: { base?: string; now?: number; fetch?: typeof fetch } = {}): Promise<{ body: string; stale: boolean; settled: boolean; at: number }> {
  const now = opts.now ?? Date.now();
  const key = (opts.base ?? "") + host + url;
  const last = kept.get(key);
  if (last && now - last.at < FLOOR_MS) return { body: last.body, stale: false, settled: last.settled, at: last.at };
  let p = asking.get(key);
  if (!p) {
    p = (async () => {
      const r = await (opts.fetch ?? fetch)((opts.base ?? HOSTS[host]) + url, { headers: UA, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!r.ok) throw new HttpError(r.status === 404 ? 404 : 502, `ESPN answered ${r.status}`);
      const json = (await r.json()) as Record<string, unknown>;
      const body = summary ? trimSummary(json) : json;
      const k: Kept = { at: now, body: JSON.stringify(body), settled: summary ? settled(body) : false };
      kept.set(key, k);
      if (kept.size > KEEP_MAX) kept.delete(kept.keys().next().value!);
      return k;
    })().finally(() => asking.delete(key));
    asking.set(key, p);
  }
  try {
    const k = await p;
    return { body: k.body, stale: false, settled: k.settled, at: k.at };
  } catch (e) {
    if (last && !(e instanceof HttpError && e.status === 404)) return { body: last.body, stale: true, settled: last.settled, at: last.at };
    throw e instanceof HttpError ? e : new HttpError(502, "ESPN didn't answer");
  }
}

/** The edge's keeping for an answer: EVERY_MS while a game is on, longer once it's settled; a stale one briefly. */
export function cacheControl(a: { stale: boolean; settled: boolean }): string {
  const s = a.stale ? 5 : a.settled ? SETTLED_S : EVERY_MS / 1000;
  return `public, s-maxage=${s}, stale-while-revalidate=${s}`;
}

/** The last answer kept for an address, however old (a reader that can't wait for a new one: live-lines.ts), or null. */
export function keptAnswer(host: LiveHost, url: string, base?: string): { body: string; settled: boolean; at: number } | null {
  const k = kept.get((base ?? "") + host + url);
  return k ? { body: k.body, settled: k.settled, at: k.at } : null;
}

/** For tests: forget what's kept. */
export function forgetLive() {
  kept.clear();
  asking.clear();
}
