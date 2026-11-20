import { AsyncLocalStorage } from "node:async_hooks";

// Where a request's sports data comes from, for code that runs under it without the request in hand (live-lines.ts, a league read's
// live points): set by apiRoute under `next dev` only, from the request's stand-in headers (sportsFor: a check's stand-in ESPN's
// origin, or null for a check's stand-in world, which asks nobody). Undefined outside such a request: ESPN itself. Production
// never sets it.
export const requestSports = new AsyncLocalStorage<string | null>();
