import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Authored anatomy teaching reconstructions. Continuous cut surfaces and
// ordered duct paths replace disconnected symbols; proportions are adapted
// for reading and have not been measured from an individual specimen.
const TAU=Math.PI*2;
const COLORS={capsule:0xe0cfb7,stroma:0xbd9390,tubule:0xd6ae99,rete:0xb98978,epididymis:0xc89882,duct:0xc68081,epithelium:0xd799a2,fold:0xd398a2,lamina:0xd3ad9f,muscle:0xb87883,adventitia:0xc2ada0,artery:0xbe6570,vein:0x7b83a6};
export const reproductiveInteriorSources={
 testis:['https://training.seer.cancer.gov/testicular/anatomy/cross-section.html','https://openstax.org/books/anatomy-and-physiology-2e/pages/27-1-anatomy-and-physiology-of-the-testicular-reproductive-system'],
 vagina:['https://www.histologyguide.org/slideview/MH-173-vagina/18-slide-1.html','https://openstax.org/books/anatomy-and-physiology-2e/pages/27-2-anatomy-and-physiology-of-the-ovarian-reproductive-system','https://tales.nmc.unibas.ch/en/histology-12/fortpflanzungsorgane-weiblich-anatomische-mikroskopie-46/vagina-274']
};
const TESTIS_KEYS=['tunica_albuginea','lobules','seminiferous_tubules','rete_testis','efferent_ductules','epididymis','vas_deferens'];
const TESTIS_LABELS=['Túnica albugínea e septos','Lóbulos testiculares','Túbulos seminíferos','Rede testicular','Dúctulos eferentes','Epidídimo adjacente','Ducto deferente'];
const VAGINA_KEYS=['epithelium','lamina-propria','muscle','adventitia','rugae'];
const VAGINA_LABELS=['Epitélio estratificado pavimentoso','Lâmina própria','Camada muscular','Adventícia','Pregas vaginais'];
const vector=p=>new THREE.Vector3(...p);

// Also used by authored-interiors.js to rebuild the precomputed meshes with the same parts, materials and stats.
export function createReproductiveContext(id,definition,mobile,title,description){
 const group=new THREE.Group(),parts=[],geometries=new Set(),materials=new Map();let disposed=false;
 group.name='INTERNAL_'+id;group.userData={schematic:true,educational:true,notRealHistology:true,internalOrgan:id,authoredReconstruction:true,anatomicalReference:false,geometryIdentified:true,mobile,defaultClip:'none',sourceUrls:reproductiveInteriorSources[id]};
 const material=color=>{if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.69,metalness:0,side:THREE.DoubleSide,forceSinglePass:true}));return materials.get(color)};
 const mesh=(geometry,color,metadata={})=>{geometries.add(geometry);const object=new THREE.Mesh(geometry,material(color));object.userData={...metadata,educational:true,authoredReconstruction:true,geometryIdentified:true,anatomicalReference:false};return object};
 const combine=geos=>{if(geos.length===1)return geos[0];for(const g of geos)if(!g.index)g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));const result=mergeGeometries(geos);geos.forEach(g=>g.dispose());if(!result)throw Error('Não foi possível combinar superfícies anatômicas');return result};
 const add=(object,key,tissue)=>{
  const keys=id==='testis'?TESTIS_KEYS:VAGINA_KEYS,labels=id==='testis'?TESTIS_LABELS:VAGINA_LABELS;
  const expected=id==='testis'?'INTERNAL_testis_'+key:key;
  const info=(definition.internalParts||[]).find(p=>p.id===expected||p.partId===key)||{id:expected,name:expected,label:labels[keys.indexOf(key)],function:'Contribuir à organização e à função do órgão.'};
  object.name='INTERNAL_'+id+'_'+key;
  object.traverse(o=>{o.userData={...o.userData,schematic:true,educational:true,notRealHistology:true,geometryIdentified:true,authoredReconstruction:true,anatomicalReference:false,atlasName:object.name,internalPart:info.id,partId:key,tissue,sourceUrls:reproductiveInteriorSources[id]}});
  group.add(object);parts.push({...info,id:info.id,name:info.name||info.id,contentPartId:info.id,partId:key,organId:id,label:info.label||info.pt||labels[keys.indexOf(key)],pt:info.label||info.pt||labels[keys.indexOf(key)],object,geometryIdentified:true,authoredReconstruction:true,anatomicalReference:false,sourceUrls:reproductiveInteriorSources[id]});return object;
 };
 const finish=(limits,extraStats={})=>{
  group.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(group),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3()),scale=1.2/Math.max(...size.toArray());group.scale.setScalar(scale);group.position.copy(center.multiplyScalar(-scale));group.updateMatrixWorld(true);
  let triangles=0,meshes=0,vertices=0,geometryBytes=0;group.traverse(o=>{if(!o.isMesh)return;meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;vertices+=o.geometry.attributes.position.count;for(const a of Object.values(o.geometry.attributes))geometryBytes+=a.array.byteLength;geometryBytes+=o.geometry.index?.array.byteLength||0});
  return{id,title,description,group,parts,bounds:new THREE.Box3().setFromObject(group),orientation:id==='testis'?'Corte longitudinal reorientado: Y superior, +Z face exposta; borda posterior e epidídimo à direita do corte.':'Parede vaginal aberta anteriormente: Y longitudinal, +Z face exposta; lúmen visível entre paredes e camadas em continuidade.',limits,sources:reproductiveInteriorSources[id],defaultClip:'none',authoredReconstruction:true,anatomicalReference:false,geometryIdentified:true,preserveMaterials:false,stats:{parts:parts.length,meshes,triangles,vertices,geometryBytes,drawCalls:meshes,quality:mobile?'adaptativa para toque':'detalhada',...extraStats},dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const g of geometries){g.disposeBoundsTree?.();g.dispose()}for(const m of materials.values())m.dispose();group.clear();geometries.clear();materials.clear()}};
 };
 return{group,parts,mesh,combine,add,finish};
}

