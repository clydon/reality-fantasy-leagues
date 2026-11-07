import StateLogic from "@/lib/game/state-logic.js";
import { camelId } from "@/lib/game/formats/proposal.js";
import { momentsFor } from "@/lib/game/formats/rulebook-moments.js";
import { blocksAt } from "@/lib/game/formats/rulebook-patch.js";
import { blocksProblems, type RulebookBlocks, type RulebookCustomMoment } from "@/lib/game/formats/rulebook-schema.js";
import * as Added from "@/lib/game/formats/added-moments.js";
import type { Question } from "@/lib/game/game-spec/index.js";
import type { LeagueState } from "@/lib/game/types";
import { ensureSeasonRulebook, inForceEdits, saveChain, seasonRulebook } from "@db/rulebooks.js";
import { isUuid, type SessionUser } from "./auth-helpers";
import { HttpError, pool } from "./db";
import { logDesk } from "./desk";
import { copyOf } from "./ours";
import { seasonSchedules } from "./schedule";
import { startFrom } from "./start-game";

// A season's own added moments (docs/PLAN-start-a-game-gpt.md step G1 part 4; formats/added-moments.js says what one is). A moment
// the show's research didn't answer, typed to the GPT and rated at the bar by the feasibility ask, is offered by our check
// (game-words check.js withMoments: offers.moments). Taking the offer (addMoment) adds it to the season's rulebook as a moment
// research answers, worth 0 there (no game scores it but one that names it), asked from the next episode to air: the full run's
// checklist asks it, then the moments' own short ask what that left unknown (db/moments-research.js, inside the full run). The
// rulebook's moments are the ctx our check reads, so a game on it can be made once it's added: its maker asks again. And for a game
// a question on one settles, what research couldn't settle (unsureMomentsFor: the grader voids it there, answers.js).

/** Our check's offer of a moment, as the ask stored it (check.js withMoments). */
interface Offer {
  label: string;
  question: string;
  reliable: "high" | "medium" | "low";
  why?: string;
}

export interface AddedMomentResult {
  moment: { id: string; label: string; question: string; from: number; reliability: "reliable" | "usually" };
  /** It was already added (the same question): nothing changed. */
  existing: boolean;
  /** The words of the ask it came from, to ask again with the moment on the page. */
  words: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
type Book = NonNullable<Awaited<ReturnType<typeof seasonRulebook>>>;

/**
 * Adds the moment our check offered in one of the person's own asks (`body`: { ask: its id, moment: the offer's index, 0 by
 * default }) to the season's rulebook, asked from the next episode to air. The same question added before is that one (nothing
 * changes). Refused when the season has nothing left to air, MAX_ADDED already, or the ask's couch plays the season by its own copy
 * of the rules (its games read the copy's moments). Read and saved under a lock on the rulebook, so two added at once are both kept.
 */
export async function addMoment(user: SessionUser, seasonId: string, body: { ask?: unknown; moment?: unknown }, now = new Date()): Promise<AddedMomentResult> {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const askId = typeof body.ask === "string" && isUuid(body.ask) ? body.ask : null;
  const index = body.moment === undefined ? 0 : Number(body.moment);
  if (!askId || !Number.isInteger(index) || index < 0) throw new HttpError(400, "Say which ask and which of its moments");
  const { rows } = await pool.query(
    `SELECT a.words, a.result, a.couch_id, s.slug, ss.season_number FROM game_word_asks a JOIN show_seasons ss ON ss.id = a.season_id JOIN shows s ON s.id = ss.show_id
      WHERE a.id = $1 AND a.user_id = $2 AND a.season_id = $3`,
    [askId, user.id, seasonId]
  );
  if (!rows[0]) throw new HttpError(404, "That ask isn't yours");
  const offer = ((rows[0].result as { offers?: { moments?: Offer[] } } | null)?.offers?.moments ?? [])[index];
  if (!offer || typeof offer.question !== "string" || !offer.question.trim()) throw new HttpError(400, "Our check didn't offer a moment there");
  const words = rows[0].words as string;
  // A couch that plays this season by its own copy of the rules (Make it ours) reads its copy's moments, not the season's.
  if (rows[0].couch_id) {
    const { rows: here } = await pool.query("SELECT id FROM leagues WHERE couch_id = $1 AND deleted_at IS NULL AND state->'settings'->>'showId' = $2 AND state->'settings'->>'wikiSeason' = $3", [
      rows[0].couch_id,
      rows[0].slug,
      String(rows[0].season_number),
    ]);
    if (await copyOf(here.map((r) => r.id as string))) throw new HttpError(409, "Your couch plays this season by its own rules, so a moment added to the season wouldn't reach its games");
  }

  // The season's rulebook, made from its show's format if it has none yet (as the desk's pages make it).
  const made = (await ensureSeasonRulebook(pool, seasonId))?.row;
  if (!made) throw new HttpError(404, "Season not found");
  const schedule = (await seasonSchedules([seasonId], now)).get(seasonId);
  const from = startFrom(schedule, now);
  if (!from || !schedule?.episodes.some((e) => e.number === from)) throw new HttpError(409, "This season has no episodes left to ask it about");
  const question = offer.question.trim().slice(0, 300);
  const label = (typeof offer.label === "string" && offer.label.trim() ? offer.label.trim() : question).replace(/\s+/g, " ").slice(0, 80);
  const reliability = offer.reliable === "high" ? "reliable" : "usually";

  const client = await pool.connect();
  let book: Book;
  let id: string;
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`rulebook:${made.id}`]);
    const fresh = await seasonRulebook(client as never, seasonId);
    if (!fresh) throw new HttpError(404, "Rulebook not found");
    book = fresh;
    const base = book.blocks as RulebookBlocks;
    const added = Added.addedOf(base);
    const same = added.find((x) => norm(x.question ?? "") === norm(question) || norm(x.label) === norm(label));
    if (same) {
      await client.query("ROLLBACK");
      const was = (base.customMoments ?? []).find((x) => x.id === same.id)?.reliability;
      return { moment: { id: same.id, label: same.label, question: same.question ?? question, from: same.from, reliability: was === "reliable" ? "reliable" : "usually" }, existing: true, words };
    }
    if (added.length >= Added.MAX_ADDED) throw new HttpError(409, `This season has ${Added.MAX_ADDED} moments added already`);
    // Its id is new against every moment the rules have, the ones a later change brought included.
    const later = blocksAt(base, await inForceEdits(client as never, book.id), Infinity) as RulebookBlocks;
    const taken = new Set([...momentsFor(base, { includeOff: true }), ...momentsFor(later, { includeOff: true })].map((x) => x.id));
    const stem = camelId(label) || "moment";
    id = stem;
    for (let i = 2; taken.has(id); i++) id = `${stem}${i}`;
    const m: RulebookCustomMoment = { id, label, question, counted: "yesNo", answeredBy: "research", reliability, addedFrom: from };
    const next: RulebookBlocks = { ...JSON.parse(JSON.stringify(base)), customMoments: [...(base.customMoments ?? []), m] };
    const problems = blocksProblems(next);
    if (problems.length) throw new HttpError(400, problems.map((p) => p.message).join(" · "));
    const saved = await saveChain(client as never, book.id, { blocks: next, userId: user.id });
    if (!saved) throw new HttpError(404, "Rulebook not found");
    if ("refused" in saved) throw new HttpError(400, (saved.refused as { message: string }[]).map((p) => p.message).join(" · "));
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  await logDesk(pool, {
    entity: "rulebook",
    entityId: book.id,
    action: "fix",
    text: `A moment added for research to ask from Episode ${from}: ${label}`,
    before: { version: book.version },
    undo: { type: "rulebookBase", id: book.id, blocks: book.blocks },
    userId: user.id,
  });
  return { moment: { id, label, question, from, reliability }, existing: false, words };
}

