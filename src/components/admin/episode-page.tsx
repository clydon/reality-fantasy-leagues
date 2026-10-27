"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardPaste, Search } from "lucide-react";
import type { SeasonResearchResult } from "@/lib/game/types";
import { api } from "@/lib/api";
import { estimate } from "@/lib/ai-cost";
import { useAiModels, useShowPaidAi } from "@/lib/paid-ai-store";
import { confirm } from "@/lib/confirm-store";
import { airLine, autoResearchNote, episodeRows } from "@/lib/admin-season";
import { useNowMinute } from "@/components/episodes/episode-status";
import { BottomSheet, SheetAction } from "@/components/ui/bottom-sheet";
import { fieldCls } from "@/components/setup/settings-ui";
import { ActButton, AdminPage, Cost, Notice, Row, Rows, Section, Segmented, Step, StickyBar, count, errorText, seasonShort, useAdminSeason } from "./admin-ui";
import { AskAi } from "@/components/ask-ai";
import { BingoBank } from "./bingo-bank";
import { BotResearchRuns } from "./bot-research-runs";
import { ResearchResult, modelLabel } from "./admin-results";
import { cn } from "cn";

// One episode's sources (the canvas's Admin-Episode): where its results come from -- paid web
// research, or the free paste path (copy a prompt into any AI chat with web search, paste the answer
// back) -- each with where it stands and its one action. Whatever any of them finds joins the review
// list; nothing reaches a league until it's accepted there. Clearing the episode is in the ⋯ sheet.
// Under them, its bingo squares (bingo-bank.tsx), written before it airs.

