import type { PoolClient } from "pg";
import { seasonStatus, type TvSeason } from "@/lib/game/listing";
import { isUuid, type SessionUser } from "./auth-helpers";
import { confirmAt } from "./community-results";
import { dayGap, dayIn, fmt, mdIn, plural, timeIn, yearOf, ymd, zoneOf, ZONES } from "./desk-dates";
import { pool, tx, HttpError } from "./db";
import { SEASON_NAME, logDesk } from "./desk";
import { nudgeBotClock } from "./desk-bot";
import { seasonLines } from "./desk-cast";
import { listingTimes } from "./desk-schedule";
import { hasSchedule, latestAired, seasonSchedules, upNext, type SeasonSchedule } from "./schedule";
import { syncSeasonLeagues } from "./season-decisions";

// A season's Setup on the desk (docs/PLAN-desk-parity.md step 3; the mock's desk-setup.js): the season as it's set (its
// status, name and next episode), The season (Name; Status, which holds over its TV listing's dates once set here:
// status_held_at, 0422), its Schedule (its sheets' changes are desk-schedule.ts, part 3b), Results (who decides), History and the
// season's Delete, the same as the season page's: refused while games play it, else gone for good. Name, Status and Who
// decides are tier 1, each a line in the season's History with Undo. Dates and times are in the season's own zone, as
// its schedule is set ("Wednesdays 8:05 PM Eastern").

type Status = "upcoming" | "airing" | "completed";
const STATUS_WORD: Record<Status, string> = { upcoming: "Upcoming", airing: "Airing", completed: "Ended" };
const NAME_MAX = 60;

/** The status a season's listing dates give it today: the listings' own rule (listing.ts seasonStatus), as the daily job's. */
const statusByDates = (premiere: string | null, finale: string | null, now = new Date()): Status =>
  seasonStatus({ premiereDate: premiere, endDate: finale } as TvSeason, now);

// ---------- the season and its games ----------

interface SetupRow {
  id: string;
  name: string;
  own_name: string | null;
  default_name: string;
  show_id: string;
  show_name: string;
  slug: string;
  season_number: number;
  status: Status;
  status_held_at: Date | null;
  premiere: string | null;
  finale: string | null;
  listing_id: number | null;
  listing: { name?: string; network?: string } | null;
  results_by: "admin" | "leagues";
  results_admin_since: Date | null;
  release: "weekly" | "nightly" | "binge";
  air_time: string | null;
  air_tz: string | null;
  drop_at: Date | null;
  times_held_at: Date | null;
  count_held_at: Date | null;
}

async function setupRow(id: string, db: Pick<PoolClient, "query"> = pool, lock = false): Promise<SetupRow> {
  if (!isUuid(id)) throw new HttpError(404, "Season not found");
  const { rows } = await db.query(
    `SELECT ss.id, ${SEASON_NAME} AS name, ss.name AS own_name, s.name || ' ' || ss.season_number AS default_name, ss.show_id, s.name AS show_name,
            s.slug, ss.season_number, ss.status, ss.status_held_at, to_char(ss.premiere_date, 'YYYY-MM-DD') AS premiere,
            to_char(ss.finale_date, 'YYYY-MM-DD') AS finale, ss.listing_id, s.listing, ss.results_by, ss.results_admin_since,
            ss.release, to_char(ss.air_time, 'HH24:MI') AS air_time, ss.air_tz, ss.drop_at, ss.times_held_at, ss.count_held_at
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1${lock ? " FOR UPDATE OF ss" : ""}`,
    [id]
  );
  if (!rows.length) throw new HttpError(404, "Season not found");
  return rows[0];
}

export interface SeasonGame {
  id: string;
  name: string;
  couch: { id: string; name: string } | null;
  ended: boolean;
}

const ON_SEASON = `((l.state->'settings'->>'showId' = $2 AND l.state->'settings'->>'wikiSeason' = $3) OR l.solo_season_id = $1)`;

