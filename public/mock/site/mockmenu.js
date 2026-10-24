// ================= the mock's scenario menu: one floating button, outside the design =================
// On a phone the mock fills the screen and the button floats over it; on a desktop the phone sits in a 390 × 844
// frame and the button sits beside it. Each scenario sets the mock state and jumps to a route. Replaces the old
// "Mock · 4" chip (still in the DOM for syncMockLabel, hidden).
const SCEN=[
  ['Ways in',[['welcome','New visitor','The landing page, then sign up',{n:0,hash:'#/welcome',out:true}],['signin','Returning player','The sign-in screen',{n:0,hash:'#/signin',out:true}],['invite','Opens an invite link','Signed out, riley\'s couch',{n:4,hash:'#/join/K7Q2XZ',out:true}]]],
  ['The hub',[['hub4','Couch of 4','Tonight\'s Guide, everything on',{n:4,hash:'#/hub'}],['hub12','Couch of 12','A big group',{n:12,hash:'#/hub'}],['solo','Solo player','No couch yet',{n:1,hash:'#/hub'}],['thin1','Thin couch · Survivor only','One show on the couch',{n:4,hash:'#/hub',shows:['surv']}],['thin2','Thin couch · Survivor + Challenge','Two shows on the couch',{n:4,hash:'#/hub',shows:['surv','chl']}],['fresh','New couch · no games yet','Survivor added, nothing started',{n:4,hash:'#/hub',shows:['surv'],fresh:true}],['newmem','New member · first week','The hub grows as the couch plays',{n:4,hash:'#/hub',pre:()=>{state.newMember=true}}]]],
  ['A show',[['surv','Survivor 51','Three games: Outlast, Weekly Lineup, Survival Pool',{n:4,hash:'#/show/surv/tonight',ph:'before'}],['onair','Survivor · on air now','Episode night, watch along',{n:4,hash:'#/show/surv/tonight',ph:'during'}],['after','Survivor · just aired','Results arriving in stages',{n:4,hash:'#/show/surv/tonight',ph:'after',res:'waiting'}],
    ['ar','The Amazing Race','You and jordan watch · not a game yet',{n:4,hash:'#/show/ar/tonight'}],['plu','Pluribus','A series only sam watches',{n:4,hash:'#/show/plu/tonight'}],['wa','Watch along','Below Deck, the couch\'s reactions in sync',{n:4,hash:'#/show/bd/tonight',then:()=>openWatch('bd')}]]],
  ['Streaming',[['sev','Severance','Out in full · you\'re on Episode 3, riley and jordan ahead',{n:4,hash:'#/show/sev/tonight'}],['hp','Harry Potter','All 8 episodes drop in two days',{n:4,hash:'#/show/hp/tonight'}],['afterhp','After the Harry Potter drop','Two days later: it lives on in the streaming rail',{n:4,hash:'#/hub',pre:()=>afterDrop()}]]],
  ['Waivers',[['wvs','Waivers',"Jenna's out: the best free agent is lined up for you",{n:4,hash:'#/show/surv/waivers',ph:'before',pre:()=>wvSet({ver:'simple'})}],
    ['wvtwo','Waivers · two out','Jenna and Patt out: two free swaps lined up',{n:4,hash:'#/show/surv/waivers',ph:'before',pre:()=>wvSet({ver:'simple',two:true})}],
    ['wv2','Waivers · old v2 (reference)',"Not picked: the live app's claim screen, ported",{n:4,hash:'#/show/surv/waivers',ph:'before',pre:()=>wvSet({ver:'v2'})}],
    ['wvsh','Waivers · shared league','Nobody can take your pick',{n:4,hash:'#/show/surv/waivers',ph:'before',pre:()=>wvSet({shared:true})}],
    ['wvran','Waivers ran','The run plays like an episode, then sits in Episodes',{n:4,hash:'#/show/surv/tonight',ph:'before',pre:()=>wvSet({stage:'ran'})}],
    ['wvq','Waivers · a quiet week','Nothing to do; How it works shows when moves happen',{n:4,hash:'#/show/surv/waivers',ph:'before',pre:()=>wvSet({stage:'quiet'})}],
    ['wvbs','Waivers · commissioner','Open a waiver window, settings, run it',{n:4,hash:'#/show/surv/backstage/waivers',ph:'before',pre:()=>wvSet({stage:'commish'})}],
    ['wvopt','Waivers: simple vs v2','How the pick was made, screen by screen',{n:4,hash:'#/hub',pre:()=>{location.href='waivers-options.html'}}]]],
  ['Results & admin',[['wdflag','Flag a wrong result','Episode 3 · Something wrong?',{n:4,hash:'#/show/surv/episodes',pre:()=>wdSet({}),then:()=>{episodePage(3);setTimeout(()=>disputeSheet(3),300)}}],
    ['wdcorr','A correction came in','Episode 3: Brady\'s idol removed for everyone',{n:4,hash:'#/show/surv/episodes',pre:()=>wdSet({corr:true})}],
    ['wdrule','Commissioner: keep our result','Backstage › Results · a house ruling',{n:4,hash:'#/show/surv/backstage/results',pre:()=>wdSet({corr:true})}],
    ['wdfill','Anyone fills in results','A player sees "Fill it in" after early results',{n:4,hash:'#/show/surv/tonight',ph:'after',res:'early',pre:()=>{wdSet({});delete SHOWSTATE.roles.alex}}],
    ['botres','How results get in','Copy and paste, One tap, Autopilot (soon)',{n:4,hash:'#/show/surv/backstage/results',pre:()=>{wdSet({});botSet({})}}],
    ['wdadmin','Admin','Inbox · Find · Settings',{n:4,hash:'#/admin/inbox',pre:()=>wdSet({})}],
    ['wdfact','Admin: decide a dispute','Both sides, then canonical',{n:4,hash:'#/admin/fact/d1',pre:()=>wdSet({})}]]],
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
  state.fresh=!!o.fresh;state.newMember=false;setShows(o.shows||null);if(o.pre)o.pre();
  N=o.n;sel=null;state.signedOut=!!o.out;state.solo=N===1;if(o.ph){SHOWSTATE.phase=o.ph;SHOWSTATE.res=o.res||SHOWSTATE.res}syncMockLabel();
  if(UI.wa)closeWatch();if(location.hash===o.hash)route();else location.hash=o.hash;$('scroller').scrollTop=0;if(o.then)setTimeout(o.then,400)});
