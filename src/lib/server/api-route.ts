import { NextResponse } from "next/server";
import { HttpError } from "./http-error";

// Wraps a Route Handler body so every route doesn't need its own try/catch: an HttpError thrown
// anywhere inside (by requireAuth/requireLeagueRole/withLeagueLock, or thrown directly) becomes
// a { error: message } JSON response at the right status -- same shape SurvivorDraft's Express
// error middleware produces, which src/lib/api.ts's ApiError already expects. Anything else
// (a genuine bug) logs and becomes a 500, matching that same middleware's `status >= 500` branch.
export function apiRoute<Args extends unknown[]>(
  handler: (req: Request, ...args: Args) => Promise<Response>
): (req: Request, ...args: Args) => Promise<Response> {
  return async (req, ...args) => {
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
