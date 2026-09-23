"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { signInWithIdentifier } from "@/lib/auth-client";
import { useLeagueStore } from "@/lib/store";
import { Sidebar } from "@/components/sidebar";
import { LoginScreen } from "@/components/login-screen";
import { MobileNav } from "@/components/mobile-nav/mobile-nav";
import { ReportModal } from "@/components/report-modal";
import { useLeaguePoll } from "@/lib/use-league-poll";
import { Button } from "@/components/ui/button";

type Status = "checking" | "idle" | "loading";

// /account, /forgot-password, /reset-password bypass this gate entirely rather than being nested
// inside "entered" league-scoped content -- they need to stay reachable before a session exists
// (signing up IS how you get one) and while mock/demo mode is active.
const PUBLIC_ROUTES = ["/account", "/forgot-password", "/reset-password"];

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
  const [status, setStatus] = useState<Status>("checking");
  const [entered, setEntered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedInUsername, setSignedInUsername] = useState<string | null>(null);

  // Internally gated on mode === 'live' (see use-league-poll.ts) -- safe to call unconditionally
  // here regardless of auth state, matching the Rules of Hooks.
  useLeaguePoll();

  async function loadFirstLeague() {
    const me = await api.me();
    // "My Leagues" reflects real membership only, even for a super-admin (see the live app's
    // server/routes/auth.js) -- identity is set regardless, so a pure super-admin with no
    // personal league still enters the app (with demo data underneath) rather than getting stuck.
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
      {impersonating && (
        <div className="sticky top-0 z-[1000] flex items-center justify-center gap-2 bg-[#5089c4] px-3 py-2.5 text-center text-[0.85rem] text-white">
          Viewing as <b>{signedInUsername}</b> — this is exactly what they see.
          <Button variant="secondary" size="sm" onClick={handleStopImpersonating}>
            Return to my account
          </Button>
        </div>
      )}
      <MobileNav />
      <ReportModal />
      <div className="flex min-h-screen items-stretch">
        <div className="max-nav:hidden">
          <Sidebar />
        </div>
        <main className="min-w-0 max-w-[980px] flex-1 px-11 pb-[90px] pt-9 max-nav:max-w-full max-nav:px-4 max-nav:pb-[calc(84px+env(safe-area-inset-bottom,0px))] max-nav:pt-4">
          {signedInUsername && mode === "mock" && (
            <div className="mb-4 rounded-md border border-border bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground">
              Signed in as {signedInUsername} — no personal league, so these tabs show demo data. Admin tab uses your
              real account.
            </div>
          )}
          {children}
        </main>
      </div>
    </>
  );
}
