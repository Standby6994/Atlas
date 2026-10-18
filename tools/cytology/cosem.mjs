// Reads organelle meshes from OpenOrganelle / COSEM (HHMI Janelia, CC BY 4.0): whole cells imaged by FIB-SEM and
// segmented organelle by organelle. Bucket: s3://janelia-cosem-datasets (anonymous HTTPS). Meshes are Neuroglancer
// "multilod_draco": per segment, an .index manifest and a file of Draco fragments, several levels of detail each.
// Downloads are cached in .cache/cosem (rebuildable, not versioned).
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const BUCKET='https://janelia-cosem-datasets.s3.amazonaws.com/';
const CACHE=path.join(ROOT,'.cache','cosem');
const require=createRequire(import.meta.url);
let decoderModule=null;
async function draco(){if(!decoderModule){const factory=require(path.join(ROOT,'models/draco/draco_decoder.js'));decoderModule=await factory({})}return decoderModule}

async function get(key,{text=false,optional=false,range=null}={}){
  // ':' is not a valid file name character on Windows (it would open an NTFS stream): escape it.
  const file=path.join(CACHE,key.replace(/:/g,'%3A')+(range?'.'+range[0]+'-'+range[1]:''));
  if(!existsSync(file)){
    let response;for(let attempt=1;;attempt++){try{response=await fetch(BUCKET+key,range?{headers:{Range:'bytes='+range[0]+'-'+(range[1]-1)}}:{});break}catch(error){if(attempt>=4)throw error;await new Promise(r=>setTimeout(r,800*attempt))}}
    if(!response.ok){if(optional)return null;throw new Error('COSEM '+response.status+': '+key)}
    mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,Buffer.from(await response.arrayBuffer()));
  }
  const bytes=readFileSync(file);return text?bytes.toString('utf8'):bytes;
}
/** Keys directly below a prefix (folders end with "/"). */
export async function list(prefix){
  const out=[];let token='';
  do{const r=await fetch(BUCKET+'?list-type=2&delimiter=/&prefix='+encodeURIComponent(prefix)+(token?'&continuation-token='+encodeURIComponent(token):''));const xml=await r.text();
    for(const m of xml.matchAll(/<(Prefix|Key)>([^<]*)<\/\1>/g))if(m[2]!==prefix)out.push(m[2].slice(prefix.length));
    token=(xml.match(/<NextContinuationToken>([^<]*)</)||[])[1]||''}while(token);
  return out;
}
/** Mesh layer description: info JSON and segment labels (if any). */
export async function layer(base){
  const info=JSON.parse(await get(base+'/info',{text:true}));
  let labels={};
  if(info.segment_properties){const props=JSON.parse(await get(base+'/'+info.segment_properties+'/info',{text:true,optional:true})||'{}');const ids=props.inline?.ids||[];for(const p of props.inline?.properties||[])if(p.type==='label'||p.id==='label')ids.forEach((id,i)=>labels[id]=p.values[i])}
  return{base,info,labels};
}
function parseIndex(buffer){
  const view=new DataView(buffer.buffer,buffer.byteOffset,buffer.byteLength);let at=0;
  const f32=n=>{const out=[];for(let i=0;i<n;i++){out.push(view.getFloat32(at,true));at+=4}return out},u32=n=>{const out=[];for(let i=0;i<n;i++){out.push(view.getUint32(at,true));at+=4}return out};
  const chunkShape=f32(3),gridOrigin=f32(3),numLods=u32(1)[0],lodScales=f32(numLods),vertexOffsets=f32(numLods*3),fragmentsPerLod=u32(numLods),lods=[];
  for(let lod=0;lod<numLods;lod++){const n=fragmentsPerLod[lod],xyz=u32(3*n),sizes=u32(n);lods.push({positions:Array.from({length:n},(_,i)=>[xyz[i],xyz[n+i],xyz[2*n+i]]),sizes})}
  return{chunkShape,gridOrigin,numLods,lodScales,vertexOffsets,lods};
}
/** Levels of detail of one segment: triangles are unknown until decoded, so this reports bytes per level. */
export async function levels({base},id){const manifest=parseIndex(await get(base+'/'+id+'.index'));return manifest.lods.map(l=>l.sizes.reduce((a,b)=>a+b,0))}
/** Legacy (single-resolution) mesh of a segment, as used by the hand-annotated ground-truth crops. */
export async function legacy(base,id){
  const manifest=JSON.parse(await get(base+'/'+id+':0',{text:true}));const positions=[],index=[];
  for(const fragment of manifest.fragments||[]){const bytes=await get(base+'/'+fragment),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),nv=view.getUint32(0,true),base0=positions.length/3;
    for(let i=0;i<nv*3;i++)positions.push(view.getFloat32(4+i*4,true));const start=4+nv*12;for(let i=start;i+4<=bytes.byteLength;i+=4)index.push(base0+view.getUint32(i,true))}
  return{positions:Float32Array.from(positions),index:Uint32Array.from(index)};
}
/** One segment at a level of detail (0 = finest), in nanometres: {positions: Float32Array, index: Uint32Array, lods}. */
export async function segment({base,info},id,lod=0){
  const manifest=parseIndex(await get(base+'/'+id+'.index'));
  if(!manifest.numLods)return null;lod=Math.min(lod,manifest.numLods-1);
  const dec=await draco(),bits=info.vertex_quantization_bits,q=(1<<bits)-1,t=info.transform||[1,0,0,0,0,1,0,0,0,0,1,0];
  // Fragments are stored finest level first: only the bytes of the requested level are downloaded.
  let start=0;for(let l=0;l<lod;l++)start+=manifest.lods[l].sizes.reduce((a,b)=>a+b,0);const length=manifest.lods[lod].sizes.reduce((a,b)=>a+b,0);if(!length)return{positions:new Float32Array(0),index:new Uint32Array(0),lods:manifest.numLods};
  const data=await get(base+'/'+id,{range:[start,start+length]});let offset=0;
  const positions=[],index=[];const scale=manifest.chunkShape.map(s=>s*2**lod),vo=manifest.vertexOffsets.slice(lod*3,lod*3+3);
  const {positions:frags,sizes}=manifest.lods[lod];
  for(let f=0;f<frags.length;f++){
    const size=sizes[f];if(!size)continue;const bytes=data.subarray(offset,offset+size);offset+=size;
    const buffer=new dec.DecoderBuffer();buffer.Init(new Int8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength),bytes.byteLength);
    const decoder=new dec.Decoder(),mesh=new dec.Mesh(),status=decoder.DecodeBufferToMesh(buffer,mesh);
    if(!status.ok())throw new Error('Draco: '+status.error_msg());
    const attr=decoder.GetAttribute(mesh,decoder.GetAttributeId(mesh,dec.POSITION)),nv=mesh.num_points(),arr=new dec.DracoFloat32Array();decoder.GetAttributeFloatForAllPoints(mesh,attr,arr);
    const base0=positions.length/3,fp=frags[f];
    for(let i=0;i<nv;i++){const g=[0,1,2].map(k=>manifest.gridOrigin[k]+vo[k]+scale[k]*(fp[k]+arr.GetValue(i*3+k)/q));
      positions.push(t[0]*g[0]+t[1]*g[1]+t[2]*g[2]+t[3],t[4]*g[0]+t[5]*g[1]+t[6]*g[2]+t[7],t[8]*g[0]+t[9]*g[1]+t[10]*g[2]+t[11])}
    const nf=mesh.num_faces(),face=new dec.DracoInt32Array();for(let i=0;i<nf;i++){decoder.GetFaceFromMesh(mesh,i,face);index.push(base0+face.GetValue(0),base0+face.GetValue(1),base0+face.GetValue(2))}
    dec.destroy(face);dec.destroy(arr);dec.destroy(mesh);dec.destroy(decoder);dec.destroy(buffer);
  }
  return{positions:Float32Array.from(positions),index:Uint32Array.from(index),lods:manifest.numLods};
}
