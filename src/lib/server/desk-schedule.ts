import type { PoolClient } from "pg";
import * as Air from "@/lib/game/air-schedule.js";
import { episodesOf, hitOf, releaseOf, type ListedEpisode, type TvShow } from "@/lib/game/listing";
import { listedSeason } from "./add-show";
import { isUuid, type SessionUser } from "./auth-helpers";
import { pool, tx, HttpError } from "./db";
import { SEASON_NAME, logDesk } from "./desk";
import { nudgeBotClock } from "./desk-bot";
import { dayIn, fmt, mdIn, plural, timeIn, whenAt, ymd, zoneOf } from "./desk-dates";
import { ListingsUnavailable, searchListings, seasonListing, showListing } from "./listings";

// A season's schedule on the desk's Setup (docs/PLAN-desk-parity.md step 3, part 3b; the mock's desk-setup.js): When it
// airs (Weekly, Nightly or All at once, the first episode or the drop, the time and zone) and Episodes (the count, or not
// known yet), each tier 2, previewed before it's saved (what moves; what's cleared), and its TV listing, searched (TVmaze,
// as Add a show searches it), linked and unlinked. Each change is a line in the season's History with Undo.
//
// Times set by hand win over the listing's (0423, Noticed b): When it airs sets times_held_at, so the listing's
// per-episode rows stop counting in season_air_dates (research's exact starts still do) and a read of the listing leaves
// the times; a count set here holds the same way (count_held_at). "Use this listing" clears both, and the status's hold
// (0422): its times and dates replace the ones set by hand. Unlinking keeps the times as they are.

type Db = Pick<PoolClient, "query">;
type How = "weekly" | "nightly" | "binge";
const NY = "America/New_York";
const MAX_EPISODES = 100;
const MAX_COUNT = 200;

interface Fields {
  release: How;
  premiere: string | null;
  airTime: string | null;
  airTz: string;
  dropAt: string | null;
}

interface Row {
  id: string;
  name: string;
  show_id: string;
  show_name: string;
  show_tvmaze: number | null;
  season_number: number;
  status: string;
  status_held_at: Date | null;
  release: How;
  premiere: string | null;
  finale: string | null;
  air_time: string | null;
  air_tz: string | null;
  drop_at: Date | null;
  episode_count: number | null;
  times_held_at: Date | null;
  count_held_at: Date | null;
  listing_id: number | null;
  bot_research_on: boolean;
}

async function row(db: Db, id: string, lock = false): Promise<Row> {
  if (!isUuid(id)) throw new HttpError(404, "Season not found");
  const { rows } = await db.query(
    `SELECT ss.id, ${SEASON_NAME} AS name, ss.show_id, s.name AS show_name, s.tvmaze_id AS show_tvmaze, ss.season_number, ss.status, ss.status_held_at,
            ss.release, to_char(ss.premiere_date, 'YYYY-MM-DD') AS premiere, to_char(ss.finale_date, 'YYYY-MM-DD') AS finale,
            to_char(ss.air_time, 'HH24:MI') AS air_time, ss.air_tz, ss.drop_at, ss.episode_count, ss.times_held_at, ss.count_held_at, ss.listing_id,
            ss.bot_research_on
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1${lock ? " FOR UPDATE OF ss" : ""}`,
    [id]
  );
  if (!rows.length) throw new HttpError(404, "Season not found");
  return rows[0];
}

const fieldsOf = (r: Row): Fields => ({ release: r.release, premiere: r.premiere, airTime: r.air_time, airTz: r.air_tz || NY, dropAt: r.drop_at ? r.drop_at.toISOString() : null });

/** The air dates every lock and reminder reads now (the season_air_dates view). */
async function datesNow(db: Db, id: string): Promise<Record<string, string>> {
  const { rows } = await db.query("SELECT air_dates FROM season_air_dates WHERE season_id = $1", [id]);
  return rows[0]?.air_dates ?? {};
}

/** The air dates once its times are set by hand: the view's, without the listing's per-episode rows (0423). */
async function datesByHand(db: Db, id: string): Promise<Record<string, string>> {
  const { rows } = await db.query(
    `SELECT COALESCE((SELECT jsonb_object_agg(e->>'number', e->>'airDate')
                        FROM wiki_extractions we, jsonb_array_elements(we.payload->'episodes') e
                       WHERE we.show_id = ss.show_id AND we.season_number = ss.season_number AND we.kind = 'episodes'
                         AND e->>'airDate' IS NOT NULL), '{}'::jsonb)
            || COALESCE((SELECT jsonb_object_agg(se.number::text, to_char(se.air_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
                           FROM season_episodes se WHERE se.season_id = ss.id AND se.air_at IS NOT NULL AND se.source <> 'listing'), '{}'::jsonb) AS d
       FROM show_seasons ss WHERE ss.id = $1`,
    [id]
  );
  return rows[0]?.d ?? {};
}

/** When episode n starts under these fields and dates (air-schedule.js, the clock lineups lock by). */
const clock =
  (f: Fields, dates: Record<string, string>) =>
  (n: number): Date | null =>
    Air.episodeAirTime({ premiereDate: f.premiere, airTime: f.airTime, airTz: f.airTz, release: f.release, dropAt: f.dropAt }, n, dates);