function grid(fn,nu,nv){
 const positions=[],uv=[],index=[];
 for(let i=0;i<=nu;i++)for(let j=0;j<=nv;j++){positions.push(...fn(i/nu,j/nv));uv.push(i/nu,j/nv)}
 for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){const k=i*(nv+1)+j;index.push(k,k+1,k+nv+1,k+1,k+nv+2,k+nv+1)}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();return g;
}

function pipe(points,radius,segments,radial=10){
 const curve=new THREE.CatmullRomCurve3(points.map(vector),false,'centripetal');
 const g=new THREE.TubeGeometry(curve,segments,radius,radial,false);g.userData={continuousDuct:true,pathEndpoints:[points[0],points.at(-1)]};return g;
}

function section(points,front,depth,bevel=.004){
 const shape=new THREE.Shape();shape.moveTo(...points[0]);
 const loop=new THREE.CatmullRomCurve3(points.map(([x,y])=>new THREE.Vector3(x,y,0)),true,'centripetal').getPoints(points.length*3);
 for(const p of loop.slice(1))shape.lineTo(p.x,p.y);shape.closePath();
 const g=new THREE.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:bevel>0,bevelThickness:bevel,bevelSize:bevel,bevelSegments:2,curveSegments:8});g.translate(0,0,front-depth);return g;
}

function hemiShell(cx,rx,ry,rz,thickness,mobile){
 const n=mobile?20:32,a=mobile?80:128,positions=[],uv=[],indices=[];
 for(const inset of[0,thickness]){
  for(let q=0;q<n;q++){const t=q/n*Math.PI/2;for(let j=0;j<a;j++){const angle=j/a*TAU;positions.push(cx+(rx-inset)*Math.cos(t)*Math.cos(angle),(ry-inset)*Math.cos(t)*Math.sin(angle),-(rz-inset)*Math.sin(t));uv.push(j/a,q/n)}}
  positions.push(cx,0,-(rz-inset));uv.push(.5,1);
 }
 const stride=n*a+1;
 for(let side=0;side<2;side++){
  const base=side*stride;
  for(let q=0;q<n-1;q++)for(let j=0;j<a;j++){const k=base+q*a+j,next=base+q*a+(j+1)%a,down=k+a,dnext=next+a;side?indices.push(k,down,next,next,down,dnext):indices.push(k,next,down,next,dnext,down)}
  const pole=base+n*a,last=base+(n-1)*a;for(let j=0;j<a;j++)side?indices.push(last+j,pole,last+(j+1)%a):indices.push(last+j,last+(j+1)%a,pole);
 }
 for(let j=0;j<a;j++){const next=(j+1)%a;indices.push(j,stride+j,next,next,stride+j,stride+next)}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();g.userData={continuousCapsule:true,genuineCutRim:true};return g;
}

