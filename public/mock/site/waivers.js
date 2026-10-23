// ================= waivers in the new design (Weekly Lineup) =================
// Decided with the user 2026-10-23: a Waivers page pushed in from the moves dock and Tonight; the run's results
// play like an episode (a reveal, then an entry in Episodes between the two episodes it sits between); the
// quiet-week "When moves happen" lanes live in the game's How it works. Two versions, switched by ?waivers=
// (or the Scenarios menu), compared side by side on waivers-options.html:
//   v2      the live app's waivers v2 (docs/PLAN-waivers-v2.md, "Phase 2: picked design"), ported faithfully:
//           the plate, Your team with Swap / Replace, claims grouped by spot with backups, the picker with
//           Research's controls, 1A settings, 3B Open a waiver window.
//   simple  the casual-first proposal: the best free agent is already lined up for each spot (so doing nothing
//           is a fine answer), backups are "the best one left" unless you choose, the swap is one optional
//           row, lowest score picks first, settings are one choice of feel with the details folded away.
// The data is real Survivor 51 (Jenna out in Episode 4); the other three couch members' claims are made up.
const WVQ=new URLSearchParams(location.search);
const WV={ver:WVQ.get('waivers')==='v2'?'v2':'simple',stage:'open',shared:false,seen:false,
  claims:{},swaps:[],own:false,touched:false,src:'season',stat:'pts',run:null,
  set:{feel:'balanced',applied:true,rule:'windows',sched:'every',every:3,swaps:1,autoFill:false},
  win:{replace:true,swaps:1}};
const WV_FA=['Sharonda','Devin','Cristian','Linnea','Ori'];
const WV_LINE=['sam','jordan','alex','riley'];
const WV_WANTS={sam:[['Sharonda','Patt']],jordan:[['Linnea','Rob'],['Cristian','Rob']],riley:[['Devin','Ana'],['Ori','Ana']]};
const WV_EP=4,WV_NEXT=7;
const wvDue=()=>{const t=nextAir(SHOWS.find(s=>s.id==='surv').air);t.setDate(t.getDate()-1);return t};
const wvAirs=()=>nextAir(SHOWS.find(s=>s.id==='surv').air);
const wvOut=()=>MOVES.roster.filter(n=>S51C(n).exitEp);
const wvIn=()=>MOVES.roster.filter(n=>!S51C(n).exitEp);
const wvSurv=()=>SHOWS.find(s=>s.id==='surv');
// points (or a stat) over the picker's window, never past what you've seen
const wvRange=()=>{const w=Math.max(1,seen(wvSurv())||WV_EP);return WV.src==='last3'?[Math.max(1,w-2),w]:WV.src==='last'?[w,w]:[1,w]};
const wvVal=(n,k=WV.stat)=>{const [a,b]=wvRange();return exVal(S51C(n),k,a,b)};
const wvPts=n=>+wvVal(n,'pts').toFixed(1);
const wvFree=()=>{const taken=new Set((WV.run||[]).map(r=>r.add)),gone=(WV.run||[]).filter(r=>r.n==='alex'&&r.kind==='swap').map(r=>r.drop);return WV_FA.filter(n=>!taken.has(n)).concat(gone)};
const wvStillFree=()=>{const f=wvFree();return f.length?`${f.slice(0,2).join(' and ')} ${f.length>1?'are':'is'} still free`:"Nobody's left"};
const wvBest=(skip=[])=>wvFree().filter(n=>!skip.includes(n)).sort((a,b)=>wvPts(b)-wvPts(a));
// simple: a spot nobody has touched is the best free agent, backups the best ones left
const wvClaim=drop=>WV.claims[drop]&&WV.claims[drop].length?WV.claims[drop]:WV.ver==='simple'&&!WV.shared?wvBest(WV.swaps.map(p=>p.add)).slice(0,3):WV.ver==='simple'&&WV.shared?wvBest().slice(0,1):[];
const wvPicked=drop=>!!(WV.claims[drop]&&WV.claims[drop].length);
const unitOf=k=>{const st=exStats(wvSurv()).find(x=>exKey(x[0])===exKey(k));return st?st[1]:'Points'};
const wvLineTxt=()=>`you're ${ordinal(WV_LINE.indexOf('alex')+1)} in line`;

// ---------- the run: rounds in picking order; first add still free per spot ----------
function wvCompute(){const taken=new Set(),res=[];
  const mine=wvOut().map(d=>({drop:d,adds:wvClaim(d).length?wvClaim(d):wvBest(),kind:'replace'})).concat(WV.swaps.length?[{drop:null,pairs:WV.swaps,kind:'swap'}]:[]);
  const groups={alex:mine};Object.entries(WV_WANTS).forEach(([n,p])=>groups[n]=[{drop:p[0][1],adds:p.map(x=>x[0]),kind:'replace'}]);
  const max=Math.max(...Object.values(groups).map(g=>g.length));
  for(let r=0;r<max;r++)for(const n of WV_LINE){const g=groups[n][r];if(!g)continue;
    const opts=g.kind==='swap'?g.pairs.map(p=>[p.add,p.drop]):g.adds.map(a=>[a,g.drop]);
    const i=opts.findIndex(([a])=>WV.shared||!taken.has(a));if(i<0)continue;const [add,drop]=opts[i];if(!WV.shared)taken.add(add);
    const lost=i>0?res.find(x=>x.add===opts[0][0]):null;res.push({n,add,drop,choice:i+1,kind:g.kind,lostTo:lost&&lost.n,want:opts[0][0]})}
  return res}
function wvDoRun(){const res=wvCompute();WV.before={roster:MOVES.roster.slice(),starters:new Set(MOVES.starters)};
  WV.run=res;res.filter(r=>r.n==='alex').forEach(r=>{const k=MOVES.roster.indexOf(r.drop);if(k>=0)MOVES.roster[k]=r.add;if(MOVES.starters.has(r.drop)){MOVES.starters.delete(r.drop);MOVES.starters.add(r.add)}});
  WV.stage='ran';WV.seen=false;BS.ran=true;BS.window='closed'}
function wvUndo(){if(WV.before){MOVES.roster=WV.before.roster;MOVES.starters=WV.before.starters}WV.run=null;WV.stage='open';WV.seen=false;BS.ran=false;BS.window='open'}
// Backstage's Run now and Undo flip BS; the player side follows
function wvSync(){if(BS.ran&&WV.stage==='open')wvDoRun();else if(!BS.ran&&WV.stage==='ran')wvUndo()}
const wvMineRun=()=>(WV.run||[]).filter(r=>r.n==='alex');
const wvSentence=r=>{const who=r.n==='alex'?'You':r.n,ch=r.choice===1?'1st choice':`${ordinal(r.choice)} choice`;
  return {b:`${who} got ${r.add} for ${r.drop}`,s:WV.shared?(r.kind==='swap'?'A swap':'A replacement'):r.lostTo?`${ch} · ${r.lostTo==='alex'?'you':r.lostTo} got ${r.want} first`:ch}};

