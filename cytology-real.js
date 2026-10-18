import * as THREE from 'three';

// Cytology views built from real data (tools/cytology): cells and organelles segmented from FIB-SEM electron
// microscopy (OpenOrganelle, HHMI Janelia, CC BY 4.0) and molecular surfaces from the Protein Data Bank (CC0).
// Each view has a desktop and a touch pack (assets/cytology/real/<id>-<profile>-<version>.bin, gzip):
// positions are Uint16 over the model bounds (the mesh is placed by position/scale, no decoding), normals Int8.
// A missing or invalid pack falls back to the authored model in cytology-models.js.
export const REAL_PACKS=Object.freeze({
  'active-transport':{version:'r1'},
  'animal-cell':{version:'r1'},
  'apoptosis-cancer':{version:'r1'},
  'bacterial-cell':{version:'r1'},
  'biomolecules-water':{version:'r1'},
  'calvin-cycle':{version:'r1'},
  'carbohydrates-lipids':{version:'r1'},
  'cardiomyocyte':{version:'r1'},
  'cell-cycle':{version:'r1'},
  'cell-differentiation':{version:'r1'},
  'cell-junctions':{version:'r1'},
  'cell-signaling':{version:'r1'},
  'chloroplast':{version:'r1'},
  'cilia-flagella':{version:'r1'},
  'cytoskeleton':{version:'r1'},
  'diffusion-facilitated':{version:'r1'},
  'dna-replication':{version:'r1'},
  'endocytosis-exocytosis':{version:'r1'},
  'fungal-cell':{version:'r1'},
  'gametogenesis':{version:'r1'},
  'gene-regulation':{version:'r1'},
  'glycolysis-fermentation':{version:'r1'},
  'golgi':{version:'r1'},
  'krebs-cycle':{version:'r1'},
  'light-reactions':{version:'r1'},
  'lysosome-autophagy':{version:'r2'},
  'meiosis':{version:'r1'},
  'mitochondrion':{version:'r1'},
  'mitosis':{version:'r1'},
  'nucleic-acids':{version:'r1'},
  'nucleus-chromatin':{version:'r1'},
  'osmosis-tonicity':{version:'r1'},
  'oxidative-phosphorylation':{version:'r1'},
  'peroxisome':{version:'r1'},
  'plant-cell':{version:'r1'},
  'plasma-membrane':{version:'r1'},
  'proteins-enzymes':{version:'r1'},
  'ribosome':{version:'r1'},
  'rough-er':{version:'r1'},
  'sarcomere':{version:'r1'},
  'smooth-er':{version:'r2'},
  'transcription-rna':{version:'r1'},
  'translation-protein':{version:'r1'},
  'vacuole':{version:'r1'},
  'viruses-acellular':{version:'r1'},
});
export const hasRealCytology=id=>!!REAL_PACKS[id];
export const realPackPath=(id,mobile)=>'assets/cytology/real/'+id+'-'+(mobile?'touch':'desktop')+'-'+REAL_PACKS[id].version+'.bin';
const MAGIC='ATLCYTO1';

async function readPack(url){
  const response=await fetch(url);if(!response.ok)throw new Error('Modelo real indisponível: '+url);
  if(typeof DecompressionStream!=='function'||!response.body)throw new Error('DecompressionStream indisponível');
  const buffer=await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  const bytes=new Uint8Array(buffer);if(String.fromCharCode(...bytes.subarray(0,8))!==MAGIC)throw new Error('Pacote citológico inválido');
  const length=new DataView(buffer).getUint32(8,true),meta=JSON.parse(new TextDecoder().decode(bytes.subarray(12,12+length)));
  if(meta.schema!==1)throw new Error('Versão de pacote citológico não suportada');
  return{buffer,meta,base:Math.ceil((12+length)/8)*8};
}

// Vertex colours are stored as sRGB bytes; three.js wants linear ones. They are converted once here, into 16-bit
// linear values (8-bit linear would band in the shadows), because the app clones materials for selection and a
// shader patch on the original would be lost; a slight saturation keeps them vivid under the app's bright lights.
const SRGB_TO_LINEAR=Float32Array.from({length:256},(_,i)=>{const c=i/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4});
function linearColors(bytes){const out=new Uint16Array(bytes.length);for(let i=0;i<bytes.length;i+=3){const r=SRGB_TO_LINEAR[bytes[i]],g=SRGB_TO_LINEAR[bytes[i+1]],b=SRGB_TO_LINEAR[bytes[i+2]],l=.2126*r+.7152*g+.0722*b,k=1.15;
  out[i]=Math.min(65535,Math.max(0,(l+(r-l)*k)*65535));out[i+1]=Math.min(65535,Math.max(0,(l+(g-l)*k)*65535));out[i+2]=Math.min(65535,Math.max(0,(l+(b-l)*k)*65535))}return out}

