// Geometry kit for the authored cell-scale models (build-cells.mjs), where no open 3D data covers the whole structure:
// parametric patches with real thickness (a membrane cut open shows both faces and the rim between them), lathes,
// tubes along curves, plane clipping, smooth value noise and a coarse occupancy field for cavity shading.
// Meshes are {positions: Float32Array, index: Uint32Array}, as in mesh.mjs.
import {normals as smoothNormals,merge} from './mesh.mjs';

export const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s],
  dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len=a=>Math.hypot(a[0],a[1],a[2]),
  norm=a=>{const l=len(a)||1;return[a[0]/l,a[1]/l,a[2]/l]},lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t],
  clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),smooth=t=>t*t*(3-2*t);
/** Deterministic random numbers (xorshift). */
export function rng(seed=1){let s=(seed*2654435761)>>>0||1;return()=>{s^=s<<13;s>>>=0;s^=s>>>17;s^=s<<5;s>>>=0;return s/4294967296}}
const hash=(i,j,k,s)=>{let h=Math.imul(i,0x27d4eb2d)^Math.imul(j,0x165667b1)^Math.imul(k,0x1b873593)^Math.imul(s,0x9e3779b1);h=Math.imul(h^(h>>>15),0x85ebca6b);h=Math.imul(h^(h>>>13),0xc2b2ae35);return((h^(h>>>16))>>>0)/4294967296*2-1};
/** Smooth value noise in [-1, 1] (period 1 per lattice step). */
export function noise(seed=1){return(x,y,z)=>{const i=Math.floor(x),j=Math.floor(y),k=Math.floor(z),u=smooth(x-i),v=smooth(y-j),w=smooth(z-k);let s=0;
  for(let c=0;c<8;c++){const a=c&1,b=(c>>1)&1,d=c>>2;s+=hash(i+a,j+b,k+d,seed)*(a?u:1-u)*(b?v:1-v)*(d?w:1-w)}return s}}
export function fbm(seed=1,octaves=3){const n=noise(seed);return(x,y,z)=>{let s=0,a=1,t=0,f=1;for(let o=0;o<octaves;o++){s+=a*n(x*f+o*17.3,y*f,z*f);t+=a;a*=.5;f*=2.03}return s/t}}

/** Rotation turning `from` onto `to` (unit vectors), as a function of a point. */
export function aligner(from,to){const f=norm(from),t=norm(to),c=dot(f,t);if(c>.99999)return p=>p.slice();if(c<-.99999){const ax=norm(Math.abs(f[0])<.9?cross(f,[1,0,0]):cross(f,[0,1,0]));return p=>sub(mul(ax,2*dot(ax,p)),p)}
  const ax=norm(cross(f,t)),s=Math.sqrt(1-c*c);return p=>{const k=dot(ax,p),x=cross(ax,p);return[p[0]*c+x[0]*s+ax[0]*k*(1-c),p[1]*c+x[1]*s+ax[1]*k*(1-c),p[2]*c+x[2]*s+ax[2]*k*(1-c)]}}
export const spinner=(axis,angle)=>{const a=norm(axis),c=Math.cos(angle),s=Math.sin(angle);return p=>{const k=dot(a,p),x=cross(a,p);return[p[0]*c+x[0]*s+a[0]*k*(1-c),p[1]*c+x[1]*s+a[1]*k*(1-c),p[2]*c+x[2]*s+a[2]*k*(1-c)]}};
/** Applies f(point) to every vertex (a new mesh). */
export function transform(m,f){const P=new Float32Array(m.positions.length);for(let i=0;i<P.length;i+=3){const q=f([m.positions[i],m.positions[i+1],m.positions[i+2]]);P[i]=q[0];P[i+1]=q[1];P[i+2]=q[2]}return{positions:P,index:m.index}}
/** Local frame → world: local +y goes to `axis`, then a spin about it, uniform or per-axis scale, then the translation. */
export function place(m,{at=[0,0,0],axis=[0,1,0],spin=0,scale=1}={}){const s=Array.isArray(scale)?scale:[scale,scale,scale],r=aligner([0,1,0],axis),t=spinner(axis,spin);return transform(m,p=>add(t(r([p[0]*s[0],p[1]*s[1],p[2]*s[2]])),at))}
const placer=({at=[0,0,0],axis=[0,1,0],spin=0}={})=>{const r=aligner([0,1,0],axis),t=spinner(axis,spin);return p=>add(t(r(p)),at)};
export {placer};

