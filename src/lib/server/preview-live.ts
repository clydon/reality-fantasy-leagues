import crypto from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
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
  preview: { viewerUser: string; copies: string[] } & Record<string, unknown>;
}

// Kept on globalThis so a dev server's reload doesn't forget the copies it made.
const registry: Map<string, LivePreview> = ((globalThis as { __gysLivePreviews?: Map<string, LivePreview> }).__gysLivePreviews ??= new Map());

/** The bench's modules, loaded from disk at run time (plain CommonJS outside src/, never bundled). */
function bench() {
  const req = createRequire(path.join(process.cwd(), "package.json"));
  return {
    Live: req("./tools/gameplay-bench/preview/live.cjs") as { make: (o: object) => Promise<LivePreview["preview"]>; down: (p: object) => Promise<void> },
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
  const preview = await Live.make({ input: Proof.definition({ seed: 51, ...g }), app: process.env.BETTER_AUTH_URL || "http://localhost:3014", resultsFor: Proof._h.resultsFor, seasons: 5 });
  const id = crypto.randomUUID();
  const expires = Date.now() + LIVE_MINUTES * 60_000;
  registry.set(id, { id, owner: userId, expires, preview });
  // The copies and the viewer's sign-in stay on the server: the maker gets the way into its story, on the preview host.
  return { id, expires, pass: passFor(id, expires) };
}

function byPass(id: string, expires: number, pass: string): LivePreview {
  devOnly();
  const p = registry.get(id);
  if (!p || p.expires !== expires || !passOk(id, expires, pass)) throw new HttpError(403, "This preview has ended");
  return p;
}

/** The preview's own viewer, for its story's sign-in on the preview host: the pass must be this preview's, unexpired. */
export function livePreviewSeat(id: string, expires: number, pass: string): { viewerUser: string } {
  return { viewerUser: byPass(id, expires, pass).preview.viewerUser };
}

/** The story's moments, read by its page on the preview host with the pass. */
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
