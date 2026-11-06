"use client";

import { useState } from "react";
import { Bot, Check, CircleQuestionMark, Shield, Users, X } from "lucide-react";
import { airTime } from "../clock";
import { moves, solo, useAfterSolo, usePool, usePractice, type BotLevel, type GameView, type PoolInfo, type PracticeGame, type PracticeInfo } from "../data";
import { ordinal } from "../games";
import { useNav } from "../nav";
import { paths } from "../routes";
import type { ShowData } from "../screens/show-space";
import { Avatar } from "../ui/bars";
import { PushedPage, usePushedPage } from "../ui/page";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { faceIn, first } from "./moves";
import { Block, Face } from "./parts";
import { useOpenReveal } from "./reveal";

// Playing solo (docs/PLAN-new-design.md step 9 part 3; the mock's solo.js): a season's public pool ("Survivor 51 ·
// Everyone": Survival Pool and a weekly Who goes home? against everyone on the app, usernames only, no chat) and your
// practice couch (you against three computer players, Weekly Lineup or Outlast, on the real results). Both on the solo
// hub's Play on your own and a show's Games tab when you're solo (solo.ts on the server; nothing polls); the practice couch
// on anyone's Games tab (2026-10-27: computer players for everyone, not only someone solo), under the couch's games.

/** "top 20%" while you're in the top half of a big enough field, else "12th of 40". */
export function standing(place: number, of: number): string {
  if (of < 5) return `${ordinal(place)} of ${of}`;
  const pct = Math.max(1, Math.ceil((place / of) * 100));
  return pct <= 50 ? `top ${pct}%` : `${ordinal(place)} of ${of}`;
}

/** Whether an episode this game counts has been decided yet (before, every place is a tie at nothing). */
const scored = (g: GameView) => g.from !== null && g.through >= g.from;

const day = (iso: string | null) => (iso ? airTime(Date.parse(iso)).split(" ")[0] : null);

/** The pool card's line once you're in: your streak and standing, then the pick (a reveal first, due, or made). */
function poolLine(g: GameView): string {
  const you = g.you;
  const bits = [`Streak ${you?.week ?? 0}`];
  if (you && scored(g)) bits.push(standing(you.place, g.players));
  if (g.revealFirst) bits.push(`reveal Episode ${g.revealFirst} first`);
  else if (g.pick?.open && !g.pick.pick) bits.push(day(g.pick.airsAt) ? `pick due ${day(g.pick.airsAt)}` : "pick due");
  else if (g.pick?.pick) bits.push(`picked ${first(faceIn(g, g.pick.pick)?.name ?? "")}`);
  return bits.join(" · ");
}

