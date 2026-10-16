import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Continuous, static teaching reconstructions. Molecular surfaces, arrows and
// phase comparisons are explanatory symbols, not microscopy or atomistic data.
export const DETAILED_PROCESS_IDS=Object.freeze(['biomolecules-water','carbohydrates-lipids','proteins-enzymes','nucleic-acids','diffusion-facilitated','osmosis-tonicity','active-transport','endocytosis-exocytosis','glycolysis-fermentation','krebs-cycle','oxidative-phosphorylation','light-reactions','calvin-cycle','dna-replication','transcription-rna','translation-protein','gene-regulation','cell-cycle','mitosis','meiosis','gametogenesis','cell-signaling','apoptosis-cancer','cell-differentiation']);
const C={membrane:0xc99bac,matrix:0xb6cebf,protein:0x8e9fbe,enzyme:0x9b89b6,chromatin:0x9276aa,filament:0xce9b82,lipid:0xd2b789,green:0x8db69a,blue:0x82a8c4,red:0xc37f88,gold:0xd7bb7f,light:0xe2d8c3,dark:0x655878};
const TAU=Math.PI*2,V=p=>new THREE.Vector3(...p);

function grid(fn,nu,nv){
 const p=[],uv=[],idx=[];for(let i=0;i<=nu;i++)for(let j=0;j<=nv;j++){p.push(...fn(i/nu,j/nv));uv.push(i/nu,j/nv)}
 for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){const k=i*(nv+1)+j;idx.push(k,k+1,k+nv+1,k+1,k+nv+2,k+nv+1)}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
