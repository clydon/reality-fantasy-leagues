// The writer spike's "words" reader: a typed request to an ORDER (order.js) by matching its words to the gallery's menu (menu.js),
// with no model at all. It finds the base, the changes and the questions a request names (the catalog's own names and lines plus a
// small hand-written list of how people say them, below), binds each number to the slot nearest its words ("3 each" to Your team ›
// On a team, "2 lives" to Lives, "first to 50" to The target), builds the game through the catalog and asks the engine. It says
// sure: false (hand it on to a bigger reader) whenever it can't place a number, leaves words it doesn't understand, meets a
// negation or a condition it can't explain, hears something the menu can't make (live play, a moment research doesn't answer, a
// moment's points), names no game at all, or the menu or the engine refuses the result. It prefers unsure to a confident wrong
// answer. Given the current game (opt.current, an order), it reads a sentence as ops on it instead (edit).
//
// Needs: the repo only (no model, no network). CommonJS.
//   const W = require("./words.js");
//   W.read(text, pg) -> { order, sure, why[], trace, built }
//   W.edit(text, currentOrder, pg) -> { ops, order, sure, why[], built }
//   W.numbersIn(text) -> the numbers a request states (the harness's "said" match)
//   node scripts/dev-test/writer-spike/words.js "draft 3 each and double points for the winner"   (reads it on Survivor 51)
//   node scripts/dev-test/writer-spike/words.js --edit=outlast "make it 2 each"
//
// Tuning discipline: the synonyms were written from the catalog and tuned on the tracker's examples, stretch rows, dials and
// edits.json, never on its corpus (held out). Any entry added after looking at a corpus failure carries { peek: true } and is
// listed in the report; the harness's --held-out (READ_OPTS.heldOut) drops them.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, like the catalog (src/lib/game/start-gallery) */
const path = require("path");
const ROOT = path.join(__dirname, "..", "..", "..");
const C = require(path.join(ROOT, "src", "lib", "game", "start-gallery", "index.js"));
const S = require(path.join(ROOT, "src", "lib", "game", "game-spec", "schema.js"));
const M = require("./menu.js");
const O = require("./order.js");

// ---------- normalizing ----------

const NUMWORDS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const MULTWORDS = { double: 2, doubles: 2, doubled: 2, twice: 2, triple: 3, triples: 3, tripled: 3, quadruple: 4, half: 0.5, halved: 0.5, quarter: 0.25, quartered: 0.25 };

