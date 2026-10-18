// Writes a cytology model pack (.bin, gzip) read by cytology-real.js.
// Layout: "ATLCYTO1", uint32 JSON length, JSON (UTF-8), zero padding to 8 bytes, then 4-byte aligned blocks.
// Positions: Uint16 normalized over the model bounds (the mesh is placed by position/scale). Normals: Int8 normalized.
// Indices: Uint16 or Uint32. Optional per-vertex colour: Uint8 normalized RGB (cavity shading baked by the tools).
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {normals as smoothNormals,bounds as meshBounds} from './mesh.mjs';

export const MAGIC='ATLCYTO1';
// Spatially compact blocks of at most `size` triangles: triangles sorted by the Morton code of their centroid.
function chunks(mesh,size){
  const {positions:P,index:I}=mesh,nt=I.length/3;if(nt<=size*1.25)return[mesh];
  const b=meshBounds(P),ext=b.max.map((v,k)=>Math.max(v-b.min[k],1e-9)),spread=v=>{v&=1023;v=(v|(v<<16))&0x030000FF;v=(v|(v<<8))&0x0300F00F;v=(v|(v<<4))&0x030C30C3;return(v|(v<<2))&0x09249249};
  const keys=new Float64Array(nt),order=new Uint32Array(nt);
  for(let t=0;t<nt;t++){const c=[0,1,2].map(k=>(P[I[t*3]*3+k]+P[I[t*3+1]*3+k]+P[I[t*3+2]*3+k])/3),g=c.map((v,k)=>Math.min(1023,Math.floor((v-b.min[k])/ext[k]*1024)));keys[t]=spread(g[0])|(spread(g[1])<<1)|(spread(g[2])<<2);order[t]=t}
  order.sort((x,y)=>keys[x]-keys[y]);const out=[];
  for(let s=0;s<nt;s+=size){const remap=new Map(),pos=[],nor=[],col=[],idx=[];
    for(let k=s;k<Math.min(nt,s+size);k++){const t=order[k];for(let j=0;j<3;j++){const v=I[t*3+j];let r=remap.get(v);if(r===undefined){r=remap.size;remap.set(v,r);pos.push(P[v*3],P[v*3+1],P[v*3+2]);nor.push(mesh.normals[v*3],mesh.normals[v*3+1],mesh.normals[v*3+2]);if(mesh.colors)col.push(mesh.colors[v*3],mesh.colors[v*3+1],mesh.colors[v*3+2])}idx.push(r)}}
    out.push({positions:Float32Array.from(pos),index:Uint32Array.from(idx),normals:Float32Array.from(nor),colors:mesh.colors?Uint8Array.from(col):null})}
  return out;
}
/** model: {id, profile, units, title, credits:[…], parts:[{id, meshes:[{name, mesh:{positions,index}, color, roughness, opacity, colors?}]}]} */
export function writePack(file,model){
  const all={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
  for(const part of model.parts)for(const m of part.meshes){const b=meshBounds(m.mesh.positions);for(let k=0;k<3;k++){all.min[k]=Math.min(all.min[k],b.min[k]);all.max[k]=Math.max(all.max[k],b.max[k])}}
  const size=all.max.map((v,k)=>Math.max(v-all.min[k],1e-9)),blocks=[];let offset=0;
  const block=typed=>{const bytes=Buffer.from(typed.buffer,typed.byteOffset,typed.byteLength),at=offset;blocks.push(bytes);offset+=bytes.length;const pad=(4-offset%4)%4;if(pad){blocks.push(Buffer.alloc(pad));offset+=pad}return[at,bytes.length]};
  let triangles=0,vertices=0;
  const encode=(m,{positions,index,normals,colors})=>{
    const nv=positions.length/3,q=new Uint16Array(nv*3),qn=new Int8Array(nv*3);
    for(let i=0;i<nv*3;i++){q[i]=Math.round((positions[i]-all.min[i%3])/size[i%3]*65535);qn[i]=Math.round(normals[i]*127)}
    const wide=nv>65535,idx=wide?Uint32Array.from(index):Uint16Array.from(index);triangles+=index.length/3;vertices+=nv;
    const out={name:m.name||'surface',color:m.color,roughness:m.roughness??.6,opacity:m.opacity??1,sheen:m.sheen||0,vertices:nv,triangles:index.length/3,position:block(q),normal:block(qn),index:[...block(idx),wide?4:2]};
    // Colours stay sRGB bytes (8-bit linear would band in the shadows); the reader converts them in the vertex shader.
    if(colors)out.colors=block(colors);return out};
  const parts=model.parts.map(part=>({id:part.id,meshes:part.meshes.filter(m=>m.mesh.index.length).flatMap(m=>
    // Normals come from the whole surface, then it is cut into compact blocks: the touch index (BVH) builds one block at
    // a time between frames and the camera culls blocks off screen.
    chunks({...m.mesh,normals:smoothNormals(m.mesh),colors:m.colors||null},model.chunk||24000).map(c=>encode(m,c)))}));
  const meta={schema:1,id:model.id,profile:model.profile,units:model.units||'nm',title:model.title||'',bounds:all,parts,credits:model.credits||[],notes:model.notes||'',frame:model.frame||null,stats:{triangles,vertices}};
  const json=Buffer.from(JSON.stringify(meta),'utf8'),head=Buffer.alloc(12);head.write(MAGIC,0,'ascii');head.writeUInt32LE(json.length,8);
  let pre=Buffer.concat([head,json]);const pad=(8-pre.length%8)%8;pre=Buffer.concat([pre,Buffer.alloc(pad)]);
  const raw=Buffer.concat([pre,...blocks]),gz=gzipSync(raw,{level:9});
  mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,gz);
  return{file,bytes:gz.length,raw:raw.length,triangles,vertices,sha256:createHash('sha256').update(gz).digest('hex')};
}