export function EpisodePage({ seasonId, episode }: { seasonId: string; episode: number }) {
  const queryClient = useQueryClient();
  const { show, season, isLoading, refetch } = useAdminSeason(seasonId);
  const { data } = useQuery({ queryKey: ["season-decisions", seasonId], queryFn: () => api.adminListDecisions(seasonId) });
  const nowMs = useNowMinute();
  const showPaid = useShowPaidAi();
  const models = useAiModels();
  const [working, setWorking] = useState<"research" | "clear" | null>(null);
  const [research, setResearch] = useState<SeasonResearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);
  const [menu, setMenu] = useState(false);

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (!show || !season) return <p className="text-muted-foreground">That season doesn&rsquo;t exist any more.</p>;

  const base = `/admin/seasons/${season.id}`;
  const now = nowMs === null ? null : new Date(nowMs);
  const row = now && data ? episodeRows(season, data.decisions, now).find((r) => r.n === episode) : undefined;
  const decisions = row?.decisions ?? data?.decisions.filter((d) => d.episode_number === episode) ?? [];
  const pending = decisions.filter((d) => d.status === "pending").length;
  const aired = row ? row.aired || !row.airsAt : true;
  const researched = (season.researchedEpisodes ?? []).includes(episode);
  const curator = season.resultsBy === "leagues";
  const auto = row && now ? autoResearchNote(season, row, now) : null;
  const hasData = researched || decisions.length > 0 || episode <= (season.wikiEpisodesThrough ?? 0);

  async function act<T>(kind: "research" | "clear", fn: () => Promise<T>, done: (r: T) => void) {
    setWorking(kind);
    setError(null);
    setNote(null);
    setResearch(null);
    try {
      done(await fn());
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ["season-decisions", seasonId] });
      // A rules note from this research marks the Rules tab (season-frame.tsx).
      await queryClient.invalidateQueries({ queryKey: ["season-rule-changes", seasonId] });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setWorking(null);
    }
  }

  const doResearch = (force = false) => act("research", () => api.adminResearchEpisode(seasonId, episode, { force, model: models.research }), setResearch);
  // The free path: notes from the admin's own web-searching chat, not this app's paid search (see
  // db/episode-research.js's "manual / paste import" section). Same result shape as a searched run.
  const doPaste = (notes: string, structured: boolean) => {
    setPasting(false);
    return act("research", () => api.adminResearchFromPaste(seasonId, episode, notes, { model: models.research, structured }), setResearch);
  };

  // Wipes the episode so it can be redone: research, undecided results from either source, and its part
  // of the cached wiki read. Accepted or rejected results were already sent to leagues, so they're kept.
  async function clearEpisode() {
    setMenu(false);
    const ok = await confirm(
      `Clear all of episode ${episode}'s data? This removes its research, its ${count(pending, "undecided result")}, and its part of the cached wiki read, so you can research, paste or pull it again. Accepted or rejected results are kept.`,
      { danger: true, confirmLabel: "Clear episode" },
    );
    if (!ok) return;
    act("clear", () => api.adminDiscardResearch(seasonId, episode, "all"), (r) =>
      setNote(r.decidedKept ? `Cleared. ${count(r.decidedKept, "decided result")} kept; change them on the review page.` : "Cleared."),
    );
  }

  // Bad data that was already accepted: everything for the episode goes, and what leagues were given
  // from it is taken back out (the route rejects and syncs before deleting). Then research it afresh.
  async function clearEverything() {
    setMenu(false);
    const decided = decisions.filter((d) => d.status !== "pending").length;
    const ok = await confirm(
      `Clear everything for episode ${episode}? This removes its research and all ${count(decisions.length, "result")}, including ${count(decided, "accepted or rejected result")}. ` +
        "Anything accepted is taken back out of every league on this season. Leagues that fill in their own results keep what they applied. You can't undo this.",
      { danger: true, confirmLabel: "Clear everything" },
    );
    if (!ok) return;
    act("clear", () => api.adminDiscardResearch(seasonId, episode, "everything"), (r) =>
      setNote(r.leaguesUndone ? `Cleared, and taken back out of ${count(r.leaguesUndone, "league")}.` : "Cleared."),
    );
  }

  // Research run before the episode aired is about an earlier one. Throws away only that.
  async function discardResearch() {
    setMenu(false);
    const ok = await confirm(`Discard episode ${episode}'s research and its ${count(pending, "undecided result")}? Anything already accepted or rejected is kept.`, {
      danger: true,
      confirmLabel: "Discard",
    });
    if (ok) act("clear", () => api.adminDiscardResearch(seasonId, episode), () => setNote("Research discarded."));
  }

  const early = researched && row && !row.aired && !!row.airsAt;

  return (
    <AdminPage
      title={`Episode ${episode}`}
      subtitle={`${seasonShort(show, season)} · ${row ? airLine(row, season) : "…"}`}
      back={{ href: base, label: seasonShort(show, season) }}
      actions={hasData ? { label: "Episode actions", onClick: () => setMenu(true) } : undefined}
    >
      {early && (
        <Notice tone="bad">
          This episode was researched before it aired, so what research found is probably about an earlier one. Discard it from the ⋯ menu.
        </Notice>
      )}

      <Section title="Sources">
        <Rows>
          <Row
            icon={Search}
            title="Research"
            detail={
              <>
                {researched ? "Researched" : "Not researched"}
                {!showPaid && " · paid, turn on paid AI in Site to run it"}
                {auto && <span className={cn("block", auto.bad && "font-semibold text-destructive")}>{auto.text}</span>}
              </>
            }
            trailing={
              showPaid && aired ? (
                <span className="flex items-center gap-2">
                  <Cost title={`Typical cost with ${modelLabel(models.research)}`}>{estimate("research", models.research)}</Cost>
                  <ActButton disabled={!!working} onClick={() => doResearch(researched)}>
                    {working === "research" ? "Researching…" : researched ? "Again" : "Research"}
                  </ActButton>
                </span>
              ) : undefined
            }
          />
          <Row
            icon={ClipboardPaste}
            title="Paste research"
            detail="Free · any AI chat with web search"
            trailing={
              aired ? (
                <ActButton tone={pending === 0 && !pasting && !research?.payload.rulesNote ? "chyron" : "plain"} disabled={!!working} onClick={() => setPasting((v) => !v)}>
                  {pasting ? "Cancel" : "Start"}
                </ActButton>
              ) : undefined
            }
          />
        </Rows>
      </Section>

      {pasting && <PastePanel seasonId={seasonId} episode={episode} busy={!!working} onSubmit={doPaste} />}

      <BotResearchRuns
        season={season}
        episode={episode}
        aired={aired}
        onFiled={async () => {
          await refetch();
          await queryClient.invalidateQueries({ queryKey: ["season-decisions", seasonId] });
        }}
      />

      {working === "research" && <Notice tone="quiet">Working through the checklist, tens of seconds. Leave this open.</Notice>}
      {error && <Notice tone="bad">{error}</Notice>}
      {note && <Notice>{note}</Notice>}
      {research && <ResearchResult research={research} busy={!!working} onForce={() => doResearch(true)} forceCost={estimate("research", models.research)} rulesHref={`${base}/rules?check=1`} />}

      {!aired && <Notice tone="quiet">Nothing to gather until it airs.</Notice>}
      <p className="text-[13px] leading-snug text-muted-foreground">
        {curator
          ? "Anything new is staged for each league's commissioner to apply."
          : "Anything new joins the review list. Nothing reaches a league until you accept it."}
      </p>

      <BingoBank seasonId={seasonId} episode={episode} />

      {decisions.length > 0 && (
        <StickyBar note={pending ? `${count(pending, "result")} waiting` : `${count(decisions.length, "result")}, all decided`}>
          <ActButton tone={pending ? "chyron" : "plain"} href={`${base}/episodes/${episode}/review`} className="min-h-12">
            {pending ? `Review ${pending}` : "See results"}
          </ActButton>
        </StickyBar>
      )}

      <BottomSheet open={menu} onOpenChange={setMenu} title={`Episode ${episode}`}>
        {early && (
          <SheetAction danger onClick={discardResearch}>
            Discard research
          </SheetAction>
        )}
        <SheetAction danger onClick={clearEpisode}>
          Clear episode data
        </SheetAction>
        {decisions.some((d) => d.status !== "pending") && (
          <SheetAction danger onClick={clearEverything}>
            Clear everything, including accepted
          </SheetAction>
        )}
      </BottomSheet>
    </AdminPage>
  );
}