/**
 * The games that hold a season: people's own games on it (a couch's, or one from before couches), ended ones too, deleted
 * ones aside (a game is deleted from its Backstage). Its public pool and practice games don't: they're the season's own,
 * with no couch to delete them from, and go with it (`soloOn`).
 */
async function gamesOn(db: Pick<PoolClient, "query">, s: { id: string; slug: string; season_number: number }): Promise<SeasonGame[]> {
  const { rows } = await db.query(
    `SELECT l.id, l.name, c.id AS couch_id, c.name AS couch, COALESCE(l.state->'settings'->>'archivedAt', '') <> '' AS ended
       FROM leagues l LEFT JOIN couches c ON c.id = l.couch_id
      WHERE l.deleted_at IS NULL AND l.solo IS NULL AND ${ON_SEASON}
      ORDER BY ended, l.name`,
    [s.id, s.slug, String(s.season_number)]
  );
  return rows.map((r) => ({ id: r.id, name: r.name, couch: r.couch_id ? { id: r.couch_id, name: r.couch } : null, ended: r.ended }));
}

/** Its public pool (and how many play it) and its practice games, live ones: what goes with it. */
async function soloOn(db: Pick<PoolClient, "query">, s: { id: string; slug: string; season_number: number }): Promise<{ ids: string[]; pool: number | null; practice: number }> {
  const { rows } = await db.query(
    `SELECT l.id, l.solo, l.deleted_at IS NULL AS live, (SELECT count(*)::int FROM league_memberships m WHERE m.league_id = l.id) AS people
       FROM leagues l WHERE l.solo IS NOT NULL AND ${ON_SEASON}`,
    [s.id, s.slug, String(s.season_number)]
  );
  const pool = rows.find((r) => r.solo === "public" && r.live);
  return { ids: rows.map((r) => r.id), pool: pool ? pool.people : null, practice: rows.filter((r) => r.solo === "practice" && r.live).length };
}

/** A season's Delete, the same on its page and its Setup: the games in its way, or what goes with it. */
export interface SeasonDelete {
  name: string;
  show: string;
  games: SeasonGame[];
  /** What goes with it: its public pool (how many play it; null: none) and its practice games. */
  pool: number | null;
  practice: number;
  /** People following it, who lose it from their shows and the guide. */
  followers: number;
  /** The Delete row's line. */
  line: string;
}

async function seasonDelete(s: SetupRow): Promise<SeasonDelete> {
  const [games, solo, follows] = await Promise.all([
    gamesOn(pool, s),
    soloOn(pool, s),
    pool.query("SELECT count(*)::int AS n FROM show_follows WHERE season_id = $1 AND following", [s.id]),
  ]);
  return {
    name: s.name,
    show: s.show_name,
    games,
    pool: solo.pool,
    practice: solo.practice,
    followers: follows.rows[0].n,
    line: games.length ? `Not while ${plural(games.length, "game")} play it` : "Its episodes, cast and results go",
  };
}

// ---------- Setup ----------

export interface RundownRow {
  number: number;
  /** "Tonight", "Tomorrow", "Nov 4". */
  day: string;
  today: boolean;
  hm: string;
  ap: string;
  title: string;
  /** "Wednesday October 28". */
  date: string;
}

