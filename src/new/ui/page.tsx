"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";

// A page pushed over the current screen (the mock's .page): How it works, More on the couch's pages. It slides in
// from the right over the route you're on, which stays put underneath, and it's in the history (`?page=<key>`),
// so the phone's back gesture closes it. Not a route of its own: the screen under it keeps its state and scroll.
// It renders into <body>, above everything on the screen (a show bar's menu opens one, and the bar is a stacking
// context of its own).

let openedHere: string | null = null;

/** Whether `key`'s page is open, and opening or closing it. `owns`: query params that are the page's own (a stats
 *  page's `?stat=`), set by showWith and dropped with it. */
export function usePushedPage(key: string, owns: string[] = []) {
  const params = useSearchParams();
  const push = (extra: Record<string, string>) => {
    const url = new URL(window.location.href);
    url.searchParams.set("page", key);
    for (const k of owns) url.searchParams.delete(k);
    for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
    openedHere = key;
    window.history.pushState(null, "", url);
  };
  return {
    open: params.get("page") === key,
    show() {
      push({});
    },
    showWith: push,
    close() {
      // Opened by a tap here: going back is closing it. Opened from a link or a reload: just drop it from the URL.
      if (openedHere === key) {
        openedHere = null;
        window.history.back();
      } else {
        const url = new URL(window.location.href);
        url.searchParams.delete("page");
        for (const k of owns) url.searchParams.delete(k);
        window.history.replaceState(null, "", url);
      }
    },
  };
}

const noop = () => () => {};

/** `back`: where back returns you, as its label ("Home"). */
export function PushedPage({ open, onClose, title, back = "Back", children }: { open: boolean; onClose: () => void; title: ReactNode; back?: string; children: ReactNode }) {
  const backButton = useRef<HTMLButtonElement>(null);
  // Only in the browser: the server has no <body> to portal into.
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  useEffect(() => {
    if (!open) return;
    backButton.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!mounted) return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-hidden={!open}
      className={`nd-fixed-x fixed inset-y-0 z-[70] overflow-y-auto bg-background [scrollbar-width:none] transition-[transform,visibility] duration-[450ms] ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none ${
        open ? "visible translate-x-0" : "invisible translate-x-full"
      }`}
    >
      <div className="sticky top-0 z-[3] flex h-14 items-center gap-1.5 border-b border-border bg-[rgba(22,20,29,.9)] px-2.5 backdrop-blur-md">
        <button ref={backButton} type="button" onClick={onClose} className="flex h-11 items-center gap-0.5 rounded-[3px] pl-1 pr-2.5 text-[15px] font-semibold hover:bg-card">
          <ChevronLeft className="size-5" aria-hidden />
          {back}
        </button>
        <h3 className="type-caption flex-1 text-[20px]">{title}</h3>
      </div>
      {open && children}
    </div>,
    document.body
  );
}
