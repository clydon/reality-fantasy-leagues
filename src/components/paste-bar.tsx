"use client";

import { useState } from "react";
import { ClipboardPaste, X } from "lucide-react";
import { ActButton } from "@/components/ui/act-ui";
import { tourMark } from "@/lib/tour/tour-store";

// Paste and Clear for the boxes where a commissioner pastes an AI chat's answer (the cast, an
// episode's results, a researched show). Paste reads the clipboard in one tap -- the browser asks
// first on some phones -- so nobody has to press-and-hold in the box; if the clipboard can't be read
// (blocked, or an older browser) it says how to paste by hand. Clear empties the box so a second
// answer can replace the first.
//
// In the guided tour `sample` is given: Paste then fills in a ready-made answer instead of reading the
// clipboard, so nobody has to search anything to learn the step (lib/tour/samples.ts).
export function PasteBar({
  value,
  onChange,
  sample,
  disabled,
  tourId,
  tone = "plain",
}: {
  value: string;
  onChange: (text: string) => void;
  /** The tour's ready-made answer; absent outside the tour. */
  sample?: () => string;
  disabled?: boolean;
  tourId?: string;
  tone?: "chyron" | "plain";
}) {
  const [hint, setHint] = useState<string | null>(null);

  async function paste() {
    setHint(null);
    if (sample) {
      onChange(sample());
      if (tourId) tourMark(tourId);
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setHint("Your clipboard is empty. Copy the chat's answer first.");
        return;
      }
      onChange(text);
    } catch {
      setHint("Couldn't read your clipboard. Press and hold in the box, then choose Paste.");
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span data-tour={tourId}>
          <ActButton tone={value.trim() ? "plain" : tone} disabled={disabled} onClick={paste}>
            <ClipboardPaste className="size-[18px]" strokeWidth={2.2} aria-hidden />
            Paste
          </ActButton>
        </span>
        {value && (
          <ActButton disabled={disabled} onClick={() => { setHint(null); onChange(""); }}>
            <X className="size-[18px]" strokeWidth={2.2} aria-hidden />
            Clear
          </ActButton>
        )}
      </div>
      {hint && (
        <p role="status" className="text-[13px] font-semibold text-live">
          {hint}
        </p>
      )}
    </div>
  );
}
