// ================= landing → first run → account: one clickable path in =================
// The signed-out front door (distilled from overdrive/landing.html for the phone), then first run in four
// steps: pick shows → where are you → save your shows (the account) → bring your people. Shows come first
// so a visitor gets value before any form. A show nobody has set up yet is followed straight away (rate it,
// watch along, chat) and only becomes a game later, when someone taps Make it one: onboarding never
// builds a show. Also: sign in, the Join with a code sheet, and the signed-out invite (account, then join).
state.signedOut=false;
FIRST.picked=new Set(['surv','bd']);FIRST.extra=[];
const LP={timers:[]};
const lpLive=()=>!!$('lp');
function lpEvery(fn,ms){const t=setInterval(()=>{if(!lpLive())return clearInterval(t);fn()},ms);LP.timers.push(t)}

// ---------- shows: the first-run wall and the search catalog (TV listings: every show exists) ----------
const FR_BASE=()=>[...SHOWS.map(s=>({id:s.id,name:s.name,art:s.art,season:s.season,pos:s.hpos||s.pos,aired:s.aired||s.ep-1,ready:!s.series})),
  {id:'bb',name:'Big Brother',art:'big-brother',season:'Season 27',pos:'50% 30%',aired:9,ready:true},
  {id:'dr',name:'RuPaul\'s Drag Race',art:'drag-race',season:'Season 18',pos:'50% 30%',aired:6,ready:true},
  {id:'dw',name:'Dancing with the Stars',art:'dwts',season:'Season 34',pos:'50% 30%',aired:5,ready:true}];
const CATALOG=[
  {id:'lib',name:'Love Is Blind',season:'Season 9',net:'Netflix',aired:4,c:'#c2457a'},
  {id:'ar',name:'The Amazing Race',season:'Season 38',net:'CBS',aired:5,c:'#d9a03a',ready:true},
  {id:'tc',name:'Top Chef',season:'Season 23',net:'Bravo',aired:7,c:'#4f8fc0'},
  {id:'bach',name:'The Bachelor',season:'Season 30',net:'ABC',aired:0,c:'#b2384f'},
  {id:'gbbo',name:'The Great British Bake Off',season:'Series 16',net:'Netflix',aired:6,c:'#d9704a'},
  {id:'rhslc',name:'Real Housewives of Salt Lake City',season:'Season 6',net:'Bravo',aired:3,c:'#8f84d8'},
  {id:'mafs',name:'Married at First Sight',season:'Season 19',net:'Lifetime',aired:8,c:'#e56b9f'},
  {id:'sqg',name:'Squid Game: The Challenge',season:'Season 2',net:'Netflix',aired:0,c:'#2f9c7a'}];
const frPool=()=>[...FR_BASE(),...FIRST.extra];
const frShow=id=>frPool().find(p=>p.id===id);
const frArt=(p,cls)=>p.art?`<img${cls?` class="${cls}"`:''} src="${ART(p.art)}" alt="" style="object-position:${p.pos||'50% 30%'}">`:`<span class="${cls||'ph0'}" style="--c:${p.c||'#3a3548'}">${p.name[0]}</span>`;
function frWhereLabel(p){const w=FIRST.where[p.id]||0;if(p.aired===0)return 'Premieres soon';if(w===0)return 'Haven\'t started';
  if(p.aired==null)return `Seen through Episode ${w}`;return w>=p.aired?`Live · caught up through Episode ${p.aired}`:`Seen through Episode ${w} of ${p.aired}`}
const steps4=n=>`<div class="steps3">${[1,2,3,4].map(i=>`<i class="${i<=n?'on':''}"></i>`).join('')}</div><span class="muted small">${n} of 4</span>`;

