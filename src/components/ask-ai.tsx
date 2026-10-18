"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { useIsSuperAdmin } from "@/lib/store";
import { cn } from "cn";

// "Open in ChatGPT / Claude / ..." under a Copy prompt button: an experiment in skipping the copy.
// No chat's URL can carry one of our prompts (they run to many thousands of characters), so the prompt
// is parked at /b/<code> (api/briefs) and the link carries one line asking the chat to read it. Which
// chats actually open the page and follow it is what this is here to find out, so each row also shows
// who has read the brief (from the page's fetch log). Copy and paste stays the way that always works.
//
// Admin-only while it's tested. Link formats are the chats' own undocumented prefill parameters, so
// any of them can stop working: that's part of what the "read by" line shows.

type Service = { name: string; href: (line: string) => string };

const enc = encodeURIComponent;
const SERVICES: Service[] = [
  { name: "ChatGPT", href: (l) => `https://chatgpt.com/?hints=search&q=${enc(l)}` },
  { name: "Claude", href: (l) => `https://claude.ai/new?q=${enc(l)}` },
  { name: "Gemini", href: (l) => `https://gemini.google.com/app?q=${enc(l)}` },
  { name: "Google AI Mode", href: (l) => `https://www.google.com/search?udm=50&q=${enc(l)}` },
  { name: "Perplexity", href: (l) => `https://www.perplexity.ai/search?q=${enc(l)}` },
  { name: "Grok", href: (l) => `https://grok.com/?q=${enc(l)}` },
  { name: "Copilot", href: (l) => `https://copilot.microsoft.com/?q=${enc(l)}` },
];

// The Game Your Show custom GPT (docs/custom-gpt.md), once it exists: its own instructions say to fetch
// the brief through its action, so its message is just the code.
const GPT_URL = process.env.NEXT_PUBLIC_GYS_GPT_URL;

/** The one line a chat gets: phrased as the user's own request, which is what lets a chat act on the page. */
export function briefLine(url: string, task?: string) {
  return (
    `I'm ${task ?? "setting something up"} in Game Your Show, a fantasy app for reality TV. ` +
    `The app's full instructions for this are at ${url} . Please open that page and follow it closely: ` +
    `it says what to search the web for, and exactly what format to reply in.`
  );
}

export function AskAiLinks({ prompt, task }: { prompt: string | undefined; task?: string }) {
  const isAdmin = useIsSuperAdmin();
  // Settled, so typing into a field the prompt is built from (a season name) doesn't park a brief per keystroke.
  const [settled, setSettled] = useState(prompt);
  useEffect(() => {
    const t = setTimeout(() => setSettled(prompt), 700);
    return () => clearTimeout(t);
  }, [prompt]);
  const brief = useQuery({
    queryKey: ["ai-brief", settled],
    queryFn: () => api.createBrief(settled!),
    enabled: isAdmin && !!settled && settled === prompt,
    staleTime: Infinity,
  });
  const code = brief.data?.code;
  const reads = useQuery({
    queryKey: ["ai-brief-reads", code],
    queryFn: () => api.briefFetches(code!),
    enabled: !!code,
    refetchInterval: 4000,
  });
  if (!isAdmin || !prompt) return null;
  if (brief.isError) return <span className="text-[13px] text-destructive">Couldn&rsquo;t make the chat links.</span>;

  const url = code ? `${window.location.origin}/b/${code}` : "";
  const line = url ? briefLine(url, task) : "";
  const readers = latestByReader(reads.data?.fetches ?? []);

  return (
    <div className="flex flex-col gap-2 rounded-[3px] border border-dashed border-input p-3">
      <span className="text-[13px] font-semibold text-muted-foreground">Or skip the copy: open it in (test)</span>
      <div className="flex flex-wrap gap-2">
        {SERVICES.map((s) => (
          <ChatLink key={s.name} href={line ? s.href(line) : undefined} name={s.name} />
        ))}
        {GPT_URL && <ChatLink href={code ? `${GPT_URL}?q=${enc(`Brief code: ${code}`)}` : undefined} name="Game Your Show GPT" />}
        <CopyLine text={line} />
      </div>
      <span className="text-[13px] leading-snug text-muted-foreground">
        {!code
          ? "Making the links…"
          : readers.length
            ? `Read by ${readers.map((r) => `${r.reader} ${ago(r.at)}`).join(", ")}`
            : "Nobody has opened the brief yet."}
      </span>
    </div>
  );
}

function ChatLink({ href, name }: { href: string | undefined; name: string }) {
  const cls =
    "inline-flex min-h-11 items-center gap-1.5 rounded-[3px] border border-input bg-card px-3 text-[14px] font-bold hover:bg-secondary";
  if (!href) return <span className={cn(cls, "opacity-45")}>{name}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {name}
      <ExternalLink className="size-[15px] text-muted-foreground" strokeWidth={2.2} aria-hidden />
    </a>
  );
}

// The one-liner by itself, for a chat app that ignores links (the phone apps): paste it there instead
// of the whole prompt.
function CopyLine({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      disabled={!text}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* clipboard blocked: the full Copy button above still works */
        }
      }}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-[3px] border border-input bg-card px-3 text-[14px] font-bold hover:bg-secondary disabled:opacity-45"
    >
      {copied ? <Check className="size-[15px]" strokeWidth={2.4} aria-hidden /> : <Copy className="size-[15px]" strokeWidth={2.2} aria-hidden />}
      {copied ? "Copied" : "Copy short version"}
    </button>
  );
}

function latestByReader(fetches: { reader: string; at: string }[]) {
  const seen = new Map<string, string>();
  for (const f of fetches) if (!seen.has(f.reader)) seen.set(f.reader, f.at);
  return [...seen].map(([reader, at]) => ({ reader, at }));
}

function ago(iso: string) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  return s < 60 ? "just now" : s < 3600 ? `${Math.round(s / 60)}m ago` : `${Math.round(s / 3600)}h ago`;
}
