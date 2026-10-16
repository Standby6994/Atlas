import * as THREE from 'three';

// Generated assets are authored triangulated teaching geometry. Expensive
// implicit branch meshing is performed by the documented offline builder,
// never on the iPad's main thread. Each instance owns its GPU resources.
const PROFILES = {"detailed":{"path":"assets/interiors/pulmonary-detailed-v17.bin","bytes":9456992,"sha256":"dba48e0bc3a62fe342d3349486a183625cff1ab19a2c0f59d7af7b1e73dadcc6"},"touch":{"path":"assets/interiors/pulmonary-touch-v17.bin","bytes":4112052,"sha256":"7f255f24f080304cdb68e6b7ebcd2012653edbba611b9c9ad1cf2bd8ef5912e4"}}; // Filled from pulmonary-assets-v17.json by the build step.
const KEYS=['right_lung','left_lung','trachea','primary_bronchi','bronchial_tree','pulmonary_arteries','pulmonary_veins','pleura','diaphragm'];
const LABELS=['Pulmão direito: três lobos','Pulmão esquerdo: dois lobos','Traqueia','Brônquios principais','Árvore brônquica','Artérias pulmonares','Veias pulmonares','Pleura: lâminas periféricas','Diafragma'];
const TISSUES=['organ','organ','organ','organ','organ','artery','vein','connective','muscle'];
export const pulmonaryInteriorSources=[
 'https://openstax.org/books/anatomy-and-physiology-2e/pages/22-1-organs-and-structures-of-the-respiratory-system',
 'https://openstax.org/books/anatomy-and-physiology-2e/pages/22-2-the-lungs',
 'https://www.nhlbi.nih.gov/health/lungs/respiratory-system'
];
function decode(buffer,profile,mobile){
 if(buffer.byteLength!==profile.bytes||buffer.byteLength<16)throw Error('Arquivo pulmonar incompleto.');
 const head=new DataView(buffer),magic=String.fromCharCode(...new Uint8Array(buffer,0,4));
 if(magic!=='ATLP'||head.getUint32(4,true)!==1)throw Error('Formato pulmonar inválido.');
 const jsonLength=head.getUint32(8,true),payloadLength=head.getUint32(12,true),payloadStart=16+Math.ceil(jsonLength/4)*4;
 if(jsonLength>250000||payloadStart+payloadLength!==buffer.byteLength)throw Error('Layout pulmonar inválido.');
 const data=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,16,jsonLength)));
 if(data.format!=='atlas-pulmonary-v1'||data.mobile!==mobile||data.id!=='lungs'||data.parts.length!==9||KEYS.some(key=>!data.parts.some(p=>p.partId===key)))throw Error('Perfil pulmonar incompatível.');
 const types={Float32Array,Uint16Array,Uint32Array};
 const array=entry=>{const Type=types[entry.type];if(!Type||!Number.isSafeInteger(entry.offset)||!Number.isSafeInteger(entry.length)||entry.length<1||entry.offset<0||entry.offset%Type.BYTES_PER_ELEMENT||entry.offset+entry.length*Type.BYTES_PER_ELEMENT>payloadLength)throw Error('Atributo pulmonar inválido.');return new Type(buffer,payloadStart+entry.offset,entry.length)};
 for(const part of data.parts)for(const record of part.meshes){const g=record.geometry;if(g.position.type!=='Float32Array'||g.normal.type!=='Float32Array'||g.uv.type!=='Float32Array'||g.position.length%3||g.normal.length!==g.position.length||g.uv.length!==g.position.length/3*2||g.index.length%3)throw Error('Geometria pulmonar inválida.');for(const entry of Object.values(g))array(entry)}
 return{data,array};
}

