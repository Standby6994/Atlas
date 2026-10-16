import * as THREE from 'three';
import {createCytologyContext} from './cytology-surfaces.js';

// Original educational topology, not segmented microscopy. Every selectable
// group has its own continuous tissue surfaces. Open windows expose actual
// internal layers, vessel lumina and cell interfaces rather than solid caps.
export const BOTANY_IDS=Object.freeze(['leaf-cross-section','root-primary','stem-eudicot','stem-monocot','stem-secondary','stomatal-complex','xylem-water','phloem-translocation','meristems-growth','flower','seed-germination','double-fertilization','plant-responses']);
const TAU=Math.PI*2;
const C={wall:0xb7b38a,epidermis:0xc5c7a2,cuticle:0xb6aa71,chloroplast:0x7a936b,lignin:0xa58968,phloem:0xa4a788,meristem:0xb9a4ae,matrix:0xa7bdba,protein:0xbd9c79,membrane:0xb0b798,chromatin:0x9c819c,lipid:0xcbba81,petal:0xc298ac};

function extensions(c,mobile){
 const n=mobile?40:64,small=mobile?16:24,deep=mobile?10:16;
 function patch(id,fn,tissue='wall',color=C[tissue],nu=n,nv=deep,flags={}){return c.patch(id,fn,{nu,nv,tissue,color,flags})}
 // A cylindrical tissue sector with a real central space and axial cut faces.
 // The outer outline undulates coherently; all six boundaries share one map.
 function band(id,r0,r1,z0,z1,{start=.36,end=TAU-.36,tissue='wall',color=C[tissue],cells=0,phase=0}={}){
  const point=(a,r,z)=>{const k=1+.018*Math.sin(5*a+phase)+.009*Math.cos(9*a-phase);return[r*k*Math.cos(a),r*k*Math.sin(a),z]};
  const radial=(a,v)=>r0+(r1-r0)*v;
  for(const z of[z0,z1])patch(id,(u,v)=>point(start+(end-start)*u,radial(0,v),z),tissue,color,n,4,{annularTissue:true,cutFace:true});
  for(const r of[r0,r1])if(r>0)patch(id,(u,v)=>point(start+(end-start)*u,r,z0+(z1-z0)*v),tissue,color,n,deep,{annularTissue:true,openAxialLumen:r===r0});
  for(const a of[start,end])patch(id,(u,v)=>point(a,r0+(r1-r0)*u,z0+(z1-z0)*v),tissue,color,8,deep,{radialCutFace:true});
  if(cells)for(let i=1;i<cells;i++){const a=start+(end-start)*i/cells;const pts=[];for(let j=0;j<=8;j++){const r=r0+(r1-r0)*j/8;pts.push(point(a+.007*Math.sin(j*.7),r,z1+.002))}c.tube(id,pts,.0018,{tissue,color:0x79775e,segments:12,radial:4})}
 }
 // A wavy, smoothly joined cell wall tube. Angled windows preserve a true
 // open lumen; cut faces join inner and outer surfaces and expose thickness.
 function vessel(id,p,r,length,{tissue='lignin',color=C[tissue],start=.30,end=TAU-.30,wall=.012,flutes=8}={}){
  const ring=(a,z,rad)=>[p[0]+rad*(1+.025*Math.cos(flutes*a+z*3))*Math.cos(a),p[1]+z,p[2]+rad*(1+.025*Math.cos(flutes*a+z*3))*Math.sin(a)];
  for(const rad of[r,r-wall])patch(id,(u,v)=>ring(start+(end-start)*u,length*(v-.5),rad),tissue,color,n,deep,{openAxialLumen:true,continuousVesselWall:true});
  for(const z of[-length/2,length/2])patch(id,(u,v)=>ring(start+(end-start)*u,z,r-wall+wall*v),tissue,color,n,3,{openEndRim:true});
  for(const a of[start,end])patch(id,(u,v)=>ring(a,length*(v-.5),r-wall+wall*u),tissue,color,3,deep,{longitudinalCutLip:true});
 }
 // The inside of an irregular cell is visible at the front. Adjacent cells
 // are placed on matching rows, so tissue is an organized layer, not a cloud.
 function cell(id,p,size,{tissue='wall',color=C[tissue],phase=0,cut=true,nu=small,nv=deep,lobes=.075}={}){
  // Smooth lobed cell outlines avoid the former signed-power superellipsoid:
  // that map concentrated curvature at four corners and produced faceted
  // pillows even when the aggregate triangle count was large.
  const around=Math.max(nu,mobile?24:36),across=Math.max(nv,mobile?12:18);
  return patch(id,(u,v)=>{const a=u*TAU,t=(cut?Math.PI/2:0)+v*(cut?Math.PI/2:Math.PI),s=Math.sin(t),r=1+lobes*Math.sin(3*a+phase)*s*s+lobes*.45*Math.sin(5*a-phase)*s*s;return[p[0]+size[0]*s*Math.cos(a)*r+.035*size[0]*Math.sin(t*2+phase)*s,p[1]+size[1]*s*Math.sin(a)*r,p[2]+size[2]*Math.cos(t)+.035*size[2]*Math.sin(a*3+phase)*s*s]},tissue,color,around,across,{smoothLobedCellWall:true,exposedCell:cut});
 }
 function tile(id,rows,cols,p,size,{tissue='wall',color=C[tissue],irregular=false,depth=.035}={}){
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const x=p[0]+(i-(cols-1)/2)*size[0],y=p[1]+(j-(rows-1)/2)*size[1],phase=i*.9+j*1.3;cell(id,[x,y,p[2]],[size[0]*.495,size[1]*.495,depth],{tissue,color,phase,nu:mobile?12:20,nv:mobile?8:12});
   if(irregular)c.tube(id,[[x-size[0]*.49,y-size[1]*.4,p[2]+.001],[x+size[0]*.1,y-size[1]*.5,p[2]+.002],[x+size[0]*.49,y-size[1]*.38,p[2]+.001]],.0018,{tissue,color:0x798065,segments:12,radial:4});}
 }
 function tissueSection(id,r0,r1,z0,z1,{holes=[],tissue='wall',color=C[tissue],start=.36,end=TAU-.36}={}){
  const shape=new THREE.Shape(),coords=(r,a)=>[r*(1+.018*Math.sin(5*a)+.009*Math.cos(9*a))*Math.cos(a),r*(1+.018*Math.sin(5*a)+.009*Math.cos(9*a))*Math.sin(a)];
  shape.moveTo(...coords(r0,start));shape.lineTo(...coords(r1,start));for(let i=1;i<=n;i++)shape.lineTo(...coords(r1,start+(end-start)*i/n));shape.lineTo(...coords(r0,end));for(let i=n-1;i>=0;i--)shape.lineTo(...coords(r0,start+(end-start)*i/n));shape.closePath();
  for(const h of holes){const path=new THREE.Path();path.absellipse(h.x,h.y,h.r,h.r,0,TAU,true);shape.holes.push(path)}
  const geo=new THREE.ExtrudeGeometry(shape,{depth:z1-z0,steps:mobile?8:14,bevelEnabled:false,curveSegments:mobile?12:20});geo.translate(0,0,z0);geo.userData={continuousTissueSection:true,vascularOpenings:holes.length};c.add(id,geo,tissue,color);
 }
 function plate(id,p,r,{holes=0,tissue='wall',color=C[tissue],axis='y'}={}){
  const shape=new THREE.Shape();shape.absellipse(0,0,r,r,0,TAU,false);
  if(holes){const pts=[[0,0]];for(let i=0;i<6;i++){const a=i/6*TAU;pts.push([r*.57*Math.cos(a),r*.57*Math.sin(a)])}for(const [x,y] of pts.slice(0,holes)){const h=new THREE.Path();h.absellipse(x,y,r*.15,r*.15,0,TAU,true);shape.holes.push(h)}}
  const g=new THREE.ExtrudeGeometry(shape,{depth:.008,steps:1,bevelEnabled:true,bevelThickness:.001,bevelSize:.001,bevelSegments:1,curveSegments:mobile?18:32});
  if(axis==='y')g.rotateX(Math.PI/2);g.translate(...p);return c.add(id,g,tissue,color);
 }
 function petal(id,angle,{length=.62,width=.22,lift=.30,base=.07,tissue='wall',color=C[tissue],phase=0}={}){
  patch(id,(u,v)=>{const t=v,side=(u-.5)*2,w=width*Math.sin(Math.PI*t)**.72*(1+.05*Math.sin(5*t+phase));const radial=base+length*t,along=radial+.04*Math.cos(Math.PI*side)*Math.sin(Math.PI*t);const z=lift*t*t+.035*side*side*Math.sin(Math.PI*t)+.012*Math.sin(8*t+phase)*Math.sin(Math.PI*t);return[along*Math.cos(angle)-side*w*Math.sin(angle),along*Math.sin(angle)+side*w*Math.cos(angle),z]},tissue,color,mobile?20:36,mobile?32:56,{continuousPetalLamina:true});
 }
 return {patch,band,tissueSection,vessel,cell,tile,plate,petal,n,small,deep};
}

