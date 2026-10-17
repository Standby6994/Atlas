// Registry of Systematics organisms. Imported by systematics-worker.js and, as a fallback, by the page.
import {createBuilder} from './systematics-geometry.js';
import {ecoli,halobacterium,paramecium} from './systematics-microbes.js';
import {earthworm,locust,snail,seastar,sponge,planarian,roundworm,hydra,volvox} from './systematics-invertebrates.js';
import {carp,frog,lizard,falcon} from './systematics-vertebrates.js';
import {moss,fern,pine,lily,mushroom} from './systematics-plants.js';

export const BUILDERS={'escherichia-coli':ecoli,halobacterium,paramecium,'lumbricus':earthworm,'cyprinus':carp,'pelophylax':frog,'locusta':locust,'takydromus':lizard,'falco':falcon,'euhadra':snail,'patiria':seastar,'pogonatum':moss,'dryopteris':fern,'pinus':pine,'lilium':lily,'cogumelo':mushroom,'aplysina':sponge,'dugesia':planarian,'ascaris':roundworm,'hydra':hydra,'volvox':volvox};
export function buildOrganism(id,{mobile=false}={}){
 const build=BUILDERS[id];if(!build)throw new Error('Organismo sem modelo: '+id);
 const t=performance.now(),b=createBuilder({mobile});build(b);const out=b.finish();out.stats.buildMs=Math.round(performance.now()-t);out.stats.profile=mobile?'touch':'desktop';return out;
}
