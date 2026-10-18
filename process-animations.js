import * as THREE from 'three';

// Physiological process animations over the existing 3D models (digestion, nerve impulse).
// The player owns the timeline and the control bar; each process module builds only helper objects
// (bolus, glows, ions) and never adds or removes catalogued parts. Frames are requested only while playing.
export const PROCESSES=[
  {id:'digestion-body',title:'Digestão: trajeto do alimento',where:'Corpo inteiro',target:{mode:'body',layers:['visceral']},module:'./process-digestion.js',factory:'createBodyDigestion'},
  {id:'esophagus',title:'Peristaltismo no esôfago',where:'Corte do esôfago',target:{mode:'internal-esophagus',organ:'esophagus',representation:'detailed'},module:'./process-digestion.js',factory:'createEsophagusProcess'},
  {id:'stomach',title:'Mistura e esvaziamento do estômago',where:'Corte do estômago',target:{mode:'internal-stomach',organ:'stomach',representation:'detailed'},module:'./process-digestion.js',factory:'createStomachProcess'},
  {id:'small-intestine',title:'Intestino delgado: segmentação e absorção',where:'Corte do intestino delgado',target:{mode:'internal-small-intestine',organ:'small-intestine',representation:'detailed'},module:'./process-digestion.js',factory:'createSmallIntestineProcess'},
  {id:'large-intestine',title:'Intestino grosso: haustros e movimento de massa',where:'Corte do intestino grosso',target:{mode:'internal-large-intestine',organ:'large-intestine',representation:'detailed'},module:'./process-digestion.js',factory:'createLargeIntestineProcess'},
  {id:'cardiac-cycle',title:'Ciclo cardíaco',where:'Corte do coração',target:{mode:'internal-heart',organ:'heart',representation:'detailed'},module:'./process-heart.js',factory:'createCardiacCycle'},
  {id:'nerve-impulse',title:'Impulso nervoso e sinapse',where:'Neurônio do tecido nervoso',target:{mode:'histo-nervous-tissue'},module:'./process-neuron.js',factory:'createNerveImpulse'}
];
const SPEEDS=[.5,1,2];
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Shared look for helper objects: soft additive glows and "seen through the wall" copies.
let glowTexture=null;
export function getGlowTexture(){
  if(glowTexture)return glowTexture;
  const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),r=g.createRadialGradient(32,32,0,32,32,32);
  r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.25,'rgba(255,255,255,.55)');r.addColorStop(.6,'rgba(255,255,255,.12)');r.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=r;g.fillRect(0,0,64,64);glowTexture=new THREE.CanvasTexture(c);glowTexture.colorSpace=THREE.SRGBColorSpace;return glowTexture;
}
export function glowSprite(color,size,opacity=1){
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:getGlowTexture(),color,transparent:true,opacity,blending:THREE.AdditiveBlending,depthWrite:false,depthTest:false,toneMapped:false}));
  s.scale.setScalar(size);s.renderOrder=40;s.userData.noOcclusion=true;return s;
}
export function xrayMaterial(color,opacity=.4){return new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthTest:false,depthWrite:false,toneMapped:false})}
// Smooth curve through measured centre points (arc-length parameter 0–1).
export function smoothPath(points,every=1){const kept=points.filter((p,i)=>i%every===0||i===points.length-1);return new THREE.CatmullRomCurve3(kept.map(p=>new THREE.Vector3(...p)),false,'centripetal')}
export const smoothstep=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};
export const clamp01=x=>Math.min(1,Math.max(0,x));
// Marks helper objects so picking, occlusion and the catalogue ignore them.
export function helper(object){object.traverse(o=>{o.userData.noOcclusion=true;o.userData.processHelper=true;o.raycast=()=>{}});return object}
export function disposeObject(root){root.removeFromParent();root.traverse(o=>{if(o.geometry&&!o.userData.sharedGeometry)o.geometry.dispose();for(const m of [].concat(o.material||[]))if(m&&!m.userData?.shared)m.dispose()})}

