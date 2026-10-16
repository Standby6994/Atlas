import * as THREE from 'three';
import {upgradeHistologyGeometry} from './histology-geometry.js';

// Original static teaching models. Cuts and cell counts are illustrative.
// Scientific descriptions and verified references live in supplementary-content.json.
const COLORS={organ:0xbc7476,muscle:0x9b454d,connective:0xd4ba9d,cartilage:0xc0d2cf,bone:0xe4d6bb,neural:0xb4abc4,vascular:0xa25165,fat:0xd9c27d};
export function createSupplementaryModel(id,definition,histology=false,options={}){
  const group=new THREE.Group();group.name=(histology?'HISTO_':'INTERNAL_')+id;group.userData.schematic=true;
  const geometries=new Map(),materials=new Map(),parts=[];
  const sourceParts=histology?definition.parts:definition.internalParts;
  function geometry(key,build){if(!geometries.has(key))geometries.set(key,build());return geometries.get(key)}
  function material(tissue,color){const key=tissue+':'+color;if(!materials.has(key)){const m=new THREE.MeshStandardMaterial({color:color??COLORS[tissue]??COLORS.organ,roughness:.54,side:THREE.DoubleSide});m.name='Didactic '+tissue;materials.set(key,m)}return materials.get(key)}
  for(const p of sourceParts){const object=new THREE.Group();object.name=group.name+'_'+p.id;object.userData.schematic=true;object.userData.tissue=p.tissue||'organ';group.add(object);parts.push({...p,name:object.name,object})}
  const at=pid=>parts.find(p=>p.id===pid)?.object;
  function mesh(parent,geo,pos=[0,0,0],scale=[1,1,1],color){if(!parent)return;const tissue=parent.userData.tissue||'organ';const m=new THREE.Mesh(geo,material(tissue,color));m.position.set(...pos);m.scale.set(...scale);m.userData.tissue=tissue;parent.add(m);return m}
  function ball(parent,pos,size,color){const variant=Math.abs(Math.round(pos[0]*17+pos[1]*23+pos[2]*11))%4;return mesh(parent,geometry('organic-'+variant,()=>{const g=new THREE.SphereGeometry(1,28,18),p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),a=Math.atan2(y,x),f=1+.035*Math.sin(3*a+variant)*Math.sin(Math.acos(Math.max(-1,Math.min(1,z))));p.setXYZ(i,x*f,y*f,z*(1+.018*Math.sin(x*4+variant)))}g.computeVertexNormals();return g}),pos,size,color)}
  function organicPatch(parent,points,depth,pos=[0,0,0],color,bevel=.004){const shape=new THREE.Shape();shape.moveTo(...points[0]);for(let i=1;i<points.length;i++)shape.lineTo(...points[i]);shape.closePath();const geo=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:3,curveSegments:18});return mesh(parent,geo,[pos[0],pos[1],pos[2]-depth/2],[1,1,1],color)}
  function box(parent,pos,size,color){return mesh(parent,geometry('rounded-tissue',()=>{const s=new THREE.Shape(),r=.12;s.moveTo(-.5+r,-.5);s.lineTo(.5-r,-.5);s.quadraticCurveTo(.5,-.5,.5,-.5+r);s.lineTo(.5,.5-r);s.quadraticCurveTo(.5,.5,.5-r,.5);s.lineTo(-.5+r,.5);s.quadraticCurveTo(-.5,.5,-.5,.5-r);s.lineTo(-.5,-.5+r);s.quadraticCurveTo(-.5,-.5,-.5+r,-.5);return new THREE.ExtrudeGeometry(s,{depth:.94,bevelEnabled:true,bevelThickness:.03,bevelSize:.03,bevelSegments:3,curveSegments:8})}),[pos[0],pos[1],pos[2]-size[2]*.47],size,color)}
  function ring(parent,outer,inner,length,pos=[0,0,0],color,start=.28,end=Math.PI*1.75){
    const key=['ring',outer,inner,length,start,end].join(':');const geo=geometry(key,()=>{const shape=new THREE.Shape(),folded=/ureter|urethra|vas-deferens|vagina|seminal-vesicle/.test(id),flattened=/vagina|venous|lymphatic/.test(id);const point=(r,a)=>{const amp=folded?.012+.05*Math.max(0,1-r/.48):.012,f=1+amp*Math.cos(6*a)+.007*Math.sin(3*a);return [r*f*Math.cos(a),r*f*Math.sin(a)*(flattened?.70:1)]};const count=72;shape.moveTo(...point(outer,start));for(let i=1;i<=count;i++)shape.lineTo(...point(outer,start+(end-start)*i/count));shape.lineTo(...point(inner,end));for(let i=1;i<=count;i++)shape.lineTo(...point(inner,end-(end-start)*i/count));shape.closePath();return new THREE.ExtrudeGeometry(shape,{depth:length,bevelEnabled:false,curveSegments:36})});
    return mesh(parent,geo,[pos[0],pos[1],pos[2]-length/2],[1,1,1],color);
  }
  function line(parent,points,radius=.025,color){const vectors=points.map(p=>new THREE.Vector3(...p));const curve=new THREE.CatmullRomCurve3(vectors);return mesh(parent,new THREE.TubeGeometry(curve,Math.max(12,points.length*6),radius,8,false),[0,0,0],[1,1,1],color)}
  function disc(parent,pos,size,color){const m=mesh(parent,geometry('disc',()=>new THREE.CylinderGeometry(1,1,1,32)),pos,size,color);m.rotation.x=Math.PI/2;return m}
  function cloud(parent,center,count,r=.035,color,flatten=false){
    for(let i=0;i<count;i++){const a=i*2.39996,q=Math.sqrt((i+.5)/count)*.24;ball(parent,[center[0]+q*Math.cos(a),center[1]+q*Math.sin(a),center[2]+(flatten?0:.035*Math.sin(i*3.1))],[r,r,r*.75],color)}
  }
  function cellsAround(parent,center,count,radius=.24,height=.1,color){
    const outer=radius+.056,inner=radius-.105;for(let i=0;i<count;i++){const a=2*Math.PI*i/count,start=a-Math.PI/count+.002,end=a+Math.PI/count-.002,points=[];for(let j=0;j<=8;j++){const t=start+(end-start)*j/8,r=outer*(1+.018*Math.sin(3*t));points.push([r*Math.cos(t),r*Math.sin(t)])}for(let j=0;j<=8;j++){const t=end-(end-start)*j/8,r=inner*(1+.045*Math.sin(3*t));points.push([r*Math.cos(t),r*Math.sin(t)])}organicPatch(parent,points,height*1.2,center,color,.001);const nuclearRadius=radius+.006;ball(parent,[center[0]+nuclearRadius*Math.cos(a),center[1]+nuclearRadius*Math.sin(a),center[2]+height*.72],[.026,.035,.010],0x634b77)}
  }
  function integratedEnvelope(parent,outline,depth,color){if(!parent)return;const points=[];const curve=new THREE.CatmullRomCurve3(outline.map(p=>new THREE.Vector3(p[0],p[1],0)),true,'centripetal');for(const p of curve.getPoints(72))points.push([p.x,p.y]);const m=organicPatch(parent,points,depth,[0,0,-depth/2-.10],color,.008);if(id==='diaphragm'){const p=m.geometry.attributes.position;for(let i=0;i<p.count;i++)p.setZ(i,p.getZ(i)+.20*(1-(p.getX(i)/.65)**2-(p.getY(i)/.50)**2));p.needsUpdate=true;m.geometry.computeVertexNormals()}return m}
  function cellTile(parent,left,right,bottom,top,front,color){const points=[],warp=(x,y)=>[x+.009*Math.sin(y*15),y+.007*Math.sin(x*11)];for(const [a,b]of [[[left,bottom],[right,bottom]],[[right,bottom],[right,top]],[[right,top],[left,top]],[[left,top],[left,bottom]]])for(let i=0;i<5;i++)points.push(warp(a[0]+(b[0]-a[0])*i/5,a[1]+(b[1]-a[1])*i/5));organicPatch(parent,points,.08,[0,0,front-.04],color,0)}
  function setFiber(parent,axis='y'){if(parent)parent.userData.fiberAxis=axis}
  function addTube(){
    const layers=parts.filter(p=>!/lumen|rugae|sphincter/.test(p.id));let outer=.45;
    // Outer-to-inner drawings keep cut faces readable rather than hiding layers.
    const ordered=[...layers].reverse();for(const [i,p] of ordered.entries()){const width=.24/ordered.length;ring(p.object,outer,outer-width,.65+i*.025,[0,0,-i*.012],undefined);outer-=width;setFiber(p.object,p.id.includes('longitudinal')?'z':'y')}
    const lumen=at('lumen');if(lumen){disc(lumen,[0,0,-.36],[.18,.015,.18],0x799baf);lumen.userData.schematicSpace=true}
    if(at('external-sphincter'))ring(at('external-sphincter'),.13,.07,.17,[.65,0,0],undefined,0,Math.PI*2);
    if(at('rugae'))for(let i=0;i<6;i++)line(at('rugae'),[[-.14,.19-i*.075,.34],[0,.23-i*.075,.35],[.15,.19-i*.075,.34]],.014);
  }
  function addGland(){
    integratedEnvelope(at('capsule-septa')||at('stroma'),[[-.48,-.20],[-.46,.19],[-.22,.43],[.15,.40],[.45,.15],[.48,-.16],[.24,-.37],[-.18,-.40]],.20,0xc5a89e);
    const centers=[];const secretory=at('acini')||at('alveoli');for(let i=0;i<15;i++){const a=i*2.39996,q=.36*Math.sqrt((i+.5)/15);const pos=[q*Math.cos(a),q*Math.sin(a),.075*Math.sin(i)];centers.push(pos);ball(secretory,pos,[.10,.10,.09],i%3===0?0xc0a98d:undefined);line(at('intercalated-duct')||at('ducts'),[pos,[pos[0]*.5,pos[1]*.5,.05],[0,0,.02]],.013,0xe6c3a1)}
    line(at('striated-duct'),[[0,0,.03],[0,-.23,.01],[.12,-.37,0]],.04);line(at('excretory-duct')||at('ducts'),[[.12,-.37,0],[.22,-.53,0],[.42,-.56,0]],.045);
    ring(at('capsule-septa')||at('stroma'),.47,.43,.17,[0,0,-.12],undefined,.12,Math.PI*1.78);
    if(at('fat'))for(let i=0;i<9;i++){const a=i*.65;ball(at('fat'),[.47*Math.cos(a),.4*Math.sin(a),-.06],[.07,.08,.06])}
    if(at('myoepithelial'))for(const pos of centers.filter((_,i)=>i%2===0))ring(at('myoepithelial'),.106,.098,.05,pos,undefined,.1,Math.PI*1.8);
  }
  function addEndocrine(){
    const pineal=id==='pineal',cells=at('chief-cells')||at('pinealocytes'),support=at('oxyphil-cells')||at('glia');
    integratedEnvelope(at('capsule'),pineal?[[-.25,-.42],[-.40,-.16],[-.34,.20],[-.11,.43],[.13,.49],[.37,.22],[.39,-.11],[.18,-.36]]:[[-.39,-.27],[-.45,.02],[-.29,.32],[.07,.38],[.38,.23],[.43,-.07],[.19,-.35],[-.16,-.38]],.20,0xc5adad);
    for(let y=0;y<7;y++)for(let x=0;x<7;x++){const left=-.35+x*.10,bottom=-.35+y*.10,cx=left+.05,cy=bottom+.05;if((cx/.34)**2+(cy/.36)**2>1.02)continue;const other=x>=5||pineal&&(x+y)%5===0,parent=other?support:cells;cellTile(parent,left,left+.10,bottom,bottom+.10,.065,other?(pineal?0x9b8eae:0xc89396):0xbf899c);ball(parent,[cx,cy,.083],[.019,.025,.008],0x6b507a)}
    line(at('capillaries')||at('vessels'),[[-.32,-.12,.072],[-.13,-.07,.077],[.12,-.16,.075],[.34,-.08,.072]],.012,0xa5384b);
    line(at('septa'),[[0,-.34,.067],[.05,-.06,.064],[-.02,.35,.067]],.012);
    cloud(at('fat'),[.20,-.25,-.04],8,.055);
  }
  function addNose(){
    box(at('septum'),[-.28,0,-.05],[.06,.82,.47]);
    for(let i=0;i<3;i++)line(at('conchae'),[[.25,-.24+i*.23,-.18],[.07,-.21+i*.23,.09],[.25,-.17+i*.23,.22]],.055);
    organicPatch(at('respiratory-mucosa'),[[.24,-.38],[.32,-.35],[.37,-.08],[.32,.20],[.21,.39],[.18,.29],[.25,.10],[.28,-.10]],.35,[0,0,-.22]);
    ball(at('olfactory-area'),[.1,.38,-.09],[.23,.04,.16],0xab9dc7);
    box(at('palate'),[0,-.45,-.03],[.7,.055,.5]);
  }
  function addLarynx(){
    const cricoid=ring(at('cricoid'),.27,.21,.13,[0,-.35,0],undefined,0,Math.PI*2);cricoid.rotation.x=Math.PI/2;cricoid.position.set(0,-.35+.13/2,0);
    organicPatch(at('thyroid-cartilage'),[[-.31,.25],[-.18,.22],[-.11,.15],[0,.18],[.11,.15],[.18,.22],[.31,.25],[.29,-.21],[.11,-.28],[0,-.30],[-.11,-.28],[-.29,-.21]],.12,[0,0,-.21],undefined,.010);
    organicPatch(at('epiglottis'),[[0,-.20],[-.04,-.10],[-.11,.06],[-.10,.21],[0,.25],[.10,.21],[.11,.06],[.04,-.10]],.042,[0,.40,-.15],undefined,.005);
    for(const x of [-.095,.095])ball(at('vocal-folds'),[x,.03,.05],[.042,.18,.04],0xe6d5b9);
    ball(at('glottis'),[0,.03,-.006],[.04,.17,.006],0x455863);
    const mucosa=ring(at('laryngeal-mucosa'),.19,.176,.46,[0,-.13,-.08],0xcb8d90);mucosa.rotation.x=Math.PI/2;mucosa.position.set(0,-.13+.46/2,-.08);
  }
  function addMouth(){
    ball(at('tongue'),[-.20,-.12,0],[.28,.11,.23]);box(at('hard-palate'),[-.2,.22,-.1],[.56,.045,.4]);
    const d=[.44,0,.01];ball(at('dentin'),d,[.11,.28,.1],0xd8bd81);ball(at('enamel'),[d[0],.18,d[2]],[.13,.14,.12],0xf1e9d8);
    ball(at('pulp'),[d[0],-.04,.11],[.033,.19,.019],0xbe6875);
    line(at('oral-mucosa'),[[-.46,-.25,.16],[-.2,-.28,.2],[.08,-.23,.15]],.034);
  }
  function addCoil(){
    for(const [partId,range,y] of [['head',3,.3],['body',6,0],['tail',3,-.3]]){
      const points=[];for(let i=0;i<=range*24;i++){const a=i/24*Math.PI*2;points.push([.17*Math.cos(a),y+.13*(i/(range*24)-.5),.09*Math.sin(a)])}line(at(partId),points,.027);
    }
    ring(at('epithelium'),.135,.095,.20,[.46,.03,0]);ring(at('muscle'),.17,.139,.25,[.46,.03,-.025]);
  }
  function addFoldedSac(){
    ring(at('muscle'),.41,.35,.42);ring(at('adventitia'),.45,.413,.39,[0,0,-.045]);
    for(let i=0;i<10;i++){const x=-.27+i*.06;line(at('folded-mucosa'),[[x,-.22,.15],[x+.03,-.1,.28],[x-.018,.08,.2],[x+.024,.24,.13]],.022);}
    ring(at('secretory-epithelium'),.30,.287,.29,[0,0,.08]);line(at('excretory-duct'),[[0,-.38,-.03],[.04,-.56,-.02],[.30,-.61,-.01]],.045);
  }
  function addFimbriae(){
    line(at('ampulla'),[[-.4,.05,0],[-.1,.14,0],[.2,.08,0]],.095);line(at('isthmus'),[[.2,.08,0],[.39,0,0],[.56,-.05,0]],.046);
    for(let i=0;i<7;i++){const a=Math.PI*2*i/7;line(at('fimbriae'),[[-.4,.05,0],[-.52,.05+.1*Math.cos(a),.1*Math.sin(a)],[-.68,.05+.19*Math.cos(a),.14*Math.sin(a)]],.023)}
    ring(at('muscle'),.17,.145,.24,[.18,-.35,0]);ring(at('ciliated-mucosa'),.138,.11,.27,[.18,-.35,.03]);
  }
  function addPlacenta(){
    ball(at('chorionic-plate'),[0,.28,0],[.44,.035,.32],0xdba3a5);
    ball(at('basal-plate'),[0,-.27,0],[.46,.055,.34]);
    box(at('intervillous-space'),[0,0,-.22],[.88,.42,.025],0x7f3447);
    for(let i=0;i<7;i++){const x=-.31+i*.1;line(at('villi'),[[x,.24,0],[x+.024,0,.015],[x-.016,-.19,.03]],.025);line(at('fetal-vessels'),[[x,.23,.03],[x+.017,.03,.052],[x-.01,-.16,.052]],.009,0x9f779f);for(let j=0;j<3;j++)ball(at('villi'),[x+.05*Math.sin(j),.13-j*.12,.01],[.04,.08,.025])}
    // Three separate cord vessels: two arteries and one vein.
    for(const [x,z,color,r] of [[-.055,0,0x547fa8,.018],[.055,0,0x547fa8,.018],[0,.045,0xa9485d,.029]])line(at('umbilical-cord'),[[x,.32,z],[x+.03,.5,z],[x+.08,.66,z]],r,color);
  }
  function addTonsil(){
    ball(at('interfollicular'),[0,0,-.1],[.43,.4,.12],0xa481a6);
    organicPatch(at('epithelium'),[[-.43,.32],[-.35,.39],[-.20,.40],[0,.43],[.20,.40],[.35,.39],[.43,.32],[.39,.29],[.19,.35],[0,.37],[-.19,.35],[-.39,.29]],.22,[0,0,0],0xca92ae,.003);
    for(let i=0;i<3;i++)line(at('crypts'),[[-.25+i*.25,.36,.04],[-.26+i*.25,.17,.06],[-.21+i*.25,-.13,.05]],.038,0x775976);
    for(let i=0;i<7;i++){const a=i*2.39996,q=.29*Math.sqrt((i+.5)/7);ball(at('lymphoid-follicles'),[q*Math.cos(a),q*Math.sin(a),.05],[.09,.09,.06],0x785d97);ball(at('lymphoid-follicles'),[q*Math.cos(a),q*Math.sin(a),.10],[.04,.04,.018],0xc2a5c7)}
    ring(at('partial-capsule'),.44,.417,.12,[0,0,-.13],undefined,Math.PI,Math.PI*2);
  }
  function addJoint(){
    for(const y of [-.27,.27]){ball(at('bone-ends'),[0,y,-.04],[.29,.20,.20]);ball(at('articular-cartilage'),[0,y<0?-.095:.095,.055],[.28,.024,.19]);}
    box(at('synovial-cavity'),[0,0,-.09],[.4,.12,.022],0x6296a5);
    for(const x of [-.31,.31]){line(at('synovial-membrane'),[[x,-.2,-.01],[x,0,.02],[x,.2,-.01]],.026);line(at('fibrous-capsule'),[[x*1.14,-.29,0],[x*1.18,0,.01],[x*1.14,.29,0]],.029)}
    box(at('ligament'),[.46,0,-.05],[.085,.52,.065]);
  }
  function addNerve(){
    ring(at('epineurium'),.43,.397,.55,[0,0,-.075]);
    for(const [x,y] of [[-.17,-.1],[.16,-.1],[0,.20]]){
      ring(at('perineurium'),.145,.133,.60,[x,y,-.025],0xd9c6a9,0,Math.PI*2);
      disc(at('endoneurium'),[x,y,-.20],[.129,.014,.129]);
      for(let j=0;j<8;j++){const a=j*2.39996,r=.095*Math.sqrt((j+.5)/8);const pos=[x+r*Math.cos(a),y+r*Math.sin(a),.06];ring(at('myelin'),.025,.013,.57,pos,0xc8be91,0,Math.PI*2);disc(at('axons'),pos,[.012,.59,.012],0x9679b0)}
    }
  }
  function addVessels(){
    ring(at('intima'),.147,.13,.48,[-.35,.05,.055],0xd5aa9b);ring(at('arterial-media'),.226,.15,.53,[-.35,.05,.01]);ring(at('adventitia'),.26,.23,.50,[-.35,.05,-.025]);
    ring(at('intima'),.20,.182,.48,[.30,.05,.05],0xd5aa9b);ring(at('venous-wall'),.236,.203,.53,[.30,.05,.01],0x637d9b);ring(at('adventitia'),.262,.239,.5,[.30,.05,-.025]);
    for(const x of [.23,.37])ball(at('venous-valves'),[x,.05,.01],[.08,.13,.018],0xc5b9a6);
    ring(at('capillary-endothelium'),.055,.043,.41,[0,-.36,.0],0xc9808d,0,Math.PI*2);
  }
  function addLymphatic(){
    ring(at('collecting-wall'),.20,.15,.63,[.22,0,0],0x7da990);ring(at('smooth-muscle'),.226,.203,.58,[.22,0,-.04],0xad8783);
    for(const x of [.15,.29])ball(at('valves'),[x,0,.04],[.08,.11,.024],0xe0d4ad);
    line(at('blind-capillary'),[[-.38,-.3,0],[-.34,-.03,0],[-.39,.24,0]],.065,0x85b59f);ball(at('blind-capillary'),[-.38,-.3,0],[.065,.065,.065],0x85b59f);
    for(let i=0;i<4;i++)ball(at('endothelial-flaps'),[-.31,-.20+i*.13,.03],[.018,.075,.042],0xc9cfad);
  }
  function addDiaphragm(){
    const parent=at('muscle');integratedEnvelope(parent,[[-.53,-.25],[-.58,.04],[-.40,.30],[0,.41],[.40,.30],[.58,.04],[.53,-.25],[.28,-.37],[0,-.30],[-.28,-.37]],.075,0x9a505b);for(let i=0;i<22;i++){const a=Math.PI*2*i/22,points=[[.18*Math.cos(a),.14*Math.sin(a)],[.3*Math.cos(a),.27*Math.sin(a)],[.51*Math.cos(a),.34*Math.sin(a)]].map(([x,y])=>[x,y,.107-.20*((x/.65)**2+(y/.50)**2)]);line(parent,points,.008,0xb9767d);}
    ball(at('central-tendon'),[.02,0,.11],[.22,.15,.02],0xdfd2b1);
    for(const [pid,pos] of [['caval-opening',[-.07,.05,.14]],['esophageal-hiatus',[.10,-.16,.05]],['aortic-hiatus',[0,-.34,-.08]]])ring(at(pid),.042,.028,.012,pos,0xdbb394,0,Math.PI*2);
  }
  function addAciniHistology(){
    const cells=at('serous-cells')||at('secretory-cells');cellsAround(cells,[-.2,.05,.0],10,.21,.055,0xbd829b);
    if(at('mucous-cells'))cellsAround(at('mucous-cells'),[.30,.05,.0],8,.18,.064,0xd1b8c4);
    disc(at('lumen')||at('milk-lumen'),[-.2,.05,-.035],[.11,.012,.11],0xe4cdb4);
    ring(at('basal-lamina'),.285,.270,.07,[-.2,.05,-.05],0xcdc3a9,0,Math.PI*2);
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5;line(at('myoepithelial'),[[-.2+.28*Math.cos(a),.05+.28*Math.sin(a),-.045],[-.2+.25*Math.cos(a+.4),.05+.25*Math.sin(a+.4),-.005]],.015,0xad667d)}
    ring(at('duct'),.1,.055,.32,[.40,-.27,.02],0xba91ad,0,Math.PI*2);line(at('capillaries'),[[-.53,-.28,-.08],[-.2,-.31,-.05],[.13,-.28,-.07],[.28,-.39,-.1]],.017,0xa94160);
  }
  function addVillusHistology(){
    ring(at('syncytiotrophoblast'),.285,.255,.58,[0,0,0],0xb7849f);
    disc(at('stroma'),[0,0,-.22],[.252,.035,.252],0xd2b0be);
    ring(at('fetal-capillary'),.078,.060,.46,[.06,.02,.02],0xab5c88,0,Math.PI*2);
    for(let i=0;i<9;i++){const a=i*2.39996;ball(at('syncytiotrophoblast'),[.27*Math.cos(a),.27*Math.sin(a),.15*Math.sin(i)],[.016,.024,.016],0x66466e)}
    for(let i=0;i<8;i++){const a=i*Math.PI/4;disc(at('maternal-space'),[.43*Math.cos(a),.43*Math.sin(a),.06],[.04,.013,.04],0xaa405a)}
  }
  function addEndocrineHistology(){
    for(let y=0;y<5;y++)for(let x=0;x<8;x++){const left=-.4+x*.10,bottom=-.24+y*.105,right=left+.10,top=bottom+.105,parent=x<5?(at('pinealocytes')||at('chief-cells')):(at('glia')||at('oxyphil-cells'));cellTile(parent,left,right,bottom,top,.032,x<5?0xc49bac:0xb486a5);ball(parent,[(left+right)/2,(bottom+top)/2,.049],[.018,.025,.008],0x725581)}
    line(at('capillary')||at('capillaries'),[[-.36,-.25,.02],[-.03,-.18,.01],[.2,-.27,.01],[.4,-.19,0]],.025,0xad526c);
    box(at('stroma')||at('capsule'),[0,0,-.08],[.87,.69,.025],0xd2bbad);cloud(at('fat'),[.3,-.22,.015],6,.055);
  }
  function addEpithelium(){
    const principal=at('principal-cells')||at('secretory-epithelium')||at('ciliated-cells');
    for(let i=0;i<11;i++){const left=-.45+i*.082,right=left+.082,top=.15+.012*Math.sin(i*.7),bottom=-.15+.004*Math.cos(i),secretory=at('secretory-cells')&&i%4===2,parent=secretory?at('secretory-cells'):principal;cellTile(parent,left,right,bottom,top,.054,secretory?0xd6a4b3:0xd5a0bb);ball(parent,[(left+right)/2,-.037+.037*Math.sin(i*1.9),.068],[.023,.036,.009],0x695180)}
    for(let i=0;i<4;i++)ball(at('basal-cells'),[-.33+i*.21,-.14,.015],[.034,.04,.045],0x967dae);
    const projections=at('stereocilia')||at('cilia');for(let i=0;i<30;i++){const x=-.42+i*.029;line(projections,[[x,.16,.015],[x+.009,.21,.02],[x+.012,.26,.025]],.0045,0xc7b49b)}
    box(at('basal-lamina')||at('lamina-propria'),[0,-.19,-.02],[.9,.055,.15],0xd0b69d);
    if(at('folds'))for(let i=0;i<5;i++)line(at('folds'),[[-.4+i*.18,-.15,-.10],[-.35+i*.18,-.02,-.11],[-.42+i*.18,.13,-.10]],.018);
    if(at('smooth-muscle'))for(let i=0;i<5;i++)ball(at('smooth-muscle'),[-.32+i*.16,-.30,-.04],[.11,.026,.034]);
  }
  const shapes={tube:addTube,gland:addGland,'endocrine-gland':addEndocrine,nose:addNose,larynx:addLarynx,mouth:addMouth,'coiled-tube':addCoil,'folded-sac':addFoldedSac,'tube-fimbriae':addFimbriae,placenta:addPlacenta,tonsil:addTonsil,joint:addJoint,nerve:addNerve,vessels:addVessels,lymphatic:addLymphatic,diaphragm:addDiaphragm,acini:addAciniHistology,villus:addVillusHistology,endocrine:addEndocrineHistology,epithelium:addEpithelium,lymphoid:addTonsil,vascular:id==='lymphatic-wall'?addLymphatic:addVessels};
  const build=shapes[definition.shape];if(!build)throw Error('Forma não disponível: '+definition.shape);build();
  // Every original part is explicit, including schematic spaces selected by list.
  for(const part of parts)if(!part.object.children.length)throw Error('Parte sem geometria: '+id+'/'+part.id);
  const upgradedSources=new Set();
  if(histology){group.traverse(o=>{if(o.isMesh)upgradedSources.add(o.geometry)});upgradeHistologyGeometry(group,options)}
  // Merge only within one selectable part and one material; keep every vertex
  // and its local transform, while avoiding a draw call for each cell/fibre.
  const originalGeometry=new Set();let meshesBefore=0;
  for(const part of parts){
    const byMaterial=new Map();for(const child of [...part.object.children])if(child.isMesh){meshesBefore++;originalGeometry.add(child.geometry);const list=byMaterial.get(child.material)||[];list.push(child);byMaterial.set(child.material,list)}
    for(const [mat,list]of byMaterial){
      if(list.length<2)continue;
      const attributeNames=Object.keys(list[0].geometry.attributes);if(list.some(m=>Object.keys(m.geometry.attributes).join(',')!==attributeNames.join(',')))continue;
      const vertexTotal=list.reduce((n,m)=>n+m.geometry.attributes.position.count,0),indexTotal=list.reduce((n,m)=>n+(m.geometry.index?.count||m.geometry.attributes.position.count),0);
      const buffers=Object.fromEntries(attributeNames.map(name=>[name,new Float32Array(vertexTotal*list[0].geometry.attributes[name].itemSize)]));
      const indices=new (vertexTotal>65535?Uint32Array:Uint16Array)(indexTotal);let vertexOffset=0,indexOffset=0;
      for(const m of list){m.updateMatrix();const transformed=m.geometry.clone().applyMatrix4(m.matrix),count=transformed.attributes.position.count;for(const name of attributeNames){const a=transformed.attributes[name];buffers[name].set(a.array,vertexOffset*a.itemSize)}const sourceIndex=transformed.index;for(let i=0;i<(sourceIndex?.count||count);i++)indices[indexOffset++]=vertexOffset+(sourceIndex?sourceIndex.getX(i):i);vertexOffset+=count;transformed.dispose();part.object.remove(m)}
      const merged=new THREE.BufferGeometry();for(const name of attributeNames)merged.setAttribute(name,new THREE.BufferAttribute(buffers[name],list[0].geometry.attributes[name].itemSize));merged.setIndex(new THREE.BufferAttribute(indices,1));merged.computeBoundingBox();merged.computeBoundingSphere();mesh(part.object,merged);
      // Preserve the existing material, including the nucleus contrast.
      part.object.children.at(-1).material=mat;
    }
  }
  const retainedGeometry=new Set();let meshesAfter=0;group.traverse(o=>{if(o.isMesh){meshesAfter++;retainedGeometry.add(o.geometry)}});for(const g of originalGeometry)if(!retainedGeometry.has(g))g.dispose();geometries.clear();
  for(const g of upgradedSources)if(!retainedGeometry.has(g))g.dispose();
  group.updateMatrixWorld(true);let disposed=false;
  return {group,parts,stats:{meshesBefore,meshesAfter},title:definition.label||definition.title,description:definition.description,bounds:new THREE.Box3().setFromObject(group),limits:definition.representation||'Modelo didático em ampliação. Quantidades, cores e proporções ilustrativas; não representa uma lâmina real.',orientation:'Frente do modelo; posições e escalas de ampliações didáticas.',dispose(){if(disposed)return;disposed=true;const allGeometry=new Set();group.traverse(o=>{if(o.isMesh)allGeometry.add(o.geometry)});allGeometry.forEach(g=>{g.disposeBoundsTree?.();g.dispose()});materials.forEach(m=>m.dispose());group.clear()}};
}
