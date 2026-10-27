"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkles, Users } from "lucide-react";
import { roster as rosterApi, useRoster } from "../data";
import type { ShowData } from "../screens/show-space";
import { Btn, EmptyState } from "../ui/parts";
import { toast } from "../ui/toast";
import { PasteSheet } from "./recaps";

// A sport's Players tab (rosters.ts, db/migrations/0144): who's playing, by team (players, then the manager and coaches), then the
// officials, each with what they do. TV listings only list a sport's broadcasters, so a sport nobody's made a game of starts with
// nobody, and Fill in who's playing asks ChatGPT (our bot, else copy and paste). A roster isn't a spoiler: who's on a team is known
// before the game. A sport that's a game keeps the cast tab (cast.tsx), with its stats.

export function Roster({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const read = useRoster(seasonId);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [paste, setPaste] = useState(false);
  const r = read.data;
  const asking = !!r?.asking;
  const was = useRef(asking);
  useEffect(() => {
    if (was.current && !asking) {
      if (r?.message) toast.quiet(r.message);
      else toast(`Filled in who's playing`);
    }
    was.current = asking;
  }, [asking, r?.message]);
  const people = show.words.people.toLowerCase();
  if (read.error) return <EmptyState icon={Users} title={`Couldn't load the ${people}`} line={(read.error as Error).message} />;
  if (!r) return <div className="mx-4 mt-5 h-72 animate-pulse rounded-[4px] bg-card" aria-busy />;
  const ask = async () => {
    setBusy(true);
    try {
      qc.setQueryData(["new-design", "roster", seasonId], await rosterApi.ask(seasonId));
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!r.groups.length) {
    if (!r.canFill) return <EmptyState icon={Users} title={`No ${people} yet`} line={`The ${people} show up here once the season's cast is in.`} />;
    return (
      <section className="mt-5 px-4" data-roster-fill={asking ? "asking" : "ask"}>
        <div className="flex flex-col gap-2 rounded-[4px] bg-card p-4 outline-1 -outline-offset-1 outline-border">
          <b className="flex items-center gap-2 text-[17px] leading-tight">
            <Sparkles className="size-[18px] flex-none" aria-hidden />
            Fill in who&rsquo;s playing
          </b>
          <small className="text-[13.5px] leading-snug text-muted-foreground">
            {asking
              ? "ChatGPT is looking it up. It takes a minute or two; you can leave this page."
              : `TV listings only list a sport's broadcasters. ChatGPT can find each team's ${people}, coaches and the officials. Everyone on the show sees them.`}
          </small>
          {!asking && r.message && <small className="text-[13px] font-semibold leading-snug text-live">{r.message}</small>}
          {!asking && (
            <div className="mt-1 flex flex-col gap-1.5">
              {r.available && (
                <Btn tone="must" wide data-roster-ask disabled={busy} onClick={ask}>
                  {busy ? "Asking…" : "Ask ChatGPT for me"}
                </Btn>
              )}
              <button type="button" data-roster-paste onClick={() => setPaste(true)} className="self-start py-1.5 text-[13px] font-semibold text-muted-foreground underline underline-offset-2">
                {r.available ? "Or copy and paste it yourself" : "Our bot's away: copy and paste instead"}
              </button>
            </div>
          )}
        </div>
        <PasteSheet
          open={paste}
          onOpenChange={setPaste}
          prompt={async () => (await rosterApi.prompt(seasonId)).prompt}
          save={async (answer) => {
            const out = await rosterApi.paste(seasonId, answer);
            qc.setQueryData(["new-design", "roster", seasonId], out);
            return out.filled;
          }}
        />
      </section>
    );
  }

  return (
    <div className="pb-6" data-roster>
      {r.groups.map((g) => (
        <section key={g.name} className="mt-6 px-4" data-roster-group={g.name}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <h2 className="type-caption text-[22px]">{g.name}</h2>
            <span className="text-[13px] text-muted-foreground">{g.people.length}</span>
          </div>
          {g.people.map((p) => (
            <div key={p.name} data-roster-person={p.name} className="flex min-h-[52px] items-center gap-3 border-t border-border py-1.5">
              <span aria-hidden className="type-caption grid size-9 flex-none place-items-center rounded-[3px] bg-secondary text-[15px]">
                {p.name
                  .split(/\s+/)
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[15px] font-semibold">{p.name}</b>
                {p.role && <small className="block truncate text-[13px] text-muted-foreground">{p.role}</small>}
              </span>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
