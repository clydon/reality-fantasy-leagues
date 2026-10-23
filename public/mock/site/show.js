// ================= the show space =================
// One show for one couch. Tabs are per show (Tonight · Episodes · Standings · Cast · Chat); the
// games (Outlast, Weekly Lineup, Survival Pool) live inside them, never as a switcher.
const GAMES={outlast:{name:'Outlast',line:'Draft a team. Last one standing carries you.',col:'#f2804b'},lineup:{name:'Weekly Lineup',line:'Start your best three each week.',col:'#ffc531'},pool:{name:'Survival Pool',line:'Pick one survivor each episode. Never the same twice.',col:'#35b5a5'}};
const TRIBES={Toka:'#ffd700',Savu:'#9b6bd0',Dina:'#f3214a'};
const S51C=n=>by(S51,n);
// Outlast teams on real Survivor 51 castaways (statuses and exits are real)
const TEAMS={alex:['Kristin','Mike','Jenna','Eric'],riley:['Carter','Danny','Thien','Alexis'],jordan:['Lewis','Rob','Brady','Linnea'],sam:['Maggie','Sharonda','Patt','Jelly'],
  maya:['Devin','Cristian','Ana','Ori'],dev:['Brady','Eric','Aaliyah','Sharonda'],priya:['Kristin','Thien','Linnea','Jelly'],luis:['Maggie','Ori','Patt','Mike'],kat:['Carter','Alexis','Rob','Cristian'],ben:['Danny','Lewis','Jenna','Devin'],noor:['Sharonda','Eric','Ana','Thien'],theo:['Mike','Jelly','Aaliyah','Maggie']};
const EXITED=()=>S51.cast.filter(c=>c.exitEp).length;
const outlastPts=n=>{const c=S51C(n);if(!c)return 0;const total=EXITED();return 1+(c.exitEp?S51.cast.filter(x=>x.exitEp&&x.exitEp<c.exitEp).length:total)};
const LINEUP_PTS={alex:20,riley:38,jordan:18,sam:16,maya:31,dev:27,priya:34,luis:22,kat:19,ben:14,noor:24,theo:12};
const LINEUP_WK={alex:6,riley:15,jordan:6,sam:4,maya:9,dev:7,priya:12,luis:5,kat:6,ben:3,noor:8,theo:2};
const POOL={alex:{streak:3,picks:['Kristin','Maggie','Brady']},riley:{streak:4,picks:['Carter','Eric','Kristin','Sharonda']},jordan:{streak:2,picks:['Lewis','Danny']},sam:{streak:1,picks:['Patt','Mike','Thien']},
  maya:{streak:4,picks:['Devin','Maggie','Lewis','Carter']},dev:{streak:2,picks:['Eric','Brady']},priya:{streak:3,picks:['Thien','Kristin','Alexis']},luis:{streak:1,picks:['Ana','Ori']},kat:{streak:3,picks:['Alexis','Carter','Maggie']},ben:{streak:0,picks:['Jenna']},noor:{streak:2,picks:['Sharonda','Eric']},theo:{streak:1,picks:['Mike']}};
let SHOWSTATE={tab:'tonight',phase:'before',revealed:4,roles:{alex:'commish',riley:'admin'},filter:'All',pool:null,preds:{}};

function showRoute(sid,tab){const s=SHOWS.find(x=>x.id===sid);if(!s)return hubRoute();
  if(!s.kinds&&N!==1){return whereSheet(s)}SHOWSTATE.tab=tab||'tonight';if(N===1&&(SHOWSTATE.tab==='standings'||SHOWSTATE.tab==='chat'))SHOWSTATE.tab='tonight';
  app.innerHTML=`<div class="show">${showBar(s)}<div class="show-body" id="showBody">${({tonight:tabTonight,episodes:tabEpisodes,standings:tabStandings,cast:tabCast,chat:tabChat})[SHOWSTATE.tab](s)}</div>${dockHTML(s)}${tabBar(s)}</div>`;
  wireShow(s);$('scroller').scrollTop=0}
const isCommish=()=>!!SHOWSTATE.roles.alex;
function showBar(s){const t=nextAir(s.air),phs=SHOWSTATE.phase,big=SHOWSTATE.tab==='tonight';
  const status=SHOWSTATE.revealed>=5?`Ep 6 · <span data-cd="${t.getTime()}">—</span>`:phs==='during'?`<span class="dotlive"></span>On air · Ep ${s.ep}`:phs==='after'?(SHOWSTATE.res==='waiting'?`Ep ${s.ep} just aired`:`Ep ${s.ep} early results`):`Ep ${s.ep} · <span data-cd="${t.getTime()}">—</span>`;
  return `<header class="sbar${big?' xl':''}${phs==='during'?' live':''}"><img src="${ART(s.art)}" alt="" style="object-position:${s.hpos||s.pos}">
    <div class="sbar-top"><a class="back" href="#/hub">${svg('chev')}Home</a><span class="sbar-st">${status}</span><button class="iconbtn" id="showMenu" aria-label="Show menu">${svg('dots')}${isCommish()&&!SHOWSTATE.resultsDone?'<span class="dot"></span>':''}</button></div>
    ${big?`<h1 class="cap">${s.name.replace('The ','')}<small>${s.season}</small></h1><div class="sbar-couch"><span class="stack">${crowdOf().slice(0,6).map(n=>av(n,24)).join('')}</span>${N===1?'Watching solo':'Couch Council · '+s.kinds.length+' games'}</div>`:`<b class="cap sbar-name">${s.name} · ${s.season.replace('Season ','S')}</b>`}</header>`}
