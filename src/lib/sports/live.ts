// A game live on the phone (docs/PLAN-start-a-game-gpt.md track L, step L2; docs/PLAN-sports-live.md, "How live stays free"):
// the phone asks ESPN's summary itself, about every 15 s while the game is on and the screen is visible, stops once it's final,
// and backs off while ESPN fails. It keeps the game's plays as a timeline (each answer read by the game's Sport, merged in) and
// gives the game on anyone's clock (clock.ts): now for someone watching live, their own for a later watch, the end for
// everyone else. A later watch of a finished game is the same, with one ask.
//
// Nothing reaches our server or Neon while a game is live: ESPN answers browsers (Access-Control-Allow-Origin: *, checked
// 2026-10-28 with plain requests; its CDN refuses a headless browser, so a person's own browser is the real check:
// scripts/dev-test/check-espn-browser.js's header), and live points are worked out here. If ESPN ever stops answering
// browsers, `base` points at one Vercel route that forwards the summary with a 15 s CDN cache (the plan's fallback; not built).
//
// Pure: fetch, the time, timers and whether the screen is visible are passed in (the phone's own; a check's 60x replay,
// scripts/dev-test/check-live-clock.js; a browser's, check-espn-browser.js; a test's virtual time, tests/sports-live.test.js).
import { stateOn, type GameClock, type Moment } from "./clock";
import { readOdds, type EspnOdds, type Odds } from "./matchup";
import { headerTeams, isFinal, msOf, str, type BoxPerson, type BoxTeam, type EspnSummary, type GameState, type Play, type TeamSport } from "./sport";

/** ESPN's site API, which answers browsers. */
export const ESPN_SITE = "https://site.api.espn.com";
/** How often a game on is asked for: ESPN caches its summary 1-7 s, so 15 s is always a new answer. */
export const EVERY_MS = 15_000;
/** The longest wait while ESPN fails (it doubles from EVERY_MS). */
export const MAX_BACKOFF_MS = 5 * 60_000;
/** Before the start, wait for it, but ask again at least this often (a start moved earlier). */
export const PRE_WAIT_MS = 10 * 60_000;

export type LiveStatus = "pre" | "in" | "post";

/** The least of fetch's answer a poll reads (the browser's Response, or a test's). */
export interface Answer {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export interface LiveOptions {
  sport: TeamSport;
  /** ESPN's league path: "basketball/nba". */
  league: string;
  /** ESPN's event id. */
  event: string;
  /** Where the summary's asked: ESPN's site API, a stand-in (scripts/dev-test/fake-espn.js) or the fallback route; the path
   *  after it is ESPN's own. */
  base?: string;
  /** When the game starts, if the page knows (the episode's air time, sports_events.starts_at); else the summary's. */
  startsAt?: string | number | null;
  every?: number;
  fetch?: (url: string) => Promise<Answer>;
  now?: () => number;
  setTimer?: (run: () => void, ms: number) => unknown;
  clearTimer?: (timer: unknown) => void;
  /** Whether the screen is visible (`document.visibilityState === "visible"`); call `visibilityChanged()` when it changes. */
  visible?: () => boolean;
  /** For the jitter (±10%, so a couch's phones don't all ask at once). */
  random?: () => number;
  /** After every ask, whether or not anything changed. */
  onChange?: (game: LiveGame) => void;
}

const STATUS_ORDER: Record<LiveStatus, number> = { pre: 0, in: 1, post: 2 };

/** An answer missing more of the plays had than this is cut short, not ESPN changing its mind, which drops a play at a time (a
 *  goal or basket wiped on review, a challenged pitch filed again): every sport's, since any answer could come cut. */
const CUT = 3;

/**
 * The timeline after an answer. Each answer holds every play so far, read in its context, so the answer's own plays win: a
 * scoring change, a call changed on review or a play ESPN dropped reads as ESPN has it now. Unless the answer is behind what's
 * already had (one from a cache edge a few seconds older): the newest play had isn't in it and its own newest is one had
 * before, or is earlier. Or it's cut short: it has the newest play but lacks more than CUT of the others (ESPN's live soccer
 * answer once came with its commentary cut to its first 40 entries, its key events whole: Liverpool–Chelsea, 2026-10-28, an
 * answer between two whole ones). Then the timeline stays, so times never go back (the plays' are in order: inOrder).
 */
export function mergeTimeline(have: Play[], fresh: Play[]): Play[] {
  if (!have.length) return fresh;
  if (!fresh.length) return have;
  const newest = have[have.length - 1];
  if (fresh.some((p) => p.id === newest.id)) {
    const ids = new Set(fresh.map((p) => p.id));
    return have.filter((p) => !p.final && !ids.has(p.id)).length > CUT ? have : fresh;
  }
  const theirs = fresh[fresh.length - 1];
  if (have.some((p) => p.id === theirs.id)) return have;
  const [t, mine] = [msOf(theirs.at), msOf(newest.at)];
  return t != null && mine != null && t < mine ? have : fresh;
}

/** The status an answer says: before, on, or over (final, or called off: a postponement is "post" and not completed). */
function statusOf(summary: EspnSummary): LiveStatus {
  const st = summary.header?.competitions?.[0]?.status?.type?.state;
  return st === "in" || st === "post" ? st : "pre";
}

/** Who's who in a game: a box score's person without their numbers (a later watch's spoiler). */
export type Person = Omit<BoxPerson, "stats">;

/**
 * A game live on the phone: ask it with `start()`, show it with `state(clock)`. Its `status`, `final` and `detail` are the
 * game's now, for asking and for someone watching live; anyone else is shown only `state(clock)` (and `sport.where` of its
 * last play), since everything else here can be ahead of their clock.
 */
export class LiveGame {
  readonly sport: TeamSport;
  readonly league: string;
  readonly event: string;
  readonly every: number;
  /** The plays so far, the final's correction last once it's final (TeamSport.timeline). */
  plays: Play[] = [];
  /** The two sides (their ids, names and home or away), from the summary's header, without its score or winner. */
  teams: BoxTeam[] = [];
  /** Who's who (ESPN's box score's people so far, by athlete id), without their numbers. */
  people: Record<string, Person> = {};
  status: LiveStatus = "pre";
  final = false;
  /** ESPN's words for where the game is now ("Top 3rd", "Final/OT"). */
  detail: string | null = null;
  /** When it starts: the page's, until ESPN's summary says (ESPN's latest wins while it's still to start). */
  startsAt: Moment | null;
  /** The sportsbook's line as of the last answer (ESPN's pickcenter), and the last one read before the game began. */
  line: Odds | null = null;
  lineAtStart: Odds | null = null;
  /** When the last answer was taken, and when the last ask went out (this game's `now`). */
  asOf: number | null = null;
  askedAt: number | null = null;
  /** Asks made, and failed in a row (the backoff's). */
  asks = 0;
  failures = 0;
  lastError: string | null = null;

