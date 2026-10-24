// ================= settings, swept for newcomers =================
// Organised by the question people actually have; plain words, not mechanisms; every choice says what
// it does; recommended defaults marked; changed settings get a dot and "Reset to recommended";
// simple toggles save instantly (with Undo); only changes that move standings ask first.
const REC={starters:3,bench:2,join:{pool:'open',lineup:'ask',outlast:'locked'},competitive:false};
const ACCT={notif:{lineup:true,early:true,final:true,chat:'quiet',invites:true},spoilers:{notifs:true,hub:true},theme:'night',ai:'chatgpt'};
function undoToast(msg,undo){toast(msg);UI.undo=undo}
// ---------- Game settings ----------
bsSettings=function(s){const L=BS.games.lineup,J=SHOWSTATE.join||{pool:['shared','open'],lineup:['exclusive','ask'],outlast:['exclusive','locked']};SHOWSTATE.join=J;
  const dot=c=>c?'<span class="chg" title="Changed from recommended"></span>':'';
  const lineupChanged=L.starters!==REC.starters||L.bench!==REC.bench;
  return `<section class="blk"><div class="qsec"><h2 class="cap">How Weekly Lineup works</h2>${lineupChanged?`<button class="link" data-reset="lineup">Reset to recommended</button>`:''}</div>
    <div class="explain">Each week, <b>${L.starters} of your ${L.starters+L.bench}</b> castaways score. You pick which before the episode.</div>
    <div class="rule"><span class="tx"><b>Who scores each week ${dot(L.starters!==REC.starters)}</b><small>${L.starters===REC.starters?'Recommended':'Recommended: 3'}</small></span><span class="stepper"><button data-gs="starters" data-d="-1" aria-label="Fewer">−</button><b class="num">${L.starters}</b><button data-gs="starters" data-d="1" aria-label="More">+</button></span></div>
    <div class="rule"><span class="tx"><b>On the bench ${dot(L.bench!==REC.bench)}</b><small>Backups who don't score until you start them</small></span><span class="stepper"><button data-gs="bench" data-d="-1" aria-label="Fewer">−</button><b class="num">${L.bench}</b><button data-gs="bench" data-d="1" aria-label="More">+</button></span></div>
    <p class="note">${svg('cal')}Changes start with Episode 6. Nobody loses points already scored.</p></section>
  <section class="blk"><div class="qsec"><h2 class="cap">Who can join</h2></div>
    ${Object.keys(GAMES).map(g=>{const [own,mode]=J[g];const opts=own==='shared'?[['open','Anyone on the couch','They can catch up on missed episodes'],['ask','Ask me first','You get a request to approve'],['locked','Nobody new','The game is full for the season']]:[['ask','Ask me first','You get a request to approve'],['locked','Nobody new','The game is full for the season']];
      return `<div class="jq"><div class="jgh"><span class="gdot" style="background:${GAMES[g].col}"></span><b>${GAMES[g].name}</b>${dot(mode!==REC.join[g])}</div>
        <small class="own2">${own==='shared'?'Castaways can be on several teams, so new players can jump in.':'Each castaway is on one team, so new players need your OK.'}</small>
        ${opts.map(([k,t,d])=>`<button class="radio${mode===k?' on':''}" data-jr="${g}:${k}"><i></i><span><b>${t}${k===REC.join[g]?' <em>Recommended</em>':''}</b><small>${d}</small></span></button>`).join('')}</div>`}).join('')}</section>
  <section class="blk"><div class="qsec"><h2 class="cap">Replacing people who leave</h2></div>
    <a class="idx" href="#/show/${s.id}/backstage/waivers"><span class="tx"><b>When someone's voted out, players replace them</b><small>At the next waiver window · claims run Tue 8:05 PM · Recommended</small></span>${svg('chev')}</a></section>
  <section class="blk"><div class="qsec"><h2 class="cap">Competitive mode</h2></div>
    <div class="lockdown"><span class="tx"><b>Lock it down ${dot(!!SHOWSTATE.locked)}</b><small>No late joins, no catch-up, rules frozen for the season. Off is best for most groups.</small></span><button class="switch${SHOWSTATE.locked?' on':''}" id="lockAll" aria-pressed="${!!SHOWSTATE.locked}"><i></i></button></div></section>
  <section class="blk"><details class="danger"><summary>${svg('key')}Archive or delete a game</summary>
    <button class="row" data-end="archive"><span class="tx"><b>Archive a game</b><small>Keeps it on the trophy shelf, stops scoring</small></span></button>
    <button class="row" data-end="delete"><span class="tx"><b style="color:var(--live)">Delete a game</b><small>Removes it for everyone. Can't be undone.</small></span></button></details></section><div style="height:40px"></div>`};
