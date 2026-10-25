"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronRight, SlidersHorizontal } from "lucide-react";
import { backstage, gameAdmin, useGameSettings, type GameSettings } from "../data";
import { gameColour } from "../games";
import { NavLink } from "../nav";
import { paths } from "../routes";
import type { ShowData } from "../screens/show-space";
import { EmptyState } from "../ui/parts";
import { Preview } from "../ui/preview";
import { toast } from "../ui/toast";
import { Stepper } from "./waivers";

// Backstage › Game settings (the mock's settings.js bsSettings, docs/PLAN-new-design.md step 6a): organised by the question
// people have, in plain words, each choice saying what it does, Recommended marked, a dot on anything changed from it and
// "Reset to recommended" beside it. Every change saves at once with Undo on the toast (tier 1) and a line in Recent changes.
// What everyone drafted is fixed once the draft starts: a Weekly Lineup's team size (more starters come off the bench) and
// Outlast's team. Replacing people who leave is the Waivers page; archiving or deleting a game comes with making one
// (step 10). A Commissioner changes these; a Game admin reads them.

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
    if (!g.commissioner) return toast("Only a Commissioner changes these");
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
            toast((e as Error).message);
          }
        },
      });
    } catch (e) {
      toast((e as Error).message);
    }
  };

  return (
    <div className="pb-12">
      {data.data.games.map((g) => (
        <GameBlock key={g.leagueId} seasonId={seasonId} g={g} write={write} />
      ))}
      <Preview id="backstage.end-game" className="mx-4 mt-8" />
      {!data.data.games.some((g) => g.commissioner) && <p className="px-4 pt-6 text-[14px] text-muted-foreground">Only a Commissioner changes these.</p>}
    </div>
  );
}

function GameBlock({
  seasonId,
  g,
  write,
}: {
  seasonId: string;
  g: GameSettings;
  write: (g: GameSettings, body: Parameters<typeof gameAdmin.settings>[3], said: string) => Promise<void>;
}) {
  const L = g.lineup;
  const lineupChanged = !!L && (L.starters !== L.rec.starters || (!g.draftStarted && L.bench !== L.rec.bench));
  const joinChanged = g.joining.open !== g.joining.rec;
  return (
    <section data-settings-game={g.gameName} className="mt-7 px-4">
      <div className="mb-3 flex items-center gap-3">
        <i className="h-9 w-1.5 flex-none rounded-[2px]" style={{ background: gameColour(g.gameName) }} aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="type-caption text-[24px] leading-none">{g.gameName}</h2>
          <small className="text-[13px] text-muted-foreground">
            {g.name} · {g.shared ? "castaways can be on several teams" : "each castaway on one team"}
          </small>
        </div>
      </div>

      {L && (
        <div data-settings="lineup" className="mb-5">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="type-caption text-[15px] tracking-[0.04em] text-muted-foreground">How Weekly Lineup works</h3>
            {lineupChanged && g.commissioner && (
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
              line={L.starters === L.rec.starters ? "Recommended" : `Recommended: ${L.rec.starters}`}
              value={String(L.starters)}
              disabled={!g.commissioner}
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
                line="Backups who don't score until you start them"
                value={String(L.bench)}
                disabled={!g.commissioner}
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
          {joinChanged && g.commissioner && (
            <button type="button" data-reset="joining" onClick={() => write(g, { reset: "joining" }, "Back to recommended: anyone on the couch can join")} className="text-[14px] font-bold">
              Reset to recommended
            </button>
          )}
        </div>
        <small className="mb-2 block text-[13px] text-muted-foreground">
          {g.shared ? "Castaways can be on several teams, so new players can jump in." : "Each castaway is on one team, so a new player drafts from who's left."}
        </small>
        {(
          [
            [true, "Anyone on the couch", "They can catch up on missed episodes"],
            [false, "Nobody new", "The game is full for the season"],
          ] as const
        ).map(([open, t, d]) => (
          <button
            key={t}
            type="button"
            data-join={open ? "open" : "locked"}
            aria-pressed={g.joining.open === open}
            disabled={!g.commissioner}
            onClick={() => g.joining.open !== open && write(g, { set: { allowLateJoiners: open }, text: open ? "Let anyone on the couch join" : "Closed the game to new players" }, `Saved: ${g.gameName} · ${t}`)}
            className="mb-1.5 flex w-full items-center gap-3 rounded-[3px] bg-background p-2.5 text-left"
          >
            <i className={`grid size-5 flex-none place-items-center rounded-full border-2 ${g.joining.open === open ? "border-foreground" : "border-input"}`} aria-hidden>
              {g.joining.open === open && <i className="size-2.5 rounded-full bg-foreground" />}
            </i>
            <span>
              <b className="block text-[15px]">
                {t}
                {open === g.joining.rec && <em className="type-caption ml-2 rounded-[2px] bg-secondary px-1.5 text-[11px] not-italic">Recommended</em>}
              </b>
              <small className="text-[13px] text-muted-foreground">{d}</small>
            </span>
          </button>
        ))}
      </div>

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
