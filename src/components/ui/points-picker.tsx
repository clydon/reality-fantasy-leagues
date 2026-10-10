"use client";

import StateLogic from "@/lib/game/state-logic.js";
import { cn } from "cn";

// 1, 2 or 3 points for a prediction (StateLogic.MAX_BET_POINTS -- see BetLogic for why 3), as a row
// of buttons: quicker than a number box on a phone, and nothing out of range to type. 44px each, the
// chosen one in the "You" fill like a segmented control (the sheet's own button is the chyron).
export function PointsPicker({ value, onChange, disabled }: { value: number; onChange: (n: number) => void; disabled?: boolean }) {
  return (
    <span className="inline-flex overflow-hidden rounded-[3px] border border-input" role="radiogroup" aria-label="Points if correct">
      {Array.from({ length: StateLogic.MAX_BET_POINTS }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          disabled={disabled}
          className={cn(
            "type-num size-11 text-[18px] focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-chyron-line [&+&]:border-l [&+&]:border-input",
            value === n ? "bg-foreground text-background" : "bg-card text-muted-foreground hover:bg-secondary"
          )}
          onClick={(e) => {
            e.stopPropagation();
            if (n !== value) onChange(n);
          }}
        >
          {n}
        </button>
      ))}
    </span>
  );
}
