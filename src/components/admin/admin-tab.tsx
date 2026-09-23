"use client";

import { useEffect, useState } from "react";
import { useIsSuperAdmin, useLeagueStore } from "@/lib/store";
import { useAdminStore } from "@/lib/admin-store";
import { LinkMembershipForm } from "./link-membership-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Direct port of renderAdmin() (public/app.js). Unlike every other tab, Admin has NO mock-mode
// equivalent -- the live app never shows its nav link to non-super-admins at all, demo mode
// included -- so this component's first job is replicating that gate, not just its content.
//
// Gated on isSuperAdmin alone, NOT `mode === 'mock'` -- an earlier version also checked mode,
// which incorrectly blocked a real signed-in super-admin with no personal league (mode only
// becomes 'live' once a league loads; a league-less super-admin stays 'mock' despite being
// genuinely authenticated). isSuperAdmin is already a reliable real-auth signal on its own: it's
// only ever set via a real setIdentity()/loadLive() call, and useMock() explicitly clears it.
export function AdminTab() {
  const isSuperAdmin = useIsSuperAdmin();
  const {
    users,
    leagues,
    selectedLeagueId,
    membershipData,
    loaded,
    lastTempPassword,
    load,
    toggleLeague,
    createUser,
    resetPassword,
    deleteUser,
    deleteLeague,
    unlinkMembership,
    deletePlayer,
    dismissTempPassword,
    impersonateUser,
  } = useAdminStore();
  const myUserId = useLeagueStore((s) => s.userId);
  const [newUsername, setNewUsername] = useState("");
  const [linkingPlayerId, setLinkingPlayerId] = useState<string | null>(null);
  const [userPage, setUserPage] = useState(0);
  const [leaguePage, setLeaguePage] = useState(0);
  const PAGE_SIZE = 20;

  useEffect(() => {
    if (isSuperAdmin && !loaded) load();
  }, [isSuperAdmin, loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isSuperAdmin) {
    return (
      <>
        <h2 className="mb-[18px] text-2xl font-bold tracking-tight">Admin</h2>
        <p className="text-sm text-muted-foreground">
          Admin is only available when signed in as a real super-admin account — same as the live app, which never
          shows this nav link to anyone else, demo mode included.
        </p>
      </>
    );
  }

  async function handleCreateUser() {
    const username = newUsername.trim();
    if (!username) return;
    setNewUsername("");
    await createUser(username);
  }

  const selectedLeague = leagues.find((l) => l.id === selectedLeagueId);
  const userPageCount = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const clampedUserPage = Math.min(userPage, userPageCount - 1);
  const pagedUsers = users.slice(clampedUserPage * PAGE_SIZE, (clampedUserPage + 1) * PAGE_SIZE);
  const leaguePageCount = Math.max(1, Math.ceil(leagues.length / PAGE_SIZE));
  const clampedLeaguePage = Math.min(leaguePage, leaguePageCount - 1);
  const pagedLeagues = leagues.slice(clampedLeaguePage * PAGE_SIZE, (clampedLeaguePage + 1) * PAGE_SIZE);

  return (
    <>
      <h2 className="mb-[18px] text-2xl font-bold tracking-tight">Admin</h2>

      {lastTempPassword && (
        <div className="mb-4 rounded-lg border border-good/40 bg-good/10 p-4">
          <h3 className="mb-1 text-sm font-bold text-good">Temp password for &ldquo;{lastTempPassword.username}&rdquo;</h3>
          <p className="mb-2 text-sm">
            Give this to them directly (it won&rsquo;t be shown again): <code className="rounded bg-card px-1.5 py-0.5">{lastTempPassword.password}</code>
          </p>
          <Button variant="secondary" size="sm" onClick={dismissTempPassword}>
            Dismiss
          </Button>
        </div>
      )}

      <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
        <h3 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">
          Users {users.length > 0 && <span className="font-normal normal-case">({users.length})</span>}
        </h3>
        <div className="flex flex-col gap-2">
          {pagedUsers.map((u) => (
            <div key={u.id} className="rounded-md border border-border p-2.5">
              <div className="mb-1.5 flex flex-wrap items-center gap-2 text-sm">
                <span className="flex-1 font-semibold">
                  {u.username}
                  {u.is_super_admin && <span className="ml-1 font-normal text-muted-foreground">(super-admin)</span>}
                </span>
                {u.must_change_password && <span className="text-xs text-muted-foreground">must change password</span>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {u.id !== myUserId && (
                  <Button variant="secondary" size="sm" onClick={() => impersonateUser(u.id, u.username)}>
                    Impersonate
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={() => resetPassword(u.id, u.username)}>
                  Reset Password
                </Button>
                {u.id !== myUserId && (
                  <Button variant="destructive" size="sm" onClick={() => deleteUser(u.id, u.username)}>
                    Delete
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
        <Pager page={clampedUserPage} setPage={setUserPage} pageCount={userPageCount} />
        <div className="mt-3 flex gap-1.5">
          <Input
            className="min-w-0 flex-1 text-sm"
            placeholder="New username"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateUser()}
          />
          <Button onClick={handleCreateUser}>Create User</Button>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
        <h3 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">
          Leagues {leagues.length > 0 && <span className="font-normal normal-case">({leagues.length})</span>}
        </h3>
        {leagues.length === 0 ? (
          <div className="text-sm italic text-muted-foreground">No leagues yet.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {pagedLeagues.map((l) => (
              <div key={l.id} className="rounded-md border border-border p-2.5">
                <div className="mb-1.5 text-sm font-semibold">{l.name}</div>
                <div className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                  code: <b>{l.join_code}</b>
                  <Button variant="secondary" size="sm" onClick={() => toggleLeague(l.id)}>
                    {selectedLeagueId === l.id ? "Hide Memberships" : "View Memberships"}
                  </Button>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteLeague(l.id, l.name)}
                >
                  Delete League
                </Button>
              </div>
            ))}
          </div>
        )}
        <Pager page={clampedLeaguePage} setPage={setLeaguePage} pageCount={leaguePageCount} />
      </div>

      {selectedLeagueId && membershipData && (
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-1 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">
            Players &amp; Accounts — {selectedLeague?.name}
          </h3>
          <p className="mb-3 text-sm text-muted-foreground">
            Each player can be linked to one user account. The commissioner is a normal drafting player too — just
            give their link the &ldquo;commissioner&rdquo; role.
          </p>
          <div className="flex flex-col gap-2">
            {membershipData.players.map((p) => {
              const m = membershipData.memberships.find((mm) => mm.player_id === p.id);
              const linking = linkingPlayerId === p.id;
              return (
                <div key={p.id}>
                  <div className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2.5 text-sm">
                    <span className="flex-1">
                      {p.name}
                      {p.disabled && <span className="text-muted-foreground"> (disabled)</span>}
                    </span>
                    {m ? (
                      <>
                        <span className="rounded bg-secondary px-1.5 py-0.5 text-xs">{m.role}</span>
                        <span className="text-xs text-muted-foreground">{m.username}</span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not linked to an account</span>
                    )}
                    {!linking && (
                      <>
                        {!p.disabled && (
                          <Button variant="secondary" size="sm" onClick={() => setLinkingPlayerId(p.id)}>
                            {m ? "Change" : "Link Account"}
                          </Button>
                        )}
                        {m && (
                          <Button variant="destructive" size="sm" onClick={() => unlinkMembership(m.id)}>
                            Unlink
                          </Button>
                        )}
                        {!p.disabled && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deletePlayer(p.id, p.name)}
                          >
                            Delete Player
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                  {linking && (
                    <LinkMembershipForm player={p} existing={m} users={users} onCancel={() => setLinkingPlayerId(null)} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

// Client-side only (no backend pagination support, and none needed yet) -- keeps the Users/
// Leagues lists from becoming one huge scrolling page as the real user/league count grows past
// friend-group scale.
function Pager({ page, setPage, pageCount }: { page: number; setPage: (p: number) => void; pageCount: number }) {
  if (pageCount <= 1) return null;
  return (
    <div className="mt-3 flex items-center justify-center gap-3 text-xs text-muted-foreground">
      <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
        ← Prev
      </Button>
      <span>
        Page {page + 1} of {pageCount}
      </span>
      <Button variant="secondary" size="sm" disabled={page >= pageCount - 1} onClick={() => setPage(page + 1)}>
        Next →
      </Button>
    </div>
  );
}
