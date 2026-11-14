// Source-derived core taxonomy for design/review work. No app, DB or network.
// node scripts/core-game-catalog.js [--check]
const fs=require('fs'),path=require('path'),crypto=require('crypto'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const G=require('../src/lib/game/game-spec'),W=require('../src/lib/game/start-wizard');
const jiti=require('jiti')(path.join(root,'x.js'),{alias:{'@':path.join(root,'src')}});
const {compileGame}=jiti(path.join(root,'src/lib/game/game-page/compile.ts'));
const descriptions={
  outlast:'Draft a team; every holding scores by how long it lasts. Reversed placement scoring is an optional variation.',
  lineup:'Draft a roster and choose the starters that count each episode.',
  'best-ball':'Draft a roster; the engine automatically counts the best N each episode. No manual lineup.',
  pool:'Pick one participant per episode to survive or meet the game’s scoring condition; track a streak, points or lives.',
  picks:'Pick one or several participants afresh each episode and score what they do. This is distinct from drafting a roster.',
  questions:'Answer a configurable sheet of predictions; questions can use any compatible answer/settlement controls.',
  calls:'Play the show’s specialized recurring two-call format. This is distinct from arbitrary prediction questions.',
  bingo:'Play an episode bingo card; completed lines score.'
};
const families={
  'classic-draft':['Outlast / placement draft','A drafted team scored by placement; supports reversed placement and compatible draft/ranking modifiers.'],
  'active-roster':['Lineups, best ball and scored rosters','Drafted moment- or sports-stat scoring: selected starters, automatically selected best N, or a whole sports roster. Also the home for compatible objectives, captain, category and market variants.'],
  pickem:['Survival pools and weekly participant picks','One survival pick per episode, or one/multiple fresh picks scored by show moments. Lives, streaks and points apply only where their spec is compatible.'],
  'weekly-calls':['Weekly Calls','The show-specific recurring calls, counted by their specialized grading flow.'],
  'weekly-bingo':['Weekly Bingo','Episode cards graded by completed bingo lines.'],
  questions:['Prediction / answer games','Arbitrary compatible question sheets, including sports winner/slate picks, brackets, trivia, confidence/chip/pair controls and player-built tickets.'],
  stages:['Multi-stage / hybrid games','Compose supported child games sequentially or alongside each other, with overall scoring; compatible stage rules can follow format changes or other seasons/shows.'],
  squares:['Sports squares','Hold squares on a two-team score-digit grid; the relevant period/halftime/final score pays the winning square.']
};
const controls={person:'Pick participant(s)',group:'Pick group(s) / tribe(s) / team(s)',yesNo:'Yes / no',number:'Number prediction',overUnder:'Over / under a line',choice:'Choose a listed option',calls:'Specialized show calls',order:'Ordered predictions',confidence:'Confidence-ranked predictions',chips:'Spread chips over participants',split:'Split an allocation',pairs:'Pair / match participants',side:'Pick a sports matchup’s side',bracket:'Round-by-round bracket',trivia:'Trivia answers',ticket:'Build a multi-leg prediction ticket'};
const pages={together:'Shared co-op outcome, lives and progress',race:'Progress toward a points target',matchup:'Head-to-head matchup and record',categories:'Stat-category comparisons, head-to-head or roto',worth:'Market holdings, prices, cash and total worth',week:'Episode/week winners and weeks won',board:'Sports squares grid and payouts',card:'Bingo card and lines',objectives:'Objectives hit / completed',team:'Drafted roster, contributions and totals (Outlast, lineup, best ball or stats)',picks:'Fresh participant picks scored by what they do',ladder:'Survival picks, streak and/or remaining lives',slate:'Predictions across a sports slate / matchup sides',ballot:'Prediction or answer sheet',stages:'Stage progress and overall results'};
const wins={total:'Most points',streak:'Longest streak',standing:'Last one standing / elimination ordering',worth:'Cash plus current holding values',coop:'The couch wins or loses together',matchups:'Head-to-head wins / losses',weeks:'Most episodes / weeks won',categories:'Head-to-head stat categories',roto:'Rank points across stat categories'};
const sportsNames={season:'Season roster / lineup league',short:'Short draft / whole-roster game',pickem:'Winner / sports pick’em predictions',pickAFew:'Pick several athletes in a stat prediction',bestBall:'Sports best ball',categories:'Head-to-head categories',roto:'Rotisserie categories',squares:'Sports squares',bracket:'Tournament / playoff bracket'};
function complete(keys,map,what){const missing=keys.filter(k=>!map[k]),extra=Object.keys(map).filter(k=>!keys.includes(k));if(missing.length||extra.length)throw Error(what+' changed: missing '+missing.join(',')+'; extra '+extra.join(','));}
const source=ts.createSourceFile('grammar.ts',read('src/lib/game/game-page/grammar.ts'),ts.ScriptTarget.Latest,true);
const mainAlias=source.statements.find(s=>ts.isTypeAliasDeclaration(s)&&s.name.text==='MainBlock');
const mainTypes=mainAlias.type.types.map(t=>t.literal.text);
complete(G.LEAGUE_TYPES,families,'Engine types');complete(Object.keys(G.VOCAB['ask.answer']),controls,'Answer controls');complete(mainTypes,pages,'Main blocks');complete(Object.keys(G.VOCAB['rank.by']),wins,'Ranking types');
const wizard=W.KINDS.map(k=>{if(!descriptions[k.base])throw Error('Unknown wizard base '+k.base);return {id:k.id,base:k.base,name:k.name,description:descriptions[k.base]};});
const sports=[];
for(const file of fs.readdirSync(path.join(root,'src/lib/sports/defaults')).filter(f=>f.endsWith('.json')).sort()){
  const d=JSON.parse(read('src/lib/sports/defaults/'+file));
  const add=(specs,league)=>{for(const [id,item]of Object.entries(specs||{})){if(!sportsNames[id])throw Error('Unknown sports game '+id);const spec=G.fullSpec(item.spec||item);sports.push({sport:d.sport,league,id,name:sportsNames[id],on:item.on||null,type:G.typeOf(spec),main:compileGame(spec).main,count:spec.count,score:spec.score.by,rank:spec.rank.by,controls:(spec.ask||[]).map(q=>q.answer),about:item.about||null});}};
  add(d.specs,null);for(const [league,override]of Object.entries(d.leagues||{}))add(override.specs,league);
}
const future=Object.entries(G.VOCAB).flatMap(([dial,values])=>Object.entries(values).filter(([,status])=>status!=='now').map(([value,status])=>({dial,value,status})));
const objective=G.fullSpec({preset:'weekly-lineup',score:{by:'moments',hits:'objective'},rank:{by:'total'}});
const objectiveContext=require('../tests/fixtures/game-words/bank.js').ctxOf({show:'Survivor',season:51,rulebook:'survivor',couch:6,pool:18});
if(G.specProblems(objective,objectiveContext).length||G.specWaitsFor(objective).length||compileGame(objective).main!=='objectives')throw Error('Objective example no longer supported');
const sources=['src/lib/game/game-spec/schema.js','src/lib/game/game-spec/settings.js','src/lib/game/game-spec/roll.js','src/lib/game/start-wizard/index.js','src/lib/game/game-page/grammar.ts','src/lib/game/game-page/compile.ts','src/lib/sports/start-games.ts','src/lib/sports/page.ts','src/lib/sports/index.ts',...fs.readdirSync(path.join(root,'src/lib/sports/defaults')).filter(f=>f.endsWith('.json')).sort().map(f=>'src/lib/sports/defaults/'+f)];
const catalog={schemaVersion:1,scope:'Core structures; compatible combinations still require show/sport context validation.',counts:{engineFamilies:G.LEAGUE_TYPES.length,namedPresets:Object.keys(G.PRESETS).length,wizardBases:wizard.length,pagePatterns:mainTypes.length,answerControls:Object.keys(controls).length,rankModes:Object.keys(wins).length,randomizerTwists:G.ROLL.twists.length,sportDefaultFiles:new Set(sports.map(s=>s.sport)).size,sportBaseDeclarations:sports.filter(s=>!s.league).length,sportLeagueDeclarations:sports.filter(s=>s.league).length},families:G.LEAGUE_TYPES.map(id=>({id,name:families[id][0],description:families[id][1]})),presets:Object.keys(G.PRESETS),wizardBases:wizard,sports,answerControls:Object.entries(controls).map(([id,name])=>({id,name,status:G.VOCAB['ask.answer'][id]})),pagePatterns:mainTypes.map(id=>({id,description:pages[id]})),rankModes:Object.entries(wins).map(([id,name])=>({id,name})),raceModifier:'rank.race',eliminationModifier:'rank.cut / score.lives / compatible bank elimination',randomizer:G.ROLL,futureVocabulary:future,objectiveExample:objective,sources:sources.map(file=>({file,sha256:crypto.createHash('sha256').update(read(file)).digest('hex')}))};
const cell=x=>String(x??'').replace(/\|/g,'\\|').replace(/\n/g,' ');
const table=(head,rows)=>['| '+head.join(' | ')+' |','| '+head.map(()=>'---').join(' | ')+' |',...rows.map(row=>'| '+row.map(cell).join(' | ')+' |')].join('\n');
const c=catalog.counts;
const out=[
'# Core game catalog',
'',
'Generated from the current engine by `node scripts/core-game-catalog.js`. Machine-readable companion: [core-game-catalog.json](core-game-catalog.json). Regenerate after changing the schema, wizard, page grammar or sports defaults. `--check` checks both files without writing.',
'',
`The app has **${c.engineFamilies} engine families**, **${c.wizardBases} show-wizard starting bases**, **${c.pagePatterns} generated-page patterns**, and **${c.answerControls} answer controls**. These are different classifications, not counts to add together. The five named presets do not describe the entire engine.`,
'',
'There is no single finite list of all configured games: the engine composes compatible pieces, numeric settings, question content, time spans and stages. This catalog is the complete current inventory of the finite core families and control/page enums, plus the source-defined named starting forms and their variations.',
'',
'## All engine families',
'',
table(['Engine type','Core play forms','What it does'],catalog.families.map(f=>['`'+f.id+'`',f.name,f.description])),
'',
'A sports game called **Pick’em** usually plays internally as `questions` with `answer: side` or `person`. The internal `pickem` family also covers fresh show-moment picks. Game names alone are therefore not a reliable basis for choosing an overview component.',
'',
'## The eight show-wizard starting games',
'',
table(['Game','Generator base','How you play'],wizard.map(w=>[w.name,'`'+w.base+'`',w.description])),
'',
'The five frozen presets are '+catalog.presets.map(id=>'`'+id+'`').join(', ')+'. Best Ball, Weekly Picks and generic Prediction Sheets are additional generator bases rather than separate frozen preset entries.',
'',
'## Sports starting forms',
'',
table(['Form','Default ID','Where explicitly declared'],Object.entries(sportsNames).map(([id,name])=>{const entries=sports.filter(s=>s.id===id);return [name,'`'+id+'`',[...new Set(entries.map(s=>s.sport+(s.league?'/'+s.league:'')))].join(', ')];})),
'',
`There are **${c.sportBaseDeclarations} base declarations across ${c.sportDefaultFiles} sport-default files**, plus **${c.sportLeagueDeclarations} league-specific declarations**. These are declarations, not ${sports.length} distinct mechanics; league specs merge over the sport’s defaults. Brackets may require a playoffs context. A default’s existence does not mean every league, event or sports-start rail offers it. See [sports start rails](../src/lib/sports/start-games.ts), [sportGames](../src/lib/sports/page.ts) and [defaultsFor](../src/lib/sports/index.ts).`,
'',
'## The sixteen answer / prediction forms',
'',
table(['Control','Play form'],catalog.answerControls.map(q=>['`'+q.id+'`',q.name])),
'',
'These can create distinct prediction experiences: a winner pick, several athletes, a score/number estimate, an over/under, an ordered finish, confidence picks, chips, allocations, pairs, brackets, trivia or multi-leg tickets. They are answer controls inside a game, not sixteen independent engine families. Cards chosen from moments, by the bot or by a rotating host are also content-source variations where compatible.',
'',
'## Ways to win and larger structural variants',
'',
table(['Rank','Meaning'],catalog.rankModes.map(r=>['`'+r.id+'`',r.name])),
'',
'Also supported as compatible structures/modifiers:',
'',
'- **Race to a target** (`rank.race`).',
'- **Guillotine / cuts / last-player-standing** (`rank.cut`), or lives-based elimination for eligible pools/question games.',
'- **Co-op survival**: shared lives against the show; this is a question-game structure, not arbitrary co-op on every base.',
'- **Stock-market play**: buy/sell holdings; compatible moment-scored drafted games can rank by cash plus holdings’ worth. A market can also rank by points.',
'- **Objective collection** (`score.hits: objective`): complete each objective rather than repeatedly scoring every hit.',
'- **Category head-to-head or roto**: compare actual stat columns rather than adding incompatible stat units into a points total.',
'- **Teams of people**: combine seats into teams by sum/mean; this is distinct from a player’s drafted cast roster.',
'- **Multi-stage / parallel / cross-season games**: change or combine child games, including compatible format-change starts. Current child-type list: '+G.STAGE_KINDS.map(id=>'`'+id+'`').join(', ')+'. Squares is not in that child-type list.',
'',
'Not every base supports every rank or modifier. For example, bingo and specialized Weekly Calls rank by totals; show-moment picks have different race/cut restrictions from drafted rosters; sports-stat picks directly in `get.by: pick` are rejected, while athlete-stat prediction questions are supported. Use the validator instead of a Cartesian product.',
'',
'## Modifiers that create the thousands of combinations',
'',
'- Acquisition: snake, blind, random draw or auction; shared/exclusive ownership; salary caps, group slots, spread drafts and keepers where compatible.',
'- Roster management: starters, bench, best N, captain, waiver/replacement/swap windows and permitted trading.',
'- Pick rules: one or several, cycling, never-repeat or free-repeat, second picks, lives, mulligans and buybacks where compatible.',
'- Scoring: show moments or sports stats, custom weights, reverse placement, objectives, multipliers by episode/phase/finale or acquisition history.',
'- Prediction extras: wagers/banks, confidence, split pots, only-right scoring, rollovers, shrinking values, parlays/tickets, majority/minority-style settlement and beating the bot.',
'- Social/competition extras: teams, bounties, secret roles, player-chosen twists, redrafts, handicaps, playoffs and eligible joining rules.',
'- Time/content: one episode/event, several, rest of season, phase boundaries, game/daily/weekly locks, and moment/bot/host-sourced cards.',
'',
`The seeded randomizer itself exposes **${c.randomizerTwists} named twists**: `+G.ROLL.twists.map(t=>'`'+t.id+'`').join(', ')+'. This list is narrower than the full spec language. Each candidate is still checked against its page context.',
'',
'## All generated main-page patterns',
'',
table(['Main block','Primary information'],catalog.pagePatterns.map(p=>['`'+p.id+'`',p.description])),
'',
'These patterns are the main graphic selected by the compiler, not the whole game taxonomy. An Outlast, lineup and Best Ball can all use `team`; a head-to-head modifier can make their primary graphic `matchup`. `compileGame` separately handles `stages` before using `mainOf` for each child. Controls, moves, badges, tables and events are composed alongside the main pattern.',
'',
'## What is explicitly not available yet',
'',
table(['Dial','Value','Status'],future.map(f=>['`'+f.dial+'`','`'+f.value+'`',f.status])),
'',
'This includes arbitrary group pool filters, outside-source settlement (the TVmaze-rating path remains gated), streak/draft-position multipliers, gender-spread drafting and carrying draft money into waiver bids. A vocabulary entry or a UI grammar entry is not proof that a game can actually start.',
'',
'## How a game becomes playable',
'',
'1. The show’s rulebook supplies cast, moments, exits, phases and settleable facts; sports adapters supply the corresponding stats, games, results and eligible participants.',
'2. The wizard, seeded randomizer or typed/AI-assisted creation path produces a `GameSpec`.',
'3. `fullSpec` resolves defaults. `specProblems(spec, ctx)` checks structure and the page’s data; `specWaitsFor` rejects unimplemented or incomplete combinations; `typeOf` checks placement in the scoring sequence. The server repeats these gates.',
'4. The scoring sequence holds participants, scores lines, applies multipliers, combines results, resolves the week and ranks players.',
'5. `compileGame(spec)` produces a deterministic page description. The UI draws those compiled blocks; no AI invents a new page each time someone opens it.',
'',
'Sources: [schema](../src/lib/game/game-spec/schema.js), [wizard](../src/lib/game/start-wizard/index.js), [randomizer](../src/lib/game/game-spec/roll.js), [server checks](../src/lib/server/start-spec.ts), [sequence](../src/lib/game/sequence/index.js), [page grammar](../src/lib/game/game-page/grammar.ts), [compiler](../src/lib/game/game-page/compile.ts).',
'',
'## Coverage for the UI review',
'',
'Use this catalog to cover more than lineups: roster/placement, auto-best-ball, survival, fresh picks, answer controls, bingo, calls, squares, markets, categories, races, co-op and stages have different information needs. Expansion/scoring views and permitted opponents’ choices should follow their underlying structure.',
'',
'`node scripts/dev-test/game-page-census.js --rolls 150` samples specs, not all possible configurations. At the catalog’s initial verification it compiled 1,337 specs (1,160 rolls, 123 fixtures, 49 base sports defaults, 5 presets), with no grammar holes, 92 drawn places and no malformed words in 4,011 phase models. It exercised 14 of the 15 main blocks; `objectives` was absent from that sample. This generator separately verifies a playable objective example. The existing census also does not enumerate league-specific default overrides. Neither result proves rendered, responsive or end-to-end play coverage for all configurations.',
''
].join('\n');
const files={'docs/CORE-GAME-CATALOG.md':out,'docs/core-game-catalog.json':JSON.stringify(catalog,null,2)+'\n'};
let stale=false;for(const [file,value]of Object.entries(files)){const target=path.join(root,file);if(process.argv.includes('--check')){if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==value){stale=true;console.error(file+' is out of date');}}else fs.writeFileSync(target,value);}
if(stale)process.exitCode=1;else console.log(JSON.stringify({ok:true,counts:c,files:Object.keys(files),mode:process.argv.includes('--check')?'check':'write'}));