// --- Wall motion (detailed cuts, heart). ---
// Each vertex stores its position along a route (s, offset by 1000 so a missing attribute, read as 0, never moves)
// and the nearest route point in its own mesh space; a vertex shader scales the surface towards/away from that
// point with up to six Gaussian waves along s. With every wave at zero the drawing is identical to the original.
const WAVES={value:Array.from({length:6},()=>new THREE.Vector4(-10,1,0,0))};
const WAVE_KEY='atlas-process-wave-v2';
function wrapMaterial(material){
  if(!material||material.userData.atlasProcessWave||!(material.isMeshStandardMaterial||material.isMeshPhysicalMaterial))return;
  material.userData.atlasProcessWave=true;const compile=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.onBeforeCompile=function(shader,renderer){compile.call(this,shader,renderer);shader.uniforms.atlasWaves=WAVES;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec4 atlasWave;\nuniform vec4 atlasWaves[6];')
      .replace('#include <begin_vertex>',`#include <begin_vertex>
      if(atlasWave.x>500.0){float atlasS=atlasWave.x-1000.0,atlasK=0.0;for(int i=0;i<6;i++){vec4 w=atlasWaves[i];float d=(atlasS-w.x)/w.y;atlasK+=w.z*exp(-d*d);}transformed=atlasWave.yzw+(transformed-atlasWave.yzw)*(1.0+atlasK);}`)};
  material.customProgramCacheKey=()=>key+'|'+WAVE_KEY;material.needsUpdate=true;
}
const nextTask=()=>new Promise(resolve=>{const channel=new MessageChannel();channel.port1.onmessage=()=>resolve();channel.port2.postMessage(0)});
// Grid cell → one number (no string per lookup); exact while |index| < 1024, i.e. within ±1024 cells of the origin.
const cellId=(x,y,z)=>((x+1024)*2048+(y+1024))*2048+(z+1024);
/** routes: [{curve, offset, reach, accept?(mesh)}] in scene space; s = offset + arc-length position (0–1).
 * Built once per geometry in ~6 ms slices, so the page keeps responding (the heart took >4 s in one block). */
export async function createWaveField(group,routes,key){
  const meshes=[];group.updateMatrixWorld(true);group.traverse(o=>{if(o.isMesh&&o.geometry?.attributes.position)meshes.push(o)});
  // Each cell holds its route points flattened as x, y, z, s (doubles: same distances and ties as Vector3 math).
  const sets=routes.map(r=>{const cell=r.reach,lists=new Map(),n=Math.max(64,Math.round(r.curve.getLength()/.006));for(let i=0;i<=n;i++){const u=i/n,p=r.curve.getPointAt(u),id=cellId(Math.floor(p.x/cell),Math.floor(p.y/cell),Math.floor(p.z/cell));let list=lists.get(id);if(!list)lists.set(id,list=[]);list.push(p.x,p.y,p.z,r.offset+u)}
    const grid=new Map();for(const[id,list]of lists)grid.set(id,Float64Array.from(list));return{r,cell,grid}});
  const a=new THREE.Vector3(),inverse=new THREE.Matrix4();let slice=performance.now();
  for(const mesh of meshes){
    const g=mesh.geometry;if(g.userData.atlasWaveKey===key)continue;
    const pos=g.attributes.position,data=new Float32Array(pos.count*4),allowed=sets.filter(x=>!x.r.accept||x.r.accept(mesh)),e=mesh.matrixWorld.elements;inverse.copy(mesh.matrixWorld).invert();
    for(let i=0;i<pos.count;i++){
      if((i&1023)===0&&performance.now()-slice>6){await nextTask();slice=performance.now()}
      const x0=pos.getX(i),y0=pos.getY(i),z0=pos.getZ(i),w=1/(e[3]*x0+e[7]*y0+e[11]*z0+e[15]);
      const x=(e[0]*x0+e[4]*y0+e[8]*z0+e[12])*w,y=(e[1]*x0+e[5]*y0+e[9]*z0+e[13])*w,z=(e[2]*x0+e[6]*y0+e[10]*z0+e[14])*w;
      let best=null,bi=0,bd=Infinity;
      for(const {r,cell,grid} of allowed){const gx=Math.floor(x/cell),gy=Math.floor(y/cell),gz=Math.floor(z/cell),limit=r.reach*r.reach;
        for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){const list=grid.get(cellId(gx+dx,gy+dy,gz+dz));if(list)for(let j=0;j<list.length;j+=4){const px=list[j]-x,py=list[j+1]-y,pz=list[j+2]-z,d=px*px+py*py+pz*pz;if(d<bd&&d<limit){bd=d;best=list;bi=j}}}}
      if(best){a.set(best[bi],best[bi+1],best[bi+2]).applyMatrix4(inverse);data[i*4]=best[bi+3]+1000;data[i*4+1]=a.x;data[i*4+2]=a.y;data[i*4+3]=a.z}else data[i*4]=-100;
    }
    g.setAttribute('atlasWave',new THREE.BufferAttribute(data,4));g.userData.atlasWaveKey=key;
  }
  // Materials can be swapped (selection, opacity): wrap whatever each mesh currently uses, every frame.
  return{set(i,s,width,amplitude){WAVES.value[i].set(s,width,amplitude,0)},clear(){for(const w of WAVES.value)w.set(-10,1,0,0)},ensure(){for(const m of meshes)for(const material of [].concat(m.material))wrapMaterial(material)}};
}

