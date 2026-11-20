"use client";

import { useCallback } from "react";
import { lockIn as locks, useAfterSave, type GameView } from "../data";
import { gameColour } from "../games";
import type { ShowData } from "../screens/show-space";
import { toast } from "../ui/toast";
import type { MovesTab } from "./moves";
import { GAME_NAMES } from "@/lib/server/league-season";

// Episode night (docs/design-round/strip-night-spec.md, -first-view.md, -shape.md; the user's report from Survivor 51's Ep 9 night,
// 2026-11-18, their pick, look C with Lock in in its first row, built 2026-11-19): while your moves stay open after airtime (a live or
// own-pace game, an episode you haven't watched), Tonight's strip is a plate, a row a game, and every other tab keeps the one-line
// strip with who you've got. Saying you've started watching (Lock in, Your moves' "Yes, I'm watching", Watch along) closes your moves
// for that episode in every game you play on the season, on the server (StateLogic.GhostLogic.lockIn; GameView.watching), undoable
// for a moment only.

/** The episode you've said you're watching (GameView.watching: the server's lock), your moves for it closed in every game. Null:
 *  none. */
export function lockedInEpisode(show: ShowData): number | null {
  const eps = (show.play ?? []).filter((g) => g.watching != null && !g.archived && !g.stageOf).map((g) => g.watching!);
  return eps.length ? Math.min(...eps) : null;
}

/**
 * Lock in for episode `n`: your moves for it close in every game you play on the season, then the games read again, and the toast
 * says `said` with Undo (the server takes it back within a minute only: a mis-tap, never a change of heart mid-episode). Resolves
 * whether it locked; a refusal is said quietly.
 */
export function useLockIn(seasonId: string) {
  const after = useAfterSave();
  return useCallback(
    async (n: number, said: string): Promise<boolean> => {
      try {
        await locks.start(seasonId, n);
      } catch (e) {
        toast.quiet(e instanceof Error ? e.message : "Couldn't lock in");
        return false;
      }
      await after();
      toast(said, {
        undo: () => {
          void locks.undo(seasonId, n).then(after, (e) => toast.quiet(e instanceof Error ? e.message : "Couldn't undo"));
        },
      });
      return true;
    },
    [seasonId, after]
  );
}

/** The episode your window is open on (the earliest, if games differ): an episode that's aired or is on, that you haven't watched,
 *  whose moves a live or own-pace game still takes from you. Null: no window. */
export function windowEpisode(show: ShowData): number | null {
  const eps = (show.play ?? []).filter((g) => g.late && !g.archived && !g.stageOf).map((g) => g.late!.episode);
  return eps.length ? Math.min(...eps) : null;
}

export interface NightFace {
  id: string;
  name: string;
  photo: string | null;
}

/** One game's move for the night's episode, as the strip draws it. */
export interface NightGroup {
  key: string;
  leagueId: string;
  /** The game, as Your games names it. */
  name: string;
  /** Its colour, for its dot (a fill: the raw colour). */
  colour: string;
  tab: MovesTab;
  /** "replace": someone of yours who left, owed a replacement (a waiver claim, due by its own time): their face, then the gap. */
  kind: "lineup" | "pick" | "replace";
  /** Where a replacement is made (the waivers page): it isn't a tab of Your moves. */
  href?: string;
  /** A replacement's: whoever left, by first name (words only: the strip draws the empty place, never their face, which would
   *  read as a locked one). */
  left?: string;
  /** The lineup's starters, or the pick. */
  faces: NightFace[];
  /** Places still empty: a lineup's open slots, a pick not made. */
  open: number;
  /** Something of yours here is due (the home's moves list it). */
  due: boolean;
  /** Its moves for the episode are locked for you. */
  locked: boolean;
}

/** Your moves for episode `n`, game by game: a lineup's starters and its open slots, a pick or its empty place, then anyone owed a
 *  replacement (`replace`: the pickup moves due, from the home's list). `due`: the games with a move due (by league). A game with
 *  no move for that episode (an Outlast team) isn't drawn unless it owes you a replacement. */
