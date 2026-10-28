"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, ChevronRight, ListChecks, Minus, Plus, X } from "lucide-react";
import { airTime, calm, ticks } from "../clock";
import { answersApi, useAfterAnswers, useGameQuestions, type GameQuestions, type QuestionFace, type QuestionView, type SheetMove } from "../data";
import { Avatar, useNow } from "../ui/bars";
import { Btn, Chip } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { Face, IconBox } from "./parts";

// A game's questions (docs/PLAN-start-a-game-gpt.md step A4 part 2; the server's answers.ts): a Prediction Sheet's, or a draft's
// finale predictions, opened from anywhere signed in with openSheet. One sheet, as Call it's (calls.tsx):
//   - before they lock: each question with its points, grouped by when it locks (this episode's at its start, the season's at
//     the game's first, finale predictions at the finale), with the countdown; a person as faces (who's still in as far as you've
//     seen, from the server), yes or no, over or under and choices as chips, a number on a stepper. A tap again takes an answer
//     back; Save sends what changed (null for one taken back). Someone behind sees "it waits until you've seen Episode 5" where
//     the faces would be: who's still in would give it away. Nobody's answer leaves the server before its lock, only a count.
//   - once one locks: everyone's answers, yours first; once it's settled as far as you've seen, what was right, a tick or a
//     cross, what each earned, and your points on a plate. Graded on the server at your mark, never ahead of it.
// Also the rows that open it: Tonight's Extras and This week (to fill it in), an episode you've seen (how it went), finale
// predictions on a draft. Nothing polls.

export type SheetTarget = {
  seasonId: string;
  leagueId: string;
  /** An episode's questions (how they went); null: this week's. */
  episode: number | null;
  /** The game's name ("Prediction Sheet", or a draft's, for its finale predictions). */
  game: string;
  finale?: boolean;
};

type Store = { target: SheetTarget | null; n: number };
let store: Store = { target: null, n: 0 };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const SERVER: Store = { target: null, n: 0 };

/** Open a game's questions: this week's (to answer), or an episode's (how they went). */
export function openSheet(target: SheetTarget) {
  store = { ...store, target: null };
  emit();
  setTimeout(() => {
    store = { target, n: store.n + 1 };
    emit();
  }, 30);
}

const close = () => {
  store = { ...store, target: null };
  emit();
};

/** The sheet's host, in the signed-in layout. */
export function QuestionSheets() {
  const { target, n } = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => store,
    () => SERVER
  );
  return <QuestionSheet key={n} target={target} onOpenChange={(o) => !o && close()} />;
}

// ---------- the words ----------

const first = (name: string) => name.split(" ")[0];
const pts = (n: number) => `${n} ${n === 1 ? "point" : "points"}`;
const isIn = (v: unknown) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const idsOf = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : typeof v === "string" && v ? [v] : []);

/** "Kristin", "Kristin, Sue and Ozzy", "Yes", "4", "Over 3.5". */
function answerWords(q: QuestionView, v: unknown, cast: Map<string, QuestionFace>): string {
  if (!isIn(v)) return "";
  // A question about each person (A6): an answer for each, "Ana: 24, Ben: 22".
  if (q.each && v && typeof v === "object" && !Array.isArray(v)) {
    return Object.entries(v as Record<string, unknown>)
      .map(([id, a]) => `${first(cast.get(id)?.name ?? "someone")}: ${answerWords({ ...q, each: null }, a, cast)}`)
      .join(", ");
  }
  if (q.answer === "group") return idsOf(v).map((id) => cast.get(id)?.name ?? "a group").join(", ");
  if (q.answer === "person") {
    const names = idsOf(v).map((id) => first(cast.get(id)?.name ?? "someone"));
    return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
  }
  if (q.answer === "yesNo") return v === "yes" ? "Yes" : "No";
  if (q.answer === "overUnder") return `${v === "over" ? "Over" : "Under"} ${q.line ?? ""}`.trim();
  return String(v);
}

