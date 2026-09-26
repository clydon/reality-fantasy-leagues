"use client";

import { useEffect, useState } from "react";
import { useIsSuperAdmin, useLeagueStore } from "@/lib/store";
import { useAdminStore } from "@/lib/admin-store";
import { LinkMembershipForm } from "./link-membership-form";
import { UserEditModal } from "./user-edit-modal";
import { ShowsSection } from "./shows-section";
import type { AdminUser } from "@/lib/game/types";
import { cn } from "cn";
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
    lastTempPassword,
    load,
    toggleLeague,
    createUser,
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
  const [sortBy, setSortBy] = useState<SortKey>("username");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const PAGE_SIZE = 20;

  // Reloads every time this tab mounts -- including navigating back to it -- not just the first
  // time. `loaded` lives in the store, which outlives the component, so gating on `!loaded` used to
  // mean every visit after the first showed whatever was fetched then, however stale (a league
  // deleted, a user's role changed, a temp password issued from another tab).
  useEffect(() => {
    if (isSuperAdmin) load();
  }, [isSuperAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isSuperAdmin) {
    return (
      <>
        <h2 className="mb-[18px] text-2xl font-bold tracking-tight max-nav:hidden">Admin</h2>
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

  const editingUser = users.find((u) => u.id === editingUserId) ?? null;
  const sortedUsers = sortUsers(users, sortBy, sortDir);
  const userPageCount = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const clampedUserPage = Math.min(userPage, userPageCount - 1);
  const pagedUsers = sortedUsers.slice(clampedUserPage * PAGE_SIZE, (clampedUserPage + 1) * PAGE_SIZE);

  // Clicking the active column flips direction; a new column starts ascending, except the two
  // dates, where newest-first is almost always what you want.
  function toggleSort(key: SortKey) {
    if (key === sortBy) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir(key === "createdAt" || key === "lastLoginAt" ? "desc" : "asc");
    }
    setUserPage(0);
  }
  const leaguePageCount = Math.max(1, Math.ceil(leagues.length / PAGE_SIZE));
  const clampedLeaguePage = Math.min(leaguePage, leaguePageCount - 1);
  const pagedLeagues = leagues.slice(clampedLeaguePage * PAGE_SIZE, (clampedLeaguePage + 1) * PAGE_SIZE);

  return (
    <>
      <h2 className="mb-[18px] text-2xl font-bold tracking-tight max-nav:hidden">Admin</h2>

      {/* Catalog config rather than per-account admin, and what a fresh install needs set up first,
          so it sits above the users/leagues tables. */}
      <ShowsSection />

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
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[620px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {USER_COLUMNS.map((col) => (
                  <th key={col.key} className="px-2 py-1.5 font-normal">
                    <button
                      className={cn(
                        "flex items-center gap-1 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground",
                        sortBy === col.key && "text-foreground"
                      )}
                      onClick={() => toggleSort(col.key)}
                    >
                      {col.label}
                      <span className={cn("text-[0.65rem]", sortBy !== col.key && "invisible")}>{sortDir === "asc" ? "▲" : "▼"}</span>
                    </button>
                  </th>
                ))}
                <th className="px-2 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {pagedUsers.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-b-0">
                  <td className="px-2 py-2 font-semibold">
                    {u.username || <span className="font-normal italic text-muted-foreground">none</span>}
                    {u.isSuperAdmin && <span className="ml-1 text-xs font-normal text-muted-foreground">(super-admin)</span>}
                  </td>
                  <td className="max-w-[200px] truncate px-2 py-2 text-xs text-muted-foreground">{u.email}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-xs text-muted-foreground">{formatDate(u.createdAt)}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-xs text-muted-foreground">{u.lastLoginAt ? formatDate(u.lastLoginAt) : "Never"}</td>
                  <td className="px-2 py-2">
                    <div className="flex justify-end gap-1.5">
                      {u.id !== myUserId && (
                        <Button variant="secondary" size="sm" onClick={() => impersonateUser(u.id, u.username || u.email)}>
                          Impersonate
                        </Button>
                      )}
                      <Button variant="secondary" size="sm" onClick={() => setEditingUserId(u.id)}>
                        Edit
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
            {pagedLeagues.map((l) => {
              const open = selectedLeagueId === l.id;
              return (
                <div key={l.id} className="rounded-md border border-border">
                  {/* One compact line per league; its members open right underneath it rather than at
                      the bottom of the page, where they used to land far from the league clicked. */}
                  <div className="flex flex-wrap items-center gap-2 p-2.5">
                    <span className="text-sm font-semibold">{l.name}</span>
                    <span className="text-xs text-muted-foreground">
                      code <b>{l.join_code}</b>
                    </span>
                    <span className="ml-auto flex gap-1.5">
                      <Button variant="secondary" size="sm" onClick={() => toggleLeague(l.id)}>
                        {open ? "Hide members" : "Members"}
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => deleteLeague(l.id, l.name)}>
                        Delete
                      </Button>
                    </span>
                  </div>
                  {open && membershipData && (
                    <div className="border-t border-border p-2.5">
                      <p className="mb-2 text-xs text-muted-foreground">
                        Each player can be linked to one account; give the commissioner&rsquo;s link the
                        &ldquo;commissioner&rdquo; role.
                      </p>
                      <div className="flex flex-col gap-2">
                        {membershipData.players.map((p) => {
                          const m = membershipData.memberships.find((mm) => mm.player_id === p.id);
                          const linking = linkingPlayerId === p.id;
                          return (
                            <div key={p.id}>
                              <div className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2 text-sm">
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
                                  <span className="text-xs text-muted-foreground">Not linked</span>
                                )}
                                {!linking && (
                                  <>
                                    {!p.disabled && (
                                      <Button variant="secondary" size="sm" onClick={() => setLinkingPlayerId(p.id)}>
                                        {m ? "Change" : "Link account"}
                                      </Button>
                                    )}
                                    {m && (
                                      <Button variant="destructive" size="sm" onClick={() => unlinkMembership(m.id)}>
                                        Unlink
                                      </Button>
                                    )}
                                    {!p.disabled && (
                                      <Button variant="destructive" size="sm" onClick={() => deletePlayer(p.id, p.name)}>
                                        Delete player
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
                </div>
              );
            })}
          </div>
        )}
        <Pager page={clampedLeaguePage} setPage={setLeaguePage} pageCount={leaguePageCount} />
      </div>

      {editingUser && <UserEditModal user={editingUser} isSelf={editingUser.id === myUserId} onClose={() => setEditingUserId(null)} />}

    </>
  );
}

type SortKey = "username" | "email" | "createdAt" | "lastLoginAt";

const USER_COLUMNS: { key: SortKey; label: string }[] = [
  { key: "username", label: "Username" },
  { key: "email", label: "Email" },
  { key: "createdAt", label: "Created" },
  { key: "lastLoginAt", label: "Last login" },
];

// Nulls (no username / never signed in) always sort last, whichever direction.
function sortUsers(users: AdminUser[], key: SortKey, dir: "asc" | "desc"): AdminUser[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...users].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    // ISO timestamps compare correctly as strings, so one comparison covers every column.
    return sign * av.localeCompare(bv, undefined, { sensitivity: "base" });
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
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
