// Organelles at cell scale (nm) for the authored models of build-cells.mjs. Each helper adds meshes to a scene
// (sc.add) and supports a cut at the plane z = 0 (the far half stays, membranes show their rims on the plane).
import {merge} from './mesh.mjs';
import * as S from './shapes.mjs';
const {add,sub,mul,dot,cross,len,norm,lerp,clamp,noise,fbm}=S;

export const HALF={theta0:Math.PI,theta1:Math.PI*2};
// Thylakoid sizes (nm): ~21 nm repeat measured in the spinach tomograms of EMPIAR-12612.
export const THY={membrane:5,lumen:6,repeat:21};
export function thylakoidProfile(R,h){const pts=[[0,h],[R*.5,h],[R-h,h]];for(let k=1;k<6;k++){const a=Math.PI/2-k/6*Math.PI;pts.push([R-h+Math.cos(a)*h,Math.sin(a)*h])}pts.push([R-h,-h],[R*.5,-h],[0,-h]);return pts}
export const byIndex=pts=>v=>pts[Math.round(v*(pts.length-1))];
/** Local frame → world: local x = t, local y = n, local z = t × n, centred at `at`. */
export const frameOf=(t,n,at)=>{const b=cross(t,n);return p=>add(at,add(add(mul(t,p[0]),mul(n,p[1])),mul(b,p[2])))};
/** Frame for an organelle lying on the cut plane: local y = n (projected on the xy plane), local z = world z. */
export const cutFrame=(n,at)=>{const y=norm([n[0],n[1],0]);return frameOf(cross(y,[0,0,1]),y,at)};
export function dots(sc,part,points,r,color,{sub:s=0,roughness=.55}={}){const base=S.icosphere(r,s),list=[];for(const p of points)list.push(S.transform(base,q=>add(q,p)));if(list.length)sc.add(part,merge(list),{color,roughness})}

/** One granum: stacked thylakoid discs; when cut, the far half with both membranes and the lumen on the plane. */
export function granum(sc,{at,radius,discs,rand,cut,colors,part='granum',lumenPart='thylakoid-lumen',post=p=>p,res=null}){
  const n=noise(Math.floor(rand()*1e6)),h=(THY.membrane*2+THY.lumen)/2,nu=res||(cut?sc.res(30,18):sc.res(26,16)),tilt=[(rand()-.5)*.06,1,(rand()-.5)*.06];
  for(let d=0;d<discs;d++){const y=(d-(discs-1)/2)*THY.repeat,R=radius*(1+(rand()-.5)*.08)*(d===0||d===discs-1?.94:1),off=[(rand()-.5)*14,0,(rand()-.5)*14],seed=d*1.7;
    const k=th=>1+.045*n(Math.cos(th)*1.3+seed,Math.sin(th)*1.3,seed)+.02*n(Math.cos(th)*4+seed,Math.sin(th)*4,seed+3);
    const prof=thylakoidProfile(R,h),pl=byIndex(prof),pl0=S.placer({at:add(add(at,off),[0,y,0]),axis:tilt}),place=q=>post(pl0(q));
    if(!cut){sc.add(part,S.transform(S.lathe(pl,nu,prof.length-1,{radius:th=>k(th)}),place),{color:colors.granum,roughness:.5});continue}
    const shell=S.lathe(pl,nu,prof.length-1,{theta0:Math.PI,theta1:Math.PI*2,radius:th=>k(th),thickness:THY.membrane,rims:{u0:true,u1:true,v0:false,v1:false}});
    sc.add(part,S.transform(shell,place),{color:colors.granum,roughness:.5});
    const lum=thylakoidProfile(R-THY.membrane,h-THY.membrane),ll=byIndex(lum);
    for(const th of[Math.PI,Math.PI*2])sc.add(lumenPart,S.transform(S.latheCap(ll,th,lum.length-1,{radius:t=>k(t)}),place),{color:colors.lumen,roughness:.45,ao:false,mottle:0});
  }
}