/** The settle as "by:take" ("results:out"). */
const how = (q: QuestionView) => `${q.settle.by}${"take" in q.settle ? `:${q.settle.take}` : ""}`;
/** The season's to settle: who wins, where they finish. */
const seasonal = (q: QuestionView) => ["results:winner", "results:top", "results:placed"].includes(how(q));

/** What the right answer was, in a line ("Kristin went home", "It happened"), or what it waits for. */
function verdictWords(q: QuestionView, d: GameQuestions, cast: Map<string, QuestionFace>): string {
  const v = q.verdict;
  const ep = q.episode;
  if (!v || v.state === "waiting") {
    if (ep !== null && d.mark !== null && d.mark < ep) return `See Episode ${ep} to find out`;
    if (seasonal(q)) return "Settles when the season ends";
    if (ep === null && how(q) === "results:out") return "Waiting for the first to go home";
    return ep !== null ? `Waiting for Episode ${ep}'s results` : "Waiting for the results";
  }
  if (v.state === "off") return `${v.why}: it doesn't count`;
  if (q.each) return "Settled for each one";
  if (q.answer === "group") return (v.groups ?? []).map((id) => cast.get(id)?.name ?? "A group").join(", ");
  const names = v.right.map((id) => first(cast.get(id)?.name ?? "Someone"));
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : (names[0] ?? "");
  if (q.answer === "person") {
    if (how(q) === "results:out") return `${list} went home${ep === null ? " first" : ""}`;
    if (how(q) === "results:winner") return `${list} won`;
    if (how(q) === "results:top") return `The final ${names.length}: ${list}`;
    return list;
  }
  if (q.answer === "yesNo") return v.right[0] === "yes" ? "It happened" : "It didn't happen";
  if (typeof v.value === "number") return q.answer === "overUnder" && q.line !== null ? `It was ${v.value}: ${v.value > q.line ? "over" : v.value < q.line ? "under" : "right on the line"}` : `It was ${v.value}`;
  return list;
}

/** The line under a question: what a right answer earns. */
function worth(q: QuestionView): string {
  if (q.each) return q.answer === "number" ? `Closest on each gets ${pts(q.points)}` : `${pts(q.points)} for each one right`;
  if ((q.answer === "person" || q.answer === "group") && (q.pick ?? 1) > 1) return `Name ${q.pick} · ${pts(q.points)} for each one right`;
  if (q.answer === "number") return `Closest gets ${pts(q.points)}`;
  return `${pts(q.points)} if you're right`;
}

/** When a group of questions locks: "Locks Wed 8:05 PM · in 2 days", ticking inside the last day. */
function LockLine({ at, closed }: { at: string | null; closed: boolean }) {
  const t = at ? Date.parse(at) : null;
  const now = useNow(t != null && ticks(t));
  if (closed) return <span className="text-[13px] font-semibold text-muted-foreground">Locked</span>;
  if (t == null) return null;
  return (
    <span data-sheet-locks className="text-[13px] tabular-nums text-muted-foreground">
      Locks {airTime(t)} · {calm(t, now)}
    </span>
  );
}

// ---------- the sheet ----------

function QuestionSheet({ target, onOpenChange }: { target: SheetTarget | null; onOpenChange: (open: boolean) => void }) {
  const open = !!target;
  const r = useGameQuestions(target?.seasonId ?? null, target?.leagueId ?? null, target?.episode ?? null, open);
  const d = r.data;
  const status = (r.error as { status?: number } | null)?.status;
  const answering = !!d?.questions.some((q) => q.status === "open");
  const title = target?.finale ? "Finale predictions" : (target?.game ?? "");
  // Finale predictions are the game's own, not this week's: they say which game, not an episode.
  const when = target?.finale ? target.game : d?.episode ? `Episode ${d.episode}` : null;
  const subtitle = !target ? undefined : answering ? `${when ? `${when} · ` : ""}private until it locks` : when ? `${when} · how it went` : target.game;
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title} subtitle={subtitle}>
      {r.isPending && open ? (
        <div aria-busy className="h-[300px] animate-pulse rounded-[4px] bg-secondary" />
      ) : !d || !target ? (
        <p className="py-4 text-sm text-muted-foreground">{status && status < 500 ? ((r.error as Error)?.message ?? "Not open.") : "Couldn't load it. Try again in a moment."}</p>
      ) : !d.questions.length ? (
        <p className="py-4 text-sm text-muted-foreground">Nothing to answer here yet.</p>
      ) : (
        <SheetBody key={JSON.stringify(d.questions.map((q) => [q.id, q.mine, q.status]))} target={target} d={d} onDone={() => onOpenChange(false)} />
      )}
    </Sheet>
  );
}