/** The latest episode in a row from the first that has started. */
function airedN(at: (n: number) => Date | null, max: number | null, now: Date): number {
  let k = 0;
  for (let n = 1; n <= (max ?? MAX_EPISODES); n++) {
    const a = at(n);
    if (!a || a.getTime() > now.getTime()) break;
    k = n;
  }
  return k;
}

const span = (a: number, z: number) => (a === z ? `Episode ${a}` : `Episodes ${a} ${z === a + 1 ? "and" : "to"} ${z}`);
const sameAt = (a: Date | null, b: Date | null) => (a?.getTime() ?? null) === (b?.getTime() ?? null);

/** "Wednesdays 9:00 PM Eastern", "Nightly, 9:00 PM Eastern", "All at once, Fri Nov 6, 3:00 AM Eastern". */
function whenHead(f: Fields): string {
  if (!f.premiere) return "Not set";
  const first = f.release === "binge" && f.dropAt ? new Date(f.dropAt) : Air.zonedToUtc(f.premiere, f.airTime || Air.DEFAULT_AIR_TIME, f.airTz);
  const t = `${timeIn(first, f.airTz)} ${zoneOf(f.airTz)}`;
  if (f.release === "binge") return `All at once, ${fmt(first, f.airTz, { weekday: "short", month: "short", day: "numeric" })}, ${t}`;
  return f.release === "nightly" ? `Nightly, ${t}` : `${fmt(first, f.airTz, { weekday: "long" })}s ${t}`;
}

// ---------- When it airs ----------

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseWhen(raw: unknown): Fields {
  const w = (raw ?? {}) as Record<string, unknown>;
  const how = w.how;
  if (how !== "weekly" && how !== "nightly" && how !== "binge") throw new HttpError(400, "how is weekly, nightly or binge");
  const premiere = typeof w.premiere === "string" ? w.premiere : "";
  if (!DATE.test(premiere) || Number.isNaN(Date.parse(`${premiere}T00:00:00Z`))) throw new HttpError(400, how === "binge" ? "Pick the day they drop" : "Pick the day the first episode airs");
  const time = typeof w.time === "string" ? w.time : "";
  if (!TIME.test(time)) throw new HttpError(400, "A time like 20:00");
  const tz = typeof w.tz === "string" && w.tz ? w.tz : NY;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    throw new HttpError(400, `"${tz}" isn't a time zone`);
  }
  return { release: how, premiere, airTime: time, airTz: tz, dropAt: how === "binge" ? Air.zonedToUtc(premiere, time, tz).toISOString() : null };
}

export interface WhenPlan {
  /** It had no schedule: "What it sets", not "What moves". */
  fresh: boolean;
  /** Nothing would move: nothing to save. */
  same: boolean;
  /** Only aired episodes are dated differently: "Only aired episodes change...". */
  airedOnly: boolean;
  /** "Wednesdays 9:00 PM Eastern: Episode 1 Sep 23, the finale Dec 16." */
  summary: string;
  /** What moves (the first three), or the next episode it sets: each episode's old and new time. */
  rows: { number: number; title: string; from: string | null; to: string }[];
  moved: number;
  more: number;
  /** Aired episodes this puts in the future. */
  warn: { title: string; line: string } | null;
  games: number;
  bot: boolean;
  /** Linked, with its listing's times until now: from now on yours win. */
  listingWins: boolean;
  /** The toast's "Episode 7 airs Wed Nov 4, 9:00 PM". */
  next: string | null;
}

/** Games still playing it (ended and deleted ones aside), whose lineups and picks lock at its times. */
async function gamesPlaying(db: Db, r: Row): Promise<number> {
  const { rows } = await db.query(
    `SELECT count(*)::int AS n FROM leagues l JOIN shows s ON s.id = $3
      WHERE l.deleted_at IS NULL AND COALESCE(l.state->'settings'->>'archivedAt', '') = ''
        AND ((l.state->'settings'->>'showId' = s.slug AND l.state->'settings'->>'wikiSeason' = $2) OR l.solo_season_id = $1)`,
    [r.id, String(r.season_number), r.show_id]
  );
  return rows[0].n;
}

