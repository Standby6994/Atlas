// Molecular surfaces from the Protein Data Bank (wwPDB archive: CC0 1.0). Reads mmCIF (atom_site), builds a
// Gaussian density of the heavy atoms on a grid and extracts its iso-surface with surface nets (one vertex per
// crossing cell, quads across crossing edges). Downloads are cached in .cache/pdb.
import {gunzipSync} from 'node:zlib';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const CACHE=path.join(ROOT,'.cache','pdb');
const RADIUS={C:1.7,N:1.55,O:1.52,S:1.8,P:1.8,SE:1.9,FE:1.4,MG:1.2,ZN:1.2,MN:1.2,CU:1.2,CA:1.6,K:1.8,NA:1.4,CL:1.75,F:1.47};

/** Downloads <code>.cif (or <code>-assembly<n>.cif for a biological assembly) and returns its text. */
export async function fetchCif(code,{assembly=0}={}){
  const name=code.toUpperCase()+(assembly?'-assembly'+assembly:'')+'.cif',file=path.join(CACHE,name);
  if(!existsSync(file)){
    const url='https://files.rcsb.org/download/'+name+'.gz';const r=await fetch(url);if(!r.ok)throw new Error('PDB '+r.status+': '+url);
    mkdirSync(CACHE,{recursive:true});writeFileSync(file,gunzipSync(Buffer.from(await r.arrayBuffer())));
  }
  return readFileSync(file,'utf8');
}
function tokens(line){const out=[];let i=0;while(i<line.length){const c=line[i];if(c===' '||c==='\t'){i++;continue}if(c==="'"||c==='"'){let j=i+1;while(j<line.length&&!(line[j]===c&&(j+1>=line.length||line[j+1]===' ')))j++;out.push(line.slice(i+1,j));i=j+1}else{let j=i;while(j<line.length&&line[j]!==' '&&line[j]!=='\t')j++;out.push(line.slice(i,j));i=j}}return out}
/** Atoms of the first model: {x,y,z,element,chain,entity,comp,seq,count}. Hydrogens and waters are skipped. */
export function parseAtoms(text,{waters=false}={}){
  const lines=text.split('\n');let i=lines.findIndex(l=>l.startsWith('_atom_site.'));if(i<0)throw new Error('mmCIF sem atom_site');
  const cols=[];while(lines[i].startsWith('_atom_site.')){cols.push(lines[i].trim().slice(11));i++}
  const col=n=>cols.indexOf(n),cx=col('Cartn_x'),cy=col('Cartn_y'),cz=col('Cartn_z'),ce=col('type_symbol'),cc=col('auth_asym_id')>=0?col('auth_asym_id'):col('label_asym_id'),cen=col('label_entity_id'),ccomp=col('label_comp_id'),cseq=col('auth_seq_id'),cmodel=col('pdbx_PDB_model_num'),cname=col('label_atom_id');
  const x=[],y=[],z=[],element=[],chain=[],entity=[],comp=[],seq=[],name=[];let firstModel=null;
  for(;i<lines.length;i++){const l=lines[i];if(!l||l[0]==='#'||l.startsWith('loop_')||l[0]==='_')break;const t=tokens(l);if(t.length<cols.length)continue;
    if(cmodel>=0){if(firstModel===null)firstModel=t[cmodel];if(t[cmodel]!==firstModel)continue}
    const e=t[ce].toUpperCase();if(e==='H'||e==='D')continue;if(!waters&&(t[ccomp]==='HOH'||t[ccomp]==='WAT'))continue;
    x.push(+t[cx]);y.push(+t[cy]);z.push(+t[cz]);element.push(e);chain.push(t[cc]);entity.push(t[cen]);comp.push(t[ccomp]);seq.push(+t[cseq]||0);name.push(t[cname])}
  return{x:Float32Array.from(x),y:Float32Array.from(y),z:Float32Array.from(z),element,chain,entity,comp,seq,name,count:x.length};
}
/** Entity descriptions (id → text), to decide which chains form which part. */
export function entities(text){
  const lines=text.split('\n'),start=lines.findIndex(l=>l.startsWith('_entity.id'));if(start<0)return{};
  // Key-value form (a single entity) or a loop_ table.
  if(lines[start-1]?.trim()!=='loop_'){const kv={};for(let i=start;i<lines.length&&lines[i].startsWith('_entity.');i++){const m=lines[i].match(/^_entity\.(\S+)\s+(.*)$/);if(m)kv[m[1]]=tokens(m[2])[0]}return kv.id?{[kv.id]:kv.pdbx_description||''}:{}}
  const cols=[];let i=start;while(lines[i]?.startsWith('_entity.')){cols.push(lines[i].trim().slice(8));i++}
  const rows=[];while(i<lines.length&&!lines[i].startsWith('#')&&!lines[i].startsWith('_')&&!lines[i].startsWith('loop_')){rows.push(lines[i]);i++}
  const all=tokens(rows.join(' ')),out={};if(!cols.length)return out;for(let r=0;r+cols.length<=all.length;r+=cols.length)out[all[r+cols.indexOf('id')]]=all[r+cols.indexOf('pdbx_description')];return out;
}
/** Gaussian surface of the atoms with group(atomIndex) → group id per vertex. Units: ångström.
 *  spacing: grid step; smooth: Gaussian width as a fraction of the atom radius; probe: radius added to every atom.
 *  points: optional extra pseudo-atoms {x,y,z,r} arrays (lipids, built helices). */
