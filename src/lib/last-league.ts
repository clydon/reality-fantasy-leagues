// The league last open in this browser, per account, so a reload (pull-to-refresh, reopening the
// app) returns to it instead of the first league on the list. Keyed by user id so an admin
// impersonating someone doesn't inherit their own league choice.
const key = (userId: string) => `rfl.lastLeague:${userId}`;

export function rememberLeague(userId: string | null, leagueId: string) {
  if (!userId) return;
  try {
    localStorage.setItem(key(userId), leagueId);
  } catch {
    /* not remembered: a reload falls back to the first league */
  }
}

export function rememberedLeague(userId: string): string | null {
  try {
    return localStorage.getItem(key(userId));
  } catch {
    return null;
  }
}
