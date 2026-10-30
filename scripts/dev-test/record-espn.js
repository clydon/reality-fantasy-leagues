// Dev-only: records a finished game's ESPN summary as a test fixture (tests/fixtures/espn/; docs/PLAN-start-a-game-gpt.md track L,
// step L1), trimmed to what the sports' readers read (src/lib/sports/): the header (teams, score, status, a hockey game's
// goalies of record), the box score's tables and team totals, ESPN's line before the game, and the plays with their times,
// periods, people and the fields each sport's reader uses (PLAYS, by ESPN's sport slug; football's sit in its drives; soccer's
// are its commentary and key events, its lines its match sheets, `rosters`). A raw summary is ~0.3-1 MB (pitch
// coordinates, win probability, news, videos); a trimmed one 60-230 KB. One real call (or none, from the cache
// check-sport-reduce.js keeps); no app server, no database.
//
//   node scripts/dev-test/record-espn.js --league=baseball/mlb --event=401907924 [--out=tests/fixtures/espn/mlb-401907924.json]
//        [--note="the 2026 Wild Card, Game 1"] [--cache=<dir>]
//
// It refuses a game that isn't final (a fixture is a whole game). Re-run it to re-record; the file says when and from where.
// When a sport's reader starts reading a new field, add it to KEEP below and record again.
//
// A field (golf, racing: L5 part 3) has no summary: its fixture is ESPN's answers for the event together, trimmed by FIELD_KEEP
// below: golf's event board (`golf/<tour>/scoreboard/<event>`, every hole) and its leaderboard (`golf/leaderboard?event=`);
// racing's event board (`racing/<series>/scoreboard/<event>`, each session's order) and each scored session's core answer (its
// competitors with each one's statistics, only those racing.ts reads, and F1's status: check-field-reduce.js's cache, else
// asked, a call a driver); each competitor on a line of its own.
//   node scripts/dev-test/record-espn.js --league=golf/pga --event=401850917 [--note=...]
//   node scripts/dev-test/record-espn.js --league=racing/f1 --event=600052046 [--note=...]
// A fight card (MMA: L5 part 4a) has no summary either: its fixture is its board, its FightCenter, the core's rounds and each
// bout's status, plays and fighters' statistics (espn-mma-card.js: check-bout-reduce.js's cache, else asked), trimmed by
// CARD_KEEP below to what mma.ts reads, each bout on a line.
//   node scripts/dev-test/record-espn.js --league=mma/ufc --event=600057024 [--note=...]
const fs = require("fs");
const os = require("os");
const path = require("path");
const { cachedRaceCore } = require("./espn-race-core");
const { cachedMmaCard } = require("./espn-mma-card");

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, ...v]) => [k, v.length ? v.join("=") : true]));
const league = args.league;
const event = args.event;
if (!league || !event) {
  console.error("Usage: node scripts/dev-test/record-espn.js --league=baseball/mlb --event=<ESPN event id> [--out=...] [--note=...]");
  process.exit(2);
}
const short = league.split("/")[1];
const out = args.out || path.join(__dirname, "..", "..", "tests", "fixtures", "espn", `${short}-${event}.json`);
const cacheDir = args.cache || path.join(os.tmpdir(), "rfl-espn-cache");

