// ================= a brand-new couch: one show added, no games yet =================
// The empty state (Scenarios → New couch, or ?fresh=1): Survivor is on the couch but nobody has started a game, so
// the hub leads with "Get the couch going" (start a game, add shows, invite), and the parts that need history
// (power rankings, trophies, chatter) say what will appear there instead of showing data.
const SURV_PLAYING=SHOWS.find(s=>s.id==='surv');
const FRESH_SURV={...SURV_PLAYING,kinds:undefined,games:undefined,need:false,explore:true,aired:4,onEp:4,
  todo:{kind:'Start',t:'Start the first game',d:'Survival Pool from Episode 5 · no draft'}};
const FRESH_FEED=[['riley','joined Couch Council','Watches Survivor',null],['jordan','joined Couch Council','Watches Survivor',null],['alex','started Couch Council','Added Survivor 51',null]];
// wireHub (index.html) wires these by id, so the empty states keep hidden copies
const HUB_STUBS={ranks:'<div hidden><div class="tabs" id="rankTabs"><span class="pill"></span><button class="on" data-t="year"></button></div><div id="rankPane"></div><button id="allRank"></button></div>',trophies:'<div hidden><button id="allSeasons"></button></div>'};
const freshOn=()=>!!state.fresh&&SHOWS.includes(FRESH_SURV);

const hubFresh=hub;
hub=function(){let h=hubFresh();if(!freshOn())return h;
  h=h.replace(/<p class="hello">[\s\S]*?<\/p>/,`<p class="hello"><strong>Evening, alex.</strong> Couch Council is brand new · riley and jordan are on.</p>`);
  h=h.replace('<section class="sec"><div class="sh"><h2 class="cap">Your shows</h2>',`<section class="sec"><div class="f-go"><span class="tg cap">New couch</span><h3 class="cap">Get the couch going</h3>
      <button class="f-step" data-fgo="game"><span class="n num">1</span><span class="tx"><b>Start a game</b><small>Survival Pool needs no draft. It can start with Episode 5 on Wednesday.</small></span>${svg('chev')}</button>
      <button class="f-step" data-fgo="show"><span class="n num">2</span><span class="tx"><b>Add the other shows you watch</b><small>The couch sees what everyone's watching. That's where games start.</small></span>${svg('chev')}</button>
      <button class="f-step" data-fgo="invite"><span class="n num">3</span><span class="tx"><b>Invite more people</b><small>Send K7Q2XZ. ${N} on the couch so far.</small></span>${svg('chev')}</button></div></section>
    <section class="sec"><div class="sh"><h2 class="cap">Your shows</h2>`);
  h=h.replace(/<section class="sec"><div class="sh"><h2 class="cap">Power rankings<\/h2>[\s\S]*?<\/section>/,`<section class="sec"><div class="sh"><h2 class="cap">Power rankings</h2></div><div class="f-empty">${svg('cup')}<span><b>Rankings start with your first game</b><small>Every game on the couch counts toward one table for the year.</small></span></div>${HUB_STUBS.ranks}</section>`);
  h=h.replace(/<section class="sec"><div class="sh"><h2 class="cap">Trophy shelf<\/h2>[\s\S]*?<div class="shelfline"><\/div><\/section>/,`<section class="sec"><div class="sh"><h2 class="cap">Trophy shelf</h2></div><div class="f-empty">${svg('crown')}<span><b>Your first trophy goes here</b><small>Win a season and it stays on the shelf, every season after.</small></span></div>${HUB_STUBS.trophies}</section>`);
  return h.replace(/<button class="mini" data-mini="(trivia|party)">[\s\S]*?<\/button>/g,'').replace('3 of 4 in · a card for every tribal cliché','start a card for the couch')};
const feedHTMLFresh=feedHTML;
feedHTML=function(){if(!freshOn())return feedHTMLFresh();return FRESH_FEED.map(e=>evHTML(e)).join('')};
const wireHubFresh=wireHub;
wireHub=function(){wireHubFresh();if(!freshOn())return;
  app.querySelectorAll('[data-fgo]').forEach(b=>b.onclick=()=>({game:()=>newGameSheet(FRESH_SURV),show:addShowSheet,invite:couchSheet})[b.dataset.fgo]())};
const notesSheetFresh=notesSheet;
notesSheet=function(){if(!freshOn())return notesSheetFresh();
  openSheet('Notifications','2 new',`<button class="row unread"><span class="ic">${svg('people')}</span><span class="tx"><b>riley and jordan joined Couch Council</b><small>sam joined yesterday</small></span><span class="when">1h</span></button>
    <button class="row unread"><span class="ic"><img src="${ART('survivor')}" alt="" style="object-position:64% 50%"></span><span class="tx"><b>Survivor 51 · Episode 5 is Wednesday</b><small>Start a game before then and it counts from Episode 5</small></span><span class="when">3h</span></button>`)};
// with no game, Survivor's show space still has the real cast and its scores
const wStandingsFresh=wStandings;
wStandings=function(s){if(s!==FRESH_SURV)return wStandingsFresh(s);const w=whereOf(s,'alex'),rows=S51.cast.map(c=>({c,tot:c.perEp.slice(0,w).reduce((a,b)=>a+(b||0),0),out:c.exitEp&&c.exitEp<=w?c.exitEp:0})).sort((a,b)=>(!!a.out-!!b.out)||b.tot-a.tot);
  return `<section class="blk"><div class="sh"><h2 class="cap">Who's scoring</h2><span class="aside">through Ep ${w}</span></div>
    ${rows.slice(0,12).map((r,i)=>`<div class="w-board${r.out?' out':''}"><span class="rk num">${i+1}</span><img src="${ph(r.c)}" alt=""><span class="tx"><b>${first(r.c.name)}</b><small>${r.out?`Out · Episode ${r.out}`:`${(r.tot/Math.max(1,w)).toFixed(1)} a week`}</small></span><b class="num">${r.tot}</b></div>`).join('')}</section>
    <div class="playplate"><span class="tg cap">Play it</span><h4 class="cap">Survivor 51 with your couch</h4><p>Survival Pool starts from Episode 5, no draft. Or draft a team from this cast.</p><button class="btn" data-wjob="newgame">Start a game</button></div>`};
const wCastFresh=wCast;
wCast=function(s){if(s!==FRESH_SURV)return wCastFresh(s);return `<section class="blk"><div class="sh"><h2 class="cap">The cast</h2><span class="aside">${S51.cast.length} castaways</span></div><div class="w-cast">${S51.cast.filter(c=>c.photo).map(c=>`<div><img src="${ph(c)}" alt=""><b class="cap">${first(c.name)}</b></div>`).join('')}</div></section>`};
