// Annotation board over the 3D viewer. Strokes live in viewport-relative coordinates, are saved per model
// (localStorage) and redrawn on resize. An Apple Pencil always draws; fingers keep rotating the model unless
// board mode is on (then any pointer draws). Tools: pen (pressure), pencil, pigment brush, highlighter,
// eraser, stroke eraser, line, arrow, rectangle, ellipse, text and an eyedropper that also reads the 3D scene.

const $=id=>document.getElementById(id);
const STORAGE='atlas-board-';
export const BOARD_TOOLS=[
  ['pen','Caneta','✒'],['pencil','Lápis','✏'],['brush','Pincel','🖌'],['highlighter','Marca-texto','▮'],
  ['eraser','Borracha','◻'],['stroke-eraser','Apagar traço','⌫'],['line','Linha','╱'],['arrow','Seta','➚'],
  ['rect','Retângulo','▭'],['ellipse','Círculo','◯'],['text','Texto','T'],['eyedropper','Conta-gotas','💧'],
];
export const BOARD_PALETTES=[
  ['Anatomia',[['#d8343f','Artéria'],['#2f6fd6','Veia'],['#f2c230','Nervo'],['#3fae6b','Linfa'],['#efe6d2','Osso'],['#a8423e','Músculo']]],
  ['Básicas',[['#111111','Preto'],['#ffffff','Branco'],['#8a96a3','Cinza'],['#ff8a1f','Laranja'],['#9b59d0','Roxo'],['#18b6c9','Ciano']]],
];
export const BOARD_BACKGROUNDS=[['default','Escuro padrão'],['chalk-green','Lousa verde'],['chalk-black','Lousa preta'],['white','Quadro branco'],['grid','Papel quadriculado']];
const SHAPES=new Set(['line','arrow','rect','ellipse']);

// Small deterministic generator so pencil grain replays identically after reload.
const grain=seed=>()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);

