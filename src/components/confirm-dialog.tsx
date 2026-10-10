"use client";

import { useConfirmStore } from "@/lib/confirm-store";
import { Button } from "@/components/ui/button";

// The one styled confirmation modal for the whole app -- see confirm-store.ts's `confirm()` for
// how call sites reach it. Mounted once in AuthGate's shell, same as ReportModal.
export function ConfirmDialog() {
  const request = useConfirmStore((s) => s.request);
  const settle = useConfirmStore((s) => s.settle);

  if (!request) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-5"
      onClick={(e) => e.target === e.currentTarget && settle(false)}
    >
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" className="w-full max-w-[400px] rounded-lg bg-card p-[22px] shadow-md">
        <h3 id="confirm-title" className="mb-2 text-base font-bold">{request.title}</h3>
        <p className="mb-4 whitespace-pre-line text-sm text-muted-foreground">{request.message}</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => settle(false)}>
            {request.cancelLabel}
          </Button>
          <Button variant={request.danger ? "destructive" : "default"} onClick={() => settle(true)} data-tour="confirm-accept">
            {request.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