/** Nucleus with a double envelope (far half when cut), pore complexes, nucleolus and chromatin. */
export function nucleus(sc,{at,r,rand,C,part='nucleus',parts={},cut=true,pores:poreCount=null}){
  const P={envelope:part,pores:part,nucleolus:part,chromatin:part,euchromatin:part,...parts},T=p=>add(p,at),b=fbm(Math.floor(rand()*1e4),3),sz=Math.max(...r),bump=p=>.025*b(p[0]/(sz*.4),p[1]/(sz*.4),p[2]/(sz*.4)),th=cut?HALF:{};
  const [nu,nv]=[sc.res(96,56),sc.res(64,36)],gap=Math.min(95,sz*.02);
  sc.add(P.envelope,S.transform(S.ellipsoid(r,nu,nv,{...th,thickness:gap*.42,bump}),T),{color:C.envelope,roughness:.5});
  sc.add(P.envelope,S.transform(S.ellipsoid(r.map(v=>v-gap),nu,nv,{...th,thickness:gap*.42,bump}),T),{color:C.envelope2??C.envelope,roughness:.5});
  // Pore complexes: rings through both membranes with a central plug, spread over the visible envelope.
  const n=poreCount??sc.res(300,160),pores=[];for(let i=0;i<n*2.2&&pores.length<n;i++){const y=1-(i+.5)/(n*2.2)*2,rr=Math.sqrt(1-y*y),ph=i*2.39996,d=[rr*Math.cos(ph),y,rr*Math.sin(ph)];if(cut&&d[2]>-.06)continue;
    const q=[d[0]*r[0],d[1]*r[1],d[2]*r[2]],k=1+bump(q),nrm=norm([d[0]/r[0],d[1]/r[1],d[2]/r[2]]);pores.push({p:T(add(mul(q,k),mul(nrm,-gap*.48))),n:nrm})}
  const pr=Math.min(62,sz*.012),ringM=S.ring([0,0,0],[0,1,0],pr,pr*.38,sc.res(8,6),sc.res(5,4)),plug=S.icosphere(pr*.36,0),list=[];
  for(const {p,n:nn} of pores){const rot=S.aligner([0,1,0],nn);list.push(S.transform(ringM,q=>add(rot(q),p)),S.transform(plug,q=>add(q,p)))}if(list.length)sc.add(P.pores,merge(list),{color:C.pore,roughness:.45});
  // Nucleolus behind the cut plane, lumpy; heterochromatin pressed against the envelope and around the nucleolus.
  const nb=fbm(Math.floor(rand()*1e4),4),ncen=add(at,[r[0]*.18,-r[1]*.1,-Math.min(r[2]*.45,r[0]*.4)]),nr=Math.min(...r)*.36;
  sc.add(P.nucleolus,S.transform(S.icosphere(nr,sc.res(4,3),p=>.12*nb(p[0]*2.2,p[1]*2.2,p[2]*2.2)),q=>add(q,ncen)),{color:C.nucleolus,roughness:.6});
  const hb=fbm(Math.floor(rand()*1e4),3),patches=[],ps=sz/4000;for(let i=0;i<sc.res(46,28);i++){const ph=rand()*Math.PI*2,y=rand()*2-1,rr=Math.sqrt(1-y*y),d=[rr*Math.cos(ph),y,rr*Math.sin(ph)];if(cut&&d[2]>-.15)continue;
    const nrm=norm([d[0]/r[0],d[1]/r[1],d[2]/r[2]]),q=[d[0]*(r[0]-260*ps),d[1]*(r[1]-260*ps),d[2]*(r[2]-260*ps)],s=(380+rand()*520)*ps,rot=S.aligner([0,1,0],nrm);
    patches.push(S.transform(S.icosphere(1,sc.res(2,1),p=>.22*hb(p[0]*3+i,p[1]*3,p[2]*3)),p=>add(rot([p[0]*s,p[1]*s*.32,p[2]*s]),T(q))))}
  for(let i=0;i<5;i++){const d=norm([rand()-.5,rand()-.5,rand()-.5]);patches.push(S.transform(S.icosphere(1,sc.res(2,1),p=>.25*hb(p[0]*3,p[1]*3+i,p[2]*3)),p=>add(mul(p,nr*.45),add(ncen,mul(d,nr*1.05)))))}
  sc.add(P.chromatin,merge(patches),{color:C.chromatin,roughness:.65});
  // Euchromatin: loose fibres through the nucleoplasm (illustrative paths).
  const inside=p=>S.superLevel(sub(p,at),r.map(v=>v-350*ps),1)<1&&(!cut||p[2]<at[2]-120*ps)&&len(sub(p,ncen))>nr+120*ps;
  for(let f=0;f<sc.res(9,5);f++){let st=null;for(let t=0;t<200&&!st;t++){const c=add(at,[(rand()-.5)*r[0],(rand()-.5)*r[1],-rand()*r[2]*.8]);if(inside(c))st=c}if(!st)continue;
    const path=S.walk(st,sc.res(200,110),110*ps,inside,rand,{persistence:.8});if(path.length>8)sc.add(P.euchromatin,S.tube(S.spline(path,Math.round(path.length*1.5)),36*ps,sc.res(5,4),{caps:'round',capRings:1}),{color:C.euchromatin,roughness:.6})}
  return{pores,nucleolus:{at:ncen,r:nr}};
}
/** Chloroplast at cell scale: lens with an envelope; when cut, the far half is open with grana and starch. */
export function chloroplastMini(sc,{place,scale=1,cut,rand,C,part='chloroplast',grana=6}){
  const A=[2500*scale,850*scale,1350*scale],b=fbm(Math.floor(rand()*1e4),3),bump=p=>.04*b(p[0]/1500,p[1]/1500,p[2]/1500);
  if(!cut){sc.add(part,S.transform(S.ellipsoid(A,sc.res(30,18),sc.res(18,10),{bump}),place),{color:C.chloroplast,roughness:.5});return}
  sc.add(part,S.transform(S.ellipsoid(A,sc.res(56,30),sc.res(32,18),{...HALF,thickness:40,bump}),place),{color:C.chloroplastEnv,roughness:.5});
  sc.add(part,S.transform(S.ellipsoid(A.map(v=>v-110),sc.res(40,24),sc.res(24,14),{...HALF,bump}),place),{color:C.stroma,roughness:.7});
  const placed=[];for(let t=0;t<300&&placed.length<grana;t++){const x=(rand()*2-1)*A[0]*.72,z=t<120?0:-rand()*A[2]*.6,radius=(200+rand()*70)*Math.min(1,scale),hy=A[1]*Math.sqrt(Math.max(0,1-(x/(A[0]-radius))**2-(z/(A[2]-radius))**2))-110;if(hy<90)continue;
    if(placed.some(g=>Math.hypot(g.at[0]-x,g.at[2]-z)<g.radius+radius+80))continue;const discs=Math.max(4,Math.min(Math.floor(hy*2/THY.repeat),4+Math.floor(rand()*5)));placed.push({at:[x,(rand()-.5)*Math.max(0,hy*2-discs*THY.repeat)*.6,z],radius,discs,cut:z===0})}
  for(const g of placed)granum(sc,{...g,rand,colors:{granum:C.granum,lumen:C.lumen},part,lumenPart:part,post:place,res:sc.res(14,9)});
  sc.add(part,S.transform(S.ellipsoid([380*scale,230*scale,300*scale],sc.res(20,12),sc.res(12,8),HALF),p=>place(add(p,[A[0]*.45,0,-150]))),{color:C.starch,roughness:.75});
}
/** Mitochondrion at cell scale: a bent capsule; when cut, open with the inner membrane and cristae. */
export function mitochondrionMini(sc,{place,length,radius,cut,rand,C,part='mitochondria'}){
  const ctrl=[0,1,2,3].map(k=>[(k/3-.5)*length,(rand()-.5)*radius*.8,(rand()-.5)*radius*.4]),path=S.spline(ctrl,sc.res(16,10)),toW=m=>S.transform(m,place);
  if(!cut){sc.add(part,toW(S.tube(path,radius,sc.res(12,8),{caps:'round',capRings:sc.res(3,2)})),{color:C.mito,roughness:.5});return}
  const clipZ=m=>S.clip(m,[0,0,1],0);
  sc.add(part,clipZ(toW(S.tube(path,radius,sc.res(20,12),{caps:'round',capRings:3}))),{color:C.mito,roughness:.5});
  sc.add(part,clipZ(toW(S.tube(path,radius-28,sc.res(20,12),{caps:'round',capRings:3}))),{color:C.mitoInner??C.mito,roughness:.5});
  for(let x=-length/2+radius*.6;x<length/2-radius*.6;x+=110+rand()*60){const k=Math.max(0,Math.min(path.length-1,Math.round((x/length+.5)*(path.length-1)))),c=path[k];
    sc.add(part,clipZ(toW(S.transform(S.superellipsoid([14,radius*.72,radius*.72],.6,10,8),p=>add(S.spinner([1,0,0],rand()*3)(p),[c[0],c[1]+(rand()-.5)*radius*.3,c[2]])))),{color:C.cristae??C.mito,roughness:.5})}
}
/** Stack of curved cisternae (dictyosome) with vesicles at the rims and the trans face. */
export function golgiStack(sc,{place,rand,C,part='golgi',size=1,colors=null,cisternae=6}){const n=cisternae,R0=480*size,curvR=2600*size,gap=48*Math.sqrt(size);
  for(let i=0;i<n;i++){const R=R0*(.82+.3*Math.sin((i+.5)/n*Math.PI))*(1+(rand()-.5)*.08),h=13*Math.sqrt(size),prof=thylakoidProfile(R,h).map(([r,y])=>[r,y-r*r/(2*curvR)+(i-(n-1)/2)*gap]);
    const bn=noise(i+7),rad=th=>1+.06*bn(Math.cos(th)*2,Math.sin(th)*2,i);sc.add(part,S.transform(S.lathe(byIndex(prof),sc.res(28,16),prof.length-1,{radius:rad}),place),{color:colors?colors[i]:C.golgi,roughness:.45})}
  const ves=[];for(let k=0;k<sc.res(26,16);k++){const a=rand()*Math.PI*2,rr=R0*(.9+rand()*.35),y=(rand()-.5)*gap*5-60;ves.push(place([Math.cos(a)*rr,y-rr*rr/(2*curvR),Math.sin(a)*rr]))}
  for(let k=0;k<sc.res(10,6);k++){const a=rand()*Math.PI*2,rr=rand()*R0*.7;ves.push(place([Math.cos(a)*rr,-(n/2)*gap-80-rand()*120-rr*rr/(2*curvR),Math.sin(a)*rr]))}dots(sc,part,ves,32*Math.sqrt(size),C.golgiVesicle??C.golgi,{sub:1});
}
/** Rough ER: sheets parallel to the nuclear envelope, with ribosomes on the cytosolic face. */
export function roughERSheets(sc,{at,r,rand,C,part='rough-er',riboPart=part,layers=4,window=[Math.PI*1.05,Math.PI*1.95],step=330,riboSize=null,density=null}){
  const b=fbm(Math.floor(rand()*1e4),3),ribo=[];
  for(let L=0;L<layers;L++){const off=300+L*step,R=r.map(v=>v+off),t0=window[0]+rand()*.3,t1=window[1]-rand()*.3,p0=-1.1+rand()*.4,p1=1.1-rand()*.4;
    const fn=(u,v)=>{const th=t0+(t1-t0)*u,ph=p0+(p1-p0)*v,d=[Math.cos(ph)*Math.cos(th),Math.sin(ph),Math.cos(ph)*Math.sin(th)],k=1+.05*b(d[0]*3+L,d[1]*3,d[2]*3);return add(at,[d[0]*R[0]*k,d[1]*R[1]*k,d[2]*R[2]*k])};
    sc.add(part,S.surface(fn,sc.res(40,22),sc.res(26,14),{thickness:55}),{color:C.er,roughness:.5});
    const area=(t1-t0)*(p1-p0)*R[0]*R[1],count=Math.round(area/(density??sc.res(9000,26000)));for(let i=0;i<count;i++){const p=fn(rand(),rand()),o=norm(sub(p,at));ribo.push(add(p,mul(o,rand()<.5?30:-85)))}}
  dots(sc,riboPart,ribo,riboSize??sc.res(24,30),C.ribosome);
}
