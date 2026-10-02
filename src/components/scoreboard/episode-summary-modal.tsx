"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTeamSummary } from "./use-team-summary";

// The viewer's own "why it mattered" line for an episode: copy the prompt into any AI chat, paste its
// one sentence back, save. Same copy-out/paste-back shape as the admin's PasteImportPanel -- no model
// call on this app's side. Hand-rolled overlay like report-modal.tsx.
export function EpisodeSummaryModal({
  leagueId,
  epId,
  epNumber,
  onClose,
}: {
  leagueId: string;
  epId: string;
  epNumber: number;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useTeamSummary(leagueId, epId);
  const mine = data?.mine ?? null;
  // Seeded from the saved line once; null = untouched.
  const [draft, setDraft] = useState<string | null>(null);
  const why = draft ?? mine?.why ?? "";
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function copyPrompt() {
    if (!mine?.prompt) return;
    try {
      await navigator.clipboard.writeText(mine.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked (permissions, non-HTTPS) -- the prompt's still selectable in the box below */
    }
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      await api.saveEpisodeTeamSummary(leagueId, epId, why);
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
      <div className="relative w-full max-w-[440px] max-h-[90vh] overflow-y-auto rounded-lg bg-card p-[22px] shadow-md">
        <button className="absolute right-3.5 top-3.5 p-1 text-muted-foreground hover:text-foreground" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <h3 className="mb-2 text-base font-bold">Why episode {epNumber} went your way (or didn&rsquo;t)</h3>
        <p className="mb-2.5 text-xs text-muted-foreground">
          1. Copy this into any AI chat (ChatGPT, Claude.ai, Gemini — whatever you have). 2. Paste its one-sentence answer below.
          3. Save. Everyone in the league sees it on your Scoreboard card.
        </p>
        {isLoading && <p className="text-xs italic text-muted-foreground">Building the prompt…</p>}
        {error && <p className="text-xs font-semibold text-destructive">{error instanceof ApiError ? error.message : "Couldn't build the prompt."}</p>}
        {mine && (
          <div className="mb-3 flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <Button variant="secondary" size="xs" onClick={copyPrompt}>
                {copied ? "Copied!" : "Copy prompt"}
              </Button>
              {!mine.hasEpisodeSummary && (
                <span className="text-[0.7rem] text-muted-foreground">No episode notes yet — the prompt has just your numbers.</span>
              )}
            </div>
            <textarea
              readOnly
              rows={4}
              value={mine.prompt}
              className="w-full resize-y rounded border border-border bg-secondary/40 p-1.5 font-mono text-[0.65rem] text-muted-foreground"
            />
          </div>
        )}
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Paste the answer here</label>
        <Textarea className="mb-3" rows={3} maxLength={400} value={why} onChange={(e) => setDraft(e.target.value)} />
        {saveError && <p className="mb-2 text-sm text-destructive">{saveError}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !mine}>
            {saving ? "Saving…" : why.trim() ? "Save" : "Clear"}
          </Button>
        </div>
      </div>
    </div>
  );
}
