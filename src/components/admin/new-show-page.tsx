"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DEFAULT_FORMAT } from "@/lib/game/formats/index.js";
import { Field, MoreOptions, fieldCls } from "@/components/setup/settings-ui";
import { ActButton, AdminPage, Notice, Segmented, Step, StickyBar, errorText, useAdminShows } from "./admin-ui";
import { AskAi } from "@/components/ask-ai";
import { cn } from "cn";

// New show (the canvas's Admin-NewShow). Two ways in:
//
//   - Research new rules: for a show nobody's written rules for yet. Copy a prompt into any AI chat
//     with web search (free), paste its answer back, and review the proposed format
//     (docs/PLAN-stage-3-format-proposals.md). Approving it there creates the show.
//   - Use existing rules: a show that plays like one already here (another Survivor-style show, a
//     second Traitors) -- name it, say what it calls people and groups, pick the rules, done.

export function NewShowPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data } = useAdminShows();
  const [mode, setMode] = useState<"research" | "existing">("research");
  const [name, setName] = useState("");
  const [castaway, setCastaway] = useState("");
  const [tribe, setTribe] = useState("");
  const [wiki, setWiki] = useState("");
  const [seasons, setSeasons] = useState("");
  const [format, setFormat] = useState(DEFAULT_FORMAT);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = data?.formatOptions ?? [];
  const chosen = options.find((o) => o.id === format);

  // The prompt is built from what's typed, so it's fetched once typing settles rather than per key.
  const q = { name: name.trim(), wiki: wiki.trim() || undefined, castaway: castaway.trim() || undefined, tribe: tribe.trim() || undefined, seasons: seasons.trim() || undefined };
  const [settled, setSettled] = useState(q);
  const key = JSON.stringify(q);
  useEffect(() => {
    const t = setTimeout(() => setSettled(JSON.parse(key)), 400);
    return () => clearTimeout(t);
  }, [key]);
  const prompt = useQuery({
    queryKey: ["format-prompt", "admin", settled],
    queryFn: () => api.adminFormatPrompt(settled),
    enabled: mode === "research" && !!settled.name,
  });
  const promptReady = !!prompt.data && JSON.stringify(settled) === key;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (mode === "research") {
        const { format: created } = await api.adminCreateFormat(answer);
        await queryClient.invalidateQueries({ queryKey: ["admin-formats"] });
        router.push(`/admin/formats/${encodeURIComponent(created.id)}`);
      } else {
        const { show } = await api.adminCreateShow({ name: name.trim(), castawayTerm: castaway.trim(), tribeTerm: tribe.trim(), format });
        await queryClient.invalidateQueries({ queryKey: ["admin-shows"] });
        router.push(`/admin/shows/${show.id}`);
      }
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  const ready = mode === "research" ? !!answer.trim() : !!name.trim();

  return (
    <AdminPage title="New show" back={{ href: "/admin/shows", label: "Shows" }}>
      <div className="flex flex-col gap-5">
        <Field label="Show name" htmlFor="new-show-name">
          <input id="new-show-name" className={fieldCls} placeholder="Love Island (UK)" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="People are called" htmlFor="new-show-castaway">
            <input id="new-show-castaway" className={fieldCls} placeholder={mode === "existing" ? (chosen?.terms.castaway ?? "") : "Islanders"} value={castaway} onChange={(e) => setCastaway(e.target.value)} />
          </Field>
          <Field label="Groups are called" htmlFor="new-show-tribe">
            <input id="new-show-tribe" className={fieldCls} placeholder={mode === "existing" ? (chosen?.terms.tribe ?? "") : "Couples"} value={tribe} onChange={(e) => setTribe(e.target.value)} />
          </Field>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Rules</span>
          <Segmented
            label="Rules"
            value={mode}
            options={[
              ["research", "Research new ones"],
              ["existing", "Use a show's rules"],
            ]}
            onChange={setMode}
          />
        </div>
      </div>

      {mode === "research" ? (
        <>
          <MoreOptions label="Help the research (optional)">
            <div className="flex flex-col gap-5">
              <Field label="Wiki page" htmlFor="new-show-wiki">
                <input id="new-show-wiki" type="url" className={fieldCls} placeholder="https://…" value={wiki} onChange={(e) => setWiki(e.target.value)} />
              </Field>
              <Field label="Seasons to check" htmlFor="new-show-seasons" hint="Which seasons the chat should read, e.g. 10 and 11.">
                <input id="new-show-seasons" className={fieldCls} value={seasons} onChange={(e) => setSeasons(e.target.value)} />
              </Field>
            </div>
          </MoreOptions>
          <ol className="flex flex-col gap-5">
            <Step n={1} on={!answer.trim()} label="Ask an AI">
              <AskAi
                prompt={promptReady ? prompt.data?.prompt : undefined}
                task={`setting up a new show, ${name.trim()},`}
                onAnswer={setAnswer}
                answered={!!answer.trim()}
                disabled={!name.trim()}
              />
              <span className="text-[13px] leading-snug text-muted-foreground">
                {name.trim() ? "Or copy the prompt into any AI chat with web search. Free either way." : "Name the show first."}
              </span>
              {prompt.error && <Notice tone="bad">{errorText(prompt.error, "Couldn't build the prompt.")}</Notice>}
            </Step>
            <Step n={2} on={!!answer.trim()} label="Paste what it found">
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
        </>
      ) : (
        <Field label="Plays by" htmlFor="new-show-format" hint="How people leave, what scores, and what the wiki and research look for. Blank names use these rules' own.">
          <select id="new-show-format" className={fieldCls} value={format} onChange={(e) => setFormat(e.target.value)}>
            {options.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} rules
              </option>
            ))}
          </select>
        </Field>
      )}

      {error && <Notice tone="bad">{error}</Notice>}

      <StickyBar note={mode === "research" ? "Nothing goes live until you approve the format." : undefined}>
        <ActButton tone="chyron" disabled={busy || !ready} onClick={submit} className={cn("min-h-12", mode === "existing" && "flex-1")}>
          {busy ? "Working…" : mode === "research" ? "Review the format" : "Add show"}
        </ActButton>
      </StickyBar>
    </AdminPage>
  );
}
