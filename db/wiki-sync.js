// What's left of the wiki connector (docs/PLAN-desk-parity.md, decision 9 and step 8, part 8b): the app no longer reads a wiki.
// Its nightly read (`all`, runForSeason, runForLeague, the MediaWiki fetches, the section parsing and the Claude extraction) and its
// .github/workflows/wiki-sync.yml are gone; casts come from our bot or a paste (the desk's Cast) and photos from TMDB and TVmaze.
//
// What stays is what the rest of the app, the tests and the tapes recorder call (scripts/dev-test/tapes.js), with the same names
// and shapes:
//   termsFor          the show's own words for its people and groups, in every form a prompt or a message needs (episode
//                     research, the checklist, the tests)
//   stageSeasonCast   stages a cast into season_cast for review (the tapes recorder stages a pasted cast with it)
//   validateCast      what stageSeasonCast checks a cast with
//   validateEpisodes  the per-episode check the formats' regression harness runs (tests/harness/format-regression.js)
//   normalizePhotoUrl, plural, singular
//
// Plain CommonJS under bare `node`, like the rest of db/: nothing here may import anything Next-specific.

// The game-logic engine, so a check resolves names with the EXACT rule apply-time uses (Core.findCastawayByName).
const StateLogic = require("../src/lib/game/state-logic.js");

// Fandom's imageinfo hands back the REVISION form of a file URL:
//
//   https://static.wikia.nocookie.net/survivor/images/5/57/S51_aaliyah_t.png/revision/latest?cb=20260904163427
//
// which doesn't load from another site -- an <img> pointing at it fails, and every imported castaway
// shows initials instead of a photo. The canonical path above it, the same URL up to the extension,
// always loads. So the suffix is cut here, at the one place wiki file URLs enter this app, rather
// than left for each consumer to deal with.
//
// The same rule is applied again in src/lib/game/selectors.ts's castawayPhotoSrc, for a URL somebody
// pastes into League Settings' Photo URL field by hand -- copying an image address off a Fandom page
// gives you exactly this form. Two small copies rather than a shared module, because state-logic and
// its selectors deliberately have no dependency on anything under db/.
function normalizePhotoUrl(url) {
  const raw = String(url == null ? "" : url).trim();
  if (!raw) return null;
  const cut = raw.indexOf("/revision/");
  return cut === -1 ? raw : raw.slice(0, cut);
}

// Just enough English to get a singular and a plural out of whatever term an admin typed --
// including a term typed already-plural ("Contestants"), which a naive pluralizer turns into
// "Contestantses". Mirrors plural()/singular() in src/lib/use-show-terms.ts; duplicated rather than
// shared because this is a standalone CommonJS CLI with no access to the Next/TS build.
const LOOKS_PLURAL = /[^sciux]s$/i;

function plural(word) {
  if (!word) return word;
  if (LOOKS_PLURAL.test(word)) return word;
  if (/(s|x|z|ch|sh)$/i.test(word)) return word + 'es';
  if (/[^aeiou]y$/i.test(word)) return word.slice(0, -1) + 'ies';
  return word + 's';
}

function singular(word) {
  if (!word) return word;
  if (/ies$/i.test(word)) return word.slice(0, -3) + 'y';
  if (LOOKS_PLURAL.test(word)) return word.slice(0, -1);
  return word;
}

// The show's own vocabulary, in every form the prompts and messages need. Normalized to singular
// first so a term entered either way ("Castaway" or "Castaways") yields the same set. Its own
// function so callers holding only a catalog row can get the terms WITHOUT resolving a season
// context, which would fetch the wiki.
function termsFor(entry) {
  const castawayTerm = singular(((entry && entry.castaway_term) || "Castaway").trim());
  const tribeTerm = singular(((entry && entry.tribe_term) || "Tribe").trim());
  return {
    castawayTerm,
    tribeTerm,
    terms: {
      Castaway: castawayTerm,
      Castaways: plural(castawayTerm),
      castaway: castawayTerm.toLowerCase(),
      castaways: plural(castawayTerm).toLowerCase(),
      Tribe: tribeTerm,
      Tribes: plural(tribeTerm),
      tribe: tribeTerm.toLowerCase(),
      tribes: plural(tribeTerm).toLowerCase(),
    },
  };
}

