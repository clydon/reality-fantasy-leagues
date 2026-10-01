import { create } from "zustand";
import type { LeagueState, Membership } from "@/lib/game/types";
import { buildMockSeasonState } from "@/lib/game/mock-state";
import { buildDemoState, demoSelfPlayerId, type DemoSeasonData, type DemoLeagueTypeId } from "@/lib/game/demo-season-builder";
import { api, type MeResponse } from "@/lib/api";
import { rememberLeague } from "@/lib/last-league";
import StateLogic from "@/lib/game/state-logic.js";

export type LeagueSummary = MeResponse["leagues"][number];

// POC-scoped store: one league's state, exactly like the live app's single global `state`
// object (see CLAUDE.md's state model) but through Zustand instead of a bare global. Two
// sources: the ported mock/demo dataset (matches the live app's demo mode), or `state` fetched
// live from the real Express API (see src/lib/api.ts + AuthGate) -- `mode` tracks which one is
// currently displayed so the UI can show a "Demo data" indicator when it's not real, and so
// components can branch their mutations exactly like app.js's `isDemoMode` checks do (see
// CLAUDE.md: "isDemoMode is checked at the top of nearly every mutator").
//
// Mock mode mirrors the live app's actual demo-mode behavior, not an idealized one: full
// commissioner powers (propose/delete/grade bets) but no personal player identity to guess with
// -- enterDemoMode() in public/app.js never sets currentMembership either, so canGuess is false
// there too. See canManage()/canGuess() below.
export interface PlayerAccount {
  player_id: string;
  role: string;
  username: string;
}

