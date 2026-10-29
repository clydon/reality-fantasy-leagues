// The app's own marks on history entries, and writing entries past Next's router. Two parts of the app put entries on
// the history that Next's router didn't write: the installed app's floor under the first page (components/phone-back.tsx)
// and an open sheet's entry (new/ui/sheet-history.ts). Each marks its entries in their state; each reads the other's.

/** phone-back.tsx's entry under the first page of the visit. */
export const FLOOR = "gysFloor";
/** sheet-history.ts's entry for an open sheet: its number. */
export const SHEET = "gysSheet";

/** History's own pushState or replaceState, not the wrappers on window.history (Next's, which tell its router, and the
 *  sheets', which keep their entries). No url: the address stays. */
export function putEntry(push: boolean, state: unknown, url?: string) {
  (push ? History.prototype.pushState : History.prototype.replaceState).call(window.history, state, "", url);
}

/** An entry's state without the app's marks (Next's own, and anyone else's, stay). */
export function unmarked(state: unknown): Record<string, unknown> {
  const rest = typeof state === "object" && state !== null ? { ...(state as Record<string, unknown>) } : {};
  delete rest[FLOOR];
  delete rest[SHEET];
  return rest;
}

/** The floor, from outside phone-back.tsx: `lift` puts the page back above it now if the screen is on it (a sheet opening
 *  while "Press back again to exit" is up), as phone-back does itself once the hint has gone. */
export const floor: { lift: () => void } = { lift: () => {} };
