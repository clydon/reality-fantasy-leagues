// What a cast answer (our bot's or a paste) changes about a season's cast (docs/PLAN-desk-parity.md step 5, part 5a; the
// mock's desk-cast.js csDiffSheet): someone it adds, someone it no longer lists, a new spelling of someone we have (a
// same-person guess, which the admin confirms or turns into someone new), and a starting group it has differently. Pure,
// so the page, the Inbox's line and Send all read one answer the same way. Nothing here takes anyone out: someone an
// answer no longer lists is only said, to remove from their page (5b). A locked castaway is never changed by an answer.

export interface OurCastaway {
  id: string;
  name: string;
  group: string | null;
  locked: boolean;
}
export interface TheirCastaway {
  name: string;
  group: string | null;
  photo: string | null;
}

export type CastChange =
  /** A new spelling of someone we have: Same person (renamed in every game) or Someone new (joins beside them). */
  | { k: "spell"; key: string; id: string; from: string; to: string; group: string | null; photo: string | null }
  /** A starting group the answer has differently: Keep ours, or Use theirs. */
  | { k: "group"; key: string; id: string; name: string; from: string | null; to: string }
  /** Someone the cast doesn't have: joins every game as nobody's. */
  | { k: "add"; key: string; name: string; group: string | null; photo: string | null }
  /** Someone the answer no longer lists: said, never taken out. */
  | { k: "gone"; key: string; id: string; name: string };

export type CastPicks = Record<string, "same" | "new" | "ours" | "theirs">;

/** A name as two spellings of it compare: no accents, case, punctuation or spacing. */
export const nameKey = (n: string) =>
  n
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const same = (a: string | null, b: string | null) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

/** How far apart two names are (edits). */
function distance(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const t = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = t;
    }
  }
  return d[b.length];
}

/** How alike two names are, as a spelling of the same person: 0 the same, null not near enough. */
function nearness(a: string, b: string): number | null {
  const ka = nameKey(a);
  const kb = nameKey(b);
  if (!ka || !kb) return null;
  if (ka === kb) return 0;
  // A short name is too near too many others (Ben and Jen): only the same letters count.
  const short = Math.min(ka.length, kb.length);
  if (short < 6) return null;
  const d = distance(ka, kb);
  if (d <= Math.max(2, Math.floor(short / 5))) return d;
  // The same surname and a first name one is short for (Matt and Matthew, not Chris and Christine), or the same first name and
  // a surname's spelling.
  const wa = a.trim().toLowerCase().split(/\s+/);
  const wb = b.trim().toLowerCase().split(/\s+/);
  if (wa.length > 1 && wb.length > 1) {
    const [fa, la] = [nameKey(wa[0]), nameKey(wa[wa.length - 1])];
    const [fb, lb] = [nameKey(wb[0]), nameKey(wb[wb.length - 1])];
    if (la === lb && fa.length >= 3 && fb.length >= 3 && Math.abs(fa.length - fb.length) <= 3 && (fa.startsWith(fb) || fb.startsWith(fa))) return 3;
    if (fa === fb && distance(la, lb) <= 2) return 3;
  }
  return null;
}

/**
 * The changes an answer makes to the cast. `groups`: the show has starting groups (an answer's group means something);
 * without them, or where the answer leaves someone's group empty, a group is never a change.
 */
export function castChanges(ours: OurCastaway[], theirs: TheirCastaway[], o: { groups: boolean }): CastChange[] {
  const seen = new Set<string>();
  const list = theirs.filter((t) => {
    const k = t.name.trim().toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const left = new Set(ours.map((c) => c.id));
  const match = new Map<TheirCastaway, OurCastaway>();
  // Exact names first, then the nearest spelling, closest pairs first, so one near miss can't take another's match.
  for (const t of list) {
    const c = ours.find((x) => left.has(x.id) && same(x.name, t.name));
    if (c) {
      match.set(t, c);
      left.delete(c.id);
    }
  }
  const pairs: { t: TheirCastaway; c: OurCastaway; d: number }[] = [];
  for (const t of list)
    if (!match.has(t))
      for (const c of ours) {
        if (!left.has(c.id)) continue;
        const d = nearness(t.name, c.name);
        if (d != null) pairs.push({ t, c, d });
      }
  pairs.sort((a, b) => a.d - b.d);
  for (const p of pairs)
    if (!match.has(p.t) && left.has(p.c.id)) {
      match.set(p.t, p.c);
      left.delete(p.c.id);
    }

  const out: CastChange[] = [];
  for (const t of list) {
    const c = match.get(t);
    if (!c) {
      out.push({ k: "add", key: `add:${t.name.trim().toLowerCase()}`, name: t.name.trim(), group: o.groups ? t.group : null, photo: t.photo });
      continue;
    }
    if (c.locked) continue;
    if (!same(c.name, t.name)) out.push({ k: "spell", key: `spell:${c.id}`, id: c.id, from: c.name, to: t.name.trim(), group: o.groups ? t.group : null, photo: t.photo });
    if (o.groups && t.group?.trim() && !same(c.group, t.group)) out.push({ k: "group", key: `group:${c.id}`, id: c.id, name: c.name, from: c.group, to: t.group.trim() });
  }
  for (const c of ours) if (left.has(c.id)) out.push({ k: "gone", key: `gone:${c.id}`, id: c.id, name: c.name });
  return out;
}

/** Each change's choice as it stands: a new spelling defaults to Same person, a group to ours (the design's calls). */
export const pickOf = (c: CastChange, picks: CastPicks = {}) => picks[c.key] ?? (c.k === "spell" ? "same" : c.k === "group" ? "ours" : null);

/** What sending does with these choices: renames, people joining, starting groups changed. Gone and kept groups do nothing. */
export function castPlan(changes: CastChange[], picks: CastPicks = {}) {
  const rename: { id: string; from: string; to: string }[] = [];
  const add: { name: string; group: string | null; photo: string | null }[] = [];
  const regroup: { id: string; name: string; from: string | null; to: string }[] = [];
  for (const c of changes) {
    const p = pickOf(c, picks);
    if (c.k === "spell") {
      if (p === "new") add.push({ name: c.to, group: c.group, photo: c.photo });
      else rename.push({ id: c.id, from: c.from, to: c.to });
    } else if (c.k === "group" && p === "theirs") regroup.push({ id: c.id, name: c.name, from: c.from, to: c.to });
    else if (c.k === "add") add.push({ name: c.name, group: c.group, photo: c.photo });
  }
  return { rename, add, regroup };
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "1 new spelling, 1 starting tribe, 2 new, 1 not listed" (the Inbox's and the season row's words). */
export function changesLine(changes: CastChange[], words: { group: string; groups: string } = { group: "group", groups: "groups" }): string {
  const n = (k: CastChange["k"]) => changes.filter((c) => c.k === k).length;
  return [
    n("spell") && count(n("spell"), "new spelling", "new spellings"),
    n("group") && count(n("group"), `starting ${words.group}`, `starting ${words.groups}`),
    n("add") && `${n("add")} new`,
    n("gone") && `${n("gone")} not listed`,
  ]
    .filter(Boolean)
    .join(", ");
}
