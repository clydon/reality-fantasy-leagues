import type { PoolClient } from "pg";
import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState, Player } from "@/lib/game/types";

// A game in stages on the server (docs/PLAN-start-a-game-gpt.md step A12 part 1; the engine's side is state-logic.js StageLogic):
// each stage is a league of its own, an ordinary game the engine plays exactly as it would alone, tied to the game in stages by
// leagues.stage_of and stage_key (migration 0203), on the same couch and season. The game holds the seats: each stage mirrors them
// (seatStage) under the same player ids, and the memberships on them, so one account's seat is the same in every stage; db.ts
// syncStages runs it through each stage's own write after any write to the game commits (withLeagueLock, join-league.ts), so the
// stage's bots, settles and draft share run as on any write. Its table is the overall, from its stages' tables as they stand
// (answer-points.ts stageWalk, on every read of it). Made by the engine lab (engine-lab.ts makeStages); deleted and restored with
// the game (end-game.ts). A stage's draft that opens at its start counts its exclusive draft then (settleStageDraft: the 9:10 PM
// decision's fallback).
//
// Nothing here imports db.ts (db.ts imports this): every function takes the client or pool it runs on.

type Queryable = Pick<PoolClient, "query">;

/** A game in stages' stage leagues still live, as made: { id, key, state }, by id. */
export async function stagesOf(db: Queryable, parentId: string): Promise<{ id: string; key: string; state: LeagueState }[]> {
  const { rows } = await db.query("SELECT id, stage_key, state FROM leagues WHERE stage_of = $1 AND deleted_at IS NULL ORDER BY id", [parentId]);
  return rows.map((r) => ({ id: r.id as string, key: r.stage_key as string, state: r.state as LeagueState }));
}

type StageRow = { id: string; key: string; state: LeagueState };
/** Step A12 part 4c: a game in stages' stage leagues in its spec's order (the game's own stages, then those beside them; a stage's copies
 *  in the order they start). */
export function inSpecOrder(parent: LeagueState, stages: StageRow[]): StageRow[] {
  const ids = StateLogic.StageLogic.stages(parent).map((st) => st.id);
  const at = (key: string) => {
    const i = ids.indexOf(StateLogic.StageLogic.copyOf(key) ?? key);
    return i < 0 ? ids.length : i;
  };
  const from = (s: StageRow) => StateLogic.startEpisode(s.state) ?? Number.POSITIVE_INFINITY;
  return [...stages].sort((a, b) => at(a.key) - at(b.key) || from(a) - from(b));
}
/**
 * Step A12 part 4c: the stages someone joining a game in stages once it has started joins as each one's late joiner (underway and
 * taking them: StateLogic.StageLogic.joinsOf 'late'), in the spec's order, and the one whose team they pick as they join: the first
 * with a team to pick that isn't dealt from a hat (DrawLogic.dealsLate). Read from the stages as stored: whether one keeps a newcomer
 * waiting is the walk's (the game's join rule, StageLogic.closed), already read by the caller.
 */
export async function lateStages(db: Queryable, parentId: string, parent: LeagueState): Promise<{ late: StageRow[]; picks: StageRow | null }> {
  const late = inSpecOrder(parent, await stagesOf(db, parentId)).filter((s) => StateLogic.StageLogic.joinsOf(s.state) === "late");
  const picks = late.find((s) => StateLogic.GhostLogic.teamSize(s.state) > 0 && !StateLogic.DrawLogic.dealsLate(s.state)) ?? null;
  return { late, picks };
}

/** The fields of a seat that are the seat's, not the game's: what a stage's copy of it mirrors. */
const SEAT_FIELDS = ["name", "disabled", "formerName", "disabledFromUserId", "automated"] as const;
type Fields = Record<string, unknown>;

/** The game's seats a stage seats: everyone on it but a late joiner's private season or a seat waiting to be brought in (one that
 *  joined once the game had started and its stages took nobody new: StateLogic.addPlayer). Someone who left is mirrored as left. */
export const seatsToMirror = (parent: LeagueState) => parent.players.filter((p) => !p.ghost && !(p.active === false && !p.disabled));

/**
 * One of the game's seats added to a stage (StateLogic.addPlayer, so the stage's own rule for someone joining holds: in its draft
 * before it, waiting once it's done) under the same id and colour. The seat.
 */
export function seatIn(stage: LeagueState, p: Player): Player {
  const made = StateLogic.addPlayer(stage, p.name, p.automated ? { automated: true } : undefined) as Player;
  const was = made.id;
  made.id = p.id;
  made.color = p.color;
  stage.draftOrder = (stage.draftOrder || []).map((x: string) => (x === was ? p.id : x));
  return made;
}

