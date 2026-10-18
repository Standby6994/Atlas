// Reads label volumes from the OpenOrganelle N5 containers (HHMI Janelia, CC BY 4.0): gzip blocks of big-endian
// uint16/uint64 labels, x fastest. Used to cut one organelle (with its membranes) out of a whole cell at 8 nm.
import {gunzipSync} from 'node:zlib';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const BUCKET='https://janelia-cosem-datasets.s3.amazonaws.com/',CACHE=path.join(ROOT,'.cache','cosem');
async function get(key,{optional=false}={}){const file=path.join(CACHE,key);if(!existsSync(file)){let r;for(let a=1;;a++){try{r=await fetch(BUCKET+key);break}catch(e){if(a>=4)throw e;await new Promise(s=>setTimeout(s,800*a))}}
  if(r.status===404){if(optional)return null;throw new Error('N5 404: '+key)}if(!r.ok)throw new Error('N5 '+r.status+': '+key);mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,Buffer.from(await r.arrayBuffer()))}return readFileSync(file)}

export async function dataset(base){const a=JSON.parse((await get(base+'/attributes.json')).toString('utf8'));return{base,dims:a.dimensions,block:a.blockSize,type:a.dataType,res:a.pixelResolution?.dimensions||[1,1,1],offset:(a.transform?.translate||[0,0,0]).slice().reverse()}}
/** Block (bx,by,bz) as a typed array of its own size (edge blocks are smaller), or null when absent (empty). */
export async function block(ds,bx,by,bz){
  const raw=await get(ds.base+'/'+bx+'/'+by+'/'+bz,{optional:true});if(!raw)return null;const view=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);
  const mode=view.getUint16(0),nd=view.getUint16(2),size=[];let at=4;for(let i=0;i<nd;i++){size.push(view.getUint32(at));at+=4}if(mode===1)at+=4;
  const data=gunzipSync(raw.subarray(at)),n=size.reduce((a,b)=>a*b,1),out=ds.type==='uint64'?new Float64Array(n):new Uint32Array(n),dv=new DataView(data.buffer,data.byteOffset,data.byteLength);
  if(ds.type==='uint16')for(let i=0;i<n;i++)out[i]=dv.getUint16(i*2);else if(ds.type==='uint32')for(let i=0;i<n;i++)out[i]=dv.getUint32(i*4);else if(ds.type==='uint8')for(let i=0;i<n;i++)out[i]=dv.getUint8(i);else for(let i=0;i<n;i++)out[i]=Number(dv.getBigUint64(i*8));
  return{size,data:out};
}
/** Voxel mask (Uint8Array, x fastest) of `label` inside the voxel box [lo,hi) — or of any label when label is null. */
export async function mask(ds,lo,hi,label,{fn=null}={}){
  const dim=[0,1,2].map(k=>hi[k]-lo[k]),out=new Uint8Array(dim[0]*dim[1]*dim[2]),b0=lo.map((v,k)=>Math.floor(v/ds.block[k])),b1=hi.map((v,k)=>Math.floor((v-1)/ds.block[k]));
  for(let bz=b0[2];bz<=b1[2];bz++)for(let by=b0[1];by<=b1[1];by++)for(let bx=b0[0];bx<=b1[0];bx++){const b=await block(ds,bx,by,bz);if(!b)continue;const o=[bx*ds.block[0],by*ds.block[1],bz*ds.block[2]];
    for(let z=Math.max(lo[2],o[2]);z<Math.min(hi[2],o[2]+b.size[2]);z++)for(let y=Math.max(lo[1],o[1]);y<Math.min(hi[1],o[1]+b.size[1]);y++){const row=((z-o[2])*b.size[1]+(y-o[1]))*b.size[0],orow=((z-lo[2])*dim[1]+(y-lo[1]))*dim[0];
      for(let x=Math.max(lo[0],o[0]);x<Math.min(hi[0],o[0]+b.size[0]);x++){const v=b.data[row+x-o[0]];if(fn?fn(v):(label===null?v>0:v===label))out[orow+x-lo[0]]=1}}}
  return{data:out,dim,lo};
}
/** Smoothed density field (0–1) of a mask, ready for the surface-nets extraction of pdb.mjs (iso 0.5). */
export function field(m,res,offset=[0,0,0],blur=1){
  const [nx,ny,nz]=m.dim,at=(i,j,k)=>i+nx*(j+ny*k);let f=Float32Array.from(m.data);
  for(let pass=0;pass<blur;pass++){const g=new Float32Array(f.length);for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){let s=0,c=0;for(let dk=-1;dk<=1;dk++)for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const ii=i+di,jj=j+dj,kk=k+dk;if(ii<0||jj<0||kk<0||ii>=nx||jj>=ny||kk>=nz)continue;s+=f[at(ii,jj,kk)];c++}g[at(i,j,k)]=s/c}f=g}
  // Anisotropic voxels: isoSurface works on a cubic grid, so positions are rescaled afterwards (see scaleMesh).
  return{field:f,nx,ny,nz,min:[0,0,0],spacing:1,res,origin:m.lo.map((v,k)=>v*res[k]+offset[k])};
}
export function scaleMesh(mesh,f){const P=mesh.positions;for(let i=0;i<P.length;i+=3)for(let k=0;k<3;k++)P[i+k]=f.origin[k]+P[i+k]*f.res[k];return mesh}
