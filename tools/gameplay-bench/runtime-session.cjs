// A bench session backed by the shared headless runtime (explorer/runtime.cjs): a v2 definition drives generation,
// application reads and frame writes through the same core as the CLI and HTTP execute. No second rules path.
//
// Two read tiers (docs/PLAN-GAMEPLAY-SCENARIO-EXPLORER.md §3.4):
// - live (openLive, the bench's default): the case is materialized into local zt-gb- DB rows (live-db.cjs) and frames read
//   the REAL API routes; real writes run on the server, then the runtime replays them and records whether the two agree.
// - shaped (createRuntimeSession alone): DB-free; frame-bundle.cjs shapes responses from production projections. The
//   headless/unit tier only. Do not grow it for new surfaces: extend the materializer instead.
const crypto=require('crypto'),path=require('path');
const Live=require('./live-db.cjs'),S=require('../../src/lib/game/state-logic'),R=require('./explorer/runtime.cjs'),J=require('./explorer/json.cjs'),Frame=require('./frame-bundle.cjs'),Data=require('./explorer/runtime-data.cjs');
const jiti=require('jiti')(__filename,{alias:{'@':path.resolve(__dirname,'../../src')}});
const {revealIn,episodesSeen,revealAcross}=jiti('../../src/lib/game/episode-view.ts');
const SURFACES=['full','mini','quick','detail','reveal','wizard'];
// Application routes need UUIDs. Stable per document + game, so the same case keeps the same frame identity.
const uuidOf=(documentId,gameId)=>'00000000-0000-4000-8000-'+J.digest([documentId,gameId]).slice(0,12);
// Reads/writes the application makes that this bridge does not connect yet. They stay visible as gaps (424/501).
const GAPS=[
 {match:/\/answers(\?|$)/,surface:'question sheet',message:'The question-sheet read/write (GET/POST /api/seasons/{id}/answers) needs a pure builder extracted from src/lib/server/answers.ts gameQuestions; no bench copy is made.'},
];

