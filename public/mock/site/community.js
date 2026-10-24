// ================= community results, disputes, house rulings, and a hands-off admin =================
// Decided with the user 2026-10-23. Facts are shared (one answer per fact, whichever couch asks); points are
// local (each league's own rules). Anyone on a couch can paste the AI research; every paste, Autopilot run and
// wiki Quick check is a source:
//   Reported   one source (feeds stats, marked "1 source")
//   Confirmed  two independent sources agree
//   Disputed   sources or players disagree; a cheap tie-break run settles most; the rest reach the admin
//   Canonical  an admin decided, and it's locked
// Disputes: "Something wrong?" on every episode page and a flag on each episode in a castaway's story; never
// prominent, never hidden. Corrections flow into every league on their own (gated by reveal) with a visible
// line; a commissioner may keep the old result for their league as a HOUSE RULING, shown to their players and
// never leaking into shared stats. Admin = Inbox (what the community couldn't settle) · Find (override anything,
// with history and a lock) · Settings. Loads after the router script and before nav.js (it adds #/admin).
const WD={anyone:true,corr:false,ruling:false,flags:new Set(),filled:{4:'riley'},
  disputes:[{id:'d1',ep:3,who:'Brady',what:'idolFound',status:'open',yes:[['Autopilot run','7:02 AM','Brady found the Toka idol at camp'],['Couch Council paste · riley','8:15 AM','Brady found an idol under the shelter']],
    no:[['Tie-break run','Yesterday','Devin found the idol; Brady found a clue to it']],flags:[['jordan','It was Devin\'s idol, Brady only got the clue'],['dev','Clue, not an idol'],['priya','']],leagues:14,rulings:1}],
  reports:[{id:'r1',who:'jordan',t:'Can\'t see my couch after switching phones',k:'user',open:true},{id:'r2',who:'riley',t:'Pluribus shows the wrong photo for one actor',k:'cast',open:true}],
  stranded:{couch:'Wednesday Watchers',open:true}};
const FACT_LABEL={tribeImmunity:'Won immunity',individualImmunity:'Won individual immunity',rewardWin:'Won reward',idolFound:'Found an idol',idolPlayed:'Played an idol',votedWithMajority:'Voted with the majority',
  votedAgainstMajority:'Voted against the majority',zeroVotesSafe:'No votes against',survivedVotes:'Survived votes against',learnedOfAdvantage:'Learned of an advantage',wentOnJourney:'Went on a journey',satOut:'Sat out a challenge','Voted Out':'Voted out',Quit:'Quit'};
const factLabel=k=>FACT_LABEL[k]||k;
const epFacts=(e,n)=>S51.cast.filter(c=>!n||c.name.startsWith(n)).flatMap(c=>(c.why||[]).filter(x=>x[0]===e).map(x=>({who:first(c.name),c,what:x[1],pts:x[2]})));
const isCorrected=(e,n,k)=>WD.corr&&e===3&&n==='Brady'&&k==='idolFound';

