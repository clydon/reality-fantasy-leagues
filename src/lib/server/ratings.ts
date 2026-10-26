import { average, ratingAccolades, tasteOf, type Rated, type Taste } from "@/lib/game/ratings";
import type { Accolade, Person } from "@/lib/game/couch-standings";
import { isUuid, type SessionUser } from "./auth-helpers";
import { requireCouch } from "./couches";
import { HttpError, pool } from "./db";
import { EVERYTHING, seenThrough, seenThroughAll, sharesSql } from "./guard";
import { latestAired, seasonSchedules } from "./schedule";
import { seasonHeaders } from "./show-space";

// Rate it and the couch verdict (docs/PLAN-new-design.md step 12 part 1; migration 0128 episode_ratings):
//   GET  /api/seasons/[id]/ratings/[n]?couch=   one episode's verdict: your stars and take, the couch's (everyone on it who
//        shares the show and rated it, their stars and takes), and everyone on Game Your Show's as a number
//   POST /api/seasons/[id]/ratings/[n]?couch=   { stars: 1-5, take?: string } rate it (again); answers the verdict
//   GET  /api/couches/[id]/verdicts             Couch verdicts: the latest episode you've seen of each show you've started
// plus each episode's verdict on the Episodes read (seasonVerdicts) and, on the hub's read, your taste twin, how often you
// agree with the couch and the rating accolades (couchTaste).
//
// Whose ratings make a verdict: the couch's when someone else is on it, else (solo, or a couch of one) everyone's on Game Your
// Show, as a number only (strangers' names and takes never leave the server, and only open followers count: on an app this
// size a private watcher's stars in a count could still say who).
//
// Spoiler-safe on the server: you rate only an episode you've seen (guard.ts seenThrough) that has aired, and a rating, a take
// or a verdict about an episode is only read for someone who has seen it; the hub's numbers count only episodes within your
// mark on each season. Only what people share: someone else's rating counts only while they follow the show openly and share My
// episode ratings (guard.ts sharesSql; step 15 part 3's What your couch sees), for a couch and in everyone's average alike. A rating says you've seen that episode, as a reveal line in
// chat does. Nothing polls (docs/HOSTING.md).

export const TAKE_MAX = 140;
/** The verdicts page's shows, and the bars' episodes. */
const SHOWS_MAX = 6;
const BARS_MAX = 8;

export interface RatingFace {
  userId: string;
  name: string;
  stars: number;
  take: string | null;
}

export interface EpisodeVerdict {
  seasonId: string;
  episode: number;
  /** couch: the couch's people (with someone else on it); everyone: everyone on Game Your Show, as a number. */
  scope: "couch" | "everyone";
  mine: { stars: number; take: string | null } | null;
  /** The scope's average (you included), to one decimal, and how many rated it. */
  avg: number | null;
  n: number;
  /** The couch's people who rated it, you first then newest first; on everyone's scope only you. */
  people: RatingFace[];
  /** Everyone on Game Your Show, beside a couch's verdict once more than the couch has rated it. */
  everyone: { avg: number; n: number } | null;
}

/** Each episode's verdict, for the Episodes read. */
export interface EpisodeVerdictLine {
  avg: number | null;
  n: number;
  mine: number | null;
}

/** Someone who shares their rating on its season (guard.ts sharesSql: following it openly, My episode ratings on): a condition on `r`. */
const OPEN = sharesSql("ratings", "r.user_id", "r.season_id");

/** The couch's people who share a season (follow it openly), always yourself: a WHERE fragment on `r`, with $me and $couch. */
const SHARED = (me: string, couch: string) => `(r.user_id = ${me} OR (r.user_id IN (SELECT user_id FROM couch_members WHERE couch_id = ${couch}) AND ${OPEN}))`;

/** A couch with someone else on it is a verdict's scope; none (or a couch of one) is everyone's. */
async function couchScope(user: SessionUser, couchId: string | null): Promise<string | null> {
  if (!couchId) return null;
  await requireCouch(user, couchId);
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM couch_members WHERE couch_id = $1", [couchId]);
  return rows[0].n > 1 ? couchId : null;
}

