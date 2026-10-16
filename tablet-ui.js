// Tablet layout: the 3D viewer fills the screen and the catalog, details and
// settings become drawers. Desktop and phone layouts are left untouched.
// Force a layout for testing with ?ui=tablet or ?ui=desktop.

const $=id=>document.getElementById(id);
const DRAG_CLOSE=80;

export function isTabletLayout(touchDevice){
  const forced=new URLSearchParams(location.search).get('ui');
  if(forced==='tablet')return true;if(forced==='desktop')return false;
  // Touch-primary devices only: iPadOS reports itself as a Mac, while touchscreen laptops keep a fine pointer.
  const touchPrimary=matchMedia('(pointer:coarse)').matches||/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1;
  return touchDevice&&touchPrimary&&Math.min(screen.width,screen.height)>=700;
}

export function setupTabletUI({touchDevice,onInsetChange=()=>{}}={}){
  const active=isTabletLayout(touchDevice),root=document.documentElement;
  root.classList.toggle('tablet-ui',active);
  // Skip the drawer transitions while the layout first switches to tablet mode.
  if(active){root.classList.add('ui-preload');requestAnimationFrame(()=>requestAnimationFrame(()=>root.classList.remove('ui-preload')))}
  const noop={active:false,showDetail(){},hideDetail(){},closeAll(){}};
  if(!active)return noop;

  const layout=$('view-atlas'),catalog=$('catalog-panel'),detail=$('detail-drawer'),settings=$('viewer-settings'),scrim=$('drawer-scrim');
  // Keep the floating toolbar short enough for portrait: rotate/export live with the other settings.
  settings.prepend(document.querySelector('.viewer-actions'));
  const open={catalog:false,detail:false,settings:false};
  const buttons={catalog:$('open-catalog'),detail:$('open-detail'),settings:$('open-settings')};
  let inset={x:0,y:0},insetFrame=0;
  const portrait=()=>innerHeight>innerWidth;

  function targetInset(){
    if(!open.detail)return{x:0,y:0};
    return portrait()?{x:0,y:detail.offsetHeight}:{x:detail.offsetWidth,y:0};
  }
  // Re-centre the model in the part of the viewer the drawers leave visible.
  function animateInset(){
    cancelAnimationFrame(insetFrame);
    const from={...inset},to=targetInset(),start=performance.now(),duration=matchMedia('(prefers-reduced-motion:reduce)').matches?0:300;
    onInsetChange(inset.x,inset.y,to);
    const step=now=>{
      const f=duration?Math.min(1,(now-start)/duration):1,ease=1-(1-f)**3;
      inset={x:from.x+(to.x-from.x)*ease,y:from.y+(to.y-from.y)*ease};onInsetChange(inset.x,inset.y,to);
      if(f<1)insetFrame=requestAnimationFrame(step);
    };
    insetFrame=requestAnimationFrame(step);
  }
  function render(){
    for(const key in open){layout.dataset[key]=open[key]?'open':'closed';buttons[key]?.setAttribute('aria-expanded',String(open[key]))}
    scrim.hidden=!open.catalog;
    root.classList.toggle('tablet-portrait',portrait());
    detail.style.transform='';catalog.style.transform='';
    animateInset();
  }
  function set(key,value){
    if(open[key]===value)return;open[key]=value;
    if(value&&key==='catalog'){open.settings=false;if(portrait())open.detail=false}
    if(value&&key==='detail'&&portrait())open.catalog=false;
    if(value&&key==='settings'){open.catalog=false;if(portrait())open.detail=false}
    render();
  }
  const toggle=key=>set(key,!open[key]);

  buttons.catalog.addEventListener('click',()=>toggle('catalog'));
  buttons.detail.addEventListener('click',()=>toggle('detail'));
  buttons.settings.addEventListener('click',()=>toggle('settings'));
  scrim.addEventListener('click',()=>set('catalog',false));
  for(const button of document.querySelectorAll('[data-close-drawer]'))button.addEventListener('click',()=>set(button.closest('#catalog-panel')?'catalog':'detail',false));
  $('selected-label').addEventListener('click',()=>set('detail',true));
  // Picking a structure from the list should reveal the model, not keep the list on top of it.
  $('structure-list').addEventListener('click',e=>{if(e.target.closest('button'))setTimeout(()=>set('catalog',false),120)});
  document.addEventListener('pointerdown',e=>{if(open.settings&&!e.target.closest?.('#viewer-settings,#open-settings'))set('settings',false)});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&(open.catalog||open.detail||open.settings)){open.catalog=open.detail=open.settings=false;render()}});
  addEventListener('resize',()=>{root.classList.toggle('tablet-portrait',portrait());animateInset()});

  // Swipe a drawer back towards its edge to close it.
  function draggable(handle,panel,key,axis){
    let drag=null;
    handle.addEventListener('pointerdown',e=>{if(e.target.closest('button,input,select,a,textarea'))return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,d:0};handle.setPointerCapture(e.pointerId);panel.classList.add('dragging')});
    handle.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const a=axis();drag.d=Math.max(0,a==='y'?e.clientY-drag.y:a==='x'?e.clientX-drag.x:drag.x-e.clientX);panel.style.transform=a==='y'?`translateY(${drag.d}px)`:`translateX(${a==='x'?drag.d:-drag.d}px)`});
    const end=e=>{if(!drag||drag.id!==e.pointerId)return;const closing=drag.d>DRAG_CLOSE;drag=null;panel.classList.remove('dragging');panel.style.transform='';if(closing)set(key,false)};
    handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);
  }
  draggable(detail.querySelector('.drawer-grip'),detail,'detail',()=>portrait()?'y':'x');
  draggable(catalog.querySelector('.panel-heading'),catalog,'catalog',()=>'-x');

  render();
  return{
    active:true,
    showDetail(){set('detail',true)},
    hideDetail(){set('detail',false)},
    closeAll(){open.catalog=open.detail=open.settings=false;render()}
  };
}
