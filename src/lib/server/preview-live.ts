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
// The registry is a table (db/migrations/0444: step 3), so whichever server instance answers reads the same preview. The way into a
// story is a token used once, minutes long, kept as its hash (step 4): whoever made the preview asks for it each time they open it,
// so a copied link opens nothing; the enter route spends it and signs the viewer in with a session the server mints
// (src/lib/preview-session.ts), no password. The story is read, and closed, by its viewer's session or its owner's.
//
// Where it runs: in development, and on the preview service (PREVIEW_SERVICE=1, step 5); never on the app in production.

export const LIVE_MINUTES = 30;
const ENTRY_MINUTES = 2;
/** At most this many previews being made at once, whoever's (decision 4): for the database and the wait. */
export const AT_ONCE = 10;
/** The month's budget of what previews cost the service (decision 4): an hour of CPU to start, of the free plan's spare 2.6. */
export const MONTH_CPU_MS = Number(process.env.PREVIEW_MONTH_CPU_MS) || 3_600_000;
/** What a preview's phones cost on top of making it (their pages' renders, not measured here): a second and a half. */
const PHONES_CPU_MS = 1500;

type Made = { viewerUser: string; viewerPass?: string; copies: string[]; complete?: boolean; failed?: string | null } & Record<string, unknown>;

/** The preview builder (its made-up results, from the rates the app sends), loaded as the maker is. */
function builder() {
  return createRequire(path.join(process.cwd(), "package.json"))("./tools/gameplay-bench/preview/definition.cjs") as { resultsFor: (season: { rates: Record<string, number> }) => unknown };
}

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

function secret() {
  const s = process.env.BETTER_AUTH_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("BETTER_AUTH_SECRET isn't set");
  return "dev";
}
/** Whose a preview is, as the service keeps it: an opaque key from the person's id, never the id. */
export const ownerKey = (userId: string) => crypto.createHmac("sha256", secret()).update(`preview-owner.${userId}`).digest("base64url");
export const tokenHash = (token: string) => crypto.createHash("sha256").update(token).digest("base64url");

