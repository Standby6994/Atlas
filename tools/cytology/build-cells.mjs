// Authored cell-scale models (chloroplast, plant and fungal cells, division stages, cardiomyocyte…): no open 3D data
// covers these whole structures, so they are modelled from published dimensions with the kit in shapes.mjs and
// written in the same pack format as the real data (pack.mjs). Each recipe builds its scene once per profile, at the
// resolution of that profile; colours get cavity shading from a coarse occupancy field of the whole scene.
//   node tools/cytology/build-cells.mjs chloroplast
import {simplify,merge,weld,normals as smoothNormals,triangles} from './mesh.mjs';
import {fetchCif,parseAtoms,molecularSurface} from './pdb.mjs';
import {membraneFit} from './build-pdb.mjs';
import {writePack} from './pack.mjs';
import * as S from './shapes.mjs';
import {chromatid,chromosome,singleChromatid,chromatinTangle,microtubules,centrosome,spindle,cellShell,envelopePieces} from './division-parts.mjs';
import {HALF,THY,thylakoidProfile,byIndex,frameOf,cutFrame,dots,granum,nucleus,chloroplastMini,mitochondrionMini,golgiStack,roughERSheets} from './cell-parts.mjs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const {add,sub,mul,dot,cross,len,norm,lerp,clamp,rng,noise,fbm}=S;
const rgb=c=>[(c>>16)&255,(c>>8)&255,c&255];
export const authored=(changes)=>({title:'Modelo autoral do Atlas Humano',author:'Atlas Humano',license:'mesma licença do projeto',url:'https://github.com/Standby6994/Atlas',citation:'Geometria modelada a partir de dimensões publicadas (ver as observações da vista).',changes});

function createScene(profile){
  const items=[];
  return{profile,q:profile==='desktop'?1:.6,items,
    /** Adds a mesh to a part. colorFn(p)→hex overrides the colour per vertex; mottle is a soft tone noise. */
    add(part,mesh,{color=0xcccccc,opacity=1,roughness=.6,colorFn=null,mottle=.06,ao=true,budget=null}={}){if(!mesh||!mesh.index.length)return;const cap=budget==null?null:typeof budget==='number'?budget:budget[profile];if(cap&&triangles(mesh)>cap)mesh=simplify(mesh,cap);items.push({part,mesh,color,opacity,roughness,colorFn,mottle,ao})},
    res(desktop,touch){return profile==='desktop'?desktop:touch}};
}

export const RECIPES={};

export async function build(id){
  const recipe=RECIPES[id];if(!recipe)throw new Error('Receita inexistente: '+id);console.log(id);const outputs=[];
  for(const profile of['desktop','touch']){
    const t=Date.now(),sc=createScene(profile);await recipe.scene(sc);
    const opaque=sc.items.filter(i=>i.opacity>=.95&&i.ao),occ=S.occupancy(opaque.map(i=>i.mesh),recipe.occupancyCells||110);
    // Cavity shading: occupancy a few cells along the normal; normalised so the most crowded 3% gets the full shade.
    const samples=[];for(const it of sc.items){if(it.opacity<.95)continue;const N=smoothNormals(it.mesh),P=it.mesh.positions,o=new Float32Array(P.length/3);
      for(let v=0;v<o.length;v++){let s=0;for(const d of[.8,1.6,2.6])s+=occ.sample(P[v*3]+N[v*3]*occ.h*d,P[v*3+1]+N[v*3+1]*occ.h*d,P[v*3+2]+N[v*3+2]*occ.h*d);o[v]=s}it.occ=o;if(it.ao)for(let v=0;v<o.length;v+=7)samples.push(o[v])}
    samples.sort((a,b)=>a-b);const top=samples[Math.floor(samples.length*.97)]||1,tone=fbm(recipe.seed||7,3),scale=recipe.mottleScale||200;
    const groups=new Map();
    for(const it of sc.items){const key=it.part+'|'+(it.opacity<.95?'t'+it.opacity+'|'+it.color:'o')+'|'+it.roughness;let g=groups.get(key);if(!g)groups.set(key,g={part:it.part,opacity:it.opacity<.95?it.opacity:1,roughness:it.roughness,color:it.color,meshes:[],colors:[]});g.meshes.push(it.mesh);
      if(it.opacity<.95)continue;const P=it.mesh.positions,c=new Uint8Array(P.length);
      for(let v=0;v<P.length/3;v++){const p=[P[v*3],P[v*3+1],P[v*3+2]],base=rgb(it.colorFn?it.colorFn(p):it.color),shade=it.ao?1-.58*clamp(it.occ[v]/top):1,m=1+it.mottle*tone(p[0]/scale,p[1]/scale,p[2]/scale);for(let k=0;k<3;k++)c[v*3+k]=clamp(Math.round(base[k]*shade*m),0,255)}g.colors.push(c)}
    const parts=new Map(),budget=recipe.parts||{};
    for(const g of groups.values()){let mesh=merge(g.meshes),colors=g.colors.length?concat(g.colors):null;const cap=budget[g.part]?.[profile];
      if(cap&&triangles(mesh)>cap){if(colors){console.warn('  '+g.part+': '+triangles(mesh)+' triângulos > '+cap+' (com cores; mantido)')}else mesh=simplify(mesh,cap)}
      if(!parts.has(g.part))parts.set(g.part,{id:g.part,meshes:[]});parts.get(g.part).meshes.push({name:g.opacity<1?'translucent':'surface',mesh,color:colors?0xffffff:g.color,roughness:g.roughness,opacity:g.opacity,colors})}
    const file=path.join(ROOT,'assets/cytology/real',id+'-'+profile+'-'+recipe.version+'.bin');
    const info=writePack(file,{id,profile,units:'nm',parts:[...parts.values()],credits:recipe.credits,notes:recipe.notes,frame:recipe.frame||null});
    const per=[...parts.values()].map(p=>p.id+' '+p.meshes.reduce((n,m)=>n+triangles(m.mesh),0).toLocaleString()).join(', ');
    console.log('  '+per+'\n  → '+path.relative(ROOT,file).replace(/\\/g,'/')+': '+(info.bytes/1048576).toFixed(2)+' MB, '+info.triangles.toLocaleString()+' triângulos ('+(Date.now()-t)+' ms)');outputs.push(info);
  }
  return outputs;
}
function concat(list){let n=0;for(const a of list)n+=a.length;const out=new Uint8Array(n);let o=0;for(const a of list){out.set(a,o);o+=a.length}return out}

// ── Chloroplast ─────────────────────────────────────────────────────────────────────────────────────────────────
// Lens of ~5.4 × 3 × 2.2 µm cut along its length (z > 0 removed). Grana are stacks of thylakoid discs (450–600 nm
// across, ~21 nm repeat as measured in the spinach tomograms of EMPIAR-12612) joined by tilted stroma lamellae.
function lamella(sc,a,b,{width,rand,colors}){const d=sub(b,a),L=len(d),mid=lerp(a,b,.5),h=(THY.membrane*2+THY.lumen)/2;
  const m=S.superellipsoid([L/2,h,width/2],.42,sc.res(14,10),sc.res(8,6)),dir=norm(d),side=norm(cross(dir,[0,1,0])),up=cross(side,dir);
  const twist=(rand()-.5)*.5,cs=Math.cos(twist),sn=Math.sin(twist),s2=add(mul(side,cs),mul(up,sn)),u2=sub(mul(up,cs),mul(side,sn));
  return S.transform(m,p=>add(mid,add(add(mul(dir,p[0]),mul(u2,p[1])),mul(s2,p[2]))))}
RECIPES.chloroplast={version:'r1',seed:11,mottleScale:260,occupancyCells:120,
  notes:'Modelo autoral em 3D de um cloroplasto de folha (cerca de 5,4 × 3 × 2,2 µm), aberto ao longo do comprimento. As dimensões seguem medidas publicadas: grana com 450–600 nm de diâmetro e tilacoides empilhados a cada ~21 nm, espaçamento medido nos tomogramas crioeletrônicos de cloroplastos intactos de espinafre do EMPIAR-12612 (Wietrzynski et al., CC0). Cada granum é uma pilha de tilacoides em forma de disco ligados por lamelas do estroma inclinadas, que contornam as pilhas. Nos grana cortados aparecem as duas membranas de cada tilacoide e o lúmen entre elas. A distância entre as membranas externa e interna do envelope foi ampliada para ficar visível. Número e posição de grana, grãos de amido, plastoglóbulos, nucleoides e ribossomos são ilustrativos.',
  credits:[authored('Geometria modelada; medidas de referência dos tomogramas de cloroplastos de espinafre (Wietrzynski W. et al., Molecular architecture of thylakoid membranes within intact spinach chloroplasts, bioRxiv 2024, doi:10.1101/2024.11.24.625035; dados EMPIAR-12612, CC0).')],
  async scene(sc){
    const rand=rng(23),C={outer:0xd8e6b6,inner:0xa8d07e,granum:0x3d8f45,lamella:0x5fae5c,lumen:0xa8e0f0,stroma:0xcfe7a8,starch:0xf2ecd6,ring:0xd9cfae,globule:0xe9b545,dna:0x7a5fd0,ribo:0x8fa86a};
    const A=[2700,1100,1500],inLens=(p,m=0)=>(p[0]/(A[0]-m))**2+(p[1]/(A[1]-m))**2+(p[2]/(A[2]-m))**2<1,bump=fbm(5,3),bmp=p=>.018*bump(p[0]/900,p[1]/900,p[2]/900);
    // Envelope: two membranes, the far half only, each with thickness (rims on the cut plane).
    const [eu,ev]=[sc.res(120,64),sc.res(72,40)];
    sc.add('outer-membrane',S.ellipsoid(A,eu,ev,{theta0:Math.PI,theta1:Math.PI*2,thickness:16,bump:bmp}),{color:C.outer,roughness:.55});
    sc.add('inner-membrane',S.ellipsoid(A.map(v=>v-70),eu,ev,{theta0:Math.PI,theta1:Math.PI*2,thickness:16,bump:bmp}),{color:C.inner,roughness:.55});
    sc.add('stroma',S.ellipsoid(A.map(v=>v-110),sc.res(64,40),sc.res(40,26),{theta0:Math.PI,theta1:Math.PI*2,bump:bmp}),{color:C.stroma,opacity:.16,roughness:.7});
    // Grana: a row centred on the cut plane (shown open) and rows behind it.
    const grana=[],starch=[{at:[-900,-150,-150],r:[420,250,330],cut:true},{at:[1250,250,-850],r:[380,230,300]},{at:[-1700,120,-700],r:[300,200,260]}];
    // Grana fill the lens in up to two layers: a candidate is kept when it clears the others in 3D and the starch.
    const tryAdd=(x,z,cut)=>{const radius=220+rand()*80,hy=A[1]*Math.sqrt(Math.max(0,1-(x/(A[0]-radius-240))**2-(z/(A[2]-radius-160))**2))-150;if(hy<110)return;
      const discs=Math.max(5,Math.min(Math.floor(hy*2/THY.repeat),5+Math.floor(rand()*14))),span=discs*THY.repeat,y=(rand()-.5)*Math.max(0,hy*2-span),half=span/2;
      if(grana.some(g=>Math.hypot(g.at[0]-x,g.at[2]-z)<g.radius+radius+90&&Math.abs(g.at[1]-y)<g.discs*THY.repeat/2+half+120))return;
      if(starch.some(s=>Math.hypot((x-s.at[0])/(s.r[0]+radius+60),(z-s.at[2])/(s.r[2]+radius+60))<1&&Math.abs(y-s.at[1])<s.r[1]+half+60))return;grana.push({at:[x,y,z],radius,discs,cut})};
    for(let t=0;t<600;t++)tryAdd((rand()*2-1)*2200,0,true);
    for(let t=0;t<12000&&grana.length<40;t++)tryAdd((rand()*2-1)*2300,-(rand()*1050+300),false);
    const kept=grana.filter(g=>!g.skip);
    for(const g of kept)granum(sc,{...g,rand,colors:C});
    console.log('  grana: '+kept.length+' ('+kept.filter(g=>g.cut).length+' abertos), tilacoides: '+kept.reduce((n,g)=>n+g.discs,0));
    // Stroma lamellae: wide sheets joining neighbouring grana whose stacks overlap in height, rising at most ~20°
    // between them (the helical wrapping of the lamellae around each granum, simplified).
    for(const g of kept){const near=kept.filter(o=>o!==g).map(o=>({o,d:Math.hypot(o.at[0]-g.at[0],o.at[2]-g.at[2])})).filter(({o,d})=>d<1500&&Math.abs(o.at[1]-g.at[1])<(g.discs+o.discs)*THY.repeat/2+60).sort((a,b)=>a.d-b.d).slice(0,4);
      for(const {o,d} of near){if(o.done?.has(g))continue;(g.done||(g.done=new Set())).add(o);const lo=Math.max(g.at[1]-g.discs*THY.repeat/2,o.at[1]-o.discs*THY.repeat/2)-40,hi=Math.min(g.at[1]+g.discs*THY.repeat/2,o.at[1]+o.discs*THY.repeat/2)+40,n=1+Math.floor(rand()*3);
        for(let k=0;k<n;k++){const ya=lo+(hi-lo)*(k+.5)/n+(rand()-.5)*30,yb=ya+(rand()-.5)*Math.min(260,d*.36),dir=norm(sub([o.at[0],0,o.at[2]],[g.at[0],0,g.at[2]])),sd=cross(dir,[0,1,0]),off=(rand()-.5)*Math.min(g.radius,o.radius)*.8;
          const a=add([g.at[0],ya,g.at[2]],add(mul(dir,g.radius*.6),mul(sd,off))),b=add([o.at[0],yb,o.at[2]],add(mul(dir,-o.radius*.6),mul(sd,off*.7)));
          let m=lamella(sc,a,b,{width:170+rand()*150,rand,colors:C});if(g.cut||o.cut||a[2]>-200||b[2]>-200)m=S.clip(m,[0,0,1],0);sc.add('stroma-lamellae',m,{color:C.lamella,roughness:.5})}}}
    // Lamellae along the edge of the lens, under the envelope (the peripheral thylakoids).
    for(const s of starch){const n2=sc.res(48,30),b2=fbm(9,3),bb=p=>.04*b2(p[0]/150,p[1]/150,p[2]/150);
      if(s.cut){sc.add('starch',S.transform(S.ellipsoid(s.r,n2,sc.res(32,20),{theta0:Math.PI,theta1:Math.PI*2,bump:bb}),p=>add(p,s.at)),{color:C.starch,roughness:.75});
        const disc=S.ellipseDisc(s.r[0],s.r[1],sc.res(26,14),n2*2,{bump:bb});sc.add('starch',S.transform(disc,p=>add(p,s.at)),{colorFn:p=>{const q=sub(p,s.at),f=Math.hypot(q[0]/s.r[0],q[1]/s.r[1]);return Math.sin(f*Math.PI*9)>.35?C.ring:C.starch},roughness:.8,ao:false,mottle:.02})}
      else sc.add('starch',S.transform(S.ellipsoid(s.r,n2,sc.res(32,20),{bump:bb}),p=>add(p,s.at)),{color:C.starch,roughness:.75})}
    // Plastoglobules on the lamellae, nucleoids (plastid DNA) and 70S ribosomes in the stroma.
    const free=(p,r)=>inLens(p,r+140)&&p[2]<=r&&!kept.some(g=>Math.hypot(g.at[0]-p[0],g.at[2]-p[2])<g.radius+r+20&&Math.abs(p[1]-g.at[1])<g.discs*THY.repeat/2+r+20)&&!starch.some(s=>Math.hypot((p[0]-s.at[0])/(s.r[0]+r),(p[1]-s.at[1])/(s.r[1]+r),(p[2]-s.at[2])/(s.r[2]+r))<1.1);
    let globules=0;for(let t=0;t<3000&&globules<18;t++){const r=24+rand()*32,p=[(rand()*2-1)*2400,(rand()*2-1)*900,-rand()*1300];if(!free(p,r))continue;globules++;sc.add('plastoglobuli',S.transform(S.icosphere(r,sc.res(2,1)),q=>add(q,p)),{color:C.globule,roughness:.35})}
    let nucleoids=0;for(let t=0;t<2000&&nucleoids<5;t++){const c=[(rand()*2-1)*2000,(rand()*2-1)*500,-rand()*1000-150];if(!free(c,170))continue;nucleoids++;
      const path=S.walk(c,sc.res(260,160),11,p=>len(sub(p,c))<150,rand,{persistence:.7});sc.add('plastid-dna',S.tube(S.spline(path,path.length),7,sc.res(6,4),{caps:'flat'}),{color:C.dna,roughness:.5})}
    let ribos=0;for(let t=0;t<20000&&ribos<sc.res(420,240);t++){const p=[(rand()*2-1)*2500,(rand()*2-1)*1000,-rand()*1400];if(!free(p,14))continue;ribos++;sc.add('stroma',S.transform(S.icosphere(12,1),q=>add(q,p)),{color:C.ribo,roughness:.6})}
    console.log('  plastoglóbulos '+globules+', nucleoides '+nucleoids+', ribossomos '+ribos);
  }};


