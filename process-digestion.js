import * as THREE from 'three';
import {glowSprite,xrayMaterial,smoothstep,clamp01,helper,disposeObject,createWaveField} from './process-animations.js';

// Digestion animations. Routes are centre lines measured once from the models' own meshes (slices of the
// tube walls, in scene coordinates); the small intestine of the body model is a single coiled piece, so its
// route there is a schematic serpentine fitted to the depth of the loops. Nothing here edits catalogued parts:
// the cuts only gain a per-vertex attribute that lets their wall contract (see createWaveField).

// --- Body model (Z-Anatomy), metres. ---
const BODY_MOUTH=[[0,1.522,.07],[0,1.533,.05]];
const BODY_ESOPHAGUS=[[-.0001,1.5448,.0267],[.0017,1.5285,.0214],[-.0003,1.5108,.0162],[.0002,1.4921,.017],[-.0001,1.4746,.0105],[.0007,1.4596,.0009],[.0008,1.4429,-.0037],[.0009,1.426,-.0076],[.0007,1.4083,-.0126],[.0006,1.3912,-.0171],[.0007,1.3735,-.0218],[.002,1.3526,-.027],[.0004,1.3344,-.0293],[.0014,1.3184,-.0291],[.0016,1.3005,-.0264],[.0013,1.2839,-.0225],[.0013,1.267,-.0167],[.0009,1.2531,-.0113],[.0005,1.2407,-.0059],[.0018,1.2239,.002],[.0066,1.209,.0094],[.0078,1.1966,.0151]];
const BODY_STOMACH=[[.0265,1.2088,.0153],[.0426,1.2067,.0161],[.061,1.2103,.007],[.0696,1.1979,.0037],[.0746,1.1834,-.0013],[.0732,1.1668,.0019],[.0794,1.1598,.0187],[.0778,1.1535,.0336],[.094,1.1603,.048],[.0826,1.159,.0625],[.0795,1.1411,.0593],[.0713,1.1263,.0559],[.0539,1.1249,.0585],[.0377,1.1237,.0631],[.0202,1.1248,.0654],[.007,1.1361,.0715],[-.01,1.1301,.0644],[-.0195,1.1333,.0533],[-.0234,1.138,.0558]];
const BODY_DUODENUM=[[-.0284,1.133,.0396],[-.0356,1.1335,.029],[-.0435,1.1282,.0232],[-.0481,1.1207,.0198],[-.0516,1.112,.0175],[-.0531,1.1025,.0189],[-.0562,1.0906,.0179],[-.0551,1.0777,.0178],[-.046,1.0751,.0237],[-.0476,1.0624,.0224],[-.0413,1.0567,.0281],[-.0316,1.0583,.0328],[-.0237,1.0557,.04],[-.0128,1.0573,.0408],[-.005,1.0608,.0395],[.0007,1.0684,.0422],[.006,1.0782,.0419],[.0153,1.0873,.0414],[.0234,1.0928,.0389],[.0231,1.0993,.0384]];
const BODY_SMALL_INTESTINE=[[.0215,1.085,.04],[.07,1.075,.0407],[.085,1.05,.0421],[.03,1.055,.057],[-.03,1.06,.0575],[-.07,1.04,.0496],[-.04,1.02,.0615],[.02,1.025,.0696],[.08,1.01,.0463],[.085,.98,.0434],[.03,.99,.0631],[-.02,.995,.0618],[-.06,.985,.0449],[-.04,.96,.0543],[0,.945,.0551],[.04,.93,.0532],[0,.905,.0376],[-.04,.92,.0362],[-.065,.945,.039],[-.078,.96,.0308]];
const BODY_COLON=[[-.0866,.9356,.0155],[-.0852,.9546,.0162],[-.0875,.9735,.0154],[-.0857,.9909,.0147],[-.0867,1.0082,.0138],[-.0845,1.0258,.0117],[-.0829,1.0439,.0116],[-.0836,1.0625,.0134],[-.0824,1.0793,.0191],[-.0716,1.0893,.0295],[-.059,1.0953,.0397],[-.0437,1.0913,.0489],[-.0278,1.0909,.0559],[-.011,1.0888,.062],[.007,1.087,.0629],[.0249,1.0888,.0581],[.0411,1.093,.0516],[.0569,1.0965,.0445],[.0745,1.1024,.0303],[.0837,1.0977,.0167],[.0916,1.0891,.003],[.0866,1.0615,.0121],[.0889,1.0443,.0057],[.0911,1.0258,.0057],[.0917,1.0087,.0061],[.0923,.9911,.0095],[.0891,.9728,.0108],[.0804,.9563,.0114],[.0701,.9423,.0098],[.0594,.929,.0067],[.0453,.9186,.0013],[.0315,.9132,-.0094],[.0182,.9037,-.0188],[.0066,.8982,-.0314],[.0055,.8923,-.0503],[.0069,.877,-.0556],[-.0009,.8588,-.0545],[-.005,.845,-.047],[.0004,.8296,-.0455],[-.0026,.8133,-.0469],[-.0007,.8059,-.0489]];
// Where the bile and pancreatic ducts reach the duodenum, and the glands they come from.
const BODY_PAPILLA=[-.0484,1.0927,.0331],BODY_GALLBLADDER=[-.045,1.137,.056],BODY_PANCREAS=[.014,1.116,.022];