// ---------- the front door ----------
function welcomeRoute(){N=0;state.signedOut=true;syncMockLabel();
  const c51=n=>by(S51,n),tick=`<svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg>`,plus=`<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>`;
  const tro=`<svg viewBox="0 0 24 24">${ICON.cup}</svg>`,star=`<svg viewBox="0 0 24 24">${ICON.star}</svg>`;
  const team=['Savannah','Sophi','Jawan'].map(n=>by(S49,n)).filter(Boolean),st=['Brady','Maggie','Sharonda'].map(c51).filter(Boolean),pk=['Kristin','Maggie','Brady','Eric'].map(c51).filter(Boolean);
  const showLbl=s=>`${s.show.replace(/ \(US\)$/,'')} ${s.season}`;
  app.innerHTML=`<div class="lp" id="lp">
  <header class="lp-top" id="lpTop"><div class="mark cap" aria-label="Game Your Show"><span class="o">Game</span><span class="w">Your</span><span class="o">Show</span></div>
    <a class="lp-signin" href="#/signin">Sign in</a><button class="btn pri" data-lp="start">Start free</button></header>

  <section class="lp-hero" aria-labelledby="lpH1"><div class="lp-in">
    <span class="lp-tag cap">Free for your whole couch</span>
    <h1 id="lpH1" class="cap" aria-label="Turn any TV show into a game"><span class="ln" aria-hidden="true">Turn</span><span class="lp-roll" id="lpRoll" aria-hidden="true"><span>Survivor</span></span><span class="ln" aria-hidden="true">into a game.</span></h1>
    <p class="lp-lede">Draft the cast. Set a lineup. Call who goes home and play bingo while you watch. Then find out who on your couch <b>really</b> knows the show.</p>
    <div class="lp-ctas"><button class="btn pri wide" data-lp="start">Start free${svg('chev')}</button><button class="btn out wide" data-lp="code">Join with a code</button></div>
    <div class="lp-fine"><span>${tick}No credit card</span><span>${tick}No app store</span><span>${tick}Never spoiled</span></div></div>
    <div class="lp-wall" id="lpWall" aria-hidden="true"></div>
  </section>
  <div class="lp-ticker" aria-hidden="true"><div class="row" id="lpTicker"></div></div>

  <section class="lp-sec" aria-labelledby="lpHow"><div class="lp-in">
    <h2 id="lpHow" class="cap lp-h2 lp-up">Three taps to<br>episode night.</h2>
    <div class="lp-steps">
      <div class="lp-step lp-up"><span class="n num">1</span><h3 class="cap">Pick your shows</h3><p>Survivor, The Traitors and The Challenge come ready with the cast and scoring. Anything else, follow it now and make it a game when you like.</p>
        <div class="vis"><div class="lp-shows">${[['surv','Survivor','Season 51 · Wed','survivor','64% 50%'],['trt','The Traitors','Season 5 · Thu','traitors','74% 35%'],['chl','The Challenge','Season 37 · Tue','challenge','62% 30%']].map(([id,n,se,a,pos])=>`<button class="lp-show" data-pick="${id}"><img src="${ART(a)}" alt="" style="object-position:${pos}"><span class="go">${svg('plus')}</span><b class="cap">${n}</b><small>${se}</small></button>`).join('')}
          <button class="lp-show add" data-pick="any"><b class="cap" style="font-size:16px">+ Any show</b><small>Search them all</small></button></div>
          <div class="lp-hint">${svg('chev')}Tap one to start</div></div></div>
      <div class="lp-step lp-up"><span class="n num">2</span><h3 class="cap">Bring your couch</h3><p>Your couch is your people, for every show and every season. Send one code. Or just play solo and invite anyone later.</p>
        <div class="vis"><div class="lp-invite"><span class="lp-tag cap" style="font-size:11px">Invite</span><div><div class="code num">K7Q2XZ</div><small>Couch Council · Survivor 51</small></div></div>
          <div class="lp-seats">${[['Y','#45a89a','You'],['M','#a76bb0','Maya'],['D','#d9704a','Dev']].map(([a,c,n])=>`<span class="lp-seat"><i style="background:${c}">${a}</i>${n}</span>`).join('')}<span class="lp-seat empty"><i>+</i>Seat</span></div></div></div>
      <div class="lp-step lp-up"><span class="n num">3</span><h3 class="cap">Play every episode</h3><p>Set your moves before it airs. Results come in after, and nobody sees them until they tap Reveal.</p>
        <div class="vis"><div class="lp-tiles">${['Kristin','Mike','Brady'].map(c51).filter(Boolean).map(c=>`<div class="lp-tile"><img src="${ph(c)}" alt=""><div class="cap">${first(c.name)}</div><small>${c.tribeNow||c.tribe||''}</small></div>`).join('')}</div>
          <div class="lp-plate"><span class="t good cap">You</span><span class="b"><b class="cap">+12.5 last week</b><small>Tied for 1st on your couch</small></span></div></div></div>
    </div></div></section>

  <section class="lp-sec" aria-labelledby="lpPlay"><div class="lp-in">
    <h2 id="lpPlay" class="cap lp-h2 lp-up">Play it<br>your way.</h2>
    <p class="lp-lede lp-up">Run a whole season, or play one episode at a time. Every game works for any show, and you can run several on the same couch.</p>
    <div class="lp-reel" id="lpReel">
      <article class="lp-game" style="--g:${GAMES.outlast.col}"><span class="kind cap">Season game · draft</span><h3 class="cap">Outlast</h3><p>Draft a team. Your players score for every boot they outlast, so the last one standing carries you.</p>
        <div class="vis">${team.map(c=>{const out=c.exitEp&&c.exitEp<13;return `<div class="lp-team${out?' out':''}"><img src="${ph(c)}" alt=""><div class="pl"><b class="cap">${first(c.name)}</b><small>${out?`<span class="lp-chip" style="background:var(--live);color:var(--live-ink)">Out</span> Episode ${c.exitEp}`:`<span class="lp-chip" style="background:var(--chyron);color:var(--ink)">Finale</span> made it to the end`}</small></div></div>`}).join('')}</div></article>
      <article class="lp-game" style="--g:${GAMES.lineup.col}"><span class="kind cap">Season game · draft</span><h3 class="cap">Weekly Lineup</h3><p>Draft a roster, then start your best three before each episode airs. Only starters score.</p>
        <div class="vis"><div class="lp-tiles">${st.map(c=>`<div class="lp-tile"><img src="${ph(c)}" alt=""><div class="cap">${first(c.name)}</div><small>${c.total} pts</small></div>`).join('')}</div><div class="lp-plate"><span class="t cap">Lineup</span><span class="b"><b class="cap">Locks Wed 8:05 PM</b><small>Start 3 · bench 2</small></span></div></div></article>
      <article class="lp-game" style="--g:${GAMES.pool.col}"><span class="kind cap">Season game · no draft</span><h3 class="cap">Survival Pool</h3><p>Each episode, pick one person you think survives. Never the same one twice. Longest streak wins.</p>
        <div class="vis"><div class="lp-streak"><span class="num">4</span><span class="muted" style="padding-bottom:10px">in a row</span></div><div class="lp-picks">${pk.map((c,i)=>`<div class="lp-pick${i<3?'':' now'}"><img src="${ph(c)}" alt="">${i<3?'<b>✓</b>':''}</div>`).join('')}<div class="lp-pick nx">+</div></div></div></article>
    </div>
    <div class="lp-dots" id="lpDots"><i class="on"></i><i></i><i></i></div>
    <div class="lp-sub cap">And every episode</div>
    <div class="lp-eg">
      <div class="lp-egc lp-up"><span class="lp-tag cap" style="background:#e56b9f;font-size:11px">Predict</span><h4 class="cap">Who goes home?</h4><p>One-tap calls before it airs.</p><div class="vis lp-faces3">${['Thien','Carter','Danny'].map(c51).filter(Boolean).map((c,i)=>`<img class="${i===1?'on':''}" src="${ph(c)}" alt="">`).join('')}</div></div>
      <div class="lp-egc lp-up"><span class="lp-tag cap" style="font-size:11px">Bingo</span><h4 class="cap">A fresh card</h4><p>The show's clichés. First line wins.</p><div class="vis lp-bingo">${Array.from({length:25},(_,i)=>`<i class="${i===12?'f':[0,6,18,24,2,9].includes(i)?'m':''}"></i>`).join('')}</div></div>
      <div class="lp-egc lp-up"><span class="lp-tag cap good" style="font-size:11px">Watch along</span><h4 class="cap">In sync</h4><p>The couch's comments as you reach them.</p><div class="vis">${[['M','#a76bb0','Kristin is SO calm'],['D','#d9704a','that setup is brutal']].map(([a,c,x])=>`<div class="lp-cm"><span class="a" style="background:${c}">${a}</span><span>${x}</span></div>`).join('')}</div></div>
      <div class="lp-egc lp-up"><span class="lp-tag cap" style="background:#8f84d8;font-size:11px">Rate it</span><h4 class="cap">Two seconds</h4><p>After the credits. Then the couch verdict.</p><div class="vis"><div class="lp-stars">${star.repeat(4)}${star.replace('<svg','<svg class="o"')}</div><div style="margin-top:6px;font-size:12px;color:var(--muted)"><b class="num" style="color:var(--bone);font-size:20px">4.5</b> couch verdict</div></div></div>
    </div></div></section>

  <section class="lp-sec lp-couch" aria-labelledby="lpCouch"><div class="lp-in">
    <span class="lp-tag cap q lp-up">Your couch</span>
    <h2 id="lpCouch" class="cap lp-h2 lp-up">Same friends.<br>Every show.</h2>
    <p class="lp-lede lp-up">A league ends with the finale. <b>A couch doesn't.</b> It keeps your people and your history, and lines up everything you're all watching this week.</p>
    <div class="lp-sub cap">This week on the couch</div>
    <div class="lp-guide" id="lpGuide"></div>
    <div class="lp-wa lp-up"><div class="lp-waphone" aria-hidden="true"><div class="bar"><b class="cap">Survivor 51</b><small><i></i>Ep 5</small></div><div class="clk num" id="lpClk">21:40</div><div class="pb"><i id="lpPb"></i></div><div class="feed" id="lpFeed"></div></div>
      <div><span class="lp-tag cap live" style="font-size:11px">Watch along</span><h3 class="cap" style="margin-top:10px">The couch, even when it's not.</h3><p>Tap Start when your episode starts, live or streaming. What everyone said shows up <b>as you reach that moment</b>, never a second early.</p></div></div>
    <div class="lp-shelf lp-up">${[['gold','Survivor 49','Maya won'],['','Traitors 4','You won'],['','Survivor 52','Run it back']].map(([g,n,s])=>`<div class="lp-tro ${g}">${tro}<b class="cap">${n}</b><small>${s}</small></div>`).join('')}</div>
  </div></section>

  <section class="lp-sec" aria-labelledby="lpSpoil"><div class="lp-in">
    <span class="lp-tag cap good lp-up">Spoiler-safe</span>
    <h2 id="lpSpoil" class="cap lp-h2 lp-up">Watch Thursday.<br>Still win.</h2>
    <p class="lp-lede lp-up">Results arrive as a nudge, not a headline. <b>Nothing shows until you tap Reveal</b>: not the standings, not the chat, not your score.</p>
    <div class="lp-gate lp-up" id="lpGate">
      <div class="lock"><span class="lp-tag cap">Survivor 49 · Finale</span><h3 class="cap">Results are in</h3>
        <p class="muted" style="font-size:14px;line-height:1.5">13 episodes, 18 castaways, every point. Try it: this is a real season.</p>
        <div class="lp-ghost"></div><div class="lp-ghost s"></div><div class="lp-ghost"></div><div class="lp-ghost s"></div>
        <button class="btn pri wide" id="lpReveal" style="height:54px;font-size:17px;font-weight:800;margin-top:6px">Reveal Survivor 49</button></div>
      <div class="lp-race" aria-live="polite"><div class="lp-race-top"><span class="cap muted" style="font-size:13px">Top scorers, episode by episode</span><span class="num ep" id="lpRaceEp">EP 1</span></div>
        <svg id="lpRaceSvg" viewBox="0 0 360 250" role="img" aria-label="Cumulative points for Survivor 49's top scorers across 13 episodes"></svg><div class="lp-winner" id="lpWinner"></div></div>
    </div></div></section>

  <section class="lp-sec" aria-labelledby="lpAny"><div class="lp-in">
    <span class="lp-tag cap lp-up">Any show</span>
    <h2 id="lpAny" class="cap lp-h2 lp-up">Yes, that<br>one too.</h2>
    <p class="lp-lede lp-up">Follow any show from day one: rate episodes, watch along, chat. <b>When you want a game, one copy and paste</b> sets up the cast and the scoring.</p>
    <div class="lp-faces" id="lpFaces"></div>
    <div class="lp-facecap"><span>The Challenge 37, set up from one paste</span><b class="num">${CHL.cast.length}</b></div>
    <div class="lp-paste lp-up">
      <div class="lp-pst"><span class="n num">1</span><div><b>Copy our prompt</b><p>We write the research question for the show and season.</p></div></div>
      <div class="lp-pst"><span class="n num">2</span><div><b>Paste it into any AI chat</b><p>ChatGPT, Claude, Gemini: the free versions are plenty.</p></div></div>
      <div class="lp-pst"><span class="n num">3</span><div><b>Paste the answer back</b><p>The cast, the groups and the scoring, ready to check and draft.</p></div></div></div>
    <div class="lp-chips lp-up">${['Survivor','The Traitors','The Challenge'].map(n=>`<span class="ready">${n}</span>`).join('')}${['Big Brother','Love Island','Drag Race','The Amazing Race'].map(n=>`<span>${n}</span>`).join('')}${['Below Deck','Love Is Blind','Your show'].map(n=>`<span class="follow">${n}</span>`).join('')}</div>
    <p class="lp-key">White: ready, results filled in for you. Solid: set up by players. Dashed: follow now, make it a game anytime.</p>
  </div></section>

  <section class="lp-sec lp-free" aria-labelledby="lpFree"><div class="lp-in">
    <span class="lp-tag cap good lp-up">Free</span>
    <h2 id="lpFree" class="cap lp-h2 lp-up">Free.<br>All of it.</h2>
    <div class="lp-freelist lp-up">${['Every show, even yours','Every game type','Unlimited players','Unlimited couches','Chat, bingo, watch along','Spoiler protection'].map(t=>`<div>${tick}${t}</div>`).join('')}</div>
    <p class="lp-auto lp-up"><b>Optional Autopilot</b> fills in each episode's results for the commissioner the morning after. Same games either way; it only saves a few minutes a week.</p>
    <div class="lp-faq">${[['Is it really free?','Yes. Every show, every game type, every player. Nothing is locked behind Autopilot.'],['Which shows can I play?','Survivor, The Traitors and The Challenge are ready to go. Any other show you can follow right away, and turn into a game with one copy and paste.'],['What if I watch later?','Nothing gets spoiled. Results, standings and chat stay hidden for you until you tap Reveal.'],['Do I need an app?','No. It runs in your phone\'s browser, and you can add it to your home screen.']].map(([q,a])=>`<details><summary>${q}${plus}</summary><p>${a}</p></details>`).join('')}</div>
  </div></section>

  <section class="lp-final" aria-labelledby="lpFin"><div class="lp-in">
    <h2 id="lpFin" class="cap">Pick a show.<br>Make it<br>a game.</h2>
    <p>Two minutes, free, and the next episode is closer than you think.</p>
    <div class="lp-ctas"><button class="btn ink wide" data-lp="start">Start free${svg('chev')}</button><button class="btn out wide" data-lp="code">Join with a code</button></div></div></section>
  <footer class="lp-foot"><div class="mark cap"><span class="o">Game</span><span class="w">Your</span><span class="o">Show</span></div>
    <nav><a href="#/signin">Sign in</a><a href="#/welcome" data-lp="top">Back to top</a></nav>
    <p class="legal">Game Your Show is a fan-made game and is not affiliated with, endorsed by or sponsored by any network, studio or show. Show names and cast likenesses belong to their respective owners.</p></footer>
  </div>`;
  $('scroller').scrollTop=0;
  app.querySelectorAll('[data-lp]').forEach(b=>b.onclick=e=>{const k=b.dataset.lp;if(k==='start')lpStart();if(k==='code')codeSheet();if(k==='top'){e.preventDefault();$('scroller').scrollTo({top:0,behavior:'smooth'})}});
  app.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>b.dataset.pick==='any'?(lpStart(),setTimeout(searchSheet,350)):lpStart(b.dataset.pick));
  lpRoll();lpWall();lpGuide();lpWatch();lpRace();lpReel();
  $('lpTicker').innerHTML=(h=>h+h)(['Survivor','The Traitors','The Challenge','Big Brother','Love Island','Drag Race','The Amazing Race','Below Deck','Your show'].map(x=>`<span class="cap">${x}</span>`).join(''));
  $('lpFaces').innerHTML=CHL.cast.filter(c=>c.photo).map((c,i)=>`<div style="transition-delay:${i*24}ms"><img src="${ph(c)}" alt="" loading="lazy"></div>`).join('');
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{root:$('scroller'),threshold:.15});
  app.querySelectorAll('.lp-up,#lpFaces').forEach(el=>io.observe(el));
  const sc=$('scroller'),top=()=>{if(!lpLive())return sc.removeEventListener('scroll',top);$('lpTop').classList.toggle('scrolled',sc.scrollTop>10)};sc.addEventListener('scroll',top,{passive:true})}

