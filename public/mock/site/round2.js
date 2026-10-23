// ================= round 2: sign up, first run, solo, joining, couches =================
let FIRST={picked:new Set(['surv','bd']),where:{surv:4,bd:6,trt:3,chl:4,li:12}};
let COUCH='Couch Council';

// ---------- sign up ----------
function signupRoute(){N=0;syncMockLabel();
  app.innerHTML=`<div class="door"><div class="door-art">${['survivor','traitors','below-deck','challenge','love-island','drag-race'].map((a,i)=>`<img src="${ART(a)}" alt="" style="--i:${i}">`).join('')}</div>
  <div class="door-in"><div class="mark cap"><span class="o">Game</span><span class="w">Your</span><span class="o">Show</span></div>
    <h1 class="cap">Make an<br>account</h1><p class="muted">Free. Takes ten seconds. Next you'll pick what you watch.</p>
    <label class="fld"><span>Username</span><input id="su" value="alex" autocomplete="username"></label>
    <label class="fld"><span>Email</span><input id="se" type="email" placeholder="you@example.com" autocomplete="email"></label>
    <label class="fld"><span>Password</span><input id="sp" type="password" placeholder="At least 8 characters" autocomplete="new-password"></label>
    <button class="btn pri wide cap big" id="sgo">Create account</button>
    <div class="or"><span>or</span></div>
    <button class="btn out wide" id="scode">${svg('key')}I have an invite code</button>
    <p class="muted small" style="text-align:center;margin-top:14px">Already playing? <a href="#/hub" class="link">Sign in</a></p></div></div>`;
  $('sgo').onclick=()=>{const u=$('su').value.trim()||'alex';toast(`Welcome, ${u}`);location.hash='#/start'};
  $('scode').onclick=()=>location.hash='#/join/K7Q2XZ'}

// ---------- first run: pick shows, then where you are ----------
function startRoute(step){step=step||'1';
  const pool=[...SHOWS.map(s=>[s.id,s.name,s.art,s.season,s.hpos||s.pos]),['bb','Big Brother','big-brother','Season 27','50% 30%'],['dr','RuPaul\'s Drag Race','drag-race','Season 18','50% 30%'],['dw','Dancing with the Stars','dwts','Season 34','50% 30%']];
  if(step==='1'){app.innerHTML=`<div class="fr"><div class="fr-top"><a class="back" href="#/signup">${svg('chev')}</a><div class="steps3"><i class="on"></i><i></i><i></i></div><span class="muted small">1 of 3</span></div>
    <h1 class="cap">What are<br>you watching?</h1><p class="muted">Pick as many as you like. You can play them with friends, or just follow along.</p>
    <div class="frgrid">${pool.map(([id,n,a,se,pos])=>`<button class="frcard${FIRST.picked.has(id)?' on':''}" data-id="${id}"><img src="${ART(a)}" alt="" style="object-position:${pos}"><span class="chk">${svg('check')}</span><b class="cap">${n}</b><small>${se}</small></button>`).join('')}
      <button class="frcard blank" data-id="other"><span class="plusbox">${svg('plus')}</span><b class="cap">Something else</b><small>Any show at all</small></button></div>
    <div class="frfoot"><button class="btn pri wide cap big" id="fnext">Next · <span id="fcount">${FIRST.picked.size}</span> picked</button></div></div>`;
    app.querySelectorAll('[data-id]').forEach(c=>c.onclick=()=>{const id=c.dataset.id;if(id==='other')return toast('Search any show on the next screen (mock)');FIRST.picked.has(id)?FIRST.picked.delete(id):FIRST.picked.add(id);c.classList.toggle('on');$('fcount').textContent=FIRST.picked.size;$('fnext').disabled=!FIRST.picked.size});
    $('fnext').onclick=()=>location.hash='#/start/2';return}
  if(step==='2'){const ids=[...FIRST.picked].filter(id=>SHOWS.find(s=>s.id===id));
    app.innerHTML=`<div class="fr"><div class="fr-top"><a class="back" href="#/start/1">${svg('chev')}</a><div class="steps3"><i class="on"></i><i class="on"></i><i></i></div><span class="muted small">2 of 3</span></div>
    <h1 class="cap">Where are<br>you in them?</h1><p class="muted">We only ever show what you've seen. No spoilers, ever.</p>
    ${ids.map(id=>{const s=SHOWS.find(x=>x.id===id),aired=s.aired||s.ep-1;return `<div class="wrow"><img src="${ART(s.art)}" alt="" style="object-position:${s.hpos||s.pos}"><div class="tx"><b class="cap">${s.name}</b><small id="wl-${id}">${whereLabel(id,aired)}</small></div>
      <div class="stepper"><button data-w="${id}" data-d="-1" aria-label="Earlier">−</button><b class="num" id="wn-${id}">${FIRST.where[id]}</b><button data-w="${id}" data-d="1" aria-label="Later">+</button></div></div>`}).join('')}
    <div class="frfoot"><button class="btn pri wide cap big" id="fnext">Next</button></div></div>`;
    app.querySelectorAll('[data-w]').forEach(b=>b.onclick=()=>{const id=b.dataset.w,s=SHOWS.find(x=>x.id===id),aired=s.aired||s.ep-1;FIRST.where[id]=Math.max(0,Math.min(aired,FIRST.where[id]+ +b.dataset.d));$('wn-'+id).textContent=FIRST.where[id];$('wl-'+id).textContent=whereLabel(id,aired)});
    $('fnext').onclick=()=>location.hash='#/start/3';return}
  app.innerHTML=`<div class="fr"><div class="fr-top"><a class="back" href="#/start/2">${svg('chev')}</a><div class="steps3"><i class="on"></i><i class="on"></i><i class="on"></i></div><span class="muted small">3 of 3</span></div>
    <h1 class="cap">Bring your<br>people?</h1><p class="muted">Games are better with friends. A couch is your group: everyone you play every show with.</p>
    <button class="choicebig" id="fcouch"><span class="ic">${svg('people')}</span><span><b>Start a couch</b><small>Name it, get a code, send it to your group</small></span></button>
    <button class="choicebig" id="fjoin"><span class="ic">${svg('key')}</span><span><b>Join a friend's couch</b><small>Got a code? Pull up a seat</small></span></button>
    <button class="choicebig quiet" id="fsolo"><span class="ic">${svg('tv')}</span><span><b>Just me for now</b><small>Follow your shows, rate episodes, watch along. Invite anyone later.</small></span></button></div>`;
  $('fsolo').onclick=()=>{N=1;state.solo=true;location.hash='#/hub'};$('fjoin').onclick=()=>location.hash='#/join/K7Q2XZ';
  $('fcouch').onclick=()=>newCouchSheet(()=>{N=1;state.solo=true;state.couchMade=true;location.hash='#/hub'})}
