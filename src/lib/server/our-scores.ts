import crypto from "crypto";
import { momentsFor } from "@/lib/game/formats/rulebook-moments.js";
import { blocksAt } from "@/lib/game/formats/rulebook-patch.js";
import type { RulebookBlocks } from "@/lib/game/formats/rulebook-schema";
import type { PreviewLine } from "@/lib/game/results-changes";
import { compileChain, inForceEdits, saveChain } from "@db/rulebooks.js";
import { canUseAskBot } from "./ask-bot";
import type { SessionUser } from "./auth-helpers";
import type { BackstageScope } from "./backstage";
import { pool, HttpError } from "./db";
import { queueRulebook, takeOverQueue } from "./desk-research";
import { researchFor, rulebookPrompt, settleRows, stagePaste, type RulebookAnswerCard } from "./desk-rulebooks";
import { copyOf, gamesOn, preview, ruleGames, syncGames } from "./ours";

// What scores for a commissioner (docs/PLAN-rulebook-research.md, stage two; the user, 2026-11-05: commissioners
// shouldn't rely on the admin): the same question, ladder, rarity and holding as the desk's, on the couch's own copy of
// the rulebook (ours.ts, Make it ours), from Backstage › Scoring rules. Our bot is asked through the desk's Run now queue
// (desk-research.ts queueRulebook, the copy as the rulebook), or an answer is pasted; it's staged in rulebook_answers
// against the copy and reviewed for the commissioner by their own Where I am mark (desk-rulebooks.ts researchFor), so a
// new-this-season moment past where they are is held, unseen. Each row is theirs to Accept (the ladder's value), Adjust
// or Decline (settleOurScores): what's accepted goes into the copy's base (a moment added is one the couch answers each
// episode, as the couch's own are), the games are scored again (previewed first), one batch with Undo in Recent changes.
// Players see nothing of it.

export interface OurScores {
  /** The couch has its own copy: What scores works on it. Without one, Make it ours first. */
  copy: boolean;
  canChange: boolean;
  /** Where you are on the season (your Where I am mark); null: no mark, nothing held. */
  mark: number | null;
  asking: string | null;
  answer: RulebookAnswerCard | null;
}

async function copyFor(scope: BackstageScope): Promise<{ copy: Awaited<ReturnType<typeof copyOf>>; canChange: boolean }> {
  const { games } = await ruleGames(scope);
  const copy = games.length ? await copyOf(games.map((g) => g.leagueId)) : null;
  return { copy, canChange: games.length > 0 };
}

/** The state: the copy, where you are, what's asking, the answer waiting as you may see it. */
export async function ourScores(scope: BackstageScope, origin: string | null = null): Promise<OurScores> {
  const { copy, canChange } = await copyFor(scope);
  if (!copy) return { copy: false, canChange, mark: null, asking: null, answer: null };
  const research = await researchFor(copy.id, scope.user);
  // While it's asking, a queue whose driver was cut off is this read's to take over.
  if (research.scores.asking && origin) await takeOverQueue(origin);
  return { copy: true, canChange, mark: research.mark, asking: research.scores.asking, answer: research.scores.answer };
}

/** The question, for Ask an AI's chat links and its copy. */
export async function ourScoresPrompt(scope: BackstageScope): Promise<{ prompt: string; task: string }> {
  const { copy } = await copyFor(scope);
  if (!copy) throw new HttpError(409, "Make it ours first");
  const q = await rulebookPrompt(copy.id, "scores");
  return { prompt: q.prompt, task: q.task };
}

function mustChange(canChange: boolean) {
  if (!canChange) throw new HttpError(403, "Only a Commissioner changes the rules");
}

/** Ask our bot: queued behind the other Run nows, the copy as the rulebook. */
export async function askOurScores(scope: BackstageScope, o: { bot?: string; origin: string }): Promise<{ text: string; waits: string | null }> {
  const { copy, canChange } = await copyFor(scope);
  mustChange(canChange);
  if (!copy) throw new HttpError(409, "Make it ours first");
  if (!(await canUseAskBot(scope.user))) throw new HttpError(403, "Our bot isn't yours to ask here. Ask an AI yourself and paste its answer.");
  return queueRulebook(scope.user, copy.id, "scores", null, o);
}

/** Paste it: an answer from Ask an AI, staged as our bot's is. */
export async function pasteOurScores(scope: BackstageScope, raw: unknown): Promise<OurScores> {
  const { copy, canChange } = await copyFor(scope);
  mustChange(canChange);
  if (!copy) throw new HttpError(409, "Make it ours first");
  await stagePaste(scope.user, copy.id, "scores", raw);
  return ourScores(scope);
}

const half = (n: number) => Math.round(n * 2) / 2;

/**
 * The commissioner's say on the answer's rows: `accept` is each accepted row's points (the ladder's, or adjusted), `declined`
 * the rows left as they are; a row named in neither is accepted at the ladder's value. What's accepted goes into the copy
 * (a changed moment's points; an added moment as one the couch answers), the games are scored again, and the rows are
 * settled. `preview` says what moves and writes nothing. Nothing to save when everything is declined: the rows are put away.
 */
