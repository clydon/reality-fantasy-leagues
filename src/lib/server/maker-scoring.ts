import { camelId } from "@/lib/game/formats/proposal.js";
import { pointGroups } from "@/lib/game/formats/rulebook-describe.js";
import { momentsFor } from "@/lib/game/formats/rulebook-moments.js";
import { blocksAt, diffBlocks, opLines } from "@/lib/game/formats/rulebook-patch.js";
import { blocksProblems, type RulebookBlocks, type RulebookCustomMoment } from "@/lib/game/formats/rulebook-schema.js";
import { inForceEdits, saveChain, seasonRulebook } from "@db/rulebooks.js";
import { isSuperAdminUser, isUuid, type SessionUser } from "./auth-helpers";
import { restageSeason } from "./community-results";
import { pool, HttpError } from "./db";
import { logDesk } from "./desk";
import { askAgain, lookedUp, resultsResearch } from "./research-asks";

// The maker's scoring (docs/PLAN-maker-scoring.md step 3; GET/POST /api/seasons/[id]/scoring): whoever made a show a game (Make
// it a game, make-game.ts confirmMake: the season's rulebook's creator) changes what its moments are worth and adds moments,
// until a game is played on the season; after that its scoring is every game's (the desk, a couch's Make it ours, suggested
// fixes), so this reads as the rules with why. Site admins may edit too.
//
// A save is the desk's "fix a mistake" (desk-rulebooks.ts saveRulebook's fix): what changed between the rules as they are and
// the edited ones, put on the base, the chain compiled again (saveChain), the stored format kept in step for anything that
// still reads it, then every stored answer read again under the new rules (restageSeason): a points change, or a moment scored
// from an answer already asked (customMoments[].uses), counts at once with no research. A moment with a question of its own
// needs the episodes looked up again (step 5): the save says which, the page says which episodes have no answer to one yet, and
// lookUpAgain asks the bot again about them (research-asks.ts askAgain): for just the new questions, or everything.

const MIN_POINTS = -20;
const MAX_POINTS = 20;
/** The questions every person's answer has, not ones to score from. */
const CORE = new Set(["name", "leftTheGame", "exitMethod", "sources", "confidence"]);

export interface ScoringMoment {
  id: string;
  label: string;
  points: number;
  /** Added by hand: removable; `uses` when it's scored from a question the rulebook already asks. */
  custom: boolean;
  uses: string | null;
  /** Known without asking (how they left, a role): its points change, but it's not research's. */
  auto: boolean;
}

export interface ScoringPage {
  seasonId: string;
  editable: boolean;
  /** Why it can't be changed here, for someone who can't. */
  why: string | null;
  groups: { id: string; label: string; moments: ScoringMoment[] }[];
  /** The questions research already asks about each person, to score a new moment from. */
  questions: { key: string; words: string; type: "answer" | "integer" | "number" }[];
  /** Episodes research has answers for (what a new question would have to look up again). */
  researched: number[];
  /** Of those, the ones with no answer yet to a question a moment added here asks (and not being asked about now). */
  behind: number[];
  /** Episodes being asked about again now, waiting their turn or being looked up. */
  again: number[];
}

type Row = NonNullable<Awaited<ReturnType<typeof seasonRulebook>>>;

const pointsOf = (p: unknown): number => (typeof p === "number" ? p : p && typeof p === "object" && typeof (p as { exclusive?: number }).exclusive === "number" ? (p as { exclusive: number }).exclusive : 0);
const capFirst = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** The season's rulebook, and whether `user` may change its scoring (and why not). */
async function scope(user: SessionUser, seasonId: string): Promise<{ row: Row; editable: boolean; why: string | null }> {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const row = await seasonRulebook(pool, seasonId);
  if (!row || row.status !== "in_force" || !row.blocks) throw new HttpError(404, "This show isn't a game yet");
  const { rows } = await pool.query(
    `SELECT r.locked_at IS NOT NULL AS locked,
            EXISTS (SELECT 1 FROM leagues l WHERE l.deleted_at IS NULL AND l.state->'settings'->>'showId' = s.slug
                       AND l.state->'settings'->>'wikiSeason' = ss.season_number::text) AS played
       FROM rulebooks r JOIN show_seasons ss ON ss.id = r.season_id JOIN shows s ON s.id = ss.show_id WHERE r.id = $1`,
    [row.id]
  );
  const maker = row.createdBy === user.id || isSuperAdminUser(user);
  const why = !maker
    ? "Only whoever made it a game changes its scoring."
    : rows[0]?.played
      ? "A game's being played on it, so its scoring is every game's now."
      : rows[0]?.locked
        ? "Its rules are locked."
        : null;
  return { row, editable: !why, why };
}

/** The rules as they are now (every in-force edit on the base). */
async function blocksNow(row: Row): Promise<RulebookBlocks> {
  return blocksAt(row.blocks as RulebookBlocks, await inForceEdits(pool, row.id), Infinity) as RulebookBlocks;
}

