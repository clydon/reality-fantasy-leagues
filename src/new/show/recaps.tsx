"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Loader2, Sparkles, X } from "lucide-react";
import { recaps, useRecaps, type AskedEpisode, type ResearchNow, type SeasonEpisodes } from "../data";
import type { ShowData } from "../screens/show-space";
import { Btn, CaptionPlate } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";

// Fill in what happened (episode-recaps.ts, db/migrations/0143) on a show's Episodes tab: when episodes you've seen only say when
// they aired, one card asks ChatGPT what happened in each (our bot, else copy and paste the same prompt). The recaps are the
// season's, everyone's, and each row shows its own once you've seen it. While our bot asks, the card says so and the read polls;
// when it's done, the episodes read again.
//
// For a show made a game that nobody plays, the same ask looks up each episode's results (research-asks.ts, 0152), one at a
// time on the bot's clock: the card shows each episode's progress (waiting, being looked up, in, not found), and as each comes
// in the Cast tab's stats and the episodes read again. Whoever asked gets a notification as each one lands, so the page can be
// left. The Cast tab shows the same card (`eps` null: results only) while it has nothing to count.

/** "Episode 4", "Episodes 1–7". */
function episodesLabel(ns: number[], w: ShowData["words"]): string {
  const [lo, hi] = [Math.min(...ns), Math.max(...ns)];
  return ns.length === 1 ? `${w.episode} ${lo}` : `${w.episodes} ${lo}–${hi}`;
}

