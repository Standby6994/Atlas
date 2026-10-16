import * as THREE from 'three';

// Authored stomach surfaces are generated once during production. Loading their
// checked binary representation avoids surface-generation work on the iPad.
// Reproducible generator and scientific notes: v18-staging/stomach, build-stomach-assets.
// This is a teaching reconstruction, not a scan, microscope image or photograph.
export const stomachInteriorSources=Object.freeze(['https://training.seer.cancer.gov/anatomy/digestive/regions/stomach.html','https://openstax.org/books/anatomy-and-physiology-2e/pages/23-4-the-stomach','https://histology.leeds.ac.uk/home/digestive/stomach/','https://histologyguide.com/slideview/MH-112-fundic-stomach/14-slide-1.html']);
const KEYS=['serosa','muscularis','mucosa','cardia','fundus','body','pylorus','rugae','submucosa'];
const LABELS=['Serosa gástrica','Camadas musculares','Mucosa gástrica','Cárdia','Fundo gástrico','Corpo gástrico','Piloro e canal pilórico','Pregas gástricas','Submucosa gástrica'];
const HEADER=24,MAX_BYTES=10*1024*1024,MAX_JSON=200000;
const CRC_TABLE=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0});
function crc32(bytes){let value=0xffffffff;for(const b of bytes)value=CRC_TABLE[(value^b)&255]^(value>>>8);return(value^0xffffffff)>>>0}
const finiteArray=(a,count)=>Array.isArray(a)&&a.length===count&&a.every(Number.isFinite);
function requireCondition(ok,message){if(!ok)throw new Error('Modelo gástrico inválido: '+message)}