export function createDrawBoard({viewport,panel,toggle,sample3D=()=>null,snapshot3D=null,onChange=()=>{}}){
  const base=document.createElement('canvas'),live=document.createElement('canvas');
  base.className='draw-layer';live.className='draw-layer draw-live';
  viewport.append(base,live);
  const ctx=base.getContext('2d'),liveCtx=live.getContext('2d');
  const settings={tool:'pen',color:'#d8343f',size:6,opacity:1,background:'default',visible:true};
  try{Object.assign(settings,JSON.parse(localStorage.getItem(STORAGE+'settings')||'{}'))}catch{}
  let strokes=[],undone=[],context='body',active=false,current=null,penSeen=false,ratio=1;

  // ---- geometry helpers ----
  const box=()=>viewport.getBoundingClientRect();
  const toLocal=e=>{const r=box();return{x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height,p:e.pointerType==='pen'?Math.max(.05,e.pressure||.5):e.pointerType==='mouse'?.5:.6}};
  const scale=()=>Math.min(base.width,base.height)/1000; // stroke sizes are stored per 1000 px of the short side
  const px=pt=>[pt.x*base.width,pt.y*base.height];

  function resize(){
    ratio=Math.min(devicePixelRatio||1,2);const r=box(),w=Math.max(1,Math.round(r.width*ratio)),h=Math.max(1,Math.round(r.height*ratio));
    if(base.width===w&&base.height===h)return;for(const c of [base,live]){c.width=w;c.height=h}redraw();
  }

  // ---- drawing ----
  function strokeStyle(c,s){
    c.globalCompositeOperation=s.tool==='eraser'?'destination-out':'source-over';
    c.strokeStyle=c.fillStyle=s.color;c.globalAlpha=s.tool==='highlighter'?Math.min(.4,s.opacity):s.opacity;
    c.lineCap=s.tool==='highlighter'?'square':'round';c.lineJoin='round';c.shadowBlur=0;
    if(s.tool==='brush'){c.shadowColor=s.color;c.shadowBlur=s.size*scale()*.9}
  }
  function drawFreehand(c,s){
    const pts=s.points;if(!pts.length)return;strokeStyle(c,s);const k=scale();
    if(s.tool==='highlighter'||s.tool==='eraser'){
      // Constant width in one path, so overlapping segments do not darken (highlighter) or leave seams (eraser).
      c.lineWidth=s.size*k*(s.tool==='highlighter'?2.2:1.6);c.beginPath();const [x0,y0]=px(pts[0]);c.moveTo(x0,y0);
      for(let i=1;i<pts.length;i++){const [x,y]=px(pts[i]);c.lineTo(x,y)}if(pts.length===1)c.lineTo(x0+.1,y0);c.stroke();return;
    }
    const random=grain(s.seed||1);
    for(let i=0;i<pts.length;i++){
      const a=pts[Math.max(0,i-1)],b=pts[i],[ax,ay]=px(a),[bx,by]=px(b);
      const pressure=s.tool==='pen'?.35+.9*b.p:s.tool==='brush'?.5+.8*b.p:1;
      c.lineWidth=Math.max(.5,s.size*k*pressure*(s.tool==='pencil'?.55:1));
      if(s.tool==='pencil')c.globalAlpha=s.opacity*(.55+.35*random());
      c.beginPath();c.moveTo(ax,ay);c.lineTo(bx+(i?0:.01),by);c.stroke();
    }
  }
  function drawShape(c,s){
    strokeStyle(c,s);const k=scale(),[x0,y0]=px(s.points[0]),[x1,y1]=px(s.points.at(-1));c.lineWidth=Math.max(1,s.size*k);c.beginPath();
    if(s.tool==='rect')c.rect(Math.min(x0,x1),Math.min(y0,y1),Math.abs(x1-x0),Math.abs(y1-y0));
    else if(s.tool==='ellipse')c.ellipse((x0+x1)/2,(y0+y1)/2,Math.abs(x1-x0)/2,Math.abs(y1-y0)/2,0,0,Math.PI*2);
    else{c.moveTo(x0,y0);c.lineTo(x1,y1)}
    c.stroke();
    if(s.tool==='arrow'){const a=Math.atan2(y1-y0,x1-x0),head=Math.max(14,s.size*k*4.2);c.beginPath();c.moveTo(x1,y1);c.lineTo(x1-head*Math.cos(a-.45),y1-head*Math.sin(a-.45));c.lineTo(x1-head*Math.cos(a+.45),y1-head*Math.sin(a+.45));c.closePath();c.fill()}
  }
  function drawText(c,s){strokeStyle(c,s);const k=scale(),size=Math.max(10,s.size*k*3.5);c.font=`600 ${size}px system-ui,-apple-system,"Segoe UI",sans-serif`;c.textBaseline='top';const [x,y]=px(s.points[0]);s.text.split('\n').forEach((line,i)=>c.fillText(line,x,y+i*size*1.2))}
  function drawStroke(c,s){c.save();if(s.tool==='text')drawText(c,s);else if(SHAPES.has(s.tool))drawShape(c,s);else drawFreehand(c,s);c.restore()}
  function redraw(){ctx.clearRect(0,0,base.width,base.height);for(const s of strokes)drawStroke(ctx,s);base.hidden=live.hidden=!settings.visible}
  function drawLive(){liveCtx.clearRect(0,0,live.width,live.height);if(current&&current.tool!=='eraser')drawStroke(liveCtx,current)}

  // ---- persistence ----
  const save=()=>{try{localStorage.setItem(STORAGE+context,JSON.stringify(strokes))}catch{onChange('full')}};
  const saveSettings=()=>{try{localStorage.setItem(STORAGE+'settings',JSON.stringify(settings))}catch{}};
  function setContext(name){
    if(name===context&&strokes.length)return;context=name;undone=[];
    try{strokes=JSON.parse(localStorage.getItem(STORAGE+name)||'[]')}catch{strokes=[]}redraw();onChange('context');
  }
  function commit(stroke){strokes.push(stroke);undone=[];save();redraw();onChange('stroke')}

  // ---- stroke eraser: removes every stroke passing near the pointer ----
  function eraseStrokesAt(pt){
    const [x,y]=px(pt),radius=Math.max(8,settings.size*scale()*1.5),before=strokes.length;
    strokes=strokes.filter(s=>!s.points.some((q,i)=>{const [qx,qy]=px(q);if(Math.hypot(qx-x,qy-y)<radius+s.size*scale())return true;if(SHAPES.has(s.tool)&&i===0){const [ex,ey]=px(s.points.at(-1));return distanceToSegment(x,y,qx,qy,ex,ey)<radius}return false}));
    if(strokes.length!==before){undone=[];save();redraw();onChange('stroke')}
  }
  const distanceToSegment=(x,y,ax,ay,bx,by)=>{const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/((dx*dx+dy*dy)||1)));return Math.hypot(x-ax-t*dx,y-ay-t*dy)};

  // ---- eyedropper: annotation pixel first, otherwise the 3D scene ----
  function pickColor(e){
    const r=box(),x=Math.round((e.clientX-r.left)*ratio),y=Math.round((e.clientY-r.top)*ratio);let rgb=null;
    try{const d=ctx.getImageData(x,y,1,1).data;if(d[3]>40)rgb=[d[0],d[1],d[2]]}catch{}
    rgb||=sample3D(e.clientX,e.clientY);
    if(!rgb)return;const hex='#'+rgb.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
    settings.color=hex;settings.tool=settings.previousTool||'pen';saveSettings();onChange('settings');
  }

  // ---- text entry ----
  function placeText(pt,e){
    const r=box(),input=document.createElement('textarea');input.className='draw-text-input';input.rows=2;input.placeholder='Escreva e toque fora';
    input.style.left=(e.clientX-r.left)+'px';input.style.top=(e.clientY-r.top)+'px';input.style.color=settings.color;viewport.append(input);setTimeout(()=>input.focus(),0);
    const done=()=>{const text=input.value.trim();input.remove();if(text)commit({tool:'text',color:settings.color,size:settings.size,opacity:settings.opacity,points:[pt],text})};
    input.addEventListener('blur',done,{once:true});input.addEventListener('keydown',ev=>{if(ev.key==='Escape'){input.value='';input.blur()}});
  }

  // ---- input routing: capture phase on the viewport, before OrbitControls and picking see the event ----
  const drawsWith=e=>e.pointerType==='pen'||active;
  let pointerId=null;
  viewport.addEventListener('pointerdown',e=>{
    if(e.target.closest('.draw-text-input'))return;
    if(e.pointerType==='pen')penSeen=true;
    // While the Pencil is drawing, ignore resting palms and other fingers.
    if(pointerId!==null){e.stopPropagation();e.preventDefault();return}
    if(!drawsWith(e))return;
    e.stopPropagation();e.preventDefault();const pt=toLocal(e);
    if(settings.tool==='eyedropper'){pickColor(e);return}
    if(settings.tool==='text'){placeText(pt,e);return}
    pointerId=e.pointerId;try{viewport.setPointerCapture(e.pointerId)}catch{}
    if(settings.tool==='stroke-eraser'){current={tool:'stroke-eraser',points:[pt]};eraseStrokesAt(pt);return}
    current={tool:settings.tool,color:settings.color,size:settings.size,opacity:settings.opacity,points:[pt],seed:(Math.random()*1e9)|0};
    if(settings.tool==='eraser'){ctx.save();drawFreehand(ctx,current);ctx.restore()}else drawLive();
  },true);
  viewport.addEventListener('pointermove',e=>{
    if(e.pointerId!==pointerId||!current)return;e.stopPropagation();e.preventDefault();
    const events=e.getCoalescedEvents?.()||[e];
    for(const ev of events.length?events:[e]){
      const pt=toLocal(ev);
      if(current.tool==='stroke-eraser'){eraseStrokesAt(pt);continue}
      if(SHAPES.has(current.tool))current.points[1]=pt;else current.points.push(pt);
    }
    if(current.tool==='eraser'){ctx.save();drawFreehand(ctx,{...current,points:current.points.slice(-3)});ctx.restore()}else if(current.tool!=='stroke-eraser')drawLive();
  },true);
  const finish=e=>{
    if(e.pointerId!==pointerId)return;e.stopPropagation();pointerId=null;const stroke=current;current=null;liveCtx.clearRect(0,0,live.width,live.height);
    if(!stroke||stroke.tool==='stroke-eraser')return;
    if(SHAPES.has(stroke.tool)&&stroke.points.length<2)return;
    commit(stroke);
  };
  viewport.addEventListener('pointerup',finish,true);viewport.addEventListener('pointercancel',finish,true);
  // Safari starts page gestures from touch events; block them only while a stroke is in progress.
  viewport.addEventListener('touchmove',e=>{if(pointerId!==null)e.preventDefault()},{passive:false});

  // ---- actions ----
  const api={
    get settings(){return settings},get active(){return active},get penSeen(){return penSeen},get strokeCount(){return strokes.length},
    // Drawing mode (any pointer draws, compact bar visible) is independent from the full options panel.
    setActive(on){active=on;viewport.classList.toggle('board-active',on);toggle?.setAttribute('aria-pressed',String(on));if(!on&&panel)panel.hidden=true;onChange('active')},
    toggle(){api.setActive(!active)},
    setPanel(open){if(panel)panel.hidden=!open;onChange('panel')},
    get panelOpen(){return !!panel&&!panel.hidden},
    set(key,value){if(key==='tool'&&value==='eyedropper'&&settings.tool!=='eyedropper')settings.previousTool=['eraser','stroke-eraser','text'].includes(settings.tool)?'pen':settings.tool;settings[key]=value;saveSettings();if(key==='visible')redraw();onChange('settings')},
    undo(){if(!strokes.length)return;undone.push(strokes.pop());save();redraw();onChange('stroke')},
    redo(){if(!undone.length)return;strokes.push(undone.pop());save();redraw();onChange('stroke')},
    clear(){if(!strokes.length)return;undone=[...strokes].reverse();strokes=[];save();redraw();onChange('stroke')},
    setContext,resize,redraw,
    // Flattened image of the 3D view (supplied by the app) with the annotations on top.
    async exportImage(){
      resize();const out=document.createElement('canvas');out.width=base.width;out.height=base.height;const o=out.getContext('2d');
      paintBackground(o,out.width,out.height,settings.background);
      const scene=snapshot3D?.();if(scene)o.drawImage(scene,0,0,out.width,out.height);
      if(settings.visible)o.drawImage(base,0,0);
      return await new Promise(resolve=>out.toBlob(resolve,'image/png'));
    },
  };
  new ResizeObserver(resize).observe(viewport);resize();
  document.addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey)||e.key.toLowerCase()!=='z'||/INPUT|TEXTAREA/.test(document.activeElement?.tagName))return;if(!active&&!strokes.length)return;e.preventDefault();e.shiftKey?api.redo():api.undo()});
  return api;
}

