import * as THREE from 'three';

// Draw batching for the whole-body systems. A system has hundreds of static meshes (676 vessels, 575 bones)
// but only a few materials, and every mesh used to cost one draw call. Meshes are merged per source material
// into proxy meshes; geometry groups then draw only the meshes that currently look like the rest of their
// batch. The original meshes stay in the scene for picking, bounds and x-ray, moved to BATCHED_LAYER so the
// camera skips them. A mesh that differs (selected, faded cover, custom opacity) leaves the batch and draws
// itself; a hidden mesh drops out of both. Geometry is never simplified.

export const BATCHED_LAYER=1;
// Bounds the temporary memory of one merge on tablets and keeps batches regional, so frustum culling still skips
// the parts of the body that are off screen when the camera is close to an organ.
const MAX_TRIANGLES=250000;
const ATTRIBUTES=['position','normal','uv','color'];
const matrix=new THREE.Matrix4(),normalMatrix=new THREE.Matrix3(),vector=new THREE.Vector3();

function visibleUpTo(object,stop){for(let o=object;o&&o!==stop;o=o.parent)if(!o.visible)return false;return true}
const triangles=geometry=>(geometry.index?geometry.index.count:geometry.attributes.position.count)/3;

function signature(mesh){
  const g=mesh.geometry,m=mesh.userData.originalMaterial;
  if(!g?.attributes.position||Array.isArray(m)||!m||g.morphAttributes.position||mesh.isSkinnedMesh||mesh.isInstancedMesh)return null;
  return m.uuid+'|'+ATTRIBUTES.filter(n=>g.attributes[n]).map(n=>n+g.attributes[n].itemSize).join(',')+'|'+(g.index?'i':'n');
}

function merge(meshes,inverse){
  const first=meshes[0].geometry,names=ATTRIBUTES.filter(n=>first.attributes[n]);
  let vertices=0,indices=0;for(const {geometry:g} of meshes){vertices+=g.attributes.position.count;indices+=g.index?g.index.count:g.attributes.position.count}
  const arrays=Object.fromEntries(names.map(n=>[n,new Float32Array(vertices*first.attributes[n].itemSize)]));
  const index=vertices>65535?new Uint32Array(indices):new Uint16Array(indices),ranges=[];
  let vOffset=0,iOffset=0;
  for(const mesh of meshes){
    const g=mesh.geometry,count=g.attributes.position.count;
    matrix.multiplyMatrices(inverse,mesh.matrixWorld);normalMatrix.getNormalMatrix(matrix);
    for(const name of names){
      const source=g.attributes[name],target=arrays[name],size=source.itemSize;
      for(let i=0;i<count;i++){
        const o=(vOffset+i)*size;
        if(name==='position'||name==='normal'){
          vector.fromBufferAttribute(source,i);
          if(name==='position')vector.applyMatrix4(matrix);else vector.applyNormalMatrix(normalMatrix);
          target[o]=vector.x;target[o+1]=vector.y;target[o+2]=vector.z;
        }else{target[o]=source.getX(i);if(size>1)target[o+1]=source.getY(i);if(size>2)target[o+2]=source.getZ(i);if(size>3)target[o+3]=source.getW(i)}
      }
    }
    const n=g.index?g.index.count:count;
    if(g.index)for(let j=0;j<n;j++)index[iOffset+j]=g.index.getX(j)+vOffset;else for(let j=0;j<n;j++)index[iOffset+j]=j+vOffset;
    // Mirrored meshes (negative scale) are drawn with reversed winding by three.js; once baked, flip them explicitly.
    if(matrix.determinant()<0)for(let j=iOffset;j+2<iOffset+n;j+=3){const t=index[j+1];index[j+1]=index[j+2];index[j+2]=t}
    ranges.push({mesh,start:iOffset,count:n});vOffset+=count;iOffset+=n;
  }
  const geometry=new THREE.BufferGeometry();
  // The GPU keeps the merged buffers; the CPU copy is released after upload (the originals keep theirs for picking).
  const release=function(){this.array=null};
  for(const name of names)geometry.setAttribute(name,new THREE.BufferAttribute(arrays[name],first.attributes[name].itemSize).onUpload(release));
  geometry.setIndex(new THREE.BufferAttribute(index,1).onUpload(release));
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return{geometry,ranges};
}

