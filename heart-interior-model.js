import * as THREE from 'three';
import {createOrganModelContext} from './internal-models.js';

/* Authored anatomical cutaway, NOT a scan or a segmentation of the reference
 * GLBs. Both endocardial bowls share their exact boundaries with the continuous
 * myocardial wall. Chordal endpoints are sampled from the actual AV free edges;
 * trabecular paths are embedded in those same endocardial surfaces. No primitive
 * markers stand in for anatomical pieces. The frontal exposure deliberately
 * unfolds the posterior outflow tracts, so all four valves remain readable.
 */
const C={muscle:0xa64951,septum:0xaa5057,endocardium:0xc47b7b,rightEndocardium:0xb9767d,atrial:0xc8898b,ivory:0xdacdb2,artery:0xc96c66,vein:0x718bb4,conduction:0xdbb768};
const SOURCE='https://openstax.org/books/anatomy-and-physiology-2e/pages/19-1-heart-anatomy';
const SOURCES=[SOURCE,'https://openstax.org/books/anatomy-and-physiology-2e/pages/19-2-cardiac-muscle-and-electrical-activity','https://www.vhlab.umn.edu/atlas/right-ventricle/index.shtml','https://www.vhlab.umn.edu/atlas/left-ventricle/index.shtml'];
const FRONT=.08,DEPTH=.30,INNER_DEPTH=DEPTH*.94;
const OUTER=[[-.25,.42],[-.42,.34],[-.47,.16],[-.405,-.12],[-.235,-.30],[.145,-.535],[.34,-.30],[.432,-.07],[.427,.225],[.30,.414],[.015,.422]];
const RIGHT=[[-.295,.35],[-.39,.27],[-.392,.12],[-.355,.045],[-.357,-.095],[-.277,-.205],[-.13,-.306],[-.022,-.34],[-.068,-.205],[-.079,-.055],[-.100,.065],[-.112,.128],[-.125,.25],[-.168,.345]];
const LEFT=[[.147,.338],[.283,.34],[.346,.246],[.335,.145],[.304,.07],[.301,-.095],[.259,-.24],[.172,-.395],[.127,-.338],[.096,-.215],[.080,-.065],[.083,.045],[.111,.125],[.12,.258]];
const vec=p=>new THREE.Vector3(...p);
const bundle=objects=>{const g=new THREE.Group();objects.forEach(o=>g.add(o));return g};

function sampledLoop(points,n){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(p[0],p[1],0)),true,'centripetal');
  const loop=curve.getPoints(n).slice(0,n).map(p=>new THREE.Vector2(p.x,p.y));
  // Match organicGeometry's hole orientation, keeping the two surfaces congruent.
  if(THREE.ShapeUtils.isClockWise(loop))loop.reverse();
  return loop;
}
function cavitySurface(loop,levels){
  const n=loop.length,center=loop.reduce((a,p)=>a.add(p),new THREE.Vector2()).multiplyScalar(1/n),v=[],ix=[],tones=[];
  // Same depth tones as the wall's cavity sides (internal-models.js organicGeometry): deeper lining reads darker.
  const tone=shade=>[1-.30*shade**1.4,1-.36*shade**1.4,1-.35*shade**1.4];
  for(let j=0;j<levels;j++){
    const t=j/(levels-1)*Math.PI*.47,s=Math.cos(t),z=FRONT-INNER_DEPTH*Math.sin(t)+.0007;
    for(const p of loop){v.push(center.x+(p.x-center.x)*s,center.y+(p.y-center.y)*s,z);tones.push(...tone(Math.sin(t)))}
  }
  for(let j=0;j<levels-1;j++)for(let i=0;i<n;i++){
    const a=j*n+i,b=j*n+(i+1)%n,c=b+n,d=a+n;ix.push(a,b,c,a,c,d);
  }
  const tip=v.length/3;v.push(center.x,center.y,FRONT-INNER_DEPTH+.0007);tones.push(...tone(1));
  for(let i=0;i<n;i++)ix.push((levels-1)*n+i,(levels-1)*n+(i+1)%n,tip);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setAttribute('color',new THREE.Float32BufferAttribute(tones,3));g.setIndex(ix);g.computeVertexNormals();
  g.userData={continuousEndocardium:true,sharedWallBoundary:true,depth:INNER_DEPTH};
  return {geometry:g,center,loop};
}

