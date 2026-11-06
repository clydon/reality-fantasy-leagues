import { cleanGif, type Gif } from "@/lib/game/watch-along";
import { isUuid, type SessionUser } from "./auth-helpers";
import { requireCouch } from "./couches";
import { HttpError, pool } from "./db";
import { gifFrom, type GifSource } from "./gifs";
import { EVERYTHING, seenThrough, sharesSql } from "./guard";
import { latestAired, seasonSchedules } from "./schedule";

// React with a GIF (docs/PLAN-gif-reactions.md; migration 0162 episode_gifs), in place of Rate it's stars (shelved 2026-11-01):
//   GET  /api/seasons/[id]/gifs/[n]?couch=   one episode's: yours, and the couch's people who share the show and picked one
//   POST /api/seasons/[id]/gifs/[n]?couch=   { gif } yours (again), { gif: null } takes it back; answers as GET does
// plus each episode's on the Episodes read (seasonGifs). A GIF is anything you searched for on KLIPY (gifs.ts), kept only from
// KLIPY's own media hosts.
//
// Spoiler-safe on the server, as ratings were: yours only for an episode you've seen that has aired, and anyone's only sent to
// someone who has seen it (a GIF can say a lot about who went home). Only what people share: someone else's counts only while
// they follow the show openly and share My episode GIFs (guard.ts sharesSql). Without a couch with someone else on it, only
// yours: strangers' GIFs never leave the server. Nothing polls (docs/HOSTING.md).

export interface EpisodeGifFace {
  userId: string;
  name: string;
  gif: Gif;
}

export interface EpisodeGifs {
  seasonId: string;
  episode: number;
  mine: Gif | null;
  /** The couch's people who picked one (you never among them), newest first. */
  people: EpisodeGifFace[];
  /** How many on the couch share the show, you included ("4 of 6"): 0 without a couch with someone else on it. */
  of: number;
}

/** Each episode's, for the Episodes read: how many, whether yours is among them, and the first few pictures (yours first). */
export interface EpisodeGifLine {
  n: number;
  mine: boolean;
  urls: string[];
}

/** Someone who shares their GIFs on its season (following it openly, My episode GIFs on): a condition on `g`. */
const OPEN = sharesSql("gifs", "g.user_id", "g.season_id");
/** The pictures an Episodes row stacks. */
const STACK = 3;

/**
 * A kept GIF as it's sent: KLIPY's (cleanGif), or under `next dev` a check's stand-in's picture (fake-gifs.js), which gifFrom let in
 * when it was posted: checked as KLIPY's would be, with its loopback host. Production only ever sends KLIPY's.
 */
