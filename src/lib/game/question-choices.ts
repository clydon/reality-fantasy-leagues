import { callMoments, type CallBook } from "./calls";
import { goingHomeEachEpisode } from "./formats/rulebook-fits.js";
import { momentsFor } from "./formats/rulebook-moments.js";
import { kindOf, partWord } from "./formats/rulebook-schema.js";
import * as Spec from "./game-spec/index.js";
import type { Question, SpecContext } from "./game-spec/index.js";

// A Prediction Sheet's questions, from the show's moments (docs/PLAN-start-a-game-gpt.md step A4 part 2): what Start a game
// offers with taps, and what Backstage › Game settings switches on or off before the game starts. Only questions data settles
// (game-spec specProblems' rule, checked here against the show's ctx, answers.ts questionContext):
//
//   Who goes home?            each episode, a person, 2 points    where someone goes home every episode
//   <a moment>?               each episode, yes or no, 1 point    up to three of the show's most callable moments, research's
//                                                                  (calls.ts callMoments: Call it's, never the couch's word)
//   Who goes home first?      once, a person, 2 points            where someone goes home every episode
//   Who wins?                 once, a person, 5 points            where someone wins: the season's, so only in a game that
//   Who makes the final three? once, three people, 1 point each   runs to the season's end
//
// The first of each kind is on by default (Who goes home?, the first moment, Who wins?); the rest are a tap away. Every one of
// them locks when its episode starts, or (asked once) when the game's first does. Pure: tests/answers.test.js.

export interface QuestionChoice {
  question: Question;
  /** "Each episode · 2 points", "Once, before it starts · 5 points". */
  line: string;
  /** On by default. */
  on: boolean;
  /** The season's to settle (who wins, the final three): only in a game that runs to the season's end. */
  season: boolean;
}

/**
 * What the data-can-settle rule checks a game's own questions against (game-spec specProblems' ctx, for RosterLogic.setGame), from
 * the rules the game plays by: their moments, by the ids the results record (a built-in's aliases), and who answers each; whether
 * the results say who goes home (a series' and a talk show's don't), whether anyone wins, who settles the show's calls, and the
 * phases. answers.ts questionContext reads a league's rules into it.
 */
export function contextOf(book: CallBook): SpecContext {
  const blocks = book.blocks;
  const aliases = book.aliases as { events?: Record<string, string> } | null | undefined;
  const kind = kindOf(blocks);
  return {
    moments: momentsFor(blocks).map((m) => ({ id: aliases?.events?.[m.id] ?? m.id, label: m.label, defaultPoints: m.defaultPoints, answeredBy: m.answeredBy, auto: !!m.auto, off: !!m.off })),
    results: kind !== "series" && kind !== "talk",
    winner: (blocks.waysOut ?? []).some((w) => w.means === "winner"),
    calls: kind === "talk" ? "couch" : "results",
    phases: (blocks.season?.phases ?? []).map((p) => ({ id: p.id, name: p.name })),
  };
}

/** How many of the show's moments it offers as yes-or-no questions. */
const MOMENTS = 3;

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

/** "Played an idol or advantage?": a moment's own words, asked. */
const asked = (label: string) => `${label.replace(/[.?!]\s*$/, "").trim()}?`;

/** A question's id from a moment's: "m.idolPlayed", within the 40 an id may have. */
const momentId = (id: string) => `m.${id.replace(/[^\w.-]/g, "_")}`.slice(0, 40);

/** The line under a question: when it's asked and what it's worth. */
export function questionLine(q: Pick<Question, "asked" | "points" | "pick">, part = "episode"): string {
  const pts = q.pick && q.pick > 1 ? `${plural(q.points, "point")} each` : plural(q.points, "point");
  return `${q.asked === "each" ? `Each ${part}` : "Once, before it starts"} · ${pts}`;
}

/**
 * The questions a Prediction Sheet can ask on this show, in order: each one data settles (checked as a game's own would be,
 * against `ctx`). `book`: the rules the game plays by (its couch's own copy, else the season's), with a built-in's aliases.
 */
export function questionChoices(book: CallBook, ctx: SpecContext): QuestionChoice[] {
  const { blocks } = book;
  if (kindOf(blocks) === "talk") return [];
  const part = partWord(blocks).singular;
  const out: { q: Question; on: boolean; season: boolean }[] = [];
  const home = ctx.results !== false && goingHomeEachEpisode(blocks);
  if (home) out.push({ q: { id: "out", ask: "Who goes home?", answer: "person", points: 2, asked: "each", closes: "start", pick: 1, from: "cast", settle: { by: "results", take: "out" } }, on: true, season: false });
  callMoments(book, MOMENTS)
    .slice(0, MOMENTS)
    .forEach((m, i) =>
      out.push({ q: { id: momentId(m.id), ask: asked(m.label), answer: "yesNo", points: 1, asked: "each", closes: "start", settle: { by: "moment", moment: m.id, take: "happened" } }, on: i === 0, season: false })
    );
  if (home) out.push({ q: { id: "first", ask: "Who goes home first?", answer: "person", points: 2, asked: "once", closes: "start", pick: 1, from: "cast", settle: { by: "results", take: "out" } }, on: false, season: false });
  if (ctx.winner !== false && ctx.results !== false) {
    out.push({ q: { id: "wins", ask: "Who wins?", answer: "person", points: 5, asked: "once", closes: "start", pick: 1, from: "cast", settle: { by: "results", take: "winner" } }, on: true, season: true });
    out.push({ q: { id: "final3", ask: "Who makes the final three?", answer: "person", points: 1, asked: "once", closes: "start", pick: 3, from: "cast", settle: { by: "results", take: "top", place: 3 } }, on: false, season: true });
  }
  // Only what data settles on this show: each question alone in a game of questions to the season's end.
  const ok = (q: Question) => !Spec.specProblems({ spec: 1, span: { from: 1, to: null }, get: { by: "none" }, score: { by: "answers" }, ask: [q] }, ctx).length;
  return out.filter((c) => ok(c.q)).map((c) => ({ question: c.q, line: questionLine(c.q, part), on: c.on, season: c.season }));
}

/** The questions chosen, in the order they're offered (ids not offered are left out). `season`: the game runs to the season's
 *  end, so the season's questions can be in it. */
export function chosenQuestions(choices: QuestionChoice[], ids: readonly string[], season: boolean): Question[] {
  const want = new Set(ids);
  return choices.filter((c) => want.has(c.question.id) && (season || !c.season)).map((c) => c.question);
}
