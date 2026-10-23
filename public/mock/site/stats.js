// ================= cast stats, no game needed =================
// Decided 2026-10-23: people who aren't in a game still want to dig into the cast ("who votes with the majority
// most", "whose name never gets written down"). Competition shows get a Stats card on Tonight and, when you're
// not in a game, a Stats tab in place of Standings. Every number comes from the episode research we already
// collect, counted only up to the episode you're on. Scripted shows get Previously on and Who's who instead.
const STATS={
  surv:{season:()=>S51,term:'tribals',cats:[['votedWithMajority','Voted with the majority','times'],['zeroVotesSafe','Never written down','tribals, no votes against'],[['survivedVotes','Voted Out'],'Most votes against','tribals with votes against them'],['survivedVotes','Survived votes against','times'],
    ['tribeImmunity','Tribe immunity wins','wins'],['rewardWin','Reward wins','wins'],['idolFound','Idols found','found'],['votedAgainstMajority','Voted against the majority','times'],['learnedOfAdvantage','Learned of an advantage','times']]},
  trt:{season:()=>TRT,term:'Round Tables',cats:[['zeroVotes','Never voted for at the Round Table','Round Tables'],['shieldWon','Shields won','shields'],['votedOutFaithful','Voted out a Faithful','times'],['survivedRoundTable','Survived votes at the Round Table','times']]}};
const hasStats=s=>!!STATS[s.id];
// "1 time", "2 times": a unit's first word loses its s for one
const unit=(u,n)=>n===1?u.replace(/^(\w+?)s\b/,'$1').replace(/^Round Tables/,'Round Table'):u;
// a category counts one event, or several (Most votes against = votes survived + being voted out)
function statBoard(s,key){const src=STATS[s.id].season(),w=whereOf(s,'alex'),keys=[].concat(key);
  return src.cast.map(c=>({c,n:(c.why||[]).filter(x=>x[0]<=w&&keys.includes(x[1])).length,out:c.exitEp&&c.exitEp<=w?c.exitEp:0})).filter(r=>r.n>0).sort((a,b)=>b.n-a.n||(!!a.out-!!b.out))}
const statLeader=(s,key)=>statBoard(s,key)[0];
function statRows(s,key,max){return statBoard(s,key).slice(0,max).map((r,i)=>`<div class="st-row${r.out?' out':''}"><span class="rk num">${i+1}</span><img src="${ph(r.c)}" alt=""><span class="nm">${first(r.c.name)}${r.out?`<small>Out · Ep ${r.out}</small>`:''}</span><b class="num">${r.n}</b></div>`).join('')||'<p class="muted small">Nothing yet</p>'}
// one card for Tonight: the stat of the week, two short boards, then everything
function statsCard(s){if(!hasStats(s))return '';const S=STATS[s.id],w=whereOf(s,'alex'),[k0,t0,u0]=S.cats[0],lead=statLeader(s,k0),[k1,t1]=S.cats[1],[k2,t2]=S.cats[2];
  return `<section class="blk"><div class="sh"><h2 class="cap">Stats</h2><span class="aside">Up to Episode ${w} · no game needed</span></div>
    ${lead?`<button class="st-week" data-stats="${s.id}" data-cat="0"><img src="${ph(lead.c)}" alt=""><span class="tx"><span class="tg cap">Stat of the week</span><b class="cap">${t0}</b><small>${first(lead.c.name)} · ${lead.n} ${unit(u0,lead.n)}</small></span></button>`:''}
    <div class="st-two"><div><span class="cap">${t1}</span>${statRows(s,k1,3)}</div><div><span class="cap">${t2}</span>${statRows(s,k2,3)}</div></div>
    <button class="st-all" data-stats="${s.id}">All ${S.cats.length} stats ${svg('chev')}</button></section>`}
// focus: a category index to lead with, sorted by it, the whole cast; the rest follow, top five each
function statsBody(s,focus){const S=STATS[s.id],w=whereOf(s,'alex'),order=S.cats.map((c,i)=>i).sort((a,b)=>(b===focus)-(a===focus));
  return `<p class="muted small" style="line-height:1.45;margin-bottom:6px">Counted from each episode's results, up to Episode ${w}. Nothing past where you are.</p>${order.map(i=>{const [k,t,u]=S.cats[i],f=i===focus;return `<div class="st-cat${f?' focus':''}" id="stc${i}"><div class="sh" style="padding:0;margin:16px 0 6px"><h2 class="cap" style="font-size:${f?26:20}px">${t}</h2><span class="aside">${f?'Sorted by this · everyone':u}</span></div>${statRows(s,k,f?99:5)}</div>`}).join('')}`}