// --- Detailed cuts (each normalised to 1.2 units). ---
const CUT_ESOPHAGUS=[[.002,.64,.015],[.024,.4,.015],[.026,.2,.015],[.0045,0,.015],[-.009,-.2,.015],[-.017,-.4,.015],[-.027,-.64,.015]];
const CUT_STOMACH=[[0,.6,.07],[.01,.53,.06],[.07,.38,.035],[.14,.18,.025],[.16,-.05,.025],[.1,-.27,.03],[-.05,-.37,.04],[-.22,-.33,.055],[-.38,-.27,.08],[-.51,-.2,.11],[-.6,-.17,.12]];
const CUT_SMALL_INTESTINE=[[-.441,.3658,.0843],[-.4682,.3635,.0694],[-.5016,.3541,.0802],[-.5339,.3372,.0858],[-.5569,.3086,.087],[-.5692,.2755,.0848],[-.5689,.2384,.0815],[-.5579,.2051,.0787],[-.5358,.1763,.0769],[-.5059,.1578,.0775],[-.4692,.1517,.0787],[-.4338,.1519,.0783],[-.3994,.1615,.0749],[-.3652,.1697,.0715],[-.3444,.1976,.0592],[-.3162,.2178,.0472],[-.2857,.2405,.0379],[-.2568,.2576,.0349],[-.2243,.2785,.0346],[-.1904,.2919,.0426],[-.1544,.2974,.0476],[-.1216,.2878,.0498],[-.0922,.2676,.056],[-.0719,.2408,.0549],[-.0694,.2052,.0598],[-.0891,.1747,.0595],[-.115,.1533,.0628],[-.1468,.1339,.0681],[-.1776,.1286,.0731],[-.2134,.1271,.0786],[-.2506,.1262,.0842],[-.2858,.1239,.089],[-.3184,.1144,.0927],[-.3531,.1041,.0929],[-.3868,.0937,.0893],[-.3956,.0587,.0901],[-.4038,.0263,.0809],[-.3866,-.0026,.0704],[-.358,-.0231,.0646],[-.3303,-.0367,.0613],[-.2986,-.043,.0598],[-.2604,-.0462,.0581],[-.2237,-.0406,.0581],[-.1866,-.0336,.0581],[-.1526,-.0298,.0579],[-.1203,-.0382,.0542],[-.0889,-.055,.053],[-.0697,-.085,.0457],[-.067,-.1203,.0401],[-.0859,-.1474,.0361],[-.1242,-.1672,.0366],[-.1298,-.203,.0412],[-.0929,-.2271,.0413],[-.0816,-.2614,.0483],[-.0963,-.2915,.058],[-.1238,-.3154,.0668],[-.1577,-.3367,.0746],[-.1878,-.3508,.0801],[-.2188,-.3596,.0841],[-.2545,-.3656,.0864],[-.2927,-.3684,.087],[-.331,-.3683,.0862],[-.3667,-.3647,.0843],[-.3977,-.3579,.082],[-.4287,-.3458,.0798],[-.459,-.3298,.0781],[-.485,-.3114,.0772],[-.501,-.2809,.0778],[-.4952,-.2486,.0787],[-.4714,-.2223,.0801],[-.4448,-.2064,.0793],[-.4165,-.1925,.0774],[-.3865,-.1906,.0737],[-.3497,-.1908,.0676],[-.3158,-.194,.062],[-.2772,-.1987,.0553],[-.24,-.2005,.0487],[-.2059,-.1957,.043],[-.1701,-.1861,.0386]];
const CUT_JEJUNAL_WINDOW=[[.34,.42,0],[.34,-.42,0]];
const CUT_LARGE_INTESTINE=[[-.5417,-.2062,-.0208],[-.541,-.1694,-.0104],[-.5432,-.129,-.0085],[-.5458,-.092,-.0118],[-.5445,-.053,-.0094],[-.5491,-.0142,-.0154],[-.5521,.0241,-.0199],[-.55,.0637,-.0257],[-.5494,.1014,-.0282],[-.5499,.1415,-.0277],[-.5476,.1816,-.0318],[-.5441,.2212,-.0293],[-.5384,.262,-.0331],[-.5362,.2996,-.0204],[-.5216,.3392,-.0214],[-.4961,.3695,-.0127],[-.4664,.3925,-.0059],[-.4255,.3917,.0007],[-.3897,.3782,.0034],[-.3528,.364,.0001],[-.3215,.3389,-.0053],[-.2823,.3294,-.0112],[-.2432,.3252,-.0165],[-.204,.3373,-.0165],[-.163,.3414,-.0159],[-.1238,.3321,-.0162],[-.0973,.3025,-.0138],[-.0825,.2701,-.0132],[-.0772,.2296,-.0108],[-.0735,.1908,-.0188],[-.077,.1517,-.0154],[-.0778,.1108,-.0195],[-.0794,.072,-.0203],[-.0858,.031,-.0213],[-.09,-.0101,-.0192],[-.0946,-.0499,-.0154],[-.1063,-.089,-.0086],[-.1273,-.1223,.001],[-.1541,-.1516,.009],[-.1908,-.1681,.0143],[-.2312,-.1648,.0228],[-.2696,-.1828,.0296],[-.2833,-.2234,.035],[-.2797,-.2664,.0391],[-.2639,-.3068,.0365],[-.2572,-.3462,.0344],[-.2626,-.3857,.031],[-.2707,-.4255,.0261],[-.272,-.445,.028]];

