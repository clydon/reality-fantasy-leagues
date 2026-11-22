// Where a game stands now, from ESPN's summary (docs/PLAN-sports-couch.md A1, the hub's scores strip): the score, the period and
// clock, and football's possession and down and distance (the header's `competitors[].possession`, the current drive's last play's
// `end.shortDownDistanceText`: the next snap's). It's the game's now, for someone shown it live (sports live, not hiding scores,
// not watching it as if live): never anyone's own clock. Baseball's bases and outs, hockey's power play and soccer's red cards
// come as each sport's season starts (A1b). Pure: the live read (live.ts), the strip's small route (/api/sports/now) and the
// tests (tests/sports-situation.test.js, on the recorded Patriots–Lions game) share it.
import { idOf, num, str, type EspnSummary } from "./sport";

export interface Situation {
  status: "pre" | "in" | "post";
  final: boolean;
  /** The period it's in (a quarter, a period, an inning, a half), when ESPN says. */
  period: number | null;
  /** Its clock ("6:41"), when the sport keeps one. */
  clock: string | null;
  /** ESPN's short words for where it is ("6:41 - 3rd", "Halftime", "Final/OT"). */
  detail: string | null;
  /** Between halves. */
  half: boolean;
  /** Each side's score by team id. */
  scores: Record<string, number>;
  /** Football: the team with the ball (its id), else null (between plays of a change, at the half, other sports). */
  possession: string | null;
  /** Football: the down and distance ("2nd & 7", "1st & Goal"), else null. */
  down: string | null;
}

type Header = NonNullable<NonNullable<EspnSummary["header"]>["competitions"]>[number] & {
  status?: { displayClock?: string; type?: { shortDetail?: string } };
  competitors?: { possession?: boolean; id?: string | number }[];
};
type Drive = { plays?: { end?: { shortDownDistanceText?: string; downDistanceText?: string } }[] };

/** Where a game stands as of this answer; null when it names no game. */
export function situationOf(summary: EspnSummary | null | undefined): Situation | null {
  const comp = summary?.header?.competitions?.[0] as Header | undefined;
  if (!comp) return null;
  const type = comp.status?.type;
  const status = type?.state === "in" || type?.state === "post" ? type.state : "pre";
  const half = type?.name === "STATUS_HALFTIME";
  const scores: Record<string, number> = {};
  let possession: string | null = null;
  for (const c of comp.competitors ?? []) {
    const id = idOf((c as { team?: { id?: string | number } }).team?.id ?? c.id);
    if (!id) continue;
    scores[id] = num(c.score) ?? 0;
    if (c.possession === true) possession = id;
  }
  // The next snap's down and distance: the last play of the drive going on ends on it (a punt's ends on the other side's 1st &
  // 10). Only while the game's on and someone has the ball: at the half and between periods ESPN gives no possession.
  const drive = (summary as { drives?: { current?: Drive } }).drives?.current;
  const last = drive?.plays?.[drive.plays.length - 1];
  const down = status === "in" && !half && possession ? (str(last?.end?.shortDownDistanceText) ?? null) : null;
  return {
    status,
    final: type?.completed === true,
    period: Number.isInteger(comp.status?.period) ? (comp.status!.period as number) : null,
    clock: status === "in" ? str(comp.status?.displayClock) : null,
    detail: str(type?.shortDetail) ?? str(type?.detail),
    half,
    scores,
    possession: status === "in" && !half ? possession : null,
    down,
  };
}
