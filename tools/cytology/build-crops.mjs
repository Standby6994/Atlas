// Builds organelle packs from the hand-annotated ground-truth crops of OpenOrganelle / COSEM (HHMI Janelia, CC BY 4.0):
// small blocks of a cell (1–3 µm) where every organelle and its sub-compartments (outer and inner mitochondrial
// membrane, nuclear pores, nucleolus, heterochromatin…) were traced by people, at 4 nm.
//   node tools/cytology/build-crops.mjs mitochondrion nucleus-chromatin …
// Recipe parts read one class of the crop (legacy mesh), keep what lies around the focus organelle, may split a class by
// depth below the organelle's outline, cut the block with a plane (to open it), and are simplified to a budget.
import {list,legacy} from './cosem.mjs';
import {weld,merge,simplify,compact,bounds,triangles} from './mesh.mjs';
import {writePack} from './pack.mjs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const credit=(dataset,crop)=>({title:'OpenOrganelle — '+dataset+', recorte anotado '+crop,author:'HHMI Janelia Research Campus (COSEM Project Team)',license:'CC BY 4.0',url:'https://openorganelle.janelia.org/datasets/'+dataset,
  citation:'Heinrich L. et al. Whole-cell organelle segmentation in volume electron microscopy. Nature 599, 141–146 (2021); Xu C.S. et al. An open-access volume electron microscopy atlas of whole cells and tissues. Nature 599, 147–151 (2021).',changes:'Malhas de anotação manual reduzidas (simplificação por erro quádrico), abertas por um plano de corte e coloridas por compartimento.'});
const base=(d,c)=>d+'/neuroglancer/mesh/groundtruth/'+c+'/';

// ---- geometry helpers ----
const centroidOf=(m,t)=>{const a=m.index[t]*3,b=m.index[t+1]*3,c=m.index[t+2]*3;return[0,1,2].map(k=>(m.positions[a+k]+m.positions[b+k]+m.positions[c+k])/3)};
function filterTriangles(m,keep){const idx=[];for(let t=0;t<m.index.length;t+=3)if(keep(centroidOf(m,t)))idx.push(m.index[t],m.index[t+1],m.index[t+2]);return compact(m.positions,idx)}
function nearTest(points,radius){const grid=new Map(),k=(i,j,l)=>i+','+j+','+l;for(const p of points){const key=k(...p.map(v=>Math.floor(v/radius)));let l=grid.get(key);if(!l)grid.set(key,l=[]);l.push(p)}
  const r2=radius*radius;return p=>{const c=p.map(v=>Math.floor(v/radius));for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let l=-1;l<=1;l++){const list=grid.get(k(c[0]+i,c[1]+j,c[2]+l));if(list)for(const q of list)if((q[0]-p[0])**2+(q[1]-p[1])**2+(q[2]-p[2])**2<r2)return true}return false}}
const verts=(m,step=1)=>{const out=[];for(let i=0;i<m.positions.length/3;i+=step)out.push([m.positions[i*3],m.positions[i*3+1],m.positions[i*3+2]]);return out};
function pca(m){const pts=verts(m,Math.max(1,Math.floor(m.positions.length/3/20000))),c=[0,1,2].map(k=>pts.reduce((s,p)=>s+p[k],0)/pts.length),C=[0,0,0,0,0,0,0,0,0];for(const p of pts){const d=[p[0]-c[0],p[1]-c[1],p[2]-c[2]];for(let i=0;i<3;i++)for(let j=0;j<3;j++)C[i*3+j]+=d[i]*d[j]}
  const mulv=(M,v)=>[M[0]*v[0]+M[1]*v[1]+M[2]*v[2],M[3]*v[0]+M[4]*v[1]+M[5]*v[2],M[6]*v[0]+M[7]*v[1]+M[8]*v[2]],nrm=v=>{const l=Math.hypot(...v)||1;return v.map(x=>x/l)},dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  let a=[1,.2,.1];for(let i=0;i<80;i++)a=nrm(mulv(C,a));const lam=dot(a,mulv(C,a)),C2=C.map((v,i)=>v-lam*a[Math.floor(i/3)]*a[i%3]);let b=nrm([.1,1,.3]);for(let i=0;i<80;i++){b=nrm(mulv(C2,b));const d=dot(b,a);b=nrm(b.map((x,k)=>x-d*a[k]))}
  const s=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];return{center:c,long:a,mid:b,short:s}}
