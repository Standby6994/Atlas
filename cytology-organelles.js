import {createCytologyContext,CYTO_COLORS as C} from './cytology-surfaces.js';

// Every selectable object owns exactly the content identity supplied by the
// caller. Geometry is authored from biological organization, not segmentation.
const TAU=Math.PI*2;
const SOURCES=[
 'https://openstax.org/books/biology-2e/pages/4-3-eukaryotic-cells',
 'https://openstax.org/books/biology-2e/pages/4-4-the-endomembrane-system-and-proteins',
 'https://openstax.org/books/biology-2e/pages/4-5-the-cytoskeleton',
 'https://openstax.org/books/biology-2e/pages/4-6-connections-between-cells-and-cellular-activities',
 'https://openstax.org/books/biology-2e/pages/4-2-prokaryotic-cells',
 'https://openstax.org/books/biology-2e/pages/5-1-components-and-structure',
 'https://openstax.org/books/biology-2e/pages/21-1-viral-evolution-morphology-and-classification'
];
function protein(c,id,p,size=[.055,.045,.035],color=C.protein){return c.body(id,p,size,{color,lobes:.18,phase:p[0]*19+p[1]*7,nu:c.quality.smallU,nv:c.quality.smallV})}
function polymer(c,id,p,length=.25,{color=C.chromatin,turns=2.5,phase=0,radius=.03,thickness=.0045}={}){return c.helix(id,p,{length,turns,radius,thickness,color,phase,tissue:'chromatin'})}
function nuclearBody(c,id,p,size=[.15,.125,.075]){c.shell(id,p,size,{thickness:.008,tissue:'membrane',color:C.chromatin,nu:c.quality.smallU,nv:c.quality.smallV});c.body(id,[p[0]-.03,p[1]+.014,p[2]-.035],[size[0]*.26,size[1]*.28,size[2]*.33],{tissue:'chromatin',color:C.deep,lobes:.08});for(let j=0;j<3;j++)c.tube(id,[[p[0]-.10+j*.055,p[1]-.035,p[2]-.035],[p[0]-.07+j*.050,p[1]+.04,p[2]-.015],[p[0]-.02+j*.045,p[1]-.025,p[2]-.018]],.004,{tissue:'chromatin',color:C.chromatin,segments:24})}
function smallGolgi(c,id,p=[0,0,0],scale=1){for(let j=0;j<4;j++)c.cisterna(id,[p[0],p[1]+j*.027*scale,p[2]],[.125*scale,.022*scale,.028*scale],{bend:.05*scale,ripple:.008*scale,phase:j*.4,nu:c.quality.smallU,nv:c.quality.smallV})}
function smallChloroplast(c,id,p,size=[.135,.075,.045]){c.shell(id,p,size,{thickness:.008,color:C.green,nu:c.quality.smallU,nv:c.quality.smallV});for(let j=0;j<3;j++)for(let k=0;k<3;k++)c.cisterna(id,[p[0]+(-.65+j*.65)*size[0],p[1]+(-.26+k*.26)*size[1],p[2]-.008],[size[0]*.19,size[1]*.08,size[2]*.40],{tissue:'membrane',color:C.green,bend:0,ripple:.001,nu:c.mobile?12:20,nv:c.mobile?6:10})}

function mitochondrialLamellae(c,id,p,inner,{count=7,lobes=.027,small=false}={}){
 // The former edge-on arches read as rods from the default front camera.
 // These are broad, double-faced, ruffled membrane lamellae. Their two roots
 // are sampled from the SAME exposed inner-envelope contour, not placed on
 // an approximate ellipse or suspended above the matrix.
 const [rx,ry,rz]=inner,along=small?(c.mobile?16:24):(c.mobile?28:44),across=small?(c.mobile?8:12):(c.mobile?16:26),records=[];
 const wallY=(x,upper)=>{
  let lo=upper?0:Math.PI,hi=upper?Math.PI:TAU;
  for(let j=0;j<42;j++){const a=(lo+hi)/2,r=1+lobes*Math.sin(3*a)+lobes*.45*Math.sin(5*a-Math.PI),sx=rx*Math.cos(a)*r;if(upper?(sx>x):(sx<x))lo=a;else hi=a}
  const a=(lo+hi)/2,r=1+lobes*Math.sin(3*a)+lobes*.45*Math.sin(5*a-Math.PI);return ry*Math.sin(a)*r;
 };
 for(let j=0;j<count;j++){
  const midX=rx*(-.78+j*1.56/(count-1)),width=rx*(small?.27:.235),phase=j*.9;
  const point=(u,v,back=0)=>{
   const sin=Math.sin(Math.PI*u),x=midX+(v-.5)*width*(.78+.38*sin)+rx*.065*Math.sin(u*TAU+phase)*sin,
    bottom=wallY(x,false),top=wallY(x,true),y=bottom+(top-bottom)*u+ry*.025*Math.sin(v*TAU*2)*sin,
    z=p[2]-rz*.71*sin*(.66+.34*Math.cos((v-.5)*Math.PI))+rz*.115*Math.sin(u*Math.PI*4+phase)*sin*(2*v-1)-back*rz*.036*sin;
   return[p[0]+x,p[1]+y,z];
  };
  for(const back of[0,1])c.patch(id,(u,v)=>point(u,v,back),{nu:along,nv:across,tissue:'membrane',color:C.protein,flags:{broadRuffledLamella:true,lamellarFace:back?'back':'front',continuousInnerEnvelopeRoots:true}});
  // Rounded thickness remains visible along both long free margins. At the
  // roots it tapers to the envelope's shared cut contour without a floating gap.
  for(const edge of[0,1])c.patch(id,(u,v)=>point(u,edge,v),{nu:along,nv:3,tissue:'membrane',color:C.membrane,flags:{lamellarFreeMargin:true}});
  records.push({index:j,frontFaceWidth:width,rootBottom:point(0,.5),rootTop:point(1,.5),innerEnvelopeRadii:[...inner]});
 }
 const selected=c.at(id);selected.userData.lamellarFolds=[...(selected.userData.lamellarFolds||[]),...records];selected.userData.cristaShape='broad-ruffled-double-faced-lamellae-with-shared-envelope-roots';
}
function smallMitochondrion(c,id,p,size){
 const thickness=size[1]*.09,inner=size.map((x,i)=>x*(i===2?.82:.88));
 c.shell(id,p,size,{thickness,lobes:.035,nu:c.quality.smallU,nv:c.quality.smallV});
 c.shell(id,[p[0],p[1],p[2]+.002],inner,{thickness:thickness*.65,lobes:.027,nu:c.quality.smallU,nv:c.quality.smallV});
 mitochondrialLamellae(c,id,[p[0],p[1],p[2]+.002],inner.map(x=>x-thickness*.65),{count:5,small:true});
}

