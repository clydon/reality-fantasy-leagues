import { create } from "zustand";
import type { AdminUser, AdminLeague, AdminMembership, Player } from "@/lib/game/types";
import { api } from "@/lib/api";

// Admin is cross-league (all users, all leagues), not scoped to the single league
// useLeagueStore holds -- and unlike every other tab, it has no mock-mode equivalent at all: the
// live app never shows its Admin nav link to non-super-admins in the first place, demo mode
// included. So this store only ever does real API calls; AdminTab itself handles the
// not-a-super-admin case by not rendering this at all (see admin-tab.tsx).
interface AdminStore {
  users: AdminUser[];
  leagues: AdminLeague[];
  selectedLeagueId: string | null;
  membershipData: { players: Player[]; memberships: AdminMembership[] } | null;
  loaded: boolean;
  lastTempPassword: { username: string; password: string } | null;

  load: () => Promise<void>;
  selectLeague: (leagueId: string) => Promise<void>;
  toggleLeague: (leagueId: string) => void;
  createUser: (username: string) => Promise<void>;
  resetPassword: (userId: string, username: string) => Promise<void>;
  // Resolves true only if the account was actually deleted (both confirms accepted).
  deleteUser: (userId: string, username: string) => Promise<boolean>;
  updateUser: (userId: string, changes: { username?: string; email?: string }) => Promise<void>;
  deleteLeague: (leagueId: string, name: string) => Promise<void>;
  linkMembership: (playerId: string, userId: string, role: "member" | "commissioner") => Promise<void>;
  unlinkMembership: (membershipId: string) => Promise<void>;
  deletePlayer: (playerId: string, name: string) => Promise<void>;
  dismissTempPassword: () => void;
  impersonateUser: (userId: string, username: string) => Promise<void>;
}

export const useAdminStore = create<AdminStore>((set, get) => ({
  users: [],
  leagues: [],
  selectedLeagueId: null,
  membershipData: null,
  loaded: false,
  lastTempPassword: null,

  async load() {
    const [usersData, leaguesData] = await Promise.all([api.adminListUsers(), api.adminListLeagues()]);
    set({ users: usersData.users, leagues: leaguesData.leagues, loaded: true });
    if (get().selectedLeagueId) await get().selectLeague(get().selectedLeagueId!);
  },

  async selectLeague(leagueId) {
    set({ selectedLeagueId: leagueId, membershipData: null });
    const data = await api.adminLeagueMemberships(leagueId);
    set({ membershipData: data });
  },

  toggleLeague(leagueId) {
    if (get().selectedLeagueId === leagueId) {
      set({ selectedLeagueId: null, membershipData: null });
    } else {
      get().selectLeague(leagueId);
    }
  },

  async createUser(username) {
    const data = await api.adminCreateUser(username);
    set({ lastTempPassword: { username, password: data.tempPassword } });
    const usersData = await api.adminListUsers();
    set({ users: usersData.users });
  },

  async resetPassword(userId, username) {
    const data = await api.adminResetPassword(userId);
    set({ lastTempPassword: { username, password: data.tempPassword } });
  },

  async deleteUser(userId, username) {
    const { leagues } = await api.adminUserLeagues(userId);
    if (leagues.length > 0) {
      const names = leagues.map((l) => l.name).join(", ");
      if (!confirm(`"${username}" is currently in ${names}. Are you sure you want to continue?`)) return false;
    }
    if (!confirm(`Are you sure you want to delete "${username}"? This action cannot be reversed.`)) return false;
    await api.adminDeleteUser(userId);
    const usersData = await api.adminListUsers();
    set({ users: usersData.users });
    return true;
  },

  // Swaps the returned user into the list in place -- no full reload needed. Throws (ApiError) on
  // validation failures so the edit modal can show the message inline.
  async updateUser(userId, changes) {
    const { user } = await api.adminUpdateUser(userId, changes);
    set({ users: get().users.map((u) => (u.id === userId ? user : u)) });
  },

  async deleteLeague(leagueId, name) {
    if (
      !confirm(`Permanently delete "${name}"? This deletes the entire league, its history, and everyone's membership in it. This cannot be undone.`)
    )
      return;
    await api.adminDeleteLeague(leagueId);
    const leaguesData = await api.adminListLeagues();
    set({ leagues: leaguesData.leagues, selectedLeagueId: null, membershipData: null });
  },

  async linkMembership(playerId, userId, role) {
    await api.adminLinkMembership(get().selectedLeagueId!, userId, playerId, role);
    await get().selectLeague(get().selectedLeagueId!);
  },

  async unlinkMembership(membershipId) {
    if (!confirm("Remove this membership link?")) return;
    await api.adminUnlinkMembership(get().selectedLeagueId!, membershipId);
    await get().selectLeague(get().selectedLeagueId!);
  },

  async deletePlayer(playerId, name) {
    if (
      !confirm(
        `Delete "${name}" from this league? Their roster and points stay in the league's history, but the seat becomes disabled and any linked account is unlinked. This cannot be undone.`
      )
    )
      return;
    await api.adminDeletePlayer(get().selectedLeagueId!, playerId);
    await get().selectLeague(get().selectedLeagueId!);
  },

  dismissTempPassword: () => set({ lastTempPassword: null }),

  // Port of impersonateUser() (public/app.js): a full reload re-runs AuthGate's loadFirstLeague
  // against the now-impersonated session, same reasoning as auth-gate.tsx's
  // handleStopImpersonating -- simplest way to get every piece of client state (identity, loaded
  // league, membership) consistent with the new session rather than patching it by hand.
  async impersonateUser(userId, username) {
    if (!confirm(`Impersonate "${username}"? You'll see the app exactly as they do until you return to your own account.`)) return;
    await api.adminImpersonate(userId);
    // Deliberately a full reload, not router.push() -- see the comment above this function.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/";
  },
}));
