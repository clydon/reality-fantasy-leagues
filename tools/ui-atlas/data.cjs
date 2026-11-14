const fs=require('fs'),path=require('path');
const clone=v=>structuredClone(v);
function keyOf(url){const u=new URL(url,'http://atlas.local');u.searchParams.delete('_rsc');u.searchParams.delete('tz');u.searchParams.sort();return u.pathname+(u.searchParams.size?'?'+u.searchParams:'');}
function assertLocal(url){const u=new URL(url);if(!['localhost','127.0.0.1','[::1]'].includes(u.hostname))throw Error('Atlas runtime and fixture login require a loopback app URL');return u;}
// Fixture accounts only: zt_ usernames (dev-test fixtures), or a gameplay-bench case's people, <name>_ztgb<case key><n>,
// which keep a person's own initial on faces. Both are made by local fixtures; sign-in is loopback-only (assertLocal).
const isFixtureUser=u=>/^zt_/.test(u||'')||/^[a-z0-9]{1,12}_ztgb[0-9a-f]{8}\d{1,2}$/.test(u||'');
function validateBundle(b){if(b.schemaVersion!==1||!b.context||!b.responses||typeof b.responses!=='object')throw Error('Expected an atlas bundle: schemaVersion, context, responses');if(!isFixtureUser(b.context.username))throw Error('Only explicit zt_ fixture accounts can be used for replay');for(const [k,v]of Object.entries(b.responses)){if(!k.startsWith('/api/')||typeof v.status!=='number'||!('body'in v))throw Error('Invalid recorded response '+k);if(/session_token|AIza[\w-]{20,}|"(?:password|accessToken|refreshToken|apiKey|secret)"\s*:\s*"[^"\s][^"]*"/i.test(JSON.stringify(v.body)))throw Error('Credential-shaped data in '+k);}return b;}
function lookup(bundle,url){const key=keyOf(url);if(bundle.responses[key])return bundle.responses[key];const pathname=new URL(url,'http://atlas.local').pathname,entries=Object.entries(bundle.responses).filter(([k])=>k.split('?')[0]===pathname);if(entries.length===1&&(/\/(space|games|episodes|stats|watch|hub|badge|notifications|profile)$/.test(pathname)))return entries[0][1];return null;}
function rewriteMedia(root,out,bundle,fixture){const replacements=new Map();for(const c of fixture?.cast||[])if(c.localPhoto&&c.photo_url){const name=path.basename(c.localPhoto);const src=path.join(root,'captures/fidelity-2026-11-10/assets',name);if(fs.existsSync(src)){fs.mkdirSync(path.join(out,'media'),{recursive:true});fs.copyFileSync(src,path.join(out,'media',name));replacements.set(c.photo_url,'/__atlas/media/'+name);replacements.set(c.localPhoto,'/__atlas/media/'+name);}}
 for(const name of ['survivor-49.jpg','archivo.woff2']){const src=path.join(root,'captures/fidelity-2026-11-10/assets',name);if(fs.existsSync(src)){fs.mkdirSync(path.join(out,'media'),{recursive:true});fs.copyFileSync(src,path.join(out,'media',name));replacements.set('/__study/assets/'+name,'/__atlas/media/'+name);}}
 let text=JSON.stringify(bundle);for(const [from,to]of replacements)text=text.split(from).join(to);return JSON.parse(text);
}
async function signIn(app,username,password){assertLocal(app);if(!isFixtureUser(username))throw Error('Fixture login must be a zt_ (or bench _ztgb) fixture account');const r=await fetch(app+'/api/auth/sign-in/username',{method:'POST',headers:{'content-type':'application/json',origin:app},body:JSON.stringify({username,password})});if(!r.ok)throw Error('Fixture sign-in failed ('+r.status+'). Prepare the registered fixture or capture another zt_ fixture.');return r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ')+'; gys_tour=off';}
async function capture({root,out,app,fixture,dataset='recorded',password='zt-pass-12345'}){
 assertLocal(app);const username=fixture.user||fixture.username;if(!username)throw Error('Fixture descriptor needs user/username');const cookie=await signIn(app,username,password),context={username,seasonId:fixture.seasonId,couchId:fixture.couchId,gameId:fixture.games?.find(g=>g.type==='active-roster')?.id||fixture.games?.[0]?.id||Object.values(fixture.leagues||{})[0]};
 const b={schemaVersion:1,dataset,capturedAt:new Date().toISOString(),provenance:'Captured GET projections from local fixture account; no browser cookies or credentials stored.',context,responses:{}};
 const urls=['/api/me/home','/api/me/profile','/api/me/notifications','/api/me/preferences','/api/catalog'];
 if(context.seasonId){for(const suffix of ['space','games','episodes','stats','watch','chat/badge','backstage/rules','backstage/drafts','notifications','start'])urls.push('/api/seasons/'+context.seasonId+'/'+suffix+'?couch='+context.couchId);urls.push('/api/seasons/'+context.seasonId+'/recaps');}
 if(context.couchId)for(const suffix of ['hub','games','invite'])urls.push('/api/couches/'+context.couchId+'/'+suffix);
 for(const url of urls){const r=await fetch(app+url,{headers:{cookie},redirect:'manual'});if(!r.headers.get('content-type')?.includes('application/json'))continue;const body=await r.json();b.responses[keyOf(url)]={status:r.status,body};}
 const home=b.responses['/api/me/home']?.body;if(!home?.user?.id)throw Error('Home capture did not contain fixture data');context.userId=home.user.id;
 const saved=rewriteMedia(root,out,b,fixture);validateBundle(saved);fs.mkdirSync(path.join(out,'datasets'),{recursive:true});fs.writeFileSync(path.join(out,'datasets',dataset+'.json'),JSON.stringify(saved,null,2));return {dataset,reads:Object.keys(saved.responses).length,context};
}
function transform(body,url,recipe,bundle){
 const episodeProjection=Object.entries(bundle.responses).find(([k])=>/\/episodes(?:\?|$)/.test(k))?.[1]?.body||(body?.episodes?body:null);
 const latest=episodeProjection?Math.max(0,...(episodeProjection.episodes||[]).filter(e=>(!e.status||['seen','hidden','unseen'].includes(e.status))&&e.stage!=='waiting').map(e=>e.number)):Math.max(0,body?.through||body?.seenThrough||0,...(body?.shows||[]).map(s=>s.seenThrough||0),...(body?.cast||[]).flatMap(c=>(c.events||[]).map(e=>e[0])));
 const count=Object.entries(bundle.responses).find(([k])=>/\/space(?:\?|$)/.test(k))?.[1]?.body?.episodeCount||latest;
 const v=clone(body),pathname=new URL(url,'http://atlas.local').pathname,p=recipe.profile,none=['no-couch','empty-couch','one-show','watcher','caught-up'].includes(p),empty=['no-couch','empty-couch'].includes(p),seen=p==='early'?Math.max(0,latest-1):['watcher','catchup','reveal-ready','solo'].includes(p)?Math.min(3,Math.max(0,latest-1)):null,pace=['catchup','reveal-ready','solo'].includes(p);
 const now=Date.parse(bundle.capturedAt||new Date().toISOString());
 function lifecycle(s){if(!s)return;if(p==='locked'&&s.upNext){s.upNext.live=true;s.upNext.airAt=new Date(now-1800000).toISOString();}if(p==='waiting'){s.upNext=null;s.latestAired=latest+1;}if(p==='finished'){s.upNext=null;s.latestAired=latest;s.episodeCount=latest;s.status='completed';s.seenThrough=latest;}}
 if(pathname==='/api/me/home'){
  for(const s of v.shows||[])lifecycle(s);if(['saved','locked','waiting','finished'].includes(p))v.moves=[];
  if(empty){v.shows=[];v.couchShows=[];v.moves=[];v.unscheduled=[];v.plans=[];v.backstage=[];if(p==='no-couch')v.couches=[];else v.couches=(v.couches||[]).slice(0,1).map(c=>({...c,name:'Empty review couch',members:c.members.filter(m=>m.userId===v.user.id),games:[],seasons:[]}));}
  if(none&&!empty){v.moves=[];v.backstage=[];v.unscheduled=[];for(const s of v.shows||[]){s.games=[];s.following=true;s.results=null;s.progress=[];if(seen!==null)s.seenThrough=seen;}for(const c of v.couches||[])c.games=[];}
  if(p==='multiple-shows'&&v.shows?.length===1){const s=clone(v.shows[0]);s.seasonId='00000000-0000-4000-8000-000000000002';s.seasonName='Second review show';s.show={...s.show,name:'Second review show',slug:'zt-atlas-second',artUrl:'/mock/showcase/art/traitors.jpg'};s.games=[];v.shows.push(s);}
  if(p==='solo')v.couches=[];
  if(pace){for(const s of v.shows||[]){s.seenThrough=seen;s.games=(s.games||[]).filter(g=>['pickem','active-roster'].includes(g.gameType)).map(g=>({...g,ownPace:true,solo:p==='solo'?'private':null}));}v.moves=[];}
 }
 if(pathname.endsWith('/space')){
  lifecycle(v);lifecycle(v.schedule);if(p==='finished'){v.you.seenThrough=latest;v.episodeCount=latest;}
  if(none){v.games=[];v.you.plays=false;v.you.following=true;}
  if(seen!==null){v.you.seenThrough=seen;for(const person of v.people||[])if(person.userId!==bundle.context.userId)person.seen=person.name.includes('forget')?2:6;}
  if(pace)v.games=(v.games||[]).filter(g=>['pickem','active-roster'].includes(g.gameType)).map(g=>({...g,ownPace:true,solo:p==='solo'?'private':null}));
  if(p==='solo'){v.couchId=null;v.people=[];}
 }
 if(pathname.endsWith('/games')&&Array.isArray(v.games)&&'seenThrough'in v){
  if(none)v.games=[];
  if(p==='locked')for(const g of v.games){if(g.pick)g.pick.open=false;if(g.lineup)g.lineup.locked=true;}
  if(p==='saved')for(const g of v.games){if(g.pick)g.pick.pick=g.pick.available[0]||null;if(g.lineup)g.lineup.set=true;if(g.sheet)g.sheet.answered=g.sheet.of;}
  if(p==='finished')for(const g of v.games){g.over=true;g.through=latest;g.to=latest;g.pick=null;g.lineup=null;g.catchUp=null;g.pace=null;}
  if(p==='early'){v.seenThrough=seen;for(const g of v.games){g.through=seen;g.table=g.table.map(r=>({...r,weeks:r.weeks.filter(w=>w.episode<=seen),picks:r.picks.filter(p=>p.episode<=seen)}));g.you=g.table.find(r=>r.you)||null;g.plays=null;}}
  if(pace){v.seenThrough=seen;v.games=v.games.filter(g=>['pickem','active-roster'].includes(g.gameType));for(const g of v.games){g.ownPace=true;g.solo=p==='solo'?'private':null;g.through=seen;g.over=false;g.catchingUp=true;g.catchUp={week:seen+1,latest};g.pace={others:p==='solo'?[]:[{name:'Riley',week:7},{name:'Sam',week:3}],last:count,team:null,draft:null,gather:null};g.revealFirst=null;g.waiting=[];g.table=(p==='solo'?g.table.filter(r=>r.you):g.table).map(r=>({...r,weeks:r.weeks.filter(w=>w.episode<=seen),picks:r.picks.filter(p=>p.episode<=seen),week:null,total:r.weeks.filter(w=>w.episode<=seen).reduce((n,w)=>n+w.total,0),points:r.weeks.filter(w=>w.episode<=seen).reduce((n,w)=>n+w.total,0),rank:'1'}));g.you=g.table.find(r=>r.you)||null;if(g.pick){g.pick.episode=seen+1;g.pick.pick=null;g.pick.available=g.cast.filter(c=>c.out==null||c.out>seen).map(c=>c.id);g.pick.blocked=[];}if(g.lineup){g.lineup.episode=seen+1;g.lineup.set=false;}g.plays=null;g.predictions=[];}}
 }
 if(pathname.endsWith('/episodes')){
  if(p==='waiting'){v.reveal=null;v.final=null;v.waiting={episode:latest+1,airAt:new Date(now-3600000).toISOString()};}
  if(p==='finished'){v.episodes=v.episodes.filter(e=>e.number<=latest);v.toAir=null;v.reveal=null;v.waiting=null;v.final=null;}
  if(seen!==null){v.seenThrough=seen;for(const e of v.episodes||[])if(e.number>seen){e.out=[];e.happened=[];e.scorers=[];e.lines=[];e.gifs={n:0,mine:false,urls:[]};e.status=none?'unseen':'hidden';}v.reveal=none?null:{episode:seen+1,stage:'final',finalAt:null};v.final=null;}
  if(p==='early')v.reveal={episode:latest,stage:'early',finalAt:new Date(now+8*3600000).toISOString()};
  if(none)for(const e of v.episodes||[])e.lines=[];
 }
 if(pathname.endsWith('/stats')&&seen!==null){v.to=seen;v.through=seen;v.seenThrough=seen;v.featured=[];v.patterns=[];for(const c of v.cast||[]){c.events=c.events.filter(e=>e[0]<=seen);c.counts={};for(const e of c.events)c.counts[e[1]]=(c.counts[e[1]]||0)+e[3];c.perEp=c.perEp.slice(0,seen);c.points=c.events.reduce((n,e)=>n+e[2],0);if(c.out>seen){c.out=null;c.how=null;}}}
 if(empty&&['/api/me/solo','/api/me/trivia'].includes(pathname)){if(v.seasons)v.seasons=[];if(v.rounds)v.rounds=[];}
 if(pathname.endsWith('/hub')&&empty){for(const [k,x]of Object.entries(v))if(Array.isArray(x))v[k]=[];}
 if(p==='reveal-ready'&&pathname.endsWith('/games')&&Array.isArray(v.games)&&'seenThrough'in v)for(const g of v.games){const mine=g.table.find(r=>r.you);g.through=Math.max(0,seen-1);g.catchUp={week:seen,latest};g.table=g.table.map(r=>({...r,weeks:r.weeks.filter(w=>w.episode<seen),picks:r.picks.filter(x=>x.episode<seen)}));g.you=g.table.find(r=>r.you)||null;if(g.pick){g.pick.episode=seen;g.pick.pick=mine?.picks.find(x=>x.episode===seen)?.castawayId||null;}if(g.lineup){g.lineup.episode=seen;g.lineup.starters=mine?.weeks.find(w=>w.episode===seen)?.started?.map(x=>x.id)||[];g.lineup.set=g.lineup.starters.length===g.lineup.need;}}
 return v;
}
module.exports={keyOf,assertLocal,validateBundle,lookup,capture,signIn,transform,rewriteMedia};
