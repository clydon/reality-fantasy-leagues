import crypto from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { after } from "next/server";
import type { SessionUser } from "./auth-helpers";
import { pool } from "./db";
import { HttpError } from "./http-error";
import type { PreviewGame } from "./preview-definition";

// A game's preview made on demand (docs/PLAN-game-preview.md, "On demand"; docs/PLAN-preview-release.md): the gameplay bench's live
// maker (tools/gameplay-bench/preview/live.cjs) plays a made-up season in the explorer's runtime and writes each moment as a temporary
// copy of the game. The story runs on the preview host (preview.<host>), signed in there as the preview's own made-up viewer, its
// phones the real app on that same host, so the person's own session, on the app's host, is never touched.
//
// The registry is a table (db/migrations/0442: step 3), so whichever server instance answers reads the same preview. The way into a
// story is a token used once, minutes long, kept as its hash (step 4): whoever made the preview asks for it each time they open it,
// so a copied link opens nothing; the enter route spends it and signs the viewer in with a session the server mints
// (src/lib/preview-session.ts), no password. The story is read, and closed, by its viewer's session or its owner's.
//
// Where it runs: in development, and on the preview service (PREVIEW_SERVICE=1, step 5); never on the app in production.

export const LIVE_MINUTES = 30;
const ENTRY_MINUTES = 2;
/** The first slice's gallery games (the gallery's Preview button sends any game's spec: the release plan's step 15). */
const GAMES: Record<string, PreviewGame> = { fantasy: { base: "fantasy", changes: ["redraft"] }, sheet: { base: "sheet" }, pool: { base: "pool" } };

type Made = { viewerUser: string; viewerPass?: string; copies: string[]; complete?: boolean; failed?: string | null } & Record<string, unknown>;

/** The bench's live maker, loaded from disk at run time (plain CommonJS outside src/, never bundled). */
function bench() {
  const req = createRequire(path.join(process.cwd(), "package.json"));
  return req("./tools/gameplay-bench/preview/live.cjs") as {
    make: (o: object) => Promise<{ preview: Made; rest: Promise<void> }>;
    down: (p: { copies: string[] }) => Promise<void>;
  };
}

export function serviceOnly() {
  if (process.env.NODE_ENV === "production" && process.env.PREVIEW_SERVICE !== "1") throw new HttpError(404, "Not found");
}

const secret = () => process.env.BETTER_AUTH_SECRET || "dev";
/** Whose a preview is, as the service keeps it: an opaque key from the person's id, never the id. */
export const ownerKey = (userId: string) => crypto.createHmac("sha256", secret()).update(`preview-owner.${userId}`).digest("base64url");
export const tokenHash = (token: string) => crypto.createHash("sha256").update(token).digest("base64url");

/** The story as its page reads it: the maker's preview less its copies and its people's sign-in. */
function storyOf(p: Made) {
  const out = JSON.parse(JSON.stringify(p)) as Record<string, unknown>;
  for (const k of ["viewerUser", "viewerPass", "copies"]) delete out[k];
  return out;
}
async function save(id: string, p: Made): Promise<boolean> {
  const r = await pool.query(`UPDATE live_previews SET story = $2, copies = $3, complete = $4, failed = $5 WHERE id = $1`, [id, JSON.stringify(storyOf(p)), JSON.stringify(p.copies), !!p.complete, p.failed ?? null]);
  return (r.rowCount ?? 0) > 0;
}

/** A way into a preview's story: a token used once, ENTRY_MINUTES long, kept as its hash. */
async function entryFor(id: string): Promise<string> {
  const token = crypto.randomBytes(24).toString("base64url");
  await pool.query(`INSERT INTO live_preview_entries (token_hash, preview_id, expires_at) VALUES ($1, $2, now() + make_interval(mins => $3))`, [tokenHash(token), id, ENTRY_MINUTES]);
  return token;
}

/** Remove previews' copies, by the rows taken (each taken by one instance only: DELETE ... RETURNING). */
async function drop(rows: { id: string; copies: string[] }[]) {
  const { down } = bench();
  for (const r of rows) await down({ copies: r.copies }).catch((e: unknown) => console.error(`[preview-live] ${r.id}:`, e));
}

/** Expired previews' copies, removed (each new preview sweeps first; the hourly job too: step 7). */
export async function sweepLivePreviews(): Promise<number> {
  const { rows } = await pool.query(`DELETE FROM live_previews WHERE COALESCE(kept_until, expires_at) <= now() RETURNING id, copies`);
  await drop(rows);
  return rows.length;
}

/** Development's season when none is asked for: Survivor 51 in this database (the first slice's). */
async function devSeason(): Promise<string> {
  const { rows } = await pool.query(`SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.slug = 'survivor' AND ss.season_number = 51`);
  if (!rows[0]) throw new HttpError(422, "No Survivor 51 in this database");
  return rows[0].id;
}

/**
 * Make a live preview of a gallery game for `user`: the season read for them at their own mark (preview-definition.ts, step 1),
 * its moments, each screen's copy and address on the preview host. `where`: the season (default Survivor 51) and the couch the game
 * would be made on (default their first). Answers the preview's id and a way into its story.
 */