// What's kept, as a shape: an object lists its keys (true keeps the value whole), an array's shape is its items'.
const TEAM = { id: true, displayName: true, abbreviation: true };
const KEEP = {
  header: {
    id: true,
    season: { year: true, type: true },
    competitions: [
      {
        // When it started (its scheduled time: college baseball's stat crew's clock is read against it).
        date: true,
        // The period it ended in and its detail ("Final/SO"), and a hockey game's goalies of record.
        status: { period: true, type: { state: true, completed: true, detail: true }, featuredAthletes: [{ name: true, athlete: { id: true }, team: { id: true } }] },
        // A soccer match's shootout is its own score.
        competitors: [{ homeAway: true, winner: true, score: true, shootoutScore: true, team: TEAM }],
      },
    ],
  },
  boxscore: {
    // Baseball's team totals come in groups; basketball's and hockey's as one list, some only as text ("39-87").
    teams: [{ team: TEAM, statistics: [{ name: true, value: true, displayValue: true, stats: [{ name: true, value: true }] }] }],
    players: [
      {
        team: TEAM,
        statistics: [
          {
            type: true,
            name: true,
            labels: true,
            keys: true,
            totals: true,
            // College football's text names people by jersey too.
            athletes: [{ athlete: { id: true, displayName: true, jersey: true, position: { abbreviation: true } }, position: { abbreviation: true }, starter: true, didNotPlay: true, batOrder: true, stats: true, notes: true }],
          },
        ],
      },
    ],
  },
  // ESPN's line before the game (DraftKings'): the over/under's default (part 3 stores it).
  pickcenter: [{ provider: { name: true }, details: true, overUnder: true, spread: true }],
  // The play fields each sport's reader reads (its ESPN sport slug; a sport not here keeps them all).
  plays: null,
  // Football's plays sit in its drives (the finished ones, and live the one going on): set below for football.
  drives: null,
};

const PLAY = { id: true, type: { type: true }, text: true, period: { type: true, number: true }, wallclock: true, participants: [{ athlete: { id: true }, type: true }] };
const CLOCKED = { id: true, text: true, period: { number: true, displayValue: true }, clock: { displayValue: true }, wallclock: true, team: { id: true }, scoringPlay: true, scoreValue: true };
const PLAYS = {
  // Baseball counts runs from scoreValue and outs from outs, never a play's score (an at-bat's start carries its end's); college's
  // types have no slug, only their text ("Strike Looking"), and its stat crew's games are checked against the score after each.
  baseball: { ...PLAY, type: { type: true, text: true }, scoreValue: true, atBatId: true, summaryType: true, atBatPitchNumber: true, outs: true, awayScore: true, homeScore: true },
  // Basketball reads a play by its type's text and its shot flags; its people have no roles.
  basketball: { ...CLOCKED, type: { id: true, text: true }, participants: [{ athlete: { id: true } }], shootingPlay: true, pointsAttempted: true },
  // Hockey by its type's abbreviation (a penalty's minutes), its people's roles, and a goal's strength and net.
  hockey: { ...CLOCKED, type: { id: true, text: true, abbreviation: true, penaltyMinutes: true, penaltyType: true }, participants: [{ athlete: { id: true }, type: true }], strength: { abbreviation: true }, shotInfo: { abbreviation: true } },
  // Football reads a play's text (its people are only there), the score after it, and who had the ball on which down where;
  // college's also where it ended (its text's team codes) and ESPN's yards for it (an intentional grounding's loss).
  football: { id: true, type: { text: true }, text: true, awayScore: true, homeScore: true, period: { number: true }, clock: { displayValue: true }, wallclock: true, start: { team: { id: true }, down: true, distance: true, yardLine: true }, end: { yardLine: true }, statYardage: true },
  any: { ...PLAY, awayScore: true, homeScore: true, clock: { displayValue: true }, scoringPlay: true, scoreValue: true, team: { id: true } },
};
const sportSlug = league.split("/")[0];
// Soccer's play by play (src/lib/sports/soccer.ts): each match sheet's players with their lines, the key events (ESPN's ids),
// and the commentary (every sentence, a play's people by name only); its half's length.
const SOCCER_PLAY = { id: true, type: { type: true, text: true }, text: true, period: { number: true }, clock: { value: true, displayValue: true }, team: { id: true, displayName: true }, participants: [{ athlete: { id: true, displayName: true } }], wallclock: true, shootout: true };
if (sportSlug === "soccer") {
  KEEP.format = { regulation: { periods: true, clock: true } };
  KEEP.rosters = [{ homeAway: true, team: TEAM, roster: [{ starter: true, athlete: { id: true, displayName: true, fullName: true, lastName: true }, position: { abbreviation: true }, stats: [{ name: true, value: true }] }] }];
  KEEP.keyEvents = [SOCCER_PLAY];
  KEEP.commentary = [{ sequence: true, time: { value: true, displayValue: true }, text: true, play: SOCCER_PLAY }];
  delete KEEP.plays;
  delete KEEP.drives;
} else if (sportSlug === "football") {
  const drive = { id: true, team: { id: true }, plays: [PLAYS.football] };
  KEEP.drives = { previous: [drive], current: drive };
  // College's two-point tries say who passed and who caught only in the scoring plays' summaries.
  KEEP.scoringPlays = [{ id: true, text: true }];
  delete KEEP.plays;
} else {
  KEEP.plays = [PLAYS[sportSlug] ?? PLAYS.any];
  delete KEEP.drives;
}

