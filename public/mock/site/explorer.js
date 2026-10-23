// ================= the stats explorer: the Cast tab, for anyone, in a game or not =================
// Decided 2026-10-23 (the user: "there's something rewarding about sifting through stats and discovering
// connections"): the Cast tab opens on Faces (the grid it always had) · Table · By episode. Table = every stat we
// capture as a sortable column, with filters and an episode range; By episode = a points heatmap; Patterns at the
// top are auto-found observations, each a one-tap view; Compare puts two side by side; Share posts the view to
// the couch. Everything counts only up to the episode you're on. (Traitors keeps its roles secret: no role filter.)
const EXCOLS={
  surv:[['pts','Pts','Points'],['votedWithMajority','Maj','Voted with the majority'],[['survivedVotes','Voted Out'],'Votes','Tribals with votes against them'],['zeroVotesSafe','Clean','Tribals with no votes against'],['survivedVotes','Surv','Survived votes against'],
    ['tribeImmunity','Imm','Tribe immunity wins'],['rewardWin','Rew','Reward wins'],['idolFound','Idol','Idols found'],['votedAgainstMajority','Minor','Voted against the majority'],['learnedOfAdvantage','Adv','Learned of an advantage'],['wentOnJourney','Jrny','Went on a journey']],
  trt:[['pts','Pts','Points'],['zeroVotes','Clean','No votes at the Round Table'],['shieldWon','Shield','Shields won'],['votedOutFaithful','Wrong','Voted out a Faithful'],['survivedRoundTable','Surv','Survived votes at the Round Table']]};
const EX={sid:null,view:'faces',sort:'pts',dir:-1,filt:'all',range:'all',cmp:[],picking:false};
const exKey=k=>JSON.stringify(k);
function exRange(s){const w=whereOf(s,'alex');return EX.range==='last'?[w,w]:EX.range==='last2'?[Math.max(1,w-1),w]:[1,w]}
function exRows(s){const src=STATS[s.id].season(),[a,b]=exRange(s),w=whereOf(s,'alex'),cols=EXCOLS[s.id];
  const rows=src.cast.map(c=>{const v={};cols.forEach(([k])=>{v[exKey(k)]=k==='pts'?c.perEp.slice(a-1,b).reduce((x,y)=>x+(y||0),0):(c.why||[]).filter(x=>x[0]>=a&&x[0]<=b&&[].concat(k).includes(x[1])).length});
    return {c,v,out:c.exitEp&&c.exitEp<=w?c.exitEp:0,mine:!!s.kinds&&s.id==='surv'&&TEAMS.alex.some(x=>c.name.startsWith(x))}});
  const f=EX.filt,tribeOk=r=>s.id==='surv'?(r.c.tribeNow||r.c.tribe)===f:true;
  return rows.filter(r=>f==='all'||(f==='in'&&!r.out)||(f==='out'&&r.out)||(f==='mine'&&r.mine)||(!['all','in','out','mine'].includes(f)&&tribeOk(r)))
    .sort((p,q)=>EX.dir*((p.v[exKey(EX.sort)]??0)-(q.v[exKey(EX.sort)]??0))||(!!p.out-!!q.out))}