// ---------- "Something wrong?": pick the person, the fact, then why ----------
function disputeSheet(e,who,what){
  if(!who){const people=[...new Set(epFacts(e).map(f=>f.who))];
    return openSheet(`Something wrong in Episode ${e}?`,'Who is it about? Your flag goes to a shared check; nothing changes until it\'s settled.',
      `<div class="cast4">${people.map(n=>`<button class="tile" data-dw="${n}"><img src="${ph(S51C(n))}" alt=""><div class="cap">${n}</div><small>${epFacts(e,n).length} result${epFacts(e,n).length>1?'s':''}</small></button>`).join('')}</div>
       <button class="row" data-dw="*" style="margin-top:8px"><span class="ic">${svg('quiz')}</span><span class="tx"><b>Something else</b><small>Missing from the results, or not about one person</small></span>${svg('chev')}</button>`,
      b=>b.querySelectorAll('[data-dw]').forEach(x=>x.onclick=()=>{closeSheet();setTimeout(()=>disputeSheet(e,x.dataset.dw),230)}))}
  if(!what){const F=who==='*'?[]:epFacts(e,who);
    return openSheet(who==='*'?`Episode ${e}`:`${who} · Episode ${e}`,'Which result is wrong?',
      `${F.map(f=>{const k=`${e}|${f.who}|${f.what}`,done=WD.flags.has(k);return `<button class="row dfact${done?' done':''}" data-df="${f.what}" ${done?'disabled':''}><span class="tx"><b>${factLabel(f.what)}${isCorrected(e,f.who,f.what)?' <span class="cfix cap">Corrected</span>':''}</b><small>${f.pts>0?'+':''}${f.pts} in Balanced scoring${done?' · you flagged this':''}</small></span>${done?svg('check'):svg('chev')}</button>`}).join('')}
       <button class="row" data-df="+"><span class="ic">${svg('plus')}</span><span class="tx"><b>Something's missing</b><small>It happened, but it isn't here</small></span>${svg('chev')}</button>`,
      b=>b.querySelectorAll('[data-df]').forEach(x=>x.onclick=()=>{closeSheet();setTimeout(()=>disputeSheet(e,who,x.dataset.df),230)}))}
  let why=what==='+'?'missing':null;
  const title=what==='+'?`Missing from Episode ${e}`:`${who} · ${factLabel(what)}`;
  openSheet(title,`Episode ${e} · flags from anyone who's seen it are compared with the research`,
    `${what==='+'?`<label class="aibox-l"><span class="cap">What happened?</span><textarea class="aibox" id="dNote" placeholder="e.g. Kristin found an idol clue at the well"></textarea></label>`
      :`<div class="chips" style="padding:0">${[['no','Didn\'t happen'],['who','Wrong person'],['ep','Wrong episode'],['other','Something else']].map(([k,l])=>`<button class="chip" data-dr="${k}">${l}</button>`).join('')}</div>
      <label class="aibox-l"><span class="cap">Anything to add? Optional</span><textarea class="aibox" id="dNote" placeholder="e.g. It was Devin's idol; Brady only found the clue"></textarea></label>`}
     <label class="aibox-l"><span class="cap">A link that shows it · optional</span><input class="dlink" id="dLink" placeholder="Paste a link"></label>
     <button class="btn pri wide" id="dSend" style="margin-top:12px" ${why?'':'disabled'}>Send</button>
     <p class="muted small" style="margin-top:8px;text-align:center">Your scores don't change until it's settled. You'll hear how it went.</p>`,
    b=>{b.querySelectorAll('[data-dr]').forEach(x=>x.onclick=()=>{why=x.dataset.dr;b.querySelectorAll('[data-dr]').forEach(y=>y.classList.toggle('on',y===x));$('dSend').disabled=false});
      $('dNote').oninput=ev=>{if(what==='+'){why=ev.target.value.trim()?'missing':null;$('dSend').disabled=!why}};
      $('dSend').onclick=()=>{WD.flags.add(`${e}|${who}|${what}`);closeSheet();toast(what==='idolFound'&&who==='Brady'?'Sent. 3 others flagged this too. You\'ll hear how it went.':'Sent. We\'ll check it against the research.')}})}

// ---------- the episode page: a correction line, a house ruling, "Something wrong?" ----------
const episodePageC=episodePage;
episodePage=function(e){episodePageC(e);const pg=$('page');
  if(WD.corr&&e===3)pg.querySelector('.blk').insertAdjacentHTML('beforebegin',`<section class="blk"><div class="corr"><span class="tg cap">Corrected</span><div><b>Brady's idol removed</b><small>2 sources and 3 flags agreed Devin found it; Brady found the clue. Weekly Lineup: you −4.</small>
    ${WD.ruling?`<p class="ruling">${svg('key')}<span><b>House ruling (alex)</b> Brady's idol still counts in your leagues. The shared results don't count it.</span></p>`:''}</div></div></section>`);
  const sp=[...pg.children].pop();sp.insertAdjacentHTML('beforebegin',`<section class="blk"><button class="wrongq" id="epWrong">${svg('quiz')}Something wrong in this episode?</button></section>`);
  $('epWrong').onclick=()=>disputeSheet(e);
  if(WD.corr&&!WD.ruling&&e===3)pg.querySelectorAll('.srow').forEach(r=>{if(r.textContent.includes('Brady')){const t=r.querySelector('.t');t.textContent='+'+(parseFloat(t.textContent)-4)}})};
