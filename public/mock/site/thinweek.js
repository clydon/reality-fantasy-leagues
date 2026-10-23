// ================= a thin week: the TV guide when the couch has only one or two shows =================
// The guide stays a guide (the user, 2026-10-22: "too special to remove"); what changes is the empty days. Two
// options, chosen by ?guide=slim|ontv (compare them in guide-options.html), applied only when two or fewer shows
// are on this week's guide:
//   slim  Empty days shrink to a slim strip with the day written down it; days with shows widen. The whole week
//         fits on one screen, so the reel stops rolling.
//   ontv  Every day keeps its column; an empty day shows one faded "On TV" show that airs that day but nobody on
//         the couch watches, with a + to add it. Empty days become discovery.
const GUIDE_OPT=new URLSearchParams(location.search).get('guide')==='ontv'?'ontv':'slim';
const thinWeek=()=>new Set(listings().map(x=>x.s.id)).size<=2;
const ON_TV=[['trt','The Traitors','traitors','74% 35%',[4,21,0],'S5'],['bd','Below Deck Med','below-deck','50% 25%',[1,20,0],'S10'],['bb','Big Brother','big-brother','50% 30%',[0,20,0],'S27'],
  ['dr','RuPaul\'s Drag Race','drag-race','50% 30%',[5,20,0],'S18'],['dw','Dancing with the Stars','dwts','50% 30%',[2,20,0],'S34'],['li','Love Island USA','love-island','96% 30%',[6,21,0],'S7'],['ar','The Amazing Race','amazing-race','72% 50%',[3,21,0],'S38']];
// the day blocks guideDays() writes, one string each (inner markup never starts with <div class="day)
const dayBlocks=h=>h.split('<div class="day').slice(1).map(b=>'<div class="day'+b);
const emptyDay=b=>b.includes('class="quiet"')||b.includes('lst nextup');

const guideDaysWeek=guideDays;
guideDays=function(clone){if(!thinWeek())return guideDaysWeek(clone);
  if(GUIDE_OPT==='slim'){if(clone)return '';const blocks=dayBlocks(guideDaysWeek(false)),t0=startOfToday(),now=new Date();
    const full=blocks.filter(b=>!emptyDay(b)).length,slims=blocks.length-full,w=Math.max(112,Math.min(220,Math.floor((358-slims*26)/Math.max(1,full))));
    return blocks.map((b,d)=>{if(!emptyDay(b))return b.replace('<div class="day',`<div style="width:${w}px" class="day`);const date=new Date(t0);date.setDate(t0.getDate()+d);
      return `<div class="day g-slim${d===0?' today':''}" aria-label="${d===0?'Tonight':DAY[date.getDay()]}: nothing on"><b>${d===0?(now.getHours()>=17?'Tonight':'Today'):d===1?'Tmrw':DAY[date.getDay()]}</b><span>${d===0?'nothing on':date.getDate()}</span></div>`}).join('')}
  // ontv: fill each empty day with one show that airs then and isn't on the couch
  const used=new Set(),t0=startOfToday();
  return dayBlocks(guideDaysWeek(clone)).map((b,i)=>{if(!emptyDay(b))return b;const head=b.slice(0,b.indexOf('</div>')+6),d=clone?i+1:i,wd=(t0.getDay()+d)%7;
    const pick=ON_TV.find(o=>o[4][0]===wd&&!SHOWS.some(s=>s.id===o[0])&&!used.has(o[0]))||ON_TV.find(o=>!SHOWS.some(s=>s.id===o[0])&&!used.has(o[0]));if(!pick)return b;used.add(pick[0]);
    const at=new Date(t0);at.setDate(t0.getDate()+d);at.setHours(pick[4][1],pick[4][2],0,0);
    return head+`<button class="lst g-ontv" data-ontv="${pick[0]}" aria-label="On TV: ${pick[1]}, ${clock(at)}. Add it"><img src="${ART(pick[2])}" alt="" style="object-position:${pick[3]}"><span class="tm">${clock(at)}</span><span class="g-tv cap">On TV</span><span class="tt">${pick[1]}</span><span class="ep"><span>${pick[5]}</span></span><span class="g-plus">${svg('plus')}</span></button></div>`}).join('')};
const hubThinWeek=hub;
hub=function(){const h=hubThinWeek();if(!thinWeek())return h;
  return (GUIDE_OPT==='slim'?h.replace('<span class="rolling" id="rolling">','<span class="rolling" id="rolling" hidden>'):h).replace('<div class="reel" id="reel">',`<div class="reel g-thin g-week-${GUIDE_OPT}" id="reel">`)
    .replace('<span>Dashed: watching, not playing yet</span>',GUIDE_OPT==='ontv'?'<span>Faded: on TV, not on the couch yet</span>':'<span>Dashed: watching, not playing yet</span>')};
const wireHubThinWeek=wireHub;
wireHub=function(){wireHubThinWeek();if(!thinWeek())return;if(GUIDE_OPT==='slim')cancelAnimationFrame(reel.raf);
  app.querySelectorAll('[data-ontv]').forEach(b=>b.onclick=e=>{e.stopPropagation();const o=ON_TV.find(x=>x[0]===b.dataset.ontv);
    openSheet(o[1],`On TV ${b.querySelector('.tm').textContent} · nobody on the couch watches it yet`,`<div class="recap-art" style="height:150px"><img src="${ART(o[2])}" alt="" style="object-position:${o[3]}"><b class="cap">${o[1]}</b></div>
      <p class="muted small" style="line-height:1.45;margin:4px 0 12px">Add it and the couch sees you watch it. They might join you.</p><button class="btn pri wide cap" id="otAdd" style="font-size:18px">${svg('plus')}Add to my shows</button>`,
      sh=>sh.querySelector('#otAdd').onclick=()=>{closeSheet();b.remove();toast(`${o[1]} is on your shows`)})})};