// Background paint used for exported images; the live viewer uses the matching CSS classes.
export function paintBackground(c,w,h,kind){
  const fill=color=>{c.fillStyle=color;c.fillRect(0,0,w,h)};
  if(kind==='chalk-green')fill('#2c4a3a');else if(kind==='chalk-black')fill('#1d2124');else if(kind==='white')fill('#f6f6f2');
  else if(kind==='grid'){fill('#fbfaf4');c.strokeStyle='#d7dde6';c.lineWidth=1;const step=Math.round(Math.min(w,h)/36);for(let x=0;x<w;x+=step){c.beginPath();c.moveTo(x+.5,0);c.lineTo(x+.5,h);c.stroke()}for(let y=0;y<h;y+=step){c.beginPath();c.moveTo(0,y+.5);c.lineTo(w,y+.5);c.stroke()}}
  else{const g=c.createRadialGradient(w*.5,h*.4,0,w*.5,h*.4,Math.max(w,h)*.7);g.addColorStop(0,'#202f40');g.addColorStop(1,'#0e1927');c.fillStyle=g;c.fillRect(0,0,w,h)}
}

// Tool palette: tools, colours (anatomy and basic pigments plus a free picker), size, opacity, background and actions.
export function mountBoardPanel(panel,board,{surface,onExport,onClose}={}){
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  panel.innerHTML=`
    <div class="board-row board-tools" role="toolbar" aria-label="Ferramentas do quadro">${BOARD_TOOLS.map(([id,label,icon])=>`<button type="button" data-tool="${id}" title="${label}" aria-label="${label}"><span aria-hidden="true">${icon}</span><small>${label}</small></button>`).join('')}</div>
    <div class="board-row board-colors">${BOARD_PALETTES.map(([name,colors])=>`<div class="board-palette" role="group" aria-label="Cores: ${name}"><small>${name}</small>${colors.map(([hex,label])=>`<button type="button" class="swatch" data-color="${hex}" title="${label}" aria-label="${label}" style="--swatch:${hex}"></button>`).join('')}</div>`).join('')}
      <label class="board-picker" title="Outra cor"><input type="color" id="board-color" aria-label="Escolher outra cor"><span>Outra cor</span></label></div>
    <div class="board-row board-sliders">
      <label>Espessura <input type="range" id="board-size" min="1" max="40" step="1"></label>
      <label>Opacidade <input type="range" id="board-opacity" min="10" max="100" step="5"></label>
      <label>Fundo <select id="board-background">${BOARD_BACKGROUNDS.map(([id,label])=>`<option value="${id}">${esc(label)}</option>`).join('')}</select></label>
    </div>
    <div class="board-row board-actions">
      <button type="button" data-action="undo" title="Desfazer (Ctrl+Z)">↶ Desfazer</button><button type="button" data-action="redo" title="Refazer (Ctrl+Shift+Z)">↷ Refazer</button>
      <button type="button" data-action="visible" aria-pressed="false">Ocultar anotações</button><button type="button" data-action="clear">Limpar</button>
      <button type="button" data-action="export" class="primary">Salvar imagem</button><button type="button" data-action="close" class="board-close" aria-label="Fechar opções (continua desenhando)">✕</button>
    </div>
    <p class="board-hint">Fechar este painel não sai do desenho; use “Concluir” na barra lateral. Com Apple Pencil você desenha a qualquer momento e o dedo continua girando o modelo. As anotações ficam salvas neste aparelho, por modelo.</p>`;
  const mini=document.createElement('div');mini.className='board-mini';mini.hidden=true;mini.setAttribute('role','toolbar');mini.setAttribute('aria-label','Quadro: ferramentas rápidas');
  mini.innerHTML=[['pen','Caneta','✒'],['highlighter','Marca-texto','▮'],['eraser','Borracha','◻']].map(([id,label,icon])=>`<button type="button" data-tool="${id}" title="${label}" aria-label="${label}">${icon}</button>`).join('')+
    '<button type="button" class="mini-color" data-mini="panel" title="Cor e mais opções" aria-label="Cor e mais opções"><span></span></button><button type="button" data-action="undo" title="Desfazer" aria-label="Desfazer">↶</button><button type="button" data-action="redo" title="Refazer" aria-label="Refazer">↷</button>'+
    '<button type="button" data-mini="panel" class="mini-more" aria-label="Mais opções" title="Mais opções">⋯</button><button type="button" data-mini="done" class="mini-done" title="Concluir desenho" aria-label="Concluir desenho">✓</button>';
  panel.before(mini);
  mini.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.tool)board.set('tool',b.dataset.tool);if(b.dataset.action==='undo')board.undo();if(b.dataset.action==='redo')board.redo();if(b.dataset.mini==='panel')board.setPanel(!board.panelOpen);if(b.dataset.mini==='done')onClose?.()});
  const q=s=>panel.querySelector(s);
  panel.addEventListener('click',e=>{
    const tool=e.target.closest('[data-tool]'),color=e.target.closest('[data-color]'),action=e.target.closest('[data-action]');
    if(tool)board.set('tool',tool.dataset.tool);
    if(color){board.set('color',color.dataset.color);if(['eraser','stroke-eraser','eyedropper'].includes(board.settings.tool))board.set('tool','pen')}
    if(!action)return;const a=action.dataset.action;
    if(a==='undo')board.undo();if(a==='redo')board.redo();if(a==='visible')board.set('visible',!board.settings.visible);
    if(a==='clear'&&board.strokeCount&&confirm('Apagar todas as anotações deste modelo? Você pode desfazer logo em seguida.'))board.clear();
    if(a==='export')onExport?.();if(a==='close')board.setPanel(false);
  });
  q('#board-color').addEventListener('input',e=>board.set('color',e.target.value));
  q('#board-size').addEventListener('input',e=>board.set('size',Number(e.target.value)));
  q('#board-opacity').addEventListener('input',e=>board.set('opacity',Number(e.target.value)/100));
  q('#board-background').addEventListener('change',e=>board.set('background',e.target.value));
  function refresh(){
    const s=board.settings;
    for(const b of [...panel.querySelectorAll('[data-tool]'),...mini.querySelectorAll('[data-tool]')])b.setAttribute('aria-pressed',String(b.dataset.tool===s.tool));
    mini.hidden=!board.active;mini.querySelector('.mini-more').setAttribute('aria-pressed',String(board.panelOpen));mini.style.setProperty('--board-color',s.color);
    for(const b of panel.querySelectorAll('[data-color]'))b.setAttribute('aria-pressed',String(b.dataset.color.toLowerCase()===s.color.toLowerCase()));
    q('#board-color').value=s.color;q('#board-size').value=s.size;q('#board-opacity').value=Math.round(s.opacity*100);q('#board-background').value=s.background;
    const visible=q('[data-action="visible"]');visible.textContent=s.visible?'Ocultar anotações':'Mostrar anotações';visible.setAttribute('aria-pressed',String(!s.visible));
    panel.style.setProperty('--board-color',s.color);
    if(surface){for(const [id] of BOARD_BACKGROUNDS)surface.classList.toggle('board-bg-'+id,s.background===id&&id!=='default')}
  }
  refresh();return{refresh};
}
