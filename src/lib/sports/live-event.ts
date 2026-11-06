// A field's, a card's or a draw's event live on the phone (docs/PLAN-start-a-game-gpt.md track L, L2 part 2): golf's rounds, a
// tennis event's matches, a race weekend's sessions and a fight card's bouts. As a game's poller does (live.ts), the phone asks
// ESPN itself while something's on and the screen is visible, works the event out here, and nothing reaches our server while
// it's live. An ask can go in rounds (racing's and MMA's: their boards first, then the core API's calls the boards say are
// wanted), and what a later round had is kept between asks, so a session's grid or a bout's statistics are asked once.
//
// What's different from a game: ESPN times little in these answers (nothing of golf's holes, tennis's sets and results or a
// session's results: L5 parts 3a, 3b and 4b; a bout's plays it does), so a reader stamps what an answer tells it with when the
// answer was had (`_asked`) at the latest, and every poll would move
// a just-finished hole or match on to its own moment. **The poller keeps the moment each play was first seen as it is**: a play
// an answer has again, the same (its kind, words and numbers; not its moment, nor a running score or standings, which a hole
// rescored before it changes), keeps its earliest moment; a play ESPN changes (a hole rescored, a set's games going on) counts
// from the answer that first had it that way. So a later watch never sees anything before a phone could have.
//
// Pure, as live.ts: fetch, the time, timers and the screen are passed in (tests/sports-live-event.test.js's virtual time;
// scripts/dev-test/check-live-event.js replays the live recordings through it).
import { momentOf, type GameClock, type Moment } from "./clock";
import { CUT_SHORT, ESPN_SITE, PRE_WAIT_MS, Poller, type LiveStatus, type PollerOptions } from "./live";
import { Golf } from "./golf";
import { MMA, mmaCenterStats, mmaCoreStats, playsEnd } from "./mma";
import { Racing, coreFilled, coreReads, coreStats, weekendOver } from "./racing";
import { Tennis, boardMatches, matchOver, matchSuspended } from "./tennis";
import { fieldEventOf, idOf, isoOf, msOf, num, str, type BoutAnswer, type BoutCard, type BoutPlay, type BoutSport, type BoutState, type EspnBoutCompetition, type EspnBoutCore, type EspnBoutPlay, type EspnCoreCompetitor, type EspnFieldEvent, type FieldAnswer, type FieldEvent, type FieldPlay, type FieldSport, type FieldState, type Play } from "./sport";

/** ESPN's core API and its web API (a fight card's FightCenter), which answer browsers too (CORS `*`, checked 2026-11-05). */
export const ESPN_CORE = "https://sports.core.api.espn.com";
export const ESPN_WEB = "https://site.web.api.espn.com";
/** The most rounds an ask goes in (racing's: the board, a probe of the winner's statistics, then everyone's). */
const MAX_ROUNDS = 4;

/** Golf's two answers every minute while a round is on: a group plays a hole in ~13 minutes (the Mexico Open's round 2: ~3 holes
 *  a minute across the field, 33 KB an ask). */
export const FIELD_EVERY_MS = 60_000;
/** A draw's board every 30 s while a match is on: ESPN's live games come about one per changed answer (Basel 2026), 12 KB an ask. */
export const DRAW_EVERY_MS = 30_000;
/** How long after a match's listed start it's asked for on the rhythm though it isn't on yet (the court's match before it running
 *  long): a day's play, about. */
const DUE_MS = 3 * 3600_000;
/** How long after a round's first tee time listed it's asked for on the rhythm though ESPN doesn't have the round in play yet
 *  (ESPN's lag; a fog delay). */
const TEE_DUE_MS = 60 * 60_000;
/** How long after its start a suspended match keeps a draw on (ESPN's feed stalled, back in minutes: Basel 2026); past it (rain
 *  overnight, or a stall ESPN never clears), the draw waits as between. A Grand Slam's five sets run five hours or so. */
const SUSPENDED_ON_MS = 6 * 3600_000;

const enc = encodeURIComponent;
/** ESPN's league path in a URL ("racing/f1"), each part encoded. */
const leaguePath = (league: string) => league.split("/").map(enc).join("/");

/** Where an event is, from an answer: on (ask every `every`), between (the next start, if one's known), or over for good. */
export interface EventWhere {
  status: LiveStatus;
  /** The next start of something to come (a round's first tee time, a match's listed start), while nothing's on. */
  next: number | null;
  /** ESPN's words for where it is ("Round 2 - In Progress"). */
  detail: string | null;
}

/** What a feed's later rounds are asked from: everything had (this ask's answers over those kept from earlier asks), this ask's
 *  alone, the time, and the event. */
export interface FeedAsk {
  had: Record<string, unknown>;
  got: Record<string, unknown>;
  now: number;
  league: string;
  event: string;
}

/** How one kind of event is asked for and read: the calls asked together, the answer they make, and the sport's reading. A path
 *  is ESPN's site API's after the base ("/apis/site/v2/..."), or its core API's or web API's (`core:/v2/...`, `web:/apis/...`). */