/** Rotation that takes the frame (long, mid, short) onto (x, y, z), applied around `center`. */
function framer({center,long,mid,short}){return p=>{const d=[p[0]-center[0],p[1]-center[1],p[2]-center[2]];return[d[0]*long[0]+d[1]*long[1]+d[2]*long[2],d[0]*mid[0]+d[1]*mid[1]+d[2]*mid[2],d[0]*short[0]+d[1]*short[1]+d[2]*short[2]]}}
function transform(m,f){const P=new Float32Array(m.positions.length);for(let i=0;i<P.length;i+=3){const q=f([m.positions[i],m.positions[i+1],m.positions[i+2]]);P[i]=q[0];P[i+1]=q[1];P[i+2]=q[2]}return{positions:P,index:m.index}}
/** Moves each vertex along its (area-weighted) normal by `d` (negative = inwards) — a shrunken copy for a lumen fill. */
function offset(m,d){const N=new Float32Array(m.positions.length),P=m.positions,I=m.index;for(let t=0;t<I.length;t+=3){const a=I[t]*3,b=I[t+1]*3,c=I[t+2]*3,u=[P[b]-P[a],P[b+1]-P[a+1],P[b+2]-P[a+2]],v=[P[c]-P[a],P[c+1]-P[a+1],P[c+2]-P[a+2]],n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];for(const x of[a,b,c])for(let k=0;k<3;k++)N[x+k]+=n[k]}
  const out=new Float32Array(P.length);for(let i=0;i<P.length;i+=3){const l=Math.hypot(N[i],N[i+1],N[i+2])||1;for(let k=0;k<3;k++)out[i+k]=P[i+k]+N[i+k]/l*d}return{positions:out,index:I}}

async function readClass(dataset,crop,cls,{ids=null}={}){
  const b=base(dataset,crop)+cls;let segs=ids;if(!segs)segs=(await list(b+'/')).filter(f=>/^\d+:0$/.test(f)).map(f=>f.slice(0,-2));
  const meshes=[];for(const id of segs){try{const m=await legacy(b,id);if(m.index.length)meshes.push(weld(m,.5))}catch(e){console.warn('  '+cls+'/'+id+': '+e.message)}}
  const m=merge(meshes);console.log('  '+crop+'/'+cls+': '+segs.length+' segmento(s), '+triangles(m).toLocaleString()+' triângulos');return m;
}

const C={membrane:0xe9b07a,inner:0xd8653d,cristae:0xc4492f,matrix:0xf3c9a6,ribo:0x8fd3f0,dna:0x6a5acd,ne:0x8d84d6,pore:0xf1d27a,nucleolus:0x4b2f86,echrom:0xb59ad8,hchrom:0x5a3f9e,loop:0xe0a050,er:0xe8b83a,ser:0x8fcc4a,eres:0x9fd8ff,golgiCis:0x2fb5a8,golgiMid:0x2c9f8c,golgiTrans:0x237f78,ves:0xf2e38a,endo:0xd04a9c,lyso:0xa8326e,ld:0xf5d77a,pm:0xc9d6e3};

