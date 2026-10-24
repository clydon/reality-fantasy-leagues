// ================= watching: every show gets the show space; what the couch watches drives the rest =================
// The core loop (user, 2026-10-22): see what your couch watches → check a show out → start a game or watch along.
// Every show opens the same show space; the tabs fit the show (a competition with no game yet: Tonight · Episodes ·
// Standings · Cast · Chat; a series: Tonight · Episodes · Cast · Chat). Anyone can Make it a game (one AI paste
// sets up the cast; shared app-wide after review). Watch along: start anytime, or invite the couch ahead to watch
// the live airing or start together (anyone pauses for everyone); GIFs; the screen stays on. Couch-only, always.
const W={tab:'tonight',plans:{},games:{},priv:new Set(),nudgeGone:false,rates:{}};

// ---------- two more shows: a competition nobody has set up, and a series only sam watches ----------
SHOWS.push(
  {id:'ar',name:'The Amazing Race',season:'Season 38',short:'Amazing Race 38',art:'amazing-race',hart:'amazing-race-left',pos:'72% 50%',hpos:'60% 45%',air:[4,20,0],col:'#1f6fb8',ep:6,explore:true,unready:true,aired:5,onEp:5,
   todo:{kind:'Both watch',t:'You and jordan both watch',d:'Not a game yet · make it one'},watchers:{4:['alex','jordan'],12:['alex','jordan','dev','noor']}},
  {id:'plu',name:'Pluribus',season:'Season 1',short:'Pluribus',art:'pluribus',pos:'22% 40%',hpos:'38% 45%',air:[5,21,0],col:'#e0a312',ep:5,series:true,others:true,aired:4,onEp:0,rating:4.6,
   watchers:{4:['sam'],12:['sam','maya','theo']}});
FIRST.where.ar=5;
Object.assign(WADATA,{
  ar:{ep:6,run:43,start:1200,cast:null,lines:[[1210,'jordan','roadblock time and I already know who\'s doing it'],[1228,'jordan','that cab is going the wrong way'],[1246,'jordan','U-Turn incoming, calling it'],[1270,'jordan','the detour choice is so obvious']],stickers:[]},
  plu:{ep:1,run:48,start:900,cast:null,lines:[[910,'sam','that cold open. what.'],[934,'sam','the score in this show is unreal'],[952,'sam','ok I did not see that coming'],[975,'sam','rewatching this scene later']],stickers:[]}});
// where each person is in each show (alex's lives in FIRST.where); "now" = watching this minute
const WHERE={ar:{jordan:5,dev:4,noor:5},plu:{sam:4,maya:2,theo:1},bd:{riley:7,sam:6,maya:6,priya:5,noor:4,luis:6},chl:{sam:6,dev:6,kat:5,theo:3},li:{riley:13,maya:13,priya:12,noor:13}};
const NOW={bd:'riley'};
const follows=s=>!s.others||state.added.has(s.id);
const airedOf=s=>s.aired||s.ep-1;
const whereOf=(s,n)=>n==='alex'?(FIRST.where[s.id]??s.onEp??airedOf(s)):((WHERE[s.id]||{})[n]??airedOf(s));
const names=a=>a.length<3?a.join(' and '):`${a.slice(0,2).join(', ')} and ${a.length-2} more`;
const kindW=s=>s.kinds?'game':s.series?'series':'comp';
const wTabs=s=>kindW(s)==='series'?['tonight','episodes','cast','chat']:['tonight','episodes','standings','cast','chat'];
const verdict=(s,e)=>(3.6+((e*7+s.id.length*3)%12)/10).toFixed(1);
const rxCount=(s,e)=>8+((e*5+s.id.length)%17);
const pickN=(s,e)=>3+((e+s.id.length)%3);

// ---------- show space ----------
const showRouteGame=showRoute;
showRoute=function(sid,tab){const s=SHOWS.find(x=>x.id===sid);if(!s)return hubRoute();if(s.kinds)return showRouteGame(sid,tab);
  const T=wTabs(s).filter(k=>N!==1||k!=='chat');W.tab=T.includes(tab)?tab:'tonight';
  const body=({tonight:wTonight,episodes:wEpisodes,standings:wStandings,cast:wCast,chat:wChat})[W.tab](s);
  app.innerHTML=`<div class="show">${wBar(s)}<div class="show-body" id="showBody">${body}</div>
    <nav class="tabbar" style="grid-template-columns:repeat(${T.length},1fr)">${T.map(k=>{const [l,i]={tonight:['Tonight','tv'],episodes:['Episodes','cal'],standings:['Standings','cup'],cast:['Cast','people'],chat:['Chat','chatb']}[k];return `<a href="#/show/${s.id}/${k}" class="${W.tab===k?'on':''}">${svg(i)}${l}</a>`}).join('')}</nav></div>`;
  wireW(s);$('scroller').scrollTop=0};
function wBar(s){const t=nextAir(s.air),big=W.tab==='tonight',w=watchersOf(s)||[];
  return `<header class="sbar${big?' xl':''}"><img src="${ART(s.hart||s.art)}" alt="" style="object-position:${s.hart?'50% 45%':s.hpos||s.pos}">
    <div class="sbar-top"><a class="back" href="#/hub">${svg('chev')}Home</a><span class="sbar-st">Ep ${s.ep} · <span data-cd="${t.getTime()}">—</span></span><button class="iconbtn" id="wMenu" aria-label="Show menu">${svg('dots')}</button></div>
    ${big?`<h1 class="cap">${s.name.replace('The ','')}<small>${s.season}</small></h1><div class="sbar-couch"><span class="stack">${w.slice(0,6).map(n=>av(n,24)).join('')}</span>${w.length} on the couch ${w.length===1?'watches':'watch'}${s.unready?'<span class="w-nag cap">Not a game yet</span>':s.series?'<span class="w-nag cap">Series</span>':''}</div>`:`<b class="cap sbar-name">${s.name} · ${s.season.replace('Season ','S')}</b>`}</header>`}

