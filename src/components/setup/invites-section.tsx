"use client";

import { useEffect, useState } from "react";
import type { LeagueInvite } from "@/lib/game/types";
import { useLeagueStore } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import { BottomSheet, SheetAction } from "@/components/ui/bottom-sheet";
import { Chip, Field, MoreButton, PrimaryButton, fieldCls } from "./settings-ui";

// The invite half of League Settings > Players & invites (the canvas's "Settings-Players"): an invite
// field, then one row per invite with its status and a ⋯ sheet for Revoke. Any member can invite, not
// just the commissioner -- so this deliberately doesn't gate on useCanManage(). Revoking a pending
// invite is limited to whoever sent it, or the commissioner (enforced server-side too). Live-only:
// invites live in their own table, there's nothing to invite anyone to in demo mode.
export function InvitesSection() {
  const mode = useLeagueStore((s) => s.mode);
  const leagueId = useLeagueStore((s) => s.leagueId);
  const userId = useLeagueStore((s) => s.userId);
  const isCommissioner = useLeagueStore((s) => s.membership?.role === "commissioner");
  const players = useLeagueStore((s) => s.state.players);
  const [invites, setInvites] = useState<LeagueInvite[]>([]);
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sheetFor, setSheetFor] = useState<LeagueInvite | null>(null);

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

  // A hand-over invite (sent from a player's sheet) names the seat it offers.
  const seatName = (inv: LeagueInvite) => (inv.player_id ? players.find((p) => p.id === inv.player_id)?.name : null);

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
    setSheetFor(null);
    try {
      await api.revokeInvite(leagueId!, invite.id);
      setInvites((list) => list.filter((i) => i.id !== invite.id));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Could not revoke the invite.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        <Field
          label="Invite by username or email"
          htmlFor="invite-id"
          hint="No account yet? The invite waits for them to sign up with that username or email."
        >
          <div className="flex gap-2">
            <input
              id="invite-id"
              className={`${fieldCls} min-w-0 flex-1`}
              placeholder="name@example.com"
              autoComplete="off"
              autoCapitalize="none"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
            <PrimaryButton type="submit" disabled={sending || !identifier.trim()}>
              {sending ? "Sending…" : "Invite"}
            </PrimaryButton>
          </div>
        </Field>
      </form>
      {error && <p className="text-sm font-semibold text-live">{error}</p>}
      {invites.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {invites.map((inv) => {
            const canRevoke = inv.status === "pending" && (inv.invited_by === userId || isCommissioner);
            const seat = seatName(inv);
            return (
              <div key={inv.id} className="flex min-h-12 items-center gap-2.5 rounded-[3px] bg-card pl-3.5 pr-1">
                <span className="flex min-w-0 flex-1 flex-col py-1.5">
                  <span className="truncate text-[15px] font-semibold">{inv.identifier}</span>
                  <span className="truncate text-[13px] text-muted-foreground">
                    {[seat && `to take over ${seat}`, `from ${inv.invited_by_username ?? "unknown"}`].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <Chip tone={inv.status === "pending" ? "chyron" : "quiet"}>{inv.status}</Chip>
                {canRevoke ? (
                  <MoreButton label={`Options for the invite to ${inv.identifier}`} onClick={() => setSheetFor(inv)} />
                ) : (
                  <span className="w-2" />
                )}
              </div>
            );
          })}
        </div>
      )}
      {sheetFor && (
        <BottomSheet open onOpenChange={(o) => !o && setSheetFor(null)} title={sheetFor.identifier} description="Invite pending">
          <SheetAction danger onClick={() => handleRevoke(sheetFor)}>
            Revoke invite
          </SheetAction>
        </BottomSheet>
      )}
    </div>
  );
}
