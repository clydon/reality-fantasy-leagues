// ================= refinements from the full-mock critique (picked by the user 2026-10-23) =================
// The five recommended options, now the design (critique-options.html shows how they were picked):
//   1. The hub: "Grows with you" for a new member's first week (or a brand-new couch), then "Focus first": a one-line
//      status, Up next with a calm time, Your shows, the guide (rolls only once you reach it), the feed, and the rest
//      of the couch (rankings, Commercial break, By the numbers, verdicts, recaps, trophies) as one "More on the couch"
//      list, one tap each.
//   2. Tonight: the phase is a heading from the clock, not a control; "Needs you" plates (one yellow) for required moves,
//      done ones as quiet rows, "Extras this week" with no counts, the commissioner's job on its own line; no dock on
//      Tonight before the episode, and never a second Reveal / Final scores button beside the plate.
//   3. Yellow means "you need to do it": optional actions are outlines, Weekly Lineup is Lake blue, tribes never fill.
//   4. One spoiler chip everywhere: "Spoiler-safe · you're on Ep N · Change". "Live" stops being a spoiler word.
//   5. A commissioner stays spoiler-safe: Quick check's result is hidden until they choose; "Confirm without looking".
//   Plus calm clocks: more than a day out reads "Wed 8:05 PM · in 5 days"; seconds tick only inside the last day.
// ?orig=1 skips all of it (the comparison page's "Original" phones); ?opt= skips it too (the options apply to the
// original). Loads after community.js and before critique-options.js / nav.js, and re-renders once at load.
{const RQ=new URLSearchParams(location.search);
if(!RQ.has('orig')&&!RQ.get('opt')){document.documentElement.dataset.refine='1';
const el=h=>{const d=document.createElement('div');d.innerHTML=h.trim();return d.firstElementChild};
const dayDiff=t=>{const a=new Date();a.setHours(0,0,0,0);const b=new Date(t);b.setHours(0,0,0,0);return Math.round((b-a)/864e5)};
const calm=t=>{const d=dayDiff(t);return d>1?`in ${d} days`:d===1?'tomorrow':'today'};
const calmWhen=t=>`${fmtT(t)} · ${calm(t)}`;

// ---------- calm clocks: a countdown more than a day away reads as days ----------
const calmCd=root=>(root.querySelectorAll?root:document).querySelectorAll('[data-cd]').forEach(x=>{const t=+x.dataset.cd;if(t-Date.now()>864e5){x.dataset.cdcalm=t;x.removeAttribute('data-cd');x.textContent=calm(t)}});
new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1){if(n.dataset&&n.dataset.cd)calmCd(n.parentNode||n);else calmCd(n)}}))).observe(document.body,{childList:true,subtree:true});
setInterval(()=>document.querySelectorAll('[data-cdcalm]').forEach(x=>{const t=+x.dataset.cdcalm;if(t-Date.now()<=864e5){x.dataset.cd=t;x.removeAttribute('data-cdcalm')}else x.textContent=calm(t)}),60000);
const heroHTMLR=heroHTML;
heroHTML=function(a){const s=SHOWS.find(x=>x.id===sel);let h=heroHTMLR(a);if(N===12)h=h.replace(/(\d+ of \d+) (?:lineups set|have picked)/,'$1 set');if(!s)return h;const t=nextAir(s.air);
  return t-Date.now()>864e5?h.replace(/<div class="cd" id="cd"[\s\S]*?<\/div>\s*(?=<button class="todo")/,`<div class="r-when cap">${calmWhen(t)}</div>`):h};

// ---------- 1. the hub ----------
const isNew=()=>!!(state.fresh||state.newMember||RQ.get('member')==='new');
const nextDue=()=>{const s=SHOWS.find(x=>x.id==='surv'),tr=SHOWS.find(x=>x.id==='trt');
  if(s&&s.kinds&&!state.lineup)return ['your Survivor lineup locks',nextAir(s.air),'#/show/surv/tonight'];
  if(tr&&!state.banish)return ['your Traitors pick closes',nextAir(tr.air),'#/show/trt/tonight'];return null};
