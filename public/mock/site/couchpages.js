// ================= the "More on the couch" pages (/impeccable bolder, 2026-10-24) =================
// The hub's focus-first layout (refine.js) moved six sections behind one list; each is now a page worth opening, each
// built on one move the system already owns, at full strength:
//   Power rankings    the reveal's standings as a page: your place as the big number, your row the white plate
//   Commercial break  the colour-bars ident as a real title card, then three groups: playing · this week · start one
//   By the numbers    the vote-out card turned into a deck of stat cards, then every stat sorted (for researchers)
//   Couch verdicts    a critics' panel per show: the big score, everyone's stars, the best take on a plate
//   Previously on     a cold open per show: art, PREVIOUSLY ON, the last beats as lower thirds
//   Trophy shelf      the cabinet: your titles as the big number, a plaque per season, the couch's records
// Yellow stays "you need to do it" (only a due move); everything is spoiler-safe to where you are in each show.
{const seenShows=()=>SHOWS.filter(s=>follows(s)&&whereOf(s,'alex')>0&&!(s.dropAt&&s.dropAt>Date.now()));
const tot=r=>r[1]+r[2]+r[3];
const safeChip=`<div class="cp-safe">${svg('shield')}<span><b>Spoiler-safe</b> · up to where you are in each show</span></div>`;

// ---------- Power rankings ----------
function rankingsPage(){const pr=(N===4?PR4:PR12).slice().sort((a,b)=>tot(b)-tot(a)),me=pr.findIndex(r=>r[0]==='alex'),lead=pr[0],gap=tot(lead)-tot(pr[me]);
  const body=()=>`<section class="cp-hero"><b class="cp-big num">${ordinal(me+1)}</b><div><span class="cap">This year · of ${pr.length}</span><p>${me?`${gap} back of ${lead[0]}. A good Wednesday ${N===4?'puts you level':'moves you up'}.`:'You lead the couch.'}</p></div></section>
    <div class="ex-seg cp-tabs">${[['year','This year'],['all','All-time'],['h2h','Head to head']].map(([k,l])=>`<button class="${rankTab===k?'on':''}" data-rt="${k}">${l}</button>`).join('')}</div>
    <div class="cp-board" id="cpBoard">${rankPane()}</div>
    <section class="blk"><div class="cp-how">${svg('cup')}<p><b>One table for every game on the couch.</b> Each game you finish adds points by where you placed, so a Survivor title and a Traitors pool both count. The bar shows where your points came from.</p></div></section>`;
  openPage('Power rankings',`<div class="cp" id="cpR">${body()}</div><div style="height:40px"></div>`,pg=>{const wire=()=>{pg.querySelectorAll('[data-rt]').forEach(b=>b.onclick=()=>{rankTab=b.dataset.rt;$('cpR').innerHTML=body();wire();grow()})};
    const grow=()=>{const p=$('cpBoard');requestAnimationFrame(()=>requestAnimationFrame(()=>p.classList.add('in')));if(rankTab==='year')countUp(p)};wire();grow()},{back:'Home'})}

// ---------- Commercial break ----------
function breakPage(){const KIND={'Weekly Lineup':'lineup','Outlast':'outlast','Survival Pool':'pool'},idx=N===4?0:1;
  const playing=SHOWS.filter(s=>s.kinds&&s.games).flatMap(s=>s.games.map(g=>({s,g,kind:KIND[g[0]]||'outlast',due:s.id==='surv'&&g[0]==='Weekly Lineup'&&!state.lineup})));
  const eps=[];SHOWS.filter(s=>!s.binge&&!s.others&&follows(s)&&s.air).slice(0,3).forEach(s=>{const t=nextAir(s.air);eps.push({s,t:`Episode ${s.ep} bingo`,d:`Opens ${DAY[t.getDay()]} ${clock(t)}`,act:s.id==='surv'?'bingo':'soon',ic:'bingo'})});
  if(SHOWS.some(s=>s.id==='trt'))eps.push({s:SHOWS.find(s=>s.id==='trt'),t:'Banishment poll',d:'Started by riley · 10 seconds',act:'poll',ic:'poll'});
  if(SHOWS.some(s=>s.id==='surv'))eps.push({s:SHOWS.find(s=>s.id==='surv'),t:'Survivor 49 trivia',d:'3 questions · riley got 2',act:'trivia',ic:'quiz'});
  openPage('Commercial break',`<div class="cp">
    <section class="cp-ident"><span class="cp-bars" aria-hidden="true">${['#f4f2f8','#e0b23a','#35b5a5','#a76bb0','#f2545b','#5089c9','#f2804b'].map(c=>`<i style="background:${c}"></i>`).join('')}</span>
      <div class="cp-identp"><b class="cap">Commercial break</b><small>Every game on the couch. Join any, or none.</small></div></section>
    <section class="blk"><div class="sh"><h2 class="cap">You're playing</h2><span class="aside">${playing.length} games</span></div>
      ${playing.map(({s,g,kind,due})=>`<button class="cp-game" data-go="${s.id}"><img src="${ART(s.art)}" alt="" style="object-position:${s.pos}"><span class="tx"><span class="cap" style="color:${GAMES[kind].col}">${g[0]}</span><b>${s.short}</b><small>${due?'Your lineup is due':g[1]}</small></span>${due?`<span class="cp-due cap">Due Wed</span>`:`<b class="cp-pl num">${g[2][idx]}</b>`}</button>`).join('')||'<p class="muted small">Nothing yet: start one below.</p>'}</section>
    <section class="blk"><div class="sh"><h2 class="cap">This week only</h2><span class="aside">One night each</span></div>
      <div class="cp-eps">${eps.map(x=>`<button class="cp-ep" data-ep="${x.act}" data-sid="${x.s.id}"><img src="${ART(x.s.art)}" alt="" style="object-position:${x.s.pos}"><span class="ic">${svg(x.ic)}</span><b class="cap">${x.t}</b><small>${x.d}</small></button>`).join('')}</div></section>
    <section class="blk"><button class="cp-start" id="cpStart">${svg('plus')}<span><b>Start a game</b><small>A season game, bingo, a poll or trivia. Anyone on the couch can.</small></span></button></section></div><div style="height:40px"></div>`,
    pg=>{pg.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{closePage();location.hash=`#/show/${b.dataset.go}/tonight`});
      pg.querySelectorAll('[data-ep]').forEach(b=>b.onclick=()=>({bingo:bingoSheet,poll:pollSheet,trivia:triviaSheet,soon:()=>toast('Opens when the episode starts (mock)')})[b.dataset.ep]());
      $('cpStart').onclick=startGamePicker},{back:'Home'})}