async function requireSeason(seasonId: string): Promise<{ status: string | null; episodeCount: number | null }> {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const { rows } = await pool.query("SELECT status, episode_count FROM show_seasons WHERE id = $1", [seasonId]);
  if (!rows.length) throw new HttpError(404, "Season not found");
  return { status: rows[0].status, episodeCount: rows[0].episode_count };
}

function episodeNumber(n: unknown): number {
  const e = Number(n);
  if (!Number.isInteger(e) || e < 1 || e > 1000) throw new HttpError(400, "Which episode?");
  return e;
}

/** One episode's verdict, for someone who has seen it. */
export async function episodeVerdict(user: SessionUser, seasonId: string, couchId: string | null, episode: number): Promise<EpisodeVerdict> {
  await requireSeason(seasonId);
  const seen = await seenThrough(user.id, seasonId);
  if (!(episode <= seen)) throw new HttpError(403, `You haven't seen Episode ${episode} yet`);
  const couch = await couchScope(user, couchId);
  const [{ rows: everyone }, { rows: faces }] = await Promise.all([
    pool.query(`SELECT avg(r.stars)::float AS avg, count(*)::int AS n FROM episode_ratings r WHERE r.season_id = $1 AND r.episode = $2 AND (r.user_id = $3 OR ${OPEN})`, [
      seasonId,
      episode,
      user.id,
    ]),
    pool.query(
      `SELECT r.user_id, COALESCE(u.username, u.name) AS name, r.stars, r.take, r.updated_at FROM episode_ratings r JOIN "user" u ON u.id = r.user_id
        WHERE r.season_id = $1 AND r.episode = $2 AND ${couch ? SHARED("$3", "$4") : "r.user_id = $3"}
        ORDER BY (r.user_id = $3) DESC, r.updated_at DESC`,
      couch ? [seasonId, episode, user.id, couch] : [seasonId, episode, user.id]
    ),
  ]);
  const people: RatingFace[] = faces.map((r) => ({ userId: r.user_id, name: r.name, stars: r.stars, take: r.take }));
  const mine = people.find((p) => p.userId === user.id) ?? null;
  const count = everyone[0].n as number;
  const all = { avg: count ? Math.round(everyone[0].avg * 10) / 10 : 0, n: count };
  return {
    seasonId,
    episode,
    scope: couch ? "couch" : "everyone",
    mine: mine ? { stars: mine.stars, take: mine.take } : null,
    avg: couch ? average(people.map((p) => p.stars)) : all.n ? all.avg : null,
    n: couch ? people.length : all.n,
    people,
    everyone: couch && all.n > people.length ? all : null,
  };
}

/** Rate an episode you've seen (again): one to five stars, and a take when one is sent ("" takes it away). */
export async function rateEpisode(user: SessionUser, seasonId: string, couchId: string | null, episodeIn: unknown, body: { stars?: unknown; take?: unknown }): Promise<EpisodeVerdict> {
  const episode = episodeNumber(episodeIn);
  const stars = Number(body.stars);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new HttpError(400, "stars must be 1 to 5");
  let take: string | null = null;
  const withTake = body.take !== undefined;
  if (withTake) {
    if (body.take !== null && typeof body.take !== "string") throw new HttpError(400, "take must be words");
    take = typeof body.take === "string" ? body.take.replace(/\s+/g, " ").trim() || null : null;
    if (take && take.length > TAKE_MAX) throw new HttpError(400, `Keep it to ${TAKE_MAX} characters`);
  }
  const season = await requireSeason(seasonId);
  const seen = await seenThrough(user.id, seasonId);
  if (!(episode <= seen)) throw new HttpError(403, `You haven't seen Episode ${episode} yet`);
  if (seen === EVERYTHING) {
    // Seeing everything straight away isn't watching it: only what's aired (or a finished season's episodes).
    const aired = Math.max(latestAired((await seasonSchedules([seasonId])).get(seasonId)), season.status === "completed" ? (season.episodeCount ?? 0) : 0);
    if (episode > aired) throw new HttpError(409, `Episode ${episode} hasn't aired yet`);
  }
  if (couchId) await requireCouch(user, couchId);
  await pool.query(
    `INSERT INTO episode_ratings (user_id, season_id, episode, stars, take) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, season_id, episode)
     DO UPDATE SET stars = EXCLUDED.stars, take = CASE WHEN $6 THEN EXCLUDED.take ELSE episode_ratings.take END, updated_at = now()`,
    [user.id, seasonId, episode, stars, take, withTake]
  );
  return episodeVerdict(user, seasonId, couchId, episode);
}