function join(geometries){
 if(geometries.length===1)return geometries[0];
 for(const g of geometries)if(!g.index)g.setIndex(Array.from({length:g.attributes.position.count},(_,i)=>i));
 const result=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());if(!result)throw Error('Superfícies citológicas incompatíveis');return result;
}
function organicGeometry(p,size,mobile,{phase=0,cavity=0,flatten=1}={}){
 const n=mobile?24:40,m=mobile?14:24,positions=[],uv=[],idx=[];
 for(let i=1;i<m;i++){const phi=i/m*Math.PI;for(let j=0;j<=n;j++){
  const a=j/n*TAU,rough=.065*Math.sin(a*3+phase)*Math.sin(phi)**2+.035*Math.cos(phi*5-a*2+phase),front=Math.exp(-(((a-Math.PI*.5)/.43)**2+((phi-Math.PI*.5)/.54)**2)),r=1+rough-cavity*front;
  positions.push(p[0]+size[0]*r*Math.sin(phi)*Math.cos(a),p[1]+size[1]*r*Math.cos(phi),p[2]+size[2]*r*Math.sin(phi)*Math.sin(a)*flatten);uv.push(j/n,i/m);
 }}
 const north=positions.length/3;positions.push(p[0],p[1]+size[1],p[2]);uv.push(.5,0);const south=positions.length/3;positions.push(p[0],p[1]-size[1],p[2]);uv.push(.5,1);
 for(let i=0;i<m-2;i++)for(let j=0;j<n;j++){const k=i*(n+1)+j;idx.push(k,k+1,k+n+1,k+1,k+n+2,k+n+1)}
 for(let j=0;j<n;j++){idx.push(north,j+1,j);const k=(m-2)*(n+1)+j;idx.push(south,k,k+1)}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
function shellGeometry(p,size,mobile,thickness=.008,ruffle=0){
 const n=mobile?44:72,m=mobile?12:20,geos=[];
 const point=(t,s,inset)=>{const a=s*TAU,lat=t*Math.PI*.5,f=1+ruffle*(.6*Math.sin(a*7)+.4*Math.cos(a*11))*Math.cos(lat);return[p[0]+(size[0]-inset)*Math.cos(lat)*Math.cos(a)*f,p[1]+(size[1]-inset)*Math.cos(lat)*Math.sin(a)*f,p[2]-(size[2]-inset)*Math.sin(lat)]};
 for(const inset of[0,thickness])geos.push(grid((t,s)=>point(t*.999,s,inset),m,n));
 geos.push(grid((t,s)=>{const a=point(0,t,0),b=point(0,t,thickness);return a.map((x,i)=>x+(b[i]-x)*s)},n,2));
 return join(geos);
}
function poreGeometry(p,size,mobile,{sealed=false,phase=0}={}){
 const n=mobile?36:64,m=mobile?14:24,geos=[];
 const point=(t,s,inside)=>{const a=s*TAU,y=(t-.5)*size[1]*2,r=(inside?.35:1)*(1+.10*Math.cos(a*5+phase)+.12*Math.sin(t*Math.PI*3));return[p[0]+size[0]*r*Math.cos(a),p[1]+y,p[2]+size[2]*r*Math.sin(a)]};
 geos.push(grid((t,s)=>point(t,s,false),m,n),grid((t,s)=>point(t,s,true),m,n));
 for(const t of[0,1])geos.push(grid((s,u)=>{const a=point(t,s,false),b=point(t,s,true);return a.map((x,i)=>x+(b[i]-x)*u)},n,3));
 if(sealed)geos.push(grid((s,u)=>{const a=s*TAU,r=u*.35;return[p[0]+size[0]*r*Math.cos(a),p[1],p[2]+size[2]*r*Math.sin(a)]},n,8));
 const g=join(geos);g.userData={continuousPore:true,closedExample:sealed};return g;
}
function membraneGeometry(p,width,depth,mobile,holes=[]){
 const shape=new THREE.Shape(),w=width*.5,d=depth*.5,r=.035;
 shape.moveTo(-w+r,-d);shape.lineTo(w-r,-d);shape.quadraticCurveTo(w,-d,w,-d+r);shape.lineTo(w,d-r);shape.quadraticCurveTo(w,d,w-r,d);shape.lineTo(-w+r,d);shape.quadraticCurveTo(-w,d,-w,d-r);shape.lineTo(-w,-d+r);shape.quadraticCurveTo(-w,-d,-w+r,-d);
 for(const h of holes){const hole=new THREE.Path();hole.absellipse(h[0]-p[0],h[1]-p[2],h[2],h[3]||h[2],0,TAU,true);shape.holes.push(hole)}
 const g=new THREE.ExtrudeGeometry(shape,{depth:.018,steps:1,bevelEnabled:true,bevelThickness:.004,bevelSize:.004,bevelSegments:2,curveSegments:mobile?10:20});g.rotateX(-Math.PI/2);g.translate(...p);return g;
}

function context(def,mobile){
 const group=new THREE.Group(),parts=def.parts.map(p=>({...p,object:new THREE.Group()})),geometries=new Set(),materials=new Map();let disposed=false;
 group.name='CYTOLOGY_'+def.id;group.userData={cytology:true,cytologyId:def.id,schematic:true,educational:true,notRealHistology:true,authoredReconstruction:true,continuousReconstruction:true,mobile};
 for(const part of parts){part.object.name='CYTO_'+def.id+'_'+part.id;part.object.userData={partId:part.id,cytology:true};group.add(part.object)}
 const contextual=new THREE.Group();contextual.name='CYTO_CONTEXT_'+def.id;contextual.userData={contextOnly:true,notSelectable:true};group.add(contextual);
 const at=id=>{const part=parts.find(p=>p.id===id);if(!part)throw Error('Parte citológica inexistente '+def.id+'/'+id);return part.object};
 const parent=p=>p==='$context'?contextual:typeof p==='string'?at(p):p;
 const add=(part,geometry,color=C.protein,role='protein',metadata={})=>{
  const target=parent(part),partId=target.userData.partId||target.userData.rootPartId,key=color+':'+role;
  if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:.69,metalness:0,side:THREE.DoubleSide,forceSinglePass:true}));
  geometries.add(geometry);const mesh=new THREE.Mesh(geometry,materials.get(key));mesh.userData={cytology:true,schematic:true,educational:true,cytologyTissue:role,partId,...metadata};target.add(mesh);return mesh;
 };
 const note=(part,metadata)=>{const object=new THREE.Group(),p=parent(part);object.userData={rootPartId:p.userData.partId||p.userData.rootPartId,...metadata};p.add(object);return object};
 const blob=(part,p,size,color=C.protein,role='protein',options={})=>add(part,organicGeometry(p,size,mobile,options),color,role,{geometryKind:options.cavity?'sculpted-active-cleft':'organic-molecular-surface'});
 const curve=(part,points,r=.009,color=C.filament,role='filament',segments=mobile?40:72,closed=false)=>{const path=new THREE.CatmullRomCurve3(points.map(V),closed,'centripetal');return add(part,new THREE.TubeGeometry(path,segments,r,mobile?6:10,closed),color,role,{geometryKind:'continuous-curved-network'})};
 const shell=(part,p,size,color=C.membrane,role='membrane',ruffle=0)=>add(part,shellGeometry(p,size,mobile,Math.min(...size)*.08,ruffle),color,role,{geometryKind:'continuous-cut-cell-shell',openFace:'+Z'});
 const membrane=(part,p=[0,0,0],width=.94,depth=.30,holes=[])=>{for(const side of[-1,1])add(part,membraneGeometry([p[0],p[1]+side*.027,p[2]],width,depth,mobile,holes),side>0?C.membrane:C.lipid,'membrane',{geometryKind:'bilayer-with-inserted-protein-openings',leaflet:side});};
 const pore=(part,p,size=[.08,.13,.08],color=C.protein,sealed=false)=>add(part,poreGeometry(p,size,mobile,{sealed}),color,'protein',{geometryKind:'membrane-spanning-protein',membraneCenter:p[1]});
 const ribbon=(part,points,width=.015,color=C.gold,role='filament')=>{
  const path=new THREE.CatmullRomCurve3(points.map(V),false,'centripetal'),g=grid((t,s)=>{const p=path.getPoint(t),n=path.getTangent(t),reference=Math.abs(n.z)>.90?new THREE.Vector3(0,1,0):new THREE.Vector3(0,0,1),side=n.clone().cross(reference).normalize();return p.addScaledVector(side,(s-.5)*width).toArray()},mobile?28:48,3);return add(part,g,color,role,{geometryKind:'continuous-ribbon'});
 };
 const arrow=(part,a,b,color=C.gold)=>{
  const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy),perp=[-dy/length,dx/length],n=.012,head=.055,back=[b[0]-dx/length*head,b[1]-dy/length*head],pts=[[a[0]+perp[0]*n,a[1]+perp[1]*n],[back[0]+perp[0]*n,back[1]+perp[1]*n],[back[0]+perp[0]*n*2.7,back[1]+perp[1]*n*2.7],[b[0],b[1]],[back[0]-perp[0]*n*2.7,back[1]-perp[1]*n*2.7],[back[0]-perp[0]*n,back[1]-perp[1]*n],[a[0]-perp[0]*n,a[1]-perp[1]*n]],shape=new THREE.Shape();shape.moveTo(...pts[0]);pts.slice(1).forEach(p=>shape.lineTo(...p));shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth:.004,bevelEnabled:false});g.translate(0,0,a[2]||0);add(part,g,color,'filament',{symbolicArrow:true});note(part,{directionArrow:true,from:[...a],to:[...b]});
 };
 const molecule=(part,p,size=.04,color=C.gold,style='ring')=>{
  if(style==='ring'){const pts=Array.from({length:24},(_,i)=>{const a=i/24*TAU,r=size*(1+.05*Math.sin(a*3));return[p[0]+r*Math.cos(a),p[1]+r*Math.sin(a),p[2]+size*.18*Math.sin(a*2)]});curve(part,pts,size*.18,color,'protein',mobile?32:56,true)}
  else blob(part,p,[size,size*.72,size*.65],color,'matrix',{phase:p[0]*17});
 };
 const dna=(part,p,length=.55,radius=.045,pairsPart=part,axis='y')=>{
  const xyz=(t,x,z)=>axis==='y'?[p[0]+x,p[1]+length*(t-.5),p[2]+z]:[p[0]+length*(t-.5),p[1]+x,p[2]+z];
  for(const side of[0,1]){const points=[];for(let i=0;i<=96;i++){const t=i/96,a=t*TAU*2.5+side*Math.PI;points.push(xyz(t,radius*Math.cos(a),radius*Math.sin(a)))}curve(part,points,.007,side?C.filament:C.blue,'chromatin',mobile?72:128)}
  for(let i=0;i<16;i++){const t=(i+.5)/16,a=t*TAU*2.5;ribbon(pairsPart,[xyz(t,radius*Math.cos(a),radius*Math.sin(a)),xyz(t,-radius*Math.cos(a),-radius*Math.sin(a))],.010,i%2?C.green:C.gold,'chromatin')}
 };
 const cell=(part,p,rx=.14,ry=.12,ruffle=0)=>shell(part,p,[rx,ry,Math.min(rx,ry)*.48],C.membrane,'membrane',ruffle);
 const chromosome=(part,p,length=.10,color=C.chromatin,duplicated=true,options={})=>{
  const marker=note(part,{chromosome:true,chromatidCount:duplicated?2:1,illustrativeChromosomes:true,...options}),geos=[];
  for(const side of duplicated?[-1,1]:[0]){const points=[];for(let i=0;i<=32;i++){const t=i/32,y=length*(t-.5),arm=side*.014*(.2+Math.abs(t-.5)*1.6);points.push([p[0]+arm+.003*Math.sin(t*Math.PI*6),p[1]+y,p[2]+.003*Math.sin(t*Math.PI*3)])}geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(V)),mobile?22:36,length*.067,mobile?6:10,false))}
  if(duplicated)geos.push(organicGeometry(p,[length*.10,length*.08,length*.085],mobile,{phase:2}));
  const mesh=add(marker,join(geos),color,'chromatin',{geometryKind:'continuous-folded-chromatids'});return{marker,mesh};
 };
 const spindle=(part,p,targets)=>{for(const side of[-1,1])for(const target of targets)curve(part,[[p[0]+side*.12,p[1],p[2]-.014],[p[0]+side*.06,(p[1]+target[1])*.5,p[2]-.005],target],.002,C.green,'filament',mobile?16:28)};
 const finish=()=>{
  // Consolidate same-role surfaces within each selected part. Metadata groups
  // retain chromosome/arrow meaning while reducing actual rendering calls.
  for(const part of parts){const bins=new Map();part.object.traverse(o=>{if(!o.isMesh)return;const key=o.material.uuid+':'+o.userData.cytologyTissue;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(o)});if(!bins.size)throw Error('Parte sem superfície '+def.id+'/'+part.id);
   for(const meshes of bins.values()){
    if(meshes.length===1)continue;const first=meshes[0],merged=join(meshes.map(o=>o.geometry));meshes.forEach(o=>{geometries.delete(o.geometry);o.removeFromParent()});geometries.add(merged);const mesh=new THREE.Mesh(merged,first.material);mesh.userData={...first.userData,mergedSurfaces:meshes.length};part.object.add(mesh);
   }
   part.object.traverse(o=>{o.userData={...o.userData,partId:part.id,atlasName:part.object.name,cytology:true,schematic:true,educational:true,authoredReconstruction:true}});
  }
  group.updateMatrixWorld(true);const initial=new THREE.Box3().setFromObject(group),center=initial.getCenter(new THREE.Vector3()),size=initial.getSize(new THREE.Vector3()),scale=1.2/Math.max(...size.toArray());group.scale.setScalar(scale);group.position.copy(center.multiplyScalar(-scale));group.updateMatrixWorld(true);
  let triangles=0,meshes=0,vertices=0,geometryBytes=0;group.traverse(o=>{if(!o.isMesh)return;meshes++;vertices+=o.geometry.attributes.position.count;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;for(const a of Object.values(o.geometry.attributes))geometryBytes+=a.array.byteLength;geometryBytes+=o.geometry.index?.array.byteLength||0});
  return{id:def.id,title:def.title||def.label,label:def.label||def.title,description:def.description,limits:def.limits,sourceIds:def.sourceIds||[],group,parts,bounds:new THREE.Box3().setFromObject(group),authoredReconstruction:true,anatomicalReference:false,preserveMaterials:false,stats:{parts:parts.length,meshes,triangles,vertices,geometryBytes,materials:materials.size,geometries:geometries.size,quality:mobile?'adaptativa para toque':'detalhada',continuousReconstruction:true},dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const g of geometries){g.disposeBoundsTree?.();g.dispose()}for(const m of materials.values())m.dispose();group.clear();geometries.clear();materials.clear()}};
 };
 return{def,mobile,group,parts,at,add,note,blob,curve,shell,membrane,pore,ribbon,arrow,molecule,dna,cell,chromosome,spindle,finish};
}

