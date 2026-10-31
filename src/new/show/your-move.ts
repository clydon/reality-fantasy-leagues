import type { DraftGame, GameView, WaiverWeek } from "../data";
import { ordinal } from "../games";
import { paths } from "../routes";
import type { MovesTab } from "./moves";

// Your move in a game, as the Games tab's card under the game's name says it (the user, 2026-10-31: option D of the "Your moves
// on Games" canvas): what you've set or what's due, and one tap to it. The most pressing of a game's moves wins: anything due
// before anything already set, then a draft that isn't done, the mid-season draft (waivers: someone of yours to replace, your
// claim, optional swaps), the week's lineup or pick, and last a swap window set for a later episode. Nothing to show: null.
// Pure, for the tests.

export interface YourMove {
  /** What it's about (the card's data-your-move, for checks). */
  kind: "draft" | "waivers" | "swaps" | "lineup" | "pick";
  title: string;
  line: string;
  /** Castaways to show (ids of the game's cast), and which of them are out (shown faded). */
  faces: string[];
  out: string[];
  /** Empty places after them: a lineup or a team still to fill. */
  empty: number;
  action: string;
  /** It needs you now: the one yellow. */
  due: boolean;
  /** Your moves on this game's tab, or a page of its own (the draft room, Waivers). */
  go: { tab: MovesTab } | { href: string };
}

export interface MoveContext {
  seasonId: string;
  /** The show's word for an episode ("Episode", "Game"). */
  episode: string;
  /** A time as the app says it ("Wed 8:00 PM"): clock.ts airTime. */
  when: (iso: string) => string;
  draft?: DraftGame;
  waivers?: WaiverWeek;
}

