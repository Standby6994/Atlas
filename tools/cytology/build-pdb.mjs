// Builds molecular cytology packs from Protein Data Bank structures (wwPDB archive and Chemical Component
// Dictionary, CC0 1.0).
//   node tools/cytology/build-pdb.mjs ribosome nucleic-acids …   writes assets/cytology/real/<id>-{desktop,touch}-<version>.bin
// A recipe's scene() places atoms into parts (real structures, moved and rotated; ideal ligands; strands built along
// paths). Each part becomes the Gaussian molecular surface of its atoms (surface nets), simplified to a per-profile
// budget. Vertex colours: the atom's own colour when given (bases, CPK), else the part colour with a small shift per
// chain, darkened in crevices by sampling the density of the whole scene. Units: ångström.
import {fetchCif,fetchLigand,parseAtoms,entities,densityField,isoSurface,vertexGroups} from './pdb.mjs';
import {weld,simplify,normals,triangles} from './mesh.mjs';
import {writePack} from './pack.mjs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const CPK={C:0x8d96a0,N:0x4a6fd1,O:0xd94a3d,P:0xf09a3a,S:0xe6c84a,H:0xe8e8e8,FE:0xc2652a,MG:0x6fcf6f,NA:0x9f7fe0,K:0x8f56d6,CL:0x5fc75f,CA:0x9fb0a0,ZN:0x7d80b0,MN:0x9c7ac7};
export const BASE_COLOR={A:0xd9534f,DA:0xd9534f,T:0xe8c24f,DT:0xe8c24f,G:0x4fae68,DG:0x4fae68,C:0x4d7fd1,DC:0x4d7fd1,U:0xa97ad6};
const BACKBONE=new Set(['P','OP1','OP2','OP3',"O5'","C5'","C4'","O4'","C3'","O3'","C2'","O2'","C1'"]);

// ---- vector helpers ----
export const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len=a=>Math.hypot(...a),norm=a=>mul(a,1/(len(a)||1));
export function rotateAxis(p,axis,angle){const k=norm(axis),c=Math.cos(angle),s=Math.sin(angle);return add(add(mul(p,c),mul(cross(k,p),s)),mul(k,dot(k,p)*(1-c)))}
/** Rotation taking direction a onto direction b, applied to p. */
export function alignVec(p,a,b){a=norm(a);b=norm(b);const axis=cross(a,b),s=len(axis),c=dot(a,b);if(s<1e-8)return c>0?p:rotateAxis(p,Math.abs(a[0])<.9?cross(a,[1,0,0]):cross(a,[0,1,0]),Math.PI);return rotateAxis(p,axis,Math.atan2(s,c))}
export function centroid(list){const c=[0,0,0];for(const p of list){c[0]+=p[0];c[1]+=p[1];c[2]+=p[2]}return mul(c,1/(list.length||1))}
/** Principal axis (power iteration on the covariance). */
export function principalAxis(points){const c=centroid(points),m=[0,0,0,0,0,0,0,0,0];for(const p of points){const d=sub(p,c);for(let i=0;i<3;i++)for(let j=0;j<3;j++)m[i*3+j]+=d[i]*d[j]}let v=[1,.3,.2];for(let it=0;it<60;it++)v=norm([m[0]*v[0]+m[1]*v[1]+m[2]*v[2],m[3]*v[0]+m[4]*v[1]+m[5]*v[2],m[6]*v[0]+m[7]*v[1]+m[8]*v[2]]);return{center:c,axis:v}}
function catmull(points,steps){const out=[];for(let i=0;i<points.length-1;i++){const p0=points[Math.max(0,i-1)],p1=points[i],p2=points[i+1],p3=points[Math.min(points.length-1,i+2)];for(let s=0;s<steps;s++){const t=s/steps,t2=t*t,t3=t2*t;out.push([0,1,2].map(k=>.5*(2*p1[k]+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t2+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t3)))}}out.push(points.at(-1));return out}
function resample(pts,step){const out=[pts[0]];let carry=0;for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],d=len(sub(b,a));let t=step-carry;while(t<=d){out.push(add(a,mul(sub(b,a),t/d)));t+=step}carry=(carry+d)%step}return out}
function frameAlong(pts,i){const next=pts[Math.min(i+1,pts.length-1)],prev=pts[Math.max(0,i-1)],u=norm(sub(next,prev)),side=norm(cross(u,Math.abs(u[1])<.9?[0,1,0]:[1,0,0])),up=cross(u,side);return{u,side,up}}

/** Scene under construction: atoms tagged with part, colour and chain. */
export function createScene(){
  const atoms=[],codes=new Set();
  const scene={atoms,codes,copies:[],meshes:[],
    async structure(code,{assembly=0}={}){const text=await fetchCif(code,{assembly});codes.add(code.toUpperCase());const a=parseAtoms(text);a.entities=entities(text);a.code=code;return a},
    async ligand(code){codes.add('CCD '+code.toUpperCase());return fetchLigand(code)},
    /** Adds atoms of a structure: pick(i) → part or null; place(p) → new position; color(i) → rgb or null. */
    add(s,{pick,place=p=>p,color=null,chain=null,radius=null}){for(let i=0;i<s.count;i++){const part=pick(i);if(!part)continue;atoms.push({p:place([s.x[i],s.y[i],s.z[i]]),element:s.element[i],part,color:color?color(i):null,chain:chain?chain(i):(s.code||'')+':'+s.chain[i],radius:radius?radius(i):null})}},
    point(part,p,element='C',color=null,chain='built',radius=null){atoms.push({p,element,part,color,chain,radius})},
    /** Copies of a small molecule (ligand atoms) at positions, randomly turned; colour per element unless `color`. */
    molecules(part,lig,positions,{color=null,chain=null}={}){const c=centroid(Array.from({length:lig.count},(_,i)=>[lig.x[i],lig.y[i],lig.z[i]]));for(const at of positions){const ax=[random()-.5,random()-.5,random()-.5],ang=random()*6.3;for(let i=0;i<lig.count;i++)atoms.push({p:add(at,rotateAxis(sub([lig.x[i],lig.y[i],lig.z[i]],c),ax,ang)),element:lig.element[i],part,color:color??CPK[lig.element[i]]??null,chain:chain||lig.comp[0]})}},
    /** Hydrated ions as single spheres. */
    ions(part,element,positions,color,radius=2.6){for(const p of positions)atoms.push({p,element,part,color,chain:element,radius})},
    /** A ready mesh (parametric shapes such as cells drawn at another scale). */
    mesh(part,mesh,color,opacity=1){scene.meshes.push({part,mesh,color,opacity})},
    /** Single-stranded nucleic acid along a path (≈6 Å per nucleotide): backbone, sugar and a base turning around it. */
    strand(part,points,{baseColors=[BASE_COLOR.A,BASE_COLOR.U,BASE_COLOR.G,BASE_COLOR.C],backbone=null,chain='strand'}={}){const pts=resample(catmull(points,24),6.2);pts.forEach((p,i)=>{const {side,up}=frameAlong(pts,i),a=i*.6,d=add(mul(side,Math.cos(a)),mul(up,Math.sin(a)));scene.point(part,p,'P',backbone,chain);scene.point(part,add(p,mul(d,2.6)),'C',backbone,chain);const bc=baseColors[(i*7+3)%baseColors.length];for(let s=1;s<=3;s++)scene.point(part,add(p,mul(d,3.4+s*1.9)),s===2?'N':'C',bc,chain)})},
    /** Polypeptide along a path: a CA trace with side-chain lumps (≈3.8 Å per residue). */
    peptide(part,points,{color=null,chain='peptide'}={}){const pts=resample(catmull(points,24),3.8);pts.forEach((p,i)=>{const {side,up}=frameAlong(pts,i),a=i*1.9,d=add(mul(side,Math.cos(a)),mul(up,Math.sin(a)));scene.point(part,p,'C',color,chain);scene.point(part,add(p,mul(d,1.5)),'O',color,chain);scene.point(part,add(p,mul(d,2.9)),i%3?'C':'N',color,chain)})},
  };
  return scene;
}

/** Ideal B-DNA built by repeating one real base-pair step of PDB 1BNA (rise 3.38 Å, twist 36°). */
export async function bdna(scene,{pairs=30,origin=[0,0,0],axis=[0,1,0],parts={backbone:'dna-double-helix',bases:'bases'},highlight=null,chains=['fita 1','fita 2'],strandParts=null,strandColors=[null,null],only=null,spin=0}){
  const s=await scene.structure('1BNA'),pts=[];for(let i=0;i<s.count;i++)pts.push([s.x[i],s.y[i],s.z[i]]);
  const {center,axis:a0}=principalAxis(pts);
  const idx=[];for(let i=0;i<s.count;i++)if((s.chain[i]==='A'&&s.seq[i]===6)||(s.chain[i]==='B'&&s.seq[i]===19))idx.push(i);
  const bp=centroid(idx.map(i=>pts[i])),o=add(center,mul(a0,dot(sub(bp,center),a0)));
  for(let n=0;n<pairs;n++){
    const angle=n*Math.PI/5,shift=(n-(pairs-1)/2)*3.38,flip=n%2;
    for(const i of idx){const strand=s.chain[i]==='A'?0:1;if(only!==null&&only!==strand)continue;let p=sub(pts[i],o);p=rotateAxis(p,a0,angle+spin);p=add(p,mul(a0,shift));p=alignVec(p,a0,axis);p=add(p,origin);
      const isBackbone=BACKBONE.has(s.name[i]),comp=s.comp[i];let part=isBackbone?parts.backbone:parts.bases,color=isBackbone?null:BASE_COLOR[comp]||null;
      // Alternate A·T and G·C so both pairings appear.
      if(!isBackbone&&flip)color={DA:BASE_COLOR.DG,DT:BASE_COLOR.DC,DG:BASE_COLOR.DA,DC:BASE_COLOR.DT}[comp]||color;
      if(highlight&&n===highlight.index&&!isBackbone)part=highlight.part;
      // Per-strand parts (template, new strands): bases keep their colours, the backbone takes the strand colour.
      if(strandParts){part=strandParts[strand];if(isBackbone)color=strandColors[strand]}
      scene.atoms.push({p,element:s.element[i],part,color,chain:s.chain[i]==='A'?chains[0]:chains[1],pair:n,backbone:isBackbone})}
  }
}

// ---- membranes ----
const HYDROPHOBIC=new Set(['ALA','VAL','LEU','ILE','PHE','MET','TRP','CYS']),CHARGED=new Set(['ASP','GLU','LYS','ARG']);
let seed=12345;export const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);export const reseed=s=>{seed=s>>>0||1};
/** Membrane placement of a protein (a small OPM-like search): the 30 Å slab with the most hydrophobic and fewest charged
 *  residues. Returns {normal, center} in the structure's coordinates; normal points to the side given by `outside(p)` if any. */
export function membraneFit(s,{pick=()=>true,thickness=30}={}){
  const res=new Map();for(let i=0;i<s.count;i++){if(!pick(i)||s.name[i]!=='CA')continue;res.set(s.chain[i]+s.seq[i],{p:[s.x[i],s.y[i],s.z[i]],h:HYDROPHOBIC.has(s.comp[i]),c:CHARGED.has(s.comp[i])})}
  const list=[...res.values()],c0=centroid(list.map(r=>r.p));let best={score:-Infinity};
  for(let k=0;k<600;k++){const y=1-(k+.5)/600,r=Math.sqrt(1-y*y),phi=k*2.39996,d=[r*Math.cos(phi),y,r*Math.sin(phi)];if(y<0)continue;
    const t=list.map(q=>dot(sub(q.p,c0),d)),lo=Math.min(...t),hi=Math.max(...t);
    for(let c=lo+thickness/2;c<=hi-thickness/2;c+=1.5){let h=0,ch=0,n=0;for(let i=0;i<list.length;i++)if(Math.abs(t[i]-c)<thickness/2){n++;if(list[i].h)h++;if(list[i].c)ch++}const score=n?(h-2.5*ch)/Math.sqrt(n)+n*.01:-Infinity;if(score>best.score)best={score,normal:d,center:add(c0,mul(d,c))}}}
  return best;
}
/** Places a protein so its membrane slab lies in the plane through `at` with normal `normal` (and spins it by `spin`). */
export function membranePlacer(fit,{at=[0,0,0],normal=[0,1,0],spin=0,flip=false}={}){const n0=flip?mul(fit.normal,-1):fit.normal;return p=>add(rotateAxis(alignVec(sub(p,fit.center),n0,normal),normal,spin),at)}
/** Lipid bilayer of real POPC molecules (CCD POV) with cholesterol (CCD CLR): heads and tails as separate parts.
 *  avoid: atoms already in the scene that the lipids must not overlap (proteins). */
export async function bilayer(sc,{center=[0,0,0],normal=[0,1,0],size=[200,200],heads='phospholipid-bilayer',tails='hydrophobic-core',chol='cholesterol',cholFraction=.3,cholPart=null,spacing=8.2,curvature=0,lipids=[['POV',1]]}={}){
  // Each lipid stands with its polar end (the side holding more oxygens) up, its top atom at height 0.
  const prep=m=>{const pts=Array.from({length:m.count},(_,i)=>[m.x[i],m.y[i],m.z[i]]),{center:c,axis}=principalAxis(pts);let o=0;for(let i=0;i<m.count;i++)if(m.element[i]==='O'||m.element[i]==='P')o+=dot(sub(pts[i],c),axis);const up=o>0?axis:mul(axis,-1),top=Math.max(...pts.map(p=>dot(sub(p,c),up)));return{pts:pts.map(p=>alignVec(sub(p,add(c,mul(up,top))),up,[0,1,0])),m}};
  const kinds=[];for(const [code,w] of lipids)kinds.push({...prep(await sc.ligand(code)),w});const S=cholFraction>0?prep(await sc.ligand('CLR')):null,wsum=kinds.reduce((n,k)=>n+k.w,0);
  const n=norm(normal),e1=norm(cross(n,Math.abs(n[1])<.9?[0,1,0]:[1,0,0])),e2=cross(n,e1);
  const cell=6,grid=new Set();for(const a of sc.atoms){const d=sub(a.p,center);if(Math.abs(dot(d,n))<26)grid.add(Math.floor(dot(d,e1)/cell)+','+Math.floor(dot(d,e2)/cell))}
  const blocked=(u,v)=>{for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)if(grid.has((Math.floor(u/cell)+i)+','+(Math.floor(v/cell)+j)))return true;return false};
  let count=0;
  for(const side of[1,-1])for(let row=0;row*spacing*.866<size[1];row++)for(let col=0;col*spacing<size[0];col++){
    const u=-size[0]/2+col*spacing+(row%2)*spacing/2+(random()-.5)*1.6,v=-size[1]/2+row*spacing*.866+(random()-.5)*1.6;if(blocked(u,v))continue;
    const isChol=S&&random()<cholFraction;let src=S;if(!isChol){let r=random()*wsum;src=kinds.find(k=>(r-=k.w)<=0)||kinds[0]}
    const spin=random()*Math.PI*2,tilt=(random()-.5)*.25,depth=(isChol?-4.5:0)+(random()-.5)*1.4,bend=curvature*(u*u+v*v)/2;
    src.pts.forEach((q,i)=>{let p=rotateAxis(q,[0,1,0],spin);p=rotateAxis(p,[1,0,0],tilt);p=[p[0],p[1]+depth,p[2]];if(side<0)p=[p[0],-p[1],-p[2]];
      const h=p[1]+side*20.5+bend,w=add(add(center,mul(e1,u+p[0])),add(mul(e2,v+p[2]),mul(n,h)));
      const head=!isChol&&q[1]>-9.5,part=isChol?(cholPart||chol):head?heads:tails;sc.atoms.push({p:w,element:src.m.element[i],part,color:null,chain:isChol?'colesterol':(side>0?'folheto externo':'folheto interno')})});count++}
  return count;
}
/** Branched sugar chains (CCD ideal coordinates) growing from `anchor` along `dir`, each sugar in its SNFG colour
 *  (GlcNAc blue, mannose green, galactose yellow, sialic acid purple). */
const SNFG={NAG:0x2f6fd6,MAN:0x2fa84f,GAL:0xf2c230,SIA:0x9b4bb5};
export async function glycan(sc,part,anchor,dir,{units=7}={}){
  const load=async c=>{try{return{code:c,s:await sc.ligand(c)}}catch{return null}};const lib=Object.fromEntries((await Promise.all(Object.keys(SNFG).map(load))).filter(Boolean).map(x=>[x.code,x.s]));
  // N-glycan-like order: two GlcNAc, mannose core, then branches ending in galactose and sialic acid.
  const order=['NAG','NAG','MAN','MAN','NAG','GAL','SIA'];
  const place=(code,p)=>{const s=lib[code];if(!s)return;const c=centroid(Array.from({length:s.count},(_,i)=>[s.x[i],s.y[i],s.z[i]])),ax=[random()-.5,random()-.5,random()-.5],ang=random()*6.3;for(let i=0;i<s.count;i++)sc.point(part,add(p,rotateAxis(sub([s.x[i],s.y[i],s.z[i]],c),ax,ang)),s.element[i],SNFG[code],'glicano')};
  const grow=(from,d,k0,n,depth)=>{let p=from;for(let k=k0;k<n;k++){d=norm(add(d,[(random()-.5)*.9,(random()-.3)*.4,(random()-.5)*.9]));p=add(p,mul(d,5.6));place(order[Math.min(k,order.length-1)],p);
    if(k===2&&depth<2){for(const sgn of[-1,1])grow(p,norm(add(d,mul(norm(cross(d,[0,1,0.01])),sgn*1.3))),3,n,depth+1);return}}};
  grow(anchor,norm(dir),0,units,0);
}
/** Random positions in a box that keep `gap` Å from atoms already placed and from each other. */
export function scatter(sc,n,{min,max},gap=6){const grid=new Map(),cell=gap,key=p=>p.map(v=>Math.floor(v/cell)).join(',');for(const a of sc.atoms)grid.set(key(a.p),true);
  const near=p=>{const c=p.map(v=>Math.floor(v/cell));for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++)if(grid.has([c[0]+i,c[1]+j,c[2]+k].join(',')))return true;return false};
  const out=[];for(let t=0;t<n*40&&out.length<n;t++){const p=[0,1,2].map(k=>min[k]+random()*(max[k]-min[k]));if(near(p))continue;out.push(p);grid.set(key(p),true)}return out}
