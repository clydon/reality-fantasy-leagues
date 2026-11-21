"use client";

import { useEffect, useState } from "react";
import { useCurrentCouch, useHome, sportsApi } from "../data";
import { openStartGame } from "../couch/start-game";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import type { StartWhen } from "./team";

// Start a game on a team, or on a league's season (docs/PLAN-start-a-game-redo.md B1): the team's games (or the league's slate) are
// added as a season (/api/sports/add: made or found, shared, followed), then Start a game opens on that season, the same gallery and
// screens as a show's (the user, 2026-11-18: "the sport create a game should at least feel and navigate just like the show"). What
// was picked on the team's sheet says what's added and how long the game starts out: the next game (the rest of the season added, the
// game set to just the next one), their season (every game that can run it opening on it), a rival's meetings, or a run of games.

/** What a game starts on: a team's games (from its sheet), or a league's slate (its sheet). */
export type SportTarget = { kind: "team"; league: string; team: string; teamName: string; when: StartWhen } | { kind: "slate"; league: string; leagueName: string };

export function SportStartHandoff({ target, onOpenChange, onBack }: { target: SportTarget | null; onOpenChange: (o: boolean) => void; onBack?: () => void }) {
  const { data: home } = useHome();
  const couch = useCurrentCouch(home);
  const [error, setError] = useState<string | null>(null);
  const couchId = couch?.id ?? null;
  useEffect(() => {
    if (!target || !couchId) return;
    let gone = false;
    const add =
      target.kind === "slate"
        ? sportsApi.addSlate(target.league, {})
        : sportsApi.add(
            target.when.kind === "meetings"
              ? { league: target.league, team: target.team, whole: "meetings", against: target.when.against }
              : target.when.kind === "games"
                ? { league: target.league, team: target.team, games: target.when.games }
                : { league: target.league, team: target.team, whole: "season" }
          );
    add.then(
      (r) => {
        if (gone) return;
        onOpenChange(false);
        openStartGame({ seasonId: r.seasonId, couchId, length: target.kind === "team" && target.when.kind === "next" ? "next" : target.kind === "team" && target.when.kind === "season" ? "season" : null });
      },
      (e: Error) => !gone && setError(e.message)
    );
    return () => {
      gone = true;
    };
    // The target is the request: one add per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, couchId]);
  const name = target?.kind === "team" ? target.teamName : target?.kind === "slate" ? target.leagueName : "";
  return (
    <Sheet open={!!target} onOpenChange={onOpenChange} title="Start a game" subtitle={name} back={onBack ? { label: "Back", onClick: onBack } : undefined}>
      <div data-sport-handoff={error ? "error" : !couchId ? "no-couch" : "adding"} className="flex flex-col gap-3 pb-2">
        {!couchId ? (
          <p className="text-[15px] leading-snug text-muted-foreground">Start or join a couch first: a game is played on one.</p>
        ) : error ? (
          <>
            <p className="text-[15px] leading-snug">{error}</p>
            {onBack && (
              <Btn tone="ink" wide onClick={onBack}>
                Back
              </Btn>
            )}
          </>
        ) : (
          <>
            <p className="text-[15px] leading-snug text-muted-foreground">Getting {name}&rsquo;s games&hellip;</p>
            <div aria-busy className="h-40 animate-pulse rounded-[4px] bg-secondary" />
          </>
        )}
      </div>
    </Sheet>
  );
}
