// ================= results arrive in stages =================
// waiting (just aired) → early (who went home: settles Survival Pool + Outlast, predictions on the boot)
// → final (morning after: full scoring settles Weekly Lineup). One reveal per episode; the morning
// update only changes scores, so it never spoils.
SHOWSTATE.res=SHOWSTATE.res||'waiting';
EP5.soFar={alex:14,riley:2,jordan:5,sam:3,maya:8,dev:4,priya:6,luis:2,kat:5,ben:2,noor:7,theo:1};
const finalIn=()=>SHOWSTATE.res==='final';
// results-in means "something to reveal" only once early results exist
resultsIn=()=>SHOWSTATE.phase==='after'&&!revealed5()&&SHOWSTATE.res!=='waiting';
const waiting=()=>SHOWSTATE.phase==='after'&&SHOWSTATE.res==='waiting';
const lineupDelta=n=>finalIn()?(EP5.lineup[n]||0):(EP5.soFar[n]||0);
standing=function(g){const rows=_std(g);if(!revealed5())return rows;
  if(g==='lineup')return rows.map(r=>({...r,t:LINEUP_PTS[r.n]+lineupDelta(r.n),w:lineupDelta(r.n),prov:!finalIn()})).sort((a,b)=>b.t-a.t);
  if(g==='pool')return rows.map(r=>({...r,t:EP5.poolOut[r.n]?0:r.t+1})).sort((a,b)=>b.t-a.t);
  return rows};

// ---------- Tonight's after block, by stage ----------
const _after=afterBlock;
afterBlock=function(s){
  if(waiting())return `<section class="blk"><div class="wait"><span class="pulse"></span><div><b class="cap">Waiting for results</b><small>They usually start 30 to 60 minutes after the episode. We'll ping you. Nothing is spoiled in the meantime.</small></div></div>
    ${isCommish()?`<button class="job bs" data-job="whoout"><span class="ic">${svg('key')}</span><span class="tx"><span class="kind cap">Backstage · you run this</span><b>Who went home?</b><small>Tap one name and Survival Pool and Outlast settle now</small></span><span class="st">Tap</span>${svg('chev')}</button>`:''}
    <div class="stagebar">${stageBar()}</div></section>`;
  if(!revealed5())return _after(s).replace('<b class="cap">Results are in</b>','<b class="cap">Early results are in</b>').replace('Watched it? Reveal for every game at once. Nothing shows until then.','Who went home, Survival Pool and Outlast. Weekly Lineup points land tomorrow morning.')+`<div class="blk"><div class="stagebar">${stageBar()}</div></div>`;
  let h=_after(s);
  const lu=lineupDelta('alex'),rank=standing('lineup').findIndex(r=>r.n==='alex')+1;
  h=h.replace(/<span class="cap">Your night<\/span><b class="num">\+\d+<\/b>/,`<span class="cap">Your night</span><b class="num">+${lu}${finalIn()?'':'<em> so far</em>'}</b>`)
     .replace(/<b>Up to 1st<\/b><small>[^<]*<\/small>/,finalIn()?`<b>Up to 1st</b><small>Kristin +9 · Brady +3 · Mike +2 · final</small>`:`<b class="prov">+${lu} so far</b><small>Reward and immunity counted · full scores tomorrow morning</small>`);
  const top=finalIn()&&!SHOWSTATE.finalSeen?`<button class="morning" data-job="final"><span class="tg cap">Morning update</span><span class="ctx"><b>Final scores are in</b><small>Weekly Lineup +22 · you moved up to ${ordinal(rank)}</small></span>${svg('chev')}</button>`:'';
  return top+h+`<div class="blk"><div class="stagebar">${stageBar()}</div></div>`};
function stageBar(){const st=SHOWSTATE.res,steps=[['waiting','Aired','8:05 PM'],['early','Early results','~9:00 PM · who went home'],['final','Final scores','Tomorrow morning · every point']];const idx=steps.findIndex(x=>x[0]===st);
  return `<span class="cap lbl">Episode 5 results</span><div class="steps">${steps.map(([k,t,d],i)=>`<button data-res="${k}" class="${i<=idx?'on':''}${i===idx?' cur':''}"><i></i><b>${t}</b><small>${d}</small></button>`).join('')}</div><small class="muted mockhint">Mock: tap a stage to jump the clock</small>`}

