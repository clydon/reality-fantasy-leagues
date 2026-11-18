"use client";

import { useEffect, useState } from "react";
import type { Base, Spec } from "@/lib/game/start-gallery/index.js";
import type { GameWordsResult } from "@/lib/server/game-words";
import { wizardApi } from "../../data";
import { toast } from "../../ui/toast";
import { jobKey, runJob, setLooking, useJobs, type Job } from "./ai-jobs";
import { searchBases, type Input } from "./model";
import { BaseSquare, FOCUS, Label } from "./parts";

// Describe your game (docs/PLAN-start-a-game-redo.md B1; the bold pass's Describe, Round 2's fixture made real): your words, our AI's
// one turn (the wait, about 40 seconds, kept past the sheet: ai-jobs.ts), its errors (away, today's asks used, no game in the words),
// and the result as the design drew it: What we heard (what made it in marked, what can't count yet struck), One thing to settle (our
// check's questions; an answer our check can't make alone goes back to our AI as a typed change), then Start it or Open it to change
// more. A moment the show doesn't track yet can be added for research from here, as today's wizard did.

type Result = Extract<GameWordsResult["result"], { spec: unknown }>;

const EXAMPLES = ["Each episode, pick who goes home; a bonus for calling the winner", "Draft 3 each, no negative points, most points wins", "Head to head every week, only the challenges count"];

