// ================= the hub, casual-first: every game in one row, and sections for people who never play =================
// Decided 2026-10-23 (the user): some people join a couch for the social side and never play a game. So:
//   - Commercial break holds every game: a Power rankings card, then season games (with your status), then the
//     episode games every show gets automatically each week, then "+ Start a game". Watch along isn't a game; it
//     lives on Up next and each show's Tonight.
//   - For everyone: Who's on now (live), Previously on (spoiler-safe recaps), Couch verdicts (this week's ratings)
//     and Couch superlatives (a few measurable accolades about the couch, shuffled).
//   - The trophy shelf only appears once a season has ended.
const placeOf=()=>{const pr=(N===4?PR4:PR12).slice().sort((a,b)=>(b[1]+b[2]+b[3])-(a[1]+a[2]+a[3]));const i=pr.findIndex(r=>r[0]==='alex');return {i:i+1,of:pr.length,gap:(pr[0][1]+pr[0][2]+pr[0][3])-(pr[i][1]+pr[i][2]+pr[i][3]),lead:pr[0][0]}};
const anyGames=()=>SHOWS.some(s=>s.kinds)||Object.keys(W.games).length;

// ---------- Commercial break: every game ----------
function cbCards(){const cards=[],p=placeOf(),idx=N===4?0:1;
  cards.push(anyGames()?`<button class="cb-card rank" data-cb="rank"><span class="cb-top"><span class="cb-k cap">Power rankings</span></span><b class="num">${ordinal(p.i)}</b><span class="cb-t">of ${p.of} this year</span><small>${p.i===1?'You lead the couch':`${p.gap} back of ${p.lead}`}</small></button>`
    :`<div class="cb-card rank empty"><span class="cb-top"><span class="cb-k cap">Power rankings</span></span><span class="cb-t">Start with your first game</span><small>Every game on the couch counts toward one table for the year.</small></div>`);
  // season games: yours first, the ones that need you before the rest
  const KIND_OF={'Weekly Lineup':'lineup','Outlast':'outlast','Survival Pool':'pool'};
  SHOWS.filter(s=>s.kinds&&s.games).forEach(s=>s.games.forEach((g,gi)=>{const kind=KIND_OF[g[0]]||'outlast',due=s.id==='surv'&&g[0]==='Weekly Lineup'&&!state.lineup;
    cards.push({due,h:`<button class="cb-card game${due?' due':''}" data-cb="league" data-sid="${s.id}" data-gi="${gi}"><span class="cb-art"><img src="${ART(s.art)}" alt="" style="object-position:${s.pos}"></span><span class="cb-top"><span class="cb-k cap" style="color:${(GAMES[kind]||{}).col||'var(--chyron)'}">Season game</span><span class="cb-pl num">${g[2][idx]}</span></span><span class="cb-t">${g[0]}</span><small>${s.short} · ${due?'lineup due Wed':'playing'}</small></button>`})}));
  Object.entries(W.games).forEach(([sid,g])=>{const s=SHOWS.find(x=>x.id===sid);if(!s)return;cards.push({due:true,h:`<button class="cb-card game due" data-cb="show" data-sid="${sid}"><span class="cb-art"><img src="${ART(s.art)}" alt="" style="object-position:${s.pos}"></span><span class="cb-top"><span class="cb-k cap" style="color:${GAMES[g.g].col}">Season game · new</span></span><span class="cb-t">${GAMES[g.g].name}</span><small>${s.short} · make your first pick</small></button>`})});
  // episode games: every show on the couch with an episode this week gets bingo and a "who goes home?" poll
  SHOWS.filter(s=>!s.binge&&!s.others&&follows(s)).slice(0,4).forEach(s=>{const t=nextAir(s.air),cast=!s.series;
    cards.push({due:false,h:`<button class="cb-card ep" data-cb="${s.id==='surv'?'bingo':'soon'}" data-sid="${s.id}"><span class="cb-art"><img src="${ART(s.art)}" alt="" style="object-position:${s.pos}"></span><span class="cb-top"><span class="cb-k cap">Episode game</span>${svg('bingo')}</span><span class="cb-t">Episode ${s.ep} bingo</span><small>${s.short} · opens ${DAY[t.getDay()]} ${clock(t)}</small></button>`});
    if(cast&&s.id!=='surv')return;
    cards.push({due:false,h:`<button class="cb-card ep" data-cb="${s.id==='trt'?'poll':'soon'}" data-sid="${s.id}"><span class="cb-art"><img src="${ART(s.art)}" alt="" style="object-position:${s.pos}"></span><span class="cb-top"><span class="cb-k cap">Episode game</span>${svg('poll')}</span><span class="cb-t">${s.series?'Call it':'Who goes home?'}</span><small>${s.short} · closes at airtime</small></button>`})});
  if(SHOWS.some(s=>s.id==='trt'))cards.push({due:false,h:`<button class="cb-card ep" data-cb="poll"><span class="cb-art"><img src="${ART('traitors')}" alt="" style="object-position:74% 35%"></span><span class="cb-top"><span class="cb-k cap">Started by riley</span>${svg('poll')}</span><span class="cb-t">Banishment poll</span><small>Traitors 5 · 10 seconds</small></button>`});
  if(SHOWS.some(s=>s.id==='surv'))cards.push({due:false,h:`<button class="cb-card ep" data-cb="trivia"><span class="cb-art"><img src="${ART('survivor')}" alt="" style="object-position:20% 50%"></span><span class="cb-top"><span class="cb-k cap">Trivia</span>${svg('quiz')}</span><span class="cb-t">Survivor 49 trivia</span><small>3 questions · riley got 2</small></button>`});
  const [rank,...rest]=cards;
  return rank+rest.sort((a,b)=>b.due-a.due).map(c=>c.h).join('')+`<button class="cb-card add" data-cb="start">${svg('plus')}<span class="cb-t">Start a game</span><small>A season game, bingo, a poll or trivia</small></button>`}