function water(c){
 const mol=(part,x,y,z,scale=1)=>{c.blob(part,[x,y,z],[.045*scale,.040*scale,.036*scale],C.red,'matrix',{phase:x*9});for(const side of[-1,1])c.blob(part,[x+side*.043*scale,y+.031*scale,z],[.027*scale,.026*scale,.025*scale],C.light,'matrix',{phase:side});};
 mol('water',-.31,.19,.015,1.1);mol('water',-.09,.12,.012,.8);
 c.arrow('polarity',[-.45,.30,.09],[-.25,.07,.09],C.blue);
 for(let i=0;i<5;i++)c.curve('hydrogen-bonds',[[-.24+i*.022,.16,.045],[-.23+i*.022,.16,.045]],.004,C.green,'filament',8);
 c.blob('ions',[.27,.13,.015],[.04,.043,.036],C.enzyme,'matrix');
 for(let i=0;i<6;i++){const a=i/6*TAU;mol('hydration',.27+.125*Math.cos(a),.13+.125*Math.sin(a),.025,.38)}
 c.shell('temperature',[-.17,-.25,0],[.27,.12,.07],C.blue,'matrix');for(let i=0;i<3;i++)c.curve('temperature',Array.from({length:20},(_,j)=>[-.38+j*.023,-.23+i*.025+.008*Math.sin(j*.7),.025]),.004,C.light,'filament');
}
function carbohydrates(c){
 c.molecule('monosaccharide',[-.34,.24,.025],.065,C.green);
 for(let i=0;i<5;i++){c.molecule('polysaccharide',[-.42+i*.095,.015,.025],.041,C.gold);if(i)c.curve('polysaccharide',[[-.42+(i-1)*.095,.015,.025],[-.42+i*.095,.015,.025]],.005,C.filament)}
 c.curve('triglyceride',[[.12,.11,0],[.11,.21,.02],[.13,.32,0]],.011,C.filament,'lipid');
 for(let i=0;i<3;i++)c.curve('triglyceride',[[.12,.12+i*.09,0],[.23,.15+i*.09,.02],[.36,.13+i*.09,-.01],[.48,.15+i*.09,.01]],.009,C.lipid,'lipid');
 c.blob('phospholipid',[.07,-.18,.02],[.035,.029,.027],C.blue,'membrane');for(const side of[-1,1])c.curve('phospholipid',[[.07+side*.01,-.20,.02],[.07+side*.02,-.28,.025],[.07+side*.017,-.35,.015]],.007,C.lipid,'lipid');
 for(let i=0;i<4;i++)c.molecule('cholesterol',[.27+(i%2)*.065,-.18-Math.floor(i/2)*.056,.02],.037,C.enzyme);
 c.curve('fatty-acid',[[-.43,-.27,.02],[-.36,-.23,.03],[-.27,-.27,.02],[-.18,-.23,.025],[-.10,-.27,.02]],.011,C.filament,'lipid');c.blob('fatty-acid',[-.45,-.28,.02],[.026,.026,.022],C.red,'lipid');
}
function enzymes(c){
 c.blob('active-site',[0,.025,-.015],[.19,.21,.12],C.green,'protein',{phase:1,cavity:.68});
 c.blob('substrate',[0,.11,.12],[.052,.060,.026],C.gold,'protein',{phase:3});
 c.blob('cofactor',[-.12,-.01,.08],[.022,.028,.019],C.red,'protein');
 c.blob('amino-acid',[-.37,.25,0],[.045,.038,.026],C.blue,'protein',{phase:1});
 c.curve('peptide-bond',[[-.37,.25,.025],[-.31,.25,.035],[-.26,.28,.025]],.010,C.filament,'protein');
 const folded=Array.from({length:70},(_,i)=>{const t=i/69*TAU*3;return[-.34+.10*Math.cos(t),-.08+.10*Math.sin(t),.03+.05*Math.sin(t*.7)]});c.curve('protein-fold',folded,.022,C.enzyme,'protein');
 c.blob('product',[.29,.14,.04],[.042,.031,.028],C.filament,'protein');c.blob('product',[.38,.11,.04],[.027,.038,.026],C.gold,'protein');
 c.curve('denaturation',[[.16,-.24,.02],[.21,-.18,.035],[.28,-.28,-.005],[.33,-.19,.015],[.43,-.27,.02]],.019,C.enzyme,'protein');
}
function nucleic(c){
 c.dna('dna-double-helix',[-.24,.02,0],.70,.057,'bases');
 c.curve('rna-strand',Array.from({length:45},(_,i)=>[.03+.025*Math.sin(i*.45),.33-i*.015,.012+.016*Math.cos(i*.4)]),.011,C.green,'chromatin');
 c.molecule('nucleotide',[.29,.23,.02],.036,C.blue);c.molecule('nucleotide',[.39,.24,.015],.032,C.green);c.curve('nucleotide',[[.24,.23,.02],[.33,.23,.02],[.38,.24,.015]],.008,C.filament,'chromatin');
 c.curve('phosphodiester-bond',[[.28,-.04,.02],[.26,.02,.03],[.29,.11,.02]],.011,C.filament,'chromatin');
 c.arrow('directionality',[-.42,-.32,.09],[-.42,.33,.09],C.light);
 c.ribbon('complementary-bases',[[.19,-.25,.03],[.29,-.25,.04],[.39,-.25,.03]],.034,C.gold,'chromatin');
}
function diffusion(c){
 c.membrane('bilayer',[0,0,-.01],.97,.27,[[-.17,0,.090],[.24,0,.082]]);
 c.pore('channel',[-.17,0,0],[.083,.14,.084],C.blue);c.pore('carrier',[.24,0,0],[.076,.14,.08],C.enzyme,true);
 for(let i=0;i<9;i++)c.blob('extracellular-solute',[-.40+(i%5)*.17,.24+Math.floor(i/5)*.085,.02],[.017,.020,.015],C.filament,'matrix');
 c.arrow('concentration-gradient',[-.41,.30,.12],[-.41,-.28,.12],C.gold);c.arrow('channel',[-.17,.24,.10],[-.17,-.24,.10],C.blue);c.arrow('carrier',[.24,.24,.10],[.24,-.24,.10],C.enzyme);
 c.shell('cytosol',[0,-.30,-.06],[.44,.10,.10],C.matrix,'matrix');
}
function osmosis(c){
 for(const[key,x,rx,ry,wrinkle]of[['hypotonic-cell',-.34,.16,.17,0],['isotonic-cell',0,.135,.14,0],['hypertonic-cell',.34,.095,.118,.075]])c.cell(key,[x,-.04,0],rx,ry,wrinkle);
 for(const x of[-.34,0,.34]){
  c.shell('semipermeable-membrane',[x,-.04,.006],[.105,.11,.049],C.blue,'membrane');
  for(let i=0;i<3;i++)c.blob('intracellular-solute',[x-.036+i*.036,-.04,.035],[.010,.012,.009],C.gold,'matrix');
  c.blob('extracellular-water',[x,.24,.03],[.016,.014,.013],C.blue,'matrix');
 }
 c.arrow('extracellular-water',[-.34,.25,.08],[-.34,.135,.08],C.blue);c.arrow('extracellular-water',[.34,.09,.08],[.34,.24,.08],C.blue);
 c.arrow('extracellular-water',[-.023,.24,.08],[-.023,.12,.08],C.blue);c.arrow('extracellular-water',[.023,.12,.08],[.023,.24,.08],C.blue);
}
function active(c){
 // Both transporters sit in one contextual bilayer assigned to the pump.
 c.membrane('$context',[0,0,-.01],.96,.26,[[-.22,0,.09],[.22,0,.083]]);
 c.pore('pump',[-.22,0,0],[.083,.14,.083],C.enzyme,true);c.pore('cotransporter',[.22,0,0],[.076,.13,.078],C.green);
 c.arrow('solute-gradient',[-.45,-.26,.12],[-.45,.27,.12],C.filament);
 c.molecule('atp',[-.12,-.30,.04],.027,C.gold);c.curve('atp',[[-.09,-.30,.04],[-.055,-.30,.04],[-.02,-.30,.04]],.009,C.gold,'protein');
 for(let i=0;i<3;i++){c.blob('sodium',[-.28+i*.060,.24,.025],[.013,.014,.012],C.filament,'matrix');c.arrow('sodium',[-.28+i*.06,-.18,.13],[-.28+i*.06,.17,.13],C.filament)}
 for(let i=0;i<2;i++){c.blob('potassium',[-.25+i*.064,-.25,.025],[.014,.015,.013],C.blue,'matrix');c.arrow('potassium',[-.25+i*.064,.18,.16],[-.25+i*.064,-.16,.16],C.blue)}
 for(let i=0;i<5;i++)c.blob('proton-gradient',[.12+i*.052,.24,.04],[.009,.011,.008],C.red,'matrix');
 c.arrow('cotransporter',[.19,.22,.14],[.19,-.22,.14],C.red);c.arrow('cotransporter',[.26,.22,.14],[.26,-.22,.14],C.gold);
}
function vesicles(c){
 const points=[];for(let i=0;i<=80;i++){const x=-.5+i/80,well=-.12*Math.exp(-(((x+.22)/.075)**2));points.push([x,.13+well,.015])}c.curve('plasma-membrane',points,.018,C.membrane,'membrane');
 c.shell('coated-pit',[-.22,.08,.012],[.085,.078,.056],C.blue,'membrane');
 for(let i=0;i<5;i++){const a=Math.PI+i/4*Math.PI;c.curve('coated-pit',[[-.22+.09*Math.cos(a-.15),.08+.09*Math.sin(a-.15),.02],[-.22+.10*Math.cos(a),.08+.10*Math.sin(a),.035],[-.22+.09*Math.cos(a+.15),.08+.09*Math.sin(a+.15),.02]],.004,C.dark,'protein')}
 c.shell('endocytic-vesicle',[-.26,-.17,.02],[.075,.073,.06],C.blue,'membrane');c.blob('endocytic-vesicle',[-.26,-.17,.032],[.021,.028,.015],C.gold,'matrix');
 c.shell('lysosome',[-.04,-.23,.02],[.075,.075,.06],C.filament,'membrane');c.blob('lysosome',[-.04,-.23,.04],[.027,.024,.019],C.enzyme,'protein',{cavity:.25});
 c.shell('secretory-vesicle',[.28,-.16,.025],[.077,.075,.06],C.green,'membrane');c.curve('secretory-vesicle',[[.24,-.17,.05],[.28,-.12,.05],[.32,-.16,.05]],.012,C.gold,'protein');
 c.curve('exocytotic-fusion',[[.14,.13,.02],[.17,.012,.02],[.25,-.025,.01],[.34,.008,.02],[.38,.13,.02]],.018,C.green,'membrane');c.arrow('exocytotic-fusion',[.26,-.08,.10],[.26,.30,.10],C.gold);
}