async function planWhen(db: Db, r: Row, want: Fields, now: Date): Promise<WhenPlan> {
  const count = r.episode_count;
  // One after another: inside a save, db is the transaction's one client.
  const nowDates = await datesNow(db, r.id);
  const handDates = await datesByHand(db, r.id);
  const games = await gamesPlaying(db, r);
  const before = clock(fieldsOf(r), nowDates);
  const after = clock(want, handDates);
  const tz = want.airTz;
  const fresh = !Array.from({ length: Math.max(count ?? 0, 20) }, (_, i) => before(i + 1)).some(Boolean);
  const airedBefore = airedN(before, count, now);
  const airedAfter = airedN(after, count, now);
  const N = Math.min(MAX_EPISODES, count ?? Math.max(airedBefore, airedAfter) + 3);
  const aired = (t: Date | null) => !!t && t.getTime() <= now.getTime();
  const moves: number[] = [];
  const back: number[] = [];
  // Aired episodes dated differently and still aired: nothing in the games moves, but the season's dates are corrected.
  let retimed = 0;
  for (let k = 1; k <= N; k++) {
    const a = before(k);
    const c = after(k);
    if (!c) continue;
    if (aired(a) && !aired(c)) back.push(k);
    else if (aired(a) && !sameAt(a, c)) retimed++;
    if (!a || (!aired(a) && !sameAt(a, c))) moves.push(k);
  }
  const same = !fresh && !moves.length && !back.length && !retimed;
  const row = (k: number) => {
    const a = before(k);
    const c = after(k)!;
    const dd = !a || ymd(a, tz) !== ymd(c, tz);
    return { number: k, title: `Episode ${k}${a && !dd ? ` · ${dayIn(c, tz, now)}` : ""}`, from: a ? (dd ? whenAt(a, tz, now) : timeIn(a, tz)) : null, to: dd ? whenAt(c, tz, now) : timeIn(c, tz) };
  };
  const nextN = airedAfter + 1 <= (count ?? MAX_EPISODES) && after(airedAfter + 1) ? airedAfter + 1 : null;
  const finale = count ? after(count) : null;
  const first = after(1);
  const head = whenHead(want);
  const summary =
    want.release === "binge"
      ? `${head}${count ? `: all ${count} episodes` : ""}.`
      : `${head}${first && finale ? `: Episode 1 ${mdIn(first, tz, now)}, the finale ${mdIn(finale, tz, now)}` : first ? `, from ${mdIn(first, tz, now)}` : ""}.`;
  return {
    fresh,
    same,
    airedOnly: !same && !moves.length && !back.length,
    summary,
    rows: fresh ? (nextN ? [row(nextN)] : []) : moves.slice(0, 3).map(row),
    moved: moves.length,
    more: fresh ? 0 : Math.max(0, moves.length - 3),
    warn: back.length
      ? {
          title: `${back.length > 1 ? `Episodes ${back[0]} to ${back[back.length - 1]} have` : `Episode ${back[0]} has`} aired, but this puts ${back.length > 1 ? "them" : "it"} in the future`,
          line: "Check the first episode's date. Results already in stay; nothing new opens until then.",
        }
      : null,
    games,
    bot: r.bot_research_on,
    listingWins: r.listing_id != null && !r.times_held_at,
    next: nextN ? `Episode ${nextN} airs ${whenAt(after(nextN)!, tz, now)}` : null,
  };
}

type Change = { changeId: string; text: string };

/** When it airs: `preview` says what moves; saved, its times win over its listing's (times_held_at). */
export async function setWhen(user: SessionUser, id: string, raw: unknown, preview: boolean, now = new Date()): Promise<WhenPlan | Change> {
  const want = parseWhen(raw);
  if (preview) return planWhen(pool, await row(pool, id), want, now);
  const out = await tx(async (db) => {
    const r = await row(db, id, true);
    const plan = await planWhen(db, r, want, now);
    if (plan.same) throw new HttpError(409, "Nothing moves");
    const was = fieldsOf(r);
    // The finale's date follows (the listings' status rule reads it), when the count is known.
    const fin = r.episode_count ? clock(want, await datesByHand(db, r.id))(r.episode_count) : null;
    const finale = fin ? ymd(fin, want.airTz) : r.finale;
    await db.query(
      `UPDATE show_seasons SET release = $2, premiere_date = $3, air_time = $4, air_tz = $5, drop_at = $6, finale_date = $7, times_held_at = now(), updated_at = now() WHERE id = $1`,
      [id, want.release, want.premiere, want.airTime, want.airTz, want.dropAt, finale]
    );
    const changeId = await logDesk(db, {
      entity: "season",
      entityId: id,
      action: "when",
      text: `${plan.fresh ? "Schedule set" : "Times changed"} by hand: ${whenHead(want)}`,
      before: was,
      after: want,
      undo: { type: "seasonSchedule", id, field: "when", was: { ...was, finale: r.finale, timesHeldAt: r.times_held_at ? r.times_held_at.toISOString() : null }, now: want },
      userId: user.id,
    });
    return { changeId, text: plan.next ? `Saved · ${plan.next}` : "Schedule saved" };
  });
  nudgeBotClock();
  return out;
}

// ---------- Episodes ----------

export interface CountPlan {
  same: boolean;
  aired: number;
  /** "The finale was Wed Oct 14", "Episode 9 is the finale", "Not known: nothing counts as the finale". */
  finale: string;
  /** What's cleared, a line each (classic's prune). */
  cleared: string[];
  /** Aired episodes' research goes: the button turns red, "Clear and save". */
  clears: boolean;
  warn: { title: string; line: string } | null;
  added: string | null;
  unknown: string | null;
}