function weldGrid(points,tol){const map=new Int32Array(points.length/3),grid=new Map(),out=[],inv=1/tol;
  for(let i=0;i<map.length;i++){const x=points[i*3],y=points[i*3+1],z=points[i*3+2],key=Math.round(x*inv)+','+Math.round(y*inv)+','+Math.round(z*inv);let id=grid.get(key);if(id===undefined){id=out.length/3;grid.set(key,id);out.push(x,y,z)}map[i]=id}
  return{map,positions:Float32Array.from(out)}}
function gridPoints(fn,nu,nv){const P=new Float64Array((nu+1)*(nv+1)*3);let s=0;for(let i=0;i<=nu;i++)for(let j=0;j<=nv;j++){const p=fn(i/nu,j/nv);P[s++]=p[0];P[s++]=p[1];P[s++]=p[2]}return P}
function extent(P){let m=0;for(let i=0;i<P.length;i++)m=Math.max(m,Math.abs(P[i]));return m||1}
/**
 * Parametric patch fn(u,v) on [0,1]² with nu×nv cells. wrapU joins u=0 to u=1. With `thickness`, the surface becomes a
 * shell: the given surface is the outer face, an inner face lies `thickness` inside, and every open border not marked
 * as degenerate (a pole) gets a rim strip between the faces. Orientation is fixed so the outer face points away from
 * the centre of the patch (`inward` reverses it for concave shells like a vacuole seen from the cytoplasm).
 */
export function surface(fn,nu,nv,{wrapU=false,thickness=0,rims=null,inward=false}={}){
  const P=gridPoints(fn,nu,nv),{map,positions}=weldGrid(P,extent(P)*1e-6),at=(i,j)=>map[(wrapU&&i===nu?0:i)*(nv+1)+j],tris=[];
  for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){const a=at(i,j),b=at(i+1,j),c=at(i+1,j+1),d=at(i,j+1);if(a!==b&&b!==c&&a!==c)tris.push(a,b,c);if(a!==c&&c!==d&&a!==d)tris.push(a,c,d)}
  let outer={positions,index:Uint32Array.from(tris)};
  // Orientation: normals should point away from the centroid (or towards it for `inward`).
  const N0=smoothNormals(outer),cen=[0,1,2].map(k=>{let s=0;for(let i=k;i<positions.length;i+=3)s+=positions[i];return s/(positions.length/3)});let vote=0;
  for(let i=0;i<positions.length;i+=3)vote+=N0[i]*(positions[i]-cen[0])+N0[i+1]*(positions[i+1]-cen[1])+N0[i+2]*(positions[i+2]-cen[2]);
  if((vote<0)!==inward){const I=outer.index;for(let t=0;t<I.length;t+=3){const x=I[t+1];I[t+1]=I[t+2];I[t+2]=x}}
  if(!thickness)return outer;
  const N=smoothNormals(outer),nv0=positions.length/3,inner=new Float32Array(positions.length);for(let i=0;i<positions.length;i++)inner[i]=positions[i]-N[i]*thickness*(inward?-1:1);
  const allP=[...positions,...inner],idx=[...outer.index];for(let t=0;t<outer.index.length;t+=3)idx.push(outer.index[t]+nv0,outer.index[t+2]+nv0,outer.index[t+1]+nv0);
  // Rims: duplicated vertices so the edge between face and rim stays crisp.
  const R=rims||{u0:!wrapU,u1:!wrapU,v0:true,v1:true},rim=(list)=>{const base=allP.length/3;for(const v of list){allP.push(positions[v*3],positions[v*3+1],positions[v*3+2])}for(const v of list){allP.push(inner[v*3],inner[v*3+1],inner[v*3+2])}
    const n=list.length;for(let k=0;k<n-1;k++){const a=base+k,b=base+k+1,c=base+n+k+1,d=base+n+k;idx.push(a,b,c,a,c,d)}};
  const line=(fixed,isU)=>{const out=[];if(isU)for(let j=0;j<=nv;j++)out.push(at(fixed,j));else for(let i=0;i<=nu;i++)out.push(at(i,fixed));return out.filter((v,k,a)=>k===0||v!==a[k-1])};
  if(R.u0)rim(line(0,true));if(R.u1)rim(line(nu,true).reverse());if(R.v0)rim(line(0,false).reverse());if(R.v1)rim(line(nv,false));
  return{positions:Float32Array.from(allP),index:Uint32Array.from(idx)};
}


