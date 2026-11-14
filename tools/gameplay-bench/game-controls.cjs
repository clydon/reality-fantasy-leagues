// Presentation contracts describe actual spec mechanics; they do not implement game rules.
const G=require('../../src/lib/game/game-spec'),W=require('../../src/lib/game/start-wizard');
function controlsOf(spec,{fixed=false}={}){
 const s=G.fullSpec(spec),field=(key,label,value,min,max)=>({key,label,value,min,max:fixed?Math.max(value,max):max,fixed});
 if(s.stages)return {fields:[],summary:'Stage order, child games and overall scoring need a stage fixture adapter.'};
 if(s.get?.by==='draft'){
  const roster=s.get.each;
  if(s.count?.start)return {fields:[field('starters','Starting slots',s.count.start,1,G.MAX_STARTERS),field('bench','Reserve slots',roster-s.count.start,0,G.MAX_BENCH)],summary:'Choose a lineup each round. Only the selected starters count.'};
  if(s.count?.best)return {fields:[field('rosterSize','Roster size',roster,1,G.MAX_LINEUP_TEAM),field('bestCount','Best scorers counted',s.count.best,1,fixed?roster:G.MAX_STARTERS)],summary:'The engine selects the best scorers automatically. No lineup to submit.'};
  return {fields:[field('rosterSize','Roster size',roster,1,G.MAX_TEAM)],summary:'The whole roster counts. No starting lineup or reserve slots.'};
 }
 if(s.get?.by==='pick')return {fields:[{...field('picksPerRound','Picks per round',s.get.each,1,G.MAX_PICKS),fixed:fixed||s.score?.by==='survive'}],summary:s.score?.by==='survive'?'Pick who stays in. Repeat rules, streaks and lives come from the game spec.':'Make fresh picks each round. There is no drafted roster.'};
 if(s.get?.by==='squares')return {fields:[field('gridSize','Grid width',s.get.grid,1,s.get.grid)],summary:'Claim or receive grid squares. Digits and period payouts come from the game spec.'};
 if(s.get?.by==='card')return {fields:[],summary:'A bingo card with grading and line results. Card data needs its own adapter.'};
 return {fields:s.ask?.some(q=>q.answer==='calls')?[]:[{key:'questionCount',label:'Question definitions',value:s.ask?.length||0,min:0,max:s.ask?.length||0,fixed:true}],summary:s.ask?.some(q=>q.answer==='calls')?'The show’s two-call format. Call options and grading need their own adapter.':(s.ask?.length||0)+' question definitions. Answer types, options, locks and grading belong to the question fixture.'};
}
const implemented=new Set(['lineup','best-ball','outlast','picks','pool']);
function specOf(c){
 const get={by:'draft',each:c.rosterSize||3,order:'blind',own:'shared'};
 if(c.showGame==='outlast')return G.fullSpec({preset:'outlast',get,extras:{bets:null}});
 if(c.showGame==='best-ball')return G.fullSpec({preset:'weekly-lineup',get:{...get,each:c.rosterSize||5},count:{best:c.bestCount||3}});
 if(c.showGame==='picks')return G.fullSpec({get:{by:'pick',each:c.picksPerRound||1,repeat:'any'},count:{pick:true},score:{by:'moments',points:null},rank:{by:'total'}});
 if(c.showGame==='pool')return G.fullSpec({preset:'survival-pool'});
 if(c.showGame==='calls')return G.fullSpec({preset:'weekly-calls'});
 if(c.showGame==='bingo')return G.fullSpec({preset:'weekly-bingo'});
 if(c.showGame==='questions')return G.fullSpec({get:{by:'none'},score:{by:'answers'},rank:{by:'total'},ask:[{id:'boot',ask:'Who goes home?',answer:'person',asked:'each',points:2,settle:{by:'results',take:'out'}}]});
 return G.fullSpec({preset:'weekly-lineup',get:{...get,each:(c.starters??3)+(c.bench??2)},count:{start:c.starters??3}});
}
function showCatalog(){return [...W.KINDS.map(k=>{const spec=specOf({showGame:k.base}),ready=implemented.has(k.base);return {id:k.base,name:k.name,type:G.typeOf(spec),implemented:ready,reason:ready?null:'Needs episode data, interaction and grading adapters for this family',controls:controlsOf(spec),surfaces:ready?['full','mini','detail','reveal','wizard',...(['lineup','picks','pool'].includes(k.base)?['quick']:[])]:[],spec};}),...G.LEAGUE_TYPES.filter(type=>!W.KINDS.some(k=>G.typeOf(specOf({showGame:k.base}))===type)&&type!=='squares').map(type=>({id:type,name:type==='stages'?'Multi-stage / hybrid':type,type,implemented:false,reason:'Needs child-game fixtures, stage transitions and interaction adapters',controls:{fields:[],summary:'Configure and inspect each child game with its own controls.'},surfaces:[]}))];}
module.exports={controlsOf,showCatalog,specOf,implemented};