function lpStart(id){state.signedOut=true;FIRST.picked=new Set(id?[id]:[]);location.hash='#/start/1'}

// the show name rolls; the plate is sized once, to the longest name, so nothing moves while names roll
function lpRoll(){const names=['Survivor','The Traitors','The Challenge','Big Brother','Love Island','Drag Race','your show'],r=$('lpRoll');let i=0;
  const size=()=>{if(!lpLive())return;const probe=document.createElement('span');probe.style.visibility='hidden';r.appendChild(probe);const fs=parseFloat(getComputedStyle(r).fontSize);
    const widest=Math.max(...names.map(n=>{probe.textContent=n;return probe.offsetWidth}));probe.remove();r.style.width=(widest/fs+.55)+'em'};
  size();document.fonts&&document.fonts.ready.then(size);
  if(reduce){r.firstElementChild.textContent='your show';return}
  lpEvery(()=>{if(i>=names.length-1)return;const old=r.firstElementChild;i++;const nu=document.createElement('span');nu.textContent=names[i];nu.style.transform='translateY(110%)';r.appendChild(nu);
    requestAnimationFrame(()=>{old.style.transform='translateY(-110%)';old.style.opacity=0;nu.style.transform=''});setTimeout(()=>old.remove(),600)},1700)}
// the cast wall: real faces, each named with its show
function lpWall(){const all=[S51,TRT,S49,CHL].flatMap(s=>s.cast.filter(c=>c.photo).map(c=>({c,s})));const of=s=>all.filter(x=>x.s===s);
  const rows=[of(S51).concat(of(TRT).slice(0,6)),of(TRT).concat(of(S49).slice(0,6)),of(CHL).slice(0,20)];
  $('lpWall').innerHTML=rows.map((row,ri)=>{const cells=row.map(({c,s})=>`<div class="lp-cell"><img src="${ph(c)}" alt="" loading="lazy"><span class="nm"><b class="cap">${first(c.name)}</b><small>${s.show.replace(/ \(US\)$/,'')} ${s.season}</small></span></div>`).join('');
    return `<div class="lp-wrow${ri%2?' rev':''}" style="--d:${70+ri*12}s">${cells}${cells}</div>`}).join('')}
