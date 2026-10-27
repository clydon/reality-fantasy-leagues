// The way in's small pure parts (docs/PLAN-new-design.md step 9 part 2), shared by the landing, first run, sign-in and
// a signed-out invite, and checked by tests/way-in.test.js: first run's picks held on this device until there's an
// account to save them to, and the words for where someone is in a season.

/** First run's picks: the seasons, and where you are in each. Kept on the device through making an account (a
 *  Google sign-in and an emailed link both leave the page), then saved (POST /api/me/first-run) and cleared. A pick is a
 *  season's id, or (step 10) a show from the TV listings (`tv:<TVmaze id>`) or one added by name (`name:<name>`), with
 *  what to show for it in `extra` until the account makes it. */
export interface FirstRunPicks {
  picked: string[];
  where: Record<string, number>;
  extra?: Record<string, ExtraPick>;
  /** When they were last changed: picks a week old are let go. */
  at: number;
}

/** A pick that isn't a season here yet: its name and art, from the listing (or the name typed). */
export interface ExtraPick {
  name: string;
  artUrl: string | null;
}

/** A pick's key for a show from the TV listings, or one added by name. */
export const listingKey = (tvmazeId: number) => `tv:${tvmazeId}`;
export const nameKeyOf = (name: string) => `name:${name.trim().replace(/\s+/g, " ")}`;
const isExtra = (key: string) => /^tv:\d+$/.test(key) || /^name:.{2,80}$/.test(key);

const KEY = "gys.firstRun";
const KEEP_MS = 7 * 24 * 3600 * 1000;
const EMPTY = (): FirstRunPicks => ({ picked: [], where: {}, at: Date.now() });

/** The stored picks, or none (unreadable, or a week old). */
export function parseFirstRun(raw: string | null, now = Date.now()): FirstRunPicks {
  if (!raw) return EMPTY();
  try {
    const p = JSON.parse(raw) as Partial<FirstRunPicks>;
    if (!Array.isArray(p.picked) || typeof p.at !== "number" || now - p.at > KEEP_MS) return EMPTY();
    const ids = p.picked.filter((id): id is string => typeof id === "string");
    // A listing or a name needs its name kept to show it; one without is let go.
    const extra: Record<string, ExtraPick> = {};
    for (const id of ids.filter(isExtra)) {
      const e = p.extra?.[id];
      if (e && typeof e.name === "string" && e.name.trim()) extra[id] = { name: e.name.slice(0, 120), artUrl: typeof e.artUrl === "string" ? e.artUrl : null };
    }
    const picked = ids.filter((id) => (/^(tv|name):/.test(id) ? !!extra[id] : true)).slice(0, 40);
    const where: Record<string, number> = {};
    for (const id of picked) {
      const n = p.where?.[id];
      where[id] = Number.isInteger(n) && (n as number) >= 0 ? (n as number) : 0;
    }
    return Object.keys(extra).length ? { picked, where, extra, at: p.at } : { picked, where, at: p.at };
  } catch {
    return EMPTY();
  }
}

export function readFirstRun(): FirstRunPicks {
  try {
    return parseFirstRun(localStorage.getItem(KEY));
  } catch {
    return EMPTY();
  }
}

export function writeFirstRun(p: Omit<FirstRunPicks, "at">) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...p, at: Date.now() }));
  } catch {
    /* not kept: first run starts over on the next visit */
  }
}

export function clearFirstRun() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing kept */
  }
}

/** Starts first run with these seasons picked (the landing's show tiles). */
export function startWith(seasonIds: string[]) {
  writeFirstRun({ picked: seasonIds, where: Object.fromEntries(seasonIds.map((id) => [id, 0])) });
}

/** What first run saves: each pick with where you are in it (never past what's aired; the server caps a listing's). */
export function followsOf(
  p: FirstRunPicks,
  aired: (key: string) => number | null | undefined
): (({ seasonId: string } | { listing: number } | { name: string }) & { seenThrough: number })[] {
  return p.picked.map((key) => {
    const cap = aired(key);
    const seen = p.where[key] ?? 0;
    const seenThrough = cap == null ? seen : Math.min(seen, cap);
    if (key.startsWith("tv:")) return { listing: Number(key.slice(3)), seenThrough };
    if (key.startsWith("name:")) return { name: key.slice(5), seenThrough };
    return { seasonId: key, seenThrough };
  });
}

const DATE = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/**
 * Where you are in a season, in words: "Haven't started", "Seen through Episode 3 of 5", "Caught up through Episode 5";
 * a season that hasn't started has "Premieres Oct 30" (no stepper). `aired` null: a finished season whose length isn't
 * listed ("Seen through Episode 3").
 */
export function whereLabel(s: { aired: number | null; status: string; premiere: string | null; episodeWord?: string }, seen: number): string {
  const ep = s.episodeWord ?? "Episode";
  if (s.aired === 0) return s.premiere ? `Premieres ${DATE(s.premiere)}` : "Premieres soon";
  if (seen <= 0) return "Haven't started";
  if (s.aired == null) return `Seen through ${ep} ${seen}`;
  return seen >= s.aired ? `Caught up through ${ep} ${s.aired}` : `Seen through ${ep} ${seen} of ${s.aired}`;
}

/** The stepper's top: what's aired (a finished season of unknown length goes to 99). */
export const whereCap = (aired: number | null) => (aired == null ? 99 : aired);

/** A username as Better Auth's username plugin takes it (3 to 30 letters, digits, underscores and dots), from anything. */
export function usernameFrom(text: string): string {
  const clean = text
    .toLowerCase()
    .replace(/@.*$/, "")
    .replace(/[^a-z0-9_.]+/g, "")
    .slice(0, 30);
  return clean.length >= 3 ? clean : "";
}
