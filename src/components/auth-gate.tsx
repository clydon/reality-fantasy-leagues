"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { signInWithIdentifier } from "@/lib/auth-client";
import { useLeagueStore, useIsPreviewingDemo, useIsAuthenticated } from "@/lib/store";
import { useTourDirector, useTourRunning, useTourStore } from "@/lib/tour/tour-store";
import { TourHost } from "@/components/tour/tour-host";
import { DemoBar } from "@/components/demo-bar";
import { Sidebar } from "@/components/sidebar";
import { LoginScreen } from "@/components/login-screen";
import { MobileNav } from "@/components/mobile-nav/mobile-nav";
import { ReportModal } from "@/components/report-modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DemoSeasonPicker } from "@/components/demo-season-picker";
import { BootOverlay } from "@/components/boot-overlay";
import { InstallHint } from "@/components/install-hint";
import { Dashboard } from "@/components/dashboard/dashboard";
import { useLeaguePoll } from "@/lib/use-league-poll";
import { ActionBar } from "@/components/action-bar";
import { WhatsNewModal } from "@/components/whats-new-modal";
import { rememberedLeague, reloadedLeague } from "@/lib/last-league";
import { Button } from "@/components/ui/button";
import { ResultsInBanner, RevealSheet } from "@/components/results-in-banner";
import { CatchUpSheet, ReplayBug } from "@/components/late-join/replay-bug";
import StateLogic from "@/lib/game/state-logic.js";
import { LeagueSwipe } from "@/components/league-swipe";
import { AdminMobileChrome, AdminSidebar, isAdminRoute } from "@/components/admin/admin-shell";
import { useRecordNavTrail } from "@/lib/nav-trail";

type Status = "checking" | "idle" | "loading";

// Password recovery bypasses this gate entirely: both are reached from an emailed link with no
// session, and neither has anything to do with a league.
const BARE_ROUTES = ["/forgot-password", "/reset-password"];

// Routes that mean something without a league loaded, so the zero-leagues case below leaves them
// alone instead of substituting the Dashboard: the Dashboard itself, the admin pages a leagueless
// super-admin can still use, and account settings.
const LEAGUELESS_ROUTES = ["/dashboard", "/reports", "/account"];

// Full-screen flows: signed in, but no sidebar, tab bar or alert strip. The page brings its own
// header and its own way out (the create-league flow, docs/PLAN-ux-redesign.md 2a; the reveal,
// /reveal/N, which mustn't sit under an alert strip or a tab bar that could give results away).
// /late-join: a late joiner choosing where to start (late-join-flow.tsx).
const FULLSCREEN_ROUTES = ["/new-league", "/reveal", "/late-join"];
const isFullscreen = (pathname: string) => FULLSCREEN_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));

