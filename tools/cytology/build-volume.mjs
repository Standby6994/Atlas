// Builds packs by cutting whole organelles out of the OpenOrganelle label volumes (HHMI Janelia, CC BY 4.0):
// the organelle, its membranes and what lies inside, extracted as surfaces (surface nets on a lightly smoothed mask).
//   node tools/cytology/build-volume.mjs mitochondrion nucleus-chromatin
import {dataset,mask,field,scaleMesh} from './n5.mjs';
import {isoSurface} from './pdb.mjs';
import {weld,merge,simplify,compact,bounds,triangles} from './mesh.mjs';
import {writePack} from './pack.mjs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const N5=d=>d+'/'+d+'.n5/labels/';
const credit=dataset=>({title:'OpenOrganelle — '+dataset+' (volumes de segmentação)',author:'HHMI Janelia Research Campus (COSEM Project Team)',license:'CC BY 4.0',url:'https://openorganelle.janelia.org/datasets/'+dataset,
  citation:'Heinrich L. et al. Whole-cell organelle segmentation in volume electron microscopy. Nature 599, 141–146 (2021); Xu C.S. et al. An open-access volume electron microscopy atlas of whole cells and tissues. Nature 599, 147–151 (2021).',changes:'Superfícies extraídas dos volumes de segmentação, suavizadas de leve, reduzidas para o aparelho, abertas por um plano de corte e coloridas por compartimento.'});

const centroidOf=(m,t)=>{const a=m.index[t]*3,b=m.index[t+1]*3,c=m.index[t+2]*3;return[0,1,2].map(k=>(m.positions[a+k]+m.positions[b+k]+m.positions[c+k])/3)};
function filterTriangles(m,keep){const idx=[];for(let t=0;t<m.index.length;t+=3)if(keep(centroidOf(m,t)))idx.push(m.index[t],m.index[t+1],m.index[t+2]);return compact(m.positions,idx)}
function nearTest(points,radius){const grid=new Map(),k=(i,j,l)=>i+','+j+','+l;for(const p of points){const key=k(...p.map(v=>Math.floor(v/radius)));let l=grid.get(key);if(!l)grid.set(key,l=[]);l.push(p)}
  const r2=radius*radius;return p=>{const c=p.map(v=>Math.floor(v/radius));for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let l=-1;l<=1;l++){const list=grid.get(k(c[0]+i,c[1]+j,c[2]+l));if(list)for(const q of list)if((q[0]-p[0])**2+(q[1]-p[1])**2+(q[2]-p[2])**2<r2)return true}return false}}
const verts=(m,step=1)=>{const out=[];for(let i=0;i<m.positions.length/3;i+=step)out.push([m.positions[i*3],m.positions[i*3+1],m.positions[i*3+2]]);return out};
function offset(m,d){const N=new Float32Array(m.positions.length),P=m.positions,I=m.index;for(let t=0;t<I.length;t+=3){const a=I[t]*3,b=I[t+1]*3,c=I[t+2]*3,u=[P[b]-P[a],P[b+1]-P[a+1],P[b+2]-P[a+2]],v=[P[c]-P[a],P[c+1]-P[a+1],P[c+2]-P[a+2]],n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];for(const x of[a,b,c])for(let k=0;k<3;k++)N[x+k]+=n[k]}
  const out=new Float32Array(P.length);for(let i=0;i<P.length;i+=3){const l=Math.hypot(N[i],N[i+1],N[i+2])||1;for(let k=0;k<3;k++)out[i+k]=P[i+k]+N[i+k]/l*d}return{positions:out,index:I}}
// Principal frame of a mesh; turns (long, mid, short) onto (x, y, z) about its centre.
function pcaFrame(m){const pts=verts(m,Math.max(1,Math.floor(m.positions.length/3/20000))),c=[0,1,2].map(k=>pts.reduce((s,p)=>s+p[k],0)/pts.length),C=[0,0,0,0,0,0,0,0,0];for(const p of pts){const d=[p[0]-c[0],p[1]-c[1],p[2]-c[2]];for(let i=0;i<3;i++)for(let j=0;j<3;j++)C[i*3+j]+=d[i]*d[j]}
  const mulv=(v)=>[C[0]*v[0]+C[1]*v[1]+C[2]*v[2],C[3]*v[0]+C[4]*v[1]+C[5]*v[2],C[6]*v[0]+C[7]*v[1]+C[8]*v[2]],nrm=v=>{const l=Math.hypot(...v)||1;return v.map(x=>x/l)},dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  let a=[1,.2,.1];for(let i=0;i<80;i++)a=nrm(mulv(a));let b=nrm([.1,1,.3]);for(let i=0;i<80;i++){b=nrm(mulv(b));const d=dot(b,a);b=nrm(b.map((x,k)=>x-d*a[k]))}const s=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  return p=>{const d=[p[0]-c[0],p[1]-c[1],p[2]-c[2]];return[dot(d,a),dot(d,b),dot(d,s)]}}