/** Whether a stage has begun: a draft pick (or a draw, a reveal, an auction), or an episode of its own with results. */
function begunIn(stage: LeagueState): boolean {
  const first = StateLogic.startEpisode(stage);
  return StateLogic.DraftLogic.begun(stage) || (first !== null && StateLogic.SpoilerLogic.latestWithResults(stage) >= first);
}
/** Step A12 part 4c: whether any of a game in stages' stages has begun, so a seat leaving the game is kept there, disabled, rather than
 *  removed (backstage-members.ts freeSeat: the game has no draft of its own to go by), and its account gets it back on its return. */
export async function stagesBegun(db: Queryable, parentId: string): Promise<boolean> {
  return (await stagesOf(db, parentId)).some((s) => begunIn(s.state));
}
/** Step A12 part 4c: a stage that's over seats nobody new (it counts nothing for them: StateLogic.StageLogic.joinsOf). */
const seatsNobody = (stage: LeagueState) => StateLogic.StageLogic.joinsOf(stage) === "over";

/**
 * A stage's seats as the game's (inside the stage's own write): a seat the game has and the stage doesn't is added (seatIn), by the
 * stage's own rule for someone joining (step A12 part 4c: into its draft before it's underway, as its late joiner once it is, waiting
 * where it takes nobody new; never in a stage that's over); a seat gone from the game, or one that left it (disabled there), is taken
 * out where the stage hasn't begun, else left (disabled) with its team and points, as leaving a game does, and comes back under the
 * same id; a seat's name, leaving and coming back, and a computer player's switch are mirrored. Then the memberships
 * (mirrorMemberships). Whether the stage's seats changed.
 */
export async function seatStage(client: Queryable, parentId: string, parent: LeagueState, stageId: string, stage: LeagueState): Promise<boolean> {
  let changed = false;
  const all = new Set(parent.players.map((p) => p.id));
  const begun = begunIn(stage);
  const shut = seatsNobody(stage);
  for (const q of [...stage.players]) {
    if (all.has(q.id)) continue;
    if (begun) {
      if (q.disabled) continue;
      StateLogic.disablePlayer(stage, q.id);
    } else StateLogic.removePlayer(stage, q.id);
    changed = true;
  }
  for (const p of seatsToMirror(parent)) {
    let q = stage.players.find((x) => x.id === p.id) as Player | undefined;
    if (!q) {
      if (p.disabled || shut) continue;
      q = seatIn(stage, p);
      changed = true;
    } else if (p.disabled && !begun) {
      // Step A12 part 4c: left the game (kept there, disabled, once any stage has begun): gone from a stage that hasn't, as leaving
      // before a draft is; back, it's seated again under the same id.
      StateLogic.removePlayer(stage, q.id);
      changed = true;
      continue;
    }
    for (const f of SEAT_FIELDS) {
      const a = (p as unknown as Fields)[f];
      if (a === (q as unknown as Fields)[f]) continue;
      if (a === undefined) delete (q as unknown as Fields)[f];
      else (q as unknown as Fields)[f] = a;
      changed = true;
    }
  }
  await mirrorMemberships(client, parentId, stageId, seatedIds(parent, stage));
  return changed;
}
/** The seats a stage holds that are the game's too (memberships go only on those). */
const seatedIds = (parent: LeagueState, stage: LeagueState) => {
  const all = new Set(seatsToMirror(parent).map((p) => p.id));
  return stage.players.filter((q) => all.has(q.id)).map((q) => q.id);
};

/**
 * A stage's memberships as the game's, for the seats it holds of the game's (`seated`): one the game no longer has (someone who
 * left, a seat handed over, a seat the stage doesn't hold) goes; a role or a shared seat's slot changed on the game changes here; one
 * the game has and the stage doesn't is copied, spoiler mark and all (step A12 part 4b: a late joiner's own mark is an episode of the
 * game's own season, so a stage on another season starts without one).
 */
export async function mirrorMemberships(client: Queryable, parentId: string, stageId: string, seated: string[]): Promise<void> {
  await client.query(
    `DELETE FROM league_memberships m WHERE m.league_id = $1 AND NOT EXISTS (
       SELECT 1 FROM league_memberships p WHERE p.league_id = $2 AND p.user_id = m.user_id AND p.player_id = m.player_id AND p.player_id = ANY($3::text[]))`,
    [stageId, parentId, seated]
  );
  await client.query(
    `UPDATE league_memberships m SET role = p.role, seat_slot = p.seat_slot FROM league_memberships p
      WHERE m.league_id = $1 AND p.league_id = $2 AND p.user_id = m.user_id AND p.player_id = m.player_id AND (m.role <> p.role OR m.seat_slot <> p.seat_slot)`,
    [stageId, parentId]
  );
  await client.query(
    `INSERT INTO league_memberships (league_id, user_id, player_id, role, seat_slot, results_seen_through, explainer_seen_at)
     SELECT $1, p.user_id, p.player_id, p.role, p.seat_slot,
            CASE WHEN (SELECT (a.state->'settings'->>'showId', a.state->'settings'->>'wikiSeason') IS NOT DISTINCT FROM (b.state->'settings'->>'showId', b.state->'settings'->>'wikiSeason')
                         FROM leagues a, leagues b WHERE a.id = $1 AND b.id = $2) THEN p.results_seen_through END,
            p.explainer_seen_at FROM league_memberships p
      WHERE p.league_id = $2 AND p.player_id = ANY($3::text[]) ON CONFLICT DO NOTHING`,
    [stageId, parentId, seated]
  );
}

