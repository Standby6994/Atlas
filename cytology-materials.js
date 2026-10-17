import * as THREE from 'three';

// Shared native 4096 atlas (2048 on touch). These authored PBR data maps
// represent surface variation; they are not electron micrographs or measurements.
const roles=['membrane','matrix','chromatin','protein','filament','wall','lipid','chloroplast','lignin','cuticle'];
const sets=new Map();
async function acquire(mobile){
 const resolution=mobile?2048:4096;let record=sets.get(resolution);
 if(!record){
  record={users:0,resolution,textures:[]};sets.set(resolution,record);const loader=new THREE.TextureLoader();
  // A failed request must wait for its siblings: they can still resolve with
  // allocated textures after the first error. Dispose this shared batch once,
  // rather than once for every caller waiting on the same record.
  record.promise=Promise.allSettled(['albedo','normal','roughness'].map(async kind=>{
   const url=new URL('./assets/cytology/cytology-'+kind+'-'+resolution+(kind==='albedo'?'.jpg':'.png'),import.meta.url).href;
   // ImageBitmap decodes off the main thread, so the GPU upload no longer pays for decoding (same pixels: flipped here, not by WebGL).
   const texture=typeof createImageBitmap==='function'?await fetch(url).then(r=>{if(!r.ok)throw Error('Textura celular indisponível.');return r.blob()}).then(blob=>createImageBitmap(blob,{imageOrientation:'flipY',premultiplyAlpha:'none',colorSpaceConversion:kind==='albedo'?'default':'none'})).then(bitmap=>{const t=new THREE.Texture(bitmap);t.flipY=false;t.needsUpdate=true;return t}):await loader.loadAsync(url);
   try{texture.colorSpace=kind==='albedo'?THREE.SRGBColorSpace:THREE.NoColorSpace;texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.anisotropy=mobile?1:4;texture.userData={cytologyPBR:true,resolution,procedural:true};return texture}
   catch(error){texture.dispose();throw error}
  })).then(results=>{
   record.textures=results.filter(result=>result.status==='fulfilled').map(result=>result.value);
   const failed=results.find(result=>result.status==='rejected');
   if(failed){for(const texture of record.textures)texture.dispose();record.textures=[];if(sets.get(resolution)===record)sets.delete(resolution);throw failed.reason}
   return record.textures;
  });
 }
 record.users++;try{await record.promise;return record}catch(error){record.users--;throw error}
}
function release(record){if(record.users<=0)return;record.users--;if(record.users>0)return;if(sets.get(record.resolution)===record)sets.delete(record.resolution);for(const texture of record.textures||[]){texture.dispose();texture.image?.close?.()}record.textures=[]}
export async function applyCytologyMaterials(root,{mobile=false}={}){
 const record=await acquire(mobile),atlases=new Map(),materials=new Map(),ownedMaps=new Set();let disposed=false;
 function maps(role){if(atlases.has(role))return atlases.get(role);const index=Math.max(0,roles.indexOf(role)),margin=2/record.resolution;const textures=record.textures.map(base=>{const t=base.clone();t.repeat.set(.25-2*margin,.25-2*margin);t.offset.set((index%4)*.25+margin,1-(Math.floor(index/4)+1)*.25+margin);ownedMaps.add(t);return t});atlases.set(role,textures);return textures}
 root.traverse(mesh=>{if(!mesh.isMesh)return;const raw=mesh.userData.cytologyTissue,role=roles.includes(raw)?raw:'matrix';const originals=Array.isArray(mesh.material)?mesh.material:[mesh.material];const next=originals.map(original=>{const key=role+'|'+original.uuid;if(materials.has(key))return materials.get(key);const material=original.isMeshStandardMaterial?original.clone():new THREE.MeshStandardMaterial({color:original.color||0xe0b6a5});const [albedo,normal,roughness]=maps(role);material.map=albedo;material.normalMap=normal;material.roughnessMap=roughness;material.normalScale=new THREE.Vector2(role==='lignin'||role==='wall'?.25:.16,role==='lignin'||role==='wall'?.25:.16);material.roughness=role==='cuticle'||role==='lipid'?.72:.94;material.metalness=0;material.side=THREE.DoubleSide;material.forceSinglePass=true;material.userData={...material.userData,cytologyPBR:true,cytologyTissue:role,textureResolution:record.resolution,illustrativeColor:true};material.needsUpdate=true;materials.set(key,material);return material});mesh.material=Array.isArray(mesh.material)?next:next[0];mesh.userData.cytologyTextureResolution=record.resolution;});
 return{textureResolution:record.resolution,atlasRoles:roles.length,estimatedTextureBytesWithMipmaps:Math.round(3*record.resolution**2*4*4/3),dispose(){if(disposed)return;disposed=true;for(const material of materials.values())material.dispose();for(const texture of ownedMaps)texture.dispose();materials.clear();ownedMaps.clear();atlases.clear();release(record)}};
}
export function getCytologyMaterialStats(){return[...sets.values()].map(s=>({resolution:s.resolution,users:s.users,sharedAtlases:3}))}
