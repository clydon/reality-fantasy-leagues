// What a cast answer (our bot's or a paste) changes about a season's cast (docs/PLAN-desk-parity.md step 5, part 5a; the
// mock's desk-cast.js csDiffSheet): someone it adds, someone it no longer lists, a new spelling of someone we have (a
// same-person guess, which the admin confirms or turns into someone new), and a starting group it has differently. Pure,
// so the page, the Inbox's line and Send all read one answer the same way. Nothing here takes anyone out: someone an
// answer no longer lists is only said, to remove from their page (5b). A locked castaway is never changed by an answer.
// Cast properties (docs/PLAN-cast-properties.md, chunk 2): a person's properties (department, job) and bio as the answer
// states them, merged over ours (a value the answer doesn't state never takes ours away), each a change of its own.

import type { CastBio } from "@/lib/game/formats/cast-prompt";

export type CastProps = Record<string, string>;

export interface OurCastaway {
  id: string;
  name: string;
  group: string | null;
  locked: boolean;
  /** Their photo now (only read with `photos`: a listing's may make way for the answer's). */
  photo?: string | null;
  /** Their properties now (season_cast.props), only read with `props`. */
  props?: CastProps;
  /** Their bio now (season_cast.bio). */
  bio?: CastBio | null;
}
export interface TheirCastaway {
  name: string;
  group: string | null;
  photo: string | null;
  /** The properties the answer states for them (only the rulebook's, matched to its values). */
  props?: CastProps;
  /** Their bio as the answer bills it. */
  bio?: CastBio | null;
}

export type CastChange =
  /** A new spelling of someone we have: Same person (renamed in every game) or Someone new (joins beside them). */
  | { k: "spell"; key: string; id: string; from: string; to: string; group: string | null; photo: string | null }
  /** A starting group the answer has differently: Keep ours, or Use theirs. */
  | { k: "group"; key: string; id: string; name: string; from: string | null; to: string }
  /** Someone the cast doesn't have: joins every game as nobody's (with what the answer says about them). */
  | { k: "add"; key: string; name: string; group: string | null; photo: string | null; props?: CastProps; bio?: CastBio | null }
  /** Someone the answer no longer lists: said, never taken out. */
  | { k: "gone"; key: string; id: string; name: string }
  /** The answer's photo of someone we have whose photo is a TV listing's or none (the user, 2026-11-05: a lineup all from
   *  this season, where the listings keep one old headshot a person): replaced on Send. */
  | { k: "photo"; key: string; id: string; name: string; from: string | null; to: string }
  /** What the answer says they're sorted by (a department, a job), over ours: Use theirs (the default when we have none) or Keep ours. */
  | { k: "props"; key: string; id: string; name: string; from: CastProps; to: CastProps }
  /** Their bio as the answer bills it, over ours: Use theirs (the default when we have none) or Keep ours. */
  | { k: "bio"; key: string; id: string; name: string; from: CastBio | null; to: CastBio };

export type CastPicks = Record<string, "same" | "new" | "ours" | "theirs">;

/** A name as two spellings of it compare: no accents, case, punctuation or spacing. */
export const nameKey = (n: string) =>
  n
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const same = (a: string | null, b: string | null) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