function keptGif(g: unknown): Gif | null {
  const kept = cleanGif(g);
  if (kept || process.env.NODE_ENV !== "development" || !g || typeof g !== "object") return kept;
  const url = (g as { url?: unknown }).url;
  if (typeof url !== "string" || !/^http:\/\/(127\.0\.0\.1|localhost):\d+\//.test(url)) return null;
  const as = cleanGif({ ...(g as object), url: "https://static.klipy.com/" });
  return as ? { ...as, url } : null;
}

/** A couch with someone else on it is where GIFs are seen; none (or a couch of one) is only yours. */
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

export function episodeNumber(n: unknown): number {
  const e = Number(n);
  if (!Number.isInteger(e) || e < 1 || e > 1000) throw new HttpError(400, "Which episode?");
  return e;
}

/** One episode's GIFs, for someone who has seen it. */
export async function episodeGifs(user: SessionUser, seasonId: string, couchId: string | null, episode: number): Promise<EpisodeGifs> {
  await requireSeason(seasonId);
  const seen = await seenThrough(user.id, seasonId);
  if (!(episode <= seen)) throw new HttpError(403, `You haven't seen Episode ${episode} yet`);
  const couch = await couchScope(user, couchId);
  const [{ rows }, { rows: of }] = await Promise.all([
    pool.query(
      `SELECT g.user_id, COALESCE(u.username, u.name) AS name, g.gif FROM episode_gifs g JOIN "user" u ON u.id = g.user_id
        WHERE g.season_id = $1 AND g.episode = $2
          AND (g.user_id = $3${couch ? ` OR (g.user_id IN (SELECT user_id FROM couch_members WHERE couch_id = $4) AND ${OPEN})` : ""})
        ORDER BY g.updated_at DESC`,
      couch ? [seasonId, episode, user.id, couch] : [seasonId, episode, user.id]
    ),
    couch
      ? pool.query(`SELECT count(*)::int AS n FROM couch_members m WHERE m.couch_id = $1 AND (m.user_id = $2 OR ${sharesSql("gifs", "m.user_id", "$3::uuid")})`, [
          couch,
          user.id,
          seasonId,
        ])
      : Promise.resolve({ rows: [{ n: 0 }] }),
  ]);
  let mine: Gif | null = null;
  const people: EpisodeGifFace[] = [];
  for (const r of rows) {
    const gif = keptGif(r.gif);
    if (!gif) continue;
    if (r.user_id === user.id) mine = gif;
    else people.push({ userId: r.user_id, name: r.name, gif });
  }
  return { seasonId, episode, mine, people, of: of[0].n as number };
}

/** Your GIF for an episode you've seen (again), or `gif: null` to take it back. */
export async function reactToEpisode(
  user: SessionUser,
  seasonId: string,
  couchId: string | null,
  episodeIn: unknown,
  body: { gif?: unknown },
  src: GifSource | null
): Promise<EpisodeGifs> {
  const episode = episodeNumber(episodeIn);
  if (!body || !("gif" in body)) throw new HttpError(400, "Which GIF?");
  const gif = body.gif === null ? null : gifFrom(src, body.gif);
  if (body.gif !== null && !gif) throw new HttpError(400, src ? "That GIF can't be used" : "GIFs aren't on here");
  const season = await requireSeason(seasonId);
  const seen = await seenThrough(user.id, seasonId);
  if (!(episode <= seen)) throw new HttpError(403, `You haven't seen Episode ${episode} yet`);
  if (seen === EVERYTHING) {
    // Seeing everything straight away isn't watching it: only what's aired (or a finished season's episodes).
    const aired = Math.max(latestAired((await seasonSchedules([seasonId])).get(seasonId)), season.status === "completed" ? (season.episodeCount ?? 0) : 0);
    if (episode > aired) throw new HttpError(409, `Episode ${episode} hasn't aired yet`);
  }
  if (couchId) await requireCouch(user, couchId);
  if (gif) {
    await pool.query(
      `INSERT INTO episode_gifs (user_id, season_id, episode, gif) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, season_id, episode) DO UPDATE SET gif = EXCLUDED.gif, updated_at = now()`,
      [user.id, seasonId, episode, JSON.stringify(gif)]
    );
  } else {
    await pool.query("DELETE FROM episode_gifs WHERE user_id = $1 AND season_id = $2 AND episode = $3", [user.id, seasonId, episode]);
  }
  return episodeGifs(user, seasonId, couchId, episode);
}

/** Each episode's GIFs through `mark` (the Episodes read): the couch's with someone else on it, else only yours. */
export async function seasonGifs(userId: string, seasonId: string, couchId: string | null, mark: number): Promise<Map<number, EpisodeGifLine>> {
  const { rows } = await pool.query(
    `WITH c AS (SELECT user_id FROM couch_members WHERE couch_id = $4::uuid), s AS (SELECT (SELECT count(*) FROM c) > 1 AS couch)
     SELECT g.episode, g.user_id = $2 AS mine, g.gif FROM episode_gifs g
      WHERE g.season_id = $1 AND g.episode <= $3
        AND (g.user_id = $2 OR ((SELECT couch FROM s) AND g.user_id IN (SELECT user_id FROM c) AND ${OPEN}))
      ORDER BY g.episode, (g.user_id = $2) DESC, g.updated_at DESC`,
    [seasonId, userId, Number.isFinite(mark) ? mark : 100000, couchId]
  );
  const out = new Map<number, EpisodeGifLine>();
  for (const r of rows) {
    const gif = keptGif(r.gif);
    if (!gif) continue;
    const line = out.get(r.episode) ?? { n: 0, mine: false, urls: [] };
    line.n++;
    if (r.mine) line.mine = true;
    if (line.urls.length < STACK) line.urls.push(gif.url);
    out.set(r.episode, line);
  }
  return out;
}
