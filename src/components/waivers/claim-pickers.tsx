"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Castaway, LeagueState, WaiverPeriod } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { api, ApiError } from "@/lib/api";
import { useLeagueStore } from "@/lib/store";
import { CaptionPlate } from "@/components/ui/caption-plate";
import { BarButton, CastTile, ConfirmBar, PlainButton, SectionHead, TileGrid } from "@/components/draft/draft-ui";
import { RankedBy, WindowTabs, timesOf, useRanking } from "@/components/research/research-rows";
import { Note } from "./waivers-ui";
import { HowWaiversWork } from "./rules-sheet";
import { castawayPts } from "./claim-screen";
import { freeAgencyUntil, isShared, useCastNames, useMyClaim, useNow, useWaiversBase, viewerWeek } from "./waivers-model";

// The claim picker (docs/PLAN-waivers-v2.md "2A"; the canvas's "Replace opens the free agents"): one
// spot at a time -- replace Patt, or swap Lewis -- from the free agents, ranked with Research's own
// controls (the window, and "Ranked by" any scoring rule). Exclusive: tap your first choice, then any
// backups; you get one. Shared: pick one. Free agency (after claims process) is the one place a tap and
// confirm takes effect at once.
//
// `forId`: the commissioner claiming for someone ("Claim for Dee"). Their claim is never read, so the
// picker starts empty and saving sets just that spot (the server keeps the rest).