// ---------- Tonight ----------
function wTonight(s){const aired=airedOf(s),fol=follows(s),w=fol?whereOf(s,'alex'):0,next=Math.min(w+1,s.ep),others=(watchersOf(s)||[]).filter(n=>n!=='alex');
  const ahead=others.filter(n=>whereOf(s,n)>=next),plan=W.plans[s.id],g=W.games[s.id];let h='';
  if(!fol)h+=`<section class="blk"><div class="w-follow"><span class="stack">${others.map(n=>av(n,30)).join('')}</span><div><b>${names(others)} ${others.length===1?'watches':'watch'} this</b><small>Add it to rate episodes and see the couch's reactions. Nothing past your episode ever shows.</small></div><button class="btn pri wide" data-wjob="follow">${svg('plus')}Add to my shows</button></div></section>`;
  else h+=`<section class="blk"><div class="where" style="margin:0">${svg('eye')}<strong>${w>=aired?`Live · through Episode ${aired}`:w?`You're on Episode ${w} · nothing past it shows`:'Not started · nothing past Episode 1 shows'}</strong><button data-wjob="where">Change</button></div>${W.priv.has(s.id)?`<p class="w-priv">${svg('eye')}Watching privately: the couch doesn't see this on your list</p>`:''}</section>`;
  h+=`<button class="wacta" data-wjob="watch"><img src="${ART(s.art)}" alt="" style="object-position:${s.hpos||s.pos}"><span class="tg cap">${w>=aired?`Live · ${fmtT(nextAir(s.air))}`:`Episode ${next}`}</span><b class="cap">Watch along</b><small>${ahead.length?`${names(ahead)} left ${rxCount(s,next)} reactions · they show up as you reach them`:'Be the first. Your reactions wait for whoever watches next.'}</small></button>`;
  h+=plan?`<div class="w-plan"><span class="tg cap">Together</span><div class="tx"><b>${plan.how==='live'?'The live airing':'Starting together'} · ${plan.when}</b><small>${names(plan.who)} invited · anyone can pause for everyone</small></div><button class="btn pri" data-wjob="together">Open</button></div>`
    :`<button class="w-inv" data-wjob="invite">${svg('people')}<span><b>Watch it together</b><small>Invite the couch for the live airing, or start at the same time</small></span>${svg('chev')}</button>`;
  if(g)h+=`<section class="blk"><div class="sh"><h2 class="cap">Your game</h2><span class="aside">Starts Episode ${s.ep}</span></div><button class="job" data-wjob="gpick"><span class="ic" style="background:${GAMES[g.g].col};color:var(--ink)">${svg(g.g==='pool'?'shield':'people')}</span><span class="tx"><span class="kind cap">${GAMES[g.g].name}</span><b>${g.g==='pool'?'Make your first pick':'Draft before Episode '+s.ep}</b><small>${g.told?'The couch was told · ':''}${names(others)} invited</small></span><span class="st">${g.g==='pool'?'Pick':'Set'}</span></button></section>`;
  h+=`<section class="blk"><div class="sh"><h2 class="cap">Who's watching</h2><span class="aside">${others.length+(fol&&!W.priv.has(s.id)?1:0)} on the couch</span></div>
    ${[...(fol?['alex']:[]),...others].map(n=>{const at=whereOf(s,n),live=NOW[s.id]===n;return `<div class="w-who">${av(n,32,live)}<span class="tx"><b>${n}${n==='alex'?' <span class="you">YOU</span>':''}</b><small>${live?`<span class="w-live">Watching now · Episode ${Math.min(at+1,s.ep)}</span>`:at>=aired?`Caught up · watches live ${DAY[s.air[0]]}`:at?`On Episode ${at}`:'Not started'}${n==='alex'&&W.priv.has(s.id)?' · private':''}</small></span>${n!=='alex'&&at>w&&fol?`<span class="w-ahead">${at-w} ahead</span>`:''}</div>`}).join('')}</section>`;
  if(fol)h+=`<section class="blk"><div class="sh"><h2 class="cap">Every episode</h2><span class="aside">Skip any, no deadlines</span></div>
    <button class="job" data-wjob="rate"><span class="ic">${svg('star')}</span><span class="tx"><b>Rate Episode ${Math.max(1,w)}</b><small>${W.rates[s.id+Math.max(1,w)]?`You gave it ${W.rates[s.id+Math.max(1,w)]} · couch ★ ${verdict(s,Math.max(1,w))}`:'Then see the couch verdict'}</small></span>${svg('chev')}</button>
    <button class="job" data-wjob="predict"><span class="ic">${svg('quiz')}</span><span class="tx"><b>Call it for Episode ${next}</b><small>${s.id==='ar'?'Who\'s last to the mat? · scored after it airs':s.id==='chl'?'Who goes home? · scored after it airs':'Two quick calls · see who got it after'}</small></span>${svg('chev')}</button></section>`;
  if(!s.series&&!g)h+=s.unready?`<div class="playplate"><span class="tg cap">Not a game yet</span><h4 class="cap">Make it a game</h4><p>${others.length?`${names(others)} ${others.length===1?'watches':'watch'} too. `:''}One copy and paste sets up the cast and the scoring, then pick Survival Pool or a draft. After a quick review, every couch can play it.</p><button class="btn" data-wjob="make">Make it a game</button></div>`
    :`<div class="playplate"><span class="tg cap">Play it</span><h4 class="cap">${s.short} with your couch</h4><p>${others.length?`${names(others)} already ${others.length===1?'watches':'watch'}. `:''}Survival Pool starts from the next episode, no draft needed.</p><button class="btn" data-wjob="newgame">Start a game</button></div>`;
  return h+'<div style="height:30px"></div>'}