// ---------- By the numbers ----------
function numbersPage(){const C=castSupers(),couch=COUCH_SUPERS.map(f=>f()).filter(Boolean);
  const deck=[...C.filter(x=>x.L.n>=2).slice(0,5).map(({s,ci,t,u,L})=>`<button class="cp-stat" data-stats="${s.id}" data-cat="${ci}"><img src="${ph(L.c)}" alt=""><span class="cp-show"><img src="${ART(s.art)}" alt="" style="object-position:${s.pos}">${s.short}</span><span class="tg cap">${t}</span><span class="vn"><span class="cp-who"><b class="cap">${first(L.c.name)}</b><small>${unit(u,L.n)} · see everyone</small></span><span class="cp-n num">${L.n}</span></span></button>`),
    ...couch.slice(0,2).map(([t,who,d])=>`<div class="cp-stat couch"><span class="cp-crest">${svg('crown')}</span><span class="cp-show">On the couch</span><span class="tg cap">${t}</span><span class="vn"><span class="cp-who"><b class="cap">${who}</b><small>${d}</small></span></span></div>`)];
  deck.splice(2,0,deck.pop());
  const all=seenShows().filter(hasStats).map(s=>`<section class="blk"><div class="sh"><h2 class="cap">${s.short}</h2><span class="aside">Up to Ep ${whereOf(s,'alex')}</span></div>${STATS[s.id].cats.map(([k,t,u],ci)=>{const L=statLeader(s,k);return L?`<button class="cp-row" data-stats="${s.id}" data-cat="${ci}"><img src="${ph(L.c)}" alt=""><span class="tx"><b>${t}</b><small>${first(L.c.name)} leads</small></span><b class="num">${L.n}</b>${svg('chev')}</button>`:''}).join('')}</section>`).join('');
  openPage('By the numbers',`<div class="cp">${safeChip.replace('cp-safe','cp-safe blk0')}<div class="cp-deck" id="cpDeck">${deck.join('')}</div><div class="r-dots" id="cpDots">${deck.map((_,i)=>`<i class="${i?'':'on'}"></i>`).join('')}</div>${all}</div><div style="height:40px"></div>`,
    pg=>{pg.querySelectorAll('[data-stats]').forEach(b=>b.onclick=()=>{closePage();setTimeout(()=>statsPage(SHOWS.find(x=>x.id===b.dataset.stats),+b.dataset.cat),250)});
      const d=$('cpDeck');d.onscroll=()=>{const i=Math.round(d.scrollLeft/(d.firstElementChild.offsetWidth+10));pg.querySelectorAll('#cpDots i').forEach((x,j)=>x.classList.toggle('on',j===i))}},{back:'Home'})}

