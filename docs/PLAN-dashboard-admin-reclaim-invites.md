# Plan: Dashboard, Admin table overhaul, disabled-player reclaim, league invites

**Status:** Implemented (all four features). See README's "Dashboard, league invites, seat
reclaim, admin users table" section for what shipped and where it differs from this plan. In
short: admin-delete-account seats can't actually be reclaimed, because the deleted account id
never comes back; the PATCH route adds its own username-uniqueness check; `joinLeague()` runs as
one locked transaction. Kept below as the original design record.

## Context (read this first)

`reality-fantasy-leagues` used to be a frontend-only POC that called the live `SurvivorDraft`
Express server over CORS for everything real. That dependency has been **fully removed** — this
repo now has its own standalone backend:

- **Auth**: Better Auth (`src/lib/auth.ts`) with the `username` and `admin` plugins. This is the
  *one* real identity system for everything — league access, admin, all of it. Users sign up with
  username + email + password (`/account`) and can sign in with either (`login-screen.tsx`, via
  `signInWithIdentifier` in `src/lib/auth-client.ts`). The `admin` plugin's server API
  (`auth.api.listUsers/createUser/updateUser/setUserPassword/removeUser/impersonateUser`, see
  `node_modules/better-auth/dist/plugins/admin/routes.mjs` for exact signatures) already backs
  most of `src/app/api/admin/users/*`.
- **Database**: one Postgres database (`AUTH_DATABASE_URL` in `.env.local`) holds both Better
  Auth's own tables (`user`, `session`, `account`, `verification` — managed by
  `npx @better-auth/cli migrate`, never hand-edited) and this app's own tables (`leagues`,
  `league_memberships`, `chat_messages`, `chat_reactions`, `issue_reports` — schema in
  `db/migrations/0001_app_schema.sql`, applied via `node db/migrate.js`). Add new tables as a new
  numbered migration file in that same directory; never edit an already-applied one.
  **Note**: Better Auth's `user.id` is `TEXT` (its own id format), not `UUID` — every foreign key
  to it in this app's own tables must be `TEXT REFERENCES "user"(id)`, and `"user"` must stay
  double-quoted in raw SQL (reserved word).
- **Game logic**: `src/lib/game/state-logic.js` — forked from SurvivorDraft's
  `shared/state-logic.js`, now this app's own real logic (not just a mock-mode stand-in). Domain
  classes: `Core`, `ScoringLogic`, `DraftLogic`, `RosterLogic`, `ReplenishLogic`, `TradeLogic`,
  `EpisodeLogic`, `BetLogic`, `FinaleLogic`, `Migrations`, plus a league-type strategy-pattern
  layer (`LEAGUE_TYPES`/`SHOWS` registries, `SnakeDraftStrategy`/`EliminationOrderScoringStrategy`)
  — see that file's own top comment for the extension pattern before adding new logic. It's plain
  JS (not TS) — ambient types live in `src/lib/game/state-logic.d.ts`, extend that file when you
  add new exported functions.
- **API route pattern**: every mutation route under `src/app/api/leagues/[leagueId]/*` follows the
  same shape — wrap the handler in `apiRoute()` (`src/lib/server/api-route.ts`), call
  `requireLeagueRole(req, leagueId, 'member'|'commissioner')` (`src/lib/server/auth-helpers.ts`)
  for auth, then `withLeagueLock(leagueId, (state) => { ...mutate state in place... })`
  (`src/lib/server/db.ts`) for the actual DB read-lock-mutate-write cycle. Admin-only routes use
  `requireSuperAdmin(req)` instead. Copy an existing route file (e.g.
  `src/app/api/leagues/[leagueId]/tribes/route.ts`) as your starting template — don't write this
  pattern from scratch.
- **Client API pattern**: `src/lib/api.ts` has one `api.xxx()` function per route, all using
  `localFetch()` (same-origin fetch, no CORS). Add new functions there following the existing
  style. Client-side, mutations go through `useMutate()` (`src/lib/use-mutate.ts`), which branches
  mock-mode (calls `StateLogic` directly on local state) vs. live-mode (calls the real API) — every
  new mutation needs both branches, same as every existing one.
