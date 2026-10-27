// The new design's routes (docs/PLAN-new-design.md step 0c), and which way the screen moves between them: a port
// of the mock's nav.js rules (.impeccable/mocks/site/nav.js), kept pure so tests/new-nav.test.js can check them.
//
//   /home                                    the hub (depth 0)
//   /show/[seasonId]/[tab]                   a show space's five tabs (depth 1)
//   /show/[seasonId]/backstage|draft|blind|waivers|scoring   pushed over the show (depth 2; a Backstage page is 3)
//   /welcome                                 the landing, for anyone signed out (depth 0; step 9 part 2)
//   /signin                                  signing in (depth 1)
//   /settings, /start/[step], /join/[code]   their own screens (depth 1)
//   /desk, /desk/find, /desk/settings         the admin's desk, its three tabs (depth 1, site admins: step 6b part 2)
//   /desk/library, /desk/new                 the rulebooks library, and New show (depth 2, pushed from Find: step 10 part 3)
//   /desk/[kind]/[id]                        one thing on the desk: a fact, a season, a castaway, a rulebook... (depth 2)
//
// Classic owns everything else ("/", /account, /waivers, /setup, /admin...); the two designs never share a path.

/** This device's copy of which design the account opens on (src/lib/server/ui-choice.ts); next.config.ts's
 *  redirect of "/" reads it. */
export const UI_COOKIE = "gys_ui";

/** The paths the new design owns. AuthGate (classic's shell) leaves these alone. */
export const NEW_DESIGN_PREFIXES = ["/home", "/show", "/settings", "/start", "/join", "/desk", "/welcome", "/signin"] as const;

export function isNewDesignRoute(pathname: string): boolean {
  return NEW_DESIGN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** A show space's tabs, in order (the order tabs slide by). The mock's route key for Games was `standings`. */
export const SHOW_TABS = ["tonight", "episodes", "games", "cast", "chat"] as const;
export type ShowTab = (typeof SHOW_TABS)[number];

export function isShowTab(v: string): v is ShowTab {
  return (SHOW_TABS as readonly string[]).includes(v);
}

/** Pages pushed over a show space, each a route of its own. */
export const SHOW_PAGES = ["backstage", "draft", "blind", "waivers", "scoring"] as const;

/** Backstage's own pages, one level deeper (/show/[seasonId]/backstage/results). */
export const BACKSTAGE_PAGES = ["results", "waivers", "rules", "members", "settings", "history"] as const;
export type BackstagePage = (typeof BACKSTAGE_PAGES)[number];

export function isBackstagePage(v: string): v is BackstagePage {
  return (BACKSTAGE_PAGES as readonly string[]).includes(v);
}

/** First run's steps: shows, where you are, your account, your people. */
export const START_STEPS = 4;

export const paths = {
  home: "/home",
  welcome: "/welcome",
  /** Signing in, then on to `next` (a path of this site) once you're in. */
  signin: (next?: string) => (next ? `/signin?next=${encodeURIComponent(next)}` : "/signin"),
  settings: "/settings",
  show: (seasonId: string, tab: ShowTab = "tonight") => `/show/${seasonId}/${tab}`,
  /** The show's Tonight with its watch along open (step 13): your next episode, or `ep`; a planned night's, together (`plan`). */
  watch: (seasonId: string, ep?: number | null, plan?: string | null) => `/show/${seasonId}/tonight?page=watch${ep ? `&ep=${ep}` : ""}${plan ? `&plan=${plan}` : ""}`,
  backstage: (seasonId: string, page?: string) => `/show/${seasonId}/backstage${page ? `/${page}` : ""}`,
  showPage: (seasonId: string, page: "draft" | "blind" | "waivers" | "scoring") => `/show/${seasonId}/${page}`,
  start: (step: number) => `/start/${step}`,
  join: (code: string) => `/join/${code}`,
  desk: (tab?: "find" | "settings" | "library") => `/desk${tab ? `/${tab}` : ""}`,
  /** New show; `season`: a season that's here, to set up (How do you want to start?). */
  deskNew: (season?: string) => `/desk/new${season ? `?season=${encodeURIComponent(season)}` : ""}`,
  deskItem: (kind: DeskKind, id: string) => `/desk/${kind}/${id}`,
};

/** The desk's tabs, and the kinds of thing it has a page for. */
export const DESK_TABS = ["inbox", "find", "settings"] as const;
/** The desk's own pages, a level down from its tabs. */
export const DESK_PAGES = ["library", "new"] as const;
export const DESK_KINDS = ["fact", "season", "castaway", "couch", "person", "show", "rulebook"] as const;
export type DeskKind = (typeof DESK_KINDS)[number];
export const isDeskKind = (v: string): v is DeskKind => (DESK_KINDS as readonly string[]).includes(v);

/** Where to go after signing in: `next` when it's a path on this site (never another site, never "//host"), else none. */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  if (/^\/(api|signin)(\/|\?|$)/.test(next)) return null;
  return next;
}