// ── Plant cell ─────────────────────────────────────────────────────────────────────────────────────────────────
// Leaf mesophyll cell (~42 × 28 × 26 µm) cut along z = 0: wall, plasma membrane, a central vacuole that fills most
// of the cell (dented by the nucleus pocket, crossed by cytoplasmic strands), chloroplasts lining the walls.
export const superGrad=(p,[a,b,c],e)=>{const g=(x,r)=>Math.sign(x)*Math.abs(x/r)**(2/e-1)/r;return norm([g(p[0],a),g(p[1],b),g(p[2],c)])};
export const superPoint=(r,e,th,ph)=>{const sp=x=>Math.sign(x)*Math.abs(x)**e;return[r[0]*sp(Math.cos(ph))*sp(Math.cos(th)),r[1]*sp(Math.sin(ph)),r[2]*sp(Math.cos(ph))*sp(Math.sin(th))]};
export const smin=(a,b,k)=>{const h=clamp(.5+.5*(b-a)/k);return b+(a-b)*h-k*h*(1-h)};
const ringPoint=(r,e,a,z=0)=>[r[0]*Math.sign(Math.cos(a))*Math.abs(Math.cos(a))**e,r[1]*Math.sign(Math.sin(a))*Math.abs(Math.sin(a))**e,z];
RECIPES['plant-cell']={version:'r1',seed:3,mottleScale:2600,occupancyCells:130,
  notes:'Modelo autoral em 3D de uma célula do mesofilo de folha (cerca de 42 × 28 × 26 µm), aberta ao meio. O vacúolo central ocupa a maior parte do volume, com o tonoplasto translúcido, e empurra o citoplasma contra a parede: os cloroplastos ficam enfileirados junto à membrana, e cordões de citoplasma atravessam o vacúolo. O núcleo fica numa bolsa de citoplasma, com envelope duplo, poros, nucléolo e cromatina; à volta dele, retículo rugoso com ribossomos e dictiossomos (complexo golgiense). Nos cloroplastos e mitocôndrias cortados aparecem grana e cristas. Escalas ampliadas para ficarem visíveis: espessura das membranas, plasmodesmos (cerca de 4×) e ribossomos (cerca de 2×). Número, tamanho e posição das organelas são ilustrativos e variam entre tipos de células vegetais.',
  credits:[authored('Geometria modelada a partir de dimensões publicadas de células do mesofilo, cloroplastos (~5 × 2 µm), mitocôndrias, núcleo, retículo e dictiossomos.')],
  async scene(sc){
    const rand=rng(41),e=.32,W=[21000,14000,13000],PMr=W.map(v=>v-650),C={wall:0xcfe0a4,pm:0xeedcae,tono:0x8fb8ff,cytosol:0xe6edcc,strand:0xdde7c4,envelope:0x8d84d6,envelope2:0x7a70c4,pore:0xf1d27a,nucleolus:0x4b2f86,chromatin:0x5a3f9e,euchromatin:0xa996e0,
      chloroplast:0x4c9f50,chloroplastEnv:0x7cc26c,stroma:0xb9dc8c,granum:0x2f7f3c,lumen:0xa8e0f0,starch:0xf2ecd6,mito:0xe58a52,mitoInner:0xd0703c,cristae:0xa8321f,er:0x5aa0d6,ribosome:0x2f4f8f,free:0x3f5fa8,golgi:0xe0b24f,golgiVesicle:0xf0cf7a,pd:0x6b8f2e};
    // Wall and membrane: far half, with rims on the cut plane.
    sc.add('cell-wall',S.superellipsoid(W,e,sc.res(150,84),sc.res(96,54),{...HALF,thickness:600}),{color:C.wall,roughness:.8});
    sc.add('plasma-membrane',S.superellipsoid(PMr,e,sc.res(120,70),sc.res(80,46),{...HALF,thickness:55}),{color:C.pm,roughness:.55});
    // Nucleus pocket and vacuole (implicit: the tonoplast keeps ~1.4 µm from the nucleus, smoothly).
    const NC=[-11500,-6800,0],NR=[4300,3200,3400],T=[18600,11700,10800],eT=.36,gap=1400;
    const nucOut=p=>{const q=[(p[0]-NC[0])/(NR[0]+gap),(p[1]-NC[1])/(NR[1]+gap),(p[2]-NC[2])/(NR[2]+gap)];return(Math.hypot(...q)-1)*Math.min(...NR)};
    const vac=p=>smin(S.superInside(p,T,eT),nucOut(p),900),vs=sc.res(170,260);
    const ton=S.clip(S.implicit(p=>Math.min(vac(p),-p[2]),[-T[0]-400,-T[1]-400,-T[2]-400],[T[0]+400,T[1]+400,300],vs),[0,0,1],-vs*.6);
    sc.add('central-vacuole',ton,{color:C.tono,opacity:.22,roughness:.3,budget:{desktop:30000,touch:12000}});
    const info=nucleus(sc,{at:NC,r:NR,rand,C,part:'nucleus'});
    // Cytoplasmic strands across the vacuole, from the nucleus pocket to the far walls.
    const sb=noise(77);for(const end of[[6000,9500,-9000],[15500,-2500,-7600],[1500,-10500,-8500],[9000,2000,-10500]]){const st=add(NC,[3600,2600*Math.sign(end[1]+1),-2600]),mid=add(lerp(st,end,.5),[(rand()-.5)*3000,(rand()-.5)*3000,-rand()*1500]);
      sc.add('cytosol',S.tube(S.spline([st,mid,end],sc.res(40,24)),t=>420-170*Math.sin(t*Math.PI)+60*sb(t*9,0,0),sc.res(14,9),{caps:'round'}),{color:C.strand,roughness:.7})}
    // Organelles in the cortical cytoplasm: positions on the membrane, pushed inwards; some lie on the cut plane.
    const placed=[],free=(p,r)=>len(sub(p,NC))>Math.max(...NR)+r+1500&&!placed.some(o=>len(sub(o.at,p))<o.r+r);
    const onWall=inset=>{const th=Math.PI+rand()*Math.PI,ph=(rand()*2-1)*Math.PI/2*.92,p=superPoint(PMr,e,th,ph),n=superGrad(p,PMr,e);return{at:sub(p,mul(n,inset)),n:mul(n,-1)}};
    const onRing=inset=>{const q=ringPoint(PMr,e,rand()*Math.PI*2),n=superGrad(q,PMr,e);return{at:sub(q,mul(n,inset)),n:mul(n,-1)}};
    const tangentFrame=w=>frameOf(norm(cross(w.n,norm([rand()-.5,rand()-.5,rand()-.5]))),w.n,w.at);
    let nCut=0,nChl=0;for(let t=0;t<4000&&nChl<sc.res(74,48);t++){const cut=nCut<7&&t%9===0,s=.85+rand()*.3,w=cut?onRing(900*s+70):onWall(900*s+70);if(!cut&&w.at[2]>-1500*s)continue;if(!free(w.at,2700*s))continue;
      const place=cut?cutFrame(w.n,[w.at[0],w.at[1],0]):tangentFrame(w);placed.push({at:w.at,r:2700*s,kind:'chl',cut,frame:place,s});if(cut)nCut++;chloroplastMini(sc,{place,scale:s,cut,rand,C,part:'chloroplast'});nChl++}
    let nMito=0,mCut=0;for(let t=0;t<3000&&nMito<sc.res(30,20);t++){const cut=mCut<4&&t%7===0,w=cut?onRing(520):onWall(400+rand()*700),L=1200+rand()*1100,R=250+rand()*90;if(!cut&&w.at[2]>-L)continue;if(!free(w.at,L*.6))continue;
      const place=cut?cutFrame(w.n,[w.at[0],w.at[1],0]):tangentFrame(w);placed.push({at:w.at,r:L*.6,kind:'mito',cut,frame:place,L,R});if(cut)mCut++;mitochondrionMini(sc,{place,length:L,radius:R,cut,rand,C,part:'mitochondria'});nMito++}
    // Rough ER sheets around the nucleus and dictyosomes in the pocket.
    roughERSheets(sc,{at:NC,r:NR,rand,C,part:'rough-er',layers:3,density:sc.res(70000,180000),riboSize:sc.res(30,40)});
    const gpos=[[NC[0]+NR[0]+900,NC[1]+1800,-2400],[NC[0]+1500,NC[1]+NR[1]+1000,-3000],[NC[0]+NR[0]+700,NC[1]-1500,-3800],[NC[0]-1200,NC[1]+NR[1]+800,-4200]];
    for(const g of gpos)golgiStack(sc,{place:S.placer({at:g,axis:norm([rand()-.5,rand()-.5,rand()-.5]),spin:rand()*6}),rand,C,part:'golgi'});
    // Free ribosomes in short polysome spirals, in the cytoplasm around the nucleus and along the walls.
    const cytoplasm=p=>S.superInside(p,PMr.map(v=>v-120),e)>0&&vac(p)<-150&&nucOut(p)>-gap+150&&p[2]<-150;const ribo=[];
    for(let t=0;t<200000&&ribo.length<sc.res(2400,900);t++){const c=[(rand()*2-1)*PMr[0],(rand()*2-1)*PMr[1],-rand()*PMr[2]];if(!cytoplasm(c))continue;const ax=norm([rand()-.5,rand()-.5,rand()-.5]),u=norm(cross(ax,[0,1,0]));
      for(let k=0;k<6;k++){const a=k*1.1,q=add(c,add(mul(ax,k*45),add(mul(u,Math.cos(a)*55),mul(cross(ax,u),Math.sin(a)*55))));if(cytoplasm(q))ribo.push(q)}}
    dots(sc,'free-ribosomes',ribo,sc.res(24,30),C.free);
    // Plasmodesmata: pit fields of channels through the wall (radius enlarged ~4×), some on the cut rim.
    const pd=[],field=(c,n,count)=>{const u=norm(cross(n,[0,0,1])),v=cross(n,u);for(let k=0;k<count;k++){const o=add(c,add(mul(u,(rand()-.5)*900),mul(v,(rand()-.5)*900)));pd.push(S.tube([sub(o,mul(n,40)),add(o,mul(n,700))],105,sc.res(10,7),{caps:null}))}};
    for(let f=0;f<sc.res(16,10);f++){const th=Math.PI+.15+rand()*(Math.PI-.3),ph=(rand()*2-1)*1.2,p=superPoint(PMr,e,th,ph);field(p,superGrad(p,PMr,e),7)}
    for(let f=0;f<4;f++){const q=ringPoint(PMr,e,rand()*Math.PI*2,-60);field(q,superGrad(q,PMr,e),5)}
    sc.add('plasmodesmata',S.clip(merge(pd),[0,0,1],0),{color:C.pd,roughness:.5});
    // Cut face of the cytoplasm: a thin slab on the plane, between membrane and tonoplast, open over the organelles.
    const sections=placed.filter(o=>o.cut).map(o=>{const c=o.frame([0,0,0]);return{...o,c,t:norm(sub(o.frame([1,0,0]),c)),n:norm(sub(o.frame([0,1,0]),c))}});
    const hole=p=>{for(const o of sections){const q=sub(p,o.c),x=dot(q,o.t),y=dot(q,o.n);if(o.kind==='chl'&&(x/(2500*o.s))**2+(y/(850*o.s))**2<1)return true;if(o.kind==='mito'&&Math.abs(x)<o.L/2+o.R&&Math.abs(y)<o.R*1.3)return true}return false};
    const slabF=p=>Math.min(p[2]+160,-8-p[2],S.superInside(p,PMr.map(v=>v-55),e),-vac(p),nucOut(p)+gap-20,hole(p)?-50:50);
    sc.add('cytosol',S.implicit(slabF,[-PMr[0],-PMr[1],-240],[PMr[0],PMr[1],80],sc.res(80,120)),{color:C.cytosol,opacity:.42,roughness:.8,ao:false,budget:{desktop:14000,touch:6000}});
    console.log('  cloroplastos '+nChl+' ('+nCut+' abertos), mitocôndrias '+nMito+', ribossomos livres '+ribo.length+', poros '+info.pores.length);
  }};


// ── Fungal cell (budding yeast) ────────────────────────────────────────────────────────────────────────────────
// Saccharomyces-like mother cell (~5.4 × 4.9 µm) with a bud, cut along z = 0. Everything is an implicit region
// (positive inside), so every membrane and wall layer is capped on the cut plane like a section seen in EM.
const smax=(a,b,k)=>-smin(-a,-b,k);
const ellIn=(p,c,r)=>(1-Math.hypot((p[0]-c[0])/r[0],(p[1]-c[1])/r[1],(p[2]-c[2])/r[2]))*Math.min(...r);
const segDist=(p,a,b)=>{const ab=sub(b,a),t=clamp(dot(sub(p,a),ab)/dot(ab,ab));return len(sub(p,add(a,mul(ab,t))))};
const CACHE=new Map();const cached=(key,make)=>{if(!CACHE.has(key))CACHE.set(key,make());return CACHE.get(key)};
RECIPES['fungal-cell']={version:'r1',seed:5,mottleScale:500,occupancyCells:120,
  notes:'Modelo autoral em 3D de uma levedura em brotamento (semelhante a Saccharomyces cerevisiae; célula-mãe com cerca de 5 µm), aberta ao meio como um corte de microscopia eletrônica. A parede tem duas camadas (interna de glucanas e quitina, externa de manoproteínas, fibrilar) e cicatrizes de brotamentos anteriores. Dentro: núcleo com envelope duplo e poros, nucléolo em forma de crescente, vacúolo com grânulos de polifosfato, rede de mitocôndrias tubulares junto à superfície, retículo cortical sob a membrana, gotículas de lipídio e ribossomos (apenas uma amostra do total, que passa de 100 mil por célula). Espessuras de membranas levemente ampliadas; posição e número de organelas ilustrativos.',
  credits:[authored('Geometria modelada a partir de dimensões publicadas de leveduras (célula de 4–6 µm, parede de ~150–200 nm, núcleo de ~1,5–2 µm).')],
  async scene(sc){
    const rand=rng(9),C={wallOut:0xb99a5e,wallIn:0xe9ddb6,pm:0xe3c08a,scar:0x9c7c45,cytosol:0xe8e3cf,envelope:0x8d84d6,nucleoplasm:0xc9b6ef,nucleolus:0x4b2f86,tono:0x7fa8d8,lumen:0xbfd8f2,polyp:0x4f5866,mito:0xe58a52,er:0x5aa0d6,lipid:0xf0d36a,ribo:0x3f5fa8,septin:0x9b7fd6};
    const M={c:[0,0,0],r:[2700,2450,2450]},B={c:[3850,450,0],r:[1500,1380,1380]},fz=fbm(13,3),h=sc.res(22,22);
    const g=p=>smax(ellIn(p,M.c,M.r),ellIn(p,B.c,B.r),420);
    const lo=[-2900,-2700,-2700],hi=[5500,2700,60],cutZ=f=>p=>Math.min(f(p),-p[2]);
    // Wall: fibrillar outer layer (mannoproteins), dense inner layer (glucans, chitin) and bud scars.
    const scars=[[[-900,1500,-1700],1.0],[[-1700,-900,-1700],.9]].map(([q,k])=>{const n=norm([q[0]/M.r[0]**2,q[1]/M.r[1]**2,q[2]/M.r[2]**2]),s=mul(norm(q),1/Math.hypot(...norm(q).map((v,i)=>v/M.r[i])));return{s,n,R:330*k}});
    const scarIn=p=>{let best=-1e9;for(const {s,n,R} of scars){const q=sub(p,s),hh=dot(q,n),rho=len(sub(q,mul(n,hh)));best=Math.max(best,95-Math.hypot(rho-R,hh+20))}return best};
    const outerLayer=p=>{const gp=g(p);return Math.max(Math.min(gp+24*fz(p[0]/70,p[1]/70,p[2]/70)+10,70-gp),scarIn(p))};
    sc.add('cell-wall',cached('y-wall-out',()=>S.implicit(cutZ(outerLayer),lo.map(v=>v-150),hi,h)),{color:C.wallOut,roughness:.85,budget:{desktop:70000,touch:26000}});
    sc.add('cell-wall',cached('y-wall-in',()=>S.implicit(cutZ(p=>{const gp=g(p);return Math.min(gp-70,190-gp)}),lo,hi,h)),{color:C.wallIn,roughness:.8,budget:{desktop:36000,touch:14000}});
    sc.add('plasma-membrane',cached('y-pm',()=>S.implicit(cutZ(p=>{const gp=g(p);return Math.min(gp-205,236-gp)}),lo,hi,h)),{color:C.pm,roughness:.55,budget:{desktop:36000,touch:14000}});
    // Nucleus near the neck: two membranes with pore holes, crescent nucleolus.
    const N={c:[1250,-150,0],r:[980,880,880]},poreDirs=[];for(let i=0;i<90;i++){const y=1-(i+.5)/90*2,rr=Math.sqrt(1-y*y),ph=i*2.39996;poreDirs.push([rr*Math.cos(ph),y,rr*Math.sin(ph)])}
    const poreHole=p=>{const q=norm(sub(p,N.c));let best=1e9;for(const d of poreDirs){const c=1-dot(q,d);if(c<best)best=c}return Math.sqrt(2*best)*900-55};
    const ne=p=>{const e=ellIn(p,N.c,N.r);return Math.min(Math.max(Math.min(e,30-e),Math.min(e-58,88-e)),poreHole(p))};
    const nb=[N.c[0]-N.r[0]-150,N.c[1]-N.r[1]-150,N.c[2]-N.r[2]-150],nt=[N.c[0]+N.r[0]+150,N.c[1]+N.r[1]+150,60];
    sc.add('nucleus',cached('y-ne',()=>S.implicit(cutZ(ne),nb,nt,h)),{color:C.envelope,roughness:.5,budget:{desktop:40000,touch:16000}});
    const nuDir=norm([-.4,.85,-.2]),hollow=add(N.c,mul(nuDir,-N.r[1]*.32)),nucleolus=p=>Math.min(ellIn(p,N.c,N.r)-95,len(sub(p,hollow))-N.r[1]*.98);
    sc.add('nucleus',cached('y-nucleoplasm',()=>S.implicit(cutZ(p=>Math.min(ellIn(p,N.c,N.r)-95,-nucleolus(p))),nb,nt,h*1.4)),{color:C.nucleoplasm,roughness:.75,budget:{desktop:9000,touch:4000}});
    sc.add('nucleus',cached('y-nucleolus',()=>S.implicit(cutZ(p=>nucleolus(p)+14*fz(p[0]/40,p[1]/40,p[2]/40)),nb,nt,h)),{color:C.nucleolus,roughness:.7,budget:{desktop:12000,touch:5000}});
    // Vacuole (two lobes) with polyphosphate granules.
    const V1={c:[-1000,250,-150],r:[1150,1020,1050]},V2={c:[-1650,-700,-350],r:[700,640,660]},vac=p=>smax(ellIn(p,V1.c,V1.r),ellIn(p,V2.c,V2.r),260),vb=[-2900,-1500,-1450],vt=[300,1350,60];
    sc.add('vacuole',cached('y-tono',()=>S.implicit(cutZ(p=>{const v=vac(p);return Math.min(v,30-v)}),vb,vt,h)),{color:C.tono,roughness:.4,budget:{desktop:24000,touch:10000}});
    const gran=[];for(let t=0;t<400&&gran.length<14;t++){const p=[vb[0]+rand()*(vt[0]-vb[0]),vb[1]+rand()*(vt[1]-vb[1]),-rand()*1200];const r=55+rand()*70;if(vac(p)>r+60&&!gran.some(q=>len(sub(q.p,p))<q.r+r+20))gran.push({p,r})}
    sc.add('vacuole',cached('y-lumen',()=>S.implicit(cutZ(p=>{let v=vac(p)-30;for(const q of gran)v=Math.min(v,len(sub(p,q.p))-q.r);return v}),vb,vt,h*1.5)),{color:C.lumen,opacity:.55,roughness:.3,budget:{desktop:9000,touch:4000}});
    sc.add('vacuole',cached('y-granules',()=>S.implicit(cutZ(p=>{let v=-1e9;for(const q of gran)v=Math.max(v,q.r-len(sub(p,q.p)));return v}),vb,vt,h*.8)),{color:C.polyp,roughness:.35,budget:{desktop:8000,touch:3500}});
    // Lipid droplets.
    const lipids=[{p:[-200,-1500,-600],r:240},{p:[300,1500,0],r:210},{p:[-2100,600,-900],r:190},{p:[2350,-900,-700],r:170}];
    sc.add('lipid-droplets',cached('y-lipid',()=>S.implicit(cutZ(p=>{let v=-1e9;for(const q of lipids)v=Math.max(v,q.r-len(sub(p,q.p)));return v}),[-2500,-1900,-1300],[2700,1900,260],h)),{color:C.lipid,roughness:.3,budget:{desktop:9000,touch:4000}});
    // Cortical ER: a fenestrated sheet just under the membrane (holes from a noise threshold).
    const en=fbm(21,3);sc.add('endoplasmic-reticulum',cached('y-er',()=>S.implicit(cutZ(p=>{const gp=g(p);return Math.min(gp-270,310-gp,(en(p[0]/380,p[1]/380,p[2]/380)+.05)*400)}),lo,hi,h)),{color:C.er,roughness:.5,budget:{desktop:50000,touch:18000}});
    // Mitochondria: a tubular network under the cortex (mother and bud), drawn as tubes.
    const inCortex=p=>{const gp=g(p);return gp>420&&gp<800&&ellIn(p,N.c,N.r)<-150&&vac(p)<-150},mito=[];
    for(let k=0;k<sc.res(12,9);k++){let st=null;for(let t=0;t<300&&!st;t++){const p=[lo[0]+rand()*(hi[0]-lo[0]),lo[1]+rand()*(hi[1]-lo[1]),-rand()*2400];if(inCortex(p))st=p}if(!st)continue;
      const path=S.walk(st,sc.res(40,30),120,inCortex,rand,{persistence:.86});if(path.length<6)continue;mito.push(path);sc.add('mitochondria',S.clip(S.tube(S.spline(path,path.length*2),140,sc.res(12,8),{caps:'round',capRings:2}),[0,0,1],0),{color:C.mito,roughness:.5})}
    // Septin ring at the bud neck.
    sc.add('septin-ring',S.clip(S.ring([2600,330,0],norm(sub(B.c,M.c)),720,45,sc.res(48,30),sc.res(8,6)),[0,0,1],0),{color:C.septin,roughness:.5});
    // Ribosomes (a sample): denser near the cut plane so the section looks granular.
    const cyto=p=>g(p)>330&&ellIn(p,N.c,N.r)<-40&&vac(p)<-40&&lipids.every(q=>len(sub(p,q.p))>q.r+30)&&mito.every(path=>path.every(q=>len(sub(p,q))>200)),ribo=[];
    for(let t=0;t<300000&&ribo.length<sc.res(6000,2600);t++){const p=[lo[0]+rand()*(hi[0]-lo[0]),lo[1]+rand()*(hi[1]-lo[1]),-(rand()**2.2)*2600-14];if(cyto(p))ribo.push(p)}
    dots(sc,'ribosomes',ribo,15,C.ribo);
    // Cut face of the cytoplasm, translucent.
    const holes=p=>Math.min(...mito.map(path=>{let d=1e9;for(let i=1;i<path.length;i++)d=Math.min(d,segDist(p,path[i-1],path[i]));return d-140}),1e9);
    sc.add('cytosol',cached('y-slab',()=>S.implicit(p=>Math.min(p[2]+120,-6-p[2],g(p)-240,-ellIn(p,N.c,N.r),-vac(p),...lipids.map(q=>len(sub(p,q.p))-q.r),holes(p)),[lo[0],lo[1],-200],[hi[0],hi[1],40],sc.res(26,26))),{color:C.cytosol,opacity:.4,roughness:.8,ao:false,budget:{desktop:12000,touch:5000}});
    console.log('  grânulos '+gran.length+', mitocôndrias '+mito.length+', ribossomos '+ribo.length);
  }};