// patterns: observations the data supports, each a view that shows it
function exPatterns(s){const w=whereOf(s,'alex'),src=STATS[s.id].season(),cnt=(c,k)=>(c.why||[]).filter(x=>x[0]<=w&&[].concat(k).includes(x[1])).length,P=[];
  if(s.id==='surv'){const live=src.cast.filter(c=>!(c.exitEp&&c.exitEp<=w)),T=Object.keys(src.tribes||{}).filter(t=>live.some(c=>(c.tribeNow||c.tribe)===t));
    // current tribes (after a swap a tribe can have no original members), by their members' average immunity wins
    const avg=T.map(t=>{const m=live.filter(c=>(c.tribeNow||c.tribe)===t);return [t,m.reduce((x,c)=>x+cnt(c,'tribeImmunity'),0)/m.length]}).sort((x,y)=>x[1]-y[1]);
    if(avg.length>1)P.push([`${avg[0][0]}'s members have the fewest immunity wins (${avg[0][1].toFixed(1)} each, vs ${avg[avg.length-1][1].toFixed(1)} on ${avg[avg.length-1][0]})`,{view:'table',sort:'tribeImmunity',filt:avg[0][0]}]);
    const out=src.cast.filter(c=>c.exitEp&&c.exitEp<=w&&c.exitMethod==='Voted Out'),warned=out.filter(c=>(c.why||[]).some(x=>x[1]==='survivedVotes'&&x[0]<c.exitEp));
    if(out.length)P.push([`${warned.length} of ${out.length} people voted out had their name written down before`,{view:'table',sort:['survivedVotes','Voted Out'],filt:'all'}]);
    const maj=src.cast.filter(c=>!(c.exitEp&&c.exitEp<=w)).map(c=>[c,cnt(c,'votedWithMajority')]).sort((x,y)=>y[1]-x[1])[0];
    if(maj&&maj[1]>1)P.push([`${first(maj[0].name)} has voted with the majority ${maj[1]} times and is still in`,{view:'table',sort:'votedWithMajority',filt:'in'}]);
    const idol=src.cast.filter(c=>cnt(c,'idolFound'));if(idol.length)P.push([`${idol.filter(c=>!(c.exitEp&&c.exitEp<=w)).length} of ${idol.length} idol finders are still in the game`,{view:'table',sort:'idolFound',filt:'all'}])}
  if(s.id==='trt'){const clean=src.cast.filter(c=>!(c.exitEp&&c.exitEp<=w)&&cnt(c,'zeroVotes')>=Math.max(1,w-1));if(clean.length)P.push([`${clean.length} people have never had a vote against them`,{view:'table',sort:'zeroVotes',filt:'in'}]);
    const sh=src.cast.filter(c=>cnt(c,'shieldWon'));if(sh.length)P.push([`${sh.length} shield${sh.length>1?'s':''} won so far · see who`,{view:'table',sort:'shieldWon',filt:'all'}])}
  return P.slice(0,3)}

