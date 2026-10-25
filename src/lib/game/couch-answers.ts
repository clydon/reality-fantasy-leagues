// A couch's own moments, settled (docs/PLAN-new-design.md step 6b part 3; the mock's rulebook.js rbAddSheet: "anyone can
// tick who did it, and two agreeing settles it"). Each person's newest answer for one moment in one episode says who did
// it (and how many times, for a moment counted every time it happens). Whoever runs the couch's games settles it on
// their own: their newest answer is the result. Otherwise a name two people ticked is in, at the count most of them gave
// (the lower on a tie); a name one person ticked waits for a second. Pure: src/lib/server/couch-answers.ts reads and
// applies it; tests/couch-answers.test.js.

export interface CouchPick {
  name: string;
  /** How many times, for a moment counted every time it happens (absent: once). */
  times?: number;
}

export interface CouchAnswer {
  userId: string;
  /** They run one of the couch's games on it. */
  runs: boolean;
  picks: CouchPick[];
  at: number;
}

export interface CouchSettled {
  /** Who's in, as the games will count it. */
  settled: CouchPick[];
  /** Settled by whoever runs the games, by two people agreeing, or not yet (nobody, or nothing agreed). */
  by: "runner" | "agreed" | null;
  /** Ticked by one person: waiting for a second. */
  waiting: { name: string; votes: number }[];
}

const clean = (picks: CouchPick[], counted: "yesNo" | "eachTime"): CouchPick[] =>
  picks.map((p) => (counted === "eachTime" && Number.isInteger(p.times) && (p.times as number) > 1 ? { name: p.name, times: p.times } : { name: p.name }));

export function settleCouchMoment(answers: CouchAnswer[], counted: "yesNo" | "eachTime"): CouchSettled {
  const runner = answers.filter((a) => a.runs).sort((a, b) => b.at - a.at)[0];
  if (runner) return { settled: clean(runner.picks, counted).sort((a, b) => a.name.localeCompare(b.name)), by: "runner", waiting: [] };
  const votes = new Map<string, number[]>();
  for (const a of answers) {
    for (const p of a.picks) {
      const list = votes.get(p.name) ?? [];
      list.push(counted === "eachTime" && Number.isInteger(p.times) && (p.times as number) > 0 ? (p.times as number) : 1);
      votes.set(p.name, list);
    }
  }
  const settled: CouchPick[] = [];
  const waiting: { name: string; votes: number }[] = [];
  for (const [name, list] of votes) {
    if (list.length < 2) {
      waiting.push({ name, votes: list.length });
      continue;
    }
    // The count most of them gave; the lower on a tie.
    const counts = new Map<number, number>();
    for (const t of list) counts.set(t, (counts.get(t) ?? 0) + 1);
    const times = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
    settled.push(counted === "eachTime" && times > 1 ? { name, times } : { name });
  }
  // Two people agreeing nobody did it settles it too.
  const nobody = answers.filter((a) => !a.picks.length).length;
  const by = settled.length || nobody >= 2 ? "agreed" : null;
  return { settled: settled.sort((a, b) => a.name.localeCompare(b.name)), by, waiting: waiting.sort((a, b) => a.name.localeCompare(b.name)) };
}
