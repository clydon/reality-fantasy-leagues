// ================= empty days in the TV guide: picks, slim days, or full On TV columns =================
// The guide stays a guide (the user, 2026-10-22: "too special to remove"). What changes is a day with nothing from
// the couch on it. Three options, ?guide=combo|slim|ontv (compared in guide-options.html):
//   combo (default) Slim days plus picks: the two soonest empty days, on any couch, each get ONE pick (a narrower
//         faded On TV card for a show airing that day, ranked by how like your shows it is) with "N more on Fri" for
//         that day's full listings (filters, search); every other empty day is a slim strip. Two picks a week at
//         most, however big TV listings get. "Hide picks" makes them all slim.
//   slim  With two or fewer shows, empty days shrink to strips; the week fits one screen and stops rolling.
//   ontv  With two or fewer shows, every empty day keeps a full column holding one faded On TV show.
const GUIDE_OPT=['slim','ontv'].includes(new URLSearchParams(location.search).get('guide'))?new URLSearchParams(location.search).get('guide'):'combo';
const thinWeek=()=>new Set(listings().map(x=>x.s.id)).size<=2;
// TV listings the couch doesn't watch (in the real app: the listings feed). [id, name, art, crop, weekdays, time, season, genre]
const LISTINGS=[['trt','The Traitors','traitors','74% 35%',[4],[21,0],'S5','Competition'],['dr','RuPaul\'s Drag Race','drag-race','50% 30%',[5],[20,0],'S18','Competition'],
  ['dw','Dancing with the Stars','dwts','50% 30%',[2],[20,0],'S34','Competition'],['bb','Big Brother','big-brother','50% 30%',[0,3],[20,0],'S27','Competition'],
  ['ar','The Amazing Race','amazing-race','72% 50%',[3],[21,0],'S38','Competition'],['li','Love Island USA','love-island','96% 30%',[0,1,2,3,4,5],[21,0],'S7','Dating'],
  ['bd','Below Deck Med','below-deck','50% 25%',[1],[20,0],'S10','Docuseries'],['plu','Pluribus','pluribus','22% 40%',[5],[21,0],'S1','Drama'],
  ['tc','Top Chef','',null,[4],[21,0],'S23','Competition'],['bach','The Bachelor','',null,[1],[20,0],'S30','Dating'],['lib','Love Is Blind','',null,[3],[21,0],'S9','Dating'],
  ['rh','Real Housewives of SLC','',null,[2],[21,0],'S6','Docuseries'],['vpr','Vanderpump Rules','',null,[2],[20,0],'S12','Docuseries'],['gbbo','The Great British Bake Off','',null,[6],[20,0],'S16','Competition'],
  ['mafs','Married at First Sight','',null,[6],[21,0],'S19','Dating'],['sau','Survivor Australia','',null,[0],[19,30],'S12','Competition']];
const GENRES=['All','Competition','Dating','Docuseries','Drama'];
const onCouch=id=>SHOWS.some(s=>s.id===id);
// like your shows: the couch's genres first (all competition in the mock), then the rest
const likeYours=l=>l[7]==='Competition';
const airingOn=wd=>LISTINGS.filter(l=>l[4].includes(wd)&&!onCouch(l[0])&&!state.added.has('tv-'+l[0])).sort((a,b)=>(likeYours(b)-likeYours(a))||(!!b[2]-!!a[2]));
const tvArt=l=>l[2]?`<img src="${ART(l[2])}" alt="" style="object-position:${l[3]}">`:`<span class="g-noart">${l[1][0]}</span>`;
const picksOn=()=>!W.noPicks;
// picks fill only the soonest empty days; later empty days stay slim, so your own shows are never crowded out
const PICKS_A_WEEK=2;
// the day blocks guideDays() writes, one string each (inner markup never starts with <div class="day)
const dayBlocks=h=>h.split('<div class="day').slice(1).map(b=>'<div class="day'+b);
const emptyDay=b=>b.includes('class="quiet"')||b.includes('lst nextup');
const headOf=b=>b.slice(0,b.indexOf('</div>')+6);
const atFor=(d,l)=>{const at=startOfToday();at.setDate(at.getDate()+d);at.setHours(l[5][0],l[5][1],0,0);return at};
function pickCard(l,d,cls){const at=atFor(d,l);return `<button class="lst g-ontv${cls?' '+cls:''}" data-ontv="${l[0]}" data-d="${d}" aria-label="On TV: ${l[1]}, ${clock(at)}. ${likeYours(l)?'Like Survivor. ':''}Add it">${tvArt(l)}<span class="tm">${clock(at)}</span><span class="g-tv cap">${likeYours(l)?'Like Survivor':'Popular'}</span><span class="tt">${l[1]}</span><span class="ep"><span>${l[6]} · ${l[7]}</span></span><span class="g-plus">${svg('plus')}</span></button>`}