// a thin couch: only some shows exist (?shows=surv,chl, or the Thin couch scenarios). Everything that lists shows
// reads SHOWS, so the mock drops the rest from it, plus the chatter lines, Commercial break cards and
// notifications about shows that are gone.
const ALL_SHOWS=SHOWS.slice();
function setShows(ids){SHOWS.splice(0,SHOWS.length,...ALL_SHOWS.filter(s=>!ids||ids.includes(s.id)).map(s=>state.fresh&&s===SURV_PLAYING?FRESH_SURV:s));sel=null;
  if(!SHOWS.some(s=>s.id==='trt'))state.banish=state.banish||'gone';else if(state.banish==='gone')state.banish=null}
const goneNames=()=>ALL_SHOWS.filter(s=>!SHOWS.some(x=>x.id===s.id)).flatMap(s=>[s.name,s.short,s.name.replace('The ','')]);
const mentionsGone=t=>goneNames().some(n=>t.includes(n));
const feedHTMLFull=feedHTML;
feedHTML=function(){const F=N===4?FEED4:FEED12,keep=F.slice();F.splice(0,F.length,...keep.filter(e=>!mentionsGone(e.filter(x=>typeof x==='string').join(' '))));try{return feedHTMLFull()}finally{F.splice(0,F.length,...keep)}};
const hubFull=hub;
hub=function(){const h=hubFull();return goneNames().length?h.replace(/<button class="mini" data-mini="\w+">[\s\S]*?<\/button>/g,m=>mentionsGone(m.replace(/<[^>]+>/g,' '))?'':m):h};
const notesSheetFull=notesSheet;
notesSheet=function(){const trt=ALL_SHOWS.find(s=>s.id==='trt');if(SHOWS.includes(trt))return notesSheetFull();
  SHOWS.push(trt);try{notesSheetFull()}finally{SHOWS.splice(SHOWS.indexOf(trt),1)}$('sheet').querySelectorAll('[data-n]').forEach(r=>{if(mentionsGone(r.textContent)||r.textContent.includes('Traitors'))r.remove()})};
{const q=new URLSearchParams(location.search);state.fresh=q.has('fresh');if(state.fresh)setShows(['surv']);else if(q.get('shows'))setShows(q.get('shows').split(','))}
// the fab steps aside while a sheet, page or watch along is open on a phone
const syncCtlBase=syncCtl;syncCtl=function(){syncCtlBase();$('mockFab').classList.toggle('away',!!(UI.sheet||UI.page||UI.wa))};
if(new URLSearchParams(location.search).has('frame'))$('mockFab').hidden=true;
try{if(!localStorage.getItem('gys-mock-hint')){$('mockFab').classList.add('hint');localStorage.setItem('gys-mock-hint','1');setTimeout(()=>$('mockFab').classList.remove('hint'),6000)}}catch(e){}
