import type { LeagueState } from "@/lib/game/types";
import { pool } from "./db";

// A league's state is 20-40 KB, and the polls read the same few every few seconds (the league poll, the
// chat checks, the action bar). Neon meters every byte a query sends back, and on the Free plan a month's
// allowance running out suspends the database, so reading those states in full on every poll is what used
// up most of it (2026-10-24). Each server instance keeps the last copy it read along with its hash: a
// read asks the database for the hash only (32 bytes) and fetches the state when the hash has moved. The
// hash is of the stored row itself, so a cached copy is never stale, however the row was written.
//
// Callers get their own copy: several stamp air times or tidy the state they read.
const cache = new Map<string, { hash: string; state: LeagueState }>();
const MAX_CACHED = 200;

function remember(id: string, hash: string, state: LeagueState) {
  cache.delete(id); // re-inserted last, so the oldest entry is the first one out
  cache.set(id, { hash, state });
  if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
}

/** The current state of each league that exists, by id (a missing league is simply absent). */
export async function leagueStates(ids: string[]): Promise<Map<string, LeagueState>> {
  const unique = [...new Set(ids)];
  const out = new Map<string, LeagueState>();
  if (!unique.length) return out;
  const { rows } = await pool.query("SELECT id, md5(state::text) AS hash FROM leagues WHERE id = ANY($1::uuid[])", [unique]);
  const stale = rows.filter((r) => cache.get(r.id)?.hash !== r.hash).map((r) => r.id as string);
  const refreshed = new Set<string>();
  if (stale.length) {
    // The hash comes back with the state it was taken from, so a write landing between the two reads
    // just means the newer state is the one kept. A league deleted in between is forgotten.
    const { rows: fresh } = await pool.query("SELECT id, md5(state::text) AS hash, state FROM leagues WHERE id = ANY($1::uuid[])", [stale]);
    for (const r of fresh) {
      remember(r.id, r.hash, r.state);
      refreshed.add(r.id);
    }
    for (const id of stale) if (!refreshed.has(id)) cache.delete(id);
  }
  for (const r of rows) {
    const hit = cache.get(r.id);
    if (hit && (hit.hash === r.hash || refreshed.has(r.id))) out.set(r.id, structuredClone(hit.state));
  }
  return out;
}

/** One league's current state, or undefined when there's no such league. */
export async function leagueState(id: string): Promise<LeagueState | undefined> {
  return (await leagueStates([id])).get(id);
}
