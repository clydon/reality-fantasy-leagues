// ================= the stats explorer: the Cast tab, for anyone, in a game or not =================
// Decided 2026-10-23 (the user: "there's something rewarding about sifting through stats and discovering
// connections"), reworked the same day:
//   Faces     the cast grouped by faction (tribes; a secret faction, like the Traitors', groups Still in / Out).
//   Rank      one stat at a time, by its full name from the show's own list (imported shows name stats freely,
//             so no abbreviations), everyone ranked with a bar; optionally a second stat beside it.
//   By episode a points heatmap.
// One episode slider sets the range for all three, capped at your episode (guard.js). Patterns, Compare and Share
// live in Rank. No ownership dots: in a game, your castaways just say "Your team".
const EX={sid:null,view:'faces',stat:'pts',stat2:null,filt:'all',from:1,to:1,cmp:[],picking:false};
// every stat for a show, full names from its rulebook: points first, then the research's own categories
const exStats=s=>[['pts','Points','points'],...STATS[s.id].cats,...(s.id==='surv'?[['wentOnJourney','Went on a journey','times'],['satOut','Sat out a challenge','times']]:[])];
const exKey=k=>JSON.stringify(k);
const exStat=(s,k)=>exStats(s).find(x=>exKey(x[0])===exKey(k))||exStats(s)[0];
const exVal=(c,k,a,b)=>k==='pts'?c.perEp.slice(a-1,b).reduce((x,y)=>x+(y||0),0):(c.why||[]).filter(x=>x[0]>=a&&x[0]<=b&&[].concat(k).includes(x[1])).length;
function exPeople(s){const src=STATS[s.id].season(),w=seen(s),f=EX.filt;
  return src.cast.map(c=>({c,out:c.exitEp&&c.exitEp<=w?c.exitEp:0,fac:factionOf(s,c),mine:!!s.kinds&&s.id==='surv'&&TEAMS.alex.some(x=>c.name.startsWith(x))}))
    .filter(r=>f==='all'||(f==='in'&&!r.out)||(f==='out'&&r.out)||(f==='mine'&&r.mine)||(!['all','in','out','mine'].includes(f)&&!factionSecret(s)&&r.fac===f))}
const exRanked=(s,k)=>exPeople(s).map(r=>({...r,n:exVal(r.c,k,EX.from,EX.to)})).sort((p,q)=>q.n-p.n||(!!p.out-!!q.out));
// patterns: observations the data supports, each a Rank view that shows it
function exPatterns(s){const w=seen(s),src=STATS[s.id].season(),cnt=(c,k)=>(c.why||[]).filter(x=>x[0]<=w&&[].concat(k).includes(x[1])).length,P=[];
  if(s.id==='surv'){const live=src.cast.filter(c=>!(c.exitEp&&c.exitEp<=w)),T=Object.keys(src.tribes||{}).filter(t=>live.some(c=>factionOf(s,c)===t));
    // current tribes (after a swap a tribe can have no original members), by their members' average immunity wins
    const avg=T.map(t=>{const m=live.filter(c=>factionOf(s,c)===t);return [t,m.reduce((x,c)=>x+cnt(c,'tribeImmunity'),0)/m.length]}).sort((x,y)=>x[1]-y[1]);
    if(avg.length>1)P.push([`${avg[0][0]}'s members have the fewest immunity wins (${avg[0][1].toFixed(1)} each, vs ${avg[avg.length-1][1].toFixed(1)} on ${avg[avg.length-1][0]})`,{stat:'tribeImmunity',filt:avg[0][0]}]);
    const out=src.cast.filter(c=>c.exitEp&&c.exitEp<=w&&c.exitMethod==='Voted Out'),warned=out.filter(c=>(c.why||[]).some(x=>x[1]==='survivedVotes'&&x[0]<c.exitEp));
    if(out.length)P.push([`${warned.length} of ${out.length} people voted out had their name written down before`,{stat:['survivedVotes','Voted Out'],filt:'all'}]);
    const idol=src.cast.filter(c=>cnt(c,'idolFound'));if(idol.length)P.push([`${idol.filter(c=>!(c.exitEp&&c.exitEp<=w)).length} of ${idol.length} idol finders are still in the game`,{stat:'idolFound',filt:'all'}])}
  if(s.id==='trt'){const clean=src.cast.filter(c=>!(c.exitEp&&c.exitEp<=w)&&cnt(c,'zeroVotes')>=Math.max(1,w-1));if(clean.length)P.push([`${clean.length} people still in have never had a vote against them`,{stat:'zeroVotes',filt:'in'}]);
    const sh=src.cast.filter(c=>cnt(c,'shieldWon'));if(sh.length)P.push([`${sh.length} shield${sh.length>1?'s':''} won so far · see who`,{stat:'shieldWon',filt:'all'}])}
  return P.slice(0,3)}