// Owns the same top-level branch the live app's boot()/renderLoginScreen() do: either the login
// screen (no sidebar at all -- see public/index.html's <aside style="display:none">, only shown
// once renderTabs() runs after auth) or the full sidebar+content shell, never both at once. An
// earlier version of this component rendered the login form and the app shell stacked on the
// same page in the fallback case -- this rewrite makes the two states properly exclusive via
// `entered`, matching the original's actual behavior instead of approximating it.
export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Where each page's back goes (lib/nav-trail.ts).
  useRecordNavTrail();
  const queryClient = useQueryClient();
  const mode = useLeagueStore((s) => s.mode);
  const loadLive = useLeagueStore((s) => s.loadLive);
  const enterMockMode = useLeagueStore((s) => s.useMock); // renamed locally -- a plain callback, not a hook, but eslint's rule flags anything named use*
  const setIdentity = useLeagueStore((s) => s.setIdentity);
  const setLeagues = useLeagueStore((s) => s.setLeagues);
  const impersonating = useLeagueStore((s) => s.impersonating);
  const leagues = useLeagueStore((s) => s.leagues);
  const demoPreview = useLeagueStore((s) => s.demoPreview);
  const loadingLeague = useLeagueStore((s) => s.loadingLeague);
  const flash = useLeagueStore((s) => s.flash);
  const setFlash = useLeagueStore((s) => s.setFlash);
  const isAuthenticated = useIsAuthenticated();
  // Lives in the store, not local state, so Sidebar/MobileNav can flip it back to false for
  // "Sign in"/"Exit Tour" while previewing mock data -- see useIsPreviewingDemo.
  const entered = useLeagueStore((s) => s.entered);
  const setEntered = useLeagueStore((s) => s.setEntered);
  const isPreviewingDemo = useIsPreviewingDemo();
  const startTour = useTourStore((s) => s.start);
  const tourRunning = useTourRunning();
  const [status, setStatus] = useState<Status>("checking");
  const [error, setError] = useState<string | null>(null);
  const [signedInUsername, setSignedInUsername] = useState<string | null>(null);
  const router = useRouter();
  // A late joiner who hasn't chosen where to start has nothing to play yet (StateLogic.GhostLogic):
  // every league page sends them to /late-join until they have.
  const needsStart = useLeagueStore((s) => s.mode === "live" && StateLogic.GhostLogic.needsStart(s.rawState, s.membership?.playerId));
  const toLateJoin = entered && needsStart && !isFullscreen(pathname) && !LEAGUELESS_ROUTES.includes(pathname) && !isAdminRoute(pathname);
  useEffect(() => {
    if (toLateJoin) router.replace("/late-join");
  }, [toLateJoin, router]);

  // Internally gated on mode === 'live' (see use-league-poll.ts) -- safe to call unconditionally
  // here regardless of auth state, matching the Rules of Hooks.
  useLeaguePoll();
  // The guided tour's league plays itself forward (computer players, episodes airing) -- inert unless
  // the tour's league is loaded.
  useTourDirector();

  async function loadFirstLeague() {
    const me = await api.me();
    // "My Leagues" reflects real membership only, even for a super-admin (see the live app's
    // server/routes/auth.js) -- identity is set regardless; with no leagues the render below
    // shows the Dashboard (join/create/invites) rather than demo data.
    setIdentity(me.user.id, me.user.isSuperAdmin, me.impersonating);
    setSignedInUsername(me.user.username);
    setLeagues(me.leagues);
    if (me.leagues.length > 0) {
      // A push notification link carries ?league=<id> (see push-events.ts), so tapping "your turn to
      // draft" opens THAT league rather than whichever one happens to be first. Honoured only if
      // it's one of the user's own leagues; otherwise fall back to the first as before.
      // Otherwise a reload (pull-to-refresh) stays put; and opening the app goes back to the league
      // last open in this browser -- or, when that one's linked, to its group's favorite (0046).
      const wanted = new URLSearchParams(window.location.search).get("league");
      const byId = (id: string | null) => me.leagues.find((l) => l.id === id);
      const last = byId(rememberedLeague(me.user.id)) ?? me.leagues[0];
      const target = byId(wanted) ?? byId(reloadedLeague(me.user.id)) ?? byId(last.landOn) ?? last;
      // The Overview layout is fetched alongside the league so the boot overlay covers both --
      // otherwise Overview briefly renders its cards in the default order, then jumps to the saved
      // one. prefetchQuery never throws, so a failed fetch just falls back to the default order.
      const [{ league, state, membership, playerAccounts }] = await Promise.all([
        api.leagueState(target.id),
        queryClient.prefetchQuery({ queryKey: ["overview-layout"], queryFn: () => api.getOverviewLayout(), staleTime: 60_000 }),
      ]);
      loadLive(league.id, state, league.name, membership, me.user.id, me.user.isSuperAdmin, playerAccounts);
    }
    setEntered(true);
  }

  useEffect(() => {
    // Silent check for an existing session (e.g. already logged into the live app in this same
    // browser) -- failing this is the normal, expected first-load case, not an error to surface.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFirstLeague()
      .catch(() => {})
      .finally(() => setStatus("idle"));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLogin(identifier: string, password: string) {
    setStatus("loading");
    setError(null);
    try {
      const result = await signInWithIdentifier(identifier, password);
      if (result.error) {
        setError(result.error.message || "Couldn't sign in.");
        return;
      }
      await loadFirstLeague();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setStatus("idle");
    }
  }

  // "Take a Tour" is the guided tour (docs/PLAN-guided-tour.md) on its own made-up season. The
  // unguided demo season picker is still in More -> Demo season.
  function handleSkip() {
    enterMockMode();
    startTour();
    setEntered(true);
  }

  // Port of exitDemoMode() (public/app.js). Two distinct cases share this one banner/button:
  // - Previewing without an account ("Take a Tour"): there's no real session to fall back to
  //   (useMock() clears identity), so this means "show the login screen."
  // - An already-signed-in user who clicked "Switch to demo data" (Sidebar's previewDemo()):
  //   their session cookie never went away, so a full reload re-runs loadFirstLeague() against
  //   it and lands them back on their real league -- same reasoning as handleStopImpersonating
  //   below, simpler and more robust than trying to patch every piece of client state back by
  //   hand. Reset the mock state in the tour case too (not just hide it) so a stale demo edit
  //   isn't still sitting there if they skip back into the tour again later.
  function handleExitDemo() {
    if (isAuthenticated) {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/";
      return;
    }
    enterMockMode();
    setEntered(false);
  }

  // Port of stopImpersonating() (public/app.js): a full reload re-runs AuthGate's own
  // loadFirstLeague from scratch against the now-restored session, exactly like the live app's
  // boot() re-run -- simpler and more robust than trying to patch every piece of client state
  // (store identity, loaded league, membership, playerAccounts) back by hand.
  async function handleStopImpersonating() {
    await api.stopImpersonating();
    // Deliberately a full reload, not router.push() -- see the comment above this function.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/";
  }

  if (BARE_ROUTES.includes(pathname)) {
    return <div className="min-h-screen bg-background px-4 py-10">{children}</div>;
  }

  // One loading screen for both "we don't know who you are yet" and "a league is on its way".
  // The second half matters as much as the first: every path that swaps the loaded league
  // (initial load, the switcher, join/create) goes through the store's loadingLeague flag, and
  // whatever is in `state` until it resolves is the demo season. Rendering the shell over that is
  // what flashed a grid of demo cast members after creating a league.
  if (status === "checking" || loadingLeague) {
    return <BootOverlay />;
  }

  // Signing up is how you get a session, so /account has to render before there is one -- but only
  // then. Once signed in it goes through the shell below like any other page, which is what gives
  // a brand-new account a way off it (it used to be a dead end with no navigation at all).
  if (pathname === "/account" && !entered) {
    return <div className="min-h-screen bg-background px-4 py-10">{children}</div>;
  }

  if (!entered) {
    return <LoginScreen onLogin={handleLogin} onSkip={handleSkip} error={error} loading={status === "loading"} />;
  }

  if (isFullscreen(pathname)) {
    return (
      <div className="min-h-dvh bg-background">
        <ConfirmDialog />
        {/* The commissioner's tour opens on creating a league. Not the reveal: that's the broadcast,
            and the tour's host waits for it to finish. */}
        {pathname === "/new-league" && <TourHost />}
        {children}
      </div>
    );
  }

  const impersonationBanner = impersonating && (
    <div className="sticky top-0 z-[1000] flex items-center justify-center gap-2 bg-[#5089c4] px-3 py-2.5 text-center text-[0.85rem] text-white">
      Viewing as <b>{signedInUsername}</b> — this is exactly what they see.
      <Button variant="secondary" size="sm" onClick={handleStopImpersonating}>
        Return to my account
      </Button>
    </div>
  );

  // A signed-in user with no league gets the Dashboard (join/create/invites) where a league tab
  // would be -- there's no league to show one for. It renders INSIDE the shell now rather than as
  // a bare page: a new account's first screen was otherwise three buttons and a log-out link, with
  // no navigation, no way to reach the demo season, and nothing that looked like the app. The
  // unauthenticated "Take a Tour" path is untouched, and so is an authenticated user who chose to
  // preview the demo (demoPreview) -- they get the real tabs over demo data.
  const leaguelessUser = isAuthenticated && leagues.length === 0 && mode === "mock" && !demoPreview;
  const showsDashboard = leaguelessUser && !LEAGUELESS_ROUTES.includes(pathname);

  // The admin area (docs/PLAN-ux-redesign.md 3a) has its own chrome: its own header and tab bar on a
  // phone, its own sidebar on desktop, and no league alert strip, swipe or install banner -- none of
  // those are about running the site, and the strip could name a league's results in passing. It
  // works the same for a super-admin with no league of their own.
  if (isAdminRoute(pathname)) {
    return (
      <>
        {impersonationBanner}
        <AdminMobileChrome />
        <ReportModal />
        <ConfirmDialog />
        <WhatsNewModal />
        <div className="flex min-h-screen items-stretch">
          <div className="max-nav:hidden">
            <AdminSidebar />
          </div>
          <main className="min-w-0 max-w-[1060px] flex-1 px-11 pb-[90px] pt-9 max-nav:max-w-full max-nav:px-4 max-nav:pb-[calc(84px+env(safe-area-inset-bottom,0px))] max-nav:pt-4">
            {children}
          </main>
        </div>
      </>
    );
  }

  // Matches .app-shell / main's exact layout from public/styles.css (flex, sidebar + a
  // width-capped content column with 36px/44px/90px padding on desktop; below the 880px
  // breakpoint the sidebar disappears entirely in favor of MobileNav's top/bottom bars, and
  // main's padding shrinks to 16px sides with extra bottom clearance for the fixed bottom bar --
  // see body.in-league's rules in public/styles.css).
  //
  // MobileNav renders outside the sidebar+main flex row on purpose: its top bar uses
  // position:sticky (not fixed), which still participates in normal flex layout as a sibling --
  // nested inside the row, it became a flex item squeezing main's width on mobile instead of
  // stacking above it.
  return (
    <>
      {impersonationBanner}
      {/* Port of the live app's persistent "🎬 Exit Demo" button (public/index.html's
          #exitDemoBtn) -- always visible while previewing without an account, not tucked away as
          a footer link only, so there's an obvious way back to the login screen. Now also carries
          the show/game-type switcher and the episode scrubber -- see demo-bar.tsx. */}
      {/* Hidden while the tour's host is on: its pickers and scrubber would break the script. */}
      {isPreviewingDemo && !tourRunning && <DemoBar onExit={handleExitDemo} />}
      <MobileNav />
      <ReportModal />
      <DemoSeasonPicker />
      <ConfirmDialog />
      <RevealSheet />
      <CatchUpSheet />
      <WhatsNewModal />
      <TourHost />
      {/* Phones only -- desktop browsers have their own install affordance (an icon in the address
          bar) that doesn't need this app repeating it. See install-hint.tsx's own comment on why
          the dismissal is remembered in localStorage rather than shown every visit. */}
      <div className="max-nav:block hidden">
        <InstallHint variant="banner" />
      </div>
      <div className="flex min-h-screen items-stretch">
        <div className="max-nav:hidden">
          <Sidebar />
        </div>
        <main className="min-w-0 max-w-[980px] flex-1 px-11 pb-[90px] pt-9 max-nav:max-w-full max-nav:px-4 max-nav:pb-[calc(84px+env(safe-area-inset-bottom,0px)+var(--tour-h,0px))] max-nav:pt-4">
          {/* Only worth saying on a page that isn't already the join/create screen -- on the
              Dashboard itself it was telling people to go where they already are. */}
          {leaguelessUser && !showsDashboard && pathname !== "/dashboard" && (
            <div className="mb-4 rounded-md border border-border bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground">
              Signed in as {signedInUsername} — no league yet.{" "}
              <Link href="/dashboard" className="font-semibold text-chyron-line hover:underline">
                Join or create one
              </Link>
              .
            </div>
          )}
          {/* Anything due in any of your leagues, on every page (renders nothing when there's none). */}
          {/* The tour holds back the alert strip and the reveal prompt: its host says what's next. */}
          {/* Desktop's REPLAY bug; on a phone it's in the top bar (mobile-nav.tsx). */}
          <ReplayBug variant="page" className="mb-4 max-nav:hidden" />
          {!tourRunning && <ResultsInBanner />}
          {!tourRunning && <ActionBar />}
          {flash && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-chyron-line/30 bg-accent px-3 py-2 text-sm">
              <span className="flex-1">{flash}</span>
              <button className="text-xs font-semibold text-muted-foreground hover:text-foreground" onClick={() => setFlash(null)}>
                Dismiss
              </button>
            </div>
          )}
          {/* Linked leagues swipe left/right -- see league-swipe.tsx. */}
          {showsDashboard ? <Dashboard /> : <LeagueSwipe>{children}</LeagueSwipe>}
        </main>
      </div>
    </>
  );
}