function trim(value, shape) {
  if (shape === true || value == null) return value;
  if (Array.isArray(shape)) return Array.isArray(value) ? value.map((v) => trim(v, shape[0])) : undefined;
  if (typeof value !== "object") return undefined;
  const o = {};
  for (const [k, s] of Object.entries(shape)) {
    const v = trim(value[k], s);
    if (v !== undefined) o[k] = v;
  }
  return o;
}

// A field's answers, as golf's readers read them (src/lib/sports/golf.ts).
const STATUS = { type: { state: true, completed: true, name: true, detail: true } };
const HOLE = { value: true, period: true, par: true, scoreType: { displayValue: true } };
const FIELD_KEEP = {
  golf: {
    // The board: each competitor's rounds and their holes in the order played, and ESPN's counts of the round's kinds of holes.
    board: {
      id: true,
      name: true,
      date: true,
      endDate: true,
      status: STATUS,
      competitions: [
        {
          id: true,
          status: { period: true, ...STATUS },
          competitors: [{ id: true, type: true, order: true, athlete: { displayName: true, flag: { alt: true } }, team: { id: true, displayName: true }, score: true, linescores: [{ value: true, displayValue: true, period: true, linescores: [HOLE], statistics: { categories: [{ stats: [{ value: true }] }] } }] }],
        },
      ],
    },
    // The leaderboard: places, statuses, the rounds' tee times and places, the cut, a playoff, earnings and season points.
    leaderboard: {
      events: [
        {
          id: true,
          name: true,
          date: true,
          endDate: true,
          status: STATUS,
          tournament: { numberOfRounds: true, cutRound: true, cutScore: true, cutCount: true, scoringSystem: { name: true }, major: true },
          playoffType: { description: true },
          courses: [{ id: true, shotsToPar: true, holes: [{ number: true, shotsToPar: true }] }],
          competitions: [
            {
              id: true,
              status: { period: true, ...STATUS },
              competitors: [
                {
                  id: true,
                  type: true,
                  earnings: true,
                  athlete: { id: true, displayName: true, flag: { alt: true } },
                  team: { id: true, displayName: true },
                  roster: [{ athlete: { id: true, displayName: true } }],
                  score: { value: true, displayValue: true },
                  linescores: [{ value: true, displayValue: true, period: true, inScore: true, outScore: true, startPosition: true, currentPosition: true, teeTime: true, isPlayoff: true, linescores: [HOLE] }],
                  statistics: [{ name: true, value: true, displayValue: true }],
                  status: { period: true, thru: true, teeTime: true, playoff: true, type: { name: true, state: true, completed: true, description: true, shortDetail: true }, position: { displayName: true, isTie: true } },
                },
              ],
            },
          ],
        },
      ],
    },
  },
};

// Racing's (src/lib/sports/racing.ts): the board's sessions in finishing order, and each scored session's competitors from the
// core API: the grid, the car, the statistics the reader reads and F1's status.
FIELD_KEEP.racing = {
  board: {
    id: true,
    name: true,
    date: true,
    endDate: true,
    status: STATUS,
    competitions: [{ id: true, date: true, type: { abbreviation: true }, status: { period: true, ...STATUS }, competitors: [{ id: true, type: true, order: true, winner: true, athlete: { displayName: true, flag: { alt: true } } }] }],
  },
  core: { id: true, order: true, startOrder: true, winner: true, vehicle: { number: true, manufacturer: true, team: true }, statistics: { splits: { categories: [{ stats: [{ name: true, value: true }] }] } }, status: { period: true, type: { name: true } } },
};
/** The statistics racing.ts reads (the rest of ESPN's ~20 aren't kept). */
const RACE_STATS = ["place", "pole", "lapsCompleted", "lapsLead", "championshipPts", "bonus", "penaltyPts", "pitsTaken", "fastestLapNum", "qual2TimeMS", "qual3TimeMS", "wins", "top5", "top10"];