export interface DeskSetup {
  id: string;
  name: string;
  ownName: string | null;
  defaultName: string;
  show: { id: string; name: string };
  status: Status;
  /** A status set on the desk, holding over its listing's dates. */
  held: boolean;
  /** What its listing's dates would make it (a linked season only). */
  byDates: Status | null;
  linked: boolean;
  scheduled: boolean;
  /** How many episodes it has, when that's known. */
  count: number | null;
  /** Its time zone's name ("Eastern"), which its dates and times are in. */
  zone: string;
  /** The lower third's line: its next episode, or how it ended. */
  next: string;
  facts: string;
  rows: { status: string; when: string; episodes: string; listing: string; results: string };
  /** Times set by hand win over its listing's (0423), and a count set by hand holds over its listing's. */
  timesHeld: boolean;
  countHeld: boolean;
  /** When it airs as its sheet opens: how, the first episode (or the drop), the time and zone. */
  form: { how: "weekly" | "nightly" | "binge"; premiere: string; time: string; tz: string };
  /** The zones When it airs offers: [id, name]. */
  zones: [string, string][];
  /** Its TV listing's sheet, when it's linked: what the listing says and what it does. */
  listing: { name: string; network: string | null; times: string; dates: string } | null;
  /** The season page's Running it › Setup line. */
  setupLine: string;
  /** The Schedule section's aside: "From its TV listing", "Set by hand, by alex", "Kept from its old listing", or nothing. */
  source: string | null;
  rundown: ({ kind: "ep" } & RundownRow | { kind: "gap"; text: string })[];
  episodes: { number: number; date: string; time: string; finale: boolean; aired: boolean; tonight: boolean }[];
  resultsBy: "admin" | "leagues";
  adminSince: string | null;
  confirmAt: number;
  /** Results only the desk accepted, which leave its games if it goes back to sources that agree. */
  onlyYours: number;
  delete: SeasonDelete;
  history: Awaited<ReturnType<typeof seasonLines>>;
}

function rundownOf(sch: SeasonSchedule, status: Status, now: Date): DeskSetup["rundown"] {
  const tz = sch.airTz;
  const eps = sch.episodes.filter((e) => e.airAt);
  if (!eps.length || status === "completed") return [];
  const at = (n: number) => sch.episodes.find((e) => e.number === n)?.airAt ?? null;
  // An episode at its time (a drop's: every episode at once).
  const row = (n: number, when: string, title?: string): RundownRow & { kind: "ep" } => {
    const t = new Date(when);
    const k = dayGap(ymd(now, tz), ymd(t, tz));
    const hm = timeIn(t, tz);
    const count = sch.episodeCount;
    return {
      kind: "ep",
      number: n,
      day: k === 0 ? (Number(fmt(t, tz, { hour: "numeric", hour12: false })) >= 17 ? "Tonight" : "Today") : k === 1 ? "Tomorrow" : mdIn(t, tz, now),
      today: k === 0,
      hm: hm.replace(/\s?[AP]M$/, ""),
      ap: hm.slice(-2),
      title: title ?? `Episode ${n}${count === n && n > 1 ? " · the finale" : n === 1 ? " · the premiere" : ""}`,
      date: fmt(t, tz, { weekday: "long", month: "long", day: "numeric" }) + yearOf(t, tz, now),
    };
  };
  if (sch.release === "binge") return sch.dropAt && Date.parse(sch.dropAt) > now.getTime() ? [row(1, sch.dropAt, sch.episodeCount ? `All ${sch.episodeCount} episodes` : "Every episode")] : [];
  const next = upNext(sch, now);
  if (!next) return [];
  const last = sch.episodes[sch.episodes.length - 1].number;
  const picks = [next.number, next.number + 1].filter((n) => n <= last && at(n));
  const finale = sch.episodeCount;
  if (finale && finale > next.number + 1 && at(finale)) picks.push(finale);
  const out: DeskSetup["rundown"] = [];
  picks.forEach((n, i) => {
    if (i === 2 && n > picks[1] + 1) {
      const a = picks[1] + 1;
      out.push({ kind: "gap", text: `${n - 1 === a ? `Episode ${a}` : `Episodes ${a} to ${n - 1}`}, ${sch.release === "nightly" ? "nightly" : "weekly"}` });
    }
    out.push(row(n, at(n)!));
  });
  return out;
}

