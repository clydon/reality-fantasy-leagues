"use client";

import { useQueryClient } from "@tanstack/react-query";
import { notesApi, useShowNotify, type ShowNotify } from "../data";
import { NavLink } from "../nav";
import { paths } from "../routes";
import { SwitchRow } from "../settings/controls";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { turnOn, useReach } from "./remind";

// A show's Notifications, from its ⋯ menu (docs/PLAN-new-design.md step 15 part 2; the mock's show.js showMenu): each of the
// show's moments on or off for this show alone (every season of it), over what Settings says for every show. A moment that's off
// in Settings is off here too, and says so. Saves as it's tapped, with Undo. The bell keeps everything either way. Switches only
// matter on a phone that gets them: while none of yours does (this phone off, or an iPhone not yet on the Home Screen), the sheet
// leads with that, and Turn on, since a moment switched on for a phone that never rings is the "looks on but isn't" failure.

export function ShowNotifySheet({ seasonId, open, onOpenChange }: { seasonId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const q = useShowNotify(seasonId, open);
  const qc = useQueryClient();
  const { phone, reaches } = useReach(open);
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
        {/* Blocked is this phone's own fact, true whatever else of yours rings; off and install only matter while nothing does. */}
        {((reaches === false && (phone === "off" || phone === "install")) || phone === "blocked") && (
          <div data-show-notify-phone={phone} className="mb-2 flex items-center gap-3 rounded-[3px] bg-secondary p-3">
            <span className="min-w-0 flex-1">
              <b className="block text-[15px] font-semibold">{phone === "blocked" ? "Blocked on this phone" : "Off on this phone"}</b>
              <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
                {phone === "off"
                  ? "Turn them on to hear when results are in and it's your move."
                  : phone === "install"
                    ? "On iPhone, notifications work once Game Your Show is on your Home Screen: Share, then Add to Home Screen."
                    : "Your browser's settings block notifications from this site. Allow them there, then come back."}
              </small>
            </span>
            {phone === "off" && (
              <Btn tone="ink" data-show-notify-on className="h-10 flex-none px-3.5 text-sm" onClick={() => turnOn(() => qc.invalidateQueries({ queryKey: ["new-design", "profile"] }))}>
                Turn on
              </Btn>
            )}
          </div>
        )}
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