async function pageOf(seasonId: string, row: Row, editable: boolean, why: string | null): Promise<ScoringPage> {
  const now = await blocksNow(row);
  const moments = new Map(momentsFor(now).map((m) => [m.id, m]));
  const groups = pointGroups(now, { compiled: row.compiled as never, aliases: row.aliases as never }).map((g) => ({
    id: g.id,
    label: g.label,
    moments: g.items.map((it) => {
      const m = moments.get(it.id);
      return { id: it.id, label: it.label, points: pointsOf(it.points), custom: !!m?.custom, uses: m?.uses ?? null, auto: !!it.auto };
    }),
  }));
  const checklist = ((row.compiled as { research?: { checklist?: { key: string; type: string; note?: string; description?: string }[] } } | null)?.research?.checklist ?? []).filter(
    (f) => !CORE.has(f.key) && (f.type === "answer" || f.type === "integer" || f.type === "number")
  );
  const { rows: done } = await pool.query(
    `SELECT DISTINCT er.episode_number AS n FROM episode_research er JOIN show_seasons ss ON ss.show_id = er.show_id AND ss.season_number = er.season_number
      WHERE ss.id = $1 AND er.source <> 'combined' AND er.withdrawn_at IS NULL ORDER BY 1`,
    [seasonId]
  );
  const { behind, again } = await behindOf(seasonId, now);
  return {
    seasonId,
    editable,
    why,
    groups,
    questions: checklist.map((f) => ({ key: f.key, words: capFirst(f.note || f.description || f.key), type: f.type as "answer" | "integer" | "number" })),
    researched: done.map((r) => r.n as number),
    behind,
    again,
  };
}

/** Episodes whose stored answers have nothing for a question a moment added here asks, besides those being asked again now. */
async function behindOf(seasonId: string, now: RulebookBlocks): Promise<{ behind: number[]; again: number[]; stored: number[] }> {
  const asks = momentsFor(now)
    .filter((m) => m.custom && !m.uses && m.ask)
    .map((m) => m.ask!.key);
  const [stored, research] = await Promise.all([lookedUp(seasonId), resultsResearch(seasonId)]);
  const again = (research?.asked ?? []).filter((a) => a.again && (a.status === "waiting" || a.status === "asking")).map((a) => a.episode);
  const behind = stored.filter((e) => !again.includes(e.episode) && asks.some((k) => !e.keys.includes(k))).map((e) => e.episode);
  return { behind, again, stored: stored.map((e) => e.episode) };
}

/**
 * Asks the bot again about the episodes looked up already: "missing", the ones with no answer to a new question, for just
 * what's new; "full", every one, for everything. Answers the page and how many it asked about.
 */
export async function lookUpAgain(user: SessionUser, seasonId: string, mode: unknown): Promise<{ page: ScoringPage; asked: number }> {
  if (mode !== "missing" && mode !== "full") throw new HttpError(400, "Just the new questions, or everything");
  const { row, editable, why } = await scope(user, seasonId);
  if (!editable) throw new HttpError(403, why ?? "You can't change this scoring");
  const { behind, stored } = await behindOf(seasonId, await blocksNow(row));
  const episodes = mode === "full" ? stored : behind;
  if (!episodes.length) throw new HttpError(400, mode === "full" ? "No episode has been looked up yet" : "Every episode has its answers to the new questions");
  const asked = await askAgain(user.id, seasonId, episodes, mode);
  return { page: await pageOf(seasonId, row, editable, why), asked };
}

/** The scoring page: every moment's points (as the rules are now), the questions to score from, who may change it. */
export async function scoringPage(user: SessionUser, seasonId: string): Promise<ScoringPage> {
  const { row, editable, why } = await scope(user, seasonId);
  return pageOf(seasonId, row, editable, why);
}

/** The same, or null for a season with no rulebook of its own (not made a game): the Players tab asks of every show. */
export async function scoringPageIfAny(user: SessionUser, seasonId: string): Promise<ScoringPage | null> {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const row = await seasonRulebook(pool, seasonId);
  if (!row || row.status !== "in_force" || !row.blocks) return null;
  return scoringPage(user, seasonId);
}

export interface ScoringSave {
  /** A moment's new worth, by id: any moment. */
  points?: Record<string, unknown>;
  /** Moments to add: their name, how they count, their worth, and what scores them (an answer already asked, by its key, or
   *  a question of their own: their name asks it). */
  add?: { label?: unknown; counted?: unknown; points?: unknown; uses?: unknown }[];
  /** Moments added by hand to take out. */
  remove?: unknown[];
}

const worth = (v: unknown, what: string): number => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < MIN_POINTS || n > MAX_POINTS || Math.round(n * 2) !== n * 2) throw new HttpError(400, `${what}: points from ${MIN_POINTS} to ${MAX_POINTS}, in halves`);
  return n;
};

/**
 * Saves the maker's changes as a fix from the premiere, keeps the stored format in step and reads every stored answer again.
 * Answers the page and the moments that ask a question of their own (`ask`: only new answers can score them).
 */
