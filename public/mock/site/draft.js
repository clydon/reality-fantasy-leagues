// ================= the draft room =================
// Casual first: no timer by default; nobody gets auto-picked; a game admin can pick for anyone
// (helping over the phone, someone stuck at work). Optional timer and away rules in Settings.
const DR={order:['riley','alex','jordan','sam'],rounds:4,picks:[],sel:null,forWho:null,view:'board',filter:'All',queue:['Brady','Maggie'],
  timer:'off',away:'wait',nudged:false,jordanBack:false,t0:0,botT:0,showTaken:false};
const drWho=p=>{const r=Math.floor(p/DR.order.length),i=p%DR.order.length;return DR.order[r%2?DR.order.length-1-i:i]};
const drTotal=()=>DR.order.length*DR.rounds;
const drTaken=n=>DR.picks.find(x=>x.c===n);
const drAvail=()=>S51.cast.filter(c=>!drTaken(first(c.name)));
const drMine=w=>DR.picks.filter(x=>x.w===w).map(x=>x.c);

function draftRoute(sid){DR.sid=sid;clearTimeout(DR.botT);const p=DR.picks.length,done=p>=drTotal();if(done)return draftDone();
  const w=drWho(p),r=Math.floor(p/DR.order.length)+1,mine=w==='alex',admin=isCommish(),away=w==='jordan'&&!DR.jordanBack;
  if(DR.forWho&&DR.forWho!==w)DR.forWho=null;
  const acting=mine||DR.forWho===w;
  const avail=drAvail().filter(c=>DR.filter==='All'||c.tribe===DR.filter);
  const list=DR.showTaken?S51.cast.filter(c=>DR.filter==='All'||c.tribe===DR.filter):avail;
  app.innerHTML=`<div class="draft">
  <header class="dhead"><a class="iconbtn" href="#/show/${sid}/tonight" aria-label="Leave the draft">${svg('x')}</a><div class="dtitle"><b class="cap">Outlast draft</b><small>Couch Cup · Survivor 51 · snake</small></div>${admin?`<button class="iconbtn" id="dset" aria-label="Draft settings">${svg('gear')}</button>`:'<span style="width:44px"></span>'}</header>
  <div class="ticker">${DR.picks.length?DR.picks.slice(-6).reverse().map((x,i)=>`<span class="${i===0?'new':''}">R${x.r}·${x.n} <b>${x.w}</b> ${x.c}${x.by?` <em>by ${x.by}</em>`:''}</span>`).join(''):'<span>The draft is open. riley picks first.</span>'}</div>
  <div class="clock ${mine?'you':away?'away':''}">
    ${av(w,44)}<div class="ctx"><span class="cap kick">${mine?'You\'re up':away?`${w} is away`:`${w} is picking`}</span>
      <b>${mine?`Round ${r} · pick ${p%DR.order.length+1}`:away?(DR.nudged?'Nudged · waiting for them':`Hasn't picked yet · ${DR.timer==='off'?'no timer':DR.timer}`):`Round ${r} · no rush, no timer`}</b></div>
    ${away&&admin?`<div class="clock-acts">${DR.nudged?'':`<button class="btn out sm" id="nudge">Nudge</button>`}<button class="btn pri sm" id="pickfor">Pick for ${w}</button></div>`:''}
    ${!mine&&!away&&DR.timer!=='off'?`<span class="tmr num" id="tmr">${DR.timer==='60s'?'0:60':'2:00'}</span>`:''}
  </div>
  ${DR.forWho?`<div class="forbar">${svg('people')}<span>Picking for <b>${DR.forWho}</b>${DR.forWho==='jordan'?' · on the phone with them?':''}</span><button id="forx">Cancel</button></div>`:''}
  <div class="order">${Array.from({length:drTotal()},(_,i)=>{const ww=drWho(i),x=DR.picks[i];return `<span class="op${i===p?' now':''}${x?' done':''}${ww==='alex'?' me':''}" title="${ww}">${x?`<img src="${ph(S51C(x.c))}" alt="">`:av(ww,22)}</span>`}).join('')}</div>
  <div class="dseg"><button class="${DR.view==='board'?'on':''}" data-v="board">Available <b>${drAvail().length}</b></button><button class="${DR.view==='teams'?'on':''}" data-v="teams">Teams</button><button class="${DR.view==='queue'?'on':''}" data-v="queue">Your queue <b>${DR.queue.filter(q=>!drTaken(q)).length}</b></button></div>
  <div class="dbody">
  ${DR.view==='board'?`<div class="chips">${['All','Toka','Savu','Dina'].map(k=>`<button class="chip${DR.filter===k?' on':''}" data-f="${k}">${TRIBES[k]?`<i style="background:${TRIBES[k]}"></i>`:''}${k}</button>`).join('')}<button class="chip${DR.showTaken?' on':''}" id="tk">Show taken</button></div>
    <div class="dgrid">${list.map(c=>{const n=first(c.name),t=drTaken(n),q=DR.queue.includes(n);return `<button class="dtile${t?' taken':''}${DR.sel===n?' sel':''}" data-c="${n}" ${t?'disabled':''}><img src="${ph(c)}" alt=""><span class="tb" style="background:${TRIBES[c.tribe]||'#888'}"></span>${t?`<span class="by" style="background:${col(t.w)}">${t.w[0].toUpperCase()}</span>`:`<span class="q${q?' on':''}" data-q="${n}" role="button" aria-label="Queue">${svg('star')}</span>`}<b class="cap">${n}</b><small>${c.total} pts so far</small></button>`}).join('')}</div>`:''}
  ${DR.view==='teams'?DR.order.map(ww=>`<div class="dteam${ww==='alex'?' me':''}">${av(ww,30)}<b>${ww}</b><span class="tf">${Array.from({length:DR.rounds},(_,k)=>{const c=drMine(ww)[k];return c?`<img src="${ph(S51C(c))}" alt="${c}">`:'<i></i>'}).join('')}</span></div>`).join(''):''}
  ${DR.view==='queue'?`<p class="muted small" style="padding:12px 16px 0">Star castaways on the board. When you're up, your queue is ready. Nobody auto-picks from it unless you turn that on.</p>${DR.queue.map((n,i)=>{const t=drTaken(n),c=S51C(n);return `<div class="qrow${t?' gone':''}"><span class="num">${i+1}</span><img src="${ph(c)}" alt=""><span class="tx"><b>${c.name}</b><small>${t?`Taken by ${t.w}`:`${c.tribe} · ${c.total} pts`}</small></span>${t?'':`<button class="btn out sm" data-qd="${n}">Draft</button>`}</div>`}).join('')||'<p class="muted" style="padding:16px">Nobody queued yet.</p>'}`:''}
  </div>
  ${acting&&DR.sel?`<div class="dconfirm"><img src="${ph(S51C(DR.sel))}" alt=""><span class="tx"><small>${DR.forWho?`For ${DR.forWho} · round ${r}`:`Your round ${r} pick`}</small><b class="cap">${DR.sel}</b></span><button class="btn pri" id="dgo">Draft ${DR.sel}</button></div>`:acting?`<div class="dconfirm hint"><span class="tx"><small>${DR.forWho?`Picking for ${DR.forWho}`:'You\'re up'}</small><b>Tap a castaway</b></span></div>`:''}
  </div>`;
  wireDraft(w,mine,away);
  // the others pick at a human pace; jordan is away until someone helps
  if(!mine&&!away&&!DR.forWho)DR.botT=setTimeout(()=>{const pick=(DR.queueBot||drAvail()).sort((a,b)=>b.total-a.total)[Math.floor(Math.random()*3)];drPick(w,first(pick.name))},2200)}
function drPick(w,c,by){const p=DR.picks.length;DR.picks.push({w,c,by,r:Math.floor(p/DR.order.length)+1,n:p%DR.order.length+1});DR.sel=null;
  if(by){DR.forWho=null;if(w==='jordan')DR.jordanBack=true}if(w==='alex'||by)toast(by?`${c} drafted for ${w}`:`You drafted ${c}`);draftRoute(DR.sid)}
function wireDraft(w,mine,away){
  app.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{DR.view=b.dataset.v;draftRoute(DR.sid)});
  app.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{DR.filter=b.dataset.f;draftRoute(DR.sid)});
  const tk=$('tk');if(tk)tk.onclick=()=>{DR.showTaken=!DR.showTaken;draftRoute(DR.sid)};
  app.querySelectorAll('[data-q]').forEach(b=>b.onclick=e=>{e.stopPropagation();const n=b.dataset.q;DR.queue.includes(n)?DR.queue=DR.queue.filter(x=>x!==n):DR.queue.push(n);b.classList.toggle('on');toast(DR.queue.includes(n)?`${n} queued`:`${n} unqueued`)});
  app.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{if(!(mine||DR.forWho===w))return toast(`It's ${w}'s pick. Star castaways to queue them.`);DR.sel=b.dataset.c;draftRoute(DR.sid)});
  app.querySelectorAll('[data-qd]').forEach(b=>b.onclick=()=>{if(!mine)return toast(`It's ${w}'s pick`);DR.sel=b.dataset.qd;DR.view='board';draftRoute(DR.sid)});
  const go=$('dgo');if(go)go.onclick=()=>drPick(w,DR.sel,DR.forWho?'alex':null);
  const pf=$('pickfor');if(pf)pf.onclick=()=>{DR.forWho=w;DR.view='board';draftRoute(DR.sid)};
  const fx=$('forx');if(fx)fx.onclick=()=>{DR.forWho=null;DR.sel=null;draftRoute(DR.sid)};
  const nd=$('nudge');if(nd)nd.onclick=()=>{DR.nudged=true;toast(`Nudged ${w}: "You're up in the Outlast draft"`);draftRoute(DR.sid)};
  const ds=$('dset');if(ds)ds.onclick=draftSettings}
function draftSettings(){openSheet('Draft settings','Couch Cup · Outlast · you run this game',
  `<p class="label cap">Pick timer</p><div class="segm" id="tm">${[['off','Off'],['2 min','2 min'],['60s','60 sec']].map(([k,l])=>`<button class="${DR.timer===k?'on':''}" data-t="${k}">${l}</button>`).join('')}</div><small class="muted small" style="display:block;margin-top:6px">Off by default. A timer suits competitive drafts; casual ones go at their own pace.</small>
   <p class="label cap">If someone's away</p>${[['wait','Wait for them','Nobody gets picked for automatically (default)'],['admin','Admins can pick for them','You or a game admin choose on their behalf'],['queue','Pick from their queue','Their starred castaways, in order, once the timer runs out']].map(([k,t,d])=>`<button class="typecard${DR.away===k?' on':''}" data-a="${k}"><span><b>${t}</b><small>${d}</small></span></button>`).join('')}
   <p class="label cap">Order</p><div class="order big">${DR.order.map(n=>`<span class="op">${av(n,28)}</span>`).join('')}</div>
   <div style="display:flex;gap:8px;margin-top:12px"><button class="btn out" style="flex:1" id="shuf">${svg('repeat')}Shuffle order</button><button class="btn out" style="flex:1" id="undo" ${DR.picks.length?'':'disabled'}>Undo last pick</button></div>
   <p class="muted small" style="margin-top:12px;line-height:1.45">Admins can always pick for anyone. That's how you help someone over the phone.</p>`,
  b=>{b.querySelectorAll('[data-t]').forEach(x=>x.onclick=()=>{DR.timer=x.dataset.t;b.querySelectorAll('[data-t]').forEach(y=>y.classList.toggle('on',y===x))});
    b.querySelectorAll('[data-a]').forEach(x=>x.onclick=()=>{DR.away=x.dataset.a;b.querySelectorAll('[data-a]').forEach(y=>y.classList.toggle('on',y===x))});
    $('shuf').onclick=()=>{if(DR.picks.length)return toast('Shuffle before the first pick');DR.order.sort(()=>Math.random()-.5);closeSheet();draftRoute(DR.sid)};
    $('undo').onclick=()=>{const x=DR.picks.pop();closeSheet();toast(`Undid ${x.w}'s pick: ${x.c}`);draftRoute(DR.sid)};
    const done=()=>{draftRoute(DR.sid)};b.closest('.sheet').querySelector('[data-close]').addEventListener('click',done,{once:true})})}