export interface EventFeed<A, P extends Play, E, S> {
  every: number;
  /** The first round's calls, every ask, by the answer's key ("board", "leaderboard"); each must answer, but `optional`'s. */
  paths(league: string, event: string): Record<string, string>;
  /** First-round calls an ask goes on without (a card's FightCenter: the board says who won), taken as a later round's are. */
  optional?: string[];
  /** The next round's calls, by key, from what's had so far; none (null or empty): the answer's made. A later round's call ESPN
   *  answers 404 is had as null (it has none), unless something was had for it before (kept: ESPN's 404 for a moment); one that
   *  fails otherwise isn't had this time (the last answer kept), so it can be asked again next time. */
  more?(ask: FeedAsk): Record<string, string> | null;
  /** The answer from everything had, as the sport reads it; null when it has no event. */
  answer(had: Record<string, unknown>, asked: string): A | null;
  timeline(answer: A): P[];
  eventOf(answer: A): E | null;
  reduce(plays: P[], at: Moment | string | Date | null | undefined, event: E): S;
  where(answer: A, now: number): EventWhere;
}

export interface LiveEventOptions<A, P extends Play, E, S> extends PollerOptions {
  feed: EventFeed<A, P, E, S>;
  /** ESPN's league path: "golf/pga", "tennis/atp". */
  league: string;
  /** ESPN's event id: "401850978", "23-2026". */
  event: string;
  /** Where it's asked: ESPN's site API or a stand-in; the paths after it are ESPN's own. `core` and `web` the same for ESPN's
   *  core and web APIs. */
  base?: string;
  core?: string;
  web?: string;
  onChange?: (live: LiveEvent<A, P, E, S>) => void;
}

/** A play as first seen: its content, apart from its moment and what a change to an earlier play moves (a running score, the
 *  standings). check-live-event.js keys plays by it too. */
export function contentOf(p: Play): string {
  const rest: Record<string, unknown> = { ...p };
  delete rest.at;
  delete rest.score;
  delete rest.places;
  return JSON.stringify(rest);
}

/**
 * The plays of an answer, each at the moment it was first seen as it is (`seen`, by its id and content: kept across answers, so
 * an answer that lacked a play for a poll doesn't move it on), in time order (a moment's plays are the first so many: the
 * reduces stop at the first one after it).
 */
export function firstSeen<P extends Play>(seen: Map<string, number>, fresh: P[]): P[] {
  return firstSeenOf(seen, fresh).plays;
}

/** firstSeen, and whether any play was seen as it is for the first time (new, or changed). */
function firstSeenOf<P extends Play>(seen: Map<string, number>, fresh: P[]): { plays: P[]; fresh: boolean } {
  let first = false;
  const out = fresh.map((p, i) => {
    const key = `${p.id}\u0000${contentOf(p)}`;
    const t = msOf(p.at);
    const had = seen.get(key);
    const at = had != null && (t == null || had < t) ? had : t;
    if (had == null) first = true;
    if (at != null) seen.set(key, at);
    return { p: at === t ? p : { ...p, at: isoOf(at) }, at, i };
  });
  out.sort((a, b) => (a.at ?? Infinity) - (b.at ?? Infinity) || a.i - b.i);
  return { plays: out.map((x) => x.p), fresh: first };
}

/**
 * An event live on the phone: ask it with `start()`, show it with `state(clock)`. Its `status` and `detail` are the event's now,
 * for asking and for someone watching live; anyone else is shown only `state(clock)`.
 */
export class LiveEvent<A, P extends Play, E, S> extends Poller {
  readonly feed: EventFeed<A, P, E, S>;
  readonly league: string;
  readonly event: string;
  /** The plays so far, each at its first sight, the final's correction last once it's final. */
  plays: P[] = [];
  /** The event (its field, or its card of bouts) from the last answer. */
  shape: E | null = null;
  status: LiveStatus = "pre";
  detail: string | null = null;
  /** When the next thing starts, while nothing's on. */
  next: number | null = null;
  /** The last answer taken (the server's stored final reads it: final.ts storedField, storedCard). */
  answer: A | null = null;

  /** Every call's last answer, by its key, kept between asks (a later round's: a session's grid, a bout's statistics). */
  had: Record<string, unknown> = {};

  private readonly hosts: Record<string, string>;
  private readonly onChange?: (live: LiveEvent<A, P, E, S>) => void;
  private readonly seen = new Map<string, number>();
  /** Answers in a row that lacked plays had (take). */
  private behind = 0;

  constructor(o: LiveEventOptions<A, P, E, S>) {
    super(o, o.feed.every);
    this.feed = o.feed;
    this.league = o.league;
    this.event = o.event;
    const host = (x: string | undefined, or: string) => (x ?? or).replace(/\/$/, "");
    this.hosts = { site: host(o.base, ESPN_SITE), core: host(o.core, ESPN_CORE), web: host(o.web, ESPN_WEB) };
    this.onChange = o.onChange;
  }

  /** A feed's path as a URL: the site API's, or the core's or the web API's (`core:`, `web:`). */
  url(path: string): string {
    const m = /^(core|web):(.*)$/.exec(path);
    return m ? `${this.hosts[m[1]]}${m[2]}` : `${this.hosts.site}${path}`;
  }