// ---------- the page ----------
function wvHead(s,title,back,label){return `<header class="sbar"><img src="${ART(s.art)}" alt="" style="object-position:${s.hpos||s.pos}"><div class="sbar-top"><a class="back" href="${back}">${svg('chev')}${label}</a><span class="sbar-st">${svg('swap')}Weekly Lineup</span><span style="width:44px"></span></div><b class="cap sbar-name">${title}</b></header>`}
function waiversRoute(sid,sub,arg){const s=SHOWS.find(x=>x.id===sid);if(!s||sid!=='surv')return showRouteW(sid,'tonight');wvSync();
  if(sub==='pick'&&WV.stage==='open')return wvPickRoute(s,decodeURIComponent(arg||''));
  SHOWSTATE.tab='waivers';
  const body=WV.stage==='ran'?wvRanHTML(s):WV.stage==='quiet'?wvQuietHTML(s):WV.ver==='v2'?wvV2HTML(s):wvSimpleHTML(s);
  app.innerHTML=`<div class="show wvpage">${wvHead(s,'Waivers',`#/show/${sid}/tonight`,s.name.replace('The ',''))}<div class="show-body">${body}<div style="height:40px"></div></div></div>`;
  wireWaivers(s);$('scroller').scrollTop=0}

// the v2 port: plate, Your team, Your claims grouped by spot
function wvPlateLine(){const out=wvOut(),sw=WV.win.swaps;return [out.length&&WV.win.replace?`Replace ${out.join(' and ')}`:'',sw?`Swap ${sw>=5?'any':sw}`:''].filter(Boolean).join(' · ')}
function wvV2HTML(s){const out=wvOut(),swLeft=WV.win.swaps;
  const team=MOVES.roster.map(n=>{const c=S51C(n),o=!!c.exitEp,mine=WV.shared&&o&&wvPicked(n)?WV.claims[n][0]:WV.shared&&!o&&WV.swaps.find(p=>p.drop===n);
    return `<div class="wv-tr${o?' out':''}"><img src="${ph(c)}" alt=""><span class="tx"><b>${n}</b><small>${mine?`${o?mine:mine.add} for ${n} · joins your team ${fmtT(wvDue())}`:o?`Keeps ${c.total} pts`:`${c.total} pts`}</small></span>${o?'<span class="wv-out cap">Out</span>':''}
      <a class="wv-act${o?' rep':''}" href="#/show/surv/waivers/pick/${n}">${mine?'Change':o?'Replace':'Swap'}</a></div>`}).join('');
  const groups=WV.shared?'':`<section class="blk"><div class="sh"><h2 class="cap">Your claims</h2><span class="aside">Private until they run</span></div>
    ${out.map(d=>{const L=WV.claims[d]||[];return `<div class="wv-gh"><span class="cap">Replacing ${d}</span><span>You get 1</span></div>
      ${L.map((a,i)=>`<div class="wv-cr"><button class="wv-grip" data-grip="${d}|${i}" aria-label="Move or remove ${a}">${svg('dots')}</button><span class="num rk">${i+1}</span><img src="${ph(S51C(a))}" alt=""><span class="tx"><b>${a}</b><small>${i===0?'First choice':`If ${L.slice(0,i).join(' and ')}${i>1?' are':"'s"} taken`}</small></span></div>`).join('')}
      <a class="wv-addb" href="#/show/surv/waivers/pick/${d}">${svg('plus')}${L.length?'Add a backup':'Pick a replacement'}</a>`}).join('')}
    ${WV.swaps.length?`<div class="wv-gh"><span class="cap">Swap · ${swLeft} allowed</span><span>You get ${swLeft}</span></div>
      ${WV.swaps.map((p,i)=>`<div class="wv-cr"><button class="wv-grip" data-grip="swap|${i}" aria-label="Move or remove">${svg('dots')}</button><span class="num rk">${i+1}</span><img src="${ph(S51C(p.add))}" alt=""><span class="tx"><b>${p.add} for ${p.drop}</b><small>${i===0?`First choice · ${S51C(p.drop).total} pts go`:`Only if ${WV.swaps.slice(0,i).map(x=>x.add).join(' and ')}${i>1?' are':"'s"} taken`}</small></span></div>`).join('')}
      <a class="wv-addb" href="#/show/surv/waivers/pick/${WV.swaps[0].drop}">${svg('plus')}Add a backup</a>`:''}
    <p class="muted small" style="margin-top:12px">Then free agency until airtime.</p></section>`;
  return `<section class="blk"><div class="plate"><span class="tg cap">Window</span><span class="bd"><span class="t cap">${wvPlateLine()}</span><span class="d">Due ${fmtT(wvDue())} · ${WV.shared?'you get who you pick':wvLineTxt()}</span></span></div></section>
  <section class="blk"><div class="sh"><h2 class="cap">Your team</h2><span class="aside wv-sa">Swaps allowed <b class="num">${swLeft-(WV.shared?WV.swaps.length:0)}</b></span></div>${team}</section>
  ${groups}${wvHowRow()}`}

// the simple version: the spot is already filled with the best free agent; you only act if you want to
function wvHand(out,inn,tag,cls,act){const o=S51C(out),c=S51C(inn);
  return `<div class="wvs-hand"><div class="wvs-p out"><img src="${ph(o)}" alt=""><span class="tg cap">Out</span><b>${out}</b><small>Keeps ${o.total} pts</small></div>
    <span class="wvs-arr" aria-hidden="true">${svg('chev')}</span>
    <button class="wvs-p in ${cls}" ${act||''}><img src="${ph(c)}" alt=""><span class="tg cap">${tag}</span><b>${inn}</b><small>${wvPts(inn)} pts · ${S51C(inn).tribeNow||S51C(inn).tribe}</small></button></div>`}