/** Profile [[r,y],…] sampled at v∈[0,1] by arc length. */
export function profileFn(points){const L=[0];for(let i=1;i<points.length;i++)L.push(L[i-1]+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));const T=L[L.length-1]||1;
  return v=>{const s=v*T;let i=1;while(i<L.length-1&&L[i]<s)i++;const t=(s-L[i-1])/((L[i]-L[i-1])||1);return[points[i-1][0]+(points[i][0]-points[i-1][0])*t,points[i-1][1]+(points[i][1]-points[i-1][1])*t]}}
/** Surface of revolution about +y of profile(v)→[r,y] (or a point list), longitude from theta0 to theta1. */
export function lathe(profile,nu,nv,{theta0=0,theta1=Math.PI*2,radius=null,thickness=0,rims=null,inward=false}={}){
  const prof=typeof profile==='function'?profile:profileFn(profile),full=Math.abs(theta1-theta0-Math.PI*2)<1e-9;
  return surface((u,v)=>{const [r,y]=prof(v),th=theta0+(theta1-theta0)*u,k=radius?radius(th,v):1;return[r*k*Math.cos(th),y,r*k*Math.sin(th)]},nu,nv,{wrapU:full,thickness,rims,inward});
}
/** Flat cap closing a lathe cut at longitude theta: the profile polygon (with the axis), fanned from its centroid. */
export function latheCap(profile,theta,nv,{radius=null}={}){const prof=typeof profile==='function'?profile:profileFn(profile),pts=[];for(let j=0;j<=nv;j++){const [r,y]=prof(j/nv),k=radius?radius(theta,j/nv):1;pts.push([r*k*Math.cos(theta),y,r*k*Math.sin(theta)])}return fan(pts)}
/** Fan of a closed planar polygon from its centroid (convex or star-shaped polygons). */
export function fan(pts){const c=pts.reduce((s,p)=>add(s,p),[0,0,0]).map(v=>v/pts.length),P=[...c],I=[];for(const p of pts)P.push(...p);for(let k=0;k<pts.length;k++)I.push(0,1+k,1+(k+1)%pts.length);return{positions:Float32Array.from(P),index:Uint32Array.from(I)}}
/** Ellipsoid (radii a, b, c along x, y, z); `cut` keeps longitudes theta0..theta1 about y. Optional radial noise. */
export function ellipsoid([a,b,c],nu,nv,{theta0=0,theta1=Math.PI*2,thickness=0,bump=null,rims=null,inward=false,squash=null}={}){
  return surface((u,v)=>{const th=theta0+(theta1-theta0)*u,ph=-Math.PI/2+Math.PI*v;let p=[a*Math.cos(ph)*Math.cos(th),b*Math.sin(ph),c*Math.cos(ph)*Math.sin(th)];if(squash)p=squash(p);if(bump){const k=1+bump(p);p=mul(p,k)}return p},nu,nv,{wrapU:Math.abs(theta1-theta0-Math.PI*2)<1e-9,thickness,rims:rims||{u0:true,u1:true,v0:false,v1:false},inward});
}
/** Icosphere of radius r (subdivisions s), optionally displaced radially by bump(p) (fraction of r). */
export function icosphere(r=1,s=2,bump=null){const t=(1+Math.sqrt(5))/2;let V=[[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]].map(norm);
  let F=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
  for(let k=0;k<s;k++){const mid=new Map(),m=(a,b)=>{const key=a<b?a+'_'+b:b+'_'+a;let i=mid.get(key);if(i===undefined){i=V.length;V.push(norm(lerp(V[a],V[b],.5)));mid.set(key,i)}return i},G=[];for(const [a,b,c] of F){const ab=m(a,b),bc=m(b,c),ca=m(c,a);G.push([a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca])}F=G}
  const P=[];for(const v of V){const k=r*(1+(bump?bump(v):0));P.push(v[0]*k,v[1]*k,v[2]*k)}return{positions:Float32Array.from(P),index:Uint32Array.from(F.flat())}}
