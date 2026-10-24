// ================= playing solo (decided 2026-10-24: both) =================
// Public pools: "Survivor 51 · Everyone", the light games (Survival Pool and predictions) against everyone on the app.
// No draft, any size, usernames only, no chat or reactions (nothing social leaves a couch). Practice couch: the drafted
// games (Weekly Lineup, Outlast) against computer players, on real results. Both live on the solo hub and on a show's
// Games tab when you're solo.
const SOLO={pools:new Set(),practice:null};
const POOLSHOWS=()=>SHOWS.filter(s=>STATS[s.id]&&s.air);
function poolCard(s){const on=SOLO.pools.has(s.id);
  return `<button class="so-card" data-pool="${s.id}"><img src="${ART(s.art)}" alt="" style="object-position:${s.pos}"><span class="so-in"><span class="so-k cap">Public pool</span><b class="cap">${s.short} · Everyone</b>
    <small>${on?'Streak 3 · top 20% · pick due '+DAY[nextAir(s.air).getDay()]:'Survival Pool and predictions against everyone on the app'}</small></span><span class="so-go">${on?'Open':'Join'}</span></button>`}
function practiceCard(){const p=SOLO.practice;
  return `<button class="so-card prac" data-practice><span class="so-bots">${[0,1,2].map(i=>`<i>${svg('people')}</i>`).join('')}</span><span class="so-in"><span class="so-k cap">Practice couch</span><b class="cap">${p?`${p.game} vs ${p.bots} computer players`:'You vs computer players'}</b>
    <small>${p?`You're ${p.place} · ${p.level} · real results`:'Weekly Lineup or Outlast, drafted against bots, on real results'}</small></span><span class="so-go">${p?'Open':'Start'}</span></button>`}
function soloGamesHTML(s){const pool=STATS[s.id]&&s.air;
  return `<section class="blk"><p class="g-lede">On your own, two ways to play ${s.short}. Start a couch any time to play with friends instead.</p></section>
    <section class="blk">${pool?poolCard(s):''}${practiceCard()}</section>${epGamesHTML(s).replace(/<section class="blk"><button class="cp-start"[\s\S]*$/,'')}`}
function wireSoloGames(s){app.querySelectorAll('[data-pool]').forEach(b=>b.onclick=()=>poolPage(SHOWS.find(x=>x.id===b.dataset.pool)));
  app.querySelectorAll('[data-practice]').forEach(b=>b.onclick=practiceSheet);if(typeof wireEpGames==='function')wireEpGames(s)}
// a public pool: your streak, your pick, the board (usernames only), predictions
function poolPage(s){const joined=SOLO.pools.has(s.id),t=nextAir(s.air),still=STATS[s.id].season().cast.filter(c=>!c.exitEp);
  const board=[['castawaycal',5],['blindsidebetty',5],['idolhunter',4],['alex',3],['tribalqueen',3]];
  const body=()=>SOLO.pools.has(s.id)?`<section class="cp-hero"><b class="cp-big num">3</b><div><span class="cap">Your streak · top 20%</span><p>Pick who survives Episode ${s.ep} by ${fmtT(t)}. Never the same person twice.</p></div></section>
      <section class="blk"><div class="sh"><h2 class="cap">Your pick</h2><span class="aside">Closes at airtime</span></div><div class="so-pick">${still.slice(0,6).map(c=>`<button class="tile" data-sp="${first(c.name)}"><img src="${ph(c)}" alt=""><div class="cap">${first(c.name)}</div></button>`).join('')}</div></section>
      <section class="blk"><div class="sh"><h2 class="cap">The board</h2><span class="aside">Everyone · usernames only</span></div>${board.map(([n,v],i)=>`<div class="prow${n==='alex'?' me':''}"><span class="rk num">${i+1}</span>${av(n,32)}<span class="mid"><span class="nm">${n}${n==='alex'?'<span class="you">YOU</span>':''}</span></span><span class="pts num">${v}</span></div>`).join('')}</section>
      <section class="blk"><button class="row" data-sppred><span class="ic">${svg('quiz')}</span><span class="tx"><b>Predictions</b><small>Who goes home · will an idol be played</small></span>${svg('chev')}</button></section>`
    :`<section class="po-open"><img src="${ART(s.art)}" alt="" style="object-position:${s.hpos||s.pos}"><div><b class="cap">Everyone</b><span class="cap">${s.short} public pool</span></div></section>
      <section class="blk"><ul class="so-what">${[['shield','Survival Pool','Pick one person a week who survives. Never the same twice.'],['quiz','Predictions','One tap a week on who goes home.'],['people','Just usernames','No chat and no reactions: those stay on couches.']].map(([ic,tt,d])=>`<li>${svg(ic)}<span><b>${tt}</b><small>${d}</small></span></li>`).join('')}</ul>
      <button class="btn pri wide" id="spJoin" style="margin-top:14px">Join the ${s.short} pool</button></section>`;
  openPage(`${s.short} · Everyone`,`<div class="cp" id="spB">${body()}</div><div style="height:40px"></div>`,pg=>{const wire=()=>{
      const j=$('spJoin');if(j)j.onclick=()=>{SOLO.pools.add(s.id);$('spB').innerHTML=body();wire();toast(`You're in the ${s.short} pool`)};
      pg.querySelectorAll('[data-sp]').forEach(b=>b.onclick=()=>{pg.querySelectorAll('[data-sp]').forEach(x=>x.classList.toggle('sel',x===b));toast(`${b.dataset.sp} locked in · streak 3 on the line`)});
      const pr=pg.querySelector('[data-sppred]');if(pr)pr.onclick=()=>predictSheet()};wire()},{back:'Back'})}
// a practice couch: pick the game and how sharp the bots are
function practiceSheet(){if(SOLO.practice)return toast(`Your practice couch: ${SOLO.practice.game}, you're ${SOLO.practice.place} (mock)`);let g='Weekly Lineup',lv='Normal';
  openSheet('Practice couch','You against computer players, on real results',`<p class="label cap">Game</p>${[['Weekly Lineup','Draft five, start three each week'],['Outlast','Draft four; the last one standing carries you']].map(([n,d])=>`<button class="typecard${n===g?' on':''}" data-pg="${n}"><span><b>${n}</b><small>${d}</small></span></button>`).join('')}
    <p class="label cap">The computer players</p><div class="ex-seg">${['Easy','Normal','Sharp'].map(l=>`<button class="${l===lv?'on':''}" data-pl="${l}">${l}</button>`).join('')}</div>
    <p class="muted small" style="margin-top:10px;line-height:1.45">Three bots draft against you, then the season plays out on the real results, spoiler-safe to where you are. Your practice never counts toward a couch.</p>
    <button class="btn pri wide" id="pcGo" style="margin-top:14px">Start the draft</button>`,b=>{
    b.querySelectorAll('[data-pg]').forEach(x=>x.onclick=()=>{g=x.dataset.pg;b.querySelectorAll('[data-pg]').forEach(y=>y.classList.toggle('on',y===x))});
    b.querySelectorAll('[data-pl]').forEach(x=>x.onclick=()=>{lv=x.dataset.pl;b.querySelectorAll('[data-pl]').forEach(y=>y.classList.toggle('on',y===x))});
    $('pcGo').onclick=()=>{SOLO.practice={game:g,bots:3,level:lv,place:'2nd'};closeSheet();toast(`Practice couch ready · ${g} against 3 ${lv.toLowerCase()} bots`);route()}})}
// the solo hub: "Play on your own" right under your shows
const soloHubS=soloHub;
soloHub=function(){const h=soloHubS();const sec=`<section class="sec"><div class="sh"><h2 class="cap">Play on your own</h2><span class="aside">No couch needed</span></div><div class="so-list">${POOLSHOWS().slice(0,2).map(poolCard).join('')}${practiceCard()}</div></section>`;
  return h.replace('<section class="sec"><div class="sh"><h2 class="cap">On your own</h2>',sec+'<section class="sec"><div class="sh"><h2 class="cap">On your own</h2>')};
const wireSoloS=wireSolo;
wireSolo=function(){wireSoloS();app.querySelectorAll('[data-pool]').forEach(b=>b.onclick=()=>poolPage(SHOWS.find(x=>x.id===b.dataset.pool)));app.querySelectorAll('[data-practice]').forEach(b=>b.onclick=practiceSheet)};
