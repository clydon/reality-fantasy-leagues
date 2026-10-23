// ================= the TV guide shows all of TV; your shows lead, the rest is faded and hideable =================
// Decided 2026-10-23 (the user): the guide shows everything on, not just the couch's shows. Each day lists your shows
// and the couch's first, then "Also on" and the rest of TV as shorter, faded cards. A show that isn't on your list
// (a TV listing, or a couch show you don't follow) can be hidden from the guide from its sheet; your own shows can't.
// "N hidden" under the guide brings them back.
// TV listings the couch doesn't watch (in the real app: the listings feed). [id, name, art, crop, weekdays, time, season, genre]
const LISTINGS=[['trt','The Traitors','traitors','74% 35%',[4],[21,0],'S5','Competition'],['dr','RuPaul\'s Drag Race','drag-race','50% 30%',[5],[20,0],'S18','Competition'],
  ['dw','Dancing with the Stars','dwts','50% 30%',[2],[20,0],'S34','Competition'],['bb','Big Brother','big-brother','50% 30%',[0,3],[20,0],'S27','Competition'],
  ['ar','The Amazing Race','amazing-race','72% 50%',[4],[20,0],'S38','Competition'],['li','Love Island USA','love-island','96% 30%',[0,1,2,3,4,5],[21,0],'S7','Dating'],
  ['bd','Below Deck Med','below-deck','50% 25%',[1],[20,0],'S10','Docuseries'],['plu','Pluribus','pluribus','22% 40%',[5],[21,0],'S1','Drama'],
  ['chl','The Challenge','challenge','62% 30%',[2],[20,0],'S37','Competition'],
  ['tc','Top Chef','',null,[4],[21,0],'S23','Competition'],['bach','The Bachelor','',null,[1],[20,0],'S30','Dating'],['lib','Love Is Blind','',null,[3],[21,0],'S9','Dating'],
  ['rh','Real Housewives of SLC','',null,[2],[21,0],'S6','Docuseries'],['vpr','Vanderpump Rules','',null,[2],[20,0],'S12','Docuseries'],['gbbo','The Great British Bake Off','',null,[6],[20,0],'S16','Competition'],
  ['mafs','Married at First Sight','',null,[6],[21,0],'S19','Dating'],['sau','Survivor Australia','',null,[0],[19,30],'S12','Competition']];
const onCouch=id=>SHOWS.some(s=>s.id===id);
const tvArt=l=>l[2]?`<img src="${ART(l[2])}" alt="" style="object-position:${l[3]}">`:`<span class="g-noart">${l[1][0]}</span>`;
const hiddenTV=()=>[...W.hidden||[]];
W.hidden=new Set();
const atFor=(d,l)=>{const at=startOfToday();at.setDate(at.getDate()+d);at.setHours(l[5][0],l[5][1],0,0);return at};
const tvOn=d=>{const wd=(startOfToday().getDay()+d)%7;return LISTINGS.filter(l=>l[4].includes(wd)&&!onCouch(l[0])&&!state.added.has('tv-'+l[0])&&!W.hidden.has(l[0])).sort((a,b)=>atFor(d,a)-atFor(d,b))};
// the day blocks guideDays() writes, one string each (inner markup never starts with <div class="day)
const dayBlocks=h=>h.split('<div class="day').slice(1).map(b=>'<div class="day'+b);

// couch shows you don't follow can be hidden too
const listingsTV=listings;
listings=function(){return listingsTV().filter(x=>!W.hidden.has(x.s.id))};
const cardTV=card;
card=function(x){const h=cardTV(x);return x.s.others&&!follows(x.s)?h.replace('class="lst','class="lst g-not'):h};
const guideDaysTV=guideDays;
guideDays=function(clone){return dayBlocks(guideDaysTV(clone)).map((b,i)=>{const d=clone?i+1:i,tv=tvOn(d);if(!tv.length)return b;
    const body=tv.map(l=>{const at=atFor(d,l);return `<button class="lst g-tvc" data-tv="${l[0]}" data-d="${d}" aria-label="${l[1]}, ${clock(at)}, not on your shows">${tvArt(l)}<span class="tm">${clock(at)}</span><span class="tt">${l[1]}</span><span class="ep"><span>${l[6]} · ${l[7]}</span></span></button>`}).join('');
    // a day with nothing of the couch's drops its "Nothing on" placeholder; "Next up" stays
    const own=b.replace(/<div class="quiet">Nothing on<\/div>/,'');
    return own.slice(0,own.lastIndexOf('</div>'))+`<div class="g-also cap">${own.includes('class="lst')?'Also on':'On TV'}</div>${body}</div>`}).join('')};