// The paste path. The prompt is the same checklist this app would ask itself, worded for a one-box chat
// tool; fetching it costs nothing (no model call), so it's fetched on open.
//
// JSON is the default: the prompt carries the exact schema plus a skeleton (this episode's people, the
// show's answer options, any open predictions) and the answer is read directly, free. Prose is for a
// chat that won't write clean JSON: one small paid call structures it, so it's offered only with paid
// actions showing.
function PastePanel({ seasonId, episode, busy, onSubmit }: { seasonId: string; episode: number; busy: boolean; onSubmit: (notes: string, structured: boolean) => void }) {
  const showPaid = useShowPaidAi();
  const models = useAiModels();
  const [mode, setMode] = useState<"json" | "prose">("json");
  const structured = mode === "json" || !showPaid;
  const { data, isLoading, error } = useQuery({
    queryKey: ["paste-import-prompt", seasonId, episode, structured],
    queryFn: () => api.adminPasteImportPrompt(seasonId, episode, structured),
  });
  const [notes, setNotes] = useState("");
  return (
    <div className="flex flex-col gap-4">
      {showPaid && (
        <Segmented
          label="Answer format"
          value={mode}
          options={[
            ["json", "JSON · free"],
            ["prose", `Prose · ${estimate("pasteResearch", models.research)}`],
          ]}
          onChange={setMode}
        />
      )}
      <ol className="flex flex-col gap-4">
        <Step n={1} on={!notes.trim()} label="Ask an AI">
          {data && (
            <span className="text-[13px] text-muted-foreground">
              About {count(data.castCount, "person", "people")}
              {data.betCount ? `, ${count(data.betCount, "open prediction")}` : ""}.
            </span>
          )}
          {isLoading && <span className="text-[13px] text-muted-foreground">Building the prompt…</span>}
          {error && <Notice tone="bad">{errorText(error, "Couldn't build the prompt.")}</Notice>}
          <AskAi prompt={data?.prompt} task={`researching what happened in episode ${episode}`} onAnswer={setNotes} answered={!!notes.trim()} />
          <span className="text-[13px] text-muted-foreground">Or copy the prompt into any AI chat that can search the web.</span>
        </Step>
        <Step n={2} on={!!notes.trim()} label="Paste the answer">
          <textarea
            aria-label="The chat's answer"
            rows={5}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={structured ? "Paste the chat's JSON answer. A code fence or a line of chatter around it is fine." : "Paste whatever the chat wrote back."}
            className={cn(fieldCls, "min-h-[120px] resize-y py-3", structured && "font-mono text-sm")}
          />
          <ActButton tone="chyron" disabled={busy || !notes.trim()} onClick={() => onSubmit(notes, structured)} className="min-h-12 self-start">
            Add to review
          </ActButton>
        </Step>
      </ol>
    </div>
  );
}
