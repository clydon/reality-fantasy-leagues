"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { signInWithIdentifier } from "@/lib/auth-client";
import { useLeagueStore, useIsPreviewingDemo, useIsAuthenticated } from "@/lib/store";
import { Sidebar } from "@/components/sidebar";
import { LoginScreen } from "@/components/login-screen";
import { MobileNav } from "@/components/mobile-nav/mobile-nav";
import { ReportModal } from "@/components/report-modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Dashboard } from "@/components/dashboard/dashboard";
import { useLeaguePoll } from "@/lib/use-league-poll";
import { Button } from "@/components/ui/button";

type Status = "checking" | "idle" | "loading";

// /account, /forgot-password, /reset-password bypass this gate entirely rather than being nested
// inside "entered" league-scoped content -- they need to stay reachable before a session exists
// (signing up IS how you get one) and while mock/demo mode is active.
const PUBLIC_ROUTES = ["/account", "/forgot-password", "/reset-password"];

// Full-page routes that skip the Sidebar/MobileNav shell once entered -- the Dashboard is a
// landing page, not a league tab (same as the live app's renderDashboard() having no tabs).
const STANDALONE_ROUTES = ["/dashboard"];

// Pages a leagueless super-admin can still reach inside the app shell -- otherwise AuthGate's
// zero-leagues case sends every route to the Dashboard (see below).
const ADMIN_ROUTES = ["/admin", "/reports"];

// Owns the same top-level branch the live app's boot()/renderLoginScreen() do: either the login
// screen (no sidebar at all -- see public/index.html's <aside style="display:none">, only shown
// once renderTabs() runs after auth) or the full sidebar+content shell, never both at once. An
// earlier version of this component rendered the login form and the app shell stacked on the
// same page in the fallback case -- this rewrite makes the two states properly exclusive via
// `entered`, matching the original's actual behavior instead of approximating it.
export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const mode = useLeagueStore((s) => s.mode);
  const loadLive = useLeagueStore((s) => s.loadLive);
  const enterMockMode = useLeagueStore((s) => s.useMock); // renamed locally -- a plain callback, not a hook, but eslint's rule flags anything named use*
  const setIdentity = useLeagueStore((s) => s.setIdentity);
  const setLeagues = useLeagueStore((s) => s.setLeagues);
  const impersonating = useLeagueStore((s) => s.impersonating);
  const leagues = useLeagueStore((s) => s.leagues);
  const isSuperAdmin = useLeagueStore((s) => s.isSuperAdmin);
  const flash = useLeagueStore((s) => s.flash);
  const setFlash = useLeagueStore((s) => s.setFlash);
  const isAuthenticated = useIsAuthenticated();
  // Lives in the store, not local state, so Sidebar/MobileNav can flip it back to false for
  // "Sign in"/"Exit Tour" while previewing mock data -- see useIsPreviewingDemo.
  const entered = useLeagueStore((s) => s.entered);
  const setEntered = useLeagueStore((s) => s.setEntered);
  const isPreviewingDemo = useIsPreviewingDemo();
  const [status, setStatus] = useState<Status>("checking");
  const [error, setError] = useState<string | null>(null);
  const [signedInUsername, setSignedInUsername] = useState<string | null>(null);

  // Internally gated on mode === 'live' (see use-league-poll.ts) -- safe to call unconditionally
  // here regardless of auth state, matching the Rules of Hooks.
  useLeaguePoll();

  async function loadFirstLeague() {
    const me = await api.me();
    // "My Leagues" reflects real membership only, even for a super-admin (see the live app's
    // server/routes/auth.js) -- identity is set regardless; with no leagues the render below
    // shows the Dashboard (join/create/invites) rather than demo data.
    setIdentity(me.user.id, me.user.isSuperAdmin, me.impersonating);
    setSignedInUsername(me.user.username);
    setLeagues(me.leagues);
    if (me.leagues.length > 0) {
      const { league, state, membership, playerAccounts } = await api.leagueState(me.leagues[0].id);
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

  function handleSkip() {
    enterMockMode();
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

  if (PUBLIC_ROUTES.includes(pathname)) {
    return <div className="min-h-screen bg-background px-4 py-10">{children}</div>;
  }

  if (status === "checking") {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (!entered) {
    return <LoginScreen onLogin={handleLogin} onSkip={handleSkip} error={error} loading={status === "loading"} />;
  }

  const impersonationBanner = impersonating && (
    <div className="sticky top-0 z-[1000] flex items-center justify-center gap-2 bg-[#5089c4] px-3 py-2.5 text-center text-[0.85rem] text-white">
      Viewing as <b>{signedInUsername}</b> — this is exactly what they see.
      <Button variant="secondary" size="sm" onClick={handleStopImpersonating}>
        Return to my account
      </Button>
    </div>
  );

  // A signed-in user with no league gets the Dashboard (join/create/invites) instead of demo
  // data -- the unauthenticated "Take a Tour" path is untouched. /dashboard itself always renders
  // standalone (its page is the Dashboard; it handles the not-signed-in case on its own).
  const leaguelessUser =
    isAuthenticated && leagues.length === 0 && mode === "mock" && !(isSuperAdmin && ADMIN_ROUTES.includes(pathname));
  if (STANDALONE_ROUTES.includes(pathname) || leaguelessUser) {
    return (
      <>
        {impersonationBanner}
        {STANDALONE_ROUTES.includes(pathname) ? children : <Dashboard />}
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
          a footer link only, so there's an obvious way back to the login screen. */}
      {isPreviewingDemo && (
        <div className="sticky top-0 z-[1000] flex items-center justify-center gap-2 bg-primary px-3 py-2.5 text-center text-[0.85rem] text-primary-foreground">
          🎬 Previewing demo data — nothing here is saved.
          <Button variant="secondary" size="sm" onClick={handleExitDemo}>
            Exit Tour
          </Button>
        </div>
      )}
      <MobileNav />
      <ReportModal />
      <ConfirmDialog />
      <div className="flex min-h-screen items-stretch">
        <div className="max-nav:hidden">
          <Sidebar />
        </div>
        <main className="min-w-0 max-w-[980px] flex-1 px-11 pb-[90px] pt-9 max-nav:max-w-full max-nav:px-4 max-nav:pb-[calc(84px+env(safe-area-inset-bottom,0px))] max-nav:pt-4">
          {isAuthenticated && mode === "mock" && (
            <div className="mb-4 rounded-md border border-border bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground">
              Signed in as {signedInUsername} — no personal league yet.{" "}
              <Link href="/dashboard" className="font-semibold text-primary hover:underline">
                Join or create one
              </Link>
              .
            </div>
          )}
          {flash && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-primary/30 bg-[#fbeee8] px-3 py-2 text-sm">
              <span className="flex-1">{flash}</span>
              <button className="text-xs font-semibold text-muted-foreground hover:text-foreground" onClick={() => setFlash(null)}>
                Dismiss
              </button>
            </div>
          )}
          {children}
        </main>
      </div>
    </>
  );
}
