// Builds Systematics organisms off the main thread; the page only uploads the finished arrays.
import {buildOrganism} from './systematics-builders.js';

self.onmessage=event=>{
 const {job,id,mobile}=event.data;
 try{const out=buildOrganism(id,{mobile});self.postMessage({job,parts:out.parts,stats:out.stats},out.transfer)}
 catch(error){self.postMessage({job,error:String(error?.message||error)})}
};
