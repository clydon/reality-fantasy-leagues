import { createRequire } from "node:module";
import path from "node:path";
import type { SessionUser } from "./auth-helpers";
import { pool } from "./db";
import { EVERYTHING, seenThrough } from "./guard";
import { HttpError } from "./http-error";
import { calendar, seedOf } from "./preview-season";
import { wizardOptions } from "./start-spec";

// A live preview's season, read from the real one for the person asking (docs/PLAN-preview-release.md, step 1): the cast (names and
// photos only), the calendar, the real results through their mark, and the season page as they see it (the wizard's own,
// start-spec.ts wizardOptions: spoiler-guarded already). The definition itself is the bench's builder
// (tools/gameplay-bench/preview/definition.cjs, plain CommonJS loaded at run time), which refuses anything real past the mark.
//
// The mark (the plan's decision 5): what the app's own guard lets them be told about (guard.ts seenThrough), "everything" being the
// latest aired, as the start options take it (start-game.ts); never past the episode before the game starts.

export interface PreviewSeason {
  label: string;
  format: string;
  show: { name: string; slug: string };
  seasonName: string;
  number: number;
  cast: { name: string; photoUrl: string | null; tribe: string | null }[];
  episodes: { number: number; airAt: string }[];
  real: { n: number; kind: string; name: string; method: string | null; type: string | null }[];
  mark: number;
  from: number;
  page: { ctx: Record<string, unknown>; pack: Record<string, unknown> };
  rates?: Record<string, number>;
  /** The show's art as the app shows it (URLs: TMDB's or the project's own), written on the preview's copies. */
  art?: { art: string | null; backdrop: string | null; logo: string | null; artStyle: unknown; backdropStyle: unknown; season: string | null };
}

/** The game previewed: a gallery base and the gallery's changes on it. */
export interface PreviewGame {
  base: string;
  changes?: unknown[];
}

type Builder = {
  build: (season: PreviewSeason, o: object) => object;
  verdict: (definition: object) => { ok: boolean; why: string | null; gaps: string[] };
  resultsFor: (season: PreviewSeason) => unknown;
  mixTribes: <T>(cast: T[]) => T[];
  ratesOf: (season: Pick<PreviewSeason, "cast" | "real" | "mark">) => Record<string, number>;
};
export function builder(): Builder {
  return createRequire(path.join(process.cwd(), "package.json"))("./tools/gameplay-bench/preview/definition.cjs") as Builder;
}

