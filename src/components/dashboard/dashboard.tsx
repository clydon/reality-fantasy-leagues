"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { MyInvite } from "@/lib/game/types";
import { api, ApiError } from "@/lib/api";
import { useLeagueStore, useIsAuthenticated } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandLogo } from "@/components/brand-logo";

const PANEL = "mb-4 rounded-lg border border-border bg-card p-[18px_20px] shadow-sm";
const PANEL_TITLE = "mb-2.5 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground";

// Port of the live app's renderDashboard() landing page -- a full page with no Sidebar/MobileNav
// chrome, same as the original had no tabs there either. AuthGate shows it automatically to a
// signed-in user with zero leagues (instead of demo data); /dashboard renders it standalone too,
// reachable from the league switcher for joining/creating an additional league. Pending invites
// (league_invites) sit above join/create, same real-estate the live app used for this.
export function Dashboard() {
  const router = useRouter();
  const isAuthenticated = useIsAuthenticated();
  const mode = useLeagueStore((s) => s.mode);
  const leagueName = useLeagueStore((s) => s.leagueName);
  const setLeagues = useLeagueStore((s) => s.setLeagues);
  const switchLeague = useLeagueStore((s) => s.switchLeague);
  const setFlash = useLeagueStore((s) => s.setFlash);
  const enterMockMode = useLeagueStore((s) => s.useMock);
  const setEntered = useLeagueStore((s) => s.setEntered);
  const [username, setUsername] = useState<string | null>(null);
  const [invites, setInvites] = useState<MyInvite[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState<string | null>(null); // which action is in flight
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    api
      .me()
      .then((me) => !cancelled && setUsername(me.user.username))
      .catch(() => {});
    api
      .myInvites()
      .then((r) => !cancelled && setInvites(r.invites))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  // Same end state as AuthGate's loadFirstLeague: refreshed league list, the target league loaded
  // live -- then into a tab. `to` exists because a league you just CREATED has nothing to show on
  // Overview: no show, no season, no cast. It goes to League Settings instead, where guided setup
  // asks for those. Joining an existing league still lands on Overview, which is where the
  // interesting thing is.
  async function enterLeague(leagueId: string, message: string, to = "/") {
    const me = await api.me();
    // switchLeague BEFORE setLeagues, and both before the push. Going the other way round put the
    // store in a state it can't render honestly: `leagues` is non-empty (so AuthGate stops showing
    // the Dashboard and renders the league shell) while `state` is still the demo season -- which
    // is why creating a league flashed a grid of demo cast members. switchLeague also holds the
    // store's loadingLeague flag for its duration, so the shell shows a loading screen rather than
    // whatever was underneath.
    await switchLeague(leagueId);
    setLeagues(me.leagues);
    setFlash(message);
    router.push(to);
  }

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong — try again.");
    } finally {
      setBusy(null);
    }
  }

  const joinedMessage = (name: string, reclaimed: boolean) =>
    reclaimed ? `Welcome back to ${name} — your previous roster has been restored.` : `You joined ${name}!`;

  function handleJoin() {
    const code = joinCode.trim();
    if (!code) return;
    run("join", async () => {
      const { league, reclaimed } = await api.joinLeague(code);
      await enterLeague(league.id, joinedMessage(league.name, reclaimed));
    });
  }

  function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    run("create", async () => {
      const { league } = await api.createLeague(name);
      await enterLeague(
        league.id,
        `Created ${league.name}. Set it up below, then share join code ${league.join_code} or send invites.`,
        "/setup"
      );
    });
  }

  function handleAccept(invite: MyInvite) {
    run(`accept-${invite.id}`, async () => {
      const { league, reclaimed } = await api.acceptInvite(invite.id);
      await enterLeague(league.id, joinedMessage(league.name, reclaimed));
    });
  }

  function handleDecline(invite: MyInvite) {
    run(`decline-${invite.id}`, async () => {
      await api.declineInvite(invite.id);
      setInvites((list) => list.filter((i) => i.id !== invite.id));
    });
  }

  function handleShowLogin() {
    enterMockMode();
    setEntered(false);
    router.push("/");
  }

  return (
    <div className="mx-auto w-full max-w-[480px] pb-16">
      {/* Branding only when this is the whole screen. Signed in, it renders inside the app shell,
          whose sidebar already carries the logo -- two of them stacked just pushed the actual
          join/create controls down the page. */}
      {!isAuthenticated && (
        <BrandLogo kind="banner" className="mx-auto mb-2 block h-auto w-full max-w-[360px]" priority />
      )}

      {!isAuthenticated ? (
        <div className={PANEL}>
          <p className="mb-3 text-sm">Sign in to join or create a league.</p>
          <Button onClick={handleShowLogin}>Sign in</Button>
        </div>
      ) : (
        <>
          {/* Admin and Log out used to live here too. They're account-level, they're in the
              sidebar and the mobile More sheet now, and this page is no longer the only screen a
              leagueless user can see -- so repeating them here was just three of the four things
              on an otherwise empty page. */}
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="flex-1">{username ? <>Signed in as <b className="text-foreground">{username}</b></> : null}</span>
            {mode === "live" && leagueName && (
              <button className="font-semibold text-primary hover:underline" onClick={() => router.push("/")}>
                ← Back to {leagueName}
              </button>
            )}
          </div>

          {error && <p className="mb-3 rounded-md border border-destructive/30 bg-card px-3 py-2 text-sm text-destructive">{error}</p>}

          {invites.length > 0 && (
            <div className={`${PANEL} border-primary/40`}>
              <h3 className={PANEL_TITLE}>You&apos;re invited</h3>
              <div className="flex flex-col gap-2">
                {invites.map((inv) => (
                  <div key={inv.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{inv.league_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {inv.seat_name ? `To take over ${inv.seat_name}'s team · ` : ""}Invited by {inv.invited_by_username ?? "a league member"}
                      </div>
                    </div>
                    <Button size="sm" disabled={!!busy} onClick={() => handleAccept(inv)}>
                      {busy === `accept-${inv.id}` ? "Joining…" : "Accept"}
                    </Button>
                    <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => handleDecline(inv)}>
                      Decline
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={PANEL}>
            <h3 className={PANEL_TITLE}>Join a League</h3>
            <div className="flex gap-1.5">
              <Input
                className="min-w-0 flex-1 uppercase placeholder:normal-case"
                placeholder="Join code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              />
              <Button onClick={handleJoin} disabled={!!busy || !joinCode.trim()}>
                {busy === "join" ? "Joining…" : "Join"}
              </Button>
            </div>
          </div>

          <div className={PANEL}>
            <h3 className={PANEL_TITLE}>Create a League</h3>
            <div className="flex gap-1.5">
              <Input
                className="min-w-0 flex-1"
                placeholder="League name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              <Button onClick={handleCreate} disabled={!!busy || !newName.trim()}>
                {busy === "create" ? "Creating…" : "Create"}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">You&apos;ll be the commissioner and the first player.</p>
          </div>
        </>
      )}
    </div>
  );
}