function transform(m,f){const P=new Float32Array(m.positions.length);for(let i=0;i<P.length;i+=3){const q=f([m.positions[i],m.positions[i+1],m.positions[i+2]]);P[i]=q[0];P[i+1]=q[1];P[i+2]=q[2]}return{positions:P,index:m.index}}
function surfaceOf(msk,ds,blur=1){const f=field(msk,ds.res,[0,0,0],blur);return weld(scaleMesh(isoSurface(f,.5),f),.01)}
function sphere(c,r,seg=4){const pos=[],idx=[];for(let i=0;i<=seg;i++)for(let j=0;j<=seg*2;j++){const th=i/seg*Math.PI,ph=j/(seg*2)*Math.PI*2;pos.push(c[0]+r*Math.sin(th)*Math.cos(ph),c[1]+r*Math.cos(th),c[2]+r*Math.sin(th)*Math.sin(ph))}for(let i=0;i<seg;i++)for(let j=0;j<seg*2;j++){const a=i*(seg*2+1)+j,b=a+seg*2+1;idx.push(a,b,a+1,a+1,b,b+1)}return weld({positions:Float32Array.from(pos),index:Uint32Array.from(idx)},1e-3)}
function knot(c,R,r){const s=[];for(let k=0;k<70;k++){const t=k/70*Math.PI*2,p=[Math.sin(t)+2*Math.sin(2*t),Math.cos(t)-2*Math.cos(2*t),-Math.sin(3*t)];s.push(sphere([c[0]+p[0]*R/3,c[1]+p[1]*R/3,c[2]+p[2]*R/3],r,5))}return merge(s)}

export const RECIPES={
  mitochondrion:{version:'r1',dataset:'jrc_hela-2',label:309,box:{min:[24192,1794,7212],max:[26879,2559,7883]},
    notes:'Uma mitocôndria inteira de uma célula HeLa real (2,7 µm de comprimento), recortada dos volumes de segmentação de microscopia eletrônica FIB-SEM do OpenOrganelle (HHMI Janelia, CC BY 4.0) em resolução de 4 nm: contorno da organela, membranas com as cristas e ribossomos mitocondriais segmentados por aprendizado de máquina. Aberta ao meio ao longo do comprimento para mostrar as cristas. A membrana interna e as cristas são a mesma membrana: a parte junto ao contorno aparece como membrana interna e as dobras que entram na matriz como cristas. A matriz aparece translúcida. O espaço intermembranas é a fresta de ~10 nm entre as membranas, estreita demais para ter peça própria nesta resolução. O DNA mitocondrial não foi segmentado e aparece como nucleoides ilustrativos.',
    colors:{outer:0xe9b07a,inner:0xe58a52,cristae:0xa8321f,matrix:0xf6d8bc,ribo:0x4d7fd1,dna:0x6a5acd}},
};

