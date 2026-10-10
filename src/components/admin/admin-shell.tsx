"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Flag, Inbox, LayoutList, Settings2, Tv, Users, ScrollText } from "lucide-react";
import { api } from "@/lib/api";
import { useIsSuperAdmin, useLeagueStore } from "@/lib/store";
import { useLoadPaidAiPref, useShowPaidAi } from "@/lib/paid-ai-store";
import { useAdminHeader, useAdminShows } from "./admin-ui";
import { cn } from "cn";

// The admin area's own chrome (docs/PLAN-ux-redesign.md 3a; the canvas's Admin-Home). Admin used to
// open inside a league's chrome -- the league's name in the header, its tabs at the bottom, its alert
// strip on top -- none of which has anything to do with running the site. Here it gets its own: on a
// phone a header (Back, the page's name, whether paid AI is on) and a tab bar of the five admin
// sections; on desktop a sidebar listing every section, with the way back to your league at the top.

export const isAdminRoute = (pathname: string) => pathname === "/admin" || pathname.startsWith("/admin/");

type Tab = { href: string; label: string; icon: typeof Inbox; match: (p: string) => boolean };

// Formats and reports have no tab of their own on a phone: formats are part of Shows, and reports
// show up on To do whenever there are any.
const TABS: Tab[] = [
  { href: "/admin", label: "To do", icon: Inbox, match: (p) => p === "/admin" || p.startsWith("/admin/reports") },
  {
    href: "/admin/shows",
    label: "Shows",
    icon: Tv,
    match: (p) => p.startsWith("/admin/shows") || p.startsWith("/admin/seasons") || p.startsWith("/admin/formats"),
  },
  { href: "/admin/users", label: "Users", icon: Users, match: (p) => p.startsWith("/admin/users") },
  { href: "/admin/leagues", label: "Leagues", icon: Flag, match: (p) => p.startsWith("/admin/leagues") },
  { href: "/admin/site", label: "Site", icon: Settings2, match: (p) => p.startsWith("/admin/site") },
];

const SIDEBAR: Tab[] = [
  TABS[0],
  { ...TABS[1], match: (p) => p.startsWith("/admin/shows") || p.startsWith("/admin/seasons") },
  { href: "/admin/formats", label: "Formats & rules", icon: ScrollText, match: (p) => p.startsWith("/admin/formats") },
  TABS[2],
  TABS[3],
  { href: "/admin/reports", label: "Reports", icon: LayoutList, match: (p) => p.startsWith("/admin/reports") },
  TABS[4],
];

/**
 * Whether anything is waiting on an admin, for the To do tab's dot. Read from the same cached
 * queries To do itself uses, so it costs nothing extra once that page has loaded.
 */
export function useAdminWaiting(): boolean {
  const shows = useAdminShows();
  const formats = useQuery({ queryKey: ["admin-formats"], queryFn: () => api.adminListFormats() });
  const reports = useQuery({ queryKey: ["admin-reports"], queryFn: () => api.adminListReports() });
  const seasons = shows.data?.shows.flatMap((s) => s.seasons) ?? [];
  return (
    seasons.some((s) => (s.pendingDecisions ?? 0) > 0 || ((s.castStaged ?? 0) > 0 && !s.castApprovedAt)) ||
    (formats.data?.formats ?? []).some((f) => f.status === "draft") ||
    (reports.data?.reports.length ?? 0) > 0
  );
}

/** "Paid AI on/off", always in view, because it decides whether anything here can cost money. */
function PaidChip({ className }: { className?: string }) {
  const on = useShowPaidAi();
  return (
    <Link
      href="/admin/site"
      className={cn(
        "inline-flex min-h-8 shrink-0 items-center rounded-[2px] px-2 text-[11px] font-bold uppercase tracking-wide",
        on ? "bg-chyron text-chyron-foreground" : "bg-muted text-muted-foreground",
        className,
      )}
      title="Change in Site settings"
    >
      Paid AI {on ? "on" : "off"}
    </Link>
  );
}