function whereLabel(id,aired){const w=FIRST.where[id];return w===0?'Haven\'t started':w>=aired?`Live · caught up through Episode ${aired}`:`Seen through Episode ${w} of ${aired}`}
function newCouchSheet(done){openSheet('Start a couch','Your group, for every show you play together',
  `<label class="fld"><span>Name it</span><input id="cn" value="Couch Council"></label><p class="label cap">Your invite code</p><div class="code"><b class="num">K7Q2XZ</b><button id="cc">${svg('copy')}</button></div>
   <p class="muted small" style="margin-top:10px;line-height:1.45">Anyone with the code joins the couch. Each game decides who can play: open to everyone, or ask first.</p>
   <button class="btn pri wide" id="cgo" style="margin-top:14px">Create couch</button>`,
  b=>{$('cc').onclick=()=>toast('Invite code copied');$('cgo').onclick=()=>{COUCH=$('cn').value||'Couch Council';closeSheet();toast(`${COUCH} is ready. Send the code!`);done&&setTimeout(done,300)}})}

// ---------- solo hub ----------
function soloHub(){const mineIds=[...FIRST.picked].filter(id=>SHOWS.find(s=>s.id===id));window.GUIDE_ONLY=mineIds;if(!mineIds.includes(sel))sel=mineIds[0]||'surv';
  const shows=mineIds.map(id=>SHOWS.find(s=>s.id===id));
  return `<div class="top"><a class="mark cap" href="#/hub"><span class="o">Game</span><span class="w">Your</span><span class="o">Show</span></a><div class="me"><button class="iconbtn" id="meBtn">${av('alex',34)}</button></div></div>
  <p class="hello"><strong>Welcome, alex.</strong> Your shows, spoiler-safe, ready when you are.</p>
  <button class="invitecard" id="soloInv"><span class="seats">${[0,1,2].map(i=>`<i>${i?'+':av('alex',30)}</i>`).join('')}</span><span class="tx"><b>${state.couchMade?`${COUCH} · just you so far`:'Watching solo'}</b><small>${state.couchMade?'Send K7Q2XZ to your group':'Start a couch and play these with friends'}</small></span>${svg('chev')}</button>
  <div class="guide-h"><h2 class="cap">This week</h2><span class="rolling" id="rolling"><i></i><span>Rolling</span></span></div>
  <div class="reel" id="reel">${guideDays()}${guideDays(true)}</div>
  <div class="guide-f"><span>Only your shows</span><button id="addShow2">${svg('plus')}Add a show</button></div>
  <section class="sec"><div class="sh"><h2 class="cap">Your shows</h2><span class="aside">Tap to open</span></div>
    <div class="shelf" id="shelf">${shows.map(s=>`<div class="poster"><a class="face front" href="#/show/${s.id}/tonight"><img src="${ART(s.art)}" alt="" style="object-position:${s.pos}"><span class="badge cap ex">${FIRST.where[s.id]>=(s.aired||s.ep-1)?'Live':'On Ep '+FIRST.where[s.id]}</span><span class="ttl cap">${s.name.replace('The ','')}</span><span class="sn">${s.season} · ${DAY[s.air[0]]}</span></a></div>`).join('')}<div class="poster add"><button class="face front" id="addShow"><span class="plusbox">${svg('plus')}</span><strong class="cap">Add a show</strong></button></div></div></section>
  <section class="sec"><div class="sh"><h2 class="cap">On your own</h2></div>
    <div class="minis">
      <button class="mini" data-solo="wa"><span class="pic"><img src="${ART(shows[0]?.art||'survivor')}" alt=""><span class="badge" style="background:var(--good)">${svg('tv')}</span></span><span class="b"><strong>Watch along</strong><small>Pause, rewind, react, rate it after</small></span></button>
      <button class="mini" data-solo="trivia"><span class="pic"><img src="${ART('survivor')}" alt="" style="object-position:20% 50%"><span class="badge" style="background:var(--chyron)">${svg('quiz')}</span></span><span class="b"><strong>Survivor 49 trivia</strong><small>3 questions from the real season</small></span></button>
      <button class="mini" data-solo="cast"><span class="pic"><img src="${ART(shows[0]?.art||'survivor')}" alt="" style="object-position:70% 30%"><span class="badge" style="background:#8f84d8">${svg('people')}</span></span><span class="b"><strong>Who's scoring</strong><small>The cast, ranked up to your episode</small></span></button>
    </div></section>
  <section class="sec"><div class="sh"><h2 class="cap">Better with friends</h2></div>
    <div class="gamesx">${Object.entries(GAMES).map(([k,G])=>`<button class="gx" data-g="${k}" style="--g:${G.col}"><b class="cap">${G.name}</b><small>${G.line}</small></button>`).join('')}</div>
    <button class="btn pri wide" id="soloStart" style="margin:14px 16px 0;width:calc(100% - 32px)">Start a couch</button></section>`}