export function densityField(atoms,{spacing=1.5,smooth=.6,probe=.8,select=null,pad=6}={}){
  const ids=[];for(let a=0;a<atoms.count;a++)if(!select||select(a))ids.push(a);
  const R=a=>(atoms.radius?.[a]||RADIUS[atoms.element[a]]||1.7)+probe;
  let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const a of ids){const p=[atoms.x[a],atoms.y[a],atoms.z[a]];for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k])}}
  min=min.map(v=>v-pad);max=max.map(v=>v+pad);const [nx,ny,nz]=min.map((v,k)=>Math.ceil((max[k]-v)/spacing)+1);
  const field=new Float32Array(nx*ny*nz),at=(i,j,k)=>i+nx*(j+ny*k);
  // Normalised so a lone atom's surface sits at its radius: iso = 1 at distance R.
  for(const a of ids){const r=R(a),s=r*smooth,inv=1/(2*s*s),cut=r+3*s,ax=atoms.x[a],ay=atoms.y[a],az=atoms.z[a],norm=Math.exp(r*r*inv);
    const i0=Math.max(0,Math.floor((ax-cut-min[0])/spacing)),i1=Math.min(nx-1,Math.ceil((ax+cut-min[0])/spacing)),j0=Math.max(0,Math.floor((ay-cut-min[1])/spacing)),j1=Math.min(ny-1,Math.ceil((ay+cut-min[1])/spacing)),k0=Math.max(0,Math.floor((az-cut-min[2])/spacing)),k1=Math.min(nz-1,Math.ceil((az+cut-min[2])/spacing));
    for(let k=k0;k<=k1;k++){const dz=min[2]+k*spacing-az;for(let j=j0;j<=j1;j++){const dy=min[1]+j*spacing-ay,dyz=dy*dy+dz*dz;if(dyz>cut*cut)continue;for(let i=i0;i<=i1;i++){const dx=min[0]+i*spacing-ax,d2=dx*dx+dyz;if(d2<cut*cut)field[at(i,j,k)]+=Math.exp(-d2*inv)*norm}}}}
  // Trilinear sample (0 outside), used for cavity shading.
  const sample=(x,y,z)=>{const fx=(x-min[0])/spacing,fy=(y-min[1])/spacing,fz=(z-min[2])/spacing,i=Math.floor(fx),j=Math.floor(fy),k=Math.floor(fz);if(i<0||j<0||k<0||i>=nx-1||j>=ny-1||k>=nz-1)return 0;const u=fx-i,v=fy-j,w=fz-k;let s=0;
    for(let c=0;c<8;c++){const a=c&1,b=(c>>1)&1,d=c>>2;s+=field[at(i+a,j+b,k+d)]*(a?u:1-u)*(b?v:1-v)*(d?w:1-w)}return s};
  return{field,nx,ny,nz,min,spacing,sample};
}
/** Surface nets of a density field at `iso`: a vertex per crossing cell, quads across crossing edges. */
export function isoSurface({field,nx,ny,nz,min,spacing},iso=1){
  const at=(i,j,k)=>i+nx*(j+ny*k),cellVertex=new Int32Array((nx-1)*(ny-1)*(nz-1)).fill(-1),cell=(i,j,k)=>i+(nx-1)*(j+(ny-1)*k),positions=[];
  const corners=[[0,0,0],[1,0,0],[0,1,0],[1,1,0],[0,0,1],[1,0,1],[0,1,1],[1,1,1]],edges=[[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]];
  const val=new Float64Array(8);
  for(let k=0;k<nz-1;k++)for(let j=0;j<ny-1;j++)for(let i=0;i<nx-1;i++){
    let inside=0;for(let c=0;c<8;c++){const [a,b,d]=corners[c];val[c]=field[at(i+a,j+b,k+d)];if(val[c]>iso)inside++}
    if(!inside||inside===8)continue;let sx=0,sy=0,sz=0,m=0;
    for(const [p,q] of edges){const vp=val[p],vq=val[q];if((vp>iso)===(vq>iso))continue;const t=(iso-vp)/(vq-vp),cp=corners[p],cq=corners[q];sx+=cp[0]+t*(cq[0]-cp[0]);sy+=cp[1]+t*(cq[1]-cp[1]);sz+=cp[2]+t*(cq[2]-cp[2]);m++}
    cellVertex[cell(i,j,k)]=positions.length/3;positions.push(min[0]+(i+sx/m)*spacing,min[1]+(j+sy/m)*spacing,min[2]+(k+sz/m)*spacing);
  }
  const index=[];const quad=(a,b,c,d,flip)=>{if(a<0||b<0||c<0||d<0)return;if(flip)index.push(a,c,b,a,d,c);else index.push(a,b,c,a,c,d)};
  for(let k=1;k<nz-1;k++)for(let j=1;j<ny-1;j++)for(let i=0;i<nx-1;i++){const a=field[at(i,j,k)]>iso,b=field[at(i+1,j,k)]>iso;if(a!==b)quad(cellVertex[cell(i,j-1,k-1)],cellVertex[cell(i,j,k-1)],cellVertex[cell(i,j,k)],cellVertex[cell(i,j-1,k)],!a)}
  for(let k=1;k<nz-1;k++)for(let j=0;j<ny-1;j++)for(let i=1;i<nx-1;i++){const a=field[at(i,j,k)]>iso,b=field[at(i,j+1,k)]>iso;if(a!==b)quad(cellVertex[cell(i-1,j,k-1)],cellVertex[cell(i-1,j,k)],cellVertex[cell(i,j,k)],cellVertex[cell(i,j,k-1)],!a)}
  for(let k=0;k<nz-1;k++)for(let j=1;j<ny-1;j++)for(let i=1;i<nx-1;i++){const a=field[at(i,j,k)]>iso,b=field[at(i,j,k+1)]>iso;if(a!==b)quad(cellVertex[cell(i-1,j-1,k)],cellVertex[cell(i,j-1,k)],cellVertex[cell(i,j,k)],cellVertex[cell(i-1,j,k)],!a)}
  return{positions:Float32Array.from(positions),index:Uint32Array.from(index)};
}
export const molecularSurface=(atoms,options={})=>isoSurface(densityField(atoms,options));

