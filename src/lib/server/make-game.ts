import { after } from "next/server";
import type { PoolClient } from "pg";
import { buildCastPrompt, parseCastImport } from "@/lib/game/formats/cast-prompt.js";
import { formatForRulebook, type FormatData } from "@/lib/game/formats/index.js";
import { LIBRARY } from "@/lib/game/formats/library/index.js";
import { compileRulebook } from "@/lib/game/formats/rulebook-compile.js";
import { howItWorks, type HowItWorks } from "@/lib/game/formats/rulebook-describe.js";
import { buildRulebookPrompt, parseRulebookAnswer, reviewRulebook } from "@/lib/game/formats/rulebook-research.js";
import { KINDS, cap, type RulebookBlocks, type RulebookKind } from "@/lib/game/formats/rulebook-schema.js";
import {
  castFromListing,
  foundLines,
  kindName,
  needsCast,
  salvage,
  scrubNames,
  startOf,
  templateBlocks,
  templateFor,
  withKind,
  type MadeCastRow,
  type SeriesStart,
  type TemplateRef,
} from "@/lib/game/make-game";
import { blocksAt } from "@/lib/game/formats/rulebook-patch.js";
import { createRulebook, ensureLibraryEntry, ensureTemplate, getRulebook, inForceEdits, sourceFor } from "@db/rulebooks.js";
import { askBot, askBotStatus } from "./ask-bot";
import { isSuperAdminUser, isUuid, type SessionUser } from "./auth-helpers";
import { pool, HttpError } from "./db";
import { logDesk } from "./desk";
import { seenThrough } from "./guard";
import { ListingsUnavailable, showCast } from "./listings";
import { seasonHeaders, type SeasonHeader } from "./show-space";
import { libraryTemplates, otherSeasonRulebook } from "./templates";

// Make it a game (docs/PLAN-new-design.md step 10 part 2a; the mock's rulebook.js makeGame; GET/POST
// /api/seasons/[id]/make). A show someone added to follow ("Not a game yet", shows.set_up_at NULL) becomes a game for
// every couch from two answers: how it works (rulebook-research.js's prompt, starting from the nearest rulebook we have)
// and who's in it (cast-prompt.js's, or TVmaze's cast for a series or a talk show). Anyone signed in can do it, free:
//
//   Ask ChatGPT for me: our bot (ask-bot.ts) asks after the request has answered (`after`, within the route's 300 s), the
//     how-it-works question first, then the cast; the page polls a version. Two asks that don't both fit in one request's
//     time pause between them, and the page that's open carries on (POST continue). A second tap joins the ask in flight.
//   Copy and paste it yourself: the same two questions, through Ask an AI's sheet (a /b/<code> brief), pasted back.
//
// The answers are kept as they came (db/migrations/0122 show_setups), one attempt per season shared by everyone who opens
// it; the review is worked out from them each time it's read: ChatGPT's kind (else the listing's guess), unless someone
// chose another with Change; what doesn't fit left out and listed (make-game.ts salvage); no names in the rulebook
// (scrubNames). Looks right sets the show up for everyone, in one transaction: the season's rulebook from the blocks (its
// maker its creator, new until another couch checks it; its parent the template it started from), the season playing by
// its rulebook (show_seasons.rulebook_live), the approved season cast, the compiled rules as the show's stored format (so
// every older path reads the same rules), and shows.set_up_at with its kind and words.

type Stage = "rules" | "cast" | "ready" | "failed" | "done";

interface SetupRow {
  id: string;
  season_id: string;
  started_by: string | null;
  couch_id: string | null;
  via: "bot" | "paste" | "template";
  stage: Stage;
  asking_at: Date | null;
  message: string | null;
  rules_answer: string | null;
  cast_answer: string | null;
  cast_from: "chat" | "listing" | null;
  kind: RulebookKind | null;
  start: SeriesStart | null;
  seconds: number | null;
  rulebook_id: string | null;
  done_by: string | null;
  done_at: Date | null;
  updated_at: Date;
  who: string | null;
}

export interface MakeReview {
  /** The kind as the review's one line says it, what ChatGPT (else the listing) said, and whether someone changed it. */
  kind: { key: RulebookKind; start: SeriesStart | null; name: string; tagline: string | null; guess: { key: RulebookKind; start: SeriesStart | null }; changed: boolean };
  /** How the whole season works, from these answers (rulebook-describe.js), spoiler-safe at where you are. */
  how: HowItWorks;
  /** The cast's heading for this kind, how many, what they're called ("crew members"), and each one. */
  cast: { label: string; count: number; unit: string; faces: { name: string; photo: string | null; line: string | null }[] };
  /** The kind needs a cast and there's none yet. */
  needsCast: boolean;
  /** What was left out because it didn't fit (a moment, a twist, a part of an episode). */
  dropped: string[];
  /** What can't be left out, so the answer has to be asked again. */
  problems: string[];
  /** What ChatGPT said didn't fit the choices. */
  leftOut: string[];
  approvable: boolean;
}