function explorerHTML(s,faces){if(EX.sid!==s.id){Object.assign(EX,{sid:s.id,view:'faces',sort:'pts',dir:-1,filt:'all',range:'all',cmp:[],picking:false})}
  const w=whereOf(s,'alex'),src=STATS[s.id].season(),seg=[['faces','Faces'],['table','Table'],['heat','By episode']];
  const filts=[['all','All'],['in','Still in'],['out','Out'],...(s.id==='surv'?Object.keys(src.tribes||{}).map(t=>[t,t]):[]),...(s.kinds&&s.id==='surv'?[['mine','Mine']]:[])];
  let body='';
  if(EX.view==='faces')body=faces;
  else{const rows=exRows(s),cols=EXCOLS[s.id];
    const pats=exPatterns(s);
    body=`${pats.length?`<div class="ex-pats">${pats.map((p,i)=>`<button class="ex-pat" data-pat="${i}">${svg('bolt')}<span>${p[0]}</span>${svg('chev')}</button>`).join('')}</div>`:''}
      <div class="ex-filt">${filts.map(([k,l])=>`<button class="chip${EX.filt===k?' on':''}" data-exf="${k}">${l}</button>`).join('')}</div>
      <div class="ex-range"><span class="muted small">Episodes</span>${[['all',`1–${w}`],['last2',`Last 2`],['last',`Ep ${w} only`]].map(([k,l])=>`<button class="chip${EX.range===k?' on':''}" data-exr="${k}">${l}</button>`).join('')}</div>
      <div class="ex-tools"><button class="ex-tool${EX.picking?' on':''}" data-excmp>${svg('swap')}${EX.picking?`Pick two · ${EX.cmp.length}/2`:'Compare'}</button><button class="ex-tool" data-exshare>${svg('send')}Share this view</button></div>`;
    if(EX.view==='table'){const sk=exKey(EX.sort);
      body+=`<div class="ex-wrap"><table class="ex-t"><thead><tr><th class="nm">${rows.length} shown</th>${cols.map(([k,l,full])=>`<th data-exs='${exKey(k)}' class="${exKey(k)===sk?'on':''}" title="${full}">${l}${exKey(k)===sk?(EX.dir<0?' ▼':' ▲'):''}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(r=>`<tr class="${r.out?'out':''}${EX.cmp.includes(r.c.name)?' pick':''}" data-exc="${r.c.name}"><td class="nm"><img src="${ph(r.c)}" alt=""><span>${first(r.c.name)}${r.out?`<small>Out · Ep ${r.out}</small>`:r.mine?'<small class="mine">Yours</small>':''}</span></td>${cols.map(([k])=>`<td class="${exKey(k)===sk?'on':''}">${r.v[exKey(k)]}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
        <p class="ex-key">${cols.slice(1).map(([,l,full])=>`<b>${l}</b> ${full.toLowerCase()}`).join(' · ')}</p>`}
    else{const eps=Array.from({length:w},(_,k)=>k+1),hrows=rows.slice().sort((p,q)=>q.v['"pts"']-p.v['"pts"']);
      body+=`<div class="ex-wrap"><table class="ex-t ex-heat"><thead><tr><th class="nm">Points</th>${eps.map(e=>`<th>Ep ${e}</th>`).join('')}<th>All</th></tr></thead><tbody>${hrows.map(r=>`<tr class="${r.out?'out':''}" data-exc="${r.c.name}"><td class="nm"><img src="${ph(r.c)}" alt=""><span>${first(r.c.name)}</span></td>${eps.map(e=>{const p=r.c.perEp[e-1],gone=r.out&&e>r.out;
        return `<td class="hc" style="${gone?'':`background:${p>0?`rgba(53,181,165,${Math.min(.85,.15+p/10)})`:p<0?`rgba(242,84,91,${Math.min(.8,.25-p/8)})`:'transparent'}`}">${gone?'·':p??''}</td>`}).join('')}<td><b>${r.v['"pts"']}</b></td></tr>`).join('')}</tbody></table></div><p class="ex-key">Green scored, red lost points, · already out. Tap a row for their story.</p>`}}
  return `<section class="blk ex"><div class="ex-seg">${seg.map(([k,l])=>`<button class="${EX.view===k?'on':''}" data-exv="${k}">${l}</button>`).join('')}<span class="muted small">Up to Ep ${w}</span></div>${body}</section>`}
// a castaway's story, episode by episode (what the research recorded)
function exProfile(s,name){const c=STATS[s.id].season().cast.find(x=>x.name===name),w=whereOf(s,'alex');
  openSheet(c.name,`${s.short} · up to Episode ${w}${c.exitEp&&c.exitEp<=w?` · out in Episode ${c.exitEp}`:''}`,`<div class="ex-prof"><img src="${ph(c)}" alt=""><div>${Array.from({length:w},(_,k)=>k+1).map(e=>{const ev=(c.why||[]).filter(x=>x[0]===e);return `<div class="ex-ep"><span class="n num">${e}</span><span>${ev.length?ev.map(x=>(EXCOLS[s.id].find(k=>[].concat(k[0]).includes(x[1]))||[,,x[1]])[2]).join(' · '):c.exitEp&&e>c.exitEp?'Already out':'Nothing recorded'}</span><b class="num">${c.perEp[e-1]??''}</b></div>`}).join('')}</div></div>`)}
function exCompare(s,names){const [A,B]=names.map(n=>exRows(s).find(r=>r.c.name===n)||null);if(!A||!B)return;
  openSheet('Side by side',`${s.short} · up to Episode ${whereOf(s,'alex')}`,`<div class="ex-cmp"><div class="hd"><span><img src="${ph(A.c)}" alt=""><b>${first(A.c.name)}</b></span><span><img src="${ph(B.c)}" alt=""><b>${first(B.c.name)}</b></span></div>
    ${EXCOLS[s.id].map(([k,,full])=>{const a=A.v[exKey(k)],b=B.v[exKey(k)];return `<div class="row2"><b class="num${a>b?' win':''}">${a}</b><span>${full}</span><b class="num${b>a?' win':''}">${b}</b></div>`}).join('')}</div>`)}
function wireExplorer(s){const re=()=>{const y=$('scroller').scrollTop;route();$('scroller').scrollTop=y};
  app.querySelectorAll('[data-exv]').forEach(b=>b.onclick=()=>{EX.view=b.dataset.exv;re()});
  app.querySelectorAll('[data-exf]').forEach(b=>b.onclick=()=>{EX.filt=b.dataset.exf;re()});
  app.querySelectorAll('[data-exr]').forEach(b=>b.onclick=()=>{EX.range=b.dataset.exr;re()});
  app.querySelectorAll('[data-exs]').forEach(b=>b.onclick=()=>{const k=JSON.parse(b.dataset.exs);if(exKey(k)===exKey(EX.sort))EX.dir*=-1;else{EX.sort=k;EX.dir=-1}re()});
  app.querySelectorAll('[data-pat]').forEach(b=>b.onclick=()=>{Object.assign(EX,exPatterns(s)[+b.dataset.pat][1],{dir:-1});re()});
  app.querySelectorAll('[data-exc]').forEach(r=>r.onclick=()=>{if(!EX.picking)return exProfile(s,r.dataset.exc);const n=r.dataset.exc;EX.cmp=EX.cmp.includes(n)?EX.cmp.filter(x=>x!==n):[...EX.cmp,n].slice(-2);
    // re-rendering closes sheets, so the side-by-side opens after it
    if(EX.cmp.length===2){const names=EX.cmp;EX.cmp=[];EX.picking=false;re();exCompare(s,names)}else re()});
  const cmp=app.querySelector('[data-excmp]');if(cmp)cmp.onclick=()=>{EX.picking=!EX.picking;EX.cmp=[];re();if(EX.picking)toast('Tap two people to compare')};
  const sh=app.querySelector('[data-exshare]');if(sh)sh.onclick=()=>{const col=EXCOLS[s.id].find(([k])=>exKey(k)===exKey(EX.sort));const [a,b]=exRange(s);
    [FEED4,FEED12].forEach(F=>F.unshift(['alex','shared a stats view',`${s.short} · sorted by ${col[2].toLowerCase()} · Episodes ${a}–${b}`,null]));toast(`Shared with the couch · ${s.short} chat`)}}

// the Cast tab becomes the explorer for shows we hold stats for; Faces is what Cast showed before
const tabCastEx=tabCast;
tabCast=function(s){return hasStats(s)?explorerHTML(s,tabCastEx(s)):tabCastEx(s)};
const wCastEx=wCast;
wCast=function(s){return hasStats(s)?explorerHTML(s,wCastEx(s)):wCastEx(s)};
const wireShowEx=wireShow;
wireShow=function(s){wireShowEx(s);if(hasStats(s))wireExplorer(s)};
const wireWEx=wireW;
wireW=function(s){wireWEx(s);if(hasStats(s))wireExplorer(s)};
// the condensed stat page links into the table, already sorted
const statsPageEx=statsPage;
statsPage=function(s,focus){statsPageEx(s,focus);const k=STATS[s.id].cats[focus??0][0];
  $('page').querySelector('.st-page').insertAdjacentHTML('afterbegin',`<button class="ex-open" id="exOpen">${svg('lineup')}Open in the stats table, sorted by this</button>`);
  $('exOpen').onclick=()=>{Object.assign(EX,{sid:s.id,view:'table',sort:k,dir:-1,filt:'all',range:'all',cmp:[],picking:false});closePage();const h=`#/show/${s.id}/cast`;if(location.hash===h)route();else location.hash=h}};
