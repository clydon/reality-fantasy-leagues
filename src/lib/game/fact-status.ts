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
// What reaches every league (`live`): canonical and confirmed facts; a reported one only when it's trusted (a confident
// source, and no answer for that episode says otherwise); a disputed one stays as it was until it's settled ("your
// scores don't change until it's settled"); removed ones never.

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
const METHOD_KINDS = new Set(["elimination", "role", "group"]);

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

/**
 * Every fact of one episode, from its submissions (withdrawn ones left out by the caller), sources and flags.
 * `confirmAt`: how many sources it takes to confirm a fact (the desk's Settings; 2 by default).
 */
export function settleEpisode(facts: FactInput[], submissions: Submission[], opts: { confirmAt?: number } = {}): FactOutcome[] {
  const byId = new Map(submissions.map((s) => [s.id, s]));
  const need = Number.isInteger(opts.confirmAt) && (opts.confirmAt as number) >= 2 ? (opts.confirmAt as number) : 2;
  return facts.map((f) => settleFact(f, submissions, byId, need));
}

function settleFact(f: FactInput, submissions: Submission[], byId: Map<string, Submission>, need: number): FactOutcome {
  const said = new Map(f.sources.filter((s) => byId.has(s.researchId)).map((s) => [s.researchId, s]));
  // Every answer that speaks to this fact: it reported it, or it answered for the person and didn't.
  const speaking = submissions.filter((s) => said.has(s.id) || coversFact(s.covers, f));
  // One voice per source: the newest answer from each.
  const newest = new Map<string, Submission>();
  for (const s of speaking) if (!newest.has(s.key) || newest.get(s.key)!.at < s.at) newest.set(s.key, s);
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
  }
  if (status !== "disputed") base.settle = checked.map((x) => ({ id: x.id, status: status === "removed" ? "upheld" : "kept" }));

  // Trusted: a confident source for the winning method, and no answer for the episode saying otherwise (any of them,
  // not just each source's newest: someone's own second answer disagreeing with their first is reason enough to wait).
  const contradicted = speaking.some((s) => {
    const yes = said.get(s.id);
    return !yes || (METHOD_KINDS.has(f.kind) && yes.method !== method);
  });
  const confident = [...said.values()].some((s) => s.confidence === "high" && (!METHOD_KINDS.has(f.kind) || s.method === method));
  const live = status === "confirmed" ? true : status === "removed" ? false : status === "disputed" ? f.live : confident && !contradicted;
  return { ...base, factStatus: status, live };
}

/** "1 source", "2 sources agree", "Disputed": how a fact's status reads beside it. */
export function sourcesLine(o: Pick<FactOutcome, "factStatus" | "yes">): string {
  if (o.factStatus === "canonical") return "Checked by an admin";
  if (o.factStatus === "disputed") return "Disputed";
  if (o.factStatus === "removed") return "Removed";
  return o.yes >= 2 ? `${o.yes} sources agree` : "1 source";
}
