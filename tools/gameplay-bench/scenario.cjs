// Deterministic, synthetic LeagueState scenarios. All scoring and viewer projections use production code.
const path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..'),S=require('../../src/lib/game/state-logic'),G=require('../../src/lib/game/game-spec');
const jiti=require(path.join(root,'node_modules/jiti'))(__filename,{alias:{'@':path.join(root,'src')}});
const {gameView}=jiti('../../src/lib/game/game-view.ts');
const {revealIn,episodesSeen}=jiti('../../src/lib/game/episode-view.ts');
const B=require('../../tests/fixtures/game-words/bank');
const Sports=require('./sports.cjs'),Controls=require('./game-controls.cjs');
const NOW=Date.parse('2026-11-12T12:00:00.000Z'),clone=x=>JSON.parse(JSON.stringify(x));
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const adapterFingerprint=require('./explorer/json.cjs').treeHash(__dirname);
const GAME_ID='00000000-0000-4000-8000-00000000b001';
const presets=[{id:'baseline',name:'A regular game night',values:{}},{id:'solo',name:'One player, one starter',values:{players:1,starters:1,bench:1}},{id:'crowded',name:'A full couch, long names',values:{players:24,labels:'long'}},{id:'maximum',name:'Maximum lineup roster',values:{starters:G.MAX_STARTERS,bench:G.MAX_BENCH}},{id:'empty',name:'Before the first episode',values:{history:0}}];
presets.push({id:'you-behind',name:'You are two episodes behind',values:{status:'catchup',pace:'you-behind'}},{id:'friend-behind',name:'A friend is two episodes behind',values:{pace:'friend-behind'}},{id:'mixed',name:'Everyone at a different pace',values:{pace:'mixed'}},{id:'live-only',name:'Behind in a live-only game',values:{status:'catchup',pace:'you-behind',timing:'live-only'}});
function configOf(input={}){
 const showGame=input.showGame||'lineup';if((!input.context||input.context==='show')&&!Controls.implemented.has(showGame))throw Error('The '+showGame+' fixture/interaction adapter is not implemented');
 const sport=input.context&&input.context!=='show'?Sports.resolve(input.context,input.sportGame||'season'):null;
 const c={seed:42,players:4,starters:3,bench:2,history:5,labels:'normal',images:'real',status:'due',viewer:0,pace:'together',timing:'own-pace',context:'show',showGame:'lineup',sportGame:'season',...(sport?{starters:sport.start,bench:sport.bench}:{}),...input};
 if(!sport&&showGame!=='lineup'){if(['outlast','best-ball'].includes(showGame)){c.rosterSize=input.rosterSize??(showGame==='outlast'?3:5);c.bestCount=input.bestCount??3;if(!Number.isInteger(c.rosterSize)||c.rosterSize<1||c.rosterSize>(showGame==='best-ball'?G.MAX_LINEUP_TEAM:G.MAX_TEAM))throw Error('Roster size must fit the engine limit');if(showGame==='best-ball'&&(!Number.isInteger(c.bestCount)||c.bestCount<1||c.bestCount>Math.min(c.rosterSize,G.MAX_STARTERS)))throw Error('Best scorers must fit the roster and engine count limit');c.starters=showGame==='best-ball'?c.bestCount:c.rosterSize;c.bench=showGame==='best-ball'?c.rosterSize-c.bestCount:0;}else{c.picksPerRound=showGame==='pool'?1:(input.picksPerRound??1);if(!Number.isInteger(c.picksPerRound)||c.picksPerRound<1||c.picksPerRound>G.MAX_PICKS)throw Error('Picks per round must be between 1 and '+G.MAX_PICKS);c.starters=c.picksPerRound;c.bench=0;}}
 for(const [k,min,max]of [['seed',1,999999],['players',1,24],['starters',1,sport?sport.start:showGame==='outlast'?G.MAX_TEAM:G.MAX_STARTERS],['bench',0,sport?sport.bench:showGame==='lineup'?G.MAX_BENCH:G.MAX_LINEUP_TEAM],['history',0,12]])if(!Number.isInteger(c[k])||c[k]<min||c[k]>max)throw Error(k+' must be an integer from '+min+' to '+max);
 if(sport&&(c.starters!==sport.start||c.bench!==sport.bench))throw Error('This sports example uses its engine default roster; regenerate with '+sport.start+' starters and '+sport.bench+' bench');
 if(!['normal','long','unbroken'].includes(c.labels)||!['real','missing'].includes(c.images)||!['due','saved','locked','catchup','finished'].includes(c.status))throw Error('Unknown scenario option');
 if(!Number.isInteger(c.viewer)||c.viewer<0||c.viewer>=c.players)throw Error('Choose a player in this scenario');
 if(!['together','you-behind','friend-behind','mixed'].includes(c.pace)||!['own-pace','live-only'].includes(c.timing))throw Error('Unknown pace or timing policy');
 if(c.progress!==undefined&&(!Array.isArray(c.progress)||c.progress.length!==c.players||c.progress.some(n=>!Number.isInteger(n)||n<0||n>c.history)))throw Error('Progress needs one valid watched-through episode per player');
 return c;
}
function makeScenario(input={},art=[]){
 const config=configOf(input),{seed,players,starters,bench,history}=config,total=history+1;
 if(config.context!=='show')return Sports.make(config,{NOW,finish});
 const spec=Controls.specOf(config);spec.span={from:1,to:config.status==='finished'?Math.max(1,history):null};
 const context=B.ctxOf({show:'Survivor',season:49,rulebook:'survivor',couch:players,pool:18});
 const problems=G.specProblems(spec,context);if(problems.length||G.specWaitsFor(spec).length||!G.typeOf(spec))throw Error('Engine rejected this configuration: '+JSON.stringify(problems));
 const names=['Alex','Riley','Sam','Jordan','Morgan','Casey','Drew','Taylor'];
 const long=name=>config.labels==='long'?name+' de la Cruz Montgomery-Wellington':config.labels==='unbroken'?name+'VeryLongUnbrokenName'.repeat(5):name;
 let state=S.defaultState();Object.assign(state.settings,{game:spec,leagueTypeId:G.typeOf(spec),showId:'survivor',showFormat:'survivor',setupComplete:true,activeSlots:starters,benchSlots:bench,teamSize:starters+bench,startEpisode:1,ownershipMode:'shared',revealedThroughEpisode:history,tradeEnabled:false,replenishEnabled:false,bonusEnabled:false});
 state.players=Array.from({length:players},(_,i)=>({id:'bench-p-'+i,name:long(names[i%names.length]+(i>=8?' '+(i+1):'')),color:['#ce6e42','#568f96','#ae86b8','#a6924b'][i%4],active:true}));
 state.castaways=Array.from({length:18},(_,i)=>({id:'bench-c-'+i,name:long(art[i]?.name||['Avery','Blake','Cameron','Devon','Emery','Finley'][i%6]+' '+(i+1)),photoUrl:config.images==='missing'?null:art[i]?.photo||null,status:'active',ownerIds:state.players.filter((_,p)=>Array.from({length:starters+bench},(_,k)=>(p*3+k)%18).includes(i)).map(p=>p.id),acquiredVia:'draft'}));
 state.draftOrder=state.players.map(p=>p.id);state.draftPicksMade=players*(starters+bench);state.blindDraft={lockedPlayerIds:state.draftOrder,revealedAt:new Date(NOW-86400000*20).toISOString()};
 state.episodes=Array.from({length:total},(_,i)=>{const n=i+1,done=n<=history;return {id:'bench-ep-'+n,number:n,title:['A change of plans','Trust your instincts','A narrow escape','Nothing stays secret','The turning point','One more chance'][i%6],airsAt:new Date(done?NOW-(total-n)*86400000:config.status==='locked'?NOW-60000:NOW+86400000).toISOString(),events:[],bets:[],scoringEvents:done?state.castaways.flatMap((c,k)=>{const count=(seed+n*7+k*3)%4;return Array.from({length:count},(_,v)=>({id:'bench-event-'+n+'-'+k+'-'+v,type:['individualImmunity','chosenForReward','satOut'][(seed+n+k+v)%3],castawayId:c.id}));}):[],lineups:Object.fromEntries(state.players.filter((_,p)=>done||p!==config.viewer||config.status==='saved').map((p,pi)=>[p.id,state.castaways.filter(c=>c.ownerIds.includes(p.id)).slice((n+pi)%Math.max(1,bench+1),(n+pi)%Math.max(1,bench+1)+starters).map(c=>c.id)])),lineupsLocked:done||config.status==='locked'};});
 if(config.status==='due')state.episodes.at(-1).lineups[state.players[config.viewer].id]=[];
 if(config.showGame!=='lineup'){
  const holds=spec.get.by==='draft';for(const c of state.castaways)if(!holds)c.ownerIds=[];
  for(const ep of state.episodes){if(!spec.count?.start)delete ep.lineups;if(config.showGame==='pool'||config.showGame==='outlast'){ep.noExit=false;if(ep.number<=history){const c=state.castaways[ep.number-1];S.addElimination(state,ep.id,c.id,'Voted Out');}}
   if(spec.get.by==='pick')ep.picks=state.players.filter((_,i)=>ep.number<=history||i!==config.viewer||config.status==='saved').map((p,i)=>{const ids=Array.from({length:spec.get.each},(_,k)=>state.castaways[(ep.number+i+k)%18].id);return {playerId:p.id,castawayId:ids[0],...(ids.length>1?{more:ids.slice(1)}:{})};});
  }
  state.settings=G.withSpec(state.settings,spec);if(!state.settings)throw Error('The selected show spec could not be applied');
 }
 state=S.migrateLeagueState(state);
 return finish(config,context,spec,state);
}
function finish(config,context,spec,state){
 const history=config.history,players=config.players;
 const marks=Object.fromEntries(state.players.map((p,i)=>[p.id,config.progress?.[i]??Math.max(0,history-((config.pace==='mixed'?i%4:config.pace==='friend-behind'&&i===(config.viewer+1)%players&&players>1?2:config.pace==='you-behind'&&i===config.viewer?2:config.status==='catchup'&&i===config.viewer?2:0)))]));
 state.settings.ownPace=config.timing==='own-pace';
 for(const p of state.players)if(state.settings.ownPace){p.lateJoin={startEpisode:1,catchingUp:marks[p.id]<history,seenThrough:marks[p.id]};if(marks[p.id]<history)for(const ep of state.episodes)if(ep.number>marks[p.id]){if(ep.lineups)delete ep.lineups[p.id];if(ep.picks)ep.picks=ep.picks.filter(pk=>pk.playerId!==p.id);}}
 return {schemaVersion:1,config,context,spec,state,marks,seen:marks[state.players[config.viewer].id],now:NOW,commands:[]};
}
function refOf(s,identity={}){return {leagueId:identity.gameId||GAME_ID,name:s.sport?'Friday Crew · '+s.sport.label:s.config.labels==='normal'?'Friday Crew Lineup':'The extremely competitive Friday Crew weekly lineup championship',gameType:G.typeOf(s.spec),gameName:s.sport?Sports.catalog().find(c=>c.id===s.sport.league).games.find(g=>g.id===s.sport.game).name:Controls.showCatalog().find(g=>g.id===s.config.showGame).name,yourRole:'member',ownPace:s.config.timing==='own-pace',solo:s.config.players===1?'private':null};}
function userOf(s,identity={}){return id=>id===s.state.players[s.config.viewer].id?identity.userId||'bench-user':'bench-user-'+id;}
function view(s,identity={}){const me=s.state.players[s.config.viewer],g=gameView(refOf(s,identity),s.state,me.id,s.seen,userOf(s,identity),undefined,{now:s.now,marks:new Map(Object.entries(s.marks))});if(s.state.settings.ownPace)g.pace={others:s.state.players.filter(p=>p.id!==me.id).map(p=>({name:p.name,week:p.lateJoin?.catchingUp?s.marks[p.id]+1:null})),last:s.config.history+1,team:null,draft:null,gather:null};return g;}
function episodeRows(s,identity={}){return episodesSeen(refOf(s,identity),s.state,s.state.players[s.config.viewer].id,s.seen);}
function reveal(s,n,identity={},replay=false){
 if(!Number.isInteger(n)||n<1||n>s.config.history||n>s.seen+1)throw Error('Reveal only a watched episode or the next unseen episode');
 if(replay&&n>s.seen)throw Error('Watch/reveal this episode before replaying it');
 const part=revealIn(refOf(s,identity),s.state,s.state.players[s.config.viewer].id,n,userOf(s,identity));if(!part)throw Error('No scored episode to reveal');
 return {episode:n,stage:part.stage,finalAt:null,again:n<=s.seen,out:part.out,happened:part.happened,lineup:part.lineup,games:part.game?[part.game]:[],predictions:part.predictions?[part.predictions]:[],table:part.table,next:n<s.config.history?n+1:null,soFar:null,summary:s.sport?'Synthetic '+s.sport.label+' box-score recap. '+s.state.episodes.find(e=>e.number===n).title+'. Counted athlete stats changed the fantasy totals; compare contributions and standings.':'Synthetic episode recap. '+s.state.episodes.find(e=>e.number===n).title+'. Review the game results, participant contributions and standings.'};
}
function command(s,cmd){
 if(!cmd||typeof cmd.type!=='string')throw Error('A command type is required');
 if(cmd.type==='lineup'){
  const me=s.state.players[s.config.viewer];if(cmd.playerId!==me.id)throw Error('Only the selected player can submit a lineup');
  if(!Array.isArray(cmd.ids)||cmd.ids.some(id=>typeof id!=='string'))throw Error('A lineup must be a list of cast IDs');
  const g=view(s);if(g.revealFirst)throw Error('Reveal episode '+g.revealFirst+' before setting this live-only lineup');if(!g.lineup||cmd.episodeId!==g.lineup.epId)throw Error('Only this viewer’s current episode is open');
  const apply=state=>{const problem=S.ActiveRosterLogic.validateLineup(state,cmd.episodeId,me.id,cmd.ids,s.now);if(problem)return problem;if(!S.setActiveRosterLineup(state,cmd.episodeId,me.id,cmd.ids,s.now))return 'The engine rejected this lineup';return null;};
  const problem=g.catchingUp?S.GhostLogic.applyAs(s.state,me.id,s.seen,cmd.episodeId,apply):apply(s.state);if(problem)throw Error(problem);
 }else if(cmd.type==='pick'){
  const me=s.state.players[s.config.viewer],g=view(s);if(cmd.playerId!==me.id||!g.pick||g.pick.epId!==cmd.episodeId||g.revealFirst)throw Error('Only this viewer?s current pick is open');
  const ids=cmd.ids;if(!Array.isArray(ids)||ids.length!==s.spec.get.each||new Set(ids).size!==ids.length||!ids.every(id=>g.pick.available.includes(id)))throw Error('Choose the required number of eligible picks');
  const apply=state=>{S.setPickEmPick(state,cmd.episodeId,me.id,ids[0],{picks:ids,now:s.now});return JSON.stringify(S.PickEmLogic.picked(S.pickEmPickFor(state,cmd.episodeId,me.id)))===JSON.stringify(ids)?null:'The engine rejected these picks';};
  const problem=g.catchingUp?S.GhostLogic.applyAs(s.state,me.id,s.seen,cmd.episodeId,apply):apply(s.state);if(problem)throw Error(problem);
 }else if(cmd.type==='reveal'){
  const last=S.SpoilerLogic.latestWithResults(s.state);if(s.seen>=last)throw Error('No hidden episode results to reveal');s.seen++;const me=s.state.players[s.config.viewer];s.marks[me.id]=s.seen;if(me.lateJoin){me.lateJoin.seenThrough=s.seen;me.lateJoin.catchingUp=s.seen<last;}
 }else if(cmd.type==='viewer'){
  if(!Number.isInteger(cmd.index)||cmd.index<0||cmd.index>=s.state.players.length)throw Error('Unknown viewer');s.config.viewer=cmd.index;s.seen=s.marks[s.state.players[cmd.index].id];
 }else throw Error('No gameplay adapter for '+cmd.type);
 s.commands.push(clone(cmd));return view(s);
}
function checks(s){const g=view(s),scores=S.computeScores(S.spanView(S.GhostLogic.viewFor(s.state,s.state.players[s.config.viewer].id,s.seen)));return [
 {name:'Context-valid GameSpec',pass:!G.specProblems(s.spec,s.context).length},
 {name:'Engine preserves selected scoring, ranking and count mode',pass:S.gameOf(s.state).score.by===s.spec.score.by&&S.gameOf(s.state).rank.by===s.spec.rank.by&&JSON.stringify(S.gameOf(s.state).count)===JSON.stringify(s.spec.count)},
 {name:'Every rendered placement has a compiler mapping',pass:!g.page.holes.length},
 {name:'One viewer, exactly one own standings row',pass:g.table.filter(r=>r.you).length===1},
 {name:'No episode history beyond the viewing boundary',pass:g.table.every(r=>r.weeks.every(w=>w.episode<=s.seen))},
 {name:'Displayed totals reconcile with the engine',pass:g.table.every(r=>scores.find(x=>x.playerId===r.playerId)?.total===r.total)},
 {name:'Finite scores and complete player population',pass:g.table.length===s.config.players&&g.table.every(r=>Number.isFinite(r.total))}
 ];}
module.exports={configOf,makeScenario,view,command,checks,presets,clone,hash,NOW,GAME_ID,reveal,episodeRows,adapterFingerprint};