export interface MakeState {
  seasonId: string;
  /** "ZT Yacht Life 2". */
  label: string;
  /** Set up as a game already. */
  ready: boolean;
  /** Whoever set it up (once it's done), on your couch; else null. */
  madeBy: string | null;
  /** The season's rulebook, once it's set up (the desk's page for it). */
  rulebookId: string | null;
  setup: {
    id: string;
    via: "bot" | "paste" | "template";
    stage: Stage;
    /** Our bot is asking right now. */
    asking: boolean;
    /** Who started it, when it's someone on your couch (someone elsewhere: null, and `mine` false). */
    by: string | null;
    mine: boolean;
    message: string | null;
    /** What's been found so far, a line each. */
    found: string[];
    /** What a paste still needs: how it works, then (for every kind but talk) who's in it. */
    needs: "rules" | "cast" | null;
  } | null;
  review: MakeReview | null;
  bot: { available: boolean };
  /** Changes when anything here does (what the page polls). */
  v: string;
}

/** New attempts one person can start in a day (each can ask our bot). */
export const MAKES_A_DAY = 5;
/** An ask still marked as running after this was cut off (the route stops at 300 s). */
const ASK_STALE_MS = 6 * 60_000;
/** What one request may spend asking (the route's 300 s, less room to save what came back). */
const BUDGET_MS = 280_000;
/** Don't start the cast's ask with less than this left: pause, and the page carries on. */
const CAST_NEEDS_MS = 90_000;

const ROW = `s.*, COALESCE(u.username, u.name) AS who`;

async function openRow(seasonId: string): Promise<SetupRow | null> {
  const { rows } = await pool.query<SetupRow>(`SELECT ${ROW} FROM show_setups s LEFT JOIN "user" u ON u.id = s.started_by WHERE s.season_id = $1 AND s.done_at IS NULL`, [seasonId]);
  return rows[0] ?? null;
}

async function rowById(id: string): Promise<SetupRow> {
  const { rows } = await pool.query<SetupRow>(`SELECT ${ROW} FROM show_setups s LEFT JOIN "user" u ON u.id = s.started_by WHERE s.id = $1`, [id]);
  if (!rows[0]) throw new HttpError(404, "That's gone: start again");
  return rows[0];
}

interface Show {
  header: SeasonHeader;
  tvmazeId: number | null;
  type: string | null;
}

async function showOf(seasonId: string): Promise<Show> {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const header = (await seasonHeaders([seasonId])).get(seasonId);
  if (!header) throw new HttpError(404, "Season not found");
  const { rows } = await pool.query("SELECT tvmaze_id, listing->>'type' AS type FROM shows WHERE id = $1", [header.show.id]);
  return { header, tvmazeId: rows[0]?.tvmaze_id ?? null, type: rows[0]?.type ?? null };
}

/** "The Traitors (US)" as people say it, with its season: "The Traitors 5". */
const labelOf = (h: SeasonHeader) => `${h.show.name.replace(/\s*\([^)]*\)\s*$/, "").trim() || h.show.name}${h.seasonNumber ? ` ${h.seasonNumber}` : ""}`;
const seasonWords = (h: SeasonHeader) => h.seasonName?.trim() || `season ${h.seasonNumber}`;

// ---- the questions ----

/**
 * The rulebook it starts from: the same show's other season, else the desk's library and ours (make-game.ts templateFor: a
 * template for this show's family, one we have by name, else the nearest of its kind).
 */
async function templateOf(show: Show): Promise<{ ref: TemplateRef; blocks: RulebookBlocks } | null> {
  const other = await otherSeasonRulebook(pool, show.header.show.id, show.header.seasonId);
  if (other) return { ref: { from: "rulebook", id: other.id }, blocks: other.blocks };
  const library = await libraryTemplates();
  const ref = templateFor({ name: show.header.show.name, kind: show.header.show.kind as RulebookKind, type: show.type }, library);
  const blocks = templateBlocks(ref, library);
  return ref && blocks ? { ref, blocks } : null;
}

async function rulesPrompt(show: Show): Promise<string> {
  const h = show.header;
  return buildRulebookPrompt({ show: h.show.name, season: seasonWords(h), airing: h.status === "airing", template: (await templateOf(show))?.blocks ?? null });
}

/** The rules a cast is read against: the answer's terms, groups and roles. */
const castFormatOf = (data: FormatData) => formatForRulebook(data, "research");

// ---- the review ----

interface Worked {
  blocks: RulebookBlocks;
  data: FormatData | null;
  phaseStarts: Record<string, number>;
  cast: MadeCastRow[];
  review: MakeReview;
}