/** Parametric surface mesh (u,v in [0,1]), welded along seams. */
export function parametric(fn,nu,nv){const positions=[],index=[];for(let i=0;i<=nu;i++)for(let j=0;j<=nv;j++)positions.push(...fn(i/nu,j/nv));for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){const a=i*(nv+1)+j,b=a+nv+1;index.push(a,b,a+1,a+1,b,b+1)}return weld({positions:Float32Array.from(positions),index:Uint32Array.from(index)},1e-3)}
/** Red blood cell shapes (radius ~1 in model units): Evans–Fung biconcave disc, swollen spherocyte, crenated echinocyte. */
export function redCell(kind,scale=1,at=[0,0,0]){
  const C0=.0518,C2=2.0026,C4=-4.491,bump=(th,ph)=>kind==='crenated'?1+.09*Math.max(0,Math.cos(7*th)*Math.cos(6*ph)):1;
  return parametric((u,v)=>{const th=u*Math.PI*2,ph=v*Math.PI-Math.PI/2;let x,y,z;
    if(kind==='swollen'){const r=.78;x=r*Math.cos(ph)*Math.cos(th);z=r*Math.cos(ph)*Math.sin(th);y=r*.92*Math.sin(ph)}
    else{const rho=Math.cos(ph),h=.5*Math.sqrt(Math.max(0,1-rho*rho))*(C0+C2*rho*rho+C4*rho**4),shrink=kind==='crenated'?.82:1;x=rho*Math.cos(th)*shrink;z=rho*Math.sin(th)*shrink;y=Math.sign(ph)*h*shrink*(kind==='crenated'?1.6:1)}
    const b=bump(th,ph);return[at[0]+x*scale*b,at[1]+y*scale*b,at[2]+z*scale*b]},96,64);
}

/** Inserts a structure in the membrane (y = 0 plane by default): side(i) selects atoms whose centre must end up above
 *  (up = true, +normal) or below the membrane. */
