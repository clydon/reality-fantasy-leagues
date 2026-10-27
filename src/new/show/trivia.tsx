"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChevronRight, CircleQuestionMark } from "lucide-react";
import { triviaApi, useAfterTrivia, useTrivia, type TriviaQuestion, type TriviaRound } from "../data";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { Face, IconBox } from "./parts";

// Trivia (docs/PLAN-new-design.md step 12 part 3; the mock's index.html triviaSheet, gamestab.js, couchpages.js and round2.js's
// "Survivor 49 trivia · 3 questions from the real season"), opened from anywhere signed in with openTrivia: this week's three
// questions about a show's seasons you've seen (the server deals them: trivia.ts), one at a time with faces; right goes green,
// wrong shakes and shows the answer; then your score against the couch's ("You beat riley's 2"). The week's first play counts;
// Play again is just for fun. Under the score (or Nothing to ask yet), Seen an earlier season? (step 15 part 3, from Noticed: a past
// season counts only when it's marked): a finished season of the show you've seen to the end, marked in two taps, and the round
// can ask about it. Also the row that opens it (the Games tab's This week).
//
// A researched question (the bot's, about the episodes: src/lib/server/trivia.ts) waits after it's answered with what happened
// and where that's from, and Next; "Wrong?" takes it out of your rounds (and everyone's, once two people say so).

export type TriviaTarget = { seasonId: string; couchId: string | null };

type Store = { target: TriviaTarget | null; n: number };
let store: Store = { target: null, n: 0 };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const SERVER: Store = { target: null, n: 0 };

/** Open this week's trivia on a season's show. */
export function openTrivia(target: TriviaTarget) {
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
export function TriviaSheets() {
  const { target, n } = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => store,
    () => SERVER
  );
  return <TriviaSheet key={n} target={target} onOpenChange={(o) => !o && close()} />;
}

/** "You beat riley's 2", "Level with riley", "riley still holds the couch record", or how you did on your own. */
function againstCouch(r: TriviaRound, score: number, of: number): string {
  const best = r.couch[0];
  if (!best) return r.scope === "couch" ? "First on the couch to play it this week" : score === of ? "Every one right" : `${score} of ${of}`;
  if (score > best.score) return `You beat ${best.name}'s ${best.score}`;
  if (score === best.score) return `Level with ${best.name}`;
  return `${best.name} still holds the couch record`;
}

function TriviaSheet({ target, onOpenChange }: { target: TriviaTarget | null; onOpenChange: (open: boolean) => void }) {
  const open = !!target;
  const q = useTrivia(target?.seasonId ?? null, target?.couchId ?? null, open);
  const r = q.data;
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={r?.title ?? "Trivia"} subtitle={r?.line}>
      {q.isPending && open ? (
        <div aria-busy className="h-[320px] animate-pulse rounded-[4px] bg-secondary" />
      ) : !r || !target ? (
        <p className="py-4 text-sm text-muted-foreground">Couldn&apos;t load it. Try again in a moment.</p>
      ) : !r.questions.length ? (
        <>
          <p className="py-4 text-[15px] leading-snug" data-trivia-none>
            Nothing to ask yet. Trivia comes from a season you&apos;ve seen to the end, or the one you&apos;re on once someone&apos;s gone home.
          </p>
          <PastSeasons target={target} r={r} />
        </>
      ) : (
        // A new round (Seen it all deals one) starts fresh: the questions are its identity.
        <Round key={r.questions.map((x) => x.id).join()} target={target} r={r} />
      )}
    </Sheet>
  );
}