const formatIdOf = (h: SeasonHeader) => `made-${h.show.slug}`.replace(/[^a-z0-9-]/g, "-").slice(0, 60);

/** The cast as answered: TVmaze's rows as kept, or the chat's JSON read against the rules (rows with a problem left out). */
function castOf(row: SetupRow, data: FormatData | null): MadeCastRow[] {
  if (!row.cast_answer) return [];
  if (row.cast_from === "listing") {
    try {
      return JSON.parse(row.cast_answer) as MadeCastRow[];
    } catch {
      return [];
    }
  }
  if (!data) return [];
  try {
    const parsed = parseCastImport(row.cast_answer, castFormatOf(data));
    return parsed.castaways.filter((c) => !c.problems.length).map((c) => ({ name: c.name, photoUrl: c.photoUrl || null, group: c.startingGroup?.trim() || null, note: null }));
  } catch {
    return [];
  }
}

/** The review, worked out from the answers: null until how it works is in. `seen`: where the reader is (guard.ts). */
function workOut(row: SetupRow, show: Show, seen: number): Worked | null {
  if (!row.rules_answer) return null;
  const h = show.header;
  let answer: Record<string, unknown>;
  try {
    answer = parseRulebookAnswer(row.rules_answer);
  } catch {
    return null;
  }
  // The cast's names first (from a first read of the rules), so the rulebook's check for names knows them.
  const firstRead = reviewRulebook(answer);
  let firstData: FormatData | null = null;
  try {
    const first = compileRulebook(salvage(firstRead.blocks as RulebookBlocks).blocks, { id: formatIdOf(h), reader: "research" });
    firstData = first.problems.length ? null : first.data;
  } catch {
    /* read the cast without its terms, then */
  }
  const castNames = castOf(row, firstData).map((c) => c.name);
  const read = reviewRulebook(answer, { castNames });
  const guessKey: RulebookKind = KINDS[read.blocks.kind as RulebookKind] ? (read.blocks.kind as RulebookKind) : ((h.show.kind as RulebookKind) ?? "competition");
  const guessStart: SeriesStart | null = guessKey === "series" ? ((read.blocks.start as SeriesStart) ?? startOf(show.type) ?? "reality") : null;
  const key = row.kind ?? guessKey;
  const start = key === "series" ? (row.start ?? (guessKey === "series" ? guessStart : startOf(show.type)) ?? "reality") : null;
  const { blocks: clean } = scrubNames(read.blocks as RulebookBlocks, read.problems);
  const kinded = withKind({ ...clean, show: typeof clean.show === "string" && clean.show.trim() ? clean.show : h.show.name }, key, start);
  const { blocks, dropped, problems } = salvage(kinded);
  const compiled = problems.length ? null : compileRulebook(blocks, { id: formatIdOf(h), reader: "research", phaseStarts: read.phaseStarts });
  const data = compiled && !compiled.problems.length ? compiled.data : null;
  const cast = castOf(row, data ?? firstData);
  const missingCast = needsCast(key) && cast.length < 2;
  const how = howItWorks(blocks, {
    compiled: data ?? undefined,
    seen,
    episodeCount: h.episodeCount,
    phaseStarts: read.phaseStarts,
    castCount: cast.length || undefined,
    updates: [],
    lineage: null,
  });
  const label = KINDS[key].labels.cast ?? "The cast";
  const review: MakeReview = {
    kind: { key, start, name: kindName(key, start), tagline: typeof blocks.tagline === "string" ? blocks.tagline : null, guess: { key: guessKey, start: guessStart }, changed: key !== guessKey || (key === "series" && start !== guessStart) },
    how,
    cast: {
      label,
      count: cast.length,
      unit: (cast.length === 1 ? blocks.cast?.singular : blocks.cast?.plural)?.trim() || (cast.length === 1 ? "person" : "people"),
      faces: cast.map((c) => ({ name: c.name, photo: c.photoUrl, line: c.group ?? c.note ?? (row.cast_from === "listing" ? "From the TV listing" : null) })),
    },
    needsCast: missingCast,
    dropped,
    problems: [...problems.map((p) => p.message), ...(compiled?.problems ?? [])],
    leftOut: (blocks.leftOut ?? []).filter((x) => typeof x === "string"),
    approvable: !problems.length && !!data && !missingCast,
  };
  return { blocks, data, phaseStarts: read.phaseStarts, cast, review };
}

/** A series' or talk show's cast from its TV listing ([] for any other kind, with no listing, or with the listings down). */
async function listingCast(show: Show, kind: RulebookKind, start: SeriesStart | null, base: string): Promise<MadeCastRow[]> {
  if ((kind !== "series" && kind !== "talk") || !show.tvmazeId) return [];
  try {
    return castFromListing(await showCast(show.tvmazeId, base), start);
  } catch (e) {
    if (e instanceof ListingsUnavailable) return [];
    throw e;
  }
}