function SoloCard(props: { kicker: string; title: string; line: string; go: string; art?: string | null; bots?: boolean; onClick: () => void; data: Record<string, string> }) {
  const { kicker, title, line, go, art, bots, onClick, data } = props;
  return (
    <button type="button" onClick={onClick} {...data} className="nd-press mt-2 flex w-full items-center gap-3 rounded-[4px] bg-card p-2.5 text-left first:mt-0">
      {bots ? (
        <span className="grid size-16 flex-none grid-cols-2 place-items-center rounded-[3px] bg-secondary p-2 text-muted-foreground" aria-hidden>
          <Bot className="col-span-2 size-5" />
          <Bot className="size-5" />
          <Bot className="size-5" />
        </span>
      ) : art ? (
        // eslint-disable-next-line @next/next/no-img-element -- the show's key art, any host
        <img src={art} alt="" className="size-16 flex-none rounded-[3px] object-cover" />
      ) : (
        <span className="grid size-16 flex-none place-items-center rounded-[3px] bg-secondary" aria-hidden>
          <Users className="size-6 text-muted-foreground" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="type-caption block text-[11px] tracking-[0.06em] text-muted-foreground">{kicker}</span>
        <b className="type-caption block text-[20px] leading-tight">{title}</b>
        <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{line}</small>
      </span>
      <span className="flex h-10 flex-none items-center rounded-[3px] bg-card px-3.5 text-[15px] font-bold outline-1 -outline-offset-1 outline-input">{go}</span>
    </button>
  );
}

export function PoolCard({ info, art, onOpen }: { info: PoolInfo; art: string | null; onOpen: () => void }) {
  return (
    <SoloCard
      kicker="Public pool"
      title={`${info.label} · Everyone`}
      line={info.game ? poolLine(info.game) : info.full ? `Full: ${info.players} playing` : "Survival Pool and predictions against everyone on the app"}
      go={info.joined ? "Open" : "Join"}
      art={art}
      onClick={onOpen}
      data={{ "data-pool": info.seasonId }}
    />
  );
}

const LEVELS: { id: BotLevel; word: string }[] = [
  { id: "easy", word: "Easy" },
  { id: "normal", word: "Normal" },
  { id: "sharp", word: "Sharp" },
];
const levelWord = (l: BotLevel | null) => LEVELS.find((x) => x.id === l)?.word ?? "Normal";

function practiceLine(p: PracticeInfo): string {
  if (!p.game) return "Weekly Lineup or Outlast, drafted against computer players, on real results";
  if (p.drafting) return `Drafting · ${levelWord(p.level)} · real results`;
  const you = p.game.you;
  return `${you && scored(p.game) ? `You're ${ordinal(you.place)}` : "No results yet"} · ${levelWord(p.level)} · real results`;
}

export function PracticeCard({ info, onOpen }: { info: PracticeInfo; onOpen: () => void }) {
  return (
    <SoloCard
      kicker="Practice couch"
      title={info.gameName ? `${info.gameName} vs 3 computer players` : "You vs computer players"}
      line={practiceLine(info)}
      go={info.leagueId ? "Open" : "Start"}
      bots
      onClick={onOpen}
      data={{ "data-practice": info.seasonId }}
    />
  );
}

/** Whether a season's pool or practice couch is worth a card: it's open to you, or it's yours already. */
export const poolShown = (p: PoolInfo) => p.joined || !p.blocked;
export const practiceShown = (p: PracticeInfo) => !!p.leagueId || !p.blocked;

// ---------- the Games tab, solo ----------

/** A show's Games tab when you're solo: the season's pool and your practice couch, under a line saying what they are. */
export function SoloGames({ show }: { show: ShowData }) {
  const seasonId = show.header?.seasonId ?? "";
  const pool = usePool(seasonId, !!show.header);
  const practice = usePractice(seasonId, !!show.header);
  const page = usePushedPage("pool");
  const [sheet, setSheet] = useState(false);
  const name = (show.header?.show.name ?? "this show").replace(/^The /, "");
  const p = pool.data;
  const pr = practice.data;
  if (!p || !pr) return <div aria-busy className="mx-4 mt-[26px] h-40 animate-pulse rounded-[4px] bg-card" />;
  if (!poolShown(p) && !practiceShown(pr)) return null;
  return (
    <>
      <Block title="On your own" aside="No couch needed">
        <p className="mb-3 text-[15px] leading-snug text-muted-foreground" data-solo-lede>
          Two ways to play {name} on your own. Start a couch any time to play with friends instead.
        </p>
        <div>
          {poolShown(p) && <PoolCard info={p} art={show.header?.show.artUrl ?? null} onOpen={page.show} />}
          {practiceShown(pr) && <PracticeCard info={pr} onOpen={() => setSheet(true)} />}
        </div>
      </Block>
      <PracticeSheet open={sheet} onOpenChange={setSheet} seasons={[{ info: pr, seenThrough: show.seenThrough, latestAired: show.latestAired }]} />
    </>
  );
}

/** A show's Games tab on a couch: your practice couch, against computer players and never counted toward the couch. */
export function CouchPractice({ show }: { show: ShowData }) {
  const seasonId = show.header?.seasonId ?? "";
  const practice = usePractice(seasonId, !!show.header);
  const [sheet, setSheet] = useState(false);
  const pr = practice.data;
  if (!pr || !practiceShown(pr)) return null;
  return (
    <>
      <Block title="Practice" aside="Doesn't count on the couch">
        <div data-couch-practice>
          <PracticeCard info={pr} onOpen={() => setSheet(true)} />
        </div>
      </Block>
      <PracticeSheet open={sheet} onOpenChange={setSheet} seasons={[{ info: pr, seenThrough: show.seenThrough, latestAired: show.latestAired }]} />
    </>
  );
}

// ---------- the pool's page ----------

/** The season's public pool, pushed over the show (`?page=pool`): join it, or your streak, your pick, your call, the board. */
export function PoolPage({ show }: { show: ShowData }) {
  const page = usePushedPage("pool");
  const seasonId = show.header?.seasonId ?? "";
  const pool = usePool(seasonId, page.open && !!show.header);
  const label = pool.data?.label ?? (show.header ? `${show.header.show.name.replace(/^The /, "")} ${show.header.seasonNumber ?? ""}`.trim() : "");
  return (
    <PushedPage open={page.open} onClose={page.close} title={`${label} · Everyone`}>
      <div className="pb-10" data-pool-page={pool.data?.joined ? "in" : "out"}>
        {!pool.data ? (
          <div aria-busy className="mx-4 mt-4 h-72 animate-pulse rounded-[4px] bg-card" />
        ) : pool.data.game ? (
          <PoolIn info={pool.data} game={pool.data.game} />
        ) : (
          <PoolOut show={show} info={pool.data} />
        )}
      </div>
    </PushedPage>
  );
}

function PoolOut({ show, info }: { show: ShowData; info: PoolInfo }) {
  const after = useAfterSolo();
  const [busy, setBusy] = useState(false);
  const art = show.header?.show.artUrl ?? null;
  const behind = show.seenThrough != null && show.seenThrough < show.latestAired;
  async function join() {
    setBusy(true);
    try {
      const r = await solo.join(info.seasonId);
      await after();
      toast(`You're in the ${info.label} pool${r.start > 1 ? ` from Episode ${r.start}` : ""}`);
    } catch (e) {
      toast.quiet(e instanceof Error ? e.message : "Couldn't join");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className={`dark relative overflow-hidden text-foreground ${art ? "h-[200px]" : "h-[120px]"}`}>
        {art && (
          // eslint-disable-next-line @next/next/no-img-element -- the show's key art, any host
          <img src={art} alt="" className="absolute inset-0 size-full object-cover" />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(22,20,29,.1),rgba(22,20,29,.95))]" />
        <div className="absolute inset-x-4 bottom-4">
          <b className="type-caption block text-[44px] leading-none">Everyone</b>
          <span className="type-caption mt-1 block text-[15px] text-muted-foreground">{info.label} public pool</span>
        </div>
      </section>
      <section className="px-4 pt-5">
        <ul className="flex flex-col gap-3">
          {[
            [Shield, "Survival Pool", "Pick one person a week who survives. No repeats until you've picked everyone still in."],
            [CircleQuestionMark, "Predictions", "One tap a week on who goes home."],
            [Users, "Just usernames", "No chat and no reactions: those stay on couches."],
          ].map(([Icon, title, line]) => {
            const I = Icon as typeof Shield;
            return (
              <li key={title as string} className="flex gap-3">
                <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-secondary">
                  <I className="size-5" aria-hidden />
                </span>
                <span>
                  <b className="block text-[15px] font-semibold">{title as string}</b>
                  <small className="block text-[13px] leading-snug text-muted-foreground">{line as string}</small>
                </span>
              </li>
            );
          })}
        </ul>
        {info.players > 0 && <p className="mt-4 text-[13px] text-muted-foreground">{info.players === 1 ? "1 person is" : `${info.players} people are`} playing.</p>}
        {behind && !info.blocked && (
          <p className="mt-3 rounded-[3px] bg-card p-3 text-[13px] leading-snug text-muted-foreground" data-pool-behind>
            You&apos;re on Episode {show.seenThrough}. The pool picks for the next episode to air, so its picks show who&apos;s still in.
          </p>
        )}
        {info.blocked ? (
          <p className="mt-4 text-sm text-muted-foreground">{info.blocked}.</p>
        ) : info.full ? (
          <p className="mt-4 text-sm text-muted-foreground">The pool is full for this season.</p>
        ) : (
          <Btn tone="must" wide className="mt-5" disabled={busy} onClick={join} data-pool-join>
            Join the {info.label} pool
          </Btn>
        )}
      </section>
    </>
  );
}

function PoolIn({ info, game: g }: { info: PoolInfo; game: GameView }) {
  const after = useAfterSolo();
  const openReveal = useOpenReveal();
  const [busy, setBusy] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const pick = g.pick;
  const call = g.call;
  const you = g.you;
  const when = pick?.airsAt ? airTime(Date.parse(pick.airsAt)) : null;
  async function save(kind: "pick" | "call", id: string) {
    if (busy) return;
    setBusy(`${kind}:${id}`);
    try {
      if (kind === "pick" && pick) await moves.pick(g.leagueId, pick.epId, g.playerId, id);
      else await solo.call(info.seasonId, call?.call === id ? null : id);
      await after();
      const name = first(faceIn(g, id)?.name ?? "");
      toast(kind === "pick" ? `${name} locked in${you?.week ? ` · streak ${you.week} on the line` : ""}` : call?.call === id ? "Call taken back" : `You called ${name} going home`);
    } catch (e) {
      toast.quiet(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      <section className="flex items-center gap-4 px-4 pt-5" data-pool-hero>
        <b className="type-num text-[72px] leading-none">{you?.week ?? 0}</b>
        <div className="min-w-0">
          <span className="type-caption block text-[15px] tracking-[0.04em]">
            Your streak{you && scored(g) ? ` · ${standing(you.place, g.players)}` : ""}
          </span>
          <p className="mt-1 text-[14px] leading-snug text-muted-foreground">
            {g.revealFirst
              ? "Results are in that you haven't seen: reveal them, then make this week's pick."
              : pick?.open
                ? `Pick who survives Episode ${pick.episode}${when ? ` by ${when}` : ""}. No repeats until you've picked everyone still in.`
                : pick
                  ? `Picks for Episode ${pick.episode} closed when it started.`
                  : "Picks open with the next episode."}
          </p>
        </div>
      </section>

      {g.revealFirst ? (
        <section className="px-4 pt-5">
          <button type="button" onClick={() => openReveal(g.revealFirst!)} data-pool-reveal className="nd-press flex min-h-[60px] w-full items-center gap-3 rounded-[4px] bg-card px-3 text-left">
            <span className="min-w-0 flex-1">
              <b className="block text-[15px] font-semibold">Episode {g.revealFirst} is in</b>
              <small className="block text-[13px] text-muted-foreground">Reveal it to make this week&apos;s pick and call.</small>
            </span>
            <span className="text-[15px] font-semibold text-chyron-line">Reveal</span>
          </button>
        </section>
      ) : (
        <>
          {pick && (
            <Block title="Your pick" aside={pick.open ? "Closes at airtime" : "Closed"}>
              <Tiles g={g} ids={pick.open ? pick.available : pick.pick ? [pick.pick] : []} chosen={pick.pick} busy={busy} disabled={!pick.open} onTap={(id) => save("pick", id)} data="pick" />
              {pick.open && pick.blocked.length > 0 && (
                <p className="mt-2 text-[13px] text-muted-foreground">
                  Not this week: {pick.blocked.map((b) => first(faceIn(g, b.id)?.name ?? "")).join(", ")} (picked already).
                </p>
              )}
            </Block>
          )}
          {call && (
            <Block title="Who goes home?" aside={call.right ? `${call.right} called right` : "One tap a week"}>
              <Tiles g={g} ids={call.open ? call.available : call.call ? [call.call] : []} chosen={call.call} busy={busy} disabled={!call.open} onTap={(id) => save("call", id)} data="call" />
            </Block>
          )}
        </>
      )}

      <Block title="The board" aside="Everyone · usernames only">
        <div data-pool-board>
          {g.table.length === 0 && <p className="border-t border-border py-3 text-sm text-muted-foreground">Nobody on the board yet.</p>}
          {g.table.map((r, i) => (
            <div key={r.playerId}>
              {i > 0 && r.place > g.table[i - 1].place + 1 && <div className="border-t border-border py-1 text-center text-muted-foreground" aria-hidden>···</div>}
              <div className={`flex min-h-14 items-center gap-2.5 border-t ${r.you ? "-mx-2 rounded-[2px] border-transparent bg-secondary px-2" : "border-border"}`} data-board-row={r.name}>
                <span className="type-num w-[34px] flex-none text-[22px] text-muted-foreground">{r.rank}</span>
                <Avatar id={r.userId ?? r.playerId} name={r.name} size={28} />
                <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[15px] font-semibold">
                  <span className="truncate">{r.name}</span>
                  {r.you && <span className="type-caption rounded-[2px] bg-foreground px-1.5 py-0.5 text-[10px] tracking-[0.06em] text-background">You</span>}
                </span>
                {r.calls > 0 && <small className="flex-none text-[13px] text-muted-foreground">{r.calls} called</small>}
                <b className="type-num min-w-[34px] flex-none text-right text-[24px]">{r.total}</b>
              </div>
            </div>
          ))}
        </div>
        <p className="pt-3 text-[13px] text-muted-foreground">
          {g.players === 1 ? "1 person" : `${g.players} people`} · ranked by the longest streak, then right picks.{" "}
          {scored(g) ? `Through Episode ${g.through}.` : g.from === null ? "Picks count once it starts." : `Picks count from Episode ${g.from}.`}
        </p>
      </Block>

      <section className="px-4 pt-8">
        <button type="button" onClick={() => setLeaving(true)} className="text-[15px] font-semibold text-muted-foreground" data-pool-leave>
          Leave the pool
        </button>
      </section>
      <LeaveSheet open={leaving} onOpenChange={setLeaving} label={info.label} seasonId={info.seasonId} />
    </>
  );
}

function Tiles(props: { g: GameView; ids: string[]; chosen: string | null; busy: string | null; disabled: boolean; onTap: (id: string) => void; data: "pick" | "call" }) {
  const { g, ids, chosen, busy, disabled, onTap, data } = props;
  if (!ids.length) return <p className="text-sm text-muted-foreground">{disabled ? "None made." : "Nobody to choose."}</p>;
  return (
    <div className="grid grid-cols-4 gap-2">
      {ids.map((id) => {
        const c = faceIn(g, id);
        const on = chosen === id;
        return (
          <button
            key={id}
            type="button"
            disabled={disabled || !!busy}
            aria-pressed={on}
            onClick={() => onTap(id)}
            {...{ [`data-${data}`]: c?.name ?? id }}
            className={`nd-press relative rounded-[3px] text-left disabled:opacity-100 ${on ? "outline-2 outline-offset-1 outline-foreground" : ""}`}
          >
            <Face src={c?.photo ?? null} name={c?.name} className="aspect-square w-full rounded-[3px] text-[24px]" />
            {on && (
              <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-foreground text-background">
                <Check className="size-3" strokeWidth={3} aria-hidden />
              </span>
            )}
            <b className="type-caption mt-1 block truncate text-[14px]">{first(c?.name ?? "")}</b>
          </button>
        );
      })}
    </div>
  );
}

function LeaveSheet({ open, onOpenChange, label, seasonId }: { open: boolean; onOpenChange: (o: boolean) => void; label: string; seasonId: string }) {
  const after = useAfterSolo();
  const [busy, setBusy] = useState(false);
  async function leave() {
    setBusy(true);
    try {
      await solo.leave(seasonId);
      onOpenChange(false);
      await after();
      toast(`You left the ${label} pool`);
    } catch (e) {
      toast.quiet(e instanceof Error ? e.message : "Couldn't leave");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Leave the pool?" subtitle={`${label} · Everyone`}>
      <p className="mt-2 text-[15px] leading-snug">Your picks, calls and streak go with you. You can join again, from the next episode.</p>
      <Btn wide className="mt-4" disabled={busy} onClick={leave} data-pool-leave-confirm>
        <X className="size-4" aria-hidden />
        Leave the pool
      </Btn>
    </Sheet>
  );
}

// ---------- the practice couch ----------

const GAMES: { id: PracticeGame; name: string; line: string }[] = [
  { id: "active-roster", name: "Weekly Lineup", line: "Draft a team, start your best each week." },
  { id: "classic-draft", name: "Outlast", line: "Draft a team; the last one standing carries you." },
];

export interface PracticeSeason {
  info: PracticeInfo;
  /** Where you are (null: you see results straight away), and the latest episode aired. */
  seenThrough: number | null;
  latestAired: number;
}

/**
 * Start a practice couch (the game, how sharp the computer players are, Start the draft), or yours if you have one (Open the
 * draft or the table, End it). `seasons`: the ones it's for; with several (the hub), a choice of show first.
 */
export function PracticeSheet({ open, onOpenChange, seasons }: { open: boolean; onOpenChange: (o: boolean) => void; seasons: PracticeSeason[] }) {
  const nav = useNav();
  const after = useAfterSolo();
  const [pickedSeason, setSeason] = useState<string | null>(null);
  const [game, setGame] = useState<PracticeGame>("active-roster");
  const [level, setLevel] = useState<BotLevel>("normal");
  const [busy, setBusy] = useState(false);
  const [ending, setEnding] = useState(false);
  const shown = seasons.find((s) => s.info.seasonId === pickedSeason) ?? seasons[0];
  const p = shown?.info;
  const behind = !!shown && shown.seenThrough != null && shown.seenThrough < shown.latestAired;
  async function start() {
    if (!p) return;
    setBusy(true);
    try {
      const r = await solo.startPractice(p.seasonId, game, level);
      await after();
      onOpenChange(false);
      nav.push(`${paths.showPage(p.seasonId, "draft")}?game=${r.leagueId}`);
    } catch (e) {
      toast.quiet(e instanceof Error ? e.message : "Couldn't start it");
    } finally {
      setBusy(false);
    }
  }
  async function end() {
    if (!p) return;
    setBusy(true);
    try {
      await solo.endPractice(p.seasonId);
      setEnding(false);
      onOpenChange(false);
      await after();
      toast("Practice couch ended");
    } catch (e) {
      toast.quiet(e instanceof Error ? e.message : "Couldn't end it");
    } finally {
      setBusy(false);
    }
  }
  const mine = p?.leagueId && p.game;
  return (
    <Sheet open={open} onOpenChange={(o) => (setEnding(false), onOpenChange(o))} title="Practice couch" subtitle={mine ? `${p.label} · ${p.gameName}` : "You against computer players, on real results"}>
      <div className="mt-2 pb-2" data-practice-sheet={mine ? "mine" : "start"}>
        {seasons.length > 1 && !mine && (
          <>
            <p className="type-caption mb-2 text-[13px] text-muted-foreground">Show</p>
            <div className="mb-4 flex flex-wrap gap-2">
              {seasons.map((s) => (
                <button
                  key={s.info.seasonId}
                  type="button"
                  aria-pressed={s.info.seasonId === p?.seasonId}
                  onClick={() => setSeason(s.info.seasonId)}
                  className={`h-9 rounded-[2px] px-3 text-sm font-semibold ${s.info.seasonId === p?.seasonId ? "bg-foreground text-background" : "bg-secondary"}`}
                >
                  {s.info.label}
                </button>
              ))}
            </div>
          </>
        )}
        {mine ? (
          <>
            <div className="grid grid-cols-3 gap-2" data-practice-mine>
              {[
                [p.game!.you && scored(p.game!) ? ordinal(p.game!.you.place) : "—", "Your place"],
                [levelWord(p.level), "Computer players"],
                [p.drafting ? "Drafting" : scored(p.game!) ? `Ep ${p.game!.through}` : `Ep ${p.game!.from}`, p.drafting ? "Now" : scored(p.game!) ? "Through" : "Starts"],
              ].map(([n, l]) => (
                <div key={l} className="rounded-[3px] bg-background p-2.5 text-center">
                  <b className="type-caption block text-[20px]">{n}</b>
                  <small className="block text-xs text-muted-foreground">{l}</small>
                </div>
              ))}
            </div>
            <Btn tone="ink" wide className="mt-4" onClick={() => (onOpenChange(false), nav.push(p.drafting ? `${paths.showPage(p.seasonId, "draft")}?game=${p.leagueId}` : paths.show(p.seasonId, "games")))} data-practice-open>
              {p.drafting ? "Open the draft" : "See the table"}
            </Btn>
            {ending ? (
              <div className="mt-4 rounded-[3px] bg-background p-3">
                <p className="text-[15px] leading-snug">End it? The game, its draft and your points go. You can start another.</p>
                <Btn wide className="mt-3" disabled={busy} onClick={end} data-practice-end-confirm>
                  End the practice couch
                </Btn>
              </div>
            ) : (
              <button type="button" onClick={() => setEnding(true)} className="mt-4 text-[15px] font-semibold text-muted-foreground" data-practice-end>
                End it
              </button>
            )}
          </>
        ) : p?.blocked ? (
          <p className="text-sm text-muted-foreground">{p.blocked}.</p>
        ) : (
          <>
            <p className="type-caption mb-2 text-[13px] text-muted-foreground">Game</p>
            {GAMES.map((x) => (
              <button
                key={x.id}
                type="button"
                aria-pressed={game === x.id}
                onClick={() => setGame(x.id)}
                data-practice-game={x.name}
                className={`mb-2 flex min-h-[60px] w-full items-center rounded-[3px] px-3 text-left ${game === x.id ? "bg-foreground text-background" : "bg-background"}`}
              >
                <span>
                  <b className="block text-[15px] font-semibold">{x.name}</b>
                  <small className={`block text-[13px] ${game === x.id ? "opacity-75" : "text-muted-foreground"}`}>{x.line}</small>
                </span>
              </button>
            ))}
            <p className="type-caption mb-2 mt-3 text-[13px] text-muted-foreground">The computer players</p>
            <div className="grid grid-cols-3 gap-1 rounded-[3px] bg-background p-1" role="radiogroup" aria-label="How sharp the computer players are">
              {LEVELS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  role="radio"
                  aria-checked={level === l.id}
                  onClick={() => setLevel(l.id)}
                  data-practice-level={l.word}
                  className={`h-11 rounded-[2px] text-[15px] font-semibold ${level === l.id ? "bg-foreground text-background" : ""}`}
                >
                  {l.word}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[13px] leading-snug text-muted-foreground">
              Three computer players draft against you, then the season plays out on the real results, spoiler-safe to where you are. Your practice never counts toward a couch.
            </p>
            {behind && (
              <p className="mt-2 rounded-[3px] bg-background p-3 text-[13px] leading-snug text-muted-foreground" data-practice-behind>
                You&apos;re on Episode {shown!.seenThrough}. The draft is from who&apos;s still in after Episode {shown!.latestAired}, so it shows who&apos;s left.
              </p>
            )}
            <Btn tone="must" wide className="mt-4" disabled={busy || !p} onClick={start} data-practice-start>
              Start the draft
            </Btn>
          </>
        )}
      </div>
    </Sheet>
  );
}
