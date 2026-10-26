import { isUuid, type SessionUser } from "./auth-helpers";
import { couchMembers, requireCouch, type CouchMember } from "./couches";
import { pool, HttpError } from "./db";
import { seenThrough } from "./guard";
import { notifyAfter } from "./push-targets";
import { DEFAULT_RUNTIME_MIN, latestAired, seasonSchedules, type SeasonSchedule } from "./schedule";
import { followsOf, games, seasonHeaders, type SeasonHeader } from "./show-space";

// Planned nights (docs/PLAN-new-design.md step 11 part 3; the mock's watching.js inviteWatch and streaming.js plans;
// db/migrations/0127): someone on a couch plans a watch along for an episode, the live airing or a shared start at a time
// they pick, and invites people on the couch. Each says I'm in or Can't make it (anyone else on the couch can join it too),
// and whoever planned it can call it off (with Undo). The invited get one push; the hub's feed has a line; the guide tags the
// airing or shows the night as a card of its own (the pure src/lib/game/guide.ts). Its watch along, one clock for everyone in it,
// is step 13 part 3's (watch-along.ts togetherRead/togetherWrite): opening it says you're in.
//
//   GET  /api/seasons/[id]/plans?couch=   what can be planned: the episodes, who's on the couch, the plans already made
//   POST /api/seasons/[id]/plans?couch=   plan one: { episode, how, startsAt?, invite }
//   POST /api/plans/[id]                  { answer: "in" | "out" } or { cancel: true | false }
//
// Spoiler-safe (guard.ts): a plan carries when, which episode and who's in, never a title or a result. Seen by the couch it's
// on (planning a show you watch privately tells the couch you watch it: your choice, by planning it). Read with the home and
// the hub; nothing polls (docs/HOSTING.md).

export type PlanHow = "live" | "start";
export type PlanAnswer = "in" | "out" | "invited";

export interface PlanPerson {
  userId: string;
  name: string;
  answer: PlanAnswer;
  /** Asked by whoever planned it (false: joined on their own, or planned it). */
  invited: boolean;
}

export interface WatchPlan {
  id: string;
  couchId: string;
  seasonId: string;
  /** Its show (Hide from guide hides a show). */
  showId: string;
  /** The show as people say it ("The Traitors"), its season and art, for a guide card of its own. */
  name: string;
  seasonNumber: number | null;
  artUrl: string | null;
  /** "Traitors 5". */
  label: string;
  release: "weekly" | "nightly" | "binge";
  episode: number;
  how: PlanHow;
  /** When it starts: the live airing's time as the schedule has it now, or the shared start. */
  startsAt: string;
  endsAt: string;
  host: { userId: string | null; name: string };
  /** Whoever planned it first, then who's in, who's invited, who can't make it. */
  people: PlanPerson[];
  /** You planned it, said you're in or can't, were invited, or none of those (null: you can join it). */
  you: "host" | PlanAnswer | null;
  createdAt: string;
}

/** An episode the plan sheet offers. */
export interface PlanEpisode {
  number: number;
  /** When it's out: its airing, or a streaming season's drop. */
  airAt: string | null;
  aired: boolean;
  /** The live airing can be planned: it hasn't aired and isn't a streaming drop. */
  live: boolean;
  /** The couch's plan for it already, if there is one. */
  planned: string | null;
}

export interface PlanOptions {
  seasonId: string;
  couchId: string;
  label: string;
  /** The show as people say it, for the sheet's subtitle. */
  show: string;
  artUrl: string | null;
  release: "weekly" | "nightly" | "binge";
  /** The season's own time zone (the push's times are in it). */
  airTz: string;
  episodes: PlanEpisode[];
  /** The episode the sheet starts on: your next one. */
  from: number | null;
  /** Everyone else on the couch, and whether each watches it (openly) or plays it here: they're invited by default. */
  people: { userId: string; name: string; watches: boolean }[];
  /** The couch's plans for this season still to come. */
  plans: WatchPlan[];
  /** Why nothing can be planned, or null. */
  blocked: string | null;
}

/** How far ahead a night can be planned. */
const MAX_AHEAD_MS = 60 * 24 * 3600 * 1000;
/** How many episodes the sheet offers, from your next. */
const EPISODES_OFFERED = 6;

const plain = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, "").trim() || name;
const labelOf = (h: SeasonHeader) => `${plain(h.show.name).replace(/^The /, "")}${h.seasonNumber ? ` ${h.seasonNumber}` : ""}`;
const nameOf = (user: SessionUser) => (user as { username?: string | null }).username || user.name;

