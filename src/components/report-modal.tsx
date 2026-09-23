"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useReportModalStore } from "@/lib/report-modal-store";
import { useLeagueStore } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import { cn } from "cn";

// Port of the #reportModal (public/index.html) / openReportModal()-closeReportModal()-sendReport()
// (public/app.js). Only meaningful in live mode -- POST /api/reports requires a real SurvivorDraft
// session server-side (requireAuth), so there's nothing to submit as/against in mock mode; the
// trigger buttons in Sidebar/MobileNav are hidden there rather than opening a modal that would
// just fail.
export function ReportModal() {
  const { open, closeModal } = useReportModalStore();
  const pathname = usePathname();
  const leagueId = useLeagueStore((s) => s.leagueId);
  const leagueName = useLeagueStore((s) => s.leagueName);
  const [type, setType] = useState<"issue" | "feature">("issue");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function handleClose() {
    setMessage("");
    setError(null);
    closeModal();
  }

  async function send() {
    const text = message.trim();
    if (!text) {
      setError("Please describe the issue or idea first.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await api.submitReport(type, text, pathname, leagueId, leagueName);
      handleClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-5" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="relative w-full max-w-[440px] max-h-[90vh] overflow-y-auto rounded-lg bg-card p-[22px] shadow-md">
        <button className="absolute right-3.5 top-3.5 p-1 text-muted-foreground hover:text-foreground" onClick={handleClose} aria-label="Close">
          ✕
        </button>
        <h3 className="mb-3 text-base font-bold">Report an Issue</h3>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Type</label>
        <select
          className="mb-2.5 w-full rounded-md border border-border bg-card px-2.5 py-2 text-sm"
          value={type}
          onChange={(e) => setType(e.target.value as "issue" | "feature")}
        >
          <option value="issue">🐛 Something&rsquo;s broken</option>
          <option value="feature">💡 I have an idea</option>
        </select>
        <textarea
          className="mb-3 w-full resize-y rounded-md border border-border bg-card px-2.5 py-2 text-sm"
          rows={5}
          placeholder={"Bug: what happened, what you expected instead, and the steps to get there again.\nIdea: what you'd want to see and why it'd help."}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <button className="rounded-md border border-border bg-card px-[15px] py-2 text-[0.85rem] font-semibold hover:bg-secondary" onClick={handleClose}>
            Cancel
          </button>
          <button
            className={cn(
              "rounded-md bg-primary px-[15px] py-2 text-[0.85rem] font-semibold text-primary-foreground shadow-sm hover:brightness-[1.06]",
              sending && "opacity-50"
            )}
            onClick={send}
            disabled={sending}
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