// the Episodes list: a correction shows as its own line, like any other thing that happened
const tabEpisodesC=tabEpisodes;
tabEpisodes=function(s){let h=tabEpisodesC(s);if(s.id!=='surv'||!WD.corr)return h;
  return h.replace(/(<div class="sh"><h2 class="cap">Every episode<\/h2><span class="aside">[^<]*<\/span><\/div>)/,`$1<button class="eprow corrow" data-corr><span class="n wvn">${svg('repeat')}</span><span class="tx"><b>Episode 3 corrected${WD.ruling?' · house ruling':''}</b><small>${WD.ruling?'Brady\'s idol still counts here (alex\'s ruling)':'Brady\'s idol removed · you −4 in Weekly Lineup'}</small></span>${svg('chev')}</button>`)};
const wireShowC=wireShow;
wireShow=function(s){wireShowC(s);app.querySelectorAll('[data-corr]').forEach(b=>b.onclick=()=>episodePage(3))};

// ---------- the Cast tab's story: each episode can be flagged; a fresh episode is marked "1 source" ----------
const exProfileC=exProfile;
exProfile=function(s,name){exProfileC(s,name);if(s.id!=='surv')return;const n=first(name),w=seen(s);
  $('sheet').querySelectorAll('.ex-ep').forEach(r=>{const e=+r.querySelector('.n').textContent;if(!epFacts(e,n).length)return;
    if(e===w)r.querySelector('span:not(.n)').insertAdjacentHTML('beforeend',' <i class="src1">1 source</i>');
    if(isCorrected(e,n,'idolFound'))r.querySelector('span:not(.n)').insertAdjacentHTML('beforeend',' <i class="src1 fix">Corrected</i>');
    r.insertAdjacentHTML('beforeend',`<button class="exflag" data-ef="${e}" aria-label="Something wrong in Episode ${e}">${svg('dots')}</button>`)});
  $('sheet').querySelectorAll('[data-ef]').forEach(b=>b.onclick=()=>{closeSheet();setTimeout(()=>disputeSheet(+b.dataset.ef,n),230)})};

// ---------- Backstage › Results: who can paste, what's in, corrections and house rulings ----------
const bsResultsC=bsResults;
bsResults=function(s){const quick=bsResultsC(s).split('<section class="blk"><div class="sh"><h2 class="cap">Morning after')[0];
  const ep4=WD.filled[4],ep5=WD.filled[5];
  return quick+`<section class="blk"><div class="sh"><h2 class="cap">Full scores</h2><span class="aside">Settles Weekly Lineup</span></div>
    <button class="idx" id="whoFill"><span class="ic">${svg('people')}</span><span class="tx"><b>Who can fill them in</b><small>${WD.anyone?'Anyone on the couch · one paste covers every game':'Only you and riley (who run games)'}</small></span>${svg('chev')}</button>
    <div class="fillst"><span class="ok">${svg('check')}</span><span><b>Episode 4 · filled in by ${ep4}</b><small>Confirmed · 2 sources agree</small></span></div>
    ${ep5?`<div class="fillst"><span class="ok">${svg('check')}</span><span><b>Episode 5 · filled in by ${ep5}</b><small>Reported · 1 source so far</small></span></div>`
      :`<div class="fillst wait"><span class="ok">${svg('cal')}</span><span><b>Episode 5 · waiting</b><small>${WD.anyone?'Anyone on the couch can paste it':'Waiting on you or riley'}</small></span><button class="btn pri sm" id="askNow">${svg('bolt')}Ask an AI</button></div>`}
  </section>
  ${WD.corr?`<section class="blk"><div class="sh"><h2 class="cap">Corrections</h2><span class="aside">From the shared check</span></div>
    <div class="corr bs"><span class="tg cap">${WD.ruling?'Ruling':'Applied'}</span><div><b>Episode 3 · Brady's idol removed</b><small>2 sources and 3 flags agreed Devin found it. Weekly Lineup: alex −4, jordan −4.</small>
      ${WD.ruling?`<p class="ruling">${svg('key')}<span><b>House ruling</b> Brady's idol still counts in your leagues. Your players see this ruling on Episode 3.</span></p><button class="btn out sm" id="dropRuling">Drop the ruling</button>`
        :`<button class="btn out sm" id="keepOld">Keep our old result</button>`}</div></div></section>`:''}
  ${WD.flags.size||WD.corr?`<section class="blk"><div class="sh"><h2 class="cap">Flags from your couch</h2></div><div class="fillst"><span class="ok q">${svg('quiz')}</span><span><b>jordan flagged "Brady · Found an idol"</b><small>Sent to the shared check · ${WD.corr?'settled: removed for everyone':'3 others agree so far'}</small></span></div></section>`:''}
  <div style="height:40px"></div>`};