// ---------- Couch verdicts ----------
function verdictsPage(){const L=seenShows().slice(0,5);
  const panel=s=>{const e=Math.min(whereOf(s,'alex'),s.eps||99),take=(WADATA[s.id]&&WADATA[s.id].lines[0])||null,mine=W.rates[s.id+e],who=(watchersOf(s)||[]).slice(0,5),eps=Array.from({length:Math.min(e,8)},(_,k)=>e-Math.min(e,8)+k+1);
    return `<section class="cp-verdict"><div class="cp-vh"><img src="${ART(s.art)}" alt="" style="object-position:${s.hpos||s.pos}"><div><span class="cap">${s.short} · Episode ${e}</span><b class="cp-big num">${verdict(s,e)}</b><small>★ couch rating · from ${who.length}</small></div></div>
      <div class="cp-stars">${who.map(n=>{const r=n==='alex'?mine:(+verdict(s,e)+((n.length%3)-1)*.5).toFixed(1);return `<span>${av(n,30)}<b class="num">${r?`★ ${r}`:''}</b>${n==='alex'&&!r?`<button class="cp-rate" data-rate="${s.id}">Rate</button>`:''}</span>`}).join('')}</div>
      ${take?`<div class="plate cp-take"><span class="tg q cap">${take[1]}</span><span class="bd"><span class="d">"${take[2]}"</span></span></div>`:''}
      <div class="cp-eps-r" aria-label="Couch rating by episode">${eps.map(x=>`<span><i style="height:${(verdict(s,x)-3)*40}%"></i><small class="num">${x}</small></span>`).join('')}</div></section>`};
  openPage('Couch verdicts',`<div class="cp">${safeChip}${L.map(panel).join('')}<section class="blk"><div class="cp-how">${svg('star')}<p><b>Taste twin: riley.</b> You two rate within half a star 8 times in 10. jordan rates a star off the couch most weeks.</p></div></section></div><div style="height:40px"></div>`,
    pg=>pg.querySelectorAll('[data-rate]').forEach(b=>b.onclick=()=>{closePage();setTimeout(()=>rateSheet(SHOWS.find(x=>x.id===b.dataset.rate)),250)}),{back:'Home'})}

