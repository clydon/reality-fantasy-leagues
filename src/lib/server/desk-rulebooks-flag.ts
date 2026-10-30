import { after } from "next/server";
import { check, flip } from "@db/rulebooks-flag.js";
import { rulebooksOn } from "@db/rulebooks.js";
import { and } from "@/lib/desk-bot-words";
import { tallyOf } from "@/lib/rulebooks-flag-words";
import type { SessionUser } from "./auth-helpers";
import { pool, HttpError } from "./db";
import { logDesk, SEASON_NAME } from "./desk";

// The rulebooks flag on the desk (docs/PLAN-desk-parity.md part 7c; the mock's desk-shows.js svRbSheet): Settings › Games on
// their rulebook › Every season at once. Check every league is a desk job: db/rulebooks-flag.js's check (what
// scripts/rulebooks-flag.js check runs: writes nothing, each league and season in its own rolled-back transaction), run after
// the request answers, its progress and then its tally kept in app_settings 'rulebooks_check' for the sheet to poll. Switch on
// for every season goes only after a check that passed in the last 15 minutes, and runs the backfill first (its refusal said);
// Switch it off leaves a season switched on by itself (show_seasons.rulebook_live) and a couch's own copy on their rulebook.
// Each is a line in Settings history with Undo (the other way; an Undo that turns it on needs a passing check too). One switch
// runs at a time (an advisory lock); a switch on that fails partway puts every league back as the flag off says.
// Deleted leagues aren't in the tally (the switch still walks them, so a restored one plays by what it says).

const JOB = "rulebooks_check";
/** A check this recent lets the switch go on. */
const FRESH_MS = 15 * 60_000;
/** A running check that hasn't moved in this long has stopped (its server went away). */
const STALL_S = 90;
/** The switch's own lock (pg_try_advisory_lock): one switch, on or off, at a time. */
const SWITCH_LOCK = 8145725;

interface Listed {
  id: string;
  name: string;
  line: string;
}

export interface FlagCheck {
  state: "running" | "done" | "failed" | "stopped";
  startedAt: string;
  done: number;
  total: number;
  finishedAt?: string;
  /** Leagues that score exactly the same on their season's rulebook. */
  same?: number;
  /** Leagues that stay on their show's built-in rules, and why. */
  stay?: Listed[];
  /** Leagues that would score differently: the switch waits for them. */
  differ?: Listed[];
  /** Seasons whose rulebook isn't the format their research reads: the switch waits for them too. */
  seasons?: { id: string; name: string }[];
  ok?: boolean;
  error?: string;
  /** Passed, and recent enough to switch on from. */
  fresh?: boolean;
}

/** The latest check, as the sheet shows it (null: none run). */
export async function flagCheck(): Promise<FlagCheck | null> {
  const { rows } = await pool.query(
    `SELECT value, value->>'state' = 'running' AND (value->>'beat')::timestamptz < now() - make_interval(secs => $1) AS stalled,
            value->>'state' = 'done' AND (value->>'ok')::boolean AND (value->>'finishedAt')::timestamptz > now() - make_interval(secs => $2) AS fresh
       FROM app_settings WHERE key = $3`,
    [STALL_S, FRESH_MS / 1000, JOB]
  );
  if (!rows[0]) return null;
  const v = rows[0].value as FlagCheck;
  return { ...v, state: rows[0].stalled ? "stopped" : v.state, fresh: !!rows[0].fresh };
}

/** Each listed league named as a game is (its name · its couch) with its season and why. */
async function listed(items: { id: string; why: string }[]): Promise<Listed[]> {
  if (!items.length) return [];
  const { rows } = await pool.query(
    `SELECT l.id, l.name, c.name AS couch,
            COALESCE(ss.name, s.name || ' ' || (l.state->'settings'->>'wikiSeason'), s.name) AS season
       FROM leagues l
       LEFT JOIN couches c ON c.id = l.couch_id
       LEFT JOIN shows s ON s.slug = l.state->'settings'->>'showId'
       LEFT JOIN show_seasons ss ON ss.show_id = s.id AND ss.season_number::text = l.state->'settings'->>'wikiSeason'
      WHERE l.id = ANY($1::uuid[])`,
    [items.map((i) => i.id)]
  );
  const by = new Map(rows.map((r) => [r.id, r]));
  return items.map((i) => {
    const r = by.get(i.id);
    return { id: i.id, name: r ? `${r.name}${r.couch ? ` · ${r.couch}` : ""}` : "A game", line: r?.season ? `${r.season} · ${i.why}` : i.why };
  });
}

async function runCheck(startedAt: string): Promise<void> {
  // Only this job's row: a newer check started since owns it.
  const write = (patch: Record<string, unknown>) =>
    pool.query(`UPDATE app_settings SET value = value || $1::jsonb || jsonb_build_object('beat', now()), updated_at = now() WHERE key = $2 AND value->>'startedAt' = $3`, [
      JSON.stringify(patch),
      JOB,
      startedAt,
    ]);
  try {
    const out = await check(pool, { log: () => {}, progress: (done, total) => write({ done, total }) });
    const tally = tallyOf(out.leagues);
    const bad = out.seasons.filter((s) => !s.same);
    // The script's ok counts a deleted league; the desk's doesn't (tallyOf leaves them out).
    const ok = !tally.differ.length && !bad.length;
    const { rows: names } = bad.length
      ? await pool.query(`SELECT ss.id, ${SEASON_NAME} AS name FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = ANY($1::uuid[])`, [bad.map((s) => s.id)])
      : { rows: [] };
    await write({
      state: "done",
      finishedAt: new Date().toISOString(),
      same: tally.same,
      stay: await listed(tally.stay),
      differ: await listed(tally.differ),
      seasons: names.map((r) => ({ id: r.id, name: r.name })),
      ok,
    });
  } catch (e) {
    await write({ state: "failed", error: e instanceof Error ? e.message : "The check stopped" }).catch(() => {});
  }
}