- **Verification discipline established all session**: `npm run build` + `npm run lint` clean
  after every change; a throwaway Node script hitting the real dev server + real database to
  verify each new route end-to-end (see any file matching `verify-*.js` pattern used in prior
  sessions — not committed, written to a scratch dir); a Puppeteer screenshot pass for anything
  UI-visible. Don't consider a phase done without the real-API check, not just build/lint.
- **Fixture accounts**: `SurvivorDraft/db/seed-dev-fixtures.js` seeds `conor`/`user1`-`user4` in
  *SurvivorDraft's own database* — **not usable here**, this repo has a separate database with no
  seeded accounts. Create throwaway fixture accounts per verification script the same way prior
  sessions did (sign up via `/api/auth/sign-up/email` with a `username`, clean up after).

Read `README.md` for the full narrative history if more context is needed, but the above is
sufficient to execute this plan.

---

## Feature A: Dashboard (join/create league landing page)

**Problem**: `src/components/auth-gate.tsx`'s `loadFirstLeague()` silently picks `me.leagues[0]`
if any leagues exist, or falls back to mock/demo data with a "no personal league" banner if none
exist. There's no way for a real signed-in user with zero leagues to actually create or join one
through the UI — they're stuck looking at demo data forever unless a super-admin manually creates
a league for them via Admin.

**Backend**: nothing new needed. `POST /api/leagues` (create) and `POST /api/leagues/join` (join
by code) already exist (`src/app/api/leagues/route.ts`, `src/app/api/leagues/join/route.ts`), and
`api.createLeague`/`api.joinLeague` already exist in `src/lib/api.ts`.

**Frontend**:
1. New component `src/components/dashboard/dashboard.tsx` — a standalone full-page component (no
   Sidebar/MobileNav chrome, matching the live app's original `renderDashboard()` having no tabs
   either). Two panels: "Join a League" (join-code text input + button, calls `api.joinLeague`)
   and "Create a League" (name text input + button, calls `api.createLeague`). On success in
   either case, call `useLeagueStore`'s `loadLive(...)` with the response (mirror the exact args
   `auth-gate.tsx`'s `loadFirstLeague` already passes) and set `entered` to true (already true, no
   change needed there) — the user lands straight in their new/joined league's Overview tab.
   Include Feature D's "Pending Invites" list here too (see below) — same landing page, same
   real-estate the live app used for exactly this.
2. `auth-gate.tsx`: after `setIdentity`/`setLeagues` in `loadFirstLeague`, if
   `me.leagues.length === 0`, render `<Dashboard />` instead of falling through to the
   mock-data-with-banner path. Keep the existing mock/demo "Take a Tour" path for **unauthenticated**
   users entirely as-is — this only changes what an **authenticated user with zero leagues** sees.
   Concretely: in the JSX branch logic (currently `if (!entered) return <LoginScreen/>`, else the
   app shell), add a branch: `if (entered && isAuthenticated && leagues.length === 0 && mode ===
   'mock') return <Dashboard />` before the app-shell return. Use the store's existing
   `useIsAuthenticated()` selector and `leagues` field.
