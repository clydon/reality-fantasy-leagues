"use client";

import { useRef, useState, type ComponentType } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronsUpDown, MoreHorizontal } from "lucide-react";
import { useLeagueStore, useIsSuperAdmin, useIsAuthenticated, useIsPreviewingDemo, useCanManage } from "@/lib/store";
import { useDemoSeasonPickerStore } from "@/lib/demo-season-picker-store";
import { useTourStore } from "@/lib/tour/tour-store";
import { useReportModalStore } from "@/lib/report-modal-store";
import { useChatStore } from "@/lib/chat-store";
import { useNotificationsStore } from "@/lib/notifications-store";
import StateLogic from "@/lib/game/state-logic.js";
import { midseasonBadge } from "@/lib/game/selectors";
import { myLineupDue } from "@/lib/game/lineup-view";
import { myPickDue } from "@/lib/game/pool-view";
import { commissionerItems } from "@/lib/game/commissioner-items";
import { logOut, useSession } from "@/lib/auth-client";
import { useShowTerms } from "@/lib/use-show-terms";
import { useClickOutside } from "@/lib/use-click-outside";
import { LeagueMenu } from "@/components/league-menu";
import { ThemePicker } from "@/components/theme-picker";
import { useWhatsNewCount, useWhatsNewPreview } from "@/components/whats-new-modal";
import { useAdminWaiting } from "@/components/admin/admin-shell";
import {
  AlertIcon,
  ChatIcon,
  DraftIcon,
  EpisodesIcon,
  GearIcon,
  LineupIcon,
  LogoutIcon,
  MoonIcon,
  OverviewIcon,
  PickIcon,
  ResearchIcon,
  ShieldIcon,
  ShuffleIcon,
  SparklesIcon,
  TrophyIcon,
  UserIcon,
} from "@/components/icons";
import { cn } from "cn";

type Icon = ComponentType<{ className?: string }>;

