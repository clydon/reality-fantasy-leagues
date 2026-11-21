import StateLogic from "@/lib/game/state-logic.js";
import type { AddedMoment, LeagueState } from "@/lib/game/types";
import type { SessionUser } from "./auth-helpers";
import { pool, withLeagueLock, HttpError } from "./db";
import { seenThrough } from "./guard";
import { couchGames } from "./league-changes";
import { leagueStates } from "./league-states";

// Settings Round 3b (A17, BACKLOG 230; docs/design-round/settings-r3b-spec.md, "The players are told, either way"): a game whose
// rule is "let the players vote" records a moment its rules gained mid-season from the next episode (db/rulebooks.js
// recordAddedMoments) and asks its players: count it from the start? The default holds while the vote runs (nothing waits: the
// user's "let the AI settle", 2026-11-20). The ballots are the format-change vote's table (stage_change_votes, migration 0205),
// keyed `moment:<id>`, `start` (from the start) or `skip` (from the next episode): kept out of the league's state, so nobody reads
// how others voted before it's decided. It's decided when more than half the players say the same; at its close (the next
// episode's airtime) by the most votes, nobody voting keeping the default, and a tie waiting for the Commissioner (Manage this
// game), the default holding meanwhile. Only the decision is the state's (settings.momentsFrom[id].settled), which scoring reads.

export type MomentVote = "start" | "next";
const KEY = (id: string) => `moment:${id}`;

export interface OpenVote {
  leagueId: string;
  gameName: string;
  id: string;
  name: string;
  points: number;
  from: number;
  closes: string | null;
  /** Your vote, or null. */
  mine: MomentVote | null;
  voted: number;
  of: number;
  /** What counting it from the start would add, in episodes you've seen: "Ep 3 · Carter +5". */
  earlier: { episode: number; name: string; points: number }[];
  /** Earlier episodes you haven't seen, which it would also count in (never named). */
  unseen: number;
}

/** The people who vote in a game: real seats still playing (not computer players or seats someone left). */
function voters(s: LeagueState): string[] {
  return s.players.filter((p) => !p.automated && !p.disabled).map((p) => p.id);
}

async function ballots(leagueId: string, id: string): Promise<Map<string, MomentVote>> {
  const { rows } = await pool.query<{ player_id: string; vote: string }>("SELECT player_id, vote FROM stage_change_votes WHERE league_id = $1 AND change_key = $2", [leagueId, KEY(id)]);
  return new Map(rows.map((r) => [r.player_id, r.vote === "start" ? "start" : "next"]));
}

/** How a vote stands: decided (more than half say the same), closed (by the most; nobody voting keeps the default; a tie waits), or
 *  still open. */
export function tallyOf(m: AddedMoment, votes: Map<string, MomentVote>, of: number, now = Date.now()): { start: number; next: number; decided: MomentVote | null; by: "vote" | "nobody" | null; tie: boolean } {
  let start = 0;
  let next = 0;
  for (const v of votes.values()) {
    if (v === "start") start++;
    else next++;
  }
  if (start * 2 > of) return { start, next, decided: "start", by: "vote", tie: false };
  if (next * 2 > of) return { start, next, decided: "next", by: "vote", tie: false };
  const closed = !!m.closes && Date.parse(m.closes) <= now;
  if (!closed) return { start, next, decided: null, by: null, tie: false };
  if (start === 0 && next === 0) return { start, next, decided: "next", by: "nobody", tie: false };
  if (start === next) return { start, next, decided: null, by: null, tie: true };
  return { start, next, decided: start > next ? "start" : "next", by: "vote", tie: false };
}

/** Writes a vote's decision into the game (scoring reads it), with a line everyone on the couch reads. */
async function settle(leagueId: string, id: string): Promise<void> {
  const votes = await ballots(leagueId, id);
  let text = "";
  await withLeagueLock(
    leagueId,
    (s) => {
      const m = s.settings.momentsFrom?.[id];
      if (!m || m.rule !== "vote" || m.settled) return;
      const t = tallyOf(m, votes, voters(s).length);
      if (!t.decided || !t.by) return;
      m.settled = { to: t.decided, by: t.by, at: new Date().toISOString(), start: t.start, next: t.next };
      text =
        t.by === "nobody"
          ? `Nobody voted: "${m.name}" counts from Episode ${m.from} here`
          : `The players voted ${Math.max(t.start, t.next)}–${Math.min(t.start, t.next)} to count "${m.name}" ${t.decided === "start" ? "from the start" : `from Episode ${m.from}`}`;
    },
    () => (text ? { userId: null, kind: "rules.vote", tier: 2 as const, text } : null)
  );
}

