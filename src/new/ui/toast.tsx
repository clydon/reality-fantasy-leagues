"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { Check } from "lucide-react";

// The toast (the mock's .toast): a white caption plate that drops in from the top with a teal check tag, says what
// just happened, and goes after a few seconds. An action can carry Undo (guards by blast radius, tier 1: instant,
// with Undo). One at a time: a new toast replaces the last.

interface Toast {
  id: number;
  text: string;
  undo?: () => void;
}

const useToasts = create<{ current: Toast | null; shown: boolean }>(() => ({ current: null, shown: false }));
let seq = 0;
let hideTimer: ReturnType<typeof setTimeout> | undefined;

export function toast(text: string, opts: { undo?: () => void } = {}) {
  clearTimeout(hideTimer);
  useToasts.setState({ current: { id: ++seq, text, undo: opts.undo }, shown: true });
  hideTimer = setTimeout(dismiss, opts.undo ? 5000 : 2600);
}

function dismiss() {
  useToasts.setState({ shown: false });
}

/** Mounted once, in the new design's layout. */
export function ToastHost() {
  const { current, shown } = useToasts();
  useEffect(() => () => clearTimeout(hideTimer), []);
  return (
    <div
      role="status"
      aria-live="polite"
      className="nd-fixed-x pointer-events-none fixed top-0 z-[90] flex justify-center px-4 pt-[calc(14px+env(safe-area-inset-top,0px))]"
    >
      <div
        className={`pointer-events-auto flex w-full max-w-[358px] items-stretch overflow-hidden rounded-[3px] bg-plate text-plate-foreground shadow-[0_12px_30px_rgba(0,0,0,.45)] transition-[transform,visibility] duration-500 ease-[cubic-bezier(.34,1.45,.64,1)] motion-reduce:transition-none ${
          // Hidden once it's gone up, or its shadow shows at the top of a Studio screen (step 15 part 4).
          shown && current ? "visible translate-y-0" : "invisible -translate-y-[160%]"
        }`}
      >
        <span className="tag-cut grid place-items-center bg-good pl-2.5 pr-4 text-good-foreground [--tag-slant:10px]">
          <Check className="size-[18px]" strokeWidth={3} aria-hidden />
        </span>
        <span className="tag-tuck flex flex-1 items-center justify-between gap-2 py-3 pl-[18px] pr-3 text-sm font-semibold [--tag-slant:10px]">
          {current?.text}
          {current?.undo && (
            <button
              type="button"
              className="h-7 shrink-0 rounded-[3px] bg-chyron-foreground px-2.5 text-[13px] font-extrabold text-white"
              onClick={() => {
                current.undo?.();
                dismiss();
              }}
            >
              Undo
            </button>
          )}
        </span>
      </div>
    </div>
  );
}
