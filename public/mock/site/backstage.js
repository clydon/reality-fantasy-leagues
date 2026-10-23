// ================= Backstage, in depth =================
// One home (jobs + an index of pages, like a phone's settings) and five pages behind it.
// Casual first: nothing here is required weekly except checking results, and even that can run itself.
const BS={autopilot:false,quick:true,quickFound:true,rulesPreset:'Balanced',rules:null,rulesChanged:false,applyFrom:'next',window:'open',claimsIn:['riley','jordan','sam'],ran:false,games:{lineup:{starters:3,bench:2}}};
const RULES=[['Challenges',[['tribeImmunity','Tribe immunity',3],['individualImmunity','Individual immunity',6],['rewardWin','Reward win',2],['chosenForReward','Picked for reward',1]]],
  ['Tribal council',[['votedWithMajority','Voted with the majority',2],['survivedVotes','Survived votes against',2],['zeroVotesSafe','Zero votes, safe',2],['votedOut','Voted out',-4]]],
  ['Advantages',[['idolFound','Found an idol',4],['idolPlayed','Played an idol',2],['votesNegated','Votes cancelled by an idol',6]]],
  ['Endgame',[['finalist','Made the final',6],['soleSurvivor','Won the season',6],['juryVote','Each jury vote',2]]]];