export const RECIPES={
  mitochondrion:{version:'r1',dataset:'jrc_hela-2',crop:'crop3',focus:{cls:'mito',ids:['1']},
    notes:'Mitocôndria real de uma célula HeLa, imageada por microscopia eletrônica FIB-SEM com voxels de 4 nm e traçada à mão, membrana por membrana (recorte anotado do OpenOrganelle, HHMI Janelia, CC BY 4.0). Aberta ao meio por um plano ao longo do comprimento para mostrar as cristas reais. A membrana interna e as cristas são a mesma membrana: aqui a parte junto ao contorno aparece como membrana interna e as dobras que entram na matriz como cristas. A matriz aparece como preenchimento translúcido. O espaço intermembranas é a fresta entre as duas membranas, visível na borda do corte. O DNA mitocondrial não foi segmentado na fonte e aparece como nucleoides ilustrativos.',
    parts:[
      {part:'outer-membrane',cls:'mito',ids:['1'],color:C.membrane,budget:{desktop:60000,touch:24000}},
      {part:'inner-membrane',cls:'mito_lum',depth:{max:45},color:C.inner,budget:{desktop:70000,touch:26000}},
      {part:'cristae',cls:'mito_lum',depth:{min:45},color:C.cristae,budget:{desktop:150000,touch:56000}},
      {part:'matrix',cls:'mito_lum',fill:-8,color:C.matrix,opacity:.22,budget:{desktop:40000,touch:16000}},
      {part:'mitoribosomes',cls:'mito_ribo',color:C.ribo,budget:{desktop:20000,touch:8000}},
    ],
    nucleoids:{part:'mitochondrial-dna',count:3,color:C.dna}},
  'nucleus-chromatin':{version:'r1',dataset:'jrc_hela-2',crop:'crop16',
    notes:'Bloco da periferia do núcleo de uma célula HeLa, imageado por microscopia eletrônica FIB-SEM (voxels de 4 nm) e traçado à mão (recorte anotado do OpenOrganelle, HHMI Janelia, CC BY 4.0): envelope nuclear com suas duas membranas, poros nucleares, nucléolo, eucromatina e heterocromatina (a mais compacta, junto ao envelope e ao nucléolo). Aberto por um plano para mostrar o interior. A alça de cromatina é ilustrativa: uma fibra de nucleossomos (contas de 11 nm) desenhada sobre a eucromatina.',
    parts:[
      {part:'nuclear-envelope',cls:'ne_mem',color:C.ne,budget:{desktop:90000,touch:34000}},
      {part:'nuclear-pore',cls:'np',color:C.pore,budget:{desktop:30000,touch:12000}},
      {part:'nucleolus',cls:'nucleo',color:C.nucleolus,budget:{desktop:110000,touch:40000}},
      {part:'euchromatin',cls:'echrom',color:C.echrom,opacity:.85,budget:{desktop:40000,touch:15000}},
      {part:'heterochromatin',cls:'hchrom',color:C.hchrom,budget:{desktop:140000,touch:52000}},
    ],cut:{axis:'short',keep:-1},
    loop:{part:'chromatin-loop',color:C.loop}},
  golgi:{version:'r1',dataset:'jrc_hela-2',crop:'crop4',focus:{cls:'golgi_mem'},stack:{toward:'ne_mem'},swapYZ:true,
    notes:'Complexo de Golgi real de uma célula HeLa, imageado por microscopia eletrônica FIB-SEM (voxels de 4 nm) e traçado à mão (recorte anotado do OpenOrganelle, HHMI Janelia, CC BY 4.0), com as vesículas e endossomos ao redor. A pilha foi dividida em quatro faixas ao longo da sua espessura — face cis (voltada para o núcleo e o retículo), cisternas, cisternas mediais e face trans —, uma divisão didática por posição, não por marcadores moleculares. Aberto por um plano para mostrar as cisternas.',
    parts:[
      {part:'cis-face',cls:'golgi_mem',band:[0,.25],color:C.golgiCis,budget:{desktop:50000,touch:19000}},
      {part:'cisternae',cls:'golgi_mem',band:[.25,.5],color:0x29a998,budget:{desktop:50000,touch:19000}},
      {part:'medial-cisternae',cls:'golgi_mem',band:[.5,.75],color:C.golgiMid,budget:{desktop:50000,touch:19000}},
      {part:'trans-face',cls:'golgi_mem',band:[.75,1],color:C.golgiTrans,budget:{desktop:50000,touch:19000}},
      {part:'transport-vesicle',cls:'ves_mem',near:{cls:'golgi_mem',within:500},color:C.ves,budget:{desktop:40000,touch:15000}},
      {part:'sorting-cargo',cls:'endo_mem',near:{cls:'golgi_mem',within:700},color:C.endo,budget:{desktop:40000,touch:15000}},
    ]},
  'rough-er':{version:'r1',dataset:'jrc_hela-2',crop:'crop4',focus:{cls:'er_mem'},
    notes:'Retículo endoplasmático real de uma célula HeLa (cisternas achatadas e túbulos), contínuo com o envelope nuclear, imageado por microscopia eletrônica FIB-SEM (voxels de 4 nm) e traçado à mão (recorte anotado do OpenOrganelle, HHMI Janelia, CC BY 4.0). Os ribossomos não foram segmentados na fonte: aparecem como grânulos de 25 nm distribuídos sobre a face citosólica das cisternas, com densidade ilustrativa. O lúmen aparece translúcido por dentro da membrana. Aberto por um plano.',
    parts:[
      {part:'membrane-cisternae',cls:'er_mem',color:C.er,budget:{desktop:180000,touch:66000}},
      {part:'lumen',cls:'er_lum',fill:-4,color:0xf6dfa0,opacity:.3,budget:{desktop:50000,touch:18000}},
      {part:'nuclear-connection',cls:'ne_mem',color:C.ne,budget:{desktop:60000,touch:22000}},
      {part:'transport-vesicle',cls:'ves_mem',near:{cls:'er_mem',within:300},color:C.ves,budget:{desktop:30000,touch:11000}},
    ],
    beads:{part:'ribosomes',on:'er_mem',spacing:55,radius:12.5,lift:16,max:2600,color:0x6f8fc4}},
  'smooth-er':{version:'r1',dataset:'jrc_hela-2',crop:'crop19',
    notes:'Retículo endoplasmático tubular, sem ribossomos, ao lado de uma gota de lipídio, numa célula HeLa imageada por microscopia eletrônica FIB-SEM (voxels de 4 nm) e traçada à mão (recorte anotado do OpenOrganelle, HHMI Janelia, CC BY 4.0). A gota de lipídio representa a síntese e a reserva de lipídios; o lúmen tubular, a reserva de cálcio. Desintoxicação e o metabolismo hepático de glicose são funções de enzimas da membrana, sem estrutura própria visível nesta escala.',
    parts:[
      {part:'tubular-membrane',cls:'er_mem',color:C.ser,budget:{desktop:80000,touch:30000}},
      {part:'calcium-store',cls:'er_lum',fill:-3,color:0xbfe8a8,opacity:.35,budget:{desktop:30000,touch:12000}},
      {part:'lipid-synthesis',cls:'ld_mem',color:C.ld,budget:{desktop:30000,touch:12000}},
    ],cut:{keep:-1}},
  'lysosome-autophagy':{version:'r1',dataset:'jrc_hela-2',crop:'crop4',focus:{cls:'lyso_mem'},
    notes:'Lisossomos reais de uma célula HeLa, imageados por microscopia eletrônica FIB-SEM (voxels de 4 nm) e traçados à mão (recorte anotado do OpenOrganelle, HHMI Janelia, CC BY 4.0), com os endossomos vizinhos. A membrana lisossômica é a segmentação da fonte; o lúmen ácido aparece translúcido por dentro. Autofagossomos e hidrolases não foram segmentados na fonte; os endossomos tardios próximos representam o tráfego que leva material até o lisossomo.',
    parts:[
      {part:'lysosomal-membrane',cls:'lyso_mem',color:C.lyso,budget:{desktop:60000,touch:22000}},
      {part:'acid-lumen',cls:'lyso_lum',fill:-3,color:0xf2a0c8,opacity:.4,budget:{desktop:30000,touch:12000}},
      {part:'autophagosome',cls:'endo_mem',near:{cls:'lyso_mem',within:600},color:C.endo,budget:{desktop:50000,touch:19000}},
    ]},
};

