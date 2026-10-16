import * as THREE from 'three';

// Authored educational surfaces. The cut planes deliberately expose compartments;
// colors, molecular outlines and relative dimensions are not microscopy data.
export const CYTO_COLORS=Object.freeze({membrane:0xca8e91,matrix:0xd0b9a1,chromatin:0x806787,protein:0xae7b83,filament:0x9a8570,wall:0xb4ad82,lipid:0xcdb579,green:0x8f9f71,blue:0x789ba3,deep:0x695d76,pale:0xe2d4bd});
const vec=p=>new THREE.Vector3(...p),TAU=Math.PI*2;

export function cytologySurface(nu,nv,fn,flags={}){
 const positions=[],uv=[],indices=[];
 for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){const p=fn(i/nu,j/nv);positions.push(...p);uv.push(i/nu,j/nv)}
 const packed=new Float32Array(positions);
 function tri(a,b,c){const ax=packed[b*3]-packed[a*3],ay=packed[b*3+1]-packed[a*3+1],az=packed[b*3+2]-packed[a*3+2],bx=packed[c*3]-packed[a*3],by=packed[c*3+1]-packed[a*3+1],bz=packed[c*3+2]-packed[a*3+2];if(Math.hypot(ay*bz-az*by,az*bx-ax*bz,ax*by-ay*bx)>1e-11)indices.push(a,b,c)}
 for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=j*(nu+1)+i,b=a+1,c=a+nu+1,d=c+1;tri(a,c,b);tri(b,c,d)}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(packed,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();g.userData={continuousSurface:true,...flags};return g;
}

export function mergeCytologySurfaces(inputs,metadata={}){
 const positions=[],normals=[],uv=[],indices=[];let offset=0;
 for(const g of inputs){const p=g.getAttribute('position'),n=g.getAttribute('normal'),t=g.getAttribute('uv');for(const x of p.array)positions.push(x);for(const x of n.array)normals.push(x);if(t)for(const x of t.array)uv.push(x);else for(let i=0;i<p.count;i++)uv.push(0,0);const ix=g.index?.array;if(ix)for(const i of ix)indices.push(offset+i);else for(let i=0;i<p.count;i++)indices.push(offset+i);offset+=p.count;g.dispose()}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.userData={mergedContinuousPatches:true,...metadata};return g;
}

