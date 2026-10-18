import {createDetailedOrganelleModel} from './cytology-organelles.js';
import {createDetailedProcessModel} from './cytology-processes.js';
import {hasRealCytology,createRealCytologyModel} from './cytology-real.js';
import * as THREE from 'three';

// Original static teaching geometry: exposed sections, stage panels and molecular
// symbols, not microscopy, real cell counts, atomistic simulations or diagnosis.
const C={pink:0xda9dba,red:0xce6879,blue:0x6e9bc9,purple:0x947abb,cream:0xe7d6b6,gold:0xe0ba65,green:0x72b294,dark:0x474d65,pale:0xcbdccf,orange:0xd99968,white:0xe6e8ed};
export const CYTOLOGY_IDS=Object.freeze(['animal-cell','cardiomyocyte','sarcomere','plant-cell','bacterial-cell','fungal-cell','cell-theory-microscopy','biomolecules-water','carbohydrates-lipids','proteins-enzymes','nucleic-acids','plasma-membrane','diffusion-facilitated','osmosis-tonicity','active-transport','endocytosis-exocytosis','cell-junctions','cytoskeleton','cilia-flagella','ribosome','rough-er','smooth-er','golgi','lysosome-autophagy','peroxisome','vacuole','mitochondrion','glycolysis-fermentation','krebs-cycle','oxidative-phosphorylation','chloroplast','light-reactions','calvin-cycle','nucleus-chromatin','dna-replication','transcription-rna','translation-protein','gene-regulation','cell-cycle','mitosis','meiosis','gametogenesis','cell-signaling','apoptosis-cancer','cell-differentiation','viruses-acellular']);
let contentPromise;
async function getDefinition(id,supplied){
 if(supplied?.id===id&&Array.isArray(supplied.parts))return supplied;
 const entries=supplied?.views||supplied?.cytology||supplied?.models;if(Array.isArray(entries))return entries.find(x=>x.id===id);
 contentPromise ||= fetch(new URL('./data/cytology-content.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Conteúdo de citologia indisponível');return r.json()}).catch(e=>{contentPromise=null;throw e});
 const data=await contentPromise;return (data.views||data.cytology||data.models||[]).find(x=>x.id===id);
}
const v=p=>new THREE.Vector3(...p);
function context(def){
 const group=new THREE.Group(),parts=[],geometries=new Map(),materials=new Map();let serial=0,disposed=false;
 group.name='CYTOLOGY_'+def.id;group.userData={schematic:true,educational:true,cytology:true,cytologyId:def.id,notRealHistology:true};
 const geometry=(key,build)=>{if(!geometries.has(key))geometries.set(key,build());return geometries.get(key)};
 const material=(color,opacity=1,vertexColors=false)=>{const key=color+':'+opacity+':'+vertexColors;if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:.57,metalness:0,side:THREE.DoubleSide,transparent:opacity<1,opacity,depthWrite:opacity>=.95,forceSinglePass:true,vertexColors}));return materials.get(key)};
 for(const p of def.parts){const object=new THREE.Group();object.name='CYTO_'+def.id+'_'+p.id;object.userData={schematic:true,educational:true,cytology:true,partId:p.id};parts.push({...p,id:p.id,label:p.label||p.title||p.id,object});group.add(object)}
 const at=id=>parts.find(p=>p.id===id)?.object;
 function mesh(parent,geo,p=[0,0,0],size=[1,1,1],color=C.pink,opacity=1,vertexColors=false){if(!parent)return null;const m=new THREE.Mesh(geo,material(color,opacity,vertexColors));m.position.copy(v(p));m.scale.set(...size);m.userData={schematic:true,educational:true,cytology:true,partId:parent.userData.partId};parent.add(m);return m}
 const surface=(parent,build,color=C.pink,vertexColors=false)=>mesh(parent,geometry('custom'+serial++,build),[0,0,0],[1,1,1],color,1,vertexColors);
 const ball=(parent,p,size,color=C.pink,opacity=1)=>mesh(parent,geometry('sphere',()=>new THREE.SphereGeometry(1,20,12)),p,size,color,opacity);
 const box=(parent,p,size,color=C.cream,opacity=1)=>mesh(parent,geometry('box',()=>new THREE.BoxGeometry(1,1,1)),p,size,color,opacity);
 function rod(parent,a,b,r,color=C.gold){if(!parent)return;const delta=v(b).sub(v(a));if(delta.length()<1e-6)throw Error('Segmento nulo');const m=mesh(parent,geometry('cylinder',()=>new THREE.CylinderGeometry(1,1,1,12)),v(a).add(v(b)).multiplyScalar(.5).toArray(),[r,delta.length(),r],color);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m}
 function line(parent,points,r=.013,color=C.gold,segments=32){if(!parent)return;const curve=new THREE.CatmullRomCurve3(points.map(v),false,'centripetal');return mesh(parent,geometry('custom'+serial++,()=>new THREE.TubeGeometry(curve,segments,r,8,false)),[0,0,0],[1,1,1],color)}
 function loop(parent,p,rx,ry,r,color=C.cream){const points=[];for(let i=0;i<=48;i++){const a=i/48*Math.PI*2;points.push([p[0]+rx*Math.cos(a),p[1]+ry*Math.sin(a),p[2]])}return line(parent,points,r,color,48)}
 function disc(parent,p,size,color=C.cream,axis='z'){const m=mesh(parent,geometry('disc',()=>new THREE.CylinderGeometry(1,1,1,24)),p,size,color);if(m&&axis==='z')m.rotation.x=Math.PI/2;return m}
 function plate(parent,points,depth=.045,color=C.cream,z=0,holes=[]){if(!parent)return;const outline=pts=>{const s=new THREE.Shape();s.moveTo(...pts[0]);for(const p of pts.slice(1))s.lineTo(...p);s.closePath();return s};const shape=outline(points);for(const h of holes)shape.holes.push(outline(h));return mesh(parent,geometry('custom'+serial++,()=>new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:16})),[0,0,z],[1,1,1],color)}
 function oval(parent,p,rx,ry,depth,color=C.cream,hole=null){if(!parent)return;const shape=new THREE.Shape();shape.absellipse(0,0,rx,ry,0,2*Math.PI,false);if(hole){const h=new THREE.Path();h.absellipse(0,0,hole[0],hole[1],0,2*Math.PI,true);shape.holes.push(h)}return mesh(parent,geometry('custom'+serial++,()=>new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:24})),p,[1,1,1],color)}
 function bowl(parent,p,size,color=C.pink){if(!parent)return;const m=mesh(parent,geometry('bowl',()=>new THREE.SphereGeometry(1,24,14,Math.PI,Math.PI)),p,size,color);loop(parent,p,size[0],size[1],.009,color);return m}
 function arrow(parent,a,b,color=C.gold,r=.009){if(!parent)return;rod(parent,a,b,r,color);const d=v(b).sub(v(a)).normalize(),m=mesh(parent,geometry('cone',()=>new THREE.ConeGeometry(1,1,12)),v(b).addScaledVector(d,-.025).toArray(),[r*2.9,.05,r*2.9],color);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d);m.userData={...m.userData,directionArrow:true,from:[...a],to:[...b]};return m}
 function beads(parent,points,r=.02,color=C.gold){for(const p of points)ball(parent,p,[r,r,r],color)}
 function spiral(parent,p,r,length,turns=4,color=C.orange,thickness=.012,axis='y'){const points=[];for(let i=0;i<=64;i++){const t=i/64,a=t*Math.PI*2*turns;points.push(axis==='y'?[p[0]+r*Math.cos(a),p[1]+length*(t-.5),p[2]+r*Math.sin(a)]:[p[0]+length*(t-.5),p[1]+r*Math.cos(a),p[2]+r*Math.sin(a)])}return line(parent,points,thickness,color,64)}
 function dna(parent,p,length=.6,r=.055,turns=2,bases=null){for(const s of[0,1]){const pts=[];for(let i=0;i<=64;i++){const t=i/64,a=t*turns*Math.PI*2+s*Math.PI;pts.push([p[0]+r*Math.cos(a),p[1]+length*(t-.5),p[2]+r*Math.sin(a)])}line(parent,pts,.009,s?C.blue:C.orange,64)}for(let i=0;i<12;i++){const t=(i+.5)/12,a=t*turns*Math.PI*2;rod(bases||parent,[p[0]+r*Math.cos(a),p[1]+length*(t-.5),p[2]+r*Math.sin(a)],[p[0]-r*Math.cos(a),p[1]+length*(t-.5),p[2]-r*Math.sin(a)],.005,i%2?C.green:C.gold)}}
 function chromosome(parent,p,length=.18,color=C.purple,duplicated=true){const[px,py,pz]=p,g=new THREE.Group();g.userData={chromosome:true,chromatidCount:duplicated?2:1,partId:parent.userData.partId};parent.add(g);if(duplicated){for(const s of[-1,1]){rod(g,[px+s*.020,py-length/2,pz],[px,py,pz],.010,color);rod(g,[px,py,pz],[px+s*.020,py+length/2,pz],.010,color)}}else rod(g,[px,py-length/2,pz],[px,py+length/2,pz],.010,color);ball(g,p,[.013,.010,.011],C.cream);return g}
 const polyhedron=(parent,p,r,color=C.purple,opacity=1)=>mesh(parent,geometry('icosahedron',()=>new THREE.IcosahedronGeometry(1,0)),p,[r,r,r],color,opacity);
 function membrane(parent,p=[0,0,0],columns=7,width=.78){for(let i=0;i<columns;i++){const x=p[0]-width/2+i*width/(columns-1);for(const s of[-1,1]){ball(parent,[x,p[1]+s*.11,p[2]],[.025,.025,.025],C.blue);for(const t of[-1,1])rod(parent,[x+t*.009,p[1]+s*.086,p[2]],[x+t*.018,p[1]+s*.016,p[2]],.006,C.gold)}}}
 function protein(parent,p,color=C.purple){bowl(parent,p,[.075,.095,.05],color);ball(parent,[p[0]-.055,p[1],p[2]],[.036,.064,.04],color);ball(parent,[p[0]+.055,p[1],p[2]],[.036,.064,.04],color)}
 function organelleMito(parent,p,size=[.17,.085,.045]){bowl(parent,p,size,C.orange);for(let i=0;i<4;i++)line(parent,[[p[0]-size[0]*.7+i*size[0]*.42,p[1]-size[1]*.62,p[2]+.006],[p[0]-size[0]*.7+i*size[0]*.42,p[1]+size[1]*.6,p[2]+.012]],.006,C.red)}
 function finish(){for(const p of parts){if(!p.object.children.length)throw Error('Parte sem geometria: '+def.id+'/'+p.id);p.object.traverse(o=>{o.userData={...o.userData,schematic:true,educational:true,cytology:true,atlasName:p.object.name}})}group.updateMatrixWorld(true);const before=new THREE.Box3().setFromObject(group),center=before.getCenter(new THREE.Vector3()),size=before.getSize(new THREE.Vector3()),s=1.2/Math.max(...size.toArray());group.scale.setScalar(s);group.position.copy(center.multiplyScalar(-s));group.updateMatrixWorld(true);let meshes=0,triangles=0;group.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3}});return {id:def.id,title:def.title||def.label,label:def.label||def.title,group,parts,bounds:new THREE.Box3().setFromObject(group),description:def.description,limits:def.representation||def.limits||'Esquema 3D autoral estático. Quantidades, escalas, formas moleculares, cores e planos de corte são didáticos; não é uma imagem de microscopia, simulação molecular ou reconstrução individual.',sourceIds:def.sourceIds||[],stats:{parts:parts.length,meshes,triangles,geometries:geometries.size,materials:materials.size},dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const g of geometries.values()){g.disposeBoundsTree?.();g.dispose()}for(const m of materials.values())m.dispose();group.clear();geometries.clear();materials.clear()}}}
 return {def,group,parts,at,ball,box,rod,line,loop,disc,plate,oval,bowl,arrow,beads,spiral,dna,chromosome,membrane,protein,organelleMito,polyhedron,surface,finish};
}

