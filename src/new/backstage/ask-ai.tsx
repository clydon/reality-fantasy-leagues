"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronRight, ClipboardPaste, Copy, EyeOff, CircleAlert, Zap } from "lucide-react";
import { chatLink, type ChatApp } from "@/lib/ai-brief";
import { backstage, useAfterResults, useAskRun, useWays, type AskRun, type PasteResult, type Ways } from "../data";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";

// Ask an AI (the mock's askai.js, docs/PLAN-new-design.md step 5): one sheet wherever a question needs answering by a
// chat that can search the web. A three-step track (Open · It answers · Paste it back); one big Open in ChatGPT (your
// last choice remembered on this device; Grok the other one that follows our links), and Another AI? Copy the question.
// Back from the chat, Paste the answer, a check that it looks whole, then Use this answer. The question itself is parked
// at /b/<code>.
//
// One tap (step 6c, the mock's bot.js): while our bot answers its health check, the sheet leads with "Ask ChatGPT for
// me", and copy and paste is one row below it. Who went home is always free; the full results ask for One tap to be
// unlocked for the couch ($1 a season, "Free during beta": nothing is charged), which the same tap does. The bot asks
// on the server while the sheet shows it searching (it can be closed: the run carries on, and opening the sheet again
// shows it); its answer goes in like a paste, so the sheet closes with the same toast and nothing is shown of it.

const APPS: Record<ChatApp, { name: string; colour: string; line: string }> = {
  chatgpt: { name: "ChatGPT", colour: "#10a37f", line: "Opens the ChatGPT app or chatgpt.com" },
  grok: { name: "Grok", colour: "#e8e8e8", line: "Opens Grok or grok.com" },
};
const PREF = "gys.ai";

function readPref(): ChatApp {
  try {
    return localStorage.getItem(PREF) === "grok" ? "grok" : "chatgpt";
  } catch {
    return "chatgpt";
  }
}

/** A pasted answer's self-check: whether it reads as the whole JSON answer, and a line saying so. */
export type AnswerCheck = (text: string) => { ok: boolean; line: string };

export interface AskAiProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** What the AI is asked to do, in a sentence. */
  what: string;
  /** Said before you open the chat, when its answer could spoil the episode for you. */
  spoiler?: string;
  seasonId: string;
  couchId: string;
  episode: number;
  kind: "quick" | "full";
  check: AnswerCheck;
  /** Sends the answer; throws with the reason (a 409 asks whether it really is this episode). */
  onUse: (answer: string, opts: { confirmed: boolean }) => Promise<void>;
  /** What One tap's answer did, once the bot is done (the sheet closes; say so as after a paste). */
  onTapped: (r: PasteResult) => Promise<void> | void;
  /** "Survivor 51", for One tap's unlock line. */
  seasonName: string;
}

export function AskAiSheet(props: AskAiProps) {
  const ways = useWays(props.seasonId, props.couchId, props.open);
  const [paste, setPaste] = useState(false);
  // Each time it opens: One tap first when the bot can take it.
  const [wasOpen, setWasOpen] = useState(props.open);
  if (props.open !== wasOpen) {
    setWasOpen(props.open);
    if (props.open) setPaste(false);
  }
  const w = ways.data;
  const locked = props.kind === "full" && !w?.tap.unlocked;
  // One tap is on offer when our bot answers, and for the full results it's unlocked here or you may unlock it.
  const tap = !!w?.bot.available && (!locked || w.canUnlock);
  const choosing = !paste && (tap || ways.isPending);
  const subtitle = !choosing
    ? "Ask an AI · free · about 2 minutes"
    : props.kind === "quick"
      ? "Who went home is always free"
      : locked
        ? "Get this episode's results in"
        : "One tap · unlocked for this season";
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange} title={props.title} subtitle={subtitle}>
      {props.open &&
        (ways.isPending && !paste ? (
          <div aria-busy className="h-44 animate-pulse rounded-[3px] bg-background" />
        ) : choosing && w ? (
          <OneTap {...props} ways={w} locked={locked} onPaste={() => setPaste(true)} />
        ) : (
          <AskAiBody {...props} />
        ))}
    </Sheet>
  );
}

/** A price in cents as it reads: "$1", "$4.50". */
export const priceOf = (cents: number) => `$${cents % 100 ? (cents / 100).toFixed(2) : cents / 100}`;