/** When it airs as its sheet opens: what's set, else weekly at 8 PM from nothing, in its zone. */
function formOf(s: SetupRow, tz: string): DeskSetup["form"] {
  if (s.release === "binge" && s.drop_at) return { how: "binge", premiere: ymd(s.drop_at, tz), time: fmt(s.drop_at, tz, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }), tz };
  return { how: s.release === "binge" ? "weekly" : s.release, premiere: s.premiere ?? "", time: s.air_time ?? "20:00", tz };
}

/** A season's Setup page. */
export async function deskSetup(id: string, now = new Date()): Promise<DeskSetup> {
  const s = await setupRow(id);
  const [schedules, del, n, history, onlyYours, listed, byHand] = await Promise.all([
    seasonSchedules([id], now),
    seasonDelete(s),
    confirmAt(),
    seasonLines(id),
    s.results_by === "admin" ? onlyYoursCount(pool, id, s.results_admin_since) : 0,
    pool.query("SELECT number, air_at FROM season_episodes WHERE season_id = $1 AND source = 'listing' AND air_at IS NOT NULL ORDER BY number", [id]),
    // Who set its times by hand, for the Schedule's aside: the latest When it airs still standing.
    pool.query(
      `SELECT COALESCE(u.username, u.name) AS who FROM admin_changes c LEFT JOIN "user" u ON u.id = c.user_id
        WHERE c.entity = 'season' AND c.entity_id = $1 AND c.action = 'when' AND c.undone_at IS NULL ORDER BY c.created_at DESC LIMIT 1`,
      [id]
    ),
  ]);
  const sch = schedules.get(id)!;
  const tz = sch.airTz || "America/New_York";
  const scheduled = hasSchedule(sch);
  const linked = s.listing_id != null;
  const status = s.status;
  const count = sch.episodeCount;
  const dated = sch.episodes.filter((e) => e.airAt);
  const first = dated[0] ? new Date(dated[0].airAt!) : null;
  const lastEp = dated[dated.length - 1];
  const finale = count ? sch.episodes.find((e) => e.number === count && e.airAt) : null;
  const aired = latestAired(sch, now);

  let next: string;
  if (!scheduled) next = "No schedule yet";
  else if (status === "completed") next = count && lastEp ? `${plural(count, "episode")} · ended ${mdIn(new Date(lastEp.airAt!), tz, now)}` : "Ended";
  else if (sch.release === "binge" && sch.dropAt) {
    const drop = new Date(sch.dropAt);
    next = drop.getTime() > now.getTime() ? `All ${count ? `${count} ` : ""}drop ${dayIn(drop, tz, now)}, ${timeIn(drop, tz)}` : `All ${count ? `${count} ` : ""}out since ${mdIn(drop, tz, now)}`;
  } else {
    const up = upNext(sch, now);
    next = up?.airAt
      ? `${up.number === 1 ? "Premieres" : `Episode ${up.number}`} · ${up.live ? "on now" : `${dayIn(new Date(up.airAt), tz, now)}, ${timeIn(new Date(up.airAt), tz)}`}`
      : count
        ? `${plural(count, "episode")} · all aired`
        : `${plural(aired, "episode")} aired · the next isn't dated`;
  }

  let when = "Not set";
  if (scheduled && sch.release === "binge" && sch.dropAt) {
    const drop = new Date(sch.dropAt);
    when = `All at once · ${fmt(drop, tz, { weekday: "short", month: "short", day: "numeric" })}${yearOf(drop, tz, now)}, ${timeIn(drop, tz)} ${zoneOf(tz)}`;
  } else if (first) {
    const span = status === "completed" && lastEp ? `${mdIn(first, tz, now)} to ${mdIn(new Date(lastEp.airAt!), tz, now)}` : `from ${mdIn(first, tz, now)}`;
    when = `${sch.release === "nightly" ? "Nightly," : `${fmt(first, tz, { weekday: "long" })}s`} ${timeIn(first, tz)} ${zoneOf(tz)} · ${span}`;
  }

  const listingName = s.listing?.name ?? s.show_name;
  const lt = listingTimes(
    listed.rows.map((r) => ({ number: r.number, airAt: r.air_at ? (r.air_at as Date).toISOString() : null })),
    tz,
    now
  );
  // Your time against the listing's: the next episode's, else the last.
  const ownRef = upNext(sch, now)?.airAt ?? lastEp?.airAt ?? null;
  const ownTime = ownRef ? timeIn(new Date(ownRef), tz) : null;
  // Held Ended over dates that say it's on, the daily job stops reading its listing (tv-listings.ts keepSeasons; Noticed ar).
  const notRead = linked && !!s.status_held_at && status === "completed" && statusByDates(s.premiere, s.finale, now) !== "completed";
  const kept = notRead ? "not read again while it's held Ended" : status === "completed" ? "its times, as it aired" : "its times, kept current each morning";
  const yours = s.times_held_at && ownTime && lt.time && ownTime !== lt.time ? ownTime : null;
  const rows = {
    status: `${STATUS_WORD[status]}${linked ? (s.status_held_at ? " · set by hand, held over its listing" : status === "completed" ? " · by its TV listing's dates" : " · moves on by its TV listing's dates") : ""}`,
    when,
    episodes: count ? `${count}${finale && count > 1 ? ` · the finale ${status === "completed" || Date.parse(finale.airAt!) < now.getTime() ? "was" : "is"} ${dayIn(new Date(finale.airAt!), tz, now)}` : ""}` : "Not known yet",
    listing: linked
      ? `${listingName}${s.listing?.network ? ` on ${s.listing.network}` : ""} · ${s.times_held_at ? (yours ? `your ${yours} wins over its ${lt.time}` : "your times win over its") : kept}`
      : "Not linked · nothing updates on its own",
    results:
      s.results_by === "admin"
        ? `You decide${s.results_admin_since ? ` · since ${mdIn(s.results_admin_since, tz, now)}` : ""}`
        : `Sources that agree · once ${n} agree, every game gets it`,
  };
  return {
    id,
    name: s.name,
    ownName: s.own_name,
    defaultName: s.default_name,
    show: { id: s.show_id, name: s.show_name },
    status,
    held: !!s.status_held_at,
    byDates: linked ? statusByDates(s.premiere, s.finale, now) : null,
    linked,
    scheduled,
    count,
    zone: zoneOf(tz),
    next,
    facts: `${plural(del.games.length + (del.pool != null ? 1 : 0) + del.practice, "game")} on it${scheduled && count && status === "airing" ? ` · ${Math.min(aired, count)} of ${count} aired` : ""}`,
    rows,
    timesHeld: !!s.times_held_at,
    countHeld: !!s.count_held_at,
    form: formOf(s, tz),
    zones: ZONES.some(([z]) => z === tz) ? ZONES : [...ZONES, [tz, tz]],
    listing: linked
      ? {
          name: listingName,
          network: s.listing?.network ?? null,
          times: `Its times: ${lt.how === "nightly" ? "nightly" : lt.days}${lt.time ? ` at ${lt.time} ${lt.zone}` : ""}, ${
            notRead ? "not read again while it's held Ended" : status === "completed" ? "as it aired" : "kept current each morning"
          }.${s.times_held_at ? (yours ? ` Yours, ${yours}, win.` : " Yours win.") : ""}`,
          dates: `Its dates move the status on: ${lt.first ? `airing from ${mdIn(lt.first, tz, now)}` : "not dated yet"}${count && lt.last ? `, ended after ${mdIn(lt.last, tz, now)}` : ""}.${
            s.status_held_at ? " Yours holds for now." : ""
          }`,
        }
      : null,
    setupLine: scheduled
      ? `${when.split(" · ")[0]} · ${count ? plural(count, "episode") : "episodes not known"} · ${s.results_by === "admin" ? "you decide results" : "results from sources"}`
      : "No schedule yet: nothing knows when it airs",
    source: s.times_held_at
      ? `Set by hand${byHand.rows[0]?.who ? `, by ${byHand.rows[0].who}` : ""}`
      : linked
        ? "From its TV listing"
        : listed.rows.length && scheduled
          ? "Kept from its old listing"
          : scheduled
            ? "Set by hand"
            : null,
    rundown: scheduled ? rundownOf(sch, status, now) : [],
    episodes: dated.map((e) => {
      const t = new Date(e.airAt!);
      return {
        number: e.number,
        date: fmt(t, tz, { weekday: "short", month: "short", day: "numeric" }) + yearOf(t, tz, now),
        time: timeIn(t, tz),
        finale: e.number === count && count > 1,
        aired: t.getTime() <= now.getTime(),
        tonight: t.getTime() > now.getTime() && ymd(t, tz) === ymd(now, tz),
      };
    }),
    resultsBy: s.results_by,
    adminSince: s.results_admin_since ? s.results_admin_since.toISOString() : null,
    confirmAt: n,
    onlyYours,
    delete: del,
    history,
  };
}