// ── Cardiomyocyte ──────────────────────────────────────────────────────────────────────────────────────────────
// A 40 µm stretch of a ventricular cell with a branch, joined by an intercalated disc to its neighbour. Stepped
// cutaway: below y = 0 the plane z = 0 cuts myofibrils (sarcomere bands on the cut face) and mitochondria (cristae);
// above it the cut is deeper (z = −1.35 µm) and shows the surfaces: SR sleeves, T-tubules at the Z-lines, dyads.
const SARC=1900;
function sarcomereColor(x,{Z=0x4a2550,I=0xf0d2d0,A=0xb4566a,H=0xcf8590,M=0x6d2f48}={}){const t=((x%SARC)+SARC)%SARC,d=Math.min(t,SARC-t);if(d<45)return Z;if(d<360)return I;const m=Math.abs(t-SARC/2);if(m<30)return M;if(m<170)return H;return A}
/** Myofibril along x from x0 to x1 at (y,z): full tube, or the far half with a flat cap on the plane z = zc. */
function myofibril(sc,{x0,x1,y,z,r,cut,rand,res,part='myofibrils',colors}){const n=Math.max(4,Math.round((x1-x0)/res.dx)),sides=res.sides,wn=noise(Math.floor(rand()*1e5)),wav=x=>[0,60*wn(x/4000,y/900,0),40*wn(x/4000,0,y/900)];
  const rad=x=>{const t=((x%SARC)+SARC)%SARC,d=Math.min(t,SARC-t);return r*(1-.05*Math.exp(-(d*d)/(2*90*90)))*(1+.04*wn(x/700,y,z))},th0=cut?Math.PI:0,th1=Math.PI*2;
  const fn=(u,v)=>{const x=x0+(x1-x0)*v,a=th0+(th1-th0)*u,w=wav(x),rr=rad(x);return[x,y+w[1]+Math.cos(a)*rr,z+w[2]+Math.sin(a)*rr]};
  const col={colorFn:p=>sarcomereColor(p[0],colors),roughness:.55};
  sc.add(part,S.surface(fn,cut?Math.round(sides/2):sides,n,{wrapU:!cut}),col);
  if(cut){const cap=S.surface((u,v)=>{const x=x0+(x1-x0)*v,w=wav(x),rr=rad(x);return[x,y+w[1]+(2*u-1)*rr,z]},3,n);sc.add(part,cap,{...col,ao:false,mottle:.03})}
}
RECIPES.cardiomyocyte={version:'r1',seed:17,mottleScale:900,occupancyCells:150,
  notes:'Modelo autoral em 3D de um trecho de cardiomiócito ventricular (cerca de 40 µm de comprimento e 16 × 11 µm de seção), com uma ramificação e o disco intercalar que o une à célula vizinha. Corte em degrau: na metade de baixo, o plano corta as miofibrilas, mostrando as faixas dos sarcômeros (linhas Z, bandas I e A, zona H e linha M, período de ~1,9 µm), e as mitocôndrias, com cristas densas; na metade de cima, o corte é mais fundo e mostra as superfícies: retículo sarcoplasmático em rede ao redor das miofibrilas, túbulos T entrando na altura das linhas Z e díades (cisterna do retículo junto ao túbulo T) com canais de Ca²⁺ do tipo L e RyR2. Bombas SERCA aparecem como pontos no retículo. No disco intercalar, as faces transversais concentram junções aderentes e desmossomos, e as longitudinais, junções comunicantes. Canais, bombas e junções estão muito ampliados (dezenas de vezes) para serem vistos; quantidades são ilustrativas.',
  credits:[authored('Geometria modelada a partir de dimensões publicadas de cardiomiócitos ventriculares (sarcômero de ~1,9 µm, miofibrilas de ~1 µm, mitocôndrias de ~1–2 µm, túbulos T de ~0,2 µm).')],
  async scene(sc){
    const rand=rng(31),C={sarco:0xe3c08a,disc:0xd9a25a,neighbour:0xd8d0c4,mito:0xd9773f,mitoCap:0xe9a070,cristae:0x8e2c18,nucleus:0x8d84d6,er:0x5aa0d6,tt:0x3f8f8a,ltype:0x2ab0d0,ryr:0xe0473f,serca:0xf2c230,gap:0x4fbf6f,desmo:0x5a4a8a,adherens:0x9b6fd6,cyto:0xead9d2};
    const XR=17800,stair=y=>XR+1300*Math.floor((y+9000)/2600)%3*.5+((Math.floor((y+9000)/2600)%2)?650:0);
    const body=p=>{const q=[p[0],p[1]/8000,p[2]/5500],m=(1-(Math.abs(q[1])**3+Math.abs(q[2])**3)**(1/3))*5500,cap=-22000-p[0];return Math.min(m,-cap+0)};
    const branchAxis=norm([-1,.75,0]),bA=[-17000,3000,0],branch=p=>{const q=sub(p,bA),t=Math.max(0,dot(q,branchAxis)),r=len(sub(q,mul(branchAxis,t)));return Math.min(4300-r,15000-t)};
    const cell=p=>Math.min(smax(body(p),branch(p),1800),stair(p[1])-p[0]),depth=y=>y>0?-1350:0,cutF=f=>p=>Math.min(f(p),depth(p[1])-p[2]);
    const lo=[-31000,-8600,-5800],hi=[XR+3200,16500,80];
    // Sarcolemma (thickness enlarged), the neighbour's membrane beyond the disc (context) and the disc itself.
    sc.add('sarcolemma',S.implicit(cutF(p=>{const c=cell(p);return Math.min(c,200-c)}),lo,hi,sc.res(110,110)),{color:C.sarco,roughness:.55,budget:{desktop:60000,touch:24000}});
    const neigh=p=>Math.min(body(p),p[0]-stair(p[1])-60,XR+4200-p[0]);
    sc.add('neighbour-cell',S.implicit(cutF(p=>{const c=neigh(p);return Math.min(c,200-c)}),[XR-200,-8600,-5800],[XR+4600,8600,80],sc.res(110,110)),{color:C.neighbour,opacity:.5,roughness:.6,budget:{desktop:14000,touch:6000}});
    sc.add('intercalated-disc',S.implicit(cutF(p=>{const s=stair(p[1]);return Math.min(body(p)-150,Math.min(p[0]-(s-110),s+170-p[0]))}),[XR-200,-8400,-5600],[XR+4000,8400,80],sc.res(60,90)),{color:C.disc,roughness:.5,budget:{desktop:24000,touch:10000}});
    // Myofibrils in rows; the nucleus (centre, lower half) pushes them aside.
    const NC=[-3000,-3200,0],NR=[5200,1700,1700],res={dx:sc.res(80,150),sides:sc.res(14,10)},resBack={dx:sc.res(160,300),sides:sc.res(10,8)},fib=[];
    for(let y=-6900;y<=6900;y+=1500)for(const z of y<0?[0,-1500,-3000]:[-2050,-3550]){const cut=y<0&&z===0,r=470+rand()*80,ends=[[-21500,stair(y)-120]];
      const hitN=Math.abs(y-NC[1])<NR[1]+600&&Math.abs(z-NC[2])<NR[2]+600;const segs=hitN?[[ends[0][0],NC[0]-NR[0]-500],[NC[0]+NR[0]+500,ends[0][1]]]:ends;
      for(const [x0,x1] of segs){if(x1-x0<800)continue;fib.push({x0,x1,y,z,r,cut});myofibril(sc,{x0,x1,y,z,r,cut,rand,res:z>=-2100?res:resBack})}}
    // Branch myofibrils (follow the branch axis, uncut, behind the plane).
    for(const off of[[-1500,-2000],[0,-2000],[1500,-2000],[-750,-3400],[750,-3400]]){const side=norm(cross(branchAxis,[0,0,1])),a=add(add(bA,mul(side,off[0])),[0,0,off[1]]),b=add(a,mul(branchAxis,10500)),pts=S.spline([a,lerp(a,b,.5),b],sc.res(120,60));
      sc.add('myofibrils',S.tube(pts,480,sc.res(12,8),{caps:'round'}),{colorFn:p=>sarcomereColor(dot(sub(p,a),branchAxis)),roughness:.55})}
    // Mitochondria between myofibrils, one per sarcomere: cut ones show their cristae on the plane.
    const mitoAt=[];for(let y=-6150;y<=6150;y+=1500)for(const z of y<0?[0,-750,-2250]:[-1750,-2850])for(let x=-21000+SARC/2;x<stair(y)-900;x+=SARC){if(Math.abs(y-NC[1])<NR[1]+400&&Math.abs(x-NC[0])<NR[0]+300&&Math.abs(z)<NR[2]+400)continue;if(rand()<.12)continue;mitoAt.push([x+(rand()-.5)*150,y+(rand()-.5)*120,z,y<0&&z===0])}
    const mr=[820,300,300];const capFn=(cx,cy,a,b)=>(u,v)=>{const x=a*(2*u-1)*.999,yy=b*Math.sqrt(Math.max(0,1-(x/a)**2))*(2*v-1);return[cx+x,cy+yy,0]};
    for(const [x,y,z,cut] of mitoAt){const a=mr[0]*(.85+rand()*.3),b=mr[1]*(.9+rand()*.25),c=mr[2]*(.9+rand()*.2);
      if(!cut){if(z<-2500&&y<0)continue;sc.add('mitochondria',S.transform(S.ellipsoid([a,b,c],sc.res(14,10),sc.res(9,7)),p=>add(p,[x,y,z])),{color:C.mito,roughness:.5});continue}
      sc.add('mitochondria',S.transform(S.ellipsoid([a,b,c],sc.res(18,12),sc.res(10,8),{...HALF,thickness:30}),p=>add(p,[x,y,0])),{color:C.mito,roughness:.5});
      const ph=rand()*6;sc.add('mitochondria',S.surface(capFn(x,y,a-30,b-30),sc.res(36,16),sc.res(5,4)),{colorFn:p=>Math.sin((p[0]-x)/a*Math.PI*9+ph)>.25?C.cristae:C.mitoCap,roughness:.5,ao:false,mottle:.03})}
    // Nucleus (centre of the cell, in the lower half: cut open).
    nucleus(sc,{at:NC,r:NR,rand,C:{envelope:C.nucleus,envelope2:0x7a70c4,pore:0xf1d27a,nucleolus:0x4b2f86,chromatin:0x5a3f9e,euchromatin:0xa996e0},part:'nucleus',pores:sc.res(160,90)});
    // Upper half: T-tubules at the Z-lines (transverse, between myofibril rows, with branches into the depth), the SR
    // network on the myofibril surfaces, dyads with L-type channels and RyR2, SERCA dots on the network.
    const tt=[],sr=[],jsr=[],ltype=[],ryr=[],serca=[];const zFront=-1350;
    for(let x=-21000;x<stair(7000)-300;x+=SARC){const xs=x+(rand()-.5)*60;
      for(const z of[-1550,-2900]){const top=8000*(1-(Math.abs(z)/5500)**3)**(1/3)-60,pts=[];for(let y=300;y<=top;y+=400)pts.push([xs+(rand()-.5)*40,y,z+(rand()-.5)*80]);tt.push(S.tube(pts,115,sc.res(10,6),{caps:'round'}))}
      for(let y=1350;y<7500;y+=1500){if(rand()<.35)continue;const zs=Math.max(-5400,-5500*Math.max(0,1-((y+750)/8000)**3)**(1/3)+350);if(zs>-3200)continue;tt.push(S.tube([[xs,y+750,zs],[xs,y+750,-2900]],110,sc.res(10,6),{caps:'round'}));
        // Dyad: a flattened junctional SR sac against the T-tubule, with the channel clusters between them.
        const at=[xs,y+750,-1550];jsr.push(S.transform(S.superellipsoid([130,70,260],.5,sc.res(14,8),sc.res(8,6)),p=>add(p,add(at,[0,170,0]))));
        for(let k=0;k<5;k++){ltype.push(add(at,[(rand()-.5)*120,105,(rand()-.5)*360]));ryr.push(add(at,[(rand()-.5)*120,130,(rand()-.5)*360]))}}}
    sc.add('t-tubules',merge(tt),{color:C.tt,roughness:.45});
    // SR sleeves: longitudinal tubules wrapping the front myofibrils of the upper half, joined at each sarcomere.
    for(const f of fib.filter(f=>f.y>0&&f.z===-2050)){const nTube=6;for(let k=0;k<nTube;k++){const a=Math.PI*.15+k/(nTube-1)*Math.PI*.7,pts=[];for(let x=f.x0+200;x<f.x1-200;x+=sc.res(220,380))pts.push([x,f.y+Math.cos(a+.25*Math.sin(x/700))*(f.r+60),f.z+Math.sin(a+.25*Math.sin(x/700))*(f.r+60)]);
        if(pts.length>2)sr.push(S.tube(pts,38,sc.res(6,4),{caps:'round',capRings:1}));for(let i=2;i<pts.length;i+=3)serca.push(add(pts[i],[0,0,40]))}
      for(let x=f.x0+SARC/2;x<f.x1;x+=SARC){const pts=[];for(let k=0;k<=8;k++){const a=Math.PI*.15+k/8*Math.PI*.7;pts.push([x+(rand()-.5)*200,f.y+Math.cos(a)*(f.r+60),f.z+Math.sin(a)*(f.r+60)])}sr.push(S.tube(pts,34,sc.res(6,4),{caps:'round',capRings:1}))}}
    sc.add('sarcoplasmic-reticulum',merge([...sr,...jsr]),{color:C.er,roughness:.5});
    dots(sc,'calcium-channels',ltype,42,C.ltype);dots(sc,'calcium-channels',ryr,46,C.ryr);dots(sc,'calcium-pump',serca.filter((_,i)=>i%2===0),32,C.serca);
    // Intercalated disc junctions: gap junction plaques on the longitudinal steps, desmosomes and adherens plaques on the transverse faces.
    const gj=[],des=[],adh=[];for(let y=-9000;y<9000;y+=2600){const y1=y+2600,xa=stair(y+10),xb=stair(y1+10),zs=[-4600,-3000,-1400];
      if(Math.abs(xa-xb)>100&&Math.abs(y1)<7400){for(const z of zs)if(Math.abs(y1/8000)**3+Math.abs(z/5500)**3<.8)gj.push(S.transform(S.superellipsoid([Math.abs(xa-xb)*.35,24,500],.4,sc.res(14,10),sc.res(6,4)),p=>add(p,[(xa+xb)/2,y1,z])))}
      for(let yy=y+300;yy<y1-200;yy+=520)for(const z of[-4800,-3600,-2400,-1200,-200]){if(yy>0&&z>-1400)continue;if(Math.abs(yy/8000)**3+Math.abs(z/5500)**3>.82)continue;const kind=rand()<.45;(kind?des:adh).push(S.transform(S.superellipsoid([45,kind?160:260,kind?160:300],.45,sc.res(10,8),sc.res(6,5)),p=>add(p,[xa,yy+(rand()-.5)*100,z])))}}
    sc.add('gap-junctions',merge(gj),{color:C.gap,roughness:.45});sc.add('anchoring-junctions',merge(des),{color:C.desmo,roughness:.5});sc.add('anchoring-junctions',merge(adh),{color:C.adherens,roughness:.5});
    // Cut face of the cytoplasm (translucent) on both steps.
    const holes=p=>{for(const f of fib)if(f.cut&&p[0]>f.x0&&p[0]<f.x1&&Math.abs(p[1]-f.y)<f.r+40)return true;return false};
    sc.add('cytoplasm',S.implicit(p=>Math.min(cell(p)-220,-p[1]-40,Math.min(p[2]-(depth(p[1])-140),depth(p[1])-6-p[2]),holes(p)?-40:40,len(sub([p[0],p[1],0],[NC[0],NC[1],0]))<1?0:Math.hypot((p[0]-NC[0])/NR[0],(p[1]-NC[1])/NR[1])*1700-1700),[-26000,-8600,-1600],[XR+2600,16000,60],sc.res(90,140)),{color:C.cyto,opacity:.38,roughness:.8,ao:false,budget:{desktop:12000,touch:5000}});
    console.log('  miofibrilas '+fib.length+', mitocôndrias '+mitoAt.length+', díades '+jsr.length);
  }};


