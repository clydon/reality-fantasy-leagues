"use client";

import { useRef, type ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { cn } from "cn";
import { useSheetSwipe } from "@/components/ui/use-sheet-swipe";

// Row actions as a sheet that slides up from the bottom (docs/PLAN-ux-redesign.md, 1c): one "more"
// button per row instead of a row of buttons, with anything destructive last, in red text, after a
// divider -- never a filled red button sitting next to routine ones. Built on Base UI's Dialog, so
// focus is trapped, Escape and a backdrop tap close it, and the page behind is inert.
//
// On a desktop-width screen it's the same panel, capped in width and anchored to the bottom centre.

export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  hideCancel,
  footer,
  focusSheet,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  /** One line under the title, e.g. "Computer player". */
  description?: ReactNode;
  /** For a sheet that brings its own pair of buttons (e.g. "Not yet" / "Reveal"). */
  hideCancel?: boolean;
  /** Stays put under the scrolling content, above Cancel (the league menu's New league / Join). */
  footer?: ReactNode;
  /** Focus the sheet itself on open, not its first button: for a sheet that opens on its own (What's
   *  New), where a ring on its first link would look like a selection nobody made. */
  focusSheet?: boolean;
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
          className="fixed inset-0 z-[80] bg-(--scrim) transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          ref={popupRef}
          initialFocus={focusSheet ? popupRef : undefined}
          {...swipe}
          className="fixed inset-x-0 bottom-0 z-[81] mx-auto flex max-h-[92dvh] max-w-[480px] flex-col rounded-t-[14px] bg-card px-4 pt-2 text-foreground shadow-sheet outline-none transition-transform duration-200 ease-out data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full"
          style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}
        >
          {/* The grab handle: a swipe down from here closes the sheet even when its content is scrolled.
              The padding makes it a target a thumb can hit; touch-action stops the page scrolling under it. */}
          <div data-sheet-handle className="-mt-2 flex justify-center pb-3 pt-4" style={{ touchAction: "none" }} aria-hidden>
            <span className="h-1 w-10 rounded-full bg-muted-foreground/40" />
          </div>
          {/* A title can be user text (a pasted event name with a URL in it): it wraps, never widens the sheet. */}
          <div className="mb-1 flex min-w-0 items-baseline gap-2.5 [overflow-wrap:anywhere]">
            <Dialog.Title className="type-caption text-[22px]">{title}</Dialog.Title>
            {description && <Dialog.Description className="text-[13px] text-muted-foreground">{description}</Dialog.Description>}
          </div>
          {/* A tall sheet (an editor) scrolls inside itself; the handle, title and Cancel stay put. */}
          <div className="-mx-4 flex min-h-0 flex-col overflow-y-auto overscroll-contain px-4">{children}</div>
          {footer && <div className="pt-4">{footer}</div>}
          {!hideCancel && (
            <Dialog.Close className="mt-3 min-h-12 rounded-[3px] border border-border bg-secondary text-[15px] font-bold text-foreground">
              Cancel
            </Dialog.Close>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** One action row in a BottomSheet. `danger` actions go last: red text, never a red button. */
export function SheetAction({
  onClick,
  danger,
  detail,
  children,
}: {
  onClick: () => void;
  danger?: boolean;
  /** Current value, shown on the right ("Solid"). */
  detail?: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-[52px] items-center justify-between gap-3 border-t border-border text-left text-base font-semibold",
        danger ? "text-destructive" : "text-foreground",
      )}
    >
      <span>{children}</span>
      {detail && <span className="text-sm font-medium text-muted-foreground">{detail}</span>}
    </button>
  );
}
