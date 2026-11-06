// A field's, a card's or a draw's event live on the phone (docs/PLAN-start-a-game-gpt.md track L, L2 part 2): golf's rounds, a
// tennis event's matches (and, in part 2b, a race weekend's sessions and a fight card's bouts). As a game's poller does (live.ts),
// the phone asks ESPN itself while something's on and the screen is visible, works the event out here, and nothing reaches our
// server while it's live.
//
// What's different from a game: ESPN times nothing in these answers (golf's holes, tennis's sets and results: L5 parts 3a and
// 4b), so a reader stamps what an answer tells it with when the answer was had (`_asked`) at the latest, and every poll would move
// a just-finished hole or match on to its own moment. **The poller keeps the moment each play was first seen as it is**: a play
// an answer has again, the same (its kind, words and numbers; not its moment, nor a running score or standings, which a hole
// rescored before it changes), keeps its earliest moment; a play ESPN changes (a hole rescored, a set's games going on) counts
// from the answer that first had it that way. So a later watch never sees anything before a phone could have.
//
// Pure, as live.ts: fetch, the time, timers and the screen are passed in (tests/sports-live-event.test.js's virtual time;
// scripts/dev-test/check-live-event.js replays the live recordings through it).
import { momentOf, type GameClock, type Moment } from "./clock";
import { CUT_SHORT, ESPN_SITE, PRE_WAIT_MS, Poller, type LiveStatus, type PollerOptions } from "./live";
import { boardMatches, matchOver, matchSuspended } from "./tennis";
import { fieldEventOf, isoOf, msOf, str, type BoutAnswer, type BoutCard, type BoutPlay, type BoutSport, type BoutState, type EspnBoutCompetition, type FieldAnswer, type FieldEvent, type FieldPlay, type FieldSport, type FieldState, type Play } from "./sport";

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

/** Where an event is, from an answer: on (ask every `every`), between (the next start, if one's known), or over for good. */
export interface EventWhere {
  status: LiveStatus;
  /** The next start of something to come (a round's first tee time, a match's listed start), while nothing's on. */
  next: number | null;
  /** ESPN's words for where it is ("Round 2 - In Progress"). */
  detail: string | null;
}

/** How one kind of event is asked for and read: the calls asked together, the answer they make, and the sport's reading. */
export interface EventFeed<A, P extends Play, E, S> {
  every: number;
  /** ESPN's paths after the base, by the answer's key ("board", "leaderboard"). */
  paths(league: string, event: string): Record<string, string>;
  /** The answer from the calls' JSON, as the sport reads it; null when it has no event. */
  answer(got: Record<string, unknown>, asked: string): A | null;
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
  /** Where it's asked: ESPN's site API or a stand-in; the paths after it are ESPN's own. */
  base?: string;
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

  private readonly base: string;
  private readonly onChange?: (live: LiveEvent<A, P, E, S>) => void;
  private readonly seen = new Map<string, number>();
  /** Answers in a row that lacked plays had (take). */
  private behind = 0;

  constructor(o: LiveEventOptions<A, P, E, S>) {
    super(o, o.feed.every);
    this.feed = o.feed;
    this.league = o.league;
    this.event = o.event;
    this.base = (o.base ?? ESPN_SITE).replace(/\/$/, "");
    this.onChange = o.onChange;
  }

  /** The URLs asked together, by the answer's key. */
  get urls(): Record<string, string> {
    return Object.fromEntries(Object.entries(this.feed.paths(this.league, this.event)).map(([k, p]) => [k, `${this.base}${p}`]));
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
    await Promise.all(
      Object.entries(this.urls).map(async ([k, url]) => {
        const res = await this.fetcher(url);
        if (!res.ok) throw new Error(`ESPN answered ${res.status} for ${k}`);
        got[k] = await res.json();
      }),
    );
    const answer = this.feed.answer(got, asked);
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
      const e = encodeURIComponent(event);
      return { board: `/apis/site/v2/sports/${league.split("/").map(encodeURIComponent).join("/")}/scoreboard/${e}`, leaderboard: `/apis/site/v2/sports/golf/leaderboard?event=${e}` };
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
    paths: (league, event) => ({ board: `/apis/site/v2/sports/${league.split("/").map(encodeURIComponent).join("/")}/scoreboard/${encodeURIComponent(event)}` }),
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