/**
 * Tube along a polyline (parallel-transport frames). radius(t) with t∈[0,1] along the length; `caps` closes the ends
 * with hemispheres (round) or flat discs. `twist` turns the cross-section (radians per unit length) for ridged fibres.
 */
export function tube(points,radius,sides=8,{caps='round',section=null,capRings=3}={}){
  const n=points.length,rf=typeof radius==='function'?radius:()=>radius,L=[0];for(let i=1;i<n;i++)L.push(L[i-1]+len(sub(points[i],points[i-1])));const total=L[n-1]||1;
  const T=points.map((p,i)=>norm(sub(points[Math.min(n-1,i+1)],points[Math.max(0,i-1)])));let U=norm(Math.abs(T[0][1])<.9?cross(T[0],[0,1,0]):cross(T[0],[1,0,0]));
  const frames=[];for(let i=0;i<n;i++){if(i){const ax=cross(T[i-1],T[i]),s=len(ax);if(s>1e-8){const ang=Math.asin(Math.min(1,s))*(dot(T[i-1],T[i])<0?-1:1);U=spinner(ax,Math.atan2(s,dot(T[i-1],T[i])))(U)}U=norm(sub(U,mul(T[i],dot(U,T[i]))))}frames.push([U,cross(T[i],U)])}
  const P=[],I=[],ring=(c,[u,w],r,t)=>{for(let k=0;k<sides;k++){const a=k/sides*Math.PI*2,s=section?section(a,t):1;P.push(...add(c,add(mul(u,Math.cos(a)*r*s),mul(w,Math.sin(a)*r*s))))}};
  const rings=[];const pushRing=(c,f,r,t)=>{rings.push(P.length/3);ring(c,f,r,t)};
  if(caps==='round'){const r0=rf(0);for(let q=capRings;q>=1;q--){const a=q/(capRings+1)*Math.PI/2;pushRing(sub(points[0],mul(T[0],Math.sin(a)*r0)),frames[0],Math.cos(a)*r0,0)}}
  for(let i=0;i<n;i++)pushRing(points[i],frames[i],rf(L[i]/total),L[i]/total);
  if(caps==='round'){const r1=rf(1);for(let q=1;q<=capRings;q++){const a=q/(capRings+1)*Math.PI/2;pushRing(add(points[n-1],mul(T[n-1],Math.sin(a)*r1)),frames[n-1],Math.cos(a)*r1,1)}}
  for(let g=0;g<rings.length-1;g++){const a=rings[g],b=rings[g+1];for(let k=0;k<sides;k++){const k1=(k+1)%sides;I.push(a+k,b+k,b+k1,a+k,b+k1,a+k1)}}
  if(caps){const tip=(c,ringStart,flip)=>{const t=P.length/3;P.push(...c);for(let k=0;k<sides;k++){const k1=(k+1)%sides;if(flip)I.push(t,ringStart+k1,ringStart+k);else I.push(t,ringStart+k,ringStart+k1)}};
    const r0=caps==='round'?rf(0):0,r1=caps==='round'?rf(1):0;tip(sub(points[0],mul(T[0],r0)),rings[0],false);tip(add(points[n-1],mul(T[n-1],r1)),rings[rings.length-1],true)}
  return{positions:Float32Array.from(P),index:Uint32Array.from(I)};
}
/** Catmull–Rom resampling of control points into `count` points. */
export function spline(ctrl,count){const out=[],n=ctrl.length;for(let s=0;s<count;s++){const f=s/(count-1)*(n-1),i=Math.min(n-2,Math.floor(f)),t=f-i,p0=ctrl[Math.max(0,i-1)],p1=ctrl[i],p2=ctrl[i+1],p3=ctrl[Math.min(n-1,i+2)];
  out.push([0,1,2].map(k=>.5*((2*p1[k])+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t*t+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t*t*t)))}return out}
