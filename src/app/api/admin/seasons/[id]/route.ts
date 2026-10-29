import { NextResponse, after } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin, isUuid } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { parseWikiUrl } from "@/lib/server/wiki-url";
import { tellBotClock } from "@/lib/server/ask-bot";
import { RESEARCH_MODELS } from "@db/episode-research.js";
import { normalizeSchedule, planRuns } from "@db/bot-research.js";

type RouteParams = { id: string };

// Seasons are edited and deleted by their own id rather than nested under the show, since that's all
// the UI has to hand once a show's seasons are listed.
//
// `seasonNumber` is editable here, unlike a show's slug: a league references (show slug, season
// number), so renumbering CAN strand a league's settings.wikiSeason -- but a wrong season number is
// also the single most likely data-entry mistake, and leaving it uncorrectable would be worse. The
// response reports how many leagues point at the old number so the admin knows if they need to
// follow up.
export const PATCH = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { id } = await params;
  await requireSuperAdmin(req);
  if (!isUuid(id)) throw new HttpError(404, "Season not found");

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { rows: existing } = await pool.query(
    `SELECT ss.id, ss.season_number, ss.show_id, s.slug
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id
      WHERE ss.id=$1`,
    [id]
  );
  if (!existing.length) throw new HttpError(404, "Season not found");

  const sets: string[] = [];
  const values: unknown[] = [id];
  const push = (column: string, value: unknown) => {
    values.push(value);
    sets.push(`${column}=$${values.length}`);
  };

  if ("seasonNumber" in body) {
    const n = Number(body.seasonNumber);
    if (!Number.isInteger(n) || n < 1) throw new HttpError(400, "seasonNumber must be a positive whole number");
    push("season_number", n);
  }
  if ("name" in body) push("name", String(body.name || "").trim() || null);
  if ("status" in body) {
    const status = String(body.status);
    if (!["upcoming", "airing", "completed"].includes(status)) throw new HttpError(400, "status must be upcoming, airing or completed");
    push("status", status);
    // A status set by hand holds over a TV listing's dates, as the desk's Setup does (0422): the listings job leaves it.
    sets.push("status_held_at = CASE WHEN listing_id IS NOT NULL THEN COALESCE(status_held_at, now()) END");
  }
  if ("castSize" in body) {
    const n = Number(body.castSize);
    push("cast_size", Number.isInteger(n) && n > 0 ? n : null);
  }
  let episodeCount: number | null | undefined;
  if ("episodeCount" in body) {
    const raw = body.episodeCount;
    episodeCount = raw === null || raw === "" ? null : Number(raw);
    if (episodeCount !== null && !(Number.isInteger(episodeCount) && episodeCount > 0 && episodeCount <= 200)) {
      throw new HttpError(400, "episodeCount must be a positive whole number");
    }
    push("episode_count", episodeCount);
  }
  if ("premiereDate" in body) push("premiere_date", body.premiereDate || null);
  if ("finaleDate" in body) push("finale_date", body.finaleDate || null);
  // Air schedule + auto-research (0020).
  const hhmm = (v: unknown, field: string) => {
    const s = String(v ?? "").trim();
    if (!s) return null;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) throw new HttpError(400, `${field} must be a time like 20:00`);
    return s;
  };
  if ("airTime" in body) push("air_time", hhmm(body.airTime, "airTime"));
  if ("airTz" in body) {
    const tz = String(body.airTz || "").trim() || "America/New_York";
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
    } catch {
      throw new HttpError(400, `"${tz}" isn't a time zone`);
    }
    push("air_tz", tz);
  }
  if ("researchWeekday" in body) {
    const n = body.researchWeekday === null || body.researchWeekday === "" ? null : Number(body.researchWeekday);
    if (n !== null && !(Number.isInteger(n) && n >= 0 && n <= 6)) throw new HttpError(400, "researchWeekday must be 0 (Sunday) to 6");
    push("research_weekday", n);
  }
  if ("researchTime" in body) push("research_time", hhmm(body.researchTime, "researchTime"));
  if ("researchDelayHours" in body) {
    const n = body.researchDelayHours === null || body.researchDelayHours === "" ? null : Number(body.researchDelayHours);
    if (n !== null && !(Number.isInteger(n) && n >= 0 && n <= 336)) throw new HttpError(400, "researchDelayHours must be 0 to 336");
    push("research_delay_hours", n);
  }
  if ("researchModel" in body) {
    const m = String(body.researchModel || "");
    if (m && !RESEARCH_MODELS.includes(m)) throw new HttpError(400, "Unknown research model");
    push("research_model", m || null);
  }
  if ("autoResearch" in body) {
    const on = body.autoResearch === true;
    push("auto_research", on);
    // Switching on starts the clock: only slots from now on are picked up (see 0020).
    if (on) sets.push("auto_research_since = COALESCE(CASE WHEN auto_research THEN auto_research_since END, now())");
    else sets.push("auto_research_since = NULL");
  }
  // Bot research (0065, experimental): the free ChatGPT schedule. Switching on starts its clock, like
  // auto-research's; the schedule is kept while it's off, so switching back on picks up where it was.
  if ("botResearchSchedule" in body) {
    let schedule;
    try {
      schedule = normalizeSchedule(body.botResearchSchedule);
    } catch (e) {
      throw new HttpError(400, e instanceof Error ? e.message : "Bad schedule");
    }
    push("bot_research_schedule", JSON.stringify(schedule));
  }
  if ("botResearchOn" in body) {
    const on = body.botResearchOn === true;
    push("bot_research_on", on);
    if (on) sets.push("bot_research_since = COALESCE(CASE WHEN bot_research_on THEN bot_research_since END, now())");
    else sets.push("bot_research_since = NULL");
  }
  // How long an episode runs (0066): bot research counts its schedule from the end. Blank = an hour.
  if ("episodeMinutes" in body) {
    const raw = body.episodeMinutes;
    const n = raw === null || raw === "" ? null : Number(raw);
    if (n !== null && (!Number.isInteger(n) || n < 1 || n > 600)) throw new HttpError(400, "An episode's length is 1 to 600 minutes");
    push("episode_minutes", n);
  }
  if ("wikiUrl" in body) {
    const wikiUrl = String(body.wikiUrl || "").trim() || null;
    if (wikiUrl) {
      const parsed = parseWikiUrl(wikiUrl);
      if (!parsed) throw new HttpError(400, "That doesn't look like a wiki page URL (expected something like https://survivor.fandom.com/wiki/Survivor_44)");
      push("wiki_url", wikiUrl);
      push("wiki_page_title", parsed.pageTitle);
    } else {
      push("wiki_url", null);
      push("wiki_page_title", null);
    }
  }
  // Allows correcting a derived title directly, for a wiki whose URL scheme and canonical page title
  // genuinely differ.
  if ("wikiPageTitle" in body) push("wiki_page_title", String(body.wikiPageTitle || "").trim() || null);
  // Who decides the season's results (db/migrations/0054). Switching TO admin starts the clock: only
  // decisions settled from now on are pushed, so nothing a commissioner chose not to apply arrives
  // retroactively. Re-saving "admin" on a season that already is keeps its cutoff (the old value is
  // what the CASE reads -- an UPDATE's right-hand side sees the row as it was).
  if ("resultsBy" in body) {
    const by = String(body.resultsBy);
    if (by !== "admin" && by !== "leagues") throw new HttpError(400, "resultsBy must be admin or leagues");
    if (by === "admin") sets.push("results_admin_since = CASE WHEN results_by = 'admin' THEN results_admin_since ELSE now() END");
    push("results_by", by);
  }

  if (!sets.length) throw new HttpError(400, "No editable fields supplied");

  const { rows } = await pool.query(
    `UPDATE show_seasons SET ${sets.join(", ")}, updated_at=now() WHERE id=$1
     RETURNING id, season_number, name, wiki_page_title, wiki_url, status, cast_size, episode_count`,
    values
  );

  // Setting the count clears out what exists past it -- phantom episodes from a misread wiki pull or
  // from counting weeks past the finale. Only the undecided/derived data goes: pending review items,
  // research, its search index, auto-research attempts, and those episodes in the cached wiki read (so
  // a re-pull can't restage them). An accepted or rejected decision is history and stays; it's counted
  // so the admin knows to look.
  let pruned = null;
  if (typeof episodeCount === "number") {
    const { show_id: showId, season_number: seasonNumber } = existing[0];
    const season = "seasonNumber" in body ? Number(body.seasonNumber) : seasonNumber;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const pending = await client.query(
        "DELETE FROM season_decisions WHERE season_id=$1 AND episode_number>$2 AND status='pending'",
        [id, episodeCount]
      );
      const research = await client.query(
        "DELETE FROM episode_research WHERE show_id=$1 AND season_number=$2 AND episode_number>$3",
        [showId, season, episodeCount]
      );
      await client.query(
        "DELETE FROM episode_text_chunks WHERE show_id=$1 AND season_number=$2 AND episode_number>$3",
        [showId, season, episodeCount]
      );
      await client.query("DELETE FROM auto_research_attempts WHERE season_id=$1 AND episode_number>$2", [id, episodeCount]);
      const wiki = await client.query(
        `UPDATE wiki_extractions
            SET payload = jsonb_set(payload, '{episodes}', COALESCE(
              (SELECT jsonb_agg(e) FROM jsonb_array_elements(payload->'episodes') e WHERE (e->>'number')::int <= $3),
              '[]'::jsonb))
          WHERE show_id=$1 AND season_number=$2 AND kind='episodes'
            AND EXISTS (SELECT 1 FROM jsonb_array_elements(payload->'episodes') e WHERE (e->>'number')::int > $3)`,
        [showId, season, episodeCount]
      );
      const decided = await client.query(
        "SELECT count(*)::int AS n FROM season_decisions WHERE season_id=$1 AND episode_number>$2",
        [id, episodeCount]
      );
      await client.query("COMMIT");
      pruned = {
        pendingResults: pending.rowCount ?? 0,
        researchedEpisodes: research.rowCount ?? 0,
        wikiReadTrimmed: (wiki.rowCount ?? 0) > 0,
        decidedResultsKept: decided.rows[0].n,
      };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  // Only worth reporting when the number actually moved.
  let leaguesOnOldNumber = 0;
  if ("seasonNumber" in body && Number(body.seasonNumber) !== existing[0].season_number) {
    const { rows: usage } = await pool.query(
      `SELECT count(*)::int AS n FROM leagues
        WHERE state->'settings'->>'showId' = $1
          AND (state->'settings'->>'wikiSeason')::int = $2`,
      [existing[0].slug, existing[0].season_number]
    );
    leaguesOnOldNumber = usage[0].n;
  }

  // The bot's clock calls only when it's told a run is due (db/bot-research.js), so anything that can bring
  // one earlier tells it now, after the response: otherwise it'd wait for its next check-in.
  if (BOT_CLOCK_FIELDS.some((f) => f in body)) {
    after(async () => {
      try {
        await tellBotClock((await planRuns(pool)).next);
      } catch (e) {
        console.error("[bot-research] couldn't tell the bot's clock:", e);
      }
    });
  }
  return NextResponse.json({ season: rows[0], leaguesOnOldNumber, pruned });
});
const BOT_CLOCK_FIELDS = ["status", "episodeCount", "premiereDate", "finaleDate", "airTime", "airTz", "botResearchSchedule", "botResearchOn", "episodeMinutes", "seasonNumber"];