function wireSolo(){$('meBtn').onclick=profileSheet;$('soloInv').onclick=()=>state.couchMade?couchSheet():newCouchSheet(()=>route());$('soloStart').onclick=()=>newCouchSheet(()=>{state.couchMade=true;route()});
  $('addShow').onclick=$('addShow2').onclick=addShowSheet;startReel();
  app.querySelectorAll('.lst').forEach(b=>b.onclick=()=>{if(UI.dragged)return;episodeSheet(b.dataset.show,b.dataset.ep,b.dataset.at)});
  app.querySelectorAll('[data-solo]').forEach(b=>b.onclick=()=>({wa:()=>openWatch(sel),trivia:triviaSheet,cast:()=>location.hash=`#/show/${sel}/cast`})[b.dataset.solo]());
  app.querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>rulesSheet(b.dataset.g));app.querySelectorAll('.shelf').forEach(hscroll)}

// ---------- joining a couch from an invite ----------
function joinRoute(code){const s=SHOWS[0];N=4;syncMockLabel();
  const G=[['pool','Shared','open','Anyone can join. Catch up on what you missed, or start from Episode 5.'],['lineup','Exclusive','ask','Players own their castaways, so riley lets new players in.'],['outlast','Exclusive','locked','Locked down for the season by riley (competitive).']];
  app.innerHTML=`<div class="join"><div class="join-hero"><img src="${ART(s.art)}" alt="" style="object-position:100% 40%"><div class="mark cap"><span class="o">Game</span><span class="w">Your</span><span class="o">Show</span></div>
    <span class="tg cap">Invite · ${code}</span><h1 class="cap">riley saved<br>you a seat</h1><div class="sbar-couch"><span class="stack">${crowdOf().map(n=>av(n,26)).join('')}</span>Couch Council · 4 on the couch</div></div>
    <section class="blk"><p class="muted" style="font-size:15px;line-height:1.45">You're in the couch: its chat, its TV guide, its watch alongs. Each game decides who can play.</p></section>
    <section class="blk"><div class="sh"><h2 class="cap">Survivor 51 games</h2><span class="aside">Episode 5 is next</span></div>
      ${G.map(([g,own,mode,d])=>`<div class="jg" style="--g:${GAMES[g].col}"><div class="jgh"><span class="gdot" style="background:${GAMES[g].col}"></span><b class="cap">${GAMES[g].name}</b><span class="own">${own}</span></div><p>${d}</p>
        ${mode==='open'?`<button class="btn pri" data-join="${g}">Join</button>`:mode==='ask'?`<button class="btn out" data-ask="${g}">Ask to join</button>`:`<button class="btn" disabled>${svg('key')}Locked</button>`}</div>`).join('')}</section>
    <div class="blk"><button class="btn ink wide" id="jgo">Go to Survivor 51</button></div><div style="height:40px"></div></div>`;
  app.querySelectorAll('[data-ask]').forEach(b=>b.onclick=()=>{b.textContent='Asked · riley will see it';b.disabled=true;toast('Request sent to riley')});
  app.querySelectorAll('[data-join]').forEach(b=>b.onclick=()=>catchupSheet(b));
  $('jgo').onclick=()=>{state.solo=false;location.hash='#/show/surv/tonight'}}
