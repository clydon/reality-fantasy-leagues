// The server half of mid-season waivers (docs/PLAN-midseason-waivers.md). Everything that touches
// waiver_claims lives here, so there's one file to audit for the privacy the mechanic rests on: a
// player's claims are never readable by anyone else, the commissioner included. readOwnClaim is the
// only read that returns a claim's contents, and the routes only ever ask it for the caller's own
// player. Processing reads them all, inside the league lock, and what it publishes (every outcome and
// why) is meant to be public once the week has processed.
//
// Plain CommonJS for the same reason as push-core.js: the hourly job (the plan's phase 3) can require
// it beside the routes. Keep it free of Next.js imports. Every function takes the transaction's
// client: they run inside withLeagueLock, under the league row lock, so a claim saved at the moment a
// week processes either makes it into the run or is refused -- never lost in between.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS on purpose, see above
const StateLogic = require("../game/state-logic.js");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS on purpose, see above
const Bots = require("../game/bot-logic.js");

const W = StateLogic.WaiverLogic;

function rowToClaim(r) {
  return { pickupIds: r.pickup_ids || [], dropId: r.drop_id || null, addIds: r.add_ids || [] };
}

async function readClaims(client, leagueId, periodId) {
  const { rows } = await client.query("SELECT * FROM waiver_claims WHERE league_id=$1 AND period_id=$2", [leagueId, periodId]);
  const out = {};
  rows.forEach((r) => {
    out[r.player_id] = rowToClaim(r);
  });
  return out;
}

/** One player's own claim for a week, or null. Only ever called for the asking player. */
async function readOwnClaim(db, leagueId, periodId, playerId) {
  const { rows } = await db.query("SELECT * FROM waiver_claims WHERE league_id=$1 AND period_id=$2 AND player_id=$3", [
    leagueId,
    periodId,
    playerId,
  ]);
  return rows.length ? rowToClaim(rows[0]) : null;
}

// The public "who has claims in" mirror, rewritten from the table in the same transaction.
async function republish(client, leagueId, state, period) {
  const { rows } = await client.query("SELECT player_id FROM waiver_claims WHERE league_id=$1 AND period_id=$2 ORDER BY updated_at, player_id", [
    leagueId,
    period.id,
  ]);
  W.setClaimsIn(state, period, rows.map((r) => r.player_id));
}

/**
 * Saves (or, empty, withdraws) a player's claim for the open week. `userId` is whoever saved it: the
 * player, or the commissioner claiming for them. { claim } or { error }.
 *
 * By part: a claim is a pickup list and an add/drop, picked on separate screens, so a save that leaves
 * one part out (no `pickupIds` key; no `dropId` and no `addIds` key) keeps what's saved for it. That's
 * what lets the commissioner claim a pickup for someone without wiping an add/drop they can't see.
 */
async function saveClaim(client, leagueId, state, playerId, input, userId) {
  const period = W.current(state);
  const has = (k) => !!input && Object.prototype.hasOwnProperty.call(input, k);
  if (period && (!has("pickupIds") || (!has("dropId") && !has("addIds")))) {
    const saved = (await readOwnClaim(client, leagueId, period.id, playerId)) || { pickupIds: [], dropId: null, addIds: [] };
    input = {
      pickupIds: has("pickupIds") ? input.pickupIds : saved.pickupIds,
      dropId: has("dropId") || has("addIds") ? input.dropId : saved.dropId,
      addIds: has("dropId") || has("addIds") ? input.addIds : saved.addIds,
    };
  }
  const checked = W.checkClaim(state, period, playerId, input);
  if (checked.error) return { error: checked.error };
  const { claim } = checked;
  if (W.isEmptyClaim(claim)) {
    await client.query("DELETE FROM waiver_claims WHERE league_id=$1 AND period_id=$2 AND player_id=$3", [leagueId, period.id, playerId]);
  } else {
    await client.query(
      `INSERT INTO waiver_claims (league_id, period_id, player_id, pickup_ids, drop_id, add_ids, updated_by)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6::jsonb,$7)
       ON CONFLICT (league_id, period_id, player_id) DO UPDATE
         SET pickup_ids=EXCLUDED.pickup_ids, drop_id=EXCLUDED.drop_id, add_ids=EXCLUDED.add_ids,
             updated_by=EXCLUDED.updated_by, updated_at=now()`,
      [leagueId, period.id, playerId, JSON.stringify(claim.pickupIds), claim.dropId, JSON.stringify(claim.addIds), userId || null]
    );
  }
  await republish(client, leagueId, state, period);
  return { claim };
}

async function dropClaims(client, leagueId, periodId) {
  await client.query("DELETE FROM waiver_claims WHERE league_id=$1 AND period_id=$2", [leagueId, periodId]);
}

// Runs the open week's claims, computer players' included: a bot claims when its week processes,
// from the league as it stands then (bot-logic.js waiverClaim), rather than holding a row.
async function processPeriod(client, leagueId, state, now, by) {
  const period = W.current(state);
  if (!period || period.phase !== "open") return null;
  const claims = await readClaims(client, leagueId, period.id);
  Bots.botIds(state).forEach((pid) => {
    if (!claims[pid]) claims[pid] = Bots.waiverClaim(state, pid, period);
  });
  return W.process(state, claims, { now, by });
}

/**
 * The clock, run lazily under the league lock (withLeagueLock, before and after every mutation, and on
 * a load with a step waiting): every step due at `now`, in order -- a week whose results came late can
 * process, close and make way for the next in one go. Returns what happened, oldest first, for the
 * pushes the plan's phase 3 adds.
 */
async function syncWaivers(client, leagueId, state, now) {
  const at = now === undefined ? Date.now() : now;
  const events = [];
  // Times first (air times are stamped fresh on every read and write), so a week processed here
  // records the schedule it ran on.
  W.refresh(state);
  for (let i = 0; i < 8; i++) {
    const step = W.due(state, at);
    if (!step) break;
    const period = W.current(state);
    if (step === "open") {
      const p = W.open(state, at);
      events.push({ type: "opened", periodId: p.id, episode: p.episode });
    } else if (step === "cancel") {
      W.cancel(state);
      await dropClaims(client, leagueId, period.id);
      events.push({ type: "cancelled", periodId: period.id, episode: period.episode });
    } else if (step === "process") {
      await processPeriod(client, leagueId, state, at, "schedule");
      events.push({ type: "processed", periodId: period.id, episode: period.episode });
    } else {
      W.close(state, at);
      await dropClaims(client, leagueId, period.id);
      events.push({ type: "closed", periodId: period.id, episode: period.episode });
    }
  }
  W.refresh(state);
  return events;
}

/** The commissioner's Process now. A reason on refusal, else null. */
async function processNow(client, leagueId, state, now) {
  const period = W.current(state);
  if (!period || period.phase !== "open") return "Waivers aren’t open";
  await processPeriod(client, leagueId, state, now === undefined ? Date.now() : now, "commissioner");
  return null;
}

module.exports = { readOwnClaim, saveClaim, syncWaivers, processNow };