// ---------- its changes: tier 1, each a History line with Undo ----------

type Change = { changeId: string; text: string };

/** Name: blank (or the show and its number) shows the show and its number. */
export async function setSeasonName(user: SessionUser, id: string, raw: unknown): Promise<Change> {
  if (typeof raw !== "string") throw new HttpError(400, "name is text");
  const v = raw.trim().replace(/\s+/g, " ");
  if (v.length > NAME_MAX) throw new HttpError(400, `A name is ${NAME_MAX} characters at most`);
  return tx(async (db) => {
    const s = await setupRow(id, db, true);
    const name = v && v !== s.default_name ? v : null;
    if (name === s.own_name) throw new HttpError(409, "It's named that already");
    await db.query("UPDATE show_seasons SET name = $2, updated_at = now() WHERE id = $1", [id, name]);
    const changeId = await logDesk(db, {
      entity: "season",
      entityId: id,
      action: "name",
      text: name ? `Named "${name}"` : `Name cleared: it shows as ${s.default_name}`,
      before: { name: s.own_name },
      after: { name },
      undo: { type: "seasonSetup", id, field: "name", was: s.own_name, now: name },
      userId: user.id,
    });
    return { changeId, text: name ? `Named ${name}` : `Name cleared · it shows as ${s.default_name}` };
  });
}

