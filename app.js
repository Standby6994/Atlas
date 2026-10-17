import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {MODEL_SYSTEMS, FEMALE_SYSTEMS, isFemaleSystem, bodySystem, normalise, translatedName, familyInfo} from './anatomy-info.js';
import {resolveCore, getCoreMeshNames} from './core-mapping.js';
import {computeSimulation} from './simulation-engine.js';
import {createSmartSearch} from './smart-search.js';
import {preparePickingMesh,refreshPickCandidates,raycastVisible,deferPickingIndex} from './picking-index.js';
import {studySelectionContext,equivalentStudyPart} from './study-selection.js';
import {highlightSelectedMaterial,SELECTION_COLOR,selectionFade} from './selection-highlight.js';
import {createLearningDetails} from './learning-details.js';
import {createStudyConnections} from './study-connections.js';
import {chromosomeCounts,representationMagnification} from './cytology-tools.js';
import {createPracticeDraftStore,attachPracticeDraft,renderPracticeFeedback} from './practice-session.js';
import {resolveStudyEntry} from './study-entry-routes.js';
import {createStudySessionStore} from './study-session.js';
import * as tissueFinish from './tissue-materials.js';
import {setupTabletUI} from './tablet-ui.js';
import {createRenderBatches,BATCHED_LAYER} from './render-batches.js';
import {createAmbientOcclusion} from './ambient-occlusion.js';
import {createDrawBoard,mountBoardPanel} from './draw-board.js';
import {createProcessPlayer} from './process-animations.js';
import {createSystematicsView} from './systematics-view.js';
const {applyTissueFinish,copyTissueFinish,getTissueFinishStats}=tissueFinish;
const releaseTissueFinish=root=>tissueFinish.releaseTissueFinish?.(root);

const $=id=>document.getElementById(id);
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n).toLocaleString('pt-BR',{maximumFractionDigits:2});
// The registry counts its changes, so derived lists (core mesh names, part search) are rebuilt only when it changes.
class VersionedMap extends Map{version=0;set(k,v){this.version++;return super.set(k,v)}delete(k){this.version++;return super.delete(k)}clear(){this.version++;super.clear()}}
const state={view:'atlas',tab:'core',search:'',studySystem:'all',studyOrgan:null,cytologyCategory:'all',botanyCategory:'all',cytologyReturnMode:'body',layers:{skeletal:true,visceral:true,cardiovascular:false,nervous:false,lymphatic:false,muscular:false,joints:false,'female-skeletal':true,'female-visceral':true,female:true,'female-cardiovascular':false,'female-nervous':false,'female-lymphatic':false,'female-muscular':false,'female-joints':false,'female-skin':false},registry:new VersionedMap(),groups:{},loaded:new Set(),loading:new Map(),core:[],coreMap:new Map(),selected:null,selectedNames:new Set(),hidden:new Set(),isolated:null,opacity:1,mode:'body',clip:'none',simulation:null,questionIndex:0};
let physiology,simulations,atlasSystems,lexicon,contentSources,simulationSources,femaleMeta,femaleBody,studyContent,cytologyContent;
let referenceCatalog=null,referencePartFunctions={parts:[]};
let learningDetails,studyConnections,modelCoverage;
let botanyContent={views:[],categories:[],sources:[]},botanySearch;
let systematicsContent={groups:[],views:[],functions:[],sources:[],tree:null},systematicsView=null,systFunction=null,systGroupShown=null;
let studyTrail=[],activeArrival=null,connectionVersion=0,cytologyOrigin=null;
const practiceDrafts=createPracticeDraftStore(),studySessions=createStudySessionStore();
let sessionReady=false,currentConnectionData=null,currentOrganDetails=null,botanyRetry=null;
function rememberStudy(){if(!sessionReady)return;studySessions.save({...studySnapshot(),view:state.view,trail:studyTrail,cytologyOrigin,representation:state.mode.startsWith('internal-')?state.studyRepresentation:null,questionIndex:state.questionIndex,practiceSystem:$('practice-system')?.value||'all'})}
function interactionFocus(){const node=document.activeElement;if(!node||node===document.body||!node.closest('#structure-list,#detail-panel'))return null;return{node,id:node.id,part:node.dataset.part,key:node.dataset.key,core:node.dataset.core}}
function restoreInteractionFocus(saved){if(!saved||saved.node.isConnected||document.activeElement!==document.body)return;const target=saved.id&&$(saved.id)||[...document.querySelectorAll('[data-part],[data-key]')].find(n=>saved.part?n.dataset.part===saved.part:saved.key&&n.dataset.key===saved.key&&n.dataset.core===saved.core)||$('detail-panel').querySelector('h2');if(target){if(target.tagName==='H2')target.tabIndex=-1;target.focus({preventScroll:true})}}
state.studyRepresentation='reference';
const detailedInteriors={esophagus:{module:'./esophagus-interior-models.js',factory:'createEsophagusInterior'},'large-intestine':{module:'./large-intestine-interior-models.js',factory:'createLargeIntestineInterior'},stomach:{module:'./stomach-interior-models.js',factory:'createStomachInterior'},'small-intestine':{module:'./small-intestine-interior-models.js',factory:'createSmallIntestineInterior'},lungs:{module:'./pulmonary-interior-models.js',factory:'createPulmonaryInterior'},kidney:{module:'./renal-interior-models.js',factory:'createKidneyInterior'},heart:{module:'./heart-interior-model.js',factory:'createHeartInteriorModel'},ovary:{module:'./ovary-interior-model.js',factory:'createOvaryInteriorModel'},testis:{module:'./reproductive-interior-models.js',factory:'createTestisInteriorModel'},vagina:{module:'./reproductive-interior-models.js',factory:'createVaginaInteriorModel'}};
const organRepresentations=new Map();
let representationVersion=0;
const organSelectionContexts=new Map();
const histologicalCorrespondences={
  INTERNAL_heart_myocardium:{view:'cardiac-muscle',part:'cells'},
  INTERNAL_heart_papillary_right:{view:'cardiac-muscle',part:'cells'},
  INTERNAL_heart_papillary_left:{view:'cardiac-muscle',part:'cells'},
  INTERNAL_heart_trabeculae_right:{view:'cardiac-muscle',part:'cells'},
  INTERNAL_heart_trabeculae_left:{view:'cardiac-muscle',part:'cells'},
  INTERNAL_ovary_theca:{view:'ovarian-follicle',part:'theca'},
  INTERNAL_ovary_granulosa:{view:'ovarian-follicle',part:'granulosa'},
  INTERNAL_ovary_antrum:{view:'ovarian-follicle',part:'antrum'},
  INTERNAL_ovary_oocyte:{view:'ovarian-follicle',part:'oocyte'},
  INTERNAL_ovary_zona_pellucida:{view:'ovarian-follicle',part:'zona'}
};
const interiorSpec=mode=>mode.startsWith('internal-')?detailedInteriors[mode.slice(9)]:null;
const studyRepresentationFor=mode=>organRepresentations.get(mode)||(interiorSpec(mode)?'detailed':'reference');
function hasSelectableGeometry(object){let found=false;object?.traverse(mesh=>{if(mesh.isMesh&&mesh.geometry?.attributes.position?.count)found=true});return found}
let scene,camera,renderer,controls,loader,bodyGroup,femaleGroup,groundShadow,xrayGroup,renderBatches,bodyBounds,femaleBounds,femaleReady=false,frameRequested=false,tween=null,draco;
let resizeObserver,environmentHandle,tabletUI={active:false,showDetail(){},hideDetail(){},closeAll(){}};
const viewInset={x:0,y:0,target:{x:0,y:0}};
// Full resolution whenever the view is still; while it moves, the resolution adapts to hold 60 fps.
const renderQuality={rest:1.5,motion:1.5,moving:false,dragging:false,idle:0,last:0,sum:0,count:0,good:0,fps:0,tooSlow:new Set()};
const markerWorld=new THREE.Vector3(),markerProjected=new THREE.Vector3();
let markerSelectionKey=null;
const microModels=new Map();
const studyModels=new Map();
const isStudyMode=mode=>/^(internal-|histo-|cyto-|botany-|syst-)/.test(mode);
const isDetailMode=mode=>mode.startsWith('micro-')||isStudyMode(mode);
const studyOrgan=id=>studyContent?.organs?.find(o=>o.id===id);
const studyTissue=id=>studyContent?.histology?.find(o=>o.id===id);
const cytologyView=id=>cytologyContent?.views?.find(v=>v.id===id);
const cytologyCategory=id=>cytologyContent?.categories?.find(c=>c.id===id)?.name||'Citologia';
const botanyView=id=>botanyContent.views.find(v=>v.id===id);
const botanyCategory=id=>botanyContent.categories.find(c=>c.id===id)?.name||'Botânica';
const systematicsDefinition=id=>systematicsContent.views.find(v=>v.id===id);
const studyDefinition=mode=>mode.startsWith('internal-')?studyOrgan(mode.slice(9)):mode.startsWith('histo-')?studyTissue(mode.slice(6)):mode.startsWith('cyto-')?cytologyView(mode.slice(5)):mode.startsWith('botany-')?botanyView(mode.slice(7)):mode.startsWith('syst-')?systematicsDefinition(mode.slice(5)):null;
const relatedOrgan=core=>studyContent?.organs?.find(o=>o.coreIds?.includes(core?.id)||o.primaryCoreId===core?.id);
const MICRO_CORE_MODELS={nephron:'nephron',glomerulus:'nephron','bowman-capsule':'nephron','proximal-tubule':'nephron','henle-loop':'nephron','distal-tubule':'nephron','collecting-duct':'nephron',alveoli:'alveolar-unit',neuron:'neuron',synapse:'neuron',sarcomere:'sarcomere',skin:'skin-section',epidermis:'skin-section',dermis:'skin-section','sweat-glands':'skin-section'};
const materialCache=new Map();
let allMeshObjects=[];
let toastTimer,searchTimer;
let selectionVersion=0,modeVersion=0,latestRequestedMode='body',coreSearch,partsSearch,organSearch,histologySearch,cytologySearch,pickCandidates=[];
const namedSystems=new Map(),meshSet=new Set(),modelLoading=new Map();
const clipSettings=new Map();
const clippingKey=()=>state.mode+(state.mode.startsWith('internal-')?'|'+state.studyRepresentation:'');
const touchDevice=matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>1;
document.documentElement.classList.toggle('touch-device',touchDevice);
let offlineWorker=null;
function setupOffline(){
  if(touchDevice)$('install-hint').hidden=false;
  if(!('serviceWorker' in navigator)||!globalThis.isSecureContext){$('offline-status').textContent='Acesso off-line requer a versão HTTPS.';return}
  navigator.serviceWorker.addEventListener('controllerchange',()=>{offlineWorker=navigator.serviceWorker.controller;$('download-offline').disabled=!offlineWorker;offlineWorker?.postMessage({type:'CACHE_STATUS'})});
  navigator.serviceWorker.addEventListener('message',event=>{
    const data=event.data;if(data?.type!=='ATLAS_CACHE_STATUS')return;
    const active=['start','progress'].includes(data.phase);
    $('download-offline').disabled=active||!offlineWorker;
    $('download-offline').textContent=data.offlineReady?'Acervo salvo · verificar':'Baixar para usar off-line';
    $('offline-status').textContent=active?`Salvando arquivos: ${data.cached} / ${data.total}`:data.errors?.length?'Alguns arquivos não foram salvos. Toque para tentar novamente.':data.offlineReady?'Acervo salvo neste navegador. Teste em modo avião antes de estudar sem internet.':`Modelos salvos: ${data.modelsCached||0} / ${data.modelsTotal||36}`;
  });
  $('download-offline').addEventListener('click',()=>{if(offlineWorker){$('download-offline').disabled=true;offlineWorker.postMessage({type:'CACHE_ALL'});toast('Salvando o acervo no dispositivo. Você pode continuar explorando.')}});
  navigator.serviceWorker.register('./service-worker.js',{scope:'./',updateViaCache:'none'}).then(async()=>{
    const registration=await navigator.serviceWorker.ready;offlineWorker=navigator.serviceWorker.controller||registration.active;
    $('download-offline').disabled=!offlineWorker;offlineWorker?.postMessage({type:'CACHE_STATUS'});
  }).catch(()=>{$('offline-status').textContent='Não foi possível preparar o acesso off-line neste navegador.'});
}
function registerMesh(mesh){if(!meshSet.has(mesh)){meshSet.add(mesh);allMeshObjects.push(mesh)}preparePickingMesh(mesh)}
function freezeModel(root){root.updateMatrixWorld(true);root.traverse(object=>{object.matrixAutoUpdate=false;object.matrixWorldAutoUpdate=false})}
// Indexes are rebuilt only when their source changes; the part index (thousands of pieces) is built on first use.
const searchCache=new Map();
function cachedSearch(key,source,build){const hit=searchCache.get(key);if(hit?.source===source)return hit.search;const search=createSmartSearch(build());searchCache.set(key,{source,search});return search}
let partsIndex=null,partsIndexVersion=-1;
function rebuildSearch(){
  coreSearch=cachedSearch('core',state.core,()=>state.core.map(c=>({key:c.id,title:c.name,terms:[c.id,...c.aliases||[]],description:[c.shortFunction,c.function,c.mechanism].join(' ')})));
  partsSearch=query=>{if(partsIndexVersion!==state.registry.version){partsIndex=createSmartSearch([...state.registry.values()].map(r=>({key:r.name,title:r.pt,terms:[r.name,lexicon[r.name]?.la||'',state.coreMap.get(r.coreId)?.name||'',...state.coreMap.get(r.coreId)?.aliases||[]],description:r.customInfo?.function||state.coreMap.get(r.coreId)?.shortFunction||''})));partsIndexVersion=state.registry.version}return partsIndex(query)};
  organSearch=cachedSearch('organ',studyContent?.organs,()=>(studyContent?.organs||[]).map(o=>({key:o.id,title:o.label,terms:[...(o.coreIds||[]),...(o.internalParts||[]).map(p=>p.label)],description:[o.description,...(o.internalParts||[]).map(p=>p.function)].join(' ')})));
  histologySearch=cachedSearch('histology',studyContent?.histology,()=>(studyContent?.histology||[]).map(o=>({key:o.id,title:o.title||o.label,terms:[o.id,...(o.parts||[]).map(p=>p.label)],description:[o.description,...(o.parts||[]).map(p=>p.function)].join(' ')})));
  cytologySearch=cachedSearch('cytology',cytologyContent?.views,()=>(cytologyContent?.views||[]).map(v=>({key:v.id,title:v.title||v.label,terms:[v.id,...(v.aliases||[]),...(v.parts||[]).map(p=>p.label)],description:[v.description,...(v.keyIdeas||[]),...(v.parts||[]).map(p=>p.function)].join(' ')})));
  botanySearch=cachedSearch('botany',botanyContent.views,()=>botanyContent.views.map(v=>({key:v.id,title:v.title||v.label,terms:[v.id,...v.parts.map(p=>p.label)],description:[v.description,...v.parts.map(p=>p.mechanism)].join(' ')})));
}
function updateCatalogUi(){
  for(const tab of ['core','all','internal','histology','cytology','botany','systematics']){const button=$(tab+'-tab');button.classList.toggle('active',state.tab===tab);button.setAttribute('aria-pressed',String(state.tab===tab))}
  const cytology=state.tab==='cytology',botany=state.tab==='botany',syst=state.tab==='systematics',study=state.tab==='internal'||state.tab==='histology';$('study-filter').hidden=!study;$('cytology-filter').hidden=!cytology;$('botany-filter').hidden=!botany;$('body-layer-controls').hidden=study||cytology||botany||syst;
  $('catalog-eyebrow').textContent=syst?'ÁRVORE DA VIDA':botany?'EXPLORAR OS VEGETAIS':cytology?'EXPLORAR A CÉLULA':'EXPLORAR O CORPO';$('catalog-heading').textContent=syst?'Sistemática':botany?'Tecidos e fisiologia vegetal':cytology?'Citologia em detalhes':'Anatomia em camadas';$('catalog-description').textContent=syst?'Domínios, reinos e filos, com a fisiologia comparada entre os grupos.':botany?'Do órgão vegetal à célula e aos mecanismos.':cytology?'Da organização celular aos processos. Escolha uma vista.':'Clique no corpo ou busque uma estrutura.';$('search').placeholder=syst?'Grupo, exemplo ou estrutura…':botany?'Tecidos, órgãos ou processos vegetais…':cytology?'Organelas, nomes ou processos…':'Nome ou função…';
  for(const [id,on]of[['go-cytology',cytology],['go-botany',botany],['go-systematics',syst]]){$(id).classList.toggle('active',on&&state.view==='atlas');$(id).setAttribute('aria-pressed',String(on&&state.view==='atlas'))}const atlasButton=document.querySelector('[data-view="atlas"]');atlasButton.classList.toggle('active',!cytology&&!botany&&!syst&&state.view==='atlas');atlasButton.setAttribute('aria-pressed',String(!cytology&&!botany&&!syst&&state.view==='atlas'));
}
function setCatalogTab(tab){
  state.tab=tab;state.search='';$('search').value='';updateCatalogUi();renderList();
}
function updateStudyPath(){
  $('representation-controls').hidden=!state.mode.startsWith('internal-');
  const representations=$('model-representation'),segmentOption=representations.querySelector('[value="segmented"]');
  if(state.mode==='internal-heart'&&!segmentOption)representations.add(new Option('Peças anatômicas','segmented'));
  else if(state.mode!=='internal-heart'&&segmentOption)segmentOption.remove();
  const detailedOption=representations.querySelector('[value="detailed"]');
  if(interiorSpec(state.mode)&&!detailedOption)representations.add(new Option('Corte anatômico detalhado','detailed'));
  else if(!interiorSpec(state.mode)&&detailedOption)detailedOption.remove();
  representations.value=state.studyRepresentation==='segmented'&&state.mode!=='internal-heart'?'reference':state.studyRepresentation;
  $('representation-controls').querySelector('small').textContent=state.mode==='internal-heart'&&state.studyRepresentation==='reference'?'Selecione os pontos verdes ou os nomes. Use Peças anatômicas para seleção direta das superfícies.':studyModels.get(state.mode)?.authoredReconstruction?'Corte reconstruído para ensino: selecione uma peça e confira sua descrição.':'Selecione uma peça no modelo ou nos nomes para ver sua função.';
  const active=isStudyMode(state.mode),definition=studyDefinition(state.mode);$('study-path').hidden=!active;$('fit-body').textContent=isDetailMode(state.mode)?'Vista completa':'Corpo inteiro';
  const count=active?studyModels.get(state.mode)?.parts.length:state.mode.startsWith('micro-')?microModels.get(state.mode)?.parts.length:null;$('render-status').textContent=count!=null?count+' partes nesta vista · carregamento sob demanda':state.registry.size.toLocaleString('pt-BR')+' peças catalogadas · carregamento por camada';
  const referenceModel=studyModels.get(state.mode);if(active&&referenceModel?.anatomicalReference){const pieces=referenceModel.parts.filter(p=>p.geometryIdentified&&!p.annotationOnly).length,markers=referenceModel.parts.filter(p=>p.annotationOnly).length;$('render-status').textContent=pieces+' peças com geometria'+(markers?' · '+markers+' marcadores educativos':'')+' · referência anatômica'}
  if(active&&referenceModel?.authoredReconstruction&&referenceModel.parts.some(p=>p.annotationOnly)){const pieces=referenceModel.parts.filter(p=>p.geometryIdentified!==false&&!p.annotationOnly).length,markers=referenceModel.parts.filter(p=>p.annotationOnly).length;$('render-status').textContent=pieces+' peças com geometria · '+markers+' contorno educativo de espaço'}
  $('context-bones').closest('label').hidden=isDetailMode(state.mode);
  if(!active)return;
  if(state.mode.startsWith('syst-')){const group=systematicsView?.groupOfView(definition.id);$('study-back').textContent=studyTrail.length?'Voltar a '+studyTrail.at(-1).label:'Voltar ao corpo';$('study-path-label').textContent='Sistemática → '+(group?.name||'')+' → '+(state.selected?.raw?.pt||definition.label);$('study-related').textContent=definition.cytologyLink?.label||'Ver na Citologia';$('study-related').hidden=!definition.cytologyLink;return}
  if(state.mode.startsWith('botany-')){$('study-back').textContent=studyTrail.length?'Voltar a '+studyTrail.at(-1).label:'Voltar ao corpo';$('study-path-label').textContent='Vegetal → '+(state.selected?.raw?.pt||definition.title);$('study-related').textContent='Abrir mecanismo relacionado';$('study-related').hidden=!studyConnections?.resolve(state.mode,state.selected?.raw?.customInfo)?.links.length;return}
  const previous=studyTrail.at(-1),originTissue=[...studyTrail].reverse().find(f=>f.mode.startsWith('histo-')||f.mode.startsWith('botany-'))|| ((cytologyOrigin?.mode.startsWith('histo-')||cytologyOrigin?.mode.startsWith('botany-'))?cytologyOrigin:null);
  const selectedLabel=state.selected?.raw?.pt||definition?.label||definition?.title||'';
  $('study-back').textContent=previous?'Voltar a '+previous.label:state.mode.startsWith('cyto-')?(cytologyOrigin?.mode.startsWith('histo-')?'Voltar ao tecido':cytologyOrigin?.mode.startsWith('internal-')?'Voltar ao órgão':'Voltar ao corpo'):'Voltar ao corpo';
  const organ=studyOrgan(state.studyOrgan),levels=[];if(organ)levels.push(organ.label);if(originTissue&&originTissue.mode!==state.mode)levels.push(studyDefinition(originTissue.mode)?.label||studyDefinition(originTissue.mode)?.title||originTissue.label);levels.push(selectedLabel);$('study-path-label').textContent=levels.join(' → ');
  if(state.mode.startsWith('cyto-')){const tissue=originTissue?.mode||(definition.histologyIds||[]).find(id=>studyTissue(id));$('study-related').textContent=originTissue?(originTissue.mode.startsWith('botany-')?'Voltar à estrutura vegetal':'Voltar ao tecido de origem'):'Ver tecido relacionado';$('study-related').hidden=!tissue;return}
  $('study-related').textContent=state.mode.startsWith('internal-')?'Abrir tecido da seleção':'Voltar à estrutura no órgão';
  const link=studyConnections?.resolve(state.mode,state.selected?.raw?.customInfo)?.links.find(l=>l.viewId.startsWith('histo-'));$('study-related').hidden=state.mode.startsWith('internal-')?!link:!organ;
}
// The female body and the male body each have their own layers; the panel shows those of the body on screen.
const layerBody=()=>state.mode==='female'?'female':'body';
const bodyLayers=(body=layerBody())=>Object.keys(body==='female'?FEMALE_SYSTEMS:MODEL_SYSTEMS);
const tissueSystem=id=>bodySystem(id)?.tissue||id;
function refreshLayerUi(){
  $('toggle-layers').textContent=bodyLayers().every(k=>state.layers[k])?'Ocultar todos':'Mostrar todos';
  if($('isolate-part'))$('isolate-part').textContent=state.isolated?'Mostrar contexto':state.selected?.raw?.customInfo?.annotationKind==='cavity-boundary'?'Isolar contorno':'Isolar';
}
// With a root, only the styled copies of that model's materials go; clearing everything forced the whole body
// to rebuild ~1,400 materials and recompile their shaders after every organ switch.
function clearMaterialCache(root){
  if(!root){for(const material of materialCache.values())material.dispose();materialCache.clear();return}
  const owned=new Set();root.traverse(o=>{if(o.isMesh)for(const m of [].concat(o.userData.originalMaterial||[]))owned.add(m.uuid)});
  for(const [key,material] of materialCache)if(owned.has(key.slice(0,key.indexOf('|')))){material.dispose();materialCache.delete(key)}
}
function surfaceOptions(){return {quality:touchDevice?'mobile':'balanced',naturalColors:$('tissue-colors')?.checked??true}}
function updateSurfaceQuality(){
  clearMaterialCache();
  for(const [id,group] of Object.entries(state.groups))applyTissueFinish(group,{system:tissueSystem(id)},surfaceOptions());
  for(const [mode,model] of studyModels)if(!model.preserveMaterials)applyTissueFinish(model.group,{system:studyDefinition(mode)?.system},surfaceOptions());
  applyVisibility();
}