function parseCount(raw: unknown): number | null {
  if (raw === null) return null;
  if (!Number.isInteger(raw) || (raw as number) < 1 || (raw as number) > MAX_COUNT) throw new HttpError(400, `episodes is 1 to ${MAX_COUNT}, or null (not known yet)`);
  return raw as number;
}

async function planCount(db: Db, r: Row, n: number | null, now: Date): Promise<CountPlan & { at: (n: number) => Date | null }> {
  const at = clock(fieldsOf(r), await datesNow(db, r.id));
  const tz = r.air_tz || NY;
  const was = r.episode_count;
  const aired = airedN(at, MAX_COUNT, now);
  const top = was ?? aired;
  const cleared: string[] = [];
  let clears = false;
  if (n != null && n < top) {
    cleared.push(`${span(n + 1, top)} come${n + 1 === top ? "s" : ""} off the list, the TV guide and every game's schedule.`);
    const goAired = Math.min(top, aired);
    if (goAired > n) {
      clears = true;
      const one = goAired === n + 1;
      cleared.push(`${span(n + 1, goAired)} ${one ? "has" : "have"} aired: research and results still settling on ${one ? "it" : "them"} are cleared. Confirmed results stay, for you to look over.`);
    }
  }
  const fin = n != null ? at(n) : null;
  const from = (was ?? aired) + 1;
  const end = n != null && n >= from ? at(n) : null;
  return {
    at,
    same: n === was,
    aired,
    finale: n == null ? "Not known: nothing counts as the finale" : fin ? `The finale ${fin.getTime() <= now.getTime() ? "was" : "is"} ${dayIn(fin, tz, now)}` : `Episode ${n} is the finale`,
    cleared,
    clears,
    warn: n != null && n < aired ? { title: "Fewer than have aired", line: `${r.name} has aired ${aired}. Check the number: a season usually only grows.` } : null,
    added: n != null && n >= from ? `${span(from, n)} ${from === n ? "is" : "are"} added${end ? `, to ${dayIn(end, tz, now)}` : ""}.` : null,
    unknown: n == null && was != null ? "Until it's set, the list shows what's aired and the next episode, and nothing counts as the finale." : null,
  };
}

/** Episodes: `preview` says what's cleared or added; saved, it holds over its listing's count (count_held_at) and, lowered,
 *  clears what's past it as classic's did: results still settling, research and its search index, auto research's tries,
 *  and those episodes in an old wiki read. Confirmed results stay. */
export async function setCount(user: SessionUser, id: string, raw: unknown, preview: boolean, now = new Date()): Promise<CountPlan | Change> {
  const n = parseCount(raw);
  if (preview) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { at, ...plan } = await planCount(pool, await row(pool, id), n, now);
    return plan;
  }
  const out = await tx(async (db) => {
    const r = await row(db, id, true);
    const plan = await planCount(db, r, n, now);
    if (plan.same) throw new HttpError(409, n == null ? "It's not known already" : `It has ${plural(n, "episode")} already`);
    const tz = r.air_tz || NY;
    const fin = n != null ? plan.at(n) : null;
    // Not known keeps the finale's date: the listings' status rule reads it, and an ended season stays ended.
    const finale = fin ? ymd(fin, tz) : r.finale;
    await db.query("UPDATE show_seasons SET episode_count = $2, finale_date = $3, count_held_at = now(), updated_at = now() WHERE id = $1", [id, n, finale]);
    let gone = "";
    if (n != null) {
      const pending = await db.query("DELETE FROM season_decisions WHERE season_id = $1 AND episode_number > $2 AND status = 'pending'", [id, n]);
      const research = await db.query("DELETE FROM episode_research WHERE show_id = $1 AND season_number = $2 AND episode_number > $3", [r.show_id, r.season_number, n]);
      await db.query("DELETE FROM episode_text_chunks WHERE show_id = $1 AND season_number = $2 AND episode_number > $3", [r.show_id, r.season_number, n]);
      await db.query("DELETE FROM auto_research_attempts WHERE season_id = $1 AND episode_number > $2", [id, n]);
      // The bot's (Noticed aw, part 4a): asks for results, Run nows still queued, and its finished runs past the count (one
      // still asking finishes; trivia's and bingo's rows let go of the run).
      await db.query("DELETE FROM research_asks WHERE season_id = $1 AND episode_number > $2", [id, n]);
      await db.query("DELETE FROM desk_runs WHERE season_id = $1 AND episode_number > $2 AND started_at IS NULL", [id, n]);
      await db.query("DELETE FROM bot_research_runs WHERE season_id = $1 AND episode_number > $2 AND finished_at IS NOT NULL", [id, n]);
      await db.query(
        `UPDATE wiki_extractions SET payload = jsonb_set(payload, '{episodes}', COALESCE((SELECT jsonb_agg(e) FROM jsonb_array_elements(payload->'episodes') e WHERE (e->>'number')::int <= $3), '[]'::jsonb))
          WHERE show_id = $1 AND season_number = $2 AND kind = 'episodes' AND EXISTS (SELECT 1 FROM jsonb_array_elements(payload->'episodes') e WHERE (e->>'number')::int > $3)`,
        [r.show_id, r.season_number, n]
      );
      const parts = [research.rowCount ? `research on ${plural(research.rowCount, "episode")}` : null, pending.rowCount ? plural(pending.rowCount, "result still settling", "results still settling") : null].filter(Boolean);
      if (parts.length) gone = `: cleared ${parts.join(" and ")}`;
    }
    const changeId = await logDesk(db, {
      entity: "season",
      entityId: id,
      action: "count",
      text: n == null ? `Episodes: not known yet (was ${r.episode_count})` : `${plural(n, "episode")} (was ${r.episode_count ?? "not known"})${gone}`,
      before: { count: r.episode_count },
      after: { count: n },
      undo: { type: "seasonSchedule", id, field: "count", was: { count: r.episode_count, finale: r.finale, heldAt: r.count_held_at ? r.count_held_at.toISOString() : null }, now: { count: n } },
      userId: user.id,
    });
    const tail = fin ? ` · the finale ${fin.getTime() <= now.getTime() ? "was" : "is"} ${dayIn(fin, tz, now)}` : "";
    return { changeId, text: n == null ? "Episodes: not known yet" : `${plural(n, "episode")}${tail}` };
  });
  nudgeBotClock();
  return out;
}