/** A race weekend's fixture: its board and each scored session's core answer (check-field-reduce.js's cache, else asked). */
async function recordRace() {
  const [, series] = league.split("/");
  const keep = FIELD_KEEP.racing;
  const ask = async (url) => {
    const res = await fetch(url, { headers: { "User-Agent": "GameYourShow/1.0" } });
    return res.ok ? res.json() : null;
  };
  const boardFile = path.join(cacheDir, `racing-${series}-board-${event}.json`);
  const boardUrl = `https://site.api.espn.com/apis/site/v2/sports/${league}/scoreboard/${event}`;
  const board = fs.existsSync(boardFile) ? JSON.parse(fs.readFileSync(boardFile, "utf8")) : await ask(boardUrl);
  if (!(board?.status?.type?.state === "post" && board?.status?.type?.completed)) {
    console.error(`${event} isn't final (${board?.status?.type?.name}): a fixture is a whole event.`);
    process.exit(1);
  }
  fs.writeFileSync(boardFile, JSON.stringify(board));
  const core = {};
  let raw = JSON.stringify(board).length;
  for (const c of board.competitions ?? []) {
    if (/^FP/.test(c.type?.abbreviation ?? "") || !(c.competitors ?? []).length) continue;
    const session = await cachedRaceCore(cacheDir, { series, event, session: String(c.id), done: true });
    if (!session.competitors.length) throw new Error(`ESPN's core has no competitors for ${c.type?.abbreviation ?? "the race"} (${c.id})`);
    raw += JSON.stringify(session).length;
    core[String(c.id)] = (session.competitors ?? []).map((x) => {
      const t = trim(x, keep.core);
      for (const cat of t.statistics?.splits?.categories ?? []) cat.stats = (cat.stats ?? []).filter((st) => RACE_STATS.includes(st.name));
      return t;
    });
  }
  const b = trim(board, keep.board);
  const lines = (xs, pad) => `[\n${xs.map((x) => `${pad}${JSON.stringify(x)}`).join(",\n")}\n${pad.slice(1)}]`;
  const sessions = b.competitions.map((c) => {
    const { competitors, ...rest } = c;
    return JSON.stringify({ ...rest, competitors: "@@" }).replace('"@@"', lines(competitors ?? [], "      "));
  });
  const { competitions, ...head } = b;
  const boardText = `${JSON.stringify(head).slice(0, -1)},"competitions":[\n    ${sessions.join(",\n    ")}\n  ]}`;
  const coreText = `{\n${Object.entries(core).map(([id, xs]) => `  ${JSON.stringify(id)}: { "competitors": ${lines(xs, "    ")} }`).join(",\n")}\n }`;
  const rec = { league, event, from: [boardUrl.replace("https://", ""), `sports.core.api.espn.com/v2/sports/racing/leagues/${series}/events/${event}/competitions/<session>/competitors (+ /<id>/statistics${series === "f1" ? ", /<id>/status" : ""})`], at: new Date().toISOString().slice(0, 10), ...(args.note ? { note: args.note } : {}), by: "scripts/dev-test/record-espn.js" };
  const body = `{\n "_recorded": ${JSON.stringify(rec)},\n "board": ${boardText},\n "core": ${coreText}\n}\n`;
  JSON.parse(body);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, body);
  const n = (competitions ?? []).reduce((a, c) => a + (c.competitors ?? []).length, 0);
  console.log(`${path.relative(process.cwd(), out)}: ${competitions.length} sessions, ${n} results, ${Object.keys(core).length} sessions' core, ${(body.length / 1024).toFixed(0)} KB (from ${(raw / 1024).toFixed(0)} KB)`);
}

