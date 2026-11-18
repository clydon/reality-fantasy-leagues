"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Face } from "../show/parts";
import { seasonChoiceLine, type SeasonChoice } from "@/lib/game/listing";
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
// `pick` (Add a show): which season, when the show's listing has more than one (the user, 2026-11-05: Below Deck came up as
// its 13th, with no way to an earlier one): a picker under the row, each season with its name or when it aired; the row,
// the stepper and the rest are the season picked, read from its listing while the picker says so.

export type SeasonPick = { seasons: SeasonChoice[]; number: number; onPick: (n: number) => void; reading?: boolean };

export type WhereSeason = Pick<CatalogSeason, "seasonId" | "label" | "show" | "artUrl" | "artPosition" | "aired" | "status" | "premiere"> & {
  /** Its show's TV listing, when it has one (Add a show adds from it if the season's gone since the list was read). */
  tvmazeId?: number | null;
  /** Its number, for the season picker (Add a show's) to start from. */
  seasonNumber?: number | null;
  /** Its aired episodes, when the caller has them (a TV listing's); else read for a season that's here. */
  episodes?: StepEpisode[];
  /** What the show calls an episode ("Game": lib/game/show-words.ts); Episode when not known. */
  episodeWord?: string;
  /** Its short word ("Ep"), for the ledger's lines. */
  epWord?: string;
  /** How many episodes it has, when known, and the next to air: the ledger's Still to air. */
  total?: number | null;
  next?: { number: number; airAt: string | null } | null;
  /** A season you play: results in past your mark (the next to reveal), for the ledger's one action. */
  reveal?: number | null;
  /** Who left in each episode you've seen (the show's own read, through your mark): the ledger's faces. */
  outs?: Record<number, { name: string; photo: string | null }[]>;
};

const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