// a slice of the week, starting today
function lpGuide(){const d0=new Date(),L={3:[['8:05 PM','Survivor','S51 · Ep 5','#f2804b',by(S51,'Kristin')]],4:[['9:00 PM','The Traitors','S5 · Ep 4','#c23a4b',TRT.cast[6]]],2:[['8:00 PM','The Challenge','S37 · Ep 7','#5089c9',CHL.cast[4]]],1:[['8:00 PM','Below Deck Med','S10 · Ep 7']]};
  $('lpGuide').innerHTML=Array.from({length:7},(_,i)=>{const d=new Date(d0);d.setDate(d0.getDate()+i);const it=L[d.getDay()]||[];if(i&&!it.length)return '';
    const card=([tm,tt,ep,c,p])=>`<div class="lp-li${c?'':' watch'}" style="${c?`background:${c}`:''}">${p&&p.photo?`<img src="${ph(p)}" alt="">`:''}<span class="tm">${tm}</span><span class="tt">${tt}</span><span class="ep">${ep}${c?'':' · watching'}</span></div>`;
    return `<div class="lp-day${i===0?' today':''}"><div class="dh cap"><b>${i===0?'Today':DAY[d.getDay()]}</b><small>${MON[d.getMonth()]} ${d.getDate()}</small></div>${it.map(card).join('')||'<div class="lp-li watch none">Nothing on</div>'}</div>`}).join('')}