export async function settleOurScores(
  scope: BackstageScope,
  body: { answer?: unknown; accept?: unknown; declined?: unknown; preview?: boolean }
): Promise<{ lines: PreviewLine[] } | { batch: string | null; saved: number; declined: number }> {
  const { copy, canChange } = await copyFor(scope);
  mustChange(canChange);
  if (!copy) throw new HttpError(409, "Make it ours first");
  const a = (await researchFor(copy.id, scope.user)).scores.answer;
  if (!a || a.id !== String(body.answer)) throw new HttpError(404, "That answer isn't waiting");
  if (!a.blocks) throw new HttpError(400, a.problems[0] ?? "That answer can't be used");
  const rows = (a.rows ?? []).filter((r) => r.changed);
  const added = a.added ?? [];
  const decidable = new Set([...rows.map((r) => r.id), ...added.map((m) => m.id)]);
  const declined = (Array.isArray(body.declined) ? body.declined : []).filter((x): x is string => typeof x === "string" && decidable.has(x));
  const accept: Record<string, number> = {};
  const given = body.accept && typeof body.accept === "object" ? (body.accept as Record<string, unknown>) : {};
  for (const id of decidable) {
    if (declined.includes(id)) continue;
    // A drop has no value to adjust: accepted, the moment goes.
    const own = rows.find((r) => r.id === id)?.drop ? undefined : given[id];
    const value = own === undefined ? (rows.find((r) => r.id === id)?.after ?? added.find((m) => m.id === id)?.points ?? 0) : Number(own);
    if (!Number.isFinite(value) || value < -20 || value > 20) throw new HttpError(400, "Points are -20 to 20");
    accept[id] = half(value);
  }
  const accepted = Object.keys(accept);
  if (!accepted.length && !declined.length) throw new HttpError(400, "Nothing to save");

  const edits = await inForceEdits(pool, copy.id);
  const now = blocksAt(copy.blocks, edits, Infinity);
  const base = structuredClone(copy.blocks) as RulebookBlocks;
  const points: Record<string, number | { exclusive: number; shared: number }> = { ...((base.points ?? {}) as Record<string, number | { exclusive: number; shared: number }>) };
  const defaults = new Map(momentsFor(now).map((m) => [m.id, m.defaultPoints]));
  let customs = [...(base.customMoments ?? [])];
  let rescored = 0;
  let joined = 0;
  let dropped = 0;
  for (const id of accepted) {
    const v = accept[id];
    const made = (a.blocks.customMoments ?? []).find((m) => m.id === id);
    if (rows.find((r) => r.id === id)?.drop) {
      // Added by hand and worth nothing: taken out of the copy, so the couch isn't asked about it every episode.
      customs = customs.filter((m) => m.id !== id);
      delete points[id];
      dropped++;
    } else if (added.some((m) => m.id === id) && made && !customs.some((m) => m.id === id)) {
      // The couch answers it each episode, as the couch's own moments are (ours.ts): research isn't asked a copy's questions.
      const { reliability: _r, ...rest } = made as typeof made & { reliability?: string };
      void _r;
      customs.push({ ...rest, answeredBy: "league" } as never);
      if (v !== 0) points[id] = v;
      joined++;
    } else if (rows.some((r) => r.id === id)) {
      const d = defaults.get(id);
      points[id] = d && typeof d === "object" ? { exclusive: v, shared: v } : v;
      rescored++;
    }
  }
  if (customs.length) base.customMoments = customs as never;
  else delete base.customMoments;
  if (Object.keys(points).length) base.points = points as never;
  else delete base.points;

  const on = (await gamesOn(copy.id)).map((g) => g.id);
  if (body.preview) {
    if (!rescored && !joined && !dropped) return { lines: [] };
    const compiled = compileChain(copy, base, edits, copy.phaseStarts);
    if (!compiled.data) throw new HttpError(400, compiled.problems[0] ?? "That isn't a usable rulebook");
    return { lines: await preview(on, scope.games, { id: copy.id, version: copy.version + 1, data: compiled.data, reader: copy.reader }) };
  }
  let batch: string | null = null;
  if (rescored || joined || dropped) {
    const saved = await saveChain(pool, copy.id, { blocks: base, userId: scope.user.id });
    if (!saved) throw new HttpError(404, "Rulebook not found");
    if ("refused" in saved) throw new HttpError(400, saved.refused[0]?.message ?? "That isn't a usable rulebook");
    const b = crypto.randomUUID();
    batch = b;
    const n = (k: number, w: string) => `${k} ${w}${k === 1 ? "" : "s"}`;
    const text = [rescored ? `${n(rescored, "moment")} rescored` : "", dropped ? `${n(dropped, "moment")} dropped` : "", joined ? `${n(joined, "moment")} added, the couch answers` : ""].filter(Boolean).join(", ");
    await syncGames(on, () => ({
      userId: scope.user.id,
      kind: "rules.ours",
      tier: 2,
      text: `What scores: ${text}`,
      batch: b,
      undo: { type: "rulebook", action: "blocks", rulebookId: copy.id, before: copy.blocks, version: saved.rulebook.version },
    }));
  }
  await settleRows(scope.user as SessionUser, copy.id, { answer: a.id, status: "used", ids: accepted, declined });
  return { batch, saved: accepted.length, declined: declined.length };
}

/** Put away: every row shown, left as it is. */
export async function putAwayOurScores(scope: BackstageScope, answer: unknown): Promise<OurScores> {
  const { copy, canChange } = await copyFor(scope);
  mustChange(canChange);
  if (!copy) throw new HttpError(409, "Make it ours first");
  const a = (await researchFor(copy.id, scope.user)).scores.answer;
  if (!a || a.id !== String(answer)) throw new HttpError(404, "That answer isn't waiting");
  const ids = [...(a.rows ?? []).filter((r) => r.changed).map((r) => r.id), ...(a.added ?? []).map((m) => m.id)];
  await settleRows(scope.user, copy.id, { answer: a.id, status: "dismissed", ids, declined: [] });
  return ourScores(scope);
}