// One static striated-muscle contractile unit. Curved continuous filament
// meshes convey topology; molecular outlines, spacing and colors are symbols.
function sarcomereCell(c){
 const a=c.at;
 c.group.userData.contractileUnit='striated-muscle-sarcomere';
 for(const side of[-1,1]){const disc=c.surface(a('z-discs'),()=>{
  const positions=[],uv=[],index=[],n=20;
  for(let i=0;i<=n;i++)for(let j=0;j<=n;j++){const y=(i/n-.5)*.38,z=(j/n-.5)*.27,x=side*.50+.007*Math.sin(i*.92)*Math.sin(j*.71);positions.push(x,y,z);uv.push(i/n,j/n)}
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){const k=i*(n+1)+j;index.push(k,k+1,k+n+1,k+1,k+n+2,k+n+1)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();return g;
 },C.purple);disc.userData.sarcomereBoundary=side<0?'left-Z':'right-Z';}
 for(const y of[-.12,0,.12])for(const z of[-.09,.09])for(const side of[-1,1])for(const phase of[0,Math.PI]){
  const points=[];for(let j=0;j<=64;j++){const t=j/64,angle=t*Math.PI*10+phase;points.push([side*(.5-t*.43),y+.0045*Math.sin(angle),z+.0045*Math.cos(angle)])}
  const strand=c.line(a('thin-filaments'),points,.0046,C.blue,64);strand.userData.anchoredAtZ=side<0?'left-Z':'right-Z';strand.userData.filamentKind='actin-symbol';
 }
 for(const y of[-.06,.06])for(const z of[-.04,.04]){
  const trunk=c.surface(a('thick-filaments'),()=>{
   const positions=[],indices=[],n=64,rings=10;
   for(let i=0;i<=n;i++){const t=i/n,x=-.30+t*.60,r=.011*(.4+.6*Math.sin(Math.PI*t));for(let j=0;j<=rings;j++){const angle=j/rings*Math.PI*2;positions.push(x,y+r*Math.cos(angle),z+r*Math.sin(angle))}}
   for(let i=0;i<n;i++)for(let j=0;j<rings;j++){const k=i*(rings+1)+j;indices.push(k,k+1,k+rings+1,k+1,k+rings+2,k+rings+1)}
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
  },C.red);trunk.userData.filamentKind='bipolar-myosin-symbol';
  for(const x of[-.23,-.155,.155,.23]){const dy=y<0?-.032:.032,dz=z<0?-.036:.036;const head=c.line(a('thick-filaments'),[[x,y,z],[x+(x<0?.014:-.014),y+dy*.50,z+dz*.50],[x+(x<0?.015:-.015),y+dy,z+dz]],.008,C.orange,16);head.userData.crossBridgeHead=true;}
 }
 for(const z of[-.08,0,.08])c.line(a('m-line'),[[0,-.155,z],[.003,0,z+.003],[0,.155,z]],.005,C.cream,32);
 for(const side of[-1,1])for(const y of[-.12,.12]){
  const points=[];for(let i=0;i<=48;i++){const t=i/48;points.push([side*(.49-t*.41),y+.008*Math.sin(t*Math.PI*10),.099+.005*Math.cos(t*Math.PI*10)])}
  c.line(a('troponin-tropomyosin'),points,.0036,C.green,48);
  for(const x of[.16,.31,.45])c.ball(a('troponin-tropomyosin'),[side*x,y+.004,.108],[.009,.008,.009],C.purple);
 }
 for(const x of[-.31,-.16,.16,.31]){const ion=c.ball(a('calcium'),[x,.162,.112],[.010,.010,.010],C.gold);ion.userData.symbolOf='Ca2+';}
 // ATP is explicitly a molecular symbol beside an enlarged myosin head.
 c.line(a('atp-cycle'),[[.14,-.178,.10],[.15,-.214,.11],[.23,-.218,.10],[.245,-.180,.10]],.009,C.orange,32);
 for(const x of[.28,.308,.336])c.ball(a('atp-cycle'),[x,-.208,.11],[.011,.010,.010],C.gold);
 c.rod(a('atp-cycle'),[.244,-.20,.11],[.28,-.208,.11],.004,C.cream);
 a('atp-cycle').userData.symbolOf='ATP-and-enlarged-myosin-head';
}
// A single curved branching outline forms the cell's continuous cutaway shell.
// Internal networks remain separately selectable. Colors and channel symbols
// are educational; the exposed face is an intentional section, not a lesion.
function cardiomyocyte(c){
 const a=c.at;
 c.group.userData.cellType='contractile-ventricular-cardiomyocyte';
 const shell=c.surface(a('sarcolemma'),()=>{
  const s=new THREE.Shape();s.moveTo(-.62,-.085);
  s.bezierCurveTo(-.62,-.16,-.54,-.19,-.43,-.185);
  s.bezierCurveTo(-.20,-.19,.13,-.18,.34,-.15);
  s.bezierCurveTo(.47,-.15,.58,-.17,.62,-.095);
  s.bezierCurveTo(.66,-.015,.56,.035,.47,.035);
  s.bezierCurveTo(.40,.033,.37,.075,.405,.15);
  s.bezierCurveTo(.45,.24,.58,.315,.565,.385);
  s.bezierCurveTo(.55,.445,.47,.455,.425,.415);
  s.bezierCurveTo(.36,.34,.33,.23,.235,.19);
  s.bezierCurveTo(.09,.155,-.22,.185,-.43,.17);
  s.bezierCurveTo(-.56,.16,-.64,.095,-.62,-.085);s.closePath();
  const full=new THREE.ExtrudeGeometry(s,{depth:.21,steps:1,bevelEnabled:true,bevelThickness:.025,bevelSize:.022,bevelSegments:3,curveSegments:20});
  full.translate(0,0,-.145);
  // Remove the planar front cap, retain curved bevel, side wall and back.
  const source=full.index?full.toNonIndexed():full,position=source.getAttribute('position'),normal=source.getAttribute('normal');
  const positions=[],normals=[];
  for(let i=0;i<position.count;i+=3){if([0,1,2].every(j=>normal.getZ(i+j)>.999))continue;for(let j=0;j<3;j++){positions.push(position.getX(i+j),position.getY(i+j),position.getZ(i+j));normals.push(normal.getX(i+j),normal.getY(i+j),normal.getZ(i+j))}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));full.dispose();if(source!==full)source.dispose();return g;
 },C.pink);shell.userData.continuousBranchedShell=true;shell.userData.cutawayFace='+Z';

 const fibrils=[
  [[-.53,-.125,-.01],[-.23,-.128,-.006],[.12,-.115,0],[.51,-.090,0]],
  [[-.54,-.075,.006],[-.25,-.080,.013],[.12,-.06,.012],[.54,-.045,.015]],
  [[-.52,.115,-.01],[-.20,.13,0],[.15,.12,.005],[.27,.16,.012]],
  [[-.53,.055,.005],[-.32,.058,.012],[-.21,.050,.018]],
  [[.07,.049,.012],[.19,.066,.018],[.26,.10,.018]],
  [[.25,.15,.00],[.33,.22,.010],[.39,.32,.006],[.47,.393,.006]]
 ];
 for(const points of fibrils){const fibre=c.surface(a('myofibrils'),()=>{
   const curve=new THREE.CatmullRomCurve3(points.map(v),false,'centripetal'),g=new THREE.TubeGeometry(curve,112,.020,10,false),p=g.getAttribute('position'),colors=[];
   for(let i=0;i<p.count;i++){const ring=Math.floor(i/11),phase=(ring/112*10)%1,color=new THREE.Color(phase<.065?C.purple:phase<.32||phase>.82?C.cream:C.red);colors.push(color.r,color.g,color.b)}g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));return g;
  },0xffffff,true);fibre.userData.sarcomereBands=true;fibre.userData.longitudinalContractileBundle=true;}

 c.ball(a('nucleus'),[-.10,.008,.022],[.115,.067,.045],C.purple);
 c.ball(a('nucleus'),[-.12,.014,.061],[.023,.017,.010],C.dark);
 for(const p of[[-.37,-.012,.035],[.09,-.010,.040],[.25,-.103,.035],[-.27,.098,.033],[.33,.204,.035],[.50,-.08,.032]])c.organelleMito(a('mitochondria'),p,[.050,.021,.019]);

 const transverse=[-.36,.12,.30];
 for(const x of transverse){const t=c.line(a('t-tubules'),[[x,.154,.03],[x+.005,.108,.05],[x-.002,.012,.062],[x+.005,-.092,.041],[x,-.155,.014]],.012,C.blue,48);t.userData.sarcolemmaInvagination=true;}
 for(const y of[-.147,.144])c.line(a('sarcoplasmic-reticulum'),[[-.49,y,.014],[-.31,y-.004,.025],[-.16,y+.004,.020],[.04,y,.022],[.22,y-.014,.022],[.40,y-.025,.025]],.008,C.green,64);
 for(const x of transverse){const sr=c.line(a('sarcoplasmic-reticulum'),[[x+.035,.136,.024],[x+.037,.072,.070],[x+.039,-.010,.072],[x+.035,-.12,.023]],.015,C.green,48);sr.userData.dyadPartner=true;}
 c.line(a('sarcoplasmic-reticulum'),[[.25,.14,.012],[.315,.205,.018],[.365,.30,.022],[.43,.39,.016]],.007,C.green,40);
 for(const x of transverse){const l=c.ball(a('calcium-channels'),[x+.007,.070,.081],[.012,.018,.011],C.gold);l.userData.channelType='L-type';const ry=c.ball(a('calcium-channels'),[x+.034,.070,.096],[.016,.016,.011],C.orange);ry.userData.channelType='RyR2';}
 for(const p of[[-.28,-.145,.033],[.19,.135,.037]]){const pump=c.ball(a('calcium-pump'),p,[.016,.020,.011],C.purple);pump.userData.transporter='SERCA';c.rod(a('calcium-pump'),[p[0],p[1]-.025,p[2]],[p[0],p[1]+.025,p[2]],.004,C.gold);}

 const boundaries=[
  [[-.554,-.135,.062],[-.566,-.082,.070],[-.548,-.03,.070],[-.562,.014,.070],[-.54,.065,.070],[-.549,.115,.062]],
  [[.414,.383,.066],[.437,.366,.070],[.448,.390,.075],[.472,.377,.070],[.481,.399,.064]]
 ];
 for(const points of boundaries){const disc=c.line(a('intercalated-disc'),points,.014,C.dark,48);disc.userData.cellBoundary=true;disc.userData.adjoiningCellInterface=true;}
 // Enlarged junction patches stay on the exposed terminal boundary.
 for(const y of[-.08,-.045,.018])c.rod(a('gap-junctions'),[-.585,y,.085],[-.535,y,.085],.008,C.blue);
 a('gap-junctions').userData.electricalJunction=true;
 for(const y of[-.113,.060,.10]){for(const x of[-.576,-.543])c.ball(a('anchoring-junctions'),[x,y,.086],[.010,.016,.009],C.orange);c.rod(a('anchoring-junctions'),[-.58,y,.087],[-.538,y,.087],.004,C.gold);}
 a('anchoring-junctions').userData.mechanicalJunction=true;
}
















































const BUILDERS={cardiomyocyte,sarcomere:sarcomereCell};
export async function createCytologyModel(id,suppliedDefinition,{mobile=false}={}){if(!CYTOLOGY_IDS.includes(id))throw new RangeError('Vista de citologia inexistente: '+id);const def=await getDefinition(id,suppliedDefinition);if(!def)throw new RangeError('Definição de citologia inexistente: '+id);if(hasRealCytology(id)){try{return await createRealCytologyModel(id,def,{mobile})}catch(error){console.warn('Modelo real indisponível; usando o modelo autoral.',error)}}const rebuilt=createDetailedOrganelleModel(id,def,{mobile})||createDetailedProcessModel(id,def,{mobile});if(rebuilt)return rebuilt;const c=context(def),build=BUILDERS[id];if(!build)throw Error('Geometria em elaboração: '+id);build(c);return c.finish()}