// the watch-along phone: comments arrive in sync with the clock
function lpWatch(){const C=[['M','#a76bb0','Maya','Kristin is SO calm'],['D','#d9704a','Dev','that challenge setup is brutal'],['M','#a76bb0','Maya','Thien looks nervous...'],['S','#5089c9','Sam','water well strategy talk'],['P','#e56b9f','Priya','IDOL CLUE'],['D','#d9704a','Dev','Jeff said dig deep, marking it']];
  const f=$('lpFeed');let i=0,t=21*60+40;
  const add=()=>{const [a,c,n,x]=C[i++%C.length];const d=document.createElement('div');d.className='lp-cm';d.innerHTML=`<span class="a" style="background:${c}">${a}</span><div><small>${n}</small>${x}</div>`;f.appendChild(d);if(f.children.length>4)f.firstChild.remove()};
  add();add();if(reduce)return;
  lpEvery(()=>{t+=8;$('lpClk').textContent=`${t/60|0}:${String(t%60).padStart(2,'0')}`;$('lpPb').style.width=Math.min(100,t/2580*100)+'%'},1000);lpEvery(add,2600)}
// the season games swipe; the dots follow
function lpReel(){const r=$('lpReel'),d=[...$('lpDots').children];r.addEventListener('scroll',()=>{const i=Math.round(r.scrollLeft/302);d.forEach((x,k)=>x.classList.toggle('on',k===i))},{passive:true})}
// the spoiler gate, then Survivor 49's real cumulative points race to the finale
function lpRace(){const svgEl=$('lpRaceSvg'),top=S49.cast.slice().sort((a,b)=>b.total-a.total).slice(0,5);if(!top.length)return;
  const COL=['#ffc531','#35b5a5','#e56b9f','#5089c9','#f2804b'],NE=S49.episodesScored,W=360,H=250,PL=6,PR=96,PT=12,PB=22;
  const cum=top.map(c=>c.perEp.reduce((a,v)=>(a.push((a.at(-1)||0)+v),a),[]));const max=Math.max(...cum.flat());
  const X=i=>PL+(W-PL-PR)*i/(NE-1),Y=v=>PT+(H-PT-PB)*(1-v/max),NS='http://www.w3.org/2000/svg';
  const el=(n,a,p=svgEl)=>{const e=document.createElementNS(NS,n);for(const k in a)e.setAttribute(k,a[k]);p.appendChild(e);return e};
  [0,25,50,75].forEach(v=>v<=max&&el('line',{x1:PL,x2:W-PR,y1:Y(v),y2:Y(v),stroke:'#2e2a3a'}));
  for(let i=0;i<NE;i+=3)el('text',{x:X(i),y:H-4,class:'axis','text-anchor':'middle'}).textContent='EP '+(i+1);
  const lines=cum.map((c,k)=>el('path',{class:'ln',stroke:COL[k],d:''})),defs=el('defs',{});
  const heads=top.map((c,k)=>{const g=el('g',{}),cp=el('clipPath',{id:'lpcp'+k},defs);el('circle',{r:11},cp);el('circle',{r:13,fill:COL[k]},g);
    el('image',{href:ph(c),width:22,height:22,x:-11,y:-11,'clip-path':`url(#lpcp${k})`},g);const t=el('text',{x:17,y:5,class:'lbl',fill:COL[k]},g);return {g,t}});
  function draw(p){const i=Math.min(Math.floor(p),NE-1),f=p-i;$('lpRaceEp').textContent='EP '+Math.min(NE,i+1);
    cum.forEach((c,k)=>{let d=`M${X(0)},${Y(c[0])}`;for(let j=1;j<=i;j++)d+=` L${X(j)},${Y(c[j])}`;const v=i<NE-1?c[i]+(c[i+1]-c[i])*f:c[NE-1],x=i<NE-1?X(i)+(X(i+1)-X(i))*f:X(NE-1);
      d+=` L${x},${Y(v)}`;lines[k].setAttribute('d',d);heads[k].g.setAttribute('transform',`translate(${x},${Y(v)})`);heads[k].t.textContent=`${first(top[k].name)} ${Math.round(v)}`})}
  draw(0);
  $('lpReveal').onclick=()=>{$('lpGate').classList.add('open');const t0=performance.now(),dur=reduce?1:4200;
    const step=n=>{if(!lpLive())return;const k=Math.min((n-t0)/dur,1),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;draw(e*(NE-1));if(k<1)return requestAnimationFrame(step);
      const w=top[0];$('lpWinner').innerHTML=`<img src="${ph(w)}" alt=""><div class="lp-plate"><span class="t cap">Top scorer</span><span class="b"><b class="cap">${w.name}</b><small>${w.total} points across ${NE} episodes</small></span></div>`;$('lpWinner').classList.add('on')};
    setTimeout(()=>requestAnimationFrame(step),350)}}