// ---------- validation ----------
// The schema guarantees SHAPE; this guards CONTENT. An LLM extraction is the one input to this app
// that can be confidently wrong, so a proposal only gets filed if it survives all of this -- and a
// failure rejects the whole run rather than filing a partially-trusted proposal for someone to
// rubber-stamp.
function validateCast(cast, state, terms) {
  const problems = [];
  const tribeNames = (cast.tribes || []).map((t) => (t.name || "").trim()).filter(Boolean);
  // A note, not a refusal. This used to be fatal, on the assumption that every show divides its cast
  // into groups -- true of Survivor, not true in general, and refusing the whole run leaves the
  // commissioner with nothing to look at instead of a cast list with no groupings. Nothing is applied
  // without their confirmation anyway, which is where a genuinely wrong extraction gets caught.
  if (!tribeNames.length) problems.push(`no ${terms.tribes} extracted`);
  if (new Set(tribeNames.map((n) => n.toLowerCase())).size !== tribeNames.length) {
    problems.push(`duplicate ${terms.tribe} names`);
  }

  const seen = new Set();
  const castaways = [];
  for (const c of cast.castaways || []) {
    const name = (c.name || "").trim();
    if (!name) { problems.push(`a ${terms.castaway} row had no name`); continue; }
    // Wiki names are people's names -- anything wild here means the extraction went off the rails.
    if (name.length > 60) { problems.push(`implausible ${terms.castaway} name: "${name.slice(0, 40)}..."`); continue; }
    const key = name.toLowerCase();
    if (seen.has(key)) { problems.push(`duplicate ${terms.castaway}: ${name}`); continue; }
    seen.add(key);

    let tribeName = c.tribeName ? String(c.tribeName).trim() : null;
    // A tribe the model named but the tribe list doesn't contain is exactly the kind of quiet
    // invention worth dropping: keep the castaway, drop the unbacked tribe link.
    if (tribeName && !tribeNames.some((t) => t.toLowerCase() === tribeName.toLowerCase())) {
      problems.push(`${terms.castaway} "${name}" referenced unknown ${terms.tribe} "${tribeName}" (link dropped)`);
      tribeName = null;
    }
    castaways.push({ name, tribeName, photoFile: c.photoFile ? String(c.photoFile).trim() : null });
  }

  if (castaways.length < 4) problems.push(`only ${castaways.length} ${terms.castaways} extracted -- too few to be a real season`);
  if (castaways.length > 40) problems.push(`${castaways.length} ${terms.castaways} extracted -- more than any real season`);

  // How much of this is actually new is the commissioner's main question, so compute it here rather
  // than making them diff two lists by eye.
  const existing = new Set(state.castaways.map((c) => c.name.trim().toLowerCase()));
  const newCastaways = castaways.filter((c) => !existing.has(c.name.toLowerCase()));

  // Notes vs. refusals: an unbacked grouping that got dropped, and a show with no groupings at all,
  // are both things a commissioner can see and judge for themselves in the review UI. Anything
  // structural -- a missing name, a duplicate, an implausible count -- refuses the run.
  const fatal = problems.filter((p) => !p.includes("(link dropped)") && !p.startsWith("no "));
  return { tribes: tribeNames.map((name) => ({ name })), castaways, newCount: newCastaways.length, problems, fatal };
}