function explorerHTML(s){const w=seen(s),src=STATS[s.id].season(),term=src.tribeTerm||'Group';
  if(EX.sid!==s.id)Object.assign(EX,{sid:s.id,view:'faces',stat:'pts',stat2:null,filt:'all',from:1,to:w,cmp:[],picking:false});EX.to=Math.min(EX.to||w,w);EX.from=Math.min(EX.from,EX.to);
  if(!w)return `<section class="blk ex">${guardChip(s)}<div class="w-empty">${svg('eye')}<b class="cap">Nothing to show yet</b><p>Set where you are and the cast's stats fill in up to that episode, never past it.</p></div></section>`;
  const facs=factionSecret(s)?[]:Object.keys(src.tribes||{}).filter(t=>src.cast.some(c=>factionOf(s,c)===t));
  const filts=[['all','Everyone'],['in','Still in'],['out','Out'],...facs.map(t=>[t,t]),...(s.kinds&&s.id==='surv'?[['mine','Your team']]:[])];
  const controls=`${guardChip(s)}<div class="ex-seg">${[['faces','Faces'],['rank','Rank'],['heat','By episode']].map(([k,l])=>`<button class="${EX.view===k?'on':''}" data-exv="${k}">${l}</button>`).join('')}</div>
    ${w>1?`<div class="ex-slider"><div class="lab"><span class="cap">Episodes</span><b class="num" id="exRL">${EX.from===EX.to?EX.from:`${EX.from} – ${EX.to}`}</b></div><div class="trk"><i id="exFill" style="left:${(EX.from-1)/(w-1)*100}%;right:${(w-EX.to)/(w-1)*100}%"></i>
      <input type="range" min="1" max="${w}" value="${EX.from}" id="exFrom" aria-label="From episode"><input type="range" min="1" max="${w}" value="${EX.to}" id="exTo" aria-label="To episode"></div><div class="ends"><span>1</span><span>${w}</span></div></div>`:''}
    <div class="ex-filt">${filts.map(([k,l])=>`<button class="chip${EX.filt===k?' on':''}" data-exf="${k}">${l}</button>`).join('')}</div>`;
  let body='';
  if(EX.view==='faces'){const rows=exPeople(s).map(r=>({...r,n:exVal(r.c,'pts',EX.from,EX.to)}));
    const groups=factionSecret(s)?[['Still in',rows.filter(r=>!r.out),null],['Out',rows.filter(r=>r.out),null]]
      :[...facs.map(t=>[t,rows.filter(r=>!r.out&&r.fac===t),src.tribes[t]]),['Out',rows.filter(r=>r.out),null]];
    body=groups.filter(g=>g[1].length).map(([name,L,color])=>`<div class="ex-grp"><div class="ex-gh">${color?`<i style="background:${color}"></i>`:''}<b class="cap">${name}</b><small>${L.length}${color?` · ${term.toLowerCase()}`:''}</small></div>
      <div class="ex-faces">${L.sort((p,q)=>name==='Out'?q.out-p.out:q.n-p.n).map(r=>`<button class="ex-face${r.out?' out':''}" data-exc="${r.c.name}"><img src="${ph(r.c)}" alt=""><b class="cap">${first(r.c.name)}</b><small>${r.out?`Out · Ep ${r.out}${r.fac&&factionSecret(s)?` · ${r.fac}`:''}`:`${r.n} pts`}</small>${r.mine?'<span class="ex-yours">Your team</span>':''}</button>`).join('')}</div></div>`).join('')}
  else if(EX.view==='rank'){const [k,title,u]=exStat(s,EX.stat),k2=EX.stat2&&exStat(s,EX.stat2),rows=exRanked(s,k),max=Math.max(1,...rows.map(r=>r.n)),pats=exPatterns(s);
    body=`${pats.length?`<div class="ex-pats">${pats.map((p,i)=>`<button class="ex-pat" data-pat="${i}">${svg('bolt')}<span>${p[0]}</span>${svg('chev')}</button>`).join('')}</div>`:''}
      <div class="ex-pick"><button data-expick="1"><small>Ranked by</small><b>${title}</b>${svg('chev')}</button><button data-expick="2"><small>Beside it</small><b>${k2?k2[1]:'Nothing'}</b>${svg('chev')}</button></div>
      <div class="ex-tools"><button class="ex-tool${EX.picking?' on':''}" data-excmp>${svg('swap')}${EX.picking?`Pick two · ${EX.cmp.length}/2`:'Compare two'}</button><button class="ex-tool" data-exshare>${svg('send')}Share this</button></div>
      <div class="ex-rank">${rows.map((r,i)=>`<button class="ex-r${r.out?' out':''}${EX.cmp.includes(r.c.name)?' pick':''}" data-exc="${r.c.name}"><span class="rk num">${i+1}</span><img src="${ph(r.c)}" alt=""><span class="tx"><b>${first(r.c.name)}</b><small>${r.out?`Out · Ep ${r.out}`:r.mine?'Your team':''}${k2?`${r.out||r.mine?' · ':''}${k2[1]}: ${exVal(r.c,k2[0],EX.from,EX.to)}`:''}</small><span class="bar"><i style="width:${Math.max(0,r.n)/max*100}%"></i></span></span><span class="val"><b class="num">${r.n}</b><small>${unit(u,r.n)}</small></span></button>`).join('')}</div>`}
  else{const eps=Array.from({length:EX.to-EX.from+1},(_,i)=>EX.from+i),rows=exPeople(s).map(r=>({...r,n:exVal(r.c,'pts',EX.from,EX.to)})).sort((p,q)=>q.n-p.n);
    body=`<div class="ex-wrap"><table class="ex-t ex-heat"><thead><tr><th class="nm">Points</th>${eps.map(e=>`<th>Episode ${e}</th>`).join('')}<th>Total</th></tr></thead><tbody>${rows.map(r=>`<tr class="${r.out?'out':''}" data-exc="${r.c.name}"><td class="nm"><img src="${ph(r.c)}" alt=""><span>${first(r.c.name)}</span></td>${eps.map(e=>{const p=r.c.perEp[e-1],gone=r.out&&e>r.out;
      return `<td class="hc" style="${gone?'':`background:${p>0?`rgba(53,181,165,${Math.min(.85,.15+p/10)})`:p<0?`rgba(242,84,91,${Math.min(.8,.25-p/8)})`:'transparent'}`}">${gone?'·':p??''}</td>`}).join('')}<td><b>${r.n}</b></td></tr>`).join('')}</tbody></table></div><p class="ex-key">Green scored, red lost points, · already out. Tap a row for their story.</p>`}
  return `<section class="blk ex">${controls}<div id="exBody">${body}</div></section>`}