  /** The first round's URLs, asked together every ask, by the answer's key. */
  get urls(): Record<string, string> {
    return Object.fromEntries(Object.entries(this.feed.paths(this.league, this.event)).map(([k, p]) => [k, this.url(p)]));
  }

  /** Nothing more to ask: every round, match or bout over. */
  get done(): boolean {
    return this.status === "post";
  }

  /** The event as of a moment (Infinity or none: the end); null before the first answer. */
  stateAt(at?: Moment | string | Date | null): S | null {
    return this.shape == null ? null : this.feed.reduce(this.plays, at, this.shape);
  }

  /** The event on someone's clock now. */
  state(clock: GameClock): S | null {
    return this.stateAt(momentOf(clock, this.now()));
  }

  protected async fetchAndTake(): Promise<boolean> {
    const asked = isoOf(this.now())!;
    const got: Record<string, unknown> = {};
    // A call that may fail: ESPN's 404 is its answer that there's none (unless something was had for it before: kept); any other
    // failure leaves it to the next ask.
    const maybe = async (k: string, url: string) => {
      try {
        const res = await this.fetcher(url);
        if (res.ok) got[k] = await res.json();
        else if (res.status === 404 && this.had[k] === undefined) got[k] = null;
      } catch {
        // Asked again next time.
      }
    };
    const optional = new Set(this.feed.optional ?? []);
    await Promise.all(
      Object.entries(this.urls).map(async ([k, url]) => {
        if (optional.has(k)) return maybe(k, url);
        const res = await this.fetcher(url);
        if (!res.ok) throw new Error(`ESPN answered ${res.status} for ${k}`);
        got[k] = await res.json();
      }),
    );
    // The later rounds, each call tried once an ask.
    const tried = new Set(Object.keys(this.urls));
    for (let round = 1; round < MAX_ROUNDS && this.feed.more; round++) {
      const next = Object.entries(this.feed.more({ had: { ...this.had, ...got }, got, now: this.now(), league: this.league, event: this.event }) ?? {}).filter(([k]) => !tried.has(k));
      if (!next.length) break;
      for (const [k] of next) tried.add(k);
      await Promise.all(next.map(([k, p]) => maybe(k, this.url(p))));
    }
    this.had = { ...this.had, ...got };
    const answer = this.feed.answer(this.had, asked);
    if (!answer) throw new Error("ESPN's answer has no event");
    try {
      return this.take(answer);
    } catch (e) {
      throw new Error(`couldn't read ESPN's answer: ${(e as Error).message}`);
    }
  }

  protected notify(): void {
    this.onChange?.(this);
  }

  /**
   * Take an answer: its plays, each at its first sight; where the event is (never back from over); its shape. An answer with no
   * plays once some are had changes nothing (as LiveGame's), and one lacking more than CUT_SHORT of the plays had (cut short, or
   * from an older cache edge) nothing unless it comes twice in a row (ESPN dropping them: a hole moved to another round). True
   * when it brought a play new or changed, dropped one, or a new status.
   */
  take(answer: A): boolean {
    const where = this.feed.where(answer, this.now());
    if (this.status === "post" && where.status !== "post") return false;
    const fresh = this.feed.timeline(answer);
    if (!fresh.length && this.plays.length) return false;
    const ids = new Set(fresh.map((p) => p.id));
    if (this.plays.filter((p) => !p.final && !ids.has(p.id)).length > CUT_SHORT && ++this.behind < 2) return false;
    this.behind = 0;
    const was = this.plays;
    const wasStatus = this.status;
    const got = firstSeenOf(this.seen, fresh);
    this.plays = got.plays;
    this.status = where.status;
    this.detail = where.detail;
    this.next = where.next;
    this.shape = this.feed.eventOf(answer) ?? this.shape;
    this.answer = answer;
    this.asOf = this.now();
    // A play's moment changes only with a first sight (a play new or changed), so that and the ids say whether anything did.
    return this.status !== wasStatus || got.fresh || was.length !== this.plays.length || was.some((p, i) => p.id !== this.plays[i].id);
  }

  /** How long until the next ask: none once it's over; the backoff while ESPN fails; every `every` while something's on;
   *  before the next start, until it (asking again at least every PRE_WAIT_MS); with none known, every PRE_WAIT_MS. */
  nextDelay(): number | null {
    if (this.done) return null;
    const failing = this.backoff();
    if (failing != null) return failing;
    if (this.status === "in") return this.jittered();
    // No next start known: every PRE_WAIT_MS, as before one far off.
    if (this.next == null) return PRE_WAIT_MS + Math.round(this.every * 0.2 * this.random());
    return this.untilStart(this.next) ?? this.jittered();
  }
}

/* ---- Golf (L5 part 3a's reader). ---- */

export type LiveField = LiveEvent<FieldAnswer, FieldPlay, FieldEvent, FieldState>;