// ── Mitosis ────────────────────────────────────────────────────────────────────────────────────────────────────
// Six stages of an animal cell (~20 µm) side by side along x, the spindle axis. Cell membranes are translucent so the
// chromosomes and the spindle show whole. Eight pairs of chromosomes (a human cell has 23 pairs) keep it readable.
const PAIRS=[0x6a4fc8,0x4f6fd0,0x8a4fc0,0x5a5fb0,0x7f62d8,0x4d5ab8,0x9a58c8,0x6070c8];
function karyotype(rand,pairs=8){const out=[];for(let i=0;i<pairs;i++){const total=7200-i*560+(rand()-.5)*600,cen=.22+rand()*.25;for(const h of[0,1])out.push({pL:total*cen/2,qL:total*(1-cen)/2,color:PAIRS[i%PAIRS.length],pair:i,h})}return out}
const randDir=rand=>norm([rand()-.5,rand()-.5,rand()-.5]);
const inPlane=(rand,axis)=>{const u=norm(cross(axis,[0,1,0])),v=cross(axis,u),a=rand()*Math.PI*2;return add(mul(u,Math.cos(a)),mul(v,Math.sin(a)))};
const discPoint=(rand,R)=>{const a=rand()*Math.PI*2,r=Math.sqrt(rand())*R;return[0,Math.cos(a)*r,Math.sin(a)*r]};
const DIV={chrom:0x6a4fc8,kin:0xe0473f,mt:0x9fd8a8,membrane:0xe3c08a,ne:0x8d84d6,nucleolus:0x4b2f86,ring:0xd77d6a,midbody:0xf0a050,centriole:0xf2c230};
RECIPES.mitosis={version:'r1',seed:19,mottleScale:3000,occupancyCells:140,
  notes:'Modelo autoral em 3D das etapas da mitose numa célula animal (cerca de 20 µm), lado a lado ao longo do eixo do fuso: prófase (cromossomos condensando dentro do núcleo, centrossomos se afastando), prometáfase (envelope nuclear fragmentado, microtúbulos capturando cinetócoros), metáfase (cromossomos alinhados na placa equatorial, cada cinetócoro ligado a um polo), anáfase (cromátides-irmãs separadas indo aos polos), telófase (núcleos se reorganizando, sulco de clivagem) e citocinese (anel contrátil, ponte com corpo intermediário). Para ficar legível, aparecem 8 pares de cromossomos (a célula humana tem 23 pares); o diâmetro dos microtúbulos e o tamanho dos centríolos foram ampliados (cerca de 2–3×). A membrana aparece translúcida para mostrar o interior. Tempos, formas e posições são ilustrativos.',
  credits:[authored('Geometria modelada a partir de dimensões publicadas (célula de ~20 µm, cromossomos metafásicos de ~2–10 µm de comprimento e ~0,7 µm de largura, fuso de ~15 µm).')],
  async scene(sc){
    const rand=rng(7),res={len:sc.res(40,24),sides:sc.res(10,7),prof:sc.res(48,30),around:sc.res(48,30),patch:sc.res(10,6),pcm:sc.res(2,1)},X=[-66000,-39600,-13200,13200,39600,66000],R=10000,ax=[1,0,0];
    const kary=karyotype(rand),round=x=>Math.sqrt(Math.max(0,R*R-x*x));
    // Prophase: chromosomes condensing (long, thin, coiled) inside the nucleus; centrosomes moving apart.
    {const c=[X[0],0,0];cellShell(sc,'prophase',{at:c,L:R,radius:round,res});sc.add('prophase',S.transform(S.icosphere(5300,sc.res(4,3)),p=>add(p,c)),{color:DIV.ne,opacity:.3,roughness:.4});
      sc.add('prophase',S.transform(S.icosphere(1100,2,p=>.15*noise(5)(p[0]*3,p[1]*3,p[2]*3)),p=>add(p,add(c,[900,-700,-600]))),{color:DIV.nucleolus,roughness:.6});
      for(const k of kary){const at=add(c,mul(randDir(rand),rand()*3200));chromosome(sc,'prophase',{at,arm:randDir(rand),sister:randDir(rand),pL:k.pL*1.7,qL:k.qL*1.7,r:170,res,rand,color:k.color,coil:9,bend:.6})}
      const P1=add(c,[-2000,6300,0]),P2=add(c,[2000,6300,0]);centrosome(sc,'centrosomes',{at:P1,rand,res});centrosome(sc,'centrosomes',{at:P2,axis:[1,0,0],rand,res});
      const lines=[];for(const P of[P1,P2])for(let i=0;i<22;i++){const d=norm(add(randDir(rand),[0,.4,0]));lines.push([P,add(P,mul(d,1500+rand()*2500))])}lines.push([P1,lerp(P1,P2,.6)],[P2,lerp(P2,P1,.6)]);microtubules(sc,'prophase',lines,{color:DIV.mt})}
    // Prometaphase: envelope in pieces, chromosomes condensed and scattered, fibres capturing kinetochores.
    {const c=[X[1],0,0];cellShell(sc,'prometaphase',{at:c,L:R,radius:round,res});envelopePieces(sc,'prometaphase',{at:c,r:5400,count:sc.res(26,16),size:.5,rand,color:DIV.ne,res});
      const P1=add(c,[-7200,0,0]),P2=add(c,[7200,0,0]),kin=[];for(const k of kary){const at=add(c,mul(randDir(rand),2000+rand()*2600));kin.push(...chromosome(sc,'prometaphase',{at,arm:randDir(rand),sister:norm(add(ax,mul(randDir(rand),.9))),pL:k.pL,qL:k.qL,res,rand,color:k.color}))}
      centrosome(sc,'centrosomes',{at:P1,rand,res});centrosome(sc,'centrosomes',{at:P2,axis:[0,0,1],rand,res});spindle(sc,'prometaphase',{center:c,poles:[P1,P2],kinetochores:kin.filter(()=>rand()<.5),polar:16,astral:16,cellR:R,rand,color:DIV.mt})}
    // Metaphase: chromosomes on the equatorial plate, every kinetochore attached to one pole.
    {const c=[X[2],0,0];cellShell(sc,'metaphase',{at:c,L:R,radius:x=>round(x)*1.0,res});const P1=add(c,[-7600,0,0]),P2=add(c,[7600,0,0]),kin=[],spots=[];
      for(const k of kary){let at;for(let t=0;t<200;t++){const q=discPoint(rand,4200);if(spots.every(s=>Math.hypot(s[1]-q[1],s[2]-q[2])>1150)||t===199){at=q;break}}spots.push(at);const arm=norm(add(inPlane(rand,ax),mul(norm([0,at[1],at[2]]),1.2)));
        kin.push(...chromosome(sc,'metaphase',{at:add(c,at),arm,sister:ax,pL:k.pL,qL:k.qL,res,rand,color:k.color}))}
      centrosome(sc,'centrosomes',{at:P1,rand,res});centrosome(sc,'centrosomes',{at:P2,axis:[0,0,1],rand,res});spindle(sc,'metaphase',{center:c,poles:[P1,P2],kinetochores:kin,polar:26,astral:22,cellR:R,rand,color:DIV.mt})}
    // Anaphase: sisters apart, centromeres leading towards the poles; the cell lengthens.
    {const c=[X[3],0,0],Lc=11200;cellShell(sc,'anaphase',{at:c,L:Lc,radius:x=>Math.sqrt(Math.max(0,1-(x/Lc)**2))*9600,res});const P1=add(c,[-9000,0,0]),P2=add(c,[9000,0,0]),kin=[],spots=[];
      for(const k of kary){let at;for(let t=0;t<200;t++){const q=discPoint(rand,3600);if(spots.every(s=>Math.hypot(s[1]-q[1],s[2]-q[2])>1000)||t===199){at=q;break}}spots.push(at);const arm=inPlane(rand,ax);
        for(const side of[-1,1]){const cen=add(c,add([side*(3900+rand()*500),0,0],mul(at,.75)));kin.push(singleChromatid(sc,'anaphase',{centromere:cen,toPole:[side,0,0],arm,pL:k.pL,qL:k.qL,res,rand,color:k.color}))}}
      centrosome(sc,'centrosomes',{at:P1,rand,res});centrosome(sc,'centrosomes',{at:P2,axis:[0,0,1],rand,res});spindle(sc,'anaphase',{center:c,poles:[P1,P2],kinetochores:kin,polar:30,astral:20,cellR:R,rand,color:DIV.mt})}
    // Telophase: chromatin decondensing at the poles inside reforming envelopes; furrow and midzone fibres.
    {const c=[X[4],0,0],Lc=12500,waist=x=>1-.38*Math.exp(-(x*x)/(2*2600*2600));cellShell(sc,'telophase',{at:c,L:Lc,radius:x=>Math.sqrt(Math.max(0,1-(x/Lc)**2))*9200*waist(x),res});
      for(const side of[-1,1]){const nc=add(c,[side*7000,0,0]);envelopePieces(sc,'telophase',{at:nc,r:3300,count:sc.res(16,11),size:.95,rand,color:DIV.ne,res,scale:[.85,1,1]});
        for(const k of kary)if(rand()<.6){const cen=add(nc,add([-side*900,0,0],mul(randDir(rand),1200)));singleChromatid(sc,'telophase',{centromere:cen,toPole:[side,0,0],arm:randDir(rand),pL:k.pL*.8,qL:k.qL*.8,r:280,res,rand,color:k.color,drag:.2})}
        chromatinTangle(sc,'telophase',{at:nc,r:[2600,2900,2900],res,rand,color:0x7d64d0,fibres:sc.res(8,5),steps:60,step:220,radius:90});centrosome(sc,'centrosomes',{at:add(nc,[side*3800,0,0]),rand,res})}
      const mid=[];for(let i=0;i<sc.res(40,24);i++){const a=rand()*Math.PI*2,rr=rand()*1800;mid.push([add(c,[-4200,Math.cos(a)*rr,Math.sin(a)*rr]),add(c,[4200,Math.cos(a)*rr*.9,Math.sin(a)*rr*.9])])}microtubules(sc,'telophase',mid,{color:DIV.mt});
      sc.add('cytokinesis',S.transform(S.ring([0,0,0],[1,0,0],9200*waist(0)-250,260,sc.res(64,40),sc.res(10,7)),p=>add(p,c)),{color:DIV.ring,roughness:.5})}
    // Cytokinesis: two daughter cells joined by a thin bridge with the midbody; nuclei rebuilt.
    {const c=[X[5],0,0],Rd=7600,prof=x=>{const a=Math.sqrt(Math.max(0,Rd*Rd-(Math.abs(x)-7700)**2));return Math.max(a,Math.abs(x)<1600?650+ (Math.abs(x)/1600)**4*1400:0)};
      cellShell(sc,'cytokinesis',{at:c,L:15300,radius:prof,res:{...res,prof:sc.res(96,60)}});
      for(const side of[-1,1]){const nc=add(c,[side*8200,0,0]);sc.add('cytokinesis',S.transform(S.icosphere(3600,sc.res(4,3)),p=>add([p[0]*.9,p[1],p[2]],nc)),{color:DIV.ne,opacity:.32,roughness:.4});
        chromatinTangle(sc,'cytokinesis',{at:nc,r:[2800,3200,3200],res,rand,color:0x7d64d0,fibres:sc.res(12,7),steps:90,step:200,radius:85});
        sc.add('cytokinesis',S.transform(S.icosphere(800,2,p=>.15*noise(9)(p[0]*3,p[1]*3,p[2]*3)),p=>add(p,add(nc,[side*600,500,-400]))),{color:DIV.nucleolus,roughness:.6});centrosome(sc,'centrosomes',{at:add(nc,[side*4200,1500,0]),rand,res})}
      sc.add('cytokinesis',S.transform(S.ring([0,0,0],[1,0,0],520,230,sc.res(32,20),sc.res(8,6)),p=>add(p,c)),{color:DIV.midbody,roughness:.45});
      const bundle=[];for(let i=0;i<14;i++){const a=rand()*Math.PI*2,rr=rand()*380;bundle.push([add(c,[-2600,Math.cos(a)*rr,Math.sin(a)*rr]),add(c,[2600,Math.cos(a)*rr,Math.sin(a)*rr])])}microtubules(sc,'cytokinesis',bundle,{color:DIV.mt})}
  }};


// ── Meiosis ────────────────────────────────────────────────────────────────────────────────────────────────────
// 2n = 6 (three pairs; maternal red, paternal blue) through prophase I (synapsed homologues with chiasmata),
// metaphase I, anaphase I, meiosis II (two cells) and the four haploid products. Recombinant chromatids change
// colour at the chiasma; the exchanged segments belong to the "crossing-over" part.
const MAT=0xd04a5a,PAT=0x4f6fd0,MPAIRS=[{pL:2000,qL:4900,xc:.55},{pL:1500,qL:3500,xc:-.5},{pL:950,qL:2500,xc:.6}];
/** Chromatid split at the chiasma: the part beyond it goes to another part/colour. */
function splitChromatid(sc,{path,r,res,seed,pinchAt,cut,partA,partB,colorA,colorB}){const n=path.length-1,k=Math.max(1,Math.min(n-1,Math.round(cut*n)));
  const a=path.slice(0,k+1),b=path.slice(k);const rr=r;sc.add(partA,chromatid(a,rr,{...res,len:Math.max(6,Math.round(res.len*k/n))},seed,{pinchAt:pinchAt!=null&&pinchAt<cut?pinchAt/cut:null}),{color:colorA,roughness:.7});
  sc.add(partB,chromatid(b,rr,{...res,len:Math.max(6,Math.round(res.len*(n-k)/n))},seed+1,{pinchAt:pinchAt!=null&&pinchAt>cut?(pinchAt-cut)/(1-cut):null}),{color:colorB,roughness:.7})}
/** Bivalent: two homologues (each two sister chromatids) held at a chiasma where non-sister chromatids cross. */
function bivalent(sc,{at,arm,pairAxis,spec,r=380,res,rand,part,coPart,kPart,kColor=0xe0473f,D=null}){const a=norm(arm),s=norm(pairAxis),w=norm(cross(a,s)),Dh=D??r*1.3,g=r*1.05,{pL,qL}=spec,xc=spec.xc>0?spec.xc*qL:spec.xc*pL,tw=r*1.6,N=16,seed=Math.floor(rand()*1e5);
  for(const h of[-1,1])for(const k of[-1,1]){const pts=[];for(let i=0;i<=N;i++){const x=-pL+(pL+qL)*i/N,pin=.62+.4*Math.min(1,Math.abs(x)/(r*2.2)),cross_=k>0?Math.tanh((xc-x)/tw)*(xc>0?1:-1):1;
      pts.push(add(at,add(add(mul(a,x),mul(s,h*Dh*cross_)),mul(w,k*g*pin))))}
    const pinch=pL/(pL+qL),cutT=(xc+pL)/(pL+qL);if(k<0){sc.add(part,chromatid(pts,r,res,seed+h*7+k,{pinchAt:pinch}),{color:h<0?MAT:PAT,roughness:.7});continue}
    // Crossing chromatid: own colour on its centromere side of the chiasma, the other homologue's colour beyond it.
    if(xc>0)splitChromatid(sc,{path:pts,r,res,seed:seed+h*7+k,pinchAt:pinch,cut:cutT,partA:part,partB:coPart,colorA:h<0?MAT:PAT,colorB:h<0?PAT:MAT});
    else splitChromatid(sc,{path:pts,r,res,seed:seed+h*7+k,pinchAt:pinch,cut:cutT,partA:coPart,partB:part,colorA:h<0?PAT:MAT,colorB:h<0?MAT:PAT})}
  const chi=add(at,add(mul(a,xc),mul(w,g)));sc.add(coPart,S.transform(S.ring([0,0,0],a,r*1.9,r*.22,24,6),p=>add(p,chi)),{color:0xf2c230,roughness:.4});
  const kin=[];for(const h of[-1,1]){const p=add(at,mul(s,h*(Dh+r*1.15)));kin.push({p,dir:mul(s,h)});sc.add(kPart||part,S.transform(S.superellipsoid([r*.6,r*.2,r*.9],.6,10,6),q=>add(S.aligner([0,1,0],mul(s,h))(q),p)),{color:kColor,roughness:.5})}
  return kin;
}
/** Recombinant colouring along a duplicated chromosome: the chromatid on side +1 changes colour at xc. */
const recombinant=(at,arm,own,other,xc)=>({fn:side=>side>0?(p=>{const x=dot(sub(p,at),norm(arm));return(xc>0?x>xc:x<xc)?other:own}):null});
RECIPES.meiosis={version:'r1',seed:23,mottleScale:3000,occupancyCells:140,
  notes:'Modelo autoral em 3D da meiose numa célula com 2n = 6 (três pares de homólogos; cromossomos de origem materna em vermelho e paterna em azul): prófase I com homólogos pareados (bivalentes) e quiasmas, onde cromátides não irmãs trocaram segmentos; metáfase I com os bivalentes na placa e cada homólogo ligado a um polo; anáfase I separando homólogos (as cromátides-irmãs continuam unidas); meiose II em duas células, separando cromátides-irmãs; e as quatro células haploides resultantes, com combinações diferentes de segmentos. A recombinação aparece como troca de cor no quiasma (anel amarelo). Número de cromossomos reduzido para clareza (a célula humana tem 23 pares); microtúbulos e centríolos ampliados; formas e tempos ilustrativos.',
  credits:[authored('Geometria modelada a partir de dimensões publicadas (cromossomos meióticos de alguns µm, células de ~15–25 µm).')],
  async scene(sc){
    const rand=rng(29),res={len:sc.res(40,24),sides:sc.res(10,7),prof:sc.res(48,30),around:sc.res(48,30),patch:sc.res(10,6),pcm:sc.res(2,1)},X=[-60000,-30000,0,34000,72000],R=10000,ax=[1,0,0],round=x=>Math.sqrt(Math.max(0,R*R-x*x));
    // Prophase I: synapsed homologues inside the nucleus.
    {const c=[X[0],0,0];cellShell(sc,'homolog-pair',{at:c,L:R,radius:round,res});sc.add('homolog-pair',S.transform(S.icosphere(6000,sc.res(4,3)),p=>add(p,c)),{color:DIV.ne,opacity:.28,roughness:.4});
      const spots=[[0,2600,-800],[-1500,-2300,900],[2300,-200,1800]];MPAIRS.forEach((spec,i)=>bivalent(sc,{at:add(c,spots[i]),arm:randDir(rand),pairAxis:randDir(rand),spec,res,rand,part:'homolog-pair',coPart:'crossing-over'}));
      centrosome(sc,'homolog-pair',{at:add(c,[-2000,7000,0]),rand,res});centrosome(sc,'homolog-pair',{at:add(c,[2000,7000,0]),axis:[1,0,0],rand,res})}
    // Metaphase I: bivalents on the plate, each homologue facing one pole.
    {const c=[X[1],0,0];cellShell(sc,'metaphase-i',{at:c,L:R,radius:round,res});const P1=add(c,[-7600,0,0]),P2=add(c,[7600,0,0]),kin=[],spots=[[0,2700,-600],[0,-2200,1600],[0,-500,-2600]];
      MPAIRS.forEach((spec,i)=>kin.push(...bivalent(sc,{at:add(c,spots[i]),arm:inPlane(rand,ax),pairAxis:ax,spec,res,rand,part:'metaphase-i',coPart:'crossing-over'})));
      centrosome(sc,'metaphase-i',{at:P1,rand,res});centrosome(sc,'metaphase-i',{at:P2,axis:[0,0,1],rand,res});spindle(sc,'metaphase-i',{center:c,poles:[P1,P2],kinetochores:kin,polar:22,astral:18,cellR:R,rand,color:DIV.mt})}
    // Anaphase I: homologues to opposite poles, sisters still joined (one of them recombinant).
    {const c=[X[2],0,0],Lc=11600,waist=x=>1-.18*Math.exp(-(x*x)/(2*2600*2600));cellShell(sc,'anaphase-i',{at:c,L:Lc,radius:x=>Math.sqrt(Math.max(0,1-(x/Lc)**2))*9600*waist(x),res});
      const P1=add(c,[-9200,0,0]),P2=add(c,[9200,0,0]),kin=[],spots=[[0,2600,-700],[0,-2300,1500],[0,-400,-2600]];
      MPAIRS.forEach((spec,i)=>{const arm=norm(add(inPlane(rand,ax),[0,0,0]));for(const side of[-1,1]){const at=add(c,add([side*5200,0,0],mul(spots[i],.8))),own=side<0?MAT:PAT,other=side<0?PAT:MAT,xc=spec.xc>0?spec.xc*spec.qL:spec.xc*spec.pL;
        kin.push(...chromosome(sc,'anaphase-i',{at,arm:norm(add(arm,[-side*.5,0,0])),sister:norm(cross(arm,ax)),pL:spec.pL,qL:spec.qL,res,rand,colors:{0:own,1:own,...recombinant(at,norm(add(arm,[-side*.5,0,0])),own,other,xc)},bend:.15}).map(k=>({p:k.p,dir:[side,0,0]})))}});
      centrosome(sc,'anaphase-i',{at:P1,rand,res});centrosome(sc,'anaphase-i',{at:P2,axis:[0,0,1],rand,res});spindle(sc,'anaphase-i',{center:c,poles:[P1,P2],kinetochores:kin,polar:26,astral:16,cellR:R,rand,color:DIV.mt})}
    // Meiosis II: two smaller cells in metaphase II (sister chromatids on the plate).
    for(const dy of[-8200,8200]){const c=[X[3],dy,0],r2=7400,P1=add(c,[0,-5600,0]),P2=add(c,[0,5600,0]),kin=[],axis2=[0,1,0];cellShell(sc,'meiosis-ii',{at:c,L:r2,radius:x=>Math.sqrt(Math.max(0,r2*r2-x*x)),res});
      MPAIRS.forEach((spec,i)=>{const own=dy<0?MAT:PAT,other=dy<0?PAT:MAT,at=add(c,[[0,0,-2200],[1800,0,1500],[-2000,0,1200]][i]),arm=norm(inPlane(rand,axis2)),xc=spec.xc>0?spec.xc*spec.qL:spec.xc*spec.pL;
        kin.push(...chromosome(sc,'meiosis-ii',{at,arm,sister:axis2,pL:spec.pL,qL:spec.qL,res,rand,colors:{0:own,1:own,...recombinant(at,arm,own,other,xc)}}))});
      centrosome(sc,'meiosis-ii',{at:P1,rand,res});centrosome(sc,'meiosis-ii',{at:P2,axis:[0,0,1],rand,res});spindle(sc,'meiosis-ii',{center:c,poles:[P1,P2],kinetochores:kin,polar:14,astral:12,cellR:r2,rand,color:DIV.mt})}
    // Four haploid products, each with one chromatid of each type (in various recombinant combinations).
    const combos=[[MAT,MAT,PAT],[PAT,MAT,PAT],[MAT,PAT,MAT],[PAT,PAT,MAT]];
    combos.forEach((combo,i)=>{const c=[X[4]+(i%2?6800:-6800),i<2?6800:-6800,0],r4=6000;cellShell(sc,'haploid-products',{at:c,L:r4,radius:x=>Math.sqrt(Math.max(0,r4*r4-x*x)),res});
      sc.add('haploid-products',S.transform(S.icosphere(3200,sc.res(3,2)),p=>add(p,c)),{color:DIV.ne,opacity:.28,roughness:.4});
      MPAIRS.forEach((spec,j)=>{const own=combo[j],other=own===MAT?PAT:MAT,cen=add(c,mul(randDir(rand),900)),arm=randDir(rand),rec=(i+j)%2===0,xc=spec.xc>0?spec.xc*spec.qL:spec.xc*spec.pL;
        singleChromatid(sc,'haploid-products',{centromere:cen,toPole:randDir(rand),arm,pL:spec.pL*.8,qL:spec.qL*.8,r:300,res,rand,color:own,drag:.12,colorFn:rec?(p=>{const x=dot(sub(p,cen),norm(arm));return(xc>0?x>xc*.8:x<xc*.8)?other:own}):null})});
      centrosome(sc,'haploid-products',{at:add(c,[0,4200,0]),rand,res})});
  }};


