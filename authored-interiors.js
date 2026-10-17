import * as THREE from 'three';
import {createOrganModelContext} from './internal-models.js';
import {createReproductiveContext} from './reproductive-interior-models.js';

// Authored cuts of heart, ovary, testis and vagina, generated once by tools/bake-authored-interiors.mjs from the
// generator modules below and stored losslessly (Float32 positions/normals/tones, original index type). Decoding
// rebuilds the same scene tree, parts, materials, stats and geometryAudit as the generator, without the 60–300 ms of
// synchronous surface generation per model. After editing a generator: node tools/bake-authored-interiors.mjs (then the
// hashes in service-worker.js); --check tells whether the files are current.
export const AUTHORED_INTERIOR_VERSION='a1';
export const AUTHORED_INTERIORS=Object.freeze({
 heart:{context:'organ',parts:22,module:'./heart-interior-model.js',factory:'createHeartInteriorModel'},
 ovary:{context:'organ',parts:15,module:'./ovary-interior-model.js',factory:'createOvaryInteriorModel'},
 testis:{context:'reproductive',parts:7,module:'./reproductive-interior-models.js',factory:'createTestisInteriorModel'},
 vagina:{context:'reproductive',parts:5,module:'./reproductive-interior-models.js',factory:'createVaginaInteriorModel'}
});
export const authoredInteriorPath=(organ,mobile)=>'assets/interiors/'+organ+'-'+(mobile?'touch':'desktop')+'-'+AUTHORED_INTERIOR_VERSION+'.bin';
export const AUTHORED_MAGIC='ATLAI01\0',AUTHORED_HEADER=24;
const MAX_BYTES=24*1024*1024,MAX_JSON=2*1024*1024,ARRAY_TYPES={Float32Array,Uint16Array,Uint32Array};
const CRC_TABLE=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
export function crc32Update(value,bytes){for(let i=0;i<bytes.length;i++)value=CRC_TABLE[(value^bytes[i])&255]^(value>>>8);return value>>>0}
// MessageChannel is not throttled in background tabs like setTimeout; each slice stays well below one frame.
const nextTask=()=>new Promise(resolve=>{const channel=new MessageChannel();channel.port1.onmessage=()=>resolve();channel.port2.postMessage(0)});
const now=()=>performance.now();
function requireCondition(ok,message){if(!ok)throw new Error('Corte pré-calculado inválido: '+message)}
const finiteArray=(a,n)=>Array.isArray(a)&&a.length===n&&a.every(Number.isFinite);
const CHECK_SLICE=131072;
function max16(a,start,end){let m=0;for(let i=start;i<end;i++){const v=a[i];if(v>m)m=v}return m}
function max32(a,start,end){let m=0;for(let i=start;i<end;i++){const v=a[i];if(v>m)m=v}return m}
function finiteRange(a,start,end){for(let i=start;i<end;i++){const v=a[i];if(v!==v||v===Infinity||v===-Infinity)return false}return true}

