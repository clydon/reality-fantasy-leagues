import StateLogic from "@/lib/game/state-logic.js";
import { formatForRulebook } from "@/lib/game/formats/index.js";
import { rulebookFor } from "@/lib/game/formats/blocks/index.js";
import { howItWorks, type HowItWorks } from "@/lib/game/formats/rulebook-describe.js";
import type { RulebookUpdate } from "@/lib/game/formats/rulebook-describe";
import type { GameFormat } from "@/lib/game/formats/index";
import { publicMediaSrc } from "@/lib/game/selectors";
import { blocksAt } from "@/lib/game/formats/rulebook-patch.js";
import { inForceEdits, knownPhaseStarts, lineage, rulebookForLeague, seasonRulebook, type Rulebook } from "@db/rulebooks.js";
import { resolveFormat } from "@db/show-formats.js";
import type { SessionUser } from "./auth-helpers";
import { pool, HttpError } from "./db";
import { EVERYTHING, seenThrough } from "./guard";
import { leagueStates } from "./league-states";
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
}

export async function seasonHowItWorks(user: SessionUser, seasonId: string, couchId: string | null): Promise<HowItWorksPage> {
  const header = (await seasonHeaders([seasonId])).get(seasonId);
  if (!header) throw new HttpError(404, "Season not found");
  const seen = await seenThrough(user.id, seasonId);
  const mark = seen === EVERYTHING ? null : seen;

  // The game whose rules it tells: one you play before one you don't, a Weekly Lineup first (its points are the
  // ones What scores lists; the others don't score by moments).
  const here = await games(user.id, couchId ? { couchIds: [couchId], seasonId } : { mine: true, seasonId });
  const rank = (g: (typeof here)[number]) => (g.yourRole ? 0 : 2) + (g.gameType === "active-roster" ? 0 : 1);
  const game = [...here].sort((a, b) => rank(a) - rank(b))[0] ?? null;
  const state = game ? (await leagueStates([game.leagueId])).get(game.leagueId) : undefined;

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
    if (game.gameType === "active-roster") points = state.settings.eventPoints;
    ownership = state.settings.ownershipMode;
    updates.push({ episode: StateLogic.startEpisode(state), kind: "start", detail: `Plays by the ${format.name.replace(/^The /, "")} rulebook.` });
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
  // A rulebook someone made with Make it a game (step 10 part 2a) says so, and that it's new until another couch checks it.
  let made: string | null = null;
  if (row?.provenance?.from === "made") {
    const { rows: by } = await pool.query(`SELECT COALESCE(username, name) AS who FROM "user" WHERE id = $1`, [row.createdBy]);
    made = `Made with ChatGPT${by[0]?.who ? ` by ${by[0].who}` : ""}${row.reviewStatus === "unreviewed" ? " · new until another couch checks it" : ""}`;
  }
  const how = howItWorks(book.blocks, {
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
  return { how, cast };
}