async function buildMitochondrion(id,r){
  const B=N5(r.dataset),sc=r.scale||'s0',org=await dataset(B+'mito_seg/'+sc),mem=await dataset(B+'mito-mem_seg/'+sc),rib=await dataset(B+'ribo_seg/'+sc).catch(()=>null);
  const lo=r.box.min.map((v,k)=>Math.max(0,Math.floor((v-120)/org.res[k]))),hi=r.box.max.map((v,k)=>Math.min(org.dims[k],Math.ceil((v+120)/org.res[k])));
  const O=await mask(org,lo,hi,r.label),M=await mask(mem,lo,hi,r.label),L={data:O.data.map((v,i)=>v&&!M.data[i]?1:0),dim:O.dim,lo:O.lo};
  const outer=surfaceOf(O,org,1),lumen=surfaceOf(L,org,1);console.log('  contorno '+triangles(outer).toLocaleString()+', matriz '+triangles(lumen).toLocaleString()+' triângulos');
  let ribos=null;if(rib){const R=await mask(rib,lo,hi,null),inside={data:R.data.map((v,i)=>v&&O.data[i]?1:0),dim:R.dim,lo:R.lo};let n=0;for(const v of inside.data)n+=v;if(n>20)ribos=surfaceOf(inside,org,0);console.log('  ribossomos mitocondriais: '+n+' vóxeis')}
  const frame=pcaFrame(outer),near=nearTest(verts(outer,1),40);
  const cut=m=>filterTriangles(transform(m,frame),q=>q[2]<=0);
  const inner=cut(filterTriangles(lumen,q=>near(q))),cristae=cut(filterTriangles(lumen,q=>!near(q))),matrix=cut(offset(lumen,-5)),outerCut=cut(outer),riboCut=ribos?cut(ribos):null;
  const b=bounds(cristae.positions.length?cristae.positions:outerCut.positions),c=r.colors;
  const nucleoids=[0,1,2].map(k=>knot([b.min[0]+(b.max[0]-b.min[0])*(.25+.25*k),(k-1)*60,-40],60,9));
  const outputs=[];
  for(const profile of['desktop','touch']){const B2={desktop:1,touch:.38}[profile],cap=n=>Math.round(n*B2);
    const parts=[{id:'outer-membrane',meshes:[{name:'surface',mesh:simplify(outerCut,cap(90000)),color:c.outer,roughness:.55}]},{id:'inner-membrane',meshes:[{name:'surface',mesh:simplify(inner,cap(90000)),color:c.inner,roughness:.55}]},
      {id:'cristae',meshes:[{name:'surface',mesh:simplify(cristae,cap(200000)),color:c.cristae,roughness:.5}]},{id:'matrix',meshes:[{name:'surface',mesh:simplify(matrix,cap(60000)),color:c.matrix,roughness:.6,opacity:.16}]},
      {id:'mitochondrial-dna',meshes:[{name:'surface',mesh:merge(nucleoids),color:c.dna,roughness:.5}]}];
    if(riboCut?.index.length)parts.push({id:'mitoribosomes',meshes:[{name:'surface',mesh:simplify(riboCut,cap(30000)),color:c.ribo,roughness:.5}]});
    const file=path.join(ROOT,'assets/cytology/real',id+'-'+profile+'-'+r.version+'.bin'),info=writePack(file,{id,profile,units:'nm',parts,credits:[credit(r.dataset)],notes:r.notes});
    console.log('  → '+path.relative(ROOT,file).replace(/\\/g,'/')+': '+(info.bytes/1048576).toFixed(2)+' MB, '+info.triangles.toLocaleString()+' triângulos, sha256 '+info.sha256);outputs.push(info)}
  return outputs;
}

RECIPES['nucleus-chromatin']={version:'r1',dataset:'jrc_hela-2',scale:'s3',label:1,
  notes:'O núcleo inteiro de uma célula HeLa real (cerca de 22 × 14 µm, achatado), recortado dos volumes de segmentação de microscopia eletrônica FIB-SEM do OpenOrganelle (HHMI Janelia, CC BY 4.0) em resolução de 32 nm: envelope nuclear, poros nucleares, nucléolo e cromatina densa (heterocromatina), que se concentra junto ao envelope e ao redor do nucléolo. A heterocromatina aqui é a cromatina densa a até ~250 nm do envelope e do nucléolo, onde ela se concentra; o restante da cromatina aparece como eucromatina, translúcida (a fonte não separa os dois tipos). A metade de cima foi retirada para mostrar o interior. A alça de cromatina é ilustrativa (contas de 11 nm, um nucleossomo cada, em escala ampliada).',
  colors:{ne:0x8d84d6,pore:0xf1d27a,nucleolus:0x4b2f86,hchrom:0x5a3f9e,echrom:0xc9b6ef,loop:0xe0a050}};
