// Shapes a bench situation into the application's real API responses for an isolated Atlas frame.
// Shared by the v1 pilot session (session.cjs) and the v2 runtime session (runtime-session.cjs):
// both supply a model built from production projections; this module adds no game rules.
const S=require('../../src/lib/game/state-logic'),{rulebookFor}=require('../../src/lib/game/formats/blocks'),{howItWorks}=require('../../src/lib/game/formats/rulebook-describe');
const clone=x=>JSON.parse(JSON.stringify(x));
/**
 * model: { ctx, now, people:[{id,name}], viewerId, seen, marks:{personId:through}, latest, finished,
 *   episodes: state episodes [{number,title,airsAt}], games:[{view}] (production gameView results, first = primary),
 *   primary:{state,spec,context}, episodeRows, couchSize, formatId, datasetId, provenance, playing(person)->leagueIds,
 *   couchName, stillIn, madeHook }
 */
function responses(base,m,theme='night'){
 const ctx=m.ctx,by=suffix=>Object.entries(base.responses).find(([k])=>k.split('?')[0]==='/api/seasons/'+ctx.seasonId+'/'+suffix)?.[1]?.body;
 const g=(m.primaryView||m.games[0].view),me=m.people.find(p=>p.id===m.viewerId),userOf=p=>p.id===me.id?ctx.userId:'bench-user-'+p.id;
 const source=by('space');if(!source)throw Error('The recorded dataset needs a show-space projection');
 const refs=m.games.map(x=>({...x.view,couchId:ctx.couchId,seasonId:ctx.seasonId,archived:false,stageOf:null,start:1}));
 const episodes=m.episodes.map(e=>({number:e.number,title:e.title,airAt:e.airsAt,runtimeMin:60,note:'Synthetic bench episode'}));
 const next=episodes.find(e=>e.number===m.latest+1);
 const space={...clone(source),games:refs,episodeCount:episodes.length,status:m.finished?'completed':'airing',schedule:{...source.schedule,upNext:m.finished?null:next,latestAired:m.latest,episodes},you:{...source.you,seenThrough:m.seen,plays:true},people:m.people.map(p=>({userId:userOf(p),name:p.name,role:'member',watching:true,seen:m.marks[p.id],playing:m.playing(p)}))};
 const home=clone(base.responses['/api/me/home'].body),couch=home.couches.find(c=>c.id===ctx.couchId)||home.couches[0];
 const members=m.people.map(p=>({userId:userOf(p),name:p.name,role:'member',image:null}));
 home.user={...home.user,name:me.name,theme};home.shows=[{...space,seenThrough:m.seen,upNext:space.schedule.upNext,latestAired:m.latest,following:true,progress:m.games.filter(x=>x.view.progress).map(x=>({leagueId:x.view.leagueId,...x.view.progress})),results:{reveal:null,final:null}}];
 home.couches=couch?[{...couch,id:ctx.couchId,name:m.couchName,members,games:refs,seasons:[home.shows[0]]}]:[];
 home.moves=m.games.map(x=>x.view).filter(v=>v.lineup&&!v.lineup.set&&!v.lineup.locked&&!v.over).map(v=>({kind:'lineup',leagueId:v.leagueId,leagueName:v.name,text:'Set your episode '+v.lineup.episode+' lineup ('+v.lineup.need+' empty slots)',episode:v.lineup.episode,deadline:v.lineup.airsAt,seasonId:ctx.seasonId,couchId:ctx.couchId}));
 for(const k of ['backstage','unscheduled','plans','couchShows'])home[k]=[];
 const responses={};const put=(url,body)=>responses[url]={status:200,body};
 // Only known read adapters. A new read fails visibly instead of leaking unrelated captured game data.
 for(const k of ['/api/me/profile','/api/me/preferences','/api/catalog'])if(base.responses[k])responses[k]=clone(base.responses[k]);
 put('/api/me/home',home);put('/api/me/notifications',{unread:0,items:[]});
 const season='/api/seasons/'+ctx.seasonId,query='?couch='+ctx.couchId;
 put(season+'/space'+query,space);put(season+'/games'+query,{seasonId:ctx.seasonId,seenThrough:m.seen,games:m.games.map(x=>x.view)});
 const seenRows=new Map(m.episodeRows.map(e=>[e.number,e]));
 put(season+'/episodes'+query,{seenThrough:m.seen,episodes:episodes.filter(e=>e.number<=m.latest).reverse().map(e=>e.number<=m.seen?{...e,...seenRows.get(e.number),status:'seen',gifs:{n:0,mine:false,urls:[]}}:{number:e.number,airAt:e.airAt,title:null,stage:'final',status:'hidden',out:[],happened:[],scorers:[],lines:[],gifs:{n:0,mine:false,urls:[]}}),reveal:m.seen<m.latest?{episode:m.seen+1,stage:'final',finalAt:null}:null,waiting:null,final:null,stillIn:m.stillIn,toAir:null,fill:null});
 for(const suffix of ['backstage/drafts','waivers']){put(season+'/'+suffix+query,{games:[],weeks:[]});put(season+'/'+suffix,{games:[],weeks:[]});}
 put(season+'/chat/badge'+query,{n:0,unread:0});put(season+'/chat/unread'+query,{n:0,unread:0});
 put(season+'/fill',{seasonId:ctx.seasonId,label:'Synthetic Survivor bench',artUrl:source.show.artUrl,words:{people:'Castaways',episode:'Episode',episodes:'Episodes'},status:'none',asking:false,due:false,away:false,step:null,steps:[],cast:{count:m.primary.state.castaways.length,faces:[]},episodes:[],message:null,needsLook:false,since:null,expectMs:null,phase:null,resultsLeft:0,now:null,v:'none'});
 const format=S.formatOf(m.primary.state),book=rulebookFor(m.formatId,format.data);
 // Current creation UI, with this exact game supplied through its normal made-for-game input.
 const recordedStart=Object.entries(base.responses).find(([k])=>k.includes('/start?')&&k.includes('wizard=1'))?.[1]?.body;
 const wizardSpec=clone(m.primary.spec);wizardSpec.span={from:1,to:null};if(wizardSpec.score.by==='moments')wizardSpec.score.points={...m.primary.state.settings.eventPoints};
 const start={...(recordedStart?clone(recordedStart):{}),seasonId:ctx.seasonId,label:'Survivor 49',show:'Survivor',artUrl:source.show.artUrl,kind:'competition',blocked:null,sport:null,again:null,nextSeason:null,onAir:null,late:false,ownPace:true,pace:{here:1,top:1,aired:0},from:1,nextEpisode:1,part:{singular:'episode',plural:'episodes'},starts:Array.from({length:13},(_,i)=>({number:i+1,title:null,airAt:new Date(m.now+(i+1)*86400000).toISOString()})),phases:[],questions:[],watchers:m.people.map(p=>p.name),couch:{id:ctx.couchId,name:m.couchName,members:m.couchSize},games:[{key:'weeklyLineup',name:g.gameName,fits:true}],wizard:{page:{ctx:clone(m.primary.context),pack:{show:'Survivor',page:'Survivor 49',kind:'show',status:'airing',today:new Date(m.now).toISOString().slice(0,10),episodes:{aired:0,total:13,next:{number:1}},stillIn:m.stillIn,couch:{people:m.couchSize},phases:[]}},last:13,asksLeft:0,tells:0,made:[{name:g.name,hook:m.madeHook,length:'season',spec:wizardSpec}]}};
 start.spans=[{to:null,kind:'rest',label:'The season',line:'From episode 1'}];start.ends=start.starts.slice(1);
 put(season+'/start'+query,start);put(season+'/start'+query+'&wizard=1',start);
 put(season+'/how-it-works'+query,{how:howItWorks(book.blocks,{compiled:format.data,points:m.primary.state.settings.eventPoints,ownership:'shared',seen:m.seen,episodeCount:episodes.length,castCount:m.primary.state.castaways.length}),cast:g.cast.map(c=>({name:c.name,photo:c.photo,colour:null})),check:null});
 put(season+'/practice',{seasonId:ctx.seasonId,label:'Synthetic bench',blocked:'Practice games are outside this lineup scenario',leagueId:null,gameName:null,level:null,game:null,drafting:false});
 put(season+'/polls'+query,{polls:[],start:null});
 put(season+'/trivia'+query,{seasonId:ctx.seasonId,title:'No trivia in this lineup fixture',line:'Lineup pilot',questions:[],couch:[],mine:null,scope:'couch'});
 for(const e of m.episodes){
  put(season+'/chat/unread'+query+'&reveal='+e.number,{unread:0,revealed:[]});
  if(e.number<=m.seen)put(season+'/gifs/'+e.number+query,{seasonId:ctx.seasonId,episode:e.number,mine:null,people:[],of:m.couchSize});
  put(season+'/calls/'+e.number+query,{seasonId:ctx.seasonId,episode:e.number,airAt:e.airsAt,status:'off',catchUp:null,questions:[],mine:null,people:[],playing:0});
  put(season+'/bingo/'+e.number+query,{seasonId:ctx.seasonId,episode:e.number,airAt:e.airsAt,status:'off',card:null,together:[],people:[],playing:0,lines:{ticked:0,called:0,standing:0,waiting:0,off:0},mine:null,alone:m.couchSize===1});
 }
 put(season+'/recaps',{recaps:[]});
 return {schemaVersion:1,dataset:m.datasetId,capturedAt:new Date(m.now).toISOString(),context:ctx,provenance:m.provenance,responses};
}
/** Own-pace pace line the games route adds beside a production gameView (as the pilot always has). */
function paceOf(view,people,marks,viewerId,last,catchingUp){return {others:people.filter(p=>p.id!==viewerId).map(p=>({name:p.name,week:catchingUp(p)?marks[p.id]+1:null})),last,team:null,draft:null,gather:null};}
module.exports={responses,paceOf,clone};