/** The votes open for you in this couch's games on the season (settling any whose time has come first). */
export async function openVotes(user: SessionUser, seasonId: string, couchId: string): Promise<{ votes: OpenVote[] }> {
  const { here } = await couchGames(user, seasonId, couchId);
  const mine = here.filter((g) => g.yourRole);
  if (!mine.length) return { votes: [] };
  const { rows: seats } = await pool.query<{ league_id: string; player_id: string | null }>(
    "SELECT league_id, player_id FROM league_memberships WHERE user_id = $1 AND league_id = ANY($2::uuid[])",
    [user.id, mine.map((g) => g.leagueId)]
  );
  const seatOf = new Map(seats.filter((r) => r.player_id).map((r) => [r.league_id, r.player_id as string]));
  let states = await leagueStates(mine.map((g) => g.leagueId));
  // Settle what's due (a close passed), then read again.
  let settled = false;
  for (const g of mine) {
    const s = states.get(g.leagueId);
    for (const [id, m] of Object.entries(s?.settings.momentsFrom ?? {})) {
      if (m.rule !== "vote" || m.settled || !m.closes || Date.parse(m.closes) > Date.now()) continue;
      await settle(g.leagueId, id);
      settled = true;
    }
  }
  if (settled) states = await leagueStates(mine.map((g) => g.leagueId));
  const seen = await seenThrough(user.id, seasonId);
  const out: OpenVote[] = [];
  for (const g of mine) {
    const s = states.get(g.leagueId);
    const seat = seatOf.get(g.leagueId);
    if (!s || !seat) continue;
    for (const [id, m] of Object.entries(s.settings.momentsFrom ?? {})) {
      if (m.rule !== "vote" || m.settled) continue;
      const votes = await ballots(g.leagueId, id);
      const points = StateLogic.ActiveRosterLogic.pointsFor(s, id);
      const names = new Map(s.castaways.map((c) => [c.id, c.name]));
      const before = s.episodes.filter((e) => e.number < m.from);
      const shown = before.filter((e) => seen === null || e.number <= seen);
      const earlier = shown.flatMap((e) => (e.scoringEvents ?? []).filter((ev) => ev.type === id).map((ev) => ({ episode: e.number, name: names.get(ev.castawayId) ?? "Someone", points })));
      const unseen = before.length - shown.length;
      out.push({ leagueId: g.leagueId, gameName: g.name, id, name: m.name, points, from: m.from, closes: m.closes, mine: votes.get(seat) ?? null, voted: votes.size, of: voters(s).length, earlier, unseen });
    }
  }
  return { votes: out };
}

/** Your vote on a moment in one of your games: changeable until it's decided; a majority decides it at once. */
export async function castVote(user: SessionUser, seasonId: string, couchId: string, body: { leagueId?: unknown; id?: unknown; vote?: unknown }): Promise<{ votes: OpenVote[] }> {
  const { here } = await couchGames(user, seasonId, couchId);
  const g = here.find((x) => x.leagueId === body.leagueId && x.yourRole);
  if (!g) throw new HttpError(404, "That game isn't one of yours here");
  if (body.vote !== "start" && body.vote !== "next") throw new HttpError(400, "vote: start or next");
  if (typeof body.id !== "string") throw new HttpError(400, "id: the moment's");
  const { rows } = await pool.query<{ player_id: string | null }>("SELECT player_id FROM league_memberships WHERE user_id = $1 AND league_id = $2", [user.id, g.leagueId]);
  const seat = rows[0]?.player_id;
  if (!seat) throw new HttpError(403, "Only someone playing votes");
  const s = (await leagueStates([g.leagueId])).get(g.leagueId);
  const m = s?.settings.momentsFrom?.[body.id];
  if (!m || m.rule !== "vote") throw new HttpError(404, "There's no vote on that");
  if (m.settled) throw new HttpError(409, "It's decided already");
  if (m.closes && Date.parse(m.closes) <= Date.now()) throw new HttpError(409, "The vote closed when the episode aired");
  await pool.query(
    `INSERT INTO stage_change_votes (league_id, change_key, player_id, vote, user_id) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (league_id, change_key, player_id) DO UPDATE SET vote = EXCLUDED.vote, user_id = EXCLUDED.user_id, voted_at = now()`,
    [g.leagueId, KEY(body.id), seat, body.vote === "start" ? "start" : "skip", user.id]
  );
  await settle(g.leagueId, body.id);
  return openVotes(user, seasonId, couchId);
}

/** How each vote stands for whoever runs the game (Manage this game): the tally, and whether a tie waits for the Commissioner. */
export async function voteTallies(leagueId: string, s: LeagueState): Promise<Map<string, { start: number; next: number; of: number; tie: boolean }>> {
  const out = new Map<string, { start: number; next: number; of: number; tie: boolean }>();
  for (const [id, m] of Object.entries(s.settings.momentsFrom ?? {})) {
    if (m.rule !== "vote" || m.settled) continue;
    const t = tallyOf(m, await ballots(leagueId, id), voters(s).length);
    out.set(id, { start: t.start, next: t.next, of: voters(s).length, tie: t.tie });
  }
  return out;
}