interface LeagueStore {
  // Whether AuthGate has finished its initial decision and is showing the app shell (mock or
  // live) rather than the login screen. Lives here, not as AuthGate's own local state, so any
  // component (Sidebar, MobileNav) can flip it back to false to return to the login screen --
  // needed for "Sign in"/"Exit Tour" while previewing mock data, see auth-gate.tsx.
  entered: boolean;
  setEntered: (entered: boolean) => void;
  mode: "mock" | "live";
  // What every screen displays. In a live league this is the viewer's copy, with any results they
  // haven't revealed yet held back (spoiler protection, StateLogic.SpoilerLogic); `fullState` is the
  // league as it really is, for the few things that must see past that (the "Results are in!"
  // banner, the action bar). Identical outside live mode.
  state: LeagueState;
  fullState: LeagueState;
  // Spoiler protection: this member has now seen results through episode n -- shows them, and
  // records it on the server.
  markResultsSeen: (n: number) => void;
  leagueId: string | null;
  leagueName: string | null;
  membership: Membership | null;
  userId: string | null; // the signed-in user's own id (not their player id) -- chat reactions/ownership key off this, same as public/app.js's currentUser.id
  isSuperAdmin: boolean; // global account flag, independent of role within the currently-loaded league -- gates the Admin tab, same as public/app.js's currentUser.isSuperAdmin
  // True while a super-admin is impersonating another user (GET /api/auth/me's `impersonating`
  // flag) -- drives the "Viewing as X — Return to my account" banner, port of the live app's
  // updateImpersonationBanner()/currentUser.impersonating.
  impersonating: boolean;
  // Which player each account is linked to, for League Settings' Players section -- previously
  // fetched by api.leagueState() but discarded, since nothing needed it until now.
  playerAccounts: PlayerAccount[];
  // Every league the signed-in user belongs to (GET /api/auth/me), for the league switcher --
  // previously fetched by AuthGate's loadFirstLeague() and discarded after picking leagues[0].
  leagues: LeagueSummary[];
  setLeagues: (leagues: LeagueSummary[]) => void;
  // Keeps the switcher's copy of a league in step with an edit made elsewhere. `leagues` comes
  // from GET /api/me and was previously only ever replaced wholesale on load, so renaming a league
  // in League Settings or deleting one in Admin left the sidebar showing the old list until a
  // reload -- the rename/delete call sites now say so here instead of re-fetching /me for one
  // field.
  renameLeagueLocally: (leagueId: string, name: string) => void;
  removeLeagueLocally: (leagueId: string) => void;
  // True while a league is being fetched and swapped in (initial load, switcher, join/create).
  // AuthGate holds the shell on a loading screen for the duration: without it the shell renders
  // the instant `leagues` changes but before the real state arrives, and what's underneath is the
  // demo season -- which is how creating a league flashed a grid of demo cast members.
  loadingLeague: boolean;
  setLoadingLeague: (loading: boolean) => void;
  // Loads a different one of `leagues` as the active league, same request sequence
  // loadFirstLeague() already does for the initial load.
  switchLeague: (leagueId: string) => Promise<void>;
  useMock: () => void;
  // True only while an already-signed-in user is previewing demo data via "Switch to demo data"
  // (Sidebar) -- unlike useMock(), does NOT clear userId/leagues/etc, so there's still a real
  // session to fall back to. Drives useIsPreviewingDemo's banner for this case, since that hook's
  // original `!userId` check is false here by design. See auth-gate.tsx's handleExitDemo.
  demoPreview: boolean;
  previewDemo: () => void;
  // The Demo Season picker (demo-season-picker.tsx): once a season's data has been fetched, it's
  // cached here so scrubbing the episode cursor rebuilds `state` from it instantly, with no refetch.
  // `demoEpisodeCursor` is the "as of episode N" view; null (no season chosen yet) means the plain
  // generic mock season (buildMockSeasonState) that mode:'mock' has always defaulted to.
  demoSeasonData: DemoSeasonData | null;
  demoLeagueTypeId: DemoLeagueTypeId | null;
  demoEpisodeCursor: number | null;
  chooseDemoSeason: (data: DemoSeasonData, leagueTypeId: DemoLeagueTypeId) => void;
  // Switching show or game type from the demo bar's own dropdowns (demo-bar.tsx), once a season is
  // already loaded -- unlike chooseDemoSeason (the picker's first entry, always jumps to the last
  // episode and navigates to Overview), this keeps whatever page and episode cursor you're on,
  // clamped to the new season's own episode count if it has fewer.
  switchDemoSeason: (data: DemoSeasonData, leagueTypeId: DemoLeagueTypeId) => void;
  setDemoEpisodeCursor: (n: number) => void;
  // Demo bar's "Commissioner view" checkbox: whether the demo shows full commissioner powers (the
  // default -- mock mode has always meant "full powers, no real member restrictions") or a regular
  // member's own view, so a super admin can see what a non-commissioner player actually experiences.
  // Only meaningful once a demo season is chosen -- see useCanManage's comment for where this is
  // actually read. Always resets to true on a fresh chooseDemoSeason.
  demoCommissionerView: boolean;
  setDemoCommissionerView: (value: boolean) => void;
  loadLive: (
    leagueId: string,
    state: LeagueState,
    leagueName: string,
    membership: Membership,
    userId: string,
    isSuperAdmin: boolean,
    playerAccounts: PlayerAccount[]
  ) => void;
  setState: (state: LeagueState) => void;
  // Separate from loadLive: "My Leagues" (GET /api/auth/me) reflects real membership only, even
  // for a super-admin (see the live app's server/routes/auth.js comment on that route) -- a pure
  // super-admin with no personal league would never reach loadLive at all otherwise, yet the
  // Admin tab needs their identity regardless of whether they have a league of their own to view.
  setIdentity: (userId: string, isSuperAdmin: boolean, impersonating: boolean) => void;
  // Port of pollForNotifications()'s deliberately-narrow state patch: only midSeason is synced
  // from a background poll, not the whole state object, so a poll landing mid-edit elsewhere
  // (e.g. a half-filled Episode form) can't clobber it. See use-league-poll.ts.
  setMidSeason: (midSeason: LeagueState["midSeason"]) => void;
  // The same kind of narrow patch for Active Roster lineups: each episode's `lineups` (and its lock
  // and air time) from a fresh poll, so the Board shows other players' starters soon after they set
  // them -- without the whole-state overwrite the narrow patches exist to avoid.
  syncLineups: (fresh: LeagueState) => void;
  // Drops the loaded league (back to mode:'mock' with demo state underneath) WITHOUT clearing
  // identity, unlike useMock() -- for leaving your last league, where AuthGate should then show
  // the Dashboard to a still-signed-in user rather than treat them as an anonymous tour.
  clearLeague: () => void;
  // One-off message shown above the current tab (e.g. "Welcome back" after reclaiming a seat) --
  // there's no toast system in this app, so this is the lightweight equivalent.
  flash: string | null;
  setFlash: (flash: string | null) => void;
}