function cbHTML(){return `<section class="sec"><div class="cb-head"><span class="bars" aria-hidden="true">${['#f4f2f8','#ffc531','#35b5a5','#a76bb0','#f2545b','#5089c9'].map(c=>`<i style="background:${c}"></i>`).join('')}</span><h2 class="cap">Commercial break</h2></div>
  <p class="cb-sub">Every game on the couch · join any, or none</p><div class="minis cb-row" id="cbRow">${cbCards()}</div></section>`}
function startGamePicker(){const L=SHOWS.filter(s=>follows(s)&&!s.binge);
  openSheet('Start a game','Pick the show',L.map(s=>`<button class="row" data-pick="${s.id}"><span class="ic"><img src="${ART(s.art)}" alt="" style="object-position:${s.pos}"></span><span class="tx"><b>${s.name}</b><small>${s.season}${s.kinds?` · ${s.kinds.length} game${s.kinds.length>1?'s':''} already`:''}</small></span>${svg('chev')}</button>`).join(''),
    b=>b.querySelectorAll('[data-pick]').forEach(x=>x.onclick=()=>{closeSheet();setTimeout(()=>newGameSheet(SHOWS.find(s=>s.id===x.dataset.pick)),250)}))}

// ---------- for everyone: who's on now, previously on, couch verdicts, superlatives ----------
function nowHTML(){const L=Object.entries(NOW).map(([sid,n])=>({s:SHOWS.find(x=>x.id===sid),n})).filter(x=>x.s&&x.n!=='alex');if(!L.length)return '';const {s,n}=L[0];
  return `<button class="hn-now" data-now="${s.id}"><span class="live"><i></i>On now</span>${av(n,26)}<span class="tx"><b>${n} is watching ${s.name}</b><small>Episode ${Math.min(whereOf(s,n)+1,s.ep)}${L.length>1?` · and ${L.length-1} more`:''}</small></span><span class="go">Join ${svg('chev')}</span></button>`}