const FOOD=new THREE.Color(0xd9b77e),CHYME=new THREE.Color(0xd6c27a),FECES=new THREE.Color(0x8a5a33);
const curveOf=points=>new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'centripetal');
const lerp=(a,b,f)=>a+(b-a)*f;
const easeInOut=x=>x<.5?2*x*x:1-(-2*x+2)**2/2;
// Deterministic pseudo-random numbers, so a paused frame and a replay look the same.
const hash=n=>{const s=Math.sin(n*127.1+311.7)*43758.5453;return s-Math.floor(s)};

// A soft, slightly irregular food bolus: a lit body, a faint copy seen through walls and a glow.
function createBolus(radius,through=.42,shine=.55){
  const geometry=new THREE.IcosahedronGeometry(1,3),p=geometry.attributes.position,v=new THREE.Vector3();
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);const n=1+.09*Math.sin(v.x*5.1+v.y*3.3)*Math.cos(v.z*4.2-v.x*2.1)+.04*Math.sin(v.y*11+v.z*7);v.multiplyScalar(n);p.setXYZ(i,v.x,v.y,v.z)}
  geometry.computeVertexNormals();
  const solidMaterial=new THREE.MeshStandardMaterial({color:FOOD.clone(),roughness:.72,metalness:0}),seeMaterial=xrayMaterial(FOOD.clone(),through);
  const group=new THREE.Group(),solid=new THREE.Mesh(geometry,solidMaterial),see=new THREE.Mesh(geometry,seeMaterial);see.renderOrder=35;see.userData.sharedGeometry=true;
  const glow=glowSprite(0xffd28a,radius*5.5,shine);group.add(solid,see);group.add(glow);group.userData.glow=glow;group.scale.setScalar(radius);glow.scale.setScalar(5.5);
  helper(group);
  return{group,setColor(c){solidMaterial.color.copy(c);seeMaterial.color.copy(c)},setOpacity(o){seeMaterial.opacity=through*o;glow.material.opacity=shine*o;solid.visible=o>.05;see.visible=o>.02;glow.visible=o>.02},
    place(curve,u,size,stretch=1.35){const pos=curve.getPointAt(clamp01(u)),tan=curve.getTangentAt(clamp01(u));group.position.copy(pos);group.quaternion.setFromUnitVectors(Z,tan);group.scale.set(size,size,size*stretch)}};
}
const Z=new THREE.Vector3(0,0,1);
// Ring of contracting circular muscle drawn around the route (body model: the walls themselves cannot move).
function createRing(radius,color=0xff8f9c){
  const ring=new THREE.Mesh(new THREE.TorusGeometry(1,.26,10,40),xrayMaterial(color,.5));ring.renderOrder=36;ring.scale.setScalar(radius);helper(ring);return ring;
}
function placeRing(ring,curve,u,radius,squeeze){const pos=curve.getPointAt(clamp01(u)),tan=curve.getTangentAt(clamp01(u));ring.position.copy(pos);ring.quaternion.setFromUnitVectors(Z,tan);const r=radius*(1-.45*squeeze);ring.scale.set(r,r,radius*(1+.6*squeeze))}
// Small particles (secretions, absorbed nutrients, water) as one instanced draw that ignores depth.
function createParticles(count,radius,color,opacity=.85){
  const mesh=new THREE.InstancedMesh(new THREE.SphereGeometry(1,8,6),xrayMaterial(color,opacity),count);mesh.renderOrder=37;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);helper(mesh);
  const m=new THREE.Matrix4(),q=new THREE.Quaternion(),s=new THREE.Vector3();
  return{mesh,radius,set(i,pos,scale){s.setScalar(Math.max(0,scale)*radius);m.compose(pos,q,s);mesh.setMatrixAt(i,m)},commit(){mesh.instanceMatrix.needsUpdate=true}};
}
const hideAll=(particles,count)=>{const p=new THREE.Vector3();for(let i=0;i<count;i++)particles.set(i,p,0);particles.commit()};

// Translucent tint over the organs of the current step, seen through ribs and liver (one draw per organ mesh).
function createOrganTints(registry,root){
  const tints=new Map();
  function get(name){
    if(tints.has(name))return tints.get(name);const object=registry.get(name)?.object;if(!object){tints.set(name,null);return null}
    const material=new THREE.MeshBasicMaterial({color:0xffc27a,transparent:true,opacity:0,depthTest:false,depthWrite:false,toneMapped:false}),meshes=[];
    object.updateMatrixWorld(true);object.traverse(o=>{if(!o.isMesh)return;const m=new THREE.Mesh(o.geometry,material);m.matrixAutoUpdate=false;m.matrix.copy(o.matrixWorld);m.renderOrder=30;m.userData.sharedGeometry=true;helper(m);root.add(m);meshes.push(m)});
    const tint={material,meshes,level:0};tints.set(name,tint);return tint;
  }
  return{update(weights){for(const [name,w] of Object.entries(weights)){const t=get(name);if(t)t.level=w}for(const t of tints.values()){if(!t)continue;const on=t.level>.01;t.material.opacity=.26*t.level;for(const m of t.meshes)m.visible=on}}};
}

