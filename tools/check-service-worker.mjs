// Checks the service-worker lists against the files in the folder, before publishing.
//   node tools/check-service-worker.mjs        report: missing files, wrong hashes, files left out of the lists
//   node tools/check-service-worker.mjs --fix  also rewrite every wrong hash in CONTENT_SHA256
// A wrong hash makes the worker refuse that file forever: it never works offline, "Baixar para usar off-line"
// never completes and the caches of old versions are never deleted. Exit code 1 while anything is wrong.
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync,statSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const SW=path.join(ROOT,'service-worker.js'),fix=process.argv.includes('--fix');
let source=readFileSync(SW,'utf8');
const list=name=>{const m=source.match(new RegExp('const '+name+' = \\[([\\s\\S]*?)\\];'));if(!m)throw new Error(name+' não encontrado');return[...m[1].matchAll(/"([^"]+)"/g)].map(x=>x[1])};
const app=list('APP_ASSETS'),models=list('MODEL_ASSETS'),listed=new Set([...app,...models]);
const hashes=[...source.matchAll(/^\s*"([^"]+)": "([0-9a-f]{64})"/gm)].map(m=>({file:m[1],expected:m[2]}));
const sha=file=>createHash('sha256').update(readFileSync(path.join(ROOT,file))).digest('hex');
const problems=[];

for(const file of listed)if(!existsSync(path.join(ROOT,file)))problems.push('listado, mas não existe: '+file);
for(const file of [...app,...models].filter((f,i,a)=>a.indexOf(f)!==i))problems.push('listado duas vezes: '+file);
for(const file of listed)if(existsSync(path.join(ROOT,file))&&statSync(path.join(ROOT,file)).size>32*1024*1024)problems.push('maior que MAX_ASSET_BYTES (32 MB): '+file);
let fixed=0;
for(const {file,expected} of hashes){
  if(!listed.has(file))problems.push('hash de arquivo fora das listas: '+file);
  if(!existsSync(path.join(ROOT,file)))continue;
  const actual=sha(file);if(actual===expected)continue;
  if(fix){source=source.replace(`"${file}": "${expected}"`,`"${file}": "${actual}"`);fixed++}
  else problems.push('hash errado: '+file+' (esperado '+expected.slice(0,12)+'…, arquivo '+actual.slice(0,12)+'…)');
}
for(const file of models)if(!hashes.some(h=>h.file===file)&&/\.(glb|bin)$/.test(file))problems.push('modelo sem hash em CONTENT_SHA256: '+file);

// Files the app can request that are not cached (they would fail offline).
const walk=dir=>readdirSync(path.join(ROOT,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]);
const candidates=[...readdirSync(ROOT).filter(f=>f.endsWith('.js')&&f!=='service-worker.js'),...['data','assets','models','images','icons'].flatMap(walk)];
for(const file of candidates)if(!listed.has(file))problems.push('fora das listas (não funciona off-line): '+file);

if(fixed){writeFileSync(SW,source);console.log(fixed+' hash(es) corrigido(s) em service-worker.js. Incremente APP_VERSION (e MODEL_VERSION se um GLB mudou).')}
const total=[...listed].filter(f=>existsSync(path.join(ROOT,f))).reduce((n,f)=>n+statSync(path.join(ROOT,f)).size,0);
console.log(`${app.length} arquivos do app, ${models.length} modelos, ${hashes.length} hashes, ${(total/1048576).toFixed(0)} MB no total.`);
if(problems.length){console.log(problems.map(p=>'- '+p).join('\n'));process.exitCode=1}else console.log('Tudo certo.');