// Clip the rear lining into selectable atrial/ventricular patches without
// introducing a transverse plate that would block the AV communication.
function splitSurface(geometry,yCut){
  const pos=geometry.attributes.position,norm=geometry.attributes.normal,color=geometry.attributes.color,index=geometry.index.array,out=[{p:[],n:[],c:[]},{p:[],n:[],c:[]}];
  const at=i=>({p:new THREE.Vector3().fromBufferAttribute(pos,i),n:new THREE.Vector3().fromBufferAttribute(norm,i),c:color?new THREE.Vector3().fromBufferAttribute(color,i):null});
  for(let q=0;q<index.length;q+=3)for(let side=0;side<2;side++){
    const polygon=[at(index[q]),at(index[q+1]),at(index[q+2])],clipped=[];
    const inside=p=>side?p.p.y<=yCut:p.p.y>=yCut;
    for(let i=0;i<polygon.length;i++){
      const a=polygon[i],b=polygon[(i+1)%polygon.length],ia=inside(a),ib=inside(b);
      if(ia)clipped.push(a);
      if(ia!==ib){const t=(yCut-a.p.y)/(b.p.y-a.p.y);clipped.push({p:a.p.clone().lerp(b.p,t),n:a.n.clone().lerp(b.n,t).normalize(),c:a.c&&a.c.clone().lerp(b.c,t)})}
    }
    for(let i=1;i<clipped.length-1;i++)for(const e of[clipped[0],clipped[i],clipped[i+1]]){out[side].p.push(...e.p.toArray());out[side].n.push(...e.n.toArray());if(e.c)out[side].c.push(...e.c.toArray())}
  }
  return out.map(data=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(data.p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(data.n,3));if(data.c.length)g.setAttribute('color',new THREE.Float32BufferAttribute(data.c,3));g.userData={...geometry.userData,sharedCutSeam:yCut};return g});
}

// Position on the exact bowl used above, found by a ray from its polar center.
// No approximate floating floor is used as the base of papillary/trabecular mesh.
function floorAt(surface,x,y){
  const {center,loop}=surface,dx=x-center.x,dy=y-center.y;let radius=Infinity;
  for(let i=0;i<loop.length;i++){
    const a=loop[i],b=loop[(i+1)%loop.length],ex=b.x-a.x,ey=b.y-a.y,den=dx*ey-dy*ex;
    if(Math.abs(den)<1e-10)continue;
    const ax=a.x-center.x,ay=a.y-center.y,t=(ax*ey-ay*ex)/den,u=(ax*dy-ay*dx)/den;
    if(t>0&&u>=-1e-6&&u<=1.000001)radius=Math.min(radius,t);
  }
  const s=Number.isFinite(radius)?THREE.MathUtils.clamp(1/radius,0,1):0;
  return [x,y,FRONT-INNER_DEPTH*Math.sqrt(Math.max(0,1-s*s))+.0007];
}

