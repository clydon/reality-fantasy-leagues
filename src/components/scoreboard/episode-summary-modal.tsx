"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { parseLeagueReply } from "@/lib/game/episode-team-summary";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTeamSummary } from "./use-team-summary";

// The commissioner's "why it mattered" lines for one episode, every team at once: copy one prompt
// into any AI chat, paste its reply back -- it's split onto each team's line here, to check or edit
// before saving. Same copy-out/paste-back shape as the admin's PasteImportPanel -- no model call on
// this app's side. Hand-rolled overlay like report-modal.tsx.
export function EpisodeLinesModal({
  leagueId,
  epId,
  epNumber,
  teams,
  onClose,
}: {
  leagueId: string;
  epId: string;
  epNumber: number;
  teams: { id: string; name: string; color: string }[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useTeamSummary(leagueId, epId);
  // Each team's line as edited here; a team not in it shows its saved line.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const line = (id: string) => drafts[id] ?? data?.notes[id] ?? "";
  const [reply, setReply] = useState("");
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function copyPrompt() {
    if (!data?.prompt) return;
    try {
      await navigator.clipboard.writeText(data.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked (permissions, non-HTTPS) -- the prompt's still selectable in the box below */
    }
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
      await api.saveEpisodeTeamLines(leagueId, epId, Object.fromEntries(teams.map((t) => [t.id, line(t.id)])));
      await queryClient.invalidateQueries({ queryKey: ["team-summary", leagueId, epId] });
      onClose();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-5" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="relative w-full max-w-[480px] max-h-[90vh] overflow-y-auto rounded-lg bg-card p-[22px] shadow-md">
        <button className="absolute right-3.5 top-3.5 p-1 text-muted-foreground hover:text-foreground" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <h3 className="mb-2 text-base font-bold">Episode {epNumber}: why it mattered</h3>
        <p className="mb-2.5 text-xs text-muted-foreground">
          1. Copy this into any AI chat (ChatGPT, Claude.ai, Gemini — whatever you have). 2. Paste its reply below; it fills in each
          team. 3. Check the lines and save. Everyone sees them on the Scoreboard.
        </p>
        {isLoading && <p className="text-xs italic text-muted-foreground">Building the prompt…</p>}
        {error && <p className="text-xs font-semibold text-destructive">{error instanceof ApiError ? error.message : "Couldn't build the prompt."}</p>}
        {data?.prompt && (
          <div className="mb-3 flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <Button variant="secondary" size="xs" onClick={copyPrompt}>
                {copied ? "Copied!" : "Copy prompt"}
              </Button>
              {!data.hasEpisodeSummary && (
                <span className="text-[0.7rem] text-muted-foreground">No episode research yet, so the AI only has the points to go on.</span>
              )}
            </div>
            <textarea
              readOnly
              rows={3}
              value={data.prompt}
              className="w-full resize-y rounded border border-border bg-secondary/40 p-1.5 font-mono text-[0.65rem] text-muted-foreground"
            />
          </div>
        )}
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Paste the reply here</label>
        <Textarea className="mb-1" rows={3} value={reply} onChange={(e) => pasteReply(e.target.value)} />
        {unmatched.length > 0 && (
          <p className="mb-1 text-[0.7rem] text-destructive">
            Couldn&rsquo;t tell which team {unmatched.length === 1 ? "this line is" : "these lines are"} for: {unmatched.join(" / ")}
          </p>
        )}
        <div className="mb-3 mt-2 flex flex-col gap-2">
          {teams.map((t) => (
            <label key={t.id} className="flex flex-col gap-0.5">
              <span className="flex items-center gap-1.5 text-xs font-semibold">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
                {t.name}
              </span>
              <Textarea rows={2} maxLength={400} value={line(t.id)} onChange={(e) => setDrafts((d) => ({ ...d, [t.id]: e.target.value }))} />
            </label>
          ))}
        </div>
        {saveError && <p className="mb-2 text-sm text-destructive">{saveError}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !data}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
