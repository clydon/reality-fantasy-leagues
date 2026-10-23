// ================= streaming: shows released all at once, or long finished =================
// A streaming show has no airtime, so it can't live in the TV guide the way a weekly show does, but who's
// watching it still matters. Three ways to show it, chosen by ?binge=1|2|3 (compare them in binge-options.html):
//   1. Time only: the guide holds things with a time (airings, a drop day, a planned watch along). Self-paced
//      watching lives in "The couch is watching" with everyone's progress. A link under the guide points there.
//   2. Anytime column: a column right after Today lists what the couch is streaming, capped, "+N more".
//   3. Streaming rail: a slim row of chips under the guide.
const BINGE_OPT=[1,2,3].includes(+new URLSearchParams(location.search).get('binge'))?+new URLSearchParams(location.search).get('binge'):1;
const B12=(...a)=>({4:[],12:a});
SHOWS.push(
  {id:'hp',name:'Harry Potter',season:'Season 1',short:'Harry Potter',art:'harry-potter',pos:'50% 22%',hpos:'50% 16%',air:[5,21,0],col:'#7a1f2b',ep:1,series:true,binge:true,net:'HBO Max',eps:8,aired:0,onEp:0,dropAt:nextAir([5,21,0]),
   watchers:{4:['alex','riley','sam'],12:['alex','riley','sam','priya','maya','kat','luis']}},
  {id:'sev',name:'Severance',season:'Season 2',short:'Severance 2',art:'severance',pos:'62% 40%',hpos:'60% 30%',air:[5,21,0],col:'#2f6f5e',ep:10,series:true,binge:true,net:'Apple TV+',eps:10,aired:10,onEp:3,
   watchers:{4:['alex','riley','jordan'],12:['alex','riley','jordan','dev','noor','theo']}},
  {id:'wire',name:'The Wire',season:'Season 1 of 5',short:'The Wire',art:'the-wire',pos:'50% 50%',air:[0,21,0],col:'#3a3a3a',ep:13,series:true,binge:true,others:true,net:'2002 · HBO Max',eps:13,aired:13,onEp:0,watchers:{4:['jordan'],12:['jordan','ben']}},
  {id:'bear',name:'The Bear',season:'Season 4',short:'The Bear',art:'the-bear',pos:'50% 50%',air:[3,21,0],col:'#2f4f7a',ep:10,series:true,binge:true,others:true,net:'Hulu',eps:10,aired:10,onEp:0,watchers:B12('maya','luis')},
  {id:'slow',name:'Slow Horses',season:'Season 5',short:'Slow Horses',art:'slow-horses',pos:'50% 50%',air:[3,21,0],col:'#6b5a2e',ep:6,series:true,binge:true,others:true,net:'Apple TV+',eps:6,aired:6,onEp:0,watchers:B12('dev')},
  {id:'squid',name:'Squid Game',season:'Season 3',short:'Squid Game',art:'squid-game',pos:'50% 50%',air:[5,3,0],col:'#d6336c',ep:6,series:true,binge:true,others:true,net:'Netflix',eps:6,aired:6,onEp:0,watchers:B12('priya','kat','noor')},
  {id:'st',name:'Stranger Things',season:'Season 5',short:'Stranger Things',art:'stranger-things',pos:'50% 50%',air:[4,20,0],col:'#7a1010',ep:8,series:true,binge:true,others:true,net:'Netflix',eps:8,aired:8,onEp:0,watchers:B12('theo','ben','luis','maya')});