function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4200)}
function showError(text){$('notice').textContent=text;$('notice').hidden=false}
async function getJSON(path,optional=false){try{const r=await fetch(path);if(!r.ok)throw new Error('Arquivo indisponível: '+path);return await r.json()}catch(error){if(optional){console.warn('Conteúdo temporariamente indisponível: '+path);return null}throw error}}
function systemLabel(id){if(id==='basic-tissues'||id==='tissues')return 'Tecidos básicos';const aliases={respiratorio:'respiratory',urinario:'urinary',digestorio:'digestive',nervoso:'nervous',endocrino:'endocrine',reprodutor:'reproductive',muscular:'musculoskeletal',tegumentar:'integumentary',linfatico:'lymphatic-immune'};id=aliases[id]||id;const systems=physiology?.systems;return Array.isArray(systems)?(systems.find(s=>s.id===id)?.name||id):(systems?.[id]?.name||systems?.[id]||id)}
function matchCore(name){
  return resolveCore(name,namedSystems.get(name)||(/^VH_F/.test(name)?'female':null),state.core);
}

const coreMeshCache=new Map();let coreMeshVersion=-1;
function coreMeshNames(core){if(coreMeshVersion!==state.registry.version){coreMeshCache.clear();coreMeshVersion=state.registry.version}let names=coreMeshCache.get(core.id);if(!names){names=getCoreMeshNames(core,state.registry);coreMeshCache.set(core.id,names)}return names}
function namesForCore(core){
  const entry=resolveStudyEntry(core?.id);if(entry?.mode===state.mode){const ids=new Set(entry.partIds);return(studyModels.get(state.mode)?.parts||[]).filter(p=>ids.has(p.id)).map(p=>p.registryName)}
  if(state.mode.startsWith('micro-')&&['nephron','alveoli','neuron','sarcomere','skin'].includes(core.id)&&MICRO_CORE_MODELS[core.id]===state.mode.slice(6))return [...state.registry.values()].filter(r=>r.system===state.mode).map(r=>r.name);
  return coreMeshNames(core).filter(n=>{const system=state.registry.get(n)?.system;return state.mode.startsWith('micro-')?system===state.mode:state.mode==='female'?isFemaleSystem(system):!isFemaleSystem(system)&&!isDetailMode(system||'')});
}
function createRegistry(){
  for(const [system,names] of Object.entries(atlasSystems)){
    for(const name of names){namedSystems.set(name,system);const core=matchCore(name);state.registry.set(name,{name,system,pt:translatedName(name,lexicon),coreId:core?.id||null,object:null,search:normalise([name,lexicon[name]?.la||'',core?.name||'',...(core?.aliases||[])].join(' '))})}
  }
  // Female body parts: [source name, Portuguese label, source label, ontology id] per system (data/atlas-female-body.json).
  for(const [system,parts] of Object.entries(femaleBody?.systems||{}))for(const [name,pt,label,ontology] of parts){namedSystems.set(name,tissueSystem(system));const core=matchCore(name);if(pt)lexicon[name]||={pt};state.registry.set(name,{name,system,pt:pt||translatedName(name,lexicon),coreId:core?.id||null,object:null,search:normalise([name,label,ontology||'',core?.name||'',...(core?.aliases||[])].join(' '))})}
  for(const c of state.core)state.coreMap.set(c.id,c);rebuildSearch();
}
function renderLayers(){
  const body=layerBody(),systems=body==='female'?FEMALE_SYSTEMS:MODEL_SYSTEMS;
  $('layers').innerHTML=Object.entries(systems).map(([id,s])=>`<label class="layer-row" style="--system-color:${s.color}"><input type="checkbox" data-layer="${id}" ${state.layers[id]?'checked':''}><span class="layer-color"></span><span class="layer-text">${s.name}</span><span class="layer-count">${(body==='female'?femaleBody?.systems[id]:atlasSystems[id])?.length||0}</span><button type="button" data-only-layer="${id}" aria-label="Mostrar somente ${s.name}" title="Mostrar somente este sistema">◎</button></label>`).join('');
  $('layers').querySelectorAll('[data-layer]').forEach(input=>input.addEventListener('change',async()=>{
    const id=input.dataset.layer,enabled=input.checked;
    ++selectionVersion;state.layers[id]=enabled;state.isolated=null;
    try{
      if(state.mode!==body)await switchModel(body);
      if(enabled){input.disabled=true;await loadSystem(id)}
    }catch{toast('Esta camada não carregou. Tente novamente.')}finally{input.disabled=false;applyVisibility();renderList();refreshLayerUi()}
  }));
  $('layers').querySelectorAll('[data-only-layer]').forEach(button=>button.addEventListener('click',async e=>{
    e.preventDefault();e.stopPropagation();++selectionVersion;
    const id=button.dataset.onlyLayer;for(const k of bodyLayers(body))state.layers[k]=k===id;
    state.isolated=null;
    try{if(state.mode!==body)await switchModel(body);await loadSystem(id)}catch{toast('Esta camada não carregou. Tente novamente.')}
    renderLayers();applyVisibility();renderList();
  }));refreshLayerUi();
}

function renderList(){
  if(state.tab==='systematics'){updateCatalogUi();$('list-title').textContent='Árvore da vida';if(!systematicsView){$('list-count').textContent='Conteúdo indisponível';$('structure-list').innerHTML='<p class="unavailable">A Sistemática não carregou. As outras áreas continuam disponíveis.</p>';return}const shown=systematicsView.renderTree($('structure-list'),{search:state.search,activeView:state.mode.startsWith('syst-')?state.mode.slice(5):null}),stats=systematicsView.stats();$('list-count').textContent=state.search?shown+' grupos':stats.leaves+' grupos · '+stats.withModel+' em 3D';return}
  if(state.tab==='botany'&&!botanyContent.views.length){$('list-title').textContent='Botânica';$('list-count').textContent='Conteúdo indisponível';$('structure-list').innerHTML='<p class="unavailable">O conteúdo vegetal não carregou. As outras áreas continuam disponíveis.</p><button id="retry-botany">Tentar carregar Botânica</button>';$('retry-botany').addEventListener('click',enterBotany);return}
  if(state.tab==='botany'){const result=botanySearch(state.search),items=result.items.map(r=>botanyView(r.key)).filter(v=>state.botanyCategory==='all'||v.category===state.botanyCategory);$('list-title').textContent='Tecidos e fisiologia vegetal';$('list-count').textContent=items.length+' vistas';$('structure-list').innerHTML=(result.approximate?'<p class="search-suggestion">Nomes parecidos. Confira a estrutura.</p>':'')+items.map(v=>`<button class="structure-item ${state.mode==='botany-'+v.id?'active':''}" data-study="botany-${escapeHtml(v.id)}"><span class="item-text"><strong>${escapeHtml(v.title||v.label)}</strong><small>${escapeHtml(botanyCategory(v.category))} · ${v.parts.length} partes</small></span><span class="item-arrow">↗</span></button>`).join('')+(items.length?'':'<p class="unavailable">Nenhuma vista neste filtro.</p>');$('structure-list').querySelectorAll('[data-study]').forEach(b=>b.addEventListener('click',()=>openStudy(b.dataset.study)));return}

  updateCatalogUi();
  if(state.tab==='cytology'){
    const result=cytologySearch(state.search),items=result.items.map(i=>cytologyView(i.key)).filter(v=>state.cytologyCategory==='all'||v.category===state.cytologyCategory);
    $('list-title').textContent='Células, estruturas e processos';$('list-count').textContent=items.length+' vistas';
    $('structure-list').innerHTML=(result.approximate?'<p class="search-suggestion">Nomes parecidos. Confira o conceito antes de selecionar.</p>':'')+items.map(v=>`<button class="structure-item ${state.mode==='cyto-'+v.id?'active':''}" data-study="cyto-${escapeHtml(v.id)}"><span class="item-text"><strong>${escapeHtml(v.title||v.label)}</strong><small>${escapeHtml(cytologyCategory(v.category))} · ${v.parts.length} partes</small></span><span class="item-arrow">↗</span></button>`).join('')+(items.length?'':'<p class="unavailable">Nenhuma vista neste filtro. Tente outro nome ou tema.</p>');
    $('structure-list').querySelectorAll('[data-study]').forEach(b=>b.addEventListener('click',()=>openStudy(b.dataset.study)));return;
  }
  if(state.tab==='internal'||state.tab==='histology'){
    const internal=state.tab==='internal',result=(internal?organSearch:histologySearch)(state.search),items=result.items.map(i=>internal?studyOrgan(i.key):studyTissue(i.key)).filter(i=>state.studySystem==='all'||i.system===state.studySystem);
    $('list-title').textContent=internal?'Órgãos por dentro':'Tecidos e unidades';$('list-count').textContent=items.length+' vistas';
    $('structure-list').innerHTML=(result.approximate?'<p class="search-suggestion">Nomes parecidos. Confira a estrutura antes de selecionar.</p>':'')+items.map(i=>`<button class="structure-item ${state.mode===(internal?'internal-':'histo-')+i.id?'active':''}" data-study="${internal?'internal-':'histo-'}${escapeHtml(i.id)}"><span class="item-text"><strong>${escapeHtml(i.label||i.title)}</strong><small>${escapeHtml(systemLabel(i.system))} · ${(internal?i.internalParts:i.parts)?.length||0} partes</small></span><span class="item-arrow">↗</span></button>`).join('')+(items.length?'':'<p class="unavailable">Nenhuma vista neste filtro. Tente outro nome ou sistema.</p>');
    $('structure-list').querySelectorAll('[data-study]').forEach(b=>b.addEventListener('click',()=>openStudy(b.dataset.study)));return;
  }
  let useCore=state.tab==='core',result=(useCore?coreSearch:partsSearch)(state.search);
  if(useCore&&state.search&&(!result.items.length||result.approximate)){
    const parts=partsSearch(state.search);if(parts.items.length&&(!result.items.length||!parts.approximate)){useCore=false;result=parts}
  }
  // Parts of the body on screen come first; the other body's homonyms follow (stable order otherwise).
  if(!useCore&&['body','female'].includes(state.mode)){const here=item=>isFemaleSystem(state.registry.get(item.key)?.system)===(state.mode==='female')?0:1;result={...result,items:[...result.items].sort((a,b)=>here(a)-here(b))}}
  const items=result.items.map(item=>{
    if(useCore){const c=state.coreMap.get(item.key);return {key:c.id,title:c.name,subtitle:systemLabel(c.system),core:true,hasMesh:coreMeshNames(c).length>0||!!MICRO_CORE_MODELS[c.id]}}
    const r=state.registry.get(item.key);return {key:r.name,title:r.pt,subtitle:(MODEL_SYSTEMS[r.system]?'Corpo masculino · '+MODEL_SYSTEMS[r.system].name:null)||(isFemaleSystem(r.system)?'Corpo feminino · '+FEMALE_SYSTEMS[r.system].name:r.system.startsWith('cyto-')?'Citologia · modelo didático':r.system.startsWith('histo-')?'Histologia · modelo didático':r.system.startsWith('internal-')?'Interior do órgão · corte didático':'Esquema microscópico 3D'),core:false,hasMesh:true};
  });
  $('list-title').textContent=useCore?'Estruturas essenciais':state.tab==='core'?'Encontradas no modelo':'Peças do modelo';
  $('list-count').textContent=items.length+' itens';
  const limit=250;
  $('structure-list').innerHTML=(result.approximate?'<p class="search-suggestion">Nomes parecidos com o que você escreveu. Confira a estrutura antes de selecionar.</p>':'')+items.slice(0,limit).map(i=>`<button class="structure-item ${state.selected?.key===i.key?'active':''}" data-key="${escapeHtml(i.key)}" data-core="${i.core}"><span class="item-text"><strong>${escapeHtml(i.title)}</strong><small>${escapeHtml(i.subtitle)}</small></span><span class="${i.hasMesh?'item-arrow':'no-mesh'}">${i.hasMesh?'↗':'texto'}</span></button>`).join('')+(items.length>limit?`<p class="unavailable">Mostrando ${limit} de ${items.length}. Use a busca para encontrar qualquer peça.</p>`:'')+(items.length===0?'<p class="unavailable">Nenhuma estrutura encontrada. Tente parte do nome ou uma função, como insulina.</p>':'');
  $('structure-list').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>selectItem(b.dataset.key,b.dataset.core==='true')));
}

