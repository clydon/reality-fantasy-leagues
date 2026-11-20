// Results from everyone (docs/PLAN-new-design.md step 6b; db/migrations/0112): what each shared fact's sources and flags
// add up to. Every answer anyone sends for an episode (a couch's paste, who went home, entered by hand, the bot's runs)
// is a submission; a submission is FOR a fact when it reported it, and AGAINST it when it answered for that person (and
// that kind of result) and didn't. Sources are counted by who sent them (a person, or one of the bot's runs): the same
// person sending twice is one source, their newer answer the one that counts. Flags ("Something wrong?") open a question
// that a later answer settles. Pure: src/lib/server/community-results.ts keeps the rows and does the writes.
//
//   reported   one source, and nobody disagrees
//   confirmed  two or more agree, and more say so than not
//   disputed   a source or a player disagrees, and it isn't settled yet (a flag no answer has checked, or a split)
//   canonical  an admin decided (locked)
//   removed    nothing supports it any more, or more say it didn't happen than did (a correction)
//
// What reaches every league (`live`): canonical and confirmed facts, and a reported one (docs/PLAN-results-settle.md, the
// user's 2026-11-20: "let the AI settle"; one look is enough, whatever its confidence, and a sender's newer answer is its whole
// word, what it adds as much as what it drops); a disputed one stays as it was until it's settled ("your scores don't change
// until it's settled": the tie-break run's extra look settles it); removed ones never.
//
// After an episode's final results (noon the day after it airs, final-results.js), a bot's answer is a voice of its own, so it
// can't overwrite what the bot said before: where it disagrees, that's a split for the tie-break. And on an episode that had its
// results by then, a result only those later answers report stays out until a second one agrees: never one late look alone.

export type FactStatus = "reported" | "confirmed" | "disputed" | "canonical" | "removed";

/** What a submission answered for: the people it was asked about and the kinds of result (null: every kind), or only its own facts. */
export type Covers = { people: string[]; kinds: string[] | null } | { only: true };

export interface Submission {
  id: string;
  /** Who sent it: a user id, or `bot:<source>` for one of the bot's runs. */
  key: string;
  at: number;
  covers: Covers;
}

export interface FactSource {
  researchId: string;
  method: string;
  confidence: string;
}

export interface Flag {
  id: string;
  status: "open" | "kept" | "upheld" | "checked";
  at: number;
}

export interface FactInput {
  id: string;
  kind: string;
  castawayName: string;
  method: string;
  /** Classic's status: accepted is "in every league". */
  live: boolean;
  factStatus: FactStatus | null;
  locked: boolean;
  sources: FactSource[];
  flags: Flag[];
}

export interface FactOutcome {
  id: string;
  factStatus: FactStatus;
  live: boolean;
  /** The method most sources gave (an elimination's, a tribe move's tribe, a role); the fact's own on a tie. */
  method: string;
  /** Sources for it, and against it. */
  yes: number;
  no: number;
  /** Open flags this settles: kept (it stands) or upheld (it comes out). */
  settle: { id: string; status: "kept" | "upheld" }[];
}

/** Kinds whose result carries a method that sources can disagree on. */
// Cast properties (chunks 6, 6b): a property's new value and a holding's other person are their facts' method too.
const METHOD_KINDS = new Set(["elimination", "role", "group", "prop", "holding"]);
/** Kinds the AI's answer settles at once, the desk confirming or changing them after (never waited on). */
const SETTLES_AT_ONCE = new Set(["prop", "holding"]);

const lower = (s: string) => s.trim().toLowerCase();

/**
 * Whether a submission answered for this fact's person and kind (a vouch answers only for its own facts). "Nobody went
 * home" (`noexit`, step 6c) is about no one: any answer about who went home speaks to it, so one naming someone who left
 * counts against it, and one saying nobody did (or a full answer with nobody out) reports it.
 */
export function coversFact(covers: Covers, fact: Pick<FactInput, "kind" | "castawayName">): boolean {
  if ("only" in covers) return false;
  if (fact.kind === "noexit") return !covers.kinds || covers.kinds.includes("elimination") || covers.kinds.includes("noexit");
  if (covers.kinds && !covers.kinds.includes(fact.kind)) return false;
  const name = lower(fact.castawayName);
  return covers.people.some((p) => lower(p) === name);
}

export interface SettleOptions {
  /** How many sources it takes to confirm a fact (the desk's Settings; 2 by default). */
  confirmAt?: number;
  /** When the episode's results are final (ms since the epoch; noon the day after it airs). Null or left out: no time known. */
  finalAt?: number | null;
  /** The episode had results by its final time (an answer from before it, or a result an admin decided). */
  hadResults?: boolean;
}

/** A bot's answer filed after the episode's final results: a voice of its own, apart from what the bot said before them. */
export function voiceOf(s: Pick<Submission, "key" | "at">, finalAt: number | null | undefined): string {
  return finalAt != null && s.key.startsWith("bot:") && s.at > finalAt ? `${s.key}#after` : s.key;
}

/**
 * Every fact of one episode, from its submissions (withdrawn ones left out by the caller), sources and flags.
 * `confirmAt`: how many sources it takes to confirm a fact (the desk's Settings; 2 by default). `finalAt` and `hadResults`: the
 * episode's final time and whether it had results by then (the two looks after final).
 */
