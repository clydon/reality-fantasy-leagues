"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { cn } from "cn";
import StateLogic from "@/lib/game/state-logic.js";
import type { MyInvite } from "@/lib/game/types";
import { api, ApiError } from "@/lib/api";
import { useLeagueStore, useIsAuthenticated } from "@/lib/store";
import { Wordmark } from "@/components/auth/wordmark";
import { PlainButton } from "@/components/draft/draft-ui";
import { Chip, PrimaryButton, fieldCls } from "@/components/setup/settings-ui";
import { CaptionPlate } from "@/components/ui/caption-plate";
import { useDemoSeasonPickerStore } from "@/lib/demo-season-picker-store";

// My Leagues: your leagues, any invites, and the two ways into a new one -- New league (the
// full-screen flow at /new-league, docs/PLAN-ux-redesign.md 2a) and Join with a code. AuthGate shows
// it automatically to a signed-in user with zero leagues (instead of demo data), inside the shell;
// /dashboard renders it too, from the sidebar and the league switcher.
export function Dashboard() {
  const router = useRouter();
  const isAuthenticated = useIsAuthenticated();
  const leagues = useLeagueStore((s) => s.leagues);
  const currentId = useLeagueStore((s) => (s.mode === "live" ? s.leagueId : null));
  const setLeagues = useLeagueStore((s) => s.setLeagues);
  const switchLeague = useLeagueStore((s) => s.switchLeague);
  const setFlash = useLeagueStore((s) => s.setFlash);
  const enterMockMode = useLeagueStore((s) => s.useMock);
  const setEntered = useLeagueStore((s) => s.setEntered);
  const openDemoPicker = useDemoSeasonPickerStore((s) => s.openPicker);
  const [invites, setInvites] = useState<MyInvite[]>([]);
  const [joining, setJoining] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null); // which action is in flight
  const [error, setError] = useState<string | null>(null);

  // The league menu's "Join with a code" lands here as ?join=1, with the code field already open.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from the URL after hydration
    if (new URLSearchParams(window.location.search).has("join")) setJoining(true);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    api
      .myInvites()
      .then((r) => !cancelled && setInvites(r.invites))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  // Same end state as AuthGate's loadFirstLeague: refreshed league list, the target league loaded
  // live, then Overview. switchLeague BEFORE setLeagues, and both before the push: the other way
  // round, `leagues` is non-empty (so AuthGate renders the league shell) while `state` is still the
  // demo season, which flashed a grid of demo cast. switchLeague holds the store's loadingLeague flag
  // meanwhile, so the shell shows a loading screen instead.
  async function enterLeague(leagueId: string, message: string | null) {
    const me = await api.me();
    await switchLeague(leagueId);
    setLeagues(me.leagues);
    if (message) setFlash(message);
    router.push("/");
  }

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(null);
    }
  }

  const joinedMessage = (name: string, reclaimed: boolean) =>
    reclaimed ? `Welcome back to ${name}. Your previous roster has been restored.` : `You joined ${name}!`;

  function handleJoin() {
    const code = joinCode.trim();
    if (!code) return;
    run("join", async () => {
      const { league, reclaimed } = await api.joinLeague(code);
      await enterLeague(league.id, joinedMessage(league.name, reclaimed));
    });
  }

  function handleAccept(invite: MyInvite) {
    run(`accept-${invite.id}`, async () => {
      const { league, reclaimed } = await api.acceptInvite(invite.id);
      await enterLeague(league.id, joinedMessage(league.name, reclaimed));
    });
  }

  // One tap for a stack of invites (inviting someone to every linked league sends one each). Joins
  // them in turn, so one that fails -- a league that's since gone -- doesn't stop the rest, then opens
  // the first league joined.
  function handleAcceptAll() {
    run("accept-all", async () => {
      const joined: { id: string; name: string }[] = [];
      const failed: MyInvite[] = [];
      for (const inv of invites) {
        try {
          joined.push((await api.acceptInvite(inv.id)).league);
        } catch {
          failed.push(inv);
        }
      }
      setInvites(failed);
      if (failed.length) setError(`Couldn't join ${failed.map((i) => i.league_name).join(", ")}. Try again.`);
      if (joined.length) await enterLeague(joined[0].id, `You joined ${joined.map((l) => l.name).join(", ")}!`);
    });
  }

  function handleDecline(invite: MyInvite) {
    run(`decline-${invite.id}`, async () => {
      await api.declineInvite(invite.id);
      setInvites((list) => list.filter((i) => i.id !== invite.id));
    });
  }

  function openLeague(id: string) {
    if (id === currentId) return router.push("/");
    run(`open-${id}`, () => enterLeague(id, null));
  }

  function handleShowLogin() {
    enterMockMode();
    setEntered(false);
    router.push("/");
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto flex w-full max-w-[480px] flex-col gap-4 pb-16">
        <Wordmark className="mx-auto" />
        <p className="text-base">Sign in to join or create a league.</p>
        <PrimaryButton onClick={handleShowLogin}>Sign in</PrimaryButton>
      </div>
    );
  }

  // No league and no invite: the first-run screen instead of an empty list.
  const empty = leagues.length === 0 && invites.length === 0;
  const joinForm = (
    <form
      className="flex flex-col gap-1.5 py-3"
      onSubmit={(e) => {
        e.preventDefault();
        handleJoin();
      }}
    >
      <label htmlFor="join-code" className="text-sm font-semibold">
        Join code
      </label>
      <div className="flex gap-2">
        <input
          id="join-code"
          className={`${fieldCls} min-w-0 flex-1 uppercase placeholder:normal-case`}
          placeholder="K7WQ2M"
          autoComplete="off"
          autoCapitalize="characters"
          autoFocus
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
        />
        <PrimaryButton type="submit" disabled={!!busy || !joinCode.trim()}>
          {busy === "join" ? "Joining…" : "Join"}
        </PrimaryButton>
      </div>
    </form>
  );

  return (
    <div className="flex w-full max-w-[640px] flex-col gap-6 pb-16">
      <h2 className={cn("type-caption text-[28px] max-nav:hidden", empty && "hidden")}>My Leagues</h2>

      {error && (
        <p role="alert" className="text-sm font-semibold text-live">
          {error}
        </p>
      )}

      {invites.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <h3 className="type-caption flex-1 text-[22px]">You&rsquo;re invited</h3>
            {invites.length > 1 && (
              <PrimaryButton className="min-h-11 px-4" disabled={!!busy} onClick={handleAcceptAll}>
                {busy === "accept-all" ? "Joining…" : `Accept all ${invites.length}`}
              </PrimaryButton>
            )}
          </div>
          <div className="flex flex-col border-b border-border [&>*]:border-t [&>*]:border-border">
            {invites.map((inv) => (
              <div key={inv.id} className="flex min-h-[60px] flex-wrap items-center gap-2 py-2">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-base font-semibold">{inv.league_name}</span>
                  <span className="text-[13px] text-muted-foreground">
                    {inv.seat_name ? `To take over ${inv.seat_name}'s team · ` : ""}From {inv.invited_by_username ?? "a league member"}
                  </span>
                </span>
                <PrimaryButton className="min-h-11 px-4" disabled={!!busy} onClick={() => handleAccept(inv)}>
                  {busy === `accept-${inv.id}` ? "Joining…" : "Accept"}
                </PrimaryButton>
                <PlainButton className="min-h-11" disabled={!!busy} onClick={() => handleDecline(inv)}>
                  Decline
                </PlainButton>
              </div>
            ))}
          </div>
        </section>
      )}

      {leagues.length > 0 && (
        <div className="flex flex-col border-b border-border [&>*]:border-t [&>*]:border-border">
          {leagues.map((l) => (
            <button
              key={l.id}
              type="button"
              disabled={!!busy}
              onClick={() => openLeague(l.id)}
              className="flex min-h-[60px] items-center gap-3 py-2 text-left outline-none hover:bg-accent/40 focus-visible:bg-accent"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-center gap-2 text-base font-semibold">
                  <span className="truncate">{l.name}</span>
                  {l.id === currentId && <Chip>Open</Chip>}
                </span>
                <span className="truncate text-[13px] text-muted-foreground">
                  {[StateLogic.LEAGUE_TYPES[l.type]?.name, l.role === "commissioner" ? "Commissioner" : null].filter(Boolean).join(" · ")}
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" strokeWidth={2.2} aria-hidden />
            </button>
          ))}
        </div>
      )}

      {empty ? (
        // First run: one caption for the thing to do, then the two other ways in as quiet rows -- a
        // code from a friend, or the demo season to see how a week plays.
        <section className="flex flex-col gap-6 pt-2 nav:pt-8">
          <div className="flex flex-col gap-3">
            <h2 className="type-caption text-[40px] leading-[0.95] text-balance nav:text-[52px]">Start your first league</h2>
            <p className="max-w-[44ch] text-base text-muted-foreground">
              Turn the show you watch into a league with your group. Draft its cast, play along each episode, and see results only when
              you&rsquo;ve watched.
            </p>
          </div>
          <CaptionPlate tag="New" href="/new-league" title="New league" subtitle="Pick the show, invite your group" action="Start" actionTone="chyron" />
          <div className="flex flex-col border-b border-border">
            <QuietRow title="Join with a code" detail="Got one from a friend? Enter it here." open={joining} onClick={() => setJoining((j) => !j)} />
            {joining && joinForm}
            <QuietRow title="Play the demo season" detail="A real season, ready to try every screen." onClick={openDemoPicker} />
          </div>
        </section>
      ) : (
      <div className="flex gap-2.5">
        <Link
          href="/new-league"
          className="flex min-h-[52px] flex-1 items-center justify-center gap-1.5 rounded-[3px] bg-chyron px-4 text-[15px] font-bold text-chyron-foreground transition-[filter] hover:brightness-[1.06] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line"
        >
          <Plus className="size-[18px]" strokeWidth={2.4} aria-hidden />
          New league
        </Link>
        <PlainButton className="min-h-[52px] flex-1" onClick={() => setJoining((j) => !j)}>
          Join with a code
        </PlainButton>
      </div>
      )}

      {joining && !empty && joinForm}
    </div>
  );
}

// A secondary way in on the first-run screen: a hairline row, title and one line, its chevron
// turning down while its panel (the join form) is open.
function QuietRow({ title, detail, open, onClick }: { title: string; detail: string; open?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onClick}
      className="flex min-h-[64px] items-center gap-3 border-t border-border py-2.5 text-left outline-none hover:bg-accent/40 focus-visible:bg-accent"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-base font-semibold">{title}</span>
        <span className="text-[13px] text-muted-foreground">{detail}</span>
      </span>
      <ChevronRight className={cn("size-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} strokeWidth={2.2} aria-hidden />
    </button>
  );
}

