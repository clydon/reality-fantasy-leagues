"use client";

import { useRef, type ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useSheetSwipe } from "@/components/ui/use-sheet-swipe";

// The new design's sheet (the mock's .sheet): rises from the bottom of the phone column over a scrim, a grab
// handle, a condensed caps title with one line under it, and a close button. Base UI's Dialog traps focus and
// closes on Escape or a scrim tap; a swipe down closes it too (classic's use-sheet-swipe.ts). Reduced motion: no
// slide, the scrim still fades.

export function Sheet({
  open,
  onOpenChange,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  const popupRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const swipe = useSheetSwipe({ sheetRef: popupRef, scrimRef, onClose: () => onOpenChange(false) });
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          ref={scrimRef}
          className="nd-fixed-x fixed inset-y-0 z-[80] bg-[var(--scrim)] transition-opacity duration-[250ms] data-[ending-style]:opacity-0 data-[starting-style]:opacity-0"
        />
        <Dialog.Popup
          ref={popupRef}
          {...swipe}
          className="nd-fixed-x fixed bottom-0 z-[81] flex max-h-[88dvh] flex-col rounded-t-[14px] bg-card text-foreground shadow-sheet outline-none transition-transform duration-[380ms] ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none data-[ending-style]:translate-y-[105%] data-[starting-style]:translate-y-[105%]"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <div data-sheet-handle className="flex-none cursor-grab pb-1.5 pt-2.5" style={{ touchAction: "none" }} aria-hidden>
            <i className="mx-auto block h-1 w-10 rounded-full bg-input" />
          </div>
          <div className="flex flex-none items-center justify-between gap-3 px-4 pb-2.5 pt-1">
            <div className="min-w-0 [overflow-wrap:anywhere]">
              <Dialog.Title className="type-caption text-[26px]">{title}</Dialog.Title>
              {subtitle && <Dialog.Description className="mt-[5px] text-[13px] font-medium text-muted-foreground">{subtitle}</Dialog.Description>}
            </div>
            <Dialog.Close aria-label="Close" className="grid size-10 flex-none place-items-center rounded-[3px] hover:bg-secondary">
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>
          <div className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-[22px]">{children}</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