/** Random walk confined by inside(p): a fibre path (chromatin, DNA). */
export function walk(start,steps,step,inside,rand,{persistence=.75}={}){let p=start.slice(),d=norm([rand()-.5,rand()-.5,rand()-.5]);const out=[p];
  for(let k=0;k<steps;k++){let tries=0,q;do{const r=norm([rand()-.5,rand()-.5,rand()-.5]);const nd=norm(add(mul(d,persistence),mul(r,1-persistence)));q=add(p,mul(nd,step));if(inside(q)){d=nd;break}d=mul(d,-1);tries++}while(tries<8);if(!inside(q))continue;p=q;out.push(p)}return out}
/** Removes triangles whose centroid lies on the positive side of plane (n·p > d). */
export function clip(m,n,d=0){const P=m.positions,I=m.index,out=[];for(let t=0;t<I.length;t+=3){const c=[0,1,2].map(k=>(P[I[t]*3+k]+P[I[t+1]*3+k]+P[I[t+2]*3+k])/3);if(dot(c,n)<=d)out.push(I[t],I[t+1],I[t+2])}return{positions:P,index:Uint32Array.from(out)}}
export function combine(list){return merge(list.filter(m=>m&&m.index.length))}
/**
 * Coarse occupancy field of a scene (area of surface per cell, blurred), for cavity shading: a vertex whose
 * neighbourhood along its normal is crowded gets darker.
 */
export function occupancy(meshes,cells=96){const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const m of meshes)for(let i=0;i<m.positions.length;i+=3)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],m.positions[i+k]);hi[k]=Math.max(hi[k],m.positions[i+k])}
  const size=Math.max(hi[0]-lo[0],hi[1]-lo[1],hi[2]-lo[2]),h=size/cells,dim=[0,1,2].map(k=>Math.ceil((hi[k]-lo[k])/h)+3),F=new Float32Array(dim[0]*dim[1]*dim[2]),at=(i,j,k)=>i+dim[0]*(j+dim[1]*k);
  for(const m of meshes){const P=m.positions,I=m.index;for(let t=0;t<I.length;t+=3){const a=I[t]*3,b=I[t+1]*3,c=I[t+2]*3,u=[P[b]-P[a],P[b+1]-P[a+1],P[b+2]-P[a+2]],v=[P[c]-P[a],P[c+1]-P[a+1],P[c+2]-P[a+2]],area=len(cross(u,v))/2;
    const g=[0,1,2].map(k=>Math.floor(((P[a+k]+P[b+k]+P[c+k])/3-lo[k])/h)+1);F[at(g[0],g[1],g[2])]+=area/(h*h)}}
  let G=F;for(let pass=0;pass<2;pass++){const out=new Float32Array(G.length);for(let k=1;k<dim[2]-1;k++)for(let j=1;j<dim[1]-1;j++)for(let i=1;i<dim[0]-1;i++){let s=0;for(let dk=-1;dk<=1;dk++)for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++)s+=G[at(i+di,j+dj,k+dk)];out[at(i,j,k)]=s/27}G=out}
  const sample=(x,y,z)=>{const i=Math.floor((x-lo[0])/h)+1,j=Math.floor((y-lo[1])/h)+1,k=Math.floor((z-lo[2])/h)+1;if(i<0||j<0||k<0||i>=dim[0]||j>=dim[1]||k>=dim[2])return 0;return G[at(i,j,k)]};
  return{sample,h}}
