"use client";

import { useEffect, useRef, useState } from "react";
import { ReplayBug, useLateJoin } from "@/components/late-join/replay-bug";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLeagueStore, useIsSuperAdmin, useIsAuthenticated, useIsPreviewingDemo, useCanManage } from "@/lib/store";
import { useReportModalStore } from "@/lib/report-modal-store";
import { useChatStore } from "@/lib/chat-store";
import { useNotificationsStore } from "@/lib/notifications-store";
import StateLogic from "@/lib/game/state-logic.js";
import { SLOT_PAGES, episodesDue, slotDue, slotFour } from "@/lib/game/league-tabs";
import { logOut } from "@/lib/auth-client";
import { cn } from "cn";
import { LeagueMenu, LeagueMenuActions } from "@/components/league-menu";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useSheetSwipe } from "@/components/ui/use-sheet-swipe";
import { useDemoSeasonPickerStore } from "@/lib/demo-season-picker-store";
import { ThemePicker } from "@/components/theme-picker";
import {
  OverviewIcon,
  EpisodesIcon,
  TrophyIcon,
  DraftIcon,
  MoreIcon,
  ShieldIcon,
  AlertIcon,
  LogoutIcon,
  ChatIcon,
  ResearchIcon,
  LineupIcon,
  PickIcon,
  TeamIcon,
  MoonIcon,
  ChevronDownIcon,
  GearIcon,
  UserIcon,
  SparklesIcon,
  InfoIcon,
} from "@/components/icons";
import { useExplainerStore } from "@/lib/explainer-store";
import { useWhatsNewCount, useWhatsNewPreview } from "@/components/whats-new-modal";
import { useMoreSheetRequest } from "@/lib/more-sheet";
import { useTourRunning, useTourStep, useTourStore } from "@/lib/tour/tour-store";
import { usePracticeRound } from "@/lib/tour/use-practice-round";
import { SwipeTitle, isLeaguePage } from "@/components/league-swipe";
import { LeagueStrip, useLinkedGroup } from "@/components/league-strip";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { pageTitle as pageTitleFor, useBackTarget } from "@/lib/nav-trail";
import { CaptionPlate } from "@/components/ui/caption-plate";
import { commissionerItems } from "@/lib/game/commissioner-items";
import { useHeaderAction } from "@/lib/header-action-store";
import { useShowCatalog, useShowTerms } from "@/lib/use-show-terms";
import { publicMediaSrc } from "@/lib/game/selectors";
import { artStyleVars } from "@/lib/show-art-style";

