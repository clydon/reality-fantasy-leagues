import { useMemo } from "react";
import type * as SportsModule from "@/lib/game/start-gallery/sports.js";
import type { Base, Cat, Spec } from "@/lib/game/start-gallery/index.js";
import type { Pack } from "@/lib/game/game-words/index.js";
import type { SpecContext } from "@/lib/game/game-spec/index.js";
import { useTeamSchedule } from "../../data";
import { withSpan, type Span } from "./model";

// A sport through the same gallery as a show (the user, 2026-11-18: "the sport create a game should at least feel and navigate just
// like the show even if its technincally different"). The sports catalog (src/lib/game/start-gallery/sports.json, sports.js) gives
// each game type a sport's fans know, with our check's verdict on this page and the game ready to open; this adapter turns them
// into the gallery's own bases and verdicts, so every screen (the shelves, the lead tiles, a game's screen, Start) is the show's.
// A game type that plays on another page (a season-long league from a team's page) stays on the shelf, dashed, saying where.

type SM = typeof SportsModule;

export interface SportView {
  league: string;
  family: string | null;
  pack: Pack | null;
  cats: Cat[];
  bases: Base[];
  verdicts: Map<string, { id: string; state: "plays" | "off" | "coming" | "needs"; why: string | null; fitted: { each: number; to: number | "shared"; pool: number; people: number } | null }>;
  /** Each game ready to open: its span set, fitted to who's left. */
  specs: Map<string, Spec>;
}

/** A sport's game types drawn with the show gallery's pictograms, by what they are. */
export const SPORT_ICON: Record<string, string> = {
  "sp-league": "fantasy",
  "sp-points": "fantasy",
  "sp-bestball": "bestball",
  "sp-cats": "s-cats",
  "sp-roto": "s-roto",
  "sp-guillotine": "guillotine",
  "sp-keeper": "keeper",
  "sp-dynasty": "keeper",
  "sp-auction": "auction",
  "sp-cap": "cap",
  "sp-week-draft": "fantasy",
  "sp-game-draft": "fantasy",
  "sp-playoff-draft": "trophy",
  "sp-pickem": "picks",
  "sp-pickem-team": "picks",
  "sp-confidence": "confidence",
  "sp-h2h-pickem": "h2hpicks",
  "sp-ats": "overunder",
  "sp-survivor": "pool",
  "sp-pick-a-few": "objectives",
  "sp-scorer-pool": "most",
  "sp-hr-pool": "most",
  "sp-streak": "lives",
  "sp-props": "props",
  "sp-ou": "overunder",
  "sp-totals": "overunder",
  "sp-margin": "split",
  "sp-score": "quote",
  "sp-first-scorer": "calls",
  "sp-squares": "s-squares",
  "sp-bank": "bank",
  "sp-parlay": "parlay",
  "sp-bracket": "s-bracket",
  "sp-cup-bracket": "s-bracket",
  "sp-weeks": "teams",
  "sp-live": "livecalls",
};
export const sportIcon = (id: string) => SPORT_ICON[id] ?? (id.startsWith("ev-") ? "trophy" : "sheet");


/** A sport's categories in its fans' words, the chip saying what its heading says. */
const CAT_WORDS: Record<string, { short: string; name: string }> = {
  pools: { short: "Pick'em", name: "Pick'em and pools" },
  predict: { short: "Props", name: "Props and predictions" },
  bets: { short: "Betting", name: "Squares and betting" },
};

export function sportView(sm: SM, page: { ctx: SpecContext; pack?: Pack }, league: string): SportView {
  // `all`: the game types made for another page too (a season-long league on a team's page), each saying which page it's for.
  const vs = sm.sportGallery(page, { league, all: true });
  const bases: Base[] = [];
  const verdicts: SportView["verdicts"] = new Map();
  const specs = new Map<string, Spec>();
  for (const v of vs) {
    // A game type for another page is still on the shelf (a fan looking for it here finds where it plays), dashed with why.
    const elsewhere = v.state === "elsewhere";
    bases.push({ id: v.id, cat: v.cat, name: v.name, aka: (v as { aka?: string[] }).aka ?? [], plain: v.plain, about: v.about, effort: v.effort, len: v.len, ref: "", spec: v.spec ?? null, coming: v.state === "coming" ? v.gap ?? v.why ?? "Coming" : undefined, needs: elsewhere ? v.why ?? "Plays on the league's whole season" : v.needs ?? undefined } as unknown as Base);
    const state: "plays" | "off" | "coming" | "needs" = v.state === "elsewhere" ? "needs" : v.state;
    verdicts.set(v.id, { id: v.id, state, why: elsewhere ? v.why ?? "Plays on the league's whole season" : v.why, fitted: v.fitted });
    if (v.spec && !elsewhere) specs.set(v.id, v.spec);
  }
  const cats = (sm.SPORT_CATS as unknown as Cat[]).map((c) => ({ ...c, ...(CAT_WORDS[c.id] ?? {}) }));
  return { league, family: sm.familyOf(league), pack: (page.pack as Pack | undefined) ?? null, cats, bases, verdicts, specs };
}