3. Add a way back to the Dashboard from inside an already-loaded league (for joining/creating an
   *additional* league) — simplest: add a "+ Join or create a league" row at the bottom of
   `src/components/league-switcher.tsx`'s dropdown (both the desktop `LeagueSwitcher` component and
   MobileNav's inline copy of the same dropdown), navigating to a real route `src/app/dashboard/
   page.tsx` that renders the same `<Dashboard />` component (so it's reachable standalone, not
   only via the auto-redirect case above).

**Verification**: sign up a fresh fixture account (no leagues), confirm Dashboard renders instead
of demo data; create a league through it, confirm it loads; sign up a second fixture account, join
the first one's league by code through Dashboard, confirm both see each other via the League
Settings Players list. Puppeteer screenshot of the Dashboard itself.

---

## Feature B: League invites

**New capability, not a port of anything in the original live app** (which only ever had join-by-
code). Any member of a league (not just the commissioner — the user was explicit: "players/
commissioners") can invite someone else by username or email; the invite shows up on the invited
person's Dashboard (Feature A) once they're signed in, whether or not they had an account yet at
invite time.

### Schema — new migration `db/migrations/0002_invites.sql`

```sql
CREATE TABLE league_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  invited_by TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  -- Whatever the inviter typed (username or email), matched case-insensitively against the
  -- invitee's username/email at query time -- NOT resolved to a user_id at invite time, since the
  -- invitee may not have an account yet.
  identifier TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ
);
CREATE INDEX idx_league_invites_league ON league_invites(league_id);
CREATE INDEX idx_league_invites_identifier ON league_invites(lower(identifier));
CREATE INDEX idx_league_invites_status ON league_invites(status);
```

### New routes

- `POST /api/leagues/[leagueId]/invites` — `requireLeagueRole(req, leagueId, 'member')` (any
  member, not commissioner-only). Body `{identifier: string}`. Validate: not already a member of
  this league (join `league_invites`-independent check against `league_memberships` joined to
  `"user"` on username/email match), not already a pending invite for the same
  league+identifier (case-insensitive). Insert row with `invited_by = req session user id`.
- `GET /api/leagues/[leagueId]/invites` — any member can view the league's invite list (for
  League Settings display). Return pending + recently-responded invites, newest first.
- `DELETE /api/leagues/[leagueId]/invites/[id]` — revoke a pending invite. Only the original
  inviter (`invited_by`) or a commissioner can call this — check both.
- `GET /api/me/invites` — list this session's pending invites: `SELECT li.*, l.name as
  league_name FROM league_invites li JOIN leagues l ON l.id = li.league_id JOIN "user" u ON true
  WHERE li.status='pending' AND (lower(li.identifier) = lower(u.username) OR lower(li.identifier)
  = lower(u.email)) AND u.id = $1`. Used by Dashboard.
- `POST /api/invites/[id]/accept` — `requireAuth`. Load the invite, verify its `identifier`
  actually matches the calling user's username or email (authorization — don't trust the client),
  verify still `pending`. Then do exactly what `POST /api/leagues/join` does (add via
  `StateLogic.addPlayer`, or via Feature C's reclaim path if a match exists — see below), insert
  the `league_memberships` row, mark the invite `accepted` + `responded_at = now()`.
  **Refactor note**: extract the actual "add this user to this league" logic out of
  `src/app/api/leagues/join/route.ts` into a shared helper (e.g.
  `src/lib/server/join-league.ts`'s `joinLeague(leagueId, user)`) so both the join-by-code route
  and this accept-invite route call the same code instead of duplicating it.
- `POST /api/invites/[id]/decline` — `requireAuth`, same identity check, mark `declined`.

### Frontend

1. **Sending invites** — new section in League Settings: `src/components/setup/invites-section.tsx`
   (add to `src/components/setup/setup-tab.tsx`'s render list). Any member (`useCanManage()` is
   commissioner-only, don't reuse that gate here — this needs a plain "is a member of this
   league" check, which every visitor to League Settings already is) sees: an identifier input +
   "Send Invite" button, and a list of this league's invites (pending/accepted/declined) with a
   "Revoke" button on pending ones they sent (or any pending one, if commissioner).
2. **Receiving invites** — Feature A's Dashboard shows a "You're invited" panel above the join/
   create panels when `api.me().invites` (or a dedicated `api.myInvites()` call) is non-empty:
   league name, who invited you (denormalize the inviter's username into the response, or a
   second join), Accept/Decline buttons.
3. `src/lib/api.ts` additions: `sendInvite(leagueId, identifier)`, `listLeagueInvites(leagueId)`,
   `revokeInvite(leagueId, inviteId)`, `myInvites()`, `acceptInvite(inviteId)`,
   `declineInvite(inviteId)`.

**Verification**: fixture user A creates a league, invites fixture user B by username (not yet
signed up) — confirm the invite row exists; sign up user B, call `/api/me/invites`, confirm it
shows up; accept it, confirm membership created and invite marked accepted; separately verify
inviting by email works too, and that a non-matching third user sees no invite.

---

## Feature C: Disabled-player reclaim

**Problem** (confirmed, not assumed): today, disabling a player (self-serve leave, or admin
delete-user) renames them to a random `disabled_player_####` and deletes the `league_memberships`
row, with nothing left to reconnect that seat to the same account if they come back. Roster/points
history is preserved (that part already works), but there's no way to *reclaim* it.