// ---------- Episodes: the couch verdict for what you've seen, Watch along for what you haven't ----------
function wEpisodes(s){const aired=airedOf(s),w=follows(s)?whereOf(s,'alex'):0,t=nextAir(s.air);
  const date=e=>{const d=new Date(t);d.setDate(d.getDate()-7*(s.ep-e));return `${DAY[d.getDay()]} ${MON[d.getMonth()]} ${d.getDate()}`};
  return `<section class="blk"><div class="sh"><h2 class="cap">Every episode</h2><span class="aside">${aired} aired</span></div>
    <div class="w-ep next"><span class="n num">${s.ep}</span><span class="tx"><b>Episode ${s.ep}</b><small>${fmtT(t)}</small></span><span class="tg cap">Next</span></div>
    ${Array.from({length:aired},(_,k)=>aired-k).map(e=>e<=w?`<button class="w-ep" data-wjob="watch"><span class="n num">${e}</span><span class="tx"><b>Episode ${e}</b><small>${date(e)} · ${rxCount(s,e)} reactions · ${pickN(s,e)} rated</small></span><span class="w-vd"><b class="num">★ ${verdict(s,e)}</b><small>${W.rates[s.id+e]?`you ${W.rates[s.id+e]}`:'couch'}</small></span></button>`
      :`<div class="w-ep locked"><span class="n num">${e}</span><span class="tx"><b>Episode ${e}</b><small>${date(e)} · not seen yet · verdict hidden</small></span><button class="btn sm pri" data-wjob="watch">Watch along</button></div>`).join('')}</section><div style="height:30px"></div>`}

// ---------- Standings: the cast leaderboard by the show's own scoring ----------
function wStandings(s){const w=whereOf(s,'alex');
  if(s.unready)return `<section class="blk"><div class="w-empty">${svg('cup')}<b class="cap">Nobody's scoring yet</b><p>Once someone makes ${s.name} a game, the cast leaderboard lives here: who's scoring, episode by episode, up to where you are.</p><button class="btn pri wide" data-wjob="make">Make it a game</button></div></section>`;
  if(s.id!=='chl')return `<section class="blk"><div class="w-empty">${svg('cup')}<b class="cap">Scores start with Episode ${s.ep}</b><p>The cast is set up. Points arrive with the first results.</p></div></section>`;
  const rows=CAST8.map(c=>{const p=c.pts.slice(0,w),out=c.pts.indexOf(null)+1;return {...c,tot:p.reduce((a,b)=>a+(b||0),0),out:out&&out<=w?out-1:0}}).sort((a,b)=>b.tot-a.tot);
  return `<section class="blk"><div class="sh"><h2 class="cap">Who's scoring</h2><span class="aside">through Ep ${w}</span></div>
    ${rows.map((r,i)=>`<div class="w-board${r.out?' out':''}"><span class="rk num">${i+1}</span><img src="${r.photo}" alt=""><span class="tx"><b>${r.nm}</b><small>${r.out?`Out · Episode ${r.out}`:`${(r.tot/Math.max(1,w)).toFixed(1)} a week`}</small></span><b class="num">${r.tot}</b></div>`).join('')}</section>
    <div class="playplate"><span class="tg cap">Play it</span><h4 class="cap">${s.short} with your couch</h4><p>Draft from this cast, or start a Survival Pool from the next episode.</p><button class="btn" data-wjob="newgame">Start a game</button></div>`}

// ---------- Cast ----------
const ROLES={bd:['Captain','Chief stew','Chef','Bosun','Second stew','Third stew','Deckhand','Deckhand','Deckhand'],plu:['Lead','Co-lead','Supporting','Supporting','Supporting','Recurring'],
  ar:['Siblings','Dating','Best friends','Married','Father & son','Mother & daughter','Cousins','Engaged','Twins','Coworkers','Exes']};
function wCast(s){if(s.id==='chl')return `<section class="blk"><div class="sh"><h2 class="cap">The cast</h2><span class="aside">${CHL.cast.length} players</span></div><div class="w-cast">${CHL.cast.filter(c=>c.photo).slice(0,24).map(c=>`<div><img src="${ph(c)}" alt=""><b class="cap">${first(c.name)}</b></div>`).join('')}</div></section>`;
  if(s.unready)return `<section class="blk"><div class="sh"><h2 class="cap">The cast</h2><span class="aside">From the TV listings</span></div><div class="w-roles">${ROLES.ar.map((r,i)=>`<div class="w-role">${svg('people')}<span><b>Team ${i+1}</b><small>${r}</small></span></div>`).join('')}</div>
    <p class="muted small" style="margin-top:12px;line-height:1.5">Names and photos come from the TV listings. What each team scores comes with Make it a game.</p></section>`;
  const R=ROLES[s.id]||ROLES.plu;
  return `<section class="blk"><div class="sh"><h2 class="cap">${s.series&&s.id!=='bd'?'Cast':'Cast & crew'}</h2><span class="aside">From the TV listings</span></div><div class="w-roles">${R.map(r=>`<div class="w-role">${svg('people')}<span><b>${r}</b><small>Name and photo from the listing</small></span></div>`).join('')}</div>
    <p class="muted small" style="margin-top:12px;line-height:1.5">In the real app these are names and photos from the TV listings. Nothing past your episode is shown.</p></section>`}

