import crypto from "crypto";
import type { Pool, PoolClient } from "pg";
import { NextResponse } from "next/server";
import { isAPIError } from "better-auth/api";
import { auth, sendAuthEmail } from "@/lib/auth";
import { NO_EMAIL_DOMAIN, realEmail } from "@/lib/no-email";
import { isUsername, USERNAME_RULE } from "@/lib/usernames";
import { paths } from "@/new/routes";
import type { SessionUser } from "./auth-helpers";
import { ensureOwner } from "./couches";
import { pool, tx, HttpError } from "./db";
import { logDesk } from "./desk";
import { letSeatGo } from "./desk-seats";
import { renameEverywhere } from "./profile";

// A person's actions on the desk (docs/PLAN-desk-parity.md step 1, part 1b; the mock's desk.js dkLetIn, dkActSheet,
// dkNameSheet, dkPwSheet, dkSignSheet, dkBackIn): Let in, Act as them, Name and email, Reset password, Stop them signing
// in and Let them back in. Each is a line in the person's History (admin_changes, entity 'person'), with Undo where it
// has one: Let in, the account, and stopping and letting back are tier 1; a password reset and acting as them can't be
// taken back. Classic's admin routes (retired at step 8) did these without History or Undo, and had no stop.
//
// The account's own columns are written here directly, as classic's approve already was: Better Auth's adminUpdateUser
// checks a username as taken against the calling admin's session, not the person's (classic's PATCH says why), and its
// ban defaults a blank reason to "No reason". Ban and unban are its columns (banned, banReason, banExpires: its sign-in
// refuses a banned account) plus signing them out (deleting their sessions), as its banUser does. The password is its
// credential account's, hashed by Better Auth's own hasher, as its setUserPassword does, so the reset, signing them out
// and its line are one transaction. Nothing here stops or resets another site admin, as Better Auth's rule keeps anyone
// from acting as one. Delete (part 1c) is the account gone for good: classic's (Better Auth's removeUser after disabling
// every seat) weighed against the app's own takeOut, whose rule it now follows seat by seat.

interface Person {
  id: string;
  username: string | null;
  name: string;
  email: string;
  emailVerified: boolean;
  role: string | null;
  approved: boolean;
  banned: boolean;
  banReason: string | null;
}

async function person(id: string): Promise<Person> {
  const { rows } = await pool.query(`SELECT id, username, name, email, "emailVerified", role, approved, banned IS TRUE AS banned, "banReason" FROM "user" WHERE id = $1`, [id]);
  if (!rows[0]) throw new HttpError(404, "Nobody by that id");
  return rows[0];
}

const nameOf = (p: Person) => p.username || p.name;
const isAdmin = (p: Person) => p.role === "admin";

type Db = Pool | PoolClient;

/** A write and its History line together: neither without the other. */

/**
 * Signs them out on every device: their sessions go. An hour as them begun on the desk goes too, and ends in their History
 * there and then.
 */
async function signOutEverywhere(db: Db, id: string) {
  const { rows } = await db.query(`DELETE FROM session WHERE "userId" = $1 RETURNING id, "impersonatedBy" AS by`, [id]);
  for (const s of rows.filter((r) => r.by))
    await db.query(
      `INSERT INTO admin_changes (entity, entity_id, action, text, after, user_id)
       SELECT 'person', $1, 'act-end', 'Acting as them ended: they were signed out', jsonb_build_object('sessionId', $2::text), $3
        WHERE EXISTS (SELECT 1 FROM admin_changes a WHERE a.entity = 'person' AND a.entity_id = $1 AND a.action = 'act' AND a.after->>'sessionId' = $2)
          AND NOT EXISTS (SELECT 1 FROM admin_changes e WHERE e.entity = 'person' AND e.entity_id = $1 AND e.action = 'act-end' AND e.after->>'sessionId' = $2)`,
      [id, s.id, s.by]
    );
}

/** Another site admin is theirs to look after: not stopped or reset from the desk. */
function notAnAdmin(p: Person) {
  if (isAdmin(p)) throw new HttpError(409, "Not another site admin's account");
}

// ---------- Let in ----------

/**
 * Lets someone waiting in (Who gets in): they can play at once, and they're told by email when they have a real address
 * (docs/PLAN-desk-parity.md Noticed ag: classic told nobody, so they found out only when they next opened the app; while
 * they wait no phone of theirs gets notifications). The email goes once they're in, and their History line says whether it
 * did. Undo puts them back on the list (the email has gone by then).
 */