function leaf(c,e,mobile){
 for(const [id,y,thick] of[['upper-epidermis',.245,.037],['lower-epidermis',-.25,.035]]){
  // Pavement cells share a single undulating epidermal skin. Fine anticlinal
  // seams delimit contiguous cells without raising rows of pillow-shaped caps.
  for(const side of[-1,1]){
   const g=e.patch(id,(u,v)=>{const x=(u-.5)*1.10,z=(v-.5)*.40,skin=y+side*.019;return[x,skin+.004*Math.sin(x*16+z*9)+.002*Math.cos(z*24-x*8),z]},'wall',C.epidermis,mobile?64:96,mobile?24:36,{continuousPavementLayer:true});
   if(id==='lower-epidermis'){const p=g.attributes.position,indices=g.index.array,keep=[];for(let i=0;i<indices.length;i+=3){const a=indices[i],b=indices[i+1],d=indices[i+2],x=(p.getX(a)+p.getX(b)+p.getX(d))/3,z=(p.getZ(a)+p.getZ(b)+p.getZ(d))/3;if(((x-.3115)/.036)**2+(z/.053)**2<1)continue;keep.push(a,b,d)}g.setIndex(keep);g.computeVertexNormals();}
  }
  const boundaries=12;
  for(let i=1;i<boundaries;i++){const x=-.55+i*1.1/boundaries,points=[];for(let j=0;j<=18;j++){const z=-.20+j/18*.40;points.push([x+.010*Math.sin(z*29+i*.83)+.004*Math.sin(z*55-i*.4),y+.023+.004*Math.sin(x*16+z*9),z]);}c.tube(id,points,.0018,{tissue:'wall',color:0x929b77,segments:mobile?20:36,radial:6});}
  for(const z0 of[-.065,.065]){const points=[];for(let j=0;j<=44;j++){const x=-.55+j/44*1.1;points.push([x,y+.023+.004*Math.sin(x*16+z0*9),z0+.012*Math.sin(x*18)+.004*Math.cos(x*36)]);}c.tube(id,points,.0018,{tissue:'wall',color:0x929b77,segments:mobile?40:64,radial:6});}
  // Curved outer cut face joins the upper and lower skin boundaries.
  for(const z of[-.20,.20])e.patch(id,(u,v)=>{const x=(u-.5)*1.10;return[x,y+(v-.5)*.038+.004*Math.sin(x*16+z*9),z]},'wall',C.epidermis,mobile?48:76,5,{epidermalCutEdge:true});
 }
 // The lower surface contains a genuine gap between two curved guard cells.
 for(const side of[-1,1]){const points=[];for(let i=0;i<=24;i++){const a=-1.35+i/24*2.7;points.push([.3115+side*(.008+.019*Math.cos(a)),-.272,.050*Math.sin(a)])}c.tube('lower-epidermis',points,.010,{tissue:'wall',color:0x879d75,segments:mobile?24:40,radial:8});}
 // A continuous wax-bearing layer follows the same leaf contour.
 e.patch('cuticle',(u,v)=>[(u-.5)*1.1,.280+.006*Math.sin(u*12)*Math.sin(v*5),(v-.5)*.4],'cuticle',C.cuticle,mobile?40:70,12,{continuousEpidermalCoating:true});
 for(let i=0;i<10;i++)for(let j=0;j<2;j++){
  const x=(i-4.5)*.105+.003*Math.sin(i*1.8),y=.12+.006*Math.sin(i*.9),z=(j-.5)*.17,phase=i*.6+j;
  // A long, gently tapering cell with an exposed internal compartment. The
  // wall lip, vacuolar interior and peripheral chloroplasts remain attached to
  // this same cell envelope rather than a row of generic solid green blocks.
  c.shell('palisade',[x,y,z],[.052,.105,.080],{thickness:.004,tissue:'wall',color:0xb9c2a1,lobes:.050,phase,exponent:1,nu:mobile?28:44,nv:mobile?12:18});
  e.cell('palisade',[x,y,z-.020],[.044,.091,.055],{tissue:'matrix',color:0xb8c8ae,phase,cut:true,nu:mobile?20:28,nv:mobile?10:14,lobes:.035});
  for(let k=0;k<6;k++){const a=.25+k/6*TAU;c.body('palisade',[x+.033*Math.cos(a),y+.074*Math.sin(a),z-.004],[.008,.015,.005],{tissue:'chloroplast',color:0x6f8e5b,lobes:.035,phase,cut:false,nu:mobile?12:18,nv:mobile?8:10});}
 }
 // Lacunose tissue has genuine open intercellular spaces, not a solid block.
 for(let j=0;j<2;j++)for(let i=0;i<8;i++){const x=(i-3.5)*.13+(j?.035:0),y=-.08+(i%2)*.025,z=(j-.5)*.18;e.cell('spongy',[x,y,z],[.067,.059,.073],{tissue:'chloroplast',phase:i+j,lobes:.21,cut:false,nu:mobile?28:44,nv:mobile?14:20});if(i<7)c.tube('spongy',[[x+.043,y-.02,z],[x+.073,y-.052,z+.012],[x+.10,y-.03,z]],.016,{tissue:'chloroplast',color:C.chloroplast,segments:mobile?20:32,radial:8});}
 // Bundle sheath encircles both tissues; vessels run along the actual vein.
 // One continuous annular cellular tissue replaces the necklace of faceted
 // cell blocks. Joined inner/outer walls and cut lips express tissue depth.
 e.band('bundle-sheath',.145,.193,-.19,.20,{start:0,end:TAU,color:0xbfc3a1,cells:18});
 c.at('bundle-sheath').position.set(.03,-.035,0);
 for(const x of[-.025,.045,.115])e.vessel('xylem',[x,.035,.02],.025,.32);
 // Local vessel helper uses Y as axis: rotate complete reference into the vein.
 c.at('xylem').rotation.x=Math.PI/2;c.at('xylem').position.y=.06;
 for(let i=0;i<4;i++)e.cell('phloem',[i*.043-.04,-.11,.025],[.023,.029,.19],{color:C.phloem,cut:false,lobes:.09,nu:mobile?24:36,nv:mobile?12:18});
}