/** Full-body route: mouth → pharynx → esophagus → stomach → duodenum → small-intestine loops → colon. */
export async function createBodyDigestion({app}){
  const segments=[BODY_MOUTH,BODY_ESOPHAGUS,BODY_STOMACH,BODY_DUODENUM,BODY_SMALL_INTESTINE,BODY_COLON],points=segments.flat(),curve=curveOf(points);
  // Arc-length position of each segment's first point.
  const spaced=curve.getSpacedPoints(2400),nearestU=p=>{const v=new THREE.Vector3(...p);let best=0,d=Infinity;spaced.forEach((s,i)=>{const e=s.distanceToSquared(v);if(e<d){d=e;best=i}});return best/2400};
  const U={pharynx:nearestU(BODY_ESOPHAGUS[0]),laryngopharynx:nearestU(BODY_ESOPHAGUS[5]),cardia:nearestU(BODY_STOMACH[0]),pylorus:nearestU(BODY_DUODENUM[0]),papilla:nearestU([-.0531,1.1025,.0189]),flexure:nearestU(BODY_SMALL_INTESTINE[0]),ileocecal:nearestU(BODY_COLON[0]),transverse:nearestU(BODY_COLON[9]),descending:nearestU(BODY_COLON[21]),sigmoid:nearestU(BODY_COLON[30]),end:1};
  const root=helper(new THREE.Group());root.name='process-digestion-body';app.scene.add(root);
  // Whole route faintly, the travelled part brighter (same tube, drawn up to the bolus).
  const tubular=900,radial=6,trailGeometry=new THREE.TubeGeometry(curve,tubular,.0011,radial,false);
  const route=new THREE.Mesh(trailGeometry,xrayMaterial(0x8bdcc4,.14)),done=new THREE.Mesh(trailGeometry,xrayMaterial(0xffd59a,.42));route.renderOrder=done.renderOrder=33;done.userData.sharedGeometry=true;root.add(route,done);
  const bolus=createBolus(.009);root.add(bolus.group);
  const rings=[createRing(.011),createRing(.011)];root.add(...rings);
  const bile=createParticles(14,.0022,0x9fd35f),juice=createParticles(14,.0022,0xd9f2ff),absorbed=createParticles(26,.0018,0xffe08a),water=createParticles(22,.0018,0x7cc8ff);root.add(bile.mesh,juice.mesh,absorbed.mesh,water.mesh);
  const bileRoute=curveOf([BODY_GALLBLADDER,[-.04,1.12,.045],[-.045,1.104,.036],BODY_PAPILLA]),juiceRoute=curveOf([BODY_PANCREAS,[-.01,1.105,.028],[-.035,1.097,.031],BODY_PAPILLA]);
  const tints=createOrganTints(app.registry,root),colon=['Ascending colon','Transverse colon','Descending colon','Sigmoid colon','Vermiform appendix'];
  const steps=[
    {title:'Boca e deglutição',duration:5,still:.85,organs:['Tongue','Oropharynx','Laryngopharynx','Soft palate','Epiglottis'],text:'Mastigação e saliva formam o bolo alimentar; a amilase salivar começa a digerir o amido. Ao engolir, a língua empurra o bolo para a faringe, e o palato mole e a epiglote fecham as passagens para o nariz e a laringe.'},
    {title:'Esôfago: peristaltismo',duration:5,still:.5,organs:['Oesophagus'],link:'esophagus',text:'Uma onda de contração da musculatura circular, logo atrás do bolo, empurra-o até o estômago em poucos segundos. O esfíncter esofágico inferior se abre para a passagem e volta a se fechar, dificultando o refluxo.'},
    {title:'Estômago: mistura e quimo',duration:8,still:.55,organs:['Stomach'],link:'stomach',text:'O estômago armazena o alimento e o mistura com o suco gástrico: o HCl acidifica o meio e ativa a pepsina, que inicia a digestão das proteínas. Ondas de mistura formam o quimo, liberado aos poucos pelo piloro, em geral ao longo de algumas horas.'},
    {title:'Duodeno: bile e suco pancreático',duration:6,still:.55,organs:['Duodenum','Gallbladder','Pancreas'],text:'No duodeno chegam a bile (produzida pelo fígado e armazenada na vesícula), que emulsifica as gorduras, e o suco pancreático, com enzimas (amilase, lipase, proteases) e bicarbonato, que neutraliza a acidez do quimo.'},
    {title:'Jejuno e íleo: digestão final e absorção',duration:8,still:.5,organs:['Jejunum'],link:'small-intestine',text:'Nas alças do intestino delgado termina a digestão química, e os nutrientes atravessam as vilosidades para o sangue e a linfa. A segmentação mistura o conteúdo e o peristaltismo o faz avançar. Neste modelo, jejuno e íleo são uma peça só, e o trajeto pelas alças é esquemático.'},
    {title:'Intestino grosso: água e fezes',duration:9,still:.45,organs:colon,link:'large-intestine',text:'O conteúdo passa do íleo ao ceco e percorre os colos ascendente, transverso, descendente e sigmoide. Água e eletrólitos são absorvidos, bactérias da microbiota fermentam resíduos, e as fezes se formam. Movimentos de massa, algumas vezes ao dia, empurram o conteúdo adiante.'},
    {title:'Reto e eliminação',duration:4,still:.6,organs:['Sigmoid colon'],text:'A chegada das fezes ao reto distende sua parede e desencadeia o reflexo da defecação; o esfíncter externo do ânus é controlado voluntariamente. O reto não aparece como peça separada neste modelo do corpo. Tempo comprimido: o trajeto real leva de horas a alguns dias.'}
  ];
  let start=0;for(const s of steps){s.start=start;start+=s.duration}
  // The camera follows the route: each step frames its organs (at least 14 cm across, so small organs keep some context).
  const boxOf=names=>{const box=new THREE.Box3();for(const name of names){const object=app.registry.get(name)?.object;if(object)box.expandByObject(object)}if(box.isEmpty())return null;const c=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()).max(new THREE.Vector3(.14,.14,.08));return new THREE.Box3().setFromCenterAndSize(c,size)};
  const frames=[['Tongue','Oropharynx','Laryngopharynx'],['Oesophagus'],['Stomach'],['Stomach','Duodenum','Pancreas','Gallbladder'],['Jejunum'],colon,['Sigmoid colon','Descending colon']];
  steps.forEach((s,i)=>{s.frame=boxOf(frames[i])});
  const tmp=new THREE.Vector3(),color=new THREE.Color();
  function update(t,stepIndex){
    const s=steps[stepIndex],f=clamp01((t-s.start)/s.duration);
    let u=0,size=.009,stretch=1.35,opacity=1,ringOn=0,ringRadius=.011,mix=0,dark=0;
    if(stepIndex===0){const form=smoothstep(0,.3,f);size=.009*(.4+.6*form);u=lerp(0,U.laryngopharynx,easeInOut(smoothstep(.3,1,f)));opacity=form}
    else if(stepIndex===1){u=lerp(U.laryngopharynx,U.cardia,easeInOut(f));ringOn=1;ringRadius=.0095;size=.0085}
    else if(stepIndex===2){// In, then back-and-forth mixing (retropulsion), then out through the pylorus.
      const a=U.cardia,b=U.pylorus,go=easeInOut(smoothstep(0,.3,f)),churn=smoothstep(.3,.42,f)*(1-smoothstep(.82,.95,f));u=lerp(a,lerp(a,b,.72),go)+churn*(b-a)*.12*Math.sin((f-.3)*Math.PI*7)+(b-lerp(a,b,.72))*smoothstep(.85,1,f);size=lerp(.0085,.012,go);mix=smoothstep(.3,.9,f);ringOn=churn;ringRadius=.026;stretch=1.15}
    else if(stepIndex===3){u=lerp(U.pylorus,U.flexure,easeInOut(f));size=.0095;mix=1;ringOn=1;ringRadius=.0125}
    else if(stepIndex===4){u=lerp(U.flexure,U.ileocecal,f);size=.009;mix=1;ringOn=1;ringRadius=.0115}
    else if(stepIndex===5){// Slow haustral progress, then a faster mass movement from the transverse colon on.
      const g=f<.45?.5*easeInOut(f/.45)*.55:.275+.725*easeInOut((f-.45)/.55);u=lerp(U.ileocecal,lerp(U.sigmoid,1,.6),g);size=lerp(.011,.0105,f);mix=1;dark=smoothstep(.05,.8,f);ringOn=1;ringRadius=.019}
    else{u=lerp(lerp(U.sigmoid,1,.6),1,easeInOut(smoothstep(0,.6,f)));size=.0105;mix=1;dark=1;opacity=1-smoothstep(.7,1,f);ringOn=1-smoothstep(.6,.9,f);ringRadius=.019}
    color.copy(FOOD).lerp(CHYME,mix).lerp(FECES,dark);bolus.setColor(color);bolus.setOpacity(opacity);bolus.place(curve,u,size,stretch);
    done.geometry.setDrawRange(0,Math.round(clamp01(u)*tubular)*radial*6);
    // Contraction rings travel just behind the bolus; in the stomach two mixing waves run towards the pylorus.
    const behind=(size*2.6)/curve.getLength();
    if(stepIndex===2){for(const [i,ring] of rings.entries()){const phase=((f*3.2+i*.5)%1),wu=lerp(lerp(U.cardia,U.pylorus,.35),U.pylorus,phase);ring.visible=ringOn>.02;placeRing(ring,curve,wu,ringRadius*(1-.55*phase),Math.sin(phase*Math.PI));ring.material.opacity=.42*ringOn*Math.sin(phase*Math.PI)}}
    else for(const [i,ring] of rings.entries()){const pulse=.5+.5*Math.sin(t*9-i*1.4);ring.visible=ringOn>.02;placeRing(ring,curve,Math.max(0,u-behind*(1+i*.9)),ringRadius,pulse*(1-i*.35));ring.material.opacity=.45*ringOn*(1-i*.45)}
    // Bile and pancreatic juice flow towards the duodenal papilla while the chyme passes it.
    const flow=stepIndex===3?smoothstep(.12,.3,f)*(1-smoothstep(.75,.95,f)):0;
    for(let i=0;i<14;i++){const ph=(f*2.2+i/14)%1;bile.set(i,bileRoute.getPointAt(ph),flow*(.7+.3*Math.sin(i)));juice.set(i,juiceRoute.getPointAt((ph+.07)%1),flow*(.7+.3*Math.cos(i)))}bile.commit();juice.commit();
    // Absorbed nutrients leave the loops; water leaves the colon.
    const emit=(particles,count,on,spread,seed)=>{for(let i=0;i<count;i++){const ph=(f*1.6+hash(i+seed))%1,back=Math.max(0,u-ph*.035);curve.getPointAt(back,tmp);const dir=new THREE.Vector3(hash(i*3+seed)-.5,hash(i*5+seed)-.5,hash(i*7+seed)-.3).normalize();tmp.addScaledVector(dir,spread*ph);particles.set(i,tmp,on*Math.sin(ph*Math.PI))}particles.commit()};
    emit(absorbed,26,stepIndex===4?smoothstep(.05,.2,f)*(1-smoothstep(.85,1,f)):0,.03,11);
    emit(water,22,stepIndex===5?smoothstep(.05,.2,f)*(1-smoothstep(.85,1,f)):0,.028,29);
    // Organ tints follow the step, fading across the boundary.
    const weights={};for(const [i,st] of steps.entries()){const w=i===stepIndex?Math.min(smoothstep(0,.12,f)+(i===0?1:0),1):i===stepIndex-1?1-smoothstep(0,.12,f):0;for(const name of st.organs)weights[name]=Math.max(weights[name]||0,w)}tints.update(weights);
  }
  helper(root);
  return{steps,update,dispose(){disposeObject(root)}};
}