/** The moment ids a game's questions settle by (a card's lines' too). */
function momentsAsked(state: LeagueState): Set<string> {
  const out = new Set<string>();
  for (const q of StateLogic.AnswerLogic.questions(state) as (Question & { card?: { of?: string[] } })[]) {
    const st = q.settle as { by?: string; moment?: string } | undefined;
    if (st?.by !== "moment") continue;
    if (typeof st.moment === "string") out.add(st.moment);
    for (const id of q.card?.of ?? []) out.add(id);
  }
  return out;
}

/**
 * For a game a question on a season's added moment settles: each episode, the added moments research left unsure in it (nobody's
 * answer yes, not everyone's no, or no stored answer at all), and every episode before the one each was first asked about. Read on
 * each read of the game, as episode facts are (episode-facts.ts), so what research files lands at once. Undefined for any other game:
 * one small query when a game's questions settle on moments, and none when they don't.
 */
export async function unsureMomentsFor(state: LeagueState): Promise<Map<number, Set<string>> | undefined> {
  const asked = momentsAsked(state);
  const s = state.settings ?? {};
  if (!asked.size || !s.showId || s.wikiSeason == null) return undefined;
  const { rows: books } = await pool.query(
    `SELECT r.blocks->'customMoments' AS customs, ss.show_id, ss.season_number FROM show_seasons ss JOIN shows sh ON sh.id = ss.show_id
       JOIN rulebooks r ON r.owner_kind = 'season' AND r.season_id = ss.id AND r.status <> 'archived'
      WHERE sh.slug = $1 AND ss.season_number = $2`,
    [s.showId, Number(s.wikiSeason)]
  );
  const added = Added.addedOf({ customMoments: books[0]?.customs ?? [] }).filter((m) => asked.has(m.id));
  if (!added.length) return undefined;
  // Each stored answer's people, with only their name and the added moments' answers.
  const { rows } = await pool.query(
    `SELECT er.episode_number,
            (SELECT COALESCE(jsonb_agg(jsonb_build_object('name', c->'name') || COALESCE((SELECT jsonb_object_agg(k, c->k) FROM unnest($3::text[]) k WHERE c ? k), '{}'::jsonb)), '[]'::jsonb)
               FROM jsonb_array_elements(CASE WHEN jsonb_typeof(er.payload->'castaways') = 'array' THEN er.payload->'castaways' ELSE '[]'::jsonb END) c
              WHERE jsonb_typeof(c) = 'object') AS castaways
       FROM episode_research er WHERE er.show_id = $1 AND er.season_number = $2 AND er.source = 'combined'`,
    [books[0].show_id, books[0].season_number, added.map((m) => m.id)]
  );
  const stored = new Map(rows.map((r) => [Number(r.episode_number), r.castaways]));
  const last = Math.max(0, ...stored.keys(), ...(state.episodes ?? []).map((e) => Number((e as { number?: number }).number) || 0));
  const out = new Map<number, Set<string>>();
  for (let n = 1; n <= last; n++) {
    const unsure = new Set(added.filter((m) => n < m.from || !stored.has(n) || Added.standingOf(stored.get(n), m.id).state === "unsure").map((m) => m.id));
    if (unsure.size) out.set(n, unsure);
  }
  return out;
}