function init3D(){
  scene=new THREE.Scene();scene.background=null;
  renderer=new THREE.WebGLRenderer({canvas:$('anatomy-canvas'),antialias:true,alpha:true,preserveDrawingBuffer:false,powerPreference:'high-performance'});
  renderQuality.rest=touchDevice?Math.min(devicePixelRatio,1.5):1.5;renderQuality.motion=storedMotionRatio(renderQuality.rest);renderer.setPixelRatio(renderQuality.rest);$('quality').value=String(renderQuality.rest);if(touchDevice){$('export-4k').textContent='Salvar imagem';document.querySelector('.viewer-help').firstChild.textContent='Um dedo gira · dois dedos movem e ampliam · toque para selecionar'}renderer.setClearColor(0x0e1927,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;renderer.localClippingEnabled=true;
  camera=new THREE.PerspectiveCamera(35,1,.005,30);camera.position.set(0,.85,3.2);
  controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.85,0);controls.enableDamping=true;controls.dampingFactor=touchDevice?.1:.14;controls.zoomToCursor=true;controls.minPolarAngle=.01;controls.maxPolarAngle=Math.PI-.01;controls.minDistance=.025;controls.maxDistance=6;controls.panSpeed=.6;controls.rotateSpeed=.65;controls.autoRotateSpeed=.6;
  controls.addEventListener('change',requestRender);controls.addEventListener('start',()=>{deferPickingIndex();tween=null;renderQuality.dragging=true;$('hover-label').hidden=true});controls.addEventListener('end',()=>{renderQuality.dragging=false});
  scene.add(new THREE.HemisphereLight(0xd9eaf6,0x3e342d,1.3));
  const key=new THREE.DirectionalLight(0xffeee0,2.2);key.position.set(-2,3,3);scene.add(key);
  const fill=new THREE.DirectionalLight(0xbedbea,1.1);fill.position.set(2,1,2);scene.add(fill);
  const rim=new THREE.DirectionalLight(0x8ecbb9,.9);rim.position.set(0,2,-3);scene.add(rim);
  if(tissueFinish.createTissueEnvironment){environmentHandle=tissueFinish.createTissueEnvironment(renderer,{size:128});scene.environment=environmentHandle.texture;scene.environmentIntensity=.55}
  // Both bodies share one parent, so one set of draw batches serves both (each batch bakes its pieces' world matrices).
  const anatomyGroup=new THREE.Group();anatomyGroup.name='anatomy';bodyGroup=new THREE.Group();femaleGroup=new THREE.Group();femaleGroup.visible=false;anatomyGroup.add(bodyGroup,femaleGroup);scene.add(anatomyGroup);
  bodyBounds=new THREE.Box3(new THREE.Vector3(-.335,.003,-.166),new THREE.Vector3(.335,1.708,.155));
  // The female files keep the HRA coordinates; the group stands the body on the floor, centred like the male body.
  const placement=femaleBody?.placement;if(placement){femaleGroup.position.fromArray(placement.offset);femaleBounds=new THREE.Box3(new THREE.Vector3(...placement.bounds.min),new THREE.Vector3(...placement.bounds.max))}else femaleBounds=bodyBounds.clone();femaleGroup.updateMatrixWorld(true);
  xrayGroup=new THREE.Group();xrayGroup.matrixAutoUpdate=false;scene.add(xrayGroup);renderBatches=createRenderBatches(anatomyGroup,requestRender);
  groundShadow=createGroundShadow();groundShadow.userData.noOcclusion=true;groundShadow.position.set(0,0,-.005);groundShadow.scale.set(.9,.55,1);scene.add(groundShadow);
  draco=new DRACOLoader();draco.setDecoderPath('./models/draco/');draco.setWorkerLimit(touchDevice?1:2);
  loader=new GLTFLoader();loader.setDRACOLoader(draco);
  resizeObserver=new ResizeObserver(resize);resizeObserver.observe($('viewport'));
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();showError('A renderização 3D foi interrompida. Aguardando o navegador recuperar a imagem…')});
  renderer.domElement.addEventListener('webglcontextrestored',()=>{if(tissueFinish.createTissueEnvironment){environmentHandle?.dispose();environmentHandle=tissueFinish.createTissueEnvironment(renderer,{size:128});scene.environment=environmentHandle.texture}renderBatches.rebuildAll(state.groups);$('notice').hidden=true;applyVisibility();requestRender()});
  initPicking();resize();
}
// Soft contact shadow under the standing body: grounds the model without a real-time shadow pass.
function createGroundShadow(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(64,64,0,64,64,64);
  gradient.addColorStop(0,'rgba(0,0,0,.55)');gradient.addColorStop(.45,'rgba(0,0,0,.28)');gradient.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false}));mesh.rotation.x=-Math.PI/2;mesh.renderOrder=-1;return mesh
}
function resize(){if(!renderer||state.view!=='atlas')return;const rect=$('viewport').getBoundingClientRect();if(rect.width<1||rect.height<1)return;renderer.setSize(rect.width,rect.height,false);camera.aspect=rect.width/rect.height;applyViewOffset();requestRender()}
// Drawers on tablets cover part of the viewer; shift the projection so the model stays centred in what remains visible.
// Floating tablet toolbars also cover the top and bottom of the viewer.
// An open process bar covers the bottom of the viewer as well (measured once when it opens, so steps do not shift the view).
let processInset=0;
function chromeInset(){return tabletUI.active?{top:isStudyMode(state.mode)?122:64,bottom:80+processInset}:{top:0,bottom:processInset}}
function applyViewOffset(){const w=renderer.domElement.clientWidth,h=renderer.domElement.clientHeight,chrome=chromeInset(),x=viewInset.x/2,y=(viewInset.y+chrome.bottom-chrome.top)/2;if(w&&h&&(x||y))camera.setViewOffset(w,h,x,y,w,h);else camera.clearViewOffset()}
// While a drawer slides, frames take the light motion path (no occlusion pass); the settled frame is drawn in full 160 ms later.
function setViewInset(x,y,target={x,y}){viewInset.x=x;viewInset.y=y;viewInset.target=target;if(camera){if(x!==target.x||y!==target.y)noteMotion();applyViewOffset();requestRender()}}
function visibleFraction(){const w=renderer.domElement.clientWidth,h=renderer.domElement.clientHeight,chrome=chromeInset();if(!w||!h)return{x:1,y:1};const inset=viewInset.target;return{x:Math.max(.25,(w-inset.x)/w),y:Math.max(.25,(h-inset.y-chrome.top-chrome.bottom)/h)}}
function requestRender(){if(!frameRequested){frameRequested=true;requestAnimationFrame(renderFrame)}}
function renderFrame(now){
  frameRequested=false;if(!renderer||state.view!=='atlas'||document.hidden||compileGate)return;
  let moving=!!tween||controls.autoRotate||renderQuality.dragging;
  // A new selection's gold rim fades in while the camera travels to it; without a camera move it appears at once.
  const selectedKey=state.selected?.key||null;if(selectedKey!==fadeSelectionKey){fadeSelectionKey=selectedKey;selectionFade.start=selectedKey&&tween?now:0}
  selectionFade.value=tween&&selectionFade.start?Math.min(1,(now-selectionFade.start)/(tween.duration*.55)):1;
  if(tween){const f=Math.min(1,(now-tween.start)/tween.duration),smooth=f<.5?4*f*f*f:1-(-2*f+2)**3/2;camera.position.lerpVectors(tween.fromPosition,tween.toPosition,smooth);controls.target.lerpVectors(tween.fromTarget,tween.toTarget,smooth);controls.update();if(f===1)tween=null}
  else if((controls.enableDamping||controls.autoRotate)&&controls.update())moving=true;
  // A playing process animation counts as motion: lighter frames while it runs, one sharp frame after it pauses.
  if(processPlayer?.update(now))moving=true;
  if(moving)noteMotion();
  drawScene();updateSelectedMarker();if(moving)measureMotion(now);updateFpsMeter();
  if(tween||controls.autoRotate||processPlayer?.playing)requestRender();
}
// A newly shown model compiles its shaders and uploads its textures before its first frame, so the switch
// does not freeze mid-animation; the previous image stays on screen meanwhile and the new one fades in.
let compileGate=null;const uploadedTextures=new WeakSet();
// Yields to pending input and other tasks; unlike setTimeout it is not throttled in background tabs.
const nextTask=()=>new Promise(resolve=>{const channel=new MessageChannel();channel.port1.onmessage=()=>resolve();channel.port2.postMessage(0)});
// While a model is built or compiled the previous image stays, dimmed, with a small progress chip (CSS only, runs on the compositor).
function updateModelBusy(){$('viewport')?.classList.toggle('is-building',modelLoading.size>0||!!compileGate)}
// Lets the browser paint the progress chip before a long synchronous model build.
const nextPaint=()=>new Promise(resolve=>{requestAnimationFrame(()=>setTimeout(resolve));setTimeout(resolve,120)});
function warmUpScene(){
  const pending=[];scene.traverseVisible(o=>{if(!o.isMesh)return;for(const m of [].concat(o.material))for(const key of ['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap','alphaMap']){const t=m?.[key];if(t&&!uploadedTextures.has(t)){uploadedTextures.add(t);pending.push(t)}}});
  // Large maps (2048–4096 px) go to the GPU one per task: input and CSS animations keep running between uploads.
  const gate=(async()=>{await null;for(let i=0;i<pending.length;i++){if(i)await nextTask();if(compileGate!==gate){for(const t of pending.slice(i))uploadedTextures.delete(t);return}renderer.initTexture(pending[i])}
    await Promise.race([renderer.compileAsync(scene,camera),new Promise(resolve=>setTimeout(resolve,4000))]).catch(()=>{})})().then(()=>{if(compileGate!==gate)return;compileGate=null;updateModelBusy();if(tween)tween.start=performance.now();fadeInCanvas();requestRender()});
  compileGate=gate;updateModelBusy();
}
function setRenderRatio(ratio){if(Math.abs(renderer.getPixelRatio()-ratio)>.01)renderer.setPixelRatio(ratio)}
function storedMotionRatio(rest){try{const saved=Number(localStorage.getItem('atlas-motion-ratio-'+rest));return saved>=.75&&saved<=rest?saved:rest}catch{return rest}}
function storeMotionRatio(){try{localStorage.setItem('atlas-motion-ratio-'+renderQuality.rest,String(renderQuality.motion))}catch{}}
// Each moving frame pushes back the return to full resolution; 160 ms without motion renders one sharp frame.
function noteMotion(){
  deferPickingIndex();const q=renderQuality;clearTimeout(q.idle);if(!q.moving){q.moving=true;q.last=0;q.sum=q.count=0}
  q.idle=setTimeout(()=>{q.moving=false;requestRender()},160);
}
// While moving below the full resolution the scene is drawn into a smaller multisampled target and scaled onto
// the canvas, so switching resolution never reallocates the canvas (that reallocation stalled each gesture).
let motionTarget=null,composite=null;
function createComposite(){
  const material=new THREE.ShaderMaterial({uniforms:{tScene:{value:null}},depthTest:false,depthWrite:false,transparent:true,toneMapped:true,
    blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneMinusSrcAlphaFactor,blendSrcAlpha:THREE.OneFactor,blendDstAlpha:THREE.OneMinusSrcAlphaFactor,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    // The target holds linear, premultiplied colour: un-premultiply, tone map and encode exactly like a direct draw, then premultiply again.
    fragmentShader:`uniform sampler2D tScene;varying vec2 vUv;
void main(){vec4 s=texture2D(tScene,vUv);gl_FragColor=vec4(s.a>.0001?s.rgb/s.a:vec3(0.),1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
gl_FragColor=vec4(gl_FragColor.rgb*s.a,s.a);}`});
  const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);quad.frustumCulled=false;const quadScene=new THREE.Scene();quadScene.add(quad);
  return{scene:quadScene,camera:new THREE.OrthographicCamera(-1,1,1,-1,0,1),material};
}
let ambientOcclusion=null;
// Occlusion samples a sphere sized to the viewing distance, so creases read the same on the whole body and up close.
function drawOcclusion(){if(!$('ambient-occlusion')?.checked)return;ambientOcclusion||=createAmbientOcclusion(renderer);ambientOcclusion.render(scene,camera,{radius:camera.position.distanceTo(controls.target)*.045})}
function drawScene(){
  const q=renderQuality,gl=renderer.getContext();
  // Still frames always use the full geometry; in motion, lighter copies where a pixel spans a 2.5 mm cell.
  if(!q.moving){renderBatches.updateDetail(false,camera,gl.drawingBufferHeight);renderer.render(scene,camera);drawOcclusion();return}
  if(q.motion>=q.rest-.01){renderBatches.updateDetail(true,camera,gl.drawingBufferHeight);renderer.render(scene,camera);return}
  const w=Math.max(1,Math.round(renderer.domElement.clientWidth*q.motion)),h=Math.max(1,Math.round(renderer.domElement.clientHeight*q.motion));
  renderBatches.updateDetail(true,camera,h);
  if(!motionTarget)motionTarget=new THREE.WebGLRenderTarget(w,h,{type:THREE.HalfFloatType,samples:4});else if(motionTarget.width!==w||motionTarget.height!==h)motionTarget.setSize(w,h);
  composite||=createComposite();composite.material.uniforms.tScene.value=motionTarget.texture;
  renderer.setRenderTarget(motionTarget);renderer.render(scene,camera);renderer.setRenderTarget(null);renderer.render(composite.scene,composite.camera);
}
// Lower the moving resolution in 0.25 steps while frames average over 17.5 ms (below ~57 fps); climb back only to levels that kept up.
function measureMotion(now){
  const q=renderQuality,delta=now-q.last;q.last=now;if(delta<=0||delta>100){q.sum=q.count=0;return}
  q.sum+=delta;if(++q.count<12)return;const average=q.sum/q.count;q.sum=q.count=0;q.fps=Math.round(1000/average);
  if(average>17.5&&q.motion>.75){q.tooSlow.add(q.motion);q.motion=Math.max(.75,q.motion-.25);q.good=0;storeMotionRatio()}
  else if(average<17.5&&q.motion<q.rest&&!q.tooSlow.has(q.motion+.25)&&++q.good>=6){q.good=0;q.motion=Math.min(q.rest,q.motion+.25);storeMotionRatio()}
}
function updateFpsMeter(){
  const meter=$('fps-meter');if(!meter||meter.hidden)return;const q=renderQuality,info=renderer.info.render;
  meter.textContent=(q.moving&&q.fps?q.fps+' fps':'parado')+' · resolução '+(q.moving?Math.min(q.motion,q.rest):q.rest).toFixed(2)+'× · '+info.calls+' chamadas · '+Math.round(info.triangles/1000)+' mil triângulos';
}
function selectedMarkerPosition(width,height){
  const raw=state.selected?.raw,object=raw?.object;
  if(state.view!=='atlas'||!raw?.customInfo?.annotationOnly||!object)return null;
  for(let parent=object;parent;parent=parent.parent)if(!parent.visible)return null;
  object.getWorldPosition(markerWorld);
  if(renderer.clippingPlanes.some(plane=>plane.distanceToPoint(markerWorld)<0))return null;
  markerProjected.copy(markerWorld).applyMatrix4(camera.matrixWorldInverse);
  if(markerProjected.z>=-camera.near)return null;
  markerProjected.copy(markerWorld).project(camera);
  if(Math.abs(markerProjected.x)>1||Math.abs(markerProjected.y)>1||Math.abs(markerProjected.z)>1)return null;
  return {x:(markerProjected.x+1)*width/2,y:(1-markerProjected.y)*height/2};
}
function updateSelectedMarker(){
  const overlay=$('selected-marker'),key=state.selected?.key||null;
  const position=selectedMarkerPosition($('viewport').clientWidth,$('viewport').clientHeight);
  overlay.hidden=!position;
  if(position){
    overlay.style.left=position.x+'px';overlay.style.top=position.y+'px';
    if(key!==markerSelectionKey){overlay.classList.remove('selection-pulse');void overlay.offsetWidth;overlay.classList.add('selection-pulse')}
  }
  if(position||!key)markerSelectionKey=key;
}
// Soften model swaps: the canvas fades in instead of the new model popping into view.
function fadeInCanvas(){if(!matchMedia('(prefers-reduced-motion:reduce)').matches)renderer?.domElement.animate([{opacity:.15,transform:'scale(.985)'},{opacity:1,transform:'none'}],{duration:420,easing:'cubic-bezier(.22,.8,.24,1)'})}
let fadeSelectionKey=null;
function moveCamera(target,position,instant=false){
  if(matchMedia('(prefers-reduced-motion:reduce)').matches)instant=true;
  // Leftover inertia from the last drag would keep pushing the camera during and after the animation.
  controls._sphericalDelta?.set(0,0,0);controls._panOffset?.set(0,0,0);if('_scale' in controls)controls._scale=1;
  if(instant){tween=null;camera.position.copy(position);controls.target.copy(target);controls.update()}else{
    // Short hops stay quick and long flights get more time: 420–850 ms by the distance travelled relative to the view.
    const reach=Math.max(1e-3,camera.position.distanceTo(controls.target)),travel=(camera.position.distanceTo(position)+controls.target.distanceTo(target))/reach;
    tween={start:performance.now(),duration:Math.min(850,420+260*Math.log2(1+travel)),fromPosition:camera.position.clone(),fromTarget:controls.target.clone(),toPosition:position.clone(),toTarget:target.clone()}}requestRender();
}
function fitBounds(bounds,direction='front',instant=false){
  if(renderer)applyViewOffset();
  const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
  const visible=visibleFraction(),reach=box=>{const s=box.getSize(new THREE.Vector3());return Math.max(s.y/visible.y,s.x/(camera.aspect*visible.x),s.z)*.62/Math.tan(THREE.MathUtils.degToRad(camera.fov/2))+.07};
  const vector=direction==='back'?new THREE.Vector3(0,0,-1):direction==='left'?new THREE.Vector3(1,0,.02).normalize():new THREE.Vector3(0,0,1);
  const outer=isDetailMode(state.mode)?activeBounds():null;
  // In sectioned models keep some of the organ around a small part: it should fill at most about half of the view.
  let distance=reach(bounds);if(outer&&!outer.isEmpty())distance=Math.max(distance,reach(outer)*.5);
  const position=center.clone().addScaledVector(vector,distance);
  // Inner parts of a sectioned model would put the camera inside its walls; back out of the whole model instead.
  if(outer){if(!outer.isEmpty()&&outer.containsPoint(position)){const exit=new THREE.Ray(center,vector).intersectBox(outer,new THREE.Vector3());if(exit)position.copy(exit).addScaledVector(vector,outer.getSize(new THREE.Vector3()).length()*.08)}}
  moveCamera(center,position,instant);
}
function fitBody(direction='front',instant=false){
  const bounds=activeBounds();
  if(!bounds.isEmpty())fitBounds(bounds,direction,instant);
  $('model-caption').textContent=(state.mode==='female'?'Corpo humano feminino · HRA, Visible Human Female':isStudyMode(state.mode)?(studyModels.get(state.mode)?.title||'Vista ampliada')+(studyModels.get(state.mode)?.anatomicalReference?' · referência anatômica':state.mode.startsWith('histo-')||studyModels.get(state.mode)?.authoredReconstruction?' · reconstrução educacional':' · esquema funcional'):state.mode.startsWith('micro-')?(microModels.get(state.mode)?.title||'Modelo microscópico')+' · esquema didático 3D':'Corpo humano masculino')+' · '+(isDetailMode(state.mode)?{front:'frente do modelo',back:'verso do modelo',left:'lateral do modelo'}:{front:'vista anterior',back:'vista posterior',left:'vista lateral esquerda'})[direction];
  document.querySelectorAll('[data-camera]').forEach(b=>b.classList.toggle('active',b.dataset.camera===direction));
}
function activeBounds(){return state.mode==='female'?femaleBounds:isStudyMode(state.mode)?studyModels.get(state.mode)?.fitBounds?.clone()||new THREE.Box3().setFromObject(studyModels.get(state.mode)?.group||new THREE.Group()):state.mode.startsWith('micro-')?new THREE.Box3().setFromObject(microModels.get(state.mode)?.group||new THREE.Group()):bodyBounds}
async function loadSystem(id){
  if(state.loaded.has(id))return;if(state.loading.has(id))return state.loading.get(id);
  const promise=(async()=>{
    const meta=bodySystem(id),female=isFemaleSystem(id);$('asset-status').textContent='Carregando '+(female?'corpo feminino · ':'')+meta.name.toLowerCase()+'…';
    try{
      const roots=(await Promise.all((meta.files||[meta.file]).map(file=>loader.loadAsync('./models/'+file)))).map(gltf=>gltf.scene);
      // Pieces are attached while the container is still at the origin (source coordinates), then the container joins its body.
      const container=new THREE.Group();container.name=id;const named=[];
      for(const root of roots){root.updateMatrixWorld(true);root.traverse(o=>{if(o.userData.za_name&&state.registry.get(o.userData.za_name)?.system===id)named.push(o)})}
      // Two passes preserve each world transform before parent visibility can affect children.
      for(const object of named)container.attach(object);
      (female?femaleGroup:bodyGroup).add(container);
      applyTissueFinish(container,{system:meta.tissue||id},surfaceOptions());
      for(const object of named){const raw=object.userData.za_name,r=state.registry.get(raw);r.object=object;object.traverse(m=>{if(m.isMesh){m.userData.atlasName=raw;m.userData.originalMaterial=m.material;m.frustumCulled=true;registerMesh(m)}})}
      freezeModel(container);state.groups[id]=container;state.loaded.add(id);renderBatches.build(id,container);applyVisibility();
      const layers=bodyLayers(female?'female':'body'),count=layers.filter(id=>state.loaded.has(id)).length;$('load-progress').max=layers.length;$('load-progress').value=count;$('asset-status').textContent=count+' de '+layers.length+' camadas '+(female?'do corpo feminino ':'')+'carregadas';
      $('render-status').textContent=isStudyMode(state.mode)?(studyModels.get(state.mode)?.parts.length||0)+' partes neste esquema · carregamento sob demanda':state.registry.size.toLocaleString('pt-BR')+' peças catalogadas · carregamento por camada';
    }catch(error){console.error(error);showError('Não foi possível carregar '+meta.name+'. Verifique se todos os arquivos do programa estão na mesma pasta.');throw error}
  })();state.loading.set(id,promise);try{await promise}finally{state.loading.delete(id)}
}
function styledMaterial(original,opacity,selected){
  const key=original.uuid+'|'+(selected?'selected':opacity);
  let mat=materialCache.get(key);
  if(!mat){
    mat=copyTissueFinish(original,original.clone(),{textured:opacity>.2||selected});
    mat.side=THREE.DoubleSide;mat.forceSinglePass=original.forceSinglePass||(!selected&&opacity*original.opacity<=.2);
    if(selected)highlightSelectedMaterial(mat);
    materialCache.set(key,mat);
  }
  const finalOpacity=opacity*original.opacity,transparent=finalOpacity<1;
  if(mat.transparent!==transparent){mat.transparent=transparent;mat.needsUpdate=true}
  mat.opacity=finalOpacity;mat.depthWrite=finalOpacity>=.9;
  return mat;
}

function applyVisibility(){
  if(!scene)return;
  bodyGroup.visible=state.mode==='body';femaleGroup.visible=state.mode==='female';groundShadow.visible=bodyGroup.visible||femaleGroup.visible;
    if(bodyGroup.visible||femaleGroup.visible)for(const [raw,r] of state.registry){if(!r.object||isDetailMode(r.system)||isFemaleSystem(r.system)!==femaleGroup.visible)continue;const selected=state.selectedNames.has(raw);const isolated=state.isolated===null||state.isolated.has(raw);
    r.object.visible=!!state.layers[r.system]&&!state.hidden.has(raw)&&isolated;
    const ghost=(r.system==='skeletal'||r.system==='female-skeletal')&&$('context-bones').checked&&!selected&&state.isolated===null;
    const covering=/^(Pleura|Greater omentum|Lesser omentum|VH_F_omentum)$/i.test(raw)&&!selected;
    const opacity=selected?state.opacity:ghost?.16:covering?.08:1;
    r.object.traverse(m=>{if(m.isMesh){const original=m.userData.originalMaterial;m.material=Array.isArray(original)?original.map(x=>styledMaterial(x,opacity,selected)):styledMaterial(original,opacity,selected)}});
  }
  for(const [mode,model] of [...microModels,...studyModels]){model.group.visible=state.mode===mode;if(!model.group.visible)continue;for(const context of model.group.children)if(context.userData.contextOnly)context.visible=state.isolated===null;for(const part of model.parts){const raw=part.registryName,selected=state.selectedNames.has(raw);let needed=false;if(state.isolated!==null)part.object.traverse(m=>{if(m.isMesh&&state.isolated.has(m.userData.atlasName))needed=true});part.object.visible=!state.hidden.has(raw)&&(state.isolated===null||state.isolated.has(raw)||needed);part.object.traverse(m=>{if(m.isMesh){const original=m.userData.originalMaterial;m.material=Array.isArray(original)?original.map(x=>styledMaterial(x,selected?state.opacity:1,selected)):styledMaterial(original,selected?state.opacity:1,selected)}})}}
  pickCandidates=refreshPickCandidates(allMeshObjects);refreshLayerUi();updateClipping();updateXray();renderBatches.sync();updateSelectedMarker();requestRender();
}
// X-ray of the selection: only the hidden parts of the selected meshes are drawn, in gold, over whatever covers them
// (lungs over the heart). One extra draw per selected mesh instead of making every other organ transparent.
const xrayMaterial=new THREE.MeshBasicMaterial({color:SELECTION_COLOR,transparent:true,opacity:.38,depthWrite:false,depthFunc:THREE.GreaterDepth,toneMapped:false});
function updateXray(){
  xrayGroup.clear();if(!['body','female'].includes(state.mode)||!state.selectedNames.size||state.isolated!==null)return;
  const meshes=[];for(const name of state.selectedNames){const object=state.registry.get(name)?.object;if(object?.visible!==false)object?.traverse(m=>{if(m.isMesh&&m.visible&&meshes.length<240)meshes.push(m)})}
  for(const mesh of meshes){mesh.updateWorldMatrix(true,false);const ghost=new THREE.Mesh(mesh.geometry,xrayMaterial);ghost.matrixAutoUpdate=false;ghost.matrix.copy(mesh.matrixWorld);ghost.renderOrder=20;ghost.raycast=()=>{};xrayGroup.add(ghost)}
}
function updateClipping(){
  if(!renderer)return;const mode=$('clip-mode').value,isolated=state.isolated!==null;$('clip-mode').disabled=isolated;$('clip-position').disabled=mode==='none'||isolated;state.clip=mode;
  clipSettings.set(clippingKey(),{mode,position:$('clip-position').value});
  let planes=[];
  if(mode!=='none'&&!isolated){const bounds=activeBounds();const f=Number($('clip-position').value)/100;const axis=mode==='sagittal'?'x':mode==='coronal'?'z':'y';const coordinate=THREE.MathUtils.lerp(bounds.min[axis],bounds.max[axis],f);const normal=new THREE.Vector3();normal[axis]=-1;planes=[new THREE.Plane(normal,coordinate)]}
  renderer.clippingPlanes=planes;requestRender();
}
async function selectItem(key,isCore=false,focus=true,{allowAlternative=true,preserveTrail=false}={}){
  const savedFocus=interactionFocus();
  const version=++selectionVersion;
  const core=isCore?state.coreMap.get(key):state.coreMap.get(state.registry.get(key)?.coreId);
  if(isCore&&!core)return;
  let rawItem=isCore?null:state.registry.get(key);if(!isCore&&!rawItem)return;
  const entry=isCore&&resolveStudyEntry(core.id);
  if(entry){
    if(!studyDefinition(entry.mode)){toast('Esta ampliação está temporariamente indisponível. Tente novamente após recarregar.');return false}
    if(state.mode!==entry.mode){if(!await switchModel(entry.mode,version,{preserveTrail}))return false}else{++modeVersion;latestRequestedMode=entry.mode}
    if(version!==selectionVersion)return false;
    const parts=(studyModels.get(entry.mode)?.parts||[]).filter(p=>entry.partIds.includes(p.id)),names=parts.map(p=>p.registryName);
    for(const name of names)state.hidden.delete(name);state.selected={key,isCore:true,core,raw:parts.length===1?state.registry.get(parts[0].registryName):null,entryRoute:entry};state.selectedNames=new Set(names);state.isolated=null;state.opacity=1;
    renderLayers();applyVisibility();renderDetail();tabletUI.showDetail();renderList();restoreInteractionFocus(savedFocus);rememberStudy();if(focus)fitBody();return true;
  }
  // Reproductive entries open the female body; other entries stay in the female body while it is on screen and has them.
  const femaleWanted=isCore?/uterus|ovar|uterine|vagina|mammary/.test(core.id)||state.mode==='female'&&coreMeshNames(core).some(n=>isFemaleSystem(state.registry.get(n)?.system)):isFemaleSystem(rawItem?.system);
  const microWanted=isCore&&MICRO_CORE_MODELS[core.id]?'micro-'+MICRO_CORE_MODELS[core.id]:rawItem?.system.startsWith('micro-')?rawItem.system:null;
  const targetMode=rawItem&&isStudyMode(rawItem.system)?rawItem.system:femaleWanted?'female':microWanted||'body';
  if(state.mode!==targetMode){if(!await switchModel(targetMode,version))return}else {++modeVersion;latestRequestedMode=targetMode}
  if(version!==selectionVersion)return;
  if(!isCore)rawItem=state.registry.get(key);
  if(allowAlternative&&!isCore&&rawItem?.customInfo?.geometryIdentified===false&&interiorSpec(rawItem.system)&&studyRepresentationFor(rawItem.system)!=='detailed'){
    const context=studySelectionContext({key,isCore:false,core,raw:rawItem});
    const mode=rawItem.system;organRepresentations.set(mode,'detailed');removeStudyModel(mode);await openStudy(mode,undefined,context);return;
  }
  const names=isCore?namesForCore(core):[key];
  if(!isCore&&isDetailMode(rawItem?.system||'')&&rawItem.object?.isGroup)rawItem.object.traverse(m=>{if(m.isMesh&&m.userData.atlasName&&!names.includes(m.userData.atlasName))names.push(m.userData.atlasName)});
  const required=[...new Set(names.map(n=>state.registry.get(n)?.system).filter(s=>s&&bodySystem(s)))];
  try{await Promise.all(required.map(loadSystem))}catch{return}
  if(version!==selectionVersion)return;
  for(const id of required)state.layers[id]=true;
  for(const name of names)state.hidden.delete(name);
  state.selected={key,isCore,core,raw:rawItem};state.selectedNames=new Set(names);state.opacity=1;state.isolated=null;
  renderLayers();applyVisibility();renderDetail();tabletUI.showDetail();renderList();
  restoreInteractionFocus(savedFocus);rememberStudy();
  if(renderer.clippingPlanes.length&&names.length){const bounds=new THREE.Box3();for(const n of names){const o=state.registry.get(n)?.object;if(o)bounds.union(new THREE.Box3().setFromObject(o))}if(!bounds.isEmpty()){const center=bounds.getCenter(new THREE.Vector3()),half=bounds.getSize(new THREE.Vector3()).multiplyScalar(.5);if(renderer.clippingPlanes.some(p=>p.distanceToPoint(center)+Math.abs(p.normal.x)*half.x+Math.abs(p.normal.y)*half.y+Math.abs(p.normal.z)*half.z<0)){$('clip-mode').value='none';updateClipping()}}}
  if(rawItem?.customInfo?.annotationCamera){const pose=rawItem.customInfo.annotationCamera;moveCamera(pose.target,pose.eye);return true}
  if(focus&&names.length){const bounds=new THREE.Box3();for(const n of names){const obj=state.registry.get(n)?.object;if(obj)bounds.union(new THREE.Box3().setFromObject(obj))}if(!bounds.isEmpty())fitBounds(bounds)}
  return true;
}