// ---------- the TV listing ----------

/** A listing's episodes as Setup says them: how it airs, at what time, from when to when, what's next. */
export interface ListingTimes {
  how: How;
  /** "Tuesdays", "Nightly", "All at once". */
  days: string;
  time: string | null;
  zone: string;
  first: Date | null;
  last: Date | null;
  next: { number: number; at: Date } | null;
}

export function listingTimes(eps: { number: number; airAt: string | null }[], tz: string, now: Date): ListingTimes {
  const dated = eps.filter((e) => e.airAt).map((e) => ({ number: e.number, at: new Date(e.airAt!) }));
  const days = new Set(dated.map((e) => ymd(e.at, tz)));
  let how: How = "weekly";
  if (dated.length >= 3 && days.size === 1) how = "binge";
  else if (dated.length >= 2) {
    const gaps = dated.slice(1).map((e, i) => (e.at.getTime() - dated[i].at.getTime()) / 86_400_000).sort((a, b) => a - b);
    if (gaps[Math.floor(gaps.length / 2)] <= 1.5) how = "nightly";
  }
  const next = dated.find((e) => e.at.getTime() > now.getTime()) ?? null;
  const ref = next?.at ?? dated[dated.length - 1]?.at ?? null;
  return {
    how,
    days: how === "binge" ? "All at once" : how === "nightly" ? "Nightly" : dated[0] ? `${fmt(dated[0].at, tz, { weekday: "long" })}s` : "Weekly",
    time: ref ? timeIn(ref, tz) : null,
    zone: zoneOf(tz),
    first: dated[0]?.at ?? null,
    last: dated[dated.length - 1]?.at ?? null,
    next,
  };
}

export interface ListingHitRow {
  tvmazeId: number;
  /** Its season with this season's number (TVmaze's season id), when it has one. */
  listingId: number | null;
  name: string;
  network: string | null;
  line: string;
  /** Greyed: why it can't be used, as the toast says it. */
  off: string | null;
  /** What it fills, a line each, when it can be used. */
  fills: { icon: "clock" | "hash" | "pulse" | "repeat"; text: string }[];
}

const zoneOfShow = (show: TvShow) => show.network?.country?.timezone ?? show.webChannel?.country?.timezone ?? NY;