export function RecapsCard({ seasonId, show, eps }: { seasonId: string; show: ShowData; eps: SeasonEpisodes | null }) {
  const blank = eps ? eps.episodes.filter((e) => e.status === "aired" && e.watched && !e.summary).map((e) => e.number) : [];
  // A show made a game (not a sport) may have results to look up; the server says whether it's ours to (nobody plays it).
  const game = show.ready && show.header?.show.kind !== "sport";
  const state = useRecaps(seasonId, blank.length > 0 || game);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [paste, setPaste] = useState(false);
  const asking = !!state.data?.asking;
  const results = state.data?.results ?? null;
  const asked = results?.asked ?? [];
  const going = asked.filter((a) => a.status === "waiting" || a.status === "asking");
  const failed = asked.filter((a) => a.status === "failed").map((a) => a.episode);
  const done = asked.filter((a) => a.status === "done");
  const missing = results?.missing ?? [];
  const was = useRef(asking);
  // The recaps' ask finished: read the episodes again, and say how it went.
  useEffect(() => {
    if (was.current && !asking) {
      qc.invalidateQueries({ queryKey: ["new-design", "episodes", seasonId] });
      if (state.data?.message) toast.quiet(state.data.message);
      else toast("Filled in what happened");
    }
    was.current = asking;
  }, [asking, qc, seasonId, state.data?.message]);
  // An episode's results came in: the stats and the episodes read again; the last one says so.
  const doneCount = done.length;
  const wasDone = useRef<number | null>(null);
  const stillGoing = going.length;
  useEffect(() => {
    if (wasDone.current !== null && doneCount > wasDone.current) {
      qc.invalidateQueries({ queryKey: ["new-design", "episodes", seasonId] });
      qc.invalidateQueries({ queryKey: ["new-design", "stats", seasonId] });
      if (!stillGoing) toast("Every episode's results are in");
    }
    if (state.data) wasDone.current = doneCount;
  }, [doneCount, stillGoing, qc, seasonId, state.data]);

  const resultsToAsk = missing.length + failed.length;
  const busyNow = asking || going.length > 0;
  if (!blank.length && !busyNow && !resultsToAsk) return null;
  const w = show.words;
  const ep = w.episode.toLowerCase();
  const people = w.peopleTab;
  const ask = async () => {
    setBusy(true);
    try {
      qc.setQueryData(["new-design", "recaps", seasonId], await recaps.ask(seasonId));
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const shared = "Everyone on the show sees them, only for the ones they've seen.";
  const line = busyNow
    ? going.length
      ? `ChatGPT is looking it up, one ${ep} at a time. We'll tell you as each one comes in, so you can leave this page.`
      : "ChatGPT is looking it up. It takes a minute or two; you can leave this page."
    : blank.length && missing.length
      ? `${episodesLabel(blank, w)} only say when ${blank.length === 1 ? "it" : "they"} aired. ChatGPT can look up what happened in each, then everyone's results one ${ep} at a time, so ${people} can count their stats. ${shared}`
      : blank.length
        ? `${episodesLabel(blank, w)} only say when ${blank.length === 1 ? "it" : "they"} aired. ChatGPT can look up ${show.header?.show.kind === "sport" ? "the score, who won and who stood out" : "what happened"} in each. ${shared}`
        : missing.length
          ? `${episodesLabel(missing, w)} ${missing.length === 1 ? "has" : "have"} no results yet. ChatGPT can look them up one ${ep} at a time, so ${people} can count everyone's stats. ${shared}`
          : `ChatGPT couldn't find ${episodesLabel(failed, w)}'s results.`;
  return (
    <section className="mt-[18px] px-4" data-recaps={busyNow ? "asking" : "ask"}>
      <div className="flex flex-col gap-2 rounded-[4px] bg-card p-4 outline-1 -outline-offset-1 outline-border">
        <b className="flex items-center gap-2 text-[17px] leading-tight">
          <Sparkles className="size-[18px] flex-none" aria-hidden />
          {busyNow ? "Filling in what happened" : "Fill in what happened"}
        </b>
        <small className="text-[13.5px] leading-snug text-muted-foreground">{line}</small>
        {!asking && state.data?.message && <small className="text-[13px] font-semibold leading-snug text-live">{state.data.message}</small>}
        {asked.length > 0 && <ResultsProgress asked={asked} now={results?.now ?? null} words={w} />}
        {!busyNow && (
          <div className="mt-1 flex flex-col gap-1.5">
            {state.data?.available !== false && (
              <Btn tone="must" wide data-recaps-ask disabled={busy || !state.data} onClick={ask}>
                {busy ? "Asking…" : !blank.length && !missing.length ? "Try again" : "Ask ChatGPT for me"}
              </Btn>
            )}
            {blank.length > 0 && (
              <button type="button" data-recaps-paste onClick={() => setPaste(true)} className="self-start py-1.5 text-[13px] font-semibold text-muted-foreground underline underline-offset-2">
                {state.data?.available === false ? "Our bot's away: copy and paste instead" : "Or copy and paste it yourself"}
              </button>
            )}
            {!blank.length && state.data?.available === false && <small className="text-[13px] leading-snug text-muted-foreground">{"Our bot's away right now. Try again in a little while."}</small>}
          </div>
        )}
      </div>
      <PasteSheet
        open={paste}
        onOpenChange={setPaste}
        prompt={async () => (await recaps.prompt(seasonId)).prompt}
        save={async (answer) => {
          const out = await recaps.paste(seasonId, answer);
          qc.setQueryData(["new-design", "recaps", seasonId], out);
          await qc.invalidateQueries({ queryKey: ["new-design", "episodes", seasonId] });
          return out.filled;
        }}
      />
    </section>
  );
}

const STATUS_WORDS: Record<AskedEpisode["status"], string> = { waiting: "waiting its turn", asking: "being looked up", done: "in", failed: "not found" };
/** What an episode looked up already is asked again for (the maker's scoring added a question: scoring.tsx). */
const AGAIN_WORDS: Record<NonNullable<AskedEpisode["again"]>, string> = { missing: "The new question", full: "Everything again" };

/** How many times `sig` has changed while this was on screen: 0 until it does. Keyed on it, an element animates for a change
 *  you watched, never on arrival (Up next's useChangeCount, overview/up-next.tsx). */
function useChangeCount(sig: string): number {
  const [s, setS] = useState({ sig, n: 0 });
  if (s.sig !== sig) setS({ sig, n: s.n + 1 });
  return s.n;
}

/** The episodes whose chip changed while you watched (went live, or landed), and how many changes so far (a key, so each
 *  plays its settle once). */
function useLanded(asked: AskedEpisode[]): { landed: Set<number>; n: number } {
  const sig = asked.map((a) => `${a.episode}:${a.status}`).join(",");
  const [s, setS] = useState({ sig, landed: new Set<number>(), n: 0 });
  if (s.sig !== sig) {
    const before = new Map(s.sig.split(",").filter(Boolean).map((x) => x.split(":") as [string, string]));
    const landed = new Set(asked.filter((a) => before.has(String(a.episode)) && before.get(String(a.episode)) !== a.status && (a.status === "asking" || a.status === "done")).map((a) => a.episode));
    setS({ sig, landed, n: s.n + 1 });
  }
  return { landed: s.landed, n: s.n };
}

const RISE = { "--rise": "6px", "--dur": "160ms" } as CSSProperties;

/** Each asked episode's results as a chip: in (with how many), being looked up (its meter rising as its people are written
 *  up), waiting its turn, or not found; under them the roll call for the one being asked now. Between runs, and the moment
 *  something's asked (or asked again), the next in the queue shows as starting: the bot's clock picks it up within a minute,
 *  and the card shouldn't look idle meanwhile. */
function ResultsProgress({ asked, now, words: w }: { asked: AskedEpisode[]; now: ResearchNow | null; words: ShowData["words"] }) {
  const done = asked.filter((a) => a.status === "done");
  const found = done.reduce((n, a) => n + (a.found ?? 0), 0);
  const next = !now ? asked.find((a) => a.status === "waiting") : undefined;
  const shown: ResearchNow | null = now ?? (next ? { episode: next.episode, stage: "waiting", done: null, of: null, share: null } : null);
  const { landed, n: landings } = useLanded(asked);
  const countCue = useChangeCount(String(done.length));
  // A new episode coming on while you watch (not the one already on when you arrived): its plate comes on from the left.
  const episodeCue = useChangeCount(String(shown?.episode ?? ""));
  return (
    <div className="mt-1" data-results-progress>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="type-caption text-[13px] tracking-[0.04em] text-muted-foreground">Results</span>
        <small className="text-[12.5px] text-muted-foreground" data-results-count>
          <span key={countCue} className={`inline-block ${countCue ? "chat-in" : ""}`} style={RISE}>
            {done.length}
          </span>{" "}
          of {asked.length} in{found ? ` · ${found} ${found === 1 ? "result" : "results"} so far` : ""}
        </small>
      </div>
      <ol className="flex flex-wrap gap-1.5">
        {asked.map((a) => {
          const live = a.status === "asking" && now?.episode === a.episode;
          const meter = live && now ? (now.share ?? 0) : 0;
          // The next in the queue, about to start: it reads as underway (a spinner, the live outline).
          const starting = !now && next?.episode === a.episode;
          return (
            <li
              key={`${a.episode}:${landed.has(a.episode) ? landings : 0}`}
              data-result-ep={a.episode}
              data-status={a.status}
              aria-label={`${w.episode} ${a.episode}${a.again ? ` (${AGAIN_WORDS[a.again].toLowerCase()})` : ""}: ${STATUS_WORDS[a.status]}${a.status === "done" && a.found != null ? `, ${a.found} results` : ""}`}
              className={`relative isolate flex h-8 min-w-10 items-center justify-center gap-1 overflow-hidden rounded-[3px] px-2 text-[13px] font-bold tabular-nums ${
                a.status === "done"
                  ? "bg-foreground text-background"
                  : a.status === "asking" || starting
                    ? "outline-[1.5px] -outline-offset-1 outline-foreground"
                    : a.status === "failed"
                      ? "text-live outline-1 -outline-offset-1 outline-live"
                      : "bg-secondary text-muted-foreground"
              } ${landed.has(a.episode) ? "chip-land" : ""}`}
            >
              {/* The live episode's meter: it fills from the bottom as its people are written up. */}
              {live && (
                <span
                  aria-hidden
                  data-chip-meter
                  className="absolute inset-0 -z-10 origin-bottom bg-foreground/20 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
                  style={{ transform: `scaleY(${meter})` }}
                />
              )}
              {a.status === "done" && <Check className="size-3.5" aria-hidden />}
              {((a.status === "asking" && !live) || starting) && <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />}
              {a.status === "failed" && <X className="size-3.5" aria-hidden />}
              {a.episode}
            </li>
          );
        })}
      </ol>
      {shown && <RollCall key={shown.episode} now={shown} again={asked.find((a) => a.episode === shown.episode)?.again ?? null} words={w} arrived={episodeCue > 0} queued={!now} />}
    </div>
  );
}

/** What the plate says at each stage of the episode being asked now (`queued`: next in line, nothing running yet). */
function rollWords(now: ResearchNow, w: ShowData["words"], queued: boolean): { title: string; line: string } {
  const people = w.people.toLowerCase();
  if (queued) return { title: "Starting", line: "Our bot picks it up within a minute" };
  if (now.stage === "writing" && now.of != null && now.done != null) return { title: `${now.done} of ${now.of} written up`, line: `ChatGPT is writing up the ${people}` };
  if (now.stage === "writing") return { title: "Writing it up", line: "No head count before you've seen it" };
  if (now.stage === "asking") return { title: "Searching", line: "ChatGPT is reading the recaps" };
  if (now.stage === "waiting") return { title: "Up next", line: "Our bot is finishing another question" };
  return { title: "Starting", line: "Opening ChatGPT" };
}

/**
 * The roll call: the episode being asked now as a broadcast graphic loading. Its caption plate (the stage, and the head count
 * once it's being written up), and under it a rail with a segment for each person, lighting as ChatGPT writes each one up, a
 * short stagger across the ones that arrive together; while it searches, a light sweeps the rail. For an episode you haven't
 * seen there's no head count, so the rail is one meter. `arrived`: it came on while you watched (its plate comes on from the
 * left). `queued`: next in line with nothing running yet (starting: the light sweeps). `again`: an episode looked up already,
 * asked again (its plate says for what).
 */
function RollCall({ now, again, words: w, arrived, queued }: { now: ResearchNow; again: AskedEpisode["again"]; words: ShowData["words"]; arrived: boolean; queued: boolean }) {
  const { title, line } = rollWords(now, w, queued);
  const counted = now.of != null && now.done != null && now.of > 0 && now.of <= 60;
  const lit = counted ? Math.min(now.done!, now.of!) : 0;
  // What was lit before this render, kept as the count moves: what lights now is what's new (never what was lit on arrival).
  const [s, setS] = useState({ lit, from: lit, base: lit });
  if (s.lit !== lit) setS({ lit, from: s.lit, base: s.base });
  const searching = now.stage !== "writing";
  const titleCue = useChangeCount(title);
  return (
    <div className={`mt-3 ${arrived ? "roll-in" : ""}`} data-results-now data-queued={queued ? "" : undefined} aria-live="polite">
      <CaptionPlate
        size="sm"
        tone="quiet"
        tag={`${w.ep} ${now.episode}`}
        title={
          <span key={titleCue} className={`block ${titleCue ? "chat-in" : ""}`} style={RISE}>
            {title}
          </span>
        }
        subtitle={again ? <span data-results-again={again}>{`${AGAIN_WORDS[again]} · ${line}`}</span> : line}
      />
      <div className="relative mt-2 h-2.5 overflow-hidden" data-results-rail={counted ? now.of : "meter"} aria-hidden>
        {counted ? (
          <div className="flex h-full gap-[2px]">
            {Array.from({ length: now.of! }, (_, i) => {
              const on = i < lit;
              const fresh = on && i >= s.from && i >= s.base;
              return (
                <i
                  key={i}
                  data-seg={on ? "on" : "off"}
                  className={`h-full min-w-0 flex-1 rounded-[1px] bg-foreground ${on ? "" : "opacity-[0.16]"} ${fresh ? "seg-lit" : ""}`}
                  style={fresh ? { animationDelay: `${Math.min(i - s.from, 8) * 45}ms` } : undefined}
                />
              );
            })}
          </div>
        ) : (
          <div className="h-full rounded-[1px] bg-foreground/[0.16]">
            <i
              className="block h-full origin-left rounded-[1px] bg-foreground transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
              style={{ transform: `scaleX(${now.share ?? 0})` }}
            />
          </div>
        )}
        {/* While ChatGPT searches, a light crosses the rail (the loading mark's sweep). */}
        {searching && <i className="roll-sweep absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-foreground/45 to-transparent" />}
      </div>
    </div>
  );
}

/** Copy and paste: the prompt to copy into any AI chat that searches the web, and its answer pasted back (`save` answers how many
 *  it filled in). Fill in what happened's, and Fill in who's playing's (roster.tsx). */
export function PasteSheet({
  open,
  onOpenChange,
  prompt,
  save: send,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  prompt: () => Promise<string>;
  save: (answer: string) => Promise<number>;
}) {
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(await prompt());
      toast("Copied. Paste it into ChatGPT, then paste its answer here");
    } catch (e) {
      toast.quiet((e as Error).message);
    }
  };
  const save = async () => {
    setBusy(true);
    try {
      toast(`Filled in ${await send(answer)}`);
      setAnswer("");
      onOpenChange(false);
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Copy and paste" subtitle="Any AI chat that searches the web">
      <div data-paste-sheet className="flex flex-col gap-3">
        <Btn wide data-paste-copy onClick={copy}>
          <Copy className="size-4" aria-hidden />
          Copy the question
        </Btn>
        <textarea
          data-paste-answer
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Paste its whole answer here"
          rows={6}
          className="w-full rounded-[3px] bg-background p-3 text-[15px] outline-2 -outline-offset-2 outline-border focus:outline-chyron-line"
        />
        <Btn tone="must" wide data-paste-save disabled={busy || !answer.trim()} onClick={save}>
          {busy ? "Saving…" : "Save"}
        </Btn>
      </div>
    </Sheet>
  );
}
