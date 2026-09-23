"use client";

import { useEffect, useState, type ReactNode } from "react";
import { api, ApiError } from "@/lib/api";
import { useLeagueStore } from "@/lib/store";
import { Button } from "@/components/ui/button";

type Status = "checking" | "loggedOut" | "loading" | "ready" | "error";

// Validates the real API-wiring path (CORS + session cookies + StateLogic against real Postgres
// data) alongside the existing mock-data path. On mount, tries GET /api/auth/me: if a session
// cookie already exists (e.g. from using the live app in the same browser) it loads that user's
// first league's real state straight away; otherwise shows a small login form. Either way, the
// mock dataset stays one click away via useMock() -- this doesn't replace the demo path, it adds
// a second, real one next to it for comparison.
export function AuthGate({ children }: { children: ReactNode }) {
  const { mode, leagueName, loadLive, useMock } = useLeagueStore();
  const [status, setStatus] = useState<Status>("checking");
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function loadFirstLeague() {
    const me = await api.me();
    if (me.leagues.length === 0) {
      setError(`Signed in as ${me.user.username}, but that account has no leagues.`);
      setStatus("error");
      return;
    }
    const { league, state } = await api.leagueState(me.leagues[0].id);
    loadLive(state, league.name);
    setStatus("ready");
  }

  useEffect(() => {
    setStatus("loading");
    loadFirstLeague().catch(() => setStatus("loggedOut"));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    try {
      await api.login(username, password);
      await loadFirstLeague();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reach the API server.");
      setStatus("loggedOut");
    }
  }

  if (status === "checking" || status === "loading") {
    return <div className="mx-auto max-w-4xl px-4 py-16 text-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (status === "ready" && mode === "live") {
    return (
      <div>
        <div className="mx-auto max-w-4xl px-4 pt-4 sm:px-6">
          <div className="flex items-center justify-between rounded-md border border-good/30 bg-good/10 px-3 py-1.5 text-xs text-good">
            <span>Live data from &ldquo;{leagueName}&rdquo; via the real API</span>
            <button className="underline underline-offset-2" onClick={useMock}>
              Switch to demo data
            </button>
          </div>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div>
      <div className="mx-auto max-w-sm px-4 py-16 sm:px-6">
        <h1 className="mb-1 text-xl font-bold">Sign in</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Uses the real SurvivorDraft API ({process.env.NEXT_PUBLIC_API_BASE}) over CORS.
        </p>
        <form onSubmit={handleLogin} className="flex flex-col gap-3">
          <input
            className="rounded-md border border-border bg-card px-3 py-2 text-sm"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
          <input
            className="rounded-md border border-border bg-card px-3 py-2 text-sm"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit">Sign in</Button>
        </form>
        <div className="mt-4 border-t border-border pt-4">
          <Button variant="secondary" className="w-full" onClick={useMock}>
            Skip — use demo data instead
          </Button>
        </div>
      </div>
      {mode === "mock" && children}
    </div>
  );
}