function animalCell(c){
 c.shell('plasma-membrane',[0,0,0],[.53,.40,.23],{thickness:.014,lobes:.065});
 c.body('cytosol',[0,0,-.012],[.505,.374,.198],{tissue:'matrix',color:C.matrix,cut:true,nu:c.quality.u,nv:c.quality.v,lobes:.055});
 nuclearBody(c,'nucleus',[-.16,.06,.018],[.17,.145,.10]);
 for(const [p,s] of[[[.25,.15,.018],[.13,.060,.045]],[[.13,-.24,.018],[.14,.065,.05]]])smallMitochondrion(c,'mitochondria',p,s);
 for(let j=0;j<3;j++){c.cisterna('rough-er',[-.135,-.13-j*.038,.028],[.19,.017,.030],{bend:.045,ripple:.008,nu:c.quality.smallU,nv:c.quality.smallV});for(let i=0;i<5;i++)c.ribosome('rough-er',[-.285+i*.070,-.13-j*.038,.061],.009)}
 smallGolgi(c,'golgi',[.285,-.05,.024],.85);c.shell('lysosome',[-.32,-.21,.025],[.064,.055,.047],{thickness:.008,nu:c.quality.smallU,nv:c.quality.smallV});protein(c,'lysosome',[-.325,-.215,.016],[.022,.024,.018]);
 for(const [p,s] of[[[.36,.06,.02],[.10,.046,.036]],[[-.30,.25,.02],[.11,.050,.04]]])smallMitochondrion(c,'mitochondria',p,s);
 animalCellDetail(c);
 c.group.userData.cellArchitecture='animal-eukaryote-cutaway';
}
// Smooth ER, free ribosomes, centrosome with microtubules and secretory vesicles: the rest of a generic animal
// cell, laid out around the organelles above. Positions are deterministic so every load looks the same.
function animalCellDetail(c){
 const centre=[.04,.17,.040];
 // Smooth ER: branched tubules continuing from the rough ER, without ribosomes.
 for(const [ox,oy,ph] of[[.04,-.075,0],[.10,-.13,1.3],[.00,-.17,2.1]]){const pts=[];for(let i=0;i<=8;i++){const t=i/8;pts.push([ox+.11*t-.04,oy+.018*Math.sin(t*TAU*1.5+ph),.034+.006*Math.cos(t*TAU+ph)])}c.tube('smooth-er',pts,.0075,{tissue:'membrane',color:C.lipid,segments:c.mobile?24:40,radial:c.mobile?6:8})}
 c.loop('smooth-er',[.07,-.12,.034],.035,.022,{radius:.0065,tissue:'membrane',color:C.lipid,phase:.7});
 // Free ribosomes scattered through the cytosol (golden-angle layout, skipping the organelles).
 const busy=[[-.16,.06,.19],[.285,-.04,.12],[-.135,-.17,.21],[.25,.15,.14],[.13,-.24,.15],[.36,.06,.11],[-.30,.25,.12],[-.32,-.21,.08],centre.slice(0,2).concat(.05)];
 let placed=0;for(let i=0;placed<(c.mobile?24:36)&&i<400;i++){const a=i*2.39996,r=Math.sqrt((i+.5)/400),x=.46*r*Math.cos(a),y=.34*r*Math.sin(a);if(busy.some(([bx,by,br])=>Math.hypot(x-bx,y-by)<br))continue;c.ribosome('free-ribosomes',[x,y,.036+.012*Math.sin(i)],.0085);placed++}
 // Centrosome: two perpendicular centrioles, each a ring of nine microtubule triplets.
 const centriole=(p,axis)=>{for(let k=0;k<9;k++){const a=k/9*TAU;for(let t=0;t<3;t++){const r=.014+t*.0028,u=r*Math.cos(a+t*.18),w=r*Math.sin(a+t*.18),half=.022;const ends=axis==='x'?[[p[0]-half,p[1]+u,p[2]+w],[p[0]+half,p[1]+u,p[2]+w]]:[[p[0]+u,p[1]-half,p[2]+w],[p[0]+u,p[1]+half,p[2]+w]];c.tube('centrosome',ends,.0016,{tissue:'protein',color:C.blue,segments:2,radial:5})}}};
 centriole([centre[0]-.012,centre[1],centre[2]],'x');centriole([centre[0]+.016,centre[1]+.006,centre[2]+.004],'y');
 c.body('centrosome',centre,[.05,.045,.012],{tissue:'matrix',color:C.pale,lobes:.1,nu:c.quality.smallU,nv:c.quality.smallV});
 // Microtubules radiating from the centrosome to the cell cortex; any point that would cross the nucleus is pushed
 // onto an ellipse just outside it, so the filaments wrap around the nuclear envelope instead of passing over it.
 const nucleus={x:-.16,y:.06,rx:.20,ry:.17},aroundNucleus=([x,y,z])=>{const dx=(x-nucleus.x)/nucleus.rx,dy=(y-nucleus.y)/nucleus.ry,d=Math.hypot(dx,dy);return d<1?[nucleus.x+dx/d*nucleus.rx,nucleus.y+dy/d*nucleus.ry,z]:[x,y,z]};
 const count=c.mobile?12:18;
 for(let k=0;k<count;k++){const a=-1.25+k*(4.5/(count-1)),end=[.47*Math.cos(a)*.92,.355*Math.sin(a)*.92],pts=[];for(let i=0;i<=10;i++){const t=i/10;pts.push(aroundNucleus([centre[0]+(end[0]-centre[0])*t+.02*Math.sin(t*Math.PI+k),centre[1]+(end[1]-centre[1])*t+.015*Math.sin(t*Math.PI*2+k*.7),.046+.006*Math.sin(t*Math.PI)]))}c.tube('cytoskeleton',pts,.0028,{tissue:'filament',color:C.blue,segments:c.mobile?24:40,radial:c.mobile?5:6})}
 // Secretory vesicles budding from the Golgi towards the plasma membrane.
 for(const [x,y,r] of[[.25,.09,.017],[.33,.12,.015],[.40,-.02,.016],[.43,-.12,.014],[.20,-.13,.013]])c.body('vesicles',[x,y,.03],[r,r,r*.9],{tissue:'membrane',color:C.lipid,lobes:.05,nu:c.quality.smallU,nv:c.quality.smallV});
}
function plantCell(c){
 c.shell('cell-wall',[0,0,0],[.50,.43,.24],{thickness:.024,tissue:'wall',exponent:.45,lobes:.022});
 c.shell('plasma-membrane',[0,0,.004],[.468,.400,.210],{thickness:.009,exponent:.45,lobes:.020});
 c.body('cytosol',[0,0,-.010],[.457,.386,.192],{tissue:'matrix',cut:true,exponent:.45,lobes:.018,nu:c.quality.u,nv:c.quality.v});
 c.shell('central-vacuole',[.06,-.02,.010],[.30,.30,.135],{thickness:.008,lobes:.055,tissue:'membrane',color:C.blue});c.body('central-vacuole',[.06,-.02,-.005],[.286,.286,.116],{tissue:'matrix',cut:true,color:0xbccbc0,lobes:.05,nu:c.quality.smallU,nv:c.quality.smallV});
 nuclearBody(c,'nucleus',[-.30,.13,.020],[.105,.115,.07]);
 for(const p of[[-.29,-.24,.025],[.30,.28,.018],[.34,-.24,.020]])smallChloroplast(c,'chloroplast',p,[.100,.055,.04]);
 for(const p of[[-.32,-.03,.030],[.04,.335,.018]])c.mitochondrion('mitochondria',p,[.075,.039,.029],{simple:true});
 plantCellDetail(c);
 c.group.userData.cellArchitecture='plant-wall-membrane-central-vacuole';
}
// Rough ER beside the nucleus, a Golgi stack, free ribosomes in the thin peripheral cytoplasm and plasmodesmata
// crossing the wall: the parts a plant cell shares with animal cells plus its own wall channels.
function plantCellDetail(c){
 for(let j=0;j<2;j++){c.cisterna('rough-er',[-.25,.285+j*.026,.026],[.085,.009,.018],{bend:.02,ripple:.004,phase:j,nu:c.quality.smallU,nv:c.quality.smallV});for(let i=0;i<4;i++)c.ribosome('rough-er',[-.31+i*.04,.285+j*.026,.046],.0075)}
 smallGolgi(c,'golgi',[.405,.02,.022],.34);
 const busy=[[.06,-.02,.33],[-.30,.13,.13],[-.29,-.24,.11],[.30,.28,.11],[.34,-.24,.11],[-.32,-.03,.08],[.04,.335,.08],[-.25,.3,.1],[.405,.04,.06]];
 let placed=0;for(let i=0;placed<(c.mobile?16:26)&&i<500;i++){const a=i*2.39996,r=Math.sqrt((i+.5)/500),x=.44*r*Math.cos(a),y=.37*r*Math.sin(a);if(busy.some(([bx,by,br])=>Math.hypot(x-bx,y-by)<br))continue;c.ribosome('free-ribosomes',[x,y,.03],.0075);placed++}
 // Channels sit inside the wall band at the cut face, without sticking out of it.
 for(const x of[-.12,.16])for(const y of[.398,-.398])c.channel('plasmodesmata',[x,y,0],{radius:.0065,length:.02,axis:'y',lobes:5});
}
function bacteria(c){
 c.shell('capsule',[0,0,0],[.51,.255,.19],{thickness:.017,tissue:'matrix',color:0xbcb6a4,lobes:.025});
 c.shell('cell-wall',[0,0,.004],[.482,.229,.167],{thickness:.016,tissue:'wall',color:C.wall,lobes:.023});
 c.shell('plasma-membrane',[0,0,.008],[.457,.205,.144],{thickness:.009,lobes:.021});
 c.body('cytoplasm',[0,0,-.008],[.440,.188,.121],{tissue:'matrix',cut:true,lobes:.020,nu:c.quality.u,nv:c.quality.v});
 const nucleoid=[];for(let i=0;i<150;i++){const t=i/150*TAU;nucleoid.push([.275*Math.cos(t)+.030*Math.cos(11*t),.065*Math.sin(t)+.019*Math.sin(9*t),.020+.020*Math.sin(5*t)])}c.tube('nucleoid',nucleoid,.006,{tissue:'chromatin',closed:true,segments:c.mobile?180:280,radial:c.mobile?7:10});
 for(let j=0;j<18;j++){const a=j*2.39996,r=.25+.11*Math.sin(j*2.1);c.ribosome('ribosomes',[r*Math.cos(a),.125*Math.sin(a),.016],.011)}
 c.loop('plasmid',[.275,.068,.045],.046,.027,{tissue:'chromatin',radius:.004,phase:.4});c.loop('plasmid',[-.255,-.09,.035],.036,.023,{tissue:'chromatin',radius:.004,phase:1.1});
 const flag=[];for(let i=0;i<=100;i++){const t=i/100;flag.push([.49+t*.52,.016+.05*Math.sin(t*TAU*2.5),.030+.042*Math.cos(t*TAU*2.5)])}c.tube('flagellum',flag,.009,{segments:c.mobile?84:144,tissue:'filament',color:C.filament});
 c.group.userData.cellArchitecture='encapsulated-bacterial-example-no-nuclear-envelope';
}
function fungalCell(c){
 const bud={angle:.68,width:.34,strength:.53};
 c.shell('cell-wall',[-.055,0,0],[.37,.38,.24],{thickness:.020,tissue:'wall',lobes:.045,phase:1.3,bulge:bud});
 c.shell('plasma-membrane',[-.055,0,.005],[.343,.352,.212],{thickness:.008,lobes:.045,phase:1.3,bulge:bud});
 nuclearBody(c,'nucleus',[-.20,.10,.018],[.11,.115,.07]);c.mitochondrion('mitochondria',[-.20,-.20,.020],[.11,.055,.041],{simple:true});c.mitochondrion('mitochondria',[.10,.21,.025],[.09,.043,.032],{simple:true});
 c.shell('vacuole',[.055,-.055,.008],[.16,.20,.115],{thickness:.010,color:C.blue});c.body('vacuole',[.055,-.055,-.008],[.146,.183,.095],{tissue:'matrix',color:0xc0cbc0,cut:true,lobes:.04,nu:c.quality.smallU,nv:c.quality.smallV});
 for(let i=0;i<14;i++){const t=i*2.39996;c.ribosome('ribosomes',[-.045+.28*Math.cos(t),.29*Math.sin(t),.033],.010)}c.group.userData.cellArchitecture='budding-fungal-cell';
}