function catchupSheet(btn){openSheet('Join Survival Pool','Episodes 1 to 4 have aired. How do you want to start?',
  `<button class="choicebig" data-c="now"><span class="ic">${svg('play')}</span><span><b>Start from Episode 5</b><small>Make your first pick now. Your streak starts this week.</small></span></button>
   <button class="choicebig" data-c="replay"><span class="ic">${svg('repeat')}</span><span><b>Catch up from Episode 1</b><small>Pick for each episode you've missed, then reveal it, one at a time. Spoiler-free, on your schedule.</small></span></button>
   <p class="muted small" style="line-height:1.45;margin-top:10px">Catching up runs on the honor system: pick before you've seen it. It's for fun; nobody's checking.</p>`,
  b=>b.querySelectorAll('[data-c]').forEach(x=>x.onclick=()=>{const c=x.dataset.c;closeSheet();btn.textContent=c==='now'?'Joined':'Joined · catching up';btn.disabled=true;if(c==='replay')SHOWSTATE.catchup={ep:1,of:4};toast(c==='now'?'You\'re in. Pick before Wednesday.':'You\'re in. Catch-up starts at Episode 1.')}))}

// ---------- couch switcher ----------
function couchSwitch(){openSheet('Your couches','The hub shows one couch at a time',
  `${[['Couch Council','Survivor 51 · Traitors 5 · 4 people',['alex','riley','jordan','sam']],['Work Crew','The Traitors 5 · 12 people',['alex','maya','dev','priya']]].map(([n,d,p])=>`<button class="row cswitch${n===COUCH?' cur':''}" data-c="${n}"><span class="stack">${p.slice(0,3).map(x=>av(x,26)).join('')}</span><span class="tx"><b>${n}</b><small>${d}</small></span>${n===COUCH?svg('check'):svg('chev')}</button>`).join('')}
   <button class="row" data-c="details"><span class="ic">${svg('people')}</span><span class="tx"><b>${COUCH} details</b><small>Members, invite code, seasons together</small></span></button>
   <button class="btn out wide" id="nc" style="margin-top:12px">${svg('plus')}Start a new couch</button>`,
  b=>{b.querySelectorAll('[data-c]').forEach(x=>x.onclick=()=>{const c=x.dataset.c;closeSheet();if(c==='details')return setTimeout(couchSheet,250);if(c===COUCH)return;COUCH=c;N=c==='Work Crew'?12:4;syncMockLabel();toast(`Switched to ${c}`);route()});$('nc').onclick=()=>{closeSheet();setTimeout(()=>newCouchSheet(),250)}})}