// Shared frame of the four cut animations: a bolus on a route through the cut and wall waves around it.
async function createCutProcess({app,mode,id,routes,bolusRadius,steps,update,setup}){
  const model=app.studyModel(mode);if(!model)throw new Error('Modelo do corte indisponível.');
  const root=helper(new THREE.Group());root.name='process-'+id;app.scene.add(root);
  const curves=routes.map(r=>({...r,curve:curveOf(r.points)}));
  // Building the attributes takes a few tens of milliseconds; let the bar paint first.
  await new Promise(resolve=>setTimeout(resolve,30));
  const field=await createWaveField(model.group,curves,id);field.ensure();
  const bolus=createBolus(bolusRadius,.45,.28);root.add(bolus.group);
  let start=0;for(const s of steps){s.start=start;start+=s.duration}
  const extra=setup?.({root,curves,bolus})||{};helper(root);
  return{steps,update(t,stepIndex){field.ensure();field.clear();const s=steps[stepIndex];update({t,f:clamp01((t-s.start)/s.duration),step:stepIndex,field,bolus,curves,...extra})},dispose(){field.clear();disposeObject(root)}};
}
// A peristaltic pair: dilation around the bolus, contraction just behind it.
function peristalsis(field,slot,s,{behind=.09,width=.05,squeeze=-.24,bulge=.12}={}){field.set(slot,s,width*1.2,bulge);field.set(slot+1,s-behind,width,squeeze)}

