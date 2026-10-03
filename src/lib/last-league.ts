// The league last open in this browser, per account, so a reload (pull-to-refresh, reopening the
// app) returns to it instead of the first league on the list. Keyed by user id so an admin
// impersonating someone doesn't inherit their own league choice.
//
// Also kept per TAB (sessionStorage), which a reload keeps and a fresh opening of the app doesn't:
// that's how a linked group's favorite league (0046) can be where the app opens without a
// pull-to-refresh on another league in the group jumping back to it.
const key = (userId: string) => `rfl.lastLeague:${userId}`;

export function rememberLeague(userId: string | null, leagueId: string) {
  if (!userId) return;
  try {
    localStorage.setItem(key(userId), leagueId);
    sessionStorage.setItem(key(userId), leagueId);
  } catch {
    /* not remembered: a reload falls back to the first league */
  }
}

/** The league open in this tab before a reload; null on a fresh opening of the app. */
export function reloadedLeague(userId: string): string | null {
  try {
    return sessionStorage.getItem(key(userId));
  } catch {
    return null;
  }
}

export function rememberedLeague(userId: string): string | null {
  try {
    return localStorage.getItem(key(userId));
  } catch {
    return null;
  }
}