/** Find it in the TV listings: TVmaze's search, each show's season with this season's number, what it would fill. */
export async function searchSeasonListings(id: string, q: string, base: string, now = new Date()): Promise<{ hits: ListingHitRow[]; unavailable?: boolean }> {
  const r = await row(pool, id);
  const term = q.trim().replace(/\s+/g, " ");
  if (term.length < 2 || term.length > 80) return { hits: [] };
  try {
    const found = (await searchListings(term, base)).slice(0, 5);
    const hits = await Promise.all(
      found.map(async (h): Promise<ListingHitRow> => {
        const out: ListingHitRow = { tvmazeId: h.tvmazeId, listingId: null, name: h.name, network: h.network, line: "", off: null, fills: [] };
        const listing = await showListing(h.tvmazeId, base);
        const theirs = listing?.seasons.find((t) => t.number === r.season_number) ?? null;
        if (!listing || !theirs) {
          const ended = (listing?.show.status ?? "").toLowerCase() === "ended";
          const year = listing?.show.ended?.slice(0, 4);
          out.line = ended ? `Ended${year ? ` ${year}` : ""} · no season airing now` : `No Season ${r.season_number} listed`;
          out.off = ended ? `${h.name} ended${year ? ` in ${year}` : ""}: it has no Season ${r.season_number}` : `${h.name} has no Season ${r.season_number} in the listings`;
          return out;
        }
        out.listingId = theirs.id;
        const [{ rows: taken }, { rows: other }] = await Promise.all([
          pool.query(`SELECT ${SEASON_NAME} AS name FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.listing_id = $1 AND ss.id <> $2 LIMIT 1`, [theirs.id, r.id]),
          pool.query("SELECT name FROM shows WHERE tvmaze_id = $1 AND id <> $2 LIMIT 1", [h.tvmazeId, r.show_id]),
        ]);
        const tz = zoneOfShow(listing.show);
        if (theirs.id === r.listing_id) out.off = `${r.name} is linked to it already`;
        else if (taken.length) out.off = `${taken[0].name} is linked to it`;
        else if (other.length) out.off = `That's ${other[0].name}'s listing`;
        else if (r.show_tvmaze != null && r.show_tvmaze !== h.tvmazeId) out.off = `${r.show_name} is linked to another show's listing`;
        const at = (d: string | null | undefined) => (d ? new Date(`${d}T12:00:00Z`) : null);
        const span = (a: Date | null, z: Date | null) => (a ? (z ? `${mdIn(a, tz, now)} to ${mdIn(z, tz, now)}` : `from ${mdIn(a, tz, now)}`) : "not dated yet");
        if (out.off) {
          // Greyed: what its season says, without reading its episodes (TVmaze's calls are rationed).
          const n = theirs.episodeOrder && theirs.episodeOrder > 0 ? theirs.episodeOrder : null;
          out.line = `Season ${theirs.number} · ${n ? plural(n, "episode") : "episodes not known"} · ${span(at(theirs.premiereDate), at(theirs.endDate))}`;
          return out;
        }
        const raw = await seasonListing(theirs.id, base);
        const eps = episodesOf(raw);
        const t = listingTimes(eps, tz, now);
        if (releaseOf(raw).release === "binge") Object.assign(t, { how: "binge", days: "All at once" });
        const count = theirs.episodeOrder && theirs.episodeOrder > 0 ? theirs.episodeOrder : eps.length || null;
        const finaleAt = count ? eps.find((e) => e.number === count)?.airAt : null;
        const first = at(theirs.premiereDate) ?? t.first;
        const last = at(theirs.endDate) ?? (finaleAt ? new Date(finaleAt) : null);
        out.line = `Season ${theirs.number} · ${t.how === "nightly" ? "nightly" : t.days}${t.time ? ` ${t.time}` : ""} · ${count ? plural(count, "episode") : "episodes not known"} · ${span(first, last)}`;
        out.fills.push({
          icon: "clock",
          text: `${t.days}${t.time ? ` at ${t.time} ${t.zone}` : ""}${first ? `, from ${mdIn(first, tz, now)}` : ""}${t.next ? `: Episode ${t.next.number} is next, ${whenAt(t.next.at, tz, now)}` : ""}.`,
        });
        if (count) out.fills.push({ icon: "hash", text: `${plural(count, "episode")}${finaleAt ? `: the finale ${dayIn(new Date(finaleAt), tz, now)}` : ""}.` });
        out.fills.push({ icon: "pulse", text: "It moves the status on by its dates, and keeps the times current each morning." });
        if (r.times_held_at || r.count_held_at) out.fills.push({ icon: "repeat", text: "Its times replace the ones set by hand." });
        return out;
      })
    );
    return { hits };
  } catch (e) {
    if (!(e instanceof ListingsUnavailable)) throw e;
    return { hits: [], unavailable: true };
  }
}

