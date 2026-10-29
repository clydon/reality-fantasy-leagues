import crypto from "crypto";
import type { PoolClient } from "pg";
import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import { isSuperAdminUser, isUuid, type SessionUser } from "./auth-helpers";
import type { BackstageScope } from "./backstage";
import { recordChange, settingsSetChange, type GameUndo } from "./change-log";
import { pool, withLeagueLock, HttpError } from "./db";
import { LEAGUE_SEASON_JOIN } from "./league-season";
import { leagueStates } from "./league-states";
import { syncLeagueDecisions } from "./season-decisions";
import { games, type Game } from "./show-space";

// Archive or delete a game (docs/PLAN-new-design.md step 10 part 2b; the mock's settings.js "Archive or delete a game" and
// guards.js' tiers), from Backstage › Game settings, for its Commissioner.
//
//   Archive  tier 1: the game stays on the couch and the trophy shelf with its table as it stood, and nothing scores it
//            any more (settings.archivedAt: the season sync, moves due, waivers and reminders leave it be). Undo on the
//            toast and in Recent changes until the next episode airs, or Bring it back any time: what came in meanwhile
//            reaches it then.
//   Delete   tier 3, after a hold: out of the couch's games for everyone (leagues.deleted_at, 0123), its people out of it
//            (their seats kept in the line's undo), off its linked group; the chat it held moves to the couch's next game
//            here, or to the couch's own conversation, so nobody loses what was said. Restorable from Recent changes for 30
//            days by whoever ran it; then it's removed for good, the next time anyone deletes a game (purgeDeleted: nothing
//            runs on a schedule).

const RESTORE_DAYS = 30;

export interface EndGame {
  leagueId: string;
  name: string;
  gameName: string;
  archived: boolean;
  /** You're its Commissioner (or a site admin): archive, bring back, delete. */
  yours: boolean;
}

/** The games here a Commissioner could archive or delete (Game settings' last section), archived ones too. */
export function endGamesOf(scope: BackstageScope): EndGame[] {
  return scope.games.map((g) => ({
    leagueId: g.leagueId,
    name: g.name,
    gameName: g.gameName,
    archived: g.archived,
    yours: g.yourRole === "commissioner" || isSuperAdminUser(scope.user),
  }));
}

function gameIn(scope: BackstageScope, leagueId: unknown): Game {
  const g = typeof leagueId === "string" && isUuid(leagueId) ? scope.games.find((x) => x.leagueId === leagueId) : undefined;
  if (!g) throw new HttpError(404, "That game isn't one you run here");
  if (g.yourRole !== "commissioner" && !isSuperAdminUser(scope.user)) throw new HttpError(403, "Only a Commissioner archives or deletes a game");
  return g;
}

const nameOf = (user: SessionUser) => (user as { username?: string | null }).username || user.name;

/** Archive a game (tier 1): its table stands as it is and nothing scores it. -> the batch, for Undo. */
export async function archiveGame(scope: BackstageScope, leagueId: unknown): Promise<{ batch: string }> {
  const g = gameIn(scope, leagueId);
  if (g.archived) throw new HttpError(409, `${g.gameName} is archived already`);
  const batch = crypto.randomUUID();
  await withLeagueLock(
    g.leagueId,
    (s) => {
      s.settings.archivedAt = new Date().toISOString();
      s.settings.archivedBy = scope.user.id;
    },
    settingsSetChange(scope.user.id, `Archived ${g.gameName}: it stays on the trophy shelf and stops scoring`, { kind: "game.archive", batch })
  );
  return { batch };
}

/** Bring an archived game back: it scores again, and whatever came in meanwhile reaches it. -> the batch, for Undo. */
export async function unarchiveGame(scope: BackstageScope, leagueId: unknown): Promise<{ batch: string }> {
  const g = gameIn(scope, leagueId);
  if (!g.archived) throw new HttpError(409, `${g.gameName} isn't archived`);
  const batch = crypto.randomUUID();
  await withLeagueLock(
    g.leagueId,
    async (s, client) => {
      delete s.settings.archivedAt;
      delete s.settings.archivedBy;
      await syncLeagueDecisions(client, g.leagueId, s);
    },
    settingsSetChange(scope.user.id, `Brought ${g.gameName} back: it scores again`, { kind: "game.archive", batch })
  );
  return { batch };
}

export interface DeletePreview {
  leagueId: string;
  gameName: string;
  /** The consequence sentence the hold sheet reads out. */
  consequence: string;
  players: number;
}

/** What deleting a game would do (the hold sheet's sentence). */
export async function deletePreview(scope: BackstageScope, leagueId: unknown): Promise<DeletePreview> {
  const g = gameIn(scope, leagueId);
  const state = (await leagueStates([g.leagueId])).get(g.leagueId);
  const players = state ? state.players.filter((p) => !p.disabled && !p.automated).length : 0;
  const what = g.gameType === "pickem" ? "streaks and picks" : g.gameType === "active-roster" ? "teams, lineups and points" : "teams and places";
  // The couch's other games here, whoever runs them.
  const others = (await games(scope.user.id, { couchIds: [scope.couchId], seasonId: scope.seasonId })).filter((x) => x.leagueId !== g.leagueId && !x.archived).length;
  const rest = others === 0 ? "" : others === 1 ? " The other game is untouched." : ` The other ${others} games are untouched.`;
  return {
    leagueId: g.leagueId,
    gameName: g.gameName,
    players,
    consequence: `${players > 1 ? "Everyone" : "You"} ${players > 1 ? "loses their" : "lose your"} ${what} in ${g.gameName} for this season.${rest}`,
  };
}