function draftDone(){clearTimeout(DR.botT);
  app.innerHTML=`<div class="draft done"><div class="ddone-h"><span class="tg cap">Draft complete</span><h1 class="cap">Couch Cup<br>is set</h1><p class="muted">16 picks · ${DR.picks.filter(x=>x.by).length} made for someone else</p></div>
    ${DR.order.map((w,i)=>`<div class="dteam big${w==='alex'?' me':''}" style="animation-delay:${i*.15}s">${av(w,36)}<b>${w}</b><span class="tf">${drMine(w).map(c=>`<img src="${ph(S51C(c))}" alt="${c}">`).join('')}</span></div>`).join('')}
    <div style="padding:20px 16px"><a class="btn pri wide big cap" href="#/show/${DR.sid}/tonight">Go to Survivor 51</a><button class="btn out wide" style="margin-top:10px" id="again">Run the draft again (mock)</button></div></div>`;
  $('again').onclick=()=>{DR.picks=[];DR.jordanBack=false;DR.nudged=false;draftRoute(DR.sid)}}

// ---------- blind draft: everyone picks privately, then one reveal ----------
const BL={team:[],locked:false,size:4};
const BLIND_OTHERS={riley:['Carter','Kristin','Danny','Eric'],jordan:['Brady','Kristin','Lewis','Maggie'],sam:['Maggie','Sharonda','Kristin','Devin']};
function blindRoute(sid){DR.sid=sid;
  if(BL.revealed)return blindReveal(sid);
  app.innerHTML=`<div class="draft"><header class="dhead"><a class="iconbtn" href="#/show/${sid}/tonight" aria-label="Leave">${svg('x')}</a><div class="dtitle"><b class="cap">Blind draft</b><small>Weekly Lineup · shared ownership</small></div><span style="width:44px"></span></header>
    <div class="clock"><span class="seal">${svg('eye')}</span><div class="ctx"><span class="cap kick">Pick in private</span><b>${BL.locked?'Locked in · waiting for the couch':`Choose ${BL.size}. Nobody sees until everyone's in.`}</b></div></div>
    <div class="inrow">${crowdOf().slice(0,4).map(n=>`<span class="${n==='alex'?(BL.locked?'in':''):n==='sam'&&!BL.locked?'':'in'}">${av(n,30)}<small>${n==='alex'?(BL.locked?'In':'You'):n==='sam'&&!BL.locked?'Picking':'In'}</small></span>`).join('')}</div>
    <div class="myteam">${Array.from({length:BL.size},(_,i)=>{const c=BL.team[i];return c?`<button class="slotc" data-rm="${c}"><img src="${ph(S51C(c))}" alt=""><b class="cap">${c}</b></button>`:`<span class="slotc empty">${i+1}</span>`}).join('')}</div>
    <div class="dbody"><p class="muted small" style="padding:10px 16px 0">Shared ownership: the same castaway can be on several teams.</p>
    <div class="dgrid">${S51.cast.filter(c=>!c.exitEp).map(c=>{const n=first(c.name),on=BL.team.includes(n);return `<button class="dtile${on?' sel':''}" data-b="${n}" ${BL.locked?'disabled':''}><img src="${ph(c)}" alt=""><span class="tb" style="background:${TRIBES[c.tribe]||'#888'}"></span><b class="cap">${n}</b><small>${c.total} pts</small></button>`}).join('')}</div></div>
    <div class="dconfirm">${BL.locked?`<span class="tx"><small>3 of 4 in</small><b>Waiting for sam</b></span><button class="btn pri" id="force">Reveal now (admin)</button>`:`<span class="tx"><small>${BL.team.length} of ${BL.size}</small><b>${BL.team.length<BL.size?'Pick '+(BL.size-BL.team.length)+' more':'Ready'}</b></span><button class="btn pri" id="lock" ${BL.team.length<BL.size?'disabled':''}>Lock in</button>`}</div></div>`;
  app.querySelectorAll('[data-b]').forEach(b=>b.onclick=()=>{const n=b.dataset.b;if(BL.team.includes(n))BL.team=BL.team.filter(x=>x!==n);else if(BL.team.length<BL.size)BL.team.push(n);else return toast('Remove someone first');blindRoute(sid)});
  app.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{if(BL.locked)return;BL.team=BL.team.filter(x=>x!==b.dataset.rm);blindRoute(sid)});
  const l=$('lock');if(l)l.onclick=()=>{BL.locked=true;toast('Locked in. You can change it until everyone is in.');blindRoute(sid)};
  const f=$('force');if(f)f.onclick=()=>{BL.revealed=true;blindRoute(sid)}}
function blindReveal(sid){const teams={alex:BL.team,...BLIND_OTHERS};const all=Object.values(teams).flat();const count=n=>all.filter(x=>x===n).length;
  app.innerHTML=`<div class="breveal"><span class="cap muted small">Weekly Lineup · Survivor 51</span><h1 class="cap">The teams</h1>
    ${Object.entries(teams).map(([w,t],i)=>`<div class="bteam" style="--d:${i*.9}s"><div class="bth">${av(w,32)}<b class="cap">${w}${w==='alex'?' · you':''}</b></div><div class="bcards">${t.map((c,k)=>`<div class="bcard" style="--k:${i*.9+k*.18}s"><div class="bin"><div class="bfront"></div><div class="bback"><img src="${ph(S51C(c))}" alt=""><b class="cap">${c}</b>${count(c)>=3?`<span class="same">×${count(c)}</span>`:''}</div></div></div>`).join('')}</div></div>`).join('')}
    <div class="bfoot" style="--d:${Object.keys(teams).length*.9+.6}s"><p><b>Kristin</b> is on ${count('Kristin')} teams. Shared ownership: everyone who has her scores with her.</p><a class="btn pri wide big cap" href="#/show/${sid}/tonight">Go to Survivor 51</a></div></div>`}
