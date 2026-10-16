import * as THREE from 'three';

// The anatomy comes from the licensed Dundee asset. This module only loads,
// positions and annotates it; it does not manufacture anatomical geometry.
export async function createHeartModel(definition,{loader}={}){
  const gltf=await loader.loadAsync(new URL('./models/heart-dundee.glb',import.meta.url).href);
  const group=new THREE.Group();group.name='Coração anatômico · Universidade de Dundee';
  const surface=gltf.scene;surface.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(surface),center=bounds.getCenter(new THREE.Vector3());
  const scale=.22/bounds.getSize(new THREE.Vector3()).y;
  const normalized=coordinates=>new THREE.Vector3(...coordinates).sub(center).multiplyScalar(scale);
  surface.scale.multiplyScalar(scale);surface.position.copy(center).multiplyScalar(-scale);group.add(surface);
  surface.traverse(mesh=>{if(mesh.isMesh){mesh.material.userData.preserveSourceAppearance=true;mesh.userData.preserveSourceAppearance=true}});
  const parts=[{id:'source-heart',label:'Coração · vista geral',object:surface,
    function:'Impulsionar o sangue nas circulações pulmonar e sistêmica.',
    mechanism:'As paredes dos ventrículos geram pressão; as valvas mantêm o fluxo em sentido único.',
    uerj:'Explicar o trajeto do sangue, as diferenças de pressão e o papel das valvas.',
    commonMistake:'Confundir o sangue que percorre as cavidades com o sangue que irriga o músculo cardíaco pelas artérias coronárias.',
    sourceIds:['dundee-heart'],geometryIdentified:true}];
  const annotationResponse=await fetch(new URL('./data/heart-annotations.json',import.meta.url));
  if(!annotationResponse.ok)throw new Error('Não foi possível abrir as marcações anatômicas do coração.');
  const annotations=await annotationResponse.json(),mapped=new Set();
  const binding={Aorta:'aorta','Tronco pulmonar':'pulmonary_trunk','Veia cava superior':'venae_cavae','Veia cava inferior':'venae_cavae','Átrio direito':'right_atrium','Átrio esquerdo':'left_atrium','Ventrículo direito':'right_ventricle','Ventrículo esquerdo':'left_ventricle','Valva tricúspide':'tricuspid_valve','Valva pulmonar':'pulmonary_valve','Valva mitral (bicúspide)':'mitral_valve'};
  const pinGeometry=new THREE.SphereGeometry(.00115,12,8),pinMaterial=new THREE.MeshBasicMaterial({color:0x9af5db,depthTest:false,transparent:true,opacity:.95});
  pinMaterial.userData.preserveSourceAppearance=true;
  for(const annotation of annotations.annotations){
    // The source provides two unsided chordal markers. Their positions or
    // cameras cannot establish a reviewed correspondence to either AV valve.
    // In particular, the authored cut's chordae_tendineae ID now identifies
    // tricuspid chordae; neither generic source marker may inherit that ID.
    const unsidedChordae=annotation.label.startsWith('Cordas tendíneas');
    const partId=binding[annotation.label];
    const info=partId?(definition.internalParts||[]).find(p=>p.partId===partId)||{}:{};if(info.id)mapped.add(info.id);
    const object=new THREE.Mesh(pinGeometry,pinMaterial);object.position.copy(normalized(annotation.positionGLB));object.renderOrder=10;object.userData.educationalMarker=true;group.add(object);
    const fallback=unsidedChordae?{
      function:'Transmitir tensão dos músculos papilares às cúspides das valvas atrioventriculares, limitando sua eversão durante a sístole ventricular.',
      mechanism:'As cordas tendíneas integram o aparelho de suporte das valvas tricúspide e mitral. Não existem cordas nas valvas semilunares.',
      uerj:'Relacionar cordas tendíneas, músculos papilares e prevenção do refluxo atrioventricular.',
      commonMistake:'Este marcador da fonte não possui correspondência lateral revisada: não identifica especificamente cordas da tricúspide ou da mitral. A posição da marcação não comprova essa associação.'
    }:annotation.label.startsWith('Músculo papilar')?{
      function:'Tensionar as cordas tendíneas durante a contração ventricular, evitando o prolapso dos folhetos atrioventriculares.',mechanism:'A contração dos músculos papilares acompanha a sístole ventricular e estabiliza o aparelho valvar.',uerj:'Relacionar músculo papilar, corda tendínea e prevenção do refluxo.',commonMistake:'Músculos papilares não abrem as valvas: a abertura depende do gradiente de pressão.'
    }:annotation.label.startsWith('Trabécula')?{
      function:'Feixe muscular do ventrículo direito que participa da condução da excitação ao músculo papilar anterior.',mechanism:'A trabécula septomarginal contém fibras do ramo direito do feixe atrioventricular.',uerj:'Associar coordenação da contração à condução elétrica cardíaca.',commonMistake:'A banda moderadora não é uma valva nem uma corda tendínea.'
    }:{};
    parts.push({...fallback,...info,id:'landmark-'+annotation.order,label:annotation.label,object,geometryIdentified:true,annotationOnly:true,
      anatomicalPosition:object.position.clone(),annotationCamera:{eye:normalized(annotation.eyeGLB),target:normalized(annotation.targetGLB)},
      sourceIds:['dundee-heart']});
  }
  // Conduction tissue and other unsegmented structures remain content entries.
  for(const info of definition.internalParts||[]){if(mapped.has(info.id))continue;const object=new THREE.Group();group.add(object);parts.push({...info,object,geometryIdentified:false});}
  let triangles=0,meshes=0;surface.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3}});
  const ownedMaterials=new Set(),ownedGeometries=new Set(),ownedTextures=new Set();surface.traverse(o=>{if(o.isMesh){ownedGeometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){ownedMaterials.add(m);for(const v of Object.values(m))if(v?.isTexture)ownedTextures.add(v)}}});
  return {id:'heart',title:'Coração · anatomia interna detalhada',group,parts,preserveMaterials:true,
    description:'Modelo anatômico da Universidade de Dundee: cavidades abertas, relevo das paredes e aparelho valvar em uma superfície contínua. Selecione os pontos verdes ou os nomes para explorar cada estrutura. A opção Peças anatômicas permite selecionar superfícies separadas.',
    limits:'Reconstrução anatômica universitária baseada parcialmente no BodyParts3D; não é fotogrametria de um espécime confirmado. Texturas de 2048 × 2048 pixels e exportação de imagem em 3840 × 2160. Os pontos verdes são marcadores educativos, nas posições fornecidas pelo autor; não representam o formato das estruturas e não permitem separá-las da superfície. Componentes sem marcação verificada continuam disponíveis como conteúdo funcional.',
    stats:{meshes,triangles,texturePixels:2048,markers:annotations.annotations.length,representation:'licensed-anatomical-model'},
    anatomicalReference:true,citation:'Universidade de Dundee, CAHID · Interior heart – high detail; baseado parcialmente no BodyParts3D, © Database Center for Life Science. Modelo e marcações: CC BY-SA 4.0.',sourceUrl:annotations.originalURL,license:{id:'CC-BY-SA-4.0',url:annotations.licenseURL},
    dispose(){ownedGeometries.forEach(g=>g.dispose());ownedMaterials.forEach(m=>m.dispose());ownedTextures.forEach(t=>t.dispose());pinGeometry.dispose();pinMaterial.dispose()}};
}
