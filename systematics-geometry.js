// Geometry for the Systematics organisms. Plain JavaScript with no imports, so the same code runs in
// systematics-worker.js (off the main thread) or, as a fallback, on the page itself.
// Output: per part and per tissue, typed arrays (position, normal, sRGB→linear vertex colour, index).
// Shapes are authored educational reconstructions: smooth parametric bodies with procedural relief and
// pigment; they are not scans of specimens.
export const TAU=Math.PI*2;

// ---------- noise ----------
const PERM=new Uint8Array(512);{let s=1337;const p=[...Array(256).keys()];for(let i=255;i>0;i--){s=s*16807%2147483647;const j=s%(i+1);[p[i],p[j]]=[p[j],p[i]]}for(let i=0;i<512;i++)PERM[i]=p[i&255]}
const fade=t=>t*t*t*(t*(t*6-15)+10),lerp=(a,b,t)=>a+t*(b-a);
function grad(h,x,y,z){const u=h<8?x:y,v=h<4?y:h===12||h===14?x:z;return((h&1)?-u:u)+((h&2)?-v:v)}
/** Improved Perlin noise, about -1..1. */
export function noise3(x,y,z){let X=Math.floor(x),Y=Math.floor(y),Z=Math.floor(z);x-=X;y-=Y;z-=Z;X&=255;Y&=255;Z&=255;const u=fade(x),v=fade(y),w=fade(z),P=PERM,A=P[X]+Y,AA=P[A]+Z,AB=P[A+1]+Z,B=P[X+1]+Y,BA=P[B]+Z,BB=P[B+1]+Z;
 return lerp(lerp(lerp(grad(P[AA]&15,x,y,z),grad(P[BA]&15,x-1,y,z),u),lerp(grad(P[AB]&15,x,y-1,z),grad(P[BB]&15,x-1,y-1,z),u),v),lerp(lerp(grad(P[AA+1]&15,x,y,z-1),grad(P[BA+1]&15,x-1,y,z-1),u),lerp(grad(P[AB+1]&15,x,y-1,z-1),grad(P[BB+1]&15,x-1,y-1,z-1),u),v),w)}
export function fbm(x,y,z,octaves=4,gain=.5){let sum=0,amp=1,norm=0,f=1;for(let i=0;i<octaves;i++){sum+=amp*noise3(x*f,y*f,z*f);norm+=amp;amp*=gain;f*=2.03}return sum/norm}
const hash3=(i,j,k)=>{let h=Math.imul(i,374761393)+Math.imul(j,668265263)+Math.imul(k,1274126177)|0;h=Math.imul(h^h>>>13,1274126177);return((h^h>>>16)>>>0)/4294967296};
/** Cellular (Worley) noise: distances to the two nearest feature points and an id of the nearest cell. */
export const cell={f1:0,f2:0,id:0};
export function worley(x,y,z){const X=Math.floor(x),Y=Math.floor(y),Z=Math.floor(z);let d1=9,d2=9,id=0;
 for(let k=-1;k<=1;k++)for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const cx=X+i,cy=Y+j,cz=Z+k,dx=cx+hash3(cx,cy,cz)-x,dy=cy+hash3(cx+31,cy,cz)-y,dz=cz+hash3(cx,cy+57,cz)-z,d=dx*dx+dy*dy+dz*dz;if(d<d1){d2=d1;d1=d;id=hash3(cx+7,cy+11,cz+13)}else if(d<d2)d2=d}
 cell.f1=Math.sqrt(d1);cell.f2=Math.sqrt(d2);cell.id=id;return cell}
export const rand=seed=>{let s=seed>>>0||1;return()=>(s=Math.imul(s^s>>>15,2246822519)+1013904223>>>0,(s>>>8)/16777216)};

// ---------- colour ----------
export const hex=h=>[(h>>16&255)/255,(h>>8&255)/255,(h&255)/255];
export const mix=(a,b,t)=>{t=Math.max(0,Math.min(1,t));return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]};
export const shade=(c,k)=>[c[0]*k,c[1]*k,c[2]*k];
export const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
const toLinear=c=>c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);

