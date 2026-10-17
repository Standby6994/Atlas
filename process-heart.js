import * as THREE from 'three';
import {glowSprite,xrayMaterial,smoothstep,clamp01,helper,disposeObject,createWaveField} from './process-animations.js';

// Cardiac cycle over the detailed heart cutaway (heart-interior-model.js; frontal cut, +Z exposed face,
// anatomical right on the left of the screen). Blood is a set of particles that flow along measured routes
// through the open chambers and stop at closed valves; chambers and valves move through the shared wall
// field (process-animations.js). One beat is stretched to about 21 s; at rest a cycle lasts about 0.8 s.
const curveOf=points=>new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'centripetal');
const lerp=(a,b,f)=>a+(b-a)*f;
const hash=n=>{const s=Math.sin(n*127.1+311.7)*43758.5453;return s-Math.floor(s)};
// Blood routes (route position u): vein → atrium (AV valve at u .45) → ventricle (semilunar valve at u .8) → artery.
const RIGHT_FROM_SVC=[[-.37,.56,-.02],[-.35,.42,.0],[-.28,.27,.03],[-.25,.14,.04],[-.24,.03,.04],[-.23,-.09,.04],[-.2,-.22,.04],[-.13,-.18,.04],[-.08,.0,.03],[-.06,.16,.02],[-.05,.27,.012],[-.1,.36,-.01],[-.2,.43,-.03],[-.3,.47,-.04]];
const RIGHT_FROM_IVC=[[-.37,-.33,-.02],[-.36,-.12,0],[-.32,.06,.02],[-.27,.16,.04],[-.25,.11,.04],[-.24,.03,.04],[-.23,-.09,.04],[-.2,-.22,.04],[-.13,-.18,.04],[-.08,.0,.03],[-.06,.16,.02],[-.05,.27,.012],[-.1,.36,-.01],[-.2,.43,-.03],[-.3,.47,-.04]];
const LEFT_ROUTE=[[.33,.3,-.12],[.3,.24,-.02],[.26,.17,.04],[.24,.1,.04],[.23,.03,.04],[.22,-.1,.04],[.21,-.25,.04],[.17,-.2,.04],[.13,-.02,.03],[.11,.14,.0],[.095,.27,-.02],[.15,.4,-.06],[.27,.5,-.07],[.4,.5,-.08]];
// Valve centres; each route finds where it crosses them (its own gate positions along u).
const VALVES={right:[[-.24,.03,.04],[-.05,.27,.012]],left:[[.23,.03,.04],[.095,.27,-.02]]};
function gated(points,[av,semi]){const curve=curveOf(points),spaced=curve.getSpacedPoints(1000),at=p=>{const v=new THREE.Vector3(...p);let best=0,d=Infinity;spaced.forEach((s,i)=>{const e=s.distanceToSquared(v);if(e<d){d=e;best=i}});return best/1000};return{curve,av:at(av),semi:at(semi)}}
// Conduction: sinoatrial node → atria → atrioventricular node → His bundle → bundle branches and Purkinje fibres.
const SA=[-.322,.326,.16],AV=[-.107,.09,.16];
const HIS_LEFT=curveOf([AV,[-.05,0,.165],[-.01,-.2,.165],[.03,-.34,.165],[.16,-.36,.15],[.28,-.26,.12]]),HIS_RIGHT=curveOf([AV,[-.05,0,.165],[-.01,-.2,.165],[-.06,-.35,.165],[-.18,-.36,.15],[-.29,-.26,.12]]);
// Electrocardiogram of one beat (arbitrary units) and the time of each step inside it (0–1).
function ecg(x){const g=(c,w,h)=>h*Math.exp(-(((x-c)/w)**2));return g(.16,.025,.16)+g(.305,.008,-.12)+g(.32,.01,1)+g(.335,.009,-.25)+g(.58,.05,.3)}