// a castaway's story, episode by episode (what the research recorded); a secret faction shows only once revealed
function exProfile(s,name){const c=STATS[s.id].season().cast.find(x=>x.name===name),w=seen(s),term=STATS[s.id].season().tribeTerm||'Group',fac=factionOf(s,c);
  const label=key=>(exStats(s).find(k=>[].concat(k[0]).includes(key))||[,key])[1];
  openSheet(c.name,`${s.short} · up to Episode ${w}${c.exitEp&&c.exitEp<=w?` · out in Episode ${c.exitEp}`:''}`,`<div class="ex-prof"><img src="${ph(c)}" alt=""><div>
    <p class="ex-fac">${term}: <b>${fac||'secret until they leave'}</b>${fac&&factionSecret(s)?` · revealed in Episode ${c.exitEp}`:''}</p>
    ${Array.from({length:w},(_,k)=>k+1).map(e=>{const ev=(c.why||[]).filter(x=>x[0]===e);return `<div class="ex-ep"><span class="n num">${e}</span><span>${ev.length?ev.map(x=>label(x[1])).join(' · '):c.exitEp&&e>c.exitEp?'Already out':'Nothing recorded'}</span><b class="num">${c.perEp[e-1]??''}</b></div>`}).join('')}</div></div>`)}
function exCompare(s,names){const P=exPeople(s),[A,B]=names.map(n=>P.find(r=>r.c.name===n));if(!A||!B)return;
  openSheet('Side by side',`${s.short} · Episodes ${EX.from}–${EX.to}`,`<div class="ex-cmp"><div class="hd"><span><img src="${ph(A.c)}" alt=""><b>${first(A.c.name)}</b></span><span><img src="${ph(B.c)}" alt=""><b>${first(B.c.name)}</b></span></div>
    ${exStats(s).map(([k,full])=>{const a=exVal(A.c,k,EX.from,EX.to),b=exVal(B.c,k,EX.from,EX.to);return `<div class="row2"><b class="num${a>b?' win':''}">${a}</b><span>${full}</span><b class="num${b>a?' win':''}">${b}</b></div>`}).join('')}</div>`)}