function wvSimpleHTML(s){const out=wvOut();
  const spots=out.map(d=>{const L=wvClaim(d),mine=wvPicked(d),a=L[0];
    return `<section class="blk wvs"><div class="wvs-k"><span class="cap">${mine?'Your pick':'Lined up for you'}</span><span>Change until ${fmtT(wvDue())}</span></div>
      <h2 class="cap wvs-q">${mine?`${a} takes ${d}'s spot`:`${a}'s lined up for ${d}'s spot`}</h2>
      ${wvHand(d,a,mine?'Your pick':'Best free',mine?'mine':'sug',`data-wvs="pick" data-d="${d}"`)}
      <p class="wvs-why">${WV.shared?`Nobody else can take ${a}: everyone gets who they pick.`:mine?(L.length>1?`If someone picking ahead of you takes ${a}, you get ${L[1]}${L.length>2?`, then ${L[2]}`:''}.`:`If someone picking ahead of you takes ${a}, you get the best one left.`)
        :`Most points of anyone free. Do nothing and ${a}'s your claim; if someone ahead takes ${a}, you get the best one left.`}</p>
      <button class="btn out wide" data-wvs="pick" data-d="${d}">${mine?'Change':'Pick someone else'}</button></section>`}).join('');
  const line=WV.shared?'':`<section class="blk"><div class="wvs-line"><div class="sh"><h2 class="cap">Picking order</h2><span class="aside">Lowest score first</span></div>
    <ol>${WV_LINE.map((n,i)=>`<li class="${n==='alex'?'me':''}"><span class="num">${i+1}</span>${av(n,34)}<b>${n==='alex'?'You':n}</b><small>${LINEUP_PTS[n]} pts</small></li>`).join('')}</ol>
    <p class="muted small">Claims stay private until ${fmtT(wvDue())}, then run in this order.</p></div></section>`;
  const sw=WV.swaps[0];
  const swap=`<section class="blk">${sw?`<div class="sh"><h2 class="cap">Your swap</h2><button class="link" data-wvs="unswap">Remove</button></div>${wvHand(sw.drop,sw.add,'Swap in','mine',`data-wvs="swap"`).replace('<span class="tg cap">Out</span>','<span class="tg cap q">Swap out</span>').replace(`Keeps ${S51C(sw.drop).total} pts`,`${S51C(sw.drop).total} pts go too`)}`
    :`<button class="wvs-opt" data-wvs="swap"><span class="ic">${svg('swap')}</span><span class="tx"><b>Swap someone still in</b><small>Optional · ${WV.win.swaps} this week · their points go with them</small></span>${svg('chev')}</button>`}</section>`;
  return spots+line+swap+wvHowRow()}

function wvRanHTML(s){const me=wvMineRun(),rep=me.find(r=>r.kind==='replace'),others=(WV.run||[]).filter(r=>r.n!=='alex');
  const plate=rep?`<div class="plate"><span class="tg good cap">Done</span><span class="bd"><span class="t cap">You got ${rep.add} for ${rep.drop}</span><span class="d">${wvSentence(rep).s.replace(/^./,c=>c.toUpperCase())}</span></span></div>`:'';
  const fa=`<button class="idx wv-fa" data-wvs="fa"><span class="ic">${svg('bolt')}</span><span class="tx"><b>Free agency</b><small>Until ${fmtT(wvAirs())} · first come, first served · ${wvStillFree()}</small></span>${svg('chev')}</button>
    <button class="idx" data-wvs="runpage"><span class="ic">${svg('cal')}</span><span class="tx"><b>Past waivers</b><small>After Episode ${WV_EP} · ${(WV.run||[]).length} moves</small></span>${svg('chev')}</button>
    <button class="idx" data-wvs="replay"><span class="ic">${svg('play')}</span><span class="tx"><b>Watch the run again</b><small>The way it played when it came in</small></span>${svg('chev')}</button>`;
  if(WV.ver==='v2')return `<section class="blk">${plate}</section><section class="blk">${fa}</section>${wvHowRow()}`;
  return `<section class="blk wvs"><div class="wvs-k"><span class="cap">Waivers ran</span><span>After Episode ${WV_EP}</span></div>
    ${rep?`<h2 class="cap wvs-q">${rep.add}'s on your team</h2>${wvHand(rep.drop,rep.add,'Yours','got','disabled')}<p class="wvs-why">${rep.choice===1?'Your 1st choice.':`${rep.lostTo} picked ahead of you and took ${rep.want}, so you got the best one left.`}</p>`:''}</section>
    <section class="blk"><div class="sh"><h2 class="cap">Everyone's moves</h2><span class="aside">In picking order</span></div>${(WV.run||[]).map(r=>{const t=wvSentence(r);return `<div class="wv-mv${r.n==='alex'?' me':''}">${av(r.n,30)}<img src="${ph(S51C(r.add))}" alt=""><span class="tx"><b>${t.b}</b><small>${t.s}</small></span></div>`}).join('')}</section>
    <section class="blk">${fa}</section>${wvHowRow()}`}
function wvQuietHTML(s){return `<section class="blk"><div class="plate"><span class="tg cap q">This week</span><span class="bd"><span class="t cap">Nothing to do this week</span><span class="d">Next swap window: after Episode ${WV_NEXT}</span></span></div></section>
  <section class="blk"><button class="idx" data-wvs="fa"><span class="ic">${svg('bolt')}</span><span class="tx"><b>Free agency</b><small>${wvFree().length} free agents · moves wait for the next window</small></span>${svg('chev')}</button>
  <button class="idx" data-wvs="runpage"><span class="ic">${svg('cal')}</span><span class="tx"><b>Past waivers</b><small>After Episode ${WV_EP} · ${(WV.run||[]).length} moves</small></span>${svg('chev')}</button></section>${wvHowRow()}`}
const wvHowRow=()=>`<section class="blk"><button class="idx" data-wvs="how"><span class="ic">${svg('quiz')}</span><span class="tx"><b>How waivers work here</b><small>When moves happen, who picks first</small></span>${svg('chev')}</button></section>`;

// ---------- the v2 picker: a page, Research's controls, tap order = rank ----------
function wvPickRoute(s,drop){const c=S51C(drop);if(!c)return waiversRoute('surv');const rep=!!c.exitEp;
  WV.pick=WV.pick&&WV.pick.drop===drop?WV.pick:{drop,list:rep?(WV.claims[drop]||[]).slice():WV.swaps.filter(p=>p.drop===drop).map(p=>p.add)};
  app.innerHTML=`<div class="show wvpage">${wvHead(s,rep?`Replace ${drop}`:`Swap ${drop}`,'#/show/surv/waivers','Waivers')}<div class="show-body"><section class="blk wvp" id="wvP">${wvPickBody(drop)}</section><div style="height:120px"></div></div>
    <div class="wv-bar" id="wvBar"></div></div>`;
  wireWvPick(s,drop);$('scroller').scrollTop=0}
function wvPickBody(drop){const L=WV.pick.list,st=WV.stat,one=WV.shared;
  const rows=wvFree().filter(n=>n!==drop).map(n=>({n,v:wvVal(n,st)})).sort((a,b)=>b.v-a.v||wvPts(b.n)-wvPts(a.n));
  return `<p class="wvp-how">${one?'Pick one.':'Tap your first choice, then any backups. You get one.'}</p>
    <div class="ex-seg wvp-win">${[['season','Season'],['last3','Last 3'],['last','Last ep']].map(([k,l])=>`<button class="${WV.src===k?'on':''}" data-wsrc="${k}">${l}</button>`).join('')}</div>
    <button class="wvp-rank" id="wvRank"><span class="cap">Ranked by</span><b>${unitOf(st)}</b>${svg('chev')}</button>
    <div class="wvp-tiles">${rows.map(({n,v})=>{const i=L.indexOf(n),c=S51C(n);return `<button class="mtile wvp-t${i>=0?' st':''}" data-fa="${n}" aria-pressed="${i>=0}"><img src="${ph(c)}" alt="">${i>=0?`<span class="no num">${one?svg('check'):i+1}</span>`:''}<span class="flag">${c.tribeNow||c.tribe}</span><b class="cap">${n}</b><small>${st==='pts'?`${+v.toFixed(1)} pts`:`${v} ${v===1?'time':'times'} · ${wvPts(n)} pts`}</small></button>`}).join('')}</div>`}
function wvPickBar(drop){const L=WV.pick.list;return L.length?`<span class="tx"><small>For ${drop}${L.length>1?` · backup${L.length>2?'s':''} ${L.slice(1).join(', ')}`:''}</small><b class="cap">${L[0]}</b></span><button class="btn pri" id="wvSave">Save</button>`
  :`<span class="tx"><small>For ${drop}</small><b class="cap muted">Tap someone</b></span><button class="btn pri" id="wvSave" disabled>Save</button>`}
function wireWvPick(s,drop){const paint=()=>{$('wvP').innerHTML=wvPickBody(drop);$('wvBar').innerHTML=wvPickBar(drop);wire()};
  const wire=()=>{app.querySelectorAll('[data-fa]').forEach(t=>t.onclick=()=>{const n=t.dataset.fa,L=WV.pick.list,i=L.indexOf(n);
      if(WV.shared)WV.pick.list=i>=0?[]:[n];else if(i>=0)L.splice(i,1);else L.push(n);paint();app.querySelector(`[data-fa="${n}"]`)?.classList.add('pop')});
    app.querySelectorAll('[data-wsrc]').forEach(b=>b.onclick=()=>{WV.src=b.dataset.wsrc;paint()});
    $('wvRank').onclick=()=>openSheet('Ranked by','Any stat from this season\'s research',exStats(wvSurv()).map(([k,l])=>`<button class="typecard${exKey(k)===exKey(WV.stat)?' on':''}" data-wst='${exKey(k)}'><span><b>${l}</b></span></button>`).join(''),
      b=>b.querySelectorAll('[data-wst]').forEach(x=>x.onclick=()=>{WV.stat=JSON.parse(x.dataset.wst);closeSheet();paint()}));
    const sv=$('wvSave');if(sv)sv.onclick=()=>{const L=WV.pick.list.slice(),rep=!!S51C(drop).exitEp;
      if(rep)WV.claims[drop]=L;else WV.swaps=WV.swaps.filter(p=>p.drop!==drop).concat(L.map(a=>({add:a,drop})));
      WV.pick=null;WV.touched=true;toast(WV.shared?`${L[0]} joins your team ${fmtT(wvDue())}`:`Claim saved · ${L[0]}${L.length>1?` + ${L.length-1} backup${L.length>2?'s':''}`:''} for ${drop}`);location.hash='#/show/surv/waivers'}};
  paint()}

// ---------- the simple picker: a sheet, a ranked list, one tap ----------
function wvsPickSheet(drop){let L=wvPicked(drop)?WV.claims[drop].slice():wvClaim(drop).slice(0,1),own=WV.own||L.length>1;
  const body=()=>{const rows=wvFree().filter(n=>!WV.swaps.some(p=>p.add===n)).map(n=>({n,v:wvPts(n)})).sort((a,b)=>b.v-a.v),max=Math.max(1,...rows.map(r=>r.v));
    return `<div class="ex-seg">${[['season','This season'],['last3','Last 3 episodes']].map(([k,l])=>`<button class="${WV.src===k?'on':''}" data-wsrc="${k}">${l}</button>`).join('')}</div>
    ${rows.map(({n,v},i)=>{const k=L.indexOf(n),c=S51C(n);return `<button class="ex-r wvs-r${k>=0?' pick':''}" data-fa="${n}"><span class="rk num">${k>=0?(own?k+1:svg('check')):i+1}</span><img src="${ph(c)}" alt=""><span class="tx"><b>${n}</b><span class="bar"><i style="width:${Math.max(4,v/max*100)}%"></i></span><small>${c.tribeNow||c.tribe}${i===0?' · most points of anyone free':''}</small></span><span class="val"><b class="num">${v}</b><small>pts</small></span></button>`}).join('')}
    ${WV.shared?'':`<button class="wvs-own${own?' on':''}" id="wvOwn"><span class="switch${own?' on':''}"><i></i></span><span><b>Choose my own backups</b><small>${own?'Tap in order: 1st choice, then backups':'Off: if your pick\'s taken, you get the best one left'}</small></span></button>`}
    <button class="btn pri wide" id="wvsOk" ${L.length?'':'disabled'} style="margin-top:12px">${L.length?(own&&L.length>1?`Save ${L[0]} + ${L.length-1} backup${L.length>2?'s':''}`:`Take ${L[0]}`):'Tap someone'}</button>`};
  openSheet(`Who takes ${drop}'s spot?`,`Free agents · claims close ${fmtT(wvDue())}`,`<div id="wvsB">${body()}</div>`,b=>{const paint=()=>{$('wvsB').innerHTML=body();wire()};
    const wire=()=>{b.querySelectorAll('[data-fa]').forEach(r=>r.onclick=()=>{const n=r.dataset.fa,k=L.indexOf(n);if(!own||WV.shared)L=k>=0?[]:[n];else if(k>=0)L.splice(k,1);else L.push(n);paint()});
      b.querySelectorAll('[data-wsrc]').forEach(x=>x.onclick=()=>{WV.src=x.dataset.wsrc;paint()});
      const o=$('wvOwn');if(o)o.onclick=()=>{own=!own;WV.own=own;if(!own)L=L.slice(0,1);paint()};
      $('wvsOk').onclick=()=>{WV.claims[drop]=L;WV.touched=true;closeSheet();toast(WV.shared?`${L[0]} joins your team ${fmtT(wvDue())}`:`${L[0]} takes ${drop}'s spot, if nobody ahead of you takes ${L[0]} first`);route()}};wire()})}