// The desktop sidebar (880px and up), direction A2's "league plate rail" (docs/PLAN-ux-declutter.md,
// D1). Top: the league as a caption plate, which opens the league menu; no logo. Then the league's
// pages as 44px rows with the tab bar's icons, in the tab bar's order. At the bottom: Admin for
// super-admins, then one account row whose ⋯ opens a menu above it with everything account-level
// (settings, appearance, What's new, report, demo, log out), instead of a column of yellow links.
// Mobile chrome is mobile-nav/mobile-nav.tsx, shown below the same breakpoint.
const TABS: { href: string; label: string; icon: Icon }[] = [
  { href: "/", label: "Overview", icon: OverviewIcon },
  { href: "/episodes", label: "Episodes", icon: EpisodesIcon },
  { href: "/scoreboard", label: "Scoreboard", icon: TrophyIcon },
  { href: "/lineup", label: "Lineup", icon: LineupIcon },
  { href: "/pick", label: "Pick", icon: PickIcon },
  { href: "/draft", label: "Draft", icon: DraftIcon },
  { href: "/mid-season", label: "Mid-Season", icon: ShuffleIcon },
  { href: "/research", label: "Research", icon: ResearchIcon },
  { href: "/chat", label: "Chat", icon: ChatIcon },
  { href: "/setup", label: "League Settings", icon: GearIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const isSuperAdmin = useIsSuperAdmin();
  const isPreviewingDemo = useIsPreviewingDemo();
  const canManage = useCanManage();
  const mode = useLeagueStore((s) => s.mode);
  const openDemoPicker = useDemoSeasonPickerStore((s) => s.openPicker);
  const takeTour = useTakeTour();
  const state = useLeagueStore((s) => s.state);
  const myPlayerId = useLeagueStore((s) => s.membership?.playerId ?? null);
  const chatUnread = useChatStore((s) => s.unreadCount);
  const notifications = useNotificationsStore((s) => s.notifications);

  // Whether there's a season to browse at all: a real league, or the demo one someone deliberately
  // stepped into. A signed-in user with no league has neither, and the league tabs would all be
  // views onto the demo season they didn't ask for -- so they get the two rows below instead.
  const hasSeason = mode === "live" || isPreviewingDemo;

  // Only the pages this league has: Draft and Mid-Season are roster concepts (and Mid-Season only
  // when the commissioner turned Pickups or Swap on -- the route would refuse otherwise); Lineup and
  // Research are Active Roster's; Pick is Eliminator Pool's.
  const type = StateLogic.getLeagueType(state);
  const hasMidSeason = StateLogic.replenishAvailable(state) || StateLogic.tradeAvailable(state);
  const tabs = TABS.filter(
    (t) =>
      !((t.href === "/draft" || t.href === "/mid-season") && !type.hasRoster) &&
      !(t.href === "/mid-season" && !hasMidSeason) &&
      !((t.href === "/research" || t.href === "/lineup") && !type.hasActiveRoster) &&
      !(t.href === "/pick" && !type.hasWeeklyPicks),
  );

  // The tab bar's badges: a "needs you" mark on Lineup, Pick and Mid-Season (and any page with its
  // own pending notifications), chat's unread count as a quiet chip, and a chyron dot on League
  // Settings while a commissioner to-do waits there.
  function badgeFor(href: string): Badge | null {
    if (href === "/mid-season") {
      const b = midseasonBadge(state, myPlayerId);
      return b ? { kind: "urgent", label: b.label } : null;
    }
    if (href === "/lineup" && myLineupDue(state, myPlayerId)) return { kind: "urgent", label: "!" };
    if (href === "/pick" && myPickDue(state, myPlayerId)) return { kind: "urgent", label: "!" };
    if (href === "/chat") return chatUnread > 0 ? { kind: "count", label: chatUnread > 9 ? "9+" : String(chatUnread) } : null;
    if (href === "/setup") return canManage && commissionerItems(state).length > 0 ? { kind: "dot" } : null;
    const count = notifications.filter((n) => n.tab === href).length;
    return count > 0 ? { kind: "urgent", label: count > 9 ? "9+" : String(count) } : null;
  }
  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(`${href}/`)) || (href === "/episodes" && pathname === "/cast");

  return (
    <aside className="sticky top-0 flex h-screen w-[264px] flex-none flex-col gap-[22px] overflow-y-auto overflow-x-hidden border-r border-border bg-panel-menu p-[20px_14px_14px]">
      {hasSeason && <LeaguePlate />}

      <nav className="flex flex-col gap-0.5">
        {hasSeason ? (
          tabs.map((tab) => <NavRow key={tab.href} href={tab.href} label={tab.label} icon={tab.icon} active={isActive(tab.href)} badge={badgeFor(tab.href)} />)
        ) : (
          <>
            <NavRow href="/dashboard" label="My Leagues" icon={OverviewIcon} active={pathname === "/dashboard" || pathname === "/"} />
            {/* The one way into the demo season for someone who has no league of their own. */}
            <NavRow label="Demo Season" icon={EpisodesIcon} onClick={openDemoPicker} />
            <NavRow label="Take the tour" icon={SparklesIcon} onClick={takeTour} />
          </>
        )}
      </nav>

      <div className="mt-auto flex flex-col gap-2">
        {isSuperAdmin && <AdminRow active={pathname.startsWith("/admin")} />}
        <AccountRow />
      </div>
    </aside>
  );
}

// The league as a caption plate: the season as a quiet tag, the name (up to two lines) and what it
// is. With leagues to switch between it opens the league menu, just under it.
function LeaguePlate() {
  const router = useRouter();
  const mode = useLeagueStore((s) => s.mode);
  const state = useLeagueStore((s) => s.state);
  const leagueName = useLeagueStore((s) => s.leagueName);
  const leagues = useLeagueStore((s) => s.leagues);
  const leagueId = useLeagueStore((s) => s.leagueId);
  const switchLeague = useLeagueStore((s) => s.switchLeague);
  const terms = useShowTerms();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, open, () => setOpen(false));

  const season = state.settings.wikiSeason;
  const switchable = mode === "live" && leagues.length > 0;
  const body = (
    <>
      <span className="type-caption flex shrink-0 items-center bg-quiet-tag pl-2.5 pr-4 text-[13px] tracking-[0.04em] text-quiet-tag-foreground [clip-path:polygon(0_0,100%_0,84%_100%,0_100%)]">
        {season != null ? `S${season}` : "League"}
      </span>
      <span className="-ml-2.5 flex min-w-0 flex-1 flex-col justify-center gap-0.5 bg-plate py-[7px] pl-2.5 pr-1 text-left text-plate-foreground">
        <span className="type-caption line-clamp-2 text-[18px] leading-none">{mode === "live" ? leagueName : "Demo season"}</span>
        <span className="truncate text-[12px] text-plate-muted">{[terms.showName, typeName(state)].filter(Boolean).join(" · ")}</span>
      </span>
      {switchable && (
        <span className="flex shrink-0 items-center bg-plate pr-2 text-plate-foreground">
          <ChevronsUpDown className="size-[18px]" strokeWidth={2.2} aria-hidden />
        </span>
      )}
    </>
  );
  const cls = "flex min-h-14 w-full items-stretch overflow-hidden rounded-[3px] shadow-plate";

  if (!switchable) return <div className={cls}>{body}</div>;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Switch league"
        aria-expanded={open}
        className={cn(cls, "transition-[filter] hover:brightness-[1.04] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line")}
        onClick={() => setOpen((o) => !o)}
      >
        {body}
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-[60vh] overflow-y-auto rounded-[4px] border border-border bg-card p-1.5 shadow-sheet">
          <LeagueMenu
            leagues={leagues}
            leagueId={leagueId}
            onSelect={async (id) => {
              setOpen(false);
              if (id === leagueId) return;
              await switchLeague(id);
              // Always land on Overview: the page you were on may not exist in the other league.
              router.push("/");
            }}
            onJoinOrCreate={() => {
              setOpen(false);
              router.push("/dashboard");
            }}
          />
        </div>
      )}
    </div>
  );
}

