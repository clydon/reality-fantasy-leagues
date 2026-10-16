"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import type { Castaway, LeagueState, WaiverPeriod } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { api, ApiError } from "@/lib/api";
import { useLeagueStore } from "@/lib/store";
import { useShowTerms } from "@/lib/use-show-terms";
import { castawayPhotoSrc } from "@/lib/game/selectors";
import { CaptionPlate } from "@/components/ui/caption-plate";
import { BarButton, CastTile, ConfirmBar, PhotoSquare, PlainButton, SectionHead, TileGrid, useTribeFilter } from "@/components/draft/draft-ui";
import { cn } from "cn";
import { Note, WeekStrip } from "./waivers-ui";
import { HowWaiversWork } from "./rules-sheet";
import {
  addSlots,
  andList,
  exitEpisode,
  isShared,
  pickupSlots,
  freeAgencyUntil,
  lossesOf,
  ordinal,
  thenList,
  useCastNames,
  useMyClaim,
  useNow,
  useWaiversBase,
  viewerWeek,
  waiverOrder,
  when,
} from "./waivers-model";

// The claim pickers (the canvas's boards 2, 3 and 5b). Same select-then-confirm shape as the draft:
// tap tiles, then confirm in the bar above the tab bar. A waiver claim is a ranked list -- tap in the
// order you want them, tap again to take one off -- and nothing happens until waivers process. Free
// agency is the one place a tap-and-confirm takes effect at once.
//
// `forId`: the commissioner claiming for someone ("Claim for Dee"). Their claim is never read, so the
// picker starts empty and saving replaces what they had for that part.

function useSubject(forId: string | null) {
  const state = useLeagueStore((s) => s.state);
  const me = useLeagueStore((s) => s.membership?.playerId ?? null);
  const role = useLeagueStore((s) => s.membership?.role);
  const other = forId && forId !== me && role === "commissioner" ? StateLogic.getPlayer(state, forId) ?? null : null;
  return { state, me, subject: other ? other.id : me, other };
}

/** A castaway's line on a free agent tile: points in Active Roster, else their tribe (the tile's default). */
function faDetail(state: LeagueState, c: Castaway): ReactNode | undefined {
  if (!StateLogic.getLeagueType(state).hasActiveRoster) return undefined;
  const tribe = c.tribeId ? state.tribes.find((t) => t.id === c.tribeId) : null;
  return (
    <>
      {tribe && <span className="size-2 shrink-0 rounded-[1px]" style={{ background: tribe.color }} aria-hidden />}
      <span className="truncate">{StateLogic.WaiverLogic.castawayPoints(state, c.id)} pts</span>
    </>
  );
}

function Closed({ children }: { children: ReactNode }) {
  const base = useWaiversBase();
  return (
    <div className="flex flex-col gap-4">
      <p className="text-base text-muted-foreground">{children}</p>
      <PlainButton href={base} className="nav:self-start">
        Back to Waivers
      </PlainButton>
    </div>
  );
}

function ForPlate({ name }: { name: string }) {
  return <CaptionPlate size="sm" tone="quiet" tag="Commish" title={`Claiming for ${name}`} subtitle="Their claim stays private: you won't see it after saving." />;
}

// ---- Pickup claims (board 2) ----

