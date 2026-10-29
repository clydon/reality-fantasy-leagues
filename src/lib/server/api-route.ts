import { NextResponse } from "next/server";
import { HttpError } from "./http-error";
import { READ_ONLY_HEADER, READ_ONLY_SAYS, writableWhileReadOnly } from "@/lib/read-only";

const READS = new Set(["GET", "HEAD", "OPTIONS"]);

// Wraps a Route Handler body so every route doesn't need its own try/catch: an HttpError thrown
// anywhere inside (by requireAuth/requireLeagueRole/withLeagueLock, or thrown directly) becomes
// a { error: message } JSON response at the right status -- same shape SurvivorDraft's Express
// error middleware produces, which src/lib/api.ts's ApiError already expects. Anything else
// (a genuine bug) logs and becomes a 500, matching that same middleware's `status >= 500` branch.
export function apiRoute<Args extends unknown[]>(
  handler: (req: Request, ...args: Args) => Promise<Response>
): (req: Request, ...args: Args) => Promise<Response> {
  return async (req, ...args) => {
    // A tab with a game open read-only (src/lib/read-only.ts) changes nothing: its writes are refused here, before any
    // route's own checks (a site admin passes most of those).
    if (!READS.has(req.method) && req.headers.has(READ_ONLY_HEADER) && !writableWhileReadOnly(new URL(req.url).pathname)) {
      return NextResponse.json({ error: READ_ONLY_SAYS }, { status: 403 });
    }
    try {
      return await handler(req, ...args);
    } catch (e) {
      if (e instanceof HttpError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      console.error(e);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}

/**
 * A league write's answer: the league's whole state, which the classic app adopts; or `{ ok: true }` when the caller
 * asks with `?quiet`. The new design reads its own spoiler-guarded view after a save (guard.ts), so the full state,
 * results it hasn't revealed and all, never reaches it.
 */
export function stateResponse(req: Request, state: unknown): Response {
  return new URL(req.url).searchParams.has("quiet") ? NextResponse.json({ ok: true }) : NextResponse.json(state);
}