/**
 * How a navigation moves the screen:
 *   push / pop   deeper comes in from the right over the old screen; back slides it off to the right
 *   left / right a show's tabs, by tab order: the content nudges sideways, the show bar and tab bar hold still
 *   channel      the hub and a show: the show's art grows from its card into the header (or back), the rest crossfades
 *   fade         same depth, no order: a crossfade
 *   calm         reduced motion: a short crossfade, nothing moves
 */
export type NavKind = "push" | "pop" | "left" | "right" | "channel" | "fade" | "calm";

function parse(href: string): string[] {
  const path = href.split(/[?#]/)[0];
  return path.split("/").filter(Boolean);
}

export function depthOf(href: string): number {
  const p = parse(href);
  switch (p[0]) {
    case "home":
      return 0;
    case "show":
      if ((SHOW_PAGES as readonly string[]).includes(p[2])) return p[3] ? 3 : 2;
      return 1;
    case "settings":
    case "start":
    case "join":
    case "signin":
      return 1;
    case "desk":
      return p[1] && !(DESK_TABS as readonly string[]).includes(p[1]) ? 2 : 1;
    default:
      return 0;
  }
}

/**
 * Up from a page: where its own Back button leads, without the page you came from (src/components/phone-back.tsx,
 * the phone's back once the trail has run out). Null at the top: the hub, the landing. A page pushed over the screen
 * (`?page=`) is up to the screen under it. A show's tabs are all up to the hub, as the show bar's Back says. Classic's
 * pages aren't here (lib/nav-trail.ts has theirs).
 */
export function upFrom(href: string, { signedIn = true }: { signedIn?: boolean } = {}): string | null {
  const [path, query = ""] = href.split("#")[0].split("?");
  if (new URLSearchParams(query).has("page")) return path;
  const top = signedIn ? paths.home : paths.welcome;
  const p = parse(path);
  switch (p[0]) {
    case "home":
    case "welcome":
      return null;
    case "signin":
      return paths.welcome;
    case "start": {
      const step = Number(p[1]) || 1;
      return step > 1 ? paths.start(step - 1) : top;
    }
    case "show":
      if (!p[1]) return paths.home;
      // Recent changes is a player's too, from the show's menu, so up is the show, not Backstage.
      if (p[2] === "backstage") return p[3] && p[3] !== "history" ? paths.backstage(p[1]) : paths.show(p[1]);
      if ((SHOW_PAGES as readonly string[]).includes(p[2])) return paths.show(p[1]);
      return paths.home;
    case "desk":
      if (p[1] === "library") return paths.desk("find");
      if (p[1] === "new") return paths.desk("library");
      if (p[1] === "fact") return paths.desk();
      if (p[1] && isDeskKind(p[1])) return paths.desk("find");
      return paths.home;
    default:
      // Settings, joining a couch.
      return top;
  }
}

/**
 * The kind of move from one path to another. `channel` asks for the art morph when going from the hub into a show
 * (the tapped card has art to grow); coming back from a show's tab to the hub is always a channel change.
 */
export function navKind(from: string, to: string, opts: { channel?: boolean; reducedMotion?: boolean } = {}): NavKind {
  if (opts.reducedMotion) return "calm";
  const a = parse(from);
  const b = parse(to);
  const da = depthOf(from);
  const db = depthOf(to);
  // Two tabs of the same show: sideways by tab order.
  if (a[0] === "show" && b[0] === "show" && a[1] === b[1] && da === 1 && db === 1) {
    const i = SHOW_TABS.indexOf((a[2] ?? "tonight") as ShowTab);
    const j = SHOW_TABS.indexOf((b[2] ?? "tonight") as ShowTab);
    return i === j ? "fade" : j > i ? "left" : "right";
  }
  // First run: forward and back through its steps.
  if (a[0] === "start" && b[0] === "start") return (Number(b[1]) || 1) > (Number(a[1]) || 1) ? "push" : "pop";
  // The hub and a show: the channel change.
  if (da === 0 && db === 1 && b[0] === "show" && opts.channel) return "channel";
  if (da === 1 && db === 0 && a[0] === "show") return "channel";
  if (db > da) return "push";
  if (db < da) return "pop";
  return "fade";
}