const PRESETS={Casual:1,Balanced:0,Competitive:-1};
function rulesVal(k,d){BS.rules=BS.rules||{};return BS.rules[k]??d}
const _bsOld=backstageRoute;
backstageRoute=function(sid,page){const s=SHOWS.find(x=>x.id===sid);
  const head=(title,back)=>`<header class="sbar"><img src="${ART(s.art)}" alt="" style="object-position:${s.hpos||s.pos}"><div class="sbar-top"><a class="back" href="${back}">${svg('chev')}${back.endsWith('backstage')?'Backstage':s.name.replace('The ','')}</a><span class="sbar-st">${svg('key')}You run this</span><span style="width:44px"></span></div><b class="cap sbar-name">${title}</b></header>`;
  const bsHome=`#/show/${sid}/backstage`;
  const body=({results:bsResults,waivers:bsWaivers,rules:bsRules,members:bsMembers,settings:bsSettings})[page];
  if(body){app.innerHTML=`<div class="show">${head(({results:'Results',waivers:'Waivers',rules:'Scoring rules',members:'Members & roles',settings:'Game settings'})[page],bsHome)}<div class="show-body">${body(s)}</div></div>`;wireBS(sid,page);$('scroller').scrollTop=0;return}
  const job=!SHOWSTATE.resultsDone;
  app.innerHTML=`<div class="show">${head('Backstage',`#/show/${sid}/tonight`)}<div class="show-body">
    <section class="blk"><div class="sh"><h2 class="cap">Needs you</h2><span class="aside">${job?'1 job':'All clear'}</span></div>
      ${job?`<a class="job" href="${bsHome}/results"><span class="ic" style="background:var(--chyron);color:var(--ink)">${svg('quiz')}</span><span class="tx"><span class="kind cap">All 3 games</span><b>Check Episode 4's full results</b><small>Found overnight · 7 results to tick · one apply covers every game</small></span><span class="st">Check</span>${svg('chev')}</a>`
        :`<div class="clear">${svg('check')}<span><b>You're all caught up</b><small>Next: Episode 5's quick check runs about 30 minutes after it airs</small></span></div>`}
    </section>
    <section class="blk"><div class="sh"><h2 class="cap">Survivor 51</h2><span class="aside">Couch Cup · 3 games</span></div>
      ${[['results','quiz','Results',BS.autopilot?'Autopilot on · checks the morning after':'Quick check on · full results by copy and paste'],
         ['waivers','swap','Waivers',BS.window==='open'?`Window open · ${BS.claimsIn.length} of 4 claims in · runs Tue 8:05 PM`:'No window open'],
         ['rules','cup','Scoring rules',`${BS.rulesPreset} · Weekly Lineup and Outlast${BS.rulesChanged?' · edited':''}`],
         ['members','people','Members & roles',`${crowdOf().length} players · you and riley run games${SHOWSTATE.reqDone?'':' · 1 request'}`],
         ['settings','gear','Game settings','Lineup size, joining, lock it down, end a game']].map(([k,ic,t,d])=>`<a class="idx" href="${bsHome}/${k}"><span class="ic">${svg(ic)}</span><span class="tx"><b>${t}</b><small>${d}</small></span>${k==='members'&&!SHOWSTATE.reqDone?'<span class="cdot"></span>':''}${svg('chev')}</a>`).join('')}
    </section>
    <section class="blk"><p class="muted small" style="line-height:1.5">Backstage is only for people who run a game. Players never see it. Hand a game to someone else, or share it, in Members & roles.</p></section>
    <div style="height:40px"></div></div></div>`;
  $('scroller').scrollTop=0};

// ---------- Results ----------
function bsResults(s){return `
  <section class="blk"><div class="sh"><h2 class="cap">Tonight: who went home</h2><span class="aside">Settles Pool + Outlast</span></div>
    <div class="qcheck"><div class="qh"><span class="ai">${svg('bolt')}</span><div><b>Quick check</b><small>A low-cost search runs 30 and 60 minutes after airtime. Free, on by default.</small></div><button class="switch${BS.quick?' on':''}" id="quickT" aria-pressed="${BS.quick}"><i></i></button></div>
      ${BS.quick?`<div class="found"><img src="${ph(S51C('Thien'))}" alt=""><div><span class="cap kind">Episode 5 · found 8:41 PM</span><b>Thien An Nguyen voted out</b><small>3 sources agree · high confidence</small></div></div>
      <div class="frow"><button class="btn pri" id="qConfirm">${SHOWSTATE.res==='early'?'Confirmed':'Confirm'}</button><button class="btn out" id="qWrong">Not right</button></div>`:`<p class="muted small" style="margin-top:8px">Off: tap who went home yourself after the episode, from Tonight.</p>`}
    </div></section>
  <section class="blk"><div class="sh"><h2 class="cap">Morning after: everything</h2><span class="aside">Settles Weekly Lineup</span></div>
    <div class="paths"><button class="path${BS.autopilot?'':' on'}" data-path="free"><b>Copy and paste</b><small>Free · copy our question into any AI chat, paste the answer back. About 2 minutes.</small></button>
      <button class="path${BS.autopilot?' on':''}" data-path="auto"><span class="opt cap">Optional</span><b>Autopilot</b><small>Runs at 7:00 AM and waits for you to tick and apply. Saves those 2 minutes.</small></button></div>
    ${!BS.autopilot&&!BS.pasted&&!SHOWSTATE.resultsDone?`<div class="aicta" style="margin-top:14px"><b>Fill in Episode 4</b><small>We open your AI with the question ready. It searches, answers, and you paste its answer back. Takes about 2 minutes.</small><button class="btn pri wide" id="askNow">${svg('bolt')}Ask an AI</button></div>`:SHOWSTATE.resultsDone?`<div class="clear">${svg('check')}<span><b>Episode 4 applied</b><small>To Outlast, Weekly Lineup and Survival Pool · Undo until Episode 5 airs</small></span></div>`:`
    <div class="sh" style="margin-top:18px"><h2 class="cap" style="font-size:20px">Episode 4 · ${BS.autopilot?'found at 7:02 AM':'pasted at 8:15 AM'}</h2><span class="aside">Tick what's right</span></div>
    ${[['Voted out','Jenna',null,'Jenna Doore · 5 of 6 votes'],['Won immunity','Dina',['Kristin','Mike'],'Dina tribe · Kristin, Mike and 4 others'],['Won reward','Toka',['Brady'],'Toka tribe'],['Found an idol','Eric',null,'Eric Macksoud · found at camp'],['Voted with the majority','Mike',['Kristin','Brady'],'Mike, Kristin, Brady and 5 others'],['Played an idol','—',null,'Low confidence · check first',true]].map(([k,n,more,d,low],i)=>`<button class="resrow${low?'':' on'}" data-r="${i}"><span class="tickbox">${svg('check')}</span>${TRIBES[n]?`<span class="tribeface" style="background:${TRIBES[n]}"></span>`:n!=='—'?`<img src="${ph(S51C(n))}" alt="">`:`<span class="noface">?</span>`}<span class="tx"><span class="kind cap">${k}</span><b>${d}</b>${low?'<small class="low">Research disagrees · nothing will be applied unless you tick it</small>':''}</span></button>`).join('')}
    <button class="btn pri wide" id="applyAll" style="margin-top:14px">Apply 5 results to 3 games</button>`}
  </section><div style="height:40px"></div>`}

// ---------- Waivers ----------
function bsWaivers(s){const ppl=crowdOf().slice(0,4);return `
  <section class="blk"><div class="plate"><span class="tg cap">${BS.window==='open'?'Window':'Closed'}</span><span class="bd"><span class="t cap">${BS.window==='open'?'Claims run Tue 8:05 PM':'No window open'}</span><span class="d">${BS.window==='open'?`Replace anyone out · 1 swap each · ${BS.claimsIn.length} of 4 claims in`:'Players replace castaways who are out when a window opens'}</span></span></div></section>
  ${BS.window==='open'?`<section class="blk"><div class="sh"><h2 class="cap">Who's claimed</h2><span class="aside">Claims stay private until they run</span></div>
    ${ppl.map(n=>{const inn=BS.claimsIn.includes(n);return `<div class="rolemem">${av(n,32)}<span class="tx"><b>${n}${n==='alex'?' <span class="you">YOU</span>':''}</b><small>${inn?'Claim in':'No claim yet'}</small></span>${inn?`<span class="okchip">${svg('check')}In</span>`:(n==='alex'?`<a class="rolebtn" href="#/show/${s.id}/cast">Make your claim</a>`:`<button class="rolebtn" data-claimfor="${n}">Claim for them</button>`)}</div>`}).join('')}
    <div class="frow" style="margin-top:14px"><button class="btn pri" id="runNow">Run now</button><button class="btn out" id="extend">Extend a day</button><button class="btn out" id="closeW">Close</button></div></section>`
  :`<section class="blk"><button class="btn pri wide" id="openW">Open a waiver window</button></section>`}
  ${BS.ran?`<section class="blk"><div class="sh"><h2 class="cap">Last run</h2><button class="link" id="undoRun">Undo</button></div>
    <div class="srow"><img class="sface" src="${ph(S51C('Maggie'))}" alt=""><span>riley got Maggie <small class="muted">for Thien</small></span></div>
    <div class="srow"><img class="sface" src="${ph(S51C('Devin'))}" alt=""><span>jordan got Devin <small class="muted">for Rob</small></span></div>
    <div class="srow"><img class="sface" src="${ph(S51C('Linnea'))}" alt=""><span>sam got Linnea <small class="muted">2nd choice</small></span></div></section>`:''}
  <section class="blk"><div class="sh"><h2 class="cap">How it works here</h2><a class="link" href="#/show/${s.id}/backstage/settings">Change</a></div>
    <p class="muted small" style="line-height:1.55">Someone out? Their points stay, and you replace them at the next window. One swap per window for anyone still in. Claims are ranked; the worst-placed player gets first pick. After claims run, free agency until airtime.</p></section><div style="height:40px"></div>`}

// ---------- Scoring rules ----------
function bsRules(s){const d=PRESETS[BS.rulesPreset];return `
  <section class="blk"><div class="sh"><h2 class="cap">Weekly Lineup</h2><span class="aside">Survivor scoring</span></div>
    <div class="segm" id="preset">${Object.keys(PRESETS).map(k=>`<button class="${BS.rulesPreset===k?'on':''}" data-p="${k}">${k}</button>`).join('')}</div>
    <small class="muted small" style="display:block;margin-top:8px;line-height:1.45">${BS.rulesPreset==='Casual'?'Bigger points for everyone, fewer penalties. Comebacks are easy.':BS.rulesPreset==='Competitive'?'Penalties count. Every decision matters.':'The defaults most leagues use.'}</small></section>
  ${RULES.map(([grp,rows])=>`<section class="blk"><span class="cap grp">${grp}</span>${rows.map(([k,label,def])=>{const base=def<0?def+d:def+(d>0?1:d<0?0:0),v=rulesVal(k,base);return `<div class="rule${BS.rules&&BS.rules[k]!==undefined?' edited':''}"><span class="tx"><b>${label}</b>${BS.rules&&BS.rules[k]!==undefined?'<small>Edited</small>':''}</span><span class="stepper"><button data-rk="${k}" data-d="-1" data-b="${base}" aria-label="Less">−</button><b class="num ${v<0?'neg':''}">${v>0?'+':''}${v}</b><button data-rk="${k}" data-d="1" data-b="${base}" aria-label="More">+</button></span></div>`}).join('')}</section>`).join('')}
  <section class="blk"><span class="cap grp">Outlast</span><div class="rule"><span class="tx"><b>Each boot outlasted</b><small>Plus 1 for being drafted</small></span><span class="stepper"><b class="num">+1</b></span></div></section>
  ${BS.rulesChanged?`<div class="savebar"><div class="segm" style="margin:0 0 10px">${[['next','From Episode 6'],['all','Rescore the season']].map(([k,l])=>`<button class="${BS.applyFrom===k?'on':''}" data-af="${k}">${l}</button>`).join('')}</div><button class="btn pri wide" id="saveRules">Save rules</button><small class="muted small" style="display:block;text-align:center;margin-top:6px">${BS.applyFrom==='all'?'Standings will change. The couch gets a heads-up.':'Past episodes keep their points.'}</small></div>`:''}
  <div style="height:${BS.rulesChanged?160:40}px"></div>`}

// ---------- Members & roles ----------
function bsMembers(s){const R=SHOWSTATE.roles,ppl=crowdOf();return `
  ${SHOWSTATE.reqDone?'':`<section class="blk"><div class="req"><span class="stack">${av('kat',30)}</span><span class="tx"><b>kat asked to join Weekly Lineup</b><small>On the couch since Tuesday</small></span><button class="btn pri sm" data-req="ok">Let in</button><button class="btn out sm" data-req="no">${svg('x')}</button></div></section>`}
  <section class="blk"><div class="sh"><h2 class="cap">Who runs what</h2></div>
    ${Object.keys(GAMES).map(k=>`<button class="rolerow" data-game="${k}"><span class="gdot" style="background:${GAMES[k].col}"></span><b>${GAMES[k].name}</b><span class="stack">${Object.keys(R).filter(n=>k==='pool'?n==='riley':true).map(n=>av(n,26)).join('')}</span>${svg('chev')}</button>`).join('')}</section>
  <section class="blk"><div class="sh"><h2 class="cap">Players</h2><button class="link" id="inv">Invite</button></div>
    ${ppl.map(n=>`<div class="rolemem">${av(n,32)}<span class="tx"><b>${n}${n==='alex'?' <span class="you">YOU</span>':''}</b><small>${R[n]==='commish'?'Commissioner':R[n]==='admin'?'Game admin':'Player'} · ${n==='sam'?'Weekly Lineup, Pool':'all 3 games'}</small></span><button class="rolebtn" data-role="${n}">${svg('dots')}</button></div>`).join('')}</section>
  <section class="blk"><p class="muted small" style="line-height:1.5"><b style="color:var(--bone)">Commissioner:</b> results, waivers, rules and roles. <b style="color:var(--bone)">Game admin:</b> results and waivers, and can pick for people in a draft. Roles can be shared, so two people can run a game.</p></section><div style="height:40px"></div>`}

// ---------- Game settings ----------
function bsSettings(s){const J=SHOWSTATE.join||{pool:['shared','open'],lineup:['exclusive','ask'],outlast:['exclusive','locked']};SHOWSTATE.join=J;const L=BS.games.lineup;return `
  <section class="blk"><div class="game" style="--g:#ffc531"><div class="gh"><span class="gbar"></span><div><h2 class="cap">Weekly Lineup</h2><small>Couch Cup · exclusive ownership</small></div></div></div>
    <div class="rule"><span class="tx"><b>Starters</b><small>Who scores each episode</small></span><span class="stepper"><button data-gs="starters" data-d="-1">−</button><b class="num">${L.starters}</b><button data-gs="starters" data-d="1">+</button></span></div>
    <div class="rule"><span class="tx"><b>Bench</b><small>Roster size ${L.starters+L.bench}</small></span><span class="stepper"><button data-gs="bench" data-d="-1">−</button><b class="num">${L.bench}</b><button data-gs="bench" data-d="1">+</button></span></div>
    <a class="idx" href="#/show/${s.id}/backstage/waivers"><span class="tx"><b>Waivers</b><small>Replace when out · 1 swap per window</small></span>${svg('chev')}</a></section>
  <section class="blk"><div class="game" style="--g:#f2804b"><div class="gh"><span class="gbar"></span><div><h2 class="cap">Outlast</h2><small>Team of 4 · snake draft · done</small></div></div></div>
    <a class="idx" href="#/show/${s.id}/draft"><span class="tx"><b>Draft room</b><small>Completed · reopen to review picks</small></span>${svg('chev')}</a></section>
  ${joinRulesBlock()}
  <section class="blk"><details class="danger"><summary>${svg('key')}Danger zone</summary>
    <button class="row" data-end="archive"><span class="tx"><b>Archive a game</b><small>Keeps it on the trophy shelf, stops scoring</small></span></button>
    <button class="row" data-end="delete"><span class="tx"><b style="color:var(--live)">Delete a game</b><small>Removes it for everyone. Can't be undone.</small></span></button></details></section><div style="height:40px"></div>`}

function wireBS(sid,page){const re=()=>backstageRoute(sid,page);
  const q=$('quickT');if(q)q.onclick=()=>{BS.quick=!BS.quick;re()};
  const qc=$('qConfirm');if(qc)qc.onclick=()=>{SHOWSTATE.res='early';SHOWSTATE.phase='after';toast('Confirmed. Survival Pool and Outlast are settled; players can reveal.');re()};
  const qw=$('qWrong');if(qw)qw.onclick=()=>{closeSheet();whoOutSheet()};
  app.querySelectorAll('[data-path]').forEach(b=>b.onclick=()=>{BS.autopilot=b.dataset.path==='auto';toast(BS.autopilot?'Autopilot on: results wait for you each morning':'Copy and paste: we\'ll remind you each morning');re()});
  app.querySelectorAll('[data-r]').forEach(r=>r.onclick=()=>{r.classList.toggle('on');const n=app.querySelectorAll('[data-r].on').length;$('applyAll').textContent=`Apply ${n} results to 3 games`});
  const an=$('askNow');if(an)an.onclick=()=>askAI({title:'Fill in Episode 4',what:'Your AI searches the web for everything that happened in Survivor 51 Episode 4, then answers in a format we can read.',brief:'gameyourshow.com/b/K7Q2-ep4',onDone:()=>{BS.pasted=true;toast('Read 6 results. Tick what\'s right.');re()}});
  const ap=$('applyAll');if(ap)ap.onclick=()=>{SHOWSTATE.resultsDone=true;confetti();toast('Applied to all 3 games');re()};
  app.querySelectorAll('[data-claimfor]').forEach(b=>b.onclick=()=>{BS.claimsIn.push(b.dataset.claimfor);toast(`Claim entered for ${b.dataset.claimfor}`);re()});
  const rn=$('runNow');if(rn)rn.onclick=()=>{BS.ran=true;BS.window='closed';confetti();toast('Waivers ran · 3 players got someone');re()};
  const ex=$('extend');if(ex)ex.onclick=()=>toast('Extended to Wed 8:05 PM · the couch has been told');
  const cw=$('closeW');if(cw)cw.onclick=()=>{BS.window='closed';re()};const ow=$('openW');if(ow)ow.onclick=()=>{BS.window='open';re()};
  const ur=$('undoRun');if(ur)ur.onclick=()=>{BS.ran=false;BS.window='open';toast('Waiver run undone · claims are back');re()};
  app.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{BS.rulesPreset=b.dataset.p;BS.rules=null;BS.rulesChanged=true;re()});
  app.querySelectorAll('[data-rk]').forEach(b=>b.onclick=()=>{const k=b.dataset.rk,base=+b.dataset.b;BS.rules=BS.rules||{};BS.rules[k]=(BS.rules[k]??base)+ +b.dataset.d;BS.rulesChanged=true;const y=$('scroller').scrollTop;re();$('scroller').scrollTop=y});
  app.querySelectorAll('[data-af]').forEach(b=>b.onclick=()=>{BS.applyFrom=b.dataset.af;const y=$('scroller').scrollTop;re();$('scroller').scrollTop=y});
  const sr=$('saveRules');if(sr)sr.onclick=()=>{BS.rulesChanged=false;toast(BS.applyFrom==='all'?'Season rescored · the couch got a heads-up':'Saved · new rules from Episode 6');re()};
  app.querySelectorAll('[data-req]').forEach(b=>b.onclick=()=>{SHOWSTATE.reqDone=true;toast(b.dataset.req==='ok'?'kat is in Weekly Lineup':'Declined quietly');re()});
  app.querySelectorAll('[data-role]').forEach(b=>b.onclick=()=>memberSheet(b.dataset.role,sid));
  app.querySelectorAll('[data-game]').forEach(b=>b.onclick=()=>gameRoleSheet(b.dataset.game,sid));
  const iv=$('inv');if(iv)iv.onclick=couchSheet;
  app.querySelectorAll('[data-gs]').forEach(b=>b.onclick=()=>{const k=b.dataset.gs;BS.games.lineup[k]=Math.max(k==='starters'?1:0,Math.min(5,BS.games.lineup[k]+ +b.dataset.d));toast(`${k==='starters'?'Starters':'Bench'} changes from Episode 6`);re()});
  app.querySelectorAll('[data-end]').forEach(b=>b.onclick=()=>openSheet(b.dataset.end==='archive'?'Archive a game?':'Delete a game?','Pick which one',Object.keys(GAMES).map(k=>`<button class="row" data-x="${k}"><span class="gdot" style="background:${GAMES[k].col}"></span><span class="tx"><b>${GAMES[k].name}</b></span></button>`).join('')+'<button class="btn out wide" data-close2 style="margin-top:10px">Cancel</button>',bb=>{bb.querySelectorAll('[data-x]').forEach(x=>x.onclick=()=>{closeSheet();toast(`${GAMES[x.dataset.x].name} ${b.dataset.end==='archive'?'archived':'deleted'} (mock: nothing really changed)`)});bb.querySelector('[data-close2]').onclick=closeSheet}));
  if(page==='settings')wireJoinRules(sid)}