// ── Cell cycle ─────────────────────────────────────────────────────────────────────────────────────────────────
// The four phases as cells on a ring (G1 → S → G2 → M), joined by arrows, with the three checkpoints as gates.
function arrowArc(sc,part,{center,R,a0,a1,r,color,res}){const pts=[];const n=res;for(let i=0;i<=n;i++){const a=a0+(a1-a0)*i/n;pts.push(add(center,[Math.cos(a)*R,Math.sin(a)*R,0]))}
  sc.add(part,S.tube(pts.slice(0,-2),r,10,{caps:'round'}),{color,roughness:.5});const tip=pts[n],base=pts[n-2],dir=norm(sub(tip,base));
  sc.add(part,S.transform(S.lathe([[0,0],[r*2.3,0],[0,len(sub(tip,base))*1.6]],16,2),p=>add(S.aligner([0,1,0],dir)(p),base)),{color,roughness:.5})}
function gate(sc,part,{at,dir,R,color,res,bars=true,tube=.13}){const d=norm(dir);if(!bars){sc.add(part,S.ring(at,d,R,R*tube,res,10),{color,roughness:.4});return}
  // Barrier across the arrow (in the plane of the ring): a bar with a post at each end.
  const u=norm(cross(d,[0,0,1])),bar=S.superellipsoid([R*1.15,R*.16,R*.3],.35,sc.res(24,16),sc.res(12,8)),rot=p=>add(at,add(add(mul(u,p[0]),mul(d,p[1])),mul([0,0,1],p[2])));
  sc.add(part,S.transform(bar,rot),{color,roughness:.4});for(const s of[-1,1])sc.add(part,S.transform(S.icosphere(R*.3,2),p=>add(p,add(at,mul(u,s*R*1.2)))),{color,roughness:.4})}
function interphaseCell(sc,part,{at,R,nr,rand,res,centrosomes=1,duplicating=false,foci=0}){cellShell(sc,part,{at,L:R,radius:x=>Math.sqrt(Math.max(0,R*R-x*x)),res});
  sc.add(part,S.transform(S.icosphere(nr,sc.res(4,3)),p=>add(p,at)),{color:DIV.ne,opacity:.3,roughness:.4});chromatinTangle(sc,part,{at,r:[nr*.85,nr*.85,nr*.85],res,rand,color:0x7d64d0,fibres:sc.res(14,8),steps:110,step:nr*.06,radius:nr*.022});
  sc.add(part,S.transform(S.icosphere(nr*.24,2,p=>.15*noise(3)(p[0]*3,p[1]*3,p[2]*3)),p=>add(p,add(at,[nr*.3,-nr*.25,-nr*.2]))),{color:DIV.nucleolus,roughness:.6});
  if(foci){const pts=[];for(let i=0;i<foci;i++){const p=add(at,mul(randDir(rand),Math.cbrt(rand())*nr*.8));for(let k=0;k<3;k++)pts.push(add(p,mul(randDir(rand),nr*.03)))}dots(sc,part,pts,nr*.022,0x9fe870,{sub:1})}
  for(let c=0;c<centrosomes;c++)centrosome(sc,'centrosome-cycle',{at:add(at,[nr+1200+c*(duplicating?0:1800),nr*.6-c*900,0]),axis:c?[1,0,0]:[0,1,0],scale:duplicating?2.5:2.5,rand,res})}
RECIPES['cell-cycle']={version:'r1',seed:37,mottleScale:3000,occupancyCells:140,
  notes:'Modelo autoral em 3D do ciclo celular de uma célula animal típica, com as fases dispostas num anel: G1 (célula menor, um centrossomo, cromatina descondensada), S (DNA sendo duplicado: focos de replicação em verde no núcleo; o centrossomo também se duplica), G2 (célula maior, dois centrossomos) e M (mitose, aqui na metáfase). Os pontos de controle aparecem como portões no caminho: em G1 (antes da replicação), em G2 (antes da divisão) e o de ligação ao fuso, dentro da mitose, antes da anáfase. Tamanhos de células e núcleos são aproximados; microtúbulos e centríolos ampliados; durações das fases não estão representadas.',
  credits:[authored('Geometria modelada a partir de dimensões publicadas de células animais em cultura (~15–20 µm).')],
  async scene(sc){
    const rand=rng(43),res={len:sc.res(36,22),sides:sc.res(9,6),prof:sc.res(40,26),around:sc.res(40,26),patch:sc.res(10,6),pcm:sc.res(2,1)},Rr=27000,O=[0,0,0],pos=a=>[Math.cos(a)*Rr,Math.sin(a)*Rr,0],D=Math.PI/180;
    const A={g1:150*D,s:45*D,g2:-45*D,m:-140*D};
    interphaseCell(sc,'g1',{at:pos(A.g1),R:8000,nr:4000,rand,res,centrosomes:1});
    interphaseCell(sc,'s-phase',{at:pos(A.s),R:9000,nr:4400,rand,res,centrosomes:2,duplicating:true,foci:sc.res(160,90)});
    interphaseCell(sc,'g2',{at:pos(A.g2),R:10000,nr:4800,rand,res,centrosomes:2});
    // M: metaphase cell with the spindle.
    {const c=pos(A.m),R=10000,P1=add(c,[-7400,0,0]),P2=add(c,[7400,0,0]),kin=[],spots=[],kary=karyotype(rand,6);cellShell(sc,'mitotic-phase',{at:c,L:R,radius:x=>Math.sqrt(Math.max(0,R*R-x*x)),res});
      for(const k of kary){let at;for(let t=0;t<200;t++){const q=discPoint(rand,4000);if(spots.every(s=>Math.hypot(s[1]-q[1],s[2]-q[2])>1150)||t===199){at=q;break}}spots.push(at);kin.push(...chromosome(sc,'mitotic-phase',{at:add(c,at),arm:norm(add(inPlane(rand,[1,0,0]),mul(norm([0,at[1],at[2]]),1.2))),sister:[1,0,0],pL:k.pL,qL:k.qL,res,rand,color:k.color}))}
      centrosome(sc,'centrosome-cycle',{at:P1,rand,res});centrosome(sc,'centrosome-cycle',{at:P2,axis:[0,0,1],rand,res});spindle(sc,'mitotic-phase',{center:c,poles:[P1,P2],kinetochores:kin,polar:22,astral:18,cellR:R,rand,color:DIV.mt})}
    // Arrows along the ring (clockwise) and the checkpoint gates.
    const gaps=[[A.g1,A.s],[A.s,A.g2],[A.g2,A.m],[A.m,A.g1-2*Math.PI]];for(const [a0,a1] of gaps){const pad=Math.sign(a1-a0)*.42;arrowArc(sc,'cycle-arrows',{center:O,R:Rr,a0:a0+pad,a1:a1-pad,r:650,color:0x9fb3c9,res:sc.res(40,24)})}
    const gAt=a=>({at:pos(a),dir:[-Math.sin(a),Math.cos(a),0]});
    gate(sc,'g1-checkpoint',{...gAt(97*D),R:3400,color:0xe0b24f,res:sc.res(48,28)});
    gate(sc,'g2-checkpoint',{...gAt(-92*D),R:3400,color:0xe0866a,res:sc.res(48,28)});
    const sp=pos(A.m);gate(sc,'spindle-checkpoint',{at:sp,dir:[1,0,0],R:11200,color:0xd85a7f,res:sc.res(72,40),bars:false,tube:.035});
  }};


// ── Gametogenesis ──────────────────────────────────────────────────────────────────────────────────────────────
// Human germ cells at their real relative sizes: the male line in a row above (spermatogonium 12 µm → sperm 55 µm
// long) and the female line below (primary oocyte in its follicle ~90 µm, ovulated secondary oocyte ~120 µm with
// zona pellucida, corona radiata and the first polar body).
function roundCell(sc,part,{at,R,nr,rand,res,color=0xf0c8b8,opacity=.22,fibres=8,nucleolus=true}){cellShell(sc,part,{at,L:R,radius:x=>Math.sqrt(Math.max(0,R*R-x*x)),res,color,opacity});
  sc.add(part,S.transform(S.icosphere(nr,sc.res(4,3)),p=>add(p,at)),{color:DIV.ne,opacity:.32,roughness:.4});if(fibres)chromatinTangle(sc,part,{at,r:[nr*.85,nr*.85,nr*.85],res,rand,color:0x7d64d0,fibres,steps:90,step:nr*.07,radius:nr*.025});
  if(nucleolus)sc.add(part,S.transform(S.icosphere(nr*.22,2),p=>add(p,add(at,[nr*.3,nr*.2,-nr*.2]))),{color:DIV.nucleolus,roughness:.6})}
function spermModel(sc,part,{at,rand,res,dir=[1,0,0],waves=1.4,stage='mature'}){const T=S.placer({at,axis:[1,0,0]}),toW=p=>add(at,p);const out=[];
  // Head: flattened paddle with the acrosome over its front two thirds; condensed nucleus inside.
  const head=S.ellipsoid([2300,1450,560],sc.res(36,22),sc.res(24,14),{squash:p=>[p[0],p[1]*(1-.18*Math.max(0,-p[0]/2300)),p[2]*(1-.25*Math.max(0,-p[0]/2300))]});
  sc.add(part,S.transform(head,p=>toW([p[0]+2300,p[1],p[2]])),{color:0x9b8fd8,roughness:.45});
  const acro=S.clip(S.ellipsoid([2380,1520,640],sc.res(36,22),sc.res(24,14)),[-1,0,0],400);sc.add(part,S.transform(acro,p=>toW([p[0]+2310,p[1],p[2]])),{color:0x6fc3b0,opacity:.75,roughness:.4});
  // Neck and midpiece: axoneme core wrapped by the mitochondrial helix.
  sc.add(part,S.tube([toW([200,0,0]),toW([-5200,0,0])],430,sc.res(14,10),{caps:'round'}),{color:0xd8c0a0,roughness:.5});
  const helix=[];for(let t=0;t<=sc.res(420,220);t++){const x=-300-t/sc.res(420,220)*4900,a=x/150;helix.push(toW([x,Math.cos(a)*520,Math.sin(a)*520]))}sc.add(part,S.tube(helix,120,sc.res(8,6),{caps:'round'}),{color:0xe58a52,roughness:.45});
  // Principal and end piece: a tapering, beating flagellum (planar wave growing towards the tip).
  const tail=[];const L=48000;for(let i=0;i<=sc.res(160,90);i++){const s=i/sc.res(160,90),x=-5200-s*L,amp=s*s*3800+300*s;tail.push(toW([x,Math.sin(s*Math.PI*2*waves)*amp,Math.sin(s*Math.PI*2*waves*.5)*amp*.15]))}
  sc.add(part,S.tube(tail,s=>s<.92?380*(1-s*.55):170,sc.res(10,7),{caps:'round'}),{color:0xe8d6bc,roughness:.5});
}
RECIPES.gametogenesis={version:'r1',seed:47,mottleScale:6000,occupancyCells:150,
  notes:'Modelo autoral em 3D das células da gametogênese humana em tamanhos relativos reais. Linha masculina (acima): espermatogônia (~12 µm), espermatócito primário em prófase I (~18 µm, o maior da linhagem, com homólogos pareados), espermatócitos secundários, espermátides (redonda, com a vesícula acrossômica, e em alongamento) e o espermatozoide (~55 µm: cabeça com acrossomo e núcleo condensado, peça intermediária com a hélice de mitocôndrias, cauda). Linha feminina (abaixo): ovócito primário (~90 µm) parado na prófase I, com o núcleo grande (vesícula germinativa), zona pelúcida em formação e células foliculares; ovócito secundário ovulado (~120 µm) parado na metáfase II, com o fuso junto à superfície, zona pelúcida, coroa radiada (aberta pela metade) e o primeiro corpúsculo polar no espaço perivitelino. Membranas translúcidas para mostrar o interior; número de cromossomos reduzido; formas ilustrativas.',
  credits:[authored('Geometria modelada a partir de dimensões publicadas de células germinativas humanas (ovócito de ~120 µm, espermatozoide de ~55–60 µm).')],
  async scene(sc){
    const rand=rng(53),res={len:sc.res(30,18),sides:sc.res(8,6),prof:sc.res(48,30),around:sc.res(48,30),patch:sc.res(10,6),pcm:sc.res(2,1)},Ym=125000,Yf=-20000;
    // Male line.
    roundCell(sc,'spermatogonium',{at:[-112000,Ym,0],R:6000,nr:3200,rand,res});
    {const c=[-84000,Ym,0];roundCell(sc,'primary-spermatocyte',{at:c,R:9000,nr:5200,rand,res,fibres:0,nucleolus:false});
      MPAIRS.forEach((spec,i)=>bivalent(sc,{at:add(c,mul(randDir(rand),1800)),arm:randDir(rand),pairAxis:randDir(rand),spec:{pL:spec.pL*.9,qL:spec.qL*.9,xc:spec.xc},r:150,res,rand,part:'primary-spermatocyte',coPart:'primary-spermatocyte',D:200}))}
    for(const dy of[-6500,6500])roundCell(sc,'secondary-spermatocyte',{at:[-58000,Ym+dy,0],R:5800,nr:3000,rand,res});
    {const c=[-38000,Ym,0];roundCell(sc,'spermatid',{at:c,R:4200,nr:2300,rand,res,fibres:5});const cap=S.clip(S.icosphere(2450,3),[-1,0,0],-900);sc.add('spermatid',S.transform(cap,p=>add(p,c)),{color:0x6fc3b0,opacity:.8,roughness:.4});
      sc.add('spermatid',S.transform(S.icosphere(700,2),p=>add(p,add(c,[2600,0,0]))),{color:0x6fc3b0,roughness:.4})}
    {const c=[-14000,Ym+2500,0];cellShell(sc,'spermatid',{at:c,L:5200,radius:x=>2600*Math.sqrt(Math.max(0,1-(x/5200)**2))*(x>0?.75:1.15),res,color:0xf0c8b8,opacity:.22});
      sc.add('spermatid',S.transform(S.ellipsoid([2600,1400,900],sc.res(24,16),sc.res(16,10)),p=>add(p,add(c,[2200,0,0]))),{color:0x9b8fd8,roughness:.45});
      sc.add('spermatid',S.tube(S.spline([add(c,[-1500,0,0]),add(c,[-6000,-3000,0]),add(c,[-9000,-9500,0])],sc.res(40,24)),280,sc.res(8,6),{caps:'round'}),{color:0xe8d6bc,roughness:.5})}
    spermModel(sc,'sperm',{at:[66000,Ym,0],rand,res});
    // Female line: primary oocyte in its follicle (granulosa cells), arrested in prophase I.
    {const c=[-70000,Yf,0],R=45000;cellShell(sc,'primary-oocyte',{at:c,L:R,radius:x=>Math.sqrt(Math.max(0,R*R-x*x)),res,color:0xf3d9b0,opacity:.28});
      sc.add('primary-oocyte',S.transform(S.icosphere(12500,sc.res(4,3)),p=>add(p,add(c,[8000,6000,-6000]))),{color:DIV.ne,opacity:.35,roughness:.4});
      sc.add('primary-oocyte',S.transform(S.icosphere(4200,2,p=>.12*noise(4)(p[0]*3,p[1]*3,p[2]*3)),p=>add(p,add(c,[9000,6500,-7500]))),{color:DIV.nucleolus,roughness:.6});
      chromatinTangle(sc,'primary-oocyte',{at:add(c,[8000,6000,-6000]),r:[10500,10500,10500],res,rand,color:0x7d64d0,fibres:sc.res(10,6),steps:120,step:700,radius:230});
      sc.add('zona-pellucida',S.ellipsoid([R+2200,R+2200,R+2200],sc.res(72,44),sc.res(48,28),{...HALF,thickness:2600}),{color:0xdfe8f2,opacity:.45,roughness:.6});
      const gran=[];for(let i=0;i<sc.res(340,200);i++){const y=1-(i+.5)/sc.res(340,200)*2,rr=Math.sqrt(1-y*y),ph=i*2.39996,d=[rr*Math.cos(ph),y,rr*Math.sin(ph)];if(d[2]>0)continue;
        gran.push(S.transform(S.icosphere(1,1,p=>.1*noise(i)(p[0]*2,p[1]*2,p[2]*2)),p=>add(add(c,mul(d,R+8200)),S.aligner([0,1,0],d)([p[0]*5200,p[1]*5000,p[2]*5200]))))}
      sc.add('follicle-cells',S.transform(merge(gran),p=>add(p,[0,0,0])),{color:0xe8b8a0,roughness:.6})}
    // Secondary oocyte (ovulated): metaphase II spindle at the cortex, zona pellucida, corona radiata, first polar body.
    {const c=[70000,Yf,0],R=58000;cellShell(sc,'secondary-oocyte',{at:c,L:R,radius:x=>Math.sqrt(Math.max(0,R*R-x*x)),res,color:0xf3d9b0,opacity:.28});
      const sp=add(c,[0,R-4500,0]),P1=add(sp,[-3600,0,0]),P2=add(sp,[3600,0,0]),kin=[];MPAIRS.forEach((spec,i)=>kin.push(...chromosome(sc,'secondary-oocyte',{at:add(sp,[0,[-1200,0,1200][i],[700,-900,200][i]]),arm:[0,0,1],sister:[1,0,0],pL:spec.pL*.45,qL:spec.qL*.45,r:200,res,rand,color:i%2?MAT:PAT})));
      spindle(sc,'secondary-oocyte',{poles:[P1,P2],kinetochores:kin,polar:20,astral:0,cellR:4000,rand,color:DIV.mt,r:40});
      const cg=[];for(let i=0;i<sc.res(900,450);i++){const d=randDir(rand);cg.push(add(c,mul(d,R-900)))}dots(sc,'secondary-oocyte',cg,280,0xd6a2c8);
      sc.add('zona-pellucida',S.ellipsoid([R+9000,R+9000,R+9000],sc.res(80,48),sc.res(52,30),{...HALF,thickness:7000,bump:p=>.004*noise(8)(p[0]/4000,p[1]/4000,p[2]/4000)}),{color:0xdfe8f2,opacity:.45,roughness:.6});
      const pb=add(c,[-14000,R+3800,0]);roundCell(sc,'polar-bodies',{at:pb,R:7500,nr:0,rand,res,fibres:0,nucleolus:false,color:0xf3d9b0,opacity:.4});
      MPAIRS.forEach((spec,i)=>chromosome(sc,'polar-bodies',{at:add(pb,mul(randDir(rand),1600)),arm:randDir(rand),sister:randDir(rand),pL:spec.pL*.45,qL:spec.qL*.45,r:200,res,rand,color:i%2?PAT:MAT}));
      const cor=[];for(let i=0;i<sc.res(520,300);i++){const y=1-(i+.5)/sc.res(520,300)*2,rr=Math.sqrt(1-y*y),ph=i*2.39996,d=[rr*Math.cos(ph),y,rr*Math.sin(ph)];if(d[2]>-.05)continue;const L=7000+rand()*3500;
        cor.push(S.transform(S.icosphere(1,1,p=>.12*noise(i+3)(p[0]*2,p[1]*2,p[2]*2)),p=>add(add(c,mul(d,R+16000+L*.5)),S.aligner([0,1,0],d)([p[0]*3200,p[1]*L*.5,p[2]*3200]))))}
      sc.add('corona-radiata',merge(cor),{color:0xe8b8a0,roughness:.6})}
  }};