/** "Ask ChatGPT for me": the bot asks for you; copy and paste one row below. Then it's searching, done or not. */
function OneTap({ ways, locked, onPaste, ...props }: AskAiProps & { ways: Ways; locked: boolean; onPaste: () => void }) {
  const { seasonId, couchId, episode, kind } = props;
  const going = ways.running.find((r) => r.episode === episode && r.kind === kind) ?? null;
  const [runId, setRunId] = useState<string | null>(going?.id ?? null);
  const [asking, setAsking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const run = useAskRun(seasonId, couchId, runId);
  const refresh = useAfterResults();
  const ended = useRef<string | null>(null);
  const r: AskRun | null = run.data ?? (going && going.id === runId ? going : null);
  const shown = problem ?? (r?.status === "failed" ? (r.message ?? "ChatGPT didn't answer. Copy and paste works.") : null);

  // Done: what it did goes to the caller (the sheet closes); another couch's run just brings the results in.
  useEffect(() => {
    if (!r || r.status !== "done" || ended.current === r.id) return;
    ended.current = r.id;
    if (r.outcome) void props.onTapped(r.outcome);
    else {
      void refresh();
      toast(`Episode ${episode}'s results are in`);
      props.onOpenChange(false);
    }
  }, [r, episode, props, refresh]);

  const ask = async () => {
    setAsking(true);
    setProblem(null);
    try {
      if (locked) {
        await backstage.unlock(seasonId, couchId);
        void refresh();
        toast(`One tap unlocked for ${props.seasonName} · free during beta`);
      }
      const started = await backstage.ask(seasonId, couchId, episode, kind);
      setRunId(started.id);
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setAsking(false);
    }
  };

  if (r && r.status === "running") {
    const who = r.mine ? "" : r.here ? (r.by ? `${r.by} asked · ` : "") : "Asked from another couch · ";
    return (
      <div data-one-tap="running" aria-live="polite">
        <div className="flex items-center gap-3 pb-3 pt-1.5">
          <span className="size-[26px] flex-none animate-spin rounded-full border-[3px] border-border border-t-foreground motion-reduce:animate-none" aria-hidden />
          <span>
            <b className="block text-[16px]">ChatGPT is searching the web</b>
            <small className="block text-[13px] leading-snug text-muted-foreground">{who}Usually under 2 minutes · you can close this, it carries on</small>
          </span>
        </div>
        <div className="h-1 overflow-hidden rounded-[2px] bg-border">
          <i className="nd-asking block h-full w-2/5 bg-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div data-one-tap={locked ? "locked" : "ready"}>
      <p className="text-[15px] leading-snug">{props.what}</p>
      {props.spoiler && (
        <p className="mt-3 flex gap-2 rounded-[3px] bg-background px-3 py-2.5 text-[13px] leading-snug text-muted-foreground">
          <EyeOff className="mt-px size-4 flex-none" aria-hidden />
          Its answer says who went home, so you never see it: what its sources agree on applies on its own.
        </p>
      )}
      <button
        type="button"
        data-ask-bot
        onClick={ask}
        disabled={asking}
        className="nd-press mt-4 flex min-h-[72px] w-full items-center gap-3 rounded-[4px] bg-plate p-3.5 text-left text-plate-foreground disabled:opacity-70"
      >
        <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-chyron text-chyron-foreground">
          <Zap className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-[17px]">{asking ? "Asking…" : "Ask ChatGPT for me"}</b>
          <small className="block text-[13px] leading-snug text-plate-muted">
            {locked ? "One tap an episode, for the whole couch" : kind === "quick" ? "Free: our bot asks and sends the answer" : "One tap: our bot asks and sends the answer"}
          </small>
        </span>
        {locked ? (
          <span className="flex flex-none flex-col items-end">
            <b className="text-[20px] leading-none">{priceOf(ways.prices.tap)}</b>
            <small className="text-[11px] text-plate-muted">this season</small>
          </span>
        ) : (
          <ChevronRight className="size-5 flex-none text-plate-muted" aria-hidden />
        )}
      </button>
      {locked && (
        <p className="mt-2.5 flex flex-wrap items-center gap-2 text-[13px] leading-snug text-muted-foreground">
          <BetaChip />
          Unlock it once for {props.seasonName} and anyone on the couch can use it.
        </p>
      )}
      {shown && (
        <p role="alert" data-one-tap-problem className="mt-3 rounded-[3px] bg-background p-3 text-[13px] leading-snug">
          {shown}
        </p>
      )}
      <button type="button" data-copy-paste onClick={onPaste} className="mt-3 flex min-h-[60px] w-full items-center gap-3 border-b border-border pb-2 text-left">
        <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-secondary">
          <Copy className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-[15px] font-semibold">Copy and paste it yourself</b>
          <small className="block text-[13px] text-muted-foreground">Free, always · about 2 minutes</small>
        </span>
        <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
      </button>
    </div>
  );
}

/** "Free during beta": every price says it, and nothing is charged. */
export function BetaChip() {
  return (
    <span className="type-caption inline-flex h-[22px] items-center whitespace-nowrap rounded-[2px] px-2 text-[11px] tracking-[0.06em] text-good outline-1 -outline-offset-1 outline-good/50">
      Free during beta
    </span>
  );
}

function AskAiBody({ what, spoiler, seasonId, couchId, episode, kind, check, onUse }: AskAiProps) {
  const [app, setApp] = useState<ChatApp>(readPref);
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [answer, setAnswer] = useState("");
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<{ text: string; mismatch: boolean } | null>(null);

  // The question, parked as a brief for the chat links.
  const asked = useQuery({
    queryKey: ["new-design", "ask-ai", seasonId, couchId, episode, kind],
    queryFn: async () => {
      const q = await backstage.prompt(seasonId, couchId, episode, kind);
      return { ...q, link: q.prompt ? `${window.location.origin}/b/${(await backstage.brief(q.prompt)).code}` : null };
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
  const question = asked.data ?? null;
  const failed = asked.error ? (asked.error as Error).message : null;

  // Back from the chat: paste it.
  useEffect(() => {
    if (step !== 1) return;
    const back = () => document.visibilityState === "visible" && setStep(2);
    document.addEventListener("visibilitychange", back);
    return () => document.removeEventListener("visibilitychange", back);
  }, [step]);

  const href = question?.link ? chatLink(app, question.link, question.task) : undefined;
  const verdict = answer.trim() ? check(answer) : null;
  const P = APPS[app];

  const use = async (confirmed = false) => {
    setSending(true);
    setProblem(null);
    try {
      await onUse(answer, { confirmed });
    } catch (e) {
      const err = e as Error & { status?: number };
      setProblem({ text: err.message, mismatch: err.status === 409 });
    } finally {
      setSending(false);
    }
  };

  const copy = async () => {
    if (!question?.prompt) return;
    try {
      await navigator.clipboard.writeText(question.prompt);
      toast("Question copied. Paste it into any AI chat that can search the web.");
    } catch {
      toast("Couldn't copy here. Open it in ChatGPT instead.");
    }
    setStep(2);
  };

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) setAnswer(text);
      else toast("Nothing copied yet. Copy the AI's whole answer first.");
    } catch {
      toast("Paste it into the box below instead.");
    }
  };

  return (
    <div data-ask-ai={kind} className="flex flex-col">
      <ol className="mb-4 flex gap-1.5" aria-label="Steps">
        {["Open", "It answers", "Paste it back"].map((t, i) => (
          <li
            key={t}
            aria-current={i === step ? "step" : undefined}
            className={`flex flex-1 items-center gap-1.5 rounded-[3px] px-2 py-1.5 text-[12px] font-bold ${i <= step ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"}`}
          >
            <i className="not-italic tabular-nums">{i + 1}</i>
            {t}
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <>
          <p className="text-[15px] leading-snug">{what}</p>
          {spoiler && (
            <p className="mt-3 flex gap-2 rounded-[3px] bg-background px-3 py-2.5 text-[13px] leading-snug text-muted-foreground">
              <EyeOff className="mt-px size-4 flex-none" aria-hidden />
              {spoiler}
            </p>
          )}
          {failed ? (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {failed}
            </p>
          ) : question && !question.prompt ? (
            <div className="mt-4 rounded-[3px] bg-background p-3 text-sm leading-snug">There&apos;s nobody left to ask about in Episode {episode}.</div>
          ) : (
            <>
              <a
                data-ai-open={app}
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-disabled={!href}
                onClick={(e) => {
                  if (!href) return e.preventDefault();
                  try {
                    localStorage.setItem(PREF, app);
                  } catch {
                    /* remembered next time, or not */
                  }
                  setStep(1);
                }}
                className={`nd-press mt-4 flex min-h-[64px] items-center gap-3 rounded-[3px] bg-foreground px-3 text-background ${href ? "" : "pointer-events-none opacity-60"}`}
              >
                <span className="type-caption grid size-9 flex-none place-items-center rounded-[3px] text-[18px] text-[#0b0a10]" style={{ background: P.colour }}>
                  {P.name[0]}
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block text-[16px]">{href ? `Open in ${P.name}` : "Getting the question ready…"}</b>
                  <small className="block text-[13px] opacity-70">{P.line}</small>
                </span>
                <ChevronRight className="size-5" aria-hidden />
              </a>
              <div className="mt-2 flex flex-col">
                {(Object.keys(APPS) as ChatApp[])
                  .filter((a) => a !== app)
                  .map((a) => (
                    <button key={a} type="button" onClick={() => setApp(a)} className="flex min-h-11 items-center gap-2.5 text-left text-[14px] font-semibold">
                      <span className="type-caption grid size-6 place-items-center rounded-[2px] text-[13px] text-[#0b0a10]" style={{ background: APPS[a].colour }}>
                        {APPS[a].name[0]}
                      </span>
                      Use {APPS[a].name} instead
                    </button>
                  ))}
                <button type="button" data-ai-copy onClick={copy} disabled={!question?.prompt} className="flex min-h-11 items-center gap-2.5 text-left text-[14px] font-semibold disabled:opacity-50">
                  <Copy className="size-5 text-muted-foreground" aria-hidden />
                  Another AI? Copy the question
                </button>
              </div>
              <p className="mt-2 text-[12px] leading-snug text-muted-foreground">
                Free. It uses your own account, and free versions work. We send the AI a short link to the question, nothing else.
              </p>
            </>
          )}
        </>
      ) : (
        <>
          <div className="flex items-start gap-3 rounded-[3px] bg-background p-3">
            <span className="grid size-8 flex-none place-items-center rounded-full bg-good/20 text-good">
              <Check className="size-4" strokeWidth={3} aria-hidden />
            </span>
            <span className="text-[14px] leading-snug">
              <b className="block">{step === 1 ? `${P.name} is answering` : "Welcome back"}</b>
              <span className="text-muted-foreground">
                {step === 1 ? "When it finishes, copy its whole answer (long-press, Copy) and come back here." : "Copied the answer? Paste it below."}
              </span>
            </span>
          </div>
          <Btn tone={verdict?.ok ? "optional" : "must"} wide className="mt-3" onClick={paste}>
            <ClipboardPaste className="size-5" aria-hidden />
            Paste the answer
          </Btn>
          <label className="mt-3 block">
            <span className="sr-only">The AI&apos;s answer</span>
            <textarea
              data-ai-answer
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Or paste it here yourself"
              rows={4}
              className="block w-full resize-y rounded-[3px] bg-background p-3 font-mono text-[16px] leading-snug outline-1 -outline-offset-1 outline-input placeholder:font-sans placeholder:text-muted-foreground focus:outline-2 focus:outline-foreground"
            />
          </label>
          {verdict && (
            <p data-ai-check={verdict.ok ? "ok" : "bad"} className={`mt-2 flex items-center gap-1.5 text-[13px] font-semibold ${verdict.ok ? "text-good" : "text-chyron-line"}`}>
              {verdict.ok ? <Check className="size-4" aria-hidden /> : <CircleAlert className="size-4" aria-hidden />}
              {verdict.line}
            </p>
          )}
          {problem && (
            <div role="alert" className="mt-3 rounded-[3px] bg-background p-3 text-[13px] leading-snug">
              {problem.text}
              {problem.mismatch && (
                <Btn className="mt-2" wide onClick={() => use(true)} disabled={sending}>
                  It&apos;s right, use it
                </Btn>
              )}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <Btn className="flex-1" onClick={() => setStep(0)}>
              Open it again
            </Btn>
            <Btn data-ai-use tone="must" className="flex-1" disabled={!verdict?.ok || sending} onClick={() => use()}>
              {sending ? "Reading it…" : "Use this answer"}
            </Btn>
          </div>
        </>
      )}
    </div>
  );
}

/** The quick check's answer looks whole: JSON with who left (or found: false). */
export const checkQuick: AnswerCheck = (text) => {
  const json = jsonIn(text);
  if (!json) return { ok: false, line: "That doesn't look like the whole answer. Copy all of it, from { to }." };
  if (json.found === false) return { ok: true, line: "It says it couldn't find this episode yet" };
  const left = Array.isArray(json.left) ? json.left.filter((p: { name?: unknown }) => p && p.name) : [];
  const sources = Array.isArray(json.sources) ? json.sources.length : 0;
  return { ok: true, line: `Looks right: ${left.length === 1 ? "one person" : `${left.length} people`} · ${sources} ${sources === 1 ? "source" : "sources"}` };
};

/** The full answer looks whole: JSON with an entry per person. */
export const checkFull: AnswerCheck = (text) => {
  const json = jsonIn(text);
  const people = Array.isArray(json?.castaways) ? json.castaways.length : 0;
  if (!json || !people) return { ok: false, line: "That doesn't look like the whole answer. Copy all of it, from { to }." };
  return { ok: true, line: `Looks right: answers for ${people} ${people === 1 ? "person" : "people"}` };
};

function jsonIn(text: string): Record<string, unknown> & { left?: unknown; sources?: unknown; castaways?: unknown[]; found?: unknown } | null {
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try {
    return JSON.parse(text.slice(a, b + 1));
  } catch {
    return null;
  }
}