FIRST.where.hp=0;FIRST.where.sev=3;
Object.assign(WHERE,{sev:{riley:6,jordan:9,dev:10,noor:4,theo:2},wire:{jordan:4,ben:13},bear:{maya:7,luis:2},slow:{dev:5},squid:{priya:6,kat:3,noor:1},st:{theo:8,ben:5,luis:1,maya:3}});
Object.assign(WADATA,{
  sev:{ep:4,run:52,start:600,cast:null,lines:[[612,'riley','the hallway music. every time.'],[640,'jordan','ok this is where it gets good'],[668,'riley','I have so many questions'],[700,'jordan','the outie scenes hit different on a rewatch']],stickers:[]},
  wire:{ep:1,run:62,start:300,cast:null,lines:[[310,'jordan','first episode is slow, trust it'],[340,'jordan','the chair scene. that\'s the show.']],stickers:[]},
  hp:{ep:1,run:58,start:120,cast:null,lines:[],stickers:[]}});
// riley and jordan already planned Severance Episode 7 together on Saturday
(()=>{const t=nextAir([6,21,0]);W.plans.sev={how:'start',when:fmtT(t),who:['riley','jordan'],at:t,ep:7,mine:false}})();
const streamers=s=>(watchersOf(s)||[]).filter(n=>n!=='alex');
const bingeOn=()=>SHOWS.filter(s=>s.binge&&!(s.dropAt&&s.dropAt>Date.now())&&streamers(s).length);
const progress=(s,n)=>{const at=whereOf(s,n);return at>=s.eps?'finished':at?`Ep ${at} of ${s.eps}`:'starting soon'};
const pbar=(s,n)=>`<span class="b-pb"><i style="width:${Math.min(100,whereOf(s,n)/s.eps*100)}%"></i></span>`;

// ---------- the guide: streaming shows leave the schedule; a drop day and planned watch alongs have a time ----------
const listingsBase=listings;
listings=function(){const L=listingsBase().filter(x=>!x.s.binge),t0=startOfToday();
  SHOWS.filter(s=>s.binge&&s.dropAt).forEach(s=>{const d=Math.floor((s.dropAt-t0)/864e5);if(d>=0&&d<7&&(!window.GUIDE_ONLY||GUIDE_ONLY.includes(s.id)))L.push({s,at:s.dropAt,d,ep:1,kind:'drop'})});
  if(BINGE_OPT===1)Object.entries(W.plans).forEach(([id,p])=>{const s=SHOWS.find(x=>x.id===id);if(!s||!s.binge||!p.at)return;const d=Math.floor((p.at-t0)/864e5);if(d>=0&&d<7)L.push({s,at:p.at,d,ep:p.ep,kind:'plan',p})});
  return L};
const cardBase=card;
card=function(x){const s=x.s,f=n=>`<span style="background:${col(n)}">${n[0].toUpperCase()}</span>`;
  if(x.kind==='drop'){const w=(watchersOf(s)||[]).slice(0,4);return `<button class="lst b-drop" data-show="${s.id}" data-ep="1" data-at="${fmtT(x.at)}" aria-label="${s.name}, all ${s.eps} episodes drop ${fmtT(x.at)}"><img src="${ART(s.art)}" alt="" style="object-position:${s.pos}"><span class="tm">${clock(x.at)}</span><span class="b-tag cap">All ${s.eps} drop</span><span class="tt">${s.name}</span><span class="ep"><span>${s.net}</span><span class="f">${w.map(f).join('')}</span></span></button>`}
  if(x.kind==='plan'){const p=x.p;return `<button class="lst b-plan" data-show="${s.id}" data-ep="${p.ep}" data-at="${fmtT(x.at)}" aria-label="${s.name} Episode ${p.ep} together, ${fmtT(x.at)}"><img src="${ART(s.art)}" alt="" style="object-position:${s.pos}"><span class="tm">${clock(x.at)}</span><span class="b-tag good cap">Together · Ep ${p.ep}</span><span class="tt">${s.name}</span><span class="ep"><span>${p.mine===false?p.who.join(' + '):'you + '+p.who.length}</span><span class="f">${p.who.slice(0,4).map(f).join('')}</span></span></button>`}
  return cardBase(x)};
