// Chromosomes, spindles and cells for the division views (mitosis, meiosis, cell cycle, gametogenesis), in nm.
// Chromatids are tubes with a lumpy surface (fibre texture), sisters joined at a pinched centromere with kinetochores.
import {merge} from './mesh.mjs';
import * as S from './shapes.mjs';
const {add,sub,mul,dot,cross,len,norm,lerp,clamp,noise,fbm}=S;

const perp=(a,hint=[0,1,0])=>norm(Math.abs(dot(norm(a),hint))>.9?cross(a,[1,0,0]):cross(a,hint));
/** Lumpy cross-section: radius scale from angle and position along the chromatid (fibre loops). */
const lumps=seed=>{const n=fbm(seed,3);return(a,t)=>1+.13*n(Math.cos(a)*1.6+t*14,Math.sin(a)*1.6,t*9+seed)};
export function chromatid(path,r,res,seed,{pinchAt=null}={}){const rr=t=>{let k=1;if(pinchAt!=null){const d=(t-pinchAt)/.07;k=1-.32*Math.exp(-d*d)}return r*k*(1-.25*Math.max(0,Math.abs(t-.5)*2-.85)/.15)};return S.tube(S.spline(path,res.len),rr,res.sides,{caps:'round',capRings:2,section:lumps(seed)})}
/**
 * Duplicated chromosome (two sister chromatids): arms along `arm` (p-arm length pL, q-arm qL), sisters side by side
 * along `sister` (towards the poles). Returns kinetochore positions and outward directions.
 */
export function chromosome(sc,part,{at,arm,sister,pL,qL,r=330,res,rand,color,kColor=0xe0473f,kPart=null,bend=.25,colors=null,coil=0}){
  const a=norm(arm),s=norm(sister),w=norm(cross(a,s)),seed=Math.floor(rand()*1e5),bn=noise(seed),kin=[];
  for(const side of[-1,1]){const pts=[];const N=9;for(let i=0;i<=N;i++){const t=i/N,x=-pL+(pL+qL)*t,c=Math.abs(x)/Math.max(pL,qL),gap=r*(.62+.5*Math.min(1,Math.abs(x)/(r*2.2)))*side;
      pts.push(add(at,add(add(mul(a,x),mul(s,gap)),mul(w,bend*r*Math.sin(t*Math.PI)*2+r*.6*bn(t*3,side,0)+(coil?Math.sin(t*coil)*r*.8:0)))))}
    const m=chromatid(pts,r,res,seed+side,{pinchAt:pL/(pL+qL)});sc.add(part,m,{color:(colors?colors[side<0?0:1]:color),roughness:.7,colorFn:colors&&colors.fn?colors.fn(side):null});
    const k=add(at,mul(s,side*(r*1.25)));kin.push({p:k,dir:mul(s,side)})}
  for(const k of kin)sc.add(kPart||part,S.transform(S.superellipsoid([r*.55,r*.18,r*.55],.6,10,6),p=>add(S.aligner([0,1,0],k.dir)(p),k.p)),{color:kColor,roughness:.5});
  return kin;
}
/** Single chromatid moving to a pole (anaphase): centromere leads, arms trail behind. */
export function singleChromatid(sc,part,{centromere,toPole,arm,pL,qL,r=330,res,rand,color,kColor=0xe0473f,kPart=null,drag=.55,colorFn=null}){
  const d=norm(toPole),a=norm(sub(arm,mul(d,dot(arm,d)))),seed=Math.floor(rand()*1e5),bn=noise(seed),pts=[];const N=9;
  for(let i=0;i<=N;i++){const t=i/N,x=-pL+(pL+qL)*t,lag=Math.abs(x)*drag;pts.push(add(centromere,add(add(mul(a,x*(1-drag*.35)),mul(d,-lag)),mul(norm(cross(a,d)),r*.7*bn(t*3,0,1)))))}
  sc.add(part,chromatid(pts,r,res,seed,{pinchAt:pL/(pL+qL)}),{color,roughness:.7,colorFn});
  const k=add(centromere,mul(d,r*.9));sc.add(kPart||part,S.transform(S.superellipsoid([r*.5,r*.17,r*.5],.6,10,6),p=>add(S.aligner([0,1,0],d)(p),k)),{color:kColor,roughness:.5});return{p:k,dir:d};
}
/** Decondensed chromatin: fibres wandering inside an ellipsoid (interphase nuclei). */
export function chromatinTangle(sc,part,{at,r,res,rand,color,fibres=6,steps=120,step=180,radius=55}){const inside=p=>Math.hypot((p[0]-at[0])/r[0],(p[1]-at[1])/r[1],(p[2]-at[2])/r[2])<.92;
  for(let f=0;f<fibres;f++){const st=add(at,[(rand()-.5)*r[0],(rand()-.5)*r[1],(rand()-.5)*r[2]]);if(!inside(st))continue;const path=S.walk(st,steps,step,inside,rand,{persistence:.78});if(path.length>6)sc.add(part,S.tube(S.spline(path,Math.round(path.length*1.4)),radius,res.sides>6?6:4,{caps:'round',capRings:1}),{color,roughness:.65})}}