export function placeInMembrane(sc,s,{pick,part,at=[0,0,0],spin=0,side=null,up=true,normal=[0,1,0]}){
  const fit=membraneFit(s,{pick});let flip=false;
  if(side){const pts=[];for(let i=0;i<s.count;i++)if(pick(i)&&side(i))pts.push([s.x[i],s.y[i],s.z[i]]);if(pts.length){const h=dot(sub(centroid(pts),fit.center),fit.normal);flip=up?h<0:h>0}}
  const place=membranePlacer(fit,{at,spin,flip,normal});sc.add(s,{pick:i=>pick(i)?(typeof part==='function'?part(i):part):null,place});return place;
}
/** Box mesh (for translucent compartments). */
export function box(min,max){const [x0,y0,z0]=min,[x1,y1,z1]=max,v=[[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]];
  const f=[[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[3,7,6],[3,6,2],[0,4,7],[0,7,3],[1,2,6],[1,6,5]];
  // Subdivided a little so the simplifier and normals behave; flat faces stay flat.
  return{positions:Float32Array.from(v.flat()),index:Uint32Array.from(f.flat())};
}
const notWater=s=>i=>!/^(HOH|WAT|DOD)$/.test(s.comp[i]);
const polymerOnly=s=>i=>!/^(HOH|WAT|DOD|SO4|PO4|GOL|EDO|CL|NA|K|MG|CA|ZN|BOG|BNG|LMT|DMU|LDA|CDL|PCW|PEE|PGV|LHG|LMG|DGD|SQD|UNL|UNX|BCR|CLA|PL9|HEM|HEA|HEC|FES|SF4|FMN|FAD|NAP|NDP|ADP|ATP|ANP|ACP|ALF|BEF|MN|OEX|BCT|CU|CU1|LUT|XAT|NEX|CHL|PQN|DMS|MES|TRS|EPE|ACT|FMT|SCN|UQ1|U10|DGA|PEF|3PE|TGL|CDM|OPC|8K6|SAC)$/.test(s.comp[i]);

const ENERGY={
  'oxidative-phosphorylation':{version:'r1',tilt:.16,frame:null,surface:{spacing:1.6,smooth:.6,probe:1},
    notes:'Membrana mitocondrial interna montada com moléculas reais: complexo I (PDB 5LDW, camundongo), complexo III dímero (PDB 1BGY, bovino), complexo IV (PDB 1OCC, bovino), citocromo c (PDB 1HRC) e ATP sintase (PDB 5ARA, bovina), em bicamada de POPC com cardiolipina representada pela própria POPC. NADH, FADH₂, ubiquinona, O₂, H₂O e ATP vêm do dicionário de componentes do PDB; prótons aparecem como íons hidrônio (azul-claro), concentrados no espaço intermembranas (em cima). A matriz fica embaixo. O complexo II e a curvatura das cristas não foram incluídos; distâncias entre complexos são ilustrativas.',
    parts:{'inner-membrane':{color:0xe3c08a,budget:{desktop:150000,touch:55000}},'electron-chain':{color:0xd77b56,budget:{desktop:200000,touch:70000}},'atp-synthase':{color:0x5aa0d6,budget:{desktop:110000,touch:40000}},'proton-gradient':{color:0x9fd8ff,budget:{desktop:20000,touch:8000}},oxygen:{color:0xffffff,surface:{spacing:.7,smooth:.55,probe:.3},budget:{desktop:6000,touch:3000}},'nadh-fadh2':{color:0xffffff,surface:{spacing:.7,smooth:.55,probe:.3},budget:{desktop:10000,touch:4000}},atp:{color:0xffffff,surface:{spacing:.7,smooth:.55,probe:.3},budget:{desktop:8000,touch:3500}},'matrix-intermembrane':{color:0x7fb3d9,budget:{desktop:200,touch:200}}},
    async scene(sc){
      reseed(55);
      const c1=await sc.structure('5LDW'),p1=polymerOnly(c1);placeInMembrane(sc,c1,{pick:p1,part:'electron-chain',at:[-175,0,10],side:(()=>{const f=membraneFit(c1,{pick:p1});return i=>Math.abs(dot(sub([c1.x[i],c1.y[i],c1.z[i]],f.center),f.normal))>45})(),up:false});
      const c3=await sc.structure('1BGY'),p3=polymerOnly(c3);placeInMembrane(sc,c3,{pick:p3,part:'electron-chain',at:[-45,0,0],side:i=>/^[ABMN]$/.test(c3.chain[i]),up:false,spin:.6});
      const c4=await sc.structure('1OCC'),p4=i=>polymerOnly(c4)(i)&&/^[A-M]$/.test(c4.chain[i]);placeInMembrane(sc,c4,{pick:p4,part:'electron-chain',at:[60,0,0],side:i=>c4.chain[i]==='B',up:true});
      const atps=await sc.structure('5ARA'),pa=polymerOnly(atps);placeInMembrane(sc,atps,{pick:pa,part:'atp-synthase',at:[175,0,0],side:i=>/^[A-F]$/.test(atps.chain[i]),up:false});
      const cyc=await sc.structure('1HRC'),cc=centroid(Array.from({length:cyc.count},(_,i)=>[cyc.x[i],cyc.y[i],cyc.z[i]]));sc.add(cyc,{pick:i=>polymerOnly(cyc)(i)?'electron-chain':null,place:p=>add(sub(p,cc),[10,48,20])});
      const uq=await sc.ligand('U10');sc.molecules('electron-chain',uq,[[-105,6,40],[-110,-4,-38]]);
      await bilayer(sc,{size:[440,170],heads:'inner-membrane',tails:'inner-membrane',cholFraction:0});
      const nadh=await sc.ligand('NAI'),fad=await sc.ligand('FAD');const low=sc.atoms.filter(a=>a.part==='electron-chain'&&a.p[0]<-120).sort((a,b)=>a.p[1]-b.p[1])[0].p;
      sc.molecules('nadh-fadh2',nadh,[add(low,[18,-10,8]),add(low,[-24,-6,-14])]);sc.molecules('nadh-fadh2',fad,[[-110,-48,30]]);
      sc.molecules('oxygen',await sc.ligand('OXY'),[[60,-62,22],[78,-58,-18]]);sc.molecules('oxygen',await sc.ligand('HOH'),[[44,-60,-6],[52,-68,30],[70,-66,8]]);
      const lowA=sc.atoms.filter(a=>a.part==='atp-synthase').sort((a,b)=>a.p[1]-b.p[1])[0].p;sc.molecules('atp',await sc.ligand('ATP'),[add(lowA,[26,-8,12]),add(lowA,[-28,-2,-16]),add(lowA,[8,-20,-26])]);
      sc.ions('proton-gradient','O',scatter(sc,60,{min:[-215,34,-80],max:[215,95,80]},9),0x9fd8ff,2.1);sc.ions('proton-gradient','O',scatter(sc,8,{min:[-215,-110,-80],max:[215,-40,80]},9),0x9fd8ff,2.1);
      // Compartments: faint slabs marking the intermembrane space (top) and the matrix (bottom).
      sc.mesh('matrix-intermembrane',box([-225,100,-85],[225,104,85]),0xe39cb0,.18);sc.mesh('matrix-intermembrane',box([-225,-150,-85],[225,-146,85]),0x7fb3d9,.18);
    }},
  'light-reactions':{version:'r1',tilt:.16,frame:null,surface:{spacing:1.6,smooth:.6,probe:1},
    notes:'Membrana do tilacoide montada com moléculas reais: fotossistema II dímero de cianobactéria (PDB 3WU2), complexo citocromo b6f dímero (PDB 1VF5), fotossistema I de planta com antenas LHCI (PDB 5L8R, ervilha), ferredoxina–NADP⁺ redutase de espinafre (PDB 1FNB), ATP sintase de cloroplasto (PDB 6FKF, espinafre) e plastocianina (PDB 1PLC), em bicamada de galactolipídios (MGDG e DGDG do dicionário de componentes do PDB). Água, O₂, NADP⁺/NADPH e ATP também vêm desse dicionário; prótons aparecem como íons hidrônio, concentrados no lúmen do tilacoide (em cima). O estroma fica embaixo. As antenas LHCII e o empilhamento dos grana não foram incluídos.',
    parts:{'photosystem-ii':{color:0x4fae68,budget:{desktop:120000,touch:42000}},'electron-chain':{color:0xd77b56,budget:{desktop:60000,touch:22000}},'photosystem-i':{color:0x86c04f,budget:{desktop:120000,touch:42000}},'nadp-reductase':{color:0xe0b24f,budget:{desktop:14000,touch:6000}},'atp-synthase':{color:0x5aa0d6,budget:{desktop:110000,touch:40000}},'thylakoid-lumen':{color:0x9fd8ff,budget:{desktop:20000,touch:8000}},'water-oxygen':{color:0xffffff,surface:{spacing:.7,smooth:.55,probe:.3},budget:{desktop:8000,touch:3500}},'context-membrane':{color:0xd9d29a,budget:{desktop:150000,touch:55000}},'context-molecules':{color:0xffffff,surface:{spacing:.7,smooth:.55,probe:.3},budget:{desktop:8000,touch:3500}}},
    async scene(sc){
      reseed(66);
      const ps2=await sc.structure('3WU2'),q2=polymerOnly(ps2);placeInMembrane(sc,ps2,{pick:q2,part:'photosystem-ii',at:[-185,0,0],side:i=>/^[OUVou]$/.test(ps2.chain[i]),up:true});
      const b6f=await sc.structure('1VF5'),qb=polymerOnly(b6f);placeInMembrane(sc,b6f,{pick:qb,part:'electron-chain',at:[-55,0,0],side:i=>/^[CP]$/.test(b6f.chain[i]),up:true,spin:.5});
      const ps1=await sc.structure('5L8R'),q1=polymerOnly(ps1);placeInMembrane(sc,ps1,{pick:q1,part:'photosystem-i',at:[70,0,0],side:i=>/^[CDE]$/.test(ps1.chain[i]),up:false});
      const cf=await sc.structure('6FKF'),qc=polymerOnly(cf);placeInMembrane(sc,cf,{pick:qc,part:'atp-synthase',at:[205,0,0],side:i=>/^[A-F]$/.test(cf.chain[i]),up:false});
      const pc=await sc.structure('1PLC'),pcc=centroid(Array.from({length:pc.count},(_,i)=>[pc.x[i],pc.y[i],pc.z[i]]));sc.add(pc,{pick:i=>polymerOnly(pc)(i)?'electron-chain':null,place:p=>add(sub(p,pcc),[5,52,22])});
      const fnr=await sc.structure('1FNB'),fc=centroid(Array.from({length:fnr.count},(_,i)=>[fnr.x[i],fnr.y[i],fnr.z[i]]));
      await bilayer(sc,{size:[500,170],heads:'context-membrane',tails:'context-membrane',cholFraction:0,lipids:[['LMG',.55],['DGD',.3],['POV',.15]]});
      const low1=sc.atoms.filter(a=>a.part==='photosystem-i').sort((a,b)=>a.p[1]-b.p[1])[0].p;sc.add(fnr,{pick:i=>polymerOnly(fnr)(i)?'nadp-reductase':null,place:p=>add(sub(p,fc),add(low1,[46,-14,10]))});
      sc.molecules('context-molecules',await sc.ligand('NAP'),[add(low1,[78,-20,-16])]);sc.molecules('context-molecules',await sc.ligand('NDP'),[add(low1,[90,-36,24])]);
      const lowA=sc.atoms.filter(a=>a.part==='atp-synthase').sort((a,b)=>a.p[1]-b.p[1])[0].p;sc.molecules('context-molecules',await sc.ligand('ATP'),[add(lowA,[26,-8,12]),add(lowA,[-28,-2,-16])]);
      const top2=sc.atoms.filter(a=>a.part==='photosystem-ii').sort((a,b)=>b.p[1]-a.p[1])[0].p;sc.molecules('water-oxygen',await sc.ligand('HOH'),[add(top2,[10,8,4]),add(top2,[-6,10,-8]),add(top2,[16,14,-10]),add(top2,[-14,6,12])]);sc.molecules('water-oxygen',await sc.ligand('OXY'),[add(top2,[22,22,6]),add(top2,[-20,26,-4])]);
      sc.ions('thylakoid-lumen','O',scatter(sc,64,{min:[-245,34,-80],max:[245,95,80]},9),0x9fd8ff,2.1);sc.ions('thylakoid-lumen','O',scatter(sc,8,{min:[-245,-110,-80],max:[245,-40,80]},9),0x9fd8ff,2.1);
    }},
  'calvin-cycle':{version:'r1',frame:['rubisco'],surface:{spacing:1.4,smooth:.6,probe:.9},
    notes:'Rubisco de espinafre completa (oito subunidades grandes e oito pequenas, montagem biológica da estrutura PDB 8RUC, com o análogo de intermediário 2-carboxiarabinitol-bisfosfato no sítio ativo) cercada pelos metabólitos do ciclo de Calvin do dicionário de componentes do PDB: CO₂, ribulose-1,5-bisfosfato (RuBP), 3-fosfoglicerato, gliceraldeído-3-fosfato, ATP e NADPH. Os metabólitos estão em anéis que lembram a ordem do ciclo; quantidades e distâncias são ilustrativas. As demais enzimas do ciclo não foram incluídas; a regeneração da RuBP aparece como uma fila de moléculas de RuBP saindo do anel.',
    parts:{rubisco:{color:0x5bae5e,budget:{desktop:160000,touch:60000}},co2:{color:0xffffff,surface:{spacing:.6,smooth:.55,probe:.25},budget:{desktop:5000,touch:2500}},rubp:{color:0xffffff,surface:{spacing:.7,smooth:.55,probe:.3},budget:{desktop:9000,touch:4000}},phosphoglycerate:{color:0xffffff,surface:{spacing:.7,smooth:.55,probe:.3},budget:{desktop:9000,touch:4000}},g3p:{color:0xffffff,surface:{spacing:.7,smooth:.55,probe:.3},budget:{desktop:7000,touch:3000}},regeneration:{color:0xffffff,surface:{spacing:.7,smooth:.55,probe:.3},budget:{desktop:7000,touch:3000}},'atp-nadph':{color:0xffffff,surface:{spacing:.7,smooth:.55,probe:.3},budget:{desktop:12000,touch:5000}},stroma:{color:0x7fd0a8,budget:{desktop:3000,touch:2000}}},
    async scene(sc){
      reseed(77);
      const r=await sc.structure('8RUC',{assembly:1}),pts=[];for(let i=0;i<r.count;i++)pts.push([r.x[i],r.y[i],r.z[i]]);const rc=centroid(pts);
      sc.add(r,{pick:i=>polymerOnly(r)(i)?'rubisco':null,place:p=>sub(p,rc),color:i=>r.entity[i]==='2'?0x9fd38a:null});
      const ring=(n,rad,y,phase=0)=>Array.from({length:n},(_,k)=>{const a=phase+k/n*Math.PI*2;return[Math.cos(a)*rad,y+Math.sin(a*2)*6,Math.sin(a)*rad]});
      sc.molecules('co2',await sc.ligand('CO2'),ring(10,92,40,.1));
      sc.molecules('rubp',await sc.ligand('RUB'),ring(6,88,-5,.4));
      sc.molecules('phosphoglycerate',await sc.ligand('3PG'),ring(8,100,-40,.2));
      sc.molecules('g3p',await sc.ligand('G3H'),ring(6,110,-72,.7));
      sc.molecules('regeneration',await sc.ligand('RUB'),Array.from({length:5},(_,k)=>[125-k*6,-60+k*20,40+k*6]));
      sc.molecules('atp-nadph',await sc.ligand('ATP'),ring(4,120,-20,1.3));sc.molecules('atp-nadph',await sc.ligand('NDP'),ring(4,125,-55,2.1));
      // Stroma: a faint volume around the enzyme.
      sc.mesh('stroma',redCell('swollen',150,[0,-10,0]),0x7fd0a8,.08);
    }},
};

/** Axis of least spread (a ring's symmetry axis): power iteration on (trace·I − C). */
export function minorAxis(points){const c=centroid(points),m=[0,0,0,0,0,0,0,0,0];for(const p of points){const d=sub(p,c);for(let i=0;i<3;i++)for(let j=0;j<3;j++)m[i*3+j]+=d[i]*d[j]}const t=m[0]+m[4]+m[8],r=[t-m[0],-m[1],-m[2],-m[3],t-m[4],-m[5],-m[6],-m[7],t-m[8]];let v=[.3,1,.2];for(let it=0;it<80;it++)v=norm([r[0]*v[0]+r[1]*v[1]+r[2]*v[2],r[3]*v[0]+r[4]*v[1]+r[5]*v[2],r[6]*v[0]+r[7]*v[1]+r[8]*v[2]]);return{center:c,axis:v}}
const coordsOf=(s,pick)=>{const out=[];for(let i=0;i<s.count;i++)if(pick(i))out.push([s.x[i],s.y[i],s.z[i]]);return out};
const nucleicColor=s=>i=>BACKBONE.has(s.name[i])?null:BASE_COLOR[s.comp[i]]||null;
const AMINO=['MET','PHE','LYS','GLY','TRP','LEU','SER','TYR'];

/** The 70S ribosome of PDB 4V51 with its messenger extended both ways; returns the frame used to place the rest. */
async function ribosomeCore(sc,{ssu,lsu,trna,mrna,peptide,ssuColor=null,lsuColor=null}){
  const s=await sc.structure('4V51'),e=s.entities;
  sc.add(s,{pick:i=>{if(!/^[AB]/.test(s.chain[i]))return null;const d=(e[s.entity[i]]||'').toUpperCase();if(/MRNA/.test(d))return mrna;if(/TRNA/.test(d))return trna;if(/16S|30S/.test(d))return ssu;if(/23S|5S|50S/.test(d))return lsu;return null},
    color:i=>{const d=(e[s.entity[i]]||'').toUpperCase();return/16S|30S/.test(d)?ssuColor:/23S|5S|50S/.test(d)?lsuColor:null}});
  const desc=i=>(e[s.entity[i]]||'').toUpperCase(),mine=i=>/^[AB]/.test(s.chain[i]),of=p=>sc.atoms.filter(a=>a.part===p).map(a=>a.p);
  const ssuC=centroid(coordsOf(s,i=>mine(i)&&/16S|30S/.test(desc(i)))),lsuC=centroid(coordsOf(s,i=>mine(i)&&/23S|5S|50S/.test(desc(i)))),o=norm(sub(ssuC,lsuC));
  const m=of(mrna),first=m[0],last=m.at(-1),d0=sub(last,first),u=norm(sub(d0,mul(o,dot(d0,o))));
  const along=(from,t)=>add(add(from,mul(u,t)),add(mul(o,28+Math.abs(t)*.06),[0,Math.sin(t/180)*25,0]));
  const ptc=centroid(of(trna)),exit=add(lsuC,mul(o,-125));
  if(peptide)sc.peptide(peptide,[ptc,add(ptc,mul(norm(sub(exit,ptc)),40)),add(lsuC,mul(o,-60)),exit,add(exit,[20,-25,10]),add(exit,[45,-30,35])]);
  return{u,o,first,last,along,ptc,lsuC,ssuC};
}

const INFO={
  'translation-protein':{version:'r1',frame:['ribosome','trna','mrna'],surface:{spacing:1.8,smooth:.6,probe:1.2},
    notes:'Ribossomo bacteriano 70S (PDB 4V51, Thermus thermophilus) com RNA mensageiro e RNAs transportadores nos sítios A, P e E; subunidade menor em bege e maior em azul. Aminoácidos livres vêm do dicionário de componentes do PDB. O mensageiro foi prolongado de forma ilustrativa: o códon de parada (UAA) aparece em vermelho mais adiante, e o polipeptídio nascente, que não está resolvido nessa estrutura, aparece como um traço ilustrativo saindo da subunidade maior.',
    parts:{ribosome:{color:0xffffff,budget:{desktop:330000,touch:120000}},trna:{color:0xd85a7f,budget:{desktop:26000,touch:10000}},mrna:{color:0x52b788,budget:{desktop:18000,touch:8000}},'amino-acid':{color:0xffffff,surface:{spacing:.7,smooth:.55,probe:.3},budget:{desktop:12000,touch:5000}},'nascent-polypeptide':{color:0xf2a65a,budget:{desktop:6000,touch:3000}},'stop-codon':{color:0xe0473f,budget:{desktop:3000,touch:1500}}},
    async scene(sc){
      reseed(91);const f=await ribosomeCore(sc,{ssu:'ribosome',lsu:'ribosome',trna:'trna',mrna:'mrna',peptide:'nascent-polypeptide',ssuColor:0xe8c27a,lsuColor:0x6f8fc4});
      sc.strand('mrna',[f.along(f.first,-300),f.along(f.first,-160),f.along(f.first,-40),f.first]);sc.strand('mrna',[f.last,f.along(f.last,40),f.along(f.last,110)]);
      sc.strand('stop-codon',[f.along(f.last,116),f.along(f.last,134)],{baseColors:[0xe0473f,0xe0473f,0xb0302a],backbone:0xe0473f});sc.strand('mrna',[f.along(f.last,140),f.along(f.last,240),f.along(f.last,330)]);
      for(let k=0;k<AMINO.length;k++){const lig=await sc.ligand(AMINO[k]);sc.molecules('amino-acid',lig,[add(f.ptc,[60+k*9,90-k*14,-40+k*11])])}
    }},
  'transcription-rna':{version:'r1',frame:['rna-polymerase','template'],surface:{spacing:1.5,smooth:.6,probe:1},
    notes:'RNA polimerase II de levedura em elongação (PDB 1I6H, Gnatt et al., Science 2001), com a fita-molde de DNA e o RNA nascente resolvidos na estrutura. O DNA foi prolongado dos dois lados com dupla hélice B construída de um passo real de DNA (PDB 1BNA); a região promotora (laranja) fica antes do ponto de início. O RNA que sai da enzima foi prolongado de forma ilustrativa, com éxons (verde) e íntrons (lilás); ao lado, o mRNA processado, com cap 5′ (um nucleotídeo de guanina do dicionário de componentes do PDB) e cauda poli(A).',
    parts:{'rna-polymerase':{color:0x7a8fd6,budget:{desktop:200000,touch:72000}},template:{color:0xb9c3cf,budget:{desktop:60000,touch:22000}},promoter:{color:0xe0a050,budget:{desktop:20000,touch:8000}},'nascent-rna':{color:0x52b788,budget:{desktop:20000,touch:8000}},introns:{color:0xb07fd0,budget:{desktop:14000,touch:6000}},'mature-mrna':{color:0x52b788,budget:{desktop:18000,touch:7000}}},
    async scene(sc){
      const pol=await sc.structure('1I6H'),all=coordsOf(pol,()=>true),c=centroid(all);
      sc.add(pol,{pick:i=>/HOH|MG|ZN/.test(pol.comp[i])?null:pol.chain[i]==='D'?'template':pol.chain[i]==='R'?'nascent-rna':'rna-polymerase',place:p=>sub(p,c),color:i=>/^[DR]$/.test(pol.chain[i])?nucleicColor(pol)(i):null});
      const d=coordsOf(pol,i=>pol.chain[i]==='D').map(p=>sub(p,c)),{center:dc,axis:da}=principalAxis(d),proj=d.map(p=>dot(sub(p,dc),da)),lo=Math.min(...proj),hi=Math.max(...proj);
      await bdna(sc,{pairs:26,origin:add(dc,mul(da,hi+26*3.38/2+4)),axis:da,strandParts:['template','template'],strandColors:[0xb9c3cf,0x9aa7b8]});
      await bdna(sc,{pairs:14,origin:add(dc,mul(da,lo-14*3.38/2-4)),axis:da,strandParts:['template','template'],strandColors:[0xb9c3cf,0x9aa7b8],spin:.8});
      await bdna(sc,{pairs:16,origin:add(dc,mul(da,lo-14*3.38-16*3.38/2-6)),axis:da,strandParts:['promoter','promoter'],strandColors:[0xe0a050,0xd08a3a],spin:2.1});
      // RNA leaving the enzyme: away from its centre, then exon–intron–exon.
      const r=coordsOf(pol,i=>pol.chain[i]==='R').map(p=>sub(p,c)),rc=centroid(r),end=r.reduce((b,p)=>len(p)>len(b)?p:b,r[0]),out=norm(sub(end,[0,0,0]));
      const side=norm(cross(out,da)),pt=(t,w=0)=>add(add(end,mul(out,t*.6)),mul(side,w*.6));
      sc.strand('nascent-rna',[end,pt(25,4),pt(55,-6),pt(85,6)]);sc.strand('introns',[pt(85,6),pt(110,40),pt(140,30),pt(150,-10),pt(125,-35),pt(100,-15)]);sc.strand('nascent-rna',[pt(100,-15),pt(130,-55),pt(160,-70)]);void rc;
      // Processed mRNA beside it: cap, exons, poly(A) tail.
      const base=add(dc,add(mul(da,-60),mul(side,-115)));sc.molecules('mature-mrna',await sc.ligand('GTP'),[base]);
      sc.strand('mature-mrna',[add(base,mul(da,6)),add(base,add(mul(da,40),mul(side,8))),add(base,add(mul(da,80),mul(side,-6))),add(base,add(mul(da,120),mul(side,4)))]);
      sc.strand('mature-mrna',[add(base,add(mul(da,126),mul(side,4))),add(base,add(mul(da,150),mul(side,12))),add(base,add(mul(da,168),mul(side,2)))],{baseColors:[BASE_COLOR.A]});
    }},
  'dna-replication':{version:'r1',frame:null,surface:{spacing:1.5,smooth:.6,probe:1},
    notes:'Forquilha de replicação montada com moléculas reais do bacteriófago T7 e de humanos: o anel helicase–primase e as DNA polimerases (com tiorredoxina) do replissomo de T7 (PDB 5IKN) e a DNA ligase I humana (PDB 1X9N). O DNA é dupla hélice B construída de um passo real (PDB 1BNA): fita-molde cinza, fita contínua azul, fragmentos de Okazaki verdes com iniciadores de RNA lilás no começo de cada um. A geometria da forquilha (ângulos, alça da fita descontínua) é ilustrativa.',
    parts:{template:{color:0xb9c3cf,budget:{desktop:80000,touch:30000}},helicase:{color:0xd77b56,budget:{desktop:90000,touch:34000}},primer:{color:0xb07fd0,budget:{desktop:8000,touch:3000}},'dna-polymerase':{color:0x7a8fd6,budget:{desktop:110000,touch:40000}},'leading-strand':{color:0x4d7fd1,budget:{desktop:30000,touch:11000}},'lagging-strand':{color:0x4fae68,budget:{desktop:30000,touch:11000}},ligase:{color:0xe0b24f,budget:{desktop:40000,touch:15000}}},
    async scene(sc){
      const rep=await sc.structure('5IKN');
      // Helicase ring (chains D–J) at the fork, its axis along x.
      const hel=coordsOf(rep,i=>/^[D-J]$/.test(rep.chain[i])),{center:hc,axis:ha}=minorAxis(hel);
      sc.add(rep,{pick:i=>/^[D-J]$/.test(rep.chain[i])&&!/HOH/.test(rep.comp[i])?'helicase':null,place:p=>alignVec(sub(p,hc),ha,[1,0,0])});
      await bdna(sc,{pairs:56,origin:[-130,0,0],axis:[1,0,0],strandParts:['template','template'],strandColors:[0xb9c3cf,0x9aa7b8]});
      // Leading arm (up-right) and lagging arm (down-right) with two Okazaki fragments; enzymes sit beside the DNA.
      const lead=norm([1,.55,0]),lag=norm([1,-.75,.2]);
      await bdna(sc,{pairs:64,origin:add([46,24,0],mul(lead,64*3.38/2)),axis:lead,strandParts:['template','leading-strand'],strandColors:[0xb9c3cf,0x4d7fd1]});
      sc.strand('template',[[34,-14,0],[52,-38,4],[70,-62,8],[86,-84,10]],{backbone:0xb9c3cf,baseColors:[BASE_COLOR.A,BASE_COLOR.T,BASE_COLOR.G,BASE_COLOR.C]});
      const s1=[96,-96,12],s2=add(s1,mul(lag,112));
      for(const [k,start] of[[0,s1],[1,s2]]){
        await bdna(sc,{pairs:30,origin:add(start,mul(lag,30*3.38/2)),axis:lag,strandParts:['template','lagging-strand'],strandColors:[0xb9c3cf,0x4fae68],spin:k*1.3});
        await bdna(sc,{pairs:5,origin:add(start,mul(lag,-5*3.38/2-1)),axis:lag,strandParts:[null,'primer'],strandColors:[null,0xb07fd0],only:1,spin:k*1.3});
      }
      const pol=coordsOf(rep,i=>/^[AK]$/.test(rep.chain[i])),pc=centroid(pol);sc.add(rep,{pick:i=>/^[AK]$/.test(rep.chain[i])&&!/HOH/.test(rep.comp[i])?'dna-polymerase':null,place:p=>add(sub(p,pc),add(add([46,24,0],mul(lead,70)),[0,0,-62]))});
      const pol2=coordsOf(rep,i=>/^[BL]$/.test(rep.chain[i])),pc2=centroid(pol2);sc.add(rep,{pick:i=>/^[BL]$/.test(rep.chain[i])&&!/HOH/.test(rep.comp[i])?'dna-polymerase':null,place:p=>add(sub(p,pc2),add(add(s2,mul(lag,60)),[0,0,-62]))});
      const lig=await sc.structure('1X9N'),lc=centroid(coordsOf(lig,i=>lig.chain[i]==='A'));sc.add(lig,{pick:i=>lig.chain[i]==='A'&&!/HOH/.test(lig.comp[i])?'ligase':null,place:p=>add(sub(p,lc),add(s2,[0,-6,46]))});
    }},
  'gene-regulation':{version:'r1',frame:null,surface:{spacing:1.5,smooth:.6,probe:1},
    notes:'Montagem com moléculas reais: nucleossomos (PDB 1KX5) na cromatina compacta, fator de transcrição CREB ligado ao DNA (PDB 1DH3) num elemento intensificador, proteína de ligação ao TATA (TBP de levedura, PDB 1YTB) no promotor e Argonauta 2 humana com um microRNA (PDB 4W5N) ligado a um mRNA. O DNA livre é dupla hélice B construída de um passo real (PDB 1BNA). O processamento do RNA aparece como um transcrito com íntron em laço, e a estabilidade do mRNA como a cauda poli(A). Distâncias e a dobra do DNA são ilustrativas.',
    parts:{enhancer:{color:0xe0a050,budget:{desktop:24000,touch:9000}},'transcription-factor':{color:0x56b5a4,budget:{desktop:30000,touch:11000}},promoter:{color:0xd08a3a,budget:{desktop:40000,touch:15000}},chromatin:{color:0x8d84d6,budget:{desktop:150000,touch:55000}},'rna-processing':{color:0xb07fd0,budget:{desktop:16000,touch:7000}},'mrna-stability':{color:0x52b788,budget:{desktop:14000,touch:6000}},'regulatory-rna':{color:0xd85a7f,budget:{desktop:50000,touch:18000}}},
    async scene(sc){
      const nuc=await sc.structure('1KX5'),nc=centroid(coordsOf(nuc,()=>true));
      for(const [k,at] of[[0,[-170,0,0]],[1,[-120,40,30]],[2,[-70,0,-10]]])sc.add(nuc,{pick:i=>/HOH|MN|CL/.test(nuc.comp[i])?null:'chromatin',place:p=>add(rotateAxis(sub(p,nc),[0,1,0],k*1.1),at),color:i=>/^[IJ]$/.test(nuc.chain[i])?(BACKBONE.has(nuc.name[i])?0xb9c3cf:BASE_COLOR[nuc.comp[i]]||null):null});
      await bdna(sc,{pairs:24,origin:[-10,0,0],axis:[1,0,0],strandParts:['chromatin','chromatin'],strandColors:[0xb9c3cf,0x9aa7b8]});
      await bdna(sc,{pairs:14,origin:[60,0,0],axis:[1,0,0],strandParts:['enhancer','enhancer'],strandColors:[0xe0a050,0xd08a3a],spin:1});
      const creb=await sc.structure('1DH3'),cd=coordsOf(creb,i=>/^[BD]$/.test(creb.chain[i])),{center:cc,axis:ca}=principalAxis(cd);
      sc.add(creb,{pick:i=>/^[AC]$/.test(creb.chain[i])&&!/HOH|MG/.test(creb.comp[i])?'transcription-factor':null,place:p=>add(alignVec(sub(p,cc),ca,[1,0,0]),[60,0,0])});
      await bdna(sc,{pairs:18,origin:[150,0,0],axis:[1,0,0],strandParts:['promoter','promoter'],strandColors:[0xd08a3a,0xc07a2a],spin:2});
      const tbp=await sc.structure('1YTB'),td=coordsOf(tbp,i=>tbp.entity[i]!=='1'),tdc=centroid(td);void td;const tc=centroid(coordsOf(tbp,i=>tbp.chain[i]==='A'));
      sc.add(tbp,{pick:i=>tbp.chain[i]==='A'&&!/HOH/.test(tbp.comp[i])?'promoter':null,place:p=>add(sub(p,tc),[150,26,0]),color:()=>0x56b5a4});void tdc;
      sc.strand('rna-processing',[[200,-40,20],[230,-70,10],[262,-60,-10],[250,-30,-20],[232,-46,0],[262,-90,10],[300,-100,20]]);
      sc.strand('mrna-stability',[[300,-100,20],[340,-110,30],[370,-100,40]],{baseColors:[BASE_COLOR.A]});
      const ago=await sc.structure('4W5N'),ac=centroid(coordsOf(ago,()=>true));sc.add(ago,{pick:i=>/HOH|MG|CL|SO4|GOL/.test(ago.comp[i])?null:'regulatory-rna',place:p=>add(sub(p,ac),[300,-30,-70]),color:i=>ago.entity[i]==='1'?null:(BACKBONE.has(ago.name[i])?0xd85a7f:BASE_COLOR[ago.comp[i]]||null)});
    }},
  'cell-signaling':{version:'r1',tilt:.3,frame:null,surface:{spacing:1.5,smooth:.6,probe:1},
    notes:'Via do AMP cíclico montada com moléculas reais: receptor β2-adrenérgico acoplado à proteína Gs (PDB 3SN6; a lisozima de fusão e o nanocorpo da cristalização foram retirados), adrenalina (epinefrina), cAMP e ATP do dicionário de componentes do PDB, adenilato ciclase com Gαs (PDB 1AZS), proteína quinase A (subunidade catalítica com ATP, PDB 1ATP), fosfodiesterase 4D com cAMP (PDB 2PW3), que encerra o sinal, e o fator de transcrição CREB ligado ao DNA (PDB 1DH3), mais abaixo, representando a resposta no núcleo. Membrana de POPC e colesterol. Distâncias e quantidades são ilustrativas.',
    parts:{ligand:{color:0xffffff,surface:{spacing:.6,smooth:.55,probe:.3},budget:{desktop:5000,touch:2500}},receptor:{color:0x8d84d6,budget:{desktop:110000,touch:40000}},'second-messenger':{color:0xffffff,surface:{spacing:.7,smooth:.55,probe:.3},budget:{desktop:12000,touch:5000}},kinase:{color:0xe0866a,budget:{desktop:40000,touch:15000}},'transcription-response':{color:0x56b5a4,budget:{desktop:30000,touch:11000}},feedback:{color:0xe0b24f,budget:{desktop:40000,touch:15000}},'context-membrane':{color:0xe3c08a,budget:{desktop:120000,touch:42000}}},
    async scene(sc){
      reseed(101);
      const g=await sc.structure('3SN6'),pick=i=>/^[ABGR]$/.test(g.chain[i])&&!(g.chain[i]==='R'&&g.seq[i]>=1000)&&!/HOH|P0G|CLR|OLC/.test(g.comp[i]);
      placeInMembrane(sc,g,{pick,part:'receptor',at:[-60,0,0],side:i=>/^[ABG]$/.test(g.chain[i]),up:false});
      const ac=await sc.structure('1AZS'),acc=centroid(coordsOf(ac,()=>true));
      await bilayer(sc,{size:[300,170],heads:'context-membrane',tails:'context-membrane',cholFraction:.25,cholPart:'context-membrane'});
      sc.add(ac,{pick:i=>/HOH|SO4|GOL|MG|FOK/.test(ac.comp[i])?null:'receptor',place:p=>add(sub(p,acc),[50,-55,0])});
      const top=sc.atoms.filter(a=>a.part==='receptor'&&a.p[0]<0).sort((a,b)=>b.p[1]-a.p[1])[0].p;sc.molecules('ligand',await sc.ligand('ALE'),[add(top,[0,8,0]),[-120,60,40],[20,70,-30]]);
      const camp=await sc.ligand('CMP');sc.molecules('second-messenger',camp,scatter(sc,14,{min:[0,-150,-70],max:[150,-90,70]},10));
      const pka=await sc.structure('1ATP'),pk=centroid(coordsOf(pka,i=>pka.chain[i]==='E'));sc.add(pka,{pick:i=>pka.chain[i]==='E'&&!/HOH|MN/.test(pka.comp[i])?'kinase':null,place:p=>add(sub(p,pk),[80,-175,10])});
      const pde=await sc.structure('2PW3'),pd=centroid(coordsOf(pde,i=>pde.chain[i]==='A'));sc.add(pde,{pick:i=>pde.chain[i]==='A'&&!/HOH|ZN|MG|CMP/.test(pde.comp[i])?'feedback':null,place:p=>add(sub(p,pd),[-40,-170,-20])});
      const creb=await sc.structure('1DH3'),cc=centroid(coordsOf(creb,()=>true));sc.add(creb,{pick:i=>/HOH|MG/.test(creb.comp[i])?null:'transcription-response',place:p=>add(sub(p,cc),[40,-260,0]),color:i=>/^[BD]$/.test(creb.chain[i])?nucleicColor(creb)(i)??0xb9c3cf:null});
    }},
};

/** Helical polymer from one subunit: n copies turned by `twist` and moved by `rise` along `axis` (through `center`). */
function helical(sc,s,{pick,part,axis,center,rise,twist,n,place=p=>p,color=null,radius=null,beads=false}){
  const a=norm(axis);for(let k=0;k<n;k++)for(let i=0;i<s.count;i++){if(!pick(i))continue;if(beads&&s.name[i]!=='CA'&&s.name[i]!=='P')continue;
    let p=sub([s.x[i],s.y[i],s.z[i]],center);p=rotateAxis(p,a,k*twist);p=add(p,mul(a,(k-(n-1)/2)*rise));sc.atoms.push({p:place(p),element:s.element[i],part,color:color?color(i,k):null,chain:part+k,radius:beads?(radius||3.4):null})}}
/** Microtubule of 13 protofilaments from one α/β-tubulin dimer (PDB 6DPU chains A, B): 8 nm per dimer, 3-start lattice. */
async function microtubule(sc,{part,origin,axis=[1,0,0],dimers=8,beads=false,colorA=0x7fb3d9,colorB=0x4d7fd1}){
  const t=await sc.structure('6DPU'),pick=i=>/^[AB]$/.test(t.chain[i])&&!/GTP|GDP|MG|G2P/.test(t.comp[i]);
  const pts=coordsOf(t,pick),{center,axis:long}=principalAxis(pts),ax=norm(axis),side=norm(cross(ax,Math.abs(ax[1])<.9?[0,1,0]:[1,0,0]));
  for(let pf=0;pf<13;pf++){const ang=pf/13*Math.PI*2,radial=rotateAxis(side,ax,ang),shift=pf*9.2;
    for(let d=0;d<dimers;d++)for(let i=0;i<t.count;i++){if(!pick(i))continue;if(beads&&t.name[i]!=='CA')continue;let p=alignVec(sub([t.x[i],t.y[i],t.z[i]],center),long,ax);p=rotateAxis(p,ax,ang);
      p=add(add(p,mul(radial,104)),mul(ax,(d-(dimers-1)/2)*81+shift));sc.atoms.push({p:add(origin,p),element:t.element[i],part,color:t.chain[i]==='A'?colorA:colorB,chain:'mt',radius:beads?3.6:null})}}
}
/** Lipid vesicle drawn with one bead per lipid head group (two leaflets) — a coarse stand-in at organelle scale. */
function vesicle(sc,part,center,radius,{color=null}={}){const n=Math.round(4*Math.PI*radius*radius/64);for(const [r,k] of[[radius,1],[radius-38,.82]]){const m=Math.round(n*k*k);for(let i=0;i<m;i++){const y=1-(i+.5)/m*2,rr=Math.sqrt(1-y*y),ph=i*2.39996;sc.atoms.push({p:add(center,mul([rr*Math.cos(ph),y,rr*Math.sin(ph)],r)),element:'P',part,color,chain:'vesícula',radius:4.2})}}}

const CYTO={
  cytoskeleton:{version:'r1',frame:null,surface:{spacing:2.0,smooth:.6,probe:1.2},
    notes:'Filamentos do citoesqueleto montados a partir de estruturas reais: filamento de actina por simetria helicoidal de uma subunidade da estrutura de crio-microscopia PDB 6BNO (27,6 Å e −166,6° por subunidade), microtúbulo de 13 protofilamentos com o dímero de tubulina α/β da PDB 6DPU (8 nm por dímero), filamentos intermediários com dímeros em hélice dupla de vimentina (fragmento PDB 3UF1) enrolados como corda, cinesina-1 dimérica (PDB 3KIN) caminhando sobre o microtúbulo e puxando uma vesícula, e, representando o centrossomo, o complexo em anel de γ-tubulina humano (PDB 6V6S), que nucleia o microtúbulo e fica na sua extremidade menos. A vesícula é desenhada com uma conta por lipídio, em escala reduzida de detalhe; comprimentos e quantidades são ilustrativos.',
    parts:{actin:{color:0xd77d6a,budget:{desktop:90000,touch:34000}},'intermediate-filaments':{color:0xe0b24f,budget:{desktop:60000,touch:22000}},microtubule:{color:0xffffff,budget:{desktop:150000,touch:55000}},centrosome:{color:0x9b7fd6,budget:{desktop:90000,touch:34000}},'motor-protein':{color:0x56b5a4,budget:{desktop:30000,touch:12000}},'vesicle-cargo':{color:0xd9c2e8,surface:{spacing:4,smooth:.7,probe:1.5},budget:{desktop:20000,touch:8000}}},
    async scene(sc){
      const act=await sc.structure('6BNO'),pa=principalAxis(coordsOf(act,()=>true)),one=i=>act.chain[i]===act.chain[0]&&!/HOH|ADP|MG|CA/.test(act.comp[i]);
      const sub0=centroid(coordsOf(act,one)),axisPoint=add(pa.center,mul(pa.axis,dot(sub(sub0,pa.center),pa.axis)));
      helical(sc,act,{pick:one,part:'actin',axis:pa.axis,center:axisPoint,rise:27.6,twist:-166.6*Math.PI/180,n:30,place:p=>add(alignVec(p,pa.axis,[1,0,0]),[0,-30,280])});
      await microtubule(sc,{part:'microtubule',origin:[0,0,0],axis:[1,0,0],dimers:9});
      // Kinesin walking on top of the microtubule, its stalk (built) reaching a vesicle.
      const kin=await sc.structure('3KIN'),kc=centroid(coordsOf(kin,()=>true));sc.add(kin,{pick:i=>/HOH|ADP/.test(kin.comp[i])?null:'motor-protein',place:p=>add(sub(p,kc),[60,150,0])});
      sc.peptide('motor-protein',[[60,175,0],[70,230,8],[80,290,0],[92,330,-6]]);vesicle(sc,'vesicle-cargo',[100,450,0],120);
      // Intermediate filament: eight vimentin coiled-coil fragments twisted into a rope.
      const v=await sc.structure('3UF1'),vp=principalAxis(coordsOf(v,()=>true));
      for(let k=0;k<8;k++)for(let seg=0;seg<5;seg++){const ang=k/8*Math.PI*2+seg*.6,off=rotateAxis([0,22,0],[1,0,0],ang);sc.add(v,{pick:i=>/HOH/.test(v.comp[i])?null:'intermediate-filaments',place:p=>add(add(rotateAxis(alignVec(sub(p,vp.center),vp.axis,[1,0,0]),[1,0,0],ang),off),[-300+seg*150,-170,0])})}
      // Centrosome: the γ-tubulin ring complex (PDB 6V6S) that nucleates the microtubule, capping its minus end.
      const g=await sc.structure('6V6S'),gp=i=>polymerOnly(g)(i),{center:gc,axis:ga}=minorAxis(coordsOf(g,gp));
      sc.add(g,{pick:i=>gp(i)?'centrosome':null,place:p=>add(alignVec(sub(p,gc),ga,[1,0,0]),[-430,0,0])});
    }},
  sarcomere:{version:'r1',frame:null,surface:{spacing:2.0,smooth:.6,probe:1.2},
    notes:'Trecho de sarcômero montado com estruturas reais: filamento fino cardíaco humano com actina, tropomiosina e troponina (PDB 6KN7, crio-microscopia, estado sem cálcio), cabeças de miosina II ligadas à actina no complexo de rigor (PDB 5H53) formando o filamento espesso (a cauda em hélice dupla é ilustrativa), α-actinina (PDB 4D1E) no disco Z e íons Ca²⁺ e ATP do dicionário de componentes do PDB. A linha M aparece como pontes ilustrativas entre os filamentos espessos. Comprimento reduzido (um sarcômero real mede ~2,2 µm); espaçamentos aproximados.',
    parts:{'z-discs':{color:0xc9a3e0,budget:{desktop:50000,touch:18000}},'thin-filaments':{color:0xd77d6a,budget:{desktop:140000,touch:50000}},'thick-filaments':{color:0x5aa0d6,budget:{desktop:120000,touch:44000}},'m-line':{color:0xe0b24f,budget:{desktop:12000,touch:5000}},'troponin-tropomyosin':{color:0x56b5a4,budget:{desktop:50000,touch:18000}},calcium:{color:0x9fe0c8,budget:{desktop:8000,touch:4000}},'atp-cycle':{color:0xffffff,surface:{spacing:.7,smooth:.55,probe:.3},budget:{desktop:8000,touch:3500}}},
    async scene(sc){
      reseed(131);
      const tf=await sc.structure('6KN7'),pts=coordsOf(tf,()=>true),{center:fc,axis:fa}=principalAxis(pts),half=Math.max(...pts.map(p=>Math.abs(dot(sub(p,fc),fa))));
      // Hexagonal lattice: six thin filaments 250 Å around the thick one; each runs from its Z disc and stops short of the
      // centre (the H zone), as in a relaxed sarcomere.
      const hex=[0,1,2,3,4,5].map(k=>[0,Math.cos(k*Math.PI/3)*250,Math.sin(k*Math.PI/3)*250]),Z=620,end=140;
      for(const h of hex)for(const side of[-1,1]){const centre=side*(end+half);sc.add(tf,{pick:i=>{if(/HOH|ADP|MG|CA/.test(tf.comp[i]))return null;const d=(tf.entities[tf.entity[i]]||'').toUpperCase();return/ACTIN/.test(d)?'thin-filaments':'troponin-tropomyosin'},place:p=>add(alignVec(sub(p,fc),fa,[side,0,0]),[centre,h[1],h[2]])})}
      // Thick filament: backbone of myosin tails (built) and heads (PDB 5H53) pointing towards the thin filaments,
      // none in the bare zone at the centre.
      const my=await sc.structure('5H53'),head=i=>/^[ABC]$/.test(my.chain[i])&&!/ADP|MG/.test(my.comp[i]),hp=coordsOf(my,head),{center:hc,axis:ha}=principalAxis(hp);
      for(let k=0;k<18;k++){const side=k<9?-1:1,x=side*(150+(k%9)*52),h=hex[k%6],dir=norm(h);sc.add(my,{pick:i=>head(i)?'thick-filaments':null,place:p=>add(alignVec(sub(p,hc),ha,norm(add(dir,[side*.5,0,0]))),add([x,0,0],mul(dir,125)))})}
      for(let k=0;k<6;k++){const a=k/6*Math.PI*2;sc.peptide('thick-filaments',[[-560,Math.cos(a)*45,Math.sin(a)*45],[0,Math.cos(a+.3)*45,Math.sin(a+.3)*45],[560,Math.cos(a+.6)*45,Math.sin(a+.6)*45]])}
      // Z discs: α-actinin crosslinking the thin-filament ends; M line: proteins tying the thick filament at the centre.
      const aa=await sc.structure('4D1E'),ac=centroid(coordsOf(aa,()=>true));for(const x of[-Z,Z])for(let k=0;k<6;k++){const a=k/6*Math.PI*2+Math.PI/6;sc.add(aa,{pick:i=>/HOH/.test(aa.comp[i])?null:'z-discs',place:p=>add(rotateAxis(sub(p,ac),[1,0,0],a),[x,Math.cos(a)*230,Math.sin(a)*230])})}
      for(let k=0;k<6;k++){const a=k/6*Math.PI*2;sc.peptide('m-line',[[0,Math.cos(a)*45,Math.sin(a)*45],[0,Math.cos(a)*150,Math.sin(a)*150],[0,Math.cos(a+1.05)*150,Math.sin(a+1.05)*150]])}
      sc.ions('calcium','CA',scatter(sc,24,{min:[-600,-330,-330],max:[600,330,330]},14),0x9fe0c8,2.8);
      sc.molecules('atp-cycle',await sc.ligand('ATP'),scatter(sc,10,{min:[-500,-200,-200],max:[500,200,200]},18));
    }},
  peroxisome:{version:'r1',frame:null,surface:{spacing:2.2,smooth:.6,probe:1.2},
    notes:'Peroxissomo em escala molecular: membrana desenhada com uma conta por lipídio (detalhe reduzido), cheia de catalase humana (PDB 1DGF, tetrâmero com heme), e acil-CoA oxidase representada pela catalase em outra cor como enzima oxidativa ilustrativa; água oxigenada, ácido palmítico e O₂ vêm do dicionário de componentes do PDB. Peroxissomos reais medem 0,1–1 µm e contêm muitas outras enzimas; este modelo tem ~60 nm e densidade de proteínas ilustrativa.',
    parts:{membrane:{color:0xe3c08a,surface:{spacing:4,smooth:.7,probe:1.5},budget:{desktop:50000,touch:20000}},matrix:{color:0xbfe3d6,budget:{desktop:3000,touch:1500}},'oxidative-enzymes':{color:0x7a8fd6,budget:{desktop:80000,touch:30000}},catalase:{color:0xd77b56,budget:{desktop:110000,touch:40000}},'hydrogen-peroxide':{color:0xffffff,surface:{spacing:.6,smooth:.55,probe:.25},budget:{desktop:6000,touch:3000}},'fatty-acid':{color:0xffffff,surface:{spacing:.7,smooth:.55,probe:.3},budget:{desktop:8000,touch:3500}}},
    async scene(sc){
      reseed(141);
      vesicle(sc,'membrane',[0,0,0],320);
      const cat=await sc.structure('1DGF'),cc=centroid(coordsOf(cat,()=>true)),pick=i=>/HOH|ACT|NDP/.test(cat.comp[i])?null:true;
      const spots=[];for(let t=0;t<200&&spots.length<16;t++){const p=[(random()-.5)*400,(random()-.5)*400,(random()-.5)*400];if(len(p)<200&&spots.every(q=>len(sub(p,q))>105))spots.push(p)}
      spots.forEach((at,k)=>{const ax=[random()-.5,random()-.5,random()-.5],ang=random()*6;sc.add(cat,{pick:i=>pick(i)?(k%3===2?'oxidative-enzymes':'catalase'):null,place:p=>add(rotateAxis(sub(p,cc),ax,ang),at)})});
      sc.molecules('hydrogen-peroxide',await sc.ligand('PEO'),scatter(sc,18,{min:[-220,-220,-220],max:[220,220,220]},14).filter(p=>len(p)<250));
      sc.molecules('fatty-acid',await sc.ligand('PLM'),scatter(sc,8,{min:[-220,-220,-220],max:[220,220,220]},18).filter(p=>len(p)<250));
      sc.mesh('matrix',redCell('swollen',380,[0,0,0]),0xbfe3d6,.06);
    }},
};

/** A molecule with its hydrogens (water, to show polarity). */
async function withH(code){return fetchLigand(code,{keepH:true})}
const cpk=lig=>lig.element.map(e=>CPK[e]??0x9aa7b8);
/** One copy of a ligand at `at`, turned by axis/angle, with per-element colours. */
function put(sc,part,lig,at,{ax=[0,1,0],ang=0,color=null,radius=null}={}){const c=centroid(Array.from({length:lig.count},(_,i)=>[lig.x[i],lig.y[i],lig.z[i]]));for(let i=0;i<lig.count;i++)sc.atoms.push({p:add(at,rotateAxis(sub([lig.x[i],lig.y[i],lig.z[i]],c),ax,ang)),element:lig.element[i],part,color:color??CPK[lig.element[i]]??null,chain:lig.comp[0],radius})}
/** An enzyme (one chain or all) centred at `at`, slowly turned so neighbours differ. */
async function enzyme(sc,code,part,at,{chains=null,ang=0,color=null,assembly=0}={}){const s=await sc.structure(code,{assembly}),pick=i=>(!chains||chains.test(s.chain[i]))&&polymerOnly(s)(i),c=centroid(coordsOf(s,pick));sc.add(s,{pick:i=>pick(i)?part:null,place:p=>add(rotateAxis(sub(p,c),[0,1,0],ang),at),color:color?()=>color:null});return s}

const CHEM={
  'proteins-enzymes':{version:'r1',frame:null,surface:{spacing:1.1,smooth:.58,probe:.6},
    notes:'Hexoquinase I humana (PDB 1HKB) com glicose no sítio ativo, o exemplo clássico de encaixe induzido; os resíduos a até 6 Å da glicose formam o sítio ativo (dourado). ATP, ADP, glicose-6-fosfato, Mg²⁺ e aminoácidos livres vêm do dicionário de componentes do PDB; a minipproteína Trp-cage (PDB 1L2Y) mostra a cadeia polipeptídica e suas ligações peptídicas em cores por elemento. A proteína desnaturada ao lado é uma cadeia estendida ilustrativa, sem a dobra funcional.',
    parts:{'amino-acid':{color:0xffffff,surface:{spacing:.6,smooth:.55,probe:.25},budget:{desktop:12000,touch:5000}},'peptide-bond':{color:0xffffff,surface:{spacing:.6,smooth:.55,probe:.25},budget:{desktop:14000,touch:6000}},'protein-fold':{color:0x7a8fd6,budget:{desktop:120000,touch:45000}},'active-site':{color:0xe0b24f,budget:{desktop:12000,touch:5000}},substrate:{color:0xffffff,surface:{spacing:.6,smooth:.55,probe:.25},budget:{desktop:8000,touch:3500}},product:{color:0xffffff,surface:{spacing:.6,smooth:.55,probe:.25},budget:{desktop:8000,touch:3500}},cofactor:{color:0x6fcf6f,budget:{desktop:3000,touch:1500}},denaturation:{color:0x9aa7b8,budget:{desktop:20000,touch:8000}}},
    async scene(sc){
      reseed(151);
      const hk=await sc.structure('1HKB'),inA=i=>hk.chain[i]==='A',glc=coordsOf(hk,i=>inA(i)&&hk.comp[i]==='BGC'),c=centroid(coordsOf(hk,i=>inA(i)&&polymerOnly(hk)(i)));
      // The cleft holding glucose faces the camera (+z).
      const gC=centroid(glc),turn=p=>alignVec(sub(p,c),sub(gC,c),[0,.25,1]),site=turn(gC),near=p=>glc.some(g=>len(sub(g,p))<6);
      sc.add(hk,{pick:i=>{if(!inA(i))return null;if(hk.comp[i]==='BGC')return'substrate';if(hk.comp[i]==='G6P')return null;if(!polymerOnly(hk)(i))return null;return near([hk.x[i],hk.y[i],hk.z[i]])?'active-site':'protein-fold'},place:turn,color:i=>hk.comp[i]==='BGC'?CPK[hk.element[i]]:null});
      put(sc,'substrate',await sc.ligand('ATP'),add(site,[14,10,14]),{ax:[1,1,0],ang:1});put(sc,'product',await sc.ligand('ADP'),add(site,[-38,26,26]),{ax:[0,1,1],ang:2});put(sc,'product',await sc.ligand('G6P'),add(site,[-24,40,30]));
      sc.ions('cofactor','MG',[add(site,[20,2,20])],0x6fcf6f,2.4);
      for(const [k,aa] of['GLY','ALA','SER','LYS','PHE','TRP'].entries())put(sc,'amino-acid',await sc.ligand(aa),[-60+k*13,-48,40],{ax:[1,0,1],ang:k});
      const tc=await sc.structure('1L2Y'),tcc=centroid(coordsOf(tc,()=>true));sc.add(tc,{pick:i=>/HOH/.test(tc.comp[i])?null:'peptide-bond',place:p=>add(sub(p,tcc),[62,-40,40]),color:i=>CPK[tc.element[i]]??null});
      sc.peptide('denaturation',[[70,50,-20],[95,30,-10],[85,5,-30],[110,-5,-10],[100,-25,-30],[125,-30,-5]]);
    }},
  'biomolecules-water':{version:'r1',frame:null,surface:{spacing:.5,smooth:.55,probe:.15},
    notes:'Moléculas de água com seus hidrogênios (dicionário de componentes do PDB; O vermelho, H branco), arranjadas como no líquido, com as ligações de hidrogênio entre moléculas vizinhas desenhadas como traços. Ao lado: íons Na⁺ e Cl⁻ cada um com sua camada de hidratação (a água vira o oxigênio para o cátion e os hidrogênios para o ânion) e um pedaço de gelo com a rede hexagonal regular, que explica a menor densidade do gelo. A molécula ampliada destaca a polaridade (δ− no oxigênio, δ+ nos hidrogênios). Posições ilustrativas, sem simulação molecular.',
    parts:{water:{color:0xffffff,budget:{desktop:60000,touch:24000}},polarity:{color:0xffffff,budget:{desktop:6000,touch:3000}},'hydrogen-bonds':{color:0x9fe0c8,budget:{desktop:20000,touch:8000}},ions:{color:0xffffff,budget:{desktop:4000,touch:2000}},hydration:{color:0xffffff,budget:{desktop:12000,touch:5000}},temperature:{color:0xffffff,budget:{desktop:30000,touch:12000}}},
    async scene(sc){
      reseed(161);
      const w=await withH('HOH'),o=[w.x[w.element.indexOf('O')],w.y[w.element.indexOf('O')],w.z[w.element.indexOf('O')]];
      const water=(part,at,dir=null,color=null)=>{const ang=random()*6.3,ax=dir?cross([0,1,0],dir):[random()-.5,random()-.5,random()-.5];for(let i=0;i<w.count;i++){let p=sub([w.x[i],w.y[i],w.z[i]],o);if(dir){const hmid=centroid([0,1,2].filter(j=>w.element[j]==='H').map(j=>sub([w.x[j],w.y[j],w.z[j]],o)));p=alignVec(p,hmid,dir)}else p=rotateAxis(p,ax,ang);sc.atoms.push({p:add(at,p),element:w.element[i],part,color:color?color(w.element[i]):CPK[w.element[i]],chain:'água'})}};
      // Liquid: a loose cluster at ~3 Å spacing; hydrogen bonds drawn between oxygens 2.6–3.2 Å apart.
      const pos=[];for(let t=0;t<4000&&pos.length<90;t++){const p=[(random()-.5)*40,(random()-.5)*40,(random()-.5)*40];if(len(p)<21&&pos.every(q=>len(sub(p,q))>2.85))pos.push(p)}
      for(const p of pos)water('water',p);
      for(let a=0;a<pos.length;a++)for(let b=a+1;b<pos.length;b++){const d=len(sub(pos[a],pos[b]));if(d>2.6&&d<3.25)for(let t=.3;t<=.7;t+=.13)sc.atoms.push({p:add(pos[a],mul(sub(pos[b],pos[a]),t)),element:'H',part:'hydrogen-bonds',color:0x9fe0c8,chain:'ponte',radius:.12})}
      // Polarity: one water molecule set apart, oxygen tinted δ−, hydrogens δ+.
      water('polarity',[0,34,0],null,e=>e==='O'?0xd94a3d:0x7fb3ff);
      // Hydrated ions: water turns O towards Na⁺, H towards Cl⁻.
      sc.ions('ions','NA',[[46,0,0]],0x9f7fe0,1.6);sc.ions('ions','CL',[[46,-26,0]],0x5fc75f,2.2);
      for(const [d,s] of[[[1,0,0],1],[[-1,0,0],1],[[0,1,0],1],[[0,-1,0],1],[[0,0,1],1],[[0,0,-1],1]])water('hydration',add([46,0,0],mul(d,2.4)),mul(d,1));
      for(const d of[[1,0,0],[-1,0,0],[0,-1,0],[0,0,1],[0,0,-1],[.7,.7,0]])water('hydration',add([46,-26,0],mul(norm(d),3.2)),mul(norm(d),-1));
      // Ice: a small hexagonal lattice (oxygen positions of ice Ih, 2.76 Å apart).
      for(let i=0;i<4;i++)for(let j=0;j<4;j++)for(let k=0;k<3;k++){const x=-56+i*4.5+(j%2)*2.25,y=-6+k*7.36,z=j*3.9;water('temperature',[x,y,z]);water('temperature',[x+2.25,y+.92,z+1.3])}
    }},
  'carbohydrates-lipids':{version:'r1',frame:null,surface:{spacing:.6,smooth:.55,probe:.25},
    notes:'Moléculas do dicionário de componentes do PDB em cores por elemento (C cinza, O vermelho, P laranja): glicose (monossacarídeo), uma cadeia de amilose montada com glicoses em hélice (polissacarídeo de reserva, ~6 resíduos por volta), triacilglicerol (triestearina), fosfatidilcolina (POPC), colesterol e os ácidos graxos palmítico (saturado, reto) e oleico (insaturado, com dobra). Geometria das moléculas isoladas, sem interação entre elas.',
    parts:{monosaccharide:{color:0xffffff,budget:{desktop:5000,touch:2500}},polysaccharide:{color:0xffffff,budget:{desktop:40000,touch:16000}},triglyceride:{color:0xffffff,budget:{desktop:10000,touch:4000}},phospholipid:{color:0xffffff,budget:{desktop:10000,touch:4000}},cholesterol:{color:0xffffff,budget:{desktop:6000,touch:3000}},'fatty-acid':{color:0xffffff,budget:{desktop:8000,touch:3500}}},
    async scene(sc){
      put(sc,'monosaccharide',await sc.ligand('GLC'),[-40,20,0]);
      const g=await sc.ligand('GLC');for(let k=0;k<30;k++){const a=k/6*Math.PI*2;put(sc,'polysaccharide',g,[-40+k*1.35,-12+Math.cos(a)*6.5,Math.sin(a)*6.5],{ax:[1,0,0],ang:a})}
      put(sc,'triglyceride',await sc.ligand('TGL'),[0,24,0],{ax:[0,0,1],ang:.3});put(sc,'phospholipid',await sc.ligand('POV'),[22,24,0],{ax:[0,0,1],ang:1.4});
      put(sc,'cholesterol',await sc.ligand('CLR'),[40,22,0],{ax:[0,0,1],ang:1.5});put(sc,'fatty-acid',await sc.ligand('PLM'),[22,-14,0],{ax:[0,0,1],ang:1.5});put(sc,'fatty-acid',await sc.ligand('OLA'),[34,-14,0],{ax:[0,0,1],ang:1.5});
    }},
  'glycolysis-fermentation':{version:'r1',frame:null,surface:{spacing:1.6,smooth:.6,probe:1},
    notes:'Enzimas reais da glicólise e das fermentações em sequência: hexoquinase (PDB 1HKB), fosfofrutoquinase (PDB 3PFK), gliceraldeído-3-fosfato desidrogenase (PDB 1GPD), piruvato quinase (PDB 1PKN), lactato desidrogenase humana com NADH (PDB 1I10), piruvato descarboxilase (PDB 1PVD) e álcool desidrogenase de levedura (PDB 4W6Z). Glicose, piruvato, ATP, NAD⁺/NADH, lactato, etanol e CO₂ vêm do dicionário de componentes do PDB, em cores por elemento. As etapas intermediárias e suas enzimas foram resumidas; distâncias ilustrativas.',
    parts:{glucose:{color:0xffffff,surface:{spacing:.6,smooth:.55,probe:.25},budget:{desktop:5000,touch:2500}},'cytosolic-reactions':{color:0x7a8fd6,budget:{desktop:160000,touch:60000}},pyruvate:{color:0xffffff,surface:{spacing:.6,smooth:.55,probe:.25},budget:{desktop:5000,touch:2500}},atp:{color:0xffffff,surface:{spacing:.6,smooth:.55,probe:.25},budget:{desktop:9000,touch:4000}},'nad-nadh':{color:0xffffff,surface:{spacing:.6,smooth:.55,probe:.25},budget:{desktop:9000,touch:4000}},lactate:{color:0xd77d6a,budget:{desktop:50000,touch:19000}},'ethanol-co2':{color:0xe0b24f,budget:{desktop:60000,touch:22000}}},
    async scene(sc){
      const L=k=>[-330+k*110,0,0];
      await enzyme(sc,'1HKB','cytosolic-reactions',L(0),{chains:/^A$/});await enzyme(sc,'3PFK','cytosolic-reactions',L(1));await enzyme(sc,'1GPD','cytosolic-reactions',L(2),{chains:/^[GR]$/});await enzyme(sc,'1PKN','cytosolic-reactions',L(3));
      await enzyme(sc,'1I10','lactate',[260,-110,0],{chains:/^[A-D]$/});await enzyme(sc,'1PVD','ethanol-co2',[230,110,0],{chains:/^[AB]$/});await enzyme(sc,'4W6Z','ethanol-co2',[360,140,0],{chains:/^[A-D]$/});
      put(sc,'glucose',await sc.ligand('GLC'),[-400,60,0]);for(const k of[0,1])put(sc,'atp',await sc.ligand('ATP'),add(L(k),[0,75,20]));for(const k of[3])put(sc,'atp',await sc.ligand('ATP'),add(L(k),[0,75,20]));
      put(sc,'nad-nadh',await sc.ligand('NAD'),add(L(2),[0,80,20]));put(sc,'nad-nadh',await sc.ligand('NAI'),add(L(2),[20,-80,20]));
      put(sc,'pyruvate',await sc.ligand('PYR'),[110,0,40]);put(sc,'pyruvate',await sc.ligand('PYR'),[130,10,-30]);
      for(const p of[[330,-150,40],[350,-120,-30]])put(sc,'lactate',await sc.ligand('LAC'),p,{color:null});
      for(const p of[[440,170,30],[450,120,-30]])put(sc,'ethanol-co2',await sc.ligand('EOH'),p);for(const p of[[300,170,40],[290,60,-40]])put(sc,'ethanol-co2',await sc.ligand('CO2'),p);
    }},
  'krebs-cycle':{version:'r1',frame:null,surface:{spacing:1.6,smooth:.6,probe:1},
    notes:'Enzimas reais do ciclo de Krebs em anel: citrato sintase (PDB 1CTS), aconitase (PDB 7ACN), isocitrato desidrogenase (PDB 1AI2), succinato desidrogenase/complexo II (PDB 1NEK), fumarase (PDB 1FUO) e malato desidrogenase (PDB 4MDH); a α-cetoglutarato desidrogenase e a succinil-CoA sintetase, enormes, não foram incluídas. Acetil-CoA, oxaloacetato, citrato, isocitrato, α-cetoglutarato, succinil-CoA, succinato, fumarato, malato, CO₂, NADH, FADH₂ e GTP vêm do dicionário de componentes do PDB, em cores por elemento. A esfera translúcida representa a matriz mitocondrial; distâncias ilustrativas.',
    parts:{'acetyl-coa':{color:0xffffff,surface:{spacing:.6,smooth:.55,probe:.25},budget:{desktop:8000,touch:3500}},oxaloacetate:{color:0xffffff,surface:{spacing:.6,smooth:.55,probe:.25},budget:{desktop:4000,touch:2000}},citrate:{color:0xffffff,surface:{spacing:.6,smooth:.55,probe:.25},budget:{desktop:4000,touch:2000}},co2:{color:0xffffff,surface:{spacing:.6,smooth:.55,probe:.25},budget:{desktop:4000,touch:2000}},'nadh-fadh2':{color:0xffffff,surface:{spacing:.6,smooth:.55,probe:.25},budget:{desktop:14000,touch:6000}},'substrate-atp':{color:0xffffff,surface:{spacing:.6,smooth:.55,probe:.25},budget:{desktop:6000,touch:3000}},enzymes:{color:0x7a8fd6,budget:{desktop:200000,touch:75000}},matrix:{color:0x7fb3d9,budget:{desktop:3000,touch:1500}}},
    async scene(sc){
      const R=190,at=k=>[Math.cos(k/6*Math.PI*2)*R,0,Math.sin(k/6*Math.PI*2)*R],mid=k=>mul(at(k+.5),.62);
      await enzyme(sc,'1CTS','enzymes',at(0),{chains:/^A$/});await enzyme(sc,'7ACN','enzymes',at(1));await enzyme(sc,'1AI2','enzymes',at(2));await enzyme(sc,'1NEK','enzymes',at(3),{chains:/^[A-D]$/});await enzyme(sc,'1FUO','enzymes',at(4),{chains:/^A$/});await enzyme(sc,'4MDH','enzymes',at(5),{chains:/^A$/});
      put(sc,'acetyl-coa',await sc.ligand('ACO'),add(at(0),[0,70,0]));put(sc,'oxaloacetate',await sc.ligand('OAA'),mid(5));put(sc,'citrate',await sc.ligand('CIT'),mid(0));
      for(const [k,code] of[[1,'ICT'],[2,'AKG'],[3,'SIN'],[4,'FUM']])put(sc,'citrate',await sc.ligand(code),mid(k),{color:null});
      put(sc,'substrate-atp',await sc.ligand('SCA'),mul(at(2.6),.75));put(sc,'substrate-atp',await sc.ligand('GTP'),mul(at(2.9),.9));put(sc,'oxaloacetate',await sc.ligand('MLT'),mid(4.6));
      for(const k of[1.6,2.4])put(sc,'co2',await sc.ligand('CO2'),add(at(k),[0,-60,0]));
      for(const k of[2,2.5,5])put(sc,'nadh-fadh2',await sc.ligand('NAI'),add(at(k),[0,70,0]));put(sc,'nadh-fadh2',await sc.ligand('FAD'),add(at(3),[0,75,0]));
      sc.mesh('matrix',redCell('swollen',330,[0,0,0]),0x7fb3d9,.07);
    }},
  'apoptosis-cancer':{version:'r1',frame:null,surface:{spacing:2,smooth:.6,probe:1.2},
    notes:'Montagem com estruturas reais: apoptossomo humano (PDB 5JUY) — a roda de Apaf-1 com o citocromo c liberado da mitocôndria (o sinal) e a caspase-9 ativada —, caspase-3 executora com um inibidor peptídico (PDB 1PAU) e p53 ligada ao DNA (PDB 1TSR), o guardião dos pontos de controle. O DNA danificado é dupla hélice B construída de um passo real (PDB 1BNA) com uma quebra. Corpos apoptóticos, a membrana do fagócito e a célula em divisão são desenhados com uma conta por lipídio, em escala reduzida de detalhe. Escalas e distâncias ilustrativas.',
    parts:{'death-signal':{color:0xd77b56,budget:{desktop:120000,touch:45000}},caspases:{color:0xe0b24f,budget:{desktop:40000,touch:15000}},'apoptotic-bodies':{color:0xd9c2e8,surface:{spacing:5,smooth:.7,probe:2},budget:{desktop:20000,touch:8000}},phagocyte:{color:0x9fd38a,surface:{spacing:6,smooth:.7,probe:2},budget:{desktop:24000,touch:10000}},proliferation:{color:0xc9d6e3,surface:{spacing:6,smooth:.7,probe:2},budget:{desktop:20000,touch:8000}},'dna-damage':{color:0xb9c3cf,budget:{desktop:20000,touch:8000}},checkpoint:{color:0x56b5a4,budget:{desktop:30000,touch:11000}}},
    async scene(sc){
      const ap=await sc.structure('5JUY'),c=centroid(coordsOf(ap,i=>polymerOnly(ap)(i)));
      sc.add(ap,{pick:i=>{if(!polymerOnly(ap)(i))return null;return/^[O-R]$/.test(ap.chain[i])?'caspases':'death-signal'},place:p=>sub(p,c),color:i=>/^[H-N]$/.test(ap.chain[i])?0xe04848:null});
      await enzyme(sc,'1PAU','caspases',[260,40,0]);
      const p53=await sc.structure('1TSR'),pc=centroid(coordsOf(p53,()=>true));sc.add(p53,{pick:i=>/HOH|ZN/.test(p53.comp[i])?null:/^[EF]$/.test(p53.chain[i])?'dna-damage':'checkpoint',place:p=>add(sub(p,pc),[-280,-60,0]),color:i=>/^[EF]$/.test(p53.chain[i])?(BACKBONE.has(p53.name[i])?null:BASE_COLOR[p53.comp[i]]||null):null});
      await bdna(sc,{pairs:14,origin:[-280,-60+60,-80],axis:[0,1,0],strandParts:['dna-damage','dna-damage'],strandColors:[0xb9c3cf,0x9aa7b8]});await bdna(sc,{pairs:14,origin:[-280,-60+120,-80],axis:norm([.3,1,0]),strandParts:['dna-damage','dna-damage'],strandColors:[0xb9c3cf,0x9aa7b8],spin:1});
      for(const [k,p] of[[0,[150,-260,0]],[1,[260,-240,60]],[2,[210,-330,-40]]])vesicle(sc,'apoptotic-bodies',p,60+k*12);
      // Phagocyte membrane: a cup of beads curving around the bodies.
      for(let i=0;i<2600;i++){const y=1-(i+.5)/2600*2,r=Math.sqrt(1-y*y),ph=i*2.39996,p=[r*Math.cos(ph),y,r*Math.sin(ph)];if(p[1]>.25)continue;sc.atoms.push({p:add([210,-200,10],mul(p,230)),element:'P',part:'phagocyte',color:null,chain:'fagócito',radius:5})}
      // Proliferating cell: two daughter spheres pinching apart.
      for(const off of[-70,70])for(let i=0;i<1400;i++){const y=1-(i+.5)/1400*2,r=Math.sqrt(1-y*y),ph=i*2.39996;sc.atoms.push({p:add([-260,230+off,0],mul([r*Math.cos(ph),y,r*Math.sin(ph)],85)),element:'P',part:'proliferation',color:null,chain:'divisão',radius:5})}
    }},
};

/** Bead membrane: one bead per lipid head group in each leaflet, on a sphere or cylinder (organelle-scale context). */
function beadSphere(sc,part,center,radius,{color=null,thickness=38,cap=null}={}){for(const r of[radius,radius-thickness]){const n=Math.round(4*Math.PI*r*r/64);for(let i=0;i<n;i++){const y=1-(i+.5)/n*2,rr=Math.sqrt(1-y*y),ph=i*2.39996,d=[rr*Math.cos(ph),y,rr*Math.sin(ph)];if(cap&&!cap(d))continue;sc.atoms.push({p:add(center,mul(d,r)),element:'P',part,color,chain:part,radius:4.2})}}}
function beadTube(sc,part,a,b,radius,{color=null,thickness=38,open=null}={}){const ax=sub(b,a),L=len(ax),u=norm(ax),side=norm(cross(u,Math.abs(u[1])<.9?[0,1,0]:[1,0,0])),up=cross(u,side);for(const r of[radius,radius-thickness]){const nu=Math.round(2*Math.PI*r/8),nl=Math.round(L/8);for(let i=0;i<nu;i++){const t=i/nu*Math.PI*2;if(open&&open(t))continue;for(let j=0;j<=nl;j++)sc.atoms.push({p:add(add(a,mul(u,j*8)),add(mul(side,Math.cos(t)*r),mul(up,Math.sin(t)*r))),element:'P',part,color,chain:part,radius:4.2})}}}
/** Doublet microtubule (13-protofilament A tubule + 10-protofilament B tubule) of tubulin residue beads (PDB 6DPU). */
async function doublet(sc,part,origin,axis,length,{colorA=0xc9d6e3,colorB=0x9fb3c9,outward=[1,0,0],triplet=false}={}){
  const t=await sc.structure('6DPU'),pick=i=>/^[AB]$/.test(t.chain[i])&&t.name[i]==='CA',{center:tc,axis:tl}=principalAxis(coordsOf(t,i=>/^[AB]$/.test(t.chain[i]))),ax=norm(axis),n=Math.max(1,Math.round(length/81));
  const tubes=[[0,13,0],[1,10,.6]];if(triplet)tubes.push([2,10,.6]);
  for(const [k,pfs,startFrac] of tubes){const c=add(origin,mul(norm(outward),k*190));for(let pf=0;pf<pfs;pf++){const ang=(startFrac+pf/13)*Math.PI*2,radial=rotateAxis(norm(cross(ax,cross(outward,ax))),ax,ang);
    for(let d=0;d<n;d++)for(let i=0;i<t.count;i++){if(!pick(i))continue;let p=alignVec(sub([t.x[i],t.y[i],t.z[i]],tc),tl,ax);p=rotateAxis(p,ax,ang);sc.atoms.push({p:add(c,add(add(p,mul(radial,104)),mul(ax,(d-(n-1)/2)*81+pf*9.2))),element:'C',part,color:t.chain[i]==='A'?colorA:colorB,chain:part+k,radius:3.6})}}}
}

const MORE={
  'cell-junctions':{version:'r1',frame:null,surface:{spacing:2,smooth:.6,probe:1.2},
    notes:'Pares de membranas de células vizinhas (POPC e colesterol do dicionário de componentes do PDB) com a distância de cada junção e suas proteínas reais: claudina-15 (PDB 4P79) na junção oclusiva, onde as membranas quase se tocam; caderinas (ectodomínio da caderina C, PDB 1L3W) atravessando ~25 nm na junção aderente, ligadas por dentro a filamentos de actina (PDB 6BNO); caderinas e uma placa densa ligada a filamentos intermediários (vimentina, PDB 3UF1) no desmossomo; o canal de conexina-26 (PDB 2ZW3) unindo as duas membranas na junção comunicante; colágeno (PDB 1BKV) e fibronectina (PDB 1FNF) na matriz extracelular. O plasmodesmo vegetal é um canal revestido de membrana atravessando uma parede de fibras de celulose ilustrativas, com o desmotúbulo no centro. Distâncias reais aproximadas; quantidades ilustrativas.',
    parts:{'tight-junction':{color:0x56b5a4,budget:{desktop:40000,touch:15000}},'adherens-junction':{color:0x7a8fd6,budget:{desktop:60000,touch:22000}},desmosome:{color:0xe0b24f,budget:{desktop:70000,touch:26000}},'gap-junction':{color:0xd77b56,budget:{desktop:40000,touch:15000}},plasmodesma:{color:0x8fcc4a,surface:{spacing:4,smooth:.7,probe:1.5},budget:{desktop:40000,touch:15000}},'extracellular-matrix':{color:0xc9a3e0,budget:{desktop:50000,touch:19000}},'context-membrane':{color:0xe3c08a,budget:{desktop:160000,touch:58000}}},
    async scene(sc){
      reseed(171);
      const cad=await sc.structure('1L3W'),cadPts=coordsOf(cad,i=>polymerOnly(cad)(i)),{center:cc,axis:ca}=principalAxis(cadPts);
      // Each junction: two membranes (centred at ±gap/2+20.5) around x = cx.
      const pair=async(cx,gap,width=150)=>{for(const s of[1,-1])await bilayer(sc,{center:[cx,s*(gap/2+20.5),0],size:[width,150],heads:'context-membrane',tails:'context-membrane',cholFraction:.25,cholPart:'context-membrane'})};
      // Tight junction: claudins in both membranes, touching across a ~2 nm gap.
      const cl=await sc.structure('4P79'),fcl=membraneFit(cl,{pick:i=>polymerOnly(cl)(i)});for(let k=0;k<4;k++)for(const s of[1,-1])sc.add(cl,{pick:i=>polymerOnly(cl)(i)?'tight-junction':null,place:membranePlacer(fcl,{at:[-560+k*32,s*22.5,0],flip:s<0})});
      await pair(-512,4,120);
      // Gap junction: connexon pair spanning both membranes.
      const gj=await sc.structure('2ZW3',{assembly:1}),gpts=coordsOf(gj,i=>polymerOnly(gj)(i)),{center:gc,axis:gax}=principalAxis(gpts);sc.add(gj,{pick:i=>polymerOnly(gj)(i)?'gap-junction':null,place:p=>add(alignVec(sub(p,gc),gax,[0,1,0]),[-260,0,0])});
      await pair(-260,35);
      // Adherens junction: cadherin ectodomains bridging 250 Å, actin inside each cell.
      for(let k=0;k<3;k++)sc.add(cad,{pick:i=>polymerOnly(cad)(i)?'adherens-junction':null,place:p=>add(rotateAxis(alignVec(sub(p,cc),ca,[.25,1,0]),[0,1,0],k*2.1),[20+k*30-30,0,(k-1)*40])});
      await pair(20,250);
      const act=await sc.structure('6BNO'),pa=principalAxis(coordsOf(act,()=>true));for(const y of[200,-200])sc.add(act,{pick:i=>polymerOnly(act)(i)?'adherens-junction':null,place:p=>add(alignVec(sub(p,pa.center),pa.axis,[1,0,0]),[20,y,0]),color:()=>0xd77d6a});
      // Desmosome: cadherins across 300 Å, dense plaques and intermediate filaments inside.
      for(let k=0;k<4;k++)sc.add(cad,{pick:i=>polymerOnly(cad)(i)?'desmosome':null,place:p=>add(rotateAxis(alignVec(sub(p,cc),ca,[-.2,1,0]),[0,1,0],k*1.6),[300+(k-1.5)*30,0,(k%2?40:-40)])});
      await pair(300,300);
      for(const s of[1,-1])for(let i=0;i<500;i++){const p=[300+(random()-.5)*130,s*(150+41+12+random()*20),(random()-.5)*130];sc.atoms.push({p,element:'C',part:'desmosome',color:0xc9a040,chain:'placa',radius:5})}
      const v=await sc.structure('3UF1'),vp=principalAxis(coordsOf(v,()=>true));for(const s of[1,-1])for(let k=0;k<3;k++)sc.add(v,{pick:i=>polymerOnly(v)(i)?'desmosome':null,place:p=>add(alignVec(sub(p,vp.center),vp.axis,norm([k-1,s*2,.3])),[300+(k-1)*30,s*290,0]),color:()=>0xe0b24f});
      // Extracellular matrix below the left cell: collagen triple helices in a staggered fibril and fibronectin.
      const col=await sc.structure('1BKV'),cp=principalAxis(coordsOf(col,()=>true));for(let r=0;r<5;r++)for(let k=0;k<6;k++)sc.add(col,{pick:i=>polymerOnly(col)(i)?'extracellular-matrix':null,place:p=>add(alignVec(sub(p,cp.center),cp.axis,[1,0,0]),[-560+k*95+(r%2)*45,-150-r*13,-60+r*24])});
      const fn=await sc.structure('1FNF'),fc=centroid(coordsOf(fn,()=>true));sc.add(fn,{pick:i=>polymerOnly(fn)(i)?'extracellular-matrix':null,place:p=>add(sub(p,fc),[-360,-215,30]),color:()=>0xa97ad6});
      // Plasmodesma: a membrane-lined pore through a cellulose wall, with the desmotubule (ER) in its middle.
      for(let i=0;i<700;i++){const y=(random()-.5)*300,z=(random()-.5)*300,x=620+(random()-.5)*120;if(Math.hypot(y,z)<70)continue;sc.atoms.push({p:[x,y,z],element:'C',part:'plasmodesma',color:0x9bd36a,chain:'parede',radius:6})}
      beadTube(sc,'plasmodesma',[560,0,0],[680,0,0],62,{color:0xe3c08a});beadTube(sc,'plasmodesma',[540,0,0],[700,0,0],16,{color:0xe8b83a,thickness:12});
    }},
  'viruses-acellular':{version:'r1',frame:null,surface:{spacing:2.4,smooth:.65,probe:1.4},
    notes:'À esquerda, um vírus sem envelope: o capsídeo icosaédrico de 60 subunidades do vírus-satélite do mosaico do Panicum (montagem biológica da estrutura PDB 1STM), com o RNA desenhado de forma ilustrativa por dentro. Ao centro, um vírus envelopado como o SARS-CoV-2 (~100 nm): envelope lipídico desenhado com uma conta por lipídio e espículas reais (glicoproteína S, PDB 6VXX), com o genoma de RNA ilustrativo dentro. À direita, a membrana da célula hospedeira (POPC e colesterol do dicionário de componentes do PDB) com o receptor ACE2 humano ligado ao domínio de ligação da espícula (PDB 6M17); abaixo dela, novas fitas de RNA viral e ribossomos (PDB 4V51, em contas) representam a replicação. Escalas relativas aproximadas.',
    parts:{capsid:{color:0x7a8fd6,budget:{desktop:60000,touch:22000}},'nucleic-acid':{color:0x52b788,budget:{desktop:30000,touch:12000}},envelope:{color:0xe3c08a,surface:{spacing:5,smooth:.7,probe:2},budget:{desktop:50000,touch:19000}},'surface-proteins':{color:0xd77b56,budget:{desktop:140000,touch:52000}},'host-cell':{color:0xb9c3cf,budget:{desktop:150000,touch:55000}},'replication-stage':{color:0x52b788,surface:{spacing:3,smooth:.65,probe:1.4},budget:{desktop:50000,touch:19000}}},
    async scene(sc){
      reseed(181);
      const cap=await sc.structure('1STM',{assembly:1}),cc=centroid(coordsOf(cap,()=>true));sc.add(cap,{pick:i=>polymerOnly(cap)(i)?'capsid':null,place:p=>add(sub(p,cc),[-900,0,0])});
      const coil=[];for(let k=0;k<26;k++){const t=k/26*Math.PI*6;coil.push([-900+Math.cos(t)*40*Math.sin(k/7),Math.sin(t)*40,Math.cos(k/5)*40])}sc.strand('nucleic-acid',coil);
      // Enveloped virion.
      beadSphere(sc,'envelope',[0,0,0],480);
      const sp=await sc.structure('6VXX'),spp=i=>polymerOnly(sp)(i),{center:sc0,axis:sa}=principalAxis(coordsOf(sp,spp));const tip=coordsOf(sp,spp).reduce((b,p)=>dot(sub(p,sc0),sa)>dot(sub(b,sc0),sa)?p:b);const out=dot(sub(tip,sc0),sa)>0?sa:mul(sa,-1);
      const dirs=[];for(let i=0;i<26;i++){const y=1-(i+.5)/26*2,r=Math.sqrt(1-y*y),ph=i*2.39996;dirs.push([r*Math.cos(ph),y,r*Math.sin(ph)])}
      for(const d of dirs)sc.add(sp,{pick:i=>spp(i)?'surface-proteins':null,place:p=>add(alignVec(sub(p,sc0),out,d),mul(d,480+70))});
      const gen=[];for(let k=0;k<40;k++){const t=k/40*Math.PI*8;gen.push([Math.cos(t)*260*Math.sin(k/9+1),Math.sin(t)*260*Math.cos(k/11),(k/40-.5)*420])}sc.strand('nucleic-acid',gen);
      // Host membrane with ACE2 bound to the spike's receptor-binding domain.
      const ace=await sc.structure('6M17'),ap=i=>polymerOnly(ace)(i)&&/^[ABEF]$/.test(ace.chain[i]),fa=membraneFit(ace,{pick:i=>polymerOnly(ace)(i)&&/^[AC]$/.test(ace.chain[i])});
      sc.add(ace,{pick:i=>ap(i)?(/^[EF]$/.test(ace.chain[i])?'surface-proteins':'host-cell'):null,place:membranePlacer(fa,{at:[1050,-150,0],flip:false})});
      await bilayer(sc,{center:[1050,-150,0],size:[360,260],heads:'host-cell',tails:'host-cell',cholFraction:.25,cholPart:'host-cell'});
      // Replication: viral RNA strands and ribosomes (residue beads of PDB 4V51) inside the host.
      for(let k=0;k<3;k++)sc.strand('replication-stage',[[900+k*90,-330,-80],[960+k*90,-380,0],[1000+k*90,-340,80]]);
      const rb=await sc.structure('4V51'),rp=i=>/^[AB]/.test(rb.chain[i])&&(rb.name[i]==='CA'||rb.name[i]==='P'),rc=centroid(coordsOf(rb,rp));
      for(const at of[[930,-470,0],[1130,-480,60]])sc.add(rb,{pick:i=>rp(i)?'replication-stage':null,place:p=>add(mul(sub(p,rc),1),at),color:()=>0x9aa7b8});
    }},
  'cilia-flagella':{version:'r1',frame:null,surface:{spacing:5,smooth:.7,probe:2},
    notes:'Cílio móvel em corte: o axonema 9+2 montado com contas por resíduo da tubulina real (PDB 6DPU) — nove duplas de microtúbulos e o par central —, braços de dineína do motor completo de dineína (PDB 3VKH) e a membrana desenhada com uma conta por lipídio, vistos em corte transversal (o padrão 9+2); abaixo, o corpúsculo basal com nove trios. O flagelo eucariótico, à direita, tem a mesma organização 9+2. O cílio primário, sensorial, tem arranjo 9+0, sem par central nem dineína. O flagelo bacteriano é outra máquina: motor e gancho de Salmonella (PDB 7CGO) e um trecho do filamento de flagelina (PDB 1UCU, por simetria helicoidal). Comprimentos reduzidos; detalhes em escala de contas.',
    parts:{axoneme:{color:0xc9d6e3,budget:{desktop:150000,touch:55000}},dynein:{color:0xe0866a,budget:{desktop:60000,touch:22000}},'basal-body':{color:0x9fb3c9,budget:{desktop:70000,touch:26000}},'motile-cilium':{color:0xe3c08a,budget:{desktop:40000,touch:15000}},'eukaryotic-flagellum':{color:0xb9c3cf,budget:{desktop:70000,touch:26000}},'bacterial-flagellum':{color:0x7a8fd6,surface:{spacing:3,smooth:.65,probe:1.4},budget:{desktop:120000,touch:44000}},'primary-cilium':{color:0xd9c2e8,budget:{desktop:60000,touch:22000}}},
    async scene(sc){
      // Axonemes seen end-on (axis towards the viewer, +z): the classic 9+2 and 9+0 cross-sections.
      const Z=[0,0,1];
      const axonemeAt=async(part,center,length,{central=true,arms=true,membranePart=null,arm='dynein'})=>{for(let k=0;k<9;k++){const ang=k/9*Math.PI*2,out=[Math.cos(ang),Math.sin(ang),0];await doublet(sc,part,add(center,mul(out,760)),Z,length,{outward:rotateAxis(out,Z,1.2)})}
        if(central)for(const s of[-1,1])await doublet(sc,part,add(center,[s*150,0,0]),Z,length,{outward:[s,0,0]});
        if(arms){const dy=await sc.structure('3VKH'),dp=i=>dy.chain[i]==='A'&&dy.name[i]==='CA',dc=centroid(coordsOf(dy,dp));for(let k=0;k<9;k++){const ang=(k+.35)/9*Math.PI*2;sc.add(dy,{pick:i=>dp(i)?arm:null,place:p=>add(mul(sub(p,dc),.8),add(center,[Math.cos(ang)*880,Math.sin(ang)*880,0])),radius:()=>3.6})}}
        if(membranePart)beadTube(sc,membranePart,add(center,[0,0,-length/2]),add(center,[0,0,length/2]),1100,{color:0xe3c08a})};
      await axonemeAt('axoneme',[0,0,0],400,{membranePart:'motile-cilium'});
      for(let k=0;k<9;k++){const ang=k/9*Math.PI*2,out=[Math.cos(ang),Math.sin(ang),0];await doublet(sc,'basal-body',add([0,-2700,0],mul(out,840)),Z,240,{outward:rotateAxis(out,Z,.6),triplet:true})}
      await axonemeAt('eukaryotic-flagellum',[2800,0,0],400,{arm:'eukaryotic-flagellum',membranePart:'eukaryotic-flagellum'});
      await axonemeAt('primary-cilium',[-2800,0,0],400,{central:false,arms:false,membranePart:'primary-cilium'});
      const fm=await sc.structure('7CGO'),fp=i=>polymerOnly(fm)(i)&&fm.name[i]==='CA',fc=principalAxis(coordsOf(fm,fp));sc.add(fm,{pick:i=>fp(i)?'bacterial-flagellum':null,place:p=>add(alignVec(sub(p,fc.center),fc.axis,[0,1,0]),[2800,-2700,0])});
      for(const a of sc.atoms)if(a.part==='bacterial-flagellum'&&!a.radius)a.radius=3.6;
      const fl=await sc.structure('1UCU');helical(sc,fl,{pick:i=>fl.name[i]==='CA',part:'bacterial-flagellum',axis:[0,0,1],center:[0,0,0],rise:4.7,twist:65.8*Math.PI/180,n:110,beads:true,place:p=>add(alignVec(p,[0,0,1],[0,1,0]),[2800,-2700+380+260,0])});
    }},
};

/** Points on a capsule (rod-shaped cell: cylinder of half-length h with hemispherical caps of radius r), ~`step` apart. */
function capsulePoints(h,r,step,keep=()=>true){const out=[];const nTheta=Math.max(8,Math.round(2*Math.PI*r/step));
  for(let x=-h;x<=h;x+=step)for(let i=0;i<nTheta;i++){const t=i/nTheta*Math.PI*2,p=[x,Math.cos(t)*r,Math.sin(t)*r];if(keep(p))out.push(p)}
  for(const s of[-1,1]){const n=Math.round(2*Math.PI*r*r/(step*step));for(let i=0;i<n;i++){const y=1-(i+.5)/n,rr=Math.sqrt(1-y*y),ph=i*2.39996,p=[s*(h+y*r),rr*Math.cos(ph)*r,rr*Math.sin(ph)*r];if(keep(p))out.push(p)}}return out}
const insideCapsule=(p,h,r)=>{const x=Math.max(-h,Math.min(h,p[0]));return Math.hypot(p[0]-x,p[1],p[2])<r};

const CELLS={
  'bacterial-cell':{version:'r1',frame:null,surface:{spacing:6,smooth:.7,probe:2},
    notes:'Bactéria em forma de bastonete (como Escherichia coli, ~1,6 × 0,6 µm aqui encurtada) aberta ao meio, montada em escala molecular reduzida: membranas externa e interna e o peptidoglicano entre elas desenhados com uma conta por lipídio ou unidade de parede; centenas de ribossomos com a forma real do ribossomo bacteriano (PDB 4V51, uma conta por resíduo); o nucleoide como fibra de DNA enovelada (ilustrativa) no centro; um plasmídeo em anel; e o flagelo com o motor e o gancho reais de Salmonella (PDB 7CGO) e o filamento de flagelina (PDB 1UCU) por simetria helicoidal. A cápsula aparece como uma camada externa difusa. Quantidades e densidades são ilustrativas; proteínas solúveis e outros componentes foram omitidos.',
    parts:{'plasma-membrane':{color:0xe3c08a,budget:{desktop:90000,touch:34000}},'cell-wall':{color:0x8fcc4a,budget:{desktop:70000,touch:26000}},cytoplasm:{color:0xbfd8e8,budget:{desktop:4000,touch:2000}},nucleoid:{color:0x6a5acd,surface:{spacing:5,smooth:.7,probe:2},budget:{desktop:80000,touch:30000}},ribosomes:{color:0x6f8fc4,budget:{desktop:150000,touch:55000}},flagellum:{color:0xd77b56,surface:{spacing:4,smooth:.7,probe:1.6},budget:{desktop:60000,touch:22000}},plasmid:{color:0xe0a050,surface:{spacing:4,smooth:.7,probe:1.6},budget:{desktop:12000,touch:5000}},capsule:{color:0xc9e8d8,budget:{desktop:30000,touch:12000}}},
    async scene(sc){
      reseed(191);
      const H=2600,R=2600,open=p=>p[2]<0;// the front half (z > 0) is removed to show the inside
      // Envelope: outer membrane, wall, inner membrane (beads), and a sparse capsule layer outside.
      for(const [part,r,step,color] of[['plasma-membrane',R,24,null],['cell-wall',R-90,30,null],['plasma-membrane',R-180,24,null]])for(const p of capsulePoints(H,r,step,open))sc.atoms.push({p,element:'C',part,color,chain:part,radius:part==='cell-wall'?16:15});
      for(const p of capsulePoints(H,R+260,70,p=>open(p)&&random()<.55))sc.atoms.push({p:add(p,[(random()-.5)*60,(random()-.5)*60,(random()-.5)*60]),element:'C',part:'capsule',color:null,chain:'cápsula',radius:26});
      // Ribosomes: residue beads of PDB 4V51, randomly turned, avoiding the nucleoid core.
      const rb=await sc.structure('4V51'),rp=i=>/^[AB]/.test(rb.chain[i])&&(rb.name[i]==='CA'||rb.name[i]==='P'),pts=coordsOf(rb,rp),rc=centroid(pts);
      const spots=[];for(let t=0;t<20000&&spots.length<240;t++){const p=[(random()-.5)*2*(H+R-400),(random()-.5)*2*(R-400),-random()*(R-400)];if(!insideCapsule(p,H,R-420))continue;if(Math.abs(p[1])<900&&Math.abs(p[0])<H*.7&&Math.abs(p[2])<900)continue;if(spots.some(q=>len(sub(p,q))<260))continue;spots.push(p)}
      for(const at of spots){const ax=[random()-.5,random()-.5,random()-.5],ang=random()*6.3;for(let k=0;k<pts.length;k+=1)sc.atoms.push({p:add(at,rotateAxis(sub(pts[k],rc),ax,ang)),element:'C',part:'ribosomes',color:null,chain:'ribossomo',radius:4.2})}
      // Nucleoid: a long DNA fibre folded in the middle (random walk confined to an ellipsoid).
      let p=[0,0,-400];for(let k=0;k<9000;k++){p=add(p,mul(norm([random()-.5,random()-.5,random()-.5]),34));const e=[p[0]/(H*.85),p[1]/1250,(p[2]+400)/1250];if(Math.hypot(...e)>1)p=mul(p,.92);if(p[2]>0)p[2]=-p[2];sc.atoms.push({p,element:'C',part:'nucleoid',color:null,chain:'DNA',radius:13})}
      // Plasmid: a small supercoiled ring.
      for(let k=0;k<400;k++){const t=k/400*Math.PI*2,c=[H*.55,-900,-1100],q=[Math.cos(t)*240,Math.sin(t)*240,Math.sin(t*6)*40];sc.atoms.push({p:add(c,q),element:'C',part:'plasmid',color:null,chain:'plasmídeo',radius:10})}
      // Flagellum at one pole: real motor + hook, then the flagellin filament.
      const fm=await sc.structure('7CGO'),fp=i=>polymerOnly(fm)(i)&&fm.name[i]==='CA',fpts=coordsOf(fm,fp),fc=principalAxis(fpts),pole=[-(H+R-180),0,-200];
      const tipSide=fpts.reduce((b,q)=>Math.abs(dot(sub(q,fc.center),fc.axis))>Math.abs(dot(sub(b,fc.center),fc.axis))?q:b),outDir=dot(sub(tipSide,fc.center),fc.axis)>0?fc.axis:mul(fc.axis,-1);
      sc.add(fm,{pick:i=>fp(i)?'flagellum':null,place:q=>add(alignVec(sub(q,fc.center),outDir,[-1,0,0]),pole),radius:()=>3.8});
      const fl=await sc.structure('1UCU');helical(sc,fl,{pick:i=>fl.name[i]==='CA',part:'flagellum',axis:[0,0,1],center:[0,0,0],rise:4.7,twist:65.8*Math.PI/180,n:700,beads:true,place:q=>add(alignVec(q,[0,0,1],[-1,0,0]),add(pole,[-1650-350,0,0]))});
      sc.mesh('cytoplasm',parametric((u,v)=>{const th=u*Math.PI*2,ph=v*Math.PI-Math.PI/2,x=Math.sin(ph)*(H+R-200),rr=Math.cos(ph)*(R-200);return[x,rr*Math.cos(th),Math.min(0,rr*Math.sin(th))]},64,48),0xbfd8e8,.07);
    }},
};

const pdbCredit=codes=>({title:'Protein Data Bank — '+codes.join(', '),author:'wwPDB / RCSB PDB e autores de cada estrutura',license:'CC0 1.0',url:'https://www.rcsb.org/',
  citation:codes.map(c=>c.startsWith('CCD ')?'Chemical Component Dictionary '+c.slice(4):'PDB '+c+' (https://doi.org/10.2210/pdb'+c.toLowerCase()+'/pdb)').join('; '),changes:'Superfície molecular gaussiana dos átomos pesados, reduzida para o aparelho; cores por parte, por cadeia ou por tipo de base.'});

export const RECIPES={
  ribosome:{version:'r1',frame:['small-subunit','large-subunit','trna'],surface:{spacing:1.8,smooth:.6,probe:1.2},
    notes:'Ribossomo bacteriano 70S de Thermus thermophilus com RNA mensageiro e três RNAs transportadores (sítios A, P e E), da estrutura cristalográfica PDB 4V51 (Selmer et al., Science 2006; CC0). Cada superfície envolve os átomos de uma parte. O RNA mensageiro foi prolongado de forma ilustrativa para ligar o ribossomo aos do polissomo, que são cópias reduzidas do mesmo modelo. O polipeptídio nascente não está resolvido nessa estrutura e aparece como um traço ilustrativo saindo da subunidade grande.',
    parts:{'small-subunit':{color:0xe8c27a,budget:{desktop:150000,touch:55000}},'large-subunit':{color:0x6f8fc4,budget:{desktop:200000,touch:70000}},trna:{color:0xd85a7f,budget:{desktop:24000,touch:10000}},mrna:{color:0x52b788,budget:{desktop:16000,touch:7000}},peptide:{color:0xf2a65a,budget:{desktop:6000,touch:3000}},polysome:{color:0x9aa7b8,budget:{desktop:90000,touch:30000}}},
    async scene(sc){
      const s=await sc.structure('4V51'),e=s.entities;
      sc.add(s,{pick:i=>{if(!/^[AB]/.test(s.chain[i]))return null;const d=(e[s.entity[i]]||'').toUpperCase();if(/MRNA/.test(d))return'mrna';if(/TRNA/.test(d))return'trna';if(/16S|30S/.test(d))return'small-subunit';if(/23S|5S|50S/.test(d))return'large-subunit';return null}});
      const of=p=>sc.atoms.filter(a=>a.part===p).map(a=>a.p),ssu=centroid(of('small-subunit')),lsu=centroid(of('large-subunit')),o=norm(sub(ssu,lsu)),m=of('mrna'),first=m[0],last=m.at(-1);
      const d0=sub(last,first),u=norm(sub(d0,mul(o,dot(d0,o))));
      const along=(from,t)=>add(add(from,mul(u,t)),add(mul(o,28+Math.abs(t)*.06),[0,Math.sin(t/180)*25,0]));
      sc.strand('mrna',[along(first,-760),along(first,-560),along(first,-360),along(first,-160),along(first,-40),first]);sc.strand('mrna',[last,along(last,40),along(last,160),along(last,360),along(last,560)]);
      // Nascent chain: from the tRNAs (peptidyl transferase side) out through the large subunit, away from the small one.
      const ptc=centroid(of('trna')),exit=add(lsu,mul(o,-125));sc.peptide('peptide',[ptc,add(ptc,mul(norm(sub(exit,ptc)),40)),add(lsu,mul(o,-60)),exit,add(exit,[20,-25,10]),add(exit,[45,-30,35])]);
      sc.copies.push({part:'polysome',from:['small-subunit','large-subunit'],shifts:[-640,-320,320].map(t=>add(mul(u,t),add(mul(o,Math.abs(t)*.06),[0,Math.sin(t/180)*25,0])))});
    }},
  'plasma-membrane':{version:'r1',tilt:.38,frame:null,surface:{spacing:1.4,smooth:.6,probe:.9},
    notes:'Trecho de membrana plasmática de ~22 nm montado com moléculas reais: fosfatidilcolina POPC e colesterol do dicionário de componentes do PDB (coordenadas ideais), aquaporina-1 humana (PDB 1J4N, tetrâmero) e o transportador de glicose GLUT1 (PDB 4PYP), com cadeias de açúcar (N-acetilglicosamina, manose, galactose, ácido siálico) do lado de fora e um filamento de actina (PDB 6BNO) por dentro. A orientação das proteínas na bicamada foi calculada pela faixa mais hidrofóbica de cada uma. Membranas reais são mais fluidas e variadas; a proporção de colesterol (~30 %) e a densidade das proteínas são ilustrativas.',
    parts:{'phospholipid-bilayer':{color:0xe3c08a,budget:{desktop:170000,touch:62000}},'hydrophobic-core':{color:0xf2e2a8,budget:{desktop:110000,touch:40000}},cholesterol:{color:0x9fd36a,budget:{desktop:45000,touch:16000}},'membrane-protein':{color:0x8d84d6,budget:{desktop:110000,touch:42000}},'carbohydrate-chain':{color:0x58c4b6,surface:{spacing:.9,smooth:.55,probe:.5},budget:{desktop:36000,touch:14000}},cytoskeleton:{color:0xd77d6a,budget:{desktop:60000,touch:22000}}},
    async scene(sc){
      reseed(7);
      const aqp=await sc.structure('1J4N',{assembly:1}),fa=membraneFit(aqp);sc.add(aqp,{pick:i=>/HOH|BNG|GOL/.test(aqp.comp[i])?null:'membrane-protein',place:membranePlacer(fa,{at:[-48,0,-10]})});
      const glut=await sc.structure('4PYP'),fg=membraneFit(glut);sc.add(glut,{pick:i=>/HOH|BNG|GOL|NAG|BOG/.test(glut.comp[i])?null:'membrane-protein',place:membranePlacer(fg,{at:[52,0,28],spin:1.1})});
      await bilayer(sc,{size:[230,220],cholFraction:.28});
      // Glycans on the outer face: on top of each protein and on some lipids (glycolipids).
      const top=(part,xz)=>Math.max(...sc.atoms.filter(a=>a.part===part&&Math.hypot(a.p[0]-xz[0],a.p[2]-xz[1])<14).map(a=>a.p[1]));
      await glycan(sc,'carbohydrate-chain',[-48,top('membrane-protein',[-48,-10])+2,-10],[.2,1,.1]);await glycan(sc,'carbohydrate-chain',[52,top('membrane-protein',[52,28])+2,28],[-.2,1,.3]);
      for(const [x,z] of[[-90,70],[10,-80],[95,-60],[-20,85],[80,95],[-100,-75]])await glycan(sc,'carbohydrate-chain',[x,24,z],[random()-.5,1,random()-.5],{units:random()<.5?5:7});
      // Actin filament under the inner leaflet, along x.
      const act=await sc.structure('6BNO'),ap=[];for(let i=0;i<act.count;i++)ap.push([act.x[i],act.y[i],act.z[i]]);const pa=principalAxis(ap);
      sc.add(act,{pick:i=>/HOH|ADP|MG|CA/.test(act.comp[i])?null:'cytoskeleton',place:p=>add(alignVec(sub(p,pa.center),pa.axis,[1,0,.12]),[0,-62,6])});
    }},
  'active-transport':{version:'r1',tilt:.38,frame:null,surface:{spacing:1.4,smooth:.6,probe:.9},
    notes:'Membrana montada com moléculas reais (POPC e colesterol do dicionário de componentes do PDB) contendo a bomba de sódio e potássio (Na⁺/K⁺-ATPase de rim de porco, PDB 3WGU: subunidades α, β e γ) e o cotransportador sódio–galactose de Vibrio parahaemolyticus (PDB 3DH4), parente bacteriano dos cotransportadores de glicose humanos. ATP e glicose vêm do dicionário do PDB. Íons aparecem como esferas do tamanho do íon hidratado: Na⁺ lilás (mais fora), K⁺ roxo (mais dentro), H₃O⁺ azul-claro no gradiente de prótons. Números de íons e moléculas são ilustrativos; concentrações reais diferem em ordens de grandeza.',
    parts:{pump:{color:0x7c86d9,budget:{desktop:120000,touch:45000}},cotransporter:{color:0x56b5a4,budget:{desktop:60000,touch:22000}},atp:{color:0xffffff,surface:{spacing:.7,smooth:.55,probe:.3},budget:{desktop:6000,touch:3000}},sodium:{color:0xc9b6ff,budget:{desktop:20000,touch:8000}},potassium:{color:0x6a3fbf,budget:{desktop:20000,touch:8000}},'solute-gradient':{color:0xffffff,surface:{spacing:.8,smooth:.55,probe:.3},budget:{desktop:24000,touch:9000}},'proton-gradient':{color:0x9fd8ff,budget:{desktop:14000,touch:6000}},'context-heads':{color:0xe3c08a,budget:{desktop:120000,touch:42000}},'context-tails':{color:0xf2e2a8,budget:{desktop:60000,touch:22000}}},
    async scene(sc){
      reseed(21);
      const nak=await sc.structure('3WGU'),pickNak=i=>/^[ABG]$/.test(nak.chain[i])&&!/HOH|NA|MG|ALF|ADP|CLR|PCW|NAG|BMA|MAN|CL|K|PO4|OBN/.test(nak.comp[i]);
      const fit=membraneFit(nak,{pick:pickNak}),beta=centroid(Array.from({length:nak.count},(_,i)=>i).filter(i=>nak.chain[i]==='B').map(i=>[nak.x[i],nak.y[i],nak.z[i]]));
      const flip=dot(sub(beta,fit.center),fit.normal)<0;sc.add(nak,{pick:i=>pickNak(i)?'pump':null,place:membranePlacer(fit,{at:[-45,0,92],flip})});
      const sglt=await sc.structure('3DH4'),pickS=i=>sglt.chain[i]==='A'&&!/HOH|GAL|NA|BOG/.test(sglt.comp[i]),fs=membraneFit(sglt,{pick:pickS});sc.add(sglt,{pick:i=>pickS(i)?'cotransporter':null,place:membranePlacer(fs,{at:[60,0,94],spin:.7})});
      await bilayer(sc,{size:[240,200],heads:'context-heads',tails:'context-tails',cholFraction:.25,cholPart:'context-tails'});
      // ATP beside the cytosolic (lowest) lobe of the pump.
      const low=sc.atoms.filter(a=>a.part==='pump').sort((a,b)=>a.p[1]-b.p[1]).slice(0,400).map(a=>a.p),lc=centroid(low);sc.molecules('atp',await sc.ligand('ATP'),[add(lc,[14,4,10])]);
      const out={min:[-115,30,-95],max:[115,80,95]},inn={min:[-115,-90,-95],max:[115,-30,95]};
      sc.ions('sodium','NA',scatter(sc,34,out,9),0xc9b6ff);sc.ions('sodium','NA',scatter(sc,5,inn,9),0xc9b6ff);
      sc.ions('potassium','K',scatter(sc,30,inn,9),0x6a3fbf,2.9);sc.ions('potassium','K',scatter(sc,5,out,9),0x6a3fbf,2.9);
      const glc=await sc.ligand('GLC');sc.molecules('solute-gradient',glc,scatter(sc,16,{min:[10,-85,-90],max:[115,-32,90]},11));sc.molecules('solute-gradient',glc,scatter(sc,3,{min:[10,32,-90],max:[115,80,90]},11));
      // Proton gradient: hydronium ions crowded on one side of the left half.
      sc.ions('proton-gradient','O',scatter(sc,26,{min:[-115,30,-95],max:[-10,70,0]},8),0x9fd8ff,2.1);sc.ions('proton-gradient','O',scatter(sc,4,{min:[-115,-70,-95],max:[-10,-30,0]},8),0x9fd8ff,2.1);
    }},
  'diffusion-facilitated':{version:'r1',tilt:.38,frame:null,surface:{spacing:1.4,smooth:.6,probe:.9},
    notes:'Membrana montada com moléculas reais (POPC e colesterol do dicionário de componentes do PDB) com o canal de potássio KcsA (PDB 1BL8, tetrâmero, com íons K⁺ em fila no poro) e o transportador de glicose GLUT1 humano (PDB 4PYP). O₂, CO₂ e glicose vêm do dicionário do PDB; íons aparecem como esferas do tamanho do íon hidratado. Moléculas pequenas e apolares (O₂, CO₂) atravessam a bicamada por difusão simples; íons e glicose dependem de canal ou carreador. Quantidades ilustrativas.',
    parts:{bilayer:{color:0xe3c08a,budget:{desktop:150000,touch:55000}},channel:{color:0xe0866a,budget:{desktop:45000,touch:18000}},carrier:{color:0x56b5a4,budget:{desktop:55000,touch:20000}},'extracellular-solute':{color:0xffffff,surface:{spacing:.8,smooth:.55,probe:.3},budget:{desktop:30000,touch:11000}},'concentration-gradient':{color:0xffffff,surface:{spacing:.8,smooth:.55,probe:.3},budget:{desktop:14000,touch:6000}},cytosol:{color:0xffffff,surface:{spacing:.8,smooth:.55,probe:.3},budget:{desktop:10000,touch:4000}}},
    async scene(sc){
      reseed(33);
      const k=await sc.structure('1BL8'),pk=i=>!/HOH|K/.test(k.comp[i]),fk=membraneFit(k,{pick:pk});sc.add(k,{pick:i=>pk(i)?'channel':null,place:membranePlacer(fk,{at:[-50,0,96]})});
      for(const y of[-16,-6,4,14,24])sc.ions('concentration-gradient','K',[[-50,y,96]],0x6a3fbf,1.9);
      const g=await sc.structure('4PYP'),pg=i=>!/HOH|BOG|NAG/.test(g.comp[i]),fg=membraneFit(g,{pick:pg});sc.add(g,{pick:i=>pg(i)?'carrier':null,place:membranePlacer(fg,{at:[50,0,94],spin:.4})});
      await bilayer(sc,{size:[240,200],heads:'bilayer',tails:'bilayer',cholFraction:.25,cholPart:'bilayer'});
      const o2=await sc.ligand('OXY'),co2=await sc.ligand('CO2'),glc=await sc.ligand('GLC'),out={min:[-115,32,-95],max:[115,85,95]},inn={min:[-115,-85,-95],max:[115,-32,95]};
      sc.molecules('extracellular-solute',glc,scatter(sc,14,out,11));sc.ions('extracellular-solute','K',scatter(sc,10,out,9),0x6a3fbf,2.9);sc.molecules('extracellular-solute',o2,scatter(sc,22,out,7));
      sc.molecules('concentration-gradient',o2,[[0,6,96],[-12,-4,99],[90,2,97]]);sc.molecules('concentration-gradient',co2,[[20,-8,98],[-95,4,97]]);
      sc.molecules('cytosol',glc,scatter(sc,3,inn,11));sc.molecules('cytosol',o2,scatter(sc,5,inn,7));sc.molecules('cytosol',co2,scatter(sc,14,inn,7));
    }},
  'osmosis-tonicity':{version:'r1',tilt:.38,frame:null,surface:{spacing:1.3,smooth:.6,probe:.8},
    notes:'À esquerda, na escala molecular: membrana com moléculas reais (POPC e colesterol do dicionário de componentes do PDB) e aquaporina-1 humana (PDB 1J4N, tetrâmero), o canal que deixa passar água; moléculas de água e solutos vêm do dicionário do PDB. À direita, em outra escala (cerca de 1:100 000 em relação às moléculas): hemácias com o contorno bicôncavo medido por Evans e Fung (1972) em meio isotônico, inchadas em meio hipotônico e crenadas em meio hipertônico. As formas das hemácias são modelos matemáticos, não micrografias.',
    parts:{'semipermeable-membrane':{color:0xe3c08a,budget:{desktop:150000,touch:55000}},'extracellular-water':{color:0xffffff,surface:{spacing:.7,smooth:.55,probe:.3},budget:{desktop:30000,touch:12000}},'intracellular-solute':{color:0xffffff,surface:{spacing:.8,smooth:.55,probe:.3},budget:{desktop:20000,touch:8000}},'hypotonic-cell':{color:0xc8463e,budget:{desktop:12000,touch:6000}},'isotonic-cell':{color:0xc8463e,budget:{desktop:12000,touch:6000}},'hypertonic-cell':{color:0xc8463e,budget:{desktop:16000,touch:8000}}},
    async scene(sc){
      reseed(44);
      const aqp=await sc.structure('1J4N',{assembly:1}),fa=membraneFit(aqp);sc.add(aqp,{pick:i=>/HOH|BNG|GOL/.test(aqp.comp[i])?null:'semipermeable-membrane',place:membranePlacer(fa,{at:[-20,0,82]})});
      await bilayer(sc,{size:[200,170],heads:'semipermeable-membrane',tails:'semipermeable-membrane',cholFraction:.25,cholPart:'semipermeable-membrane'});
      const w=await sc.ligand('HOH'),glc=await sc.ligand('GLC');
      sc.molecules('extracellular-water',w,scatter(sc,170,{min:[-100,30,-85],max:[100,80,85]},5.2));
      sc.molecules('extracellular-water',w,[-14,-7,0,7,14].map(y=>[-20,y,82]));
      sc.molecules('intracellular-solute',glc,scatter(sc,22,{min:[-100,-80,-85],max:[100,-30,85]},11));sc.ions('intracellular-solute','K',scatter(sc,18,{min:[-100,-80,-85],max:[100,-30,85]},9),0x6a3fbf,2.9);
      sc.mesh('hypotonic-cell',redCell('swollen',34,[175,40,-55]));sc.mesh('isotonic-cell',redCell('disc',34,[175,40,15]));sc.mesh('hypertonic-cell',redCell('crenated',34,[175,40,85]));
    }},
  'nucleic-acids':{version:'r1',frame:null,surface:{spacing:1.0,smooth:.55,probe:.4},
    notes:'DNA em dupla hélice B montado repetindo um passo real de par de bases da estrutura PDB 1BNA (dodecâmero de Dickerson, CC0), com 3,38 Å de subida e 36° de giro por par; a sequência alterna A·T e G·C para mostrar os dois pareamentos. O RNA é o RNA transportador de fenilalanina de levedura (PDB 1EHZ), uma cadeia única dobrada sobre si mesma. Cores das bases: A vermelho, T amarelo, G verde, C azul, U lilás. O nucleotídeo isolado vem do mesmo DNA, em cores por elemento (P laranja, O vermelho, N azul, C cinza).',
    parts:{'dna-double-helix':{color:0xb9c3cf,budget:{desktop:110000,touch:42000}},bases:{color:0xffffff,budget:{desktop:110000,touch:42000}},'complementary-bases':{color:0xffffff,budget:{desktop:9000,touch:4000}},'rna-strand':{color:0xc9b7e0,budget:{desktop:70000,touch:26000}},nucleotide:{color:0xffffff,budget:{desktop:6000,touch:3000}},'phosphodiester-bond':{color:0xf09a3a,budget:{desktop:3000,touch:1500}},directionality:{color:0x9fe0c8,budget:{desktop:4000,touch:2000}}},
    async scene(sc){
      await bdna(sc,{pairs:32,highlight:{index:22,part:'complementary-bases'}});
      // Phosphodiester linkage: the backbone atoms of strand 1 around one phosphate near the top of the helix.
      const ps=sc.atoms.filter(a=>a.part==='dna-double-helix'&&a.chain==='fita 1'&&a.element==='P').sort((a,b)=>b.p[1]-a.p[1]),hp=ps[6];
      if(hp)for(const a of sc.atoms)if(a.part==='dna-double-helix'&&a.chain==='fita 1'&&len(sub(a.p,hp.p))<3.2)a.part='phosphodiester-bond';
      // Isolated nucleotide (residue A5 of 1BNA) beside the helix, in element colours.
      const s=await sc.structure('1BNA'),nuc=[];for(let i=0;i<s.count;i++)if(s.chain[i]==='A'&&s.seq[i]===5)nuc.push(i);const nc=centroid(nuc.map(i=>[s.x[i],s.y[i],s.z[i]]));
      for(const i of nuc)sc.point('nucleotide',add(sub([s.x[i],s.y[i],s.z[i]],nc),[36,32,0]),s.element[i],CPK[s.element[i]]??null,'nucleotídeo');
      // 5′→3′ arrows beside each strand: rods of pseudo-atoms with a cone head.
      const arrow=(from,dir)=>{for(let t=0;t<=26;t+=1.6)sc.point('directionality',add(from,mul(dir,t)),'C',null,'seta');const tip=add(from,mul(dir,31));for(let r=0;r<=4.5;r+=1.1)for(let a=0;a<8;a++)sc.point('directionality',add(add(tip,mul(dir,-r*1.2)),rotateAxis([r,0,0],dir,a*Math.PI/4)),'C',null,'seta')};
      arrow([17,-30,0],[0,1,0]);arrow([-17,30,0],[0,-1,0]);
      // RNA: yeast tRNA-Phe beside the helix.
      const t=await sc.structure('1EHZ'),tc=centroid(Array.from({length:t.count},(_,i)=>[t.x[i],t.y[i],t.z[i]]));
      sc.add(t,{pick:i=>/HOH|MG/.test(t.comp[i])?null:'rna-strand',place:p=>add(sub(p,tc),[-64,-6,0]),color:i=>BACKBONE.has(t.name[i])?null:BASE_COLOR[t.comp[i]]||null,chain:()=>'RNA'});
    }},
};

Object.assign(RECIPES,ENERGY,INFO,CYTO,CHEM,MORE,CELLS);

function hash(s){let h=2166136261;for(const ch of String(s))h=Math.imul(h^ch.charCodeAt(0),16777619);return((h>>>0)%1000)/1000}
const rgb=c=>[(c>>16)&255,(c>>8)&255,c&255];

export async function build(id){
  const recipe=RECIPES[id];if(!recipe)throw new Error('Receita inexistente: '+id);console.log(id);
  const sc=createScene();await recipe.scene(sc);
  // Presentation tilt (around x): membranes lean towards the viewer so the front view also shows their outer face.
  if(recipe.tilt){const t=recipe.tilt,turn=p=>rotateAxis(p,[1,0,0],t);for(const at of sc.atoms)at.p=turn(at.p);for(const m of sc.meshes){const P=m.mesh.positions;for(let i=0;i<P.length;i+=3){const q=turn([P[i],P[i+1],P[i+2]]);P[i]=q[0];P[i+1]=q[1];P[i+2]=q[2]}}for(const c of sc.copies)c.shifts=c.shifts.map(turn)}
  const byPart=new Map();for(const a of sc.atoms){if(!byPart.has(a.part))byPart.set(a.part,[]);byPart.get(a.part).push(a)}
  const toAtoms=list=>({x:Float32Array.from(list,a=>a.p[0]),y:Float32Array.from(list,a=>a.p[1]),z:Float32Array.from(list,a=>a.p[2]),element:list.map(a=>a.element),chain:list.map(a=>a.chain),radius:list.some(a=>a.radius)?Float32Array.from(list,a=>a.radius||0):null,count:list.length});
  // Grid steps grow with the scene so a field never exceeds ~30 million cells (cilia and viruses span micrometres).
  const fitSpacing=(list,step,cells=3e7)=>{const b=[[1e9,-1e9],[1e9,-1e9],[1e9,-1e9]];for(const a of list)for(let k=0;k<3;k++){b[k][0]=Math.min(b[k][0],a.p[k]);b[k][1]=Math.max(b[k][1],a.p[k])}const v=b.reduce((n,[lo,hi])=>n*(hi-lo+30),1);return Math.max(step,Math.cbrt(v/cells))};
  const ao=densityField(toAtoms(sc.atoms),{spacing:fitSpacing(sc.atoms,3,2e7),smooth:.7,probe:1.4,pad:14});
  const surfaces=new Map();
  for(const [part,list] of byPart){if(!recipe.parts[part]){console.warn('  parte sem definição: '+part);continue}const t=Date.now(),s=toAtoms(list),opts={...(recipe.parts[part].surface||recipe.surface)};opts.spacing=fitSpacing(list,opts.spacing);const mesh=weld(isoSurface(densityField(s,opts)),1e-4);surfaces.set(part,{mesh,list,s});console.log('  '+part+': '+list.length.toLocaleString()+' átomos → '+triangles(mesh).toLocaleString()+' triângulos ('+(Date.now()-t)+' ms)')}
  const outputs=[];
  for(const profile of['desktop','touch']){
    const parts=[],reduced=new Map();
    for(const [part,{mesh,list,s}] of surfaces){const spec=recipe.parts[part],r=simplify(mesh,spec.budget[profile]),n=normals(r),owner=vertexGroups(r,s,i=>i),colors=new Uint8Array(r.positions.length);
      for(let v=0;v<owner.length;v++){const a=owner[v]==null?null:list[owner[v]],p=[r.positions[v*3],r.positions[v*3+1],r.positions[v*3+2]],q=d=>ao.sample(p[0]+n[v*3]*d,p[1]+n[v*3+1]*d,p[2]+n[v*3+2]*d),occ=Math.min(.6,(q(3)+q(6)+q(10))/3*.55);
        const base=rgb(a?.color??spec.color),tone=a?.color!=null?1:.9+.2*hash(a?.chain);for(let k=0;k<3;k++)colors[v*3+k]=Math.max(0,Math.min(255,Math.round(base[k]*tone*(1-occ))))}
      reduced.set(part,r);parts.push({id:part,meshes:[{name:'surface',mesh:r,color:0xffffff,roughness:spec.roughness??.62,colors}]})}
    for(const m of sc.meshes){const spec=recipe.parts[m.part];parts.push({id:m.part,meshes:[{name:'surface',mesh:simplify(m.mesh,spec.budget[profile]),color:m.color??spec.color,roughness:spec.roughness??.6,opacity:m.opacity??1}]})}
    for(const c of sc.copies){const spec=recipe.parts[c.part],meshes=[];for(const from of c.from){const src=reduced.get(from);if(!src)continue;const r=simplify(src,Math.round(spec.budget[profile]/c.from.length/c.shifts.length));
        for(const shift of c.shifts){const pos=new Float32Array(r.positions.length);for(let i=0;i<pos.length;i+=3)for(let k=0;k<3;k++)pos[i+k]=r.positions[i+k]+shift[k];meshes.push({positions:pos,index:r.index})}}
      let off=0;const index=[];for(const m of meshes){for(const v of m.index)index.push(v+off);off+=m.positions.length/3}
      parts.push({id:c.part,meshes:[{name:'surface',mesh:{positions:Float32Array.from(meshes.flatMap(m=>[...m.positions])),index:Uint32Array.from(index)},color:spec.color,roughness:.7}]})}
    const file=path.join(ROOT,'assets/cytology/real',id+'-'+profile+'-'+recipe.version+'.bin');
    const info=writePack(file,{id,profile,units:'Å',parts,credits:[pdbCredit([...sc.codes])],notes:recipe.notes,frame:recipe.frame});
    console.log('  → '+path.relative(ROOT,file).replace(/\\/g,'/')+': '+(info.bytes/1048576).toFixed(2)+' MB, '+info.triangles.toLocaleString()+' triângulos, sha256 '+info.sha256);outputs.push(info);
  }
  return outputs;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const ids=process.argv.slice(2);if(!ids.length){console.log('Receitas: '+Object.keys(RECIPES).join(', '));process.exit(0)}
  for(const id of ids)await build(id);
}
