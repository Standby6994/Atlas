// Builds the lighter "while moving" version of a render batch by vertex clustering: vertices of each mesh
// that fall in the same grid cell (a few millimetres) and face the same way are merged; triangles that collapse,
// or end up facing against their own vertex normals, are dropped.
// Each mesh is simplified on its own, so the per-mesh index ranges still line up with the full batch.
// Plain worker (no imports): it only handles typed arrays.

self.onmessage=event=>{
  const {id,positions,normals,index,ranges,cell}=event.data;
  const inverse=1/cell,OFFSET=32768,SPAN=65536;
  const clusterOf=new Int32Array(positions.length/3).fill(-1);
  let capacity=Math.max(1024,positions.length/12|0),count=0;
  let sumP=new Float64Array(capacity*3),sumN=new Float64Array(capacity*3),weight=new Uint32Array(capacity);
  const grow=()=>{capacity*=2;const p=new Float64Array(capacity*3),n=new Float64Array(capacity*3),w=new Uint32Array(capacity);p.set(sumP);n.set(sumN);w.set(weight);sumP=p;sumN=n;weight=w};
  let triangles=new Uint32Array(Math.max(3,index.length/2|0)),written=0;
  const pushTriangle=(a,b,c)=>{if(written+3>triangles.length){const t=new Uint32Array(triangles.length*2);t.set(triangles);triangles=t}triangles[written++]=a;triangles[written++]=b;triangles[written++]=c};
  const out=[];
  for(const {start,count:length} of ranges){
    const cells=new Map(),first=written;
    const cluster=v=>{
      let c=clusterOf[v];if(c>=0)return c;
      const x=positions[v*3],y=positions[v*3+1],z=positions[v*3+2];
      // Dominant normal direction (6 buckets) keeps both faces of thin sheets (tendons, membranes) apart.
      let side=0;if(normals){const nx=normals[v*3],ny=normals[v*3+1],nz=normals[v*3+2],ax=Math.abs(nx),ay=Math.abs(ny),az=Math.abs(nz);side=ax>=ay&&ax>=az?(nx<0?1:0):ay>=az?(ny<0?3:2):(nz<0?5:4)}
      const key=(((Math.floor(x*inverse)+OFFSET)*SPAN+(Math.floor(y*inverse)+OFFSET))*SPAN+(Math.floor(z*inverse)+OFFSET))*6+side;
      c=cells.get(key);
      if(c===undefined){if(count===capacity)grow();c=count++;cells.set(key,c)}
      sumP[c*3]+=x;sumP[c*3+1]+=y;sumP[c*3+2]+=z;
      if(normals){sumN[c*3]+=normals[v*3];sumN[c*3+1]+=normals[v*3+1];sumN[c*3+2]+=normals[v*3+2]}
      weight[c]++;clusterOf[v]=c;return c;
    };
    for(let i=start;i+2<start+length;i+=3){
      const a=cluster(index[i]),b=cluster(index[i+1]),c=cluster(index[i+2]);
      if(a!==b&&b!==c&&a!==c)pushTriangle(a,b,c);
    }
    out.push({start:first,count:written-first});
  }
  const outPositions=new Float32Array(count*3),outNormals=new Float32Array(count*3);
  for(let c=0;c<count;c++){
    const w=weight[c]||1;for(let k=0;k<3;k++)outPositions[c*3+k]=sumP[c*3+k]/w;
    const nx=sumN[c*3],ny=sumN[c*3+1],nz=sumN[c*3+2],len=Math.hypot(nx,ny,nz)||1;
    outNormals[c*3]=nx/len;outNormals[c*3+1]=ny/len;outNormals[c*3+2]=nz/len;
  }
  // Drop triangles whose winding now disagrees with the averaged normals (double-sided materials would light them
  // from the back and show dark blotches). The convention is decided per mesh by majority, so a source mesh with
  // inverted winding keeps its triangles.
  if(normals){
    const facing=t=>{const a=triangles[t]*3,b=triangles[t+1]*3,c=triangles[t+2]*3;
      const ux=outPositions[b]-outPositions[a],uy=outPositions[b+1]-outPositions[a+1],uz=outPositions[b+2]-outPositions[a+2],vx=outPositions[c]-outPositions[a],vy=outPositions[c+1]-outPositions[a+1],vz=outPositions[c+2]-outPositions[a+2];
      return (uy*vz-uz*vy)*(outNormals[a]+outNormals[b]+outNormals[c])+(uz*vx-ux*vz)*(outNormals[a+1]+outNormals[b+1]+outNormals[c+1])+(ux*vy-uy*vx)*(outNormals[a+2]+outNormals[b+2]+outNormals[c+2])};
    let kept=0;
    for(const range of out){
      let positive=0;for(let t=range.start;t<range.start+range.count;t+=3)if(facing(t)>0)positive++;
      const keepPositive=positive*3>=range.count/2,start=kept;
      for(let t=range.start;t<range.start+range.count;t+=3){const f=facing(t);if(keepPositive?f>0:f<0){triangles[kept]=triangles[t];triangles[kept+1]=triangles[t+1];triangles[kept+2]=triangles[t+2];kept+=3}}
      range.start=start;range.count=kept-start;
    }
    written=kept;
  }
  const outIndex=count>65535?triangles.slice(0,written):Uint16Array.from(triangles.subarray(0,written));
  self.postMessage({id,positions:outPositions,normals:normals?outNormals:null,index:outIndex,ranges:out,sourceTriangles:index.length/3,triangles:written/3},[outPositions.buffer,outNormals.buffer,outIndex.buffer]);
};