// ---------- vectors ----------
export const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],scale=(a,k)=>[a[0]*k,a[1]*k,a[2]*k];
export const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const norm=a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return[a[0]/l,a[1]/l,a[2]/l]};
export const madd=(p,d,k)=>[p[0]+d[0]*k,p[1]+d[1]*k,p[2]+d[2]*k];
/** Rotation helpers returning point transforms. */
export const rotX=a=>{const c=Math.cos(a),s=Math.sin(a);return p=>[p[0],p[1]*c-p[2]*s,p[1]*s+p[2]*c]};
export const rotY=a=>{const c=Math.cos(a),s=Math.sin(a);return p=>[p[0]*c+p[2]*s,p[1],-p[0]*s+p[2]*c]};
export const rotZ=a=>{const c=Math.cos(a),s=Math.sin(a);return p=>[p[0]*c-p[1]*s,p[0]*s+p[1]*c,p[2]]};
export const chain=(...f)=>p=>f.reduce((q,g)=>g(q),p);
export const move=d=>p=>[p[0]+d[0],p[1]+d[1],p[2]+d[2]];

// ---------- curves ----------
/** Centripetal Catmull-Rom through control points; returns n+1 samples spread by segment length. */
export function curve(points,n){
 if(points.length<2)return[points[0]];const pts=[points[0],...points,points.at(-1)].map((p,i,a)=>i===0?madd(points[0],sub(points[0],points[1]),1):i===a.length-1?madd(points.at(-1),sub(points.at(-1),points.at(-2)),1):p);
 const lens=[];let total=0;for(let i=1;i<points.length;i++){const l=Math.hypot(...sub(points[i],points[i-1]));lens.push(l);total+=l}
 const out=[];for(let k=0;k<=n;k++){let d=k/n*total,seg=0;while(seg<lens.length-1&&d>lens[seg]){d-=lens[seg];seg++}const t=lens[seg]?Math.min(1,d/lens[seg]):0;out.push(cr(pts[seg],pts[seg+1],pts[seg+2],pts[seg+3],t))}return out}
function cr(p0,p1,p2,p3,t){const a=(p,q)=>Math.pow(Math.hypot(...sub(q,p))||1e-6,.5),t0=0,t1=t0+a(p0,p1),t2=t1+a(p1,p2),t3=t2+a(p2,p3),u=t1+(t2-t1)*t;
 const L=(pa,pb,ta,tb)=>{const k=(u-ta)/(tb-ta||1e-6);return[pa[0]+(pb[0]-pa[0])*k,pa[1]+(pb[1]-pa[1])*k,pa[2]+(pb[2]-pa[2])*k]};
 const A1=L(p0,p1,t0,t1),A2=L(p1,p2,t1,t2),A3=L(p2,p3,t2,t3),B1=L(A1,A2,t0,t2),B2=L(A2,A3,t1,t3);return L(B1,B2,t1,t2)}
/** Parallel-transport frames along sampled points: tangent T, "up" N and side B = T×N. */
export function frames(S,up=[0,1,0]){
 const n=S.length,T=[],N=[],B=[];for(let i=0;i<n;i++)T.push(norm(sub(S[Math.min(n-1,i+1)],S[Math.max(0,i-1)])));
 let prev=norm(sub(up,scale(T[0],dot(up,T[0]))));if(!isFinite(prev[0])||Math.hypot(...prev)<.5)prev=norm(cross(T[0],[0,0,1]));
 for(let i=0;i<n;i++){if(i){const axis=cross(T[i-1],T[i]),s=Math.hypot(...axis);if(s>1e-8){const k=norm(axis),c=dot(T[i-1],T[i]),a=Math.atan2(s,c);prev=rotateAround(prev,k,a)}}prev=norm(sub(prev,scale(T[i],dot(prev,T[i]))));N.push(prev);B.push(cross(T[i],prev))}
 return{T,N,B}}
function rotateAround(v,k,a){const c=Math.cos(a),s=Math.sin(a),kv=cross(k,v),kd=dot(k,v);return[v[0]*c+kv[0]*s+k[0]*kd*(1-c),v[1]*c+kv[1]*s+k[1]*kd*(1-c),v[2]*c+kv[2]*s+k[2]*kd*(1-c)]}