function lobularVolume(anchor,start,end,boundary,mobile){
 const n=mobile?16:28,position=(t,s,back=false)=>{
  const a=start+(end-start)*s,p=boundary(a),rho=.032+t*.89;
  const x=anchor[0]+(p[0]-anchor[0])*rho,y=anchor[1]+(p[1]-anchor[1])*rho;
  const z=back?-.166+.02*rho:-.058+.0025*Math.sin(x*63+y*31)+.0015*Math.cos(y*71-x*13);
  return[x,y,z];
 };
 const surfaces=[grid((t,s)=>position(t,s),n,n),grid((t,s)=>position(t,s,true),n,n)];
 for(const s of[0,1])surfaces.push(grid((t,u)=>{const a=position(t,s),b=position(t,s,true);return a.map((value,i)=>value+(b[i]-value)*u)},n,3));
 for(const t of[0,1])surfaces.push(grid((s,u)=>{const a=position(t,s),b=position(t,s,true);return a.map((value,i)=>value+(b[i]-value)*u)},n,3));
 const g=mergeGeometries(surfaces);surfaces.forEach(s=>s.dispose());g.userData={volumetricLobule:true,sculptedCutFace:true};return g;
}

export function createTestisInteriorModel(definition={}, {mobile=false}={}){
 const r=createReproductiveContext('testis',definition,mobile,'Testículo — lóbulos e ductos em corte','Envoltório contínuo com septos, lóbulos preenchidos por túbulos curvos e via de saída identificável até epidídimo e ducto deferente. Organização ampliada para leitura; quantidades ilustrativas.');
 const cx=-.12,rx=.29,ry=.43,rz=.24,anchor=[.14,0],count=9,step=Math.PI/count;
 const boundary=a=>[cx+rx*Math.cos(a),ry*Math.sin(a)];
 const capsule=[hemiShell(cx,rx,ry,rz,.019,mobile)],lobules=[],tubules=[],rete=[];
 for(let i=0;i<=count;i++){
  const angle=Math.PI/2+i*step,p=boundary(angle),d=[p[0]-anchor[0],p[1]-anchor[1]],length=Math.hypot(...d),normal=[-d[1]/length*.004,d[0]/length*.004];
  const near=[anchor[0]+d[0]*.025,anchor[1]+d[1]*.025];
  capsule.push(section([[near[0]+normal[0],near[1]+normal[1]],[p[0]+normal[0],p[1]+normal[1]],[p[0]-normal[0],p[1]-normal[1]],[near[0]-normal[0],near[1]-normal[1]]],-.017,.115,.0015));
 }
 for(let i=0;i<count;i++){
  const start=Math.PI/2+i*step+.016,end=start+step-.032;
  lobules.push(lobularVolume(anchor,start,end,boundary,mobile));
  const center=(start+end)/2,points=[],turns=8,p=boundary(center),delta=[p[0]-anchor[0],p[1]-anchor[1]],length=Math.hypot(...delta),normal=[-delta[1]/length,delta[0]/length];
  for(let j=0;j<=240;j++){
   const t=j/240,rho=.87-.73*t,angle=t*TAU*turns,radius=.005+Math.min(.029,length*Math.sin((end-start)*.5)*.61)*rho;
   points.push([anchor[0]+delta[0]*rho+normal[0]*radius*Math.cos(angle),anchor[1]+delta[1]*rho+normal[1]*radius*Math.cos(angle),-.013+radius*.70*Math.sin(angle)]);
  }
  // The loop's terminal straight segment reaches the collecting network.
  const endPoint=[.16,.085*Math.sin(center),-.008];points.push([.145,.084*Math.sin(center),-.009],endPoint);
  const g=pipe(points,.0105,mobile?210:360,mobile?8:12);g.userData.lobuleIndex=i;g.userData.collectingEndpoint=endPoint;tubules.push(g);
 }
 r.add(r.mesh(r.combine(capsule),COLORS.capsule,{geometryKind:'continuous-capsule-and-attached-septa',attachedSepta:count+1}),'tunica_albuginea','connective');
 r.add(r.mesh(r.combine(lobules),COLORS.stroma,{geometryKind:'lobular-parenchyma',lobularRegions:count}),'lobules','organ');
 r.add(r.mesh(r.combine(tubules),COLORS.tubule,{geometryKind:'ordered-continuous-seminiferous-paths',lobularRegions:count,tubulePaths:count}),'seminiferous_tubules','organ');
 for(const x of[.148,.164,.180]){const points=[];for(let i=0;i<=32;i++){const t=i/32;points.push([x+.003*Math.sin(t*TAU*2),-.29+t*.58,-.011+.003*Math.cos(t*TAU)])}rete.push(pipe(points,.0075,mobile?64:100,mobile?8:12));}
 for(const y of[-.245,-.145,-.045,.065,.17,.26])rete.push(pipe([[.144,y,-.012],[.164,y+.009,-.008],[.184,y,-.012]],.0055,mobile?20:36,mobile?8:10));
 r.add(r.mesh(r.combine(rete),COLORS.rete,{geometryKind:'posterior-anastomosing-collecting-network'}),'rete_testis','organ');
 const epididymalPoint=t=>{
  const radius=.032+.045*Math.exp(-t/.16)+.020*Math.exp(-(1-t)/.12),a=t*TAU*17;
  return[.302-.07*t*t+radius*Math.cos(a),.39-.82*t+.015*Math.sin(a),-.025+.022*Math.sin(a)];
 };
 const epididymalPoints=Array.from({length:700},(_,i)=>epididymalPoint(i/699));epididymalPoints.push([.228,-.442,-.020]);
 const efferents=[];
 for(let i=0;i<4;i++){const end=epididymalPoint(i*.014),start=[.169,.23+i*.014,-.010];efferents.push(pipe([start,[.20,.31+i*.023,-.01],[.25,.36+i*.015,-.004],end],.009,mobile?64:112,mobile?8:12));}
 r.add(r.mesh(r.combine(efferents),COLORS.rete,{geometryKind:'efferent-ductules-to-epididymal-head'}),'efferent_ductules','organ');
 r.add(r.mesh(pipe(epididymalPoints,.015,mobile?420:760,mobile?8:12),COLORS.epididymis,{geometryKind:'continuous-coiled-epididymal-duct',headSuperior:true,tailInferior:true}),'epididymis','organ');
 const deferens=pipe([[.228,-.442,-.020],[.31,-.455,-.010],[.412,-.33,.005],[.443,-.05,-.016],[.435,.25,-.029],[.428,.55,-.021]],.023,mobile?100:180,mobile?10:16);
 r.add(r.mesh(deferens,COLORS.duct,{geometryKind:'continuous-epididymal-to-deferent-outlet'}),'vas_deferens','muscle');
 return r.finish('Reconstrução educacional autoral do testículo e via de saída adjacente. Lóbulos, túbulos e ductos estão ampliados e reduzidos em número para identificação; não representam contagem, escala histométrica ou anatomia de um indivíduo. Septos pertencem à túnica albugínea; rete posterior recebe a via intratesticular. Cores não são fotografias de tecido.',{lobularRegions:count,attachedSepta:count+1,continuousTubulePaths:count,genuinePosteriorCapsule:true});
}

