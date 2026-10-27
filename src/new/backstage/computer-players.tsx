"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bot, Ellipsis, Plus } from "lucide-react";
import { LEVEL_WORDS, type BotLevel } from "@/lib/game/computer-players";
import { gameAdmin, type BotSeat, type GameBots, type MemberGame } from "../data";
import { gameColour } from "../games";
import { HoldSheet } from "../ui/guards";
import { Btn, SectionHead } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";

// Backstage › Members' computer players (src/lib/server/computer-players.ts): each game you run (Commissioner or Game admin)
// that they play, its computer players and their level. Add one before the draft starts (or, with no draft, before its first
// results); change a level any time; take one or all of them out any time but while the draft's open, behind a hold (tier 3:
// their seats go, and after the draft their teams with them).

const LEVELS = Object.keys(LEVEL_WORDS) as BotLevel[];

type Game = MemberGame & { computer: GameBots };
type Out = { game: Game; bot: BotSeat | null };

function useAfter() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ["new-design"] });
}

export function ComputerPlayers({ seasonId, couchId, games }: { seasonId: string; couchId: string; games: MemberGame[] }) {
  // A game with none, that can't take one now, has nothing to show.
  const mine = games.filter((g): g is Game => !!g.computer && (g.computer.bots.length > 0 || !g.computer.add));
  const [adding, setAdding] = useState<Game | null>(null);
  const [seat, setSeat] = useState<{ game: Game; bot: BotSeat } | null>(null);
  const [out, setOut] = useState<Out | null>(null);
  const after = useAfter();
  if (!mine.length) return null;
  const many = mine.length > 1;
  const consequence = ({ game, bot }: Out) => {
    const n = bot ? 1 : game.computer.bots.length;
    const who = n === 1 ? (bot ?? game.computer.bots[0]).name : n === 2 ? "Both computer players" : `All ${n} computer players`;
    const [it, its, leaves] = n === 1 ? ["it", "its", "leaves"] : ["they", "their", "leave"];
    if (game.gameType === "pickem")
      return `${who} ${leaves} ${game.gameName} and ${its} picks with ${n === 1 ? "it" : "them"}. ${game.computer.add ? "This can't be undone." : "You can add more until its first results."}`;
    if (game.computer.drafted)
      return `${who} ${leaves} ${game.gameName} with ${its} ${n === 1 ? "team" : "teams"}: whoever ${it} drafted is free to pick up, and ${it} ${leaves} the standings. This can't be undone.`;
    return `${who} ${leaves} ${game.gameName}. Nothing's been drafted yet, so the ${n === 1 ? "seat just goes" : "seats just go"}, and you can add more until the draft starts.`;
  };
  return (
    <section data-computer-players className="mt-[26px] px-4">
      <SectionHead title="Computer players" flush />
      <div className="flex flex-col gap-4">
        {mine.map((g) => (
          <div key={g.leagueId} data-bots-game={g.gameName}>
            {many && (
              <b className="mb-1 flex items-center gap-2 text-[14px] font-semibold text-muted-foreground">
                <i className="size-2.5 flex-none rounded-full" style={{ background: gameColour(g.gameName) }} aria-hidden />
                {g.gameName}
              </b>
            )}
            <ul className="flex flex-col">
              {g.computer.bots.map((b) => (
                <li key={b.playerId} data-bot={b.name} className="flex min-h-[60px] items-center gap-3 border-t border-border py-2 first:border-t-0">
                  <span className="grid size-[34px] flex-none place-items-center rounded-[3px] bg-secondary text-muted-foreground" aria-hidden>
                    <Bot className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[16px]">{b.name}</b>
                    <small className="block text-[13px] text-muted-foreground">
                      Computer · {LEVEL_WORDS[b.level]}
                      {many ? "" : ` · ${g.gameName}`}
                    </small>
                  </span>
                  <button
                    type="button"
                    data-bot-menu={b.name}
                    aria-label={`${b.name}: level or take out`}
                    onClick={() => setSeat({ game: g, bot: b })}
                    className="grid size-11 flex-none place-items-center rounded-[3px] outline-1 -outline-offset-1 outline-input"
                  >
                    <Ellipsis className="size-5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            {!g.computer.bots.length && <p className="text-[14px] text-muted-foreground">None in {g.gameName}.</p>}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              {g.computer.add ? (
                <small className="text-[13px] leading-snug text-muted-foreground">{g.computer.add}.</small>
              ) : (
                <Btn data-bot-add={g.gameName} onClick={() => setAdding(g)} className="h-11">
                  <Plus className="size-4" aria-hidden />
                  Add a computer player
                </Btn>
              )}
              {g.computer.bots.length > 1 && !g.computer.remove && (
                <button type="button" data-bots-out={g.gameName} onClick={() => setOut({ game: g, bot: null })} className="h-11 text-[15px] font-bold text-live">
                  Take them all out
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="pt-3 text-[13px] leading-snug text-muted-foreground">
        They make their own moves: draft picks, lineups, pool picks and waiver claims. They take places in the tables, but only people are ranked on the couch.
      </p>

      {adding && <AddSheet seasonId={seasonId} couchId={couchId} game={adding} onClose={() => setAdding(null)} />}
      {seat && (
        <BotSheet
          seasonId={seasonId}
          couchId={couchId}
          game={seat.game}
          bot={seat.bot}
          onClose={() => setSeat(null)}
          onOut={() => {
            setOut(seat);
            setSeat(null);
          }}
        />
      )}
      <HoldSheet
        open={!!out}
        onOpenChange={(o) => !o && setOut(null)}
        title={out?.bot ? `Take out ${out.bot.name}?` : "Take them all out?"}
        consequence={out ? consequence(out) : null}
        problem={out?.game.computer.remove ?? null}
        cta={out?.bot ? `take out ${out.bot.name}` : "take them out"}
        restore={null}
        onConfirm={async () => {
          if (!out) return;
          const r = await gameAdmin.bots(seasonId, couchId, out.game.leagueId, out.bot ? { action: "remove", playerId: out.bot.playerId } : { action: "remove", all: true });
          await after();
          toast(r.names.length > 1 ? `${r.names.length} computer players are out of ${out.game.gameName}` : `${r.names[0]} is out of ${out.game.gameName}`);
          setOut(null);
        }}
      />
    </section>
  );
}

function LevelChoice({ value, onChange, data }: { value: BotLevel; onChange: (l: BotLevel) => void; data: string }) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-[3px] bg-background p-1" role="radiogroup" aria-label="How sharp it plays">
      {LEVELS.map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={value === l}
          onClick={() => onChange(l)}
          {...{ [data]: l }}
          className={`h-11 rounded-[2px] text-[15px] font-semibold ${value === l ? "bg-foreground text-background" : ""}`}
        >
          {LEVEL_WORDS[l]}
        </button>
      ))}
    </div>
  );
}

function AddSheet({ seasonId, couchId, game, onClose }: { seasonId: string; couchId: string; game: Game; onClose: () => void }) {
  const after = useAfter();
  const [level, setLevel] = useState<BotLevel>("normal");
  const [busy, setBusy] = useState(false);
  const add = async () => {
    setBusy(true);
    try {
      const r = await gameAdmin.bots(seasonId, couchId, game.leagueId, { action: "add", level });
      await after();
      toast(`${r.names[0]} joined ${game.gameName}`);
      onClose();
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title="Add a computer player" subtitle={`${game.gameName} · ${game.name}`}>
      <div data-bot-add-sheet className="flex flex-col gap-3 pb-2">
        <p className="type-caption text-[13px] text-muted-foreground">How sharp it plays</p>
        <LevelChoice value={level} onChange={setLevel} data="data-bot-add-level" />
        <Btn tone="must" wide data-bot-add-go disabled={busy} onClick={add}>
          {busy ? "Adding…" : "Add it"}
        </Btn>
      </div>
    </Sheet>
  );
}

function BotSheet({ seasonId, couchId, game, bot, onClose, onOut }: { seasonId: string; couchId: string; game: Game; bot: BotSeat; onClose: () => void; onOut: () => void }) {
  const after = useAfter();
  const set = async (level: BotLevel) => {
    if (level === bot.level) return;
    try {
      await gameAdmin.bots(seasonId, couchId, game.leagueId, { action: "level", playerId: bot.playerId, level });
      await after();
      toast(`${bot.name} plays ${LEVEL_WORDS[level]} now`);
      onClose();
    } catch (e) {
      toast.quiet((e as Error).message);
    }
  };
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={bot.name} subtitle={`Computer player · ${game.gameName}`}>
      <div data-bot-sheet className="flex flex-col gap-3 pb-2">
        <p className="type-caption text-[13px] text-muted-foreground">How sharp it plays</p>
        <LevelChoice value={bot.level} onChange={set} data="data-bot-level" />
        <button
          type="button"
          data-bot-out
          disabled={!!game.computer.remove}
          onClick={onOut}
          className="mt-1 flex min-h-[56px] flex-col justify-center border-t border-border text-left disabled:opacity-60"
        >
          <b className="text-[15px] text-live">Take {bot.name} out</b>
          <small className="text-[13px] text-muted-foreground">
            {game.computer.remove ? `${game.computer.remove}.` : game.gameType === "pickem" ? "Its picks go with it" : game.computer.drafted ? "Its team goes with it" : "Its seat goes"}
          </small>
        </button>
      </div>
    </Sheet>
  );
}
