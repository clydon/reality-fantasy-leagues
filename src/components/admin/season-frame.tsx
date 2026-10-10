"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { api } from "@/lib/api";
import type { AdminShow, ShowSeason } from "@/lib/game/types";
import { STATUS_LABEL } from "@/lib/admin-season";
import { AdminPage, count, seasonShort, useAdminSeason } from "./admin-ui";
import { cn } from "cn";

// A season's page (docs/PLAN-ux-redesign.md 3b): four tabs -- Episodes, Cast, Rules, Setup -- so the
// old show -> season -> step -> episode accordion becomes one level. Each tab is its own route, so a
// To do link can land on the exact one and Back behaves.

export type SeasonCtx = { show: AdminShow; season: ShowSeason; refetch: () => unknown };

/** The season's cast and its league count, shared by the frame's summary line and the Cast tab. */
export function useSeasonCast(seasonId: string) {
  return useQuery({ queryKey: ["season-cast", seasonId], queryFn: () => api.adminSeasonCast(seasonId) });
}

export function SeasonFrame({
  seasonId,
  actions,
  children,
}: {
  seasonId: string;
  actions?: { label: string; onClick: () => void };
  children: (ctx: SeasonCtx) => ReactNode;
}) {
  const pathname = usePathname();
  const { show, season, isLoading, refetch } = useAdminSeason(seasonId);
  const cast = useSeasonCast(seasonId);
  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (!show || !season) {
    return (
      <AdminPage title="Season" back={{ href: "/admin/shows", label: "Shows" }}>
        <p className="text-muted-foreground">That season doesn&rsquo;t exist any more.</p>
      </AdminPage>
    );
  }
  const base = `/admin/seasons/${season.id}`;
  const approved = !!season.castApprovedAt;
  const tabs = [
    { href: base, label: "Episodes" },
    { href: `${base}/cast`, label: "Cast", done: approved },
    { href: `${base}/rules`, label: "Rules" },
    { href: `${base}/setup`, label: "Setup" },
  ];
  const leagues = cast.data?.leagueCount;
  const subtitle = [STATUS_LABEL[season.status], leagues !== undefined && count(leagues, "league")].filter(Boolean).join(" · ");
  return (
    <AdminPage title={seasonShort(show, season)} subtitle={subtitle} back={{ href: `/admin/shows/${show.id}`, label: show.name }} actions={actions}>
      <nav aria-label="Season" className="-mt-2 flex rounded-[3px] bg-card p-[3px]">
        {tabs.map((t) => {
          const on = t.href === base ? pathname === base || pathname.startsWith(`${base}/episodes`) : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={on ? "page" : undefined}
              className={cn(
                "flex min-h-10 flex-1 items-center justify-center gap-1 rounded-[2px] px-1 text-sm font-semibold",
                on ? "bg-foreground font-bold text-background" : "text-foreground hover:bg-muted",
              )}
            >
              {t.label}
              {t.done && <Check className={cn("size-4", on ? "text-background" : "text-good")} strokeWidth={2.6} aria-label="approved" />}
            </Link>
          );
        })}
      </nav>
      {children({ show, season, refetch })}
    </AdminPage>
  );
}