function tabBar(s){let T=[['tonight','Tonight','tv'],['episodes','Episodes','cal'],['standings','Standings','cup'],['cast','Cast','people'],['chat','Chat','chatb']];if(N===1)T=T.filter(t=>t[0]!=='standings'&&t[0]!=='chat');
  const due=dueInShow(s);return `<nav class="tabbar" style="grid-template-columns:repeat(${T.length},1fr)">${T.map(([k,l,i])=>`<a href="#/show/${s.id}/${k}" class="${SHOWSTATE.tab===k?'on':''}">${svg(i)}${l}${k==='tonight'&&due?`<span class="bang">${due}</span>`:''}${k==='chat'?'<span class="cnt">3</span>':''}</a>`).join('')}</nav>`}
const dueInShow=s=>N===1?0:SHOWSTATE.revealed>=5&&s.id==='surv'?1:s.id!=='surv'?(s.id==='trt'&&!state.banish?1:0):movesOpen();

// ---------- Tonight ----------
function tabTonight(s){if(N===1)return soloTonight(s);const phs=SHOWSTATE.phase,sv=s.id==='surv';
  const jobs=sv?[
    ['lineup','Weekly Lineup','lineup','Set your lineup',MOVES.starters.size>=3?[...MOVES.starters].join(', ')+' · change until Wed':`${MOVES.starters.size} of 3 set · locks Wed 8:05 PM`,MOVES.starters.size>=3?'Set':`${3-MOVES.starters.size} open`],
    ['pool','Survival Pool','shield','Pick who survives',SHOWSTATE.pool?`You picked ${SHOWSTATE.pool}`:'Streak 3 · picks close at airtime',SHOWSTATE.pool?'Picked':'Not yet'],
    ['predict','Predictions','quiz','Answer 2 predictions',Object.keys(SHOWSTATE.preds).length>=2?'Both in · scored after the episode':'Who goes home · Will an idol be played',Object.keys(SHOWSTATE.preds).length>=2?'In':'2 open'],
    ['bingo','Bingo','bingo','Your bingo card','Ready for Wednesday · marks open at airtime','Ready',true]].concat(isCommish()&&!SHOWSTATE.resultsDone?[['results','Backstage · you run this','key','Fill in Episode 4\'s results','One fill covers all 3 games · 2 found so far','Start']]:[])
    :[['banish','Outlast','quiz','Who gets banished?',state.banish?`You picked ${first(state.banish)}`:'Picks close Thu 9:00 PM',state.banish?'In':'Open']];
  const done=jobs.filter(j=>j[6]||/Set|Picked|In|Ready/.test(j[5])).length;
  const control='';
  return `${catchupStrip()}${control}<div class="phase">${[['before','Before','Get set'],['during','During','Watch along'],['after','After','Results']].map(([k,l,sm])=>`<button data-ph="${k}" class="${phs===k?'on':''}${phs==='during'&&k==='during'?' live':''}"><b>${l}</b><small>${sm}</small></button>`).join('')}</div>
  ${phs==='before'?`<section class="blk"><div class="sh"><h2 class="cap">Before ${DAY[s.air[0]]==='Wed'?'Wednesday':'Thursday'}</h2><span class="aside">${done} of ${jobs.length} done</span></div>
    <div class="segbar">${jobs.map(j=>`<i class="${j[6]||/Set|Picked|In|Ready/.test(j[5])?'on':''}"></i>`).join('')}</div>
    ${jobs.map(([k,g,ic,t,d,st,ready])=>{const ok=ready||/Set|Picked|In|Ready/.test(st);return `<button class="job${ok?' done':''}${k==='results'?' bs':''}" data-job="${k}"><span class="ic">${svg(ic)}</span><span class="tx"><span class="kind cap">${g}</span><b>${t}</b><small>${d}</small></span><span class="st">${st}</span>${svg('chev')}</button>`}).join('')}</section>
    <button class="wacta" data-job="watch"><img src="${ART(s.art)}" alt="" style="object-position:${s.hpos||s.pos}"><span class="tg cap">Wed 8:05 PM</span><b class="cap">Watch along</b><small>Start when your episode starts · the couch's comments land as you reach them</small></button>`:''}
  ${phs==='during'?`<button class="wacta live" data-job="watch"><img src="${ART(s.art)}" alt="" style="object-position:${s.hpos||s.pos}"><span class="tg cap live"><i></i>On air</span><b class="cap">Watch along</b><small>riley and sam are watching · your bingo card and lineup come with you</small></button>
    <section class="blk"><div class="sh"><h2 class="cap">Tonight</h2><span class="aside">Locked at 8:05 PM</span></div>
    <button class="job" data-job="bingo"><span class="ic">${svg('bingo')}</span><span class="tx"><b>Bingo</b><small>${state.bingo.size-1} marked · first line wins bragging rights</small></span>${svg('chev')}</button>
    <button class="job" data-job="lineup"><span class="ic stackic">${['Kristin','Mike','Brady'].map(n=>`<img src="${ph(S51C(n))}" alt="">`).join('')}</span><span class="tx"><b>Your lineup is in</b><small>Points stay hidden until you reveal</small></span>${svg('chev')}</button>
    <button class="job" data-job="pool"><span class="ic"><img src="${ph(S51C(SHOWSTATE.pool||'Brady'))}" alt=""></span><span class="tx"><b>Survival Pool: ${SHOWSTATE.pool||'Brady'}</b><small>Streak 3 on the line</small></span>${svg('chev')}</button></section>`:''}
  ${phs==='after'?afterBlock(s):''}
  <section class="blk"><div class="sh"><h2 class="cap">Your games</h2><a class="link" href="#/show/${s.id}/standings">Standings</a></div>
    <div class="gcards">${s.kinds.map(g=>gameCard(g)).join('')}${`<button class="gcard add" data-job="newgame">${svg('plus')}<b>Start a game</b><small>Anyone on the couch can</small></button>`}</div></section>`}
function gameCard(g){const me=standing(g).findIndex(r=>r.n==='alex')+1,G=GAMES[g];
  return `<a class="gcard" href="#/show/surv/standings" style="--g:${G.col}"><span class="kind cap">${G.name}</span><b class="num${me===1?' first':''}">${ordinal(me)}</b><small>${g==='lineup'?LINEUP_PTS.alex+' pts':g==='pool'?'streak '+POOL.alex.streak:TEAMS.alex.filter(n=>!S51C(n).exitEp).length+' of 4 still in'}</small></a>`}
const ordinal=n=>n+(['th','st','nd','rd'][n%10>3||Math.floor(n%100/10)===1?0:n%10]||'th');
function afterBlock(s){const rev=SHOWSTATE.revealed>=5;
  return rev?`<section class="blk"><div class="plate"><span class="tg live cap">Out</span><span class="bd"><span class="t cap">Thien An Nguyen</span><span class="d">Blindsided · 3 votes to 2</span></span></div>
    <div class="plate" style="margin-top:10px"><span class="tg good cap">You</span><span class="bd"><span class="t cap">+14 · up to 1st</span><span class="d">Weekly Lineup · Survival Pool streak 4</span></span></div></section>`
    :`<section class="blk"><button class="plate" data-job="reveal"><span class="tg cap">Ep ${s.ep}</span><span class="bd"><span class="t cap">Results are in</span><span class="d">Reveal when you're ready · nothing shows until then</span></span><span class="go">${svg('chev')}</span></button></section>`}

// ---------- Episodes ----------
function tabEpisodes(s){const exits={};S51.cast.filter(c=>c.exitEp).forEach(c=>(exits[c.exitEp]||(exits[c.exitEp]=[])).push(c));
  const rows=[];for(let e=SHOWSTATE.revealed;e>=1;e--){const out=exits[e]||[];rows.push(`<button class="eprow" data-ep="${e}"><span class="n num">${e}</span><span class="faces">${out.map(c=>`<img src="${ph(c)}" alt="">`).join('')}</span><span class="tx"><b>${out.map(c=>first(c.name)).join(' and ')||'No one'} out</b><small>${e===1?'Before your games started':`You +${[0,0,12.5,1.5,6][e]||0} in Weekly Lineup`}</small></span>${svg('chev')}</button>`)}
  return `<section class="blk"><div class="sh"><h2 class="cap">Episode ${s.ep}</h2><span class="aside">This week</span></div>
    ${SHOWSTATE.phase==='after'&&SHOWSTATE.revealed<5?`<button class="plate" data-job="reveal"><span class="tg cap">Ep 5</span><span class="bd"><span class="t cap">Results are in</span><span class="d">Hidden until you reveal</span></span><span class="go">${svg('chev')}</span></button>`
    :`<div class="upnext"><img src="${ART(s.art)}" alt="" style="object-position:${s.hpos||s.pos}"><div><b class="cap">Airs ${fmtT(nextAir(s.air))}</b><small>3 of 4 lineups set · 2 of 4 picked</small></div></div>`}</section>
  <section class="blk"><div class="sh"><h2 class="cap">Every episode</h2><span class="aside">${S51.cast.length-EXITED()} still in</span></div>${rows.join('')}
    <div class="eprow ghost"><span class="n num">6</span><span class="tx"><b>+ 7 still to air</b><small>Episodes 6 to 13 · finale in December</small></span></div></section>`}
function episodePage(e){const out=S51.cast.filter(c=>c.exitEp===e),scored=S51.cast.filter(c=>c.perEp[e-1]).sort((a,b)=>b.perEp[e-1]-a.perEp[e-1]).slice(0,5);
  openPage(`Episode ${e}`,`<div class="blk" style="margin-top:12px">${out.map(c=>`<div class="plate outp"><img src="${ph(c)}" alt=""><span class="tg live cap">Out</span><span class="bd"><span class="t cap">${c.name}</span><span class="d">Finished ${ordinal(S51.cast.length-S51.cast.filter(x=>x.exitEp&&x.exitEp<e).length)}</span></span></div>`).join('')}</div>
    <section class="blk"><div class="sh"><h2 class="cap">Your games</h2></div>
      <div class="gline"><span class="kind cap" style="color:#ffc531">Weekly Lineup</span><b>+${[0,0,12.5,1.5,6][e]||0}</b><small>Kristin +5 · Mike +5${e===4?' · Jenna −4':''}</small></div>
      <div class="gline"><span class="kind cap" style="color:#35b5a5">Survival Pool</span><b>${e>1?'Survived':'—'}</b><small>${e>1?`You picked ${POOL.alex.picks[e-2]||'Kristin'}`:'Pool started Episode 2'}</small></div>
      <div class="gline"><span class="kind cap" style="color:#f2804b">Outlast</span><b>${TEAMS.alex.filter(n=>S51C(n).exitEp===e).length?'Lost one':'All safe'}</b><small>${TEAMS.alex.filter(n=>!S51C(n).exitEp||S51C(n).exitEp>e).length} of 4 still in after this episode</small></div></section>
    <section class="blk"><div class="sh"><h2 class="cap">Top scorers</h2></div>${scored.map((c,i)=>`<div class="srow"><span class="r num">${i+1}</span><img class="sface" src="${ph(c)}" alt="">${c.name}<span class="t num">+${c.perEp[e-1]}</span></div>`).join('')}</section>
    <section class="blk"><div class="sh"><h2 class="cap">What happened</h2></div>${[['Reward','Toka'],['Immunity','Dina'],['Tribal','Savu']].map(([k,t])=>`<div class="happ"><span class="cap">${k}</span><span class="chip" style="background:${TRIBES[t]};color:${t==='Savu'?'#fff':'#121018'}">${t}</span></div>`).join('')}</section><div style="height:40px"></div>`)}

// ---------- Standings ----------
function standing(g){const ppl=crowdOf();
  if(g==='lineup')return ppl.map(n=>({n,t:LINEUP_PTS[n],w:LINEUP_WK[n]})).sort((a,b)=>b.t-a.t);
  if(g==='pool')return ppl.map(n=>({n,t:POOL[n].streak})).sort((a,b)=>b.t-a.t);
  return ppl.map(n=>({n,t:TEAMS[n].reduce((a,c)=>a+outlastPts(c),0),left:TEAMS[n].filter(c=>!S51C(c).exitEp).length})).sort((a,b)=>b.t-a.t)}
function tabStandings(s){const sec=g=>{const G=GAMES[g],rows=standing(g);
  return `<section class="blk game" style="--g:${G.col}"><div class="gh"><span class="gbar"></span><div><h2 class="cap">${G.name}</h2><small>${G.line}</small></div><button class="link" data-rules="${g}">Rules</button></div>
    ${rows.map((r,i)=>{const me=r.n==='alex',lead=i===0&&rows[1]&&rows[1].t<r.t;
      const extra=g==='outlast'?`<span class="tfaces">${TEAMS[r.n].map(c=>{const x=S51C(c);return `<img class="${x.exitEp?'out':''}" src="${ph(x)}" alt="${x.name}">`}).join('')}</span>`
        :g==='pool'?`<span class="pk">${POOL[r.n].picks.slice(-3).map(c=>`<img src="${ph(S51C(c))}" alt="">`).join('')}</span>`:`<span class="wk">+${r.w}</span>`;
      return `<button class="strow${me?' me':''}${lead?' lead':''}" data-player="${r.n}" data-g="${g}"><span class="r num">${i>0&&rows[i-1].t===r.t?'T':''}${i+1}</span>${av(r.n,28)}<span class="nm">${r.n}${me?'<span class="you">YOU</span>':''}</span>${extra}<span class="t num">${r.t}</span></button>`}).join('')}</section>`};
  return `<div class="pillrow">${s.kinds.map(g=>`<a href="#g-${g}" class="pill" style="--g:${GAMES[g].col}">${GAMES[g].name}<b>${ordinal(standing(g).findIndex(r=>r.n==='alex')+1)}</b></a>`).join('')}</div>
    ${s.kinds.map(g=>`<div id="g-${g}"></div>`+sec(g)).join('')}<p class="muted foot-note">Through Episode ${SHOWSTATE.revealed}. Standings move when you reveal.</p>`}
function playerSheet(n,g){const t=TEAMS[n],G=GAMES[g];
  openSheet(n,`${G.name} · ${ordinal(standing(g).findIndex(r=>r.n===n)+1)} of ${N}`,
    g==='pool'?`<p class="label cap">Picks, oldest first</p><div class="pickhist">${POOL[n].picks.map((c,i)=>`<div><img src="${ph(S51C(c))}" alt=""><span class="ok">${svg('check')}</span><small>Ep ${i+2}</small></div>`).join('')}</div><p class="muted" style="margin-top:12px;font-size:14px">Streak ${POOL[n].streak}. Picks stay hidden from the couch until the episode airs.</p>`
    :g==='lineup'?`<div class="stat3"><div><b class="num">${LINEUP_PTS[n]}</b><small>Season</small></div><div><b class="num">+${LINEUP_WK[n]}</b><small>Last episode</small></div><div><b class="num">${(LINEUP_PTS[n]/3).toFixed(1)}</b><small>A week</small></div></div><p class="label cap">Last lineup</p><div class="tiles">${t.slice(0,3).map(c=>{const x=S51C(c);return `<div class="tile"><img src="${ph(x)}" alt=""><div class="cap">${first(x.name)}</div><small>${x.total} pts</small></div>`}).join('')}</div>`
    :`<p class="label cap">The team</p>${t.map(c=>{const x=S51C(c);return `<div class="bench${x.exitEp?' outrow':''}"><img src="${ph(x)}" alt=""><span class="tx"><b>${x.name}</b><small>${x.exitEp?`Out · Episode ${x.exitEp} · finished ${ordinal(S51.cast.length-S51.cast.filter(y=>y.exitEp&&y.exitEp<x.exitEp).length)}`:'Still in'}</small></span><b class="num" style="font-size:22px">${outlastPts(c)}</b></div>`}).join('')}`)}

// ---------- Cast ----------
function tabCast(s){const owners=c=>crowdOf().filter(n=>TEAMS[n].some(x=>c.name.startsWith(x)));const f=SHOWSTATE.filter;
  const list=S51.cast.filter(c=>f==='All'||(f==='Mine'?TEAMS.alex.some(x=>c.name.startsWith(x)):f==='Out'?c.exitEp:(c.tribe===f&&!c.exitEp))).sort((a,b)=>(!!a.exitEp-!!b.exitEp)||b.total-a.total);
  return `<div class="chips">${['All','Mine','Toka','Savu','Dina','Out'].map(k=>`<button class="chip${f===k?' on':''}" data-filter="${k}">${TRIBES[k]?`<i style="background:${TRIBES[k]}"></i>`:''}${k}</button>`).join('')}</div>
    <div class="castgrid">${list.map(c=>{const o=owners(c);return `<button class="ctile${c.exitEp?' out':''}" data-cast="${c.name}"><img src="${ph(c)}" alt=""><span class="tb" style="background:${TRIBES[c.tribe]||'#888'}"></span>${c.exitEp?`<span class="outtag cap">Out Ep ${c.exitEp}</span>`:''}<span class="cn cap">${first(c.name)}</span><span class="cm2"><b class="num">${c.total}</b> pts</span><span class="own">${o.slice(0,4).map(n=>`<i style="background:${col(n)}" title="${n}"></i>`).join('')}</span></button>`}).join('')}</div>`}
function castSheet(name){const c=S51.cast.find(x=>x.name===name),o=crowdOf().filter(n=>TEAMS[n].some(x=>name.startsWith(x))),max=Math.max(...c.perEp,1);
  openSheet(c.name,`${c.tribe} · ${c.exitEp?`out Episode ${c.exitEp}`:'still in'} · ${c.total} points`,
    `<div class="castbig"><img src="${ph(c)}" alt=""><div class="epbars">${c.perEp.map((v,i)=>`<div><i style="height:${Math.max(4,Math.abs(v)/max*80)}px;background:${v<0?'var(--field)':'var(--good)'}"></i><small>Ep ${i+1}</small><b class="num">${v>0?'+':''}${v}</b></div>`).join('')}</div></div>
     <p class="label cap">On the couch</p>${o.length?o.map(n=>`<div class="srow">${av(n,26)}${n}<span class="t" style="font-size:13px;color:var(--muted)">Outlast team</span></div>`).join(''):'<p class="muted">Nobody drafted them in Outlast. A free agent in Weekly Lineup.</p>'}
     ${!c.exitEp?`<button class="btn pri wide" style="margin-top:14px" id="startC">Start in Weekly Lineup</button>`:''}`,
    b=>{const sc=$('startC');if(sc)sc.onclick=()=>{closeSheet();toast(`${first(c.name)} isn't on your Weekly Lineup roster. Claim them in Backstage › Waivers.`)}})}

// ---------- Chat ----------
function tabChat(){return `<div class="chat" id="chat"><div class="dayl">Yesterday</div>${msgHTML('riley','Carter is running this camp already')}${msgHTML('jordan','tribal is going to be chaos')}${msgHTML('alex','Kristin found an idol clue??',true)}
  <div class="dayl">Today</div>${msgHTML('sam','who are we starting this week')}${msgHTML('riley','Carter, Mike, Danny. Not telling you why.')}<div class="sysline">${svg('eye')}riley revealed Episode 4</div></div>
  <div class="composer sticky"><input id="ci" placeholder="Message the Survivor 51 couch" aria-label="Message"><button id="cs" aria-label="Send">${svg('send')}</button></div>`}

// ---------- show menu + backstage ----------
function showMenu(s){openSheet(s.name,`${s.season} · Couch Council`,`
  ${isCommish()?`<a class="row" href="#/show/${s.id}/backstage"><span class="ic" style="background:var(--bone);color:var(--ink)">${svg('key')}</span><span class="tx"><b>Backstage</b><small>You run Weekly Lineup and Outlast · 1 job waiting</small></span>${svg('chev')}</a>`:''}
  <a class="row" href="#/show/${s.id}/draft"><span class="ic" style="background:#f2804b;color:var(--ink)">${svg('people')}</span><span class="tx"><b>Draft room</b><small>Couch Cup · Outlast snake draft (demo)</small></span>${svg('chev')}</a>
  <a class="row" href="#/show/${s.id}/blind"><span class="ic" style="background:var(--chyron);color:var(--ink)">${svg('eye')}</span><span class="tx"><b>Blind draft</b><small>Pick in private, reveal together (demo)</small></span>${svg('chev')}</a>
  <button class="row" data-m="invite"><span class="ic">${svg('people')}</span><span class="tx"><b>Invite to this show</b><small>Code K7Q2XZ · they join the couch too</small></span></button>
  <button class="row" data-m="newgame"><span class="ic">${svg('plus')}</span><span class="tx"><b>Start a game</b><small>Bingo night, predictions, a new league</small></span></button>
  <button class="row" data-m="rules"><span class="ic">${svg('quiz')}</span><span class="tx"><b>How these games work</b><small>Outlast, Weekly Lineup, Survival Pool in plain words</small></span></button>
  <button class="row" data-m="mute"><span class="ic">${svg('bell')}</span><span class="tx"><b>Notifications</b><small>Lineup reminders on · chat muted on episode nights</small></span></button>`,
  b=>{b.querySelectorAll('[data-m]').forEach(x=>x.onclick=()=>{const m=x.dataset.m;closeSheet();setTimeout(()=>{if(m==='invite')couchSheet();else if(m==='newgame')newGameSheet(s);else if(m==='rules')rulesSheet('lineup');else location.hash='#/account'},250)});b.querySelectorAll('a.row').forEach(a=>a.addEventListener('click',closeSheet))})}
function rulesSheet(g){const R={outlast:['Snake-draft a team of four before the season.','Each castaway earns 1 point, plus 1 for every boot they outlast.','So they end on their place in the boot order: the last one standing carries you.','No lineups to set. Just watch.'],lineup:['Draft a roster of five.','Before each episode, start three. Only starters score.','Points come from what happens: immunity, votes, idols, finals.','Lose someone? Claim a replacement on waivers.'],pool:['No draft. Each episode, pick one person you think survives.','Right: your streak grows. Wrong: it resets.','You can\'t pick the same person twice until everyone still in has been used.','Longest streak wins; ties go to most correct.']};
  openSheet(GAMES[g].name,GAMES[g].line,`<ol class="rules">${R[g].map(x=>`<li>${x}</li>`).join('')}</ol><div class="chips" style="padding:0;margin-top:14px">${Object.keys(GAMES).map(k=>`<button class="chip${k===g?' on':''}" data-r="${k}">${GAMES[k].name}</button>`).join('')}</div>`,
    b=>b.querySelectorAll('[data-r]').forEach(x=>x.onclick=()=>{closeSheet();setTimeout(()=>rulesSheet(x.dataset.r),220)}))}
function newGameSheet(s){openSheet('Start a game',`${s.name} · anyone on the couch can`,`
  ${[['outlast','Outlast','Draft before the season starts · this season is underway',true],['lineup','Weekly Lineup','A second league with different people or rules'],['pool','Survival Pool','Starts from the next episode · no draft']].map(([k,n,d,dis])=>`<button class="typecard${dis?' dim':''}" data-n="${n}" ${dis?'disabled':''}><span class="gdot" style="background:${GAMES[k].col}"></span><span><b>${n}</b><small>${d}</small></span></button>`).join('')}
  <p class="label cap">One night only</p>
  ${[['Bingo night','A card for Episode 5'],['Prediction round','3 calls for the couch'],['Watch party','Host Wednesday\'s episode']].map(([n,d])=>`<button class="typecard" data-n="${n}"><span class="gdot" style="background:var(--bone)"></span><span><b>${n}</b><small>${d}</small></span></button>`).join('')}`,
  b=>b.querySelectorAll('[data-n]:not([disabled])').forEach(x=>x.onclick=()=>{closeSheet();confetti();toast(`${x.dataset.n} started · the couch has been invited`)}))}
function backstageRoute(sid){const s=SHOWS.find(x=>x.id===sid);const R=SHOWSTATE.roles,ppl=crowdOf();
  app.innerHTML=`<div class="show"><header class="sbar"><img src="${ART(s.art)}" alt="" style="object-position:${s.hpos||s.pos}"><div class="sbar-top"><a class="back" href="#/show/${sid}/tonight">${svg('chev')}${s.name.replace('The ','')}</a><span class="sbar-st">Backstage</span><span style="width:44px"></span></div><b class="cap sbar-name">Backstage</b></header>
  <div class="show-body">
   <section class="blk"><div class="sh"><h2 class="cap">Jobs</h2><span class="aside">Only you see this</span></div>
     <button class="job" data-bs="results"><span class="ic" style="background:var(--chyron);color:var(--ink)">${svg('quiz')}</span><span class="tx"><span class="kind cap">Weekly Lineup · Outlast · Pool</span><b>Fill in Episode 4's results</b><small>Ask an AI chat, then paste · 2 found so far · one fill covers every game</small></span><span class="st">Start</span>${svg('chev')}</button>
     <button class="job" data-bs="waivers"><span class="ic">${svg('swap')}</span><span class="tx"><span class="kind cap">Weekly Lineup</span><b>Waiver window</b><small>Open · 3 claims in · runs Tue 8:05 PM</small></span>${svg('chev')}</button></section>
   <section class="blk"><div class="sh"><h2 class="cap">Who runs what</h2><button class="link" id="share">Share a role</button></div>
     ${Object.values(GAMES).map((G,i)=>{const k=Object.keys(GAMES)[i];return `<div class="rolerow"><span class="gdot" style="background:${G.col}"></span><b>${G.name}</b><span class="stack">${Object.keys(R).filter(n=>k==='pool'?n==='riley':true).map(n=>av(n,26)).join('')}</span></div>`}).join('')}
     <p class="muted" style="font-size:13px;margin-top:8px;line-height:1.45">Commissioners can fill in results, run waivers and change rules. Hand it off or share it any time; the couch sees who's running each game.</p></section>
   ${joinRulesBlock()}
   <section class="blk"><div class="sh"><h2 class="cap">Members</h2><span class="aside">${ppl.length} on this show</span></div>
     ${ppl.map(n=>`<div class="rolemem">${av(n,32)}<span class="tx"><b>${n}${n==='alex'?' <span class="you">YOU</span>':''}</b><small>${R[n]==='commish'?'Commissioner':R[n]==='admin'?'Game admin':'Player'}</small></span><button class="rolebtn" data-role="${n}">${R[n]?'Change':'Make admin'}</button></div>`).join('')}</section>
   <section class="blk"><div class="sh"><h2 class="cap">Rules</h2></div>
     ${Object.keys(GAMES).map(k=>`<button class="row" data-rule="${k}"><span class="ic"><span class="gdot" style="background:${GAMES[k].col}"></span></span><span class="tx"><b>${GAMES[k].name}</b><small>${k==='lineup'?'Start 3 · bench 2 · Survivor scoring':k==='pool'?'No repeats · streak, then most correct':'Team of 4 · snake draft'}</small></span>${svg('chev')}</button>`).join('')}</section>
   <div style="height:40px"></div></div></div>`;
  app.querySelectorAll('[data-bs]').forEach(b=>b.onclick=()=>b.dataset.bs==='results'?resultsSheet():toast('Waivers: 3 claims in. They run Tue 8:05 PM.'));
  app.querySelectorAll('[data-rule]').forEach(b=>b.onclick=()=>rulesSheet(b.dataset.rule));
  app.querySelectorAll('[data-role]').forEach(b=>b.onclick=()=>roleSheet(b.dataset.role,sid));$('share').onclick=()=>roleSheet('riley',sid);wireJoinRules(sid);tickCd()}
function roleSheet(n,sid){const cur=SHOWSTATE.roles[n]||'player';
  openSheet(n,'What can they do on Survivor 51?',[['commish','Commissioner','Results, waivers, rules and roles, for every game here'],['admin','Game admin','Results and waivers; can\'t change rules or roles'],['player','Player','Plays; sees nothing backstage']].map(([k,t,d])=>`<button class="typecard${cur===k?' on':''}" data-k="${k}"><span><b>${t}</b><small>${d}</small></span></button>`).join('')+(n==='alex'?`<p class="muted" style="font-size:13px;margin-top:8px">Hand it off: make someone else Commissioner first, then step down.</p>`:''),
    b=>b.querySelectorAll('[data-k]').forEach(x=>x.onclick=()=>{const k=x.dataset.k;if(k==='player')delete SHOWSTATE.roles[n];else SHOWSTATE.roles[n]=k;closeSheet();toast(`${n} is now ${k==='commish'?'a Commissioner':k==='admin'?'a Game admin':'a Player'}`);backstageRoute(sid)}))}
function resultsSheet(){const found=S51.cast.filter(c=>c.exitEp===4).concat(S51.cast.filter(c=>!c.exitEp).slice(0,3));let kept=new Set(found.map(c=>c.name));
  openSheet('Episode 4 results','Research found these · tick what\'s right, then apply to every game',
    `${found.map((c,i)=>`<button class="resrow on" data-c="${c.name}"><span class="tickbox">${svg('check')}</span><img src="${ph(c)}" alt=""><span class="tx"><b>${c.name}</b><small>${c.exitEp===4?'Voted out':['Won immunity','Found an idol clue','Voted with the majority'][i-1]}</small></span></button>`).join('')}
     <button class="btn pri wide" id="apply" style="margin-top:14px">Apply ${found.length} results to 3 games</button>`,
    b=>{b.querySelectorAll('[data-c]').forEach(r=>r.onclick=()=>{r.classList.toggle('on');kept.has(r.dataset.c)?kept.delete(r.dataset.c):kept.add(r.dataset.c);$('apply').textContent=`Apply ${kept.size} results to 3 games`;$('apply').disabled=!kept.size});
      $('apply').onclick=()=>{SHOWSTATE.resultsDone=true;closeSheet();confetti();toast('Applied to Outlast, Weekly Lineup and Survival Pool');route()}})}
function poolSheet(){const used=new Set(POOL.alex.picks);const still=S51.cast.filter(c=>!c.exitEp);let pick=SHOWSTATE.pool;
  openSheet('Who survives Episode 5?','Survival Pool · streak 3 · picks close at airtime',`<div class="cast4">${still.map(c=>`<button class="tile${pick===first(c.name)?' sel':''}${used.has(first(c.name))?' used':''}" data-p="${first(c.name)}" ${used.has(first(c.name))?'disabled':''}><img src="${ph(c)}" alt=""><span class="tick">${svg('check')}</span><div class="cap">${first(c.name)}</div><small>${used.has(first(c.name))?'Used':c.tribe}</small></button>`).join('')}</div><button class="btn pri wide" id="pk" style="margin-top:14px" ${pick?'':'disabled'}>${pick?`Lock in ${pick}`:'Pick someone'}</button>`,
  b=>{b.querySelectorAll('[data-p]:not([disabled])').forEach(t=>t.onclick=()=>{pick=t.dataset.p;b.querySelectorAll('[data-p]').forEach(x=>x.classList.toggle('sel',x===t));$('pk').disabled=false;$('pk').textContent=`Lock in ${pick}`});
    $('pk').onclick=()=>{SHOWSTATE.pool=pick;closeSheet();toast(`Locked in ${pick} · streak 3 on the line`);showRoute('surv','tonight')}})}
function predictSheet(){const Q=[['out','Who goes home?',S51.cast.filter(c=>!c.exitEp).slice(0,4).map(c=>first(c.name))],['idol','Will an idol be played?',['Yes','No']]];
  openSheet('Episode 5 predictions','One tap each · scored after the episode',Q.map(([k,q,o])=>`<div class="q"><b>${q}</b><div class="opts">${o.map(x=>`<button class="chip${SHOWSTATE.preds[k]===x?' on':''}" data-q="${k}" data-v="${x}">${x}</button>`).join('')}</div></div>`).join('')+`<button class="btn pri wide" id="pd" style="margin-top:10px">Lock in</button>`,
  b=>{b.querySelectorAll('[data-q]').forEach(x=>x.onclick=()=>{SHOWSTATE.preds[x.dataset.q]=x.dataset.v;b.querySelectorAll(`[data-q="${x.dataset.q}"]`).forEach(y=>y.classList.toggle('on',y===x))});$('pd').onclick=()=>{closeSheet();toast('Predictions locked in');showRoute('surv','tonight')}})}
function revealPlay(s){const r=document.createElement('div');r.className='revealfs';
  r.innerHTML=`<div class="beat"><span class="cap muted">${s.name} · Episode ${s.ep}</span></div><div class="beat"><h2 class="cap">Previously<br>on the couch</h2></div>
    <div class="beat"><div class="plate"><span class="tg live cap">Out</span><span class="bd"><span class="t cap">Thien An Nguyen</span><span class="d">Blindsided · 3 votes to 2</span></span></div></div>
    <div class="beat"><span class="num bignum">+14</span><div class="mv up">▲ Weekly Lineup: up to 1st</div><div class="mv up">▲ Survival Pool: ${SHOWSTATE.pool||'Brady'} survived, streak 4</div><div class="mv" style="color:var(--chyron)">● Predictions: you called it, +2</div></div>
    <button class="beat btn ink wide" id="rvd">Back to ${s.name.replace('The ','')}</button>`;
  $('device').appendChild(r);[...r.querySelectorAll('.beat')].forEach((b,i)=>setTimeout(()=>b.classList.add('on'),200+i*650));
  r.querySelector('#rvd').onclick=()=>{r.remove();SHOWSTATE.revealed=5;showRoute(s.id,'tonight')}}

function wireShow(s){
  $('showMenu')&&($('showMenu').onclick=()=>showMenu(s));
  app.querySelectorAll('[data-ph]').forEach(b=>b.onclick=()=>{SHOWSTATE.phase=b.dataset.ph;showRoute(s.id,'tonight')});
  app.querySelectorAll('[data-job]').forEach(b=>b.onclick=()=>({lineup:()=>movesSheet('lineup'),pool:()=>movesSheet('pool'),predict:()=>movesSheet('predict'),bingo:bingoSheet,banish:banishSheet,watch:()=>openWatch(s.id),reveal:()=>revealPlay(s),results:()=>location.hash=`#/show/${s.id}/backstage/results`,rate5:rate5,whoout:whoOutSheet,final:()=>finalUpdate(s),rate:()=>openWatch(s.id),newgame:()=>newGameSheet(s)})[b.dataset.job]());
  if($('dock'))$('dock').onclick=()=>movesSheet();
  if($('dockRv'))$('dockRv').onclick=()=>revealPlay(s);
  if($('dockFinal'))$('dockFinal').onclick=()=>finalUpdate(s);
  app.querySelectorAll('[data-res]').forEach(b=>b.onclick=()=>{SHOWSTATE.res=b.dataset.res;if(b.dataset.res==='waiting'&&SHOWSTATE.revealed>=5)SHOWSTATE.revealed=4;showRoute(s.id,SHOWSTATE.tab)});
  if($('cfold'))$('cfold').onclick=e=>{e.currentTarget.outerHTML=msgHTML('riley','THIEN??')+msgHTML('jordan','that blindside was cold')};
  if($('cu'))$('cu').onclick=catchupStep;
  if($('chgW'))$('chgW').onclick=()=>whereSheet({...s,aired:s.aired||s.ep-1,onEp:FIRST.where[s.id]??3});
  if($('soloPlay'))$('soloPlay').onclick=()=>newCouchSheet(()=>{state.couchMade=true;location.hash='#/hub'});
  app.querySelectorAll('[data-ep]').forEach(b=>b.onclick=()=>episodePage(+b.dataset.ep));
  app.querySelectorAll('[data-player]').forEach(b=>b.onclick=()=>playerSheet(b.dataset.player,b.dataset.g));
  app.querySelectorAll('[data-rules]').forEach(b=>b.onclick=()=>rulesSheet(b.dataset.rules));
  app.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{SHOWSTATE.filter=b.dataset.filter;showRoute(s.id,'cast')});
  app.querySelectorAll('[data-cast]').forEach(b=>b.onclick=()=>castSheet(b.dataset.cast));
  app.querySelectorAll('.pillrow a').forEach(a=>a.onclick=e=>{e.preventDefault();document.getElementById(a.getAttribute('href').slice(1)).scrollIntoView({behavior:'smooth'})});
  if($('ci')){const send=()=>{const v=$('ci').value.trim();if(!v)return;$('chat').insertAdjacentHTML('beforeend',msgHTML('alex',v,true,true));$('ci').value='';$('cs').classList.remove('ready');$('scroller').scrollTop=1e6};$('ci').oninput=e=>$('cs').classList.toggle('ready',!!e.target.value.trim());$('cs').onclick=send;$('ci').onkeydown=e=>{if(e.key==='Enter')send()}}
  tickCd()}