export const DELETE = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { id } = await params;
  await requireSuperAdmin(req);
  if (!isUuid(id)) throw new HttpError(404, "Season not found");

  const { rows } = await pool.query(
    `SELECT ss.season_number, ss.show_id, s.slug FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id=$1`,
    [id]
  );
  if (!rows.length) throw new HttpError(404, "Season not found");
  const { season_number: season, show_id: showId, slug } = rows[0];

  // A league pointing at this season keeps its own state (cast, episodes, scores) -- that's league
  // data, not catalog data -- so this warns rather than refuses, unlike deleting a show.
  const { rows: usage } = await pool.query(
    `SELECT count(*)::int AS n FROM leagues
      WHERE state->'settings'->>'showId' = $1 AND state->'settings'->>'wikiSeason' = $2`,
    [slug, String(season)]
  );

  // Deleting a season means starting it over, so everything the connectors derived FOR it goes too.
  // Those tables are keyed by (show, season number) rather than by this row's id, so the season_cast
  // cascade alone would leave them behind -- and a re-added season would then silently inherit a
  // stale cached extraction, old research, and pending review items for results nobody asked for
  // again. Season decisions go with the season row (season_decisions cascades from show_seasons);
  // results already applied to leagues stay in those leagues.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM wiki_extractions WHERE show_id=$1 AND season_number=$2", [showId, season]);
    await client.query("DELETE FROM episode_research WHERE show_id=$1 AND season_number=$2", [showId, season]);
    await client.query("DELETE FROM episode_text_chunks WHERE show_id=$1 AND season_number=$2", [showId, season]);
    await client.query("DELETE FROM show_seasons WHERE id=$1", [id]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  return NextResponse.json({ ok: true, leaguesAffected: usage[0].n });
});
