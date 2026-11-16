// The copy/paste research prompt for a season's CAST (docs/PLAN-cast-import-prompt.md): names, photos,
// starting groups and -- only for a format with secret roles -- starting roles, for a show the wiki
// connector can't reach. Since cast properties (docs/PLAN-cast-properties.md, chunk 2) it also asks each property the
// rulebook declares (format.properties: a department, a job, veteran or rookie) and each person's bio as the show bills
// it (hometown, age, occupation, a line), both only as stated, never guessed. Same shape as proposal.js's "Research a new show" loop: build a prompt, paste
// the chat's JSON back, repair what can be repaired out loud, keep a bad row with a reason rather than
// failing the batch.
//
// Applying is NOT done here. The parsed result splits into what StateLogic.applyCastImport (people,
// photos, groups) and StateLogic.applyCastRoles (roles) already take -- in that order, since roles
// match castaways by name and the first call is what creates them.
//
// Plain CommonJS with no dependencies, so it runs in the browser (the review screen) and the route alike.

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v) => (typeof v === 'string' ? v.trim() : '');
const list = (v) => (Array.isArray(v) ? v : []);
const sameName = (a, b) => text(a).toLowerCase() === text(b).toLowerCase();

// Every value a starting role can take: the default (no fact recorded) first, then the format's own.
function roleChoices(format) {
  return format && format.roles ? [format.roles.default, ...format.roles.values] : [];
}

// The rulebook's cast properties the prompt asks (format.properties), each with a key and a name.
function propertiesOf(format) {
  return list(format && format.properties).filter((p) => isObj(p) && text(p.key) && text(p.name));
}

// A bio's fields, as the show bills them: each field's words for the prompt, and how long it may be.
const BIO = [
  ['hometown', 'Their hometown as billed ("Ocean City, NJ"), "" if not stated', 80],
  ['residence', 'Where they live now, only when billed apart from the hometown, else ""', 80],
  ['age', 'Their age as billed at the premiere, a whole number, or null if not stated', 0],
  ['occupation', 'Their occupation or job outside the show as billed, "" if not stated', 80],
  ['line', 'One line describing them, in the billing\'s own words where there is one, "" if none', 200],
  ['source', 'The URL of the page their bio came from, "" if none', 500],
];
const BIO_KEYS = BIO.map((b) => b[0]);
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** A bio as answered -> { hometown?, residence?, age?, occupation?, line?, source? } with only what's stated, or null. */
function cleanBio(raw, repairs, at) {
  if (!isObj(raw)) return null;
  const out = {};
  for (const [k, , max] of BIO) {
    const v = raw[k];
    if (k === 'age') {
      const n = typeof v === 'number' ? v : /^\s*\d{1,3}\s*$/.test(String(v ?? '')) ? Number(v) : NaN;
      if (Number.isInteger(n) && n >= 5 && n <= 110) out.age = n;
      else if (v !== null && v !== undefined && text(String(v))) repairs.push({ at, message: `Dropped the age "${v}" -- not a whole number of years.` });
      continue;
    }
    const s = text(v).replace(/\s+/g, ' ');
    if (!s || /^(not stated|unknown|n\/a|none)$/i.test(s)) continue;
    if (k === 'source' && !/^https?:\/\//i.test(s)) {
      repairs.push({ at, message: `Dropped the bio's source "${s}" -- it isn't a web address.` });
      continue;
    }
    out[k] = clip(s, max);
  }
  return Object.keys(out).filter((k) => k !== 'source').length ? out : null;
}

/** Each declared property's value as answered -> { key: value }: a listed one matched to its own spelling (else dropped, said),
 *  free text trimmed; "" and "not stated" left out. */
function cleanProps(raw, props, repairs, at) {
  const out = {};
  if (!isObj(raw)) return out;
  for (const p of props) {
    const given = raw[p.key] !== undefined ? raw[p.key] : Object.entries(raw).find(([k]) => sameName(k, p.name))?.[1];
    const s = text(typeof given === 'number' ? String(given) : given).replace(/\s+/g, ' ');
    if (!s || /^(not stated|unknown|n\/a|none)$/i.test(s)) continue;
    if (Array.isArray(p.values)) {
      const match = p.values.find((v) => sameName(v, s)) || (p.key === 'gender' ? GENDER_WORDS[s.toLowerCase()] : undefined);
      if (match) out[p.key] = match;
      else repairs.push({ at, message: `Dropped ${p.name} "${s}" -- not one of ${p.values.join(', ')}.` });
    } else out[p.key] = clip(s, 60);
  }
  // Where the gender came from: the show's billing, or the research's inference (anything else read as inferred).
  if (out.gender) out.genderFrom = text(raw.genderFrom).toLowerCase() === 'billed' ? 'billed' : 'inferred';
  return out;
}
const GENDER_WORDS = { male: 'Man', female: 'Woman', men: 'Man', women: 'Woman', m: 'Man', f: 'Woman', he: 'Man', she: 'Woman', 'non-binary': 'Nonbinary', nb: 'Nonbinary' };

