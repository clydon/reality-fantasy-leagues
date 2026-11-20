import crypto from "node:crypto";

// The app's asks of the preview service, signed (docs/PLAN-preview-release.md, step 9): an HMAC of the method, the path, the time
// and the body with the secret both share (PREVIEW_SECRET), good for five minutes. Only the app can ask the service to make a
// preview, or to remove one of someone's; a signed ask is good only for its own route and method (step 13's review: a make's body
// can't stand in as a removal). In development, when the two are one server, a fixed secret stands in; in production one must be set.
const WINDOW_MS = 5 * 60_000;

function secret(): string {
  const s = process.env.PREVIEW_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("PREVIEW_SECRET isn't set");
  return "dev-preview-secret";
}
const mac = (method: string, path: string, time: string, body: string) => crypto.createHmac("sha256", secret()).update(`${method.toUpperCase()}\n${path}\n${time}\n${body}`).digest("base64url");

/** The headers that sign `method path` with `body` now. */
export function signedHeaders(method: string, path: string, body: string, now = Date.now()): Record<string, string> {
  const time = String(now);
  return { "x-preview-time": time, "x-preview-signature": mac(method, path, time, body) };
}

/** Whether this request's headers sign its own method, path and this body, inside the window. */
export function signedBy(req: Request, body: string, now = Date.now()): boolean {
  const time = req.headers.get("x-preview-time") ?? "", sig = req.headers.get("x-preview-signature") ?? "";
  if (!/^\d+$/.test(time) || Math.abs(now - Number(time)) > WINDOW_MS) return false;
  const want = Buffer.from(mac(req.method, new URL(req.url).pathname, time, body)), got = Buffer.from(sig);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}