export async function createPulmonaryInterior(definition={}, {mobile=false,signal}={}){
 const profile=PROFILES[mobile?'touch':'detailed'];if(!profile)throw Error('Corte pulmonar ainda não preparado.');
 const group=new THREE.Group(),parts=[],geometries=new Set(),materials=new Set();let disposed=false;
 const release=()=>{if(disposed)return;disposed=true;group.removeFromParent();for(const g of geometries){g.disposeBoundsTree?.();g.dispose();g.setIndex(null);for(const key of Object.keys(g.attributes))g.deleteAttribute(key)}for(const m of materials)m.dispose();for(const part of parts)part.object.clear();parts.length=0;group.clear();geometries.clear();materials.clear()};
 try{
  const url=new URL(profile.path,import.meta.url),response=await fetch(url,{signal,credentials:'same-origin'});
  if(!response.ok||response.status!==200||response.redirected||response.type==='opaque'||(response.url&&response.url!==url.href)||!/octet-stream|x-binary/.test(response.headers.get('content-type')||''))throw Error('Resposta do corte pulmonar inválida.');
  const buffer=await response.arrayBuffer();
  if(buffer.byteLength!==profile.bytes)throw Error('Download do corte pulmonar incompleto.');
  const digest=await crypto.subtle.digest('SHA-256',buffer),sha256=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  if(sha256!==profile.sha256)throw Error('A integridade do corte pulmonar não confere.');
  const {data,array}=decode(buffer,profile,mobile);
  group.name='INTERNAL_lungs';group.userData={internalOrgan:'lungs',authoredReconstruction:true,educational:true,schematic:true,notRealHistology:true,anatomicalReference:false,geometryIdentified:true,mobile,precomputedGeometry:true,sourceUrls:pulmonaryInteriorSources};
  for(const key of KEYS){const expected='INTERNAL_lungs_'+key,index=KEYS.indexOf(key),info=(definition.internalParts||[]).find(p=>p.id===expected||p.partId===key)||{id:expected,name:expected,label:LABELS[index]},partGroup=new THREE.Group();partGroup.name=expected;
   for(const record of data.parts.find(p=>p.partId===key).meshes){
    const layout=record.geometry,g=new THREE.BufferGeometry();geometries.add(g);g.setAttribute('position',new THREE.BufferAttribute(array(layout.position),3));g.setAttribute('normal',new THREE.BufferAttribute(array(layout.normal),3));g.setAttribute('uv',new THREE.BufferAttribute(array(layout.uv),2));g.setIndex(new THREE.BufferAttribute(array(layout.index),1));
    const material=new THREE.MeshStandardMaterial({...record.material,side:THREE.DoubleSide,forceSinglePass:true});materials.add(material);const mesh=new THREE.Mesh(g,material);mesh.name=record.name||expected;
    mesh.userData={...record.userData,atlasName:expected,internalPart:expected,partId:key,internalOrgan:'lungs',tissue:TISSUES[index],schematic:true,educational:true,notRealHistology:true,authoredReconstruction:true,geometryIdentified:true,anatomicalReference:false,sourceUrls:pulmonaryInteriorSources};partGroup.add(mesh);
   }
   group.add(partGroup);parts.push({...info,id:expected,name:expected,contentPartId:expected,partId:key,organId:'lungs',label:info.label||LABELS[index],pt:info.pt||info.label||LABELS[index],object:partGroup,geometryIdentified:true,authoredReconstruction:true,anatomicalReference:false,sourceUrls:pulmonaryInteriorSources});
  }
  group.scale.fromArray(data.groupScale);group.position.fromArray(data.groupPosition);group.updateMatrixWorld(true);
  let triangles=0,vertices=0,geometryBytes=0;for(const g of geometries){triangles+=g.index.count/3;vertices+=g.attributes.position.count;for(const a of Object.values(g.attributes))geometryBytes+=a.array.byteLength;geometryBytes+=g.index.array.byteLength}
  return{id:'lungs',title:data.title,description:data.description,group,parts,bounds:new THREE.Box3().setFromObject(group),orientation:data.orientation,limits:data.limits,sources:pulmonaryInteriorSources,defaultClip:'none',authoredReconstruction:true,anatomicalReference:false,geometryIdentified:true,preserveMaterials:false,stats:{...data.stats,triangles,vertices,geometryBytes,meshes:geometries.size,drawCalls:geometries.size,precomputedGeometry:true,precomputedMesh:true,photographicTextures:false,assetBytes:profile.bytes,assetSha256:profile.sha256},dispose:release};
 }catch(error){release();throw error}
}
