// ================= episode night: before → during → results in → reveal → after =================
// Later functions here replace the simpler versions in show.js / dock.js.
const EP5={out:'Thien',votes:'3 votes to 2',reward:'Toka',immunity:'Dina',
  lineup:{alex:22,riley:2,jordan:8,sam:5,maya:11,dev:6,priya:9,luis:4,kat:7,ben:3,noor:10,theo:1},
  scorers:[['Kristin','Won individual reward · found an idol clue',9],['Mike','Voted with the majority',2],['Brady','Won immunity with Dina',3],['Carter','Won reward · voted with the majority',6]],
  poolOut:{riley:true}};
const revealed5=()=>SHOWSTATE.revealed>=5;
let resultsIn=()=>SHOWSTATE.phase==='after'&&!revealed5();
// standings read Episode 5 only once you've revealed it
const _std=standing;
standing=function(g){const rows=_std(g);if(!revealed5())return rows;
  if(g==='lineup')return rows.map(r=>({...r,t:LINEUP_PTS[r.n]+(EP5.lineup[r.n]||0),w:EP5.lineup[r.n]||0,prev:LINEUP_PTS[r.n]})).sort((a,b)=>b.t-a.t);
  if(g==='pool')return rows.map(r=>({...r,t:EP5.poolOut[r.n]?0:r.t+1})).sort((a,b)=>b.t-a.t);
  return rows};
function applyEp5(){const t=S51.cast.find(c=>c.name.startsWith(EP5.out));if(t&&!t.exitEp){t.exitEp=5;t.perEp[4]=-4;t.total-=4}
  EP5.scorers.forEach(([n,,v])=>{const c=S51C(n);if(c&&c.perEp.length<5){c.perEp[4]=v;c.total+=v}})}

// ---------- the dock knows about results ----------
const _dock=dockHTML;
dockHTML=function(s){if(N===1||s.id!=='surv'||SHOWSTATE.tab==='chat')return '';
  if(resultsIn())return `<button class="dock need reveal" id="dockRv"><span class="eyeic">${svg('eye')}</span><span class="tx"><b>Episode 5 results are in</b><small>Everything stays hidden until you reveal</small></span><span class="dbtn">Reveal</span></button>`;
  if(revealed5()){const air=nextAir(s.air);air.setDate(air.getDate()+(air-new Date()<5*864e5?7:0));
    return `<button class="dock" id="dock"><span class="faces">${[...MOVES.starters].map(n=>S51C(n)).filter(c=>!c.exitEp).map(c=>`<img src="${ph(c)}" alt="">`).join('')}</span><span class="tx"><b>Episode 6 · lineup carried over</b><small>Change until ${fmtT(air)} · new pick needed</small></span><span class="dbtn">Edit</span></button>`}
  return _dock(s)};

// ---------- Tonight: the after block ----------
afterBlock=function(s){if(!revealed5())return `<section class="blk"><button class="rvplate" data-job="reveal"><img src="${ART(s.art)}" alt="" style="object-position:${s.hpos||s.pos}"><span class="tg cap">Episode ${s.ep}</span><b class="cap">Results are in</b><small>Watched it? Reveal for every game at once. Nothing shows until then.</small><span class="rvbtn">${svg('eye')}Reveal Episode ${s.ep}</span></button>
    <p class="muted small" style="margin-top:10px;display:flex;gap:6px;align-items:center">${svg('people')}riley and sam have revealed · chat is folded for you</p></section>`;
  const out=S51C(EP5.out);
  return `<section class="blk"><div class="plate outp"><img src="${ph(out)}" alt=""><span class="tg live cap">Out</span><span class="bd"><span class="t cap">${out.name}</span><span class="d">Voted out · ${EP5.votes} · finished 16th</span></span></div>
    <div class="night"><div class="nh"><span class="cap">Your night</span><b class="num">+${EP5.lineup.alex}</b></div>
      <div class="gline"><span class="kind cap" style="color:#ffc531">Weekly Lineup</span><b>Up to 1st</b><small>Kristin +9 · Brady +3 · Mike +2 · 42 total</small></div>
      <div class="gline"><span class="kind cap" style="color:#35b5a5">Survival Pool</span><b>Streak 4</b><small>${SHOWSTATE.pool||'Devin'} survived · riley's streak ended at 4</small></div>
      <div class="gline"><span class="kind cap" style="color:#f2804b">Outlast</span><b>All safe</b><small>riley lost Thien</small></div>
      <div class="gline"><span class="kind cap" style="color:#e56b9f">Predictions</span><b>1 of 2 · +2</b><small>You called ${SHOWSTATE.preds.out||'Thien'} going home</small></div></div></section>
  <section class="blk"><div class="sh"><h2 class="cap">After the episode</h2></div>
    <button class="job${SHOWSTATE.rated?' done':''}" data-job="rate5"><span class="ic">${svg('star')}</span><span class="tx"><span class="kind cap">Rate it</span><b>How was Episode 5?</b><small>${SHOWSTATE.rated?`You gave it ${SHOWSTATE.rated} · couch says 4.6`:'The couch verdict unlocks after you rate'}</small></span><span class="st">${SHOWSTATE.rated?'Rated':'Rate'}</span>${svg('chev')}</button>
    <button class="job" data-job="bingo"><span class="ic">${svg('bingo')}</span><span class="tx"><span class="kind cap">Bingo</span><b>sam got a line first</b><small>Blindside, tree mail, idol clue, rain, "dig deep"</small></span>${svg('chev')}</button>
    <button class="job" data-ep="5"><span class="ic">${svg('cal')}</span><span class="tx"><span class="kind cap">Recap</span><b>What happened in Episode 5</b><small>Reward, immunity, the vote, every score</small></span>${svg('chev')}</button></section>`};