const first = (name: string) => name.split(" ")[0];
const names = (xs: string[]) => (xs.length < 3 ? xs.join(" and ") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

/** This game's moves, most pressing first. */
export function movesOf(g: GameView, o: MoveContext): YourMove[] {
  if (g.over) return [];
  const E = o.episode;
  const castName = (id: string | null | undefined) => first(g.cast.find((c) => c.id === id)?.name ?? "someone");
  const found: YourMove[] = [];

  // The draft, until it's done (the room has the rest).
  const d = o.draft;
  if (d && d.phase !== "done" && d.you) {
    const href = `${paths.showPage(o.seasonId, d.kind === "blind" ? "blind" : "draft")}?game=${g.leagueId}`;
    const mine = d.teams.find((t) => t.playerId === d.you)?.castawayIds ?? [];
    const faces = mine.slice(0, 3);
    const room = { kind: "draft" as const, faces, out: [], empty: Math.max(0, Math.min(3, d.size) - faces.length), go: { href } };
    const seat = (id: string | undefined) => d.seats.find((s) => s.playerId === id)?.name ?? "Someone";
    if (d.revealFirst) {
      found.push({ ...room, title: `Reveal ${E} ${d.revealFirst} first`, line: "Who's left to draft depends on it", action: "Draft room", due: false });
    } else if (d.phase === "waiting") {
      const at = d.scheduledAt ? o.when(d.scheduledAt) : null;
      const place = d.turns.indexOf(d.you);
      found.push({
        ...room,
        title: at ? `Draft · ${at}` : "Draft · not started yet",
        line: d.kind === "blind" ? "Pick in private, reveal together" : place >= 0 ? `You pick ${ordinal(place + 1)} · star who you want first` : "Star who you want first",
        action: "Draft room",
        due: false,
      });
    } else if (d.kind === "blind") {
      const locked = d.locked.includes(d.you);
      const waiting = d.seats.length - d.locked.length;
      found.push(
        locked
          ? { ...room, title: "You're in", line: `Waiting for ${waiting} more · change until everyone's in`, action: "Edit", due: false }
          : { ...room, title: "Pick your team in private", line: "Reveal together once everyone's in", action: "Pick", due: true }
      );
    } else if (d.clock?.playerId === d.you) {
      const last = d.picks.at(-1);
      found.push({
        ...room,
        title: `Your turn · round ${d.clock.round}`,
        line: last?.castawayId ? `${first(seat(last.playerId))} just took ${castName(last.castawayId)}` : "First pick of the draft",
        action: "Draft",
        due: true,
      });
    } else {
      found.push({
        ...room,
        title: d.clock ? `${first(seat(d.clock.playerId))} is picking · round ${d.clock.round}` : "The draft is on",
        line: `Your team: ${mine.length} of ${d.size}`,
        action: "Draft room",
        due: false,
      });
    }
  }

  // The mid-season draft (waivers): someone of yours to replace, your claim, optional swaps. A week waiting on a reveal says
  // nothing here (it would hint at who left).
  const w = o.waivers;
  if (w && !w.revealFirst && w.stage === "open" && w.period) {
    const href = `${paths.showPage(o.seasonId, "waivers")}?game=${g.leagueId}`;
    const by = (id: string) => first((w.team.find((f) => f.id === id) ?? w.free.find((f) => f.id === id))?.name ?? castName(id));
    const closes = w.period.due ? o.when(w.period.due) : null;
    const stillIn = w.team.filter((f) => f.out == null).map((f) => f.id);
    if (w.replace.length && !w.nobodyFree) {
      const claims = w.replace.map((id) => ({ drop: id, add: w.spots.find((s) => s.dropId === id)?.addIds[0] ?? null }));
      if (claims.every((c) => c.add)) {
        const one = claims.length === 1;
        found.push({
          kind: "waivers",
          title: one ? `${by(claims[0].add!)} for ${by(claims[0].drop)}` : "Your claims are in",
          line: closes ? `Runs ${closes} · change until then` : "Change until it runs",
          faces: one ? [claims[0].drop, claims[0].add!] : claims.map((c) => c.add!).slice(0, 3),
          out: one ? [claims[0].drop] : [],
          empty: 0,
          action: "Edit",
          due: false,
          go: { href },
        });
      } else {
        found.push({
          kind: "waivers",
          title: `Replace ${names(w.replace.map(by))}`,
          line: closes ? `Claims close ${closes}` : "Pick who comes in",
          faces: [...w.replace, ...stillIn].slice(0, 3),
          out: w.replace,
          empty: 0,
          action: "Claim",
          due: true,
          go: { href },
        });
      }
    } else if (w.period.window && w.swapsLeft > 0) {
      found.push({
        kind: "swaps",
        title: "Optional swaps open",
        line: `${closes ? `Until ${closes} · ` : ""}swap up to ${w.swapsLeft}`,
        faces: stillIn.slice(0, 3),
        out: [],
        empty: 0,
        action: "Swap",
        due: false,
        go: { href },
      });
    }
  }

  // The week's lineup.
  const L = g.lineup;
  if (L && g.gameType === "active-roster") {
    const title = `Your ${E} ${L.episode} lineup`;
    const faces = L.starters.slice(0, L.slots);
    const lineup = { kind: "lineup" as const, faces, out: [], go: { tab: "lineup" as const } };
    if (g.revealFirst) {
      found.push({ ...lineup, faces: [], empty: 0, title: `Reveal ${E} ${g.revealFirst} first`, line: "Who went home decides who you can start", action: "Open", due: false });
    } else if (L.locked) {
      found.push({ ...lineup, empty: 0, title, line: "Locked at airtime · scores hidden until you reveal", action: "See", due: false });
    } else if (!L.set) {
      found.push({
        ...lineup,
        empty: Math.max(0, L.need - faces.length),
        title: `Set your ${E} ${L.episode} lineup`,
        line: L.airsAt ? `Locks ${o.when(L.airsAt)}${L.carried ? " · last week's stands in till then" : ""}` : "Locks at airtime",
        action: "Set",
        due: true,
      });
    } else {
      found.push({ ...lineup, empty: 0, title, line: L.airsAt ? `Change until ${o.when(L.airsAt)}` : "Change until airtime", action: "Edit", due: false });
    }
  }

  // The week's pick.
  const P = g.pick;
  if (P && g.gameType === "pickem") {
    const pick = { kind: "pick" as const, out: [], go: { tab: "pool" as const } };
    if (g.revealFirst) {
      found.push({ ...pick, faces: [], empty: 0, title: `Reveal ${E} ${g.revealFirst} first`, line: "Who went home decides who you can pick", action: "Open", due: false });
    } else if (!P.open) {
      if (P.pick) found.push({ ...pick, faces: [P.pick], empty: 0, title: `Your ${E} ${P.episode} pick: ${castName(P.pick)}`, line: "Locked at airtime", action: "See", due: false });
    } else if (!P.pick) {
      found.push({ ...pick, faces: [], empty: 1, title: `Pick a survivor for ${E} ${P.episode}`, line: P.airsAt ? `Locks ${o.when(P.airsAt)}` : "Locks at airtime", action: "Pick", due: true });
    } else {
      found.push({
        ...pick,
        faces: [P.pick],
        empty: 0,
        title: `Your ${E} ${P.episode} pick: ${castName(P.pick)}`,
        line: P.airsAt ? `Change until ${o.when(P.airsAt)}` : "Change until airtime",
        action: "Edit",
        due: false,
      });
    }
  }

  // Last, a swap window set for a later episode (a merge swap). Replacing someone after any episode isn't shown until it happens.
  const lanes = w?.how.lanes;
  if (w && lanes && w.stage !== "open") {
    const at = lanes.episodes.findIndex((n, i) => n > lanes.now && lanes.swap[i]);
    if (at >= 0) {
      found.push({
        kind: "swaps",
        title: `Swaps open after ${E} ${lanes.episodes[at]}`,
        line: "Swap castaways on your team then",
        faces: w.team.filter((f) => f.out == null).map((f) => f.id).slice(0, 3),
        out: [],
        empty: 0,
        action: "How",
        due: false,
        go: { href: `${paths.showPage(o.seasonId, "waivers")}?game=${g.leagueId}` },
      });
    }
  }

  // Due first; otherwise the order above.
  return [...found.filter((m) => m.due), ...found.filter((m) => !m.due)];
}

/** The card for a game: its most pressing move, or null. */
export function yourMove(g: GameView, o: MoveContext): YourMove | null {
  return movesOf(g, o)[0] ?? null;
}