export function nightGroups(show: ShowData, n: number, due: Set<string>, replace: { leagueId: string; href: string }[] = []): NightGroup[] {
  const play = (show.play ?? []).filter((g) => !g.stageOf && !g.archived && !g.over);
  const twin = (g: GameView) => play.filter((x) => x.gameType === g.gameType).length > 1;
  const out: NightGroup[] = [];
  for (const g of play) {
    const name = twin(g) && g.name !== g.gameName ? g.name : (GAME_NAMES[g.gameName] ?? g.gameName);
    const face = (id: string): NightFace => {
      const c = g.cast.find((x) => x.id === id);
      return { id, name: c?.name ?? "", photo: c?.photo ?? null };
    };
    const base = { leagueId: g.leagueId, name, colour: gameColour(g.gameName), due: due.has(g.leagueId) };
    const L = g.lineup;
    if (L && L.episode === n) {
      const starters = L.starters.slice(0, L.slots);
      out.push({ ...base, key: `lineup-${g.leagueId}`, tab: "lineup", kind: "lineup", faces: starters.map(face), open: L.locked ? 0 : Math.max(0, L.need - starters.length), locked: L.locked });
    }
    const P = g.pick;
    if (P && P.episode === n) {
      const picks = P.picks.length ? P.picks : P.pick ? [P.pick] : [];
      out.push({ ...base, key: `pick-${g.leagueId}`, tab: "pool", kind: "pick", faces: picks.map(face), open: P.open ? Math.max(0, (P.each ?? 1) - picks.length) : 0, locked: !P.open });
    }
  }
  for (const r of replace) {
    const g = play.find((x) => x.leagueId === r.leagueId);
    if (!g) continue;
    // The castaway who left, from the move's own link (`?drop=<id>`), as the claim page reads it.
    const id = decodeURIComponent(/[?&]drop=([^&]+)/.exec(r.href)?.[1] ?? "");
    const c = g.cast.find((x) => x.id === id);
    const name = twin(g) && g.name !== g.gameName ? g.name : (GAME_NAMES[g.gameName] ?? g.gameName);
    out.push({ key: `replace-${g.leagueId}`, leagueId: g.leagueId, name, colour: gameColour(g.gameName), tab: "outlast", kind: "replace", href: r.href, faces: [], left: c ? firstName(c.name) : undefined, open: 1, due: true, locked: false });
  }
  return out;
}

const firstName = (name: string) => name.split(" ")[0];
const names = (xs: string[]) => (xs.length < 3 ? xs.join(" and ") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

/** Who you've got, in words, every game: "Starting Kristin, Sam and Joe · picked Maggie" (A's locked line). */
export function whoWords(groups: NightGroup[]): string | null {
  const parts = groups
    .filter((g) => g.faces.length && g.kind !== "replace")
    .map((g, i) => {
      const who = names(g.faces.map((f) => firstName(f.name)).filter(Boolean));
      return g.kind === "lineup" ? `${i ? "starting" : "Starting"} ${who}` : `${i ? "picked" : "Picked"} ${who}`;
    });
  return parts.length ? parts.join(" · ") : null;
}

/** A game's dot on the strip: its colour, deepened on the white plate so it holds 3:1 there (the bright one is under it). */
export const dotColour = (g: NightGroup, plate: boolean) => (plate ? `color-mix(in oklab, ${g.colour} 68%, var(--plate-foreground))` : g.colour);

/** The strip's name for a screen reader: the episode, the sentence, then each game's people. */
export function nightLabel(tag: string, sentence: string, groups: NightGroup[], line?: string | null): string {
  const parts = groups.map((g) => {
    const who = g.faces.map((f) => firstName(f.name)).filter(Boolean);
    if (g.kind === "replace") return `${g.name}: ${g.left ?? "someone"} left, a replacement to pick`;
    const gaps = g.open ? `${g.open} ${g.kind === "lineup" ? (g.open === 1 ? "open slot" : "open slots") : "pick to make"}` : "";
    return `${g.name}${g.locked ? " (locked)" : ""}: ${[who.length ? names(who) : "", gaps].filter(Boolean).join(", ") || "nothing yet"}`;
  });
  return [tag, sentence, line, ...parts].filter(Boolean).join(". ") + ".";
}
