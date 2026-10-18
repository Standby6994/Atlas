// Study backup: annotations (board), discursive drafts, quiz progress and the last study session live only in this
// device's localStorage. They are saved to a JSON file the student keeps (Files, iCloud, AirDrop) and restored from it.
// Device-specific tuning (motion resolution) stays out of the file.
const KIND='atlas-study-backup',VERSION=1,MAX_CHARS=8e6;
const KEPT=/^atlas-(board-.+|practice-drafts|quiz-.+|study-session-v\d+)$/;

function storage(){try{return globalThis.localStorage||null}catch{return null}}

/** Every kept key with its raw text. */
export function collectStudyData(store=storage()){
  const entries={};if(!store)return entries;
  for(let i=0;i<store.length;i++){const key=store.key(i);if(key&&KEPT.test(key)){const value=store.getItem(key);if(typeof value==='string')entries[key]=value}}
  return entries;
}
export function studyBackupBlob(store=storage()){
  const entries=collectStudyData(store);
  return{count:Object.keys(entries).length,blob:new Blob([JSON.stringify({app:'Atlas Humano',kind:KIND,version:VERSION,createdAt:new Date().toISOString(),entries})],{type:'application/json'})};
}
/** Reads a backup file; throws a message in Portuguese when it is not one. */
export async function readStudyBackup(file){
  if(!file||file.size>MAX_CHARS)throw new Error('Arquivo grande demais ou vazio.');
  let data;try{data=JSON.parse(await file.text())}catch{throw new Error('O arquivo não é um backup do Atlas.')}
  if(data?.kind!==KIND||typeof data.entries!=='object'||!data.entries)throw new Error('O arquivo não é um backup do Atlas.');
  if(data.version>VERSION)throw new Error('Backup de uma versão mais nova do Atlas. Atualize o app e tente de novo.');
  const entries=Object.fromEntries(Object.entries(data.entries).filter(([key,value])=>KEPT.test(key)&&typeof value==='string'));
  return{entries,count:Object.keys(entries).length,createdAt:data.createdAt||null};
}
/** Writes the entries over this device's copies; keys not in the file are kept. */
export function restoreStudyData(entries,store=storage()){
  if(!store)throw new Error('O armazenamento deste navegador está indisponível.');
  try{for(const [key,value] of Object.entries(entries))store.setItem(key,value)}
  catch{throw new Error('A memória deste aparelho para o Atlas está cheia. Apague anotações antigas e tente de novo.')}
}
