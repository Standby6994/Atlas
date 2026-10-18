// Builds cytology packs from OpenOrganelle / COSEM segmentations (HHMI Janelia, CC BY 4.0).
//   node tools/cytology/build-cosem.mjs animal-cell [more ids]   writes assets/cytology/real/<id>-{desktop,touch}-<version>.bin
// Each recipe picks a dataset, the mesh layers that become each part of the content view, the level of detail to read
// and a triangle budget per profile (quadric simplification). Prints the SHA-256 for CONTENT_SHA256 in service-worker.js.
import {list,layer,segment,legacy} from './cosem.mjs';
import {weld,merge,simplify,compact,bounds,triangles} from './mesh.mjs';
import {writePack} from './pack.mjs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const COLORS={membrane:0xc9d6e3,nucleus:0x6f5fc4,mito:0xe0552f,er:0xe8b83a,ser:0x8fcc4a,golgi:0x22b4a0,endo:0xd04a9c,vesicle:0xf2e38a,mt:0xe6eef6,chromatin:0x4f3f86,pore:0xf1d27a,nucleolus:0x3c2a68,lumen:0xb24a32,ribo:0x8fd3f0};
const credit=(dataset,extra='')=>({title:'OpenOrganelle — '+dataset,author:'HHMI Janelia Research Campus (COSEM Project Team)',license:'CC BY 4.0',url:'https://openorganelle.janelia.org/datasets/'+dataset,
  citation:'Heinrich L. et al. Whole-cell organelle segmentation in volume electron microscopy. Nature 599, 141–146 (2021); Xu C.S. et al. An open-access volume electron microscopy atlas of whole cells and tissues. Nature 599, 147–151 (2021).',changes:'Malhas reduzidas (simplificação por erro quádrico), recortadas para o corte didático e coloridas por compartimento.'+extra});

export const RECIPES={
  'animal-cell':{version:'r1',dataset:'jrc_hela-2',present:{rotateX:-1.05},
    notes:'Célula HeLa real (linhagem humana de câncer de colo do útero, em cultura), imageada por microscopia eletrônica FIB-SEM com voxels de 4 nm e segmentada por aprendizado de máquina (OpenOrganelle, HHMI Janelia, CC BY 4.0). A membrana plasmática aparece translúcida para mostrar o interior; a célula, aderida a uma lâmina, é achatada (cerca de 48 × 33 µm de largura e 6 µm de altura); o envelope nuclear, que a fonte segmenta junto com o retículo, foi retirado do retículo; malhas reduzidas para o aparelho. Retículo rugoso e liso não vêm separados na fonte: aqui, o retículo junto ao núcleo aparece como rugoso e o periférico como liso, uma aproximação didática. Lisossomos e endossomos foram segmentados juntos; aparecem os ~900 maiores, e das ~40 mil vesículas, as 2 500 maiores. Ribossomos livres e citosol não têm malha própria nesta escala (ribossomos medem ~25 nm).',
    focus:{layer:'nucleus_seg',id:1},
    parts:[
      {part:'plasma-membrane',layer:'pm_seg',ids:[2],lod:4,color:COLORS.membrane,opacity:.3,roughness:.4,budget:{desktop:160000,touch:60000}},
      {part:'nucleus',layer:'nucleus_seg',ids:[1],lod:3,color:COLORS.nucleus,roughness:.55,budget:{desktop:90000,touch:35000}},
      {part:'mitochondria',layer:'mito_seg',ids:'inside',lod:3,color:COLORS.mito,roughness:.5,budget:{desktop:260000,touch:95000}},
      {part:'rough-er',layer:'er_seg',ids:'inside',lod:4,skipNearFocus:260,nearFocus:3500,otherPart:'smooth-er',color:COLORS.er,otherColor:COLORS.ser,roughness:.6,opacity:.6,budget:{desktop:220000,touch:80000}},
      {part:'golgi',layer:'golgi_seg',ids:'inside',lod:2,color:COLORS.golgi,roughness:.5,budget:{desktop:70000,touch:28000}},
      {part:'lysosome',layer:'endo_seg',ids:'inside',keep:900,lod:3,color:COLORS.endo,roughness:.5,budget:{desktop:80000,touch:30000}},
      {part:'vesicles',layer:'vesicle_seg',ids:'inside',keep:2500,lod:3,color:COLORS.vesicle,roughness:.5,budget:{desktop:50000,touch:18000}},
      {part:'cytoskeleton',layer:'mt-out_seg',ids:'inside',lod:2,color:COLORS.mt,roughness:.4,budget:{desktop:90000,touch:32000}},
    ]},
};