/**
 * Golf's feed: the tour's board for the event (`golf/<tour>/scoreboard/<event>`: its holes) and the leaderboard
 * (`golf/leaderboard?event=`: its rounds, places and tee times), both CORS `*`, every minute while a round's on. On: the
 * leaderboard's competition in play; over: the event final; between rounds: until the next tee time listed.
 */
export function golfFeed(sport: FieldSport): EventFeed<FieldAnswer, FieldPlay, FieldEvent, FieldState> {
  return {
    every: FIELD_EVERY_MS,
    paths: (league, event) => {
      const e = enc(event);
      return { board: `/apis/site/v2/sports/${leaguePath(league)}/scoreboard/${e}`, leaderboard: `/apis/site/v2/sports/golf/leaderboard?event=${e}` };
    },
    answer: (got, asked) => {
      const a = { _asked: asked, board: got.board, leaderboard: got.leaderboard } as FieldAnswer;
      return fieldEventOf(a, "leaderboard") ? a : null;
    },
    timeline: (a) => sport.timeline(a),
    eventOf: (a) => sport.fieldEvent(a),
    reduce: (plays, at, event) => sport.reduce(plays, at, event),
    where: (a, now) => {
      const lb = fieldEventOf(a, "leaderboard");
      const ev = lb?.status?.type;
      const comp = lb?.competitions?.[0];
      const st = comp?.status?.type;
      const detail = str(st?.detail) ?? str(ev?.detail) ?? null;
      if (ev?.state === "post" && ev?.completed === true) return { status: "post", next: null, detail };
      if (st?.state === "in") return { status: "in", next: null, detail };
      const tees = (comp?.competitors ?? []).map((c) => msOf(c.status?.teeTime ?? null)).filter((t): t is number => t != null);
      const future = tees.filter((t) => t > now);
      // A tee time gone in the last hour with the round not in play on ESPN yet (its lag, a delay): ask on the rhythm.
      const due = tees.some((t) => t <= now && now - t < TEE_DUE_MS);
      return { status: due ? "in" : "pre", next: future.length ? Math.min(...future) : null, detail };
    },
  };
}

/* ---- A tennis event's draws (L5 part 4b's reader). ---- */

export type LiveDraw = LiveEvent<BoutAnswer, BoutPlay, BoutCard, BoutState>;

/**
 * A tennis event's feed: its board (`tennis/<tour>/scoreboard/<event>`, every draw's matches; CORS `*`), every 30 s while a match
 * is on (a suspended one too: ESPN's feed stalled, back on in minutes). Over: every match over (or called off) and the event's
 * last day gone; between matches: until the next listed start (not ESPN's placeholder for one not yet scheduled, `timeValid`
 * false).
 */
export function drawFeed(sport: BoutSport): EventFeed<BoutAnswer, BoutPlay, BoutCard, BoutState> {
  return {
    every: DRAW_EVERY_MS,
    paths: (league, event) => ({ board: `/apis/site/v2/sports/${leaguePath(league)}/scoreboard/${enc(event)}` }),
    answer: (got, asked) => {
      const board = got.board as BoutAnswer["board"];
      return board && board.id != null ? { _asked: asked, board } : null;
    },
    timeline: (a) => sport.timeline(a),
    eventOf: (a) => sport.card(a),
    reduce: (plays, at, card) => sport.reduce(plays, at, card),
    where: (a, now) => {
      const ms = boardMatches(a).map((x) => x.c);
      // A suspended match keeps the draw on for SUSPENDED_ON_MS from its start; once the event's last day is gone it doesn't hold
      // it open (a stall ESPN never cleared).
      const held = (c: EspnBoutCompetition) => matchSuspended(c) && now - (msOf(c.date ?? null) ?? now) < SUSPENDED_ON_MS;
      const on = ms.filter((c) => c.status?.type?.state === "in" || held(c));
      const end = msOf(a.board?.endDate ?? null);
      const gone = end != null && end < now;
      if (ms.length && ms.every((c) => matchOver(c) || (gone && matchSuspended(c))) && (end == null || gone)) return { status: "post", next: null, detail: str(a.board?.status?.type?.detail) ?? null };
      if (on.length) return { status: "in", next: null, detail: `${on.length} on` };
      const starts = ms.filter((c) => c.status?.type?.state === "pre" && c.timeValid !== false).map((c) => msOf(c.date ?? null)).filter((t): t is number => t != null);
      const future = starts.filter((t) => t > now);
      // A listed start gone in the last few hours with the match not on yet (ESPN's start is a scheduled time, ESPN's answers ~5
      // minutes behind a match): ask on the rhythm. One gone longer (a day's play called off) waits as between.
      const due = starts.some((t) => t <= now && now - t < DUE_MS);
      return { status: due ? "in" : "pre", next: future.length ? Math.min(...future) : null, detail: null };
    },
  };
}

/* ---- A race weekend (L5 part 3b's reader). ---- */

export type LiveRace = LiveEvent<FieldAnswer, FieldPlay, FieldEvent, FieldState>;

/** A race weekend's board every 30 s while a session's on (its order is a race's running order, not practice's: L5 part 3b), 2-4
 *  KB over the wire an ask. */