// A name billed with a nickname in quotes ("Angelica “Jelly” Loblack", "Danny “Kilby” Kilby") is the same person as the name
// without it, or as the nickname and surname: a research answer often writes it the network's way (found on Survivor 51's,
// 2026-11-16). Each spelling a name may stand for, the name itself first.
const NICK = /\s*[“"‘]([^”"’]+)[”"’]\s*/;
export function nameForms(name: string): string[] {
  const n = name.trim().replace(/\s+/g, " ");
  const m = NICK.exec(n);
  if (!m) return [n];
  const without = n.replace(NICK, " ").replace(/\s+/g, " ").trim();
  const last = without.split(" ").slice(1).join(" ");
  return [n, without, ...(last ? [`${m[1].trim()} ${last}`] : [])];
}
/** Whether two names are one person's, nicknames in quotes allowed for. */
const samePerson = (ours: string, theirs: string) => nameForms(theirs).some((f) => same(ours, f)) || nameForms(ours).some((f) => same(f, theirs));

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
/** A photo the listings gave (TMDB's, TVmaze's, a wiki's icon) or none: an answer's own may take its place. One someone chose
 *  (our own files, any other address, the answer's own from before) never does. */
export const listingPhoto = (url: string | null | undefined): boolean => {
  const u = (url ?? "").trim();
  return !u || /^https?:\/\/(image\.tmdb\.org|static\.tvmaze\.com|static\.wikia\.nocookie\.net)\//i.test(u);
};

/** `theirs` over `ours`, only what's stated; null when the result is the same as ours. */
function merged<T extends object>(ours: T | null | undefined, theirs: T | null | undefined): T | null {
  const given = Object.entries(theirs ?? {}).filter(([, v]) => v !== "" && v !== null && v !== undefined);
  if (!given.length) return null;
  const out = { ...(ours ?? {}) } as Record<string, unknown>;
  for (const [k, v] of given) out[k] = v;
  const same = Object.keys(out).length === Object.keys(ours ?? {}).length && Object.entries(out).every(([k, v]) => (ours as Record<string, unknown> | null | undefined)?.[k] === v);
  return same ? null : (out as T);
}

export function castChanges(ours: OurCastaway[], theirs: TheirCastaway[], o: { groups: boolean; photos?: boolean; props?: boolean }): CastChange[] {
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
    const c = ours.find((x) => left.has(x.id) && samePerson(x.name, t.name));
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
      out.push({
        k: "add",
        key: `add:${t.name.trim().toLowerCase()}`,
        name: t.name.trim(),
        group: o.groups ? t.group : null,
        photo: t.photo,
        ...(o.props && t.props && Object.keys(t.props).length ? { props: t.props } : {}),
        ...(t.bio ? { bio: t.bio } : {}),
      });
      continue;
    }
    if (c.locked) continue;
    if (!samePerson(c.name, t.name)) out.push({ k: "spell", key: `spell:${c.id}`, id: c.id, from: c.name, to: t.name.trim(), group: o.groups ? t.group : null, photo: t.photo });
    if (o.groups && t.group?.trim() && !same(c.group, t.group)) out.push({ k: "group", key: `group:${c.id}`, id: c.id, name: c.name, from: c.group, to: t.group.trim() });
    const photo = t.photo?.trim();
    if (o.photos && photo && /^https?:\/\//i.test(photo) && photo !== (c.photo ?? "") && listingPhoto(c.photo)) {
      out.push({ k: "photo", key: `photo:${c.id}`, id: c.id, name: c.name, from: c.photo ?? null, to: photo });
    }
    const props = o.props ? merged(c.props ?? {}, t.props) : null;
    if (props) out.push({ k: "props", key: `props:${c.id}`, id: c.id, name: c.name, from: c.props ?? {}, to: props });
    const bio = merged(c.bio ?? null, t.bio ?? null);
    if (bio) out.push({ k: "bio", key: `bio:${c.id}`, id: c.id, name: c.name, from: c.bio ?? null, to: bio });
  }
  for (const c of ours) if (left.has(c.id)) out.push({ k: "gone", key: `gone:${c.id}`, id: c.id, name: c.name });
  return out;
}

/** Each change's choice as it stands: a new spelling defaults to Same person, a group to ours (the design's calls). */
// Properties and a bio fill in where we have none, and keep ours (the desk's, decided item 4) where we have some.
export const pickOf = (c: CastChange, picks: CastPicks = {}) =>
  picks[c.key] ??
  (c.k === "spell" ? "same" : c.k === "group" ? "ours" : c.k === "props" ? (onlyAdds(c.from, c.to) ? "theirs" : "ours") : c.k === "bio" ? (c.from ? "ours" : "theirs") : null);
