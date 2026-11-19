import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { HttpError } from "@/lib/server/http-error";
import { livePreviewSeat } from "@/lib/server/preview-live";

// A live preview's story comes in here (docs/PLAN-game-preview.md, "On demand"): on the preview host only (preview.<host>, whose
// cookies are its own), with its preview's signed pass, it's signed in as that preview's viewer and sent to its story (or a screen).
// Never on the app's own host: there it would sign the person's own browser out of their account. Development only.
const SCREEN = /^\/(show|home|start\/preview-story\/live)(\/[\w-]+)*(\?[\w=&%.-]*)?$/;

export const GET = apiRoute(async (req) => {
  const url = new URL(req.url);
  const host = req.headers.get("host") ?? url.host;
  if (!host.startsWith("preview.")) throw new HttpError(404, "Not found");
  const id = url.searchParams.get("p") ?? "";
  const expires = Number(url.searchParams.get("e"));
  const to = url.searchParams.get("to") ?? "";
  if (!SCREEN.test(to)) throw new HttpError(400, "Not a screen");
  const { viewerUser, viewerPass } = livePreviewSeat(id, expires, url.searchParams.get("t") ?? "");
  // The preview's people have a password of their own (live.cjs), kept on the server: signed in as the auth server sees it.
  const app = process.env.BETTER_AUTH_URL || "http://localhost:3014";
  const r = await fetch(`${app}/api/auth/sign-in/username`, { method: "POST", headers: { "content-type": "application/json", origin: app }, body: JSON.stringify({ username: viewerUser, password: viewerPass }) });
  if (!r.ok) throw new HttpError(502, "The preview couldn't sign in");
  const target = new URL(to, `${url.protocol}//${host}`);
  // The story reads its moments with the pass (its page is on this host now, as the preview's viewer).
  if (target.pathname.startsWith("/start/preview-story/live/")) {
    target.searchParams.set("e", String(expires));
    target.searchParams.set("t", url.searchParams.get("t") ?? "");
  }
  const res = NextResponse.redirect(target, 302);
  for (const c of r.headers.getSetCookie()) res.headers.append("Set-Cookie", c);
  // No first-time tour over a preview's screens (the checks' own switch: scripts/dev-test/browser.js).
  res.headers.append("Set-Cookie", "gys_tour=off; Path=/; SameSite=Lax");
  return res;
});
