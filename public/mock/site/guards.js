// ================= guards and undo, by blast radius =================
// Tier 0: just you, fixable until airtime → no guard. Tier 1: affects others, reversible → instant +
// Undo toast + logged. Tier 2: moves standings/history → preview what changes, confirm, undo until the
// next episode airs. Tier 3: hard to undo → consequence sentence + hold to confirm (archive offered
// first; deletes restorable for 30 days). Impossible mistakes are simply prevented.
const LOG=[{who:'riley',what:'Ran waivers: 3 players got someone',when:'Tue 8:05 PM',tier:2,undo:false},{who:'alex',what:'Applied Episode 3 results to 3 games',when:'Fri 9:12 AM',tier:2,undo:false}];
function logChange(what,tier,undo){LOG.unshift({who:'alex',what,when:'Just now',tier,undo})}
// ---------- the undo toast ----------
toast=function(t,undo){const el=$('toast');$('toastT').innerHTML=t+(undo?` <button class="undo" id="tundo">Undo</button>`:'');el.classList.add('on');clearTimeout(UI.tt);UI.tt=setTimeout(()=>el.classList.remove('on'),undo?6000:2400);
  if(undo)$('tundo').onclick=()=>{undo();el.classList.remove('on');setTimeout(()=>toast('Undone'),250)}};
undoToast=function(msg,undo){logChange(msg.replace(/^Saved: /,'Changed '),1,undo);toast(msg,()=>{undo();route()})};

// ---------- tier 2: preview, then confirm ----------
function previewSheet({title,sub,changes,cta,onConfirm,undoNote}){
  openSheet(title,sub,`<div class="pv">${changes.map(([a,b,c])=>`<div class="pvr">${a}<span class="pvc">${b}</span>${c?`<span class="pvd ${c.startsWith('▲')?'up':c.startsWith('▼')?'dn':''}">${c}</span>`:''}</div>`).join('')}</div>
    <p class="muted small pvnote">${svg('repeat')}${undoNote||'You can undo this from Recent changes until Episode 6 airs.'}</p>
    <button class="btn pri wide" id="pvgo" style="margin-top:12px">${cta}</button><button class="btn out wide" id="pvno" style="margin-top:8px">Not yet</button>`,
    b=>{$('pvgo').onclick=()=>{closeSheet();onConfirm()};$('pvno').onclick=closeSheet})}
// ---------- tier 3: hold to confirm ----------
function holdSheet({title,consequence,alt,cta,onConfirm}){
  openSheet(title,'This one is hard to undo',`<p class="cons">${consequence}</p>${alt?`<button class="btn out wide" id="hAlt" style="margin:12px 0 4px">${alt[0]}</button><p class="muted small" style="text-align:center;margin-bottom:12px">${alt[1]}</p>`:''}
    <button class="hold" id="hold"><span class="fill"></span><span class="lbl">Hold to ${cta}</span></button><p class="muted small" style="text-align:center;margin-top:8px">Restorable for 30 days from Recent changes</p>`,
    b=>{const h=$('hold');let t=null;const start=()=>{h.classList.add('holding');t=setTimeout(()=>{closeSheet();onConfirm()},1400)};const stop=()=>{h.classList.remove('holding');clearTimeout(t)};
      h.addEventListener('pointerdown',start);['pointerup','pointerleave','pointercancel'].forEach(e=>h.addEventListener(e,stop));if($('hAlt'))$('hAlt').onclick=()=>{closeSheet();alt[2]()}})}

// ---------- Recent changes (visible to the whole couch) ----------
function bsHistory(s){return `<section class="blk"><p class="explain">Everyone on the couch can see this list. Recent changes can be undone until the next episode airs.</p>
  ${LOG.map((x,i)=>`<div class="hrow">${av(x.who,30)}<span class="tx"><b>${x.what}</b><small>${x.who} · ${x.when}${x.tier>=2?' · moved standings':''}</small></span>${x.undo?`<button class="rolebtn" data-hu="${i}">Undo</button>`:x.undone?'<span class="muted small">Undone</span>':''}</div>`).join('')}</section><div style="height:40px"></div>`}