// ---------- Chat: this show's corner of the couch chat; anything past your episode stays folded ----------
function wChat(s){const d=WADATA[s.id],w=whereOf(s,'alex'),others=(watchersOf(s)||[]).filter(n=>n!=='alex'),ahead=others.filter(n=>whereOf(s,n)>w);
  const lines=d?d.lines:[];
  return `<div class="chat" id="chat"><div class="dayl">This week</div>${lines.slice(0,2).map(([,n,t])=>msgHTML(n,t)).join('')}
    ${ahead.length?`<div class="fold">${svg('eye')}${names(ahead)} said ${lines.length+1} things about episodes you haven't seen · they unfold when you've watched</div>`:''}</div>
    <div class="composer sticky"><input id="wci" placeholder="Message the couch about ${s.name}" aria-label="Message"><button id="wcs" aria-label="Send">${svg('send')}</button></div>`}

// ---------- wiring ----------
function wireW(s){$('wMenu').onclick=()=>wMenu(s);tickCd();
  app.querySelectorAll('[data-wjob]').forEach(b=>b.onclick=e=>{e.stopPropagation();const j=b.dataset.wjob,aired=airedOf(s);
    ({follow:()=>whereSheet({...s,aired,onEp:1}),where:()=>whereSheet({...s,aired,onEp:Math.max(1,whereOf(s,'alex'))}),watch:()=>openWatch(s.id),together:()=>openWatch(s.id,{together:W.plans[s.id]}),
      invite:()=>inviteWatch(s),rate:()=>rateSheet(s),predict:()=>callSheet(s),make:()=>makeGame(s),newgame:()=>newGameSheet(s),gpick:()=>toast('Your first pick (mock)')})[j]()});
  if($('wci')){const send=()=>{const v=$('wci').value.trim();if(!v)return;$('chat').insertAdjacentHTML('beforeend',msgHTML('alex',v,true,true));$('wci').value='';$('scroller').scrollTop=1e6};$('wcs').onclick=send;$('wci').onkeydown=e=>{if(e.key==='Enter')send()}}}
// picking where you are (index.html's whereSheet) used to open a separate page; now it lands in the show space
showPage=function(sh,up){const s=SHOWS.find(x=>x.id===sh.id);FIRST.where[s.id]=up;s.onEp=up;if(s.others&&!state.added.has(s.id)){state.added.add(s.id);toast(`${s.name} added to your shows`)}
  const h=`#/show/${s.id}/tonight`;if(location.hash===h)route();else location.hash=h};
function wMenu(s){const fol=follows(s),pv=W.priv.has(s.id);
  openSheet(s.name,`${s.season} · ${fol?'on your shows':'not on your shows'}`,
    `${fol?`<button class="row" data-wm="priv"><span class="ic">${svg('eye')}</span><span class="tx"><b>Watch privately</b><small>Only you see this on your list. Reactions and chat still work.</small></span><span class="switch${pv?' on':''}" aria-hidden="true"><i></i></span></button>
      <button class="row" data-wm="where"><span class="ic">${svg('cal')}</span><span class="tx"><b>Where you are</b><small>${whereOf(s,'alex')?`Episode ${whereOf(s,'alex')}`:'Not started'}</small></span></button>`:''}
     <button class="row" data-wm="invite"><span class="ic">${svg('people')}</span><span class="tx"><b>Watch it together</b><small>Invite the couch for the live airing or a shared start</small></span></button>
     ${s.series?'':`<button class="row" data-wm="${s.unready?'make':'newgame'}"><span class="ic">${svg('plus')}</span><span class="tx"><b>${s.unready?'Make it a game':'Start a game'}</b><small>${s.unready?'Set up the cast with one paste':'Survival Pool, Weekly Lineup or Outlast'}</small></span></button>`}
     ${fol?`<button class="row" data-wm="drop"><span class="ic">${svg('x')}</span><span class="tx"><b>Remove from my shows</b><small>Your ratings and reactions stay</small></span></button>`:''}`,
    b=>b.querySelectorAll('[data-wm]').forEach(x=>x.onclick=()=>{const m=x.dataset.wm;
      if(m==='priv'){pv?W.priv.delete(s.id):W.priv.add(s.id);closeSheet();toast(pv?'The couch can see you watch it again':'Watching privately · only you see it');return route()}
      closeSheet();setTimeout(()=>({where:()=>whereSheet({...s,aired:airedOf(s),onEp:Math.max(1,whereOf(s,'alex'))}),invite:()=>inviteWatch(s),make:()=>makeGame(s),newgame:()=>newGameSheet(s),
        drop:()=>{state.added.delete(s.id);if(!s.others)s.others=true;toast(`${s.name} removed`);location.hash='#/hub'}})[m](),250)}))}
function rateSheet(s){const e=Math.max(1,whereOf(s,'alex')),others=(watchersOf(s)||[]).filter(n=>n!=='alex');
  openSheet(`How was Episode ${e}?`,`${s.name} · then the couch verdict`,`<div class="w-stars">${[1,2,3,4,5].map(i=>`<button data-r="${i}" aria-label="${i} stars">${svg('star','')}</button>`).join('')}</div>
    <div class="w-verdict" id="wv"><span class="tg cap">Couch verdict</span><div><b class="num">${verdict(s,e)}</b><small>from ${others.length+1} on the couch</small></div><p id="wvA"></p></div>`,
    b=>b.querySelectorAll('[data-r]').forEach(x=>x.onclick=()=>{const r=+x.dataset.r;W.rates[s.id+e]=r;b.querySelectorAll('[data-r]').forEach(y=>y.classList.toggle('on',+y.dataset.r<=r));
      $('wvA').textContent=Math.abs(r-verdict(s,e))<1?`You agree with the couch${others[0]?` · taste twin: ${others[0]}`:''}`:'Spicy. You\'re the contrarian this week';$('wv').classList.add('on');if(W.tab==='tonight')setTimeout(()=>{closeSheet();route()},1600)}))}
