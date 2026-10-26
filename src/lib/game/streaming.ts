// Streaming on the couch, the pure half (docs/PLAN-new-design.md step 14 part 1; the mock's streaming.js railShows / railChip):
// what goes on the rail under the guide, in what order, and what each chip says. A streaming season has no airtime, so it
// leaves the weekly guide but stays relevant long after its drop; the rail is its home on the hub.
//
// It holds seasons watched at your own pace: a season that drops every episode at once (release 'binge'), and a finished
// season nobody plays a game on here (the mock's The Wire), each one you have on your shows or someone on the couch streams
// openly. In order: yours in progress (Continue · Ep 4), new drops (a week after), the couch's planned nights, the couch's
// most watched, then upcoming drops. A finished one of yours nobody else streams leaves it (Your shows still has it).
//
// What it says about other people is what the guard lets out (guard.ts; Noticed, "Nobody's progress on a show you watch"):
// who on the couch streams it openly, and who's watching along right now (the hub's On now read). Never how far anyone is;
// your own progress is yours to see. Times are formatted by the screen, in the viewer's zone. Checked by tests/streaming.test.js.

/** A season as the rail is given it (the home read's shows and couch shows). */
export interface StreamShow {
  seasonId: string;
  name: string;
  seasonNumber: number | null;
  artUrl: string | null;
  release?: "weekly" | "nightly" | "binge";
  status: string | null;
  /** When a streaming season drops every episode (ISO), else null. */
  dropAt?: string | null;
  /** The listing's service ("Netflix"), or null. */
  network?: string | null;
  episodeCount: number | null;
  latestAired: number;
  /** On your shows: you follow it (openly or privately), or play it. */
  yours: boolean;
  /** Your mark (seen through), or null when it isn't known: not yours, or spoiler protection off. */
  seen: number | null;
  /** A game of yours is on it, or one on this couch: a finished season played here is the trophy shelf's, not streaming. */
  played: boolean;
}

export interface RailPerson {
  userId: string;
  name: string;
}

/** A planned night on the couch (step 11 part 3): a streaming season's is always a shared start. */
export interface RailPlan {
  id: string;
  seasonId: string;
  at: number;
  episode: number;
}

/** Someone on the couch watching along right now (step 13 part 2's On now). */
export interface RailOnNow extends RailPerson {
  seasonId: string;
}

export type RailTag =
  | { kind: "drops"; at: number }
  | { kind: "continue"; episode: number }
  | { kind: "new"; episodes: number }
  | { kind: "plan"; at: number; episode: number }
  | { kind: "finished" }
  | { kind: "service"; text: string };

export type RailWho =
  /** "riley is on now" (and how many more of them). */
  | { kind: "on"; name: string; more: number }
  /** Before the drop: "2 waiting". */
  | { kind: "waiting"; count: number }
  /** "riley", "riley + 2". */
  | { kind: "names"; names: string[] }
  /** "Just you so far". */
  | { kind: "you" };

export interface RailItem {
  seasonId: string;
  name: string;
  seasonNumber: number | null;
  artUrl: string | null;
  /** 0 yours in progress, 1 a new drop, 2 a planned night, 3 the couch's, 4 an upcoming drop. */
  rank: 0 | 1 | 2 | 3 | 4;
  /** On your shows (a progress bar while you're in it); not: a ＋ to add it. */
  yours: boolean;
  tag: RailTag;
  who: RailWho;
  /** Who on the couch streams it openly (not you), whoever's on now first. */
  faces: RailPerson[];
  /** How far through you are, 0 to 1, while you're in it; null otherwise. */
  progress: number | null;
  /** How many episodes (0 when nothing says). */
  episodes: number;
  /** The couch's next night for it, or null. */
  plan: RailPlan | null;
  /** Its drop is still to come. */
  preDrop: boolean;
}

/** A drop is new for a week. */
export const NEW_DROP_MS = 7 * 24 * 60 * 60 * 1000;
/** The rail shows this many before See all. */
export const RAIL_FEW = 3;

/** Watched at your own pace: a season that drops at once, or a finished one nobody plays a game on (here, or of yours). */
export function ownPace(s: Pick<StreamShow, "release" | "status" | "played">): boolean {
  return s.release === "binge" || (s.status === "completed" && !s.played);
}

const dropOf = (s: StreamShow) => (s.release === "binge" && s.dropAt ? Date.parse(s.dropAt) : NaN);