function memberSheet(n,sid){const cur=SHOWSTATE.roles[n]||'player';
  openSheet(n,'Survivor 51 · Couch Cup',[['commish','Commissioner','Results, waivers, rules and roles'],['admin','Game admin','Results and waivers, can pick for people'],['player','Player','Plays; sees nothing backstage']].map(([k,t,d])=>`<button class="typecard${cur===k?' on':''}" data-k="${k}"><span><b>${t}</b><small>${d}</small></span></button>`).join('')+(n!=='alex'?`<button class="row" data-rm style="margin-top:8px"><span class="tx"><b style="color:var(--live)">Remove from this show's games</b><small>They stay on the couch</small></span></button>`:`<p class="muted small" style="margin-top:8px">To step down, make someone else Commissioner first.</p>`),
    b=>{b.querySelectorAll('[data-k]').forEach(x=>x.onclick=()=>{const k=x.dataset.k;if(k==='player')delete SHOWSTATE.roles[n];else SHOWSTATE.roles[n]=k;closeSheet();toast(`${n} is now ${k==='commish'?'a Commissioner':k==='admin'?'a Game admin':'a Player'}`);backstageRoute(sid,'members')});
      const rm=b.querySelector('[data-rm]');if(rm)rm.onclick=()=>{closeSheet();toast(`${n} removed (mock)`)}})}
function gameRoleSheet(g,sid){const R=SHOWSTATE.roles;openSheet(GAMES[g].name,'Who runs it',crowdOf().map(n=>`<button class="rolemem" style="width:100%" data-t="${n}">${av(n,30)}<span class="tx"><b>${n}</b><small>${R[n]==='commish'?'Commissioner':R[n]==='admin'?'Game admin':'Player'}</small></span><span class="switch${R[n]?' on':''}"><i></i></span></button>`).join('')+`<p class="muted small" style="margin-top:10px">Share it: turn on as many people as you like.</p>`,
  b=>b.querySelectorAll('[data-t]').forEach(x=>x.onclick=()=>{const n=x.dataset.t;if(n==='alex')return toast('Hand it to someone else first');R[n]?delete R[n]:R[n]='admin';x.querySelector('.switch').classList.toggle('on',!!R[n]);x.querySelector('small').textContent=R[n]?'Game admin':'Player'}))}