function root(c,e,mobile){
 e.band('rhizodermis',.48,.525,-.18,.17,{cells:28,color:C.epidermis});
 e.band('cortex',.28,.477,-.18,.17,{cells:26,color:C.wall});
 // Inner cortical seams form aligned, organized radial cell files.
 for(const r of[.344,.411])e.band('cortex',r-.002,r+.002,.169,.175,{color:0x8f9374,cells:24});
 e.band('endodermis',.246,.278,-.18,.17,{cells:24,color:0xb1a18a});
 e.band('pericycle',.215,.243,-.18,.17,{cells:22,color:0xb8b09a});
 // Each endodermal cell has a belt on its anticlinal side boundaries.
 for(let i=0;i<24;i++){const a=.36+(TAU-.72)*i/24,b=.36+(TAU-.72)*(i+1)/24,mid=.262,pts=[];
  // A belt surrounds each endodermal cell on its radial/transverse walls.
  // It is not a ring drawn on the outer periclinal face of the whole root.
  for(let j=0;j<=8;j++){const angle=a+(b-a)*j/8;pts.push([mid*Math.cos(angle),mid*Math.sin(angle),-.173]);}
  pts.push([mid*Math.cos(b),mid*Math.sin(b),.173]);for(let j=8;j>=0;j--){const angle=a+(b-a)*j/8;pts.push([mid*Math.cos(angle),mid*Math.sin(angle),.173]);}
  c.tube('casparian-strip',pts,.0032,{tissue:'lignin',color:0x82654f,closed:true,segments:mobile?40:64,radial:6});
 }
 for(let i=0;i<12;i++){const a=.5+i*(TAU-.9)/12,r=.521;c.tube('root-hairs',[[r*Math.cos(a),r*Math.sin(a),-.07],[r*1.15*Math.cos(a+.02),r*1.15*Math.sin(a+.02),-.06],[r*1.39*Math.cos(a+.04),r*1.39*Math.sin(a+.04),-.02],[r*1.52*Math.cos(a+.015),r*1.52*Math.sin(a+.015),.01]],.009,{tissue:'wall',color:C.epidermis,segments:mobile?22:40,radial:8,taper:.65});}
 for(let ray=0;ray<5;ray++){const a=ray/5*TAU+.62;for(let j=0;j<3;j++){const r=.045+j*.063,x=r*Math.cos(a),y=r*Math.sin(a);e.vessel('root-xylem',[x,-.005,-y],.027-j*.003,.34,{start:0,end:TAU,wall:.009});}const b=a+Math.PI/5;e.cell('root-phloem',[.148*Math.cos(b),.148*Math.sin(b),.0],[.042,.041,.18],{color:C.phloem,cut:false});}
 c.at('root-xylem').rotation.x=Math.PI/2;
}

