// ================= share at the peak, and what the couch sees (decided 2026-10-24) =================
// Share: the reveal's last beat ("Your night +22") gets an optional Share. Post it to the couch chat, or make a card
// for outside the couch. The card leaves out who went home by default, so sharing never spoils a friend.
// Privacy: one setting in Account, three presets (Everything · Just my games · Only what games need) with Customize
// behind them, and a live preview of what riley sees about you. Per-show "Watch privately" stays where it is.
const PRIV={preset:'all',where:true,now:true,ratings:true,reactions:true};
const PRIV_PRESETS={all:{where:true,now:true,ratings:true,reactions:true},games:{where:false,now:false,ratings:true,reactions:true},min:{where:false,now:false,ratings:false,reactions:false}};
// ---------- share ----------
function shareCard(withOut){return `<div class="sh-card"><img src="${ART('survivor')}" alt="" style="object-position:64% 50%"><span class="sh-mark cap">Game <i>Your</i> Show</span>
  <div class="sh-plate"><span class="tg cap">Couch Council</span><b class="cap">Up to 1st</b><small>+${EP5.lineup.alex} in Weekly Lineup · Survivor 51, Episode 5</small>${withOut?`<small class="sh-out">Thien An Nguyen voted out</small>`:''}</div></div>`}
function shareSheet(){let withOut=false;
  const body=()=>`${shareCard(withOut)}
    <button class="wv-val tog" id="shOut"><span><b>Say who went home</b><small>${withOut?'On: anyone who sees it is spoiled':'Off, so you don\'t spoil anyone who hasn\'t watched'}</small></span><span class="wv-sw${withOut?' on':''}"><i></i></span></button>
    <div class="frow" style="margin-top:12px"><button class="btn out" id="shImg">${svg('send')}Share image</button><button class="btn pri" id="shCouch">Post to the couch</button></div>`;
  openSheet('Share your night','Survivor 51 · Episode 5',`<div id="shB">${body()}</div>`,b=>{const wire=()=>{$('shOut').onclick=()=>{withOut=!withOut;$('shB').innerHTML=body();wire()};
    $('shImg').onclick=()=>toast('Opens your phone\'s share sheet with the card (mock)');$('shCouch').onclick=()=>{closeSheet();toast('Posted to the couch chat')}};wire()})}
const revealPlayS=revealPlay;
revealPlay=function(s){revealPlayS(s);const r=document.querySelector('.revealfs.v2'),done=r&&r.querySelector('#rvd');if(!done)return;
  done.insertAdjacentHTML('beforebegin',`<button class="btn out wide rv-share" id="rvShare">${svg('send')}Share your night</button>`);
  r.querySelector('#rvShare').onclick=shareSheet};
// ---------- what the couch sees ----------
function privHTML(){const P=PRIV;
  const lines=[['where','alex is on Episode 4 of Survivor'],['now','alex is watching The Traitors now'],['ratings','alex rated Survivor Episode 4 ★4'],['reactions','alex left 6 reactions on Below Deck']];
  return `<section class="blk" id="privSec"><div class="qsec"><h2 class="cap">What your couch sees</h2></div>
    ${[['all','Everything','Where you are in each show, when you\'re watching, your ratings and reactions',' <em>Recommended</em>'],['games','Just my games','Your games, ratings and reactions. Not what you watch or where you are',''],['min','Only what games need','Your picks and scores once they lock. Nothing else','']].map(([k,t,d,r])=>`<button class="radio${P.preset===k?' on':''}" data-priv="${k}"><i></i><span><b>${t}${r}</b><small>${d}</small></span></button>`).join('')}
    <div class="pv-prev"><span class="cap">What riley sees about you</span>${lines.map(([k,t])=>`<div class="pv-line${P[k]?'':' off'}">${P[k]?av('alex',22):`<span class="pv-x">${svg('eye')}</span>`}<span>${P[k]?t:'Hidden'}</span></div>`).join('')}</div>
    <details class="wvs-fine"${PRIV.open?' open':''}><summary><b>Customize</b><small>${P.preset==='custom'?'Your own mix':'Using the choice above'}</small>${svg('chev')}</summary>
      ${[['where','Where I am in each show'],['now','When I\'m watching'],['ratings','My episode ratings'],['reactions','My watch along reactions']].map(([k,t])=>`<div class="lockdown"><span class="tx"><b>${t}</b></span><button class="switch${P[k]?' on':''}" data-pv="${k}" aria-pressed="${P[k]}" aria-label="${t}"><i></i></button></div>`).join('')}
      <p class="muted small" style="margin-top:8px;line-height:1.45">Your picks always show once they lock: the games need that. To keep one show to yourself, use "Watch privately" in its ⋯ menu.</p></details></section>`}
const accountRouteS=accountRoute;
accountRoute=function(){accountRouteS();const spoil=[...app.querySelectorAll('section.blk')].find(x=>/Keeping you spoiler-free/.test(x.textContent));if(!spoil)return;
  spoil.insertAdjacentHTML('afterend',privHTML());wirePriv()};
function wirePriv(){const re=()=>{const y=$('scroller').scrollTop;$('privSec').outerHTML=privHTML();wirePriv();$('scroller').scrollTop=y};
  app.querySelectorAll('[data-priv]').forEach(b=>b.onclick=()=>{PRIV.preset=b.dataset.priv;Object.assign(PRIV,PRIV_PRESETS[PRIV.preset]);toast('Saved · your couch sees this from now on');re()});
  app.querySelectorAll('[data-pv]').forEach(b=>b.onclick=()=>{const k=b.dataset.pv;PRIV[k]=!PRIV[k];PRIV.preset=Object.keys(PRIV_PRESETS).find(p=>['where','now','ratings','reactions'].every(x=>PRIV_PRESETS[p][x]===PRIV[x]))||'custom';PRIV.open=true;re()});
  const d=app.querySelector('#privSec details');if(d)d.ontoggle=()=>PRIV.open=d.open}
