import { Pool } from "pg";

// The one Postgres pool: the app's tables and Better Auth's live in the same database (AUTH_DATABASE_URL), so sign-in (auth.ts)
// and every route (db.ts) share it. Its own module, so auth.ts takes the pool without loading the game engine db.ts brings.
export const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
// An idle connection the database closes (Neon suspends an idle compute and drops its connections) is an "error" on the pool;
// unhandled, it ends the whole process (it ended the catch-up's rehearsal, 2026-11-16, and Better Auth's own pool had no guard
// until BACKLOG 39). The pool replaces the connection on the next query, so this only says so. Never the connection's details:
// the message alone.
pool.on("error", (e) => console.error("[db] an idle connection closed:", e.message));