// ---------- body sections ----------
// Elliptical cross-sections from keys [x, back, belly, halfWidth, midZ?]; midZ (default zc) lets the
// mid-plane follow a body that bends sideways.
export function bodyShape(keys,zc=0){
 const at=x=>{let i=0;while(i<keys.length-2&&x>keys[i+1][0])i++;const a=keys[i],b=keys[i+1],u=Math.max(0,Math.min(1,(x-a[0])/(b[0]-a[0])));return[a[1]+(b[1]-a[1])*u,a[2]+(b[2]-a[2])*u,a[3]+(b[3]-a[3])*u,(a[4]??zc)+((b[4]??zc)-(a[4]??zc))*u]};
 const mid=x=>{const o=at(x);return(o[0]+o[1])/2},semi=x=>{const o=at(x);return(o[0]-o[1])/2},half=x=>at(x)[2],zcAt=x=>at(x)[3];
 // Point on the section at x: angle 0 = back, pi/2 = left side (+z), pi = belly; s = fraction of the radius.
 const ring=(x,ang,s=1)=>[x,mid(x)+semi(x)*s*Math.cos(ang),zcAt(x)+half(x)*s*Math.sin(ang)];
 // Point from fractions of the section: v in [-1,1] (belly to back), w in [-1,1] (right to left).
 const at2=(x,v,w)=>[x,mid(x)+semi(x)*v,zcAt(x)+half(x)*w];
 return{mid,semi,half,ring,at:at2,zc,zcAt};
}
// ---------- builder ----------
class Buf{constructor(T,n=1<<14){this.T=T;this.a=new T(n);this.n=0}reserve(k){if(this.n+k>this.a.length){let m=this.a.length*2;while(m<this.n+k)m*=2;const b=new this.T(m);b.set(this.a.subarray(0,this.n));this.a=b}}out(){return this.a.slice(0,this.n)}}