export function createRenderBatches(parent,onChange=()=>{}){
  const root=new THREE.Group();root.name='render-batches';parent.add(root);
  const systems=new Map();let queue=Promise.resolve();

  function release(id){
    const batches=systems.get(id);if(!batches)return;systems.delete(id);
    for(const batch of batches){root.remove(batch.proxy);batch.proxy.geometry.dispose();for(const {mesh} of batch.ranges)mesh.layers.set(0)}
  }
  // Merges run one chunk per task so loading stays responsive; meshes keep drawing themselves until their chunk is ready.
  function build(id,container){
    release(id);const batches=[],groups=new Map();systems.set(id,batches);
    container.traverse(mesh=>{if(!mesh.isMesh||!mesh.userData.atlasName)return;const key=signature(mesh);if(!key)return;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(mesh)});
    for(const [key,meshes] of groups)if(meshes.length<3)groups.delete(key);
    // Hide the batchable originals right away so their buffers are never uploaded twice; each chunk appears when merged.
    for(const meshes of groups.values())for(const mesh of meshes)mesh.layers.set(BATCHED_LAYER);
    queue=queue.then(async()=>{
      root.updateWorldMatrix(true,false);container.updateMatrixWorld(true);
      const inverse=root.matrixWorld.clone().invert();
      const center=new THREE.Vector3(),height=new Map();
      for(const meshes of groups.values()){
        // Slice each material group by height (then side), so a batch covers one region of the body.
        for(const mesh of meshes){mesh.geometry.boundingBox||mesh.geometry.computeBoundingBox();mesh.geometry.boundingBox.getCenter(center).applyMatrix4(mesh.matrixWorld);height.set(mesh,[Math.round(center.y*12),center.x])}
        meshes.sort((a,b)=>height.get(a)[0]-height.get(b)[0]||height.get(a)[1]-height.get(b)[1]);
        for(let i=0;i<meshes.length;){
          const chunk=[];let size=0;
          while(i<meshes.length&&(chunk.length===0||size+triangles(meshes[i].geometry)<=MAX_TRIANGLES)){size+=triangles(meshes[i].geometry);chunk.push(meshes[i++])}
          if(systems.get(id)!==batches)return;
          const {geometry,ranges}=merge(chunk,inverse),proxy=new THREE.Mesh(geometry,[chunk[0].material]);
          proxy.name=id+'-batch';proxy.matrixAutoUpdate=false;proxy.raycast=()=>{};proxy.userData.renderBatch=true;
          root.add(proxy);batches.push({proxy,ranges});sync();onChange();
          await new Promise(resolve=>setTimeout(resolve,0));
        }
      }
    }).catch(error=>{console.warn('Agrupamento de desenho indisponível; as peças continuam sendo desenhadas individualmente.',error);release(id);for(const meshes of groups.values())for(const mesh of meshes)mesh.layers.set(0);onChange()});
    return queue;
  }
  // Call after anything that changes mesh visibility or materials.
  function sync(){
    for(const batches of systems.values())for(const batch of batches){
      const counts=new Map();
      for(const {mesh} of batch.ranges)if(visibleUpTo(mesh,parent.parent)&&!Array.isArray(mesh.material))counts.set(mesh.material,(counts.get(mesh.material)||0)+1);
      let material=null,best=0;for(const [m,c] of counts)if(c>best){best=c;material=m}
      const groups=[];
      for(const {mesh,start,count} of batch.ranges){
        const batched=material!==null&&mesh.material===material&&visibleUpTo(mesh,parent.parent);
        mesh.layers.set(batched?BATCHED_LAYER:0);
        if(!batched)continue;
        const last=groups.at(-1);if(last&&last.start+last.count===start)last.count+=count;else groups.push({start,count,materialIndex:0});
      }
      batch.proxy.geometry.groups=groups;batch.proxy.visible=groups.length>0;if(material)batch.proxy.material=[material];
    }
  }
  // After a lost WebGL context the released CPU copies are gone: rebuild every batch from the originals.
  function rebuildAll(containers){for(const [id,container] of Object.entries(containers))if(systems.has(id))build(id,container)}
  // Debug/verification: draw every original individually again (true) or return to batching (false).
  function bypass(flag){root.visible=!flag;if(flag){for(const batches of systems.values())for(const b of batches)for(const {mesh} of b.ranges)mesh.layers.set(0)}else sync()}
  return{build,sync,release,rebuildAll,bypass,stats:()=>[...systems.values()].reduce((s,b)=>s+b.length,0)};
}
