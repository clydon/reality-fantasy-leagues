"use client";

import { ActButton } from "@/components/ui/act-ui";
import { tourMark } from "@/lib/tour/tour-store";

// The tour's stand-in for the review of a researched show (admin/format-review-screen.tsx): after the
// chat's answer is read, a commissioner checks the rules it found -- what scores, and for how much --
// before approving them. The real screen is long; this one shows the part that matters on a first
// look: each event and its points. The numbers match what the answer pasted in the step before.
const FOUND: [label: string, points: string][] = [
  ["Individual immunity win", "+3"],
  ["Tribe immunity win", "+1"],
  ["Idol or advantage found", "+2"],
  ["Voted out", "−3"],
];

export function TourFormatReview({ onApprove }: { onApprove: () => void }) {
  return (
    <div className="flex flex-col gap-3" data-tour="add-review">
      <div className="flex flex-col gap-0.5">
        <h2 className="type-caption text-[24px] leading-none">The rules it found</h2>
        <p className="text-[15px] text-muted-foreground">Survivor · 4 scoring events (a real show has about 25)</p>
      </div>
      <ul className="flex flex-col border-y border-border [&>li]:border-t [&>li]:border-border [&>li:first-child]:border-t-0">
        {FOUND.map(([label, points]) => (
          <li key={label} className="flex min-h-12 items-center justify-between gap-3">
            <span className="text-base">{label}</span>
            <span className="type-caption text-[20px]">{points}</span>
          </li>
        ))}
      </ul>
      <span data-tour="add-approve" className="self-start">
        <ActButton
          tone="chyron"
          onClick={() => {
            tourMark("add-approved");
            onApprove();
          }}
        >
          Approve these rules
        </ActButton>
      </span>
    </div>
  );
}
