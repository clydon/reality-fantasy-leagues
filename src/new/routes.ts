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
//   /desk/people                             Find › People (depth 2: docs/PLAN-desk-parity.md step 1)
//   /desk/reports                            Find › Reports (depth 2: docs/PLAN-desk-parity.md step 2)
//   /desk/games                              Find › Games (depth 2: docs/PLAN-desk-parity.md part 6a)
//   /desk/couches                            Find › Couches (depth 2: docs/PLAN-desk-parity.md part 6d)
//   /desk/shows                              Find › Shows (depth 2: docs/PLAN-desk-parity.md part 7a)
//   /desk/[kind]/[id]                        one thing on the desk: a fact, a season, a castaway, a rulebook... (depth 2)
//   /desk/season/[id]/setup                  a page under a season: its Setup (depth 3: docs/PLAN-desk-parity.md step 3)
//   /desk/season/[id]/research               its Research and the bot (depth 3: step 4, part 4a)
//   /desk/season/[id]/bingo?bank=<n>|season  its Bingo bank, on an episode or the season's (depth 3: step 4, part 4c)
//   /desk/season/[id]/cast                   its Cast: getting it, what an answer changes, Send to its games (depth 3: step 5, part 5a)
//   /desk/season/[id]/e/[n]                  one of its episodes: its results, answers and trivia (depth 4: step 4, part 4b)
//   /desk/season/[id]/c/[castId]             one of its cast: name, photo, starting group, Lock, Remove (depth 4: step 5, part 5b)
//   /desk/show/[id]/sites                    a page under a show: its Research sites (depth 3: step 7, part 7a)
//   /desk/show/[id]/art                      its Art and photos: each frame's source and framing, cast photos (depth 3: part 7b)
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
  /** The Games tab at one game's table, on an episode (Weekly Lineup's view of it): a game's line on Tonight or an episode page. */
  game: (seasonId: string, leagueId: string, ep?: number | null) => `/show/${seasonId}/games?game=${encodeURIComponent(leagueId)}${ep ? `&ep=${ep}` : ""}`,
  /** The show's Tonight with its watch along open (step 13): your next episode, or `ep`; a planned night's, together (`plan`). */
  watch: (seasonId: string, ep?: number | null, plan?: string | null) => `/show/${seasonId}/tonight?page=watch${ep ? `&ep=${ep}` : ""}${plan ? `&plan=${plan}` : ""}`,
  backstage: (seasonId: string, page?: string) => `/show/${seasonId}/backstage${page ? `/${page}` : ""}`,
  showPage: (seasonId: string, page: "draft" | "blind" | "waivers" | "scoring") => `/show/${seasonId}/${page}`,
  start: (step: number) => `/start/${step}`,
  join: (code: string) => `/join/${code}`,
  desk: (tab?: "find" | "settings" | "library") => `/desk${tab ? `/${tab}` : ""}`,
  /** Find › People, searched or filtered from the start (Browse's "N waiting", Find's "All N people matching"). */
  deskPeople: (o: { q?: string; f?: string } = {}) => {
    const qs = new URLSearchParams(Object.entries(o).filter(([, v]) => v) as [string, string][]).toString();
    return `/desk/people${qs ? `?${qs}` : ""}`;
  },
  /** Find › Reports, open or done, searched from the start (Find's "All N reports matching"). */
  deskReports: (o: { q?: string; f?: string } = {}) => {
    const qs = new URLSearchParams(Object.entries(o).filter(([, v]) => v) as [string, string][]).toString();
    return `/desk/reports${qs ? `?${qs}` : ""}`;
  },
  /** Find › Games, filtered, sorted or searched from the start (Browse's Deleted, Find's "All N games matching"). */
  deskGames: (o: { q?: string; f?: string; sort?: string } = {}) => {
    const qs = new URLSearchParams(Object.entries(o).filter(([, v]) => v) as [string, string][]).toString();
    return `/desk/games${qs ? `?${qs}` : ""}`;
  },
  /** Find › Couches, filtered, sorted or searched from the start (a couch's Delete lands on Deleted, Find's "All N couches matching"). */
  deskCouches: (o: { q?: string; f?: string; sort?: string } = {}) => {
    const qs = new URLSearchParams(Object.entries(o).filter(([, v]) => v) as [string, string][]).toString();
    return `/desk/couches${qs ? `?${qs}` : ""}`;
  },
  /** Find › Shows, filtered, sorted or searched from the start (a show's Delete lands on it, Find's "All N shows matching"). */
  deskShows: (o: { q?: string; f?: string; sort?: string } = {}) => {
    const qs = new URLSearchParams(Object.entries(o).filter(([, v]) => v) as [string, string][]).toString();
    return `/desk/shows${qs ? `?${qs}` : ""}`;
  },
  /** A page under a show (docs/PLAN-desk-parity.md step 7): its Research sites, its Art and photos. */
  deskShowPage: (id: string, page: DeskShowPage) => `/desk/show/${id}/${page}`,
  /** New show; `season`: a season that's here, to set up (How do you want to start?). */
  deskNew: (season?: string) => `/desk/new${season ? `?season=${encodeURIComponent(season)}` : ""}`,
  deskItem: (kind: DeskKind, id: string) => `/desk/${kind}/${id}`,
  /** A page under a season (docs/PLAN-desk-parity.md steps 3-5): its Setup, its Research and the bot. */
  deskSeasonPage: (id: string, page: DeskSeasonPage) => `/desk/season/${id}/${page}`,
  /** A season's Bingo bank, on one episode's squares or the season's (docs/PLAN-desk-parity.md part 4c). */
  deskBingo: (id: string, bank?: number | "season") => `/desk/season/${id}/bingo${bank != null ? `?bank=${bank}` : ""}`,
  /** One of a season's episodes (docs/PLAN-desk-parity.md part 4b): its results, its answers, its trivia. */
  deskEpisode: (id: string, n: number) => `/desk/season/${id}/e/${n}`,
  /** One of a season's cast (docs/PLAN-desk-parity.md part 5b), under its Cast page. */
  deskCastaway: (seasonId: string, id: string) => `/desk/season/${seasonId}/c/${id}`,
};

