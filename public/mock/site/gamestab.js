// ================= the Games tab: the same five tabs on every show (decided 2026-10-24) =================
// Tonight · Episodes · Games · Cast · Chat on every show (solo drops Chat). Games is where you play: your standings
// when you're in a game, then this week's episode games and "Start a game"; on a show nobody plays yet, "Make it a
// game" and the episode games; a solo player gets public pools and a practice couch here (solo.js). The route key
// stays /standings so old links keep working.
// this week's one-night games, for any show the couch follows
function epGamesHTML(s){const t=s.air?nextAir(s.air):null,cast=!s.series,rows=[];
  if(t)rows.push(['bingo','bingo',`Episode ${s.ep} bingo`,`Opens ${DAY[t.getDay()]} ${clock(t)} · tap squares as it happens`]);
  rows.push(cast?['predict','quiz','Who goes home?',`One tap · closes at airtime`]:['call','quiz',`Call it for Episode ${s.ep}`,'Two calls · see who got it after']);
  if(s.id==='trt')rows.push(['poll','poll','Banishment poll','Started by riley · 10 seconds']);
  if(s.id==='surv')rows.push(['trivia','quiz','Survivor 49 trivia','3 questions from the real season']);
  return `<section class="blk"><div class="sh"><h2 class="cap">This week</h2><span class="aside">One night each</span></div>
    ${rows.map(([k,ic,tt,d])=>`<button class="row g-ep" data-eg="${k}"><span class="ic">${svg(ic)}</span><span class="tx"><b>${tt}</b><small>${d}</small></span>${svg('chev')}</button>`).join('')}</section>
  <section class="blk"><button class="cp-start" data-gstart>${svg('plus')}<span><b>Start a game</b><small>A season game, bingo, a poll or trivia. Anyone on the couch can.</small></span></button></section>`}
function wireEpGames(s){
  app.querySelectorAll('[data-eg]').forEach(b=>b.onclick=()=>({bingo:()=>s.id==='surv'?bingoSheet():toast(`${s.short} bingo opens when the episode starts (mock)`),predict:()=>s.id==='surv'?predictSheet():toast('Opens for the next episode (mock)'),
    call:()=>callSheet(s),poll:pollSheet,trivia:triviaSheet})[b.dataset.eg]());
  app.querySelectorAll('[data-gstart]').forEach(b=>b.onclick=()=>s.kinds?newGameSheet(s):newGameW(s))}
// a show you play: the tables, then this week's games
const tabBarG=tabBar;
tabBar=function(s){return tabBarG(s).replace(/(<a href="#\/show\/[^/"]+\/standings"[^>]*>)(<svg[\s\S]*?<\/svg>)Standings/,'$1$2Games')};
const tabStandingsG=tabStandings;
tabStandings=function(s){if(N===1)return soloGamesHTML(s);return tabStandingsG(s)+epGamesHTML(s)};
const wireShowG=wireShow;
wireShow=function(s){wireShowG(s);if(SHOWSTATE.tab==='standings'){N===1?wireSoloGames(s):wireEpGames(s)}};
// a show nobody plays yet (or a series): make it a game, and this week's games
wStandings=function(s){if(N===1)return soloGamesHTML(s);
  const lead=s.unready?`<section class="blk"><div class="playplate"><span class="tg cap">Not a game yet</span><h4 class="cap">Make ${s.short} a game</h4><p>One AI question finds the cast and what should score. Anyone can do it, and every couch can play it after.</p><button class="btn" data-wjob="make">Make it a game</button></div></section>`
    :s.series?`<section class="blk"><p class="g-lede">${s.short} has no season game, and doesn't need one: call what happens each episode, or start a bingo night.</p></section>`
    :`<section class="blk"><div class="playplate"><span class="tg cap">Play it</span><h4 class="cap">${s.short} with your couch</h4><p>Survival Pool starts from the next episode, no draft. Or draft a team from this cast.</p><button class="btn" data-wjob="newgame">Start a game</button></div></section>`;
  return lead+epGamesHTML(s)};
const showRouteGT=showRoute;
showRoute=function(sid,tab){showRouteGT(sid,tab);const a=app.querySelector('.tabbar a[href$="/standings"]');if(a)a.innerHTML=`${svg('cup')}Games`;
  const s=SHOWS.find(x=>x.id===sid);if(s&&!s.kinds&&(W.tab==='standings'))N===1?wireSoloGames(s):wireEpGames(s)};
