// Sports defaults/context are production exports. Only the synthetic box-score inputs live here.
const path=require('path'),S=require('../../src/lib/game/state-logic'),G=require('../../src/lib/game/game-spec');
const jiti=require('jiti')(path.join(__dirname,'sports.cjs'),{alias:{'@':path.resolve(__dirname,'../../src')}});
const L=jiti('../../src/lib/sports/index.ts'),P=jiti('../../src/lib/sports/page.ts'),R=jiti('../../src/lib/sports/start-games.ts'),Controls=require('./game-controls.cjs');
const PRIORITIES=[['football/nfl','NFL'],['basketball/nba','NBA basketball'],['baseball/mlb','MLB baseball']];
const OPEN_LEAGUES={soccer:['eng.1','usa.1','uefa.champions'],mma:['ufc','pfl','lfa'],tennis:['atp','wta']};
const extraLeagues=new Set();
function leagueIds(){return [...new Set([...PRIORITIES.map(([id])=>id),...L.allSports().flatMap(s=>[...(s.leagues||OPEN_LEAGUES[s.id]||[]),...Object.keys(L.defaultsFor(s.id)?.leagues||{})].map(name=>s.id+'/'+name)),...extraLeagues])].filter(id=>L.sportOf(id));}
function validateLeague(league){if(typeof league!=='string'||!/^[-a-z]+\/[a-z0-9._-]+$/.test(league)||league.split('/')[1].startsWith('zt-'))throw Error('Use a supported sport/league path, such as soccer/eng.1');const sport=L.sportOf(league);if(!sport||!L.defaultsFor(sport.id,league.split('/')[1]))throw Error('The app has no sport adapter/defaults for '+league);return sport;}
const implemented=new Set(['season','short','bestBall','categories','roto']);
function resolve(league,game='season'){
 const sport=validateLeague(league),entry=PRIORITIES.find(([id])=>id===league),defaults=L.defaultsFor(sport.id,league.split('/')[1]),row=P.sportGames(league).find(g=>g.id===game);
 if(!row||!implemented.has(game))throw Error('The '+game+' sports fixture/interaction adapter is not implemented');
 const spec=G.fullSpec(row.spec),start=spec.count?.start??spec.count?.best??spec.get.each??0;
 return {league,label:entry?.[1]||sport.name+' · '+league.split('/')[1],sport,defaults,row,spec,start,bench:Math.max(0,(spec.get.each||0)-start),context:P.sportPageContext(league)};
}
let cachedCatalog;
function catalog(){return cachedCatalog ||= leagueIds().map(id=>{const c=resolve(id),rail=[...R.sportRail(id,{count:13,slate:true}),...R.sportRail(id,{count:13})];return {id,name:c.label,sport:c.sport.id,shape:c.context.shape,starters:c.start,bench:c.bench,cadence:c.defaults.closes,slots:c.defaults.slots,openLeague:!c.sport.leagues,games:P.sportGames(id).map(g=>{const spec=G.fullSpec(g.spec),n=spec.count?.start??spec.count?.best??spec.get?.each??0;return {id:g.id,controls:Controls.controlsOf(spec,{fixed:true}),type:G.typeOf(spec),name:rail.find(r=>r.id===g.id)?.name||g.id,about:g.about,implemented:implemented.has(g.id),reason:implemented.has(g.id)?null:'Fixture and decision adapter needed',starters:n,bench:Math.max(0,(spec.get?.each||0)-n),surfaces:['full','mini',...(!spec.score.categories?['detail']:[]),...(g.id==='season'?['reveal']:[]),...(spec.count?.start?['quick']:[]),...(['short','bestBall'].includes(g.id)?['wizard']:[])]};})};});}
function addLeague(league){validateLeague(league);extraLeagues.add(league);cachedCatalog=null;return catalog().find(c=>c.id===league);}
function rawLine(sport,role,v){
 if(sport.id==='hockey')return role==='G'?{W:v%2,GA:1+v%3,SV:20+v,SA:21+v+v%3,TOI:3600,SO:0}:{G:v%2,A:1+v%3,PM:v-4,PPG:v%2,PPA:v%2,SOG:2+v%5,BLK:v%4,HIT:v%5};
 if(sport.id==='soccer')return {APP:1,MIN:90,G:role==='G'?0:v%2,A:v%2,GA:role==='G'||role==='D'?v%3:0,SV:role==='G'?3+v:0,YC:v%2,RC:0,OG:0,PKM:0,PKSV:0};
 if(sport.id==='golf')return {POS:1+v,STR:68+v,TOPAR:v-4,HOLES:18,PAR:10,BIR:3+v%3,BOG:2+v%2,EAG:v%2,ALB:0,HIO:0,DBL:0,WORSE:0,BFR:0};
 if(sport.id==='racing')return {POS:1+v,FIN:1+v,GRID:3+v,PG:2,QUAL:2+v,SPR:1+v,FL:v===0?1:0,SFL:0,LAPS:50,LED:3+v,LEADLAP:1,CHPTS:20+v,BONUS:1,PEN:0,POLE:0,DNF:0,DQ:0};
 if(sport.id==='mma')return {BOUT:1,W:v%2,L:(v+1)%2,DEC:v%2,WR1:0,WR2:0,WR3:0,TSL:30+v*3,SSL:20+v*2,CTRL:120+v*5,TDL:1+v%3,REV:v%2,KD:0,QW:0};
 if(sport.id==='tennis')return {MP:1,W:v%2,L:(v+1)%2,GW:v%2?12:7,GL:v%2?7:12,SW:v%2?2:0,SL:v%2?0:2,CS:v%2?1:0,STR:v%2?1:0};
 if(sport.id==='basketball')return {PTS:12+v*2,REB:3+v,AST:2+v,STL:v%3,BLK:v%2,TO:1+v%4,FGM:5+v,FGA:12+v*2,FTM:2+v%3,FTA:4+v%3,'3PM':v%5};
 if(sport.id==='baseball')return ['SP','RP','P'].includes(role)?{OUTS:15+v,PH:3+v%4,ER:v%4,PBB:v%3,PK:4+v,W:v%2,L:(v+1)%2,SV:role==='RP'?1:0,HLD:role==='RP'?v%2:0}:{AB:4+v%2,H:2+v%2,'2B':v%2,'3B':0,HR:v%2,R:1+v%2,RBI:v%4,BB:v%2,K:1+v%2,SB:v%2};
 if(role==='QB')return {PYDS:200+v*12,PTD:1+v%3,INT:v%2,RYDS:v*4,RTD:v%2};
 if(role==='PK')return {FGM20:1+v%2,FGM40:v%2,XPM:2+v%3};
 if(role==='DEF')return {PA:14+v,DSTSACK:1+v%4,DSTINT:v%3,DSTFR:v%2,DSTTD:0};
 return {REC:3+v%6,RECYDS:35+v*9,RECTD:v%2,RYDS:['RB','FB'].includes(role)?50+v*7:0,RTD:role==='RB'?v%2:0,FUML:v%2};
}
function make(config,{NOW,finish}){
 const c=resolve(config.context,config.sportGame),spec=JSON.parse(JSON.stringify(c.spec));if(config.status==='finished')spec.span.to=Math.max(1,config.history);
 const context={...c.context,couch:config.players,pool:config.players*spec.get.each},problems=G.specProblems(spec,context);if(problems.length||G.specWaitsFor(spec).length||!G.typeOf(spec))throw Error('Sport context rejected this spec: '+JSON.stringify(problems));
 let state=S.defaultState();Object.assign(state.settings,{game:spec,leagueTypeId:G.typeOf(spec),showId:'bench-'+c.sport.id,showFormat:'generic',setupComplete:true,teamSize:spec.get.each,activeSlots:c.start,benchSlots:c.bench,ownershipMode:'exclusive',revealedThroughEpisode:config.history,bonusEnabled:false,tradeEnabled:false,replenishEnabled:false});
 const names=['Alex','Riley','Sam','Jordan','Morgan','Casey','Drew','Taylor'];const label=name=>config.labels==='long'?name+' de la Cruz Montgomery-Wellington':config.labels==='unbroken'?name+'UnbrokenLongName'.repeat(5):name;
 state.players=Array.from({length:config.players},(_,i)=>({id:'bench-p-'+i,name:label(names[i%8]+(i>=8?' '+(i+1):'')),color:['#e6924f','#709ecd','#80b79a','#b691bc'][i%4],active:true}));
 const roleFor=takes=>c.sport.id==='tennis'&&c.league.endsWith('/wta')?'WS':c.sport.positions.find(p=>takes.includes(p.key)||takes.includes(p.group))?.key||c.sport.positions[0]?.key||'Player';
 const roles=c.defaults.slots.lineup.flatMap(slot=>Array(slot.n).fill(roleFor(slot.takes)));
 state.castaways=state.players.flatMap((p,pi)=>Array.from({length:spec.get.each},(_,k)=>{const role=roles[k]||roles[k%roles.length];return {id:'bench-c-'+(pi*spec.get.each+k),name:label(['Avery','Blake','Cameron','Devon','Emery','Finley'][k%6]+' '+role+' '+(pi*spec.get.each+k+1)),role,photoUrl:null,status:'active',ownerIds:[p.id],acquiredVia:'draft'};}));
 state.draftOrder=state.players.map(p=>p.id);state.draftPicksMade=state.castaways.length;state.blindDraft={lockedPlayerIds:state.draftOrder,revealedAt:new Date(NOW-86400000*30).toISOString()};
 const cadence=c.defaults.closes==='weekly'?7:1;
 state.episodes=Array.from({length:config.history+1},(_,i)=>{const n=i+1,done=n<=config.history;return {id:'bench-ep-'+n,number:n,title:c.label+' · '+(cadence===7?'Week ':c.context.part.singular+' ')+n,airsAt:new Date(done?NOW-(config.history+1-n)*cadence*86400000:config.status==='locked'?NOW-60000:NOW+86400000).toISOString(),events:[],bets:[],scoringEvents:[],lineups:Object.fromEntries(state.players.map(p=>[p.id,state.castaways.filter(c=>c.ownerIds.includes(p.id)).slice(0,c.start).map(c=>c.id)])),lineupsLocked:done||config.status==='locked'};});
 if(config.status==='due'&&spec.count?.start)state.episodes.at(-1).lineups[state.players[config.viewer].id]=[];
 state.settings=G.withSpec(state.settings,spec);if(!state.settings)throw Error('The sports spec could not be applied to engine settings');
 state=S.migrateLeagueState(state);
 const lines=Object.fromEntries(state.episodes.filter(e=>e.number<=config.history).map(e=>[e.number,Object.fromEntries(state.castaways.map((p,i)=>[p.id,c.sport.full(rawLine(c.sport,p.role,(config.seed+e.number*7+i*3)%10))]))]));
 const bouts=spec.score.byFormat?Object.fromEntries(Object.entries(lines).map(([n,by])=>[n,Object.fromEntries(Object.entries(by).map(([id,line])=>[id,[{id:'synthetic-bout-'+n+'-'+id,format:c.sport.formats[0]||3,line}]]))])):undefined;
 S.StatsLogic.stamp(state,{lines,bouts,finals:state.episodes.filter(e=>e.number<=config.history).map(e=>e.number),groups:Object.fromEntries(state.castaways.map(p=>[p.id,c.sport.position(p.role)?.group||null])),defs:c.sport.categoryDefs(),periods:c.sport.periods.regulation});
 const result=finish(config,context,spec,state);result.sport={id:c.sport.id,league:c.league,label:c.label,cadence:c.defaults.closes,slots:c.defaults.slots,part:c.context.part,game:c.row.id,about:c.row.about,periods:c.sport.periods,source:'Synthetic stats; engine sport definitions and standard game defaults',surfaces:(catalog().find(s=>s.id===c.league)||addLeague(c.league)).games.find(g=>g.id===config.sportGame).surfaces};return result;
}
module.exports={catalog,resolve,make,rawLine,addLeague,sportRail:R.sportRail};