// the optional swap: who goes, then who comes in
function wvsSwapSheet(step,drop){if(step!=='in'){openSheet('Swap someone still in','Optional · their points go with them',
    wvIn().map(n=>{const c=S51C(n);return `<button class="ex-r" data-go="${n}"><img src="${ph(c)}" alt=""><span class="tx"><b>${n}</b><small>${c.total} pts go with them · ${c.tribeNow||c.tribe}</small></span>${svg('chev')}</button>`}).join(''),
    b=>b.querySelectorAll('[data-go]').forEach(x=>x.onclick=()=>{closeSheet();setTimeout(()=>wvsSwapSheet('in',x.dataset.go),230)}));return}
  const taken=wvOut().map(d=>wvClaim(d)[0]);
  openSheet(`Who comes in for ${drop}?`,`${S51C(drop).total} pts leave with ${drop}`,wvFree().filter(n=>!taken.includes(n)).sort((a,b)=>wvPts(b)-wvPts(a)).map(n=>{const c=S51C(n);return `<button class="ex-r" data-in="${n}"><img src="${ph(c)}" alt=""><span class="tx"><b>${n}</b><small>${c.tribeNow||c.tribe}</small></span><span class="val"><b class="num">${wvPts(n)}</b><small>pts</small></span></button>`}).join('')+`<button class="btn out wide" id="wvBackS" style="margin-top:12px">Back</button>`,
    b=>{b.querySelectorAll('[data-in]').forEach(x=>x.onclick=()=>{WV.swaps=[{add:x.dataset.in,drop}];WV.touched=true;closeSheet();toast(`Swap claimed · ${x.dataset.in} for ${drop}`);route()});$('wvBackS').onclick=()=>{closeSheet();setTimeout(()=>wvsSwapSheet(),230)}})}