export const useLeagueStore = create<LeagueStore>((set, get) => ({
  entered: false,
  setEntered: (entered) => set({ entered }),
  mode: "mock",
  state: buildMockSeasonState(),
  fullState: buildMockSeasonState(),
  leagueId: null,
  leagueName: null,
  membership: null,
  userId: null,
  isSuperAdmin: false,
  impersonating: false,
  playerAccounts: [],
  leagues: [],
  demoPreview: false,
  demoSeasonData: null,
  demoLeagueTypeId: null,
  demoEpisodeCursor: null,
  demoCommissionerView: true,
  setDemoCommissionerView: (value) => set({ demoCommissionerView: value }),
  useMock: () =>
    set({
      mode: "mock",
      state: buildMockSeasonState(),
      leagueId: null,
      leagueName: null,
      membership: null,
      userId: null,
      isSuperAdmin: false,
      impersonating: false,
      playerAccounts: [],
      leagues: [],
      flash: null,
      demoPreview: false,
      demoSeasonData: null,
      demoLeagueTypeId: null,
      demoEpisodeCursor: null,
      demoCommissionerView: true,
    }),
  previewDemo: () =>
    set({
      mode: "mock",
      state: buildMockSeasonState(),
      leagueId: null,
      leagueName: null,
      membership: null,
      playerAccounts: [],
      flash: null,
      demoPreview: true,
      demoSeasonData: null,
      demoLeagueTypeId: null,
      demoEpisodeCursor: null,
      demoCommissionerView: true,
    }),
  // Chosen from the Demo Season picker (demo-season-picker.tsx) -- defaults to viewing the whole,
  // finished season (the last episode) rather than episode 1, since "browse a completed season" is
  // the actual use case; scrubbing backward from there is the exception, not the starting point.
  //
  // Sets a real membership (commissioner + a playerId, demoSelfPlayerId) unlike the plain generic
  // mock season's membership:null -- the demo plays from inside the league (your roster/picks
  // highlighted, able to set lineups and make picks) rather than pure commissioner god-mode. See
  // useCanGuess's comment for the other half of what that unlocks.
  chooseDemoSeason: (data, leagueTypeId) =>
    set({
      mode: "mock",
      state: buildDemoState(data, leagueTypeId, data.episodeCount),
      leagueId: null,
      leagueName: null,
      membership: { role: "commissioner", playerId: demoSelfPlayerId(data) },
      playerAccounts: [],
      flash: null,
      demoPreview: true,
      demoSeasonData: data,
      demoLeagueTypeId: leagueTypeId,
      demoEpisodeCursor: data.episodeCount,
      demoCommissionerView: true,
    }),
  switchDemoSeason: (data, leagueTypeId) => {
    const cursor = Math.min(get().demoEpisodeCursor ?? data.episodeCount, data.episodeCount);
    set({
      state: buildDemoState(data, leagueTypeId, cursor),
      membership: { role: "commissioner", playerId: demoSelfPlayerId(data) },
      demoSeasonData: data,
      demoLeagueTypeId: leagueTypeId,
      demoEpisodeCursor: cursor,
    });
  },
  setDemoEpisodeCursor: (n) => {
    const { demoSeasonData: data, demoLeagueTypeId: leagueTypeId } = get();
    if (!data || !leagueTypeId) return;
    const cursor = Math.max(1, Math.min(n, data.episodeCount));
    set({ state: buildDemoState(data, leagueTypeId, cursor), demoEpisodeCursor: cursor });
  },
  loadLive: (leagueId, state, leagueName, membership, userId, isSuperAdmin, playerAccounts) => {
    rememberLeague(userId, leagueId);
    set({
      mode: "live",
      leagueId,
      state: spoilerView(state, membership),
      fullState: state,
      leagueName,
      membership,
      userId,
      isSuperAdmin,
      playerAccounts,
      demoPreview: false,
      demoSeasonData: null,
      demoLeagueTypeId: null,
      demoEpisodeCursor: null,
      demoCommissionerView: true,
    });
  },
  setIdentity: (userId, isSuperAdmin, impersonating) => set({ userId, isSuperAdmin, impersonating }),
  setLeagues: (leagues) => set({ leagues }),
  renameLeagueLocally: (leagueId, name) =>
    set((s) => ({
      leagues: s.leagues.map((l) => (l.id === leagueId ? { ...l, name } : l)),
      leagueName: s.leagueId === leagueId ? name : s.leagueName,
    })),
  removeLeagueLocally: (leagueId) => set((s) => ({ leagues: s.leagues.filter((l) => l.id !== leagueId) })),
  loadingLeague: false,
  setLoadingLeague: (loadingLeague) => set({ loadingLeague }),
  switchLeague: async (leagueId) => {
    set({ loadingLeague: true });
    try {
      const { league, state, membership, playerAccounts } = await api.leagueState(leagueId);
      rememberLeague(get().userId, league.id);
      set({
        mode: "live",
        leagueId: league.id,
        state: spoilerView(state, membership),
        fullState: state,
        leagueName: league.name,
        membership,
        playerAccounts,
        demoPreview: false,
        demoSeasonData: null,
        demoLeagueTypeId: null,
        demoEpisodeCursor: null,
        demoCommissionerView: true,
      });
    } finally {
      set({ loadingLeague: false });
    }
  },
  setMidSeason: (midSeason) => set({ state: { ...get().state, midSeason }, fullState: { ...get().fullState, midSeason } }),
  syncLineups: (fresh) => {
    const byId = new Map(fresh.episodes.map((e) => [e.id, e]));
    const patch = (st: LeagueState): LeagueState => ({
      ...st,
      episodes: st.episodes.map((ep) => {
        const f = byId.get(ep.id);
        return f ? { ...ep, lineups: f.lineups, lineupsLocked: f.lineupsLocked, airsAt: f.airsAt } : ep;
      }),
    });
    set({ state: patch(get().state), fullState: patch(get().fullState) });
  },
  clearLeague: () =>
    set({
      mode: "mock",
      state: buildMockSeasonState(),
      leagueId: null,
      leagueName: null,
      membership: null,
      playerAccounts: [],
      demoSeasonData: null,
      demoLeagueTypeId: null,
      demoEpisodeCursor: null,
      demoCommissionerView: true,
    }),
  flash: null,
  setFlash: (flash) => set({ flash }),
  // Mock-mode mutators (StateLogic.*) mutate `state` in place, same as the live app; spreading it
  // into a new top-level object is what actually triggers Zustand/React to notice the change.
  setState: (state) => {
    const full = { ...state };
    set({ fullState: full, state: get().mode === "live" ? spoilerView(full, get().membership) : full });
  },
  markResultsSeen: (n) => {
    const { membership, fullState, leagueId, mode } = get();
    const seen = membership?.resultsSeenThrough;
    if (!membership || seen === null || seen === undefined || n <= seen) return;
    const next = { ...membership, resultsSeenThrough: n };
    set({ membership: next, state: spoilerView(fullState, next) });
    if (mode === "live" && leagueId) api.markResultsSeen(leagueId, n).catch(() => {});
  },
}));

