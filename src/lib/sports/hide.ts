// Sports scores too, the rule (docs/PLAN-start-a-game-gpt.md, "Sports spoilers: Hide scores"; the user's calls of 2026-11-09):
// what a sports game may say to someone. Before it starts, its day and time; once begun and hidden, only when it started (never
// live or final, its clock, period, overtime, score, winner or a team's record); open (sports live, or Show the score tapped this
// visit), On now or Final. Pure: the phone's sports screens (src/new/sports/scores.tsx) and the tests share it.

export interface GameMoment {
  id: string;
  at: string | null;
  state: "pre" | "in" | "post";
  final: boolean;
  called?: string | null;
}

/** Whether a game has begun (by the provider, or by the clock). */
export const begun = (g: Pick<GameMoment, "state" | "at">, now = Date.now()) => g.state !== "pre" || (!!g.at && Date.parse(g.at) <= now);

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "8:20 PM", in the phone's time. */
export function clockOf(at: string): string {
  return new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** "Today", "Tomorrow", "Sun", or "Sun, Nov 16" past a week. */
export function dayOf(at: string, now = Date.now()): string {
  const d = new Date(at);
  const midnight = (t: number) => new Date(new Date(t).toDateString()).getTime();
  const days = Math.round((midnight(d.getTime()) - midnight(now)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1 && days < 7) return DAYS[d.getDay()];
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/**
 * How a game may be told to you: `open` when its score and state may show (sports live, or Show the score tapped this visit), and
 * `when`, the line it says either way: before it starts its day and time; once begun and hidden only "Started 8:20 PM" (or with
 * its day when it wasn't today), never live or final; open, "On now" or "Final" (a game called off says so: it wasn't played).
 */
export function gameWords(g: GameMoment, hidden: boolean, shownNow: boolean, now = Date.now()): { open: boolean; started: boolean; when: string } {
  const started = begun(g, now);
  const at = g.at ? `${dayOf(g.at, now) === "Today" ? "" : `${dayOf(g.at, now)} `}${clockOf(g.at)}` : "Time to be set";
  if (!started) return { open: true, started, when: g.at ? `${dayOf(g.at, now)} ${clockOf(g.at)}` : "Time to be set" };
  // A game called off was never played: saying so gives nothing away.
  if (g.called && g.called !== "suspended") return { open: true, started, when: g.called === "canceled" ? "Canceled" : "Postponed" };
  const open = !hidden || shownNow;
  if (!open) return { open, started, when: `Started ${at}` };
  return { open, started, when: g.state === "post" || g.final ? "Final" : "On now" };
}
