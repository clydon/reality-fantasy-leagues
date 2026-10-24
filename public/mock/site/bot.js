// ================= how results get in: copy and paste, One tap, Autopilot (2026-10-24) =================
// bot.gameyourshow.com is our ChatGPT session (docs/PLAN-bot-research.md): "Ask ChatGPT for me" runs our question and
// pastes the answer, and on a schedule it checks who went home ~5 minutes after airing, every point within the hour,
// and again overnight. Three ways for a couch to get each show-season's results in, decided with the user:
//   Copy and paste  free, always: copy our question into ChatGPT, paste the answer back (anyone on the couch)
//   One tap         $1 for the season: "Ask ChatGPT for me", one tap an episode; one person unlocks it for the couch
//   Autopilot       $5 for the season ($4 after One tap): results arrive on their own; disabled for now, coming soon
// Who went home (the quick check) is always free: it's what keeps a commissioner spoiler-safe. While in beta every
// price shows what it will be, with a "Free during beta" label, and nothing is charged.
const BOT={unlocked:new Set(),tier:{},asked:new Set()};
const botTier=sid=>BOT.unlocked.has(sid)?'tap':'paste';
const betaChip='<span class="bt-beta cap">Free during beta</span>';
// the Ask an AI sheet leads with "Ask ChatGPT for me"; copy and paste is one tap away
const askAIBase=askAI;
askAI=function(opts){const sid='surv',on=BOT.unlocked.has(sid);let state='idle';
  const body=()=>state==='run'?`<div class="bt-run"><span class="bt-spin"></span><div><b>ChatGPT is searching the web</b><small>Usually under 2 minutes · you can close this; we'll ping you</small></div></div><div class="bt-bar"><i></i></div>`
    :state==='done'?`<div class="bt-done">${svg('check')}<div><b>Found 7 results for Episode 5</b><small>From 3 sources · checked against the cast</small></div></div><pre class="bt-ans">${SAMPLE_ANSWER.split('\n').slice(0,5).join('\n')}\n…</pre><button class="btn pri wide" id="btUse">Use this answer</button>`
    :`${opts.what?`<p class="aiwhat">${opts.what}</p>`:''}
      <button class="bt-ask" id="btAsk"><span class="bt-ic">${svg('bolt')}</span><span class="tx"><b>Ask ChatGPT for me</b><small>${on?'One tap: our bot asks and pastes the answer':'One tap an episode, for the whole couch'}</small></span>${on?svg('chev'):`<span class="bt-price"><b>$1</b><small>this season</small></span>`}</button>
      ${on?'':`<p class="bt-note">${betaChip}Unlock it once for Survivor 51 and anyone on the couch can use it.</p>`}
      <button class="row bt-manual" id="btManual"><span class="ic">${svg('copy')}</span><span class="tx"><b>Copy and paste it yourself</b><small>Free, always · about 2 minutes</small></span>${svg('chev')}</button>`;
  openSheet(opts.title,on?'One tap · unlocked for this season':'Get this episode\'s results in',`<div id="btB">${body()}</div>`,b=>{const paint=()=>{$('btB').innerHTML=body();wire()};
    const run=()=>{state='run';paint();setTimeout(()=>{state='done';paint()},2400)};
    const wire=()=>{const a=$('btAsk');if(a)a.onclick=()=>{if(!BOT.unlocked.has(sid)){BOT.unlocked.add(sid);toast('One tap unlocked for Survivor 51 · free during beta')}run()};
      const m=$('btManual');if(m)m.onclick=()=>{closeSheet();setTimeout(()=>askAIBase(opts),230)};
      const u=$('btUse');if(u)u.onclick=()=>{closeSheet();opts.onDone&&opts.onDone()}};wire()})};
// Backstage › Results: the three ways, the quick check always free
const bsResultsB=bsResults;
bsResults=function(s){let h=bsResultsB(s);const t=botTier(s.id);
  h=h.replace('A low-cost search runs 30 and 60 minutes after airtime. Free, on by default.','Our bot checks who went home about 5 minutes after the episode, and keeps checking until it\'s sure. Always free.');
  const opt=(k,name,price,d,cur,dis)=>`<button class="bt-opt${cur?' on':''}${dis?' off':''}" data-bt="${k}"><span class="hd"><i></i><b class="cap">${name}</b><span class="bt-p">${price}</span></span><small>${d}</small>${cur?`<span class="bt-cur cap">${k==='tap'?'Unlocked for this season':'How you do it now'}</span>`:''}</button>`;
  const how=`<section class="blk"><div class="sh"><h2 class="cap">How results get in</h2>${betaChip}</div>
    ${opt('paste','Copy and paste','Free','Anyone on the couch copies our question into ChatGPT and pastes the answer. About 2 minutes an episode.',t==='paste')}
    ${opt('tap','One tap','$1 a season','"Ask ChatGPT for me": our bot asks and pastes it in. One tap an episode, for the whole couch.',t==='tap')}
    ${opt('auto','Autopilot','$5 a season','Results arrive on their own: who went home minutes after the episode, every point within the hour, checked again overnight. Nobody taps anything.',false,true)}
    <p class="bt-fine">Prices are what they'll be after beta; nothing is charged now. Autopilot is coming soon. ${t==='tap'?'With One tap it will be $4.':''}</p></section>`;
  return h.replace('<section class="blk"><div class="sh"><h2 class="cap">Full scores</h2>',how+'<section class="blk"><div class="sh"><h2 class="cap">Full scores</h2>').replace(`${svg('bolt')}Ask an AI</button>`,`${svg('bolt')}${t==='tap'?'Ask ChatGPT':'Ask an AI'}</button>`)};
const wireBSB=wireBS;
wireBS=function(sid,page){wireBSB(sid,page);if(page!=='results')return;const re=()=>backstageRoute(sid,'results');
  app.querySelectorAll('[data-bt]').forEach(b=>b.onclick=()=>{const k=b.dataset.bt;
    if(k==='auto')return toast('Autopilot is coming soon · we\'ll tell you when it\'s ready');
    if(k==='tap'&&!BOT.unlocked.has(sid))openSheet('Unlock One tap?','Survivor 51 · for everyone on the couch',`<div class="bt-sum"><b class="num">$1</b><span>for the whole season<small>Every episode's results with one tap, for anyone on the couch. Copy and paste still works too.</small></span></div><p class="bt-note">${betaChip}Nothing is charged during beta.</p><button class="btn pri wide" id="btUnlock" style="margin-top:12px">Unlock for Survivor 51</button>`,
      bb=>$('btUnlock').onclick=()=>{BOT.unlocked.add(sid);closeSheet();toast('One tap unlocked for Survivor 51 · free during beta');re()});
    if(k==='paste'&&BOT.unlocked.has(sid))toast('One tap stays unlocked this season; copy and paste always works too')})};
// mock scenarios
function botSet(o){BOT.unlocked=new Set(o&&o.tap?['surv']:[])}
{const q=new URLSearchParams(location.search).get('bot');if(q)botSet({tap:q==='tap'})}
route();
