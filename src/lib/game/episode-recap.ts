import type { Castaway, Episode, LeagueState, Tribe } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";

/** One headline win in an episode's Recap: whole tribes that won it, and anyone who won it on their own. */
export interface RecapWin {
  label: string;
  tribes: { tribe: Tribe; members: Castaway[] }[];
  castaways: Castaway[];
}

/**
 * The tribe/team someone was in during episode `number`: where they started, then every recorded
 * change up to and including that episode (a swap or the merge takes effect in the episode it's
 * recorded on). Null for no group.
 */
export function tribeAtEpisode(state: LeagueState, c: Castaway, number: number): string | null {
  // startTribeId is captured on someone's first move; absent means tribeId still is where they started.
  let tribeId = c.startTribeId !== undefined ? c.startTribeId : c.tribeId || null;
  for (const ep of [...state.episodes].filter((e) => e.number <= number).sort((a, b) => a.number - b.number)) {
    const move = (ep.groups || []).find((g) => g.castawayId === c.id);
    if (move) tribeId = move.tribeId;
  }
  return tribeId;
}

/** Still in the game for episode `number` (someone who left in it played it). */
function inGameFor(state: LeagueState, c: Castaway, number: number) {
  if (c.status !== "eliminated") return true;
  const exit = state.episodes.find((e) => e.id === c.exitEpisodeId);
  return !!exit && exit.number >= number;
}

/**
 * A castaway as they stood in this episode, for its Recap cards: someone who left in a LATER episode
 * was still playing then, so their card shouldn't carry that later exit's X or boot number.
 */
export function asOfEpisode(state: LeagueState, c: Castaway, ep: Episode): Castaway {
  if (c.status !== "eliminated") return c;
  const exit = state.episodes.find((e) => e.id === c.exitEpisodeId);
  if (!exit || exit.number <= ep.number) return c;
  return { ...c, status: "active", placementOrder: undefined, departedVia: null };
}

/**
 * The episode's headline wins (the format's `recap` list: Reward, Immunity...), from its scoring
 * events. Winners are grouped by the tribe they were in that episode, and a group shows as the tribe
 * when it won as one, before the merge: a tribe event (Survivor's tribe immunity and rewards -- even
 * if only some of the tribe got logged), or every member still in the game won it. Anyone else -- an individual win, part of a tribe picked for a reward -- shows on
 * their own. Wins with nobody logged are left out.
 */
export function episodeRecapWins(state: LeagueState, ep: Episode): RecapWin[] {
  const format = StateLogic.formatOf(state);
  const evs = StateLogic.ActiveRosterLogic.episodeEvents(state, ep);
  return (format.recap ?? [])
    .map((r) => {
      const winnerIds = new Set(evs.filter((e) => r.events.includes(e.type)).map((e) => e.castawayId));
      const tribeWinnerIds = new Set(evs.filter((e) => (r.tribeEvents ?? []).includes(e.type)).map((e) => e.castawayId));
      const winners = state.castaways.filter((c) => winnerIds.has(c.id)).map((c) => asOfEpisode(state, c, ep));
      const byTribe = new Map<string, Castaway[]>();
      const castaways: Castaway[] = [];
      for (const c of winners) {
        const tribeId = tribeAtEpisode(state, c, ep.number);
        if (tribeId) byTribe.set(tribeId, [...(byTribe.get(tribeId) ?? []), c]);
        else castaways.push(c);
      }
      // After the merge everyone's in one tribe, so a "tribe" win there is a team challenge split some
      // other way -- those winners show on their own.
      const inPlay = state.castaways.filter((c) => inGameFor(state, c, ep.number));
      const merged = new Set(inPlay.map((c) => tribeAtEpisode(state, c, ep.number))).size <= 1;
      const tribes: RecapWin["tribes"] = [];
      for (const [tribeId, members] of byTribe) {
        const tribe = state.tribes.find((t) => t.id === tribeId);
        const everyone = inPlay.filter((c) => tribeAtEpisode(state, c, ep.number) === tribeId);
        const asTribe =
          !!tribe &&
          !merged &&
          (members.some((c) => tribeWinnerIds.has(c.id)) || (members.length > 1 && everyone.every((c) => winnerIds.has(c.id))));
        if (asTribe) tribes.push({ tribe: tribe!, members });
        else castaways.push(...members);
      }
      return { label: r.label, tribes, castaways };
    })
    .filter((w) => w.tribes.length > 0 || w.castaways.length > 0);
}
