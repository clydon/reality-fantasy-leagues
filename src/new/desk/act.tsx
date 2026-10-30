"use client";

import { useState } from "react";
import { Eye, RotateCcw, Zap } from "lucide-react";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { deskSend } from "./data";
import { Says } from "./parts";

// Act as them (docs/PLAN-desk-parity.md decision 1, part 1b): what it does first, then the app as them under the Viewing as
// bar; its start and end are in their History. From a person's page and from their seat on a game's page (part 6b).

/** Act as them (decision 1): what it does first, then the app as them under the Viewing as bar; it's in History. */
export function ActSheet({ open, onClose, p }: { open: boolean; onClose: () => void; p: { id: string; name: string } }) {
  const [busy, setBusy] = useState(false);
  const points: [typeof Eye, string][] = [
    [Eye, "You see their couches and games, only as far as they've watched."],
    [Zap, `Opening their results reveals them for ${p.name} too. Look around; leave Reveal to them.`],
    [RotateCcw, `"Return to my account" at the top brings you back here, any time.`],
  ];
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={`Act as ${p.name}?`} subtitle="For an hour">
      <div data-act-sheet>
        <Says>For an hour you&apos;re {p.name}: anything you do is done as them. It&apos;s in History.</Says>
        <ul className="mb-[18px] mt-3.5 flex flex-col gap-2.5">
          {points.map(([Icon, t]) => (
            <li key={t} className="flex items-start gap-2.5 text-[14px] leading-snug text-muted-foreground">
              <Icon className="mt-px size-[18px] flex-none text-foreground" aria-hidden />
              <span>{t}</span>
            </li>
          ))}
        </ul>
        <Btn
          data-act-go
          tone="must"
          wide
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const { go } = await deskSend<{ go: string }>(`/people/${p.id}/act`, {});
              // A full load: their session, and the design they use.
              window.location.assign(go);
            } catch (e) {
              setBusy(false);
              toast.quiet((e as Error).message);
            }
          }}
        >
          Act as {p.name}
        </Btn>
        <Btn wide className="mt-2" onClick={onClose}>
          Not now
        </Btn>
      </div>
    </Sheet>
  );
}