// option 2: the Anytime column right after Today
const guideDaysBase=guideDays;
guideDays=function(clone){const h=guideDaysBase(clone);if(clone||BINGE_OPT!==2)return h;const i=h.indexOf('<div class="day',1);if(i<0)return h;
  const L=bingeOn().sort((a,b)=>streamers(b).length-streamers(a).length),shown=L.slice(0,3);
  const col_=`<div class="day b-any"><div class="dh"><b>Anytime</b><span>streaming</span></div>${shown.map(s=>`<button class="b-anyc" data-show="${s.id}"><img src="${ART(s.art)}" alt="" style="object-position:${s.pos}"><span class="tx"><b class="cap">${s.name}</b><span class="f">${streamers(s).slice(0,3).map(n=>`<span style="background:${col(n)}">${n[0].toUpperCase()}</span>`).join('')}<small>${streamers(s).length===1?progress(s,streamers(s)[0]):streamers(s).length+' watching'}</small></span></span></button>`).join('')}
    ${L.length>3?`<button class="b-more" data-bmore>+${L.length-3} more streaming</button>`:''}</div>`;
  return h.slice(0,i)+col_+h.slice(i)};
// options 1 and 3 change the hub around the guide
const hubBaseB=hub;
hub=function(){let h=hubBaseB();const L=bingeOn();
  if(BINGE_OPT===1&&L.length)h=h.replace('<span>Dashed: watching, not playing yet</span>',`<button class="b-jump" data-bjump>${svg('tv')}${L.length} streaming at your own pace ›</button>`);
  if(BINGE_OPT===3&&L.length)h=h.replace('<div class="guide-f">',`<div class="b-rail-h"><span class="cap">Streaming · your own pace</span><small>${L.length} show${L.length>1?'s':''}</small></div><div class="b-rail" id="bRail">${L.map(s=>`<button class="b-chip" data-show="${s.id}"><img src="${ART(s.art)}" alt="" style="object-position:${s.pos}"><span class="tx"><b class="cap">${s.name}</b><small>${streamers(s).slice(0,2).map(n=>`${n} ${progress(s,n).replace(' of '+s.eps,'')}`).join(' · ')}${streamers(s).length>2?` +${streamers(s).length-2}`:''}</small></span></button>`).join('')}</div><div class="guide-f">`);
  return h};
// "The couch is watching": progress bars for streaming shows (option 1 is their home; 2 and 3 show them elsewhere)
const couchWatchBase=couchWatchHTML;
couchWatchHTML=function(){if(BINGE_OPT!==1)return couchWatchBase(s=>!s.binge||(s.dropAt&&s.dropAt>Date.now()));
  const list=SHOWS.map(s=>({s,o:streamers(s)})).filter(x=>x.o.length).sort((a,b)=>(!!b.s.binge-!!a.s.binge)||(follows(a.s)-follows(b.s))||b.o.length-a.o.length);
  return `<section class="sec" id="bShelf"><div class="sh"><h2 class="cap">The couch is watching</h2><span class="aside">Tap to check one out</span></div><div class="w-cw" id="wCW">${list.map(({s,o})=>{const live=NOW[s.id],pre=s.dropAt&&s.dropAt>Date.now();
    return `<button class="w-cwc" data-cw="${s.id}"><span class="pic"><img src="${ART(s.art)}" alt="" style="object-position:${s.pos}">${s.binge?`<span class="b-st cap">${pre?'Drops '+DAY[s.dropAt.getDay()]:'Streaming · '+s.net.split(' · ').pop()}</span>`:''}${follows(s)?'':'<span class="w-new cap">Not on your list</span>'}${live?`<span class="w-on cap"><i></i>${live} is on</span>`:''}</span>
      <b class="cap">${s.name}</b><span class="ppl">${o.slice(0,3).map(n=>s.binge&&!pre?`<span class="b-row">${av(n,20)}<span class="b-who">${n} · ${progress(s,n)}${pbar(s,n)}</span></span>`:`<span>${av(n,20)}${n} · ${pre?'starting it':NOW[s.id]===n?'now':whereOf(s,n)>=airedOf(s)?'caught up':'Ep '+whereOf(s,n)}</span>`).join('')}${o.length>3?`<span class="more">+${o.length-3} more</span>`:''}</span></button>`}).join('')}</div></section>`};