/** "Game 2: Rays at Brewers · Sat, Oct 24", "Episode 5 · Tue, Oct 20": which episode a step is. */
function stepLine(ep: StepEpisode | undefined, word = "Episode"): string | null {
  if (!ep) return null;
  const day = ep.airAt ? new Date(ep.airAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : null;
  return [ep.title ?? `${word} ${ep.number}`, day].filter(Boolean).join(" · ");
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
  const step = seen > 0 ? stepLine(episodes?.find((e) => e.number === seen), s.episodeWord) : null;
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

const dayOf = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : null);

/**
 * Where you are as the season's episodes (data round 3's episode ledger A, the user's pick, 2026-11-15; the design round's step 4):
 * every episode out, oldest first, then what's still to air; your boundary a line under the last one you've seen ("You're here").
 * A row's tap moves the boundary to it (a draft until Save); the line's tap above the first row means not started. Titles only up
 * to `named` (your saved mark: a title can give an episode away, and a draft past it hasn't been seen yet). `fixed`: a season you
 * play, where your mark moves with your reveals; then the rows past it read "Results in" when they're waiting for you.
 */
export function EpisodeLedger({
  s,
  seen,
  named,
  episodes,
  fixed,
  onChange,
  from = 1,
}: {
  s: WhereSeason;
  seen: number;
  named: number;
  episodes?: StepEpisode[];
  fixed?: boolean;
  onChange?: (n: number) => void;
  /** The first row: the behind question's picker (show/step-through.tsx) lists only what's out past your mark. */
  from?: number;
}) {
  const ep = s.epWord ?? "Ep";
  const aired = s.aired ?? 0;
  const rows = Array.from({ length: Math.max(0, aired - from + 1) }, (_, i) => from + i);
  const toAir = s.total && s.total > aired ? s.total - aired : 0;
  const here = (
    <div data-ledger-here={seen} className="flex items-center gap-2 py-1.5" aria-hidden>
      <i className="h-[2px] flex-1 bg-chyron-line" />
      <span className="type-caption text-[13px] tracking-[0.04em] text-chyron-line">{seen > 0 ? `You're here · through ${ep} ${seen}` : "You're here · not started"}</span>
      <i className="h-[2px] w-4 bg-chyron-line" />
    </div>
  );
  return (
    <div data-ledger className="max-h-[46dvh] overflow-y-auto overscroll-contain pr-0.5">
      {seen === from - 1 && here}
      {rows.map((n) => {
        const e = episodes?.find((x) => x.number === n);
        const isSeen = n <= seen;
        const title = n <= named ? (e?.title ?? null) : null;
        // Who left, on one you'd seen before this sheet opened (as the Episodes row says it: the same fact, the same words).
        const out = n <= named ? (s.outs?.[n] ?? []) : [];
        const waiting = fixed && !isSeen && s.reveal != null && n >= s.reveal;
        const Row = fixed ? "div" : "button";
        return (
          <div key={n} className="contents">
            <Row
              {...(fixed ? {} : { type: "button" as const, onClick: () => onChange?.(n === seen ? n - 1 : n), "aria-pressed": isSeen })}
              data-ledger-row={n}
              data-ledger-seen={isSeen || undefined}
              className={`flex min-h-12 w-full items-center gap-3 border-t border-border py-1.5 text-left ${fixed ? "" : "nd-press"}`}
            >
              <span className={`type-num w-7 flex-none text-[22px] ${isSeen ? "" : "text-muted-foreground"}`}>{n}</span>
              {out.length > 0 && (
                <span className="flex flex-none">
                  {out.slice(0, 2).map((c, i) => (
                    <Face key={c.name} src={c.photo} name={c.name} out className={`size-8 rounded-[3px] shadow-[0_0_0_2px_var(--panel)] ${i ? "-ml-2.5" : ""}`} />
                  ))}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <b className={`block truncate text-[15px] font-semibold ${isSeen ? "" : "text-muted-foreground"}`}>
                  {title ?? (out.length ? `${out.map((c) => c.name.split(" ")[0]).join(" and ")} out` : (dayOf(e?.airAt) ?? `${s.episodeWord ?? "Episode"} ${n}`))}
                </b>
                <small className="block text-[12.5px] text-muted-foreground">
                  {[title || out.length ? dayOf(e?.airAt) : null, waiting ? "Results in · hidden" : isSeen ? "Seen" : "Out, not seen"].filter(Boolean).join(" · ")}
                </small>
              </span>
              {!fixed && (
                <span aria-hidden className={`grid size-6 flex-none place-items-center rounded-full ${isSeen ? "bg-foreground text-background" : "outline-[1.5px] -outline-offset-[1.5px] outline-input"}`}>
                  {isSeen && <Check className="size-3.5" strokeWidth={3} />}
                </span>
              )}
            </Row>
            {n === seen && here}
          </div>
        );
      })}
      {s.next && s.next.number > aired && (
        <div data-ledger-next={s.next.number} className="flex min-h-12 items-center gap-3 border-t border-border py-1.5 opacity-(--nd-dim)">
          <span className="type-num w-7 flex-none text-[22px] text-muted-foreground">{s.next.number}</span>
          <span className="min-w-0 flex-1">
            <b className="block text-[15px] font-semibold text-foreground/85">Next</b>
            <small className="block text-[12.5px] text-foreground/85">{dayOf(s.next.airAt) ?? "Date to come"}</small>
          </span>
        </div>
      )}
      {toAir > (s.next && s.next.number > aired ? 1 : 0) && (
        <p className="border-t border-border py-2.5 text-[13px] text-muted-foreground">
          + {toAir - (s.next && s.next.number > aired ? 1 : 0)} still to air
        </p>
      )}
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
  lookUp,
  pick,
  onList,
  onSave,
  ledger,
  onReveal,
}: {
  s: WhereSeason;
  start: number;
  plays?: boolean;
  keepUp?: KeepUp;
  cta: string;
  busy?: boolean;
  /** Add a show's: ask whether to look up the episodes that are out (Getting it ready, docs/PLAN-getting-it-ready.md). */
  lookUp?: boolean;
  /** Add a show's: which of the listing's seasons, when it has more than one. */
  pick?: SeasonPick;
  /** Add a show's: this season's on your list already (the user, 2026-11-05: the row still opens, so another season can be
   *  picked here); nothing to set, and no save until a different one is. */
  onList?: boolean;
  /** `episodes`: look up the ones that are out (on unless switched off). */
  onSave: (seen: number, live: boolean, episodes: boolean) => void;
  /** Where you are on a show's page (step 4): the season as the episode ledger, not the stepper; on a season you play, the ledger
   *  fixed with its one action (`onReveal`). */
  ledger?: boolean;
  onReveal?: (n: number) => void;
}) {
  const cap = whereCap(s.aired);
  const [seen, setSeen] = useState(Math.min(start, cap));
  const [live, setLive] = useState(keepUp === "ask");
  const [lookAll, setLookAll] = useState(true);
  const read = useAiredEpisodes((!plays || ledger) && !s.episodes && isUuid(s.seasonId) && s.aired !== 0 ? s.seasonId : null);
  const episodes = s.episodes ?? read.data?.episodes;
  // Live is for a season still on: a finished one has nothing new to ask about.
  const canLive = s.status !== "completed";
  if (plays && ledger) {
    const ep = s.epWord ?? "Ep";
    return (
      <div data-where-plays data-where-ledger>
        <EpisodeLedger s={s} seen={start} named={start} episodes={episodes} fixed />
        <p className="mt-3 text-[14px] leading-normal text-muted-foreground">
          You play {s.show}, so where you are moves as you reveal each {(s.episodeWord ?? "Episode").toLowerCase()}. Nothing past it shows, here or in your games.
        </p>
        {s.reveal != null && onReveal && (
          <Btn tone="ink" wide className="mt-4" data-where-reveal={s.reveal} onClick={() => onReveal(s.reveal!)}>
            Reveal {ep} {s.reveal} · every game
          </Btn>
        )}
      </div>
    );
  }
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
  const reading = !!pick?.reading;
  if (onList) {
    return (
      <div data-where-ask data-where-on-list>
        <div className={reading ? "pointer-events-none opacity-40 transition-opacity" : "transition-opacity"}>
          <WhereRow s={s} seen={start} onChange={() => {}} fixed line="On your list" />
        </div>
        {pick && pick.seasons.length > 1 && <SeasonPicker pick={pick} />}
        <p className="mt-3 text-[14px] leading-normal text-muted-foreground">
          {s.label} is already on your list{pick && pick.seasons.length > 1 ? ": pick another season to add that one" : ""}. Where you are in it is on its show page.
        </p>
        <Btn tone="must" wide className="mt-4" data-where-save disabled>
          Already on your list
        </Btn>
      </div>
    );
  }
  return (
    <div data-where-ask aria-busy={reading || undefined}>
      <div className={reading ? "pointer-events-none opacity-40 transition-opacity" : "transition-opacity"}>
        {ledger && s.aired ? <EpisodeLedger s={s} seen={seen} named={start} episodes={episodes} onChange={setSeen} /> : <WhereRow s={s} seen={seen} onChange={setSeen} episodes={episodes} />}
      </div>
      {pick && pick.seasons.length > 1 && <SeasonPicker pick={pick} />}
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
            Moves along by itself as each {(s.episodeWord ?? "Episode").toLowerCase()} airs. Change it in Settings, under Keeping you spoiler-free.
          </p>
        ) : (
          <div className="mt-2">
            <SwitchRow
              data="where-live"
              on={live}
              title="Keep me live"
              line={
                live
                  ? `When each new ${(s.episodeWord ?? "Episode").toLowerCase()} ends, Tonight asks if you've seen it. Nothing opens until you say`
                  : "Off: you move where you are yourself"
              }
              onChange={setLive}
            />
          </div>
        ))}
      {/* The user (2026-11-01): with several out, you should be asked to get them all, not one at a time as you watch. */}
      {lookUp && !!s.aired && (
        <div className="mt-2">
          <SwitchRow
            data="where-look-up"
            on={lookAll}
            title={s.aired === 1 ? `Look up the ${(s.episodeWord ?? "Episode").toLowerCase()} that's out` : `Look up all ${s.aired} that are out`}
            line={lookAll ? "What happened in each, there once you've seen it. It takes a few minutes; you can carry on" : "Off: look them up later from its Episodes"}
            onChange={setLookAll}
          />
        </div>
      )}
      <p className="mt-2 text-[13px] leading-normal text-muted-foreground">Nothing past where you are shows: results, stats, the couch&rsquo;s chat. Change it any time.</p>
      {/* On a show's page, Save holds the yellow only once it would change something (step 4's check: no "due" colour on a no-op). */}
      <Btn tone={ledger && seen === start && live === (keepUp === "ask") ? "optional" : "must"} wide className="mt-4" data-where-save disabled={busy || reading} onClick={() => onSave(seen, canLive && keepUp !== "auto" && live, !!lookUp && lookAll)}>
        {busy ? "Saving…" : ledger ? `${cta} · ${seen > 0 ? `through ${s.epWord ?? "Ep"} ${seen}` : "not started"}` : cta}
      </Btn>
    </div>
  );
}

/** Which season: the phone's own picker (a select), each season as seasonChoiceLine says it, latest first. */
function SeasonPicker({ pick }: { pick: SeasonPick }) {
  return (
    <label
      data-where-season={pick.number}
      className="mt-2 flex min-h-12 items-center gap-2.5 rounded-[4px] bg-background px-3 outline-1 -outline-offset-1 outline-input focus-within:outline-2 focus-within:outline-chyron"
    >
      <span className="flex-none text-[14px] font-semibold">Season</span>
      <select
        data-where-season-pick
        aria-label="Which season"
        value={pick.number}
        onChange={(e) => pick.onPick(Number(e.target.value))}
        className="min-w-0 flex-1 cursor-pointer appearance-none truncate bg-transparent py-2.5 text-[15px] font-semibold outline-none"
      >
        {pick.seasons.map((c) => (
          <option key={c.number} value={c.number}>
            {seasonChoiceLine(c)}
          </option>
        ))}
      </select>
      <ChevronDown className="size-4 flex-none text-muted-foreground" aria-hidden />
    </label>
  );
}
