import crypto from "crypto";
import StateLogic from "@/lib/game/state-logic.js";
import { settleCouchMoment, type CouchPick } from "@/lib/game/couch-answers";
import { blocksAt } from "@/lib/game/formats/rulebook-patch.js";
import { publicMediaSrc } from "@/lib/game/selectors";
import type { LeagueState } from "@/lib/game/types";
import { inForceEdits } from "@db/rulebooks.js";
import { isUuid, isSuperAdminUser, type SessionUser } from "./auth-helpers";
import { pool, withLeagueLock, HttpError } from "./db";
import { seenThrough } from "./guard";
import { couchGames } from "./league-changes";
import { leagueStates } from "./league-states";
import { copyOf, gamesOn, ownMoments } from "./ours";

// The couch's own moments, answered by the couch (docs/PLAN-new-design.md step 6b part 3; migration 0114): the moments a
// couch added to its own copy of the rulebook (Make it ours, ours.ts), on the episode page once you've seen it. Anyone
// who plays here ticks who did it; whoever runs the games settles it alone, otherwise two agreeing do
// (src/lib/game/couch-answers.ts). What's settled goes into each game on the copy as that moment's results (scoring
// events marked `couch`, replaced as the answers change), with a line in its Recent changes; nothing leaves the couch.

export interface CouchMoments {
  episode: number;
  moments: {
    id: string;
    label: string;
    counted: "yesNo" | "eachTime";
    points: number;
    /** Your answer, or null when you haven't given one. */
    yours: CouchPick[] | null;
    settled: CouchPick[];
    by: "runner" | "agreed" | null;
    waiting: { name: string; votes: number }[];
    answers: number;
  }[];
  /** Who was still in at that episode: who can be ticked. */
  cast: { name: string; photo: string | null }[];
  /** You run a game here: your answer settles it. */
  runs: boolean;
}

async function context(user: SessionUser, seasonId: string, couchId: string | null, episode: number) {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  if (!couchId) throw new HttpError(400, "couch required");
  if (!Number.isInteger(episode) || episode < 1) throw new HttpError(400, "episode required");
  const { here, runs } = await couchGames(user, seasonId, couchId);
  if (!here.some((g) => g.yourRole) && !isSuperAdminUser(user)) throw new HttpError(403, "The couch's own moments are for whoever plays here");
  if ((await seenThrough(user.id, seasonId)) < episode) throw new HttpError(403, `Reveal Episode ${episode} first`);
  const copy = await copyOf(here.map((g) => g.leagueId));
  if (!copy) return null;
  const games = (await gamesOn(copy.id)).map((g) => g.id);
  const blocks = blocksAt(copy.blocks, await inForceEdits(pool, copy.id), episode);
  const moments = ownMoments(blocks).filter((m) => !blocks.momentNotes?.[m.id]?.off);
  const { rows: runners } = await pool.query(
    "SELECT DISTINCT user_id FROM league_memberships WHERE league_id = ANY($1::uuid[]) AND role IN ('commissioner', 'admin')",
    [games]
  );
  const runSet = new Set(runners.map((r) => r.user_id as string));
  const states = await leagueStates(games);
  const first = states.get(games[0]) as LeagueState | undefined;
  return { here, runs, copy, games, blocks, moments, runSet, states, first };
}

/** Who was still in at an episode, in a game's own copy of the cast. */
function castIn(state: LeagueState | undefined, episode: number) {
  if (!state) return [];
  const before = new Set(state.episodes.filter((e) => e.number < episode).flatMap((e) => (e.events ?? []).map((ev: { castawayId: string }) => ev.castawayId)));
  return state.castaways.filter((c) => !before.has(c.id)).map((c) => ({ name: c.name, photo: publicMediaSrc(c.photoUrl) }));
}

async function read(couchId: string, seasonId: string, episode: number, ctx: NonNullable<Awaited<ReturnType<typeof context>>>, userId: string): Promise<CouchMoments> {
  const { rows } = await pool.query(
    "SELECT moment_id, user_id, picks, updated_at FROM couch_answers WHERE couch_id = $1 AND season_id = $2 AND episode_number = $3",
    [couchId, seasonId, episode]
  );
  return {
    episode,
    runs: ctx.runSet.has(userId),
    cast: castIn(ctx.first, episode),
    moments: ctx.moments.map((m) => {
      const counted = m.counted === "eachTime" ? "eachTime" : "yesNo";
      const answers = rows.filter((r) => r.moment_id === m.id).map((r) => ({ userId: r.user_id, runs: ctx.runSet.has(r.user_id), picks: r.picks as CouchPick[], at: new Date(r.updated_at).getTime() }));
      const s = settleCouchMoment(answers, counted);
      const mine = answers.find((a) => a.userId === userId);
      const pts = ctx.blocks.points?.[m.id];
      return { id: m.id, label: m.label, counted, points: typeof pts === "number" ? pts : 0, yours: mine ? mine.picks : null, ...s, answers: answers.length };
    }),
  };
}