export function createBuilder({mobile=false}={}){
 const meshes=new Map();const Q=mobile?.55:1;
 const acc=(part,tissue)=>{const key=part+'|'+tissue;let m=meshes.get(key);if(!m){m={part,tissue,P:new Buf(Float32Array),N:new Buf(Float32Array),C:new Buf(Float32Array),I:new Buf(Uint32Array),count:0};meshes.set(key,m)}return m};
 const q=(n,min=3)=>Math.max(min,Math.round(n*Q));
 /** Adds a vertex grid (rows × cols) with smooth normals. P(r,c)->[x,y,z]; colour(r,c,p)->sRGB.
  * wrap: columns close into a ring. skip(r,c): leave that quad open. outward(r,c,p): a reference
  * direction used to orient the triangles (and normals) consistently. */
 function grid(part,tissue,rows,cols,P,{wrap=false,color=()=>[.8,.8,.8],skip=null,outward=null,flat=false}={}){
  const m=acc(part,tissue),base=m.count,nv=rows*cols,pos=new Float32Array(nv*3),col=new Float32Array(nv*3),nor=new Float32Array(nv*3);
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const p=P(r,c),k=(r*cols+c)*3;pos[k]=p[0];pos[k+1]=p[1];pos[k+2]=p[2];const rgb=color(r,c,p);col[k]=rgb[0];col[k+1]=rgb[1];col[k+2]=rgb[2]}
  const tris=[];const cc=wrap?cols:cols-1;
  const tri=(a,b,c)=>{const ax=pos[b*3]-pos[a*3],ay=pos[b*3+1]-pos[a*3+1],az=pos[b*3+2]-pos[a*3+2],bx=pos[c*3]-pos[a*3],by=pos[c*3+1]-pos[a*3+1],bz=pos[c*3+2]-pos[a*3+2],nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx;if(nx*nx+ny*ny+nz*nz<1e-24)return;tris.push(a,b,c);for(const v of[a,b,c]){nor[v*3]+=nx;nor[v*3+1]+=ny;nor[v*3+2]+=nz}};
  for(let r=0;r<rows-1;r++)for(let c=0;c<cc;c++){if(skip&&skip(r,c))continue;const c1=(c+1)%cols,a=r*cols+c,b=r*cols+c1,d=(r+1)*cols+c,e=(r+1)*cols+c1;tri(a,d,b);tri(b,d,e)}
  // A collapsed row (pole) shares one averaged normal instead of a fan of slanted ones.
  for(let r=0;r<rows;r++){const k0=r*cols*3;let collapsed=cols>2;for(let c=1;c<cols&&collapsed;c++){const k=k0+c*3;if(Math.abs(pos[k]-pos[k0])+Math.abs(pos[k+1]-pos[k0+1])+Math.abs(pos[k+2]-pos[k0+2])>1e-7)collapsed=false}if(!collapsed)continue;let x=0,y=0,z=0;for(let c=0;c<cols;c++){const k=k0+c*3;x+=nor[k];y+=nor[k+1];z+=nor[k+2]}for(let c=0;c<cols;c++){const k=k0+c*3;nor[k]=x;nor[k+1]=y;nor[k+2]=z}}
  for(let v=0;v<nv;v++){const k=v*3,l=Math.hypot(nor[k],nor[k+1],nor[k+2]);if(l>0){nor[k]/=l;nor[k+1]/=l;nor[k+2]/=l}else nor[k+1]=1}
  let flip=false;if(outward){let s=0;const step=Math.max(1,Math.floor(nv/97));for(let v=0;v<nv;v+=step){const r=Math.floor(v/cols),c=v%cols,o=outward(r,c,[pos[v*3],pos[v*3+1],pos[v*3+2]]);s+=o[0]*nor[v*3]+o[1]*nor[v*3+1]+o[2]*nor[v*3+2]}flip=s<0}
  if(flip){for(let i=0;i<nor.length;i++)nor[i]=-nor[i];for(let i=0;i<tris.length;i+=3){const t=tris[i+1];tris[i+1]=tris[i+2];tris[i+2]=t}}
  m.P.reserve(nv*3);m.P.a.set(pos,m.P.n);m.P.n+=nv*3;m.N.reserve(nv*3);m.N.a.set(nor,m.N.n);m.N.n+=nv*3;m.C.reserve(nv*3);m.C.a.set(col,m.C.n);m.C.n+=nv*3;
  m.I.reserve(tris.length);for(let i=0;i<tris.length;i++)m.I.a[m.I.n++]=tris[i]+base;m.count+=nv;return{base,rows,cols}
 }
 /** Ellipsoidal body with relief: disp(dir,p)->outward offset; xf transforms the result. */
 function blob(part,tissue,center,radii,{nu=48,nv=28,disp=null,color=()=>[.8,.8,.8],xf=null,cut=null}={}){
  nu=q(nu,8);nv=q(nv,6);const P=(r,c)=>{const t=r/(nv),a=c/nu*TAU,st=Math.sin(t*Math.PI),dir=[st*Math.cos(a),Math.cos(t*Math.PI),st*Math.sin(a)];let k=1;const p0=[center[0]+radii[0]*dir[0],center[1]+radii[1]*dir[1],center[2]+radii[2]*dir[2]];if(disp)k=disp(dir,p0,t,a);let p=[center[0]+radii[0]*dir[0]*k,center[1]+radii[1]*dir[1]*k,center[2]+radii[2]*dir[2]*k];return xf?xf(p):p};
  const C=xf?xf(center):center,col=typeof color==='function'?color:()=>color;
  return grid(part,tissue,nv+1,nu,P,{wrap:true,color:(r,c,p)=>col(p,r/nv,c/nu),outward:(r,c,p)=>sub(p,C),skip:cut?(r,c)=>cut((r+.5)/nv,(c+.5)/nu):null});
 }
 /** Generalised cylinder along a spine. profile(t,θ)->[halfWidth, halfHeight, offsetSide?, offsetUp?];
  * θ=0 is "up" (dorsal). disp(t,θ,p)->radial relief. window: {t:[t0,t1], a:[θ0,θ1]} opens the wall and
  * adds an inner surface and cut lips with the given thickness, exposing what lies inside. */
 function loft(part,tissue,{spine,samples=96,radial=48,profile,disp=null,color=()=>[.8,.8,.8],up=[0,1,0],exponent=2,window:win=null,thickness=.02,innerTissue=null,lipTissue=null,innerColor=null,lipColor=null,xf=null,fixed=false}={}){
  if(!fixed){samples=q(samples,6);radial=q(radial,6)}
  const S=typeof spine==='function'?Array.from({length:samples+1},(_,i)=>spine(i/samples)):curve(spine,samples),F=frames(S,up),e=2/exponent;
  const sp=x=>Math.sign(x)*Math.pow(Math.abs(x),e);
  const point=(i,j,inset=0)=>{const t=i/samples,a=j/radial*TAU,cs=Math.cos(a),sn=Math.sin(a),pr=profile(t,a),w=Math.max(0,pr[0]-inset),h=Math.max(0,pr[1]-inset),d=disp&&inset===0?disp(t,a):0,N=F.N[i],B=F.B[i],s=S[i],y=(pr[3]||0)+h*sp(cs)+d*cs,x=(pr[2]||0)+w*sp(sn)+d*sn;const p=[s[0]+N[0]*y+B[0]*x,s[1]+N[1]*y+B[1]*x,s[2]+N[2]*y+B[2]*x];return xf?xf(p):p};
  const radialDir=(i,j)=>{const a=j/radial*TAU,N=F.N[i],B=F.B[i];const d=[N[0]*Math.cos(a)+B[0]*Math.sin(a),N[1]*Math.cos(a)+B[1]*Math.sin(a),N[2]*Math.cos(a)+B[2]*Math.sin(a)];return xf?sub(xf(d),xf([0,0,0])):d};
  let inWin=null,i0,i1,j0,j1;
  if(win){i0=Math.round(win.t[0]*samples);i1=Math.round(win.t[1]*samples);j0=Math.round(win.a[0]/TAU*radial);j1=Math.round(win.a[1]/TAU*radial);inWin=(i,j)=>{if(i<i0||i>=i1)return false;const jj=((j-j0)%radial+radial)%radial;return jj<j1-j0}}
  const out=grid(part,tissue,samples+1,radial,(r,c)=>point(r,c),{wrap:true,color:(r,c,p)=>color(r/samples,c/radial*TAU,p),skip:inWin,outward:(r,c)=>radialDir(r,c)});
  if(win){
   const th=typeof thickness==='function'?thickness:()=>thickness,m=Math.max(2,Math.round((i1-i0)*.35)),ia=Math.max(0,i0-m),ib=Math.min(samples,i1+m);
   const ic=innerColor||((t,a,p)=>mix(color(t,a,p),[.75,.45,.42],.55)),lc=lipColor||((t,a,p)=>shade(color(t,a,p),.85));
   grid(part,innerTissue||tissue,ib-ia+1,radial,(r,c)=>point(ia+r,c,th((ia+r)/samples)),{wrap:true,color:(r,c,p)=>ic((ia+r)/samples,c/radial*TAU,p),skip:(r,c)=>inWin(ia+r,c),outward:(r,c)=>scale(radialDir(ia+r,c),-1)});
   const lip=(pts,ref)=>grid(part,lipTissue||tissue,2,pts.length,(r,c)=>r?pts[c].inner:pts[c].outer,{color:(r,c)=>lc(pts[c].t,pts[c].a,pts[c].outer),outward:ref});
   const span=j1-j0;
   for(const i of[i0,i1]){const pts=[];for(let k=0;k<=span;k++){const j=(j0+k)%radial;pts.push({outer:point(i,j),inner:point(i,j,th(i/samples)),t:i/samples,a:j/radial*TAU})}const T=F.T[i];lip(pts,()=>i===i0?T:scale(T,-1))}
   for(const j of[j0,j1%radial]){const pts=[];for(let i=i0;i<=i1;i++)pts.push({outer:point(i,j),inner:point(i,j,th(i/samples)),t:i/samples,a:j/radial*TAU});const a=j/radial*TAU,dir=j===j0?1:-1;lip(pts,(r,c)=>{const ii=i0+c,N=F.N[ii],B=F.B[ii];return scale([-N[0]*Math.sin(a)+B[0]*Math.cos(a),-N[1]*Math.sin(a)+B[1]*Math.cos(a),-N[2]*Math.sin(a)+B[2]*Math.cos(a)],dir)})}
  }
  return{S,F,point,samples,radial}
 }
 /** Tapered tube through control points (vessels, guts, nerves, hyphae). */
 function tube(part,tissue,points,radius,{samples=48,radial=14,color=()=>[.8,.8,.8],disp=null,up=null,xf=null,ends=true}={}){
  const r=typeof radius==='function'?radius:()=>radius,u=up||(()=>{const d=sub(points.at(-1),points[0]);return Math.abs(d[1])>Math.hypot(d[0],d[2])?[1,0,0]:[0,1,0]})();
  const end=ends?(t=>Math.min(1,Math.sqrt(Math.max(0,Math.min(t,1-t))*samples*.9))):()=>1;
  return loft(part,tissue,{spine:points,samples,radial,up:u,profile:(t,a)=>{const k=r(t)*end(t);return[k,k]},disp,color:typeof color==='function'?color:()=>color,xf});
 }
 /** Thin strand with few segments: cilia, flagella, pili, hairs, setae. pts: 2–5 control points. */
 function strand(part,tissue,pts,r0,r1,{seg=6,radial=5,color=[.8,.8,.8]}={}){
  seg=Math.max(2,Math.round(seg*(mobile?.7:1)));radial=Math.max(3,Math.round(radial*(mobile?.8:1)));
  const S=pts.length>2?curve(pts,seg):Array.from({length:seg+1},(_,i)=>madd(pts[0],sub(pts[1],pts[0]),i/seg)),T=norm(sub(S.at(-1),S[0])),ref=Math.abs(T[1])<.9?[0,1,0]:[1,0,0];
  const F=frames(S,ref),rgb=typeof color==='function'?color:()=>color;
  return grid(part,tissue,seg+1,radial,(i,j)=>{const t=i/seg,a=j/radial*TAU,rr=(r0+(r1-r0)*t)*(i===seg?.35:1);return[S[i][0]+(F.N[i][0]*Math.cos(a)+F.B[i][0]*Math.sin(a))*rr,S[i][1]+(F.N[i][1]*Math.cos(a)+F.B[i][1]*Math.sin(a))*rr,S[i][2]+(F.N[i][2]*Math.cos(a)+F.B[i][2]*Math.sin(a))*rr]},{wrap:true,color:(i,j,p)=>rgb(i/seg,p),outward:(i,j)=>{const a=j/radial*TAU;return[F.N[i][0]*Math.cos(a)+F.B[i][0]*Math.sin(a),F.N[i][1]*Math.cos(a)+F.B[i][1]*Math.sin(a),F.N[i][2]*Math.cos(a)+F.B[i][2]*Math.sin(a)]}});
 }
 /** Leaf-like sheet with thickness: mid(u,v)->point, thick(u,v)->full thickness (taper it to 0 at the
  * rim for a closed edge). Top and bottom faces get their own colours. */
 function sheet(part,tissue,{nu=40,nv=40,mid,thick=()=>.004,color=()=>[.8,.8,.8],under=null,xf=null}={}){
  nu=q(nu,4);nv=q(nv,4);const h=1e-3,M=(u,v)=>{const p=mid(u,v);return xf?xf(p):p};
  const nrm=(u,v)=>{const du=sub(M(Math.min(1,u+h),v),M(Math.max(0,u-h),v)),dv=sub(M(u,Math.min(1,v+h)),M(u,Math.max(0,v-h)));return norm(cross(du,dv))};
  for(const side of[1,-1])grid(part,tissue,nv+1,nu+1,(r,c)=>{const u=c/nu,v=r/nv;return madd(M(u,v),nrm(u,v),side*thick(u,v)/2)},{color:(r,c,p)=>(side<0&&under?under:color)(c/nu,r/nv,p),outward:(r,c)=>scale(nrm(c/nu,r/nv),side)});
 }
 /** Section plane across a windowed loft (the "floor" of a cutaway): it joins the inner wall at the top
  * (θ=0) and bottom (θ=π) of the window, so the cut body reads as solid, not hollow. */
 function section(part,tissue,lo,{t:[t0,t1],inset=0,across=28,disp=null,color=()=>[.8,.8,.8],outward=[0,0,1]}={}){
  const i0=Math.round(t0*lo.samples),i1=Math.round(t1*lo.samples),half=Math.round(lo.radial/2);across=q(across,6);
  const P=(r,c)=>{const i=i0+r,s=c/across,a=lo.point(i,0,inset),b=lo.point(i,half,inset),p=[a[0]+(b[0]-a[0])*s,a[1]+(b[1]-a[1])*s,a[2]+(b[2]-a[2])*s];if(!disp)return p;const d=disp(i/lo.samples,s,p);return madd(p,outward,d)};
  return grid(part,tissue,i1-i0+1,across+1,P,{color:(r,c,p)=>color((i0+r)/lo.samples,c/across,p),outward:()=>outward});
 }
 function finish(){
  const parts={},transfer=[];let triangles=0,vertices=0;
  for(const m of meshes.values()){if(!m.I.n)continue;const position=m.P.out(),normal=m.N.out(),c=m.C.a,color=new Uint16Array(m.C.n);for(let i=0;i<m.C.n;i++)color[i]=Math.round(toLinear(Math.max(0,Math.min(1,c[i])))*65535);
   const index=m.count<65536?Uint16Array.from(m.I.a.subarray(0,m.I.n)):m.I.out();(parts[m.part]||=[]).push({tissue:m.tissue,position,normal,color,index});transfer.push(position.buffer,normal.buffer,color.buffer,index.buffer);triangles+=m.I.n/3;vertices+=m.count}
  meshes.clear();return{parts,transfer,stats:{triangles,vertices}}
 }
 return{mobile,Q,q,grid,blob,loft,tube,strand,sheet,section,finish}
}