// ---------- Episodes: a locked row while results wait ----------
const _eps=tabEpisodes;
tabEpisodes=function(s){let h=_eps(s);
  if(resultsIn())h=h.replace('<section class="blk"><div class="sh"><h2 class="cap">Every episode</h2>','<section class="blk"><div class="sh"><h2 class="cap">Every episode</h2>').replace(/(<div class="sh"><h2 class="cap">Every episode<\/h2><span class="aside">[^<]*<\/span><\/div>)/,`$1<button class="eprow locked" data-job="reveal"><span class="n num">5</span><span class="lockface">${svg('eye')}</span><span class="tx"><b>Results are in</b><small>Hidden until you reveal</small></span><span class="st">Reveal</span></button>`);
  return h};
// ---------- Standings: as of Episode 4 until you reveal; movement after ----------
const _st=tabStandings;
tabStandings=function(s){let h=_st(s);
  if(resultsIn())h=`<button class="asof" data-job="reveal">${svg('eye')}<span><b>As of Episode 4</b><small>Episode 5 is in. Reveal to update every table.</small></span><span class="st">Reveal</span></button>`+h;
  if(revealed5())h=h.replace(/(data-player="alex" data-g="lineup"[^>]*>)/,'$1').replace('Through Episode 4.','Through Episode 5. ▲ you moved up to 1st in Weekly Lineup.');
  return h};
// ---------- Chat: messages after airtime are folded until you reveal ----------
const _chat=tabChat;
tabChat=function(s){let h=_chat(s);
  if(resultsIn())h=h.replace('<div class="sysline">',`<button class="fold" id="cfold">${svg('eye')}<span>4 messages after Episode 5 aired · reveal or tap to show</span></button><div class="sysline">`);
  if(revealed5())h=h.replace('<div class="sysline">',`${msgHTML('riley','THIEN?? I had her in my Pool')}${msgHTML('jordan','that blindside was cold')}${msgHTML('sam','Kristin with the idol clue, called it')}<div class="sysline">${svg('eye')}you revealed Episode 5</div><div class="sysline">`);
  return h};

