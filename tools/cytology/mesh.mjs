// Mesh utilities for the cytology tools (Node, no dependencies): welding, quadric-error simplification
// (Garland & Heckbert edge collapse, open borders kept in place), smooth normals, small-piece filtering.
// Meshes are {positions: Float32Array (x,y,z…), index: Uint32Array (a,b,c…)}.

/** Merges vertices closer than `tolerance` (same units as positions); drops degenerate triangles. */
export function weld({positions,index},tolerance=1e-4){
  const n=positions.length/3,map=new Uint32Array(n),grid=new Map(),out=[];let count=0;const inv=1/tolerance;
  for(let i=0;i<n;i++){const x=positions[i*3],y=positions[i*3+1],z=positions[i*3+2],key=Math.round(x*inv)+','+Math.round(y*inv)+','+Math.round(z*inv);let id=grid.get(key);if(id===undefined){id=count++;grid.set(key,id);out.push(x,y,z)}map[i]=id}
  const tris=[];for(let t=0;t<index.length;t+=3){const a=map[index[t]],b=map[index[t+1]],c=map[index[t+2]];if(a!==b&&b!==c&&a!==c)tris.push(a,b,c)}
  return{positions:Float32Array.from(out),index:Uint32Array.from(tris)};
}
/** Concatenates meshes. */
export function merge(meshes){
  let nv=0,ni=0;for(const m of meshes){nv+=m.positions.length;ni+=m.index.length}
  const positions=new Float32Array(nv),index=new Uint32Array(ni);let pv=0,pi=0;
  for(const m of meshes){positions.set(m.positions,pv);const base=pv/3;for(let i=0;i<m.index.length;i++)index[pi+i]=m.index[i]+base;pv+=m.positions.length;pi+=m.index.length}
  return{positions,index};
}
export const triangles=m=>m.index.length/3;

// Binary min-heap of edge candidates: parallel typed arrays grown on demand.
class Heap{
  constructor(){this.cost=new Float64Array(1024);this.data=new Int32Array(1024*4);this.size=0}
  push(cost,a,b,stampA,stampB){if(this.size===this.cost.length){const c=new Float64Array(this.size*2);c.set(this.cost);this.cost=c;const d=new Int32Array(this.size*8);d.set(this.data);this.data=d}
    let i=this.size++;this.cost[i]=cost;this.data.set([a,b,stampA,stampB],i*4);
    while(i>0){const p=(i-1)>>1;if(this.cost[p]<=this.cost[i])break;this.swap(i,p);i=p}}
  swap(i,j){const c=this.cost[i];this.cost[i]=this.cost[j];this.cost[j]=c;for(let k=0;k<4;k++){const d=this.data[i*4+k];this.data[i*4+k]=this.data[j*4+k];this.data[j*4+k]=d}}
  pop(out){if(!this.size)return false;out[0]=this.cost[0];for(let k=0;k<4;k++)out[k+1]=this.data[k];this.size--;if(this.size){this.cost[0]=this.cost[this.size];for(let k=0;k<4;k++)this.data[k]=this.data[this.size*4+k];
    let i=0;for(;;){const l=i*2+1,r=l+1;let m=i;if(l<this.size&&this.cost[l]<this.cost[m])m=l;if(r<this.size&&this.cost[r]<this.cost[m])m=r;if(m===i)break;this.swap(i,m);i=m}}return true}
}

