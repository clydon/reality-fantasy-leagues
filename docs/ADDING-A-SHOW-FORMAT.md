# Playbook: researching a new show for a format definition

Use this when adding a show that doesn't fit an existing format (`survivor` | `traitors` | `challenge`
| `generic`) — to decide whether it needs its own `src/lib/game/formats/<show>.js`, or fits an existing
one, and to work out what to extract before writing the format's catalog, wiki prompt, and research
checklist. See `docs/PLAN-show-formats.md` for what a format definition contains and the Traitors /
Challenge entries as worked examples.

## 1. Find the wiki and pull ground truth, not the live page

Prefer a fandom.com wiki (or similar MediaWiki site) with per-season pages. Pull two seasons before
writing anything:

- **One completed season** — this is what teaches you the real exit-method / placement taxonomy,
  because only a finished season shows every terminal state (Winner, runner-up equivalents,
  disqualifications, quits, etc.). A live season's cast table is mostly blank.
- **The live/target season** — to check the current season actually matches the completed one's shape
  (format and cast page layout can drift year to year).

Fetch via the MediaWiki API directly, not a browser-rendering fetch tool — `WebFetch` returned 402 in
this environment, but the API works fine over plain `curl`/`Bash` even from a local session that
otherwise can't browse:

```
https://<wiki>.fandom.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&titles=<Page_Title>
```

Page titles use underscores for spaces; URL-encode special characters (e.g. `&` → `%26`).

**Check for template transclusion before assuming the season page has the real tables.** Survivor
and Traitors put the actual tables on per-season `Template:` pages (`{{S44votetable}}`,
`{{US5 Contestant Info}}`), and the season page just holds the markers. The Challenge keeps its tables
inline. When researching by hand, grep the fetched wikitext for season-specific `{{...}}` markers and
fetch those template pages too, because that's where the data is. The connector already does this for
any show (`expandTranscludedTables` in `db/wiki-sync.js`: one level deep, only templates that contain a
table). So what a new format needs is the right **section headings** for its `voteSections` /
`guideSections`, not new fetching code.

## 2. Extract the exit-method / placement taxonomy

From the completed season's cast/contestant table, list every distinct value in the outcome column(s).
Look for:
- **Elimination-shaped events** — voted out, murdered, eliminated, disqualified, quit, medically
  removed, etc. Note the show's own vocabulary; don't rename it to another show's terms.
- **Non-elimination end states** — reaching the end without winning (Traitors: "Finalist", Challenge:
  "Runner-up"). These are placements, not eliminations, and need to be modeled separately from a
  generic "eliminated" bucket or the season-over detection will misfire.
- **The winner state**, and whether the show has more than one way to win (Traitors: Faithful winner
  vs. Traitor winner).

## 3. Look for hidden or secret roles/allegiances

Some shows assign a secret role or team affiliation that's revealed only when a person leaves or the
season ends (Traitors' Traitor/Faithful is the model case). Signs to look for:
- A column in the cast table that's visibly different from public knowledge (e.g. colored/labeled
  differently from the "at the time" status).
- Prose describing a twist where someone is secretly recruited, swapped, or reassigned mid-season.
- Whether the wiki tracks a *reveal episode* or *time of change* separately from the person's final
  status — if it does, the show's role assignment isn't fixed at the start, and the schema needs to
  support a role changing mid-season (see Traitors' `role_reveal_episode`), not just a static draft-time
  attribute.

If a show has this mechanic, decide with the user whether to track and score on it (as with Traitors)
or just record it as flavor data — this is a real design choice with fantasy-scoring implications, not
a purely technical one.

## 4. Check whether the game's rules are stable or vary by season

Some shows' rules are essentially fixed year to year (Traitors: Round Table, banishment, murder, same
shape every season). Others genuinely change (Challenge: team structures, partner mechanics, points
systems, elimination formats all vary season to season per that season's own `==Format==`-style prose
section). This determines the design of the extraction prompt:
- **Stable rules** → the format's wiki-extraction prompt and validation rules can be close to fixed
  code, tuned once against ground truth.
- **Season-varying rules** → the prompt/checklist likely needs to read that season's own rules
  description first (whatever section documents it) before extracting events, rather than assuming one
  fixed table shape holds for every season of the show.

## 5. Note where team/group identity lives

Team or tribe-equivalent groupings sometimes aren't a clean named column — they can be color-coded in
the wikitext (`bgcolor="..."` cells) with the actual team names only in nearby prose or an infobox.
If so, the wiki-extraction prompt needs to resolve color → team name per season (don't assume a fixed
color scheme is stable across seasons of the same show).

## 6. Draft the scoring-event catalog and confirm it with the user

Turn the exit-method taxonomy and any notable recurring in-game moments (survived a vote, won an
individual challenge/duel, served as a leader/captain, etc.) into a candidate list of scoring events,
each mapped to something the wiki or research can actually confirm. Bring this list to the user for
confirmation before writing `src/lib/game/formats/<show>.js` — see `docs/PLAN-show-formats.md`'s
Traitors and Challenge entries for the level of detail expected (event name, what triggers it, and any
caveat about how confidently it can be detected from the wiki vs. needing research).

## 7. Write up findings before starting code

Fold what you found — taxonomy, template/transclusion quirks, role mechanics, season-to-season rule
variance, team-identity quirks — into the relevant `docs/PLAN-*.md` (or this file, if the finding is
generic technique rather than specific to one show) so the next session doesn't re-derive it.

## 8. Write the format

Copy `src/lib/game/formats/survivor.js` as the template. It shows every piece a format has to supply:
exit methods, winner, event catalog, merge, the wiki half and the research half. A format is written
as two halves, put together by `defineFormat` (`formats/define.js`):
- `data`: plain JSON. Exit methods, the catalog and its categories, wiki section names, the research
  checklist (a list of fields, see `formats/checklist.js`), claims and the search hint.
  `formatProblems` checks it on load, so a bad reference (a category naming an event that doesn't
  exist, a claim that isn't a yes/no question) fails at once with a reason.
- code: functions. `impliedEvents`, the wiki read's schema/prompt/`rejectEvent`/`derivedEvents`,
  and research's `entryProblems`/`items`/`notes`/`sentences`.

`traitors.js` shows the optional pieces:
- `roles`: secret roles, recorded as season decisions.
- `impliedEvents`: points that follow from an exit or a role, derived rather than stored.
- `wiki.derivedEvents`: events worked out in code from other extracted data, such as votes.
- `wiki.roles`: role facts from the read.
- `wiki.castNote`: a warning added to the cast prompt.
- `wiki.routineEliminations`: how many exits in one episode is normal.

When changing an existing format without meaning to change its behaviour (a refactor, a move between
the halves), run `node tests/harness/format-regression.js` before and after and diff the output. Only
the "function sources" section at the end may differ, and only for functions you rewrote.

Register the new file in `formats/index.js`. The admin "Rules" picker lists whatever is registered, so
switching a show over needs no other code. Keep event ids unique to the format rather than reusing
Survivor's, unless the event really is the same thing.

Prefer deriving over asking. If a result follows from something already recorded (an exit, a role,
the vote record), derive it in code instead of asking the model or a reviewer for it separately. Two
sources for one fact will eventually disagree.