// ---------- Previously on ----------
// Redesigned 2026-10-24 (the stacked caption plates were rejected): faces, not banners. One show at a time; a cold open;
// "Last time" as the reveal's vote-out card; the boot order as a strip of faces; who's still in by group (a secret
// faction stays secret); then episode by episode. Shows without cast data get the same frame with the recap as type.
let poShow=null;
const METHOD={'Voted Out':'Voted out',Murdered:'Murdered',Banished:'Banished',Quit:'Quit',Medevac:'Medically evacuated'};
function recapsPage(){const L=seenShows();if(!L.length)return openPage('Previously on','<div class="cp"><p class="muted" style="padding:20px 16px">Add a show and set where you are; its story so far shows up here.</p></div>',null,{back:'Home'});
  if(!L.some(s=>s.id===poShow))poShow=(L.find(s=>STATS[s.id])||L[0]).id;
  const paint=()=>{const s=L.find(x=>x.id===poShow),w=whereOf(s,'alex'),src=STATS[s.id]&&STATS[s.id].season(),cast=src?src.cast:[];
    const gone=cast.filter(c=>c.exitEp&&c.exitEp<=w).sort((a,b)=>a.exitEp-b.exitEp),still=cast.filter(c=>!(c.exitEp&&c.exitEp<=w)),last=gone.filter(c=>c.exitEp===w),lines=recapLines(s);
    const place=c=>ordinal(cast.length-cast.filter(x=>x.exitEp&&x.exitEp<c.exitEp).length);
    const groups=factionSecret(s)?[['Still in',still,null]]:[...new Set(still.map(c=>factionOf(s,c)).filter(Boolean))].map(g=>[g,still.filter(c=>factionOf(s,c)===g),(src.tribes||{})[g]]);
    const lastTime=last.length?`<div class="po-last${last.length>1?' two':''}">${last.map(c=>`<button class="po-card" data-po-ep="${w}"><img src="${ph(c)}" alt=""><span class="tg cap">${METHOD[c.exitMethod]||'Out'} · Ep ${w}</span><span class="po-plate"><b class="cap">${first(c.name)}</b><small>${factionSecret(s)&&factionOf(s,c)?`${factionOf(s,c)} · `:''}Finished ${place(c)}</small></span></button>`).join('')}</div>`
      :`<button class="po-text" data-po-ep="${w}"><span class="po-epn num">${w}</span><p>${(lines[lines.length-1]||[0,'Nothing recorded yet'])[1]}</p></button>`;
    return `<div class="po-shows" role="tablist">${L.map(x=>`<button role="tab" aria-selected="${x.id===poShow}" class="${x.id===poShow?'on':''}" data-po="${x.id}"><img src="${ART(x.art)}" alt="" style="object-position:${x.pos}"><span>${x.short}</span></button>`).join('')}</div>
      <section class="po-open"><img src="${ART(s.art)}" alt="" style="object-position:${s.hpos||s.pos}"><div><b class="cap">Previously on</b><span class="cap">${s.short}</span></div>
        <div class="po-safe">${svg('shield')}Up to Episode ${w} · nothing past it</div></section>
      <section class="blk"><div class="sh"><h2 class="cap">Last time</h2><span class="aside">Episode ${w}</span></div>${lastTime}</section>
      ${gone.length?`<section class="blk"><div class="sh"><h2 class="cap">The story so far</h2><span class="aside">${gone.length} gone · ${still.length} still in</span></div>
        <div class="po-track">${gone.map(c=>`<button class="po-gone${c.exitEp===w?' last':''}" data-po-ep="${c.exitEp}"><img src="${ph(c)}" alt=""><b>${first(c.name)}</b><small class="cap">Ep ${c.exitEp}</small></button>`).join('')}</div></section>`:''}
      ${still.length?`<section class="blk"><div class="sh"><h2 class="cap">Still in</h2><span class="aside">${factionSecret(s)?'Factions stay secret':src.tribeTerm?`By ${src.tribeTerm.toLowerCase()}`:''}</span></div>
        ${groups.map(([g,P,col])=>`<div class="po-grp">${groups.length>1||col?`<span class="po-gh">${col?`<i style="background:${col}"></i>`:''}<b class="cap">${g}</b><small>${P.length}</small></span>`:''}<div class="po-faces">${P.map(c=>`<span><img src="${ph(c)}" alt=""><small>${first(c.name)}</small></span>`).join('')}</div></div>`).join('')}</section>`:''}
      <section class="blk"><div class="sh"><h2 class="cap">Episode by episode</h2></div>${lines.slice().reverse().map(([e,t])=>{const out=gone.filter(c=>c.exitEp===e);return `<button class="po-ep" data-po-ep="${e}"><span class="po-epn num">${e}</span>${out.length?`<span class="po-epf">${out.map(c=>`<img src="${ph(c)}" alt="">`).join('')}</span>`:''}<span class="tx">${t}</span>${svg('chev')}</button>`}).join('')}</section>
      ${s.air||s.binge?`<section class="blk"><button class="btn out wide" data-po-watch="${s.id}">${svg('tv')}Watch along · Episode ${Math.min(w+1,s.ep||w+1)}</button></section>`:''}`};
  openPage('Previously on',`<div class="cp po" id="poB">${paint()}</div><div style="height:40px"></div>`,pg=>{const wire=()=>{
      pg.querySelectorAll('[data-po]').forEach(b=>b.onclick=()=>{poShow=b.dataset.po;$('poB').innerHTML=paint();wire();pg.scrollTop=0});
      pg.querySelectorAll('[data-po-ep]').forEach(b=>b.onclick=()=>{const s=SHOWS.find(x=>x.id===poShow);if(s.id==='surv'){closePage();setTimeout(()=>episodePage(+b.dataset.poEp),250)}else recapSheet(s)});
      pg.querySelectorAll('[data-po-watch]').forEach(b=>b.onclick=()=>{closePage();setTimeout(()=>openWatch(b.dataset.poWatch),250)})};wire()},{back:'Home'})}