// A fight card's (src/lib/sports/mma.ts): the board's bouts in the order fought (their class, status, fighters and the judges'
// scores), the FightCenter's segments, results and totals, the core's rounds, and each bout's status, plays and the
// statistics the reader reads.
const BOUT_STATUS = { clock: true, displayClock: true, period: true, type: { state: true, completed: true, name: true }, result: { name: true, displayName: true, description: true } };
const CARD_KEEP = {
  board: { id: true, name: true, date: true, status: STATUS, competitions: [{ id: true, date: true, type: { abbreviation: true }, status: BOUT_STATUS, format: { regulation: { periods: true } }, competitors: [{ id: true, order: true, winner: true, athlete: { displayName: true, flag: { alt: true } }, linescores: [{ value: true, linescores: [{ value: true }] }] }] }] },
  center: { id: true, types: [{ text: true }], status: BOUT_STATUS, cardSegment: { name: true }, matchNumber: true, note: true, judgesScores: true, competitors: [{ id: true, order: true, winner: true, stats: [{ name: true, value: true, displayValue: true }] }] },
  event: { competitions: [{ id: true, description: true, format: { regulation: { periods: true, clock: true } } }] },
  core: { status: BOUT_STATUS, plays: [{ id: true, sequenceNumber: true, type: { text: true }, period: { number: true }, clock: { displayValue: true }, wallclock: true }], competitors: [{ id: true, order: true, winner: true, statistics: { splits: { categories: [{ stats: [{ name: true, value: true }] }] } } }] },
};
/** The core statistics mma.ts reads (the rest of ESPN's ~40 aren't kept). */
const BOUT_STATS = ["knockDowns", "sigStrikesLanded", "sigStrikesAttempted", "totalStrikesLanded", "totalStrikesAttempted", "takedownsLanded", "takedownsAttempted", "takedownsSlams", "submissions", "reversals", "advances", "advanceToHalfGuard", "advanceToSide", "advanceToMount", "advanceToBack", "timeInControl", ...["Distance", "Clinch", "Ground"].flatMap((p) => ["Head", "Body", "Leg"].flatMap((t) => [`sig${p}${t}StrikesLanded`, `sig${p}${t}StrikesAttempted`]))];

/** A fight card's fixture: its answers (check-bout-reduce.js's cache, else asked), trimmed, each bout on a line. */
async function recordCard() {
  const [, promotion] = league.split("/");
  const card = await cachedMmaCard(cacheDir, { league: promotion, event });
  if (!(card?.board?.status?.type?.state === "post" && card.board.status.type.completed)) {
    console.error(`${event} isn't final (${card?.board?.status?.type?.name}): a fixture is a whole card.`);
    process.exit(1);
  }
  const lines = (xs, pad) => `[\n${xs.map((x) => `${pad}${JSON.stringify(x)}`).join(",\n")}\n${pad.slice(1)}]`;
  const board = trim(card.board, CARD_KEEP.board);
  const { competitions, ...head } = board;
  const boardText = `${JSON.stringify(head).slice(0, -1)},"competitions":${lines(competitions ?? [], "    ")}}`;
  const segments = Object.entries(card.fightcenter?.cards ?? {}).map(([k, seg]) => `   ${JSON.stringify(k)}: { "name": ${JSON.stringify(seg.name ?? null)}, "competitions": ${lines((seg.competitions ?? []).map((c) => trim(c, CARD_KEEP.center)), "     ")} }`);
  const centerText = `{ "cards": {\n${segments.join(",\n")}\n  } }`;
  const eventText = `{ "competitions": ${lines((card.event?.competitions ?? []).map((c) => trim(c, CARD_KEEP.event.competitions[0])), "    ")} }`;
  const core = Object.entries(card.core ?? {}).map(([id, b]) => {
    const t = trim(b, CARD_KEEP.core);
    for (const c of t.competitors ?? []) for (const cat of c.statistics?.splits?.categories ?? []) cat.stats = (cat.stats ?? []).filter((st) => BOUT_STATS.includes(st.name));
    return `  ${JSON.stringify(id)}: ${JSON.stringify(t)}`;
  });
  const coreText = `{\n${core.join(",\n")}\n }`;
  const rec = { league, event, from: [`site.api.espn.com/apis/site/v2/sports/${league}/scoreboard/${event}`, `site.web.api.espn.com/apis/common/v3/sports/${league}/fightcenter/${event}`, `sports.core.api.espn.com/v2/sports/mma/leagues/${promotion}/events/${event} (+ /competitions/<bout>/status, /plays, /competitors/<id>/statistics)`], at: new Date().toISOString().slice(0, 10), ...(args.note ? { note: args.note } : {}), by: "scripts/dev-test/record-espn.js" };
  const body = `{\n "_recorded": ${JSON.stringify(rec)},\n "board": ${boardText},\n "fightcenter": ${centerText},\n "event": ${eventText},\n "core": ${coreText}\n}\n`;
  JSON.parse(body);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, body);
  const plays = Object.values(card.core ?? {}).reduce((n, b) => n + (b.plays ?? []).length, 0);
  console.log(`${path.relative(process.cwd(), out)}: ${(competitions ?? []).length} bouts, ${plays} plays, ${(body.length / 1024).toFixed(0)} KB (from ${(JSON.stringify(card).length / 1024).toFixed(0)} KB)`);
}