function stem(c,e,mono){
 e.band('epidermis',.49,.52,-.18,.18,{cells:32,color:C.epidermis});
 const centers=[];
 if(mono){for(const [r,count,phase] of[[.14,4,.4],[.29,7,.7],[.405,10,.18]])for(let i=0;i<count;i++){const a=phase+i/count*TAU,margin=Math.asin(.060/r);if(a>.36+margin&&a<TAU-.36-margin)centers.push([r*Math.cos(a),r*Math.sin(a),a]);}}
 else for(let i=0;i<9;i++){const a=.68+i/9*TAU;if(a<TAU-.36-Math.asin(.075/.34))centers.push([.34*Math.cos(a),.34*Math.sin(a),a]);}
 e.tissueSection('ground-tissue',0,.487,-.18,.18,{holes:centers.map(([x,y])=>({x,y,r:mono?.057:.073})),color:C.wall});
 // The exposed surface carries an interconnected mosaic, not decorative balls.
 const rows=mono?8:7,step=.112;for(let j=-rows/2;j<=rows/2;j++)for(let i=-rows/2;i<=rows/2;i++){const x=i*step+(j%2)*step*.5,y=j*step*.86;if(Math.hypot(x,y)>.43||centers.some(([cx,cy])=>Math.hypot(x-cx,y-cy)<(mono?.11:.13)))continue;const angle=(Math.atan2(y,x)+TAU)%TAU;if(angle<.36||angle>TAU-.36)continue;const pts=[];for(let k=0;k<=6;k++){const a=k/6*TAU;pts.push([x+step*.54*Math.cos(a),y+step*.47*Math.sin(a),.184])}c.tube('ground-tissue',pts,.0018,{tissue:'wall',color:0x878c70,segments:12,radial:4,closed:true});}
 for(const [x,y,a]of centers){
  const ix=x-.021*Math.cos(a),iy=y-.021*Math.sin(a),ox=x+.041*Math.cos(a),oy=y+.041*Math.sin(a);
  for(const off of[-.017,.017]){const xx=ix-off*Math.sin(a),yy=iy+off*Math.cos(a);e.vessel('xylem',[xx,0,-yy],mono?.014:.021,.37,{wall:mono?.005:.007,start:0,end:TAU});}
  e.cell('phloem',[ox,oy,.019],[mono?.020:.032,mono?.024:.036,.18],{color:C.phloem,cut:false,nu:16,nv:12});
  if(mono){const pts=[];for(let k=0;k<24;k++){const t=k/24*TAU;pts.push([x+.055*Math.cos(t),y+.055*Math.sin(t),.192])}c.tube('bundle-sheath',pts,.005,{tissue:'lignin',color:0x877c58,closed:true,segments:24,radial:6});}
  else{const tx=x+.008*Math.cos(a),ty=y+.008*Math.sin(a);e.patch('cambium',(u,v)=>[tx+(u-.5)*.075*(-Math.sin(a)),ty+(u-.5)*.075*Math.cos(a),-.18+v*.37],'wall',C.meristem,16,e.deep,{fascicularCambium:true});}
 }
 c.at('xylem').rotation.x=Math.PI/2;
 // The front cut is intentionally removed around vascular compartments so the
 // conducting lumina are never hidden behind a solid ground-tissue cap.
}