function slimWeek(){const blocks=dayBlocks(guideDaysWeek(false)),t0=startOfToday(),now=new Date();
  const full=blocks.filter(b=>!emptyDay(b)).length,slims=blocks.length-full,w=Math.max(112,Math.min(220,Math.floor((358-slims*26)/Math.max(1,full))));
  return blocks.map((b,d)=>{if(!emptyDay(b))return b.replace('<div class="day',`<div style="width:${w}px" class="day`);const date=new Date(t0);date.setDate(t0.getDate()+d);
    return `<div class="day g-slim${d===0?' today':''}" aria-label="${d===0?'Tonight':DAY[date.getDay()]}: nothing on"><b>${d===0?(now.getHours()>=17?'Tonight':'Today'):d===1?'Tmrw':DAY[date.getDay()]}</b><span>${d===0?'nothing on':date.getDate()}</span></div>`}).join('')}
const guideDaysWeek=guideDays;
guideDays=function(clone){const t0=startOfToday();
  if(GUIDE_OPT==='combo'&&picksOn()){const used=new Set(),now=new Date(),pickDays=dayBlocks(guideDaysWeek(false)).map((b,d)=>emptyDay(b)&&airingOn((t0.getDay()+d)%7).length?d:-1).filter(d=>d>=0).slice(0,PICKS_A_WEEK);
    return dayBlocks(guideDaysWeek(clone)).map((b,i)=>{if(!emptyDay(b))return b;const d=clone?i+1:i,wd=(t0.getDay()+d)%7,date=new Date(t0);date.setDate(t0.getDate()+d);
      if(!pickDays.includes(d))return `<div class="day g-slim${d===0?' today':''}"${clone?' aria-hidden="true"':''} aria-label="${d===0?'Tonight':DAY[wd]}: nothing on"><b>${d===0?(now.getHours()>=17?'Tonight':'Today'):d===1?'Tmrw':DAY[wd]}</b><span>${d===0?'nothing on':date.getDate()}</span></div>`;
      const all=airingOn(wd),l=all.find(x=>!used.has(x[0]))||all[0];used.add(l[0]);
      return headOf(b).replace('<div class="day',`<div class="day g-pickday`)+pickCard(l,d,'pick')+(all.length>1?`<button class="g-more" data-tvday="${d}">${all.length-1} more on ${d===0?'tonight':DAY[wd]} ›</button>`:'')+'</div>'}).join('')}
  if(GUIDE_OPT==='combo'||GUIDE_OPT==='slim'){if(!thinWeek())return guideDaysWeek(clone);return clone?'':slimWeek()}
  if(!thinWeek())return guideDaysWeek(clone);const used=new Set();
  return dayBlocks(guideDaysWeek(clone)).map((b,i)=>{if(!emptyDay(b))return b;const d=clone?i+1:i,l=airingOn((t0.getDay()+d)%7).find(x=>!used.has(x[0]));if(!l)return b;used.add(l[0]);return headOf(b)+pickCard(l,d)+'</div>'}).join('')};
const slimNow=()=>(GUIDE_OPT==='slim'||(GUIDE_OPT==='combo'&&!picksOn()))&&thinWeek();
const hubThinWeek=hub;
hub=function(){let h=hubThinWeek();
  if(slimNow())h=h.replace('<span class="rolling" id="rolling">','<span class="rolling" id="rolling" hidden>').replace('<div class="reel" id="reel">','<div class="reel g-thin g-week-slim" id="reel">');
  if(GUIDE_OPT==='combo')h=h.replace('<span>Dashed: watching, not playing yet</span>',picksOn()?'<span class="g-legend">Faded: on TV, picked for you · <button data-picks="off">Hide picks</button></span>':'<span class="g-legend">Dashed: watching, not playing yet · <button data-picks="on">Show picks</button></span>');
  else if(GUIDE_OPT==='ontv'&&thinWeek())h=h.replace('<span>Dashed: watching, not playing yet</span>','<span>Faded: on TV, not on the couch yet</span>');
  return h};