/** The sport's next game to play, from its page's games: the ready plate's game. */
export function nextGame(pack: Pack | null) {
  return (pack?.games ?? []).find((g) => !g.started) ?? null;
}

/** A game's two sides in a fan's order ("Cowboys at Eagles"): the visitors first. */
export function sidesOf(g: { sides: { name: string; home?: true }[] }, short?: (name: string, id?: string) => string): string {
  const say = (s: { name: string; id?: string }) => (short ? short(s.name, s.id) : s.name);
  const home = g.sides.find((s) => s.home);
  const away = g.sides.find((s) => !s.home);
  return home && away ? `${say(away)} at ${say(home)}` : g.sides.map(say).join(" vs ");
}

export interface Mark {
  abbr: string;
  color: string | null;
  short: string;
}
const lastWord = (name: string) => name.trim().split(/\s+/).pop() ?? name;
/** The page's teams as the app's own marks (TeamMark: the city's code on the team's colour), from the team's schedule (ESPN's list);
 *  until it answers, each team's name. */
export function useTeamMarks(sport: SportView | null): Map<string, Mark> {
  const team = sport?.pack?.teams?.[0]?.id ?? null;
  const q = useTeamSchedule(sport?.league ?? null, team);
  return useMemo(() => {
    const m = new Map<string, Mark>();
    for (const t of sport?.pack?.teams ?? []) m.set(t.id, { abbr: lastWord(t.name).slice(0, 3).toUpperCase(), color: null, short: lastWord(t.name) });
    const d = q.data;
    if (d) {
      m.set(d.team.id, { abbr: d.team.abbreviation ?? lastWord(d.team.name).slice(0, 3).toUpperCase(), color: d.team.color, short: d.team.short });
      for (const g of d.games) if (g.opponent) m.set(g.opponent.id, { abbr: g.opponent.abbreviation ?? lastWord(g.opponent.name).slice(0, 3).toUpperCase(), color: g.opponent.color, short: g.opponent.short });
    }
    return m;
  }, [sport, q.data]);
}

// ---------- Make it…, a sport's way (U0's goals, by its own game types: the same buttons as a show's) ----------

type SportGoal = "comp" | "casual" | "score";
const SWAPS: Record<SportGoal, Record<string, [string, string][]>> = {
  comp: {
    "sp-pickem-team": [["sp-margin", "pick the winner and the margin"], ["sp-props", "three calls: the winner, the top scorer, the total"]],
    "sp-pickem": [["sp-confidence", "rank your picks by how sure you are"], ["sp-h2h-pickem", "your picks against a friend's each week"]],
    "sp-pick-a-few": [["sp-game-draft", "a draft: nobody shares a player"]],
    "sp-props": [["sp-parlay", "a parlay: all right pays more"]],
    "sp-bank": [["sp-parlay", "a parlay: all right pays more"]],
    "sp-league": [["sp-guillotine", "the lowest each week is out"]],
    "sp-points": [["sp-league", "head to head each week"]],
    "sp-bestball": [["sp-league", "set a lineup each week"]],
  },
  casual: {
    "sp-game-draft": [["sp-pick-a-few", "just pick a few players, no draft"]],
    "sp-margin": [["sp-pickem-team", "just pick who wins"]],
    "sp-props": [["sp-pickem-team", "just pick who wins"]],
    "sp-parlay": [["sp-bank", "single bets, no parlay"]],
    "sp-confidence": [["sp-pickem", "plain pick'em, no ranking"]],
    "sp-league": [["sp-bestball", "best ball: no lineups to set"]],
    "sp-guillotine": [["sp-bestball", "best ball: nobody's cut"]],
    "sp-cats": [["sp-points", "points, not categories"]],
  },
  score: {
    "sp-pickem-team": [["sp-ou", "over or under the total instead"]],
    "sp-props": [["sp-ou", "just the total, over or under"]],
    "sp-ou": [["sp-margin", "the winner and the margin"]],
    "sp-margin": [["sp-ou", "over or under the total instead"]],
    "sp-league": [["sp-cats", "categories, not points"]],
    "sp-cats": [["sp-roto", "roto: rank in every stat"]],
    "sp-points": [["sp-cats", "categories, not points"]],
    "sp-squares": [["sp-bank", "a betting pool on the game"]],
    "sp-game-draft": [["sp-pick-a-few", "a few picks scored the same way"]],
  },
};

/** A sport's next step for a goal: another of its game types that plays here, or null. */
export function sportStep(goal: SportGoal, base: Base, sport: SportView, span: Span): { says: string; base: Base; spec: Spec } | null {
  for (const [id, says] of SWAPS[goal][base.id] ?? []) {
    const v = sport.verdicts.get(id);
    const spec = sport.specs.get(id);
    const b = sport.bases.find((x) => x.id === id);
    if (v?.state === "plays" && spec && b) return { says, base: b, spec: withSpan(spec, span) };
  }
  return null;
}
