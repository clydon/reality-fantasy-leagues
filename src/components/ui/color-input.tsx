"use client";

import { useState } from "react";
import { cn } from "cn";

// A color swatch (the browser's picker) with an editable hex value beside it, so a color can be
// typed or pasted -- e.g. to match the same player color across leagues. The text field only
// commits a complete #rrggbb (or #rgb, expanded) on blur/Enter; anything else snaps back.
export function ColorInput({
  value,
  onChange,
  disabled,
  swatchClassName = "h-7 w-7",
}: {
  value: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
  swatchClassName?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  function commit() {
    if (draft === null) return;
    const hex = normalizeHex(draft);
    setDraft(null);
    if (hex && hex !== value.toLowerCase()) onChange(hex);
  }

  return (
    <span className="flex shrink-0 items-center gap-1">
      <input
        type="color"
        className={cn("shrink-0 rounded border border-border p-0", swatchClassName)}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      <input
        className="h-7 w-[4.6rem] rounded border border-border bg-card px-1.5 font-mono text-xs uppercase disabled:opacity-60"
        aria-label="Hex color"
        value={draft ?? value}
        disabled={disabled}
        maxLength={7}
        spellCheck={false}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setDraft(null);
        }}
      />
    </span>
  );
}

function normalizeHex(input: string): string | null {
  const s = input.trim().replace(/^#?/, "").toLowerCase();
  if (/^[0-9a-f]{6}$/.test(s)) return `#${s}`;
  if (/^[0-9a-f]{3}$/.test(s)) return `#${s.replace(/./g, (ch) => ch + ch)}`;
  return null;
}
