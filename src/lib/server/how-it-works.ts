import StateLogic from "@/lib/game/state-logic.js";
import { formatForRulebook } from "@/lib/game/formats/index.js";
import { rulebookFor } from "@/lib/game/formats/blocks/index.js";
import { howItWorks, type HowItWorks } from "@/lib/game/formats/rulebook-describe.js";
import type { RulebookUpdate } from "@/lib/game/formats/rulebook-describe";
import type { GameFormat } from "@/lib/game/formats/index";
import type { RulebookBlocks } from "@/lib/game/formats/rulebook-schema";
import { publicMediaSrc } from "@/lib/game/selectors";
import { showWords } from "@/lib/game/show-words";
import { blocksAt } from "@/lib/game/formats/rulebook-patch.js";
import { inForceEdits, knownPhaseStarts, lineage, rulebookForLeague, seasonRulebook, type Rulebook } from "@db/rulebooks.js";
import { resolveFormat } from "@db/show-formats.js";
import type { SessionUser } from "./auth-helpers";
import { pool, HttpError } from "./db";
import { EVERYTHING, seenThrough } from "./guard";
import { leagueStates } from "./league-states";
import { checkState, type CheckState } from "./rulebook-checks";
import { seasonCastRows } from "./season-cast";
import { games, seasonHeaders } from "./show-space";

// How it works for a season (docs/PLAN-new-design.md step 1; GET /api/seasons/[id]/how-it-works), for everyone,
// playing or not: R1's view model (formats/rulebook-describe.js) on the rulebook the couch's games here play by, else
// the season's own, else its show's format. Spoiler-safe through guard.ts: `seen` is the reader's mark, so a phase
// they haven't reached shows only its condition and a later update is counted, never told; the format a game plays
// by is read from their own copy of the league (GhostLogic.viewFor), which leaves out a rule change from an episode
// they haven't seen. "Who's playing" is the season's faces, in the groups they started in. A rulebook the desk edited
// (step 6b part 2) reads as it stood at the reader's episode: a change from a later one is only counted on the timeline,
// and what it added (a new twist) isn't on the page yet.

export interface HowItWorksPage {
  how: HowItWorks;
  cast: { name: string; photo: string | null; colour: string | null }[];
  /** A rulebook someone made (step 10 part 3): whether your couch can say it looks right, or has. */
  check: CheckState;
}