const wireBSC=wireBS;
wireBS=function(sid,page){wireBSC(sid,page);if(page!=='results')return;const re=()=>backstageRoute(sid,'results');
  const wf=$('whoFill');if(wf)wf.onclick=()=>openSheet('Who can fill in results?','One paste covers every game on Survivor 51',[[true,'Anyone on the couch','Whoever\'s up first pastes the AI\'s answer. Recommended'],[false,'Only people who run games','You and riley']].map(([v,t,d])=>`<button class="typecard${WD.anyone===v?' on':''}" data-any="${v}"><span><b>${t}</b><small>${d}</small></span></button>`).join(''),
    b=>b.querySelectorAll('[data-any]').forEach(x=>x.onclick=()=>{WD.anyone=x.dataset.any==='true';closeSheet();re()}));
  const ko=$('keepOld');if(ko)ko.onclick=()=>previewSheet({title:'Keep your old result?',sub:'A house ruling: your leagues only. Shared stats stay correct.',cta:'Keep it as a house ruling',
    changes:[[`<img class="pvi" src="${ph(S51C('Brady'))}" alt="">`,'Brady · Found an idol · Episode 3','Counts here'],[av('alex',26),'alex · Weekly Lineup','▲ +4 back'],[av('jordan',26),'jordan · Weekly Lineup','▲ +4 back'],[svg('eye'),'Your players','See the ruling on Episode 3']],
    undoNote:'Drop the ruling any time and the correction applies.',onConfirm:()=>{WD.ruling=true;logChange('House ruling: Brady\'s Episode 3 idol still counts',2,()=>{WD.ruling=false});toast('House ruling saved · your players can see it');re()}});
  const dr=$('dropRuling');if(dr)dr.onclick=()=>{WD.ruling=false;toast('Ruling dropped · the correction applies');re()}};

// ---------- players: a quiet "Fill it in" while full scores wait (when anyone can) ----------
const afterBlockC=afterBlock;
afterBlock=function(s){let h=afterBlockC(s);if(s.id!=='surv'||!WD.anyone||isCommish()||WD.filled[5]||typeof finalIn!=='function'||finalIn())return h;
  if(SHOWSTATE.res==='early'||revealed5())h+=`<section class="blk"><button class="fillq" id="fillQ"><span><b>Full scores need one paste</b><small>Anyone on the couch can do it · about 2 minutes</small></span><span class="go">Fill it in</span></button></section>`;
  return h};
const wireShowC2=wireShow;
wireShow=function(s){wireShowC2(s);const f=$('fillQ');if(f)f.onclick=()=>askAI({title:'Fill in Episode 5',what:'Your AI searches the web for everything that happened in Survivor 51 Episode 5, then answers in a format we can read. Paste it back and every game on the couch scores.',brief:'gameyourshow.com/b/K7Q2-ep5',
  onDone:()=>{WD.filled[5]='alex';SHOWSTATE.res='final';toast('Thanks! Every game on the couch is scored');route()}})};

// ---------- admin: Inbox · Find · Settings ----------
const ADM={tab:'inbox',q:''};
function adminHead(title,back){return `<header class="adm-top"><a class="back" href="${back||'#/hub'}">${svg('chev')}${back?'Admin':'Home'}</a><b class="cap">${title}</b><span class="adm-badge cap">Admin</span></header>`}
const admOpen=()=>WD.disputes.filter(d=>d.status==='open').length+WD.reports.filter(r=>r.open).length+(WD.stranded.open?1:0);
function adminRoute(p){if(p[1]==='fact')return adminFact(p[2]);if(p[1]==='e')return adminEntity(p[2]);
  ADM.tab=p[1]||ADM.tab;const T=[['inbox','Inbox',admOpen()],['find','Find'],['settings','Settings']];
  app.innerHTML=`<div class="adm">${adminHead('Admin')}<nav class="adm-tabs">${T.map(([k,l,n])=>`<a href="#/admin/${k}" class="${ADM.tab===k?'on':''}">${l}${n?`<i>${n}</i>`:''}</a>`).join('')}</nav>
    <div class="adm-body">${({inbox:admInbox,find:admFind,settings:admSettings})[ADM.tab]()}</div></div>`;wireAdmin();$('scroller').scrollTop=0}