// ---------- wire tiers into Backstage ----------
const _bsR=backstageRoute;
backstageRoute=function(sid,page){
  if(page==='history'){const s=SHOWS.find(x=>x.id===sid);app.innerHTML=`<div class="show"><header class="sbar"><img src="${ART(s.art)}" alt="" style="object-position:${s.hpos||s.pos}"><div class="sbar-top"><a class="back" href="#/show/${sid}/backstage">${svg('chev')}Backstage</a><span class="sbar-st">${svg('eye')}Visible to the couch</span><span style="width:44px"></span></div><b class="cap sbar-name">Recent changes</b></header><div class="show-body">${bsHistory(s)}</div></div>`;
    app.querySelectorAll('[data-hu]').forEach(b=>b.onclick=()=>{const x=LOG[+b.dataset.hu];x.undo&&x.undo();x.undo=false;x.undone=true;toast(`Undone: ${x.what}`);backstageRoute(sid,'history')});$('scroller').scrollTop=0;return}
  _bsR(sid,page);
  if(!page){// add Recent changes to the index
    const idx=app.querySelectorAll('.idx');const last=idx[idx.length-1];if(last)last.insertAdjacentHTML('afterend',`<a class="idx" href="#/show/${sid}/backstage/history"><span class="ic">${svg('repeat')}</span><span class="tx"><b>Recent changes</b><small>${LOG[0].who} · ${LOG[0].what}</small></span>${svg('chev')}</a>`)}
  // tier 2: applying results previews the standings move
  const ap=$('applyAll');if(ap)ap.onclick=()=>previewSheet({title:'Apply Episode 4?',sub:'Here\'s what changes for the couch',cta:ap.textContent,
    changes:[[av('riley',26),'riley · Weekly Lineup','▲ 1st, +15'],[av('alex',26),'alex · Weekly Lineup','▼ 2nd, +6'],[`<img class="pvi" src="${ph(S51C('Jenna'))}" alt="">`,'Jenna out · Outlast','alex and jordan lose her'],[svg('shield'),'Survival Pool','Everyone who picked Jenna: streak ends']],
    onConfirm:()=>{SHOWSTATE.resultsDone=true;logChange('Applied Episode 4 results to 3 games',2,()=>{SHOWSTATE.resultsDone=false});confetti();toast('Applied to all 3 games');backstageRoute(sid,'results')}});
  // tier 2: running waivers previews who gets whom
  const rn=$('runNow');if(rn)rn.onclick=()=>previewSheet({title:'Run waivers now?',sub:'Claims are private until they run. Here\'s the result.',cta:'Run waivers',
    changes:[[`<img class="pvi" src="${ph(S51C('Maggie'))}" alt="">`,'riley gets Maggie','for Thien'],[`<img class="pvi" src="${ph(S51C('Devin'))}" alt="">`,'jordan gets Devin','for Rob'],[`<img class="pvi" src="${ph(S51C('Linnea'))}" alt="">`,'sam gets Linnea','2nd choice'],[av('alex',26),'alex','No claim in · keeps their team']],
    onConfirm:()=>{BS.ran=true;BS.window='closed';logChange('Ran waivers: 3 players got someone',2,()=>{BS.ran=false;BS.window='open'});confetti();toast('Waivers ran · 3 players got someone');backstageRoute(sid,'waivers')}});
  // tier 2: rescoring the season previews the move; "from Episode 6" just saves with undo
  const sr=$('saveRules');if(sr)sr.onclick=()=>{if(BS.applyFrom!=='all'){const prev=BS.rules;BS.rulesChanged=false;logChange('Changed scoring rules (from Episode 6)',1,()=>{BS.rules=prev});toast('Saved · new rules from Episode 6',()=>{BS.rules=prev;BS.rulesChanged=true;backstageRoute(sid,'rules')});backstageRoute(sid,'rules');return}
    previewSheet({title:'Rescore the season?',sub:'Every episode recounted with the new rules',cta:'Rescore the season',changes:[[av('alex',26),'alex','▲ 1st, 22 → 25'],[av('riley',26),'riley','▼ 2nd, 38 → 24'],[av('jordan',26),'jordan','18 → 19'],[svg('chatb'),'The couch','Gets a heads-up in chat']],
      onConfirm:()=>{BS.rulesChanged=false;logChange('Rescored the season with new rules',2,()=>{});toast('Season rescored · the couch got a heads-up');backstageRoute(sid,'rules')}})};
  // tier 3: delete a game / remove a member
  app.querySelectorAll('[data-end]').forEach(b=>b.onclick=()=>b.dataset.end==='archive'?(logChange('Archived Survival Pool',1,()=>{}),toast('Survival Pool archived · still on the trophy shelf',()=>{})):holdSheet({title:'Delete Survival Pool?',consequence:'Everyone loses their streaks and picks for this season. The other two games are untouched.',alt:['Archive it instead','Keeps everything on the trophy shelf; just stops scoring.',()=>toast('Survival Pool archived',()=>{})],cta:'delete',onConfirm:()=>{logChange('Deleted Survival Pool (restorable for 30 days)',3,()=>{});toast('Deleted · restore it from Recent changes for 30 days')}}))};