export function createCytologyContext(def,{mobile=false}={}){
 const group=new THREE.Group(),parts=[],pending=new Map(),geometries=new Set(),materials=new Set();let disposed=false;
 group.name='CYTOLOGY_'+def.id;group.userData={cytology:true,educational:true,schematic:true,cytologyId:def.id,authoredReconstruction:true,continuousBiologicalSurfaces:true,notRealHistology:true};
 const quality={u:mobile?48:80,v:mobile?20:32,smallU:mobile?20:32,smallV:mobile?10:16,tube:mobile?36:64,radial:mobile?7:10};
 for(const definition of def.parts){const object=new THREE.Group();object.name='CYTO_'+def.id+'_'+definition.id;object.userData={partId:definition.id,cytology:true,educational:true,schematic:true};const p={...definition,label:definition.label||definition.title||definition.id,object};parts.push(p);group.add(object);pending.set(definition.id,new Map())}
 const at=id=>{const p=parts.find(p=>p.id===id);if(!p)throw new Error('Parte de citologia ausente: '+def.id+'/'+id);return p.object};
 function add(id,g,tissue='membrane',color=CYTO_COLORS[tissue]){
  const groups=pending.get(id);if(!groups)throw new Error('Geometria sem identidade: '+def.id+'/'+id);const key=tissue+':'+color;if(!groups.has(key))groups.set(key,{tissue,color,geos:[]});groups.get(key).geos.push(g);return g;
 }
 function patch(id,fn,{nu=quality.u,nv=quality.v,tissue='membrane',color=CYTO_COLORS[tissue],flags={}}={}){return add(id,cytologySurface(nu,nv,fn,flags),tissue,color)}
 // A smooth asymmetric ellipsoid, never a faceted primitive. Two frequency
 // scales describe the organelle's outline, not a surface full of random lumps.
 const bulgeAt=(a,t,bulge)=>bulge?1+bulge.strength*Math.exp(-((Math.atan2(Math.sin(a-bulge.angle),Math.cos(a-bulge.angle))/bulge.width)**2))*Math.sin(t)**2:1;
 function body(id,p,size,{tissue='protein',color=CYTO_COLORS[tissue],lobes=.045,phase=0,cut=false,nu=quality.smallU,nv=quality.smallV,exponent=1,bend=0,ripple=0,bulge=null}={}){
  const signed=(x,pow)=>Math.abs(x)<1e-10?0:Math.sign(x)*Math.pow(Math.abs(x),pow);
  return patch(id,(u,v)=>{const a=u*TAU,t=(cut?Math.PI/2:0)+v*(cut?Math.PI/2:Math.PI),x=signed(Math.sin(t)*Math.cos(a),exponent),y=signed(Math.sin(t)*Math.sin(a),exponent),z=Math.cos(t),r=(1+lobes*Math.sin(3*a+phase)*Math.sin(t)**2+lobes*.45*Math.sin(5*a-2*t))*bulgeAt(a,t,bulge);return[p[0]+size[0]*x*r,p[1]+size[1]*y*r+bend*x*x,p[2]+size[2]*z+ripple*Math.sin(5*x+phase)*Math.sin(3*y)]},{nu,nv,tissue,color,flags:{curvedBiologicalEnvelope:true,exposedCompartment:cut}});
 }
 function shell(id,p,size,{thickness=.013,tissue='membrane',color=CYTO_COLORS[tissue],lobes=.035,phase=0,exponent=1,nu=quality.u,nv=quality.v,bulge=null}={}){
  const outer=body(id,p,size,{tissue,color,lobes,phase,cut:true,exponent,nu,nv,bulge}),inner=size.map(x=>Math.max(.002,x-thickness));body(id,p,inner,{tissue,color,lobes,phase,cut:true,exponent,nu,nv,bulge});
  // The annular cut lip joins both surfaces and expresses actual wall thickness.
  patch(id,(u,v)=>{const a=u*TAU,r=(1+lobes*Math.sin(3*a+phase)+lobes*.45*Math.sin(5*a-Math.PI))*bulgeAt(a,Math.PI/2,bulge),c=Math.sign(Math.cos(a))*Math.abs(Math.cos(a))**exponent,s=Math.sign(Math.sin(a))*Math.abs(Math.sin(a))**exponent;return[p[0]+(inner[0]+thickness*v)*c*r,p[1]+(inner[1]+thickness*v)*s*r,p[2]]},{nu,nv:3,tissue,color,flags:{sharedCutLip:true}});return outer;
 }
 function tube(id,points,radius,{tissue='filament',color=CYTO_COLORS[tissue],segments=quality.tube,radial=quality.radial,closed=false,taper=0,fluting=0}={}){
  const curve=new THREE.CatmullRomCurve3(points.map(vec),closed,'centripetal'),g=new THREE.TubeGeometry(curve,segments,radius,radial,closed),p=g.getAttribute('position');
  if(taper||fluting){for(let i=0;i<p.count;i++){const ring=Math.floor(i/(radial+1)),u=ring/segments,center=curve.getPoint(u),k=(1-taper*Math.abs(u-.5)*2)*(1+fluting*Math.cos((i%(radial+1))/radial*TAU*5));p.setXYZ(i,center.x+(p.getX(i)-center.x)*k,center.y+(p.getY(i)-center.y)*k,center.z+(p.getZ(i)-center.z)*k)}g.computeVertexNormals()}
  g.userData={continuousFilament:true,closedLoop:closed};return add(id,g,tissue,color);
 }
 function loop(id,p,rx,ry,{radius=.006,zWave=.008,tissue='filament',color=CYTO_COLORS[tissue],phase=0,segments=quality.tube}={}){const points=[];for(let i=0;i<24;i++){const a=i/24*TAU;points.push([p[0]+rx*Math.cos(a)*(1+.035*Math.sin(3*a+phase)),p[1]+ry*Math.sin(a),p[2]+zWave*Math.sin(2*a+phase)])}return tube(id,points,radius,{tissue,color,segments,closed:true})}
 function sheet(id,p,size,{tissue='membrane',color=CYTO_COLORS[tissue],bend=.035,ripple=.012,phase=0,nu=quality.u,nv=quality.v}={}){
  return patch(id,(u,v)=>{const x=(u-.5)*2,y=(v-.5)*2;return[p[0]+x*size[0],p[1]+y*size[1]+bend*x*x,p[2]+ripple*Math.sin(x*4+phase)*Math.cos(y*2)+size[2]*Math.cos(y*Math.PI/2)]},{nu,nv,tissue,color,flags:{foldedContinuousSheet:true}});
 }
 function cisterna(id,p,size,{tissue='membrane',color=CYTO_COLORS[tissue],bend=.07,ripple=.012,phase=0,cut=false,nu=quality.u,nv=quality.v}={}){return body(id,p,size,{tissue,color,lobes:.045,phase,bend,ripple,cut,nu,nv})}
 function helix(id,p,{length=.35,radius=.025,turns=3,thickness=.0045,tissue='chromatin',color=CYTO_COLORS[tissue],axis='x',phase=0,segments=quality.tube}={}){const points=[];for(let i=0;i<=96;i++){const t=i/96,a=t*TAU*turns+phase;points.push(axis==='y'?[p[0]+radius*Math.cos(a),p[1]+length*(t-.5),p[2]+radius*Math.sin(a)]:[p[0]+length*(t-.5),p[1]+radius*Math.cos(a),p[2]+radius*Math.sin(a)])}return tube(id,points,thickness,{tissue,color,segments})}
 function channel(id,p,{radius=.04,length=.12,tissue='protein',color=CYTO_COLORS[tissue],axis='z',lobes=7}={}){
  const outer=(u,v)=>{const a=u*TAU,r=radius*(1+.10*Math.sin(lobes*a))*(.92+.15*Math.cos(v*TAU));const q=[r*Math.cos(a),r*Math.sin(a),(v-.5)*length];if(axis==='y')[q[1],q[2]]=[q[2],q[1]];return q.map((x,i)=>x+p[i])};
  patch(id,outer,{nu:mobile?42:70,nv:mobile?12:20,tissue,color,flags:{openProteinChannel:true}});
  patch(id,(u,v)=>{const a=u*TAU,r=radius*.47*(1+.07*Math.sin(lobes*a)),q=[r*Math.cos(a),r*Math.sin(a),(v-.5)*length];if(axis==='y')[q[1],q[2]]=[q[2],q[1]];return q.map((x,i)=>x+p[i])},{nu:mobile?42:70,nv:mobile?12:20,tissue,color,flags:{openProteinChannel:true}});
  for(const end of[-1,1])patch(id,(u,v)=>{const a=u*TAU,r=radius*(.47+(.92*(1+.10*Math.sin(lobes*a))-.47)*v),q=[r*Math.cos(a),r*Math.sin(a),end*length/2];if(axis==='y')[q[1],q[2]]=[q[2],q[1]];return q.map((x,i)=>x+p[i])},{nu:mobile?42:70,nv:3,tissue,color});
 }
 function ribosome(id,p,scale=.04,{color=CYTO_COLORS.protein}={}){body(id,[p[0],p[1]+scale*.32,p[2]],[scale,scale*.73,scale*.68],{lobes:.16,color,nu:mobile?16:24,nv:mobile?8:12});body(id,[p[0]+scale*.12,p[1]-scale*.62,p[2]],[scale*.85,scale*.42,scale*.60],{lobes:.12,phase:1,color,nu:mobile?16:24,nv:mobile?8:12})}
 function mitochondrion(id,p,size=[.18,.09,.065],{simple=false}={}){
  const nu=simple?quality.smallU:quality.u,nv=simple?quality.smallV:quality.v;shell(id,p,size,{thickness:size[1]*.11,nu,nv,color:CYTO_COLORS.membrane,phase:.8});
  // Repeated lamellar folds grow from the same inner boundary, with gently
  // scalloped free margins. These are membrane folds, not loose rods.
  for(let j=0;j<5;j++){const x=p[0]+size[0]*(-.66+j*.33),w=size[0]*.11;patch(id,(u,v)=>{const y=(u-.5)*size[1]*1.5,z=p[2]-size[2]*.70+v*size[2]*.74;return[x+w*Math.sin(v*Math.PI)*Math.cos(u*Math.PI*2),p[1]+y,z]},{nu:simple?12:quality.smallU,nv:simple?10:quality.smallV,tissue:'membrane',color:CYTO_COLORS.protein,flags:{connectedCrista:true}})}
 }
 function finish(extra={}){
  for(const p of parts){const entries=pending.get(p.id);if(!entries.size)throw new Error('Parte sem superfície: '+def.id+'/'+p.id);for(const {tissue,color,geos} of entries.values()){const g=mergeCytologySurfaces(geos,{cytologyPart:p.id,cytologyTissue:tissue});geometries.add(g);const mat=new THREE.MeshStandardMaterial({color,roughness:.71,metalness:0,side:THREE.DoubleSide,forceSinglePass:true});materials.add(mat);const mesh=new THREE.Mesh(g,mat);mesh.name=p.object.name+'_'+tissue;mesh.userData={partId:p.id,atlasName:p.object.name,cytology:true,educational:true,schematic:true,cytologyTissue:tissue};p.object.add(mesh)}}
  group.updateMatrixWorld(true);const originalBounds=new THREE.Box3().setFromObject(group),size=originalBounds.getSize(new THREE.Vector3()),center=originalBounds.getCenter(new THREE.Vector3()),scale=.22/Math.max(...size.toArray());group.scale.setScalar(scale);group.position.copy(center.multiplyScalar(-scale));group.updateMatrixWorld(true);let meshes=0,triangles=0;group.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3}});
  return{id:def.id,title:def.title||def.label,label:def.label||def.title,description:def.description,group,parts,bounds:new THREE.Box3().setFromObject(group),sourceIds:def.sourceIds||[],authoredReconstruction:true,limits:'Reconstrução citológica autoral para ensino. Cortes expõem compartimentos; cores e proporções são didáticas. Superfícies e símbolos moleculares não são microscopia real, estruturas atômicas resolvidas nem simulação molecular.',stats:{parts:parts.length,meshes,triangles,geometries:geometries.size,materials:materials.size,mobile,continuousBiologicalSurfaces:true,...extra},dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const g of geometries){g.disposeBoundsTree?.();g.dispose()}for(const m of materials)m.dispose();group.clear();geometries.clear();materials.clear();pending.clear()}};
 }
 return {def,group,parts,quality,mobile,at,add,patch,body,shell,tube,loop,sheet,cisterna,helix,channel,ribosome,mitochondrion,finish};
}