/** When a plan starts and ends: the live airing follows the episode's air time if the schedule moves; a shared start is its own. */
export function planTimes(how: PlanHow, episode: number, startsAt: Date, schedule: SeasonSchedule | undefined): { at: number; endsAt: number } {
  const ep = schedule?.episodes.find((e) => e.number === episode);
  const air = ep?.airAt ? Date.parse(ep.airAt) : null;
  const at = how === "live" && air != null ? air : startsAt.getTime();
  return { at, endsAt: at + (ep?.runtimeMin ?? DEFAULT_RUNTIME_MIN) * 60_000 };
}

/** When an episode is out to watch: its airing, or a streaming season's drop (the schedule gives each episode the drop). */
const outAt = (schedule: SeasonSchedule | undefined, episode: number): number | null => {
  const at = schedule?.episodes.find((e) => e.number === episode)?.airAt;
  return at ? Date.parse(at) : null;
};

type PlanRow = {
  id: string;
  couch_id: string;
  season_id: string;
  episode: number;
  how: PlanHow;
  starts_at: Date;
  created_by: string | null;
  host_name: string | null;
  created_at: Date;
  cancelled_at: Date | null;
  people: { userId: string; answer: PlanAnswer; invited: boolean }[];
};

async function planRows(where: string, params: unknown[]): Promise<PlanRow[]> {
  const { rows } = await pool.query(
    `SELECT p.id, p.couch_id, p.season_id, p.episode, p.how, p.starts_at, p.created_by, COALESCE(u.username, u.name) AS host_name, p.created_at, p.cancelled_at,
            COALESCE((SELECT json_agg(json_build_object('userId', pp.user_id, 'answer', pp.answer, 'invited', pp.invited))
                        FROM watch_plan_people pp WHERE pp.plan_id = p.id), '[]'::json) AS people
       FROM watch_plans p LEFT JOIN "user" u ON u.id = p.created_by
      WHERE ${where}
      ORDER BY p.starts_at, p.created_at`,
    params
  );
  return rows;
}

const ANSWER_ORDER: Record<PlanAnswer, number> = { in: 0, invited: 1, out: 2 };

type Known = { members?: Map<string, CouchMember[]>; schedules?: Map<string, SeasonSchedule>; headers?: Map<string, SeasonHeader> };

