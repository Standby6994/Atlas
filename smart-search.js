// Deterministic, local spelling suggestions. Nothing typed leaves the device.
const fold = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const words = value => fold(value).split(' ').filter(w => w.length > 2);
const STOP = new Set(['para','com','uma','das','dos','que','por','sua','seu','the','and','left','right']);
const grams = word => new Set(Array.from({length:Math.max(0,word.length-1)},(_,i)=>word.slice(i,i+2)));

function distance(a,b,limit=2) {
  if(Math.abs(a.length-b.length)>limit)return limit+1;
  let previousPrevious=null,previous=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    const row=[i];let minimum=i;
    for(let j=1;j<=b.length;j++){
      let v=Math.min(row[j-1]+1,previous[j]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));
      if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])v=Math.min(v,previousPrevious[j-2]+1);
      row[j]=v;minimum=Math.min(minimum,v);
    }
    if(minimum>limit)return limit+1;
    previousPrevious=previous;previous=row;
  }
  return previous[b.length];
}

export function createSmartSearch(entries) {
  const records=entries.map((e,index)=>({...e,index,titleText:fold(e.title),text:fold([e.title,...e.terms||[],e.description||''].join(' '))}));
  const vocabulary=new Map(),postings=new Map();
  for(const record of records){
    for(const word of new Set(words([record.title,...record.terms||[]].join(' ')).filter(w=>!STOP.has(w)))){
      if(!vocabulary.has(word))vocabulary.set(word,[]);
      vocabulary.get(word).push(record.index);
    }
  }
  for(const word of vocabulary.keys())for(const gram of grams(word)){
    if(!postings.has(gram))postings.set(gram,new Set());postings.get(gram).add(word);
  }
  return query => {
    const text=fold(query),tokens=words(query).filter(w=>!STOP.has(w));
    if(!text)return {items:records,approximate:false};
    const exact=records.filter(r=>r.text.includes(text)||tokens.length>1&&tokens.every(t=>r.text.includes(t)))
      .sort((a,b)=>(b.titleText===text)-(a.titleText===text)||(b.titleText.startsWith(text))-(a.titleText.startsWith(text))||a.title.localeCompare(b.title,'pt-BR'));
    if(exact.length||!tokens.length)return {items:exact,approximate:false};
    const recordScores=new Map();
    for(const token of tokens){
      const tokenGrams=grams(token),counts=new Map();
      for(const gram of tokenGrams)for(const word of postings.get(gram)||[])counts.set(word,(counts.get(word)||0)+1);
      const candidates=[...counts].map(([word,count])=>({word,dice:2*count/(tokenGrams.size+grams(word).size)}))
        .filter(x=>x.dice>=.3&&Math.abs(x.word.length-token.length)<=3).sort((a,b)=>b.dice-a.dice).slice(0,96);
      const tokenScores=new Map(),limit=token.length>7?3:token.length>3?2:1;
      for(const {word,dice} of candidates){const d=distance(token,word,limit);if(d>limit)continue;
        const score=1-d/Math.max(token.length,word.length)+dice*.15;
        for(const index of vocabulary.get(word))tokenScores.set(index,Math.max(tokenScores.get(index)||0,score));
      }
      for(const [index,score] of tokenScores){const current=recordScores.get(index)||{score:0,count:0};current.score+=score;current.count++;recordScores.set(index,current)}
    }
    const items=[...recordScores].filter(([,s])=>s.count===tokens.length).sort((a,b)=>b[1].score-a[1].score||records[a[0]].title.localeCompare(records[b[0]].title,'pt-BR')).slice(0,30).map(([index])=>records[index]);
    return {items,approximate:items.length>0};
  };
}