function createRuntimeSession(base,input,options={}){
 const id=crypto.randomUUID();
 // A saved bench export reopens at its execution (pinned replay) and its presentation (game, viewer).
 if(input?.kind==='gameplay-bench-runtime'){const p=input.presentation||{};options={gameId:p.gameId,viewerId:p.viewerId,...options};input=input.execution;}
 const session=input?.kind==='gameplay-execution'?R.resume(input):R.open(input); // throws R.Blocked with a structured report
 const document=session.export().input;
 // The steps an opened run (execution, reproducer) recorded: the explorer can move to any of them (seek).
 const recorded=session.export().trace.map(t=>({action:t.action,origin:t.origin}));
 const uuid=new Map(document.games.map(g=>[g.id,uuidOf(document.id,g.id)])),byUuid=new Map([...uuid].map(([k,v])=>[v,k]));
 let contextId,gameId,viewerId,revision=0,lastReveal=null;
 const people=()=>session.snapshot().people;
 function select({contextId:c,gameId:g,viewerId:v}={}){
  const game=document.games.find(x=>x.id===(g??gameId))||document.games.find(x=>x.contextId===(c??contextId))||document.games[0];
  if(g!==undefined&&game.id!==g)throw Error('Unknown game in this definition');
  const person=v??viewerId??document.situation.viewerId??game.seats[0]??people()[0]?.id;
  if(!people().some(p=>p.id===person))throw Error('Unknown person in this definition');
  const changed=game.id!==gameId||person!==viewerId;gameId=game.id;contextId=game.contextId;viewerId=person;if(changed){revision++;lastReveal=null;}
 }
 select(options);
 let live=null;const comparisons=[];
 // (waiverRuns: a run made by hand answers its batch in Recent changes; its Undo there names the batch, which stands for that week.)
 const waiverRuns=new Map();
 // (castNames: the materialized season's season_cast id -> name, for a call the app makes by that id.)
 let castNames=new Map();
 const resync=async()=>{if(!live)return;const snap=session.snapshot();await Live.sync(live,snap,document,Date.now()-Date.parse(snap.clock));castNames=await Live.castNames(live,live.seasons[contextId].id);};
 const leagueOf=g=>live?live.leagues[g]:uuid.get(g),gameOfLeague=l=>live?Object.keys(live.leagues).find(k=>live.leagues[k]===l):byUuid.get(l);
 const ctx=()=>live?{username:live.users[viewerId].username,userId:live.users[viewerId].id,seasonId:live.seasons[contextId].id,couchId:live.couchId,gameId:live.leagues[gameId]}:{...base.context,gameId:uuid.get(gameId)};
 const userOf=userId=>pid=>pid===viewerId?userId:'bench-user-'+pid;
 function model(){
  const snap=session.snapshot(),world=snap.contexts[contextId],c=ctx(),uo=userOf(c.userId);
  const games=document.games.filter(g=>g.contextId===contextId);
  const marks=Object.fromEntries(world.marks.map(m=>[m.personId,m.through])),seen=marks[viewerId]??0;
  const latest=Math.max(0,...world.events.filter(Data.released).map(e=>e.number));
  const views=games.map(g=>{
   const v=session.project(g.id,viewerId,{leagueId:uuid.get(g.id),userOf:uo}).game;
   if(g.timing==='own-pace')v.pace=Frame.paceOf(v,snap.people,marks,viewerId,latest+1,p=>(marks[p.id]??0)<latest);
   return {id:g.id,view:v};
  });
  const primary=views.find(x=>x.id===gameId),full=snap.games[gameId].state,seated=full.players.some(p=>p.id===viewerId);
  return {snap,world,games,views,primary,full,seen,marks,latest,uo,m:{ctx:c,now:Date.parse(snap.clock),people:snap.people,viewerId,seen,marks,latest,finished:document.situation.lifecycle==='finished',episodes:full.episodes,games:views,primaryView:primary.view,primary:{state:full,spec:document.games.find(g=>g.id===gameId).spec,context:world.context.engine},episodeRows:episodesSeen(primary.view,full,seated?viewerId:null,seen),couchSize:snap.people.length,formatId:world.context.format.id,datasetId:'bench-'+id,provenance:'Shared runtime case '+document.id+' revision '+revision+'; production engine projections; recorded artwork only.',playing:p=>games.filter(g=>snap.games[g.id].state.players.some(x=>x.id===p.id)&&g.roles[p.id]!=='spectator').map(g=>uuid.get(g.id)),couchName:'Friday Crew · bench',stillIn:full.castaways.filter(x=>x.status==='active').length,madeHook:'The definition selected in the explorer runtime'}};
 }
 // Live frames read real routes; the bundle only identifies the frame (who, which season/couch/game) for the proxy.
 const bundle=(theme='night')=>live?{schemaVersion:1,dataset:'bench-live-'+live.key,capturedAt:new Date().toISOString(),context:ctx(),provenance:'Materialized runtime case '+document.id+' (zt-gb-'+live.key+'); real API routes.',responses:{}}:Frame.responses(base,model().m,theme);
 function apply(action,origin){const r=session.apply(action,origin);if(r.status==='accepted'){revision++;lastReveal=null;}return r;}
 // The one reveal across every game of this person's in the context (season-episodes.ts revealSeason's beats).
 function reveal(n,replay=false){
  const before=model();
  if(!Number.isInteger(n)||n<1||n>before.latest)throw Error('Nothing to reveal for that episode yet');
  const again=n<=before.seen;if(replay&&!again)throw Error('Only an episode you have revealed plays again');
  if(!again){const r=apply({type:'reveal',contextId,personId:viewerId,episode:n},'bench-frame');if(!r.ok)throw Error(r.message);}
  const after=model(),parts=after.games.filter(g=>after.snap.games[g.id].state.players.some(p=>p.id===viewerId)&&g.roles[viewerId]!=='spectator').map(g=>revealIn(after.views.find(v=>v.id===g.id).view,after.snap.games[g.id].state,viewerId,n,after.uo)).filter(Boolean);
  if(!parts.length)throw Error('Watch-only reveal (no game seat in this context) needs its own adapter');
  const beats=revealAcross(parts);
  lastReveal={episode:n,stage:beats.stage,finalAt:null,again,out:beats.out,happened:beats.happened,lineup:beats.lineup,games:beats.games,predictions:beats.predictions,table:beats.table,next:after.latest>n?n+1:null,soFar:null,summary:'Synthetic episode recap. '+(after.full.episodes.find(e=>e.number===n)?.title||'Episode '+n)+'. Review the game results, participant contributions and standings.'};
  return lastReveal;
 }
 const fail=(status,error,extra={})=>({status,body:{error,...extra}});
 // The runtime actions an application write stands for. null: no adapter (the write is refused, never sent).
 function actionsFor(method,url,body){
  const c=ctx(),p=url.pathname;
  if(method==='POST'&&p==='/api/seasons/'+c.seasonId+'/reveal')return body.replay===true?[]:[{type:'reveal',contextId,personId:viewerId,episode:body.episode}];
  const lineup=p.match(/^\/api\/leagues\/([0-9a-f-]{36})\/episodes\/([^/]+)\/lineups\/([^/]+)$/),pick=p.match(/^\/api\/leagues\/([0-9a-f-]{36})\/episodes\/([^/]+)\/picks$/),m=lineup||pick;
  if(method==='PUT'&&m){const game=gameOfLeague(m[1]);if(!game)return null;return [{type:lineup?'lineup':'pick',gameId:game,personId:lineup?decodeURIComponent(m[3]):body.playerId,eventId:decodeURIComponent(m[2]),ids:lineup?body.castawayIds:(body.castawayIds||[body.castawayId]),...(lineup&&Object.prototype.hasOwnProperty.call(body,'captainId')?{captainId:body.captainId??null}:{}),...(!lineup&&body.second===true?{second:true}:{})}];}
  // Mid-season waivers: PUT /api/leagues/{L}/waivers/claims ({ pairs } or { spot }; with playerId, the classic route's Claim for:
  // its rules differ from Backstage's, so it isn't translated) and POST /api/leagues/{L}/waivers/free-agency { addId, dropId }, as
  // the viewer.
  const waiver=p.match(/^\/api\/leagues\/([0-9a-f-]{36})\/waivers\/(claims|free-agency)$/);
  if(waiver){const game=gameOfLeague(waiver[1]);if(!game||(body.playerId&&body.playerId!==viewerId))return null;return waiver[2]==='claims'?(method==='PUT'?[{type:'claim',gameId:game,personId:viewerId,...(body.spot?{spot:body.spot}:{pairs:body.pairs||[]})}]:null):(method==='POST'?[{type:'freeAgency',gameId:game,personId:viewerId,addId:body.addId,dropId:body.dropId||null}]:null);}
  // What whoever runs the game does with its waivers. The app's door is Backstage › Waivers, POST /api/seasons/{S}/backstage/waivers
  // { leagueId, action }: window { swaps, replace }, run, undo, claimFor { playerId, dropId, addIds } (preview and claimView only read:
  // untracked below; feel and set change how waivers work mid-game: no adapter). A run answers its batch in Recent changes, whose
  // Undo (POST /api/seasons/{S}/changes/{batch}/undo) names that week. The classic routes: POST /api/leagues/{L}/waivers/window
  // { swaps, replace }, /process and /undo.
  if(method==='POST'&&p==='/api/seasons/'+c.seasonId+'/backstage/waivers'){const game=gameOfLeague(body.leagueId);if(!game)return null;
   if(body.action==='window')return [{type:'waiverWindow',gameId:game,personId:viewerId,swaps:body.swaps,...(typeof body.replace==='boolean'?{replace:body.replace}:{})}];
   if(body.action==='run')return [{type:'waiverRun',gameId:game,personId:viewerId}];
   if(body.action==='undo')return [{type:'waiverUndo',gameId:game,personId:viewerId}];
   if(body.action==='claimFor')return [{type:'claim',gameId:game,personId:viewerId,forId:body.playerId,spot:{dropId:body.dropId,addIds:body.addIds}}];
   return null;}
  const undone=p.match(/^\/api\/seasons\/([0-9a-f-]{36})\/changes\/([^/]+)\/undo$/);
  if(method==='POST'&&undone&&undone[1]===c.seasonId){const run=waiverRuns.get(decodeURIComponent(undone[2]));return run?[{type:'waiverUndo',gameId:run.gameId,personId:viewerId,periodId:run.periodId}]:null;}
  const byHand=p.match(/^\/api\/leagues\/([0-9a-f-]{36})\/waivers\/(window|process|undo)$/);
  if(method==='POST'&&byHand){const game=gameOfLeague(byHand[1]);if(!game)return null;return [byHand[2]==='window'?{type:'waiverWindow',gameId:game,personId:viewerId,swaps:body.swaps,...(typeof body.replace==='boolean'?{replace:body.replace}:{})}:{type:byHand[2]==='process'?'waiverRun':'waiverUndo',gameId:game,personId:viewerId}];}
  // A group slot (get.groups): PUT /api/leagues/{L}/episodes/{ep}/group-slots/{player} { slot, groupId }.
  const slot=p.match(/^\/api\/leagues\/([0-9a-f-]{36})\/episodes\/([^/]+)\/group-slots\/([^/]+)$/);
  if(method==='PUT'&&slot){const game=gameOfLeague(slot[1]);if(!game)return null;return [{type:'groupSlot',gameId:game,personId:decodeURIComponent(slot[3]),eventId:decodeURIComponent(slot[2]),slot:body.slot,groupId:body.groupId??null}];}
  // Side bets (classic routes; the new app only guesses and takes back): /api/leagues/{L}/episodes/{ep}/bets...
  const bet=p.match(/^\/api\/leagues\/([0-9a-f-]{36})\/episodes\/([^/]+)\/bets(?:\/([^/]+)(?:\/predictions(?:\/([^/]+))?)?)?$/);
  if(bet){const game=gameOfLeague(bet[1]);if(!game)return null;const eventId=decodeURIComponent(bet[2]),betId=bet[3]&&decodeURIComponent(bet[3]),predId=bet[4]&&decodeURIComponent(bet[4]);
   if(method==='POST'&&!betId)return [{type:'bet',gameId:game,personId:viewerId,eventId,label:body.label,points:body.points}];
   if(method==='POST'&&betId&&p.endsWith('/predictions'))return [{type:'guess',gameId:game,personId:body.playerId,eventId,betId,guess:body.guess}];
   if(method==='DELETE'&&predId)return [{type:'unguess',gameId:game,personId:viewerId,eventId,betId,predId}];
   if(method==='PATCH'&&predId)return [{type:'grade',gameId:game,personId:viewerId,eventId,betId,predId,value:body.value??null}];
   return null;}
  if(method==='POST'&&p==='/api/seasons/'+c.seasonId+'/answers'){const game=gameOfLeague(url.searchParams.get('league'));if(!game||!body||typeof body.answers!=='object')return null;const episode=body.episode??(model().seen+1),once=new Set((document.games.find(g=>g.id===game).spec.ask||[]).filter(q=>q.asked==='once').map(q=>q.id));return Object.entries(body.answers).map(([question,answer])=>({type:'answer',gameId:game,personId:viewerId,question,episode:once.has(question)?0:episode,answer}));}
  // The top scorer's twist: POST /api/leagues/{L}/twist { twist }, the seat's choice of the open episode's twist.
  const twistAt=p.match(/^\/api\/leagues\/([0-9a-f-]{36})\/twist$/);
  if(method==='POST'&&twistAt){const game=gameOfLeague(twistAt[1]);if(!game)return null;return [{type:'twist',gameId:game,personId:viewerId,twist:body&&typeof body.twist==='string'?body.twist:''}];}
  // Weekly Calls: POST /api/seasons/{S}/calls/{n}?couch= { calls: { [question]: answer | null } }, a cast call by its season_cast id.
  const callAt=p.match(/^\/api\/seasons\/([0-9a-f-]{36})\/calls\/(\d+)$/);
  if(method==='POST'&&callAt&&callAt[1]===c.seasonId&&body&&body.calls&&typeof body.calls==='object'&&!Array.isArray(body.calls)){const w=session.snapshot().contexts[contextId],named=new Map(w.participants.map(x=>[x.name,x.id]));return Object.entries(body.calls).map(([q,a])=>({type:'call',contextId,personId:viewerId,episode:Number(callAt[2]),question:q,answer:a===null?null:q==='out'?(named.get(castNames.get(a))??a):a}));}
  return null;
 }
 // Writes the runtime doesn't model but the product needs for a real experience (social, preferences): sent to the app,
 // logged as untracked, never compared. They only touch this case's zt-gb rows and are removed with it.
 function untracked(method,url,body){
  if(!live||method==='GET')return false;const c=ctx(),p=url.pathname,season='/api/seasons/'+c.seasonId;
  if(method==='POST'&&p===season+'/backstage/waivers'&&body&&(body.action==='preview'||body.action==='claimView'))return true; // (what Run now would do, someone's week: they write nothing)
  return p===season+'/chat'||p===season+'/chat/read'||p.startsWith(season+'/chat/')||/^\/gifs\/\d+$/.test(p.slice(season.length))&&p.startsWith(season)||/^\/api\/me\/(preferences|notifications(\/.*)?)$/.test(p);
 }
 const untrackedWrites=[];
 // Compare what the real write left in the DB with the runtime's state after replaying it.
 function compare(actions,real){
  const snap=session.snapshot(),diffs=[];
  for(const a of actions){
   if(a.type==='lineup'||a.type==='pick'){
    const dbState=real.states.get(live.leagues[a.gameId]),rt=snap.games[a.gameId].state;
    const pickOf=st=>{const ep=st?.episodes?.find(e=>e.id===a.eventId);return a.type==='lineup'?(ep?.lineups?.[a.personId]||null):S.PickEmLogic.picked(S.pickEmPickFor(st,a.eventId,a.personId));};
    const r=pickOf(dbState),t=pickOf(rt);if(J.canonical(r)!==J.canonical(t))diffs.push({action:a.type,game:a.gameId,server:r,runtime:t});
    // (A captain named with the lineup: as the server kept it.)
    if('captainId' in a){const cap=st=>st?.episodes?.find(e=>e.id===a.eventId)?.captains?.[a.personId]??null;if(cap(dbState)!==cap(rt))diffs.push({action:'captain',game:a.gameId,server:cap(dbState),runtime:cap(rt)});}
   }else if(a.type==='reveal'){
    const mark=snap.contexts[a.contextId].marks.find(m=>m.personId===a.personId).through,user=live.users[a.personId].id;
    const follow=real.follows.find(f=>f.user_id===user&&f.season_id===live.seasons[a.contextId].id)?.seen_through??0;
    if(follow!==mark)diffs.push({action:'reveal',person:a.personId,server:follow,runtime:mark});
   }else if(['bet','guess','unguess','grade'].includes(a.type)){
    const shape=st=>(st?.episodes||[]).map(e=>[e.id,(e.bets||[]).map(b=>[b.label,b.points,(b.predictions||[]).map(q=>[q.playerId,q.guess,q.correct]).sort()])]).filter(([,b])=>b.length);
    const r=shape(real.states.get(live.leagues[a.gameId])),t=shape(snap.games[a.gameId].state);if(J.canonical(r)!==J.canonical(t))diffs.push({action:a.type,game:a.gameId,server:r,runtime:t});
   }else if(['claim','freeAgency','waiverWindow','waiverRun','waiverUndo'].includes(a.type)){
    // Mid-season waivers: the weeks (a week the server opened by hand has its own id, so in order), who holds whom, the moves, and
    // every seat's private claim (waiver_claims against the runtime's store). Times are the server's own clock: not compared.
    const leagueId=live.leagues[a.gameId],store=snap.stores.waivers?.[a.gameId];
    const shape=(st,claimsOf)=>({weeks:(st?.midSeason?.waivers?.periods||[]).map(q=>[q.episode,q.phase,!!q.window,q.swaps??0,q.replace??null,q.openedBy??null,!!q.hold,!!q.turnedOff,q.claimsIn||[],q.run?[q.run.by,q.run.results.map(x=>[x.playerId,x.kind,x.outcome,x.castawayId??null,x.droppedCastawayId??null])]:null,(q.autoFills||[]).length,claimsOf(q.id)]),teams:(st?.castaways||[]).filter(x=>x.ownerIds.length).map(x=>[x.id,[...x.ownerIds].sort()]),log:(st?.midSeason?.log||[]).map(t=>[t.type,t.playerId,t.via??null,t.episode??null])});
    const r=shape(real.states.get(leagueId),id=>(real.claims||[]).filter(x=>x.league_id===leagueId&&x.period_id===id).map(x=>[x.player_id,(x.pairs||[]).map(y=>y.addId+'>'+y.dropId)])),t=shape(snap.games[a.gameId].state,id=>Object.entries(store?.weeks?.[id]||{}).sort(([m,x],[n,y])=>x.seq-y.seq||(m<n?-1:1)).map(([pid,x])=>[pid,x.claim.pairs.map(y=>y.addId+'>'+y.dropId)]));
    if(J.canonical(r)!==J.canonical(t))diffs.push({action:a.type,game:a.gameId,server:r,runtime:t});
   }else if(a.type==='twist'){
    // The open choice as the server kept it (twist_choices, not filed), against the runtime's.
    const open=r=>r&&!r.filed?[r.player_id??r.playerId,r.twist]:null,row=real.twists.filter(r=>r.league_id===live.leagues[a.gameId]).find(r=>!r.filed),mine=Object.values(snap.stores.twists?.[a.gameId]||{}).find(r=>!r.filed);
    if(JSON.stringify(open(row))!==JSON.stringify(open(mine)))diffs.push({action:'twist',game:a.gameId,server:open(row),runtime:open(mine)});
   }else if(a.type==='call'){
    // The call as the server kept it (a cast call named), against the runtime's store.
    const user=live.users[a.personId].id,row=real.calls.find(r=>r.user_id===user&&r.season_id===live.seasons[a.contextId].id&&r.episode===a.episode&&r.question===a.question);
    const named=new Map(snap.contexts[a.contextId].participants.map(x=>[x.id,x.name])),mine=(snap.stores.calls?.[a.contextId]||[]).find(r=>r.personId===a.personId&&r.episode===a.episode&&r.question===a.question);
    const server=row?(row.question==='out'?row.cast_name:row.answer):null,runtime=mine?(mine.question==='out'?named.get(mine.answer):mine.answer):null;
    if(server!==runtime)diffs.push({action:'call',episode:a.episode,question:a.question,server,runtime});
   }else if(a.type==='answer'){
    const row=real.answers.find(r=>r.league_id===live.leagues[a.gameId]&&r.player_id===a.personId&&r.question===a.question&&r.episode===a.episode)?.answer??null;
    const mine=(snap.stores.answers[a.gameId]||[]).find(r=>r.playerId===a.personId&&r.question===a.question&&r.episode===a.episode)?.answer??null;
    if(J.canonical(row)!==J.canonical(mine))diffs.push({action:'answer',game:a.gameId,question:a.question,server:row,runtime:mine});
   }
  }
  return diffs;
 }
 function mutate(method,url,body){
  if(live)return null; // live frames send writes to the real routes (live.observe)
  const c=ctx(),p=url.pathname;
  if(method==='POST'&&p==='/api/seasons/'+c.seasonId+'/reveal'){try{return {status:200,body:reveal(body.episode,body.replay===true)};}catch(e){return fail(422,e.message);}}
  const lineup=p.match(/^\/api\/leagues\/([0-9a-f-]{36})\/episodes\/([^/]+)\/lineups\/([^/]+)$/),pick=p.match(/^\/api\/leagues\/([0-9a-f-]{36})\/episodes\/([^/]+)\/picks$/);
  const m=lineup||pick;
  if(method==='PUT'&&m){
   const game=byUuid.get(m[1]);if(!game)return fail(404,'Game is not in this definition');
   const personId=lineup?decodeURIComponent(m[3]):body.playerId;if(personId!==viewerId)return fail(403,'The frame acts only as the selected viewer');
   const r=apply({type:lineup?'lineup':'pick',gameId:game,personId,eventId:decodeURIComponent(m[2]),ids:lineup?body.castawayIds:(body.castawayIds||[body.castawayId]),...(!lineup&&body.second===true?{second:true}:{})},'bench-frame');
   return r.ok?{status:200,body:{ok:true}}:fail(r.status==='blocked'?501:422,r.message,{actionId:r.id});
  }
  const gap=GAPS.find(x=>x.match.test(p+url.search));
  if(gap)return fail(501,'Bench bridge gap: '+gap.message);
  return null; // Unknown writes stay blocked by the frame proxy (403); nothing reaches the real application.
 }
 function state(){
  const x=model();
  const w=x.snap.contexts[contextId],gone=new Map(w.facts.flatMap(f=>(f.data.events||[]).map(o=>[o.castawayId,f.eventId]))),who=new Map(w.participants.map(p=>[p.id,p.name]));
  return {id,kind:'runtime',revision,hash:session.hash(),documentId:document.id,title:options.label||document.id,source:options.source||null,
   events:w.events.map(e=>({id:e.id,number:e.number,airAt:e.airAt,resultStatus:e.resultStatus||'unavailable',out:[...gone].filter(([,ev])=>ev===e.id).map(([pid])=>who.get(pid))})),
   steps:{recorded:recorded.length,at:session.export().trace.length},notes:session.export().preparation.notes||[],
   // Side bets as the explorer sees them (everyone's guesses: the explorer is omniscient; the app is not).
   betGames:document.games.filter(g=>S.betsOn(x.snap.games[g.id].state)).map(g=>({id:g.id,commissioner:(Object.entries(g.roles).find(([,r])=>r==='commissioner')||[])[0]||x.snap.games[g.id].state.players[0]?.id})),
   bets:document.games.filter(g=>S.betsOn(x.snap.games[g.id].state)).flatMap(g=>x.snap.games[g.id].state.episodes.flatMap(e=>(e.bets||[]).map(b=>({gameId:g.id,eventId:e.id,episode:e.number,betId:b.id,label:b.label,points:b.points,predictions:(b.predictions||[]).map(q=>({id:q.id,playerId:q.playerId,guess:q.guess,correct:q.correct}))})))),contextId,gameId,viewerId,clock:x.snap.clock,
   people:x.snap.people.map(p=>({id:p.id,name:p.name,seen:x.marks[p.id]??0,games:x.games.filter(g=>x.snap.games[g.id].state.players.some(q=>q.id===p.id)).map(g=>g.id)})),
   games:document.games.map(g=>({id:g.id,uuid:uuid.get(g.id),contextId:g.contextId,name:x.views.find(v=>v.id===g.id)?.view.gameName??g.name??g.id,timing:g.timing})),
   latest:x.latest,seen:x.seen,trace:session.export().trace.map(t=>({index:t.index,type:t.action.type,origin:t.origin,status:t.status,message:t.message,after:t.after})),
   renderer:options.app||null,gaps:live?[]:GAPS.map(g=>({surface:g.surface,message:g.message})),live:live?{key:live.key,seasonId:live.seasons[contextId].id,couchId:live.couchId,leagues:{...live.leagues},users:Object.fromEntries(Object.entries(live.users).map(([k,u])=>[k,u.username])),comparisons:comparisons.slice(-50),untracked:untrackedWrites.slice(-50),mismatches:comparisons.filter(c=>!c.agree).length}:null,evidence:{rendering:'unverified',interaction:'unverified',design:'unreviewed'}};
 }
 const api={id,kind:'runtime',document,get viewer(){return viewerId;},get app(){return options.app||null;},surfaces:()=>SURFACES,get gameUuid(){return leagueOf(gameId);},get revision(){return revision;},select,bundle,mutate,reveal,state,clock:()=>live?null:session.snapshot().clock,
  async goLive(){live=await Live.up(session.snapshot(),document,options.db);await resync();const snap=session.snapshot();await Live.seedSocial(live,snap,document,Date.now()-Date.parse(snap.clock));revision++;},
  // Live frames: which writes may go to the server, and what happens after one did.
  get live(){return live&&{username:()=>live.users[viewerId].username,allows:(method,url,body)=>actionsFor(method,url,{answers:{},calls:{}})!==null||(!!body&&typeof body==='object'&&actionsFor(method,url,body)!==null)||untracked(method,url,body),
   async observe({method,url,body,status,response}){
    if(untracked(method,url,body)&&actionsFor(method,url,body||{})===null){untrackedWrites.push({method,path:url.pathname,status});return;}
    const actions=actionsFor(method,url,body||{})||[];
    // (A run made by hand: its line in Recent changes stands for the week it ran, the runtime's own id for it.)
    for(const a of actions)if(a.type==='waiverRun'&&status<400&&response&&typeof response.batch==='string'){const week=S.WaiverLogic.current(session.snapshot().games[a.gameId].state);if(week)waiverRuns.set(response.batch,{gameId:a.gameId,periodId:week.id});}
    // The server picks random ids (Core.uid); adopt them when its answer carries the league state, so both sides name the
    // same bet or guess. (A `?quiet` answer doesn't: the runtime's id wins, and the next sync writes it to the DB.)
    const served=response&&(response.episodes?response:response.state&&response.state.episodes?response.state:null);
    for(const a of actions)if(served&&(a.type==='bet'||a.type==='guess')){const known=new Set(),snap=session.snapshot().games[a.gameId].state;for(const e of snap.episodes)for(const b of e.bets||[]){known.add(b.id);for(const q of b.predictions||[])known.add(q.id);}
     const eps=served.episodes.filter(e=>a.eventId==='upcoming'||e.id===a.eventId),made=a.type==='bet'?eps.flatMap(e=>e.bets||[]).find(b=>b.label===a.label&&!known.has(b.id)):eps.flatMap(e=>e.bets||[]).find(b=>b.id===a.betId)?.predictions?.find(q=>q.playerId===a.personId&&q.guess===a.guess&&!known.has(q.id));if(made)a.id=made.id;}
    const results=actions.map(a=>apply(a,'bench-frame-live'));
    const serverOk=status<400&&!(response&&response.error),runtimeOk=results.every(r=>r.status==='accepted');
    const diffs=serverOk||runtimeOk?compare(actions,await Live.read(live)):[];
    const agree=serverOk===runtimeOk&&!diffs.length;
    comparisons.push({index:comparisons.length,method,path:url.pathname,status,serverOk,runtime:results.map(r=>r.status+(r.message?': '+r.message:'')),agree,diffs,...(serverOk?{}:{serverError:response?.error||null})});
    await resync(); // the runtime stays authoritative; a disagreement is kept as the finding above
   }};},
  async apply(action){const r=apply(action,'bench-control');if(r.status==='accepted')await resync();return r;},
  // Results for an episode, generated from the case's seed (who goes out, one moment); a correction picks a different exit.
  // The season's last episode crowns a winner and its finalists (runtime-data.cjs outcome), so the season ends.
  async publish(eventId,status){
   const snap=session.snapshot(),world=snap.contexts[contextId],event=world.events.find(e=>e.id===eventId);if(!event)throw Error('Unknown episode');
   const F=require('../../src/lib/game/formats'),h=k=>parseInt(J.digest([document.seed,eventId,status,k]).slice(0,8),16);
   const before=world.facts.find(f=>f.eventId===eventId)?.data.events?.[0]?.castawayId,gone=new Set(world.facts.filter(f=>f.eventId!==eventId).flatMap(f=>(f.data.events||[]).map(o=>o.castawayId)));
   const still=world.participants.filter(p=>!gone.has(p.id)&&(status!=='corrected'||p.id!==before));if(still.length<2)throw Error('Too few people still in to publish results');
   const finale=event.number===world.events.length,format=F.formatFor(world.context.format.id);
   const moments=(world.context.engine.moments||[]).filter(m=>!m.auto&&!m.off).map(m=>m.id),outs=require('./explorer/runtime-data.cjs').outcome(format,still.map(p=>p.id),k=>h(k==='exit'?'out':k),finale);
   const RD=require('./explorer/runtime-data.cjs'),votes=RD.bounties(document)?RD.voteFacts(format,still.map(p=>p.id),outs,k=>h('vote:'+k)):undefined; // a bounty's votes (who voted for whom)
   const data={events:outs,scoringEvents:moments.length?[{id:'bench-'+eventId+'-'+status,type:moments[h('moment')%moments.length],castawayId:still[h('who')%still.length].id}]:[],...(outs.length?{}:{noExit:true}),...(votes?{votes}:{})};
   return api.apply({type:'results',contextId,eventId,source:'provider-fixture',resultStatus:status,data});
  },
  // The real-route checks (agreement, spoilers) for everyone, on demand (api-checks.cjs). Live tier only.
  async check(){if(!live)throw Error('Checks against real routes need the live tier');const snap=session.snapshot();const all=await require('./api-checks.cjs').checkCase({app:options.app||'http://localhost:3000',ids:live,snap,document,project:(g,p)=>session.project(g,p)});return {problems:all.filter(p=>!p.signature.startsWith('known:')),known:[...new Set(all.filter(p=>p.signature.startsWith('known:')).map(p=>p.signature))],people:snap.people.length,revision};},
  // Move an opened run to step `to` of its recorded steps (0 = its start).
  async seek(to){if(!Number.isInteger(to)||to<0||to>recorded.length)throw Error('Choose a step from 0 to '+recorded.length);session.reset();for(const r of recorded.slice(0,to))session.apply(r.action,r.origin);revision++;lastReveal=null;await resync();},
  revealCheck(n){const x=model();if(!Number.isInteger(n)||n<1||n>x.latest||n>x.seen+1)throw Error('Reveal only a watched episode or the next unseen episode');},
  defaultEpisode(){return Math.max(1,model().seen);},
  async reset(){session.reset();revision++;lastReveal=null;await resync();},
  export(){return {kind:'gameplay-bench-runtime',schemaVersion:1,presentation:{contextId,gameId,viewerId,revision},execution:session.export()};},
  dispose(){session.dispose();if(live){const key=live.key;live=null;Live.down(key,options.db).catch(e=>console.error('[bench] could not remove zt-gb-'+key+': '+e.message));}}};
 return api;
}
/** The bench's default: a runtime case materialized into local zt-gb- rows, read through the real routes. */
async function openLive(base,input,options={}){const s=createRuntimeSession(base,input,options);try{await s.goLive();}catch(e){s.dispose();throw e;}return s;}
module.exports={createRuntimeSession,openLive,uuidOf,SURFACES};
