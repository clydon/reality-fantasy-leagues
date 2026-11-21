"use client";

import { useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { lockTime } from "../clock";
import { gameColour } from "../games";
import { backstage, gameAdmin, gamesApi, useBackstage, useGameSettings, useWaiversAdmin, type GameSettings } from "../data";
import { JobRow, RUNNER_JOBS } from "../manage/jobs";
import { WhoIsPlaying } from "../manage/people";
import { manageApi } from "../settings/api";
import { SwitchRow } from "../settings/controls";
import { Stepper, WaiverJob, WaiverRule, waiverRuleValue } from "./waivers";
import { Choice } from "../manage/choice";
import { NewMoments, newMomentsValue } from "../manage/moments";
import { NavLink } from "../nav";
import { paths } from "../routes";
import type { ShowData } from "../screens/show-space";
import { PushedPage, usePushedPage } from "../ui/page";
import { toast } from "../ui/toast";
import { TitleCard } from "../couch/gallery-bold/parts";
import { Pictogram } from "../couch/gallery-bold/icons";
import { kindOf, spanName } from "@/lib/game/spans";
import { EndGames, HowLong, JoinControl, LineupControl, LockRow, SheetQuestions, useAfter, useServerUndo, useSettingsWrite } from "./settings";

// Settings Round 3a (docs/design-round/settings-r3-spec.md, -first-view.md, -shape.md) grew this page into **Manage this game**,
// the one page a game's runner reaches from the game itself: its jobs, this episode's lock, How it plays, Who's playing, This
// season's rules on this couch, rename, and Stop this game. Backstage is retired (Games you run lists these pages).
//
// Round 4: changing a game later (docs/design-round/round4-game-settings-spec.md, -first-view.md, -shape.md; approved 2026-11-19
// and built in B4). Backstage › Game settings is a list of the games you run here, a row each; each game's settings are its own
// page, pushed over the game (its ⋯ menu) or over Backstage: the title card Start a game made, this episode's lock, then the rules as
// lines, value first, one opened at a time, and Archive or delete. A link opens it: ?page=game-settings&game=<league id>, and
// &line=<pace | lineup | questions | joining | length> with that rule open.

type Write = ReturnType<typeof useSettingsWrite>;
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** The page that holds one game's settings, pushed over wherever it's opened from (`?page=game-settings&game=<league id>`). */
export function useGameSettingsPage() {
  return usePushedPage("game-settings", ["game", "from", "line"]);
}

const joinWords = { open: "Anyone on the couch", ask: "They ask first", locked: "Nobody new" } as const;
const paceWords = (g: GameSettings) => (g.pace.mode === "own" ? "At your own pace" : "Together");
const oneEpisode = (g: GameSettings) => g.span.from !== null && g.span.to !== null && g.span.from === g.span.to;
const changedIn = (g: GameSettings) => (!g.joining.fixed && g.joining.mode !== g.joining.rec) || (!!g.lineup && (g.lineup.starters !== g.lineup.rec.starters || (!g.draftStarted && g.lineup.bench !== g.lineup.rec.bench)));

/** What's notable about a game in one line: this episode's lock, how moves lock, who joins. */
function notable(g: GameSettings, word: string): string {
  // A season game named by its couch says its type ("Couch Cup · Outlast"); a one-episode game's name is its kind already (the
  // engine's type would say "Prediction Sheet" for a pot or a majority).
  const type = !oneEpisode(g) && kindOf(g.name) !== g.gameName ? g.gameName : null;
  if (g.span.over) return [type, "It's over"].filter(Boolean).join(" · ");
  const at = g.lock?.airsAt ? lockTime(Date.parse(g.lock.airsAt)) : null;
  const lock = g.lock ? `${word} ${g.lock.episode}'s ${g.lock.what} ${g.lock.closed ? "locked" : at ? `lock ${at}` : "open"}` : null;
  return [type, lock ?? paceWords(g)].filter(Boolean).join(" · ");
}

// ---------- the list ----------

function ListRow({ g, word, onOpen }: { g: GameSettings; word: string; onOpen: (id: string) => void }) {
  return (
    <button type="button" data-settings-row={g.leagueId} onClick={() => onOpen(g.leagueId)} className={`nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border py-2 text-left first:border-t-0 ${FOCUS}`}>
      <i className="size-2 flex-none rounded-full" style={{ background: gameColour(g.gameName) }} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <b className="type-caption min-w-0 truncate text-[17px] leading-none">{g.name}</b>
          {changedIn(g) && <em className="type-caption rounded-[2px] bg-quiet-tag px-1.5 text-[11px] not-italic tracking-[0.05em] text-quiet-tag-foreground">Changed</em>}
        </span>
        <small className="mt-1 block truncate text-[13px] text-muted-foreground">{notable(g, word)}</small>
      </span>
      <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
    </button>
  );
}

/** Backstage › Game settings (Round 4): the games you run here, a row each. Running first; a night's games by episode, folded;
 *  finished ones folded. */
export function SettingsList({ seasonId, couchId, games, show, onOpen }: { seasonId: string; couchId: string; games: GameSettings[]; show: ShowData; onOpen: (id: string) => void }) {
  const E = show.words.episode;
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const after = useAfter();
  const [busy, setBusy] = useState(false);
  const running = games.filter((g) => !g.span.over && !oneEpisode(g));
  const nights = games.filter((g) => !g.span.over && oneEpisode(g));
  // Finished: newest first (by where each ended).
  const done = games.filter((g) => g.span.over).sort((a, b) => (b.span.to ?? Infinity) - (a.span.to ?? Infinity) || a.name.localeCompare(b.name));
  // B4 (the user's call on Round 4's story): the finished ones archived at once, one Undo for them all. (An archived game isn't in
  // this read: it leaves the list, and Archive or delete a game below brings one back.)
  const toArchive = done.filter((g) => g.commissioner);
  const archiveAll = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await gamesApi.archiveAll(seasonId, couchId, toArchive.map((g) => g.leagueId));
      await after();
      toast(`Archived ${r.archived} finished ${r.archived === 1 ? "game" : "games"} · still on the trophy shelf`, {
        undo: async () => {
          try {
            await backstage.undo(seasonId, couchId, r.batch);
            await after();
            toast("Undone");
          } catch (e) {
            toast.quiet((e as Error).message);
          }
        },
      });
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const eps = [...new Set(nights.map((g) => g.span.from as number))].sort((a, b) => a - b);
  const fold = (key: string, title: string, aside: string, line: string, list: GameSettings[]) => (
    <section key={key} className="mt-6 px-2" data-settings-fold={key}>
      <h2 className="flex items-baseline gap-2 px-2 pb-2">
        <b className="type-caption text-[15px] tracking-[0.04em]">{title}</b>
        <small className="text-[13px] text-muted-foreground">{aside}</small>
      </h2>
      <div className="rounded-[10px] bg-card px-3.5 py-1">
        <button type="button" aria-expanded={opened.has(key)} onClick={() => setOpened(new Set(opened.has(key) ? [...opened].filter((k) => k !== key) : [...opened, key]))} className={`flex min-h-12 w-full items-center gap-3 text-left ${FOCUS}`}>
          <span className="min-w-0 flex-1 text-[15px] font-semibold text-muted-foreground">{line}</span>
          <ChevronDown className={`size-4 flex-none text-muted-foreground transition-transform duration-200 ${opened.has(key) ? "rotate-180" : ""}`} aria-hidden />
        </button>
        {opened.has(key) && (
          <div className="border-t border-border">
            {key === "done" && toArchive.length > 1 && (
              <button type="button" data-archive-all disabled={busy} onClick={() => void archiveAll()} className={`nd-press my-2 grid min-h-11 w-full place-items-center rounded-[3px] text-[15px] font-bold outline-[1.5px] -outline-offset-[1.5px] outline-input ${FOCUS}`}>
                {busy ? "Archiving…" : `Archive all ${toArchive.length}`}
              </button>
            )}
            {list.map((g) => (
              <ListRow key={g.leagueId} g={g} word={show.words.ep} onOpen={onOpen} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
  return (
    <div data-settings-list>
      {running.length > 0 && (
        <section className="mt-4 px-2">
          <h2 className="flex items-baseline gap-2 px-2 pb-2">
            <b className="type-caption text-[15px] tracking-[0.04em]">Running</b>
            <small className="text-[13px] text-muted-foreground">{running.length === 1 ? "1 game" : `${running.length} games`}</small>
          </h2>
          <div className="rounded-[10px] bg-card px-3.5 py-1">
            {running.map((g) => (
              <ListRow key={g.leagueId} g={g} word={show.words.ep} onOpen={onOpen} />
            ))}
          </div>
        </section>
      )}
      {eps.map((n) => {
        const list = nights.filter((g) => g.span.from === n);
        return fold(`ep-${n}`, `${E} ${n}`, `${list.length} ${list.length === 1 ? "game" : "games"}`, list.length === 1 ? kindOf(list[0].name) : `${list.length} one-${E.toLowerCase()} games`, list);
      })}
      {done.length > 0 && fold("done", "Finished", `${done.length} ${done.length === 1 ? "game" : "games"}`, "Nothing left to change but archive or delete", done)}
    </div>
  );
}

// ---------- a game's settings ----------

/** A rule as a line, value first (Start a game's RuleLine): its control opens under it, one at a time; a fixed one says why. */
function SettingLine({
  id,
  icon,
  label,
  value,
  fixed,
  changed,
  open,
  onToggle,
  href,
  children,
}: {
  id: string;
  icon: string;
  label: string;
  value: string;
  /** Can't change: its reason, or `true` to keep the line's own detail (a Game admin: the title card says why, once). */
  fixed?: string | true | null;
  changed?: boolean;
  open?: boolean;
  onToggle?: () => void;
  href?: string;
  children?: ReactNode;
}) {
  const [head, ...rest] = value.split(" · ");
  const second = typeof fixed === "string" ? fixed : rest.length ? rest.join(" · ") : null;
  const body = (
    <>
      <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-secondary">
        <Pictogram id={icon} className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="type-caption text-[13px] tracking-[0.05em] text-muted-foreground">{label}</span>
          {changed && <em className="type-caption rounded-[2px] bg-quiet-tag px-1.5 text-[11px] not-italic tracking-[0.05em] text-quiet-tag-foreground">Changed</em>}
        </span>
        <b className="block text-[16px] font-semibold leading-snug">{head}</b>
        {second && <small className="block text-[13px] leading-snug text-muted-foreground">{second}</small>}
      </span>
      {!fixed && <ChevronRight className={`size-5 flex-none text-muted-foreground transition-transform duration-200 ${open ? "rotate-90" : ""}`} aria-hidden />}
    </>
  );
  return (
    <div data-setting-line={id} data-setting-open={open ? "yes" : "no"} className="border-t border-border first:border-t-0">
      {fixed ? (
        <div className="flex min-h-[64px] items-center gap-3 py-2">{body}</div>
      ) : href ? (
        <NavLink href={href} className={`nd-press flex min-h-[64px] items-center gap-3 py-2 ${FOCUS}`}>
          {body}
        </NavLink>
      ) : (
        <button type="button" aria-expanded={!!open} onClick={onToggle} className={`nd-press flex min-h-[64px] w-full items-center gap-3 py-2 text-left ${FOCUS}`}>
          {body}
        </button>
      )}
      {open && !fixed && children && <div className="mb-3 rounded-[3px] bg-background px-3 pb-1 pt-3">{children}</div>}
    </div>
  );
}

/** How moves lock: Start a game's two ways. At your own pace is chosen when a game starts; Together still chooses its late moves (on
 *  the honour system until you've watched it or the next one airs, the recommended one, or none: everything locks when it airs). */
function PaceCards({ seasonId, couchId, g, can, why, word }: { seasonId: string; couchId: string; g: GameSettings; can: boolean; why: string | null; word: string }) {
  const after = useAfter();
  const undo = useServerUndo(seasonId, couchId);
  const [busy, setBusy] = useState(false);
  const ep = word.toLowerCase();
  const own = g.pace.mode === "own";
  const set = async (mode: "live" | "strict") => {
    if (busy || !can || g.pace.mode === mode) return;
    setBusy(true);
    try {
      const r = await gameAdmin.pace(seasonId, couchId, g.leagueId, mode);
      await after();
      const said = mode === "live" ? "late moves on the honour system" : "no late moves: everything locks when it airs";
      // Settings Round 3b: the server's Undo (rule 6), not the old value sent back.
      toast(`Saved: ${g.gameName} · ${said}`, undo(r.batch, `Back as it was: ${g.gameName}`));
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (g.pace.of) return <p className="pb-2 text-[15px] leading-snug">A stage follows its game: change it on {g.pace.of}.</p>;
  return (
    <div data-settings="pace" data-pace={g.pace.mode} className="flex flex-col gap-2 pb-2">
      <Choice data="pace-together" title="Together" line={`One deadline for everyone: when the ${ep} airs. Late moves below.`} chosen={!own} why="Chosen when a game starts, so it can't change now." />
      <Choice data="pace-own" title="At your own pace" line="Your move locks when you start watching. Nobody's cut off." chosen={own} why="Chosen when a game starts, so it can't change now." />
      {!own && (
        <div className="mt-2" data-settings="late">
          <p className="type-caption pb-1.5 text-[13px] tracking-[0.05em] text-muted-foreground">Late moves</p>
          <div className="flex flex-col gap-2">
            <Choice data="late-honour" title="On the honour system" tag="Recommended" line={`Open after the ${ep} airs until you've watched it, or the next one airs.`} chosen={g.pace.mode === "live"} why={can ? null : why} onPick={() => void set("live")} />
            <Choice data="late-none" title="None" line={`Everything locks when the ${ep} airs.`} chosen={g.pace.mode === "strict"} why={can ? null : why} onPick={() => void set("strict")} />
          </div>
        </div>
      )}
    </div>
  );
}

/** One game's settings: the title card, this episode's lock, the rules as lines, Stop this game. */
function GameSettingsBody({ seasonId, couchId, show, g, write, line, siblings }: { seasonId: string; couchId: string; show: ShowData; g: GameSettings; write: Write; line: string | null; siblings: string[] }) {
  const [open, setOpen] = useState<string | null>(line);
  const toggle = (id: string) => setOpen(open === id ? null : id);
  const can = g.commissioner && !g.lockedDown && !g.span.over;
  const E = show.words.episode;
  // Why a line can't change: a Game admin's lines keep their own detail (the title card says why, once); a Commissioner's say why.
  const why = g.lockedDown ? "Locked down for the season" : g.span.over ? "It's over" : null;
  const frozen: string | true | null = !g.commissioner ? true : why;
  const sp = g.span;
  const part = { singular: E.toLowerCase(), plural: show.words.episodes.toLowerCase() };
  // Step 2.7: a sport's season that goes on into its playoffs: no end is through its final.
  // Settings Round 3b (A15): a game that ends at a phase says so ("till Merged"), not the season's end (3a's noticed bug).
  const length = sp.from === null ? `When ${sp.phase?.name ?? "its phase"} starts` : sp.endPhase ? `${E} ${sp.from} till ${sp.endPhase.name}${sp.to !== null ? ` · through ${E} ${sp.to}` : ""}` : sp.to === null ? (sp.playoffs ? `${E} ${sp.from} through ${sp.playoffs.final}` : `${E} ${sp.from} to the season's end`) : spanName(sp.from, sp.to, part);
  const L = g.lineup;
  const art = show.header?.show.backdropUrl ?? show.header?.show.artUrl ?? null;
  const kicker = show.header ? `${(show.header.show.name ?? "").replace(/^The /, "")}${show.header.seasonNumber ? ` · Season ${show.header.seasonNumber}` : ""}` : "";
  const role = g.commissioner
    ? g.span.over
      ? "You ran this game. It's over: nothing left to change but archive or delete."
      : "You run this game. Each change saves at once, with Undo."
    : "You help run this game: the lock, waivers and join requests are yours. The Commissioner changes the rules.";
  // Its jobs (Backstage's Needs you, this game's): someone asking to join, a draft to set up, nobody to play yet.
  const bs = useBackstage(seasonId, couchId, null);
  // An open window closing soon is the week's own job below (WaiverJob); a "teams are short" one is a job here (Settings Round 3b).
  const jobs = (bs.data?.needs ?? []).filter((n) => RUNNER_JOBS.has(n.id) && n.leagueId === g.leagueId && !(n.id === "waivers" && n.waivers?.kind === "closing"));
  const waivers = useWaiversAdmin(seasonId, g.waivers ? couchId : null).data?.games.find((x) => x.leagueId === g.leagueId) ?? null;
  const window_ = waivers?.period?.phase === "open" ? waivers.period : null;
  return (
    <div data-game-settings={g.leagueId} data-settings-game={g.gameName} data-settings-league={g.leagueId} className="px-4 pb-16 pt-2">
      <TitleCard name={g.name} kicker={kicker} art={art} aka={[]} sentence={role} />
      {g.lock && !g.span.over && (
        <div className="mt-3">
          <LockRow seasonId={seasonId} couchId={couchId} g={g} lock={g.lock} word={show.words.ep} />
        </div>
      )}
      {(jobs.length > 0 || window_) && (
        <section data-manage-jobs className="mt-3">
          <div className="rounded-[10px] bg-card px-3.5">
            {jobs.map((n) => (
              <JobRow key={`${n.id}-${n.request?.id ?? ""}`} seasonId={seasonId} couchId={couchId} need={n} />
            ))}
            {window_ && waivers && <WaiverJob seasonId={seasonId} couchId={couchId} g={waivers} />}
          </div>
        </section>
      )}
      <Label>How it plays</Label>
      <div className="rounded-[10px] bg-card px-3.5">
        <SettingLine id="pace" icon="clock" label="How moves lock" value={g.pace.mode === "own" ? "At your own pace · moves lock as you each watch" : `Together · ${g.pace.mode === "strict" ? "no late moves" : "late moves on the honour system"}`} fixed={g.pace.mode === "own" ? "Chosen when the game started" : frozen} open={open === "pace"} onToggle={() => toggle("pace")}>
          <PaceCards seasonId={seasonId} couchId={couchId} g={g} can={can} why={why} word={E} />
        </SettingLine>
        {L && (
          <SettingLine id="lineup" icon="team" label="Who scores each week" value={`${L.starters} of your ${L.starters + L.bench} · ${L.bench} on the bench${L.fill !== null ? " · fills an empty slot" : ""}`} changed={L.starters !== L.rec.starters} fixed={frozen} open={open === "lineup"} onToggle={() => toggle("lineup")}>
            <LineupControl g={g} can={can} write={write} compact />
            {/* Settings Round 3b (BACKLOG 165): an empty slot fills from the bench, from the next episode still open. */}
            <div data-bench-fill={L.fill !== null ? "on" : "off"} className="pb-2">
              <SwitchRow
                data="bench-fill"
                on={L.fill !== null}
                disabled={!can}
                title="Fill an empty slot from the bench"
                line={L.fill !== null ? `When a starter goes home and nobody changes the lineup, the first on the bench starts. Since ${E} ${L.fill}.` : `When a starter goes home and nobody changes the lineup, the first on the bench starts. From the next ${E.toLowerCase()} on.`}
                onChange={(to) => void write(g, { set: { benchFill: to }, text: `${g.name}: ${to ? "an empty slot fills from the bench" : "an empty slot stays empty"}` }, to ? "Saved: an empty slot fills from the bench" : "Saved: an empty slot stays empty")}
              />
            </div>
          </SettingLine>
        )}
        {g.team && (
          <SettingLine id="team" icon="teams" label="Team size" value={`${g.team.size} each`} changed={g.team.size !== g.team.rec} fixed={g.draftStarted ? "Fixed: the draft has started" : frozen} open={open === "team"} onToggle={() => toggle("team")}>
            <TeamSize g={g} write={write} />
          </SettingLine>
        )}
        {g.questions && (
          <SettingLine id="questions" icon="sheet" label="The questions" value={`${g.questions.list.filter((x) => x.on).length} on · ${g.questions.list.filter((x) => x.on).map((x) => x.ask).slice(0, 2).join(", ")}`} fixed={frozen ?? (g.questions.editable ? null : (g.questions.why ?? "Answers are in"))} open={open === "questions"} onToggle={() => toggle("questions")}>
            <SheetQuestions seasonId={seasonId} couchId={couchId} g={g} q={g.questions} />
          </SettingLine>
        )}
        <SettingLine id="joining" icon="person" label="Who can join" value={joinWords[g.joining.mode]} changed={!g.joining.fixed && g.joining.mode !== g.joining.rec} fixed={g.joining.fixed ? (g.joining.mode === "open" ? "Until the draft starts, the game decides" : "The game decides: players own their castaways") : frozen} open={open === "joining"} onToggle={() => toggle("joining")}>
          <JoinControl g={g} can={can} write={write} compact />
        </SettingLine>
        <SettingLine id="length" icon="halves" label="How long" value={length} fixed={sp.over ? "It's over" : frozen} open={open === "length"} onToggle={() => toggle("length")}>
          <HowLong g={g} words={show.words} can={can} write={write} compact />
        </SettingLine>
        {/* One control for replacements (C32), opened in place (Round 3a, the user's pick): the week, then how waivers run. */}
        {g.waivers && (
          <SettingLine id="waivers" icon="swap" label="Replacing people who leave" value={waivers ? waiverRuleValue(waivers) : g.waivers} open={open === "waivers"} onToggle={() => toggle("waivers")}>
            {waivers ? <WaiverRule seasonId={seasonId} couchId={couchId} g={waivers} /> : <div aria-busy className="mb-2 h-24 animate-pulse rounded-[3px] bg-secondary" />}
          </SettingLine>
        )}
        {/* Settings Round 3b (A17): when the show adds a moment mid-season, and the moments this game has gained. */}
        {g.moments && (
          <SettingLine id="moments" icon="twist" label="When the show adds a moment" value={newMomentsValue(g.moments)} changed={g.moments.set && g.moments.rule !== g.moments.rec} open={open === "moments"} onToggle={() => toggle("moments")}>
            <NewMoments seasonId={seasonId} couchId={couchId} g={g} ep={show.words.ep} />
          </SettingLine>
        )}
      </div>

      <Label>
        Who&apos;s playing
        {/* Settings Round 3b (166): who hasn't set this episode's move, quiet (PFD R2: never colour); their sheet sets it. */}
        {g.missing && (
          <span data-missing-count className="ml-2 normal-case tracking-normal">
            · {g.missing.people.length} {g.missing.people.length === 1 ? "hasn't" : "haven't"} set {g.missing.kind === "lineup" ? "a lineup" : "a pick"}
          </span>
        )}
      </Label>
      <WhoIsPlaying seasonId={seasonId} couchId={couchId} leagueId={g.leagueId} gameName={g.name} commissioner={g.commissioner} waivers={waivers} missing={g.missing} ep={show.words.ep} />

      <Label>This season&apos;s rules on this couch</Label>
      <p className="-mt-0.5 pb-2 text-[13px] leading-snug text-muted-foreground">
        Shared by {siblings.length > 1 ? listOf(siblings) : "every game"} on {kicker || "this season"} here.
      </p>
      <div className="rounded-[10px] bg-card px-3.5">
        <SettingLine id="rulebook" icon="props" label="The rulebook" value="What can happen in the show, and what each moment scores" href={paths.backstage(seasonId, "rules")} />
        <Freeze seasonId={seasonId} couchId={couchId} g={g} games={siblings} />
        <SettingLine id="changes" icon="confidence" label="Recent changes" value="Who changed what in the games here, with Undo" href={paths.backstage(seasonId, "history")} />
      </div>

      {/* This game: its name, then Stop, last, after a gap, drawn quiet; the hold carries the red (Round 2's pick, 2026-11-21). */}
      {g.commissioner && (
        <>
          <Label>This game</Label>
          <Rename g={g} />
          <div className="-mx-4">
            <EndGames seasonId={seasonId} couchId={couchId} only={g.leagueId} />
          </div>
        </>
      )}
      {g.commissioner && !g.span.over && <p className="mt-2 text-[13px] leading-snug text-muted-foreground">To end it after an {E.toLowerCase()} instead, change How long above.</p>}
    </div>
  );
}

/** A section's label on Manage this game: the same small caps as How it plays'. */
function listOf(names: string[]): string {
  return names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function Label({ children }: { children: ReactNode }) {
  return <p className="type-caption mt-7 pb-1 text-[13px] tracking-[0.05em] text-muted-foreground">{children}</p>;
}

/** Team size, a real control until the draft starts (C40): the server takes it (settingsWrite's teamSize). */
function TeamSize({ g, write }: { g: GameSettings; write: Write }) {
  const t = g.team!;
  const step = (d: number) => {
    const n = Math.min(t.max, Math.max(1, t.size + d));
    if (n !== t.size) void write(g, { set: { teamSize: n } }, `Saved: ${g.name} · teams of ${n}`);
  };
  return (
    <div data-settings="team" className="pb-2">
      <Stepper title="Each team" line={t.size === t.rec ? "Recommended" : `Recommended: ${t.rec}`} value={String(t.size)} onStep={step} atMin={t.size <= 1} atMax={t.size >= t.max} disabled={!g.commissioner} />
    </div>
  );
}

/** Freeze rules and joining (was Lock it down, C37): every game you run here, off by default. A Commissioner's, with Undo. */
function Freeze({ seasonId, couchId, g, games }: { seasonId: string; couchId: string; g: GameSettings; games: string[] }) {
  const after = useAfter();
  const undo = useServerUndo(seasonId, couchId);
  const [busy, setBusy] = useState(false);
  const set = async (to: boolean) => {
    if (!g.commissioner) return toast.quiet("Only a Commissioner changes this");
    setBusy(true);
    try {
      const r = await gameAdmin.lockDown(seasonId, couchId, to);
      await after();
      const which = games.length > 1 ? listOf(games) : g.name;
      // Settings Round 3b: the batch's own Undo (it was a second write the other way).
      toast(to ? `Frozen for the season: ${which}` : `Rules and joining open again: ${which}`, undo(r.batch, to ? "Unfrozen" : "Frozen again"));
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  // A Helper reads it as a value, at full contrast, with whose it is (PFD R2: no dimmed rows).
  if (!g.commissioner)
    return (
      <div data-freeze={g.lockedDown ? "on" : "off"} className="border-t border-border">
        <SettingLine id="freeze" icon="none" label="Freeze rules and joining" value={g.lockedDown ? "On" : "Off"} fixed="The Commissioner's to change" />
      </div>
    );
  return (
    <div data-freeze={g.lockedDown ? "on" : "off"} className="border-t border-border">
      <SwitchRow
        data="freeze"
        on={g.lockedDown}
        disabled={busy || !g.commissioner}
        title="Freeze rules and joining"
        line="No late joins, no catching up, and no rule changes for the season. Off suits most couches."
        onChange={(to) => void set(to)}
      />
    </div>
  );
}

/** Rename this game (A13): the Commissioner's; saved with Undo and a line in Recent changes. */
function Rename({ g }: { g: GameSettings }) {
  const after = useAfter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(g.name);
  const [busy, setBusy] = useState(false);
  const clean = name.trim().replace(/\s+/g, " ");
  const save = async (to: string, from: string, undoing = false) => {
    setBusy(true);
    try {
      await manageApi.rename(g.leagueId, to);
      await after();
      setOpen(false);
      toast(undoing ? `Back to ${to}` : `Renamed ${to}`, undoing ? undefined : { undo: () => void save(from, to, true) });
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rounded-[10px] bg-card px-3.5">
      <SettingLine id="rename" icon="quote" label="Rename this game" value={g.name} open={open} onToggle={() => (setOpen(!open), setName(g.name))}>
        <form
          data-rename
          onSubmit={(e) => {
            e.preventDefault();
            if (clean && clean !== g.name && !busy) void save(clean, g.name);
          }}
          className="flex items-center gap-2 pb-2"
        >
          <input
            aria-label="The game's name"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            className="h-11 min-w-0 flex-1 rounded-[3px] bg-secondary px-3 text-[16px] outline-1 -outline-offset-1 outline-input focus-visible:outline-2 focus-visible:outline-ring"
          />
          <button type="submit" disabled={busy || !clean || clean === g.name} className="h-11 rounded-[3px] bg-foreground px-4 text-[15px] font-bold text-background disabled:opacity-40">
            Save
          </button>
        </form>
      </SettingLine>
    </div>
  );
}

/** One game's settings as a page pushed over the game or Backstage. Its data is Backstage's settings read, asked once it opens. */
export function GameSettingsPage({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const page = useGameSettingsPage();
  const params = useSearchParams();
  const id = params.get("game");
  const couchId = show.couch?.id ?? null;
  const data = useGameSettings(seasonId, couchId, page.open);
  const write = useSettingsWrite(seasonId, couchId);
  const g = data.data?.games.find((x) => x.leagueId === id) ?? null;
  const from = params.get("from");
  const back = from === "game" ? (g?.name ?? "Back") : from === "games" ? "Games you run" : (show.header?.show.name ?? "Back").replace(/^The /, "");
  return (
    <PushedPage open={page.open} onClose={page.close} title="Manage this game" back={back}>
      {!data.data || !couchId ? (
        <div aria-busy className="mx-4 mt-4 h-64 animate-pulse rounded-[4px] bg-card" />
      ) : g ? (
        <GameSettingsBody
          key={`${g.leagueId}:${params.get("line") ?? ""}`}
          seasonId={seasonId}
          couchId={couchId}
          show={show}
          g={g}
          write={write}
          line={params.get("line")}
          siblings={(data.data?.games ?? []).filter((x) => !x.span.over && (g.commissioner ? x.commissioner : true)).map((x) => x.name)}
        />
      ) : (
        <p className="px-4 pt-6 text-[15px] text-muted-foreground">Only whoever runs this game manages it.</p>
      )}
    </PushedPage>
  );
}
