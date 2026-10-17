import * as THREE from 'three';
import {glowSprite,xrayMaterial,smoothstep,clamp01,helper,disposeObject} from './process-animations.js';

// Nerve impulse over the neuron of the "Tecido nervoso" reconstruction (histology-models.js, case
// 'nervous-tissue'): soma at (−0.36, 0.11), axon fibre along a curve at z 0.075, four myelin segments whose
// gaps are the Ranvier nodes, axon terminal at (0.68, 0.13). Only helper objects are added (ions, glows,
// vesicles, a schematic postsynaptic cell); they are removed when the animation closes.
const AXON=new THREE.CatmullRomCurve3([[-.22,.10,.075],[-.02,.06,.075],[.35,.07,.075],[.67,.13,.075]].map(p=>new THREE.Vector3(...p)),false,'centripetal');
const HILLOCK=-.2,NODES=[.135,.27,.405,.54],TERMINAL=[.68,.13,.08],POST=[.865,.13,.035];
const DENDRITES=[0,1,2,3].map(i=>{const y=.38-i*.18;return new THREE.CatmullRomCurve3([[-.78,y+.06,.09],[-.59,y,.09],[-.44,.11,.09]].map(p=>new THREE.Vector3(...p)))});
// Point of the axon at a given x (the fibre runs left to right).
const axonSamples=AXON.getSpacedPoints(400);
function axonAt(x,target=new THREE.Vector3()){let best=axonSamples[0];for(const p of axonSamples)if(Math.abs(p.x-x)<Math.abs(best.x-x))best=p;return target.copy(best)}
const hash=n=>{const s=Math.sin(n*127.1+311.7)*43758.5453;return s-Math.floor(s)};
const lerp=(a,b,f)=>a+(b-a)*f;
function instanced(count,radius,color,opacity=.9,segments=8){
  const mesh=new THREE.InstancedMesh(new THREE.SphereGeometry(1,segments,Math.max(4,segments-2)),xrayMaterial(color,opacity),count);mesh.renderOrder=37;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const m=new THREE.Matrix4(),q=new THREE.Quaternion(),s=new THREE.Vector3(),p=new THREE.Vector3();
  return{mesh,set(i,x,y,z,scale){p.set(x,y,z);s.setScalar(Math.max(0,scale)*radius);m.compose(p,q,s);mesh.setMatrixAt(i,m)},commit(){mesh.instanceMatrix.needsUpdate=true}};
}
// Membrane potential of one point of the axon over the course of an action potential (typical values, mV).
function actionPotential(phase){
  if(phase<=0||phase>=1)return -70;
  if(phase<.12)return lerp(-70,-55,phase/.12);
  if(phase<.3)return lerp(-55,30,smoothstep(.12,.3,phase));
  if(phase<.55)return lerp(30,-80,smoothstep(.3,.55,phase));
  return lerp(-80,-70,smoothstep(.55,1,phase));
}