export function settleEpisode(facts: FactInput[], submissions: Submission[], opts: SettleOptions = {}): FactOutcome[] {
  const byId = new Map(submissions.map((s) => [s.id, s]));
  const need = Number.isInteger(opts.confirmAt) && (opts.confirmAt as number) >= 2 ? (opts.confirmAt as number) : 2;
  return facts.map((f) => settleFact(f, submissions, byId, need, opts.finalAt ?? null, !!opts.hadResults));
}

function settleFact(f: FactInput, submissions: Submission[], byId: Map<string, Submission>, need: number, finalAt: number | null, hadResults: boolean): FactOutcome {
  const said = new Map(f.sources.filter((s) => byId.has(s.researchId)).map((s) => [s.researchId, s]));
  // Every answer that speaks to this fact: it reported it, or it answered for the person and didn't.
  const speaking = submissions.filter((s) => said.has(s.id) || coversFact(s.covers, f));
  // One voice per source: the newest answer from each (a bot's after final results apart from its earlier ones).
  const newest = new Map<string, Submission>();
  for (const s of speaking) {
    const v = voiceOf(s, finalAt);
    if (!newest.has(v) || newest.get(v)!.at < s.at) newest.set(v, s);
  }
  const methods = new Map<string, number>();
  let against = 0;
  for (const s of newest.values()) {
    const yes = said.get(s.id);
    if (!yes) against++;
    else {
      const m = METHOD_KINDS.has(f.kind) ? yes.method : "";
      methods.set(m, (methods.get(m) ?? 0) + 1);
    }
  }
  // The method most sources gave; the fact's own wins a tie, so a split doesn't flip it back and forth.
  let method = METHOD_KINDS.has(f.kind) ? f.method : "";
  for (const [m, n] of methods) if (n > (methods.get(method) ?? 0)) method = m;
  const Y = methods.get(method) ?? 0;
  const N = against + [...methods].filter(([m]) => m !== method).reduce((a, [, n]) => a + n, 0);
  // Each voice's side (for the winning method), and whether it's a bot's answer from after final results.
  const sides = [...newest.entries()].map(([v, s]) => {
    const yes = said.get(s.id);
    return { late: v.endsWith("#after"), yes: !!yes && (!METHOD_KINDS.has(f.kind) || yes.method === method) };
  });

  const latest = speaking.reduce((t, s) => Math.max(t, s.at), 0);
  const open = f.flags.filter((x) => x.status === "open");
  const checked = open.filter((x) => latest > x.at);
  const waiting = open.length > checked.length;
  // The players who flagged it are one voice, not one each: they can tip a split, never outvote the sources.
  const voice = f.flags.some((x) => x.status === "upheld") || checked.length ? 1 : 0;

  const base = { id: f.id, method: method || f.method, yes: Y, no: N, settle: [] as FactOutcome["settle"] };
  if (f.locked) return { ...base, method: f.method, factStatus: f.factStatus ?? (f.live ? "canonical" : "removed"), live: f.live };

  let status: FactStatus;
  if (Y === 0) status = "removed";
  else if (waiting) status = "disputed";
  else {
    const no = N + voice;
    // Confirmed takes `need` sources; a majority short of that is still a question.
    status = no === 0 ? (Y >= need ? "confirmed" : "reported") : Y > no ? (Y >= need ? "confirmed" : "disputed") : no > Y ? "removed" : "disputed";
    // Two looks after final (docs/PLAN-results-settle.md): a result only the bot's later answers speak to, on an episode that had
    // its results by then, split even: that's the second look saying no, so it's out, settled. A split with an answer from before
    // final, or with players' flags, is the tie-break's like any other.
    if (hadResults && status === "disputed" && voice === 0 && Y === N && sides.every((x) => x.late)) status = "removed";
  }
  if (status !== "disputed") base.settle = checked.map((x) => ({ id: x.id, status: status === "removed" ? "upheld" : "kept" }));

  // A property's change and a holding (cast properties, chunks 6 and 6b; the user, 2026-11-16: "AI decides and settles. Desk can
  // then confirm or change, that way no one is ever waiting"): in the games from the first answer that reports it, whatever its
  // confidence, the majority's value where sources split; out only once removed. The desk confirms or changes it after.
  if (SETTLES_AT_ONCE.has(f.kind)) return { ...base, factStatus: status, live: status !== "removed" };
  // One look is enough (the user, 2026-11-20: "let the AI settle"), whatever its confidence. Except after final, on an episode
  // that had its results by then: a result only the bot's later answers report waits, out of the games, for a second look (the
  // tie-break run gives it one): in once one agrees (confirmed), out once one doesn't (removed, above). Whether it's in the
  // games now doesn't matter: a second look taken back (an answer withdrawn) leaves it waiting again, as it was.
  const waitsForSecond = hadResults && status === "reported" && sides.every((x) => x.late);
  const live = status === "confirmed" ? true : status === "removed" ? false : status === "disputed" ? f.live : !waitsForSecond;
  return { ...base, factStatus: status, live };
}

/** "1 source", "2 sources agree", "Disputed": how a fact's status reads beside it. */
export function sourcesLine(o: Pick<FactOutcome, "factStatus" | "yes">): string {
  if (o.factStatus === "canonical") return "Checked by an admin";
  if (o.factStatus === "disputed") return "Disputed";
  if (o.factStatus === "removed") return "Removed";
  return o.yes >= 2 ? `${o.yes} sources agree` : "1 source";
}
