"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Archive, CalendarDays, ChevronRight, KeyRound, RotateCcw, SlidersHorizontal, Trash2 } from "lucide-react";
import { backstage, gameAdmin, gamesApi, useEndGames, useGameSettings, type DeletePreview, type EndGame, type GameSettings } from "../data";
import { spanName } from "@/lib/game/spans";
import { gameColour } from "../games";
import { NavLink } from "../nav";
import { paths } from "../routes";
import type { ShowData } from "../screens/show-space";
import { SwitchRow } from "../settings/controls";
import { HoldSheet } from "../ui/guards";
import { EmptyState } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { Stepper } from "./waivers";

// Backstage › Game settings (the mock's settings.js bsSettings, docs/PLAN-new-design.md step 6a): organised by the question
// people have, in plain words, each choice saying what it does, Recommended marked, a dot on anything changed from it and
// "Reset to recommended" beside it. Every change saves at once with Undo on the toast (tier 1) and a line in Recent changes.
// What everyone drafted is fixed once the draft starts: a Weekly Lineup's team size (more starters come off the bench) and
// Outlast's team. Replacing people who leave is the Waivers page. Last, folded away (the mock's details.danger: a toggle): archive or
// delete a game (step 10 part 2b: archive is tier 1 with Undo, delete tier 3 after a hold, restorable for 30 days from Recent
// changes). A Commissioner changes these; a Game admin reads them. Competitive mode (step 15 part 4, the mock's Lock it down):
// one switch for every game you run here; while it's on, nobody new joins and the lineup sizes, Who can join and Scoring rules
// are frozen for the season.

function useAfter() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ["new-design"] });
}

const Dot = ({ on }: { on: boolean }) => (on ? <i data-changed className="ml-1.5 inline-block size-2 rounded-full bg-chyron-line align-middle" title="Changed from recommended" /> : null);