// ---------- Trophy shelf ----------
function trophiesPage(){const mine=2,seasons=9;
  openPage('Trophy shelf',`<div class="cp">
    <section class="cp-hero"><b class="cp-big num">${mine}</b><div><span class="cap">Titles · ${seasons} seasons played</span><p>Average finish 2nd. riley holds the most, with 3.</p></div></section>
    <section class="blk"><div class="sh"><h2 class="cap">Recent seasons</h2></div><div class="cp-shelf">${PAST.map(p=>`<div class="cp-plaque${p.winner==='alex'?' won':''}"><img src="${ART(p.art)}" alt=""><span class="cp-pl num">${p.pl}</span><b class="cap">${p.show}</b><small>${p.note}</small>${p.rib?`<span class="cp-rib cap">${p.rib}</span>`:''}</div>`).join('')}</div></section>
    <section class="blk"><div class="sh"><h2 class="cap">Couch records</h2></div>
      ${[['crown','Most titles','riley','3'],['repeat','Ran it back','riley','Survivor 49 and 50'],['shield','Longest pool streak','maya','9 episodes'],['bolt','Biggest comeback','alex','8th to 1st · Traitors 4']].map(([ic,t,who,d])=>`<div class="cp-rec"><span class="ic">${svg(ic)}</span><span class="tx"><b>${t}</b><small>${d}</small></span>${av(who,30)}</div>`).join('')}</section></div><div style="height:40px"></div>`,null,{back:'Home'})}

const PAGES={rank:rankingsPage,games:breakPage,numbers:numbersPage,verdicts:verdictsPage,recaps:recapsPage,trophies:trophiesPage};
const SUBS={rank:()=>{const p=placeOf();return p.i===1?'You lead the couch this year':`You're ${ordinal(p.i)} · ${p.gap} back of ${p.lead}`},games:()=>`${SHOWS.filter(s=>s.kinds).reduce((n,s)=>n+(s.games||[]).length,0)} games you're in · bingo and polls this week`,
  numbers:()=>'Who leads every stat, up to where you are',verdicts:()=>`How the couch rated ${seenShows().length} shows`,recaps:()=>'The story so far, up to where you are',trophies:()=>'2 titles · 9 seasons played'};
const wireHubCP=wireHub;
wireHub=function(){wireHubCP();app.querySelectorAll('[data-more]').forEach(r=>{const k=r.dataset.more;if(!PAGES[k])return;r.onclick=()=>PAGES[k]();const sm=r.querySelector('small');if(sm&&SUBS[k])sm.textContent=SUBS[k]()})};
window.couchPage=k=>PAGES[k]&&PAGES[k]();
route()}
