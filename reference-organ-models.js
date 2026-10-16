import * as THREE from 'three';
import {translatedName,normalise,familyInfo} from './anatomy-info.js';

// Imported anatomical meshes only. Microscopical functional diagrams stay in
// their own view; no new mesh is invented for an unavailable anatomical part.
const SOURCE_RULES={
  'stomach':['visceral',/^Stomach$/i], 'gallbladder':['visceral',/^Gallbladder$/i],
  'esophagus':['visceral',/^(Oesophagus|Esophagus)$/i],
  'thyroid':['visceral',/^Thyroid gland$/i], 'adrenal':['visceral',/^Suprarenal gland\.l$/i],
  'pituitary':['visceral',/^(Adenohypophysis|Neurohypophysis)$/i],
  'testis':['visceral',/^Testis\.l$/i], 'penis':['visceral',/penis|penile|corpus cavernosum|corpus spongiosum|glans/i],
  'skeletal-muscle':['muscular',/^(Long|Short) head of biceps brachii\.l$/i],
  'bone':['skeletal',/^Femur\.l$/i], 'nasal-cavity':['visceral',/nasal cavity|nasal septum|nasal concha/i],
  'urethra':['visceral',/urethra/i], 'salivary-gland':['visceral',/parotid gland\.l$|submandibular gland\.l$|sublingual gland\.l$/i],
  'parathyroid':['visceral',/^Superior parathyroid gland\.l$/i],
  'pineal':['visceral',/^Pineal gland$/i], 'epididymis':['visceral',/^Epididymis\.l$/i],
  'vas-deferens':['visceral',/^(Ductus deferens|Deferent duct)\.l$/i],
  'seminal-vesicle':['visceral',/^Seminal gland\.l$/i],
  'peripheral-nerve':['nervous',/^Sciatic nerve\.l$/i],
  'blood-vessel':['cardiovascular',/^Ascending aorta$/i],
  'diaphragm':['muscular',/^Diaphragm$/i],
  'ear':['nervous',/^(Tympanic membrane|Cochlea|Vestibule|Auditory tube|Cochlear nerve|Vestibular nerve)\.l$/i]
};
function ptReferenceLabel(label){return /^(retina|fóvea|mácula|conjuntiva|córnea|íris|esclera|artéria|veia|glândula|região|área|camada|cabeça|cauda|porção)\b/i.test(label)?label.replace(/\((esquerd|direit)o\)/g,'($1a)'):label}
export function hasReferenceOrgan(id,catalog){return !!catalog?.organs?.some(o=>o.id===id)||!!SOURCE_RULES[id]}

