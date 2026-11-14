/* Review-only Tonight. API projections come from the active atlas case.
   All selections, progress, messages and clock changes stay in localStorage.
   No source-app writes, invented episode titles, or future results are requested. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const assets = '/__atlas/mock/tonight-assets/';
  const icon = name => `<svg class="icon" aria-hidden="true"><use href="${assets}icons.svg#${name}"></use></svg>`;
  const btn = (label, action, value = '', kind = '') => `<button class="button ${kind}" data-action="${action}" data-value="${esc(value)}">${label}</button>`;
  const link = (label, route, kind = '') => `<a class="button ${kind}" href="${esc(route)}" target="_blank" rel="noopener">${label}</a>`;
  const dialog = $('detail');
  const sheetStack = [];
  let results, view;
  let restoreIdentity;
  let data, social, space, games, episodes, stats, home, state, initialSeen, key, restoreFocus, clockTick, toastTimeout, activeGame, currentSheet;
  const gifNames = ['Gots Gaming Chair Fall', 'Triste', 'Big Eyes Yippee'];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reduced.matches;
  const posters = new Map();
  const get = suffix => Object.entries(data.responses).find(([url]) => url.split('?')[0].endsWith(suffix))?.[1]?.body;
  const nameOf = person => social.aliases[person.name] || person.name;
  const face = name => '/photos/tour/' + ({Alex:'ana',Sam:'gus',Jordan:'hana',Riley:'clive'}[name] || 'jo') + '.jpg';
  const avatar = name => `<img class="avatar" src="${face(name)}" alt="">`;
  const episode = number => space.schedule.episodes.find(e => e.number === number);
  const date = number => {
    const e = episode(number);
    if (!e?.airAt) return `Episode ${number}`;
    return new Intl.DateTimeFormat('en-US', {weekday:'short',month:'short',day:'numeric',timeZone:space.schedule.airTz || 'America/New_York'}).format(new Date(e.airAt));
  };
  const episodeName = number => `Episode ${number}${episode(number)?.title ? ' — ' + episode(number).title : ''}`;
  const episodeDescription = number => episode(number)?.title || date(number);
  const route = tab => '/show/' + data.context.seasonId + '/' + tab;
  const currentGames = () => games.games.filter(g => space.games.some(s => s.leagueId === g.leagueId));
  const isPlayer = () => !!space.you.plays && currentGames().length > 0;
  const next = () => Math.min(state.seen + 1, space.episodeCount || state.seen + 1);
  const gameWeek = g => Math.max(g.catchUp?.week || g.pick?.episode || g.lineup?.episode || next(),(results?.mark(g) ?? g.through ?? 0)+1);
  const choice = g => state.choices[g.leagueId];
  const saved = g => !!choice(g)?.saved || (!!g.pick?.pick && g.pick.episode===gameWeek(g)) || (!!g.lineup?.set && g.lineup.episode===gameWeek(g)) || (!!g.sheet && g.sheet.answered>=g.sheet.of);
  const gameLabel = g => {
    const same = currentGames().filter(x => x.name === g.name);
    return g.name + (same.length > 1 ? (same[0].leagueId === g.leagueId ? ' · A' : ' · B') : '');
  };
  function persist() { localStorage.setItem(key, JSON.stringify(state)); }
  const animatedStats=new Set();
  function animateStats(){
    const elements=[...document.querySelectorAll('[data-count],[data-stat-bar]')];
    if(reduced.matches)return;
    const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;const e=entry.target,k=e.dataset.statKey||e.dataset.count;observer.unobserve(e);if(animatedStats.has(k))continue;animatedStats.add(k);if(e.hasAttribute('data-stat-bar'))e.animate([{transform:'scaleX(0)'},{transform:'scaleX(1)'}],{duration:680,easing:'cubic-bezier(.16,1,.3,1)'});else{const value=Number(e.dataset.count),start=performance.now();e.setAttribute('aria-label',e.textContent);e.setAttribute('role','img');const tick=now=>{if(!e.isConnected)return;const t=Math.min(1,(now-start)/650),v=value*(1-Math.pow(1-t,4));e.textContent=(value>0?'+':'')+(t===1?String(value):v.toFixed(1));if(t<1)requestAnimationFrame(tick);};requestAnimationFrame(tick);}}},{threshold:.25});elements.forEach(e=>observer.observe(e));
  }
  function decisions(){
    return currentGames().filter(g=>!g.over).flatMap(g=>{const type=g.pick?'pick':g.lineup?'lineup':g.sheet?'predictions':null;if(!type)return [];const locked=!g.ownPace&&(type==='pick'?g.pick.open===false:type==='lineup'?g.lineup.locked:!!space.schedule.upNext?.live);return [{g,type,episode:gameWeek(g),done:saved(g),locked:!!locked}];});
  }
  function showQuickActions(replace=false){
    const defs=decisions(),pending=defs.filter(d=>!d.done&&!d.locked);
    openSheet(pending.length?'Before the episode.':'You’re ready for the episode.',`<div class="quick-play-art"><img src="/art/generated/island-night-v1.png" alt=""><h3>${pending.length?pending.length+' choices.<br>Then enjoy the show.':'All set.<br>Bring on the episode.'}</h3></div><p class="sheet-lead">${pending.length?'Pick before you watch. Go with your gut or look at the stats.':'Your choices are saved. You can review them here.'}</p><div class="quick-game-list">${defs.map(({g,type,episode,done,locked})=>`<button class="quick-game" data-action="game" data-value="${g.leagueId}" ${locked?'disabled':''}><span class="quick-symbol">${icon(type==='pick'?'shield':type==='lineup'?'cast':'chart')}</span><span><small>${esc(gameLabel(g))} · Episode ${episode}</small><b>${locked?'Locked':done?'Saved · Review':type==='pick'?'Pick who survives':type==='lineup'?'Set your lineup':'Make your predictions'}</b></span>${icon(done?'check':'next')}</button>`).join('')}</div><div class="sheet-footer">${btn('Start watching episode '+next(),'watch',next(),'primary')}</div>`, 'quick-actions',replace);
  }
  function showPredictions(g){
    const projection=Object.entries(data.responses).find(([url,r])=>url.split('?')[0].endsWith('/answers')&&r.body.leagueId===g.leagueId&&r.body.episode===gameWeek(g))?.[1]?.body;
    const q=projection?.questions?.[0];
    if(!q?.faces?.length){openSheet('Predictions · '+gameLabel(g),`<p class="sheet-lead">Episode ${gameWeek(g)} · ${esc(g.sheet?.ask||'Make your predictions')}</p><div class="sheet-footer">${link('Open prediction editor '+icon('external'),route('game/'+g.leagueId),'primary')}</div>`, 'predictions');return;}
    state.predictionDrafts ||= {};const selected=state.predictionDrafts[g.leagueId];
    openSheet('Call it before the episode.',`<p class="sheet-lead">${esc(gameLabel(g))} · Episode ${gameWeek(g)}</p><h3>${esc(q.ask)}</h3><div class="choice-grid">${q.faces.map(c=>{const local=g.cast.find(x=>x.name===c.name);return `<button class="cast-choice" data-action="prediction-pick" data-value="${esc(c.id)}" data-game="${g.leagueId}" aria-pressed="${selected===c.id}"><img src="${esc(local?.photo||c.photo)}" alt=""><span>${esc(c.name.split(' ')[0])}</span></button>`;}).join('')}</div><div class="sheet-footer"><button class="button primary" data-action="prediction-save" data-game="${g.leagueId}" ${selected?'':'disabled'}>Save prediction</button>${link('Full game '+icon('external'),route('game/'+g.leagueId),'quiet')}</div>`, 'predictions');
  }
  function toast(text) { clearTimeout(toastTimeout); $('toast').textContent = text; $('toast').classList.add('visible'); toastTimeout = setTimeout(() => $('toast').classList.remove('visible'), 3000); }
  function openSheet(title, html, type, replace = false) {
    if (!dialog.open) { restoreFocus = document.activeElement;restoreIdentity=restoreFocus?.dataset?.action?{...restoreFocus.dataset,className:restoreFocus.classList[0]}:null; sheetStack.length = 0; }
    else if (!replace && !(type===currentSheet && ['game','chat','watch','showcase','result-gate'].includes(type))) sheetStack.push({title:$('detail-title').textContent,nodes:[...$('detail-body').childNodes],type:currentSheet,game:activeGame,scroll:dialog.scrollTop,focus:document.activeElement});
    currentSheet = type;dialog.classList.toggle('is-showcase',type==='showcase');
    $('detail-title').textContent = title;
    $('detail-body').innerHTML = html;
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    $('back-detail').hidden = !sheetStack.length;
    preparePosters();animateStats();
  }
  function backSheet() { const previous=sheetStack.pop();if(!previous){closeSheet();return;}$('detail-title').textContent=previous.title;$('detail-body').replaceChildren(...previous.nodes);currentSheet=previous.type;dialog.classList.toggle('is-showcase',currentSheet==='showcase');activeGame=previous.game;dialog.scrollTop=previous.scroll;$('back-detail').hidden=!sheetStack.length;previous.focus?.focus({preventScroll:true});preparePosters(); }
  function closeSheet() { dialog.close();dialog.classList.remove('is-showcase'); sheetStack.length=0;currentSheet=null;clearInterval(clockTick); clockTick = null;const target=restoreFocus?.isConnected?restoreFocus:restoreIdentity?[...$('app').querySelectorAll('[data-action]')].find(e=>e.classList.contains(restoreIdentity.className)&&Object.entries(restoreIdentity).filter(([k])=>k!=='className').every(([k,v])=>e.dataset[k]===v)):null;target?.focus({preventScroll:true}); }
  $('back-detail').innerHTML=icon('back');$('back-detail').onclick=backSheet;
  $('close-detail').innerHTML = icon('close');
  $('close-detail').onclick = closeSheet;
  dialog.addEventListener('cancel', e => { e.preventDefault(); sheetStack.length?backSheet():closeSheet(); });
  dialog.addEventListener('click', e => { if (e.target === dialog) {const r = dialog.getBoundingClientRect();if(e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)closeSheet();} });
  function gifImage(index, alt) {
    return `<img class="motion-gif" data-gif="${index}" src="${assets}reaction-${index}.gif" alt="${esc(alt)}"><img class="motion-poster" data-poster="${index}" alt="${esc(alt)}">`;
  }
  function preparePosters() {
    document.body.classList.toggle('motion-paused', paused);
    document.querySelectorAll('[data-gif]').forEach(img => {
      const set = () => {
        if (!posters.has(img.dataset.gif) && img.naturalWidth) { const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight; canvas.getContext('2d').drawImage(img, 0, 0); posters.set(img.dataset.gif, canvas.toDataURL()); }
        document.querySelectorAll(`[data-poster="${img.dataset.gif}"]`).forEach(p => { if(posters.has(img.dataset.gif))p.src = posters.get(img.dataset.gif); });
      };
      if (img.complete) set(); else img.addEventListener('load', set, {once:true});
    });
  }
  function reactions() {
    const list = state.seen === initialSeen ? social.reactions.map((r, i) => ({...r, id:'sample-' + i})) : [];
    const mine = state.reactions[state.seen];
    if (mine !== undefined) list.unshift({id:'mine',person:'You',gif:mine,caption:'Your GIF · posted',likes:0});
    return list;
  }
  function recapFor(number) {
    if (number > initialSeen || (isPlayer() && currentGames().every(g => (results?.mark(g) ?? g.through) < number))) return null;
    const result = episodes.episodes.find(e => e.number === number);
    return result?.status === 'seen' ? result : null;
  }
  function episodeMemory(number) {
    const recap = recapFor(number);
    if (!recap) return `<p class="memory-pending">${isPlayer() && currentGames().some(g => g.through < number) ? `You watched episode ${number}. Reveal your games to see its recap.` : `You watched episode ${number}. Its recap isn’t in this review dataset yet.`}</p>`;
    const outs = (recap.out || []).slice(0, 2);
    const events = (recap.happened || []).slice(0, 1);
    const reminder = outs.map(p => {const name=p.name.split(' ')[0];return /medic/i.test(p.method) ? name+' left medically' : /voted/i.test(p.method) ? name+' was voted out' : name+' · '+(p.method || 'left the show');}).join('. ');
    const moment = events.map(e => e.winners.map(w => w.name).join(', ')+' · '+e.label).join('. ');
    return `<div class="episode-memory"><span class="memory-faces">${outs.map(p=>`<button data-action="result-cast" data-name="${esc(p.name)}" aria-label="View ${esc(p.name)}"><img src="${esc(p.photo)}" alt=""></button>`).join('') || icon('episodes')}</span><button class="memory-reminder" data-action="recap" aria-label="Read episode ${number} recap"><b>${esc(reminder || moment || 'Revisit the episode you watched.')}${reminder?'.':''}</b>${reminder&&moment?`<small>${esc(moment)}</small>`:''}</button><button class="icon-button" data-action="recap" aria-label="Read episode ${number} recap">${icon('next')}</button></div>`;
  }
  function render() { view.render();preparePosters();animateStats(); }
  function originalEpisodeMarkup(){const released=space.schedule.latestAired;return `<p class="sheet-lead">Last watched: <b>${esc(episodeName(state.seen))}</b>. Next for you: <b>${esc(episodeName(next()))}</b>.</p>${space.schedule.episodes.map(e=>`<div class="episode-option"><span class="episode-number">E${e.number}</span><span class="episode-info"><strong>${esc(episodeName(e.number))}</strong><small>${e.number<state.seen?'Watched':e.number===state.seen?'Your last watched episode':e.number===next()?'Next for you':e.number<=released?'Available · not watched':'Not released yet'}</small></span>${e.number<=initialSeen&&e.number!==state.seen?btn('Set as watched','set-progress',e.number,'quiet'):e.number===next()&&e.number<=released?btn('I watched it','watched',e.number,'small'):e.number===state.seen?icon('check'):icon('lock')}</div>`).join('')}<p class="privacy-note">Moving your viewing position does not reveal game results. Later episode reactions and outcomes stay out of this overview.</p>`;}
  function showOriginalEpisodes(){openSheet('Your place in the season',originalEpisodeMarkup(),'episodes');}
  function showEpisodes(){if(view?.showEpisodes)return view.showEpisodes();showOriginalEpisodes();}
  function showFriends() {
    const friends = space.people.filter(p=>p.userId!==data.context.userId);
    const people=[{userId:data.context.userId,name:'You',seen:state.seen,you:true},...friends];
    openSheet('Where everyone’s watching', `<p class="sheet-lead">You’re on episode ${state.seen}. See who’s with you, ahead or still catching up.</p><p class="privacy-note">${space.schedule.latestAired} episodes released so far. Bars show progress through those episodes.</p><div class="pace-map">${people.map(p=>`<div class="pace-map-row ${p.you?'you':''}"><div class="pace-map-head"><button data-action="result-person" data-user="${esc(p.userId)}" data-episode="${state.seen}">${avatar(p.you?'Alex':nameOf(p))}</button><button class="person-link" data-action="result-person" data-user="${esc(p.userId)}" data-episode="${state.seen}">${p.you?'You':esc(nameOf(p))}</button><small>${p.seen==null?'Not shared':p.seen===state.seen?'Same episode':Math.abs(p.seen-state.seen)+(p.seen>state.seen?' ahead':' behind')}</small></div>${p.seen!=null?`<div class="pace-track" style="--pace:${Math.min(100,p.seen/Math.max(1,space.schedule.latestAired)*100)}%"><span></span></div><div class="pace-caption"><span>Last watched: episode ${p.seen}</span><span>${esc(date(p.seen))}</span></div>`:''}</div>`).join('')}</div><div class="sheet-footer">${btn('Discuss episode '+state.seen,'chat')}</div><p class="privacy-note">Someone can be ahead in watching while their game results stay private. Episode labels cannot guarantee that freeform conversation has no spoilers.</p>`, 'friends');
  }
  function eligible(g) {
    const ids = g.pick?.available || g.lineup?.roster || g.you?.team || [];
    // The derived fixture retains some later metadata. Only use the boundary-safe IDs,
    // names and images here; never render its future flags, ranks or scores.
    return ids.map(id=>g.cast.find(c=>c.id===id)).filter(Boolean);
  }
  function showGame(id) {
    const g = currentGames().find(g=>g.leagueId===id); if(!g)return;
    activeGame = g;
    if(gameWeek(g)<=state.seen){results.openGate(gameWeek(g),g.leagueId);return;}
    if(!g.pick&&!g.lineup){showPredictions(g);return;}
    const c = choice(g) || (state.choices[g.leagueId]={draft:[],saved:false});
    const allowed = eligible(g);
    c.draft = c.draft.filter(id=>allowed.some(p=>p.id===id));
    const need = g.pick?1:g.lineup.need;
    openSheet(g.pick?'Pick who survives':'Set your lineup', `<p class="sheet-lead"><b>${esc(gameLabel(g))}</b> · ${esc(episodeName(gameWeek(g)))}<br>${g.pick?'Pick one castaway you think stays in.':'Choose '+need+' starters from your roster.'}</p><div class="selection-summary" id="selection-summary"></div><div class="choice-grid">${allowed.map(c=>`<div class="choice-item"><button class="cast-choice" data-action="choose" data-value="${esc(c.id)}" aria-pressed="false" aria-label="Choose ${esc(c.name)}"><img src="${esc(c.photo)}" alt=""><span>${esc(c.name.split(' ')[0])}</span></button><button class="cast-info" data-action="result-cast" data-name="${esc(c.name)}" data-game="${g.leagueId}" data-episode="${state.seen}">Stats for ${esc(c.name.split(' ')[0])} ${icon('next')}</button></div>`).join('')}</div><details class="research"><summary>Look at the stats before choosing</summary><p>Show facts through episode ${Math.min(state.seen,initialSeen)}. Game-specific scoring and comparisons are in the full game.</p>${allowed.map(c=>{const s=stats?.cast?.find(x=>x.name===c.name),n=s?.events?.filter(e=>e[0]<=Math.min(state.seen,initialSeen)).length;return `<div class="metric-row"><button class="text-action" data-action="result-cast" data-name="${esc(c.name)}" data-game="${g.leagueId}" data-episode="${state.seen}">${esc(c.name)}</button><span>${n==null?'No captured moments':n+' recorded moments'}</span></div>`;}).join('')}<a class="button quiet" href="${route('game/'+g.leagueId)}" target="_blank" rel="noopener">Full game & player decisions ${icon('external')}</a></details><div class="sheet-footer">${btn('Save '+(g.pick?'pick':'lineup'),'save-choice',g.leagueId,'primary')}${link('Full game '+icon('external'),route('game/'+g.leagueId),'quiet')}</div><p class="privacy-note">Pick → watch → reveal. Your current draft stays here while you inspect the stats. Saved choices in this review are local.</p>`, 'game');
    updateChoices();
  }
  function updateChoices() {
    if(!activeGame)return; const g=activeGame,c=choice(g),need=g.pick?1:g.lineup.need;
    document.querySelectorAll('.cast-choice').forEach(b=>b.setAttribute('aria-pressed',String(c.draft.includes(b.dataset.value))));
    $('selection-summary').textContent = g.pick?(c.draft.length?g.cast.find(x=>x.id===c.draft[0])?.name+' selected':'Choose your castaway'):c.draft.length+' of '+need+' starters selected';
    document.querySelector('[data-action="save-choice"]').disabled = c.draft.length!==need;
  }
  function showGifs() {
    openSheet('Your episode, in a GIF', `<p class="sheet-lead">How was <b>${esc(episodeName(state.seen))}</b>? Pick your reaction.</p><input class="picker-search" id="gif-search" placeholder="Search these sample GIFs" aria-label="Search sample GIFs"><div class="gif-grid" id="gif-grid">${gifNames.map((title,i)=>`<button data-action="react" data-value="${i}" data-gif-name="${esc(title.toLowerCase())}">${gifImage(i,title)}<span>${esc(title)}</span></button>`).join('')}</div><p id="gif-no-results" class="privacy-note" hidden>No matches in these three sample GIFs. Try “eyes”, “chair” or “triste”.</p><p class="gif-credit">Powered by KLIPY · cached review selection</p>${state.reactions[state.seen]!==undefined?`<div class="sheet-footer">${btn('Remove my reaction','remove-reaction','','quiet')}</div>`:''}`, 'gifs');
    $('gif-search').oninput=e=>{let count=0;document.querySelectorAll('[data-gif-name]').forEach(b=>{b.hidden=!b.dataset.gifName.includes(e.target.value.toLowerCase());if(!b.hidden)count++;});$('gif-no-results').hidden=count>0;};
  }
  function showChat() {
    const messages = [...(state.seen===initialSeen?social.messages:[]),...(state.messages[state.seen] || [])];
    openSheet('Discuss episode '+state.seen, `<p class="sheet-lead">${esc(space.show.name)} · Episode ${state.seen}. This conversation is for the episode you’ve watched.</p><div id="messages">${messages.map(m=>`<div class="bubble"><b>${esc(m.person)}</b>${m.gif!==undefined?gifImage(m.gif,'Your GIF reaction'):`<p>${esc(m.text)}</p>`}</div>`).join('')||'<p class="privacy-note">Start the conversation.</p>'}</div><form class="chat-compose" id="chat-form"><input class="picker-search" aria-label="Message about your watched episode" name="message" placeholder="That episode…" maxlength="1000" required autocomplete="off"><button class="button primary" type="submit" aria-label="Send message">${icon('send')}</button></form><div class="sheet-footer">${btn('Add an episode GIF','gifs','','quiet')}</div><p class="privacy-note">An episode label cannot guarantee that messages are spoiler-free.</p>`, 'chat');
    $('chat-form').onsubmit=e=>{e.preventDefault();const input=e.target.elements.message,text=input.value.trim();if(!text)return;(state.messages[state.seen] ||= []).push({person:'You',text});persist();showChat();document.querySelector('#chat-form input').focus();};
  }
  function confirmWatched(number = next()) {
    if(number<=state.seen){toast(`Episode ${number} is already marked watched.`);return;}
    if(number>space.schedule.latestAired){toast('This episode has not been released yet.');return;}
    const pending = isPlayer()?currentGames().filter(g=>gameWeek(g)===number&&!saved(g)):[];
    openSheet('Finished episode '+number+'?', `<p class="sheet-lead">Mark <b>${esc(episodeName(number))}</b> as watched?</p>${pending.length?`<div class="warning">${pending.length} game ${pending.length===1?'choice is':'choices are'} still unsaved. You can go back to make them, or continue without them.</div>`:''}<p class="sheet-lead">${isPlayer()?'Game results stay hidden until you reveal the episode across all your games.':'Your next episode and conversation will move forward.'}</p><div class="sheet-footer">${btn(pending.length?'Continue without those choices':'Mark episode '+number+' watched','confirm-watched',number,'primary')}${btn('Go back','close','','quiet')}</div>`, 'watched');
  }
  function elapsed() {const c=state.clock;return Math.max(0,c.seconds+(c.startedAt?(Date.now()-c.startedAt)/1000:0));}
  const time = n => {n=Math.floor(n);return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');};
  function showWatch(number = next()) {
    if(state.clock.episode!==number)state.clock={episode:number,seconds:0,startedAt:null};
    openSheet('Watch along · Episode '+number, `<p class="sheet-lead">${episode(number)?.title?`<b>${esc(episode(number).title)}</b><br>`:''}Start this companion clock when episode ${number} starts on your TV.</p><div class="watch-scene"><img src="/art/generated/island-night-v1.png" alt="A torch beside the island at night"></div><div id="watch-clock" class="watch-clock" aria-label="Playback position">${time(elapsed())}</div><div class="clock-controls">${btn('−30s','nudge',-30,'quiet')}${btn(icon(state.clock.startedAt?'pause':'play')+(state.clock.startedAt?' Pause':' Start'),'clock','','primary')}${btn('+30s','nudge',30,'quiet')}</div><p class="watch-status">Your personal clock. You can leave and return without losing your place.</p><div class="sheet-footer">${btn('I finished episode '+number,'watched',number,'quiet')}</div>`, 'watch');
    clearInterval(clockTick);clockTick=setInterval(()=>{if($('watch-clock'))$('watch-clock').textContent=time(elapsed());},250);
  }
  function showRecap() {
    if(isPlayer()){results.openSummary(state.seen);return;}
    const e=recapFor(state.seen);
    openSheet('Episode '+state.seen+' recap', `<p class="sheet-lead">${esc(space.show.name)} · ${esc(episodeName(state.seen))}. Only the episode you have watched.</p>${e?`<h3>What happened</h3>${e.out.map(p=>`<button class="result-line result-recap-cast" data-action="result-cast" data-name="${esc(p.name)}" data-episode="${state.seen}"><img src="${esc(p.photo)}" alt=""><span><b>${esc(p.name)}</b><small>${esc(p.method)}</small></span>${icon('next')}</button>`).join('')}${e.happened.map(h=>`<div class="result-line"><span><b>${esc(h.label)}</b><small>${esc(h.winners.map(w=>w.name).join(', '))}</small></span></div>`).join('')}`:`<p class="sheet-lead">${isPlayer()&&currentGames().some(g=>g.through<state.seen)?'Reveal this episode in your games first. Its recap also needs captured episode data.':'A recap for this episode is not included in the captured review data.'}</p>`}<div class="sheet-footer">${btn('React with a GIF','gifs','','primary')}${btn('Discuss episode '+state.seen,'chat','','quiet')}</div>`, 'recap');
  }
  document.addEventListener('click', e => {
    const b=e.target.closest('[data-action]');if(!b)return;e.preventDefault();const action=b.dataset.action,value=b.dataset.value;
    if(action==='top'){scrollTo({top:0,behavior:reduced.matches?'instant':'smooth'});return;}
    if(action==='close'){closeSheet();return;}
    if(action==='episodes')showEpisodes();
    if(action==='quick-actions')showQuickActions();
    if(action==='friends')showFriends();
    if(action==='game')showGame(value);
    if(action==='prediction-pick'){state.predictionDrafts ||= {};state.predictionDrafts[b.dataset.game]=value;persist();document.querySelectorAll('[data-action=prediction-pick]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.value===value)));document.querySelector('[data-action=prediction-save]').disabled=false;}
    if(action==='prediction-save'){state.choices[b.dataset.game]={saved:true,draft:[state.predictionDrafts[b.dataset.game]],committed:[state.predictionDrafts[b.dataset.game]]};persist();if(sheetStack.length&&sheetStack.at(-1).type==='quick-actions'){backSheet();showQuickActions(true);}else closeSheet();render();toast('Prediction saved in this preview.');}
    if(action==='gifs')showGifs();
    if(action==='chat')showChat();
    if(action==='recap')showRecap();
    if(action==='watched')confirmWatched(Number(value)||next());
    if(action==='confirm-watched'){state.seen=Number(value);persist();closeSheet();render();toast('Marked watched. Game results stay hidden.');}
    if(action==='set-progress'){state.seen=Number(value);persist();render();showEpisodes();}
    if(action==='choose'){const c=choice(activeGame),need=activeGame.pick?1:activeGame.lineup.need;if(c.draft.includes(value))c.draft=c.draft.filter(id=>id!==value);else if(need===1)c.draft=[value];else if(c.draft.length<need)c.draft.push(value);else{toast('Choose '+need+' starters. Deselect one to swap.');return;}persist();updateChoices();}
    if(action==='save-choice'){const c=choice(activeGame);c.saved=true;c.committed=[...c.draft];persist();if(sheetStack.length&&sheetStack.at(-1).type==='quick-actions'){backSheet();showQuickActions(true);}else closeSheet();render();toast('Saved. One less thing before the episode.');}
    if(action==='react'){state.reactions[state.seen]=Number(value);persist();if(sheetStack.length){backSheet();if(currentSheet==='showcase')results.redrawShowcase();}else closeSheet();render();toast('Your episode GIF is up.');}
    if(action==='remove-reaction'){delete state.reactions[state.seen];persist();closeSheet();render();toast('Reaction removed.');}
    if(action==='like'){const id=state.seen+':'+value;state.likes[id]=!state.likes[id];persist();render();}
    if(action==='motion'){paused=!paused;render();}
    if(action==='watch')showWatch(Number(value)||next());
    if(action==='clock'){const seconds=elapsed();state.clock={...state.clock,seconds,startedAt:state.clock.startedAt?null:Date.now()};persist();showWatch(state.clock.episode);}
    if(action==='nudge'){const seconds=Math.max(0,elapsed()+Number(value));state.clock={...state.clock,seconds,startedAt:state.clock.startedAt?Date.now():null};persist();showWatch(state.clock.episode);}
    if(action==='pace-help')openSheet('Play on your schedule',`<p class="sheet-lead">Make your picks before watching. Watch the episode, then reveal when you’re ready. Keep it fair for your couch: it’s the honor system.</p><p class="sheet-lead">A game maker can choose <b>Live only</b> for a game. That game uses shared deadlines; it doesn’t change your personal watching progress.</p><div class="sheet-footer">${link('See your games',route('games'),'quiet')}</div>`, 'pace-help');
    if(action==='about')openSheet(space.show.name,`<p class="sheet-lead">Season ${space.seasonNumber} · ${esc(space.show.network || '')}.</p><div class="sheet-footer">${btn('Change viewing position','episodes')}${btn('How play works','pace-help','','quiet')}${link('Show settings',route('backstage'),'quiet')}</div>`, 'about');
    if(action==='reset'){localStorage.removeItem(key);location.reload();}
  });
  Promise.all([fetch('/__atlas/data').then(r=>{if(!r.ok)throw Error('The selected atlas data could not load.');return r.json();}),fetch('/__atlas/mock/tonight-social-fixture.json').then(r=>r.json())]).then(([d,s])=>{
    data=d;social=s;space=get('/space');games=get('/games');episodes=get('/episodes');stats=get('/stats');home=get('/api/me/home');
    if(!space?.schedule?.episodes?.length||!episodes||!games)throw Error('This proposal needs a recorded show, episode list and games projection. Select Tonight / Watching only or Multiplayer catch-up in the atlas.');
    initialSeen=space.you.seenThrough || 0;key=(window.__TONIGHT_REVIEW_STORAGE__||'tonight-pilot-v4')+':'+data.dataset+':'+data.case.id+':'+data.capturedAt;
    const defaults={seen:initialSeen,choices:{},reactions:{},messages:{},likes:{},clock:{episode:initialSeen+1,seconds:0,startedAt:null}};
    try{state=JSON.parse(localStorage.getItem(key))||defaults;}catch{state=defaults;}
    for(const c of Object.values(state.choices))if(c.saved&&!c.committed)c.committed=[...c.draft];
    results=window.TonightResults({esc,icon,btn,link,openSheet,closeSheet,backSheet,persist,render,toast,avatar,gameLabel,route,nameOf,reactions,gifImage,gameWeek, data:()=>data,space:()=>space,games:currentGames,state:()=>state,episodes:()=>episodes,stats:()=>stats,initialSeen:()=>initialSeen,sheetType:()=>currentSheet,animate:animateStats,mini:(g,n,style)=>view.mini(g,n,style)});
    view=window.TonightV4Layout({openSheet,closeSheet,backSheet,persist,render,toast,originalEpisodeMarkup,showOriginalEpisodes,esc,icon,btn,avatar,gameLabel,route,nameOf,reactions,gifImage,episodeMemory,episodeDescription,date,next,isPlayer,decisions, data:()=>data,space:()=>space,games:currentGames,state:()=>state,episodes:()=>episodes,home:()=>home,results:()=>results,paused:()=>paused});
    render();window.__TONIGHT_PILOT__={version:'V4',caseId:data.case.id,socialFixture:s.kind,initialSeen,ready:true};
  }).catch(e=>{$('app').setAttribute('aria-busy','false');$('app').innerHTML=`<div class="loading"><h1>Your episode couldn’t load</h1><p class="sheet-lead">${esc(e.message)}</p><button class="button primary" onclick="location.reload()">Try again</button></div>`;});
})();
