"use client";

import { useEffect, useState } from "react";
import type { LeagueInvite, LeagueState, Player } from "@/lib/game/types";
import { useCanManage, useLeagueStore, useMyPlayerId } from "@/lib/store";
import { api } from "@/lib/api";
import { cn } from "cn";
import { YouBadge } from "@/components/draft/draft-teams";
import { DashAside, DashCard } from "./dash-card";

// Before the draft (docs/PLAN-ux-declutter.md; the canvas's "A2 · Overview", Classic before the
// draft): everyone in pick order and whether they've joined, in place of Standings and the rest, which
// would all be zeros. Invites still waiting come last, unnumbered: they get a seat when they accept.
// The commissioner gets "Invite" on the heading line (League Settings > Players & invites).
export function DraftOrderCard({ state }: { state: LeagueState }) {
  const me = useMyPlayerId();
  const canManage = useCanManage();
  const mode = useLeagueStore((s) => s.mode);
  const leagueId = useLeagueStore((s) => s.leagueId);
  const playerAccounts = useLeagueStore((s) => s.playerAccounts);
  const [invites, setInvites] = useState<LeagueInvite[]>([]);

  useEffect(() => {
    if (mode !== "live" || !leagueId) return;
    let cancelled = false;
    api
      .listLeagueInvites(leagueId)
      .then((r) => !cancelled && setInvites(r.invites.filter((inv) => inv.status === "pending")))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mode, leagueId]);

  const byId = new Map(state.players.map((p) => [p.id, p]));
  const ordered = (state.draftOrder.length ? state.draftOrder.map((id) => byId.get(id)) : state.players).filter(
    (p): p is Player => !!p && !p.disabled,
  );
  if (ordered.length === 0) return null;
  const seatInvite = (p: Player) => invites.find((inv) => inv.player_id === p.id);
  const unseated = invites.filter((inv) => !inv.player_id);

  function status(p: Player) {
    if (seatInvite(p)) return "Invited · waiting";
    if (playerAccounts.some((a) => a.player_id === p.id)) return "Joined";
    if (p.automated) return "Computer";
    return mode === "live" ? "No account yet" : null;
  }

  return (
    <DashCard title="Draft order" wide aside={canManage && mode === "live" && <DashAside href="/setup/players">Invite</DashAside>}>
      <div className="flex flex-col border-b border-border">
        {ordered.map((p, i) => (
          <div
            key={p.id}
            className={cn("flex min-h-12 items-center gap-3 border-t border-border", p.id === me && "-mx-2 rounded-[3px] bg-muted px-2")}
          >
            <span className="type-num w-8 shrink-0 text-[24px] text-muted-foreground">{i + 1}</span>
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden />
            <span className="flex min-w-0 flex-1 items-center gap-2 text-base font-semibold">
              <span className="truncate">{p.name}</span>
              {p.id === me && <YouBadge />}
            </span>
            <span className="shrink-0 text-[13px] text-muted-foreground">{status(p)}</span>
          </div>
        ))}
        {unseated.map((inv) => (
          <div key={inv.id} className="flex min-h-12 items-center gap-3 border-t border-border">
            <span className="w-8 shrink-0" aria-hidden />
            <span className="size-2.5 shrink-0 rounded-full border border-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-base font-semibold text-muted-foreground">{inv.identifier}</span>
            <span className="shrink-0 text-[13px] text-muted-foreground">Invited · waiting</span>
          </div>
        ))}
      </div>
    </DashCard>
  );
}
