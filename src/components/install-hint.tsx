"use client";

import { useEffect, useState } from "react";
import { useInstallPrompt } from "@/lib/use-install-prompt";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

const DISMISSED_KEY = "install-hint-dismissed";

// Two places use this:
//   "section"  -- Account settings, always visible (install state as a fact about the account).
//   "banner"   -- a dismissible strip in the app shell, phones only, remembered via localStorage
//                 so dismissing it once doesn't ask again every visit (see globals.css's guidance
//                 on this app's browser-storage rule: per-viewer convenience, never load-bearing
//                 state -- losing the dismissal in a private window is a fine failure mode here).
export function InstallHint({ variant }: { variant: "section" | "banner" }) {
  const { standalone, ios, canPrompt, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(true); // default true: nothing flashes before the effect below runs
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (variant !== "banner") return;
    // localStorage doesn't exist during SSR -- a one-time synchronous read once we're in the
    // browser, same as use-install-prompt.ts's standalone check.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDismissed(localStorage.getItem(DISMISSED_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, [variant]);

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Best-effort only -- worst case the banner reappears next visit.
    }
  }

  async function handleInstallClick() {
    setInstalling(true);
    try {
      await promptInstall();
    } finally {
      setInstalling(false);
    }
  }

  if (standalone) {
    return variant === "section" ? (
      <div className="mb-4 rounded-lg border border-border bg-card p-[18px_20px] shadow-sm">
        <h3 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Install app</h3>
        <p className="text-sm text-good">✓ Installed on this device.</p>
      </div>
    ) : null;
  }

  // Nothing actionable to offer (desktop Firefox/Safari, or Chrome before it's decided the page is
  // installable yet): the banner variant stays quiet rather than nagging with no button that does
  // anything, but the section variant still says why, since it's not asking, it's just reporting.
  if (!canPrompt && !ios) {
    return variant === "section" ? (
      <div className="mb-4 rounded-lg border border-border bg-card p-[18px_20px] shadow-sm">
        <h3 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Install app</h3>
        <p className="text-sm text-muted-foreground">
          Look for an install icon in your browser&rsquo;s address bar, or open this site on your phone to install it there.
        </p>
      </div>
    ) : null;
  }

  if (variant === "banner" && dismissed) return null;

  const body = (
    <>
      {canPrompt ? (
        <>
          <p className={cn("text-sm", variant === "section" ? "mb-3 text-muted-foreground" : "flex-1")}>
            Install this app for a faster, full-screen experience and notifications.
          </p>
          <Button size={variant === "banner" ? "sm" : "default"} disabled={installing} onClick={handleInstallClick}>
            {installing ? "Installing…" : "Install app"}
          </Button>
        </>
      ) : (
        <p className={cn("text-sm", variant === "section" ? "text-muted-foreground" : "flex-1")}>
          Tap the Share button <span aria-hidden>⎋</span>, then <b>Add to Home Screen</b> <span aria-hidden>➕</span> to install this app.
        </p>
      )}
    </>
  );

  if (variant === "section") {
    return (
      <div className="mb-4 rounded-lg border border-border bg-card p-[18px_20px] shadow-sm">
        <h3 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Install app</h3>
        {body}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 border-b border-border bg-secondary/60 px-4 py-2.5 max-nav:px-3">
      {body}
      <button className="shrink-0 text-xs font-semibold text-muted-foreground hover:text-foreground" onClick={dismiss} aria-label="Dismiss">
        Dismiss
      </button>
    </div>
  );
}