export async function createReferenceOrganModel(definition,{loader,catalog,lexicon={},sourceGroups={},partFunctions={parts:[]}}){
  const reference=catalog?.organs?.find(o=>o.id===definition.id),rule=SOURCE_RULES[definition.id];
  if(!reference&&!rule)return null;
  const sourceSystem=rule?.[0],sourceFile=reference?.file||`models/${sourceSystem==='female'?'female-reproductive':sourceSystem}.glb`;
  let source;const fromLoadedLayer=!reference&&!!sourceGroups[sourceSystem];
  // Read the loaded layer without reparenting it. Clone each selected mesh
  // below so material references in userData never undergo JSON serialization.
  if(fromLoadedLayer)source=sourceGroups[sourceSystem];
  else {const gltf=await loader.loadAsync(new URL('./'+sourceFile,import.meta.url).href);source=gltf.scene;
    source.traverse(o=>{const nodeIndex=gltf.parser.associations.get(o)?.nodes;if(nodeIndex!=null)o.userData.sourceNodeName=gltf.parser.json.nodes[nodeIndex]?.name||o.name});}
  source.updateMatrixWorld(true);const chosen=[];
  source.traverse(mesh=>{if(!mesh.isMesh)return;const raw=mesh.userData.za_name||(fromLoadedLayer?mesh.userData.atlasName:null)||mesh.userData.sourceNodeName||mesh.parent?.userData.za_name||mesh.parent?.userData.sourceNodeName||mesh.name;
    if(reference||rule[1].test(raw))chosen.push({mesh,raw});});
  if(!chosen.length){if(!fromLoadedLayer)disposeMeshes(source);return null}
  const group=new THREE.Group(),surface=new THREE.Group();group.add(surface);group.name=definition.label;
  const parts=[],represented=new Set();
  for(const {mesh,raw} of chosen){const clone=mesh.clone(false);clone.geometry=mesh.geometry.clone();const baseMaterial=fromLoadedLayer?(mesh.userData.originalMaterial||mesh.material):mesh.material;clone.material=Array.isArray(baseMaterial)?baseMaterial.map(m=>m.clone()):baseMaterial.clone();
    clone.matrix.copy(mesh.matrixWorld);clone.matrix.decompose(clone.position,clone.quaternion,clone.scale);clone.visible=true;clone.matrixAutoUpdate=true;clone.matrixWorldAutoUpdate=true;
    clone.userData={...mesh.userData,originalMaterial:clone.material,organ:definition.id,system:definition.system,name:raw};surface.add(clone);
    const sourceLabel=ptReferenceLabel(reference?.nameDictionary?.[raw]?.pt||translatedName(raw,lexicon));
    const organFunctions=(partFunctions.parts||[]).filter(p=>p.organId===definition.id);
    const functionInfo=organFunctions.find(p=>p.sourceName===raw)||organFunctions.find(p=>normalise(p.sourceLabel)===normalise(reference?.nameDictionary?.[raw]?.sourceLabel||raw));
    const info=(definition.internalParts||[]).find(p=>p.id===functionInfo?.contentPartId||normalise(p.label)===normalise(sourceLabel));
    if(info)represented.add(info.id);const fallback=reference?{
      name:sourceLabel,isFamily:true,function:'Integra a organização anatômica de '+definition.label.toLowerCase()+'. A função individual desta subdivisão ainda não recebeu uma descrição específica revisada neste acervo.',
      mechanism:definition.description,uerj:'Relacione a estrutura identificada ao funcionamento do órgão completo; use as entradas funcionais revisadas abaixo para os mecanismos específicos.',
      commonMistake:'Não atribua uma função exclusiva a uma subdivisão somente por sua forma, cor ou posição no modelo.'
    }:familyInfo(raw,sourceSystem||definition.system);
    parts.push({...fallback,...info,...functionInfo,isFamily:!info&&!functionInfo,id:'ref-'+parts.length,contentPartId:info?.id||null,label:functionInfo?.identificationConflict?(functionInfo.label||functionInfo.pt):sourceLabel,object:clone,geometryIdentified:true,
      sourceName:raw,sourceIds:[...new Set([reference?'hra-reference':'z-anatomy-reference',...(info?.sourceIds||[]),...(functionInfo?.sourceIds||[])])],sourceAppearance:'anatomical-reference'});
  }
  // Dispose the temporary source; cloned geometry/materials are independent.
  if(!fromLoadedLayer)disposeMeshes(source);
  surface.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(surface),center=bounds.getCenter(new THREE.Vector3()),extent=bounds.getSize(new THREE.Vector3());
  const scale=.22/Math.max(extent.x,extent.y,extent.z);surface.scale.multiplyScalar(scale);surface.position.sub(center.multiplyScalar(scale));
  for(const info of definition.internalParts||[]){if(represented.has(info.id))continue;const object=new THREE.Group();group.add(object);parts.push({...info,object,geometryIdentified:false})}
  let triangles=0;surface.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3});
  return {id:definition.id,title:definition.label+(definition.id==='ear'?' · componentes anatômicos':' · modelo anatômico'),description:'Geometria anatômica de referência. Selecione uma peça identificada para explorar sua forma e função; use o esquema funcional para os componentes sem geometria individual disponível.',group,parts,anatomicalReference:true,
    citation:reference?.citation||'Z-Anatomy / Open3DModel anatomical collection',sourceUrl:reference?.primarySource||'https://www.z-anatomy.com/',license:reference?.license||{id:'CC-BY-NC-SA-4.0',url:'https://creativecommons.org/licenses/by-nc-sa/4.0/'},
    limits:reference?.limitations||(definition.id==='ear'?'Esta vista reúne componentes da orelha média e interna e seus nervos. Não representa a orelha inteira, não contém os ossículos nem identifica células do órgão de Corti. As funções desses componentes permanecem disponíveis no esquema funcional. ': '')+'Modelo anatômico de referência extraído do acervo corporal. O arquivo não contém texturas fotográficas de 4K nem todos os componentes microscópicos internos. Entradas sem geometria própria apresentam sua função sem acrescentar formas artificiais.',
    defaultClip:['heart','kidney','eye','brain','bladder','uterus','prostate','bone','synovial-joint','mouth'].includes(definition.id)?'coronal':'none',
    stats:{meshes:chosen.length,triangles,texturePixels:null,representation:'licensed-anatomical-model',source:reference?'HRA':'Z-Anatomy'},
    dispose(){disposeMeshes(group)}};
}
function disposeMeshes(root){const geometry=new Set(),materials=new Set();root.traverse(o=>{if(o.isMesh){geometry.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m)}});geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose())}