/** Quadric-error simplification down to `target` triangles. Border edges get strong constraint planes. */
export function simplify(mesh,target,{borderWeight=1000,maxError=Infinity}={}){
  const {positions:P0,index:I0}=mesh,n=P0.length/3,m=I0.length/3;if(m<=target)return mesh;
  const P=Float64Array.from(P0),F=Int32Array.from(I0),faceAlive=new Uint8Array(m).fill(1),Q=new Float64Array(n*10),stamp=new Int32Array(n),alive=new Uint8Array(n).fill(1);
  const vf=Array.from({length:n},()=>[]);for(let f=0;f<m;f++)for(let k=0;k<3;k++)vf[F[f*3+k]].push(f);
  const addPlane=(v,a,b,c,d,w)=>{const q=v*10;Q[q]+=w*a*a;Q[q+1]+=w*a*b;Q[q+2]+=w*a*c;Q[q+3]+=w*a*d;Q[q+4]+=w*b*b;Q[q+5]+=w*b*c;Q[q+6]+=w*b*d;Q[q+7]+=w*c*c;Q[q+8]+=w*c*d;Q[q+9]+=w*d*d};
  const normal=(f,out)=>{const a=F[f*3]*3,b=F[f*3+1]*3,c=F[f*3+2]*3,ux=P[b]-P[a],uy=P[b+1]-P[a+1],uz=P[b+2]-P[a+2],vx=P[c]-P[a],vy=P[c+1]-P[a+1],vz=P[c+2]-P[a+2];out[0]=uy*vz-uz*vy;out[1]=uz*vx-ux*vz;out[2]=ux*vy-uy*vx;return out};
  const nn=[0,0,0];
  for(let f=0;f<m;f++){normal(f,nn);const len=Math.hypot(...nn);if(!len)continue;const a=nn[0]/len,b=nn[1]/len,c=nn[2]/len,v0=F[f*3]*3,d=-(a*P[v0]+b*P[v0+1]+c*P[v0+2]);for(let k=0;k<3;k++)addPlane(F[f*3+k],a,b,c,d,len/2)}
  // Border edges (used by one face): a plane through the edge, perpendicular to the face, keeps open rims in place.
  const edgeCount=new Map(),ek=(a,b)=>a<b?a*n+b:b*n+a;
  for(let f=0;f<m;f++)for(let k=0;k<3;k++){const a=F[f*3+k],b=F[f*3+(k+1)%3],key=ek(a,b);edgeCount.set(key,(edgeCount.get(key)||0)+1)}
  for(let f=0;f<m;f++){normal(f,nn);const len=Math.hypot(...nn);if(!len)continue;for(let k=0;k<3;k++){const a=F[f*3+k],b=F[f*3+(k+1)%3];if(edgeCount.get(ek(a,b))!==1)continue;
    const ex=P[b*3]-P[a*3],ey=P[b*3+1]-P[a*3+1],ez=P[b*3+2]-P[a*3+2],el=Math.hypot(ex,ey,ez);if(!el)continue;let px=ey*nn[2]-ez*nn[1],py=ez*nn[0]-ex*nn[2],pz=ex*nn[1]-ey*nn[0];const pl=Math.hypot(px,py,pz);if(!pl)continue;px/=pl;py/=pl;pz/=pl;const d=-(px*P[a*3]+py*P[a*3+1]+pz*P[a*3+2]);addPlane(a,px,py,pz,d,borderWeight*el);addPlane(b,px,py,pz,d,borderWeight*el)}}
  edgeCount.clear();
  const best=new Float64Array(4);
  function evaluate(a,b){
    const qa=a*10,qb=b*10,q0=Q[qa]+Q[qb],q1=Q[qa+1]+Q[qb+1],q2=Q[qa+2]+Q[qb+2],q3=Q[qa+3]+Q[qb+3],q4=Q[qa+4]+Q[qb+4],q5=Q[qa+5]+Q[qb+5],q6=Q[qa+6]+Q[qb+6],q7=Q[qa+7]+Q[qb+7],q8=Q[qa+8]+Q[qb+8],q9=Q[qa+9]+Q[qb+9];
    const err=(x,y,z)=>q0*x*x+2*q1*x*y+2*q2*x*z+2*q3*x+q4*y*y+2*q5*y*z+2*q6*y+q7*z*z+2*q8*z+q9;
    const ax=P[a*3],ay=P[a*3+1],az=P[a*3+2],bx=P[b*3],by=P[b*3+1],bz=P[b*3+2];
    // Optimal point of the 3×3 system (Cramer); kept only near the edge, else endpoints or midpoint.
    const c00=q4*q7-q5*q5,c01=q2*q5-q1*q7,c02=q1*q5-q2*q4,det=q0*c00+q1*c01+q2*c02,scale=Math.max(1e-12,Math.abs(q0)+Math.abs(q4)+Math.abs(q7));
    let x,y,z,e;
    if(Math.abs(det)>1e-10*scale*scale*scale){const r0=-q3,r1=-q6,r2=-q8;
      const sx=(r0*c00+r1*c01+r2*c02)/det,sy=(q0*(r1*q7-q5*r2)-r0*(q1*q7-q5*q2)+q2*(q1*r2-r1*q2))/det,sz=(q0*(q4*r2-r1*q5)-q1*(q1*r2-r1*q2)+r0*(q1*q5-q4*q2))/det;
      const el=Math.hypot(bx-ax,by-ay,bz-az)||1;if(Math.hypot(sx-(ax+bx)/2,sy-(ay+by)/2,sz-(az+bz)/2)<el*2){x=sx;y=sy;z=sz;e=err(x,y,z)}}
    if(e===undefined){const ea=err(ax,ay,az),eb=err(bx,by,bz),mx=(ax+bx)/2,my=(ay+by)/2,mz=(az+bz)/2,em=err(mx,my,mz);
      if(ea<=eb&&ea<=em){x=ax;y=ay;z=az;e=ea}else if(eb<=em){x=bx;y=by;z=bz;e=eb}else{x=mx;y=my;z=mz;e=em}}
    best[0]=Math.max(0,e);best[1]=x;best[2]=y;best[3]=z;return best;
  }
  const heap=new Heap();
  const push=(a,b)=>{if(a===b)return;const r=evaluate(a,b);heap.push(r[0],a,b,stamp[a],stamp[b])};
  {const seen=new Set();for(let f=0;f<m;f++)for(let k=0;k<3;k++){const a=F[f*3+k],b=F[f*3+(k+1)%3],key=ek(a,b);if(!seen.has(key)){seen.add(key);push(a,b)}}}
  let live=m;const rec=new Float64Array(5),before=[0,0,0],after=[0,0,0];
  // Collapsing b into a at p must not flip a face of b (or a) that survives.
  function flips(a,b,x,y,z){
    for(let s=0;s<2;s++){const v=s?b:a;for(const f of vf[v]){if(!faceAlive[f])continue;const f0=F[f*3],f1=F[f*3+1],f2=F[f*3+2];if((f0===a||f1===a||f2===a)&&(f0===b||f1===b||f2===b))continue;
      normal(f,before);const ox=P[v*3],oy=P[v*3+1],oz=P[v*3+2];P[v*3]=x;P[v*3+1]=y;P[v*3+2]=z;normal(f,after);P[v*3]=ox;P[v*3+1]=oy;P[v*3+2]=oz;
      if(before[0]*after[0]+before[1]*after[1]+before[2]*after[2]<=0)return true}}
    return false;
  }
  while(live>target&&heap.pop(rec)){
    const [cost,a,b,sa,sb]=rec;if(cost>maxError)break;
    if(!alive[a]||!alive[b]||stamp[a]!==sa||stamp[b]!==sb)continue;
    const r=evaluate(a,b),x=r[1],y=r[2],z=r[3];
    if(flips(a,b,x,y,z)){stamp[a]++;continue}
    // Collapse: a takes the new position and the summed quadric; b's faces move to a; faces with both die.
    P[a*3]=x;P[a*3+1]=y;P[a*3+2]=z;for(let i=0;i<10;i++)Q[a*10+i]+=Q[b*10+i];alive[b]=0;stamp[a]++;
    const merged=[];for(const f of vf[a])if(faceAlive[f])merged.push(f);
    for(const f of vf[b]){if(!faceAlive[f])continue;let hasA=false;for(let k=0;k<3;k++)if(F[f*3+k]===a)hasA=true;if(hasA){faceAlive[f]=0;live--;continue}for(let k=0;k<3;k++)if(F[f*3+k]===b)F[f*3+k]=a;merged.push(f)}
    vf[a]=merged.filter(f=>faceAlive[f]);vf[b]=[];
    const neighbors=new Set();for(const f of vf[a])for(let k=0;k<3;k++){const v=F[f*3+k];if(v!==a)neighbors.add(v)}
    for(const v of neighbors){stamp[v]++}
    for(const v of neighbors)push(a,v);
    // Edges among the neighbours changed stamps too: refresh them once.
    for(const v of neighbors)for(const f of vf[v])if(faceAlive[f])for(let k=0;k<3;k++){const w=F[f*3+k];if(w!==v&&w!==a&&neighbors.has(w)&&v<w)push(v,w)}
  }
  const remap=new Int32Array(n).fill(-1),out=[],idx=[];let count=0;
  for(let f=0;f<m;f++){if(!faceAlive[f])continue;const tri=[F[f*3],F[f*3+1],F[f*3+2]];if(tri[0]===tri[1]||tri[1]===tri[2]||tri[0]===tri[2])continue;for(const v of tri){if(remap[v]<0){remap[v]=count++;out.push(P[v*3],P[v*3+1],P[v*3+2])}idx.push(remap[v])}}
  return{positions:Float32Array.from(out),index:Uint32Array.from(idx)};
}