export function createEsophagusProcess({app,mode}){
  return createCutProcess({app,mode,id:'esophagus',bolusRadius:.075,routes:[{points:CUT_ESOPHAGUS,offset:0,reach:.3}],
    steps:[
      {title:'Entrada do bolo',duration:3,still:.8,text:'Depois da deglutição, o esfíncter esofágico superior relaxa e o bolo entra no esôfago. A mucosa de epitélio estratificado pavimentoso resiste ao atrito, e o muco das glândulas da submucosa lubrifica a passagem.'},
      {title:'Onda peristáltica',duration:7,still:.45,text:'A musculatura circular se contrai logo atrás do bolo enquanto o segmento à frente relaxa e se alarga. A onda percorre o órgão de cima para baixo; por isso engolimos mesmo deitados. No terço superior o músculo é esquelético e, no inferior, liso.'},
      {title:'Esfíncter esofágico inferior',duration:4,still:.75,text:'O esfíncter inferior relaxa quando a onda chega e se contrai de novo depois da passagem, dificultando o refluxo do conteúdo ácido do estômago. Esquema ilustrativo: calibre e espessuras da parede estão ampliados.'}
    ],
    update({f,step,field,bolus,curves}){
      const c=curves[0].curve;let u;
      if(step===0)u=lerp(-.08,.12,easeInOut(f));else if(step===1)u=lerp(.12,.86,f);else u=lerp(.86,1.12,easeInOut(smoothstep(0,.55,f)));
      bolus.place(c,clamp01(u),.075,1.5);bolus.setOpacity(step===2?1-smoothstep(.45,.6,f):step===0?smoothstep(0,.25,f):1);bolus.setColor(FOOD);
      if(step===1||step===0&&f>.5)peristalsis(field,0,u,{});
      // The lower sphincter: relaxed while the bolus passes, closing again behind it.
      const lower=step===2?(f<.5?.10*Math.sin(f/.5*Math.PI):-.2*smoothstep(.5,.8,f)):-.16;field.set(2,.96,.04,lower);
    }});
}

