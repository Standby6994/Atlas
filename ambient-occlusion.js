import * as THREE from 'three';

// Screen-space ambient occlusion for still frames. It darkens creases, cavities and contact areas so organs
// read as volumes instead of flat colour. It runs only on the frame drawn after the camera stops (and on
// changes while still), so it never costs anything during rotation. Depth comes from an opaque-only pass:
// translucent context (ghost bones, faded covers) is left out so it does not cast occlusion.

const fullscreenVertex='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';

const aoFragment=`
precision highp float;
uniform sampler2D tDepth;uniform mat4 projection;uniform mat4 projectionInverse;uniform vec2 resolution;uniform float radius;uniform float intensity;uniform float bias;
varying vec2 vUv;
vec3 viewPosition(vec2 uv){float d=texture2D(tDepth,uv).x;vec4 p=projectionInverse*vec4(uv*2.-1.,d*2.-1.,1.);return p.xyz/p.w;}
float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){
  float depth=texture2D(tDepth,vUv).x;
  if(depth>=.99999){gl_FragColor=vec4(1.);return;}
  vec3 p=viewPosition(vUv);
  vec3 n=normalize(cross(dFdx(p),dFdy(p)));if(dot(n,-p)<0.)n=-n;
  // Screen radius of the world-space sampling sphere at this depth.
  float screenRadius=radius*projection[1][1]/max(-p.z,1e-4)*.5;
  float angle=hash(gl_FragCoord.xy)*6.2831853,sum=0.;
  const int SAMPLES=12;
  for(int i=0;i<SAMPLES;i++){
    float t=(float(i)+.5)/float(SAMPLES);float a=angle+t*24.;
    vec3 q=viewPosition(vUv+vec2(cos(a),sin(a))*t*screenRadius)-p;float dist2=dot(q,q);
    // Alchemy-style obscurance, faded out beyond the sampling radius so distant surfaces do not darken.
    float range=1.-smoothstep(radius,radius*2.,sqrt(dist2));
    sum+=max(0.,dot(q,n)-bias*radius)/(dist2+.01*radius*radius)*range;
  }
  float ao=clamp(1.-intensity*radius*sum/float(SAMPLES),0.,1.);
  gl_FragColor=vec4(vec3(ao),1.);
}`;

// Depth-aware 5×5 blur so occlusion does not bleed across silhouettes.
const blurFragment=`
precision highp float;
uniform sampler2D tAO;uniform sampler2D tDepth;uniform vec2 texel;varying vec2 vUv;
void main(){
  float centre=texture2D(tDepth,vUv).x,total=0.,weight=0.;
  for(int x=-2;x<=2;x++)for(int y=-2;y<=2;y++){vec2 uv=vUv+vec2(float(x),float(y))*texel;float d=texture2D(tDepth,uv).x;float w=1./(1.+abs(d-centre)*4000.);total+=texture2D(tAO,uv).r*w;weight+=w;}
  gl_FragColor=vec4(vec3(total/weight),1.);
}`;

export function createAmbientOcclusion(renderer){
  const depthTarget=new THREE.WebGLRenderTarget(1,1,{depthTexture:new THREE.DepthTexture(1,1),minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
  const aoTarget=new THREE.WebGLRenderTarget(1,1,{type:THREE.UnsignedByteType});
  const blurTarget=new THREE.WebGLRenderTarget(1,1,{type:THREE.UnsignedByteType});
  const depthOnly=new THREE.MeshBasicMaterial({colorWrite:false,side:THREE.DoubleSide});
  const aoMaterial=new THREE.ShaderMaterial({vertexShader:fullscreenVertex,fragmentShader:aoFragment,depthTest:false,depthWrite:false,
    uniforms:{tDepth:{value:depthTarget.depthTexture},projection:{value:new THREE.Matrix4()},projectionInverse:{value:new THREE.Matrix4()},resolution:{value:new THREE.Vector2()},radius:{value:.05},intensity:{value:1.1},bias:{value:.08}}});
  const blurMaterial=new THREE.ShaderMaterial({vertexShader:fullscreenVertex,fragmentShader:blurFragment,depthTest:false,depthWrite:false,
    uniforms:{tAO:{value:aoTarget.texture},tDepth:{value:depthTarget.depthTexture},texel:{value:new THREE.Vector2()}}});
  // Multiply the finished frame by the occlusion term, leaving alpha (and the transparent background) untouched.
  const compositeMaterial=new THREE.ShaderMaterial({vertexShader:fullscreenVertex,depthTest:false,depthWrite:false,transparent:true,toneMapped:false,
    blending:THREE.CustomBlending,blendSrc:THREE.ZeroFactor,blendDst:THREE.SrcColorFactor,blendSrcAlpha:THREE.ZeroFactor,blendDstAlpha:THREE.OneFactor,
    uniforms:{tAO:{value:blurTarget.texture}},fragmentShader:'uniform sampler2D tAO;varying vec2 vUv;void main(){gl_FragColor=vec4(texture2D(tAO,vUv).rgb,1.);}'});
  const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2));quad.frustumCulled=false;const quadScene=new THREE.Scene();quadScene.add(quad);const quadCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  const hidden=[];

  // radius: sampling distance in world units (a few percent of the visible model).
  function render(scene,camera,{radius=.05,scale=.5}={}){
    const gl=renderer.getContext(),w=Math.max(1,Math.round(gl.drawingBufferWidth*scale)),h=Math.max(1,Math.round(gl.drawingBufferHeight*scale));
    if(depthTarget.width!==w||depthTarget.height!==h){depthTarget.setSize(w,h);aoTarget.setSize(w,h);blurTarget.setSize(w,h)}
    // Opaque-only depth.
    scene.traverseVisible(o=>{if(o.isMesh&&(o.userData.noOcclusion||[].concat(o.material).every(m=>m?.transparent&&m.opacity<.95)))hidden.push(o)});
    for(const o of hidden)o.visible=false;
    const background=scene.background,autoClear=renderer.autoClear;scene.background=null;scene.overrideMaterial=depthOnly;
    renderer.setRenderTarget(depthTarget);renderer.clear();renderer.render(scene,camera);
    scene.overrideMaterial=null;scene.background=background;for(const o of hidden)o.visible=true;hidden.length=0;
    aoMaterial.uniforms.projection.value.copy(camera.projectionMatrix);aoMaterial.uniforms.projectionInverse.value.copy(camera.projectionMatrixInverse);
    aoMaterial.uniforms.resolution.value.set(w,h);aoMaterial.uniforms.radius.value=radius;
    quad.material=aoMaterial;renderer.setRenderTarget(aoTarget);renderer.render(quadScene,quadCamera);
    blurMaterial.uniforms.texel.value.set(1/w,1/h);quad.material=blurMaterial;renderer.setRenderTarget(blurTarget);renderer.render(quadScene,quadCamera);
    renderer.setRenderTarget(null);renderer.autoClear=false;quad.material=compositeMaterial;renderer.render(quadScene,quadCamera);renderer.autoClear=autoClear;
  }
  function dispose(){for(const t of [depthTarget,aoTarget,blurTarget])t.dispose();depthTarget.depthTexture.dispose();for(const m of [depthOnly,aoMaterial,blurMaterial,compositeMaterial])m.dispose();quad.geometry.dispose()}
  return{render,dispose};
}