/** Each episode's verdict through `mark` (the Episodes read): the couch's with someone else on it, else everyone's. */
export async function seasonVerdicts(userId: string, seasonId: string, couchId: string | null, mark: number): Promise<Map<number, EpisodeVerdictLine>> {
  const { rows } = await pool.query(
    `WITH c AS (SELECT user_id FROM couch_members WHERE couch_id = $4::uuid), s AS (SELECT (SELECT count(*) FROM c) > 1 AS couch)
     SELECT r.episode, avg(r.stars)::float AS avg, count(*)::int AS n, max(r.stars) FILTER (WHERE r.user_id = $2)::int AS mine
       FROM episode_ratings r
      WHERE r.season_id = $1 AND r.episode <= $3
        AND (r.user_id = $2 OR (${OPEN} AND (NOT (SELECT couch FROM s) OR r.user_id IN (SELECT user_id FROM c))))
      GROUP BY r.episode`,
    [seasonId, userId, Number.isFinite(mark) ? mark : 100000, couchId]
  );
  return new Map(rows.map((r) => [r.episode as number, { avg: Math.round(r.avg * 10) / 10, n: r.n as number, mine: (r.mine as number | null) ?? null }]));
}

// ---------- the hub ----------

export interface ShowVerdict {
  seasonId: string;
  label: string;
  artUrl: string | null;
  /** The latest episode you've seen. */
  episode: number;
  avg: number | null;
  n: number;
  /** Who on the couch rated it, you first. */
  people: RatingFace[];
  mine: number | null;
  /** A take on a plate: the newest someone else wrote, else yours. */
  take: { userId: string; name: string; text: string } | null;
  /** The couch's score for each episode up to it (the last few). */
  byEpisode: { episode: number; avg: number | null }[];
}

const labelOf = (h: { seasonNumber: number | null; show: { name: string } }) =>
  `${h.show.name.replace(/^The /, "").replace(/\s*\([^)]*\)\s*$/, "")}${h.seasonNumber ? ` ${h.seasonNumber}` : ""}`;

/**
 * Couch verdicts (the mock's couchpages.js verdictsPage): each show you follow and have started, its latest episode you've seen
 * (and that's aired), how the couch rated it, a take, and the couch's score episode by episode. Read when the page opens.
 */