function glycolysis(c){
 c.shell('cytosolic-reactions',[0,.02,-.09],[.51,.34,.13],C.matrix,'matrix');
 const centers=[[-.30,.18],[-.11,.18],[.08,.18]];
 for(let i=0;i<centers.length;i++){const[x,y]=centers[i];c.blob('cytosolic-reactions',[x,y,.01],[.062,.059,.04],C.blue,'protein',{phase:i,cavity:.35});if(i)c.arrow('cytosolic-reactions',[x-.12,y,.10],[x-.055,y,.10],C.gold)}
 c.molecule('glucose',[-.43,.30,.03],.045,C.green);
 for(const y of[.11,.23])c.curve('pyruvate',[[.25,y,.03],[.29,y+.018,.03],[.34,y,.03]],.011,C.filament,'protein');
 c.molecule('atp',[-.12,.33,.04],.026,C.gold);
 c.molecule('nad-nadh',[-.19,-.15,.03],.042,C.enzyme);c.arrow('nad-nadh',[-.26,-.10,.09],[-.10,-.10,.09],C.enzyme);
 c.curve('lactate',[[.20,-.11,.03],[.25,-.09,.03],[.31,-.12,.03]],.013,C.red,'protein');c.arrow('lactate',[.31,.09,.10],[.28,-.055,.10],C.filament);
 c.curve('ethanol-co2',[[.22,-.27,.03],[.29,-.25,.03]],.013,C.green,'protein');c.blob('ethanol-co2',[.40,-.26,.03],[.020,.018,.016],C.filament,'matrix');
}
function krebs(c){
 c.shell('matrix',[0,0,-.09],[.50,.36,.14],C.matrix,'matrix');
 const centers=Array.from({length:6},(_,i)=>{const a=i/6*TAU;return[.22*Math.cos(a),.22*Math.sin(a),.015]});
 c.curve('enzymes',centers,.008,C.blue,'filament',c.mobile?72:128,true);for(let i=0;i<6;i++)c.blob('enzymes',centers[i],[.044,.044,.032],C.blue,'protein',{phase:i,cavity:.3});
 c.curve('acetyl-coa',[[-.44,.28,.03],[-.40,.24,.04],[-.35,.28,.03]],.013,C.filament,'protein');c.molecule('acetyl-coa',[-.45,.23,.02],.029,C.enzyme);
 c.curve('oxaloacetate',[[-.34,.09,.03],[-.30,.12,.03],[-.26,.09,.03],[-.22,.12,.03]],.012,C.green,'protein');
 c.molecule('citrate',[.03,.24,.07],.048,C.gold);
 for(const p of[[.37,.16,.03],[.40,-.01,.03]])c.blob('co2',p,[.020,.016,.015],C.filament,'matrix');
 c.molecule('nadh-fadh2',[-.34,-.21,.03],.034,C.enzyme);c.molecule('substrate-atp',[.05,-.31,.03],.030,C.gold);
}
function oxidative(c){
 c.membrane('inner-membrane',[0,0,-.01],1.0,.27,[[-.33,0,.065],[-.13,0,.065],[.08,0,.065],[.35,0,.075]]);
 c.shell('matrix-intermembrane',[0,-.31,-.07],[.48,.085,.09],C.matrix,'matrix');c.ribbon('matrix-intermembrane',[[-.47,.31,-.08],[0,.32,-.08],[.47,.31,-.08]],.055,C.light,'matrix');
 for(const x of[-.33,-.13,.08]){c.pore('electron-chain',[x,0,0],[.057,.12,.060],C.blue,true);if(x<.06)c.arrow('electron-chain',[x+.067,.03,.13],[x+.13,.03,.13],C.gold);c.arrow('electron-chain',[x,-.20,.11],[x,.20,.11],C.red)}
 c.pore('atp-synthase',[.35,0,0],[.044,.12,.05],C.green);c.blob('atp-synthase',[.35,-.20,.01],[.074,.062,.058],C.green,'protein',{phase:3,cavity:.2});c.curve('atp-synthase',[[.35,-.09,0],[.35,-.20,0]],.016,C.green,'protein');c.arrow('atp-synthase',[.35,.24,.13],[.35,-.16,.13],C.red);
 for(let i=0;i<8;i++)c.blob('proton-gradient',[-.41+i*.10,.26,.035],[.009,.011,.008],C.red,'matrix');
 c.molecule('nadh-fadh2',[-.43,-.23,.04],.033,C.enzyme);c.arrow('nadh-fadh2',[-.40,-.16,.12],[-.34,-.07,.12],C.gold);
 c.blob('oxygen',[.10,-.24,.04],[.032,.019,.017],C.filament,'matrix');c.molecule('atp',[.36,-.33,.04],.028,C.gold);
}
function light(c){
 c.membrane('$context',[0,0,-.01],1.0,.28,[[-.34,0,.073],[.08,0,.073],[.37,0,.060]]);c.shell('thylakoid-lumen',[0,-.27,-.08],[.48,.085,.10],C.matrix,'matrix');
 for(let i=0;i<7;i++)c.blob('thylakoid-lumen',[-.36+i*.10,-.25,.035],[.009,.010,.008],C.red,'matrix');
 c.pore('photosystem-ii',[-.34,0,0],[.067,.12,.07],C.green,true);c.pore('photosystem-i',[.08,0,0],[.067,.12,.07],C.green,true);
 for(const x of[-.34,.08])c.arrow(x<0?'photosystem-ii':'photosystem-i',[x-.08,.31,.11],[x-.015,.12,.11],C.gold);
 for(const x of[-.15,-.04]){c.blob('electron-chain',[x,.01,.025],[.035,.065,.045],C.blue,'protein',{phase:x*9});c.arrow('electron-chain',[x-.047,.04,.12],[x+.046,.04,.12],C.gold)}c.arrow('electron-chain',[-.10,.20,.14],[-.10,-.18,.14],C.red);
 c.blob('nadp-reductase',[.23,.17,.02],[.062,.059,.045],C.enzyme,'protein',{cavity:.4});
 c.pore('atp-synthase',[.37,0,0],[.048,.10,.048],C.filament);c.blob('atp-synthase',[.37,.20,.02],[.069,.056,.053],C.filament,'protein',{phase:2});c.curve('atp-synthase',[[.37,.09,0],[.37,.20,.02]],.015,C.filament,'protein');c.arrow('atp-synthase',[.37,-.23,.13],[.37,.15,.13],C.red);
 c.blob('water-oxygen',[-.43,-.19,.035],[.024,.022,.021],C.blue,'matrix');c.blob('water-oxygen',[-.33,-.31,.04],[.028,.016,.015],C.filament,'matrix');
}
function calvin(c){
 c.shell('stroma',[0,0,-.09],[.49,.35,.13],C.matrix,'matrix');
 c.blob('rubisco',[-.25,.12,.01],[.095,.087,.068],C.green,'protein',{phase:2,cavity:.5});c.blob('co2',[-.43,.27,.04],[.021,.017,.016],C.filament,'matrix');c.arrow('co2',[-.41,.24,.12],[-.31,.16,.12],C.filament);
 c.curve('rubp',[[-.28,.29,.03],[-.23,.31,.03],[-.18,.28,.03],[-.13,.31,.03],[-.08,.28,.03]],.011,C.gold,'protein');
 c.curve('phosphoglycerate',[[.03,.25,.03],[.08,.28,.03],[.13,.25,.03]],.012,C.blue,'protein');
 c.curve('g3p',[[.26,.07,.03],[.31,.09,.03],[.36,.06,.03]],.013,C.green,'protein');c.arrow('g3p',[.36,.06,.12],[.48,.06,.12],C.green);
 c.curve('regeneration',[[.27,-.025,.02],[.17,-.23,.025],[-.12,-.25,.025],[-.29,-.02,.02]],.014,C.gold,'filament');c.arrow('regeneration',[-.29,-.02,.12],[-.26,.045,.12],C.gold);
 c.molecule('atp-nadph',[.02,-.31,.04],.027,C.gold);c.molecule('atp-nadph',[.29,-.23,.04],.035,C.enzyme);
}