export async function build(id){
  const r=RECIPES[id];if(!r)throw new Error('Receita inexistente: '+id);console.log(id+' ← '+r.dataset+' '+r.crop);
  const raw=new Map();for(const p of r.parts){const key=p.cls+'|'+(p.ids||'all');if(!raw.has(key))raw.set(key,await readClass(r.dataset,r.crop,p.cls,{ids:p.ids}))}
  const focus=r.focus?await readClass(r.dataset,r.crop,r.focus.cls,{ids:r.focus.ids}):merge([...raw.values()]),frame=pca(focus),f0=framer(frame),f=r.swapYZ?(p=>{const q=f0(p);return[q[0],q[2],-q[1]]}):f0;
  const fb=bounds(focus.positions),pad=60,inFocus=p=>p.every((v,k)=>v>=fb.min[k]-pad&&v<=fb.max[k]+pad);
  const outline=r.focus?nearTest(verts(focus,1),1):null;void outline;
  const parts=new Map(),add=(part,mesh)=>{if(!parts.has(part))parts.set(part,[]);parts.get(part).push(mesh)};
  const done=new Map();
  for(const p of r.parts){
    let m=raw.get(p.cls+'|'+(p.ids||'all'));if(r.focus)m=filterTriangles(m,inFocus);
    if(p.depth){const shallow=nearTest(verts(focus,2),p.depth.max||p.depth.min);m=filterTriangles(m,q=>p.depth.max?shallow(q):!shallow(q))}
    if(p.near){const ref=raw.get(p.near.cls+'|all')||await readClass(r.dataset,r.crop,p.near.cls);raw.set(p.near.cls+'|all',ref);const near=nearTest(verts(ref,3),p.near.within);m=filterTriangles(m,near)}
    if(p.band){// Position across the stack (short axis of the focus), from the side facing `stack.toward`.
      let ax=frame.short;if(r.stack?.toward){const t=raw.get(r.stack.toward+'|all')||await readClass(r.dataset,r.crop,r.stack.toward);raw.set(r.stack.toward+'|all',t);const tc=bounds(t.positions),c=tc.min.map((v,k)=>(v+tc.max[k])/2);if((c[0]-frame.center[0])*ax[0]+(c[1]-frame.center[1])*ax[1]+(c[2]-frame.center[2])*ax[2]>0)ax=ax.map(v=>-v)}
      const proj=q=>(q[0]-frame.center[0])*ax[0]+(q[1]-frame.center[1])*ax[1]+(q[2]-frame.center[2])*ax[2],all=verts(focus,3).map(proj),lo=all.reduce((a,b)=>Math.min(a,b),Infinity),hi=all.reduce((a,b)=>Math.max(a,b),-Infinity);
      m=filterTriangles(m,q=>{const t=(proj(q)-lo)/(hi-lo||1);return t>=p.band[0]&&t<p.band[1]})}
    if(p.fill)m=offset(m,p.fill);
    m=transform(m,f);
    // Opening cut: along the length, the half towards the viewer (+z after the frame turn) is removed.
    const cut=r.cut||{axis:'short',keep:-1};m=filterTriangles(m,q=>q[2]*(cut.keep||-1)>=-1e-6?true:false);
    done.set(p,m);console.log('  '+p.part+': '+triangles(m).toLocaleString()+' triângulos após recorte e corte');
  }
  const extras=[];
  // Granules on a membrane (ribosomes on the rough ER): every ~spacing nm of surface, lifted to its cytosolic side.
  if(r.beads){const src=done.get(r.parts.find(p=>p.cls===r.beads.on)),P=src.positions,I=src.index,list=[];let acc=0;const area=r.beads.spacing**2;
    for(let t=0;t<I.length&&list.length<r.beads.max;t+=3){const a=I[t]*3,b=I[t+1]*3,c=I[t+2]*3,u=[P[b]-P[a],P[b+1]-P[a+1],P[b+2]-P[a+2]],v=[P[c]-P[a],P[c+1]-P[a+1],P[c+2]-P[a+2]],n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],ar=Math.hypot(...n)/2;acc+=ar;
      if(acc>=area){acc-=area;const l=Math.hypot(...n)||1,ctr=[0,1,2].map(k=>(P[a+k]+P[b+k]+P[c+k])/3);list.push(sphere(ctr.map((x,k)=>x+n[k]/l*r.beads.lift),r.beads.radius,3))}}
    extras.push({part:r.beads.part,color:r.beads.color,mesh:merge(list)});console.log('  '+r.beads.part+': '+list.length+' grânulos')}
  if(r.nucleoids){const lum=done.get(r.parts.find(p=>p.part==='matrix')),b=bounds(lum.positions);for(let k=0;k<r.nucleoids.count;k++){const c=[b.min[0]+(b.max[0]-b.min[0])*(.25+.25*k),(b.min[1]+b.max[1])/2+(k-1)*30,-25];extras.push({part:r.nucleoids.part,color:r.nucleoids.color,mesh:knot(c,38,6.5)})}}
  if(r.loop){const eu=done.get(r.parts.find(p=>p.part==='euchromatin')),b=bounds(eu.positions);const c=[(b.min[0]+b.max[0])/2,(b.min[1]+b.max[1])/2,-60];extras.push({part:r.loop.part,color:r.loop.color,mesh:beadLoop(c,300,5.5)})}
  const outputs=[];
  for(const profile of['desktop','touch']){
    const packParts=[];
    for(const p of r.parts){const s=simplify(done.get(p),p.budget[profile]);packParts.push({id:p.part,meshes:[{name:'surface',mesh:s,color:p.color,roughness:p.roughness??.55,opacity:p.opacity??1}]})}
    for(const e of extras)packParts.push({id:e.part,meshes:[{name:'surface',mesh:e.mesh,color:e.color,roughness:.5}]});
    const file=path.join(ROOT,'assets/cytology/real',id+'-'+profile+'-'+r.version+'.bin');
    const info=writePack(file,{id,profile,units:'nm',parts:packParts,credits:[credit(r.dataset,r.crop)],notes:r.notes});
    console.log('  → '+path.relative(ROOT,file).replace(/\\/g,'/')+': '+(info.bytes/1048576).toFixed(2)+' MB, '+info.triangles.toLocaleString()+' triângulos, sha256 '+info.sha256);outputs.push(info);
  }
  return outputs;
}