function renderDetail(){
  const selected=state.selected;if(!selected)return;
  const resetDetailScroll=$('detail-panel').dataset.selectionKey!==selected.key;
  const raw=selected.raw,core=selected.core;
  const broadClass=new Set(['bone','cartilage','tendons','ligaments','skeletal-muscle','peripheral-nerves','veins','lymphatic-vessels','lymph-nodes','synovial-joints']);
  const info=(selected.entryRoute?core:raw?.customInfo)||(!selected.isCore&&core&&broadClass.has(core.id)?{...core,isFamily:true}:core)||familyInfo(raw.name,raw.system);
  const name=selected.isCore?core.name:raw.pt;
  const category=raw?.system.startsWith('botany-')?'Botânica · '+botanyCategory(studyDefinition(raw.system)?.category):raw?.system.startsWith('cyto-')?cytologyCategory(studyDefinition(raw.system)?.category):core?systemLabel(core.system):(isStudyMode(raw.system)?systemLabel(studyDefinition(raw.system)?.system):MODEL_SYSTEMS[raw.system]?.name||(isFemaleSystem(raw.system)?'Corpo feminino · '+FEMALE_SYSTEMS[raw.system].name:'Esquema microscópico 3D'));
  const hasMesh=raw?.customInfo?.geometryIdentified!==false&&[...state.selectedNames].some(n=>hasSelectableGeometry(state.registry.get(n)?.object));
  const functionText=info.function||info.shortFunction;
  $('detail-panel').innerHTML=`<span class="eyebrow">ANATOMIA E FISIOLOGIA</span><span class="system-tag">${escapeHtml(category)}</span><h2 class="detail-name">${escapeHtml(name)}</h2><p class="detail-original">${raw&&isStudyMode(raw.system)?(raw.system.startsWith('histo-')?'Histologia · parte de um modelo didático ampliado':'Estrutura interna · parte de um corte didático'):raw?(raw.name.includes('?')?'Nome específico ausente na fonte':escapeHtml(raw.name))+(lexicon[raw.name]?.la?' · '+escapeHtml(lexicon[raw.name].la):''):'Conteúdo essencial para a Biologia discursiva'}</p>${hasMesh?'':`<div class="model-availability">Esta entrada explica uma estrutura microscópica, processo ou parte sem malha própria neste acervo. O conteúdo está disponível abaixo.</div>`}<div class="detail-controls"><button id="focus-part" ${hasMesh?'':'disabled'}>Aproximar</button><button id="isolate-part" ${hasMesh?'':'disabled'}>${state.isolated?'Mostrar contexto':'Isolar'}</button><button id="hide-part" ${hasMesh?'':'disabled'}>Ocultar</button><button id="restore-body">Restaurar</button></div>${hasMesh?'<label class="opacity-control">Opacidade <input id="part-opacity" type="range" min="15" max="100" value="100" aria-label="Opacidade da estrutura selecionada"></label>':''}<div class="detail-block"><h3>${info.isFamily?'Função geral da classe anatômica':!selected.isCore&&core&&!raw?.customInfo?'Função da estrutura relacionada':'Função'}</h3><p>${escapeHtml(functionText)}</p></div><div class="detail-block mechanism"><h3>Como funciona</h3><p>${escapeHtml(info.mechanism)}</p></div><div class="detail-block uerj"><h3>Conexão com a discursiva UERJ</h3><p>${escapeHtml(info.uerj)}</p></div><div class="detail-block mistake"><h3>Evite esta confusão</h3><p>${escapeHtml(info.commonMistake)}</p></div><p class="detail-footnote">${info.isFamily?'Resumo de família: não substitui a descrição individual da inserção, ação ou território desta subdivisão.':'Explicação educacional baseada nas fontes do atlas.'} ${!selected.isCore&&core?'Esta peça foi associada ao conteúdo de '+escapeHtml(core.name)+'.':''}</p>`;
  if(raw?.system.startsWith('syst-')){$('detail-panel').querySelector('.eyebrow').textContent='SISTEMÁTICA · ESTRUTURA E FUNÇÃO';$('detail-panel').querySelector('.system-tag').textContent=systematicsView?.groupOfView(raw.system.slice(5))?.name||'Sistemática';$('detail-panel').querySelector('.detail-original').textContent=(studyDefinition(raw.system)?.scientificName||'')+' · modelo 3D'}
  else if(raw?.system.startsWith('botany-')){$('detail-panel').querySelector('.eyebrow').textContent='BOTÂNICA · ESTRUTURA E FUNÇÃO';$('detail-panel').querySelector('.detail-original').textContent='Botânica · modelo 3D'}
  else if(raw?.system.startsWith('cyto-')){$('detail-panel').querySelector('.eyebrow').textContent='CITOLOGIA · FORMA E FUNÇÃO';$('detail-panel').querySelector('.detail-original').textContent='Citologia · modelo 3D ampliado'}
  else if(raw){const latin=lexicon[raw.name]?.la;$('detail-panel').querySelector('.detail-original').textContent=raw.system.startsWith('histo-')?'Histologia · modelo 3D do tecido':isStudyMode(raw.system)?(studyModels.get(raw.system)?.anatomicalReference?'Modelo anatômico de referência':studyModels.get(raw.system)?.authoredReconstruction?'Corte anatômico 3D':'Esquema funcional'):latin?'Termo latino: '+latin:raw.name.includes('?')?'':'Termo original: '+raw.name}
  if(selected.entryRoute){const note=document.createElement('p');note.className='entry-context-note';note.dataset.entryScope=selected.entryRoute.scope;note.textContent=selected.entryRoute.note;$('detail-panel').querySelector('.detail-original').after(note);if(!hasMesh){$('detail-panel').querySelector('.model-availability').textContent=selected.entryRoute.scope==='context'?'Esta vista oferece contexto do tecido; a estrutura pedida ainda não possui geometria própria aqui.':'Esta entrada abre uma vista do conjunto. Escolha uma parte abaixo para destacar e explorar sua geometria.';$('focus-part').disabled=false;$('focus-part').textContent='Vista completa'}}
  if(raw?.customInfo?.representationNote){const note=document.createElement('p');note.className='learning-scope-note';note.dataset.partRepresentation='';note.textContent=raw.customInfo.representationNote;$('detail-panel').querySelector('.detail-original').after(note)}
  if(raw?.customInfo?.geometryIdentified===false){$('detail-panel').querySelector('.model-availability').textContent='A função desta estrutura está disponível abaixo. Sua geometria individual não foi identificada no arquivo de referência; não foi acrescentada uma peça artificial.'}
  if(raw?.customInfo?.annotationOnly){const cavity=raw.customInfo.annotationKind==='cavity-boundary';$('isolate-part').disabled=!cavity;$('hide-part').disabled=!cavity;if(cavity){$('isolate-part').textContent=state.isolated?'Mostrar contexto':'Isolar contorno';$('hide-part').textContent='Ocultar contorno'}$('focus-part').disabled=false;$('focus-part').textContent=cavity?'Aproximar o espaço':'Ver área marcada';const opacity=$('detail-panel').querySelector('.opacity-control');if(opacity)opacity.hidden=true;$('detail-panel').querySelector('.detail-original').textContent=cavity?'Contorno de uma cavidade: o espaço vazio, não um tecido':'Ponto marcado no modelo · esta região não é uma peça separada';if(cavity){const availability=$('detail-panel').querySelector('.model-availability');if(availability)availability.textContent='A luz é o espaço vazio delimitado pela parede. O contorno sinaliza sua localização; não representa tecido nem preenche a cavidade.'}}
  $('focus-part').addEventListener('click',()=>{if(selected.entryRoute&&!state.selectedNames.size){fitBody();return}if(raw?.customInfo?.annotationCamera){const pose=raw.customInfo.annotationCamera;moveCamera(pose.target,pose.eye);return}const bounds=new THREE.Box3();for(const n of state.selectedNames){const o=state.registry.get(n)?.object;if(o)bounds.union(new THREE.Box3().setFromObject(o))}if(!bounds.isEmpty())fitBounds(bounds)});
  $('isolate-part').addEventListener('click',()=>{state.isolated=state.isolated===null?new Set(state.selectedNames):null;applyVisibility();$('isolate-part').textContent=state.isolated?'Mostrar contexto':raw?.customInfo?.annotationKind==='cavity-boundary'?'Isolar contorno':'Isolar'});
  $('hide-part').addEventListener('click',()=>{for(const n of state.selectedNames)state.hidden.add(n);state.isolated=null;applyVisibility();toast('Estrutura ocultada. Use Restaurar para exibi-la novamente.')});
  $('restore-body').addEventListener('click',()=>{state.hidden.clear();state.isolated=null;state.opacity=1;$('clip-mode').value='none';if($('part-opacity'))$('part-opacity').value=100;applyVisibility();fitBody();$('isolate-part').textContent=raw?.customInfo?.annotationKind==='cavity-boundary'?'Isolar contorno':'Isolar'});
  $('part-opacity')?.addEventListener('input',e=>{state.opacity=Number(e.target.value)/100;applyVisibility()});
  $('selected-label').hidden=!hasMesh;$('selected-label').innerHTML=escapeHtml(name)+'<small>'+escapeHtml(info.shortFunction||functionText)+'</small>';
  const learning=info.learningDetails;
  if(learning?.mechanism)$('detail-panel').querySelector('.mechanism p').textContent=learning.mechanism;
  if(learning?.descriptionScope==='regional-context'||learning?.descriptionScope==='identity-review'){
    $('detail-panel').querySelector('.mechanism h3').textContent='Fisiologia relacionada à região';
    const scope=document.createElement('p');scope.className='learning-scope-note';scope.dataset.descriptionScope=learning.descriptionScope;scope.textContent=learning.descriptionScope==='identity-review'?'A identificação específica desta peça está em revisão. A explicação abaixo apresenta o contexto do órgão; não atribui uma função exclusiva à estrutura não confirmada.':'Esta peça identifica uma subdivisão anatômica. A explicação abaixo apresenta o contexto funcional do tecido e do órgão, sem uma função exclusiva revisada para esta região.';$('detail-panel').querySelector('.detail-controls').after(scope);
    $('detail-panel').querySelector('.detail-block:not(.mechanism):not(.uerj):not(.mistake) h3').textContent='Papel no contexto do órgão';
  }
  learningDetails?.appendPart($('detail-panel'),learning,{includeMechanism:false});
  appendStudyDetail(core,raw);
  $('detail-panel').dataset.selectionKey=selected.key;if(resetDetailScroll)$('detail-panel').scrollTop=0;
  updateStudyPath();
}