// ---- reading it ----

async function onCouch(userId: string, couchId: string | null): Promise<string | null> {
  if (!couchId || !isUuid(couchId)) return null;
  const { rows } = await pool.query("SELECT 1 FROM couch_members WHERE couch_id = $1 AND user_id = $2", [couchId, userId]);
  return rows.length ? couchId : null;
}

let health: { key: string; at: number; available: boolean } | null = null;
async function botAvailable(bot?: string): Promise<boolean> {
  // A check's stand-in (next dev only) answers at once: asked every time, so it going down is seen at once.
  if (bot) return (await askBotStatus({ bot })).available;
  const key = "";
  if (health && health.key === key && Date.now() - health.at < 20_000) return health.available;
  const { available } = await askBotStatus({ bot });
  health = { key, at: Date.now(), available };
  return available;
}

const askingNow = (row: SetupRow) => !!row.asking_at && Date.now() - row.asking_at.getTime() < ASK_STALE_MS;
const versionOf = (row: SetupRow | null, ready: boolean) => (row ? `${row.id}:${row.stage}:${askingNow(row) ? 1 : 0}:${row.updated_at.getTime()}` : ready ? "ready" : "none");

/** What a paste still needs. */
function needsOf(row: SetupRow, worked: Worked | null): "rules" | "cast" | null {
  if (!row.rules_answer || !worked) return "rules";
  return worked.review.needsCast ? "cast" : null;
}

/** Make it a game for this season, as you see it: who's at it, how far, and the review once how it works is in. */
export async function makeState(user: SessionUser, seasonId: string, couchId: string | null, bot?: string): Promise<MakeState> {
  const show = await showOf(seasonId);
  const couch = await onCouch(user.id, couchId);
  const ready = show.header.ready;
  const row = ready ? null : await openRow(seasonId);
  let madeBy: string | null = null;
  let rulebookId: string | null = null;
  if (ready) {
    const { rows } = await pool.query(
      `SELECT COALESCE(u.username, u.name) AS who, s.couch_id, s.rulebook_id FROM show_setups s LEFT JOIN "user" u ON u.id = s.done_by WHERE s.season_id = $1 AND s.done_at IS NOT NULL ORDER BY s.done_at DESC LIMIT 1`,
      [seasonId]
    );
    madeBy = rows[0] && (rows[0].couch_id === couch || !rows[0].couch_id) ? rows[0].who : null;
    rulebookId = rows[0]?.rulebook_id ?? null;
  }
  const worked = row ? workOut(row, show, await seenThrough(user.id, seasonId)) : null;
  const mine = !!row && row.started_by === user.id;
  return {
    seasonId,
    label: labelOf(show.header),
    ready,
    madeBy,
    rulebookId,
    setup: row && {
      id: row.id,
      via: row.via,
      stage: row.stage,
      asking: askingNow(row),
      by: mine ? null : row.couch_id && row.couch_id === couch ? row.who : null,
      mine,
      message: row.message,
      found: worked ? foundLines(worked.blocks, worked.cast.length ? worked.cast : null) : [],
      needs: needsOf(row, worked),
    },
    review: worked?.review ?? null,
    bot: { available: ready ? false : await botAvailable(bot) },
    v: versionOf(row, ready),
  };
}

/** What the page polls while our bot asks: the version, and whether it's still asking (one small row). */
export async function makePoll(seasonId: string): Promise<{ v: string; asking: boolean; stage: Stage | null }> {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const { rows } = await pool.query<SetupRow & { ready: boolean }>(
    `SELECT s.id, s.stage, s.asking_at, s.updated_at, sh.set_up_at IS NOT NULL AS ready
       FROM show_seasons ss JOIN shows sh ON sh.id = ss.show_id LEFT JOIN show_setups s ON s.season_id = ss.id AND s.done_at IS NULL
      WHERE ss.id = $1`,
    [seasonId]
  );
  if (!rows.length) throw new HttpError(404, "Season not found");
  const r = rows[0];
  const row = r.id ? r : null;
  return { v: versionOf(row, r.ready), asking: !!row && askingNow(row), stage: row?.stage ?? null };
}

/** A question to copy into your own chat: how it works, or (once that's in) who's in it. */
export async function makePrompt(user: SessionUser, seasonId: string, part: string | null): Promise<{ prompt: string; task: string }> {
  const show = await showOf(seasonId);
  if (show.header.ready) throw new HttpError(409, "It's a game already");
  const h = show.header;
  if (part === "rules") return { prompt: await rulesPrompt(show), task: `finding out how ${h.show.name} works` };
  if (part !== "cast") throw new HttpError(400, "part is rules or cast");
  const row = await openRow(seasonId);
  const worked = row ? workOut(row, show, await seenThrough(user.id, seasonId)) : null;
  if (!worked?.data) throw new HttpError(409, `First, how ${h.show.name} works`);
  return { prompt: buildCastPrompt(castFormatOf(worked.data), { seasonName: cap(seasonWords(h)), showName: h.show.name }), task: `finding who's in ${labelOf(h)}` };
}