function admInbox(){const d=WD.disputes.filter(x=>x.status==='open'),r=WD.reports.filter(x=>x.open);
  const items=[...d.map(x=>`<a class="adm-item" href="#/admin/fact/${x.id}"><span class="tg live cap">Disputed</span><span class="tx"><b>${x.who} · ${factLabel(x.what)}</b><small>Survivor 51 · Episode ${x.ep} · ${x.yes.length} sources yes, ${x.no.length} no + ${x.flags.length} flags · tie-break split</small></span>${svg('chev')}</a>`),
    ...r.map(x=>`<a class="adm-item" href="#/admin/e/${x.k==='user'?'jordan':'pluribus-cast'}"><span class="tg cap q">Report</span><span class="tx"><b>${x.t}</b><small>From ${x.who} · ${x.k==='user'?'account help':'cast photo'}</small></span>${svg('chev')}</a>`),
    ...(WD.stranded.open?[`<a class="adm-item" href="#/admin/e/wednesday"><span class="tg cap q">Couch</span><span class="tx"><b>${WD.stranded.couch} has no one running it</b><small>Its only commissioner deleted their account · 5 players</small></span>${svg('chev')}</a>`]:[])];
  return `<section class="blk"><div class="sh"><h2 class="cap">Needs you</h2><span class="aside">${items.length||'Nothing'}</span></div>
    ${items.length?items.join(''):`<div class="adm-empty">${svg('check')}<b class="cap">Nothing needs you</b><small>The couches are handling it.</small></div>`}</section>
  <section class="blk"><div class="sh"><h2 class="cap">This week, on its own</h2></div>
    <div class="adm-week">${[['41','episodes researched by couches'],['38','confirmed by 2+ sources'],['6','disputes settled without you'],['2','house rulings kept']].map(([n,l])=>`<div><b class="num">${n}</b><small>${l}</small></div>`).join('')}</div>
    <p class="muted small" style="margin-top:10px;line-height:1.5">Facts settle when two sources agree. A dispute reaches you only if a tie-break run can't settle it.</p></section>`}
const ADM_IDX=[['fact','Brady · Found an idol','Survivor 51 · Episode 3 · Disputed','#/admin/fact/d1'],['e',S51C('Brady').name,'Survivor 51 castaway · 24 facts','#/admin/e/brady'],['e','Survivor 51 · Episode 5','Aired Wed · Reported (1 source)','#/admin/e/s51e5'],
  ['e','Survivor','Show · 3 seasons followed · Format: Survivor','#/admin/e/survivor'],['e','Couch Council','Couch · 4 members · 3 games','#/admin/e/council'],['e','jordan','User · 2 couches','#/admin/e/jordan'],['e','Wednesday Watchers','Couch · 5 members · no commissioner','#/admin/e/wednesday'],['e','Pluribus · cast','Season 1 · 9 people · 1 report','#/admin/e/pluribus-cast']];
function admFindList(){const q=ADM.q.toLowerCase(),R=ADM_IDX.filter(x=>!q||(x[1]+' '+x[2]).toLowerCase().includes(q));
  return R.map(x=>`<a class="idx" href="${x[3]}"><span class="ic">${svg(x[0]==='fact'?'quiz':/couch/i.test(x[2])?'people':/user/i.test(x[2])?'key':'tv')}</span><span class="tx"><b>${x[1]}</b><small>${x[2]}</small></span>${svg('chev')}</a>`).join('')||'<p class="muted small" style="margin-top:12px">Nothing matches.</p>'}
function admFind(){
  return `<section class="blk"><label class="search">${svg('search')}<input id="admQ" placeholder="A show, episode, castaway, couch or person" value="${ADM.q}" aria-label="Find anything"></label>
    <p class="muted small" style="margin:8px 0 4px">Everything can be changed from its page. Changes show their reach before you save, and every one is in its history.</p>
    <div id="admR">${admFindList()}</div></section>`}
function admSettings(){return `<section class="blk"><div class="sh"><h2 class="cap">Research</h2></div>
    ${[['AI for research','The research prompt, with web search · about $0.30 an episode'],['Research prompts','One per format · Survivor, The Traitors, Big Brother +6'],['Quick check','Wiki, "who went home" only · free'],['Confirmed needs','2 sources that agree'],['Tie-break run','On · when a fact is disputed for a day · about $0.30']].map(([t,d])=>`<button class="idx" data-adset><span class="tx"><b>${t}</b><small>${d}</small></span>${svg('chev')}</button>`).join('')}</section>
  <section class="blk"><div class="sh"><h2 class="cap">Couches</h2></div>
    ${[['Who fills in results, for new couches','Anyone on the couch'],['Autopilot trial','First 2 episodes of a couch\'s first season'],['What\'s New','3 drafts · you approve each']].map(([t,d])=>`<button class="idx" data-adset><span class="tx"><b>${t}</b><small>${d}</small></span>${svg('chev')}</button>`).join('')}</section><div style="height:40px"></div>`}
