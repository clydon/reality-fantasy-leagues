"use client";

import { artInUse } from "@/lib/sports/league-art";
import { teamKeyOf } from "@/lib/sports/team-badge";
import type { ShowData } from "../screens/show-space";
import { useHome, useLeagueArt, type GameView } from "../data";
import { useTeamPictures } from "../ui/team-pictures";

// A sports game's artwork (the user, 2026-11-23: "make sure the game's artwork either uses the teams logos we have or the league
// artwork"). The app never draws a league's or a team's own logo (docs/PLAN-team-logos.md): the logos "we have" are the ones a
// couch uploaded for its teams (couch-pictures.ts), seen only by that couch.
//   - a one-game game: both teams' pictures, away then home, when the couch has both;
//   - a game over a team's season: that team's picture, when the couch has it;
//   - else the league's art as you see it in Your shows (league-art.ts artInUse: yours, the couch's, else the league's photo).
// A show's game keeps its show's art (null here: the caller's own).

/** `logos`: the couch's pictures, drawn as their own row over the league's photo (`photo`, when its read is in). */
export type GameArt = { kind: "logos"; srcs: string[]; photo: { src: string; position: string } | null } | { kind: "photo"; src: string; position: string } | null;

export function useGameArt(show: ShowData, g: GameView): GameArt {
  const pictures = useTeamPictures();
  const league = show.header?.sportsLeague ?? null;
  const home = useHome().data;
  const artQ = useLeagueArt(league ? (show.couch?.id ?? null) : null);
  if (!league) return null;
  const a = home && artQ.isFetched ? artInUse(league, artQ.data, home.user).art : null;
  const photo = a ? { src: a.src, position: a.position } : null;
  const names = show.header?.gameNames ?? {};
  const picture = (id: string | undefined) => (id ? (pictures[teamKeyOf(league, id)] ?? null) : null);
  const one = g.from !== null && g.from === g.to ? names[g.from] : undefined;
  if (one?.sides?.length === 2) {
    const srcs = one.sides.map(picture);
    if (srcs.every((x): x is string => !!x)) return { kind: "logos", srcs, photo };
  } else {
    // A team's season: its team is in every game's sides.
    const all = Object.values(names).map((x) => x.sides ?? []);
    const team = all[0]?.find((id) => all.every((s) => s.includes(id)));
    const src = picture(team);
    if (src && all.length > 1) return { kind: "logos", srcs: [src], photo };
  }
  return photo ? { kind: "photo", ...photo } : null;
}
