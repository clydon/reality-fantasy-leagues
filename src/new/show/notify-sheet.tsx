"use client";

import { useQueryClient } from "@tanstack/react-query";
import { notesApi, useShowNotify, type ShowNotify } from "../data";
import { NavLink } from "../nav";
import { paths } from "../routes";
import { SwitchRow } from "../settings/controls";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";

// A show's Notifications, from its ⋯ menu (docs/PLAN-new-design.md step 15 part 2; the mock's show.js showMenu): each of the
// show's moments on or off for this show alone (every season of it), over what Settings says for every show. A moment that's off
// in Settings is off here too, and says so. Saves as it's tapped, with Undo. The bell keeps everything either way.

export function ShowNotifySheet({ seasonId, open, onOpenChange }: { seasonId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const q = useShowNotify(seasonId, open);
  const qc = useQueryClient();
  const data = q.data;
  const set = async (moment: ShowNotify["moments"][number], on: boolean, undo = true) => {
    try {
      qc.setQueryData(["new-design", "show-notify", seasonId], await notesApi.show(seasonId, moment.id, on));
      if (undo) toast(`${moment.title}: ${on ? "on" : "off"} for ${data?.show ?? "this show"}`, { undo: () => set(moment, !on, false) });
    } catch (e) {
      toast.quiet((e as Error).message);
    }
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Notifications" subtitle={data ? `${data.show} · just this show` : "…"}>
      <div data-show-notify>
        {data?.moments.map((m) => (
          <SwitchRow
            key={m.id}
            data={`show-${m.id}`}
            on={m.on && m.here}
            disabled={!m.on}
            title={m.title}
            line={m.on ? m.line : "Off for every show, in Settings"}
            onChange={(on) => set(m, on)}
          />
        ))}
        {q.isError && <p className="py-6 text-center text-[14px] text-muted-foreground">Couldn&rsquo;t load them. Try again.</p>}
        <p className="mt-3 text-[13px] leading-snug text-muted-foreground">
          Every show&rsquo;s, and how much of the couch chat reaches you, are in{" "}
          <NavLink href={paths.settings} className="font-semibold text-foreground underline underline-offset-2" onClick={() => onOpenChange(false)}>
            Settings
          </NavLink>
          . The bell on the hub keeps everything either way.
        </p>
      </div>
    </Sheet>
  );
}