// a disputed fact: both sides, then a decision that becomes canonical
function adminFact(id){const d=WD.disputes.find(x=>x.id===id)||WD.disputes[0],c=S51C(d.who),open=d.status==='open';
  app.innerHTML=`<div class="adm">${adminHead('Disputed fact','#/admin/inbox')}<div class="adm-body">
    <section class="blk"><div class="plate outp"><img src="${ph(c)}" alt=""><span class="tg cap ${open?'live':'good'}">${open?'Disputed':'Canonical'}</span><span class="bd"><span class="t cap">${d.who} · ${factLabel(d.what)}</span><span class="d">Survivor 51 · Episode ${d.ep} · +4 in Balanced scoring</span></span></div>
      ${open?'':`<p class="adm-done">${svg('check')}You decided: <b>${d.verdict==='yes'?'it happened':'it didn\'t happen'}</b>. Locked. ${d.leagues} leagues updated after each one reveals Episode ${d.ep}; ${d.flags.length} people who flagged it were told.</p>`}</section>
    <section class="blk"><div class="sh"><h2 class="cap">Says it happened</h2><span class="aside">${d.yes.length}</span></div>${d.yes.map(([s,t,q])=>`<div class="adm-src yes"><span class="ic">${svg('check')}</span><span class="tx"><b>${s}</b><small>${t} · "${q}"</small></span><a class="link" href="#" onclick="return false">Sources</a></div>`).join('')}</section>
    <section class="blk"><div class="sh"><h2 class="cap">Says it didn't</h2><span class="aside">${d.no.length+d.flags.length}</span></div>${d.no.map(([s,t,q])=>`<div class="adm-src no"><span class="ic">${svg('x')}</span><span class="tx"><b>${s}</b><small>${t} · "${q}"</small></span><a class="link" href="#" onclick="return false">Sources</a></div>`).join('')}
      ${d.flags.map(([n,q])=>`<div class="adm-src no">${av(n,30)}<span class="tx"><b>${n} flagged it</b><small>${q?`"${q}"`:'Didn\'t happen · no note'}</small></span></div>`).join('')}</section>
    <section class="blk"><div class="sh"><h2 class="cap">Where it counts</h2></div><p class="muted small" style="line-height:1.5">Applied in ${d.leagues} leagues on Survivor 51 · ${d.rulings} house ruling keeps it whatever you decide · shared stats follow your decision.</p></section>
    ${open?`<section class="blk"><div class="frow"><button class="btn out" data-verdict="yes">It happened</button><button class="btn pri" data-verdict="no">It didn't happen</button></div>
      <button class="wv-prev" id="admEditF">Something else: edit the fact</button></section>`:`<section class="blk"><button class="btn out wide" id="admReopen">Unlock and reopen</button></section>`}
    <section class="blk"><div class="sh"><h2 class="cap">History</h2></div>${['Autopilot run reported it · Tue 7:02 AM','riley\'s couch pasted it · Tue 8:15 AM · Confirmed','jordan flagged it · Tue 9:40 PM · Disputed','Tie-break run disagreed · Wed 9:05 AM · sent to you'].concat(open?[]:[`You decided · just now · Canonical, locked`]).map(t=>`<div class="adm-h">${t}</div>`).join('')}</section><div style="height:40px"></div></div></div>`;
  app.querySelectorAll('[data-verdict]').forEach(b=>b.onclick=()=>{const v=b.dataset.verdict;previewSheet({title:v==='no'?'Remove it for everyone?':'Keep it for everyone?',sub:'Becomes canonical and locked. Couches with a house ruling keep theirs.',cta:v==='no'?'Remove it':'Keep it',
    changes:[[`<img class="pvi" src="${ph(c)}" alt="">`,`${d.who} · ${factLabel(d.what)} · Ep ${d.ep}`,v==='no'?'Removed':'Stays'],[svg('people'),`${d.leagues} leagues`,v==='no'?'Corrected after each reveals Episode 3':'No change'],[svg('bell'),`${d.flags.length} people who flagged it`,'Told how it went']],
    undoNote:'Unlock and reopen any time from this page.',onConfirm:()=>{d.status='done';d.verdict=v;if(v==='no')WD.corr=true;toast(v==='no'?'Removed for everyone · canonical':'Kept · canonical');adminFact(d.id)}})});
  const ed=$('admEditF');if(ed)ed.onclick=()=>admOverride(`${d.who} · Episode ${d.ep}`,[['Who','Brady'],['What','Found an idol'],['Episode','3']]);
  const ro=$('admReopen');if(ro)ro.onclick=()=>{d.status='open';d.verdict=null;WD.corr=false;toast('Reopened · unlocked');adminFact(d.id)}}