/** Status: Upcoming, Airing or Ended. On a season linked to its listing it holds over the listing's dates; `back` lets the
 *  dates move it again (and sets it to what they say today). */
export async function setSeasonStatus(user: SessionUser, id: string, body: { status?: unknown; back?: unknown }): Promise<Change> {
  const back = body.back === true;
  const want = body.status;
  if (!back && !(want === "upcoming" || want === "airing" || want === "completed")) throw new HttpError(400, "status is upcoming, airing or completed");
  const out = await tx(async (db) => {
    const s = await setupRow(id, db, true);
    const linked = s.listing_id != null;
    let status: Status;
    let held: boolean;
    if (back) {
      if (!linked || !s.status_held_at) throw new HttpError(409, "Its listing's dates move it already");
      status = statusByDates(s.premiere, s.finale);
      held = false;
    } else {
      status = want as Status;
      // The status it has can be held too (its listing's dates would move it on), once.
      if (status === s.status && (!linked || s.status_held_at)) throw new HttpError(409, `It's ${STATUS_WORD[status]} already`);
      held = linked;
    }
    await db.query("UPDATE show_seasons SET status = $2, status_held_at = CASE WHEN $3 THEN COALESCE(status_held_at, now()) END, updated_at = now() WHERE id = $1", [id, status, held]);
    const changeId = await logDesk(db, {
      entity: "season",
      entityId: id,
      action: back ? "statusBack" : "status",
      text: back ? `Status back to its listing's dates: ${STATUS_WORD[status]}` : `Status: ${STATUS_WORD[status]}${held ? " (held over its listing)" : ""}`,
      before: { status: s.status, heldAt: s.status_held_at },
      after: { status, held },
      undo: { type: "seasonSetup", id, field: "status", was: { status: s.status, heldAt: s.status_held_at ? s.status_held_at.toISOString() : null }, now: { status, held } },
      userId: user.id,
    });
    return { changeId, text: back ? `Back to its listing's dates · ${STATUS_WORD[status]}` : `${s.name}: ${STATUS_WORD[status]}${status === s.status ? ", held" : ""}` };
  });
  // Which seasons the bot looks at follows their status (bot-research.js planRuns).
  nudgeBotClock();
  return out;
}