function tubeGeometry(points,radii,{segments=32,radial=14,closed=false,fluting=0}={}){
  const curve=new THREE.CatmullRomCurve3(points.map(vec),closed,'centripetal'),frames=curve.computeFrenetFrames(segments,closed),p=[],ix=[];
  for(let i=0;i<=segments;i++){
    const t=i/segments,center=curve.getPointAt(t),u=t*(radii.length-1),r=THREE.MathUtils.lerp(radii[Math.floor(u)],radii[Math.min(radii.length-1,Math.ceil(u))],u-Math.floor(u));
    for(let j=0;j<=radial;j++){const a=j/radial*Math.PI*2,rr=r*(1+fluting*Math.sin(a*5+t*8)),q=center.clone().addScaledVector(frames.normals[i],Math.cos(a)*rr).addScaledVector(frames.binormals[i],Math.sin(a)*rr);p.push(...q.toArray())}
  }
  for(let i=0;i<segments;i++)for(let j=0;j<radial;j++){const a=i*(radial+1)+j;ix.push(a,a+radial+1,a+radial+2,a,a+radial+2,a+1)}
  if(!closed)for(const [i,reverse]of[[0,true],[segments,false]]){
    const cap=p.length/3;p.push(...curve.getPointAt(i/segments).toArray());
    for(let j=0;j<radial;j++){const a=i*(radial+1)+j;ix.push(...(reverse?[a,cap,a+1]:[a,a+1,cap]))}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();g.userData={curvedLoft:true,capped:!closed};return g;
}
function mergeGeometries(geometries,metadata={}){
  const p=[],n=[],ix=[];let offset=0;
  for(const g of geometries){p.push(...g.attributes.position.array);n.push(...g.attributes.normal.array);const ids=g.index?.array||Array.from({length:g.attributes.position.count},(_,i)=>i);for(const i of ids)ix.push(i+offset);offset+=g.attributes.position.count;g.dispose()}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.setIndex(ix);g.userData=metadata;return g;
}

function valveSurface(center,rx,rz,start,end,{semilunar=false,cusp=0,mobile=false,seatSurface=null}={}){
  const A=mobile?24:40,R=mobile?9:16,p=[],ix=[];
  const point=(u,v)=>{
    const a=start+(end-start)*u,lobe=Math.sin(Math.PI*u),shrink=(semilunar?.96:.67)*v*lobe;
    const radial=1-shrink,drop=semilunar?(.020*v+.023*Math.sin(Math.PI*v)*lobe):-(.010*v+(.052+(cusp%2)*.011)*v*lobe);
    let z=center[2]+rz*Math.sin(a)*radial;
    if(seatSurface){
      const xRoot=center[0]+rx*Math.cos(a),floor=floorAt(seatSurface,xRoot,center[1])[2],frontArc=Math.max(0,Math.sin(a)),rootZ=floor+frontArc*(FRONT-floor);
      z=THREE.MathUtils.lerp(rootZ,center[2]+rz*Math.sin(a)*.3,shrink);
    }
    return [center[0]+rx*Math.cos(a)*radial,center[1]+drop,z];
  };
  for(let j=0;j<=R;j++)for(let i=0;i<=A;i++)p.push(...point(i/A,j/R));
  for(let j=0;j<R;j++)for(let i=0;i<A;i++){const a=j*(A+1)+i;ix.push(a,a+A+1,a+A+2,a,a+A+2,a+1)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();g.userData={geometryKind:semilunar?'semilunar-pocket':'atrioventricular-cusp',cusp,hasChordae:!semilunar};return {geometry:g,point};
}

export function createHeartInteriorModel(definition={}, {mobile=false}={}){
  const r=createOrganModelContext('heart','Coração — corte anatômico das estruturas internas','Parede contínua e câmaras abertas, com cúspides, cordas ramificadas, músculos papilares e trabéculas aderidas ao endocárdio. Reconstrução autoral para ensino.');
  const samples=mobile?144:256,levels=mobile?25:42,attachments={chordae:[],papillary:[],trabeculae:[]},allValveEdges={};
  const add=(object,key,label,fn,tissue,details={})=>r.part(object,key,label,fn,tissue,{geometryIdentified:true,annotationOnly:false,sourceUrls:SOURCES,commonMistake:'Forma e posição representam uma reconstrução didática; espessuras e abertura do corte foram ajustadas para leitura.',...details});
  const wall=r.organic(OUTER,DEPTH,C.muscle,FRONT,[RIGHT,LEFT],{samples,levels,holeDepth:.94});
  wall.userData={...wall.userData,continuousMyocardium:true,leftFreeWallThickness:.15,rightFreeWallThickness:.067};
  add(wall,'myocardium','Miocárdio','Contrair a parede cardíaca para gerar pressão e ejetar sangue; a parede livre esquerda é mais espessa, pois trabalha contra a resistência sistêmica.','muscle');
  const right=cavitySurface(sampledLoop(RIGHT,samples),levels),left=cavitySurface(sampledLoop(LEFT,samples),levels);
  for(const[surface,prefix,labels,color]of[[right,'right',['Átrio direito','Ventrículo direito'],C.rightEndocardium],[left,'left',['Átrio esquerdo','Ventrículo esquerdo'],C.endocardium]]){
    const pieces=splitSurface(surface.geometry,.075);surface.geometry.dispose();
    pieces.forEach((g,i)=>{const m=r.mesh(g,i?color:C.atrial);m.userData.geometryKind='continuous-chamber-endocardium';add(m,prefix+(i?'_ventricle':'_atrium'),labels[i],i?(prefix==='right'?'Receber sangue pela tricúspide e ejetá-lo no tronco pulmonar.':'Receber sangue pela mitral e ejetá-lo na aorta.'):(prefix==='right'?'Receber retorno venoso sistêmico pelas veias cavas.':'Receber sangue oxigenado pelas veias pulmonares.'),'organ',{commonMistake:'A superfície selecionada é o revestimento endocárdico da câmara aberta; a cavidade é o espaço à sua frente, não um bloco sólido de sangue.'})});
  }
  add(r.organic([[-.073,.107],[.078,.107],[.085,-.035],[.109,-.216],[.126,-.338],[.055,-.370],[-.025,-.282],[-.064,-.115]],.266,C.septum,FRONT+.0015,[],{samples:mobile?96:180,levels:mobile?18:30}),'septum','Septo interventricular','Formar a parede muscular entre os ventrículos e sustentar a condução pelos ramos do feixe atrioventricular.','muscle');

  function valve(key,label,center,rx,rz,n,semilunar=false,seatSurface=null){
    const geos=[],edges=[];
    const annulusSurface=valveSurface(center,rx,rz,0,Math.PI*2,{semilunar,mobile,seatSurface});
    const annulus=Array.from({length:mobile?49:81},(_,i)=>annulusSurface.point(i/(mobile?48:80),0));annulusSurface.geometry.dispose();
    geos.push(tubeGeometry(annulus,[semilunar?.0037:.0048,semilunar?.0037:.0048],{segments:mobile?48:80,radial:mobile?10:14,closed:true}));
    for(let i=0;i<n;i++){
      const cusp=valveSurface(center,rx,rz,i/n*Math.PI*2,(i+1)/n*Math.PI*2,{semilunar,cusp:i,mobile,seatSurface});geos.push(cusp.geometry);edges.push(cusp.point);
      // Subtle thickening of the free edge gives each cusp a readable contour.
      geos.push(tubeGeometry(Array.from({length:mobile?19:33},(_,j)=>cusp.point(j/(mobile?18:32),1)),[.0018,.0018],{segments:mobile?18:32,radial:mobile?8:10}));
    }
    const mesh=r.mesh(mergeGeometries(geos,{cusps:n,semilunar,attachedToFibrousAnnulus:true,posteriorSeatOnEndocardium:!!seatSurface}),C.ivory);
    add(mesh,key,label,semilunar?'As bolsas semilunares respondem à diferença de pressão e limitam o refluxo arterial para o ventrículo; não recebem cordas tendíneas.':'As cúspides abrem e fecham por diferenças de pressão; cordas e músculos papilares limitam sua eversão durante a sístole.','connective');
    allValveEdges[key]=edges;return edges;
  }
  const rightEdges=valve('tricuspid_valve','Valva tricúspide',[-.237,.083,-.047],.132,.090,3,false,right);
  const leftEdges=valve('mitral_valve','Valva mitral',[.200,.081,-.047],.110,.084,2,false,left);
  valve('pulmonary_valve','Valva pulmonar',[-.058,.273,-.048],.043,.035,3,true);
  valve('aortic_valve','Valva aórtica',[.077,.274,-.078],.044,.037,3,true);

  const muscles={right:[{name:'Músculo papilar anterior direito',base:[-.308,-.100],tip:[-.270,-.057,.012]},{name:'Músculo papilar posterior direito',base:[-.172,-.235],tip:[-.200,-.118,.004]},{name:'Músculo papilar septal direito',base:[-.106,-.112],tip:[-.137,-.067,-.018]}],left:[{name:'Músculo papilar anterolateral esquerdo',base:[.270,-.148],tip:[.249,-.089,.002]},{name:'Músculo papilar posteromedial esquerdo',base:[.141,-.284],tip:[.150,-.143,-.013]}]};
  for(const[side,surface,label]of[['right',right,'Músculos papilares direitos'],['left',left,'Músculos papilares esquerdos']]){
    const objects=[];
    for(const muscle of muscles[side]){
      const base=floorAt(surface,...muscle.base),tip=muscle.tip,mid=[(base[0]+tip[0])*.5,(base[1]+tip[1])*.5,(base[2]+tip[2])*.5];
      const g=tubeGeometry([base,mid,tip],[side==='left'?.022:.018,.016,.004],{segments:mobile?32:52,radial:mobile?14:22,fluting:.065});
      g.userData={muscleName:muscle.name,endocardialBase:base,chordalOrigin:tip};const mesh=r.mesh(g,C.muscle);mesh.userData.substructureLabel=muscle.name;objects.push(mesh);
      attachments.papillary.push({side,name:muscle.name,base,tip,floor:floorAt(surface,...muscle.base)});
    }
    add(bundle(objects),'papillary_'+side,label,'Contrair em conjunto com o miocárdio ventricular para tensionar as cordas e limitar o prolapso das cúspides atrioventriculares; sua contração não abre as valvas.','muscle');
  }

  function cords(side,edges,key,label){
    const geos=[],sideMuscles=muscles[side];
    for(let m=0;m<sideMuscles.length;m++)for(let a=0;a<2;a++){
      const cusp=side==='right'?(m+a)%3:a,origin=sideMuscles[m].tip,edge=edges[cusp],central=edge(.5,1),junction=[THREE.MathUtils.lerp(origin[0],central[0],.56),THREE.MathUtils.lerp(origin[1],central[1],.58),THREE.MathUtils.lerp(origin[2],central[2],.55)];
      geos.push(tubeGeometry([origin,[(origin[0]+junction[0])*.5,(origin[1]+junction[1])*.5,(origin[2]+junction[2])*.5+.003],junction],[.0019,.0015,.0012],{segments:mobile?18:28,radial:mobile?8:12}));
      const count=side==='right'?3:4;
      for(let branch=0;branch<count;branch++){
        const u=.18+.64*branch/(count-1),end=edge(u,1),mid=[(junction[0]+end[0])*.5,(junction[1]+end[1])*.5,(junction[2]+end[2])*.5+.002];
        geos.push(tubeGeometry([junction,mid,end],[.0013,.0009,.00075],{segments:mobile?16:26,radial:mobile?8:12}));
        attachments.chordae.push({side,valve:side==='right'?'tricuspid_valve':'mitral_valve',papillary:sideMuscles[m].name,origin,junction,end,cusp,edgeParameter:u,leafletPoint:edge(u,1)});
      }
    }
    const g=mergeGeometries(geos,{branchedChordae:true,attachedAtBothEnds:true,valve:side==='right'?'tricuspid_valve':'mitral_valve'});
    add(r.mesh(g,C.ivory),key,label,'Transmitir tensão entre músculos papilares e cúspides atrioventriculares, impedindo sua eversão para o átrio durante a sístole; não existem cordas nas valvas semilunares.','connective');
  }
  cords('right',rightEdges,'chordae_tendineae','Cordas tendíneas da tricúspide');
  cords('left',leftEdges,'chordae_mitral','Cordas tendíneas da mitral');

  function trabeculae(side,surface){
    const geos=[],paths=[];
    // Paths follow the posterior ventricular wall, below the AV plane. They
    // intersect the endocardium along their entire length instead of crossing
    // the chamber as arbitrary bars. Both quality levels retain every path.
    const spans=side==='right'?[
      [[-.326,.020],[-.337,-.062],[-.286,-.154],[-.174,-.247]],
      [[-.297,.010],[-.293,-.081],[-.221,-.169],[-.112,-.275]],
      [[-.262,.001],[-.240,-.084],[-.166,-.167],[-.076,-.281]],
      [[-.226,-.015],[-.201,-.088],[-.143,-.160],[-.063,-.269]],
      [[-.184,-.018],[-.161,-.082],[-.118,-.153],[-.071,-.239]],
      [[-.142,-.022],[-.123,-.078],[-.105,-.150],[-.093,-.204]],
      [[-.331,-.079],[-.275,-.114],[-.205,-.124],[-.130,-.108]],
      [[-.284,-.150],[-.233,-.184],[-.163,-.196],[-.098,-.185]],
      [[-.231,-.196],[-.178,-.237],[-.108,-.257],[-.066,-.261]],
      [[-.302,-.034],[-.273,-.066],[-.233,-.081]],
      [[-.242,-.118],[-.199,-.133],[-.163,-.147]],
      [[-.176,-.205],[-.144,-.217],[-.102,-.210]]
    ]:[
      [[.277,.027],[.278,-.069],[.254,-.172],[.194,-.307]],
      [[.250,.024],[.252,-.077],[.228,-.186],[.183,-.337]],
      [[.220,.014],[.224,-.078],[.204,-.176],[.167,-.335]],
      [[.190,.012],[.190,-.087],[.179,-.193],[.159,-.310]],
      [[.156,.010],[.146,-.084],[.146,-.193],[.150,-.286]],
      [[.118,.023],[.112,-.066],[.123,-.177],[.138,-.254]],
      [[.284,-.107],[.245,-.120],[.199,-.122],[.139,-.113]],
      [[.252,-.207],[.221,-.237],[.177,-.242],[.139,-.224]],
      [[.208,-.294],[.187,-.323],[.166,-.322],[.151,-.289]],
      [[.241,-.038],[.224,-.057],[.186,-.062]],
      [[.227,-.156],[.203,-.184],[.176,-.192]],
      [[.170,-.219],[.159,-.239],[.147,-.253]]
    ];
    for(let j=0;j<spans.length;j++){
      const curve=new THREE.CatmullRomCurve3(spans[j].map(p=>new THREE.Vector3(...p,0)),false,'centripetal'),path=[];
      const n=mobile?20:36,radius=(side==='right'?.0051:.0038)*(j>=6?.74:1);
      for(let i=0;i<=n;i++){const p=curve.getPoint(i/n),q=floorAt(surface,p.x,p.y);q[2]+=radius*(.18*Math.sin(Math.PI*i/n)-.36*Math.pow(Math.abs(2*i/n-1),6));path.push(q)}
      geos.push(tubeGeometry(path,[radius*.4,radius,radius*.65,radius*.35],{segments:n,radial:mobile?10:14,fluting:.06}));
      paths.push(path);attachments.trabeculae.push({side,radius,points:path,floorPoints:path.map(p=>floorAt(surface,p[0],p[1]))});
    }
    add(r.mesh(mergeGeometries(geos,{wallAttachedTrabeculae:true,continuousRidges:paths.length}),C.muscle),'trabeculae_'+side,side==='right'?'Trabéculas cárneas direitas':'Trabéculas cárneas esquerdas','Formar relevos musculares revestidos por endocárdio na parede ventricular; distinguem-se das cordas tendíneas, que são cordões conjuntivos ligados às cúspides.','muscle');
  }
  trabeculae('right',right);trabeculae('left',left);

  add(r.taperedTube([[.077,.214,-.078],[.077,.405,-.078],[.160,.530,-.084],[.297,.536,-.103],[.393,.383,-.13]],[.047,.047,.044,.040,.037],C.artery,true),'aorta','Aorta','Receber a ejeção do ventrículo esquerdo através da valva aórtica e distribuir sangue à circulação sistêmica.','vascular');
  add(r.taperedTube([[-.083,.070,-.05],[-.058,.262,-.048],[-.091,.412,-.054],[-.225,.482,-.08],[-.385,.451,-.105]],[.037,.043,.041,.033,.030],C.vein,true),'pulmonary_trunk','Tronco pulmonar','Receber a ejeção do ventrículo direito através da valva pulmonar e dirigir o sangue às artérias pulmonares.','vascular');
  add(bundle([
    r.taperedTube([[-.30,.561,-.085],[-.309,.389,-.062],[-.304,.273,-.050]],[.039,.039,.032],C.vein,true),
    r.taperedTube([[-.405,-.305,-.095],[-.398,-.020,-.099],[-.318,.153,-.095]],[.036,.035,.030],C.vein,true)
  ]),'venae_cavae','Veias cavas','Devolver sangue sistêmico ao átrio direito; a cava superior chega acima e a inferior chega pela região posteroinferior.','vascular');

  add(r.organic([[-.331,.332],[-.319,.349],[-.301,.343],[-.300,.326],[-.316,.318]],.015,C.conduction,FRONT+.015,[],{samples:mobile?40:64,levels:mobile?8:12}),'sinoatrial_node','Nó sinoatrial (ampliado)','Iniciar normalmente o ritmo por despolarização espontânea de cardiomiócitos especializados junto à chegada da veia cava superior.','muscle',{coreId:'sinoatrial-node',commonMistake:'Tamanho ampliado e posição projetada no corte; não é um nervo nem uma massa macroscópica desse tamanho.'});
  add(r.organic([[-.129,.115],[-.113,.129],[-.096,.115],[-.106,.096],[-.124,.099]],.014,C.conduction,FRONT+.016,[],{samples:mobile?40:64,levels:mobile?8:12}),'atrioventricular_node','Nó atrioventricular (ampliado)','Retardar a condução entre átrios e ventrículos, favorecendo a sequência de enchimento e ejeção.','muscle',{commonMistake:'Localização projetada e tamanho ampliado para ensino; tecido cardíaco especializado, não um nervo.'});
  const conduction=[
    [[-.113,.111,FRONT+.019],[-.031,.019,FRONT+.019],[.021,-.140,FRONT+.017],[.059,-.302,FRONT+.014]],
    [[.011,-.101,FRONT+.016],[-.084,-.225,.003],[-.219,-.173,-.112],[-.30,-.043,-.130]],
    [[.059,-.284,FRONT+.013],[.161,-.322,-.045],[.263,-.182,-.147],[.276,-.016,-.109]]
  ];
  add(r.mesh(mergeGeometries(conduction.map(p=>tubeGeometry(p,[.0028,.0023,.0016],{segments:mobile?30:48,radial:mobile?8:12})),{projectedConductionNetwork:true}),C.conduction),'his_purkinje','Feixe de His, ramos e fibras de Purkinje','Distribuir a despolarização pelo septo e pelas regiões subendocárdicas dos ventrículos; traçado ampliado e projetado no corte.','muscle');

  const model=r.finish();model.bounds=new THREE.Box3().setFromObject(model.group);model.title=definition.title||model.title;
  model.authoredReconstruction=true;model.anatomicalReference=false;model.defaultClip='none';model.preserveMaterials=false;model.sources=SOURCES;
  model.group.userData={...model.group.userData,authoredReconstruction:true,anatomicalCutaway:true,sharedCavityContours:true};
  model.limits='Reconstrução anatômica autoral para ensino, não derivada de tomografia ou de segmentação dos arquivos de referência. Corte frontal com exposição posterior ajustada, proporções não clínicas, condução ampliada e valvas parcialmente abertas. Cor não representa necessariamente tecido fresco. Os relevos são macroscópicos, não lâminas histológicas.';
  model.stats={...model.stats,mobile,continuousMyocardium:true,chamberWallContinuity:true,semilunarChordae:0,papillaryMusclesRight:3,papillaryMusclesLeft:2,chordalBranches:attachments.chordae.length,trabecularRidges:attachments.trabeculae.length};
  model.geometryAudit={coordinateSpace:'local-before-normalization',attachments,leftFreeWallThickness:.15,rightFreeWallThickness:.067,avFreeEdges:Object.keys(allValveEdges).filter(k=>!k.startsWith('aortic')&&!k.startsWith('pulmonary')),chamberSeam:.075};
  return model;
}