### `state-logic.js` changes

`RosterLogic.disablePlayer` (around line 261) currently:

```js
static disablePlayer(state, playerId){
  const p = Core.getPlayer(state, playerId);
  if(!p) return null;
  const suffix = Math.floor(1000 + Math.random()*9000);
  p.name = 'disabled_player_' + suffix;
  p.disabled = true;
  return p;
}
```

Change to accept the account id and preserve the original name for later restoration:

```js
static disablePlayer(state, playerId, disabledFromUserId){
  const p = Core.getPlayer(state, playerId);
  if(!p) return null;
  const suffix = Math.floor(1000 + Math.random()*9000);
  p.formerName = p.name;
  p.name = 'disabled_player_' + suffix;
  p.disabled = true;
  if(disabledFromUserId) p.disabledFromUserId = disabledFromUserId;
  return p;
}
```

Add a new method to reverse it:

```js
// Restores a disabled player's original name/active status when the same account (matched by
// disabledFromUserId, not name -- names are guessable, account ids aren't) rejoins the league.
// Does NOT touch ownerId/status/placementOrder/points -- those were never cleared by
// disablePlayer, so there's nothing to restore there; this only undoes the disable/rename.
static reclaimPlayer(state, playerId){
  const p = Core.getPlayer(state, playerId);
  if(!p || !p.disabled) return null;
  p.name = p.formerName || p.name;
  delete p.formerName;
  delete p.disabledFromUserId;
  p.disabled = false;
  return p;
}
```

Add both to the flat-alias export block (`disablePlayer` is already there; add `reclaimPlayer:
RosterLogic.reclaimPlayer`) and to `state-logic.d.ts`'s ambient types (`disablePlayer` gains a
third optional `disabledFromUserId?: string` param; add `reclaimPlayer(state, playerId): Player |
null`).

Add `formerName?: string` and `disabledFromUserId?: string` to the `Castaway`... **no** — check
carefully: `disablePlayer` operates on **players** (`state.players[]`), not castaways. Add those
two optional fields to the `Player` interface in `src/lib/game/types.ts`, not `Castaway`.

### Route changes

Both call sites that currently call `StateLogic.disablePlayer(state, playerId)` need the account
id added as a third argument:

- `src/app/api/leagues/[leagueId]/leave/route.ts`: change
  `StateLogic.disablePlayer(state, playerId)` to `StateLogic.disablePlayer(state, playerId,
  user.id)` (the `user` from `requireAuth(req)` is already in scope there).
- `src/app/api/admin/users/[userId]/route.ts` (the DELETE handler): change
  `StateLogic.disablePlayer(state, m.player_id)` to `StateLogic.disablePlayer(state, m.player_id,
  userId)` (the `userId` being deleted — it's their own former seat).

The join logic (in the new shared `joinLeague()` helper from Feature B, and reused by both
`POST /api/leagues/join` and `POST /api/invites/[id]/accept`) needs a reclaim check inserted before
falling back to `StateLogic.addPlayer`:

```js
const disabledOwn = state.players.find(p => p.disabled && p.disabledFromUserId === user.id);
if (disabledOwn) {
  StateLogic.reclaimPlayer(state, disabledOwn.id);
  playerId = disabledOwn.id; // use this instead of a newly-created player's id for the membership insert
} else {
  const newPlayer = StateLogic.addPlayer(state, user.username || user.name);
  playerId = newPlayer.id;
}
```

No confirmation dialog needed before reclaiming — it's matched by real account id (not a guessable
name), so there's no ambiguity to resolve with the user. Do surface it after the fact though: have
the join/accept-invite response include a `reclaimed: boolean` flag so the frontend can show
"Welcome back — your previous roster has been restored" instead of a generic "You joined!" toast.

**Verification**: fixture user joins a league, gets some castaways drafted/eliminated (a couple of
points), leaves after the draft has started (so `disablePlayer` runs, not `removePlayer`), confirm
the player row now has `disabled:true`, `formerName` set, `disabledFromUserId` set. Rejoin via the
same join code — confirm the SAME player id is reused (not a new one), `disabled:false`, original
name restored, and prior points/roster untouched. Repeat once via the admin-delete-account path
instead of self-serve leave.