const secBy=t=>[...app.querySelectorAll('section.sec')].find(x=>(x.querySelector('h2')?.textContent||'').trim().toLowerCase().startsWith(t.toLowerCase()));
const wireHubR=wireHub;
wireHub=function(){wireHubR();if(N===1)return;
  const top=app.querySelector('.top'),hero=$('heroWrap'),now=app.querySelector('.hn-now'),gh=app.querySelector('.guide-h'),reelEl=$('reel'),gf=app.querySelector('.guide-f'),
    rh=app.querySelector('.b-rail-h'),rail=$('bRail'),yours=secBy('Your shows'),go=[...app.querySelectorAll('section.sec')].find(x=>x.querySelector('.f-go')),prev=secBy('Previously on'),verd=secBy('Couch verdicts'),
    watching=secBy('The couch is watching'),feed=secBy('On the couch'),cb=secBy('Commercial break'),nums=$('supSec'),troph=secBy('Trophy shelf'),nudge=app.querySelector('.w-nudge')?.closest('section'),foot=app.querySelector('.foot');
  const rank=[...app.children].find(c=>c.tagName==='DIV'&&!c.className&&c.id!=='heroWrap');
  const due=nextDue(),n=dueCount();
  const status=el(`<button class="r-status" id="rStatus">${due&&n?`<span class="r-dot"></span><span><b>${n} ${n===1?'move':'moves'} due</b> · ${due[0]} ${fmtT(due[1])}</span>`:`<span class="r-dot ok"></span><span><b>You're all set</b> · nothing due this week</span>`}${svg('chev')}</button>`);
  status.onclick=()=>{if(due)location.hash=due[2]};
  // the guide rolls once you reach it, not while it's the first thing you see
  reel.paused=true;reel.idle=1e15;const st=$('rolling');if(st){st.classList.add('paused');st.lastChild.textContent='Paused'}
  if(reelEl&&'IntersectionObserver' in window){const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting&&reel.idle===1e15){reel.paused=false;reel.idle=0;if(st){st.classList.remove('paused');st.lastChild.textContent='Rolling'}io.disconnect()}}),{threshold:.6});io.observe(reelEl)}
  if(isNew()){const grow=el(`<section class="sec"><div class="r-grow"><b class="cap">More shows up as the couch plays</b><ul><li>${svg('cup')}Power rankings, after your first scored episode</li><li>${svg('poll')}By the numbers, once the stats come in</li><li>${svg('crown')}The trophy shelf, when a season ends</li></ul></div></section>`);
    app.replaceChildren(...[top,status,go,hero,yours,gh,reelEl,gf,feed,grow,foot].filter(Boolean));return}
  const more=el(`<section class="sec"><div class="sh"><h2 class="cap">More on the couch</h2><span class="aside">When you want it</span></div><div class="r-more"></div></section>`),list=more.querySelector('.r-more');
  [['rank','cup','Power rankings','Where everyone stands this year',rank],['games','bolt','Commercial break','Every game on the couch · join any',cb],['numbers','poll','By the numbers','Cast stats and couch accolades',nums],['verdicts','star','Couch verdicts','How the couch rated each episode',verd],['recaps','tv','Previously on','Spoiler-safe recaps',prev],['trophies','crown','Trophy shelf','Every season the couch has finished',troph]].forEach(([k,ic,tt,d,node])=>{if(!node)return;
    const r=el(`<button class="row" data-more="${k}"><span class="ic">${svg(ic)}</span><span class="tx"><b>${tt}</b><small>${d}</small></span>${svg('chev')}</button>`);list.appendChild(r);node.remove();
    r.onclick=()=>openPage(tt,'<div class="r-holder"></div>',pg=>pg.querySelector('.r-holder').appendChild(node),{back:'Home'})});
  app.replaceChildren(...[top,status,hero,now,yours,nudge,gh,reelEl,gf,rh,rail,watching,feed,more,foot].filter(Boolean))};

// ---------- 2. Tonight ----------
const REQ=['lineup','waivers','pool','banish'],EXTRA=['predict','bingo'];
const phaseHead=s=>{const p=SHOWSTATE.phase,t=nextAir(s.air);
  return p==='during'?`<div class="r-phase"><b class="cap"><i class="dotlive"></i>On air · Episode ${s.ep}</b><span>Locked at ${clock(t)}</span></div>`
    :p==='after'?`<div class="r-phase"><b class="cap">Episode ${s.ep}</b><span>${SHOWSTATE.res==='waiting'?'Just aired':'Results'}</span></div>`
    :`<div class="r-phase"><b class="cap">Episode ${s.ep}</b><span>${calmWhen(t)}</span></div>`};