  private readonly base: string;
  private readonly fetcher: (url: string) => Promise<Answer>;
  readonly now: () => number;
  private readonly setTimer: (run: () => void, ms: number) => unknown;
  private readonly clearTimer: (timer: unknown) => void;
  private readonly visible: () => boolean;
  private readonly random: () => number;
  private readonly onChange?: (game: LiveGame) => void;
  private timer: unknown = null;
  private running = false;
  private asking: Promise<boolean> | null = null;
  /** Answers in a row that looked behind what's had (take). */
  private behind = 0;

  constructor(o: LiveOptions) {
    this.sport = o.sport;
    this.league = o.league;
    this.event = o.event;
    this.every = o.every ?? EVERY_MS;
    this.base = (o.base ?? ESPN_SITE).replace(/\/$/, "");
    this.startsAt = msOf(o.startsAt ?? null);
    this.fetcher = o.fetch ?? ((url) => fetch(url, typeof AbortSignal !== "undefined" && AbortSignal.timeout ? { signal: AbortSignal.timeout(10_000) } : {}));
    this.now = o.now ?? Date.now;
    this.setTimer = o.setTimer ?? ((run, ms) => setTimeout(run, ms));
    this.clearTimer = o.clearTimer ?? ((t) => clearTimeout(t as ReturnType<typeof setTimeout>));
    this.visible = o.visible ?? (() => true);
    this.random = o.random ?? Math.random;
    this.onChange = o.onChange;
  }

  /** ESPN's summary for the game. */
  get url(): string {
    const path = this.league.split("/").map(encodeURIComponent).join("/");
    return `${this.base}/apis/site/v2/sports/${path}/summary?event=${encodeURIComponent(this.event)}`;
  }

  /** The sides' ids: the score starts at 0 each. */
  get sides(): string[] {
    return this.teams.map((t) => t.id);
  }

  /** Nothing more to ask: final, or called off. */
  get done(): boolean {
    return this.status === "post";
  }

  /** The game as of a moment (Infinity or none: the end; a moment that isn't one: nothing yet), 0-0 before the first play. */
  stateAt(at?: Moment | string | Date | null): GameState {
    return this.sport.reduce(this.plays, at, this.sides);
  }

  /** The game on someone's clock now. */
  state(clock: GameClock): GameState {
    return stateOn(this.sport, this.plays, clock, this.now(), this.sides);
  }

  /**
   * Ask once and take the answer (one ask at a time: a second call while one's out shares it). True when anything changed. A
   * failed ask (no answer, not JSON, ESPN's error, an answer the reader can't read) counts toward the backoff and changes
   * nothing.
   */
  poll(): Promise<boolean> {
    if (!this.asking) this.asking = this.ask().finally(() => (this.asking = null));
    return this.asking;
  }

