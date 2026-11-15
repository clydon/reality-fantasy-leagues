import type { GameView, TableRow } from "../data";
import { ordinal } from "../games";

// This week on a game's own page (the design round's step 2: docs/design-round/step2-game-page-spec.md, "This week, by
// situation"; the first view's requirements, step2-game-page-first-view.md): the one block that changes with the situation.
// Head to head reads as a matchup (you and this week's opponent, each with their record, the score once there is one, the
// starters once they're locked); any other game as your place and the gap; solo as your own season. Its state line is the only
// words in the first view that change from one situation to the next (R4). Pure, for the tests.

export interface WeekSide {
  playerId: string;
  userId: string | null;
  name: string;
  /** "2–1", "1–1–1" (a tie only when there is one); null outside head to head. */
  record: string | null;
  /** Their playoff seed, once seeded. */
  seed: number | null;
}

export type WeekTone = "due" | "set" | "locked" | "early" | "behind" | "waiting" | "out" | "over" | "plain";

export interface WeekCard {
  kind: "matchup" | "standing" | "solo";
  /** "Ep 4 · Sun 8:00 PM", "The final · Ep 7", "Season over". */
  label: string;
  you: WeekSide;
  /** Who you play (null: nobody this week, a bye or the median, or not head to head). */
  them: WeekSide | null;
  stand: "median" | "bye" | null;
  /** What's true right now, in a line (R4: it alone changes with the situation). */
  state: string;
  tone: WeekTone;
  /** A score to show: the week's points so far, or the result. */
  score: { you: string; them: string; early: boolean } | null;
  /** Your starters (cast ids) to show as faces; theirs once the lineups lock ("hidden" before; null when there's no opponent). */
  mine: string[] | null;
  theirs: string[] | "hidden" | null;
  /** Last week in a line, once it's in and you've seen it: "Ep 3 · Lost to Bo · 0–3". */
  last: { episode: number; line: string; result: "win" | "loss" | "tie" | "quiet" | "final"; playerId?: string } | null;
  /** The season's champion, once there is one. */
  champion: WeekSide | null;
  /** The week the card's matchup sheet opens on. */
  episode: number | null;
}

export interface WeekContext {
  /** The show's word for an episode and its short form ("Episode", "Ep"; "Game", "G"). */
  words: { episode: string; ep: string };
  /** When the next episode airs ("Sun 8:00 PM"), and its number. */
  next: { number: number; when: string | null } | null;
  /** The move the page offers, as yourMove says it (its kind, and whether it's due). */
  move: { kind: string; due: boolean } | null;
  /** Your viewing mark on this show. */
  seen: number | null;
  /** Both sides' starters once the week's lineups have locked (week-view.ts lockedMatchup). */
  locked: { episode: number; mine: string[]; theirs: string[] | null } | null;
  /** The show's next episode to reveal (early or final results in, past your mark), and the latest that's aired: own pace keeps a
   *  game's copy at your mark, so what's waiting is the show's to say (season-episodes.ts). */
  reveal: { episode: number; stage: "early" | "final" } | null;
  aired: number;
  /** A row's total in the game's own measure ("19 pts", "3 weeks won", "4 lines": game-sheets.tsx totalWords); points without it. */
  total?: (r: TableRow) => string;
  /** A week of games locking at each one's start, once its first has begun: "Under way · all locked by Sun 4:25 PM" (BACKLOG 80),
   *  said in place of an air time already past. */
  underWay?: string | null;
}

const fmt = (n: number) => String(Math.round(n * 10) / 10).replace("-", "\u2212");

/** A score: "6–2"; "−3 to 0" when either side is below zero (a dash between a minus and a number reads as one). */
export function scoreWords(a: number, b: number | null): string {
  if (b === null) return fmt(a);
  return a < 0 || b < 0 ? `${fmt(a)} to ${fmt(b)}` : `${fmt(a)}–${fmt(b)}`;
}
const first = (name: string) => name.split(" ")[0];

/** A record as the table says it: wins, losses, and ties only when there are some. */
export function recordWords(r: TableRow["record"]): string | null {
  if (!r) return null;
  return `${r.wins}–${r.losses}${r.ties ? `–${r.ties}` : ""}`;
}