export function SettingsPage({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const couchId = show.couch?.id ?? null;
  const data = useGameSettings(seasonId, couchId);
  const after = useAfter();
  if (data.error) return <EmptyState icon={SlidersHorizontal} title="Settings aren't yours to see here" line={(data.error as Error).message} />;
  if (!data.data || !couchId) return <div aria-busy className="mx-4 mt-6 h-64 animate-pulse rounded-[4px] bg-card" />;

  const write = async (g: GameSettings, body: Parameters<typeof gameAdmin.settings>[3], said: string) => {
    if (!g.commissioner) return toast.quiet("Only a Commissioner changes these");
    try {
      const r = await gameAdmin.settings(seasonId, couchId, g.leagueId, body);
      await after();
      if (!r.batch) return;
      const batch = r.batch;
      toast(said, {
        undo: async () => {
          try {
            await backstage.undo(seasonId, couchId, batch);
            await after();
            toast("Undone");
          } catch (e) {
            toast.quiet((e as Error).message);
          }
        },
      });
    } catch (e) {
      toast.quiet((e as Error).message);
    }
  };

  return (
    <div className="pb-12">
      {data.data.games.map((g) => (
        <GameBlock key={g.leagueId} seasonId={seasonId} g={g} words={show.words} write={write} />
      ))}
      <LockDown seasonId={seasonId} couchId={couchId} games={data.data.games} />
      <EndGames seasonId={seasonId} couchId={couchId} />
      {!data.data.games.some((g) => g.commissioner) && <p className="px-4 pt-6 text-[14px] text-muted-foreground">Only a Commissioner changes these.</p>}
    </div>
  );
}

function GameBlock({
  seasonId,
  g,
  words,
  write,
}: {
  seasonId: string;
  g: GameSettings;
  words: ShowData["words"];
  write: (g: GameSettings, body: Parameters<typeof gameAdmin.settings>[3], said: string) => Promise<void>;
}) {
  const L = g.lineup;
  const lineupChanged = !!L && (L.starters !== L.rec.starters || (!g.draftStarted && L.bench !== L.rec.bench));
  const joinChanged = g.joining.mode !== g.joining.rec;
  // Locked down: frozen for the season, shown as it stands.
  const can = g.commissioner && !g.lockedDown;
  return (
    <section data-settings-game={g.gameName} className="mt-7 px-4">
      <div className="mb-3 flex items-center gap-3">
        <i className="h-9 w-1.5 flex-none rounded-[2px]" style={{ background: gameColour(g.gameName) }} aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="type-caption text-[24px] leading-none">{g.gameName}</h2>
          <small className="text-[13px] text-muted-foreground">
            {g.name} · {g.gameType === "pickem" ? "everyone picks from the whole cast" : g.shared ? "castaways can be on several teams" : "each castaway on one team"}
          </small>
        </div>
      </div>

      {L && (
        <div data-settings="lineup" className="mb-5">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="type-caption text-[15px] tracking-[0.04em] text-muted-foreground">How Weekly Lineup works</h3>
            {lineupChanged && can && (
              <button type="button" data-reset="lineup" onClick={() => write(g, { reset: "lineup" }, `Back to recommended: ${L.rec.starters} score each week`)} className="text-[14px] font-bold">
                Reset to recommended
              </button>
            )}
          </div>
          <p className="mb-2 rounded-[3px] bg-card p-3 text-[15px] leading-snug">
            Each week, <b>{L.starters} of your {L.starters + L.bench}</b> score. You pick which before the episode.
          </p>
          <div className="flex flex-col gap-2">
            <Stepper
              title={
                <>
                  Who scores each week
                  <Dot on={L.starters !== L.rec.starters} />
                </>
              }
              line={g.lockedDown ? "Frozen for the season" : L.starters === L.rec.starters ? "Recommended" : `Recommended: ${L.rec.starters}`}
              value={String(L.starters)}
              disabled={!can}
              onStep={(d) => write(g, { set: { activeSlots: L.starters + d }, text: `Changed who scores each week to ${L.starters + d}` }, `${L.starters + d} score each week from Episode ${g.from ?? "next"}`)}
            />
            {g.draftStarted ? (
              <div className="flex items-center justify-between rounded-[3px] bg-background p-2.5">
                <span>
                  <b className="block text-[15px]">On the bench</b>
                  <small className="text-[13px] text-muted-foreground">Set at the draft: more starters come off the bench</small>
                </span>
                <b className="type-num w-11 text-center text-[22px]">{L.bench}</b>
              </div>
            ) : (
              <Stepper
                title={
                  <>
                    On the bench
                    <Dot on={L.bench !== L.rec.bench} />
                  </>
                }
                line={g.lockedDown ? "Frozen for the season" : "Backups who don't score until you start them"}
                value={String(L.bench)}
                disabled={!can}
                onStep={(d) => write(g, { set: { benchSlots: L.bench + d }, text: `Changed the bench to ${L.bench + d}` }, `${L.bench + d} on the bench`)}
              />
            )}
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <CalendarDays className="size-4" aria-hidden />
            {g.from ? `Changes start with Episode ${g.from}.` : "Changes start with the next episode."} Nobody loses points already scored.
          </p>
        </div>
      )}

      {g.team && (
        <div data-settings="team" className="mb-5 flex items-center justify-between rounded-[3px] bg-background p-2.5">
          <span>
            <b className="block text-[15px]">Team size</b>
            <small className="text-[13px] text-muted-foreground">{g.draftStarted ? "Set at the draft" : `Castaways each player drafts · Recommended: ${g.team.rec}`}</small>
          </span>
          <b className="type-num w-11 text-center text-[22px]">{g.team.size}</b>
        </div>
      )}

      <div data-settings="joining" className="mb-5">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="type-caption text-[15px] tracking-[0.04em] text-muted-foreground">
            Who can join
            <Dot on={joinChanged} />
          </h3>
          {joinChanged && can && (
            <button
              type="button"
              data-reset="joining"
              onClick={() => write(g, { reset: "joining" }, `Back to recommended: ${g.joining.rec === "open" ? "anyone on the couch can join" : "ask me first"}`)}
              className="text-[14px] font-bold"
            >
              Reset to recommended
            </button>
          )}
        </div>
        <small className="mb-2 block text-[13px] text-muted-foreground">
          {g.lockedDown
            ? "Locked down for the season: nobody new joins or catches up."
            : g.gameType === "pickem"
              ? "There are no teams, so new players can jump in."
              : g.joining.rec === "open"
                ? "Castaways can be on several teams, so new players can jump in."
                : "Each castaway is on one team, so new players need your OK."}
        </small>
        {(
          [
            ["open", "Anyone on the couch", "They can catch up on missed episodes", "Let anyone on the couch join"],
            ["ask", "Ask me first", "You get a request to let them in", "Asks new players to ask first"],
            ["locked", "Nobody new", "The game is full for the season", "Closed the game to new players"],
          ] as const
        )
          .filter(([mode]) => mode !== "open" || g.joining.rec === "open")
          .map(([mode, t, d, line]) => (
          <button
            key={t}
            type="button"
            data-join={mode}
            aria-pressed={g.joining.mode === mode}
            disabled={!can}
            onClick={() => g.joining.mode !== mode && write(g, { set: { joinMode: mode }, text: line }, `Saved: ${g.gameName} · ${t}`)}
            className="mb-1.5 flex w-full items-center gap-3 rounded-[3px] bg-background p-2.5 text-left"
          >
            <i className={`grid size-5 flex-none place-items-center rounded-full border-2 ${g.joining.mode === mode ? "border-foreground" : "border-input"}`} aria-hidden>
              {g.joining.mode === mode && <i className="size-2.5 rounded-full bg-foreground" />}
            </i>
            <span>
              <b className="block text-[15px]">
                {t}
                {mode === g.joining.rec && <em className="type-caption ml-2 rounded-[2px] bg-secondary px-1.5 text-[11px] not-italic">Recommended</em>}
              </b>
              <small className="text-[13px] text-muted-foreground">{d}</small>
            </span>
          </button>
        ))}
      </div>

      <HowLong g={g} words={words} can={can} write={write} />

      {g.waivers && (
        <div className="mb-2">
          <h3 className="type-caption mb-2 text-[15px] tracking-[0.04em] text-muted-foreground">Replacing people who leave</h3>
          <NavLink href={paths.backstage(seasonId, "waivers")} className="nd-press flex min-h-[60px] items-center gap-3 rounded-[3px] bg-background px-2.5 py-2">
            <span className="min-w-0 flex-1">
              <b className="block text-[15px]">When someone&apos;s out, players replace them</b>
              <small className="block text-[13px] text-muted-foreground">{g.waivers}</small>
            </span>
            <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
          </NavLink>
        </div>
      )}
    </section>
  );
}

/**
 * How long it runs (step 6 of docs/PLAN-sports-data.md): to the season's end or through an episode, changed before its end is
 * reached, to one still to come; frozen once it's over, or while it's locked down.
 */
function HowLong({
  g,
  words,
  can,
  write,
}: {
  g: GameSettings;
  words: ShowData["words"];
  can: boolean;
  write: (g: GameSettings, body: Parameters<typeof gameAdmin.settings>[3], said: string) => Promise<void>;
}) {
  const part = { singular: words.episode.toLowerCase(), plural: words.episodes.toLowerCase() };
  const sp = g.span;
  const now = sp.to === null ? `${words.episode} ${sp.from} to the season's end` : spanName(sp.from, sp.to, part);
  const say = (to: number | null) => (to === null ? "to the season's end" : `through ${words.episode} ${to}`);
  const open = can && !sp.over;
  return (
    <div data-settings="span" className="mb-5">
      <h3 className="type-caption mb-2 text-[15px] tracking-[0.04em] text-muted-foreground">How long</h3>
      <div className="rounded-[3px] bg-background p-2.5">
        <b data-span-now className="block text-[15px]">
          {sp.over ? `Final · ${now}` : now}
        </b>
        <small className="block text-[13px] leading-snug text-muted-foreground">
          {sp.over
            ? "It's over: its last one is in, so its end stays."
            : g.lockedDown
              ? "Frozen for the season"
              : `Change its end before it's reached. Nothing after its last ${part.singular} scores.`}
        </small>
        {open && (
          <label className="mt-2 flex min-h-11 items-center gap-2.5 border-t border-border pt-2">
            <span className="flex-none text-[14px] text-muted-foreground">Ends</span>
            <select
              data-span-end
              value={sp.to === null ? "" : String(sp.to)}
              onChange={(e) => {
                const to = e.target.value ? Number(e.target.value) : null;
                void write(g, { set: { endEpisode: to }, text: `Changed how long ${g.gameName} runs: ${say(to)}` }, `${g.gameName} runs ${say(to)}`);
              }}
              className="min-w-0 flex-1 truncate rounded-[3px] bg-card px-2.5 py-2 text-[15px] font-semibold"
            >
              <option value="">At the season&rsquo;s end</option>
              {sp.ends.map((e) => (
                <option key={e.number} value={e.number}>
                  Through {words.episode} {e.number}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </div>
  );
}

// ---------- competitive mode (step 15 part 4) ----------

/**
 * The mock's "Competitive mode": Lock it down, for every game you run here at once (on when they all are). A Commissioner's,
 * with Undo; anyone else who runs a game here sees it as it stands.
 */
function LockDown({ seasonId, couchId, games }: { seasonId: string; couchId: string; games: GameSettings[] }) {
  const after = useAfter();
  const [busy, setBusy] = useState(false);
  const mine = games.filter((g) => g.commissioner);
  const on = mine.length ? mine.every((g) => g.lockedDown) : games.some((g) => g.lockedDown);
  const set = async (to: boolean, undo = true) => {
    if (!mine.length) return toast.quiet("Only a Commissioner changes this");
    setBusy(true);
    try {
      const r = await gameAdmin.lockDown(seasonId, couchId, to);
      await after();
      toast(to ? "Competitive mode on" : "Back to casual", undo && r.batch ? { undo: () => set(!to, false) } : {});
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="mt-8 px-4" data-lock-down={on ? "on" : "off"}>
      <h3 className="type-caption mb-1 text-[15px] tracking-[0.04em] text-muted-foreground">Competitive mode</h3>
      <SwitchRow
        data="lock-down"
        on={on}
        disabled={busy || !mine.length}
        title={on ? "Locked down" : "Lock it down"}
        line="No late joins, no catch-up, rules frozen for the season. Off is best for most groups."
        onChange={(to) => set(to)}
      />
    </section>
  );
}

// ---------- archive or delete a game (step 10 part 2b) ----------

type EndAction = "archive" | "delete";

/** The mock's "Archive or delete a game": two rows, each asking which game (when there's more than one of yours). */
function EndGames({ seasonId, couchId }: { seasonId: string; couchId: string }) {
  const data = useEndGames(seasonId, couchId);
  const after = useAfter();
  const [asking, setAsking] = useState<EndAction | null>(null);
  // The picker's title stays put while it slides away.
  const [lastAsk, setLastAsk] = useState<EndAction>("archive");
  if (asking && asking !== lastAsk) setLastAsk(asking);
  const [hold, setHold] = useState<DeletePreview | null | false>(false);
  const [open, setOpen] = useState(false);
  const mine = (data.data?.games ?? []).filter((g) => g.yours);
  if (!mine.length) return null;
  const live = mine.filter((g) => !g.archived);

  const archive = async (g: EndGame) => {
    try {
      const r = await gamesApi.archive(seasonId, couchId, g.leagueId);
      await after();
      toast(`${g.gameName} archived · still on the trophy shelf`, {
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
    }
  };
  const unarchive = async (g: EndGame) => {
    try {
      await gamesApi.unarchive(seasonId, couchId, g.leagueId);
      await after();
      toast(`${g.gameName} is back: it scores again`);
    } catch (e) {
      toast.quiet((e as Error).message);
    }
  };
  const askDelete = async (g: EndGame) => {
    setHold(null);
    try {
      setHold(await gamesApi.deletePreview(seasonId, couchId, g.leagueId));
    } catch (e) {
      setHold(false);
      toast.quiet((e as Error).message);
    }
  };
  const choose = (action: EndAction) => {
    const list = mine;
    if (list.length === 1) {
      const g = list[0];
      if (action === "delete") void askDelete(g);
      else void (g.archived ? unarchive(g) : archive(g));
    } else setAsking(action);
  };

  return (
    <section className="mx-4 mt-8">
      <div data-end-games className="rounded-[4px] bg-card">
        <button
          type="button"
          data-end-toggle
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex min-h-[56px] w-full items-center gap-3 px-3 text-left text-[15px] font-semibold"
        >
          <KeyRound className="size-5 flex-none" aria-hidden />
          <span className="flex-1">Archive or delete a game</span>
          <ChevronRight className={`size-5 flex-none text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} aria-hidden />
        </button>
        {open && (
          <div className="px-3 pb-2">
            <button type="button" data-end="archive" onClick={() => choose("archive")} className="nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border text-left">
              <Archive className="size-5 flex-none text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1">
                <b className="block text-[15px] font-semibold">{live.length ? "Archive a game" : "Bring a game back"}</b>
                <small className="block text-[13px] text-muted-foreground">
                  {live.length ? "Keeps it on the trophy shelf, stops scoring" : "It scores again, with what came in meanwhile"}
                </small>
              </span>
            </button>
            <button type="button" data-end="delete" onClick={() => choose("delete")} className="nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border text-left">
              <Trash2 className="size-5 flex-none text-live" aria-hidden />
              <span className="min-w-0 flex-1">
                <b className="block text-[15px] font-semibold text-live">Delete a game</b>
                <small className="block text-[13px] text-muted-foreground">Removes it for everyone. Restorable for 30 days</small>
              </span>
            </button>
          </div>
        )}
      </div>
      <Sheet open={!!asking} onOpenChange={(o) => !o && setAsking(null)} title={lastAsk === "delete" ? "Delete a game?" : "Archive a game?"} subtitle="Pick which one">
        <div className="flex flex-col pb-2" data-end-pick={asking ?? ""}>
          {mine.map((g) => (
            <button
              key={g.leagueId}
              type="button"
              data-end-game={g.leagueId}
              onClick={() => {
                const action = asking;
                setAsking(null);
                if (action === "delete") void askDelete(g);
                else void (g.archived ? unarchive(g) : archive(g));
              }}
              className="nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border text-left first:border-t-0"
            >
              <i className="size-3 flex-none rounded-full" style={{ background: gameColour(g.gameName) }} aria-hidden />
              <span className="min-w-0 flex-1">
                <b className="block text-[15px] font-semibold">{g.name === g.gameName ? g.gameName : `${g.name} · ${g.gameName}`}</b>
                {g.archived && <small className="block text-[13px] text-muted-foreground">{lastAsk === "delete" ? "Archived" : "Archived · tap to bring it back"}</small>}
              </span>
              {g.archived && lastAsk !== "delete" && <RotateCcw className="size-5 flex-none text-muted-foreground" aria-hidden />}
            </button>
          ))}
        </div>
      </Sheet>
      <HoldSheet
        open={hold !== false}
        onOpenChange={(o) => !o && setHold(false)}
        title={hold ? `Delete ${hold.gameName}?` : "Delete a game?"}
        consequence={hold ? hold.consequence : null}
        cta="delete"
        alt={
          hold && !mine.find((g) => g.leagueId === hold.leagueId)?.archived
            ? {
                label: "Archive it instead",
                line: "Keeps everything on the trophy shelf; just stops scoring.",
                onClick: () => {
                  const g = mine.find((x) => x.leagueId === hold.leagueId);
                  setHold(false);
                  if (g) void archive(g);
                },
              }
            : undefined
        }
        onConfirm={async () => {
          if (!hold) return;
          await gamesApi.delete(seasonId, couchId, hold.leagueId);
          await after();
          toast("Deleted · restore it from Recent changes for 30 days");
        }}
      />
    </section>
  );
}
