// Registry of Systematics organisms. Imported by systematics-worker.js and, as a fallback, by the page.
import {createBuilder} from './systematics-geometry.js';
import {ecoli,halobacterium,paramecium} from './systematics-microbes.js';

export const BUILDERS={'escherichia-coli':ecoli,halobacterium,paramecium};
export function buildOrganism(id,{mobile=false}={}){
 const build=BUILDERS[id];if(!build)throw new Error('Organismo sem modelo: '+id);
 const t=performance.now(),b=createBuilder({mobile});build(b);const out=b.finish();out.stats.buildMs=Math.round(performance.now()-t);out.stats.profile=mobile?'touch':'desktop';return out;
}