const typeName = (state: Parameters<typeof StateLogic.getLeagueType>[0]) => StateLogic.getLeagueType(state).name;

type Badge = { kind: "urgent"; label: string } | { kind: "count"; label: string } | { kind: "dot" };

function NavRow({
  href,
  onClick,
  label,
  icon: Icon,
  active,
  badge,
}: {
  href?: string;
  onClick?: () => void;
  label: string;
  icon: Icon;
  active?: boolean;
  badge?: Badge | null;
}) {
  const cls = cn(
    "flex min-h-11 items-center gap-3 rounded-[3px] px-3 text-left text-[15px] font-semibold outline-none transition-colors focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-chyron-line",
    active ? "bg-muted text-foreground shadow-[inset_3px_0_0_var(--chyron-line)]" : "text-muted-foreground hover:bg-accent hover:text-foreground",
  );
  const body = (
    <>
      <Icon className={cn("size-5 shrink-0", active && "text-chyron-line")} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge?.kind === "urgent" && (
        <span className="flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-destructive px-1 text-[0.65rem] font-bold text-white">
          {badge.label}
        </span>
      )}
      {badge?.kind === "count" && (
        <span className="rounded-[2px] bg-input px-1.5 py-px text-[11px] font-bold tabular-nums text-foreground">{badge.label}</span>
      )}
      {badge?.kind === "dot" && <span className="size-2 rounded-full bg-chyron-line" aria-label="Needs attention" />}
    </>
  );
  return href ? (
    <Link href={href} className={cls} aria-current={active ? "page" : undefined}>
      {body}
    </Link>
  ) : (
    <button type="button" className={cls} onClick={onClick}>
      {body}
    </button>
  );
}

// Super-admins only, with a dot while Admin's To do has anything (the admin tab bar's own check).
function AdminRow({ active }: { active: boolean }) {
  const waiting = useAdminWaiting();
  return <NavRow href="/admin" label="Admin" icon={ShieldIcon} active={active} badge={waiting ? { kind: "dot" } : null} />;
}

// The guided tour from wherever you are (docs/PLAN-guided-tour.md): its league replaces the one
// showing, from Overview.
function useTakeTour() {
  const router = useRouter();
  const start = useTourStore((s) => s.start);
  return () => {
    start();
    router.push("/");
  };
}