// ---------- first run: shows → where → account → people ----------
const APPLE='<svg viewBox="0 0 24 24"><path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.7-1.8-3.3-1.8-1.4-.1-2.8.8-3.5.8s-1.8-.8-3-.8c-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 6.9 1.2 9.2.8 1.1 1.7 2.3 2.9 2.3 1.1 0 1.6-.8 3-.8s1.8.8 3 .7c1.2 0 2-1.1 2.8-2.2.9-1.3 1.2-2.5 1.3-2.6-.1 0-2.6-.9-2.6-3.6zM14.1 5.9c.6-.8 1.1-1.9.9-2.9-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.8-1 2.8 1.1.1 2.1-.5 2.8-1.3z"/></svg>';
const GOOGLE='<svg viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.7 1.2 9.2 3.6l6.9-6.9C35.9 2.4 30.5 0 24 0 14.6 0 6.5 5.4 2.6 13.2l8 6.2C12.4 13.7 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M47 24.6c0-1.6-.2-3.1-.4-4.6H24v9h12.9c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 7.2-10.4 7.2-17.6z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-8-6.2C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.5-4.9 2.3-8.2 2.3-6.3 0-11.6-4.2-13.5-9.9l-8 6.2C6.5 42.6 14.6 48 24 48z"/></svg>';
const socialHTML=()=>`<div class="soc"><button class="btn apple wide" data-soc="Apple">${APPLE}Continue with Apple</button><button class="btn google wide" data-soc="Google">${GOOGLE}Continue with Google</button></div>`;
const formHTML=(go)=>`<label class="fld"><span>Username</span><input id="au" value="alex" autocomplete="username"></label>
  <label class="fld"><span>Email</span><input id="ae" type="email" placeholder="you@example.com" autocomplete="email"></label>
  <label class="fld"><span>Password</span><input id="ap" type="password" placeholder="At least 8 characters" autocomplete="new-password"></label>
  <button class="btn pri wide cap big" id="ago">${go}</button>`;
// social: the provider signs them in; all that's left is the name the couch sees
function usernameSheet(provider,done){openSheet('Pick a username',`Signed in with ${provider} as alex@example.com`,
  `<div class="acct"><label class="fld"><span>Username</span><input id="un" value="alex" autocomplete="username"></label><p class="muted small" style="line-height:1.45">This is the name your couch sees. You can change it later in Settings.</p><button class="btn pri wide cap big" id="ungo">Continue</button></div>`,
  b=>{b.querySelector('#ungo').onclick=()=>{const u=b.querySelector('#un').value.trim()||'alex';closeSheet();done(u)}})}
function wireAccount(root,done){root.querySelectorAll('[data-soc]').forEach(x=>x.onclick=()=>usernameSheet(x.dataset.soc,done));
  root.querySelector('#ago').onclick=()=>done(root.querySelector('#au').value.trim()||'alex')}