function recapShelfHTML(){const L=SHOWS.filter(s=>follows(s)&&whereOf(s,'alex')>0&&!(s.dropAt&&s.dropAt>Date.now()));if(!L.length)return '';
  return `<section class="sec"><div class="sh"><h2 class="cap">Previously on</h2><span class="aside">Up to where you are</span></div><div class="rc-shelf" id="rcShelf">${L.map(s=>{const lines=recapLines(s),last=lines[lines.length-1];
    return `<button class="rc-tile" data-recap="${s.id}"><img src="${ART(s.art)}" alt="" style="object-position:${s.pos}"><span class="tx"><span class="cap">Up to Ep ${whereOf(s,'alex')}</span><b class="cap">${s.short}</b><small>${last?last[1]:''}</small></span></button>`}).join('')}</div></section>`}
function verdictsHTML(){const L=SHOWS.filter(s=>follows(s)&&whereOf(s,'alex')>0&&!(s.dropAt&&s.dropAt>Date.now())).slice(0,4);if(!L.length)return '';
  return `<section class="sec"><div class="sh"><h2 class="cap">Couch verdicts</h2><span class="aside">The episodes you've seen</span></div><div class="cv-list">${L.map(s=>{const e=Math.min(whereOf(s,'alex'),s.eps||99),take=(WADATA[s.id]&&WADATA[s.id].lines[0])||null,mine=W.rates[s.id+e];
    return `<button class="cv-row" data-verdict="${s.id}"><img src="${ART(s.art)}" alt="" style="object-position:${s.pos}"><span class="tx"><b>${s.short} · Episode ${e}</b><small>${take?`${take[1]}: "${take[2]}"`:'No takes yet'}</small></span><span class="cv-sc"><b class="num">★ ${verdict(s,e)}</b><small>${mine?`you ${mine}`:'Rate it'}</small></span></button>`}).join('')}</div></section>`}
// By the numbers: cast stats from the couch's shows lead ("who's had the most votes against them?"); each card opens
// that show's stats sorted by it. Now and then one card is about the couch itself. Only shows the couch has.
const COUCH_SUPERS=[()=>['Most shows on their list','riley','7 shows'],()=>['Most-watched show',SHOWS.find(s=>s.id==='surv')?'Survivor':SHOWS[0].name,`${N===4?'4 of 4':'11 of 12'} watch it`],
  ()=>['Most reactions this month','riley','41 reactions'],()=>['Never misses a rating','sam','6 weeks straight'],()=>['Taste twins','you + riley','agree 82% of the time'],
  ()=>['The contrarian','jordan','rates a star off the couch'],()=>SHOWS.some(s=>s.id==='sev')?['First to finish','jordan','Severance, in 4 days']:null,
  ()=>anyGames()?['Called it most','jordan','7 predictions right']:null,()=>['Most watch alongs','sam','9 this month']];
function castSupers(){const out=[];SHOWS.filter(s=>hasStats(s)&&follows(s)&&whereOf(s,'alex')>0).forEach(s=>STATS[s.id].cats.forEach(([k,t,u],ci)=>{const L=statLeader(s,k);if(L)out.push({s,ci,t,u,L})}));return out}
const shuffled=a=>a.map(x=>[Math.random(),x]).sort((p,q)=>p[0]-q[0]).map(x=>x[1]);
function supersHTML(){const C=castSupers(),cast=[...shuffled(C.filter(x=>x.L.n>=2)),...shuffled(C.filter(x=>x.L.n<2))],couch=shuffled(COUCH_SUPERS.map(f=>f()).filter(Boolean));
  const n=cast.length?(Math.random()<.5?3:4):0,cards=cast.slice(0,n).map(({s,ci,t,u,L})=>`<button class="sp-card cast" data-stats="${s.id}" data-cat="${ci}"><span class="sp-show"><img src="${ART(s.art)}" alt="" style="object-position:${s.pos}"><span class="cap">${s.short}</span></span><img class="sp-face" src="${ph(L.c)}" alt=""><span class="sp-t cap">${t}</span><b>${first(L.c.name)}</b><small>${L.n} ${unit(u,L.n)}</small><span class="sp-go">See the board ${svg('chev')}</span></button>`);
  const couchCards=couch.slice(0,cards.length?(cards.length<4?1:0):3).map(([t,who,d])=>`<div class="sp-card couch"><span class="sp-show"><span class="cap">On the couch</span></span>${svg('crown')}<span class="sp-t cap">${t}</span><b>${who}</b><small>${d}</small></div>`);
  const all=[...cards];couchCards.forEach(c=>all.splice(1+Math.floor(Math.random()*all.length),0,c));
  return `<section class="sec" id="supSec"><div class="sh"><h2 class="cap">By the numbers</h2><button class="link" data-shuffle>Shuffle</button></div><p class="cb-sub">Up to where you are · tap one for the whole board</p><div class="sp-row" id="spRow">${all.join('')}</div></section>`}