// Same job as validateCast, for the per-episode extraction: the schema guarantees SHAPE, this guards
// CONTENT. There's more to guard here, because this extraction is inference over rowspan-heavy tables
// and footnote markers rather than a read off one well-formed table.
//
// Splits into two payloads rather than one, because the two halves don't deserve the same trust and a
// commissioner should be able to take eliminations without taking the event guesses. Each gets filed
// as its own proposal kind.
//
// Every name is resolved against THIS LEAGUE'S cast here, at extraction time, so a proposal that
// can't be applied never gets filed. Names (not ids) are what's stored, and apply resolves again --
// see applyEliminationsImport's comment for why.
function validateEpisodes(extracted, state, terms, format) {
  const problems = [];
  const fatal = [];
  // Names the wiki used that this league's cast doesn't have. Non-fatal (see resolve below) but
  // surfaced on its own, because a name dropped here is a result that will never be reviewed.
  const unmatched = [];
  // Results thrown out by the checks below (a zero-votes-safe for someone voted out that episode, an
  // individual immunity in a pre-merge episode, a duplicate). Each is a defensible refusal, but they
  // used to exist only as a console line -- so a castaway whose ONLY result was dropped vanished
  // from the review list with nothing said, and the commissioner had no way to know a name was
  // missing. Carried out of here so the reveal can say who and why.
  const dropped = [];
  const seenEpisodes = new Set();
  const eliminated = new Set(); // castaway ids claimed by an elimination in THIS proposal
  const epsOut = [];
  const eventsOut = [];
  let eventCount = 0;
  let lowConfidence = 0;
  // Subsets of `problems` worth surfacing on their own proposal (eliminations vs. scoringEvents),
  // since the two get reviewed separately -- `problems` itself still gets everything, for the
  // console log.
  const elimProblems = [];
  const eventProblems = [];

  // Resolves one wiki name, recording why it failed. Ambiguity is a refusal, not a coin flip: the
  // wiki prints short names in these tables, and two castaways can share one.
  //
  // A name that doesn't resolve is NOT fatal any more, and that's the important change. It used to
  // fail the entire run -- so one inferred zero-votes-safe naming somebody the extraction spelled
  // differently threw away that episode's eliminations too, and the commissioner got
  // "failed validation, nothing filed" with nothing they could act on. Now the decision that
  // couldn't be resolved is dropped and named, and everything that DID resolve still gets filed.
  // Unresolved names are collected separately from ordinary notes so callers can say so loudly:
  // a dropped elimination is a hole in the season, not a nit.
  const resolve = (name, where) => {
    const { castaway, ambiguous } = StateLogic.Core.findCastawayByName(state, name);
    if (castaway) return castaway;
    const why = ambiguous
      ? `"${name}" (${where}) matches more than one ${terms.castaway}: ${ambiguous.join(", ")}`
      : `"${name}" (${where}) doesn't match any ${terms.castaway} in this league`;
    unmatched.push(why);
    problems.push(why);
    return null;
  };

  // Whether two of the read's names are the same person -- the vote grid and the cast table spell
  // people differently, so this compares who they resolve to, not the strings.
  const personKey = (name) => {
    const { castaway } = StateLogic.Core.findCastawayByName(state, name);
    return castaway ? castaway.id : String(name || "").trim().toLowerCase();
  };
  const same = (a, b) => personKey(a) === personKey(b);

  const merge = extracted.mergeEpisode;
  if (merge !== null && merge !== undefined && (!Number.isInteger(merge) || merge < 1)) {
    problems.push(`implausible merge episode ${merge} (ignored)`);
  }

  for (const ep of extracted.episodes || []) {
    const n = ep && ep.number;
    if (!Number.isInteger(n) || n < 1 || n > 60) {
      fatal.push(`implausible episode number ${JSON.stringify(n)}`);
      continue;
    }
    if (seenEpisodes.has(n)) {
      fatal.push(`episode ${n} appears twice`);
      continue;
    }
    seenEpisodes.add(n);

    // postMerge is cross-checked against mergeEpisode rather than taken on trust, since they come
    // from the same read and disagreeing with itself is a sign the grid was misread.
    let postMerge = !!ep.postMerge;
    if (Number.isInteger(merge) && merge >= 1) {
      const expected = n >= merge;
      if (expected !== postMerge) {
        problems.push(`episode ${n} said postMerge=${postMerge} but the merge is episode ${merge} -- using ${expected}`);
        postMerge = expected;
      }
    }

    const elims = [];
    for (const el of ep.eliminations || []) {
      const c = resolve(el && el.name, `episode ${n} elimination`);
      if (!c) continue;
      // The same person leaving twice is nonsense, and it would corrupt placement order -- almost
      // always the sign of a misread rowspan attributing one real elimination to two episode
      // numbers, rather than two genuine exits. NOT fatal to the whole run, on the same reasoning as
      // an unresolved name above: this episode's other, cleanly-read eliminations are still real and
      // still worth filing. The second (later) sighting is the one dropped, since the earlier episode
      // number is more likely the correct one in a misread rowspan.
      if (eliminated.has(c.id)) {
        const msg = `${c.name} is eliminated more than once (episode ${n}) -- kept the earlier one, dropped this one`;
        problems.push(msg); elimProblems.push(msg);
        dropped.push({ name: c.name, episode: n, why: "already recorded as eliminated in an earlier episode -- likely a misread rowspan" });
        continue;
      }
      eliminated.add(c.id);
      elims.push({ name: c.name, method: el.method });
    }
    // Double boots are real but rare and always explicit -- more than one is exactly the shape a
    // misread rowspan/vote-count cell would produce (see extractEpisodes' prompt), so it's surfaced
    // as a note for the commissioner rather than silently trusted like a single elimination is.
    // A finale legitimately has several (runners-up, fire-making, the winner), so it isn't flagged.
    const finale = elims.some((e) => e.method === format.winnerExitMethod);
    if (!finale && elims.length > (format.wiki.routineEliminations || 1)) {
      const msg = `episode ${n} has ${elims.length} eliminations (${elims.map((e) => e.name).join(", ")}) -- double-check this against the source before applying`;
      problems.push(msg);
      elimProblems.push(msg);
    }

    // Informational only -- never applied to league state (applyEliminationsImport only reads
    // .eliminations/.title/.airDate off each episode). Exists purely so the model has a valid slot
    // for an Exile Island-style twist instead of it getting swept into eliminations by mistake.
    const exiledOut = [];
    for (const ex of ep.exiled || []) {
      const { castaway, ambiguous } = StateLogic.Core.findCastawayByName(state, ex && ex.name);
      if (castaway) exiledOut.push(castaway.name);
      else {
        const msg = `"${ex && ex.name}" (episode ${n} exiled) ${ambiguous ? `matches more than one ${terms.castaway}` : `doesn't match any ${terms.castaway} in this league`} -- dropped`;
        problems.push(msg);
        elimProblems.push(msg);
      }
    }

    // The read's own events, plus any the format works out from the rest of it (The Traitors: Round
    // Table outcomes from the recorded votes), all held to the same checks below.
    const derived = format.wiki.derivedEvents ? format.wiki.derivedEvents(ep, extracted, same) : [];
    const evs = [];
    for (const sev of [...(ep.events || []), ...derived]) {
      const c = resolve(sev && sev.name, `episode ${n} ${sev && sev.type}`);
      if (!c) continue;
      // The format's own sanity checks (Survivor: no zero-votes-safe for someone voted out that
      // episode, no individual immunity before the merge).
      const rejected = format.wiki.rejectEvent({ type: sev.type, name: c.name, episode: n, eliminated: eliminated.has(c.id), postMerge });
      if (rejected) {
        problems.push(rejected.problem); eventProblems.push(rejected.problem);
        dropped.push({ name: c.name, episode: n, why: rejected.why });
        continue;
      }
      const key = `${n}|${sev.type}|${c.id}`;
      if (evs.some((x) => `${n}|${x.type}|${x.castawayKey}` === key)) {
        const msg = `duplicate ${sev.type} for ${c.name} in episode ${n} (kept once)`;
        problems.push(msg); eventProblems.push(msg);
        dropped.push({ name: c.name, episode: n, why: `the same ${sev.type} was reported twice (kept once)` });
        continue;
      }
      const confidence = sev.confidence === "high" ? "high" : "low";
      if (confidence === "low") lowConfidence++;
      evs.push({ name: c.name, type: sev.type, confidence, castawayKey: c.id });
      eventCount++;
    }

    if (elims.length || exiledOut.length) {
      epsOut.push({
        number: n, postMerge, title: ep.title || null, airDate: ep.airDate || null,
        eliminations: elims, ...(exiledOut.length ? { exiled: exiledOut } : {})
      });
    }
    if (evs.length) {
      eventsOut.push({
        number: n,
        postMerge,
        events: evs.map(({ name, type, confidence }) => ({ name, type, confidence })),
      });
    }
  }

  // Tribe/team changes (swaps, merges, new teams, weekly pairs, playing alone). Someone already out in
  // an EARLIER episode can't move, which is the likeliest misread (a row's later colour cells); moving
  // and leaving in the same episode is real (the first boot after a merge). A pair is named both ways
  // round by its two members, so it's put in one order here to make them the same group.
  const exitEpisode = new Map();
  for (const ep of extracted.episodes || []) {
    for (const el of ep.eliminations || []) {
      const { castaway } = StateLogic.Core.findCastawayByName(state, el && el.name);
      if (castaway && !(exitEpisode.get(castaway.id) <= ep.number)) exitEpisode.set(castaway.id, ep.number);
    }
  }
  const groupLabel = (g) => {
    const label = String(g == null ? "" : g).trim();
    return label.includes(" & ") ? label.split("&").map((s) => s.trim()).filter(Boolean).sort().join(" & ") : label;
  };
  const groupsOut = [];
  for (const ep of extracted.episodes || []) {
    const n = ep && ep.number;
    if (!Number.isInteger(n)) continue;
    for (const gc of ep.groupChanges || []) {
      const c = resolve(gc && gc.name, `episode ${n} group change`);
      if (!c) continue;
      if (exitEpisode.has(c.id) && exitEpisode.get(c.id) < n) {
        const msg = `dropped ${c.name}'s move to ${groupLabel(gc.group) || "no group"} in episode ${n} -- they left in episode ${exitEpisode.get(c.id)}`;
        problems.push(msg); elimProblems.push(msg);
        continue;
      }
      if (groupsOut.some((x) => x.episode === n && x.castawayKey === c.id)) continue;
      groupsOut.push({ episode: n, name: c.name, group: groupLabel(gc.group), castawayKey: c.id });
    }
  }

  // Secret roles (The Traitors), resolved like everything else. One per person: the earliest wins,
  // since a role once taken holds until another decision says otherwise.
  const rolesOut = [];
  const roleClaims = format.wiki.roles ? format.wiki.roles(extracted) : [];
  for (const r of [...roleClaims].sort((a, b) => a.episode - b.episode)) {
    if (!Number.isInteger(r.episode) || r.episode < 1) continue;
    const c = resolve(r.name, `episode ${r.episode} ${r.role}`);
    if (!c) continue;
    if (rolesOut.some((x) => x.castawayKey === c.id)) {
      const msg = `${c.name} is listed as ${r.role} more than once (kept episode ${rolesOut.find((x) => x.castawayKey === c.id).episode})`;
      problems.push(msg); elimProblems.push(msg);
      continue;
    }
    rolesOut.push({ episode: r.episode, name: c.name, role: r.role, castawayKey: c.id });
  }

  if (!epsOut.length && !eventsOut.length && !rolesOut.length && !groupsOut.length && !unmatched.length) fatal.push("nothing extracted at all");

  // How much of this is new is the commissioner's actual question, so compute it rather than making
  // them diff by eye.
  let newEliminations = 0;
  for (const ep of epsOut) {
    for (const el of ep.eliminations) {
      const { castaway } = StateLogic.Core.findCastawayByName(state, el.name);
      if (castaway && castaway.status !== "eliminated") newEliminations++;
    }
  }

  return {
    unmatched,
    dropped,
    eliminations: { episodes: epsOut, mergeEpisode: Number.isInteger(merge) ? merge : null, problems: elimProblems },
    scoringEvents: { episodes: eventsOut, mergeEpisode: Number.isInteger(merge) ? merge : null, problems: eventProblems },
    roles: rolesOut.map(({ episode, name, role }) => ({ episode, name, role })),
    groups: groupsOut.map(({ episode, name, group }) => ({ episode, name, group })),
    counts: {
      episodes: seenEpisodes.size,
      eliminations: epsOut.reduce((a, e) => a + e.eliminations.length, 0),
      newEliminations,
      events: eventCount,
      lowConfidence,
    },
    problems,
    fatal,
  };
}

