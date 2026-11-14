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
  const episodeName = number => episode(number)?.title || date(number);
  const episodeDescription = number => episode(number)?.title ? `${date(number)} · Episode ${number}` : `Episode ${number}`;
  const route = tab => '/show/' + data.context.seasonId + '/' + tab;
  const currentGames = () => games.games.filter(g => space.games.some(s => s.leagueId === g.leagueId));
  const isPlayer = () => !!space.you.plays && currentGames().length > 0;
  const next = () => Math.min(state.seen + 1, space.episodeCount || state.seen + 1);
  const gameWeek = g => g.catchUp?.week || g.pick?.episode || g.lineup?.episode || next();
  const choice = g => state.choices[g.leagueId];
  const saved = g => !!choice(g)?.saved;
  const gameLabel = g => {
    const same = currentGames().filter(x => x.name === g.name);
    return g.name + (same.length > 1 ? (same[0].leagueId === g.leagueId ? ' · A' : ' · B') : '');
  };
  function persist() { localStorage.setItem(key, JSON.stringify(state)); }
  function toast(text) { clearTimeout(toastTimeout); $('toast').textContent = text; $('toast').classList.add('visible'); toastTimeout = setTimeout(() => $('toast').classList.remove('visible'), 3000); }
  function openSheet(title, html, type) {
    if (!dialog.open) restoreFocus = document.activeElement;
    currentSheet = type;
    $('detail-title').textContent = title;
    $('detail-body').innerHTML = html;
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    preparePosters();
  }
  function closeSheet() { dialog.close(); clearInterval(clockTick); clockTick = null; restoreFocus?.focus(); }
  $('close-detail').innerHTML = icon('close');
  $('close-detail').onclick = closeSheet;
  dialog.addEventListener('cancel', e => { e.preventDefault(); closeSheet(); });
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
    if (mine !== undefined) list.unshift({id:'mine',person:'You',gif:mine,caption:'My episode, in a GIF.',likes:0});
    return list;
  }
  function render() {
    const focused = $('app').contains(document.activeElement) ? document.activeElement.closest('[data-action]') : null;
    const focusAction = focused?.dataset.action, focusValue = focused?.dataset.value;
    const player = isPlayer(), watched = state.seen, forthcoming = next(), mine = state.reactions[watched] !== undefined;
    document.documentElement.dataset.theme = data.theme || 'night';
    const friends = space.people.filter(p => p.userId !== data.context.userId), ahead = friends.filter(p => p.seen > watched);
    $('app').setAttribute('aria-busy', 'false');
    $('app').innerHTML = `<main class="wrap ${player?'player':'watcher'}" data-tonight-pilot="${player?'playing':'watching'}">
      <header class="show-head">
        <img class="show-art" src="${esc(space.show.artUrl)}" alt="">
        <div class="topline"><a class="home-link" href="/home" target="_blank" rel="noopener">${icon('back')} Home</a><span class="season">Season ${space.seasonNumber}</span><button class="icon-button" data-action="about" aria-label="Show options">${icon('more')}</button></div>
        <h1 class="display">${esc(space.show.name)}</h1><p class="network">${esc(home?.couches?.find(c=>c.id===space.couchId)?.name || 'Your couch')} · At your pace</p>
      </header>
      <div class="content">
        <div class="viewing-column">
          <div class="position" aria-label="Your viewing position">
            <button data-action="episodes" data-value="current" aria-label="Change last watched episode: ${esc(episodeName(watched))}"><span class="label">${icon('check')} Last watched</span><strong class="${episode(watched)?.title?'has-title':''}">${esc(episodeName(watched))}</strong><small>${esc(episodeDescription(watched))}</small></button>
            <button class="next-position" data-action="episodes" data-value="next" aria-label="Your next episode: ${esc(episodeName(forthcoming))}"><span class="label">Next for you</span><strong class="${episode(forthcoming)?.title?'has-title':''}">${esc(episodeName(forthcoming))} ${icon('down')}</strong><small>${esc(episodeDescription(forthcoming))} · ${forthcoming <= space.schedule.latestAired?'Ready to watch':'Not released yet'}</small></button>
          </div>
          <button class="people-strip" data-action="friends"><span class="avatars">${friends.slice(0,3).map(p=>avatar(nameOf(p))).join('')}</span><span>${ahead.length?`<b>${ahead.length} friends ahead.</b> Keep your own pace.`:'See where your friends are watching.'}</span>${icon('next')}</button>
          ${player ? `<section class="game-block" aria-label="Quick game decisions"><div class="section-heading"><h2>Before you watch</h2><a href="${route('games')}" target="_blank" rel="noopener">All games ${icon('external')}</a></div><div class="game-loop" aria-label="Pick, watch, then reveal"><b>${currentGames().every(saved)?'Picks saved':'Pick'}</b>${icon('next')}<span>Watch</span>${icon('next')}<span>Reveal</span></div>
            ${currentGames().map(g=>{const done=saved(g),item=choice(g),faceName=g.cast.find(c=>c.id===item?.committed?.[0])?.name;return `<div class="game-row ${done?'is-saved':''}" data-game-row="${esc(g.leagueId)}"><span class="game-icon ${g.pick?'':'roster'}">${icon(g.pick?'shield':'cast')}</span><span class="game-label"><strong>${esc(gameLabel(g))}</strong><small class="${done?'saved-state':''}">${gameWeek(g)!==next()&&gameWeek(g)>state.seen?esc(date(gameWeek(g)))+' · ':''}${gameWeek(g) <= state.seen ? 'Watched · ready for your reveal' : done ? (g.pick?esc(faceName?.split(' ')[0] || 'Pick')+' saved':item.committed.length+' starters saved') : (g.pick?'Pick one castaway to stay in':'Choose '+g.lineup?.need+' starters')}</small></span><button class="game-action" data-action="game" data-value="${esc(g.leagueId)}">${done?icon('check'):''}${gameWeek(g) <= state.seen?'Reveal':done?'Edit':g.pick?'Pick':'Set'}${icon('next')}</button></div>`;}).join('')}
          </section>` : ''}
          <div class="watch-actions">${btn(icon('play')+' Watch along','watch','',player?'':'primary')}${btn(icon('check')+" I’ve watched it",'watched','','quiet')}</div>
        </div>
        <section class="social" aria-label="Reactions to your last watched episode">
          <div class="section-heading"><div class="social-title"><h2>That last episode.</h2><p>${esc(date(watched))} · Your episode ${watched}</p></div><div class="social-actions"><button class="social-chat" data-action="chat" aria-label="Chat about your last watched episode">${icon('chat')}<span>Chat</span></button><button class="add-gif" data-action="gifs">${icon(mine?'image':'plus')}${mine?'Your GIF':'Add a GIF'}</button></div></div>
          <div class="reaction-wall">${reactions().map(r=>`<article class="reaction" data-reaction="${r.id}"><div class="gif-visual">${gifImage(r.gif, r.person+'’s episode reaction: '+gifNames[r.gif])}<span class="gif-caption">${esc(r.caption)}</span></div><div class="reaction-meta"><span class="reaction-name">${avatar(r.person==='You'?'Alex':r.person)}${esc(r.person)}</span><button class="like" data-action="like" data-value="${r.id}" aria-label="Like ${esc(r.person)}’s reaction" aria-pressed="${!!state.likes[watched+':'+r.id]}">${icon('heart')}${r.likes+(state.likes[watched+':'+r.id]?1:0)}</button></div></article>`).join('') || '<p class="empty-social">Your episode deserves a GIF. Be the first.</p>'}</div>
          <button class="chat-entry" data-action="chat">${icon('chat')}<span>Talk about ${esc(date(watched))}</span><span class="right">Join in ${icon('next')}</span></button>
          <div class="wall-footer"><button class="gif-pause" data-action="motion">${icon(paused?'play':'pause')}${paused?'Play GIFs':'Pause GIFs'}</button><p class="gif-credit">Powered by KLIPY</p></div>
        </section>
        <button class="recap-link" data-action="recap"><span>${icon('episodes')} Revisit ${esc(date(watched))}</span>${icon('next')}</button>
        <p class="lower-note">${player?'Your picks, standings and full game breakdowns live in ': 'Feel like playing this episode? Explore '}<a href="${route('games')}" target="_blank" rel="noopener">Games</a>.</p>
      </div>
      <nav class="tabbar" aria-label="Show navigation"><a href="#" aria-current="page" data-action="top">${icon('tv')}Tonight</a>${[['episodes','episodes','Episodes'],['games','games','Games'],['cast','cast','Cast'],['chat','chat','Chat']].map(([tab,symbol,label])=>`<a href="${route(tab)}" target="_blank" rel="noopener">${icon(symbol)}${label}</a>`).join('')}</nav>
    </main>
    <details class="prototype-note"><summary>About this design preview</summary><p>Recorded show, cast and episode data from the active atlas case. Dates are the local fixture schedule; titles are absent in this dataset. Names, GIF reactions, messages and likes are illustrative. Duplicate lineup names use A/B labels for this review.</p><p>Changes here stay in this browser. Full-game links open the current application with the selected fixture data. Result revelation is a handoff; later episode outcomes are not loaded into this proposal.</p><button data-action="reset">Reset preview changes</button></details>`;
    preparePosters();
    if (focusAction && !dialog.open) [...document.querySelectorAll('[data-action]')].find(b => b.dataset.action === focusAction && b.dataset.value === focusValue)?.focus({preventScroll:true});
  }
  function showEpisodes() {
    const released = space.schedule.latestAired;
    openSheet('Your place in the season', `<p class="sheet-lead">Last watched: <b>${esc(episodeName(state.seen))}</b>. Next for you: <b>${esc(episodeName(next()))}</b>.</p>${space.schedule.episodes.map(e=>`<div class="episode-option"><span class="episode-number">E${e.number}</span><span class="episode-info"><strong>${esc(episodeName(e.number))}</strong><small>${e.number<state.seen?'Watched':e.number===state.seen?'Your last watched episode':e.number===next()?'Next for you':e.number<=released?'Available · not watched':'Not released yet'}</small></span>${e.number<=initialSeen&&e.number!==state.seen?btn('Set as watched','set-progress',e.number,'quiet'):e.number===next()&&e.number<=released?btn('I watched it','watched','','small'):e.number===state.seen?icon('check'):icon('lock')}</div>`).join('')}<p class="privacy-note">Moving your viewing position does not reveal game results. Later episode reactions and outcomes stay out of this overview.</p>`, 'episodes');
  }
  function showFriends() {
    const friends = space.people.filter(p=>p.userId!==data.context.userId);
    openSheet('Everyone’s at their own pace', `<p class="sheet-lead">You last watched <b>${esc(episodeName(state.seen))}</b>. Talk about an episode you’ve both watched.</p>${friends.map(p=>`<div class="person-row">${avatar(nameOf(p))}<div><b>${esc(nameOf(p))}</b><small>${p.seen == null?'Progress not shared':`Last watched ${esc(date(p.seen))} · E${p.seen}`}</small></div><span class="status">${p.seen==null?'Private':p.seen>state.seen?'Ahead':p.seen===state.seen?'With you':'Behind'}</span></div>`).join('')}<div class="sheet-footer">${btn('Chat about '+date(state.seen),'chat')}</div><p class="privacy-note">Episode threads provide context; freeform messages can still contain spoilers.</p>`, 'friends');
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
    if(gameWeek(g)<=state.seen){
      openSheet(gameLabel(g), `<p class="sheet-lead">You watched <b>${esc(episodeName(gameWeek(g)))}</b>. Your results stay hidden until you choose to reveal them in this game.</p><div class="sheet-footer">${link('Open game & reveal '+icon('external'),route('game/'+g.leagueId),'primary')}</div><p class="privacy-note">Opening the game does not automatically reveal the result.</p>`, 'reveal');return;
    }
    const c = choice(g) || (state.choices[g.leagueId]={draft:[],saved:false});
    const allowed = eligible(g);
    c.draft = c.draft.filter(id=>allowed.some(p=>p.id===id));
    const need = g.pick?1:g.lineup.need;
    openSheet(g.pick?'Pick who survives':'Set your lineup', `<p class="sheet-lead"><b>${esc(gameLabel(g))}</b> · ${esc(episodeName(gameWeek(g)))}<br>${g.pick?'Pick one castaway you think stays in.':'Choose '+need+' starters from your roster.'}</p><div class="selection-summary" id="selection-summary"></div><div class="choice-grid">${allowed.map(c=>`<button class="cast-choice" data-action="choose" data-value="${esc(c.id)}" aria-pressed="false" aria-label="Choose ${esc(c.name)}"><img src="${esc(c.photo)}" alt=""><span>${esc(c.name.split(' ')[0])}</span></button>`).join('')}</div><details class="research"><summary>Look at the stats before choosing</summary><p>Show facts through ${esc(date(Math.min(state.seen,initialSeen)))}. Game-specific scoring and comparisons are in the full game.</p>${allowed.map(c=>{const s=stats?.cast?.find(x=>x.name===c.name),n=s?.events?.filter(e=>e[0]<=Math.min(state.seen,initialSeen)).length;return `<div class="metric-row"><b>${esc(c.name)}</b><span>${n==null?'No captured moments':n+' recorded moments'}</span></div>`;}).join('')}<a class="button quiet" href="${route('game/'+g.leagueId)}" target="_blank" rel="noopener">Full game & player decisions ${icon('external')}</a></details><div class="sheet-footer">${btn('Save '+(g.pick?'pick':'lineup'),'save-choice',g.leagueId,'primary')}${link('Full game '+icon('external'),route('game/'+g.leagueId),'quiet')}</div><p class="privacy-note">Pick → watch → reveal. Your current draft stays here while you inspect the stats. Saved choices in this review are local.</p>`, 'game');
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
    openSheet('Talk about '+date(state.seen), `<p class="sheet-lead">${esc(space.show.name)} · Episode ${state.seen}. This conversation is for the episode you’ve watched.</p><div id="messages">${messages.map(m=>`<div class="bubble"><b>${esc(m.person)}</b>${m.gif!==undefined?gifImage(m.gif,'Your GIF reaction'):`<p>${esc(m.text)}</p>`}</div>`).join('')||'<p class="privacy-note">Start the conversation.</p>'}</div><form class="chat-compose" id="chat-form"><input class="picker-search" aria-label="Message about your watched episode" name="message" placeholder="That episode…" maxlength="1000" required autocomplete="off"><button class="button primary" type="submit" aria-label="Send message">${icon('send')}</button></form><div class="sheet-footer">${btn('Add an episode GIF','gifs','','quiet')}</div><p class="privacy-note">An episode label cannot guarantee that messages are spoiler-free.</p>`, 'chat');
    $('chat-form').onsubmit=e=>{e.preventDefault();const input=e.target.elements.message,text=input.value.trim();if(!text)return;(state.messages[state.seen] ||= []).push({person:'You',text});persist();showChat();document.querySelector('#chat-form input').focus();};
  }
  function confirmWatched() {
    const number = next();
    if(number>space.schedule.latestAired){toast('This episode has not been released yet.');return;}
    const pending = isPlayer()?currentGames().filter(g=>gameWeek(g)===number&&!saved(g)):[];
    openSheet('Finished '+episodeName(number)+'?', `<p class="sheet-lead">Mark <b>${esc(episodeName(number))}</b> · Episode ${number} as watched?</p>${pending.length?`<div class="warning">${pending.length} game ${pending.length===1?'choice is':'choices are'} still unsaved. You can go back to make them, or continue without them.</div>`:''}<p class="sheet-lead">${isPlayer()?'Game results remain hidden. Reveal them separately in each game.':'Your next episode and conversation will move forward.'}</p><div class="sheet-footer">${btn(pending.length?'Continue without those choices':'Mark as watched','confirm-watched',number,'primary')}${btn('Go back','close','','quiet')}</div>`, 'watched');
  }
  function elapsed() {const c=state.clock;return Math.max(0,c.seconds+(c.startedAt?(Date.now()-c.startedAt)/1000:0));}
  const time = n => {n=Math.floor(n);return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');};
  function showWatch() {
    if(state.clock.episode!==next())state.clock={episode:next(),seconds:0,startedAt:null};
    openSheet('Watch along · '+date(next()), `<p class="sheet-lead">Start this companion clock when your episode starts on your TV.</p><div class="watch-scene"><img src="/art/generated/island-night-v1.png" alt="A torch beside the island at night"></div><div id="watch-clock" class="watch-clock" aria-label="Playback position">${time(elapsed())}</div><div class="clock-controls">${btn('−30s','nudge',-30,'quiet')}${btn(icon(state.clock.startedAt?'pause':'play')+(state.clock.startedAt?' Pause':' Start'),'clock','','primary')}${btn('+30s','nudge',30,'quiet')}</div><p class="watch-status">Your personal clock. You can leave and return without losing your place.</p><div class="sheet-footer">${btn('I finished it','watched','','quiet')}</div>`, 'watch');
    clearInterval(clockTick);clockTick=setInterval(()=>{if($('watch-clock'))$('watch-clock').textContent=time(elapsed());},250);
  }
  function showRecap() {
    const e=episodes.episodes.find(e=>e.number===state.seen);
    openSheet('Revisit '+date(state.seen), `<p class="sheet-lead">${esc(space.show.name)} · Episode ${state.seen}. Only the episode you have watched.</p>${e&&state.seen<=initialSeen?`<h3>What happened</h3>${e.out.map(p=>`<div class="result-line"><img src="${esc(p.photo)}" alt=""><span><b>${esc(p.name)}</b><small>${esc(p.method)}</small></span></div>`).join('')}${e.happened.map(h=>`<div class="result-line"><span><b>${esc(h.label)}</b><small>${esc(h.winners.map(w=>w.name).join(', '))}</small></span></div>`).join('')}`:'<p class="sheet-lead">A recap for this episode is not included in the captured review data.</p>'}<div class="sheet-footer">${btn('React with a GIF','gifs','','primary')}${btn('Episode conversation','chat','','quiet')}</div>`, 'recap');
  }
  document.addEventListener('click', e => {
    const b=e.target.closest('[data-action]');if(!b)return;e.preventDefault();const action=b.dataset.action,value=b.dataset.value;
    if(action==='top'){scrollTo({top:0,behavior:reduced.matches?'instant':'smooth'});return;}
    if(action==='close'){closeSheet();return;}
    if(action==='episodes')showEpisodes();
    if(action==='friends')showFriends();
    if(action==='game')showGame(value);
    if(action==='gifs')showGifs();
    if(action==='chat')showChat();
    if(action==='recap')showRecap();
    if(action==='watched')confirmWatched();
    if(action==='confirm-watched'){state.seen=Number(value);persist();closeSheet();render();toast('Marked watched. Game results stay hidden.');}
    if(action==='set-progress'){state.seen=Number(value);persist();render();showEpisodes();}
    if(action==='choose'){const c=choice(activeGame),need=activeGame.pick?1:activeGame.lineup.need;if(c.draft.includes(value))c.draft=c.draft.filter(id=>id!==value);else if(need===1)c.draft=[value];else if(c.draft.length<need)c.draft.push(value);else{toast('Choose '+need+' starters. Deselect one to swap.');return;}persist();updateChoices();}
    if(action==='save-choice'){const c=choice(activeGame);c.saved=true;c.committed=[...c.draft];persist();closeSheet();render();toast('Saved in this preview. Ready when you are.');}
    if(action==='react'){state.reactions[state.seen]=Number(value);persist();closeSheet();render();toast('Your episode GIF is up.');}
    if(action==='remove-reaction'){delete state.reactions[state.seen];persist();closeSheet();render();toast('Reaction removed.');}
    if(action==='like'){const id=state.seen+':'+value;state.likes[id]=!state.likes[id];persist();render();}
    if(action==='motion'){paused=!paused;render();}
    if(action==='watch')showWatch();
    if(action==='clock'){const seconds=elapsed();state.clock={...state.clock,seconds,startedAt:state.clock.startedAt?null:Date.now()};persist();showWatch();}
    if(action==='nudge'){const seconds=Math.max(0,elapsed()+Number(value));state.clock={...state.clock,seconds,startedAt:state.clock.startedAt?Date.now():null};persist();showWatch();}
    if(action==='about')openSheet(space.show.name,`<p class="sheet-lead">Season ${space.seasonNumber} · ${esc(space.show.network || '')}. Watching at your own pace.</p><div class="sheet-footer">${btn('Change viewing position','episodes')}${link('Show settings',route('backstage'),'quiet')}</div>`, 'about');
    if(action==='reset'){localStorage.removeItem(key);location.reload();}
  });
  Promise.all([fetch('/__atlas/data').then(r=>{if(!r.ok)throw Error('The selected atlas data could not load.');return r.json();}),fetch('/__atlas/mock/tonight-social-fixture.json').then(r=>r.json())]).then(([d,s])=>{
    data=d;social=s;space=get('/space');games=get('/games');episodes=get('/episodes');stats=get('/stats');home=get('/api/me/home');
    if(!space?.schedule?.episodes?.length||!episodes||!games)throw Error('This proposal needs a recorded show, episode list and games projection. Select Tonight / Watching only or Multiplayer catch-up in the atlas.');
    initialSeen=space.you.seenThrough || 0;key='tonight-pilot-v1:'+data.dataset+':'+data.case.id+':'+data.capturedAt;
    const defaults={seen:initialSeen,choices:{},reactions:{},messages:{},likes:{},clock:{episode:initialSeen+1,seconds:0,startedAt:null}};
    try{state=JSON.parse(localStorage.getItem(key))||defaults;}catch{state=defaults;}
    for(const c of Object.values(state.choices))if(c.saved&&!c.committed)c.committed=[...c.draft];
    render();window.__TONIGHT_PILOT__={caseId:data.case.id,socialFixture:s.kind,initialSeen,ready:true};
  }).catch(e=>{$('app').setAttribute('aria-busy','false');$('app').innerHTML=`<div class="loading"><h1>Your episode couldn’t load</h1><p class="sheet-lead">${esc(e.message)}</p><button class="button primary" onclick="location.reload()">Try again</button></div>`;});
})();
