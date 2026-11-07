import { pool } from "./db";

// Which line an over/under on a game's own line plays by (docs/PLAN-start-a-game-gpt.md track L, L3 part 3b; db/migrations/0306):
// the latest line read for its game (sports_events.odds, read by the daily listings job) when the question opens for answers in a
// league, kept once (question_lines) and never changed after, so every answer is graded against the line shown with it. A question
// that opens before there's a line waits ("Line coming") and opens when one's read. Kept by the questions' read and write
// (answers.ts), the grader reads them back (answer-points.ts: AnswerFacts.lines). Keyed as the grader keys them (answers.js
// lineKey): "question|window|event", an episode's one game's event ''.

/** A league's kept lines, by "question|window|event". */
export async function keptLines(leagueId: string): Promise<Map<string, number>> {
  const { rows } = await pool.query("SELECT question, episode, event_id, line::float8 AS line FROM question_lines WHERE league_id = $1", [leagueId]);
  return new Map(rows.map((r) => [`${r.question}|${r.episode}|${r.event_id}`, Number(r.line)]));
}

/** Keep these lines (each the latest read for its game, as the question opens), never over one kept already; returns the league's
 *  kept lines after (the one kept first, where two reads kept one at once). */
export async function keepLines(leagueId: string, lines: { question: string; window: number; event: string; line: number; readAt: string | null }[]): Promise<Map<string, number>> {
  if (lines.length) {
    await pool.query(
      `INSERT INTO question_lines (league_id, question, episode, event_id, line, read_at)
       SELECT $1, x.question, x."window", x.event, x.line, x."readAt" FROM jsonb_to_recordset($2::jsonb) AS x(question TEXT, "window" INT, event TEXT, line FLOAT8, "readAt" TIMESTAMPTZ)
       ON CONFLICT DO NOTHING`,
      [leagueId, JSON.stringify(lines)]
    );
  }
  return keptLines(leagueId);
}