function plasmaMembrane(c){
 const wave=(u,v,z)=>[(u-.5)*.90,(v-.5)*.53,z+.023*Math.sin(u*5.5)*Math.cos(v*4.1)];
 for(const z of[-.034,.034])c.patch('phospholipid-bilayer',(u,v)=>wave(u,v,z),{tissue:'membrane',flags:{bilayerLeaflet:z<0?'cytosolic':'external'}});
 for(const side of[-1,1])c.patch('hydrophobic-core',(u,v)=>{const x=(u-.5)*.90,y=side*.265;return[x,y,(v-.5)*.068+.023*Math.sin(u*5.5)*Math.cos((side>0?1:0)*4.1)]},{nu:c.quality.u,nv:6,tissue:'lipid',flags:{bilayerCutEdge:true}});
 // Individual lipids appear only on the exposed edge. The field itself remains
 // two uninterrupted leaflets, rather than a wall made from separate spheres.
 for(let i=0;i<18;i++)for(const side of[-1,1]){const x=-.425+i*.05,z=side*.034+.023*Math.sin((x/.9+.5)*5.5);c.tube('hydrophobic-core',[[x,-.266,z],[x+.004,-.266,side*.013],[x+.010,-.266,0]],.003,{segments:12,tissue:'lipid'})}
 c.channel('membrane-protein',[-.19,.01,.003],{radius:.071,length:.17,color:C.protein});protein(c,'membrane-protein',[.22,-.035,0],[.075,.065,.083],C.protein);
 // Cholesterol is an enlarged symbolic fused-ring molecule, not resolved atoms.
 for(let j=0;j<4;j++)c.loop('cholesterol',[.07+j*.019,-.18,.004],.017,.014,{radius:.003,tissue:'lipid',zWave:.002,segments:24});
 for(const p of[[-.18,.025,.10],[.23,-.025,.095]]){c.tube('carbohydrate-chain',[p,[p[0]+.02,p[1]+.02,.15],[p[0]-.005,p[1]+.035,.22],[p[0]+.03,p[1]+.045,.28]],.008,{tissue:'protein',color:C.green,segments:40});c.tube('carbohydrate-chain',[[p[0],p[1]+.03,.20],[p[0]-.035,p[1]+.01,.24],[p[0]-.05,p[1]+.035,.27]],.006,{tissue:'protein',color:C.green,segments:24})}
 for(let j=0;j<4;j++)c.tube('cytoskeleton',[[-.43,-.18+j*.11,-.08],[0,-.19+j*.11,-.095],[.43,-.16+j*.11,-.08]],.007,{tissue:'filament',segments:48});
 c.group.userData.biologicalTopology='continuous-bilayer-two-leaflets-with-cut-core';
}