export async function letIn(user: SessionUser, id: string): Promise<{ changeId: string; name: string; told: "email" | "failed" | "none" }> {
  const p = await person(id);
  const email = realEmail(p.email);
  const changeId = await tx(async (db) => {
    const { rowCount } = await db.query(`UPDATE "user" SET approved = true, "updatedAt" = now() WHERE id = $1 AND approved = false`, [id]);
    if (!rowCount) throw new HttpError(409, `${nameOf(p)} is in already`);
    return logDesk(db, { entity: "person", entityId: id, action: "let-in", text: email ? "Let in" : "Let in (no email to tell them by)", undo: { type: "person", do: "approved", value: false }, userId: user.id });
  });
  if (!email) return { changeId, name: nameOf(p), told: "none" };
  const home = (process.env.BETTER_AUTH_URL || "").replace(/\/+$/, "");
  let told: "email" | "failed" = "email";
  try {
    await sendAuthEmail({
      to: email,
      subject: "You're in",
      text: `You're in, ${nameOf(p)}: your account is ready, and you can play now.${home ? `\n\n${home}/` : ""}\n\nYou're getting this because you made an account and were waiting to get in.`,
    });
  } catch (e) {
    console.error("[let in] the email didn't send:", (e as Error).message);
    told = "failed";
  }
  await pool.query("UPDATE admin_changes SET text = $2 WHERE id = $1", [changeId, told === "email" ? "Let in, and told by email" : "Let in (the email to tell them didn't send)"]);
  return { changeId, name: nameOf(p), told };
}

// ---------- signing in ----------

const WHY_MAX = 200;

/**
 * Stops them signing in: signed out everywhere now, refused at sign-in until they're let back. An optional reason only
 * admins see. Their seats, scores and messages stay; their couches aren't told.
 */
export async function stopSigningIn(user: SessionUser, id: string, rawWhy: unknown): Promise<{ changeId: string; name: string }> {
  if (id === user.id) throw new HttpError(400, "Not your own account");
  const p = await person(id);
  notAnAdmin(p);
  const why = typeof rawWhy === "string" ? rawWhy.trim().slice(0, WHY_MAX) : "";
  const changeId = await tx(async (db) => {
    if (!(await ban(db, id, why || null))) throw new HttpError(409, `${nameOf(p)} can't sign in already`);
    return logDesk(db, {
      entity: "person",
      entityId: id,
      action: "stop",
      text: `Stopped from signing in${why ? `: "${why}"` : ""}`,
      after: { why: why || null },
      undo: { type: "person", do: "signIn", value: true },
      userId: user.id,
    });
  });
  return { changeId, name: nameOf(p) };
}

/** Lets them sign in again. Undo stops them again, with the reason they had. */
export async function letBackIn(user: SessionUser, id: string): Promise<{ changeId: string; name: string }> {
  const p = await person(id);
  const changeId = await tx(async (db) => {
    if (!(await unban(db, id))) throw new HttpError(409, `${nameOf(p)} can sign in already`);
    return logDesk(db, {
      entity: "person",
      entityId: id,
      action: "back-in",
      text: "Let back in",
      before: { why: p.banReason },
      undo: { type: "person", do: "signIn", value: false, why: p.banReason },
      userId: user.id,
    });
  });
  return { changeId, name: nameOf(p) };
}

/** Stops them signing in and signs them out; false when they couldn't already. */
async function ban(db: Db, id: string, why: string | null): Promise<boolean> {
  const { rowCount } = await db.query(`UPDATE "user" SET banned = true, "banReason" = $2, "banExpires" = NULL, "updatedAt" = now() WHERE id = $1 AND banned IS NOT TRUE`, [id, why]);
  if (rowCount) await signOutEverywhere(db, id);
  return !!rowCount;
}

/** Lets them sign in again; false when they could already. */
async function unban(db: Db, id: string): Promise<boolean> {
  const { rowCount } = await db.query(`UPDATE "user" SET banned = false, "banReason" = NULL, "banExpires" = NULL, "updatedAt" = now() WHERE id = $1 AND banned IS TRUE`, [id]);
  return !!rowCount;
}

// ---------- the password ----------