const hubPlus=hub;
hub=function(){let h=hubPlus();if(N===1)return h;
  const cut=(startMark,endMark)=>{const a=h.indexOf(startMark);if(a<0)return null;const b=h.indexOf(endMark,a);return b<0?null:[a,b+endMark.length]};
  const rk=cut('<section class="sec"><div class="sh"><h2 class="cap">Power rankings</h2>','</section>');if(rk)h=h.slice(0,rk[0])+HUB_STUBS.ranks+h.slice(rk[1]);
  const cbA=h.indexOf('<div class="cb-head">'),cbS=h.lastIndexOf('<section',cbA),cbE=h.indexOf('</section>',cbA)+10;if(cbA>0)h=h.slice(0,cbS)+cbHTML()+supersHTML()+h.slice(cbE);
  const tr=cut('<section class="sec"><div class="sh"><h2 class="cap">Trophy shelf</h2>','</section>');if(tr&&(freshOn()||!PAST.length))h=h.slice(0,tr[0])+HUB_STUBS.trophies+h.slice(tr[1]);
  h=h.replace('<div class="guide-h">',nowHTML()+'<div class="guide-h">');
  const ys=cut('<section class="sec"><div class="sh"><h2 class="cap">Your shows</h2>','</section>');if(ys)h=h.slice(0,ys[1])+recapShelfHTML()+verdictsHTML()+h.slice(ys[1]);
  return h};
const wireHubPlus=wireHub;
wireHub=function(){wireHubPlus();if(N===1)return;
  app.querySelectorAll('[data-cb]').forEach(b=>b.onclick=()=>{const k=b.dataset.cb,s=SHOWS.find(x=>x.id===b.dataset.sid);
    ({rank:allRankSheet,league:()=>leaguePage(b.dataset.sid,+b.dataset.gi),show:()=>location.hash=`#/show/${b.dataset.sid}/tonight`,bingo:bingoSheet,poll:pollSheet,trivia:triviaSheet,start:startGamePicker,
      soon:()=>toast(`${s?s.short+' · ':''}Opens when the episode starts (mock)`)})[k]()});
  ['cbRow','rcShelf'].forEach(id=>$(id)&&hscroll($(id)));
  const nw=app.querySelector('[data-now]');if(nw)nw.onclick=()=>openWatch(nw.dataset.now);
  app.querySelectorAll('[data-recap]').forEach(b=>b.onclick=()=>recapSheet(SHOWS.find(x=>x.id===b.dataset.recap)));
  app.querySelectorAll('[data-verdict]').forEach(b=>b.onclick=()=>rateSheet(SHOWS.find(x=>x.id===b.dataset.verdict)));
  wireShuffle()};
function wireShuffle(){const sh=app.querySelector('[data-shuffle]');if(sh)sh.onclick=()=>{$('supSec').outerHTML=supersHTML();wireShuffle()};wireStats();if($('spRow'))hscroll($('spRow'))}