// Port of the live app's mobile-only nav chrome (public/index.html's <header class="mobile-topbar">
// / <nav class="mobile-bottombar"> / <div class="mobile-more-sheet">, populated by
// renderMobileNav()/renderMobileMoreSheetBody() in public/app.js) -- a Chess.com-style top bar +
// bottom tab bar, replacing the desktop sidebar below the 880px breakpoint (see globals.css's
// `nav`/`max-nav` custom breakpoint, matching the live app's single @media(max-width:880px) exactly).
//
// The top bar's league-name button is a real switcher now (league-menu.tsx's LeagueMenu, shared with
// the desktop Sidebar version) rather than pure decoration. In a linked group it names the group, and
// the league strip under the bar picks the game (league-strip.tsx, docs/PLAN-league-tabs.md); the ▾
// still opens your other leagues and groups.
// More (docs/PLAN-league-tabs.md) is things about the league and about you, nothing you play with:
// This league (the finished Draft board, How this league works, Practice round, League Settings),
// then You (Account, What's new, Report an issue, the tours, Demo season, Admin, Log out).
export function MobileNav() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const showWhatsNew = useWhatsNewPreview((s) => s.showAll);
  const showExplainer = useExplainerStore((s) => s.show);
  // Opened from elsewhere too (the What's New "Show me" link).
  const moreRequests = useMoreSheetRequest((s) => s.requests);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- an outside request to open the sheet
    if (moreRequests > 0) setSheetOpen(true);
  }, [moreRequests]);
  // True for the one render triggered by the back button itself, so closeSheet knows not to also
  // call history.back() (that history entry is already the one being popped).
  const closingViaBack = useRef(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);

  // Back button closes the sheet instead of leaving the page: pushes one history entry while open,
  // and a real back press (popstate) closes it rather than navigating away.
  useEffect(() => {
    if (!sheetOpen) return;
    window.history.pushState({ moreSheet: true }, "");
    const onPopState = () => {
      closingViaBack.current = true;
      setSheetOpen(false);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [sheetOpen]);

  // The only way to close: pops the history entry pushed above unless the close WAS that pop, so
  // the next real back press doesn't get silently swallowed by a leftover entry.
  function closeSheet() {
    if (closingViaBack.current) {
      closingViaBack.current = false;
    } else if (window.history.state?.moreSheet) {
      window.history.back();
    }
    setSheetOpen(false);
  }

  // Swipe down closes the sheet (useSheetSwipe: from the handle, or anywhere once scrolled to the top).
  const swipe = useSheetSwipe({ sheetRef, scrimRef, onClose: closeSheet });
  const [leagueMenuOpen, setLeagueMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const state = useLeagueStore((s) => s.state);
  // The real state for the tabs' "!", as the alert strip reads it: due is due whether or not you've looked.
  const fullState = useLeagueStore((s) => s.fullState);
  const seenThrough = useLeagueStore((s) => s.membership?.resultsSeenThrough ?? null);
  const mode = useLeagueStore((s) => s.mode);
  const leagueId = useLeagueStore((s) => s.leagueId);
  // A tab's "!" grows in only when it turns up while you're looking: not on first paint, not while the
  // league is still loading in. Per league: switching games swaps the tab bar's "!"s in, and that isn't one turning up.
  const [badges, setBadges] = useState({ id: leagueId, ready: false });
  if (badges.id !== leagueId) setBadges({ id: leagueId, ready: false });
  useEffect(() => {
    const t = window.setTimeout(() => setBadges((b) => (b.id === leagueId ? { ...b, ready: true } : b)), 1500);
    return () => window.clearTimeout(t);
  }, [leagueId]);
  const badgesSettled = badges.ready;
  // The tapped tab lights at once (a route can take a moment on a phone); the real page takes over when it lands.
  const [tapped, setTapped] = useState<{ from: string; href: string } | null>(null);
  if (tapped && tapped.from !== pathname) setTapped(null);
  const leagueName = useLeagueStore((s) => s.leagueName);
  const lateJoin = useLateJoin();
  const leagues = useLeagueStore((s) => s.leagues);
  const switchLeague = useLeagueStore((s) => s.switchLeague);
  const isSuperAdmin = useIsSuperAdmin();
  const isAuthenticated = useIsAuthenticated();
  const enterMockMode = useLeagueStore((s) => s.useMock);
  const setEntered = useLeagueStore((s) => s.setEntered);
  const isPreviewingDemo = useIsPreviewingDemo();
  const openReportModal = useReportModalStore((s) => s.openModal);
  const openDemoPicker = useDemoSeasonPickerStore((s) => s.openPicker);
  const myPlayerId = useLeagueStore((s) => s.membership?.playerId ?? null);
  const chatUnread = useChatStore((s) => s.unreadCount);
  const headerAction = useHeaderAction((s) => s.action);
  const terms = useShowTerms();
  const notifications = useNotificationsStore((s) => s.notifications);
  const canManage = useCanManage();
  // The guided tour holds back the tab bar's urgency marks until their step (docs/PLAN-guided-tour.md):
  // with the host on, only a tab the current step points at keeps its "!".
  const tourRunning = useTourRunning();
  const tourStep = useTourStep();
  const startTour = useTourStore((s) => s.start);
  const touring = useLeagueStore((s) => s.touring);
  const practice = usePracticeRound();
  const tourAllows = (target: string) => !tourRunning || !!tourStep?.nav?.targets.includes(target) || !!tourStep?.targets.includes(target);
  const whatsNewCount = useWhatsNewCount();
  const joinCode = leagues.find((l) => l.id === leagueId)?.join_code;
  const activeSeats = state.players.filter((p) => !p.disabled).length;
  // League Settings' rows carry the commissioner's to-dos as dots; this one says there's one inside.
  const commishWaiting = canManage && commissionerItems(state).length > 0;
  // The league's show art for Overview's header (catalog shows.art_url), unless it failed to load.
  const { data: catalog } = useShowCatalog();
  const [artFailed, setArtFailed] = useState<string | null>(null);
  const leagueShow = catalog?.shows.find((sh) => sh.slug === state.settings.showId);
  const showArt = publicMediaSrc(leagueShow?.art_url);
  const artSrc = pathname === "/" && mode === "live" && showArt && showArt !== artFailed ? showArt : null;
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (!artSrc) return;
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [artSrc]);

  const turn = StateLogic.currentDraftTurn(state);
  const draftComplete = !!(turn && turn.isComplete);
  const hasRoster = StateLogic.getLeagueType(state).hasRoster;
  // Whether there's a season to browse at all -- a real league, or the demo one someone stepped
  // into deliberately. Mirrors sidebar.tsx's `hasSeason`, and for the same reason: a signed-in user
  // with no league would otherwise get a tab bar of views onto demo data they never asked for.
  const hasSeason = mode === "live" || isPreviewingDemo;
  // The same six tabs in every game, in episode-night order (docs/PLAN-league-tabs.md): Overview ·
  // Episodes · Scoreboard · [slot 4] · Research · More. Slot 4 is your play (league-tabs.ts): Draft,
  // then Team (Classic) or Lineup (Active Roster); Pick in Eliminator Pool. Its "!" is any of your
  // moves due in this game, from the alert strip's own list, so the two never disagree. Waivers isn't a
  // tab or a More row: it's reached from Team and Lineup. Chat stays on the header's icon.
  const slot = slotFour(state);
  const slotUrgent =
    slotDue(fullState, myPlayerId, seenThrough) || (slot.key === "draft" && notifications.some((n) => n.tab === "/draft"));
  const slotIcon = { draft: DraftIcon, team: TeamIcon, lineup: LineupIcon, pick: PickIcon }[slot.key];
  const leagueTabs: { href: string; label: string; icon: typeof OverviewIcon; urgent?: boolean | null; also?: string[] }[] = [
    { href: "/", label: "Overview", icon: OverviewIcon },
    // The commissioner's results job lives on Episodes.
    { href: "/episodes", label: "Episodes", icon: EpisodesIcon, urgent: episodesDue(fullState, myPlayerId, canManage) ? true : null },
    { href: "/scoreboard", label: "Scoreboard", icon: TrophyIcon },
    // Waivers is pushed on top of Team / Lineup, so that tab stays lit under it.
    { href: slot.href, label: slot.label, icon: slotIcon, urgent: slotUrgent ? true : null, also: slot.key === "team" || slot.key === "lineup" ? ["/waivers"] : [] },
    { href: "/research", label: "Research", icon: ResearchIcon },
  ];
  // No league and not previewing: the only two places worth going are the join/create screen and
  // the demo season (the latter is a state change, not a route -- hence the null href below).
  const tabs = hasSeason
    ? leagueTabs
    : [
        { href: "/dashboard", label: "My Leagues", icon: OverviewIcon },
        { href: "", label: "Demo Season", icon: EpisodesIcon },
      ];

  // The page's own name for the top bar. Overview has none: there the league name is the title. A
  // page under another gets a back that names where it goes (lib/nav-trail.ts: the page you came
  // from, else its parent).
  // Slot 4's pages each draw this league's own slot 4 (team/slot-page.tsx), so they take its name.
  const pageTitle =
    SLOT_PAGES.includes(pathname) && slot.key !== "draft"
      ? slot.label
      : pageTitleFor(pathname, {
          playerName: (id) => state.players.find((p) => p.id === id)?.name,
          tribes: terms.Tribes,
          castaways: terms.castaways,
        });
  const back = useBackTarget();
  // A linked group goes by its one name; the strip under the bar says which game is open.
  const group = useLinkedGroup();
  const headerName = group ? group.name : mode === "mock" ? (leagueName ?? "Demo Mode") : (leagueName ?? "");
  const showStrip = !!group && isLeaguePage(pathname);

  function takeTour() {
    setSheetOpen(false);
    startTour();
    router.push("/");
  }

  // The commissioner's tour starts by creating its league.
  function takeCommissionerTour() {
    setSheetOpen(false);
    startTour("commissioner");
    router.push("/new-league");
  }

  function go(href: string) {
    // The Demo Season slot has no route of its own -- it opens the picker instead of a page (same
    // as the sidebar's row).
    if (!href) {
      closeSheet();
      openDemoPicker();
      return;
    }
    // Not closeSheet(): its history.back() lands AFTER router.push starts and undoes it, so the tap
    // went nowhere. Replacing the sheet's own history entry with the destination closes the sheet
    // and navigates in one step -- and Back from there still goes to the page under the sheet.
    const onSheetEntry = !!window.history.state?.moreSheet;
    setSheetOpen(false);
    if (onSheetEntry) router.replace(href);
    else router.push(href);
  }

  function toggleLeagueMenu() {
    setLeagueMenuOpen((o) => !o);
  }

  async function handleSelectLeague(id: string) {
    setLeagueMenuOpen(false);
    if (id === leagueId) return;
    await switchLeague(id);
    // Always land on Overview after switching -- see league-switcher.tsx's own note.
    router.push("/");
  }

  function handleLogout() {
    // Not closeSheet(): its history.back() could cancel the full page load logOut starts.
    setSheetOpen(false);
    // Shared with the sidebar and Account settings -- see logOut() in auth-client.ts for why this
    // is a full load to "/" rather than a client-side reset.
    logOut();
  }

  // Port of exitDemoMode() -- same as auth-gate.tsx's handleExitDemo/sidebar.tsx's exitDemo.
  // This row only ever shows when !isAuthenticated (see the MoreRow below), so there's no real
  // session to sign out of -- "Sign in" just means "show me the login screen."
  function handleShowLogin() {
    closeSheet();
    enterMockMode();
    setEntered(false);
  }

  return (
    <>
      {/* Overview only: the show's key art, faded, behind the header and the opener plate
          (docs/PLAN-ux-declutter.md, decision 8; the canvas's "A2 · Header art"). A texture, not a
          picture by default: greyscale, low strength, dimmed toward the name and gone before the first
          section (.show-art in globals.css); an admin can give a show more color, strength or a
          different crop (shows.art_style). It sits at the top of the page under everything, so it
          scrolls away with it. A show without art gets the plain ground. */}
      {artSrc && (
        <div aria-hidden className="show-art pointer-events-none absolute inset-x-0 top-0 -z-10 hidden h-[170px] max-nav:block" style={artStyleVars(leagueShow?.art_style)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- art_url can be an arbitrary external URL */}
          <img src={artSrc} alt="" onError={() => setArtFailed(artSrc)} />
        </div>
      )}
      <header
        className={cn(
          "sticky top-[env(safe-area-inset-top,0px)] z-[55] hidden border-b transition-colors max-nav:block",
          // Over the art the bar is clear until the page scrolls under it.
          artSrc && !scrolled ? "border-transparent bg-transparent" : "border-border bg-panel-menu",
        )}
      >
        <div
          className={cn(
            "py-2.5",
            // A titled page is three columns, so the title stays centred whatever the back says.
            pageTitle ? "grid grid-cols-[minmax(34px,1fr)_auto_minmax(34px,1fr)] items-center gap-2 px-3.5" : "flex items-center gap-2.5 pl-4 pr-3.5",
          )}
        >
          {/* No logo (docs/PLAN-ux-declutter.md). A page under another backs up to where you came from,
              named; any other titled page leaves the left column empty. */}
          {pageTitle && <div className="flex min-w-0 items-center">{back && <BackLink target={back} variant="header" />}</div>}
          <div className={cn("relative min-w-0", !pageTitle && "flex-1")}>
            <button
              className={cn("flex w-full min-w-0 items-center gap-1 py-0.5 text-foreground", pageTitle ? "justify-center" : "justify-start")}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={toggleLeagueMenu}
              disabled={mode === "mock" || leagues.length === 0}
              aria-label={pageTitle ? undefined : "Switch league"}
              data-tour="header-league"
            >
              {pageTitle ? (
                // Direction A: every page names itself. The league (or group) name moves up to a small
                // line above the title -- still the switcher.
                <span className="flex min-w-0 flex-col items-center gap-0.5">
                  <span className="flex min-w-0 max-w-full items-center gap-0.5 text-[12px] font-semibold text-muted-foreground">
                    <span className="truncate">{headerName}</span>
                    {mode !== "mock" && <ChevronDownIcon className={cn("h-3.5 w-3.5 shrink-0 transition-transform", leagueMenuOpen && "rotate-180")} />}
                  </span>
                  <span className="type-caption truncate text-[22px]">{pageTitle}</span>
                </span>
              ) : (
                // Overview: the league (or group) name is the page's title, left-aligned like the canvas's
                // A2 pages; in a group, the open game and the show under it, rolling with a swipe.
                <span className="flex min-w-0 flex-col items-start gap-1">
                  <span className="flex min-w-0 max-w-full items-center gap-1">
                    <span className="type-caption truncate text-[26px] leading-none">
                      {/* Signed in with no league yet, this page is My Leagues, not the demo. */}
                      {isAuthenticated && leagues.length === 0 ? "My Leagues" : headerName}
                    </span>
                    {mode !== "mock" && (
                      <ChevronDownIcon className={cn("h-[18px] w-[18px] shrink-0 transition-transform", artSrc && !scrolled ? "text-foreground" : "text-muted-foreground", leagueMenuOpen && "rotate-180")} />
                    )}
                  </span>
                  {group && (
                    <SwipeTitle
                      text={group.games[group.index].detail}
                      textFor={(id) => group.games.find((g) => g.id === id)?.detail ?? ""}
                      // Over the art it needs the ink: muted grey can't reach 7:1 on a picture (check-header-art.js).
                      className={cn("truncate text-[12px] font-semibold", artSrc && !scrolled ? "text-foreground" : "text-muted-foreground")}
                      align="start"
                    />
                  )}
                </span>
              )}
            </button>
          </div>
          {headerAction ? (
            // A page's own actions (header-action-store.ts), in chat's place while that page is open.
            <button
              type="button"
              aria-label={headerAction.label}
              onClick={headerAction.onClick}
              className="-my-1.5 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center justify-self-end text-foreground"
            >
              <MoreHorizontal className="size-[22px]" strokeWidth={2.2} aria-hidden />
            </button>
          ) : lateJoin ? (
            // A late joiner has no chat yet (GhostLogic): their REPLAY / OFF AIR bug stands in its place.
            <ReplayBug />
          ) : (
            <Link
              href="/chat"
              className={cn("relative flex h-[34px] w-[34px] shrink-0 items-center justify-center justify-self-end rounded-full text-foreground", artSrc && !scrolled && "bg-background/80")}
              aria-label="Chat"
              data-tour="header-chat"
            >
              <ChatIcon className="h-[19px] w-[19px]" />
              {chatUnread > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-destructive px-[3px] text-[0.6rem] font-bold text-white ring-2 ring-panel-menu">
                  {chatUnread > 9 ? "9+" : chatUnread}
                </span>
              )}
            </Link>
          )}
        </div>
        {showStrip && <LeagueStrip className="px-4 pb-2.5 pt-1" />}
      </header>

      {/* The league menu: a bottom sheet like every other choice on a phone, not a dropdown. */}
      <BottomSheet
        open={leagueMenuOpen}
        onOpenChange={setLeagueMenuOpen}
        title="Your leagues"
        hideCancel
        footer={
          <LeagueMenuActions
            onGo={(href) => {
              setLeagueMenuOpen(false);
              router.push(href);
            }}
          />
        }
      >
        <div className="-mx-4">
          <LeagueMenu leagues={leagues} leagueId={leagueId} onSelect={handleSelectLeague} />
        </div>
      </BottomSheet>

      {/* translateZ(0): its own compositing layer. Android Chrome sometimes skipped painting this
          fixed bar until a scroll or an animation forced a repaint -- seen on the season-complete
          Overview, where every castaway photo is faded. */}
      <nav
        data-mobile-tabbar
        className="fixed inset-x-0 bottom-0 z-[55] hidden flex-row border-t border-border bg-panel-menu p-[6px_2px] [transform:translateZ(0)] max-nav:flex"
        style={{ paddingBottom: "calc(6px + env(safe-area-inset-bottom, 0px))" }}
      >
        {tabs.map((tab) => {
          const onPage =
            pathname === tab.href ||
            (!!tab.href && tab.href !== "/" && pathname.startsWith(`${tab.href}/`)) ||
            !!tab.also?.some((h) => pathname === h || pathname.startsWith(`${h}/`)) ||
            // The Cast page lives under Episodes, where it's linked from.
            (tab.href === "/episodes" && pathname === "/cast");
          const active = tapped ? tab.href === tapped.href : onPage;
          const Icon = tab.icon;
          const tourId = `tab-${tab.label.toLowerCase()}`;
          const urgent = tourAllows(tourId) ? tab.urgent : null;
          return (
            <button
              key={tab.href}
              data-tour={tourId}
              className={cn("relative flex flex-1 flex-col items-center gap-[3px] px-0.5 py-1.5 pb-[5px] text-muted-foreground active:opacity-60", active && "text-chyron-line")}
              onClick={() => {
                if (tab.href) setTapped({ from: pathname, href: tab.href });
                go(tab.href);
              }}
            >
              <span className="relative inline-flex">
                <Icon className="h-[21px] w-[21px]" />
                {urgent != null && (
                  <TabBadge
                    pop={badgesSettled}
                    className={cn(
                      "absolute -right-2 -top-1 flex h-[15px] w-[15px] items-center justify-center rounded-full text-[0.62rem] font-bold text-white",
                      urgent ? "bg-destructive" : "bg-accent-2"
                    )}
                  />
                )}
              </span>
              <span className="text-[0.63rem] font-semibold">{tab.label}</span>
            </button>
          );
        })}
        <button
          className="flex flex-1 flex-col items-center gap-[3px] px-0.5 py-1.5 pb-[5px] text-muted-foreground active:opacity-60"
          onClick={() => setSheetOpen(true)}
          data-tour="tab-more"
        >
          <span className="relative inline-flex">
            <MoreIcon className="h-[21px] w-[21px]" />
          </span>
          <span className="text-[0.63rem] font-semibold">More</span>
        </button>
      </nav>

      <div
        ref={scrimRef}
        className={cn(
          "fixed inset-0 z-[70] bg-black/40 transition-opacity duration-200",
          sheetOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={closeSheet}
      />
      <div
        ref={sheetRef}
        {...swipe}
        // overscroll-contain: a downward pull at the top is the close gesture, not the browser's
        // pull-to-refresh or a scroll of the page behind.
        className={cn(
          "fixed inset-x-0 bottom-0 z-[71] max-h-[85vh] overflow-y-auto overscroll-contain rounded-t-[14px] bg-card px-4 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] pt-2 shadow-sheet transition-transform duration-200 ease-out motion-reduce:transition-none",
          sheetOpen ? "translate-y-0" : "translate-y-full"
        )}
      >
        {/* touch-action: none -- lets the drag be read as a close gesture instead of the page trying
            to scroll underneath it. */}
        <div
          data-sheet-handle
          className="-mt-1 flex justify-center pb-1.5 pt-2.5"
          style={{ touchAction: "none" }}
        >
          <div className="h-1 w-9 rounded-full bg-border" />
        </div>
        {/* M1 (docs/PLAN-ux-declutter.md): this league first, under a plate that also switches league;
            then you; then Admin; Log out last in red. */}
        {hasSeason && (
          <CaptionPlate
            size="sm"
            tone="quiet"
            tag={state.settings.wikiSeason != null ? `S${state.settings.wikiSeason}` : "League"}
            title={mode === "live" || touring ? (leagueName ?? "") : "Demo season"}
            subtitle={[
              [terms.showName, state.settings.wikiSeason].filter((x) => x != null && x !== "").join(" "),
              StateLogic.getLeagueType(state).name,
              `${activeSeats} player${activeSeats === 1 ? "" : "s"}`,
            ]
              .filter(Boolean)
              .join(" · ")}
            {...(mode === "live" && leagues.length > 0
              ? {
                  action: "Switch",
                  onClick: () => {
                    closeSheet();
                    setLeagueMenuOpen(true);
                  },
                }
              : {})}
          />
        )}
        <div className="mt-2.5 flex flex-col">
          {/* The finished draft, kept as a board to look back at (roster games). */}
          {hasSeason && hasRoster && draftComplete && <MoreRow icon={DraftIcon} label="Draft board" value="Done" onClick={() => go("/draft")} />}
          {hasSeason && mode === "live" && (
            <MoreRow
              icon={InfoIcon}
              label="How this league works"
              value="1 min"
              onClick={() => {
                closeSheet();
                showExplainer(true);
              }}
            />
          )}
          {hasSeason && practice.available && (
            <MoreRow
              icon={DraftIcon}
              label="Practice round"
              value="2 min"
              onClick={() => {
                setSheetOpen(false);
                practice.start();
              }}
            />
          )}
          {hasSeason && (
            <MoreRow icon={GearIcon} label="League Settings" value={joinCode ? `Code ${joinCode}` : undefined} dot={commishWaiting} onClick={() => go("/setup")} />
          )}
          {!hasSeason && <MoreRow icon={OverviewIcon} label="My Leagues" onClick={() => go("/dashboard")} />}
        </div>

        <div className="type-caption px-0.5 pb-1.5 pt-3.5 text-[14px] tracking-[0.04em] text-muted-foreground">You</div>
        <div className="flex flex-col">
          {/* Report an issue posts as the real signed-in user (server-side requireAuth) -- gated on real
              authentication, not `mode` (a super-admin with no personal league is genuinely signed in
              but stays mode:'mock' -- see store.ts's useIsAuthenticated). */}
          {isAuthenticated ? (
            <>
              <MoreRow icon={UserIcon} label="Account" value="Appearance, notifications" onClick={() => go("/account")} />
              <MoreRow
                icon={SparklesIcon}
                label="What's new"
                value={whatsNewCount > 0 ? `${whatsNewCount} new` : undefined}
                onClick={() => {
                  closeSheet();
                  showWhatsNew();
                }}
              />
              <MoreRow
                icon={AlertIcon}
                label="Report an issue"
                onClick={() => {
                  setSheetOpen(false);
                  openReportModal();
                }}
              />
            </>
          ) : (
            // No account to keep it on: the theme stays here while touring. Not a MoreRow -- it's a
            // setting changed in place, so the sheet stays open.
            <div className="flex min-h-[50px] items-center gap-3.5 border-t border-border text-base font-semibold">
              <MoonIcon className="size-5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">Appearance</span>
              <ThemePicker className="w-[172px] max-w-[55%] shrink-0" />
            </div>
          )}
          {/* Picking one replaces the view with demo data, the same as the sidebar's Demo season. */}
          <MoreRow icon={SparklesIcon} label={touring ? "Replay the tour" : "Take the tour"} value="3 min" onClick={takeTour} />
          <MoreRow icon={SparklesIcon} label="Commissioner tour" value="2 min" onClick={takeCommissionerTour} />
          <MoreRow icon={EpisodesIcon} label="Demo season" onClick={() => go("")} />
          {isSuperAdmin && <MoreRow icon={ShieldIcon} label="Admin" value="Shows, users, results" onClick={() => go("/admin")} />}
          <MoreRow
            icon={LogoutIcon}
            label={isAuthenticated ? "Log out" : "Sign in"}
            onClick={isAuthenticated ? handleLogout : handleShowLogin}
            danger={isAuthenticated}
          />
        </div>
      </div>
    </>
  );
}

/** The tab bar's "!": plays `badge-in` if it mounted after the bar settled, i.e. it appeared while you watched. */
function TabBadge({ pop, className }: { pop: boolean; className: string }) {
  const [play] = useState(pop); // decided when it appears; a re-render never replays it
  return <span className={cn(className, play && "badge-in")}>!</span>;
}

function MoreRow({
  icon: Icon,
  label,
  value,
  urgent,
  dot,
  onClick,
  danger,
  tour,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  /** Its current value, muted on the right ("Done", "Code HXG27Y", "2 new"). */
  value?: string;
  /** The tab bar's "needs you" mark. */
  urgent?: boolean;
  /** A chyron dot: something here needs the commissioner. */
  dot?: boolean;
  onClick: () => void;
  danger?: boolean;
  /** Its `data-tour` name, when the guided tour points at it. */
  tour?: string;
}) {
  return (
    <button
      data-tour={tour}
      className={cn(
        "flex min-h-[50px] w-full items-center gap-3.5 border-t border-border text-left text-base font-semibold outline-none hover:bg-accent/40 focus-visible:bg-accent",
        danger ? "text-destructive" : "text-foreground",
      )}
      onClick={onClick}
    >
      <Icon className={cn("size-5 shrink-0", danger ? "text-destructive" : "text-muted-foreground")} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {urgent && (
        <span className="flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-destructive px-1 text-[0.65rem] font-bold text-white">!</span>
      )}
      {dot && <span className="size-2 shrink-0 rounded-full bg-chyron-line" aria-label="Needs attention" />}
      {value && <span className="shrink-0 text-[13px] font-medium text-muted-foreground">{value}</span>}
      {!danger && <ChevronRight className="size-[18px] shrink-0 text-muted-foreground" strokeWidth={2.2} aria-hidden />}
    </button>
  );
}

