"use client";

import { useSyncExternalStore } from "react";
import type { GameWordsResult } from "@/lib/server/game-words";
import { toast } from "../../ui/toast";

// Our AI's waits, kept past the sheet (moved from today's wizard, start-wizard.tsx, with B1 of docs/PLAN-start-a-game-redo.md):
// Describe your game asks our bot (about 40 seconds); leaving the sheet keeps the ask going, and a See it toast reopens the sheet on
// Describe when the game is in. One job a season at a time; a new ask replaces the last.

export type Job = {
  seasonId: string;
  couchId: string | null;
  words: string;
  started: number;
  state: "wait" | "done" | "error";
  result?: GameWordsResult;
  error?: { status: number; message: string };
};

let jobs: Record<string, Job> = {};
const listeners = new Set<() => void>();
const NONE: Record<string, Job> = {};

export const jobKey = (seasonId: string) => `${seasonId}|ask`;

export function setJob(k: string, j: Job | null) {
  jobs = { ...jobs };
  if (j) jobs[k] = j;
  else delete jobs[k];
  listeners.forEach((l) => l());
}

export function useJobs(): Record<string, Job> {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => jobs,
    () => NONE
  );
}

/** Where a See it toast opens the sheet: set by the host (start-game.tsx). */
let reopen: ((seasonId: string, couchId: string | null) => void) | null = null;
export function setReopen(f: typeof reopen) {
  reopen = f;
}
/** The season whose Describe is on screen now (null: none), so a job that lands while you look doesn't toast. */
let looking: string | null = null;
export function setLooking(seasonId: string | null) {
  looking = seasonId;
}

export function runJob(asked: Omit<Job, "started" | "state">, call: () => Promise<GameWordsResult>) {
  const k = jobKey(asked.seasonId);
  const job: Job = { ...asked, started: Date.now(), state: "wait" };
  setJob(k, job);
  call().then(
    (result) => {
      if (jobs[k]?.started !== job.started) return;
      setJob(k, { ...job, state: "done", result });
      if (looking !== job.seasonId) toast("Your game is ready", { label: "See it", undo: () => reopen?.(job.seasonId, job.couchId), ms: 10_000 });
    },
    (e: Error & { status?: number }) => {
      if (jobs[k]?.started !== job.started) return;
      setJob(k, { ...job, state: "error", error: { status: e.status ?? 0, message: e.message } });
      if (looking !== job.seasonId) toast.quiet(e.status === 503 ? "Our AI isn't answering: that one didn't count" : e.message);
    }
  );
}
