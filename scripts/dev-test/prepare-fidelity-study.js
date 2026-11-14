// Reorganize only blind.js's kept zt-pt- fixture games for a visual review; no production rows.
// First run blind.js survivor 49 --only=1,41,42,43,44,57 --through=6 --keep.
//   node scripts/dev-test/prepare-fidelity-study.js
// Cleanup after the review: node scripts/dev-test/blind.js down
require('dotenv').config({path:'.env.local',quiet:true});
const fs=require('fs'),path=require('path'),{Pool}=require('pg');
const root=path.resolve('captures/fidelity-2026-11-10'),url=new URL(process.env.AUTH_DATABASE_URL);
if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw Error('Local database only');
(async()=>{const p=new Pool({connectionString:url.toString()});try{
 const games=(await p.query(`SELECT l.id,l.name,l.couch_id,l.state,s.id AS show_id,ss.id season_id FROM leagues l JOIN shows s ON s.slug=l.state->'settings'->>'showId' JOIN show_seasons ss ON ss.show_id=s.id AND ss.season_number=(l.state->'settings'->>'wikiSeason')::int WHERE l.slug LIKE 'zt-pt-%' AND s.slug='zt-pt-survivor' ORDER BY l.created_at`)).rows;
 if(games.length!==6)throw Error('Expected six kept replay games');
 const aliases={tinkerer:'Alex',fan:'Riley',forgetter:'Sam','drive-by':'Jordan',driveby:'Jordan'};
 const ids=games.map(g=>g.id),couchId=games[0].couch_id,seasonId=games[0].season_id;
 const previousPath=path.join(root,'fixture.json');
 const previous=fs.existsSync(previousPath)?JSON.parse(fs.readFileSync(previousPath,'utf8')):null;
 const reusable=previous?.seasonId===seasonId?previous:null;
 const firstAir=games[0].state.episodes?.find(e=>e.number===1)?.airsAt;
 const shiftDays=reusable?.clockAligned||!firstAir?0:Math.max(0,(Math.floor((Date.parse(firstAir)-Date.now())/(7*86400000))+6)*7);
 await p.query('BEGIN');
 await p.query('UPDATE leagues SET couch_id=$1 WHERE id=ANY($2::uuid[])',[couchId,ids]);
 await p.query('UPDATE couches SET name=$1 WHERE id=$2',['Friday Crew',couchId]);
 if(shiftDays){await p.query('UPDATE show_seasons SET premiere_date=premiere_date-$1::int WHERE id=$2',[shiftDays,seasonId]);await p.query('UPDATE season_episodes SET air_at=air_at-make_interval(days=>$1::int) WHERE season_id=$2',[shiftDays,seasonId]);}
 for(const g of games){for(const player of g.state.players||[]){const role=Object.keys(aliases).find(k=>String(player.name).toLowerCase().includes(k));if(role)player.name=aliases[role];}if(shiftDays)for(const ep of g.state.episodes||[])if(ep.airsAt)ep.airsAt=new Date(Date.parse(ep.airsAt)-shiftDays*86400000).toISOString();g.name=g.name.replace(/^Lab\s*[\u00b7:]\s*/, '');if(g.name==='a game')g.name='Who goes home?';await p.query('UPDATE leagues SET name=$1,state=$2 WHERE id=$3',[g.name,JSON.stringify(g.state),g.id]);}
 for(const [role,name]of Object.entries(aliases))await p.query('UPDATE "user" SET name=$1,"displayUsername"=$1 WHERE username=$2',[name,'zt_pt_'+role.replace('-','_')]);
 await p.query("UPDATE shows SET art_off=false,art_url='/__study/assets/survivor-49.jpg' WHERE id=$1 AND slug='zt-pt-survivor'",[games[0].show_id]);
 await p.query('COMMIT');
 const cast=(await p.query('SELECT name,photo_url,tribe_name FROM season_cast WHERE season_id=$1 ORDER BY sort_order',[seasonId])).rows;
 const original=(await p.query(`SELECT ss.art_url FROM show_seasons ss JOIN shows s ON s.id=ss.show_id WHERE s.slug='survivor' AND ss.season_number=49`)).rows[0];
 const fx={...reusable,seasonId,couchId,user:'zt_pt_tinkerer',clockAligned:true,clockShiftDays:reusable?.clockShiftDays??shiftDays,games:games.map(g=>({id:g.id,name:g.name,type:g.state.settings?.leagueTypeId,source:'recorded season results; deterministic fixture decisions'})),art:original?.art_url,cast:cast.map(c=>({...c,localPhoto:reusable?.cast?.find(old=>old.name===c.name)?.localPhoto}))};
 fs.mkdirSync(root,{recursive:true});fs.writeFileSync(path.join(root,'fixture.json'),JSON.stringify(fx,null,2));console.log(JSON.stringify({seasonId,games:fx.games.length,cast:cast.length,source:'local recorded Survivor 49 replay'}));
 for(const name of ['island-night','football-night','event-night']){const jpg=path.join(root,'assets',name+'.jpg'),png=path.join(root,'assets',name+'.png');if(fs.existsSync(jpg)&&fs.readFileSync(jpg).subarray(0,4).equals(Buffer.from([137,80,78,71])))fs.renameSync(jpg,png);}
}catch(e){await p.query('ROLLBACK').catch(()=>{});throw e;}finally{await p.end();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
