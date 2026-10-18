"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { StoredFormat } from "@/lib/game/types";
import { Field, MoreOptions, fieldCls } from "@/components/setup/settings-ui";
import { ActButton, CopyButton, Notice, Step, StickyBar } from "@/components/admin/admin-ui";
import { AskAiLinks } from "@/components/ask-ai";
import { PasteBar } from "@/components/paste-bar";
import { useTourSample } from "@/lib/tour/samples";
import { tourMark } from "@/lib/tour/tour-store";
import { cn } from "cn";

// "Research a new show" for anyone adding one from the create-league flow (docs/PLAN-settings-order.md;
// the same shape as Admin's New show page, admin/new-show-page.tsx): the show's name is the one thing
// to type, the prompt is built as soon as it is (nothing to press), then copy it into any AI chat with
// web search, paste the answer, and review the rules it found. Everything else the chat could use
// (a wiki page, what the show calls its people and groups, which seasons to read) is optional help,
// folded away. Same copy/paste shape as episode research (season-episodes.tsx) and the cast import.
export function FormatResearchPanel({
  onCreated,
  onCancel,
  promptFn = api.adminFormatPrompt,
  createFn = api.adminCreateFormat,
  tour,
}: {
  onCreated: (format: StoredFormat) => void;
  onCancel: () => void;
  // Self-serve callers (research-show-flow.tsx) pass the non-admin equivalents -- same shapes,
  // scoped to the signed-in user instead of requiring super-admin.
  promptFn?: typeof api.adminFormatPrompt;
  createFn?: typeof api.adminCreateFormat;
  /** The commissioner's guided tour: the show's name is filled in, and Paste fills in a ready-made answer. */
  tour?: boolean;
}) {
  const tourSample = useTourSample("format");
  const [name, setName] = useState(tour ? "Survivor" : "");
  const [wiki, setWiki] = useState("");
  const [castaway, setCastaway] = useState("");
  const [tribe, setTribe] = useState("");
  const [seasons, setSeasons] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The prompt is built from what's typed, so it's fetched once typing settles rather than per key.
  const q = { name: name.trim(), wiki: wiki.trim() || undefined, castaway: castaway.trim() || undefined, tribe: tribe.trim() || undefined, seasons: seasons.trim() || undefined };
  const key = JSON.stringify(q);
  const [settled, setSettled] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setSettled(JSON.parse(key)), 400);
    return () => clearTimeout(t);
  }, [key]);
  const prompt = useQuery({
    queryKey: ["format-prompt", promptFn === api.adminFormatPrompt ? "admin" : "self", settled],
    queryFn: () => promptFn(settled),
    enabled: !!settled.name,
  });
  const promptReady = !!prompt.data && JSON.stringify(settled) === key;
  useEffect(() => {
    if (promptReady) tourMark("add-built");
  }, [promptReady]);

  async function submit() {
    if (!answer.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { format } = await createFn(answer);
      onCreated(format);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Field label="Show name" htmlFor="rs-name" hint="The chat researches this show's rules, then you check what it found.">
        <input id="rs-name" className={fieldCls} placeholder="Love Island (UK)" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
      </Field>

      <MoreOptions label="Help the research (optional)">
        <div className="flex flex-col gap-5">
          <Field label="Wiki page" htmlFor="rs-wiki">
            <input id="rs-wiki" type="url" className={fieldCls} placeholder="https://…" value={wiki} onChange={(e) => setWiki(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="People are called" htmlFor="rs-castaway">
              <input id="rs-castaway" className={fieldCls} placeholder="Islanders" value={castaway} onChange={(e) => setCastaway(e.target.value)} />
            </Field>
            <Field label="Groups are called" htmlFor="rs-tribe">
              <input id="rs-tribe" className={fieldCls} placeholder="Couples" value={tribe} onChange={(e) => setTribe(e.target.value)} />
            </Field>
          </div>
          <Field label="Seasons to check" htmlFor="rs-seasons" hint="Which seasons the chat should read, e.g. 10 and 11.">
            <input id="rs-seasons" className={fieldCls} value={seasons} onChange={(e) => setSeasons(e.target.value)} />
          </Field>
        </div>
      </MoreOptions>

      <ol className="flex flex-col gap-5">
        <Step n={1} on={!answer.trim()} label="Copy the research prompt">
          <CopyButton text={promptReady ? prompt.data?.prompt : undefined} tone={answer.trim() ? "plain" : "chyron"} disabled={!name.trim()} tourId="add-copy" />
          <span className="text-[13px] leading-snug text-muted-foreground">
            {name.trim() ? "Paste it into any AI chat with web search. Free." : "Name the show first."}
          </span>
          {!tour && <AskAiLinks prompt={promptReady ? prompt.data?.prompt : undefined} task={`setting up a new show, ${name.trim()},`} />}
          {prompt.error && <Notice tone="bad">{prompt.error instanceof ApiError ? prompt.error.message : "Couldn't build the prompt."}</Notice>}
        </Step>
        <Step n={2} on={!!answer.trim()} label="Paste what it found">
          <PasteBar value={answer} onChange={setAnswer} sample={tourSample} tourId="add-paste" />
          <textarea
            aria-label="The chat's answer"
            rows={5}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Paste the chat's answer. A code fence or a line of chatter around it is fine."
            className={cn(fieldCls, "min-h-[120px] resize-y py-3 font-mono text-sm")}
          />
        </Step>
      </ol>

      {error && <Notice tone="bad">{error}</Notice>}

      <StickyBar note="Nothing goes live until you approve the rules.">
        <ActButton disabled={busy} onClick={onCancel} className="min-h-12">
          Cancel
        </ActButton>
        <span data-tour="add-create">
          <ActButton tone="chyron" disabled={busy || !answer.trim()} onClick={submit} className="min-h-12">
            {busy ? "Reading…" : "Review the rules"}
          </ActButton>
        </span>
      </StickyBar>
    </div>
  );
}
