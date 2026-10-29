// The rulebooks flag's check in words (docs/PLAN-desk-parity.md part 7c; db/rulebooks-flag.js check): which leagues score
// exactly the same on their season's rulebook, which stay on their show's built-in rules and why, and which would score
// differently, which holds the switch back. A deleted league isn't counted: nobody sees it, and if it's restored it plays by
// what the flag says then. Pure, for the desk's Settings and its unit test.
import { and } from "./desk-bot-words";

export interface FlagLeague {
  id: string;
  deleted?: boolean;
  written: boolean;
  same?: boolean;
  rules?: boolean;
  differs?: string[];
  mismatch?: string;
  reason?: string;
}

/** What a part of a league's scoring is, said to a person. */
const PART: Record<string, string> = {
  scores: "its standings",
  events: "its episodes' points",
  ended: "when its season ends",
  winner: "its winner",
  catalog: "what scores",
  exits: "how people leave",
};

/** Why a league stays on its show's built-in rules when every season goes on (syncLeagueRulebook's reason or mismatch). */
export function whyStays(l: Pick<FlagLeague, "mismatch" | "reason">): string {
  if (l.mismatch) return "It plays by rules of its own, not its season's rulebook";
  if (l.reason === "no show picked") return "No show picked";
  if (l.reason === "its season isn't in the catalog") return "Its season isn't in the catalog";
  if (l.reason === "its rulebook has no compiled rules") return "Its rulebook has no rules yet";
  return l.reason ? l.reason.charAt(0).toUpperCase() + l.reason.slice(1) : "It stays as it is";
}

/** Why a league would score differently on its rulebook: what would move. */
export function whyDiffers(l: Pick<FlagLeague, "differs" | "rules">): string {
  const parts = (l.differs ?? []).map((k) => PART[k] ?? k);
  if (!parts.length) return "Its rulebook's rules aren't the ones it plays by";
  return `On its rulebook, ${and(parts)} would change`;
}

/** The tally: { same, stay: [{ id, why }], differ: [{ id, why }] }. */
export function tallyOf(all: FlagLeague[]) {
  const leagues = all.filter((l) => !l.deleted);
  const same = leagues.filter((l) => l.written && l.same && l.rules).length;
  const stay = leagues.filter((l) => !l.written).map((l) => ({ id: l.id, why: whyStays(l) }));
  const differ = leagues.filter((l) => l.written && !(l.same && l.rules)).map((l) => ({ id: l.id, why: whyDiffers(l) }));
  return { same, stay, differ };
}