function secondary(c,e){
 for(const [id,r0,r1,color,cells]of[['secondary-xylem',.08,.34,C.lignin,32],['vascular-cambium',.342,.355,C.meristem,42],['secondary-phloem',.358,.403,C.phloem,30],['phelloderm',.407,.425,0xb7b18c,32],['cork-cambium',.428,.440,C.meristem,38],['cork',.443,.51,0x927b63,28]])e.band(id,r0,r1,-.22,.22,{color,tissue:id==='secondary-xylem'?'lignin':id==='cork'?'cuticle':'wall',cells});
 for(let i=0;i<12;i++){const a=.43+i/12*(TAU-.86);e.patch('rays',(u,v)=>{const r=.09+u*.31,w=(v-.5)*.010;return[r*Math.cos(a)-w*Math.sin(a),r*Math.sin(a)+w*Math.cos(a),.225+.005*Math.sin(u*15)]},'wall',0xcbba91,30,4,{radialParenchymaRay:true});}
 // Visible pores of open axial vessels in the wood, represented by rings.
 for(let i=0;i<18;i++){const a=.5+i/18*(TAU-1),r=.21+(i%3)*.035;const pts=[];for(let j=0;j<16;j++){const t=j/16*TAU;pts.push([r*Math.cos(a)+.011*Math.cos(t),r*Math.sin(a)+.011*Math.sin(t),.226])}c.tube('secondary-xylem',pts,.003,{tissue:'lignin',color:0x745f47,segments:20,radial:6,closed:true});}
}

function stoma(c,e,mobile){
 // Guard-cell outline is a true bent tube; its inward wall borders the gap.
 for(const side of[-1,1]){
  e.patch('guard-cells',(u,v)=>{const a=-Math.PI*.46+u*Math.PI*.92,t=v*TAU,x=side*(.10+.19*Math.cos(a)),y=.39*Math.sin(a),r=.075*(.68+.32*Math.sin(Math.PI*u));return[x+side*r*Math.cos(a)*Math.cos(t),y+r*Math.sin(a)*Math.cos(t),r*.68*Math.sin(t)]},'wall',0xa4b084,mobile?48:80,mobile?20:32,{curvedGuardCell:true,centralPoreGap:true});
  e.patch('inner-wall',(u,v)=>{const a=-Math.PI*.43+u*Math.PI*.86,w=.013+v*.014,x=side*(.10+.19*Math.cos(a)-.075),y=.39*Math.sin(a);return[x-side*w*Math.cos(a),y-w*Math.sin(a),.044-.015*Math.cos(a)]},'wall',0x77835e,mobile?40:64,8,{thickenedInnerWall:true});
  e.patch('vacuoles',(u,v)=>{const a=-Math.PI*.39+u*Math.PI*.78,t=v*TAU,x=side*(.10+.19*Math.cos(a)),y=.39*Math.sin(a),r=.044*Math.sin(Math.PI*u)**.3;return[x+side*r*Math.cos(a)*Math.cos(t),y+r*Math.sin(a)*Math.cos(t),.015+r*.48*Math.sin(t)]},'membrane',0xb7c7b7,mobile?36:60,16,{curvedVacuolarCompartment:true});
  for(let i=0;i<7;i++){const a=-1.07+i*.35;c.body('chloroplasts',[side*(.10+.19*Math.cos(a)+.043),.39*Math.sin(a),.033],[.024,.031,.012],{tissue:'chloroplast',color:0x69855a,lobes:.03,cut:false,nu:mobile?12:20,nv:mobile?8:12});}
 }
 // Poral volume sits below the open surface and never caps the central gap.
 e.patch('pore',(u,v)=>{const a=u*TAU,r=.083+v*.007;return[r*Math.cos(a),.28*Math.sin(a),-.065+.028*Math.cos(a)**2]},'matrix',0x5a7775,mobile?40:64,4,{poreBoundaryMarker:true,notSolidCell:true});
 for(const [x,y,sx,sy]of[[-.47,-.26,.15,.14],[-.47,0,.15,.12],[-.47,.26,.15,.14],[.47,-.26,.15,.14],[.47,0,.15,.12],[.47,.26,.15,.14],[-.23,-.49,.16,.09],[.10,-.49,.17,.09],[-.23,.49,.16,.09],[.10,.49,.17,.09]]){
  e.cell('epidermal-cells',[x,y,-.01],[sx,sy,.032],{color:C.epidermis,phase:x*7+y*2,cut:false,nu:mobile?20:32,nv:mobile?10:16});
 }
}

function xylem(c,e,mobile){
 e.vessel('vessel-wall',[0,0,0],.18,.93,{wall:.025,start:.38,end:TAU-.38});
 const pts=[];for(let i=0;i<=220;i++){const t=i/220,a=t*TAU*5+.48;pts.push([.183*Math.cos(a),-.45+.9*t,.183*Math.sin(a)])}c.tube('spiral-thickening',pts,.012,{tissue:'lignin',color:0x7e644b,segments:mobile?160:256,radial:mobile?7:10});
 // Open terminal perforation: an annular wall rim around a real hole.
 for(const y of[-.46,.46]){const pts=[];for(let i=0;i<40;i++){const a=i/40*TAU;pts.push([.154*Math.cos(a),y,.154*Math.sin(a)])}c.tube('perforation',pts,.019,{tissue:'wall',color:C.lignin,closed:true,segments:mobile?40:64,radial:8});}
 for(let i=0;i<9;i++){const y=-.36+i*.09,a=2.72+.12*Math.sin(i);const center=[.157*Math.cos(a),y,.157*Math.sin(a)];e.patch('pits',(u,v)=>{const t=u*TAU,r=.023*(.6+.4*v);return[center[0]+.003*Math.sin(t),center[1]+r*Math.cos(t),center[2]+r*.7*Math.sin(t)]},'wall',0xa8a880,mobile?20:32,4,{pitMembraneNotFreeHole:true});}
 e.patch('water-column',(u,v)=>{const a=(.55+(TAU-1.1)*u),r=.133+.004*Math.sin(v*12);return[r*Math.cos(a),-.445+.89*v,r*Math.sin(a)]},'matrix',0x8eaeb0,mobile?32:56,mobile?20:32,{waterLumenDisplay:true,notWall:true});
 e.patch('evaporating-wall',(u,v)=>{const x=(u-.5)*.52,z=(v-.5)*.38;return[x,.56+.035*Math.cos(x*6)*Math.cos(z*7),z]},'wall',0xa2b18a,mobile?28:48,mobile?16:26,{mesophyllInterfaceSeparateScale:true});
 c.tube('evaporating-wall',[[0,.46,0],[0,.52,.02],[.16,.555,.04]],.024,{tissue:'wall',color:0xa2b18a,segments:24,radial:8});
}