/** Microtubules: thin tubes (radius enlarged to stay visible at cell scale). */
export function microtubules(sc,part,lines,{r=32,color=0x9fd8a8,sides=4}){const list=[];for(const pts of lines)list.push(S.tube(pts.length>2?S.spline(pts,8):pts,r,sides,{caps:null}));if(list.length)sc.add(part,merge(list),{color,roughness:.5})}
/** Centrosome: two orthogonal centrioles (nine triplet blades each) in a cloud of pericentriolar material. */
export function centrosome(sc,part,{at,axis=[0,1,0],scale=2.5,rand,color=0xf2c230,pcm=0xf6e2a0,res}){const ax=norm(axis),ax2=perp(ax),L=480*scale,R=110*scale,parts=[];
  for(const [dir,off] of[[ax,[0,0,0]],[ax2,mul(perp(ax2,ax),R*1.6)]]){const u=perp(dir),v=cross(dir,u),base=add(at,off);
    for(let k=0;k<9;k++){const a=k/9*Math.PI*2,c=add(base,add(mul(u,Math.cos(a)*R),mul(v,Math.sin(a)*R))),t=norm(add(mul(u,-Math.sin(a)),mul(v,Math.cos(a)))),tw=norm(add(t,mul(sub(c,base),-.6/R)));
      parts.push(S.transform(S.superellipsoid([L/2,R*.18,R*.42],.5,8,6),p=>{const q=[p[0],p[1],p[2]],x=mul(dir,q[0]),y=mul(norm(sub(c,base)),q[1]),z=mul(tw,q[2]);return add(c,add(add(x,y),z))}))}}
  sc.add(part,merge(parts),{color,roughness:.45});
  const b=fbm(Math.floor(rand()*1e4),3);sc.add(part,S.transform(S.icosphere(R*3.2,res?.pcm??2,p=>.18*b(p[0]*2,p[1]*2,p[2]*2)),p=>add(p,at)),{color:pcm,opacity:.35,roughness:.6});
}
/** Spindle between two poles: kinetochore fibres, overlapping polar fibres and astral rays. */
export function spindle(sc,part,{poles,kinetochores=[],polar=24,astral=18,cellR,center=null,rand,color,r=30}){const lines=[];const [P1,P2]=poles,axis=norm(sub(P2,P1)),L=len(sub(P2,P1)),u=perp(axis),v=cross(axis,u);
  for(const k of kinetochores){const pole=dot(k.dir,axis)<0?P1:P2;for(let i=0;i<3;i++){const j=add(k.p,add(mul(u,(rand()-.5)*120),mul(v,(rand()-.5)*120)));lines.push([pole,lerp(pole,j,.5),j])}}
  for(let i=0;i<polar;i++){const from=i%2?P1:P2,dir=i%2?axis:mul(axis,-1),a=rand()*Math.PI*2,rad=rand()*L*.16,end=add(add(from,mul(dir,L*(.55+rand()*.12))),add(mul(u,Math.cos(a)*rad),mul(v,Math.sin(a)*rad)));lines.push([from,lerp(from,end,.5),end])}
  const reach=(P,d)=>{if(!center)return cellR*.6;const o=sub(P,center),b=dot(o,d),c=dot(o,o)-(cellR-450)**2,disc=b*b-c;return disc>0?Math.max(300,-b+Math.sqrt(disc)):300};
  for(const [P,out] of[[P1,mul(axis,-1)],[P2,axis]])for(let i=0;i<astral;i++){const d=norm(add(out,mul(norm([rand()-.5,rand()-.5,rand()-.5]),1.3)));lines.push([P,add(P,mul(d,reach(P,d)*(.55+rand()*.45)))])}
  microtubules(sc,part,lines,{r,color});
}
/** Cell membrane as a translucent lathe about the x axis: profile r(x) for x from -L to L. */
export function cellShell(sc,part,{at=[0,0,0],L,radius,res,color=0xe3c08a,opacity=.2,axis=[1,0,0]}){const prof=[];const n=res.prof;for(let i=0;i<=n;i++){const t=i/n,x=-L+2*L*t;prof.push([Math.max(0,radius(x)),x])}
  const m=S.lathe(prof,res.around,n);const toAxis=S.aligner([0,1,0],axis);sc.add(part,S.transform(m,p=>add(toAxis(p),at)),{color,opacity,roughness:.4});return m}
/** Fragments of a nuclear envelope (prometaphase) or partial reassembly (telophase): patches of a sphere. */
export function envelopePieces(sc,part,{at,r,count,size,rand,color,res,scale=[1,1,1]}){const list=[];for(let i=0;i<count;i++){const th=rand()*Math.PI*2,ph=Math.asin(rand()*2-1),dth=size*(.6+rand()*.6),dph=size*(.5+rand()*.5),k=1+(rand()-.5)*.12;
  list.push(S.surface((u,v)=>{const t=th+dth*(u-.5),p=ph+dph*(v-.5);return add(at,[Math.cos(p)*Math.cos(t)*r*k*scale[0],Math.sin(p)*r*k*scale[1],Math.cos(p)*Math.sin(t)*r*k*scale[2]])},res.patch,Math.max(3,Math.round(res.patch*.7)),{thickness:60}))}
  if(list.length)sc.add(part,merge(list),{color,roughness:.5})}