function useSubject(forId: string | null) {
  const state = useLeagueStore((s) => s.state);
  const me = useLeagueStore((s) => s.membership?.playerId ?? null);
  const role = useLeagueStore((s) => s.membership?.role);
  const other = forId && forId !== me && role === "commissioner" ? StateLogic.getPlayer(state, forId) ?? null : null;
  return { state, me, subject: other ? other.id : me, other };
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

/** Free agents ranked the way Research ranks them, each tile's line saying what the ranking counts. */
function useRankedFreeAgents(state: LeagueState, fa: Castaway[]) {
  const r = useRanking(state);
  const activeRoster = !!StateLogic.getLeagueType(state).hasActiveRoster;
  const score = (c: Castaway) => {
    const row = r.row(c.id);
    if (!row) return 0;
    return r.rule ? timesOf(row, r.rule) : activeRoster ? row.points : castawayPts(state, c);
  };
  const pts = (c: Castaway) => (activeRoster ? r.row(c.id)?.points ?? 0 : castawayPts(state, c));
  const ranked = [...fa].sort((a, b) => score(b) - score(a) || pts(b) - pts(a) || a.name.localeCompare(b.name));
  const detail = (c: Castaway): ReactNode | undefined => {
    if (!r.scored && activeRoster) return undefined;
    if (r.rule) {
      const n = timesOf(r.row(c.id)!, r.rule);
      return `${n === 0 ? "Never" : n === 1 ? "Once" : `${n} times`} · ${pts(c)} pts`;
    }
    return `${pts(c)} pts`;
  };
  const controls = r.scored ? (
    <>
      <WindowTabs windows={r.windows} value={r.window} onChange={r.setWindow} />
      <RankedBy rules={r.rules} rule={r.rule} onChange={r.setRankBy} className="-mb-1 -mt-1.5 self-start" />
    </>
  ) : null;
  return { ranked, detail, controls };
}

// ---- One spot's claim: replace Patt, or swap Lewis ----

export function SpotPicker({ dropId, forId }: { dropId: string | null; forId: string | null }) {
  const router = useRouter();
  const base = useWaiversBase();
  const { state, me, subject, other } = useSubject(forId);
  const name = useCastNames(state);
  const w = viewerWeek(state, me);
  const period = w.stage === "open" ? w.period : null;
  const mine = useMyClaim(other ? null : period);
  const [picked, setPicked] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fa = period && subject ? StateLogic.availableFor(state, subject) : [];
  const { ranked, detail, controls } = useRankedFreeAgents(state, fa);

  if (w.stage === "hidden") return <Closed>Reveal Episode {w.period!.episode} first: who you can replace would give it away.</Closed>;
  if (!period || !subject) return <Closed>Claims aren&rsquo;t open right now.</Closed>;
  const W = StateLogic.WaiverLogic;
  const drop = dropId ? StateLogic.getCastaway(state, dropId) : undefined;
  if (!drop || !drop.ownerIds.includes(subject)) return <Closed>Choose who to replace or swap from {other ? `${other.name}'s` : "your"} team.</Closed>;
  const out = drop.status !== "active";
  const owed = W.replacementsOwed(state, subject, period);
  const swapsLeft = W.swapsLeft(state, period, subject);
  if (out ? !owed.outIds.includes(drop.id) : swapsLeft <= 0) return <Closed>{out ? `${name(drop.id)} can't be replaced this week.` : "There are no swaps this week."}</Closed>;

  const shared = isShared(state);
  const pairs = other ? [] : mine.claim.pairs;
  const freeIds = new Set(fa.map((c) => c.id));
  const saved = pairs.filter((x) => x.dropId === drop.id && freeIds.has(x.addId)).map((x) => x.addId);
  const sel = (picked ?? saved).filter((id) => freeIds.has(id));
  const changed = sel.join() !== saved.join();
  // The claim's limit is on different free agents across every spot (owed + swaps left + 2).
  const elsewhere = new Set(pairs.filter((x) => x.dropId !== drop.id).map((x) => x.addId));
  const max = owed.count + swapsLeft + 2;
  const room = (id: string) => elsewhere.has(id) || new Set([...elsewhere, ...sel, id]).size <= max;
  const usedFor = (id: string) => {
    const x = pairs.find((p) => p.addId === id && p.dropId !== drop.id);
    return x ? (StateLogic.getCastaway(state, x.dropId)?.status === "active" ? "your swap" : `for ${name(x.dropId)}`) : null;
  };
  const toggle = (id: string) => {
    setError(null);
    if (shared) return setPicked(sel.includes(id) ? [] : [id]);
    if (sel.includes(id)) return setPicked(sel.filter((x) => x !== id));
    if (!room(id)) return setError(`That's as many different ${max === 1 ? "free agent" : "free agents"} as you can claim this week (${max}).`);
    setPicked([...sel, id]);
  };

  async function save() {
    setBusy(true);
    const err = other
      ? await mine.save({ spot: { dropId: drop!.id, addIds: sel } }, other.id)
      : await mine.save({ pairs: W.setSpot(state, period!, subject!, pairs, drop!.id, sel) });
    setBusy(false);
    if (err) setError(err);
    else router.push(base);
  }

  const verb = out ? "Replace" : "Swap";
  return (
    <div className="flex flex-col gap-4">
      {other && <ForPlate name={other.name} />}
      <h2 className="type-caption text-[28px]">
        {verb} {name(drop.id)}
      </h2>
      <p className="-mt-2 text-[15px] leading-[1.45] text-muted-foreground">
        {shared ? "Pick one." : "Tap your first choice, then any backups. You get one."}
        {!out && ` ${name(drop.id)}'s ${castawayPts(state, drop)} pts go with them.`}
      </p>
      {controls}
      {fa.length === 0 ? (
        <Note>Nobody&rsquo;s free right now.</Note>
      ) : (
        <TileGrid cols={3}>
          {ranked.map((c) => {
            const i = sel.indexOf(c.id);
            const used = usedFor(c.id);
            return (
              <CastTile
                key={c.id}
                castaway={c}
                label={name(c.id)}
                state={state}
                photoHeight={104}
                rank={i >= 0 && !shared ? i + 1 : undefined}
                mark={i >= 0 && shared ? "add" : undefined}
                detail={used ? <span className="truncate">{[detail(c), used].filter(Boolean).join(" · ")}</span> : detail(c)}
                onClick={() => toggle(c.id)}
              />
            );
          })}
        </TileGrid>
      )}
      {error && <p className="font-semibold text-live">{error}</p>}
      <ConfirmBar
        note={sel.length > 1 ? `For ${name(drop.id)} · backup ${sel.slice(1).map(name).join(", ")}` : `For ${name(drop.id)}`}
        title={sel.length ? name(sel[0]) : shared ? "Pick one" : "Tap your first choice"}
      >
        <BarButton onClick={save} disabled={busy || mine.loading || !changed}>
          {busy ? "Saving…" : sel.length === 0 && saved.length ? "Remove" : "Save"}
        </BarButton>
      </ConfirmBar>
    </div>
  );
}

/** /waivers/pickup (old links, pushes, the guided tour): the picker for the first castaway you can replace. */
export function FirstReplacementPicker({ forId }: { forId: string | null }) {
  const { state, me, subject } = useSubject(forId);
  const w = viewerWeek(state, me);
  const owed = w.period && subject && w.stage === "open" ? StateLogic.WaiverLogic.replacementsOwed(state, subject, w.period) : null;
  if (w.stage === "open" && owed && !owed.count) return <Closed>Nothing to replace this week.</Closed>;
  return <SpotPicker dropId={owed?.lossIds[0] ?? null} forId={forId} />;
}

// ---- Free agency ----

export function FreeAgencyPicker({ forId, dropId }: { forId: string | null; dropId?: string | null }) {
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
  const [drop, setDrop] = useState<string | null>(dropId ?? null);
  const [add, setAdd] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fa = period && subject ? StateLogic.availableFor(state, subject) : [];
  const { ranked, detail, controls } = useRankedFreeAgents(state, fa);

  if (w.stage === "hidden") return <Closed>Reveal Episode {w.period!.episode} first.</Closed>;
  if (!period || !subject) return <Closed>Free agency opens once claims are processed.</Closed>;
  if (!StateLogic.WaiverLogic.freeAgencyOn(state)) return <Closed>This league has no free agency.</Closed>;

  const W = StateLogic.WaiverLogic;
  const owed = W.replacementsOwed(state, subject, period);
  const swapsLeft = W.swapsLeft(state, period, subject);
  // Who may go: anyone out you can still replace, and (with a swap left) anyone still in.
  const drops = state.castaways.filter((c) => c.ownerIds.includes(subject) && (c.status === "active" ? swapsLeft > 0 : owed.count > 0 && owed.outIds.includes(c.id)));
  const dd = drop && drops.some((c) => c.id === drop) ? drop : drops.length === 1 ? drops[0].id : null;
  const a = add && fa.some((c) => c.id === add) ? add : null;
  const dropC = dd ? StateLogic.getCastaway(state, dd) : undefined;

  async function go() {
    if (!a || !dd || !subject) return;
    // No server (the guided tour): the same move, on the league as it really is.
    if (leagueMode === "mock") {
      const full = useLeagueStore.getState().fullState;
      const err = W.freeAgencyMove(full, subject, a, dd, Date.now());
      if (err) return setError(err);
      setState(full);
      return router.push(base);
    }
    if (!leagueId) return;
    setBusy(true);
    setError(null);
    try {
      setState(await api.freeAgencyMove(leagueId, a, dd, other?.id));
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
    <div className="flex flex-col gap-4">
      {other && <ForPlate name={other.name} />}
      <CaptionPlate
        tone="quiet"
        tag="FA"
        size="sm"
        title="Free agency is open"
        subtitle={`${isShared(state) ? "Moves happen as you tap" : "First come, first served"} · ${freeAgencyUntil(state, period, now, true)}`}
      />
      {drops.length === 0 ? (
        <Note>Nothing left for {other ? other.name : "you"} to do this week. Anyone still free is first come, first served until it closes.</Note>
      ) : (
        <section className="flex flex-col gap-2">
          <SectionHead aside={<HowWaiversWork label="How it works" />}>{dropC ? `${dropC.status === "active" ? "Swap" : "Replace"} ${name(dropC.id)}` : "Who goes?"}</SectionHead>
          {drops.length > 1 && (
            <div role="radiogroup" aria-label="Who goes" className="flex flex-wrap gap-2">
              {drops.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={dd === c.id}
                  onClick={() => setDrop(c.id)}
                  className={
                    dd === c.id
                      ? "min-h-10 rounded-[3px] border border-foreground bg-foreground px-3 text-sm font-bold text-background"
                      : "min-h-10 rounded-[3px] border border-input px-3 text-sm font-semibold hover:bg-accent"
                  }
                >
                  {c.status === "active" ? "Swap" : "Replace"} {name(c.id)}
                </button>
              ))}
            </div>
          )}
          <Note className="text-[13px]">
            {dropC?.status === "active" ? `${name(dropC.id)}'s points go with them.` : dropC ? `${name(dropC.id)}'s points stay.` : "Choose who goes, then who comes in."} It happens the moment you tap Add now.
          </Note>
        </section>
      )}
      {controls}
      {fa.length === 0 ? (
        <Note>Nobody&rsquo;s free right now.</Note>
      ) : (
        <TileGrid cols={3}>
          {ranked.map((c) => (
            <CastTile
              key={c.id}
              castaway={c}
              label={name(c.id)}
              state={state}
              photoHeight={96}
              mark={a === c.id ? "add" : undefined}
              detail={detail(c)}
              onClick={drops.length === 0 ? undefined : () => setAdd(a === c.id ? null : c.id)}
            />
          ))}
        </TileGrid>
      )}
      {error && <p className="font-semibold text-live">{error}</p>}
      {drops.length > 0 && (
        <ConfirmBar note={dd ? `${dropC?.status === "active" ? "Swap" : "Replace"} ${name(dd)} for` : "Choose who goes"} title={a ? name(a) : "Choose a free agent"}>
          <BarButton onClick={go} disabled={busy || !a || !dd}>
            {busy ? "Adding…" : "Add now"}
          </BarButton>
        </ConfirmBar>
      )}
    </div>
  );
}
