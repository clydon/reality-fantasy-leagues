// Cache public season media and a dated NFL provider snapshot for the local study.
//   node scripts/dev-test/fetch-fidelity-media.js
// No account data or credentials are sent. Never labels a recorded game as live.
const fs=require('fs'),path=require('path');
const root=path.resolve('captures/fidelity-2026-11-10'),assets=path.join(root,'assets'),fx=JSON.parse(fs.readFileSync(path.join(root,'fixture.json'),'utf8'));
fs.mkdirSync(assets,{recursive:true});
const sources=[];
async function get(url){const r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('HTTP '+r.status+' '+new URL(url).hostname);return r;}
async function cache(url,file){if(!url)return null;const dest=path.join(assets,file);if(!fs.existsSync(dest)){if(url.startsWith('/'))fs.copyFileSync(path.join(process.cwd(),'public',url),dest);else fs.writeFileSync(dest,Buffer.from(await(await get(url)).arrayBuffer()));}sources.push({file,url});return '/__study/assets/'+file;}
(async()=>{fx.localArt=await cache(fx.art,'survivor-49.jpg');for(let i=0;i<fx.cast.length;i+=4)await Promise.all(fx.cast.slice(i,i+4).map(async(c,j)=>{try{c.localPhoto=await cache(c.photo_url,'cast-'+(i+j)+'.jpg');}catch(e){c.mediaError=e.message;}}));
const scoreboardUrl='https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=20250209';
const board=await(await get(scoreboardUrl)).json(),event=board.events?.find(e=>e.competitions?.[0]?.competitors?.length===2);
if(!event)throw Error('Recorded NFL event not found');
const summaryUrl='https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event='+event.id;
const summary=await(await get(summaryUrl)).json(),competition=event.competitions[0];
const teams=await Promise.all(competition.competitors.map(async(c)=>({id:c.team.id,name:c.team.displayName,short:c.team.abbreviation,color:c.team.color,score:Number(c.score),homeAway:c.homeAway,logo:await cache(c.team.logo||c.team.logos?.[0]?.href,'nfl-'+c.team.id+'.png')})));
const nfl={label:event.name,date:event.date,id:event.id,recorded:true,source:summaryUrl,sourcePage:event.links?.[0]?.href,teams,teamStats:summary.boxscore?.teams||[],players:summary.boxscore?.players||[],venue:competition.venue?.fullName};
fs.writeFileSync(path.join(root,'nfl.json'),JSON.stringify(nfl,null,2));fs.writeFileSync(path.join(root,'fixture.json'),JSON.stringify(fx,null,2));fs.writeFileSync(path.join(root,'media-sources.json'),JSON.stringify({retrievedAt:new Date().toISOString(),sources,scoreboardUrl,summaryUrl},null,2));console.log(JSON.stringify({castImages:fx.cast.filter(c=>c.localPhoto).length,seasonArt:!!fx.localArt,nfl:nfl.label,date:nfl.date,provider:'ESPN recorded game'}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