/** The prompt to paste into any web-searching chat. */
function buildCastPrompt(format, { seasonName, showName, year, known } = {}) {
  const person = text(format && format.terms && format.terms.castaway) || 'Castaway';
  const group = text(format && format.terms && format.terms.tribe) || 'Tribe';
  const season = text(seasonName) || 'the current season';
  const show = text(showName) || text(format && format.name) || 'the show';
  const hasGroups = !!(format && format.hasGroups);
  const roles = roleChoices(format);

  const row = {
    name: 'Full name, as the show credits them',
    photoUrl: 'A direct image file URL of their official cast photo for THIS season, from the same page as everyone else\'s. An empty string "" if that page has none -- never a page URL, never a guess.',
  };
  if (hasGroups) row.startingGroup = `Their starting ${group.toLowerCase()} at the very start of the season, exactly as the show names it`;
  if (roles.length) row.startingRole = `Their role at the start of the season: exactly one of ${roles.map((r) => `"${r}"`).join(', ')}`;
  const props = propertiesOf(format);
  if (props.length) {
    row.properties = Object.fromEntries(
      props.map((p) => [
        p.key,
        p.key === 'gender'
          ? `Their gender: exactly one of ${p.values.map((v) => `"${v}"`).join(', ')}. As the show bills them (the network's bio calls them he or she, a men's or women's split) wherever it says; else your best inference from their name and photo`
          : Array.isArray(p.values)
          ? `Their ${p.name.toLowerCase()} at the start of the season: exactly one of ${p.values.map((v) => `"${v}"`).join(', ')}, or "" if not stated`
          : `Their ${p.name.toLowerCase()} at the start of the season, in the show's own words${p.of ? ` (inside their ${(props.find((x) => x.key === p.of) || { name: p.of }).name.toLowerCase()})` : ''}, or "" if not stated`,
      ])
    );
    if (props.some((p) => p.key === 'gender')) row.properties.genderFrom = '"billed" when the show\'s own billing says their gender, "inferred" when you inferred it';
  }
  row.bio = Object.fromEntries(BIO.map(([k, words]) => [k, words]));
  const shape = { castaways: [row], sources: ['Every URL you actually read'] };

  // Who the TV listings credit in this season (show-art.ts castAnchor): a season named like an older one is still this one.
  const credited = Array.isArray(known) ? known.map(text).filter(Boolean).slice(0, 60) : [];
  const lines = [
    `List the full starting cast of ${season} of "${show}"${year ? `, the season that premiered in ${year}` : ''} -- every ${person.toLowerCase()} who began the season.`,
    '',
    'RULES',
    credited.length
      ? `  - The TV listings credit these people in this season (some may only have appeared in it): ${credited.join(', ')}. Your list must be this season's, so most of its people are among these; an older season with the same name is a different cast.`
      : year
        ? `  - Make sure it's the season that premiered in ${year}: an older season with the same name is a different cast.`
        : null,
    `  - Take the names from a reputable wiki: the Wikipedia article for this season of "${show}" (its cast or crew`,
    '    section), else the show\'s own fan wiki\'s page for the season. Read it, and list exactly the people it credits as',
    '    this season\'s cast: nobody from an earlier season who isn\'t in it, however well known. Check against the official',
    '    cast announcement or the show\'s own site if you like. Name every page you actually read in sources.',
    '  - One row per person. Use their full name as the show credits them.',
    `  - The photos must match: all from ONE page of this season\'s official cast photos (the network\'s or the show\'s`,
    `    "meet the cast" page for ${season}, else the wiki\'s page for it). Never a photo from an earlier season, however`,
    '    familiar the person. photoUrl must be a URL that ends in an image file (.jpg, .png, .webp...) you actually found',
    '    on that page. Leave it "" when the page has none for them: the TV listings fill those in.',
    hasGroups ? `  - startingGroup is the ${group.toLowerCase()} they STARTED in, not where they ended up.` : null,
    roles.length
      ? `  - startingRole is a hidden role. Only give "${roles.slice(1).join('" or "')}" for someone the show or its coverage has confirmed; everyone else is "${roles[0]}".`
      : null,
    props.length
      ? `  - properties are how the show itself sorts its ${person.toLowerCase()}s (${props.filter((p) => p.key !== 'gender').map((p) => p.name.toLowerCase()).join(', ') || 'none besides gender'}), as it bills them on screen or in its own cast announcements, at the START of the season. Never guess one from a name or a photo: "" when you haven't seen it stated. Gender is the one exception: give it for everyone, from the billing where it says, else inferred, and say which in genderFrom.`
      : null,
    '  - bio is who they are as the show bills them: the network\'s "meet the cast" page or the show\'s wiki. Only what that billing',
    '    says; never ethnicity, religion, sexuality or health, even where a page mentions them. "" (or null for age) when not stated.',
    '  - Don\'t guess. Leave a field "" (or the default) rather than fill it with something you haven\'t seen reported.',
    '',
    'Answer with ONE JSON object and nothing else, in this shape (the values describe what goes there):',
    '',
    JSON.stringify(shape, null, 1),
    '',
    'Paste the JSON back into Game Your Show\'s "Import a cast" box.',
  ];
  return lines.filter((l) => l !== null).join('\n');
}

