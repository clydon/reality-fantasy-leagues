"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { useAfterWatching, useHome, watching, type HomeShow, type KeepUp } from "../data";
import { Btn } from "../ui/parts";
import { toast } from "../ui/toast";
import { SwitchRow } from "./controls";

// Settings' Move along by itself (keep-up.ts, db/migrations/0141 show_follows.keep_up 'auto'), the fold Shows that move along by
// themselves (the 2026-10-31 redesign): per
// show you follow and don't play, where you are moves to each episode as it airs, without asking. It can spoil an episode you
// watch late, so turning it on asks first, saying so. Off goes back to moving it yourself (Live, if it was, is the where sheet's).

export const plain = (s: HomeShow) => `${s.show.name.replace(/\s*\([^)]*\)\s*$/, "")}${s.seasonNumber ? ` ${s.seasonNumber}` : ""}`;

/** Shows you follow, still on, that you don't play (a game's reveals move that one): the ones that can move along by
 *  themselves. */
export const autoShows = (shows: HomeShow[] | undefined) => (shows ?? []).filter((s) => s.following && !s.games.length && s.status !== "completed");

export function AutoSection() {
  const { data: home } = useHome();
  const after = useAfterWatching();
  const [asking, setAsking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const shows = autoShows(home?.shows);
  if (!shows.length) return null;
  const set = async (s: HomeShow, keepUp: KeepUp, undo: KeepUp) => {
    setBusy(true);
    try {
      await watching.follow(s.seasonId, { keepUp });
      await after();
      setAsking(null);
      toast(keepUp === "auto" ? `${plain(s)} moves along by itself` : `${plain(s)} moves when you say`, {
        undo: async () => {
          await watching.follow(s.seasonId, { keepUp: undo });
          await after();
        },
      });
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div data-settings-auto>
      <small className="block text-[13px] leading-snug text-muted-foreground">
        Where you are moves to each episode as it airs, without asking. Only for shows you always watch the night they&rsquo;re on.
      </small>
      <div className="mt-1">
        {shows.map((s) => {
          const on = s.keepUp === "auto";
          return (
            <div key={s.seasonId} data-auto-show={s.seasonId}>
              <SwitchRow
                data={`auto-${s.seasonId}`}
                on={on}
                disabled={busy}
                title={plain(s)}
                line={on ? "On: moves to each episode as it airs" : s.keepUp === "ask" ? "Live: asks when each one ends" : "Off: moves when you say"}
                onChange={(next) => (next ? setAsking(asking === s.seasonId ? null : s.seasonId) : set(s, "off", "auto"))}
              />
              {asking === s.seasonId && !on && (
                <div data-auto-warn className="mb-3 rounded-[3px] bg-card p-3 outline-1 -outline-offset-1 outline-border">
                  <p className="flex gap-2 text-[13.5px] leading-snug">
                    <TriangleAlert className="mt-0.5 size-4 flex-none" aria-hidden />
                    <span>
                      <b className="font-semibold">This can spoil it.</b> Each episode&rsquo;s results, stats and the couch&rsquo;s chat show as soon as it airs, even
                      the week you watch late. Live asks first instead.
                    </span>
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Btn tone="must" className="flex-1" data-auto-confirm disabled={busy} onClick={() => set(s, "auto", s.keepUp)}>
                      Turn it on
                    </Btn>
                    <Btn className="flex-1" data-auto-cancel onClick={() => setAsking(null)}>
                      Keep it off
                    </Btn>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