/** The couch's own moments for an episode you've seen, with your answer and what's settled (null: the couch has none). */
export async function couchMoments(user: SessionUser, seasonId: string, couchId: string | null, episode: number): Promise<CouchMoments | null> {
  const ctx = await context(user, seasonId, couchId, episode);
  if (!ctx || !ctx.moments.length) return null;
  return read(couchId!, seasonId, episode, ctx, user.id);
}

/**
 * Your answer for one of the couch's own moments in an episode (the people who did it, each with a count when it's
 * counted every time); then what's settled goes into every game on the couch's copy.
 */
export async function answerCouchMoment(
  user: SessionUser,
  seasonId: string,
  couchId: string | null,
  episode: number,
  body: { moment?: unknown; picks?: unknown }
): Promise<CouchMoments> {
  const ctx = await context(user, seasonId, couchId, episode);
  if (!ctx) throw new HttpError(404, "This couch has no moments of its own");
  const m = ctx.moments.find((x) => x.id === body.moment);
  if (!m) throw new HttpError(404, "That isn't one of the couch's own moments");
  const counted = m.counted === "eachTime" ? "eachTime" : "yesNo";
  const names = new Set(castIn(ctx.first, episode).map((c) => c.name));
  const picks: CouchPick[] = [];
  for (const p of Array.isArray(body.picks) ? (body.picks as { name?: unknown; times?: unknown }[]) : []) {
    const name = typeof p?.name === "string" ? p.name : "";
    if (!names.has(name)) throw new HttpError(400, `${name || "Someone"} wasn't in this episode`);
    if (picks.some((x) => x.name === name)) continue;
    const times = Number(p.times);
    if (counted === "eachTime" && Number.isInteger(times) && times > 1) {
      if (times > 20) throw new HttpError(400, "That's a lot of times: 20 at most");
      picks.push({ name, times });
    } else picks.push({ name });
  }
  await pool.query(
    `INSERT INTO couch_answers (couch_id, season_id, episode_number, moment_id, user_id, picks) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     ON CONFLICT (couch_id, season_id, episode_number, moment_id, user_id) DO UPDATE SET picks = EXCLUDED.picks, updated_at = now()`,
    [couchId, seasonId, episode, m.id, user.id, JSON.stringify(picks)]
  );
  const view = await read(couchId!, seasonId, episode, ctx, user.id);
  const settled = view.moments.find((x) => x.id === m.id)!.settled;
  await applyCouchMoment(ctx.games, episode, m.id, m.label, settled, user.id);
  return view;
}

/** Each game on the copy gets exactly what's settled for the moment in that episode, with a line where it changed. */
async function applyCouchMoment(games: string[], episode: number, momentId: string, label: string, settled: CouchPick[], userId: string): Promise<void> {
  const batch = crypto.randomUUID();
  const key = (list: { name: string; times?: number }[]) => JSON.stringify(list.map((p) => [p.name, p.times ?? 1]).sort());
  for (const id of games) {
    let changed = false;
    await withLeagueLock(
      id,
      (s) => {
        const ep = s.episodes.find((e) => e.number === episode);
        if (!ep) return;
        const name = new Map(s.castaways.map((c) => [c.id, c.name]));
        const had = (ep.scoringEvents ?? []).filter((e) => e.type === momentId && e.couch);
        if (key(had.map((e) => ({ name: name.get(e.castawayId) ?? "", times: e.units }))) === key(settled)) return;
        ep.scoringEvents = (ep.scoringEvents ?? []).filter((e) => !(e.type === momentId && e.couch));
        for (const p of settled) {
          const c = s.castaways.find((x) => x.name === p.name);
          const ev = c ? StateLogic.ActiveRosterLogic.addEvent(s, ep.id, momentId, c.id, p.times) : null;
          if (ev) ev.couch = true;
        }
        changed = true;
      },
      () => (changed ? { userId, kind: "results.couch", tier: 2, episode, text: `Episode ${episode}: the couch's answer for one of its own moments is in`, batch, detail: { moment: momentId, label } } : null)
    );
  }
}
