"use client";

import { useState } from "react";
import { changePassword } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSaving(true);
    try {
      const result = await changePassword({ currentPassword: current, newPassword: next });
      if (result.error) setError(result.error.message || "Couldn't change your password.");
      else {
        setSaved(true);
        setCurrent("");
        setNext("");
        setConfirm("");
      }
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-[18px_20px] shadow-sm">
      <h3 className="mb-3 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Password</h3>
      <form onSubmit={save}>
        {/* w-full on each field -- see profile-section.tsx's note. Without it these were
            ~20-character boxes and "Change password" wrapped onto the same line as the last one. */}
        <label className="mb-2 block text-xs font-semibold text-muted-foreground">Current password</label>
        <Input className="mb-3 w-full" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <label className="mb-2 block text-xs font-semibold text-muted-foreground">New password</label>
        <Input className="mb-3 w-full" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        <label className="mb-2 block text-xs font-semibold text-muted-foreground">Confirm new password</label>
        <Input className="mb-3 w-full" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {error && <p className="mb-2 text-sm font-semibold text-destructive">{error}</p>}
        {saved && <p className="mb-2 text-sm font-semibold text-good">Password changed.</p>}
        <div>
          <Button type="submit" disabled={saving || !current || !next || !confirm}>
            {saving ? "Saving…" : "Change password"}
          </Button>
        </div>
      </form>
    </div>
  );
}
