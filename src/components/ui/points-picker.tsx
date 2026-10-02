"use client";

import StateLogic from "@/lib/game/state-logic.js";
import { cn } from "cn";

// 1, 2 or 3 points for a prediction (StateLogic.MAX_BET_POINTS -- see BetLogic for why 3), as a row
// of small buttons: quicker than a number box on a phone, and nothing out of range to type.
export function PointsPicker({ value, onChange, disabled }: { value: number; onChange: (n: number) => void; disabled?: boolean }) {
  return (
    <span className="inline-flex overflow-hidden rounded-md border border-border" role="radiogroup" aria-label="Points if correct">
      {Array.from({ length: StateLogic.MAX_BET_POINTS }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          disabled={disabled}
          className={cn(
            "w-8 py-0.5 text-xs font-semibold",
            value === n ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-secondary"
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