function soloTonight(s){const w=FIRST.where[s.id]??3,aired=s.aired||s.ep-1;
  return `<section class="blk"><div class="where">${svg('eye')}<strong>${w>=aired?`Live · through Episode ${aired}`:`You're on Episode ${w} · nothing past it shows`}</strong><button id="chgW">Change</button></div></section>
  <button class="wacta" data-job="watch"><img src="${ART(s.art)}" alt="" style="object-position:${s.hpos||s.pos}"><span class="tg cap">${w>=aired?fmtT(nextAir(s.air)):'Episode '+(w+1)}</span><b class="cap">Watch along</b><small>Pause, rewind, react · rate it when the credits roll</small></button>
  <section class="blk"><div class="sh"><h2 class="cap">Just for you</h2></div>
    <button class="job" data-job="rate"><span class="ic">${svg('star')}</span><span class="tx"><b>Rate Episode ${Math.max(1,w)}</b><small>See how everyone on Game Your Show rated it</small></span>${svg('chev')}</button>
    <button class="job" data-job="predict"><span class="ic">${svg('quiz')}</span><span class="tx"><b>Call it for Episode ${w+1}</b><small>Private predictions · a personal streak</small></span>${svg('chev')}</button>
    <a class="job" href="#/show/${s.id}/cast"><span class="ic">${svg('people')}</span><span class="tx"><b>Who's scoring</b><small>The cast ranked up to your episode</small></span>${svg('chev')}</a></section>
  <section class="blk"><div class="playplate"><span class="tg cap">Play it</span><h4 class="cap">${s.name} with friends</h4><p>Outlast, Weekly Lineup or Survival Pool. Start a couch, send the code, draft from this cast.</p><button class="btn" id="soloPlay">Start a couch</button></div></section>`}