// joining controls on the game settings page save instantly, with undo
wireJoinRules=function(sid){app.querySelectorAll('[data-jr]').forEach(b=>b.onclick=()=>{const [g,k]=b.dataset.jr.split(':'),prev=SHOWSTATE.join[g][1];SHOWSTATE.join[g][1]=k;undoToast(`Saved: ${GAMES[g].name} · ${b.querySelector('b').textContent.replace('Recommended','').trim()}`,()=>{SHOWSTATE.join[g][1]=prev});const y=$('scroller').scrollTop;backstageRoute(sid,'settings');$('scroller').scrollTop=y});
  const l=$('lockAll');if(l)l.onclick=()=>{SHOWSTATE.locked=!SHOWSTATE.locked;toast(SHOWSTATE.locked?'Competitive mode on':'Back to casual');const y=$('scroller').scrollTop;backstageRoute(sid,'settings');$('scroller').scrollTop=y};
  app.querySelectorAll('[data-reset]').forEach(b=>b.onclick=()=>{BS.games.lineup={starters:REC.starters,bench:REC.bench};toast('Back to recommended: 3 score, 2 on the bench');backstageRoute(sid,'settings')})};

// ---------- Account settings (#/account) ----------
function accountRoute(){const tg=(on,id)=>`<button class="switch${on?' on':''}" data-tog="${id}" aria-pressed="${on}"><i></i></button>`;const A=ACCT;
  app.innerHTML=`<div class="show"><header class="acct-h"><a class="back plain" href="#/hub">${svg('chev')}Home</a><b class="cap">Settings</b><span style="width:72px"></span></header><div class="show-body">
    <section class="blk"><div class="me-card">${av('alex',56)}<div><b>alex</b><small>On Couch Council and Work Crew · since Survivor 49</small></div><button class="rolebtn">Edit</button></div></section>
    <section class="blk"><div class="qsec"><h2 class="cap">What we notify you about</h2></div>
      <div class="lockdown"><span class="tx"><b>Lineup reminders</b><small>2 hours before your moves lock, only if something's open</small></span>${tg(A.notif.lineup,'lineup')}</div>
      <div class="lockdown"><span class="tx"><b>Early results are in</b><small>Who went home, minutes after the episode</small></span>${tg(A.notif.early,'early')}</div>
      <div class="lockdown"><span class="tx"><b>Final scores are in</b><small>The morning after</small></span>${tg(A.notif.final,'final')}</div>
      <div class="lockdown"><span class="tx"><b>Invites and join requests</b><small>Someone joins your couch or asks to join a game</small></span>${tg(A.notif.invites,'invites')}</div>
      <div class="jq"><div class="jgh"><b>Couch chat</b></div>${[['all','Every message',''],['quiet','Quiet on episode nights','Catch up when you reveal'],['off','Never','Check chat when you open the app']].map(([k,t,d])=>`<button class="radio${A.notif.chat===k?' on':''}" data-chat="${k}"><i></i><span><b>${t}${k==='quiet'?' <em>Recommended</em>':''}</b>${d?`<small>${d}</small>`:''}</span></button>`).join('')}</div></section>
    <section class="blk"><div class="qsec"><h2 class="cap">Keeping you spoiler-free</h2></div>
      <div class="lockdown"><span class="tx"><b>No results in notifications</b><small>"Episode 5 results are in", never who went home. Recommended</small></span>${tg(A.spoilers.notifs,'s-notifs')}</div>
      <div class="lockdown"><span class="tx"><b>Hide scores until I reveal</b><small>On the hub, posters and standings. Recommended</small></span>${tg(A.spoilers.hub,'s-hub')}</div></section>
    <section class="blk"><div class="qsec"><h2 class="cap">Your AI for results</h2></div>
      <p class="explain">When you fill in results or add a show, we open your AI with the question ready. Free versions work.</p>
      ${[['chatgpt','ChatGPT','Opens the app or chatgpt.com'],['grok','Grok','Opens the app or grok.com'],['ask','Ask each time','Choose when it comes up'],['copy','I\'ll copy and paste','Works with any AI']].map(([k,t,d])=>`<button class="radio${A.ai===k?' on':''}" data-ai2="${k}"><i></i><span><b>${t}${k==='chatgpt'?' <em>Recommended</em>':''}</b><small>${d}</small></span></button>`).join('')}</section>
    <section class="blk"><div class="qsec"><h2 class="cap">Appearance</h2></div><div class="segm">${[['night','Night'],['studio','Studio'],['phone','Match phone']].map(([k,l])=>`<button class="${A.theme===k?'on':''}" data-th="${k}">${l}</button>`).join('')}</div></section>
    <section class="blk"><div class="qsec"><h2 class="cap">Your couches</h2></div>
      ${[['Couch Council','4 people · Survivor 51, Traitors 5'],['Work Crew','12 people · The Traitors 5']].map(([n,d])=>`<a class="idx" href="#/hub"><span class="tx"><b>${n}</b><small>${d}</small></span>${svg('chev')}</a>`).join('')}</section>
    <section class="blk"><div class="qsec"><h2 class="cap">Help</h2></div>
      <button class="idx" data-help="rules"><span class="tx"><b>How each game works</b><small>Outlast, Weekly Lineup, Survival Pool in plain words</small></span>${svg('chev')}</button>
      <button class="idx" data-help="tour"><span class="tx"><b>Take the tour again</b><small>5 minutes on a practice season</small></span>${svg('chev')}</button>
      <button class="idx" data-help="report"><span class="tx"><b>Report a problem</b><small>Goes straight to us</small></span>${svg('chev')}</button></section>
    <section class="blk"><button class="btn out wide" id="logout" style="color:var(--live)">Log out</button></section><div style="height:40px"></div></div></div>`;
  app.querySelectorAll('[data-tog]').forEach(b=>b.onclick=()=>{const id=b.dataset.tog,on=!b.classList.contains('on');b.classList.toggle('on',on);b.setAttribute('aria-pressed',on);if(id.startsWith('s-'))ACCT.spoilers[id.slice(2)]=on;else ACCT.notif[id]=on;toast(on?'On · saved':'Off · saved')});
  const radio=(sel,fn)=>app.querySelectorAll(sel).forEach(b=>b.onclick=()=>{b.parentElement.querySelectorAll(sel).forEach(x=>x.classList.toggle('on',x===b));fn(b);toast('Saved')});
  radio('[data-chat]',b=>ACCT.notif.chat=b.dataset.chat);radio('[data-ai2]',b=>{ACCT.ai=b.dataset.ai2;if(['chatgpt','grok'].includes(ACCT.ai))AI.pref=ACCT.ai});
  app.querySelectorAll('[data-th]').forEach(b=>b.onclick=()=>{ACCT.theme=b.dataset.th;app.querySelectorAll('[data-th]').forEach(x=>x.classList.toggle('on',x===b));toast(b.dataset.th==='studio'?'Studio (light) is in the real app; the mock stays on Night':'Saved')});
  app.querySelectorAll('[data-help]').forEach(b=>b.onclick=()=>b.dataset.help==='rules'?rulesSheet('lineup'):toast(b.dataset.help==='tour'?'The tour lives in the real app':'Thanks: a report form opens here'));
  $('logout').onclick=()=>{location.hash='#/signup'};$('scroller').scrollTop=0}
