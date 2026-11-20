import { TeamSport, sportOf, storedGame, type EspnSummary, type StoredGame } from "@/lib/sports";
import { allowed, keptAnswer, liveAnswer } from "./live-proxy";
import { requestSports } from "./request-sports";

// Live points during games (docs/PLAN-sports-ready.md step 1.1, part 3): each game of a season being played now, its lines so far,
// from the server's live poller (live-proxy.ts: the one thing that asks ESPN for a live game, at most once a game every 10 s an
// instance, whoever asks). score.ts counts them with the week they're in as early results, as part 2 counts a game final so far,
// so a matchup moves play by play; it never stores them (a game's final is still kept once, by the hourly job: finals.ts).
//
// The lines are the plays added up (TeamSport.timeline: live, just the plays; once ESPN says final, its box score's correction),
// the same as a phone's poller shows (live.ts), so what the live feed can't give (a defense's points allowed until the final, a
// stat only the box score has) waits for the final's read, as the user said ("minus the moments that the live api cant get").
//
// Only for a viewer the season shows everything to (season-games.ts asks it only for them): never a seat at its own pace or a late
// joiner, never anyone hiding sports scores or behind. Their copies are cut at their mark besides (SpoilerLogic, GhostLogic.viewFor).
// A read never waits long for ESPN: LIVE_WAIT_MS, then the last answer kept, else that game without live lines.
// Team sports only: a field's or a card's live calls (live-event.ts) are a later step.

/** How long a read waits for a new answer before it takes the last one kept. */
export const LIVE_WAIT_MS = 2_500;
/** A game started longer ago than this isn't asked live (a suspended game, a final the hourly job hasn't kept for hours). */
export const LIVE_FOR_MS = 8 * 3_600_000;
/** At most this many games asked for one read (an NFL Sunday's early slate is 9, an MLB day's 15). */
export const MAX_LIVE = 30;

/** A season's game as score.ts reads it (season_events joined to sports_events). */
export interface LiveRow {
  provider: string;
  league: string;
  event_id: string | number;
  starts_at: Date | null;
  state: string | null;
  final: boolean | null;
  lines: unknown;
}

/** The games being played, each one's lines so far by `provider|league|event`, and a version that moves when any answer does. */
export interface LiveLines {
  games: Map<string, StoredGame>;
  version: string;
}

/** Where live games are asked, for a check in-process: ESPN (undefined), its stand-in (its origin), or nowhere (null). */
let standIn: string | null | undefined = undefined;

/** For checks in-process: ask a stand-in ESPN (fake-espn.js's url), or nobody (null); undefined is ESPN again. */
export function setLiveBase(b: string | null | undefined) {
  standIn = b;
}

export const keyOf = (r: Pick<LiveRow, "provider" | "league" | "event_id">) => `${r.provider}|${r.league}|${r.event_id}`;

/** Whether a row's game is being played as the server knows it (begun, not yet kept, not called off) within LIVE_FOR_MS. */
export function beingPlayed(r: LiveRow, now: number): boolean {
  if (r.final && r.lines) return false;
  if (r.state === "post" && !r.final) return false;
  const at = r.starts_at ? r.starts_at.getTime() : null;
  if (at === null) return r.state === "in";
  return at <= now && now - at < LIVE_FOR_MS;
}

/** A parsed answer by address and when it was taken: a read every few seconds reads one answer once. */
const parsed = new Map<string, { at: number; game: StoredGame | null }>();
const PARSED_MAX = 100;

/**
 * Each of these rows' games being played now, its lines so far, in the provider's ids (score.ts puts them in the league's people);
 * null when none is. A league whose slug starts "zt-" is a check's: asked only of a stand-in, never ESPN. `now` is for checks.
 */
export async function liveLines(rows: LiveRow[], o: { now?: number } = {}): Promise<LiveLines | null> {
  const now = o.now ?? Date.now();
  // A check's request through `next dev` (apiRoute: its stand-in, or none), else what a check in-process set, else ESPN.
  const asked = requestSports.getStore();
  const base = asked !== undefined ? asked : standIn;
  if (base === null) return null;
  const seen = new Set<string>();
  const want: { key: string; sport: TeamSport; host: "site"; url: string }[] = [];
  for (const r of rows) {
    const key = keyOf(r);
    if (seen.has(key) || r.provider !== "espn" || !beingPlayed(r, now)) continue;
    seen.add(key);
    const sport = sportOf(r.league);
    if (!(sport instanceof TeamSport)) continue;
    if (base === undefined && /(^|\/)zt-/.test(r.league)) continue;
    const path = `/apis/site/v2/sports/${r.league.split("/").map(encodeURIComponent).join("/")}/summary`;
    try {
      want.push({ key, sport, host: "site", url: allowed("site", path, new URLSearchParams({ event: String(r.event_id) })).url });
    } catch {
      /* not an address the live route passes: not asked */
    }
    if (want.length >= MAX_LIVE) break;
  }
  if (!want.length) return null;
  const answers = await Promise.all(
    want.map(async (w) => {
      const asking = liveAnswer(w.host, w.url, true, base ? { base } : {});
      // Never an unhandled rejection when the read has stopped waiting: a failure falls back to what's kept, below.
      asking.catch(() => {});
      const a = await Promise.race([asking.catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), LIVE_WAIT_MS))]);
      return { w, a: a ?? keptAnswer(w.host, w.url, base ?? undefined) };
    })
  );
  const games = new Map<string, StoredGame>();
  const version: string[] = [];
  for (const { w, a } of answers) {
    if (!a) continue;
    const id = (base ?? "") + w.url;
    let hit = parsed.get(id);
    if (!hit || hit.at !== a.at) {
      let game: StoredGame | null = null;
      try {
        game = storedGame(w.sport, JSON.parse(a.body) as EspnSummary);
      } catch (e) {
        console.error("[sports] live lines:", w.key, e);
      }
      hit = { at: a.at, game };
      parsed.delete(id);
      parsed.set(id, hit);
      if (parsed.size > PARSED_MAX) parsed.delete(parsed.keys().next().value!);
    }
    if (!hit.game || !Object.keys(hit.game.lines).length) continue;
    games.set(w.key, hit.game);
    version.push(`${w.key}@${a.at}`);
  }
  return games.size ? { games, version: version.sort().join(",") } : null;
}

/** For tests: forget the answers read. */
export function forgetLiveLines() {
  parsed.clear();
}