function startRoute(step){step=step||'1';const pool=frPool();$('scroller').scrollTop=0;
  if(step==='1'){const shown=[...FR_BASE(),...FIRST.extra];
    app.innerHTML=`<div class="fr"><div class="fr-top"><a class="back" href="#/welcome" aria-label="Back">${svg('chev')}</a>${steps4(1)}</div>
    <h1 class="cap">What are<br>you watching?</h1><p class="muted">Pick as many as you like. Play them with friends, or just follow along.</p>
    <button class="frsearch" id="fsearch">${svg('search')}Search any show</button>
    <div class="frgrid">${shown.map(p=>`<button class="frcard${FIRST.picked.has(p.id)?' on':''}" data-id="${p.id}">${frArt(p)}${p.ready?'':'<span class="nag">Not a game yet</span>'}<span class="chk">${svg('check')}</span><b class="cap">${p.name}</b><small>${p.season}</small></button>`).join('')}
      <button class="frcard blank" data-id="other"><span class="plusbox">${svg('search')}</span><b class="cap">Something else</b><small>Any show at all</small></button></div>
    <div class="frfoot"><button class="btn pri wide cap big" id="fnext"></button></div></div>`;
    const sync=()=>{const n=FIRST.picked.size;$('fnext').disabled=!n;$('fnext').textContent=n?`Next · ${n} picked`:'Pick at least one'};sync();
    app.querySelectorAll('[data-id]').forEach(c=>c.onclick=()=>{const id=c.dataset.id;if(id==='other')return searchSheet();FIRST.picked.has(id)?FIRST.picked.delete(id):FIRST.picked.add(id);c.classList.toggle('on');sync()});
    $('fsearch').onclick=searchSheet;$('fnext').onclick=()=>location.hash='#/start/2';return}
  if(step==='2'){const picks=pool.filter(p=>FIRST.picked.has(p.id));picks.forEach(p=>{if(FIRST.where[p.id]==null)FIRST.where[p.id]=0});
    app.innerHTML=`<div class="fr"><div class="fr-top"><a class="back" href="#/start/1" aria-label="Back">${svg('chev')}</a>${steps4(2)}</div>
    <h1 class="cap">Where are<br>you in them?</h1><p class="muted">We only ever show what you've seen. No spoilers, ever.</p>
    ${picks.map(p=>`<div class="wrow">${p.art?`<img src="${ART(p.art)}" alt="" style="object-position:${p.pos}">`:`<span class="th" style="width:64px;height:48px;border-radius:3px;display:grid;place-items:center;font-size:22px;color:rgba(255,255,255,.4);background:linear-gradient(150deg,${p.c||'#3a3548'},#16141d)">${p.name[0]}</span>`}<div class="tx"><b class="cap">${p.name}</b><small id="wl-${p.id}">${frWhereLabel(p)}</small></div>
      ${p.aired===0?'':`<div class="stepper"><button data-w="${p.id}" data-d="-1" aria-label="Earlier">−</button><b class="num" id="wn-${p.id}">${FIRST.where[p.id]}</b><button data-w="${p.id}" data-d="1" aria-label="Later">+</button></div>`}</div>`).join('')}
    <div class="frfoot"><button class="btn pri wide cap big" id="fnext">Next</button></div></div>`;
    app.querySelectorAll('[data-w]').forEach(b=>b.onclick=()=>{const p=frShow(b.dataset.w),cap=p.aired==null?99:p.aired;FIRST.where[p.id]=Math.max(0,Math.min(cap,FIRST.where[p.id]+ +b.dataset.d));$('wn-'+p.id).textContent=FIRST.where[p.id];$('wl-'+p.id).textContent=frWhereLabel(p)});
    $('fnext').onclick=()=>location.hash='#/start/3';return}
  if(step==='3'){const picks=pool.filter(p=>FIRST.picked.has(p.id)),n=picks.length;
    app.innerHTML=`<div class="fr"><div class="fr-top"><a class="back" href="#/start/2" aria-label="Back">${svg('chev')}</a>${steps4(3)}</div>
    <h1 class="cap">Save your<br>shows</h1><p class="muted">Free. So we remember where you are, on any phone, and never spoil a thing.</p>
    <div class="acct">${n?`<div class="why"><span class="stk">${picks.slice(0,4).map(p=>p.art?`<img src="${ART(p.art)}" alt="" style="object-position:${p.pos}">`:`<i style="background:${p.c||'#3a3548'}"></i>`).join('')}</span><small><b>${n} show${n>1?'s':''}</b> and where you are in each</small></div>`:''}
      ${socialHTML()}<div class="or"><span>or use email</span></div>${formHTML('Create account')}
      <p class="fine2">Already have an account? <a href="#/signin">Sign in</a></p></div></div>`;
    wireAccount(app,u=>{state.signedOut=false;toast(`Welcome, ${u}`);location.hash='#/start/4'});return}
  app.innerHTML=`<div class="fr"><div class="fr-top"><span style="width:40px"></span>${steps4(4)}</div>
    <h1 class="cap">Bring your<br>people?</h1><p class="muted">Games are better with friends. A couch is your group: everyone you play every show with.</p>
    <button class="choicebig" id="fcouch"><span class="ic">${svg('people')}</span><span><b>Start a couch</b><small>Name it, get a code, send it to your group</small></span></button>
    <button class="choicebig" id="fjoin"><span class="ic">${svg('key')}</span><span><b>Join a friend's couch</b><small>Got a code? Pull up a seat</small></span></button>
    <button class="choicebig quiet" id="fsolo"><span class="ic">${svg('tv')}</span><span><b>Just me for now</b><small>Follow your shows, rate episodes, watch along. Invite anyone later.</small></span></button></div>`;
  $('fsolo').onclick=()=>{N=1;state.solo=true;location.hash='#/hub'};$('fjoin').onclick=()=>codeSheet();
  $('fcouch').onclick=()=>newCouchSheet(()=>{N=1;state.solo=true;state.couchMade=true;location.hash='#/hub'})}
// the old Make an account screen is now step 3 of first run
function signupRoute(){location.replace('#/start/3')}

// ---------- search any show: ready, set up by players, or not a game yet ----------
function searchSheet(){openSheet('Find a show','Every show on TV. Not a game yet? Follow it anyway.',
  `<label class="srch">${svg('search')}<input id="sq" placeholder="Show name" autocomplete="off"></label><div id="sres"></div>
   <p class="srch-note"><b style="color:var(--bone)">Not a game yet</b> means nobody has set up its cast. Follow it now: rate episodes, watch along, chat. Anyone can make it a game later with one copy and paste.</p>`,
  b=>{const q=b.querySelector('#sq'),res=b.querySelector('#sres');
    const paint=()=>{const t=q.value.trim().toLowerCase(),inPool=id=>frPool().some(p=>p.id===id);
      const hits=[...FR_BASE().filter(p=>!t||p.name.toLowerCase().includes(t)).filter(p=>t),...CATALOG.filter(p=>!t||p.name.toLowerCase().includes(t))].slice(0,7);
      const exact=hits.some(p=>p.name.toLowerCase()===t);
      res.innerHTML=(t?'':'<div class="lp-sub cap" style="margin:16px 0 4px">Popular this week</div>')+hits.map(p=>{const picked=FIRST.picked.has(p.id)&&inPool(p.id);
        return `<button class="srow2" data-add="${p.id}">${p.art?`<img class="th" src="${ART(p.art)}" alt="" style="object-position:${p.pos}">`:`<span class="th" style="--c:${p.c}">${p.name[0]}</span>`}<span class="tx"><b>${p.name}</b><small>${p.season}${p.net?` · ${p.net}`:''}</small></span><span class="st ${picked?'in':p.ready?'ready':'not'}">${picked?'Picked':p.ready?'Ready':'Not a game yet'}</span></button>`}).join('')
        +(t&&!exact?`<button class="srow2 add" data-name="${q.value.trim().replace(/"/g,'')}"><span class="th">${svg('plus')}</span><span class="tx"><b>Add “${q.value.trim()}”</b><small>Not listed? Add it by name and follow it</small></span></button>`:'');
      res.querySelectorAll('[data-add]').forEach(r=>r.onclick=()=>{const id=r.dataset.add;let p=frShow(id);if(!p){p={...CATALOG.find(x=>x.id===id)};FIRST.extra.push(p)}
        FIRST.picked.add(id);closeSheet();startRoute('1');toast(p.ready?`${p.name} added`:`${p.name} added · follow it now, make it a game anytime`)});
      res.querySelectorAll('[data-name]').forEach(r=>r.onclick=()=>{const name=r.dataset.name,id='x'+Date.now();FIRST.extra.push({id,name,season:'Added by you',aired:null,c:'#5a5170'});FIRST.picked.add(id);closeSheet();startRoute('1');toast(`${name} added`)})};
    q.oninput=paint;paint();setTimeout(()=>q.focus(),300)})}