// Three groups of four, with nothing that reads as something else (no 0, O, 1, I or L): about 59 bits, read out or texted.
const PW_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const tempPassword = () => Array.from({ length: 3 }, () => Array.from({ length: 4 }, () => PW_CHARS[crypto.randomInt(PW_CHARS.length)]).join("")).join("-");

/**
 * A temporary password, shown once: the old one stops working and they're signed out everywhere. Not your own (Settings'
 * Change password is yours). Classic's reset left them signed in.
 */
export async function resetPassword(user: SessionUser, id: string): Promise<{ password: string; changeId: string }> {
  if (id === user.id) throw new HttpError(400, "Change your own in Settings");
  notAnAdmin(await person(id));
  const password = tempPassword();
  const hash = await (await auth.$context).password.hash(password);
  const changeId = await tx(async (db) => {
    const { rowCount } = await db.query(`UPDATE account SET password = $2, "updatedAt" = now() WHERE "userId" = $1 AND "providerId" = 'credential'`, [id, hash]);
    // Made with Google alone: a password of their own from now on, as Better Auth's setUserPassword does.
    if (!rowCount)
      await db.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [crypto.randomUUID(), id, hash]);
    await signOutEverywhere(db, id);
    return logDesk(db, { entity: "person", entityId: id, action: "password", text: "Password reset: a temporary one", userId: user.id });
  });
  return { password, changeId };
}

// ---------- name and email ----------

const okEmail = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && e.length <= 254;

/** A problem with one field of Name and email: the sheet shows it under that field. */
export class FieldError extends HttpError {
  constructor(
    status: number,
    readonly field: "name" | "email",
    message: string
  ) {
    super(status, message);
  }
}
const fieldError = (status: number, field: "name" | "email", message: string) => new FieldError(status, field, message);

async function checkName(id: string, n: string) {
  if (!isUsername(n)) throw fieldError(400, "name", USERNAME_RULE);
  const { rows } = await pool.query(`SELECT 1 FROM "user" WHERE lower(username) = $1 AND id <> $2`, [n, id]);
  if (rows.length) throw fieldError(409, "name", `${n} is taken`);
}

async function checkEmail(id: string, e: string) {
  if (!okEmail(e) || e.endsWith(`@${NO_EMAIL_DOMAIN}`)) throw fieldError(400, "email", "That doesn't look like an email");
  const { rows } = await pool.query(`SELECT 1 FROM "user" WHERE lower(email) = $1 AND id <> $2`, [e, id]);
  if (rows.length) throw fieldError(409, "email", "Another account has that email");
}

/**
 * Their name (which is their username: what they sign in with and what the couch sees) and their email (where Forgot
 * password sends the link). A new name is checked as sign-up checks it, refused when it's taken, and reaches every game
 * they play and the messages they wrote, as Settings' own rename does. A blank email changes nothing: a username-only
 * account's stand-in is never shown, and an email the desk sets counts as checked (nobody's sent a link to check it).
 */
export async function saveAccount(user: SessionUser, id: string, body: { name?: unknown; email?: unknown }): Promise<{ changeId: string; name: string; renamed: boolean }> {
  const p = await person(id);
  const n = typeof body.name === "string" ? body.name.trim().toLowerCase() : "";
  const e = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const newName = n && n !== p.username ? n : null;
  const newEmail = e && e !== p.email.toLowerCase() ? e : null;
  if (newName) await checkName(id, newName);
  if (newEmail) await checkEmail(id, newEmail);
  if (!newName && !newEmail) throw new HttpError(400, "Nothing to change");
  const was = realEmail(p.email);
  const text = [
    newName ? `Renamed from ${nameOf(p)} to ${newName}` : null,
    newEmail ? (was ? `Email changed from ${was} to ${newEmail}` : `Email added: ${newEmail}`) : null,
  ]
    .filter(Boolean)
    .join("; ");
  let changeId: string;
  try {
    changeId = await tx(async (db) => {
      await writeAccount(db, id, { username: newName, name: newName, email: newEmail, emailVerified: newEmail ? true : null });
      return logDesk(db, {
        entity: "person",
        entityId: id,
        action: "account",
        text,
        undo: {
          type: "person",
          do: "account",
          ...(newName ? { username: p.username, name: p.name, set: newName } : {}),
          ...(newEmail ? { email: p.email, emailVerified: p.emailVerified, setEmail: newEmail } : {}),
        },
        userId: user.id,
      });
    });
  } catch (e) {
    // Taken between the check and the write (the columns are unique).
    if ((e as { code?: string }).code === "23505") throw fieldError(409, newName ? "name" : "email", newName ? `${newName} is taken` : "Another account has that email");
    throw e;
  }
  if (newName) await renameEverywhere(id, newName);
  return { changeId, name: newName ?? nameOf(p), renamed: !!newName };
}

