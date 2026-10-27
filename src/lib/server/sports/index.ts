import { withCache } from "./cache";
import { espn } from "./espn";
import type { SportsProvider } from "./types";

// Sports data (docs/PLAN-sports-data.md): the providers, in order, behind one interface (types.ts). The first build is ESPN
// alone; a second provider (the league's own free API) goes after it here when a gap shows (docs/BACKLOG.md, "Sports data
// beyond ESPN"), with the chain's tests and a circuit breaker.

export * from "./types";

/**
 * The providers to ask, in order, each through the cache. `base` is a check's stand-in for ESPN (scripts/dev-test/fake-espn.js),
 * whose answers are cached under their own keys ("zt-standin:" unless `prefix` says), never where ESPN's own are.
 */
export function sportsProviders(opts: { base?: string; prefix?: string } = {}): SportsProvider[] {
  return [withCache(espn(opts.base), { prefix: opts.prefix ?? (opts.base ? "zt-standin:" : "") })];
}

/**
 * Where a request's sports data comes from: undefined for ESPN itself. Under `next dev` only, a loopback stand-in named by the
 * request's `x-gys-sports` header (fake-espn.js); and none at all (null) for a request from a check's stand-in world (its
 * `x-gys-listings` or `x-gys-bot` header, with no stand-in ESPN), so a check never reaches the real ESPN. Production never reads
 * the headers.
 */
export function sportsFor(req: Request): string | null | undefined {
  if (process.env.NODE_ENV !== "development") return undefined;
  const asked = req.headers.get("x-gys-sports");
  if (asked) {
    try {
      const u = new URL(asked);
      if (u.protocol === "http:" && (u.hostname === "127.0.0.1" || u.hostname === "localhost")) return u.origin;
    } catch {
      /* not a URL: none */
    }
    return null;
  }
  return req.headers.get("x-gys-listings") || req.headers.get("x-gys-bot") ? null : undefined;
}
