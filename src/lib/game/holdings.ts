// Holdings: who has which idol or advantage right now (docs/PLAN-cast-properties.md chunk 6b, the user's "currently has", decided
// 2026-11-16). A ledger built from the season's accepted holding facts (season_decisions kind 'holding', research's per-episode
// changes): each thing someone holds is a row from how they got it (found, won, given, bought) until how it went (played, gave,
// expired, lost, stolen), or still open. "Has" at a viewer's mark is every row open at their episode, so nothing past it shows
// (the facts it's built from are already only those up to the mark). Pure; the episode research's end-of-episode snapshot is the
// check beside it (snapshotDisagreements).
import { holdingParts } from "./dated-fact-words";

export const GETS = ["found", "won", "given", "bought"] as const;
export const LOSES = ["played", "gave", "expired", "lost", "stolen"] as const;

/** One accepted holding fact: the holder, how, what (its name in the show's words), the other person, the twist, the episode. */
export interface HoldingFact {
  episode: number;
  holder: string;
  how: string;
  name: string;
  other: string;
  twist: string;
}

export interface Holding {
  holder: string;
  name: string;
  twist: string;
  from: { episode: number; how: string; other: string };
  until: { episode: number; how: string; other: string } | null;
}

/** A holding season_decisions row (castaway_name, event_type "<twist>:<how>:<slug>", method the other person) as a fact. */
export function holdingFact(row: { episode_number: number; castaway_name: string; event_type: string; method: string; applied?: { castawayName?: string; method?: string } | null }): HoldingFact {
  const { twist, how, name } = holdingParts(row.event_type);
  return { episode: row.episode_number, holder: row.applied?.castawayName || row.castaway_name, how, name, other: row.applied?.method ?? row.method ?? "", twist };
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The ledger: every row, in the order they began. */
export function ledger(facts: HoldingFact[]): Holding[] {
  const rows: Holding[] = [];
  const ordered = [...facts].sort((a, b) => a.episode - b.episode || Number(LOSES.includes(a.how as never)) - Number(LOSES.includes(b.how as never)));
  const open = (holder: string) => rows.filter((r) => !r.until && same(r.holder, holder));
  for (const f of ordered) {
    if ((GETS as readonly string[]).includes(f.how)) {
      rows.push({ holder: f.holder, name: f.name, twist: f.twist, from: { episode: f.episode, how: f.how, other: f.other }, until: null });
      continue;
    }
    if (!(LOSES as readonly string[]).includes(f.how)) continue;
    // What went: theirs of that name, else of that twist, else their oldest.
    const mine = open(f.holder);
    const row = mine.find((r) => same(r.name, f.name)) ?? mine.find((r) => r.twist === f.twist) ?? mine[0];
    if (row) row.until = { episode: f.episode, how: f.how, other: f.other };
    // Given to someone (or stolen by them): theirs from here, unless research said so for them itself.
    if ((f.how === "gave" || f.how === "stolen") && f.other) {
      const told = ordered.some((g) => g.episode === f.episode && same(g.holder, f.other) && (GETS as readonly string[]).includes(g.how) && same(g.name, f.name));
      if (!told) rows.push({ holder: f.other, name: row?.name ?? f.name, twist: f.twist, from: { episode: f.episode, how: "given", other: f.holder }, until: null });
    }
  }
  return rows;
}

/** What someone holds at the end of `episode` (every row open then). */
export function holdsAt(rows: Holding[], holder: string, episode: number): Holding[] {
  return rows.filter((r) => same(r.holder, holder) && r.from.episode <= episode && (!r.until || r.until.episode > episode));
}

/**
 * Where an episode's end-of-episode snapshot (research's `holdings.atEnd`: [{ holder, name }]) and the ledger disagree, as lines for
 * the desk (decided: a disagreement goes to the desk, neither silently wins): someone the snapshot has holding something the
 * ledger doesn't, and the other way.
 */
export function snapshotDisagreements(rows: Holding[], atEnd: { holder: string; name: string }[], episode: number, cast: string[]): string[] {
  const out: string[] = [];
  for (const s of atEnd) {
    const has = holdsAt(rows, s.holder, episode);
    if (!has.some((r) => same(r.name, s.name)) && !has.length) out.push(`The snapshot says ${s.holder} holds ${s.name}; the record has nothing of theirs open`);
  }
  for (const holder of cast) {
    const has = holdsAt(rows, holder, episode);
    if (has.length && !atEnd.some((s) => same(s.holder, holder))) out.push(`The record says ${holder} still holds ${has.map((r) => r.name).join(" and ")}; the snapshot has nothing of theirs`);
  }
  return out;
}

/** "Has a hidden immunity idol · found Ep 3". */
export function holdsLine(r: Holding): string {
  const thing = /^(a|an|the)\s/i.test(r.name) ? r.name : `${/^[aeiou]/i.test(r.name) ? "an" : "a"} ${r.name}`;
  const how = r.from.how === "given" ? `given by ${r.from.other || "someone"}` : r.from.how;
  return `Has ${thing} · ${how} Ep ${r.from.episode}`;
}
