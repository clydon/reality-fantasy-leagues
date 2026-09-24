"use client";

import { useEffect, useState } from "react";
import type { LeagueInvite } from "@/lib/game/types";
import { useLeagueStore } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirm } from "@/lib/confirm-store";

// Not a port of anything in the live app (which only had join-by-code). Any member can invite,
// not just the commissioner -- so this deliberately doesn't gate on useCanManage(); being able to
// see League Settings for a live league already means you're a member. Revoking a pending invite
// is limited to whoever sent it, or the commissioner (enforced server-side too). Live-only:
// invites live in their own table, there's nothing to invite anyone to in demo mode.
export function InvitesSection() {
  const mode = useLeagueStore((s) => s.mode);
  const leagueId = useLeagueStore((s) => s.leagueId);
  const userId = useLeagueStore((s) => s.userId);
  const isCommissioner = useLeagueStore((s) => s.membership?.role === "commissioner");
  const [invites, setInvites] = useState<LeagueInvite[]>([]);
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (mode !== "live" || !leagueId) return;
    let cancelled = false;
    api
      .listLeagueInvites(leagueId)
      .then((r) => !cancelled && setInvites(r.invites))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mode, leagueId]);

  if (mode !== "live" || !leagueId) return null;

  async function handleSend() {
    const trimmed = identifier.trim();
    if (!trimmed) return;
    setSending(true);
    setError(null);
    try {
      const { invite } = await api.sendInvite(leagueId!, trimmed);
      setInvites((list) => [invite, ...list]);
      setIdentifier("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the invite.");
    } finally {
      setSending(false);
    }
  }

  async function handleRevoke(invite: LeagueInvite) {
    if (!(await confirm(`Revoke the invite to "${invite.identifier}"?`))) return;
    try {
      await api.revokeInvite(leagueId!, invite.id);
      setInvites((list) => list.filter((i) => i.id !== invite.id));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Could not revoke the invite.");
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Invites</h3>
      <p className="mb-2 text-xs text-muted-foreground">
        Invite someone by username or email. If they don&apos;t have an account yet, the invite will be waiting once they
        sign up with that username or email.
      </p>
      <div className="flex gap-1.5">
        <Input
          className="min-w-0 flex-1"
          placeholder="Username or email"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <Button onClick={handleSend} disabled={sending || !identifier.trim()}>
          {sending ? "Sending…" : "Send Invite"}
        </Button>
      </div>
      {error && <p className="mt-1.5 text-sm text-destructive">{error}</p>}
      {invites.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5">
          {invites.map((inv) => {
            const canRevoke = inv.status === "pending" && (inv.invited_by === userId || isCommissioner);
            return (
              <div key={inv.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm">
                <span className="min-w-0 flex-1 truncate font-semibold">{inv.identifier}</span>
                <span className="text-xs text-muted-foreground">from {inv.invited_by_username ?? "unknown"}</span>
                <span
                  className={
                    inv.status === "pending"
                      ? "text-xs font-semibold text-primary"
                      : inv.status === "accepted"
                        ? "text-xs font-semibold text-emerald-700"
                        : "text-xs text-muted-foreground"
                  }
                >
                  {inv.status}
                </span>
                {canRevoke && (
                  <Button variant="secondary" size="sm" onClick={() => handleRevoke(inv)}>
                    Revoke
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