/**
 * The stages of a game in stages whose seats or memberships differ from the game's, so syncStages writes only those: a seat to add,
 * take out or mirror, or a membership that isn't the game's. Two queries.
 */
export async function stagesToSeat(db: Queryable, parentId: string, parent: LeagueState): Promise<string[]> {
  const stages = await stagesOf(db, parentId);
  if (!stages.length) return [];
  const { rows } = await db.query("SELECT league_id, user_id, player_id, role, seat_slot FROM league_memberships WHERE league_id = ANY($1::uuid[])", [[parentId, ...stages.map((s) => s.id)]]);
  const key = (r: { user_id: string; player_id: string; role: string; seat_slot: number }) => `${r.user_id}|${r.player_id}|${r.role}|${r.seat_slot}`;
  const mirror = seatsToMirror(parent);
  const all = new Set(parent.players.map((p) => p.id));
  return stages
    .filter(({ id, state }) => {
      if (state.players.some((q) => !all.has(q.id) && !q.disabled)) return true;
      // Step A12 part 4c: as seatStage reads them (a stage that's over seats nobody new; a seat that left goes from one not begun).
      const shut = seatsNobody(state);
      const begun = begunIn(state);
      for (const p of mirror) {
        const q = state.players.find((x) => x.id === p.id);
        if (!q) {
          if (!p.disabled && !shut) return true;
          continue;
        }
        if (p.disabled && !begun) return true;
        if (SEAT_FIELDS.some((f) => (p as unknown as Fields)[f] !== (q as unknown as Fields)[f])) return true;
      }
      const seated = new Set(seatedIds(parent, state));
      const want = new Set(rows.filter((r) => r.league_id === parentId && seated.has(r.player_id)).map(key));
      const have = new Set(rows.filter((r) => r.league_id === id).map(key));
      return want.size !== have.size || [...want].some((x) => !have.has(x));
    })
    .map((s) => s.id);
}

/**
 * A game in stages deleted (end-game.ts deleteLeagueIn, inside its transaction): its stages go with it, their memberships too (a
 * restore mirrors them back from the game's: restoreStages).
 */
export async function deleteStages(client: Queryable, parentId: string, userId: string): Promise<void> {
  await client.query("DELETE FROM league_memberships WHERE league_id IN (SELECT id FROM leagues WHERE stage_of = $1)", [parentId]);
  await client.query("UPDATE leagues SET deleted_at = now(), deleted_by = $2, updated_at = now() WHERE stage_of = $1 AND deleted_at IS NULL", [parentId, userId]);
}
/** A12 part 2: one stage taken away (a copy a format change started whose change the data no longer says, or the maker called off:
 *  change-stages.ts), inside the caller's transaction: its memberships go and it's soft-deleted, as deleteStages does a game's. */
export async function takeStageAway(client: Queryable, stageId: string): Promise<void> {
  await client.query("DELETE FROM league_memberships WHERE league_id = $1", [stageId]);
  await client.query("UPDATE leagues SET deleted_at = now(), deleted_by = NULL, updated_at = now() WHERE id = $1 AND deleted_at IS NULL", [stageId]);
}
/** A game in stages restored (end-game.ts restoreGame, inside its transaction, once its own memberships are back): its stages too,
 *  their memberships mirrored from the game's. */
export async function restoreStages(client: Queryable, parentId: string, parent: LeagueState): Promise<void> {
  // A12 part 2: a copy a format change started and the data later took away (change-stages.ts) stays away.
  const undone = StateLogic.StageLogic.changeRecord(parent).undone;
  await client.query("UPDATE leagues SET deleted_at = NULL, deleted_by = NULL, updated_at = now() WHERE stage_of = $1 AND NOT (stage_key = ANY($2::text[]))", [parentId, undone]);
  for (const st of await stagesOf(client, parentId)) await mirrorMemberships(client, parentId, st.id, seatedIds(parent, st.state));
}

/**
 * A stage's draft that opens at its start, as it opens (inside the stage's write): an exclusive one the seats' picks no longer fit
 * among who's still in is played shared from then on (StateLogic.settleDraftShare, the 9:10 PM decision's fallback). The line for
 * its Recent changes when it did, else null.
 */
export function settleStageDraft(state: LeagueState): string | null {
  const did = StateLogic.settleDraftShare(state);
  if (!did) return null;
  return `The draft is shared: ${did.teams} of you × ${did.each} is more than the ${did.pool} still in, so two of you can have the same one`;
}
