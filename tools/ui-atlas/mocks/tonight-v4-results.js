/* V3 review-only result presentation. Captured metrics are never recomputed
   from local picks. Visibility here is a conservative fixture adapter, not auth. */
window.TonightResults = function (a) {
  const {esc,icon,btn,link}=a,$=id=>document.getElementById(id);
  let gate=null,story=null;
  const games=()=>a.games(),state=()=>a.state(),game=id=>games().find(g=>g.leagueId===id);
  const mark=g=>state().gameMarks?.[g.leagueId]??g.through??0;
  const captured=n=>state().revealPayloads?.[n];
  const source=(g,n)=>captured(n)?.games.find(x=>x.leagueId===g.leagueId)||g;
  const episode=n=>captured(n)?.episode||a.episodes().episodes.find(e=>e.number===n);
  const signed=n=>n>0?'+'+n:String(n);
  const visible=(g,p,n)=>{
    if(mark(g)<n||n>a.state().seen)return false;
    if(p.you)return true;
    if(!g.ownPace && (g.through??0)>=n)return true;
    // A pace week is the person's NEXT game episode. Missing metadata is unknown,
    // never replaced with watched progress or a later table row's presence.
    const other=g.pace?.others?.find(o=>o.name===p.name);
    return typeof other?.week==='number' && other.week-1>=n;
  };
  const rows=(g,n)=>(source(g,n).table||[]);
  const player=(g,id,n)=>rows(g,n).find(p=>p.userId===id||p.playerId===id||p.name===id||(id==='You'&&p.you));
  const cast=(g,id,n)=>(source(g,n).cast||g.cast||[]).find(c=>c.id===id);
  function metric(g,p,n){
    if(!visible(g,p,n))return {hidden:true,label:'Not shared yet'};
    if(g.gameType==='pickem'){
      const pick=p.picks?.find(x=>x.episode===n);
      if(!pick)return {missing:true,label:'No captured result'};
      const c=cast(g,pick.castawayId,n);
      return {label:!pick.castawayId?'No pick':pick.correct?'Survived':'Pick out',pick,person:c};
    }
    const week=p.weeks?.find(w=>w.episode===n),play=source(g,n).plays?.rows?.[p.playerId]?.find(w=>w.episode===n);
    return week?{label:signed(week.total),value:week.total,week}:Number.isFinite(play?.points)?{label:signed(play.points),value:play.points,play}:{missing:true,label:'No captured score'};
  }
  function insight(g,n){
    if(mark(g)<n)return `<button class="result-inline" data-action="result-gate" data-game="${g.leagueId}" data-episode="${n}">E${n} results hidden · Reveal</button>`;
    const me=rows(g,n).find(p=>p.you),other=rows(g,n).find(p=>!p.you&&visible(g,p,n));if(!me)return '';
    const m=metric(g,me,n),o=other&&metric(g,other,n);
    return `<div class="last-game-result"><button data-action="result-summary" data-game="${g.leagueId}" data-episode="${n}" aria-label="Episode ${n} ${esc(a.gameLabel(g))} result: ${esc(m.label)}">E${n} · You ${esc(m.label)}</button>${other?`<button data-action="result-person" data-user="${esc(other.userId)}" data-game="${g.leagueId}" data-episode="${n}">${esc(other.name)} ${esc(o.label)}</button>`:''}</div>`;
  }
  function applies(g,n){return (!g.from||g.from<=n)&&(!g.to||n<=g.to)&&!(g.over&&(g.through||0)<n);}
  function pending(n){return games().filter(g=>applies(g,n)&&mark(g)<n);}
  function scopeHint(scope,n){return scope.map(id=>a.gameLabel(game(id))).join(', ')+` · Episode ${n}`;}
  function openGate(n){
    if(!pending(n).length){openShowcase(n,undefined,true);return;}
    if(n!==3){a.openSheet(`Episode ${n} results`,`<p class="sheet-lead">Episode ${n} results are not included in this review. The recorded episode 3 situation demonstrates the complete reveal.</p>`,'result-unavailable');return;}
    gate={n,mode:'showcase',scope:games().map(g=>g.leagueId)};drawGate();
  }

  function drawGate(){
    const n=gate.n;
    a.openSheet(`Reveal episode ${n}?`,`<div class="reveal-wide-art"><img src="/art/generated/island-night-v1.png" alt=""><h3>Last time on<br>${esc(a.space().show.name)}.</h3></div><p class="sheet-lead">Open episode ${n} across <b>all ${games().length} of your games</b>. Your results, the couch’s choices, and the episode’s big moments.</p><p class="reveal-game-names">${games().map(g=>esc(a.gameLabel(g))).join(' · ')}</p><div class="sheet-footer"><button class="button primary" id="confirm-result" data-action="result-confirm" data-mode="showcase">${icon('play')} Reveal & play recap</button></div><button class="text-action summary-shortcut" data-action="result-confirm" data-mode="summary">Just show the results</button><p class="privacy-note">You’ve marked this episode watched. Revealing opens its results in every game; closing this screen changes nothing.</p>`,'result-gate');
  }

  async function confirm(mode='showcase'){
    if(!gate)return;const selected={n:gate.n,mode,scope:games().map(g=>g.leagueId)},button=$('confirm-result');button.disabled=true;button.textContent='Getting your night ready…';
    try{const response=await fetch('/__atlas/mock/tonight-reveal-episode3.json');if(!response.ok)throw Error('The recorded reveal could not load.');const payload=await response.json();if(payload.episode.number!==selected.n)throw Error('Episode mismatch.');state().revealPayloads ||= {};state().revealPayloads[selected.n]=payload;state().gameMarks ||= {};for(const g of games())state().gameMarks[g.leagueId]=Math.max(mark(g),selected.n);state().episodeReveal=selected.n;a.persist();a.render();if(mode==='showcase')openShowcase(selected.n,undefined,false,true);else openSummary(selected.n,null,true);}catch(error){button.disabled=false;button.textContent='Try again';a.toast(error.message);}
  }

  function resultCards(n,ids=games().map(g=>g.leagueId)){
    return ids.map(id=>{const g=game(id);if(!g)return '';if(mark(g)<n)return `<article class="result-card hidden-result"><h3>${esc(a.gameLabel(g))}</h3><p>Episode ${n} results are hidden.</p>${btn('Choose how to reveal','result-gate', '', 'quiet').replace('data-value=""',`data-game="${id}" data-episode="${n}"`)}</article>`;
      const me=rows(g,n).find(p=>p.you),m=me&&metric(g,me,n);return `<article class="result-card"><div class="result-card-title"><button data-action="result-game" data-game="${id}" data-episode="${n}">${esc(a.gameLabel(g))} ${icon('next')}</button><span>${g.gameType==='pickem'?'Survival pick':'Episode points'}</span></div>${me?`<button class="your-result" data-action="result-score" data-game="${id}" data-user="${esc(me.userId)}" data-episode="${n}"><span>You</span><b>${esc(m.label)}</b>${icon('next')}</button>${m.person?`<button class="result-cast-link" data-action="result-cast" data-name="${esc(m.person.name)}" data-game="${id}" data-episode="${n}"><img src="${esc(m.person.photo)}" alt="">${esc(m.person.name)} ${icon('next')}</button>`:''}`:'<p>No captured personal result.</p>'}${comparison(g,n)}</article>`;}).join('');
  }
  function comparison(g,n){
    const ps=rows(g,n),shown=ps.filter(p=>visible(g,p,n)),me=shown.find(p=>p.you);
    const values=shown.map(p=>metric(g,p,n).value).filter(x=>typeof x==='number');const max=Math.max(1,...values.map(Math.abs));
    return `<div class="episode-comparison" data-comparison-game="${g.leagueId}"><p>Episode ${n} comparison · ${shown.length} of ${ps.length} shared</p>${ps.map(p=>{const m=metric(g,p,n);return `<div class="comparison-row ${p.you?'is-you':''}" data-result-user="${esc(p.name)}" data-visible-result="${!m.hidden}"><button class="person-link" data-action="result-person" data-user="${esc(p.userId)}" data-game="${g.leagueId}" data-episode="${n}">${a.avatar(p.name)}<span>${esc(p.you?'You':p.name)}</span></button>${m.hidden?'<span class="result-private">Not shared yet</span>':`<button class="result-value" data-action="result-score" data-game="${g.leagueId}" data-user="${esc(p.userId)}" data-episode="${n}">${typeof m.value==='number'?`<span class="comparison-bar" data-stat-bar data-stat-key="compare-${g.leagueId}-${p.userId}-${n}-${performance.now()}" style="width:${Math.max(2,Math.abs(m.value)/max*100)}%"></span>`:''}<b>${esc(m.label)}</b>${icon('next')}</button>`}</div>`;}).join('')}<p class="privacy-note">Only shared results for this episode. Other players’ results appear when they’ve revealed it.</p></div>`;
  }
  function openSummary(n,id,replace=false){
    const g=id&&game(id);
    const someRevealed=(g?[g]:games()).some(x=>mark(x)>=n);
    a.openSheet(g?`${a.gameLabel(g)} · Episode ${n}`:`Episode ${n} · Your results`,`<div class="summary-toolbar"><p>${someRevealed?esc(episode(n)?.stage==='early'?'Provisional results · may change':'Final results'):'Results hidden'}</p><button class="button quiet" data-action="${someRevealed?'result-showcase':'result-gate'}" data-episode="${n}" ${id?`data-game="${id}"`:''}>${icon('play')} ${someRevealed?'Replay showcase':'Choose how to reveal'}</button></div>${resultCards(n,id?[id]:undefined)}${pending(n).length&&someRevealed?`<button class="button quiet" data-action="result-gate" data-episode="${n}">Reveal episode ${n} across all games</button>`:''}<div class="sheet-footer"><button class="button quiet" data-action="result-recap" data-episode="${n}">Episode ${n} recap</button>${btn('React with a GIF','gifs','','quiet')}</div><p class="privacy-note">Tap a person, result or cast member for detail.</p>`, 'result-summary',replace);
  }
  function openEpisodeRecap(n){
    if(games().length&&games().every(g=>mark(g)<n)){a.openSheet(`Episode ${n} recap`,'<p class="sheet-lead">Reveal this episode in a game before opening its recap.</p>','result-recap');return;}
    const e=episode(n);a.openSheet(`Episode ${n} recap`,`<div class="showcase-out">${(e?.out||[]).map(c=>`<button data-action="result-cast" data-name="${esc(c.name)}" data-episode="${n}"><img src="${esc(c.photo)}" alt=""><b>${esc(c.name)}</b><small>${esc(c.method)}</small></button>`).join('')}</div>${(e?.happened||[]).map(h=>`<p class="showcase-moment">${esc(h.winners.map(w=>w.name).join(', '))} · ${esc(h.label)}</p>`).join('')}<div class="sheet-footer"><button class="button quiet" data-action="result-summary" data-episode="${n}">Your game results</button>${btn('React with a GIF','gifs','','primary')}</div>`,'result-recap');
  }
  function showPerson(id,n,gid){
    const person=a.space().people.find(p=>p.userId===id||a.nameOf(p)===id)||(id==='You'?a.space().people.find(p=>p.userId===a.data().context.userId):null);
    const name=person?a.nameOf(person):id;
    a.openSheet(name,`<div class="person-identity">${a.avatar(name)}<div><h3>${esc(name)}</h3><p>${person?.seen!=null?'Last watched episode '+person.seen:person?.userId===a.data().context.userId?'Last watched episode '+state().seen:'Watching progress not shared'}</p></div></div><h3>Episode ${n} games</h3>${games().filter(g=>!gid||g.leagueId===gid).map(g=>{const p=player(g,id,n)||player(g,name,n);if(!p)return '';const m=metric(g,p,n);return `<div class="profile-game"><button data-action="result-game" data-game="${g.leagueId}" data-episode="${n}">${esc(a.gameLabel(g))}</button>${m.hidden?'<span>Result not shared yet</span>':`<button class="result-value" data-action="result-score" data-user="${esc(p.userId)}" data-game="${g.leagueId}" data-episode="${n}">${esc(m.label)} ${icon('next')}</button>`}</div>`;}).join('')}<div class="sheet-footer">${btn('Discuss episode '+state().seen,'chat','','quiet')}</div>`, 'result-person');
  }
  function showCast(name,n,gid){
    const g=gid&&game(gid),s=a.stats()?.cast?.find(c=>c.name===name),c=(g?source(g,n).cast:games().flatMap(g=>source(g,n).cast||[]))?.find(c=>c.name===name),out=episode(n)?.out?.find(c=>c.name===name);
    const events=(s?.events||[]).filter(e=>e[0]<=Math.min(n,a.initialSeen()));
    const counts={};events.forEach(e=>counts[e[1]]=(counts[e[1]]||0)+(e[3]??1));
    a.openSheet(name,`<div class="cast-identity">${c?.photo||out?.photo?`<img src="${esc(c?.photo||out.photo)}" alt="">`:''}<div><h3>${esc(name)}</h3><p>Show facts through episode ${Math.min(n,a.initialSeen())}</p></div></div>${events.length?`<div class="fact-list">${Object.entries(counts).map(([kind,count])=>`<div><span>${esc(kind.replace(/([A-Z])/g,' $1'))}</span><b>${esc(count)}</b></div>`).join('')}</div>`:'<p class="sheet-lead">No additional captured show moments through this boundary.</p>'}${g?`<p class="privacy-note">Game context: ${esc(a.gameLabel(g))}. Fantasy contributions depend on that game’s rules and lineup.</p>`:''}<div class="sheet-footer">${link('Full cast & show statistics '+icon('external'),a.route('cast'),'quiet')}${g?link('Open this game '+icon('external'),a.route('game/'+g.leagueId),'quiet'):''}</div>`, 'result-cast');
  }
  function showScore(gid,id,n){
    const g=game(gid),p=g&&player(g,id,n);if(!g||!p)return;const m=metric(g,p,n);
    if(m.hidden){showPerson(id,n,gid);return;}
    const name=p.you?'Your':p.name+'’s';
    let html;
    if(g.gameType==='pickem')html=`<p class="score-total">${esc(m.label)}</p>${m.person?`<button class="cast-contribution" data-action="result-cast" data-name="${esc(m.person.name)}" data-game="${gid}" data-episode="${n}"><img src="${esc(m.person.photo)}" alt=""><span><b>${esc(m.person.name)}</b><small>Picked to survive episode ${n}</small></span>${icon('next')}</button>`:'<p class="sheet-lead">No castaway was picked for this episode.</p>'}`;
    else if(m.week){const block=(list,label,excluded)=>`<h3>${label}</h3>${list.map(x=>{const c=cast(g,x.id,n);return `<div class="contribution-row"><button class="cast-contribution" data-action="result-cast" data-name="${esc(c?.name||'Captured participant')}" data-game="${gid}" data-episode="${n}">${c?.photo?`<img src="${esc(c.photo)}" alt="">`:''}<span><b>${esc(c?.name||'Captured participant')}</b><small>${esc((x.why||[]).join(' · ')||'No recorded scoring moments')}</small></span></button><button class="contribution-points" data-action="result-moments" data-game="${gid}" data-user="${esc(id)}" data-cast="${esc(x.id)}" data-episode="${n}">${esc(signed(x.points))}${excluded?' · excluded':''}</button></div>`;}).join('')}`;html=`<p class="score-total">${esc(m.label)} <small>episode points</small></p>${block(m.week.started||[],'Starting lineup',false)}${m.week.bench?.length?block(m.week.bench,'Bench · does not count',true):''}${m.week.predictions?`<p>Predictions: ${signed(m.week.predictions)}</p>`:''}`;}else if(m.play)html=`<p class="score-total">${esc(m.label)} <small>episode points</small></p><p class="sheet-lead">${g.bingo?'Bingo card result':g.sheet?'Prediction result':'Game result'} for episode ${n}.</p><p class="privacy-note">This game history provides the episode total. Individual card squares, answers or contribution values are not included in this capture.</p>`;else html='<p class="sheet-lead">A score breakdown is not in this capture.</p>';
    a.openSheet(`${name} episode ${n}`,`<p class="sheet-lead">${esc(a.gameLabel(g))}</p>${html}<div class="sheet-footer">${link('Full game & history '+icon('external'),a.route('game/'+gid),'quiet')}</div>`, 'result-score');
  }
  function showMoments(gid,id,cid,n){
    const g=game(gid),p=player(g,id,n),m=p&&metric(g,p,n);if(!m?.week)return;
    const item=[...(m.week.started||[]),...(m.week.bench||[])].find(x=>x.id===cid),c=cast(g,cid,n);if(!item)return;
    a.openSheet(`${c?.name||'Participant'} · Contribution`,`<p class="score-total">${signed(item.points)} <small>captured game points</small></p><ul class="captured-reasons">${(item.why||[]).map(w=>`<li>${esc(w)}</li>`).join('')||'<li>No captured scoring moments.</li>'}</ul><p class="privacy-note">The capture records the total contribution and its reasons. It does not split the value between individual reasons. Bench contributions do not count toward the starting lineup total.</p><div class="sheet-footer">${link('Inspect game rules & metrics '+icon('external'),a.route('game/'+gid),'quiet')}</div>`, 'result-moments');
  }
  function openShowcase(n,ignored,replay=true,replace=false){
    if(pending(n).length){openGate(n);return;}
    story={n,scope:games().filter(g=>applies(g,n)).map(g=>g.leagueId),replay,k:0,compare:games()[0]?.leagueId};drawShowcase(replace);
  }

  function drawShowcase(replace=true){
    const {n,scope,replay,k}=story,e=episode(n),chapters=chapterList(),chapter=chapters[k],sport=/sport/i.test(a.space().show.kind),name=a.space().show.name;
    let html='';
    if(chapter.type==='intro')html=`<div class="recap-opener"><img src="${esc(a.space().show.artUrl||'/art/generated/island-night-v1.png')}" alt=""><div><p>${sport?'Your last event':'Episode '+n} · Season ${a.space().seasonNumber}</p><h3>${sport?'Last time out.':'Last time on'}<em>${esc(name)}${sport?'':'.'}</em></h3><span>${replay?'Your night, again.':'The moments. The picks. The payoff.'}</span></div></div>`;
    if(chapter.type==='episode')html=`<div class="recap-event-heading"><h3>${e?.out?.length===2?'Two exits.<br>One episode.':'The moments that mattered.'}</h3><p>${sport?'Event':'Episode'} ${n} · ${esc(e?.stage==='early'?'Early results':'What happened')}</p></div><div class="recap-cast-wall">${(e?.out||[]).map(c=>`<button data-action="result-cast" data-name="${esc(c.name)}" data-episode="${n}"><img src="${esc(c.photo)}" alt=""><span><b>${esc(c.name)}</b><small>${esc(c.method)}</small>${icon('next')}</span></button>`).join('')}</div>${(e?.happened||[]).map(h=>`<p class="recap-moment"><strong>${esc(h.winners.map(w=>w.name).join(', '))}</strong><span>${esc(h.label)}</span></p>`).join('')}`;
    if(chapter.type==='game'){
      const g=game(chapter.id),p=rows(g,n).find(p=>p.you),m=p&&metric(g,p,n),src=source(g,n),faces=m?.person?[{...m.person,points:null}]:(m?.week?.started||[]).map(x=>({...src.cast?.find(c=>c.id===x.id),points:x.points})).filter(c=>c.name);
      html=`<div class="game-broadcast ${g.gameType==='pickem'?'survival-broadcast':'points-broadcast'}"><a class="broadcast-game-name" href="${a.route('game/'+g.leagueId)}" target="_blank" rel="noopener">${esc(a.gameLabel(g))} ${icon('external')}</a><button class="broadcast-score" data-action="result-score" data-game="${g.leagueId}" data-user="${esc(p?.userId)}" data-episode="${n}"><span>${g.gameType==='pickem'?'Your survival pick':'Your episode '+n+' points'}</span><strong ${typeof m?.value==='number'?`data-count="${m.value}" data-stat-key="story-${g.leagueId}-${n}-${performance.now()}"`:''}>${esc(m?.label||'No result captured')}</strong>${icon('next')}</button><div class="broadcast-lineup">${faces.map(c=>`<button data-action="result-cast" data-name="${esc(c.name)}" data-game="${g.leagueId}" data-episode="${n}"><img src="${esc(c.photo)}" alt=""><span><b>${esc(c.name.split(' ')[0])}</b>${c.points!=null?`<strong>${signed(c.points)}</strong>`:''}</span></button>`).join('')}</div><p class="broadcast-footnote">${m?.week?.bench?.length?m.week.bench.length+' on the bench · excluded from this score.':'Tap a player or score to see the story behind it.'}</p></div>`;
    }
    if(chapter.type==='couch'){const g=game(story.compare);html=`<h3 class="broadcast-heading">Your couch.<br>Your competition.</h3><label class="compare-select">Game<select id="story-game">${scope.map(id=>`<option value="${id}" ${id===story.compare?'selected':''}>${esc(a.gameLabel(game(id)))}</option>`).join('')}</select></label>${comparison(g,n)}${standings(g,n)}`;}
    if(chapter.type==='gifs')html=`<h3 class="broadcast-heading">That episode.<br>In your own GIFs.</h3><div class="showcase-reactions">${n===state().seen?a.reactions().map(r=>`<article><div class="gif-visual">${a.gifImage(r.gif,r.person+'’s episode reaction')}</div><button class="person-link" data-action="result-person" data-user="${esc(r.person)}" data-episode="${n}">${a.avatar(r.person==='You'?'Alex':r.person)}${esc(r.person)}</button></article>`).join(''):'<p>Reactions for this earlier episode are not loaded.</p>'}</div><div class="sheet-footer">${btn(state().reactions[n]!==undefined?'Change your GIF':'Add your GIF','gifs','','primary')}${btn('Discuss '+(sport?'event ':'episode ')+n,'chat','','quiet')}</div>`;
    a.openSheet(`${replay?'Replay':'Reveal'} · ${sport?'Event':'Episode'} ${n}`,`<div class="broadcast-shell"><div class="broadcast-tools"><label>Jump to<select id="showcase-chapter">${chapters.map((c,i)=>`<option value="${i}" ${i===k?'selected':''}>${i+1}. ${esc(c.label)}</option>`).join('')}</select></label><button class="text-action" data-action="result-summary" data-episode="${n}">Skip to results</button></div><div class="showcase-body" data-showcase-chapter="${k}" data-showcase-kind="${chapter.type}">${html}</div><div class="broadcast-controls"><button class="button quiet" data-action="result-step" data-direction="-1" ${k===0?'disabled':''}>${icon('back')} Back</button><span>${k+1} / ${chapters.length}</span>${k===chapters.length-1?btn('Back to Tonight','result-done','','primary'):`<button class="button primary" data-action="result-step" data-direction="1">Next ${icon('next')}</button>`}</div><p class="broadcast-scope">${replay?'Replay · no progress changed.':`${sport?'Event':'Episode'} ${n} revealed across all ${scope.length} games.`}</p></div>`,'showcase',replace);
    $('showcase-chapter').onchange=event=>{story.k=Number(event.target.value);drawShowcase();$('showcase-chapter').focus({preventScroll:true});};if($('story-game'))$('story-game').onchange=event=>{story.compare=event.target.value;drawShowcase();};
  }

  function chapterList(){return [{type:'intro',label:'Last time'},{type:'episode',label:'The episode'},...story.scope.map(id=>({type:'game',id,label:a.gameLabel(game(id))})),...(story.scope.length?[{type:'couch',label:'Your couch'}]:[]),{type:'gifs',label:'Reactions'}];}

  function standings(g,n){
    if(g.gameType==='pickem')return `<div class="through-standings"><h4>Survival picks through episode ${n}</h4>${rows(g,n).filter(p=>visible(g,p,n)).map(p=>{const history=(p.picks||[]).filter(x=>x.episode<=n).sort((a,b)=>a.episode-b.episode);let streak=0;for(const pick of history)streak=pick.castawayId&&pick.correct?streak+1:0;return `<button class="standing-row" data-action="result-person" data-user="${esc(p.userId)}" data-game="${g.leagueId}" data-episode="${n}">${a.avatar(p.name)}<span>${p.you?'You':esc(p.name)}</span><b>${streak} in a row</b></button>`;}).join('')}</div>`;
    const shared=rows(g,n).filter(p=>visible(g,p,n)).map(p=>{const history=source(g,n).plays?.rows?.[p.playerId]?.find(x=>x.episode===n);return {p,total:p.weeks?.some(w=>w.episode<=n)?p.weeks.filter(w=>w.episode<=n).reduce((sum,w)=>sum+w.total,0):history?.total};}).filter(x=>Number.isFinite(x.total)).sort((a,b)=>b.total-a.total);
    return `<div class="through-standings"><h4>Shared totals through episode ${n}</h4>${shared.map(({p,total})=>`<button class="standing-row" data-action="result-person" data-user="${esc(p.userId)}" data-game="${g.leagueId}" data-episode="${n}">${a.avatar(p.name)}<span>${p.you?'You':esc(p.name)}</span><b>${total} pts</b></button>`).join('')}<p>Totals through this episode. Unshared players are not assigned ranks.</p></div>`;
  }

  document.addEventListener('click',event=>{const b=event.target.closest('[data-action^="result-"]');if(!b)return;event.preventDefault();const d=b.dataset,n=Number(d.episode)||state().seen;
    if(d.action==='result-gate')openGate(n,d.game);
    if(d.action==='result-confirm')confirm(d.mode||'showcase');
    if(d.action==='result-summary')openSummary(n,d.game);
    if(d.action==='result-recap')openEpisodeRecap(n);
    if(d.action==='result-game')openSummary(n,d.game);
    if(d.action==='result-person')showPerson(d.user,n,d.game);
    if(d.action==='result-cast')showCast(d.name,n,d.game);
    if(d.action==='result-score')showScore(d.game,d.user,n);
    if(d.action==='result-moments')showMoments(d.game,d.user,d.cast,n);
    if(d.action==='result-showcase')openShowcase(n,undefined,true);
    if(d.action==='result-step'){story.k=Math.max(0,Math.min(chapterList().length-1,story.k+Number(d.direction)));drawShowcase();}
    if(d.action==='result-done')a.closeSheet();
  });
  document.addEventListener('keydown',event=>{if(a.sheetType()!=='showcase'||/INPUT|SELECT|TEXTAREA/.test(event.target.tagName))return;if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();story.k=Math.max(0,Math.min(chapterList().length-1,story.k+(event.key==='ArrowRight'?1:-1)));drawShowcase();}});
  return {source,rows,visible,metric,mark,insight,openGate,openSummary,showPerson,showCast,redrawShowcase:()=>drawShowcase(true)};
};