export function createStomachProcess({app,mode}){
  return createCutProcess({app,mode,id:'stomach',bolusRadius:.07,routes:[{points:CUT_STOMACH,offset:0,reach:.62}],
    steps:[
      {title:'Chegada e relaxamento receptivo',duration:4,still:.7,text:'O alimento entra pela cárdia. Fundo e corpo relaxam para acomodar o volume sem grande aumento de pressão: o estômago funciona como reservatório.'},
      {title:'Ondas de mistura',duration:8,still:.5,text:'Ondas de contração partem do corpo e ficam mais fortes no antro. Com o piloro quase fechado, a maior parte do conteúdo é lançada de volta (retropulsão), o que mistura e fragmenta o alimento.'},
      {title:'Suco gástrico e quimo',duration:6,still:.5,text:'Glândulas da mucosa liberam HCl, pepsinogênio (ativado em pepsina, que inicia a digestão das proteínas) e muco, que protege a parede. A mistura semilíquida resultante é o quimo.'},
      {title:'Esvaziamento pelo piloro',duration:6,still:.6,text:'A cada onda forte, pequenas porções de quimo atravessam o piloro para o duodeno. O esvaziamento é gradual, em geral ao longo de algumas horas, e é mais lento após refeições gordurosas. Esquema ilustrativo, sem escala.'}
    ],
    setup({root}){const chyme=createParticles(36,.016,0xd8c27c,.75),acid=createParticles(30,.008,0xb9f0ff,.8);root.add(chyme.mesh,acid.mesh);return{chyme,acid}},
    update({t,f,step,field,bolus,curves,chyme,acid}){
      const c=curves[0].curve,p=new THREE.Vector3(),q=new THREE.Vector3();
      if(step===0){bolus.place(c,lerp(.02,.38,easeInOut(f)),.07,1.2);bolus.setOpacity(1);bolus.setColor(FOOD);field.set(0,.4,.3,.05*smoothstep(0,.6,f))}
      else{bolus.setOpacity(step===1?1-smoothstep(.1,.35,f):0);bolus.place(c,.38,.07,1.2);field.set(0,.4,.3,.05)}
      // Mixing waves travel from the body to the antrum and grow stronger near the pylorus.
      const waving=step===0?0:step===3?1:1;for(let i=0;i<3;i++){const ph=(t*.32+i/3)%1,s=lerp(.42,.97,ph);field.set(1+i,s,.06,-waving*lerp(.07,.34,ph)*Math.sin(ph*Math.PI*.95+.1))}
      const pyloric=step===3?-.25+.35*Math.max(0,Math.sin(t*2.1)):-.25;field.set(4,.985,.025,pyloric);
      // Chyme: particles carried towards the pylorus by each wave and thrown back (retropulsion).
      const mixing=step>=1?(step===1?smoothstep(.05,.35,f):1):0;
      for(let i=0;i<36;i++){const base=.4+.44*hash(i),swing=.05*Math.sin(t*2+i*1.7),u=Math.min(.9,base+swing);c.getPointAt(u,p);const r=(.03+.11*hash(i+40))*(1-.5*u);p.x+=r*Math.cos(i*2.3+t*.8);p.y+=r*Math.sin(i*2.3+t*.8);p.z+=.02*Math.sin(i);chyme.set(i,p,mixing*(.7+.4*hash(i+9)))}chyme.commit();
      // Gastric juice: droplets rising from the mucosa towards the lumen.
      const secreting=step===2?smoothstep(0,.2,f)*(1-smoothstep(.85,1,f)):0;
      for(let i=0;i<30;i++){const ph=(t*.5+hash(i+5))%1,u=.3+.6*hash(i+70);c.getPointAt(u,p);q.set(hash(i+90)-.5,hash(i+91)-.5,-.4).normalize();p.addScaledVector(q,.2*(1-ph));acid.set(i,p,secreting*Math.sin(ph*Math.PI))}acid.commit();
      // Emptying: small portions leave through the pylorus.
      if(step===3){const squirt=Math.max(0,Math.sin(t*2.1));bolus.setOpacity(.9*squirt);bolus.setColor(CHYME);bolus.place(c,lerp(.93,1.02,(t*2.1/Math.PI)%1),.035,1.6)}
    }});
}