/** Whether `to` only adds to `from` (a gender for someone whose job we have), changing nothing we have: it fills in. A gender the
 *  desk set, or one the show billed, is never replaced by an inferred one by default. */
function onlyAdds(from: CastProps, to: CastProps) {
  return Object.entries(from).every(([k, v]) => k === "genderFrom" || to[k] === v);
}

/** What sending does with these choices: renames, people joining, starting groups changed. Gone and kept groups do nothing. */
export function castPlan(changes: CastChange[], picks: CastPicks = {}) {
  const rename: { id: string; from: string; to: string }[] = [];
  const add: { name: string; group: string | null; photo: string | null; props: CastProps; bio: CastBio | null }[] = [];
  const regroup: { id: string; name: string; from: string | null; to: string }[] = [];
  const rephoto: { id: string; name: string; from: string | null; to: string }[] = [];
  const reprops: { id: string; name: string; from: CastProps; to: CastProps }[] = [];
  const rebio: { id: string; name: string; from: CastBio | null; to: CastBio }[] = [];
  // Someone new under a new spelling joins with what the answer says about them (its props and bio rows, keyed on our match).
  const about = (id: string) => ({
    props: (changes.find((x) => x.k === "props" && x.id === id) as Extract<CastChange, { k: "props" }> | undefined)?.to ?? {},
    bio: (changes.find((x) => x.k === "bio" && x.id === id) as Extract<CastChange, { k: "bio" }> | undefined)?.to ?? null,
  });
  const newSpelling = new Set(changes.filter((c) => c.k === "spell" && pickOf(c, picks) === "new").map((c) => (c as Extract<CastChange, { k: "spell" }>).id));
  for (const c of changes) {
    const p = pickOf(c, picks);
    if (c.k === "spell") {
      if (p === "new") add.push({ name: c.to, group: c.group, photo: c.photo, ...about(c.id) });
      else rename.push({ id: c.id, from: c.from, to: c.to });
    } else if (c.k === "group" && p === "theirs") regroup.push({ id: c.id, name: c.name, from: c.from, to: c.to });
    else if (c.k === "add") add.push({ name: c.name, group: c.group, photo: c.photo, props: c.props ?? {}, bio: c.bio ?? null });
    else if (c.k === "photo") rephoto.push({ id: c.id, name: c.name, from: c.from, to: c.to });
    else if (c.k === "props" && !newSpelling.has(c.id)) {
      // Keep ours keeps the values we have and still fills in what we don't (a gender beside a job spelled another way).
      const to = p === "theirs" ? c.to : { ...Object.fromEntries(Object.entries(c.to).filter(([k]) => !(k in c.from) && !(k === "genderFrom" && "gender" in c.from))), ...c.from };
      if (JSON.stringify(Object.entries(to).sort()) !== JSON.stringify(Object.entries(c.from).sort())) reprops.push({ id: c.id, name: c.name, from: c.from, to });
    }
    else if (c.k === "bio" && p === "theirs" && !newSpelling.has(c.id)) rebio.push({ id: c.id, name: c.name, from: c.from, to: c.to });
  }
  return { rename, add, regroup, rephoto, reprops, rebio };
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "1 new spelling, 1 starting tribe, 2 new, 1 not listed" (the Inbox's and the season row's words). */
export function changesLine(changes: CastChange[], words: { group: string; groups: string } = { group: "group", groups: "groups" }): string {
  const n = (k: CastChange["k"]) => changes.filter((c) => c.k === k).length;
  return [
    n("spell") && count(n("spell"), "new spelling", "new spellings"),
    n("group") && count(n("group"), `starting ${words.group}`, `starting ${words.groups}`),
    n("add") && `${n("add")} new`,
    n("photo") && count(n("photo"), "photo", "photos"),
    n("props") && count(n("props"), "person's details", "people's details"),
    n("bio") && count(n("bio"), "bio", "bios"),
    n("gone") && `${n("gone")} not listed`,
  ]
    .filter(Boolean)
    .join(", ");
}