/** Writes the account's columns given (null: left as it is). */
async function writeAccount(db: Db, id: string, a: { username: string | null; name: string | null; email: string | null; emailVerified: boolean | null }) {
  const sets: string[] = [];
  const args: unknown[] = [id];
  const set = (col: string, v: unknown) => {
    args.push(v);
    sets.push(`${col} = $${args.length}`);
  };
  if (a.username !== null) {
    set("username", a.username);
    set(`"displayUsername"`, a.username);
  }
  if (a.name !== null) set("name", a.name);
  if (a.email !== null) set("email", a.email);
  if (a.emailVerified !== null) set(`"emailVerified"`, a.emailVerified);
  if (sets.length) await db.query(`UPDATE "user" SET ${sets.join(", ")}, "updatedAt" = now() WHERE id = $1`, args);
}

// ---------- Delete ----------

/**
 * Deletes their account for good (tier 3; it can't come back). Not your own, nor another site admin's. They're signed out
 * and can't sign in first ("Being deleted"), so nothing of theirs moves meanwhile; then each seat goes as the app's takeOut
 * lets one go (letSeatGo: after a draft it stays in the standings, unplayed; before one, or in a game with no draft, it
 * goes), with a line in each game's Recent changes. A game only they play (their practice games too; not a season's public
 * pool) goes with them, a line on its couch's History. Then the account goes, and with it (the database's cascades) their
 * place on each couch, their follows, ratings and settings, and invites they sent that nobody's used; their messages stay,
 * under their name. A couch they started passes to whoever's next (couches.ts ensureOwner), and one left with nobody and no
 * games goes. Games they ran alone and didn't hand on are left with nobody running them (on a couch, the Inbox has them).
 * Stopped partway (a game that wouldn't let their seat go), it says so: they can't sign in, and Delete again finishes it.
 */
export async function deleteAccount(user: SessionUser, id: string): Promise<{ name: string }> {
  if (id === user.id) throw new HttpError(400, "Not your own account: another site admin would have to");
  const p = await person(id);
  if (isAdmin(p)) throw new HttpError(409, "Not another site admin's account");
  const name = nameOf(p);
  await tx(async (db) => {
    await db.query(`UPDATE "user" SET banned = true, "banReason" = COALESCE("banReason", 'Being deleted'), "updatedAt" = now() WHERE id = $1`, [id]);
    await signOutEverywhere(db, id);
  });
  const { rows: seats } = await pool.query(
    `SELECT l.id, l.name, l.couch_id, l.solo IS DISTINCT FROM 'public' AND NOT EXISTS (SELECT 1 FROM league_memberships o WHERE o.league_id = l.id AND o.user_id <> $1) AS alone
       FROM league_memberships m JOIN leagues l ON l.id = m.league_id WHERE m.user_id = $1`,
    [id]
  );
  const batch = crypto.randomUUID();
  try {
    for (const s of seats.filter((r) => !r.alone)) await letSeatGo(s.id, id, name, user.id, batch);
  } catch (e) {
    console.error(`[desk] deleting ${id} stopped partway:`, e);
    throw new HttpError(500, `Deleting ${name}'s account stopped partway: they can't sign in, and Delete again finishes it`);
  }
  const { rows: couches } = await pool.query("SELECT couch_id FROM couch_members WHERE user_id = $1", [id]);
  await tx(async (db) => {
    // The games only they play: nobody could ever play them again.
    const { rows: gone } = await db.query(
      `DELETE FROM leagues l WHERE l.id = ANY($1::uuid[]) AND NOT EXISTS (SELECT 1 FROM league_memberships o WHERE o.league_id = l.id AND o.user_id <> $2) RETURNING l.name, l.couch_id`,
      [seats.filter((r) => r.alone).map((r) => r.id), id]
    );
    for (const g of gone.filter((r) => r.couch_id))
      await logDesk(db, { entity: "couch", entityId: g.couch_id, action: "game-gone", text: `${g.name} went with ${name}'s account: nobody else played it`, userId: user.id });
    await logDesk(db, { entity: "person", entityId: id, action: "delete", text: `Deleted the account (${name})`, before: { name }, userId: user.id });
    await db.query(`DELETE FROM "user" WHERE id = $1`, [id]);
    for (const c of couches) {
      await ensureOwner(db, c.couch_id);
      await db.query(
        "DELETE FROM couches c WHERE c.id = $1 AND NOT EXISTS (SELECT 1 FROM couch_members m WHERE m.couch_id = c.id) AND NOT EXISTS (SELECT 1 FROM leagues l WHERE l.couch_id = c.id)",
        [c.couch_id]
      );
    }
  });
  return { name };
}