export function PickupPicker({ forId }: { forId: string | null }) {
  const router = useRouter();
  const base = useWaiversBase();
  const terms = useShowTerms();
  const now = useNow();
  const { state, me, subject, other } = useSubject(forId);
  const name = useCastNames(state);
  const w = viewerWeek(state, me);
  const period = w.stage === "open" ? w.period : null;
  const mine = useMyClaim(other ? null : period);
  const [picked, setPicked] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fa = period && subject ? StateLogic.availableFor(state, subject) : [];
  const { shown, chips } = useTribeFilter(fa, state);

  if (w.stage === "hidden") return <Closed>Reveal Episode {w.period!.episode} first: whether you&rsquo;re owed a pickup would give it away.</Closed>;
  if (!period || !subject) return <Closed>Claims aren&rsquo;t open right now.</Closed>;
  const owed = StateLogic.WaiverLogic.pickupsOwed(state, subject);
  if (!owed.count) return <Closed>{other ? `${other.name} doesn't` : "You don't"} have a pickup to claim this week.</Closed>;

  const activeRoster = !!StateLogic.getLeagueType(state).hasActiveRoster;
  const shared = isShared(state);
  const losses = lossesOf(state, owed.lossIds);
  const max = pickupSlots(state, owed.count);
  const saved = other ? [] : mine.claim.pickupIds;
  const freeIds = new Set(fa.map((c) => c.id));
  const sel = (picked ?? saved).filter((id) => freeIds.has(id));
  const changed = sel.join() !== saved.filter((id) => freeIds.has(id)).join();
  const order = waiverOrder(state);
  const pos = order.indexOf(subject) + 1;
  const replace = andList(losses.map((c) => name(c.id)));
  const inGame = StateLogic.MidSeasonLogic.inGameCount(state, subject);
  const out = losses[0] ? exitEpisode(state, losses[0].id) : null;
  const toggle = (id: string) => {
    setError(null);
    // Full with one to choose: the tap swaps the choice rather than doing nothing.
    setPicked(sel.includes(id) ? sel.filter((x) => x !== id) : sel.length < max ? [...sel, id] : max === 1 ? [id] : sel);
  };

  async function save() {
    setBusy(true);
    const err = await mine.save({ pickupIds: sel }, other?.id);
    setBusy(false);
    if (err) setError(err);
    else router.push(base);
  }

  return (
    <div className="flex flex-col gap-[30px]">
      <div className="flex flex-col gap-3">
        {other && <ForPlate name={other.name} />}
        {activeRoster ? (
          <CaptionPlate tag="Pickup" title={`Down to ${inGame} still in`} subtitle={`Pick up ${owed.count} to fill all ${state.settings.activeSlots} starting spots`} />
        ) : (
          <CaptionPlate
            tone="live"
            tag="Out"
            image={losses[0] ? castawayPhotoSrc(losses[0].photoUrl) ?? undefined : undefined}
            title={`Replace ${replace}`}
            subtitle={out ? `Left in Episode ${out}` : undefined}
          />
        )}
        {shared ? (
          <p className="text-[15px] leading-normal">
            Choose {owed.count === 1 ? "who" : `the ${owed.count}`} {other ? "they" : "you"} want. In this league nobody&rsquo;s taken off the board, so
            nobody can beat {other ? "them" : "you"} to {owed.count === 1 ? "them" : "any of them"}: {other ? "they" : "you"} get them when waivers process
            {period.hold ? "" : <> at <b>{when(period.processAt, now)}</b></>}.
          </p>
        ) : (
        <p className="text-[15px] leading-normal">
          Claim up to {max === 3 ? "three" : max}, in order. When waivers process{period.hold ? "" : <> at <b>{when(period.processAt, now)}</b></>}{" "}
          {owed.count > 1 ? `${other ? "they get" : "you get"} the first ${owed.count} still free, one a round.` : `${other ? "they get" : "you get"} the first one still free.`}{" "}
          {shared ? (
            "In this league nobody's taken off the board, so nobody can beat you to them."
          ) : (
            <>
              {other ? `${other.name} is` : "You're"} <b>{ordinal(pos)}</b> in the waiver order{period.addDrop ? ", and pickups go before anyone's add/drop" : ""}.
            </>
          )}
        </p>
        )}
      </div>

      <section className="flex flex-col gap-2.5">
        <SectionHead aside={<span className="pb-1.5 text-[13px] text-muted-foreground">Tap a tile again to take it off</span>}>
          {shared ? (other ? "Their pickup" : "Your pickup") : other ? "Their claims" : "Your claims"}
        </SectionHead>
        <ol className={cn("grid gap-2", max <= 3 ? "grid-cols-3" : "grid-cols-4")}>
          {Array.from({ length: max }, (_, i) => {
            const c = sel[i] ? StateLogic.getCastaway(state, sel[i]) : undefined;
            return (
              <li key={i}>
                {c ? (
                  <button
                    type="button"
                    onClick={() => toggle(c.id)}
                    aria-label={`${ordinal(i + 1)} choice: ${c.name}. Tap to take off`}
                    className="flex min-h-[76px] w-full items-center gap-1.5 rounded-[3px] border border-input bg-card p-1.5 text-left focus-visible:outline-3 focus-visible:outline-chyron-line"
                  >
                    <PhotoSquare castaway={c} size={32} />
                    <span className="flex min-w-0 flex-col gap-[3px]">
                      <span className="text-[11px] font-bold uppercase leading-[1.2] tracking-[0.03em] text-muted-foreground">{shared ? "Pickup" : ordinal(i + 1)}</span>
                      <span className="type-caption truncate text-[17px]">{name(c.id)}</span>
                    </span>
                  </button>
                ) : (
                  <span className="flex min-h-[76px] items-center justify-center rounded-[3px] border-[1.5px] border-dashed border-input text-[11px] font-bold uppercase tracking-[0.03em] text-muted-foreground">
                    {shared ? "Pickup" : ordinal(i + 1)}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        <Note className="text-[13px] leading-[1.4]">
          {shared
            ? `Your pickup takes the place of one of yours who's out.${activeRoster ? " No claim by then? Pick from free agency until the lock; still nobody, and you get the free agent with the most points." : ""}`
            : activeRoster
            ? `Your pickup takes the place of one of yours who's out. None of them still free? Pick from who's left in free agency. Still nobody at the lock: you get the free agent with the most points.`
            : `Your pickup takes ${replace}'s place: their points come off, and your pickup counts in full. ${max === 3 ? "All three" : "All of them"} gone? Pick from who's left in free agency. Still nobody when Episode ${period.episode + 1} airs: a free agent at random, so you're never a ${terms.castaway} short.`}
        </Note>
      </section>

      <section className="flex flex-col gap-2.5">
        <SectionHead aside={<span className="pb-1.5 text-[13px] text-muted-foreground">{fa.length} free</span>}>Free agents</SectionHead>
        {chips}
        {fa.length === 0 ? (
          <Note>Nobody&rsquo;s free right now.</Note>
        ) : (
          <TileGrid cols={3}>
            {shown.map((c) => {
              const i = sel.indexOf(c.id);
              return (
                <CastTile
                  key={c.id}
                  castaway={c}
                  label={name(c.id)}
                  state={state}
                  photoHeight={96}
                  rank={i >= 0 && !shared ? i + 1 : undefined}
                  mark={i >= 0 && shared ? "add" : undefined}
                  dim={i < 0 && sel.length >= max && max > 1}
                  detail={faDetail(state, c)}
                  onClick={() => toggle(c.id)}
                />
              );
            })}
          </TileGrid>
        )}
      </section>

      {error && <p className="font-semibold text-live">{error}</p>}
      <ConfirmBar
        note={sel.length ? (shared ? `Replacing ${replace} with` : thenList(sel.map(name))) : shared ? "Tap who you want" : "Tap free agents in the order you want them"}
        title={sel.length ? (shared ? andList(sel.map(name)) : `${sel.length} of ${max} claimed`) : shared ? `Choose ${max === 1 ? "one" : max}` : `Claim up to ${max}`}
      >
        <BarButton onClick={save} disabled={busy || mine.loading || !changed}>
          {busy ? "Saving…" : sel.length === 0 && saved.length ? "Withdraw" : shared ? "Save pickup" : "Save claims"}
        </BarButton>
      </ConfirmBar>
    </div>
  );
}

// ---- Add/drop claim (board 3) ----

export function AddDropPicker({ forId }: { forId: string | null }) {
  const router = useRouter();
  const base = useWaiversBase();
  const terms = useShowTerms();
  const { state, me, subject, other } = useSubject(forId);
  const name = useCastNames(state);
  const w = viewerWeek(state, me);
  const period = w.stage === "open" ? w.period : null;
  const mine = useMyClaim(other ? null : period);
  const [drop, setDrop] = useState<string | null | undefined>(undefined);
  const [adds, setAdds] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fa = period && subject ? StateLogic.availableFor(state, subject) : [];
  const { shown, chips } = useTribeFilter(fa, state);

  if (w.stage === "hidden") return <Closed>Reveal Episode {w.period!.episode} first.</Closed>;
  if (!period || !subject) return <Closed>Claims aren&rsquo;t open right now.</Closed>;
  if (!period.addDrop || !StateLogic.tradeAvailable(state)) return <Closed>There are no add/drops this week.</Closed>;

  const fa1 = StateLogic.WaiverLogic.freeAgencyOn(state);
  const shared = isShared(state);
  const maxAdds = addSlots(state);
  const rolling = !shared && (state.settings.replenishOrderBy || "rolling") === "rolling";
  const team = state.castaways.filter((c) => c.status === "active" && c.ownerIds.includes(subject));
  const freeIds = new Set(fa.map((c) => c.id));
  const saved = other ? { dropId: null, addIds: [] as string[], pickupIds: [] as string[] } : mine.claim;
  const d = drop === undefined ? (saved.dropId && team.some((c) => c.id === saved.dropId) ? saved.dropId : null) : drop;
  const sel = (adds ?? saved.addIds).filter((id) => freeIds.has(id));
  const changed = d !== saved.dropId || sel.join() !== saved.addIds.join();
  const hasSaved = !!saved.dropId;
  const overlap = saved.pickupIds.find((id) => sel.includes(id));
  const toggle = (id: string) => {
    setError(null);
    setAdds(sel.includes(id) ? sel.filter((x) => x !== id) : sel.length < maxAdds ? [...sel, id] : maxAdds === 1 ? [id] : sel);
  };

  async function save(part: { dropId: string | null; addIds: string[] }) {
    setBusy(true);
    const err = await mine.save(part, other?.id);
    setBusy(false);
    if (err) setError(err);
    else router.push(base);
  }

  return (
    <div className="flex flex-col gap-[30px]">
      <div className="flex flex-col gap-3">
        {other && <ForPlate name={other.name} />}
        <p className="text-[15px] leading-normal">
          One add/drop this week, by waiver claim{fa1 ? " or in free agency" : ""}: drop someone still in and add a free agent.
          {rolling && !other ? " Skip waivers and you move up the waiver order." : ""}
        </p>
      </div>

      <section className="flex flex-col gap-2.5">
        <SectionHead aside={<span className="pb-1.5 text-[13px] text-muted-foreground">{d ? `${name(d)} selected` : "Choose one"}</span>}>Drop</SectionHead>
        {team.length === 0 ? (
          <Note>No {terms.castaways} still in to drop.</Note>
        ) : (
          <ul className="grid grid-cols-4 gap-2.5">
            {team.map((c) => {
              const on = d === c.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    aria-label={`Drop ${c.name}`}
                    onClick={() => setDrop(on ? null : c.id)}
                    className="flex min-h-11 w-full min-w-0 flex-col items-center gap-1.5 rounded-[3px] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line"
                  >
                    <span className={cn("rounded-[3px]", on && "outline-3 outline-offset-2 outline-live")}>
                      <PhotoSquare
                        castaway={c}
                        size={72}
                        badge={
                          on && (
                            <span className="absolute -right-2 -top-2 flex size-[26px] items-center justify-center rounded-full bg-live text-white shadow-[0_0_0_2px_var(--background)]" aria-hidden>
                              <X className="size-4" strokeWidth={3} />
                            </span>
                          )
                        }
                      />
                    </span>
                    <span className="type-caption w-full truncate text-center text-[15px]">{name(c.id)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2.5">
        <SectionHead aside={<span className="pb-1.5 text-[13px] text-muted-foreground">{shared ? "Choose one" : "Claim up to 3, in order"}</span>}>Add</SectionHead>
        {chips}
        {fa.length === 0 ? (
          <Note>Nobody&rsquo;s free right now.</Note>
        ) : (
          <TileGrid cols={3}>
            {shown.map((c) => {
              const i = sel.indexOf(c.id);
              return (
                <CastTile
                  key={c.id}
                  castaway={c}
                  label={name(c.id)}
                  state={state}
                  photoHeight={84}
                  rank={i >= 0 && !shared ? i + 1 : undefined}
                  mark={i >= 0 && shared ? "add" : undefined}
                  dim={i < 0 && sel.length >= maxAdds && maxAdds > 1}
                  detail={faDetail(state, c)}
                  onClick={() => toggle(c.id)}
                />
              );
            })}
          </TileGrid>
        )}
        <Note className="border-t border-border pt-3 text-[13px] leading-[1.4]">
          {overlap && !other && `Your pickup processes first. If it lands ${name(overlap)}, this claim moves on to your next choice. `}
          {shared ? (
            "Nobody's taken off the board in this league, so you'll get who you choose when waivers process."
          ) : (
            <>
              None of them still free? You keep {d ? name(d) : `who you'd drop`}
              {fa1 ? ", and can still add/drop in free agency" : ""}.{fa1 ? " Whoever you drop is up for grabs in free agency." : ""}
            </>
          )}
        </Note>
      </section>

      {(hasSaved || !other) && (
        <PlainButton
          className="self-start"
          disabled={busy}
          onClick={() => (hasSaved ? save({ dropId: null, addIds: [] }) : router.push(base))}
        >
          No add/drop this week
        </PlainButton>
      )}

      {error && <p className="font-semibold text-live">{error}</p>}
      <ConfirmBar note={d ? `Drop ${name(d)}, add` : "Choose who to drop"} title={sel.length ? thenList(sel.map(name)) : "Choose who to add"}>
        <BarButton onClick={() => save({ dropId: d, addIds: sel })} disabled={busy || mine.loading || !d || !sel.length || !changed}>
          {busy ? "Saving…" : "Save claim"}
        </BarButton>
      </ConfirmBar>
    </div>
  );
}

// ---- Free agency (board 5b) ----

export function FreeAgencyPicker({ forId }: { forId: string | null }) {
  const router = useRouter();
  const base = useWaiversBase();
  const now = useNow();
  const leagueId = useLeagueStore((s) => s.leagueId);
  const leagueMode = useLeagueStore((s) => s.mode);
  const setState = useLeagueStore((s) => s.setState);
  const { state, me, subject, other } = useSubject(forId);
  const name = useCastNames(state);
  const w = viewerWeek(state, me);
  const period: WaiverPeriod | null = w.stage === "processed" ? w.period : null;
  const [drop, setDrop] = useState<string | null>(null);
  const [add, setAdd] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fa = period && subject ? StateLogic.availableFor(state, subject) : [];
  const { shown, chips } = useTribeFilter(fa, state);

  if (w.stage === "hidden") return <Closed>Reveal Episode {w.period!.episode} first.</Closed>;
  if (!period || !subject) return <Closed>Free agency opens once waivers process.</Closed>;
  if (!StateLogic.WaiverLogic.freeAgencyOn(state)) return <Closed>This league has no free agency: waivers only.</Closed>;

  const owed = StateLogic.WaiverLogic.pickupsOwed(state, subject);
  const used = StateLogic.WaiverLogic.addDropUsed(state, period, subject);
  const mode: "pickup" | "addDrop" | "none" = owed.count > 0 ? "pickup" : period.addDrop && StateLogic.tradeAvailable(state) && !used ? "addDrop" : "none";
  const losses = lossesOf(state, owed.lossIds);
  const team = state.castaways.filter((c) => c.status === "active" && c.ownerIds.includes(subject));
  const a = add && fa.some((c) => c.id === add) ? add : null;
  const dd = drop && team.some((c) => c.id === drop) ? drop : null;
  const run = period.run;
  const justDropped = (run?.results ?? [])
    .filter((r) => r.kind === "addDrop" && r.outcome === "got" && r.droppedCastawayId && fa.some((c) => c.id === r.droppedCastawayId))
    .map((r) => r.droppedCastawayId!);
  const skipped = run?.results.find((r) => r.playerId === subject && r.kind === "addDrop");
  const who = other ? other.name : "you";

  async function go() {
    if (!a || !subject) return;
    // No server (the guided tour): the same move, on the league as it really is.
    if (leagueMode === "mock") {
      const full = useLeagueStore.getState().fullState;
      const err = StateLogic.WaiverLogic.freeAgencyMove(full, subject, a, mode === "addDrop" ? dd : null, Date.now());
      if (err) return setError(err);
      setState(full);
      return router.push(base);
    }
    if (!leagueId) return;
    setBusy(true);
    setError(null);
    try {
      setState(await api.freeAgencyMove(leagueId, a, mode === "addDrop" ? dd : null, other?.id));
      router.push(base);
    } catch (e) {
      setBusy(false);
      if (e instanceof ApiError && e.status === 409) {
        setAdd(null);
        setError(`${name(a)} just went to someone else. Nothing changed: choose again.`);
        // Fresh copy, so the one who's gone drops out of the grid.
        api.leagueState(leagueId).then((res) => setState(res.state)).catch(() => {});
      } else setError(e instanceof Error ? e.message : "That didn't work.");
    }
  }

  return (
    <div className="flex flex-col gap-[30px]">
      <div className="flex flex-col gap-4">
        {other && <ForPlate name={other.name} />}
        <CaptionPlate
          tone="quiet"
          tag="FA"
          title="Free agency is open"
          subtitle={`${isShared(state) ? "Moves happen as you tap" : "First come, first served"} · ${freeAgencyUntil(state, period, now, true)}`}
        />
        <WeekStrip state={state} period={period} now={now} lock={!!StateLogic.getLeagueType(state).hasActiveRoster} />
      </div>
      <p className="text-[15px] leading-normal">
        {mode === "pickup"
          ? `${other ? `${other.name}'s` : "Your"} claims didn't land a pickup, so choose who replaces ${andList(losses.map((c) => name(c.id)))} from who's left. It happens the moment you tap Add now.`
          : mode === "addDrop"
            ? `${skipped?.outcome === "skipped" || skipped?.outcome === "noClaim" ? `${other ? `${other.name} skipped` : "You skipped"} waivers, so this week's add/drop is still ${other ? "theirs" : "yours"}.` : `This week's add/drop is still ${other ? "theirs" : "yours"}.`}${isShared(state) ? " It happens the moment you tap." : " Free agency moves happen the moment you tap, and don't change the waiver order."}`
            : `Nothing left for ${who} to do this week${used ? `: ${other ? "their" : "your"} add/drop is made` : ""}. Anyone still free is first come, first served until it closes.`}
      </p>

      {mode === "addDrop" && (
        <section className="flex flex-col gap-2.5">
          <SectionHead aside={<span className="pb-1.5 text-[13px] text-muted-foreground">{dd ? `${name(dd)} selected` : "Choose one"}</span>}>Drop</SectionHead>
          <ul className="grid grid-cols-4 gap-2.5">
            {team.map((c) => {
              const on = dd === c.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    aria-label={`Drop ${c.name}`}
                    onClick={() => setDrop(on ? null : c.id)}
                    className="flex min-h-11 w-full min-w-0 flex-col items-center gap-1.5 rounded-[3px] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line"
                  >
                    <span className={cn("rounded-[3px]", on && "outline-3 outline-offset-2 outline-live")}>
                      <PhotoSquare
                        castaway={c}
                        size={72}
                        badge={
                          on && (
                            <span className="absolute -right-2 -top-2 flex size-[26px] items-center justify-center rounded-full bg-live text-white shadow-[0_0_0_2px_var(--background)]" aria-hidden>
                              <X className="size-4" strokeWidth={3} />
                            </span>
                          )
                        }
                      />
                    </span>
                    <span className="type-caption w-full truncate text-center text-[15px]">{name(c.id)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2.5">
        <SectionHead aside={<HowWaiversWork label="How it works" />}>Free agents</SectionHead>
        {chips}
        {fa.length === 0 ? (
          <Note>Nobody&rsquo;s free right now.</Note>
        ) : (
          <TileGrid cols={3}>
            {shown.map((c) => (
              <CastTile
                key={c.id}
                castaway={c}
                label={name(c.id)}
                state={state}
                photoHeight={84}
                mark={a === c.id ? "add" : undefined}
                detail={faDetail(state, c)}
                onClick={mode === "none" ? undefined : () => setAdd(a === c.id ? null : c.id)}
              />
            ))}
          </TileGrid>
        )}
        {justDropped.length > 0 && !isShared(state) && (
          <Note className="border-t border-border pt-3 text-[13px] leading-[1.4]">
            Just dropped in waivers: {andList(justDropped.map(name))}. If someone adds your pick before you, nothing changes and you can choose again.
          </Note>
        )}
      </section>

      {error && <p className="font-semibold text-live">{error}</p>}
      {mode !== "none" && (
        <ConfirmBar
          note={mode === "pickup" ? `Replace ${name(losses[0]?.id)} with` : dd ? `Drop ${name(dd)}, add` : "Choose who to drop"}
          title={a ? name(a) : `Choose a free agent`}
        >
          <BarButton onClick={go} disabled={busy || !a || (mode === "addDrop" && !dd)}>
            {busy ? "Adding…" : "Add now"}
          </BarButton>
        </ConfirmBar>
      )}
    </div>
  );
}