export async function makeLivePreview(user: SessionUser, game: string, where: { seasonId?: string; couchId?: string | null } = {}) {
  serviceOnly();
  const g = GAMES[game];
  if (!g) throw new HttpError(400, "No such game to preview");
  await sweepLivePreviews();
  const { make, down } = bench();
  // Loaded when used: the season reader brings the start-a-game modules with it.
  const { previewDefinition } = await import("./preview-definition");
  const { definition, resultsFor } = await previewDefinition(user, where.seasonId ?? (await devSeason()), where.couchId ?? null, g);
  const id = crypto.randomUUID();
  let made: Made | null = null;
  // Each copy as it lands, saved for whichever instance the story asks (its row exists once the first is written).
  const onState = () => void (made && save(id, made).catch((e: unknown) => console.error(`[preview-live] save ${id}:`, e)));
  // The first moment's copy is written before this returns; the rest land after the response (after(): the request's own time,
  // its route's maxDuration).
  const out = await make({ input: definition, app: process.env.BETTER_AUTH_URL || "http://localhost:3014", resultsFor, seasons: 5, onState });
  made = out.preview;
  try {
    // The people's password is the maker's alone (its writes as each person, through the real routes): never kept.
    delete made.viewerPass;
    const { rows } = await pool.query(`SELECT id FROM "user" WHERE username = $1`, [made.viewerUser]);
    if (!rows[0]) throw new Error("The preview's viewer wasn't made");
    await pool.query(
      `INSERT INTO live_previews (id, owner_key, viewer_user_id, story, copies, expires_at) VALUES ($1, $2, $3, $4, $5, now() + make_interval(mins => $6))`,
      [id, ownerKey(user.id), rows[0].id, JSON.stringify(storyOf(made)), JSON.stringify(made.copies), LIVE_MINUTES]
    );
    const entry = await entryFor(id);
    const finished = made;
    // Closed before its last copy landed: those go too.
    after(() => out.rest.then(async () => { if (!(await save(id, finished))) await down(finished); }));
    return { id, entry, expires: Date.now() + LIVE_MINUTES * 60_000 };
  } catch (e) {
    // Never a copy nobody knows about: anything that fails once copies exist removes them (the ones still landing too).
    const failed = made;
    await Promise.resolve(out.rest).catch(() => {}).then(() => down(failed)).catch(() => {});
    await pool.query(`DELETE FROM live_previews WHERE id = $1`, [id]).catch(() => {});
    throw e;
  }
}

/** A way into one of `user`'s own previews (opening it again: decision 6), while it lasts. */
export async function livePreviewEntry(user: SessionUser, id: string): Promise<string> {
  serviceOnly();
  const { rows } = await pool.query(`SELECT 1 FROM live_previews WHERE id = $1 AND owner_key = $2 AND COALESCE(kept_until, expires_at) > now()`, [id, ownerKey(user.id)]);
  if (!rows[0]) throw new HttpError(403, "This preview has ended");
  return entryFor(id);
}

/** The way in, spent: the preview's id and its viewer, or refused (made up, used, expired, or its preview ended). */
export async function enterLivePreview(token: string): Promise<{ id: string; viewerUserId: string }> {
  serviceOnly();
  const { rows } = await pool.query(
    `UPDATE live_preview_entries e SET used_at = now() FROM live_previews p
      WHERE e.token_hash = $1 AND e.used_at IS NULL AND e.expires_at > now() AND p.id = e.preview_id AND COALESCE(p.kept_until, p.expires_at) > now()
      RETURNING p.id, p.viewer_user_id`,
    [tokenHash(token)]
  );
  if (!rows[0]) throw new HttpError(403, "This way in has been used or has ended. Open the preview again from the game.");
  return { id: rows[0].id, viewerUserId: rows[0].viewer_user_id };
}

/** Who may read or close a preview: its viewer's session (on the preview host), or its owner (on the app's). */
const whose = `id = $1 AND (viewer_user_id = $2 OR owner_key = $3)`;

/** The story's moments as they stand (each screen's address once its copy has landed; `complete` once they all have). */
export async function livePreviewStory(id: string, user: SessionUser) {
  serviceOnly();
  const { rows } = await pool.query(
    `SELECT story, complete, failed, COALESCE(kept_until, expires_at) AS until FROM live_previews WHERE ${whose} AND COALESCE(kept_until, expires_at) > now()`,
    [id, user.id, ownerKey(user.id)]
  );
  if (!rows[0]) throw new HttpError(403, "This preview has ended");
  return { ...rows[0].story, complete: rows[0].complete, failed: rows[0].failed, id, expires: new Date(rows[0].until).getTime() };
}

/** The story closed: its copies go now rather than at the half hour. */
export async function closeLivePreview(id: string, user: SessionUser) {
  serviceOnly();
  const { rows } = await pool.query(`DELETE FROM live_previews WHERE ${whose} RETURNING id, copies`, [id, user.id, ownerKey(user.id)]);
  await drop(rows);
}