function ribosome(c){
 c.body('large-subunit',[.015,.092,-.01],[.19,.142,.112],{tissue:'protein',lobes:.17,phase:1.1,nu:c.quality.u,nv:c.quality.v});c.body('small-subunit',[-.01,-.092,.014],[.168,.067,.087],{tissue:'protein',color:C.blue,lobes:.13,phase:2,nu:c.quality.u,nv:c.quality.v});
 c.tube('mrna',[[-.44,-.025,.055],[-.21,-.01,.060],[0,-.025,.067],[.23,-.02,.070],[.44,.015,.075]],.009,{tissue:'chromatin',color:C.lipid,segments:100});
 c.tube('trna',[[.015,.01,.10],[.022,.068,.11],[.055,.117,.10],[.095,.118,.11],[.086,.173,.10],[.050,.188,.09],[.047,.225,.08]],.010,{tissue:'chromatin',color:C.green,segments:80});
 c.tube('peptide',[[.050,.225,.08],[.042,.27,.095],[.10,.285,.10],[.16,.27,.10],[.175,.32,.08],[.13,.35,.07]],.013,{tissue:'protein',color:C.protein,segments:80});
 const path=[];for(let i=0;i<=32;i++){const t=i/32;path.push([-.39+t*.78,-.30+.030*Math.sin(t*Math.PI*3),-.01])}c.tube('polysome',path,.006,{tissue:'chromatin',color:C.lipid,segments:64});for(let i=0;i<5;i++)c.ribosome('polysome',[-.32+i*.16,-.30+.03*Math.sin((i*.16+.07)/.78*Math.PI*3),0],.036,{color:C.protein});
 c.group.userData.molecularRepresentation='qualitative-subunits-and-polysome-not-atomic-coordinates';
}
function roughER(c){
 for(let j=0;j<4;j++){
  const p=[.02,-.22+j*.12,-.015],s=[.34-.012*j,.040,.051];c.cisterna('membrane-cisternae',p,s,{bend:.06,ripple:.009,phase:j*.32,cut:true,nu:c.quality.u,nv:c.quality.v});
  c.cisterna('lumen',[p[0],p[1],p[2]-.009],[s[0]*.96,s[1]*.76,.035],{tissue:'matrix',color:C.pale,bend:.057,ripple:.006,cut:true,nu:c.quality.smallU,nv:c.quality.smallV});
  for(let i=0;i<7;i++){const x=-.26+i*.09;c.ribosome('ribosomes',[x,p[1]+.006+.06*(x/s[0])**2,p[2]+.018],.012)}
 }
 c.shell('nuclear-connection',[-.40,.065,-.030],[.10,.225,.105],{thickness:.010,tissue:'membrane',color:C.chromatin,nu:c.quality.smallU,nv:c.quality.smallV});
 c.tube('nuclear-connection',[[-.35,.20,-.07],[-.27,.20,-.03],[-.16,.16,-.01]],.017,{tissue:'membrane'});
 c.tube('nascent-protein',[[.02,.13,.06],[.04,.11,.04],[.045,.095,-.012],[.08,.105,-.036],[.105,.08,-.039]],.008,{tissue:'protein',color:C.green,segments:56});
 c.shell('transport-vesicle',[.40,.20,.025],[.054,.052,.046],{thickness:.008,nu:c.quality.smallU,nv:c.quality.smallV});protein(c,'transport-vesicle',[.40,.20,.005],[.022,.018,.016]);
 c.group.userData.biologicalTopology='open-cisternae-with-lumen-and-cytosolic-ribosomes';
}
function smoothER(c){
 // All branches end at sampled nodes of a shared anastomosing network.
 const ys=[-.23,-.08,.08,.23];for(let row=0;row<ys.length;row++){const y=ys[row];c.tube('tubular-membrane',[[-.38,y,-.015],[-.20,y+.025,.01],[0,y-.015,-.005],[.20,y+.025,.02],[.38,y,-.005]],.025,{tissue:'membrane',segments:c.mobile?52:92,radial:c.mobile?10:14});if(row<ys.length-1)for(const x of[-.26,-.06,.16,.31])c.tube('tubular-membrane',[[x,y+.012,.005],[x-.035,y+.07,.03],[x,ys[row+1]+.005,.008]],.023,{tissue:'membrane',segments:c.mobile?24:40,radial:c.mobile?10:14})}
 protein(c,'lipid-synthesis',[-.20,-.20,.056],[.054,.040,.036],C.lipid);c.helix('phospholipid',[.34,-.27,.06],{length:.13,radius:.009,turns:1.5,thickness:.006,tissue:'lipid',color:C.lipid});
 c.channel('detoxification',[.20,.10,.035],{radius:.048,length:.07,color:C.protein});
 for(let i=0;i<5;i++)c.body('calcium-store',[-.25+i*.12,.245,.015],[.009,.009,.009],{tissue:'protein',color:C.pale,nu:12,nv:8,lobes:.03});
 protein(c,'hepatic-glucose',[-.04,-.045,.05],[.055,.042,.035],C.green);c.group.userData.biologicalTopology='anastomosing-smooth-reticulum-with-open-tubule-ends';
}
function golgi(c){
 const rows=[['cis-face',-.24,C.blue],['cisternae',-.13,C.membrane],['medial-cisternae',-.02,C.protein],['cisternae',.09,C.membrane],['trans-face',.20,C.green]];
 for(let j=0;j<rows.length;j++){const [id,y,color]=rows[j];c.cisterna(id,[0,y,0],[.32-(j===0||j===4?.025:0),.033,.055],{color,bend:.125,ripple:.010,phase:j*.4,cut:true});c.cisterna(id,[0,y,-.010],[.30-(j===0||j===4?.025:0),.023,.035],{tissue:'matrix',color:C.pale,bend:.12,ripple:.007,cut:true,nu:c.quality.smallU,nv:c.quality.smallV})}
 for(const p of[[-.38,-.12,.02],[.38,.20,.025],[.30,.37,.025]])c.shell('transport-vesicle',p,[.045,.042,.036],{thickness:.007,nu:c.quality.smallU,nv:c.quality.smallV});
 c.tube('sorting-cargo',[[-.12,.22,.025],[-.09,.25,.035],[-.03,.25,.03],[0,.23,.04],[.05,.24,.04]],.012,{tissue:'protein',color:C.lipid,segments:48});
 c.group.userData.biologicalTopology='polarized-curved-cisternal-stack-cis-to-trans';
}
function lysosome(c){
 c.shell('lysosomal-membrane',[-.25,.08,0],[.20,.20,.145],{thickness:.015,lobes:.045});c.body('acid-lumen',[-.25,.08,-.016],[.179,.179,.118],{tissue:'matrix',color:0xcab3a1,cut:true,lobes:.04,nu:c.quality.u,nv:c.quality.v});
 for(let i=0;i<5;i++){const a=i*TAU/5;protein(c,'hydrolases',[-.25+.105*Math.cos(a),.08+.105*Math.sin(a),.005],[.035,.025,.026],C.protein)}
 c.shell('autophagosome',[.24,.20,.0],[.17,.16,.115],{thickness:.010,color:C.blue,nu:c.quality.smallU,nv:c.quality.smallV});c.shell('autophagosome',[.24,.20,.006],[.145,.135,.092],{thickness:.008,color:C.blue,nu:c.quality.smallU,nv:c.quality.smallV});c.mitochondrion('autophagosome',[.24,.20,.005],[.095,.043,.035],{simple:true});
 c.shell('autolysosome',[.23,-.20,0],[.21,.135,.11],{thickness:.013,lobes:.085});for(let i=0;i<4;i++)protein(c,'autolysosome',[.115+i*.075,-.205+.025*Math.sin(i*2),.006],[.023,.020,.015],C.protein);
 c.tube('recycled-monomers',[[.40,-.20,.02],[.46,-.16,.025],[.46,-.07,.03],[.43,-.045,.035]],.007,{tissue:'protein',color:C.lipid,segments:40});for(let i=0;i<3;i++)protein(c,'recycled-monomers',[.43+i*.022,-.015+i*.035,.03],[.010,.010,.008],C.lipid);
 c.group.userData.biologicalTopology='single-lysosomal-and-double-autophagosomal-membranes';
}
function peroxisome(c){
 c.shell('membrane',[-.05,.01,0],[.31,.29,.21],{thickness:.014,lobes:.045});c.body('matrix',[-.05,.01,-.012],[.285,.265,.183],{tissue:'matrix',color:C.pale,cut:true,lobes:.04,nu:c.quality.u,nv:c.quality.v});
 for(const p of[[-.18,.15,.014],[-.19,-.11,.018],[.12,.16,.010]])protein(c,'oxidative-enzymes',p,[.050,.037,.030],C.protein);
 // Catalase's four-lobed teaching surface is distinct from the limiting membrane.
 c.body('catalase',[.06,-.04,.025],[.089,.077,.055],{tissue:'protein',color:C.green,lobes:.20,phase:.5,nu:c.quality.u,nv:c.quality.v});
 for(const x of[.29,.335])protein(c,'hydrogen-peroxide',[x,-.17,.018],[.014,.014,.014],C.blue);c.tube('hydrogen-peroxide',[[.29,-.17,.018],[.335,-.17,.018]],.005,{segments:12,tissue:'protein',color:C.blue});
 c.helix('fatty-acid',[.28,.22,.01],{length:.24,radius:.008,turns:2.8,thickness:.006,tissue:'lipid',color:C.lipid});
 c.group.userData.biologicalTopology='single-membrane-peroxisome-no-cristae';
}
function vacuole(c){
 c.shell('cytoplasmic-rim',[0,0,-.020],[.43,.36,.23],{thickness:.028,tissue:'matrix',color:C.matrix,lobes:.055});c.shell('tonoplast',[.008,0,0],[.383,.313,.186],{thickness:.012,color:C.blue,lobes:.055});
 c.body('lumen',[.008,0,-.014],[.364,.294,.163],{tissue:'matrix',color:0xc0cabc,cut:true,lobes:.05,nu:c.quality.u,nv:c.quality.v});
 c.channel('proton-pump',[.305,.165,.01],{radius:.045,length:.09,color:C.protein});c.tube('proton-pump',[[.29,.18,.06],[.26,.15,.05],[.25,.13,.015]],.006,{tissue:'protein',color:C.lipid,segments:24});
 for(let i=0;i<6;i++){const a=i*2.39996;protein(c,'storage-solutes',[.20*Math.cos(a),.16*Math.sin(a),.012],[.023,.018,.016],i%2?C.lipid:C.green)}
 // Pressure is an explicit directional symbol at the lumen boundary.
 for(const s of[-1,1]){c.tube('turgor',[[s*.18,-.20,.018],[s*.27,-.22,.018],[s*.34,-.23,.018]],.007,{tissue:'filament',color:C.blue,segments:24});c.tube('turgor',[[s*.30,-.20,.018],[s*.34,-.23,.018],[s*.30,-.26,.018]],.007,{tissue:'filament',color:C.blue,segments:24})}
 c.group.userData.biologicalTopology='tonoplast-lumen-and-thin-cytoplasmic-rim';
}
function mitochondrion(c){
 c.shell('outer-membrane',[0,0,0],[.49,.255,.18],{thickness:.013,lobes:.035});c.shell('inner-membrane',[0,0,.005],[.452,.220,.145],{thickness:.011,lobes:.027});
 c.body('intermembrane-space',[0,0,-.006],[.472,.236,.158],{tissue:'matrix',color:0xb1b6ad,cut:true,lobes:.028,nu:c.quality.smallU,nv:c.quality.smallV});c.body('matrix',[0,0,.009],[.432,.201,.119],{tissue:'matrix',color:C.matrix,cut:true,lobes:.025,nu:c.quality.u,nv:c.quality.v});
 mitochondrialLamellae(c,'cristae',[0,0,.005],[.441,.209,.134]);
 c.loop('mitochondrial-dna',[-.22,-.075,.034],.082,.038,{tissue:'chromatin',color:C.chromatin,radius:.005,phase:.4});
 for(const p of[[.24,-.12,.038],[.27,.09,.035],[-.10,.11,.032]])c.ribosome('mitoribosomes',p,.018);
 c.group.userData.biologicalTopology='double-envelope-cristae-matrix-and-intermembrane-space';
}
function chloroplast(c){
 c.shell('outer-membrane',[0,0,0],[.49,.28,.185],{thickness:.012,color:C.green,lobes:.028});c.shell('inner-membrane',[0,0,.005],[.460,.248,.155],{thickness:.010,color:0xa5b18c,lobes:.026});c.body('stroma',[0,0,.004],[.440,.230,.133],{tissue:'matrix',color:0xd0cbb2,cut:true,lobes:.025,nu:c.quality.u,nv:c.quality.v});
 for(let stack=0;stack<3;stack++){const x=-.29+stack*.29;for(let j=0;j<5;j++){const p=[x,-.095+j*.035,.016];c.cisterna('granum',p,[.10,.012,.065],{tissue:'membrane',color:C.green,bend:.006,ripple:.002,nu:c.quality.smallU,nv:c.quality.smallV,cut:true});c.cisterna('thylakoid-lumen',[p[0],p[1],p[2]-.005],[.088,.006,.052],{tissue:'matrix',color:0xb4c1a2,bend:.005,ripple:.001,nu:c.mobile?16:24,nv:c.mobile?8:12,cut:true})}if(stack<2)c.tube('granum',[[x+.08,.01,-.015],[x+.145,.02,-.025],[x+.21,.01,-.015]],.007,{tissue:'membrane',color:C.green,segments:32})}
 c.body('starch',[.20,-.175,.020],[.080,.040,.025],{tissue:'matrix',color:C.pale,lobes:.06});c.loop('plastid-dna',[-.22,.185,.024],.065,.027,{tissue:'chromatin',radius:.005,zWave:.005});
 c.group.userData.biologicalTopology='double-envelope-interconnected-thylakoid-stacks';
}
function nucleus(c){
 c.shell('nuclear-envelope',[0,0,0],[.39,.35,.24],{thickness:.011,tissue:'membrane',color:C.chromatin,lobes:.025});c.shell('nuclear-envelope',[0,0,.005],[.362,.322,.212],{thickness:.010,tissue:'membrane',color:C.membrane,lobes:.025});
 // Pore complexes straddle the exposed rim; the central channel stays open.
 for(const [x,y] of[[-.30,.19],[.30,.19],[0,-.335]])c.channel('nuclear-pore',[x,y,.004],{radius:.039,length:.043,color:C.blue});
 c.body('nucleolus',[-.13,.085,-.028],[.101,.089,.068],{tissue:'chromatin',color:C.deep,lobes:.11,nu:c.quality.u,nv:c.quality.v});
 const points=[];for(let i=0;i<=170;i++){const t=i/170*TAU;points.push([.23*Math.cos(t)+.045*Math.cos(t*4),-.06+.17*Math.sin(t)+.025*Math.sin(t*7),-.005+.028*Math.sin(t*5)])}c.tube('euchromatin',points,.005,{tissue:'chromatin',color:C.lipid,segments:c.mobile?140:240});
 for(let j=0;j<6;j++){const a=(j/6)*TAU;const p=[.285*Math.cos(a),.26*Math.sin(a),-.012];c.helix('heterochromatin',p,{length:.09,radius:.017,turns:4.0,thickness:.008,axis:j%2?'x':'y',tissue:'chromatin',color:C.chromatin,segments:c.mobile?52:88})}
 c.helix('chromatin-loop',[.08,.115,.045],{length:.22,radius:.025,turns:3.5,thickness:.005,tissue:'chromatin',color:C.protein,segments:100});
 c.at('nuclear-pore').userData.projectedOnCutMargin=true;
 c.group.userData.biologicalTopology='double-nuclear-envelope-enlarged-pore-symbols-at-cut-margin-and-chromatin-domains';
}