// The viewer's copy of a live league: results after their "seen through" mark held back.
function spoilerView(state: LeagueState, membership: Membership | null): LeagueState {
  const seen = membership?.resultsSeenThrough;
  return seen === null || seen === undefined ? state : StateLogic.SpoilerLogic.viewThrough(state, seen);
}

// Proper selector hooks (not getState() snapshots) so components re-render when mode/membership
// change on their own, not only incidentally alongside a `state` update.
//
// Mock mode has always meant "full commissioner powers" outright (matching the live app's own demo
// mode) -- EXCEPT once a real Demo Season is loaded (demoSeasonData set) and the demo bar's
// "Commissioner view" checkbox has been switched off, which exists so a super admin previewing a
// demo can see what a regular member actually experiences. The plain generic mock season (no chosen
// demo, demoSeasonData null) keeps the old unconditional-true behavior; there's no toggle for it.
export function useCanManage(): boolean {
  return useLeagueStore((s) => {
    if (s.mode !== "mock") return s.membership?.role === "commissioner";
    if (s.demoSeasonData) return s.demoCommissionerView;
    return true;
  });
}

// Was `mode !== 'mock' && ...` -- the plain generic mock season has no personal player identity to
// guess with (membership stays null there, same as the live app's own demo mode), but a Demo Season
// picker season DOES have one (chooseDemoSeason sets membership.playerId to demoSelfPlayerId), and
// should be able to make picks/lineups/bet guesses from inside the league same as a real member. The
// membership.playerId check alone already excludes the plain generic season, so dropping the mode
// gate only changes behavior for a chosen demo season.
export function useCanGuess(): boolean {
  return useLeagueStore((s) => !!s.membership?.playerId);
}

export function useMyPlayerId(): string | null {
  return useLeagueStore((s) => s.membership?.playerId ?? null);
}

// Whether there's a real, signed-in SurvivorDraft session -- NOT the same as `mode === 'live'`,
// which only flips once a real league also loads. A super-admin with no personal league is
// genuinely authenticated (userId set via setIdentity) but stays mode:'mock' since there's no
// league state to show; features that just need "a real user, for a request the server will
// authenticate" (e.g. submitting a report) should check this, not mode.
export function useIsAuthenticated(): boolean {
  return useLeagueStore((s) => !!s.userId);
}

export function useIsSuperAdmin(): boolean {
  return useLeagueStore((s) => s.isSuperAdmin);
}

export function useIsImpersonating(): boolean {
  return useLeagueStore((s) => s.impersonating);
}

// True for the "Take a Tour" / previewing-without-an-account case (mock mode with no identity),
// OR an already-signed-in user deliberately previewing demo data via "Switch to demo data" (the
// `demoPreview` flag -- see previewDemo() in the store). Not just any mock mode: a real signed-in
// super-admin with zero personal leagues also stays mode:'mock' (see useIsAuthenticated's
// comment) but isn't previewing anything, they're just leagueless. Drives the exit-demo
// affordance (see auth-gate.tsx).
export function useIsPreviewingDemo(): boolean {
  return useLeagueStore((s) => s.mode === "mock" && (!s.userId || s.demoPreview));
}