export const RACE_EVERY_MS = 30_000;
/** How long after a session's listed start it's asked for on the rhythm though ESPN hasn't it on yet: its first order came 6
 *  (FP1) and 11 minutes (Martinsville) after its start (L5 part 3b); a delay. */
const SESSION_DUE_MS = 60 * 60_000;
/** How long from a session's start its statistics are waited for: a counted series' are filled in after the race (live, every
 *  car had the race's laps and nobody a lap led, still at the first final answer: L5 part 3b). */
const FILL_MS = 12 * 3600_000;

/** A session as the race feed asks for it: its board line, what its core is read for (racing.ts's coreReads), who's on the
 *  board and its winner (its order 1, else ESPN's flag). */
interface RaceSession {
  id: string;
  state: string | null;
  /** Not called off ("post" and not completed is). */
  completed: boolean;
  start: number | null;
  reads: { grid: boolean; stats: boolean; status: boolean; fills: boolean };
  ids: string[];
  winner: string | null;
}

function raceSessions(board: EspnFieldEvent | null, feed: Racing["feed"]): RaceSession[] {
  const comps = board?.competitions ?? [];
  return comps.map((c) => {
    const cs = c.competitors ?? [];
    const first = cs.find((x) => num(x.order) === 1) ?? cs.find((x) => x.winner === true);
    return { id: idOf(c.id), state: str(c.status?.type?.state), completed: c.status?.type?.completed !== false, start: msOf(c.date ?? null), reads: coreReads(c.type?.abbreviation, comps.length === 1, feed), ids: cs.map((x) => idOf(x.id)).filter(Boolean), winner: first ? idOf(first.id) : null };
  });
}

/** The core's list of a session's competitors (`.../competitors?limit=200`). */
type CoreList = { items?: EspnCoreCompetitor[] } | null | undefined;
/** A list's competitors without ESPN's links to their statistics and status (asked apart). */
const listed = (list: CoreList): EspnCoreCompetitor[] =>
  (list?.items ?? []).map((c) => {
    const o = { ...c };
    delete o.statistics;
    delete o.status;
    return o;
  });

/**
 * A race weekend's feed (F1's, NASCAR's three series', IndyCar's): its board (`racing/<series>/scoreboard/<event>`: each session's
 * order, the running order in a race) every 30 s while a session's on, and from ESPN's core API what the reader reads of a
 * session (racing.ts's coreReads), each once: a race's or a sprint's list from its start, for the grid (`startOrder`; asked again
 * while it's on until the list has one); qualifying's, a sprint's and a race's statistics once it's over, F1's with each driver's
 * status. A counted series' statistics aren't the cars' until ESPN fills them in after the race (L5 part 3b): its winner's are
 * asked first, every ask (every 10 minutes once it's over) for 12 hours from its start, and everyone's once the winner's are
 * filled. Over: every session over (racing.ts's weekendOver) and its statistics had. Between sessions: until the next start.
 * A session's results are each at their first sight (the reader stamps them when asked); the grid at the session's start.
 */