/** Control bar and timeline. `app` supplies the scene and how to open each model. */
export function createProcessPlayer({bar,menu,toggle,app}){
  const $=id=>bar.querySelector('#'+id)||menu.querySelector('#'+id);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let active=null,token=0;
  const ui={step:$('process-step'),title:$('process-title'),text:$('process-text'),link:$('process-link'),prev:$('process-prev'),play:$('process-play'),next:$('process-next'),scrub:$('process-scrub'),speed:$('process-speed'),close:$('process-close'),note:$('process-note'),name:$('process-name'),chart:$('process-chart')};
  const chartCanvas=ui.chart.querySelector('canvas'),chartContext=chartCanvas.getContext('2d');
  // Optional live graph (the neuron's membrane potential), redrawn with each animation frame.
  function drawChart(){const chart=active?.anim.chart;if(!chart||ui.chart.hidden)return;const ratio=Math.min(2,devicePixelRatio||1),w=chartCanvas.clientWidth,h=chartCanvas.clientHeight;if(!w||!h)return;if(chartCanvas.width!==Math.round(w*ratio)){chartCanvas.width=Math.round(w*ratio);chartCanvas.height=Math.round(h*ratio)}chartContext.setTransform(ratio,0,0,ratio,0,0);chart.draw(chartContext,w,h)}
  menu.querySelector('.process-list').innerHTML=PROCESSES.map(p=>`<button type="button" role="menuitem" data-process="${p.id}"><strong>${escapeHtml(p.title)}</strong><small>${escapeHtml(p.where)}</small></button>`).join('');
  function setMenu(open){menu.hidden=!open;toggle.setAttribute('aria-expanded',String(open));if(open){const current=PROCESSES.find(p=>p.target.mode===app.mode());menu.querySelectorAll('[data-process]').forEach(b=>b.classList.toggle('suggested',b.dataset.process===current?.id));(menu.querySelector('.suggested')||menu.querySelector('[data-process]'))?.focus({preventScroll:true})}}
  toggle.addEventListener('click',()=>setMenu(menu.hidden));
  menu.addEventListener('click',e=>{const b=e.target.closest('[data-process]');if(b){setMenu(false);start(b.dataset.process)}});
  menu.addEventListener('keydown',e=>{if(e.key==='Escape'){setMenu(false);toggle.focus()}});
  document.addEventListener('pointerdown',e=>{if(!menu.hidden&&!menu.contains(e.target)&&!toggle.contains(e.target))setMenu(false)});
  const stillMode=()=>reduced.matches;
  function stepAt(t){const steps=active.steps;for(let i=steps.length-1;i>=0;i--)if(t>=steps[i].start-1e-6)return i;return 0}
  function stillTime(i){const s=active.steps[i];return s.start+(s.still??.6)*s.duration}
  function render(){
    const a=active;if(!a)return;const i=stepAt(a.time),s=a.steps[i];
    if(i!==a.shown){a.shown=i;if(s.frame)app.frame(s.frame,s.tight);ui.step.textContent='Passo '+(i+1)+' de '+a.steps.length;ui.title.textContent=s.title;ui.text.textContent=s.text;
      const link=s.link&&PROCESSES.find(p=>p.id===s.link);ui.link.hidden=!link;if(link){ui.link.textContent=s.linkLabel||('Ver no '+link.where.toLowerCase()+' ↗');ui.link.dataset.process=link.id}
      ui.prev.disabled=i===0;ui.next.disabled=i===a.steps.length-1}
    const ended=a.time>=a.duration-1e-3;ui.play.textContent=a.playing?'❚❚':ended?'↺':'▶';ui.play.setAttribute('aria-label',a.playing?'Pausar':ended?'Repetir':'Reproduzir');
    if(document.activeElement!==ui.scrub)ui.scrub.value=String(Math.round(a.time/a.duration*1000));
    drawChart();
  }
  function seek(t,{keepPlaying=true}={}){const a=active;if(!a)return;a.time=Math.min(a.duration,Math.max(0,t));if(!keepPlaying)a.playing=false;a.last=0;a.anim.update(a.time,stepAt(a.time));render();app.requestRender()}
  function goStep(i){if(!active)return;i=Math.max(0,Math.min(active.steps.length-1,i));seek(stillMode()?stillTime(i):active.steps[i].start)}
  function setPlaying(on){const a=active;if(!a)return;if(stillMode()){goStep(stepAt(a.time)+1);return}if(on&&a.time>=a.duration-1e-3)seek(0);a.playing=on;a.last=0;render();app.requestRender()}
  ui.play.addEventListener('click',()=>setPlaying(!active?.playing));
  ui.prev.addEventListener('click',()=>goStep(stepAt(active.time)-(active.time-active.steps[stepAt(active.time)].start>1.2&&!stillMode()?0:1)));
  ui.next.addEventListener('click',()=>goStep(stepAt(active.time)+1));
  ui.scrub.addEventListener('input',()=>{if(active)seek(Number(ui.scrub.value)/1000*active.duration,{keepPlaying:false})});
  ui.speed.addEventListener('click',()=>{if(!active)return;active.speed=SPEEDS[(SPEEDS.indexOf(active.speed)+1)%SPEEDS.length];ui.speed.textContent=String(active.speed).replace('.',',')+'×';ui.speed.setAttribute('aria-label','Velocidade '+ui.speed.textContent)});
  ui.close.addEventListener('click',()=>stop());
  ui.link.addEventListener('click',()=>{const id=ui.link.dataset.process;if(id)start(id)});
  bar.addEventListener('keydown',e=>{if(e.key==='Escape')stop()});
  function applyMotionPreference(){bar.classList.toggle('still',stillMode());ui.note.textContent=stillMode()?'Movimento reduzido: cada passo mostra uma imagem fixa. Esquema ilustrativo, formas simplificadas.':'Animação ilustrativa: formas simplificadas, cores didáticas e tempo comprimido.';if(active){active.playing=false;if(stillMode())seek(stillTime(stepAt(active.time)));render()}}
  reduced.addEventListener?.('change',applyMotionPreference);applyMotionPreference();
  function stop(){token++;const a=active;active=null;bar.hidden=true;app.viewport.classList.remove('process-open');app.layout(0);if(a){try{a.anim.dispose()}catch(error){console.error(error)}app.requestRender()}}
  async function start(id){
    const def=PROCESSES.find(p=>p.id===id);if(!def)return;stop();const mine=++token;
    bar.hidden=false;app.viewport.classList.add('process-open');ui.name.textContent=def.title;ui.chart.hidden=true;ui.step.textContent='Abrindo…';ui.title.textContent=def.where;ui.text.textContent='Preparando o modelo e a animação.';ui.link.hidden=true;ui.play.disabled=true;
    try{
      const [opened,mod]=await Promise.all([app.open(def.target),import(def.module)]);
      if(mine!==token)return;if(!opened||app.mode()!==def.target.mode){stop();app.toast('Não foi possível abrir o modelo desta animação.');return}
      const anim=await mod[def.factory]({THREE,app,mode:def.target.mode});if(mine!==token){anim.dispose();return}
      let t=0;const steps=anim.steps.map(s=>{const out={...s,start:t};t+=s.duration;return out});
      active={def,anim,steps,duration:t,time:0,speed:1,playing:false,last:0,shown:-1,mode:def.target.mode};ui.speed.textContent='1×';
      ui.chart.hidden=!anim.chart;bar.classList.toggle('with-chart',!!anim.chart);if(anim.chart)ui.chart.querySelector('figcaption').textContent=anim.chart.caption||'';
      // Helper materials compile before the first animated frame, so playback does not start with a hitch.
      await app.warm();if(mine!==token)return;
      ui.play.disabled=false;seek(stillMode()?stillTime(0):0);
      // The model is framed above the bar: its height with the first step's text offsets the projection once.
      app.layout(bar.offsetHeight+12);app.frame(active.steps[0].frame||anim.frame||null,active.steps[0].tight);
      if(!stillMode())setPlaying(true);
      (stillMode()?ui.next:ui.play).focus({preventScroll:true});
    }catch(error){console.error(error);if(mine===token){stop();app.toast('A animação não pôde ser carregada. Tente novamente.')}}
  }
  return{
    start,stop,
    get playing(){return!!active?.playing},
    get active(){return active},
    // Called by the render loop before each frame. Returns true when this frame changed the animation.
    update(now){
      const a=active;if(!a)return false;
      if(app.mode()!==a.mode){stop();return false}
      if(!a.playing)return false;
      const dt=a.last?Math.min(.1,(now-a.last)/1000):0;a.last=now;a.time=Math.min(a.duration,a.time+dt*a.speed);
      if(a.time>=a.duration)a.playing=false;
      a.anim.update(a.time,stepAt(a.time));render();return true;
    },
    // Verification without a painting page: place the animation at a time and leave the frame to the caller.
    seekTo(t){if(active){active.playing=false;seek(t,{keepPlaying:false})}return active?{step:stepAt(active.time),duration:active.duration}:null}
  };
}