function phloem(c,e,mobile){
 e.vessel('sieve-tube',[0,0,0],.14,.92,{tissue:'wall',color:C.phloem,wall:.015,start:.34,end:TAU-.34});
 for(const y of[-.45,0,.45])e.plate('sieve-plates',[0,y,0],.126,{holes:7,color:0x98a17e});
 for(const y of[-.225,.225]){
  e.cell('companion-cell',[.205,y,-.018],[.053,.218,.081],{tissue:'membrane',color:0xb5bc9a,cut:true,nu:mobile?24:40,nv:mobile?16:26});
  c.body('companion-cell',[.21,y,-.022],[.025,.044,.026],{tissue:'chromatin',color:C.chromatin,cut:false,nu:mobile?16:24,nv:mobile?10:16});
  for(const off of[-.11,.04])c.tube('plasmodesmata',[[.13,y+off,-.007],[.15,y+off+.003,-.007],[.17,y+off,-.009]],.0045,{tissue:'membrane',color:0x6f856a,segments:mobile?10:16,radial:6});
 }
 // Source and sink are adjoining tissue domains, not isolated sugar spheres.
 e.tile('source',2,3,[-.30,.41,-.012],[.085,.08],{tissue:'chloroplast',color:0x89a174,depth:.065});
 e.tile('sink',2,3,[-.30,-.41,-.012],[.085,.08],{color:0xbdb294,depth:.065});
 c.tube('source',[[-.18,.4,-.02],[-.15,.37,-.02],[-.13,.32,-.02]],.021,{tissue:'wall',color:0x89a174,segments:20,radial:8});
 c.tube('sink',[[-.13,-.32,-.02],[-.15,-.37,-.02],[-.18,-.4,-.02]],.021,{tissue:'wall',color:0xbdb294,segments:20,radial:8});
}

function meristems(c,e,mobile){
 // Shared cell files widen progressively; zones are continuous, not unrelated
 // floating panels. The root cap wraps the apical end of the same axis.
 for(let j=0;j<4;j++)for(let i=0;i<7;i++){const x=(i-3)*.055,y=-.39+j*.05;e.cell('apical-meristem',[x,y,0],[.027,.024,.072],{color:C.meristem,phase:i+j,nu:mobile?12:20,nv:mobile?8:12});}
 for(let j=0;j<3;j++)for(let i=0;i<7;i++){const x=(i-3)*.055,y=-.15+j*.11;e.cell('elongation',[x,y,0],[.027,.053,.075],{phase:i+j,nu:mobile?12:20,nv:mobile?8:12});}
 for(let j=0;j<2;j++)for(let i=0;i<7;i++){const x=(i-3)*.055,y=.18+j*.15;e.cell('differentiation',[x,y,0],[.027,.073,.078],{phase:i+j,nu:mobile?12:20,nv:mobile?8:12});}
 c.shell('root-cap',[0,-.43,0],[.23,.18,.10],{thickness:.025,tissue:'wall',color:0xaeb893,nu:mobile?40:64,nv:mobile?16:24});
 for(let i=0;i<6;i++){const y=.15+i*.055,side=i%2?1:-1;c.tube('differentiation',[[side*.19,y,-.018],[side*.27,y+.018,-.012],[side*.35,y+.04,.0]],.007,{tissue:'wall',color:C.wall,segments:mobile?14:24,radial:6,taper:.6});}
 // A separate curved lateral-meristem swatch is explicitly a comparison inset.
 e.patch('lateral-meristem',(u,v)=>[.48+.04*Math.sin(u*Math.PI),-.36+v*.73,(u-.5)*.16],'wall',C.meristem,mobile?16:24,mobile?32:48,{comparisonInset:true,notRootApicalTissue:true});
}