export function raceFeed(sport: Racing): EventFeed<FieldAnswer, FieldPlay, FieldEvent, FieldState> {
  const statsKey = (s: RaceSession, id: string) => `stats:${s.id}:${id}`;
  const statusKey = (s: RaceSession, id: string) => `status:${s.id}:${id}`;
  const boardOf = (had: Record<string, unknown>) => (had.board ? fieldEventOf({ board: had.board } as FieldAnswer, "board") : null);
  /** Who a session's statistics are asked for: the list's, and anyone else on the board. */
  const idsOf = (s: RaceSession, list: CoreList) => [...new Set([...listed(list).map((c) => idOf(c.id)), ...s.ids])].filter(Boolean);
  const filled = (stats: unknown) => stats != null && coreFilled(coreStats({ statistics: stats as EspnCoreCompetitor["statistics"] }));
  /** A session over whose statistics (and F1's statuses) are still to have, for FILL_MS from its start: none asked, a counted
   *  series' race's not filled in. */
  const waiting = (s: RaceSession, a: FieldAnswer, now: number) => {
    if (!s.reads.stats || s.state !== "post" || !s.completed || s.start == null || now - s.start > FILL_MS) return false;
    const cs = a.core?.[s.id]?.competitors ?? [];
    const ids = [...new Set([...cs.map((c) => idOf(c.id)), ...s.ids])];
    const c = (id: string) => cs.find((x) => idOf(x.id) === id);
    const asked = ids.every((id) => c(id) && "statistics" in c(id)! && (!s.reads.status || "status" in c(id)!));
    return !asked || (s.reads.fills && !filled(c(s.winner ?? ids[0])?.statistics));
  };
  return {
    every: RACE_EVERY_MS,
    paths: (league, event) => ({ board: `/apis/site/v2/sports/${leaguePath(league)}/scoreboard/${enc(event)}` }),
    more: ({ had, got, now, league, event }) => {
      const out: Record<string, string> = {};
      const base = `core:/v2/sports/racing/leagues/${enc(league.split("/")[1] ?? "")}/events/${enc(event)}/competitions`;
      for (const s of raceSessions(boardOf(had), sport.feed)) {
        if (s.state !== "in" && s.state !== "post") continue;
        const at = `${base}/${enc(s.id)}/competitors`;
        const lk = `list:${s.id}`;
        const list = had[lk] as CoreList;
        const grid = listed(list).some((c) => num(c.startOrder) != null);
        if (s.reads.grid && !(lk in got) && (list === undefined || (s.state === "in" && !grid))) out[lk] = `${at}?limit=200`;
        if (s.state !== "post" || !s.completed || !s.reads.stats) continue;
        const ids = idsOf(s, list);
        if (s.reads.fills) {
          // The winner's first, and again each ask while they aren't filled in, for FILL_MS from the start (once, opened later or
          // with no start); everyone's only once theirs are.
          const w = s.winner ?? ids[0];
          if (!w) continue;
          const k = statsKey(s, w);
          if (!filled(had[k])) {
            if (!(k in got) && (had[k] === undefined || (s.start != null && now - s.start <= FILL_MS))) out[k] = `${at}/${enc(w)}/statistics`;
            continue;
          }
        }
        for (const id of ids) {
          if (had[statsKey(s, id)] === undefined) out[statsKey(s, id)] = `${at}/${enc(id)}/statistics`;
          if (s.reads.status && had[statusKey(s, id)] === undefined) out[statusKey(s, id)] = `${at}/${enc(id)}/status`;
        }
      }
      return out;
    },
    answer: (had, asked) => {
      const board = boardOf(had);
      if (!board) return null;
      const core: NonNullable<FieldAnswer["core"]> = {};
      for (const s of raceSessions(board, sport.feed)) {
        const list = had[`list:${s.id}`] as CoreList;
        const ids = idsOf(s, list);
        const has = (id: string) => had[statsKey(s, id)] !== undefined || had[statusKey(s, id)] !== undefined;
        if (!listed(list).length && !ids.some(has)) continue;
        const items = listed(list);
        core[s.id] = {
          competitors: ids.map((id) => {
            const st = had[statsKey(s, id)];
            const status = had[statusKey(s, id)];
            return { ...(items.find((c) => idOf(c.id) === id) ?? { id }), ...(st !== undefined ? { statistics: st as EspnCoreCompetitor["statistics"] } : {}), ...(status !== undefined ? { status: status as EspnCoreCompetitor["status"] } : {}) };
          }),
        };
      }
      return { _asked: asked, board, core };
    },
    timeline: (a) => sport.timeline(a),
    eventOf: (a) => sport.fieldEvent(a),
    reduce: (plays, at, event) => sport.reduce(plays, at, event),
    where: (a, now) => {
      const board = fieldEventOf(a, "board");
      const ss = raceSessions(board, sport.feed);
      const on = board?.competitions?.find((c) => c.status?.type?.state === "in");
      const detail = str(on?.status?.type?.detail) ?? str(board?.status?.type?.detail) ?? null;
      const wait = ss.some((s) => waiting(s, a, now));
      if (weekendOver(board) && !wait) return { status: "post", next: null, detail };
      if (on) return { status: "in", next: null, detail };
      const starts = ss.filter((s) => s.state === "pre" && s.start != null).map((s) => s.start!);
      const future = starts.filter((t) => t > now);
      // A listed start gone within the hour with ESPN not on yet (its lag, a delay): asked on the rhythm. A session's statistics
      // still to have: every PRE_WAIT_MS (nextDelay, no next start), or until the next start if sooner.
      const due = starts.some((t) => t <= now && now - t < SESSION_DUE_MS);
      return { status: due ? "in" : "pre", next: future.length ? Math.min(...future) : null, detail };
    },
  };
}

/* ---- A fight card (L5 part 4a's reader). ---- */

export type LiveCard = LiveEvent<BoutAnswer, BoutPlay, BoutCard, BoutState>;

/** A card's board and FightCenter every 30 s while a bout's on, or between bouts (the next bout's walkouts come within
 *  minutes): 23 KB over the wire an ask, with the bout on's plays 1-2 KB more. */
export const CARD_EVERY_MS = 30_000;
/** How long after the card's listed start it's asked for on the rhythm though no bout's on yet (a late start). */
const CARD_DUE_MS = 2 * 3600_000;
/** How long after a bout's end its plays are asked on until they announce its result (they did by the first answer that had
 *  it over in 12 of 12 bouts of UFC Fight Night 600061420; its announcement came a median 55 s after its end). */
const RESULT_WAIT_MS = 10 * 60_000;
/** When a bout's statistics are asked, from its end: its live totals run ahead of the official count (by up to 30%), and the
 *  FightCenter's reached it a median 3 minutes after the bout's end (0 to 9 minutes, one 17), the core's at the bout's end not
 *  in 11 of 12 bouts (600061420, recorded live). So 10 minutes on, and again each ask while they don't agree with the
 *  FightCenter's (its totals are the core's once final: 10,880 of 10,880 numbers), until 30 minutes on. */
const SETTLE_MS = 10 * 60_000;
const SETTLE_UNTIL_MS = 30 * 60_000;

