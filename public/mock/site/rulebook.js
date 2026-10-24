// ================= kinds of show and their rulebooks (decided with the user 2026-10-24) =================
// A rulebook says what a show is and what can happen in it; a game decides how a couch plays with that
// (docs/PLAN-admin-shows-rulebooks.md). Decided today:
//   The kind is inferred from the TV listing and ChatGPT's answer, never asked up front: Make it a game's review shows
//   it as one line with Change. Four kinds: a competition · a series (reality or scripted: one kind, two starting
//   points) · talk, variety or awards · a sport or live event. The kind renames the rulebook's parts, hides the ones
//   that don't apply, sets where results come from and decides which games fit.
//   Games that fit: competition = Survival Pool, Weekly Lineup, Outlast · series = Weekly Lineup · sport = Weekly
//   Lineup, Survival Pool · talk = Weekly Bingo, Weekly Calls. Episode games (bingo, call it) work on every show.
//   How the season works: one readable page for everyone (Games tab, Make it a game, Backstage, admin).
//   Backstage › Scoring rules: "Following Survivor 51's rulebook" or "Make it ours" (the couch chooses what counts;
//   fixes still reach it, show changes ask first). Points were always the couch's.
//   The show changed: research finds something the rulebook lacks; a second couch agreeing adds it from that
//   episode for every couch following it. Admin: Find › a rulebook: Override a part (Fix a mistake / The show
//   changed), Lock, History.
// Two new shows for the kinds the mock lacked: Saturday Night Live (talk) and Formula 1 (a sport, played in full).
// Key art for both is generated (no licensed art): showcase/art/late-night.jpg and f1.jpg.
Object.assign(ICON,{book:'<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/>',
  mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/>',flag:'<path d="M5 21V4M5 4h12l-2 4 2 4H5"/>',
  door:'<path d="M14 3H6v18h8"/><path d="m14 3 5 2v14l-5 2zM11 12h.01"/>',shuffle:'<path d="M3 6h4l10 12h4M3 18h4l3-3.6M14 9.6 17 6h4M18 3l3 3-3 3M18 15l3 3-3 3"/>'});

// ---------- the four kinds ----------
const RBK={
  comp:{name:'A competition',ic:'cup',d:'People get knocked out until someone wins',like:'Survivor, The Amazing Race, Bake Off',
    L:["Who's playing",'The season','Each episode','Ways out','Twists','What scores'],src:'Who went home minutes after the episode, everything else from ChatGPT that night'},
  series:{name:'A series',ic:'tv',d:"The same cast every week, and nobody's playing to win",like:'Below Deck, Real Housewives, Pluribus',
    L:['The cast','The season','Each episode','Comings and goings','Twists','What scores'],src:'ChatGPT the morning after, and the couch answers anything it misses'},
  talk:{name:'Talk, variety or awards',ic:'mic',d:'A host, guests and bits. Nobody leaves and nobody wins',like:'Saturday Night Live, late-night shows, the Oscars',
    L:['Regulars','The season','Each show',null,null,'Moments'],src:'The couch says what happened as it watches; ChatGPT checks the next morning'},
  sport:{name:'A sport or live event',ic:'flag',d:'Athletes or teams compete, and results come in as it happens',like:'Formula 1, the Olympics, a tournament',
    L:["Who's competing",'The schedule','Each event','Withdrawals',null,'What scores'],src:'Results minutes after the finish, from ChatGPT'}};
const RB_FITS={comp:['pool','lineup','outlast'],series:['lineup'],talk:['wbingo','wcalls'],sport:['lineup','pool']};
const RB_NOFIT={series:s=>`Survival Pool and Outlast need someone knocked out most episodes. Nobody is, on ${s.name}.`,
  talk:s=>`Drafts need a cast that scores week to week. ${s.name}'s games are one show at a time, all season.`,
  sport:s=>`Outlast needs people knocked out one by one. Nobody is, in ${s.name}.`};
GAMES.wbingo={name:'Weekly Bingo',line:'A new card every show. Most lines by the finale wins.',col:'#a76bb0'};
GAMES.wcalls={name:'Weekly Calls',line:'Two calls every show. Most right by the finale wins.',col:'#e0b23a'};
// who decides a segment, and what's at stake in it
const RB_DEC={challenge:['cup','Won in a challenge'],vote:['people','Decided by a vote'],showdown:['bolt','Head to head'],choice:['swap','Each team chooses'],result:['flag','Times and places'],clue:['quiz','A clue'],nobody:null};
const RB_STK={home:['Going home','home'],safe:['Safety','safe'],reward:['Reward','rew'],pts:['Points','pts']};

// ---------- two new shows: a talk show and a sport ----------
const RB_NEW=[
  {id:'snl',name:'Saturday Night Live',season:'Season 52',short:'SNL 52',art:'late-night',pos:'56% 50%',hpos:'56% 42%',air:[6,23,30],col:'#7a5cc4',ep:4,aired:3,onEp:3,others:true,unready:true,kind:'talk',
   watchers:{4:['riley','jordan'],12:['riley','jordan','maya','ben']}},
  {id:'f1',name:'Formula 1',season:'2026 season',short:'F1 2026',art:'f1',pos:'66% 40%',hpos:'70% 30%',air:[0,15,0],col:'#e8002d',ep:19,aired:18,onEp:18,others:true,unready:true,kind:'sport',unit:'Race',
   watchers:{4:['jordan','sam'],12:['jordan','sam','dev','luis','theo']}}];
// a thin couch (?shows= or ?fresh) already filtered SHOWS: the new shows join the full list, and the visible one only when unfiltered
ALL_SHOWS.push(...RB_NEW);if(!/[?&](shows|fresh)\b/.test(location.search))SHOWS.push(...RB_NEW);
ADDABLE.push(['snl','Saturday Night Live','late-night','Season 52 · NBC'],['f1','Formula 1','f1','2026 season · every race']);
FIRST.where.snl=3;FIRST.where.f1=18;
Object.assign(WHERE,{snl:{riley:3,jordan:3,maya:2,ben:3},f1:{jordan:18,sam:18,dev:17,luis:18,theo:16}});
Object.assign(WADATA,{snl:{ep:4,run:90,start:600,cast:null,lines:[[612,'riley','the cold open already has me'],[640,'jordan','they are NOT holding it together'],[668,'riley','cameo!!'],[700,'jordan','this monologue song though']],stickers:[]},
  f1:{ep:19,run:110,start:900,cast:null,lines:[[910,'jordan','lights out and away we go'],[934,'sam','what a start from P6'],[960,'jordan','safety car, calling it now'],[990,'sam','that undercut was perfect']],stickers:[]}});
// every show's kind (series flavours are its starting point: reality or scripted)
const RB_KSET={surv:['comp'],trt:['comp'],chl:['comp'],li:['comp'],ar:['comp'],bd:['series','Reality'],plu:['series','Scripted'],hp:['series','Scripted'],sev:['series','Scripted']};
ALL_SHOWS.forEach(s=>{const k=RB_KSET[s.id];if(k&&!s.kind){s.kind=k[0];s.flavor=k[1]}});
// a series can be a game now, so Below Deck Med and Pluribus start as "not a game yet"
['bd','plu'].forEach(id=>{const s=ALL_SHOWS.find(x=>x.id===id);if(s)s.unready=true});
ROLES.snl=['Host · new each week','Musical guest · new each week','The cast','Weekend Update anchors'];

// ---------- the 2026 grid (from the published entry list; teams named for reference only) ----------
const F1T=[['McLaren','#ff8000','Lando Norris','Oscar Piastri'],['Ferrari','#e8002d','Charles Leclerc','Lewis Hamilton'],['Red Bull','#3671c6','Max Verstappen','Isack Hadjar'],
  ['Mercedes','#27f4d2','George Russell','Kimi Antonelli'],['Aston Martin','#229971','Fernando Alonso','Lance Stroll'],['Williams','#64c4ff','Alex Albon','Carlos Sainz'],
  ['Alpine','#ff87bc','Pierre Gasly','Franco Colapinto'],['Racing Bulls','#6692ff','Liam Lawson','Arvid Lindblad'],['Haas','#b6babd','Esteban Ocon','Oliver Bearman'],
  ['Audi','#e0d6c4','Nico Hülkenberg','Gabriel Bortoleto'],['Cadillac','#f4f2f8','Sergio Pérez','Valtteri Bottas']];
const F1D=F1T.flatMap(([t,c,a,b])=>[{n:a,t,c},{n:b,t,c}]);
const rbSur=n=>n.split(' ').slice(1).join(' '),rbFirst=n=>n.split(' ')[0];