/** Nearest selected atom's group for each vertex (spatial hash). */
export function vertexGroups(mesh,atoms,group,{select=null,cell=6}={}){
  const grid=new Map(),key=(i,j,k)=>i+','+j+','+k;
  for(let a=0;a<atoms.count;a++){if(select&&!select(a))continue;const kk=key(Math.floor(atoms.x[a]/cell),Math.floor(atoms.y[a]/cell),Math.floor(atoms.z[a]/cell));let l=grid.get(kk);if(!l)grid.set(kk,l=[]);l.push(a)}
  const out=new Array(mesh.positions.length/3);
  for(let v=0;v<out.length;v++){const x=mesh.positions[v*3],y=mesh.positions[v*3+1],z=mesh.positions[v*3+2],gi=Math.floor(x/cell),gj=Math.floor(y/cell),gk=Math.floor(z/cell);let best=-1,bd=Infinity;
    for(let r=1;r<=3&&best<0;r++)for(let di=-r;di<=r;di++)for(let dj=-r;dj<=r;dj++)for(let dk=-r;dk<=r;dk++){const l=grid.get(key(gi+di,gj+dj,gk+dk));if(l)for(const a of l){const d=(atoms.x[a]-x)**2+(atoms.y[a]-y)**2+(atoms.z[a]-z)**2;if(d<bd){bd=d;best=a}}}
    out[v]=best<0?null:group(best)}
  return out;
}
/** Splits a mesh by the group of each triangle (majority of its vertices). */
export function splitByGroup(mesh,groups){
  const lists=new Map();for(let t=0;t<mesh.index.length;t+=3){const g=[groups[mesh.index[t]],groups[mesh.index[t+1]],groups[mesh.index[t+2]]];const pick=g[1]===g[2]?g[1]:g[0];if(pick==null)continue;let l=lists.get(pick);if(!l)lists.set(pick,l=[]);l.push(mesh.index[t],mesh.index[t+1],mesh.index[t+2])}
  return lists;
}

