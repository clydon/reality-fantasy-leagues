"use client";

import { useEffect, useState, type ReactNode } from "react";
import { api, ApiError } from "@/lib/api";
import { useLeagueStore } from "@/lib/store";
import { Sidebar } from "@/components/sidebar";
import { LoginScreen } from "@/components/login-screen";

type Status = "checking" | "idle" | "loading";

// Owns the same top-level branch the live app's boot()/renderLoginScreen() do: either the login
// screen (no sidebar at all -- see public/index.html's <aside style="display:none">, only shown
// once renderTabs() runs after auth) or the full sidebar+content shell, never both at once. An
// earlier version of this component rendered the login form and the app shell stacked on the
// same page in the fallback case -- this rewrite makes the two states properly exclusive via
// `entered`, matching the original's actual behavior instead of approximating it.
export function AuthGate({ children }: { children: ReactNode }) {
  const mode = useLeagueStore((s) => s.mode);
  const loadLive = useLeagueStore((s) => s.loadLive);
  const enterMockMode = useLeagueStore((s) => s.useMock); // renamed locally -- a plain callback, not a hook, but eslint's rule flags anything named use*
  const setIdentity = useLeagueStore((s) => s.setIdentity);
  const [status, setStatus] = useState<Status>("checking");
  const [entered, setEntered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedInUsername, setSignedInUsername] = useState<string | null>(null);

  async function loadFirstLeague() {
    const me = await api.me();
    // "My Leagues" reflects real membership only, even for a super-admin (see the live app's
    // server/routes/auth.js) -- identity is set regardless, so a pure super-admin with no
    // personal league still enters the app (with demo data underneath) rather than getting stuck.
    setIdentity(me.user.id, me.user.isSuperAdmin);
    setSignedInUsername(me.user.username);
    if (me.leagues.length > 0) {
      const { league, state, membership } = await api.leagueState(me.leagues[0].id);
      loadLive(league.id, state, league.name, membership, me.user.id, me.user.isSuperAdmin);
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

  async function handleLogin(username: string, password: string) {
    setStatus("loading");
    setError(null);
    try {
      await api.login(username, password);
      await loadFirstLeague();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reach the API server.");
    } finally {
      setStatus("idle");
    }
  }

  function handleSkip() {
    enterMockMode();
    setEntered(true);
  }

  if (status === "checking") {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (!entered) {
    return <LoginScreen onLogin={handleLogin} onSkip={handleSkip} error={error} loading={status === "loading"} />;
  }

  // Matches .app-shell / main's exact layout from public/styles.css (flex, sidebar + a
  // width-capped content column with 36px/44px/90px padding), not a centered max-w column.
  return (
    <div className="flex min-h-screen items-stretch">
      <Sidebar />
      <main className="min-w-0 max-w-[980px] flex-1 px-11 pb-[90px] pt-9">
        {signedInUsername && mode === "mock" && (
          <div className="mb-4 rounded-md border border-border bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground">
            Signed in as {signedInUsername} — no personal league, so these tabs show demo data. Admin tab uses your real
            account.
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