function statsPage(s,focus){openPage(`${s.short} stats`,`<div class="st-page">${statsBody(s,focus)}</div>`)}

// Tonight: the card sits right after Watch along (shows without a game) or at the end (shows with games)
const anchorWho='<section class="blk"><div class="sh"><h2 class="cap">Who\'s watching</h2>';
const wTonightStats=wTonight;
wTonight=function(s){const h=wTonightStats(s),add=(hasStats(s)?statsCard(s):'')+(s.series&&follows(s)&&whereOf(s,'alex')>0?recapCard(s):'');return add&&h.includes(anchorWho)?h.replace(anchorWho,add+anchorWho):h};
const tabTonightStats=tabTonight;
tabTonight=function(s){return tabTonightStats(s)+(N!==1&&hasStats(s)?statsCard(s):'')};
// the Stats tab, in place of Standings when you're not in a game
const wStandingsStats=wStandings;
wStandings=function(s){if(!hasStats(s))return wStandingsStats(s);return `<section class="blk"><div class="sh"><h2 class="cap">Stats</h2><span class="aside">Up to Episode ${whereOf(s,'alex')}</span></div>${statsBody(s)}</section>
  <div class="playplate"><span class="tg cap">Play it</span><h4 class="cap">${s.short} with your couch</h4><p>Survival Pool starts from the next episode, no draft. Or draft a team from this cast.</p><button class="btn" data-wjob="newgame">Start a game</button></div>`};
const showRouteStats=showRoute;
showRoute=function(sid,tab){showRouteStats(sid,tab);const s=SHOWS.find(x=>x.id===sid);if(!s||s.kinds||!hasStats(s))return;const a=app.querySelector('.tabbar a[href$="/standings"]');if(a)a.innerHTML=`${svg('poll')}Stats`};
const wireWStats=wireW;
wireW=function(s){wireWStats(s);wireStats()};
const wireShowStats=wireShow;
wireShow=function(s){wireShowStats(s);wireStats()};
function wireStats(){app.querySelectorAll('[data-stats]').forEach(b=>b.onclick=()=>statsPage(SHOWS.find(x=>x.id===b.dataset.stats),b.dataset.cat==null?undefined:+b.dataset.cat));app.querySelectorAll('[data-recap]').forEach(b=>b.onclick=()=>recapSheet(SHOWS.find(x=>x.id===b.dataset.recap)))}

// ---------- Previously on: a spoiler-safe recap up to your episode ----------
// Survivor and Traitors are written from the results we hold (who left, how); other shows' recaps come from the
// AI research (mock lines here).
function recapLines(s){const w=whereOf(s,'alex');
  if(STATS[s.id]){const src=STATS[s.id].season();return Array.from({length:w},(_,k)=>k+1).map(e=>{const out=src.cast.filter(c=>c.exitEp===e);return [e,out.length?out.map(c=>`${first(c.name)} ${(c.exitMethod||'left').toLowerCase()}`).join(', '):'Nobody went home']})}
  return Array.from({length:Math.min(w,4)},(_,k)=>w-Math.min(w,4)+k+1).map(e=>[e,`What happened, in two lines (AI recap from the episode guide; mock)`])}
function recapCard(s){const L=recapLines(s),last=L[L.length-1];if(!last)return '';
  return `<button class="rc-card" data-recap="${s.id}"><span class="tg cap">Previously on</span><b class="cap">${s.short}</b><small>Up to Episode ${whereOf(s,'alex')} · ${last[1]}</small>${svg('chev')}</button>`}
function recapSheet(s){const L=recapLines(s);openSheet(`Previously on ${s.short}`,`Up to Episode ${whereOf(s,'alex')} · nothing past it`,`${L.map(([e,t])=>`<div class="rc-row"><span class="n num">${e}</span><span>${t}</span></div>`).join('')}`)}
// scripted shows: Cast becomes Who's who, as of your episode
const wCastStats=wCast;
wCast=function(s){const h=wCastStats(s);return s.series?h.replace(/<h2 class="cap">(Cast|Cast &amp; crew|Cast & crew)<\/h2><span class="aside">From the TV listings<\/span>/,`<h2 class="cap">Who's who</h2><span class="aside">As of Episode ${Math.max(1,whereOf(s,'alex'))}</span>`):h};
