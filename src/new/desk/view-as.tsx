"use client";

import { useState } from "react";
import { ChevronRight, Eye } from "lucide-react";
import { paths } from "../routes";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";

// View as (src/lib/server/view-as.ts): the desk header's eye picks a player or a commissioner, and the app reloads as one,
// on your own account. Nothing shows it's on but the profile menu, where the Admin row is the way back.

type ViewAs = "player" | "commissioner";

const LENSES: [ViewAs, string, string][] = [
  ["player", "Player", "Every game as someone who plays it: no running it, no admin"],
  ["commissioner", "Commissioner", "Your games at your own role: running the ones you run, no admin"],
];

async function send(method: "POST" | "DELETE", as?: ViewAs) {
  const res = await fetch("/api/me/view-as", as ? { method, headers: { "content-type": "application/json" }, body: JSON.stringify({ as }) } : { method });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || `Request failed (${res.status})`);
}

export function ViewAsButton() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const start = async (as: ViewAs) => {
    setBusy(true);
    try {
      await send("POST", as);
      // A full reload: the layout reads the lens on the server.
      window.location.assign(paths.home);
    } catch (e) {
      setBusy(false);
      toast.quiet(e instanceof Error ? e.message : "Couldn't switch");
    }
  };
  return (
    <>
      <button type="button" data-view-as aria-label="View as" onClick={() => setOpen(true)} className="grid size-10 place-items-center rounded-[3px] hover:bg-secondary">
        <Eye className="size-5" aria-hidden />
      </button>
      <Sheet open={open} onOpenChange={setOpen} title="View as" subtitle="The app as they see it, on your own account. Admin in the profile menu comes back.">
        <div className="flex flex-col gap-2">
          {LENSES.map(([k, title, line]) => (
            <button
              key={k}
              type="button"
              data-view-as-pick={k}
              disabled={busy}
              onClick={() => void start(k)}
              className="nd-press flex min-h-[64px] items-center gap-3 rounded-[3px] bg-background px-3.5 py-2.5 text-left disabled:opacity-55"
            >
              <span className="min-w-0 flex-1">
                <b className="block text-[16px]">{title}</b>
                <small className="block text-[13px] leading-snug text-muted-foreground">{line}</small>
              </span>
              <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}

/** The profile menu's Admin row while viewing as someone: back to you, at the desk. */
export function BackToAdminRow({ as }: { as: ViewAs }) {
  const [busy, setBusy] = useState(false);
  const back = async () => {
    setBusy(true);
    try {
      await send("DELETE");
      window.location.assign(paths.desk());
    } catch (e) {
      setBusy(false);
      toast.quiet(e instanceof Error ? e.message : "Couldn't switch back");
    }
  };
  return (
    <button type="button" data-view-as-back={as} disabled={busy} onClick={() => void back()} className="nd-press mt-3.5 flex min-h-[60px] w-full items-center gap-3 rounded-[3px] bg-card px-3 text-left">
      <span className="grid size-9 flex-none place-items-center rounded-[3px] bg-foreground text-background">
        <Eye className="size-[18px]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-[15px]">Admin</b>
        <small className="block text-[13px] text-muted-foreground">Viewing as a {as}: back to you</small>
      </span>
      <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
    </button>
  );
}