/** Area-weighted smooth vertex normals. */
export function normals({positions,index}){
  const N=new Float32Array(positions.length);
  for(let t=0;t<index.length;t+=3){const a=index[t]*3,b=index[t+1]*3,c=index[t+2]*3,ux=positions[b]-positions[a],uy=positions[b+1]-positions[a+1],uz=positions[b+2]-positions[a+2],vx=positions[c]-positions[a],vy=positions[c+1]-positions[a+1],vz=positions[c+2]-positions[a+2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;for(const v of[a,b,c]){N[v]+=nx;N[v+1]+=ny;N[v+2]+=nz}}
  for(let i=0;i<N.length;i+=3){const l=Math.hypot(N[i],N[i+1],N[i+2])||1;N[i]/=l;N[i+1]/=l;N[i+2]/=l}
  return N;
}

/** Connected pieces (by shared vertices), largest first: [{index, triangles, bounds}]. */
export function pieces({positions,index}){
  const n=positions.length/3,parent=new Int32Array(n).map((_,i)=>i),find=x=>{while(parent[x]!==x){parent[x]=parent[parent[x]];x=parent[x]}return x};
  for(let t=0;t<index.length;t+=3){const a=find(index[t]),b=find(index[t+1]),c=find(index[t+2]);parent[b]=a;parent[find(c)]=a}
  const groups=new Map();for(let t=0;t<index.length;t+=3){const r=find(index[t]);let g=groups.get(r);if(!g)groups.set(r,g=[]);g.push(index[t],index[t+1],index[t+2])}
  return[...groups.values()].map(list=>({index:Uint32Array.from(list),triangles:list.length/3})).sort((a,b)=>b.triangles-a.triangles);
}
/** Keeps only the triangles listed (re-indexing vertices). */
export function compact(positions,index){
  const remap=new Map(),out=[],idx=[];for(const v of index){let r=remap.get(v);if(r===undefined){r=remap.size;remap.set(v,r);out.push(positions[v*3],positions[v*3+1],positions[v*3+2])}idx.push(r)}
  return{positions:Float32Array.from(out),index:Uint32Array.from(idx)};
}
export function bounds(positions){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<positions.length;i+=3)for(let k=0;k<3;k++){const v=positions[i+k];if(v<min[k])min[k]=v;if(v>max[k])max[k]=v}return{min,max}}