/** Delete a game (tier 3): out of the couch's games for everyone, restorable for 30 days. -> the batch. */
export async function deleteGame(scope: BackstageScope, leagueId: unknown): Promise<{ batch: string }> {
  const g = gameIn(scope, leagueId);
  await purgeDeleted();
  const batch = crypto.randomUUID();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: lr } = await client.query("SELECT id, couch_id, group_id, group_position, state FROM leagues WHERE id = $1 AND deleted_at IS NULL FOR UPDATE", [g.leagueId]);
    if (!lr.length) throw new HttpError(404, "That game's gone already");
    const league = lr[0];
    const { rows: seats } = await client.query("SELECT row_to_json(m) AS row, m.user_id, m.role FROM league_memberships m WHERE m.league_id = $1", [g.leagueId]);
    // Whoever's on the couch only for this game stays on it (as the new design keeps anyone a game loses: couches.ts).
    await client.query(
      `UPDATE couch_members cm SET via = 'couch' WHERE cm.couch_id = $1 AND cm.via = 'game'
          AND cm.user_id IN (SELECT user_id FROM league_memberships WHERE league_id = $2)
          AND NOT EXISTS (SELECT 1 FROM league_memberships m JOIN leagues o ON o.id = m.league_id
                           WHERE o.couch_id = $1 AND o.id <> $2 AND o.deleted_at IS NULL AND m.user_id = cm.user_id)`,
      [league.couch_id, g.leagueId]
    );
    // The conversation it held moves to the couch's next game here, or to the couch's own (step 4's watch-only chat).
    const next = (await games(scope.user.id, { couchIds: [scope.couchId], seasonId: scope.seasonId })).find((x) => x.leagueId !== g.leagueId);
    if (next) await client.query("UPDATE chat_messages SET league_id = $1 WHERE league_id = $2", [next.leagueId, g.leagueId]);
    else if (league.couch_id) await client.query("UPDATE chat_messages SET league_id = NULL, couch_id = $1, season_id = $2 WHERE league_id = $3", [league.couch_id, scope.seasonId, g.leagueId]);
    await client.query("DELETE FROM league_memberships WHERE league_id = $1", [g.leagueId]);
    await client.query("UPDATE leagues SET deleted_at = now(), deleted_by = $2, group_id = NULL, group_position = NULL, updated_at = now() WHERE id = $1", [g.leagueId, scope.user.id]);
    const undo: GameUndo = {
      type: "game",
      memberships: seats.map((s) => s.row),
      groupId: league.group_id,
      groupPosition: league.group_position,
      commissioners: seats.filter((s) => s.role === "commissioner").map((s) => s.user_id as string),
    };
    await recordChange(client, g.leagueId, league.state as LeagueState, {
      userId: scope.user.id,
      kind: "game.delete",
      tier: 3,
      text: `${nameOf(scope.user)} deleted ${g.gameName} (restorable for ${RESTORE_DAYS} days)`,
      undo,
      batch,
      undoUntil: new Date(Date.now() + RESTORE_DAYS * 24 * 3600 * 1000),
    });
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  return { batch };
}

/** Brings a deleted game back (Recent changes' Undo): its people, its group, on the couch again. Inside the undo's transaction. */
export async function restoreGame(client: PoolClient, leagueId: string, undo: GameUndo): Promise<void> {
  const { rows } = await client.query("SELECT deleted_at FROM leagues WHERE id = $1 FOR UPDATE", [leagueId]);
  if (!rows.length) throw new HttpError(404, "That game is gone for good");
  if (!rows[0].deleted_at) throw new HttpError(409, "It's back already");
  // Someone whose account was deleted meanwhile (the desk's Delete) doesn't come back: their seat waits for an account.
  for (const m of undo.memberships) {
    await client.query(
      `INSERT INTO league_memberships SELECT r.* FROM json_populate_record(NULL::league_memberships, $1::json) r
        WHERE EXISTS (SELECT 1 FROM "user" u WHERE u.id = r.user_id) ON CONFLICT DO NOTHING`,
      [JSON.stringify(m)]
    );
  }
  const { rows: group } = undo.groupId ? await client.query("SELECT 1 FROM league_groups WHERE id = $1", [undo.groupId]) : { rows: [] };
  await client.query("UPDATE leagues SET deleted_at = NULL, deleted_by = NULL, group_id = $2, group_position = $3, updated_at = now() WHERE id = $1", [
    leagueId,
    group.length ? undo.groupId : null,
    group.length ? undo.groupPosition : null,
  ]);
  // What scored while it was gone reaches it now.
  const { rows: st } = await client.query("SELECT state FROM leagues WHERE id = $1", [leagueId]);
  const state = st[0].state as LeagueState;
  await syncLeagueDecisions(client, leagueId, state);
  StateLogic.ensureNextEpisode(state);
  await client.query("UPDATE leagues SET state = $1 WHERE id = $2", [JSON.stringify(state), leagueId]);
}

/** The couch's deleted games on a season that can still come back (Recent changes lists their lines). */
export async function deletedHere(couchId: string, seasonId: string): Promise<{ leagueId: string; name: string }[]> {
  const { rows } = await pool.query(
    `SELECT l.id, l.name FROM leagues l ${LEAGUE_SEASON_JOIN}
      WHERE l.couch_id = $1 AND ss.id = $2 AND l.deleted_at > now() - make_interval(days => $3)`,
    [couchId, seasonId, RESTORE_DAYS]
  );
  return rows.map((r) => ({ leagueId: r.id as string, name: r.name as string }));
}

/** Deleted games past their 30 days go for good (with everything that hangs off them). */
export async function purgeDeleted(): Promise<number> {
  const { rowCount } = await pool.query("DELETE FROM leagues WHERE deleted_at < now() - make_interval(days => $1)", [RESTORE_DAYS]);
  return rowCount ?? 0;
}