const tabTonightR=tabTonight;
tabTonight=function(s){const h=tabTonightR(s);if(N===1||!s.kinds)return h;const d=el(`<div>${h}</div>`);
  d.querySelector('.phase')?.replaceWith(el(phaseHead(s)));
  const before=[...d.querySelectorAll('section.blk')].find(x=>/^Before/i.test((x.querySelector('h2')?.textContent||'').trim()));
  if(before){const all=[...before.querySelectorAll('.job')].map(j=>({k:j.dataset.job,t:j.querySelector('b')?.textContent||'',d:j.querySelector('small')?.textContent||'',st:j.querySelector('.st')?.textContent||'',done:j.classList.contains('done')}));
    const req=all.filter(x=>REQ.includes(x.k)),open=req.filter(x=>!x.done),done=req.filter(x=>x.done),extras=all.filter(x=>EXTRA.includes(x.k)),commish=all.find(x=>x.k==='results'),t=nextAir(s.air);
    // your moves, one at a time (picked over the "Needs you" plates 2026-10-24): open moves first, one yellow button
    // on the first; finished ones stay at the end as done cards you can change; all done is one "You're set" card
    const ACT={lineup:'Set lineup',waivers:'Pick who comes in',pool:'Make my pick',banish:'Make my pick'};
    const cards=[...(open.length?[]:[`<div class="r-card set"><span class="r-n ok">${svg('check')}</span><b class="cap">You're set for Episode ${s.ep}</b><small>Change anything until ${fmtT(t)}</small></div>`]),
      ...open.map((x,i)=>`<div class="r-card"><span class="r-n num">${i+1}</span><b class="cap">${x.t}</b><small>${x.d}</small><button class="btn ${i?'out':'pri'} wide" data-job="${x.k}">${ACT[x.k]||'Open'}</button></div>`),
      ...done.map(x=>`<div class="r-card done"><span class="r-n ok">${svg('check')}</span><b class="cap">${x.t}</b><small>${x.d}</small><button class="btn out wide" data-job="${x.k}">Change</button></div>`)];
    before.replaceWith(el(`<div class="r-wrap"><section class="blk"><div class="sh"><h2 class="cap">Your moves</h2><span class="aside">${open.length?`${open.length} to do before ${DAY[t.getDay()]}`:'All done'}</span></div>
      <div class="r-cards" id="rCards">${cards.join('')}</div>${cards.length>1?`<div class="r-dots">${cards.map((_,i)=>`<i class="${i?'':'on'}"></i>`).join('')}</div>`:''}</section>
      ${extras.length?`<section class="blk"><div class="sh"><h2 class="cap">Extras this week</h2><span class="aside">Optional</span></div>${extras.map(x=>`<button class="row r-extra" data-job="${x.k}"><span class="tx"><b>${x.t}</b><small>${x.d}</small></span><span class="st">${x.st}</span>${svg('chev')}</button>`).join('')}</section>`:''}
      ${commish?`<section class="blk"><a class="row r-bs" href="#/show/${s.id}/backstage"><span class="ic">${svg('key')}</span><span class="tx"><b>You run this · ${commish.t}</b><small>${commish.d}</small></span>${svg('chev')}</a></section>`:''}</div>`))}
  return d.innerHTML};
const wireShowRf=wireShow;
wireShow=function(s){wireShowRf(s);const c=$('rCards');if(c)c.onscroll=()=>{const w=c.firstElementChild.offsetWidth+10,i=Math.round(c.scrollLeft/w);app.querySelectorAll('.r-dots i').forEach((d,j)=>d.classList.toggle('on',j===i))}};
const dockR=dockHTML;
dockHTML=function(s){if(SHOWSTATE.tab==='tonight'&&(SHOWSTATE.phase==='before'||resultsIn()||(typeof finalIn==='function'&&finalIn()&&!SHOWSTATE.finalSeen&&revealed5())))return '';return dockR(s)};

// ---------- 3. yellow means "you need to do it" ----------
GAMES.lineup.col='#5089c9';

// ---------- 4. one spoiler chip ----------
const chipText=(s,w)=>`<b>Spoiler-safe</b> · ${w?`you're on Ep ${w}`:'not started yet'}`;
const showRouteR=showRoute;
showRoute=function(sid,tab){showRouteR(sid,tab);const s=SHOWS.find(x=>x.id===sid);if(!s||location.hash.includes('/waivers'))return;oneChip(s)};
function oneChip(s){const w=s.id==='surv'?seen(s):(typeof whereOf==='function'?whereOf(s,'alex'):0)||0;
  app.querySelectorAll('.gd-chip span').forEach(x=>x.innerHTML=chipText(s,w));
  app.querySelectorAll('.where').forEach(x=>{if(x.dataset.r)return;x.dataset.r=1;const b=x.querySelector('button');x.classList.add('r-chip');x.innerHTML=`${svg('shield')}<span>${chipText(s,w)}</span>`;if(b){b.textContent='Change';x.appendChild(b)}});
  app.querySelectorAll('.sh .aside').forEach(a=>{if(/^Up to (Episode|where)/.test(a.textContent.trim()))a.textContent=''})}

