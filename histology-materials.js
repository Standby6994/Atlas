import * as THREE from 'three';

// Shared procedural surface maps: 4096² on desktop, pre-scaled 2048² files on touch devices. These are mathematical illustrations of
// wet, finely textured tissue, not patient imagery, histological stains or scans.
const pools=new Map();
async function acquireMaps(mobile){
 const key=mobile?'2048':'4096';let pool=pools.get(key);
 if(!pool){pool={refs:0,maps:null,promise:null};pool.promise=(async()=>{
  const size=mobile?'2k':'4k',paths=['histology-albedo-'+size+'.png','histology-normal-'+size+'.png'],maps=[];
  try{for(let i=0;i<paths.length;i++){const response=await fetch(new URL('./assets/histology/'+paths[i],import.meta.url));if(!response.ok)throw Error('Textura histológica indisponível.');const blob=await response.blob(),bitmap=await createImageBitmap(blob,{imageOrientation:'flipY'}),texture=new THREE.Texture(bitmap);texture.needsUpdate=true;texture.flipY=false;texture.colorSpace=i===0?THREE.SRGBColorSpace:THREE.NoColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=mobile?2:4;texture.userData={histologyProcedural:true,sourceResolution:4096,activeResolution:mobile?2048:4096,shared:true};maps.push(texture)}pool.maps=maps;return maps}catch(error){for(const t of maps){t.image?.close?.();t.dispose()}pools.delete(key);throw error}
 })();pools.set(key,pool)}
 pool.refs++;const maps=await pool.promise;let released=false;return{maps,release(){if(released)return;released=true;if(--pool.refs===0){for(const t of maps){t.image?.close?.();t.dispose()}pools.delete(key)}}}
}
function category(color){if([0x625071,0x493d59,0x967991].includes(color))return'nucleus';if([0xe6c6cb,0xd8b4bf].includes(color))return'matrix';if([0xaf6979,0xb57586].includes(color))return'muscle';if([0xe7d6d9,0xd8dee1].includes(color))return'fluid';if([0xe3d1c6,0xd8c3b0].includes(color))return'keratin';return'cell'}
export async function createHistologyMaterialLibrary({mobile=false,textures=true}={}){
 const lease=textures&&typeof createImageBitmap==='function'?await acquireMaps(mobile):null,materials=new Map();let disposed=false;
 function get(color,opacity=1,kind=category(color)){
  const key=color+':'+opacity+':'+kind;if(materials.has(key))return materials.get(key);
  const normalScale=kind==='nucleus'?.20:kind==='fluid'?.07:kind==='matrix'?.31:.25;
  const m=new THREE.MeshPhysicalMaterial({color,roughness:kind==='fluid'?.39:kind==='keratin'?.78:kind==='matrix'?.72:.58,metalness:0,side:THREE.DoubleSide,transparent:opacity<1,opacity,depthWrite:opacity>=.95,forceSinglePass:true,clearcoat:kind==='fluid'?.22:.10,clearcoatRoughness:.65,sheen:kind==='matrix'?.18:.08,sheenRoughness:.9,ior:1.38,envMapIntensity:.55,map:lease?.maps[0]||null,normalMap:lease?.maps[1]||null,normalScale:new THREE.Vector2(normalScale,normalScale)});
  m.userData={histologyFinish:true,preserveSourceAppearance:true,histologyCategory:kind,proceduralTexture:true,textureResolution:lease?(mobile?2048:4096):0};materials.set(key,m);return m
 }
 return{materials,get,textureResolution:lease?(mobile?2048:4096):0,dispose(){if(disposed)return;disposed=true;for(const m of materials.values())m.dispose();materials.clear();lease?.release()}}
}

/** This handle owns only the replacement materials and shared-map lease. */
export async function applyHistologyMaterials(group,options={}){
 const library=await createHistologyMaterialLibrary(options),originals=new Map();
 group.traverse(o=>{if(!o.isMesh)return;const replace=source=>{if(!originals.has(source)){const color=source.color?.getHex()??0xcd939e,m=library.get(color,source.opacity??1);m.transparent=source.transparent||m.transparent;m.depthWrite=source.depthWrite;m.side=source.side??THREE.DoubleSide;originals.set(source,m)}return originals.get(source)};o.material=Array.isArray(o.material)?o.material.map(replace):replace(o.material)});
 return{materials:library.materials,textureResolution:library.textureResolution,dispose:()=>library.dispose()}
}