function flower(c,e,mobile){
 for(let i=0;i<5;i++){const a=i/5*TAU;e.petal('petals',a,{length:.57,width:.19,lift:.27,color:C.petal,phase:i});e.petal('sepals',a+Math.PI/5,{length:.35,width:.085,lift:-.08,color:0x7f9366,phase:i});}
 for(let i=0;i<10;i++){const a=i/10*TAU,r=.23,top=[r*Math.cos(a),r*Math.sin(a),.35+.025*Math.sin(i)];c.tube('filaments',[[.09*Math.cos(a),.09*Math.sin(a),.01],[r*.75*Math.cos(a),r*.75*Math.sin(a),.2],top],.011,{tissue:'wall',color:0xc3bc94,segments:mobile?28:44,radial:8});
  for(const side of[-1,1])c.body('anthers',[top[0]+side*.016*Math.cos(a),top[1]+side*.016*Math.sin(a),top[2]],[.026,.055,.036],{tissue:'wall',color:0xb59d65,lobes:.10,phase:i,cut:false,nu:mobile?16:24,nv:mobile?10:16});}
 c.shell('ovary',[0,0,.03],[.13,.13,.18],{thickness:.018,tissue:'wall',color:0x9eaa7c,nu:mobile?48:80,nv:mobile?20:32});
 // Reorient shell's cut window toward the viewer, keeping style attached above.
 c.at('ovary').rotation.x=Math.PI/2;c.at('ovary').position.z=.06;
 c.tube('style',[[0,0,.06],[0,0,.26],[.006,0,.47]],.024,{tissue:'wall',color:0xb6bc91,segments:mobile?32:56,radial:12});
 e.patch('stigma',(u,v)=>{const a=u*TAU,r=.015+.048*v;return[r*Math.cos(a),r*Math.sin(a),.48+.012*Math.sin(v*Math.PI)+.003*Math.sin(a*7)]},'wall',0xbdbf95,mobile?40:64,10,{receptiveSurface:true});
 for(let i=0;i<5;i++){const a=i/5*TAU;c.body('ovules',[.065*Math.cos(a),.065*Math.sin(a),.08],[.035,.045,.039],{tissue:'wall',color:0xd0c7a0,phase:i,cut:false,nu:mobile?20:32,nv:mobile?12:20});c.tube('ovules',[[0,0,.03],[.035*Math.cos(a),.035*Math.sin(a),.06],[.065*Math.cos(a),.065*Math.sin(a),.08]],.006,{tissue:'wall',color:0xbbb88c,segments:14,radial:6});}
}

function seed(c,e,mobile){
 c.shell('testa',[0,0,0],[.41,.53,.18],{thickness:.023,tissue:'cuticle',color:0x9a8268,lobes:.06,phase:.8,nu:mobile?56:88,nv:mobile?22:34});
 // Continuous internal reserve slab is open at its anterior plane.
 c.body('endosperm',[0,0,-.025],[.37,.48,.13],{tissue:'matrix',color:0xd2c49d,cut:true,nu:mobile?48:80,nv:mobile?20:30,lobes:.025});
 for(const side of[-1,1])c.body('cotyledons',[side*.126,.02,.006],[.13,.32,.058],{tissue:'wall',color:0xb4bb8e,cut:true,exponent:.75,lobes:.035,phase:side,nu:mobile?36:60,nv:mobile?18:28});
 c.tube('radicle',[[0,-.13,.025],[-.02,-.30,.025],[-.045,-.46,.012],[-.07,-.61,.005],[-.10,-.67,.015]],.034,{tissue:'wall',color:0xc5c4a2,taper:.6,segments:mobile?44:76,radial:mobile?10:14});
 c.tube('plumule',[[0,-.12,.024],[.015,.04,.03],[.012,.22,.035],[.025,.30,.03]],.019,{tissue:'wall',color:0x8da171,segments:mobile?28:48,radial:10,taper:.5});
 for(const side of[-1,1])e.patch('plumule',(u,v)=>{const t=v,w=.06*Math.sin(Math.PI*t),x=.01+side*.09*t;return[x+side*w*(u-.5),.13+t*.16,.025+.035*Math.sin(Math.PI*t)*Math.sin(Math.PI*u)]},'wall',0x8da171,mobile?16:24,mobile?24:36,{embryonicLeafPrimordium:true});
 // Enzyme-active reserve interface is a continuous narrow swath, not a new organ.
 e.patch('reserve-mobilization',(u,v)=>{const a=-1.1+u*2.2,r=.29+.02*v;return[r*Math.cos(a),.39*Math.sin(a),.015+.004*Math.sin(u*21)]},'protein',0xbda674,mobile?40:64,8,{physiologicalInterfaceSymbol:true});
}

function fertilization(c,e,mobile){
 // A polar opening is absent from both inner and outer envelopes. The joined
 // half-rim is the micropylar passage; the broad anterior opening is a section.
 const polar=.19,outer=[.40,.57,.19],inner=[.36,.53,.15],point=(a,t,s)=>[s[0]*Math.sin(t)*Math.cos(a),-s[1]*Math.cos(t),s[2]*Math.sin(t)*Math.sin(a)];
 for(const size of[outer,inner])e.patch('integuments',(u,v)=>point(Math.PI+u*Math.PI,polar+(Math.PI-polar)*v,size),'wall',0xb9b18c,mobile?56:88,mobile?22:34,{maternalIntegument:true,trueMicropylarOpening:true});
 e.patch('integuments',(u,v)=>point(Math.PI+u*Math.PI,polar,inner.map((s,i)=>s+(outer[i]-s)*v)),'wall',0xb9b18c,mobile?56:88,4,{micropylarCutRim:true});
 for(const a of[Math.PI,TAU])e.patch('integuments',(u,v)=>point(a,polar+(Math.PI-polar)*u,inner.map((s,i)=>s+(outer[i]-s)*v)),'wall',0xb9b18c,mobile?32:56,4,{anteriorSectionLip:true});
 c.shell('embryo-sac',[0,.015,-.025],[.28,.43,.13],{thickness:.009,tissue:'membrane',color:0xb7c3b5,lobes:.015,nu:mobile?48:80,nv:mobile?20:30});
 // Egg and synergids belong at the same micropylar pole; the central-cell
 // nuclei remain inside one shared space, not in two separate central cells.
 c.body('egg',[0,-.265,.008],[.080,.10,.048],{tissue:'membrane',color:0xc4af9e,cut:false,nu:mobile?24:40,nv:mobile?14:22});
 for(const side of[-1,1])c.body('synergids',[side*.115,-.27,-.002],[.050,.10,.040],{tissue:'membrane',color:0xa4b792,lobes:.04,cut:false,nu:mobile?20:32,nv:mobile?12:20});
 for(const side of[-1,1])c.body('polar-nuclei',[side*.067,.005,.015],[.045,.055,.035],{tissue:'chromatin',color:C.chromatin,cut:false,nu:mobile?20:32,nv:mobile?12:20});
 for(let i=0;i<3;i++)c.body('antipodals',[(i-1)*.084,.335-(i===1?-.02:.012),-.006],[.048,.057,.038],{tissue:'membrane',color:0xa6b4aa,cut:false,nu:mobile?20:32,nv:mobile?12:20});
 const points=[[-.16,-.70,.005],[-.075,-.63,-.008],[-.02,-.56,-.012],[-.045,-.47,.015],[-.09,-.38,.025],[-.095,-.31,.025]];
 c.tube('pollen-tube',points,.018,{tissue:'wall',color:0xb4a78a,segments:mobile?44:76,radial:10});
 for(const [x,y]of[[-.086,-.39],[-.093,-.34]])c.body('sperm-cells',[x,y,.037],[.012,.018,.010],{tissue:'chromatin',color:0x8b7291,cut:false,nu:mobile?12:20,nv:mobile?8:12});
 // The micropylar opening is the genuine exposed seam at the lower cut edge.
 c.at('integuments').userData.micropyle='opening-at-pollen-tube-entry';
}