function callSheet(s){const e=Math.min(whereOf(s,'alex')+1,s.ep);
  const Q=s.id==='ar'?[['Who\'s last to the mat?',ROLES.ar.slice(0,4).map((r,i)=>`Team ${i+1}`)],['Does anyone use the U-Turn?',['Yes','No']]]
    :s.id==='chl'?[['Who goes home?',CAST8.slice(0,4).map(c=>c.nm)],['Does the daily winner flip the vote?',['Yes','No']]]
    :[['Big twist this week?',['Yes','No']],['Better than last week?',['Better','Worse']]];
  openSheet(`Call it · Episode ${e}`,'Private until it airs · see who got it after',Q.map(([q,o],i)=>`<p class="label cap">${q}</p><div>${o.map(x=>`<button class="chip" data-q="${i}">${x}</button>`).join('')}</div>`).join('')+`<button class="btn pri wide" id="wcGo" style="margin-top:12px">Lock in my calls</button>`,
    b=>{b.querySelectorAll('[data-q]').forEach(c=>c.onclick=()=>{b.querySelectorAll(`[data-q="${c.dataset.q}"]`).forEach(x=>x.classList.toggle('on',x===c))});$('wcGo').onclick=()=>{closeSheet();toast('Called it · change until it airs')}})}

// ---------- start a game for a show without one (and the Watch party card becomes Watch it together) ----------
const newGameSheetGame=newGameSheet;
newGameSheet=function(s){if(!s.kinds)return newGameW(s);newGameSheetGame(s);
  const c=$('sheet').querySelector('[data-n="Watch party"]');if(c){c.querySelector('b').textContent='Watch it together';c.querySelector('small').textContent='Invite the couch for the next episode';c.onclick=()=>{closeSheet();setTimeout(()=>inviteWatch(s),250)}}};
function newGameW(s){let g='pool',told=true;const others=(watchersOf(s)||[]).filter(n=>n!=='alex');
  openSheet('Start a game',`${s.name} · from Episode ${s.ep}`,
    `${[['pool','No draft · pick one survivor each episode · best for mid-season'],['lineup','Draft a roster, start your best each week'],['outlast','Draft a team, the last one standing carries you']].map(([k,d])=>`<button class="typecard${k===g?' on':''}" data-g="${k}"><span class="gdot" style="background:${GAMES[k].col}"></span><span><b>${GAMES[k].name}${k==='pool'?' · Recommended':''}</b><small>${d}</small></span></button>`).join('')}
     <button class="row" id="wTell" style="margin-top:6px"><span class="ic">${svg('bell')}</span><span class="tx"><b>Tell the couch</b><small>One alert: "alex started a game for ${s.name} · Join"${others.length?`. ${names(others)} ${others.length===1?'watches':'watch'} it.`:''}</small></span><span class="switch on" aria-hidden="true"><i></i></span></button>
     <button class="btn pri wide" id="wStart" style="margin-top:12px">Start it</button>`,
    b=>{b.querySelectorAll('[data-g]').forEach(x=>x.onclick=()=>{g=x.dataset.g;b.querySelectorAll('[data-g]').forEach(y=>y.classList.toggle('on',y===x))});
      $('wTell').onclick=()=>{told=!told;$('wTell').querySelector('.switch').classList.toggle('on',told)};
      $('wStart').onclick=()=>{W.games[s.id]={g,told};W.nudgeGone=true;closeSheet();toast(`${GAMES[g].name} started${told?' · the couch has been told':''}`);
        [FEED4,FEED12].forEach(F=>F.unshift(['alex',`started a ${GAMES[g].name}`,`${s.short} · from Episode ${s.ep} · tap to join`,null]));if(location.hash.startsWith('#/show/'))route()}})}

