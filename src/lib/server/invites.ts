import type { SessionUser } from "./auth-helpers";
import { isUuid } from "./auth-helpers";
import { pool, HttpError } from "./db";

// Loads a pending invite and checks it's actually addressed to this user (by username or email)
// -- the authorization step for accept/decline, so a client can't answer someone else's invite
// just by knowing its id. Unaddressed invites 404 rather than 403 so ids can't be probed.
export async function loadOwnPendingInvite(inviteId: string, user: SessionUser): Promise<{ id: string; league_id: string; player_id: string | null }> {
  if (!isUuid(inviteId)) throw new HttpError(404, "Invite not found");
  const { rows } = await pool.query(
    `SELECT li.id, li.league_id, li.status, li.player_id FROM league_invites li JOIN "user" u ON u.id = $2
     WHERE li.id=$1 AND (lower(li.identifier)=lower(u.username) OR lower(li.identifier)=lower(u.email))`,
    [inviteId, user.id]
  );
  if (!rows.length) throw new HttpError(404, "Invite not found");
  if (rows[0].status !== "pending") throw new HttpError(409, "This invite has already been answered");
  return rows[0];
}
