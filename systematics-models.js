import * as THREE from 'three';

// Systematics organisms: geometry is generated in a module worker (systematics-worker.js), so opening a
// model never blocks the page; this module turns the transferred arrays into meshes and materials.
// Materials have no image textures: pigment lives in vertex colours and relief in the geometry itself.
const TISSUES={
 membrane:{roughness:.5,clearcoat:.25,clearcoatRoughness:.45},wall:{roughness:.78},protein:{roughness:.56},granule:{roughness:.6},dna:{roughness:.45,clearcoat:.2,clearcoatRoughness:.5},
 cytosol:{roughness:.82,sheen:.35,sheenRoughness:.7},pellicle:{roughness:.42,clearcoat:.35,clearcoatRoughness:.35},cilium:{roughness:.5},nucleus:{roughness:.55,clearcoat:.15,clearcoatRoughness:.5},
 skin:{roughness:.4,clearcoat:.55,clearcoatRoughness:.3},mucosa:{roughness:.38,clearcoat:.6,clearcoatRoughness:.25},muscle:{roughness:.55,clearcoat:.2,clearcoatRoughness:.45},organ:{roughness:.45,clearcoat:.4,clearcoatRoughness:.35},
 blood:{roughness:.35,clearcoat:.5,clearcoatRoughness:.25},nerve:{roughness:.5,clearcoat:.2},bone:{roughness:.62},cartilage:{roughness:.45,clearcoat:.3},chitin:{roughness:.32,clearcoat:.7,clearcoatRoughness:.18},
 shell:{roughness:.38,clearcoat:.45,clearcoatRoughness:.3},scale:{roughness:.3,clearcoat:.6,clearcoatRoughness:.15,iridescence:.35,iridescenceIOR:1.6},feather:{roughness:.68,sheen:.6,sheenRoughness:.5},fur:{roughness:.85,sheen:.5,sheenRoughness:.6},
 leaf:{roughness:.55,clearcoat:.25,clearcoatRoughness:.4,sheen:.2,sheenRoughness:.5},bark:{roughness:.92},plant:{roughness:.7,sheen:.2,sheenRoughness:.6},petal:{roughness:.6,sheen:.5,sheenRoughness:.4},fungus:{roughness:.86,sheen:.45,sheenRoughness:.55},
 gel:{roughness:.3,clearcoat:.6,clearcoatRoughness:.2},sponge:{roughness:.88,sheen:.3,sheenRoughness:.7},eye:{roughness:.15,clearcoat:1,clearcoatRoughness:.05}
};
function material(tissue){
 const spec=TISSUES[tissue]||{roughness:.6},physical=spec.clearcoat||spec.sheen||spec.iridescence;
 const m=physical?new THREE.MeshPhysicalMaterial({color:0xffffff,vertexColors:true,metalness:0,side:THREE.DoubleSide,...spec}):new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,metalness:0,side:THREE.DoubleSide,roughness:spec.roughness});
 if(spec.sheen)m.sheenColor=new THREE.Color(1,1,1);m.forceSinglePass=true;m.userData={systematicsTissue:tissue,illustrativeColor:true};return m;
}

let worker=null,workerBroken=false,jobs=0;const waiting=new Map();
function getWorker(){
 if(worker||workerBroken)return worker;
 try{worker=new Worker(new URL('./systematics-worker.js',import.meta.url),{type:'module'});
  worker.onmessage=e=>{const w=waiting.get(e.data.job);if(!w)return;waiting.delete(e.data.job);e.data.error?w.reject(new Error(e.data.error)):w.resolve(e.data)};
  worker.onerror=e=>{e.preventDefault?.();workerBroken=true;worker?.terminate();worker=null;for(const w of waiting.values())w.reject(new Error('worker'));waiting.clear()};
 }catch{workerBroken=true;worker=null}
 return worker;
}
async function generate(id,mobile){
 const w=getWorker();
 if(w){try{return await new Promise((resolve,reject)=>{const job=++jobs;waiting.set(job,{resolve,reject});w.postMessage({job,id,mobile})})}catch(error){if(!workerBroken)throw error}}
 // Fallback without module workers: same code on the page (blocks while it builds).
 const {buildOrganism}=await import('./systematics-builders.js');const out=buildOrganism(id,{mobile});return{parts:out.parts,stats:{...out.stats,mainThread:true}};
}

export async function createSystematicsModel(id,definition,{mobile=false}={}){
 if(!definition||definition.id!==id||!Array.isArray(definition.parts))throw new Error('Definição incompatível: '+id);
 const data=await generate(id,mobile),group=new THREE.Group(),geometries=new Set(),materials=new Map();let disposed=false;
 group.name='SYSTEMATICS_'+id;group.userData={systematics:true,educational:true,authoredReconstruction:true,organismId:id};
 const parts=[];let triangles=0;
 for(const def of definition.parts){
  const object=new THREE.Group();object.name='SYST_'+id+'_'+def.id;object.userData={partId:def.id,systematics:true};group.add(object);
  const meshes=data.parts[def.id]||[];
  for(const m of meshes){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(m.position,3));g.setAttribute('normal',new THREE.BufferAttribute(m.normal,3));g.setAttribute('color',new THREE.BufferAttribute(m.color,3,true));g.setIndex(new THREE.BufferAttribute(m.index,1));g.computeBoundingSphere();geometries.add(g);triangles+=m.index.length/3;
   let mat=materials.get(m.tissue);if(!mat){mat=material(m.tissue);materials.set(m.tissue,mat)}const mesh=new THREE.Mesh(g,mat);mesh.name=object.name+'_'+m.tissue;mesh.userData={partId:def.id,systematicsTissue:m.tissue};object.add(mesh)}
  parts.push({...def,label:def.label||def.id,object,geometryIdentified:meshes.length>0});
 }
 // Scale to the size shared by the study views; "frame" parts (the cell or body, not long flagella) set
 // both the scale and the initial framing.
 group.updateMatrixWorld(true);const focus=new THREE.Box3();for(const p of parts)if(!definition.frameParts||definition.frameParts.includes(p.id))focus.union(new THREE.Box3().setFromObject(p.object));
 const size=focus.getSize(new THREE.Vector3()),center=focus.getCenter(new THREE.Vector3()),k=.22/Math.max(size.x,size.y,size.z);group.scale.setScalar(k);group.position.copy(center.multiplyScalar(-k));group.updateMatrixWorld(true);
 const fitBounds=new THREE.Box3();for(const p of parts)if(!definition.frameParts||definition.frameParts.includes(p.id))fitBounds.union(new THREE.Box3().setFromObject(p.object));fitBounds.expandByScalar(.012);
 return{id,title:definition.title||definition.label,label:definition.label||definition.title,description:definition.description,group,parts,bounds:new THREE.Box3().setFromObject(group),fitBounds,authoredReconstruction:true,preserveMaterials:true,systematics:true,
  limits:definition.representation||'Reconstrução 3D autoral para ensino. Formas, cores e proporções são didáticas.',
  stats:{...data.stats,parts:parts.length,triangles,materials:materials.size,mobile},
  dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const g of geometries){g.disposeBoundsTree?.();g.dispose()}for(const m of materials.values())m.dispose();group.clear();geometries.clear();materials.clear()}};
}
