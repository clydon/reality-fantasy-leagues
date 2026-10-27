"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useElapsed } from "@/components/ask-ai";
import { Bot } from "lucide-react";
import { api, type BotResearchRun } from "@/lib/api";
import type { ShowSeason } from "@/lib/game/types";
import * as Air from "@/lib/game/air-schedule.js";
import { ActButton, Notice, Section, errorText } from "./admin-ui";
import { afterLabel } from "./bot-research-settings";
import { cn } from "cn";

// One episode's bot research (experimental, db/bot-research.js): every run so far, scheduled or asked
// for, with what it found -- a quick check's answer is shown right here, a full run's results join the
// review list, trivia's questions are listed with why any were dropped -- and "Run now" for each kind,
// outside the schedule.

const KIND: Record<string, string> = { quick: "Quick check", full: "Full research", schedule: "Schedule check", trivia: "Trivia", tiebreak: "Tie-break", rulebook: "Rulebook check" };

function slotLabel(slot: string) {
  if (slot === "now") return "run by hand";
  const [kind, at] = slot.split("@");
  const after = Number(at);
  if (!Number.isFinite(after)) return slot;
  return kind === "trivia" ? `${afterLabel(after)} before the next episode` : `${afterLabel(after)} after it ends`;
}

export function BotResearchRuns({ season, episode, aired, onFiled }: { season: ShowSeason; episode: number; aired: boolean; onFiled: () => unknown }) {
  const queryClient = useQueryClient();
  const runs = useQuery({
    queryKey: ["bot-runs", season.id, episode],
    queryFn: () => api.adminBotRuns(season.id, episode),
    // A scheduled run can start any minute after an episode ends; poll while one is going.
    refetchInterval: (q) => (q.state.data?.runs.some((r) => r.ok === null) ? 5000 : 60_000),
  });
  const runNow = useMutation({
    mutationFn: (kind: "quick" | "full" | "schedule" | "trivia") => api.adminBotRunNow(season.id, episode, kind),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["bot-runs", season.id, episode] });
      await onFiled();
    },
  });
  const elapsed = useElapsed(runNow.isPending, runNow.submittedAt);

  const list = runs.data?.runs ?? [];
  if (!aired && !list.length) return null;

  return (
    <Section
      title="Bot research"
      aside={<span className="mb-1 rounded-[3px] border border-input px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Experimental</span>}
    >
      <p className="text-[13px] leading-snug text-muted-foreground">
        {season.botResearchOn
          ? "On a schedule from each air time (the season's Setup). Free: our bot asks ChatGPT."
          : "No schedule for this season (turn it on in Setup). You can still run it by hand. Free."}
      </p>
      {list.length > 0 && (
        <ul className="flex flex-col border-b border-border [&>*]:border-t [&>*]:border-border">
          {list.map((r) => (
            <RunRow key={r.id} run={r} tz={season.airTz ?? "America/New_York"} />
          ))}
        </ul>
      )}
      {aired && (
        <div className="flex flex-wrap items-center gap-2">
          <ActButton disabled={runNow.isPending} onClick={() => runNow.mutate("quick")}>
            <Bot className="size-[18px]" strokeWidth={2.2} aria-hidden />
            {runNow.isPending && runNow.variables === "quick" ? `Asking… ${elapsed}s` : "Run quick now"}
          </ActButton>
          <ActButton disabled={runNow.isPending} onClick={() => runNow.mutate("full")}>
            {runNow.isPending && runNow.variables === "full" ? `Asking… ${elapsed}s` : "Run full now"}
          </ActButton>
          <ActButton disabled={runNow.isPending} onClick={() => runNow.mutate("schedule")}>
            {runNow.isPending && runNow.variables === "schedule" ? `Asking… ${elapsed}s` : "Check the next episode's schedule"}
          </ActButton>
          <ActButton disabled={runNow.isPending} onClick={() => runNow.mutate("trivia")}>
            {runNow.isPending && runNow.variables === "trivia" ? `Asking… ${elapsed}s` : "Write trivia now"}
          </ActButton>
        </div>
      )}
      {runNow.isPending && (
        <Notice tone="quiet">
          ChatGPT searches first, so this takes up to {runNow.variables === "trivia" ? "four minutes (it writes, then checks)" : "two minutes"}. Leave this open.
        </Notice>
      )}
      {runNow.isError && <Notice tone="bad">{errorText(runNow.error)}</Notice>}
      {runNow.data && !runNow.data.ok && <Notice tone="bad">{runNow.data.message}</Notice>}
    </Section>
  );
}

function RunRow({ run, tz }: { run: BotResearchRun; tz: string }) {
  const r = run.result;
  const running = run.ok === null;
  return (
    <li className="flex flex-col gap-1 py-3">
      <span className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="text-[15px] font-semibold">
          {KIND[run.kind]} <span className="font-normal text-muted-foreground">· {slotLabel(run.slot)}</span>
        </span>
        <span className="text-[13px] tabular-nums text-muted-foreground">
          {Air.formatInTz(new Date(run.startedAt), tz)}
          {run.seconds != null && ` · ${Math.round(run.seconds)}s`}
        </span>
      </span>
      {running ? (
        <span className="text-[14px] text-muted-foreground">Asking ChatGPT…</span>
      ) : run.kind === "trivia" && r?.questions ? (
        <>
          <span className={cn("text-[14px] leading-snug", run.ok ? "text-muted-foreground" : "text-destructive")}>{run.message}</span>
          <ol className="flex flex-col gap-2 pt-1">
            {r.questions.map((q, i) => (
              <li key={i} className={cn("flex flex-col text-[14px] leading-snug", q.status === "dropped" && "text-muted-foreground")}>
                <span>
                  <span className="font-semibold">Ep {q.episode}.</span> {q.question}
                </span>
                <span className="text-[13px]">
                  {q.options.map((o) => (o === q.answer ? `[${o}]` : o)).join(" · ")}
                </span>
                {q.status === "dropped" ? (
                  <span className="text-[13px] text-destructive">Dropped: {q.note}</span>
                ) : (
                  <a href={q.source} target="_blank" rel="noopener noreferrer" className="text-[13px] text-muted-foreground underline underline-offset-2">
                    {hostOf(q.source)}
                  </a>
                )}
              </li>
            ))}
            {(r.dropped ?? []).map((d) => (
              <li key={`d${d.index}`} className="text-[13px] leading-snug text-muted-foreground">
                {d.question ?? "A question"} <span className="text-destructive">Dropped: {d.why}</span>
              </li>
            ))}
          </ol>
        </>
      ) : run.ok && run.kind === "quick" && r ? (
        <>
          <span className="text-[15px] leading-snug">
            {r.left?.length ? `${r.left.map((p) => p.name + (p.how ? ` (${p.how})` : "")).join(", ")} left.` : "Nobody left."}
          </span>
          {r.headline && <span className="text-[14px] leading-snug text-muted-foreground">{r.headline}</span>}
          {!!r.sources?.length && (
            <span className="flex flex-wrap gap-x-3 text-[13px]">
              {r.sources.map((s) => (
                <a key={s} href={s} target="_blank" rel="noopener noreferrer" className="text-muted-foreground underline underline-offset-2">
                  {hostOf(s)}
                </a>
              ))}
            </span>
          )}
        </>
      ) : (
        <span className={cn("text-[14px] leading-snug", run.ok ? "text-muted-foreground" : "text-destructive")}>{run.message}</span>
      )}
    </li>
  );
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