export function decodeStomachInteriorBuffer(input,definition={},options={}){
 const bytes=ArrayBuffer.isView(input)?new Uint8Array(input.buffer,input.byteOffset,input.byteLength):new Uint8Array(input);
 requireCondition(bytes.byteLength>=HEADER&&bytes.byteLength<=MAX_BYTES,'tamanho do arquivo');const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 requireCondition(String.fromCharCode(...bytes.subarray(0,8))==='ATLSS18\0','identificação');requireCondition(view.getUint32(8,true)===1,'versão');
 const jsonLength=view.getUint32(12,true),payloadLength=view.getUint32(16,true),checksum=view.getUint32(20,true),payloadStart=HEADER+jsonLength;
 requireCondition(jsonLength>0&&jsonLength<=MAX_JSON&&jsonLength%4===0&&payloadStart+payloadLength===bytes.byteLength,'limites do conteúdo');
 requireCondition(crc32(bytes.subarray(HEADER))===checksum,'integridade');
 let metadata;try{metadata=JSON.parse(new TextDecoder().decode(bytes.subarray(HEADER,payloadStart)).trimEnd())}catch{throw new Error('Modelo gástrico inválido: descrição do arquivo')}
 requireCondition(metadata?.schema===1&&metadata.kind==='stomach-interior','tipo de modelo');requireCondition(typeof metadata.mobile==='boolean','perfil');if(options.mobile!==undefined)requireCondition(metadata.mobile===!!options.mobile,'perfil solicitado');
 requireCondition(Array.isArray(metadata.parts)&&metadata.parts.length===9,'quantidade de peças');requireCondition(new Set(metadata.parts.map(p=>p.key )).size===9&&KEYS.every(k=>metadata.parts.some(p=>p.key===k)),'identidade das peças');
 const bounds=metadata.positionBounds,uvBounds=metadata.uvBounds;requireCondition(bounds&&finiteArray(bounds.min,3)&&finiteArray(bounds.max,3)&&bounds.min.every((n,i)=>bounds.max[i]>n),'limites espaciais');requireCondition(uvBounds&&finiteArray(uvBounds.min,2)&&finiteArray(uvBounds.max,2)&&uvBounds.min.every((n,i)=>uvBounds.max[i]>n),'coordenadas de superfície');
 requireCondition(finiteArray(metadata.transform?.scale,3)&&metadata.transform.scale.every(n=>n>0&&n<10)&&finiteArray(metadata.transform.position,3),'transformação');
 const payload=new DataView(bytes.buffer,bytes.byteOffset+payloadStart,payloadLength),ranges=[];
 const field=(part,name,elementSize,count)=>{const entry=part.attributes?.[name];requireCondition(entry&&Number.isSafeInteger(entry.offset)&&entry.offset>=0&&entry.offset%4===0&&entry.length===count*elementSize&&entry.offset+entry.length<=payloadLength,name+' fora do arquivo');ranges.push([entry.offset,entry.offset+entry.length]);return entry.offset};
 // Validate every range and identity before allocating any GPU-owned geometry.
 let totalTriangles=0;for(const p of metadata.parts){requireCondition(KEYS.includes(p.key)&&p.id==='INTERNAL_stomach_'+p.key,'identificador');requireCondition(Number.isSafeInteger(p.vertices)&&p.vertices>=3&&p.vertices<=250000&&Number.isSafeInteger(p.indexCount)&&p.indexCount>=3&&p.indexCount%3===0,'contagem geométrica');requireCondition(p.indexBytes===2||p.indexBytes===4,'índices');requireCondition(Number.isInteger(p.material?.color)&&p.material.color>=0&&p.material.color<=0xffffff&&Number.isFinite(p.material.roughness)&&p.material.roughness>=0&&p.material.roughness<=1,'material');for(const[name,size,count]of[['position',2,p.vertices*3],['normal',2,p.vertices*3],['uv',2,p.vertices*2],['color',1,p.vertices*3],['index',p.indexBytes,p.indexCount]])field(p,name,size,count);totalTriangles+=p.indexCount/3}
 ranges.sort((a,b)=>a[0]-b[0]);requireCondition(ranges.every((r,i)=>!i||r[0]>=ranges[i-1][1]),'blocos sobrepostos');requireCondition(totalTriangles<=(metadata.mobile?150000:350000),'orçamento geométrico');
 const group=new THREE.Group(),parts=[],geometries=new Set(),materials=new Set();let disposed=false;
 group.name='INTERNAL_stomach';group.userData={schematic:true,educational:true,notRealHistology:true,internalOrgan:'stomach',authoredReconstruction:true,anatomicalReference:false,geometryIdentified:true,mobile:metadata.mobile,defaultClip:'none',sourceUrls:stomachInteriorSources,precomputedAuthoredMesh:true};
 try{
  for(const p of metadata.parts){
   const position=new Float32Array(p.vertices*3),normal=new Float32Array(p.vertices*3),uv=new Float32Array(p.vertices*2),color=new Float32Array(p.vertices*3);
   for(let i=0;i<p.vertices*3;i++){const axis=i%3;position[i]=bounds.min[axis]+payload.getUint16(p.attributes.position.offset+i*2,true)/65535*(bounds.max[axis]-bounds.min[axis]);const n=payload.getInt16(p.attributes.normal.offset+i*2,true);requireCondition(n!==-32768,'normal');normal[i]=n/32767;color[i]=payload.getUint8(p.attributes.color.offset+i)/255*1.10}
   for(let i=0;i<p.vertices*2;i++){const axis=i%2;uv[i]=uvBounds.min[axis]+payload.getUint16(p.attributes.uv.offset+i*2,true)/65535*(uvBounds.max[axis]-uvBounds.min[axis])}
   const index=p.indexBytes===2?new Uint16Array(p.indexCount):new Uint32Array(p.indexCount);for(let i=0;i<p.indexCount;i++){const n=p.indexBytes===2?payload.getUint16(p.attributes.index.offset+i*2,true):payload.getUint32(p.attributes.index.offset+i*4,true);requireCondition(n<p.vertices,'índice fora da malha');index[i]=n}
   const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(position,3));geometry.setAttribute('normal',new THREE.BufferAttribute(normal,3));geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));geometry.setAttribute('color',new THREE.BufferAttribute(color,3));geometry.setIndex(new THREE.BufferAttribute(index,1));geometry.userData={...p.geometryMetadata,quantizedSharedPositionGrid:true,precomputedAuthoredMesh:true};geometry.computeBoundingBox();geometry.computeBoundingSphere();geometries.add(geometry);
   const material=new THREE.MeshStandardMaterial({color:p.material.color,roughness:p.material.roughness,metalness:0,side:THREE.DoubleSide,forceSinglePass:true,vertexColors:true});material.userData={authoredStomachMaterial:true,proceduralEducationalSurface:true,photographicTexture:false};materials.add(material);
   const info=(definition.internalParts||[]).find(info=>info.id===p.id||info.partId===p.key)||{id:p.id,name:p.id,label:LABELS[KEYS.indexOf(p.key)]},object=new THREE.Mesh(geometry,material);object.name=p.id;object.userData={...p.objectMetadata,partId:p.key,internalPart:p.id,atlasName:p.id,educational:true,schematic:true,notRealHistology:true,geometryIdentified:true,authoredReconstruction:true,anatomicalReference:false,sourceUrls:stomachInteriorSources};group.add(object);
   parts.push({...info,id:info.id,name:info.name||info.id,contentPartId:info.id,partId:p.key,organId:'stomach',label:info.label||LABELS[KEYS.indexOf(p.key)],pt:info.pt||info.label||LABELS[KEYS.indexOf(p.key)],object,geometryIdentified:true,authoredReconstruction:true,anatomicalReference:false,sourceUrls:stomachInteriorSources,realLumen:!!p.objectMetadata.realLumen,sharedCollectingSeams:!!p.objectMetadata.sharedCollectingSeams,representationNote:p.objectMetadata.representationNote});
  }
  group.scale.fromArray(metadata.transform.scale);group.position.fromArray(metadata.transform.position);group.updateMatrixWorld(true);const resultBounds=new THREE.Box3().setFromObject(group),size=resultBounds.getSize(new THREE.Vector3());requireCondition(resultBounds.getCenter(new THREE.Vector3()).length()<.0001&&Math.abs(Math.max(...size.toArray())-1.2)<.0001,'normalização');
  let geometryBytes=0;for(const g of geometries){for(const a of Object.values(g.attributes))geometryBytes+=a.array.byteLength;geometryBytes+=g.index.array.byteLength}
  return{id:'stomach',title:metadata.title,label:metadata.label,description:metadata.description,group,parts,bounds:resultBounds,orientation:metadata.orientation,limits:metadata.limits,sources:stomachInteriorSources,sourceUrls:stomachInteriorSources,defaultClip:'none',authoredReconstruction:true,anatomicalReference:false,geometryIdentified:true,preserveMaterials:false,topology:metadata.topology,stats:{...metadata.stats,parts:9,meshes:9,drawCalls:9,triangles:totalTriangles,vertices:parts.reduce((n,p)=>n+p.object.geometry.attributes.position.count,0),geometryBytes,mobile:metadata.mobile,precomputedMesh:true,binaryBytes:bytes.byteLength,quantizationStep:bounds.min.map((n,i)=>(bounds.max[i]-n)/65535),photographicTextures:false},dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const g of geometries){g.disposeBoundsTree?.();g.dispose()}for(const m of materials)m.dispose();group.clear();geometries.clear();materials.clear()}};
 }catch(error){for(const g of geometries)g.dispose();for(const m of materials)m.dispose();group.clear();throw error}
}

export async function createStomachInterior(definition={}, {mobile=false}={}){
 const url=new URL('./assets/interiors/stomach-'+(mobile?'touch':'desktop')+'-v18.bin',import.meta.url),response=await fetch(url);if(!response.ok)throw new Error('Não foi possível carregar o corte gástrico.');const length=Number(response.headers?.get?.('content-length'));if(Number.isFinite(length)&&length>MAX_BYTES)throw new Error('Modelo gástrico inválido: arquivo excede o limite.');return decodeStomachInteriorBuffer(await response.arrayBuffer(),definition,{mobile});
}