// ---- asking, pasting, choosing ----

/** The season's open attempt, made if there's none (capped per person a day, except for the desk), for `via`. */
async function attempt(user: SessionUser, seasonId: string, couchId: string | null, via: "bot" | "paste" | "template"): Promise<SetupRow> {
  const found = await openRow(seasonId);
  if (found) return found;
  const { rows: today } = await pool.query("SELECT count(*)::int AS n FROM show_setups WHERE started_by = $1 AND created_at > now() - interval '1 day'", [user.id]);
  if (today[0].n >= MAKES_A_DAY && !isSuperAdminUser(user)) throw new HttpError(429, `You've made ${MAKES_A_DAY} shows into games today. Try again tomorrow.`);
  const couch = await onCouch(user.id, couchId);
  const { rows } = await pool.query("INSERT INTO show_setups (season_id, started_by, couch_id, via) VALUES ($1, $2, $3, $4) ON CONFLICT (season_id) WHERE done_at IS NULL DO NOTHING RETURNING id", [
    seasonId,
    user.id,
    couch,
    via,
  ]);
  return rowById(rows[0]?.id ?? (await openRow(seasonId))!.id);
}

async function notReady(seasonId: string): Promise<Show> {
  const show = await showOf(seasonId);
  if (show.header.ready) throw new HttpError(409, "It's a game already");
  return show;
}

/**
 * Ask ChatGPT for me: our bot asks what's still missing (how it works, then who's in it), after this answers. `again`:
 * ask how it works over (an answer that couldn't be used). An ask already going is joined.
 */
export async function askMake(user: SessionUser, seasonId: string, couchId: string | null, body: { again?: unknown }, base: string, bot?: string): Promise<MakeState> {
  await notReady(seasonId);
  if (!(await botAvailable(bot))) throw new HttpError(503, "Our bot isn't answering right now. Copy and paste works.");
  const row = await attempt(user, seasonId, couchId, "bot");
  if (askingNow(row)) return makeState(user, seasonId, couchId, bot);
  if (body.again === "rules") await pool.query("UPDATE show_setups SET rules_answer = NULL, kind = NULL, start = NULL, cast_answer = CASE WHEN cast_from = 'chat' THEN NULL ELSE cast_answer END WHERE id = $1", [row.id]);
  if (body.again === "cast") await pool.query("UPDATE show_setups SET cast_answer = NULL, cast_from = NULL WHERE id = $1", [row.id]);
  // Only one ask at a time, whoever tapped.
  const { rowCount } = await pool.query(
    `UPDATE show_setups SET via = 'bot', asking_at = now(), message = NULL, stage = CASE WHEN rules_answer IS NULL THEN 'rules' ELSE 'cast' END, updated_at = now()
      WHERE id = $1 AND (asking_at IS NULL OR asking_at < now() - make_interval(secs => $2))`,
    [row.id, ASK_STALE_MS / 1000]
  );
  if (rowCount) after(() => runAsk(row.id, seasonId, base, bot));
  return makeState(user, seasonId, couchId, bot);
}

/** Our bot's ask, after the response: how it works, then the cast (TVmaze's for a series or talk show), as time allows. */
async function runAsk(id: string, seasonId: string, base: string, bot?: string): Promise<void> {
  const t0 = Date.now();
  const left = () => BUDGET_MS - (Date.now() - t0);
  const set = (fields: string, values: unknown[]) => pool.query(`UPDATE show_setups SET ${fields}, updated_at = now() WHERE id = $1`, [id, ...values]);
  try {
    const show = await showOf(seasonId);
    let row = await rowById(id);
    if (!row.rules_answer) {
      const { answer } = await askBot(await rulesPrompt(show), { bot, budgetMs: left() - 5_000 });
      const parsed = parseRulebookAnswer(answer);
      if (!parsed.cast && !parsed.segments) throw new Error("ChatGPT answered something else. Ask again.");
      await set("rules_answer = $2, stage = 'cast'", [answer]);
      row = await rowById(id);
    }
    const worked = workOut(row, show, Infinity);
    if (!worked) throw new Error("ChatGPT's answer can't be read. Ask again.");
    const { key, start } = worked.review.kind;
    if (!row.cast_answer && (needsCast(key) || key === "talk")) {
      const listed = await listingCast(show, key, start, base);
      if (listed.length) await set("cast_answer = $2, cast_from = 'listing'", [JSON.stringify(listed)]);
      else if (needsCast(key)) {
        if (!worked.data) throw new Error("ChatGPT's answer doesn't fit. Ask again.");
        // Not enough time left in this request for a second ask: the page that's open carries on.
        if (left() < CAST_NEEDS_MS) return void (await set("stage = 'cast', asking_at = NULL, seconds = $2", [Math.round((Date.now() - t0) / 1000)]));
        const prompt = buildCastPrompt(castFormatOf(worked.data), { seasonName: cap(seasonWords(show.header)), showName: show.header.show.name });
        const { answer } = await askBot(prompt, { bot, budgetMs: left() - 5_000 });
        const cast = parseCastImport(answer, castFormatOf(worked.data));
        if (!cast.castaways.some((c) => !c.problems.length)) throw new Error("ChatGPT didn't find who's in it. Ask again, or paste it.");
        await set("cast_answer = $2, cast_from = 'chat'", [answer]);
      }
    }
    await set("stage = 'ready', asking_at = NULL, seconds = $2", [Math.round((Date.now() - t0) / 1000)]);
  } catch (e) {
    const message = e instanceof Error ? e.message : "ChatGPT didn't answer";
    await set("stage = 'failed', asking_at = NULL, message = $2, seconds = $3", [message.slice(0, 300), Math.round((Date.now() - t0) / 1000)]).catch((err) =>
      console.error("[make-game] couldn't record", id, err)
    );
  }
}

