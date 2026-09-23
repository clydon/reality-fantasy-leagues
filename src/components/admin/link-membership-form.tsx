"use client";

import { useState } from "react";
import type { AdminUser, AdminMembership, Player } from "@/lib/game/types";
import { useAdminStore } from "@/lib/admin-store";

// Port of the inline "link/re-link a player to an account" form inside renderAdmin()
// (public/app.js). adminLinkingPlayerId (a single global tracking which row is open) becomes
// this component's own presence/absence -- AdminTab only mounts one of these at a time already.
export function LinkMembershipForm({
  player,
  existing,
  users,
  onCancel,
}: {
  player: Player;
  existing: AdminMembership | undefined;
  users: AdminUser[];
  onCancel: () => void;
}) {
  const [userId, setUserId] = useState(existing?.user_id ?? "");
  const [role, setRole] = useState<"member" | "commissioner">(existing?.role ?? "member");
  const linkMembership = useAdminStore((s) => s.linkMembership);
  const membershipData = useAdminStore((s) => s.membershipData);

  async function save() {
    if (!userId) return;
    await linkMembership(player.id, userId, role);
    onCancel();
  }

  return (
    <div className="mb-2 rounded-lg border border-dashed border-border bg-secondary/40 p-3">
      <p className="mb-2 text-sm text-muted-foreground">
        {existing ? `Re-link "${player.name}" to:` : `Link "${player.name}" to:`}
      </p>
      <div className="flex flex-wrap gap-2">
        <select className="rounded border border-border bg-card px-2 py-1 text-sm" value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">— select user —</option>
          {users.map((u) => {
            const existingFor = membershipData?.memberships.find((mm) => mm.user_id === u.id);
            const note =
              existingFor && existingFor.player_id !== player.id
                ? ` (currently: ${membershipData?.players.find((pp) => pp.id === existingFor.player_id)?.name || "?"})`
                : "";
            return (
              <option key={u.id} value={u.id}>
                {u.username}
                {note}
              </option>
            );
          })}
        </select>
        <select className="rounded border border-border bg-card px-2 py-1 text-sm" value={role} onChange={(e) => setRole(e.target.value as "member" | "commissioner")}>
          <option value="member">member</option>
          <option value="commissioner">commissioner</option>
        </select>
        <button className="rounded bg-primary px-2.5 py-1 text-sm font-semibold text-primary-foreground" onClick={save}>
          Save
        </button>
        <button className="rounded border border-border px-2.5 py-1 text-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
