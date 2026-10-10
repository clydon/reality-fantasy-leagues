"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import type { LeagueState } from "@/lib/game/types";
import { useCanManage, useLeagueStore } from "@/lib/store";
import { api } from "@/lib/api";
import { commissionerItems, type CommissionerItem } from "@/lib/game/commissioner-items";

// The commissioner's to-do card at the top of Overview (docs/PLAN-ux-redesign.md, 2f): one row per
// thing only they can do, each linking to where it's done, so a commissioner on a phone doesn't have to
// dig through More → League Settings to find it. Renders nothing when nothing's waiting, and nothing
// for players.
export function CommissionerCard({ state }: { state: LeagueState }) {
  const canManage = useCanManage();
  const leagueId = useLeagueStore((s) => (s.mode === "live" ? s.leagueId : null));
  const { data } = useQuery({
    queryKey: ["league-invites", leagueId],
    queryFn: () => api.listLeagueInvites(leagueId!),
    enabled: canManage && !!leagueId,
    staleTime: 60_000,
  });
  if (!canManage) return null;

  const pending = (data?.invites ?? []).filter((inv) => inv.status === "pending").length;
  const items: CommissionerItem[] = [
    ...commissionerItems(state),
    ...(pending
      ? [
          {
            id: "invites",
            title: `${pending} invite${pending === 1 ? "" : "s"} pending`,
            detail: "Waiting for them to accept",
            action: "View",
            href: "/setup/players",
          },
        ]
      : []),
  ];
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="commish-head" className="flex flex-col">
      <h2 id="commish-head" className="type-caption pb-1.5 text-[19px] text-muted-foreground">
        Commissioner
      </h2>
      <div className="flex flex-col border-b border-border [&>*]:border-t [&>*]:border-border">
        {items.map((it) => (
          <Link
            key={it.id}
            href={it.href}
            className="flex min-h-[56px] items-center gap-3 py-2 outline-none hover:bg-accent/40 focus-visible:bg-accent"
          >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-base font-semibold">{it.title}</span>
              <span className="truncate text-[13px] text-muted-foreground">{it.detail}</span>
            </span>
            <span className="flex shrink-0 items-center text-sm font-semibold">
              {it.action}
              <ChevronRight className="size-5 text-muted-foreground" strokeWidth={2.2} aria-hidden />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