async function pool(items,n,fn){const out=new Array(items.length);let next=0;await Promise.all(Array.from({length:Math.min(n,items.length)},async()=>{while(next<items.length){const i=next++;out[i]=await fn(items[i],i)}}));return out}
const centroidOf=(m,t)=>{const a=m.index[t]*3,b=m.index[t+1]*3,c=m.index[t+2]*3;return[0,1,2].map(k=>(m.positions[a+k]+m.positions[b+k]+m.positions[c+k])/3)};
function filterTriangles(m,keep){const idx=[];for(let t=0;t<m.index.length;t+=3)if(keep(centroidOf(m,t)))idx.push(m.index[t],m.index[t+1],m.index[t+2]);return compact(m.positions,idx)}
const inBox=(p,b,pad=0)=>p.every((v,k)=>v>=b.min[k]-pad&&v<=b.max[k]+pad);

async function readLayer(dataset,spec,region){
  const base=dataset+'/neuroglancer/mesh/'+spec.layer,L=await layer(base);
  let ids=spec.ids;if(ids==='inside'||!Array.isArray(ids))ids=(await list(base+'/')).filter(f=>f.endsWith('.index')).map(f=>f.replace('.index',''));
  const meshes=(await pool(ids,12,async id=>{try{const s=await segment(L,id,spec.lod);if(!s?.index.length)return null;const w=weld(s,.5);
    if(spec.ids==='inside'&&region){const b=bounds(w.positions),c=b.min.map((v,k)=>(v+b.max[k])/2);if(!inBox(c,region))return null}return w}catch(error){console.warn('  segmento',id,error.message);return null}})).filter(Boolean);
  // keep: only the N largest segments (by triangles at this level, a proxy for size).
  const kept=spec.keep?meshes.sort((a,b)=>triangles(b)-triangles(a)).slice(0,spec.keep):meshes;
  console.log('  '+spec.layer+': '+kept.length+' de '+meshes.length+' segmentos, '+kept.reduce((n,m)=>n+triangles(m),0).toLocaleString()+' triângulos (lod '+spec.lod+')');
  return kept;
}

/** Fast "within radius of any of these points" test (uniform grid of cell = radius). */
function nearTest(points,radius){const grid=new Map(),k=(i,j,l)=>i+','+j+','+l;for(const p of points){const key=k(...p.map(v=>Math.floor(v/radius)));let l=grid.get(key);if(!l)grid.set(key,l=[]);l.push(p)}
  const r2=radius*radius;return p=>{const c=p.map(v=>Math.floor(v/radius));for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let l=-1;l<=1;l++){const list=grid.get(k(c[0]+i,c[1]+j,c[2]+l));if(list)for(const q of list)if((q[0]-p[0])**2+(q[1]-p[1])**2+(q[2]-p[2])**2<r2)return true}return false}}
const vertices=(m,step=1)=>{const out=[];for(let i=0;i<m.positions.length/3;i+=step)out.push([m.positions[i*3],m.positions[i*3+1],m.positions[i*3+2]]);return out};

