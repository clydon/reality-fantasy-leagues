import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiRoute } from "@/lib/server/api-route";
import { HttpError } from "@/lib/server/http-error";
import { enterLivePreview } from "@/lib/server/preview-live";

// A live preview's story comes in here (docs/PLAN-preview-release.md, step 4): on the preview host only (preview.<host>, whose
// cookies are its own), with a way in used once (`w`), it's signed in as that preview's made-up viewer, by a session the server
// mints (src/lib/preview-session.ts, no password), and sent to its story or one of its screens. Never on the app's own host: there it
// would sign the person's own browser out of their account.
const SCREEN = /^\/(show|home|start\/preview-story\/live)(\/[\w-]+)*(\?[\w=&%.-]*)?$/;
type Minter = { previewSession: (o: { body: { userId: string }; returnHeaders: true }) => Promise<{ headers: Headers }> };

export const GET = apiRoute(async (req) => {
  const url = new URL(req.url);
  const host = req.headers.get("host") ?? url.host;
  if (!host.startsWith("preview.")) throw new HttpError(404, "Not found");
  // Where it sends you: the service's own address when it's deployed (step 13's review: never built from a request's Host), else
  // this host (development's preview.localhost).
  const base = process.env.PREVIEW_SERVICE === "1" && process.env.BETTER_AUTH_URL ? new URL(process.env.BETTER_AUTH_URL).origin : `${url.protocol}//${host}`;
  const to = url.searchParams.get("to") ?? "";
  if (!SCREEN.test(to)) throw new HttpError(400, "Not a screen");
  // A way in it won't spend (used, ended, never one): one page for every reason, so a link can't be probed (the flow spec's §5).
  const gone = () => NextResponse.redirect(new URL("/start/preview-story/live/gone", base), 302);
  let entry: { id: string; viewerUserId: string };
  try {
    entry = await enterLivePreview(url.searchParams.get("w") ?? "");
  } catch (e) {
    if (e instanceof HttpError && e.status === 403) return gone();
    throw e;
  }
  const { id, viewerUserId } = entry;
  // The story's own address names its preview: never another's.
  if (to.startsWith("/start/preview-story/live/") && !to.startsWith(`/start/preview-story/live/${id}`)) throw new HttpError(400, "Not this preview's story");
  const { headers } = await (auth.api as unknown as Minter).previewSession({ body: { userId: viewerUserId }, returnHeaders: true });
  const res = NextResponse.redirect(new URL(to, base), 302);
  for (const c of headers.getSetCookie()) res.headers.append("Set-Cookie", c);
  // No first-time tour over a preview's screens (the checks' own switch: scripts/dev-test/browser.js).
  res.headers.append("Set-Cookie", `gys_tour=off; Path=/; SameSite=Lax${base.startsWith("https:") ? "; Secure" : ""}`);
  return res;
});
