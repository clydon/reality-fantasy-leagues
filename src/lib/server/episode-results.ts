import StateLogic from "@/lib/game/state-logic.js";
import { secretEvents } from "@/lib/game/cast-stats";
import { publicMediaSrc } from "@/lib/game/selectors";
import { isUuid, type SessionUser } from "./auth-helpers";
import { episodeFacts, factLabel, type FactView } from "./community-results";
import { requireCouch } from "./couches";
import { HttpError } from "./db";
import { secretFields, seenThrough } from "./guard";
import { couchCorrections, rulingsFor, type Correction } from "./rulings";
import { seasonFactsFor } from "./season-stats";
import { games } from "./show-space";

// One episode's shared results as its page shows them (docs/PLAN-new-design.md step 6b; GET /api/seasons/[id]/results/
// [episode]?couch=): who each result is about, how sure the shared check is of it ("1 source", "2 sources agree",
// "Disputed"), your own flags, the corrections that reached the couch's games (what changed, your points) and any house
// ruling there. For anyone on the couch who has seen the episode; nothing about it leaves the server before that.

export interface EpisodeResult extends Pick<FactView, "id" | "kind" | "status" | "line" | "flags" | "yours"> {
  label: string;
}

export interface EpisodeResults {
  episode: number;
  people: { name: string; photo: string | null; results: EpisodeResult[] }[];
  /** "Something's missing" flags still open, and whether one is yours. */
  missing: { open: number; yours: boolean };
  corrections: Correction[];
  rulings: { decisionId: string; game: string; by: string | null; name: string; label: string }[];
}

export async function episodeResults(user: SessionUser, seasonId: string, couchId: string | null, episode: number): Promise<EpisodeResults> {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  if (!couchId) throw new HttpError(400, "couch required");
  await requireCouch(user, couchId);
  const seen = await seenThrough(user.id, seasonId);
  if (seen < episode) throw new HttpError(403, `Reveal Episode ${episode} first`);

  const [{ facts: shared, missing, yoursMissing }, view, here] = await Promise.all([
    episodeFacts(seasonId, episode, user.id),
    seasonFactsFor(user, seasonId, couchId),
    games(user.id, { couchIds: [couchId], seasonId }),
  ]);
  const state = view.facts;
  const format = StateLogic.formatOf(state);
  // A secret role (the Traitors' faction), and any result that gives one away, only for someone who has left by now.
  const secretKinds = new Set(secretFields(format));
  const telling = secretEvents(format, view.book);
  const people = new Map<string, EpisodeResults["people"][number]>();
  for (const f of shared) {
    // "Nobody went home" is about no one: the episode page says so itself (its stage), and "Something else" flags it.
    if (f.kind === "noexit") continue;
    const { castaway } = StateLogic.Core.findCastawayByName(state, f.name);
    const stillIn = castaway?.status !== "eliminated";
    if (stillIn && (secretKinds.has(f.kind) || (f.kind === "event" && telling.has(f.eventType)))) continue;
    const name = castaway?.name ?? f.name;
    const p = people.get(name) ?? { name, photo: publicMediaSrc(castaway?.photoUrl), results: [] };
    p.results.push({ id: f.id, kind: f.kind, status: f.status, line: f.line, flags: f.flags, yours: f.yours, label: factLabel(state, f) });
    people.set(name, p);
  }
  const ids = here.map((g) => g.leagueId);
  const names = new Map(here.map((g) => [g.leagueId, g.name]));
  const corrections = await couchCorrections(ids, seen, user.id, episode);
  const rulings = (await rulingsFor(ids, episode)).map((r) => ({ decisionId: r.decisionId, game: names.get(r.leagueId) ?? "a game", by: r.by, name: r.name, label: r.label }));
  return { episode, people: [...people.values()], missing: { open: missing, yours: yoursMissing }, corrections, rulings };
}