export async function seasonHowItWorks(user: SessionUser, seasonId: string, couchId: string | null): Promise<HowItWorksPage> {
  const header = (await seasonHeaders([seasonId])).get(seasonId);
  if (!header) throw new HttpError(404, "Season not found");
  const seen = await seenThrough(user.id, seasonId);
  const mark = seen === EVERYTHING ? null : seen;

  // The game whose rules it tells: one you play before one you don't, a Weekly Lineup first (its points are the
  // ones What scores lists; the others don't score by moments).
  const here = await games(user.id, couchId ? { couchIds: [couchId], seasonId } : { mine: true, seasonId });
  // Step R1: a game that scores by moments (its spec's score.by), never a type compared by name.
  const states = await leagueStates(here.map((g) => g.leagueId));
  const byMoments = new Set(here.filter((g) => { const s = states.get(g.leagueId); return !!s && StateLogic.piecesOf(s).scores === "moments"; }).map((g) => g.leagueId));
  const moments = (g: (typeof here)[number]) => byMoments.has(g.leagueId);
  const rank = (g: (typeof here)[number]) => (g.yourRole ? 0 : 2) + (moments(g) ? 0 : 1);
  const game = [...here].sort((a, b) => rank(a) - rank(b))[0] ?? null;
  const state = game ? states.get(game.leagueId) : undefined;

  let format: GameFormat;
  let row: Rulebook | null;
  let cast: HowItWorksPage["cast"];
  let points: Record<string, number> | undefined;
  let ownership: "exclusive" | "shared" | undefined;
  const updates: RulebookUpdate[] = [];
  if (game && state) {
    const { rows } = await pool.query("SELECT player_id FROM league_memberships WHERE league_id = $1 AND user_id = $2", [game.leagueId, user.id]);
    const view = StateLogic.GhostLogic.viewFor(state, rows[0]?.player_id ?? null, mark);
    format = StateLogic.formatOf(view);
    row = await rulebookForLeague(pool, { leagueId: game.leagueId, settings: state.settings });
    const tribes = new Map((view.tribes || []).map((t) => [t.id, t.color]));
    cast = view.castaways.map((c) => ({ name: c.name, photo: publicMediaSrc(c.photoUrl), colour: tribes.get(c.startTribeId || c.tribeId) ?? null }));
    if (moments(game)) points = state.settings.eventPoints;
    ownership = state.settings.ownershipMode;
    // A game that starts when a phase does (step A3 of docs/PLAN-start-a-game-gpt.md) says which; while it waits, the rules are
    // in force from the premiere and the game from that phase.
    const start = StateLogic.startEpisode(state);
    const phaseId = StateLogic.startPhase(state);
    const phase = phaseId ? (((row?.blocks as RulebookBlocks | undefined)?.season?.phases ?? []).find((p) => p.id === phaseId)?.name ?? phaseId) : null;
    const when = phase ? (start === null ? ` The game starts when ${phase} starts.` : ` The game starts with ${phase}.`) : "";
    updates.push({ episode: start ?? 1, kind: "start", detail: `Plays by the ${format.name.replace(/^The /, "")} rulebook.${when}` });
    // A game over a span (docs/PLAN-sports-data.md step 6) says where it ends too.
    const end = StateLogic.endEpisode(state);
    if (end !== null) updates.push({ episode: end, kind: "end", detail: "Nothing after it scores." });
    // Every change the game adopted, from the full state: one from an episode they haven't seen is only counted.
    for (const c of state.settings.adoptedRuleChanges ?? []) updates.push({ episode: c.effectiveEpisode, kind: "showChanged", detail: c.summary ?? "" });
  } else {
    row = await seasonRulebook(pool, seasonId);
    const { rows } = await pool.query("SELECT s.format FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1", [seasonId]);
    format = row?.compiled ? formatForRulebook(row.compiled, row.reader) : await resolveFormat(pool, rows[0]?.format ?? null);
    // The season's cast without groups: a season's tribes can be held back until an episode shows them.
    cast = (await seasonCastRows(seasonId)).map((c) => ({ name: c.name, photo: publicMediaSrc(c.photoUrl), colour: null }));
    updates.push({ episode: 1, kind: "start", detail: `Plays by the ${format.name.replace(/^The /, "")} rulebook.` });
  }

  // A game still on its show's format (its season's leagues don't play by rulebooks yet) is told the format it plays.
  const plays = !(game && state) || !!state.settings.rulebook || row?.compiledSource === "legacy";
  const edits = row && plays ? await inForceEdits(pool, row.id) : [];
  for (const e of edits) updates.push({ episode: e.fromEpisode, kind: "showChanged", detail: e.summary ?? "" });
  const book = row?.blocks && plays ? { blocks: blocksAt(row.blocks, edits, mark ?? Infinity), aliases: row.aliases } : rulebookFor(format.id, format.data);
  const phaseStarts = row && Object.keys(row.phaseStarts || {}).length ? row.phaseStarts : await knownPhaseStarts(pool, seasonId, book.blocks);
  const line = row ? await lineage(pool, row.id) : null;
  // A rulebook someone made with Make it a game (step 10 part 2a) says so, and that it's new until another couch checks it
  // (step 10 part 3: Looks right to us), unless the desk made it or took it over.
  let made: string | null = null;
  if (row?.provenance?.from === "made") {
    const { rows: by } = await pool.query(`SELECT COALESCE(username, name) AS who FROM "user" WHERE id = $1`, [row.createdBy]);
    const { rows: parent } = row.provenance.via === "template" && row.parentId ? await pool.query("SELECT name FROM rulebooks WHERE id::text = $1", [row.parentId]) : { rows: [] };
    const how = row.provenance.via === "template" ? `Made from the ${parent[0]?.name ?? "library"} rulebook` : "Made with ChatGPT";
    const state = row.reviewStatus === "unreviewed" ? " · new until another couch checks it" : row.reviewStatus === "checked" ? " · checked by another couch" : "";
    // The desk's own (made by a site admin, checked as it was made) names nobody.
    const desk = !!row.approvedBy && row.approvedBy === row.createdBy;
    made = `${how}${by[0]?.who && !desk ? ` by ${by[0].who}` : ""}${state}`;
  }
  const seasonBook = row?.ownerKind === "season" ? row : await seasonRulebook(pool, seasonId);
  // One word for an episode (docs/BACKLOG.md item 10): the show's (episode_term), as Start a game, the hub and Game settings say
  // it, wherever the rulebook would say its own ("Ends with Game 6", "Each game").
  const words = showWords(header.show.terms);
  const said = { ...book.blocks, parts: { ...book.blocks.parts, singular: words.episode.toLowerCase(), plural: words.episodes.toLowerCase() } };
  const how = howItWorks(said, {
    compiled: format.data,
    aliases: book.aliases,
    points,
    ownership,
    seen,
    episodeCount: header.episodeCount,
    phaseStarts,
    castCount: cast.length || undefined,
    updates,
    lineage: made ?? (row ? `${row.name}${line && line.following > 1 ? ` · ${line.following} games play by it` : ""}` : null),
  });
  return { how, cast, check: await checkState(user.id, seasonBook, couchId) };
}