export async function createNerveImpulse({app,mode}){
  const model=app.studyModel(mode);if(!model)throw new Error('Modelo do tecido nervoso indisponível.');
  const root=new THREE.Group();root.name='process-nerve-impulse';app.scene.add(root);
  // Schematic postsynaptic cell to the right of the terminal (exaggerated cleft), receptors facing the terminal.
  const post=new THREE.Mesh(new THREE.SphereGeometry(1,40,28),new THREE.MeshStandardMaterial({color:0x9fb7d4,roughness:.62,metalness:0}));post.position.set(...POST);post.scale.set(.1,.17,.05);root.add(post);
  const receptorMaterial=new THREE.MeshStandardMaterial({color:0x5d86c4,roughness:.5,emissive:0x000000}),receptors=new THREE.InstancedMesh(new THREE.CylinderGeometry(.005,.005,.014,8),receptorMaterial,6);
  {const m=new THREE.Matrix4(),q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2);for(let k=0;k<6;k++){const dy=(k-2.5)*.018,x=POST[0]-.1*Math.sqrt(Math.max(0,1-(dy/.17)**2))+.002;m.compose(new THREE.Vector3(x,POST[1]+dy,.07),q,new THREE.Vector3(1,1,1));receptors.setMatrixAt(k,m)}}
  root.add(receptors);
  const vesicles=instanced(10,.009,0xffe6a8,.85),transmitter=instanced(30,.0045,0xfff27a,.95),calcium=instanced(8,.0055,0xf3c862,.95);
  const sodium=instanced(44,.0055,0xff9a5c,.9),potassium=instanced(30,.0055,0xb59cff,.9),graded=instanced(8,.013,0xffe0a0,.8);
  root.add(vesicles.mesh,transmitter.mesh,calcium.mesh,sodium.mesh,potassium.mesh,graded.mesh);
  // Depolarisation glows: the firing node, a faint trail across the myelinated segment, the soma, hillock and terminal.
  const nodeGlow=glowSprite(0xffb36b,.12,0),trailGlow=glowSprite(0xffd7a0,.07,0),somaGlow=glowSprite(0xffc58a,.36,0),hillockGlow=glowSprite(0xffa060,.1,0),terminalGlow=glowSprite(0xffc070,.12,0);
  somaGlow.position.set(-.36,.11,.1);axonAt(HILLOCK,hillockGlow.position);terminalGlow.position.set(...TERMINAL);root.add(nodeGlow,trailGlow,somaGlow,hillockGlow,terminalGlow);
  const box=new THREE.Box3().setFromObject(model.group).expandByObject(post),synapse=new THREE.Box3(new THREE.Vector3(.58,.0,-.02),new THREE.Vector3(.9,.26,.1));
  const steps=[
    {title:'Potencial de repouso',duration:4,still:.6,frame:box,text:'Em repouso, o interior da membrana é negativo em relação ao exterior (cerca de −70 mV). A bomba de Na+/K+ mantém mais Na+ fora (laranja) e mais K+ dentro (lilás); o repouso depende sobretudo da saída de K+ por canais abertos.'},
    {title:'Estímulos nos dendritos',duration:5,still:.7,frame:box,text:'Sinais recebidos nos dendritos geram potenciais graduados, que se espalham até o corpo celular perdendo intensidade. Eles se somam: só se a soma levar a membrana ao limiar o neurônio dispara.'},
    {title:'Limiar no cone de implantação',duration:3,still:.65,frame:box,text:'No início do axônio, a membrana atinge o limiar (cerca de −55 mV). Canais de Na+ dependentes de voltagem se abrem, o Na+ entra e o interior fica positivo: é a despolarização do potencial de ação, que segue a lei do tudo ou nada.'},
    {title:'Condução saltatória',duration:6,still:.42,frame:box,text:'A mielina isola o axônio, e o potencial de ação se regenera só nos nódulos de Ranvier, onde se concentram os canais: parece “saltar” de nódulo em nódulo, o que torna a condução mais rápida. Atrás do impulso, a saída de K+ repolariza a membrana, e o período refratário impede a volta do sinal.'},
    {title:'Terminação axonal: entrada de Ca2+',duration:4,still:.6,frame:synapse,tight:true,text:'O potencial de ação chega às terminações e abre canais de Ca2+ dependentes de voltagem. A entrada de Ca2+ faz as vesículas com neurotransmissor se aproximarem da membrana.'},
    {title:'Sinapse química',duration:5,still:.55,frame:synapse,tight:true,text:'As vesículas se fundem à membrana (exocitose) e liberam o neurotransmissor na fenda sináptica. Ele se liga a receptores da célula seguinte e abre canais iônicos, gerando um potencial pós-sináptico excitatório ou inibitório, conforme o receptor.'},
    {title:'Fim do sinal',duration:4,still:.6,frame:box,text:'O neurotransmissor é retirado da fenda, por degradação enzimática (a acetilcolinesterase, por exemplo) ou por recaptação, e a membrana volta ao repouso. Esquema ilustrativo: tamanhos fora de escala e tempo muito ampliado (um potencial de ação dura cerca de 1–2 ms).'}
  ];
  let start=0;for(const s of steps){s.start=start;start+=s.duration}
  // Where the impulse is along the axon (x): initial segment, the four nodes, the terminal.
  const hops=[HILLOCK,0,...NODES,.655];
  function impulseAt(f){const n=hops.length-1,k=Math.min(n-1,Math.floor(f*n)),local=f*n-k;return{index:k,local,x:lerp(hops[k],hops[k+1],smoothstep(.55,.85,local))}}
  // Fixed ion positions: Na+ just outside the membrane (above/below the fibre), K+ inside it.
  const ionX=[...Array(44)].map((_,i)=>i<14?lerp(-.18,.62,hash(i)):[0,...NODES][i%5]+(hash(i+3)-.5)*.03),ionSide=[...Array(44)].map((_,i)=>i%2?1:-1);
  const kX=[...Array(30)].map((_,i)=>i<10?lerp(-.18,.62,hash(i+40)):[0,...NODES][i%5]+(hash(i+43)-.5)*.02);
  const ionAxis=ionX.map(x=>axonAt(x)),kAxis=kX.map(x=>axonAt(x));
  const p=new THREE.Vector3(),q=new THREE.Vector3();let view={phase:0,label:''};
  function update(t,stepIndex){
    const s=steps[stepIndex],f=clamp01((t-s.start)/s.duration);
    const conduction=stepIndex===3?impulseAt(f):null,firing=conduction?hops[Math.min(hops.length-1,conduction.index+(conduction.local>.7?1:0))]:stepIndex===2?HILLOCK:null;
    const influx=stepIndex===2?smoothstep(.3,.8,f):conduction?Math.sin(clamp01(conduction.local/.7)*Math.PI):0;
    for(let i=0;i<44;i++){p.copy(ionAxis[i]);let off=.045+.02*hash(i+11);if(firing!==null&&Math.abs(ionX[i]-firing)<.035)off=lerp(off,.004,influx);sodium.set(i,p.x,p.y+ionSide[i]*off,p.z+.03,stepIndex<=4?1:.7)}sodium.commit();
    const behind=conduction&&conduction.index>0?hops[conduction.index]:stepIndex>=4?hops.at(-2):null,out=behind===null?0:stepIndex===3?smoothstep(.15,.9,conduction.local):1-smoothstep(0,.8,stepIndex===4?f:1);
    for(let i=0;i<30;i++){p.copy(kAxis[i]);let off=.003;if(behind!==null&&Math.abs(kX[i]-behind)<.035)off=lerp(.003,.05,out);potassium.set(i,p.x,p.y+(i%2?1:-1)*off,p.z+.03,1)}potassium.commit();
    // Graded potentials travelling from the dendrite tips to the soma.
    for(let i=0;i<8;i++){const ph=(f*2.2+i/8)%1;DENDRITES[i%4].getPointAt(ph,p);graded.set(i,p.x,p.y,p.z,stepIndex===1?1-ph*.6:0)}graded.commit();
    somaGlow.material.opacity=stepIndex===1?.25+.45*smoothstep(.2,1,f):stepIndex===2?.7*(1-f):0;
    const fire=stepIndex===2?smoothstep(.2,.7,f):0;hillockGlow.material.opacity=fire;hillockGlow.scale.setScalar(.06+.08*fire);
    // The impulse: bright at the firing node, faint while it crosses a myelinated segment.
    if(conduction){axonAt(firing,nodeGlow.position);nodeGlow.position.z+=.03;nodeGlow.material.opacity=.95*Math.max(influx,.25);nodeGlow.scale.setScalar(.09+.06*influx);axonAt(conduction.x,trailGlow.position);trailGlow.position.z+=.03;trailGlow.material.opacity=.5*Math.sin(smoothstep(.55,.85,conduction.local)*Math.PI)}
    else{nodeGlow.material.opacity=0;trailGlow.material.opacity=0}
    // Synapse: Ca2+ enters, vesicles dock and fuse, transmitter crosses the cleft and binds.
    const ca=stepIndex===4?f:stepIndex>4?1:0,fuse=stepIndex===5?smoothstep(0,.35,f):stepIndex>5?1:0,cross=stepIndex===5?smoothstep(.2,.75,f):0,clear=stepIndex===6?smoothstep(0,.7,f):0;
    terminalGlow.material.opacity=stepIndex===4?.8*smoothstep(0,.3,f)*(1-.4*f):stepIndex===5?.45*(1-f):0;
    const [tx,ty,tz]=TERMINAL,edge=tx+.047;
    for(let k=0;k<8;k++){const a=k/8*Math.PI*2;p.set(tx+Math.cos(a)*.075,ty+Math.sin(a)*.06,tz);q.set(tx+Math.cos(a)*.03,ty+Math.sin(a)*.024,tz);p.lerp(q,clamp01(ca*1.3-k*.04));calcium.set(k,p.x,p.y,p.z,stepIndex===4||stepIndex===5?1:0)}calcium.commit();
    for(let k=0;k<10;k++){const a=hash(k+3)*Math.PI*2,r=.006+.018*hash(k+5);p.set(tx-.01+.012*hash(k),ty+Math.sin(a)*r,tz+.004);q.set(edge-.008,ty+Math.sin(a)*r*.8,tz+.004);p.lerp(q,smoothstep(.2,1,ca));vesicles.set(k,p.x,p.y,p.z,(1-fuse)*(stepIndex>=6?0:1))}vesicles.commit();
    for(let k=0;k<30;k++){const y=ty+(hash(k+21)-.5)*.07,x=lerp(edge,POST[0]-.098,clamp01(cross*1.25-hash(k+2)*.25));transmitter.set(k,x,y,.07+(hash(k+29)-.5)*.02,stepIndex===5?smoothstep(.05,.25,f):stepIndex===6?1-clear:0)}transmitter.commit();
    const glow=stepIndex===5?cross:stepIndex===6?1-clear:0;receptorMaterial.emissive.setRGB(.25*glow,.32*glow,.5*glow);
    // Membrane potential shown in the bar: soma, hillock, then the node that is firing.
    view=stepIndex===1?{phase:0,graded:smoothstep(0,1,f),label:'Corpo celular: potenciais graduados'}:stepIndex===2?{phase:.3*f,label:'Cone de implantação: limiar'}:stepIndex===3?{phase:Math.min(1,conduction.local*1.1),label:conduction.index===0?'Segmento inicial do axônio':'Nódulo de Ranvier '+Math.min(4,conduction.index)}:{phase:0,label:stepIndex>=4?'Axônio de volta ao repouso':'Membrana em repouso'};
  }
  const chart={
    draw(ctx,w,h){
      const pad=6,top=12,bottom=h-12,y=v=>lerp(bottom,top,(v+90)/130),x=p=>pad+28+(w-pad-36)*p;
      ctx.clearRect(0,0,w,h);ctx.font='10px system-ui,sans-serif';ctx.fillStyle='#96a9b9';ctx.strokeStyle='#263447';ctx.lineWidth=1;
      for(const v of [30,-55,-70]){ctx.beginPath();ctx.setLineDash(v===-55?[3,3]:[]);ctx.moveTo(x(0),y(v));ctx.lineTo(x(1),y(v));ctx.stroke()}ctx.setLineDash([]);ctx.fillText('+30',pad,y(30)+3);ctx.fillText('−70',pad,y(-70)+4);ctx.textAlign='right';ctx.fillText('limiar −55',w-4,y(-55)-3);ctx.textAlign='left';
      ctx.strokeStyle='#8bdcc4';ctx.lineWidth=2;ctx.beginPath();for(let i=0;i<=80;i++){const p=i/80,v=actionPotential(p);i?ctx.lineTo(x(p),y(v)):ctx.moveTo(x(p),y(v))}ctx.stroke();
      const v=view.graded!==undefined?-70+12*view.graded:actionPotential(view.phase);ctx.fillStyle='#ffd36b';ctx.beginPath();ctx.arc(x(view.graded!==undefined?.06*view.graded:view.phase),y(v),4.5,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#d3dee7';ctx.textAlign='right';ctx.fillText(Math.round(v)+' mV · '+view.label,w-4,top-1);ctx.textAlign='left';
    },
    caption:'Potencial de membrana (valores típicos, mV); a linha tracejada marca o limiar.'
  };
  helper(root);
  return{steps,chart,update,dispose(){disposeObject(root)}};
}
