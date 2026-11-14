// Mount the actual V4 renderer at its own viewport; do not approximate its markup.
(() => {
  const original=window.TonightV4Layout;
  const kind=new URLSearchParams(location.search).get('section');
  if(new URLSearchParams(location.search).get('storage')==='tonight-data-r3')window.__TONIGHT_REVIEW_STORAGE__='tonight-data-r3';
  const selectors={season:'.viewing-progress',pace:'.v4-people',games:'.v4-games'};
  window.TonightV4Layout=a=>{
    const view=original(a);
    return {...view,render(){
      view.render();
      const component=document.querySelector(selectors[kind])?.cloneNode(true);
      const root=document.createElement('main');root.className='v4 wrap';
      const content=document.createElement('div');content.className='v4-content';
      if(component)content.append(component);else content.innerHTML='<p class="privacy-note">No games joined. Watching and reacting remain available.</p>';
      root.append(content);document.getElementById('app').replaceChildren(root);
      const resize=()=>parent.postMessage({type:'tonight-component-height',kind,height:Math.ceil(root.getBoundingClientRect().height)},location.origin);
      new ResizeObserver(resize).observe(root);document.fonts.ready.then(resize);
    }};
  };
  document.addEventListener('click',event=>{
    const control=event.target.closest('[data-action]');
    if(!control||parent===window)return;
    event.preventDefault();event.stopImmediatePropagation();
    parent.postMessage({type:'tonight-component-action',kind,dataset:{...control.dataset}},location.origin);
  },true);
})();
