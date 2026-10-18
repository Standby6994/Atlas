// Reads binary segmentations stored as MRC volumes (EMPIAR, CC0), downsampled by box averaging so the membrane
// fraction becomes a 0–1 field for the surface-nets extraction in pdb.mjs.
import {openSync,readSync,closeSync,statSync} from 'node:fs';

export function header(file){const fd=openSync(file,'r'),b=Buffer.alloc(1024);readSync(fd,b,0,1024,0);closeSync(fd);const i=k=>b.readInt32LE(k*4);return{nx:i(0),ny:i(1),nz:i(2),mode:i(3),offset:1024+i(23)}}
/** Field of the fraction of voxels with value `label` (byte value) in bins of `bin`³ voxels, x fastest. */
export function binnedField(file,{label,bin=4,voxel=1}){
  const h=header(file),fd=openSync(file,'r'),[nx,ny,nz]=[h.nx,h.ny,h.nz],bx=Math.floor(nx/bin),by=Math.floor(ny/bin),bz=Math.floor(nz/bin),out=new Float32Array(bx*by*bz),slice=Buffer.alloc(nx*ny);
  for(let z=0;z<bz*bin;z++){readSync(fd,slice,0,nx*ny,h.offset+z*nx*ny);const k=Math.floor(z/bin);for(let y=0;y<by*bin;y++){const j=Math.floor(y/bin),row=y*nx,o=(k*by+j)*bx;for(let x=0;x<bx*bin;x++)if(slice[row+x]===label)out[o+Math.floor(x/bin)]+=1}}
  closeSync(fd);const norm=1/(bin*bin*bin);for(let i=0;i<out.length;i++)out[i]*=norm;
  return{field:out,nx:bx,ny:by,nz:bz,min:[0,0,0],spacing:1,res:[voxel*bin,voxel*bin,voxel*bin],origin:[0,0,0]};
}
export function fileSize(file){return statSync(file).size}