const wireHubBaseB=wireHub;
wireHub=function(){wireHubBaseB();
  app.querySelectorAll('.b-anyc,.b-chip').forEach(b=>b.onclick=()=>location.hash=`#/show/${b.dataset.show}/tonight`);
  app.querySelectorAll('[data-bmore],[data-bjump]').forEach(b=>b.onclick=()=>{const t=$('wCW')||$('bRail');if(t)$('scroller').scrollTo({top:t.getBoundingClientRect().top+$('scroller').scrollTop-140,behavior:'smooth'})});
  if($('bRail'))hscroll($('bRail'))};
// streaming shows never take the hub's "Up next" countdown
const heroPickBase=heroPick;
heroPick=function(){const id=heroPickBase(),s=SHOWS.find(x=>x.id===id);if(!s||!s.binge)return id;return mine().filter(x=>!x.binge).sort((a,b)=>nextAir(a.air)-nextAir(b.air))[0].id};
const posterBase=poster;
poster=function(s){const h=posterBase(s);return s.binge?h.replace(`${s.season} · ${DAY[s.air[0]]}`,`${s.season} · ${s.dropAt&&s.dropAt>Date.now()?'drops '+DAY[s.dropAt.getDay()]:s.net.split(' · ').pop()}`):h};

// ---------- the show space for a streaming show ----------
const wBarBase=wBar;
wBar=function(s){let h=wBarBase(s);if(!s.binge)return h;const pre=s.dropAt&&s.dropAt>Date.now();
  h=h.replace(/<span class="sbar-st">[\s\S]*?<\/span><button/,`<span class="sbar-st">${pre?`Drops in <span data-cd="${s.dropAt.getTime()}">—</span>`:`All ${s.eps} episodes · ${s.net.split(' · ').pop()}`}</span><button`);
  return h.replace('<span class="w-nag cap">Series</span>','<span class="w-nag cap">Streaming</span>')};