export async function decodeAuthoredInterior(input,organ,definition={},{mobile=false,file=''}={}){
 const spec=AUTHORED_INTERIORS[organ];requireCondition(spec,'órgão desconhecido');
 const buffer=input instanceof ArrayBuffer?input:input.buffer,base=input instanceof ArrayBuffer?0:input.byteOffset,length=input.byteLength;
 requireCondition(length>=AUTHORED_HEADER&&length<=MAX_BYTES&&base%4===0,'tamanho do arquivo');
 const bytes=new Uint8Array(buffer,base,length),view=new DataView(buffer,base,length);
 requireCondition(String.fromCharCode(...bytes.subarray(0,8))===AUTHORED_MAGIC&&view.getUint32(8,true)===1,'identificação');
 const jsonLength=view.getUint32(12,true),payloadLength=view.getUint32(16,true),checksum=view.getUint32(20,true),payloadStart=AUTHORED_HEADER+jsonLength;
 requireCondition(jsonLength>0&&jsonLength<=MAX_JSON&&jsonLength%4===0&&payloadStart+payloadLength===length,'limites do conteúdo');
 let crc=0xffffffff,slice=now();
 for(let at=AUTHORED_HEADER;at<length;at+=262144){crc=crc32Update(crc,bytes.subarray(at,Math.min(length,at+262144)));if(now()-slice>6){await nextTask();slice=now()}}
 requireCondition(((crc^0xffffffff)>>>0)===checksum,'integridade (CRC-32)');
 let meta;try{meta=JSON.parse(new TextDecoder().decode(bytes.subarray(AUTHORED_HEADER,payloadStart)))}catch{throw new Error('Corte pré-calculado inválido: descrição do arquivo')}
 requireCondition(meta?.schema===1&&meta.kind==='authored-interior'&&meta.organ===organ&&Array.isArray(meta.negativeZero),'tipo de modelo');
 // JSON writes -0 as 0; the generator's -0 values (e.g. a centered coordinate) are restored at their recorded paths.
 for(const trail of meta.negativeZero){requireCondition(Array.isArray(trail)&&trail.length>0,'zeros negativos');let target=meta;for(const k of trail.slice(0,-1))target=target?.[k];requireCondition(target&&target[trail.at(-1)]===0,'zeros negativos');target[trail.at(-1)]=-0}requireCondition(meta.mobile===!!mobile,'perfil solicitado');
 requireCondition(meta.model&&typeof meta.model.title==='string'&&Array.isArray(meta.nodes)&&Array.isArray(meta.geometries)&&Array.isArray(meta.parts)&&meta.parts.length===spec.parts,'estrutura');
 // Every block is checked against the payload before any geometry is created.
 const ranges=[];let triangles=0;
 const block=(entry,itemSize)=>{const Type=ARRAY_TYPES[entry?.type];requireCondition(Type&&Number.isSafeInteger(entry.offset)&&entry.offset>=0&&entry.offset%4===0&&Number.isSafeInteger(entry.count)&&entry.count>0&&entry.count%itemSize===0&&entry.offset+entry.count*Type.BYTES_PER_ELEMENT<=payloadLength,'bloco fora do arquivo');ranges.push([entry.offset,entry.offset+entry.count*Type.BYTES_PER_ELEMENT]);return new Type(buffer,base+payloadStart+entry.offset,entry.count)};
 const arrays=meta.geometries.map(g=>{
  requireCondition(Array.isArray(g.attributes)&&g.attributes.some(a=>a.name==='position'),'atributos');const position=g.attributes.find(a=>a.name==='position');
  requireCondition(position.type==='Float32Array'&&position.itemSize===3,'posições');const vertices=position.count/3;
  const attributes=g.attributes.map(a=>{requireCondition(/^(position|normal|uv|color)$/.test(a.name)&&a.type==='Float32Array'&&[2,3].includes(a.itemSize)&&a.count===vertices*a.itemSize,'atributo '+a.name);return[a,block(a,a.itemSize)]});
  requireCondition(g.index===null?vertices%3===0:g.index?.type!=='Float32Array'&&g.index.count%3===0,'índices');triangles+=(g.index?g.index.count:vertices)/3;
  // Box and sphere as Float64 (exact, including -0), read through DataView since offsets are only 4-byte aligned.
  requireCondition(g.bounds?.type==='Float64Array'&&g.bounds.count===10&&Number.isSafeInteger(g.bounds.offset)&&g.bounds.offset>=0&&g.bounds.offset%4===0&&g.bounds.offset+80<=payloadLength,'limites da malha');ranges.push([g.bounds.offset,g.bounds.offset+80]);
  const bounds=Array.from({length:10},(_,k)=>view.getFloat64(payloadStart+g.bounds.offset+k*8,true));requireCondition(bounds.every(Number.isFinite),'limites da malha');
  return{attributes,index:g.index&&block(g.index,3),vertices,bounds};
 });
 ranges.sort((a,b)=>a[0]-b[0]);requireCondition(ranges.every((r,i)=>!i||r[0]>=ranges[i-1][1]),'blocos sobrepostos');requireCondition(triangles<=(mobile?250000:600000),'orçamento geométrico');
 const nodes=meta.nodes;requireCondition(nodes.length>1&&nodes[0].type==='Group'&&nodes[0].parent===-1,'raiz');
 for(let i=1;i<nodes.length;i++){const n=nodes[i];requireCondition((n.type==='Group'||n.type==='Mesh'&&Number.isInteger(n.geometry)&&n.geometry>=0&&n.geometry<arrays.length&&Number.isInteger(n.color)&&n.color>=0&&n.color<=0xffffff&&n.opacity>0&&n.opacity<=1)&&Number.isInteger(n.parent)&&n.parent>=0&&n.parent<i&&nodes[n.parent].type==='Group'&&typeof n.name==='string','nó '+i)}
 for(const n of nodes)requireCondition(finiteArray(n.position,3)&&finiteArray(n.quaternion,4)&&finiteArray(n.scale,3)&&n.userData&&typeof n.userData==='object','transformação');
 const partNodes=meta.parts.map(p=>p.node);requireCondition(partNodes.every((n,i)=>Number.isInteger(n)&&nodes[n]?.parent===0&&(!i||n>partNodes[i-1]))&&nodes.filter(n=>n.parent===0).length===partNodes.length,'peças');
 // One loop per array type keeps element access monomorphic (a shared loop over Uint16/Uint32/Float32 ran ~50× slower).
 let checked=0;slice=now();
 for(const a of arrays){
  const p=a.attributes[0][1];for(let at=0;at<p.length;at+=CHECK_SLICE){requireCondition(finiteRange(p,at,Math.min(p.length,at+CHECK_SLICE)),'posição');if(now()-slice>6){await nextTask();slice=now()}}
  const index=a.index;if(index)for(let at=0;at<index.length;at+=CHECK_SLICE){const end=Math.min(index.length,at+CHECK_SLICE);requireCondition((index instanceof Uint16Array?max16(index,at,end):max32(index,at,end))<a.vertices,'índice fora da malha');if(now()-slice>6){await nextTask();slice=now()}}
  checked+=p.length+(index?.length||0);
 }

 const m=meta.model,reproductive=spec.context==='reproductive';
 const r=reproductive?createReproductiveContext(organ,definition,mobile,m.title,m.description):createOrganModelContext(organ,m.title,m.description,m.orientation);
 const geometries=meta.geometries.map((g,i)=>{
  const geometry=new THREE.BufferGeometry();
  // Typed views into the downloaded buffer: no copy; WebGL uploads only each view's range.
  for(const[a,array]of arrays[i].attributes)geometry.setAttribute(a.name,new THREE.BufferAttribute(array,a.itemSize,false));
  if(arrays[i].index)geometry.setIndex(new THREE.BufferAttribute(arrays[i].index,1));for(const group of g.groups||[])geometry.addGroup(group.start,group.count,group.materialIndex);
  geometry.userData=g.userData||{};const b=arrays[i].bounds;geometry.boundingBox=new THREE.Box3(new THREE.Vector3(b[0],b[1],b[2]),new THREE.Vector3(b[3],b[4],b[5]));geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(b[6],b[7],b[8]),b[9]);return geometry;
 });
 const objects=[r.group];
 for(let i=1;i<nodes.length;i++){
  const n=nodes[i],object=n.type==='Mesh'?(reproductive?r.mesh(geometries[n.geometry],n.color):r.mesh(geometries[n.geometry],n.color,n.opacity)):new THREE.Group();
  object.name=n.name;object.position.fromArray(n.position);object.quaternion.fromArray(n.quaternion);object.scale.fromArray(n.scale);object.userData=n.userData;
  if(n.parent>0)objects[n.parent].add(object);objects.push(object);
 }
 // Parts are registered through the generator's own context: reproductive parts read the content definition there.
 for(const p of meta.parts){const object=objects[p.node];if(reproductive)r.add(object,p.key,p.tissue);else{r.group.add(object);r.parts.push({...p.item,object})}}
 const model=reproductive?r.finish(m.limits):r.finish();Object.assign(model,m);
 const root=nodes[0];r.group.position.fromArray(root.position);r.group.quaternion.fromArray(root.quaternion);r.group.scale.fromArray(root.scale);r.group.userData=root.userData;r.group.updateMatrixWorld(true);
 model.bounds=new THREE.Box3().setFromObject(r.group);
 if(organ==='heart')model.title=definition.title||m.title;
 model.precomputedAsset={file,bytes:length,triangles,checkedValues:checked};
 return model;
}

