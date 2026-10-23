// ================= motion that grounds navigation (View Transitions) =================
// Thesis (2026-10-23): every move says where you went.
//   Channel change (the authored moment): tapping a show on the hub grows its art from that card into the show's
//     header; Back shrinks it home into the same card, at the scroll you left.
//   Depth = direction: deeper pushes in from the right (hub → show → Backstage / draft; first-run steps forward),
//     shallower reverses. Tabs at the same depth slide sideways by tab order, with the header and tab bar holding
//     still (the header morphs tall ⇄ compact) and the tab marker sliding to the new tab.
//   Same people, new places: explorer re-sorts and filters move each photo to its new spot; Faces ⇄ Rank morphs a
//     photo from grid tile to rank row.
// Only hash navigation and explorer re-renders animate; other re-renders (a toggle, an add) stay instant. Without View
// Transitions it all degrades to the old instant swap; reduced motion gets a short crossfade, no movement.
// ?motion=off turns it off (the functional checks run that way; check-site-motion.js checks the motion itself)
const VT=!!document.startViewTransition&&new URLSearchParams(location.search).get('motion')!=='off';
const RM=matchMedia('(prefers-reduced-motion: reduce)');
const NAV_TABS=['tonight','episodes','standings','cast','chat'];
const SCROLLS={};
let lastHash=location.hash||'#/hub',lastTap=null;
const parseHash=h=>{const p=(h||'').replace(/^#\/?/,'').split('/');return {p,key:p[0]||'hub'}};
function depthOf(h){const {p,key}=parseHash(h);if(key==='show')return ['backstage','draft','blind','waivers'].includes(p[2])?(p[3]?3:2):1;
  if(key==='start')return 1;if(['account','join','signin','signup'].includes(key))return 1;return 0}
// which way to move: push / pop / left / right (same depth, by tab or step order) / fade
function navKind(from,to){const a=parseHash(from),b=parseHash(to),da=depthOf(from),db=depthOf(to);
  if(a.key==='show'&&b.key==='show'&&a.p[1]===b.p[1]&&da===1&&db===1){const i=NAV_TABS.indexOf(a.p[2]||'tonight'),j=NAV_TABS.indexOf(b.p[2]||'tonight');return i===j?'fade':j>i?'left':'right'}
  if(a.key==='start'&&b.key==='start')return (+b.p[1]||1)>(+a.p[1]||1)?'push':'pop';
  if(a.key==='welcome'&&b.key==='start')return 'push';if(a.key==='start'&&b.key==='welcome')return 'pop';
  if(db>da)return 'push';if(db<da)return 'pop';return 'fade'}
// the channel change: the tapped card's art, and its home on the hub when coming back
const CARD='.poster,.b-chip,.w-cwc,.w-nudge,.hero,.cb-card,.sp-card,.rc-tile,.lp-show';
document.addEventListener('pointerdown',e=>{lastTap=e.target.closest(CARD)},true);
function cardArt(el){return el&&(el.querySelector('.face.front img,.cb-art img,.sp-show img,.pic img,.art img,img'))}
function hubArtFor(sid){const sc=$('scroller').getBoundingClientRect();
  return [...app.querySelectorAll(`[data-poster="${sid}"] .face.front img,[data-cw="${sid}"] img,.b-open[data-show="${sid}"] img`)].find(i=>{const r=i.getBoundingClientRect();return r.bottom>sc.top+40&&r.top<sc.bottom-40&&r.width>20})}
function nameEl(el,n){if(el){el.style.viewTransitionName=n;return el}}
function clearNames(){app.querySelectorAll('[style*="view-transition-name"]').forEach(x=>x.style.viewTransitionName='')}
// the tab marker as a real element, so it can slide between tabs
function placeTabMarker(){const bar=app.querySelector('.tabbar');if(!bar)return;const tabs=[...bar.querySelectorAll('a')],i=tabs.findIndex(a=>a.classList.contains('on'));if(i<0)return;
  bar.insertAdjacentHTML('beforeend',`<i class="tab-ind" style="left:calc(${i} * 100% / ${tabs.length} + 30% / ${tabs.length});width:calc(40% / ${tabs.length})"></i>`)}

removeEventListener('hashchange',route);
addEventListener('hashchange',()=>{const from=lastHash,to=location.hash;lastHash=to;SCROLLS[from]=$('scroller').scrollTop;
  const kind=navKind(from,to),showTo=parseHash(to).key==='show'&&depthOf(to)===1,showFrom=parseHash(from).key==='show'&&depthOf(from)===1;
  const after=()=>{if(kind==='pop'&&SCROLLS[to]!=null)$('scroller').scrollTop=SCROLLS[to]};
  if(!VT){route();after();return}
  // channel change: hub card → show header (push), show header → its hub card (pop); the art carries the motion,
  // so the screen behind it only crossfades
  const chan=!RM.matches&&((kind==='push'&&showTo&&depthOf(from)===0&&cardArt(lastTap))||(kind==='pop'&&showFrom&&depthOf(to)===0));
  const root=document.documentElement;root.dataset.nav=RM.matches?'calm':chan?'channel':kind;
  if(chan){if(kind==='push')nameEl(cardArt(lastTap),'show-art');else nameEl(app.querySelector('.sbar>img'),'show-art')}
  const t=document.startViewTransition(()=>{route();after();if(chan){if(kind==='push')nameEl(app.querySelector('.sbar>img'),'show-art');else nameEl(hubArtFor(parseHash(from).p[1]),'show-art')}});
  t.finished.finally(()=>{delete root.dataset.nav;clearNames()})});
// first paint and in-place re-renders still get the tab marker
const routeNav=route;
route=function(){routeNav();placeTabMarker()};
// explorer re-sorts, filters and view switches: each photo moves to its new place
const exRefreshInstant=exRefresh;
exRefresh=function(){if(!VT||RM.matches)return exRefreshInstant();const root=document.documentElement;
  const tag=()=>app.querySelectorAll('.ex [data-exc] img').forEach(img=>{const id=STATS[EX.sid].season().cast.findIndex(c=>c.name===img.closest('[data-exc]').dataset.exc);img.style.viewTransitionName='exp-'+id});
  tag();root.dataset.nav='flip';const t=document.startViewTransition(()=>{exRefreshInstant();tag()});t.finished.finally(()=>{delete root.dataset.nav;clearNames()})};
placeTabMarker();