// ---------- the reveal: one broadcast for every game ----------
function revealPlay(s){applyEp5Preview();const out=S51C(EP5.out),st=[...MOVES.starters].filter(n=>!S51C(n).exitEp||n===EP5.out);
  const before=_std('lineup').slice(0,4),after=crowdOf().slice(0,4).map(n=>({n,t:LINEUP_PTS[n]+(EP5.lineup[n]||0)})).sort((a,b)=>b.t-a.t);
  const beats=[
    `<div class="rb"><span class="cap rk">Survivor 51 · Episode 5</span><h2 class="cap">Previously<br>on the couch</h2><p class="muted">Tap anywhere to go on</p></div>`,
    `<div class="rb"><span class="cap rk">The challenges</span><div class="plate"><span class="tg cap" style="background:${TRIBES[EP5.reward]};color:#121018">Reward</span><span class="bd"><span class="t cap">${EP5.reward} wins reward</span><span class="d">Kristin and Carter score</span></span></div><div class="plate" style="margin-top:10px"><span class="tg cap" style="background:${TRIBES[EP5.immunity]};color:#121018">Immunity</span><span class="bd"><span class="t cap">${EP5.immunity} wins immunity</span><span class="d">Brady scores · Toka goes to tribal</span></span></div></div>`,
    `<div class="rb vote"><div class="vcard"><img src="${ph(out)}" alt=""><span class="tg live cap">Voted out · ${EP5.votes}</span><div class="vn"><b class="cap">${out.name}</b><small>Blindsided · finished 16th</small></div></div></div>`,
    `<div class="rb"><span class="cap rk">Your Weekly Lineup</span><div class="tally">${EP5.scorers.filter(x=>st.includes(x[0])||['Kristin','Mike','Brady'].includes(x[0])).slice(0,3).map(([n,why,v],i)=>`<div class="tli" style="--i:${i}"><img src="${ph(S51C(n))}" alt=""><span><b>${n}</b><small>${why}</small></span><b class="num">+${v}</b></div>`).join('')}</div><div class="big num">+${EP5.lineup.alex}</div></div>`,
    `<div class="rb"><span class="cap rk">Your other games</span><div class="og"><span class="kind cap" style="color:#35b5a5">Survival Pool</span><b>${SHOWSTATE.pool||'Devin'} survived</b><span class="streak"><s class="num">3</s> <b class="num">4</b> in a row</span></div><div class="og"><span class="kind cap" style="color:#f2804b">Outlast</span><b>All four still in</b><small>riley lost Thien</small></div><div class="og"><span class="kind cap" style="color:#e56b9f">Predictions</span><b>You called it · +2</b><small>"Who goes home? ${SHOWSTATE.preds.out||'Thien'}"</small></div></div>`,
    `<div class="rb"><span class="cap rk">Weekly Lineup standings</span><div class="mvlist" id="mvl">${before.map((r,i)=>`<div class="mvr${r.n==='alex'?' me':''}" data-n="${r.n}" style="transform:translateY(${i*54}px)"><span class="num r">${i+1}</span>${av(r.n,28)}<b>${r.n}</b><span class="num t">${r.t}</span></div>`).join('')}</div><p class="muted" id="mvnote" style="margin-top:236px;opacity:0;transition:opacity .4s">You're 1st, 2 ahead of riley.</p></div>`];
  const r=document.createElement('div');r.className='revealfs v2';let k=0;
  r.innerHTML=`<div class="rtop"><span class="cap">${s.name.replace('The ','')}</span><button id="rskip">Skip</button></div><div class="rstage" id="rstage"></div><div class="rdots">${beats.map((_,i)=>`<i data-i="${i}"></i>`).join('')}</div><button class="btn ink wide rdone" id="rvd">Back to ${s.name.replace('The ','')}</button>`;
  $('device').appendChild(r);
  const show=()=>{const st=r.querySelector('#rstage');st.innerHTML=beats[k];st.firstElementChild.classList.add('in');r.querySelectorAll('.rdots i').forEach((d,i)=>d.classList.toggle('on',i<=k));r.classList.toggle('last',k===beats.length-1);
    if(k===beats.length-1)setTimeout(()=>{after.forEach((x,i)=>{const el=r.querySelector(`.mvr[data-n="${x.n}"]`);if(el){el.style.transform=`translateY(${i*54}px)`;el.querySelector('.r').textContent=i+1;el.querySelector('.t').textContent=x.t}});const n=r.querySelector('#mvnote');if(n)n.style.opacity=1},700)};
  show();
  r.querySelector('#rstage').onclick=()=>{if(k<beats.length-1){k++;show()}};
  r.querySelector('#rskip').onclick=()=>{k=beats.length-1;show()};
  r.querySelector('#rvd').onclick=()=>{r.remove();applyEp5();SHOWSTATE.revealed=5;SHOWSTATE.phase='after';showRoute(s.id,'tonight')}}
function applyEp5Preview(){}
// watch along ends in the reveal for league shows
function afterWatch(sid){closeWatch();SHOWSTATE.phase='after';const s=SHOWS.find(x=>x.id===sid);if(sid==='surv'){showRoute(sid,'tonight');setTimeout(()=>revealPlay(s),400)}}
function rate5(){openSheet('How was Episode 5?','Two seconds. Then the couch verdict.',`<div class="stars">${[1,2,3,4,5].map(i=>`<button data-r="${i}" class="${SHOWSTATE.rated>=i?'on':''}">${svg('star','')}</button>`).join('')}</div><div class="verdict${SHOWSTATE.rated?' on':''}" id="vd5" style="margin-top:14px"><span class="tg cap">Couch verdict</span><div class="sc"><b class="num">4.6</b><span>from 4 on the couch</span></div><p><b>riley:</b> "Most chaotic tribal of the season."</p></div>`,
  b=>b.querySelectorAll('[data-r]').forEach(x=>x.onclick=()=>{SHOWSTATE.rated=+x.dataset.r;b.querySelectorAll('[data-r]').forEach(y=>y.classList.toggle('on',+y.dataset.r<=SHOWSTATE.rated));$('vd5').classList.add('on');setTimeout(()=>{closeSheet();route()},1400)}))}