const ANGLE_START=Math.PI*.35,ANGLE_SPAN=Math.PI*1.30;
function fold(t,a){
 let relief=0;
 // Only the three nearest folds can contribute above Float32 precision;
 // distant Gaussian tails are <1e-20 at this spacing. This preserves relief
 // while avoiding eight unnecessary exponential evaluations per vertex.
 const nearest=Math.round((t-.055)/.088),first=Math.max(0,nearest-1),last=Math.min(10,nearest+1);
 for(let i=first;i<=last;i++){const center=.055+i*.088+.010*Math.sin(a*2+i*.85),width=.010+.002*Math.cos(i*.6);relief+=.012*(.8+.2*Math.cos(a*2-i*.4))*Math.exp(-(((t-center)/width)**2))}
 return relief*Math.sin(Math.PI*t)**.3;
}
function wallPoint(t,a,rx,rz,foldStrength=0,micro=0){
 const bend=.026*Math.sin(t*Math.PI)-.010*t,crease=fold(t,a)*foldStrength;
 const ripple=micro*(Math.sin(a*13+t*79)+.45*Math.sin(a*31-t*121));
 return[bend+(rx-crease+ripple)*Math.sin(a),-.55+t*1.10,(rz-crease*.70+ripple*.5)*Math.cos(a)+.018*Math.sin(t*Math.PI*1.4)];
}
function compactFace(geometry,index){
 const positions=[],normals=[],uv=[],mapping=new Map(),newIndex=[];
 for(const old of index){if(!mapping.has(old)){mapping.set(old,mapping.size);const p=geometry.attributes.position,n=geometry.attributes.normal,u=geometry.attributes.uv;positions.push(p.getX(old),p.getY(old),p.getZ(old));normals.push(n.getX(old),n.getY(old),n.getZ(old));uv.push(u.getX(old),u.getY(old))}newIndex.push(mapping.get(old))}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(newIndex);return g;
}
function wallLayer(inner,outer,nt,na,nr,{foldStrength=0,foldOuter=0,micro=0,microOuter=micro,splitFolds=false}={}){
 const inside=grid((t,s)=>wallPoint(t,ANGLE_START+s*ANGLE_SPAN,...inner,foldStrength,micro),nt,na);
 const surfaces=[grid((t,s)=>wallPoint(t,ANGLE_START+s*ANGLE_SPAN,...outer,foldOuter,microOuter),nt,na)];
 for(const angle of[ANGLE_START,ANGLE_START+ANGLE_SPAN])surfaces.push(grid((t,s)=>{
  const pi=wallPoint(t,angle,...inner,foldStrength,micro),po=wallPoint(t,angle,...outer,foldOuter,microOuter);return pi.map((value,i)=>value+(po[i]-value)*s);
 },nt,nr));
 for(const t of[0,1])surfaces.push(grid((s,u)=>{
  const angle=ANGLE_START+s*ANGLE_SPAN,pi=wallPoint(t,angle,...inner,foldStrength,micro),po=wallPoint(t,angle,...outer,foldOuter,microOuter);return pi.map((value,i)=>value+(po[i]-value)*u);
 },na,nr));
 let rugae=null;
 if(splitFolds){const base=[],crest=[],index=inside.index.array;for(let i=0;i<index.length;i+=3){const triangle=[index[i],index[i+1],index[i+2]],t=triangle.reduce((n,k)=>n+inside.attributes.uv.getX(k),0)/3,a=ANGLE_START+triangle.reduce((n,k)=>n+inside.attributes.uv.getY(k),0)/3*ANGLE_SPAN;(fold(t,a)>.004?crest:base).push(...triangle)}surfaces.push(compactFace(inside,base));rugae=compactFace(inside,crest);inside.dispose();}
 else surfaces.push(inside);
 return{surfaces,rugae};
}

