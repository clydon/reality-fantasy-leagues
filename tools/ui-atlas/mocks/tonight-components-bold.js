/* Impeccable bold round: television identity, a social viewing lounge and
   broadcast game payoff. Captured facts and V4 permissions remain authoritative. */
window.TonightComponentDirection=function(a,base){
  const {esc,icon,btn}=a;
  let featured=null,rivalId=null,talking=null,observer;
  const scoreRuns=new WeakMap();
  const s=()=>a.space(),state=()=>a.state(),n=()=>state().seen,next=()=>a.next(),r=()=>a.results();
  const friends=()=>s().people.filter(p=>p.userId!==a.data().context.userId);
  const released=()=>Math.max(1,s().schedule.latestAired||0);
  const name=p=>p.you?'You':a.nameOf(p);
  const live=()=>!!s().schedule.upNext?.live&&n()>=s().schedule.latestAired;
  const available=()=>next()<=s().schedule.latestAired||live();
  const portrait=p=>a.avatar(p.you?'Alex':name(p));
  const showArt=()=>esc(s().show.artUrl);
  const title=i=>s().schedule.episodes.find(e=>e.number===i)?.title;
  const ep=i=>`Episode ${i}${title(i)?' · '+title(i):''}`;
  const pad=i=>String(i).padStart(2,'0');
  const relative=p=>p.seen==null?'Not shared':p.seen===n()?'With you':Math.abs(p.seen-n())+(p.seen>n()?' ahead':' behind');
  const person=(p,body='',cls='')=>`<button class="bn-person ${cls}" data-action="result-person" data-user="${esc(p.userId)}" data-episode="${n()}">${body||`${portrait(p)}<b>${esc(name(p))}</b>`}</button>`;
  const allPeople=()=>[{userId:a.data().context.userId,you:true,seen:n()},...friends()];
  const update=`<span class="bn-update">Update ${icon('down')}</span>`;
  const watch=()=>`<div class="bn-watch">${available()?btn(icon('play')+(live()?` Join watch along · E${next()}`:` Start watching · E${next()}`),'watch',next(),'primary'):`<p>Next release <b>${esc(a.date(next()))}</b></p>`}${available()&&!live()?btn(`I watched episode ${next()}`,'watched',next(),'quiet'):''}</div>`;
  function season(v){
    if(v===1)return `<div class="bn-premiere"><button class="bn-cinema" data-action="episodes"><img class="bn-cinema-art" src="${showArt()}" alt=""><span class="bn-cinema-brand">${esc(s().show.name)}<small>Season ${s().seasonNumber}</small></span><span class="bn-cinema-story"><span>${live()?'On now':'Your next episode'}</span><strong>${title(next())?esc(title(next())):`Episode<br><em>${pad(next())}</em>`}</strong><span class="bn-cinema-date">${esc(a.date(next()))}</span></span><span class="bn-cinema-foot"><span>Last watched <b>E${n()}</b><small>${esc(base.progress())}</small></span>${update}</span></button>${watch()}</div>`;
    if(v===2){
      const after=s().schedule.episodes.find(e=>e.number===next()+1);
      return `<div class="bn-splice"><button class="bn-splice-body" data-action="episodes"><span class="bn-splice-top"><b>Your season.<br>Your speed.</b><span>${esc(base.progress())}</span></span><span class="bn-guide-row bn-guide-past"><span class="bn-guide-number">${pad(n())}</span><span><small>LAST WATCHED</small><b>${esc(title(n())||a.date(n()))}</b></span>${icon('check')}</span><span class="bn-guide-row bn-guide-now"><span class="bn-guide-number">${pad(next())}</span><span><small>${live()?'ON NOW':'NEXT TO WATCH'}</small><b>${esc(title(next())||a.date(next()))}</b></span>${icon('play')}</span>${after?`<span class="bn-guide-row bn-guide-later"><span class="bn-guide-number">${pad(after.number)}</span><span><small>AFTER THAT</small><b>${esc(after.title||a.date(after.number))}</b></span></span>`:''}<span class="bn-splice-bottom"><span>Episode numbers shown at left</span>${update}</span></button>${watch()}</div>`;
    }
    const count=Math.min(18,released());
    return `<div class="bn-passport"><button class="bn-passport-body" data-action="episodes"><span class="bn-passport-art"><img src="${showArt()}" alt=""><strong>${esc(s().show.name)}</strong><span>SEASON ${s().seasonNumber}</span></span><span class="bn-passport-head"><b>Your place<br>in the story.</b><span class="bn-stamp">LAST<br>WATCHED<strong>E${n()}</strong></span></span><span class="bn-passport-track" aria-label="${n()} of ${released()} released episodes watched">${Array.from({length:count},(_,i)=>`<i class="${i<n()/released()*count?'bn-filled':''}"></i>`).join('')}</span><span class="bn-passport-status">${esc(base.progress())}<small>${n()} watched / ${released()} released</small></span><span class="bn-passport-next"><span>${live()?'On now':'Next to watch'}<strong>${esc(ep(next()))}</strong><small>${esc(a.date(next()))}</small></span>${update}</span></button>${watch()}</div>`;
  }
  function sofa(){return `<svg class="bn-sofa" viewBox="0 0 360 125" aria-hidden="true"><defs><linearGradient id="sofa-back" x2="0" y2="1"><stop stop-color="#51415f"/><stop offset="1" stop-color="#30293b"/></linearGradient><linearGradient id="sofa-seat" x2="0" y2="1"><stop stop-color="#796984"/><stop offset="1" stop-color="#493d57"/></linearGradient></defs><path d="M34 78V34Q34 8 61 8H298Q326 8 326 34V78" fill="url(#sofa-back)" stroke="#927e9c" stroke-width="1.5"/><path d="M22 75Q22 58 40 58H320Q339 58 339 75V103H22Z" fill="url(#sofa-seat)" stroke="#927e9c" stroke-width="1.5"/><path d="M13 101V55Q13 44 26 44Q40 44 40 58V99M347 101V55Q347 44 334 44Q320 44 320 58V99" fill="#5c4b68" stroke="#b9a1c0" stroke-width="1.5"/><path d="M25 103H335M115 60V99M240 60V99" stroke="#2b2336" stroke-width="2"/><path d="M37 105V119M321 105V119" stroke="#ffc531" stroke-width="7" stroke-linecap="round"/></svg>`;}
  const paceFooter=`<button class="bn-pace-open" data-action="friends">Open everyone’s progress ${icon('next')}</button>`;
  function pace(v){
    const ps=friends();
    if(!ps.length)return `<div class="bn-lounge bn-empty-lounge"><h3>Your seat<br>is saved.</h3>${sofa()}<p>No one else on this couch yet. Keep watching at your own pace.</p><a href="${a.route('chat')}" target="_blank" rel="noopener">Open your couch ${icon('next')}</a></div>`;
    if(v===1)return `<div class="bn-lounge"><div class="bn-lounge-head"><h3>Same show.<br>Different<br><em>bedtimes.</em></h3><img src="/art/generated/tv-companion-v1.png" alt="Decorative TV companion"></div><div class="bn-seats"><div class="bn-seat-people">${ps.slice(0,3).map(p=>person(p,`<span class="bn-seat-face">${portrait(p)}</span><b>${esc(name(p))}</b><small>E${p.seen??'?'}</small>`,'bn-seat')).join('')}</div>${sofa()}</div><div class="bn-seat-labels">${ps.slice(0,3).map(p=>`<span><b>${esc(name(p))}</b><small>${esc(relative(p))}</small></span>`).join('')}</div><div class="bn-lounge-you">${a.avatar('Alex')}<span>You’re on <b>Episode ${n()}</b></span><span>${ps.length} ${ps.length===1?'friend':'friends'} watching</span></div>${paceFooter}</div>`;
    if(v===2){
      const groups=[...new Set(allPeople().filter(p=>p.seen!=null).map(p=>p.seen))].sort((x,y)=>x-y);
      return `<div class="bn-chapters"><h3>One show.<br><em>Different chapters.</em></h3><div class="bn-chapter-wall">${groups.map(number=>`<section class="bn-chapter ${number===n()?'is-yours':''}"><span class="bn-chapter-episode">EP.<strong>${pad(number)}</strong></span><div class="bn-chapter-people">${allPeople().filter(p=>p.seen===number).map(p=>person(p,`<span>${portrait(p)}</span><b>${esc(name(p))}</b>`)).join('')}</div><span class="bn-chapter-relative">${number===n()?'YOUR CHAPTER':number<n()?(n()-number)+' BEHIND':(number-n())+' AHEAD'}</span></section>`).join('')}</div><p class="bn-chapter-note">Last watched positions. No game results revealed.</p>${ps.some(p=>p.seen==null)?'<p class="bn-fine">Some friends haven’t shared their position.</p>':''}${paceFooter}</div>`;
    }
    const target=talking??n(),seen=ps.filter(p=>p.seen>=target).length;
    return `<div class="bn-tuner"><div class="bn-tuner-head"><h3>Who’s seen<br><em>this one?</em></h3><label>Episode <select data-lab-control="bold-conversation">${s().schedule.episodes.filter(e=>e.number<=released()).map(e=>`<option value="${e.number}" ${e.number===target?'selected':''}>${esc(ep(e.number))}</option>`).join('')}</select></label></div><div class="bn-tuner-portraits">${ps.slice(0,3).map(p=>`<div class="bn-tuner-person ${p.seen>=target?'has-seen':'not-seen'}">${person(p,`<span class="bn-tuner-face">${portrait(p)}</span><b>${esc(name(p))}</b>`)}<span class="bn-tuner-status">${p.seen==null?'Unknown':p.seen>=target?icon('check')+' Seen it':'Not there yet'}</span><small>Last watched E${p.seen??'?'}</small></div>`).join('')}</div><div class="bn-tuner-bottom"><strong>${seen}<span> of ${ps.length} friends<br>have reached E${target}</span></strong><button data-action="friends">See everyone ${icon('next')}</button></div><p class="bn-fine">Viewing progress only. Freeform messages can still contain spoilers.</p></div>`;
  }
  function info(g){
    const last=Math.min(n(),r().mark(g)),source=r().source(g,last),rows=r().rows(g,last),me=rows.find(p=>p.you),hidden=r().mark(g)<n()&&!g.over;
    return {g,last,source,rows,me,hidden,metric:p=>hidden?{hidden:true,label:'Reveal episode '+n()}:p?r().metric(g,p,last):{missing:true,label:'No captured result'}};
  }
  function value(i,p,cls=''){
    const m=i.metric(p);
    return `<button class="bn-value ${cls} ${m.hidden?'is-hidden':''}" data-action="${i.hidden?'result-gate':m.hidden||m.missing?'result-person':'result-score'}" data-user="${esc(p?.userId||'')}" data-game="${i.g.leagueId}" data-episode="${i.hidden?n():i.last}">${m.hidden?icon('lock'):''}<strong ${Number.isFinite(m.value)?`data-bold-score="${m.value}"`:''}>${esc(m.label)}</strong>${!m.hidden?icon('next'):''}</button>`;
  }
  function cast(i,p){
    const m=i.metric(p);if(m.hidden||m.missing)return [];
    return m.person?[m.person]:m.week?(m.week.started||[]).map(c=>({...i.source.cast?.find(x=>x.id===c.id),points:c.points})).filter(c=>c.name):(m.play?.held||p?.team||[]).map(id=>i.source.cast?.find(c=>c.id===id)).filter(Boolean);
  }
  const castButton=(c,i,extra='')=>`<button class="bn-cast ${extra}" data-action="result-cast" data-name="${esc(c.name)}" data-game="${i.g.leagueId}" data-episode="${i.last}"><img src="${esc(c.photo||'')}" alt=""><span><b>${esc(c.name.split(' ')[0])}</b>${c.points!=null?`<strong>${c.points>0?'+':''}${c.points}<small>PTS</small></strong>`:''}</span></button>`;
  const gameLink=g=>`<a href="${a.route('game/'+g.leagueId)}" target="_blank" rel="noopener">${esc(a.gameLabel(g))} ${icon('external')}</a>`;
  const gameFooter=()=>`<div class="bn-games-open"><button data-action="result-summary" data-episode="${n()}">All episode ${n()} results ${icon('next')}</button><a href="${a.route('games')}" target="_blank" rel="noopener">Full games ${icon('external')}</a></div>`;
  function gamePicker(g){return `<label class="bn-game-picker">Game <select data-lab-control="bold-game">${a.games().map(x=>`<option value="${x.leagueId}" ${x.leagueId===g.leagueId?'selected':''}>${esc(a.gameLabel(x))}</option>`).join('')}</select></label>`;}
  function games(v){
    if(!a.isPlayer())return `<div class="bn-no-games"><img src="/art/generated/tv-companion-v1.png" alt=""><h3>Front-row seat.<br>No picks required.</h3><p>Watching, reactions and your couch are a complete night.</p><a href="${a.route('games')}" target="_blank" rel="noopener">Feeling game? ${icon('next')}</a></div>`;
    const items=a.games().map(info),roster=[...new Map(items.flatMap(i=>i.rows).filter(p=>!p.you).map(p=>[p.userId,p])).values()];
    const rival=roster.find(p=>p.userId===rivalId)||roster.find(p=>items.some(i=>{const row=i.rows.find(x=>x.userId===p.userId);return row&&!i.metric(row).hidden;}))||roster[0];rivalId=rival?.userId;
    if(v===1)return `<div class="bn-scorecast"><header class="bn-scorecast-title"><h3>The night.<br><em>By the numbers.</em></h3><span>EPISODE<strong>${pad(n())}</strong></span></header><div class="bn-scorecast-rows">${items.map(i=>{const my=i.metric(i.me),other=i.rows.find(p=>p.userId===rivalId),theirs=i.metric(other),faces=cast(i,i.me);return `<section class="bn-scorecast-game"><header>${gameLink(i.g)}<span>${i.g.gameType==='pickem'?'SURVIVAL':i.g.lineup?'LINEUP POINTS':'EPISODE RESULT'}</span></header><div class="bn-on-air-scores"><div><span>YOU</span>${value(i,i.me,'is-you')}</div><div><span>${rival?esc(rival.name.toUpperCase()):'COUCH'}</span>${value(i,other)}</div></div>${faces.length?`<div class="bn-scorecast-picks">${faces.slice(0,3).map(c=>castButton(c,i)).join('')}</div>`:''}${my.hidden?'':Number.isFinite(my.value)&&Number.isFinite(theirs.value)&&my.value>=0&&theirs.value>=0?`<div class="bn-result-channel" aria-label="${esc(my.label)} versus ${esc(theirs.label)}"><i style="--share:${Math.abs(my.value)/Math.max(.001,Math.abs(my.value)+Math.abs(theirs.value))*100}%"></i></div>`:''}</section>`;}).join('')}</div><p class="bn-fine">Each row is a separate game. Scores are not added together.</p>${gameFooter()}</div>`;
    if(v===2){
      const i=items.find(i=>i.g.leagueId===featured)||items.find(i=>i.g.lineup)||items[0];featured=i.g.leagueId;
      const faces=cast(i,i.me),pool=i.g.gameType==='pickem';
      return `<div class="bn-cast-night">${gamePicker(i.g)}<header class="bn-cast-heading"><h3>${pool?'One pick.<br><em>All the nerve.</em>':'Your picks.<br><em>Their big night.</em>'}</h3><span>E${i.hidden?n():i.last}</span></header>${faces.length?`<div class="bn-trading-wall ${pool?'is-pool':''}">${faces.slice(0,4).map(c=>castButton(c,i)).join('')}</div>`:`<div class="bn-unavailable">${icon(i.hidden?'lock':'shield')}<p>${i.hidden?'This episode’s cast, choices and results stay behind the reveal.':'Captured total below. Individual contributions are not in this dataset.'}</p></div>`}<div class="bn-cast-total"><span>Your ${pool?'survival pick':'episode score'}</span>${value(i,i.me,'is-you')}</div><div class="bn-cast-opponents">${i.rows.filter(p=>!p.you).map(p=>`<div>${person(p)}${value(i,p)}</div>`).join('')}</div>${gameFooter()}</div>`;
    }
    if(!rival)return `<div class="bn-solo"><h3>Just you.<br><em>All the payoff.</em></h3>${items.map(i=>`<div>${gameLink(i.g)}${value(i,i.me)}</div>`).join('')}${gameFooter()}</div>`;
    return `<div class="bn-versus"><header><h3>A little friendly<br><em>competition.</em></h3><label>Compare with <select data-lab-control="bold-rival">${roster.map(p=>`<option value="${p.userId}" ${p.userId===rivalId?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label></header><div class="bn-versus-stage"><div class="bn-versus-player you">${person({userId:a.data().context.userId,you:true},`<span>${a.avatar('Alex')}</span><b>YOU</b>`)}</div><span class="bn-vs">VS<small>E${n()}</small></span><div class="bn-versus-player rival">${person(rival,`<span>${portrait(rival)}</span><b>${esc(rival.name.toUpperCase())}</b>`)}</div></div><div class="bn-versus-results">${items.map(i=>{const them=i.rows.find(p=>p.userId===rivalId),my=i.metric(i.me),other=i.metric(them);return `<section class="bn-duel-game"><div>${gameLink(i.g)}</div><div class="bn-duel-values">${value(i,i.me,'is-you')}${value(i,them)}</div>${my.person||other.person?`<div class="bn-duel-picks"><span>${my.person?esc(my.person.name):''}</span><span>${other.person?esc(other.person.name):''}</span></div>`:''}</section>`;}).join('')}</div><p class="bn-fine">Episode ${n()} comparisons only. Unshared choices remain hidden.</p>${gameFooter()}</div>`;
  }
  function animate(root,force=false){
    observer?.disconnect();
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const run=element=>{
      if(element.dataset.boldPlayed&&!force)return;element.dataset.boldPlayed='true';
      if(element.matches('[data-bold-score]')){
        const value=Number(element.dataset.boldScore),original=(value>0?'+':'')+String(value),start=performance.now(),runId={};scoreRuns.set(element,runId);element.setAttribute('aria-label',original);
        const tick=now=>{if(!element.isConnected||scoreRuns.get(element)!==runId)return;const t=Math.min(1,(now-start)/620);element.textContent=t===1?original:(value>0?'+':'')+(value*(1-Math.pow(1-t,4))).toFixed(1);if(t<1)requestAnimationFrame(tick);};requestAnimationFrame(tick);
        element.animate([{clipPath:'inset(0 0 85% 0)',filter:'brightness(1.8)'},{clipPath:'inset(0)',filter:'brightness(1)'}],{duration:620,easing:'cubic-bezier(.16,1,.3,1)'});
      }else element.animate([{clipPath:'inset(0 100% 0 0)'},{clipPath:'inset(0)'}],{duration:700,easing:'cubic-bezier(.16,1,.3,1)'});
    };
    observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){run(e.target);observer.unobserve(e.target);}},{threshold:.5});
    root.querySelectorAll('[data-bold-score],.bn-result-channel>i').forEach(el=>observer.observe(el));
  }
  document.addEventListener('click',e=>{if(e.target.closest('[data-bold-replay]'))animate(document.getElementById('app'),true);});
  return {
    id:'bold-round2',
    concepts:{
      season:[['Original','Current V4','The current control, unchanged.'],['A','The premiere frame','Cinematic key art and opening-credit typography, with one clear episode control.'],['B','The episode splice','A compact TV-guide cut: last watched, next up, then what follows.'],['C','Your season passport','A printed watch record: warm paper, a season stamp and a bold next-episode handoff.']],
      pace:[['Original','Current V4','The current face-and-episode strip, unchanged.'],['A','The viewing lounge','Friends have actual seats on the couch. Their episode marks stay front and center.'],['B','Different chapters','A graphic poster wall groups faces by their real last-watched episode.'],['C','Who’s seen this one?','An episode tuner and expressive portrait strip show who has reached the same story.']],
      games:[['Original','Current V4','The current game minis, unchanged.'],['A','The score broadcast','An entertainment broadcast: chunky game scores, visible picks and the couch beside you.'],['B','Cast in the spotlight','Trading-card portraits turn lineup contributions into the stars of the result.'],['C','Friendly competition','A bold split-color showdown, with real game-specific comparisons and protected results.']]
    },
    render:(kind,v)=>kind==='season'?season(v):kind==='pace'?pace(v):games(v),
    change:(control,value)=>{if(control==='bold-game')featured=value;if(control==='bold-rival')rivalId=value;if(control==='bold-conversation')talking=Number(value);},
    onMount:root=>animate(root)
  };
};
