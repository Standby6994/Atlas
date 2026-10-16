import * as THREE from 'three';
import {computeBoundsTree, acceleratedRaycast} from './vendor/bvh/index.module.js';

// Build once in idle slices; geometry and triangle detail are never simplified.
THREE.Mesh.prototype.raycast=acceleratedRaycast;
const queue=new Set(),queued=new WeakSet(),disposeListeners=new WeakMap();let scheduled=false;
const now=()=>globalThis.performance?.now?.()??Date.now();
const SLICE_MS=4,MAX_TREES_PER_SLICE=2;
const idle=globalThis.requestIdleCallback||((fn)=>setTimeout(()=>{
  const started=now();
  fn({timeRemaining:()=>Math.max(0,SLICE_MS-(now()-started))});
},20));
function buildSlice(deadline){
  scheduled=false;let done=0;const started=now();
  // One individual tree cannot be interrupted. Limit both elapsed time and
  // tree count so Safari's timer fallback always yields between small batches.
  while(queue.size&&done<MAX_TREES_PER_SLICE&&
    (done===0||(now()-started<SLICE_MS&&deadline.timeRemaining()>2))){
    const geometry=queue.values().next().value;queue.delete(geometry);
    try{computeBoundsTree.call(geometry,{indirect:true,maxLeafTris:12})}catch(error){console.warn('Índice de seleção indisponível; seleção padrão preservada.',error)}
    done++;
  }
  if(queue.size)schedule();
}
function schedule(){if(!scheduled){scheduled=true;idle(buildSlice,{timeout:300})}}
// A cached model may be evicted before its idle slice runs. Cancel pending
// indexing and release its CPU tree together with the geometry's GPU buffers.
export function releasePickingGeometry(geometry){
  queue.delete(geometry);queued.delete(geometry);geometry.boundsTree=null;
  const onDispose=disposeListeners.get(geometry);
  if(onDispose){geometry.removeEventListener('dispose',onDispose);disposeListeners.delete(geometry)}
}
export function preparePickingMesh(mesh){
  const geometry=mesh.geometry;
  if(!geometry.boundingBox)geometry.computeBoundingBox();
  mesh.updateWorldMatrix(true,false);
  mesh.userData.pickBounds=geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
  if(!queued.has(geometry)){
    const onDispose=()=>releasePickingGeometry(geometry);
    disposeListeners.set(geometry,onDispose);geometry.addEventListener('dispose',onDispose);
    queued.add(geometry);queue.add(geometry);schedule();
  }
}
export function refreshPickCandidates(meshes){
  return meshes.filter(mesh=>{
    let parent=mesh;while(parent){if(!parent.visible)return false;parent=parent.parent}
    const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    return materials.some(material=>material.opacity>.25);
  });
}
export function raycastVisible(raycaster,candidates,planes){
  // When cutting, search all hits so a clipped front face cannot hide a valid back face.
  raycaster.firstHitOnly=planes.length===0;
  const narrowed=candidates.filter(mesh=>raycaster.ray.intersectsBox(mesh.userData.pickBounds));
  const hits=raycaster.intersectObjects(narrowed,false);
  return hits.find(hit=>!planes.some(plane=>plane.distanceToPoint(hit.point)<0));
}