async function buildNucleus(id,r){
  const B=N5(r.dataset),sc=r.scale,nuc=await dataset(B+'nucleus_seg/'+sc);
  // Box of nucleus 1 (from its mesh): whole volume search at this scale is cheap enough with block skipping.
  const box={min:[13300,600,7200],max:[35100,5600,21100]},lo=box.min.map((v,k)=>Math.max(0,Math.floor((v-300)/nuc.res[k]))),hi=box.max.map((v,k)=>Math.min(nuc.dims[k],Math.ceil((v+300)/nuc.res[k])));
  const N=await mask(nuc,lo,hi,r.label),inN=i=>N.data[i];
  const grab=async cls=>{try{const ds=await dataset(B+cls+'/'+sc);const m=await mask(ds,lo,hi,null);return{data:m.data.map((v,i)=>v&&inN(i)?1:0),dim:m.dim,lo:m.lo}}catch(e){console.warn('  '+cls+': '+e.message);return null}};
  const NE=await grab('ne_seg'),NP=await grab('np_seg'),NO=await grab('nucleolus_seg'),HC=await grab('chrom_seg');
  // Heterochromatin: dense chromatin within ~250 nm of the envelope or of the nucleolus (where it sits in interphase);
  // the rest of the dense chromatin is shown as euchromatin, translucent.
  const dilate=(m,steps)=>{const [nx,ny,nz]=m.dim;let cur=Uint8Array.from(m.data);for(let s=0;s<steps;s++){const nxt=Uint8Array.from(cur);for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const id=i+nx*(j+ny*k);if(cur[id])continue;if((i>0&&cur[id-1])||(i<nx-1&&cur[id+1])||(j>0&&cur[id-nx])||(j<ny-1&&cur[id+nx])||(k>0&&cur[id-nx*ny])||(k<nz-1&&cur[id+nx*ny]))nxt[id]=1}cur=nxt}return cur};
  const steps=Math.round(250/nuc.res[0]),edge=dilate({data:N.data.map(v=>v?0:1),dim:N.dim},steps),nearNO=NO?dilate(NO,steps):new Uint8Array(N.data.length);
  const HET={data:HC.data.map((v,i)=>v&&(edge[i]||nearNO[i])?1:0),dim:N.dim,lo:N.lo},EUC={data:HC.data.map((v,i)=>v&&!(edge[i]||nearNO[i])?1:0),dim:N.dim,lo:N.lo};
  const EU=EUC;
  const surf=m=>m?surfaceOf(m,nuc,1):null,shell=surf(NE)||surf(N),pores=surf(NP),nucleolus=surf(NO),hchrom=surf(HET),euchrom=surfaceOf({data:EU.data,dim:EU.dim,lo:EU.lo},nuc,1);
  for(const [n,m] of Object.entries({shell,pores,nucleolus,hchrom,euchrom}))console.log('  '+n+': '+(m?triangles(m).toLocaleString():'—')+' triângulos');
  const frame=pcaFrame(shell),cut=m=>m?filterTriangles(transform(m,frame),q=>q[2]<=0):null;
  const parts0={ne:cut(shell),pore:cut(pores),nucleolus:cut(nucleolus),hchrom:cut(hchrom),echrom:cut(euchrom)},b=bounds(parts0.echrom.positions),c=r.colors;
  const beads=[];for(let k=0;k<70;k++){const t=k/69*Math.PI*1.7,ctr=[(b.min[0]+b.max[0])/2+Math.sin(t)*900,(b.min[1]+b.max[1])/2+(1-Math.cos(t))*700-400,-300+Math.sin(t*3)*120];beads.push(sphere(ctr,38,5))}
  const outputs=[];
  for(const profile of['desktop','touch']){const f={desktop:1,touch:.38}[profile],cap=n=>Math.round(n*f);
    const parts=[{id:'nuclear-envelope',meshes:[{name:'surface',mesh:simplify(parts0.ne,cap(120000)),color:c.ne,roughness:.55}]},{id:'heterochromatin',meshes:[{name:'surface',mesh:simplify(parts0.hchrom,cap(200000)),color:c.hchrom,roughness:.6}]},
      {id:'euchromatin',meshes:[{name:'surface',mesh:simplify(parts0.echrom,cap(60000)),color:c.echrom,roughness:.6,opacity:.28}]},{id:'chromatin-loop',meshes:[{name:'surface',mesh:merge(beads),color:c.loop,roughness:.5}]}];
    if(parts0.nucleolus?.index.length)parts.push({id:'nucleolus',meshes:[{name:'surface',mesh:simplify(parts0.nucleolus,cap(80000)),color:c.nucleolus,roughness:.6}]});
    if(parts0.pore?.index.length)parts.push({id:'nuclear-pore',meshes:[{name:'surface',mesh:simplify(parts0.pore,cap(50000)),color:c.pore,roughness:.5}]});
    const file=path.join(ROOT,'assets/cytology/real',id+'-'+profile+'-'+r.version+'.bin'),info=writePack(file,{id,profile,units:'nm',parts,credits:[credit(r.dataset)],notes:r.notes});
    console.log('  → '+path.relative(ROOT,file).split(path.sep).join('/')+': '+(info.bytes/1048576).toFixed(2)+' MB, '+info.triangles.toLocaleString()+' triângulos, sha256 '+info.sha256);outputs.push(info)}
  return outputs;
}

export async function build(id){const r=RECIPES[id];if(!r)throw new Error('Receita inexistente: '+id);console.log(id+' ← '+r.dataset+' (volumes)');if(id==='mitochondrion')return buildMitochondrion(id,r);if(id==='nucleus-chromatin')return buildNucleus(id,r)}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const ids=process.argv.slice(2);for(const id of ids)await build(id)}