/**
 * Results only the desk accepted since its "You decide" began, with no source and not decided by you (a decided one reaches
 * the games on either setting, season-decisions.ts): what leaves its games when it goes back to sources.
 */
async function onlyYoursCount(db: Pick<PoolClient, "query">, id: string, since: Date | null): Promise<number> {
  const { rows } = await db.query(
    `SELECT count(*)::int AS n FROM season_decisions d
      WHERE d.season_id = $1 AND d.status = 'accepted' AND ($2::timestamptz IS NULL OR d.decided_at >= $2)
        AND d.locked_at IS NULL AND d.fact_status IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM fact_sources f WHERE f.decision_id = d.id)`,
    [id, since]
  );
  return rows[0].n;
}

/**
 * Who decides results (season-decisions.ts): 'leagues', sources that agree (only results somebody sent reach its games),
 * or 'admin', you decide (what the desk accepts reaches them too, from the switch on: results_admin_since, kept when it's
 * re-chosen, as classic's route did). Going back to sources takes out of its games what only the desk accepted, so its
 * games are synced at once rather than at their next result.
 */
export async function setResultsBy(user: SessionUser, id: string, by: unknown): Promise<Change> {
  if (by !== "admin" && by !== "leagues") throw new HttpError(400, "resultsBy is admin or leagues");
  const { out, sync } = await tx(async (db) => {
    const s = await setupRow(id, db, true);
    if (s.results_by === by) throw new HttpError(409, by === "admin" ? "You decide its results already" : "Its results come from sources already");
    const leaving = by === "leagues" ? await onlyYoursCount(db, id, s.results_admin_since) : 0;
    const { rows } = await db.query(
      `UPDATE show_seasons SET results_by = $2, results_admin_since = CASE WHEN $2 = 'admin' THEN now() ELSE results_admin_since END, updated_at = now()
        WHERE id = $1 RETURNING results_admin_since`,
      [id, by]
    );
    const changeId = await logDesk(db, {
      entity: "season",
      entityId: id,
      action: "resultsBy",
      text: by === "admin" ? "Results decided on the desk, from now on" : `Results from sources that agree${leaving ? ` (${plural(leaving, "result")} only the desk accepted left its games)` : ""}`,
      before: { resultsBy: s.results_by, since: s.results_admin_since },
      after: { resultsBy: by, since: rows[0].results_admin_since },
      undo: { type: "seasonSetup", id, field: "resultsBy", was: { by: s.results_by, since: s.results_admin_since ? s.results_admin_since.toISOString() : null }, now: { by } },
      userId: user.id,
    });
    const poss = s.name.endsWith("s") ? `${s.name}'` : `${s.name}'s`;
    return { out: { changeId, text: by === "admin" ? `You decide ${poss} results from now on` : `${poss} results come from sources that agree` }, sync: leaving > 0 };
  });
  if (sync) await syncSeasonLeagues(id, user.id);
  return out;
}