/** The story as its page reads it: the maker's preview less its copies and its people's sign-in. */
function storyOf(p: Made) {
  const out = JSON.parse(JSON.stringify(p)) as Record<string, unknown>;
  for (const k of ["viewerUser", "viewerPass", "copies"]) delete out[k];
  // Why it stopped is the log's, never the viewer's (step 13's review): the story only says a moment couldn't be made.
  if (out.failed) {
    console.error("[preview-live] stopped partway:", out.failed);
    out.failed = "stopped";
  }
  return out;
}
async function save(id: string, p: Made): Promise<boolean> {
  // The story keeps where its last card goes (set when it started being made).
  const r = await pool.query(`UPDATE live_previews SET story = $2 || jsonb_build_object('exits', story->'exits'), copies = $3, complete = $4, failed = $5 WHERE id = $1`, [id, JSON.stringify(storyOf(p)), JSON.stringify(p.copies), !!p.complete, p.failed ?? null]);
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

/** The longest a preview lives (kept while its game is made: a day; decision 6), and a margin: any copy older is the sweep's. */
export const STALE_HOURS = 26;
/** The live tier itself (its stale-copy sweep), loaded as the maker is. */
function tier() {
  return createRequire(path.join(process.cwd(), "package.json"))("./tools/gameplay-bench/live-db.cjs") as {
    downStale: (olderThanMs: number, keep: Set<string>) => Promise<string[]>;
  };
}

/** Expired previews' copies, removed (each new preview sweeps first; the hourly job too: step 7). */
export async function sweepLivePreviews(): Promise<number> {
  const { rows } = await pool.query(`DELETE FROM live_previews WHERE COALESCE(kept_until, expires_at) <= now() RETURNING id, copies`);
  await drop(rows);
  return rows.length;
}

/**
 * The full sweep (the open route the hourly job calls, step 7): expired previews, then any copy older than STALE_HOURS that no
 * preview still holds, registered or not (a maker that failed once left 43 behind before the registry learned to remove them).
 * At most once a minute, whoever asks: the last sweep's time is kept in app_settings, taken in one statement.
 */
export async function sweepAll(): Promise<{ swept: boolean; expired: number; stale: number }> {
  serviceOnly();
  const { rowCount } = await pool.query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('live_previews_swept', 'true'::jsonb, now())
       ON CONFLICT (key) DO UPDATE SET updated_at = now() WHERE app_settings.updated_at < now() - interval '1 minute'`
  );
  if (!rowCount) return { swept: false, expired: 0, stale: 0 };
  const expired = await sweepLivePreviews();
  const { rows } = await pool.query(`SELECT copies FROM live_previews`);
  const keep = new Set<string>(rows.flatMap((r) => r.copies as string[]));
  const stale = await tier().downStale(STALE_HOURS * 3600_000, keep);
  if (expired || stale.length) console.log(`[preview-live] swept ${expired} expired, ${stale.length} stale`);
  return { swept: true, expired, stale: stale.length };
}

/** Where the story's last card goes (the gallery's, step 15: back to the game's setup, or on to make it), on the app's host. */
export interface Exits {
  back: string;
  create: string;
}

/** Which game at which mark a preview is of (decision 6): the same key reopens it rather than making another. */
export const gameKeyOf = (seasonId: string, mark: number, game: PreviewGame) => crypto.createHash("sha256").update(JSON.stringify([seasonId, mark, game.base, game.changes ?? [], game.spec ?? null])).digest("base64url");

/**
 * What the app asks the service to make (src/lib/server/previews.ts, step 9): the definition it built from the real season, the
 * made-up results' rates, the person as an opaque key (never their id), which game at which mark (the key that reopens it), where
 * its last card goes, and whether they have a preview left today (else it can only reopen one).
 */
export interface MakeRequest {
  owner: string;
  key: string;
  definition: object;
  rates: Record<string, number>;
  exits: Exits | null;
  canMake: boolean;
}

/**
 * Make a live preview from a definition (the service's half): their preview of the same game at the same mark, while it lasts, is
 * reopened instead (decision 6); otherwise any other preview of theirs goes (one at a time) and this one is made: its moments, each
 * screen's copy and address on the preview host. Answers its id and a way into its story.
 */
export async function makeFromDefinition(o: MakeRequest): Promise<{ id: string; entry: string; expires: number; reopened: boolean }> {
  serviceOnly();
  await sweepLivePreviews();
  const again = await reopen(o.owner, o.key);
  if (again) return { ...again, reopened: true };
  if (!o.canMake) throw new HttpError(429, "No previews left today: more tomorrow.");
  const { make, down } = bench();
  const resultsFor = builder().resultsFor({ rates: o.rates });
  const id = await startMaking(o.owner, o.key, o.exits);
  const cpu0 = process.cpuUsage();
  let made: Made | null = null;
  // Each copy as it lands, saved for whichever instance the story asks (its row exists once the first is written).
  const onState = () => void (made && save(id, made).catch((e: unknown) => console.error(`[preview-live] save ${id}:`, e)));
  // The first moment's copy is written before this returns; the rest land after the response (after(): the request's own time,
  // its route's maxDuration).
  let out: Awaited<ReturnType<ReturnType<typeof bench>["make"]>>;
  try {
    out = await make({ input: o.definition, app: process.env.BETTER_AUTH_URL || "http://localhost:3014", resultsFor, seasons: 5, onState });
  } catch (e) {
    await pool.query(`DELETE FROM live_previews WHERE id = $1`, [id]).catch(() => {});
    // What a make that failed cost still counts against the month (step 13's review), though its person gets their use back.
    await spent(cpu0, false);
    throw e;
  }
  made = out.preview;  try {
    // The people's password is the maker's alone (its writes as each person, through the real routes): never kept.
    delete made.viewerPass;
    const { rows } = await pool.query(`SELECT id FROM "user" WHERE username = $1`, [made.viewerUser]);
    if (!rows[0]) throw new Error("The preview's viewer wasn't made");
    await pool.query(`UPDATE live_previews SET viewer_user_id = $2, story = $3 || jsonb_build_object('exits', story->'exits'), copies = $4 WHERE id = $1`, [id, rows[0].id, JSON.stringify(storyOf(made)), JSON.stringify(made.copies)]);
    const entry = await entryFor(id);
    const finished = made;
    // Closed before its last copy landed: those go too.
    after(() =>
      out.rest
        .then(async () => {
          if (!(await save(id, finished))) await down(finished);
        })
        .finally(() => spent(cpu0))
    );
    return { id, entry, expires: Date.now() + LIVE_MINUTES * 60_000, reopened: false };
  } catch (e) {
    // Never a copy nobody knows about: anything that fails once copies exist removes them (the ones still landing too).
    const failed = made;
    await Promise.resolve(out.rest).catch(() => {}).then(() => down(failed)).catch(() => {});
    await pool.query(`DELETE FROM live_previews WHERE id = $1`, [id]).catch(() => {});
    await spent(cpu0, false);
    throw e;
  }
}

/** Their preview of this game at this mark, while it lasts (its first copy written): a new way into it. */
async function reopen(owner: string, key: string): Promise<{ id: string; entry: string; expires: number } | null> {
  const { rows } = await pool.query(
    `SELECT id, COALESCE(kept_until, expires_at) AS until FROM live_previews WHERE owner_key = $1 AND game_key = $2 AND viewer_user_id IS NOT NULL AND COALESCE(kept_until, expires_at) > now() ORDER BY created_at DESC LIMIT 1`,
    [owner, key]
  );
  if (!rows[0]) return null;
  return { id: rows[0].id, entry: await entryFor(rows[0].id), expires: new Date(rows[0].until).getTime() };
}

/**
 * Kept while they make the game (decision 6): the story left for its last card's Go back or Create this game. Kept to a day from when
 * it was made; gone sooner when the game is made, another preview is, or their mark moves (its key then makes a new one).
 */
export async function keepLivePreview(id: string, user: SessionUser): Promise<{ until: number }> {
  serviceOnly();
  const { rows } = await pool.query(
    `UPDATE live_previews SET kept_until = created_at + interval '24 hours' WHERE ${whose} AND COALESCE(kept_until, expires_at) > now() RETURNING kept_until`,
    [id, user.id, ownerKey(user.id)]
  );
  if (!rows[0]) throw new HttpError(403, "This preview has ended");
  return { until: new Date(rows[0].kept_until).getTime() };
}

/**
 * A preview's row, from the moment it starts being made (its viewer and copies once the first is written), so the previews being
 * made at once can be counted: refused past AT_ONCE ("Busy"), or once the month's budget is spent ("full this month").
 */
async function startMaking(owner: string, key: string, exits: Exits | null): Promise<string> {
  const db = await pool.connect();
  let old: { id: string; copies: string[] }[] = [];
  try {
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock(hashtext('live-preview-making'))");
    const { rows: [month] } = await db.query(`SELECT cpu_ms FROM live_preview_months WHERE month = date_trunc('month', now())::date`);
    if (Number(month?.cpu_ms ?? 0) >= MONTH_CPU_MS) throw new HttpError(503, "Previews are full this month: back on the 1st.");
    const { rows: [busy] } = await db.query(`SELECT count(*)::int AS k FROM live_previews WHERE NOT complete AND created_at > now() - interval '5 minutes'`);
    if (busy.k >= AT_ONCE) throw new HttpError(503, "Busy: try again in a minute.");
    // One at a time (decision 6): their other previews go, each once its first copy is in (one still being made is left to finish:
    // two taps at once, or a page asking twice, mustn't pull a preview out from under its own making; the next one made takes it).
    old = (await db.query(`DELETE FROM live_previews WHERE owner_key = $1 AND viewer_user_id IS NOT NULL RETURNING id, copies`, [owner])).rows;
    const id = crypto.randomUUID();
    await db.query(`INSERT INTO live_previews (id, owner_key, game_key, story, expires_at) VALUES ($1, $2, $3, $4, now() + make_interval(mins => $5))`, [id, owner, key, JSON.stringify({ exits }), LIVE_MINUTES]);
    await db.query("COMMIT");
    if (old.length) void drop(old);
    return id;
  } catch (e) {
    await db.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    db.release();
  }
}

/** What a preview cost the service, added to its month (the process's CPU since it started: a bound, as others share the process). */
async function spent(cpu0: NodeJS.CpuUsage, made = true) {
  const d = process.cpuUsage(cpu0);
  // A make that failed: its CPU only (no phones ever load it), and not a preview in the month's count.
  const ms = Math.round((d.user + d.system) / 1000) + (made ? PHONES_CPU_MS : 0), n = made ? 1 : 0;
  await pool
    .query(
      `INSERT INTO live_preview_months (month, previews, cpu_ms) VALUES (date_trunc('month', now())::date, $2, $1)
         ON CONFLICT (month) DO UPDATE SET previews = live_preview_months.previews + $2, cpu_ms = live_preview_months.cpu_ms + $1`,
      [ms, n]
    )
    .catch((e: unknown) => console.error("[preview-live] spent:", e));
}

/** This month's previews and what they've cost, against the budget (the desk's line: step 18). */
export async function previewMonth(): Promise<{ previews: number; cpuMs: number; budgetMs: number }> {
  const { rows: [m] } = await pool.query(`SELECT previews, cpu_ms FROM live_preview_months WHERE month = date_trunc('month', now())::date`);
  return { previews: m?.previews ?? 0, cpuMs: Number(m?.cpu_ms ?? 0), budgetMs: MONTH_CPU_MS };
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

/** The game made, or the person done with it (the app's own ask, signed: step 9): their preview goes, kept or not. */
export async function closeByOwner(id: string, owner: string) {
  serviceOnly();
  const { rows } = await pool.query(`DELETE FROM live_previews WHERE id = $1 AND owner_key = $2 RETURNING id, copies`, [id, owner]);
  await drop(rows);
}

/**
 * The story closed: its copies go now rather than at the half hour. Its viewer's close (the story's page leaving) leaves a preview
 * kept while its game is made; its owner's (the game made, step 9) removes it either way.
 */
export async function closeLivePreview(id: string, user: SessionUser) {
  serviceOnly();
  const { rows } = await pool.query(
    `DELETE FROM live_previews WHERE id = $1 AND (owner_key = $3 OR (viewer_user_id = $2 AND kept_until IS NULL)) RETURNING id, copies`,
    [id, user.id, ownerKey(user.id)]
  );
  await drop(rows);
}
