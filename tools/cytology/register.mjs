// Registers every cytology pack in assets/cytology/real: REAL_PACKS in cytology-real.js (id → version, only views with
// both profiles) and the service worker (files in APP_ASSETS, SHA-256 in CONTENT_SHA256). Older versions of a pack are
// left on disk but leave the lists. Run after build-cosem.mjs / build-pdb.mjs:
//   node tools/cytology/register.mjs
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),DIR='assets/cytology/real';
const files=readdirSync(path.join(ROOT,DIR)).filter(f=>/^[a-z0-9-]+-(desktop|touch)-r\d+\.bin$/.test(f));
const latest=new Map();
for(const f of files){const [,id,profile,v]=f.match(/^(.+)-(desktop|touch)-r(\d+)\.bin$/);const e=latest.get(id)||{version:0,profiles:{}};if(+v>e.version){e.version=+v;e.profiles={}}if(+v===e.version)e.profiles[profile]=f;latest.set(id,e)}
const packs=[...latest].filter(([,e])=>e.profiles.desktop&&e.profiles.touch).sort(([a],[b])=>a.localeCompare(b));

// cytology-real.js
const realFile=path.join(ROOT,'cytology-real.js');let real=readFileSync(realFile,'utf8');
const body=packs.map(([id,e])=>"  '"+id+"':{version:'r"+e.version+"'},").join('\n');
real=real.replace(/export const REAL_PACKS=Object\.freeze\(\{[\s\S]*?\n\}\);/,'export const REAL_PACKS=Object.freeze({\n'+body+'\n});');writeFileSync(realFile,real);

// service-worker.js
const swFile=path.join(ROOT,'service-worker.js');let sw=readFileSync(swFile,'utf8');
const wanted=packs.flatMap(([,e])=>[e.profiles.desktop,e.profiles.touch]).map(f=>DIR+'/'+f);
const strip=(text,re)=>text.split('\n').filter(l=>!re.test(l)).join('\n');
sw=strip(sw,/^\s*"assets\/cytology\/real\/[^"]+\.bin"(: "[0-9a-f]{64}")?,?$/);
sw=sw.replace('const APP_ASSETS = [\n','const APP_ASSETS = [\n'+wanted.map(f=>'  "'+f+'",\n').join(''));
const hashes=wanted.map(f=>'  "'+f+'": "'+createHash('sha256').update(readFileSync(path.join(ROOT,f))).digest('hex')+'",');
sw=sw.replace('const CONTENT_SHA256 = {\n','const CONTENT_SHA256 = {\n'+hashes.join('\n')+'\n');
writeFileSync(swFile,sw);
// Credits of every pack (ATTRIBUTION.md beside them) and the content of each converted view: its limits come from the
// pack notes and its sources include the data repository.
import {gunzipSync} from 'node:zlib';
const metaOf=f=>{const raw=gunzipSync(readFileSync(path.join(ROOT,f))),n=raw.readUInt32LE(8);return JSON.parse(raw.subarray(12,12+n).toString('utf8'))};
const SOURCES={openorganelle:{id:'openorganelle-cosem',title:'OpenOrganelle — células imageadas por FIB-SEM e segmentadas por organela (HHMI Janelia, CC BY 4.0)',url:'https://openorganelle.janelia.org/',kind:'banco de dados científico aberto',publisher:'HHMI Janelia Research Campus',accessedOn:'2026-10-18'},
  pdb:{id:'wwpdb-structures',title:'Protein Data Bank — estruturas moleculares determinadas experimentalmente (wwPDB, CC0)',url:'https://www.rcsb.org/',kind:'banco de dados científico aberto',publisher:'wwPDB / RCSB PDB',accessedOn:'2026-10-18'}};
const contentFile=path.join(ROOT,'data/cytology-content.json'),content=JSON.parse(readFileSync(contentFile,'utf8'));
for(const s of Object.values(SOURCES))if(!content.sources.some(x=>x.id===s.id))content.sources.push(s);
const lines=['# Modelos reais da citologia — créditos','','Gerado por `tools/cytology/register.mjs`. Cada vista abaixo usa dados de repositórios científicos abertos ou é um modelo autoral feito a partir de dimensões publicadas (indicado em cada item); as alterações feitas para o Atlas estão descritas em cada item.',''];
for(const [id,e] of packs){const meta=metaOf(DIR+'/'+e.profiles.desktop),view=content.views.find(v=>v.id===id);
  if(view){view.limits=meta.notes;const src=[];if(meta.credits.some(c=>/OpenOrganelle/.test(c.title)))src.push(SOURCES.openorganelle.id);if(meta.credits.some(c=>/Protein Data Bank/.test(c.title)))src.push(SOURCES.pdb.id);view.sourceIds=[...new Set([...(view.sourceIds||[]),...src])]}
  lines.push('## '+(view?.title||id)+' (`'+id+'`)','',meta.notes,'');for(const c of meta.credits)lines.push('- '+c.title+' — '+c.author+'. Licença: '+c.license+'. '+c.url,'  - '+c.citation,'  - '+(/autoral/.test(c.title)?'Base: ':'Alterações: ')+c.changes);lines.push('')}
writeFileSync(contentFile,JSON.stringify(content,null,2)+'\n');writeFileSync(path.join(ROOT,DIR,'ATTRIBUTION.md'),lines.join('\n'));
if(!sw.includes('"'+DIR+'/ATTRIBUTION.md"')){sw=sw.replace('const APP_ASSETS = [\n','const APP_ASSETS = [\n  "'+DIR+'/ATTRIBUTION.md",\n');writeFileSync(swFile,sw)}
const total=wanted.reduce((n,f)=>n+readFileSync(path.join(ROOT,f)).length,0);
console.log(packs.length+' vistas com pacote real: '+packs.map(([id])=>id).join(', ')+'\n'+wanted.length+' arquivos, '+(total/1048576).toFixed(1)+' MB (os dois perfis)');