export async function createAuthoredInterior(organ,definition={},{mobile=false}={}){
 const spec=AUTHORED_INTERIORS[organ],path=authoredInteriorPath(organ,mobile);
 try{
  const response=await fetch(new URL('./'+path,import.meta.url));if(!response.ok)throw new Error('HTTP '+response.status);
  const size=Number(response.headers?.get?.('content-length'));if(Number.isFinite(size)&&size>MAX_BYTES)throw new Error('arquivo excede o limite');
  // The file is gzip (≈ half the size); the stream inflates in small chunks, and the gzip trailer CRC is checked too.
  if(typeof DecompressionStream!=='function'||!response.body)throw new Error('DecompressionStream indisponível');
  const buffer=await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  return await decodeAuthoredInterior(buffer,organ,definition,{mobile,file:path});
 }catch(error){
  // Same model, generated on the device: slower, but the cut stays available if the file is missing or damaged.
  console.warn('Corte pré-calculado indisponível ('+path+'); gerando no aparelho.',error);
  const module=await import(spec.module);return module[spec.factory](definition,{mobile});
 }
}
export const createHeartInterior=(definition,options)=>createAuthoredInterior('heart',definition,options);
export const createOvaryInterior=(definition,options)=>createAuthoredInterior('ovary',definition,options);
export const createTestisInterior=(definition,options)=>createAuthoredInterior('testis',definition,options);
export const createVaginaInterior=(definition,options)=>createAuthoredInterior('vagina',definition,options);