export function createVaginaInteriorModel(definition={}, {mobile=false}={}){
 const r=createReproductiveContext('vagina',definition,mobile,'Vagina — parede contínua em corte','Canal aberto para expor pregas da mucosa e as camadas contínuas do epitélio, lâmina própria, músculo e adventícia. A abertura é didática; o lúmen em repouso é habitualmente colabado.');
 const nt=mobile?80:144,na=mobile?48:88,nr=mobile?2:4;
 const layers=[
  ['epithelium',[.163,.087],[.179,.103],COLORS.epithelium,'organ',1,.82,.0008,.0008],
  ['lamina-propria',[.179,.103],[.213,.130],COLORS.lamina,'connective',.82,.13,.0008,.0013],
  ['muscle',[.213,.130],[.271,.177],COLORS.muscle,'muscle',.13,0,.0013,.0015],
  ['adventitia',[.271,.177],[.293,.196],COLORS.adventitia,'connective',0,0,.0015,.0025]
 ];
 let rugae;
 for(const[key,inner,outer,color,tissue,foldStrength,foldOuter,micro,microOuter]of layers){
  const result=wallLayer(inner,outer,nt,na,nr,{foldStrength,foldOuter,micro,microOuter,splitFolds:key==='epithelium'}),object=new THREE.Group();
  object.add(r.mesh(r.combine(result.surfaces),color,{geometryKind:'continuous-vaginal-wall-layer',realLumen:true,cutWallThickness:true}));
  if(key==='lamina-propria'||key==='adventitia'){
   for(const side of[0,1])for(const venous of[false,true]){
    const angle=side?ANGLE_START+ANGLE_SPAN-.025:ANGLE_START+.025,rx=(inner[0]+outer[0])*.5,rz=(inner[1]+outer[1])*.5,points=[];
    for(let i=0;i<=64;i++){const t=.04+i/64*.91,p=wallPoint(t,angle+.012*Math.sin(t*TAU*2),rx+(venous?.005:-.006),rz,foldStrength*.75,0);points.push(p)}
    object.add(r.mesh(pipe(points,venous?.0038:.0027,mobile?72:128,mobile?6:8),venous?COLORS.vein:COLORS.artery,{geometryKind:'vessels-within-connective-layer'}));
   }
  }
  r.add(object,key,tissue);
  if(result.rugae)rugae=result.rugae;
 }
 r.add(r.mesh(rugae,COLORS.fold,{geometryKind:'sculpted-mucosal-fold-surfaces',continuousWithEpithelium:true,foldCount:11,noDuplicateSurface:true}),'rugae','organ');
 return r.finish('Reconstrução educacional autoral de parede vaginal, com corte anterior e lúmen deliberadamente aberto para leitura. Pregas têm relevo na superfície da mucosa e compartilhamento geométrico das bordas com o epitélio; camadas formam paredes do mesmo canal. Espessuras, comprimento e vascularização são ampliados e não medidos. Não é uma imagem histológica nem um modelo de indivíduo. A mucosa não tem glândulas próprias e o esquema não adiciona camada córnea, glândulas ou muscular da mucosa.',{realOpenLumen:true,continuousWallLayers:4,sculptedMucosalFolds:11});
}