function sideOfRow(r: TableRow): WeekSide {
  return { playerId: r.playerId, userId: r.userId, name: r.you ? "You" : first(r.name), record: recordWords(r.record), seed: r.record?.seed ?? null };
}

/** A one-game game (a team's next game: a span of one week): its page leads with the game and its result, never a season's words
 *  ("Season over", a record, a place, a grid of one column). */
export const oneGame = (g: GameView) => g.from !== null && g.to !== null && g.to === g.from;

export function thisWeek(g: GameView, c: WeekContext): WeekCard | null {
  const me = g.you;
  if (!me) return null;
  const single = oneGame(g);
  const sideOf = (r: TableRow): WeekSide => (single ? { ...sideOfRow(r), record: null, seed: null } : sideOfRow(r));
  const you = sideOf(me);
  const E = c.words.ep;
  const row = (id: string | null | undefined) => (id ? (g.table.find((r) => r.playerId === id) ?? null) : null);
  const champ = g.table.find((r) => r.record?.champion) ?? null;
  const solo = g.players <= 1 || g.solo === "practice";
  const nextEp = g.lineup?.episode ?? g.pick?.episode ?? c.next?.number ?? null;
  const when = c.underWay ?? (c.next && c.next.number === nextEp && c.next.when ? `Airs ${c.next.when}` : null);
  const due = !!c.move?.due;
  const caught = g.catchUp && g.catchUp.latest >= g.catchUp.week ? g.catchUp.week : null;
  const waitingEp = g.revealFirst ?? caught ?? (c.reveal && c.reveal.episode > (c.seen ?? 0) ? c.reveal.episode : null);
  const latest = caught !== null ? g.catchUp!.latest : c.aired;
  const behind = waitingEp !== null;
  const early = behind && c.reveal?.stage === "early" && c.reveal.episode === waitingEp;

  // ---- head to head ----
  const m = g.matchups;
  if (m && !solo) {
    const last = m.last && m.last.points !== null ? lastLine(g, m.last, E) : null;
    if (g.over && single && m.last && m.last.points !== null) {
      // The game's result is the card: both sides, the score, who won and by how much.
      const l = m.last;
      const opp = row(l.opponent);
      const by = fmt(Math.abs(l.points! - (l.against ?? 0)));
      const state =
        l.result === "win" ? `You won by ${by}` : l.result === "loss" ? `${opp ? first(opp.name) : "They"} won by ${by}` : l.result === "tie" ? "A tie" : "Counted for nobody";
      return {
        kind: "matchup",
        label: `${E} ${l.episode} · Final`,
        you,
        them: opp ? sideOf(opp) : null,
        stand: l.stand ?? null,
        state,
        tone: "over",
        score: { you: fmt(l.points!), them: l.against === null ? "–" : fmt(l.against), early: false },
        mine: null,
        theirs: null,
        last: null,
        champion: null,
        episode: l.episode,
      };
    }
    if (g.over && single) {
      // Over without a result (called off): said once, no season's words.
      return { kind: "standing", label: "Final", you, them: null, stand: null, state: "It wasn't played: it counts for nobody", tone: "over", score: null, mine: null, theirs: null, last: null, champion: null, episode: m.last?.episode ?? null };
    }
    if (g.over) {
      const won = champ?.you;
      const fin = m.playoffs?.bracket.at(-1)?.games[0];
      const finLine: WeekCard["last"] =
        fin && fin.winner && fin.a && fin.b && fin.aPoints !== null && fin.bPoints !== null
          ? (() => {
              const w = fin.winner === fin.a ? fin.a : fin.b, l = fin.winner === fin.a ? fin.b! : fin.a!;
              const [wp, lp] = fin.winner === fin.a ? [fin.aPoints!, fin.bPoints!] : [fin.bPoints!, fin.aPoints!];
              const name = (id: string) => (id === me.playerId ? "You" : first(row(id)?.name ?? "someone"));
              const ep = m.playoffs!.bracket.at(-1)!.episode;
              return { episode: ep, line: `${E} ${ep} · The final · ${name(w)} beat ${name(l) === "You" ? "you" : name(l)} · ${scoreWords(wp, lp)}`, result: w === me.playerId ? "win" : l === me.playerId ? "loss" : "final" };
            })()
          : null;
      const place = me.rank.startsWith("T") ? `tied ${ordinal(Number(me.rank.slice(1)))}` : ordinal(me.place);
      return {
        // Without a champion (no playoffs) there's nobody to face: your place, not a matchup against a bye.
        kind: champ ? "matchup" : "standing",
        label: "Season over",
        you,
        them: null,
        stand: null,
        state: won ? `You won the season · ${you.record}` : `You finished ${place} · ${you.record}`,
        tone: "over",
        score: null,
        mine: null,
        theirs: null,
        last: finLine ?? last,
        champion: champ ? sideOf(champ) : null,
        episode: finLine?.episode ?? m.last?.episode ?? null,
      };
    }
    const next = m.next;
    const opp = row(next?.opponent);
    const them = opp ? sideOf(opp) : null;
    const po = m.playoffs;
    const seeded = !!po?.seeds?.length;
    const round = next?.round ?? null;
    const roundName = round === null ? null : po && round >= po.rounds ? "The final" : `Playoffs · round ${round}`;
    const label = [roundName, next ? `${E} ${next.episode}` : nextEp !== null ? `${E} ${nextEp}` : null, roundName ? null : when].filter(Boolean).join(" · ");
    // Out of the playoffs once they're seeded (said as such, never OUT): the final's two still shown, small.
    if (seeded && !me.record?.alive && !next) {
      const place = me.rank.startsWith("T") ? `tied ${ordinal(Number(me.rank.slice(1)))}` : ordinal(me.place);
      const bracket = po?.bracket.at(-1) ?? null;
      const fin = bracket?.games[0] ?? null;
      const a = row(fin?.a ?? null), b = row(fin?.b ?? null);
      const seedOf = (r: TableRow | null) => (r?.record?.seed ? ` (${r.record.seed})` : "");
      const finalLine: WeekCard["last"] =
        a && b && bracket
          ? { episode: bracket.episode, line: `${E} ${bracket.episode} · The final · ${first(a.name)}${seedOf(a)} vs ${first(b.name)}${seedOf(b)}`, result: "final", playerId: a.playerId }
          : last;
      return {
        kind: "standing",
        label: po && po.rounds === 1 ? `The final · ${E} ${po.from}` : `The playoffs · from ${E} ${po?.from}`,
        you,
        them: null,
        stand: null,
        state: `You missed the playoffs · ${place} · ${you.record}`,
        tone: "out",
        score: null,
        mine: null,
        theirs: null,
        last: finalLine,
        champion: null,
        episode: null,
      };
    }
    const lock = c.locked && next && c.locked.episode === next.episode ? c.locked : null;
    const theirsBefore = next?.opponent ? "hidden" : null;
    const mine = lock ? lock.mine : g.lineup && g.lineup.episode === next?.episode ? g.lineup.starters : null;
    let state: string;
    let tone: WeekTone;
    if (behind) {
      const w = waitingEp as number;
      const more = latest > w && !early ? `${E} ${w} ${latest === w + 1 ? "and" : "to"} ${latest} are` : `${E} ${w}'s ${early ? "early results are" : "results are"}`;
      state = `You're up to ${E} ${w - 1}. ${more} waiting for you.`;
      tone = early ? "early" : "behind";
    } else if (c.move && c.move.kind !== "lineup" && c.move.kind !== "pick") {
      state = "";
      tone = due ? "due" : "waiting";
    } else if (g.lineup?.locked && g.lineup.lockedBy && g.lineup.episode === next?.episode) {
      // Locked by its day's or week's first game, before its own (BACKLOG 76): what locked it, said once.
      state = `Locked when the ${g.lineup.lockedBy}'s first game began · it plays as it stands`;
      tone = "locked";
    } else if (lock) {
      state = "Lineups locked · results when they're in";
      tone = "locked";
    } else if (g.lineup && !g.lineup.set) {
      state = g.lineup.carried ? "Your lineup isn't set · last week's stands in till then" : "Your lineup isn't set";
      tone = due ? "due" : "plain";
    } else if (g.lineup?.set) {
      state = opp ? `You're set · ${them?.name}'s shows when it locks` : "You're set";
      tone = "set";
    } else {
      state = "";
      tone = "plain";
    }
    // Last week's opponent hasn't watched it yet (own pace): you may see your result; say they haven't.
    const lastOpp = m.last ? row(m.last.opponent) : null;
    const lastBehind = !behind && lastOpp && m.last && g.pace?.others.some((o) => o.name === lastOpp.name && o.week !== null && o.week <= m.last!.episode);
    if (lastBehind && last) last.line += ` · ${first(lastOpp!.name)} hasn't watched it yet`;
    return {
      kind: "matchup",
      label,
      you,
      them,
      stand: next?.stand ?? null,
      state,
      tone,
      score: null,
      mine,
      theirs: lock ? (lock.theirs ?? null) : theirsBefore,
      last: behind ? null : last,
      champion: null,
      episode: next?.episode ?? null,
    };
  }

  // ---- solo, and every other game: your place and the gap ----
  const total = g.plays.kind === "result" ? recordWords(me.record) : c.total ? c.total(me) : `${fmt(me.total)} pts`;
  if (solo) {
    const best = me.weeks.length ? Math.max(...me.weeks.map((w) => w.total)) : null;
    return {
      kind: "solo",
      label: [nextEp !== null ? `${E} ${nextEp}` : null, when].filter(Boolean).join(" · "),
      you,
      them: null,
      stand: null,
      state: [`${total} so far`, best !== null ? `best week ${fmt(best)}` : null].filter(Boolean).join(" · "),
      tone: due ? "due" : behind ? "behind" : "plain",
      score: null,
      mine: g.lineup?.starters ?? null,
      theirs: null,
      last: null,
      champion: null,
      episode: me.weeks.at(-1)?.episode ?? null,
    };
  }
  const above = g.table.find((r) => r.place === me.place - 1) ?? g.table.find((r) => r.place < me.place && !r.you) ?? null;
  // The gap in what the game ranks by: weeks won, or points.
  const count = (r: TableRow) => (g.weeksWon ? (g.weeksWon[r.playerId] ?? 0) : r.total);
  const gap = above && g.plays.kind !== "result" ? count(above) - count(me) : null;
  const gapWords = (n: number) => (g.weeksWon ? `${fmt(n)} ${n === 1 ? "week" : "weeks"}` : fmt(n));
  const place = me.rank.startsWith("T") ? `Tied ${ordinal(Number(me.rank.slice(1)))}` : ordinal(me.place);
  return {
    kind: "standing",
    label: g.over ? "Final" : [nextEp !== null ? `${E} ${nextEp}` : null, when].filter(Boolean).join(" · "),
    you,
    them: null,
    stand: null,
    state: `${place} of ${g.players} · ${total}${gap && gap > 0 ? ` · ${gapWords(gap)} behind ${first(above!.name)}` : me.place === 1 ? " · in front" : ""}`,
    tone: g.over ? "over" : due ? "due" : behind ? "behind" : "plain",
    score: null,
    mine: g.lineup?.starters ?? null,
    theirs: null,
    last: null,
    champion: null,
    episode: me.weeks.at(-1)?.episode ?? null,
  };
}

function lastLine(g: GameView, l: NonNullable<NonNullable<GameView["matchups"]>["last"]>, E: string): WeekCard["last"] {
  const opp = g.table.find((r) => r.playerId === l.opponent);
  const who = opp ? first(opp.name) : l.stand === "median" ? "the middle score" : "a bye";
  if (l.result === null) return { episode: l.episode, line: `${E} ${l.episode} · Counted for nobody · records unchanged`, result: "quiet" };
  const verb = l.result === "win" ? `Beat ${who}` : l.result === "loss" ? `Lost to ${who}` : `Tied ${who}`;
  return { episode: l.episode, line: `${E} ${l.episode} · ${verb} · ${scoreWords(l.points ?? 0, l.against)}`, result: l.result };
}