/** Plan rows as a viewer sees them: times from the schedule, names from the couch (someone who's left it drops out). */
async function plansOf(viewerId: string, rows: PlanRow[], now: Date, known: Known = {}, keepPast = false): Promise<WatchPlan[]> {
  if (!rows.length) return [];
  // Only what the caller hasn't read already (the home has its couches, and most of the seasons).
  const missing = <T,>(have: Map<string, T> | undefined, ids: string[]) => ids.filter((id) => !have?.has(id));
  const merged = <T,>(have: Map<string, T> | undefined, more: Map<string, T>) => new Map([...(have ?? []), ...more]);
  const couchIds = [...new Set(rows.map((r) => r.couch_id))];
  const seasonIds = [...new Set(rows.map((r) => r.season_id))];
  const [members, schedules, headers] = await Promise.all([
    couchMembers(missing(known.members, couchIds)).then((m) => merged(known.members, m)),
    seasonSchedules(missing(known.schedules, seasonIds), now).then((m) => merged(known.schedules, m)),
    seasonHeaders(missing(known.headers, seasonIds)).then((m) => merged(known.headers, m)),
  ]);
  const out: WatchPlan[] = [];
  for (const r of rows) {
    const h = headers.get(r.season_id);
    if (!h) continue;
    const { at, endsAt } = planTimes(r.how, r.episode, new Date(r.starts_at), schedules.get(r.season_id));
    if (!keepPast && endsAt <= now.getTime()) continue;
    const on = new Map((members.get(r.couch_id) ?? []).map((m) => [m.userId, m.name]));
    const people = r.people
      .filter((p) => on.has(p.userId))
      .map((p) => ({ userId: p.userId, name: on.get(p.userId)!, answer: p.answer, invited: p.invited }))
      .sort((a, b) => Number(b.userId === r.created_by) - Number(a.userId === r.created_by) || ANSWER_ORDER[a.answer] - ANSWER_ORDER[b.answer] || a.name.localeCompare(b.name));
    const mine = r.people.find((p) => p.userId === viewerId);
    out.push({
      id: r.id,
      couchId: r.couch_id,
      seasonId: r.season_id,
      showId: h.show.id,
      name: plain(h.show.name),
      seasonNumber: h.seasonNumber ?? null,
      artUrl: h.show.artUrl,
      label: labelOf(h),
      release: h.release,
      episode: r.episode,
      how: r.how,
      startsAt: new Date(at).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      host: { userId: r.created_by, name: (r.created_by && on.get(r.created_by)) || r.host_name || "Someone" },
      people,
      you: r.created_by === viewerId ? "host" : (mine?.answer ?? null),
      createdAt: new Date(r.created_at).toISOString(),
    });
  }
  return out.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

/** The plans still to come on these couches (the home read: the guide, a show's Tonight). */
export async function plansFor(viewerId: string, couchIds: string[], now = new Date(), known: Known = {}): Promise<WatchPlan[]> {
  if (!couchIds.length) return [];
  // A live airing's time follows the schedule, so a few days' slack before the stored time.
  const rows = await planRows("p.couch_id = ANY($1::uuid[]) AND p.cancelled_at IS NULL AND p.starts_at > $2::timestamptz - interval '8 days'", [couchIds, now]);
  return plansOf(viewerId, rows, now, known);
}

/** Your couches' plans still to come, as a write answers them (the home's list, put in place without reading the home again). */
async function yourPlans(userId: string, now: Date): Promise<WatchPlan[]> {
  const { rows } = await pool.query("SELECT couch_id FROM couch_members WHERE user_id = $1", [userId]);
  return plansFor(userId, rows.map((r) => r.couch_id as string), now);
}

/** You're on this couch (not only a site admin looking): planning and answering are the couch's. */
async function onCouch(user: SessionUser, couchId: string | null): Promise<string> {
  if (!couchId || !isUuid(couchId)) throw new HttpError(400, "couch required");
  if ((await requireCouch(user, couchId)) === "viewer") throw new HttpError(403, "Join the couch to plan a watch along");
  return couchId;
}

/** Who on the couch watches this season openly, or plays a game on it here. */
async function watchersOf(user: SessionUser, couchId: string, seasonId: string, people: CouchMember[]): Promise<Set<string>> {
  const [follows, here] = await Promise.all([followsOf(user.id, people.map((p) => p.userId)), games(user.id, { couchIds: [couchId], seasonId })]);
  const players = here.length
    ? (await pool.query("SELECT DISTINCT user_id FROM league_memberships WHERE league_id = ANY($1::uuid[])", [here.map((g) => g.leagueId)])).rows.map((r) => r.user_id as string)
    : [];
  return new Set([...players, ...follows.filter((f) => f.seasonId === seasonId && f.following && !f.private).map((f) => f.userId)]);
}

/** What can be planned on a season for a couch (GET /api/seasons/[id]/plans?couch=). */
export async function planOptions(user: SessionUser, seasonId: string, couchIdIn: string | null, now = new Date()): Promise<PlanOptions> {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const couchId = await onCouch(user, couchIdIn);
  const [headers, schedules, members, mark] = await Promise.all([seasonHeaders([seasonId]), seasonSchedules([seasonId], now), couchMembers([couchId]), seenThrough(user.id, seasonId)]);
  const h = headers.get(seasonId);
  if (!h) throw new HttpError(404, "Season not found");
  const schedule = schedules.get(seasonId);
  const everyone = members.get(couchId) ?? [];
  const others = everyone.filter((m) => m.userId !== user.id);
  const [watches, rows] = await Promise.all([
    watchersOf(user, couchId, seasonId, others),
    planRows("p.couch_id = $1 AND p.season_id = $2 AND p.cancelled_at IS NULL", [couchId, seasonId]),
  ]);
  const plans = await plansOf(user.id, rows, now, { members, schedules, headers });
  const planned = new Map(plans.map((p) => [p.episode, p.id]));

  // From your next episode (spoiler protection off: the next after what's aired), the ones whose time is known.
  const seen = Number.isFinite(mark) ? mark : latestAired(schedule, now);
  const binge = schedule?.release === "binge";
  const episodes: PlanEpisode[] = [];
  for (const e of schedule?.episodes ?? []) {
    if (e.number <= seen || !e.airAt || episodes.length >= EPISODES_OFFERED) continue;
    const at = Date.parse(e.airAt);
    episodes.push({ number: e.number, airAt: e.airAt, aired: at <= now.getTime(), live: !binge && at > now.getTime(), planned: planned.get(e.number) ?? null });
  }
  const blocked = !others.length
    ? "Nobody else is on the couch yet: invite someone first"
    : !episodes.length
      ? seen > 0 && h.episodeCount && seen >= h.episodeCount
        ? "You've seen every episode"
        : "Nothing to plan yet: no episode has a time"
      : null;
  return {
    seasonId,
    couchId,
    label: labelOf(h),
    show: plain(h.show.name),
    artUrl: h.show.artUrl,
    release: h.release,
    airTz: schedule?.airTz ?? "America/New_York",
    episodes,
    from: episodes[0]?.number ?? null,
    people: others.map((m) => ({ userId: m.userId, name: m.name, watches: watches.has(m.userId) })),
    plans,
    blocked,
  };
}

/** "Wed 8:00 PM EDT", in the show's own zone: a push can't know the phone's. */
function clock(t: number, tz: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(t)).replace(", ", " ");
}