const STATE_ORDER: Record<string, number> = { pre: 0, in: 1, post: 2 };

/** A bout as the card feed asks for it: its board line and FightCenter line, and where it is (the later of the two: the board's
 *  "in" came first at a bout's start, the FightCenter's "post" once at its end). */
interface CardBout {
  id: string;
  board: EspnBoutCompetition;
  center: EspnBoutCompetition | null;
  state: string | null;
  completed: boolean;
  sides: string[];
}

function cardBouts(a: Pick<BoutAnswer, "board" | "fightcenter">): CardBout[] {
  const centers = new Map(Object.values(a.fightcenter?.cards ?? {}).flatMap((s) => s.competitions ?? []).map((c) => [idOf(c.id), c]));
  return (a.board?.competitions ?? []).map((c) => {
    const id = idOf(c.id);
    const center = centers.get(id) ?? null;
    const [x, y] = [c.status?.type, center?.status?.type];
    const later = (STATE_ORDER[y?.state ?? ""] ?? -1) > (STATE_ORDER[x?.state ?? ""] ?? -1) ? y : x;
    return { id, board: c, center, state: str(later?.state), completed: later?.completed !== false, sides: (c.competitors ?? []).map((s) => idOf(s.id)).filter(Boolean) };
  });
}

/** A fighter's FightCenter totals in a bout (null where it has none: the PFL's, LFA's and the rest's). */
const centerOf = (b: CardBout, id: string) => mmaCenterStats(b.center?.competitors?.find((x) => idOf(x.id) === id));
/** Whether a fighter's core statistics are the FightCenter's totals, on its keys. */
const agrees = (stats: unknown, center: Record<string, number>) => {
  const core = mmaCoreStats({ statistics: stats as NonNullable<EspnBoutCore["competitors"]>[number]["statistics"] }) ?? {};
  return Object.keys(center).every((k) => (core[k] ?? 0) === (center[k] ?? 0));
};
/** A bout's plays as had (`.../plays`), without ESPN's links. */
const playsOf = (x: unknown): EspnBoutPlay[] => ((x as { items?: EspnBoutPlay[] } | null)?.items ?? []).map((p) => ({ ...p, $ref: undefined }) as EspnBoutPlay);
/** The core's event, only its bouts' rounds ("3 Rnd (5-5-5)", "3 Rnd + OT (5-5-5-5)"). */
const roundsOf = (x: unknown): BoutAnswer["event"] => {
  const ev = x as { competitions?: { id?: string | number; description?: string | null; format?: { regulation?: { periods?: number; clock?: number } } }[] } | null | undefined;
  return ev ? { competitions: (ev.competitions ?? []).map((c) => ({ id: idOf(c.id), description: c.description ?? null, ...(c.format?.regulation ? { format: { regulation: { periods: c.format.regulation.periods, clock: c.format.regulation.clock } } } : {}) })) } : null;
};

/**
 * A fight card's feed (the UFC's and every promotion ESPN carries): its board (`mma/<league>/scoreboard/<event>`: the bouts, who
 * won, the round and time) and its FightCenter (`site.web.api.espn.com/.../fightcenter/<event>`: how each bout ended, each
 * fighter's totals) every 30 s while a bout's on or between bouts, and from ESPN's core API: the card's rounds once (its event:
 * a tournament's overtime round), the plays of each bout on every ask (ESPN's timed moments, about a minute behind) and of one
 * just over until they announce its result, and each fighter's statistics once the bout's settled (SETTLE_MS: the FightCenter's
 * totals are the live and just-ended ones, the core's only once they agree with them). No core status (the plays and the
 * FightCenter say it). Over: the card final and every bout's statistics settled; before it, until its listed start.
 */