export function createSmallIntestineProcess({app,mode}){
  return createCutProcess({app,mode,id:'small-intestine',bolusRadius:.03,routes:[{points:CUT_SMALL_INTESTINE,offset:0,reach:.075},{points:CUT_JEJUNAL_WINDOW,offset:2,reach:.3}],
    steps:[
      {title:'Quimo no duodeno',duration:4,still:.6,text:'O quimo ácido chega do estômago. No duodeno recebe a bile, que emulsifica gorduras, e o suco pancreático, com enzimas e bicarbonato. À esquerda, o trajeto do intestino delgado em escala reduzida.'},
      {title:'Peristaltismo ao longo das alças',duration:8,still:.45,text:'Ondas peristálticas curtas fazem o conteúdo avançar do duodeno ao jejuno e ao íleo, em geral por algumas horas.'},
      {title:'Segmentação',duration:6,still:.35,text:'Na janela ampliada da parede (à direita), anéis de músculo circular se contraem e relaxam alternadamente em pontos vizinhos. Isso mistura o quimo com as secreções e o mantém em contato com a mucosa, com pouco avanço.'},
      {title:'Absorção nas vilosidades',duration:7,still:.5,text:'Pregas circulares, vilosidades e microvilosidades ampliam a superfície. Monossacarídeos e aminoácidos seguem para os capilares; os lipídios, montados em quilomícrons, vão sobretudo para o vaso linfático (lácteo).'},
      {title:'Íleo e válvula ileocecal',duration:4,still:.7,text:'No íleo terminal são absorvidos sais biliares e vitamina B12. A válvula ileocecal controla a passagem para o ceco, no intestino grosso. Esquema ilustrativo: quantidades e proporções não estão em escala.'}
    ],
    setup({root}){const nutrients=createParticles(40,.007,0xffe08a,.9);root.add(nutrients.mesh);return{nutrients}},
    update({t,f,step,field,bolus,curves,nutrients}){
      const c=curves[0].curve,p=new THREE.Vector3();
      const u=step===0?lerp(0,.1,f):step===1?lerp(.1,.78,f):step===4?lerp(.78,1,easeInOut(smoothstep(0,.6,f))):.78;
      bolus.place(c,u,.032,1.6);bolus.setColor(CHYME);bolus.setOpacity(step===4?1-smoothstep(.65,.85,f):step===2||step===3?.55:1);
      if(step<=1||step===4)peristalsis(field,0,u,{behind:.035,width:.02,squeeze:-.3,bulge:.12});
      // Window: neighbouring rings alternate (segmentation); a slower wave once segmentation fades.
      const seg=step===2?smoothstep(0,.15,f):step===3?.45:0,alt=Math.sin(t*3.2);
      for(let i=0;i<4;i++){const s=2.12+i*.25,sign=i%2?1:-1;field.set(2+i,s,.05,-.2*seg*Math.max(0,sign*alt))}
      // Nutrients leave the lumen into the villi and on to the wall.
      const absorbing=step===3?smoothstep(0,.2,f)*(1-smoothstep(.9,1,f)):step===2?.25*smoothstep(.5,1,f):0;
      for(let i=0;i<40;i++){const ph=(t*.45+hash(i))%1,side=i%2?1:-1,y=.36-.72*hash(i+3);p.set(.34+side*lerp(.02,.2,ph),y,.0+.05*(hash(i+8)-.5));nutrients.set(i,p,absorbing*Math.sin(ph*Math.PI))}nutrients.commit();
    }});
}

export function createLargeIntestineProcess({app,mode}){
  return createCutProcess({app,mode,id:'large-intestine',bolusRadius:.045,routes:[{points:CUT_LARGE_INTESTINE,offset:0,reach:.11}],
    steps:[
      {title:'Entrada pelo ceco',duration:4,still:.6,text:'O conteúdo líquido do íleo passa pela válvula ileocecal para o ceco, de onde parte o apêndice vermiforme. Ainda há muita água e sais a recuperar.'},
      {title:'Contrações haustrais',duration:7,still:.5,text:'Os haustros se contraem lentamente, um de cada vez, revolvendo o conteúdo e favorecendo o contato com a mucosa. O avanço é lento, de muitas horas.'},
      {title:'Absorção de água',duration:6,still:.5,text:'A mucosa (janela ampliada à direita) absorve água e eletrólitos; células caliciformes produzem muco. Bactérias da microbiota fermentam resíduos e produzem algumas vitaminas, como a K. O conteúdo endurece e escurece: formam-se as fezes.'},
      {title:'Movimento de massa',duration:5,still:.5,text:'Algumas vezes ao dia, muitas vezes após as refeições (reflexo gastrocólico), uma contração forte empurra o conteúdo do colo transverso ao sigmoide.'},
      {title:'Reto e defecação',duration:4,still:.6,text:'As fezes que chegam ao reto distendem sua parede e desencadeiam o reflexo da defecação. O esfíncter interno do ânus é involuntário e o externo, voluntário. Esquema ilustrativo, com tempo comprimido.'}
    ],
    setup({root}){const water=createParticles(36,.008,0x7cc8ff,.85);root.add(water.mesh);return{water}},
    update({t,f,step,field,bolus,curves,water}){
      const c=curves[0].curve,p=new THREE.Vector3();
      const u=step===0?lerp(0,.12,easeInOut(f)):step===1?lerp(.12,.3,f)+.02*Math.sin(t*3):step===2?lerp(.3,.42,f):step===3?lerp(.42,.88,easeInOut(f)):lerp(.88,1,easeInOut(smoothstep(0,.6,f)));
      const dry=step<=1?0:step===2?f:1;bolus.setColor(new THREE.Color().copy(CHYME).lerp(FECES,dry));bolus.place(c,u,lerp(.045,.038,dry),1.5);bolus.setOpacity(step===4?1-smoothstep(.7,.9,f):1);
      // Haustral churning: slow alternating bulges along the ascending and transverse colon.
      const haustra=step===1?smoothstep(0,.2,f):step===2?.6:step===0?.3:0;for(let i=0;i<4;i++){const s=.1+i*.11;field.set(i,s,.035,-.18*haustra*Math.max(0,Math.sin(t*1.6+i*1.9)))}
      if(step===3)peristalsis(field,4,u,{behind:.06,width:.035,squeeze:-.34,bulge:.12});
      // Water leaving the lumen into the enlarged mucosa window.
      const absorbing=step===2?smoothstep(0,.2,f)*(1-smoothstep(.9,1,f)):0;
      for(let i=0;i<36;i++){const ph=(t*.4+hash(i+2))%1;p.set(.12+.46*hash(i+11),.28-.42*ph,.095-.06*ph);water.set(i,p,absorbing*Math.sin(ph*Math.PI))}water.commit();
    }});
}
