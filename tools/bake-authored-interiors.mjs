// Generates assets/interiors/{heart,ovary,testis,vagina}-{desktop,touch}-<version>.bin from the generator modules.
// Each file is the gzip of the lossless format read by authored-interiors.js (header, JSON, Float32/Uint16/Uint32 blocks).
//   node tools/bake-authored-interiors.mjs          write the files and print the SHA-256 for service-worker.js
//   node tools/bake-authored-interiors.mjs --check  regenerate in memory and compare byte by byte with the files
// The generators run here exactly as in the app (definition {}); the decoder in authored-interiors.js re-applies
// what depends on the content definition. Output is deterministic: same sources give the same bytes.
import {register} from 'node:module';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const vendor=p=>pathToFileURL(path.join(ROOT,'vendor',p)).href;
// Same mapping as the import map in index.html.
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(vendor('build/three.module.js'))},shortCircuit:true};if(s.startsWith('three/addons/'))return{url:${JSON.stringify(vendor('examples/jsm/'))}+s.slice(13),shortCircuit:true};return n(s,c)}`));

const THREE=await import('three');
const {AUTHORED_INTERIORS,AUTHORED_MAGIC,AUTHORED_HEADER,authoredInteriorPath,crc32Update}=await import(pathToFileURL(path.join(ROOT,'authored-interiors.js')).href);
const check=process.argv.includes('--check');

const isPlain=v=>v===null||['string','boolean','number'].includes(typeof v)||Array.isArray(v)||Object.getPrototypeOf(v)===Object.prototype;
// JSON must carry every value bit for bit (no NaN, undefined, class instances or typed arrays). JSON writes -0 as 0,
// so its paths are listed in meta.negativeZero and restored by the decoder.
function assertJSON(value,where,trail=[],zeros=[]){
 if(typeof value==='number'){if(!Number.isFinite(value))throw new Error(where+': número não serializável '+value);if(Object.is(value,-0))zeros.push(trail);return zeros}
 if(!isPlain(value))throw new Error(where+': valor não serializável ('+(value?.constructor?.name||typeof value)+')');
 if(value&&typeof value==='object')for(const[k,v]of Object.entries(value)){if(v===undefined)throw new Error(where+'.'+k+': undefined');assertJSON(v,where+'.'+k,[...trail,Array.isArray(value)?+k:k],zeros)}
 return zeros;
}
const defaults=new THREE.Mesh();
function assertDefaults(o,where){
 for(const k of['visible','renderOrder','frustumCulled','castShadow','receiveShadow','matrixAutoUpdate','matrixWorldAutoUpdate'])if(o[k]!==defaults[k])throw new Error(where+': '+k+' fora do padrão');
 if(o.layers.mask!==1||!o.up.equals(defaults.up)||o.rotation.order!=='XYZ'||o.animations.length)throw new Error(where+': camada/eixo/rotação fora do padrão');
 if(o.isMesh&&(o.morphTargetInfluences||Array.isArray(o.material)))throw new Error(where+': malha com morph ou vários materiais');
}

function bake(organ,mobile){
 const spec=AUTHORED_INTERIORS[organ];
 return import(pathToFileURL(path.join(ROOT,spec.module)).href).then(module=>{
  const model=module[spec.factory]({}, {mobile});
  const chunks=[];let payload=0;
  const put=array=>{const offset=payload,bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength);chunks.push(bytes);payload+=bytes.byteLength;const pad=(4-payload%4)%4;if(pad){chunks.push(new Uint8Array(pad));payload+=pad}return{type:array.constructor.name,offset,count:array.length}};
  const geometryIds=new Map(),geometries=[],nodes=[],ids=new Map();
  model.group.updateMatrixWorld(true);
  model.group.traverse(o=>{
   const where=organ+':'+(o.name||'(sem nome)'),parent=o===model.group?-1:ids.get(o.parent);assertDefaults(o,where);
   if(!o.isMesh&&!(o.isGroup||o===model.group))throw new Error(where+': tipo '+o.type);
   const node={type:o.isMesh?'Mesh':'Group',parent,name:o.name,position:o.position.toArray(),quaternion:o.quaternion.toArray(),scale:o.scale.toArray(),userData:o.userData};
   if(o.isMesh){
    const g=o.geometry,m=o.material;
    if(!geometryIds.has(g)){
     if(Object.keys(g.morphAttributes).length||g.drawRange.start!==0||g.drawRange.count!==Infinity)throw new Error(where+': geometria com morph ou drawRange');
     for(const[name,a]of Object.entries(g.attributes))if(!a.isBufferAttribute||a.isInterleavedBufferAttribute||!(a.array instanceof Float32Array)||a.normalized||a.usage!==THREE.StaticDrawUsage||a.array.length!==a.count*a.itemSize)throw new Error(where+': atributo '+name+' fora do padrão');
     if(g.index&&!(g.index.array instanceof Uint16Array||g.index.array instanceof Uint32Array))throw new Error(where+': índice '+g.index.array.constructor.name);
     if(!g.boundingBox)g.computeBoundingBox();if(!g.boundingSphere)g.computeBoundingSphere();
     geometryIds.set(g,geometries.length);
     geometries.push({attributes:Object.entries(g.attributes).map(([name,a])=>({name,itemSize:a.itemSize,...put(a.array)})),index:g.index?put(g.index.array):null,groups:g.groups.map(({start,count,materialIndex})=>({start,count,materialIndex})),userData:g.userData,bounds:put(new Float64Array([...g.boundingBox.min.toArray(),...g.boundingBox.max.toArray(),...g.boundingSphere.center.toArray(),g.boundingSphere.radius]))});
    }
    if(!m.isMeshStandardMaterial||m.map||m.normalMap)throw new Error(where+': material fora do padrão');
    Object.assign(node,{geometry:geometryIds.get(g),color:m.color.getHex(),opacity:m.opacity});
   }
   ids.set(o,nodes.length);nodes.push(node);
  });
  const topLevel=nodes.flatMap((n,i)=>n.parent===0?[i]:[]),parts=model.parts.map(p=>{const node=ids.get(p.object),{object,...item}=p;return spec.context==='reproductive'?{node,key:p.partId,tissue:object.userData.tissue}:{node,item}});
  if(parts.length!==spec.parts||parts.some((p,i)=>p.node!==topLevel[i])||topLevel.length!==parts.length)throw new Error(organ+': peças não correspondem aos filhos da raiz ('+parts.length+')');
  const {group,parts:_p,dispose,bounds,...fields}=model;
  const meta={schema:1,kind:'authored-interior',organ,mobile,three:THREE.REVISION,model:fields,nodes,geometries,parts};
  meta.negativeZero=assertJSON(meta,organ);
  let json=Buffer.from(JSON.stringify(meta),'utf8');const pad=(4-json.length%4)%4;json=Buffer.concat([json,Buffer.alloc(pad,0x20)]);
  const header=Buffer.alloc(AUTHORED_HEADER),body=Buffer.concat([json,...chunks]);
  header.write(AUTHORED_MAGIC,0,'latin1');header.writeUInt32LE(1,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(payload,16);header.writeUInt32LE((crc32Update(0xffffffff,body)^0xffffffff)>>>0,20);
  const triangles=geometries.reduce((n,g)=>n+(g.index?g.index.count:g.attributes[0].count/3)/3,0);model.dispose();
  return{bytes:Buffer.concat([header,body]),triangles,meshes:nodes.filter(n=>n.type==='Mesh').length,parts:parts.length};
 });
}

let failed=false;
for(const organ of Object.keys(AUTHORED_INTERIORS))for(const mobile of[false,true]){
 const file=authoredInteriorPath(organ,mobile),target=path.join(ROOT,file),result=await bake(organ,mobile);
 // Compared after gunzip: the gzip header may vary with the zlib build, the content may not.
 if(check){const same=existsSync(target)&&Buffer.compare(gunzipSync(readFileSync(target)),result.bytes)===0;if(!same)failed=true;console.log((same?'igual     ':'DIFERENTE ')+file);continue}
 const packed=gzipSync(result.bytes,{level:9}),packedSha=createHash('sha256').update(packed).digest('hex');writeFileSync(target,packed);
 console.log(file.padEnd(44),(packed.length/1048576).toFixed(2).padStart(6)+' MB ('+(result.bytes.length/1048576).toFixed(2)+' MB sem gzip)',String(result.triangles).padStart(7)+' triângulos',String(result.meshes).padStart(3)+' malhas',result.parts+' peças');
 console.log('  "'+file+'": "'+packedSha+'",');
}
if(failed){console.error('Arquivos desatualizados: rode node tools/bake-authored-interiors.mjs');process.exit(1)}