export function cardFeed(sport: BoutSport): EventFeed<BoutAnswer, BoutPlay, BoutCard, BoutState> {
  const statsKey = (b: CardBout, id: string) => `fstats:${b.id}:${id}`;
  /** When a bout over is still due an ask: now while its plays haven't announced its result, for RESULT_WAIT_MS from its end;
   *  its statistics (a fighter's FightCenter totals without the core's agreeing, or ESPN's none) at its end and SETTLE_MS, or now
   *  while within SETTLE_UNTIL_MS; null when it isn't (all had, none to have, or given up). */
  const dueAt = (b: CardBout, a: BoutAnswer, now: number): number | null => {
    if (b.state !== "post" || !b.completed) return null;
    const core = a.core?.[b.id];
    const { endedAt: end, announced } = playsEnd(core?.plays);
    if (end == null) return null;
    if (!announced && now < end + RESULT_WAIT_MS) return now;
    const missing = b.sides.some((id) => centerOf(b, id) && core?.competitors?.find((x) => idOf(x.id) === id)?.statistics === undefined);
    if (!missing || now >= end + SETTLE_UNTIL_MS) return null;
    return Math.max(now, end + SETTLE_MS);
  };
  return {
    every: CARD_EVERY_MS,
    optional: ["fightcenter"],
    paths: (league, event) => ({
      board: `/apis/site/v2/sports/${leaguePath(league)}/scoreboard/${enc(event)}`,
      fightcenter: `web:/apis/common/v3/sports/${leaguePath(league)}/fightcenter/${enc(event)}?region=us&lang=en&contentorigin=espn`,
    }),
    more: ({ had, got, now, league, event }) => {
      const out: Record<string, string> = {};
      const ev = `core:/v2/sports/mma/leagues/${enc(league.split("/")[1] ?? "")}/events/${enc(event)}`;
      const bouts = cardBouts(had as BoutAnswer);
      if (!bouts.some((b) => b.state === "in" || b.state === "post")) return out;
      if (had.event === undefined && !("event" in got)) out.event = ev;
      for (const b of bouts) {
        const pk = `plays:${b.id}`;
        const { endedAt, announced } = playsEnd(playsOf(had[pk]));
        const path = `${ev}/competitions/${enc(b.id)}`;
        if (!(pk in got) && (b.state === "in" || (b.state === "post" && (had[pk] === undefined || (!announced && endedAt != null && now - endedAt < RESULT_WAIT_MS))))) out[pk] = `${path}/plays?limit=1000`;
        // Its statistics once it's settled, from its end in its plays (asked first, if they're still to have).
        if (b.state !== "post" || !b.completed || had[pk] === undefined) continue;
        for (const id of b.sides) {
          const center = centerOf(b, id);
          const k = statsKey(b, id);
          if (!center || k in got) continue;
          const s = had[k];
          const settled = endedAt == null || now >= endedAt + SETTLE_MS;
          const retry = s != null && !agrees(s, center) && endedAt != null && now < endedAt + SETTLE_UNTIL_MS;
          if ((s === undefined && settled) || retry) out[k] = `${path}/competitors/${enc(id)}/statistics`;
        }
      }
      return out;
    },
    answer: (had, asked) => {
      const board = had.board as BoutAnswer["board"];
      if (!board || board.id == null) return null;
      const a: BoutAnswer = { _asked: asked, board, fightcenter: (had.fightcenter as BoutAnswer["fightcenter"]) ?? null, event: roundsOf(had.event), core: {} };
      for (const b of cardBouts(a)) {
        const plays = had[`plays:${b.id}`];
        // A fighter's core statistics only while they're the FightCenter's (on its keys): until then its totals are the fresher.
        const competitors = (b.board.competitors ?? []).map((x) => {
          const id = idOf(x.id);
          const s = had[statsKey(b, id)] as { splits?: unknown } | null | undefined;
          const center = centerOf(b, id);
          // ESPN's none (a 404) as null: asked, nothing to wait for.
          const stats = s === null ? null : s !== undefined && (!center || agrees(s, center)) ? ({ splits: s.splits } as NonNullable<EspnBoutCore["competitors"]>[number]["statistics"]) : undefined;
          return { id, order: x.order, winner: x.winner, ...(stats !== undefined ? { statistics: stats } : {}) };
        });
        if (plays !== undefined || competitors.some((c) => c.statistics !== undefined)) a.core![b.id] = { plays: playsOf(plays), competitors };
      }
      return a;
    },
    timeline: (a) => sport.timeline(a),
    eventOf: (a) => sport.card(a),
    reduce: (plays, at, card) => sport.reduce(plays, at, card),
    where: (a, now) => {
      const st = a.board?.status?.type;
      const detail = str(st?.detail) ?? null;
      // Called off ("post" and not completed): over.
      if (st?.state === "post" && st.completed === false) return { status: "post", next: null, detail };
      const bouts = cardBouts(a);
      const due = bouts.map((b) => dueAt(b, a, now)).filter((t): t is number => t != null);
      if (st?.state === "post") return due.length ? { status: "pre", next: Math.min(...due), detail } : { status: "post", next: null, detail };
      const on = bouts.filter((b) => b.state === "in");
      if (on.length) return { status: "in", next: null, detail: `${on.length} on` };
      // Between bouts, or every bout over and the board not final yet: on the rhythm.
      if (bouts.some((b) => b.state === "post")) return { status: "in", next: null, detail };
      const starts = bouts.map((b) => msOf(b.board.date ?? null)).filter((t): t is number => t != null);
      const future = starts.filter((t) => t > now);
      const started = starts.some((t) => t <= now && now - t < CARD_DUE_MS);
      return { status: started ? "in" : "pre", next: future.length ? Math.min(...future) : null, detail };
    },
  };
}

/** A field's or a card's feed for its sport: golf's, a race weekend's, a tennis event's draws or a fight card's; null for a sport
 *  without one (a team sport's game is LiveGame's). */
export function feedOf(sport: FieldSport | BoutSport): EventFeed<FieldAnswer, FieldPlay, FieldEvent, FieldState> | EventFeed<BoutAnswer, BoutPlay, BoutCard, BoutState> | null {
  if (sport instanceof Golf) return golfFeed(sport);
  if (sport instanceof Racing) return raceFeed(sport);
  if (sport instanceof Tennis) return drawFeed(sport);
  if (sport instanceof MMA) return cardFeed(sport);
  return null;
}