function replication(c){
 c.dna('template',[0,.24,0],.32,.043,'template');
 for(const side of[-1,1])c.curve('template',[[side*.043,.08,.005],[side*.10,-.08,.025],[side*.25,-.34,.015]],.009,side<0?C.blue:C.filament,'chromatin');
 c.pore('helicase',[0,.066,.025],[.065,.048,.055],C.enzyme);c.note('helicase',{replicationFork:true});
 for(const p of[[-.11,-.10,.04],[.12,-.12,.04]])c.blob('dna-polymerase',p,[.065,.060,.049],C.enzyme,'protein',{cavity:.65,phase:p[0]*14});
 c.curve('leading-strand',[[-.23,-.34,.055],[-.15,-.18,.055],[-.085,-.035,.055],[-.029,.071,.045]],.009,C.green,'chromatin');
 c.arrow('leading-strand',[-.22,-.29,.13],[-.10,-.065,.13],C.green);c.note('leading-strand',{synthesisDirection:'5-prime-to-3-prime',continuous:true});
 for(let i=0;i<3;i++){
  const x=.075+i*.066,y=-.055-i*.093;c.curve('primer',[[x,y,.066],[x+.018,y-.024,.066]],.011,C.red,'chromatin');
  c.curve('lagging-strand',[[x+.018,y-.024,.066],[x+.048,y-.065,.066],[x+.063,y-.084,.066]],.009,C.green,'chromatin');
 }
 c.arrow('lagging-strand',[.10,-.09,.15],[.21,-.25,.15],C.green);c.note('lagging-strand',{synthesisDirection:'5-prime-to-3-prime',continuous:false,okazakiFragments:3});
 c.blob('ligase',[.216,-.250,.077],[.034,.034,.025],C.gold,'protein',{cavity:.35});
}
function transcription(c){
 c.dna('template',[0,.26,0],.91,.033,'template','x');
 c.ribbon('promoter',[[-.39,.225,.055],[-.31,.22,.06],[-.25,.23,.055]],.035,C.green,'chromatin');
 c.blob('rna-polymerase',[-.035,.245,.035],[.105,.097,.077],C.enzyme,'protein',{cavity:.70,phase:2});
 c.curve('nascent-rna',[[-.02,.19,.10],[.015,.11,.10],[.055,.055,.10]],.011,C.gold,'chromatin');
 c.curve('introns',[[.055,.055,.10],[.12,.09,.12],[.17,.025,.10]],.011,C.red,'chromatin');
 c.curve('nascent-rna',[[.17,.025,.10],[.24,-.025,.08],[.33,.015,.065]],.011,C.gold,'chromatin');
 c.curve('mature-mrna',[[-.30,-.26,.025],[-.10,-.25,.045],[.11,-.27,.025],[.33,-.25,.04]],.012,C.gold,'chromatin');
 c.blob('mature-mrna',[-.32,-.26,.025],[.024,.022,.017],C.blue,'chromatin');
 c.curve('mature-mrna',[[.33,-.25,.04],[.39,-.26,.04],[.45,-.25,.04]],.008,C.filament,'chromatin');
}
function translation(c){
 c.curve('mrna',[[-.49,-.025,.02],[-.25,-.015,.026],[0,-.025,.02],[.25,-.01,.024],[.49,-.025,.02]],.011,C.gold,'chromatin');
 c.blob('ribosome',[0,-.105,.005],[.17,.071,.08],C.blue,'protein',{cavity:.25,phase:1});
 c.blob('ribosome',[0,.105,.008],[.20,.123,.10],C.enzyme,'protein',{cavity:.60,phase:2});
 c.curve('trna',[[0,.035,.13],[.003,.11,.13],[-.042,.145,.13],[-.023,.18,.13],[.007,.16,.13],[.044,.20,.13],[.048,.24,.13],[.01,.26,.13],[0,.31,.13]],.009,C.green,'chromatin');
 c.blob('amino-acid',[0,.326,.135],[.025,.024,.021],C.filament,'protein');
 c.curve('nascent-polypeptide',[[.08,.175,.08],[.11,.23,.10],[.17,.26,.10],[.21,.22,.13],[.27,.27,.10],[.33,.245,.08]],.015,C.filament,'protein');
 c.ribbon('stop-codon',[[.34,-.015,.07],[.39,-.015,.07],[.44,-.02,.07]],.029,C.red,'chromatin');
 c.note('stop-codon',{symbolicCodon:true,notAProtein:true});
}
function regulation(c){
 c.curve('chromatin',[[-.46,.25,0],[-.26,.12,.025],[-.13,-.02,.025],[.06,.08,.025],[.26,.26,0],[.47,.25,0]],.010,C.filament,'chromatin');
 for(const[x,y]of[[-.20,.03],[.005,.025]])c.blob('chromatin',[x,y,-.007],[.052,.045,.038],C.membrane,'protein',{phase:x*11});
 c.ribbon('enhancer',[[-.45,.25,.04],[-.34,.25,.05],[-.26,.23,.05]],.033,C.green,'chromatin');
 c.blob('transcription-factor',[-.31,.30,.06],[.071,.062,.047],C.enzyme,'protein',{cavity:.42,phase:1});
 c.ribbon('promoter',[[.23,.25,.045],[.32,.25,.055],[.40,.25,.045]],.031,C.blue,'chromatin');
 for(let i=0;i<3;i++)c.curve('rna-processing',[[-.43+i*.12,-.19,.04],[-.37+i*.12,-.17,.045],[-.32+i*.12,-.19,.04]],.010,i===1?C.red:C.gold,'chromatin');
 c.curve('mrna-stability',[[.12,-.17,.04],[.25,-.15,.045],[.43,-.17,.04]],.011,C.gold,'chromatin');c.blob('mrna-stability',[.11,-.17,.04],[.021,.020,.016],C.blue,'chromatin');
 c.curve('regulatory-rna',[[.15,-.28,.06],[.24,-.26,.065],[.34,-.28,.06]],.008,C.green,'chromatin');c.blob('regulatory-rna',[.24,-.27,-.006],[.087,.06,.041],C.enzyme,'protein',{cavity:.56});
}
function phaseChromosomes(c,part,p,duplicated=true,count=4,length=.075){
 for(let i=0;i<count;i++){const x=p[0]+(i%2?1:-1)*.042,y=p[1]+(Math.floor(i/2)-(count/4-.5))*.075;c.chromosome(part,[x,y,p[2]+.026],length,i%2?C.filament:C.blue,duplicated,{examplePloidy:'2n=4; contagem ilustrativa, não humana'})}
}
function cycle(c){
 const phases=[['g1',-.34,.20],['s-phase',.20,.22],['g2',.28,-.20],['mitotic-phase',-.29,-.22]];
 for(const[key,x,y]of phases){c.cell(key,[x,y,0],.145,.125);
  if(key==='mitotic-phase')phaseChromosomes(c,key,[x,y,0],true,4,.073);
  else if(key==='s-phase'){c.dna(key,[x-.04,y,.02],.15,.019,key);c.dna(key,[x+.04,y,.02],.15,.019,key)}
  else c.curve(key,Array.from({length:40},(_,i)=>{const a=i/39*TAU*2;return[x+.07*Math.cos(a),y+.06*Math.sin(a),.02+.01*Math.cos(a*2)]}),.006,C.chromatin,'chromatin');
 }
 c.blob('g1-checkpoint',[-.08,.28,.05],[.035,.043,.026],C.red,'protein',{cavity:.3});
 c.blob('g2-checkpoint',[.42,-.015,.05],[.035,.043,.026],C.red,'protein',{cavity:.3});
 c.blob('spindle-checkpoint',[-.15,-.28,.06],[.035,.043,.026],C.red,'protein',{cavity:.3});
 c.note('g1-checkpoint',{functionalControl:true,notPhysicalPhaseCompartment:true});c.note('g2-checkpoint',{functionalControl:true});c.note('spindle-checkpoint',{functionalControl:true});
}
function mitosis(c){
 const positions=[['prophase',-.36,.22],['prometaphase',0,.22],['metaphase',.36,.22],['anaphase',-.36,-.22],['telophase',0,-.22],['cytokinesis',.36,-.22]];
 for(const[key,x,y]of positions){
  const p=[x,y,0];
  if(key==='cytokinesis'){
   for(const side of[-1,1]){const q=[x+side*.083,y,0];c.cell(key,q,.077,.122);phaseChromosomes(c,key,q,false,4,.057)}
  }else{
   c.cell(key,p,.145,.132,key==='telophase'?.035:0);
   if(['prophase','prometaphase'].includes(key))phaseChromosomes(c,key,p,true,4,.078);
   if(key==='metaphase')for(let i=0;i<4;i++)c.chromosome(key,[x,y-.087+i*.058,.03],.050,i%2?C.filament:C.blue,true);
   if(key==='anaphase')for(const side of[-1,1])for(let i=0;i<4;i++)c.chromosome(key,[x+side*.078,y-.080+i*.053,.03],.043,i%2?C.filament:C.blue,false);
   if(key==='telophase')for(const side of[-1,1]){phaseChromosomes(c,key,[x+side*.078,y,0],false,4,.048);c.shell(key,[x+side*.078,y,.006],[.061,.097,.037],C.membrane,'membrane')}
   if(['prometaphase','metaphase','anaphase'].includes(key))c.spindle(key,p,Array.from({length:4},(_,i)=>[x,y-.080+i*.053,.015]));
  }
  c.note(key,{phase:key,illustrativeCount:'2n=4',staticPhaseComparison:true});
  for(const side of[-1,1])c.blob('centrosomes',[x+side*.13,y,.01],[.014,.019,.015],C.green,'filament',{phase:side});
 }
}
function meiosis(c){
 for(const[key,x,y]of[['homolog-pair',-.36,.22],['crossing-over',0,.22],['metaphase-i',.36,.22],['anaphase-i',-.36,-.22]]){
  const p=[x,y,0];c.cell(key,p,.145,.13);
  if(key==='homolog-pair')phaseChromosomes(c,key,p,true,4,.080);
  if(key==='crossing-over'){
   for(const side of[-1,1])c.chromosome(key,[x+side*.031,y,.03],.17,side<0?C.blue:C.filament,true,{homolog:side});
   c.curve(key,[[x-.037,y+.05,.048],[x-.017,y+.02,.065],[x+.018,y-.015,.066],[x+.037,y-.046,.048]],.006,C.filament,'chromatin');
   c.curve(key,[[x+.037,y+.05,.055],[x+.016,y+.015,.075],[x-.015,y-.014,.076],[x-.037,y-.046,.055]],.006,C.blue,'chromatin');
   c.note(key,{crossingOver:'non-sister-chromatids',homologsPaired:true});
  }
  if(key==='metaphase-i'){for(const side of[-1,1])for(const row of[-1,1])c.chromosome(key,[x+side*.027,y+row*.052,.03],.072,side<0?C.blue:C.filament,true);c.spindle(key,p,[[x-.027,y+.052,.02],[x+.027,y-.052,.02]])}
  if(key==='anaphase-i')for(const side of[-1,1])for(const row of[-1,1])c.chromosome(key,[x+side*.084,y+row*.048,.03],.073,side<0?C.blue:C.filament,true);
 }
 for(const side of[-1,1]){const p=[side*.071,-.22,0];c.cell('meiosis-ii',p,.065,.125);for(const row of[-1,1])c.chromosome('meiosis-ii',[p[0],p[1]+row*.052,.028],.071,row<0?C.blue:C.filament,true)}
 c.note('meiosis-ii',{stage:'Duas células n=2, cromossomos duplicados antes da segunda separação'});
 for(let i=0;i<4;i++){const p=[.287+(i%2)*.145,-.145-Math.floor(i/2)*.17,0];c.cell('haploid-products',p,.064,.069);for(const side of[-1,1])c.chromosome('haploid-products',[p[0]+side*.024,p[1],.026],.054,side<0?C.blue:C.filament,false)}
 c.note('haploid-products',{products:4,haploidChromosomes:2,notUniversallyFourEquivalentGametes:true});
}
function gametes(c){
 for(const[key,p,duplicated]of[['spermatogonium',[-.36,.24,0],false],['primary-spermatocyte',[-.07,.24,0],true],['primary-oocyte',[-.36,-.21,0],true]]){c.cell(key,p,.13,.13);phaseChromosomes(c,key,p,duplicated,4,.073)}
 for(let i=0;i<4;i++){const p=[.18+(i%2)*.16,.31-Math.floor(i/2)*.16,0];c.cell('spermatid',p,.064,.066);for(const side of[-1,1])c.chromosome('spermatid',[p[0]+side*.022,p[1],.023],.048,C.chromatin,false)}
 c.blob('sperm',[.48,.23,.005],[.026,.047,.019],C.chromatin,'chromatin',{phase:1});
 c.shell('sperm',[.48,.255,.015],[.027,.027,.015],C.blue,'membrane');
 c.curve('sperm',[[.48,.19,0],[.48,.13,.008],[.50,.045,.01],[.475,-.035,0],[.49,-.10,.01]],.006,C.blue,'filament');
 c.curve('sperm',Array.from({length:40},(_,i)=>{const t=i/39;return[.48+.009*Math.cos(t*TAU*5),.19-.060*t,.009*Math.sin(t*TAU*5)]}),.004,C.filament,'protein');
 const o=[-.025,-.21,0];c.cell('secondary-oocyte',o,.125,.125);for(const side of[-1,1])c.chromosome('secondary-oocyte',[o[0]+side*.040,o[1],.03],.095,side<0?C.blue:C.filament,true);
 for(let i=0;i<3;i++){const p=[.19+i*.102,-.21,0];c.cell('polar-bodies',p,.039,.044);for(const side of[-1,1])c.chromosome('polar-bodies',[p[0]+side*.013,p[1],.018],.026,C.chromatin,false)}
 c.note('polar-bodies',{variableNumber:true,notThreeObligatoryProducts:true});
}
function signaling(c){
 c.membrane('$context',[-.19,.035,-.01],.62,.26,[[-.19,0,.08]]);
 c.pore('receptor',[-.19,.035,0],[.070,.14,.074],C.enzyme,true);
 c.blob('ligand',[-.33,.29,.025],[.043,.041,.035],C.gold,'protein',{phase:2});c.arrow('ligand',[-.30,.245,.13],[-.22,.17,.13],C.gold);
 for(let i=0;i<4;i++)c.blob('second-messenger',[-.18+i*.065,-.15,.04],[.012,.014,.011],C.filament,'matrix');
 for(const x of[.03,.20])c.blob('kinase',[x,-.11,.02],[.059,.058,.044],C.green,'protein',{cavity:.45,phase:x*9});c.arrow('kinase',[.09,-.10,.12],[.15,-.10,.12],C.gold);
 c.shell('transcription-response',[.36,.19,0],[.15,.15,.077],C.membrane,'membrane');c.dna('transcription-response',[.36,.19,.025],.20,.025,'transcription-response');
 c.curve('feedback',[[.37,-.03,.04],[.28,-.31,.035],[-.25,-.29,.035],[-.30,-.06,.035]],.010,C.red,'filament');c.ribbon('feedback',[[-.34,-.05,.05],[-.30,-.05,.055],[-.25,-.05,.05]],.014,C.red,'protein');
}
function apoptosis(c){
 c.cell('$context',[-.29,.055,-.015],.155,.16,.025);
 c.arrow('death-signal',[-.49,.33,.10],[-.35,.17,.10],C.red);
 c.blob('caspases',[-.30,.055,.04],[.060,.063,.044],C.enzyme,'protein',{cavity:.56,phase:1});
 for(let i=0;i<4;i++){const p=[-.44+i*.085,-.22+.032*Math.sin(i*2),.02];c.shell('apoptotic-bodies',p,[.036,.041,.026],C.membrane,'membrane');c.curve('apoptotic-bodies',[[p[0]-.011,p[1]-.01,.03],[p[0]+.008,p[1]+.012,.03]],.005,C.chromatin,'chromatin')}
 c.shell('phagocyte',[.035,-.19,-.01],[.12,.115,.067],C.matrix,'membrane',.025);c.curve('phagocyte',[[-.06,-.26,.02],[-.12,-.19,.02],[-.06,-.10,.02]],.013,C.matrix,'membrane');
 for(const p of[[.28,.27,0],[.40,.13,0],[.21,.12,0]]){c.cell('proliferation',p,.080,.079);c.blob('proliferation',[p[0],p[1],.015],[.028,.030,.019],C.chromatin,'chromatin')}
 c.dna('dna-damage',[.28,-.18,.02],.20,.029,'dna-damage');c.curve('dna-damage',[[.22,-.09,.08],[.29,-.16,.08],[.24,-.19,.08],[.33,-.27,.08]],.005,C.red,'chromatin');
 c.blob('checkpoint',[.44,-.22,.03],[.034,.057,.025],C.red,'protein',{cavity:.35});c.note('checkpoint',{functionalControl:true});
}
function differentiation(c){
 c.cell('stem-cell',[-.35,.06,0],.135,.14);c.blob('stem-cell',[-.35,.06,.025],[.050,.047,.032],C.chromatin,'chromatin');
 const nodes=[[-.14,.23,.025],[.025,.065,.025],[-.12,-.13,.025]];c.curve('regulatory-network',nodes,.008,C.green,'filament',c.mobile?48:80,true);for(const p of nodes)c.blob('regulatory-network',p,[.032,.031,.025],C.green,'protein',{cavity:.3});
 c.dna('epigenetic-state',[-.15,-.29,.025],.20,.019,'epigenetic-state','x');for(const x of[-.22,-.15,-.08])c.blob('epigenetic-state',[x,-.265,.048],[.009,.010,.009],C.red,'chromatin');
 const outline=[[-.02,.05,.01],[.02,.17,.01],[.09,.18,.02],[.15,.23,.015],[.23,.18,.01],[.28,.24,.01],[.35,.18,.01]],offset=[.17,.05,0];c.curve('specialized-cell',outline.map(p=>[p[0]+offset[0],p[1]+offset[1],p[2]]),.012,C.membrane,'membrane');
 c.blob('specialized-cell',[.27,.20,.012],[.053,.047,.032],C.chromatin,'chromatin');c.curve('specialized-cell',[[.27,.17,0],[.32,.08,.01],[.45,.11,.015]],.010,C.blue,'filament');
 c.cell('specialized-cell',[.28,-.14,0],.13,.064);for(let i=0;i<6;i++)c.ribbon('specialized-cell',[[.19+i*.030,-.185,.035],[.19+i*.030,-.10,.035]],.006,C.light,'filament');
 c.dna('shared-genome',[-.40,-.27,.025],.15,.022,'shared-genome');c.dna('shared-genome',[.42,-.29,.025],.15,.022,'shared-genome');
 c.shell('microenvironment',[-.36,-.17,-.05],[.19,.035,.05],C.matrix,'matrix');c.arrow('microenvironment',[-.49,.32,.09],[-.39,.20,.09],C.gold);
}

const BUILDERS={'biomolecules-water':water,'carbohydrates-lipids':carbohydrates,'proteins-enzymes':enzymes,'nucleic-acids':nucleic,'diffusion-facilitated':diffusion,'osmosis-tonicity':osmosis,'active-transport':active,'endocytosis-exocytosis':vesicles,'glycolysis-fermentation':glycolysis,'krebs-cycle':krebs,'oxidative-phosphorylation':oxidative,'light-reactions':light,'calvin-cycle':calvin,'dna-replication':replication,'transcription-rna':transcription,'translation-protein':translation,'gene-regulation':regulation,'cell-cycle':cycle,mitosis,meiosis,gametogenesis:gametes,'cell-signaling':signaling,'apoptosis-cancer':apoptosis,'cell-differentiation':differentiation};
export function createDetailedProcessModel(id,definition,{mobile=false}={}){
 if(!DETAILED_PROCESS_IDS.includes(id))return null;
 if(definition?.id!==id||!Array.isArray(definition.parts))throw new TypeError('Definição citológica incompatível: '+id);
 const c=context(definition,mobile);BUILDERS[id](c);return c.finish();
}