interface ListingSnapshot {
  listingId: number | null;
  status: string;
  statusHeldAt: string | null;
  fields: Fields;
  finale: string | null;
  count: number | null;
  timesHeldAt: string | null;
  countHeldAt: string | null;
  rows: { number: number; air_at: string | null; runtime_min: number | null; title: string | null }[];
  /** The show's own listing before this one linked it (null: it had none, and goes back to none). */
  show?: { tvmazeId: number | null; listing: unknown } | null;
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

async function snapshot(db: Db, r: Row): Promise<ListingSnapshot> {
  const { rows } = await db.query(
    `SELECT number, air_at, runtime_min, title FROM season_episodes WHERE season_id = $1 AND source = 'listing' AND reported_in IS NULL AND air_at IS NOT NULL ORDER BY number`,
    [r.id]
  );
  return {
    listingId: r.listing_id,
    status: r.status,
    statusHeldAt: iso(r.status_held_at),
    fields: fieldsOf(r),
    finale: r.finale,
    count: r.episode_count,
    timesHeldAt: iso(r.times_held_at),
    countHeldAt: iso(r.count_held_at),
    rows: rows.map((x) => ({ number: x.number, air_at: x.air_at ? (x.air_at as Date).toISOString() : null, runtime_min: x.runtime_min, title: x.title })),
  };
}

/** A listing's times come off its rows (its recaps, `summary`, stay on them: episode-recaps.ts): a listing read writes them again. */
const clearListingTimes = (db: Db, id: string) =>
  db.query("UPDATE season_episodes SET air_at = NULL, runtime_min = NULL, title = NULL, updated_at = now() WHERE season_id = $1 AND source = 'listing' AND reported_in IS NULL", [id]);

/** Puts a season's listing, times and episodes' listing rows back as a snapshot had them, and its show's listing when this one
 *  linked it and no other season of the show is linked now. */
async function putBack(db: Db, id: string, s: ListingSnapshot) {
  await db.query(
    `UPDATE show_seasons SET listing_id = $2, status = $3, status_held_at = $4, release = $5, premiere_date = $6, air_time = $7, air_tz = $8, drop_at = $9,
            finale_date = $10, episode_count = $11, times_held_at = $12, count_held_at = $13, updated_at = now() WHERE id = $1`,
    [id, s.listingId, s.status, s.statusHeldAt, s.fields.release, s.fields.premiere, s.fields.airTime, s.fields.airTz, s.fields.dropAt, s.finale, s.count, s.timesHeldAt, s.countHeldAt]
  );
  await clearListingTimes(db, id);
  for (const e of s.rows)
    await db.query(
      `INSERT INTO season_episodes (season_id, number, air_at, runtime_min, title, source, updated_at) VALUES ($1, $2, $3, $4, $5, 'listing', now())
       ON CONFLICT (season_id, number) DO UPDATE SET air_at = EXCLUDED.air_at, runtime_min = EXCLUDED.runtime_min, title = EXCLUDED.title, updated_at = now()
       WHERE season_episodes.source = 'listing' AND season_episodes.reported_in IS NULL`,
      [id, e.number, e.air_at, e.runtime_min, e.title]
    );
  if (s.show)
    await db.query(
      `UPDATE shows sh SET tvmaze_id = $2, listing = $3, updated_at = now() FROM show_seasons ss
        WHERE ss.id = $1 AND sh.id = ss.show_id AND NOT EXISTS (SELECT 1 FROM show_seasons o WHERE o.show_id = sh.id AND o.listing_id IS NOT NULL)`,
      [id, s.show.tvmazeId, s.show.listing == null ? null : JSON.stringify(s.show.listing)]
    );
}

/**
 * Use this listing: the season takes its listing's times, dates, count and every episode's start (add-show.ts listedSeason,
 * as the daily job reads it), its status moves on by its dates again, and what was set by hand stops holding. A show with
 * no listing of its own gains this one's. Undo puts the season back as it was.
 */
export async function linkListing(user: SessionUser, id: string, body: { tvmazeId?: unknown; listingId?: unknown }, base: string, now = new Date()): Promise<Change> {
  const tvmazeId = body.tvmazeId;
  const listingId = body.listingId;
  if (!Number.isInteger(tvmazeId) || !Number.isInteger(listingId)) throw new HttpError(400, "Which listing? (tvmazeId and listingId)");
  let found: Awaited<ReturnType<typeof showListing>>;
  let eps: ListedEpisode[];
  try {
    found = await showListing(tvmazeId as number, base);
    const theirs0 = found?.seasons.find((t) => t.id === listingId);
    if (!found || !theirs0) throw new HttpError(404, "That listing has no such season");
    eps = episodesOf(await seasonListing(theirs0.id, base));
  } catch (e) {
    if (e instanceof ListingsUnavailable) throw new HttpError(503, "TV listings aren't answering. Try again in a minute.");
    throw e;
  }
  const theirs = found.seasons.find((t) => t.id === listingId)!;
  const show = found.show;
  const tz = zoneOfShow(show);
  const t = listingTimes(eps, tz, now);
  const { changeId, showId, was } = await tx(async (db) => {
    const r = await row(db, id, true);
    if (theirs.number !== r.season_number) throw new HttpError(409, `That's Season ${theirs.number}`);
    if (r.listing_id === theirs.id) throw new HttpError(409, "It's linked to that listing already");
    const { rows: taken } = await db.query(`SELECT ${SEASON_NAME} AS name FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.listing_id = $1 AND ss.id <> $2`, [theirs.id, id]);
    if (taken.length) throw new HttpError(409, `${taken[0].name} is linked to it`);
    if (r.show_tvmaze == null) {
      const { rows: other } = await db.query("SELECT name FROM shows WHERE tvmaze_id = $1", [tvmazeId]);
      if (other.length) throw new HttpError(409, `That's ${other[0].name}'s listing`);
    } else if (r.show_tvmaze !== tvmazeId) throw new HttpError(409, `${r.show_name} is linked to another show's listing`);
    const was = await snapshot(db, r);
    if (r.show_tvmaze == null) {
      was.show = { tvmazeId: null, listing: (await db.query("SELECT listing FROM shows WHERE id = $1", [r.show_id])).rows[0]?.listing ?? null };
      await db.query("UPDATE shows SET tvmaze_id = $2, listing = $3, updated_at = now() WHERE id = $1 AND tvmaze_id IS NULL", [r.show_id, tvmazeId, JSON.stringify({ ...hitOf(show), fetchedAt: now.toISOString() })]);
    }
    await db.query("UPDATE show_seasons SET listing_id = $2, status_held_at = NULL, times_held_at = NULL, count_held_at = NULL, air_tz = $3, updated_at = now() WHERE id = $1", [id, theirs.id, tz]);
    // The old listing's times come off (research's rows and every recap stay): the new listing writes its own.
    await clearListingTimes(db, id);
    const network = show.network?.name ?? show.webChannel?.name ?? "TVmaze";
    const changeId = await logDesk(db, {
      entity: "season",
      entityId: id,
      action: "listing",
      text: `Linked to its TV listing: ${network}, ${t.days}${t.time ? ` ${t.time}` : ""}`,
      before: { listingId: r.listing_id },
      after: { listingId: theirs.id },
      undo: { type: "seasonSchedule", id, field: "listing", was, now: { listingId: theirs.id } },
      userId: user.id,
    });
    return { changeId, showId: r.show_id, was };
  });
  try {
    await listedSeason(showId, show, theirs, base, now, id);
  } catch (e) {
    // The listing didn't read: the season goes back as it was, and the line with it.
    await tx(async (db) => {
      await putBack(db, id, was);
      await db.query("DELETE FROM admin_changes WHERE id = $1", [changeId]);
    });
    if (e instanceof ListingsUnavailable) throw new HttpError(503, "TV listings aren't answering. Try again in a minute.");
    throw e;
  }
  nudgeBotClock();
  return { changeId, text: t.next ? `Linked · Episode ${t.next.number} airs ${whenAt(t.next.at, tz, now)}` : "Linked to its TV listing" };
}

/** Unlink it: nothing updates on its own any more; its times stay as they are (the listing's rows stay), and so does its
 *  status, no longer held over dates nothing reads. */
export async function unlinkListing(user: SessionUser, id: string): Promise<Change> {
  return tx(async (db) => {
    const r = await row(db, id, true);
    if (r.listing_id == null) throw new HttpError(409, "It isn't linked to a listing");
    await db.query("UPDATE show_seasons SET listing_id = NULL, status_held_at = NULL, updated_at = now() WHERE id = $1", [id]);
    const changeId = await logDesk(db, {
      entity: "season",
      entityId: id,
      action: "unlink",
      text: "Unlinked from its TV listing: its times stay as they are",
      before: { listingId: r.listing_id },
      after: { listingId: null },
      undo: { type: "seasonSchedule", id, field: "unlink", was: { listingId: r.listing_id, statusHeldAt: iso(r.status_held_at) }, now: { listingId: null } },
      userId: user.id,
    });
    return { changeId, text: "Unlinked · its times stay as they are" };
  });
}

// ---------- Undo ----------

/** History's Undo for a schedule line: as it was, refused once it has moved on since. */
export async function restoreSeasonSchedule(_user: SessionUser, u: Record<string, unknown>): Promise<void> {
  const id = String(u.id);
  await tx(async (db) => {
    const r = await row(db, id, true).catch((e) => {
      throw e instanceof HttpError && e.status === 404 ? new HttpError(409, "That season was deleted") : e;
    });
    if (u.field === "when") {
      const now = u.now as Fields;
      const was = u.was as Fields & { finale: string | null; timesHeldAt: string | null };
      const cur = fieldsOf(r);
      if (cur.release !== now.release || cur.premiere !== now.premiere || cur.airTime !== now.airTime || cur.airTz !== now.airTz || cur.dropAt !== now.dropAt || !r.times_held_at)
        throw new HttpError(409, "Its times have changed since");
      await db.query(
        `UPDATE show_seasons SET release = $2, premiere_date = $3, air_time = $4, air_tz = $5, drop_at = $6, finale_date = $7, times_held_at = $8, updated_at = now() WHERE id = $1`,
        [id, was.release, was.premiere, was.airTime, was.airTz, was.dropAt, was.finale, was.timesHeldAt]
      );
    } else if (u.field === "count") {
      const was = u.was as { count: number | null; finale: string | null; heldAt: string | null };
      if (r.episode_count !== (u.now as { count: number | null }).count) throw new HttpError(409, "Its episodes have changed since");
      await db.query("UPDATE show_seasons SET episode_count = $2, finale_date = $3, count_held_at = $4, updated_at = now() WHERE id = $1", [id, was.count, was.finale, was.heldAt]);
    } else if (u.field === "listing") {
      if (r.listing_id !== (u.now as { listingId: number }).listingId) throw new HttpError(409, "Its listing has changed since");
      const was = u.was as ListingSnapshot;
      if (was.listingId != null && (await db.query("SELECT 1 FROM show_seasons WHERE listing_id = $1 AND id <> $2", [was.listingId, id])).rows.length)
        throw new HttpError(409, "Another season is linked to its old listing now");
      await putBack(db, id, was);
    } else if (u.field === "unlink") {
      const was = u.was as { listingId: number; statusHeldAt: string | null };
      if (r.listing_id != null) throw new HttpError(409, "It's linked again since");
      const { rows: taken } = await db.query("SELECT 1 FROM show_seasons WHERE listing_id = $1 AND id <> $2", [was.listingId, id]);
      if (taken.length) throw new HttpError(409, "Another season is linked to that listing now");
      await db.query("UPDATE show_seasons SET listing_id = $2, status_held_at = $3, updated_at = now() WHERE id = $1", [id, was.listingId, was.statusHeldAt]);
    } else throw new HttpError(409, "That one can't be undone here");
  });
  nudgeBotClock();
}