// ---------- catch-up strip on the show ----------
function catchupStrip(){const c=SHOWSTATE.catchup;if(!c)return '';return `<button class="catchup" id="cu"><span class="tg cap">Catching up</span><span class="ctx"><b>Episode ${c.ep} of ${c.of}</b><small>Pick, watch it, then reveal · Survival Pool</small></span><span class="cubar">${Array.from({length:c.of},(_,i)=>`<i class="${i<c.ep-1?'on':i===c.ep-1?'now':''}"></i>`).join('')}</span></button>`}
function catchupStep(){const c=SHOWSTATE.catchup,cands=S51.cast.filter(x=>!x.exitEp||x.exitEp>c.ep).slice(0,8);
  openSheet(`Catch up · Episode ${c.ep}`,'Pick who survives, then reveal when you\'ve watched',`<div class="cast4">${cands.map(x=>`<button class="tile" data-p="${first(x.name)}"><img src="${ph(x)}" alt=""><span class="tick">${svg('check')}</span><div class="cap">${first(x.name)}</div></button>`).join('')}</div><button class="btn pri wide" id="cur" style="margin-top:14px" disabled>Pick someone</button>`,
  b=>{let p=null;b.querySelectorAll('[data-p]').forEach(t=>t.onclick=()=>{p=t.dataset.p;b.querySelectorAll('[data-p]').forEach(y=>y.classList.toggle('sel',y===t));$('cur').disabled=false;$('cur').textContent=`Lock ${p} and reveal Episode ${c.ep}`});
    $('cur').onclick=()=>{const out=S51.cast.filter(x=>x.exitEp===c.ep).map(x=>first(x.name)),ok=!out.includes(p);closeSheet();toast(`Episode ${c.ep}: ${out.join(' and ')||'nobody'} out. ${ok?`${p} survived!`:`${p} went home.`}`);c.ep++;if(c.ep>c.of){SHOWSTATE.catchup=null;toast('All caught up. Pick for Episode 5 with everyone.')}route()}})}

// ---------- backstage: who can join ----------
function joinRulesBlock(){const J=SHOWSTATE.join||(SHOWSTATE.join={pool:['shared','open'],lineup:['exclusive','ask'],outlast:['exclusive','locked']});
  return `<section class="blk"><div class="sh"><h2 class="cap">Joining</h2><span class="aside">Casual by default</span></div>
    ${SHOWSTATE.reqDone?'':`<div class="req"><span class="stack">${av('kat',30)}</span><span class="tx"><b>kat asked to join Weekly Lineup</b><small>New to the couch · 2 hours ago</small></span><button class="btn pri sm" data-req="ok">Let in</button><button class="btn out sm" data-req="no">${svg('x')}</button></div>`}
    ${Object.keys(GAMES).map(g=>{const [own,mode]=J[g];return `<div class="jrule"><div class="jgh"><span class="gdot" style="background:${GAMES[g].col}"></span><b>${GAMES[g].name}</b><span class="own">${own==='shared'?'Shared ownership':'Exclusive ownership'}</span></div>
      <div class="segm">${(own==='shared'?[['open','Anyone joins'],['ask','Ask me'],['locked','Locked']]:[['ask','Ask me'],['locked','Locked']]).map(([k,l])=>`<button class="${mode===k?'on':''}" data-jr="${g}:${k}">${l}</button>`).join('')}</div>
      <small>${own==='shared'?'Shared: everyone can own anyone, so late players can catch up on the honor system.':'Exclusive: castaways belong to one player, so you decide who joins. No catch-up.'}</small></div>`}).join('')}
    <div class="lockdown"><span class="tx"><b>Lock it down</b><small>Competitive mode: no late joins, no catch-up, rules frozen for the season</small></span><button class="switch${SHOWSTATE.locked?' on':''}" id="lockAll" aria-pressed="${!!SHOWSTATE.locked}"><i></i></button></div></section>`}
function wireJoinRules(sid){app.querySelectorAll('[data-jr]').forEach(b=>b.onclick=()=>{const [g,k]=b.dataset.jr.split(':');SHOWSTATE.join[g][1]=k;backstageRoute(sid)});
  app.querySelectorAll('[data-req]').forEach(b=>b.onclick=()=>{SHOWSTATE.reqDone=true;const r=b.closest('.req');r.style.opacity=0;setTimeout(()=>r.remove(),300);toast(b.dataset.req==='ok'?'kat is in Weekly Lineup. Draft them a roster from free agents.':'Request declined quietly')});
  const l=$('lockAll');if(l)l.onclick=()=>{SHOWSTATE.locked=!SHOWSTATE.locked;if(SHOWSTATE.locked)Object.keys(SHOWSTATE.join).forEach(g=>SHOWSTATE.join[g][1]='locked');toast(SHOWSTATE.locked?'Locked down for the season':'Back to casual');backstageRoute(sid)}}

function syncMockLabel(){const t=$('ctlT');if(t)t.textContent=`Mock · ${N===0?'new':N===1?'solo':N} ▾`;document.querySelectorAll('.ctl [data-n]').forEach(x=>x.classList.toggle('on',+x.dataset.n===N))}
