"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { useCanManage, useLeagueStore } from "@/lib/store";
import StateLogic from "@/lib/game/state-logic.js";
import { latestScoredEpisode, parseLeagueReply } from "@/lib/game/episode-team-summary";
import { SettingsPage, MoreOptions, fieldCls } from "@/components/setup/settings-ui";
import { ActButton, CopyButton, Notice, Step, StickyBar } from "@/components/admin/admin-ui";
import { AskAiLinks } from "@/components/ask-ai";
import { useTeamSummary } from "./use-team-summary";

// The commissioner's "why it mattered" lines for the latest episode, every team at once
// (/scoreboard/lines, from the Scoreboard's ⋯): copy one prompt into any AI chat, paste its reply
// back -- it's split onto each team's line here, to check or edit before saving. The same numbered
// copy-out/paste-back steps as the admin's research flows; no model call on this app's side.
// Active Roster, live leagues only: there's no server to save to in demo mode.
export function EpisodeLinesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const state = useLeagueStore((s) => s.state);
  const leagueId = useLeagueStore((s) => (s.mode === "live" ? s.leagueId : null));
  const canManage = useCanManage();
  const type = StateLogic.getLeagueType(state);
  const ep = type.hasActiveRoster && !type.hasWeeklyPicks ? latestScoredEpisode(state) : null;
  const teams = StateLogic.computeScores(state).map((r) => ({ id: r.playerId, name: r.name, color: r.color }));

  const { data, isLoading, error } = useTeamSummary(leagueId, ep?.id ?? null);
  // Each team's line as edited here; a team not in it shows its saved line.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const line = (id: string) => drafts[id] ?? data?.notes[id] ?? "";
  const [reply, setReply] = useState("");
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!ep || !canManage || !leagueId) {
    return (
      <SettingsPage title="Episode lines" back={{ href: "/scoreboard", label: "Scoreboard" }}>
        <p className="text-base text-muted-foreground">
          {!canManage ? "Only the commissioner writes the episode lines." : "There's no scored episode to write lines for yet."}
        </p>
      </SettingsPage>
    );
  }

  function pasteReply(text: string) {
    setReply(text);
    const parsed = parseLeagueReply(text, teams);
    setDrafts((d) => ({ ...d, ...parsed.lines }));
    setUnmatched(parsed.unmatched);
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      await api.saveEpisodeTeamLines(leagueId!, ep!.id, Object.fromEntries(teams.map((t) => [t.id, line(t.id)])));
      await queryClient.invalidateQueries({ queryKey: ["team-summary", leagueId, ep!.id] });
      router.push("/scoreboard");
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const pasted = reply.trim().length > 0;
  // One yellow at a time: Copy until a line's been pasted or typed, then Save.
  const dirty = Object.keys(drafts).length > 0;

  return (
    <SettingsPage title={`Episode ${ep.number} lines`} back={{ href: "/scoreboard", label: "Scoreboard" }}>
      <p className="-mt-2 text-[15px] leading-snug text-muted-foreground">
        One line per team on why Episode {ep.number} mattered to them. Everyone sees them on the Scoreboard.
      </p>
      <ol className="flex flex-col gap-6">
        <Step n={1} on={!pasted && !dirty} label="Copy the prompt into an AI chat that can search the web">
          {isLoading && <Notice tone="quiet">Building the prompt…</Notice>}
          {error && <Notice tone="bad">{error instanceof ApiError ? error.message : "Couldn't build the prompt."}</Notice>}
          {data?.prompt && (
            <>
              <CopyButton text={data.prompt} tone={pasted || dirty ? "plain" : "chyron"} />
              <AskAiLinks prompt={data.prompt} task={`writing a line per team on episode ${ep.number}`} />
              <p className="text-[13px] leading-snug text-muted-foreground">
                {data.hasSource
                  ? "ChatGPT, Claude or Gemini all work. It reads the episode's recap."
                  : "No trusted sites are set for this show, so the AI will look for a recap on its own."}
              </p>
              <MoreOptions label="See the prompt">
                <textarea
                  readOnly
                  rows={6}
                  value={data.prompt}
                  aria-label="The prompt"
                  className="-mt-3 w-full resize-y rounded-[3px] border border-input bg-card p-3 font-mono text-[13px] leading-snug text-muted-foreground"
                />
              </MoreOptions>
            </>
          )}
        </Step>
        <Step n={2} label="Paste its reply here">
          <textarea
            className={`${fieldCls} min-h-28 py-3 leading-snug`}
            rows={4}
            aria-label="The AI's reply"
            placeholder="Paste the whole reply"
            value={reply}
            onChange={(e) => pasteReply(e.target.value)}
          />
          {unmatched.length > 0 && (
            <Notice tone="bad">
              Couldn&rsquo;t tell which team {unmatched.length === 1 ? "this line is" : "these lines are"} for: {unmatched.join(" / ")}
            </Notice>
          )}
        </Step>
        <Step n={3} on={pasted || dirty} label="Check each team's line">
          <div className="flex flex-col gap-4">
            {teams.map((t) => (
              <label key={t.id} className="flex flex-col gap-1.5">
                <span className="flex items-center gap-2 text-[15px] font-semibold">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: t.color }} aria-hidden />
                  {t.name}
                </span>
                <textarea
                  className={`${fieldCls} min-h-20 py-3 leading-snug`}
                  rows={2}
                  maxLength={400}
                  value={line(t.id)}
                  placeholder="No line"
                  onChange={(e) => setDrafts((d) => ({ ...d, [t.id]: e.target.value }))}
                />
              </label>
            ))}
          </div>
        </Step>
      </ol>
      {saveError && <Notice tone="bad">{saveError}</Notice>}
      <StickyBar note="Saving replaces this episode's lines for every team.">
        <ActButton tone={dirty ? "chyron" : "plain"} onClick={save} disabled={saving || !data}>
          {saving ? "Saving…" : "Save lines"}
        </ActButton>
      </StickyBar>
    </SettingsPage>
  );
}