// any other thing: its data with Override, a Lock and its history
const ADM_E={brady:{t:S51C('Brady').name,k:'Castaway · Survivor 51',img:()=>ph(S51C('Brady')),f:[['Name',S51C('Brady').name],['Tribe','Toka'],['Photo','From the season cast']],reach:'Every couch on Survivor 51 · 14 leagues',h:['Cast pasted by riley\'s couch · Sep 18','Photo added from the wiki · Sep 18','Tribe confirmed by 3 couches']},
  s51e5:{t:'Survivor 51 · Episode 5',k:'Episode · aired Wed 8:05 PM',f:[['Title','"Blindside City"'],['Aired','Wed 8:05 PM (from TV listings)'],['Results','Reported · 1 source (alex\'s paste)']],reach:'14 leagues · 212 players, after each reveals Episode 5',h:['From TV listings · Aug 30','Quick check: Thien voted out · 8:41 PM','alex\'s couch pasted results · just now']},
  survivor:{t:'Survivor',k:'Show · CBS · Wed 8:05 PM',f:[['Name','Survivor'],['Schedule','From TV listings · Wed 8:05 PM'],['Format','Survivor (built in)'],['Research prompt','Survivor v3']],reach:'Every couch following Survivor',h:['From TV listings','Format set · built in']},
  council:{t:'Couch Council',k:'Couch · 4 members',f:[['Members','alex, riley, jordan, sam'],['Runs games','alex (commissioner), riley (game admin)'],['Who fills in results','Anyone on the couch'],['House rulings','1 · Brady\'s Ep 3 idol']],reach:'This couch only',h:['Started by alex · Survivor 49','riley made game admin · Sep 2']},
  jordan:{t:'jordan',k:'User · 2 couches',f:[['Email','jordan@example.com'],['Couches','Couch Council, Wednesday Watchers'],['Sign-in','Email and password']],reach:'This person only',h:['Joined · Survivor 49','Reported: can\'t see their couch after switching phones'],acts:[['Send a sign-in link',''],['Merge with another account',''],['Remove from the app','danger']]},
  wednesday:{t:'Wednesday Watchers',k:'Couch · 5 members · no commissioner',f:[['Members','dev, priya, luis, kat, ben'],['Runs games','Nobody'],['Games','Survivor 51: Survival Pool']],reach:'This couch only',h:['Its commissioner deleted their account · Mon'],acts:[['Hand it to priya (most active)',''],['Ask the couch who wants it','']]},
  'pluribus-cast':{t:'Pluribus · cast',k:'Season 1 · 9 people',f:[['People',"9 · from the cast sam's couch pasted"],['Photos','8 from the paste · 1 reported wrong'],['Reported photo','The 4th person in the cast list']],reach:'Every couch following Pluribus',h:['Cast pasted by sam\'s couch · Nov 7','riley reported a wrong photo · today']}};