/** The desk's tabs, and the kinds of thing it has a page for. */
export const DESK_TABS = ["inbox", "find", "settings"] as const;
/** The desk's own pages, a level down from its tabs. */
export const DESK_PAGES = ["library", "new", "people", "reports", "games", "couches", "shows"] as const;
export const DESK_KINDS = ["fact", "season", "castaway", "couch", "person", "show", "rulebook", "report", "game"] as const;
export type DeskKind = (typeof DESK_KINDS)[number];
export const isDeskKind = (v: string): v is DeskKind => (DESK_KINDS as readonly string[]).includes(v);
/** The pages under a season: its Setup (step 3), its Research and the bot and Bingo bank (step 4), its Cast (step 5). */
export const DESK_SEASON_PAGES = ["setup", "research", "bingo", "cast"] as const;
export type DeskSeasonPage = (typeof DESK_SEASON_PAGES)[number];
export const isDeskSeasonPage = (v: string | undefined): v is DeskSeasonPage => !!v && (DESK_SEASON_PAGES as readonly string[]).includes(v);
/** The pages under a show: its Research sites (step 7, part 7a). */
export const DESK_SHOW_PAGES = ["sites", "art"] as const;
export type DeskShowPage = (typeof DESK_SHOW_PAGES)[number];
export const isDeskShowPage = (v: string | undefined): v is DeskShowPage => !!v && (DESK_SHOW_PAGES as readonly string[]).includes(v);

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
 *   tune         the hub and a show, under the Tune in bumper (tune-in.tsx): the page just swaps, the bumper does the moving
 */
export type NavKind = "push" | "pop" | "left" | "right" | "channel" | "fade" | "calm" | "tune";

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
      return p[1] && !(DESK_TABS as readonly string[]).includes(p[1]) ? (p[4] ? 4 : p[3] ? 3 : 2) : 1;
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
      if (p[1] === "library" || p[1] === "people" || p[1] === "reports" || p[1] === "games" || p[1] === "couches" || p[1] === "shows") return paths.desk("find");
      if (p[1] === "report") return paths.deskReports();
      if (p[1] === "game") return paths.deskGames();
      if (p[1] === "couch") return paths.deskCouches();
      if (p[1] === "show" && p[2] && p[3]) return paths.deskItem("show", p[2]);
      if (p[1] === "show") return paths.deskShows();
      if (p[1] === "new") return paths.desk("library");
      // The engine lab (step A5 of docs/PLAN-start-a-game-gpt.md): a page of its own under the desk.
      if (p[1] === "lab") return paths.desk();
      if (p[1] === "fact") return paths.desk();
      if (p[1] === "season" && p[2] && p[3] === "c") return paths.deskSeasonPage(p[2], "cast");
      if (p[1] === "season" && p[2] && p[3]) return paths.deskItem("season", p[2]);
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
