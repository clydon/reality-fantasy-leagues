import crypto from "node:crypto";

// The app's asks of the preview service, signed (docs/PLAN-preview-release.md, step 9): an HMAC of the time and the body with the
// secret both share (PREVIEW_SECRET), good for five minutes. Only the app can ask the service to make a preview, or to remove one of
// someone's. In development, when the two are one server, a fixed secret stands in; in production one must be set.
const WINDOW_MS = 5 * 60_000;

function secret(): string {
  const s = process.env.PREVIEW_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("PREVIEW_SECRET isn't set");
  return "dev-preview-secret";
}
const mac = (time: string, body: string) => crypto.createHmac("sha256", secret()).update(`${time}.${body}`).digest("base64url");

/** The headers that sign `body` now. */
export function signedHeaders(body: string, now = Date.now()): Record<string, string> {
  const time = String(now);
  return { "x-preview-time": time, "x-preview-signature": mac(time, body) };
}

/** Whether these headers sign this body, inside the window. */
export function signedBy(headers: Headers, body: string, now = Date.now()): boolean {
  const time = headers.get("x-preview-time") ?? "", sig = headers.get("x-preview-signature") ?? "";
  if (!/^\d+$/.test(time) || Math.abs(now - Number(time)) > WINDOW_MS) return false;
  const want = Buffer.from(mac(time, body)), got = Buffer.from(sig);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}