const hubTV=hub;
hub=function(){const h=hubTV(),n=W.hidden.size;
  return h.replace('<span>Dashed: watching, not playing yet</span>',`<span class="g-legend">Faded: not on your shows${n?` · <button data-hidden>${n} hidden</button>`:''}</span>`)};
const wireHubTV=wireHub;
wireHub=function(){wireHubTV();
  app.querySelectorAll('[data-tv]').forEach(b=>b.onclick=e=>{e.stopPropagation();if(UI.dragged)return;tvShowSheet(LISTINGS.find(x=>x[0]===b.dataset.tv),+b.dataset.d)});
  const hb=app.querySelector('[data-hidden]');if(hb)hb.onclick=hiddenSheet};
const rerouteHub=()=>{const y=$('scroller').scrollTop;route();$('scroller').scrollTop=y};
function hideFromGuide(id,name){W.hidden.add(id);closeSheet();toast(`${name} is hidden from your guide`);rerouteHub()}
function tvShowSheet(l,d){const at=atFor(d,l);
  openSheet(l[1],`On TV ${DAY[at.getDay()]} ${clock(at)} · ${l[6]} · ${l[7]}`,`<div class="recap-art" style="height:150px">${l[2]?`<img src="${ART(l[2])}" alt="" style="object-position:${l[3]}">`:`<span class="g-noart big">${l[1][0]}</span>`}<b class="cap">${l[1]}</b></div>
    <p class="muted small" style="line-height:1.45;margin:4px 0 12px">Nobody on the couch watches it yet. Add it and they'll see you do.</p>
    <button class="btn pri wide cap" id="otAdd" style="font-size:18px">${svg('plus')}Add to my shows</button><button class="btn out wide" id="otHide" style="margin-top:10px">${svg('eye')}Hide from guide</button>`,
    sh=>{sh.querySelector('#otAdd').onclick=()=>{state.added.add('tv-'+l[0]);closeSheet();toast(`${l[1]} is on your shows`);rerouteHub()};sh.querySelector('#otHide').onclick=()=>hideFromGuide(l[0],l[1])})}
// a couch show you don't follow: its episode sheet gets "Hide from guide"; your own shows never do
const episodeSheetTV=episodeSheet;
episodeSheet=function(sid,ep,at){episodeSheetTV(sid,ep,at);const s=SHOWS.find(x=>x.id===sid);if(!s||follows(s))return;
  $('sheet').querySelector('.body').insertAdjacentHTML('beforeend',`<button class="btn out wide" id="epHide" style="margin-top:10px">${svg('eye')}Hide from guide</button>`);$('epHide').onclick=()=>hideFromGuide(s.id,s.name)};
function hiddenSheet(){const name=id=>(SHOWS.find(s=>s.id===id)||{}).name||(LISTINGS.find(l=>l[0]===id)||[])[1]||id;
  openSheet('Hidden from your guide','They stay off the guide until you bring them back',`${hiddenTV().map(id=>`<div class="g-tvrow"><span class="tx"><b>${name(id)}</b></span><button class="btn out sm" data-unhide="${id}">Show again</button></div>`).join('')}`,
    b=>b.querySelectorAll('[data-unhide]').forEach(x=>x.onclick=()=>{W.hidden.delete(x.dataset.unhide);x.closest('.g-tvrow').remove();rerouteHub();if(!W.hidden.size)closeSheet()}))}