/** A field's fixture: its answers (cached by check-field-reduce.js's names, else asked), trimmed, each competitor on a line. */
async function recordField() {
  const [slug, tour] = league.split("/");
  if (slug === "racing") return recordRace();
  const keep = FIELD_KEEP[slug];
  if (!keep) throw new Error(`no field shape for ${slug} yet`);
  const urls = { board: `https://site.api.espn.com/apis/site/v2/sports/${league}/scoreboard/${event}`, leaderboard: `https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard?event=${event}` };
  const answers = {};
  for (const [k, url] of Object.entries(urls)) {
    const cached = path.join(cacheDir, `${slug}-${tour}-${k}-${event}.json`);
    let a = fs.existsSync(cached) ? JSON.parse(fs.readFileSync(cached, "utf8")) : null;
    if (!a) {
      const res = await fetch(url, { headers: { "User-Agent": "GameYourShow/1.0" } });
      if (!res.ok) throw new Error(`ESPN answered ${res.status} for ${k}`);
      a = await res.json();
    }
    answers[k] = a;
  }
  const ev = answers.leaderboard?.events?.[0];
  if (!(ev?.status?.type?.state === "post" && ev?.status?.type?.completed)) {
    console.error(`${event} isn't final (${ev?.status?.type?.name}): a fixture is a whole event.`);
    process.exit(1);
  }
  for (const [k] of Object.entries(urls)) fs.writeFileSync(path.join(cacheDir, `${slug}-${tour}-${k}-${event}.json`), JSON.stringify(answers[k]));
  const board = trim(answers.board, keep.board);
  const lb = trim(answers.leaderboard, keep.leaderboard);
  const lines = (comps) => `[\n${comps.map((c) => `      ${JSON.stringify(c)}`).join(",\n")}\n     ]`;
  const bComps = board.competitions[0].competitors ?? [];
  const lComps = lb.events[0].competitions[0].competitors ?? [];
  delete board.competitions[0].competitors;
  delete lb.events[0].competitions[0].competitors;
  const head = { _recorded: { league, event, from: Object.values(urls).map((u) => u.replace("https://", "")), at: new Date().toISOString().slice(0, 10), ...(args.note ? { note: args.note } : {}), by: "scripts/dev-test/record-espn.js" } };
  const boardText = JSON.stringify({ ...board, competitions: [{ ...board.competitions[0], competitors: "@@" }] }).replace('"@@"', lines(bComps));
  const lbEvent = lb.events[0];
  const lbText = JSON.stringify({ events: [{ ...lbEvent, competitions: [{ ...lbEvent.competitions[0], competitors: "@@" }] }] }).replace('"@@"', lines(lComps));
  const body = `{\n "_recorded": ${JSON.stringify(head._recorded)},\n "board": ${boardText},\n "leaderboard": ${lbText}\n}\n`;
  JSON.parse(body);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, body);
  const raw = JSON.stringify(answers.board).length + JSON.stringify(answers.leaderboard).length;
  const holes = bComps.reduce((n, c) => n + (c.linescores ?? []).reduce((m, r) => m + (r.linescores ?? []).length, 0), 0);
  console.log(`${path.relative(process.cwd(), out)}: ${lComps.length} competitors, ${holes} holes, ${(body.length / 1024).toFixed(0)} KB (from ${(raw / 1024).toFixed(0)} KB)`);
}

