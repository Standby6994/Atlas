// Navigation uses explicit reviewed IDs. Related mechanisms do not imply
// identical anatomy, calibrated magnification, or newly segmented geometry.
export function createStudyConnections(data,content,cytology,referenceDetails,botany){
 const organs=new Map((content?.organs||[]).map(v=>[v.id,v])),tissues=new Map((content?.histology||[]).map(v=>[v.id,v])),cells=new Map((cytology?.views||[]).map(v=>[v.id,v]));
 const plants=new Map((botany?.views||[]).map(v=>[v.id,v]));
 const organRoutes=new Map((data?.organRoutes||[]).map(r=>[r.organId+'|'+r.partId,r])),tissueRoutes=new Map((data?.tissueRoutes||[]).map(r=>[r.tissueId+'|'+r.partId,r]));
 const organOverview=new Map((data?.organOverview||[]).map(r=>[r.organId,r])),tissueOverview=new Map((data?.tissueOverview||[]).map(r=>[r.tissueId,r]));
 const references=new Map((referenceDetails?.referenceParts||[]).map(r=>[r.organId+'|'+r.sourceName,r]));
 function definition(mode){return mode?.startsWith('internal-')?organs.get(mode.slice(9)):mode?.startsWith('histo-')?tissues.get(mode.slice(6)):mode?.startsWith('cyto-')?cells.get(mode.slice(5)):mode?.startsWith('botany-')?plants.get(mode.slice(7)):null}
 function destination(link){const view=definition(link.viewId),part=(view?.internalParts||view?.parts||[]).find(p=>p.id===link.partId);return view&&part?{view,part}:null}
 function resolve(mode,selection){
  const view=definition(mode);if(!view)return{links:[],scope:'context'};
  if(mode.startsWith('botany-')){const exact=selection?.id&&view.parts.find(p=>p.id===selection.id),links=exact?.links?.length?exact.links:view.links||[];return{links:links.filter(destination),scope:exact?.links?.length?'piece':'context',sourceUrls:[]}}
  if(mode.startsWith('internal-')){
   const ref=selection?.sourceName&&references.get(view.id+'|'+selection.sourceName),id=selection?.sourceName?ref?.contentPartId:selection?.learningDetails?.canonicalPartId||selection?.contentPartId||selection?.id;
   const record=!selection?.identificationConflict&&id&&organRoutes.get(view.id+'|'+id),fallback=organOverview.get(view.id);return{links:(record?.links||fallback?.links||[]).filter(destination),scope:record?'piece':'context',sourceUrls:record?.sourceUrls||fallback?.sourceUrls||[]};
  }
  if(mode.startsWith('histo-')){const record=selection?.id&&tissueRoutes.get(view.id+'|'+selection.id),fallback=tissueOverview.get(view.id);return{links:(record?.links||fallback?.links||[]).filter(destination),scope:record?'piece':'context',sourceUrls:record?.sourceUrls||fallback?.sourceUrls||[]}}
  const chosen={
   'cardiomyocyte|myofibrils':['sarcomere','thin-filaments','O deslizamento de actina e miosina converte ciclos dependentes de ATP em encurtamento do sarcômero.'],
   'cardiomyocyte|mitochondria':['mitochondrion','cristae','As cristas sustentam a produção oxidativa de ATP usado na contração, nos transportes iônicos e na recuperação do cálcio.'],
   'cardiomyocyte|sarcoplasmic-reticulum':['smooth-er','calcium-store','O retículo sarcoplasmático é uma especialização do retículo liso. Armazena e libera cálcio para regular as miofibrilas.'],
   'cardiomyocyte|gap-junctions':['cell-junctions','gap-junction','Junções comunicantes permitem a passagem de íons entre cardiomiócitos e contribuem ao acoplamento elétrico.'],
   'cardiomyocyte|anchoring-junctions':['cell-junctions','desmosome','Junções de ancoragem resistem às forças mecânicas na interface entre cardiomiócitos.'],
   'cardiomyocyte|nucleus':['nucleus-chromatin','euchromatin','A expressão gênica nuclear contribui à renovação das proteínas do cardiomiócito.'],
   'sarcomere|calcium':['cardiomyocyte','sarcoplasmic-reticulum','No cardiomiócito, a liberação de cálcio pelo retículo ativa a regulação dos filamentos contráteis.'],
   'sarcomere|atp-cycle':['oxidative-phosphorylation','atp','O ATP sustenta o ciclo das pontes cruzadas e as bombas necessárias à contração e ao relaxamento.']
  }[view.id+'|'+selection?.id];
  const links=chosen?[{viewId:'cyto-'+chosen[0],partId:chosen[1],label:(cells.get(chosen[0])?.parts||[]).find(p=>p.id===chosen[1])?.label||chosen[0],relation:chosen[2],scope:'mechanism'}]:[];
  return{links:links.filter(destination),scope:'piece',sourceUrls:[]};
 }
 return{definition,destination,resolve,stats:()=>({organParts:organRoutes.size,tissueParts:tissueRoutes.size,organs:organOverview.size,tissues:tissueOverview.size})};
}