/** Lower case, plain punctuation, contractions out, hyphens to spaces, number words to digits ("one" kept as a pronoun). */
function normalize(text) {
  let t = ` ${String(text || "")} `
    .toLowerCase()
    .replace(/[‘’`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, " - ")
    .replace(/×/g, "x")
    .replace(/½/g, " half ");
  t = t.replace(/\blet's\b/g, "let us").replace(/\b(who|what|it|that|there|he|she|where|here)'s\b/g, "$1 is").replace(/\bwon't\b/g, "will not").replace(/\bcan't\b/g, "can not").replace(/n't\b/g, " not");
  t = t.replace(/'re\b/g, " are").replace(/'ll\b/g, " will").replace(/'ve\b/g, " have").replace(/'d\b/g, " would").replace(/\bi'm\b/g, "i am").replace(/'s\b/g, "").replace(/s'(?=\s)/g, "s");
  t = t.replace(/\bw\/o\b/g, " without ").replace(/\bw\//g, " with ").replace(/\bo\/u\b|\bover\s*\/\s*under\b/g, " over under ").replace(/\bh2h\b/g, " head to head ").replace(/\bversus\b|\bvs\.?(?=\s)/g, " vs ");
  t = t.replace(/([a-z])-(?=[a-z])/g, "$1 ").replace(/\+\s*(\d)/g, " plus $1");
  t = t.replace(/(\d+(?:\.\d+)?)\s*x\b/g, " x$1 ").replace(/\bx\s+(\d)/g, " x$1");
  t = t.replace(/\b(a|one) (hundred|thousand)\b/g, (m, a, b) => (b === "hundred" ? "100" : "1000"));
  t = t.replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[ -](one|two|three|four|five|six|seven|eight|nine)\b/g, (m, a, b) => String(NUMWORDS[a] + NUMWORDS[b]));
  // "one" as a pronoun stays a word: no one, the one who, one of us, only one who, a different one.
  t = t.replace(/\b(no|any|every|some|each|the|this|that|which|last|another|different|only the|someone|anyone)\s+one\b/g, "$1 ONE_").replace(/\bone (of|who|that|another)\b/g, "ONE_ $1");
  t = t.replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b/g, (m) => String(NUMWORDS[m]));
  t = t.replace(/\bONE_/g, "one");
  t = t.replace(/\b(\d+) (hundred|thousand)\b/g, (m, n, b) => String(Number(n) * (b === "hundred" ? 100 : 1000)));
  t = t.replace(/(\d),(\d{3})\b/g, "$1$2");
  t = t.replace(/[^a-z0-9.$%'"+\-,;:!?()]+/g, " ").replace(/\s+/g, " ");
  return ` ${t.trim()} `;
}

// ---------- stop words and filler (generic English and the app's own words, not tuned on any request) ----------

const STOP = new Set(("a an the and or but so to of in on at for by with from into onto than then that this these those it its is are was were be been being am "
  + "i me my mine we us our ours you your yours he him his she her they them their theirs who whom whose which what when where why how "
  + "do does did done doing have has had having will would shall should can could may might must let lets want wants wanted like "
  + "just also too very really some any all each every both either neither other another more most much many few lot lots such own same "
  + "there here up down out over under again about as if not no yes ok okay please thanks thank hey hi get gets got getting "
  + "make makes made making set sets setting create creating start starts started starting run running "
  + "game games league leagues play plays played playing player players everyone everybody anyone anybody someone somebody one ones "
  + "week weeks weekly episode episodes season seasons show shows point points score scores scored scoring time times "
  + "people person guys friends friend group couch family thing things way ways kind sort basically "
  + "new first last next before after during while until till since now today tonight then whole entire full "
  + "gonna wanna going goes go went need needs needed use used using via per plus whoever whatever whichever").split(/\s+/));
/** Words that carry nothing for the game: hedges, the show's people, generic game verbs (where a cue doesn't claim them). */
const FILLER = new Set(("rules rule format style type version mode option options setup simple simply fun quick easy cool good great nice "
  + "maybe probably sure think thinks thought guess idea something anything everything stuff etc actually right correct correctly "
  + "yeah yep pls plz tv watch watching watched watches viewer viewers fans fan "
  + "castaway castaways contestant contestants couple couples houseguest houseguests queen queens celebrity celebrities dancer dancers cast member members "
  + "pick picks picked picking choose chooses chose chosen name names named naming call calls called calling guess guesses guessed "
  + "win wins won winning lose loses lost hit hits achieve achieves predict predicts prediction predictions "
  + "add adds added give gives change changes switch turn also ask asks asked instead whole question questions "
  + "must able allowed should automatically ever several possible individual moments moment things option better doing "
  + "end ends ending ended total totals pay pays paid").split(/\s+/));
const NEG = /\b(no|not|without|never|remove|drop|take off|get rid of|turn off|stop|cancel|lose the|minus)\b/;
/** PEEK (added after the held-out corpus run, from its failures; --held-out drops it): words about who's playing, where and when,
 *  that carry nothing for the game ("office pool", "watch party", "my book club", "this weekend"). */
const PEEK_FILLER = new Set(("office party watch dorm floor club book chat roommate mom dad wife husband partner kids coworkers coworker mates boys girls gang crew "
  + "friends family group roommates weekend sunday monday tuesday wednesday thursday friday saturday track tracking see well how "
  + "survivalists survivalist chefs chef queens queen bakers baker housemates islanders").split(/\s+/));
/** PEEK: words that name a part of a game; one left unplaced means the reading missed something. */
const GAME_WORDS = new Set(("keep keeper keepers draft drafts pool bet bets wager stake lives captain bank pot parlay ticket trade buy sell budget bid auction "
  + "snake playoffs race cut streak mulligan buyback together bot host twist majority bounty steal traitor traitors reverse random hat spread "
  + "slot slots replace waivers swap repeat twice double triple half").split(/\s+/));
/** PEEK: shorthand people type for game words. */
const PEEK_SHORT = [[/\bpts\b/g, "points"], [/\bea\b/g, "each"], [/\belims\b/g, "eliminations"], [/\bpt\b/g, "point"]];

// ---------- the lexicon: how people say the menu's entries ----------
// Each cue: [regex over the normalized request, target, weight, extra?]. Targets: B:<base>, F:<family>, C:<change>[:<control>=
// <value>], X:<why the menu can't make it>. Written from the catalog's names and lines (menu.js) and the tuning sets; one marked
// { peek: true } was added after looking at a corpus failure.

const CUES = [
  // ---- families: what you do ----
  [/\bdraft(s|ed|ing)?\b|\broster\b|\bpick (a|your) team\b|\bteam of \d+\b|\bteams? of (castaways|players|contestants)\b/, "F:draft", 1],
  [/\blineups?\b|\bline up\b|\bchoose (who|which|\d+) (plays|play|to play|start|starts|starters)\b|\bstarters?\b|\bstart(ing)? \d+\b|\bset (your|a) lineup\b/, "F:lineup", 2],
  [/\bpoints? for what they do\b|\bwhat they do\b|\bscore(s)? for (winning|immunity|idols?|challenges?|what)\b|\bfor (winning immunity|finding (an )?idols?)\b/, "F:lineup", 2],
  [/\boutlast(s)?\b|\blast(s|ing)? (the )?longest\b|\bhow long (they|it|you|your \w+) last\b|\bthe longer (they|yours?|your \w+) (last|lasts|stay|stays)\b|\bcheer (for )?them\b|\b(point|points) for (everyone|each one|every \w+) (who goes|out) (home )?before\b|\blast (one|man|woman|person) standing (wins|carries)\b/, "F:place", 2],
  [/\b(pick|picks|choose|name) (\d+|a|one|someone|somebody|a castaway|a player) (each|every|per|a) (week|episode|night)\b|\b(each|every) (week|episode) (you |we )?(pick|name|choose) (\d+|a|one|someone)\b|\bpick (who|someone who) (stays|survives|will stay)\b|\bpool\b/, "F:pick", 2],
  [/\bpredict(s|ed|ing|ions?)?\b|\bguess(es|ed|ing)?\b|\bcall(s|ed|ing)? (it|the|who|what)\b|\bforecast\b/, "F:questions", 1],
  [/\bbet(s|ting)?\b|\bwager(s|ed|ing)?\b|\bgambl(e|ing)\b/, "F:bets", 1],

  // ---- bases by name (the gallery's squares) ----
  [/\bfantasy( (league|team|game|draft))?\b/, "B:fantasy", 2],
  [/\bweekly lineup\b/, "B:fantasy", 3],
  [/\bhead to head league\b/, "B:h2h", 3],
  [/\boutlast\b/, "B:outlast", 3],
  [/\bbest ball\b/, "B:bestball", 3],
  [/\bauction( draft)?\b/, "B:auction", 3],
  [/\bsalary cap\b/, "B:cap", 3],
  [/\bstock market\b/, "B:market", 3],
  [/\bguillotine\b/, "B:guillotine", 3],
  [/\breverse( draft)?\b/, "B:reverse", 3],
  [/\b(names )?out of a hat\b|\b(random|randomly) (castaway|draw|assigned|dealt|given)\b|\bdealt (a castaway )?at random\b|\b(get|gets|given) a random\b/, "B:hat", 3],
  [/\b(1|one) (castaway |player )?from each (tribe|team|group)\b|\bfrom each tribe\b|\bacross the tribes\b/, "B:spread", 3],
  [/\bkeeper( league)?s?\b|\bdynasty\b/, "B:keeper", 3],
  [/\b(1|one) moment (draft|only)\b|\bonly (1|one) moment\b|\bone moment draft\b/, "B:onemoment", 3],
  [/\bsurviv(al|or) pool\b|\bsurvival\b/, "B:pool", 3],
  [/\bno repeats?\b/, "B:norepeat", 3],
  [/\bweekly picks\b/, "B:picks", 3],
  [/\bobjectives?\b/, "B:objectives", 3],
  [/\bconfidence( picks| pool| points)?\b|\bsurest first\b/, "B:confidence", 3],
  [/\bprediction sheet\b(?! (generated|each|every))/, "B:sheet", 3],
  [/\bseason predictions?\b/, "B:seasonpred", 3],
  [/\bboot order\b/, "B:bootorder", 3],
  [/\b(the )?show calls\b|\bweekly calls\b/, "B:calls", 3],
  [/\bwho outlasts whom\b/, "B:pairs", 3],
  [/\b(jury |final )?(tribal )?vote split\b|\bfinal (tribal |jury )?vote\b/, "B:split", 3],
  [/\btitle quote\b|\bsays the (episode )?title\b|\bepisode title\b/, "B:quote", 3],
  [/\bseal (your|a|the) (winner|pick)\b|\bseal (a|your) winner pick\b/, "B:seal", 3],
  [/\bbetting pool\b/, "B:bank", 3],
  [/\bprop(s| sheet| bets)\b/, "B:props", 3],
  [/\b(sheet|card) (generated|each week|every week|of bets)\b|\bgenerated (each|every) week\b|\bnew sheet (each|every)\b/, "B:props", 2],
  [/(?<!build a )\bparlay( ticket)?s?\b/, "B:parlay", 3],
  [/\bsplit the pot\b/, "B:pot", 3],
  [/\bdouble or nothing\b/, "B:double", 3],
  [/\bjackpot\b/, "B:jackpot", 3],
  [/\bhead to head picks\b/, "B:h2hpicks", 3],
  [/\bteam battle\b/, "B:teams", 3],
  [/\brace to (a|the) target\b/, "B:race", 3],
  [/\bco ?op\b|\btogether (vs|against) the show\b/, "B:coop", 3],
  [/\b(2|two) (against|on|vs|v) (1|one)\b|\b2v1\b/, "B:twovone", 3],
  [/\bbingo\b/, "B:bingo", 3],
  [/\btrivia\b|\bquiz(zes)?\b/, "B:trivia", 3],
  [/\bsecret(ly)? traitors?\b|\b(of us|of you) (are|is) (secretly |secret )?traitors?\b|\bsecretly (be |are )?(a )?traitors?\b/, "B:traitors", 3],
  [/\brotating host\b|\b(take turns|taking turns|rotate|a different (one|1) of us)\b[^.;]{0,40}\b(host|hosts|questions|writes|sets|setting)\b/, "B:host", 3],
  [/\bmatch(ing)? the majority\b|\bmajority\b|\bwhat most of (us|you|the couch) (will )?(say|pick|picks|guess)\b/, "B:majority", 3],
  [/\bbount(y|ies)( hunters?)?\b/, "B:bounty", 3],
  [/\btwist of the week\b|\bpicks? (a|the) twist\b|\bweekly twist\b|\btop scorer picks\b/, "B:twist", 3],
  [/\bsolo predictions\b|\bjust me\b|\bby myself\b|\bon my own\b|\bonly me\b|\bfor myself\b/, "B:solo", 3, { held: true }],
  [/\bsolo predictions\b/, "B:solo", 3, { peek: true }],
  [/\bjust me\b|\bby myself\b|\bon my own\b|\bonly me\b|\bfor myself\b|\bme vs everyone\b/, "C:solo", 3, { peek: true }],
  [/\bbeat the (bot|ai|computer)\b/, "B:beatbot", 3],
  [/\b(me )?(vs|against) the (bot|ai|computer)\b|\bbot as (a|the other) player\b/, "B:vsbot", 3],
  [/\bmini games?\b|\bseason of mini\b/, "B:minis", 3],
  [/\btwo halves\b|\bpre merge and post merge\b|\b(pre|before the) merge and (post|after the) merge\b|\bseparate games\b/, "B:halves", 3],
  [/\bredraft\b|\bnew draft( stage)?\b|\bdraft again\b/, "B:redraft", 3],
  [/\b(two|2) shows\b|\bacross (survivor|the traitors|\w+) and (the traitors|survivor|\w+)\b|\banother show\b|\bone league across\b/, "B:twoshows", 3],

  // ---- changes: Who's playing ----
  [/\b(in|into|split into|divided into|split us into|break into|split the couch into) (\d+ )?teams\b|\b\d+ teams\b|\bteams of (us|players|people|\d+ (of us|people|players))\b|\bteam vs team\b/, "C:teams", 2],
  [/\b(add|adds) up\b|\bteam total\b/, "C:teams:score=sum", 1],
  [/\b(share|sharing|shares) (one|1|a|the same|a single) (team|roster)\b|\bpartner and i\b|\b(co|joint) (owners?|managers?)\b/, "C:share", 3],
  [/\bnewcomers?\b|\bhead start\b|\bhandicaps?\b|\bnew (players|people|to the couch|to the show)\b|\bfirst timers?\b/, "C:handicap", 3],
  // ---- How you win ----
  [/\bmost points( at the end)?( wins)?\b|\bhighest (total|score) wins\b|\bmost (right|correct) (picks|answers|guesses|calls) wins\b|\bthe highest total\b/, "C:total", 1],
  [/\bhead to head\b|\bvs (a|one|each other|one another|a friend|someone)\b|\bmatchups?\b|\bplay(s)? (one|1) of (the couch|us)\b|\bagainst (each other|one another|a friend)\b|\bbeats whoever( does not| is not)?\b/, "C:matchups", 3],
  [/\bplayoffs?\b|\b(a )?final (at the end|between|for the top)\b|\btop \d+ (meet|play|go to|make)\b/, "C:matchups", 1],
  [/\bno (playoffs?|final)\b/, "C:matchups:playoffs=0", 4],
  [/\bmost weeks( won)?\b|\bweeks won\b|\bwins? the week\b|\bweekly (winner|wins)\b|\bwin(s|ning)? (each|the most) weeks?\b/, "C:weeks", 3],
  [/\bknock(ed|s)? out\b(?! of)|\bknockouts?\b|\b(lowest|bottom|worst|last place)\b[^.;]{0,40}\b(out|cut|eliminated|goes|go home|is gone|are gone)\b|\b(is|are|get|gets) cut\b/, "C:knockouts", 3],
  [/\bfirst (one |team |person |player |couch )?to \d+\b|\brace to \d+\b|\btarget of \d+\b|\b\d+ points wins\b/, "C:race", 3],
  [/\blives\b|\b\d+ life\b|\blast (one|man|woman|person) standing\b(?! (wins|carries))|\b(wrong|bad|missed) (pick|guess|call)(es|s)? (costs?|knocks?|takes|loses)\b|\b(knocks|knock) you out\b|\band you are out\b|\byou are out\b|\bcosts? (one|a|1) life\b|\bcosts (one|1)\b/, "C:standing", 3],
  [/\b(1|one|a) (wrong|bad|missed) (pick|guess|call)( and you are out| knocks you out| and you are gone)\b|\b(wrong|bad) (pick|guess|call) knocks you out\b/, "C:standing:lives=1", 4],
  [/\bmulligans?\b/, "C:standing", 3],
  [/\bbuy ?backs?\b|\bbuy (back )?in again\b|\bbuy back in\b/, "C:standing", 3],
  [/\btogether\b|\bagainst the show\b|\bshared lives\b|\bas a (team|group) against\b/, "C:coop", 2],
  [/\bstreaks?\b|\bin a row\b|\bthe longest streak\b/, "C:streak", 2],
  [/\bnet worth\b|\bmost worth\b|\bcash (and|plus) (your )?team\b/, "C:worth", 3],
  // ---- Bets ----
  [/\bno bets?\b|\bno betting\b|\bwithout (bets|betting)\b|\bno wagers?\b|\bnot bet\b/, "C:nobets", 4],
  [/\bside bets?\b/, "C:side", 4],
  [/\bstake(s|d)?\b|\bwager (up to|on)\b|\bbet up to\b/, "C:stake", 2],
  [/\bbet (any|all) (of )?your (points|bank)\b|\bdouble or nothing\b/, "C:double", 4],
  [/\bbank( of)?\b|\bstart(s|ing)? with \d+( units| points| chips)?\b|\bstarting (bank|points|units|balance|pot)\b|\b\d+ (units|starting points)\b/, "C:bank", 3],
  [/\bsplit (between|among|amongst) (everyone|all|those|the people|each|whoever)\b|\bsplit the pot\b|\bthe pot\b|\bpot (is |gets )?split\b|\bshare the points\b|\b(it|they|points) (is |are )?split\b|\beveryone right (splits|shares)\b/, "C:pot", 3],
  [/\bonly (pays? |scores? |counts? )?(if|when) (you are |they are )?the only (one|1)\b|\bthe only (one|1) (who|to|that) (called|calls|gets|got|picked|guessed)\b|\b(if|when) nobody else (called|calls|got|gets|picked)( it)?\b|\bnobody else (called|calls|got|gets|picked)( it)?\b|\bno one else (called|calls|got|gets)\b|\bonly (a|the) lone\b|\blone right\b/, "C:lone", 4],
  [/\bparlay\b(?! ticket)|\b(get|getting|if you get|you get) both( right)?\b|\bboth right\b|\ball right together\b/, "C:parlay", 3],
  [/\bticket\b|\b(more|the more) legs\b[^.;]{0,30}|\blegs\b|\bmore (wagers|objectives|guesses|picks) (you )?(pick |place |make )?(multiply|pays?)\b|\bbuild a (parlay )?ticket\b/, "C:ticket", 4],
  [/\broll(s|ed)? over\b|\brollover\b|\bjackpot\b|\bcarr(y|ies) over\b|\bpot grows\b|\b(if|when) (nobody|no one) (gets|calls|got|called|guesses|guessed) (it|right|it right)\b/, "C:jackpot", 4],
  // ---- Your team ----
  [/\bexclusive(ly)?\b|\b(nobody|no one|no two( of us)?) (can )?(share|shares|have the same|pick the same|draft the same|gets? the same)\b|\bonly (1|one) (of us|person) (can )?(have|own|draft)\b/, "C:draft:own=exclusive", 3],
  [/\bshared draft\b|\b(anyone|everyone|we) can (pick|have|draft) (the same|anyone)\b|\btwo of you (can )?have the same\b/, "C:draft:own=shared", 3],
  [/\bsnake( draft)?\b|\b(take|taking|by|in) turns\b|\bturn by turn\b/, "C:draft:order=snake", 2],
  [/\bin private\b|\bblind draft\b|\bdrafted in private\b/, "C:draft:order=blind", 3],
  [/\bbid(s|ding)?\b|\b\$\d+ to (bid|spend)\b/, "C:draft:order=auction", 3],
  [/\b(prices?|priced|costs? more|cost less|budget|under (a|the) cap|cap of)\b/, "C:cap", 2],
  [/\bbuy and sell\b|\btrad(e|es|ing) (castaways|players|them|people)\b|\blike shares\b|\bstocks?\b|\btrade\b/, "C:market", 3],
  [/\b(1|one) (castaway |player )?from each (tribe|team|group)\b|\bfrom each tribe\b|\bacross the (tribes|groups)\b|\bspread across\b/, "C:spread", 3],
  [/\b(a guy and a girl|a man and a woman|men and women|1 man and 1 woman|a boy and a girl|one of each gender)\b/, "C:spread:of=gender", 3],
  [/\bplus ?\d+ (or plus ?\d+ )?slots?\b|\bslots? (for|on your roster for) a (pair|team|duo)\b|\bextra slot\b|\b(pair|team|group) slots?\b|\bride with (them|it)\b|\briding with it\b/, "C:slots", 3],
  [/\bkeep(ing)? (\d+|some|a few) (of )?(your|their|last|from)\b|\bkeepers?\b|\bdynasty\b|\b(come|comes|coming) back next season\b/, "C:keepers", 3],
  [/\breplace(s|d|ment|ments)?\b|\bpick (someone|somebody|a) new when\b|\bwhen (one|1) (of yours )?(goes home|is out|leaves)\b/, "C:replacements", 2],
  [/\bwaivers?\b|\bfree agen(t|ts|cy)\b|\bswap (for|in) (someone|anyone|a castaway) (free|new)\b|\bpick(ing)? up\b/, "C:waivers", 2],
  // ---- Your pick ----
  [/\bwho stays\b|\bstays? in\b|\bsomeone who stays\b|\bpick (who|someone who) (survives|stays)\b/, "C:pickmeans:means=staysIn", 2],
  [/\bsomeone who scores\b/, "C:pickmeans:means=scores", 3],
  [/\bget (their|his|her) points\b|\bfor their points\b|\byou get (the points|what) they score\b/, "C:pickmeans:means=points", 3],
  [/\bnever (pick )?(the same|twice|again|repeat)( (castaway|one|player|person))?( twice| again)?\b|\bnot (the same|twice)\b|\bno repeats?\b|\bonly once\b|\bsame (castaway|one|player) twice\b/, "C:repeat:repeat=never", 3],
  [/\beven the same (one|castaway)( again)?\b|\bany time\b|\bsame one again\b/, "C:repeat:repeat=any", 2],
  [/\bdouble boot\b|\bpick (2|two) on\b|\b(2|two) go home\b/, "C:second", 3],
  // ---- The questions ----
  [/\bnew sheet\b|\bsheet (each|every) (week|episode)\b|\bsheet generated\b|\bgenerated (each|every) week\b|\brandomly generated\b|\bsheet of\b/, "C:card", 2],
  // ---- Scoring ----
  [/\bhow long they last\b|\bpoints? for (lasting|surviving|outlasting)\b|\bby (how long|place)\b/, "C:what:by=place", 2],
  [/\bno (weekly )?(lineups?|starters|line ups?)\b/, "C:size:plays=best", 3],
  [/\bonly (the )?[a-z]+( [a-z]+){0,3} (count|counts|score|scores|matter|matters)\b/, "C:only", 2],
  [/\bcaptain\b/, "C:captain", 4],
  [/\b(finale|final episode|last episode|the merge|merge episode|premiere)\b[^.;]{0,30}\b(counts?|worth|scores?|points)\b[^.;]{0,15}\b(double|triple|twice|x\d+)\b|\b(double|triple) points (in|for|at|on) the (finale|merge|premiere|final episode)\b/, "C:times", 4],
  [/\breverse\b|\b(the )?(earlier|sooner) (your )?(castaways? |players? )?(go|goes|are voted|get voted|leave)\b[^.;]{0,20}\bmore\b|\bfor going home first\b|\bpoints for going home\b|\bout early scores more\b/, "C:reverse", 3],
  [/\b(pick|picked|pickup|pick up|replacement|replacements|swap|swapped)\b[^.;]{0,40}\b(counts?|scores?|points? (count|counts))\b[^.;]{0,10}\b(half|double|less|more|x\d+|quartered|\d+(\.\d+)?x)\b/, "C:joined", 3],
  [/\bbount(y|ies)\b|\bsteal(s)?\b|\bvotes? out (mine|theirs|yours|someone else|another)\b/, "C:bounty", 3],
  [/\bsecret(ly)? traitors?\b|\b(are|is) (secretly |secret )?traitors?\b|\bsecret roles?\b/, "C:traitors", 3],
  [/\bscore(s)? when [^.;]{0,30}\b(banished|voted out|go home|goes home|get banished|gets banished)\b/, "C:traitors:on=votedOut", 1],
  [/\brotating host\b|\b(take turns|taking turns|rotate|a different (one|1) of us)\b[^.;]{0,40}\b(host|hosts|questions|writes|sets|setting)\b/, "C:host", 3],
  [/\btwist\b/, "C:toptwist", 2],
  [/\bmajority\b|\bwhat most of (us|you)\b|\bmost of (us|you) (will )?(say|pick)\b/, "C:majority", 3],
  [/\b(the )?(bot|ai|computer) (makes|guesses|picks|calls|plays|predicts)\b|\bbeat the (bot|ai|computer)\b|\b(right|correct) and (it|the bot|the ai) (is )?wrong\b|\bwhen (it|the bot) is wrong\b/, "C:beatbot", 4],
  [/\b(the )?(earlier|sooner) you (call|guess|pick|lock|make)\b[^.;]{0,30}\b(more|worth)\b|\bworth (a point |\d+ points? )?less (every|each|for each)\b[^.;]{0,25}|\bevery change costs\b[^.;]{0,10}|\bworth more early\b|\bearly (calls|picks|guesses) (pay|worth)\b/, "C:early", 4],
  [/\bevery change costs\b|\b(each|every) change you make\b/, "C:early:per=change", 4],
  // ---- Over the season ----
  [/\bnew draft (at|when) (the )?(merge|a stage|each stage)\b|\bredraft at\b|\bdraft again at\b/, "C:redraft", 4],
  [/\bshake ?ups?\b|\bformat change\b|\bwhenever (the show|there is|teams are)\b[^.;]*/, "C:shakeup", 3],
  [/\btwo halves\b|\bpre merge and post merge\b|\bseparate games\b/, "C:halves", 4],
  [/\btwo games at once\b|\bplus trivia\b|\balongside\b|\bat the same time\b/, "C:alongside", 3],
  [/\bside (draft|game)\b|\bwhile (a|the) pair(s)? last\b/, "C:sidegame", 3],
  // ---- The details ----
  [/\bdraft (clock|timer)\b|\bclock on each pick\b|\b\d+ min(ute)?s? (per|a|each) pick\b/, "C:room", 3],
  [/\b(late )?join(ers|ing)? (late|any ?time)\b|\banyone (on the couch )?can join\b|\blate joiners?\b/, "C:join:join=open", 3],
  [/\bnobody new\b|\bno (late )?joiners?\b|\blocked\b/, "C:join:join=locked", 3],
  [/\b(lineups? )?hidden\b|\bnobody sees (who|your)\b|\bsecret lineups?\b|\bhide (the |our |your )?lineups?\b/, "C:hidden", 3],

  // ---- what the menu can't make: hand it on ----
  [/\blive\b|\bwhile (it is|we are|we|they are|it) (on|airing|watch|watching)\b|\bduring the (episode|show|game)\b|\bmid ?episode\b|\bas (it|they) happens?\b|\bas we (watch|reach)\b|\bminute \d+\b|\bad breaks?\b|\bhalf ?time\b|\bhalfway mark\b|\bin sync\b|\btick live\b|\bpop up\b|\b\d+ minutes left\b|\bin real time\b/, "X:live play (A15)", 5],
  [/\bevery (play|at bat|drive|snap|pitch|possession)\b|\bnext (drive|play|pitch)\b/, "X:a call on every play (A15, L4)", 5],
  [/\bratings?\b|\bimdb\b|\btvmaze\b|\bviewers?hip\b/, "X:an outside number (the user turned down TVmaze ratings)", 5],
  [/\bno points shown\b|\bkids\b|\bhide (the )?points\b/, "X:nothing in the menu hides the points", 4],
  [/\bno negative( points)?\b|\bnothing (costs|loses) points\b|\bno (point )?(losses|deductions)\b|\bnever lose points\b|\bnobody loses points\b/, "X:points per moment (the menu has no control for a moment's points)", 4],
  [/\b(lock|locks|locking) later\b|\bwatch(es)? (a day|late|later)\b|\bday late\b|\bown lock\b/, "X:a late lock (no change in the menu sets it)", 4],
  [/\bleaderboard\b/, "X:an order of the points table (no question kind asks it)", 4],

  // ---- PEEK: added after the held-out corpus run, from its failures (--held-out drops them) ----
  [/\b(get|earn|score)s? points? for (winning|finding|surviving|each)\b|\bpoints? for (winning|finding|surviving) (\w+ )?(challenges?|immunity|idols?|quickfires?|eliminations?|elims?)\b/, "F:lineup", 2, { peek: true }],
  [/\b(can not|cannot|never) pick the same (person|castaway|one|player)( twice| again)?\b/, "C:repeat:repeat=never", 3, { peek: true }],
  [/\bties? (split|share|shared)\b/, "C:standing:allOut=share", 3, { peek: true }],
  [/\bif your pick (goes home|is out|is voted out),? you are out\b/, "C:standing:lives=1", 4, { peek: true }],
];

/** Words understood that set nothing (so they count as explained). */
const NOOPS = [
  /\b(each|every|per|a) (week|episode|night|ep)\b/, /\bbefore (each|every|the) (episode|week|premiere|it starts|the season)\b/, /\b(this|the) season\b/, /\bfor the season\b/,
  /\ball season\b/, /\bwhole season\b/, /\bfor survivor( \d+)?\b/, /\bmost (right|correct)( (answers|picks|guesses))? wins\b/, /\bmost (points )?wins\b/, /\bwhoever has the most\b/,
  /\bpoints? (for|if|per) (each|every|a) (right|correct)( (one|answer|pick|guess))?\b/, /\bif you are right\b/, /\b(right|correct) (trivia )?(answers?|picks?|guesses?|calls?|questions?)\b/,
  /\bthen (just )?watch\b/, /\bjust watch\b/, /\bwatch it play out\b/, /\bthe couch\b/, /\b(our|my) (couch|friends|group|family)\b/,
  /\bbingo (cards?|lines?|sheets?|squares?)\b/, /\b(lines?|squares?) (are|is) worth\b/, /\bcast members?\b/, /\bas (many|much) [a-z ]{0,20} as possible\b/, /\b(most|least) likely( to go home)?\b/,
  /\bwhoever (goes|is out|goes home)\b/, /\b(a|the) line\b/, /\bthe results\b/, /\bcalled once\b/, /\bit is worth\b/, /\b(an |the )?overall (winner|standings|champion|score)\b/, /\bfor the next week\b/,
  /\bgo back (in|into) the pool\b|\bback (in|into) the pool\b|\bback up for grabs\b/, /\bthe (better|longer) (they are|they) (doing|do|last)\b/, /\bwhile (they are|it is) (yours|on your team)\b/,
];

// ---------- questions: what a game of questions asks ----------
// [regex, kind (a QUESTION_KINDS id, or "top" which only a base carries), { weak }]: a weak match ("goes home" with no "who") counts
// for a game of questions with nothing else asked, and never adds a draft's own question.
const QUESTIONS = [
  [/\bwho (is |will )?(go|goes|going|get|gets|getting|is getting) (home|voted out|booted|eliminated|the boot|sent home|cut)\b|\bwho (leaves|will leave|is leaving)\b|\b(the|a|your|their|each) boot(?! order)( call| pick)?s?\b|\bboot (call|calls|pick|picks)\b|\bcall(s|ed)? the boot\b|\bwho (is|will be|would be) (gone|out|eliminated|voted out|banished)\b|\bwho (gets|is) voted off\b|\bwho( will)? be gone\b|\bsomeone who will be gone\b|\bwho (went|goes) home\b/, "out"],
  [/\bgoes home\b|\bgoing home\b|\bvoted off\b|\bbanished\b/, "out", { weak: true }],
  [/\bwho (wins|will win|is going to win|takes it all|won)\b(?! (immunity|reward|the (immunity|reward|challenge|elimination|tribal|head|fire)|a (challenge|reward)|individual|tribe))|\bthe (season )?winner\b(?! of)|\bsole survivor\b|\bwinner pick\b|\bseason winner\b|\bwho takes the title\b/, "winner"],
  [/\bfinal (\d+)\b|\btop (\d+)\b(?! (count|counts|score|scores|play|meet|make|go|of))|\bfinal few\b|\bfinalists?\b/, "top"],
  [/\bwhich (tribe|team|couple|group|alliance)\b|\btribe (winner|wins|immunity)\b|\bwinning tribe\b/, "group", { hint: "tribe immunity" }],
  [/\bwho (wins|will win|won|gets|takes) (the |an? )?(individual )?(immunity|reward|challenge|elimination|head to head|fire( making)?)\b|\b(immunity|reward|challenge|elimination) winners?\b/, "who"],
  [/\bwho (finds|will find|gets|plays|will play|uses|goes on|is sent to|goes to|is sent on|makes) (an? |the |their |a hidden )?(idol|advantage|journey|exile|shot in the dark|extra vote)\b/, "who"],
  [/\b(will|does|is|did) (an?|any|anyone|someone|somebody|there be an?|there be any) [a-z ]{0,25}\b(idol|advantage|blindside|journey|exile|tie|rock draw|fire|medevac|quit)\b|\b(an? )?(idol|advantage|journey) (be )?(played|found|used)\b|\bwhether (an? )?[a-z ]{0,20}(idol|advantage|journey|exile)( is| be| gets)?( found| played| used)?\b/, "happens"],
  [/\bhow many (\w+ ){0,3}(idols?|advantages?|votes|tribals?|journeys?|confessionals?|times)\b/, "count"],
  [/\bover under\b|\bover or under\b/, "ou"],
  [/\bwho (does it|cries|\w+s) (the )?most\b|\bwho (\w+ ){1,3}the most\b|\bmost (confessionals|idols|immunity wins|tears)\b/, "most"],
  [/\bwho (\w+ ){0,2}first\b(?! (to \d+|place))/, "first"],
  [/\b(boot|elimination) order\b|\b(the )?order (they|people|castaways|players|everyone|contestants) (go|leave|are voted)\b|\bin (the )?order\b/, "order"],
  [/\bconfidence\b|\bsurest first\b|\brank (everyone|them|the cast|who goes|who is going)\b/, "confidence"],
  [/\bchips\b/, "chips"],
  [/\bvote split\b|\bfinal (tribal |jury )?vote\b/, "split"],
  [/\bwho outlasts whom\b|\b\d+ (random )?pairs\b|\bpairs of (castaways|players)\b/, "pairs"],
  [/\bwho (is|are) (a |the |secretly a |the secret )?(traitor|traitors|mole|saboteur)\b/, "role"],
  [/\bwhich episode (the )?\w+ (happens|is|will be|comes)\b|\bwhen (the )?(merge|swap|jury) (happens|is|comes)\b/, "phase"],
  [/\bwho leads (the )?points\b/, "leader"],
  [/\btitle quote\b|\bsays the (episode )?title\b/, "quote"],
  [/\btrivia\b|\bquiz\b/, "trivia"],
];

/** A question kind's signature (what it's answered with and what settles it), for matching a base's questions. */
const KIND_SIG = {
  out: "person|results:out", winner: "person|results:winner", top: "person|results:top", who: "person|moment:who", happens: "yesNo|moment:happened",
  count: "number|moment:count", ou: "overUnder|moment:count", most: "person|moment:most", first: "person|moment:first", group: "group|moment:who",
  order: "order|results:order", confidence: "confidence|results:out", chips: "chips|results:winner", split: "split|results:split", pairs: "pairs|results:outlast",
  role: "person|role:end", phase: "number|phase:starts", leader: "person|points:most", quote: "person|fact:who", trivia: "trivia|trivia:", choice: "choice|moment:count",
};
const MOMENT_KINDS = new Set(["who", "happens", "count", "ou", "most", "first", "group", "choice"]);

// ---------- numbers: each number to the slot nearest its words ----------
// [regex (its last number is the one bound), slot]. A slot is a change's control ("race.to"), a question's ("q.points"), the
// length ("len.*"), the page's ("page": a season's number), or a word the binder resolves by the game ("each", "lives", "budget").
const N_ = "(\\d+(?:\\.\\d+)?)";
const SLOTS = [
  [new RegExp(`\\b(survivor|season|traitors|challenge|race|deck|island|brother|stars|bachelor|bachelorette|idol|s|ep|series) ${N_}\\b(?! (each|players|castaways|lives|teams|points))`), "page"],
  [new RegExp(`\\b${N_}(st|nd|rd|th) season\\b`), "page"],
  [/\b((19|20)\d\d)\b/, "page"],
  [new RegExp(`\\bepisodes? ${N_} (to|through|and|-) ${N_}\\b`), "len.range"],
  [new RegExp(`\\b(after|from|starting( at| with| from)?|beginning( at| with)?|until|till|up to|through|before) (episode|ep|week) ${N_}\\b`), "len.at"],
  [new RegExp(`\\b(episode|ep|week) ${N_}\\b`), "len.at"],
  [new RegExp(`\\bwithin the next ${N_}\\b|\\b(in|over) the next ${N_} (episodes|weeks)\\b`), "q.over"],
  [new RegExp(`\\b(next|first|last) ${N_} (episodes|weeks)\\b(?! (count|score))`), "len.n"],
  [new RegExp(`\\bevery ${N_} (episodes|weeks)\\b`), "every"],
  [new RegExp(`\\b${N_} (shared )?(lives|life|strikes)\\b|\\blives of ${N_}\\b`), "lives"],
  [new RegExp(`\\b${N_} mulligans?\\b|\\bmulligans? of ${N_}\\b`), "standing.mulligans"],
  [new RegExp(`\\b${N_} buy ?backs?\\b|\\bbuy ?backs? of ${N_}\\b|\\bbuy back in ${N_} times?\\b`), "standing.buyback"],
  [new RegExp(`\\b(first|race|racing|races)( one| team| person| player)? to (reach |get to |hit )?${N_}\\b|\\btarget of ${N_}\\b|\\b${N_} points wins\\b`), "race.to"],
  [new RegExp(`\\b(into|in|split into|divided into|split us into) ${N_} teams\\b|\\b${N_} teams\\b`), "teams.of"],
  [new RegExp(`\\btop ${N_} (meet|play|go to|make|in) (a |the )?(final|playoffs?)\\b|\\b${N_} team playoffs?\\b|\\bplayoffs? (of|with|for the top) ${N_}\\b|\\btop ${N_} (make|go to) the playoffs\\b`), "matchups.playoffs"],
  [new RegExp(`\\b(lowest|bottom|worst|last) ${N_}\\b|\\b${N_} (are|is|get|go|goes)? ?(out|cut|eliminated|knocked out)\\b`), "knockouts.out"],
  [new RegExp(`\\b${N_} (bonus )?points? (a|per|each|every) (week|episode)\\b(?=[^.;]{0,40}\\b(newcomer|new|head start|bonus|handicap))|\\b(newcomers?|new (players|people)|first timers?)\\b[^.;]{0,30}\\b${N_} (bonus )?points?\\b|\\b${N_} (bonus )?points? head start\\b|\\b(newcomers?|new (players|people))\\b[^.;]{0,30}\\ba point a week\\b`), "handicap.points"],
  [new RegExp(`\\b(for|with)? ?(about |around |like )?${N_} (of us|people|friends|players|person (group|chat|office)|of my friends)\\b(?! (are|is|will|share|on|hold|each|secretly|get))|\\b(family|group|couch|league) of ${N_}\\b|\\ba ${N_} (team|person|player) (\\w+ )?league\\b`), "couch", { peek: true }],
  [new RegExp(`\\b(start|starts|starting|begin|begins) (with |out with )(a )?(bank of |balance of )?${N_}\\b|\\b(start|starts|starting) (a )?(bank of |balance of )${N_}\\b|\\b(bank|balance) of ${N_}\\b|\\b${N_} (units|starting points)\\b|\\bstarting (bank|balance|points|pot) (of )?${N_}\\b|\\bfrom ${N_} starting points\\b`), "bank.start"],
  [new RegExp(`\\b(stake|bet|wager) up to ${N_}\\b|\\bup to ${N_} (points )?(on|per)\\b`), "stake.most"],
  [new RegExp(`\\b${N_} points? (an? (episode|week) )?(is )?(split|shared|pot)\\b|\\b${N_} point pot\\b|\\bpot of ${N_}\\b`), "pot.pot"],
  [new RegExp(`\\$${N_}\\b|\\b${N_} (dollars|bucks|to spend|to bid|budget)\\b|\\b(cap|budget) of ${N_}\\b|\\bunder (a|the) ${N_} cap\\b`), "budget"],
  [new RegExp(`\\bkeep ${N_}\\b`), "keepers.each"],
  [new RegExp(`\\b${N_} (of us|of you|people|players)? ?(are|is|will be)? ?(secret(ly)? )?traitors?\\b|\\b${N_} traitors?\\b`), "traitors.count"],
  [new RegExp(`\\bsteal(s)? ${N_}\\b|\\btake ${N_} points from\\b|\\b${N_} points? bount(y|ies)\\b|\\bbount(y|ies) (of|worth) ${N_}\\b`), "bounty.points"],
  [new RegExp(`\\bplus ?${N_} (or plus ?\\d+ )?slots?\\b|\\b${N_} (extra )?slots?\\b`), "slots.slots"],
  [new RegExp(`\\bplus ?${N_} or plus\\b`), "slots.alt"],
  [new RegExp(`\\b${N_} (of us|people) (share|on (one|a) team)\\b`), "share.people"],
  [new RegExp(`\\b${N_} chips\\b`), "q.chips"],
  [new RegExp(`\\b${N_} (random )?pairs\\b`), "q.pairs"],
  [new RegExp(`\\b${N_}\\.5\\b`), "q.line"],
  [new RegExp(`\\bwithin ${N_} (spots|places|of)\\b`), "q.within"],
  [new RegExp(`\\b${N_} (questions|lines|things|squares|calls|guesses|objectives|goals)\\b`), "lines"],
  [new RegExp(`\\b(final|top) ${N_}\\b`), "top"],
  [new RegExp(`\\bbest ${N_} of ${N_}\\b`), "size.bestof"],
  [new RegExp(`\\b(best|top) ${N_} (count|counts|score|scores|play|of them|of your)\\b|\\b(start|starts|starting|play|plays|choose|use) ${N_} (each|every|a|per|to play|starters|of them|players? each)\\b|\\b${N_} (play|start|starters|count|counts|score) (each|every)\\b`), "size.n"],
  [new RegExp(`\\b(draft|drafts|drafting|pick|picks|picking|choose|chooses|take|takes) (a team of |teams of |rosters? of )?${N_}(?! (to|from each|of you|of us|lives|points|teams|times|(castaways? |players? )?from each))\\b|\\b(team|roster|teams|rosters) of ${N_}\\b|\\b${N_} (castaways|players|contestants|people|houseguests|cast members|each|apiece)\\b(?! (from each|share))|\\b${N_} person teams?\\b|\\bbest \\d+ of ${N_}\\b`), "each"],
  [new RegExp(`\\b(worth|for|gets?|earn|earns|scores?) ${N_} points?\\b|\\b${N_} points? (for|if|per|each|a|an)\\b|\\b${N_}( |-)points?\\b`), "q.points"],
];
const MULT_RE = /\bx(\d+(?:\.\d+)?)\b|\b(\d+(?:\.\d+)?) times\b|\b(double|doubles|doubled|twice|triple|triples|tripled|quadruple|halved|quartered)\b|\b(half|quarter) (points|as much|the points)\b|\bat half\b|\b(count|counts|score|scores) half\b/g;

/** The numbers a request states (after its number words become digits): the harness's "said" match. */
function numbersIn(text) {
  const t = normalize(text);
  const out = [];
  for (const m of t.matchAll(/(?<![a-z])\$?(\d+(?:\.\d+)?)(?![a-z0-9])/g)) out.push(Number(m[1]));
  for (const m of t.matchAll(/\bx(\d+(?:\.\d+)?)\b/g)) out.push(Number(m[1]));
  return [...new Set(out)];
}

// ---------- matching ----------

const READ_OPTS = { heldOut: false };

function cuesIn(t) {
  const out = [];
  for (const [re, target, w, extra] of CUES) {
    if (extra && extra.peek && READ_OPTS.heldOut) continue;
    if (extra && extra.held && !READ_OPTS.heldOut) continue; // the held-out lexicon's own entry, replaced by a peek entry
    for (const m of t.matchAll(new RegExp(re.source, "g"))) out.push({ target, w, start: m.index, end: m.index + m[0].length, text: m[0] });
  }
  return out;
}

const STEM = (w) => w.replace(/(ies)$/, "y").replace(/(es|s|ed|ing)$/, "");
/** The page's moment some words are about: the one whose label shares the most content words with them. */
function momentFor(text, pg, kind) {
  const words = new Set((text.match(/[a-z]+/g) || []).filter((w) => w.length >= 4 && !STOP.has(w)).map(STEM));
  let best = null;
  for (const m of (pg && pg.moments) || []) {
    const content = ((m.label || m.id).toLowerCase().match(/[a-z]+/g) || []).filter((w) => w.length >= 4 && !STOP.has(w) && !["their", "with", "against", "them", "used", "being"].includes(w)).map(STEM);
    let s = content.filter((w) => words.has(w)).length;
    if (!s) continue;
    if (/idol|advantage/.test(m.id)) {
      if (/\b(find|found|get|got|gets|finds)\b/.test(text) && m.id === "idolFound") s += 1.5;
      if (/\b(play|played|plays|use|used)\b/.test(text) && m.id === "idolPlayed") s += 1.5;
      if (/cancel|negat/.test(text) && m.id === "votesNegated") s += 2;
    }
    if (kind === "group" && /tribe|team/.test(`${m.id} ${(m.label || "").toLowerCase()}`)) s += 2;
    if (kind !== "group" && /^tribe/.test(m.id) && !/tribe/.test(text)) s -= 1;
    if (/runner|third|2nd|3rd/i.test(`${m.id} ${m.label}`) && !/(second|third|2nd|3rd|runner)/.test(text)) s -= 1;
    s -= content.length * 0.05; // a shorter label that matches is a closer one
    if (!best || s > best.s) best = { id: m.id, s };
  }
  return best && best.s > 0.5 ? best.id : null;
}

function questionsIn(t, pg) {
  const out = [];
  for (const [re, kind, extra] of QUESTIONS) {
    for (const m of t.matchAll(new RegExp(re.source, "g"))) {
      if (out.some((q) => m.index < q.end && m.index + m[0].length > q.start)) continue; // the first (most specific) pattern wins a span
      const q = { kind, start: m.index, end: m.index + m[0].length, text: m[0], weak: !!(extra && extra.weak) };
      if (MOMENT_KINDS.has(kind)) {
        // The question's own words first; a few words after it when they don't name one ("who finds one: an idol?").
        q.moment = momentFor(`${(extra && extra.hint) || ""} ${m[0]}`, pg, kind) || momentFor(t.slice(m.index, Math.min(t.length, m.index + m[0].length + 25)), pg, kind);
      }
      if (kind === "top") q.pick = Number((m[0].match(/\d+/) || [3])[0]);
      out.push(q);
    }
  }
  // The same question said twice is one question.
  const seen = new Set();
  return out.sort((a, b) => a.start - b.start).filter((q) => {
    const k = `${q.kind}@${q.moment || ""}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ---------- typos: a word the menu doesn't know, one edit from one it does ----------

let VOCAB = null;
function vocab() {
  if (VOCAB) return VOCAB;
  const m = M.menu();
  const text = [
    ...m.bases.flatMap((b) => [b.name, b.plain, b.about, b.effort]),
    ...m.changes.flatMap((c) => [c.name, c.line, ...c.controls.flatMap((k) => [k.label, ...k.options.map((o) => `${o.label} ${o.sub || ""}`)])]),
    ...m.questions.map((q) => q.name),
    ...CUES.map(([re]) => re.source.replace(/\\[a-zA-Z]/g, " ")),
    ...QUESTIONS.map(([re]) => re.source.replace(/\\[a-zA-Z]/g, " ")),
    [...STOP, ...FILLER].join(" "),
    "survivor traitors challenge castaway castaways tribe tribes merge immunity idol idols reward jury tribal blindside vote voted votes contestant contestants houseguest cast",
  ].join(" ");
  const freq = new Map();
  for (const w of text.toLowerCase().match(/[a-z]{3,}/g) || []) freq.set(w, (freq.get(w) || 0) + 1);
  VOCAB = freq;
  return VOCAB;
}
function distance(a, b) {
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 2) return 3;
  const d = Array.from({ length: la + 1 }, (_, i) => [i, ...Array(lb).fill(0)]);
  for (let j = 1; j <= lb; j++) d[0][j] = j;
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[la][lb];
}
/** Each word the menu and the page don't know, six letters or more, to the nearest word they do (one edit; two from nine letters).
 *  Shorter words aren't touched: too many real words are one edit from a menu word ("stick" from "stock"). */
function fixTypos(t, pageWords) {
  const V = vocab();
  const fixed = [];
  const out = t.replace(/[a-z]{6,}/g, (w) => {
    if (V.has(w) || pageWords.has(w) || V.has(w.replace(/s$/, "")) || V.has(w.replace(/(ed|ing|es)$/, ""))) return w;
    let best = null;
    for (const [v, f] of V) {
      if (v.length < 5 || Math.abs(v.length - w.length) > 2) continue;
      const d = distance(w, v);
      const ok = d === 1 || (d === 2 && w.length >= 9);
      if (ok && (!best || d < best.d || (d === best.d && f > best.f))) best = { v, d, f };
    }
    if (!best) return w;
    fixed.push(`${w}>${best.v}`);
    return best.v;
  });
  return { t: out, fixed };
}

// ---------- the bases' own parts ----------

/** Changes on by default (not ones a request would have to ask for). */
const QUIET = new Set(["size", "draft", "pool", "pickmeans", "repeat", "what", "room", "join", "couch", "total", "nobets", "onegame", "shows", "card", "streak"]);
const onIn = (s) => new Set(C.CHANGES.filter((c) => !c.coming && c.on && (() => { try { return c.on(s); } catch { return false; } })()).map((c) => c.id));
const asksOf = (s) => (Array.isArray(s.ask) ? s.ask : s.preset && S.PRESETS[s.preset] ? S.PRESETS[s.preset].ask || [] : []);
const BASE_INFO = new Map();
function baseInfo(id, pg) {
  const key = `${id}@${(pg && pg.show) || ""}${(pg && pg.from) || ""}`;
  if (BASE_INFO.has(key)) return BASE_INFO.get(key);
  const b = C.baseById(id);
  let info = { id, ok: false, kind: null, on: new Set(), asks: [] };
  if (b && b.spec) {
    try {
      const s = C.baseSpec(b, { from: (pg && pg.from) || 1, to: b.len === "1 episode" ? (pg && pg.from) || 1 : null }, pg);
      const on = new Set([...onIn(s)].filter((c) => !QUIET.has(c)));
      info = { id, ok: true, kind: C.kindOf(s), on, asks: asksOf(s).map((q) => ({ id: q.id, sig: O.sigOf(q), ask: q.ask, card: !!q.card, ticket: q.answer === "ticket" })), spec: s };
    } catch {
      /* a base that won't build on this page */
    }
  }
  BASE_INFO.set(key, info);
  return info;
}
const DRAFT_LINEUP = ["fantasy", "h2h", "bestball", "auction", "cap", "market", "guillotine", "teams", "race", "twist"];
const DRAFT_PLACE = ["outlast", "reverse", "hat", "spread", "traitors", "bounty"];
const QUESTION_BASES = ["solo", "sheet", "seasonpred", "bootorder", "most", "calls", "overunder", "pairs", "split", "quote", "seal", "bank", "props", "parlay", "pot", "double", "jackpot", "coop", "trivia", "host", "majority", "beatbot", "confidence"];
const PICK_BASES = ["pool", "lives", "norepeat", "picks", "objectives", "h2hpicks"];
const QUESTION_CHANGES = new Set(["stake", "bank", "pot", "lone", "jackpot", "double", "parlay", "ticket", "beatbot", "majority", "early", "coop", "host"]);
/** Squares that are one change on a plainer square: named in an edit, they're that change on the current game. */
const BASE_AS_CHANGE = { redraft: "redraft", halves: "halves", coop: "coop", traitors: "traitors", host: "host", majority: "majority", bounty: "bounty", twist: "toptwist", beatbot: "beatbot", jackpot: "jackpot", parlay: "parlay", pot: "pot", double: "double", spread: "spread", keeper: "keepers", reverse: "reverse", race: "race", teams: "teams", h2h: "matchups", h2hpicks: "matchups", guillotine: "knockouts", lives: "standing", norepeat: "repeat", cap: "cap", market: "market", auction: "draft", hat: "draft", bestball: "size" };

// ---------- reading ----------

/** A request read: { order, sure, why[], trace, built }. With opt.current (an order), a sentence read against that game:
 *  { ops, order (the current game with the ops made), sure, why[], trace, built }. */
function read(text, pg, opt = {}) {
  const current = opt.current || null;
  const why = [];
  const trace = {};
  const pageWords = new Set([
    ...(String((pg && pg.show) || "").toLowerCase().match(/[a-z]+/g) || []),
    ...((pg && pg.cast) || []).flatMap((c) => String((c && c.name) || c).toLowerCase().match(/[a-z]+/g) || []),
    ...((pg && pg.cast) || []).map((c) => String((c && c.group) || "").toLowerCase()).filter(Boolean),
    ...((pg && pg.moments) || []).flatMap((m) => String(m.label || "").toLowerCase().match(/[a-z]+/g) || []),
    ...((pg && pg.phases) || []).flatMap((p) => String(p.name || p.id || "").toLowerCase().match(/[a-z]+/g) || []),
  ]);
  if (!READ_OPTS.heldOut) {
    // PEEK: the show's initials ("dwts", "snl") are the page's words; people's words carry nothing for the game.
    const initials = String((pg && pg.show) || "").toLowerCase().replace(/[^a-z ]/g, " ").split(/\s+/).filter(Boolean).map((w) => w[0]).join("");
    if (initials.length >= 3) pageWords.add(initials);
    for (const w of PEEK_FILLER) pageWords.add(w);
  }
  let norm = normalize(text);
  if (!READ_OPTS.heldOut) for (const [re, to] of PEEK_SHORT) norm = norm.replace(re, to);
  const typo = fixTypos(norm, pageWords);
  const t = typo.t;
  trace.text = t.trim();
  if (typo.fixed.length) trace.typos = typo.fixed;
  const covered = new Array(t.length).fill(false);
  const cover = (a, b) => {
    for (let i = a; i < b; i++) covered[i] = true;
  };

  // 1. cues, questions, understood words
  let cues = cuesIn(t);
  // "it only scores if nobody else called it" is a lone right answer, not Only some moments
  cues = cues.filter((c) => !(c.target === "C:only" && cues.some((x) => x.target !== "C:only" && x.target.startsWith("C:") && x.start < c.end && x.end > c.start)));
  // The longer phrase wins: "whenever there is a format change such as split into teams" is a redraft, not In teams.
  const cid = (c) => c.target.split(":")[1];
  cues = cues.filter((c) => !(c.target.startsWith("C:") && cues.some((x) => x !== c && x.target.startsWith("C:") && cid(x) !== cid(c) && x.start <= c.start && x.end >= c.end && x.end - x.start > c.end - c.start)));
  const qsAll = questionsIn(t, pg);
  for (const c of cues) cover(c.start, c.end);
  for (const q of qsAll) cover(q.start, q.end);
  for (const re of NOOPS) for (const m of t.matchAll(new RegExp(re.source, "g"))) cover(m.index, m.index + m[0].length);
  for (const x of new Set(cues.filter((c) => c.target.startsWith("X:")).map((c) => c.target.slice(2)))) why.push(`can't: ${x}`);

  // 2. what it names: families, bases, changes (each with its own words' option), negated ones
  const fam = {};
  const bscore = {};
  for (const c of cues) {
    if (c.target.startsWith("F:")) fam[c.target.slice(2)] = (fam[c.target.slice(2)] || 0) + c.w;
    if (c.target.startsWith("B:")) bscore[c.target.slice(2)] = Math.max(bscore[c.target.slice(2)] || 0, c.w);
  }
  const negated = (c) => {
    const before = t.slice(Math.max(0, c.start - 22), c.start);
    const clause = before.split(/[,.;:!?]/).pop();
    return NEG.test(clause) && !NEG.test(c.text.split(" ")[0]);
  };
  const changes = new Map();
  const dropped = new Set();
  for (const c of cues) {
    if (!c.target.startsWith("C:")) continue;
    const [, id, set] = c.target.split(":");
    if (negated(c)) {
      dropped.add(id);
      continue;
    }
    const ch = changes.get(id) || { id, controls: {}, w: 0, text: c.text };
    ch.w = Math.max(ch.w, c.w);
    if (set) {
      const [k, v] = set.split("=");
      ch.controls[k] = v === "true" ? true : v === "false" ? false : /^\d+(\.\d+)?$/.test(v) ? Number(v) : v;
    }
    changes.set(id, ch);
  }
  for (const id of dropped) if (changes.has(id) && !Object.keys(changes.get(id).controls).length) changes.delete(id);
  if (changes.has("only")) {
    const c = cues.find((x) => x.target === "C:only");
    const ms = (pg.moments || []).filter((m) => momentFor(c.text, { moments: [m] }, "who"));
    if (ms.length) changes.get("only").moments = ms.slice(0, 3).map((m) => m.id);
    else why.push(`a moment to count that research doesn't answer here ("${c.text.trim()}")`);
  }
  // A question removed by name ("drop the idol question"), for a game that has it.
  const dropQ = [];
  const dq = t.match(/\b(drop|remove|take off|get rid of|no more|lose|without) the ([a-z ]{1,25}?) (question|guess|call)\b/);
  trace.families = fam;
  trace.bases = bscore;
  trace.changes = [...changes.keys()];
  if (dropped.size) trace.negated = [...dropped];

  // 3. the base
  let cur = null;
  if (current) {
    const b = O.build(current, pg);
    cur = { order: current, spec: b.spec, kind: b.spec ? C.kindOf(b.spec) : null, on: b.spec ? onIn(b.spec) : new Set(), asks: b.spec ? asksOf(b.spec) : [] };
    if (dq) {
      const words = dq[2].split(" ").filter((w) => w.length > 2);
      for (const q of cur.asks) if (words.some((w) => `${q.ask} ${q.id}`.toLowerCase().includes(w))) dropQ.push(q.id);
      if (dropQ.length) cover(dq.index, dq.index + dq[0].length);
      else why.push(`no question "${dq[2]}" in this game`);
    }
  }
  const askedChanges = new Set(changes.keys());
  // Questions: a weak "goes home" only counts in a game of questions that asks nothing else.
  let qs = qsAll.filter((q) => !q.weak || !qsAll.some((x) => !x.weak));
  trace.questions = qs.map((q) => `${q.kind}${q.moment ? `@${q.moment}` : ""}${q.weak ? "~" : ""}`);
  const fitScore = (id) => {
    const info = baseInfo(id, pg);
    if (!info.ok) return -99;
    let s = (bscore[id] || 0) * 3;
    for (const c of info.on) s += askedChanges.has(c) ? 1 : -2;
    if (info.kind === "questions") {
      const have = info.asks.filter((q) => !q.card && !q.ticket);
      const want = qs.map((q) => KIND_SIG[q.kind] + (q.moment ? `|${q.moment}` : ""));
      const covers = want.filter((w) => have.some((h) => h.sig.startsWith(w))).length;
      s += covers * 2 - Math.max(0, have.length - covers) * (qs.length ? 1 : 0);
      if (id === "solo") s += 0.5; // the plain game of questions, on a tie
    }
    return s;
  };
  const best = (ids) => ids.map((id) => [id, fitScore(id)]).sort((a, b) => b[1] - a[1])[0] || [null, -99];
  const strong = Object.entries(bscore).filter(([, w]) => w >= 3).map(([id]) => id);
  let base = null;
  let named = false;
  // An edit that names a square which is also a change ("a new draft at the merge", "add bounties") makes the change.
  const asChange = (id) => BASE_AS_CHANGE[id] && changes.has(BASE_AS_CHANGE[id]);
  if (cur && !strong.some((id) => !asChange(id) && ((baseInfo(id, pg).ok ? baseInfo(id, pg).kind : "x") !== cur.kind || M.baseOf(id).state !== "ready"))) {
    base = current.base; // an edit keeps its game unless the sentence names another kind
    named = true;
  } else if (strong.length) {
    named = true;
    if (strong.includes("bingo") && strong.includes("trivia")) base = "bingotrivia";
    else {
      const kinds = new Set(strong.map((id) => (baseInfo(id, pg).ok ? baseInfo(id, pg).kind : M.baseOf(id).state)));
      base = best(strong)[0];
      if (kinds.size > 1 && !strong.some((id) => ["redraft", "halves", "minis", "twoshows", "keeper"].includes(id))) why.push(`two kinds of game named (${strong.join(", ")})`);
    }
  } else {
    const lineup = (fam.lineup || 0) + (changes.has("captain") || changes.has("market") || changes.has("cap") || changes.has("hidden") ? 2 : 0) + (bscore.fantasy || 0);
    const place = (fam.place || 0) + (changes.has("reverse") || changes.has("bounty") || changes.has("traitors") ? 2 : 0) + (changes.has("what") && changes.get("what").controls.by === "place" ? 2 : 0);
    const draftish = fam.draft || fam.lineup || fam.place || bscore.fantasy || ["captain", "market", "cap", "draft", "size", "spread", "slots", "keepers", "replacements", "hidden", "reverse", "bounty", "traitors"].some((x) => changes.has(x));
    const pickish = fam.pick || ["pickmeans", "second", "repeat"].some((x) => changes.has(x));
    const questionish = qs.length || fam.questions || fam.bets || [...QUESTION_CHANGES].some((x) => changes.has(x));
    named = !!(fam.draft || fam.lineup || fam.place || fam.pick || fam.questions || fam.bets || qs.length || bscore.fantasy);
    if (draftish && !(pickish && !fam.draft)) {
      if (lineup > place) base = best(DRAFT_LINEUP)[0];
      else if (place > lineup) base = best(DRAFT_PLACE)[0];
      else {
        base = READ_OPTS.heldOut ? best(DRAFT_PLACE)[0] : best(DRAFT_LINEUP)[0]; // PEEK: the guess is the gallery's first square
        why.push("a draft, but not whether it scores what they do or how long they last");
      }
    } else if (pickish) base = best(PICK_BASES)[0];
    else if (questionish && (qs.some((q) => !q.weak) || !(changes.has("standing") || changes.has("streak")))) {
      base = best(QUESTION_BASES)[0];
      if (!qs.length && !Object.keys(bscore).length) why.push("a game of guesses, but not which guesses");
    } else if (changes.has("standing") || changes.has("streak")) base = best(PICK_BASES)[0];
    else if (Object.keys(bscore).length) base = Object.entries(bscore).sort((a, b) => b[1] - a[1])[0][0];
    else if (changes.size) {
      // Only a change named ("First to 20 points wins"): the gallery's first square its row is offered on, as a guess.
      const ids = [...changes.keys()];
      base = ids.every((id) => !M.changeOf(id).kinds || M.changeOf(id).kinds.includes("draft")) ? "fantasy" : "solo";
    }
  }
  if (!base) return finish(null, [...why, "no base: nothing in it names a kind of game"]);
  if (!named) why.push(`no game named (${M.baseOf(base).name} assumed)`);
  let bm = M.baseOf(base);
  if (bm.state === "coming") why.push(`${bm.name} is coming (${bm.coming})`);
  if (bm.state === "needs") {
    if (base === "keeper") {
      base = best(fam.lineup ? DRAFT_LINEUP : DRAFT_PLACE)[0];
      if (!fam.lineup && !fam.place) why.push("keepers, but not whether the draft scores what they do or how long they last");
    } else why.push(`${bm.name} needs ${bm.needs || "its own setup (a sheet)"}`);
  }
  // The square that already has what's asked: a sibling of the same kind with more of the asked changes on and none unasked
  // ("a Survival Pool, but head to head" is Head-to-head picks, not a pool with a final added).
  if (!cur && baseInfo(base, pg).ok) {
    const mine = baseInfo(base, pg);
    const pool = [...DRAFT_LINEUP, ...DRAFT_PLACE, ...QUESTION_BASES, ...PICK_BASES].filter((id) => id !== base && baseInfo(id, pg).ok && baseInfo(id, pg).kind === mine.kind);
    const gain = (info) => [...info.on].filter((c) => askedChanges.has(c)).length;
    const extra = (info) => [...info.on].filter((c) => !askedChanges.has(c)).length;
    const sib = pool.map((id) => baseInfo(id, pg)).filter((x) => extra(x) === 0 && gain(x) > gain(mine) && (x.kind !== "questions" || qs.length === 0 || fitScore(x.id) >= fitScore(base) - 1)).sort((a, b) => gain(b) - gain(a))[0];
    if (sib && extra(mine) === 0) base = sib.id;
  }
  bm = M.baseOf(base);
  const info = baseInfo(base, pg);
  const kind = cur && base === current.base ? cur.kind : info.kind;
  const isOn = (id) => (cur && base === current.base ? cur.on.has(id) : info.on.has(id));

  // 4. the changes this kind of game takes
  const order = { base, changes: [] };
  const offered = (id) => {
    const c = M.changeOf(id);
    return c && (!c.kinds || c.kinds.includes(kind));
  };
  for (const [id, ch] of changes) {
    if (id === "card" && ["props", "objectives", "host"].includes(base)) continue; // the base's own sheet
    if (id === "pickmeans" && kind !== "pick") continue;
    if (id === "draft" && kind !== "draft") continue;
    if ((id === "stake" || id === "double") && ["bank", "props"].includes(base)) continue; // a bank's own stakes
    if (id === "standing" && changes.has("coop")) continue; // shared lives are Together's
    if (id === "standing" && kind === "draft" && !/\blives\b|\bmulligan|\bbuy ?back/.test(t)) continue; // "last one standing" on a draft is Outlast's
    if (id === "matchups" && base === "h2hpicks") continue;
    if (id === "total" && kind !== "pick" && changes.size > 1) continue;
    if (id === "teams" && base === "teams") continue;
    if (id === "shakeup" && base === "redraft") continue;
    if (["replacements", "keepers", "spread", "slots"].includes(id) && kind !== "draft") continue;
    if (id === "spread" && base === "spread" && !Object.keys(ch.controls).length) continue;
    if (id === "toptwist" && base === "twist") continue;
    if (!offered(id)) {
      why.push(`${M.changeOf(id).name} isn't offered on ${bm.name}`);
      continue;
    }
    const entry = { id };
    if (Object.keys(ch.controls).length) entry.controls = { ...ch.controls };
    if (ch.moments) entry.moments = ch.moments;
    order.changes.push(entry);
  }
  for (const id of dropped) if (isOn(id) && offered(id) && !changes.has(id)) order.changes.push({ id, drop: true });
  for (const id of dropQ) order.changes.push({ id: "dropq", option: id });
  // A draft's own questions: who goes home beside it, finale picks.
  if (kind === "draft") {
    const strongQs = qs.filter((q) => !q.weak);
    if (strongQs.some((q) => q.kind === "out") && !changes.has("bootcall")) order.changes.push({ id: "bootcall" });
    if (strongQs.some((q) => q.kind === "top" || q.kind === "winner") && !changes.has("finalepicks")) order.changes.push({ id: "finalepicks" });
    const other = strongQs.filter((q) => !["out", "top", "winner"].includes(q.kind));
    if (other.length) why.push(`a question on a draft the menu can't add (${other.map((q) => q.kind).join(", ")})`);
  } else if (kind === "pick" && qs.some((q) => !q.weak)) why.push(`a question on a pick game (${qs.map((q) => q.kind).join(", ")})`);
  // A game of questions: the base's questions to the ones asked (add what's missing; take the rest off a new game, not an edit).
  if (kind === "questions" && qs.length) {
    const have = cur && base === current.base ? cur.asks.filter((q) => !q.card && q.answer !== "ticket").map((q) => ({ id: q.id, sig: O.sigOf(q) })) : info.asks.filter((q) => !q.card && !q.ticket);
    const used = new Set();
    for (const q of qs) {
      if (MOMENT_KINDS.has(q.kind) && !q.moment) why.push(`a question about a moment this season's research doesn't answer ("${q.text.trim()}")`);
      const want = KIND_SIG[q.kind] + (q.moment ? `|${q.moment}` : "");
      const hit = have.find((h) => !used.has(h.id) && h.sig.startsWith(want));
      if (hit) {
        used.add(hit.id);
        continue;
      }
      if (!C.QUESTION_KINDS.some((k) => k.id === q.kind)) {
        why.push(`a question no menu entry adds (${q.kind}${q.kind === "top" ? ": only Season predictions or Finale picks carry it" : ""})`);
        continue;
      }
      order.changes.push({ id: "addq", option: q.kind, ...(q.moment ? { moment: q.moment } : {}) });
    }
    if (!cur) for (const h of have) if (!used.has(h.id)) order.changes.push({ id: "dropq", option: h.id });
  }
  if (base === "onemoment" || base === "most") {
    const m = momentFor(t, pg, "who");
    if (m) order.moment = m;
    else why.push("the one moment it's about isn't one research answers here");
  }

  // 5. numbers to slots
  const cueAt = (i) => cues.some((c) => c.start <= i && i < c.end && !c.target.startsWith("F:"));
  const nums = bindNumbers(t, order, { kind, info, isOn, qs, cover, why, pg, base, cueAt });
  trace.numbers = nums.bound;

  // 6. length
  if (/\b(single|one|1|just this|this) episode\b|\bjust tonight\b|\btonight('s)? episode\b|\bfor (the )?next episode\b/.test(t)) order.length = { one: true };
  const pre = /\b(until|till|before|up to) the merge\b|\bpre merge\b/.test(t) && !/\bpost merge\b|\bafter the merge\b/.test(t);
  const post = /\b(from|after|starting at) the merge\b|\bpost merge\b/.test(t) && !/\bpre merge\b|\bbefore the merge\b/.test(t);
  if (pre && !order.changes.some((c) => ["knockouts", "standing"].includes(c.id)) && base !== "lives") order.length = { to: { phase: "merged" } };
  if (post && !order.changes.some((c) => ["knockouts", "times", "standing", "redraft"].includes(c.id))) order.length = { from: { phase: "merged" } };
  if (nums.len) order.length = { ...(order.length || {}), ...nums.len };
  for (const re of [/\b(until|till|before|up to|from|after|starting at|at) the merge\b/, /\b(pre|post) merge\b/, /\b(single|one|1|just this|this) episode\b/, /\bjust tonight\b/]) {
    const m = t.match(re);
    if (m) cover(m.index, m.index + m[0].length);
  }

  // 7. what's left unexplained
  const leftover = [];
  for (const m of t.matchAll(/[a-z][a-z']*/g)) {
    const w = m[0];
    if (covered.slice(m.index, m.index + w.length).some(Boolean)) continue;
    if (STOP.has(w) || FILLER.has(w) || pageWords.has(w) || w.length <= 2) continue;
    leftover.push(w);
  }
  const negs = [];
  for (const m of t.matchAll(/\b(not|no|never|without|nobody|nothing|except|unless|instead|but)\b/g)) if (!covered[m.index] && !["instead", "but"].includes(m[0])) negs.push(m[0]);
  const conds = [];
  for (const m of t.matchAll(/\b(if|unless|whenever|only)\b/g)) if (!covered[m.index]) conds.push(m[0]);
  trace.leftover = leftover;
  const content = (t.match(/[a-z][a-z']*/g) || []).filter((w) => !STOP.has(w) && !FILLER.has(w) && !pageWords.has(w) && w.length > 2);
  if (leftover.length > 2 || (leftover.length && content.length && leftover.length / content.length > 0.34)) why.push(`words it doesn't place: ${leftover.slice(0, 6).join(" ")}`);
  if (!READ_OPTS.heldOut) {
    // PEEK: a game word left unplaced means part of the request was missed ("keep the same person all season").
    const gameWord = leftover.find((w) => GAME_WORDS.has(w));
    if (gameWord && !why.some((x) => x.startsWith("words it doesn't place"))) why.push(`a game word it didn't place ("${gameWord}")`);
    // PEEK: a named square, and another kind of game joined on beside it ("bingo AND predictions", "a draft and also a pool"),
    // its word not part of a phrase already read ("go back in the pool", "who outlasts whom").
    const famKind = { questions: "questions", bets: "questions", draft: "draft", lineup: "draft", place: "draft", pick: "pick" };
    const inOther = (c) => cues.some((x) => x !== c && !x.target.startsWith("F:") && x.start < c.end && x.end > c.start) || qsAll.some((q) => q.start < c.end && q.end > c.start) || NOOPS.some((re) => [...t.matchAll(new RegExp(re.source, "g"))].some((m) => m.index < c.end && m.index + m[0].length > c.start));
    const strongCue = cues.find((x) => x.target.startsWith("B:") && x.w >= 3);
    const joined = cues.filter((c) => c.target.startsWith("F:") && famKind[c.target.slice(2)] && famKind[c.target.slice(2)] !== kind && !inOther(c) && strongCue && /\b(and|plus|also|as well as)\b/.test(t.slice(Math.min(c.end, strongCue.end), Math.max(c.start, strongCue.start))));
    if (joined.length && !cur) why.push(`a ${joined[0].target.slice(2)} game named beside ${bm.name}`);
  }
  if (negs.length) why.push(`a "${negs[0]}" it can't place`);
  if (conds.length && leftover.length) why.push(`a condition it can't place ("${conds[0]}")`);
  return finish(order, why);

  function finish(o, w) {
    if (!cur) {
      if (!o) return { order: null, sure: false, why: w, trace, built: null };
      let built = O.build(o, pg);
      // One repair a person would make from the change's own why: teams or a head start on a game ranked by a streak need it
      // ranked by points first (Most points), when the words talk of adding up or most points.
      if (!built.ok && !o.changes.some((c) => c.id === "total") && /\b(add up|adds up|most|points|total)\b/.test(t) && o.changes.some((c) => ["teams", "handicap"].includes(c.id))) {
        const o2 = { ...o, changes: [{ id: "total" }, ...o.changes] };
        const b2 = O.build(o2, pg);
        if (b2.ok) {
          o = o2;
          built = b2;
          trace.repair = "Most points first";
        }
      }
      trace.problems = built.problems;
      if (built.problems.length) w.push(...built.problems.map((p) => `menu: ${p}`));
      if (built.check && !built.check.ok) w.push(`engine: ${built.check.problems[0] || built.check.waits[0] || "no type"}`);
      if (!built.spec) w.push("no game built");
      return { order: o, sure: !w.length, why: [...new Set(w)], trace, built };
    }
    return { ...editResult(o, w, current, pg), trace };
  }
}

/** An edit's result: the ops that take the current game (an order) to the one read (an order on the same page, its changes the
 *  new ones only), made and checked. Shared with the meaning reader. */
function editResult(o, w, current, pg) {
  const cb = O.build(current, pg);
  const curOn = cb.spec ? onIn(cb.spec) : new Set();
  const ops = [];
  if (o && o.base !== current.base) ops.push({ op: "base", base: o.base });
  for (const c of (o && o.changes) || []) {
    if (c.id === "addq") ops.push({ op: "addq", option: c.option, ...(c.moment ? { moment: c.moment } : {}), ...(c.controls ? { controls: c.controls } : {}) });
    else if (c.id === "dropq") ops.push({ op: "dropq", option: c.option });
    else if (c.id === "setq") ops.push({ op: "setq", option: c.option, controls: c.controls });
    else if (c.drop) ops.push({ op: "drop", change: c.id });
    else {
      const ch = M.changeOf(c.id);
      const on = curOn.has(c.id) && o.base === current.base;
      if ((on || (ch && ch.always)) && c.controls && Object.keys(c.controls).length) for (const [k, v] of Object.entries(c.controls)) ops.push({ op: "set", change: c.id, control: k, value: v });
      else if (!on || c.moments) ops.push({ op: "add", change: c.id, ...(c.controls ? { controls: c.controls } : {}), ...(c.moments ? { moments: c.moments } : {}) });
    }
  }
  if (o && o.length) ops.push({ op: "length", length: o.length });
  if (o && o.moment) ops.push({ op: "moment", moment: o.moment });
  const ww = (w || []).filter((x) => !/^no game named|^a game of guesses, but not|^a draft, but not/.test(x));
  if (!ops.length) ww.push("no change it can place");
  const next = O.applyOps(current, ops);
  const built = O.build(next, pg);
  if (built.problems.length) ww.push(...built.problems.map((p) => `menu: ${p}`));
  if (built.check && !built.check.ok) ww.push(`engine: ${built.check.problems[0] || built.check.waits[0] || "no type"}`);
  return { ops, order: next, sure: !ww.length, why: [...new Set(ww)], built };
}

/** Each number in the request to its slot: a change's control (set on the order), a question's, the length, or the page's. */
function bindNumbers(t, order, ctx) {
  const { kind, info, isOn, qs, cover, why, pg, base } = ctx;
  const taken = [];
  const out = { bound: [], len: null };
  const isTaken = (a, b) => taken.some(([x, y]) => a < y && b > x);
  const has = (id) => !!order.changes.find((c) => c.id === id && !c.drop) || isOn(id);
  const setCtl = (id, k, v) => {
    let c = order.changes.find((x) => x.id === id && !x.drop);
    if (!c) {
      c = { id };
      order.changes.push(c);
    }
    c.controls = { ...(c.controls || {}), [k]: v };
  };
  const setNum = (id, k, v) => {
    const entry = M.controlOf(id, k);
    if (!entry || !M.valueFits(entry, v)) {
      why.push(`${v} doesn't fit ${M.changeOf(id).name} › ${entry ? entry.label : k}`);
      return false;
    }
    setCtl(id, k, v);
    return true;
  };
  const qset = (k, v) => {
    const add = order.changes.filter((c) => c.id === "addq");
    if (add.length) add.forEach((c) => (c.controls = { ...(c.controls || {}), [k]: v }));
    else order.changes.push({ id: "setq", option: "*", controls: { [k]: v } });
  };
  const builtHas = (needle) => {
    try {
      const b = O.build(order, pg);
      return b.spec && JSON.stringify(b.spec).includes(needle);
    } catch {
      return false;
    }
  };
  for (const [re, slot, extra] of SLOTS) {
    if (extra && extra.peek && READ_OPTS.heldOut) continue;
    for (const m of t.matchAll(new RegExp(re.source, "g"))) {
      const nums = [...m[0].matchAll(/\$?(\d+(?:\.\d+)?)/g)].map((x) => ({ v: Number(x[1]), at: m.index + x.index, len: x[0].length }));
      if (!nums.length) {
        // "a point a week" for newcomers: one point
        if (slot === "handicap.points" && /\ba point a week\b/.test(m[0]) && setNum("handicap", "points", 1)) cover(m.index, m.index + m[0].length);
        continue;
      }
      const n = nums[nums.length - 1];
      if (isTaken(n.at, n.at + n.len)) continue;
      let ok = true;
      const v = n.v;
      if (slot === "page" || slot === "couch") ok = true; // a season's number, or how many of you play (the couch, not a game setting)
      else if (slot === "len.range") out.len = { from: nums[0].v, to: nums[nums.length - 1].v };
      else if (slot === "len.at") {
        if (has("knockouts")) {
          // A cut after an episode: no control holds its number. Claimed, so no other slot reads it as something else.
          why.push(`a cut after episode ${v}: no control holds the episode`);
          taken.push([n.at, n.at + n.len]);
          continue;
        } else if (/\b(until|till|up to|through|before)\b/.test(m[0])) out.len = { ...(out.len || {}), to: v };
        else if (/\b(after|from|starting|beginning)\b/.test(m[0])) out.len = { ...(out.len || {}), from: /\bafter\b/.test(m[0]) ? v + 1 : v };
        else out.len = { from: v, to: v };
      } else if (slot === "len.n") out.len = { from: "next", to: ((pg && pg.from) || 1) + v - 1 };
      else if (slot === "q.over") {
        if (kind === "questions") qset("over", v);
        else ok = false;
      } else if (slot === "every") {
        if (has("knockouts")) ok = setNum("knockouts", "every", v);
        else if (kind === "questions" && v === 2) qset("asked", "every");
        else ok = false;
      } else if (slot === "lives") {
        if (has("coop") || (kind === "questions" && /\btogether\b|\bshared\b|\bco ?op\b/.test(t))) ok = setNum("coop", "lives", v);
        else if (kind === "pick" || kind === "questions") ok = setNum("standing", "lives", v);
        else ok = false;
      } else if (slot === "standing.buyback" || slot === "standing.mulligans") {
        if (kind === "pick" || kind === "questions") ok = setNum("standing", slot.split(".")[1], v);
        else ok = false;
      } else if (slot === "budget") {
        if (kind !== "draft") ok = false;
        else if (has("cap") || has("market") || ["cap", "market"].includes(base)) ok = setNum("cap", "total", v);
        else ok = setNum("draft", "budget", v);
      } else if (["q.chips", "q.pairs", "q.line", "q.within"].includes(slot)) {
        if (kind !== "questions") ok = false;
        else qset(slot.slice(2), v);
      } else if (slot === "lines") {
        if (has("host") || base === "host") ok = setNum("host", "each", v);
        else if (has("card") || ["props", "objectives"].includes(base)) ok = setNum("card", "each", v);
        else ok = kind === "questions" && qs.length === v; // "3 guesses": the questions themselves
      } else if (slot === "top") ok = qs.some((q) => q.kind === "top") || has("finalepicks");
      else if (slot === "slots.alt") ok = has("slots");
      else if (slot === "size.bestof") {
        if (kind !== "draft") ok = false;
        else {
          setCtl("size", "plays", "best");
          ok = setNum("size", "each", nums[1].v) && setNum("size", "n", nums[0].v);
          if (ok) taken.push([nums[0].at, nums[0].at + nums[0].len]);
        }
      } else if (slot === "size.n") {
        if (kind !== "draft") ok = false;
        else {
          const bestOf = /\b(best|top)\b/.test(m[0]) || base === "bestball";
          setCtl("size", "plays", bestOf ? "best" : "start");
          ok = setNum("size", "n", v);
        }
      } else if (slot === "each") {
        if (kind === "draft") ok = setNum("size", "each", v);
        else if (kind === "pick" && has("second") && v === 2) ok = true; // "pick two" on a double boot: the second pick
        else if (kind === "pick" && !/\b(stays|survive|staysin)\b/.test(t) && base !== "pool") ok = setNum("pickmeans", "each", v);
        else ok = kind === "pick" && v === 1;
      } else if (slot === "q.points") {
        if (kind === "questions") {
          if (!(info.spec && JSON.stringify(info.spec).includes(`"points":${v}`))) qset("points", v); // a base's own number is its own
        } else if (has("handicap")) ok = setNum("handicap", "points", v);
        else ok = builtHas(`"points":${v}`) || builtHas(`:${v}}`);
      } else {
        const [id, k] = slot.split(".");
        ok = setNum(id, k, v);
      }
      if (ok) {
        taken.push([n.at, n.at + n.len]);
        cover(m.index, m.index + m[0].length);
        out.bound.push(`${v}→${slot}`);
      }
    }
  }
  // Multipliers: double, triple, x3, 2 times, half (a captain's, a parlay's, the finale's, a pickup's).
  for (const m of t.matchAll(MULT_RE)) {
    const w = m[3] || m[4] || (/\bhalf\b/.test(m[0]) ? "half" : null);
    const v = m[1] ? Number(m[1]) : m[2] ? Number(m[2]) : MULTWORDS[w];
    if (!v || isTaken(m.index, m.index + m[0].length)) continue;
    const after = t.slice(m.index, m.index + 22);
    if (/^double or nothing/.test(after) || /^double boot/.test(after)) continue;
    if (m[3] === "twice" && /\bsame (castaway|one|player|person|pick)\s*$/.test(t.slice(Math.max(0, m.index - 25), m.index))) continue; // never the same one twice
    const target = has("captain") ? ["captain", "times"] : has("parlay") ? ["parlay", "times"] : has("times") ? ["times", "x"] : has("joined") ? ["joined", null] : has("toptwist") ? ["toptwist", null] : null;
    if (!target) {
      if (has("knockouts") && v === 0.5) continue; // the bottom half: the cut's own
      why.push(`a multiplier (${m[0].trim()}) with nothing to multiply`);
      continue;
    }
    if (target[0] === "toptwist" && (v === 2 || v === 0.5)) {
      // Twist of the week's own twists: double points, or half
    } else if (target[1]) {
      if (!setNum(target[0], target[1], v)) continue;
    } else if (target[0] === "joined") {
      why.push(`a pickup's multiplier (${m[0].trim()}): no control holds it`);
      continue;
    }
    taken.push([m.index, m.index + m[0].length]);
    cover(m.index, m.index + m[0].length);
    out.bound.push(`${v}→${target.join(".")}`);
  }
  if (has("knockouts") && /\b(bottom|lowest) half\b/.test(t)) setCtl("knockouts", "out", "half");
  if (has("knockouts") && /\b(at|when) the merge\b/.test(t)) setCtl("knockouts", "at", "phase");
  for (const m of t.matchAll(/(?<![a-z0-9.])\$?(\d+(?:\.\d+)?)(?![a-z0-9])/g)) {
    if (isTaken(m.index, m.index + m[0].length)) continue;
    if (m[1] === "1" && ctx.cueAt(m.index)) continue; // "one" inside a phrase a cue claims: share one team, one from each tribe
    if (order.base === "split" && /^\(?\d+( ?- ?\d+)+/.test(t.slice(m.index - 1))) continue; // a vote split written out (5-2-1)
    why.push(`a number it can't place (${m[1]})`);
  }
  if (out.len) out.bound.push(`len ${JSON.stringify(out.len)}`);
  return { ...out };
}

/** A sentence that changes the current game (an order): { ops, order, sure, why, built }. */
function edit(text, current, pg) {
  return read(text, pg, { current });
}

module.exports = { read, edit, editResult, normalize, numbersIn, momentFor, baseInfo, onIn, CUES, QUESTIONS, SLOTS, READ_OPTS, KIND_SIG, MOMENT_KINDS, QUESTION_BASES };

if (require.main === module) {
  const fs = require("fs");
  const ed = process.argv.find((a) => a.startsWith("--edit="));
  const text = process.argv.slice(2).filter((a) => !a.startsWith("--")).join(" ") || "draft 3 each and double points for the winner";
  const p = JSON.parse(fs.readFileSync(path.join(ROOT, ".impeccable", "mocks", "wizard-r1", "pages", "s51.json"), "utf8"));
  const page = p.wizard ? p.wizard.page : p.page || p;
  const pg = C.pageFacts(page, { show: "Survivor 51", lastSeason: "<last season's game>", cast: (page.pack && page.pack.cast) || [] });
  const r = ed ? edit(text, { base: ed.slice(7), changes: [] }, pg) : read(text, pg);
  console.log(JSON.stringify({ order: O.orderLine(r.order), ops: r.ops, sure: r.sure, why: r.why, trace: r.trace }, null, 1));
}
