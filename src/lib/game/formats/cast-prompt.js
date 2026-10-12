// The copy/paste research prompt for a season's CAST (docs/PLAN-cast-import-prompt.md): names, photos,
// starting groups and -- only for a format with secret roles -- starting roles, for a show the wiki
// connector can't reach. Same shape as proposal.js's "Research a new show" loop: build a prompt, paste
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

/** The prompt to paste into any web-searching chat. */
function buildCastPrompt(format, { seasonName, showName } = {}) {
  const person = text(format && format.terms && format.terms.castaway) || 'Castaway';
  const group = text(format && format.terms && format.terms.tribe) || 'Tribe';
  const season = text(seasonName) || 'the current season';
  const show = text(showName) || text(format && format.name) || 'the show';
  const hasGroups = !!(format && format.hasGroups);
  const roles = roleChoices(format);

  const row = {
    name: 'Full name, as the show credits them',
    photoUrl: 'A direct image file URL (official cast photo, press kit, or the show\'s own site). An empty string "" if you can\'t find one -- never a page URL, never a guess.',
  };
  if (hasGroups) row.startingGroup = `Their starting ${group.toLowerCase()} at the very start of the season, exactly as the show names it`;
  if (roles.length) row.startingRole = `Their role at the start of the season: exactly one of ${roles.map((r) => `"${r}"`).join(', ')}`;
  const shape = { castaways: [row], sources: ['Every URL you actually read'] };

  const lines = [
    `List the full starting cast of ${season} of "${show}" -- every ${person.toLowerCase()} who began the season.`,
    '',
    'RULES',
    '  - Search for and read the official cast announcement, the show\'s own site and a fan wiki. Name every page you',
    '    actually read in sources.',
    '  - One row per person. Use their full name as the show credits them.',
    '  - photoUrl must be a URL that ends in an image file (.jpg, .png, .webp...) you actually found. Leave it "" rather',
    '    than invent one.',
    hasGroups ? `  - startingGroup is the ${group.toLowerCase()} they STARTED in, not where they ended up.` : null,
    roles.length
      ? `  - startingRole is a hidden role. Only give "${roles.slice(1).join('" or "')}" for someone the show or its coverage has confirmed; everyone else is "${roles[0]}".`
      : null,
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
 *   { castaways: [{ name, photoUrl, startingGroup?, startingRole?, problems }], repairs, sources }
 * where `startingGroup` only exists when the format has groups and `startingRole` only when it has
 * roles, and a row's `problems` say why it won't be imported (it's kept so the review can show it).
 * A role that isn't one of the format's values is dropped with a repair note, never kept as written.
 */
function parseCastImport(raw, format) {
  const answer = readAnswer(raw);
  const hasGroups = !!(format && format.hasGroups);
  const roles = roleChoices(format);
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
    castaways: rows.map((c) => ({ name: c.name, photoUrl: text(c.photoUrl), tribeName: text(c.startingGroup) || null })),
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

module.exports = { buildCastPrompt, parseCastImport, toCastImport, toCastRoles, roleChoices };