// free agency: instant, first come; a move uses the window's swap
function wvFaSheet(){const used=wvMineRun().some(r=>r.kind==='swap'),quiet=WV.stage==='quiet';
  openSheet('Free agency',quiet?'Moves open at the next waiver window':`Instant until ${fmtT(wvAirs())} · first come, first served`,
    wvFree().sort((a,b)=>wvPts(b)-wvPts(a)).map(n=>{const c=S51C(n);return `<div class="ex-r"><img src="${ph(c)}" alt=""><span class="tx"><b>${n}</b><small>${c.tribeNow||c.tribe} · ${wvPts(n)} pts</small></span>${quiet||used?'':`<button class="rolebtn" data-faadd="${n}">Swap in</button>`}</div>`}).join('')
    +`<p class="muted small" style="margin-top:12px">${quiet?`Next waiver window: after Episode ${WV_NEXT}.`:used?'You used this week\'s swap in the run.':`1 swap this week: pick who comes in, then who goes.`}</p>`,
    b=>b.querySelectorAll('[data-faadd]').forEach(x=>x.onclick=()=>{const add=x.dataset.faadd;closeSheet();setTimeout(()=>openSheet(`Who goes for ${add}?`,'Their points go with them',wvIn().map(n=>`<button class="ex-r" data-fago="${n}"><img src="${ph(S51C(n))}" alt=""><span class="tx"><b>${n}</b><small>${S51C(n).total} pts</small></span></button>`).join(''),
      bb=>bb.querySelectorAll('[data-fago]').forEach(y=>y.onclick=()=>{const d=y.dataset.fago,k=MOVES.roster.indexOf(d);MOVES.roster[k]=add;if(MOVES.starters.has(d)){MOVES.starters.delete(d);MOVES.starters.add(add)}
        (WV.run=WV.run||[]).push({n:'alex',add,drop:d,choice:1,kind:'swap',fa:true});closeSheet();toast(`${add}'s on your team · ${d} is a free agent`);route()})),230)}))}
// the run's own page: like an episode's, in picking order
function wvRunPage(){openPage(`Waivers · after Episode ${WV_EP}`,`<section class="blk" style="margin-top:12px"><p class="muted small">Ran ${fmtT(wvDue())} · claims went in picking order${WV.shared?'':' (lowest score first)'}.</p></section>
  <section class="blk">${(WV.run||[]).map((r,i)=>{const t=wvSentence(r);return `<div class="wv-mv${r.n==='alex'?' me':''}"><span class="num rk">${i+1}</span>${av(r.n,30)}<img src="${ph(S51C(r.add))}" alt=""><span class="tx"><b>${t.b}</b><small>${r.fa?'Free agency':t.s}</small></span></div>`}).join('')}</section>
  <section class="blk"><p class="muted small">Then free agency until airtime. Their old points stay with whoever's out.</p></section><div style="height:40px"></div>`)}

// ---------- the run plays like an episode ----------
function wvReveal(){const me=wvMineRun().find(r=>r.kind==='replace'),c=me&&S51C(me.add);
  const beats=[`<div class="rb"><span class="cap rk">Weekly Lineup · after Episode ${WV_EP}</span><h2 class="cap">Waivers<br>ran</h2><p class="muted">Tap anywhere to go on</p></div>`,
    me?`<div class="rb vote"><div class="vcard"><img src="${ph(c)}" alt=""><span class="tg cap" style="background:var(--good);color:var(--good-ink)">You got</span><div class="vn"><b class="cap">${c.name}</b><small>For ${me.drop} · ${me.choice===1?'your 1st choice':`your ${ordinal(me.choice)} choice`}</small></div></div></div>`:'',
    me&&me.lostTo?`<div class="rb"><span class="cap rk">Why not ${me.want}</span><div class="wv-rline">${WV_LINE.map((n,i)=>`<span class="${n===me.lostTo?'hit':n==='alex'?'me':''}"><b class="num">${i+1}</b>${av(n,40)}<small>${n==='alex'?'You':n}</small></span>`).join('')}</div><p style="font-size:18px;line-height:1.4">${me.lostTo} picked ahead of you and took ${me.want}. You got the best one left.</p></div>`:'',
    `<div class="rb"><span class="cap rk">Everyone's moves</span><div class="tally">${(WV.run||[]).map((r,i)=>{const t=wvSentence(r);return `<div class="tli" style="--i:${i}"><img src="${ph(S51C(r.add))}" alt=""><span><b>${t.b}</b><small>${t.s}</small></span></div>`}).join('')}</div></div>`,
    `<div class="rb"><span class="cap rk">Until ${fmtT(wvAirs())}</span><h2 class="cap" style="font-size:48px">Free agency<br>is open</h2><p class="muted">${wvStillFree()}. First come, first served.</p></div>`].filter(Boolean);
  const r=document.createElement('div');r.className='revealfs v2';let k=0;
  r.innerHTML=`<div class="rtop"><span class="cap">Waivers</span><button id="rskip">Skip</button></div><div class="rstage" id="rstage"></div><div class="rdots">${beats.map(()=>'<i></i>').join('')}</div><button class="btn ink wide rdone" id="rvd">Done</button>`;
  $('device').appendChild(r);
  const show=()=>{const st=r.querySelector('#rstage');st.innerHTML=beats[k];st.firstElementChild.classList.add('in');r.querySelectorAll('.rdots i').forEach((d,i)=>d.classList.toggle('on',i<=k));r.classList.toggle('last',k===beats.length-1)};
  show();r.querySelector('#rstage').onclick=()=>{if(k<beats.length-1){k++;show()}};r.querySelector('#rskip').onclick=()=>{k=beats.length-1;show()};
  r.querySelector('#rvd').onclick=()=>{r.remove();WV.seen=true;route()}}

// ---------- How it works: three answers for this league, then when moves happen ----------
function wvHowHTML(){const swap=WV.set.sched==='manual'?'When your commissioner opens a waiver window.':`${WV.win.swaps} swap every ${WV.set.every} episodes. Next: after Episode ${WV_NEXT}.`;
  const rep={always:'Replace them after any episode. Their points stay.',whenShort:'Replace them once you\'re down to 2 still in.',windows:'Replace them at the next waiver window. Their points stay.',never:'They stay on your team; there are no replacements.'}[WV.set.rule];
  const order=WV.ver==='simple'?'Lowest score picks first.':'Waiver order: get someone, go to the back of the line.';
  const cols=[];for(let e=WV_EP-2;e<WV_EP+8;e++)cols.push(e);
  const open=e=>WV.set.sched==='every'?(e-1)%WV.set.every===0:WV.set.sched==='everyEpisode';
  const lane=(name,on)=>`<div class="wv-lane"><span class="cap">${name}</span>${cols.map(e=>`<i class="${e<WV_EP?'past ':''}${e===WV_EP?'now ':''}${on&&open(e)?'on':''}"></i>`).join('')}</div>`;
  return `<div class="wv-how"><p class="label cap">Waivers here</p>
    ${[['Someone of yours voted out?',rep],['Swap someone still in?',swap],['Two of you want the same person?',order]].map(([q,a])=>`<div class="wv-q"><b>${q}</b><span>${a}</span></div>`).join('')}
    <p class="label cap">When moves happen</p>
    <div class="wv-lanes">${lane('Replace',WV.set.rule!=='never')}${lane('Swap',WV.win.swaps>0)}<div class="wv-lane ax"><span></span>${cols.map(e=>`<b class="num${e===WV_EP?' now':''}">${e}</b>`).join('')}</div></div>
    <p class="wv-leg"><i></i>Open, the day after that episode until the next one airs</p>
    <p class="muted small" style="line-height:1.5">Every ${WV.set.every}${WV.set.every===3?'rd':'th'} episode a waiver window opens: claims are private until they run, then free agency until airtime. In between, teams play as they are.</p></div>`}
const rulesSheetW=rulesSheet;
rulesSheet=function(g){rulesSheetW(g);if(g!=='lineup')return;const b=$('sheet').querySelector('.body .chips');if(b)b.insertAdjacentHTML('beforebegin',wvHowHTML())};