// You, as one row: an initial, your username and what's behind it. Its menu opens above it.
function AccountRow() {
  const isAuthenticated = useIsAuthenticated();
  const mode = useLeagueStore((s) => s.mode);
  const enterMockMode = useLeagueStore((s) => s.useMock);
  const setEntered = useLeagueStore((s) => s.setEntered);
  const openDemoPicker = useDemoSeasonPickerStore((s) => s.openPicker);
  const takeTour = useTakeTour();
  const touring = useLeagueStore((s) => s.touring);
  const openReportModal = useReportModalStore((s) => s.openModal);
  const showWhatsNew = useWhatsNewPreview((s) => s.showAll);
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, open, () => setOpen(false));
  const newCount = useWhatsNewCount();

  const user = session?.user as { username?: string | null; name?: string | null } | undefined;
  const name = isAuthenticated ? (user?.username ?? user?.name ?? "Account") : "Guest";
  const close = () => setOpen(false);

  // Port of exitDemoMode() -- see auth-gate.tsx's handleExitDemo: always back to the login screen.
  function signIn() {
    enterMockMode();
    setEntered(false);
  }

  return (
    <div ref={ref} className="relative">
      {open && (
        <div role="menu" className="absolute inset-x-0 bottom-full z-30 mb-2 rounded-[4px] border border-border bg-card py-1.5 shadow-sheet">
          {isAuthenticated ? (
            <>
              <MenuRow href="/account" icon={UserIcon} onClick={close}>
                Account settings
              </MenuRow>
              <AppearanceRow />
              <MenuRow
                icon={SparklesIcon}
                detail={newCount > 0 ? `${newCount} new` : undefined}
                onClick={() => {
                  close();
                  showWhatsNew();
                }}
              >
                What&rsquo;s new
              </MenuRow>
              <MenuRow
                icon={AlertIcon}
                onClick={() => {
                  close();
                  openReportModal();
                }}
              >
                Report an issue
              </MenuRow>
              {mode === "live" && (
                <MenuRow
                  icon={EpisodesIcon}
                  onClick={() => {
                    close();
                    openDemoPicker();
                  }}
                >
                  Demo season
                </MenuRow>
              )}
              <MenuRow
                icon={SparklesIcon}
                onClick={() => {
                  close();
                  takeTour();
                }}
              >
                {touring ? "Replay the tour" : "Take the tour"}
              </MenuRow>
              <div className="my-1.5 h-px bg-border" />
              <MenuRow icon={LogoutIcon} danger onClick={logOut}>
                Log out
              </MenuRow>
            </>
          ) : (
            <>
              <MenuRow icon={UserIcon} onClick={signIn}>
                Sign in
              </MenuRow>
              <MenuRow
                icon={SparklesIcon}
                onClick={() => {
                  close();
                  takeTour();
                }}
              >
                {touring ? "Replay the tour" : "Take the tour"}
              </MenuRow>
              <AppearanceRow />
            </>
          )}
        </div>
      )}
      <button
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-[52px] w-full items-center gap-2.5 rounded-[3px] bg-muted px-2 text-left text-foreground outline-none hover:bg-accent focus-visible:outline-3 focus-visible:outline-chyron-line"
      >
        <span className="type-caption flex size-9 shrink-0 items-center justify-center rounded-[3px] bg-foreground text-[20px] text-background">
          {name.charAt(0).toUpperCase()}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] font-semibold">{name}</span>
          <span className="truncate text-[12px] text-muted-foreground">{isAuthenticated ? "Account, help, log out" : "Sign in, appearance"}</span>
        </span>
        <MoreHorizontal className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      </button>
    </div>
  );
}

function MenuRow({
  href,
  onClick,
  icon: Icon,
  detail,
  danger,
  children,
}: {
  href?: string;
  onClick?: () => void;
  icon: Icon;
  detail?: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  const cls = cn(
    "flex min-h-[42px] w-full items-center gap-3 px-3.5 text-left text-sm font-semibold outline-none hover:bg-accent focus-visible:bg-accent",
    danger ? "text-destructive" : "text-foreground",
  );
  const body = (
    <>
      <Icon className="size-[18px] shrink-0" />
      <span className="min-w-0 flex-1">{children}</span>
      {detail && <span className="shrink-0 text-xs font-medium text-muted-foreground">{detail}</span>}
    </>
  );
  return href ? (
    <Link href={href} role="menuitem" className={cls} onClick={onClick}>
      {body}
    </Link>
  ) : (
    <button type="button" role="menuitem" className={cls} onClick={onClick}>
      {body}
    </button>
  );
}

// The theme lives in the account menu (and on Account settings): Light, Dark or the device's.
function AppearanceRow() {
  return (
    <div className="flex flex-col gap-1.5 px-3.5 pb-2 pt-2.5 text-sm font-semibold text-foreground">
      <span className="flex items-center gap-3">
        <MoonIcon className="size-[18px] shrink-0" />
        Appearance
      </span>
      <ThemePicker className="ml-[30px]" />
    </div>
  );
}
