// ================= Ask an AI =================
// One component wherever a prompt is needed. ChatGPT and Grok open our brief link directly (proven in
// prod); anything else copies the question. Remembers your choice; offers to paste when you come back.
const AI={pref:null,tried:false,step:0};
const AIS=[['chatgpt','ChatGPT','#10a37f','Opens the ChatGPT app or chatgpt.com'],['grok','Grok','#e8e8e8','Opens Grok or grok.com']];
const SAMPLE_ANSWER=`EPISODE 4 RESULTS (Survivor 51)
VOTED OUT: Jenna Doore (5-1)
IMMUNITY: Dina
REWARD: Toka
IDOL FOUND: Eric Macksoud
MAJORITY VOTE: Mike Pinsky, Kristin Flickinger, Brady Booker, +5
SOURCES: survivor.fandom.com, ew.com`;
function askAI({title,what,brief,onDone}){AI.step=0;const pref=AI.pref||'chatgpt';const P=AIS.find(a=>a[0]===pref);
  const paint=b=>{b.innerHTML=`<div class="aitrack">${['Open','It answers','Copy & paste back'].map((t,i)=>`<span class="${i<=AI.step?'on':''}${i===AI.step?' cur':''}"><i class="num">${i+1}</i>${t}</span>`).join('')}</div>
    ${AI.step===0?`<p class="aiwhat">${what}</p>
      <button class="aigo" id="aigo" style="--ai:${P[2]}"><span class="ailogo" style="background:${P[2]}">${P[1][0]}</span><span><b>Open in ${P[1]}</b><small>${P[3]}</small></span>${svg('chev')}</button>
      <div class="aialt">${AIS.filter(a=>a[0]!==pref).map(a=>`<button data-ai="${a[0]}"><span class="ailogo sm" style="background:${a[2]}">${a[1][0]}</span>Use ${a[1]} instead</button>`).join('')}<button id="aicopy">${svg('copy')}Another AI? Copy the question</button></div>
      <p class="muted small aifine">Free. Uses your own account; free versions work. We send the AI a short link to the question, nothing else.</p>`
    :`<div class="aiback"><span class="wb">${svg('check')}</span><div><b>${AI.step===1?`${P[1]} is answering`:'Welcome back'}</b><small>${AI.step===1?'When it finishes, copy its whole answer (long-press, Copy) and come back here.':'Copied the answer? Paste it below.'}</small></div></div>
      <button class="btn pri wide" id="aipaste">${svg('copy')}Paste the answer</button>
      <textarea class="aibox" id="aibox" placeholder="Or paste here yourself"></textarea>
      <p class="aicheck" id="aicheck"></p>
      <div class="frow"><button class="btn out" id="aiagain">Open ${P[1]} again</button><button class="btn pri" id="aiuse" disabled>Use this answer</button></div>`}`;
    const go=$('aigo');if(go)go.onclick=()=>{AI.pref=pref;AI.step=1;paint(b);toast(`Opening ${P[1]}… (mock)`);setTimeout(()=>{AI.step=2;paint(b)},2600)};
    b.querySelectorAll('[data-ai]').forEach(x=>x.onclick=()=>{AI.pref=x.dataset.ai;askAI({title,what,brief,onDone})});
    const cp=$('aicopy');if(cp)cp.onclick=()=>{navigator.clipboard?.writeText(brief||'(the full question)').catch(()=>{});toast('Question copied. Paste it into any AI chat that can search the web.');AI.step=2;paint(b)};
    const check=v=>{const c=$('aicheck'),n=(v.match(/^[A-Z ]+:/gm)||[]).length;if(!v.trim()){c.textContent='';c.className='aicheck';$('aiuse').disabled=true;return}
      if(n>=4){c.innerHTML=`${svg('check')}Looks right: ${n} results found`;c.className='aicheck ok';$('aiuse').disabled=false}else{c.innerHTML=`${svg('quiz')}That doesn't look like the whole answer. Did you copy all of it?`;c.className='aicheck bad';$('aiuse').disabled=true}};
    const ps=$('aipaste');if(ps)ps.onclick=()=>{$('aibox').value=SAMPLE_ANSWER;check(SAMPLE_ANSWER);$('aibox').classList.add('filled')};
    const bx=$('aibox');if(bx)bx.oninput=e=>check(e.target.value);
    const ag=$('aiagain');if(ag)ag.onclick=()=>{AI.step=1;paint(b);setTimeout(()=>{AI.step=2;paint(b)},2000)};
    const us=$('aiuse');if(us)us.onclick=()=>{closeSheet();onDone&&onDone()}};
  openSheet(title,'Ask an AI · about 2 minutes','',paint)}
