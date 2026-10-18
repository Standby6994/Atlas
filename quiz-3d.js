// Identification quiz on the 3D body: "Toque: fígado". The student taps the model as usual (the tap still selects
// the part, so a wrong answer shows what was touched). Spaced repetition per structure (Leitner boxes, saved on this
// device and in the study backup): missed structures return soon, known ones after days.
const STORAGE='atlas-quiz-v1';
const DAY=864e5,INTERVALS=[60e3,10*60e3,DAY,3*DAY,7*DAY,21*DAY];

function load(){try{const data=JSON.parse(localStorage.getItem(STORAGE)||'{}');return data&&typeof data.items==='object'?data:{items:{}}}catch{return{items:{}}}}
function save(data){try{localStorage.setItem(STORAGE,JSON.stringify(data))}catch{}}

/** app: {candidates() → [{id,name,system,shortFunction}], open() → Promise<boolean>, reveal(id), clearSelection(), toast(text)} */
export function createQuiz3D({bar,app}){
  const $=id=>bar.querySelector('#'+id);
  const ui={prompt:$('quiz-prompt'),hint:$('quiz-hint'),feedback:$('quiz-feedback'),score:$('quiz-score'),show:$('quiz-show'),next:$('quiz-next'),close:$('quiz-close')};
  let active=false,target=null,missed=false,solved=false,right=0,answered=0,recent=[];const data=load();

  // Due structures first (lowest box, then seen longest ago, a little shuffled); never the last few asked.
  function choose(){
    const all=app.candidates(),pool=all.filter(c=>!recent.includes(c.id)),list=pool.length?pool:all;if(!list.length)return null;
    const now=Date.now(),stat=c=>data.items[c.id]||{box:0,due:0,seen:0},due=list.filter(c=>stat(c).due<=now);
    if(!due.length)return list.reduce((a,b)=>stat(b).due<stat(a).due?b:a);
    const low=Math.min(...due.map(c=>stat(c).box)),group=due.filter(c=>stat(c).box===low).sort((a,b)=>stat(a).seen-stat(b).seen).slice(0,8);
    return group[Math.floor(Math.random()*group.length)];
  }
  function grade(ok){
    const item=data.items[target.id]||{box:0,due:0,seen:0,right:0,wrong:0};
    item.box=ok?Math.min(INTERVALS.length-1,item.box+1):0;item.due=Date.now()+INTERVALS[item.box];item.seen=Date.now();item[ok?'right':'wrong']++;
    data.items[target.id]=item;save(data);
  }
  function ask(){
    target=choose();missed=false;solved=false;app.clearSelection();
    if(!target){ui.prompt.textContent='Nenhuma estrutura disponível nas camadas visíveis.';ui.hint.textContent='Ligue mais camadas do corpo (Ajustes → camadas) e tente de novo.';return}
    recent=[target.id,...recent].slice(0,4);
    ui.prompt.innerHTML='Toque: <strong></strong>';ui.prompt.querySelector('strong').textContent=target.name;
    const box=data.items[target.id]?.box;ui.hint.textContent=target.systemLabel+(box?' · acertos seguidos: '+box:' · estrutura nova');
    ui.feedback.textContent='';ui.next.hidden=true;ui.show.hidden=false;updateScore();
  }
  function updateScore(){ui.score.textContent=answered?right+' de '+answered+' de primeira':''}
  function finish(ok,text){solved=true;answered++;if(!missed)grade(ok);if(ok&&!missed)right++;ui.feedback.textContent=text;ui.show.hidden=true;ui.next.hidden=false;updateScore();ui.next.focus({preventScroll:true})}

  ui.show.addEventListener('click',()=>{if(!target||solved)return;missed=true;grade(false);app.reveal(target.id);finish(false,'É esta: '+target.name+'. '+(target.shortFunction||'')+' Ela volta logo para você treinar.')});
  ui.next.addEventListener('click',ask);
  ui.close.addEventListener('click',()=>api.stop());
  bar.addEventListener('keydown',e=>{if(e.key==='Escape')api.stop()});

  const api={
    get active(){return active},
    async start(){active=true;bar.hidden=false;right=0;answered=0;recent=[];ui.prompt.textContent='Abrindo o corpo…';ui.hint.textContent='';ui.feedback.textContent='';ui.next.hidden=true;ui.show.hidden=true;
      if(!await app.open()){api.stop();app.toast('Não foi possível abrir o corpo para o quiz.');return}ask()},
    stop(){active=false;bar.hidden=true;target=null},
    /** A tap selected this registry entry while the quiz is open. */
    answer(entry){
      if(!active||!target||solved||!entry)return;
      if(entry.coreId===target.id){finish(true,(missed?'Isso, é esta. ':'✓ Certo! ')+(target.shortFunction||''));return}
      if(!missed){missed=true;grade(false)}
      ui.feedback.textContent='✗ Isso é '+(entry.pt||entry.name)+'. Tente de novo ou toque em "Mostrar".';
    }
  };
  return api;
}
