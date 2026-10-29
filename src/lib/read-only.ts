// Open it read-only (docs/PLAN-desk-parity.md part 6c; the mock's desk-games.js dgOpen): a site admin looks at a couch's
// game in the app's show space as anyone on the couch sees it. While it's on, every request from that browser tab carries
// READ_ONLY_HEADER with the game's id (src/new/read-only.tsx): the show space's reads take it as a site admin's read scope
// over the couch's game (src/lib/server/read-only.ts; never a membership), and every write that carries it is refused
// (api-route.ts), whatever the screen let through. Shared by the server and the browser.

export const READ_ONLY_HEADER = "x-gys-read-only";

/** What anything that would change something says while it's on (the mock's toast). */
export const READ_ONLY_SAYS = "Read-only: nothing here changes. To do it as someone, act as them from their seat";

/** The one write that stays open: where you are in the show (the spoiler chip's Change), which is yours, not the couch's. */
export const writableWhileReadOnly = (path: string) => /^\/api\/me\/follows\//.test(path);