---

## Feature D: Admin table UI overhaul

**Already mostly unblocked by existing work** — `src/components/admin/admin-tab.tsx` already has
client-side pagination (20/page) and Impersonate/Reset Password/Delete buttons per user, backed by
`src/app/api/admin/users/*` routes already calling Better Auth's `admin` plugin. What's missing:
sortable columns, a real "last login" column, and an edit modal for email/username/league
management (league management itself — remove a member, change their role — already has working
routes, `adminLinkMembership`'s upsert already handles "change role").

### "Last login" without a new column

Better Auth's own `session` table already gets a new row on every sign-in, with its own
`createdAt`. No new column needed — just a raw SQL query alongside the `admin.listUsers()` call:

```sql
SELECT "userId", MAX("createdAt") as last_login_at FROM session GROUP BY "userId"
```

In `src/app/api/admin/users/route.ts`'s `GET` handler, after getting `result.users` from
`auth.api.listUsers(...)`, run this query via the existing `pool` (`src/lib/server/db.ts`) and
merge `lastLoginAt` onto each `AdminUser` by matching `id`. Add `lastLoginAt: string | null` to the
`AdminUser` interface in `src/lib/game/types.ts`.

### Change email / change username

`src/app/api/admin/users/[userId]/route.ts` gets a new `PATCH` handler alongside the existing
`DELETE`:

```ts
export const PATCH = apiRoute(async (req, { params }) => {
  await requireSuperAdmin(req);
  const { userId } = await params;
  const { username, email } = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (username !== undefined) data.username = username;
  if (email !== undefined) data.email = email;
  const result = await auth.api.adminUpdateUser({ body: { userId, data }, headers: req.headers });
  return NextResponse.json({ user: toAdminUser(result.user) });
});
```

Verify `auth.api.adminUpdateUser`'s exact body/response shape against
`node_modules/better-auth/dist/plugins/admin/routes.mjs` before writing this (it existed and was
noted during the admin-routes build-out, but its precise validation behavior for `email` specifically
— e.g. does it re-check uniqueness, does it require re-verification — wasn't exercised). Add
`api.adminUpdateUser(userId, {username?, email?})` to `src/lib/api.ts`.

### Sortable table + edit modal (frontend only)

1. `admin-tab.tsx`: add local sort state (`sortBy: 'username'|'email'|'createdAt'|'lastLoginAt'`,
   `sortDir: 'asc'|'desc'`), sort `users` before the existing pagination slice. Make each column
   header a clickable button toggling sort.
2. New `src/components/admin/user-edit-modal.tsx` — opened via a new "Edit" button per row
   (alongside the existing Impersonate button, which stays as its own one-click action since it's
   used often enough to deserve not being buried in a modal). Modal contents: username field,
   email field, "Save" (calls the new `adminUpdateUser`), a "Reset Password" button (existing
   route), a "Leagues" section listing this user's leagues (`api.adminUserLeagues`) each with a
   role dropdown (calls `api.adminLinkMembership` with the same player id + new role — the upsert
   already supports this) and a "Remove" button (`api.adminUnlinkMembership`), and a "Delete
   Account" button at the bottom reusing the existing two-part-warning flow from `admin-store.ts`.

**Verification**: Puppeteer screenshot of the sorted table (click a column header, confirm order
changes) and the edit modal open with real data populated; real-API check of the new PATCH route
changing a fixture user's username and email; confirm last-login shows a real timestamp after that
user signs in once.

---

## Suggested execution order

Reclaim (C) touches the same `join` code path Invites (B) needs, so do **C's `state-logic.js`
changes first**, then **B** (which reuses C's reclaim check inside the new shared `joinLeague()`
helper), then **A** (which is mostly UI, consumes B's `/api/me/invites`), then **D** (fully
independent of the other three, can be done in any order relative to them — could even go first if
preferred).

Commit and verify each feature independently (matching the rest of this project's history — one
feature, build+lint+real-API-check, one commit), not as a single giant change.