function adminEntity(id){const E=ADM_E[id];if(!E)return adminRoute(['admin','find']);
  app.innerHTML=`<div class="adm">${adminHead(E.k.split(' · ')[0],'#/admin/find')}<div class="adm-body">
    <section class="blk"><div class="adm-eh">${E.img?`<img src="${E.img()}" alt="">`:`<span class="ph">${svg(/Couch/.test(E.k)?'people':/User/.test(E.k)?'key':'tv')}</span>`}<div><b class="cap">${E.t}</b><small>${E.k}</small></div></div></section>
    <section class="blk">${E.f.map(([k,v],i)=>`<button class="idx" data-ov="${i}"><span class="tx"><small>${k}</small><b>${v}</b></span><span class="adm-edit">Override</span></button>`).join('')}</section>
    ${E.acts?`<section class="blk">${E.acts.map(([t,k],i)=>`<button class="btn ${k==='danger'?'out adm-danger':'out'} wide" data-act="${i}" style="margin-bottom:8px">${t}</button>`).join('')}</section>`:''}
    <section class="blk"><button class="wv-val tog" id="admLock"><span><b>Lock</b><small>${E.locked?'Locked: couches can\'t change it, flags still reach you':'Couches can correct it; flags go to the shared check'}</small></span><span class="wv-sw${E.locked?' on':''}"><i></i></span></button></section>
    <section class="blk"><div class="sh"><h2 class="cap">History</h2></div>${E.h.map(t=>`<div class="adm-h">${t}</div>`).join('')}</section><div style="height:40px"></div></div></div>`;
  app.querySelectorAll('[data-ov]').forEach(b=>b.onclick=()=>admOverride(E.t,[E.f[+b.dataset.ov]],E.reach,()=>{E.h.push('You overrode it · just now');adminEntity(id)}));
  $('admLock').onclick=()=>{E.locked=!E.locked;toast(E.locked?'Locked':'Unlocked');adminEntity(id)};
  app.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>{const a=E.acts[+b.dataset.act][0];if(id==='wednesday')WD.stranded.open=false;if(id==='jordan')WD.reports[0].open=false;E.h.push(`${a} · just now`);toast(`Done: ${a}`);adminEntity(id)})}
function admOverride(title,fields,reach,done){openSheet(`Override · ${title}`,reach?`Reaches: ${reach}`:'Becomes canonical and locked',
  `${fields.map(([k,v],i)=>`<label class="aibox-l"><span class="cap">${k}</span><input class="dlink" data-of="${i}" value="${String(v).replace(/"/g,'&quot;')}"></label>`).join('')}
   <p class="muted small" style="margin-top:8px">Saved as an admin override: it wins over couch edits and research, and it's in the history with undo.</p>
   <button class="btn pri wide" id="ovSave" style="margin-top:12px">Save override</button>`,b=>$('ovSave').onclick=()=>{closeSheet();toast('Overridden · in the history with undo');done&&done()})}
function wireAdmin(){const q=$('admQ');if(q)q.oninput=e=>{ADM.q=e.target.value;$('admR').innerHTML=admFindList()};
  app.querySelectorAll('[data-adset]').forEach(b=>b.onclick=()=>toast('Mock: each opens a small edit sheet'))}

// the admin's way in: the profile menu (admins only)
const profileSheetC=profileSheet;
profileSheet=function(){profileSheetC();const set=$('sheet').querySelector('a.btn[href="#/account"]');if(!set)return;
  set.insertAdjacentHTML('beforebegin',`<a class="row" href="#/admin/inbox" id="admRow"><span class="ic" style="background:var(--bone);color:var(--ink)">${svg('key')}</span><span class="tx"><b>Admin</b><small>${admOpen()?`${admOpen()} need${admOpen()===1?'s':''} you`:'Nothing needs you'}</small></span>${svg('chev')}</a>`);
  $('admRow').onclick=closeSheet};

// the router learns #/admin (this file loads after the router script, before nav.js)
removeEventListener('hashchange',route);
const routeC=route;
route=function(){const p=location.hash.replace(/^#\/?/,'').split('/');if(p[0]==='admin'){closeSheet();closePage();if(UI.wa)closeWatch();return adminRoute(p)}routeC()};
addEventListener('hashchange',route);
// mock scenarios (mockmenu.js) set these
function wdSet(o){WD.corr=!!o.corr;WD.ruling=!!o.ruling;WD.flags=new Set();WD.disputes[0].status='open';WD.disputes[0].verdict=null;WD.reports.forEach(r=>r.open=true);WD.stranded.open=true;delete WD.filled[5];ADM.q=''}
{const q=new URLSearchParams(location.search).get('wd');if(q){wdSet({corr:/corr|ruling/.test(q),ruling:q==='ruling'});if(q==='flag'||q==='flagbrady')addEventListener('load',()=>setTimeout(()=>{episodePage(3);setTimeout(()=>q==='flagbrady'?disputeSheet(3,'Brady','idolFound'):disputeSheet(3),300)},500))}}
// the router's first render ran before this file's wrappers existed: render once more with them
route();
