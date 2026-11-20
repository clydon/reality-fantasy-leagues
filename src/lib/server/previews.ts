import { isSuperAdminUser, type SessionUser } from "./auth-helpers";
import { pool } from "./db";
import { HttpError } from "./http-error";
import { giveBack, previewsLeft, takePreview } from "./preview-allowance";
import type { PreviewGame } from "./preview-definition";
import { gameKeyOf, ownerKey, type Exits, type MakeRequest } from "./preview-live";
import { signedHeaders } from "./preview-signature";

// A game's live preview, the app's half (docs/PLAN-preview-release.md, step 9). The app keeps everything real: it reads the season
// for the person at their own mark (preview-definition.ts), takes one of their day's previews, and asks the preview service to make
// it, sending only the definition, the made-up results' rates and an opaque key for the person (never their id, name or account).
// The service answers a way into the story on its own host. With PREVIEW_SERVICE_URL unset (development) the service is this same
// server, asked in-process; set, it's asked over HTTPS, signed (preview-signature.ts).
//
// Who can: the desk's switch (decision 3), app_settings 'live_previews': off, admins, or everyone (development: everyone).

export type PreviewSwitch = "off" | "admins" | "everyone";

/** The desk's switch: who previews are open to. */
export async function previewSwitch(): Promise<PreviewSwitch> {
  const { rows } = await pool.query(`SELECT value FROM app_settings WHERE key = 'live_previews'`);
  const v = rows[0]?.value;
  if (v === "off" || v === "admins" || v === "everyone") return v;
  return process.env.NODE_ENV === "production" ? "off" : "everyone";
}

/** The app's half runs on the app only: on the preview service (whose people are all made up) it would ask itself, in-process and
 *  unsigned (step 13's review). */
export function appOnly() {
  if (process.env.PREVIEW_SERVICE === "1") throw new HttpError(404, "Not found");
}

/** A preview's id as the service names it (anything else never reaches its path). */
const PREVIEW_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Whether previews are open to `user` now. */
export async function previewsOpenTo(user: SessionUser): Promise<boolean> {
  const s = await previewSwitch();
  return s === "everyone" || (s === "admins" && isSuperAdminUser(user));
}

/** The preview service's address, as the person's browser reaches it. */
export function serviceUrl(appOrigin: string): string {
  if (process.env.PREVIEW_SERVICE_URL) return process.env.PREVIEW_SERVICE_URL.replace(/\/$/, "");
  const u = new URL(appOrigin);
  return `${u.protocol}//preview.${u.host}`;
}

/** An ask of the service: in-process in development, signed over HTTPS once it's a service of its own (`wait`: how long to wait). */
async function ask<T>(method: "POST" | "DELETE", path: string, body: object, wait?: number): Promise<T> {
  const url = process.env.PREVIEW_SERVICE_URL;
  if (!url) {
    const live = await import("./preview-live");
    if (path === "/api/preview-live/make") return (await live.makeFromDefinition(body as MakeRequest)) as T;
    if (path === "/api/preview-live/month") return (await live.previewMonth()) as T;
    const m = /^\/api\/preview-live\/([\w-]+)$/.exec(path);
    if (method === "DELETE" && m) return (await live.closeByOwner(m[1], (body as { owner: string }).owner)) as T;
    throw new Error("No such ask: " + path);
  }
  const text = JSON.stringify(body);
  let r: Response;
  try {
    r = await fetch(url.replace(/\/$/, "") + path, { method, headers: { "content-type": "application/json", ...signedHeaders(method, path, text) }, body: text, ...(wait ? { signal: AbortSignal.timeout(wait) } : {}) });
  } catch {
    throw new HttpError(503, "The preview service isn't answering. Try again in a minute.");
  }
  const out = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new HttpError(r.status, out.error || "The preview service couldn't make it.");
  return out;
}

/**
 * A preview for `user` of `game` on a season, as the couch it would be made on sees it: theirs reopened if they have one of it at
 * their mark (free), else one of this week's taken and the service asked to make it (given back if it isn't, or if it reopened one).
 * Answers its story's address on the service (a way in, used once) and how many they have left this week.
 */
export async function startPreview(user: SessionUser, o: { seasonId: string; couchId: string | null; game: PreviewGame; exits: Exits; origin: string }) {
  appOnly();
  if (!(await previewsOpenTo(user))) throw new HttpError(403, "Previews aren't open yet.");
  const { previewDefinition, builder } = await import("./preview-definition");
  const { definition, season } = await previewDefinition(user, o.seasonId, o.couchId, o.game);
  const { left } = await previewsLeft(user.id, previewUsage);
  const use = left > 0 ? await takePreview(user.id, previewUsage) : null;
  try {
    const req: MakeRequest = { owner: ownerKey(user.id), key: gameKeyOf(o.seasonId, season.mark, o.game), definition, rates: builder().ratesOf(season), exits: o.exits, canMake: !!use };
    const made = await ask<{ id: string; entry: string; expires: number; reopened: boolean }>("POST", "/api/preview-live/make", req);
    if (made.reopened && use) await giveBack(use.useId);
    const to = `/start/preview-story/live/${made.id}`;
    return {
      id: made.id,
      entry: made.entry,
      story: `${serviceUrl(o.origin)}/api/preview-live/enter?w=${encodeURIComponent(made.entry)}&to=${encodeURIComponent(to)}`,
      reopened: made.reopened,
      left: made.reopened || !use ? left : use.left,
    };
  } catch (e) {
    if (use) await giveBack(use.useId);
    throw e;
  }
}

export type PreviewMonth = { previews: number; cpuMs: number; budgetMs: number };

/** This month's previews and their cost against the service's budget (the desk's line: step 18), or null when the service doesn't
 *  answer within a few seconds (the desk still opens). */
export async function previewUsage(): Promise<PreviewMonth | null> {
  try {
    return await ask<PreviewMonth>("POST", "/api/preview-live/month", {}, 3000);
  } catch (e) {
    console.error("[previews] the month:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** The person's preview, gone (the game made from it, or they're done): kept or not. */
export async function endPreview(user: SessionUser, id: string) {
  appOnly();
  if (!PREVIEW_ID.test(id)) throw new HttpError(404, "No such preview");
  await ask("DELETE", `/api/preview-live/${id}`, { owner: ownerKey(user.id) });
}