(async () => {
  fs.mkdirSync(cacheDir, { recursive: true });
  if (/^(golf|racing)\//.test(league)) return recordField();
  if (/^mma\//.test(league)) return recordCard();
  const cached = path.join(cacheDir, `${league.replace("/", "-")}-summary-${event}.json`);
  const final = (s) => s?.header?.competitions?.[0]?.status?.type?.completed === true;
  let summary = fs.existsSync(cached) ? JSON.parse(fs.readFileSync(cached, "utf8")) : null;
  if (!final(summary)) {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${league}/summary?event=${event}`, { headers: { "User-Agent": "GameYourShow/1.0" } });
    if (!res.ok) throw new Error(`ESPN answered ${res.status}`);
    summary = await res.json();
    // Only a final game is kept (the cache check-sport-reduce.js shares): a live one changes.
    if (final(summary)) fs.writeFileSync(cached, JSON.stringify(summary));
  }
  const st = summary.header?.competitions?.[0]?.status?.type;
  if (!(st?.state === "post" && st?.completed)) {
    console.error(`${event} isn't final (${st?.state}): a fixture is a whole game.`);
    process.exit(1);
  }
  const trimmed = {
    _recorded: { league, event, from: `site.api.espn.com/apis/site/v2/sports/${league}/summary?event=${event}`, at: new Date().toISOString().slice(0, 10), ...(args.note ? { note: args.note } : {}), by: "scripts/dev-test/record-espn.js" },
    ...trim(summary, KEEP),
  };
  // Each part on a line of its own, and each play (football's: each drive; soccer's: each commentary entry, each key event, each
  // side's match sheet): small diffs when it's recorded again.
  const plays = trimmed.plays ?? [];
  const drives = trimmed.drives ?? null;
  const lists = sportSlug === "soccer" ? Object.fromEntries(["rosters", "keyEvents", "commentary"].map((k) => [k, trimmed[k] ?? []])) : null;
  delete trimmed.plays;
  delete trimmed.drives;
  for (const k of Object.keys(lists ?? {})) delete trimmed[k];
  const parts = Object.entries(trimmed).map(([k, v]) => ` ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  const tail = lists
    ? Object.entries(lists).map(([k, v]) => ` ${JSON.stringify(k)}: [\n${v.map((x) => `  ${JSON.stringify(x)}`).join(",\n")}\n ]`).join(",\n")
    : drives
    ? ` "drives": {\n  "previous": [\n${(drives.previous ?? []).map((d) => `   ${JSON.stringify(d)}`).join(",\n")}\n  ]${drives.current ? `,\n  "current": ${JSON.stringify(drives.current)}` : ""}\n }`
    : ` "plays": [\n${plays.map((p) => `  ${JSON.stringify(p)}`).join(",\n")}\n ]`;
  const body = `{\n${parts.join(",\n")},\n${tail}\n}\n`;
  JSON.parse(body);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, body);
  const count = lists ? lists.commentary.length + lists.keyEvents.length : drives ? [...(drives.previous ?? []), ...(drives.current ? [drives.current] : [])].reduce((n, d) => n + (d.plays ?? []).length, 0) : plays.length;
  console.log(`${path.relative(process.cwd(), out)}: ${count} plays, ${(body.length / 1024).toFixed(0)} KB (from ${(JSON.stringify(summary).length / 1024).toFixed(0)} KB)`);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