export async function createRealCytologyModel(id,def,{mobile=false,url=null}={}){
  const spec=REAL_PACKS[id];if(!spec&&!url)return null;
  const {buffer,meta,base}=await readPack(url||new URL('./'+realPackPath(id,mobile),import.meta.url));
  const view=(Type,[offset,bytes])=>new Type(buffer,base+offset,bytes/Type.BYTES_PER_ELEMENT);
  const group=new THREE.Group(),geometries=new Set(),materials=new Set();let disposed=false,triangles=0,meshes=0;
  group.name='CYTOLOGY_'+id;group.userData={cytology:true,educational:true,cytologyId:id,realData:true};
  const min=new THREE.Vector3(...meta.bounds.min),size=new THREE.Vector3(...meta.bounds.max).sub(min);
  const parts=def.parts.map(p=>{const object=new THREE.Group();object.name='CYTO_'+id+'_'+p.id;object.userData={cytology:true,educational:true,partId:p.id};group.add(object);return{...p,id:p.id,label:p.label||p.title||p.id,object}});
  // Pack parts that are not parts of the content view (the membrane around a pump) are context: drawn, never picked.
  let context=null;const contextPart=id=>{if(!context){context=new THREE.Group();context.name='CYTO_'+id+'_context';context.userData={contextOnly:true,notSelectable:true};group.add(context)}return{id,object:context,context:true}};
  for(const packed of meta.parts){
    const part=parts.find(p=>p.id===packed.id)||contextPart(packed.id);
    for(const m of packed.meshes){
      const g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.BufferAttribute(view(Uint16Array,m.position),3,true));
      g.setAttribute('normal',new THREE.BufferAttribute(view(Int8Array,m.normal),3,true));
      if(m.colors)g.setAttribute('color',new THREE.BufferAttribute(linearColors(view(Uint8Array,m.colors)),3,true));
      g.setIndex(new THREE.BufferAttribute(view(m.index[2]===4?Uint32Array:Uint16Array,m.index),1));
      g.computeBoundingSphere();geometries.add(g);
      const material=new THREE.MeshStandardMaterial({color:m.color,roughness:m.roughness,metalness:0,side:THREE.DoubleSide,transparent:m.opacity<1,opacity:m.opacity,depthWrite:m.opacity>=.95,vertexColors:!!m.colors,forceSinglePass:true,envMapIntensity:.4});
      materials.add(material);
      const mesh=new THREE.Mesh(g,material);mesh.name=part.object.name+'_'+m.name;mesh.position.copy(min);mesh.scale.copy(size);
      mesh.userData=part.context?{contextOnly:true,cytology:true,realData:true}:{partId:part.id,atlasName:part.object.name,cytology:true,educational:true,realData:true};if(part.context)mesh.raycast=()=>{};
      part.object.add(mesh);meshes++;triangles+=m.triangles;
    }
  }
  for(const p of parts)p.geometryIdentified=p.object.children.length>0;
  // Same framing size as the authored organelles (.22 m across the largest side).
  group.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(group),center=box.getCenter(new THREE.Vector3()),k=.22/Math.max(...box.getSize(new THREE.Vector3()).toArray());
  group.scale.setScalar(k);group.position.copy(center.multiplyScalar(-k));group.updateMatrixWorld(true);
  // The camera frames the parts the pack names (the main ribosome, not the whole polysome).
  let fitBounds=null;if(meta.frame?.length){fitBounds=new THREE.Box3();for(const p of parts)if(meta.frame.includes(p.id)&&p.geometryIdentified)fitBounds.union(new THREE.Box3().setFromObject(p.object))}
  return{id,title:def.title||def.label,label:def.label||def.title,description:def.description,group,parts,bounds:new THREE.Box3().setFromObject(group),fitBounds,
    sourceIds:def.sourceIds||[],realData:true,ownMaterials:true,credits:meta.credits,
    limits:meta.notes||def.limits,
    stats:{parts:parts.length,meshes,triangles,vertices:meta.stats.vertices,mobile,realData:true,packBytes:buffer.byteLength},
    dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const g of geometries){g.disposeBoundsTree?.();g.dispose()}for(const m of materials)m.dispose();group.clear();geometries.clear();materials.clear()}};
}
