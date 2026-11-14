const fs=require('fs'),path=require('path'),B=require('./scenario.cjs'),{createSession}=require('./session.cjs');
const Sports=require('./sports.cjs'),Controls=require('./game-controls.cjs'),{createRuntimeSession,openLive}=require('./runtime-session.cjs'),Runtime=require('./explorer/runtime.cjs');
// Host pages a runtime case can open (real routes in the live tier): where redesigns of Tonight, Episodes and the hub are reviewed.
const HOST={tonight:{name:'Tonight',route:'/show/{seasonId}/tonight'},episodes:{name:'Episodes',route:'/show/{seasonId}/episodes'},hub:{name:'Hub',route:'/home'},chat:{name:'Chat',route:'/show/{seasonId}/chat'}};
function router({out,activate,releaseBench,sourceFingerprint}){
 const sessions=new Map(),cases=new Map(),source=path.join(out,'datasets/recorded.json'),G=require('../../src/lib/game/game-spec');
 const meta=()=>({ready:fs.existsSync(source),contexts:[{id:'show',name:'Survivor · show',games:Controls.showCatalog()},...Sports.catalog()],presets:B.presets,defaults:B.configOf(),limits:{starters:G.MAX_STARTERS,bench:G.MAX_BENCH,team:G.MAX_LINEUP_TEAM},surfaces:[{id:'full',name:'Full game'},{id:'mini',name:'Games overview'},{id:'quick',name:'Quick action'},{id:'detail',name:'Player & scoring'},{id:'reveal',name:'Episode reveal'},{id:'wizard',name:'Creation baseline'},...Object.entries(HOST).map(([id,h])=>({id,name:h.name,runtimeOnly:true}))],adapterFingerprint:B.adapterFingerprint,scope:'Show / all app sports · real engine · memory only',sourceFingerprint});
 async function frame(s,surface='full',theme='night',episode,section='story'){
  const host=s.kind==='runtime'&&HOST[surface];
  if(!host&&!['full','mini','quick','detail','reveal','wizard'].includes(surface)||!['night','studio'].includes(theme)||!['story','lineup','table'].includes(section))throw Error('Unknown surface, theme or reveal section');
  const runtime=s.kind==='runtime';
  if(!runtime&&!(s.scenario.sport?.surfaces||Controls.showCatalog().find(g=>g.id===s.scenario.config.showGame)?.surfaces||[]).includes(surface))throw Error('This sport/game needs an additional '+surface+' adapter. Season creation needs the league-slate entry; category detail/reveal needs a stat-oriented presentation. See the context gaps.');
  const n=episode??(runtime?s.defaultEpisode():Math.max(1,s.scenario.seen));if(surface==='reveal')runtime?s.revealCheck(n):B.reveal(s.scenario,n);
  const entry=host?{id:'bench.'+s.id+'.'+(s.live?s.viewer+'.':'')+surface,surface,route:host.route,profile:'bench',dataset:'recorded',dataKind:'generated-engine-state'}:{id:'bench.'+s.id+'.'+(runtime?s.gameUuid.slice(-12)+'.'+(s.live?s.viewer+'.':''):'')+surface+(surface==='reveal'?'.'+n+'.'+section:''),surface:['mini','reveal','wizard'].includes(surface)?'games':'game',route:['mini','reveal','wizard'].includes(surface)?'/show/{seasonId}/games'+(surface==='reveal'?'?page=reveal&ep='+n:''):'/show/{seasonId}/game/{gameId}',profile:'bench',dataset:'recorded',dataKind:'generated-engine-state',...(surface==='quick'?{action:{selector:'[data-game-strip] button'}}:surface==='detail'?{action:{selector:'[data-player]'}}:surface==='wizard'?{action:{steps:[{selector:'[data-start-row]'},{selector:'[data-start-premiere="out"]'},{selector:'[data-start-game="made-0"]'}]}}:surface==='reveal'&&section!=='story'?{action:{steps:[{selector:'[data-stage][aria-label="Next"]',until:'[data-beat="'+section+'"]',ready:'[data-beat]',limit:16}]}}:{})};
  if(surface==='wizard'&&!runtime&&s.scenario.sport)entry.action={steps:[{selector:'[data-start-row]'},{selector:'[data-sport-mode="season"]'},{selector:'[data-sport-game="'+s.scenario.sport.game+'"]'}]};
  const info=await activate(entry.id,'recorded',theme,'captured',runtime?s.gameUuid:B.GAME_ID,runtime?{sessionId:s.id,entry,bundle:theme=>s.bundle(theme),clock:()=>s.clock(),mutate:(method,url,body)=>s.mutate(method,url,body),live:s.live,app:s.app}:{sessionId:s.id,entry,bundle:theme=>s.bundle(theme),mutate(method,url,body){
   const match=url.pathname.match(new RegExp('^/api/leagues/'+B.GAME_ID+'/episodes/(bench-ep-\\d+)/lineups/(bench-p-\\d+)$'));
   if(method==='POST'&&url.pathname==='/api/seasons/'+s.bundle().context.seasonId+'/reveal'){
    try{return {status:200,body:s.reveal(body.episode,body.replay===true)};}catch(e){return {status:422,body:{error:e.message}};}
   }
   const pick=url.pathname.match(new RegExp('^/api/leagues/'+B.GAME_ID+'/episodes/(bench-ep-\\d+)/picks$'));
   if(method==='PUT'&&pick){try{s.command({type:'pick',episodeId:pick[1],playerId:body.playerId,ids:body.castawayIds||[body.castawayId]});return {status:200,body:{ok:true}};}catch(e){return {status:422,body:{error:e.message}};}}
   if(method!=='PUT'||!match)return null;
   try{s.command({type:'lineup',episodeId:match[1],playerId:match[2],ids:body.castawayIds});return {status:200,body:{ok:true}};}catch(e){return {status:422,body:{error:e.message}};}
  }});
  return {...info,benchFlow:{surface,episode:surface==='reveal'?n:null,section}};
 }
 // The v2 bridge: a definition opened here drives generation, frame reads and frame writes through explorer/runtime.cjs.
 // Every POST may carry expectedRevision; a stale one is refused with the current state, so a late response never wins.
 const brief=r=>({status:'blocked',category:r.category,message:r.message,...(r.gaps?{gaps:r.gaps}:{}),...(r.diagnostics?{diagnostics:r.diagnostics}:{}),...(r.analysis?{engine:r.analysis.engine?.status}:{})});
 // A renderer is a running local app (plan §6A item 5): this checkout's dev server, or a worktree's (another design).
 // Discovered on loopback ports 3000-3015, plus ATLAS_RENDERERS="name=http://localhost:30xx,...". Each must read the same
 // local database as the materializer, or it cannot sign in the case's zt users (reported when a frame opens).
 async function renderers(){
  const found=[],seen=new Set(),add=(id,app,label,db)=>{if(!seen.has(app)){seen.add(app);found.push({id,app,label,db});}};
  for(const pair of (process.env.ATLAS_RENDERERS||'').split(',').filter(Boolean)){const [name,app]=pair.split('=');if(/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(app||''))add(name,app,name+' ('+app.split(':').pop()+')');}
  const trees=require('./worktrees.cjs').worktreeApps();
  await Promise.all(trees.map(async w=>{const app='http://localhost:'+w.port;try{const r=await fetch(app+'/api/me/home',{redirect:'manual',signal:AbortSignal.timeout(1500)});if(r.status===401||r.status===200)add(w.main?'main':w.folder,app,(w.main?'This checkout':w.branch||w.folder)+' (:'+w.port+')',w.main?undefined:w.db);}catch{}}));
  return found.sort((a,b)=>a.app.localeCompare(b.app));
 }
 async function runtimeRoute(method,action,url,body){
  // The built-in example for an empty explorer: three games, Bo a week behind (the Chunk 4 proof's definition).
  if(method==='GET'&&action==='example')return {status:200,body:{label:'Three games, Bo a week behind',input:require('../../tests/fixtures/gameplay-explorer/runtime-proof.cjs')({ann:2,bo:1,eventCount:5})}};
  // The old bench's recipe form as a v2 definition (explorer/recipes.cjs); the page then opens it like any other.
  if(method==='POST'&&action==='recipe'){try{return {status:200,body:require('./explorer/recipes.cjs').recipeDefinition(body.config||{})};}catch(e){return {status:422,body:{error:e.message}};}}
  if(method==='GET'&&action==='renderers')return {status:200,body:{renderers:(await renderers()).map(({db,...r})=>r)}}; // database URLs never leave the server
  if(method==='POST'&&action==='open'){
   if(!fs.existsSync(source))throw Error('Capture the recorded Atlas dataset before opening a definition. See docs/UI-ATLAS.md.');
   // live (default): materialized zt-gb- rows read through the real routes; live:false keeps the DB-free shaped tier.
   let s;try{const base=JSON.parse(fs.readFileSync(source,'utf8')),options={gameId:body.gameId,viewerId:body.viewerId,label:typeof body.label==='string'?body.label.slice(0,120):undefined,source:typeof body.source==='string'?body.source.slice(0,160):undefined,...(body.app?(r=>({app:r.app,db:r.db}))((await renderers()).find(r=>r.app===body.app)||(()=>{throw Error('Unknown renderer '+body.app+'; choose one from runtime/renderers');})()):{})};s=body.live===false?createRuntimeSession(base,body.input,options):await openLive(base,body.input,options);}catch(e){if(e instanceof Runtime.Blocked)return {status:200,body:brief(e.report)};throw e;}
   let info;try{info=await frame(s,body.surface,body.theme,body.episode,body.section);}catch(e){s.dispose();throw e;}
   cases.set(s.id,s);if(cases.size>24){const oldest=cases.keys().next().value;releaseBench(oldest);cases.get(oldest).dispose();cases.delete(oldest);}
   return {status:201,body:{status:'open',state:s.state(),frame:info,sourceFingerprint}};
  }
  const s=cases.get(body.id||url.searchParams.get('id'));if(!s)return {status:404,body:{error:'This runtime case expired. Reopen it from its exported definition or execution.'}};
  if(method==='GET'&&action==='state')return {status:200,body:s.state()};
  if(method==='GET'&&action==='export')return {status:200,body:{...s.export(),sourceFingerprint}};
  if(method!=='POST')return {status:404,body:{error:'Unknown runtime action'}};
  if(body.expectedRevision!==undefined&&body.expectedRevision!==s.revision)return {status:409,body:{error:'This case changed since your last view (revision '+s.revision+').',state:s.state()}};
  if(action==='select'){s.select({gameId:body.gameId,viewerId:body.viewerId});return {status:200,body:{state:s.state(),frame:await frame(s,body.surface,body.theme,body.episode,body.section)}};}
  if(action==='frame')return {status:200,body:{state:s.state(),frame:await frame(s,body.surface,body.theme,body.episode,body.section)}};
  if(action==='apply'){const result=await s.apply(body.action);return {status:200,body:{result,state:s.state()}};}
  if(action==='publish'){const result=await s.publish(body.eventId,body.status);return {status:200,body:{result,state:s.state()}};}
  if(action==='check')return {status:200,body:await s.check()};
  if(action==='seek'){await s.seek(body.to);return {status:200,body:{state:s.state()}};}
  if(action==='close'){releaseBench(s.id);s.dispose();cases.delete(s.id);return {status:200,body:{closed:s.id}};}
  if(action==='reset'){await s.reset();return {status:200,body:{state:s.state()}};}
  return {status:404,body:{error:'Unknown runtime action'}};
 }
 return async(method,url,body)=>{try{
  const route=url.pathname.slice('/__atlas/bench/'.length);
  if(method==='GET'&&route==='meta')return {status:200,body:meta()};
  if(method==='GET'&&route==='baseline')return {status:200,body:require('./explorer/baseline.cjs').capture()};
  if(method==='POST'&&route==='execute')return {status:200,body:require('./explorer/runtime.cjs').execute(body.input,body.steps,body.queries)};
  if(method==='POST'&&['normalize','analyze'].includes(route)){
   const D=require('./explorer/document.cjs'),document=D.read(body.input,body.context?{context:body.context}:{});
   return {status:200,body:route==='normalize'?document:require('./explorer/analyze.cjs').analyze(document)};
  }
  if(route.startsWith('runtime/'))return runtimeRoute(method,route.slice('runtime/'.length),url,body);
  if(method==='POST'&&route==='context')return {status:200,body:{context:Sports.addLeague(body.league)}};
  if(method==='POST'&&route==='generate'){
   if(!fs.existsSync(source))throw Error('Capture the recorded Atlas dataset before generating a game. See docs/UI-ATLAS.md.');
   const s=createSession(JSON.parse(fs.readFileSync(source,'utf8')),body.config);if(body.replay)s.replay(body.replay);
   const info=await frame(s,body.surface,body.theme,body.episode,body.section);sessions.set(s.id,s);if(sessions.size>24){const oldest=sessions.keys().next().value;releaseBench(oldest);sessions.delete(oldest);}
   return {status:201,body:{id:s.id,frame:info,config:s.scenario.config,view:s.view(),checks:s.checks(),sourceFingerprint}};
  }
  const s=sessions.get(body.id||url.searchParams.get('id'));if(!s)return {status:404,body:{error:'This bench session expired. Generate it again from its saved seed or replay file.'}};
  if(method==='GET'&&route==='snapshot')return {status:200,body:{...s.export(),sourceFingerprint}};
  if(method==='GET'&&route==='document')return {status:200,body:s.document()};
  if(method==='POST'&&route==='frame')return {status:200,body:{frame:await frame(s,body.surface,body.theme,body.episode,body.section)}};
  if(method==='POST'&&route==='command'){s.command(body.command);return {status:200,body:{view:s.view(),checks:s.checks()}};}
  if(method==='POST'&&route==='reset'){s.reset();return {status:200,body:{view:s.view(),checks:s.checks()}};}
  if(method==='POST'&&route==='replay'){s.replay(body.commands);return {status:200,body:{view:s.view(),checks:s.checks()}};}
  return {status:404,body:{error:'Unknown bench action'}};
 }catch(e){return {status:400,body:{error:e.message}};}};
}
module.exports={router};