// ── Cell differentiation ───────────────────────────────────────────────────────────────────────────────────────
// A stem cell in its niche and four specialised cells made from the same genome. Every nucleus holds the same
// chromosome territories (same colours and places); what changes is which ones are compacted (epigenetic state).
const TERR=[0xd04a5a,0x4f6fd0,0x4fae68,0xe0a050,0x9b6fd6,0x56b5a4,0xd77d6a,0x7a8fd6,0xc9b04a,0x5aa0d6];
function territories(sc,{at,r,closed,rand,res,shape=[1,1,1]}){const tr=rng(99),blobs=[];for(let i=0;i<TERR.length;i++){const d=norm([tr()-.5,tr()-.5,tr()-.5]),p=mul(d,r*.45*Math.cbrt(tr()+.2));blobs.push({p,s:r*(.28+tr()*.08),c:TERR[i]})}
  const nb=fbm(71,3);blobs.forEach((b,i)=>{const isClosed=closed.includes(i),m=S.transform(S.icosphere(1,res.terr,q=>.22*nb(q[0]*2.4+i,q[1]*2.4,q[2]*2.4)),q=>add(at,[(b.p[0]+q[0]*b.s*(isClosed?.72:1))*shape[0],(b.p[1]+q[1]*b.s*(isClosed?.72:1))*shape[1],(b.p[2]+q[2]*b.s*(isClosed?.72:1))*shape[2]]));
    sc.add(isClosed?'epigenetic-state':'shared-genome',m,{color:isClosed?0x3b2a5e:b.c,roughness:isClosed?.75:.6})})}
function lineageArrow(sc,part,a,b,{r=900,color=0x9fb3c9,res=24}){const d=norm(sub(b,a)),tip=sub(b,mul(d,r*3.5)),mid=add(lerp(a,tip,.5),[0,0,-6000]);sc.add(part,S.tube(S.spline([a,mid,tip],res),r,10,{caps:'round'}),{color,roughness:.5});
  sc.add(part,S.transform(S.lathe([[0,0],[r*2.4,0],[0,r*4]],16,2),p=>add(S.aligner([0,1,0],d)(p),tip)),{color,roughness:.5})}
RECIPES['cell-differentiation']={version:'r1',seed:59,mottleScale:5000,occupancyCells:140,
  notes:'Modelo autoral em 3D sobre diferenciação celular: uma célula-tronco no seu nicho (células de apoio, fibras da matriz extracelular e moléculas sinalizadoras) dá origem, por etapas, a células especializadas — neurônio, fibra muscular esquelética (multinucleada, estriada), célula epitelial absortiva (com microvilosidades) e adipócito (com uma grande gota de gordura). Todos os núcleos guardam o mesmo genoma: os territórios cromossômicos têm as mesmas cores e posições; o que muda é o estado da cromatina (territórios compactados, em roxo escuro, diferentes em cada tipo celular). A rede de regulação gênica aparece como um esquema de nós (fatores de transcrição) e ligações sobre a célula-tronco. Territórios, rede e quantidades são representações didáticas, não medidas.',
  credits:[authored('Geometria modelada a partir de formas e dimensões publicadas de células humanas (neurônio, fibra muscular, enterócito, adipócito).')],
  async scene(sc){
    const rand=rng(61),res={len:sc.res(30,18),sides:sc.res(8,6),prof:sc.res(48,30),around:sc.res(48,30),patch:sc.res(10,6),pcm:sc.res(2,1),terr:sc.res(3,2)},mem=0xe3c08a;
    // Stem cell and niche.
    const SC=[-62000,0,0];cellShell(sc,'stem-cell',{at:SC,L:7000,radius:x=>Math.sqrt(Math.max(0,7000**2-x*x)),res,color:mem,opacity:.24});
    sc.add('stem-cell',S.transform(S.icosphere(4300,sc.res(4,3)),p=>add(p,SC)),{color:DIV.ne,opacity:.22,roughness:.4});territories(sc,{at:SC,r:4300,closed:[9],rand,res});
    const niche=[];for(let i=0;i<9;i++){const a=i/9*Math.PI*2+.2,d=[Math.cos(a),Math.sin(a)*.8,-.35],c=add(SC,mul(norm(d),12500));niche.push(S.transform(S.icosphere(1,2,p=>.1*noise(i)(p[0]*2,p[1]*2,p[2]*2)),p=>add(c,S.aligner([0,1,0],norm(d))([p[0]*6500,p[1]*2600,p[2]*5200]))))}
    sc.add('microenvironment',merge(niche),{color:0xc9a3b0,roughness:.6});
    const ecm=[];for(let i=0;i<sc.res(26,16);i++){const a=add(SC,[(rand()-.5)*40000,(rand()-.5)*36000,-9000-rand()*6000]),b=add(a,mul(randDir(rand),14000+rand()*12000));ecm.push(S.tube(S.spline([a,add(lerp(a,b,.5),mul(randDir(rand),3000)),b],16),260,6,{caps:'round'}))}
    sc.add('microenvironment',merge(ecm),{color:0xd9c08a,roughness:.55});
    const sig=[];for(let i=0;i<sc.res(160,90);i++)sig.push(add(SC,mul(randDir(rand),8500+rand()*7000)));dots(sc,'microenvironment',sig,330,0x56b5a4,{sub:1});
    // Regulatory network: transcription factors (nodes) and their links, above the stem cell, reaching its nucleus.
    {const nodes=[];for(let i=0;i<14;i++)nodes.push(add(SC,[(rand()-.5)*16000,15000+rand()*9000,(rand()-.5)*9000]));const links=[];
      for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)if(len(sub(nodes[i],nodes[j]))<8500&&rand()<.7)links.push(S.tube([nodes[i],nodes[j]],180,6,{caps:null}));
      for(let i=0;i<4;i++)links.push(S.tube(S.spline([nodes[i],lerp(nodes[i],SC,.6),add(SC,mul(randDir(rand),2000))],12),150,6,{caps:null}));
      sc.add('regulatory-network',merge(links),{color:0xb9c3cf,roughness:.5});dots(sc,'regulatory-network',nodes,900,0xe0b24f,{sub:2})}
    // Lineage arrows towards the specialised cells.
    const targets=[[18000,30000,0],[30000,4000,0],[22000,-24000,0],[62000,-52000,-8000]];for(const t of targets)lineageArrow(sc,'lineage-arrows',add(SC,[9000,0,0]),add(t,[-14000,0,0]),{res:sc.res(24,14)});
    // Neuron: soma, branched dendrites, axon with myelin segments.
    {const c=[34000,32000,0];cellShell(sc,'specialized-cell',{at:c,L:9000,radius:x=>Math.sqrt(Math.max(0,1-(x/9000)**2))*8000*(1+.25*Math.max(0,x/9000)),res,color:0xe6c28a,opacity:.5});
      const tree=(p,d,r,depth)=>{if(depth<1||r<90)return;const L=6000*(depth/3+.4),q=add(p,mul(d,L)),mid=add(lerp(p,q,.5),mul(randDir(rand),L*.15));sc.add('specialized-cell',S.tube(S.spline([p,mid,q],10),t=>r*(1-.45*t),6,{caps:'round'}),{color:0xe6c28a,roughness:.55});
        for(let k=0;k<2;k++)tree(q,norm(add(d,mul(randDir(rand),.8))),r*.6,depth-1)};for(let i=0;i<5;i++)tree(add(c,mul(norm([-1+rand(),rand()*2-1,(rand()-.5)]),7000)),norm([-1+rand()*1.2,rand()*2-1,(rand()-.5)*.6]),900,3);
      const ax=[];for(let i=0;i<=12;i++)ax.push(add(c,[8000+i*3500,Math.sin(i*.6)*1500,0]));sc.add('specialized-cell',S.tube(S.spline(ax,60),420,8,{caps:'round'}),{color:0xe6c28a,roughness:.55});
      const axs=S.spline(ax,60);for(let i=6;i<axs.length-4;i+=9)sc.add('specialized-cell',S.tube(axs.slice(i,i+7),900,10,{caps:'round'}),{color:0xf4f0e6,roughness:.45});
      sc.add('specialized-cell',S.transform(S.icosphere(3600,sc.res(3,2)),p=>add(p,c)),{color:DIV.ne,opacity:.22,roughness:.4});territories(sc,{at:c,r:3600,closed:[0,2,5,7],rand,res})}
    // Skeletal muscle fibre: long cylinder with striations and several peripheral nuclei.
    {const c=[46000,4000,0],L=22000,Rf=6500;sc.add('specialized-cell',S.surface((u,v)=>{const x=-L+2*L*v,a=u*Math.PI*2;return add(c,[x,Math.cos(a)*Rf,Math.sin(a)*Rf])},sc.res(36,24),sc.res(220,120),{wrapU:true}),{colorFn:p=>sarcomereColor((p[0]-c[0])*1.1,{Z:0x6a3050,I:0xf0d2d0,A:0xc06a7a,H:0xd89aa2,M:0x8a4058}),roughness:.55,opacity:1});
      for(const s of[-1,1])sc.add('specialized-cell',S.transform(S.ellipsoid([10,Rf,Rf],sc.res(36,24),4),p=>add(p,add(c,[s*L,0,0]))),{color:0xe8c0c0,roughness:.6});
      for(const [x,a] of[[-14000,.5],[-3000,2.4],[8000,4.1],[16000,1.2]]){const nc=add(c,[x,Math.cos(a)*(Rf-250),Math.sin(a)*(Rf-250)]);sc.add('specialized-cell',S.transform(S.ellipsoid([3200,900,1100],16,10),p=>add(p,nc)),{color:DIV.ne,opacity:.55,roughness:.4});territories(sc,{at:nc,r:1100,closed:[1,3,4,8],rand,res,shape:[2.6,.75,.95]})}}
    // Absorptive epithelial cell: tall column with a brush border of microvilli.
    {const c=[34000,-26000,0],H=12500,W=4200;sc.add('specialized-cell',S.transform(S.superellipsoid([W,H,W],.3,sc.res(24,16),sc.res(30,18)),p=>add(p,c)),{color:0xe6b8a8,roughness:.6,opacity:.55});
      const mv=[];for(let i=-3;i<=3;i++)for(let j=-3;j<=3;j++){const b=add(c,[i*1150,H-200,j*1150]);mv.push(S.tube([b,add(b,[0,1800,0])],320,6,{caps:'round'}))}
      sc.add('specialized-cell',merge(mv),{color:0xf0c8b8,roughness:.6});sc.add('specialized-cell',S.transform(S.icosphere(2400,sc.res(3,2)),p=>add(p,add(c,[0,-6500,W*.2]))),{color:DIV.ne,opacity:.25,roughness:.4});territories(sc,{at:add(c,[0,-6500,W*.2]),r:2400,closed:[2,6,9],rand,res,shape:[.8,1.2,.8]})}
    // Adipocyte: a thin rim of cytoplasm around one large lipid droplet, nucleus squeezed to the side.
    {const c=[76000,-40000,-8000],R=17000;cellShell(sc,'specialized-cell',{at:c,L:R,radius:x=>Math.sqrt(Math.max(0,R*R-x*x)),res,color:0xe3c08a,opacity:.35});
      sc.add('specialized-cell',S.transform(S.icosphere(R-900,sc.res(4,3)),p=>add(p,c)),{color:0xf3dd7a,roughness:.25,opacity:.9});const nc=add(c,[0,0,R-1500]);
      sc.add('specialized-cell',S.transform(S.ellipsoid([3400,2600,900],20,12),p=>add(p,nc)),{color:DIV.ne,opacity:.5,roughness:.4});territories(sc,{at:nc,r:900,closed:[0,1,4,5,7],rand,res,shape:[3.4,2.6,1]})}
  }};


// ── Endocytosis and exocytosis ─────────────────────────────────────────────────────────────────────────────────
// A 1.9 µm strip of plasma membrane (outside above, cytosol below) cut along z = 0, so every pit, vesicle and pore is
// seen in section as in EM. The membrane is one implicit sheet whose dents and pores are smooth unions.
/** Clathrin lattice: the dual of a geodesic sphere (pentagons and hexagons), as struts; keep(dir) limits a cap. */
function clathrin(centre,R,{keep=()=>true,strut=3.6,sides=5,sub=2}={}){const ico=S.icosphere(1,sub),P=ico.positions,I=ico.index,cen=[];for(let t=0;t<I.length;t+=3)cen.push(norm([0,1,2].map(k=>(P[I[t]*3+k]+P[I[t+1]*3+k]+P[I[t+2]*3+k])/3)));
  const edge=new Map(),tubes=[];for(let t=0;t<I.length/3;t++)for(let e=0;e<3;e++){const a=I[t*3+e],b=I[t*3+(e+1)%3],key=a<b?a+'_'+b:b+'_'+a;if(!edge.has(key))edge.set(key,[]);edge.get(key).push(t)}
  for(const [,ts] of edge){if(ts.length!==2)continue;const [u,v]=ts.map(i=>cen[i]);if(!keep(u)||!keep(v))continue;const a=add(centre,mul(u,R)),b=add(centre,mul(v,R)),m=add(centre,mul(norm(add(u,v)),R*1.02));tubes.push(S.tube([a,m,b],strut,sides,{caps:'round',capRings:1}))}
  for(const c of cen)if(keep(c))tubes.push(S.transform(S.icosphere(strut*1.7,0),p=>add(p,add(centre,mul(c,R)))));return merge(tubes)}