// ---------- commissioner: 1A settings (v2) or one choice of feel (simple), 3B Open a waiver window ----------
const WV_FEEL={casual:{rule:'whenShort',every:4,autoFill:true,b:[['swap','Lose someone? Replace them once you\'re down to 2.'],['cal','1 swap every 4 episodes.'],['people','Lowest score gets first pick.'],['check','No claim in? They get the top free agent.']]},
  balanced:{rule:'windows',every:3,autoFill:false,b:[['swap','Lose someone? They wait for a waiver window.'],['cal','1 swap every 3 episodes.'],['people','Get a free agent, go to the back of the line.'],['bell','Claims are due a day before each episode.']]},
  competitive:{rule:'never',every:2,autoFill:false,b:[['x','Out is out: no replacements.'],['cal','1 swap every 2 episodes.'],['people','Get a free agent, go to the back of the line.'],['bolt','Miss the deadline, play short.']]}};
const WV_RULES=[['always','Replace right away','After any episode'],['whenShort','Only when short','Down to 2 still in'],['windows','Wait for a waiver window','Out castaways sit until then'],['never','No replacements','Out is out']];
function wvSettingsBody(){const S=WV.set,F=WV_FEEL[S.feel],sug=WV_FEEL[S.feel].rule;
  const rules=WV_RULES.map(([k,t,d])=>`<button class="wv-radio${S.rule===k?' on':''}" data-wrule="${k}"><i></i><span><b>${t}</b><small>${d}</small></span>${k===sug?'<span class="wv-sug cap">Suggested</span>':''}</button>`).join('');
  const windows=`<p class="muted small">When players can swap someone still in. Swapped castaways take their points with them.</p>
    <div class="ex-seg" style="margin-top:10px">${[['everyEpisode','Every episode'],['every',`Every ${S.every}`],['manual','You decide']].map(([k,l])=>`<button class="${S.sched===k?'on':''}" data-wsched="${k}">${l}</button>`).join('')}</div>
    <div class="wv-step"><span><b>Swaps each</b><small>${S.sched==='manual'?'Set when you open one':`Next window: after Episode ${WV_NEXT}`}</small></span><div class="stepper"><button data-wsw="-1" aria-label="Fewer">−</button><b class="num">${S.swaps===0?'None':S.swaps>=5?'All':S.swaps}</b><button data-wsw="1" aria-label="More">+</button></div></div>`;
  const timing=`${[['Claim deadline','1 day before'],['Waiver order',WV.ver==='simple'?'Lowest score first':'Rolling'],['Free agency','Until airtime']].map(([k,v])=>`<div class="wv-val"><b>${k}</b><span>${v}</span></div>`).join('')}
    <button class="wv-val tog" id="wvAuto"><span><b>Auto-fill</b><small>No claim in? They get the top free agent.</small></span><span class="wv-sw${S.autoFill?' on':''}"><i></i></span></button>`;
  if(WV.ver==='v2')return `<div class="wv-card"><div class="wv-ch"><span class="cap">Suggested</span><small>4 teams of 5 · ${WV_FA.length} free agents</small></div>
    <div class="ex-seg wv-feel">${Object.keys(WV_FEEL).map(k=>`<button class="${S.feel===k?'on':''}" data-wfeel="${k}">${k[0].toUpperCase()+k.slice(1)}</button>`).join('')}</div>
    <ul>${F.b.map(([i,t])=>`<li>${svg(i)}${t}</li>`).join('')}</ul>
    ${S.applied?`<p class="wv-applied">${svg('check')}Your league is on ${S.feel[0].toUpperCase()+S.feel.slice(1)}.</p>`:`<button class="btn pri wide" id="wvApply">Apply ${S.feel[0].toUpperCase()+S.feel.slice(1)} settings</button><p class="muted small" style="text-align:center;margin-top:6px">Or set your own below.</p>`}</div>
    <p class="label cap">When someone's voted out</p>${rules}<p class="label cap">Waiver windows</p>${windows}<p class="label cap">Timing</p>${timing}
    <button class="wv-prev" id="wvPrev">Preview what players see</button>`;
  return `<p class="muted small" style="margin-bottom:10px">Pick a feel. It sets everything below; your players see it in How it works.</p>
    ${Object.entries(WV_FEEL).map(([k,f])=>`<button class="wvs-feel${S.feel===k?' on':''}" data-wfeel="${k}"><span class="hd"><i></i><b class="cap">${k}</b>${k==='balanced'?'<span class="wv-sug cap">Suggested</span>':''}</span>
      <small>${{casual:'Forgiving. Nobody falls behind for bad luck.',balanced:'Losses wait for a window; swaps every few episodes.',competitive:'Every loss costs you. Stay sharp.'}[k]}</small>
      ${S.feel===k?`<ul>${f.b.map(([i,t])=>`<li>${svg(i)}${t}</li>`).join('')}</ul>`:''}</button>`).join('')}
    <details class="wvs-fine"${WV.fine?' open':''}><summary><b>Fine-tune</b><small>${S.applied?'Using the feel above':'Customized'}</small>${svg('chev')}</summary>
      <p class="label cap">When someone's voted out</p>${rules}<p class="label cap">Waiver windows</p>${windows}<p class="label cap">Timing</p>${timing}</details>
    <button class="wv-prev" id="wvPrev">Preview what players see</button>`}
function wvSettingsSheet(){openSheet('Waivers settings','Weekly Lineup · Survivor 51',`<div id="wvSB">${wvSettingsBody()}</div>`,b=>{const paint=()=>{const y=b.scrollTop;$('wvSB').innerHTML=wvSettingsBody();b.scrollTop=y;wire()};
  const feel=k=>{const f=WV_FEEL[k];Object.assign(WV.set,{feel:k,rule:f.rule,every:f.every,autoFill:f.autoFill,applied:true})};
  const wire=()=>{const S=WV.set;b.querySelectorAll('[data-wfeel]').forEach(x=>x.onclick=()=>{if(WV.ver==='v2'){S.feel=x.dataset.wfeel;S.applied=false}else feel(x.dataset.wfeel);paint()});
    const ap=$('wvApply');if(ap)ap.onclick=()=>{feel(S.feel);toast(`Waivers on ${S.feel[0].toUpperCase()+S.feel.slice(1)} · the couch sees it in How it works`);paint()};
    const det=b.querySelector('.wvs-fine');if(det)det.ontoggle=()=>WV.fine=det.open;
    b.querySelectorAll('[data-wrule]').forEach(x=>x.onclick=()=>{S.rule=x.dataset.wrule;S.applied=false;paint()});
    b.querySelectorAll('[data-wsched]').forEach(x=>x.onclick=()=>{S.sched=x.dataset.wsched;S.applied=false;paint()});
    b.querySelectorAll('[data-wsw]').forEach(x=>x.onclick=()=>{S.swaps=Math.max(0,Math.min(5,S.swaps+ +x.dataset.wsw));S.applied=false;paint()});
    $('wvAuto').onclick=()=>{S.autoFill=!S.autoFill;S.applied=false;paint()};
    $('wvPrev').onclick=()=>{closeSheet();setTimeout(()=>rulesSheet('lineup'),230)}};wire()})}