// ---------- Make it a game: one AI paste builds the cast and the scoring ----------
const AR_PASTE=`CAST: 11 teams, 22 racers
TEAMS: siblings, dating, best friends, married, father and son, mother and daughter, cousins, engaged, twins, coworkers, exes
SCORING: finish first on a leg, top half on a leg, win a Fast Forward, use the U-Turn, saved by a non-elimination leg, win the race
STATUS: 5 legs run, 2 teams eliminated`;
function makeGame(s){let step=0,pasted=false;
  const paint=pg=>{const b=pg.querySelector('#mkBody');
    b.innerHTML=step===0?`<span class="w-tg cap">Not a game yet</span><h2 class="cap">Make ${s.name} a game</h2>
      <p class="w-lede">One AI question finds the cast and what should score. Anyone can do it, it takes a couple of minutes, and after a quick review every couch can play it.</p>
      <div class="w-mkstep${pasted?' done':''}"><span class="n num">1</span><div><b>Ask an AI</b><small>We write the question. The free versions are plenty.</small>
        <div class="w-ais"><button data-ai="ChatGPT"><span class="ailogo" style="background:#10a37f">C</span>ChatGPT</button><button data-ai="Grok"><span class="ailogo" style="background:#e8e8e8;color:#111">G</span>Grok</button><button data-ai="copy">${svg('copy')}Copy it</button></div></div></div>
      <div class="w-mkstep${pasted?' done':''}"><span class="n num">2</span><div><b>Paste its answer back</b><small>Long-press its whole answer, Copy, come back here.</small>
        <button class="btn out wide" id="mkPaste" style="margin-top:10px">${svg('copy')}Paste the answer</button><textarea class="aibox${pasted?' filled':''}" id="mkBox" placeholder="Or paste here yourself">${pasted?AR_PASTE:''}</textarea>
        ${pasted?`<p class="aicheck ok">${svg('check')}Looks right: 11 teams, 22 racers, 6 scoring moments</p>`:''}</div></div>
      <button class="btn pri wide cap big" id="mkGo"${pasted?'':' disabled'}>Build the cast</button>`
    :`<span class="w-tg cap good">Ready to check</span><h2 class="cap">Does this<br>look right?</h2><p class="w-lede">From your paste. Fix anything now, or later from Backstage.</p>
      <div class="sh" style="padding:0;margin-top:18px"><h2 class="cap" style="font-size:22px">11 teams</h2><span class="aside">2 already out</span></div>
      <div class="w-roles">${ROLES.ar.map((r,i)=>`<div class="w-role${i>8?' out':''}">${svg('people')}<span><b>Team ${i+1}</b><small>${r}${i>8?' · out':''}</small></span></div>`).join('')}</div>
      <div class="sh" style="padding:0;margin-top:20px"><h2 class="cap" style="font-size:22px">What scores</h2><span class="aside">Balanced</span></div>
      ${[['Finish first on a leg','+3'],['Top half on a leg','+1'],['Win a Fast Forward','+2'],['Use the U-Turn','+1'],['Saved by a non-elimination leg','+1'],['Win the race','+10']].map(([t,p])=>`<div class="w-score"><span>${t}</span><b class="num">${p}</b></div>`).join('')}
      <p class="w-review">${svg('shield')}Shared with every couch after a quick review. You can play right now.</p>
      <button class="btn pri wide cap big" id="mkOk">Looks right · pick a game</button>`;
    b.querySelectorAll('[data-ai]').forEach(x=>x.onclick=()=>{toast(x.dataset.ai==='copy'?'Question copied. Paste it into any AI chat that can search the web.':`Opening ${x.dataset.ai}… (mock)`)});
    if($('mkPaste'))$('mkPaste').onclick=()=>{pasted=true;paint(pg)};
    if($('mkGo'))$('mkGo').onclick=()=>{step=1;paint(pg);pg.scrollTop=0};
    if($('mkOk'))$('mkOk').onclick=()=>{s.unready=false;s.todo={kind:'Play',t:'Set up · start a game',d:'Survival Pool from Episode '+s.ep};closePage();route();setTimeout(()=>newGameW(s),300)}};
  openPage('Make it a game',`<div class="w-mk" id="mkBody"></div>`,pg=>paint(pg))}

// ---------- Watch it together: invite ahead for the live airing, or a shared start ----------
function inviteWatch(s){const t=nextAir(s.air),ep=s.ep;let how='live',when=fmtT(t);const fans=watchersOf(s)||[],who=new Set(fans.filter(n=>n!=='alex'));
  openSheet('Watch it together',`${s.name} · Episode ${ep}`,
    `<button class="typecard on" data-how="live"><span class="gdot" style="background:var(--live)"></span><span><b>The live airing</b><small>${fmtT(t)} · everyone follows the broadcast, Ad break included</small></span></button>
     <button class="typecard" data-how="start"><span class="gdot" style="background:var(--good)"></span><span><b>Start together</b><small>Streaming · one shared clock · anyone can pause for everyone</small></span></button>
     <div id="wWhen" hidden><p class="label cap">Start at</p>${['8:30 PM','9:00 PM','9:30 PM','10:00 PM'].map((x,i)=>`<button class="chip${i===1?' on':''}" data-at="${x}">${x}</button>`).join('')}</div>
     <p class="label cap">Invite</p><div>${crowdOf().filter(n=>n!=='alex').map(n=>`<button class="chip${who.has(n)?' on':''}" data-p="${n}">${n}${fans.includes(n)?'':' · new to it'}</button>`).join('')}</div>
     <p class="muted small" style="line-height:1.45;margin-top:4px">Can't make it? They can watch along later. Everyone's reactions wait for them.</p>
     <button class="btn pri wide" id="wSend" style="margin-top:12px">Send invites</button>`,
    b=>{b.querySelectorAll('[data-how]').forEach(x=>x.onclick=()=>{how=x.dataset.how;b.querySelectorAll('[data-how]').forEach(y=>y.classList.toggle('on',y===x));$('wWhen').hidden=how!=='start';when=how==='live'?fmtT(t):`${DAY[t.getDay()]} ${b.querySelector('[data-at].on').dataset.at}`});
      b.querySelectorAll('[data-at]').forEach(x=>x.onclick=()=>{b.querySelectorAll('[data-at]').forEach(y=>y.classList.toggle('on',y===x));when=`${DAY[t.getDay()]} ${x.dataset.at}`});
      b.querySelectorAll('[data-p]').forEach(x=>x.onclick=()=>{x.classList.toggle('on');x.classList.contains('on')?who.add(x.dataset.p):who.delete(x.dataset.p);$('wSend').disabled=!who.size});
      $('wSend').onclick=()=>{const at=new Date(t);if(how==='start'){const [hh,mm]=b.querySelector('[data-at].on').dataset.at.split(/[: ]/);at.setHours(+hh%12+12,+mm,0,0)}
        W.plans[s.id]={how,when,who:[...who],at,ep:s.ep,mine:true};closeSheet();toast(`Invites sent · ${s.short}, ${when}`);
        [FEED4,FEED12].forEach(F=>F.unshift(['alex','invited the couch to watch along',`${s.short} · ${how==='live'?'the live airing':'starting together'} · ${when}`,null]));if(location.hash.startsWith('#/show/'))route()}})}