function responses(c,e,mobile){
 c.tube('elongating-shoot',[[0,-.18,0],[.01,.0,0],[.045,.22,0],[.12,.42,0]],.035,{tissue:'wall',color:0xa4b18c,segments:mobile?48:80,radial:14,taper:.15});
 c.body('shoot-apex',[.12,.43,0],[.05,.08,.04],{tissue:'wall',color:C.meristem,cut:true,nu:mobile?24:40,nv:mobile?14:22});
 c.body('axillary-bud',[-.066,.08,.025],[.04,.063,.036],{tissue:'wall',color:0x9fae83,cut:true,nu:mobile?24:40,nv:mobile?14:22});
 c.tube('axillary-bud',[[.014,.04,0],[-.02,.05,.006],[-.066,.08,.025]],.014,{tissue:'wall',color:0x9fae83,segments:20,radial:8});
 e.patch('leaf-water-response',(u,v)=>{const t=v,side=(u-.5)*2,w=.17*Math.sin(Math.PI*t);return[.015-.42*t,.07+.13*t+side*w,.005+.055*Math.sin(Math.PI*t)*(1-side*side)]},'chloroplast',0x80966b,mobile?24:40,mobile?40:64,{continuousLeafLamina:true});
 c.tube('root-gravity',[[0,-.16,0],[-.005,-.29,0],[-.02,-.39,.0],[-.08,-.48,.005],[-.10,-.58,.01]],.033,{tissue:'wall',color:0xbfbba0,segments:mobile?44:72,radial:12,taper:.45});
 c.body('root-gravity',[-.10,-.585,.01],[.039,.051,.03],{tissue:'wall',color:0xafb68e,cut:true,nu:mobile?20:32,nv:mobile?12:20});
 // A developing lateral organ, attached to the same axis, denotes competence.
 c.tube('growth-context',[[.01,-.045,0],[.10,-.025,.015],[.17,.005,.02]],.02,{tissue:'wall',color:0xc5b899,segments:mobile?24:40,radial:10});
 c.body('growth-context',[.17,.005,.02],[.07,.045,.04],{tissue:'wall',color:0xc5b899,cut:true,nu:mobile?24:40,nv:mobile?14:22});
}

const BUILDERS={'leaf-cross-section':leaf,'root-primary':root,'stem-eudicot':(c,e,m)=>stem(c,e,false),'stem-monocot':(c,e,m)=>stem(c,e,true),'stem-secondary':secondary,'stomatal-complex':stoma,'xylem-water':xylem,'phloem-translocation':phloem,'meristems-growth':meristems,flower,'seed-germination':seed,'double-fertilization':fertilization,'plant-responses':responses};

export function createBotanyModel(id,definition,{mobile=false}={}){
 const key=id.replace(/^botany-/,''),build=BUILDERS[key];
 if(!build)throw new Error('Vista botânica desconhecida: '+id);
 if(!definition||definition.id!==key||!Array.isArray(definition.parts))throw new Error('Definição botânica incompatível: '+key);
 const c=createCytologyContext(definition,{mobile}),e=extensions(c,mobile);build(c,e,mobile);
 const result=c.finish({botany:true,continuousBiologicalSurfaces:true,profile:mobile?'touch':'desktop'});
 result.group.name='BOTANY_'+key;
 result.group.userData={...result.group.userData,botany:true,botanyId:key,cytology:false,notRealHistology:true,authoredReconstruction:true};
 for(const p of result.parts){p.object.name='BOTANY_'+key+'_'+p.id;p.object.userData={...p.object.userData,botany:true,cytology:false,atlasName:p.object.name};p.object.traverse(o=>{o.userData={...o.userData,botany:true,cytology:false,atlasName:p.object.name,partId:p.id}});}
 result.description=definition.description;result.category='botany';result.family='botany';result.preserveMaterials=false;result.limits=definition.representation;
 return result;
}
