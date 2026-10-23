// ================= the mock's scenario menu: one floating button, outside the design =================
// On a phone the mock fills the screen and the button floats over it; on a desktop the phone sits in a 390 × 844
// frame and the button sits beside it. Each scenario sets the mock state and jumps to a route. Replaces the old
// "Mock · 4" chip (still in the DOM for syncMockLabel, hidden).
const SCEN=[
  ['Ways in',[['welcome','New visitor','The landing page, then sign up',{n:0,hash:'#/welcome',out:true}],['signin','Returning player','The sign-in screen',{n:0,hash:'#/signin',out:true}],['invite','Opens an invite link','Signed out, riley\'s couch',{n:4,hash:'#/join/K7Q2XZ',out:true}]]],
  ['The hub',[['hub4','Couch of 4','Tonight\'s Guide, everything on',{n:4,hash:'#/hub'}],['hub12','Couch of 12','A big group',{n:12,hash:'#/hub'}],['solo','Solo player','No couch yet',{n:1,hash:'#/hub'}]]],
  ['A show',[['surv','Survivor 51','Three games: Outlast, Weekly Lineup, Survival Pool',{n:4,hash:'#/show/surv/tonight',ph:'before'}],['onair','Survivor · on air now','Episode night, watch along',{n:4,hash:'#/show/surv/tonight',ph:'during'}],['after','Survivor · just aired','Results arriving in stages',{n:4,hash:'#/show/surv/tonight',ph:'after',res:'waiting'}],
    ['ar','The Amazing Race','You and jordan watch · not a game yet',{n:4,hash:'#/show/ar/tonight'}],['plu','Pluribus','A series only sam watches',{n:4,hash:'#/show/plu/tonight'}],['wa','Watch along','Below Deck, the couch\'s reactions in sync',{n:4,hash:'#/show/bd/tonight',then:()=>openWatch('bd')}]]],
  ['Run a game',[['draft','Draft room','Outlast snake draft',{n:4,hash:'#/show/surv/draft'}],['blind','Blind draft','Pick privately, reveal together',{n:4,hash:'#/show/surv/blind'}],['bs','Backstage','The commissioner\'s side',{n:4,hash:'#/show/surv/backstage'}]]],
  ['You',[['acct','Account settings','Notifications, spoilers, appearance',{n:4,hash:'#/account'}]]]];
document.body.insertAdjacentHTML('beforeend',`<button class="mockfab" id="mockFab" aria-label="Mock scenarios" aria-expanded="false"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg><span>Scenarios</span></button>
  <div class="mockscrim" id="mockScrim" hidden></div>
  <div class="mockpanel" id="mockPanel" role="dialog" aria-label="Mock scenarios" hidden><div class="mp-h"><div><b>Design mock</b><small>Game Your Show · nothing here is saved</small></div><button id="mockX" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
    ${SCEN.map(([g,rows])=>`<p class="mp-g">${g}</p>${rows.map(([k,t,d])=>`<button class="mp-r" data-scen="${k}"><b>${t}</b><small>${d}</small></button>`).join('')}`).join('')}
    <button class="mp-reset" id="mockReset">Start over</button></div>`);
function mockMenu(open){$('mockPanel').hidden=!open;$('mockScrim').hidden=!open;$('mockFab').setAttribute('aria-expanded',open);$('mockFab').classList.remove('hint')}
$('mockFab').onclick=()=>mockMenu($('mockPanel').hidden);$('mockX').onclick=$('mockScrim').onclick=()=>mockMenu(false);
$('mockReset').onclick=()=>{location.href=location.pathname};
addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('mockPanel').hidden)mockMenu(false)});
document.querySelectorAll('[data-scen]').forEach(b=>b.onclick=()=>{const o=SCEN.flatMap(g=>g[1]).find(r=>r[0]===b.dataset.scen)[3];mockMenu(false);
  N=o.n;sel=null;state.signedOut=!!o.out;state.solo=N===1;if(o.ph){SHOWSTATE.phase=o.ph;SHOWSTATE.res=o.res||SHOWSTATE.res}syncMockLabel();
  if(UI.wa)closeWatch();if(location.hash===o.hash)route();else location.hash=o.hash;$('scroller').scrollTop=0;if(o.then)setTimeout(o.then,400)});
// the fab steps aside while a sheet, page or watch along is open on a phone
const syncCtlBase=syncCtl;syncCtl=function(){syncCtlBase();$('mockFab').classList.toggle('away',!!(UI.sheet||UI.page||UI.wa))};
try{if(!localStorage.getItem('gys-mock-hint')){$('mockFab').classList.add('hint');localStorage.setItem('gys-mock-hint','1');setTimeout(()=>$('mockFab').classList.remove('hint'),6000)}}catch(e){}