/** Check every league: refused while another check is running; the check runs once the request has answered. */
export async function startFlagCheck(user: SessionUser): Promise<FlagCheck | null> {
  const startedAt = new Date().toISOString();
  const { rows } = await pool.query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2::jsonb || jsonb_build_object('beat', now()), now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
      WHERE NOT (app_settings.value->>'state' = 'running' AND (app_settings.value->>'beat')::timestamptz >= now() - make_interval(secs => $3))
     RETURNING key`,
    [JOB, JSON.stringify({ state: "running", by: user.id, startedAt, done: 0, total: 0 }), STALL_S]
  );
  if (!rows.length) throw new HttpError(409, "A check is running already");
  after(() => runCheck(startedAt));
  return flagCheck();
}

/** Leagues playing by their season's rulebook now (not deleted ones). */
async function leaguesOn(): Promise<number> {
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM leagues WHERE deleted_at IS NULL AND state->'settings' ? 'rulebook'");
  return rows[0].n;
}

/** The seasons switched on by themselves, by name. */
async function liveSeasons(): Promise<string[]> {
  const { rows } = await pool.query(`SELECT ${SEASON_NAME} AS name FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.rulebook_live ORDER BY s.name, ss.season_number`);
  return rows.map((r) => r.name);
}

/** Switching on needs a check that passed in the last 15 minutes (Switch on, and an Undo that switches it on). */
async function needFreshCheck(): Promise<FlagCheck> {
  const c = await flagCheck();
  if (!c?.fresh) throw new HttpError(409, c?.state === "done" && !c.ok ? "The check found games that would score differently: it stays off" : "Check every league first: it goes on after a check that passed");
  return c;
}

/**
 * The flag on (the backfill first; a season whose rulebook isn't its format refuses it) or off, every league after it, under
 * the switch's lock. A switch on that fails partway is put back off, so no game is left on its rulebook half-switched.
 */
async function flipFlag(on: boolean): Promise<void> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query("SELECT pg_try_advisory_lock($1) AS got", [SWITCH_LOCK]);
    if (!rows[0].got) throw new HttpError(409, "It's being switched already: try again in a minute");
    try {
      // Read again under the lock: a switch that finished since the caller looked has done it already.
      const already = (await rulebooksOn(pool)) === on;
      if (already) throw Object.assign(new HttpError(409, on ? "Every season is on its rulebook already" : "It's off already"), { already });
      await flip(pool, on, { log: () => {} });
    } catch (e) {
      if ((e as { already?: boolean }).already) throw e;
      const seasons = (e as { seasons?: string[] }).seasons;
      if (seasons) throw new HttpError(409, `Not switched on: ${and(seasons)}'s rulebook isn't the one its research reads`);
      if (on) {
        await flip(pool, false, { log: () => {} }).catch(() => {});
        throw new HttpError(500, `It couldn't switch every game, so it's off again: ${e instanceof Error ? e.message : "it stopped"}`);
      }
      throw e;
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [SWITCH_LOCK]);
    }
  } finally {
    client.release();
  }
}

/** Switch on for every season (after a check that passed) or Switch it off: a line in Settings history with Undo. */
export async function switchFlag(user: SessionUser, on: unknown): Promise<{ changeId: string; leagues: number }> {
  if (typeof on !== "boolean") throw new HttpError(400, "on is true or false");
  if ((await rulebooksOn(pool)) === on) throw new HttpError(409, on ? "Every season is on its rulebook already" : "It's off already");
  if (on) {
    const c = await needFreshCheck();
    await flipFlag(true);
    const leagues = await leaguesOn();
    const stayed = c.stay?.length ?? 0;
    const changeId = await logDesk(pool, {
      entity: "settings",
      entityId: "rulebooks",
      action: "set",
      text: `Rulebooks for every season: on (${leagues} ${leagues === 1 ? "league" : "leagues"}${stayed ? `; ${stayed} stayed on built-in rules` : ""})`,
      before: false,
      after: true,
      undo: { type: "setting", key: "rulebooks", value: false },
      userId: user.id,
    });
    return { changeId, leagues };
  }
  await flipFlag(false);
  const live = await liveSeasons();
  const changeId = await logDesk(pool, {
    entity: "settings",
    entityId: "rulebooks",
    action: "set",
    text: `Rulebooks for every season: off${live.length ? ` (${and(live)}, on by ${live.length > 1 ? "themselves" : "itself"}, stayed on)` : ""}`,
    before: true,
    after: false,
    undo: { type: "setting", key: "rulebooks", value: true },
    userId: user.id,
  });
  return { changeId, leagues: await leaguesOn() };
}

/** History's Undo: the flag back the other way, refused once it's moved on since. */
export async function restoreFlag(on: boolean): Promise<void> {
  if ((await rulebooksOn(pool)) === on) throw new HttpError(409, on ? "Every season is on its rulebook already" : "It's off already");
  if (on) await needFreshCheck();
  await flipFlag(on);
}
