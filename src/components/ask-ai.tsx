"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bot, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { ActButton, CopyButton } from "@/components/ui/act-ui";
import { cn } from "cn";
import { chatLink } from "@/lib/ai-brief";

// The "ask an AI" step of every copy-a-prompt, paste-the-answer flow, in one place:
//
//   1. Ask ChatGPT for me (experimental) -- the ask-AI bot (lib/server/ask-bot.ts) runs the prompt in
//      ChatGPT on our own VM and drops the answer straight into the page's paste box. Admins and
//      commissioners, while the bot is up. It's the primary action when it's there.
//   2. Open in ChatGPT -- no chat URL can carry one of our prompts (they run to many thousands of
//      characters), so the prompt is parked at /b/<code> (api/briefs) and the link carries one line
//      asking the chat to read it.
//   3. Copy the prompt -- into any chat at all, and paste the answer back. Always works.

export { briefLine } from "@/lib/ai-brief";

export function AskAi({
  prompt,
  task,
  onAnswer,
  answered = false,
  copyLabel,
  copyTourId,
  disabled,
  tour = false,
}: {
  prompt: string | undefined;
  /** What the user is doing, for the ChatGPT line: "researching what happened in episode 5". */
  task?: string;
  /** Where the bot's answer goes: the page's paste box. */
  onAnswer: (answer: string) => void;
  /** An answer is already pasted: nothing here is the next step any more. */
  answered?: boolean;
  copyLabel?: string;
  copyTourId?: string;
  disabled?: boolean;
  /** The guided tour: just the copy button, which is what the tour points at. */
  tour?: boolean;
}) {
  const status = useQuery({ queryKey: ["ask-ai-status"], queryFn: api.askAiStatus, staleTime: 30_000, retry: false, enabled: !tour });
  const botReady = !tour && !!status.data?.allowed && !!status.data?.available;
  const chatgpt = useChatGptLink(tour || disabled ? undefined : prompt, task);

  return (
    <div className="flex flex-col gap-2">
      {botReady && <AskBotButton prompt={prompt} disabled={disabled} answered={answered} busyElsewhere={!!status.data?.busy} onAnswer={onAnswer} />}
      <div className="flex flex-wrap items-center gap-2">
        <CopyButton text={prompt} label={copyLabel} tone={botReady || answered ? "plain" : "chyron"} disabled={disabled} tourId={copyTourId} />
        {!tour && (
          <ActButton href={chatgpt} external disabled={!chatgpt}>
            Open in ChatGPT
            <ExternalLink className="size-[15px] text-muted-foreground" strokeWidth={2.2} aria-hidden />
          </ActButton>
        )}
      </div>
    </div>
  );
}

// Parks the prompt as a brief and builds the ChatGPT link to it. Settled first, so typing into a field
// the prompt is built from (a season name) doesn't park a brief per keystroke.
function useChatGptLink(prompt: string | undefined, task?: string): string | undefined {
  const [settled, setSettled] = useState(prompt);
  useEffect(() => {
    const t = setTimeout(() => setSettled(prompt), 700);
    return () => clearTimeout(t);
  }, [prompt]);
  const brief = useQuery({
    queryKey: ["ai-brief", settled],
    queryFn: () => api.createBrief(settled!),
    enabled: !!settled && settled === prompt,
    staleTime: Infinity,
    retry: false,
  });
  const code = brief.data?.code;
  if (!code || settled !== prompt) return undefined;
  return chatLink("chatgpt", `${window.location.origin}/b/${code}`, task);
}

/** Whole seconds since `since` (a mutation's submittedAt), ticking while `active`. */
export function useElapsed(active: boolean, since: number): number {
  const [now, setNow] = useState(since);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return active ? Math.max(0, Math.round((now - since) / 1000)) : 0;
}

// Runs the prompt through the bot and hands the answer to the paste box. The answer takes 30 seconds
// to two minutes (it searches first), so it counts while it waits.
function AskBotButton({
  prompt,
  disabled,
  answered,
  busyElsewhere,
  onAnswer,
}: {
  prompt: string | undefined;
  disabled?: boolean;
  answered: boolean;
  busyElsewhere: boolean;
  onAnswer: (answer: string) => void;
}) {
  const ask = useMutation({ mutationFn: () => api.askAi(prompt!), onSuccess: (r) => onAnswer(r.answer) });
  const elapsed = useElapsed(ask.isPending, ask.submittedAt);

  const note = ask.isPending
    ? "It searches the web first, so this takes up to two minutes. You can keep this page open and wait."
    : ask.isError
      ? ask.error.message
      : ask.isSuccess
        ? `Answered in ${Math.round(ask.data.seconds)}s and pasted below. Check it, then carry on.`
        : busyElsewhere
          ? "The bot is answering someone else; yours waits its turn."
          : "Our bot asks ChatGPT for you and pastes the answer below.";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <ActButton tone={answered || ask.isSuccess ? "plain" : "chyron"} disabled={disabled || !prompt || ask.isPending} onClick={() => ask.mutate()}>
          <Bot className="size-[18px]" strokeWidth={2.2} aria-hidden />
          {ask.isPending ? `Asking ChatGPT… ${elapsed}s` : ask.isSuccess ? "Ask again" : "Ask ChatGPT for me"}
        </ActButton>
        <span className="rounded-[3px] border border-input px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
          Experimental
        </span>
      </div>
      <span className={cn("text-[13px] leading-snug", ask.isError ? "text-destructive" : "text-muted-foreground")} aria-live="polite">
        {note}
      </span>
    </div>
  );
}