export async function couchVerdicts(user: SessionUser, couchId: string): Promise<{ shows: ShowVerdict[] }> {
  await requireCouch(user, couchId);
  const { rows: follows } = await pool.query("SELECT season_id FROM show_follows WHERE user_id = $1 AND following AND seen_through > 0", [user.id]);
  const marks = await seenThroughAll(user.id);
  const ids = follows.map((f) => f.season_id as string);
  const [schedules, headers] = await Promise.all([seasonSchedules(ids), seasonHeaders(ids)]);
  const at = new Map<string, number>();
  for (const id of ids) {
    const mark = marks.get(id) ?? 0;
    const aired = latestAired(schedules.get(id));
    const e = mark === EVERYTHING ? aired : aired ? Math.min(mark, aired) : mark;
    if (e > 0 && headers.has(id)) at.set(id, e);
  }
  const seasons = [...at.keys()];
  if (!seasons.length) return { shows: [] };
  const eps = seasons.map((id) => at.get(id)!);
  const [{ rows: bars }, { rows: faces }] = await Promise.all([
    pool.query(
      `SELECT r.season_id, r.episode, avg(r.stars)::float AS avg, max(r.updated_at) AS at
         FROM episode_ratings r JOIN unnest($3::uuid[], $4::int[]) AS m(season_id, ep) ON m.season_id = r.season_id AND r.episode <= m.ep
        WHERE ${SHARED("$1", "$2")}
        GROUP BY r.season_id, r.episode`,
      [user.id, couchId, seasons, eps]
    ),
    pool.query(
      `SELECT r.season_id, r.user_id, COALESCE(u.username, u.name) AS name, r.stars, r.take
         FROM episode_ratings r JOIN "user" u ON u.id = r.user_id JOIN unnest($3::uuid[], $4::int[]) AS m(season_id, ep) ON m.season_id = r.season_id AND r.episode = m.ep
        WHERE ${SHARED("$1", "$2")}
        ORDER BY (r.user_id = $1) DESC, r.updated_at DESC`,
      [user.id, couchId, seasons, eps]
    ),
  ]);
  const lastRated = new Map<string, number>();
  for (const b of bars) lastRated.set(b.season_id, Math.max(lastRated.get(b.season_id) ?? 0, new Date(b.at).getTime()));
  const shows: ShowVerdict[] = seasons.map((id) => {
    const e = at.get(id)!;
    const h = headers.get(id)!;
    const people: RatingFace[] = faces.filter((f) => f.season_id === id).map((f) => ({ userId: f.user_id, name: f.name, stars: f.stars, take: f.take }));
    const avgOf = new Map(bars.filter((b) => b.season_id === id).map((b) => [b.episode as number, Math.round(b.avg * 10) / 10]));
    const taker = people.find((p) => p.take && p.userId !== user.id) ?? people.find((p) => p.take) ?? null;
    return {
      seasonId: id,
      label: labelOf(h),
      artUrl: h.show.artUrl,
      episode: e,
      avg: average(people.map((p) => p.stars)),
      n: people.length,
      people,
      mine: people.find((p) => p.userId === user.id)?.stars ?? null,
      take: taker ? { userId: taker.userId, name: taker.name, text: taker.take! } : null,
      byEpisode: Array.from({ length: Math.min(e, BARS_MAX) }, (_, i) => e - Math.min(e, BARS_MAX) + 1 + i).map((n) => ({ episode: n, avg: avgOf.get(n) ?? null })),
    };
  });
  // Shows the couch has rated lately first, then the rest, newest episode first.
  shows.sort((a, b) => (lastRated.get(b.seasonId) ?? 0) - (lastRated.get(a.seasonId) ?? 0) || b.episode - a.episode);
  return { shows: shows.slice(0, SHOWS_MAX) };
}

/**
 * The hub's read (couch-hub.ts): your taste twin, how often you agree with the couch, how many shows have a verdict, and the
 * rating accolades. From every rating you may see by the couch's people (each only within your mark on its season), sent from
 * Neon compactly: one row per person and season, its episodes and stars as one short string.
 */
export async function couchTaste(userId: string, couchId: string, people: Person[]): Promise<{ taste: Taste; accolades: Accolade[] }> {
  const marks = await seenThroughAll(userId);
  const seasons = [...marks].filter(([, m]) => m > 0);
  if (!seasons.length) return { taste: { twin: null, agree: null, shows: 0 }, accolades: [] };
  const { rows } = await pool.query(
    `SELECT r.user_id, r.season_id, string_agg(r.episode || ':' || r.stars, ',' ORDER BY r.episode) AS s
       FROM episode_ratings r JOIN unnest($3::uuid[], $4::int[]) AS m(season_id, seen) ON m.season_id = r.season_id AND r.episode <= m.seen
      WHERE ${SHARED("$1", "$2")}
      GROUP BY r.user_id, r.season_id`,
    [userId, couchId, seasons.map(([id]) => id), seasons.map(([, m]) => (Number.isFinite(m) ? m : 100000))]
  );
  const rated: Rated[] = rows.flatMap((r) =>
    String(r.s)
      .split(",")
      .map((x) => x.split(":").map(Number))
      .map(([episode, stars]) => ({ userId: r.user_id as string, seasonId: r.season_id as string, episode, stars }))
  );
  const headers = await seasonHeaders([...new Set(rated.map((r) => r.seasonId))]);
  return {
    taste: tasteOf(rated, userId, people),
    accolades: ratingAccolades(rated, people, (id) => {
      const h = headers.get(id);
      return h ? labelOf(h) : null;
    }),
  };
}