export function DescribeBody({
  input,
  words: initial,
  bases,
  onOpen,
  onStart,
  onBase,
  onAdded,
}: {
  input: Input;
  words: string;
  bases: Base[];
  /** The game our AI made, opened on its screen to change more. */
  onOpen: (spec: Spec, name: string) => void;
  /** Start it as it is. */
  onStart: (spec: Spec, name: string, askId: string) => void;
  /** A base by tapping instead (the closest to their words). */
  onBase: (b: Base) => void;
  /** A moment added to the season for research: the page read again. */
  onAdded: () => void;
}) {
  const job = useJobs()[jobKey(input.seasonId)] ?? null;
  const [words, setWords] = useState(job?.words ?? initial);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    setLooking(input.seasonId);
    return () => setLooking(null);
  }, [input.seasonId]);
  const build = (text: string) => {
    const w = text.trim();
    if (!w) return toast.quiet("Say the game in your words first");
    setEditing(false);
    runJob({ seasonId: input.seasonId, couchId: input.couch.id, words: w }, () => wizardApi.words(input.seasonId, input.couch.id, w));
  };
  const err = job?.state === "error" ? job.error ?? null : null;
  const r = job?.state === "done" ? job.result?.result ?? null : null;
  const nothing = !!r && (r.state === "unreadable" || r.state === "none");
  const which = err?.status === 503 ? "away" : err?.status === 429 ? "used" : nothing ? "none" : err ? "other" : null;
  const closest = searchBases(words, bases).slice(0, 2);

  if (!job || editing || which) {
    return (
      <div data-gallery-describe={which ?? "compose"} className="flex flex-col gap-3">
        <div>
          <label htmlFor="describe-words" className="type-caption mb-1.5 block text-[13px] tracking-[0.05em] text-muted-foreground">
            Your game, in your words
          </label>
          <textarea
            id="describe-words"
            data-gallery-describe-words
            value={words}
            onChange={(e) => setWords(e.target.value)}
            maxLength={2000}
            placeholder="Say it like you'd tell the couch"
            className="min-h-28 w-full resize-none rounded-[4px] border border-input bg-background p-3 text-[16px] leading-[1.45] outline-none placeholder:text-muted-foreground/70 focus:border-chyron-line"
          />
        </div>
        {which && which !== "used" && !editing && (
          <div role="alert" className="rounded-[4px] border border-dashed border-edge p-3">
            <b className="block text-[15px] font-semibold">{which === "away" ? "Our AI is away right now" : which === "none" ? "No game in those words yet" : "That one didn't build"}</b>
            <p className="mt-1 text-[14px] leading-snug text-muted-foreground">
              {which === "away"
                ? "That one didn't count, and your words are kept. Everything in the gallery works by tapping: the closest games are below."
                : which === "none"
                  ? "Our AI couldn't find what everyone does or how someone wins. Say it like you'd tell the couch."
                  : err?.message}
            </p>
          </div>
        )}
        {which === "used" ? (
          <div role="alert" className="rounded-[4px] border border-dashed border-edge p-3">
            <b className="block text-[15px] font-semibold">That&rsquo;s today&rsquo;s asks</b>
            <p className="mt-1 text-[14px] leading-snug text-muted-foreground">More tomorrow; your words are kept. Every game in the gallery still works by tapping.</p>
          </div>
        ) : (
          <button type="button" data-gallery-describe-build onClick={() => build(words)} className={`nd-press type-caption flex h-[52px] w-full items-center justify-center rounded-[3px] text-[20px] ${words.trim() ? "bg-chyron text-chyron-foreground" : "bg-secondary text-muted-foreground"} ${FOCUS}`}>
            {which === "away" ? "Try again" : "Build it"}
          </button>
        )}
        <p className="text-[13px] leading-snug text-muted-foreground">
          Our AI reads {input.label}&rsquo;s rules and moments and writes a game our engine can play, in about 40 seconds{input.asksLeft != null ? ` · ${input.asksLeft} asks left today` : ""}. You see what it heard before anything starts.
        </p>
        {which && closest.length > 0 ? (
          <div>
            <Label>Closest by tapping</Label>
            <div className="grid grid-cols-2 gap-3">
              {closest.map(({ base }) => (
                <BaseSquare key={base.id} base={base} state="plays" onOpen={() => onBase(base)} />
              ))}
            </div>
          </div>
        ) : !which ? (
          <div>
            <Label>Or start from one of these</Label>
            <div className="flex flex-col gap-2">
              {EXAMPLES.map((x) => (
                <button key={x} type="button" onClick={() => setWords(x)} className="nd-press min-h-12 rounded-[4px] border border-input px-3 py-2.5 text-left text-[14px] leading-snug">
                  {x}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }
  if (job.state === "wait")
    return (
      <div data-gallery-describe="wait" className="flex flex-col items-start gap-3">
        <p className="text-[15px] leading-snug">&ldquo;{job.words}&rdquo;</p>
        <div className="w-full rounded-[4px] bg-secondary p-3">
          <span className="type-caption text-[17px]">Our AI is building it</span>
          <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-background">
            <i className="roll-sweep absolute inset-y-0 left-0 w-1/3 rounded-full bg-foreground/70" />
          </div>
          <p className="mt-2 text-[13px] text-muted-foreground">About 40 seconds. Leave if you like: we&rsquo;ll tell you when it&rsquo;s in.</p>
        </div>
      </div>
    );
  return <Heard input={input} job={job} r={r as Result} onOpen={onOpen} onStart={onStart} onAdded={onAdded} onWords={() => { setWords(job.words); setEditing(true); }} />;
}

/** The result: what we heard, what's left to settle, and the game. */
function Heard({ input, job, r, onOpen, onStart, onAdded, onWords }: { input: Input; job: Job; r: Result; onOpen: (spec: Spec, name: string) => void; onStart: (spec: Spec, name: string, askId: string) => void; onAdded: () => void; onWords: () => void }) {
  const [picks, setPicks] = useState<Record<number, number>>({});
  const askId = job.result!.id;
  const playable = !!(r.spec && r.describe && !r.problems.length);
  const segs = segments(job.words, r.said.map((s) => s.quote), r.cantYet.map((x) => x.what));
  const name = r.describe?.short.title ?? "Your game";
  const change = (text: string) =>
    runJob({ seasonId: input.seasonId, couchId: input.couch.id, words: job.words }, () => wizardApi.change(input.seasonId, input.couch.id, { from: askId, words: text }));
  return (
    <div data-gallery-describe="result" className="flex flex-col gap-4">
      <div>
        <Label>What we heard</Label>
        <p data-gallery-heard className="text-[15px] leading-snug">
          {segs.map((s, i) =>
            s.k === "ok" ? (
              <mark key={i} className="rounded-[2px] bg-foreground/15 px-0.5 text-foreground">
                {s.t}
              </mark>
            ) : s.k === "cant" ? (
              <span key={i} className="text-muted-foreground line-through decoration-1">
                {s.t}
              </span>
            ) : (
              <span key={i}>{s.t}</span>
            )
          )}
        </p>
        {r.cantYet.length > 0 && <p className="mt-2 text-[13px] leading-snug text-muted-foreground">{r.cantYet.map((x) => x.why).join(" ")}</p>}
      </div>
      {playable ? (
        <div className="rounded-[4px] bg-secondary p-3">
          <b className="type-caption block text-[22px]">{name}</b>
          <p className="mt-1 text-[14px]">{r.describe!.short.line}</p>
          <p className="mt-2 text-[14px] leading-snug text-muted-foreground">{r.describe!.sentence}</p>
        </div>
      ) : (
        <p className="type-caption text-[20px]">Not a game our engine can play yet</p>
      )}
      {r.ask.length > 0 && (
        <div data-gallery-interview>
          <Label>{r.ask.length === 1 ? "One thing to settle" : `${r.ask.length} things to settle`}</Label>
          {r.ask.map((a, qi) => (
            <div key={qi} className="mt-2 first:mt-0">
              <p className="mb-2 text-[15px] font-semibold">{a.question}</p>
              <div className="flex flex-col gap-2">
                {a.options.map((opt, oi) => {
                  const on = (picks[qi] ?? 0) === oi;
                  return (
                    <button
                      key={opt}
                      type="button"
                      data-gallery-answer={`${qi}:${oi}`}
                      aria-pressed={on}
                      onClick={() => {
                        setPicks({ ...picks, [qi]: oi });
                        // The first is what it chose; another goes back to our AI as a typed change (its wait again).
                        if (oi > 0 && !(a.part === "newMoment" && a.moment)) change(`${a.question} ${opt}`);
                      }}
                      className={`nd-press rounded-[4px] p-3 text-left text-[15px] font-semibold ${on ? "bg-foreground text-background" : "bg-secondary"}`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {a.part === "newMoment" && a.moment && <NewMoment input={input} askId={askId} index={r.offers.moments?.findIndex((m) => m.label === a.moment!.label) ?? 0} moment={a.moment} onAgain={() => runJob({ seasonId: input.seasonId, couchId: input.couch.id, words: job.words }, () => wizardApi.words(input.seasonId, input.couch.id, job.words))} onAdded={onAdded} />}
            </div>
          ))}
        </div>
      )}
      {r.assumed.length > 0 && (
        <div>
          <Label>We filled in</Label>
          {r.assumed
            .filter((x, i, all) => all.findIndex((y) => y.why === x.why && String(y.value) === String(x.value)) === i)
            .slice(0, 4)
            .map((x, i) => (
              <p key={i} className="mt-1 text-[14px] leading-snug text-muted-foreground">
                <b className="font-semibold text-foreground">{typeof x.value === "object" ? x.part : String(x.value)}</b> · {x.why}
              </p>
            ))}
        </div>
      )}
      <div className="flex flex-col gap-2">
        {playable && (
          <>
            <button type="button" data-gallery-describe-start onClick={() => onStart(r.spec as Spec, name, askId)} className={`nd-press type-caption flex h-[52px] w-full items-center justify-center rounded-[3px] bg-chyron text-[20px] text-chyron-foreground ${FOCUS}`}>
              Start it
            </button>
            <button type="button" data-gallery-describe-open onClick={() => onOpen(r.spec as Spec, name)} className="nd-press h-12 w-full rounded-[3px] text-[15px] font-bold outline-1 -outline-offset-1 outline-input">
              Open it to change more
            </button>
          </>
        )}
        <button type="button" data-gallery-describe-words-again onClick={onWords} className="h-11 text-[14px] font-semibold underline decoration-1 underline-offset-[3px]">
          Change the words
        </button>
      </div>
    </div>
  );
}

/** A moment our check offered: add it to the season (research asks it from the next episode), then ask again to count it. */
function NewMoment({ input, askId, index, moment, onAgain, onAdded }: { input: Input; askId: string; index: number; moment: { label: string; question: string; reliable: string; why: string }; onAgain: () => void; onAdded: () => void }) {
  const [state, setState] = useState<"idle" | "adding" | "added">("idle");
  return (
    <div data-gallery-new-moment className="mt-2 rounded-[4px] bg-secondary p-3">
      <p className="text-[14px] leading-snug">
        <b className="font-semibold">{moment.reliable === "high" ? "Recaps always say" : "Recaps usually say"}</b> · {moment.why}
      </p>
      {state === "added" ? (
        <div className="mt-2 flex flex-col items-start gap-2">
          <p className="text-[13px] text-muted-foreground">
            Research asks &ldquo;{moment.question}&rdquo; from the next {input.ep}. Ask again and your game counts it.
          </p>
          <button type="button" onClick={onAgain} className="min-h-11 rounded-[4px] border border-foreground px-3.5 text-[14px] font-semibold">
            Ask again with it
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={state === "adding"}
          onClick={async () => {
            setState("adding");
            try {
              await wizardApi.addMoment(input.seasonId, askId, Math.max(0, index));
              setState("added");
              onAdded();
            } catch (e) {
              setState("idle");
              toast.quiet((e as Error).message);
            }
          }}
          className="mt-2 min-h-11 rounded-[4px] border border-foreground px-3.5 text-[14px] font-semibold disabled:opacity-50"
        >
          {state === "adding" ? "Adding…" : `Add “${moment.label}” for research`}
        </button>
      )}
    </div>
  );
}

/** Their words cut into runs: in a said quote (made it in), in a can't-yet (struck), or neither. */
function segments(words: string, said: string[], cant: string[]) {
  const tag = new Array<string>(words.length).fill("");
  const lw = words.toLowerCase();
  const mark = (q: string, k: string) => {
    let s = q.toLowerCase().trim();
    let i = lw.indexOf(s);
    if (i < 0) {
      s = s.replace(/[.]$/, "");
      i = lw.indexOf(s);
    }
    if (i < 0 || !s) return;
    for (let j = i; j < i + s.length; j++) tag[j] = tag[j] === "cant" ? "cant" : k;
  };
  for (const q of said) mark(q, "ok");
  for (const q of cant) mark(q, "cant");
  const out: { k: string; t: string }[] = [];
  for (let j = 0; j < words.length; j++) {
    if (!out.length || out[out.length - 1].k !== tag[j]) out.push({ k: tag[j], t: "" });
    out[out.length - 1].t += words[j];
  }
  return out;
}


