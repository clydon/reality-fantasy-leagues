"use client";

import { useEffect, useState } from "react";
import { useIsSuperAdmin, useLeagueStore } from "@/lib/store";
import { useAdminStore } from "@/lib/admin-store";
import { LinkMembershipForm } from "./link-membership-form";
import { Button } from "@/components/ui/button";

// Direct port of renderAdmin() (public/app.js). Unlike every other tab, Admin has NO mock-mode
// equivalent -- the live app never shows its nav link to non-super-admins at all, demo mode
// included -- so this component's first job is replicating that gate, not just its content.
export function AdminTab() {
  const isSuperAdmin = useIsSuperAdmin();
  const mode = useLeagueStore((s) => s.mode);
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
  } = useAdminStore();
  const [newUsername, setNewUsername] = useState("");
  const [linkingPlayerId, setLinkingPlayerId] = useState<string | null>(null);

  useEffect(() => {
    if (isSuperAdmin && !loaded) load();
  }, [isSuperAdmin, loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  if (mode === "mock" || !isSuperAdmin) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <h2 className="mb-4 text-2xl font-bold tracking-tight">Admin</h2>
        <p className="text-sm text-muted-foreground">
          Admin is only available when signed in as a real super-admin account — same as the live app, which never
          shows this nav link to anyone else, demo mode included.
        </p>
      </div>
    );
  }

  async function handleCreateUser() {
    const username = newUsername.trim();
    if (!username) return;
    setNewUsername("");
    await createUser(username);
  }

  const selectedLeague = leagues.find((l) => l.id === selectedLeagueId);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h2 className="mb-4 text-2xl font-bold tracking-tight">Admin</h2>

      {lastTempPassword && (
        <div className="mb-4 rounded-lg border border-good/40 bg-good/10 p-4">
          <h3 className="mb-1 text-sm font-bold text-good">Temp password for &ldquo;{lastTempPassword.username}&rdquo;</h3>
          <p className="mb-2 text-sm">
            Give this to them directly (it won&rsquo;t be shown again): <code className="rounded bg-card px-1.5 py-0.5">{lastTempPassword.password}</code>
          </p>
          <button className="rounded border border-border px-2.5 py-1 text-xs" onClick={dismissTempPassword}>
            Dismiss
          </button>
        </div>
      )}

      <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
        <h3 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Users</h3>
        <div className="flex flex-col gap-2">
          {users.map((u) => (
            <div key={u.id} className="rounded-md border border-border p-2.5">
              <div className="mb-1.5 flex flex-wrap items-center gap-2 text-sm">
                <span className="flex-1 font-semibold">
                  {u.username}
                  {u.is_super_admin && <span className="ml-1 font-normal text-muted-foreground">(super-admin)</span>}
                </span>
                {u.must_change_password && <span className="text-xs text-muted-foreground">must change password</span>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button className="rounded border border-border px-2 py-0.5 text-xs" onClick={() => resetPassword(u.id, u.username)}>
                  Reset Password
                </button>
                <button
                  className="rounded border border-destructive/40 px-2 py-0.5 text-xs text-destructive"
                  onClick={() => deleteUser(u.id, u.username)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-1.5">
          <input
            className="min-w-0 flex-1 rounded border border-border bg-card px-2 py-1 text-sm"
            placeholder="New username"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateUser()}
          />
          <Button onClick={handleCreateUser}>Create User</Button>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
        <h3 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Leagues</h3>
        {leagues.length === 0 ? (
          <div className="text-sm italic text-muted-foreground">No leagues yet.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {leagues.map((l) => (
              <div key={l.id} className="rounded-md border border-border p-2.5">
                <div className="mb-1.5 text-sm font-semibold">{l.name}</div>
                <div className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                  code: <b>{l.join_code}</b>
                  <button className="rounded border border-border px-2 py-0.5" onClick={() => toggleLeague(l.id)}>
                    {selectedLeagueId === l.id ? "Hide Memberships" : "View Memberships"}
                  </button>
                </div>
                <button
                  className="rounded border border-destructive/40 px-2 py-0.5 text-xs text-destructive"
                  onClick={() => deleteLeague(l.id, l.name)}
                >
                  Delete League
                </button>
              </div>
            ))}
          </div>
        )}
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
                          <button className="rounded border border-border px-2 py-0.5 text-xs" onClick={() => setLinkingPlayerId(p.id)}>
                            {m ? "Change" : "Link Account"}
                          </button>
                        )}
                        {m && (
                          <button className="rounded border border-destructive/40 px-2 py-0.5 text-xs text-destructive" onClick={() => unlinkMembership(m.id)}>
                            Unlink
                          </button>
                        )}
                        {!p.disabled && (
                          <button
                            className="rounded border border-destructive/40 px-2 py-0.5 text-xs text-destructive"
                            onClick={() => deletePlayer(p.id, p.name)}
                          >
                            Delete Player
                          </button>
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
    </div>
  );
}