// ---------- each show's rulebook, as ChatGPT returns it and the community checks it ----------
// segs: [name, who decides, what it is, stake, how often]; pts: [moment, points, who answers ('couch')]
const RBD={
  surv:{sub:'Castaways voted out one by one',premise:'Eighteen castaways start in three tribes. Every episode someone is voted out, until the people voted out late in the game, the jury, choose the Sole Survivor.',
    who:{n:18,u:'castaways',g:'In 3 tribes. Swaps reshuffle them, and the merge ends them.',faces:true},
    season:{total:14,phases:[['Tribes',1,'From Episode 1'],['Merged',null,'When about 12 remain'],['Finale',14,'Episode 14']]},
    segs:[['Reward challenge','challenge','The winners get food, comfort or a trip','reward','Most episodes'],['Immunity challenge','challenge','Win it and you can\'t be voted out','safe'],
      ['Tribal Council','vote','The tribe votes someone out','home'],['Fire-making','showdown','Two make fire, one goes home','home','Final four only']],
    out:['Voted out','Lost fire-making','Quit','Medically evacuated'],end:'The jury votes for a winner from the final three.',
    tw:[['Idols and advantages','Found at camp or on journeys. Played at Tribal Council to stay safe or cancel votes.'],['Journeys','A side trip. Some come back with an advantage, some without their vote.']],
    pts:'rules',lineage:'Started from Survivor 50\'s rulebook · checked by 14 couches',
    found:['18 castaways in 3 tribes','How an episode runs: 4 parts','14 things that score','A competition'],
    upd:[{ep:1,k:'start',t:'In force from the premiere',d:'Started from Survivor 50\'s rulebook.'},{ep:4,k:'fix',t:'Fixed a mistake',d:'"Sat out" only counts in individual challenges now. Every couch was rescored.'},
      {ep:5,k:'show',t:'The show changed',d:'Block a Vote added to the advantages: found +4, played +2.',when:()=>RBS.new5==='confirmed'}]},
  ar:{sub:'Teams race around the world',premise:'Eleven teams of two race around the world, one leg at a time. The last team to the Pit Stop is usually out. The first team across the final finish line wins.',
    epLabel:'Each leg',who:{n:11,u:'teams of two',tiles:()=>ROLES.ar.map((r,i)=>[`Team ${i+1}`,r])},
    season:{total:12,phases:[['The race',1,'From Leg 1'],['Final leg',12,'Episode 12']]},
    segs:[['Route Info','clue','Where to go next'],['Detour','choice','Pick one of two tasks'],['Roadblock','challenge','One teammate does it alone'],['Pit Stop','result','The last team to arrive may be out','home']],
    out:['Eliminated at the Pit Stop','Quit','Medical'],end:'The first team across the final finish line wins.',
    tw:[['U-Turn','Makes another team do both sides of a Detour.'],['Express Pass','Skip one task.'],['Non-elimination leg','The last team stays, with a penalty on the next leg.']],
    pts:[['Finish a leg first',3],['Top half on a leg',1],['Win a Fast Forward',2],['Use the U-Turn',1],['Saved by a non-elimination leg',1],['Win the race',10]],
    lineage:'Made by your couch today · new until another couch checks it',found:['11 teams of two','How a leg runs: 4 parts','6 things that score','A competition'],
    upd:[{ep:6,k:'start',t:'In force from Episode 6',d:'Made with Ask ChatGPT. Episodes before it weren\'t played.'}]},
  bd:{sub:'A yacht crew through a charter season',premise:'A yacht crew works a summer of charters. Guests come and go every few days, the crew lives and works together, and the captain decides who stays.',
    who:{n:9,u:'crew',tiles:()=>ROLES.bd.map(r=>[r,'From the TV listing'])},
    season:{total:16,phases:[['Charter season',1,'From Episode 1'],['The last charter',16,'Episode 16']]},
    segs:[['A new charter','nobody','Guests arrive with a preference sheet'],['Service','nobody','Meals, theme nights and whatever goes wrong'],['The tip meeting','nobody','The guests tip the whole crew','reward'],['Crew night out','nobody','Where the drama happens']],
    out:['Fired by the captain','Quit','A new hire joins'],end:'No winner: the season ends with the last charter.',
    tw:[['A new hire','Joins partway through and takes the spot of whoever left.'],['A short-handed charter','Someone\'s missing and everyone does more.']],
    pts:[['Praised by the captain',2],['Called to the captain\'s office',-1],['Charter tip over $20K',1],['A hookup with someone on the crew',1],['Cries on camera',1,'couch'],['Fired',-5],['Quits',-3]],
    lineage:'Made by your couch today · new until another couch checks it',found:['9 crew, from the TV listing','How an episode runs: 4 parts','7 things that score, 1 the couch answers','A series · reality'],
    upd:[{ep:7,k:'start',t:'In force from Episode 7',d:'Made with Ask ChatGPT.'}]},
  plu:{sub:'One story told across the season',premise:'A drama told across the season. Nobody\'s playing to win, so the game is what happens to the characters, and calling it before it does.',
    who:{n:6,u:'main characters',tiles:()=>ROLES.plu.map(r=>[r,'From the TV listing'])},
    season:{total:9,phases:[['Season 1',1,'Weekly from Episode 1']]},
    segs:[['Cold open','nobody','Before the titles. Often a flashback'],['The episode','nobody','The main story'],['The ending','nobody','A reveal or a cliffhanger']],
    out:['Written out','Killed off','A new character'],end:'No winner: the season ends where the story does.',
    tw:[['Theories','The big questions the show hasn\'t answered yet. Call them each week; they settle when the show answers.']],
    pts:[['In the episode',1],['A big reveal about them',3],['Saves someone',2],['In danger and survives',2],['Killed off',-3],['Written out',-2]],
    lineage:'Made by your couch today · new until another couch checks it',found:['6 main characters','How an episode runs: 3 parts','6 things that score','A series · scripted'],
    upd:[{ep:5,k:'start',t:'In force from Episode 5',d:'Made with Ask ChatGPT.'}]},
  snl:{sub:'Sketch comedy, live on Saturday night',premise:'A new host and musical guest every week, the same cast, sketches live from New York. Nobody leaves and nobody wins: the fun is calling what happens.',
    epLabel:'Each show',who:{n:0,u:'the cast, plus a new host each week',tiles:()=>ROLES.snl.map(r=>{const [a,b]=r.split(' · ');return [a,b?b[0].toUpperCase()+b.slice(1):'Every week']})},
    season:{total:21,phases:[['Fall',1,'October to December'],['Spring',10,'After the holidays']]},
    segs:[['Cold open','nobody','A sketch before the opening titles'],['Monologue','nobody','The host\'s welcome, sometimes a song'],['Sketches','nobody','Live and taped, about eight a show'],
      ['Weekend Update','nobody','The news desk, and guests at it'],['Musical guest','nobody','Two songs'],['Goodnights','nobody','Everyone on stage, waving']],
    out:[],tw:[],
    pts:[['Someone breaks character'],['A surprise cameo'],['The host sings'],['A recurring character'],['The musical guest in a sketch'],['A flubbed line'],['A sketch about another TV show'],['A pre-taped music video']],
    lineage:'Made by your couch today · new until another couch checks it',found:['The cast, the host and the musical guest','How a show runs: 6 parts','8 moments for bingo and calls','Talk, variety or awards'],
    upd:[{ep:4,k:'start',t:'In force from Episode 4',d:'Made with Ask ChatGPT.'}]},
  f1:{sub:'A race series, most weekends',premise:'Twenty-two drivers in eleven teams race on a different track most weekends. The real championship decides the title. Your game uses its own points, so every driver can matter.',
    epLabel:'Each race weekend',unit:'Race',who:{n:22,u:'drivers in 11 teams',drivers:true},
    season:{total:24,sprint:[2,6,7,11,14,18],phases:[['The season',1,'Most weekends, March to December']]},
    segs:[['Practice','nobody','Teams try their cars. Nothing scores'],['Qualifying','result','Sets the starting order. Fastest takes pole','pts'],['Sprint','result','A short Saturday race','pts','6 weekends'],['The race','result','The top ten score championship points','pts']],
    out:['Did not finish','Did not start','Replaced for a race'],end:'Most points after Race 24 is the champion.',tw:[],
    pts:[['Win the race',10],['2nd or 3rd','+8 / +6'],['4th to 10th','+5 to +1'],['Pole position',3],['Beat your teammate',2],['Each place gained',1],['Did not finish',-5]],
    lineage:'Made by jordan\'s couch today · new until another couch checks it',found:['22 drivers in 11 teams','How a race weekend runs: 4 parts','7 things that score','A sport · 18 of 24 races done'],
    upd:[{ep:19,k:'start',t:'In force from Race 19',d:'Made with Ask ChatGPT.'}]}};
const RBS={kind:{},ours:false,off:new Set(),custom:[],took:null,new5:'reported',lock:{},hist:{}};