/** Each group of questions (this episode's, then the season's), what you can still answer, and Save. */
function SheetBody({ target, d, onDone }: { target: SheetTarget; d: GameQuestions; onDone: () => void }) {
  const after = useAfterAnswers();
  // The groups (tribes) too, for a group answer (A6): their ids never meet a castaway's.
  const cast = new Map([...d.cast, ...(d.groups ?? [])].map((c) => [c.id, c]));
  const [picked, setPicked] = useState<Record<string, unknown>>(() => Object.fromEntries(d.questions.map((q) => [q.id, q.mine])));
  const [saving, setSaving] = useState(false);
  const open = d.questions.filter((q) => q.status === "open");
  const changed = open.filter((q) => !same(isIn(picked[q.id]) ? picked[q.id] : null, isIn(q.mine) ? q.mine : null));
  const groups = [
    // Asked each episode, and over a run or a phase (A7): this week's.
    { key: "each", label: d.episode ? `Episode ${d.episode}` : "This episode", list: d.questions.filter((q) => q.asked !== "once") },
    { key: "once", label: target.finale ? "The finale" : "For the season", list: d.questions.filter((q) => q.asked === "once") },
  ].filter((g) => g.list.length);
  const closedOnes = d.questions.filter((q) => q.status === "closed");
  const mineEarned = closedOnes.flatMap((q) => q.people.filter((p) => p.you)).reduce((n, p) => n + p.earned, 0);
  const settled = closedOnes.filter((q) => q.verdict?.state === "known" && q.people.some((p) => p.you));
  const rightOnes = settled.filter((q) => q.people.find((p) => p.you)?.right).length;
  const firstLock = open.map((q) => (q.closesAt ? Date.parse(q.closesAt) : Infinity)).reduce((a, b) => Math.min(a, b), Infinity);
  const until = Number.isFinite(firstLock) ? airTime(firstLock) : "it locks";
  const answered = Math.max(0, ...open.map((q) => q.answered));

  const save = async () => {
    if (!changed.length) return onDone();
    setSaving(true);
    try {
      const body = Object.fromEntries(changed.map((q) => [q.id, isIn(picked[q.id]) ? picked[q.id] : null]));
      after(await answersApi.answer(target.seasonId, target.leagueId, d.episode, body), target.seasonId, target.episode);
      onDone();
      // No reminder ask after it (remind.tsx): the reminders are a lineup's and a pick's, not a sheet's.
      toast(`Saved · change until ${until}`);
    } catch (e) {
      toast.quiet(`Not saved: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-sheet={target.leagueId} data-sheet-episode={d.episode ?? ""} data-sheet-status={open.length ? "open" : "closed"}>
      {settled.length > 0 && (
        <div data-sheet-score className="nd-beat mt-1 rounded-[4px] bg-plate p-4 text-plate-foreground shadow-plate">
          <span className="type-caption inline-block bg-chyron py-1 pl-2 pr-4 text-xs tracking-[0.06em] text-chyron-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_8px)_100%,0_100%)]">
            {target.finale ? "Your predictions" : "Your sheet"}
          </span>
          <div className="mt-2 flex items-end gap-2.5">
            <b className="type-num text-[56px] leading-[.85]">{mineEarned}</b>
            <span className="pb-1 text-[13px] text-plate-muted">
              {mineEarned === 1 ? "point" : "points"} · {rightOnes} of {settled.length} right{settled.length < closedOnes.length ? " so far" : ""}
            </span>
          </div>
        </div>
      )}
      {groups.map((g) => {
        const gOpen = g.list.filter((q) => q.status === "open");
        const lock = gOpen.map((q) => q.closesAt).filter((x): x is string => !!x).sort()[0] ?? null;
        return (
          <section key={g.key} data-sheet-group={g.key} className="mt-4 first:mt-1">
            <div className="flex items-baseline justify-between gap-3 border-b border-border pb-1.5">
              <b className="type-caption text-[15px] tracking-[0.04em] text-muted-foreground">{g.label}</b>
              <LockLine at={lock} closed={!gOpen.length} />
            </div>
            {g.list.map((q) => (
              <Question key={q.id} q={q} d={d} cast={cast} value={picked[q.id]} onValue={(v) => setPicked((x) => ({ ...x, [q.id]: v }))} />
            ))}
          </section>
        );
      })}
      {open.length > 0 && (
        <>
          <p data-sheet-count className="mt-4 text-[13px] leading-snug text-muted-foreground">
            {answered ? `${answered} on the couch ${answered === 1 ? "has" : "have"} answered` : "Nobody on the couch has answered yet"} · nobody sees an answer until it locks. Tap an answer again to take it back.
          </p>
          <Btn tone={changed.length ? "must" : "optional"} wide className="mt-3" disabled={saving} onClick={save} data-sheet-save>
            {saving ? "Saving…" : changed.length ? "Save my answers" : "Done"}
          </Btn>
        </>
      )}
    </div>
  );
}

/** One question: its answer to give (open), why it waits (behind), or how it went (closed). */
function Question({ q, d, cast, value, onValue }: { q: QuestionView; d: GameQuestions; cast: Map<string, QuestionFace>; value: unknown; onValue: (v: unknown) => void }) {
  return (
    <div data-question={q.id} data-question-status={q.status} className="border-b border-border py-3.5 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <b className="text-[17px] leading-snug">{q.ask}</b>
        <span className="type-num flex-none text-[15px] text-muted-foreground">+{q.points}</span>
      </div>
      <small className="mt-0.5 block text-[13px] text-muted-foreground">
        {worth(q)}
        {q.status === "open" && (q.answer === "person" || q.answer === "group") && (q.pick ?? 1) > 1 ? ` · ${idsOf(value).length} of ${q.pick} named` : ""}
      </small>
      {q.status === "open" && q.each ? (
        // A question about each person (A6) has no screen of its own yet (the UI track's): the API takes its answers.
        <p data-question-each className="mt-2.5 text-sm leading-snug text-muted-foreground">
          This one is answered for each {q.faces?.length ? `of the ${q.faces.length} still in` : "one still in"}, on a screen still to come.
        </p>
      ) : q.status === "open" ? (
        <div className="mt-2.5">
          <Answer q={q} value={value} onValue={onValue} />
        </div>
      ) : q.status === "behind" ? (
        <p data-question-behind={q.catchUp ?? "game"} className="mt-2.5 rounded-[4px] bg-background p-3 text-sm leading-snug text-muted-foreground outline-1 -outline-offset-1 outline-border">
          {q.catchUp === null
            ? "Catch up on the game first: its questions open once you're on the live episode."
            : `Who's still in decides this one, so it waits until you've seen Episode ${q.catchUp}.`}
        </p>
      ) : (
        <HowItWent q={q} d={d} cast={cast} />
      )}
    </div>
  );
}

/** The answer to give, by kind: faces, chips, a stepper. A tap on what's chosen takes it back. */
function Answer({ q, value, onValue }: { q: QuestionView; value: unknown; onValue: (v: unknown) => void }) {
  // A person, or a group (A6: its faces are the groups someone still in is on).
  if (q.answer === "person" || q.answer === "group") {
    const pick = q.pick ?? 1;
    const chosen = idsOf(value);
    const tap = (id: string) => {
      if (chosen.includes(id)) return onValue(pick === 1 ? null : chosen.filter((x) => x !== id));
      if (pick === 1) return onValue(id);
      if (chosen.length >= pick) return toast.quiet(`${pick} at most: take one off first`);
      onValue([...chosen, id]);
    };
    return (
      <div className="grid grid-cols-4 gap-2" role="group" aria-label={q.ask}>
        {(q.faces ?? []).map((f) => {
          const on = chosen.includes(f.id);
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={on}
              data-answer-face={f.id}
              data-answer-name={f.name}
              onClick={() => tap(f.id)}
              className={`nd-press relative rounded-[3px] text-left ${on ? "outline-2 outline-offset-1 outline-foreground" : ""}`}
            >
              <Face src={f.photo} name={f.name} className={`aspect-square w-full rounded-[3px] text-[24px] ${on || !chosen.length ? "" : "saturate-[.5]"}`} />
              {on && (
                <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-foreground text-background">
                  <Check className="size-3" strokeWidth={3} aria-hidden />
                </span>
              )}
              <b className="type-caption mt-1 block truncate text-[14px]">{first(f.name)}</b>
            </button>
          );
        })}
      </div>
    );
  }
  if (q.answer === "number") {
    const n = typeof value === "number" ? value : null;
    return (
      <div className="flex items-center gap-2" data-answer-number>
        <button type="button" aria-label="One less" disabled={!n} onClick={() => onValue(n === null ? 0 : Math.max(0, n - 1))} className="nd-press grid size-11 place-items-center rounded-[3px] bg-secondary disabled:opacity-40">
          <Minus className="size-5" aria-hidden />
        </button>
        <b className="type-num min-w-[64px] text-center text-[32px] leading-none" aria-live="polite">
          {n ?? "–"}
        </b>
        <button type="button" aria-label="One more" onClick={() => onValue(n === null ? 1 : n + 1)} className="nd-press grid size-11 place-items-center rounded-[3px] bg-secondary">
          <Plus className="size-5" aria-hidden />
        </button>
        {n !== null && (
          <button type="button" onClick={() => onValue(null)} className="ml-auto h-11 px-2 text-sm font-semibold text-muted-foreground">
            Take it back
          </button>
        )}
      </div>
    );
  }
  const options: [string, string][] =
    q.answer === "yesNo" ? [["yes", "Yes"], ["no", "No"]] : q.answer === "overUnder" ? [["over", `Over ${q.line ?? ""}`], ["under", `Under ${q.line ?? ""}`]] : (q.options ?? []).map((o) => [o, o]);
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={q.ask}>
      {options.map(([key, label]) => (
        <Chip key={key} on={value === key} data-answer-option={key} onClick={() => onValue(value === key ? null : key)} className="h-11 px-5 text-[15px]">
          {label.trim()}
        </Chip>
      ))}
    </div>
  );
}

/** Locked: what was right (as far as you've seen), yours, and the couch's beside it. */
function HowItWent({ q, d, cast }: { q: QuestionView; d: GameQuestions; cast: Map<string, QuestionFace> }) {
  const v = q.verdict;
  const me = q.people.find((p) => p.you);
  const others = q.people.filter((p) => !p.you);
  const people = q.answer === "person" && v?.state === "known" ? v.right.map((id) => cast.get(id)).filter((c): c is QuestionFace => !!c) : [];
  const out = how(q) === "results:out";
  return (
    <div data-question-result={v?.state ?? "waiting"}>
      {people.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-2" data-question-right>
          {people.slice(0, 4).map((c) => (
            <Face key={c.id} src={c.photo} name={c.name} out={out} className="size-[64px] rounded-[3px] text-[22px]" />
          ))}
        </div>
      )}
      <p data-question-answer className="mt-2 text-[15px] font-semibold">
        {verdictWords(q, d, cast)}
      </p>
      <p data-question-mine={me ? (me.right === null ? "waiting" : me.right ? "right" : "wrong") : "none"} className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
        {me?.right === true ? <Check className="size-4 text-good" strokeWidth={3} aria-hidden /> : me?.right === false ? <X className="size-4 text-muted-foreground" strokeWidth={3} aria-hidden /> : null}
        {me ? `You said ${answerWords(q, me.answer, cast)}${me.right ? ` · +${me.earned}` : ""}` : "No answer from you"}
      </p>
      {others.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-2" data-question-people>
          {others.map((p) => (
            <span key={p.playerId} className="flex items-center gap-1.5 text-sm" data-question-person={p.name}>
              {p.userId ? <Avatar id={p.userId} name={p.name} size={24} /> : null}
              <span className="text-muted-foreground">{p.name}</span>
              <b className="font-semibold">{answerWords(q, p.answer, cast)}</b>
              {p.right === true ? <Check className="size-3.5 text-good" strokeWidth={3} aria-label="right" /> : p.right === false ? <X className="size-3.5 text-muted-foreground" strokeWidth={3} aria-label="wrong" /> : null}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- where it opens from ----------

/** A row that opens this week's sheet: "Fill in your sheet for Episode 7", or yours is in (This week, Tonight's Extras). */
export function SheetRow({ target, move: m, icon }: { target: SheetTarget; move: SheetMove; icon?: boolean }) {
  // The Games read's summary of it (answers.ts sheetOf), so a row costs no read of its own.
  const done = m.of > 0 && m.answered === m.of;
  const lock = m.closesAt;
  const what = target.finale ? "your finale predictions" : `your sheet${m.episode ? ` for Episode ${m.episode}` : ""}`;
  const title = done ? `${what.charAt(0).toUpperCase()}${what.slice(1)} ${target.finale ? "are" : "is"} in` : target.finale ? "Finale predictions" : `Fill in ${what}`;
  const line = done
    ? `Change until ${lock ? airTime(Date.parse(lock)) : "it locks"}`
    : !m.of
      ? `See Episode ${m.behind} first`
      : target.finale
        ? `Your final three and the winner${lock ? ` · until ${airTime(Date.parse(lock))}` : ""}`
        : `${m.of} ${m.of === 1 ? "question" : "questions"}${lock ? ` · locks ${airTime(Date.parse(lock))}` : ""}`;
  const state = done ? "In" : m.answered ? `${m.answered} of ${m.of}` : m.of ? "Open" : "";
  return (
    <button
      type="button"
      data-sheet-row={target.leagueId}
      data-sheet-done={done ? "yes" : "no"}
      onClick={() => openSheet(target)}
      className="nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border py-2 text-left"
    >
      {icon && <IconBox icon={ListChecks} />}
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-semibold">{title}</b>
        <small className="mt-0.5 block text-[13px] text-muted-foreground">{line}</small>
      </span>
      {state && <span className="text-[13px] font-semibold text-muted-foreground">{state}</span>}
      <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
    </button>
  );
}

/** How an episode's sheet went, for one you've seen: a row that opens it (Tonight's Extras; the episode page, under the game's
 *  name as a `heading`); nothing when nobody answered it. */
export function SheetResultRow({ target, heading }: { target: SheetTarget & { episode: number }; heading?: boolean }) {
  const r = useGameQuestions(target.seasonId, target.leagueId, target.episode);
  const d = r.data;
  const each = (d?.questions ?? []).filter((q) => q.asked !== "once" && q.status === "closed");
  if (!d || !each.length || !each.some((q) => q.people.length)) return null;
  const mine = each.flatMap((q) => q.people.filter((p) => p.you));
  const known = each.filter((q) => q.verdict?.state === "known");
  const earned = mine.reduce((n, p) => n + p.earned, 0);
  // Off (nobody went home) is settled too: it just doesn't count.
  const settling = each.some((q) => !q.verdict || q.verdict.state === "waiting");
  const row = (
    <button
      type="button"
      data-sheet-result-row={d.episode}
      data-sheet-league={target.leagueId}
      onClick={() => openSheet(target)}
      className="nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border py-2 text-left"
    >
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-semibold">
          {mine.length ? (known.length ? `Episode ${d.episode}: your sheet, ${pts(earned)}` : `Your sheet for Episode ${d.episode}`) : `Episode ${d.episode}: the couch's sheets`}
        </b>
        <small className="mt-0.5 block text-[13px] text-muted-foreground">{settling ? "Still settling · see the couch's answers" : "See the couch's answers"}</small>
      </span>
      <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
    </button>
  );
  if (!heading) return row;
  return (
    <section className="mt-[26px]" data-episode-sheet={target.leagueId}>
      <h2 className="type-caption mb-1 text-[24px]">{target.game}</h2>
      {row}
    </section>
  );
}