// SEASON-scoped half for the cast: stage what the model extracted into `season_cast` for an admin
// to review and approve (db/migrations/0011). Unlike episodes, this fans out to NOBODY -- a cast is
// a fact about the show, identical for every league playing the season, so it's reviewed once by
// the person who catalogued the season rather than once per commissioner. Sending it to its games (the
// desk's Cast) is what puts castaways into leagues.
//
// Staging is ADDITIVE and never overwrites a row that's already there. That's what makes a re-pull
// safe: an admin who cleared the tribes (so a catching-up league can't see the starting division)
// or corrected a name doesn't lose that work when the connector reads the page again. New people --
// a late replacement, a row the first extraction missed -- are inserted, and their arrival un-
// approves the season, because a cast that changed since it was last looked at needs looking at.
async function stageSeasonCast(pool, ctx, extraction, opts = {}) {
  const { photos = {}, ...cast } = extraction.payload;
  const { terms, season, showSlug } = ctx;
  // Validated against an EMPTY league state: this is the season's cast, not any league's, so the
  // "how many of these are new to you" half of validateCast has nothing to compare against here.
  const checked = validateCast(cast, { castaways: [] }, terms);
  checked.problems.forEach((p) => console.log(`[wiki-sync]   note: ${p}`));
  if (checked.fatal.length) {
    throw new Error(`failed validation, nothing staged:\n    - ${checked.fatal.join("\n    - ")}`);
  }

  // The order an admin reviews in, and the order leagues receive: grouped by starting tribe in the
  // order the wiki's table introduced them, then alphabetically. NOT the table's own row order,
  // which on most season pages is FINISH order -- first boot at the top, winner at the bottom -- and
  // would hand every league the season's placement order in the cast list itself.
  const tribeRank = new Map(checked.tribes.map((t, i) => [t.name.toLowerCase(), i]));
  const ordered = [...checked.castaways].sort((a, b) => {
    const ra = a.tribeName ? tribeRank.get(a.tribeName.toLowerCase()) ?? checked.tribes.length : checked.tribes.length;
    const rb = b.tribeName ? tribeRank.get(b.tribeName.toLowerCase()) ?? checked.tribes.length : checked.tribes.length;
    return ra - rb || a.name.localeCompare(b.name);
  });

  const { rows: seasonRows } = await pool.query(
    `SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id
      WHERE s.slug = $1 AND ss.season_number = $2`,
    [showSlug, season]
  );
  if (!seasonRows.length) {
    // A league can track a season nobody catalogued (the free-text season field), and the connector
    // will happily read it -- but there's no row to hang a reviewable cast off, so say which one to
    // add rather than failing obscurely.
    throw new Error(
      `${showSlug} season ${season} isn't in the catalog, so there's nowhere to stage its cast. ` +
        `Add the season on the desk first.`
    );
  }
  const seasonId = seasonRows[0].id;

  if (opts.dry) {
    console.log(`[wiki-sync]   --dry: would stage ${ordered.length} ${terms.castaways} for review`);
    return { filed: false, staged: 0, total: ordered.length, summary: `${ordered.length} ${terms.castaways} — dry run, nothing staged` };
  }

  let added = 0;
  for (let i = 0; i < ordered.length; i++) {
    const c = ordered[i];
    // COALESCE, not EXCLUDED: a value already on the row wins, so an admin's correction survives a
    // re-pull -- but a BLANK one gets filled in. That second half is the recovery path for a season
    // whose tribes were wiped by 0011's old "clear all tribes" button, and for a first pull that ran
    // before the wiki listed tribes at all.
    const { rows: upserted } = await pool.query(
      `INSERT INTO season_cast (season_id, name, tribe_name, photo_url, sort_order)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (season_id, lower(name)) DO UPDATE
          SET tribe_name = COALESCE(season_cast.tribe_name, EXCLUDED.tribe_name),
              photo_url  = COALESCE(season_cast.photo_url,  EXCLUDED.photo_url)
       RETURNING (xmax = 0) AS inserted`,
      [seasonId, c.name, c.tribeName, normalizePhotoUrl(c.photoFile && photos[c.photoFile]), i]
    );
    if (upserted[0] && upserted[0].inserted) added += 1;
  }
  // Only a change re-opens the review. An unchanged re-pull of an already-approved season leaves it
  // approved, so the nightly job can't quietly withdraw a cast leagues are already playing with.
  if (added) {
    await pool.query("UPDATE show_seasons SET cast_approved_at=NULL, cast_approved_by=NULL, updated_at=now() WHERE id=$1", [seasonId]);
  }
  const { rows: totalRows } = await pool.query("SELECT count(*)::int AS n FROM season_cast WHERE season_id=$1", [seasonId]);
  const total = totalRows[0].n;
  const summary =
    `${total} ${terms.castaways} staged for review` +
    (added ? ` (${added} new — needs sending to its games from the desk's Cast)` : " (nothing new; approval unchanged)");
  console.log(`[wiki-sync]   ${summary}`);
  return { filed: added > 0, staged: added, total, seasonId, summary };
}

module.exports = {
  stageSeasonCast,
  plural,
  singular,
  termsFor,
  validateCast,
  validateEpisodes,
  normalizePhotoUrl,
};