function studySnapshot(){return{mode:state.mode,organId:state.studyOrgan,selection:studySelectionContext(state.selected),coreSelectionId:state.selected?.isCore?state.selected.core.id:null,label:state.selected?.isCore?state.selected.core.name:state.selected?.raw?.pt||studyDefinition(state.mode)?.label||studyDefinition(state.mode)?.title||'Corpo',arrival:activeArrival?{...activeArrival}:null}}
async function followStudyConnection(link){
  if(!studyConnections?.destination(link))return false;
  const savedFocus=interactionFocus();
  const origin=studySnapshot(),before=studyTrail.slice(),token=++connectionVersion;
  const opened=await openStudy(link.viewId,origin.organId,{contentPartId:link.partId},{preserveTrail:true});
  if(token!==connectionVersion||!opened)return false;
  studyTrail=[...before,origin].slice(-16);activeArrival={fromLabel:origin.label,relation:link.relation||'',scope:link.scope||'context'};
  if(state.selected)renderDetail();else resetDetail();updateStudyPath();restoreInteractionFocus(savedFocus);rememberStudy();return true;
}
async function returnStudyConnection(index=studyTrail.length-1){
  const frame=studyTrail[index];if(!frame)return false;const token=++connectionVersion,before=studyTrail.slice();
  const savedFocus=interactionFocus();
  const opened=frame.coreSelectionId&&state.coreMap.has(frame.coreSelectionId)?await selectItem(frame.coreSelectionId,true,false,{preserveTrail:true}):isStudyMode(frame.mode)?await openStudy(frame.mode,frame.organId,frame.selection,{preserveTrail:true,allowAlternative:false}):await switchModel(frame.mode,null,{preserveTrail:true});
  if(token!==connectionVersion||!opened)return false;
  if(!frame.coreSelectionId&&!isStudyMode(frame.mode)&&frame.selection){const raw=state.registry.get(frame.selection.key);if(raw)await selectItem(raw.name,false,false,{preserveTrail:true});else if(frame.selection.coreId)await selectItem(frame.selection.coreId,true,false,{preserveTrail:true})}
  if(token!==connectionVersion)return false;studyTrail=before.slice(0,index);activeArrival=frame.arrival;if(state.selected)renderDetail();else resetDetail();updateStudyPath();restoreInteractionFocus(savedFocus);rememberStudy();return true;
}
function appendConnectionPanel(mode){
  const panel=$('detail-panel'),block=document.createElement('section');block.className='study-connections';block.dataset.studyConnections=mode;
  const heading=document.createElement('h3');heading.textContent=mode.startsWith('botany-')?'Órgão vegetal → tecido → célula':'Órgão → tecido → célula';block.append(heading);
  if(studyTrail.length){const path=document.createElement('nav');path.className='study-connection-path';path.setAttribute('aria-label','Retornar à estrutura de origem');studyTrail.forEach((frame,index)=>{const button=document.createElement('button');button.type='button';button.textContent=frame.label;button.dataset.studyOrigin=String(index);button.addEventListener('click',()=>returnStudyConnection(index));path.append(button)});block.append(path)}
  if(activeArrival?.relation){const relation=document.createElement('p');relation.className='study-connection-relation';relation.dataset.connectionRelation='';relation.textContent=activeArrival.fromLabel+' → '+activeArrival.relation;block.append(relation)}
  const record=studyConnections?.resolve(mode,state.selected?.raw?.customInfo);
  for(const link of record?.links||[]){const target=studyConnections.destination(link),card=document.createElement('article'),button=document.createElement('button'),relation=document.createElement('p'),scope=document.createElement('small');card.className='study-connection-card';button.type='button';button.textContent=(link.viewId.startsWith('botany-')?'Vegetal: ':link.viewId.startsWith('histo-')?'Tecido: ':'Célula e mecanismo: ')+link.label;button.dataset.connectionView=link.viewId;button.dataset.connectionPart=link.partId;if(link.viewId.startsWith('botany-'))button.dataset.botanyLink=link.viewId.slice(7);else if(link.viewId.startsWith('histo-'))button.dataset.histoLink=link.viewId.slice(6);else button.dataset.cytoLink=link.viewId.slice(5);button.title=target.view.title||target.view.label;button.addEventListener('click',()=>followStudyConnection(link));relation.textContent=link.relation;scope.textContent={component:'Componente em detalhe',composition:'Composição histológica',structure:'Contribuição da estrutura',organ:'Organização do órgão',tissue:'Composição do tecido',process:'Mecanismo relacionado',mechanism:'Mecanismo relacionado',context:'Contexto funcional'}[record.scope==='context'?'context':link.scope]||'Relação funcional';card.append(button,scope,relation);block.append(card)}
  const organ=studyOrgan(state.studyOrgan);if(organ&&!mode.startsWith('internal-')){const button=document.createElement('button');button.type='button';button.className='study-organ-return';button.dataset.organLink=organ.id;button.textContent='Voltar à estrutura no órgão';button.addEventListener('click',()=>{const index=studyTrail.findIndex(f=>f.mode==='internal-'+organ.id);if(index>=0)returnStudyConnection(index);else openStudy('internal-'+organ.id,organ.id,organSelectionContexts.get(organ.id)||null)});block.append(button)}
  if(!block.querySelector('button')&&!activeArrival)return;
  const controls=panel.querySelector('.detail-controls');if(controls)controls.before(block);else panel.append(block);
}
function appendStudyDetail(core,raw){
  const mode=raw&&isStudyMode(raw.system)?raw.system:isStudyMode(state.mode)?state.mode:null;
  if(mode){appendConnectionPanel(mode);appendStudyParts(mode)}
  else{const organ=relatedOrgan(core);if(organ){const block=document.createElement('div'),button=document.createElement('button');block.className='study-links';button.textContent='Ver '+organ.label.toLowerCase()+' por dentro';button.dataset.organLink=organ.id;button.addEventListener('click',()=>openStudy('internal-'+organ.id,organ.id,studySelectionContext(state.selected)));block.append(button);$('detail-panel').append(block)}}
  const urls=raw?.customInfo?.sourceUrls||[];if(urls.length){const sources=document.createElement('p');sources.className='study-sources';sources.append('Fontes da função: ');for(const [i,url]of[...new Set(urls)].entries()){if(i)sources.append(' · ');const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noreferrer';link.textContent='Referência '+(i+1);sources.append(link)}$('detail-panel').append(sources)}
}
function appendStudyParts(mode){
  const model=studyModels.get(mode),definition=studyDefinition(mode);if(!model)return;
  if(model.finishUnavailable){const block=document.createElement('div'),button=document.createElement('button');block.className='surface-retry';block.setAttribute('role','status');block.append('A geometria e as descrições estão disponíveis. O acabamento detalhado não carregou. ');button.type='button';button.textContent='Tentar acabamento novamente';button.dataset.retrySurface=mode;button.addEventListener('click',async()=>{button.disabled=true;const context=studySelectionContext(state.selected),coreId=state.selected?.isCore?state.selected.core.id:null,organId=state.studyOrgan;removeStudyModel(mode);const opened=await openStudy(mode,organId,coreId?null:context,{preserveTrail:true});if(opened&&coreId)await selectItem(coreId,true,false,{preserveTrail:true})});block.append(button);$('detail-panel').append(block)}
  learningDetails?.appendProfile($('detail-panel'),mode,{expanded:!state.selected});learningDetails?.appendMicroscopy($('detail-panel'),mode,{onAnnotation:(annotation,slide)=>followStudyConnection({viewId:/^(?:histo|cyto|botany)-/.test(annotation.viewId)?annotation.viewId:'histo-'+annotation.viewId,partId:annotation.partId,relation:'Comparação com a imagem '+slide.label+': '+annotation.description,scope:'component'})});
  if(mode.startsWith('cyto-'))appendCytologyLearning(definition);
  if(mode.startsWith('botany-'))appendBotanyLearning(definition);
  if(mode.startsWith('syst-'))appendSystematicsLearning(definition);
  if(mode.startsWith('histo-')&&(definition.recognition||definition.contrast)){const hint=document.createElement('div');hint.className='detail-block';hint.innerHTML='<h3>Como reconhecer o tecido</h3>';const description=document.createElement('p');description.textContent=definition.recognition||'';hint.append(description);if(definition.contrast){const comparison=document.createElement('p');comparison.textContent=definition.contrast;hint.append(comparison)}$('detail-panel').append(hint)}
  const block=document.createElement('div');block.className='study-parts';block.innerHTML='<h3>Selecione uma parte</h3><div class="study-parts-list"></div>';
  for(const part of model.parts){const button=document.createElement('button'),missing=part.geometryIdentified===false,cavity=part.annotationKind==='cavity-boundary',canOpenCut=interiorSpec(mode)&&model.viewRepresentation!=='detailed';button.textContent=(part.label||part.pt||part.name)+(cavity?' · contorno':missing?' · '+(canOpenCut?'abrir corte':'conteúdo'):'');button.dataset.part=part.registryName;button.classList.toggle('active',state.selected?.key===part.registryName);if(missing){button.dataset.geometryMissing='true';button.title=cavity?'Sinalizar o espaço vazio delimitado pela parede':canOpenCut?'Abrir a geometria desta estrutura no corte anatômico detalhado':'Descrição disponível; esta vista não possui a geometria individual desta estrutura'}button.addEventListener('click',()=>selectItem(part.registryName,false,false));block.lastElementChild.append(button)}
  $('detail-panel').append(block);
  if(mode==='internal-heart'&&model.viewRepresentation==='reference'){const direct=document.createElement('button');direct.className='study-direct-selection';direct.textContent='Selecionar peças anatômicas diretamente';direct.addEventListener('click',()=>changeStudyRepresentation('segmented'));$('detail-panel').append(direct)}
  if(mode.startsWith('internal-')){const represented=new Set(model.parts.filter(p=>p.geometryIdentified!==false&&!p.annotationOnly).map(p=>p.contentPartId||p.id)),annotated=new Set(model.parts.filter(p=>p.annotationOnly).map(p=>p.contentPartId||p.id)),missing=(definition.internalParts||[]).filter(p=>!represented.has(p.id)&&!annotated.has(p.id)),coverage=document.createElement('details');coverage.className='learning-profile model-coverage';coverage.dataset.modelCoverage=definition.id;const summary=document.createElement('summary');summary.textContent='Cobertura das estruturas internas';const text=document.createElement('p');text.textContent=model.authoredReconstruction?'Este corte possui '+represented.size+' componentes com geometria própria e selecionável'+(model.parts.some(p=>p.annotationOnly)?' e '+model.parts.filter(p=>p.annotationOnly).length+' indicação de espaço ou marcador educativo':'')+'. É uma reconstrução educacional, com cortes e proporções de leitura.':missing.length+' de '+definition.internalParts.length+' entradas do catálogo não têm geometria própria identificada nesta vista. A referência pode representar principalmente superfícies ou regiões. A existência de conteúdo não significa que a estrutura está modelada.';coverage.append(summary,text);if(missing.length){const list=document.createElement('p');list.textContent='Sem geometria individual nesta vista: '+missing.map(p=>p.label).join('; ')+'.';coverage.append(list)}const link=document.createElement('a');link.href='./COBERTURA-MODELOS.md';link.target='_blank';link.rel='noreferrer';link.textContent='Conferir cobertura e limites dos 51 órgãos';coverage.append(link);$('detail-panel').append(coverage)}
  const note=document.createElement('p');note.className='study-representation';note.textContent=model.limits||definition?.representation||'Modelo didático ampliado. Cores, cortes, quantidades e proporções ajudam a distinguir estruturas; não são uma reconstrução individual nem uma lâmina de microscopia.';$('detail-panel').append(note);
  if(model.sourceUrl){const citation=document.createElement('p');citation.className='study-sources';citation.append('Origem da geometria: ');const link=document.createElement('a');link.href=model.sourceUrl;link.target='_blank';link.rel='noreferrer';link.textContent=model.citation||'Modelo anatômico de referência';citation.append(link);if(model.license?.url){citation.append(' · ');const license=document.createElement('a');license.href=model.license.url;license.target='_blank';license.rel='noreferrer';license.textContent=model.license.id;citation.append(license)}$('detail-panel').append(citation)}
  const sourceIds=new Set([...(definition?.sourceIds||[]),...(definition?.internalParts||definition?.parts||[]).flatMap(p=>p.sourceIds||[])]);
  const sources=(mode.startsWith('syst-')?systematicsContent.sources:mode.startsWith('botany-')?botanyContent.sources:mode.startsWith('cyto-')?cytologyContent?.sources||[]:studyContent?.sources||[]).filter(s=>sourceIds.has(s.id));if(sources.length){const links=document.createElement('p');links.className='study-sources';links.append('Referências: ');for(const [i,s] of sources.entries()){if(i)links.append(' · ');const a=document.createElement('a');a.href=s.url;a.target='_blank';a.rel='noreferrer';a.textContent=s.title;links.append(a)}$('detail-panel').append(links)}
}
function appendBotanyLearning(definition){
  const panel=$('detail-panel'),section=document.createElement('section');section.className='cytology-learning botany-learning';const heading=document.createElement('h3');heading.textContent='Organização e fisiologia do conjunto';section.append(heading);for(const text of definition.keyIdeas||[]){const p=document.createElement('p');p.textContent=text;section.append(p)}if(definition.recognition){const h=document.createElement('h4');h.textContent='Como reconhecer e comparar';const p=document.createElement('p');p.textContent=definition.recognition;section.append(h,p)}const note=document.createElement('p');note.className='study-representation';note.textContent='Modelo educativo de angiospermas. As cores e os planos de corte facilitam a identificação dos tecidos; proporções e organização variam entre espécies.';section.append(note);panel.append(section);
}
function appendCytologyLearning(definition){
  const panel=$('detail-panel');
  appendCytologyCalculator(definition.id,panel);
  if(definition.keyIdeas?.length){const block=document.createElement('div');block.className='detail-block cytology-ideas';block.innerHTML='<h3>Ideias centrais</h3><ul>'+definition.keyIdeas.map(text=>'<li>'+escapeHtml(text)+'</li>').join('')+'</ul>';panel.append(block)}
  if(definition.steps?.length){const block=document.createElement('div');block.className='detail-block cytology-sequence';block.innerHTML='<h3>Organização e sequência do processo</h3><ol>'+definition.steps.map(step=>'<li><strong>'+escapeHtml(step.title)+'</strong><p>'+escapeHtml(step.text)+'</p></li>').join('')+'</ol>';panel.append(block)}
  if(definition.recognition||definition.contrast){const block=document.createElement('div');block.className='detail-block';block.innerHTML='<h3>Como interpretar este esquema</h3><p>'+escapeHtml(definition.recognition||'')+'</p><p>'+escapeHtml(definition.contrast||'')+'</p>';panel.append(block)}
  for(const comparison of definition.comparisons||[]){const block=document.createElement('div');block.className='detail-block cytology-comparison';block.innerHTML='<h3>'+escapeHtml(comparison.label)+'</h3><ul>'+(comparison.items||[]).map(text=>'<li>'+escapeHtml(text)+'</li>').join('')+'</ul>';panel.append(block)}
  const links=document.createElement('div');links.className='study-links cytology-related';
  for(const id of definition.relatedViews||[]){const view=cytologyView(id);if(!view)continue;const button=document.createElement('button');button.textContent=view.title;button.dataset.cytoLink=id;button.addEventListener('click',()=>{const part=view.parts?.[0];if(part)followStudyConnection({viewId:'cyto-'+id,partId:part.id,relation:'Vista complementar: '+(view.description||view.title),scope:'context'})});links.append(button)}
  for(const id of definition.histologyIds||[]){const tissue=studyTissue(id);if(!tissue)continue;const button=document.createElement('button');button.textContent='Histologia: '+(tissue.title||tissue.label);button.dataset.histoLink=id;button.addEventListener('click',()=>{const origin=studyTrail.findLastIndex(f=>f.mode==='histo-'+id);if(origin>=0)returnStudyConnection(origin);else if(tissue.parts?.[0])followStudyConnection({viewId:'histo-'+id,partId:tissue.parts[0].id,relation:'Tecido relacionado à vista celular selecionada.',scope:'context'})});links.append(button)}
  if(links.childNodes.length)panel.append(links);
}
function appendCytologyCalculator(id,panel){
  if(['cell-cycle','mitosis','meiosis','gametogenesis'].includes(id)){
    const block=document.createElement('div');block.className='cytology-calculator';block.innerHTML='<h3>Cromossomos e quantidade de DNA</h3><label>Número haploide (n) <input data-haploid type="number" min="1" max="1000" step="1" value="23" inputmode="numeric"></label><p>Célula eucariótica diploide. n indica um conjunto de cromossomos; C indica a quantidade relativa de DNA de um genoma haploide não duplicado. A fase S duplica DNA e conserva o número de cromossomos.</p><div class="cytology-table" data-counts aria-live="polite"></div><p class="cytology-calc-note">Contagem por célula nos momentos indicados, pelo critério de centrômeros. Moléculas de DNA nuclear correspondem às cromátides deste modelo; DNA mitocondrial ou plastidial não entra na tabela. O n informado não muda a quantidade ilustrativa dos modelos 3D. Meiose I reduz a ploidia; a II separa cromátides. Na anáfase, a contagem depende do momento e da unidade considerada, por isso ela não está nesta tabela.</p>';
    const input=block.querySelector('[data-haploid]'),result=block.querySelector('[data-counts]');const update=()=>{try{const rows=chromosomeCounts(input.value);result.innerHTML='<table><caption>Contagem para n = '+fmt(Number(input.value))+'</caption><thead><tr><th scope="col">Momento</th><th scope="col">Ploidia / DNA</th><th scope="col">Cromossomos</th><th scope="col">Moléculas de DNA nuclear</th></tr></thead><tbody>'+rows.map(r=>'<tr><th scope="row">'+escapeHtml(r.phase)+'</th><td>'+r.ploidy+' / '+r.dnaContent+'</td><td>'+fmt(r.chromosomes)+'</td><td>'+fmt(r.nuclearDNAMolecules)+'</td></tr>').join('')+'</tbody></table>'}catch(error){result.textContent=error.message}};input.addEventListener('input',update);update();panel.append(block);
  }
  if(id==='cell-theory-microscopy'){
    const block=document.createElement('div');block.className='cytology-calculator';block.innerHTML='<h3>Ampliação da representação</h3><label>Tamanho na imagem (mm) <input data-image-size type="number" min="0.001" step="any" value="50" inputmode="decimal"></label><label>Tamanho real (µm) <input data-object-size type="number" min="0.001" step="any" value="20" inputmode="decimal"></label><output data-magnification aria-live="polite"></output><p>Ampliação = tamanho da imagem ÷ tamanho real, usando a mesma unidade. 1 mm = 1000 µm. Aumentar a imagem não melhora a resolução. Se a representação for redimensionada, meça novamente; este cálculo não determina a ampliação óptica de um microscópio nem dá escala ao modelo 3D.</p>';
    const image=block.querySelector('[data-image-size]'),object=block.querySelector('[data-object-size]'),result=block.querySelector('[data-magnification]');const update=()=>{try{result.textContent=fmt(representationMagnification(image.value,object.value).magnification)+' ×'}catch(error){result.textContent=error.message}};image.addEventListener('input',update);object.addEventListener('input',update);update();panel.append(block);
  }
}
async function openStudy(mode,organId,context=null,{allowAlternative=true,preserveTrail=false}={}){
  if(!isStudyMode(mode)||!studyDefinition(mode))return false;
  if(mode.startsWith('histo-')&&state.mode.startsWith('internal-')){const id=state.mode.slice(9),selection=studySelectionContext(state.selected);if(selection)organSelectionContexts.set(id,selection);else organSelectionContexts.delete(id)}
  const opened=await switchModel(mode,null,{preserveTrail,organContext:organId});if(!opened)return false;
  if(context){const part=equivalentStudyPart(studyModels.get(mode)?.parts||[],context,studyDefinition(mode)?.primaryCoreId);
    if(allowAlternative&&interiorSpec(mode)&&studyRepresentationFor(mode)!=='detailed'&&part&&part.geometryIdentified===false){organRepresentations.set(mode,'detailed');removeStudyModel(mode);return openStudy(mode,organId,context,{allowAlternative,preserveTrail})}
    if(part)await selectItem(part.registryName,false,true,{allowAlternative});else toast('Esta vista não possui uma correspondência identificada da estrutura escolhida. Selecione uma parte pelos nomes.')}
  return true;
}
function histologyOrgans(id){return [...new Set([...(studyTissue(id)?.organIds||[]),...(studyContent?.organs||[]).filter(o=>o.histologyId===id||o.histologyIds?.includes(id)).map(o=>o.id)])]}
function trimStudyModels(keep){
  // Built models stay ready for quick returns; three on the iPad (each detailed cut is a few MB of geometry).
  const limit=touchDevice?3:4;let changed=false;
  for(const [mode,model] of studyModels){
    if(studyModels.size<=limit)break;if(mode===keep||mode===state.mode||mode===latestRequestedMode||modelLoading.has(mode))continue;
    clearMaterialCache(model.group);changed=true;
    const removed=new Set();model.group.traverse(o=>{if(o.isMesh){removed.add(o);meshSet.delete(o)}});allMeshObjects=allMeshObjects.filter(o=>!removed.has(o));
    for(const part of model.parts){state.registry.delete(part.registryName);state.hidden.delete(part.registryName)}
    scene.remove(model.group);releaseTissueFinish(model.group);model.dispose?.();studyModels.delete(mode);
  }
  return changed;
}
function removeStudyModel(mode){
  const model=studyModels.get(mode);if(!model)return;
  clearMaterialCache(model.group);const removed=new Set();model.group.traverse(o=>{if(o.isMesh){removed.add(o);meshSet.delete(o)}});allMeshObjects=allMeshObjects.filter(o=>!removed.has(o));
  for(const p of model.parts){state.registry.delete(p.registryName);state.hidden.delete(p.registryName)}
  scene.remove(model.group);releaseTissueFinish(model.group);model.dispose?.();studyModels.delete(mode);
}
async function changeStudyRepresentation(value){
  if(!state.mode.startsWith('internal-'))return;
  const mode=state.mode,version=++representationVersion;
  if(value==='detailed'&&!interiorSpec(state.mode)||value==='segmented'&&state.mode!=='internal-heart')value='reference';
  const context=studySelectionContext(state.selected);
  organRepresentations.set(mode,value);
  state.studyRepresentation=value;$('model-representation').value=value;$('model-representation').disabled=true;
  try{await Promise.allSettled([...modelLoading.values()]);if(version!==representationVersion||state.mode!==mode||latestRequestedMode!==mode)return;removeStudyModel(mode);await openStudy(mode,undefined,context,{allowAlternative:false});}
  finally{$('model-representation').disabled=false}
}
function initPicking(){
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),world=new THREE.Vector3(),projected=new THREE.Vector3(),viewPoint=new THREE.Vector3(),touchPointers=new Set();let down=null,lastHover=0;
  function pick(e){
    const rect=renderer.domElement.getBoundingClientRect();if(!rect.width||!rect.height)return null;
    pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
    const markers=pickCandidates.filter(mesh=>mesh.userData.educationalMarker);
    const exact=raycastVisible(raycaster,markers,renderer.clippingPlanes);if(exact)return state.registry.get(exact.object.userData.atlasName);
    const radius=e.pointerType==='touch'||touchDevice?24:12;let nearest=null,distance=radius*radius;
    for(const marker of markers){marker.getWorldPosition(world);if(renderer.clippingPlanes.some(p=>p.distanceToPoint(world)<0))continue;viewPoint.copy(world).applyMatrix4(camera.matrixWorldInverse);if(viewPoint.z>=0)continue;projected.copy(world).project(camera);if(projected.z<-1||projected.z>1||Math.abs(projected.x)>1||Math.abs(projected.y)>1)continue;const dx=e.clientX-(rect.left+(projected.x+1)*rect.width/2),dy=e.clientY-(rect.top+(1-projected.y)*rect.height/2),d=dx*dx+dy*dy;if(d<distance){distance=d;nearest=marker}}
    if(nearest)return state.registry.get(nearest.userData.atlasName);
    // A translucent source surface (the HRA skin, clear parts of the eye) lets the tap reach what shows through it.
    let candidates=pickCandidates,hit=raycastVisible(raycaster,candidates,renderer.clippingPlanes);
    for(let i=0;i<3&&hit&&[].concat(hit.object.userData.originalMaterial||[]).every(m=>m.transparent&&m.opacity<.8);i++){candidates=candidates.filter(m=>m!==hit.object);const behind=raycastVisible(raycaster,candidates,renderer.clippingPlanes);if(!behind)break;hit=behind}
    return hit?state.registry.get(hit.object.userData.atlasName):null;
  }
  raycaster.layers.enable(BATCHED_LAYER);
  // Also available for reproducible local selection measurements.
  renderer.domElement.atlasPick=pick;
  // Diagnostics: triangles and size of every mesh of one body system.
  renderer.domElement.atlasMeshReport=system=>{const out=[];const box=new THREE.Box3(),size=new THREE.Vector3();state.groups[system]?.traverse(m=>{if(!m.isMesh)return;const g=m.geometry;box.copy(g.boundingBox||(g.computeBoundingBox(),g.boundingBox)).applyMatrix4(m.matrixWorld);out.push([Math.round((g.index?g.index.count:g.attributes.position.count)/3),+box.getSize(size).length().toFixed(4),g.attributes.position.count])});return out};
  // Verification: pixel difference between the batched frame and the same frame drawn mesh by mesh.
  // Verification: JPEG of the current view at a fixed size, full geometry next to the lighter motion copies.
  renderer.domElement.atlasCaptureLod=(width=1080,height=740,crop=[.3,.04,.4,.92])=>{const size=renderer.getSize(new THREE.Vector2()),ratio=renderer.getPixelRatio(),aspect=camera.aspect;renderer.setPixelRatio(1);renderer.setSize(width,height,false);camera.aspect=width/height;camera.clearViewOffset();const [cx,cy,cw,ch]=crop.map((v,i)=>Math.round(v*(i%2?height:width))),out=document.createElement('canvas');out.width=cw*2+6;out.height=ch;const ctx=out.getContext('2d');ctx.fillStyle='#16222f';ctx.fillRect(0,0,out.width,out.height);for(const [i,flag] of [[0,false],[1,true]]){renderBatches.forceDetail(flag);renderer.render(scene,camera);ctx.drawImage(renderer.domElement,cx,cy,cw,ch,i*(cw+6),0,cw,ch)}renderBatches.forceDetail(false);renderer.setPixelRatio(ratio);renderer.setSize(size.x,size.y,false);camera.aspect=aspect;applyViewOffset();renderer.render(scene,camera);return out.toDataURL('image/jpeg',.85)};
  // Verification: the same frame with full geometry and with the lighter motion copies forced on.
  renderer.domElement.atlasCompareLod=()=>{const gl=renderer.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,read=()=>{renderer.render(scene,camera);const p=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,p);return{p,triangles:renderer.info.render.triangles,calls:renderer.info.render.calls}};renderBatches.forceDetail(false);const a=read();renderBatches.forceDetail(true);const b=read();renderBatches.forceDetail(false);renderer.render(scene,camera);let changed=0,covered=0,diff=0;for(let i=0;i<a.p.length;i+=4){const d=Math.abs(a.p[i]-b.p[i])+Math.abs(a.p[i+1]-b.p[i+1])+Math.abs(a.p[i+2]-b.p[i+2])+Math.abs(a.p[i+3]-b.p[i+3]);diff+=d;if(d>40)changed++;if(a.p[i+3]>0)covered++}return{trianglesFull:a.triangles,trianglesLod:b.triangles,callsFull:a.calls,callsLod:b.calls,coveredByModel:covered,changedPixels:changed,meanDiff:+(diff/(w*h)).toFixed(3),...renderBatches.lodStats()}};
  renderer.domElement.atlasCompareBatches=()=>{const gl=renderer.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,read=()=>{renderer.render(scene,camera);const p=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,p);return{p,calls:renderer.info.render.calls}};const a=read();renderBatches.bypass(true);const b=read();renderBatches.bypass(false);let diff=0,changed=0,covered=0;for(let i=0;i<a.p.length;i+=4){const d=Math.abs(a.p[i]-b.p[i])+Math.abs(a.p[i+1]-b.p[i+1])+Math.abs(a.p[i+2]-b.p[i+2])+Math.abs(a.p[i+3]-b.p[i+3]);diff+=d;if(d>12)changed++;if(b.p[i+3]>0)covered++}return{pixels:w*h,coveredByModel:covered,changedPixels:changed,meanDiff:+(diff/(w*h)).toFixed(3),callsBatched:a.calls,callsIndividual:b.calls}};
  // Verification: a frame drawn through the reduced-resolution motion path against the direct full-resolution frame.
  renderer.domElement.atlasCompareMotion=(ratio=.75)=>{
    const gl=renderer.getContext(),q=renderQuality,keep={motion:q.motion,moving:q.moving},W=gl.drawingBufferWidth,H=gl.drawingBufferHeight;
    const read=()=>{const p=new Uint8Array(W*H*4);gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,p);return p};
    q.moving=false;drawScene();const direct=read();q.motion=ratio;q.moving=true;drawScene();const motion=read();Object.assign(q,keep);drawScene();
    let covA=0,covB=0,changed=0,sumA=[0,0,0],sumB=[0,0,0];
    for(let i=0;i<direct.length;i+=4){if(direct[i+3]>8){covA++;for(let k=0;k<3;k++)sumA[k]+=direct[i+k]}if(motion[i+3]>8){covB++;for(let k=0;k<3;k++)sumB[k]+=motion[i+k]}let d=0;for(let k=0;k<4;k++)d+=Math.abs(direct[i+k]-motion[i+k]);if(d>40)changed++}
    return{coverageDirect:covA,coverageMotion:covB,avgDirect:sumA.map(v=>Math.round(v/(covA||1))),avgMotion:sumB.map(v=>Math.round(v/(covB||1))),changedPixels:changed}};
  // Synchronous frame measurement (draw calls, CPU submit time) that works even when the page is not painting.
  renderer.domElement.atlasRenderStats=(frames=20)=>{if(tween){camera.position.copy(tween.toPosition);controls.target.copy(tween.toTarget);controls.update();tween=null}selectionFade.value=1;const t=performance.now();for(let i=0;i<frames;i++){if(controls.autoRotate)controls.update();drawScene()}renderer.getContext().finish();const systems={};for(const r of state.registry.values()){if(!r.object)continue;let visible=r.object.visible;for(let p=r.object.parent;p&&visible;p=p.parent)visible=p.visible;if(!visible)continue;const e=systems[r.system]||(systems[r.system]={meshes:0,triangles:0,transparent:0});r.object.traverse(m=>{if(!m.isMesh||!m.visible)return;e.meshes++;const g=m.geometry;e.triangles+=(g.index?g.index.count:g.attributes.position.count)/3;if([].concat(m.material).some(x=>x.transparent))e.transparent++})}return{msPerFrame:+((performance.now()-t)/frames).toFixed(2),ratio:renderer.getPixelRatio(),batches:renderBatches.stats(),...renderer.info.render,systems}};
  renderer.domElement.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'){touchPointers.add(e.pointerId);if(touchPointers.size>1||e.isPrimary===false){down=null;$('hover-label').hidden=true;return}}down={id:e.pointerId,x:e.clientX,y:e.clientY,time:performance.now(),moved:false};$('hover-label').hidden=true});
  renderer.domElement.addEventListener('pointercancel',e=>{touchPointers.delete(e.pointerId);down=null});
  renderer.domElement.addEventListener('pointerup',e=>{if(down&&!down.moved&&down.id===e.pointerId&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<5&&performance.now()-down.time<800&&e.button===0){const hit=pick(e);if(hit)selectItem(hit.name,false,false)}touchPointers.delete(e.pointerId);down=null});
  renderer.domElement.addEventListener('pointermove',e=>{if(down&&down.id===e.pointerId&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>=5)down.moved=true;if(e.pointerType==='touch'||e.buttons||tween||performance.now()-lastHover<120)return;lastHover=performance.now();const hit=pick(e),label=$('hover-label');label.hidden=!hit;renderer.domElement.style.cursor=hit?'pointer':'grab';if(hit){label.textContent=hit.pt;const rect=$('viewport').getBoundingClientRect();label.style.left=Math.max(8,Math.min(e.clientX-rect.left+13,rect.width-Math.min(260,rect.width-16)-8))+'px';label.style.top=Math.max(8,e.clientY-rect.top-42)+'px'}});
  renderer.domElement.addEventListener('pointerleave',()=>$('hover-label').hidden=true);
}