partySheet=()=>inviteWatch(SHOWS.find(x=>x.id==='trt')||SHOWS[0]);

// ---------- Watch along: GIFs, the screen stays on, and together sessions with pause for everyone ----------
const GIFS=[['OMG','#e56b9f','#8f3a6a'],['Slow clap','#ffc531','#b07d10'],['I knew it','#35b5a5','#16665c'],['Nope','#f2545b','#7a1d22'],['Popcorn','#f2804b','#8a3f17'],['Crying','#5089c9','#22466e'],['Plot twist','#a76bb0','#4d2a57'],['Iconic','#f4f2f8','#8d889c'],['Screaming','#e0a312','#6d4c05']];
const openWatchBase=openWatch,closeWatchBase=closeWatch;
openWatch=function(sid,opts={}){if(!WADATA[sid])sid='bd';openWatchBase(sid);const el=$('wa'),s=SHOWS.find(x=>x.id===sid),plan=opts.together;wa.together=plan||null;
  el.querySelector('.wa-top small').insertAdjacentHTML('afterend',`<span class="w-awake">${svg('bolt')}Screen stays on</span>`);
  const stk=el.querySelector('[data-sticker]');if(stk)stk.remove();
  el.querySelector('.rxbar').insertAdjacentHTML('beforeend',`<button class="stk" data-gif aria-label="Send a GIF">GIF</button>`);el.querySelector('[data-gif]').onclick=gifSheet;
  el.querySelector('.clock').insertAdjacentHTML('afterend',`<div class="w-pausebar" id="wPause" hidden></div>`);
  if(plan){const st=$('waStart');st.querySelector('h3').innerHTML=`Watching<br>together`;st.querySelector('p').textContent=`${names(plan.who)} ${plan.how==='live'?'are on the live airing':'start with you'}. Anyone can pause for everyone, and late arrivals watch along after.`;
    st.querySelector(`[data-start="${plan.how==='live'?'stream':'live'}"]`).remove();const c=st.querySelector('[data-start]');c.classList.add('first');
    c.innerHTML=`<span class="ic">${svg(plan.how==='live'?'tv':'play')}</span><span>${plan.how==='live'?'Join the live airing':'Start together'}<small>${plan.how==='live'?'Tap Ad break when the ads start, so everyone stays in step':'3, 2, 1 for everyone in it'}</small></span>`;
    el.querySelector('.wa-top small').textContent=`Together · ${names(plan.who)}`}
  el.querySelectorAll('[data-start]').forEach(b=>b.addEventListener('click',()=>{try{navigator.wakeLock&&navigator.wakeLock.request('screen').then(l=>wa.lock=l).catch(()=>{})}catch(e){}
    setTimeout(()=>{if(UI.wa&&wa.run)addGif(wa.t,(watchersOf(s)||['riley']).find(n=>n!=='alex')||'riley',1,false)},5000);
    if(plan&&plan.how==='start')setTimeout(()=>{if(!UI.wa||!wa.run)return;const who=plan.who[0];wa.run=false;el.classList.add('paused');$('waPP').innerHTML=`${svg('play')}Resume`;pauseBar(`${who} paused for everyone`,true)},9000)}));
  if(plan&&plan.how==='start'){const pp=$('waPP').onclick;$('waPP').onclick=()=>{pp();$('waPP').innerHTML=wa.run?`${svg('pause')}Pause for everyone`:`${svg('play')}Resume for everyone`;pauseBar(wa.run?'':'You paused for everyone',false)};$('waPP').innerHTML=`${svg('pause')}Pause for everyone`}};
function pauseBar(t,btn){const p=$('wPause');if(!t){p.hidden=true;return}p.hidden=false;p.innerHTML=`${svg('pause')}<span>${t}</span>${btn?'<button id="wRes">Resume for everyone</button>':''}`;if(btn)$('wRes').onclick=()=>{wa.run=true;wa.last=0;$('wa').classList.remove('paused');$('waPP').innerHTML=`${svg('pause')}Pause for everyone`;p.hidden=true}}
closeWatch=function(){try{wa.lock&&wa.lock.release()}catch(e){}closeWatchBase()};
function gifSheet(){const paint=(b,q)=>{const g=b.querySelector('#gg');const list=GIFS.map((x,i)=>[x,i]).filter(([x])=>!q||x[0].toLowerCase().includes(q.toLowerCase()));
    g.innerHTML=list.map(([x,i])=>`<button class="w-gif" data-g="${i}" style="--a:${x[1]};--b:${x[2]}"><b class="cap">${x[0]}</b></button>`).join('')||'<p class="muted small">No GIFs for that</p>';
    g.querySelectorAll('[data-g]').forEach(x=>x.onclick=()=>{closeSheet();addGif(wa.t,'alex',+x.dataset.g,true)})};
  openSheet('Send a GIF',`At ${fmtRT(wa.t)} · the couch sees it when they reach this moment`,`<label class="srch">${svg('search')}<input id="gq" placeholder="Search GIFs" autocomplete="off"></label><div class="w-gifs" id="gg"></div><p class="w-giphy">GIF search by GIPHY · mock tiles here</p>${wa.d.cast?'<button class="btn out wide" id="gstk">Cast stickers instead</button>':''}`,
    b=>{paint(b,'');b.querySelector('#gq').oninput=e=>paint(b,e.target.value);const st=b.querySelector('#gstk');if(st)st.onclick=()=>{closeSheet();setTimeout(stickerPicker,250)}})}