// ---------- 5. the commissioner stays spoiler-safe: trusted results apply on their own (5B, 2026-10-24) ----------
// The bot's quick check (bot.gameyourshow.com) is trusted: when its sources agree, who went home applies itself and
// the commissioner sees nothing. Show me and Undo are there; sources that disagree wait for them instead.
let lookedAt=false,undone=false;
const bsResultsR=bsResults;
bsResults=function(s){const h=bsResultsR(s);if(lookedAt||undone||!BS.quick)return h;const d=el(`<div>${h}</div>`),f=d.querySelector('.qcheck .found'),row=d.querySelector('.qcheck .frow');
  if(f){f.outerHTML=`<div class="found r-hid"><span class="r-blur"><img src="${ph(S51C('Thien'))}" alt=""></span><div><span class="cap kind">Episode 5 · applied 8:41 PM</span><b>Applied on its own</b><small>3 sources agreed · nothing shown to you</small></div></div>`;
    if(row)row.outerHTML=`<div class="frow"><button class="btn out" id="rShow">Show me</button><button class="btn out" id="rUndo">Undo</button></div><p class="muted small" style="margin-top:8px">When the sources agree it applies itself, so your players can reveal and you can still watch it fresh. If they disagree, it waits for you.</p>`}
  return d.innerHTML};
const wireBSR=wireBS;
wireBS=function(sid,page){wireBSR(sid,page);const b=$('rShow');if(b)b.onclick=()=>{lookedAt=true;backstageRoute(sid,'results')};
  const u=$('rUndo');if(u)u.onclick=()=>{undone=true;toast('Undone · Episode 5 waits for you to confirm');backstageRoute(sid,'results')}};
const afterBlockR=afterBlock;
afterBlock=function(s){const h=afterBlockR(s);if(!isCommish()||!BS.quick||lookedAt||undone)return h;
  return h.replace(/<button class="job bs" data-job="whoout">[\s\S]*?<\/button>/,'')};

// ---------- add a show: search, suggestions as you type, and "Add it as a new show" (2026-10-24) ----------
addShowSheet=function(){
  const pool=()=>[...ADDABLE.map(([id,n,art,sub])=>({id,name:n,art,sub,on:id==='bd'||id==='ar'||state.added.has(id)})),...CATALOG.filter(c=>!ADDABLE.some(a=>a[0]===c.id)).map(c=>({id:c.id,name:c.name,sub:`${c.season} · ${c.net}`,c:c.c,on:state.added.has(c.id),ready:c.ready}))];
  openSheet('Add a show','Everything on TV. Playing is optional.',`<label class="search">${svg('search')}<input id="q" placeholder="Search or add a show" aria-label="Search or add a show" autocomplete="off"></label><div id="ag"></div>`,
  b=>{const q=$('q'),ag=$('ag');
    const paint=()=>{const t=q.value.trim(),lt=t.toLowerCase(),P=pool();
      if(!t){ag.innerHTML=`<div class="artgrid">${P.filter(p=>p.art).slice(0,6).map(p=>`<button class="artcard${p.on?' on':''}" data-add="${p.id}"><img src="${ART(p.art)}" alt=""><span class="chk">${svg(p.on?'check':'plus')}</span><b class="cap">${p.name}</b><small>${p.on?'On your list':p.sub}</small></button>`).join('')}</div>`}
      else{const hits=P.filter(p=>p.name.toLowerCase().includes(lt)).slice(0,6),exact=hits.some(p=>p.name.toLowerCase()===lt);
        ag.innerHTML=`${hits.map(p=>`<button class="srow2" data-add="${p.id}">${p.art?`<img class="th" src="${ART(p.art)}" alt="">`:`<span class="th" style="--c:${p.c||'#3a3548'}">${p.name[0]}</span>`}<span class="tx"><b>${p.name}</b><small>${p.sub}</small></span><span class="st ${p.on?'in':p.ready?'ready':'not'}">${p.on?'On your list':p.ready?'Ready':'Not a game yet'}</span></button>`).join('')}
          ${exact?'':`<button class="r-addnew" data-new="${t.replace(/"/g,'')}">${svg('plus')}<span><b>Add “${t}” as a new show</b><small>${hits.length?'Not one of these? ':''}We'll find its episodes and airtimes</small></span></button>`}`}
      ag.querySelectorAll('[data-add]').forEach(x=>x.onclick=()=>{const p=pool().find(y=>y.id===x.dataset.add);if(p.on)return toast(`${p.name} is already on your list`);state.added.add(p.id);toast(`${p.name} added to your shows`);if(p.id==='li')refreshShelf();paint()});
      ag.querySelectorAll('[data-new]').forEach(x=>x.onclick=()=>{const n=x.dataset.new;closeSheet();setTimeout(()=>openSheet(`Add ${n}?`,'A show nobody here has added yet',`<p class="muted" style="line-height:1.5;margin-bottom:12px">We'll look it up in TV listings for its episodes and airtimes, and ask where you are in it so nothing spoils. It isn't a game yet: anyone on the couch can make it one later.</p><button class="btn pri wide" id="rNewGo">Add to my shows</button>`,bb=>$('rNewGo').onclick=()=>{closeSheet();toast(`${n} added · not a game yet`)}),230)})};
    paint();q.oninput=paint;setTimeout(()=>q.focus(),300)})};

route()}}