async function ensureModelLoaded(mode){
  if(isStudyMode(mode)&&!studyModels.has(mode)){
    const definition=studyDefinition(mode);if(!definition)return;
    try{
      await nextPaint();
      const representation=studyRepresentationFor(mode),detailed=representation==='detailed'&&interiorSpec(mode);
      const sourcedHeart=mode==='internal-heart'&&representation==='reference';
      let anatomicalModel=null;
      if(mode.startsWith('internal-')&&!sourcedHeart&&!detailed&&representation!=='diagram'){
        const reference=await import('./reference-organ-models.js');
        if(reference.hasReferenceOrgan(definition.id,referenceCatalog))anatomicalModel=await reference.createReferenceOrganModel(definition,{loader,catalog:referenceCatalog,lexicon,partFunctions:referencePartFunctions,sourceGroups:state.groups});
      }
      const module=await import(detailed?detailed.module:sourcedHeart?'./heart-model.js':mode.startsWith('syst-')?'./systematics-models.js':mode.startsWith('botany-')?'./botany-models.js':mode.startsWith('cyto-')?'./cytology-models.js':definition.supplementary?'./supplementary-models.js':mode.startsWith('internal-')?'./internal-models.js':'./histology-models.js');
      const histology=mode.startsWith('histo-'),histologyOptions={mobile:touchDevice};
      let model;try{model=anatomicalModel||await (detailed?module[detailed.factory](definition,{mobile:touchDevice}):sourcedHeart?module.createHeartModel(definition,{loader}):mode.startsWith('syst-')?module.createSystematicsModel(definition.id,definition,{mobile:touchDevice}):mode.startsWith('botany-')?module.createBotanyModel(definition.id,definition,{mobile:touchDevice}):mode.startsWith('cyto-')?module.createCytologyModel(definition.id,definition,{mobile:touchDevice}):definition.supplementary?module.createSupplementaryModel(definition.id,definition,histology,histologyOptions):mode.startsWith('internal-')?module.createInternalModel(definition.id,definition):module.createHistologyModel(definition.id,definition,histologyOptions));}catch(error){if(!histology||definition.supplementary)throw error;model=await module.createHistologyModel(definition.id,definition,{...histologyOptions,textures:false});model.finishUnavailable=true;console.warn('Acabamento histológico indisponível; corte e conteúdo preservados.')}
      if(mode.startsWith('internal-'))model.viewRepresentation=representation;
      if(mode.startsWith('cyto-')||mode.startsWith('botany-')){
        const partRoles={sarcolemma:'membrane','t-tubules':'membrane','sarcoplasmic-reticulum':'membrane',myofibrils:'filament',mitochondria:'membrane',nucleus:'chromatin','intercalated-disc':'protein','gap-junctions':'protein','anchoring-junctions':'filament','calcium-channels':'protein','calcium-pump':'protein','thin-filaments':'filament','thick-filaments':'filament','troponin-tropomyosin':'protein','z-discs':'filament','m-line':'filament'};
        for(const part of model.parts)part.object.traverse(m=>{if(m.isMesh&&!m.userData.cytologyTissue)m.userData.cytologyTissue=partRoles[part.id]||'matrix'});
        let finish;try{const {applyCytologyMaterials}=await import('./cytology-materials.js');finish=await applyCytologyMaterials(model.group,{mobile:touchDevice})}catch(error){model.finishUnavailable=true;console.warn('Acabamento indisponível; geometria e conteúdo preservados.');}
        if(finish){const dispose=model.dispose;let released=false;model.dispose=()=>{if(released)return;released=true;dispose();finish.dispose()}}model.preserveMaterials=true;model.stats||={};Object.assign(model.stats,{textureResolution:finish?.textureResolution||0,sharedPBRAtlases:finish?3:0,continuousBiologicalSurfaces:true});
      }

      if(histology&&definition.supplementary){
        const {applyHistologyMaterials}=await import('./histology-materials.js');let finish;
        try{finish=await applyHistologyMaterials(model.group,histologyOptions)}catch(error){model.finishUnavailable=true;console.warn('Acabamento histológico indisponível; geometria preservada.')}
        if(finish){const dispose=model.dispose;let released=false;model.dispose=()=>{if(released)return;released=true;dispose();finish.dispose()}}model.preserveMaterials=true;model.stats.textureResolution=finish?.textureResolution||0;model.stats.sculptedVolumes=true;
        model.group.updateMatrixWorld(true);model.bounds=new THREE.Box3().setFromObject(model.group);
        let triangles=0,vertices=0,geometryBytes=0;model.group.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;vertices+=o.geometry.attributes.position.count;for(const a of Object.values(o.geometry.attributes))geometryBytes+=a.array.byteLength;geometryBytes+=o.geometry.index?.array.byteLength||0}});Object.assign(model.stats,{triangles,vertices,geometryBytes});
      }
      if(mode.startsWith('internal-')&&representation!=='diagram'&&!detailed&&!sourcedHeart&&!anatomicalModel)model.limits='A referência anatômica individual deste órgão ainda não está disponível nesta versão. Esta vista é um esquema funcional, com formas simplificadas. '+(model.limits||'');
      model.title||=definition.label||definition.title;model.description||=definition.description;model.group.visible=false;scene.add(model.group);model.group.updateMatrixWorld(true);
      if(!model.preserveMaterials)applyTissueFinish(model.group,{system:definition.system},surfaceOptions());
      const contentParts=definition.internalParts||definition.parts||[];
      for(const [i,part] of model.parts.entries()){
        const info=contentParts.find(p=>p.id===part.id)||contentParts.find(p=>p.name===part.name)||{};const raw=mode+':'+(part.id||part.name||i);part.registryName=raw;
        const detail=learningDetails?.partDetail(mode,part,definition);
        const customInfo={...info,...part,learningDetails:detail};delete customInfo.object;customInfo.shortFunction=customInfo.function;
        part.label=part.label||info.label||part.pt||part.name;part.object.userData.atlasName=raw;
        part.object.traverse(m=>{if(m.isMesh){m.userData.atlasName=raw;m.userData.originalMaterial=m.material;registerMesh(m)}});
        state.registry.set(raw,{name:raw,system:mode,pt:part.label,coreId:part.coreId||definition.primaryCoreId||definition.coreIds?.[0]||null,object:part.object,customInfo,search:normalise([part.label,customInfo.function].join(' '))});
      }
      freezeModel(model.group);studyModels.set(mode,model);
    }catch(error){console.error(error);toast('Não foi possível abrir esta vista. Tente novamente.');return}
  }
  if(mode.startsWith('micro-')&&!microModels.has(mode)){
    try{await nextPaint();const {buildMicroModel}=await import('./micro-models.js');const model=buildMicroModel(mode.slice(6));model.group.visible=false;scene.add(model.group);model.group.updateMatrixWorld(true);microModels.set(mode,model);
      for(const [i,part] of model.parts.entries()){const raw=mode+':'+(part.name||i);part.registryName=raw;part.object.userData.atlasName=raw;part.object.traverse(m=>{if(m.isMesh){m.userData.atlasName=raw;m.userData.originalMaterial=m.material;registerMesh(m)}});state.registry.set(raw,{name:raw,system:mode,pt:part.pt||part.name,coreId:part.coreId||null,object:part.object,customInfo:{...part,shortFunction:part.function},search:normalise([part.pt,part.name,part.coreId,part.function].join(' '))})}
      freezeModel(model.group);
    }catch(error){console.error(error);toast('Não foi possível abrir o esquema 3D.');return}
  }
  if(mode==='female'&&!femaleReady){
    if(!femaleBody){toast('Corpo feminino indisponível. O conteúdo fisiológico continua no catálogo.');return}
    try{await nextPaint();await Promise.all(bodyLayers('female').filter(id=>state.layers[id]).map(loadSystem));femaleReady=true}
    catch(error){console.error(error);toast('Corpo feminino indisponível. O conteúdo fisiológico continua no catálogo.');return}
  }
  }
async function switchModel(mode,selectionToken=null,{preserveTrail=false,organContext=undefined}={}){
  const entry=mode.startsWith('micro-')&&resolveStudyEntry(mode);if(entry)mode=entry.mode;
  latestRequestedMode=mode;
  const token=++modeVersion,selection=selectionToken??++selectionVersion;
  const cached=studyModels.get(mode);if(mode.startsWith('internal-')&&cached&&cached.viewRepresentation!==studyRepresentationFor(mode))removeStudyModel(mode);
  if(!modelLoading.has(mode))modelLoading.set(mode,ensureModelLoaded(mode));updateModelBusy();
  try{await modelLoading.get(mode)}catch{return false}finally{modelLoading.delete(mode);updateModelBusy()}
  if(token!==modeVersion||selection!==selectionVersion){if(trimStudyModels(state.mode)){rebuildSearch();applyVisibility();renderList()}return false}
  if(mode==='female'&&!femaleReady||mode.startsWith('micro-')&&!microModels.has(mode)||isStudyMode(mode)&&!studyModels.has(mode))return false;
  if(mode.startsWith('cyto-')&&!state.mode.startsWith('cyto-')){state.cytologyReturnMode=state.mode;cytologyOrigin=studySnapshot()}
  if(!preserveTrail){studyTrail=[];activeArrival=null;++connectionVersion;if(!isStudyMode(mode)){state.studyOrgan=null;cytologyOrigin=null;state.cytologyReturnMode='body'}}
  if(isStudyMode(mode)){
    const newTab=mode.startsWith('internal-')?'internal':mode.startsWith('cyto-')?'cytology':mode.startsWith('botany-')?'botany':mode.startsWith('syst-')?'systematics':'histology';if(state.tab!==newTab){state.search='';$('search').value=''}state.tab=newTab;
    if(mode.startsWith('internal-')){state.studyOrgan=mode.slice(9);state.studyRepresentation=studyModels.get(mode)?.viewRepresentation||studyRepresentationFor(mode);}
    else if(mode.startsWith('histo-')&&organContext===undefined&&!histologyOrgans(mode.slice(6)).includes(state.studyOrgan))state.studyOrgan=histologyOrgans(mode.slice(6))[0]||null;
    if(organContext!==undefined&&!mode.startsWith('internal-'))state.studyOrgan=organContext;
    if(mode.startsWith('botany-')||mode.startsWith('syst-'))state.studyOrgan=null;
  }else if(['internal','histology','cytology','botany'].includes(state.tab)){state.tab='core';state.search='';$('search').value=''}
  const bodyChanged=(state.mode==='female')!==(mode==='female');state.mode=mode;$('model-mode').value=mode;if(bodyChanged)renderLayers();const cut=clipSettings.get(clippingKey());$('clip-mode').value=cut?.mode||studyModels.get(mode)?.defaultClip||'none';$('clip-position').value=cut?.position||50;state.isolated=null;state.selectedNames.clear();state.selected=null;$('selected-label').hidden=true;
  trimStudyModels(mode);rebuildSearch();updateCatalogUi();resetDetail();applyVisibility();fitBody('front');warmUpScene();renderList();$('asset-status').textContent='Modelos locais · pronto para explorar';updateStudyPath();
  document.querySelector('.orientation-label').hidden=isDetailMode(mode);
  for(const b of document.querySelectorAll('[data-camera]'))b.textContent=(isDetailMode(mode)?{front:'Frente',back:'Verso',left:'Lateral'}:{front:'Anterior',back:'Posterior',left:'Lateral'})[b.dataset.camera];
  document.querySelector('.viewer-top .eyebrow').textContent=mode.startsWith('syst-')?'SISTEMÁTICA · ORGANISMO E FISIOLOGIA':mode.startsWith('botany-')?'BOTÂNICA · TECIDOS E FISIOLOGIA':mode.startsWith('cyto-')?'CITOLOGIA · ESTRUTURAS E PROCESSOS':mode.startsWith('histo-')?'HISTOLOGIA · CAMADAS E SUPERFÍCIES 3D':mode.startsWith('internal-')?(studyModels.get(mode)?.anatomicalReference?'MODELO ANATÔMICO DE REFERÊNCIA':studyModels.get(mode)?.authoredReconstruction?'CORTE ANATÔMICO DETALHADO':'ESTRUTURAS INTERNAS · ESQUEMA FUNCIONAL'):mode.startsWith('micro-')?'ESQUEMA DIDÁTICO 3D':'MODELO ANATÔMICO 3D';drawBoard?.setContext(mode);rememberStudy();return true;
}
function resetDetail(){
  const female=state.mode==='female';
  if(isStudyMode(state.mode)){
    const model=studyModels.get(state.mode);$('detail-panel').innerHTML=`<div class="detail-empty"><span class="eyebrow">${state.mode.startsWith('syst-')?'DOMÍNIO → GRUPO → ORGANISMO':state.mode.startsWith('botany-')?'ÓRGÃO VEGETAL → TECIDO → CÉLULA':state.mode.startsWith('cyto-')?'CÉLULA → ESTRUTURA → PROCESSO':state.mode.startsWith('histo-')?'TECIDO → CÉLULA → FUNÇÃO':'ÓRGÃO → ESTRUTURAS INTERNAS'}</span><h2>${escapeHtml(model.title)}</h2><p>${escapeHtml(model.description)}</p><p class="study-intro">Gire o modelo e selecione uma parte pelo toque ou pelos nomes abaixo. Cada parte explica sua função e a relação com ${state.mode.startsWith('syst-')?'a fisiologia do grupo':state.mode.startsWith('botany-')?'a fisiologia vegetal':state.mode.startsWith('cyto-')?'a organização e os processos celulares':'o funcionamento do órgão'}.</p></div>`;appendStudyDetail(null,{system:state.mode});return;
  }
  if(state.mode.startsWith('micro-')){const model=microModels.get(state.mode);$('detail-panel').innerHTML=`<div class="detail-empty"><span class="eyebrow">ESQUEMA DIDÁTICO 3D</span><h2>${escapeHtml(model.title)}</h2><p>${escapeHtml(model.description)}</p><div class="empty-tip">Selecione uma parte no modelo. As formas e dimensões são simplificadas para mostrar mecanismos; não são uma reconstrução histológica.</div></div>`;return}
  $('detail-panel').innerHTML=`<div class="detail-empty"><span class="eyebrow">ESTRUTURA → MECANISMO → FUNÇÃO</span><h2>${female?'Corpo feminino por sistemas.':'Explore além do nome.'}</h2><p>${female?'Modelo do Human Reference Atlas, feito a partir do Visible Human Female. Esqueleto parcial: faltam crânio, costelas e membros superiores; músculos só dos olhos e joelhos. Ative os sistemas em Camadas e clique em uma peça.':'Selecione uma parte para entender sua função e construir uma explicação causal.'}</p><button class="primary" id="empty-explore">${female?'Explorar o útero':'Explorar o coração'} →</button></div>`;
  $('empty-explore').addEventListener('click',()=>selectItem(female?'uterus':'heart',true));
}
async function export4K(){
  const button=$('export-4k');button.disabled=true;const W=3840,H=2160,scale=touchDevice?2/3:1,width=Math.round(W*scale),height=Math.round(H*scale);const previousSize=renderer.getSize(new THREE.Vector2()),ratio=renderer.getPixelRatio(),aspect=camera.aspect;const rotating=controls.autoRotate;controls.autoRotate=false;
  try{
    toast(`Preparando imagem de ${width} × ${height} pixels…`);
    renderer.setPixelRatio(1);renderer.setSize(width,height,false);camera.aspect=width/height;camera.clearViewOffset();renderer.render(scene,camera);drawOcclusion();
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');ctx.scale(scale,scale);
    const gradient=ctx.createRadialGradient(W*.5,H*.45,0,W*.5,H*.45,W*.65);gradient.addColorStop(0,'#233747');gradient.addColorStop(1,'#0c1420');ctx.fillStyle=gradient;ctx.fillRect(0,0,W,H);ctx.drawImage(renderer.domElement,0,0,W,H);
    const marker=selectedMarkerPosition(W,H);
    if(marker){ctx.save();ctx.strokeStyle=SELECTION_COLOR;ctx.lineWidth=5;ctx.shadowColor=SELECTION_COLOR;ctx.shadowBlur=18;ctx.beginPath();ctx.arc(marker.x,marker.y,24,0,Math.PI*2);ctx.stroke();ctx.restore()}
    ctx.fillStyle='#8bdcc4';ctx.font='500 40px "Segoe UI",system-ui,sans-serif';ctx.fillText('ATLAS HUMANO',90,110);ctx.fillStyle='#d6e6ed';ctx.font='32px "Segoe UI",system-ui,sans-serif';ctx.fillText($('model-caption').textContent,90,164);
    if(state.selected){const info=state.selected.raw?.customInfo||state.selected.core||familyInfo(state.selected.raw.name,state.selected.raw.system);const title=state.selected.isCore?info.name:state.selected.raw.pt;ctx.fillStyle='#e5edf3';ctx.font='500 52px "Segoe UI",system-ui,sans-serif';ctx.fillText(title,90,H-250);ctx.font='30px "Segoe UI",system-ui,sans-serif';wrapText(ctx,info.shortFunction||info.function,90,H-190,1400,44)}
    const exportModel=studyModels.get(state.mode);
    const credit=exportModel?.anatomicalReference?`Modelo: ${exportModel.citation} · ${exportModel.license.id} · Créditos completos no programa`:isDetailMode(state.mode)?'Modelo didático autoral · Quantidades, proporções e cores ilustrativas · Referências no programa':'Modelo: Z-Anatomy / BodyParts3D · Feminino: HuBMAP HRA · Uso educacional · Créditos completos no programa';
    ctx.fillStyle='#94abba';ctx.font='22px "Segoe UI",system-ui,sans-serif';wrapText(ctx,credit,90,H-70,W-180,27);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('Falha na exportação');const name='atlas-humano-'+(state.selected?.core?.id||'anatomia')+(touchDevice?'.png':'-4k.png');
    // iPad/iPhone: the share sheet offers "Salvar imagem"; downloads from an installed web app are unreliable there.
    const file=touchDevice&&typeof File==='function'?new File([blob],name,{type:'image/png'}):null;
    if(file&&navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:'Atlas Humano'});return}catch(error){if(error.name==='AbortError')return}}
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);toast(touchDevice?'Imagem salva.':'Imagem 4K salva.');
  }catch(error){console.error(error);toast('Não foi possível salvar a imagem. Reduza o número de camadas e tente novamente.')}
  finally{renderer.setPixelRatio(ratio);renderer.setSize(previousSize.x,previousSize.y,false);camera.aspect=aspect;applyViewOffset();controls.autoRotate=rotating;button.disabled=false;requestRender()}
}
// Relative (unitless) sliders read better as a level than as a bare number.
function relativeLevel(value,p){const f=(value-p.min)/((p.max-p.min)||1),level=f<.2?'muito baixo':f<.4?'baixo':f<.6?'médio':f<.8?'alto':'muito alto';return level[0].toUpperCase()+level.slice(1)+' · '+fmt(value)}
function wrapText(ctx,text,x,y,width,lineHeight){let line='';for(const word of String(text).split(' ')){const next=line+word+' ';if(ctx.measureText(next).width>width&&line){ctx.fillText(line,x,y);line=word+' ';y+=lineHeight}else line=next}ctx.fillText(line,x,y)}