export async function saveScoring(user: SessionUser, seasonId: string, body: ScoringSave): Promise<{ page: ScoringPage; ask: { id: string; label: string }[]; restaged: number[] }> {
  const { row, editable, why } = await scope(user, seasonId);
  if (!editable) throw new HttpError(403, why ?? "You can't change this scoring");
  // A fix from the premiere: the changes go on the base (a later "the show changed" edit stays on top of it, as it was). An
  // edit keeps the points block whole, so one that set points would put back its own from its episode, undoing these
  // (BACKLOG): refused, with why, rather than saved and lost.
  const edits = await inForceEdits(pool, row.id);
  const setsPoints = edits.find((e) => ((e.ops ?? []) as { block?: string }[]).some((o) => o.block === "points"));
  if (setsPoints && (Object.keys(body.points ?? {}).length || (body.add ?? []).length)) {
    throw new HttpError(409, `The show changed from Episode ${setsPoints.fromEpisode} with points of its own: the desk changes the scoring from here`);
  }
  const base = row.blocks as RulebookBlocks;
  const now = await blocksNow(row);
  const next: RulebookBlocks = JSON.parse(JSON.stringify(base));
  next.points = { ...(next.points ?? {}) };
  next.customMoments = [...(next.customMoments ?? [])];
  const known = new Set(momentsFor(base).map((m) => m.id));
  const later = new Set(momentsFor(now).map((m) => m.id));

  for (const [id, v] of Object.entries(body.points ?? {})) {
    if (!known.has(id)) throw new HttpError(400, later.has(id) ? `${id} came with a later change to the show: the desk changes its points` : `There's no moment "${id}"`);
    next.points[id] = worth(v, id);
  }
  for (const v of body.remove ?? []) {
    const id = String(v);
    if (!next.customMoments.some((m) => m.id === id)) throw new HttpError(400, "Only a moment added by hand can be taken out");
    next.customMoments = next.customMoments.filter((m) => m.id !== id);
    delete next.points[id];
  }
  const checklist = new Map(
    ((row.compiled as { research?: { checklist?: { key: string; type: string }[] } } | null)?.research?.checklist ?? []).map((f) => [f.key, f.type])
  );
  const added: RulebookCustomMoment[] = [];
  for (const a of body.add ?? []) {
    const label = typeof a.label === "string" ? a.label.trim().replace(/\s+/g, " ") : "";
    if (label.length < 3 || label.length > 80) throw new HttpError(400, "A moment's name, 3 to 80 letters");
    const counted = a.counted === "yesNo" || a.counted === "eachTime" || a.counted === "perUnit" ? a.counted : null;
    if (!counted) throw new HttpError(400, `${label}: how it counts is yes or no, each time, or per amount`);
    let id = camelId(label) || "moment";
    for (let i = 2; known.has(id) || later.has(id) || next.customMoments.some((m) => m.id === id); i++) id = `${camelId(label) || "moment"}${i}`;
    const uses = typeof a.uses === "string" && a.uses ? a.uses : null;
    if (uses) {
      const type = checklist.get(uses);
      if (!type || CORE.has(uses)) throw new HttpError(400, `${label}: research doesn't ask that`);
      if (counted === "yesNo" ? type !== "answer" : type !== "integer" && type !== "number") {
        throw new HttpError(400, `${label}: ${counted === "yesNo" ? "once an episode needs a yes-or-no question" : "counting needs a question with a number for its answer"}`);
      }
    }
    const m: RulebookCustomMoment = { id, label, counted, answeredBy: "research", ...(uses ? { uses } : {}) };
    next.customMoments.push(m);
    next.points[id] = worth(a.points ?? 0, label);
    added.push(m);
  }

  const problems = blocksProblems(next);
  if (problems.length) throw new HttpError(400, problems.map((p) => p.message).join(" · "));
  const ops = diffBlocks(base, next);
  if (!ops.length) throw new HttpError(400, "Nothing changed");
  const saved = await saveChain(pool, row.id, { blocks: next, userId: user.id });
  if (!saved) throw new HttpError(404, "Rulebook not found");
  if ("refused" in saved) throw new HttpError(400, (saved.refused as { message: string }[]).map((p) => p.message).join(" · "));
  const summary = opLines(ops, base, next).slice(0, 3).join(" · ");
  await logDesk(pool, {
    entity: "rulebook",
    entityId: row.id,
    action: "fix",
    text: `Its maker changed the scoring: ${summary}`,
    before: { version: row.version },
    undo: { type: "rulebookBase", id: row.id, blocks: row.blocks },
    userId: user.id,
  });
  // The stored format copied from it when it was made (show_formats made-<slug>), for anything that still reads that.
  const { rows: fresh } = await pool.query("SELECT compiled FROM rulebooks WHERE id = $1", [row.id]);
  const compiled = fresh[0]?.compiled as { id?: string; name?: string } | null;
  if (compiled?.id?.startsWith("made-")) {
    await pool.query("UPDATE show_formats SET data = $2, version = version + 1, updated_at = now() WHERE id = $1", [compiled.id, JSON.stringify(compiled)]);
  }
  const restaged = (await restageSeason(seasonId, 1, user.id)).episodes;
  const page = await scoringPage(user, seasonId);
  return { page, ask: added.filter((m) => !m.uses).map((m) => ({ id: m.id, label: m.label })), restaged };
}
