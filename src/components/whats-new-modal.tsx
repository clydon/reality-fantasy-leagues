"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useIsAuthenticated, useIsPreviewingDemo } from "@/lib/store";
import { WHATS_NEW } from "@/lib/whats-new";
import { Button } from "@/components/ui/button";

// The one-time "What's New" popup (content: src/lib/whats-new.ts). Signed-in players only, once per
// release per account: dismissing records the release id on their account. An account created after
// the release just gets it marked as seen -- none of it is "new" to them. Mounted once in AuthGate's
// shell, like ConfirmDialog.
export function WhatsNewModal() {
  const isAuthenticated = useIsAuthenticated();
  const previewingDemo = useIsPreviewingDemo();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || previewingDemo) return;
    let cancelled = false;
    api
      .getMySettings()
      .then((s) => {
        if (cancelled || s.whatsNewSeen === WHATS_NEW.id) return;
        if (s.accountCreatedAt && s.accountCreatedAt.slice(0, 10) >= WHATS_NEW.date) {
          api.setMySettings({ whatsNewSeen: WHATS_NEW.id }).catch(() => {});
          return;
        }
        setOpen(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, previewingDemo]);

  if (!open) return null;

  function dismiss() {
    setOpen(false);
    api.setMySettings({ whatsNewSeen: WHATS_NEW.id }).catch(() => {});
  }

  return (
    <div className="fixed inset-0 z-[1900] flex items-center justify-center bg-black/50 p-4" onClick={(e) => e.target === e.currentTarget && dismiss()}>
      <div role="dialog" aria-labelledby="whats-new-title" className="flex max-h-[85vh] w-full max-w-[440px] flex-col rounded-lg bg-card shadow-md">
        <h3 id="whats-new-title" className="border-b border-border px-5 pb-3 pt-4 text-lg font-bold">
          What&rsquo;s new
        </h3>
        <ul className="flex flex-col gap-3 overflow-y-auto px-5 py-4">
          {WHATS_NEW.items.map((it) => (
            <li key={it.title} className="text-sm">
              <div className="font-semibold">{it.title}</div>
              <div className="text-muted-foreground">{it.detail}</div>
            </li>
          ))}
        </ul>
        <div className="flex justify-end border-t border-border px-5 py-3">
          <Button onClick={dismiss}>Got it</Button>
        </div>
      </div>
    </div>
  );
}