// ---- illustrative strands drawn as tubes of spheres (nucleoids, chromatin loops) ----
function sphere(c,r,seg=8){const pos=[],idx=[];for(let i=0;i<=seg;i++)for(let j=0;j<=seg*2;j++){const th=i/seg*Math.PI,ph=j/(seg*2)*Math.PI*2;pos.push(c[0]+r*Math.sin(th)*Math.cos(ph),c[1]+r*Math.cos(th),c[2]+r*Math.sin(th)*Math.sin(ph))}for(let i=0;i<seg;i++)for(let j=0;j<seg*2;j++){const a=i*(seg*2+1)+j,b=a+seg*2+1;idx.push(a,b,a+1,a+1,b,b+1)}return weld({positions:Float32Array.from(pos),index:Uint32Array.from(idx)},1e-3)}
function knot(c,R,r){const spheres=[];for(let k=0;k<70;k++){const t=k/70*Math.PI*2,p=[Math.sin(t)+2*Math.sin(2*t),Math.cos(t)-2*Math.cos(2*t),-Math.sin(3*t)];spheres.push(sphere([c[0]+p[0]*R/3,c[1]+p[1]*R/3,c[2]+p[2]*R/3],r,5))}return merge(spheres)}
function beadLoop(c,L,r){const beads=[];for(let k=0;k<60;k++){const t=k/59*Math.PI*1.6,p=[Math.sin(t)*L*.4,(1-Math.cos(t))*L*.35-L*.2,Math.sin(t*3)*25];beads.push(sphere([c[0]+p[0],c[1]+p[1],c[2]+p[2]],r,5))}return merge(beads)}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const ids=process.argv.slice(2);if(!ids.length){console.log('Receitas: '+Object.keys(RECIPES).join(', '));process.exit(0)}
  for(const id of ids)await build(id);
}
