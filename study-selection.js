// Correspondence uses reviewed identifiers and exact names, never proximity
// or a generic organ association to infer a specific anatomical subdivision.
const labelKey=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
export function studySelectionContext(selected){
  if(!selected)return null;
  const raw=selected.raw,info=raw?.customInfo;
  return {key:selected.key,label:raw?.pt||selected.core?.name,sourceName:info?.sourceName||(!info?raw?.name:null),
    aliases:selected.isCore?selected.core?.aliases||[]:[],
    coreId:info?.coreId||raw?.coreId||selected.core?.id,
    partId:info?.partId,contentPartId:info?.contentPartId||info?.id};
}
export function equivalentStudyPart(parts,context,primaryCoreId){
  if(!context)return null;
  const names=new Set([context.label,...context.aliases||[]].map(labelKey).filter(Boolean));
  const preferred=matches=>matches.find(p=>names.has(labelKey(p.label||p.pt||p.name)))||matches.find(p=>p.geometryIdentified)||matches[0]||null;
  const same=parts.find(p=>p.registryName===context.key);if(same)return same;
  if(context.sourceName){const match=parts.find(p=>p.sourceName===context.sourceName);if(match)return match}
  if(context.contentPartId){const match=preferred(parts.filter(p=>p.id===context.contentPartId||p.contentPartId===context.contentPartId));if(match)return match}
  if(context.partId){const match=preferred(parts.filter(p=>p.partId===context.partId));if(match)return match}
  const match=preferred(parts.filter(p=>names.has(labelKey(p.label||p.pt||p.name))));if(match)return match;
  if(context.coreId&&context.coreId!==primaryCoreId)return preferred(parts.filter(p=>p.coreId===context.coreId));
  return null;
}
