"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useLeagueStore, useIsSuperAdmin, useIsAuthenticated } from "@/lib/store";
import { useReportModalStore } from "@/lib/report-modal-store";
import StateLogic from "@/lib/game/state-logic.js";
import { api } from "@/lib/api";
import { cn } from "cn";
import {
  OverviewIcon,
  EpisodesIcon,
  TrophyIcon,
  ShuffleIcon,
  DraftIcon,
  MoreIcon,
  ShieldIcon,
  ClipboardIcon,
  AlertIcon,
  LogoutIcon,
  ChatIcon,
  ChevronDownIcon,
} from "./icons";

// Port of the live app's mobile-only nav chrome (public/index.html's <header class="mobile-topbar">
// / <nav class="mobile-bottombar"> / <div class="mobile-more-sheet">, populated by
// renderMobileNav()/renderMobileMoreSheetBody() in public/app.js) -- a Chess.com-style top bar +
// bottom tab bar, replacing the desktop sidebar below the 880px breakpoint (see globals.css's
// `nav`/`max-nav` custom breakpoint, matching the live app's single @media(max-width:880px) exactly).
//
// Not ported: the league-switcher dropdown (this POC only ever loads one real league, so there's
// nothing to switch between) and the chat unread-count badge (no unread tracking exists in
// chat-store.ts yet) -- both are visual/interactive details on top of chrome that otherwise
// matches structurally. League Settings and Rules aren't tabs in this POC at all, so the
// "More" sheet only lists what's actually real: the demoted 4th-slot tab, Admin+Reports (if
// applicable), a working Report an Issue (real-auth-only -- see the note by its row below), and
// Log out.
export function MobileNav() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const state = useLeagueStore((s) => s.state);
  const mode = useLeagueStore((s) => s.mode);
  const leagueName = useLeagueStore((s) => s.leagueName);
  const isSuperAdmin = useIsSuperAdmin();
  const isAuthenticated = useIsAuthenticated();
  const enterMockMode = useLeagueStore((s) => s.useMock);
  const openReportModal = useReportModalStore((s) => s.openModal);

  const turn = StateLogic.currentDraftTurn(state);
  const draftComplete = !!(turn && turn.isComplete);
  const fourth = draftComplete
    ? { href: "/mid-season", label: "Mid-Season", icon: ShuffleIcon }
    : { href: "/draft", label: "Draft", icon: DraftIcon };
  const demoted = draftComplete
    ? { href: "/draft", label: "Draft Results", icon: DraftIcon }
    : { href: "/mid-season", label: "Mid-Season", icon: ShuffleIcon };

  const tabs = [
    { href: "/", label: "Overview", icon: OverviewIcon },
    { href: "/episodes", label: "Episodes", icon: EpisodesIcon },
    { href: "/scoreboard", label: "Scoreboard", icon: TrophyIcon },
    fourth,
  ];

  function go(href: string) {
    setSheetOpen(false);
    router.push(href);
  }

  async function handleLogout() {
    setSheetOpen(false);
    if (isAuthenticated) {
      try {
        await api.logout();
      } catch {
        // best-effort -- fall through to resetting client state regardless
      }
    }
    enterMockMode();
    router.push("/");
  }

  return (
    <>
      <header className="sticky top-[env(safe-area-inset-top,0px)] z-[55] hidden border-b border-border bg-panel-menu max-nav:block">
        <div className="flex items-center gap-2.5 px-3.5 py-2.5">
          <Link href="/" className="h-[30px] w-[30px] shrink-0 overflow-hidden rounded-lg shadow-sm">
            <Image src="/icon.png" alt="" width={30} height={30} className="h-full w-full object-cover" />
          </Link>
          {/* visibility, not display -- demo mode has nothing to switch between, but the button
              still reserves its layout space, exactly like the live app's leagueBtn.style.visibility. */}
          <div className={cn("flex min-w-0 flex-1 items-center gap-1 py-0.5 text-foreground", mode === "mock" && "invisible")}>
            <span className="truncate text-[0.95rem] font-bold">{mode === "mock" ? "Demo Mode" : leagueName}</span>
            <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </div>
          <Link
            href="/chat"
            className="relative flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-foreground"
            aria-label="Chat"
          >
            <ChatIcon className="h-[19px] w-[19px]" />
          </Link>
        </div>
      </header>

      <nav
        className="fixed inset-x-0 bottom-0 z-[55] hidden flex-row border-t border-border bg-panel-menu p-[6px_2px] max-nav:flex"
        style={{ paddingBottom: "calc(6px + env(safe-area-inset-bottom, 0px))" }}
      >
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          const Icon = tab.icon;
          return (
            <button
              key={tab.href}
              className={cn("flex flex-1 flex-col items-center gap-[3px] px-0.5 py-1.5 pb-[5px] text-muted-foreground", active && "text-primary")}
              onClick={() => go(tab.href)}
            >
              <Icon className="h-[21px] w-[21px]" />
              <span className="text-[0.63rem] font-semibold">{tab.label}</span>
            </button>
          );
        })}
        <button
          className="flex flex-1 flex-col items-center gap-[3px] px-0.5 py-1.5 pb-[5px] text-muted-foreground"
          onClick={() => setSheetOpen(true)}
        >
          <MoreIcon className="h-[21px] w-[21px]" />
          <span className="text-[0.63rem] font-semibold">More</span>
        </button>
      </nav>

      <div
        className={cn(
          "fixed inset-0 z-[70] bg-black/40 transition-opacity",
          sheetOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setSheetOpen(false)}
      />
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-[71] max-h-[75vh] overflow-y-auto rounded-t-[18px] bg-card p-2 pb-3.5 shadow-[0_-8px_24px_rgba(20,18,14,.2)] transition-transform",
          sheetOpen ? "translate-y-0" : "translate-y-full"
        )}
      >
        <div className="mx-auto mb-2.5 mt-1.5 h-1 w-9 rounded-full bg-border" />
        <MoreRow icon={demoted.icon} label={demoted.label} onClick={() => go(demoted.href)} />
        {isSuperAdmin && (
          <>
            <div className="my-1.5 h-px bg-border" />
            <div className="px-3 pb-0.5 pt-2 text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">Admin</div>
            <MoreRow icon={ShieldIcon} label="Admin" onClick={() => go("/admin")} />
            <MoreRow icon={ClipboardIcon} label="Reports" onClick={() => go("/reports")} />
          </>
        )}
        <div className="my-1.5 h-px bg-border" />
        {/* Report an Issue posts as the real signed-in SurvivorDraft user (server-side
            requireAuth) -- gated on real authentication, not `mode` (a super-admin with no
            personal league is genuinely signed in but stays mode:'mock' -- see store.ts's
            useIsAuthenticated for why that distinction matters). */}
        {isAuthenticated && (
          <>
            <MoreRow
              icon={AlertIcon}
              label="Report an Issue"
              onClick={() => {
                setSheetOpen(false);
                openReportModal();
              }}
            />
            <div className="my-1.5 h-px bg-border" />
          </>
        )}
        <MoreRow icon={LogoutIcon} label={isAuthenticated ? "Log out" : "Sign in"} onClick={handleLogout} danger />
      </div>
    </>
  );
}

function MoreRow({
  icon: Icon,
  label,
  onClick,
  danger,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      className={cn(
        "flex w-full items-center gap-3 rounded-[9px] px-3 py-3 text-left text-[0.92rem] hover:bg-secondary",
        danger ? "text-destructive" : "text-foreground",
        disabled && "opacity-50"
      )}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon className={cn("h-[18px] w-[18px] shrink-0", danger ? "text-destructive" : "text-muted-foreground")} />
      {label}
    </button>
  );
}