export async function createCardiacCycle({app,mode}){
  const model=app.studyModel(mode);if(!model)throw new Error('Modelo do coração indisponível.');
  const root=new THREE.Group();root.name='process-cardiac-cycle';app.scene.add(root);
  const partOf=new Map();for(const p of model.parts)p.object.traverse(o=>{if(o.isMesh)partOf.set(o,p.partId||p.id)});
  const only=ids=>mesh=>ids.includes(partOf.get(mesh)),not=ids=>mesh=>!ids.includes(partOf.get(mesh));
  const fixed=['aorta','pulmonary_trunk','venae_cavae','tricuspid_valve','mitral_valve','pulmonary_valve','aortic_valve'];
  // Field offsets: atria 0–2, ventricles 10–12, AV valves 20–22, semilunar valves 30–32.
  const line=(a,b)=>curveOf([a,b]);
  const routes=[
    {curve:line([-.26,.32,-.04],[-.26,.08,-.04]),offset:0,reach:.24,accept:not(fixed)},{curve:line([.25,.32,-.04],[.25,.08,-.04]),offset:1,reach:.24,accept:not(fixed)},
    {curve:line([-.2,0,-.04],[-.2,-.33,-.04]),offset:10,reach:.3,accept:not(fixed)},{curve:line([.22,0,-.04],[.22,-.38,-.04]),offset:11,reach:.3,accept:not(fixed)},
    {curve:line([-.24,.06,0],[-.24,-.02,0]),offset:20,reach:.2,accept:only(['tricuspid_valve'])},{curve:line([.226,.06,0],[.226,-.02,0]),offset:21,reach:.2,accept:only(['mitral_valve'])},
    {curve:line([-.048,.30,.012],[-.048,.255,.012]),offset:30,reach:.1,accept:only(['pulmonary_valve'])},{curve:line([.095,.30,-.02],[.095,.255,-.02]),offset:31,reach:.1,accept:only(['aortic_valve'])}
  ];
  await new Promise(resolve=>setTimeout(resolve,30));
  const field=createWaveField(model.group,routes,'heart-cycle');field.ensure();
  // Blood: one draw for the particles in front, one faint copy for those behind walls (shared instance matrices).
  const circuits=[{curves:[gated(RIGHT_FROM_SVC,VALVES.right),gated(RIGHT_FROM_IVC,VALVES.right)],color:0x5b7fd6,count:90},{curves:[gated(LEFT_ROUTE,VALVES.left)],color:0xd8434f,count:90}];
  const sphere=new THREE.SphereGeometry(1,10,8);
  for(const c of circuits){
    c.mesh=new THREE.InstancedMesh(sphere,new THREE.MeshStandardMaterial({color:c.color,roughness:.45,emissive:c.color,emissiveIntensity:.25}),c.count);c.mesh.frustumCulled=false;c.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    c.see=new THREE.InstancedMesh(sphere,xrayMaterial(c.color,.3),c.count);c.see.instanceMatrix=c.mesh.instanceMatrix;c.see.frustumCulled=false;c.see.renderOrder=36;c.see.userData.sharedGeometry=true;
    root.add(c.mesh,c.see);c.particles=[...Array(c.count)].map((_,i)=>{const g=c.curves[i%c.curves.length];return{route:i%c.curves.length,u0:i<c.count*.4?hash(i)*g.av:i<c.count*.85?lerp(g.av,g.semi-.02,hash(i+3)):lerp(g.semi,1,hash(i+5)),r:hash(i+7),off:new THREE.Vector3(hash(i+11)-.5,hash(i+13)-.5,(hash(i+17)-.5)*.6).normalize()}});
  }
  const sa=glowSprite(0xffe08a,.09,0),atria=[glowSprite(0xffd27a,.42,0),glowSprite(0xffd27a,.42,0)],avGlow=glowSprite(0xffe08a,.08,0),branches=[glowSprite(0xffe08a,.07,0),glowSprite(0xffe08a,.07,0)],ventricles=[glowSprite(0xffc070,.5,0),glowSprite(0xffc070,.5,0)];
  sa.position.set(...SA);atria[0].position.set(-.26,.2,.12);atria[1].position.set(.25,.2,.12);avGlow.position.set(...AV);ventricles[0].position.set(-.2,-.17,.12);ventricles[1].position.set(.22,-.2,.12);
  root.add(sa,...atria,avGlow,...branches,...ventricles);helper(root);
  // Valve state per step (1 open, 0 closed) and how fast blood moves in each region (route units per second).
  const steps=[
    {title:'Diástole: enchimento ventricular',duration:4,still:.6,av:1,semi:0,flowA:.05,flowV:.07,ecg:[.02,.1],text:'Átrios e ventrículos estão relaxados. As valvas atrioventriculares (tricúspide e mitral) estão abertas e o sangue passa dos átrios aos ventrículos; as valvas pulmonar e aórtica estão fechadas. Azul: sangue pobre em O₂ vindo das veias cavas; vermelho: sangue rico em O₂ vindo das veias pulmonares (não mostradas no corte).'},
    {title:'Sístole atrial',duration:3,still:.5,av:1,semi:0,flowA:.12,flowV:.12,ecg:[.1,.24],text:'O nó sinoatrial, o marca-passo natural, dispara; o impulso se espalha pelos átrios (onda P do ECG) e eles se contraem, completando o enchimento dos ventrículos.'},
    {title:'Condução atrioventricular',duration:2.5,still:.6,av:1,semi:0,flowA:.04,flowV:.03,ecg:[.24,.3],text:'O nó atrioventricular retarda o impulso por uma fração de segundo, dando tempo para os átrios esvaziarem. Depois o sinal desce pelo feixe de His, seus ramos e as fibras de Purkinje.'},
    {title:'Contração isovolumétrica',duration:2.5,still:.55,av:0,semi:0,flowA:.04,flowV:0,ecg:[.3,.36],text:'Os ventrículos se despolarizam (complexo QRS) e começam a se contrair. A pressão sobe e fecha as valvas atrioventriculares — 1ª bulha, o “tum”. Com todas as valvas fechadas, o volume não muda por um instante.'},
    {title:'Ejeção ventricular',duration:4,still:.45,av:0,semi:1,flowA:.05,flowV:.16,ecg:[.36,.62],text:'A pressão ventricular supera a das artérias e abre as valvas semilunares: o ventrículo direito envia sangue ao tronco pulmonar (pulmões) e o esquerdo, à aorta (corpo). A parede do ventrículo esquerdo é mais espessa porque vence uma pressão maior. A onda T marca a repolarização.'},
    {title:'Relaxamento isovolumétrico',duration:2.5,still:.5,av:0,semi:0,flowA:.05,flowV:0,ecg:[.62,.72],text:'Os ventrículos relaxam e a pressão cai abaixo da arterial: as valvas aórtica e pulmonar se fecham — 2ª bulha, o “tá”. Os átrios continuam recebendo sangue das veias.'},
    {title:'Enchimento rápido',duration:3,still:.5,av:1,semi:0,flowA:.09,flowV:.11,ecg:[.72,1],text:'As valvas atrioventriculares se abrem e o sangue acumulado nos átrios entra rapidamente nos ventrículos; o ciclo recomeça. Em repouso (cerca de 75 batimentos por minuto) o ciclo todo dura cerca de 0,8 s, e a diástole é mais longa que a sístole. Esquema ilustrativo, sem escala.'}
  ];
  let start=0;for(const s of steps){s.start=start;start+=s.duration}
  // Valve opening eases across step boundaries (0.25 s), so leaflets swing instead of jumping.
  const valveState=(t,key)=>{for(let i=0;i<steps.length;i++){const s=steps[i],next=steps[i+1];if(t<s.start+s.duration||!next){const into=next&&t>s.start+s.duration-.25?smoothstep(s.start+s.duration-.25,s.start+s.duration,t):0;return lerp(s[key],next?next[key]:s[key],into)}}return 0};
  const stepAt=t=>{for(let i=steps.length-1;i>=0;i--)if(t>=steps[i].start)return i;return 0};
  // Deterministic flow: simulated from the start at fixed steps, so scrubbing backwards gives the same image.
  const DT=1/60;let simTime=-1;
  function reset(){for(const c of circuits)for(const p of c.particles)p.u=p.u0;simTime=0}
  function simulate(to){
    if(to<simTime)reset();
    while(simTime<to){const s=steps[stepAt(simTime)],av=valveState(simTime,'av'),semi=valveState(simTime,'semi'),dt=Math.min(DT,to-simTime);
      for(const c of circuits)for(const p of c.particles){
        const {av:AV_GATE,semi:SEMILUNAR_GATE}=c.curves[p.route];let speed=p.u<AV_GATE?s.flowA:p.u<SEMILUNAR_GATE?s.flowV:.12;speed*=.75+.5*p.r;let u=p.u+speed*dt;
        // Closed valves hold blood back; each particle waits a little before the gate, so the chamber fills.
        // About 60 % of the ventricular blood leaves in each beat (ejection fraction); the rest stays (r ≥ 0.6).
        const limit=p.u<AV_GATE&&av<.5?AV_GATE-.015-.45*AV_GATE*p.r:p.u>=AV_GATE&&p.u<SEMILUNAR_GATE&&(semi<.5||p.r>=.6)?SEMILUNAR_GATE-.03-.6*(SEMILUNAR_GATE-AV_GATE)*p.r:Infinity;
        if(limit!==Infinity)u=p.u>=limit?p.u:Math.min(u,limit);
        p.u=u>=1?u-1:u;
      }
      simTime+=dt}
  }
  reset();
  const m=new THREE.Matrix4(),q=new THREE.Quaternion(),scale=new THREE.Vector3(),pos=new THREE.Vector3(),turn=new THREE.Euler();
  // Particles spread across the chambers (wide) and gather in veins, valves and arteries (narrow).
  const width=(u,g)=>u<g.av*.35?.018:u<g.av-.03?.075:u<g.av+.04?.03:u<g.semi-.1?.08:u<g.semi+.03?.022:.03;
  let view={x:0,label:''};
  function update(t,stepIndex){
    field.ensure();field.clear();simulate(t);
    const s=steps[stepIndex],f=clamp01((t-s.start)/s.duration);
    // Chambers: atria squeeze in atrial systole; ventricles from isovolumetric contraction through ejection.
    const atrial=stepIndex===1?Math.sin(smoothstep(.1,.9,f)*Math.PI):0,ventricular=stepIndex===3?smoothstep(0,1,f)*.45:stepIndex===4?.45+.55*Math.sin(smoothstep(0,.8,f)*Math.PI*.5):stepIndex===5?1-smoothstep(0,1,f):0;
    field.set(0,1,3,-.12*atrial);field.set(1,11,3,-.13*ventricular);
    // Valves: AV leaflets drawn towards their axis when closed; semilunar cusps spread apart when open.
    field.set(2,21,3,-.38*(1-valveState(t,'av')));field.set(3,31,3,.25*valveState(t,'semi')-.12*(1-valveState(t,'semi')));
    for(const c of circuits){c.particles.forEach((p,i)=>{const g=c.curves[p.route];g.curve.getPointAt(clamp01(p.u),pos);const w=width(p.u,g)*(p.u>=g.av&&p.u<g.semi?1-.35*ventricular:p.u<g.av?1-.3*atrial:1);pos.addScaledVector(p.off,w);const size=.0085+.003*p.r;scale.set(size,size,size*.42);turn.set(p.r*6.3+t*.7,p.off.x*3+t*.5,0);q.setFromEuler(turn);m.compose(pos,q,scale);c.mesh.setMatrixAt(i,m)});c.mesh.instanceMatrix.needsUpdate=true}
    // Electrical activity.
    sa.material.opacity=stepIndex===1?1-smoothstep(.3,.9,f):stepIndex===0?.25+.25*smoothstep(.6,1,f):.15;sa.scale.setScalar(.07+.05*(stepIndex===1?1-f:0));
    for(const a of atria){a.material.opacity=stepIndex===1?.45*Math.sin(smoothstep(0,.7,f)*Math.PI):0;a.scale.setScalar(.2+.3*(stepIndex===1?smoothstep(0,.7,f):0))}
    avGlow.material.opacity=stepIndex===2?.9*Math.min(1,f*3):stepIndex===1?.6*smoothstep(.6,1,f):0;
    const down=stepIndex===2?smoothstep(.35,1,f):stepIndex===3?1:0;for(const [i,b] of branches.entries()){(i?HIS_RIGHT:HIS_LEFT).getPointAt(clamp01(down),b.position);b.material.opacity=stepIndex===2&&f>.35||stepIndex===3&&f<.5?.95:0}
    for(const v of ventricles)v.material.opacity=stepIndex===3?.4*Math.sin(f*Math.PI):0;
    view={x:lerp(s.ecg[0],s.ecg[1],f),label:s.title};
  }
  const chart={
    draw(ctx,w,h){
      const top=14,bottom=h-8,y=v=>lerp(bottom-6,top+4,(v+.3)/1.3),x=p=>8+(w-16)*p;
      ctx.clearRect(0,0,w,h);ctx.font='10px system-ui,sans-serif';
      // Systole band: from the QRS to the end of the T wave.
      ctx.fillStyle='rgba(255,211,107,.08)';ctx.fillRect(x(.3),top,x(.62)-x(.3),bottom-top);ctx.fillStyle='#96a9b9';ctx.fillText('sístole ventricular',x(.31),bottom-1);
      ctx.fillText('P',x(.15),y(.16)-5);ctx.fillText('QRS',x(.305),top+8);ctx.fillText('T',x(.575),y(.3)-5);
      ctx.strokeStyle='#8bdcc4';ctx.lineWidth=2;ctx.beginPath();for(let i=0;i<=240;i++){const p=i/240;i?ctx.lineTo(x(p),y(ecg(p))):ctx.moveTo(x(p),y(ecg(p)))}ctx.stroke();
      ctx.strokeStyle='#ffd36b';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x(view.x),top);ctx.lineTo(x(view.x),bottom);ctx.stroke();ctx.fillStyle='#ffd36b';ctx.beginPath();ctx.arc(x(view.x),y(ecg(view.x)),4,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#d3dee7';ctx.textAlign='right';ctx.fillText('ECG esquemático · '+view.label,w-4,top-3);ctx.textAlign='left';
    },
    caption:'Eletrocardiograma de um batimento, em forma simplificada; a faixa clara marca a sístole ventricular.'
  };
  return{steps,chart,update,dispose(){field.clear();disposeObject(root)}};
}