function exStatSheet(s,which){const cur=which===1?EX.stat:EX.stat2;
  openSheet(which===1?'Rank by':'Show beside it',`${s.short} · every stat the results track`,`${which===2?`<button class="row${cur==null?' on':''}" data-st="none"><span class="tx"><b>Nothing</b></span></button>`:''}${exStats(s).map(([k,full,u])=>`<button class="row${cur!=null&&exKey(k)===exKey(cur)?' on':''}" data-st='${exKey(k)}'><span class="tx"><b>${full}</b><small>Counted in ${u}</small></span></button>`).join('')}`,
    b=>b.querySelectorAll('[data-st]').forEach(x=>x.onclick=()=>{const v=x.dataset.st==='none'?null:JSON.parse(x.dataset.st);if(which===1)EX.stat=v;else EX.stat2=v;closeSheet();exRefresh()}))}
function exRefresh(){const y=$('scroller').scrollTop;route();$('scroller').scrollTop=y}
function wireExplorer(s){wireGuard();
  app.querySelectorAll('[data-exv]').forEach(b=>b.onclick=()=>{EX.view=b.dataset.exv;exRefresh()});
  app.querySelectorAll('[data-exf]').forEach(b=>b.onclick=()=>{EX.filt=b.dataset.exf;exRefresh()});
  app.querySelectorAll('[data-expick]').forEach(b=>b.onclick=()=>exStatSheet(s,+b.dataset.expick));
  app.querySelectorAll('[data-pat]').forEach(b=>b.onclick=()=>{Object.assign(EX,exPatterns(s)[+b.dataset.pat][1],{view:'rank'});exRefresh()});
  // the slider: two thumbs on one track; the label follows while dragging, the view updates on release
  const fr=$('exFrom'),to=$('exTo'),w=seen(s);if(fr&&to){const paint=()=>{let a=+fr.value,b=+to.value;if(a>b){[a,b]=[b,a]}$('exRL').textContent=a===b?a:`${a} – ${b}`;$('exFill').style.left=(a-1)/(w-1)*100+'%';$('exFill').style.right=(w-b)/(w-1)*100+'%';return [a,b]};
    [fr,to].forEach(x=>{x.oninput=paint;x.onchange=()=>{[EX.from,EX.to]=paint();exRefresh()}})}
  app.querySelectorAll('[data-exc]').forEach(r=>r.onclick=()=>{if(!EX.picking)return exProfile(s,r.dataset.exc);const n=r.dataset.exc;EX.cmp=EX.cmp.includes(n)?EX.cmp.filter(x=>x!==n):[...EX.cmp,n].slice(-2);
    // re-rendering closes sheets, so the side-by-side opens after it
    if(EX.cmp.length===2){const names=EX.cmp;EX.cmp=[];EX.picking=false;exRefresh();exCompare(s,names)}else exRefresh()});
  const cmp=app.querySelector('[data-excmp]');if(cmp)cmp.onclick=()=>{EX.picking=!EX.picking;EX.cmp=[];exRefresh();if(EX.picking)toast('Tap two people to compare')};
  const sh=app.querySelector('[data-exshare]');if(sh)sh.onclick=()=>{const [,t]=exStat(s,EX.stat);
    [FEED4,FEED12].forEach(F=>F.unshift(['alex','shared a stats view',`${s.short} · ranked by ${t.toLowerCase()} · Episodes ${EX.from}–${EX.to}`,null]));toast(`Shared with the couch · ${s.short} chat`)}}

// the Cast tab becomes the explorer for shows we hold stats for
const tabCastEx=tabCast;
tabCast=function(s){return hasStats(s)?explorerHTML(s):tabCastEx(s)};
const wCastEx=wCast;
wCast=function(s){return hasStats(s)?explorerHTML(s):wCastEx(s)};
const wireShowEx=wireShow;
wireShow=function(s){wireShowEx(s);if(hasStats(s))wireExplorer(s)};
const wireWEx=wireW;
wireW=function(s){wireWEx(s);if(hasStats(s))wireExplorer(s)};
// the condensed stat page links into Rank, already ranked by that stat
const statsPageEx=statsPage;
statsPage=function(s,focus){statsPageEx(s,focus);const k=STATS[s.id].cats[focus??0][0];
  $('page').querySelector('.st-page').insertAdjacentHTML('afterbegin',`<button class="ex-open" id="exOpen">${svg('lineup')}See everyone ranked by this</button>`);
  $('exOpen').onclick=()=>{Object.assign(EX,{sid:s.id,view:'rank',stat:k,stat2:null,filt:'all',from:1,to:seen(s),cmp:[],picking:false});closePage();const h=`#/show/${s.id}/cast`;if(location.hash===h)route();else location.hash=h}};