/** The questions one at a time, then the score. Played already this week: the score first, and Play again. */
function Round({ target, r }: { target: TriviaTarget; r: TriviaRound }) {
  const after = useAfterTrivia();
  const [at, setAt] = useState(r.played ? r.questions.length : 0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [tapped, setTapped] = useState<string | null>(null);
  const [replay, setReplay] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  const done = at >= r.questions.length;
  const advance = async (next: Record<string, string>) => {
    setTapped(null);
    setAt((n) => n + 1);
    if (at + 1 >= r.questions.length && !r.played && !replay) {
      try {
        after(target.seasonId, target.couchId, await triviaApi.play(target.seasonId, target.couchId, next));
      } catch (e) {
        toast.quiet((e as Error).message);
      }
    }
  };
  const answer = (q: TriviaQuestion, key: string) => {
    if (tapped) return;
    setTapped(key);
    const next = { ...answers, [q.id]: key };
    setAnswers(next);
    // One with a line on what happened waits for Next; the rest move on by themselves.
    if (!q.why) timer.current = setTimeout(() => void advance(next), 1100);
  };
  if (done) {
    const score = replay || !r.played ? r.questions.filter((q) => answers[q.id] === q.answer).length : r.played.score;
    const of = replay || !r.played ? r.questions.length : r.played.of;
    return (
      <div data-trivia-sheet data-trivia-done className="pb-2">
        <div className="nd-beat py-2 text-center">
          <b data-trivia-score className="type-num block text-[96px] leading-none text-chyron-line">
            {score}/{of}
          </b>
          <p className="mt-1.5 text-[17px] font-semibold" data-trivia-against>
            {replay ? "Just for fun: your first go counts" : againstCouch(r, score, of)}
          </p>
          {r.couch.length > 0 && (
            <p className="mt-1.5 text-sm text-muted-foreground" data-trivia-couch>
              {r.couch
                .slice(0, 3)
                .map((p) => `${p.name} ${p.score}`)
                .join(" · ")}
            </p>
          )}
        </div>
        <Btn
          tone="ink"
          wide
          className="mt-4"
          data-trivia-again
          onClick={() => {
            setReplay(true);
            setAnswers({});
            setAt(0);
          }}
        >
          Play again
        </Btn>
        <PastSeasons target={target} r={r} />
      </div>
    );
  }
  const q = r.questions[at];
  return (
    <div data-trivia-sheet data-trivia-q={q.id}>
      <div className="mb-3.5 flex gap-1" aria-hidden>
        {r.questions.map((x, i) => (
          <i key={x.id} className={`h-1 flex-1 rounded-[1px] ${i <= at ? "bg-chyron" : "bg-border"}`} />
        ))}
      </div>
      <p className="text-[20px] font-bold leading-[1.3]" data-trivia-lead>
        {q.lead}
      </p>
      {q.what && <p className="mt-1 text-[16px] font-semibold text-muted-foreground">{q.what}</p>}
      <div className="mt-3.5 flex flex-col gap-2">
        {q.options.map((o) => {
          const right = tapped && o.key === q.answer;
          const wrong = tapped === o.key && o.key !== q.answer;
          return (
            <button
              key={o.key}
              type="button"
              data-trivia-option={o.label}
              disabled={!!tapped}
              onClick={() => answer(q, o.key)}
              className={`flex min-h-14 w-full items-center gap-3 rounded-[3px] px-3.5 text-left text-base font-semibold transition-[background,transform] duration-200 disabled:opacity-100 ${
                right ? "bg-good text-good-foreground" : wrong ? "nd-shake bg-live text-live-foreground" : "bg-secondary"
              }`}
            >
              {(o.photo || !q.id.startsWith("r:")) && <Face src={o.photo} name={o.label} className="size-10 flex-none rounded-[2px] text-[16px]" />}
              {o.label}
            </button>
          );
        })}
      </div>
      {tapped && q.why && (
        <div className="nd-beat mt-3.5" data-trivia-why>
          <p className="text-[15px] leading-snug">{q.why}</p>
          {q.source && (
            <a href={q.source} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-[13px] text-muted-foreground underline underline-offset-2">
              {hostOf(q.source)}
            </a>
          )}
          <div className="mt-3 flex items-center gap-2">
            <Btn tone="ink" className="flex-1" data-trivia-next onClick={() => void advance(answers)}>
              {at + 1 >= r.questions.length ? "See your score" : "Next"}
            </Btn>
            <FlagButton seasonId={target.seasonId} question={q.id} />
          </div>
        </div>
      )}
    </div>
  );
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** "Wrong?": this researched question isn't asked again (you now; everyone, once two people say so). It still counts this time. */
function FlagButton({ seasonId, question }: { seasonId: string; question: string }) {
  const [sent, setSent] = useState(false);
  return (
    <Btn
      className="h-11 flex-none px-3.5 text-sm"
      disabled={sent}
      data-trivia-flag
      onClick={async () => {
        setSent(true);
        try {
          await triviaApi.flag(seasonId, question);
          toast("Thanks: it won't be asked again");
        } catch (e) {
          setSent(false);
          toast.quiet((e as Error).message);
        }
      }}
    >
      {sent ? "Flagged" : "Wrong?"}
    </Btn>
  );
}

/** Earlier seasons over and not marked seen to the end: Seen it all (asked once more: "Yes, all 13"), then trivia can ask about it. */
function PastSeasons({ target, r }: { target: TriviaTarget; r: TriviaRound }) {
  const after = useAfterTrivia();
  const [sure, setSure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!r.past?.length) return null;
  const mark = async (seasonId: string, label: string) => {
    if (sure !== seasonId) return setSure(seasonId);
    setBusy(true);
    try {
      after(target.seasonId, target.couchId, await triviaApi.seenAll(target.seasonId, target.couchId, seasonId));
      toast(`${label}: seen to the end. Trivia can ask about it now`);
      setSure(null);
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="mt-6 text-left" data-trivia-past>
      <b className="block text-[15px] font-semibold">Seen an earlier season?</b>
      <small className="block text-[13px] leading-snug text-muted-foreground">Mark one you&apos;ve seen to the end and trivia asks about it too. Its stats open up as well.</small>
      {r.past.map((s) => (
        <div key={s.seasonId} data-trivia-past-season={s.label} className="flex min-h-[56px] items-center gap-3 border-t border-border py-2 first-of-type:mt-2">
          <span className="min-w-0 flex-1">
            <b className="block truncate text-[15px] font-semibold">{s.label}</b>
            <small className="text-[13px] text-muted-foreground">All {s.episodes} episodes</small>
          </span>
          <Btn className="h-10 flex-none px-3.5 text-sm" disabled={busy} data-seen-all={s.seasonId} onClick={() => mark(s.seasonId, s.label)}>
            {sure === s.seasonId ? `Yes, all ${s.episodes}` : "Seen it all"}
          </Btn>
        </div>
      ))}
    </section>
  );
}

// ---------- where it opens from ----------

/** This week's round on a show: "Survivor 49 trivia · 3 questions from the real season", or your score once you've played. */
export function TriviaRow({ target, icon }: { target: TriviaTarget; icon?: boolean }) {
  const q = useTrivia(target.seasonId, target.couchId);
  const r = q.data;
  if (!r || !r.questions.length) return null;
  const best = r.couch[0];
  const line = r.played ? `You got ${r.played.score} of ${r.played.of}${best ? ` · ${best.name} got ${best.score}` : ""}` : `${r.line}${best ? ` · ${best.name} got ${best.score}` : ""}`;
  return (
    <button
      type="button"
      data-trivia-row={r.showId}
      data-trivia-played={r.played ? "yes" : "no"}
      onClick={() => openTrivia(target)}
      className="nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border py-2 text-left"
    >
      {icon && <IconBox icon={CircleQuestionMark} />}
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-semibold">{r.title}</b>
        <small className="mt-0.5 block text-[13px] text-muted-foreground">{line}</small>
      </span>
      <span className="text-[13px] font-semibold text-muted-foreground">{r.played ? "Played" : "Play"}</span>
      <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
    </button>
  );
}
