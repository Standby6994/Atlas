import * as THREE from 'three';
import {createHistologyMaterialLibrary} from './histology-materials.js';

// Offline-authored cell-contact surfaces; shared maps remain procedural artwork.
export const gastricHistologySources=Object.freeze([
 'https://openstax.org/books/anatomy-and-physiology-2e/pages/23-4-the-stomach',
 'https://histology.leeds.ac.uk/home/digestive/stomach/',
 'https://histologyguide.com/slideview/MH-112-fundic-stomach/14-slide-1.html'
]);
const KEYS=['surface','parietal','chief','gland_lumen','submucosa','muscularis'];
const CONTEXTS=['context_epithelium','context_lamina','context_muscularis_mucosae'];
const KINDS={surface:'cell',parietal:'cell',chief:'cell',gland_lumen:'fluid',submucosa:'matrix',muscularis:'muscle',context_epithelium:'cell',context_lamina:'matrix',context_muscularis_mucosae:'muscle'};
const HEADER=24,MAX_BYTES=7*1024*1024,MAX_JSON=200000;
const CRC_TABLE=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0});
function crc32(bytes){let n=0xffffffff;for(const b of bytes)n=CRC_TABLE[(n^b)&255]^(n>>>8);return(n^0xffffffff)>>>0}
function need(ok,message){if(!ok)throw Error('Histologia gástrica inválida: '+message)}
const finite=(a,n)=>Array.isArray(a)&&a.length===n&&a.every(Number.isFinite);
export function decodeGastricHistologyBuffer(input,definition={},options={}){
 const bytes=ArrayBuffer.isView(input)?new Uint8Array(input.buffer,input.byteOffset,input.byteLength):new Uint8Array(input);need(bytes.byteLength>=HEADER&&bytes.byteLength<=MAX_BYTES,'tamanho');const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 need(String.fromCharCode(...bytes.subarray(0,8))==='ATLGH20\0'&&view.getUint32(8,true)===1,'identificação/versão');const jl=view.getUint32(12,true),pl=view.getUint32(16,true),start=HEADER+jl;need(jl>0&&jl<=MAX_JSON&&jl%4===0&&start+pl===bytes.byteLength,'limites do conteúdo');need(crc32(bytes.subarray(HEADER))===view.getUint32(20,true),'integridade');
 let meta;try{meta=JSON.parse(new TextDecoder().decode(bytes.subarray(HEADER,start)).trimEnd())}catch{throw Error('Histologia gástrica inválida: descrição')}
 need(meta?.schema===1&&meta.kind==='gastric-histology-interior'&&typeof meta.mobile==='boolean','tipo/perfil');if(options.mobile!==undefined)need(meta.mobile===!!options.mobile,'perfil solicitado');need(bytes.byteLength<=(meta.mobile?3:7)*1024*1024,'orçamento de arquivo');
 const all=[...KEYS,...CONTEXTS];need(Array.isArray(meta.parts)&&meta.parts.length===9&&new Set(meta.parts.map(p=>p.key)).size===9&&all.every(k=>meta.parts.some(p=>p.key===k)),'componentes');
 need(definition?.id==='gastric-wall'&&Array.isArray(definition.parts)&&KEYS.every(k=>definition.parts.some(p=>p.id===k)),'definição e seis IDs');
 const bounds=meta.positionBounds,uvBounds=meta.uvBounds;need(bounds&&finite(bounds.min,3)&&finite(bounds.max,3)&&bounds.min.every((n,i)=>bounds.max[i]>n),'limites espaciais');need(uvBounds&&finite(uvBounds.min,2)&&finite(uvBounds.max,2)&&uvBounds.min.every((n,i)=>uvBounds.max[i]>n),'UV');need(finite(meta.transform?.scale,3)&&meta.transform.scale.every(n=>n>0&&n<10)&&finite(meta.transform.position,3),'transformação');
 const payload=new DataView(bytes.buffer,bytes.byteOffset+start,pl),ranges=[];let triangles=0;
 for(const p of meta.parts){const context=CONTEXTS.includes(p.key),annotation=p.key==='gland_lumen';need(all.includes(p.key)&&p.id===p.key&&p.isContext===context&&p.materialKind===KINDS[p.key],'identidade e tipo');need(p.objectMetadata&&p.objectMetadata.contextOnly===context&&p.objectMetadata.annotationOnly===annotation&&p.objectMetadata.geometryIdentified===!annotation&&(!annotation||p.objectMetadata.annotationKind==='cavity-boundary'),'natureza da estrutura');need(context||typeof p.objectMetadata.representationNote==='string','nota de representação');need(Number.isSafeInteger(p.vertices)&&p.vertices>=3&&p.vertices<=250000&&Number.isSafeInteger(p.indexCount)&&p.indexCount>=3&&p.indexCount%3===0,'contagem geométrica');need((p.indexBytes===2&&p.vertices<=65535)||p.indexBytes===4,'tipo de índice');
  for(const[name,size,count]of[['position',2,p.vertices*3],['normal',2,p.vertices*3],['uv',2,p.vertices*2],['color',1,p.vertices*3],['index',p.indexBytes,p.indexCount]]){const a=p.attributes?.[name];need(a&&Number.isSafeInteger(a.offset)&&a.offset>=0&&a.offset%4===0&&a.length===count*size&&a.offset+a.length<=pl,'bloco '+name);ranges.push([a.offset,a.offset+a.length])}triangles+=p.indexCount/3;
 }
 ranges.sort((a,b)=>a[0]-b[0]);need(ranges.every((a,i)=>!i||a[0]>=ranges[i-1][1]),'blocos sobrepostos');need(triangles<=(meta.mobile?140000:350000),'orçamento geométrico');
 const library=options.materialLibrary;need(library&&typeof library.get==='function'&&typeof library.dispose==='function','biblioteca de materiais');const group=new THREE.Group(),parts=[],contexts=[],geometries=new Set();let disposed=false;
 group.name='HISTOLOGY_gastric-wall';group.userData={histologyId:'gastric-wall',educational:true,schematic:true,notRealHistology:true,organicHistology:true,authoredReconstruction:true,coherentTissueSection:true,precomputedAuthoredMesh:true};
 try{
  for(const p of meta.parts){
   const pos=new Float32Array(p.vertices*3),normal=new Float32Array(p.vertices*3),uv=new Float32Array(p.vertices*2),color=new Float32Array(p.vertices*3);
   for(let i=0;i<pos.length;i++){const k=i%3;pos[i]=bounds.min[k]+payload.getUint16(p.attributes.position.offset+i*2,true)/65535*(bounds.max[k]-bounds.min[k]);const n=payload.getInt16(p.attributes.normal.offset+i*2,true);need(n!==-32768,'normal');normal[i]=n/32767;color[i]=payload.getUint8(p.attributes.color.offset+i)/255*1.1}
   for(let i=0;i<uv.length;i++){const k=i%2;uv[i]=uvBounds.min[k]+payload.getUint16(p.attributes.uv.offset+i*2,true)/65535*(uvBounds.max[k]-uvBounds.min[k])}
   const indices=p.indexBytes===2?new Uint16Array(p.indexCount):new Uint32Array(p.indexCount);for(let i=0;i<indices.length;i++){const n=p.indexBytes===2?payload.getUint16(p.attributes.index.offset+i*2,true):payload.getUint32(p.attributes.index.offset+i*4,true);need(n<p.vertices,'índice fora da malha');indices[i]=n}
   const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(pos,3));geometry.setAttribute('normal',new THREE.BufferAttribute(normal,3));geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));geometry.setAttribute('color',new THREE.BufferAttribute(color,3));geometry.setIndex(new THREE.BufferAttribute(indices,1));geometry.userData={...p.geometryMetadata,quantizedSharedPositionGrid:true,precomputedAuthoredMesh:true};geometries.add(geometry);geometry.computeBoundingBox();geometry.computeBoundingSphere();
   const material=library.get(0xffffff,1,p.materialKind);material.vertexColors=true;const object=new THREE.Mesh(geometry,material),info=definition.parts.find(d=>d.id===p.key),name=info?.name||'CONTEXT_gastric-wall_'+p.key;object.name=name;object.userData={...p.objectMetadata,histologyId:'gastric-wall',histologyPart:name,microPart:name,educational:true,notRealHistology:true,organicHistology:true,authoredReconstruction:true,contextOnly:p.isContext,sourceUrls:gastricHistologySources};group.add(object);
   const item={...info,id:p.key,name,pt:info?.pt||info?.label||p.key,label:info?.label||p.key,functionText:info?.function||'',object,geometryIdentified:p.key!=='gland_lumen',annotationOnly:p.key==='gland_lumen',annotationKind:p.key==='gland_lumen'?'cavity-boundary':undefined,representationNote:p.objectMetadata.representationNote};(p.isContext?contexts:parts).push(item);
  }
  group.scale.fromArray(meta.transform.scale);group.position.fromArray(meta.transform.position);group.updateMatrixWorld(true);const resultBounds=new THREE.Box3().setFromObject(group),size=resultBounds.getSize(new THREE.Vector3());need(resultBounds.getCenter(new THREE.Vector3()).length()<.0001&&Math.abs(Math.max(...size.toArray())-1.2)<.0001,'normalização');let geometryBytes=0;for(const g of geometries){for(const a of Object.values(g.attributes))geometryBytes+=a.array.byteLength;geometryBytes+=g.index.array.byteLength}
  return{id:'gastric-wall',title:meta.title,label:definition.label,group,parts,contexts,bounds:resultBounds,preserveMaterials:true,authoredReconstruction:true,description:meta.description,limits:meta.limits,sourceIds:definition.sourceIds,sources:gastricHistologySources,sourceUrls:gastricHistologySources,orientation:meta.orientation,topology:meta.topology,stats:{...meta.stats,parts:6,modeledCanonicalParts:5,cavityAnnotations:1,contextMeshes:3,meshes:9,drawCalls:9,triangles,vertices:meta.parts.reduce((n,p)=>n+p.vertices,0),geometryBytes,materials:library.materials?.size,mobile:meta.mobile,precomputedMesh:true,binaryBytes:bytes.byteLength,textureResolution:library.textureResolution,photographicTextures:false,quantizationStep:bounds.min.map((n,i)=>(bounds.max[i]-n)/65535)},dispose(){if(disposed)return;disposed=true;for(const g of geometries){g.disposeBoundsTree?.();g.dispose()}library.dispose();group.removeFromParent();group.clear();geometries.clear()}};
 }catch(error){for(const g of geometries)g.dispose();library.dispose();group.clear();throw error}
}
export async function createGastricHistologyModel(definition, {mobile=false,textures=true}={}){
 const library=await createHistologyMaterialLibrary({mobile,textures});
 try{const url=new URL('./assets/histology/gastric-histology-'+(mobile?'touch':'desktop')+'-v20.bin',import.meta.url),response=await fetch(url);if(!response.ok)throw Error('Não foi possível carregar a histologia gástrica.');const length=Number(response.headers?.get?.('content-length'));need(!Number.isFinite(length)||length<=(mobile?3:7)*1024*1024,'arquivo excede o limite');return decodeGastricHistologyBuffer(await response.arrayBuffer(),definition,{mobile,materialLibrary:library})}catch(error){library.dispose();throw error}
}
