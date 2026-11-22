// The hub's scores strip: which games it shows and in what order (docs/PLAN-sports-couch.md A1; docs/design-round/
// hub-scorebug-shape.md, "Which games"). Yours only: your teams' games and the games you play (a Pick'em, a lineup, a draft on
// them). A rivalry needs no rule of its own: it's your team's game against a team someone else on the couch follows, so it's
// already here, marked by the faces on both sides. Order: live, then just finished, then today's by kickoff, then each of your
// teams' next game (and each game you play's next). A final stays until you've seen it, at most 36 hours.
//
// Nothing here may tell a game's state to someone it's hidden from (Sports scores too, or watching it as if live: hide.ts). A
// hidden game that has begun is only "started": it sorts by kickoff among the live ones, whether it's still on or over, and leaves
// on the same 36 hours, so where it sits gives nothing away.
//
// Pure: the strip (src/new/hub/scores-strip.tsx) and the tests (tests/sports-strip.test.js) share it.
import { begun } from "./hide";

export interface StripGameIn {
  id: string;
  league: string;
  at: string | null;
  state: "pre" | "in" | "post";
  final: boolean;
  called?: string | null;
  sides: { id: string }[];
}

/** A game you play, by its provider's id: the season it's in and that game's episode. */
export interface PlayedGame {
  seasonId: string;
  episode: number;
}

/**
 * - live: on now, and shown to you;
 * - started: begun, but hidden from you (on or over: you aren't told which);
 * - final: just finished, shown to you, not yet seen;
 * - today: still to start today;
 * - next: a later day, the next game of one of your teams or of a game you play.
 */
export type StripBucket = "live" | "started" | "final" | "today" | "next";

export interface StripOptions<G extends StripGameIn> {
  /** Every game read (the week from yesterday, and the week after when a team of yours has none left in it). */
  games: G[];
  /** Your teams, as "league|teamId". */
  yours: Set<string>;
  /** The games you play, by their provider's id. */
  played: Map<string, PlayedGame>;
  /** Whether a game's score is hidden from you now (hide.ts: Sports scores too and not shown this visit, or watching as if live). */
  hidden: (g: G) => boolean;
  /** A final (or a hidden game) you saw on an earlier visit: it's done with. */
  seen: (id: string) => boolean;
  now: number;
  /** Your phone's day ("2026-11-22"): a game starting on it is today's. */
  dayOf: (at: string) => string;
}

/** How long a finished game stays, from its start. */
export const FRESH_MS = 36 * 3600_000;

const RANK: Record<StripBucket, number> = { live: 0, started: 0, final: 1, today: 2, next: 3 };
const ms = (at: string | null) => (at ? Date.parse(at) : NaN);

export function stripGames<G extends StripGameIn>(o: StripOptions<G>): { g: G; bucket: StripBucket }[] {
  const today = o.dayOf(new Date(o.now).toISOString());
  const mineSide = (g: G) => g.sides.some((s) => o.yours.has(`${g.league}|${s.id}`));
  const ours = new Map<string, G>();
  for (const g of o.games) if (!ours.has(g.id) && (mineSide(g) || o.played.has(g.id))) ours.set(g.id, g);
  const all = [...ours.values()];
  // Called off (postponed, canceled): not played, so neither on nor a result; its makeup comes as a game of its own.
  const playable = (g: G) => !(g.called && g.called !== "suspended");
  const toCome = all.filter((g) => playable(g) && !begun(g, o.now)).sort((a, b) => ms(a.at) - ms(b.at));
  const out: { g: G; bucket: StripBucket }[] = [];
  for (const g of all) {
    if (!playable(g)) continue;
    if (begun(g, o.now)) {
      if (!(o.now - ms(g.at) < FRESH_MS) || o.seen(g.id)) continue;
      if (o.hidden(g)) out.push({ g, bucket: "started" });
      else if (g.state === "in" && !g.final) out.push({ g, bucket: "live" });
      else if (g.state === "post" || g.final) out.push({ g, bucket: "final" });
      // Begun by the clock, not yet by the provider: on, as far as anyone can say.
      else out.push({ g, bucket: "live" });
    } else if (g.at && o.dayOf(g.at) === today) out.push({ g, bucket: "today" });
  }
  // Then each of your teams' next game, and each season you play's next, for those with nothing on the strip yet (a team on now
  // doesn't also bring the game after).
  const shown = new Set(out.map((x) => x.g.id));
  const on = (g: G, key: string) => g.sides.some((s) => `${g.league}|${s.id}` === key);
  for (const key of o.yours) {
    if (out.some((x) => on(x.g, key))) continue;
    const n = toCome.find((g) => on(g, key));
    if (n && !shown.has(n.id)) (shown.add(n.id), out.push({ g: n, bucket: "next" }));
  }
  const seasons = new Set(out.map((x) => o.played.get(x.g.id)?.seasonId).filter(Boolean));
  for (const g of toCome) {
    const p = o.played.get(g.id);
    if (!p || seasons.has(p.seasonId)) continue;
    seasons.add(p.seasonId);
    if (!shown.has(g.id)) (shown.add(g.id), out.push({ g, bucket: "next" }));
  }
  // Live and started by kickoff; finals the latest first; to come by kickoff.
  return out.sort((a, b) => RANK[a.bucket] - RANK[b.bucket] || (a.bucket === "final" ? ms(b.g.at) - ms(a.g.at) : ms(a.g.at) - ms(b.g.at)) || a.g.id.localeCompare(b.g.id));
}

/** Whether a team of yours has no game left in these (a bye week): the strip then reads the week after for its next. */
export function needsLaterWeek(games: StripGameIn[], yours: Set<string>, now: number): boolean {
  return [...yours].some((key) => !games.some((g) => !begun(g, now) && g.sides.some((s) => `${g.league}|${s.id}` === key)));
}
