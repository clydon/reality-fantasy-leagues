// Reopening the installed app where you left off, on the new design (classic's own is lib/last-page.ts, which only runs
// on classic's pages). Phones quietly close an installed app in the background, often within minutes, and the next tap on
// the icon is a fresh launch at the start URL ("/", which next.config.ts sends on to /home). Within RESUME_WINDOW of last
// using the app, that launch goes back to the page you were on -- a game, Tonight, the chat -- instead of Home. Back after
// longer means "what's new", which is Home's job. Per device (localStorage).
//
// Two halves: src/new/last-page.tsx remembers each signed-in page as you arrive on it and stamps it when the app is
// hidden; resumeBootScript() runs in the root layout's <head>, before anything paints, and replaces a fresh launch's
// "/" or "/home" with the remembered page. Only:
//   - in the installed app (a browser tab's address bar means what it says),
//   - on a launch: once per launch (sessionStorage, which a relaunch starts empty), never on a reload,
//   - at the start URL with no query (a notification's link or a shared link wins),
//   - within RESUME_WINDOW. `at` is when you last LEFT the app, not when you arrived on the page.
// Signing out forgets it (lib/auth-client.ts), so the next person on the phone starts at Home.

export const RESUME_KEY = "gys.lastPage";
export const RESUME_LAUNCHED_KEY = "gys.launched";
export const RESUME_WINDOW = 6 * 60 * 60 * 1000;

export interface ResumePage {
  userId: string;
  path: string;
  at: number;
}

// Pushed screens that are a moment, not a place: the reveal (results you've seen by the time you're back), Make it a game
// (a flow you finish and leave). Reopening goes to the screen under them.
const NOT_REOPENED_PAGES = ["reveal", "make"];

/** The address to remember for a page: its path and query, less what shouldn't reopen. Null: nothing to remember. */
export function pathToRemember(pathname: string, search: string): string | null {
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return null;
  const query = new URLSearchParams(search);
  if (NOT_REOPENED_PAGES.includes(query.get("page") ?? "")) return pathname;
  const q = query.toString();
  return q ? `${pathname}?${q}` : pathname;
}

export function forgetResumePage() {
  try {
    localStorage.removeItem(RESUME_KEY);
  } catch {
    /* nothing remembered to forget */
  }
}

/** The <head> script: a fresh launch at "/" or "/home" goes to the remembered page before the first paint. Only emitted
 *  for a request with a session cookie (signed out, there's nothing to go back to). */
export const RESUME_BOOT_SCRIPT = `(function(){try{var s=sessionStorage;if(s.getItem("${RESUME_LAUNCHED_KEY}"))return;s.setItem("${RESUME_LAUNCHED_KEY}","1");if(!(window.matchMedia("(display-mode: standalone)").matches||navigator.standalone===true))return;var p=location.pathname;if((p!=="/"&&p!=="/home")||location.search)return;var n=performance.getEntriesByType&&performance.getEntriesByType("navigation")[0];if(n&&n.type==="reload")return;var v=JSON.parse(localStorage.getItem("${RESUME_KEY}")||"null");if(!v||typeof v.path!=="string"||typeof v.at!=="number"||Date.now()-v.at>${RESUME_WINDOW})return;if(v.path.charAt(0)!=="/"||v.path.charAt(1)==="/"||v.path.charAt(1)==="\\\\"||v.path==="/home"||v.path===p)return;document.documentElement.style.visibility="hidden";location.replace(v.path)}catch(e){}})()`;