function cytoskeleton(c){
 // Actin cortex is an interlinked peripheral network; microtubules radiate from
 // the same centrosomal origin; intermediate filaments form tensile spans.
 for(let j=0;j<5;j++){const y=-.26+j*.13;c.tube('actin',[[-.42,y,0],[-.20,y+.025,.015],[0,y-.015,.02],[.20,y+.023,.015],[.42,y,0]],.005,{tissue:'filament',color:C.protein,segments:70})}for(let j=0;j<5;j++){const x=-.40+j*.20;c.tube('actin',[[x,-.28,0],[x+.025,0,.015],[x-.012,.28,0]],.005,{tissue:'filament',color:C.protein,segments:50})}
 for(const s of[-1,1])for(let j=0;j<3;j++)c.tube('intermediate-filaments',[[-.42,-.19+j*.17,-.025],[-.17,s*.12,-.015],[.12,-s*.14,-.015],[.42,-.19+j*.17,-.025]],.010,{tissue:'filament',color:C.filament,segments:70,fluting:.06});
 const origin=[-.13,-.035,.065];for(let i=0;i<9;i++){const a=i/9*TAU,end=[.43*Math.cos(a),.30*Math.sin(a),.035];c.tube('microtubule',[origin,[origin[0]*.25+end[0]*.55,end[1]*.4,.06],end],.017,{tissue:'filament',color:C.blue,segments:60,radial:c.mobile?10:14,fluting:.035})}
 for(let j=0;j<2;j++)for(let i=0;i<9;i++)for(let k=0;k<3;k++){const a=i/9*TAU,r=.026+k*.006,p=[origin[0]+r*Math.cos(a),origin[1]+r*Math.sin(a),origin[2]];if(j===0)c.tube('centrosome',[[p[0],p[1],.045],[p[0],p[1],.14]],.004,{tissue:'filament',color:C.lipid,segments:16,radial:6});else c.tube('centrosome',[[-.20,.055+r*Math.sin(a),.065+r*Math.cos(a)],[-.10,.055+r*Math.sin(a),.065+r*Math.cos(a)]],.004,{tissue:'filament',color:C.lipid,segments:16,radial:6})}c.at('centrosome').userData.centrioles={count:2,tripletsPerCentriole:9,perpendicular:true};
 c.body('motor-protein',[.20,-.03,.11],[.025,.022,.018],{tissue:'protein',color:C.green,lobes:.14});for(const s of[-1,1])c.tube('motor-protein',[[.20,-.03,.10],[.19+s*.015,-.04,.072],[.20+s*.018,-.025,.055]],.005,{tissue:'protein',color:C.green,segments:24});c.tube('motor-protein',[[.20,-.03,.12],[.22,-.025,.17]],.005,{tissue:'protein',color:C.green,segments:24});
 c.shell('vesicle-cargo',[.22,-.025,.20],[.057,.050,.050],{thickness:.007,nu:c.quality.smallU,nv:c.quality.smallV});
 c.group.userData.biologicalTopology='cortex-tensile-network-and-centrosomal-radial-tracks';
}
function cilia(c){
 // Enlarged 9+2 axoneme at the left. Nine doublets are curved longitudinal
 // meshes around one axis; the two central singlets are separately visible.
 for(let j=0;j<9;j++){const a=j/9*TAU;for(const d of[0,.016]){const r=.122+d;c.tube('axoneme',[[-.25+r*Math.cos(a),-.27,.02+r*Math.sin(a)],[-.24+r*Math.cos(a),0,.025+r*Math.sin(a)],[-.22+r*Math.cos(a),.29,.04+r*Math.sin(a)]],.009,{tissue:'filament',color:C.blue,segments:64,radial:c.mobile?8:12})}const x=-.25+.104*Math.cos(a),z=.02+.104*Math.sin(a);c.tube('dynein',[[x,-.16,z],[x-.010*Math.sin(a),-.13,z+.010*Math.cos(a)],[x-.024*Math.sin(a),-.13,z+.024*Math.cos(a)]],.006,{tissue:'protein',color:C.protein,segments:24})}
 for(const s of[-1,1])c.tube('axoneme',[[-.25+s*.015,-.27,.02],[-.24+s*.015,0,.025],[-.22+s*.015,.29,.04]],.009,{tissue:'filament',color:C.blue,segments:64});
 for(let j=0;j<9;j++){const a=j/9*TAU;for(let k=0;k<3;k++)c.tube('basal-body',[[-.25+(.12+k*.013)*Math.cos(a),-.40,.02+(.12+k*.013)*Math.sin(a)],[-.25+(.12+k*.013)*Math.cos(a),-.29,.02+(.12+k*.013)*Math.sin(a)]],.006,{tissue:'filament',color:C.lipid,segments:20})}
 c.tube('motile-cilium',[[.02,-.28,-.01],[.04,-.05,.04],[.09,.17,.02],[.06,.34,.02]],.028,{tissue:'membrane',color:C.membrane,segments:100,radial:c.mobile?10:16,taper:.34});
 const flag=[];for(let i=0;i<=60;i++){const t=i/60;flag.push([.22+.045*Math.sin(t*TAU*1.4),-.35+t*.75,.02+.025*Math.cos(t*TAU*1.4)])}c.tube('eukaryotic-flagellum',flag,.020,{tissue:'membrane',color:C.membrane,segments:110,taper:.50});
 const bac=[];for(let i=0;i<=72;i++){const t=i/72;bac.push([.40+.050*Math.cos(t*TAU*3),-.37+t*.72,.02+.050*Math.sin(t*TAU*3)])}c.tube('bacterial-flagellum',bac,.008,{tissue:'filament',color:C.filament,segments:140});
 c.patch('primary-cilium',(u,v)=>{const a=Math.PI+u*Math.PI,y=-.26+v*.38,x=.56+.009*Math.sin(v*TAU);return[x+.021*Math.cos(a),y,.010+.021*Math.sin(a)]},{nu:c.mobile?18:30,nv:c.mobile?32:56,tissue:'membrane',color:C.blue,flags:{openLongitudinalSheath:true}});
 for(let j=0;j<9;j++)for(const d of[0,.0035]){const a=j/9*TAU,points=[];for(let i=0;i<=32;i++){const t=i/32;points.push([.56+.009*Math.sin(t*TAU)+(.012+d)*Math.cos(a),-.26+t*.38,.010+(.012+d)*Math.sin(a)])}c.tube('primary-cilium',points,.0017,{tissue:'filament',color:C.lipid,segments:48,radial:6})}
 c.at('axoneme').userData.microtubules={doublets:9,centralSinglets:2};c.at('basal-body').userData.microtubules={triplets:9};c.at('primary-cilium').userData.microtubules={doublets:9,centralSinglets:0};c.at('bacterial-flagellum').userData.microtubules={none:true};
 c.group.userData.biologicalTopology='axoneme-9-plus-2-basal-triplets-and-distinct-bacterial-filament';
}
function junctions(c){
 // Four recognizable contacts occupy different heights on the same two
 // neighboring cell surfaces, rather than disconnected balls for each label.
 for(const side of[-1,1])c.sheet('extracellular-matrix',[side*.27,-.035,-.12],[.17,.37,.01],{tissue:'matrix',color:C.matrix,ripple:.009,nu:c.quality.smallU,nv:c.quality.smallV});
 for(const side of[-1,1])for(let j=0;j<3;j++){const y=.27+j*.018;c.tube('tight-junction',[[side*.055,y,-.10],[side*.05,y,0],[side*.055,y,.13]],.010,{tissue:'protein',color:C.green,segments:48});c.tube('tight-junction',[[side*.055,y,.04],[0,y,.04]],.007,{tissue:'protein',color:C.green,segments:16})}
 for(const y of[.13,.16])c.tube('adherens-junction',[[-.27,y,.02],[-.12,y+.01,.028],[-.035,y,.035],[.035,y,.035],[.12,y+.01,.028],[.27,y,.02]],.009,{tissue:'filament',color:C.protein,segments:72});
 for(const side of[-1,1]){c.cisterna('desmosome',[side*.08,-.035,.024],[.020,.052,.060],{tissue:'protein',color:C.deep,bend:.003,ripple:.004,nu:c.quality.smallU,nv:c.quality.smallV});for(const k of[-1,1])c.tube('desmosome',[[side*.29,-.035+k*.065,.01],[side*.17,-.035+k*.03,.012],[side*.08,-.035,.022]],.007,{tissue:'filament',color:C.filament,segments:36})}for(let j=0;j<4;j++)c.tube('desmosome',[[-.07,-.066+j*.022,.020],[0,-.063+j*.02,.025],[.07,-.066+j*.022,.020]],.006,{tissue:'protein',segments:24});
 for(let j=0;j<5;j++){const p=[-.032+(j%2)*.035,-.19+Math.floor(j/2)*.035,.02];c.channel('gap-junction',p,{radius:.017,length:.08,color:C.blue,lobes:6})}
 c.channel('plasmodesma',[.38,-.25,.01],{radius:.044,length:.18,tissue:'wall',color:C.wall});c.tube('plasmodesma',[[.38,-.25,-.09],[.38,-.25,.10]],.008,{tissue:'membrane',color:C.membrane,segments:36});
 c.group.userData.biologicalTopology='four-distinct-animal-contacts-plus-separate-plant-plasmodesma';
}
function viruses(c){
 c.shell('envelope',[.15,.045,0],[.25,.25,.18],{thickness:.012,lobes:.025});
 // A corrugated closed protein shell is an enlarged capsid teaching surface;
 // its outline is intentionally qualitative and is not an atomistic viral model.
 c.shell('capsid',[.15,.045,.012],[.188,.187,.137],{thickness:.014,tissue:'protein',color:C.chromatin,lobes:.065,phase:1.2});
 const genome=[];for(let i=0;i<=140;i++){const t=i/140*TAU;genome.push([.15+.11*Math.cos(t)*(.6+.4*Math.cos(t*5)),.045+.11*Math.sin(t),.022+.025*Math.sin(t*7)])}c.tube('nucleic-acid',genome,.006,{tissue:'chromatin',color:C.lipid,segments:200,closed:true});
 for(let j=0;j<12;j++){const a=j/12*TAU,p=[.15+.27*Math.cos(a),.045+.27*Math.sin(a),.015];c.tube('surface-proteins',[[.15+.239*Math.cos(a),.045+.239*Math.sin(a),.015],p],.007,{tissue:'protein',color:C.green,segments:16});protein(c,'surface-proteins',p,[.018,.018,.022],C.green)}
 c.shell('host-cell',[-.37,-.04,-.015],[.19,.29,.16],{thickness:.012,lobes:.075,color:C.matrix,nu:c.quality.smallU,nv:c.quality.smallV});nuclearBody(c,'host-cell',[-.39,-.04,-.006],[.063,.074,.042]);
 for(let j=0;j<3;j++){const y=-.18+j*.14;c.tube('replication-stage',[[-.41,y,.015],[-.36,y+.025,.030],[-.30,y-.01,.030]],.006,{tissue:'chromatin',color:C.lipid,segments:32})}for(const p of[[.02,-.35,.01],[.15,-.35,.01],[.28,-.35,.01]])c.shell('replication-stage',p,[.038,.039,.025],{thickness:.005,tissue:'protein',color:C.chromatin,nu:16,nv:8});
 c.group.userData.molecularRepresentation='generic-enveloped-virus-not-a-particular-species';
}