RECIPES['endocytosis-exocytosis']={version:'r1',seed:67,mottleScale:120,occupancyCells:150,
  notes:'Modelo autoral em 3D de um trecho de membrana plasmática (cerca de 1,9 µm; meio externo acima, citosol abaixo) cortado ao meio, como num corte de microscopia eletrônica. Endocitose mediada por clatrina, da esquerda para o centro: placa revestida, fosseta rasa, fosseta profunda com a dinamina enrolada no pescoço, vesícula revestida livre e vesícula perdendo o revestimento; a carga (partículas presas a receptores) entra com elas. Em seguida, o endossomo inicial (com vesículas internas e túbulos) e o lisossomo, com membranas em degradação e enzimas. À direita, exocitose: vesículas secretoras com conteúdo denso, uma vesícula ancorada à membrana por complexos SNARE, um poro de fusão aberto liberando a carga e uma vesícula já incorporada à membrana. A gaiola de clatrina segue a geometria real (pentágonos e hexágonos); tamanhos de vesículas (60–200 nm) aproximados; membranas com espessura levemente ampliada; quantidades ilustrativas.',
  credits:[authored('Geometria modelada a partir de dimensões publicadas (vesículas revestidas de ~100 nm, gaiolas de clatrina, colar de dinamina, grânulos secretores de ~200 nm).')],
  async scene(sc){
    const rand=rng(71),T=5,h=sc.res(3.2,3.2),cutZ=f=>p=>Math.min(f(p),-p[2]),sph=(p,c,r)=>r-len(sub(p,c)),cap=(p,a,b,r)=>{const ab=sub(b,a),t=clamp(dot(sub(p,a),ab)/dot(ab,ab));return r-len(sub(p,add(a,mul(ab,t))))};
    const C={membrane:0xe3c08a,coat:0x8fb3e8,dynamin:0xe0866a,cargo:0xd85a7f,vesicle:0xe3c08a,endosome:0xc9a87a,lyso:0xb07fd0,lysoLumen:0x6a4f8a,secretory:0xe0b24f,core:0x8a6a2a,snare:0x56b5a4,actin:0xd77d6a,release:0xf2c230};
    // Membrane: outside (y > 0) united with the pit cavities and the open vesicles of exocytosis.
    const pits=[{c:[-610,-38,0],r:72,neck:null},{c:[-395,-150,0],r:56,neck:[[-395,8,0],[-395,-96,0],15]},{c:[-610,-38,-330],r:72},{c:[-390,-120,-360],r:58,neck:[[-390,8,-360],[-390,-70,-360],18]}];
    const pores=[{c:[700,-96,0],r:88,neck:[[700,8,0],[700,-20,0],24]},{c:[860,-12,0],r:80,neck:null}];
    const g=p=>{let v=p[1];for(const q of pits){v=smax(v,q.neck?Math.max(sph(p,q.c,q.r),cap(p,...q.neck)):sph(p,q.c,q.r),q.neck?6:22)}for(const q of pores)v=smax(v,q.neck?Math.max(sph(p,q.c,q.r),cap(p,...q.neck)):sph(p,q.c,q.r),q.neck?8:30);return v};
    const membrane=S.implicit(cutZ(p=>{const v=g(p);return Math.min(v+T,T-v)}),[-950,-200,-460],[950,26,6],h);
    // Split the sheet: pit regions → coated pit, pore regions → exocytotic fusion.
    const inR=(p,c,r)=>Math.hypot(p[0]-c[0],p[2]-c[2])<r;const split={pm:[],pit:[],fus:[]},P=membrane.positions,I=membrane.index;
    for(let t=0;t<I.length;t+=3){const c=[0,1,2].map(k=>(P[I[t]*3+k]+P[I[t+1]*3+k]+P[I[t+2]*3+k])/3);const key=pits.some(q=>inR(c,q.c,q.r+28))||inR(c,[-800,0,0],110)||inR(c,[-800,0,-330],110)?'pit':pores.some(q=>inR(c,q.c,q.r+30))?'fus':'pm';split[key].push(I[t],I[t+1],I[t+2])}
    const sub_=list=>({positions:P,index:Uint32Array.from(list)});
    sc.add('plasma-membrane',sub_(split.pm),{color:C.membrane,roughness:.55,budget:{desktop:60000,touch:24000}});sc.add('coated-pit',sub_(split.pit),{color:C.membrane,roughness:.55,budget:{desktop:20000,touch:8000}});sc.add('exocytotic-fusion',sub_(split.fus),{color:C.membrane,roughness:.55,budget:{desktop:16000,touch:7000}});
    // Clathrin: flat lattice patches, cages over the pits (open towards the membrane), dynamin collar on the deep neck.
    const coat=(c,R,openDeg)=>clathrin(c,R,{keep:u=>u[1]<Math.cos(openDeg*Math.PI/180)});const clip0=m=>S.clip(m,[0,0,1],0);
    for(const z of[0,-330])sc.add('coated-pit',clip0(S.transform(clathrin([0,0,0],1,{keep:u=>u[1]<-.82,sub:3,strut:3.4/180}),p=>add([-800,-170*(1+p[1])-24,z],[p[0]*180,0,p[2]*180]))),{color:C.coat,roughness:.45,budget:{desktop:14000,touch:6000}});
    sc.add('coated-pit',clip0(coat(pits[0].c,pits[0].r+20,-20)),{color:C.coat,roughness:.45,budget:{desktop:14000,touch:6000}});sc.add('coated-pit',clip0(coat(pits[1].c,pits[1].r+20,-62)),{color:C.coat,roughness:.45,budget:{desktop:14000,touch:6000}});
    sc.add('coated-pit',coat(pits[2].c,pits[2].r+20,-20),{color:C.coat,roughness:.45,budget:{desktop:14000,touch:6000}});sc.add('coated-pit',coat(pits[3].c,pits[3].r+20,-62),{color:C.coat,roughness:.45,budget:{desktop:14000,touch:6000}});
    const hel=[];for(let i=0;i<=120;i++){const a=i/120*Math.PI*2*3.2;hel.push([-395+Math.cos(a)*24,-22-i/120*58,Math.sin(a)*24])}sc.add('coated-pit',clip0(S.tube(hel,5.5,6,{caps:'round'})),{color:C.dynamin,roughness:.45});
    // Free coated vesicle and one losing its coat; cargo inside.
    const shell=(c,r,lo,hi)=>S.implicit(cutZ(p=>{const d=len(sub(p,c));return Math.min(d-(r-T),r+T-d)}),lo??sub(c,[r+12,r+12,r+12]),hi??add(c,[r+12,r+12,6]),h);
    const V1={c:[-215,-300,0],r:46},V2={c:[-60,-420,0],r:46};sc.add('endocytic-vesicle',shell(V1.c,V1.r),{color:C.vesicle,roughness:.55,budget:{desktop:5000,touch:2500}});sc.add('endocytic-vesicle',clip0(clathrin(V1.c,V1.r+20)),{color:C.coat,roughness:.45,budget:{desktop:14000,touch:6000}});
    sc.add('endocytic-vesicle',shell(V2.c,V2.r),{color:C.vesicle,roughness:.55,budget:{desktop:5000,touch:2500}});sc.add('endocytic-vesicle',clip0(clathrin(V2.c,V2.r+20,{keep:u=>u[0]<-.2&&u[1]<.3})),{color:C.coat,roughness:.45,budget:{desktop:14000,touch:6000}});
    const cargo=[];for(const q of[...pits.slice(0,2),V1,V2])for(let i=0;i<9;i++){const d=randDir(rand),p=add(q.c,mul(d,q.r*.55));if(p[2]<-6)cargo.push(p)}for(const q of pits.slice(2))for(let i=0;i<6;i++)cargo.push(add(q.c,mul(randDir(rand),q.r*.55)));dots(sc,'endocytic-vesicle',cargo,9,C.cargo,{sub:1});
    // Early endosome (context): irregular body with tubules and intraluminal vesicles.
    const E={c:[-180,-680,-40],r:150},eb=fbm(31,3);const endo=p=>smax(sph(p,E.c,E.r)+18*eb(p[0]/60,p[1]/60,p[2]/60),Math.max(cap(p,add(E.c,[100,40,0]),add(E.c,[300,130,-60]),15),cap(p,add(E.c,[-60,-90,0]),add(E.c,[-250,-190,-40]),14)),16);
    sc.add('early-endosome',S.implicit(cutZ(p=>{const v=endo(p);return Math.min(v+T,T-v)}),[-520,-960,-260],[220,-460,6],h),{color:C.endosome,roughness:.55,budget:{desktop:18000,touch:7000}});
    const ilv=[];for(let i=0;i<9;i++){const p=add(E.c,mul(randDir(rand),rand()*85));ilv.push(shell(p,20+rand()*8))}sc.add('early-endosome',merge(ilv),{color:C.endosome,roughness:.55,budget:{desktop:9000,touch:4000}});
    // Lysosome: dense lumen, membrane whorls being digested, hydrolases.
    const L={c:[200,-720,0],r:175};sc.add('lysosome',shell(L.c,L.r),{color:C.lyso,roughness:.5,budget:{desktop:16000,touch:7000}});
    sc.add('lysosome',S.implicit(cutZ(p=>sph(p,L.c,L.r-T-2)),sub(L.c,[L.r,L.r,L.r]),add(L.c,[L.r,L.r,6]),h*1.6),{color:C.lysoLumen,opacity:.55,roughness:.4,budget:{desktop:8000,touch:4000}});
    const whorl=[];for(const [o,r] of[[[-50,30,-20],70],[[-50,30,-20],55],[[60,-60,-30],45]])whorl.push(S.implicit(cutZ(p=>{const d=len(sub(p,add(L.c,o)));return Math.min(d-(r-3.5),r+3.5-d,p[1]-(L.c[1]+o[1]-r*.6))}),sub(add(L.c,o),[r+8,r+8,r+8]),add(add(L.c,o),[r+8,r+8,6]),h));
    sc.add('lysosome',merge(whorl),{color:0x9a86c0,roughness:.5,budget:{desktop:12000,touch:5000}});const hyd=[];for(let i=0;i<sc.res(60,40);i++){const p=add(L.c,mul(randDir(rand),rand()*(L.r-25)));if(p[2]<-6)hyd.push(p)}dots(sc,'lysosome',hyd,7,0xf2c230,{sub:1});
    // Secretory granules: membrane with a dense core; one docked by SNARE bundles.
    const G=[{c:[420,-470,0],r:95},{c:[600,-560,-60],r:90},{c:[480,-250,-180],r:92},{c:[545,-104,0],r:90}];
    for(const q of G){sc.add('secretory-vesicle',shell(q.c,q.r),{color:C.vesicle,roughness:.55,budget:{desktop:9000,touch:4000}});sc.add('secretory-vesicle',S.implicit(cutZ(p=>sph(p,q.c,q.r*.68)+6*eb(p[0]/25,p[1]/25,p[2]/25)),sub(q.c,[q.r,q.r,q.r]),add(q.c,[q.r,q.r,6]),h),{color:C.core,roughness:.45,budget:{desktop:5000,touch:2500}})}
    const sn=[];for(let i=0;i<5;i++){const a=i/5*Math.PI*2,x=545+Math.cos(a)*34,z=Math.sin(a)*34-8;sn.push(S.tube([[x,-16,z],[x+(rand()-.5)*6,-6,z]],3.4,5,{caps:'round'}))}sc.add('exocytotic-fusion',merge(sn),{color:C.snare,roughness:.45});
    // Released cargo above the open pore and the collapsed vesicle; the core of the fusing granule half dispersed.
    const rel=[];for(let i=0;i<sc.res(110,70);i++){const p=add([700+(rand()-.5)*240,30+rand()*200,-rand()*300],[0,0,0]);rel.push(p)}for(let i=0;i<40;i++)rel.push(add(pores[0].c,mul(randDir(rand),rand()*60)));dots(sc,'exocytotic-fusion',rel.filter(p=>p[2]<-5),8,C.core,{sub:1});
    // Actin cortex under the membrane (context).
    const act=[];for(let i=0;i<sc.res(46,30);i++){const a=[(rand()*2-1)*940,-30-rand()*60,-rand()*440],b=add(a,mul(norm([rand()-.5,(rand()-.5)*.2,rand()-.5]),80+rand()*120));act.push(S.tube([a,b],3,5,{caps:null}))}sc.add('actin-cortex',S.clip(merge(act),[0,0,1],0),{color:0xb07a6a,roughness:.6});
  }};


// ── Vacuole ────────────────────────────────────────────────────────────────────────────────────────────────────
// A plant cell cut open around its central vacuole, plus a magnified window (×300) on the tonoplast with the real
// proton pumps: V-ATPase (PDB 3J9T) and the vacuolar H⁺-pyrophosphatase (PDB 4A01), as molecular surfaces.
async function pdbSurface(code,{spacing=3,probe=1.2,keepV1Down=false}={}){const text=await fetchCif(code),s=parseAtoms(text),fit=membraneFit(s);let n=fit.normal;
  if(keepV1Down){let side=0;for(let i=0;i<s.count;i+=7)side+=Math.sign((s.x[i]-fit.center[0])*n[0]+(s.y[i]-fit.center[1])*n[1]+(s.z[i]-fit.center[2])*n[2]);if(side>0)n=mul(n,-1)}
  const m=weld(molecularSurface(s,{spacing,smooth:.6,probe}),1e-4),rot=S.aligner(n,[0,1,0]);return S.transform(m,p=>rot(sub(p,fit.center)))}
RECIPES.vacuole={version:'r1',seed:73,mottleScale:2000,occupancyCells:140,
  notes:'Modelo autoral em 3D de uma célula vegetal (cerca de 30 × 20 × 18 µm) aberta ao meio, com o vacúolo central ocupando a maior parte do volume. O tonoplasto separa o lúmen (com solutos dissolvidos e cristais de oxalato de cálcio, uma drusa e um feixe de ráfides) do citoplasma periférico, apertado contra a parede, onde ficam núcleo, cloroplastos e mitocôndrias. As setas indicam a pressão de turgor do vacúolo cheio de água contra a parede. A janela ampliada cerca de 300 vezes mostra um trecho do tonoplasto com as bombas de prótons reais, em superfície molecular: a ATPase do tipo V (estrutura de levedura, PDB 3J9T) e a pirofosfatase de prótons vacuolar (feijão-mungo, PDB 4A01), que acumulam H⁺ no lúmen (pontos vermelhos). Na célula, espessuras de membranas ampliadas e quantidades ilustrativas.',
  credits:[authored('Célula e vacúolo modelados a partir de dimensões publicadas.'),{title:'Protein Data Bank — 3J9T, 4A01',author:'wwPDB / RCSB PDB e autores de cada estrutura (Zhao, Benlekbir & Rubinstein, Nature 2015; Lin et al., Nature 2012)',license:'CC0 1.0',url:'https://www.rcsb.org/',citation:'3J9T: V-ATPase de Saccharomyces cerevisiae (crio-ME). 4A01: H⁺-pirofosfatase de Vigna radiata (cristalografia).',changes:'Superfícies moleculares calculadas dos átomos, orientadas pela faixa hidrofóbica da membrana, simplificadas e ampliadas na janela.'}],
  async scene(sc){
    const rand=rng(79),e=.34,W=[15000,10000,9000],PMr=W.map(v=>v-450),C={wall:0xcfe0a4,pm:0xeedcae,tono:0x8f86d6,lumen:0xc9c2f0,cyto:0xe6edcc,envelope:0x8d84d6,envelope2:0x7a70c4,pore:0xf1d27a,nucleolus:0x4b2f86,chromatin:0x5a3f9e,euchromatin:0xa996e0,
      chloroplast:0x4c9f50,chloroplastEnv:0x7cc26c,stroma:0xb9dc8c,granum:0x2f7f3c,lumenT:0xa8e0f0,starch:0xf2ecd6,mito:0xe58a52,mitoInner:0xd0703c,cristae:0xa8321f,crystal:0xf4f7fb,solute:[0xe0b24f,0x56b5a4,0xd85a7f,0x7a8fd6],turgor:0xe0473f,vatp1:0xe0b24f,vatp0:0x5aa0d6,ppase:0x4fae68,proton:0xe0473f,head:0xe3c08a,tail:0xf2e2a8};
    sc.add('cell-wall',S.superellipsoid(W,e,sc.res(120,72),sc.res(80,48),{...HALF,thickness:450}),{color:C.wall,roughness:.8});
    sc.add('cell-wall',S.superellipsoid(PMr,e,sc.res(100,60),sc.res(64,40),{...HALF,thickness:45}),{color:C.pm,roughness:.55});
    // Tonoplast (implicit shell, dented by the nucleus pocket) and the lumen cut face.
    const NC=[-9000,-5600,0],NR=[3200,2300,2400],T=[13600,8500,7600],eT=.38,gap=900,nucOut=p=>(Math.hypot((p[0]-NC[0])/(NR[0]+gap),(p[1]-NC[1])/(NR[1]+gap),(p[2]-NC[2])/(NR[2]+gap))-1)*Math.min(...NR);
    const vac=p=>smin(S.superInside(p,T,eT),nucOut(p),700),vs=sc.res(110,160),cutZ=f=>p=>Math.min(f(p),-p[2]);
    sc.add('tonoplast',S.clip(S.implicit(p=>Math.min(vac(p),-p[2]),[-T[0]-300,-T[1]-300,-T[2]-300],[T[0]+300,T[1]+300,200],vs),[0,0,1],-vs*.6),{color:C.tono,roughness:.45,budget:{desktop:30000,touch:12000}});
    sc.add('lumen',S.implicit(p=>Math.min(vac(p)-70,p[2]+90,-6-p[2]),[-T[0],-T[1],-160],[T[0],T[1],40],sc.res(90,140)),{color:C.lumen,opacity:.28,roughness:.3,ao:false,budget:{desktop:6000,touch:3000}});
    // Peripheral cytoplasm: cut face, nucleus, chloroplasts and mitochondria pressed against the wall.
    sc.add('cytoplasmic-rim',S.implicit(p=>Math.min(p[2]+120,-6-p[2],S.superInside(p,PMr.map(v=>v-45),e),-vac(p)+10,nucOut(p)+gap-20),[-PMr[0],-PMr[1],-200],[PMr[0],PMr[1],40],sc.res(70,110)),{color:C.cyto,opacity:.5,roughness:.8,ao:false,budget:{desktop:10000,touch:5000}});
    nucleus(sc,{at:NC,r:NR,rand,C,part:'cytoplasmic-rim',pores:sc.res(140,70)});
    const placed=[],onWall=inset=>{const th=Math.PI+rand()*Math.PI,ph=(rand()*2-1)*Math.PI/2*.9,p=superPoint(PMr,e,th,ph),n=superGrad(p,PMr,e);return{at:sub(p,mul(n,inset)),n:mul(n,-1)}};
    for(let t=0;t<3000&&placed.length<sc.res(24,16);t++){const s=.8+rand()*.25,w=onWall(800*s+60);if(w.at[2]>-1400*s||len(sub(w.at,NC))<5200||placed.some(o=>len(sub(o,w.at))<4600*s))continue;placed.push(w.at);
      chloroplastMini(sc,{place:frameOf(norm(cross(w.n,randDir(rand))),w.n,w.at),scale:s,cut:false,rand,C:{...C,lumen:C.lumenT},part:'cytoplasmic-rim'})}
    for(let t=0,n=0;t<2000&&n<sc.res(16,10);t++){const w=onWall(380),L=1100+rand()*700;if(w.at[2]>-L||placed.some(o=>len(sub(o,w.at))<2600))continue;n++;placed.push(w.at);mitochondrionMini(sc,{place:frameOf(norm(cross(w.n,randDir(rand))),w.n,w.at),length:L,radius:240,cut:false,rand,C,part:'cytoplasmic-rim'})}
    // Stored solutes: a druse (star of prisms), a bundle of raphides, dissolved solutes.
    const crystal=(at,dir,L,w)=>{const d=norm(dir);return S.transform(S.superellipsoid([w,L/2,w],.18,6,6),p=>add(S.aligner([0,1,0],d)([p[0],p[1]*(1-.0*p[1]),p[2]]),add(at,mul(d,L/2))))};
    const dr=[2500,-2200,-3800],druse=[];for(let i=0;i<sc.res(34,22);i++){const d=randDir(rand);druse.push(crystal(dr,d,900+rand()*700,140+rand()*60))}sc.add('storage-solutes',merge(druse),{color:C.crystal,roughness:.15});
    const rb=[-1500,3300,-4200],rax=norm([1,.25,-.2]),raph=[];for(let i=0;i<sc.res(40,24);i++){const o=add(rb,[0,(rand()-.5)*700,(rand()-.5)*700]);raph.push(S.tube([sub(o,mul(rax,2600+rand()*300)),add(o,mul(rax,2600+rand()*300))],38,5,{caps:'round',capRings:1}))}sc.add('storage-solutes',merge(raph),{color:C.crystal,roughness:.15});
    for(let k=0;k<4;k++){const pts=[];for(let t=0;t<40000&&pts.length<sc.res(110,70);t++){const p=[(rand()*2-1)*T[0],(rand()*2-1)*T[1],-rand()*T[2]];if(vac(p)>250)pts.push(p)}dots(sc,'storage-solutes',pts,95,C.solute[k],{sub:1})}
    // Turgor: arrows from the vacuole towards the wall, just behind the cut plane.
    const arrows=[];for(let i=0;i<10;i++){const a=i/10*Math.PI*2+.15,q=[Math.cos(a),Math.sin(a)],dir=norm([q[0]/T[0]*T[1],q[1],0]),from=[q[0]*T[0]*.55,q[1]*T[1]*.55,-500],to=add(from,mul(norm([q[0],q[1]*1.3,0]),3600));
      arrows.push(S.tube([from,sub(to,mul(norm(sub(to,from)),900))],230,10,{caps:'round'}),S.transform(S.lathe([[0,0],[560,0],[0,1000]],16,2),p=>add(S.aligner([0,1,0],norm(sub(to,from)))(p),sub(to,mul(norm(sub(to,from)),900)))))}
    sc.add('turgor',merge(arrows),{color:C.turgor,roughness:.4});
    // Magnified tonoplast window (×300): bilayer, V-ATPase, H⁺-PPase dimers, protons (more in the lumen, above).
    const M=30,O=[29000,1000,-2500],toW=p=>add(O,mul(p,M)),R=300;
    sc.add('proton-pump',S.ring([T[0]*.98,0,-1800],[1,0,0],900,90,32,8),{color:C.vatp0,roughness:.4});
    const lines=[];for(const s of[-1,1])for(const t of[-1,1])lines.push(S.tube([[T[0]*.98,s*900,-1800+t*300],toW([-R*.98,s*R*.7,t*R*.5])],40,5,{caps:null}));sc.add('magnifier',merge(lines),{color:0x9fb3c9,opacity:.5,roughness:.5});
    sc.add('tonoplast',S.transform(S.superellipsoid([R,15,R*.75],.25,48,12),p=>toW(p)),{color:C.tail,roughness:.6});for(const y of[-18,18])sc.add('tonoplast',S.transform(S.superellipsoid([R+2,4,R*.75+2],.25,48,8),p=>toW([p[0],p[1]+y,p[2]])),{color:C.head,roughness:.55});
    const vat=await pdbSurface('3J9T',{spacing:sc.res(3,4),keepV1Down:true});sc.add('proton-pump',S.transform(vat,p=>toW([p[0]-90,p[1],p[2]])),{colorFn:p=>(p[1]-O[1])/M<-22?C.vatp1:C.vatp0,roughness:.5,budget:{desktop:60000,touch:22000}});
    const pp=await pdbSurface('4A01',{spacing:sc.res(2.5,3.5)});for(const [x,z,a] of[[150,60,.4],[175,-120,2.1]])sc.add('proton-pump',S.transform(pp,p=>toW(add(S.spinner([0,1,0],a)(p),[x,0,z]))),{color:C.ppase,roughness:.5,budget:{desktop:18000,touch:7000}});
    const H=[];for(let i=0;i<sc.res(140,90);i++)H.push(toW([(rand()*2-1)*R*.95,26+rand()*60,(rand()*2-1)*R*.7]));for(let i=0;i<14;i++)H.push(toW([(rand()*2-1)*R*.95,-26-rand()*60,(rand()*2-1)*R*.7]));dots(sc,'lumen',H,4.5*M,C.proton,{sub:1});
  }};


