import { apiRoute } from "@/lib/server/api-route";
import { HttpError } from "@/lib/server/http-error";
import { sportsFor } from "@/lib/server/sports";
import { allowed, cacheControl, liveAnswer, type LiveHost } from "@/lib/server/sports/live-proxy";

// A game live, through the app (src/lib/server/sports/live-proxy.ts): the phones' pollers (src/lib/sports/live.ts, live-event.ts)
// ask here instead of ESPN, with ESPN's own path after the host (site, core or web), and everyone watching a game shares one call
// at the edge. Open signed out (the same answer for everyone, so the edge can keep it), and only a live game's addresses pass.
//   GET /api/sports/live/site/apis/site/v2/sports/football/nfl/summary?event=401873053
export const GET = apiRoute(async (req: Request, ctx: { params: Promise<{ host: string; path: string[] }> }) => {
  const { host, path } = await ctx.params;
  if (host !== "site" && host !== "core" && host !== "web") throw new HttpError(404, "Not a live game's address");
  const { url, summary } = allowed(host, "/" + path.map(encodeURIComponent).join("/"), new URL(req.url).searchParams);
  // A check's stand-in ESPN (dev only: the x-gys-sports header, sportsFor), else ESPN.
  const standIn = sportsFor(req);
  if (standIn === null) throw new HttpError(503, "Sports are off for this request");
  const a = await liveAnswer(host as LiveHost, url, summary, standIn ? { base: standIn } : {});
  return new Response(a.body, {
    headers: { "Content-Type": "application/json", "Cache-Control": cacheControl(a), ...(a.stale ? { "X-GYS-Stale": "1" } : {}) },
  });
});