/** The season as the builder takes it, for `user` on `couchId`'s page. */
export async function previewSeason(user: SessionUser, seasonId: string, couchId: string | null, now = new Date()): Promise<PreviewSeason> {
  const { rows: [s] } = await pool.query(
    `SELECT sh.name AS show, sh.slug, sh.format, sh.kind, ss.name, ss.season_number, sh.art_url, sh.backdrop_url, sh.logo_url, sh.art_style, sh.backdrop_style, ss.art_url AS season_art
       FROM show_seasons ss JOIN shows sh ON sh.id = ss.show_id WHERE ss.id = $1`,
    [seasonId]
  );
  if (!s) throw new HttpError(404, "No such season");
  if (s.kind === "sport") throw new HttpError(422, "No preview for a sport's season yet");
  // The couch the game would be made on: the one asked for, else their first (the wizard reads the season page as that couch sees it).
  const couch = couchId ?? (await pool.query(`SELECT couch_id FROM couch_members WHERE user_id = $1 AND role <> 'viewer' ORDER BY joined_at LIMIT 1`, [user.id])).rows[0]?.couch_id;
  if (!couch) throw new HttpError(422, "Start or join a couch to preview a game");
  const opts = await wizardOptions(user, seasonId, couch, now);
  if (!opts.wizard) throw new HttpError(422, `No preview for this season: ${opts.blocked ?? "nothing can start here"}`);
  // As the start route sends it: plain JSON (an undefined field dropped), as the definition must be.
  const page = JSON.parse(JSON.stringify(opts.wizard.page)) as PreviewSeason["page"];
  const pack = page.pack as { page?: string; episodes?: { aired?: number; total?: number; next?: { number: number; airs: string } | null } };
  const aired = opts.pace?.aired ?? pack.episodes?.aired ?? 0;
  const seen = await seenThrough(user.id, seasonId);
  const mark = Math.max(0, Math.min(seen === EVERYTHING ? aired : seen, aired, opts.from - 1));
  const [cast, listed, real] = await Promise.all([
    pool.query(`SELECT name, photo_url, tribe_name FROM season_cast WHERE season_id = $1 ORDER BY sort_order, name`, [seasonId]),
    pool.query(`SELECT number, air_at FROM season_episodes WHERE season_id = $1 ORDER BY number`, [seasonId]),
    pool.query(
      `SELECT episode_number AS n, kind, castaway_name AS name, method, event_type AS type FROM season_decisions
        WHERE season_id = $1 AND status = 'accepted' AND kind IN ('elimination', 'event') AND episode_number <= $2
        ORDER BY episode_number, decided_at, castaway_name`,
      [seasonId, mark]
    ),
  ]);
  const last = Math.max(opts.wizard.last ?? 0, ...listed.rows.map((e) => e.number as number), opts.from + 4);
  const season: PreviewSeason = {
    label: pack.page || `${s.show} ${s.season_number}`,
    format: s.format || "survivor",
    show: { name: s.show, slug: s.slug },
    seasonName: s.name || `Season ${s.season_number}`,
    number: s.season_number,
    cast: builder().mixTribes(cast.rows.map((c) => ({ name: c.name as string, photoUrl: (c.photo_url as string) || null, tribe: (c.tribe_name as string) || null }))),
    episodes: calendar(listed.rows.map((e) => ({ number: e.number, airAt: e.air_at ? new Date(e.air_at).toISOString() : null })), last, pack.episodes?.next ?? null),
    real: real.rows,
    mark,
    from: opts.from,
    page,
    art: { art: s.art_url ?? null, backdrop: s.backdrop_url ?? null, logo: s.logo_url ?? null, artStyle: s.art_style ?? null, backdropStyle: s.backdrop_style ?? null, season: s.season_art ?? null },
  };
  // Too little of this season seen to shape the made-up moments by: the show's latest other season's (all aired, its rates only).
  if (mark < 2) season.rates = await otherSeasonRates(seasonId);
  return season;
}

async function otherSeasonRates(seasonId: string): Promise<Record<string, number> | undefined> {
  const { rows: [o] } = await pool.query(
    `SELECT ss.id FROM show_seasons ss WHERE ss.show_id = (SELECT show_id FROM show_seasons WHERE id = $1) AND ss.id <> $1
        AND EXISTS (SELECT 1 FROM season_decisions d WHERE d.season_id = ss.id AND d.status = 'accepted')
      ORDER BY ss.season_number DESC LIMIT 1`,
    [seasonId]
  );
  if (!o) return undefined;
  const [cast, real] = await Promise.all([
    pool.query(`SELECT count(*)::int AS k FROM season_cast WHERE season_id = $1`, [o.id]),
    pool.query(`SELECT episode_number AS n, kind, castaway_name AS name, method, event_type AS type FROM season_decisions WHERE season_id = $1 AND status = 'accepted' AND kind IN ('elimination', 'event')`, [o.id]),
  ]);
  const top = Math.max(0, ...real.rows.map((x) => x.n as number));
  return builder().ratesOf({ cast: Array.from({ length: cast.rows[0].k }, () => ({ name: "", photoUrl: null, tribe: null })), real: real.rows, mark: top });
}

/** A preview's definition for `user`: the season at their mark, the game they're making, the made-up season's seed. */
export async function previewDefinition(user: SessionUser, seasonId: string, couchId: string | null, game: PreviewGame, now = new Date()) {
  const season = await previewSeason(user, seasonId, couchId, now);
  const B = builder();
  try {
    const definition = B.build(season, { base: game.base, changes: game.changes ?? [], gameId: game.base, seed: seedOf(user.id, seasonId, season.mark) });
    // A game the runtime can't play yet says so now, never a preview that fails partway (the release plan's step 2).
    const v = B.verdict(definition);
    if (!v.ok) {
      console.warn(`[preview] no preview for ${game.base}: ${v.gaps.join("; ") || v.why}`);
      throw new HttpError(422, "No preview for this game yet");
    }
    return { definition, season, resultsFor: B.resultsFor(season) };
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "preview-season" || code === "preview-game") throw new HttpError(422, (e as Error).message);
    throw e;
  }
}
