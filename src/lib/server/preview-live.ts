import crypto from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { after } from "next/server";
import { HttpError } from "./http-error";

// A game's preview made on demand (docs/PLAN-game-preview.md, "On demand"), with no screenshots and nobody making it by hand: the
// gameplay bench's live maker (tools/gameplay-bench/preview/live.cjs) plays a made-up season in the explorer's runtime and writes
// each moment as a temporary copy of the game. The story itself runs on the preview host (preview.<host>), signed in there as the
// preview's own viewer, its phones the real app on that same host (so the sign-in is the host's own, never a third party's, and the
// person's own session, on the app's host, is never touched). This holds who made each preview, its copies and a signed pass for its
// story, and removes the copies after half an hour, or when the story closes.
//
// Development only, as the live tier is (it writes only to a local database): the plan's "On demand" says what production needs (a
// preview service with its own database, on its own host).

export const LIVE_MINUTES = 30;
const GAMES: Record<string, { base?: string; gameId?: string }> = { fantasy: {}, sheet: { base: "sheet", gameId: "sheet" }, pool: { base: "pool", gameId: "pool" } };

interface LivePreview {
  id: string;
  owner: string;
  expires: number;
  /** The maker's preview, filled in as its copies land (live.cjs): its moments, `complete`, `failed`, what's typical. */
  preview: { viewerUser: string; copies: string[]; complete?: boolean } & Record<string, unknown>;
  /** The preview's people's own password (the viewer's sign-in on the preview host), kept here, never sent. */
  viewerPass: string;
}

// Kept on globalThis so a dev server's reload doesn't forget the copies it made.
const registry: Map<string, LivePreview> = ((globalThis as { __gysLivePreviews?: Map<string, LivePreview> }).__gysLivePreviews ??= new Map());

/** The bench's modules, loaded from disk at run time (plain CommonJS outside src/, never bundled). */
function bench() {
  const req = createRequire(path.join(process.cwd(), "package.json"));
  return {
    Live: req("./tools/gameplay-bench/preview/live.cjs") as { make: (o: object) => Promise<{ preview: LivePreview["preview"] & { viewerPass?: string }; rest: Promise<void> }>; down: (p: object) => Promise<void> },
    Proof: req("./scripts/dev-test/preview-proof.js") as { definition: (o: object) => object; _h: { resultsFor: unknown } },
  };
}

function devOnly() {
  if (process.env.NODE_ENV === "production") throw new HttpError(404, "Not found");
}

const secret = () => process.env.BETTER_AUTH_SECRET || "dev";
/** The pass a preview's phones carry to the preview host: its id and expiry, signed. */
export function passFor(id: string, expires: number): string {
  return crypto.createHmac("sha256", secret()).update(`live-preview.${id}.${expires}`).digest("base64url");
}
function passOk(id: string, expires: number, pass: string): boolean {
  const want = Buffer.from(passFor(id, expires));
  const got = Buffer.from(pass);
  return want.length === got.length && crypto.timingSafeEqual(want, got) && Date.now() < expires;
}

/** Remove a preview's copies and forget it. */
async function drop(p: LivePreview) {
  registry.delete(p.id);
  await bench().Live.down(p.preview).catch((e: unknown) => console.error(`[preview-live] ${p.id}:`, e));
}

/** Expired previews' copies, removed (each new preview sweeps first). */
async function sweep() {
  const now = Date.now();
  for (const p of [...registry.values()]) if (p.expires <= now) await drop(p);
}

/** Make a live preview of a gallery game for `userId`: its moments, each screen's copy and address on the preview host. */
export async function makeLivePreview(userId: string, game: string) {
  devOnly();
  const g = GAMES[game];
  if (!g) throw new HttpError(400, "No such game to preview");
  await sweep();
  const { Live, Proof } = bench();
  // The first moment's copy is written before this returns; the rest land after the response (after(): the request's own time,
  // its route's maxDuration), and the story asks for them as they do.
  const made = await Live.make({ input: Proof.definition({ seed: 51, ...g }), app: process.env.BETTER_AUTH_URL || "http://localhost:3014", resultsFor: Proof._h.resultsFor, seasons: 5 });
  try {
    const { preview, rest } = made;
    const viewerPass = String(preview.viewerPass ?? "");
    delete preview.viewerPass;
    const id = crypto.randomUUID();
    const expires = Date.now() + LIVE_MINUTES * 60_000;
    registry.set(id, { id, owner: userId, expires, preview, viewerPass });
    after(() => rest);
    return { id, expires, pass: passFor(id, expires) };
  } catch (e) {
    // Never a copy nobody knows about: anything that fails once copies exist removes them (the ones still landing too).
    const p = (made as { preview?: LivePreview["preview"]; rest?: Promise<void> } | undefined) ?? {};
    if (p.preview) await Promise.resolve(p.rest).catch(() => {}).then(() => Live.down(p.preview!)).catch(() => {});
    throw e;
  }
}

function byPass(id: string, expires: number, pass: string): LivePreview {
  devOnly();
  const p = registry.get(id);
  if (!p || p.expires !== expires || !passOk(id, expires, pass)) throw new HttpError(403, "This preview has ended");
  return p;
}

/** The preview's own viewer, for its story's sign-in on the preview host: the pass must be this preview's, unexpired. */
export function livePreviewSeat(id: string, expires: number, pass: string): { viewerUser: string; viewerPass: string } {
  const p = byPass(id, expires, pass);
  return { viewerUser: p.preview.viewerUser, viewerPass: p.viewerPass };
}

/** The story's moments as they stand (each screen's address once its copy has landed; `complete` once they all have, and what's
 *  typical), read by its page on the preview host with the pass. */
export function livePreviewStory(id: string, expires: number, pass: string) {
  // The copies and the viewer's sign-in stay on the server.
  const story = Object.fromEntries(Object.entries(byPass(id, expires, pass).preview).filter(([k]) => k !== "viewerUser" && k !== "copies"));
  return { ...story, id };
}

/** The story closed: its copies go now rather than at the half hour. Whoever made it, or its story (with the pass). */
export async function closeLivePreview(id: string, by: { userId?: string; expires?: number; pass?: string }) {
  devOnly();
  const p = registry.get(id);
  if (!p) return;
  if (by.pass !== undefined) byPass(id, by.expires ?? 0, by.pass);
  else if (p.owner !== by.userId) throw new HttpError(403, "Not your preview");
  await drop(p);
}