function setView(view){
  state.view=view;document.querySelectorAll('.view').forEach(s=>s.hidden=s.id!=='view-'+view);document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-pressed',String(b.dataset.view===view))});
  updateCatalogUi();
  if(view!=='atlas')$('selected-marker').hidden=true;
  if(view==='atlas')requestAnimationFrame(resize);if(view==='physiology'&&!state.simulation)selectSimulation(0);if(view==='practice')renderQuestion();if(view==='about')renderAbout();
  history.replaceState(null,'','#'+view);
  rememberStudy();
}
// Caveats, scope notes and sources stay available but move into one collapsible block at the end of the details.
const MODEL_NOTE_SELECTOR='.learning-scope-note:not([data-description-scope]),.study-representation,.study-sources,.detail-footnote,.model-coverage';
function organizeModelNotes(){
  const panel=$('detail-panel'),notes=[...panel.querySelectorAll(MODEL_NOTE_SELECTOR)].filter(n=>!n.closest('.model-notes'));if(!notes.length)return;
  let box=panel.querySelector(':scope>.model-notes');
  if(!box){box=document.createElement('details');box.className='model-notes';const summary=document.createElement('summary');summary.textContent='Sobre este modelo e fontes';box.append(summary)}
  box.append(...notes);panel.append(box);
}
// Annotation board over the viewer (draw-board.js). The app supplies colour sampling and a snapshot of the 3D view.
let drawBoard=null;
function setupDrawBoard(){
  const canvas=renderer.domElement;let panel=null;
  const sample3D=(x,y)=>{renderer.render(scene,camera);const gl=renderer.getContext(),r=canvas.getBoundingClientRect(),d=new Uint8Array(4);gl.readPixels(Math.round((x-r.left)/r.width*gl.drawingBufferWidth),Math.round((1-(y-r.top)/r.height)*gl.drawingBufferHeight),1,1,gl.RGBA,gl.UNSIGNED_BYTE,d);requestRender();return d[3]>20?[0,1,2].map(i=>Math.min(255,d[i]*255/d[3])):null};
  const snapshot3D=()=>{drawScene();const copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;copy.getContext('2d').drawImage(canvas,0,0);requestRender();return copy};
  drawBoard=createDrawBoard({viewport:$('viewport'),panel:$('board-panel'),toggle:$('open-board'),sample3D,snapshot3D,onChange:kind=>{panel?.refresh();if(kind==='full')toast('A memória de anotações deste aparelho está cheia. Apague anotações de outros modelos.')}});
  panel=mountBoardPanel($('board-panel'),drawBoard,{surface:document.querySelector('.viewer-panel'),onClose:()=>drawBoard.setActive(false),onExport:async()=>{
    const blob=await drawBoard.exportImage();if(!blob){toast('Não foi possível gerar a imagem.');return}
    const name='atlas-humano-anotacoes-'+state.mode+'.png',file=touchDevice&&typeof File==='function'?new File([blob],name,{type:'image/png'}):null;
    if(file&&navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:'Atlas Humano'});return}catch(error){if(error.name==='AbortError')return}}
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);toast('Imagem com anotações salva.')}});
  $('open-board').addEventListener('click',()=>drawBoard.toggle());
  drawBoard.setContext(state.mode);
}
// Process animations (process-animations.js): the player asks the app to open the right model, then animates helper objects.
let processPlayer=null;
async function openProcessTarget(target){
  if(target.mode==='body'){
    if(state.mode!=='body'&&!await switchModel('body'))return false;
    for(const id of target.layers||[]){if(!state.layers[id]){state.layers[id]=true;renderLayers()}await loadSystem(id)}
    state.isolated=null;applyVisibility();requestRender();return state.mode==='body';
  }
  if(target.representation)organRepresentations.set(target.mode,target.representation);
  const ready=()=>state.mode===target.mode&&(!target.representation||studyModels.get(target.mode)?.viewRepresentation===target.representation);
  if(ready())return true;
  if(target.mode.startsWith('internal-')){if(state.mode===target.mode)await changeStudyRepresentation(target.representation);else await openStudy(target.mode,target.organ)}
  else await switchModel(target.mode);
  return ready();
}
function setupProcesses(){
  processPlayer=createProcessPlayer({bar:$('process-bar'),menu:$('process-menu'),toggle:$('open-process'),app:{
    scene,camera,renderer,viewport:$('viewport'),touchDevice,toast,requestRender,
    mode:()=>state.mode,registry:state.registry,studyModel:mode=>studyModels.get(mode),microModel:mode=>microModels.get(mode),
    open:openProcessTarget,// A tight frame zooms right onto a small region (the synapse) instead of keeping half of the model around it.
    frame:(box,tight)=>{if(!box){fitBody('front');return}if(!tight){fitBounds(box,'front');return}const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()),fit=Math.max(size.y/visibleFraction().y,size.x/(camera.aspect*visibleFraction().x))*.62/Math.tan(THREE.MathUtils.degToRad(camera.fov/2));moveCamera(center,center.clone().add(new THREE.Vector3(0,0,fit+size.z)))},
    layout:height=>{processInset=height;applyViewOffset();requestRender()},
    warm:()=>Promise.race([renderer.compileAsync(scene,camera),new Promise(resolve=>setTimeout(resolve,3000))]).catch(()=>{})}});
  // Verification: place the animation at a time (seconds) and draw that frame synchronously.
  renderer.domElement.atlasProcessFrame=t=>{const info=processPlayer.seekTo(t);drawScene();renderer.getContext().finish();return info};
}
function setupEvents(){
  new MutationObserver(organizeModelNotes).observe($('detail-panel'),{childList:true,subtree:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)requestRender()});
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.view==='atlas'&&['cytology','botany','systematics'].includes(state.tab)){setCatalogTab('core');switchModel('body')}setView(b.dataset.view)}));
  $('go-cytology').addEventListener('click',()=>{setView('atlas');setCatalogTab('cytology');if(!state.mode.startsWith('cyto-'))openStudy('cyto-animal-cell',null)});
  $('search').addEventListener('input',e=>{state.search=e.target.value;clearTimeout(searchTimer);searchTimer=setTimeout(renderList,90)});
  for(const tab of ['core','all','internal','histology','cytology','botany','systematics'])$(tab+'-tab').addEventListener('click',()=>setCatalogTab(tab));
  $('go-systematics').addEventListener('click',enterSystematics);
  $('go-botany').addEventListener('click',enterBotany);
  $('botany-category').addEventListener('change',e=>{state.botanyCategory=e.target.value;renderList()});
  $('study-system').addEventListener('change',e=>{state.studySystem=e.target.value;renderList()});
  $('cytology-category').addEventListener('change',e=>{state.cytologyCategory=e.target.value;renderList()});
  $('study-back').addEventListener('click',async()=>{if(studyTrail.length){await returnStudyConnection();return}if(state.mode.startsWith('cyto-')&&cytologyOrigin){const frame=cytologyOrigin;if(isStudyMode(frame.mode))await openStudy(frame.mode,frame.organId,frame.selection);else{await switchModel(frame.mode);if(frame.selection?.coreId)await selectItem(frame.selection.coreId,true,false)}return}const organ=studyOrgan(state.studyOrgan),coreId=organ?.primaryCoreId||organ?.coreIds?.[0];if(coreId&&state.coreMap.has(coreId))selectItem(coreId,true);else switchModel('body')});
  $('study-related').addEventListener('click',()=>{if(state.mode.startsWith('syst-')){const link=studyDefinition(state.mode)?.cytologyLink;if(link)openStudy('cyto-'+link.viewId);return}if(state.mode.startsWith('botany-')){const link=studyConnections?.resolve(state.mode,state.selected?.raw?.customInfo)?.links[0];if(link)followStudyConnection(link);return}if(state.mode.startsWith('cyto-')){const index=studyTrail.findLastIndex(f=>f.mode.startsWith('histo-')||f.mode.startsWith('botany-'));if(index>=0){returnStudyConnection(index);return}if(cytologyOrigin?.mode.startsWith('histo-')||cytologyOrigin?.mode.startsWith('botany-')){openStudy(cytologyOrigin.mode,cytologyOrigin.organId,cytologyOrigin.selection);return}const id=(studyDefinition(state.mode)?.histologyIds||[]).find(id=>studyTissue(id));if(id)openStudy('histo-'+id);return}if(state.mode.startsWith('internal-')){const link=studyConnections?.resolve(state.mode,state.selected?.raw?.customInfo)?.links.find(l=>l.viewId.startsWith('histo-'));if(link)followStudyConnection(link);return}const organ=studyOrgan(state.studyOrgan);if(organ){const index=studyTrail.findIndex(f=>f.mode==='internal-'+organ.id);if(index>=0)returnStudyConnection(index);else openStudy('internal-'+organ.id,organ.id,organSelectionContexts.get(organ.id)||null)}});
  $('start-heart').addEventListener('click',()=>{const heart=state.core.find(c=>c.id==='heart')||state.core.find(c=>/coração/i.test(c.name));if(heart)selectItem(heart.id,true)});
  document.querySelectorAll('[data-camera]').forEach(b=>b.addEventListener('click',()=>fitBody(b.dataset.camera)));
  $('fit-body').addEventListener('click',()=>fitBody());
  $('auto-rotate').addEventListener('click',()=>{controls.autoRotate=!controls.autoRotate;$('auto-rotate').setAttribute('aria-pressed',String(controls.autoRotate));requestRender()});
  $('export-4k').addEventListener('click',export4K);
  $('context-bones').addEventListener('change',applyVisibility);
  $('show-fps').addEventListener('change',e=>{$('fps-meter').hidden=!e.target.checked;requestRender()});
  $('ambient-occlusion').addEventListener('change',requestRender);
  $('tissue-colors').addEventListener('change',()=>{updateSurfaceQuality();toast($('tissue-colors').checked?'Paleta aproximada de tecido aplicada.':'Cores do acervo restauradas.')});
  $('quality').addEventListener('change',()=>{const q=renderQuality;q.rest=Number($('quality').value);q.motion=storedMotionRatio(q.rest);q.tooSlow.clear();renderer.setPixelRatio(q.rest);updateSurfaceQuality();resize();toast('Qualidade de visualização atualizada. A exportação continua em 4K.')});
  $('clip-mode').addEventListener('change',updateClipping);$('clip-position').addEventListener('input',updateClipping);
  $('model-mode').addEventListener('change',e=>switchModel(e.target.value));
  $('model-representation').addEventListener('change',e=>changeStudyRepresentation(e.target.value));
  $('toggle-layers').addEventListener('click',async()=>{
    const button=$('toggle-layers');button.disabled=true;++selectionVersion;
    try{const body=layerBody(),layers=bodyLayers(body);if(state.mode!==body)await switchModel(body);const all=layers.every(k=>state.layers[k]);for(const k of layers)state.layers[k]=!all;state.isolated=null;renderLayers();if(!all){toast('Carregando as camadas…');for(const k of layers)await loadSystem(k)}}
    catch{toast('Uma camada não carregou. Você pode tentar ativá-la novamente.')}
    finally{button.disabled=false;applyVisibility();renderLayers();renderList()}
  });
  $('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{toast('Use a opção de tela cheia do navegador.')}});
  document.addEventListener('keydown',e=>{if(e.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)){e.preventDefault();setView('atlas');$('search').focus()}if(e.key==='Escape'){state.isolated=null;applyVisibility()}});
  $('next-question').addEventListener('click',()=>{state.questionIndex++;renderQuestion();rememberStudy()});$('practice-system').addEventListener('change',()=>{state.questionIndex=0;renderQuestion();rememberStudy()});
}

function simulationEntries(){return Array.isArray(simulations)?simulations:simulations.modules||simulations.simulations||[]}
function selectSimulation(index){
  const entries=simulationEntries(),sim=entries[index];if(!sim)return;state.simulation=sim;
  $('simulation-list').innerHTML=entries.map((s,i)=>`<button data-sim="${i}" class="${i===index?'active':''}">${escapeHtml(s.title)}<small>${escapeHtml(systemLabel(s.system))}</small></button>`).join('');
  $('simulation-list').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>selectSimulation(Number(b.dataset.sim))));
  const params=sim.parameters||[];
  $('simulation-panel').innerHTML=`<span class="eyebrow">MODELO DIDÁTICO INTERATIVO</span><h2>${escapeHtml(sim.title)}</h2><p>${escapeHtml(sim.context)}</p><div class="simulation-controls">${params.map((p,i)=>`<div class="sim-parameter"><label for="sim-param-${i}">${escapeHtml(p.label||p.name||p.id)}<output id="sim-output-${i}"></output></label><input id="sim-param-${i}" type="range" min="${p.min}" max="${p.max}" step="${p.step||((p.max-p.min)>10?1:.05)}" value="${p.default}" data-param="${i}"><small>${escapeHtml(p.description||'')}</small></div>`).join('')}</div><svg id="sim-chart" class="sim-chart" viewBox="0 0 760 290" role="img" aria-label="Representação didática do mecanismo selecionado"></svg><div id="sim-results" class="sim-results" aria-live="polite"></div><div class="sim-explanation"><h3>Mecanismo fisiológico</h3><p>${escapeHtml(typeof sim.causalExplanation==='string'?sim.causalExplanation:JSON.stringify(sim.causalExplanation))}</p><p id="sim-condition"></p></div><div class="sim-caveat">${escapeHtml(sim.caveat||'Representação qualitativa, sem finalidade clínica.')}</div><details class="sim-question"><summary>Conexão com a discursiva UERJ</summary><p>${escapeHtml(sim.uerj?.question||sim.uerj?.prompt||'Explique a relação entre a condição alterada e a resposta fisiológica.')}</p><strong>Resposta-modelo</strong><p>${escapeHtml(sim.uerj?.answer||sim.uerj?.modelAnswer||'')}</p></details>`;
  $('simulation-panel').querySelectorAll('[data-param]').forEach(el=>el.addEventListener('input',updateSimulation));updateSimulation();
}
function updateSimulation(){
  const sim=state.simulation;if(!sim)return;
  const params=sim.parameters||[],values=params.map((p,i)=>Number($('sim-param-'+i).value));
  params.forEach((p,i)=>{$('sim-output-'+i).textContent=p.unit==='índice didático'?relativeLevel(values[i],p):fmt(values[i])+(p.unit?(p.unit.startsWith('%')?'':' ')+p.unit:'')});
  const result=computeSimulation(sim,Object.fromEntries(params.map((p,i)=>[p.id,values[i]])));
  drawChart(result.lines,result.xLabel,result.yLabel,[],sim);
  $('sim-results').innerHTML=[result.result1,result.result2].map(x=>`<div class="sim-result"><span>${escapeHtml(x.label)}</span><strong>${escapeHtml(x.value)}</strong><small>${escapeHtml(x.note)}</small></div>`).join('');
  $('sim-condition').textContent=result.explanation.replace(sim.causalExplanation||'','').replace(sim.caveat||'','').replace(/Controles:.*$/s,'').trim();
}
function drawChart(lines,xLabel,yLabel,ratios,sim){
  const W=760,H=290,left=60,right=28,top=40,bottom=52,pw=W-left-right,ph=H-top-bottom;
  const yMaximum=sim.id==='debito-cardiaco'?17.6:sim.id==='reflexo-sinapse'?1:100;
  let svg=`<title>${escapeHtml(sim.title)} — modelo didático</title><desc>Curvas relativas para explorar mecanismos; não são medidas clínicas nem previsões individuais.</desc>`;
  for(let i=0;i<=4;i++){const y=top+ph*(1-i/4);svg+=`<line x1="${left}" y1="${y}" x2="${W-right}" y2="${y}" stroke="#283a4a"/><text x="${left-12}" y="${y+4}" text-anchor="end" fill="#97afbe" font-size="11">${fmt(i/4*yMaximum)}</text>`}
  svg+=`<text x="${left}" y="22" fill="#c6dce5" font-size="11">${escapeHtml(yLabel)}</text><text x="${left+pw/2}" y="${H-12}" text-anchor="middle" fill="#97afbe" font-size="11">${escapeHtml(xLabel)}</text>`;
  for(const line of lines){const d=line.points.map(([x,y],i)=>(i?'L':'M')+(left+x*pw).toFixed(1)+','+(top+(1-y)*ph).toFixed(1)).join(' ');svg+=`<path d="${d}" fill="none" stroke="${line.color}" stroke-width="3"/>`}
  let legendX=left;
  for(const l of lines){svg+=`<line x1="${legendX}" y1="${H-34}" x2="${legendX+18}" y2="${H-34}" stroke="${l.color}" stroke-width="3"/><text x="${legendX+25}" y="${H-30}" fill="#c6dce5" font-size="11">${escapeHtml(l.name)}</text>`;legendX+=pw/Math.max(1,lines.length)}
  $('sim-chart').innerHTML=svg;
}
function questionEntries(){
  const result=simulationEntries().filter(s=>s.uerj?.question||s.uerj?.prompt).map(s=>({source:'simulation',id:s.id,name:s.title,system:s.system,question:s.uerj.question||s.uerj.prompt,answer:s.uerj.answer||s.uerj.modelAnswer,rubric:s.uerj.rubric,points:s.uerj.points,acceptedEquivalents:s.uerj.acceptedEquivalents,commonErrors:s.uerj.commonErrors}));
  for(const c of state.core){result.push({source:'core',id:c.id,name:c.name,system:c.system,question:`Identifique a função de ${c.name.toLowerCase()} e explique um mecanismo que permite seu desempenho.`,answer:[c.function||c.shortFunction,c.mechanism].join(' '),rubric:'Elementos de resposta: função correta; mecanismo causal; relação explícita entre ambos.'})}return result;
}
function renderQuestion(){
  const filter=$('practice-system').value,items=questionEntries().filter(q=>filter==='all'||systemLabel(q.system)===systemLabel(filter));if(!items.length){$('practice-panel').textContent='Nenhuma questão neste sistema.';return}
  const index=state.questionIndex%items.length,q=items[index];
  $('practice-panel').innerHTML=`<div class="question-index">QUESTÃO AUTORAL ${index+1} / ${items.length} · ${escapeHtml(systemLabel(q.system))}</div><h2>${escapeHtml(q.name)}</h2><p>${escapeHtml(q.question)}</p><label for="practice-answer" class="eyebrow">SUA RESPOSTA</label><textarea id="practice-answer" placeholder="Escreva uma resposta curta: termo técnico + mecanismo + consequência."></textarea><p id="practice-draft-status" class="practice-draft-status"></p><div class="practice-actions"><button class="primary" id="show-answer">Mostrar resposta-modelo</button><button id="question-atlas">Ver no atlas</button></div><div id="answer-panel" class="answer-panel" hidden>${renderPracticeFeedback(q)}</div>`;
  attachPracticeDraft($('practice-answer'),q,{store:practiceDrafts,statusElement:$('practice-draft-status')});
  $('show-answer').addEventListener('click',()=>{$('answer-panel').hidden=!$('answer-panel').hidden;$('show-answer').textContent=$('answer-panel').hidden?'Mostrar resposta-modelo':'Ocultar resposta-modelo'});
  $('question-atlas').addEventListener('click',()=>{setView('atlas');const targets={'ventilacao':'diaphragm','trocas-gasosas':'alveoli','debito-cardiaco':'heart','glicemia':'pancreas','rim-adh':'nephron','reflexo-sinapse':'neuron','digestao-ph':'stomach','ciclo-ovariano':'ovaries','sarcomero':'sarcomere','termorregulacao':'skin'};const core=state.coreMap.get(q.id)||state.coreMap.get(targets[q.id])||state.core.find(c=>systemLabel(c.system)===systemLabel(q.system));if(core)selectItem(core.id,true)});
}
function renderAbout(){
  const sources=[...(contentSources?.sources||[]),...(simulationSources?.sources||[]),...(studyContent?.sources||[]),...(cytologyContent?.sources||[]),...(botanyContent?.sources||[]),...(learningDetails?.sourceList()||[])];const unique=[...new Map(sources.map(s=>[s.url,s])).values()];
  $('about-content').innerHTML=`<article class="about-section full"><h2>O que está disponível</h2><div class="coverage-stats"><div><strong>${[...state.registry.values()].filter(r=>!isDetailMode(r.system)).length.toLocaleString('pt-BR')}</strong><small>peças anatômicas 3D</small></div><div><strong>${state.core.length}</strong><small>entradas de fisiologia</small></div><div><strong>${simulationEntries().length}</strong><small>módulos interativos</small></div></div><p>As sete camadas Z-Anatomy representam uma anatomia de referência masculina e são carregadas conforme o uso. O corpo feminino é outro modelo, com nove camadas, vindo do conjunto United Female v1.10 do HuBMAP Human Reference Atlas (Kristen Browne e Heidi Schlehlein, CC BY 4.0), construído a partir do Visible Human Female da National Library of Medicine. Ele tem coluna, pelve, órgãos torácicos e abdominais, coração e vasos principais, encéfalo, medula, olhos, mamas, pele e o reprodutor completo com vagina e ligamentos; não tem crânio, costelas, membros superiores, músculos do tronco e dos membros, nervos periféricos, estômago, esôfago nem tireoide. Órgãos de um corpo não são encaixados no outro.</p><p>Cada peça traz o nome do acervo e uma explicação. Estruturas principais recebem descrições próprias. Subdivisões sem texto próprio recebem uma função geral de sua classe, explicitamente identificada. As entradas essenciais de néfron, alvéolos, neurônio, sarcômero e pele abrem diretamente vistas histológicas ou celulares detalhadas. Uma nota informa quando a vista mostra a estrutura exata, apenas uma parte ou o contexto do tecido. Alguns processos e estruturas microscópicas ainda não possuem malha própria neste conjunto.</p></article><article class="about-section"><h2>Detalhe e 4K</h2><p>O atlas usa malhas anatômicas reais, iluminação em tempo real, seleção, transparência e cortes. A exportação produz PNG com <strong>3840 × 2160 pixels</strong>. Esse número define a resolução da imagem exportada, não implica texturas em 4K, histologia realista ou presença de todas as células e tecidos.</p><p>Os órgãos e tecidos receberam acabamento PBR específico, grão em várias escalas, variação de brilho e reflexos suaves compartilhados. Esse acabamento melhora a aparência sem acrescentar anatomia ou reduzir a malha. Não são texturas fotográficas nem histologia medida. Três peças vasculares têm nome específico ausente no acervo e recebem rótulos descritivos de contexto. Os esquemas microscópicos têm formas e proporções didáticas. A visualização depende do tamanho da tela e da capacidade gráfica. Em computadores mais lentos, mantenha poucas camadas visíveis e selecione qualidade Leve. Os cortes são planos de visualização e não imagens reais de tomografia.</p></article><article class="about-section full"><h2>Órgãos por dentro e histologia</h2><div class="coverage-stats"><div><strong>${studyContent.organs.length}</strong><small>vistas internas</small></div><div><strong>${studyContent.histology.length}</strong><small>tecidos e unidades</small></div><div><strong>${studyContent.organs.reduce((n,o)=>n+(o.internalParts?.length||0),0)+studyContent.histology.reduce((n,o)=>n+(o.parts?.length||0),0)}</strong><small>partes explicadas</small></div></div><p>Órgãos por dentro mostra cortes e ampliações com câmaras, camadas, ductos, regiões e unidades funcionais. Histologia relaciona essas regiões a epitélios, células e tecidos. Toque em uma parte para ler sua função, mecanismo e conexão com a discursiva. A navegação permite voltar ao órgão e ao corpo.</p><p>As vistas internas usam referências anatômicas licenciadas quando disponíveis. O coração tem texturas originais de 2048 × 2048; os modelos HRA têm peças identificadas, mas não texturas fotográficas em 4K. Alguns órgãos trazem apenas a superfície externa. O esquema funcional, a histologia e a citologia continuam sendo representações didáticas, com cores, quantidades e proporções ilustrativas. O atlas não promete um inventário de todas as células nem uma reconstrução clínica de cada órgão. Referências universitárias e fontes de lâminas reais estão ligadas às vistas; os modelos 3D não são fotografias de microscopia. Novas vistas são carregadas conforme o uso, com até dois modelos retidos em dispositivos de toque e três no computador.</p></article><article class="about-section"><h2>Nível UERJ</h2><p>O foco é o ensino médio com explicações causais: homeostase, fisiologia humana, transporte, metabolismo, hormônios e integração entre sistemas. As questões são autorais, inspiradas no estilo discursivo da UERJ, e não constituem material oficial da universidade.</p><p>As simulações mostram relações didáticas e declaram suas simplificações. Não realizam diagnóstico, previsão de fertilidade ou cálculo individual de risco.</p></article><article class="about-section full"><h2>Modelos e licenças</h2><p>Coração com interior detalhado: <a href="models/DUNDEE_ATTRIBUTION.txt" target="_blank">Universidade de Dundee / BodyParts3D, CC BY-SA 4.0</a>. Peças anatômicas dos demais órgãos: <a href="models/REFERENCE_ATTRIBUTION.txt" target="_blank">Human Reference Atlas, CC BY 4.0</a>. Consulte a <a href="MODELOS-ANATOMICOS.md" target="_blank">cobertura e os limites de cada órgão</a>. A exportação de 3840 × 2160 pixels não transforma uma textura 2K em uma textura original 4K.</p><p>Modelos: <a href="https://www.z-anatomy.com/" target="_blank" rel="noreferrer">Z-Anatomy</a> e <a href="https://lifesciencedb.jp/bp3d/" target="_blank" rel="noreferrer">BodyParts3D</a>. Exportação GLB: <a href="https://github.com/nqwrc/3d-anatomy" target="_blank" rel="noreferrer">nqwrc/3d-anatomy</a>. O pacote conserva os créditos e licenças upstream, incluindo componentes com restrição de uso comercial. Consulte <a href="models/License.txt" target="_blank">créditos das malhas</a>, <a href="models/UPSTREAM_LICENSE.txt" target="_blank">licença</a> e <a href="models/UPSTREAM_NOTICE.txt" target="_blank">avisos</a>.</p><p>Órgãos femininos: <a href="https://humanatlas.io/" target="_blank" rel="noreferrer">HuBMAP Human Reference Atlas</a>, CC BY 4.0. Three.js e three-mesh-bvh: MIT; decodificador Draco: Apache 2.0. Textos educacionais são redação original em português baseada nas referências indicadas abaixo. Os nomes de estruturas aparecem em português brasileiro. Os nomes originais permanecem apenas nos dados de origem e no índice de busca.</p></article><article class="about-section full"><h2>Referências de anatomia e fisiologia</h2><ul>${unique.map(s=>`<li><a href="${escapeHtml(s.url)}" target="_blank" rel="noreferrer">${escapeHtml(s.title)}</a> ${s.publisher?'— '+escapeHtml(s.publisher):''}</li>`).join('')}</ul></article>`;
  const cytology=document.createElement('article');cytology.className='about-section full';cytology.innerHTML='<h2>Citologia: células e processos</h2><div class="coverage-stats"><div><strong>'+cytologyContent.views.length+'</strong><small>vistas celulares</small></div><div><strong>'+cytologyContent.views.reduce((n,v)=>n+v.parts.length,0)+'</strong><small>partes explicadas</small></div><div><strong>'+cytologyContent.categories.length+'</strong><small>grupos de temas</small></div></div><p>A cobertura inclui '+cytologyContent.categories.map(c=>escapeHtml(c.name.toLowerCase())).join(', ')+'. Células animais, vegetais, fúngicas e bacterianas são comparadas; vírus aparecem explicitamente como entidades acelulares. O catálogo relaciona organelas, biomoléculas e mecanismos, com sequências estáticas, comparações e ligações à histologia.</p><p>Esta é uma cobertura ampla de citologia escolar e de fundamentos avançados. Os modelos ampliados têm cores, quantidades e proporções ilustrativas; não esgotam a biologia celular contemporânea nem representam estruturas moleculares medidas. As etapas de processos são esquemas estáticos. Cada vista indica seus limites e referências.</p>';$('about-content').querySelector('.about-section.full').after(cytology);
  const botanical=document.createElement('article');botanical.className='about-section full';botanical.dataset.botanyCoverage='';botanical.innerHTML='<h2>Histologia e fisiologia vegetal</h2><div class="coverage-stats"><div><strong>'+botanyContent.views.length+'</strong><small>vistas vegetais</small></div><div><strong>'+botanyContent.views.reduce((n,v)=>n+v.parts.length,0)+'</strong><small>componentes explicados</small></div></div><p>Folha, raiz, caules, estômatos, xilema, floema, meristemas, flor, semente, dupla fecundação e respostas vegetais são ligados à citologia por componentes identificados. As reconstruções representam exemplos de angiospermas; a organização varia entre espécies e ambientes.</p><p>Citologia e botânica usam superfícies trianguladas de membranas, cisternas, paredes e tecidos. Os três mapas procedurais de cor, relevo e rugosidade compartilham um atlas de 4096 × 4096 pixels por mapa no computador, e de 2048 × 2048 no toque. Cada superfície usa uma região desse atlas; isso não equivale a uma fotografia 4K independente por componente. As cores e os cortes são educativos, sem reconstrução molecular medida.</p>';$('about-content').append(botanical);
  if(systematicsView){const st=systematicsView.stats(),syst=document.createElement('article');syst.className='about-section full';syst.dataset.systematicsCoverage='';syst.innerHTML='<h2>Sistemática e fisiologia comparada</h2><div class="coverage-stats"><div><strong>'+st.leaves+'</strong><small>grupos na árvore</small></div><div><strong>'+st.withModel+'</strong><small>organismos em 3D</small></div><div><strong>'+systematicsContent.functions.length+'</strong><small>funções comparadas</small></div></div><p>A árvore segue os três domínios (Bacteria, Archaea, Eukarya) e relações de parentesco aceitas em livros universitários. Protistas, peixes e répteis tradicionais são agrupamentos parafiléticos, mantidos por serem usados no vestibular. Grupos sem modelo 3D próprio já trazem classificação e fisiologia comparada.</p><p>Os organismos 3D são reconstruções autorais geradas no próprio aparelho, fora da linha principal da interface, com perfil mais leve no toque. Cores, número de cílios, ribossomos e outras estruturas repetidas e as espessuras de envoltórios são didáticos; não são reconstruções de espécimes. Consulte o <a href="COBERTURA-MODELOS.md" target="_blank">inventário de modelos</a>.</p>';$('about-content').append(syst)}
  if(modelCoverage){const coverage=document.createElement('article');coverage.className='about-section full';const title=document.createElement('h2');title.textContent='Cobertura dos modelos anatômicos';const intro=document.createElement('p');intro.textContent='Os '+(modelCoverage.counts?.organs||51)+' órgãos e regiões têm coberturas diferentes: '+(modelCoverage.counts?.defaultDetailedCuts||4)+' cortes internos autorais, '+(modelCoverage.counts?.defaultReferences||46)+' referências anatômicas e uma vista esquemática. A exportação 4K salva 3840 × 2160 pixels; ela não comprova textura fotográfica nem segmentação de todas as partes.';const table=document.createElement('table');table.className='model-coverage-table';table.innerHTML='<caption>Tipo de modelo e peças sem correspondência geométrica confirmada</caption><thead><tr><th scope="col">Órgão</th><th scope="col">Vista inicial</th><th scope="col">Lacunas no catálogo</th></tr></thead>';const body=document.createElement('tbody');for(const organ of modelCoverage.organs||[]){const row=document.createElement('tr'),name=document.createElement('th');name.scope='row';name.textContent=organ.label;const type=document.createElement('td');type.textContent={detailed:'Corte interno autoral',reference:'Referência anatômica',diagram:'Esquema funcional'}[organ.defaultRepresentation]||organ.defaultRepresentation;const gaps=document.createElement('td');gaps.textContent=String(organ.geometryGaps?.length||0)+' / '+organ.canonicalParts;row.append(name,type,gaps);body.append(row)}table.append(body);const wrapper=document.createElement('div');wrapper.className='model-coverage-scroll';wrapper.append(table);const link=document.createElement('a');link.href='./COBERTURA-MODELOS.md';link.target='_blank';link.rel='noreferrer';link.textContent='Ler o inventário detalhado e suas limitações';coverage.append(title,intro,wrapper,link);$('about-content').append(coverage)}
  const detail=document.createElement('article');detail.className='about-section full';const counts=learningDetails?.stats()||{};detail.innerHTML='<h2>Histofisiologia e tecidos em detalhe</h2><p>A biblioteca acrescenta descrições de localização, composição, mecanismos e integração para '+(counts.organs||0)+' órgãos e '+(counts.tissues||0)+' vistas histológicas. Selecione uma peça para ler os detalhes ou explore a biblioteca na área Fisiologia.</p><p>Os tecidos usam superfícies trianguladas contínuas, contornos celulares, camadas e fibras curvas. Duas texturas procedurais de 4096 × 4096 pixels são compartilhadas entre as vistas. No perfil de toque, os mapas ativos usam 2048 × 2048 e as malhas têm densidade menor para economizar memória; a exportação permanece 3840 × 2160. Essas superfícies são reconstruções educacionais autorais, sem escala histológica medida.</p><p>A coleção tem '+(counts.slides||0)+' registros de microscopia licenciada para comparação em vistas selecionadas. A ampliação vegetal e celular inclui cinco microfotografias e um composto com imagem real e segmentação científica identificada. Resolução, espécie, técnica, corte e diferenças em relação ao 3D aparecem no comparador. Autoria, licença e fonte aparecem ao abrir cada imagem. Consulte os <a href="images/histology/ATTRIBUTION.md" target="_blank">créditos da histologia</a> e os <a href="images/microscopy/ATTRIBUTION.md" target="_blank">créditos da microscopia vegetal e celular</a> e da <a href="images/microscopy/ATTRIBUTION-DIGESTIVA-V18.md" target="_blank">parede digestiva</a>. As novas imagens digestivas comparam mucosa gástrica, epitélio esofágico e criptas do cólon; não mostram necessariamente todas as camadas ou células do órgão. Fotografias e texturas procedurais têm origens diferentes.</p>';$('about-content').querySelector('.about-section.full').after(detail);
}

