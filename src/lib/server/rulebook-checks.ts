import type { Rulebook } from "@db/rulebooks.js";
import { seasonRulebook } from "@db/rulebooks.js";
import { isUuid, type SessionUser } from "./auth-helpers";
import { requireCouch } from "./couches";
import { pool, HttpError } from "./db";

// "Looks right to us" (docs/PLAN-new-design.md step 10 part 3; the plan's Noticed "New until another couch checks it, and
// nothing checks it"). A rulebook someone made with Make it a game is the season's for every couch, and How it works says
// it's new until another couch checks it: now someone on another couch can (one check per couch, never the maker's own
// couch or the maker), and it reads "checked by another couch". Something wrong is still Suggest a fix, for the desk; the
// desk can also take it over (desk-library.ts).

export type CheckState = "can" | "done" | null;

/** Whether `couchId`'s people can check the season's made rulebook (`can`), have (`done`), or it isn't theirs to (null). */
export async function checkState(userId: string, row: Rulebook | null, couchId: string | null): Promise<CheckState> {
  if (!row || row.provenance?.from !== "made" || row.reviewStatus === "reviewed" || row.reviewStatus === "approved") return null;
  if (!couchId || row.createdBy === userId || row.provenance?.couch === couchId) return null;
  const { rows } = await pool.query("SELECT 1 FROM rulebook_checks WHERE rulebook_id = $1 AND couch_id = $2", [row.id, couchId]);
  return rows.length ? "done" : "can";
}

/** Someone on another couch says the season's made rulebook looks right. */
export async function checkRulebook(user: SessionUser, seasonId: string, couchId: string | null): Promise<{ ok: true }> {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  if (!couchId) throw new HttpError(400, "Which couch?");
  await requireCouch(user, couchId);
  const row = await seasonRulebook(pool, seasonId);
  if (!row || row.provenance?.from !== "made") throw new HttpError(409, "This rulebook isn't one someone made");
  if (row.reviewStatus === "reviewed" || row.reviewStatus === "approved") throw new HttpError(409, "It's been checked already");
  if (row.createdBy === user.id || row.provenance?.couch === couchId) throw new HttpError(409, "Your couch made it: someone on another couch checks it");
  await pool.query("INSERT INTO rulebook_checks (rulebook_id, couch_id, user_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [row.id, couchId, user.id]);
  await pool.query("UPDATE rulebooks SET review_status = 'checked', updated_at = now() WHERE id = $1 AND review_status = 'unreviewed'", [row.id]);
  return { ok: true };
}