// ---------- dock by stage ----------
const _dock2=dockHTML;
dockHTML=function(s){if(N===1||s.id!=='surv'||SHOWSTATE.tab==='chat')return '';
  if(waiting())return `<div class="dock locked"><span class="eyeic" style="background:var(--raised)">${svg('cal')}</span><span class="tx"><b>Episode 5 just aired</b><small>Early results ~9:00 PM · we'll ping you</small></span></div>`;
  if(resultsIn())return _dock2(s).replace('Episode 5 results are in','Early results are in').replace('Everything stays hidden until you reveal','Who went home · Pool · Outlast');
  if(revealed5()&&finalIn()&&!SHOWSTATE.finalSeen)return `<button class="dock need" id="dockFinal"><span class="eyeic" style="background:var(--ink);color:var(--chyron)">${svg('cup')}</span><span class="tx"><b>Final scores are in</b><small>Weekly Lineup +22 · up to 1st</small></span><span class="dbtn">See</span></button>`;
  return _dock2(s)};

// ---------- the reveal: early results show the lineup as provisional ----------
const _rp=revealPlay;
revealPlay=function(s){_rp(s);const r=document.querySelector('.revealfs.v2');if(!r||finalIn())return;
  // swap the lineup beat's total for a provisional one, and keep the lineup table out of the move
  const fix=()=>{const big=r.querySelector('.rb .big');if(big&&!big.dataset.p){big.dataset.p=1;big.innerHTML=`+${EP5.soFar.alex}<small class="soFar">so far · final scores tomorrow morning</small>`}
    const t=r.querySelector('.rb .tally');if(t&&!t.dataset.p){t.dataset.p=1;t.querySelectorAll('.tli').forEach((x,i)=>{if(i>1){x.classList.add('pending');x.querySelector('.num').textContent='…'}})}
    const mv=r.querySelector('#mvl');if(mv&&!mv.dataset.p){mv.dataset.p=1;mv.previousElementSibling.textContent='Survival Pool streaks';mv.innerHTML=[['alex',4],['maya',4],['priya',3],['riley',0]].map(([n,v],i)=>`<div class="mvr${n==='alex'?' me':''}" data-pn="${n}" style="transform:translateY(${i*54}px)"><span class="num r">${i+1}</span>${av(n,28)}<b>${n}${n==='riley'?' <small style="color:var(--live)">streak ended</small>':''}</b><span class="num t">${v}</span></div>`).join('');const nt=r.querySelector('#mvnote');if(nt)nt.textContent='Weekly Lineup moves when final scores land tomorrow morning.'}};
  new MutationObserver(fix).observe(r,{subtree:true,childList:true});fix()};
function finalUpdate(s){SHOWSTATE.finalSeen=true;const rows=standing('lineup').slice(0,4);
  openSheet('Final scores','Episode 5 · Weekly Lineup · the full recap is in',
    `<div class="fdelta"><span>So far last night</span><b class="num">+${EP5.soFar.alex}</b><span>${svg('chev')}</span><span>Final</span><b class="num yel">+${EP5.lineup.alex}</b></div>
     <p class="muted small" style="margin:10px 0 14px">Added this morning: Kristin found an idol clue (+4), Brady voted with the majority (+2), Kristin's individual reward (+2).</p>
     ${rows.map((r,i)=>`<div class="srow${r.n==='alex'?' me':''}"><span class="r num">${i+1}</span>${av(r.n,26)}${r.n}<span class="t num">${r.t}</span></div>`).join('')}`,()=>{route()})}
function whoOutSheet(){openSheet('Who went home?','Episode 5 · settles Survival Pool and Outlast right away',`<div class="cast4">${S51.cast.filter(c=>!c.exitEp).map(c=>`<button class="tile" data-o="${first(c.name)}"><img src="${ph(c)}" alt=""><span class="tick">${svg('check')}</span><div class="cap">${first(c.name)}</div></button>`).join('')}</div><button class="btn pri wide" id="wo" style="margin-top:14px" disabled>Pick who left</button><p class="muted small" style="margin-top:8px;text-align:center">Players still choose when to reveal. Weekly Lineup waits for the full results.</p>`,
  b=>{let o=null;b.querySelectorAll('[data-o]').forEach(t=>t.onclick=()=>{o=t.dataset.o;b.querySelectorAll('[data-o]').forEach(x=>x.classList.toggle('sel',x===t));$('wo').disabled=false;$('wo').textContent=`${o} went home`});
    $('wo').onclick=()=>{EP5.out=o;SHOWSTATE.res='early';closeSheet();toast(`Survival Pool and Outlast settled. Players can reveal now.`);route()}})}