export function AdminMobileChrome() {
  const pathname = usePathname();
  const { title, back } = useAdminHeader();
  const waiting = useAdminWaiting();
  const leagueName = useLeagueStore((s) => s.leagueName);
  // The section pages (the tabs themselves) go back to your league; anything under one goes back
  // to its parent.
  const isTab = TABS.some((t) => t.href === pathname);
  const backHref = !isTab && back ? back : "/";
  return (
    <>
      <header className="sticky top-[env(safe-area-inset-top,0px)] z-[55] hidden border-b border-border bg-panel-menu max-nav:block">
        <div className="flex items-center gap-2 px-3 py-2">
          <Link
            href={backHref}
            aria-label={backHref === "/" ? `Back to ${leagueName ?? "your leagues"}` : "Back"}
            className="-my-1 -ml-1.5 flex size-11 shrink-0 items-center justify-center text-foreground"
          >
            <ChevronLeft className="size-6" strokeWidth={2.2} aria-hidden />
          </Link>
          <span className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
            <span className="text-[12px] font-semibold text-muted-foreground">Admin</span>
            <span className="type-caption max-w-full truncate text-[22px]">{title}</span>
          </span>
          <PaidChip />
        </div>
      </header>
      <nav
        data-mobile-tabbar
        aria-label="Admin"
        className="fixed inset-x-0 bottom-0 z-[55] hidden flex-row border-t border-border bg-panel-menu p-[6px_2px] [transform:translateZ(0)] max-nav:flex"
        style={{ paddingBottom: "calc(6px + env(safe-area-inset-bottom, 0px))" }}
      >
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn("relative flex flex-1 flex-col items-center gap-[3px] px-0.5 py-1.5 pb-[5px] text-muted-foreground", active && "text-primary")}
            >
              <span className="relative inline-flex">
                <Icon className="size-[21px]" strokeWidth={active ? 2.3 : 2} aria-hidden />
                {tab.href === "/admin" && waiting && (
                  <span className="absolute -right-1.5 -top-0.5 size-2 rounded-full bg-chyron" aria-label="Something needs you" />
                )}
              </span>
              <span className="text-[0.63rem] font-semibold">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

export function AdminSidebar() {
  const pathname = usePathname();
  const waiting = useAdminWaiting();
  const leagueName = useLeagueStore((s) => s.leagueName);
  return (
    <aside className="sticky top-0 flex h-screen w-[248px] flex-none flex-col overflow-y-auto border-r border-border bg-panel-menu p-[20px_12px]">
      <Link
        href="/"
        className="mb-4 inline-flex min-h-11 items-center gap-1 rounded-[3px] px-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-5 shrink-0" strokeWidth={2.2} aria-hidden />
        <span className="truncate">{leagueName ? `Back to ${leagueName}` : "Back to your leagues"}</span>
      </Link>
      <div className="mb-3 flex items-center justify-between gap-2 px-3">
        <span className="type-caption text-[26px]">Admin</span>
        <PaidChip />
      </div>
      <nav className="flex flex-col gap-0.5" aria-label="Admin">
        {SIDEBAR.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-2.5 rounded-[4px] px-3 text-[0.95rem] font-semibold text-muted-foreground transition-colors",
                active ? "bg-accent text-primary" : "hover:bg-secondary hover:text-foreground",
              )}
            >
              <Icon className="size-[18px] shrink-0" strokeWidth={2.1} aria-hidden />
              {tab.label}
              {tab.href === "/admin" && waiting && <span className="ml-auto size-2 rounded-full bg-chyron" aria-label="Something needs you" />}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

/** Everything under /admin: super-admins only, with the paid-AI and spoiler preferences loaded once. */
export function AdminGate({ children }: { children: ReactNode }) {
  const isSuperAdmin = useIsSuperAdmin();
  useLoadPaidAiPref();
  if (!isSuperAdmin) {
    return <p className="text-base text-muted-foreground">Admin is only for site admins.</p>;
  }
  return <>{children}</>;
}