// Systematics: tree of life in the catalogue, organisms in 3D and physiology compared across groups (systematics-view.js).
function appendSystematicsLearning(definition){
  const panel=$('detail-panel'),group=systematicsView?.groupOfView(definition.id);if(!group)return;
  const scale=document.createElement('p');scale.className='learning-scope-note';scale.dataset.systScale='';scale.textContent='Escala real: '+(definition.scale||'—');panel.append(scale);
  systematicsView.appendPanel(panel,group.id,{viewId:definition.id});
  if(definition.keyIdeas?.length){const block=document.createElement('div');block.className='detail-block cytology-ideas';block.innerHTML='<h3>Ideias centrais</h3><ul>'+definition.keyIdeas.map(t=>'<li>'+escapeHtml(t)+'</li>').join('')+'</ul>';if(definition.recognition)block.innerHTML+='<h4>Como reconhecer</h4><p>'+escapeHtml(definition.recognition)+'</p>';panel.append(block)}
}
function systematicsSources(panel,ids){const set=new Set(ids||[]),list=systematicsContent.sources.filter(s=>set.has(s.id));if(!list.length)return;const p=document.createElement('p');p.className='study-sources';p.append('Referências: ');list.forEach((s,i)=>{if(i)p.append(' · ');const a=document.createElement('a');a.href=s.url;a.target='_blank';a.rel='noreferrer';a.textContent=s.title;p.append(a)});panel.append(p)}
async function openSystematics(viewId){systGroupShown=null;const opened=await openStudy('syst-'+viewId);if(opened&&systFunction)focusSystematicsFunction(systFunction,false);return opened}
async function enterSystematics(){setView('atlas');setCatalogTab('systematics');if(!systematicsView){toast('Sistemática temporariamente indisponível. As outras áreas continuam disponíveis.');return false}if(!state.mode.startsWith('syst-')&&systematicsContent.views.length)return openSystematics(systematicsContent.views[0].id);return true}
// A function picked in the comparison highlights every part of the open organism that performs it.
function focusSystematicsFunction(fn,notify=true){
  systFunction=fn||null;const model=studyModels.get(state.mode);
  if(!state.mode.startsWith('syst-')||!model){if(systGroupShown)showSystematicsGroup(systGroupShown);return}
  ++selectionVersion;state.selected=null;state.isolated=null;state.opacity=1;$('selected-label').hidden=true;
  const names=fn?model.parts.filter(p=>p.functions?.includes(fn)&&p.geometryIdentified!==false).map(p=>p.registryName):[];
  for(const n of names)state.hidden.delete(n);state.selectedNames=new Set(names);applyVisibility();resetDetail();updateStudyPath();
  if(fn&&!names.length&&notify)toast('Este organismo não tem uma estrutura própria para essa função. Compare pelo texto.');
  if(fn){$('detail-panel').querySelector('.syst-physiology')?.scrollIntoView({block:'start'});tabletUI.showDetail()}
}
// Groups without their own 3D model yet: classification and comparison in the details panel, 3D unchanged.
function showSystematicsGroup(groupId,{note}={}){
  const group=systematicsView?.groups.get(groupId);if(!group)return;systGroupShown=groupId;const panel=$('detail-panel');
  panel.innerHTML=`<div class="detail-empty"><span class="eyebrow">SISTEMÁTICA · GRUPO</span><h2>${escapeHtml(group.name)}</h2><p>${escapeHtml(group.rank)}</p><div class="model-availability">${escapeHtml(note||'O modelo 3D deste grupo ainda está em produção. A classificação e a fisiologia comparada já estão disponíveis.')}</div></div>`;
  systematicsView.appendPanel(panel,groupId,{onFunction:fn=>{systFunction=fn;showSystematicsGroup(groupId,{note})}});systematicsSources(panel,group.sourceIds);panel.scrollTop=0;tabletUI.showDetail();
}
async function openSystematicsAtlas(mode,groupId){setView('atlas');if(state.mode!==mode)await switchModel(mode);state.tab='systematics';renderList();showSystematicsGroup(groupId,{note:'O corpo humano do Atlas 3D representa os mamíferos: abra os sistemas e compare coração, pulmões e rins com os outros grupos.'})}
function setupSystematics(data){
  if(!Array.isArray(data?.groups)||!Array.isArray(data?.views)||!data.tree)return;systematicsContent=data;
  systematicsView=createSystematicsView(data,{openView:openSystematics,openAtlas:openSystematicsAtlas,showGroup:id=>showSystematicsGroup(id),highlight:fn=>focusSystematicsFunction(fn),activeFunction:()=>systFunction});
  const group=document.createElement('optgroup');group.label='Sistemática';for(const v of data.views){const option=document.createElement('option');option.value='syst-'+v.id;option.textContent=v.label||v.title;group.append(option)}$('model-mode').append(group);
}
function syncBotanyOptions(){
  $('botany-category').innerHTML='<option value="all">Todos os temas</option>'+botanyContent.categories.map(c=>`<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('');
  $('model-mode').querySelector('[data-botany-options]')?.remove();if(!botanyContent.views.length)return;const group=document.createElement('optgroup');group.label='Botânica';group.dataset.botanyOptions='';for(const v of botanyContent.views){const option=document.createElement('option');option.value='botany-'+v.id;option.textContent=v.label||v.title;group.append(option)}$('model-mode').append(group);
}
async function enterBotany(){
  setView('atlas');setCatalogTab('botany');if(!botanyContent.views.length){if(!botanyRetry)botanyRetry=(async()=>{const data=await getJSON('./data/botany-content.json',true);if(!Array.isArray(data?.views)||!data.views.length||!Array.isArray(data.categories)||data.views.some(v=>!v.id||!Array.isArray(v.parts)))return false;Object.assign(botanyContent,data);studyConnections=createStudyConnections(currentConnectionData,studyContent,cytologyContent,currentOrganDetails,botanyContent);syncBotanyOptions();rebuildSearch();renderList();if(window.atlas)window.atlas.studyConnections=studyConnections;return true})().finally(()=>{botanyRetry=null});if(!await botanyRetry){toast('Botânica temporariamente indisponível. Tente novamente; as outras áreas continuam disponíveis.');return false}}
  if(state.tab==='botany'&&!state.mode.startsWith('botany-'))return openStudy('botany-'+botanyContent.views[0].id);return true;
}
async function restoreStudySession(saved){
  if(!saved)return true;let opened=false;
  if(saved.mode.startsWith('internal-')&&saved.representation)organRepresentations.set(saved.mode,saved.representation);
  if(saved.coreSelectionId&&state.coreMap.has(saved.coreSelectionId))opened=!!await selectItem(saved.coreSelectionId,true,false,{preserveTrail:true});
  else if(isStudyMode(saved.mode)&&studyDefinition(saved.mode))opened=!!await openStudy(saved.mode,saved.organId,saved.selection,{preserveTrail:true,allowAlternative:false});
  else if(['body','female'].includes(saved.mode)){opened=!!await switchModel(saved.mode,null,{preserveTrail:true});if(opened){if(saved.selection?.key&&state.registry.has(saved.selection.key))await selectItem(saved.selection.key,false,false,{preserveTrail:true});else if(saved.selection?.coreId&&state.coreMap.has(saved.selection.coreId))await selectItem(saved.selection.coreId,true,false,{preserveTrail:true})}}
  state.questionIndex=saved.questionIndex;if([...$('practice-system').options].some(o=>o.value===saved.practiceSystem))$('practice-system').value=saved.practiceSystem;
  if(!opened){toast('A última vista não está disponível agora. Seu ponto anterior foi preservado neste dispositivo.');return false}
  studyTrail=saved.trail;cytologyOrigin=saved.cytologyOrigin;activeArrival=saved.arrival;
  if(state.selected)renderDetail();else resetDetail();updateStudyPath();fitBody('front',true);
  return true;
}
async function start(){
  try{
    [physiology,simulations,atlasSystems,lexicon,contentSources,simulationSources,femaleMeta,studyContent,cytologyContent]=await Promise.all([getJSON('./data/physiology.json'),getJSON('./data/simulations.json'),getJSON('./data/atlas-systems.json'),getJSON('./data/atlas-lexicon.json'),getJSON('./data/content-sources.json'),getJSON('./data/simulation-sources.json'),getJSON('./data/atlas-female.json',true),getJSON('./data/internal-content.json',true),getJSON('./data/cytology-content.json',true)]);
    cytologyContent||={views:[],categories:[],sources:[]};
    studyContent||={organs:[],histology:[],sources:[]};
    const supplementary=await getJSON('./data/supplementary-content.json',true);if(supplementary)for(const key of ['organs','histology','sources'])studyContent[key]=[...(studyContent[key]||[]),...(supplementary[key]||[])];
    referenceCatalog=await getJSON('./data/reference-organs.json',true);
    femaleBody=await getJSON('./data/atlas-female-body.json',true);
    referencePartFunctions=await getJSON('./data/reference-part-functions.json',true)||{parts:[]};
    botanyContent=await getJSON('./data/botany-content.json',true)||{views:[],categories:[],sources:[]};
    const [organDetails,histologyDetails,microscopyReferences,connectionData,coverageData]=await Promise.all([getJSON('./data/organ-detail.json',true),getJSON('./data/histology-detail.json',true),getJSON('./data/microscopy-references.json',true),getJSON('./data/study-connections.json',true),getJSON('./data/organ-model-coverage.json',true)]);
    currentConnectionData=connectionData;currentOrganDetails=organDetails;
    modelCoverage=coverageData;
    studyConnections=createStudyConnections(connectionData,studyContent,cytologyContent,organDetails,botanyContent);
    learningDetails=createLearningDetails(organDetails,histologyDetails,microscopyReferences);
    learningDetails.renderLibrary($('physiology-library'),{systemLabel,onOpen:id=>{setView('atlas');openStudy('internal-'+id)}});
    state.core=physiology.structures||physiology;createRegistry();renderLayers();renderList();
    const ids=[...new Set(state.core.map(c=>c.system))];$('practice-system').innerHTML='<option value="all">Todos os sistemas</option>'+ids.map(id=>`<option value="${id}">${escapeHtml(systemLabel(id))}</option>`).join('');
    const studySystems=[...new Set([...(studyContent.organs||[]),...(studyContent.histology||[])].map(o=>o.system))];$('study-system').innerHTML='<option value="all">Todos os sistemas</option>'+studySystems.map(id=>`<option value="${escapeHtml(id)}">${escapeHtml(systemLabel(id))}</option>`).join('');
    syncBotanyOptions();
    setupSystematics(await getJSON('./data/systematics-content.json',true));
    $('cytology-category').innerHTML='<option value="all">Todos os temas</option>'+cytologyContent.categories.map(c=>`<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('');
    const options=[['Por dentro',studyContent.organs||[],'internal-'],['Histologia',studyContent.histology||[],'histo-'],['Citologia',cytologyContent.views||[],'cyto-']];for(const [label,entries,prefix] of options){const group=document.createElement('optgroup');group.label=label;for(const entry of entries){const option=document.createElement('option');option.value=prefix+entry.id;option.textContent=entry.label||entry.title;group.append(option)}$('model-mode').append(group)}
    tabletUI=setupTabletUI({touchDevice,onInsetChange:setViewInset});init3D();setupDrawBoard();setupProcesses();setupEvents();setupOffline();
    $('load-progress').max=2;$('load-detail').textContent='Órgãos internos e esqueleto…';await Promise.all([loadSystem('visceral'),loadSystem('skeletal')]);$('viewer-loading').hidden=true;fitBody('front',true);fadeInCanvas();$('load-progress').max=7;
    const saved=studySessions.load(),view=location.hash.replace('#',''),restored=await restoreStudySession(saved);if(['atlas','physiology','practice','about'].includes(view))setView(view);else if(saved)setView(saved.view);sessionReady=true;if(restored)rememberStudy();
    window.atlas={state,scene,camera,renderer,controls,processPlayer,botanyContent,systematicsContent:()=>systematicsContent,systematicsView:()=>systematicsView,focusSystematicsFunction,applyVisibility,requestRender,fitBody,selectItem,loadSystem,switchModel,openStudy,followStudyConnection,returnStudyConnection,studyConnections,studyContent,cytologyContent,studyModels,selectSimulation,setView,export4K,getStats:()=>({catalog:state.registry.size,core:state.core.length,loaded:[...state.loaded],objects:allMeshObjects.length,materialVariants:materialCache.size,tissues:getTissueFinishStats(),pickCandidates:pickCandidates.length,triangles:renderer.info.render.triangles,simulations:simulationEntries().length,internalOrgans:studyContent.organs.length,histologyUnits:studyContent.histology.length,botanyViews:botanyContent.views.length,botanyParts:botanyContent.views.reduce((n,v)=>n+v.parts.length,0),cytologyViews:cytologyContent.views.length,cytologyParts:cytologyContent.views.reduce((n,v)=>n+v.parts.length,0),studyModelsLoaded:studyModels.size})};
  }catch(error){console.error(error);$('viewer-loading').hidden=true;showError('O atlas não pôde iniciar: '+error.message+'. Recarregue a página. Se o acervo ainda não foi salvo para uso off-line, conecte-se à internet e tente novamente.');$('asset-status').textContent='Falha no carregamento'}
}
start();
