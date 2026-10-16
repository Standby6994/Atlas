import * as THREE from 'three';

// Sculpted educational tissue volumes, not reconstructed microscopy. Caps are
// triangulated inside the actual contour (and its lumens), then locally refined;
// relief and curved walls change the form rather than just adding subdivisions.
const TAU=Math.PI*2;
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=t=>t*t*(3-2*t);
function cleanContour(points){const out=[];for(const p of points){if(!out.length||Math.hypot(p[0]-out.at(-1)[0],p[1]-out.at(-1)[1])>1e-7)out.push([p[0],p[1]])}if(out.length>2&&Math.hypot(out[0][0]-out.at(-1)[0],out[0][1]-out.at(-1)[1])<1e-7)out.pop();return out}
function roundedContour(points,step){
 const p=cleanContour(points),out=[];
 for(let i=0;i<p.length;i++){
  const a=p[(i+p.length-1)%p.length],b=p[i],c=p[(i+1)%p.length],ab=Math.hypot(a[0]-b[0],a[1]-b[1]),bc=Math.hypot(c[0]-b[0],c[1]-b[1]),trim=Math.min(.009,ab*.18,bc*.18),u=trim/(ab||1),v=trim/(bc||1),s=[lerp(b[0],a[0],u),lerp(b[1],a[1],u)],e=[lerp(b[0],c[0],v),lerp(b[1],c[1],v)];
  const n=Math.max(2,Math.ceil(trim*2/step));for(let j=0;j<n;j++){const t=j/n,q=1-t;out.push([q*q*s[0]+2*q*t*b[0]+t*t*e[0],q*q*s[1]+2*q*t*b[1]+t*t*e[1]])}
  const next=p[(i+2)%p.length],cd=Math.hypot(next[0]-c[0],next[1]-c[1]),nextTrim=Math.min(.009,bc*.18,cd*.18),end=[lerp(c[0],b[0],nextTrim/(bc||1)),lerp(c[1],b[1],nextTrim/(bc||1))],segments=Math.max(1,Math.ceil(Math.hypot(end[0]-e[0],end[1]-e[1])/step));for(let j=0;j<segments;j++)out.push([lerp(e[0],end[0],j/segments),lerp(e[1],end[1],j/segments)])
 }
 return cleanContour(out)
}
function edgeMetric(x,y,contours){let best=Infinity,bx=0,by=0;for(const poly of contours)for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1))),qx=x-a[0]-t*dx,qy=y-a[1]-t*dy,dist=qx*qx+qy*qy;if(dist<best){best=dist;bx=qx;by=qy}}const d=Math.sqrt(best);return{d,gx:d>1e-8?bx/d:0,gy:d>1e-8?by/d:0}}
const cutWave=(x,y)=>.0034*Math.sin(x*9.3+y*2.1)+.0016*Math.sin(y*18.4-x*4.8)+.0007*Math.sin(x*41+y*27);
export function createTissueVolume(contour,{holes=[],front=.06,depth=.16,mobile=false,relief=.012,rounded=true,detailScale=1}={}){
 const step=(mobile?.056:.041)*detailScale,outer=rounded?roundedContour(contour,step):cleanContour(contour),inner=holes.map(h=>rounded?roundedContour(h,step):cleanContour(h));
 if(outer.length<3||inner.some(h=>h.length<3))throw Error('Contorno histológico degenerado.');
 const vectors=outer.map(p=>new THREE.Vector2(...p)),holeVectors=inner.map(h=>h.map(p=>new THREE.Vector2(...p))),flat=[...outer,...inner.flat()],triangles=THREE.ShapeUtils.triangulateShape(vectors,holeVectors),positions=[],uv=[],indices=[],vertexMap=new Map(),contours=[outer,...inner],heightContours=[cleanContour(contour),...holes.map(cleanContour)],heightCache=new Map(),capNormals=new Map();
 const xs=contour.map(p=>p[0]),ys=contour.map(p=>p[1]),radius=Math.max(.020,Math.min(.17,Math.min(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys))*.55));
 function surface(x,y){const key=Math.round(x*1e8)+','+Math.round(y*1e8);let h=heightCache.get(key);if(!h){const edge=edgeMetric(x,y,heightContours),t=Math.min(1,edge.d/radius),dome=relief*smooth(t),s=.88+.12*Math.sin(x*23-y*17),cos=Math.cos(x*23-y*17),wave=cutWave(x,y),wx=.0034*9.3*Math.cos(x*9.3+y*2.1)-.0016*4.8*Math.cos(y*18.4-x*4.8)+.0007*41*Math.cos(x*41+y*27),wy=.0034*2.1*Math.cos(x*9.3+y*2.1)+.0016*18.4*Math.cos(y*18.4-x*4.8)+.0007*27*Math.cos(x*41+y*27),dd=relief*6*t*(1-t)/radius;
  h={front:front+wave+dome*s,back:front-depth+wave*.45,normal:[-wx-dd*edge.gx*s-dome*.12*23*cos,-wy-dd*edge.gy*s+dome*.12*17*cos,1],backNormal:[wx*.45,wy*.45,-1]};heightCache.set(key,h)}return h}
 const height=(x,y,back)=>surface(x,y)[back?'back':'front'];
 function vertex(p,z,domain='wall'){const key=Math.round(p[0]*1e8)+','+Math.round(p[1]*1e8)+','+Math.round(z*1e8)+domain;if(vertexMap.has(key))return vertexMap.get(key);const i=positions.length/3;vertexMap.set(key,i);positions.push(p[0],p[1],z);uv.push(p[0]*.78+.5,p[1]*.78+.5);if(domain!=='wall')capNormals.set(i,domain==='front'?surface(...p).normal:surface(...p).backNormal);return i}
 function cap(a,b,c,back,level=0){
  const ab=Math.hypot(a[0]-b[0],a[1]-b[1]),bc=Math.hypot(b[0]-c[0],b[1]-c[1]),ca=Math.hypot(c[0]-a[0],c[1]-a[1]),max=Math.max(ab,bc,ca);
  if(max>step&&level<18){if(max===ab){const m=[(a[0]+b[0])/2,(a[1]+b[1])/2];cap(a,m,c,back,level+1);cap(m,b,c,back,level+1)}else if(max===bc){const m=[(b[0]+c[0])/2,(b[1]+c[1])/2];cap(a,b,m,back,level+1);cap(a,m,c,back,level+1)}else{const m=[(c[0]+a[0])/2,(c[1]+a[1])/2];cap(a,b,m,back,level+1);cap(m,b,c,back,level+1)}return}
  const domain=back?'back':'front',aa=vertex(a,height(...a,back),domain),bb=vertex(b,height(...b,back),domain),cc=vertex(c,height(...c,back),domain),cross=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);if((cross>0)!==back)indices.push(aa,bb,cc);else indices.push(aa,cc,bb)
 }
 for(const t of triangles){cap(flat[t[0]],flat[t[1]],flat[t[2]],false);cap(flat[t[0]],flat[t[1]],flat[t[2]],true)}
 const rings=mobile?5:7;
 for(let h=0;h<contours.length;h++){
  const p=contours[h],area=p.reduce((a,q,i)=>{const n=p[(i+1)%p.length];return a+q[0]*n[1]-n[0]*q[1]},0),flip=(area>0)!==(h===0),centre=p.reduce((a,q)=>[a[0]+q[0]/p.length,a[1]+q[1]/p.length],[0,0]),wall=[];
  for(let k=0;k<=rings;k++){const t=k/rings,row=[];for(const q of p){const dx=q[0]-centre[0],dy=q[1]-centre[1],l=Math.hypot(dx,dy)||1,bow=Math.sin(t*Math.PI)*Math.min(.005,depth*.045)*(h?-.6:1),pt=[q[0]+dx/l*bow,q[1]+dy/l*bow],z=lerp(height(...q,true),height(...q,false),t);row.push(vertex(pt,z))}wall.push(row)}
  for(let k=0;k<rings;k++)for(let j=0;j<p.length;j++){const n=(j+1)%p.length,a=wall[k][j],b=wall[k][n],c=wall[k+1][n],d=wall[k+1][j];if(flip)indices.push(a,c,b,a,d,c);else indices.push(a,b,c,a,c,d)}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();const normals=g.attributes.normal,v=new THREE.Vector3();for(const[i,n]of capNormals){v.set(...n).normalize();normals.setXYZ(i,...v.toArray())}g.computeBoundingBox();g.computeBoundingSphere();g.userData={organicHistology:true,sculptedContour:true,continuousLayers:true,topology:'refined contour cap with analytic surface normals and curved volume walls',mobile};return g
}
export function createNuclearSurface({mobile=false,seed=0}={}){
 const g=new THREE.SphereGeometry(1,mobile?22:30,mobile?14:20),p=g.attributes.position;
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),a=Math.atan2(z,x),b=Math.acos(Math.max(-1,Math.min(1,y))),q=1+.055*Math.sin(a*3+seed)*Math.sin(b)**2+.022*Math.cos(a*5-b*4+seed);p.setXYZ(i,x*q,y*q,z*q)}
 p.needsUpdate=true;g.computeVertexNormals();g.userData={organicHistology:true,irregularNuclearEnvelope:true};return g
}
export function createHistologyFiber(points,width,{mobile=false,z=.075,seed=0,detailScale=1}={}){
 const nodes=points.map((p,i)=>new THREE.Vector3(p[0],p[1],p[2]??z+.002*Math.sin(i*1.9+seed))),curve=new THREE.CatmullRomCurve3(nodes,false,'centripetal'),length=curve.getLength(),segments=Math.max(mobile?20:28,Math.ceil(length/((mobile?.025:.016)*detailScale))),g=new THREE.TubeGeometry(curve,segments,width,mobile?9:12,false),p=g.attributes.position;
 // Radius varies gently along a continuous fibril; endpoints remain attached.
 const ring=mobile?10:13;for(let i=0;i<p.count;i++){const t=Math.floor(i/ring)/segments,centre=curve.getPointAt(t),q=1+.07*Math.sin(t*TAU*4+seed);p.setXYZ(i,centre.x+(p.getX(i)-centre.x)*q,centre.y+(p.getY(i)-centre.y)*q,centre.z+(p.getZ(i)-centre.z)*q)}p.needsUpdate=true;g.computeVertexNormals();g.userData={organicHistology:true,continuousFiber:true};return g
}
/** Cylindrical myofibres or tapering smooth myocytes, with a curved centreline. */
export function createMuscleSurface({left=-.75,right=.75,y=0,radius=.065,z=-.014,mobile=false,spindle=false,phase=0}={}){
 const longitudinal=mobile?88:144,circumference=mobile?18:28,positions=[],uv=[],indices=[];
 for(let i=0;i<=longitudinal;i++){const t=i/longitudinal,x=lerp(left,right,t),centre=y+.008*Math.sin(x*6+phase),shape=spindle?Math.max(.014,Math.sin(Math.PI*t)**.74):1+.018*Math.sin(t*TAU*19),r=radius*shape;
  for(let j=0;j<=circumference;j++){const a=j/circumference*TAU,q=1+.018*Math.sin(a*5+t*17);positions.push(x,centre+Math.cos(a)*r*q,z+Math.sin(a)*r*.98*q);uv.push(t,j/circumference)}
 }
 for(let i=0;i<longitudinal;i++)for(let j=0;j<circumference;j++){const a=i*(circumference+1)+j,b=a+circumference+1;indices.push(a,a+1,b,b,a+1,b+1)}
 for(const end of[0,longitudinal]){const x=end?right:left,centre=positions.length/3;positions.push(x,y+.008*Math.sin(x*6+phase),z);uv.push(end?1:0,.5);const start=end*(circumference+1);for(let j=0;j<circumference;j++)end?indices.push(centre,start+j,start+j+1):indices.push(centre,start+j+1,start+j)}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();const n=g.attributes.normal,v=new THREE.Vector3();for(let i=0;i<=longitudinal;i++){const a=i*(circumference+1),b=a+circumference;v.set(n.getX(a)+n.getX(b),n.getY(a)+n.getY(b),n.getZ(a)+n.getZ(b)).normalize();n.setXYZ(a,...v.toArray());n.setXYZ(b,...v.toArray())}g.computeBoundingBox();g.computeBoundingSphere();g.userData={organicHistology:true,myofibre:true,spindle,closedVolume:true};return g
}

