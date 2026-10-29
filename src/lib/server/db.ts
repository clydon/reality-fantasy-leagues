import StateLogic from "@/lib/game/state-logic.js";
import { Pool, type PoolClient } from "pg";
import type { LeagueState } from "@/lib/game/types";
import { HttpError } from "./http-error";
import { stampAirTimes } from "./air-times";
import { runBots } from "./bots";
import { syncWaivers } from "./waivers";
import { justProcessed, sendProcessed, snapshot as waiverSnapshot } from "./waiver-pushes";
import { recordChange, type ChangeOf } from "./change-log";
import { after } from "next/server";

// Re-exported so route handlers can import { pool, withLeagueLock, HttpError } from one place,
// matching how SurvivorDraft's server/db.js bundles the same three together.
export { HttpError };

// This repo's own app-data database -- the same Postgres database Better Auth already uses
// (AUTH_DATABASE_URL), just a different set of tables (leagues/league_memberships/chat_*/
// issue_reports -- see db/migrations/0001_app_schema.sql). One pool, reused by every route.
export const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });

/** One transaction on a client of its own: `fn`, then COMMIT, or ROLLBACK when it throws (the desk's writes). */
export async function tx<T>(fn: (db: PoolClient) => Promise<T>): Promise<T> {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const out = await fn(db);
    await db.query("COMMIT");
    return out;
  } catch (e) {
    await db.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    db.release();
  }
}

/** `%term%` for ILIKE, its wildcards taken literally. */
export const likeOf = (term: string) => `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;

// Loads a league's state row FOR UPDATE inside a transaction, runs mutatorFn(state) against the
// in-memory object, writes the result back, and returns the updated state. Direct port of
// SurvivorDraft's server/db.js withLeagueLock -- a real row lock means two near-simultaneous
// writes (e.g. two clicks from the same commissioner screen) can't silently clobber each other.
//
// The mutator also gets the transaction's own `client`, for the one case that needs to read or
// write a table alongside `state` atomically: blind draft's lock/reveal (see
// src/lib/server/blind-draft.ts), where "is everyone locked in now?" is read from
// blind_draft_picks and the resulting reveal is written into `state` -- both under the same row
// lock, so two players locking at the same moment can't both observe "not everyone yet" or both
// trigger the reveal. Every other caller ignores the second argument and is unaffected.
//
// `change` (docs/PLAN-new-design.md step 5): a write someone makes for others (results, settings, the cast) appends its
// line to Recent changes in this same transaction (change-log.ts), worked out from the league before and after the
// mutation alone (not the bots' moves or the waiver clock around it). Results changes carry their exact undo.
export async function withLeagueLock(
  leagueId: string,
  mutatorFn: (state: LeagueState, client: PoolClient) => void | Promise<void>,
  change?: ChangeOf
): Promise<LeagueState> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT state FROM leagues WHERE id=$1 FOR UPDATE", [leagueId]);
    if (!rows.length) throw new HttpError(404, "League not found");
    const state: LeagueState = rows[0].state;
    // Air times first: whether a lineup or pick is still open depends on them (air-times.ts).
    await stampAirTimes(client, state);
    const waiversBefore = waiverSnapshot(state);
    // Then the waiver clock, so the mutation sees the week as it stands now: a claim saved after its
    // week processed is refused rather than slipped in (waivers.js).
    await syncWaivers(client, leagueId, state);
    const before = change ? structuredClone(state) : null;
    await mutatorFn(state, client);
    const spec = change && before ? (typeof change === "function" ? change(before, state) : change) : null;
    // Every write leaves the league with an episode to play next (bets and picks always have
    // somewhere to go; nobody creates episodes by hand). See EpisodeLogic.ensureNextEpisode.
    StateLogic.ensureNextEpisode(state);
    // And again after: results the mutation just applied open (or close) a waiver week.
    await syncWaivers(client, leagueId, state);
    // Then any computer player's move this opened up (a turn, a new episode's lineup). See bots.ts.
    await runBots(client, leagueId, state);
    await client.query("UPDATE leagues SET state=$1, updated_at=now() WHERE id=$2", [JSON.stringify(state), leagueId]);
    if (spec) {
      // The next episode may be new since the mutation (ensureNextEpisode): stamped, so Undo stays open until it airs.
      await stampAirTimes(client, state);
      await recordChange(client, leagueId, state, spec);
    }
    await client.query("COMMIT");
    // A waiver week that processed here -- its time came (lazily, on this write or a load), or the
    // commissioner's Process now -- is announced once it's committed (waiver-pushes.js). The hourly job
    // announces the ones it processes itself, so each week is announced by whoever processed it.
    const processed = justProcessed(waiversBefore, state);
    if (processed) {
      const send = () => sendProcessed(pool, leagueId, state, processed);
      try {
        after(send);
      } catch {
        void send(); // outside a request (never expected): send anyway, it never throws
      }
    }
    return state;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// A subtle, non-editable feed entry (episode eliminations, resolved bets) attributed to no user.