// ---------- Undo ----------

/** The lines each kind of Undo answers to: a later one of them, not undone, stands in its way. */
const LATER: Record<string, string[]> = { approved: ["let-in"], signIn: ["stop", "back-in"], account: ["account"] };

/**
 * History's Undo for a person's line (`changeId`): back on the list, signing in or not, the account as it was. A change
 * made since stands in the way (let back in, then stopped again; renamed again): then it says so and changes nothing.
 */
export async function restorePerson(id: string, changeId: string, u: Record<string, unknown>): Promise<void> {
  const p = await person(id);
  const { rows: later } = await pool.query(
    `SELECT 1 FROM admin_changes l JOIN admin_changes c ON c.id = $2
      WHERE l.entity = 'person' AND l.entity_id = $1 AND l.action = ANY($3) AND l.created_at > c.created_at AND l.undone_at IS NULL LIMIT 1`,
    [id, changeId, LATER[String(u.do)] ?? []]
  );
  if (later.length) throw new HttpError(409, "A later change stands in the way: undo that one first");
  switch (u.do) {
    case "approved":
      if (p.approved === !!u.value) throw new HttpError(409, u.value ? `${nameOf(p)} is in already` : `${nameOf(p)} is waiting already`);
      await pool.query(`UPDATE "user" SET approved = $2, "updatedAt" = now() WHERE id = $1`, [id, !!u.value]);
      return;
    case "signIn":
      if (!(u.value ? await unban(pool, id) : await ban(pool, id, typeof u.why === "string" ? u.why : null)))
        throw new HttpError(409, u.value ? `${nameOf(p)} can sign in already` : `${nameOf(p)} can't sign in already`);
      return;
    case "account": {
      if ((typeof u.set === "string" && p.username !== u.set) || (typeof u.setEmail === "string" && p.email !== u.setEmail))
        throw new HttpError(409, "Their name or email has changed since: it can't go back");
      const username = typeof u.username === "string" ? u.username : null;
      const email = typeof u.email === "string" ? u.email : null;
      if (username !== null && username !== p.username) {
        const { rows } = await pool.query(`SELECT 1 FROM "user" WHERE lower(username) = $1 AND id <> $2`, [username.toLowerCase(), id]);
        if (rows.length) throw new HttpError(409, `${username} is taken now: it can't go back`);
      }
      if (email !== null && email !== p.email) {
        const { rows } = await pool.query(`SELECT 1 FROM "user" WHERE lower(email) = $1 AND id <> $2`, [email.toLowerCase(), id]);
        if (rows.length) throw new HttpError(409, "Another account has that email now: it can't go back");
      }
      // The name it had before isn't a username to go back to (an account made with Google with none): name it again instead.
      if (typeof u.set === "string" && username === null) throw new HttpError(409, "It had no username before: give it another name instead");
      const back = username !== null && username !== p.username ? username : null;
      await writeAccount(pool, id, {
        username: back,
        name: typeof u.name === "string" && username !== null ? u.name : null,
        email: email !== null && email !== p.email ? email : null,
        emailVerified: email !== null && typeof u.emailVerified === "boolean" ? u.emailVerified : null,
      });
      if (back) await renameEverywhere(id, back);
      return;
    }
    default:
      throw new HttpError(409, "That one can't be undone here");
  }
}

// ---------- Act as them ----------

/** Better Auth's answer, as ours: its cookies (the session swap) on our JSON. */
function withCookies(from: Response, body: unknown): NextResponse {
  const out = NextResponse.json(body);
  for (const c of from.headers.getSetCookie()) out.headers.append("set-cookie", c);
  return out;
}

async function refused(res: Response, fallback: string): Promise<never> {
  const b = (await res.json().catch(() => ({}))) as { message?: string };
  throw new HttpError(res.status >= 500 ? 500 : res.status || 400, b.message || fallback);
}

