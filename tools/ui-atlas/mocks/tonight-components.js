/* Persistent Atlas comparison, not the Impeccable accept/bake workflow.
   The existing V4 controller supplies data, eligible actions, details and reveal.
   Each section has the original renderer and three independently composed options. */
(() => {
  const incumbent=window.TonightV4Layout;
  window.TonightV4Layout=function(a){
    const base=incumbent(a),{esc,icon,btn}=a;
    const names={season:'Your place in the season',pace:'Your couch’s pace',games:'Your game night'};
    const direction=window.TonightComponentDirection?.(a,base);
    const concepts=direction?.concepts||{
      season:[['Original','Current V4','The existing unified progress control and watch actions.'],['A','Episode ticket','A clear handoff from the episode you finished to the one up next.'],['B','Season rail','Locate yourself in the released season before choosing your next action.'],['C','Up next, on screen','Show artwork leads; viewing progress stays attached to the next episode.']],
      pace:[['Original','Current V4','Faces, episode marks and relative distance in a compact strip.'],['A','Shared season tracks','Aligned episode tracks make the distance between friends comparable.'],['B','Around your episode','Group people behind, with and ahead of you, without turning pace into a race.'],['C','Who’s seen this?','Choose an episode to see which friends have watched through it.']],
      games:[['Original','Current V4','The existing compact minis, with one result and shared players per game.'],['A','The results desk','A cross-game table: your outcome beside the couch, in each game’s own units.'],['B','Game spotlight','One game at a time, with cast photography, contributions and player outcomes.'],['C','You and the couch','Choose a friend and compare your last-episode results game by game.']]
    };
    const preferenceKey=direction?'tonight-component-choices-'+direction.id:'tonight-component-choices-v1';
    let preferences={season:0,pace:0,games:0};try{preferences={...preferences,...JSON.parse(localStorage.getItem(preferenceKey)||'{}')};}catch{}
    for(const k of Object.keys(names))if(!Number.isInteger(preferences[k])||preferences[k]<0||preferences[k]>3)preferences[k]=0;
    let filter='all',spotlight=null,opponent=null,conversation=null,barsObserver;
    const state=()=>a.state(),space=()=>a.space(),n=()=>state().seen;
    const people=()=>space().people.filter(p=>p.userId!==a.data().context.userId);
    const personName=p=>p.you?'You':a.nameOf(p);
    const personButton=(p,body='',extra='')=>`<button class="cs-person ${extra}" data-action="result-person" data-user="${esc(p.userId)}" data-episode="${n()}">${a.avatar(p.you?'Alex':personName(p))}${body||`<b>${esc(personName(p))}</b>`}</button>`;
    const episodeTitle=i=>space().schedule.episodes.find(e=>e.number===i)?.title;
    const episodeLabel=i=>`Episode ${i}${episodeTitle(i)?' · '+episodeTitle(i):''}`;
    const released=()=>Math.max(1,space().schedule.latestAired||0);
    const next=()=>a.next();
    const isLive=()=>!!space().schedule.upNext?.live&&n()>=space().schedule.latestAired;
    const available=()=>next()<=space().schedule.latestAired||isLive();
    const status=()=>base.progress();
    const watch=()=>`<div class="cs-watch">${available()?btn(icon('play')+(isLive()?` Join watch along · E${next()}`:` Start watching · E${next()}`),'watch',next(),'primary'):`<p>Next release <b>${esc(a.date(next()))}</b></p>`}${available()&&!isLive()?btn(`I watched episode ${next()}`,'watched',next(),'quiet'):''}</div>`;
    function season(v){
      const last=n(),up=next();
      if(v===1)return `<button class="episode-ticket" data-action="episodes"><span class="ticket-route"><span class="ticket-last"><small>Last watched</small><b>Episode ${last}</b><em>${esc(a.date(last))}</em></span><span class="ticket-next"><small>${isLive()?'On now':'Next to watch'}</small><b>Episode ${up}</b><em>${esc(a.episodeDescription(up))}</em>${icon('next')}</span></span><span class="ticket-bottom"><span>${esc(status())}</span><span class="ticket-update">Update ${icon('down')}</span></span></button>${watch()}`;
      if(v===2){
        const start=Math.max(1,Math.min(last-2,released()-5)),end=Math.min(released(),start+5),rail=[];
        for(let i=start;i<=end;i++)rail.push(`<span class="season-node ${i<=last?'seen':''} ${i===up?'next':''} ${i===last?'current':''}" aria-label="Episode ${i}: ${i<=last?'watched':i===up?'next to watch':'not watched'}"><span>${i<last?icon('check'):i}</span><small>${i===last?'You':i===up?'Next':'E'+i}</small></span>`);
        return `<button class="season-rail" data-action="episodes"><span class="rail-header"><b>${esc(status())}</b><span>Update ${icon('down')}</span></span><span class="season-nodes" aria-label="Released episodes ${start} to ${end}">${rail.join('')}</span><span class="rail-note">${start>1?'Showing episodes '+start+'–'+end+' · ':''}${released()} episodes released · You’ve watched ${last}</span><span class="rail-next"><span>Last watched <b>Episode ${last}</b></span>${icon('next')}<span>Next to watch <b>${esc(episodeLabel(up))}</b><small>${esc(a.date(up))}</small></span></span></button>${watch()}`;
      }
      return `<button class="next-screen" data-action="episodes"><img src="${esc(space().show.artUrl)}" alt=""><span class="next-screen-content"><span class="screen-next-label">${isLive()?'Airing now':'Next to watch'}</span><strong>${esc(episodeLabel(up))}</strong><span class="screen-date">${esc(a.date(up))}</span><span class="screen-footer"><span>${esc(status())}</span><span class="screen-update">Update ${icon('down')}</span></span></span></button><div class="screen-last"><span>Last watched <b>Episode ${last}</b></span><span>${esc(a.date(last))}</span></div>${watch()}`;
    }
    function pace(v){
      const friends=people(),me={userId:a.data().context.userId,seen:n(),you:true},all=[me,...friends];
      const footer=`<button class="cs-all" data-action="friends">Everyone’s viewing progress ${icon('next')}</button>`;
      if(!friends.length)return `<div class="cs-empty">${icon('chat')}<h3>A little company?</h3><p>No one else is on this couch yet. Your progress and reactions are yours to enjoy.</p><a href="${a.route('chat')}" target="_blank" rel="noopener">Open your couch ${icon('next')}</a></div>`;
      if(v===1)return `<div class="shared-tracks"><div class="track-key"><span>Last watched episode</span><b>${released()} released</b></div>${all.map(p=>`<div class="shared-track ${p.you?'is-you':''}">${personButton(p)}<button class="track-line" data-action="result-person" data-user="${esc(p.userId)}" data-episode="${n()}" aria-label="${esc(personName(p))}: ${p.seen==null?'progress not shared':'last watched episode '+p.seen}"><span class="track-ticks" style="--ticks:${released()}"></span>${p.seen!=null?`<span class="track-fill" style="width:${Math.min(100,p.seen/released()*100)}%"></span><b style="left:clamp(15px,${Math.min(100,p.seen/released()*100)}%,calc(100% - 15px))">${p.seen}</b>`:'<small>Not shared</small>'}</button></div>`).join('')}<p class="cs-note">Your position is highlighted. Tracks stop at the latest released episode.</p>${footer}</div>`;
      if(v===2){
        const groups=[['Behind you',p=>p.seen!=null&&p.seen<n()],['With you',p=>p.seen===n()],['Ahead of you',p=>p.seen!=null&&p.seen>n()]];
        return `<div class="episode-groups"><div class="group-anchor">${a.avatar('Alex')}<span>You last watched <b>Episode ${n()}</b></span><button data-action="episodes">Update</button></div><div class="pace-groups">${groups.map(([label,test])=>`<section><h3>${label}</h3>${friends.filter(test).map(p=>personButton(p,`<span><b>${esc(personName(p))}</b><small>Episode ${p.seen}</small></span>`)).join('')||'<p>No one here yet</p>'}</section>`).join('')}</div>${friends.filter(p=>p.seen==null).map(p=>personButton(p,`<span><b>${esc(personName(p))}</b><small>Progress not shared</small></span>`)).join('')}${footer}</div>`;
      }
      const target=conversation??n();
      return `<div class="conversation-pace"><label>Who’s seen <select data-lab-control="conversation" aria-label="Episode to compare viewing progress">${space().schedule.episodes.filter(e=>e.number<=released()).map(e=>`<option value="${e.number}" ${e.number===target?'selected':''}>${esc(episodeLabel(e.number))}</option>`).join('')}</select></label><p>Find a friend at the same point in the story.</p><div class="conversation-people">${friends.map(p=>`<div class="conversation-row ${p.seen>=target?'has-seen':'not-there'}">${personButton(p,`<span><b>${esc(personName(p))}</b><small>${p.seen==null?'Progress not shared':'Last watched episode '+p.seen}</small></span>`)}<span class="seen-label">${p.seen==null?'Unknown':p.seen>=target?icon('check')+' Seen it':'Not there yet'}</span></div>`).join('')}</div><p class="cs-note">This uses viewing positions, not message screening. Freeform conversation can still contain spoilers.</p>${footer}</div>`;
    }
    const results=()=>a.results();
    function gameInfo(g){
      const r=results(),last=Math.min(n(),r.mark(g)),source=r.source(g,last),rows=r.rows(g,last),me=rows.find(p=>p.you),hidden=r.mark(g)<n()&&!g.over;
      const metric=p=>hidden?{hidden:true,label:'Reveal episode '+n()}:p?r.metric(g,p,last):{missing:true,label:'No captured result'};
      return {g,last,source,rows,me,hidden,metric};
    }
    function metricButton(info,p,kind=''){
      const m=info.metric(p),hidden=info.hidden;
      return `<button class="cs-metric ${kind} ${m.hidden?'is-private':''}" data-action="${hidden?'result-gate':m.hidden||m.missing?'result-person':'result-score'}" data-game="${esc(info.g.leagueId)}" data-user="${esc(p?.userId||'')}" data-episode="${hidden?n():info.last}">${m.hidden?icon('lock'):''}<b>${esc(m.label)}</b>${!m.hidden?icon('next'):''}</button>`;
    }
    function gameFooter(){return `<div class="cs-game-footer"><button data-action="result-summary" data-episode="${n()}">Episode ${n()} results ${icon('next')}</button><a href="${a.route('games')}" target="_blank" rel="noopener">All games ${icon('external')}</a></div>`;}
    function gameOptions(selected){return a.games().map(g=>`<option value="${esc(g.leagueId)}" ${g.leagueId===selected?'selected':''}>${esc(a.gameLabel(g))}</option>`).join('');}
    function games(v){
      if(!a.isPlayer())return `<div class="cs-empty">${icon('tv')}<h3>Just here for the show?</h3><p>No game summaries to fill. Keep watching, chatting and reacting.</p><a href="${a.route('games')}" target="_blank" rel="noopener">Explore games ${icon('next')}</a></div>`;
      const gs=a.games();
      if(v===1){
        const sample=gs.map(gameInfo),shared=sample.flatMap(i=>i.rows).filter(p=>!p.you),names=[...new Map(shared.map(p=>[p.userId,p])).values()],rival=names.find(p=>sample.some(i=>{const row=i.rows.find(x=>x.userId===p.userId);return row&&!i.metric(row).hidden;}))||names[0];
        return `<div class="results-desk"><div class="desk-caption"><strong>Episode ${n()}</strong><span>Each game, its own score.</span></div><div class="desk-table" role="table" aria-label="Episode ${n()} game results"><div class="desk-row desk-head" role="row"><span role="columnheader">Game</span><span role="columnheader">You</span><span role="columnheader">${rival?personButton({...rival,name:rival.name}):'Couch'}</span></div>${sample.map(i=>`<div class="desk-row" role="row"><div role="cell"><a href="${a.route('game/'+i.g.leagueId)}" target="_blank" rel="noopener">${esc(a.gameLabel(i.g))} ${icon('external')}</a><small>${i.g.gameType==='pickem'?'Survival pick':i.g.lineup?'Lineup points':'Episode result'}${i.last<n()&&!i.hidden?' · E'+i.last:''}</small></div><span role="cell">${metricButton(i,i.me,'your-score')}</span><span role="cell">${metricButton(i,i.rows.find(p=>p.userId===rival?.userId))}</span></div>`).join('')}</div><button class="desk-others" data-action="result-summary" data-episode="${n()}">See every player’s picks & results ${icon('next')}</button>${gameFooter()}</div>`;
      }
      if(v===2){
        const g=gs.find(g=>g.leagueId===spotlight)||gs.find(g=>g.lineup)||gs[0];spotlight=g.leagueId;
        const i=gameInfo(g),m=i.metric(i.me),faces=i.hidden?[]:m.person?[{...m.person}]:m.week?(m.week.started||[]).map(c=>({...i.source.cast?.find(x=>x.id===c.id),points:c.points})).filter(c=>c.name):(m.play?.held||i.me?.team||[]).map(id=>i.source.cast?.find(c=>c.id===id)).filter(Boolean);
        return `<div class="game-spotlight"><label>Game <select data-lab-control="spotlight">${gameOptions(spotlight)}</select></label><div class="spotlight-result"><span>Episode ${i.hidden?n():i.last} · Your ${g.gameType==='pickem'?'pick':g.lineup?'lineup':'result'}</span>${metricButton(i,i.me,'spotlight-score')}</div>${faces.length?`<div class="spotlight-cast">${faces.slice(0,4).map(c=>`<button data-action="result-cast" data-game="${g.leagueId}" data-name="${esc(c.name)}" data-episode="${i.last}"><img src="${esc(c.photo||'')}" alt=""><b>${esc(c.name.split(' ')[0])}</b>${c.points!=null?`<span>${c.points>0?'+':''}${c.points} pts</span>`:''}</button>`).join('')}</div>`:`<p class="cs-note">${i.hidden?'Reveal this episode across all your games to see its picks and outcomes.':'Individual contributions are not present in this captured game. The recorded total is shown above.'}</p>`}<div class="spotlight-couch">${i.rows.filter(p=>!p.you).map(p=>`<div>${personButton(p)}${metricButton(i,p)}</div>`).join('')}</div><div class="cs-game-footer"><button data-action="result-summary" data-game="${g.leagueId}" data-episode="${n()}">Picks & scoring ${icon('next')}</button><a href="${a.route('game/'+g.leagueId)}" target="_blank" rel="noopener">Full game ${icon('external')}</a></div></div>`;
      }
      const sample=gs.map(gameInfo),roster=[...new Map(sample.flatMap(i=>i.rows).filter(p=>!p.you).map(p=>[p.userId,p])).values()];
      const friend=roster.find(p=>p.userId===opponent)||roster.find(p=>sample.some(i=>{const row=i.rows.find(x=>x.userId===p.userId);return row&&!i.metric(row).hidden;}))||roster[0];opponent=friend?.userId;
      if(!friend)return `<div class="solo-night"><h3>Your solo game night.</h3><p>Enjoy the result, without an empty opponent.</p>${sample.map(i=>`<div class="solo-game"><a href="${a.route('game/'+i.g.leagueId)}" target="_blank" rel="noopener">${esc(a.gameLabel(i.g))}</a>${metricButton(i,i.me)}</div>`).join('')}${gameFooter()}</div>`;
      return `<div class="couch-match"><label>Compare with <select data-lab-control="opponent">${roster.map(p=>`<option value="${p.userId}" ${p.userId===opponent?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><div class="match-people">${personButton({userId:a.data().context.userId,you:true},'<b>You</b>')}<span>Episode ${n()}</span>${personButton(friend)}</div>${sample.map(i=>{const other=i.rows.find(p=>p.userId===opponent),m=i.metric(i.me),t=i.metric(other),max=Math.max(1,Math.abs(m.value||0),Math.abs(t.value||0));return `<div class="match-game"><a href="${a.route('game/'+i.g.leagueId)}" target="_blank" rel="noopener">${esc(a.gameLabel(i.g))} ${icon('external')}</a><div class="match-scores"><div>${metricButton(i,i.me,'your-score')}${Number.isFinite(m.value)?`<i class="match-bar" style="width:${Math.abs(m.value)/max*100}%"></i>`:''}</div><div>${metricButton(i,other)}${Number.isFinite(t.value)?`<i class="match-bar rival" style="width:${Math.abs(t.value)/max*100}%"></i>`:''}</div></div></div>`;}).join('')}<p class="cs-note">Same episode, separate game scores. A friend’s later or unshared results stay hidden.</p>${gameFooter()}</div>`;
    }
    function original(kind){return `<iframe class="cs-original" title="Original V4: ${names[kind]}" src="/__atlas/mock/tonight-component-original.html?section=${kind}" data-original="${kind}" style="height:${kind==='games'?760:kind==='pace'?180:245}px"></iframe>`;}
    function card(kind,index){
      const [letter,title,reason]=concepts[kind][index],selected=preferences[kind]===index;
      return `<article class="cs-option" data-section="${kind}" data-variant="${index}"><header class="cs-option-heading"><div><h3>${index===0?'Original':`Option ${letter}`} <span>${title}</span></h3><p>${reason}</p></div><button class="cs-choose" data-lab-pick="${kind}" data-index="${index}" aria-pressed="${selected}" aria-label="Choose ${names[kind]}: ${title}">${selected?icon('check')+' Chosen':'Choose'}</button></header><div class="cs-preview v4 ${direction&&index?'bold-preview':''}">${index===0?original(kind):direction?direction.render(kind,index):kind==='season'?season(index):kind==='pace'?pace(index):games(index)}</div></article>`;
    }
    function render(){
      document.documentElement.dataset.theme=a.data().theme||'night';
      const root=document.getElementById('app'),active=filter==='mix'?Object.keys(names):filter==='all'?Object.keys(names):[filter];
      root.setAttribute('aria-busy','false');
      root.innerHTML=`<main class="cs-workbench"><header class="cs-header"><div><h1>Tonight, piece by piece.</h1><p>Three components. Three distinct alternatives each. The unchanged <b>current V4</b> sits beside them.</p><p class="cs-context">${esc(space().show.name)} · Season ${space().seasonNumber} · Last watched episode ${n()} · ${esc(a.data().case.id)}</p></div><a class="cs-back" href="http://127.0.0.1:4400/?case=${encodeURIComponent(a.data().case.id)}" target="_blank" rel="noopener">Open OG application ${icon('external')}</a></header><nav class="cs-toolbar" aria-label="Component comparison"><div class="cs-filters">${[['all','All components'],['season','Your place'],['pace','Couch’s pace'],['games','Game night'],['mix','Your mix']].map(([id,label])=>`<button data-lab-filter="${id}" aria-pressed="${filter===id}">${label}</button>`).join('')}</div><label class="cs-size">Preview <select data-lab-control="width"><option value="390">390px phone</option><option value="360">360px phone</option><option value="full">Fill available width</option></select></label></nav><aside class="cs-selection"><p>${Object.entries(names).map(([kind,label])=>`<span>${label.replace('Your ','')}: <b>${concepts[kind][preferences[kind]][0]}</b></span>`).join('')}</p><button data-lab-export>Save choices ${icon('down')}</button><span id="cs-saved" role="status"></span></aside><div class="cs-sections">${active.map(kind=>`<section class="cs-section" aria-labelledby="cs-${kind}"><div class="cs-section-title"><h2 id="cs-${kind}">${names[kind]}</h2><p>${kind==='season'?'Where you are. What’s next. What to do.':kind==='pace'?'People’s viewing positions, separate from their game results.':`Episode ${n()} outcomes, player choices and paths into the full games.`}</p></div><div class="cs-options ${filter==='mix'?'cs-mix':''}">${filter==='mix'?card(kind,preferences[kind]):[0,1,2,3].map(index=>card(kind,index)).join('')}</div></section>`).join('')}</div><footer class="cs-notes"><p>Original means the V4 component currently under review; OG is linked above. Options use the same active Atlas projections, alias portraits and recorded game metrics. Viewing ahead does not unlock another player’s results. Social identities are illustrative.</p><p>Controls open the existing V4 detail, progress and quick-action flows. Preview changes share V4’s local state for this case. These are comparison mocks; no production changes or scores are written.</p><button class="button quiet" data-action="reset">Reset preview actions</button></footer></main>`;
      const width=localStorage.getItem('tonight-component-width')||'390';document.documentElement.style.setProperty('--cs-preview-width',width==='full'?'100%':width+'px');root.querySelector('[data-lab-control=width]').value=width;
      if(direction){root.querySelector('.cs-header h1').textContent='Make a night of it.';root.querySelector('.cs-header p').innerHTML='The bold round. Nine new concepts, with the <b>unchanged V4 originals</b> beside them.';const previous=document.createElement('a');previous.href='/__atlas/mock/tonight-components-r1.html';previous.className='cs-previous';previous.textContent='Compare with round 1';root.querySelector('.cs-selection').append(previous);const replay=document.createElement('button');replay.dataset.boldReplay='';replay.textContent='Replay result animation';root.querySelector('.cs-selection').append(replay);}
      window.__TONIGHT_COMPONENTS__={ready:true,direction:direction?.id||'round1',preferences:{...preferences},caseId:a.data().case.id};
      direction?.onMount(root);
      barsObserver?.disconnect();
      if(!matchMedia('(prefers-reduced-motion: reduce)').matches){barsObserver=new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;entry.target.animate([{clipPath:'inset(0 100% 0 0)'},{clipPath:'inset(0)'}],{duration:700,easing:'cubic-bezier(.16,1,.3,1)'});barsObserver.unobserve(entry.target);}},{threshold:.5});root.querySelectorAll('.match-bar').forEach(bar=>barsObserver.observe(bar));}
    }
    function persistChoices(){localStorage.setItem(preferenceKey,JSON.stringify(preferences));}
    document.addEventListener('click',e=>{
      const pick=e.target.closest('[data-lab-pick]'),tab=e.target.closest('[data-lab-filter]');
      if(pick){const kind=pick.dataset.labPick,index=Number(pick.dataset.index);preferences[kind]=index;persistChoices();const y=scrollY;render();scrollTo(0,y);document.querySelector(`[data-lab-pick=${kind}][data-index="${index}"]`)?.focus({preventScroll:true});}
      if(tab){filter=tab.dataset.labFilter;render();document.querySelector('.cs-toolbar').scrollIntoView({block:'start'});}
      if(e.target.closest('[data-lab-export]')){
        const payload={version:1,direction:direction?.id||'round1',caseId:a.data().case.id,choices:Object.fromEntries(Object.keys(names).map(kind=>[kind,{option:concepts[kind][preferences[kind]][0],name:concepts[kind][preferences[kind]][1]}]))};
        const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='tonight-component-choices.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);document.getElementById('cs-saved').textContent='Choices saved to JSON.';
      }
    });
    document.addEventListener('change',e=>{
      const control=e.target.dataset.labControl;if(!control)return;
      direction?.change(control,e.target.value);
      if(control==='width'){localStorage.setItem('tonight-component-width',e.target.value);document.documentElement.style.setProperty('--cs-preview-width',e.target.value==='full'?'100%':e.target.value+'px');return;}
      if(control==='spotlight')spotlight=e.target.value;if(control==='opponent')opponent=e.target.value;if(control==='conversation')conversation=Number(e.target.value);
      const y=scrollY;render();scrollTo(0,y);document.querySelector(`[data-lab-control=${control}]`)?.focus({preventScroll:true});
    });
    window.addEventListener('message',e=>{
      if(e.origin!==location.origin)return;
      const frame=[...document.querySelectorAll('.cs-original')].find(f=>f.contentWindow===e.source);if(!frame)return;
      if(e.data?.type==='tonight-component-height'&&Number.isFinite(e.data.height))frame.style.height=Math.max(80,Math.min(4000,e.data.height))+'px';
      if(e.data?.type==='tonight-component-action'&&e.data.dataset?.action){const proxy=document.createElement('button');proxy.hidden=true;Object.assign(proxy.dataset,e.data.dataset);document.getElementById('app').append(proxy);proxy.click();proxy.remove();}
    });
    return {...base,render};
  };
})();