// 3B: no names anywhere, so it can open before everyone's revealed the episode
const wvWinLine=(rep,sw)=>[rep?'Replace who\'s out':'',sw?(sw>=5?'Swap any':sw===1?'Swap 1':`Swap up to ${sw}`):''].filter(Boolean).join(' · ');
function wvOpenSheet(onOpen){let rep=true,sw=1,custom=WV.ver==='v2';
  const P=[['rep','Replacements','Each player replaces who\'s out. Their points stay.',true,0],['one','Replacements + a swap','And 1 swap each for someone still in.',true,1],['all','Rebuild','Replace who\'s out and swap any of the rest, e.g. after the merge.',true,5]];
  const body=()=>{const line=wvWinLine(rep,sw);
    const ctl=`<button class="wv-val tog" id="wvRep"><span><b>Replace castaways who are out</b><small>${rep?'Each gets a free agent. Their points stay.':'Out castaways stay on the team.'}</small></span><span class="wv-sw${rep?' on':''}"><i></i></span></button>
      <div class="wv-step"><span><b>Swap castaways still in</b><small>${sw===0?'Nobody still in can move.':sw>=5?'Any of them. Their points go too.':`Up to ${sw} each. Their points go too.`}</small></span><div class="stepper"><button data-wsw="-1" aria-label="Fewer">−</button><b class="num">${sw===0?'None':sw>=5?'All':sw}</b><button data-wsw="1" aria-label="More">+</button></div></div>`;
    return `${custom?ctl:P.map(([k,t,d,r,n])=>`<button class="wvs-feel${rep===r&&sw===n?' on':''}" data-wp="${k}"><span class="hd"><i></i><b class="cap">${t}</b></span><small>${d}</small></button>`).join('')+`<button class="wv-prev" id="wvCustom">Something else</button>`}
      <p class="label cap">Players get</p>${line?`<div class="plate"><span class="tg cap q">Window</span><span class="bd"><span class="t cap">${line}</span><span class="d">Optional · due ${fmtT(wvDue())}</span></span></div>`:`<div class="wv-none">Nothing to claim yet</div>`}
      <div class="frow" style="margin-top:14px"><button class="btn out" data-close2>Not now</button><button class="btn pri" id="wvOpenGo" ${line?'':'disabled'}>Open window</button></div>`};
  openSheet('Open a waiver window',`After Episode ${WV_EP} · claims due ${fmtT(wvDue())}`,`<div id="wvOB">${body()}</div>`,b=>{const paint=()=>{$('wvOB').innerHTML=body();wire()};
    const wire=()=>{const r=$('wvRep');if(r)r.onclick=()=>{rep=!rep;paint()};b.querySelectorAll('[data-wsw]').forEach(x=>x.onclick=()=>{sw=Math.max(0,Math.min(5,sw+ +x.dataset.wsw));paint()});
      b.querySelectorAll('[data-wp]').forEach(x=>x.onclick=()=>{const p=P.find(q=>q[0]===x.dataset.wp);rep=p[3];sw=p[4];paint()});
      const c=$('wvCustom');if(c)c.onclick=()=>{custom=true;paint()};b.querySelector('[data-close2]').onclick=closeSheet;
      $('wvOpenGo').onclick=()=>{WV.win={replace:rep,swaps:sw};BS.window='open';WV.stage='open';closeSheet();toast(`Window open · the couch got "${wvWinLine(rep,sw)} · due ${fmtT(wvDue())}"`);onOpen&&onOpen()}};wire()})}
// Backstage › Waivers: the window, who's claimed, run it; the settings and 3B from here
const bsWaiversW=bsWaivers;
bsWaivers=function(s){let h=bsWaiversW(s);
  if(BS.window==='open')h=h.replace(/<section class="blk"><div class="plate">[\s\S]*?<\/div><\/section>/,`<section class="blk"><div class="plate"><span class="tg cap">Window</span><span class="bd"><span class="t cap">Waiver window open</span><span class="d">${wvWinLine(WV.win.replace,WV.win.swaps)} · due ${fmtT(wvDue())}</span></span></div><div class="frow" style="margin-top:10px"><button class="btn out sm" id="wvChg">Change</button><button class="btn out sm" id="closeW">Turn off</button></div></section>`).replace('<button class="btn out" id="closeW">Close</button>','');
  if(BS.ran)h=h.replace(/(<h2 class="cap">Last run<\/h2><button class="link" id="undoRun">Undo<\/button><\/div>)[\s\S]*?<\/section>/,(m,hd)=>hd+(WV.run||[]).map(r=>{const t=wvSentence(r);return `<div class="srow"><img class="sface" src="${ph(S51C(r.add))}" alt=""><span>${t.b.replace(/^You /,'alex ')} <small class="muted">${t.s.replace('you got','alex got')}</small></span></div>`}).join('')+'</section>');
  return h.replace(/<section class="blk"><div class="sh"><h2 class="cap">How it works here<\/h2>[\s\S]*?<\/section>/,`<section class="blk"><button class="idx" id="wvSet"><span class="ic">${svg('gear')}</span><span class="tx"><b>Waivers settings</b><small>${WV.set.applied?WV.set.feel[0].toUpperCase()+WV.set.feel.slice(1):'Customized'} · ${WV_RULES.find(r=>r[0]===WV.set.rule)[1]} · ${WV.set.sched==='manual'?'you open windows':`every ${WV.set.every} episodes`}</small></span>${svg('chev')}</button>
    <button class="idx" id="wvPrevB"><span class="ic">${svg('quiz')}</span><span class="tx"><b>What players see</b><small>How waivers work, when moves happen</small></span>${svg('chev')}</button></section>`)};
const wireBSW=wireBS;
wireBS=function(sid,page){wireBSW(sid,page);if(page!=='waivers')return;const re=()=>backstageRoute(sid,'waivers');
  const ow=$('openW');if(ow)ow.onclick=()=>wvOpenSheet(re);const ch=$('wvChg');if(ch)ch.onclick=()=>wvOpenSheet(re);
  const st=$('wvSet');if(st)st.onclick=wvSettingsSheet;
  const rn=$('runNow');if(rn)rn.onclick=()=>{const res=wvCompute();previewSheet({title:'Run waivers now?',sub:'Claims are private until they run. This is what happens.',cta:'Run waivers',
    changes:res.map(r=>{const t=wvSentence(r);return [`<img class="pvi" src="${ph(S51C(r.add))}" alt="">`,t.b.replace(/^You /,'alex '),t.s.replace(/you got/,'alex got')]}),
    onConfirm:()=>{wvDoRun();logChange(`Ran waivers: ${res.length} moves`,2,wvUndo);toast(`Waivers ran · ${res.length} moves · the couch gets the reveal`);re()}})};
  const ur=$('undoRun');if(ur)ur.onclick=()=>{wvUndo();toast('Waiver run undone · claims are back');re()};const pv=$('wvPrevB');if(pv)pv.onclick=()=>rulesSheet('lineup');
  app.querySelectorAll('a.rolebtn[href$="/cast"]').forEach(a=>a.setAttribute('href',`#/show/${sid}/waivers`))};

