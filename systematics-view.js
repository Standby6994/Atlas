// Systematics interface: the phylogenetic tree in the catalogue, the comparative physiology block in the
// details panel and the full comparison table. The app supplies navigation and 3D highlighting callbacks.
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e};
const fold=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();

export function createSystematicsView(content,{openView,openAtlas,showGroup,highlight,activeFunction}){
 const groups=new Map((content?.groups||[]).map(g=>[g.id,g])),views=new Map((content?.views||[]).map(v=>[v.id,v])),functions=content?.functions||[];
 const nodes=[],parents=new Map();(function walk(n,parent){nodes.push(n);if(parent)parents.set(n.id,parent);for(const c of n.children||[])walk(c,n)})(content?.tree||{id:'empty'},null);
 const leaves=nodes.filter(n=>n.groupId),viewOf=groupId=>leaves.find(n=>n.groupId===groupId)?.viewId||null,leafOf=groupId=>leaves.find(n=>n.groupId===groupId);
 const lineage=id=>{const out=[];for(let n=parents.get(id);n;n=parents.get(n.id))if(n.rank||n.trait)out.unshift(n);return out};
 const badge=n=>n.viewId&&views.has(n.viewId)?['3D','has-model']:n.atlasMode?['Atlas','atlas-model']:['texto','text-only'];

 function leafButton(n,activeView){const g=groups.get(n.groupId),b=el('button','phylo-leaf');b.type='button';b.dataset.systGroup=n.groupId;const [tag,kind]=badge(n);b.classList.toggle('active',!!activeView&&n.viewId===activeView);
  const text=el('span','item-text');text.append(el('strong',null,n.label),el('small',null,(n.rank||g?.rank||'')+(n.viewId&&views.get(n.viewId)?' · '+views.get(n.viewId).scientificName:'')));b.append(text,el('span','phylo-badge '+kind,tag));
  b.addEventListener('click',()=>{if(n.viewId&&views.has(n.viewId))openView(n.viewId);else if(n.atlasMode)openAtlas(n.atlasMode,n.groupId);else showGroup(n.groupId)});return b}
 function branch(n,activeView){
  if(!n.children?.length){const li=el('li','phylo-node leaf');li.append(leafButton(n,activeView));return li}
  const li=el('li','phylo-node'),d=el('details'),s=el('summary');d.open=true;s.append(el('strong',null,n.label));if(n.rank)s.append(el('small',null,n.rank));if(n.trait)s.append(el('span','phylo-trait',n.trait));d.append(s);
  const ul=el('ul','phylo-children');for(const c of n.children)ul.append(branch(c,activeView));d.append(ul);li.append(d);return li;
 }
 /** Catalogue: the tree, or a flat list of matching groups while searching. */
 function renderTree(container,{search='',activeView=null}={}){
  container.replaceChildren();const q=fold(search).trim();
  if(q){const hits=leaves.filter(n=>{const g=groups.get(n.groupId),v=views.get(n.viewId);return fold([n.label,g?.name,g?.examples,g?.rank,(g?.traits||[]).join(' '),v?.scientificName,(v?.parts||[]).map(p=>p.label).join(' ')].join(' ')).includes(q)});
   if(!hits.length)container.append(el('p','unavailable','Nenhum grupo encontrado. Tente o nome do grupo, de um exemplo ou de uma estrutura.'));for(const n of hits)container.append(leafButton(n,activeView));return hits.length}
  const tree=el('ul','phylo-tree');tree.setAttribute('aria-label','Árvore filogenética dos grupos estudados');tree.append(branch(content.tree,activeView));container.append(tree);
  container.append(el('p','phylo-note','A árvore mostra parentesco, não “evolução de simples para complexo”. Protistas, peixes e répteis tradicionais são agrupamentos parafiléticos, mantidos por serem usados no vestibular.'));return leaves.length;
 }
 /** Comparison of one function across every group, current group first. */
 function comparison(fn,currentGroup){
  const box=el('div','syst-compare-list');box.dataset.systFunction=fn;
  const order=[currentGroup,...leaves.map(n=>n.groupId).filter(id=>id!==currentGroup)].filter(id=>groups.has(id));
  for(const id of order){const g=groups.get(id),row=el('div','syst-compare-row'+(id===currentGroup?' current':'')),head=viewOf(id)&&id!==currentGroup?el('button','syst-compare-name',g.name):el('strong','syst-compare-name',g.name);if(head.tagName==='BUTTON'){head.type='button';head.addEventListener('click',()=>openView(viewOf(id)))}row.append(head,el('p',null,g.physiology?.[fn]||'—'));box.append(row)}
  return box;
 }
 function functionChips(onPick,current){const row=el('div','syst-functions');row.setAttribute('role','group');row.setAttribute('aria-label','Funções para comparar');for(const f of functions){const b=el('button','syst-function',f.short||f.name);b.type='button';b.dataset.function=f.id;b.setAttribute('aria-pressed',String(current===f.id));b.addEventListener('click',()=>onPick(current===f.id?null:f.id));row.append(b)}return row}
 function classification(group){
  const box=el('section','syst-classification'),path=lineage(leafOf(group.id)?.id).map(n=>n.label);box.append(el('h3',null,'Classificação'));
  box.append(el('p','syst-lineage',[...path,group.name].join(' › ')));const facts=el('dl','syst-facts');for(const [k,v] of [['Posição',group.rank],['Células',group.cell],['Organização',group.organization],['Exemplos',group.examples]]){if(!v)continue;facts.append(el('dt',null,k),el('dd',null,v))}box.append(facts);
  if(group.traits?.length){const ul=el('ul','syst-traits');for(const t of group.traits)ul.append(el('li',null,t));box.append(ul)}return box;
 }
 /** Details panel block for a group (with or without a 3D model on screen). */
 function appendPanel(panel,groupId,{viewId=null,onFunction=null}={}){
  const g=groups.get(groupId);if(!g)return;const fn=activeFunction(),wrap=el('section','syst-panel');wrap.dataset.systPanel=groupId;
  wrap.append(classification(g));
  const phys=el('section','syst-physiology');phys.append(el('h3',null,'Fisiologia comparada'));phys.append(el('p','syst-hint',viewId?'Escolha uma função: as estruturas correspondentes ficam destacadas no 3D e os outros grupos aparecem logo abaixo.':'Escolha uma função para comparar este grupo com os demais.'));
  phys.append(functionChips(next=>{(onFunction||highlight)(next)},fn));
  if(fn){const f=functions.find(x=>x.id===fn);phys.append(el('h4',null,f?.name||fn));phys.append(comparison(fn,groupId))}
  else{const dl=el('dl','syst-own');for(const f of functions){dl.append(el('dt',null,f.name),el('dd',null,g.physiology?.[f.id]||'—'))}phys.append(dl)}
  const table=el('button','syst-table-open','Tabela completa: todos os grupos × funções');table.type='button';table.addEventListener('click',()=>openTable(groupId));phys.append(table);wrap.append(phys);
  if(g.uerj||g.commonMistake){const tips=el('div','detail-block uerj');tips.append(el('h3',null,'Conexão com a discursiva UERJ'),el('p',null,g.uerj||''));wrap.append(tips);const m=el('div','detail-block mistake');m.append(el('h3',null,'Evite esta confusão'),el('p',null,g.commonMistake||''));wrap.append(m)}
  panel.append(wrap);return wrap;
 }
 let overlay=null;
 function openTable(focusGroup){
  overlay?.remove();overlay=el('div','syst-table-overlay');overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Tabela de fisiologia comparada');
  const card=el('div','syst-table-card'),head=el('div','syst-table-head'),close=el('button','syst-table-close','Fechar ✕');close.type='button';close.addEventListener('click',closeTable);head.append(el('h2',null,'Fisiologia comparada'),close);
  const hint=el('p','syst-hint','Toque no nome de um grupo para abrir o modelo 3D ou no título de uma coluna para destacar essa função no modelo aberto.');
  const scroll=el('div','syst-table-scroll'),table=el('table','syst-table'),thead=el('thead'),tr=el('tr');tr.append(el('th',null,'Grupo'));
  for(const f of functions){const th=el('th'),b=el('button',null,f.short||f.name);b.type='button';b.setAttribute('aria-pressed',String(activeFunction()===f.id));b.addEventListener('click',()=>{closeTable();highlight(f.id)});th.scope='col';th.append(b);tr.append(th)}thead.append(tr);table.append(thead);
  const body=el('tbody');for(const n of leaves){const g=groups.get(n.groupId);if(!g)continue;const row=el('tr');if(n.groupId===focusGroup)row.className='current';const th=el('th');th.scope='row';const v=n.viewId&&views.has(n.viewId);const name=v?el('button',null,g.name):el('span',null,g.name);if(v){name.type='button';name.addEventListener('click',()=>{closeTable();openView(n.viewId)})}th.append(name,el('small',null,g.rank));row.append(th);for(const f of functions){const td=el('td',null,g.physiology?.[f.id]||'—');if(activeFunction()===f.id)td.className='active';row.append(td)}body.append(row)}table.append(body);
  scroll.append(table);card.append(head,hint,scroll);overlay.append(card);overlay.addEventListener('click',e=>{if(e.target===overlay)closeTable()});overlay.addEventListener('keydown',e=>{if(e.key==='Escape')closeTable()});document.body.append(overlay);close.focus();
  requestAnimationFrame(()=>overlay?.querySelector('tr.current')?.scrollIntoView({block:'center'}));
 }
 function closeTable(){overlay?.remove();overlay=null}
 return{groups,views,functions,leaves,renderTree,appendPanel,openTable,closeTable,groupOfView:id=>groups.get(views.get(id)?.groupId),viewOf,stats:()=>({groups:groups.size,views:views.size,leaves:leaves.length,withModel:leaves.filter(n=>n.viewId&&views.has(n.viewId)).length})};
}