const wireHubThinWeek=wireHub;
wireHub=function(){wireHubThinWeek();if(slimNow())cancelAnimationFrame(reel.raf);
  app.querySelectorAll('[data-ontv]').forEach(b=>b.onclick=e=>{e.stopPropagation();tvShowSheet(LISTINGS.find(x=>x[0]===b.dataset.ontv),+b.dataset.d)});
  app.querySelectorAll('[data-tvday]').forEach(b=>b.onclick=e=>{e.stopPropagation();tvDaySheet(+b.dataset.tvday)});
  app.querySelectorAll('[data-picks]').forEach(b=>b.onclick=()=>{W.noPicks=b.dataset.picks==='off';route();toast(W.noPicks?'Picks hidden · turn them back on under the guide':'Picks are back')})};
function addFromTV(l){state.added.add('tv-'+l[0]);toast(`${l[1]} is on your shows`);const y=$('scroller').scrollTop;route();$('scroller').scrollTop=y}
function tvShowSheet(l,d){const at=atFor(d,l);
  openSheet(l[1],`On TV ${DAY[at.getDay()]} ${clock(at)} · ${l[6]} · ${l[7]}`,`<div class="recap-art" style="height:150px">${l[2]?`<img src="${ART(l[2])}" alt="" style="object-position:${l[3]}">`:`<span class="g-noart big">${l[1][0]}</span>`}<b class="cap">${l[1]}</b></div>
    <p class="muted small" style="line-height:1.45;margin:4px 0 12px">${likeYours(l)?'People who watch Survivor tend to watch this too. ':''}Nobody on the couch watches it yet. Add it and they'll see you do.</p><button class="btn pri wide cap" id="otAdd" style="font-size:18px">${svg('plus')}Add to my shows</button>`,
    sh=>sh.querySelector('#otAdd').onclick=()=>{closeSheet();addFromTV(l)})}
// a day's full listings: as big as TV gets, so filters and search
function tvDaySheet(d){const wd=(startOfToday().getDay()+d)%7;let g='All',q='';
  openSheet(`On TV ${d===0?'tonight':DAY[wd]}`,'Picked for you first · tap + to add one',`<label class="srch" style="margin-bottom:10px">${svg('search')}<input id="tvq" placeholder="Search ${d===0?'tonight':DAY[wd]}" autocomplete="off"></label>
    <div class="g-chips">${GENRES.map(x=>`<button class="chip${x===g?' on':''}" data-g="${x}">${x}</button>`).join('')}</div><div id="tvl"></div>`,
    b=>{const paint=()=>{const L=airingOn(wd).filter(l=>(g==='All'||l[7]===g)&&(!q||l[1].toLowerCase().includes(q)));
        b.querySelector('#tvl').innerHTML=L.map(l=>`<div class="g-tvrow"><span class="th">${tvArt(l)}</span><span class="tx"><b>${l[1]}</b><small>${clock(atFor(d,l))} · ${l[6]} · ${l[7]}${likeYours(l)?' · like Survivor':''}</small></span><button class="b-add static" data-tvadd="${l[0]}" aria-label="Add ${l[1]}">${svg('plus')}</button></div>`).join('')||'<p class="muted small" style="padding:10px 0">Nothing matches</p>';
        b.querySelectorAll('[data-tvadd]').forEach(x=>x.onclick=()=>{closeSheet();addFromTV(LISTINGS.find(l=>l[0]===x.dataset.tvadd))})};
      b.querySelectorAll('[data-g]').forEach(x=>x.onclick=()=>{g=x.dataset.g;b.querySelectorAll('[data-g]').forEach(y=>y.classList.toggle('on',y===x));paint()});
      b.querySelector('#tvq').oninput=e=>{q=e.target.value.trim().toLowerCase();paint()};paint()})}