// ---------- roles: guard the last commissioner, remove with hold ----------
memberSheet=function(n,sid){const cur=SHOWSTATE.roles[n]||'player',commishes=Object.values(SHOWSTATE.roles).filter(r=>r==='commish').length;
  openSheet(n,'Survivor 51 · Couch Cup',[['commish','Commissioner','Results, waivers, rules and roles'],['admin','Game admin','Results and waivers, can pick for people'],['player','Player','Plays; sees nothing backstage']].map(([k,t,d])=>{const blocked=n==='alex'&&cur==='commish'&&k!=='commish'&&commishes<2;return `<button class="typecard${cur===k?' on':''}${blocked?' dim':''}" data-k="${k}" ${blocked?'data-blocked':''}><span><b>${t}</b><small>${blocked?'Make someone else Commissioner first, so the game always has one':d}</small></span></button>`}).join('')
    +(n!=='alex'?`<button class="row" data-rm style="margin-top:8px"><span class="tx"><b style="color:var(--live)">Remove from this show's games</b><small>They stay on the couch and keep their history</small></span></button>`:''),
    b=>{b.querySelectorAll('[data-k]').forEach(x=>x.onclick=()=>{if(x.dataset.blocked)return toast('Every game needs a Commissioner. Hand it to someone first.');const k=x.dataset.k;if(k===cur)return;const prev=SHOWSTATE.roles[n];if(k==='player')delete SHOWSTATE.roles[n];else SHOWSTATE.roles[n]=k;closeSheet();
      undoToast(`${n} is now ${k==='commish'?'a Commissioner':k==='admin'?'a Game admin':'a Player'}`,()=>{if(prev)SHOWSTATE.roles[n]=prev;else delete SHOWSTATE.roles[n]});backstageRoute(sid,'members')});
      const rm=b.querySelector('[data-rm]');if(rm)rm.onclick=()=>{closeSheet();setTimeout(()=>holdSheet({title:`Remove ${n}?`,consequence:`${n} leaves Outlast, Weekly Lineup and Survival Pool on Survivor 51. Their teams go back to free agents. They stay on the couch and keep their past results.`,cta:`remove ${n}`,onConfirm:()=>{logChange(`Removed ${n} from Survivor 51's games`,3,()=>{});toast(`${n} removed · restorable for 30 days`)}}),250)}})};

// ---------- the draft: pick-for and undo get the same treatment ----------
const _drPick=drPick;
drPick=function(w,c,by){_drPick(w,c,by);if(by){logChange(`Drafted ${c} for ${w}`,1,()=>{});toast(`${c} drafted for ${w}`,()=>{DR.picks.pop();draftRoute(DR.sid)})}};