/** A chat's answer (or an already-parsed object) -> the raw object. Chatter and code fences are fine. */
function readAnswer(raw) {
  if (isObj(raw)) return raw;
  const s = String(raw || '');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error("There's no JSON object in what was pasted.");
  let parsed;
  try {
    parsed = JSON.parse(s.slice(start, end + 1));
  } catch (e) {
    throw new Error(`The pasted JSON doesn't parse (${e.message}). Ask the chat to send it again as one JSON object.`);
  }
  if (!isObj(parsed)) throw new Error('The pasted JSON is not an object.');
  return parsed;
}

/**
 * Validates and repairs a cast answer against the league's format. Returns
 *   { castaways: [{ name, photoUrl, startingGroup?, startingRole?, props, bio, problems }], repairs, sources }
 * (props: each declared property's value, by key, only those stated; bio: what's billed, or null)
 * where `startingGroup` only exists when the format has groups and `startingRole` only when it has
 * roles, and a row's `problems` say why it won't be imported (it's kept so the review can show it).
 * A role that isn't one of the format's values is dropped with a repair note, never kept as written.
 */
function parseCastImport(raw, format) {
  const answer = readAnswer(raw);
  const hasGroups = !!(format && format.hasGroups);
  const roles = roleChoices(format);
  const props = propertiesOf(format);
  const repairs = [];
  const seen = [];

  const castaways = list(answer.castaways).map((r, i) => {
    const row = isObj(r) ? r : {};
    const name = text(row.name).replace(/\s+/g, ' ');
    const at = name ? `castaways[${name}]` : `castaways[${i}]`;
    const problems = [];
    if (!name) problems.push('No name');
    else if (seen.some((n) => sameName(n, name))) problems.push('Listed twice');
    if (name) seen.push(name);

    let photoUrl = text(row.photoUrl);
    if (photoUrl && !/^https?:\/\//i.test(photoUrl)) {
      repairs.push({ at, message: `Dropped the photo "${photoUrl}" -- it isn't a web address.` });
      photoUrl = '';
    }
    const out = { name, photoUrl };

    if (hasGroups) out.startingGroup = text(row.startingGroup);
    else if (text(row.startingGroup)) repairs.push({ at, message: 'Dropped the starting group -- this show has none.' });

    if (roles.length) {
      const given = text(row.startingRole);
      const match = roles.find((v) => sameName(v, given));
      if (given && !match) repairs.push({ at, message: `Dropped the role "${given}" -- not one of ${roles.join(', ')}.` });
      out.startingRole = match || roles[0];
    } else if (text(row.startingRole)) {
      repairs.push({ at, message: 'Dropped the role -- this show has no hidden roles.' });
    }

    out.props = cleanProps(row.properties, props, repairs, at);
    out.bio = cleanBio(row.bio, repairs, at);

    out.problems = problems;
    return out;
  });

  return { castaways, repairs, sources: list(answer.sources).map(text).filter(Boolean) };
}

/** The importable rows as StateLogic.applyCastImport's proposal: { tribes, castaways }. */
function toCastImport(parsed) {
  const rows = list(parsed && parsed.castaways).filter((c) => c && c.name && !(c.problems || []).length);
  const tribes = [];
  rows.forEach((c) => {
    const g = text(c.startingGroup);
    if (g && !tribes.some((t) => sameName(t.name, g))) tribes.push({ name: g });
  });
  return {
    tribes,
    castaways: rows.map((c) => ({ name: c.name, photoUrl: text(c.photoUrl), tribeName: text(c.startingGroup) || null, props: isObj(c.props) ? c.props : {}, bio: c.bio || null })),
  };
}

/** The importable rows' non-default roles as StateLogic.applyCastRoles' input: { castaways: [{ name, role }] }. */
function toCastRoles(parsed, format) {
  if (!format || !format.roles) return { castaways: [] };
  const rows = list(parsed && parsed.castaways).filter((c) => c && c.name && !(c.problems || []).length);
  return {
    castaways: rows
      .filter((c) => format.roles.values.includes(c.startingRole))
      .map((c) => ({ name: c.name, role: c.startingRole })),
  };
}

module.exports = { buildCastPrompt, parseCastImport, toCastImport, toCastRoles, roleChoices, cleanBio, cleanProps, BIO_KEYS };
