// Drafts are local to this browser. This module never sends answers to a server.
const STORAGE_KEY='atlas-practice-drafts';
const VERSION=2;
const MAX_SERIALIZED_CHARACTERS=3_000_000;
const escapeText=value=>String(value??'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const boundedInteger=(value,fallback,minimum,maximum)=>Number.isFinite(value)?Math.max(minimum,Math.min(maximum,Math.floor(value))):fallback;
const boundedText=(text,limit)=>{const cut=text.slice(0,limit);return /[\uD800-\uDBFF]$/.test(cut)?cut.slice(0,-1):cut};
const pointLabel=points=>new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(points)+(points===1?' ponto':' pontos');

export function practiceQuestionKey(question){
  if(!question||typeof question.id!=='string'||!question.id.trim()||question.id.length>300)throw new TypeError('A questão precisa de um identificador estável.');
  const source=typeof question.source==='string'&&question.source.trim()?question.source:'legacy';
  if(source.length>100)throw new TypeError('A origem da questão é longa demais.');
  return JSON.stringify([source,question.id]);
}

function validKey(value){
  if(typeof value!=='string'||value.length>850)return null;
  try{const pair=JSON.parse(value);if(Array.isArray(pair)&&pair.length===2&&pair.every(item=>typeof item==='string'))return practiceQuestionKey({source:pair[0],id:pair[1]})}catch{}
  return null;
}

function legacyKey(value){
  const current=validKey(value);if(current)return current;
  if(typeof value!=='string')return null;
  const colon=value.indexOf(':');
  if(colon<1)return null;
  try{return practiceQuestionKey({source:value.slice(0,colon),id:value.slice(colon+1)})}catch{return null}
}

function localStorageOrNull(){try{return globalThis.localStorage||null}catch{return null}}

export function createPracticeDraftStore(options={}){
  const storage=Object.prototype.hasOwnProperty.call(options,'storage')?options.storage:localStorageOrNull();
  const now=typeof options.now==='function'?options.now:Date.now;
  const storageKey=typeof options.storageKey==='string'?options.storageKey:STORAGE_KEY;
  const maxAnswerLength=boundedInteger(options.maxAnswerLength,12_000,1,24_000);
  const maxEntries=boundedInteger(options.maxEntries,160,1,500);
  const maxTotalCharacters=Math.max(maxAnswerLength,boundedInteger(options.maxTotalCharacters,200_000,1,400_000));
  const entries=new Map();
  let persistence=storage?'device':'memory',lastError=null,clock=0,migrated=false;
  const timestamp=()=>{const time=Number(now());clock=Math.max(clock+1,Number.isFinite(time)?Math.max(0,time):0);return clock};
  const characters=()=>[...entries.values()].reduce((total,entry)=>total+entry.text.length,0);
  const trim=()=>{
    const sorted=[...entries].sort((a,b)=>a[1].updatedAt-b[1].updatedAt||a[0].localeCompare(b[0]));
    let total=characters(),evicted=0;
    while(entries.size>maxEntries||total>maxTotalCharacters){const oldest=sorted.shift();if(!oldest)break;entries.delete(oldest[0]);total-=oldest[1].text.length;evicted++}
    return evicted;
  };
  const accept=(key,value)=>{
    key=validKey(key);if(!key)return;
    const text=typeof value==='string'?value:typeof value?.text==='string'?value.text:null;
    if(!text)return;
    const rawTime=Number(value?.updatedAt),updatedAt=Number.isFinite(rawTime)&&rawTime>=0?Math.min(rawTime,Math.max(0,Number(now())||0)+86_400_000):0;
    clock=Math.max(clock,updatedAt);entries.set(key,{text:boundedText(text,maxAnswerLength),updatedAt});
  };
  try{
    const raw=storage?.getItem(storageKey);
    if(raw){
      if(raw.length>MAX_SERIALIZED_CHARACTERS)throw new Error('draft-data-too-large');
      const saved=JSON.parse(raw);
      if(saved?.version===VERSION&&Array.isArray(saved.entries)){
        for(const entry of saved.entries.slice(-1000))if(entry&&typeof entry==='object')accept(entry.key,entry);
      }else if(saved?.version===1&&saved.drafts&&typeof saved.drafts==='object'&&!Array.isArray(saved.drafts)){
        for(const [key,value]of Object.entries(saved.drafts).slice(-1000)){const canonical=legacyKey(key);if(canonical)accept(canonical,value)}
        migrated=true;
      }
      trim();
    }
  }catch{persistence='memory';lastError='read'}
  const persist=()=>{
    if(!storage){persistence='memory';lastError='unavailable';return false}
    try{
      if(entries.size===0)storage.removeItem(storageKey);
      else storage.setItem(storageKey,JSON.stringify({version:VERSION,entries:[...entries].map(([key,entry])=>({key,...entry}))}));
      persistence='device';lastError=null;migrated=false;return true;
    }catch{persistence='memory';lastError='write';return false}
  };
  const status=()=>({persistence,lastError,entries:entries.size,characters:characters(),migrated,limits:{maxAnswerLength,maxEntries,maxTotalCharacters}});
  return {
    get:question=>entries.get(practiceQuestionKey(question))?.text||'',
    set(question,value){
      const key=practiceQuestionKey(question),answer=String(value??''),text=boundedText(answer,maxAnswerLength);
      if(text)entries.set(key,{text,updatedAt:timestamp()});else entries.delete(key);
      const evicted=trim(),stored=persist();return {text,persistence,stored,truncated:answer.length>maxAnswerLength,evicted};
    },
    remove(question){return this.set(question,'')},
    status,
    limits:Object.freeze({maxAnswerLength,maxEntries,maxTotalCharacters})
  };
}

let fallbackStore;
export function attachPracticeDraft(textarea,question,{store,statusElement}={}){
  const drafts=store||(fallbackStore??=createPracticeDraftStore());
  const restored=drafts.get(question);
  textarea.value=restored;
  textarea.maxLength=drafts.limits.maxAnswerLength;
  if(statusElement){
    statusElement.setAttribute('role','status');statusElement.setAttribute('aria-live','polite');
    if(statusElement.id){const describedBy=new Set((textarea.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean));describedBy.add(statusElement.id);textarea.setAttribute('aria-describedby',[...describedBy].join(' '))}
  }
  const updateStatus=(saved=null)=>{
    if(!statusElement)return;
    let message;
    if(drafts.status().persistence==='memory')message='Rascunho mantido apenas nesta aba: o armazenamento local está indisponível. Ele pode ser perdido ao fechar ou recarregar.';
    else if(saved)message=saved.text?'Rascunho salvo neste dispositivo.':'Rascunho apagado neste dispositivo.';
    else message=restored?'Rascunho restaurado deste dispositivo.':'O rascunho será salvo automaticamente neste dispositivo, sem envio para um servidor.';
    if(saved?.truncated)message+=' Foi mantido o limite de '+drafts.limits.maxAnswerLength.toLocaleString('pt-BR')+' caracteres.';
    if(saved?.evicted)message+=' O limite de armazenamento foi atingido; os rascunhos mais antigos foram removidos.';
    if(statusElement.textContent!==message)statusElement.textContent=message;
  };
  updateStatus();
  const onInput=()=>{const saved=drafts.set(question,textarea.value);if(saved.truncated)textarea.value=saved.text;updateStatus(saved)};
  textarea.addEventListener('input',onInput);
  return {save:onInput,dispose:()=>textarea.removeEventListener('input',onInput)};
}

export function normalizePracticeFeedback(question={}){
  const rubric=question.rubric;
  const criteria=Array.isArray(rubric)?rubric.flatMap(entry=>{
    if(typeof entry==='string'&&entry.trim())return[{criterion:entry,points:null}];
    if(!entry||typeof entry.criterion!=='string'||!entry.criterion.trim())return[];
    return[{criterion:entry.criterion,points:typeof entry.points==='number'&&Number.isFinite(entry.points)&&entry.points>=0?entry.points:null}];
  }):[];
  const strings=value=>Array.isArray(value)?value.filter(item=>typeof item==='string'&&item.trim()):[];
  const allCriteriaScored=criteria.length>0&&criteria.every(entry=>entry.points!==null);
  return {
    answer:typeof question.answer==='string'&&question.answer.trim()?question.answer:'Resposta-modelo não disponível para esta questão.',
    rubricText:typeof rubric==='string'?rubric:'',criteria,
    totalPoints:allCriteriaScored?criteria.reduce((sum,entry)=>sum+entry.points,0):typeof question.points==='number'&&Number.isFinite(question.points)&&question.points>=0?question.points:null,
    acceptedEquivalents:strings(question.acceptedEquivalents),commonErrors:strings(question.commonErrors)
  };
}

export function renderPracticeFeedback(question){
  const feedback=normalizePracticeFeedback(question);
  let html='<h3>Resposta-modelo</h3><p>'+escapeText(feedback.answer)+'</p><h3>Critérios para conferir a resposta</h3>';
  if(feedback.rubricText)html+='<p class="rubric">'+escapeText(feedback.rubricText)+'</p>';
  if(feedback.criteria.length)html+='<ul class="practice-rubric">'+feedback.criteria.map(entry=>'<li>'+escapeText(entry.criterion)+(entry.points===null?'':' <strong>('+pointLabel(entry.points)+')</strong>')+'</li>').join('')+'</ul>';
  if(!feedback.rubricText&&!feedback.criteria.length)html+='<p class="rubric">Confira os conceitos identificados, o mecanismo e a consequência explicada.</p>';
  if(feedback.totalPoints!==null)html+='<p>Pontuação de referência dos critérios: <strong>'+pointLabel(feedback.totalPoints)+'</strong>.</p>';
  for(const [key,title]of [['acceptedEquivalents','Formulações equivalentes aceitas'],['commonErrors','Erros frequentes a evitar']])if(feedback[key].length)html+='<h3>'+title+'</h3><ul>'+feedback[key].map(item=>'<li>'+escapeText(item)+'</li>').join('')+'</ul>';
  return html+'<p class="rubric">Use estes critérios para revisar o que você escreveu. O Atlas não atribui nota automática.</p>';
}