/** The rail: every season watched at your own pace that's yours or someone on the couch streams, in the rail's order. */
export function railItems(
  shows: StreamShow[],
  o: { streamers: (seasonId: string) => RailPerson[]; plans?: RailPlan[]; onNow?: RailOnNow[]; now: number }
): RailItem[] {
  const out: RailItem[] = [];
  const seen = new Set<string>();
  for (const s of shows) {
    if (seen.has(s.seasonId) || !ownPace(s)) continue;
    seen.add(s.seasonId);
    const others = o.streamers(s.seasonId);
    if (!s.yours && !others.length) continue;
    const drop = dropOf(s);
    const preDrop = Number.isFinite(drop) && drop > o.now;
    const total = s.episodeCount ?? s.latestAired ?? 0;
    const mark = s.yours && s.seen != null && Number.isFinite(s.seen) ? s.seen : null;
    const inProgress = !preDrop && mark != null && mark > 0 && total > 0 && mark < total;
    const finished = mark != null && total > 0 && mark >= total;
    const fresh = Number.isFinite(drop) && drop <= o.now && o.now - drop < NEW_DROP_MS;
    const plan = (o.plans ?? []).filter((p) => p.seasonId === s.seasonId).sort((a, b) => a.at - b.at)[0] ?? null;
    // A finished one of yours nobody else streams has nothing left to say here.
    if (finished && !others.length && !fresh && !plan) continue;
    const rank: RailItem["rank"] = inProgress ? 0 : fresh ? 1 : plan && !preDrop ? 2 : preDrop ? 4 : 3;
    const tag: RailTag = preDrop
      ? { kind: "drops", at: drop }
      : inProgress
        ? { kind: "continue", episode: mark! + 1 }
        : fresh
          ? { kind: "new", episodes: total }
          : plan
            ? { kind: "plan", at: plan.at, episode: plan.episode }
            : finished
              ? { kind: "finished" }
              : { kind: "service", text: s.network || (s.release === "binge" ? "Streaming" : total ? `All ${total} episodes` : "Finished") };
    const on = (o.onNow ?? []).filter((w) => w.seasonId === s.seasonId && others.some((p) => p.userId === w.userId));
    const faces = [...on.map((w) => others.find((p) => p.userId === w.userId)!), ...others.filter((p) => !on.some((w) => w.userId === p.userId))];
    const who: RailWho = on.length
      ? { kind: "on", name: on[0].name, more: on.length - 1 }
      : preDrop && others.length
        ? { kind: "waiting", count: others.length }
        : others.length
          ? { kind: "names", names: others.map((p) => p.name) }
          : { kind: "you" };
    out.push({
      seasonId: s.seasonId,
      name: s.name,
      seasonNumber: s.seasonNumber,
      artUrl: s.artUrl,
      rank,
      yours: s.yours,
      tag,
      who,
      faces,
      progress: inProgress ? mark! / total : null,
      episodes: total,
      plan,
      preDrop,
    });
  }
  const count = (x: RailItem) => x.faces.length;
  return out.sort(
    (a, b) =>
      a.rank - b.rank ||
      // New drops newest first, nights and upcoming drops soonest first, the couch's by how many stream it (unfinished first).
      (a.rank === 1 ? dropAtOf(b, shows) - dropAtOf(a, shows) : 0) ||
      (a.rank === 2 ? a.plan!.at - b.plan!.at : 0) ||
      (a.rank === 4 ? dropAtOf(a, shows) - dropAtOf(b, shows) : 0) ||
      count(b) - count(a) ||
      Number(a.tag.kind === "finished") - Number(b.tag.kind === "finished") ||
      a.name.localeCompare(b.name)
  );
}

function dropAtOf(x: RailItem, shows: StreamShow[]): number {
  const s = shows.find((y) => y.seasonId === x.seasonId);
  const t = s ? dropOf(s) : NaN;
  return Number.isFinite(t) ? t : 0;
}

/** "riley is on now", "riley is on now · +1", "2 waiting", "riley", "riley + 2", "Just you so far". */
export function whoLine(w: RailWho): string {
  if (w.kind === "on") return `${w.name} is on now${w.more ? ` · +${w.more}` : ""}`;
  if (w.kind === "waiting") return `${w.count} waiting`;
  if (w.kind === "names") return w.names.length > 1 ? `${w.names[0]} + ${w.names.length - 1}` : w.names[0];
  return "Just you so far";
}
