"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useIsAuthenticated, useIsPreviewingDemo } from "@/lib/store";
import { LATEST_RELEASE_ID, RELEASES, unseenItems, type WhatsNewItem } from "@/lib/whats-new";
import { Button } from "@/components/ui/button";
import { ChevronDownIcon } from "@/components/icons";
import { cn } from "cn";
import { create } from "zustand";

// Admin's "Preview What's New": opens the popup on demand. A preview's dismissal isn't recorded --
// it isn't the player seeing it for real -- so it can be opened as often as wanted.
export const useWhatsNewPreview = create<{ open: boolean; show: () => void; hide: () => void }>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));

// The one-time "What's New" popup (content: src/lib/whats-new.ts). Signed-in players only, once per
// release per account: dismissing records the release id on their account. An account created after
// the release just gets it marked as seen -- none of it is "new" to them. Mounted once in AuthGate's
// shell, like ConfirmDialog.
export function WhatsNewModal() {
  const isAuthenticated = useIsAuthenticated();
  const previewingDemo = useIsPreviewingDemo();
  // What this player hasn't seen yet (every release since the one they last dismissed); null = closed.
  const [unseen, setUnseen] = useState<WhatsNewItem[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const preview = useWhatsNewPreview((s) => s.open);
  const hidePreview = useWhatsNewPreview((s) => s.hide);

  useEffect(() => {
    if (!isAuthenticated || previewingDemo) return;
    let cancelled = false;
    api
      .getMySettings()
      .then((s) => {
        if (cancelled || s.whatsNewSeen === LATEST_RELEASE_ID) return;
        const items = unseenItems(s.whatsNewSeen, s.accountCreatedAt);
        // Nothing they'd call new (their account is newer than all of it): just mark it seen.
        if (items.length === 0) {
          api.setMySettings({ whatsNewSeen: LATEST_RELEASE_ID }).catch(() => {});
          return;
        }
        setUnseen(items);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, previewingDemo]);

  // A preview shows the newest release -- what everyone's about to be told.
  const items = preview ? RELEASES[0].items : unseen;
  if (!items) return null;

  function dismiss() {
    if (preview) {
      hidePreview();
      return;
    }
    setUnseen(null);
    api.setMySettings({ whatsNewSeen: LATEST_RELEASE_ID }).catch(() => {});
  }

  return (
    <div className="fixed inset-0 z-[1900] flex items-center justify-center bg-black/50 p-4" onClick={(e) => e.target === e.currentTarget && dismiss()}>
      <div
        role="dialog"
        aria-labelledby="whats-new-title"
        className="whats-new-pop flex max-h-[85vh] w-full max-w-[440px] flex-col overflow-hidden rounded-xl bg-card shadow-xl"
      >
        {/* A splash of the brand colour up top: new features should feel like news. */}
        <div className="bg-gradient-to-br from-primary to-[#e8a25a] px-5 pb-4 pt-5 text-white">
          <h3 id="whats-new-title" className="flex items-center gap-2 text-xl font-bold">
            <span aria-hidden>✨</span> What&rsquo;s new
          </h3>
          <p className="mt-0.5 text-sm text-white/85">Fresh in this update</p>
        </div>
        {/* One line each; a chevron opens the short detail where there is one. */}
        <ul className="flex flex-col divide-y divide-border overflow-y-auto px-2 py-1">
          {items.map((it) =>
            it.detail ? (
              <li key={it.title}>
                <button
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-semibold"
                  aria-expanded={expanded === it.title}
                  onClick={() => setExpanded(expanded === it.title ? null : it.title)}
                >
                  <span className="w-6 shrink-0 text-center text-lg" aria-hidden>
                    {it.icon}
                  </span>
                  <span className="min-w-0 flex-1">{it.title}</span>
                  <ChevronDownIcon
                    className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", expanded === it.title && "rotate-180")}
                  />
                </button>
                {expanded === it.title && <p className="pb-2.5 pl-[2.875rem] pr-3 text-sm text-muted-foreground">{it.detail}</p>}
              </li>
            ) : (
              <li key={it.title} className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-semibold">
                <span className="w-6 shrink-0 text-center text-lg" aria-hidden>
                  {it.icon}
                </span>
                {it.title}
              </li>
            )
          )}
        </ul>
        <div className="flex justify-end border-t border-border px-5 py-3">
          <Button onClick={dismiss}>Let&rsquo;s go!</Button>
        </div>
      </div>
    </div>
  );
}
