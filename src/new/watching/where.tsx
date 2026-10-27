"use client";

import { useState } from "react";
import { useAiredEpisodes, type CatalogSeason, type KeepUp, type StepEpisode } from "../data";
import { SwitchRow } from "../settings/controls";
import { Btn, Stepper } from "../ui/parts";
import { ShowArt } from "../ui/show-bar";
import { whereCap, whereLabel } from "../way-in";

// Where you are in a season (docs/PLAN-new-design.md step 9 part 2's first run, step 10 part 1's show space): a stepper
// from Haven't started to what's aired, never past it (the guard shows nothing after it: guard.ts). A season you play has
// none: where you are moves as you reveal each episode.
// Each step says which episode it is: when it aired, and its title once you've seen it (a sport's always: its titles are the
// matchups). I'm up to date jumps to the latest and turns on Live (keep-up.ts): when each new episode ends, Tonight asks
// "Seen it?", so nothing opens until you say.

export type WhereSeason = Pick<CatalogSeason, "seasonId" | "label" | "show" | "artUrl" | "artPosition" | "aired" | "status" | "premiere"> & {
  /** Its aired episodes, when the caller has them (a TV listing's); else read for a season that's here. */
  episodes?: StepEpisode[];
};

const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

/** "Game 2: Rays at Brewers · Sat, Oct 24", "Episode 5 · Tue, Oct 20": which episode a step is. */
function stepLine(ep: StepEpisode | undefined): string | null {
  if (!ep) return null;
  const day = ep.airAt ? new Date(ep.airAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : null;
  return [ep.title ?? `Episode ${ep.number}`, day].filter(Boolean).join(" · ");
}

/** One season's row: its art, where you are in words (and which episode that is), and the stepper (none before its premiere). */
export function WhereRow({
  s,
  seen,
  onChange,
  fixed,
  line,
  episodes,
}: {
  s: WhereSeason;
  seen: number;
  onChange: (n: number) => void;
  fixed?: boolean;
  line?: string;
  episodes?: StepEpisode[];
}) {
  const step = seen > 0 ? stepLine(episodes?.find((e) => e.number === seen)) : null;
  return (
    <div className="flex min-h-[76px] items-center gap-3 border-t border-border py-2 first:border-t-0" data-where={s.label}>
      <ShowArt seasonId={`where-${s.seasonId}`} artUrl={s.artUrl} name={s.show[0]} position={s.artPosition} className="h-12 w-16 flex-none rounded-[3px] text-[22px]" />
      <div className="min-w-0 flex-1">
        <b className="type-caption block truncate text-[17px]">{s.label}</b>
        <small className="block text-[12px] leading-snug text-muted-foreground" data-where-line>
          {line ?? whereLabel(s, seen)}
        </small>
        {step && (
          <small className="block text-[12px] leading-snug font-semibold" data-where-step>
            {step}
          </small>
        )}
      </div>
      {!fixed && s.aired !== 0 && <Stepper value={seen} max={whereCap(s.aired)} label={s.label} onChange={onChange} />}
    </div>
  );
}

/**
 * Asking where someone is before a show goes on their list, or moving it: the row, I'm up to date, Live, a line on what it
 * does, and the one button. `plays`: they play it, so there's nothing to set here. `keepUp`: how it keeps up now (a show set to
 * move along by itself says so instead of offering Live).
 */
export function WhereAsk({
  s,
  start,
  plays,
  keepUp = "off",
  cta,
  busy,
  onSave,
}: {
  s: WhereSeason;
  start: number;
  plays?: boolean;
  keepUp?: KeepUp;
  cta: string;
  busy?: boolean;
  onSave: (seen: number, live: boolean) => void;
}) {
  const cap = whereCap(s.aired);
  const [seen, setSeen] = useState(Math.min(start, cap));
  const [live, setLive] = useState(keepUp === "ask");
  const read = useAiredEpisodes(!plays && !s.episodes && isUuid(s.seasonId) && s.aired !== 0 ? s.seasonId : null);
  const episodes = s.episodes ?? read.data?.episodes;
  // Live is for a season still on: a finished one has nothing new to ask about.
  const canLive = s.status !== "completed";
  if (plays) {
    return (
      <div data-where-plays>
        <WhereRow s={s} seen={start} onChange={() => {}} fixed />
        <p className="mt-3 text-[14px] leading-normal text-muted-foreground">
          You play {s.show}, so where you are moves as you reveal each episode on Tonight. Nothing past it shows, here or in your games.
        </p>
      </div>
    );
  }
  return (
    <div data-where-ask>
      <WhereRow s={s} seen={seen} onChange={setSeen} episodes={episodes} />
      {s.aired !== 0 && s.aired != null && seen < cap && (
        <Btn
          wide
          className="mt-2"
          data-where-up-to-date
          onClick={() => {
            setSeen(cap);
            if (canLive && keepUp !== "auto") setLive(true);
          }}
        >
          I&rsquo;m up to date
        </Btn>
      )}
      {canLive &&
        (keepUp === "auto" ? (
          <p data-where-auto className="mt-3 text-[13px] leading-normal text-muted-foreground">
            Moves along by itself as each episode airs. Change it in Settings, under Keeping you spoiler-free.
          </p>
        ) : (
          <div className="mt-2">
            <SwitchRow
              data="where-live"
              on={live}
              title="Keep me live"
              line={
                live
                  ? "When each new episode ends, Tonight asks if you've seen it. Nothing opens until you say"
                  : "Off: you move where you are yourself"
              }
              onChange={setLive}
            />
          </div>
        ))}
      <p className="mt-2 text-[13px] leading-normal text-muted-foreground">Nothing past where you are shows: results, stats, the couch&rsquo;s chat. Change it any time.</p>
      <Btn tone="must" wide className="mt-4" data-where-save disabled={busy} onClick={() => onSave(seen, canLive && keepUp !== "auto" && live)}>
        {busy ? "Saving…" : cta}
      </Btn>
    </div>
  );
}
