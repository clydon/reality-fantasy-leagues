const B=require('./scenario.cjs');
const Frame=require('./frame-bundle.cjs');
// Real recorded artwork/header identity; all game facts below come from the synthetic engine state.
function createSession(base,input){
 const ctx={...base.context,gameId:B.GAME_ID},by=suffix=>Object.entries(base.responses).find(([k])=>k.split('?')[0]==='/api/seasons/'+ctx.seasonId+'/'+suffix)?.[1]?.body;
 const cast=Object.entries(base.responses).find(([k])=>k.includes('/games?'))?.[1]?.body?.games.find(g=>g.cast?.length)?.cast||[];
 let scenario=B.makeScenario(input,cast);const initialConfig=B.clone(scenario.config),id=require('crypto').randomUUID();
 let lastReveal=null;
 function bundle(theme='night'){
  const s=scenario,g=B.view(s,ctx);
  const result=Frame.responses(base,{ctx,now:s.now,people:s.state.players,viewerId:s.state.players[s.config.viewer].id,seen:s.seen,marks:s.marks,latest:s.config.history,finished:s.config.status==='finished',episodes:s.state.episodes,games:[{view:g}],primary:{state:s.state,spec:s.spec,context:s.context},episodeRows:B.episodeRows(s,ctx),couchSize:s.config.players,formatId:'survivor',datasetId:'bench-'+id,provenance:'Seeded synthetic game; production engine scoring and viewer projection; recorded artwork only.',playing:()=>[ctx.gameId],couchName:'Friday Crew · bench',stillIn:18,madeHook:'The game and scoring recipe selected in the testing bench'},theme);
  return s.sport?require('./sports-project.cjs').project(result,s,g):result;
 }
 const exportRun=()=>({schemaVersion:1,kind:'gameplay-bench',adapterFingerprint:B.adapterFingerprint,initialConfig,commands:B.clone(scenario.commands),scenario:B.clone(scenario),fixture:bundle(),lastReveal,checks:B.checks(scenario),limits:'In-memory engine validation and scoring. No database persistence or complete server authorization verification.'});
 return {id,initialConfig,get scenario(){return scenario;},bundle,view:()=>B.view(scenario,ctx),checks:()=>B.checks(scenario),command(cmd){const result=B.command(scenario,cmd);if(cmd.type==='viewer')lastReveal=null;return result;},reveal(n,replay=false){const result=B.reveal(scenario,n,ctx,replay);if(n>scenario.seen)B.command(scenario,{type:'reveal'});lastReveal=result;return result;},reset(){scenario=B.makeScenario(initialConfig,cast);lastReveal=null;},export:exportRun,document:()=>require('./explorer/document.cjs').fromLegacy(B.clone(exportRun())),replay(commands){if(!Array.isArray(commands)||commands.length>500)throw Error('Replay needs at most 500 commands');const candidate=B.makeScenario(initialConfig,cast);for(const cmd of commands)B.command(candidate,cmd);scenario=candidate;lastReveal=null;}};
}
module.exports={createSession};