  private async ask(): Promise<boolean> {
    this.asks++;
    this.askedAt = this.now();
    let changed = false;
    try {
      const res = await this.fetcher(this.url);
      if (!res.ok) throw new Error(`ESPN answered ${res.status}`);
      const summary = (await res.json()) as EspnSummary;
      if (!summary?.header) throw new Error("ESPN's answer has no game");
      try {
        changed = this.take(summary);
      } catch (e) {
        throw new Error(`couldn't read ESPN's answer: ${(e as Error).message}`);
      }
      this.failures = 0;
      this.lastError = null;
    } catch (e) {
      this.failures++;
      this.lastError = (e as Error).message;
    }
    // The page's callback: its error is the page's, and never stops the asking.
    try {
      this.onChange?.(this);
    } catch (e) {
      console.error("[live] onChange:", e);
    }
    return changed;
  }

  /**
   * Take an answer: its plays merged in, its status (never back), the sides, who's who, the start and the line. An answer
   * behind what's had changes nothing (an "in" after "post"; plays behind, mergeTimeline), unless its plays look behind twice
   * in a row: an old cache edge's answer doesn't come twice 15 s apart, so that's ESPN dropping its newest play (a basket wiped
   * on review), and it's taken. True when it brought new plays or a new status.
   */
  take(summary: EspnSummary): boolean {
    const status = statusOf(summary);
    if (STATUS_ORDER[status] < STATUS_ORDER[this.status]) return false;
    const plays = this.sport.timeline(summary);
    if (!plays.length && this.plays.length) return false;
    if (mergeTimeline(this.plays, plays) !== plays && ++this.behind < 2) return false;
    this.behind = 0;
    const [was, wasStatus, wasFinal] = [this.plays, this.status, this.final];
    const comp = summary.header?.competitions?.[0];
    this.plays = plays;
    this.status = status;
    this.final = isFinal(summary);
    this.detail = str(comp?.status?.type?.detail);
    // The sides, without the header's score or winner: the score is the state's, on someone's clock (a later watch's spoiler).
    const teams = headerTeams(summary);
    if (teams.length) this.teams = teams.map((t) => ({ ...t, score: 0, winner: null }));
    const box = this.sport.readBox(summary);
    if (box) this.people = Object.fromEntries(Object.entries(box.people).map(([id, p]) => [id, { id: p.id, name: p.name, team: p.team, position: p.position }]));
    const date = msOf(comp?.date ?? null);
    if (status === "pre" ? date != null : this.startsAt == null) this.startsAt = date;
    const line = readOdds((summary as EspnSummary & { pickcenter?: EspnOdds[] }).pickcenter?.[0]);
    if (line) this.line = line;
    if (status === "pre" && line) this.lineAtStart = line;
    this.asOf = this.now();
    return status !== wasStatus || this.final !== wasFinal || plays.length !== was.length || plays[plays.length - 1]?.id !== was[was.length - 1]?.id;
  }

  /**
   * How long until the next ask, in ms; null when there's none (final, or called off). Before the start, until it (asking again
   * at least every PRE_WAIT_MS), then 0-20% of `every` more, so a couch's phones don't all ask at the start's second; while it's
   * on, every `every` ±10%; while ESPN fails, doubling from `every` to MAX_BACKOFF_MS.
   */
  nextDelay(): number | null {
    if (this.done) return null;
    if (this.failures) return Math.min(this.every * 2 ** this.failures, MAX_BACKOFF_MS);
    if (this.status === "pre" && this.startsAt != null) {
      const until = this.startsAt - this.now();
      if (until > this.every) return Math.min(until, PRE_WAIT_MS) + Math.round(this.every * 0.2 * this.random());
    }
    return Math.round(this.every * (0.9 + 0.2 * this.random()));
  }

  /** Start asking: now, then on its own while the screen is visible, until it's final. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.cycle();
  }

  /** Stop asking (the page closed, or someone left the game). */
  stop(): void {
    this.running = false;
    this.cancel();
  }

  /**
   * The phone calls this when the screen's visibility changes: hidden, no asks; visible again, the next ask when it's due (at
   * once if it already is), by the same rhythm: every 15 s while it's on, the start before it, the backoff while ESPN fails.
   */
  visibilityChanged(): void {
    if (!this.running) return;
    if (!this.visible()) return this.cancel();
    if (this.timer || this.asking) return;
    if (this.askedAt == null) return this.cycle();
    const next = this.nextDelay();
    if (next == null) return;
    const wait = next - (this.now() - this.askedAt);
    if (wait <= 0) this.cycle();
    else this.schedule(wait);
  }

  private cancel(): void {
    if (this.timer != null) this.clearTimer(this.timer);
    this.timer = null;
  }

  private schedule(ms: number): void {
    this.cancel();
    if (!this.running || !this.visible()) return;
    this.timer = this.setTimer(() => {
      this.timer = null;
      this.cycle();
    }, Math.max(0, ms));
  }

  private cycle(): void {
    if (!this.running || !this.visible()) return;
    void this.poll()
      .catch(() => false)
      .then(() => {
        const next = this.nextDelay();
        if (next == null) this.running = false;
        else this.schedule(next);
      });
  }
}