const wTonightBase=wTonight;
wTonight=function(s){if(!s.binge)return wTonightBase(s);const pre=s.dropAt&&s.dropAt>Date.now(),fol=follows(s),w=fol?whereOf(s,'alex'):0,next=Math.min(w+1,s.eps),others=streamers(s),plan=W.plans[s.id];let h='';
  if(pre)h+=`<div class="b-dropbox"><span class="b-tag cap">All ${s.eps} episodes at once</span><b class="cap">Drops ${fmtT(s.dropAt)}</b><span class="b-cd num" data-cd="${s.dropAt.getTime()}">—</span><small>${s.net} · ${others.length?`${names(others)} ${others.length===1?'is':'are'} starting it then`:'Be the first on the couch'}</small></div>`;
  else if(!fol)h+=`<section class="blk"><div class="w-follow"><span class="stack">${others.map(n=>av(n,30)).join('')}</span><div><b>${names(others)} ${others.length===1?'is':'are'} streaming this</b><small>All ${s.eps} episodes are out. Add it to watch along with their reactions, at your own pace.</small></div><button class="btn pri wide" data-wjob="follow">${svg('plus')}Add to my shows</button></div></section>`;
  else h+=`<section class="blk"><div class="where" style="margin:0">${svg('eye')}<strong>${w>=s.eps?'Finished':w?`You're on Episode ${w} of ${s.eps} · nothing past it shows`:'Not started · nothing past Episode 1 shows'}</strong><button data-wjob="where">Change</button></div></section>`;
  if(!pre){const ahead=others.filter(n=>whereOf(s,n)>=next);
    h+=`<button class="wacta" data-wjob="watch"><img src="${ART(s.art)}" alt="" style="object-position:${s.hpos||s.pos}"><span class="tg cap">Episode ${next} · your own pace</span><b class="cap">Watch along</b><small>${ahead.length?`${names(ahead)} left ${rxCount(s,next)} reactions · they show up as you reach them`:'You\'re first here. Your reactions wait for the couch.'}</small></button>`}
  h+=plan?`<div class="w-plan"><span class="tg cap">Together</span><div class="tx"><b>Episode ${plan.ep} · ${plan.when}</b><small>${plan.mine===false?`${names(plan.who)} planned it`:`${names(plan.who)} invited`} · anyone can pause for everyone</small></div><button class="btn pri" data-bjoin>${plan.mine===false?'Join':'Open'}</button></div>`
    :`<button class="w-inv" data-wjob="invite">${svg('people')}<span><b>${pre?'Plan the premiere together':'Watch the next one together'}</b><small>Pick a time, start at the same moment, anyone can pause</small></span>${svg('chev')}</button>`;
  h+=`<section class="blk"><div class="sh"><h2 class="cap">Who's watching</h2><span class="aside">${pre?'starting '+DAY[s.dropAt.getDay()]:'at their own pace'}</span></div>
    ${[...(fol?['alex']:[]),...others].map(n=>`<div class="w-who">${av(n,32)}<span class="tx"><b>${n}${n==='alex'?' <span class="you">YOU</span>':''}</b><small>${pre?`Starting it ${DAY[s.dropAt.getDay()]}`:progress(s,n)}</small>${pre?'':pbar(s,n)}</span>${n!=='alex'&&!pre&&fol&&whereOf(s,n)>w?`<span class="w-ahead">${whereOf(s,n)-w} ahead</span>`:''}</div>`).join('')}</section>`;
  if(fol&&!pre)h+=`<section class="blk"><div class="sh"><h2 class="cap">Every episode</h2><span class="aside">Skip any, no deadlines</span></div>
    <button class="job" data-wjob="rate"><span class="ic">${svg('star')}</span><span class="tx"><b>Rate Episode ${Math.max(1,w)}</b><small>Then see the couch verdict</small></span>${svg('chev')}</button>
    <button class="job" data-wjob="predict"><span class="ic">${svg('quiz')}</span><span class="tx"><b>Call it before Episode ${next}</b><small>Two quick calls · see who got it after</small></span>${svg('chev')}</button></section>`;
  return h+'<div style="height:30px"></div>'};
const wEpisodesBase=wEpisodes;
wEpisodes=function(s){if(!s.binge)return wEpisodesBase(s);const pre=s.dropAt&&s.dropAt>Date.now(),w=follows(s)?whereOf(s,'alex'):0;
  return `<section class="blk"><div class="sh"><h2 class="cap">${s.season}</h2><span class="aside">${pre?`All ${s.eps} drop ${DAY[s.dropAt.getDay()]}`:`All ${s.eps} out · ${s.net}`}</span></div>
    ${Array.from({length:s.eps},(_,k)=>k+1).map(e=>pre?`<div class="w-ep locked"><span class="n num">${e}</span><span class="tx"><b>Episode ${e}</b><small>Drops ${fmtT(s.dropAt)}</small></span></div>`
      :e<=w?`<button class="w-ep" data-wjob="watch"><span class="n num">${e}</span><span class="tx"><b>Episode ${e}</b><small>${rxCount(s,e)} reactions · ${pickN(s,e)} rated</small></span><span class="w-vd"><b class="num">★ ${verdict(s,e)}</b><small>${W.rates[s.id+e]?`you ${W.rates[s.id+e]}`:'couch'}</small></span></button>`
      :`<div class="w-ep locked"><span class="n num">${e}</span><span class="tx"><b>Episode ${e}</b><small>${streamers(s).filter(n=>whereOf(s,n)>=e).length} on the couch watched · verdict hidden</small></span>${e===w+1?'<button class="btn sm pri" data-wjob="watch">Watch along</button>':''}</div>`).join('')}</section><div style="height:30px"></div>`};