function addGif(ts,n,i,me){const ul=$('waS');if(!ul)return;const x=GIFS[i];const li=document.createElement('li');li.className='cm w-gifcm'+(me?' mine':'');
  li.innerHTML=`${av(n,30)}<div><div class="h"><b>${n}</b><span>at ${fmtRT(ts)}</span></div><span class="w-gif sm" style="--a:${x[1]};--b:${x[2]}"><b class="cap">${x[0]}</b></span></div>`;ul.appendChild(li);while(ul.children.length>6)ul.firstChild.remove()}

// ---------- the hub: who's watching what, the both-watch nudge, activity in Chatter ----------
[FEED4,FEED12].forEach((F,i)=>{F.unshift(['sam','started watching Pluribus','Episode 1 · left 9 reactions for whoever watches next',null],['jordan','is on Episode 5 of The Amazing Race','',null]);
  const m=F.find(e=>e[1]==='started a Watch party');if(m){m[1]='invited the couch to watch along';m[2]='Traitors 5 · the live airing · Thu 9:00 PM · 6 going'}});
const hubBase=hub;
hub=function(){let h=hubBase();
  const yours='<section class="sec"><div class="sh"><h2 class="cap">Your shows</h2>',ranks='<section class="sec"><div class="sh"><h2 class="cap">Power rankings</h2>';
  h=h.replace(yours,nudgeHTML()+yours).replace(ranks,couchWatchHTML()+ranks)
    .replace('<strong>Watch party</strong><small>Host Thursday\'s Traitors · chat in sync</small>','<strong>Watch it together</strong><small>Invite the couch for Thursday\'s Traitors</small>');
  return h};
function nudgeHTML(){const s=SHOWS.find(x=>x.id==='ar');if(!s||W.nudgeGone||W.games.ar||!follows(s))return '';const o=(watchersOf(s)||[]).filter(n=>n!=='alex');if(!o.length)return '';
  return `<section class="sec"><div class="w-nudge"><img src="${ART(s.art)}" alt=""><div class="in"><span class="tg cap">You both watch</span><b>${o.length>1?`You, ${names(o)} all watch`:`You and ${names(o)} both watch`} ${s.name}</b><small>Nobody's playing it yet. Start a game and the couch hears about it once.</small>
    <div class="w-nbtns"><button class="btn pri" id="wNGo">${s.unready?'Make it a game':'Start a game'}</button><button class="btn out" id="wNNo">Not now</button></div></div></div></section>`}
function couchWatchHTML(keep=()=>true){const list=SHOWS.filter(keep).map(s=>({s,o:(watchersOf(s)||[]).filter(n=>n!=='alex')})).filter(x=>x.o.length).sort((a,b)=>(follows(a.s)-follows(b.s))||b.o.length-a.o.length);
  return `<section class="sec"><div class="sh"><h2 class="cap">The couch is watching</h2><span class="aside">Tap to check one out</span></div><div class="w-cw" id="wCW">${list.map(({s,o})=>{const live=NOW[s.id];
    return `<button class="w-cwc" data-cw="${s.id}"><span class="pic"><img src="${ART(s.art)}" alt="" style="object-position:${s.pos}">${follows(s)?'':'<span class="w-new cap">Not on your list</span>'}${live?`<span class="w-on cap"><i></i>${live} is on</span>`:''}</span>
      <b class="cap">${s.name}</b><span class="ppl">${o.slice(0,3).map(n=>`<span>${av(n,20)}${n} · ${NOW[s.id]===n?'now':whereOf(s,n)>=airedOf(s)?'caught up':'Ep '+whereOf(s,n)}</span>`).join('')}${o.length>3?`<span class="more">+${o.length-3} more</span>`:''}</span></button>`}).join('')}</div></section>`}
const wireHubBase=wireHub;
wireHub=function(){wireHubBase();
  app.querySelectorAll('[data-cw]').forEach(b=>b.onclick=()=>location.hash=`#/show/${b.dataset.cw}/tonight`);if($('wCW'))hscroll($('wCW'));
  if($('wNGo'))$('wNGo').onclick=()=>{const s=SHOWS.find(x=>x.id==='ar');location.hash='#/show/ar/tonight';setTimeout(()=>s.unready?makeGame(s):newGameW(s),350)};
  if($('wNNo'))$('wNNo').onclick=()=>{W.nudgeGone=true;$('wNNo').closest('.sec').remove();toast('Got it. We won\'t ask about this one again')}};
const wirePostersBase=wirePosters;
wirePosters=function(){wirePostersBase();app.querySelectorAll('.poster [data-open]').forEach(o=>o.onclick=()=>location.hash=`#/show/${o.dataset.open}/tonight`)};
const heroActionBase=heroAction;
heroAction=function(){const s=SHOWS.find(x=>x.id===sel);if(!s.kinds)return location.hash=`#/show/${s.id}/tonight`;heroActionBase()};
const heroHTMLBase=heroHTML;
heroHTML=function(anim){const s=SHOWS.find(x=>x.id===sel),h=heroHTMLBase(anim);return s.kinds?h:h.replace(`<h1 class="cap">${s.name}</h1>`,`<h1 class="cap"><a href="#/show/${s.id}/tonight" class="hlink">${s.name}${svg('chev')}</a></h1>`)};
