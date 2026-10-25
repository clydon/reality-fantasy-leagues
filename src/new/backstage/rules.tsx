"use client";

import { BookOpen, Trophy } from "lucide-react";
import { useScoringRules, type GameRules } from "../data";
import { gameColour } from "../games";
import type { ShowData } from "../screens/show-space";
import { HowItWorksPage } from "../show/how-it-works";
import { usePushedPage } from "../ui/page";
import { Btn, EmptyState } from "../ui/parts";
import { Preview } from "../ui/preview";

// Backstage › Scoring rules, the read side (the mock's backstage.js bsRules with rulebook.js's head, docs/PLAN-new-design.md
// step 6a): which rulebook these games follow (what can happen in the show, shared by every couch on it, updates reaching
// you on their own), How it works, and each game's points as it counts them. Make it ours (the couch's own copy: what
// counts, a moment of your own) and changing the points come with step 6b's editor.

export function RulesPage({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const couchId = show.couch?.id ?? null;
  const data = useScoringRules(seasonId, couchId);
  const how = usePushedPage("how-it-works");
  if (data.error) return <EmptyState icon={Trophy} title="Scoring rules aren't yours to see here" line={(data.error as Error).message} />;
  if (!data.data || !couchId) return <div aria-busy className="mx-4 mt-6 h-64 animate-pulse rounded-[4px] bg-card" />;
  const { rulebook, games } = data.data;
  return (
    <div className="pb-12">
      <section className="mt-6 px-4">
        <div data-rulebook className="flex items-start gap-3.5 rounded-[4px] bg-card p-3.5">
          <span className="grid size-11 flex-none place-items-center rounded-[3px] bg-foreground text-background">
            <BookOpen className="size-5" aria-hidden />
          </span>
          <span className="min-w-0">
            <b className="block text-[18px] leading-tight">Following {rulebook.season ? `${rulebook.name}'s` : `the ${rulebook.name}`} rulebook</b>
            <small className="mt-1 block text-[14px] leading-snug text-muted-foreground">
              What can happen in the show, shared by every couch on it. Updates reach you on their own.
              {rulebook.following > 1 ? ` ${rulebook.following} games play by it.` : ""}
            </small>
          </span>
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <Btn data-rules-how onClick={() => how.show()}>
            <BookOpen className="size-[18px]" aria-hidden />
            How it works
          </Btn>
          <Preview id="backstage.make-it-ours" tag={false}>
            <Btn wide>Make it ours</Btn>
          </Preview>
        </div>
        <p className="mt-4 flex items-start gap-2 text-[14px] leading-snug text-muted-foreground">
          <Trophy className="mt-0.5 size-4 flex-none" aria-hidden />
          Points are always the couch&apos;s to change, whichever rulebook you follow.
        </p>
      </section>
      {games.map((g) => (
        <GamePoints key={g.leagueId} g={g} />
      ))}
      {show.header && <HowItWorksPage seasonId={seasonId} couchId={couchId} name={show.header.show.name} seasonNumber={show.header.seasonNumber} artUrl={show.header.show.artUrl} />}
    </div>
  );
}

function GamePoints({ g }: { g: GameRules }) {
  return (
    <section data-points={g.gameName} className="mt-7 px-4">
      <div className="mb-3 flex items-center gap-3">
        <i className="h-8 w-1.5 flex-none rounded-[2px]" style={{ background: gameColour(g.gameName) }} aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="type-caption text-[24px] leading-none">{g.gameName}</h2>
          <small className="text-[13px] text-muted-foreground">{g.points ? `${g.name}'s points` : g.name}</small>
        </div>
      </div>
      {g.points ? (
        <>
          {g.points.map((grp) => (
            <div key={grp.id} className="mb-4">
              <span className="type-caption block border-b border-border pb-1.5 text-[14px] tracking-[0.04em] text-muted-foreground">{grp.label}</span>
              {grp.items
                .filter((i) => i.points !== undefined)
                .map((i) => (
                  <div key={i.id} className="flex min-h-[48px] items-center justify-between gap-3 border-b border-border py-1.5">
                    <span className="text-[15px] font-semibold">{i.label}</span>
                    <b className={`type-num flex-none text-[22px] ${i.points! < 0 ? "text-muted-foreground" : ""}`}>
                      {i.points! > 0 ? "+" : ""}
                      {i.points}
                    </b>
                  </div>
                ))}
            </div>
          ))}
          <Preview id="backstage.make-it-ours" tag={false}>
            <Btn wide>Change the points</Btn>
          </Preview>
        </>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {g.lines.map((l) => (
            <li key={l} className="rounded-[3px] bg-card p-3 text-[15px] leading-snug">
              {l}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