// ---------- helpers ----------
const rbKind=s=>{const o=RBS.kind[s.id],k=(o&&o.k)||s.kind||'comp',fl=k==='series'?((o&&o.fl)||s.flavor||'Reality'):null;return {k,fl,...RBK[k]}};
const rbL=(s,i)=>{const D=RBD[s.id],K=rbKind(s);if(i===2&&D&&D.epLabel&&K.k===s.kind)return D.epLabel;return K.L[i]};
const rbUnit=s=>s.unit||(RBD[s.id]&&RBD[s.id].unit)||'Episode';
const rbYou=s=>s.kinds?SHOWSTATE.revealed:Math.max(0,whereOf(s,'alex')||0);
const rbNeeds=s=>!!s.unready;
const rbCur=()=>{const m=location.hash.match(/^#\/show\/([^/]+)/);return m?SHOWS.find(x=>x.id===m[1]):null};
const rbFmt=v=>typeof v==='number'?`${v>0?'+':v<0?'−':''}${Math.abs(v)}`:v;
const rbKindName=s=>{const K=rbKind(s);return K.name+(K.fl?` · ${K.fl.toLowerCase()}`:'')};
// Formula 1 says "Race", not "Episode": swap the words in whatever a show screen renders
function rbVocab(root,s){if(!root||!s||s.unit!=='Race')return;const tw=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;
  const R=[[/\bEpisodes\b/g,'Races'],[/\bEpisode\b/g,'Race'],[/\bepisodes\b/g,'races'],[/\bepisode\b/g,'race'],[/\bEp (\d)/g,'Race $1']];
  while((n=tw.nextNode())){let t=n.nodeValue;const o=t;R.forEach(([a,b])=>t=t.replace(a,b));if(t!==o)n.nodeValue=t}}

// ---------- the rulebook's parts, as one page or as a review ----------
function rbWho(s,compact){const D=RBD[s.id];
  if(D.who.faces){const C=S51.cast.slice(0,18),L=compact?C.slice(0,12):C;
    return `<div class="rb-faces">${L.map(c=>`<span><img src="${ph(c)}" alt=""><i style="background:${TRIBES[c.tribe]||'var(--raised)'}"></i></span>`).join('')}</div>${compact?`<p class="rb-more">+${C.length-L.length} more</p>`:`<p class="rb-note">${D.who.g}</p>`}`}
  if(D.who.drivers){const L=compact?F1D.slice(0,8):F1D;
    return `<div class="rb-drv">${L.map(d=>`<span><i style="background:${d.c}"></i><b class="cap">${rbSur(d.n)}</b><small>${d.t}</small></span>`).join('')}</div>${compact?`<p class="rb-more">+${F1D.length-L.length} more drivers</p>`:''}`}
  const T=D.who.tiles(),L=compact?T.slice(0,6):T;
  return `<div class="w-roles">${L.map(([a,b])=>`<div class="w-role">${svg('people')}<span><b>${a}</b><small>${b}</small></span></div>`).join('')}</div>${compact&&T.length>L.length?`<p class="rb-more">+${T.length-L.length} more</p>`:''}`}
function rbRundown(s,compact){const D=RBD[s.id];
  return `<div class="rb-run${compact?' sm':''}">${D.segs.map(([n,dec,desc,stk,when],i)=>`<div class="rb-seg"><span class="n num">${i+1}</span><div class="tx"><b class="cap">${n}</b>${compact?'':`<p>${desc}</p>`}${RB_DEC[dec]||when?`<span class="dec">${RB_DEC[dec]?svg(RB_DEC[dec][0])+RB_DEC[dec][1]:svg('cal')}${RB_DEC[dec]&&when?' · ':''}${when||''}</span>`:''}</div>${stk?`<span class="rb-stk ${RB_STK[stk][1]}">${RB_STK[stk][0]}</span>`:''}</div>`).join('')}</div>`}
function rbSeason(s){const D=RBD[s.id],T=D.season.total,you=rbYou(s),u=rbUnit(s),spr=D.season.sprint||[];
  const cells=Array.from({length:T},(_,i)=>i+1).map(e=>`<i class="${e<=you?'seen':''}${e===you+1?' next':''}${e===T?' fin':''}${spr.includes(e)?' spr':''}"></i>`).join('');
  return `<div class="rb-strip">${cells}</div><div class="rb-scale"><span>${u} 1</span>${you?`<span class="me">You · ${u} ${you}</span>`:''}<span>${u} ${T}</span></div>
    <ol class="rb-phases">${D.season.phases.map(([n,a,at])=>`<li class="${a&&a<=Math.max(1,you)?'on':''}"><b class="cap">${n}</b><small>${at}</small></li>`).join('')}</ol>
    ${spr.length?`<p class="rb-note"><i class="rb-sprdot"></i>Sprint weekends: a short Saturday race scores too</p>`:''}`}
function rbOut(s){const D=RBD[s.id];return `<div class="rb-chips">${D.out.map(o=>`<span>${o}</span>`).join('')}</div>${D.end?`<p class="rb-end">${svg('crown')}<span>${D.end}</span></p>`:''}`}
function rbTw(s){return RBD[s.id].tw.map(([t,d])=>`<div class="rb-tw"><span class="ic">${svg('shuffle')}</span><span class="tx"><b>${t}</b><small>${d}</small></span></div>`).join('')}
function rbPtsRows(s){const D=RBD[s.id];
  if(D.pts==='rules'){const d=PRESETS[BS.rulesPreset];return RULES.flatMap(([grp,rows])=>rows.filter(([k])=>!RBS.off.has(k)).map(([k,label,def])=>{const base=def<0?def+d:def+(d>0?1:0);return [label,rulesVal(k,base),null,grp]}))
    .concat(RBS.new5==='confirmed'&&rbYou(s)>=5?[['Found a Block a Vote',4,null,'Advantages'],['Played a Block a Vote',2,null,'Advantages']]:[]).concat(RBS.custom.map(c=>[c.t,c.p,'couch','Your own']))}
  return D.pts.map(([t,v,who])=>[t,v,who])}
function rbPts(s,compact){const D=RBD[s.id],R=rbPtsRows(s),L=compact?R.slice(0,6):R;
  if(rbKind(s).k==='talk'||(L[0]&&L[0][1]===undefined))return `<div class="rb-moms">${L.map(([t])=>`<span>${t}</span>`).join('')}</div>${compact?'':`<p class="rb-note">No points: these fill the bingo cards and the weekly calls. The couch says what happened as it watches.</p>`}`;
  let grp='';
  return `<div class="rb-pts">${L.map(([t,v,who,g])=>{const head=!compact&&g&&g!==grp?(grp=g,`<span class="rb-pg cap">${g}</span>`):'';const neg=(typeof v==='number'&&v<0)||(typeof v==='string'&&v.startsWith('−'));
      return `${head}<div class="rb-pt"><span>${t}${who==='couch'?' <i class="rb-cq">The couch answers</i>':''}</span><b class="num${neg?' neg':''}">${rbFmt(v)}</b></div>`}).join('')}</div>${compact&&R.length>L.length?`<p class="rb-more">+${R.length-L.length} more</p>`:''}`}
function rbPtsAside(s){if(RBD[s.id].pts==='rules')return `Your Weekly Lineup · ${BS.rulesPreset}`;if(rbKind(s).k==='talk')return 'For bingo and calls';return 'Suggested · each couch can change them'}
function rbUpd(s,all){const D=RBD[s.id],you=rbYou(s),L=D.upd.filter(x=>!x.when||x.when());const seenL=all?L:L.filter(x=>x.ep<=Math.max(you,x.k==='start'?x.ep:you)),hid=all?[]:L.filter(x=>!seenL.includes(x));
  return `<div class="rb-upd">${seenL.map(x=>`<div class="rb-u"><span class="ep num"><small>${({Episode:'EP',Race:'RACE'})[rbUnit(s)]||rbUnit(s).toUpperCase()}</small>${x.ep}</span><div class="tx"><b>${x.t}</b><small>${x.d}</small></div>${x.k!=='start'?`<span class="rb-uk ${x.k}">${x.k==='fix'?'Fix':'New'}</span>`:''}</div>`).join('')}
    ${hid.length?`<div class="rb-u hid"><span class="ep">${svg('eye')}</span><div class="tx"><b>${hid.length} update${hid.length>1?'s':''} from ${rbUnit(s)} ${hid[0].ep}</b><small>It shows once you've seen it</small></div></div>`:''}</div>`}
// a part's one-line summary, for the admin and the review
function rbParts(s){const D=RBD[s.id],K=rbKind(s),out=[];
  out.push([rbL(s,0),D.who.n?`${D.who.n} ${D.who.u}`:D.who.u]);
  out.push([rbL(s,1),D.season.phases.map(([n,a,at])=>a?n:`${n} (${at.toLowerCase()})`).join(' › ')]);
  out.push([rbL(s,2),D.segs.map(x=>x[0]).join(', ')]);
  if(K.L[3])out.push([rbL(s,3),D.out.join(', ')||'None']);if(K.L[4]&&D.tw.length)out.push([rbL(s,4),D.tw.map(x=>x[0]).join(', ')]);
  out.push([rbL(s,5),`${rbPtsRows(s).length} ${K.k==='talk'?'moments':'moments, suggested points'}`]);return out}

// ---------- How the season works: one readable page for everyone ----------
function rbHowHTML(s){const D=RBD[s.id],K=rbKind(s),you=rbYou(s);
  return `<section class="rb-hero"><img src="${ART(s.art)}" alt="" style="object-position:${s.pos}"><h2 class="cap">${s.short}</h2>
      <span class="rb-lt"><span class="rb-ktag cap">${svg(K.ic)}${K.name}${K.fl?` · ${K.fl}`:''}</span><span class="rb-ksub">${D.sub}</span></span></section>
    <p class="rb-premise">${D.premise}</p>
    <nav class="rb-jump" aria-label="Jump to">${[['ep',rbL(s,2)],['season',rbL(s,1)],['who',rbL(s,0)],['pts',rbL(s,5)]].map(([k,l])=>`<button data-jump="${k}">${l}</button>`).join('')}</nav>
    <section class="blk" id="rbj-ep"><div class="sh"><h2 class="cap">${rbL(s,2)}</h2><span class="aside">In order</span></div>${rbRundown(s)}</section>
    <section class="blk" id="rbj-season"><div class="sh"><h2 class="cap">${rbL(s,1)}</h2><span class="aside">${D.season.total} ${rbUnit(s).toLowerCase()}s</span></div>${s.kinds?'':guardChip(s)}${rbSeason(s)}</section>
    <section class="blk" id="rbj-who"><div class="sh"><h2 class="cap">${rbL(s,0)}</h2><span class="aside">${D.who.n?`${D.who.n} ${D.who.u}`:''}</span></div>${rbWho(s)}</section>
    ${K.L[3]&&D.out.length?`<section class="blk"><div class="sh"><h2 class="cap">${rbL(s,3)}</h2></div>${rbOut(s)}</section>`:''}
    ${K.L[4]&&D.tw.length?`<section class="blk"><div class="sh"><h2 class="cap">${rbL(s,4)}</h2></div>${rbTw(s)}</section>`:''}
    <section class="blk" id="rbj-pts"><div class="sh"><h2 class="cap">${rbL(s,5)}</h2><span class="aside">${rbPtsAside(s)}</span></div>${rbPts(s)}</section>
    <section class="blk"><div class="sh"><h2 class="cap">Updates</h2></div>${rbUpd(s)}</section>
    <section class="blk"><p class="rb-line">${svg('book')}<span>${D.lineage}</span></p><button class="wrongq" data-rbfix>${svg('quiz')}Something off? Suggest a fix</button></section>`}
function howPage(s,opt={}){if(!RBD[s.id])return toast('Mock: this show has no rulebook yet');
  openPage('How it works',`<div class="rb-how">${rbHowHTML(s)}</div><div style="height:40px"></div>`,pg=>{
    pg.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>{const t=pg.querySelector('#rbj-'+b.dataset.jump);if(t)pg.scrollTo({top:t.offsetTop-64,behavior:reduce?'auto':'smooth'})});
    pg.querySelectorAll('[data-gdwhere]').forEach(b=>b.onclick=()=>whereSheet({...s,aired:airedOf(s),onEp:Math.max(1,rbYou(s))}));
    const fx=pg.querySelector('[data-rbfix]');if(fx)fx.onclick=()=>rbFixSheet(s);
    if(opt.onBack)pg.querySelectorAll('[data-back]').forEach(b=>b.onclick=opt.onBack)},{back:opt.back||'Back'})}
function rbFixSheet(s){let what=null;
  openSheet('Suggest a fix',`${s.short}'s rulebook`,`<div class="chips" style="padding:0">${[['seg','A part of an episode'],['out','A way out'],['pts','Something that scores'],['other','Something else']].map(([k,l])=>`<button class="chip" data-fx="${k}">${l}</button>`).join('')}</div>
    <label class="aibox-l"><span class="cap">What's off?</span><textarea class="aibox" id="fxNote" placeholder="e.g. Reward challenges are only some episodes this season"></textarea></label>
    <button class="btn pri wide" id="fxGo" style="margin-top:12px" disabled>Send</button><p class="muted small" style="margin-top:8px;text-align:center">If another couch agrees, it's fixed for everyone. You'll hear how it went.</p>`,
    b=>{b.querySelectorAll('[data-fx]').forEach(x=>x.onclick=()=>{what=x.dataset.fx;b.querySelectorAll('[data-fx]').forEach(y=>y.classList.toggle('on',y===x));$('fxGo').disabled=false});
      $('fxGo').onclick=()=>{closeSheet();toast('Sent. If another couch agrees, it\'s fixed for everyone.')}})}

// ---------- Make it a game: ask ChatGPT, then check what it found (the kind is one line with Change) ----------
const makeGameRB=makeGame;
makeGame=function(s,at){if(!RBD[s.id])return makeGameRB(s);let step=at||'ask',pasted=false,timer=null;const D=RBD[s.id];
  const views={
    ask:()=>`<h2 class="cap">Make ${s.name} a game</h2>
      <p class="w-lede">One question to ChatGPT finds who's in it, how ${rbUnit(s)==='Race'?'a race weekend':rbUnit(s)==='Show'?'a show':'an episode'} runs and what should score. Anyone can do it, and every couch can play it after.</p>
      <button class="bt-ask" id="mkAsk"><span class="bt-ic">${svg('bolt')}</span><span class="tx"><b>Ask ChatGPT for me</b><small>About a minute. Free: setting up a show is on us</small></span>${svg('chev')}</button>
      <button class="row bt-manual" id="mkManual"><span class="ic">${svg('copy')}</span><span class="tx"><b>Copy and paste it yourself</b><small>Any AI chat that searches the web · about 2 minutes</small></span>${svg('chev')}</button>
      <p class="rb-fine">${svg('shield')}<span>It looks up the show's format and cast. Nothing past where you are shows here.</span></p>`,
    run:()=>`<h2 class="cap">Asking ChatGPT</h2><p class="w-lede">Reading up on ${s.name}. You can leave; we'll tell you when it's ready.</p>
      <ul class="rb-found">${D.found.map((t,i)=>`<li style="--d:${(i*.5).toFixed(2)}s"><i>${svg('check')}</i><span>${t}</span></li>`).join('')}</ul><div class="bt-bar" style="margin-top:18px"><i></i></div>`,
    paste:()=>`<h2 class="cap">Make ${s.name} a game</h2><p class="w-lede">We write the question; any AI chat that searches the web answers it.</p>
      <div class="w-mkstep${pasted?' done':''}"><span class="n num">1</span><div><b>Ask an AI</b><small>The free versions are plenty.</small>
        <div class="w-ais"><button data-ai="ChatGPT"><span class="ailogo" style="background:#10a37f">C</span>ChatGPT</button><button data-ai="Grok"><span class="ailogo" style="background:#e8e8e8;color:#111">G</span>Grok</button><button data-ai="copy">${svg('copy')}Copy it</button></div></div></div>
      <div class="w-mkstep${pasted?' done':''}"><span class="n num">2</span><div><b>Paste its answer back</b><small>Long-press its whole answer, Copy, come back here.</small>
        <button class="btn out wide" id="mkPaste" style="margin-top:10px">${svg('copy')}Paste the answer</button>
        ${pasted?`<p class="aicheck ok">${svg('check')}Looks right: ${D.found.slice(0,3).join(' · ')}</p>`:''}</div></div>
      <button class="btn pri wide cap big" id="mkGo"${pasted?'':' disabled'}>Check what it found</button>`,
    review:()=>{const K=rbKind(s),fits=RB_FITS[K.k];
      return `<h2 class="cap">Does this<br>look right?</h2><p class="w-lede">From ChatGPT's answer, checked against the TV listing. Fix anything now or later.</p>
      <button class="rb-kind" data-kind><span class="ic">${svg(K.ic)}</span><span class="tx"><b>${rbKindName(s)}</b><small>${D.sub}</small></span><span class="rb-chg">Change</span></button>
      <div class="sh rb-sh"><h2 class="cap">${rbL(s,0)}</h2><span class="aside">${D.who.n?`${D.who.n} ${D.who.u}`:''}</span></div>${rbWho(s,true)}
      <div class="sh rb-sh"><h2 class="cap">${rbL(s,2)}</h2><span class="aside">${D.segs.length} parts</span></div>${rbRundown(s,true)}
      <div class="sh rb-sh"><h2 class="cap">${rbL(s,5)}</h2><span class="aside">${K.k==='talk'?'For bingo and calls':'Suggested'}</span></div>${rbPts(s,true)}
      <p class="rb-src">${svg('bell')}<span><b>Results:</b> ${K.src}.</span></p>
      <p class="rb-src">${svg('cup')}<span><b>You can play:</b> ${fits.map(g=>GAMES[g].name).join(', ')}, plus bingo and calls every ${rbUnit(s).toLowerCase()}.</span></p>
      <p class="w-review">${svg('shield')}Every couch can use it now. It's marked new until someone on another couch checks it.</p>
      <button class="btn pri wide cap big" id="mkOk">Looks right · pick a game</button>
      <button class="rb-howlink" data-rbhow>${svg('book')}See how the whole season works</button>`}};
  const paint=pg=>{clearTimeout(timer);const b=pg.querySelector('#mkBody');b.innerHTML=views[step]();rbVocab(b,s);
    const ask=$('mkAsk');if(ask)ask.onclick=()=>{step='run';paint(pg);timer=setTimeout(()=>{if(!$('mkBody'))return;step='review';paint(pg);pg.scrollTop=0},D.found.length*500+900)};
    const man=$('mkManual');if(man)man.onclick=()=>{step='paste';paint(pg)};
    b.querySelectorAll('[data-ai]').forEach(x=>x.onclick=()=>toast(x.dataset.ai==='copy'?'Question copied. Paste it into any AI chat that can search the web.':`Opening ${x.dataset.ai}… (mock)`));
    const pa=$('mkPaste');if(pa)pa.onclick=()=>{pasted=true;paint(pg)};
    const go=$('mkGo');if(go)go.onclick=()=>{step='review';paint(pg);pg.scrollTop=0};
    const kd=b.querySelector('[data-kind]');if(kd)kd.onclick=()=>rbKindSheet(s,()=>paint(pg));
    const hw=b.querySelector('[data-rbhow]');if(hw)hw.onclick=()=>howPage(s,{back:'Check it',onBack:()=>makeGame(s,'review')});
    const ok=$('mkOk');if(ok)ok.onclick=()=>{s.unready=false;s.todo={kind:'Play',t:'Set up · start a game',d:GAMES[RB_FITS[rbKind(s).k][0]].name+' from '+rbUnit(s)+' '+s.ep};closePage();route();setTimeout(()=>newGameW(s),300)}};
  openPage('Make it a game',`<div class="w-mk" id="mkBody"></div>`,pg=>paint(pg))};
// "What kind of show?": the guess, and the three other kinds. A series picks its starting point: reality or scripted.
function rbKindSheet(s,done){const cur=rbKind(s);let k=cur.k,fl=cur.fl||'Reality';
  const body=()=>`${Object.entries(RBK).map(([key,K])=>`<button class="typecard rb-kc${key===k?' on':''}" data-kk="${key}"><span class="rb-ki">${svg(K.ic)}</span><span><b>${K.name}${key===s.kind&&!RBS.kind[s.id]?' · our guess':''}</b><small>${K.d}</small><em>Like ${K.like}</em></span></button>
      ${key==='series'&&k==='series'?`<div class="segm rb-fl">${['Reality','Scripted'].map(f=>`<button class="${f===fl?'on':''}" data-fl="${f}">${f}</button>`).join('')}</div>`:''}`).join('')}
    <p class="muted small" style="margin-top:6px;line-height:1.45">The kind renames the parts and decides which games fit. Nothing ChatGPT found is lost.</p>
    <button class="btn pri wide" id="kGo" style="margin-top:12px">Use this</button>`;
  openSheet('What kind of show?',`${s.name} · we guessed ${rbKindName(s).toLowerCase()}`,`<div id="kB">${body()}</div>`,b=>{const wire=()=>{
      b.querySelectorAll('[data-kk]').forEach(x=>x.onclick=()=>{k=x.dataset.kk;$('kB').innerHTML=body();wire()});
      b.querySelectorAll('[data-fl]').forEach(x=>x.onclick=()=>{fl=x.dataset.fl;$('kB').innerHTML=body();wire()});
      $('kGo').onclick=()=>{RBS.kind[s.id]={k,fl:k==='series'?fl:null};closeSheet();toast(`${s.name}: ${rbKindName(s).toLowerCase()}`);done&&done()}};wire()})}

// ---------- Start a game: only the games this kind of show can feed ----------
function rbGameLine(s,g){const K=rbKind(s);
  if(s.id==='f1')return {lineup:'Draft five drivers, start three each race',pool:'Pick one driver to finish in the points each race. Never the same twice'}[g];
  if(K.k==='series'&&g==='lineup')return K.fl==='Scripted'?'Draft the characters, start three each week, score what happens to them':'Draft the crew, start three each week, score what they get up to';
  return {pool:'No draft · pick one survivor each episode · best for mid-season',lineup:'Draft a roster, start your best each week',outlast:'Draft a team, the last one standing carries you',
    wbingo:'A new card every show. Most lines by the finale wins',wcalls:'Two calls every show. Most right by the finale wins'}[g]}
newGameW=function(s){const K=rbKind(s),keys=RB_FITS[K.k];let g=keys[0],told=true;const others=(watchersOf(s)||[]).filter(n=>n!=='alex'),nofit=RB_NOFIT[K.k];
  openSheet('Start a game',`${s.name} · from ${rbUnit(s)} ${s.ep}`,
    `${keys.map((k,i)=>`<button class="typecard${k===g?' on':''}" data-g="${k}"><span class="gdot" style="background:${GAMES[k].col}"></span><span><b>${GAMES[k].name}${i===0&&keys.length>1?' · Recommended':''}</b><small>${rbGameLine(s,k)}</small></span></button>`).join('')}
     ${nofit?`<p class="rb-nofit">${svg('cup')}<span>${nofit(s)}</span></p>`:''}
     <button class="row" id="wTell" style="margin-top:6px"><span class="ic">${svg('bell')}</span><span class="tx"><b>Tell the couch</b><small>One alert: "alex started a game for ${s.name} · Join"${others.length?`. ${names(others)} ${others.length===1?'watches':'watch'} it.`:''}</small></span><span class="switch on" aria-hidden="true"><i></i></span></button>
     <button class="btn pri wide" id="wStart" style="margin-top:12px">Start it</button>`,
    b=>{b.querySelectorAll('[data-g]').forEach(x=>x.onclick=()=>{g=x.dataset.g;b.querySelectorAll('[data-g]').forEach(y=>y.classList.toggle('on',y===x))});
      $('wTell').onclick=()=>{told=!told;$('wTell').querySelector('.switch').classList.toggle('on',told)};
      $('wStart').onclick=()=>{W.games[s.id]={g,told};W.nudgeGone=true;closeSheet();toast(`${GAMES[g].name} started${told?' · the couch has been told':''}`);
        [FEED4,FEED12].forEach(F=>F.unshift(['alex',`started a ${GAMES[g].name}`,`${s.short} · from ${rbUnit(s)} ${s.ep} · tap to join`,null]));if(location.hash.startsWith('#/show/'))route()}});
  rbVocab($('sheet'),s)};

// ---------- the show space: plates, your game, the Games tab, How it works ----------
function rbPlate(s,mode){const K=rbKind(s);
  if(mode==='make'){const p={comp:'One question to ChatGPT finds the cast and what scores. Then Survival Pool or a draft. Every couch can play it after.',
      series:K.fl==='Scripted'?'Draft the characters and score what happens to them, or just call each episode. One question to ChatGPT sets it up.':'Draft the crew, start three each week, and score what they get up to. One question to ChatGPT sets it up.',
      talk:'A bingo card and two calls every show, all season. One question to ChatGPT sets it up for every couch.',
      sport:'Draft drivers and start three each race, or pick one to finish in the points. One question to ChatGPT sets it up.'}[K.k];
    return `<div class="rb-plate"><span class="tg cap">Not a game yet</span><h4 class="cap">Make ${s.short} a game</h4><p>${p}</p><button class="btn" data-wjob="make">Make it a game</button></div>`}
  const first=RB_FITS[K.k][0];
  return `<div class="rb-plate"><span class="tg cap">Play it</span><h4 class="cap">${s.short} with your couch</h4><p>${GAMES[first].name}: ${rbGameLine(s,first)[0].toLowerCase()+rbGameLine(s,first).slice(1)}.${RB_FITS[K.k].length>1?` Or ${RB_FITS[K.k].slice(1).map(g=>GAMES[g].name).join(' or ')}.`:''}</p><button class="btn" data-wjob="newgame">Start a game</button></div>`}
function rbGameJob(s,g){const G=GAMES[g.g],u=rbUnit(s),t=nextAir(s.air);let tt,d,st;
  if(s.id==='f1'&&g.g==='lineup'){tt=g.team?`Start three for Race ${s.ep}`:'Draft your five drivers';d=g.team?`${g.start.length} of 3 starting · locks at lights out, ${fmtT(t)}`:'Before lights out · everyone drafts from the whole grid';st=g.team?(g.start.length===3?'Edit':'Set'):'Draft'}
  else if(g.g==='pool'){tt='Make your first pick';d=`Closes at ${s.id==='f1'?'lights out':'airtime'}, ${fmtT(t)}`;st='Pick'}
  else if(g.g==='wbingo'){tt=`Your card for Episode ${s.ep}`;d=`Opens ${fmtT(t)} · tap squares as it happens`;st='Open'}
  else if(g.g==='wcalls'){tt='Make this week\'s two calls';d='Closes when the show starts';st='Call'}
  else{tt=`Draft before ${u} ${s.ep}`;d='Pick a time with the couch, no timer';st='Set'}
  return `<section class="blk"><div class="sh"><h2 class="cap">Your game</h2><span class="aside">From ${u} ${s.ep}</span></div><button class="job" data-wjob="gpick"><span class="ic" style="background:${G.col};color:var(--ink)">${svg(g.g==='pool'?'shield':g.g==='wbingo'?'bingo':g.g==='wcalls'?'quiz':'people')}</span><span class="tx"><span class="kind cap">${G.name}</span><b>${tt}</b><small>${d}</small></span><span class="st${st==='Edit'?' rb-st-done':''}">${st}</span></button></section>`}
function rbHowRow(s){if(!RBD[s.id]||rbNeeds(s))return '';return `<section class="blk"><button class="job rb-howrow" data-rbhow="${s.id}"><span class="ic">${svg('book')}</span><span class="tx"><b>How ${s.short} works</b><small>${rbL(s,2)}, ${rbL(s,1).toLowerCase()}, ${rbL(s,5).toLowerCase()}</small></span>${svg('chev')}</button></section>`}
const wTonightRB=wTonight;
wTonight=function(s){let h=wTonightRB(s);if(!s.kind||s.binge)return h;const g=W.games[s.id];
  h=h.replace(/<div class="playplate">[\s\S]*?<\/div>/,'');
  if(g)h=h.replace(/<section class="blk"><div class="sh"><h2 class="cap">Your game<\/h2>[\s\S]*?<\/section>/,rbGameJob(s,g));
  else h=h.replace(/<div style="height:30px"><\/div>$/,rbPlate(s,rbNeeds(s)?'make':'play')+'<div style="height:30px"></div>');
  return h};
const wStandingsRB=wStandings;
wStandings=function(s){if(!s.kind||s.binge)return wStandingsRB(s);if(N===1)return wStandingsRB(s)+rbHowRow(s);const g=W.games[s.id];
  const lead=rbNeeds(s)?rbPlate(s,'make'):g?(s.id==='f1'?f1GamesHTML(s,g):`${rbGameJob(s,g)}<section class="blk"><div class="w-empty">${svg('cup')}<b class="cap">Everyone starts at 0</b><p>Scores arrive with ${rbUnit(s)} ${s.ep}'s results.</p></div></section>`):rbPlate(s,'play');
  return lead+epGamesHTML(s)+rbHowRow(s)};
const tabStandingsRB=tabStandings;
tabStandings=function(s){return tabStandingsRB(s)+rbHowRow(s)};
// the cast tab for the two new shows
const wCastRB=wCast;
wCast=function(s){if(s.id==='f1')return `<section class="blk"><div class="sh"><h2 class="cap">The grid</h2><span class="aside">22 drivers · 11 teams</span></div>${rbWho(s)}<p class="muted small" style="margin-top:12px;line-height:1.5">From the season's entry list. Results count up to the race you're on.</p></section>`;
  if(s.unready&&s.id!=='ar')return wCastRB({...s,unready:false});return wCastRB(s)};
// this week's one-night games for a talk show and a sport
const epGamesRB=epGamesHTML;
epGamesHTML=function(s){if(s.kind!=='talk'&&s.kind!=='sport')return epGamesRB(s);const t=nextAir(s.air);
  const rows=s.kind==='talk'?[['bingo','bingo',`Episode ${s.ep} bingo`,`Opens ${DAY[t.getDay()]} ${clock(t)} · tap squares as it happens`],['call','quiz','Call it for this week','Does anyone break? · two calls, scored after']]
    :[['bingo','bingo',`Race ${s.ep} bingo`,'Safety car, rain, a red flag · opens at lights out'],['call','quiz','Call the podium','Who wins, and a safety car? · closes at lights out']];
  return `<section class="blk"><div class="sh"><h2 class="cap">This week</h2><span class="aside">One ${s.kind==='talk'?'show':'race'} each</span></div>
    ${rows.map(([k,ic,tt,d])=>`<button class="row g-ep" data-eg="${k}"><span class="ic">${svg(ic)}</span><span class="tx"><b>${tt}</b><small>${d}</small></span>${svg('chev')}</button>`).join('')}</section>
  <section class="blk"><button class="cp-start" data-gstart>${svg('plus')}<span><b>Start a game</b><small>A season game, bingo, a poll or trivia. Anyone on the couch can.</small></span></button></section>`};
const callSheetRB=callSheet;
callSheet=function(s){if(s.id!=='snl'&&s.id!=='f1')return callSheetRB(s);
  const Q=s.id==='snl'?[['Does anyone break character?',['Yes','No']],['A surprise cameo?',['Yes','No']]]:[['Who wins?',F1D.slice(0,6).map(d=>rbSur(d.n))],['A safety car?',['Yes','No']]];
  openSheet(`Call it · ${rbUnit(s)} ${s.ep}`,s.id==='f1'?'Private until lights out · see who got it after':'Private until it starts · see who got it after',Q.map(([q,o],i)=>`<p class="label cap">${q}</p><div>${o.map(x=>`<button class="chip" data-q="${i}">${x}</button>`).join('')}</div>`).join('')+`<button class="btn pri wide" id="wcGo" style="margin-top:12px">Lock in my calls</button>`,
    b=>{b.querySelectorAll('[data-q]').forEach(c=>c.onclick=()=>{b.querySelectorAll(`[data-q="${c.dataset.q}"]`).forEach(x=>x.classList.toggle('on',x===c))});$('wcGo').onclick=()=>{closeSheet();toast(`Called it · change until ${s.id==='f1'?'lights out':'it starts'}`)}})};
// the show menu: a series can be made a game too, and every rulebook is one tap away
const wMenuRB=wMenu;
wMenu=function(s){wMenuRB(s);const sh=$('sheet'),drop=sh.querySelector('[data-wm="drop"]');const add=h=>drop?drop.insertAdjacentHTML('beforebegin',h):sh.querySelector('.body').insertAdjacentHTML('beforeend',h);
  if(s.kind&&!s.binge&&!sh.querySelector('[data-wm="make"],[data-wm="newgame"]'))add(`<button class="row" data-wmrb="game"><span class="ic">${svg('plus')}</span><span class="tx"><b>${rbNeeds(s)?'Make it a game':'Start a game'}</b><small>${rbNeeds(s)?'One question to ChatGPT sets it up':GAMES[RB_FITS[rbKind(s).k][0]].name+' and more'}</small></span></button>`);
  if(RBD[s.id]&&!rbNeeds(s))add(`<button class="row" data-wmrb="how"><span class="ic">${svg('book')}</span><span class="tx"><b>How it works</b><small>${rbL(s,2)}, the season, what scores</small></span></button>`);
  sh.querySelectorAll('[data-wmrb]').forEach(b=>b.onclick=()=>{const m=b.dataset.wmrb;closeSheet();setTimeout(()=>m==='how'?howPage(s):rbNeeds(s)?makeGame(s):newGameW(s),250)});rbVocab(sh,s)};
// wiring that every show screen gets: How it works rows, your game's button, Formula 1's words
function rbWire(s){app.querySelectorAll('[data-rbhow]').forEach(b=>b.onclick=()=>howPage(SHOWS.find(x=>x.id===b.dataset.rbhow)||s));
  const g=W.games[s.id];app.querySelectorAll('[data-wjob="gpick"]').forEach(b=>b.onclick=e=>{e.stopPropagation();rbGamePick(s,g)});
  app.querySelectorAll('[data-f1]').forEach(b=>b.onclick=()=>f1Toggle(s,b.dataset.f1));const dr=app.querySelector('[data-f1draft]');if(dr)dr.onclick=()=>f1Draft(s);
  rbVocab(app,s)}
function rbGamePick(s,g){if(!g)return;if(s.id==='f1'&&g.g==='lineup')return g.team?$('scroller').querySelector('.f1-row')?$('scroller').querySelector('.f1-row').scrollIntoView({block:'center'}):(location.hash=`#/show/f1/standings`):f1Draft(s);
  if(s.id==='f1'&&g.g==='pool')return f1PoolSheet(s);if(g.g==='wcalls')return callSheet(s);if(g.g==='wbingo')return toast(`Your card opens when the show starts (mock)`);
  toast(g.g==='pool'?'Your first pick (mock)':'The draft room (mock)')}
const showRouteRB=showRoute;
showRoute=function(sid,tab){showRouteRB(sid,tab);const s=SHOWS.find(x=>x.id===sid);if(s&&location.hash.startsWith('#/show/'))rbWire(s)};
// sheets, pages and watch along opened from Formula 1 say "Race"
const openSheetRB=openSheet;openSheet=function(...a){openSheetRB(...a);const s=rbCur();if(s&&s.unit)rbVocab($('sheet'),s)};
const openPageRB=openPage;openPage=function(...a){openPageRB(...a);const s=rbCur();if(s&&s.unit)rbVocab($('page'),s)};
const openWatchRB=openWatch;openWatch=function(sid,o){openWatchRB(sid,o);const s=SHOWS.find(x=>x.id===sid);if(s&&s.unit)rbVocab($('wa'),s)};

// ---------- Formula 1, played: draft five, start three, points per race ----------
function f1Draft(s){const g=W.games.f1||(W.games.f1={g:'lineup',told:true});const pick=new Set(g.team||[]);
  const tile=d=>`<button class="f1-t${pick.has(d.n)?' on':''}" data-pk="${d.n}"><i style="background:${d.c}"></i><span class="tx"><b class="cap">${rbSur(d.n)}</b><small>${rbFirst(d.n)} · ${d.t}</small></span><span class="ck">${svg('check')}</span></button>`;
  const bar=()=>`<span><b class="num">${pick.size}</b> of 5</span><button class="btn pri" id="f1Go"${pick.size===5?'':' disabled'}>Lock in my five</button>`;
  openPage('Draft your drivers',`<div class="f1-pg"><p class="w-lede">Pick five. The whole grid is open to everyone, so a driver can be on several teams. You start three each race.</p>
    <div class="f1-grid">${F1D.map(tile).join('')}</div></div><div class="f1-bar" id="f1Bar">${bar()}</div>`,pg=>{
    const wireBar=()=>{const go=$('f1Go');if(go)go.onclick=()=>{g.team=[...pick];g.start=g.team.slice(0,3);closePage();toast('Your five are in · three start, change it until lights out');route()}};
    pg.querySelectorAll('[data-pk]').forEach(b=>b.onclick=()=>{const n=b.dataset.pk;if(pick.has(n))pick.delete(n);else if(pick.size<5)pick.add(n);else return toast('Five is the most · tap one to take it out');b.classList.toggle('on',pick.has(n));$('f1Bar').innerHTML=bar();wireBar()});wireBar()},{back:'Back'})}
function f1Toggle(s,n){const g=W.games.f1;if(!g||!g.team)return;const i=g.start.indexOf(n);
  if(i>=0)g.start.splice(i,1);else if(g.start.length>=3)return toast('Three start · bench one first');else g.start.push(n);
  const y=$('scroller').scrollTop;route();$('scroller').scrollTop=y}
function f1GamesHTML(s,g){const t=nextAir(s.air);
  if(g.g==='pool')return rbGameJob(s,g);
  if(!g.team)return `<section class="blk"><div class="rb-plate"><span class="tg cap">Weekly Lineup</span><h4 class="cap">Draft your five</h4><p>Pick five drivers from the whole grid, then start three each race. Locks at lights out, ${fmtT(t)}.</p><button class="btn pri" data-f1draft>Draft drivers</button></div></section>`;
  const D=n=>F1D.find(d=>d.n===n);
  return `<section class="blk"><div class="sh"><h2 class="cap">Your drivers</h2><span class="aside">${g.start.length} of 3 start · locks ${fmtT(t)}</span></div>
      ${g.team.map(n=>{const d=D(n),on=g.start.includes(n);return `<div class="f1-row${on?' on':''}"><i style="background:${d.c}"></i><span class="tx"><b class="cap">${rbSur(n)}</b><small>${rbFirst(n)} · ${d.t}</small></span><button class="f1-sw${on?' on':''}" data-f1="${n}" aria-pressed="${on}">${on?'Starting':'Bench'}</button></div>`}).join('')}
      <button class="rb-howlink" data-f1draft>${svg('swap')}Change your five</button></section>
    <section class="blk"><div class="sh"><h2 class="cap">How a race scores</h2><span class="aside">An example</span></div>
      <p class="g-lede">Say one of yours starts on pole, finishes second and beats their teammate:</p>
      <div class="rb-eq"><span><b class="num">+3</b><small>Pole</small></span><span><b class="num">+8</b><small>2nd</small></span><span><b class="num">+2</b><small>Teammate</small></span><span class="tot"><b class="num">13</b><small>One driver</small></span></div></section>
    <section class="blk"><div class="sh"><h2 class="cap">Standings</h2><span class="aside">From Race ${s.ep}</span></div>
      ${crowdOf().filter(n=>n==='alex'||(watchersOf(s)||[]).includes(n)).map((n,i)=>`<div class="prow${n==='alex'?' me':''}"><span class="rk num">${i+1}</span>${av(n,32)}<span class="mid"><span class="nm">${n}${n==='alex'?'<span class="you">YOU</span>':''}</span></span><span class="pts num">0</span></div>`).join('')}
      <p class="muted small" style="margin-top:8px">Points arrive minutes after the chequered flag.</p></section>`}
function f1PoolSheet(s){let pick=null;
  openSheet(`Race ${s.ep} · your pick`,'Finishes in the top ten and your streak goes on. Never the same driver twice.',`<div class="f1-grid sm">${F1D.slice(0,12).map(d=>`<button class="f1-t" data-pp="${d.n}"><i style="background:${d.c}"></i><span class="tx"><b class="cap">${rbSur(d.n)}</b><small>${d.t}</small></span><span class="ck">${svg('check')}</span></button>`).join('')}</div>
    <button class="btn pri wide" id="ppGo" style="margin-top:12px" disabled>Lock in</button>`,b=>{b.querySelectorAll('[data-pp]').forEach(x=>x.onclick=()=>{pick=x.dataset.pp;b.querySelectorAll('[data-pp]').forEach(y=>y.classList.toggle('on',y===x));$('ppGo').disabled=false});
    $('ppGo').onclick=()=>{closeSheet();toast(`${rbSur(pick)} locked in · change until lights out`)}})}

// ---------- Backstage › Scoring rules: following the season's rulebook, or making it ours ----------
function rbBsHead(s){if(!RBD[s.id])return '';const o=RBS.ours,show5=RBS.new5==='confirmed';
  const upd=show5?(SHOWSTATE.revealed>=5?`<div class="rb-u"><span class="ep num"><small>EP</small>5</span><div class="tx"><b>The show changed: Block a Vote</b><small>${o?(RBS.took===null?'A new advantage. Add it to your rulebook?':RBS.took?'Added to yours':'Skipped. Your copy leaves it out'):'Added for every couch following it. It reached you on its own.'}</small>
      ${o&&RBS.took===null?`<div class="frow" style="margin-top:8px"><button class="btn out" data-rbb="take">Add it</button><button class="btn out" data-rbb="skip">Skip</button></div>`:''}</div><span class="rb-uk show">New</span></div>`
    :`<div class="rb-u hid"><span class="ep">${svg('eye')}</span><div class="tx"><b>1 update from Episode 5</b><small>It shows once you've seen it</small></div></div>`):'';
  return `<section class="blk"><div class="rb-follow"><span class="ic">${svg('book')}</span><div class="tx"><b>${o?'Your couch\'s own rulebook':`Following ${s.short}'s rulebook`}</b>
      <small>${o?`Copied from ${s.short}. You choose what counts. Fixes still reach you; when the show changes, you choose.`:`What can happen in the show, shared by every couch on ${s.short}. Updates reach you on their own.`}</small></div></div>
    <div class="frow" style="margin-top:10px"><button class="btn out" data-rbb="how">${svg('book')}How it works</button><button class="btn out" data-rbb="${o?'follow':'ours'}">${o?'Follow it again':'Make it ours'}</button></div>
    ${upd?`<div class="rb-upd" style="margin-top:12px">${upd}</div>`:''}</section>
  ${o?`<section class="blk"><div class="sh"><h2 class="cap">What counts</h2><span class="aside">Your copy</span></div>
    <a class="idx" href="#" data-rbb="moms"><span class="ic">${svg('check')}</span><span class="tx"><b>${RULES.flatMap(r=>r[1]).length-RBS.off.size} of ${RULES.flatMap(r=>r[1]).length} moments count</b><small>Turn any of them off</small></span>${svg('chev')}</a>
    ${RBS.custom.map(c=>`<div class="idx"><span class="ic">${svg('people')}</span><span class="tx"><b>${c.t}</b><small>Yours · the couch answers · ${rbFmt(c.p)}</small></span></div>`).join('')}
    <button class="cp-start" data-rbb="add" style="margin-top:10px">${svg('plus')}<span><b>Add a moment</b><small>Something the show doesn't track. The couch answers it each episode.</small></span></button></section>`:''}
  <section class="blk"><p class="rb-line">${svg('cup')}<span>Points are always the couch's to change, whichever rulebook you follow.</span></p></section>`}
const bsRulesRB=bsRules;
bsRules=function(s){return rbBsHead(s)+bsRulesRB(s)};
const wireBSRB=wireBS;
wireBS=function(sid,page){wireBSRB(sid,page);if(page!=='rules')return;const s=SHOWS.find(x=>x.id===sid),re=()=>{const y=$('scroller').scrollTop;backstageRoute(sid,'rules');$('scroller').scrollTop=y};
  app.querySelectorAll('[data-rbb]').forEach(b=>b.onclick=e=>{e.preventDefault();const k=b.dataset.rbb;
    if(k==='how')return howPage(s);if(k==='ours')return rbOursSheet(s,re);
    if(k==='follow')return previewSheet({title:'Follow it again?',sub:`Your copy goes. ${s.short}'s rulebook comes back, with every update since.`,cta:'Follow it again',
      changes:[[svg('check'),'Moments you turned off',RBS.off.size?`${RBS.off.size} count again`:'None'],[svg('people'),'Your own moments',RBS.custom.length?`${RBS.custom.length} removed`:'None'],[svg('cup'),'Points','Stay as you set them']],
      undoNote:'Undo from Recent changes.',onConfirm:()=>{const prev={off:new Set(RBS.off),custom:RBS.custom.slice()};RBS.ours=false;RBS.off.clear();RBS.custom=[];RBS.took=null;logChange(`Followed ${s.short}'s rulebook again`,1,()=>{RBS.ours=true;RBS.off=prev.off;RBS.custom=prev.custom});toast('Following it again');re()}});
    if(k==='take'||k==='skip'){RBS.took=k==='take';toast(k==='take'?'Block a Vote added to your rulebook':'Skipped · your copy leaves it out');return re()}
    if(k==='moms')return rbMomsSheet(re);if(k==='add')return rbAddSheet(re)})};
function rbOursSheet(s,re){openSheet('Make it ours?',`${s.short}'s rulebook, copied for this couch`,`<ul class="so-what">${[['check','Choose what counts','Turn moments off, or add your own that the couch answers'],['shield','Fixes still reach you','When a result or a rule is corrected, your copy gets it too'],['bell','Show changes ask first','A new twist comes as a suggestion: add it or skip it']].map(([ic,t,d])=>`<li>${svg(ic)}<span><b>${t}</b><small>${d}</small></span></li>`).join('')}</ul>
    <p class="muted small" style="margin-top:14px;line-height:1.45">Points are already yours either way. Follow it again any time.</p><button class="btn pri wide" id="rbOurs" style="margin-top:12px">Make it ours</button>`,
    b=>$('rbOurs').onclick=()=>{RBS.ours=true;RBS.took=null;logChange(`Made ${s.short}'s rulebook our own`,1,()=>{RBS.ours=false});closeSheet();toast('It\'s yours now · undo from Recent changes');re()})}
function rbMomsSheet(re){openSheet('What counts','Tap one to turn it off for this couch',`${RULES.map(([grp,rows])=>`<p class="label cap">${grp}</p>${rows.map(([k,l])=>`<button class="rb-mom${RBS.off.has(k)?' off':''}" data-mk="${k}"><span>${l}</span><span class="rb-ck">${svg('check')}</span></button>`).join('')}`).join('')}<button class="btn pri wide" id="momGo" style="margin-top:14px">Done</button>`,
  b=>{b.querySelectorAll('[data-mk]').forEach(x=>x.onclick=()=>{const k=x.dataset.mk;RBS.off.has(k)?RBS.off.delete(k):RBS.off.add(k);x.classList.toggle('off',RBS.off.has(k))});$('momGo').onclick=()=>{closeSheet();re()}})}
function rbAddSheet(re){let how='yes',p=1;
  openSheet('Add a moment','Something anyone watching could see happen',`<label class="aibox-l"><span class="cap">What happens?</span><input class="dlink" id="amT" placeholder="e.g. Cries at Tribal Council"></label>
    <p class="label cap">Counted</p><div class="ex-seg">${[['yes','Yes or no, each episode'],['each','Every time it happens']].map(([k,l])=>`<button class="${k===how?'on':''}" data-am="${k}">${l}</button>`).join('')}</div>
    <p class="label cap">Points</p><div class="rb-step"><button data-ap="-1" aria-label="Less">−</button><b class="num" id="amP">+1</b><button data-ap="1" aria-label="More">+</button></div>
    <p class="rb-fine">${svg('people')}<span>The couch answers it after each episode: anyone can tick who did it, and two agreeing settles it. Things you can see, not judgement calls like "funniest moment".</span></p>
    <button class="btn pri wide" id="amGo" style="margin-top:12px" disabled>Add it</button>`,
    b=>{$('amT').oninput=e=>$('amGo').disabled=!e.target.value.trim();b.querySelectorAll('[data-am]').forEach(x=>x.onclick=()=>{how=x.dataset.am;b.querySelectorAll('[data-am]').forEach(y=>y.classList.toggle('on',y===x))});
      b.querySelectorAll('[data-ap]').forEach(x=>x.onclick=()=>{p=Math.max(-5,Math.min(5,p+ +x.dataset.ap))||(+x.dataset.ap>0?1:-1);$('amP').textContent=rbFmt(p)});
      $('amGo').onclick=()=>{RBS.custom.push({t:$('amT').value.trim(),p,how});closeSheet();toast('Added · the couch answers it from the next episode');re()}})}

// ---------- the show changed: Episode 5's research found something the rulebook doesn't have ----------
function rbNewCard(){const st=RBS.new5;
  if(st==='confirmed')return `<section class="blk"><div class="corr rb-new"><span class="tg cap">Added</span><div><b>Block a Vote is in the rulebook</b><small>From Episode 5, for every couch on Survivor 51. It counts like the other advantages: found +4, played +2.</small></div></div></section>`;
  if(st==='no')return `<section class="blk"><div class="corr rb-new q"><span class="tg cap">Checking</span><div><b>You said it's not new</b><small>Another couch says it is, so a tie-break check runs tomorrow. Nothing changes until then.</small></div></div></section>`;
  return `<section class="blk"><div class="corr rb-new q"><span class="tg cap">New?</span><div><b>Something the rulebook doesn't have</b><small>This episode's research found a <b>Block a Vote</b> advantage: it takes away someone's vote at Tribal Council. Another couch reported it; one more yes adds it for every couch.</small>
    <div class="frow" style="margin-top:10px"><button class="btn out" data-rbn="yes">It's new</button><button class="btn out" data-rbn="no">Not new</button></div></div></div></section>`}
const episodePageRB=episodePage;
episodePage=function(e){episodePageRB(e);if(e!==5)return;const w=$('epWrong'),pg=$('page');const at=w?w.closest('section'):[...pg.children].pop();
  const paint=()=>{const old=pg.querySelector('.rb-newsec');if(old)old.remove();at.insertAdjacentHTML('beforebegin',rbNewCard().replace('<section class="blk">','<section class="blk rb-newsec">'));
    pg.querySelectorAll('[data-rbn]').forEach(b=>b.onclick=()=>{RBS.new5=b.dataset.rbn==='yes'?'confirmed':'no';toast(RBS.new5==='confirmed'?'Added for every couch on Survivor 51 · thanks':'Thanks · a tie-break check settles it');paint()})};paint()};

// ---------- admin: Find › a rulebook ----------
const ADM_RB={s51:{sid:'surv',st:'In force',reach:'Every couch on Survivor 51 · 14 follow it, 2 have their own copy',
    h:['Started from Survivor 50\'s rulebook · Sep 18','Checked by 3 couches · Sep 19','Fix: "Sat out" in individual challenges only · reported by 2 couches · Oct 8','Block a Vote reported by a couch\'s research · Episode 5']},
  f1:{sid:'f1',st:'New · 1 source',reach:'Made today by jordan\'s couch · 1 couch plays it',h:['Made with Ask ChatGPT by jordan\'s couch · today','Kind: a sport (from the listing and ChatGPT)','Waiting for another couch to check it']},
  snl:{sid:'snl',st:'New · 1 source',reach:'Made this week · 2 couches play it',h:['Made with Ask ChatGPT by riley\'s couch · Sat','Kind: talk, variety or awards']}};
ADM_IDX.push(['rb','Survivor 51 · rulebook','Rulebook · in force · 14 follow it, 2 own copies','#/admin/rb/s51'],['rb','Formula 1 2026 · rulebook','Rulebook · new · 1 source','#/admin/rb/f1'],['rb','SNL 52 · rulebook','Rulebook · new · 1 source','#/admin/rb/snl']);
admFindList=function(){const q=ADM.q.toLowerCase(),R=ADM_IDX.filter(x=>!q||(x[1]+' '+x[2]).toLowerCase().includes(q));
  return R.map(x=>`<a class="idx" href="${x[3]}"><span class="ic">${svg(x[0]==='rb'?'book':x[0]==='fact'?'quiz':/couch/i.test(x[2])?'people':/user/i.test(x[2])?'key':'tv')}</span><span class="tx"><b>${x[1]}</b><small>${x[2]}</small></span>${svg('chev')}</a>`).join('')||'<p class="muted small" style="margin-top:12px">Nothing matches.</p>'};
function adminRulebook(id){const R=ADM_RB[id];if(!R)return adminRoute(['admin','find']);const s=SHOWS.find(x=>x.id===R.sid),K=rbKind(s),lock=!!RBS.lock[id],H=R.h.concat(RBS.hist[id]||[]);
  app.innerHTML=`<div class="adm">${adminHead('Rulebook','#/admin/find')}<div class="adm-body">
    <section class="blk"><div class="adm-eh"><img src="${ART(s.art)}" alt="" style="object-fit:cover;object-position:${s.pos}"><div><b class="cap">${s.short}</b><small>${rbKindName(s)} · ${R.st}</small></div></div><p class="muted small" style="margin-top:10px;line-height:1.45">${R.reach}</p></section>
    <section class="blk"><div class="sh"><h2 class="cap">The rulebook</h2><button class="link" data-rbadm="how">Read it</button></div>
      ${rbParts(s).map(([l,v],i)=>`<button class="idx" data-rbov="${i}"><span class="tx"><small>${l}</small><b>${v}</b></span><span class="adm-edit">Override</span></button>`).join('')}
      <button class="idx" data-rbov="kind"><span class="tx"><small>Kind</small><b>${rbKindName(s)}</b></span><span class="adm-edit">Override</span></button></section>
    <section class="blk"><button class="wv-val tog" id="rbLock"><span><b>Lock</b><small>${lock?'Locked: couches can suggest fixes, but only you change it':'Couches can fix it: two agreeing changes it for everyone'}</small></span><span class="wv-sw${lock?' on':''}"><i></i></span></button></section>
    <section class="blk"><div class="sh"><h2 class="cap">Timeline</h2><span class="aside">Not spoiler-safe</span></div>${rbUpd(s,true)}</section>
    <section class="blk"><div class="sh"><h2 class="cap">History</h2></div>${H.map(t=>`<div class="adm-h">${t}</div>`).join('')}</section>
    <section class="blk"><button class="btn out wide" data-rbadm="tpl">Save as a starting point for new shows</button></section><div style="height:40px"></div></div></div>`;
  app.querySelectorAll('[data-rbov]').forEach(b=>b.onclick=()=>{const i=b.dataset.rbov;if(i==='kind')return rbKindSheet(s,()=>{(RBS.hist[id]=RBS.hist[id]||[]).push(`You set the kind: ${rbKindName(s).toLowerCase()} · just now`);adminRulebook(id)});
    const [l,v]=rbParts(s)[+i];rbOverride(s,l,v,R.reach,kind=>{(RBS.hist[id]=RBS.hist[id]||[]).push(`You overrode ${l.toLowerCase()} (${kind}) · just now`);adminRulebook(id)})});
  $('rbLock').onclick=()=>{RBS.lock[id]=!lock;toast(lock?'Unlocked':'Locked');adminRulebook(id)};
  app.querySelectorAll('[data-rbadm]').forEach(b=>b.onclick=()=>b.dataset.rbadm==='how'?howPage(s,{back:'Rulebook'}):toast('Saved as a starting point: new shows like it start from this'));$('scroller').scrollTop=0}
function rbOverride(s,label,val,reach,done){let kind='fix',from=Math.max(2,rbYou(s));
  openSheet(`Override · ${label}`,`Reaches: ${reach}`,`<label class="aibox-l"><span class="cap">${label}</span><textarea class="aibox" id="ovT">${val}</textarea></label>
    <p class="label cap">What kind of change?</p>
    <button class="typecard on" data-ovk="fix"><span><b>Fix a mistake</b><small>It was always like this. Every couch is rescored from the start; house rulings keep theirs.</small></span></button>
    <button class="typecard" data-ovk="show"><span><b>The show changed</b><small>From one ${rbUnit(s).toLowerCase()} on. Earlier ones keep their scores.</small></span></button>
    <div id="ovFrom" hidden><p class="label cap">From</p>${[from,from+1,from+2].map((e,i)=>`<button class="chip${i===0?' on':''}" data-ovf="${e}">${rbUnit(s)} ${e}</button>`).join('')}</div>
    <button class="btn pri wide" id="ovGo" style="margin-top:12px">Save override</button>`,
    b=>{b.querySelectorAll('[data-ovk]').forEach(x=>x.onclick=()=>{kind=x.dataset.ovk;b.querySelectorAll('[data-ovk]').forEach(y=>y.classList.toggle('on',y===x));$('ovFrom').hidden=kind!=='show'});
      b.querySelectorAll('[data-ovf]').forEach(x=>x.onclick=()=>b.querySelectorAll('[data-ovf]').forEach(y=>y.classList.toggle('on',y===x)));
      $('ovGo').onclick=()=>{closeSheet();toast(kind==='fix'?'Fixed for every couch · rescoring now · undo in History':'Changed from that point on · undo in History');done&&done(kind==='fix'?'a fix':'the show changed')}})}
const adminRouteRB=adminRoute;
adminRoute=function(p){if(p[1]==='rb')return adminRulebook(p[2]);return adminRouteRB(p)};

// ---------- mock scenarios (mockmenu.js) and URL presets: ?rb=made|f1play|new5|ours ----------
function rbSet(o={}){RBS.kind={};RBS.ours=!!o.ours;RBS.off.clear();RBS.custom=[];RBS.took=null;RBS.new5=o.new5||'reported';
  ['ar','bd','plu','snl','f1'].forEach(id=>{const s=ALL_SHOWS.find(x=>x.id===id);if(!s)return;s.unready=!(o.made||[]).includes(id);delete W.games[id]});
  (o.add||[]).forEach(id=>state.added.add(id));if(o.f1play){W.games.f1={g:'lineup',told:true,team:['Lando Norris','Charles Leclerc','George Russell','Oscar Piastri','Fernando Alonso'],start:['Lando Norris','Charles Leclerc','George Russell']}}
  if(o.rev)SHOWSTATE.revealed=o.rev}
{const q=new URLSearchParams(location.search).get('rb');if(q){const m={made:{made:['ar','bd','plu','snl','f1'],add:['snl','f1']},f1play:{made:['f1'],add:['f1'],f1play:true},new5:{rev:5},ours:{ours:true,new5:'confirmed',rev:5}}[q];if(m)rbSet(m)}}
// the router's first render ran before this file's wrappers existed: render once more with them
route();
