"use client";

import { useEffect, useState } from "react";
import type { AdminUser } from "@/lib/game/types";
import { api, ApiError } from "@/lib/api";
import { useAdminStore } from "@/lib/admin-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type UserLeague = Awaited<ReturnType<typeof api.adminUserLeagues>>["leagues"][number];

const LABEL = "mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground";
const SECTION_TITLE = "mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground";

// Everything per-account that isn't a one-click action (Impersonate stays on the row itself):
// username/email, password reset, league memberships (role change via adminLinkMembership's
// upsert with the same player id; remove via adminUnlinkMembership), and account deletion via
// the same two-confirm flow as before (admin-store's deleteUser).
export function UserEditModal({ user, isSelf, onClose }: { user: AdminUser; isSelf: boolean; onClose: () => void }) {
  const { updateUser, resetPassword, deleteUser, lastTempPassword } = useAdminStore();
  const [username, setUsername] = useState(user.username ?? "");
  const [email, setEmail] = useState(user.email);
  const [leagues, setLeagues] = useState<UserLeague[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const label = user.username || user.email;

  async function reloadLeagues() {
    const r = await api.adminUserLeagues(user.id);
    setLeagues(r.leagues);
  }

  useEffect(() => {
    let cancelled = false;
    api
      .adminUserLeagues(user.id)
      .then((r) => !cancelled && setLeagues(r.leagues))
      .catch(() => !cancelled && setLeagues([]));
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const changes: { username?: string; email?: string } = {};
      if (username.trim() && username.trim() !== (user.username ?? "")) changes.username = username.trim();
      if (email.trim() && email.trim() !== user.email) changes.email = email.trim();
      if (Object.keys(changes).length === 0) return;
      await updateUser(user.id, changes);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRole(l: UserLeague, role: "member" | "commissioner") {
    setError(null);
    try {
      await api.adminLinkMembership(l.id, user.id, l.player_id, role);
      await reloadLeagues();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not change role.");
    }
  }

  async function handleRemove(l: UserLeague) {
    if (!confirm(`Unlink "${label}" from ${l.name}? Their player seat stays in the league, just no longer tied to this account.`)) return;
    setError(null);
    try {
      await api.adminUnlinkMembership(l.id, l.membership_id);
      await reloadLeagues();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove membership.");
    }
  }

  async function handleDelete() {
    if (await deleteUser(user.id, label)) onClose();
  }

  const dirty = username.trim() !== (user.username ?? "") || email.trim() !== user.email;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-5" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="relative max-h-[90vh] w-full max-w-[480px] overflow-y-auto rounded-lg bg-card p-[22px] shadow-md">
        <button className="absolute right-3.5 top-3.5 p-1 text-muted-foreground hover:text-foreground" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <h3 className="mb-3 text-base font-bold">Edit {label}</h3>

        {error && <p className="mb-2 text-sm text-destructive">{error}</p>}

        <label className={LABEL}>Username</label>
        <Input className="mb-2.5 w-full" value={username} onChange={(e) => setUsername(e.target.value)} />
        <label className={LABEL}>Email</label>
        <Input className="mb-3 w-full" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div className="mb-5 flex items-center gap-2">
          <Button onClick={handleSave} disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save"}
          </Button>
          {saved && !dirty && <span className="text-xs text-good">Saved</span>}
        </div>

        <h4 className={SECTION_TITLE}>Password</h4>
        {lastTempPassword && lastTempPassword.username === label ? (
          <p className="mb-5 text-sm">
            Temp password (won&rsquo;t be shown again): <code className="rounded bg-secondary px-1.5 py-0.5">{lastTempPassword.password}</code>
          </p>
        ) : (
          <Button className="mb-5" variant="secondary" size="sm" onClick={() => resetPassword(user.id, label)}>
            Reset Password
          </Button>
        )}

        <h4 className={SECTION_TITLE}>Leagues</h4>
        <div className="mb-5 flex flex-col gap-1.5">
          {leagues === null ? (
            <span className="text-sm text-muted-foreground">Loading…</span>
          ) : leagues.length === 0 ? (
            <span className="text-sm italic text-muted-foreground">Not in any leagues.</span>
          ) : (
            leagues.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm">
                <span className="min-w-0 flex-1 truncate font-semibold">{l.name}</span>
                <Select size="sm" value={l.role} onChange={(e) => handleRole(l, e.target.value as "member" | "commissioner")}>
                  <option value="member">member</option>
                  <option value="commissioner">commissioner</option>
                </Select>
                <Button variant="destructive" size="sm" onClick={() => handleRemove(l)}>
                  Remove
                </Button>
              </div>
            ))
          )}
        </div>

        {!isSelf && (
          <div className="border-t border-border pt-4">
            <Button variant="destructive" onClick={handleDelete}>
              Delete Account
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
