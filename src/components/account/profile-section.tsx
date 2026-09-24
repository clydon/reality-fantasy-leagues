"use client";

import { useState } from "react";
import { useSession, updateUser } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Display name + username, both editable via Better Auth's /update-user (the username plugin
// hooks into that same endpoint for its own uniqueness/format check -- see
// node_modules/better-auth/dist/plugins/username/index.mjs). Email is shown but not editable
// here: update-user explicitly refuses an email field (BASE_ERROR_CODES.EMAIL_CAN_NOT_BE_UPDATED),
// since changing it is a bigger flow (re-verification) this app doesn't have yet.
export function ProfileSection() {
  const { data: session } = useSession();
  const user = session?.user;
  const [name, setName] = useState(user?.name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!user) return null;

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const result = await updateUser({ name: name.trim(), username: username.trim() });
      if (result.error) setError(result.error.message || "Couldn't save those changes.");
      else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setSaving(false);
    }
  }

  const dirty = name.trim() !== (user.name ?? "") || username.trim() !== (user.username ?? "");

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-[18px_20px] shadow-sm">
      <h3 className="mb-3 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Profile</h3>
      {/* w-full on each field: an <input> is inline-block and sizes itself to ~20 characters by
          default, so these sat narrow next to a full-width Email box and let the Save button ride
          up onto the last field's line. Set here rather than on the shared Input, whose other call
          sites (the admin catalog's `w-16`/`w-20` cells) depend on the intrinsic width. */}
      <label className="mb-2 block text-xs font-semibold text-muted-foreground">Display name</label>
      <Input className="mb-3 w-full" value={name} onChange={(e) => setName(e.target.value)} />
      <label className="mb-2 block text-xs font-semibold text-muted-foreground">Username</label>
      <Input className="mb-3 w-full" value={username} onChange={(e) => setUsername(e.target.value)} />
      <label className="mb-2 block text-xs font-semibold text-muted-foreground">Email</label>
      <p className="mb-3 rounded-md border border-dashed border-border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">{user.email}</p>
      {error && <p className="mb-2 text-sm font-semibold text-destructive">{error}</p>}
      {saved && <p className="mb-2 text-sm font-semibold text-good">Saved.</p>}
      <Button disabled={!dirty || saving || !name.trim() || !username.trim()} onClick={save}>
        {saving ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}