export interface PlanAnswerOut {
  plan: WatchPlan;
  /** Your couches' plans still to come, for the home. */
  plans: WatchPlan[];
}

/** Plan a watch along (POST /api/seasons/[id]/plans?couch=): `{ episode, how, startsAt?, invite: userIds }`. */
export async function planNight(
  user: SessionUser,
  seasonId: string,
  couchIdIn: string | null,
  body: { episode?: unknown; how?: unknown; startsAt?: unknown; invite?: unknown },
  now = new Date()
): Promise<PlanAnswerOut & { told: number }> {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const couchId = await onCouch(user, couchIdIn);
  const episode = body.episode;
  if (!Number.isInteger(episode) || (episode as number) < 1) throw new HttpError(400, "Which episode?");
  if (body.how !== "live" && body.how !== "start") throw new HttpError(400, "how must be live or start");
  const how = body.how as PlanHow;
  const invite = Array.isArray(body.invite) ? [...new Set(body.invite.filter((x): x is string => typeof x === "string"))] : null;
  if (!invite?.length) throw new HttpError(400, "Invite someone on the couch");

  const [headers, schedules, members] = await Promise.all([seasonHeaders([seasonId]), seasonSchedules([seasonId], now), couchMembers([couchId])]);
  const h = headers.get(seasonId);
  if (!h) throw new HttpError(404, "Season not found");
  const schedule = schedules.get(seasonId);
  const on = new Set((members.get(couchId) ?? []).map((m) => m.userId));
  if (invite.some((id) => id === user.id || !on.has(id))) throw new HttpError(400, "Invite people on the couch (not yourself)");

  const out = outAt(schedule, episode as number);
  if (out == null) throw new HttpError(409, `Episode ${episode} has no time yet`);
  let at: number;
  if (how === "live") {
    if (schedule?.release === "binge") throw new HttpError(409, "A streaming season has no live airing: start it together");
    if (out <= now.getTime()) throw new HttpError(409, `Episode ${episode} has aired: start it together instead`);
    at = out;
  } else {
    at = typeof body.startsAt === "string" ? Date.parse(body.startsAt) : NaN;
    if (!Number.isFinite(at)) throw new HttpError(400, "startsAt: when it starts");
    if (at < now.getTime() - 60_000) throw new HttpError(409, "Pick a time still to come");
    if (at > now.getTime() + MAX_AHEAD_MS) throw new HttpError(409, "Plan it within two months");
    if (at < out) throw new HttpError(409, `Episode ${episode} isn't out until ${clock(out, schedule?.airTz ?? "America/New_York")}`);
  }

  let id: string;
  try {
    const { rows } = await pool.query(
      `WITH p AS (INSERT INTO watch_plans (couch_id, season_id, episode, how, starts_at, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id),
            host AS (INSERT INTO watch_plan_people (plan_id, user_id, answer, invited, answered_at) SELECT id, $6, 'in', false, now() FROM p)
       INSERT INTO watch_plan_people (plan_id, user_id) SELECT p.id, u FROM p, unnest($7::text[]) u RETURNING plan_id`,
      [couchId, seasonId, episode, how, new Date(at), user.id, invite]
    );
    id = rows[0].plan_id;
  } catch (e) {
    if ((e as { code?: string }).code === "23505") throw new HttpError(409, `There's already a watch along for Episode ${episode} on the couch`);
    throw e;
  }

  // One push to everyone invited, to the show (where I'm in is), in the show's own time zone.
  const host = nameOf(user);
  const label = labelOf(h);
  const when = clock(at, schedule?.airTz ?? "America/New_York");
  notifyAfter("invite", async () => ({
    userIds: invite,
    message: {
      title: `${host} planned a watch along`,
      body: `${label} · Episode ${episode} · ${how === "live" ? "the live airing" : "starting together"}, ${when}. Are you in?`,
      url: `/show/${seasonId}/tonight`,
      tag: `plan-${id}`,
    },
  }));
  const plans = await yourPlans(user.id, now);
  const plan = plans.find((p) => p.id === id) ?? (await planById(user, id, now)).plan;
  return { plan, plans, told: invite.length };
}

