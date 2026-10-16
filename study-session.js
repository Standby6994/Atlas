// Local navigation metadata only. Geometry, answers and account credentials
// are never stored here. Invalid/old data cannot prevent the Atlas from starting.
const KEY='atlas-study-session-v1';
const MAX_SERIALIZED_CHARACTERS=100000;
const text=(value,max=800)=>typeof value==='string'?value.slice(0,max):null;
const mode=value=>typeof value==='string'&&value.length<=180&&/^(body|female|(?:internal|histo|cyto|botany|micro)-[a-z0-9_-]+)$/.test(value)?value:null;
function selection(value){if(!value||typeof value!=='object')return null;const result={};for(const key of['key','label','sourceName','coreId','partId','contentPartId']){const item=text(value[key]);if(item)result[key]=item}if(Array.isArray(value.aliases))result.aliases=value.aliases.filter(v=>typeof v==='string').slice(0,20).map(v=>v.slice(0,200));return Object.keys(result).length?result:null}
function arrival(value){if(!value||typeof value!=='object')return null;return{fromLabel:text(value.fromLabel,300)||'',relation:text(value.relation,1500)||'',scope:text(value.scope,40)||'context'}}
function frame(value){if(!value||!mode(value.mode))return null;return{mode:mode(value.mode),organId:text(value.organId,100),selection:selection(value.selection),coreSelectionId:text(value.coreSelectionId,100),label:text(value.label,300)||'Corpo',arrival:arrival(value.arrival)}}
export function normalizeStudySession(value){
 if(!value||value.schema!==1)return null;const current=frame(value);if(!current)return null;
 const normalized={...current,schema:1,view:['atlas','physiology','practice','about'].includes(value.view)?value.view:'atlas',trail:(Array.isArray(value.trail)?value.trail:[]).slice(-16).map(frame).filter(Boolean),cytologyOrigin:frame(value.cytologyOrigin),representation:['reference','detailed','segmented','diagram'].includes(value.representation)?value.representation:null,questionIndex:Number.isSafeInteger(value.questionIndex)?Math.max(0,Math.min(10000,value.questionIndex)):0,practiceSystem:text(value.practiceSystem,100)||'all'};
 // Keep the current selection when an unusually large history exceeds the
 // same serialized bound used by load(). Oldest frames are expendable first.
 while(normalized.trail.length&&JSON.stringify(normalized).length>MAX_SERIALIZED_CHARACTERS)normalized.trail.shift();
 if(JSON.stringify(normalized).length>MAX_SERIALIZED_CHARACTERS)normalized.cytologyOrigin=null;
 return normalized;
}
export function createStudySessionStore({storage,key=KEY}={}){
 let target=storage,memory=null;if(target===undefined)try{target=globalThis.localStorage}catch{target=null}
 return{load(){if(memory)return normalizeStudySession(memory);try{const raw=target?.getItem(key);if(raw&&raw.length<=MAX_SERIALIZED_CHARACTERS){const normalized=normalizeStudySession(JSON.parse(raw));if(normalized)memory=normalized}}catch{}return memory?normalizeStudySession(memory):null},save(value){const normalized=normalizeStudySession({...value,schema:1});if(!normalized)return false;memory=normalized;try{if(!target)return false;target.setItem(key,JSON.stringify(normalized));return true}catch{return false}}};
}
