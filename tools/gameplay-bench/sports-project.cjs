// Sports API presentation adapters. No provider calls or captured TV results are carried into these views.
const Sports=require('./sports.cjs');
function project(bundle,s,g){
 const c=Sports.resolve(s.sport.league,s.sport.game),sid=bundle.context.seasonId,query='?couch='+bundle.context.couchId,season='/api/seasons/'+sid,put=(url,body)=>bundle.responses[url]={status:200,body};
 const word=c.defaults.closes==='weekly'?'week':c.context.part.singular,unit=word[0].toUpperCase()+word.slice(1),art=s.config.images==='missing'?null:'/art/bench/'+(['football','basketball','baseball'].includes(c.sport.id)?c.sport.id:'sport')+'.svg';
 const patchHeader=h=>{if(!h)return;h.seasonNumber=null;h.seasonName='Synthetic bench season';h.release='nightly';h.show={...h.show,slug:'bench-'+c.sport.id,name:c.label,kind:'sport',artUrl:art,backdropUrl:art,network:null,tvmazeId:null,terms:{castaway:'Player',people:'Athletes',tribe:'Team',episode:unit}};};
 const home=bundle.responses['/api/me/home'].body,space=bundle.responses[season+'/space'+query].body;patchHeader(space);home.shows.forEach(patchHeader);
 for(const couch of home.couches)for(const h of couch.seasons||[])patchHeader(h);
 const fill=bundle.responses[season+'/fill'].body;fill.label=c.label+' · synthetic';fill.artUrl=art;fill.words={people:'Athletes',episode:unit,episodes:unit+'s'};
 const roster={groups:[{name:'Synthetic '+c.label+' athletes',people:s.state.castaways.map(p=>({name:p.name,role:p.role,photoUrl:null,stats:{comingIn:null,soFar:null}}))}],canFill:false,asking:false,via:'sports',source:'Synthetic fixture, not ESPN results',waiting:[],held:null,sportsName:c.label,unlisted:false,message:null,available:false,stats:{comingInLabel:null,through:s.seen||null,newer:s.seen<s.config.history?s.seen+1:null,asking:false,message:'Synthetic stats are scored in the game; no historical provider data is claimed.'}};
 put(season+'/roster',roster);
 const how=bundle.responses[season+'/how-it-works'+query].body;
 Object.assign(how.how,{show:c.label,tagline:c.row.about,premise:c.row.about,kind:{key:'sport',name:c.label,line:'Synthetic game context',start:null},rundown:{label:'Each '+unit.toLowerCase(),segments:[]},who:{label:'Athletes',count:s.state.castaways.length,line:'Synthetic athletes and position labels',groups:null}});
 Object.assign(how.how,{jump:[{key:'season',label:'Scored rounds'},{key:'who',label:'Athletes'},{key:'points',label:'Scoring'}],season:{label:'Scored rounds',unit,total:s.config.history+1,you:s.seen,cells:s.state.episodes.map(e=>({n:e.number,seen:e.number<=s.seen,next:e.number===s.seen+1,finale:false})),phases:[],finale:null},waysOut:null,twists:null,updates:{shown:[],hidden:null},lineage:null,results:'Synthetic final box scores. No live provider or real-season outcome is claimed.',games:Sports.catalog().find(x=>x.id===c.league).games.map(g=>({key:g.id,name:g.name}))});
 how.how.points={label:c.spec.score.categories?'Scoring categories':'What scores',aside:'Selected sport default',noPoints:!c.spec.score.points,groups:[{id:'stats',label:c.label,items:c.spec.score.categories?c.spec.score.categories.map(key=>({id:key,label:(c.sport.stat(key)?.label||key)+' · '+(c.sport.stat(key)?.better||'higher')+' wins',points:null})):Object.entries(c.spec.score.points||{}).map(([key,points])=>({id:key,label:c.sport.stat(key)?.label||key,points,defaultPoints:points,auto:true,league:false}))}]};
 how.cast=g.cast.map(p=>({name:p.name,photo:null,colour:null}));
 // The existing sports wizard uses its own production rail, not the TV made-for-game rail.
 const start=bundle.responses[season+'/start'+query].body;Object.assign(start,{label:c.label,show:c.label,artUrl:art,kind:'sport',sport:{league:c.league},part:{singular:unit.toLowerCase(),plural:unit.toLowerCase()+'s'},wizard:null});
 const starts=Array.from({length:13},(_,i)=>({number:i+1,title:c.label+' · synthetic '+unit.toLowerCase()+' '+(i+1),airAt:new Date(s.now+(i+1)*86400000).toISOString()}));start.starts=starts;
 for(let count=1;count<=13;count++)put('/api/sports/start?count='+count+'&league='+encodeURIComponent(c.league),{games:Sports.sportRail(c.league,{count})});
 bundle.provenance='Synthetic '+c.label+' rosters and box scores; production sport defaults, stat formulas, ranking and viewer projection. No live provider requests.';
 return bundle;
}
module.exports={project};