/** History's Undo for a Setup line: the field as it was, refused once it has moved on since. */
export async function restoreSeasonSetup(user: SessionUser, u: Record<string, unknown>): Promise<void> {
  const id = String(u.id);
  let sync = false;
  await tx(async (db) => {
    const s = await setupRow(id, db, true).catch((e) => {
      throw e instanceof HttpError && e.status === 404 ? new HttpError(409, "That season was deleted") : e;
    });
    if (u.field === "name") {
      if (s.own_name !== ((u.now as string | null) ?? null)) throw new HttpError(409, "It's been renamed since");
      await db.query("UPDATE show_seasons SET name = $2, updated_at = now() WHERE id = $1", [id, (u.was as string | null) ?? null]);
    } else if (u.field === "status") {
      const now = u.now as { status: Status; held: boolean };
      const was = u.was as { status: Status; heldAt: string | null };
      if (s.status !== now.status || !!s.status_held_at !== now.held) throw new HttpError(409, "Its status has moved on since");
      await db.query("UPDATE show_seasons SET status = $2, status_held_at = $3, updated_at = now() WHERE id = $1", [id, was.status, was.heldAt]);
    } else if (u.field === "resultsBy") {
      const was = u.was as { by: "admin" | "leagues"; since: string | null };
      if (s.results_by !== (u.now as { by: string }).by) throw new HttpError(409, "Who decides has changed since");
      await db.query("UPDATE show_seasons SET results_by = $2, results_admin_since = $3, updated_at = now() WHERE id = $1", [id, was.by, was.since]);
      // Back to "you decide": what only the desk accepted reaches its games again; back to sources: what only it accepted
      // since leaves them. Either way, its games are synced now.
      sync = (await onlyYoursCount(db, id, was.by === "admin" ? (was.since ? new Date(was.since) : null) : s.results_admin_since)) > 0;
    } else throw new HttpError(409, "That one can't be undone here");
  });
  if (u.field === "status") nudgeBotClock();
  if (sync) await syncSeasonLeagues(id, user.id);
}

// ---------- the Delete ----------

/**
 * Delete a season (tier 3): refused while games play it (ended ones too; a deleted game doesn't hold it), else it goes
 * with everything kept for it: its episodes, cast, results, rulebook and follows (the cascades), and what's kept by its
 * show and number (research, its search index, the old wiki reads), as classic's delete did. A line on its show's History.
 */
export async function deleteSeason(user: SessionUser, id: string): Promise<{ text: string; showId: string }> {
  return tx(async (db) => {
    const s = await setupRow(id, db, true);
    const games = await gamesOn(db, s);
    if (games.length) throw new HttpError(409, `${plural(games.length, "game")} play ${s.name}: delete or move them first`);
    // Its public pool and practice games are the season's own: they go with it.
    const solo = await soloOn(db, s);
    if (solo.ids.length) await db.query("DELETE FROM leagues WHERE id = ANY($1::uuid[])", [solo.ids]);
    await db.query("DELETE FROM wiki_extractions WHERE show_id = $1 AND season_number = $2", [s.show_id, s.season_number]);
    await db.query("DELETE FROM episode_research WHERE show_id = $1 AND season_number = $2", [s.show_id, s.season_number]);
    await db.query("DELETE FROM episode_text_chunks WHERE show_id = $1 AND season_number = $2", [s.show_id, s.season_number]);
    await db.query("DELETE FROM show_seasons WHERE id = $1", [id]);
    const went = [solo.pool != null ? "its public pool" : null, solo.practice ? plural(solo.practice, "practice game") : null].filter(Boolean);
    await logDesk(db, {
      entity: "show",
      entityId: s.show_id,
      action: "deleteSeason",
      text: `Deleted ${s.name}${went.length ? `, with ${went.join(" and ")}` : ""}`,
      before: { id, seasonNumber: s.season_number, name: s.own_name },
      userId: user.id,
    });
    return { text: `Deleted ${s.name}`, showId: s.show_id };
  });
}
