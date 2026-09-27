"use client";

import { THEME_LABELS, useTheme, type ThemeChoice } from "@/lib/theme";
import { cn } from "cn";

const CHOICES: ThemeChoice[] = ["light", "dark", "system"];

/** Light / Dark / Match device, as a small segmented control. Remembered in this browser. */
export function ThemePicker({ className }: { className?: string }) {
  const [choice, setChoice] = useTheme();
  return (
    <div role="radiogroup" aria-label="Theme" className={cn("flex overflow-hidden rounded-md border border-border", className)}>
      {CHOICES.map((c) => (
        <button
          key={c}
          role="radio"
          aria-checked={choice === c}
          className={cn(
            "flex-1 px-2 py-1 text-xs font-semibold",
            choice === c ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-secondary"
          )}
          onClick={() => setChoice(c)}
        >
          {c === "system" ? "Auto" : THEME_LABELS[c]}
        </button>
      ))}
    </div>
  );
}