// ── Smooth ER (hepatocyte) ─────────────────────────────────────────────────────────────────────────────────────
// A tubular network (~50–70 nm tubules, three-way junctions) beside glycogen rosettes, as in liver cells, cut along
// z = 0; continuous at one edge with a rough ER sheet.
RECIPES['smooth-er']={version:'r2',seed:83,mottleScale:200,occupancyCells:140,
  notes:'Modelo autoral em 3D de retículo endoplasmático liso de um hepatócito (região de cerca de 2,4 × 1,5 µm), aberto ao meio: uma rede de túbulos (50–70 nm de diâmetro) unidos em junções de três vias, contínua com uma cisterna de retículo rugoso à esquerda. Na superfície ficam enzimas de transformação de compostos (citocromos P450, pontos verdes) e de síntese de lipídios (laranja), com gotículas de lipídio brotando da membrana; dentro dos túbulos, íons Ca²⁺ armazenados (vermelho) bombeados pela SERCA (azul). Junto à rede, rosetas de glicogênio, cuja glicose-6-fosfato é convertida em glicose pela glicose-6-fosfatase do retículo (amarelo). Os fosfolipídios recém-produzidos aparecem como moléculas ampliadas (cerca de 4×) inseridas na membrana. Enzimas, íons e moléculas estão ampliados e em número ilustrativo.',
  credits:[authored('Geometria modelada a partir de dimensões publicadas do retículo liso de hepatócitos (túbulos de ~50–70 nm, rosetas de glicogênio de ~100–200 nm).')],
  async scene(sc){
    const rand=rng(89),C={er:0x8fcc4a,rer:0x5aa0d6,ribo:0x2f4f8f,p450:0x3fae5a,lipidEnz:0xe0866a,droplet:0xf0d36a,ca:0xe0473f,serca:0x5a7fe0,glycogen:0xe9e2c8,g6p:0xf2c230,glucose:0xffffff,head:0xe3c08a,tail:0xf2e2a8};
    const box=[1250,700,520],pts=[];for(let t=0;t<20000&&pts.length<sc.res(170,120);t++){const p=[(rand()*2-1)*box[0]+150,(rand()*2-1)*box[1],-rand()*box[2]*2+180];if(pts.every(q=>len(sub(p,q))>150))pts.push(p)}
    const edges=new Set();pts.forEach((p,i)=>{const near=pts.map((q,j)=>[len(sub(p,q)),j]).filter(([d,j])=>j!==i&&d<330).sort((a,b)=>a[0]-b[0]).slice(0,3);for(const [,j] of near)edges.add(i<j?i+'_'+j:j+'_'+i)});
    const tubes=[],ca=[],p450=[],serca=[],lipEnz=[],r=30;
    for(const e of edges){const [i,j]=e.split('_').map(Number),a=pts[i],b=pts[j],mid=add(lerp(a,b,.5),mul(randDir(rand),40));tubes.push(S.tube(S.spline([a,mid,b],8),r*(.85+rand()*.3),sc.res(10,7),{caps:null}));
      for(let k=0;k<3;k++){const t=rand(),c=lerp(lerp(a,mid,t),lerp(mid,b,t),t),d=randDir(rand);p450.push(add(c,mul(d,r+5)));if(rand()<.5)serca.push(add(c,mul(randDir(rand),r+5)));if(rand()<.35)lipEnz.push(add(c,mul(randDir(rand),r+6)));if(c[2]<-4&&c[2]>-60)ca.push(add(c,mul(randDir(rand),r*.5)))}}
    for(const p of pts)tubes.push(S.transform(S.icosphere(r*1.25,1),q=>add(q,p)));
    sc.add('tubular-membrane',S.clip(merge(tubes),[0,0,1],0),{color:C.er,roughness:.5});
    // Rough ER sheet at the left edge, continuous with the tubules, ribosomes on its cytosolic faces.
    const sheet=S.transform(S.superellipsoid([90,560,480],.3,sc.res(16,10),sc.res(30,18)),p=>add(p,[-1250,0,-300]));sc.add('rough-er-context',S.clip(sheet,[0,0,1],0),{color:C.rer,roughness:.5});
    const rb=[];for(let i=0;i<sc.res(260,140);i++){const s=rand()<.5?-1:1;rb.push([-1250+s*(95+12),(rand()*2-1)*520,-rand()*780])}dots(sc,'rough-er-context',rb,12,C.ribo);
    for(let k=0;k<6;k++){const near=pts.filter(p=>p[0]<-850).sort(()=>rand()-.5)[k];if(near)sc.add('tubular-membrane',S.clip(S.tube([[-1160,near[1]*.8,near[2]],near],r,sc.res(10,7),{caps:null}),[0,0,1],0),{color:C.er,roughness:.5})}
    dots(sc,'detoxification',p450.filter(p=>p[2]<0),7,C.p450,{sub:1});dots(sc,'calcium-store',ca,8,C.ca,{sub:1});dots(sc,'calcium-store',serca.filter(p=>p[2]<0).filter((_,i)=>i%2===0),8,C.serca,{sub:1});
    dots(sc,'lipid-synthesis',lipEnz.filter(p=>p[2]<0),8,C.lipidEnz,{sub:1});
    for(const i of[7,31,58]){const p=pts[i%pts.length],d=norm([rand()-.5,.7,-.4]);sc.add('lipid-synthesis',S.transform(S.icosphere(95+rand()*40,sc.res(3,2)),q=>add(q,add(p,mul(d,r+70)))),{color:C.droplet,roughness:.3})}
    // Glycogen rosettes (alpha particles made of beta particles) among the tubules; glucose-6-phosphatase nearby.
    const gly=[],g6p=[],glc=[];for(let n=0;n<sc.res(22,14);n++){let c=null;for(let t=0;t<300&&!c;t++){const q=[(rand()*2-1)*box[0]+150,(rand()*2-1)*box[1],-rand()*box[2]*2+100];if(pts.every(p=>len(sub(p,q))>120)&&q[2]<-60)c=q}if(!c)continue;
      for(let a=0;a<6+Math.floor(rand()*5);a++){const ac=add(c,mul(randDir(rand),45+rand()*35));for(let b=0;b<sc.res(9,5);b++)gly.push(add(ac,mul(randDir(rand),14+rand()*10)))}
      const near=pts.reduce((m,p)=>len(sub(p,c))<len(sub(m,c))?p:m,pts[0]);for(let k=0;k<3;k++)g6p.push(add(near,mul(randDir(rand),r+6)));for(let k=0;k<4;k++)glc.push(add(lerp(near,c,rand()),mul(randDir(rand),40)))}
    dots(sc,'hepatic-glucose',gly,sc.res(13,15),C.glycogen,{sub:1});dots(sc,'hepatic-glucose',g6p,9,C.g6p,{sub:1});dots(sc,'hepatic-glucose',glc,6,C.glucose,{sub:0});
    // New phospholipids (about 4× enlarged): head sphere and two tails, inserted along one tubule.
    const ph=[];const host=pts.filter(p=>p[2]<-80&&p[2]>-260).slice(0,3);for(const p of host)for(let k=0;k<10;k++){const d=randDir(rand),hd=add(p,mul(d,r+26));ph.push(S.transform(S.icosphere(7,1),q=>add(q,hd)));for(const s of[-1,1]){const side=mul(norm(cross(d,[0,1,0])),s*5);ph.push(S.tube([add(hd,side),add(add(hd,side),mul(d,-24))],2.6,5,{caps:'round',capRings:1}))}}
    sc.add('phospholipid',merge(ph),{colorFn:p=>0xe3c08a,roughness:.5});
  }};
// ── Lysosome and autophagy ─────────────────────────────────────────────────────────────────────────────────────
RECIPES['lysosome-autophagy']={version:'r2',seed:97,mottleScale:200,occupancyCells:140,
  notes:'Modelo autoral em 3D da autofagia e da digestão lisossômica (região de cerca de 3 µm), aberto ao meio. Da esquerda para a direita: o fagóforo, membrana dupla em forma de taça envolvendo parte do citoplasma (um pedaço de mitocôndria e ribossomos); o autofagossomo já fechado, com membrana dupla; um lisossomo, com membrana simples, lúmen ácido (H⁺) e hidrolases, fundindo-se ao autofagossomo; e o autolisossomo, onde a carga é degradada e de onde moléculas pequenas (aminoácidos, açúcares, nucleotídeos) saem por transportadores da membrana para o citosol. Tamanhos de 0,5–1,5 µm aproximados; enzimas, íons e moléculas ampliados e em número ilustrativo.',
  credits:[authored('Geometria modelada a partir de dimensões publicadas (autofagossomos de 0,5–1,5 µm, lisossomos de 0,1–1 µm).')],
  async scene(sc){
    const rand=rng(101),h=sc.res(7,7),T=7,cutZ=f=>p=>Math.min(f(p),-p[2]),sph=(p,c,r)=>r-len(sub(p,c));
    const C={phago:0xd9a35a,auto:0xc98f4a,lyso:0xb07fd0,lumen:0x6a4f8a,hyd:0xf2c230,proton:0xe0473f,mito:0xe58a52,cristae:0xa8321f,ribo:0x3f5fa8,remnant:0x8a6a7a,mono:[0x56b5a4,0xe0b24f,0x7a8fd6],transporter:0x56b5a4};
    const shellOf=(f,lo,hi,step=h)=>S.implicit(cutZ(p=>{const v=f(p);return Math.min(v+T,T-v)}),lo,hi,step);
    // Phagophore: double membrane cup open towards +x.
    const P={c:[-1300,80,0],r:420},cup=p=>{const v=sph(p,P.c,P.r),open=(p[0]-P.c[0])-P.r*.55;return Math.min(Math.max(v,-(v+40)),-open)};
    sc.add('autophagosome',S.implicit(cutZ(p=>{const v=sph(p,P.c,P.r);const open=P.r*.55-(p[0]-P.c[0]);return Math.min(Math.min(v+T,T-v),open)}),[-1800,-400,-500],[-800,560,10],h),{color:C.phago,roughness:.55,budget:{desktop:20000,touch:8000}});
    sc.add('autophagosome',S.implicit(cutZ(p=>{const v=sph(p,P.c,P.r-36);const open=P.r*.5-(p[0]-P.c[0]);return Math.min(Math.min(v+T,T-v),open)}),[-1800,-400,-500],[-800,560,10],h),{color:C.phago,roughness:.55,budget:{desktop:20000,touch:8000}});
    // Autophagosome (closed, double) touching a lysosome that fuses with it.
    const A={c:[-380,-60,0],r:400},L={c:[200,-380,-60],r:230};
    sc.add('autophagosome',shellOf(p=>smax(sph(p,A.c,A.r),sph(p,L.c,L.r),60)-0,[-820,-640,-480],[460,380,10]),{color:C.auto,roughness:.55,budget:{desktop:30000,touch:12000}});
    sc.add('autophagosome',shellOf(p=>sph(p,A.c,A.r-36),[-820,-500,-480],[60,380,10]),{color:C.auto,roughness:.55,budget:{desktop:20000,touch:8000}});
    sc.add('lysosomal-membrane',shellOf(p=>sph(p,L.c,L.r)-0.1,[-60,-640,-320],[460,-120,10]),{color:C.lyso,roughness:.5,budget:{desktop:12000,touch:5000}});
    sc.add('acid-lumen',S.implicit(cutZ(p=>sph(p,L.c,L.r-T-2)),[-60,-640,-320],[460,-120,10],h*1.4),{color:C.lumen,opacity:.5,roughness:.35,budget:{desktop:5000,touch:2500}});
    // Cargo: a piece of mitochondrion and ribosomes in the phagophore and in the autophagosome.
    for(const [c,R] of[[P.c,300],[A.c,280]]){const ax=norm([rand()-.5,rand()-.5,0]);sc.add('autophagosome',S.clip(S.tube([sub(c,mul(ax,R*.6)),add(c,mul(ax,R*.6))],120,sc.res(14,10),{caps:'round'}),[0,0,1],0),{color:C.mito,roughness:.5});
      const ri=[];for(let i=0;i<sc.res(50,30);i++){const p=add(c,mul(randDir(rand),R*rand()));if(p[2]<-5)ri.push(p)}dots(sc,'autophagosome',ri,12,C.ribo)}
    // Autolysosome: single membrane, cargo being digested (irregular remnants), hydrolases, transporters releasing monomers.
    const AL={c:[1000,120,0],r:480},nb=fbm(41,3);
    sc.add('autolysosome',shellOf(p=>sph(p,AL.c,AL.r)+10*nb(p[0]/120,p[1]/120,p[2]/120),[480,-400,-520],[1520,640,10]),{color:C.lyso,roughness:.5,budget:{desktop:24000,touch:10000}});
    sc.add('acid-lumen',S.implicit(cutZ(p=>sph(p,AL.c,AL.r-T-12)),[480,-400,-520],[1520,640,10],h*1.4),{color:C.lumen,opacity:.4,roughness:.35,budget:{desktop:6000,touch:3000}});
    const rem=[];for(let i=0;i<7;i++){const c=add(AL.c,mul(randDir(rand),rand()*260)),R=40+rand()*70;rem.push(S.transform(S.icosphere(R,2,q=>.35*nb(q[0]*3+i,q[1]*3,q[2]*3)),q=>add(q,c)))}sc.add('autolysosome',S.clip(merge(rem),[0,0,1],0),{color:C.remnant,roughness:.6});
    const hyd=[],H=[];for(const [c,R] of[[L.c,L.r-30],[AL.c,AL.r-40]])for(let i=0;i<sc.res(70,40);i++){const p=add(c,mul(randDir(rand),R*Math.cbrt(rand())));if(p[2]<-5)(i%3?hyd:H).push(p)}dots(sc,'hydrolases',hyd,10,C.hyd,{sub:1});dots(sc,'acid-lumen',H,7,C.proton,{sub:1});
    const tr=[],mono=[[],[],[]];for(let i=0;i<10;i++){const d=norm([rand()*.6+.4,rand()*2-1,-rand()*.8]),p=add(AL.c,mul(d,AL.r));tr.push(S.ring(p,d,14,6,10,5));for(let k=0;k<6;k++)mono[k%3].push(add(p,mul(d,40+k*45+rand()*30)))}
    sc.add('recycled-monomers',merge(tr),{color:C.transporter,roughness:.45});mono.forEach((list,k)=>dots(sc,'recycled-monomers',list,11,C.mono[k],{sub:1}));
  }};

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const ids=process.argv.slice(2);if(!ids.length){console.log('Receitas: '+Object.keys(RECIPES).join(', '));process.exit(0)}
  for(const id of ids)await build(id);
}
