"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { StoredFormat } from "@/lib/game/types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ActButton, CopyButton } from "@/components/admin/admin-ui";
import { PasteBar } from "@/components/paste-bar";
import { useTourSample } from "@/lib/tour/samples";
import { tourMark } from "@/lib/tour/tour-store";

// Step 1 of "Research a new show" (docs/PLAN-stage-3-format-proposals.md step 3): build the free
// copy/paste prompt from a show name and a few optional hints, then parse whatever a web-searching
// chat pastes back into a draft. Same shape as episode research's PasteImportPanel
// (season-episodes.tsx), just for a whole show's rules instead of one episode.
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
  const [built, setBuilt] = useState(false);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = { name: name.trim(), wiki: wiki.trim() || undefined, castaway: castaway.trim() || undefined, tribe: tribe.trim() || undefined, seasons: seasons.trim() || undefined };
  const { data, isLoading, error: promptError } = useQuery({
    queryKey: ["format-prompt", promptFn === api.adminFormatPrompt ? "admin" : "self", q],
    queryFn: () => promptFn(q),
    enabled: built && !!q.name,
  });

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
    <div className="rounded-md border border-dashed border-border bg-secondary/40 p-2.5 text-xs">
      {!built ? (
        <>
          <p className="mb-1.5 text-muted-foreground">
            Research a show nobody&rsquo;s hand-written rules for yet. Fill in what you know, build a prompt, and paste
            it into any AI chat with web search.
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <Input
              size="sm"
              className="min-w-[160px] flex-1"
              placeholder="Show name, e.g. Love Island (UK)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && name.trim() && setBuilt(true)}
            />
            <Input size="sm" className="min-w-[180px] flex-1" placeholder="Wiki URL (optional)" value={wiki} onChange={(e) => setWiki(e.target.value)} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Input size="sm" className="w-[140px]" placeholder="Contestant term (optional)" value={castaway} onChange={(e) => setCastaway(e.target.value)} />
            <Input size="sm" className="w-[140px]" placeholder="Group term (optional)" value={tribe} onChange={(e) => setTribe(e.target.value)} />
            <Input size="sm" className="min-w-[160px] flex-1" placeholder="Seasons to check (optional)" value={seasons} onChange={(e) => setSeasons(e.target.value)} />
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span data-tour="add-build">
              <ActButton tone="chyron" disabled={!name.trim()} onClick={() => { setBuilt(true); tourMark("add-built"); }}>
                Build prompt
              </ActButton>
            </span>
            <ActButton onClick={onCancel}>Cancel</ActButton>
          </div>
        </>
      ) : (
        <>
          <p className="mb-1.5 text-muted-foreground">
            1. Copy this into any AI chat with web search. 2. Paste its answer into the box below. 3. Create the draft.
          </p>
          {isLoading && <p className="italic text-muted-foreground">Building the prompt…</p>}
          {promptError && <p className="font-semibold text-destructive">{promptError instanceof ApiError ? promptError.message : "Couldn't build the prompt."}</p>}
          {data && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2.5">
                <CopyButton text={data.prompt} label="Copy prompt" tone="chyron" tourId="add-copy" />
                <button className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={() => setBuilt(false)}>
                  ← edit inputs
                </button>
              </div>
              <Textarea readOnly rows={4} value={data.prompt} className="font-mono text-[0.65rem] text-muted-foreground" />
            </div>
          )}
          <div className="mt-2 flex flex-col gap-1.5">
            <span className="font-semibold">Paste the answer here</span>
            <PasteBar value={answer} onChange={setAnswer} sample={tourSample} tourId="add-paste" />
          </div>
          <label className="mt-1.5 flex flex-col gap-1">
            <span className="sr-only">The answer</span>
            <Textarea
              rows={8}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Paste the JSON the chat wrote back (a code fence or a line of chatter around it is fine)."
              className="font-mono text-[0.7rem]"
            />
          </label>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span data-tour="add-create">
              <ActButton tone="chyron" disabled={busy || !answer.trim()} onClick={submit}>
                {busy ? "Creating…" : "Create draft"}
              </ActButton>
            </span>
            <ActButton disabled={busy} onClick={onCancel}>
              Cancel
            </ActButton>
          </div>
          {error && <p className="mt-1 font-semibold text-destructive">{error}</p>}
        </>
      )}
    </div>
  );
}