export async function build(id){
  const recipe=RECIPES[id];if(!recipe)throw new Error('Receita inexistente: '+id);
  console.log(id+' ← '+recipe.dataset);
  const segs=new Map();for(const spec of recipe.parts)segs.set(spec,await readLayer(recipe.dataset,spec,null));
  const focus=merge(segs.get(recipe.parts.find(s=>s.layer===recipe.focus.layer))),focusBox=bounds(focus.positions);
  // Cell footprint (x,z): where the nucleus, mitochondria and endoplasmic reticulum are, grown by 2 µm and with holes
  // filled. Membrane outside it belongs to the dish or to neighbouring cells.
  const cell=500,fp=new Set(),key=(i,j)=>i+','+j;
  for(const spec of recipe.parts)if(['nucleus_seg','mito_seg','er_seg'].includes(spec.layer))for(const m of segs.get(spec))for(let i=0;i<m.positions.length/3;i+=7)fp.add(key(Math.floor(m.positions[i*3]/cell),Math.floor(m.positions[i*3+2]/cell)));
  const grow=4;let cells=[...fp].map(k=>k.split(',').map(Number));const minI=Math.min(...cells.map(c=>c[0]))-grow-1,maxI=Math.max(...cells.map(c=>c[0]))+grow+1,minJ=Math.min(...cells.map(c=>c[1]))-grow-1,maxJ=Math.max(...cells.map(c=>c[1]))+grow+1;
  const grown=new Set();for(const [i,j] of cells)for(let a=-grow;a<=grow;a++)for(let b=-grow;b<=grow;b++)if(a*a+b*b<=grow*grow)grown.add(key(i+a,j+b));
  const outside=new Set(),stack=[[minI,minJ]];while(stack.length){const [i,j]=stack.pop(),k0=key(i,j);if(i<minI||i>maxI||j<minJ||j>maxJ||outside.has(k0)||grown.has(k0))continue;outside.add(k0);stack.push([i+1,j],[i-1,j],[i,j+1],[i,j-1])}
  const inCell=p=>!outside.has(key(Math.floor(p[0]/cell),Math.floor(p[2]/cell)));
  const nearNucleus=nearTest(vertices(focus,2),1);void nearNucleus;
  const zc=(focusBox.min[2]+focusBox.max[2])/2,yc=(focusBox.min[1]+focusBox.max[1])/2;
  const raw=new Map();
  for(const spec of recipe.parts){
    let list=segs.get(spec);
    if(spec.ids==='inside')list=list.filter(m=>{const b=bounds(m.positions);return inCell(b.min.map((v,k)=>(v+b.max[k])/2))});
    let m=merge(list);
    if(spec.layer==='pm_seg')m=filterTriangles(m,inCell);
    if(spec.skipNearFocus){const near=nearTest(vertices(focus),spec.skipNearFocus);m=filterTriangles(m,p=>!near(p))}
    // Wedge cutaway: the top membrane over the front half (towards +z) is removed.
    if(spec.cut==='wedge')m=filterTriangles(m,p=>!(p[1]>yc-400&&p[2]>zc));
    console.log('  '+spec.part+': '+triangles(m).toLocaleString()+' triângulos após o recorte');
    raw.set(spec,m);
  }
  const outputs=[];
  for(const profile of ['desktop','touch']){
    const parts=new Map();const add=(part,mesh)=>{if(!parts.has(part))parts.set(part,{id:part,meshes:[]});parts.get(part).meshes.push(mesh)};
    for(const spec of recipe.parts){
      let m=raw.get(spec);const budget=spec.budget[profile];
      if(spec.nearFocus&&focus){
        // Distance to the nuclear surface (sampled vertices) splits the network into perinuclear and peripheral parts.
        const near=nearTest(vertices(focus,3),spec.nearFocus);
        const a=filterTriangles(m,near),b=filterTriangles(m,p=>!near(p)),share=triangles(a)/(triangles(a)+triangles(b)||1);
        add(spec.part,{name:'surface',mesh:simplify(a,Math.round(budget*share)),color:spec.color,roughness:spec.roughness,opacity:spec.opacity});
        add(spec.otherPart,{name:'surface',mesh:simplify(b,Math.round(budget*(1-share))),color:spec.otherColor,roughness:spec.roughness});
        continue;
      }
      const t=Date.now();const s=simplify(m,budget);console.log('  '+profile+' '+spec.part+': '+triangles(m).toLocaleString()+' → '+triangles(s).toLocaleString()+' ('+((Date.now()-t)/1000).toFixed(1)+' s)');
      add(spec.part,{name:'surface',mesh:s,color:spec.color,roughness:spec.roughness,opacity:spec.opacity});
    }
    // Presentation turn around x (a flat adherent cell faces the camera of the app's front view).
    if(recipe.present?.rotateX){const t=recipe.present.rotateX,c=Math.cos(t),sn=Math.sin(t),all=[...parts.values()].flatMap(p=>p.meshes),b=bounds(merge(all.map(m=>m.mesh)).positions),cy=(b.min[1]+b.max[1])/2,cz=(b.min[2]+b.max[2])/2;
      for(const m of all){const P=m.mesh.positions;for(let i=0;i<P.length;i+=3){const y=P[i+1]-cy,z=P[i+2]-cz;P[i+1]=cy+y*c-z*sn;P[i+2]=cz+y*sn+z*c}}}
    const file=path.join(ROOT,'assets/cytology/real',id+'-'+profile+'-'+recipe.version+'.bin');
    const info=writePack(file,{id,profile,units:'nm',title:id,parts:[...parts.values()],credits:[credit(recipe.dataset)],notes:recipe.notes});
    console.log('  → '+path.relative(ROOT,file).replace(/\\/g,'/')+': '+(info.bytes/1048576).toFixed(2)+' MB, '+info.triangles.toLocaleString()+' triângulos, sha256 '+info.sha256);
    outputs.push(info);
  }
  return outputs;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const ids=process.argv.slice(2);if(!ids.length){console.log('Receitas: '+Object.keys(RECIPES).join(', '));process.exit(0)}
  for(const id of ids)await build(id);
}