const sp=(x,e)=>Math.sign(x)*Math.pow(Math.abs(x),e);
/** Superellipsoid (radii a, b, c; exponent e<1 squares it: 0.2 ≈ rounded box), optional longitude cut as in ellipsoid. */
export function superellipsoid([a,b,c],e,nu,nv,{theta0=0,theta1=Math.PI*2,thickness=0,bump=null}={}){
  return surface((u,v)=>{const th=theta0+(theta1-theta0)*u,ph=-Math.PI/2+Math.PI*v;let p=[a*sp(Math.cos(ph),e)*sp(Math.cos(th),e),b*sp(Math.sin(ph),e),c*sp(Math.cos(ph),e)*sp(Math.sin(th),e)];if(bump)p=mul(p,1+bump(p));return p},nu,nv,{wrapU:Math.abs(theta1-theta0-Math.PI*2)<1e-9,thickness,rims:{u0:true,u1:true,v0:false,v1:false}});
}
/** Flat elliptical disc in the xy plane (z = 0) as concentric rings, for cut faces coloured by radius (growth rings). */
export function ellipseDisc(a,b,rings,seg,{bump=null}={}){const P=[0,0,0],I=[];for(let r=1;r<=rings;r++)for(let k=0;k<seg;k++){const t=k/seg*Math.PI*2,f=r/rings,q=bump?1+bump([Math.cos(t)*a,Math.sin(t)*b,0]):1;P.push(Math.cos(t)*a*f*q,Math.sin(t)*b*f*q,0)}
  for(let k=0;k<seg;k++)I.push(0,1+k,1+(k+1)%seg);for(let r=1;r<rings;r++){const A=1+(r-1)*seg,B=1+r*seg;for(let k=0;k<seg;k++){const k1=(k+1)%seg;I.push(A+k,B+k,B+k1,A+k,B+k1,A+k1)}}return{positions:Float32Array.from(P),index:Uint32Array.from(I)}}
import {isoSurface} from './pdb.mjs';
import {weld} from './mesh.mjs';
/** Surface of {p : f(p) > 0} sampled on a grid (surface nets): for cut faces and shapes with holes. */
export function implicit(f,min,max,spacing){const [nx,ny,nz]=[0,1,2].map(k=>Math.ceil((max[k]-min[k])/spacing)+1),field=new Float32Array(nx*ny*nz);let s=0;
  for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)field[s++]=f([min[0]+i*spacing,min[1]+j*spacing,min[2]+k*spacing]);return weld(isoSurface({field,nx,ny,nz,min,spacing},0),spacing*1e-4)}
/** Superellipsoid level (1 on the surface) and an approximate signed distance (positive inside). */
export const superLevel=(p,[a,b,c],e)=>Math.abs(p[0]/a)**(2/e)+Math.abs(p[1]/b)**(2/e)+Math.abs(p[2]/c)**(2/e);
export const superInside=(p,r,e)=>(1-superLevel(p,r,e)**(e/2))*Math.min(...r);
/** Ring (torus) of radius R and tube radius r about `normal` at `center`. */
export function ring(center,normal,R,r,seg=12,sides=6){const n=norm(normal),u=norm(Math.abs(n[1])<.9?cross(n,[0,1,0]):cross(n,[1,0,0])),w=cross(n,u),pts=[];for(let k=0;k<=seg;k++){const t=k/seg*Math.PI*2;pts.push(add(center,add(mul(u,Math.cos(t)*R),mul(w,Math.sin(t)*R))))}return tube(pts,r,sides,{caps:null})}