// ---------- wiring the page ----------
function wireWaivers(s){
  app.querySelectorAll('[data-wvs]').forEach(b=>b.onclick=()=>({pick:()=>wvsPickSheet(b.dataset.d),swap:()=>wvsSwapSheet(),unswap:()=>{WV.swaps=[];route()},fa:wvFaSheet,runpage:wvRunPage,replay:wvReveal,how:()=>rulesSheet('lineup')})[b.dataset.wvs]());
  app.querySelectorAll('[data-grip]').forEach(b=>b.onclick=()=>{const [g,i]=b.dataset.grip.split('|'),k=+i,L=g==='swap'?WV.swaps:WV.claims[g],nm=g==='swap'?`${L[k].add} for ${L[k].drop}`:L[k];
    openSheet(nm,g==='swap'?`Swap · ${ordinal(k+1)} choice`:`Replacing ${g} · ${ordinal(k+1)} choice`,`${k>0?'<button class="row" data-mv="-1"><span class="tx"><b>Move up</b></span></button>':''}${k<L.length-1?'<button class="row" data-mv="1"><span class="tx"><b>Move down</b></span></button>':''}<button class="row" data-mv="x"><span class="tx"><b style="color:var(--live)">Remove</b></span></button>`,
      bb=>bb.querySelectorAll('[data-mv]').forEach(x=>x.onclick=()=>{const m=x.dataset.mv;if(m==='x')L.splice(k,1);else{const j=k+ +m;[L[k],L[j]]=[L[j],L[k]]}closeSheet();route()}))});
  tickCd()}

// ---------- the way in: route, Tonight, Episodes, the dock ----------
const showRouteW=showRoute;
showRoute=function(sid,tab){if(tab==='waivers'){const p=location.hash.split('/');return waiversRoute(sid,p[4],p[5])}return showRouteW(sid,tab)};
const tabTonightW=tabTonight;
tabTonight=function(s){if(s.id==='surv')wvSync();let h=tabTonightW(s);if(s.id!=='surv'||N===1)return h;
  if(WV.stage==='ran'&&!WV.seen)h=h.replace('<div class="phase">',`<section class="blk" style="margin-top:16px"><button class="plate" data-job="wvreveal"><span class="tg good cap">Waivers</span><span class="bd"><span class="t cap">Waivers ran</span><span class="d">See who got who · after Episode ${WV_EP}</span></span><span class="go">${svg('chev')}</span></button></section><div class="phase">`);
  if(SHOWSTATE.phase!=='before'||WV.stage==='quiet')return h;
  const out=wvOut(),me=wvMineRun().find(r=>r.kind==='replace');let t,d,st;
  if(WV.stage==='ran'){t=me?`You got ${me.add} for ${me.drop}`:'Waivers ran';d=`Free agency until ${fmtT(wvAirs())}`;st='Done'}
  else if(!out.length)return h;
  else if(WV.ver==='simple'){const a=wvClaim(out[0])[0];t=wvPicked(out[0])?`${a} takes ${out[0]}'s spot`:`${a}'s lined up for ${out[0]}`;d=`${wvPicked(out[0])?'Your pick':'Picked for you'} · change until ${fmtT(wvDue())}`;st='Set'}
  else{const L=WV.claims[out[0]]||[];t=`Replace ${out[0]}`;d=L.length?`Your claim: ${L.join(', then ')} · due ${fmtT(wvDue())}`:`Due ${fmtT(wvDue())} · ${wvLineTxt()}`;st=L.length?'In':'Open'}
  const ok=/Set|In|Done/.test(st),job=`<button class="job${ok?' done':''}" data-job="waivers"><span class="ic">${svg('swap')}</span><span class="tx"><span class="kind cap">Weekly Lineup · Waivers</span><b>${t}</b><small>${d}</small></span><span class="st">${st}</span>${svg('chev')}</button>`;
  const at=h.lastIndexOf('<button',h.indexOf('data-job="pool"'));if(at>0)h=h.slice(0,at)+job+h.slice(at);
  return h.replace(/(\d+) of (\d+) done/,(m,a,b)=>`${+a+(ok?1:0)} of ${+b+1} done`).replace('<div class="segbar">',`<div class="segbar"><i class="${ok?'on':''}"></i>`)};
const tabEpisodesW=tabEpisodes;
tabEpisodes=function(s){if(s.id==='surv')wvSync();let h=tabEpisodesW(s);if(s.id!=='surv'||N===1)return h;
  const me=wvMineRun().find(r=>r.kind==='replace'),done=WV.stage!=='open';
  const row=`<button class="eprow wv-ep${done?'':' open'}" data-wvep><span class="n wvn">${svg('swap')}</span>${done&&me?`<span class="faces"><img src="${ph(S51C(me.add))}" alt="" style="filter:none"></span>`:''}<span class="tx"><b>Waivers · after Episode ${WV_EP}</b><small>${done?(me?`You got ${me.add} for ${me.drop} · ${(WV.run||[]).length} moves`:`${(WV.run||[]).length} moves`):`Claims due ${fmtT(wvDue())} · replace ${wvOut().join(', ')}`}</small></span>${done?svg('chev'):'<span class="st">Open</span>'}</button>`;
  return h.replace(`<button class="eprow" data-ep="${WV_EP}">`,row+`<button class="eprow" data-ep="${WV_EP}">`)};
const wireShowW=wireShow;
wireShow=function(s){wireShowW(s);
  app.querySelectorAll('[data-job="waivers"]').forEach(b=>b.onclick=()=>location.hash=`#/show/${s.id}/waivers`);
  app.querySelectorAll('[data-job="wvreveal"]').forEach(b=>b.onclick=wvReveal);
  app.querySelectorAll('[data-wvep]').forEach(b=>b.onclick=()=>WV.stage==='open'?location.hash=`#/show/${s.id}/waivers`:wvRunPage())};

// ---------- mock scenarios (mockmenu.js) and ?wv= / ?wvsheet= for the comparison page ----------
function wvSet(o){WV.ver=o.ver||WV.ver;WV.shared=!!o.shared;WV.claims={};WV.swaps=[];WV.own=false;WV.run=null;WV.seen=false;WV.pick=null;
  MOVES.roster=['Kristin','Mike','Brady','Jenna','Eric'];MOVES.starters=new Set(['Kristin','Mike']);WV.stage='open';BS.window='open';BS.ran=false;
  if(o.filled){WV.claims.Jenna=['Sharonda','Devin'];WV.swaps=WV.ver==='v2'?[{add:'Cristian',drop:'Eric'},{add:'Linnea',drop:'Mike'}]:[{add:'Cristian',drop:'Eric'}]}
  if(o.stage==='ran'||o.stage==='quiet'){if(!o.filled)WV.claims.Jenna=['Sharonda','Devin'];wvDoRun();WV.seen=o.stage==='quiet'||!!o.seen;if(o.stage==='quiet')WV.stage='quiet'}
  if(o.stage==='commish'){SHOWSTATE.roles.alex='commish'}}
{const wv=WVQ.get('wv');if(wv)wvSet({filled:wv==='filled',shared:wv==='shared',stage:wv});
  const sc=+WVQ.get('wvscroll');if(sc)addEventListener('load',()=>setTimeout(()=>{$('scroller').scrollTop=sc},400));
  const sh=WVQ.get('wvsheet');if(sh)addEventListener('load',()=>setTimeout(()=>({pick:()=>WV.ver==='v2'?null:wvsPickSheet('Jenna'),swap:()=>wvsSwapSheet(),settings:wvSettingsSheet,open:()=>wvOpenSheet(),reveal:wvReveal,how:()=>rulesSheet('lineup')})[sh]?.(),500))}