/** Copy and paste it yourself: an answer to how it works (`part: "rules"`) or to who's in it (`"cast"`). */
export async function pasteMake(user: SessionUser, seasonId: string, couchId: string | null, body: { part?: unknown; answer?: unknown }, base: string): Promise<MakeState> {
  const show = await notReady(seasonId);
  const answer = typeof body.answer === "string" ? body.answer.trim() : "";
  if (!answer) throw new HttpError(400, "Paste the AI's whole answer");
  if (answer.length > 200_000) throw new HttpError(400, "That's too long to be the answer");
  let row = await attempt(user, seasonId, couchId, "paste");
  if (askingNow(row)) throw new HttpError(409, "Our bot is asking right now. It'll be ready in a minute or two.");
  if (body.part === "rules") {
    let parsed: Record<string, unknown>;
    try {
      parsed = parseRulebookAnswer(answer);
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
    if (!parsed.cast && !parsed.segments) throw new HttpError(400, "That's an answer to something else. Paste the answer to how the show works.");
    await pool.query("UPDATE show_setups SET via = 'paste', rules_answer = $2, kind = NULL, start = NULL, message = NULL, stage = 'cast', updated_at = now() WHERE id = $1", [row.id, answer]);
  } else if (body.part === "cast") {
    const worked = workOut(row, show, Infinity);
    if (!worked?.data) throw new HttpError(409, "First, how the show works");
    const cast = parseCastImport(answer, castFormatOf(worked.data));
    const ok = cast.castaways.filter((c) => !c.problems.length);
    if (!ok.length) throw new HttpError(400, cast.castaways.length ? `None of them could be read: ${cast.castaways[0].problems[0]}` : "There's nobody in that answer. Paste the answer to who's in it.");
    await pool.query("UPDATE show_setups SET via = 'paste', cast_answer = $2, cast_from = 'chat', message = NULL, updated_at = now() WHERE id = $1", [row.id, answer]);
  } else throw new HttpError(400, "part is rules or cast");
  row = await rowById(row.id);
  await settleStage(row, show, base);
  return makeState(user, seasonId, couchId);
}

/**
 * Start from a template (the desk's New show flow, step 10 part 3): a rulebook from the library (or the same show's other
 * season) is the answer to how the show works, named for this show, its tagline left behind; the cast is then asked for,
 * pasted or read from the listing as for any answer, and Looks right sets it up with the template as its parent. The desk's.
 */
export async function templateMake(user: SessionUser, seasonId: string, couchId: string | null, body: { template?: unknown }, base: string): Promise<MakeState> {
  if (!isSuperAdminUser(user)) throw new HttpError(403, "Starting from a template is the desk's");
  const show = await notReady(seasonId);
  const id = String(body.template ?? "");
  if (!isUuid(id)) throw new HttpError(400, "Which template?");
  const t = await getRulebook(pool, id);
  if (!t || t.status === "archived" || !t.blocks) throw new HttpError(404, "That template's gone");
  if (t.ownerKind === "league") throw new HttpError(400, "A couch's own copy isn't a starting point");
  const blocks = { ...(blocksAt(t.blocks, await inForceEdits(pool, id), Infinity) as RulebookBlocks), show: show.header.show.name, derivedFrom: `rulebook:${id}` };
  delete blocks.tagline;
  let row = await attempt(user, seasonId, couchId, "template");
  if (askingNow(row)) throw new HttpError(409, "Our bot is asking right now. It'll be ready in a minute or two.");
  await pool.query(
    `UPDATE show_setups SET via = 'template', rules_answer = $2, kind = NULL, start = NULL, message = NULL, stage = 'cast',
            cast_answer = CASE WHEN cast_from = 'listing' THEN NULL ELSE cast_answer END, cast_from = CASE WHEN cast_from = 'listing' THEN NULL ELSE cast_from END, updated_at = now()
      WHERE id = $1`,
    [row.id, JSON.stringify(blocks)]
  );
  row = await rowById(row.id);
  await settleStage(row, show, base);
  return makeState(user, seasonId, couchId);
}

/** After an answer or a kind: the cast from the listing when it can come from there, then ready or still needing the cast. */
async function settleStage(row: SetupRow, show: Show, base: string): Promise<void> {
  const worked = workOut(row, show, Infinity);
  if (!worked) return;
  const { key, start } = worked.review.kind;
  if (!row.cast_answer && (needsCast(key) || key === "talk")) {
    const listed = await listingCast(show, key, start, base);
    if (listed.length) {
      await pool.query("UPDATE show_setups SET cast_answer = $2, cast_from = 'listing' WHERE id = $1", [row.id, JSON.stringify(listed)]);
      row = await rowById(row.id);
    }
  }
  const after_ = workOut(row, show, Infinity);
  await pool.query("UPDATE show_setups SET stage = $2, updated_at = now() WHERE id = $1", [row.id, after_?.review.needsCast ? "cast" : "ready"]);
}

/** Change on the review: another kind of show (a series picks reality or scripted). Nothing ChatGPT found is lost. */
export async function kindMake(user: SessionUser, seasonId: string, couchId: string | null, body: { kind?: unknown; start?: unknown }, base: string): Promise<MakeState> {
  const show = await notReady(seasonId);
  if (typeof body.kind !== "string" || !KINDS[body.kind as RulebookKind]) throw new HttpError(400, "kind is competition, series, talk or sport");
  const kind = body.kind as RulebookKind;
  const start = kind === "series" ? (body.start === "scripted" ? "scripted" : "reality") : null;
  const row = await openRow(seasonId);
  if (!row?.rules_answer) throw new HttpError(409, "First, how the show works");
  // A cast from the listing was read for the old kind (a scripted series' characters): read again for this one.
  await pool.query(
    "UPDATE show_setups SET kind = $2, start = $3, cast_answer = CASE WHEN cast_from = 'listing' THEN NULL ELSE cast_answer END, cast_from = CASE WHEN cast_from = 'listing' THEN NULL ELSE cast_from END, updated_at = now() WHERE id = $1",
    [row.id, kind, start]
  );
  if (!askingNow(row)) await settleStage(await rowById(row.id), show, base);
  return makeState(user, seasonId, couchId);
}

/** Start over: forget how it works (and the kind), the cast, or the whole attempt. */
export async function restartMake(user: SessionUser, seasonId: string, couchId: string | null, body: { part?: unknown }): Promise<MakeState> {
  await notReady(seasonId);
  const row = await openRow(seasonId);
  if (row && askingNow(row)) throw new HttpError(409, "Our bot is asking right now. It'll be ready in a minute or two.");
  if (row) {
    if (body.part === "cast") await pool.query("UPDATE show_setups SET cast_answer = NULL, cast_from = NULL, stage = 'cast', message = NULL, updated_at = now() WHERE id = $1", [row.id]);
    else await pool.query("DELETE FROM show_setups WHERE id = $1 AND done_at IS NULL", [row.id]);
  }
  return makeState(user, seasonId, couchId);
}

// ---- Looks right: the show set up for everyone ----

/** The rulebook it started from, as a row (the made rulebook's parent): a built-in's template, a library file's entry, or a
 *  rulebook row (the desk's library, the same show's other season, or the template it was started from). */
async function templateRow(c: PoolClient, ref: TemplateRef | null): Promise<{ id: string; version: number } | null> {
  if (!ref) return null;
  if (ref.from === "builtin") return (await ensureTemplate(c, await sourceFor(c, ref.id))).row;
  if (ref.from === "rulebook") {
    const { rows } = await c.query("SELECT id, version FROM rulebooks WHERE id = $1", [ref.id]);
    return rows[0] ?? null;
  }
  const entry = LIBRARY[ref.id];
  return entry ? (await ensureLibraryEntry(c, entry)).row : null;
}

/** The template a rulebook answer was started from (Start from a template writes "rulebook:<id>" into derivedFrom). */
const startedFrom = (blocks: RulebookBlocks): TemplateRef | null => {
  const m = typeof blocks.derivedFrom === "string" ? blocks.derivedFrom.match(/^rulebook:([0-9a-f-]{36})$/) : null;
  return m ? { from: "rulebook", id: m[1] } : null;
};

/** Looks right: the season's rulebook and cast, and the show set up for every couch. */
export async function confirmMake(user: SessionUser, seasonId: string, couchId: string | null): Promise<MakeState> {
  const show = await notReady(seasonId);
  const h = show.header;
  const row = await openRow(seasonId);
  if (!row) throw new HttpError(409, "Nothing to set up yet");
  if (askingNow(row)) throw new HttpError(409, "Our bot is asking right now. It'll be ready in a minute or two.");
  const worked = workOut(row, show, Infinity);
  if (!worked || !worked.review.approvable || !worked.data) throw new HttpError(409, worked?.review.needsCast ? "Who's in it is still missing" : "That answer can't be used. Ask again.");
  const { blocks, data, phaseStarts, cast } = worked;
  const { key } = worked.review.kind;
  const formatId = data.id;
  const template = row.via === "template" ? startedFrom(blocks) : ((await templateOf(show))?.ref ?? null);
  // The desk's own (a site admin made it): it's checked as it's made. Anyone else's is new until another couch checks it.
  const desk = isSuperAdminUser(user);
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const { rows: lock } = await c.query("SELECT set_up_at FROM shows WHERE id = $1 FOR UPDATE", [h.show.id]);
    if (lock[0]?.set_up_at) throw new HttpError(409, "Someone made it a game a moment ago");
    const parent = await templateRow(c, template);
    // Anything the season had (a mirror of the show's default format, made before it was a game) steps aside.
    await c.query("UPDATE rulebooks SET status = 'archived', updated_at = now() WHERE owner_kind = 'season' AND season_id = $1 AND status <> 'archived'", [seasonId]);
    const book = await createRulebook(c, {
      name: labelOf(h),
      kind: key,
      ownerKind: "season",
      seasonId,
      isTemplate: false,
      status: "in_force",
      parentKind: parent ? "rulebook" : "none",
      parentId: parent?.id ?? null,
      parentVersion: parent?.version ?? null,
      reader: "research",
      blocks,
      compiled: data,
      compiledSource: "blocks",
      base: null,
      aliases: { events: {}, exits: {} },
      phaseStarts,
      provenance: { from: "made", via: row.via, by: user.id, couch: row.couch_id, setup: row.id, template, dropped: worked.review.dropped, leftOut: worked.review.leftOut },
      reviewStatus: desk ? "reviewed" : "unreviewed",
      createdBy: user.id,
      ...(desk ? { approvedBy: user.id, approvedAt: new Date().toISOString() } : {}),
    });
    // The cast: the season's, approved, finished (only the desk changes it from here).
    for (const [i, p] of cast.entries()) {
      await c.query(
        "INSERT INTO season_cast (season_id, name, tribe_name, photo_url, sort_order) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (season_id, lower(name)) DO NOTHING",
        [seasonId, p.name.slice(0, 120), p.group, p.photoUrl, i]
      );
    }
    if (cast.length) {
      await c.query("INSERT INTO season_cast_changes (season_id, field, after, changed_by) VALUES ($1, 'created', $2, $3)", [seasonId, String(cast.length), user.id]);
    }
    await c.query(
      `UPDATE show_seasons SET rulebook_id = $2, rulebook_live = true, cast_size = $3, cast_approved_at = CASE WHEN $3 > 0 THEN now() END,
              cast_approved_by = CASE WHEN $3 > 0 THEN $4 END, cast_locked_at = CASE WHEN $3 > 0 THEN now() END, cast_tribes_confirmed = true,
              tribes_from_episode = NULL, updated_at = now()
        WHERE id = $1`,
      [seasonId, book.id, cast.length, user.id]
    );
    // The compiled rules as the show's stored format too, so whatever still reads a show's format reads these rules.
    await c.query(
      `INSERT INTO show_formats (id, name, status, proposal, data, created_by, approved_by, approved_at) VALUES ($1, $2, 'approved', $3, $4, $5, $5, now())
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, status = 'approved', version = show_formats.version + 1, approved_at = now(), updated_at = now()`,
      [formatId, data.name, JSON.stringify({ madeFrom: "rulebook", rulebookId: book.id }), JSON.stringify(data), user.id]
    );
    await c.query(
      "UPDATE shows SET set_up_at = now(), kind = $2, format = $3, castaway_term = $4, tribe_term = $5, updated_at = now() WHERE id = $1",
      [h.show.id, key, formatId, data.terms.castaway, data.terms.tribe]
    );
    await c.query("UPDATE show_setups SET stage = 'done', done_at = now(), done_by = $2, rulebook_id = $3, updated_at = now() WHERE id = $1", [row.id, user.id, book.id]);
    await logDesk(c, {
      entity: "rulebook",
      entityId: book.id,
      action: "made",
      text: `${labelOf(h)} made a game (${row.via === "bot" ? "Ask ChatGPT for me" : row.via === "template" ? "from a template" : "copy and paste"}): ${kindName(key, worked.review.kind.start).toLowerCase()}, ${cast.length} in the cast`,
      userId: user.id,
    });
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
  return makeState(user, seasonId, couchId);
}