// ---------- sign in ----------
function signinRoute(){state.signedOut=true;$('scroller').scrollTop=0;
  app.innerHTML=`<div class="fr"><div class="fr-top"><a class="back" href="#/welcome" aria-label="Back">${svg('chev')}</a><div class="mark cap" style="font-size:18px;margin-left:auto"><span class="o">Game</span><span class="w">Your</span><span class="o">Show</span></div></div>
    <h1 class="cap">Welcome<br>back</h1><p class="muted">Your couch is waiting.</p>
    <div class="acct">${socialHTML()}<div class="or"><span>or</span></div>
      <label class="fld"><span>Username or email</span><input id="au" value="alex" autocomplete="username"></label>
      <label class="fld"><span class="fldrow">Password<a href="#" id="forgot">Forgot password?</a></span><input id="ap" type="password" value="password1" autocomplete="current-password"></label>
      <button class="btn pri wide cap big" id="ago">Sign in</button>
      <p class="fine2">New here? <a href="#" id="snew">Start free</a></p></div></div>`;
  const inn=()=>{state.signedOut=false;state.solo=false;N=4;syncMockLabel();location.hash='#/hub'};
  app.querySelectorAll('[data-soc]').forEach(x=>x.onclick=inn);$('ago').onclick=inn;
  $('snew').onclick=e=>{e.preventDefault();lpStart()};
  $('forgot').onclick=e=>{e.preventDefault();openSheet('Reset your password','We\'ll email you a link',`<div class="acct"><label class="fld"><span>Email</span><input id="fe" type="email" placeholder="you@example.com"></label><button class="btn pri wide cap big" id="fgo">Send the link</button></div>`,
    b=>b.querySelector('#fgo').onclick=()=>{closeSheet();toast('Check your email for the link')})}}

// ---------- Join with a code ----------
function codeSheet(){openSheet('Join with a code','From the invite your friend sent',
  `<div class="acct"><input class="codein num" id="cin" maxlength="6" placeholder="K7Q2XZ" autocomplete="off" autocapitalize="characters" aria-label="Invite code">
   <button class="btn out wide" id="cpaste">${svg('copy')}Paste from clipboard</button>
   <button class="btn pri wide cap big" id="cgo" disabled>Find the couch</button>
   <p class="fine2">Got a link instead? Just open it.</p></div>`,
  b=>{const i=b.querySelector('#cin'),go=b.querySelector('#cgo'),sync=()=>{i.value=i.value.toUpperCase().replace(/[^A-Z0-9]/g,'');go.disabled=i.value.length<6};
    i.oninput=sync;b.querySelector('#cpaste').onclick=()=>{i.value='K7Q2XZ';sync()};go.onclick=()=>{closeSheet();location.hash='#/join/'+i.value};setTimeout(()=>i.focus(),300)})}

// ---------- the invite, signed out: see the couch first; joining asks for an account, then where you are ----------
const joinSignedIn=joinRoute;
joinRoute=function(code){joinSignedIn(code);$('scroller').scrollTop=0;if(!state.signedOut)return;
  app.querySelectorAll('[data-join],[data-ask],#jgo').forEach(b=>{const act=b.onclick;b.onclick=()=>state.signedOut?joinAccount(()=>act.call(b)):act.call(b)});
  const go=$('jgo');go.insertAdjacentHTML('afterend',`<p class="signedout-strip">Already have an account?<a class="link" href="#/signin" style="color:var(--bone);font-weight:700">Sign in</a></p>`)};
function joinAccount(then){openSheet('Make an account','Free. Then you\'re on Couch Council.',`<div class="acct">${socialHTML()}<div class="or"><span>or use email</span></div>${formHTML('Create account')}</div>`,
  b=>wireAccount(b,u=>{state.signedOut=false;closeSheet();setTimeout(()=>joinWhereSheet(u,then),280)}))}
function joinWhereSheet(u,then){const s=SHOWS[0],aired=s.ep-1;FIRST.where.surv=FIRST.where.surv??aired;
  openSheet('Where are you in Survivor 51?','So nothing on the couch spoils it',
  `<div class="acct"><div class="wherebox"><img src="${ART(s.art)}" alt="" style="width:64px;height:48px;object-fit:cover;border-radius:3px;object-position:${s.hpos}"><span class="tx"><b class="cap">Survivor 51</b><small id="wsl">${whereLabel('surv',aired)}</small></span>
    <div class="stepper"><button data-d="-1" aria-label="Earlier">−</button><b class="num" id="wsn">${FIRST.where.surv}</b><button data-d="1" aria-label="Later">+</button></div></div>
    <button class="btn pri wide cap big" id="wsgo">Continue</button></div>`,
  b=>{b.querySelectorAll('[data-d]').forEach(x=>x.onclick=()=>{FIRST.where.surv=Math.max(0,Math.min(aired,FIRST.where.surv+ +x.dataset.d));b.querySelector('#wsn').textContent=FIRST.where.surv;b.querySelector('#wsl').textContent=whereLabel('surv',aired)});
    b.querySelector('#wsgo').onclick=()=>{closeSheet();toast(`Welcome to the couch, ${u}`);setTimeout(then,280)}})}