function microscopy(c){
 for(const p of[[-.31,.20,-.015],[-.09,.20,-.015],[.13,.20,-.015]]){c.shell('cell-units',p,[.10,.105,.055],{thickness:.007,tissue:'wall',exponent:.50,lobes:.025,nu:c.quality.smallU,nv:c.quality.smallV});c.body('cell-units',[p[0]-.013,p[1]-.006,p[2]+.014],[.026,.031,.020],{tissue:'chromatin',color:C.chromatin,lobes:.08})}
 // The instrument is explicitly a diagram, with a curved stand and optical axis.
 c.tube('microscope',[[.37,-.30,-.035],[.47,-.24,-.035],[.48,-.05,-.035],[.39,.095,-.035]],.026,{tissue:'protein',color:C.blue,segments:90,radial:c.mobile?10:16});c.cisterna('microscope',[.39,-.33,-.035],[.17,.025,.08],{tissue:'protein',color:C.blue,bend:.012,ripple:.003,nu:c.quality.smallU,nv:c.quality.smallV});
 c.channel('objective',[.30,.01,.04],{radius:.035,length:.14,axis:'y',tissue:'protein',color:C.deep});c.body('objective',[.30,-.065,.041],[.030,.008,.030],{tissue:'protein',color:C.pale,lobes:.01,nu:24,nv:12});
 for(const x of[-.31,-.22])c.loop('resolution',[x,-.13,.02],.035,.035,{tissue:'protein',color:C.blue,radius:.003,zWave:0,segments:48});
 c.tube('scale-bar',[[-.36,-.29,.03],[-.12,-.29,.03]],.005,{tissue:'protein',color:C.pale,segments:16});for(const x of[-.36,-.12])c.tube('scale-bar',[[x,-.305,.03],[x,-.275,.03]],.005,{tissue:'protein',color:C.pale,segments:8});
 c.sheet('optical-section',[-.05,.18,.035],[.23,.026,0],{tissue:'protein',color:C.lipid,ripple:0,bend:0,nu:32,nv:4});c.group.userData.molecularRepresentation='conceptual-optical-diagram-scale-bar-not-calibrated-microscopy';
}

const BUILDERS={'animal-cell':animalCell,'plant-cell':plantCell,'bacterial-cell':bacteria,'fungal-cell':fungalCell,'cell-theory-microscopy':microscopy,'plasma-membrane':plasmaMembrane,ribosome,'rough-er':roughER,'smooth-er':smoothER,golgi,'lysosome-autophagy':lysosome,peroxisome,vacuole,mitochondrion,chloroplast,'nucleus-chromatin':nucleus,cytoskeleton,'cilia-flagella':cilia,'cell-junctions':junctions,'viruses-acellular':viruses};
export const DETAILED_ORGANELLE_IDS=Object.freeze(Object.keys(BUILDERS));
export function createDetailedOrganelleModel(id,definition,{mobile=false}={}){
 const build=BUILDERS[id];if(!build)return null;if(definition?.id!==id||!Array.isArray(definition.parts))throw new TypeError('Definição citológica incompatível: '+id);
 const c=createCytologyContext(definition,{mobile});build(c);const model=c.finish({authoredOrganelle:true});model.sources=SOURCES;return model;
}