/** A plan you can see (on your couch): its row and the plan as you see it (a night that's over too). */
export async function planById(user: SessionUser, planId: string, now: Date): Promise<{ row: PlanRow; plan: WatchPlan }> {
  if (!isUuid(planId)) throw new HttpError(404, "Watch along not found");
  const [row] = await planRows("p.id = $1", [planId]);
  if (!row) throw new HttpError(404, "Watch along not found");
  await onCouch(user, row.couch_id).catch(() => {
    throw new HttpError(404, "Watch along not found");
  });
  const [plan] = await plansOf(user.id, [row], now, {}, true);
  if (!plan) throw new HttpError(404, "Watch along not found");
  return { row, plan };
}

/** I'm in / Can't make it (POST /api/plans/[id] { answer }): anyone on the couch, invited or not; not whoever planned it. */
export async function answerPlan(user: SessionUser, planId: string, answer: unknown, now = new Date()): Promise<PlanAnswerOut> {
  if (answer !== "in" && answer !== "out") throw new HttpError(400, "answer must be in or out");
  const { row, plan } = await planById(user, planId, now);
  if (row.cancelled_at) throw new HttpError(409, "That watch along was called off");
  if (Date.parse(plan.endsAt) <= now.getTime()) throw new HttpError(409, "That night's over");
  if (row.created_by === user.id && answer === "out") throw new HttpError(409, "You planned it: call it off instead");
  await pool.query(
    `INSERT INTO watch_plan_people (plan_id, user_id, answer, invited, answered_at) VALUES ($1, $2, $3, false, now())
     ON CONFLICT (plan_id, user_id) DO UPDATE SET answer = EXCLUDED.answer, answered_at = now()`,
    [planId, user.id, answer]
  );
  return answered(user, planId, now);
}

/** Opening a night's watch along together (step 13 part 3) says you're in, if you hadn't (whoever planned it is already). */
export async function inPlan(planId: string, userId: string): Promise<void> {
  await pool.query(
    `INSERT INTO watch_plan_people (plan_id, user_id, answer, invited, answered_at) VALUES ($1, $2, 'in', false, now())
     ON CONFLICT (plan_id, user_id) DO UPDATE SET answer = 'in', answered_at = now() WHERE watch_plan_people.answer <> 'in'`,
    [planId, userId]
  );
}

/** Call it off, or bring it back (Undo) (POST /api/plans/[id] { cancel }): whoever planned it. */
export async function cancelPlan(user: SessionUser, planId: string, cancel: unknown, now = new Date()): Promise<PlanAnswerOut> {
  if (typeof cancel !== "boolean") throw new HttpError(400, "cancel must be true or false");
  const { row, plan } = await planById(user, planId, now);
  if (row.created_by !== user.id) throw new HttpError(403, "Only whoever planned it can call it off");
  if (!cancel && Date.parse(plan.endsAt) <= now.getTime()) throw new HttpError(409, "That night's over");
  try {
    await pool.query(`UPDATE watch_plans SET cancelled_at = ${cancel ? "COALESCE(cancelled_at, now())" : "NULL"} WHERE id = $1`, [planId]);
  } catch (e) {
    if ((e as { code?: string }).code === "23505") throw new HttpError(409, `Someone has planned Episode ${row.episode} since`);
    throw e;
  }
  return answered(user, planId, now);
}

async function answered(user: SessionUser, planId: string, now: Date): Promise<PlanAnswerOut> {
  const [{ plan }, plans] = await Promise.all([planById(user, planId, now), yourPlans(user.id, now)]);
  return { plan, plans };
}

/** The couch's plans lately, for the hub's feed: who planned what and when it is (not called off). */
export async function plansLately(couchId: string, now = new Date()): Promise<{ id: string; userId: string | null; at: string; seasonId: string; episode: number; how: PlanHow; startsAt: string; going: number }[]> {
  const rows = await planRows("p.couch_id = $1 AND p.cancelled_at IS NULL AND p.created_at > now() - interval '60 days'", [couchId]);
  if (!rows.length) return [];
  const schedules = await seasonSchedules([...new Set(rows.map((r) => r.season_id))], now);
  return rows.map((r) => ({
    id: r.id,
    userId: r.created_by,
    at: new Date(r.created_at).toISOString(),
    seasonId: r.season_id,
    episode: r.episode,
    how: r.how,
    startsAt: new Date(planTimes(r.how, r.episode, new Date(r.starts_at), schedules.get(r.season_id)).at).toISOString(),
    going: r.people.filter((p) => p.answer === "in").length,
  }));
}