// a streaming show has no live airing: watching together is always a shared start, at a time you pick
const inviteWatchBase=inviteWatch;
inviteWatch=function(s){if(!s.binge)return inviteWatchBase(s);const pre=s.dropAt&&s.dropAt>Date.now(),ep=pre?1:Math.min(whereOf(s,'alex')+1,s.eps),fans=watchersOf(s)||[],who=new Set(fans.filter(n=>n!=='alex'));
  const days=pre?[[s.dropAt,'Drop night']]:[0,1,2].map(i=>{const d=startOfToday();d.setDate(d.getDate()+i);return [d,i?i===1?'Tomorrow':DAY[d.getDay()]:'Tonight']});let di=0,tm='9:00 PM';
  openSheet('Watch it together',`${s.name} · Episode ${ep}`,`<p class="muted small" style="line-height:1.45;margin-bottom:10px">One shared start, anyone can pause for everyone. ${pre?'Start the moment it drops.':'Everyone needs to be on Episode '+(ep-1)+' or past it.'}</p>
    <p class="label cap">Day</p>${days.map(([d,l],i)=>`<button class="chip${i===0?' on':''}" data-d="${i}">${l}</button>`).join('')}
    <p class="label cap">Start at</p>${['8:00 PM','9:00 PM','10:00 PM'].map(x=>`<button class="chip${x===tm?' on':''}" data-t="${x}">${x}</button>`).join('')}
    <p class="label cap">Invite</p><div>${crowdOf().filter(n=>n!=='alex').map(n=>`<button class="chip${who.has(n)?' on':''}" data-p="${n}">${n}${fans.includes(n)?(pre?'':' · '+progress(s,n).replace(' of '+s.eps,'')):' · new to it'}</button>`).join('')}</div>
    <button class="btn pri wide" id="bSend" style="margin-top:12px">Send invites</button>`,
    b=>{b.querySelectorAll('[data-d]').forEach(x=>x.onclick=()=>{di=+x.dataset.d;b.querySelectorAll('[data-d]').forEach(y=>y.classList.toggle('on',y===x))});
      b.querySelectorAll('[data-t]').forEach(x=>x.onclick=()=>{tm=x.dataset.t;b.querySelectorAll('[data-t]').forEach(y=>y.classList.toggle('on',y===x))});
      b.querySelectorAll('[data-p]').forEach(x=>x.onclick=()=>{x.classList.toggle('on');x.classList.contains('on')?who.add(x.dataset.p):who.delete(x.dataset.p);$('bSend').disabled=!who.size});
      $('bSend').onclick=()=>{const at=new Date(days[di][0]);const [hh,mm]=tm.split(/[: ]/);at.setHours(+hh%12+12,+mm,0,0);if(pre)at.setTime(s.dropAt.getTime());
        W.plans[s.id]={how:'start',when:fmtT(at),who:[...who],at,ep,mine:true};closeSheet();toast(`Invites sent · ${s.short} Ep ${ep}, ${fmtT(at)}`);
        [FEED4,FEED12].forEach(F=>F.unshift(['alex','invited the couch to watch along',`${s.short} · Episode ${ep} · ${fmtT(at)}`,null]));route()}})};
const wireWBase=wireW;
wireW=function(s){wireWBase(s);app.querySelectorAll('[data-bjoin]').forEach(b=>b.onclick=()=>{const p=W.plans[s.id];if(p.mine===false&&whereOf(s,'alex')<p.ep-1)return toast(`You're on Episode ${whereOf(s,'alex')}. Catch up to ${p.ep-1} to join this one`);openWatch(s.id,{together:p})})};