/** Ideal coordinates of a chemical component (PDB Chemical Component Dictionary, CC0): lipids, ATP, sugars, ions.
 *  Returns atoms like parseAtoms (hydrogens skipped unless keepH). */
export async function fetchLigand(code,{keepH=false}={}){
  const name=code.toUpperCase()+'.cif',file=path.join(CACHE,'ccd',name);
  if(!existsSync(file)){const url='https://files.rcsb.org/ligands/download/'+name;const r=await fetch(url);if(!r.ok)throw new Error('CCD '+r.status+': '+url);mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,Buffer.from(await r.arrayBuffer()))}
  const lines=readFileSync(file,'utf8').split('\n');let i=lines.findIndex(l=>l.startsWith('_chem_comp_atom.'));const cols=[];while(lines[i]?.startsWith('_chem_comp_atom.')){cols.push(lines[i].trim().slice(16));i++}
  const c=n=>cols.indexOf(n),cx=c('pdbx_model_Cartn_x_ideal'),cy=c('pdbx_model_Cartn_y_ideal'),cz=c('pdbx_model_Cartn_z_ideal'),fx=c('model_Cartn_x'),fy=c('model_Cartn_y'),fz=c('model_Cartn_z'),ce=c('type_symbol'),cn=c('atom_id');
  const x=[],y=[],z=[],element=[],nameList=[];
  for(;i<lines.length;i++){const l=lines[i];if(!l||l[0]==='#'||l[0]==='_'||l.startsWith('loop_'))break;const t=tokens(l);const e=t[ce].toUpperCase();if(!keepH&&e==='H')continue;let px=+t[cx],py=+t[cy],pz=+t[cz];if(!Number.isFinite(px)){px=+t[fx];py=+t[fy];pz=+t[fz]}if(!Number.isFinite(px))continue;x.push(px);y.push(py);z.push(pz);element.push(e);nameList.push(t[cn])}
  const n=x.length;return{x:Float32Array.from(x),y:Float32Array.from(y),z:Float32Array.from(z),element,chain:Array(n).fill(code),entity:Array(n).fill('1'),comp:Array(n).fill(code),seq:Array(n).fill(1),name:nameList,count:n};
}