/** Upgrade supplementary teaching sections without touching shared originals.
 * The returned geometries are owned by this handle; dispose originals through
 * their original model handle, then dispose this handle once. */
export function upgradeHistologyGeometry(group,{mobile=false}={}){
 const geometries=new Set(),replacements=new Map();group.traverse(o=>{if(!o.isMesh||!o.geometry)return;const original=o.geometry;
  if(replacements.has(original))o.geometry=replacements.get(original);
  else if(original.type==='ExtrudeGeometry'&&original.parameters?.shapes){const shape=Array.isArray(original.parameters.shapes)?original.parameters.shapes[0]:original.parameters.shapes,extracted=shape.extractPoints(36),depth=original.parameters.options.depth||.1,warp=p=>[p.x+.009*Math.sin(p.y*17+p.x*3)+.003*Math.sin(p.y*31)*Math.sin(p.x*11),p.y+.008*Math.sin(p.x*19-p.y*5)],g=createTissueVolume(extracted.shape.map(warp),{holes:extracted.holes.map(h=>h.map(warp)),front:depth,depth,mobile,relief:Math.min(.024,depth*.20)});o.geometry=g;geometries.add(g);replacements.set(original,g)}
  else if(original.type==='SphereGeometry'){const g=createNuclearSurface({mobile,seed:geometries.size*.63}),radius=original.parameters.radius||1;g.scale(radius,radius,radius);o.geometry=g;geometries.add(g);replacements.set(original,g)}
  else if(original.type==='TubeGeometry'&&original.parameters?.path){const source=original.parameters,path=source.path,g=createHistologyFiber(path.getSpacedPoints(Math.max(8,path.points?.length*4||12)).map(p=>[p.x,p.y,p.z]),source.radius,{mobile});o.geometry=g;geometries.add(g);replacements.set(original,g)}
  if(o.material?.color?.getHex()===0x634b77)o.position.z+=.020;
  o.userData={...o.userData,organicHistology:true,notRealHistology:true}
 });let disposed=false;return{geometries,dispose(){if(disposed)return;disposed=true;for(const g of geometries){g.disposeBoundsTree?.();g.dispose()}geometries.clear()}}
}