/**
 * Act as them (decision 1): classic's impersonation (Better Auth's impersonateUser: an hour as them, your own session
 * kept aside), from the desk, written in their History as it starts. Not yourself, another site admin (Better Auth's
 * rule), someone waiting (there's nothing to see) or someone who can't sign in. Answers where to go: the app's front
 * door, which opens the design they use.
 */
export async function startActing(req: Request, user: SessionUser, id: string, from?: "test-couch"): Promise<NextResponse> {
  if (id === user.id) throw new HttpError(400, "Not your own account: you're already you");
  const p = await person(id);
  if (isAdmin(p)) throw new HttpError(409, "Not another site admin");
  if (p.banned) throw new HttpError(409, "Not while they can't sign in: let them back in first");
  if (!p.approved) throw new HttpError(409, "Once they're in: until then there's nothing to see");
  let res: Response;
  try {
    res = await auth.api.impersonateUser({ body: { userId: id }, headers: req.headers, asResponse: true });
  } catch (e) {
    throw new HttpError(400, isAPIError(e) ? e.message : "Couldn't act as them");
  }
  if (!res.ok) await refused(res, "Couldn't act as them");
  const { session } = (await res.clone().json()) as { session: { id: string; expiresAt: string } };
  try {
    await logDesk(pool, {
      entity: "person",
      entityId: id,
      action: "act",
      text: from === "test-couch" ? "Started acting as them · from the test couch" : "Started acting as them",
      after: { sessionId: session.id, until: new Date(session.expiresAt).toISOString(), ...(from ? { from } : {}) },
      userId: user.id,
    });
  } catch (e) {
    // No hour as them that History doesn't have: its session goes, and the cookie never leaves.
    await pool.query("DELETE FROM session WHERE id = $1", [session.id]).catch(() => {});
    throw e;
  }
  return withCookies(res, { go: "/", until: new Date(session.expiresAt).toISOString() });
}

/** "4 minutes", "under a minute", "an hour". */
const lasted = (ms: number) => {
  const m = Math.round(ms / 60000);
  return m < 1 ? "under a minute" : m >= 60 ? "an hour" : `${m} minute${m === 1 ? "" : "s"}`;
};

/**
 * Return to my account (the Viewing as bar, in both designs): Better Auth's stopImpersonating, its end in their History,
 * and the way back to their page; an hour from the test couch's switches goes back to the front door. An hour with no
 * start in History (begun through classic's admin, before step 8) just ends: back to the front door.
 */
export async function endActing(req: Request, ifActing = false): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: req.headers });
  const by = session && (session.session as { impersonatedBy?: string | null }).impersonatedBy;
  // Signing out ends any hour first (auth-client.ts logOut): not acting, there's nothing to end.
  if (!by && ifActing) return NextResponse.json({ back: null });
  if (!session) throw new HttpError(401, "Not logged in");
  if (!by) throw new HttpError(400, "You're not viewing as anyone");
  const { rows } = await pool.query(
    `SELECT a.created_at, a.after->>'from' AS "from" FROM admin_changes a
      WHERE a.entity = 'person' AND a.entity_id = $1 AND a.action = 'act' AND a.user_id = $2 AND a.after->>'sessionId' = $3
        AND NOT EXISTS (SELECT 1 FROM admin_changes e WHERE e.entity = 'person' AND e.entity_id = $1 AND e.action = 'act-end' AND e.after->>'sessionId' = $3)`,
    [session.user.id, by, session.session.id]
  );
  let res: Response;
  try {
    res = await auth.api.stopImpersonating({ headers: req.headers, asResponse: true });
  } catch (e) {
    throw new HttpError(400, isAPIError(e) ? e.message : "Couldn't return to your account");
  }
  if (!res.ok) await refused(res, "Couldn't return to your account");
  if (!rows[0]) return withCookies(res, { back: null });
  await logDesk(pool, {
    entity: "person",
    entityId: session.user.id,
    action: "act-end",
    text: `Stopped acting as them · ${lasted(Date.now() - rows[0].created_at.getTime())}`,
    after: { sessionId: session.session.id },
    userId: by,
  });
  // A test couch switch goes home, as it always did; an hour from their page goes back to it.
  return withCookies(res, { back: rows[0].from === "test-couch" ? null : paths.deskItem("person", session.user.id) });
}

